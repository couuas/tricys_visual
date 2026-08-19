# Tricys Visual

> **Tritium Integrated Cycle Simulation (TRICYS) — Modern Web Digital Twin & Simulation Workbench**

`tricys_visual` is the web-based visualization frontend and digital twin cockpit for the **TRICYS** platform. Built with **Vue 3**, **Vite**, **Three.js**, and **ECharts**, it provides end-to-end capabilities for Modelica-based fusion fuel cycle simulation, including model structure exploration, 2D/3D digital twin visualization, real-time multi-task monitoring, and post-simulation analytics.

---

## 🌟 Key Features

### 1. 📁 Project & Model Management
- **Automated Model Parsing**: Upload or select `.mo` (Modelica) files to automatically extract system topology (components, ports, connections, and parameter schemas).
- **Template & Demo Initialization**: Quick-start templates and built-in demo projects for immediate exploration.
- **Project Isolation**: Multi-tenant user spaces with permission-controlled sharing and public preview modes.

### 2. ⚙️ Simulation & Analysis Cockpit
- **Flexible Configuration**: Full support for simulation interval, solver selection, step size, and tolerance settings.
- **Hierarchical Parameter Overrides**: Select components and override parameters hierarchically with revert capabilities.
- **Variable Filter Selection**: Select component-to-component output variables and precise array indices (e.g. `sds.I[1]`, `sds.inventory`) to optimize result storage.
- **FOC (Fuel Options & Control) Integration**: Configure target metrics, objective formulas, and bounds directly from the workbench.

### 3. 🌐 2D & 3D Digital Twin Studio
- **Interactive 3D Viewport**: High-performance 3D scene rendering powered by **Three.js**, supporting orbit controls, camera transitions, and spatial layout inspection.
- **2D Topology Twin Canvas**: Interactive SVG-based 2D twin projection with orthogonal/bezier routing, grid snapping, and component grouping.
- **Custom Asset Library**: Bind custom `.glb` 3D CAD/mesh assets to Modelica components with scale and rotation tuning.
- **Annotations & Metadata**: Attach notes, telemetry tags, and visual styling to topology components.

### 4. 📊 Real-Time Monitoring & Task Lifecycle
- **Concurrent Task Execution**: Multi-task execution pool supporting parallel simulation and analysis runs.
- **Live Streamed Logs**: Real-time console logs and simulation progress delivered via **WebSockets**.
- **Task Control & Interruption**: Clean task lifecycle management with `STOP / TERMINATE` controls and terminal state persistence.
- **Activity Dashboard**: Aggregated KPIs, status distribution charts, and 7-day activity trends.

### 5. 📈 Post-Processing & Result Analytics
- **HDF5 Interactive Visualizer**: Direct multi-variable time-series plotting from simulation output files (`sweep_results.h5`).
- **Rich Document Rendering**: Automated analysis reports formatted with **Markdown** and **KaTeX** mathematical typesetting.
- **Data Export**: Export charts, parameters, and time-series datasets in various formats.

### 6. 🎨 Low-Code Exhibition (GoView Integration)
- **Embedded Drag-and-Drop Dashboards**: Integrated with the GoView data visualization platform.
- **Custom 2D/3D Twin Assets**: Reusable draggable twin widgets (`Tricys 2D Twin Asset`, `Tricys 3D Scene Asset`) for customized exhibition screens.

---

## 🏗️ Architecture & Directory Structure

`tricys_visual` adopts a domain-driven modular architecture:

```text
src/
├── api/                   # REST API client & endpoint definitions
│   ├── client.js          # Axios instance with auth interceptors
│   ├── project.js         # Project CRUD & metadata APIs
│   ├── task.js            # Task submission & query APIs
│   ├── goview.js          # GoView integration APIs
│   └── visualizer.js      # HDF5 & visualizer service APIs
│
├── modules/               # Domain-driven feature modules
│   ├── projects/          # Project list, creation, and pages
│   ├── simulation/        # Simulation setup, FOC panel, and parameters
│   ├── studio/            # 3D/2D digital twin studio & media library
│   ├── monitor/           # Task monitor dashboard & live status panel
│   ├── analysis/          # Post-processing analytics & Agent view
│   ├── exhibition/        # GoView embedded exhibition container
│   ├── account/           # User authentication & profile views
│   ├── admin/             # System administration & user management
│   └── help/              # Platform user manuals & documentation
│
├── platform/              # Cross-module platform adapters & protocols
│   ├── adapters/          # 2D/3D topology layout & coordinate projection
│   └── protocols/         # Scene document schema & serialization
│
├── shared/                # Cross-module reusable state & logic
│   ├── auth/              # Authentication composables & token handling
│   ├── project/           # Shared project workspace state
│   └── session/           # Workspace session management
│
├── styles/                # Design system tokens & global styling
├── utils/                 # Helpers (math, notifications, dialogs, URLs)
├── App.vue                # Application root component
└── main.js                # Application entry point
```

---

## 🛠️ Technology Stack

| Category | Technologies |
| :--- | :--- |
| **Framework** | [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`) |
| **Build System** | [Vite](https://vitejs.dev/) |
| **Routing** | [Vue Router 4](https://router.vuejs.org/) |
| **3D Graphics** | [Three.js](https://threejs.org/) |
| **Charting & Visualization** | [ECharts 5](https://echarts.apache.org/), [Chart.js 4](https://www.chartjs.org/) |
| **Math & Markdown** | [KaTeX](https://katex.org/), [Marked](https://marked.js.org/) |
| **Network & Realtime** | [Axios](https://axios-http.com/), WebSockets |
| **Styling** | Vanilla CSS Design System, [Sass](https://sass-lang.com/) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher recommended
- **Package Manager**: `npm`, `pnpm`, or `yarn`
- **Backend Service**: `tricys_backend` running on `http://localhost:8000`

### Installation

```bash
# Navigate to the tricys_visual directory
cd tricys_visual

# Install project dependencies
npm install
```

### Development Server

Start the local development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Default local address: `http://localhost:5173/`

### Production Build

Compile and optimize assets for production deployment:

```bash
npm run build
```

The output bundle will be generated in the `dist/` directory.

---

## ⚙️ Environment Variables

Create or modify `.env` or `.env.local` to customize runtime settings:

```env
# Backend REST API endpoint
VITE_API_URL=http://localhost:8000/api/v1

# Secondary / GoView backend bridge endpoint
VITE_API_V2_URL=http://localhost:8000/api/v2/goview

# GoView Exhibition server URL
VITE_GOVIEW_URL=http://localhost:5174
```

---

## 🤝 Submodule Collaboration

`tricys_visual` operates as a submodule within the main [TRICYS repository](https://github.com/asipp-neutronics/tricys):

- **Backend Integration**: Communicates with [`tricys_backend`](https://github.com/couuas/tricys_backend) for OMC schema extraction, process execution, and SQLite/PostgreSQL persistence.
- **Exhibition Integration**: Embeds and exchanges scene contexts with [`tricys_goview`](https://github.com/couuas/tricys_goview).

---

## 📄 License

This project is licensed under the [Apache 2.0](LICENSE) License.
