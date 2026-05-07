export const adminRoutes = [
	{
		path: '/admin',
		name: 'admin',
		component: () => import('./views/AdminView.vue')
	}
];