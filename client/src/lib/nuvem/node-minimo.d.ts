/**
 * Tipos MÍNIMOS dos módulos do Node que a guarda do bundle do Worker usa
 * (`pureza.test.ts`, só no vitest, nunca no app nem no Worker): o projeto não
 * tem `@types/node` e não se instala dependência sem pedir. Mesmo molde de
 * `texturas/meioTermo/moveis/node-minimo.d.ts` (o `node:fs` de lá e o daqui se
 * somam). Só as assinaturas usadas, com os tipos verdadeiros do Node.
 */
declare module 'node:child_process' {
  /** O que o `spawnSync` devolve com `encoding: 'utf8'` (o `SpawnSyncReturns<string>` do Node, só os campos lidos). */
  export interface SaidaDoSpawnSync {
    status: number | null
    stdout: string
    stderr: string
    error?: Error
  }
  export function spawnSync(comando: string, args: readonly string[], opcoes: { cwd: string; encoding: 'utf8'; timeout: number; windowsHide: boolean }): SaidaDoSpawnSync
}

declare module 'node:fs' {
  export function mkdtempSync(prefixo: string): string
  export function rmSync(caminho: string, opcoes: { recursive: boolean; force: boolean }): void
}

declare module 'node:os' {
  export function tmpdir(): string
}
