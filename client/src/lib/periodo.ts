import type { AmbienteDoPeriodo, MapData, Periodo } from '../types/map'
import { SCENE_VISION_CELLS_MAX } from './sceneVision'

/**
 * DIA/TARDE/NOITE: o período em que cada cena está e a tinta de ambiente dele.
 * Puro, sem store: é o gancho de quem precisa saber se é dia, tarde ou noite
 * numa cena (luz, visão, rotina dos NPCs no Caminhos).
 *
 * A regra do período (decisão D1 do plano da Luz):
 *  - cena com `periodoFixo` fica nele, qualquer que seja a sessão;
 *  - cena `externa` segue o período da sessão;
 *  - cena sem nenhuma das duas marcas é INTERIOR e ignora a troca: dia.
 * Sessão sem período = dia.
 */

export const PERIODOS: readonly Periodo[] = ['dia', 'tarde', 'noite']

/** Sessão sem período, cena interior e valor que não se lê: dia. */
export const PERIODO_PADRAO: Periodo = 'dia'

/** O nome do período da manhã no relógio antigo (`lib/campaignClock.ts`): só se LÊ, nunca se grava. */
const MANHA_ANTIGA = 'manha'

/** O que pode chegar como período: o tipo novo ou o 'manha' do relógio antigo. */
export type PeriodoLido = Periodo | typeof MANHA_ANTIGA

/**
 * Lê um período de arquivo, rede ou do relógio antigo. 'manha' vira 'dia';
 * o que não é período (texto torto, número, nada) volta `undefined`.
 */
export function lerPeriodo(valor: unknown): Periodo | undefined {
  if (valor === MANHA_ANTIGA) return PERIODO_PADRAO
  return PERIODOS.find((periodo) => periodo === valor)
}

/** O período desta cena com a sessão em `sessao` (ausente = dia). */
export function periodoDaCena(map: Pick<MapData, 'externa' | 'periodoFixo'>, sessao: PeriodoLido | null | undefined): Periodo {
  // O mapa pode ter vindo cru (rede, arquivo editado à mão): o fixo torto não conta.
  const fixo = lerPeriodo(map.periodoFixo)
  if (fixo !== undefined) return fixo
  if (map.externa !== true) return PERIODO_PADRAO
  return lerPeriodo(sessao) ?? PERIODO_PADRAO
}

// ───────────────────────────────────────────────────────────────────────────
// Tinta de ambiente por período (configurável por cena)
// ───────────────────────────────────────────────────────────────────────────

/** A tinta resolvida: o que o render usa. */
export interface Ambiente {
  cor: string
  forca: number
}

/** Os períodos que a cena configura (tinta e visão): o dia é sempre o de sempre. */
const PERIODOS_CONFIGURAVEIS: readonly Exclude<Periodo, 'dia'>[] = ['tarde', 'noite']

/**
 * As cores aprovadas pelo usuário (24/10/2026): dia sem tinta; tarde âmbar a
 * 60%; noite azul-ardósia a 85%.
 */
export const AMBIENTE_PADRAO: Readonly<Record<Periodo, Readonly<Ambiente>>> = {
  dia: { cor: '#ffffff', forca: 0 },
  tarde: { cor: '#f2b071', forca: 0.6 },
  noite: { cor: '#465a92', forca: 0.85 },
}

const COR_HEX = /^#[0-9a-f]{6}$/i

function corValida(valor: unknown): string | undefined {
  return typeof valor === 'string' && COR_HEX.test(valor) ? valor : undefined
}

/** Força finita grampeada em 0..1; o que não é número (ou é NaN/infinito) volta `undefined`. */
function forcaGrampeada(valor: unknown): number | undefined {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return undefined
  return Math.min(1, Math.max(0, valor))
}

/**
 * A tinta desta cena no período: o campo da cena por cima do padrão. Força
 * fora de 0..1 é grampeada; cor que não é `#rrggbb` cai no padrão; o dia
 * devolve sempre o padrão dele (força 0).
 */
export function ambienteDoPeriodo(map: Pick<MapData, 'ambientePorPeriodo'>, periodo: Periodo): Ambiente {
  const padrao = AMBIENTE_PADRAO[periodo]
  if (periodo === 'dia') return { ...padrao }
  // `?.`: cena sem o campo, ou sem este período, é o caso comum — usa o padrão.
  const daCena: AmbienteDoPeriodo | undefined = map.ambientePorPeriodo?.[periodo]
  return {
    cor: corValida(daCena?.cor) ?? padrao.cor,
    forca: forcaGrampeada(daCena?.forca) ?? padrao.forca,
  }
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function lerAmbienteDoPeriodo(valor: unknown): AmbienteDoPeriodo | undefined {
  if (!ehObjeto(valor)) return undefined
  const cor = corValida(valor.cor)
  const forca = forcaGrampeada(valor.forca)
  if (cor === undefined && forca === undefined) return undefined
  return { ...(cor === undefined ? {} : { cor }), ...(forca === undefined ? {} : { forca }) }
}

/**
 * `ambientePorPeriodo` de arquivo: só tarde e noite, cor `#rrggbb` e força
 * grampeada em 0..1. Parte torta sai; nada que preste volta `undefined` (o
 * mapa fica sem a chave).
 */
export function lerAmbientePorPeriodo(valor: unknown): MapData['ambientePorPeriodo'] {
  if (!ehObjeto(valor)) return undefined
  const lido: NonNullable<MapData['ambientePorPeriodo']> = {}
  for (const periodo of PERIODOS_CONFIGURAVEIS) {
    const ambiente = lerAmbienteDoPeriodo(valor[periodo])
    if (ambiente !== undefined) lido[periodo] = ambiente
  }
  return Object.keys(lido).length === 0 ? undefined : lido
}

/** Raio de um período em casas: inteiro de 0 (a noite que apaga a visão) até o teto da "Visão nesta cena". */
function casasDeVisao(valor: unknown): number | undefined {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) return undefined
  return valor >= 0 && valor <= SCENE_VISION_CELLS_MAX ? valor : undefined
}

/**
 * `visaoPorPeriodo` de arquivo: só tarde e noite, inteiro de 0 a
 * `SCENE_VISION_CELLS_MAX` casas. Parte torta sai; nada que preste volta
 * `undefined` (o mapa fica sem a chave).
 */
export function lerVisaoPorPeriodo(valor: unknown): MapData['visaoPorPeriodo'] {
  if (!ehObjeto(valor)) return undefined
  const lido: NonNullable<MapData['visaoPorPeriodo']> = {}
  for (const periodo of PERIODOS_CONFIGURAVEIS) {
    const casas = casasDeVisao(valor[periodo])
    if (casas !== undefined) lido[periodo] = casas
  }
  return Object.keys(lido).length === 0 ? undefined : lido
}
