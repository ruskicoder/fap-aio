// Public keys that may sign the data channel (platform R5.3, R5.9; design, "Keys and signing"). The owner
// fills this ring in gate G-DATA-KEYS with the primary and backup keys printed by
// `node tools/data-sign/sign.mjs keygen`; private keys and recovery phrases never enter the repository.
// An empty ring means no channel data is accepted, which is the safe default before the keys exist.

export interface RingKey {
  /** First 8 bytes of SHA-256 over the SPKI, hex. */
  keyId: string
  /** P-256 public key, SPKI DER in base64. */
  spki: string
  label: 'primary' | 'backup'
}

export const KEYRING: readonly RingKey[] = [
]
