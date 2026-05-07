export const studioRoutes = [
	{
		path: 'model-editor',
		name: 'model-editor',
		component: () => import('./views/ModelEditorView.vue'),
		meta: { requiresAuth: true }
	}
];