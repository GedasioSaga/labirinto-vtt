import { judgeInicial, type JudgeNaCena } from '../batalha/judge'
import type { Personagem } from '../personagem'
import { vezesValidas } from './copias'
import { CASA_DA_ARENA, centroDaCasaNaArena, limitesDaArena, type GradeDaArena, type LadoDaArena } from './grade'
import { FICHAS_POR_LADO_MAX, type ModoDaArena, type MontagemDaArena } from './tipos'

// Passagem do endereço antigo: a grade mudou para `grade.ts`, e código ainda em obra
// (o treino do site) importa daqui. Código novo importa de `grade.ts`, que é puro.
export { casaDoBoneco, casasDoLado, centroDaCasaNaArena, limitesDaArena, tokensDaArena } from './grade'
export type { FichaNaGrade, TokensDaArena } from './grade'

/**
 * A MONTAGEM DA ARENA (seção 4.3 do plano): as escolhas da página (quem entra
 * em cada lado, quantas vezes) e quando dá para começar. Onde cada ficha nasce
 * na grade mora em `grade.ts` (`tokensDaArena`).
 *
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

/** O Judge árbitro: 2 casas ao norte da 1ª ficha da ordem, preso na grade; sem ficha, o centro da grade. */
export function judgeDoArbitro(primeiraFicha: { x: number; y: number } | null, grade: GradeDaArena): JudgeNaCena {
  const centro = centroDaCasaNaArena({ col: Math.floor(grade.colunas / 2), row: Math.floor(grade.linhas / 2) })
  return judgeInicial(null, primeiraFicha, centro, CASA_DA_ARENA, limitesDaArena(grade))
}
