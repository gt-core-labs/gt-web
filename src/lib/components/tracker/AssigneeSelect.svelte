<script lang="ts">
	/**
	 * Assignee picker (hq-039316): a <select> over the registered user emails
	 * when the session could list them (`users.read`), else a free-text input
	 * (the pre-existing behavior). Emits the new value on change; an empty
	 * string clears the assignee server-side.
	 */
	interface Props {
		value: string;
		users: string[];
		disabled?: boolean;
		class?: string;
		onchange: (value: string) => void;
	}
	let { value, users, disabled = false, class: cls = '', onchange }: Props = $props();

	// Keep a stale assignee (e.g. a deactivated user) selectable so the select
	// does not silently show the wrong value.
	const options = $derived(value && !users.includes(value) ? [value, ...users] : users);
</script>

{#if users.length > 0}
	<select
		class={cls}
		{disabled}
		{value}
		onchange={(e) => onchange((e.currentTarget as HTMLSelectElement).value)}
	>
		<option value="">—</option>
		{#each options as u (u)}
			<option value={u}>{u}</option>
		{/each}
	</select>
{:else}
	<input
		class={cls}
		{value}
		placeholder="—"
		{disabled}
		onchange={(e) => onchange((e.currentTarget as HTMLInputElement).value)}
	/>
{/if}
