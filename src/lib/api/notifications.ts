/**
 * Notifications client for `/api/v1/notifications`.
 *
 * Agents (e.g. `mayor`) POST here to send a notification to the human operator;
 * the web UI polls or subscribes via SSE (`?channel=notifications` on `/stream`)
 * and renders them in a bell-icon panel.
 *
 * Routes (no trailing slash):
 *   GET  /api/v1/notifications[?unread=true]  — list (notifications.read)
 *   POST /api/v1/notifications                — create (notifications.write)
 *   POST /api/v1/notifications/:id/read       — mark one read (notifications.write)
 *   POST /api/v1/notifications/read-all       — mark all read (notifications.write)
 *   DELETE /api/v1/notifications/:id          — delete (notifications.write)
 */
import { TrackerError, type Fetcher } from './tracker';

export type NotificationKind = 'decision' | 'info' | 'alert';

export interface Notification {
	id: string;
	workspace: string;
	from_role: string;
	title: string;
	body: string;
	kind: NotificationKind;
	created_at: string;
	read_at: string | null;
}

export interface CreateNotificationBody {
	title: string;
	body?: string;
	kind?: NotificationKind;
	from_role?: string;
}

const JSON_POST = { method: 'POST', headers: { 'content-type': 'application/json' } } as const;

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

export function notifications(doFetch: Fetcher) {
	return {
		async list(unreadOnly = false): Promise<Notification[]> {
			const qs = unreadOnly ? '?unread=true' : '';
			const j = await unwrap<{ notifications: Notification[] }>(
				await doFetch(`/api/v1/notifications${qs}`)
			);
			return j.notifications ?? [];
		},

		async create(body: CreateNotificationBody): Promise<string> {
			const j = await unwrap<{ id: string }>(
				await doFetch('/api/v1/notifications', {
					...JSON_POST,
					body: JSON.stringify(body)
				})
			);
			return j.id;
		},

		async markRead(id: string): Promise<void> {
			await unwrap(
				await doFetch(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
					method: 'POST'
				})
			);
		},

		async markAllRead(): Promise<void> {
			await unwrap(
				await doFetch('/api/v1/notifications/read-all', { method: 'POST' })
			);
		},

		async remove(id: string): Promise<void> {
			const res = await doFetch(`/api/v1/notifications/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new TrackerError(res.status, text || res.statusText);
			}
		}
	};
}

/** Browser client — same-origin cookies, no explicit auth header needed. */
export function browserNotifications() {
	return notifications((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}
