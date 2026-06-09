<script lang="ts">
	/**
	 * Notification bell icon with slide-in panel.
	 *
	 * Polls /api/v1/notifications?unread=true every 5 s (and on SSE
	 * notification.created.v1 events) to show an unread badge. Clicking the bell
	 * opens a panel listing all notifications with per-item "mark read" + "create
	 * epic" actions, plus a "mark all read" bulk action.
	 *
	 * "Crear Epic" opens a small modal that pre-fills title + description from the
	 * notification and creates a new tracker issue via POST /api/v1/issues.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { browserNotifications, type Notification } from '$lib/api/notifications';
	import { browserTracker, TrackerError } from '$lib/api/tracker';
	import { Icon } from '$lib/ui';

	const client = browserNotifications();

	// ─── state ──────────────────────────────────────────────────────────────────
	let open = $state(false);
	let items: Notification[] = $state([]);
	let loading = $state(false);
	let unreadCount = $state(0);

	// Epic creation modal state
	let epicNotif: Notification | null = $state(null);
	let epicId = $state('');
	let epicTitle = $state('');
	let epicDesc = $state('');
	let epicSaving = $state(false);
	let epicError = $state('');

	// ─── data fetching ───────────────────────────────────────────────────────────

	async function fetchAll() {
		try {
			items = await client.list(false);
			unreadCount = items.filter((n) => n.read_at === null).length;
		} catch {
			// silently ignore - auth may not be ready
		}
	}

	async function fetchUnreadCount() {
		try {
			const unread = await client.list(true);
			unreadCount = unread.length;
		} catch {
			// silently ignore
		}
	}

	// ─── actions ─────────────────────────────────────────────────────────────────

	async function toggle() {
		open = !open;
		if (open) {
			loading = true;
			await fetchAll();
			loading = false;
		}
	}

	async function markRead(id: string) {
		try {
			await client.markRead(id);
			items = items.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
			unreadCount = items.filter((n) => n.read_at === null).length;
		} catch (e) {
			console.error('markRead failed', e);
		}
	}

	async function markAllRead() {
		try {
			await client.markAllRead();
			const now = new Date().toISOString();
			items = items.map((n) => ({ ...n, read_at: n.read_at ?? now }));
			unreadCount = 0;
		} catch (e) {
			console.error('markAllRead failed', e);
		}
	}

	async function remove(id: string) {
		try {
			await client.remove(id);
			items = items.filter((n) => n.id !== id);
			unreadCount = items.filter((n) => n.read_at === null).length;
		} catch (e) {
			console.error('remove failed', e);
		}
	}

	/** Open the epic creation modal pre-filled with the notification. */
	function openCreateEpic(n: Notification) {
		epicNotif = n;
		epicId = '';
		epicTitle = n.title;
		epicDesc = n.body;
		epicError = '';
		epicSaving = false;
	}

	function closeEpicModal() {
		epicNotif = null;
	}

	async function submitEpic(e: SubmitEvent) {
		e.preventDefault();
		if (!epicNotif) return;
		epicSaving = true;
		epicError = '';
		try {
			await browserTracker().create({
				id: epicId.trim(),
				title: epicTitle.trim(),
				issue_type: 'epic',
				created_by: 'gt-web',
				description: epicDesc.trim() || undefined,
				domain: ['platform.notify'],
				priority: 2
			});
			// Mark the source notification as read
			await client.markRead(epicNotif.id).catch(() => {});
			// Refresh the notification list
			items = items.map((n) =>
				n.id === epicNotif!.id ? { ...n, read_at: new Date().toISOString() } : n
			);
			unreadCount = items.filter((n) => n.read_at === null).length;
			epicNotif = null;
			// If we're on the tracker page, invalidate the list
			if (typeof window !== 'undefined' && window.location.pathname.startsWith('/tracker')) {
				await invalidateAll();
			}
		} catch (err) {
			epicError = err instanceof TrackerError ? err.message : String(err);
		} finally {
			epicSaving = false;
		}
	}

	// ─── time formatting ─────────────────────────────────────────────────────────

	function timeAgo(isoString: string): string {
		const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
		if (diff < 60) return 'ahora';
		if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
		if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
		return `hace ${Math.floor(diff / 86400)}d`;
	}

	function kindClass(kind: string): string {
		switch (kind) {
			case 'alert':
				return 'badge preset-tonal-error';
			case 'info':
				return 'badge preset-tonal-secondary';
			default: // decision
				return 'badge preset-tonal-warning';
		}
	}

	// ─── SSE subscription ────────────────────────────────────────────────────────

	let sse: EventSource | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		// Initial count
		fetchUnreadCount();

		// Poll every 5 s for unread count (cheap endpoint)
		pollTimer = setInterval(fetchUnreadCount, 5000);

		// Subscribe to SSE for instant notification badge updates
		try {
			sse = new EventSource('/stream?channel=notifications', { withCredentials: true });
			sse.addEventListener('notification.created.v1', () => {
				fetchUnreadCount();
				if (open) fetchAll();
			});
		} catch {
			// SSE not available (e.g. no auth) — polling is enough
		}
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
		if (sse) sse.close();
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (epicNotif) {
				closeEpicModal();
			} else {
				open = false;
			}
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="relative">
	<!-- Bell button -->
	<button
		type="button"
		class="btn btn-sm preset-tonal-surface relative"
		aria-label="Notificaciones ({unreadCount} sin leer)"
		onclick={toggle}
	>
		<!-- Bell (lucide vía el primitivo Icon — neutro/currentColor). -->
		<Icon icon="lucide:bell" size={20} />
		{#if unreadCount > 0}
			<span
				class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold text-white"
				aria-label="{unreadCount} sin leer"
			>
				{unreadCount > 99 ? '99+' : unreadCount}
			</span>
		{/if}
	</button>

	<!-- Slide-in panel -->
	{#if open}
		<!-- Backdrop (click outside) -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
		<div
			class="fixed inset-0 z-40"
			role="presentation"
			onclick={() => (open = false)}
		></div>

		<div
			class="absolute right-0 top-full z-50 mt-2 flex w-96 flex-col overflow-hidden
				rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)]
				bg-[var(--gw-color-surface-2)] shadow-[var(--gw-shadow-xl)]"
			role="dialog"
			aria-label="Panel de notificaciones"
		>
			<!-- Header -->
			<header class="flex items-center justify-between border-b border-[var(--gw-color-border-subtle)] px-4 py-3">
				<h3 class="text-base font-semibold text-[var(--gw-color-text)]">Notificaciones</h3>
				{#if unreadCount > 0}
					<button
						type="button"
						class="btn btn-sm preset-tonal-surface text-xs"
						onclick={markAllRead}
					>
						Marcar todas leídas
					</button>
				{/if}
			</header>

			<!-- List -->
			<ul class="max-h-[28rem] divide-y divide-[var(--gw-color-border-subtle)] overflow-y-auto">
				{#if loading}
					<li class="px-4 py-6 text-center text-sm text-[var(--gw-color-text-muted)]">Cargando…</li>
				{:else if items.length === 0}
					<li class="px-4 py-6 text-center text-sm text-[var(--gw-color-text-muted)]">Sin notificaciones</li>
				{:else}
					{#each items as n (n.id)}
						<li
							class="flex flex-col gap-1 px-4 py-3 transition-colors
								{n.read_at === null ? 'bg-[var(--gw-color-surface)]' : ''}"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="flex items-center gap-2">
									<span class={kindClass(n.kind)}>{n.kind}</span>
									<span class="badge preset-tonal-secondary text-xs">{n.from_role}</span>
								</div>
								<span class="shrink-0 text-xs opacity-50">{timeAgo(n.created_at)}</span>
							</div>
							<p class="text-sm font-medium leading-snug">{n.title}</p>
							{#if n.body}
								<p class="line-clamp-2 text-xs opacity-70">{n.body}</p>
							{/if}
							<div class="flex items-center gap-2 pt-1">
								{#if n.read_at === null}
									<button
										type="button"
										class="btn btn-sm preset-tonal-surface text-xs"
										onclick={() => markRead(n.id)}
									>
										Marcar leída
									</button>
								{/if}
								<button
									type="button"
									class="btn btn-sm preset-tonal-primary text-xs"
									onclick={() => openCreateEpic(n)}
								>
									Crear Epic
								</button>
								<button
									type="button"
									class="btn btn-sm preset-tonal-error ml-auto text-xs"
									aria-label="Eliminar notificación"
									onclick={() => remove(n.id)}
								>
									×
								</button>
							</div>
						</li>
					{/each}
				{/if}
			</ul>
		</div>
	{/if}
</div>

<!-- Epic creation modal (shown above the panel) -->
{#if epicNotif}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
		role="presentation"
		onclick={closeEpicModal}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
		<div
			class="card preset-filled-surface-100-900 w-full max-w-lg p-5"
			role="dialog"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 class="mb-3 text-lg font-semibold">Crear Epic desde notificación</h2>
			<form class="space-y-3" onsubmit={submitEpic}>
				<label class="label">
					<span class="label-text">id del bead</span>
					<input
						class="input"
						bind:value={epicId}
						placeholder="hq-epic.1"
						required
					/>
				</label>
				<label class="label">
					<span class="label-text">título</span>
					<input class="input" bind:value={epicTitle} required />
				</label>
				<label class="label">
					<span class="label-text">descripción</span>
					<textarea class="textarea" rows="4" bind:value={epicDesc}></textarea>
				</label>

				{#if epicError}
					<p class="text-sm text-error-500">{epicError}</p>
				{/if}

				<div class="flex justify-end gap-2">
					<button type="button" class="btn btn-sm preset-tonal-surface" onclick={closeEpicModal}>
						Cancelar
					</button>
					<button type="submit" class="btn btn-sm preset-tonal-primary" disabled={epicSaving}>
						{epicSaving ? 'Creando…' : 'Crear Epic'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
