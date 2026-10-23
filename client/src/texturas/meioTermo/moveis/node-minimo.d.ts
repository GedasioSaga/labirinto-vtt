/**
 * Tipos MÍNIMOS dos dois módulos do Node que a folha de contato da MT2 usa
 * (`folhaDeContato.test.ts` e `.testkit.ts`, só no vitest, nunca no app):
 * o projeto não tem `@types/node` e não se instala dependência sem pedir. Só
 * as assinaturas usadas, com tipos verdadeiros (o `Buffer` do Node é um
 * `Uint8Array`). Nada de `process` global: o app roda no navegador.
 */
declare module 'node:fs' {
  export function writeFileSync(caminho: string, dados: Uint8Array): void
}

declare module 'node:zlib' {
  export function deflateSync(dados: Uint8Array): Uint8Array
}
