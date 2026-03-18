import type { Document, DocumentMetadata } from './types';

/**
 * Migrate old documents to the new structure.
 *
 * Handles two transformations:
 * 1. config → metadata field rename (for docs saved before the refactor)
 * 2. Flatten top-level title/createdAt/updatedAt into metadata object
 *
 * Old format:
 *   { id, title, content, config?: {...}, createdAt, updatedAt, isNew? }
 *
 * New format:
 *   { id, content, metadata: { title, description?, pubDate?, tags?, createdAt, updatedAt }, isNew? }
 */
export function migrateDocument(doc: unknown): Document | null {
	if (!doc || typeof doc !== 'object') return null;

	const data = doc as Record<string, unknown>;

	// Check if already fully migrated to new structure
	const metadata = data.metadata as Record<string, unknown> | undefined;
	if (
		metadata &&
		'title' in metadata &&
		'createdAt' in metadata &&
		'updatedAt' in metadata &&
		!('title' in data) &&
		!('createdAt' in data) &&
		!('updatedAt' in data)
	) {
		const result = data as unknown as Document;
		return result;
	}

	// Need to migrate: combine old config/metadata with top-level fields
	const oldConfig = (data.config as Record<string, unknown>) || {};
	const oldMetadata = (data.metadata as Record<string, unknown>) || {};

	// Prefer existing metadata over config, but both should be merged
	const metadataBase =
		Object.keys(oldMetadata).length > 0 ? oldMetadata : oldConfig;

	const newMetadata: DocumentMetadata = {
		title:
			(data.title as string) || (metadataBase.title as string) || 'Untitled',
		description: (metadataBase.description as string | undefined) ?? undefined,
		pubDate: (metadataBase.pubDate as string | undefined) ?? undefined,
		tags: Array.isArray(metadataBase.tags)
			? (metadataBase.tags as string[])
			: undefined,
		createdAt: (data.createdAt as number) || Date.now(),
		updatedAt: (data.updatedAt as number) || Date.now(),
		// Preserve any other custom fields from old metadata
		...Object.fromEntries(
			Object.entries(metadataBase).filter(
				([key]) =>
					![
						'title',
						'description',
						'pubDate',
						'tags',
						'createdAt',
						'updatedAt',
					].includes(key),
			),
		),
	};

	return {
		id: data.id as string,
		content: data.content as string,
		metadata: newMetadata,
		...(typeof data.isNew === 'boolean' ? { isNew: data.isNew } : {}),
	};
}

/**
 * Migrate an array of documents.
 */
export function migrateDocuments(docs: unknown[]): Document[] {
	return docs
		.map(migrateDocument)
		.filter((doc): doc is Document => doc !== null);
}
