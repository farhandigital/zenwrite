import yaml from 'js-yaml';
import { deleteDocument, getDocument, getDocuments, saveDocument } from './db';
import {
	broadcastDelete,
	broadcastImport,
	broadcastSave,
	listenSync,
} from './sync';
import type { Document } from './types';
import { versionStore } from './version-store.svelte';

export class DocStore {
	documents: Document[] = $state([]);
	currentDocId: string | null = $state(null);

	private saveTimer: ReturnType<typeof setTimeout> | null = null;

	get currentDocument(): Document | null {
		return this.documents.find((d) => d.id === this.currentDocId) || null;
	}

	// ─── Initialisation ────────────────────────────────────────────────────────

	init = async () => {
		if (typeof window === 'undefined') return;

		try {
			const docs = await getDocuments();
			this.documents = docs.sort(
				(a, b) => b.metadata.updatedAt - a.metadata.updatedAt,
			);
		} catch (err) {
			console.error('[zenwrite] Failed to load documents on init:', err);
		}

		if (this.documents.length === 0) {
			await this.createNew();
		} else {
			this.currentDocId = this.documents[0].id;
		}

		// ── Cross-tab data sync ────────────────────────────────────────────────
		listenSync(async (msg) => {
			if (msg.type === 'document-saved') {
				await this._handleRemoteSave(msg.id);
			} else if (msg.type === 'document-deleted') {
				await this._handleRemoteDelete(msg.id);
			} else if (msg.type === 'documents-imported') {
				await this._reloadAllFromDB();
			}
			// Tab-presence messages are handled by tabPresence, not here.
		});

		// Full re-sync when the tab regains focus (BroadcastChannel messages are
		// fire-and-forget; a long-backgrounded tab may have missed some).
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				this._reloadAllFromDB();
			}
		});
	};

	// ─── Remote-event handlers ─────────────────────────────────────────────────

	private _handleRemoteSave = async (id: string): Promise<void> => {
		// Never clobber the document currently open in this tab — the user may
		// have unsaved keystrokes that haven't been debounce-flushed yet.
		if (id === this.currentDocId) return;

		try {
			const doc = await getDocument(id);
			if (!doc) return;

			const idx = this.documents.findIndex((d) => d.id === id);
			if (idx !== -1) {
				const updated = [...this.documents];
				updated[idx] = doc;
				this.documents = updated.sort(
					(a, b) => b.metadata.updatedAt - a.metadata.updatedAt,
				);
			} else {
				// New doc created in another tab
				this.documents = [doc, ...this.documents].sort(
					(a, b) => b.metadata.updatedAt - a.metadata.updatedAt,
				);
			}
		} catch (err) {
			console.error('[zenwrite] Failed to handle remote save:', err);
		}
	};

	private _handleRemoteDelete = async (id: string): Promise<void> => {
		this.documents = this.documents.filter((d) => d.id !== id);

		if (this.currentDocId === id) {
			if (this.documents.length > 0) {
				this.currentDocId = this.documents[0].id;
			} else {
				await this.createNew();
			}
		}
	};

	private _reloadAllFromDB = async (): Promise<void> => {
		try {
			const dbDocs = await getDocuments();
			const sorted = dbDocs.sort(
				(a, b) => b.metadata.updatedAt - a.metadata.updatedAt,
			);

			// Preserve the in-memory (in-progress) state of the active document
			this.documents = sorted.map((dbDoc) => {
				if (dbDoc.id === this.currentDocId) {
					return this.documents.find((d) => d.id === dbDoc.id) ?? dbDoc;
				}
				return dbDoc;
			});

			if (
				this.currentDocId &&
				!this.documents.find((d) => d.id === this.currentDocId)
			) {
				this.currentDocId = this.documents[0]?.id ?? null;
				if (!this.currentDocId) await this.createNew();
			}
		} catch (err) {
			console.error('[zenwrite] Failed to reload documents from DB:', err);
		}
	};

	// ─── Local mutations ───────────────────────────────────────────────────────

	createNew = async () => {
		const id = crypto.randomUUID();
		const now = Date.now();
		const doc: Document = {
			id,
			content: '',
			metadata: {
				title: '',
				pubDate: new Date().toISOString().split('T')[0],
				tags: [],
				createdAt: now,
				updatedAt: now,
			},
			isNew: true,
		};
		try {
			await saveDocument(doc);
			broadcastSave(doc.id);
		} catch (err) {
			console.error('[zenwrite] Failed to persist new document:', err);
		}
		this.documents = [doc, ...this.documents];
		this.currentDocId = doc.id;
	};

	updateCurrent = async (updates: Partial<Document>) => {
		const index = this.documents.findIndex((d) => d.id === this.currentDocId);
		if (index === -1) return;

		const updated = {
			...this.documents[index],
			...updates,
		};
		if (updated.metadata) {
			updated.metadata.updatedAt = Date.now();
		}
		this.documents[index] = updated;

		if (this.saveTimer !== null) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => {
			this.saveTimer = null;
			const docId = this.currentDocId;
			const latest = this.documents.find((d) => d.id === docId);
			if (latest) {
				const snapshot = $state.snapshot(latest);
				saveDocument(snapshot)
					.then(() => {
						broadcastSave(latest.id);
						// Notify the version store so it can decide whether to auto-version.
						versionStore.onDocumentSaved(snapshot);
					})
					.catch((err) => {
						console.error('[zenwrite] Debounced save failed:', err);
					});
			}
		}, 400);
	};

	/**
	 * Switch to a different document, flushing any pending saves and creating
	 * a version checkpoint for the document being abandoned. This naturally
	 * captures session boundaries—the most reliable "I lost my work" recovery point.
	 */
	switchDocument = async (newDocId: string) => {
		// If already on this document, no-op
		if (this.currentDocId === newDocId) {
			return;
		}

		// Flush pending save for current document (if any) and trigger version save
		if (this.currentDocId !== null) {
			if (this.saveTimer !== null) {
				clearTimeout(this.saveTimer);
				this.saveTimer = null;
			}

			const current = this.documents.find((d) => d.id === this.currentDocId);

			if (current) {
				const snapshot = $state.snapshot(current);

				try {
					await saveDocument(snapshot);
					broadcastSave(current.id);

					// Create a version checkpoint when abandoning this document
					// Pass isDocumentSwitch=true to bypass the char delta gate
					await versionStore.onDocumentSaved(snapshot, true);
				} catch (err) {
					console.error(
						'[zenwrite] Failed to flush save on document switch:',
						err,
					);
				}
			}
		}

		// Switch to new document
		this.currentDocId = newDocId;
	};

	deleteDoc = async (id: string) => {
		try {
			await deleteDocument(id);
			broadcastDelete(id);
			// Clean up version history for this document
			versionStore.deleteVersionsForDoc(id).catch((err) => {
				console.error('[zenwrite] Failed to delete doc versions:', err);
			});
		} catch (err) {
			console.error('[zenwrite] Failed to delete document:', err);
			return;
		}
		this.documents = this.documents.filter((d) => d.id !== id);
		if (this.currentDocId === id) {
			if (this.documents.length > 0) {
				this.currentDocId = this.documents[0].id;
			} else {
				await this.createNew();
			}
		}
	};

	importDocuments = async (
		docs: Document[],
		overwrite: boolean,
	): Promise<number> => {
		const existingIds = new Set(this.documents.map((d) => d.id));
		const toWrite = overwrite
			? docs
			: docs.filter((d) => !existingIds.has(d.id));

		let saved = 0;
		for (const doc of toWrite) {
			try {
				await saveDocument(doc);
				saved++;
			} catch (err) {
				console.error('[zenwrite] Failed to import document:', doc.id, err);
			}
		}

		if (saved > 0) {
			broadcastImport();
			try {
				const allDocs = await getDocuments();
				this.documents = allDocs.sort(
					(a, b) => b.metadata.updatedAt - a.metadata.updatedAt,
				);
				if (!this.documents.find((d) => d.id === this.currentDocId)) {
					this.currentDocId = this.documents[0]?.id ?? null;
				}
			} catch (err) {
				console.error('[zenwrite] Failed to reload after import:', err);
			}
		}

		return saved;
	};

	getAstroExport(doc: Document): string {
		const clonedConfig = structuredClone($state.snapshot(doc.metadata));

		if (!clonedConfig.title) {
			clonedConfig.title = 'Untitled Document';
		}

		if (clonedConfig.tags && clonedConfig.tags.length === 0) {
			delete clonedConfig.tags;
		}

		try {
			const frontmatter = yaml.dump(clonedConfig);
			return `---\n${frontmatter}---\n\n${doc.content}`;
		} catch (e) {
			return `---\ntitle: ${clonedConfig.title}\n---\n\n${doc.content}`;
		}
	}
}

export const docStore = new DocStore();
