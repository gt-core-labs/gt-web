<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { hasScope } from '$lib/api/auth';
	import { browserSystem } from '$lib/api/system';
	import { TrackerError } from '$lib/api/tracker';
	import { Button, Badge } from '$lib/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const canWrite = $derived(hasScope(data.user?.scopes, 'system.write'));

	// Local editable copy of the config
	let enabled = $state(data.config?.enabled ?? true);
	let archiveAfterDays = $state(data.config?.archive_after_days ?? 30);
	let intervalMinutes = $state(data.config?.interval_minutes ?? 60);

	let busy = $state(false);
	let message = $state('');
	let isError = $state(false);

	async function run(fn: () => Promise<unknown>, success: string) {
		busy = true;
		message = '';
		isError = false;
		try {
			await fn();
			message = success;
			await invalidateAll();
		} catch (err) {
			isError = true;
			message = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			busy = false;
		}
	}

	function saveConfig() {
		run(
			() =>
				browserSystem().updateConfig({
					enabled,
					archive_after_days: archiveAfterDays,
					interval_minutes: intervalMinutes
				}),
			'Configuration saved.'
		);
	}

	function runNow() {
		run(async () => {
			const result = await browserSystem().runArchiveNow();
			message = `Archived ${result.archived} issue(s).`;
		}, '');
	}

	// Section tabs
	type Section = 'archive';
	let section = $state<Section>('archive');
</script>

<div class="space-y-6">
	<header class="flex items-center justify-between">
		<h1 class="h2">System</h1>
	</header>

	<p class="text-sm opacity-60">
		Platform-level configuration. Changes take effect on the next daemon tick.
	</p>

	<!-- Section tabs -->
	<nav class="flex gap-1 border-b border-surface-500/20">
		<button
			class="px-3 py-2 text-sm"
			class:border-b-2={section === 'archive'}
			class:border-primary-500={section === 'archive'}
			class:opacity-60={section !== 'archive'}
			onclick={() => (section = 'archive')}
		>
			Tracker Archive
		</button>
	</nav>

	{#if section === 'archive'}
		<div class="max-w-lg space-y-4">
			<div class="card preset-filled-surface-100-900 space-y-4 p-4">
				<div class="flex items-center justify-between">
					<h2 class="font-semibold">Archive Daemon</h2>
					<Badge variant={enabled ? 'success' : 'surface'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
				</div>
				<p class="text-sm opacity-60">
					Closed issues older than the threshold are automatically archived (hidden from the default
					tracker view). The daemon runs on the configured interval.
				</p>

				{#if data.configError}
					<p class="rounded bg-warning-500/10 px-3 py-2 text-sm text-warning-600 dark:text-warning-400">
						{data.configError}
					</p>
				{/if}

				<form class="space-y-3" onsubmit={(e) => { e.preventDefault(); saveConfig(); }}>
					<label class="flex items-center gap-3 text-sm">
						<input
							type="checkbox"
							class="checkbox"
							bind:checked={enabled}
							disabled={!canWrite || busy}
						/>
						<span>Enable automatic archival</span>
					</label>

					<label class="flex flex-col gap-1 text-sm">
						<span class="opacity-60">Archive closed issues older than (days)</span>
						<input
							type="number"
							class="input w-32"
							min="1"
							max="3650"
							bind:value={archiveAfterDays}
							disabled={!canWrite || busy}
						/>
					</label>

					<label class="flex flex-col gap-1 text-sm">
						<span class="opacity-60">Sweep interval (minutes)</span>
						<input
							type="number"
							class="input w-32"
							min="1"
							max="10080"
							bind:value={intervalMinutes}
							disabled={!canWrite || busy}
						/>
					</label>

					{#if canWrite}
						<div class="flex gap-2">
							<Button type="submit" disabled={busy}>Save</Button>
							<Button
								variant="tonal"
								type="button"
								disabled={busy}
								onclick={runNow}
							>Run Now</Button>
						</div>
					{/if}
				</form>

				{#if message}
					<p class="text-sm" class:text-error-500={isError} class:text-success-500={!isError}>
						{message}
					</p>
				{/if}
			</div>

			<!-- Current config summary (from SSR) -->
			{#if data.config}
				<div class="card preset-tonal-surface space-y-1 p-3 text-xs opacity-70">
					<p><span class="font-mono">enabled</span>: {data.config.enabled}</p>
					<p><span class="font-mono">archive_after_days</span>: {data.config.archive_after_days}</p>
					<p><span class="font-mono">interval_minutes</span>: {data.config.interval_minutes}</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
