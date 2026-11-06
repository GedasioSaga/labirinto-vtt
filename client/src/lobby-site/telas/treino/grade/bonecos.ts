import { CASA_DA_ARENA, type CasaDaArena, type GradeDaArena, type LadoDaArena } from '../../../../lib/arena/grade'

/**
 * OS BONECOS NA GRADE DA ARENA (fatia G2): o que a grade do site desenha de
 * cada ficha e as contas de casa que ela faz antes de pedir para andar. A
 * grade só mostra e pede; a regra (de quem é a vez, o MOV, o contra-ataque)
 * é de quem liga a grade à luta. Sem React, sem DOM.
 */

export interface BonecoNaGrade {
  tokenId: string
  nome: string
  lado: LadoDaArena
  casa: CasaDaArena
  /** A imagem da ficha como ela guarda (`data:` embutida ou `midia:`); `null` = as iniciais no disco. */
  retrato: string | null
  /** A parte da Vida que resta, de 0 a 1; `null` = sem barra. */
  vida: number | null
  naVez: boolean
  caiu: boolean
  /** Quem olha pode pegar esta ficha. A grade não decide a regra: só não deixa pegar a que não pode. */
  podeAndar: boolean
}

/** O que a casa de destino é para a ficha que anda: livre, de outra ficha, ou a mesma de onde ela saiu. */
export type SituacaoDaCasa = 'livre' | 'ocupada' | 'mesma'

const LETRAS_DAS_COLUNAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** "C5": a coluna em letra e a linha em número, como se lê um tabuleiro. */
export function rotuloDaCasa(casa: CasaDaArena): string {
  return `${LETRAS_DAS_COLUNAS[casa.col] ?? String(casa.col + 1)}${casa.row + 1}`
}

export function mesmaCasa(a: CasaDaArena, b: CasaDaArena): boolean {
  return a.col === b.col && a.row === b.row
}

/** A casa está dentro da grade? */
export function dentroDaGrade(casa: CasaDaArena, grade: GradeDaArena): boolean {
  return Number.isInteger(casa.col) && Number.isInteger(casa.row) && casa.col >= 0 && casa.row >= 0 && casa.col < grade.colunas && casa.row < grade.linhas
}

/** A casa sob o ponto (px da grade, sem a escala), presa dentro dela: a ficha solta fora encaixa na borda, como na Arena do app. */
export function casaPresaSob(x: number, y: number, grade: GradeDaArena): CasaDaArena {
  const col = Math.min(grade.colunas - 1, Math.max(0, Math.floor(x / CASA_DA_ARENA)))
  const row = Math.min(grade.linhas - 1, Math.max(0, Math.floor(y / CASA_DA_ARENA)))
  return { col, row }
}

/** Para onde a ficha `tokenId` quer ir: livre, ocupada por outra (a regra recusa) ou a mesma casa (não é passo). */
export function situacaoDaCasa(bonecos: readonly BonecoNaGrade[], tokenId: string, destino: CasaDaArena): SituacaoDaCasa {
  const quem = bonecos.find((boneco) => boneco.tokenId === tokenId)
  if (quem !== undefined && mesmaCasa(quem.casa, destino)) return 'mesma'
  return bonecos.some((boneco) => boneco.tokenId !== tokenId && mesmaCasa(boneco.casa, destino)) ? 'ocupada' : 'livre'
}

const PASSO_DA_SETA: Readonly<Record<string, CasaDaArena>> = {
  ArrowUp: { col: 0, row: -1 },
  ArrowDown: { col: 0, row: 1 },
  ArrowLeft: { col: -1, row: 0 },
  ArrowRight: { col: 1, row: 0 },
}

/** A casa vizinha pela seta; `null` = a tecla não é seta. Pode cair fora da grade (quem chama confere). */
export function casaPelaSeta(casa: CasaDaArena, tecla: string): CasaDaArena | null {
  const passo = Object.hasOwn(PASSO_DA_SETA, tecla) ? PASSO_DA_SETA[tecla] : undefined
  return passo === undefined ? null : { col: casa.col + passo.col, row: casa.row + passo.row }
}

/** As iniciais do disco sem retrato: "Recruta da Marinha" vira "RM", "Sora" vira "S". */
export function iniciaisDoNome(nome: string): string {
  const palavras = nome
    .trim()
    .split(/\s+/)
    .filter((palavra) => palavra.length > 2 || /^\p{Lu}/u.test(palavra))
  const primeira = palavras[0]?.[0] ?? nome.trim()[0] ?? '?'
  const ultima = palavras.length > 1 ? (palavras[palavras.length - 1]?.[0] ?? '') : ''
  return `${primeira}${ultima}`.toUpperCase()
}
