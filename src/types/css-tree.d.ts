// The part of css-tree's API this project uses (the package ships no type declarations; a local
// declaration avoids another dependency).
declare module 'css-tree' {
  export interface ParseError { message?: string; formattedMessage?: string; line?: number; column?: number; offset?: number }
  export interface ParseOptions { positions?: boolean; parseValue?: boolean; parseCustomProperty?: boolean; onParseError?: (e: ParseError) => void }
  export interface CssNode { type: string; name?: string; value?: string; loc?: { start: { offset: number }; end: { offset: number } } | null }
  export function walk(ast: unknown, fn: (node: CssNode) => void): void
  export function parse(source: string, options?: ParseOptions): unknown
}
