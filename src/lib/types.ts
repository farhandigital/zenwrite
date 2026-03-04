export interface DocumentConfig {
	title?: string;
	description?: string;
	pubDate?: string;
	tags?: string[];
	[key: string]: any;
}

export interface Document {
	id: string;
	title: string;
	content: string;
	config: DocumentConfig;
	createdAt: number;
	updatedAt: number;
	/** True only for brand-new documents until the title has been auto-selected once. */
	isNew?: boolean;
}
