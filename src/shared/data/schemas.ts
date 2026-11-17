// Schemas of the packaged and channel data files (platform R5.4, R7.4). Every file is untrusted input:
// it is parsed and validated here before it is indexed. A schema id is `<file>@<major>`.
import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/)
const threshold = z.object({ value: z.number(), inclusive: z.boolean() })
/** A regular expression source from a data file; it must compile. */
const pattern = z.string().refine((s) => {
  try { new RegExp(s); return true } catch { return false }
}, 'invalid regular expression')

const globalRules = z.object({
  minAvgMarkToPass: z.number(),
  finalExamMin: z.number(),
  progressMin: threshold,
  attendanceMinPercent: z.number(),
  slotMinutes: z.number(),
  tiers: z.array(z.object({ id: z.string(), label: z.string(), minAverage: z.number() })),
})

const source = z.object({ site: z.string(), scrapedAt: z.string(), tool: z.string() })

const assessment = z.object({
  index: z.number().int(),
  category: z.string(),
  type: z.enum(['ongoing', 'final', 'other']),
  finalKind: z.string().nullable(),
  parts: z.number(),
  weight: z.number(),
  weightPerPart: z.number(),
  completion: threshold.nullable(),
  parentIndex: z.number().int().nullable(),
})

const attendance = z.object({ minPercent: z.number(), source: z.string(), evidence: z.string() })

/** Compact rubric entry: what the grade engines need for one subject. */
export const subjectRule = z.object({
  code: z.string().min(1),
  name: z.string(),
  credits: z.number(),
  scored: z.boolean(),
  scoringScale: z.number().nullable(),
  minAvgMarkToPass: z.number().nullable(),
  prerequisites: z.array(z.string()),
  attendance,
  coursera: z.object({ required: z.boolean(), bonus: z.boolean() }),
  hasFinal: z.boolean(),
  assessments: z.array(assessment),
  weightSum: z.number(),
  flags: z.array(z.string()),
  sylId: z.number().int(),
})
export type SubjectRule = z.infer<typeof subjectRule>

const keyedByCode = <T extends z.ZodTypeAny>(entry: T) =>
  z.record(z.string(), entry).refine(
    (rec) => Object.entries(rec).every(([k, v]) => (v as { code: string }).code === k),
    'subject key differs from its code',
  )

export const subjectRulesFile = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('compact'),
  generatedAt: z.string(),
  source,
  rules: globalRules,
  subjects: keyedByCode(subjectRule),
})
export type SubjectRulesFile = z.infer<typeof subjectRulesFile>

/** Full syllabus entry. Text fields beyond the ones typed here are kept as they are. */
export const subjectFull = z.object({
  code: z.string().min(1),
  sylId: z.number().int(),
  name: z.object({ en: z.string(), vi: z.string() }),
  credits: z.number(),
  prerequisites: z.object({ raw: z.string(), codes: z.array(z.string()) }),
  scored: z.boolean(),
  scoringScale: z.number().nullable(),
  minAvgMarkToPass: z.number().nullable(),
  decision: z.object({ number: z.string().nullable(), date: z.string().nullable() }),
  approvedDate: isoDate.nullable(),
  isActive: z.boolean(),
  isApproved: z.boolean(),
  attendance,
  hasFinal: z.boolean(),
  coursera: z.object({ mentioned: z.boolean(), required: z.boolean(), bonus: z.boolean(), suffixC: z.boolean(), evidence: z.array(z.unknown()) }),
  assessments: z.array(assessment.passthrough()),
  weightSum: z.number(),
  flags: z.array(z.string()),
}).passthrough()
export type SubjectFull = z.infer<typeof subjectFull>

export const subjectListFile = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  source,
  rules: globalRules,
  subjects: keyedByCode(subjectFull),
}).passthrough()
export type SubjectListFile = z.infer<typeof subjectListFile>

export const newsRulesFile = z.object({
  schemaVersion: z.literal(1),
  source: z.string(),
  normalize: z.string(),
  tags: z.array(z.object({ id: z.string(), label: z.string(), match: pattern })),
  flags: z.array(z.object({ id: z.string(), match: pattern, boost: z.number() })),
  families: z.array(z.object({ id: z.string(), priority: z.string(), label: z.string(), match: pattern })),
  term: z.record(z.string(), pattern),
  deadline: z.array(pattern),
  personalize: z.object({ subjectCode: pattern, rules: z.array(z.string()) }),
  dedupe: z.string(),
})
export type NewsRulesFile = z.infer<typeof newsRulesFile>

export const DATA_SCHEMAS = {
  'subject-rules@1': subjectRulesFile,
  'subject-list@1': subjectListFile,
  'news-rules@1': newsRulesFile,
} as const
export type SchemaId = keyof typeof DATA_SCHEMAS

export const DATA_FILE_NAMES = ['subject-rules.json', 'subject-list.json', 'news-rules.json'] as const
export type DataFileName = (typeof DATA_FILE_NAMES)[number]

/** True when the schema id names a supported major version (platform R5.4). */
export function isSupportedSchema(id: string): id is SchemaId {
  return Object.prototype.hasOwnProperty.call(DATA_SCHEMAS, id)
}

/** The unsigned manifest shipped in the package; the channel manifest adds `keyId` and a signature (PLT-7). */
export const dataManifest = z.object({
  format: z.literal(1),
  dataVersion: z.number().int().positive(),
  publishedAt: z.string().optional(),
  minExtensionVersion: z.string().optional(),
  keyId: z.string().optional(),
  files: z.array(z.object({
    name: z.enum(DATA_FILE_NAMES),
    path: z.string().regex(/^[a-z]+\/[a-z-]+\.json$/),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    bytes: z.number().int().nonnegative(),
    schema: z.string(),
  })),
})
export type DataManifest = z.infer<typeof dataManifest>
