import { createRouter, createWebHistory } from 'vue-router';
import { registerAuthExpiredHandler, registerRouterGuards } from './guards';
import { accountRoutes } from '../../modules/account';
import { adminRoutes } from '../../modules/admin';
import { analysisRoutes } from '../../modules/analysis';
import { exhibitionRoutes } from '../../modules/exhibition';
import { helpRoutes } from '../../modules/help';
import { monitorRoutes } from '../../modules/monitor';
import { projectRoutes } from '../../modules/projects';
import { simulationRoutes } from '../../modules/simulation';
import { studioRoutes } from '../../modules/studio';

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: '/',
			component: () => import('../layout/WorkbenchLayout.vue'),
			children: [
				...accountRoutes,
				...simulationRoutes,
				...monitorRoutes,
				...analysisRoutes,
				...projectRoutes,
				...helpRoutes,
				...exhibitionRoutes,
				...studioRoutes
			]
		},
		...adminRoutes,
		{ path: '/vis', redirect: '/monitor' }
	]
});

registerAuthExpiredHandler(router);
registerRouterGuards(router);

export default router;
