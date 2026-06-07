// Open-terminal-tabs store (hq-term-dock.2, ported from gastown's dock).
//
// Holds the session IDs the floating terminal dock has open tabs for plus the active tab.
// Lives outside the dock component so any view (the Orchestration session row) can push a
// session in without a prop-drill — it just calls `terminals.open(id)`.

class Terminals {
	// Session IDs with an open terminal tab, in the order the user opened them.
	ids = $state<string[]>([]);
	// Currently focused tab. `null` when `ids` is empty.
	active = $state<string | null>(null);

	open(id: string): void {
		if (!this.ids.includes(id)) {
			this.ids = [...this.ids, id];
		}
		this.active = id;
	}

	close(id: string): void {
		const next = this.ids.filter((x) => x !== id);
		this.ids = next;
		if (this.active === id) {
			this.active = next[next.length - 1] ?? null;
		}
	}

	focus(id: string): void {
		if (this.ids.includes(id)) this.active = id;
	}

	reset(): void {
		this.ids = [];
		this.active = null;
	}
}

export const terminals = new Terminals();
