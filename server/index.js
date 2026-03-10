const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const IMAGES_FILE = path.join(DATA_DIR, 'images.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据文件
function initDataFile(filePath, defaultData = []) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

initDataFile(USERS_FILE, []);
initDataFile(IMAGES_FILE, []);

// 数据操作函数
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../dist')));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 认证中间件
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
};

// 管理员权限中间件
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// ===== 用户认证路由 =====

// 注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '请提供邮箱和密码' });
    }
    
    const users = readJSON(USERS_FILE);
    
    // 检查邮箱是否已存在
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建用户
    const newUser = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      role: users.length === 0 ? 'admin' : 'user', // 第一个用户为管理员
      createdAt: new Date().toISOString(),
      generationCount: 0
    };
    
    users.push(newUser);
    writeJSON(USERS_FILE, users);
    
    // 生成JWT
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(400).json({ error: '邮箱或密码错误' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: '邮箱或密码错误' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    generationCount: user.generationCount
  });
});

// ===== 图像生成路由 =====

// API配置
const API_PROVIDERS = {
  zhenzhen: {
    baseURL: 'https://ai.t8star.cn/v1',
    apiKey: process.env.ZHENZHEN_API_KEY || 'sk-JgRCJUhqOQGWZFqwmy0yKtrLCzndPdOuXvg7dYJaQe9Zqb7B'
  },
  sillydream: {
    baseURL: 'https://wish.sillydream.top/v1',
    apiKey: process.env.SILLYDREAM_API_KEY || 'sk-FVloorNCjI45pHYrBwqCHnvPU8SvRaPbFRH5iYMlQ5Mwu3yF'
  }
};

// 生成图像
app.post('/api/generate', authMiddleware, async (req, res) => {
  try {
    const { prompt, provider, model, size, aspectRatio, mode, referenceImages } = req.body;
    
    const providerConfig = API_PROVIDERS[provider];
    if (!providerConfig) {
      return res.status(400).json({ error: '无效的API供应商' });
    }
    
    // 构建消息内容
    let messageContent;
    
    if (mode === 'text2img') {
      // 文生图
      messageContent = prompt;
    } else if (mode === 'img2img' && referenceImages && referenceImages.length > 0) {
      // 图生图
      messageContent = [
        { type: 'text', text: prompt }
      ];
      
      // 添加参考图片
      for (const imgUrl of referenceImages) {
        messageContent.push({
          type: 'image_url',
          image_url: { url: imgUrl }
        });
      }
    } else if (mode === 'multiImg' && referenceImages && referenceImages.length > 0) {
      // 多图参考
      messageContent = [
        { type: 'text', text: prompt }
      ];
      
      for (const imgUrl of referenceImages) {
        messageContent.push({
          type: 'image_url',
          image_url: { url: imgUrl }
        });
      }
    } else {
      return res.status(400).json({ error: '无效的生成模式或缺少参考图片' });
    }
    
    // 调用API
    const response = await axios.post(
      `${providerConfig.baseURL}/chat/completions`,
      {
        model: model || 'gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: messageContent }]
      },
      {
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    
    // 解析返回结果
    const content = response.data.choices[0]?.message?.content || '';
    
    // 提取图片URL或base64
    let imageUrl = null;
    let imageBase64 = null;
    
    const markdownMatch = content.match(/!\[image\]\((.*?)\)/);
    if (markdownMatch) {
      const url = markdownMatch[1];
      if (url.startsWith('data:')) {
        imageBase64 = url;
      } else {
        imageUrl = url;
      }
    }
    
    // 保存生成记录
    const images = readJSON(IMAGES_FILE);
    const newImage = {
      id: Date.now().toString(),
      userId: req.user.userId,
      prompt,
      mode,
      provider,
      model: model || 'gemini-3-pro-image-preview',
      size,
      aspectRatio,
      imageUrl,
      imageBase64: imageBase64 ? '[BASE64_DATA]' : null,
      createdAt: new Date().toISOString()
    };
    images.push(newImage);
    writeJSON(IMAGES_FILE, images);
    
    // 更新用户生成次数
    const users = readJSON(USERS_FILE);
    const userIndex = users.findIndex(u => u.id === req.user.userId);
    if (userIndex !== -1) {
      users[userIndex].generationCount = (users[userIndex].generationCount || 0) + 1;
      writeJSON(USERS_FILE, users);
    }
    
    res.json({
      success: true,
      imageUrl,
      imageBase64,
      id: newImage.id
    });
    
  } catch (error) {
    console.error('生成图像错误:', error.message);
    if (error.response) {
      console.error('API响应:', error.response.data);
    }
    res.status(500).json({ 
      error: '图像生成失败',
      details: error.message 
    });
  }
});

// 上传图片（用于图生图）
app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    
    const filePath = req.file.path;
    const fileData = fs.readFileSync(filePath);
    const base64 = fileData.toString('base64');
    const mimeType = req.file.mimetype;
    
    // 删除临时文件
    fs.unlinkSync(filePath);
    
    res.json({
      url: `data:${mimeType};base64,${base64}`
    });
  } catch (error) {
    console.error('上传错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// 获取用户生成历史
app.get('/api/history', authMiddleware, (req, res) => {
  try {
    const images = readJSON(IMAGES_FILE);
    const userImages = images
      .filter(img => img.userId === req.user.userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(userImages);
  } catch (error) {
    console.error('获取历史错误:', error);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

// ===== 管理员路由 =====

// 获取所有用户（管理员）
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const users = readJSON(USERS_FILE);
    const sanitizedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      generationCount: u.generationCount || 0
    }));
    res.json(sanitizedUsers);
  } catch (error) {
    console.error('获取用户错误:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 更新用户角色（管理员）
app.put('/api/admin/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    const users = readJSON(USERS_FILE);
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    users[userIndex].role = role;
    writeJSON(USERS_FILE, users);
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新角色错误:', error);
    res.status(500).json({ error: '更新角色失败' });
  }
});

// 删除用户（管理员）
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    const users = readJSON(USERS_FILE);
    const filteredUsers = users.filter(u => u.id !== id);
    writeJSON(USERS_FILE, filteredUsers);
    
    // 同时删除该用户的生成记录
    const images = readJSON(IMAGES_FILE);
    const filteredImages = images.filter(img => img.userId !== id);
    writeJSON(IMAGES_FILE, filteredImages);
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// 获取所有生成记录（管理员）
app.get('/api/admin/images', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const images = readJSON(IMAGES_FILE);
    const users = readJSON(USERS_FILE);
    
    const enrichedImages = images.map(img => {
      const user = users.find(u => u.id === img.userId);
      return {
        ...img,
        userEmail: user ? user.email : '未知用户'
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(enrichedImages);
  } catch (error) {
    console.error('获取图像错误:', error);
    res.status(500).json({ error: '获取图像列表失败' });
  }
});

// 获取统计数据（管理员）
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const users = readJSON(USERS_FILE);
    const images = readJSON(IMAGES_FILE);
    
    const today = new Date().toISOString().split('T')[0];
    const todayGenerations = images.filter(img => img.createdAt.startsWith(today)).length;
    
    res.json({
      totalUsers: users.length,
      totalGenerations: images.length,
      todayGenerations,
      adminCount: users.filter(u => u.role === 'admin').length
    });
  } catch (error) {
    console.error('获取统计错误:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 前端路由处理
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = app;
