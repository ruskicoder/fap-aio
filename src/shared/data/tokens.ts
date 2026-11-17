// Search normalization shared by the index (service worker) and queries (platform design, data.search):
// Unicode NFD, combining marks removed, đ to d, lowercase.
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
}

/** Distinct normalized word tokens of a text, letters and digits only. */
export function tokenize(s: string): string[] {
  return [...new Set(normalizeText(s).split(/[^a-z0-9]+/).filter(Boolean))]
}
