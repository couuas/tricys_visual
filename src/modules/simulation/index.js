export const simulationRoutes = [
	{
		path: 'config',
		name: 'config',
		component: () => import('./views/ConfigView.vue'),
		props: { mode: 'normal' }
	},
	{
		path: 'demo',
		name: 'demo',
		component: () => import('./views/ConfigView.vue'),
		props: { mode: 'demo' }
	},
	{
		path: 'component/:id',
		name: 'component-detail',
		component: () => import('./views/ComponentDetailView.vue'),
		props: true,
		meta: { requiresAuth: true }
	}
];