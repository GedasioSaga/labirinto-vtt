import type { Ajuste } from '../ajusteDaFicha'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { CARGA_MAX, MULTIPLICADOR_DA_CARGA, MULTIPLICADOR_DA_SURPRESA, MULTIPLICADOR_DO_CRITICO, type SaidaDaReacao } from './combate'

/**
 * REAÇÃO E DANO FINAL, F2 (seção 3.4 de docs/planos/batalha-one-piece-f2-plano.md
 * e respostas Q3, Q4 e Q6): o que o d20 libera, quanto do golpe passa e como
 * o dano cai na ficha.
 *
 * Q3: o 1 NATURAL é crítico (×1,5) com qualquer modificador; 10, 15 e 20
 * contam pelo TOTAL (d20 + modificador). Q6: o contra-ataque (20) zera o dano
 * daquele golpe para quem o tirou.
 *
 * FASE 0 (contrato): `ajustesDoDano` tem corpo provisório (nenhum ajuste); a
 * fase 1 põe o Escudo primeiro (Q4) sem mudar a assinatura.
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

/** Quanto do dano que chega passa: crítico 1,5; cheio, Não reagir e sem reação 1; metade 0,5; esquiva e contra-ataque 0. */
export function fatorDaSaida(saida: SaidaDaReacao): number {
  switch (saida) {
    case 'critico':
      return MULTIPLICADOR_DO_CRITICO
    case 'cheio':
    case 'naoReagiu':
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

/**
 * Os ajustes que põem `dano` na ficha. Q4: gasta o Escudo primeiro e o resto
 * vai ao HP; `perfurante` vai direto ao HP. Fase 0: nenhum ajuste.
 */
export function ajustesDoDano(_personagem: Personagem, _sistema: SistemaDeRpg, _dano: number, _perfurante: boolean): Ajuste[] {
  return []
}
