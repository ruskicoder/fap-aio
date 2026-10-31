// Export options (core R9.2 to R9.8, R9.10; rounds S1 and S3 in ui/schedule-audit.md): the schema of
// `export.prefs` v2, title presets, defaults and the v1 to v2 migration step. No runtime imports beyond
// zod, so the service worker can register the step without pulling in content code.
import { z } from 'zod'
import type { ExamType } from './types'

export const EXAM_TYPES: [ExamType, string][] = [['FE', 'FE'], ['PE', 'PE'], ['2NDFE', '2NDFE'], ['2NDPE', '2NDPE'], ['other', 'Other']]
export const DETAILS = [['room', 'Room'], ['lecturer', 'Lecturer'], ['slot', 'Slot'], ['group', 'Group'], ['attendance', 'Attendance'], ['format', 'Exam format'], ['results', 'Results date']] as const
export type Detail = (typeof DETAILS)[number][0]

export const CLASS_PIECES = [['room', 'Room'], ['code', 'Code'], ['name', 'Subject name'], ['group', 'Group'], ['slot', 'Slot'], ['lecturer', 'Lecturer'], ['time', 'Start time']] as const
export const EXAM_PIECES = [['room', 'Room'], ['type', 'Exam type'], ['code', 'Code'], ['name', 'Subject name'], ['format', 'Exam format'], ['time', 'Start time']] as const
export type ClassPiece = (typeof CLASS_PIECES)[number][0]
export type ExamPiece = (typeof EXAM_PIECES)[number][0]
export const SEPARATORS = ['-', ' - ', ' · ', ' | ', ' '] as const

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const keys = <T extends string>(list: readonly (readonly [T, string])[]) => list.map(([k]) => k) as [T, ...T[]]
const title = <T extends string>(list: readonly (readonly [T, string])[]) => z.object({ pieces: z.array(z.enum(keys(list))), sep: z.enum(SEPARATORS) })
const minutes = z.array(z.number().int().positive().max(60 * 24 * 60))
export const exportPrefsSchema = z.object({
  classes: z.boolean(),
  exams: z.boolean(),
  files: z.enum(['separate', 'one']),
  range: z.enum(['week', 'next2', 'month', 'term', 'custom']),
  from: iso.nullable(),
  to: iso.nullable(),
  classMode: z.enum(['all', 'offline', 'online']),
  excludedSubjects: z.array(z.string()),
  examTypes: z.array(z.enum(['FE', 'PE', '2NDFE', '2NDPE', 'other'])),
  examNoRoom: z.boolean(),
  examPast: z.boolean(),
  classTitle: title(CLASS_PIECES),
  examTitle: title(EXAM_PIECES),
  details: z.array(z.enum(keys(DETAILS))),
  categories: z.object({ offline: z.string().max(40), online: z.string().max(40), exam: z.string().max(40) }),
  classReminders: minutes,
  examReminders: minutes,
  remember: z.boolean(),
})
export type ExportPrefs = z.infer<typeof exportPrefsSchema>
export type ExportRange = ExportPrefs['range']
export type TitleSpec<P extends string> = { pieces: P[]; sep: (typeof SEPARATORS)[number] }

/** Title presets per kind (round S3); Custom opens the piece builder. The first is the default. Joined
 *  with `-` and no spaces, so calendar previews that cut long titles still show the code (fix F-9). */
export const CLASS_PRESETS: TitleSpec<ClassPiece>[] = [
  { pieces: ['room', 'code'], sep: '-' },
  { pieces: ['room', 'code', 'name'], sep: '-' },
  { pieces: ['code', 'room'], sep: '-' },
  { pieces: ['code', 'name'], sep: ' · ' },
  { pieces: ['code', 'group'], sep: '-' },
]
export const EXAM_PRESETS: TitleSpec<ExamPiece>[] = [
  { pieces: ['room', 'type', 'code'], sep: '-' },
  { pieces: ['room', 'type', 'code', 'name'], sep: '-' },
  { pieces: ['type', 'code', 'room'], sep: '-' },
  { pieces: ['type', 'code', 'name'], sep: ' · ' },
]
export const sameTitle = <P extends string>(a: TitleSpec<P>, b: TitleSpec<P>) => a.sep === b.sep && a.pieces.join() === b.pieces.join()

/** Defaults as agreed in rounds S1 and S3. */
export const DEFAULT_PREFS: ExportPrefs = {
  classes: true, exams: true, files: 'separate',
  range: 'term', from: null, to: null,
  classMode: 'all', excludedSubjects: [],
  examTypes: ['FE', 'PE', '2NDFE', '2NDPE'], examNoRoom: false, examPast: false,
  classTitle: CLASS_PRESETS[0]!, examTitle: EXAM_PRESETS[0]!,
  details: ['room', 'lecturer', 'slot', 'format', 'results'],
  categories: { offline: 'Class', online: 'Online class', exam: 'Exam' },
  classReminders: [15, 120, 1440], examReminders: [30, 120, 1440],
  remember: false,
}

/** Stored prefs, or the defaults when absent or unreadable. */
export const parsePrefs = (x: unknown): ExportPrefs => {
  const r = exportPrefsSchema.safeParse(x)
  return r.success ? r.data : DEFAULT_PREFS
}

/** Migration step for `export.prefs` 1 to 2 (fix F-7): one file or each, three title formats, one or two alarms. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportPrefsV1toV2(o: any): ExportPrefs {
  const titles: Record<string, TitleSpec<ClassPiece>> = {
    'code-group': { pieces: ['code', 'group'], sep: ' - ' }, 'code-name': { pieces: ['code', 'name'], sep: ' · ' }, 'name-code': { pieces: ['name', 'code'], sep: ' - ' },
  }
  const { split, title: t, classReminder, examReminders, ...rest } = o ?? {}
  return parsePrefs({
    ...DEFAULT_PREFS, ...rest,
    files: split ? 'separate' : 'one',
    classTitle: titles[t] ?? DEFAULT_PREFS.classTitle,
    examTitle: DEFAULT_PREFS.examTitle,
    classReminders: classReminder ? [classReminder] : [],
    examReminders: Array.isArray(examReminders) ? [...examReminders].sort((a, b) => a - b) : [],
    categories: DEFAULT_PREFS.categories,
  })
}
