import { getDocuments, saveDocument, deleteDocument } from './db';
import type { Document } from './types';
import yaml from 'js-yaml';

export class AppState {
	documents: Document[] = $state([]);
	currentDocId: string | null = $state(null);
	theme: 'light' | 'dark' = $state('light');
	
	sidebarOpen = $state(false);
	tocOpen = $state(false);
	settingsOpen = $state(false);

	get currentDocument(): Document | null {
		return this.documents.find(d => d.id === this.currentDocId) || null;
	}

	async init() {
		if (typeof window === 'undefined') return;
		
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'dark' || savedTheme === 'light') {
			this.theme = savedTheme;
		} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			this.theme = 'dark';
		}
		this.applyTheme();

		const docs = await getDocuments();
		this.documents = docs.sort((a, b) => b.updatedAt - a.updatedAt);
		
		if (this.documents.length === 0) {
			await this.createNew();
		} else {
			this.currentDocId = this.documents[0].id;
		}
	}

	toggleTheme() {
		this.theme = this.theme === 'light' ? 'dark' : 'light';
		localStorage.setItem('theme', this.theme);
		this.applyTheme();
	}

	private applyTheme() {
		if (typeof document !== 'undefined') {
			if (this.theme === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}
	}

	async createNew() {
		const id = crypto.randomUUID();
		const doc: Document = {
			id,
			title: 'Untitled Document',
			content: '',
			config: {
				pubDate: new Date().toISOString().split('T')[0],
				tags: []
			},
			createdAt: Date.now(),
			updatedAt: Date.now()
		};
		await saveDocument(doc);
		this.documents = [doc, ...this.documents];
		this.currentDocId = doc.id;
	}

	async updateCurrent(updates: Partial<Document>) {
		const index = this.documents.findIndex(d => d.id === this.currentDocId);
		if (index !== -1) {
			const updatedDoc = { ...this.documents[index], ...updates, updatedAt: Date.now() };
			
			// We must replace the object in the array to trigger deep reactivity if not fully deep,
			// or simply mutate properties. Svelte 5 `$state` arrays update beautifully, but we'll reassign the object.
			this.documents[index] = updatedDoc;
			
			// Sort so latest is top? Let's just update and let db persist.
			// Sort could jump positions while editing, so we might sort only on load or explicitly.
			
			await saveDocument($state.snapshot(updatedDoc));
		}
	}

	async deleteDoc(id: string) {
		await deleteDocument(id);
		this.documents = this.documents.filter(d => d.id !== id);
		if (this.currentDocId === id) {
			if (this.documents.length > 0) {
				this.currentDocId = this.documents[0].id;
			} else {
				await this.createNew();
			}
		}
	}

	getAstroExport(doc: Document): string {
		const clonedConfig = structuredClone($state.snapshot(doc.config));
		
		// Map our internal 'title' into the Astro frontmatter
		if (!clonedConfig.title) {
			clonedConfig.title = doc.title;
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

export const appState = new AppState();
