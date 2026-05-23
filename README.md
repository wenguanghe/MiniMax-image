# MiniMax Image Generator

基于 MiniMax AI 平台的智能图片生成工具，提供友好的 Web 界面，支持文生图任务队列管理。

## 功能特点

- 🎨 **文生图** - 调用 MiniMax image-01 模型生成高质量图片
- 📋 **任务队列** - 支持批量提交提示词，智能排队调度处理
- ⚡ **并发控制** - 可配置并发数，同时处理多个生成任务
- 🔄 **自动重试** - 失败任务自动重试，提高任务成功率
- 💾 **本地存储** - 生成图片自动下载保存到本地
- 🖼️ **图片预览** - 支持大图预览、下载、删除管理

## 支持的模型

| 模型 | 说明 |
|------|------|
| **image-01** | 基础图片生成模型，画面表现细腻，支持文生图、图生图 |
| **image-01-live** | 手绘、卡通等画风增强版本，支持画风设置 |

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + TailwindCSS
- **后端**: Express + TypeScript (Node.js)
- **图标**: Lucide Vue

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

访问 [MiniMax 开放平台](https://platform.minimaxi.com) 注册账号并获取 API Key，然后在应用界面中配置。

### 3. 启动服务

```bash
npm run dev
```

访问 http://localhost:5173 即可使用。

## 项目结构

```
├── api/                         # 后端服务
│   ├── app.ts                  # Express 主入口
│   ├── types.ts               # TypeScript 类型定义
│   ├── routes/                # API 路由
│   │   ├── config.ts          # 配置管理接口
│   │   ├── queue.ts          # 任务队列接口
│   │   └── images.ts         # 图片服务接口
│   ├── services/              # 业务逻辑
│   │   ├── config.ts         # 配置服务
│   │   ├── queue.ts          # 队列服务
│   │   └── imageGenerator.ts # 图片生成服务
│   └── generated/             # 生成的图片存放目录
├── src/                        # 前端源码
│   ├── components/          # Vue 组件
│   │   ├── ApiConfig.vue     # API 配置组件
│   │   ├── PromptInput.vue   # 提示词输入组件
│   │   ├── QueuePanel.vue     # 任务队列面板
│   │   └── ImageGallery.vue  # 图片展示组件
│   ├── pages/                 # 页面
│   │   └── HomePage.vue      # 主页
│   └── router/               # 路由配置
└── public/                   # 静态资源
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/config` | GET/POST | 获取/保存 API 配置 |
| `/api/config/test` | POST | 测试 API 连接 |
| `/api/queue/add` | POST | 添加任务到队列 |
| `/api/queue/status` | GET | 获取队列状态 |
| `/api/queue/pause` | POST | 暂停队列处理 |
| `/api/queue/resume` | POST | 恢复队列处理 |
| `/api/queue/clear` | POST | 清除已完成任务 |
| `/api/images/:id` | GET/DELETE | 获取/删除图片 |

## 配置说明

在界面左侧的 API 配置区域填写：

- **API URL**: `https://api.minimaxi.com/v1/image_generation`
- **模型名称**: `image-01` 或 `image-01-live`
- **API Key**: 你的 MiniMax API 密钥

高级设置：
- **并发数**: 同时处理的任务数量（默认 3）
- **最大重试**: 任务失败时的自动重试次数（默认 3）

## 注意事项

- 请妥善保管您的 API Key，不要泄露给他人
- 生成图片保存在 `api/generated/` 目录
- 配置文件保存在 `api/config.json`
- 建议在使用前测试 API 连接确保配置正确

## License

MIT