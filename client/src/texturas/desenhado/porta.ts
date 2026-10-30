import type { DoorKind } from '../../types/map'

/**
 * AS PORTAS DESENHADAS (lote 18, 29/10/2026; CONTRATO.md 11.16): a conta que deita
 * o vão e a folha das portas do pacote na cadeia da parede. Sem Pixi e sem I/O; a
 * referência é `godot/desenhado/ferramentas/porta.ts` (mesmos números) e o 4º passe
 * de `ferramentas/parede.ts`.
 *
 * - O trecho da porta é um trecho da cadeia (papel "porta"). As ombreiras ficam FORA
 *   do vão: o trecho desenhado vai de s0 - o a s1 + o e as corridas de parede vizinhas
 *   encolhem o (o = ombreiraPx x k; 0 na quina, na ponta da cadeia, ao lado de outro
 *   vão ou de parede curta demais). O vão que se vê é o vão por onde a ficha passa.
 * - O VÃO (módulo 0) cobre o trecho inteiro; a FOLHA (módulos 1 a 3: fechada, aberta,
 *   secreta) vai só de s0 a s1, por cima, na rampa da cor da porta, pelos pedaços do
 *   config (fixo, estica, repete), para as pontas não esticarem.
 */

export type EstadoDaFolha = 'fechada' | 'aberta' | 'secreta'

/** O id do pacote de cada forma do app (`DoorKind`). */
export const ID_DA_FORMA: Readonly<Record<DoorKind, 'porta' | 'porta-dupla' | 'porta-portao'>> = {
  normal: 'porta',
  double: 'porta-dupla',
  gate: 'porta-portao',
}
export const FORMAS_DA_PORTA: readonly DoorKind[] = ['normal', 'double', 'gate']

/** O módulo de cada estado na imagem (o 0 é o vão). */
export const MODULO_DO_ESTADO: Readonly<Record<EstadoDaFolha, number>> = { fechada: 1, aberta: 2, secreta: 3 }

/**
 * A meia espessura da folha, em fração da altura da imagem, e o mínimo em px do traço
 * (`PORTA_MEIA` e `PORTA_MEIA_MIN` de `texturas/porta/porta_comum.gdshaderinc`). O app
 * precisa dela para a seleção, o anel da trancada e a animação acompanharem a folha.
 */
const MEIA_DA_FOLHA = 0.24
const MEIA_DA_FOLHA_MIN_PX = 2.2

export interface PedacoDoPlano {
  readonly de: number
  readonly ate: number
  readonly jeito: 'fixo' | 'estica' | 'repete'
}

export interface PlanoDaPorta {
  readonly ombreiraPx: number
  readonly folhaDePx: number
  readonly folhaAtePx: number
  readonly pedacos: readonly PedacoDoPlano[]
}

/** Um pedaço deitado: de s0 a s1 (px do mundo) lê a imagem de x0 a x0 + comp (px do traço, dentro do módulo). */
export interface PedacoDaPorta {
  readonly s0: number
  readonly s1: number
  readonly x0: number
  readonly comp: number
}

function campo(o: unknown, k: string): unknown {
  return typeof o === 'object' && o !== null && k in o ? Reflect.get(o, k) : undefined
}

function numero(o: unknown, k: string): number | null {
  const v = campo(o, k)
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** O bloco `parede.porta` do `textura.json`, conferido; `null` = não serve (a porta fica a do Atual). */
export function lerPlanoDaPorta(bruto: unknown): PlanoDaPorta | null {
  const porta = campo(campo(bruto, 'parede'), 'porta')
  const ombreiraPx = numero(porta, 'ombreiraPx')
  const folhaDePx = numero(porta, 'folhaDePx')
  const folhaAtePx = numero(porta, 'folhaAtePx')
  const lista = campo(porta, 'pedacos')
  if (ombreiraPx === null || folhaDePx === null || folhaAtePx === null || !Array.isArray(lista) || lista.length === 0) return null
  if (ombreiraPx < 0 || ombreiraPx > 32 || folhaAtePx <= folhaDePx) return null
  const pedacos: PedacoDoPlano[] = []
  let antes = folhaDePx
  for (const p of lista) {
    const de = numero(p, 'de')
    const ate = numero(p, 'ate')
    const jeito = campo(p, 'jeito')
    if (de === null || ate === null || ate <= de || de < antes - 1e-6 || ate > folhaAtePx + 1e-6) return null
    if (jeito !== 'fixo' && jeito !== 'estica' && jeito !== 'repete') return null
    pedacos.push({ de, ate, jeito })
    antes = ate
  }
  return { ombreiraPx, folhaDePx, folhaAtePx, pedacos }
}

/**
 * A folha de s0 a s1 em pedaços. Os fixos guardam o comprimento x k; os que esticam e os que
 * repetem dividem o resto na proporção do comprimento na imagem, e o que repete entra
 * n = max(1, round(parte / (comprimento x k))) vezes inteiras. Resto <= 0: tudo estica junto.
 */
export function pedacosDaFolha(plano: PlanoDaPorta, s0: number, s1: number, k: number): PedacoDaPorta[] {
  const L = s1 - s0
  const fixo = plano.pedacos.reduce((t, p) => t + (p.jeito === 'fixo' ? p.ate - p.de : 0), 0) * k
  const solto = plano.pedacos.reduce((t, p) => t + (p.jeito === 'fixo' ? 0 : p.ate - p.de), 0)
  const resto = L - fixo
  const out: PedacoDaPorta[] = []
  let s = s0
  if (resto <= 1e-6 || solto <= 0) {
    const tot = plano.pedacos.reduce((t, p) => t + p.ate - p.de, 0)
    for (const p of plano.pedacos) {
      const len = (L * (p.ate - p.de)) / tot
      out.push({ s0: s, s1: s + len, x0: p.de, comp: p.ate - p.de })
      s += len
    }
    return out
  }
  for (const p of plano.pedacos) {
    const comp = p.ate - p.de
    if (p.jeito === 'fixo') {
      out.push({ s0: s, s1: s + comp * k, x0: p.de, comp })
      s += comp * k
      continue
    }
    const parte = (resto * comp) / solto
    const n = p.jeito === 'repete' ? Math.max(1, Math.round(parte / (comp * k))) : 1
    for (let i = 0; i < n; i += 1) {
      out.push({ s0: s, s1: s + parte / n, x0: p.de, comp })
      s += parte / n
    }
  }
  return out
}

/** O vão de s0 a s1 com as ombreiras ol e or (px do mundo) por fora: 1 a 3 pedaços do módulo 0. */
export function pedacosDoVao(plano: PlanoDaPorta, comprimentoDoModuloPx: number, s0: number, s1: number, ol: number, or: number, k: number): PedacoDaPorta[] {
  const de = plano.folhaDePx
  const ate = plano.folhaAtePx
  const out: PedacoDaPorta[] = []
  if (ol > 1e-6) out.push({ s0: s0 - ol, s1: s0, x0: de - ol / k, comp: ol / k })
  out.push({ s0, s1, x0: de, comp: ate - de })
  if (or > 1e-6) out.push({ s0: s1, s1: s1 + or, x0: ate, comp: Math.min(or / k, comprimentoDoModuloPx - ate) })
  return out
}

/**
 * A meia espessura da folha em px do MUNDO: a imagem de altura `hPx` cobre o miolo
 * (de -hi a +hi, px do mundo), como no shader da parede.
 */
export function meiaDaFolhaNoMundo(hPx: number, hiMundo: number): number {
  return (Math.max(MEIA_DA_FOLHA * hPx, MEIA_DA_FOLHA_MIN_PX) * 2 * hiMundo) / hPx
}
