import {
	BlobReader,
	BlobWriter,
	TextReader,
	TextWriter,
	ZipReader,
	ZipWriter,
} from '@zip.js/zip.js';
import yaml from 'js-yaml';
import type { Document, DocumentConfig } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(title: string): string {
	return (
		title
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 60) || 'untitled'
	);
}

// ─── Export ─────────────────────────────────────────────────────────────────

export interface BackupManifest {
	version: number;
	exportedAt: string;
	appVersion: string;
	documents: Document[];
}

/**
 * Zips all documents into a downloadable backup file.
 *
 * Structure inside the zip:
 *   documents/my-post.md          ← human-readable, Astro-ready markdown
 *   zenwrite-backup.json          ← full manifest for reliable round-trip import
 */
export async function exportBackup(
	docs: Document[],
	getAstroExport: (doc: Document) => string,
): Promise<void> {
	const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
	const usedSlugs = new Set<string>();

	const snapshot = docs.map((d) => ({ ...d }));

	// Add human-readable markdown files concurrently
	const addJobs = snapshot.map((doc) => {
		const base = slugify(doc.title || 'untitled');
		let slug = base;
		let i = 1;
		while (usedSlugs.has(slug)) slug = `${base}-${i++}`;
		usedSlugs.add(slug);

		return zipWriter.add(
			`documents/${slug}.md`,
			new TextReader(getAstroExport(doc)),
		);
	});

	await Promise.all(addJobs);

	// Add manifest — this is what we use for import
	const manifest: BackupManifest = {
		version: 1,
		exportedAt: new Date().toISOString(),
		appVersion: '0.0.1',
		documents: snapshot,
	};

	await zipWriter.add(
		'zenwrite-backup.json',
		new TextReader(JSON.stringify(manifest, null, 2)),
	);

	const blob = await zipWriter.close();

	const date = new Date().toISOString().split('T')[0];
	const a = Object.assign(document.createElement('a'), {
		href: URL.createObjectURL(blob),
		download: `zenwrite-backup-${date}.zip`,
	});
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

// ─── Import ──────────────────────────────────────────────────────────────────

export type ImportSource = 'manifest' | 'markdown';

export interface ImportPreview {
	totalDocs: number;
	newDocs: number;
	duplicateDocs: number;
	documents: Document[];
	source: ImportSource;
	exportedAt: string | null;
}

/**
 * Opens and analyses a zip without importing anything yet.
 * Returns a preview the UI can show before the user confirms.
 */
export async function previewImport(
	file: File,
	existingIds: Set<string>,
): Promise<ImportPreview> {
	const zipReader = new ZipReader(new BlobReader(file));
	const entries = await zipReader.getEntries();

	// ── Manifest path (preferred) ────────────────────────────────────────────
	const manifestEntry = entries.find(
		(e) => e.filename === 'zenwrite-backup.json',
	);
	if (manifestEntry && !manifestEntry.directory) {
		const text = await manifestEntry.getData(new TextWriter());
		await zipReader.close();

		const manifest = JSON.parse(text) as BackupManifest;
		const docs = manifest.documents ?? [];

		return {
			totalDocs: docs.length,
			newDocs: docs.filter((d) => !existingIds.has(d.id)).length,
			duplicateDocs: docs.filter((d) => existingIds.has(d.id)).length,
			documents: docs,
			source: 'manifest',
			exportedAt: manifest.exportedAt ?? null,
		};
	}

	// ── Markdown fallback (plain .md zips) ───────────────────────────────────
	const mdEntries = entries.filter(
		(e): e is typeof e & { directory: false } =>
			e.filename.endsWith('.md') && !e.directory,
	);

	const docs: Document[] = await Promise.all(
		mdEntries.map(async (entry) => {
			const text = await entry.getData(new TextWriter());
			return parseMdToDocument(text, entry.filename);
		}),
	);

	await zipReader.close();

	return {
		totalDocs: docs.length,
		newDocs: docs.filter((d) => !existingIds.has(d.id)).length,
		duplicateDocs: docs.filter((d) => existingIds.has(d.id)).length,
		documents: docs,
		source: 'markdown',
		exportedAt: null,
	};
}

function parseMdToDocument(text: string, filename: string): Document {
	const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

	let config: DocumentConfig = {};
	let content = text;
	let title = filename.replace(/^documents\//, '').replace(/\.md$/, '');

	if (fmMatch) {
		try {
			config = (yaml.load(fmMatch[1]) as DocumentConfig) ?? {};
		} catch {
			// malformed frontmatter — keep defaults
		}
		content = fmMatch[2].replace(/^\n/, '');
		if (typeof config.title === 'string' && config.title) {
			title = config.title;
		}
	}

	const now = Date.now();
	return {
		id: crypto.randomUUID(),
		title,
		content,
		config: {
			pubDate: new Date().toISOString().split('T')[0],
			tags: [],
			...config,
		},
		createdAt: now,
		updatedAt: now,
	};
}
