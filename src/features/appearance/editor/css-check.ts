// Checking custom CSS before it applies (appearance R4.3): a scratch constructed sheet catches what the
// browser rejects outright, and csstree in the service worker reports positions for the rest. Only CSS
// without problems is passed on, so the last valid CSS stays applied while the student types.
import { call } from '../../../shared/call'

export interface CssProblem { line: number; column: number; offset: number; message: string }
export type Validate = (css: string) => Promise<CssProblem[] | null>

/** Asks the service worker; null when it cannot answer (the scratch sheet still checks). */
export const validateInWorker: Validate = async (css) => {
  const r = await call<{ problems: CssProblem[] }>({ type: 'css.validate', css }).catch(() => null)
  return r && r.ok ? r.value.problems : null
}

export async function checkCss(css: string, validate: Validate = validateInWorker): Promise<CssProblem[]> {
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
