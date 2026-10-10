#!/usr/bin/env node
/*
 * Normalise a raw FLM dump (flm-scraper.js output) into subject-list.json.
 *
 *   node tools/flm-scraper/build-subject-list.mjs <raw.json> [out-dir]
 *
 * Writes <out-dir>/subject-list.json (full rubric) and subject-rules.json (compact,
 * for bundling). Default out-dir: data/flm. Node 18+, no dependencies.
 * Schema: tools/flm-scraper/README.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const SCHEMA_VERSION = 1;

// Owner rules (docs/10-context/constraints.md). A syllabus value overrides these,
// except that an FE criterion is never below finalExamMin.
export const DEFAULT_RULES = {
  minAvgMarkToPass: 5,
  finalExamMin: 4,
  progressMin: { value: 0, inclusive: false },
  attendanceMinPercent: 80,
  slotMinutes: 135,
  tiers: [
    { id: 'pass', label: 'Pass', minAverage: 5 },
    { id: 'fair', label: 'Fair', minAverage: 7 },
    { id: 'good', label: 'Good', minAverage: 8 },
    { id: 'excellent', label: 'Excellent', minAverage: 9 },
  ],
};

const CODE_RE = /\b[A-Z]{2,4}\d{3}[a-z]?\b/g;
const clean = (s) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim());
const num = (s) => {
  const m = clean(s).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const bool = (s) => (typeof s === 'boolean' ? s : /^true$/i.test(clean(s)));

/** "Programming Fundamentals_Cơ sở lập trình" -> { en, vi } */
function splitName(name, english) {
  const s = clean(name);
  const i = s.indexOf('_');
  return { en: clean(english) || (i > 0 ? s.slice(0, i) : s), vi: i > 0 ? s.slice(i + 1) : '' };
}

/** "1286/QĐ-ĐHFPT dated 11/22/2024" -> { number, date: "2024-11-22" } */
function parseDecision(s) {
  const t = clean(s);
  const m = t.match(/^(.*?)\s*dated\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!m) return { number: t || null, date: null };
  return { number: m[1], date: `${m[4]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` };
}

function isoDate(s) {
  const m = clean(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

/**
 * Completion criteria cell -> { value, inclusive } (score must be > or >= value), or null.
 * Seen: ">0", "4", ">=4", "≥4", "4/10", "0", "", "5".
 */
export function parseCriterion(s) {
  const t = clean(s).replace('≥', '>=').replace(/\s/g, '');
  if (!t) return null;
  const m = t.match(/^(>=|>|=>)?(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const value = Number(m[2].replace(',', '.'));
  if (m[1] === '>') return { value, inclusive: false };
  if (value === 0 && !m[1]) return { value: 0, inclusive: false }; // a bare "0" means "not zero"
  return { value, inclusive: true };
}

/** Classify a final-exam row: FE (theory), PE (practical), presentation, other. */
function finalKind(category, type) {
  const s = `${category} ${type}`;
  if (/\b(2nd|second|resit|retake|re-?exam)\b|thi lại/i.test(s)) return 'resit';
  if (/\bPE\b|practical|thực hành/i.test(s)) return 'PE';
  if (/presentation|thuyết trình|defen[cs]e|bảo vệ|project|dự án/i.test(s)) return 'presentation';
  return 'FE';
}

// Type column decides; category is used only when the type cell is empty.
const FINAL_TYPE_RE = /final|cuối kỳ|kết thúc|^(fe|pe|te)$|defen[cs]e|bảo vệ|practical exam/i;
function classifyType(type, category) {
  const t = type.replace(/\s+/g, ' ').trim();
  if (!t) return FINAL_TYPE_RE.test(category) ? 'final' : 'ongoing';
  if (FINAL_TYPE_RE.test(t)) return 'final';
  if (/^on\s*-?\s*goi\s*n\s*g$|^ongoing$|mid\s*-?\s*term|quiz|assignment/i.test(t)) return 'ongoing';
  return 'other';
}

function headerIndex(headers, re) {
  return headers.findIndex((h) => re.test(h));
}

function parseAssessments(table) {
  if (!table || !table.rows.length) return [];
  const h = table.headers;
  const ix = {
    category: headerIndex(h, /^category/i),
    type: headerIndex(h, /^type/i),
    part: headerIndex(h, /^part/i),
    weight: headerIndex(h, /^weight/i),
    criteria: headerIndex(h, /completion/i),
    duration: headerIndex(h, /^duration/i),
    clo: headerIndex(h, /^(clo|lo)$/i),
    questionType: headerIndex(h, /question type/i),
    questions: headerIndex(h, /no question/i),
    knowledge: headerIndex(h, /knowledge/i),
    grading: headerIndex(h, /grading/i),
    note: headerIndex(h, /^note/i),
  };
  const at = (r, k) => (ix[k] >= 0 ? r[ix[k]] : '');
  return table.rows.map((r, i) => {
    const category = clean(at(r, 'category'));
    const type = clean(at(r, 'type')).replace(/\s+/g, ' ');
    const kind = classifyType(type, category);
    const isFinal = kind === 'final';
    const weightPct = num(at(r, 'weight'));
    const parts = Math.max(1, num(at(r, 'part')) || 1);
    return {
      index: i,
      category,
      type: kind,
      typeRaw: type,
      finalKind: isFinal ? finalKind(category, type) : null,
      parts,
      weight: weightPct == null ? null : +(weightPct / 100).toFixed(4),
      weightPerPart: weightPct == null ? null : +(weightPct / 100 / parts).toFixed(4),
      completion: parseCriterion(at(r, 'criteria')),
      completionRaw: clean(at(r, 'criteria')),
      duration: clean(at(r, 'duration')),
      clo: clean(at(r, 'clo')),
      questionType: clean(at(r, 'questionType')),
      questions: clean(at(r, 'questions')),
      knowledgeAndSkill: clean(at(r, 'knowledge')),
      gradingGuide: clean(at(r, 'grading')),
      note: String(at(r, 'note') ?? '').trim(),
      parentIndex: null,
    };
  });
}

/** Length of the common case-insensitive prefix of two labels. */
function similarity(a, b) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return i;
}

/**
 * Some syllabi list an aggregate row and then its parts as extra rows (JPD113:
 * "Thi cuối kỳ" 2 parts 45% = 15% + 30%; CHI111: 3 parts 40% = 15% + 15% + 10%).
 * An aggregate is a row whose part count and weight equal the sums over a subset of
 * other rows of the same type. Those rows get parentIndex so the counted weights sum to 100.
 */
function linkSubcomponents(list) {
  const total = list.reduce((s, a) => s + (a.weight || 0), 0);
  if (total <= 1.0001) return;
  const counted = () => list.filter((a) => a.parentIndex == null).reduce((s, a) => s + (a.weight || 0), 0);
  const parents = list.filter((a) => a.parts > 1 && a.weight).sort((a, b) => b.weight - a.weight);
  for (const parent of parents) {
    if (counted() <= 1.0001) break;
    if (parent.parentIndex != null) continue;
    // Final-exam parts are often named by skill only ("Nghe", "Viết"); other parts must share a name prefix.
    const pool = list.filter((a) => a !== parent && a.parentIndex == null && a.type === parent.type && a.weight && !list.some((b) => b.parentIndex === a.index) && (parent.type === 'final' || similarity(a.category, parent.category) >= 4));
    if (pool.length > 14) continue;
    let best = null;
    let bestScore = -1;
    for (let mask = 1; mask < 1 << pool.length; mask++) {
      const pick = pool.filter((_, i) => mask & (1 << i));
      const w = pick.reduce((s, a) => s + a.weight, 0);
      const n = pick.reduce((s, a) => s + a.parts, 0);
      // Never link below 100%: that would hide real components.
      if (n !== parent.parts || Math.abs(w - parent.weight) >= 0.0005 || counted() - w < 0.9995) continue;
      const score = pick.reduce((s, a) => s + similarity(a.category, parent.category), 0) / pick.length;
      if (score > bestScore || (score === bestScore && pick.length < best.length)) {
        best = pick;
        bestScore = score;
      }
    }
    if (best) best.forEach((k) => (k.parentIndex = parent.index));
  }
}

function parseMaterials(table) {
  if (!table) return [];
  const h = table.headers;
  const g = (r, re) => {
    const i = headerIndex(h, re);
    return i >= 0 ? r[i] : '';
  };
  return table.rows.map((r) => ({
    description: clean(g(r, /description/i)),
    author: clean(g(r, /author/i)),
    publisher: clean(g(r, /publisher/i)),
    published: clean(g(r, /published/i)),
    edition: clean(g(r, /edition/i)),
    isbn: clean(g(r, /isbn/i)),
    isMain: bool(g(r, /main/i)),
    isHardCopy: bool(g(r, /hard/i)),
    isOnline: bool(g(r, /online/i)),
    note: clean(g(r, /^note/i)),
  }));
}

function parseClos(table) {
  if (!table) return [];
  return table.rows.map((r) => ({ id: clean(r[1]), details: String(r[2] ?? '').trim() }));
}

/** Contact hours from "Study hour (150h) = 45h contact hours + ..." (English or Vietnamese). */
function contactHours(s) {
  const t = clean(s);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*h(?:ours?)?\s*(?:contact|of contact|on[- ]?class|in[- ]?class|offline)/i) || t.match(/(\d+(?:[.,]\d+)?)\s*giờ\s*(?:trên lớp|tiếp xúc)/i);
  return m ? Number(m[1].replace(',', '.')) : null;
}

const COURSERA_RE = /coursera|\bMOOC\b|specialization/i;

const MANDATORY_RE = /\bmust\b|required|have to|has to|in order to|to be (accepted|allowed|eligible|graded)|prior to|before the final|condition|điều kiện|bắt buộc|phải|certificat|chứng chỉ/i;
const BONUS_RE = /bonus|plus \d|\+\s?\d(\.\d)? ?point|cộng/i;

/**
 * Coursera / MOOC requirement from StudentTasks, Note and assessment text.
 * mentioned: the syllabus refers to Coursera or a MOOC; required: mandatory wording
 * near the mention, or the subject is assessed only by Coursera-specialization finals;
 * bonus: the mention grants bonus points.
 */
function detectCoursera(code, texts, categories = []) {
  const evidence = [];
  for (const t of texts) {
    if (!t) continue;
    const re = new RegExp(COURSERA_RE.source, 'gi');
    let m;
    while ((m = re.exec(t))) evidence.push(clean(t.slice(Math.max(0, m.index - 160), m.index + 160)));
  }
  const mentioned = evidence.length > 0;
  return {
    mentioned,
    // A "c" subject whose finals come from the specialization is a Coursera subject (owner rule).
    required: evidence.some((e) => MANDATORY_RE.test(e)) || categories.some((c) => COURSERA_RE.test(c)) || (/\dc$/.test(code) && mentioned),
    bonus: evidence.some((e) => BONUS_RE.test(e)),
    suffixC: /\dc$/.test(code),
    evidence: [...new Set(evidence)].slice(0, 3),
  };
}

/**
 * Minimum attendance from StudentTasks. "attend at least 80% ..." gives 80; an absence
 * phrasing ("misses 20% classes will fail", "vắng quá 20%") gives 100 - X.
 */
function attendance(studentTasks) {
  const t = clean(studentTasks);
  const absent = t.match(/(miss(?:es)?|absen\w*|vắng)[^.%]{0,30}?(\d{1,3})\s*%/i) || t.match(/(\d{1,3})\s*%[^.]{0,20}?(absen\w*|vắng)/i);
  if (absent) {
    const x = Number(/^\d/.test(absent[1]) ? absent[1] : absent[2]);
    return { minPercent: 100 - x, source: 'syllabus', evidence: absent[0] };
  }
  const m = t.match(/(\d{2,3})\s*%[^.]{0,80}?(contact|session|slot|class|attend|giờ học|buổi)/i) || t.match(/(attend|tham dự|có mặt)[^.]{0,40}?(\d{2,3})\s*%/i);
  if (!m) return { minPercent: DEFAULT_RULES.attendanceMinPercent, source: 'default', evidence: '' };
  return { minPercent: Number(/^\d/.test(m[1]) ? m[1] : m[2]), source: 'syllabus', evidence: m[0] };
}

export function normaliseSyllabus(raw) {
  const d = raw.detail || {};
  const t = raw.tables || {};
  const code = clean(d['Subject Code'] || raw.list.code);
  const assessments = parseAssessments(t.gvAssessment);
  linkSubcomponents(assessments);
  const counted = assessments.filter((a) => a.parentIndex == null);
  const weightSum = +counted.reduce((s, a) => s + (a.weight || 0), 0).toFixed(4);
  const scored = bool(d['Is Scored']);
  const notes = [d['StudentTasks'], d['Note'], ...assessments.map((a) => a.note), ...assessments.map((a) => a.category)];
  const prereqRaw = clean(d['Pre-Requisite']);
  const flags = [];
  if (scored && !assessments.length) flags.push('no-assessment');
  if (scored && assessments.length && Math.abs(weightSum - 1) > 0.001) flags.push('weights-not-100');
  if (assessments.some((a) => a.parentIndex != null)) flags.push('has-subcomponents');
  if (assessments.some((a) => a.completionRaw && !a.completion)) flags.push('unparsed-criterion');
  if (assessments.some((a) => a.completion && a.completion.value > 5 && a.type !== 'final')) flags.push('criterion-suspect');
  if (assessments.some((a) => a.type === 'other')) flags.push('type-unclassified');
  if (assessments.some((a) => /on- ?goin g|Assignm ent|Checkp oint/.test(a.typeRaw + a.category))) flags.push('pdf-artifacts');

  return {
    code,
    sylId: Number(raw.sylId),
    name: splitName(d['Syllabus Name'] || raw.list.subjectName, d['Course Name English']),
    credits: num(d['NoCredit']),
    degreeLevel: clean(d['Degree Level']) || null,
    method: clean(d['Learning-Teaching Method']) || null,
    prerequisites: { raw: /^(none|không|n\/a|-)?$/i.test(prereqRaw) ? '' : prereqRaw, codes: [...new Set(prereqRaw.match(CODE_RE) || [])] },
    scored,
    scoringScale: num(d['Scoring Scale']),
    minAvgMarkToPass: num(d['MinAvgMarkToPass']) ?? (scored ? DEFAULT_RULES.minAvgMarkToPass : null),
    decision: parseDecision(d['DecisionNo MM/dd/yyyy'] || raw.list.decision),
    approvedDate: isoDate(d['ApprovedDate']),
    isActive: bool(d['IsActive'] ?? raw.list.isActive),
    isApproved: bool(d['IsApproved'] ?? raw.list.isApproved),
    timeAllocation: clean(d['Time Allocation']),
    contactHours: contactHours(d['Time Allocation']),
    syllabusSessions: t.gvSchedule ? t.gvSchedule.rows.length : 0,
    attendance: attendance(d['StudentTasks']),
    hasFinal: assessments.some((a) => a.type === 'final'),
    coursera: detectCoursera(code, notes.map((x) => String(x || '')), assessments.map((a) => a.category)),
    assessments,
    weightSum,
    flags,
    materials: parseMaterials(t.gvMaterial),
    clos: parseClos(t.gvLO),
    description: String(d['Description'] || '').trim(),
    studentTasks: String(d['StudentTasks'] || '').trim(),
    tools: String(d['Tools'] || '').trim(),
    note: String(d['Note'] || '').trim(),
  };
}

export function build(rawDump) {
  const subjects = {};
  const errors = [];
  for (const raw of rawDump.syllabi) {
    if (raw.error) {
      errors.push({ sylId: raw.sylId, code: raw.list?.code, error: raw.error });
      continue;
    }
    const s = normaliseSyllabus(raw);
    // One active syllabus per code is expected; keep the most recently approved if not.
    const prev = subjects[s.code];
    if (!prev || (s.approvedDate || '') > (prev.approvedDate || '')) subjects[s.code] = s;
  }
  const codes = Object.keys(subjects).sort();
  const sorted = Object.fromEntries(codes.map((c) => [c, subjects[c]]));
  const flagCounts = {};
  for (const s of Object.values(sorted)) for (const f of s.flags) flagCounts[f] = (flagCounts[f] || 0) + 1;
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: { site: rawDump.meta?.source || 'https://flm.fpt.edu.vn', scrapedAt: rawDump.meta?.finishedAt || null, tool: 'tools/flm-scraper' },
    rules: DEFAULT_RULES,
    stats: {
      subjects: codes.length,
      scored: Object.values(sorted).filter((s) => s.scored).length,
      withFinal: Object.values(sorted).filter((s) => s.hasFinal).length,
      courseraMentioned: Object.values(sorted).filter((s) => s.coursera.mentioned).length,
      courseraRequired: Object.values(sorted).filter((s) => s.coursera.required).length,
      flags: flagCounts,
      scrapeErrors: errors.length,
    },
    errors,
    subjects: sorted,
  };
}

/**
 * Compact projection for bundling in the extension: only what the predictor and the
 * goal UI need. Long text (descriptions, CLOs, materials, grading guides) stays in the full list.
 */
export function compact(full) {
  const pick = (s) => ({
    code: s.code,
    name: s.name.en,
    credits: s.credits,
    scored: s.scored,
    scoringScale: s.scoringScale,
    minAvgMarkToPass: s.minAvgMarkToPass,
    prerequisites: s.prerequisites.codes,
    attendance: s.attendance,
    coursera: { required: s.coursera.required, bonus: s.coursera.bonus },
    hasFinal: s.hasFinal,
    assessments: s.assessments.map((a) => ({ index: a.index, category: a.category, type: a.type, finalKind: a.finalKind, parts: a.parts, weight: a.weight, weightPerPart: a.weightPerPart, completion: a.completion, parentIndex: a.parentIndex })),
    weightSum: s.weightSum,
    flags: s.flags,
    sylId: s.sylId,
  });
  return { schemaVersion: full.schemaVersion, kind: 'compact', generatedAt: full.generatedAt, source: full.source, rules: full.rules, subjects: Object.fromEntries(Object.entries(full.subjects).map(([k, v]) => [k, pick(v)])) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [inPath, outDir = 'data/flm'] = process.argv.slice(2);
  if (!inPath) {
    console.error('usage: build-subject-list.mjs <raw.json> [out-dir]');
    process.exit(2);
  }
  const out = build(JSON.parse(readFileSync(inPath, 'utf8')));
  mkdirSync(resolve(outDir), { recursive: true });
  writeFileSync(`${outDir}/subject-list.json`, JSON.stringify(out, null, 1) + '\n');
  writeFileSync(`${outDir}/subject-rules.json`, JSON.stringify(compact(out)) + '\n');
  console.log(`wrote ${outDir}/subject-list.json and subject-rules.json: ${out.stats.subjects} subjects, ${out.stats.scored} scored, flags ${JSON.stringify(out.stats.flags)}, errors ${out.stats.scrapeErrors}`);
}
