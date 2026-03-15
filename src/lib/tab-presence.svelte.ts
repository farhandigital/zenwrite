/**
 * tab-presence.svelte.ts
 *
 * Tracks which other tabs are currently viewing the same document as this tab,
 * exposing a reactive `conflictCount` that drives the editor warning UI.
 *
 * Protocol (BroadcastChannel):
 *
 *   Tab A opens doc X
 *     → broadcasts  tab-opened-doc { docId: X, tabId: A }
 *
 *   Tab B (already on doc X) receives tab-opened-doc
 *     → adds A to its conflicting-tabs set
 *     → broadcasts  tab-ack-doc    { docId: X, tabId: B }
 *
 *   Tab A receives tab-ack-doc from B
 *     → adds B to its conflicting-tabs set
 *     → both tabs now show the warning
 *
 *   Tab A switches to doc Y (or closes)
 *     → broadcasts  tab-left-doc   { docId: X, tabId: A }
 *     → Tab B removes A, conflict clears
 */

import {
	broadcastTabAck,
	broadcastTabLeft,
	broadcastTabOpened,
	listenSync,
	TAB_ID,
} from './sync';

class TabPresence {
	/** tabIds of other tabs currently viewing the same document as this tab. */
	private _conflictingTabs: Set<string> = $state(new Set<string>());

	private _currentDocId: string | null = null;
	private _unlisten: (() => void) | null = null;

	// ── Public reactive surface ───────────────────────────────────────────────

	/** Number of *other* tabs that have the same document open. */
	get conflictCount(): number {
		return this._conflictingTabs.size;
	}

	/** True when at least one other tab has the same document open. */
	get hasConflict(): boolean {
		return this._conflictingTabs.size > 0;
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	init(): void {
		if (typeof window === 'undefined') return;

		this._unlisten = listenSync((msg) => {
			switch (msg.type) {
				case 'tab-opened-doc': {
					// Another tab just opened the same doc we're on.
					if (msg.docId !== this._currentDocId) return;
					if (msg.tabId === TAB_ID) return; // shouldn't happen, but guard anyway
					// Add them to our conflict set and acknowledge back.
					this._addConflict(msg.tabId);
					broadcastTabAck(msg.docId);
					break;
				}
				case 'tab-ack-doc': {
					// A tab responded to our tab-opened-doc — they're also on our doc.
					if (msg.docId !== this._currentDocId) return;
					if (msg.tabId === TAB_ID) return;
					this._addConflict(msg.tabId);
					break;
				}
				case 'tab-left-doc': {
					// A tab left the doc (switched away or closed).
					if (msg.docId !== this._currentDocId) return;
					this._removeConflict(msg.tabId);
					break;
				}
			}
		});

		// When the tab is closed or refreshed, announce departure so other tabs
		// can clear the conflict immediately without waiting for a timeout.
		window.addEventListener('beforeunload', () => {
			if (this._currentDocId) {
				broadcastTabLeft(this._currentDocId);
			}
		});
	}

	/**
	 * Call whenever the active document changes (including on first load).
	 * Announces departure from the old doc and arrival at the new one.
	 */
	setCurrentDoc(docId: string | null): void {
		if (docId === this._currentDocId) return;

		// Leave the old doc
		if (this._currentDocId) {
			broadcastTabLeft(this._currentDocId);
		}

		this._currentDocId = docId;
		// Reset conflicts — we'll learn about any co-viewers via acks
		this._conflictingTabs = new Set<string>();

		// Announce arrival at the new doc
		if (docId) {
			broadcastTabOpened(docId);
		}
	}

	// ── Private helpers ───────────────────────────────────────────────────────

	/** Immutably add a tab to the conflict set so Svelte tracks the change. */
	private _addConflict(tabId: string): void {
		if (this._conflictingTabs.has(tabId)) return;
		this._conflictingTabs = new Set([...this._conflictingTabs, tabId]);
	}

	/** Immutably remove a tab from the conflict set. */
	private _removeConflict(tabId: string): void {
		if (!this._conflictingTabs.has(tabId)) return;
		const next = new Set(this._conflictingTabs);
		next.delete(tabId);
		this._conflictingTabs = next;
	}
}

export const tabPresence = new TabPresence();
