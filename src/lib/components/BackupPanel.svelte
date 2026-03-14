<script lang="ts">
import {
	Archive,
	CheckCircle,
	Download,
	FileWarning,
	RotateCcw,
	Upload,
	X,
} from 'lucide-svelte';
import { slide } from 'svelte/transition';
import { exportBackup, type ImportPreview, previewImport } from '$lib/backup';
import { docStore } from '$lib/doc-store.svelte';
import { uiState } from '$lib/ui-state.svelte';

// ─── Export state ────────────────────────────────────────────────────────────
type ExportStatus = 'idle' | 'loading' | 'done' | 'error';
let exportStatus: ExportStatus = $state('idle');
let exportError = $state('');

async function handleExport() {
	if (exportStatus === 'loading') return;
	exportStatus = 'loading';
	exportError = '';
	try {
		await exportBackup(docStore.documents, (doc) =>
			docStore.getAstroExport(doc),
		);
		exportStatus = 'done';
		setTimeout(() => {
			exportStatus = 'idle';
		}, 3000);
	} catch (err) {
		exportError = err instanceof Error ? err.message : 'Unknown error';
		exportStatus = 'error';
	}
}

// ─── Import state ────────────────────────────────────────────────────────────
type ImportStatus =
	| 'idle'
	| 'analysing'
	| 'ready'
	| 'importing'
	| 'done'
	| 'error';
let importStatus: ImportStatus = $state('idle');
let importError = $state('');
let isDragging = $state(false);
let preview: ImportPreview | null = $state(null);
let overwriteDuplicates = $state(false);
let importedCount = $state(0);

let fileInput: HTMLInputElement | undefined = $state();

function handleDragOver(e: DragEvent) {
	e.preventDefault();
	isDragging = true;
}
function handleDragLeave() {
	isDragging = false;
}

async function handleDrop(e: DragEvent) {
	e.preventDefault();
	isDragging = false;
	const file = e.dataTransfer?.files[0];
	if (file) await analyseFile(file);
}

async function handleFileInput(e: Event) {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) await analyseFile(file);
}

async function analyseFile(file: File) {
	if (!file.name.endsWith('.zip')) {
		importError = 'Please select a .zip file.';
		importStatus = 'error';
		return;
	}
	importStatus = 'analysing';
	importError = '';
	try {
		const existingIds = new Set(docStore.documents.map((d) => d.id));
		preview = await previewImport(file, existingIds);
		importStatus = 'ready';
	} catch (err) {
		importError =
			err instanceof Error ? err.message : 'Could not read zip file.';
		importStatus = 'error';
	}
}

async function handleImport() {
	if (!preview || importStatus === 'importing') return;
	importStatus = 'importing';
	try {
		const count = await docStore.importDocuments(
			preview.documents,
			overwriteDuplicates,
		);
		importedCount = count;
		importStatus = 'done';
		setTimeout(() => resetImport(), 4000);
	} catch (err) {
		importError = err instanceof Error ? err.message : 'Import failed.';
		importStatus = 'error';
	}
}

function resetImport() {
	importStatus = 'idle';
	preview = null;
	overwriteDuplicates = false;
	importError = '';
	importedCount = 0;
	if (fileInput) fileInput.value = '';
}

function close() {
	uiState.backupOpen = false;
}

function formatDate(iso: string) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	}).format(new Date(iso));
}

$effect(() => {
	// Prevent scroll on body when panel open
	if (uiState.backupOpen) {
		document.body.style.overflow = 'hidden';
	} else {
		document.body.style.overflow = '';
		// Reset state when closed
		exportStatus = 'idle';
		resetImport();
	}
});
</script>

{#if uiState.backupOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={close} transition:slide={{ duration: 200, axis: 'y' }}></div>

	<!-- Panel -->
	<div
		class="panel frosted-glass"
		role="dialog"
		aria-modal="true"
		aria-label="Backup & Restore"
		transition:slide={{ duration: 250, axis: 'y' }}
	>
		<!-- Header -->
		<div class="panel-header">
			<div class="panel-title">
				<Archive size={18} />
				<h2>Backup & Restore</h2>
			</div>
			<button class="icon-btn" onclick={close} aria-label="Close">
				<X size={18} />
			</button>
		</div>

		<div class="panel-body">

			<!-- ── Export Card ────────────────────────────────────────────── -->
			<div class="card">
				<div class="card-header">
					<Download size={15} />
					<h3>Export</h3>
				</div>
				<p class="card-description">
					Download all {docStore.documents.length} document{docStore.documents.length === 1 ? '' : 's'} as a zip.
					Each file is Astro-ready markdown with frontmatter, plus a full backup manifest for reliable re-import.
				</p>

				{#if exportStatus === 'error'}
					<div class="feedback error" transition:slide={{ duration: 150 }}>
						<FileWarning size={14} /> {exportError}
					</div>
				{/if}

				<button
					class="action-btn primary"
					class:loading={exportStatus === 'loading'}
					class:success={exportStatus === 'done'}
					onclick={handleExport}
					disabled={exportStatus === 'loading' || docStore.documents.length === 0}
				>
					{#if exportStatus === 'loading'}
						<span class="spinner"></span> Zipping…
					{:else if exportStatus === 'done'}
						<CheckCircle size={15} /> Downloaded!
					{:else}
						<Download size={15} /> Download Backup
					{/if}
				</button>
			</div>

			<!-- ── Import Card ────────────────────────────────────────────── -->
			<div class="card">
				<div class="card-header">
					<Upload size={15} />
					<h3>Import</h3>
				</div>

				{#if importStatus === 'idle' || importStatus === 'analysing' || importStatus === 'error'}
					<p class="card-description">
						Restore from a ZenWrite backup zip, or import any zip of markdown files.
						New documents will be added; existing ones are skipped by default.
					</p>

					<!-- Drop zone -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="dropzone"
						class:dragging={isDragging}
						class:analysing={importStatus === 'analysing'}
						role="button"
						tabindex="0"
						aria-label="Drop zip file or click to browse"
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={handleDrop}
						onclick={() => fileInput?.click()}
						onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
					>
						{#if importStatus === 'analysing'}
							<span class="spinner accent"></span>
							<span class="drop-label">Analysing…</span>
						{:else}
							<Upload size={20} class="drop-icon" />
							<span class="drop-label">Drop .zip here</span>
							<span class="drop-sub">or click to browse</span>
						{/if}
					</div>
					<input
						type="file"
						accept=".zip"
						class="sr-only"
						bind:this={fileInput}
						onchange={handleFileInput}
					/>

					{#if importStatus === 'error'}
						<div class="feedback error" transition:slide={{ duration: 150 }}>
							<FileWarning size={14} /> {importError}
						</div>
					{/if}
				{/if}

				{#if (importStatus === 'ready' || importStatus === 'importing') && preview}
					<div class="preview" transition:slide={{ duration: 200 }}>
						<div class="preview-header">
							<CheckCircle size={14} class="preview-check" />
							<span class="preview-filename">Backup analysed</span>
							{#if preview.exportedAt}
								<span class="preview-date">{formatDate(preview.exportedAt)}</span>
							{/if}
						</div>

						<div class="preview-stats">
							<div class="stat">
								<span class="stat-value new">{preview.totalDocs}</span>
								<span class="stat-label">total</span>
							</div>
							<div class="stat-divider"></div>
							<div class="stat">
								<span class="stat-value new">{preview.newDocs}</span>
								<span class="stat-label">new</span>
							</div>
							<div class="stat-divider"></div>
							<div class="stat">
								<span class="stat-value muted">{preview.duplicateDocs}</span>
								<span class="stat-label">duplicates</span>
							</div>
						</div>

						{#if preview.source === 'markdown'}
							<p class="source-note">
								No ZenWrite manifest found — parsed from markdown files. IDs will be regenerated.
							</p>
						{/if}

						{#if preview.duplicateDocs > 0}
							<label class="checkbox-label">
								<input type="checkbox" bind:checked={overwriteDuplicates} />
								<span>Overwrite {preview.duplicateDocs} existing duplicate{preview.duplicateDocs === 1 ? '' : 's'}</span>
							</label>
						{/if}

						<div class="preview-actions">
							<button class="action-btn ghost" onclick={resetImport}>
								<RotateCcw size={13} /> Choose different file
							</button>
							<button
								class="action-btn primary"
								class:loading={importStatus === 'importing'}
								onclick={handleImport}
								disabled={preview.newDocs === 0 && !overwriteDuplicates}
							>
								{#if importStatus === 'importing'}
									<span class="spinner"></span> Importing…
								{:else}
									<Upload size={15} />
									Import {overwriteDuplicates ? preview.totalDocs : preview.newDocs} Document{(overwriteDuplicates ? preview.totalDocs : preview.newDocs) === 1 ? '' : 's'}
								{/if}
							</button>
						</div>
					</div>
				{/if}

				{#if importStatus === 'done'}
					<div class="feedback success" transition:slide={{ duration: 150 }}>
						<CheckCircle size={14} />
						{importedCount} document{importedCount === 1 ? '' : 's'} imported successfully.
					</div>
				{/if}
			</div>

		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		z-index: 90;
	}

	.panel {
		position: fixed;
		bottom: 0;
		left: 50%;
		translate: -50% 0;
		width: min(560px, 100vw);
		max-height: 90vh;
		overflow-y: auto;
		z-index: 100;
		border-radius: 20px 20px 0 0;
		border-bottom: none;
		box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.12), 0 -2px 8px rgba(0, 0, 0, 0.06);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px 16px;
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		background: var(--overlay);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: 20px 20px 0 0;
		z-index: 1;
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

	.panel-body {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		padding: 20px 24px 28px;
	}

	@media (max-width: 520px) {
		.panel-body {
			grid-template-columns: 1fr;
		}
	}

	/* ── Card ────────────────────────────────────────────────────────── */
	.card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 18px;
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text);
	}

	.card-header h3 {
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.card-description {
		font-size: 0.82rem;
		color: var(--text-muted);
		line-height: 1.55;
	}

	/* ── Buttons ─────────────────────────────────────────────────────── */
	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		font-size: 0.85rem;
		font-weight: 600;
		padding: 9px 16px;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
	}

	.action-btn.primary {
		background: var(--accent);
		color: #fff;
	}

	.action-btn.primary:hover:not(:disabled) {
		filter: brightness(1.12);
	}

	.action-btn.primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.action-btn.primary.success {
		background: #22c55e;
	}

	.action-btn.ghost {
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border);
		font-size: 0.8rem;
		padding: 7px 12px;
	}

	.action-btn.ghost:hover {
		color: var(--text);
		background: var(--border);
	}

	/* ── Dropzone ────────────────────────────────────────────────────── */
	.dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 28px 16px;
		border: 1.5px dashed var(--border);
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: center;
		color: var(--text-muted);
	}

	.dropzone:hover,
	.dropzone.dragging {
		border-color: var(--accent);
		background: var(--accent-glow);
		color: var(--accent);
	}

	.dropzone.analysing {
		border-color: var(--accent);
		background: var(--accent-glow);
		pointer-events: none;
	}

	.dropzone :global(.drop-icon) {
		color: inherit;
		opacity: 0.6;
	}

	.drop-label {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.drop-sub {
		font-size: 0.78rem;
		opacity: 0.6;
	}

	/* ── Preview ─────────────────────────────────────────────────────── */
	.preview {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.preview-header {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.82rem;
	}

	.preview-header :global(.preview-check) {
		color: #22c55e;
		flex-shrink: 0;
	}

	.preview-filename {
		font-weight: 600;
		color: var(--text);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-date {
		font-size: 0.75rem;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.preview-stats {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px 16px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
	}

	.stat-value {
		font-size: 1.3rem;
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 1.2;
	}

	.stat-value.new { color: var(--accent); }
	.stat-value.muted { color: var(--text-muted); }

	.stat-label {
		font-size: 0.72rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 500;
	}

	.stat-divider {
		width: 1px;
		height: 32px;
		background: var(--border);
	}

	.source-note {
		font-size: 0.78rem;
		color: var(--text-muted);
		background: rgba(251, 191, 36, 0.08);
		border: 1px solid rgba(251, 191, 36, 0.2);
		border-radius: 7px;
		padding: 8px 12px;
		line-height: 1.5;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.82rem;
		color: var(--text-muted);
		cursor: pointer;
	}

	.checkbox-label input[type="checkbox"] {
		accent-color: var(--accent);
		width: 14px;
		height: 14px;
		cursor: pointer;
	}

	.preview-actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 4px;
	}

	/* ── Feedback ────────────────────────────────────────────────────── */
	.feedback {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.82rem;
		padding: 10px 14px;
		border-radius: 8px;
		line-height: 1.4;
	}

	.feedback.error {
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}

	.feedback.success {
		background: rgba(34, 197, 94, 0.08);
		border: 1px solid rgba(34, 197, 94, 0.2);
		color: #22c55e;
	}

	/* ── Spinner ─────────────────────────────────────────────────────── */
	.spinner {
		display: inline-block;
		width: 13px;
		height: 13px;
		border: 2px solid rgba(255, 255, 255, 0.35);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	.spinner.accent {
		border-color: var(--accent-glow);
		border-top-color: var(--accent);
	}

	@keyframes spin {
		to { rotate: 360deg; }
	}

	/* ── Shared ──────────────────────────────────────────────────────── */
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

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>