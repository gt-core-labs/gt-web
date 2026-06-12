import { tracker, type Fetcher, type IssueRow } from '$lib/api/tracker';

/**
 * Resolve the `child_of` epic linkage for a (rig, workspace) tracker set.
 *
 * The gtcore issue_relations refactor (@3d6ea41) moved epic membership out of
 * the free-text `external_ref` column and into a first-class `child_of`
 * relation. The issues list/read endpoints DON'T inline the parent on a row,
 * but the list accepts a `parent_id=<epic>` filter that returns an epic's
 * DIRECT children. We invert those per-epic queries into a `childId → epicId`
 * map so the planning/kanban SSR loads can stitch `parent_id` back onto every
 * row before grouping by module.
 *
 * One request per epic, fired in parallel — epics are few relative to tasks.
 */
export async function resolveParentMap(
	doFetch: Fetcher,
	scope: { rig: string; workspace: string },
	epicIds: string[]
): Promise<Map<string, string>> {
	const t = tracker(doFetch);
	const map = new Map<string, string>();
	await Promise.all(
		epicIds.map(async (epic) => {
			try {
				const page = await t.list({ ...scope, parent_id: epic, limit: 1000 });
				for (const row of page.rows) map.set(row.id, epic);
			} catch {
				/* a single epic's children failing shouldn't blank the whole view */
			}
		})
	);
	return map;
}

/** Stitch resolved `parent_id` onto rows from the `childId → epicId` map. */
export function attachParent<T extends Pick<IssueRow, 'id'> & { parent_id?: string | null }>(
	rows: T[],
	parents: Map<string, string>
): T[] {
	return rows.map((r) => ({ ...r, parent_id: parents.get(r.id) ?? r.parent_id ?? null }));
}
