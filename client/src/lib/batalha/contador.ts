import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { ALVO_DO_DANO, DANO_MAX, type GolpeDaBatalha, type SeloDaBatalha } from './combate'
import { normalizar } from './formula'
import { tecnicasDe } from './leituraDaFicha'
import type { TurnosDaCena } from './turnos'

/**
 * R5 (lote de 01/11): o CONTADOR de um personagem, como a polaridade do Vagn
 * ("Mecânicas gerais da fruta"): gastar a reação sobe 1 nível, cada nível dá
 * dano a mais em todo golpe que ele acerta, até o máximo, e dura até a
 * batalha acabar (o mestre pode zerar). O nível mora num selo sem turnos no
 * token (a pílula "Polaridade 2" e o dano somado pelos `mods`, como qualquer
 * selo), e o "sem reação" no combate do personagem até a vez dele.
 *
 * Lido da ficha, nunca do fio:
 *  - explícito (extras do cartão): "Contador" = o nome ("Polaridade"),
 *    "Dano por nível" = "10" (nível × 10) ou "10, 20, 30" (um por nível),
 *    "Nível máximo" = "3";
 *  - ou do texto: linhas "Nível 1: + 10 de dano" (uma por nível), "vai até
 *    3" para o máximo, e o nome "Polaridade" quando o texto fala dela.
 */

export const EXTRA_DO_CONTADOR = 'contador'
export const EXTRA_DANO_POR_NIVEL = 'dano por nivel'
export const EXTRA_NIVEL_MAXIMO = 'nivel maximo'
/** Teto do nível lido da ficha (texto torto não vira contador de 1000 níveis). */
export const NIVEL_DO_CONTADOR_MAX = 10
export const NOME_DO_CONTADOR_MAX = 40

export interface LeituraDoContador {
  nome: string
  /** O dano somado em cada nível: `danoPorNivel[0]` é o do nível 1. O tamanho é o máximo. */
  danoPorNivel: readonly number[]
}

function extra(cartao: Pick<CartaoDaFicha, 'extras'>, nome: string): string | null {
  const achado = cartao.extras.find((candidato) => normalizar(candidato.nome) === nome)
  return achado === undefined ? null : achado.valor
}

function inteiroNoTeto(texto: string, max: number): number | null {
  const numero = Number.parseInt(texto, 10)
  return Number.isInteger(numero) && numero >= 1 && numero <= max ? numero : null
}

/** Os danos pedidos ("10" ou "10, 20, 30") no máximo de níveis; um número só = nível × ele. */
function danosDoExtra(texto: string, maximo: number | null): number[] | null {
  const numeros = (texto.match(/\d+/g) ?? []).map((pedaco) => inteiroNoTeto(pedaco, DANO_MAX))
  if (numeros.length === 0 || numeros.some((numero) => numero === null)) return null
  const lidos = numeros.filter((numero): numero is number => numero !== null)
  const primeiro = lidos[0]
  if (primeiro === undefined) return null
  if (lidos.length === 1) {
    const niveis = maximo ?? 1
    return Array.from({ length: niveis }, (_, indice) => Math.min(DANO_MAX, primeiro * (indice + 1)))
  }
  return lidos.slice(0, maximo ?? NIVEL_DO_CONTADOR_MAX)
}

/** "Nível 1: + 10 de dano" por linha, na ordem dos níveis; nível pulado = nada (texto torto). */
function danosDoTexto(texto: string): number[] | null {
  const porNivel = new Map<number, number>()
  for (const achado of texto.matchAll(/nivel\s*(\d+)\s*:\s*\+?\s*(\d+)\s*de\s*dano/g)) {
    const nivel = inteiroNoTeto(achado[1] ?? '', NIVEL_DO_CONTADOR_MAX)
    const dano = inteiroNoTeto(achado[2] ?? '', DANO_MAX)
    if (nivel !== null && dano !== null && !porNivel.has(nivel)) porNivel.set(nivel, dano)
  }
  const danos: number[] = []
  for (let nivel = 1; porNivel.has(nivel); nivel++) danos.push(porNivel.get(nivel) ?? 0)
  return danos.length === 0 ? null : danos
}

function nomeDoContador(cartao: Pick<CartaoDaFicha, 'nome' | 'extras'>, texto: string): string {
  const explicito = extra(cartao, EXTRA_DO_CONTADOR)?.trim()
  if (explicito !== undefined && explicito.length > 0) return explicito.slice(0, NOME_DO_CONTADOR_MAX)
  return /polaridade/.test(texto) ? 'Polaridade' : cartao.nome.trim().slice(0, NOME_DO_CONTADOR_MAX) || 'Contador'
}

/** O contador que o cartão descreve; `null` = o cartão não é de contador. */
export function lerContador(cartao: Pick<CartaoDaFicha, 'nome' | 'campos' | 'extras'>): LeituraDoContador | null {
  const texto = normalizar([...Object.values(cartao.campos), ...cartao.extras.flatMap((item) => [item.nome, item.valor])].join(' \n '))
  const maximoExplicito = extra(cartao, EXTRA_NIVEL_MAXIMO)
  const maximoLido = maximoExplicito === null ? /vai ate\s*(\d+)/.exec(texto)?.[1] : maximoExplicito
  const maximo = maximoLido === undefined ? null : inteiroNoTeto(maximoLido.trim(), NIVEL_DO_CONTADOR_MAX)
  const danoExplicito = extra(cartao, EXTRA_DANO_POR_NIVEL)
  const danos = danoExplicito === null ? danosDoTexto(texto) : danosDoExtra(danoExplicito, maximo)
  if (danos === null) return null
  const danoPorNivel = maximo === null ? danos : danos.slice(0, maximo)
  return danoPorNivel.length === 0 ? null : { nome: nomeDoContador(cartao, texto), danoPorNivel }
}

/** O primeiro contador do personagem (das técnicas que valem agora, passivas inclusive), ou `null`. */
export function contadorDoPersonagem(personagem: Personagem, sistema: SistemaDeRpg): { cartao: CartaoDaFicha; leitura: LeituraDoContador } | null {
  for (const cartao of tecnicasDe(personagem, sistema)) {
    const leitura = lerContador(cartao)
    if (leitura !== null) return { cartao, leitura }
  }
  return null
}

/** O selo do contador `cartaoId` no token, ou `null`. */
export function seloDoContador(turnos: TurnosDaCena, tokenId: string, cartaoId: string): SeloDaBatalha | null {
  return (turnos.selos ?? []).find((selo) => selo.tokenId === tokenId && selo.cartaoId === cartaoId && selo.contador !== undefined) ?? null
}

/** O nível de agora (0 = sem selo). */
export function nivelDoContador(turnos: TurnosDaCena, tokenId: string, cartaoId: string): number {
  return seloDoContador(turnos, tokenId, cartaoId)?.contador ?? 0
}

/** O selo no `nivel` (já dentro de 1 e o máximo): nome "Polaridade 2" e o dano do nível nos `mods`. */
export function seloNoNivel(base: SeloDaBatalha, nome: string, danoPorNivel: readonly number[], nivel: number): SeloDaBatalha {
  const dano = danoPorNivel[nivel - 1] ?? 0
  return { ...base, nome: `${nome} ${nivel}`, contador: nivel, mods: [{ alvo: ALVO_DO_DANO, delta: dano }] }
}

/**
 * Os selos com o contador mexido por `delta` níveis (Desfazer por diff: tira
 * o que a linha pôs do nível de AGORA, nunca volta a foto). No 0 o selo sai;
 * sem selo e delta para baixo, nada; acima do máximo, para no máximo.
 */
export function selosComONivel(selos: readonly SeloDaBatalha[], base: SeloDaBatalha, nome: string, danoPorNivel: readonly number[], delta: number): readonly SeloDaBatalha[] {
  const existente = selos.find((selo) => selo.tokenId === base.tokenId && selo.cartaoId === base.cartaoId && selo.contador !== undefined)
  const nivel = Math.min(danoPorNivel.length, (existente?.contador ?? 0) + delta)
  if (nivel <= 0) return existente === undefined ? selos : selos.filter((selo) => selo.id !== existente.id)
  const novo = seloNoNivel(existente ?? base, nome, danoPorNivel, nivel)
  return existente === undefined ? [...selos, novo] : selos.map((selo) => (selo.id === existente.id ? novo : selo))
}

export type MotivoDoContador = 'semContador' | 'semReacao' | 'noMaximo' | 'zerado' | 'golpeEsperando'

/**
 * Por que o pedido não vale agora; `null` = vale. F2 (fatia D, resposta Q6
 * do Vagn): com golpe esperando a reação dele (`golpeEsperando`), carregar
 * não vale (carregar gasta a reação que esse golpe ainda pede).
 */
export function motivoDoContador(tipo: 'ganhar' | 'zerar', nivel: number, maximo: number, semReacao: boolean, golpeEsperando = false): MotivoDoContador | null {
  if (tipo === 'zerar') return nivel === 0 ? 'zerado' : null
  if (semReacao) return 'semReacao'
  if (golpeEsperando) return 'golpeEsperando'
  return nivel >= maximo ? 'noMaximo' : null
}

/** F2 (fatia D): algum golpe da cena ainda espera a reação deste token (alvo que reage e não resolveu). */
export function temGolpeEsperando(golpes: readonly Pick<GolpeDaBatalha, 'alvos'>[] | undefined, tokenId: string): boolean {
  return (golpes ?? []).some((golpe) => golpe.alvos.some((alvo) => alvo.tokenId === tokenId && alvo.podeReagir && alvo.danoFinal === undefined))
}
