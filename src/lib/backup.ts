import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import yaml from 'js-yaml';
import type { Document, DocumentMetadata } from './types';

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
	const usedSlugs = new Set<string>();
	const snapshot = docs.map((d) => ({ ...d }));
	const zipPaths: Record<string, Uint8Array> = {};

	// Add human-readable markdown files concurrently
	for (const doc of snapshot) {
		const base = slugify(doc.metadata.title || 'untitled');
		let slug = base;
		let i = 1;
		while (usedSlugs.has(slug)) slug = `${base}-${i++}`;
		usedSlugs.add(slug);

		zipPaths[`documents/${slug}.md`] = strToU8(getAstroExport(doc));
	}

	// Add manifest — this is what we use for import
	const manifest: BackupManifest = {
		version: 1,
		exportedAt: new Date().toISOString(),
		appVersion: '0.0.1',
		documents: snapshot,
	};

	zipPaths['zenwrite-backup.json'] = strToU8(JSON.stringify(manifest, null, 2));

	const zipped = zipSync(zipPaths);
	const blob = new Blob([zipped as unknown as BlobPart], {
		type: 'application/zip',
	});

	const date = new Date().toISOString().split('T')[0];
	let filename = `zenwrite-backup-${date}.zip`;
	if (window.location.hostname === 'localhost') {
		filename = `localhost-${filename}`;
	}
	const a = Object.assign(document.createElement('a'), {
		href: URL.createObjectURL(blob),
		download: filename,
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
	const buffer = await file.arrayBuffer();
	const unzipped = unzipSync(new Uint8Array(buffer));

	// ── Manifest path (preferred) ────────────────────────────────────────────
	if (unzipped['zenwrite-backup.json']) {
		const text = strFromU8(unzipped['zenwrite-backup.json']);
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
	const mdEntries = Object.entries(unzipped).filter(([filename]) =>
		filename.endsWith('.md'),
	);

	const docs: Document[] = mdEntries.map(([filename, data]) => {
		const text = strFromU8(data);
		return parseMdToDocument(text, filename);
	});

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

	let config: Partial<DocumentMetadata> = {};
	let content = text;
	let title = filename.replace(/^documents\//, '').replace(/\.md$/, '');

	if (fmMatch) {
		try {
			config = (yaml.load(fmMatch[1]) as Partial<DocumentMetadata>) ?? {};
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
		content,
		metadata: {
			title,
			pubDate: new Date().toISOString().split('T')[0],
			tags: [],
			createdAt: now,
			updatedAt: now,
			...config,
		},
	};
}
