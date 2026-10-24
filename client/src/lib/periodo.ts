import type { AmbienteDoPeriodo, Light, MapData, Periodo } from '../types/map'
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

/** O nome do período da manhã no relógio de campanha antigo (saiu na Luz L1): só se LÊ, nunca se grava. */
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

/**
 * Marca de cena externa (segue o período da sessão): desligar tira o campo, e
 * a cena volta a ser igual a mapa antigo.
 */
export function comCenaExterna(map: MapData, externa: boolean): MapData {
  if (externa) return map.externa === true ? map : { ...map, externa: true }
  if (map.externa === undefined) return map
  const { externa: _interna, ...rest } = map
  return rest
}

/**
 * Quanto sobra do raio de visão à noite na cena SEM `visaoPorPeriodo.noite`
 * (a regra do relógio antigo, "noite = metade da visão").
 */
export const VISAO_DA_NOITE = 0.5

/**
 * O raio de visão (px de mundo) no período da cena. `raio` é a visão cheia de
 * quem olha nesta cena (com o fator dele); `fator` é o fator de visão do
 * jogador, que vale também nas casas do período.
 *  - dia: a cheia, sempre;
 *  - tarde/noite com `visaoPorPeriodo` da cena: as casas do período x casa x
 *    fator, nunca acima da cheia (0 apaga a visão);
 *  - sem o campo (ou com valor torto, relido aqui porque o mapa pode vir cru):
 *    noite = metade da cheia, tarde = a cheia.
 * Sem `cena`, só a regra de antes (quem não tem o mapa à mão).
 */
export function raioNoPeriodo(raio: number, periodo: Periodo, cena?: Pick<MapData, 'visaoPorPeriodo' | 'grid'>, fator = 1): number {
  if (periodo === PERIODO_PADRAO) return raio
  const semCampo = periodo === 'noite' ? Math.round(raio * VISAO_DA_NOITE) : raio
  const campo: unknown = cena?.visaoPorPeriodo
  const casas = ehObjeto(campo) ? casasDeVisao(campo[periodo]) : undefined
  if (cena === undefined || casas === undefined) return semCampo
  const px = casas * cena.grid * fator
  return Number.isFinite(px) && px >= 0 ? Math.min(raio, px) : semCampo
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

// ───────────────────────────────────────────────────────────────────────────
// O que o jogador recebe (`snapshot.luz`)
// ───────────────────────────────────────────────────────────────────────────

/**
 * O período como o jogador o recebe: o da cena DELE e a tinta desse período.
 * Nunca as marcas da cena (`externa`, `periodoFixo`), a tinta dos outros
 * períodos, nem o período de outra cena.
 */
export interface LuzDoJogador extends Ambiente {
  periodo: Periodo
}

/**
 * `snapshot.luz` desta cena com a sessão em `sessao`. `null` (o campo nem
 * sai, e o snapshot fica igual ao de antes da Luz) quando o mestre não tem
 * período ou quando a cena está de dia — dia não tem tinta.
 */
export function luzParaJogador(map: Pick<MapData, 'externa' | 'periodoFixo' | 'ambientePorPeriodo'>, sessao: PeriodoLido | null): LuzDoJogador | null {
  if (sessao === null) return null
  const periodo = periodoDaCena(map, sessao)
  if (periodo === PERIODO_PADRAO) return null
  const { cor, forca } = ambienteDoPeriodo(map, periodo)
  return { periodo, cor, forca }
}

/**
 * `snapshot.luz` como chegou da rede, só com os campos conhecidos. `null` =
 * fora da forma (período que não é tarde/noite/dia, cor fora de `#rrggbb`,
 * força fora de 0..1): quem lê recusa a mensagem inteira.
 */
export function lerLuzDoJogador(valor: unknown): LuzDoJogador | null {
  if (!ehObjeto(valor)) return null
  const periodo = PERIODOS.find((p) => p === valor.periodo)
  const cor = corValida(valor.cor)
  const forca = valor.forca
  if (periodo === undefined || cor === undefined) return null
  if (typeof forca !== 'number' || !Number.isFinite(forca) || forca < 0 || forca > 1) return null
  return { periodo, cor, forca }
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

// ───────────────────────────────────────────────────────────────────────────
// Luz que acende sozinha (Luz L3): `Light.acesaEm`
// ───────────────────────────────────────────────────────────────────────────

/**
 * `Light.acesaEm` de arquivo ou rede: a lista de períodos, sem repetição e na
 * ordem dia, tarde, noite ('manha' do relógio antigo vira 'dia'). Lista com
 * qualquer item torto, ou o que não é lista, volta `undefined` INTEIRO: a luz
 * volta a ser a de sempre (acesa), nunca "nunca acesa" por engano.
 */
export function lerAcesaEm(valor: unknown): Periodo[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lidos = new Set<Periodo>()
  for (const item of valor) {
    const periodo = lerPeriodo(item)
    if (periodo === undefined) return undefined
    lidos.add(periodo)
  }
  return PERIODOS.filter((periodo) => lidos.has(periodo))
}

/** Cena interior (D1): sem `periodoFixo` legível e sem a marca `externa`. Ignora a troca de período. */
export function cenaInterior(cena: Pick<MapData, 'externa' | 'periodoFixo'>): boolean {
  return cena.externa !== true && lerPeriodo(cena.periodoFixo) === undefined
}

/**
 * A luz está acesa nesta cena com a sessão em `sessao` (o período da cena sai
 * de `periodoDaCena`; sessão ausente = dia)? A ordem da regra:
 *  1. `apagada` vence (apagada na mão ou pelo estado);
 *  2. `porEstado` vence: a luz que obedece a um estado não acende nem apaga
 *     sozinha (o efeito do estado já está gravado em `apagada`);
 *  3. cena interior ignora a troca (D1): acesa, como sempre;
 *  4. `acesaEm` ausente ou torto (relido aqui: o mapa pode vir cru) = sempre
 *     acesa; senão, acesa só nos períodos da lista (`[]` = nunca).
 */
export function luzAcesaNoPeriodo(
  luz: Pick<Light, 'apagada' | 'porEstado' | 'acesaEm'>,
  cena: Pick<MapData, 'externa' | 'periodoFixo'>,
  sessao: PeriodoLido | null | undefined,
): boolean {
  if (luz.apagada === true) return false
  if (luz.porEstado !== undefined || cenaInterior(cena)) return true
  const acesaEm = lerAcesaEm(luz.acesaEm)
  return acesaEm === undefined || acesaEm.includes(periodoDaCena(cena, sessao))
}

/**
 * "Acesa em" escolhido no painel da luz. Os três períodos tiram o campo (a luz
 * volta igual à de antes, byte a byte no arquivo); nenhum grava `[]`. Luz que
 * já está assim volta o MESMO objeto (sem passo de desfazer à toa).
 */
export function comAcesaEm(luz: Light, periodos: readonly Periodo[]): Light {
  const escolhidos = PERIODOS.filter((periodo) => periodos.includes(periodo))
  const atual = lerAcesaEm(luz.acesaEm)
  if (escolhidos.length === PERIODOS.length) {
    if (!('acesaEm' in luz)) return luz
    const { acesaEm: _sempreAcesa, ...semCampo } = luz
    return semCampo
  }
  if (atual !== undefined && atual.length === escolhidos.length && atual.every((periodo, i) => periodo === escolhidos[i])) return luz
  return { ...luz, acesaEm: escolhidos }
}
