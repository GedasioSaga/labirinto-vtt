/**
 * PALETA do Meio-Termo: as 38 cores base do protótipo aprovado
 * (`docs/design/vila-meio-termo/prototipo/meio.js:36-80`, bloco PALETA; a
 * tabela do `README.md` da mesma pasta confere). Realce, sombra e contorno
 * das peças saem destas cores; só o chão traz realce e sombra prontos.
 *
 * Nada aqui desenha: os pintores das fatias seguintes leem a paleta.
 */

export interface TomDaPaleta {
  /** `#rrggbb` minúsculo. */
  readonly base: string
  readonly realce?: string
  readonly sombra?: string
}

export const PALETA_MEIO_TERMO = {
  // chão: entre o oliva escuro da Textura e o menta do Estilo Mother
  grama: { base: '#8cbf80', realce: '#a2cc92', sombra: '#76ac6d' },
  terra: { base: '#dda56c', realce: '#e7b882', sombra: '#c78d58' },
  praca: { base: '#dcd0b6', realce: '#ebe2cd', sombra: '#bcae94' },
  barranco: { base: '#aa745c', realce: '#c28b71', sombra: '#915f4a' },
  // flores, frutas e o fogo
  rosa: { base: '#e8a2c4' },
  amarelo: { base: '#f0d266' },
  violeta: { base: '#a87fcb' },
  branco: { base: '#f3efe2' },
  laranja: { base: '#e6793f' },
  fogo: { base: '#e39446' },
  // do Estilo Mother: madeira das placas e da jardineira, pedra das lajes, copas
  madeiraClara: { base: '#e2b98a' },
  madeira: { base: '#b9895f' },
  madeiraEscura: { base: '#8d6239' },
  reboco: { base: '#efe7cf' },
  pedra: { base: '#c3c0b2' },
  metal: { base: '#767a77' },
  folha: { base: '#55ae74' },
  folhaEscura: { base: '#469a63' },
  palha: { base: '#d6b56a' },
  ardosia: { base: '#5f6a66' },
  // telhados do app, no meio do caminho entre as cores da Textura e as do Estilo Mother
  telhaAzul: { base: '#43639a' },
  telhaAzulClara: { base: '#7189a6' },
  telhaMadeira: { base: '#867a6a' },
  telhaTerracota: { base: '#b56e50' },
  telhaVerde: { base: '#7f9a64' },
  // os materiais da Textura, mais claros e quentes para conviver com o chão
  carvalho: { base: '#a07b51' },
  nogueira: { base: '#775739' },
  pinho: { base: '#b9995f' },
  ferro: { base: '#5d6164' },
  latao: { base: '#b89552' },
  linho: { base: '#d4c7a5' },
  vinho: { base: '#8f4a49' },
  musgo: { base: '#6f7d4b' },
  ocre: { base: '#b2904f' },
  granito: { base: '#9a968b' },
  corda: { base: '#b49c6d' },
  lenha: { base: '#6e5745' },
  agua: { base: '#40707e' },
} as const satisfies Record<string, TomDaPaleta>

export type TokenDaPaleta = keyof typeof PALETA_MEIO_TERMO

function tokensDe<T extends object>(registro: T): readonly (keyof T)[] {
  const tokens: (keyof T)[] = []
  for (const token in registro) tokens.push(token)
  return tokens
}

/** Os 38 nomes, na ordem do protótipo. */
export const TOKENS_DA_PALETA: readonly TokenDaPaleta[] = tokensDe(PALETA_MEIO_TERMO)
