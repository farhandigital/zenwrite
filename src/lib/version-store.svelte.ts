/**
 * version-store.svelte.ts
 *
 * Reactive store that wraps the separate versions database and drives the
 * version-history UI.  The doc-store calls `versionStore.onDocumentSaved(doc)`
 * after every successful debounced save; this store decides autonomously
 * whether to create an auto-version based on elapsed time and content change.
 *
 * Auto-version policy
 * ────────────────────
 * A new auto-version is recorded when BOTH conditions hold:
 *   1. At least AUTO_VERSION_COOLDOWN ms have passed since the last version
 *      for this document.
 *   2. The content has changed by at least MIN_CHAR_DELTA characters since
 *      the last version.
 *
 * Manual checkpoints
 * ───────────────────
 * Created on user request with an optional label. Never pruned automatically.
 */

import type { Document, DocumentMetadata } from './types';
import {
	type DocumentVersion,
	deleteVersion,
	deleteVersionsForDoc,
	getVersionsForDoc,
	initVersionsDB,
	MAX_AUTO_VERSIONS,
	saveVersionWithPruning,
} from './versions-db';

// ─── Constants ────────────────────────────────────────────────────────────────

/** 1 minute between automatic versions for the same document. */
const AUTO_VERSION_COOLDOWN = 1 * 60 * 1000;

/**
 * Minimum character-count difference between current content and the content
 * at the time of the last version before a new auto-version is recorded.
 */
const MIN_CHAR_DELTA = 50;

// ─── Per-document version tracking ───────────────────────────────────────────

interface DocVersionMeta {
	lastVersionAt: number;
	contentAtLastVersion: string;
}

// ─── Store class ─────────────────────────────────────────────────────────────

class VersionStore {
	/** Versions displayed in the UI (for the currently viewed document). */
	versions: DocumentVersion[] = $state([]);

	/** Whether versions are loading from IDB. */
	isLoading = $state(false);

	/** The version id the user has selected for preview. */
	selectedId: string | null = $state(null);

	/** The docId whose versions are currently loaded into `versions`. */
	private _loadedDocId: string | null = null;

	/** Per-document bookkeeping so cooldown/delta are tracked independently. */
	private _meta: Map<string, DocVersionMeta> = new Map();

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	init(): void {
		if (typeof window === 'undefined') return;
		initVersionsDB();
	}

	// ── Panel management ──────────────────────────────────────────────────────

	/**
	 * Load (or reload) the version list for a given document.
	 * Call this when the versions panel is opened or the active doc changes.
	 * Note: Does not reset selectedId; callers must handle UI state explicitly.
	 */
	async loadVersions(docId: string): Promise<void> {
		this._loadedDocId = docId;
		this.isLoading = true;
		try {
			this.versions = await getVersionsForDoc(docId);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Pre-computes and exposes the label for the retention limit so the UI can
	 * show "50 auto versions max" without importing the constant directly.
	 */
	get maxAutoVersions(): number {
		return MAX_AUTO_VERSIONS;
	}

	// ── Auto-versioning ───────────────────────────────────────────────────────

	/**
	 * Called by the doc-store after every successful debounced save.
	 * Decides whether to record a new auto-version.
	 *
	 * @param doc - The document to potentially version
	 * @param isDocumentSwitch - If true, bypass the char delta gate (document
	 *   switches are semantic boundaries that warrant a checkpoint regardless
	 *   of content size)
	 */
	async onDocumentSaved(
		doc: Document,
		isDocumentSwitch: boolean = false,
	): Promise<void> {
		const meta = this._meta.get(doc.id);
		const now = Date.now();

		const timeSinceLast = meta ? now - meta.lastVersionAt : Infinity;
		const charDelta = meta
			? Math.abs(doc.content.length - meta.contentAtLastVersion.length)
			: doc.content.length;

		// For document switches, bypass the char delta gate since the switch itself
		// is the meaningful event, not the content change volume
		const shouldVersion = isDocumentSwitch
			? timeSinceLast >= AUTO_VERSION_COOLDOWN
			: timeSinceLast >= AUTO_VERSION_COOLDOWN && charDelta >= MIN_CHAR_DELTA;

		if (shouldVersion) {
			await this._writeVersion(doc, null);
		}
	}

	// ── Manual checkpoints ────────────────────────────────────────────────────

	/**
	 * Creates a named manual checkpoint for the given document.
	 * The label defaults to "Checkpoint" if the caller passes an empty string.
	 */
	async createCheckpoint(doc: Document, label: string): Promise<void> {
		const finalLabel = label.trim() || 'Checkpoint';
		await this._writeVersion(doc, finalLabel);
	}

	// ── Mutations ─────────────────────────────────────────────────────────────

	/** Removes a single version. Updates the in-memory list if it's loaded. */
	async deleteVersion(id: string): Promise<void> {
		await deleteVersion(id);
		if (this._loadedDocId) {
			this.versions = this.versions.filter((v) => v.id !== id);
		}
		if (this.selectedId === id) this.selectedId = null;
	}

	/** Removes ALL versions for a document (called when document is deleted). */
	async deleteVersionsForDoc(docId: string): Promise<void> {
		await deleteVersionsForDoc(docId);
		if (this._loadedDocId === docId) {
			this.versions = [];
			this.selectedId = null;
		}
	}

	// ── Derived helpers ───────────────────────────────────────────────────────

	get selectedVersion(): DocumentVersion | null {
		if (!this.selectedId) return null;
		return this.versions.find((v) => v.id === this.selectedId) ?? null;
	}

	get autoCount(): number {
		return this.versions.filter((v) => v.label === null).length;
	}

	get manualCount(): number {
		return this.versions.filter((v) => v.label !== null).length;
	}

	// ── Internal helpers ──────────────────────────────────────────────────────

	private async _writeVersion(
		doc: Document,
		label: string | null,
	): Promise<void> {
		const fullText = [doc.metadata.title, doc.content]
			.filter(Boolean)
			.join(' ');
		const wordCount =
			fullText.trim() === '' ? 0 : fullText.trim().split(/\s+/).length;
		const plainConfig = $state.snapshot(doc.metadata) as DocumentMetadata;
		const version: DocumentVersion = {
			id: crypto.randomUUID(),
			docId: doc.id,
			title: doc.metadata.title,
			content: doc.content,
			metadata: structuredClone(plainConfig),
			createdAt: Date.now(),
			wordCount,
			charCount: doc.content.length,
			label,
		};

		await saveVersionWithPruning(version);

		// Update bookkeeping
		this._meta.set(doc.id, {
			lastVersionAt: version.createdAt,
			contentAtLastVersion: doc.content,
		});

		// Refresh in-memory list if this doc is loaded in the panel
		if (this._loadedDocId === doc.id) {
			this.versions = [version, ...this.versions];
			// Reflect pruning: drop excess auto versions from memory too
			const autos = this.versions.filter((v) => v.label === null);
			if (autos.length > MAX_AUTO_VERSIONS) {
				const pruned = new Set(autos.slice(MAX_AUTO_VERSIONS).map((v) => v.id));
				this.versions = this.versions.filter((v) => !pruned.has(v.id));
			}
		}
	}
}

export const versionStore = new VersionStore();
