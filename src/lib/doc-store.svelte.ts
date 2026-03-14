import yaml from 'js-yaml';
import { deleteDocument, getDocuments, saveDocument } from './db';
import type { Document } from './types';

export class DocStore {
	documents: Document[] = $state([]);
	currentDocId: string | null = $state(null);

	private saveTimer: ReturnType<typeof setTimeout> | null = null;

	get currentDocument(): Document | null {
		return this.documents.find((d) => d.id === this.currentDocId) || null;
	}

	init = async () => {
		if (typeof window === 'undefined') return;

		try {
			const docs = await getDocuments();
			this.documents = docs.sort((a, b) => b.updatedAt - a.updatedAt);
		} catch (err) {
			console.error('[zenwrite] Failed to load documents on init:', err);
		}

		if (this.documents.length === 0) {
			await this.createNew();
		} else {
			this.currentDocId = this.documents[0].id;
		}
	};

	createNew = async () => {
		const id = crypto.randomUUID();
		const doc: Document = {
			id,
			title: '',
			content: '',
			config: {
				pubDate: new Date().toISOString().split('T')[0],
				tags: [],
			},
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isNew: true,
		};
		try {
			await saveDocument(doc);
		} catch (err) {
			console.error('[zenwrite] Failed to persist new document:', err);
		}
		this.documents = [doc, ...this.documents];
		this.currentDocId = doc.id;
	};

	updateCurrent = async (updates: Partial<Document>) => {
		const index = this.documents.findIndex((d) => d.id === this.currentDocId);
		if (index === -1) return;

		// Update in-memory state immediately for a responsive UI.
		this.documents[index] = {
			...this.documents[index],
			...updates,
			updatedAt: Date.now(),
		};

		// Debounce the DB write — collapses rapid keystrokes into one persist call.
		if (this.saveTimer !== null) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => {
			this.saveTimer = null;
			const docId = this.currentDocId;
			const latest = this.documents.find((d) => d.id === docId);
			if (latest) {
				saveDocument($state.snapshot(latest)).catch((err) => {
					console.error('[zenwrite] Debounced save failed:', err);
				});
			}
		}, 400);
	};

	deleteDoc = async (id: string) => {
		try {
			await deleteDocument(id);
		} catch (err) {
			console.error('[zenwrite] Failed to delete document:', err);
			return; // Don't remove from UI if the DB delete failed
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

	/**
	 * Import a list of documents into the store.
	 *
	 * @param docs           Documents parsed from a backup zip.
	 * @param overwrite      When true, existing documents with matching IDs are
	 *                       overwritten. When false (default), duplicates are skipped.
	 * @returns              The number of documents actually written to the DB.
	 */
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
				await saveDocument({ ...doc, updatedAt: Date.now() });
				saved++;
			} catch (err) {
				console.error('[zenwrite] Failed to import document:', doc.id, err);
			}
		}

		if (saved > 0) {
			// Reload from DB so the list is authoritative and sorted
			try {
				const allDocs = await getDocuments();
				this.documents = allDocs.sort((a, b) => b.updatedAt - a.updatedAt);
				// Keep current doc selected if it still exists, else pick the newest
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
		const clonedConfig = structuredClone($state.snapshot(doc.config));

		// Map our internal 'title' into the Astro frontmatter.
		// Fall back to 'Untitled Document' so the exported frontmatter is never blank.
		if (!clonedConfig.title) {
			clonedConfig.title = doc.title.trim() || 'Untitled Document';
		}

		if (clonedConfig.tags && clonedConfig.tags.length === 0) {
			delete clonedConfig.tags;
		}

		try {
			const frontmatter = yaml.dump(clonedConfig);
			return `---\n${frontmatter}---\n\n${doc.content}`;
		} catch (e) {
			return `---\ntitle: ${doc.title}\n---\n\n${doc.content}`;
		}
	}
}

export const docStore = new DocStore();
