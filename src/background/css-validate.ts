// CSS editor validation (appearance R4.3; design, "CSS editor"): csstree parses the user's CSS in the
// service worker, so the parser stays out of FAP pages and off their main thread, and reports each syntax
// error with its line and column. Browsers drop invalid rules silently, which is why this check exists.
import { parse } from 'css-tree'
import { ok, register } from './router'

export interface CssProblem { line: number; column: number; offset: number; message: string }

export function validateCss(css: string): CssProblem[] {
  const out: CssProblem[] = []
  try {
    parse(css, {
      positions: true,
      parseValue: false,
      onParseError: (e: { line?: number; column?: number; offset?: number; message?: string; formattedMessage?: string }) => {
        if (out.length < 50) out.push({ line: e.line ?? 1, column: e.column ?? 1, offset: e.offset ?? 0, message: (e.message ?? 'Syntax error').replace(/\s+/g, ' ').trim() })
      },
    })
  } catch (e) {
    out.push({ line: 1, column: 1, offset: 0, message: e instanceof Error ? e.message : String(e) })
  }
  return out
}

export function installCssValidate(): void {
  register('css.validate', async (m) => ok({ problems: validateCss(m.css) }))
}
