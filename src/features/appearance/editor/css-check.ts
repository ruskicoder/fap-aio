// Checking custom CSS before it applies (appearance R4.3): a scratch constructed sheet catches what the
// browser rejects outright, and csstree reports positions for the rest. Only CSS without problems is passed
// on, so the last valid CSS stays applied while the student types. Used by the theme editor page only (F-21).
import { validateCss, type CssProblem } from './csstree'

export type { CssProblem }
export type Validate = (css: string) => Promise<CssProblem[] | null>

export const validateHere: Validate = async (css) => validateCss(css)

export async function checkCss(css: string, validate: Validate = validateHere): Promise<CssProblem[]> {
  try {
    new CSSStyleSheet().replaceSync(css)
  } catch (e) {
    return [{ line: 1, column: 1, offset: 0, message: e instanceof Error ? e.message : 'The browser cannot read this CSS.' }]
  }
  return (await validate(css)) ?? []
}

/** Insertable snippets (R4.2): FAP's main parts and every theme variable. */
export const PART_SNIPPETS: readonly { label: string; text: string }[] = [
  { label: 'Cards', text: '.card {\n  \n}\n' },
  { label: 'Buttons', text: '.btn {\n  \n}\n' },
  { label: 'Tables', text: '.table {\n  \n}\n' },
  { label: 'Sidebar', text: '.leftside-menu {\n  \n}\n' },
  { label: 'Top bar', text: '.navbar-custom {\n  \n}\n' },
  { label: 'Forms', text: '.form-control,\n.form-select {\n  \n}\n' },
  { label: 'Page background', text: 'html[data-bs-theme] body {\n  \n}\n' },
]
