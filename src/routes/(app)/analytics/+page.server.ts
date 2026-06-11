import { analytics } from '$lib/api/analytics';
import { backendFetch } from '$lib/server/backend';
import type { PageServerLoad } from './$types';

/**
 * Analytics dashboard load (hq-1cd840): the (rig, workspace) summary — same
 * scope-key resolution as the Kanban/planning pages. `?days` tunes the chart
 * span, `?risk` the at-risk window.
 */
export const load: PageServerLoad = async (event) => {
	const { activeRig, rigs } = await event.parent();
	const rig = rigs.find((r: { name: string }) => r.name === activeRig)?.prefix ?? 'hq';
	const workspace = 'default';
	const days = Number(event.url.searchParams.get('days') ?? '30') || 30;
	const risk = Number(event.url.searchParams.get('risk') ?? '3') || 3;

	const cookie = event.request.headers.get('cookie') ?? '';
	const summary = await analytics((p, i) => backendFetch(p, cookie, i)).summary({
		rig,
		workspace,
		series_days: days,
		at_risk_days: risk
	});
	return { summary, rig, days, risk };
};
