/**
 * Cross-tab sync via BroadcastChannel.
 *
 * Handles two concerns:
 *
 * 1. Data sync  — document-saved / document-deleted / documents-imported
 *    Keeps every tab's in-memory store up-to-date without polling.
 *
 * 2. Tab presence — tab-opened-doc / tab-ack-doc / tab-left-doc
 *    Lets each tab know when another tab is looking at the same document so
 *    the UI can warn the user *before* any data-loss situation occurs.
 *
 * Channel: 'zenwrite-sync'
 * BroadcastChannel never re-delivers a message to its own sender.
 */

// ─── Stable tab identity ──────────────────────────────────────────────────────

/**
 * UUID unique to this tab for its entire lifetime.
 * sessionStorage keeps it stable across soft navigations but discards it when
 * the tab is closed, which is exactly the lifecycle we want.
 * Lazily initialized on first call to avoid writing to sessionStorage at module import time.
 */
let _tabId: string | null = null;

export function getTabId(): string {
	if (typeof window === 'undefined') return 'ssr';
	if (_tabId) return _tabId;
	const key = 'zenwrite-tab-id';
	_tabId = sessionStorage.getItem(key) ?? crypto.randomUUID();
	sessionStorage.setItem(key, _tabId);
	return _tabId;
}

// ─── Message union ────────────────────────────────────────────────────────────

export type SyncMessage =
	// Data sync
	| { type: 'document-saved'; id: string }
	| { type: 'document-deleted'; id: string }
	| { type: 'documents-imported' }
	// Tab presence
	/** "I just opened / switched to this document." */
	| { type: 'tab-opened-doc'; docId: string; tabId: string }
	/** "I saw your tab-opened-doc and I'm also viewing it — here's my ack." */
	| { type: 'tab-ack-doc'; docId: string; tabId: string }
	/** "I switched away from / am closing this document." */
	| { type: 'tab-left-doc'; docId: string; tabId: string };

// ─── Channel singleton ────────────────────────────────────────────────────────

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
	if (typeof window === 'undefined') return null;
	if (!_channel) _channel = new BroadcastChannel('zenwrite-sync');
	return _channel;
}

// ─── Data-sync broadcasters ───────────────────────────────────────────────────

export function broadcastTabOpened(docId: string): void {
	const tabId = getTabId();
	getChannel()?.postMessage({
		type: 'tab-opened-doc',
		docId,
		tabId,
	} satisfies SyncMessage);
}

export function broadcastTabAck(docId: string): void {
	const tabId = getTabId();
	getChannel()?.postMessage({
		type: 'tab-ack-doc',
		docId,
		tabId,
	} satisfies SyncMessage);
}

export function broadcastTabLeft(docId: string): void {
	const tabId = getTabId();
	getChannel()?.postMessage({
		type: 'tab-left-doc',
		docId,
		tabId,
	} satisfies SyncMessage);
}

export function broadcastSave(id: string): void {
	getChannel()?.postMessage({
		type: 'document-saved',
		id,
	} satisfies SyncMessage);
}

export function broadcastDelete(id: string): void {
	getChannel()?.postMessage({
		type: 'document-deleted',
		id,
	} satisfies SyncMessage);
}

export function broadcastImport(): void {
	getChannel()?.postMessage({
		type: 'documents-imported',
	} satisfies SyncMessage);
}

// ─── Subscription ─────────────────────────────────────────────────────────────

/** Subscribe to messages from other tabs. Returns an unsubscribe function. */
export function listenSync(handler: (msg: SyncMessage) => void): () => void {
	const ch = getChannel();
	if (!ch) return () => {};
	const listener = (e: MessageEvent) => handler(e.data as SyncMessage);
	ch.addEventListener('message', listener);
	return () => ch.removeEventListener('message', listener);
}
