import type { Personagem } from '../personagem'
import { isTokenPhotoData } from '../tokenPhoto'
import type { Token } from '../../types/map'

/**
 * A GRADE DA ARENA DE TESTES, pura: o tamanho da casa, as grades, os lados com
 * a cor deles, onde cada ficha nasce (`tokensDaArena`), onde a ficha solta
 * encaixa e quando a casa está ocupada. Mora fora de `tipos.ts` para o site e
 * o Worker do Lobby (o treino e o duelo com a grade da Arena) poderem importar
 * sem puxar o contrato do app, que pega tipo de `.tsx` e do Pixi: o
 * `lib/nuvem/pureza.test.ts` reprova os dois no fecho, mesmo import só de tipo.
 *
 * Posições iniciais: o Lado A nas 2 colunas da esquerda, o Lado B nas 2 da
 * direita (em zigue-zague, centrados na altura), o boneco no centro-direita.
 *
 * Só importa arquivo puro: sem store, sem React, sem Pixi, sem DOM.
 */

/** Px do mundo por casa da grade da arena (o `gridSize` do desenho das fichas). */
export const CASA_DA_ARENA = 64

/** Colunas x linhas da grade da arena. */
export interface GradeDaArena {
  readonly colunas: number
  readonly linhas: number
}

export const GRADE_PEQUENA: GradeDaArena = { colunas: 12, linhas: 8 }
export const GRADE_MEDIA: GradeDaArena = { colunas: 16, linhas: 10 }

export type TamanhoDaGrade = 'pequena' | 'media'

export const GRADES_DA_ARENA: Readonly<Record<TamanhoDaGrade, GradeDaArena>> = { pequena: GRADE_PEQUENA, media: GRADE_MEDIA }

/** Prefixo do id do token gerado (`arena_tok_<n>`). */
export const PREFIXO_DO_TOKEN = 'arena_tok_'

export type LadoDaArena = 'a' | 'b'

/** As duas equipes virtuais da mesa da arena (o boneco entra na do Lado B). Cor no formato de `Equipe.cor`. */
export const EQUIPE_DO_LADO: Readonly<Record<LadoDaArena, { readonly id: string; readonly nome: string; readonly cor: string }>> = {
  a: { id: 'arena-a', nome: 'Lado A', cor: '#4a78c2' },
  b: { id: 'arena-b', nome: 'Lado B', cor: '#c2524a' },
}

const LADOS: readonly LadoDaArena[] = ['a', 'b']

/** Uma casa da grade: coluna e linha, a partir de 0. */
export interface CasaDaArena {
  col: number
  row: number
}

/** Um ponto em px do mundo. */
interface PontoNaArena {
  x: number
  y: number
}

/** O centro da casa em px do mundo (onde o token fica). */
export function centroDaCasaNaArena(casa: CasaDaArena): PontoNaArena {
  return { x: (casa.col + 0.5) * CASA_DA_ARENA, y: (casa.row + 0.5) * CASA_DA_ARENA }
}

/** Largura e altura da arena em px do mundo. */
export function limitesDaArena(grade: GradeDaArena): { largura: number; altura: number } {
  return { largura: grade.colunas * CASA_DA_ARENA, altura: grade.linhas * CASA_DA_ARENA }
}

/** A casa sob o ponto (px do mundo), sem prender na grade: fora dela dá coluna ou linha negativa ou além da última. */
export function casaSobOPonto(ponto: PontoNaArena): CasaDaArena {
  return { col: Math.floor(ponto.x / CASA_DA_ARENA), row: Math.floor(ponto.y / CASA_DA_ARENA) }
}

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

/** O centro da casa sob o ponto, preso dentro da grade: onde a ficha solta no palco encaixa. */
export function centroDaCasaSob(ponto: PontoNaArena, grade: GradeDaArena): PontoNaArena {
  const casa = casaSobOPonto(ponto)
  return centroDaCasaNaArena({
    col: limitar(casa.col, 0, Math.max(0, grade.colunas - 1)),
    row: limitar(casa.row, 0, Math.max(0, grade.linhas - 1)),
  })
}

/** Outra ficha (que não a `tokenId`) está na casa sob o ponto? Na arena não há parede nem terreno: só ficha ocupa casa. */
export function casaOcupadaNaArena(tokens: readonly Pick<Token, 'id' | 'x' | 'y'>[], tokenId: string, ponto: PontoNaArena): boolean {
  const alvo = casaSobOPonto(ponto)
  return tokens.some((outro) => {
    if (outro.id === tokenId) return false
    const casa = casaSobOPonto(outro)
    return casa.col === alvo.col && casa.row === alvo.row
  })
}

/** As casas do lado, em zigue-zague nas 2 colunas da borda (a de dentro primeiro), centradas na altura. */
export function casasDoLado(quantas: number, lado: LadoDaArena, grade: GradeDaArena): CasaDaArena[] {
  const dentro = lado === 'a' ? Math.min(1, grade.colunas - 1) : Math.max(0, grade.colunas - 2)
  const fora = lado === 'a' ? 0 : grade.colunas - 1
  const linhas = Math.ceil(quantas / 2)
  const primeira = Math.max(0, Math.floor((grade.linhas - linhas) / 2))
  const casas: CasaDaArena[] = []
  for (let i = 0; i < quantas; i += 1) {
    casas.push({ col: i % 2 === 0 ? dentro : fora, row: Math.min(grade.linhas - 1, primeira + Math.floor(i / 2)) })
  }
  return casas
}

/** As casas da borda da grade, uma volta no sentido horário a partir da quina de cima à esquerda, sem repetir quina. */
function anelDaBorda(grade: GradeDaArena): CasaDaArena[] {
  const { colunas, linhas } = grade
  if (colunas < 1 || linhas < 1) return []
  const anel: CasaDaArena[] = []
  for (let col = 0; col < colunas; col += 1) anel.push({ col, row: 0 })
  for (let row = 1; row < linhas; row += 1) anel.push({ col: colunas - 1, row })
  if (linhas > 1) for (let col = colunas - 2; col >= 0; col -= 1) anel.push({ col, row: linhas - 1 })
  if (colunas > 1) for (let row = linhas - 2; row >= 1; row -= 1) anel.push({ col: 0, row })
  return anel
}

/**
 * As largadas de N lados pelo perímetro (Arena multijogador, plano de
 * 07/11/2026 §1: mais de 2 lados nascem pela borda da grade média): a borda
 * dividida em arcos iguais, um por lado, na ordem de `quantas`; as fichas de
 * cada lado lado a lado no meio do arco dele. Lado com mais fichas que o arco
 * recebe só as casas que cabem (quem chama confere; na grade média, 12 fichas
 * em até 12 lados sempre cabem).
 */
export function casasDoPerimetro(quantas: readonly number[], grade: GradeDaArena): CasaDaArena[][] {
  const anel = anelDaBorda(grade)
  if (quantas.length === 0) return []
  const arco = Math.floor(anel.length / quantas.length)
  return quantas.map((quantasNoLado, i) => {
    const cabem = Math.max(0, Math.min(Math.floor(quantasNoLado), arco))
    const inicio = i * arco + Math.floor((arco - cabem) / 2)
    return anel.slice(inicio, inicio + cabem)
  })
}

/** O boneco: no centro-direita (2 casas à direita do meio), na linha do meio. */
export function casaDoBoneco(grade: GradeDaArena): CasaDaArena {
  return { col: Math.min(grade.colunas - 1, Math.floor(grade.colunas / 2) + 2), row: Math.floor(grade.linhas / 2) }
}

/** Uma ficha que entra na grade: a cópia e de que lado ela é. */
export interface FichaNaGrade {
  personagem: Personagem
  lado: LadoDaArena | 'boneco'
}

/** Os tokens gerados e o lado de cada um. */
export interface TokensDaArena {
  tokens: Token[]
  ladoDe: Record<string, LadoDaArena | 'boneco'>
}

/**
 * Um token por ficha, nas posições iniciais: id `arena_tok_<n>`,
 * `characterId` = a cópia, a cor do lado (o boneco na cor do Lado B), a foto
 * embutida do retrato quando houver (o retrato de mídia fica de fora: o disco
 * com a cor do lado).
 */
export function tokensDaArena(fichas: readonly FichaNaGrade[], grade: GradeDaArena): TokensDaArena {
  const doLado = (lado: LadoDaArena): FichaNaGrade[] => fichas.filter((ficha) => ficha.lado === lado)
  const casas = new Map<FichaNaGrade, CasaDaArena>()
  for (const lado of LADOS) {
    const lista = doLado(lado)
    const doLadoNaGrade = casasDoLado(lista.length, lado, grade)
    lista.forEach((ficha, i) => {
      const casa = doLadoNaGrade[i]
      if (casa !== undefined) casas.set(ficha, casa)
    })
  }
  const tokens: Token[] = []
  const ladoDe: Record<string, LadoDaArena | 'boneco'> = {}
  fichas.forEach((ficha, i) => {
    const casa = ficha.lado === 'boneco' ? casaDoBoneco(grade) : casas.get(ficha)
    if (casa === undefined) return
    const { x, y } = centroDaCasaNaArena(casa)
    const id = `${PREFIXO_DO_TOKEN}${i + 1}`
    const retrato = ficha.personagem.retrato
    tokens.push({
      id,
      characterId: ficha.personagem.id,
      name: ficha.personagem.nome,
      x,
      y,
      size: 1,
      image: null,
      imageData: isTokenPhotoData(retrato) ? retrato : null,
      color: EQUIPE_DO_LADO[ficha.lado === 'boneco' ? 'b' : ficha.lado].cor,
    })
    ladoDe[id] = ficha.lado
  })
  return { tokens, ladoDe }
}
