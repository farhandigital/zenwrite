#!/usr/bin/env bun
/**
 * Post-build CSP hash injector.
 *
 * Reads build/index.html, computes SHA-256 hashes for inline <script> elements
 * (SvelteKit's bootstrap script), and injects them into script-src in build/_headers.
 *
 * style-src is handled statically in static/_headers ('unsafe-inline' covers
 * CodeMirror's runtime style injection and the app's inline style attributes).
 *
 * Writes the result into build/_headers so Cloudflare Pages picks it up.
 * The static/_headers file remains a clean, hash-free template.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const BUILD_DIR = 'build';

function sha256(content) {
	return `'sha256-${createHash('sha256').update(content).digest('base64')}'`;
}

function parseCsp(csp) {
	const map = new Map();
	for (const part of csp
		.split(';')
		.map((s) => s.trim())
		.filter(Boolean)) {
		const [name, ...values] = part.split(/\s+/);
		map.set(name, values);
	}
	return map;
}

function serializeCsp(map) {
	return `${[...map.entries()].map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k)).join('; ')};`;
}

// ─── Extract inline script hashes from index.html ───────────────────────────

const html = readFileSync(`${BUILD_DIR}/index.html`, 'utf-8');

const scriptHashes = [];
for (const match of html.matchAll(
	/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi,
)) {
	const content = match[1];
	if (content.trim()) {
		scriptHashes.push(sha256(content));
	}
}

console.log('  Inline script hashes:', scriptHashes);

// ─── Patch script-src in build/_headers ─────────────────────────────────────

let headers = readFileSync(`${BUILD_DIR}/_headers`, 'utf-8');

headers = headers.replace(
	/^(\s*Content-Security-Policy: )(.+)$/m,
	(_, prefix, rawCsp) => {
		const csp = parseCsp(rawCsp);

		if (scriptHashes.length) {
			const existing = csp.get('script-src') ?? [];
			csp.set('script-src', [...new Set([...existing, ...scriptHashes])]);
		}

		return prefix + serializeCsp(csp);
	},
);

writeFileSync(`${BUILD_DIR}/_headers`, headers);
console.log(`✓ CSP updated in ${BUILD_DIR}/_headers`);
