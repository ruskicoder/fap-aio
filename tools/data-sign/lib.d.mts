// Types for lib.mjs, so the TypeScript tests can import the signing tool.
import type { KeyObject } from 'node:crypto'

export interface RingEntry { keyId: string; spki: string; label: 'primary' | 'backup' }
export interface ManifestFile { name: string; path: string; sha256: string; bytes: number; schema: string }
export interface Manifest { format: 1; dataVersion: number; publishedAt: string; minExtensionVersion: string; keyId: string; files: ManifestFile[] }

export const FILES: { name: string; path: string; schema: string }[]
export function encodePhrase(bytes: Uint8Array): string
export function decodePhrase(phrase: string): Buffer
export function newSecret(): Buffer
export function deriveKey(secret: Uint8Array): { privateKey: KeyObject; spki: string; keyId: string }
export function signBytes(privateKey: KeyObject, bytes: Uint8Array): string
export function verifyBytes(spkiB64: string, bytes: Uint8Array, sigB64: string): Promise<boolean>
export function readRing(file: string): RingEntry[]
export function buildSigned(o: { dir: string; secret: Uint8Array; ring: readonly RingEntry[]; currentVersion?: number; packagedVersion?: number; minExtensionVersion: string; now?: Date }): Promise<{ manifest: Manifest; bytes: Buffer; sig: string }>
export function verifyDir(dir: string, ring: readonly RingEntry[]): Promise<string[]>
