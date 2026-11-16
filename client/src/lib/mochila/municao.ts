import type { CarriedItem } from '../../types/map'
import { quantidadeDe } from '../items'

/**
 * MUNIÇÃO NA MOCHILA (pedido de 16/11/2026 11h03: "mesmo ele usando balas de
 * prata o número no inventário não tá diminuindo"): o tipo de bala da arma
 * ("Tipos de bala", `lib/batalha/leituraDaFicha.ts`) se liga a uma vaga da
 * mochila da ficha — pelo `itemId` do Acervo, quando a bala o tem, ou pelo
 * nome (as fichas de antes). Ligada, a bala conta o que a mochila tem e o tiro
 * gasta dela; sem ligação, a bala continua só texto, como antes.
 *
 * Puras e sem dependência da batalha: a leitura da ficha e a store usam as
 * mesmas.
 */

/** O que a bala ligada tem na mochila agora. */
export interface MunicaoDaBala {
  /** O item do Acervo da munição: o da bala ou, sem ele, o da primeira vaga que casou pelo nome. */
  itemId?: string
  /** Quantos a mochila tem, somando as vagas. 0 = sem munição: o tiro com esta bala não sai. */
  quantos: number
  /** A vaga de onde o próximo tiro tira 1; `null` = nenhuma (`quantos` 0). */
  vagaId: string | null
}

/** Minúsculas, sem acento, espaços juntados: "Balas  de Prata" = "balas de prata". */
function nomeLimpo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Uma palavra no singular, pelas regras de plural mais comuns do português
 * ("balas" → "bala", "munições" → "municao", "revólveres" → "revolver").
 * Não precisa acertar a gramática: as duas pontas passam pela mesma regra, e
 * `palavrasIguais` ainda aceita a palavra crua de um lado.
 */
function singular(palavra: string): string {
  if (palavra.length <= 3) return palavra
  if (palavra.endsWith('oes') || palavra.endsWith('aes')) return `${palavra.slice(0, -3)}ao`
  if (palavra.endsWith('eis')) return `${palavra.slice(0, -3)}el`
  if (palavra.endsWith('ais')) return `${palavra.slice(0, -3)}al`
  if (palavra.endsWith('res') || palavra.endsWith('zes') || palavra.endsWith('ses')) return palavra.slice(0, -2)
  if (palavra.endsWith('ns')) return `${palavra.slice(0, -2)}m`
  if (palavra.endsWith('s')) return palavra.slice(0, -1)
  return palavra
}

function palavrasIguais(a: string, b: string): boolean {
  return a === b || singular(a) === b || a === singular(b) || singular(a) === singular(b)
}

/**
 * Os dois nomes são a mesma munição, sem acento, sem caixa e sem plural:
 * "Balas de prata" = "Bala de Prata"; "Bala de RPG" ≠ "Bala de prata".
 */
export function nomesDeMunicaoIguais(a: string, b: string): boolean {
  const de = nomeLimpo(a).split(' ')
  const para = nomeLimpo(b).split(' ')
  if (de.length !== para.length || de[0] === '') return false
  return de.every((palavra, i) => palavrasIguais(palavra, para[i] ?? ''))
}

/**
 * A munição da bala na mochila. Com `itemId`, as vagas desse item do Acervo
 * (e as de mesmo nome sem item, pegas de um pino "!"): a bala está ligada
 * mesmo com 0 — é assim que o tiro sem munição fica bloqueado. Sem `itemId`,
 * só pelo nome; nenhuma vaga com o nome = a bala não está ligada
 * (`undefined`), e continua só texto.
 */
export function municaoNaMochila(mochila: readonly CarriedItem[], nome: string, itemId: string | undefined): MunicaoDaBala | undefined {
  const vagas = mochila.filter((vaga) => (itemId !== undefined && vaga.itemId === itemId) || ((itemId === undefined || vaga.itemId === undefined) && nomesDeMunicaoIguais(vaga.nome, nome)))
  if (itemId === undefined && vagas.length === 0) return undefined
  const quantos = vagas.reduce((soma, vaga) => soma + quantidadeDe(vaga), 0)
  const primeira = vagas[0]
  const doItem = itemId ?? vagas.find((vaga) => vaga.itemId !== undefined)?.itemId
  return { ...(doItem === undefined ? {} : { itemId: doItem }), quantos, vagaId: primeira === undefined ? null : primeira.id }
}
