export const accountRoutes = [
	{
		path: '',
		name: 'home',
		component: () => import('./views/UserView.vue')
	},
	{
		path: 'user',
		name: 'user',
		component: () => import('./views/UserView.vue')
	}
];