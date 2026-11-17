// The part of css-tree's API this project uses (the package ships no type declarations; a local
// declaration avoids another dependency).
declare module 'css-tree' {
  export interface ParseError { message?: string; formattedMessage?: string; line?: number; column?: number; offset?: number }
  export interface ParseOptions { positions?: boolean; parseValue?: boolean; onParseError?: (e: ParseError) => void }
  export function parse(source: string, options?: ParseOptions): unknown
}
