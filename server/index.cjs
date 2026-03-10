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
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nanabanana-secret-key-2024';

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const IMAGES_FILE = path.join(DATA_DIR, 'images.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function initDataFile(filePath, defaultData = []) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

initDataFile(USERS_FILE, []);
initDataFile(IMAGES_FILE, []);

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

// 健康检查（必须最先）
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 静态文件服务（前端 dist 文件夹）
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  console.warn('警告：未找到 dist 文件夹，请先运行 npm run build');
}

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// 认证中间件
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未提供认证令牌' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
};

// API 配置
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

// 注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '请提供邮箱和密码' });
    
    const users = readJSON(USERS_FILE);
    if (users.find(u => u.email === email)) return res.status(400).json({ error: '该邮箱已被注册' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      role: users.length === 0 ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
      generationCount: 0
    };
    
    users.push(newUser);
    writeJSON(USERS_FILE, users);
    
    const token = jwt.sign({ userId: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ token, user: { id: newUser.id, email: newUser.email, role: newUser.role } });
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
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(400).json({ error: '邮箱或密码错误' });
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.user.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ id: user.id, email: user.email, role: user.role, generationCount: user.generationCount || 0 });
});

// 生成图像
app.post('/api/generate', authMiddleware, async (req, res) => {
  try {
    const { prompt, provider, model, mode, referenceImages } = req.body;
    const providerConfig = API_PROVIDERS[provider];
    if (!providerConfig) return res.status(400).json({ error: '无效的API供应商' });
    
    let messageContent;
    if (mode === 'text2img') {
      messageContent = prompt;
    } else if ((mode === 'img2img' || mode === 'multiImg') && referenceImages?.length > 0) {
      messageContent = [{ type: 'text', text: prompt }];
      referenceImages.forEach(imgUrl => {
        messageContent.push({ type: 'image_url', image_url: { url: imgUrl } });
      });
    } else {
      return res.status(400).json({ error: '无效的生成模式' });
    }
    
    const response = await axios.post(
      `${providerConfig.baseURL}/chat/completions`,
      { model: model || 'gemini-3-pro-image-preview', messages: [{ role: 'user', content: messageContent }] },
      { headers: { 'Authorization': `Bearer ${providerConfig.apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 }
    );
    
    const content = response.data.choices[0]?.message?.content || '';
    let imageUrl = null;
    let imageBase64 = null;
    
    const markdownMatch = content.match(/!\[image\]\((.*?)\)/);
    if (markdownMatch) {
      const url = markdownMatch[1];
      if (url.startsWith('data:')) imageBase64 = url;
      else imageUrl = url;
    }
    
    const images = readJSON(IMAGES_FILE);
    const newImage = {
      id: Date.now().toString(),
      userId: req.user.userId,
      prompt,
      mode,
      provider,
      model: model || 'gemini-3-pro-image-preview',
      imageUrl,
      createdAt: new Date().toISOString()
    };
    images.push(newImage);
    writeJSON(IMAGES_FILE, images);
    
    const users = readJSON(USERS_FILE);
    const userIndex = users.findIndex(u => u.id === req.user.userId);
    if (userIndex !== -1) {
      users[userIndex].generationCount = (users[userIndex].generationCount || 0) + 1;
      writeJSON(USERS_FILE, users);
    }
    
    res.json({ success: true, imageUrl, imageBase64, id: newImage.id });
  } catch (error) {
    console.error('生成图像错误:', error.message);
    res.status(500).json({ error: '图像生成失败', details: error.message });
  }
});

// 上传图片
app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未上传文件' });
    
    const fileData = fs.readFileSync(req.file.path);
    const base64 = fileData.toString('base64');
    fs.unlinkSync(req.file.path);
    
    res.json({ url: `data:${req.file.mimetype};base64,${base64}` });
  } catch (error) {
    res.status(500).json({ error: '上传失败' });
  }
});

// 获取历史
app.get('/api/history', authMiddleware, (req, res) => {
  const images = readJSON(IMAGES_FILE);
  const userImages = images.filter(img => img.userId === req.user.userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(userImages);
});

// 管理员路由
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE).map(u => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt, generationCount: u.generationCount || 0 }));
  res.json(users);
});

app.put('/api/admin/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  user.role = req.body.role;
  writeJSON(USERS_FILE, users);
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE).filter(u => u.id !== req.params.id);
  writeJSON(USERS_FILE, users);
  const images = readJSON(IMAGES_FILE).filter(img => img.userId !== req.params.id);
  writeJSON(IMAGES_FILE, images);
  res.json({ success: true });
});

app.get('/api/admin/images', authMiddleware, adminMiddleware, (req, res) => {
  const images = readJSON(IMAGES_FILE);
  const users = readJSON(USERS_FILE);
  const enriched = images.map(img => ({ ...img, userEmail: users.find(u => u.id === img.userId)?.email || '未知' })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(enriched);
});

app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE);
  const images = readJSON(IMAGES_FILE);
  const today = new Date().toISOString().split('T')[0];
  res.json({
    totalUsers: users.length,
    totalGenerations: images.length,
    todayGenerations: images.filter(img => img.createdAt.startsWith(today)).length,
    adminCount: users.filter(u => u.role === 'admin').length
  });
});

// 前端路由处理（必须放在最后）
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: '前端未构建，找不到 index.html' });
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`✅ 服务器运行在端口 ${PORT}`);
  console.log(`✅ 健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
