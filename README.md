# Tricys Visual

> **Tritium Integrated Cycle Simulation (TRICYS) - Visualization Frontend**

`tricys_visual` is the modern, high-performance Vue 3-based frontend for the TRICYS platform, providing real-time simulation monitoring, dynamic 3D visualizations, and comprehensive result analysis.

## Core Features

- **📊 Real-time Monitoring**: Live tracking of simulation KPIs, process status, and log streams via WebSockets.
- **🌐 3D Digital Twin Visualization**: Interactive digital twin visualization integrated with Three.js.
- **🛠️ Component Editor**: Visual editor for configuring Modelica component parameters and network connections.
- **📈 Result Analysis**: Integrated HDF5 viewer, Markdown report rendering, and other post-simulation visualizers.
- **🔗 GoView Integration**: Seamless embedding with the GoView low-code data visualization platform for advanced dashboarding.

## Project Architecture

Built with modern web technologies:
- **Framework**: [Vue 3](https://vuejs.org/) (Composition API)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Routing**: Vue Router

```text
src/
├── api/            # API client and backend service wrappers
├── components/     # Reusable Vue components (Common, Layout, Features)
├── composables/    # Vue 3 Composition API hooks
├── layouts/        # Global page layouts
├── router/         # Vue Router configuration
├── styles/         # Global styles and design system
├── utils/          # Helper functions and utilities
└── views/          # Top-level route pages
```

## Getting Started

### Prerequisites

- Node.js (v16.0 or higher recommended)
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/asipp-neutronics/tricys.git
cd tricys/tricys_visual

# Install dependencies
npm install
```

### Development Server

Start the local development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

### Production Build

Compile and minify for production:

```bash
npm run build
```

## Configuration

Environment variables can be configured via `.env` files (e.g., `.env.local`):

- `VITE_API_URL`: Backend API URL (default: `http://localhost:8000/api/v1`)
- `VITE_GOVIEW_URL`: URL for your GoView visualization instance

## License

This project is licensed under the [APACHE 2.0](LICENSE) License.
