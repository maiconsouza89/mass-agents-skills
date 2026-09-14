export interface Printer {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
  success(message: string): void
  json(value: unknown): void
  bold(text: string): string
  dim(text: string): string
}

export function createPrinter(options: { color: boolean; json: boolean; stdout?: NodeJS.WritableStream; stderr?: NodeJS.WritableStream }): Printer {
  const out = options.stdout ?? process.stdout
  const err = options.stderr ?? process.stderr
  const paint = (code: string, text: string) => (options.color ? `[${code}m${text}[0m` : text)
  return {
    info: (message) => { if (!options.json) out.write(`${message}\n`) },
    warn: (message) => err.write(`${paint('33', 'warning')} ${message}\n`),
    error: (message) => err.write(`${paint('31', 'error')} ${message}\n`),
    success: (message) => { if (!options.json) out.write(`${paint('32', 'ok')} ${message}\n`) },
    json: (value) => out.write(`${JSON.stringify(value, null, 2)}\n`),
    bold: (text) => paint('1', text),
    dim: (text) => paint('2', text),
  }
}

export function table(rows: string[][], header?: string[]): string {
  const all = header ? [header, ...rows] : rows
  const widths: number[] = []
  for (const row of all) row.forEach((cell, index) => { widths[index] = Math.max(widths[index] ?? 0, cell.length) })
  const render = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join('  ').trimEnd()
  const lines = all.map(render)
  if (header) lines.splice(1, 0, widths.map((width) => '-'.repeat(width)).join('  '))
  return lines.join('\n')
}
