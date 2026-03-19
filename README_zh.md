# TRICYS Visual (前端可视化)

> **Tritium Integrated Cycle Simulation (TRICYS) - 可视化前端主控台**

`tricys_visual` 是基于 Vue 3 的现代高性能前端，为 TRICYS 平台提供实时的仿真监控、动态的 3D 可视化交互以及全面的分析结果展示。

## 核心特性

- **实时监控**: 通过 WebSocket 实时追踪仿真过程的关键指标 (KPI)、任务状态以及日志流。
- **3D 数字孪生可视化**: 深度集成 Three.js 引擎，提供沉浸式的交互数字孪生可视化体验。
- **组件编辑器**: 可视化编辑器，用于轻松配置 Modelica 组件参数以及网络连接结构。
- **结果分析模块**: 内置文件浏览器与解析器，支持 HDF5 图形化查看、Markdown 格式科研报告实时渲染。
- **GoView 深度集成**: 与 GoView 低代码数据可视化平台无缝嵌入，实现高级的定制化数据大屏映射。

## 项目架构

基于现代 Web 技术栈构建：
- **框架**: [Vue 3](https://vuejs.org/) (Composition API)
- **构建工具**: [Vite](https://vitejs.dev/)
- **路由**: Vue Router

```text
src/
├── api/            # API 请求客户端与后端服务接口封装
├── components/     # 可复用的 Vue 组件 (公共组件、布局组件、业务功能组件)
├── composables/    # Vue 3 组合式 API Hooks 函数
├── layouts/        # 全局页面布局结构
├── router/         # Vue Router 路由配置
├── styles/         # 全局样式、主题与设计系统
├── utils/          # 全局帮助函数和通用工具
└── views/          # 顶层路由视图页面
```

## 快速开始

### 环境依赖

- Node.js (建议 v16.0 及以上版本)
- npm, yarn, 或 pnpm

### 安装包依赖

```bash
# 克隆项目仓库
git clone https://github.com/asipp-neutronics/tricys_visual.git

# 安装依赖
npm install
```

### 启动开发服务器

启动带有热更新 (HMR) 的本地开发服务器：

```bash
npm run dev
```

### 生产环境构建

编译、压缩并打包用于生产环境发布的静态文件：

```bash
npm run build
```

##  环境配置

可以通过修改根目录下的 `.env` 文件（如 `.env.local`）来配置环境变量：

- `VITE_API_URL`: 后端 API 服务地址 (默认: `http://localhost:8000/api/v1`)
- `VITE_GOVIEW_URL`: 外部 GoView 可视化大屏实例的访问 URL

##  许可证

本项目采用 [APACHE 2.0](LICENSE) 许可证。
