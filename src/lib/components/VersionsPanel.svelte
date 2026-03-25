<script lang="ts">
import {
	BookMarked,
	Check,
	ChevronLeft,
	Clock,
	Hash,
	History,
	RotateCcw,
	Tag,
	Trash2,
	Type,
	X,
} from 'lucide-svelte';
import { slide } from 'svelte/transition';
import { docStore } from '$lib/doc-store.svelte';
import type { DocumentMetadata } from '$lib/types';
import { uiState } from '$lib/ui-state.svelte';
import { versionStore } from '$lib/version-store.svelte';
import type { DocumentVersion } from '$lib/versions-db';

// ─── Local state ──────────────────────────────────────────────────────────────

let checkpointLabel = $state('');
let isSavingCheckpoint = $state(false);
let checkpointDone = $state(false);
let deletingId: string | null = $state(null);
let restoring = $state(false);
let mobileView: 'list' | 'detail' = $state('list');

// ─── Load versions when panel opens ──────────────────────────────────────────

$effect(() => {
	if (uiState.versionsOpen && docStore.currentDocId) {
		versionStore.selectedId = null;
		versionStore.loadVersions(docStore.currentDocId);
		mobileView = 'list';
	}
});

// When doc changes while panel is open, reload
$effect(() => {
	const id = docStore.currentDocId;
	if (uiState.versionsOpen && id) {
		versionStore.selectedId = null;
		versionStore.loadVersions(id);
		mobileView = 'list';
	}
});

// ─── Actions ──────────────────────────────────────────────────────────────────

async function saveCheckpoint() {
	if (isSavingCheckpoint || !docStore.currentDocument) return;
	isSavingCheckpoint = true;
	try {
		await versionStore.createCheckpoint(
			docStore.currentDocument,
			checkpointLabel,
		);
		checkpointLabel = '';
		checkpointDone = true;
		setTimeout(() => {
			checkpointDone = false;
		}, 2500);
	} finally {
		isSavingCheckpoint = false;
	}
}

async function handleDelete(v: DocumentVersion, e: MouseEvent) {
	e.stopPropagation();
	deletingId = v.id;
	try {
		await versionStore.deleteVersion(v.id);
		if (versionStore.selectedId === v.id) {
			mobileView = 'list';
		}
	} finally {
		deletingId = null;
	}
}

async function handleRestore(v: DocumentVersion) {
	if (!docStore.currentDocument || restoring) return;
	restoring = true;
	const restoredMetadata = structuredClone(v.metadata) as DocumentMetadata;
	try {
		// Safety: checkpoint the current state first
		await versionStore.createCheckpoint(
			docStore.currentDocument,
			`Before restore to ${formatTime(v.createdAt)}`,
		);
		// Restore — merge v.title back into metadata
		await docStore.updateCurrent({
			content: v.content,
			metadata: {
				...restoredMetadata,
				title: v.title,
			},
		});
		close();
	} finally {
		restoring = false;
	}
}

function selectVersion(v: DocumentVersion) {
	versionStore.selectedId = v.id;
	mobileView = 'detail';
}

function close() {
	uiState.versionsOpen = false;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatTime(ts: number): string {
	const diff = Date.now() - ts;
	if (diff < 60_000) return 'just now';
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(new Date(ts));
}

function formatFullTime(ts: number): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(ts));
}

function contentPreview(content: string, maxLen = 160): string {
	const stripped = content
		.replace(/^#{1,6}\s+/gm, '') // strip heading markers
		.replace(/[*_`~]+/g, '') // strip inline markers
		.replace(/\n+/g, ' ') // collapse newlines
		.trim();
	if (stripped.length <= maxLen) return stripped;
	return stripped.slice(0, maxLen).replace(/\s\w+$/, '') + '…';
}

// Prevent scroll bleed
$effect(() => {
	if (uiState.versionsOpen) {
		document.body.style.overflow = 'hidden';
	} else {
		document.body.style.overflow = '';
		checkpointLabel = '';
		checkpointDone = false;
		restoring = false;
	}
});
</script>

{#if uiState.versionsOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="backdrop"
		onclick={close}
		transition:slide={{ duration: 200, axis: 'y' }}
	></div>

	<!-- Panel -->
	<div
		class="panel frosted-glass"
		role="dialog"
		aria-modal="true"
		aria-label="Version History"
		transition:slide={{ duration: 260, axis: 'y' }}
	>
		<!-- ── Header ────────────────────────────────────────────────── -->
		<div class="panel-header">
			<div class="panel-title">
				<History size={18} />
				<h2>Version History</h2>
				{#if !versionStore.isLoading}
					<span class="version-count">{versionStore.versions.length}</span>
				{/if}
			</div>
			<button class="icon-btn" onclick={close} aria-label="Close">
				<X size={18} />
			</button>
		</div>

		<!-- ── Body: two columns ─────────────────────────────────────── -->
		<div class="panel-body">

			<!-- ─── Left: list + checkpoint ─────────────────────────── -->
			<div class="col-list" class:mobile-hidden={mobileView === 'detail'}>

				<!-- Checkpoint creator -->
				<div class="checkpoint-bar">
					<div class="checkpoint-input-wrap">
						<BookMarked size={13} class="checkpoint-icon" />
						<input
							class="checkpoint-input"
							type="text"
							placeholder="Label (optional)"
							bind:value={checkpointLabel}
							onkeydown={(e) => e.key === 'Enter' && saveCheckpoint()}
							maxlength={60}
						/>
					</div>
					<button
						class="checkpoint-btn"
						class:done={checkpointDone}
						onclick={saveCheckpoint}
						disabled={isSavingCheckpoint || !docStore.currentDocument}
					>
						{#if checkpointDone}
							<Check size={13} /> Saved
						{:else if isSavingCheckpoint}
							<span class="mini-spinner"></span>
						{:else}
							Save Checkpoint
						{/if}
					</button>
				</div>

				<!-- Stats row -->
				{#if versionStore.versions.length > 0}
					<div class="stats-row">
						<span class="stat-chip auto">
							<Clock size={10} /> {versionStore.autoCount} auto
						</span>
						<span class="stat-chip manual">
							<BookMarked size={10} /> {versionStore.manualCount} pinned
						</span>
						<span class="stat-chip limit">
							max {versionStore.maxAutoVersions} auto
						</span>
					</div>
				{/if}

				<!-- Version list -->
				<div class="version-list" role="list">
					{#if versionStore.isLoading}
						<div class="empty-message">
							<span class="mini-spinner accent"></span>
							<span>Loading…</span>
						</div>
					{:else if versionStore.versions.length === 0}
						<div class="empty-message">
							<History size={28} class="empty-icon" />
							<p>No versions yet.</p>
							<p class="empty-sub">
								Versions are saved automatically every 5 minutes when you write,
								or you can save a checkpoint manually above.
							</p>
						</div>
					{:else}
						{#each versionStore.versions as v (v.id)}
							<div
								class="version-item"
								class:selected={versionStore.selectedId === v.id}
								class:manual={v.label !== null}
								onclick={() => selectVersion(v)}
								onkeydown={(e) => e.key === 'Enter' && selectVersion(v)}
								role="button"
								tabindex="0"
								aria-label="Version from {formatFullTime(v.createdAt)}"
							>
								<div class="version-left">
									<div class="version-top-row">
										{#if v.label !== null}
											<span class="badge manual-badge">
												<BookMarked size={9} /> pinned
											</span>
										{:else}
											<span class="badge auto-badge">
												<Clock size={9} /> auto
											</span>
										{/if}
										<span class="version-time">{formatTime(v.createdAt)}</span>
									</div>
									{#if v.label}
										<span class="version-label">{v.label}</span>
									{/if}
									<p class="version-preview">{contentPreview(v.content || v.title, 90)}</p>
									<div class="version-meta-row">
										<span class="meta-chip">
											<Type size={9} /> {v.wordCount.toLocaleString()}w
										</span>
										<span class="meta-chip">
											<Hash size={9} /> {v.charCount.toLocaleString()}
										</span>
									</div>
								</div>

								<button
									class="delete-btn"
									class:deleting={deletingId === v.id}
									onclick={(e) => handleDelete(v, e)}
									aria-label="Delete this version"
									title="Delete"
								>
									{#if deletingId === v.id}
										<span class="mini-spinner"></span>
									{:else}
										<Trash2 size={12} />
									{/if}
								</button>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<!-- ─── Right: preview / detail ─────────────────────────── -->
			<div class="col-detail" class:mobile-hidden={mobileView === 'list'}>
				{#if versionStore.selectedVersion}
					{@const v = versionStore.selectedVersion}
					<div class="detail-pane">
						<!-- Back button (mobile) -->
						<button class="back-btn" onclick={() => { mobileView = 'list'; versionStore.selectedId = null; }}>
							<ChevronLeft size={14} /> Back to list
						</button>

						<div class="detail-header">
							<div class="detail-meta">
								{#if v.label}
									<span class="detail-badge manual-badge">
										<BookMarked size={11} /> {v.label}
									</span>
								{:else}
									<span class="detail-badge auto-badge">
										<Clock size={11} /> Auto-save
									</span>
								{/if}
								<span class="detail-time">{formatFullTime(v.createdAt)}</span>
							</div>
							<div class="detail-stats">
								<span><Type size={11} /> {v.wordCount.toLocaleString()} words</span>
								<span><Hash size={11} /> {v.charCount.toLocaleString()} chars</span>
							</div>
						</div>

						{#if v.metadata.tags && v.metadata.tags.length > 0}
							<div class="detail-tags">
								<Tag size={11} />
								{#each v.metadata.tags as tag}
									<span class="detail-tag">{tag}</span>
								{/each}
							</div>
						{/if}

						<div class="detail-title">{v.title || 'Untitled'}</div>

						<div class="detail-content">{v.content || '(empty)'}</div>

						<button
							class="restore-btn"
							class:loading={restoring}
							onclick={() => handleRestore(v)}
							disabled={restoring}
						>
							{#if restoring}
								<span class="mini-spinner"></span> Restoring…
							{:else}
								<RotateCcw size={14} /> Restore This Version
							{/if}
						</button>
						<p class="restore-note">
							Your current content will be saved as a checkpoint before restoring.
						</p>
					</div>
				{:else}
					<div class="detail-empty">
						<History size={32} class="detail-empty-icon" />
						<p>Select a version to preview</p>
					</div>
				{/if}
			</div>

		</div>
	</div>
{/if}

<style>
	/* ── Backdrop ──────────────────────────────────────────────────────── */
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		z-index: 90;
	}

	/* ── Panel shell ───────────────────────────────────────────────────── */
	.panel {
		position: fixed;
		bottom: 0;
		left: 50%;
		translate: -50% 0;
		width: min(760px, 100vw);
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		z-index: 100;
		border-radius: 20px 20px 0 0;
		border-bottom: none;
		box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.12), 0 -2px 8px rgba(0, 0, 0, 0.06);
		overflow: hidden;
	}

	/* ── Header ────────────────────────────────────────────────────────── */
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 24px 14px;
		border-bottom: 1px solid var(--border);
		background: var(--overlay);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: 20px 20px 0 0;
		flex-shrink: 0;
	}

	.panel-title {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text);
	}

	.panel-title h2 {
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.version-count {
		font-size: 0.72rem;
		font-weight: 600;
		padding: 2px 7px;
		background: var(--border);
		border-radius: 99px;
		color: var(--text-muted);
	}

	/* ── Body: two-column grid ─────────────────────────────────────────── */
	.panel-body {
		display: grid;
		grid-template-columns: 1fr 1fr;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.col-list {
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		min-height: 0;
		overflow: hidden;
	}

	.col-detail {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Checkpoint bar ────────────────────────────────────────────────── */
	.checkpoint-bar {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.checkpoint-input-wrap {
		display: flex;
		align-items: center;
		gap: 7px;
		flex: 1;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 6px 10px;
		transition: border-color 0.2s;
	}

	.checkpoint-input-wrap:focus-within {
		border-color: var(--accent);
	}

	.checkpoint-input-wrap :global(.checkpoint-icon) {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.checkpoint-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		font-size: 0.82rem;
		color: var(--text);
		font-family: inherit;
	}

	.checkpoint-input::placeholder {
		color: var(--text-muted);
		opacity: 0.6;
	}

	.checkpoint-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		font-family: inherit;
		padding: 7px 12px;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.checkpoint-btn:hover:not(:disabled) {
		filter: brightness(1.12);
	}

	.checkpoint-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.checkpoint-btn.done {
		background: #22c55e;
	}

	/* ── Stats row ─────────────────────────────────────────────────────── */
	.stats-row {
		display: flex;
		gap: 6px;
		align-items: center;
		padding: 7px 14px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.stat-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.7rem;
		font-weight: 500;
		padding: 2px 7px;
		border-radius: 99px;
	}

	.stat-chip.auto {
		background: rgba(96, 165, 250, 0.1);
		color: var(--accent);
	}

	.stat-chip.manual {
		background: rgba(99, 102, 241, 0.1);
		color: #818cf8;
	}

	.stat-chip.limit {
		background: var(--border);
		color: var(--text-muted);
		margin-left: auto;
	}

	/* ── Version list ──────────────────────────────────────────────────── */
	.version-list {
		flex: 1;
		overflow-y: auto;
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.empty-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 40px 20px;
		text-align: center;
		color: var(--text-muted);
	}

	.empty-message :global(.empty-icon) {
		opacity: 0.3;
	}

	.empty-message p {
		font-size: 0.85rem;
	}

	.empty-sub {
		font-size: 0.78rem !important;
		opacity: 0.7;
		line-height: 1.5;
		max-width: 220px;
	}

	/* ── Version item ──────────────────────────────────────────────────── */
	.version-item {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 10px 10px;
		border-radius: 10px;
		cursor: pointer;
		transition: background 0.15s;
		border: 1px solid transparent;
		position: relative;
	}

	.version-item:hover {
		background: var(--surface);
	}

	.version-item.selected {
		background: var(--accent-glow);
		border-color: rgba(59, 130, 246, 0.25);
	}

	.version-item.manual {
		border-left: 2px solid #818cf8;
		padding-left: 9px;
	}

	.version-item.manual.selected {
		border-color: rgba(129, 140, 248, 0.4);
	}

	.version-left {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.version-top-row {
		display: flex;
		align-items: center;
		gap: 7px;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 1px 6px;
		border-radius: 99px;
	}

	.auto-badge {
		background: rgba(96, 165, 250, 0.1);
		color: var(--accent);
	}

	.manual-badge {
		background: rgba(99, 102, 241, 0.1);
		color: #818cf8;
	}

	.version-time {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.version-label {
		font-size: 0.82rem;
		font-weight: 600;
		color: #818cf8;
	}

	.version-preview {
		font-size: 0.78rem;
		color: var(--text-muted);
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.version-meta-row {
		display: flex;
		gap: 8px;
	}

	.meta-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 0.68rem;
		color: var(--text-muted);
		opacity: 0.6;
	}

	/* ── Delete button ─────────────────────────────────────────────────── */
	.delete-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s, background 0.15s, color 0.15s;
		flex-shrink: 0;
	}

	.version-item:hover .delete-btn {
		opacity: 1;
	}

	.version-item.selected .delete-btn {
		opacity: 0.6;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		opacity: 1 !important;
	}

	.delete-btn.deleting {
		opacity: 1;
		pointer-events: none;
	}

	/* ── Detail pane ───────────────────────────────────────────────────── */
	.detail-pane {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		overflow-y: auto;
		flex: 1;
	}

	.back-btn {
		display: none;
		align-items: center;
		gap: 4px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-muted);
		background: transparent;
		border: none;
		cursor: pointer;
		font-family: inherit;
		padding: 0;
		margin-bottom: 4px;
	}

	.back-btn:hover {
		color: var(--accent);
	}

	.detail-header {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.detail-meta {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.detail-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 8px;
		border-radius: 99px;
	}

	.detail-time {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.detail-stats {
		display: flex;
		gap: 12px;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.detail-stats span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.detail-tags {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		color: var(--text-muted);
	}

	.detail-tags :global(svg) {
		flex-shrink: 0;
	}

	.detail-tag {
		font-size: 0.72rem;
		padding: 2px 7px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 99px;
		color: var(--text-muted);
	}

	.detail-title {
		font-family: var(--font-editor);
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.02em;
		line-height: 1.3;
		padding-bottom: 8px;
		border-bottom: 1px dashed var(--border);
	}

	.detail-content {
		flex: 1;
		font-family: var(--font-editor);
		font-size: 0.88rem;
		line-height: 1.7;
		color: var(--text-muted);
		white-space: pre-wrap;
		word-break: break-word;
		overflow-y: auto;
		max-height: 200px;
		padding: 10px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	/* ── Restore button ────────────────────────────────────────────────── */
	.restore-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		font-size: 0.88rem;
		font-weight: 600;
		font-family: inherit;
		padding: 10px 16px;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.restore-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.restore-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.restore-note {
		font-size: 0.73rem;
		color: var(--text-muted);
		text-align: center;
		opacity: 0.7;
		line-height: 1.4;
		margin-top: -4px;
	}

	/* ── Detail empty state ────────────────────────────────────────────── */
	.detail-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		height: 100%;
		color: var(--text-muted);
		padding: 40px;
		text-align: center;
	}

	.detail-empty :global(.detail-empty-icon) {
		opacity: 0.2;
	}

	.detail-empty p {
		font-size: 0.85rem;
		opacity: 0.6;
	}

	/* ── Spinners ──────────────────────────────────────────────────────── */
	.mini-spinner {
		display: inline-block;
		width: 11px;
		height: 11px;
		border: 1.5px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	.mini-spinner.accent {
		border-color: var(--accent-glow);
		border-top-color: var(--accent);
	}

	@keyframes spin {
		to { rotate: 360deg; }
	}

	/* ── Shared ────────────────────────────────────────────────────────── */
	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		color: var(--text-muted);
		transition: all 0.2s;
		background: none;
		border: none;
		cursor: pointer;
	}

	.icon-btn:hover {
		background: var(--border);
		color: var(--text);
	}

	/* ── Mobile: stack columns ─────────────────────────────────────────── */
	@media (max-width: 580px) {
		.panel-body {
			grid-template-columns: 1fr;
		}

		.col-list {
			border-right: none;
		}

		.mobile-hidden {
			display: none;
		}

		.back-btn {
			display: flex;
		}

		.panel {
			max-height: 88vh;
		}
	}
</style>