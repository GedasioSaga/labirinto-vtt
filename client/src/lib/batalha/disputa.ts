import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { BonusDaBatalha, VantagemDoDado, VantagemNaRolagem } from './combate'
import { lerDano } from './formula'
import { modificadorDoTeste } from './marca'
import { textoDaRolagem } from './golpe'
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
 * carga 1); "acerta" = sem teste; `{ mais }` = a `semCarga` somada (F2,
 * fatia C: a dança da Aira sobe a CD com a carga); sem carga, a `semCarga`.
 * `expressao` (construtor C4): a fórmula da técnica montada, lida pela
 * gramática do dano na ficha de quem usa, com "mod(Atributo)" ("12 +
 * mod(Carisma)"); na tabela, `{ expressao }` é a fórmula daquela carga.
 */
export type CdDaDisputa =
  | { tipo: 'fixa'; cd: number }
  | { tipo: 'formula'; base: number; mais?: number; atributoId: string }
  | { tipo: 'expressao'; formula: string }
  | { tipo: 'porCarga'; semCarga: Exclude<CdDaDisputa, { tipo: 'porCarga' }>; cargas: readonly (number | 'acerta' | { mais: number } | { expressao: string })[] }

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
  /** Construtor C4: a fórmula da CD não fecha com a ficha de quem usa: ninguém rola, e a técnica não pega (o mestre confere). */
  | { tipo: 'semCd'; passou: false }
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

/**
 * Construtor C4: a CD por fórmula na ficha de quem usa (com os selos dele e o
 * "mod(Atributo)" do teste); `null` = a fórmula não fecha (fora da gramática
 * ou pede arma).
 */
export function cdDaExpressao(formula: string, usa: FichaNaDisputa, sistema: SistemaDeRpg): number | null {
  const lido = lerDano(formula, { personagem: usa.personagem, sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: usa.bonus, modificador: (atributoId) => modificadorDaDisputa(usa, sistema, atributoId) })
  return lido.tipo === 'valor' ? lido.valor : null
}

/**
 * A CD que vale agora; "acerta" = passa sem teste; `null` = a fórmula não
 * fecha (construtor C4). `usa` = a ficha de quem usa a técnica; `carga` = a
 * concentração dela (0 a 3).
 */
export function cdDaDisputa(cd: CdDaDisputa, usa: FichaNaDisputa, sistema: SistemaDeRpg, carga: number): number | 'acerta' | null {
  switch (cd.tipo) {
    case 'fixa':
      return cd.cd
    case 'formula':
      return cd.base + (cd.mais ?? 0) + modificadorDaDisputa(usa, sistema, cd.atributoId)
    case 'expressao':
      return cdDaExpressao(cd.formula, usa, sistema)
    case 'porCarga': {
      const nivel = Math.trunc(carga)
      const daTabela = nivel >= 1 ? cd.cargas[Math.min(nivel, cd.cargas.length) - 1] : undefined
      const semCarga = cdDaDisputa(cd.semCarga, usa, sistema, 0)
      if (daTabela === undefined) return semCarga
      if (typeof daTabela !== 'object') return daTabela
      if ('expressao' in daTabela) return cdDaExpressao(daTabela.expressao, usa, sistema)
      return semCarga === 'acerta' || semCarga === null ? semCarga : semCarga + daTabela.mais
    }
  }
}

/**
 * F2 (fatia C): quem usa a técnica venceu a disputa? Quando o alvo testa,
 * vence se o alvo NÃO passou; o "acerta" da concentração (sem teste) é
 * sempre de quem usa (a dança com 3 cargas atordoa).
 */
export function quemUsaVence(resultado: ResultadoDaDisputa, testa: 'quemUsa' | 'alvo'): boolean {
  if (resultado.tipo === 'automatico') return true
  // Construtor C4: sem CD, a técnica não pega sozinha (nada de debuff sem teste); o registro diz para o mestre conferir.
  if (resultado.tipo === 'semCd') return false
  return (testa === 'quemUsa') === resultado.passou
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
    if (cd === null) return { tipo: 'semCd', passou: false }
    const rolagem = rolar(fichas.testa, sistema, disputa.rola, rolarD20)
    return { tipo: 'cd', passou: rolagem.total >= cd, rolagem, cd }
  }
  const rolagem = rolar(fichas.testa, sistema, disputa.rola, rolarD20)
  const contra = rolar(fichas.resiste, sistema, disputa.contra.quem, rolarD20)
  return { tipo: 'rolagem', passou: rolagem.total > contra.total, rolagem, contra }
}

function textoDaRolagemDaDisputa(rolagem: RolagemDaDisputa): string {
  return textoDaRolagem(rolagem.d20, rolagem.modificador, rolagem.total, rolagem.vantagem)
}

/**
 * F2 (fatia B): a disputa em texto para o registro: "disputa d20 15+1 = 16
 * contra d20 8+2 = 10", "teste d20 9+1 = 10 contra CD 12", "sem teste (concentração)".
 */
export function textoDaDisputa(resultado: ResultadoDaDisputa): string {
  switch (resultado.tipo) {
    case 'automatico':
      return 'sem teste (concentração)'
    case 'semCd':
      return 'sem teste: a fórmula da CD não fecha com a ficha (o mestre confere)'
    case 'cd':
      return `teste ${textoDaRolagemDaDisputa(resultado.rolagem)} contra CD ${resultado.cd}`
    case 'rolagem':
      return `disputa ${textoDaRolagemDaDisputa(resultado.rolagem)} contra ${textoDaRolagemDaDisputa(resultado.contra)}`
  }
}
