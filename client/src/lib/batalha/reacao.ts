import type { Ajuste } from '../ajusteDaFicha'
import { numeroDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida } from '../vidaDaFicha'
import { CARGA_MAX, MULTIPLICADOR_DA_CARGA, MULTIPLICADOR_DA_SURPRESA, MULTIPLICADOR_DO_CRITICO, PERFURACAO_MAX, PERFURACAO_MIN, type SaidaDaReacao } from './combate'
import { recursoDoEscudo } from './leituraDaFicha'

/**
 * REAÇÃO E DANO FINAL, F2 (seção 3.4 de docs/planos/batalha-one-piece-f2-plano.md
 * e respostas Q3, Q4 e Q6): o que o d20 libera, quanto do golpe passa e como
 * o dano cai na ficha.
 *
 * Q3: o 1 NATURAL é crítico (×1,5) com qualquer modificador; 10, 15 e 20
 * contam pelo TOTAL (d20 + modificador). Q6: o contra-ataque (20) zera o dano
 * daquele golpe para quem o tirou.
 *
 * Puro: sem store, sem rede.
 */

const DADO_DO_CRITICO = 1
const TOTAL_DA_METADE = 10
const TOTAL_DA_ESQUIVA = 15
const TOTAL_DO_CONTRA = 20

/** As saídas que o dado libera, a melhor para quem reage primeiro. Abaixo de 10: só receber o golpe. */
export function saidasPossiveis(d20: number, total: number): SaidaDaReacao[] {
  if (d20 === DADO_DO_CRITICO) return ['critico']
  if (total >= TOTAL_DO_CONTRA) return ['contra', 'esquiva', 'metade']
  if (total >= TOTAL_DA_ESQUIVA) return ['esquiva', 'metade']
  if (total >= TOTAL_DA_METADE) return ['metade']
  return ['cheio']
}

/**
 * Passar depois do dado: toma o golpe inteiro sem usar a reação. O 1 natural
 * continua crítico (passar não foge dele). Ex.: d20 17 = "passou"; d20 1 = "critico".
 */
export function saidaDoPassar(d20: number): SaidaDaReacao {
  return d20 === DADO_DO_CRITICO ? 'critico' : 'passou'
}

/** Quanto do dano que chega passa: crítico 1,5; cheio, Não reagir, Passar e sem reação 1; metade 0,5; esquiva e contra-ataque 0. */
export function fatorDaSaida(saida: SaidaDaReacao): number {
  switch (saida) {
    case 'critico':
      return MULTIPLICADOR_DO_CRITICO
    case 'cheio':
    case 'naoReagiu':
    case 'passou':
    case 'semReacao':
      return 1
    case 'metade':
      return 0.5
    case 'esquiva':
    case 'contra':
      return 0
  }
}

/** O dano que chega ao alvo: base × concentração × Surpresa, para baixo, nunca negativo. `carga` = o nível (0 a 3). */
export function danoQueChega(base: number, carga: number, surpresa: boolean): number {
  const nivel = Math.min(CARGA_MAX, Math.max(0, Math.trunc(carga)))
  const vezes = MULTIPLICADOR_DA_CARGA[nivel] ?? 1
  return Math.max(0, Math.floor(base * vezes * (surpresa ? MULTIPLICADOR_DA_SURPRESA : 1)))
}

/** O dano que cai na ficha depois da reação: para baixo, nunca negativo. */
export function danoFinal(chega: number, saida: SaidaDaReacao): number {
  return Math.max(0, Math.floor(chega * fatorDaSaida(saida)))
}

/** A porcentagem lida: inteiro de 1 a 100, ou `null`. */
export function perfuracaoValida(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= PERFURACAO_MIN && valor <= PERFURACAO_MAX ? valor : null
}

/** Quanto do golpe perfura, de 0 a 100: 0 sem `perfurante`; com ele, `perfuracao` ou 100 (ausente ou torta = tudo, como antes da porcentagem). */
export function porcentagemQuePerfura(perfurante: boolean, perfuracao?: number): number {
  if (!perfurante) return 0
  return perfuracaoValida(perfuracao) ?? PERFURACAO_MAX
}

/**
 * Como `dano` se divide: `direto` vai ao HP sem tocar no Escudo; `peloEscudo`
 * gasta o Escudo primeiro. A parte direta arredonda PARA BAIXO (como todo dano
 * do jogo) e o que sobra vai pelo Escudo, então a soma é sempre o dano inteiro.
 * Ex.: 200 a 30% = 60 direto + 140 pelo Escudo; 99 a 50% = 49 + 50.
 */
export function divisaoDoDano(dano: number, porcentagem: number): { direto: number; peloEscudo: number } {
  const inteiro = Math.max(0, Math.floor(dano))
  const parte = Math.min(PERFURACAO_MAX, Math.max(0, Math.trunc(porcentagem)))
  const direto = Math.floor((inteiro * parte) / PERFURACAO_MAX)
  return { direto, peloEscudo: inteiro - direto }
}

/**
 * Os ajustes que põem `dano` na ficha. Q4: gasta o Escudo primeiro e o resto
 * vai ao HP; `perfurante` vai direto ao HP. Ex.: Escudo 50, HP 450, dano 130
 * = Escudo 0, HP 370. Com `perfuracao` só aquela porcentagem vai direto e o
 * resto passa pelo Escudo (`divisaoDoDano`). Ex.: Escudo 100, dano 200 a 30% =
 * 60 direto, 140 no Escudo (100) e 40 no HP: Escudo 0, HP −100. O HP para no 0
 * (`aplicarAjuste` limita). Dano 0 ou sistema sem vida: nenhum ajuste.
 */
export function ajustesDoDano(personagem: Personagem, sistema: SistemaDeRpg, dano: number, perfurante: boolean, perfuracao?: number): Ajuste[] {
  if (!(dano > 0)) return []
  const ajustes: Ajuste[] = []
  const { direto, peloEscudo } = divisaoDoDano(dano, porcentagemQuePerfura(perfurante, perfuracao))
  let resto = peloEscudo
  const escudo = resto > 0 ? recursoDoEscudo(sistema) : null
  if (escudo !== null) {
    const temEscudo = numeroDaFicha(personagem.recursos, escudo.id)
    const gasto = Math.min(Math.max(0, temEscudo), resto)
    if (gasto > 0) {
      ajustes.push({ parte: 'recurso', chave: escudo.id, valor: temEscudo - gasto })
      resto -= gasto
    }
  }
  const noHp = direto + resto
  const vida = recursoDeVida(sistema)
  if (noHp > 0 && vida !== null) ajustes.push({ parte: 'recurso', chave: vida.id, valor: Math.max(0, numeroDaFicha(personagem.recursos, vida.id) - noHp) })
  return ajustes
}
