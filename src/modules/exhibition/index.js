export const exhibitionRoutes = [
	{
		path: 'pages',
		name: 'pages',
		component: () => import('./views/ProjectPagesView.vue'),
		meta: { requiresAuth: true }
	},
	{
		path: 'goview',
		name: 'goview',
		component: () => import('./views/GoviewView.vue'),
		meta: { requiresAuth: true }
	},
	{
		path: 'visualizer',
		name: 'visualizer',
		component: () => import('./views/Hdf5VisualizerView.vue'),
		meta: { requiresAuth: true }
	}
];