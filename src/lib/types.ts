export interface DocumentMetadata {
	title: string;
	description?: string;
	pubDate?: string;
	tags?: string[];
	createdAt: number;
	updatedAt: number;
	[key: string]: unknown;
}

export interface Document {
	id: string;
	/** True only for brand-new documents until the title has been auto-selected once. */
	isNew?: boolean;
	content: string;
	metadata: DocumentMetadata;
}
