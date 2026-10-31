import { judgeInicial, type JudgeNaCena } from '../batalha/judge'
import type { Personagem } from '../personagem'
import { isTokenPhotoData } from '../tokenPhoto'
import type { Token } from '../../types/map'
import { vezesValidas } from './copias'
import {
  CASA_DA_ARENA,
  EQUIPE_DO_LADO,
  FICHAS_POR_LADO_MAX,
  PREFIXO_DO_TOKEN,
  type GradeDaArena,
  type LadoDaArena,
  type ModoDaArena,
  type MontagemDaArena,
} from './tipos'

/**
 * A MONTAGEM E A GRADE DA ARENA (seção 4.3 do plano): as escolhas da página
 * (quem entra em cada lado, quantas vezes), quando dá para começar, e onde
 * cada ficha nasce na grade.
 *
 * Posições iniciais: o Lado A nas 2 colunas da esquerda, o Lado B nas 2 da
 * direita (em zigue-zague, centrados na altura), o boneco no centro-direita.
 * O Judge árbitro (modo "lados") nasce ao norte da 1ª ficha da ordem
 * (`judgeDoArbitro`); no modo "boneco" ele É o boneco.
 *
 * Puro: sem store.
 */

/** Montagem vazia: dois lados, grade pequena, o boneco que vier. */
export function montagemVazia(boneco: MontagemDaArena['boneco']): MontagemDaArena {
  return { modo: 'lados', escolhas: [], grade: 'pequena', boneco }
}

/** Quantas fichas o lado já tem (contando as repetidas). */
export function fichasNoLado(montagem: MontagemDaArena, lado: LadoDaArena): number {
  return montagem.escolhas.reduce((soma, escolha) => (escolha.lado === lado ? soma + vezesValidas(escolha.vezes) : soma), 0)
}

/**
 * A montagem com a ficha no lado e `vezes` cópias (já estava = troca as
 * vezes). Respeita `VEZES_MAX` e `FICHAS_POR_LADO_MAX`: sem lugar no lado,
 * volta a MESMA montagem.
 */
export function comEscolha(montagem: MontagemDaArena, personagemId: string, lado: LadoDaArena, vezes = 1): MontagemDaArena {
  const atual = montagem.escolhas.find((escolha) => escolha.personagemId === personagemId && escolha.lado === lado)
  const ocupadas = fichasNoLado(montagem, lado) - (atual === undefined ? 0 : vezesValidas(atual.vezes))
  const cabe = Math.min(vezesValidas(vezes), FICHAS_POR_LADO_MAX - ocupadas)
  if (cabe < 1 || (atual !== undefined && vezesValidas(atual.vezes) === cabe)) return montagem
  const escolhas =
    atual === undefined
      ? [...montagem.escolhas, { personagemId, lado, vezes: cabe }]
      : montagem.escolhas.map((escolha) => (escolha === atual ? { ...escolha, vezes: cabe } : escolha))
  return { ...montagem, escolhas }
}

/** A montagem sem a ficha naquele lado (todas as cópias). Não estava: a MESMA montagem. */
export function semEscolha(montagem: MontagemDaArena, personagemId: string, lado: LadoDaArena): MontagemDaArena {
  const escolhas = montagem.escolhas.filter((escolha) => !(escolha.personagemId === personagemId && escolha.lado === lado))
  return escolhas.length === montagem.escolhas.length ? montagem : { ...montagem, escolhas }
}

/** Dá para "Começar o teste"? Dois lados: 1 de cada; contra o boneco: 1 no Lado A. Conta só as fichas que ainda existem. */
export function montagemPronta(montagem: MontagemDaArena, fichas: readonly Pick<Personagem, 'id'>[]): boolean {
  const existe = new Set(fichas.map((ficha) => ficha.id))
  const temNoLado = (lado: LadoDaArena): boolean => montagem.escolhas.some((escolha) => escolha.lado === lado && existe.has(escolha.personagemId))
  return modoPronto(montagem.modo, temNoLado('a'), temNoLado('b'))
}

function modoPronto(modo: ModoDaArena, temA: boolean, temB: boolean): boolean {
  return modo === 'boneco' ? temA : temA && temB
}

const LADOS: readonly LadoDaArena[] = ['a', 'b']

/** Uma casa da grade. */
interface CasaDaArena {
  col: number
  row: number
}

/** O centro da casa em px do mundo (onde o token fica). */
export function centroDaCasaNaArena(casa: CasaDaArena): { x: number; y: number } {
  return { x: (casa.col + 0.5) * CASA_DA_ARENA, y: (casa.row + 0.5) * CASA_DA_ARENA }
}

/** Largura e altura da arena em px do mundo. */
export function limitesDaArena(grade: GradeDaArena): { largura: number; altura: number } {
  return { largura: grade.colunas * CASA_DA_ARENA, altura: grade.linhas * CASA_DA_ARENA }
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

/** O Judge árbitro: 2 casas ao norte da 1ª ficha da ordem, preso na grade; sem ficha, o centro da grade. */
export function judgeDoArbitro(primeiraFicha: { x: number; y: number } | null, grade: GradeDaArena): JudgeNaCena {
  const centro = centroDaCasaNaArena({ col: Math.floor(grade.colunas / 2), row: Math.floor(grade.linhas / 2) })
  return judgeInicial(null, primeiraFicha, centro, CASA_DA_ARENA, limitesDaArena(grade))
}
