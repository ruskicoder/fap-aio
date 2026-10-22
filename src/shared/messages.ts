// The only definition of runtime messages between content scripts, the service worker and
// extension pages (platform design, "Messaging contract"). Protocol version 1.
import { z } from 'zod'

export const PROTOCOL_VERSION = 1

const v = z.literal(PROTOCOL_VERSION)
const msg = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) =>
  z.object({ v, type: z.literal(type), ...shape }).strict()

const perm = z.enum(['notifications', 'flm'])

export const AlertSummarySchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    title: z.string(),
    detail: z.string().optional(),
  })
  .strict()
export type AlertSummary = z.infer<typeof AlertSummarySchema>

export const MsgSchema = z.discriminatedUnion('type', [
  // content script -> service worker
  msg('tab-ready', { path: z.string() }),
  msg('tab-focus', {}),
  msg('budget.acquire', { priority: z.enum(['user', 'background']), source: z.string() }),
  msg('budget.release', { grantId: z.string(), outcome: z.enum(['ok', 'error', 'challenge']) }),
  msg('perm.request', { perm, reason: z.string() }),
  msg('notify', { alert: AlertSummarySchema }),
  msg('data.rules', { codes: z.array(z.string()) }),
  msg('data.subject', { code: z.string() }),
  msg('data.search', { q: z.string(), limit: z.number().int().positive() }),
  msg('data.file', { name: z.literal('news-rules.json') }),
  msg('data.status', {}),
  msg('data.check', {}),
  msg('data.usePackaged', {}),
  msg('data.clearCaches', {}),
  msg('flm.refresh', { code: z.string() }),
  msg('flm.parsed', {
    jobId: z.string(),
    result: z.union([z.record(z.unknown()), z.object({ error: z.string() }).strict()]),
  }),
  msg('commands.list', {}),
  msg('diagnostics', {}),
  // extension page -> service worker
  msg('perm.result', { perm, granted: z.boolean() }),
  // service worker -> content script
  msg('panel.toggle', {}),
  msg('timer.run', { job: z.enum(['bg-refresh', 'keepalive']) }),
  msg('reads.stop', { reason: z.literal('challenge') }),
  msg('reads.resume', {}),
  msg('data.progress', {
    state: z.enum(['syncing', 'idle']),
    version: z.number().nullable(),
    skipped: z.string().optional(),
  }),
  msg('flm.parse', { jobId: z.string(), html: z.string(), code: z.string() }),
])

export type Msg = z.infer<typeof MsgSchema>
export type MsgType = Msg['type']
export type MsgOf<T extends MsgType> = Extract<Msg, { type: T }>
/** A message without the protocol field, as callers write it. */
export type Outgoing<T extends MsgType = MsgType> = T extends MsgType ? Omit<MsgOf<T>, 'v'> : never

export const MSG_TYPES = MsgSchema.options.map((o) => o.shape.type.value) as MsgType[]

export type ReplyError = { kind: string; detail?: string }
export type Reply<T> = { ok: true; value: T } | { ok: false; error: ReplyError }

export const DEFAULT_TIMEOUT_MS = 10_000
/** Stated longer limits (platform R2.5). */
export const TIMEOUTS: Partial<Record<MsgType, number>> = {
  'perm.request': 120_000,
  'flm.refresh': 60_000,
}
export const timeoutFor = (type: MsgType) => TIMEOUTS[type] ?? DEFAULT_TIMEOUT_MS

export function parseMsg(raw: unknown): Msg | null {
  const r = MsgSchema.safeParse(raw)
  return r.success ? r.data : null
}

export const ok = <T>(value: T): Reply<T> => ({ ok: true, value })
export const fail = (kind: string, detail?: string): Reply<never> => ({
  ok: false,
  error: detail === undefined ? { kind } : { kind, detail },
})
