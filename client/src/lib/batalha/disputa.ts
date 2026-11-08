import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { BonusDaBatalha, VantagemDoDado, VantagemNaRolagem } from './combate'
import { modificadorDoTeste } from './marca'
import { rolarComVantagem } from './reacao'

/**
 * DISPUTA ROLADA PELO APP (conserto das fichas F2, fatia A; respostas do
 * grilling: Corta Cenoura, dança da Aira, Explosão, Entardecer, Imã-Gumelo,
 * Campo de Contenção). Quem testa rola d20 + o modificador do atributo (o do
 * teste da marca: metade do rank, para baixo, com os selos), com vantagem ou
 * desvantagem (2 d20, regra da F1), contra outro d20 + modificador, ou contra
 * uma CD: fixa, por fórmula ou pela tabela da concentração.
 *
 * Puro: o d20 entra por parâmetro, sem store, sem rede.
 */

/** Quem rola: o atributo (`null` = d20 puro, como o Imã-Gumelo) e a vantagem. */
export interface QuemRola {
  atributoId: string | null
  vantagem?: VantagemDoDado
}

/**
 * A CD do teste. `fixa`: o número (Explosão 11, Entardecer 12). `formula`:
 * `base` + `mais` + o modificador do atributo de QUEM USA a técnica (dança
 * da Aira: 12 + mod. de CAR; Campo do Vagn: 10 + Proficiência + mod. de ESP).
 * `porCarga`: com concentração, a tabela troca a CD (`cargas[0]` vale para a
 * carga 1); "acerta" = sem teste; sem carga, a `semCarga`.
 */
export type CdDaDisputa =
  | { tipo: 'fixa'; cd: number }
  | { tipo: 'formula'; base: number; mais?: number; atributoId: string }
  | { tipo: 'porCarga'; semCarga: Exclude<CdDaDisputa, { tipo: 'porCarga' }>; cargas: readonly (number | 'acerta')[] }

/** Contra o quê: a CD, ou o d20 de quem resiste (Corta Cenoura: FOR do Jimboy contra RES do alvo). */
export type ContraDaDisputa = { tipo: 'cd'; cd: CdDaDisputa } | { tipo: 'rolagem'; quem: QuemRola }

/** Uma rolagem da disputa, como vai ao registro. */
export interface RolagemDaDisputa {
  d20: number
  modificador: number
  total: number
  vantagem?: VantagemNaRolagem
}

export type ResultadoDaDisputa =
  /** Concentração no "acerta" da tabela: passa sem rolar (Aira com 3 cargas atordoa sem teste). */
  | { tipo: 'automatico'; passou: true }
  | { tipo: 'cd'; passou: boolean; rolagem: RolagemDaDisputa; cd: number }
  | { tipo: 'rolagem'; passou: boolean; rolagem: RolagemDaDisputa; contra: RolagemDaDisputa }

/** Quem está na disputa: a ficha e os bônus dos selos dela agora. */
export interface FichaNaDisputa {
  personagem: Personagem
  bonus?: BonusDaBatalha
}

/** O modificador de quem rola: d20 puro = 0. */
export function modificadorDaDisputa(ficha: FichaNaDisputa, sistema: SistemaDeRpg, atributoId: string | null): number {
  return atributoId === null ? 0 : modificadorDoTeste(ficha.personagem, sistema, atributoId, ficha.bonus)
}

/** A CD que vale agora; "acerta" = passa sem teste. `usa` = a ficha de quem usa a técnica; `carga` = a concentração dela (0 a 3). */
export function cdDaDisputa(cd: CdDaDisputa, usa: FichaNaDisputa, sistema: SistemaDeRpg, carga: number): number | 'acerta' {
  switch (cd.tipo) {
    case 'fixa':
      return cd.cd
    case 'formula':
      return cd.base + (cd.mais ?? 0) + modificadorDaDisputa(usa, sistema, cd.atributoId)
    case 'porCarga': {
      const nivel = Math.trunc(carga)
      const daTabela = nivel >= 1 ? cd.cargas[Math.min(nivel, cd.cargas.length) - 1] : undefined
      return daTabela ?? cdDaDisputa(cd.semCarga, usa, sistema, 0)
    }
  }
}

function rolar(ficha: FichaNaDisputa, sistema: SistemaDeRpg, quem: QuemRola, rolarD20: () => number): RolagemDaDisputa {
  const modificador = modificadorDaDisputa(ficha, sistema, quem.atributoId)
  const { d20, vantagem } = rolarComVantagem(rolarD20, quem.vantagem)
  const rolagem: RolagemDaDisputa = { d20, modificador, total: d20 + modificador }
  if (vantagem !== undefined) rolagem.vantagem = vantagem
  return rolagem
}

/**
 * A disputa rolada. Quem testa rola (`rola`) contra `contra`; contra CD, passa com o
 * total IGUAL ou acima; contra outro d20, passa só VENCENDO (empate não
 * vence: "só põe Atordoado se ele vencer"). `usa` = quem usa a técnica (a CD
 * por fórmula e a concentração são dele); `resiste` = quem rola o outro d20.
 */
export function rolarDisputa(
  disputa: { rola: QuemRola; contra: ContraDaDisputa },
  fichas: { testa: FichaNaDisputa; usa: FichaNaDisputa; resiste: FichaNaDisputa },
  sistema: SistemaDeRpg,
  carga: number,
  rolarD20: () => number,
): ResultadoDaDisputa {
  if (disputa.contra.tipo === 'cd') {
    const cd = cdDaDisputa(disputa.contra.cd, fichas.usa, sistema, carga)
    if (cd === 'acerta') return { tipo: 'automatico', passou: true }
    const rolagem = rolar(fichas.testa, sistema, disputa.rola, rolarD20)
    return { tipo: 'cd', passou: rolagem.total >= cd, rolagem, cd }
  }
  const rolagem = rolar(fichas.testa, sistema, disputa.rola, rolarD20)
  const contra = rolar(fichas.resiste, sistema, disputa.contra.quem, rolarD20)
  return { tipo: 'rolagem', passou: rolagem.total > contra.total, rolagem, contra }
}
