# AI图像生成工坊

一个基于 Gemini 3 Pro Image 模型的在线AI图像生成平台，支持文生图、图生图和多图参考生图功能。

## 功能特性

### 核心功能
- **文生图**：输入文字描述，AI生成相应图像
- **图生图**：上传参考图片，基于图片进行修改或风格转换
- **多图参考生图**：上传多张参考图片，融合各图特点生成新图像

### API供应商
- **贞贞的AI工坊** (https://ai.t8star.cn)
- **SillyDream** (https://wish.sillydream.top)

### 图像参数
- **分辨率**：1K (1024px) / 2K (2048px)
- **宽高比**：1:1, 16:9, 9:16, 4:3, 3:4, 21:9

### 用户系统
- 邮箱注册/登录
- JWT认证
- 角色权限管理（超级管理员/普通用户）
- 生成历史记录

### 管理后台
- 用户管理（查看、修改角色、删除）
- 生成记录查看
- 统计数据（总用户数、总生成次数、今日生成等）

## 技术栈

- **前端**：React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **后端**：Node.js + Express
- **数据存储**：JSON文件（轻量级，无需数据库配置）
- **认证**：JWT

## 本地开发

### 安装依赖
```bash
npm install
```

### 配置环境变量
创建 `.env` 文件：
```env
JWT_SECRET=your-super-secret-jwt-key
ZHENZHEN_API_KEY=your-zhenzhen-api-key
SILLYDREAM_API_KEY=your-sillydream-api-key
```

### 启动开发服务器
```bash
npm run dev
```

这将同时启动前端开发服务器和后端API服务器。

- 前端：http://localhost:5173
- 后端API：http://localhost:3001

### 构建生产版本
```bash
npm run build
```

### 启动生产服务器
```bash
npm start
```

## 部署到Railway

### 方式一：通过Railway CLI

1. 安装Railway CLI
```bash
npm install -g @railway/cli
```

2. 登录Railway
```bash
railway login
```

3. 初始化项目
```bash
railway init
```

4. 部署
```bash
railway up
```

### 方式二：通过GitHub集成

1. 将代码推送到GitHub仓库
2. 在Railway控制台创建新项目，选择GitHub仓库
3. 添加环境变量：
   - `JWT_SECRET`
   - `ZHENZHEN_API_KEY`
   - `SILLYDREAM_API_KEY`
4. 部署自动开始

### 环境变量配置

在Railway控制台设置以下环境变量：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `JWT_SECRET` | JWT签名密钥 | 是 |
| `ZHENZHEN_API_KEY` | 贞贞AI工坊API密钥 | 是 |
| `SILLYDREAM_API_KEY` | SillyDream API密钥 | 是 |
| `PORT` | 服务器端口（Railway自动设置） | 否 |

## 项目结构

```
├── server/                 # 后端代码
│   ├── index.js           # 主服务器文件
│   ├── data/              # 数据存储目录
│   └── uploads/           # 上传文件临时目录
├── src/                   # 前端代码
│   ├── components/        # 组件
│   ├── contexts/          # React Context
│   ├── pages/             # 页面组件
│   ├── services/          # API服务
│   └── App.tsx            # 主应用组件
├── dist/                  # 构建输出
├── .env                   # 环境变量
├── package.json
└── README.md
```

## API端点

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户信息

### 图像生成
- `POST /api/generate` - 生成图像
- `POST /api/upload` - 上传图片
- `GET /api/history` - 获取生成历史

### 管理员
- `GET /api/admin/users` - 获取所有用户
- `PUT /api/admin/users/:id/role` - 更新用户角色
- `DELETE /api/admin/users/:id` - 删除用户
- `GET /api/admin/images` - 获取所有生成记录
- `GET /api/admin/stats` - 获取统计数据

## 使用说明

### 首次使用
1. 注册账户（第一个注册的账户自动成为管理员）
2. 登录系统
3. 选择生成模式和参数
4. 输入提示词，开始生成

### 图生图功能
1. 选择"图生图"模式
2. 上传参考图片
3. 输入提示词描述想要的修改
4. 点击生成

### 多图参考生图
1. 选择"多图参考"模式
2. 上传2-4张参考图片
3. 输入提示词描述想要融合的效果
4. 点击生成

## 注意事项

1. API密钥请妥善保管，不要泄露
2. 上传图片大小限制为10MB
3. 生成过程可能需要10-60秒，请耐心等待
4. 建议定期备份 `server/data/` 目录

## 许可证

MIT License
