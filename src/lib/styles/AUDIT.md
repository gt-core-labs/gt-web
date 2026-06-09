# UI Audit — gt-web

Conducted as part of `gw-ui-redesign.1`.

---

## Views (routes)

| Route | File | Description |
|-------|------|-------------|
| `/` | `routes/(app)/+page.svelte` | Home — session card, user scopes list |
| `/tracker` | `routes/(app)/tracker/+page.svelte` | Kanban board with drag-and-drop columns (open / working / closed) |
| `/tracker/[id]` | `routes/(app)/tracker/[id]/+page.svelte` | Bead detail — status transitions, close with commit SHA, deps/surfaces/domains |
| `/orchestration` | `routes/(app)/orchestration/+page.svelte` | Agent sessions + tabbed sub-views: merge queue, convoy, quota accounts |
| `/terminal` | `routes/(app)/terminal/+page.svelte` | PTY terminal sessions via xterm.js |
| `/knowledge` | `routes/(app)/knowledge/+page.svelte` | Document list with search |
| `/knowledge/[id]` | `routes/(app)/knowledge/[id]/+page.svelte` | Document viewer / editor |
| `/hooks` | `routes/(app)/hooks/+page.svelte` | Webhook event log + filter |
| `/stats` | `routes/(app)/stats/+page.svelte` | Workspace progress metrics by domain/phase |
| `/security` | `routes/(app)/security/+page.svelte` | API token management |
| `/admin/users` | `routes/(app)/admin/users/+page.svelte` | User list + role assignment |
| `/admin/workspaces` | `routes/(app)/admin/workspaces/+page.svelte` | Workspace catalog |
| `/admin/rigs` | `routes/(app)/admin/rigs/+page.svelte` | Rig catalog (name / prefix / git URL) |
| `/admin/quota` | `routes/(app)/admin/quota/+page.svelte` | Claude account quota assignment |
| `/admin/providers` | `routes/(app)/admin/providers/+page.svelte` | OAuth provider config |
| `/system` | `routes/(app)/system/+page.svelte` | System info / version |
| `/help` | `routes/(app)/help/+page.svelte` | Meta docs rendered from backend |
| `/login` | `routes/(auth)/login/+page.svelte` | Email + OAuth login |
| _(layout)_ | `routes/(app)/+layout.svelte` | Sidebar nav + workspace/rig selectors + terminal dock |

---

## Components

### Primitive UI (`src/lib/ui/`)

| Component | Props | Notes |
|-----------|-------|-------|
| `Button.svelte` | `variant` (filled/tonal/outlined), `class`, `...HTMLButtonAttributes` | Wraps Skeleton `btn` + `preset-*` |
| `Card.svelte` | `class`, `interactive`, `disabled`, `children` | Container; `interactive` adds hover/focus states |
| `Badge.svelte` | `variant` (primary/success/warning/error/surface), `class`, `interactive`, `disabled`, `children` | Status label; `interactive` adds hover/focus states |
| `Input.svelte` | `class`, `error`, `...HTMLInputAttributes` | Text input with token-driven states |
| `ScopeGate.svelte` | `scope`, `children`, `fallback` | Renders children only when user holds the required scope |

### Feature components (`src/lib/components/`)

| Component | Consumes | Notes |
|-----------|----------|-------|
| `NotificationBell.svelte` | SSE `/stream?channel=notify` | Unread count badge + dropdown |
| `orchestration/LiveFeed.svelte` | SSE event stream | Real-time event log with kind filter |
| `terminal/Terminal.svelte` | xterm.js + `@xterm/addon-fit` | PTY terminal wrapper |
| `terminal/TerminalDock.svelte` | `Terminal`, `terminals` store | Floating overlay; mounts in app layout |
| `tracker/IssueCard.svelte` | `Badge` | Drag-and-drop kanban card |
| `tracker/CreateIssueModal.svelte` | `Button` | Modal form for new beads |
| `tracker/OperatorBadge.svelte` | — | Links operator session to terminal |
| `knowledge/CreateDocModal.svelte` | `Button` | Modal form for new documents |

---

## Generic patterns detected

### 1. Page header
```svelte
<header class="flex items-center justify-between">
  <h1 class="h2">Title</h1>
  <Button>Action</Button>
</header>
```
Found in: Tracker, Orchestration, Knowledge, Stats, Security, Admin pages.

### 2. Form field
```svelte
<label class="label">
  <span class="label-text">Field name</span>
  <input class="input" bind:value={x} />
</label>
```
Found in: CreateIssueModal, CreateDocModal, Login, Hooks, Admin pages.
→ **Candidate for `Input` primitive** (now added).

### 3. Modal overlay
```svelte
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
  <div class="card preset-filled-surface-100-900 w-full max-w-lg p-5" role="dialog">
    ...
  </div>
</div>
```
Found in: CreateIssueModal, CreateDocModal.
→ **Candidate for `Modal` primitive** (future bead).

### 4. SSE-connected view
```ts
$effect(() => {
  const es = new EventSource(url, { withCredentials: true });
  // collapse events → invalidateAll
  return () => es.close();
});
```
Found in: Tracker, Orchestration, NotificationBell, LiveFeed.
→ **Candidate for `useLiveFeed` rune/helper** (future bead).

### 5. Status badge mapping
```ts
const STATUS_VARIANT = {
  closed: 'success',
  working: 'warning',
  open: 'surface',
};
```
Found in: Tracker, TrackerDetail, IssueCard.
→ Consolidate into a shared `issueStatusVariant` util (future bead).

### 6. Scope-guarded action
```svelte
{#if canWrite}
  <Button onclick={doSomething}>Action</Button>
{/if}
```
Found everywhere. Already abstracted via `ScopeGate` and `hasScope()`.

### 7. Error paragraph
```svelte
{#if error}<p class="text-sm text-error-500">{error}</p>{/if}
```
Found in every form / mutation view.
→ **Candidate for `ErrorText` or `Alert` primitive** (future bead).

### 8. Metadata key-value grid
```svelte
<dl class="grid grid-cols-[8rem_1fr] gap-1 text-sm">
  <dt class="opacity-70">Label</dt>
  <dd>Value</dd>
</dl>
```
Found in: Home, TrackerDetail, Admin pages.
→ **Candidate for `DescriptionList` primitive** (future bead).

### 9. Tabbed sub-view
```svelte
<div class="flex gap-2">
  {#each TABS as t}<button class:active={tab === t.id} ...>{t.label}</button>{/each}
</div>
{#if tab === 'foo'}...{/if}
```
Found in: Orchestration.
→ **Candidate for `Tabs` primitive** (future bead).

### 10. Optimistic state update
```ts
item.status = target; // optimistic
try {
  await api.transition(id, target);
  await invalidateAll();
} catch {
  item.status = prev; // revert
}
```
Found in: Tracker board drag-and-drop.

---

## Notes for .2 / .3 / .4

- The `Card` and `Badge` components do not yet carry any persistent dark-mode
  override; Skeleton's cerberus theme handles that automatically via `prefers-color-scheme`.
- The `Input` primitive was added in this bead; existing form fields still use the
  raw `<input class="input" ...>` pattern — migration to the primitive is in scope
  for a follow-on bead.
- The `src/lib/components/ui/` directory is scaffolded here for future compound/
  composite components that sit above the primitives in `src/lib/ui/`.
