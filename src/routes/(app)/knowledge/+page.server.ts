import { serverDocs, serverSkills, serverFeed } from '$lib/server/api';
import { TrackerError } from '$lib/api/tracker';
import type { DocumentRow } from '$lib/api/documents';
import type { SkillEntry, SkillBinding, FeedItem } from '$lib/api/knowledge';
import type { PageServerLoad } from './$types';

const msg = (e: unknown) => (e instanceof TrackerError ? `${e.status}: ${e.message}` : String(e));

export const load: PageServerLoad = async (event) => {
	const q = (event.url.searchParams.get('q') ?? '').trim();

	const [docs, sk, fd] = await Promise.allSettled([
		q
			? serverDocs(event).search({ query: q, limit: 50 })
			: serverDocs(event)
					.browse({ limit: 50 })
					.then((p) => p.documents),
		serverSkills(event).list(),
		serverFeed(event).page({ limit: 50 })
	]);

	return {
		q,
		results: docs.status === 'fulfilled' ? docs.value : [],
		docError: docs.status === 'rejected' ? msg(docs.reason) : null,
		skills: sk.status === 'fulfilled' ? sk.value.skills : ([] as SkillEntry[]),
		bindings: sk.status === 'fulfilled' ? sk.value.bindings : ([] as SkillBinding[]),
		skillsError: sk.status === 'rejected' ? msg(sk.reason) : null,
		feed: fd.status === 'fulfilled' ? fd.value.items : ([] as FeedItem[]),
		feedError: fd.status === 'rejected' ? msg(fd.reason) : null
	};
};
