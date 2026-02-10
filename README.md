# Tricys Visual

**Tritium Integrated Cycle Simulation (TRICYS) - Visualization Frontend**

`tricys_visual` is the Vue 3-based frontend for the TRICYS platform, providing real-time simulation monitoring, 3D visualization, and result analysis.

## Features

- **3D Visualization**: Interactive digital twin visualization using Three.js.
- **Real-time Monitoring**: Live tracking of simulation KPIs and process status.
- **Component Editor**: Visual editor for Modelica component parameters and connections.
- **Result Analysis**: Integrated file browser and visualizers for HDF5, Markdown, and other result formats.
- **GoView Integration**: Seamless embedding with the GoView low-code visualization platform.

## Project Architecture

The project follows a feature-based architecture:

```
src/
├── api/            # API client and service modules
├── components/     # Vue components
│   ├── common/     # Shared UI components (Buttons, Modals)
│   ├── layout/     # Structural components (Header, Sidebar)
│   └── features/   # Feature-specific components (Simulation, Monitor, Result)
├── composables/    # Vue Composition API hooks
├── layouts/        # Page layouts
├── router/         # Vue Router configuration
├── styles/         # Global styles and themes
├── utils/          # Helper functions
└── views/          # Top-level page views
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Configuration

Environment variables can be set in `.env` files:

- `VITE_API_URL`: Backend API URL (default: `http://localhost:8000/api/v1`)
- `VITE_GOVIEW_URL`: URL for the GoView instance

## License

[APACHE 2.0](LICENSE)
