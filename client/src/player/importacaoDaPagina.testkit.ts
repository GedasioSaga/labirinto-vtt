/*
 * Prazo dos testes da página do jogador (main.*.test.tsx) que importam a
 * página inteira: `boot.tsx`, `main.tsx` ou `TableScreen.tsx`.
 */

/**
 * A primeira importação, a frio, transforma a página inteira: `boot.tsx` puxa
 * uns 770 arquivos (main.tsx, hostSession.ts, o livro do DBT) e leva de 12 a
 * 14 s sozinha, mais com a máquina disputada. Isso passa dos 10 s do
 * `beforeAll` e dos 5 s do `it` padrão do vitest, e o arquivo ficava vermelho
 * ou verde conforme a ordem e o cache. Vai no hook ou no `it` que faz o
 * import; as importações seguintes do mesmo arquivo já acham tudo transformado.
 */
export const PRAZO_DA_IMPORTACAO_MS = 60_000
