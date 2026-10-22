// Diagnostic counters (platform R2.3, R7.3): counts only, never message content.
const KEY = 'diag.counters'
let chain: Promise<void> = Promise.resolve()

export function count(name: string, by = 1): Promise<void> {
  chain = chain.then(async () => {
    const got = (await chrome.storage.local.get(KEY))[KEY] as { schemaVersion: 1; updatedAt: number; data: Record<string, number> } | undefined
    const data = { ...(got?.data ?? {}) }
    data[name] = (data[name] ?? 0) + by
    await chrome.storage.local.set({ [KEY]: { schemaVersion: 1, updatedAt: Date.now(), data } })
  }).catch(() => {})
  return chain
}

export async function readCounters(): Promise<Record<string, number>> {
  await chain
  const got = (await chrome.storage.local.get(KEY))[KEY] as { data?: Record<string, number> } | undefined
  return got?.data ?? {}
}
