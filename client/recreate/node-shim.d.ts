// O projeto não instala @types/node; o harness de recriação (que roda no
// Node do Playwright) só precisa destas quatro coisas, declaradas à mão.
declare module 'node:fs' {
  export function readFileSync(path: string): { toString(encoding: 'base64'): string }
  export function writeFileSync(path: string, data: string | Uint8Array): void
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void
}

declare module 'node:path' {
  export function resolve(...parts: string[]): string
}

declare const process: { cwd(): string; env: Record<string, string | undefined> }

declare const Buffer: { from(data: string, encoding: 'base64'): Uint8Array }
