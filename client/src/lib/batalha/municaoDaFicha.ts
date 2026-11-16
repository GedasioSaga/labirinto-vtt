import type { CarriedItem } from '../../types/map'
import { ITEM_QUANTIDADE_MAX, quantidadeDe } from '../items'
import { tirarDaMochilaDaFicha } from '../mochila/darNaFicha'
import { fichaComMochila } from '../mochila/juncao'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { moedasDe } from '../troca'
import { ABA_DAS_ARMAS, armasDe, balaDaArma } from './leituraDaFicha'

/**
 * MUNIÇÃO NA BATALHA (pedido de 16/11/2026 11h03): o tiro com a bala ligada à
 * mochila (`BalaDaArma.municao`) tira 1 da vaga da FICHA — a ficha é a dona
 * da mochila; o boneco espelha (`lib/mochila/espelho.ts`). O Desfazer do golpe
 * devolve a mesma unidade. Puras: a store (`stores/batalhaFabrica.ts`) grava
 * pela mesa, no mestre e no host (o tiro do jogador passa pelo mesmo caminho).
 */

/** O que o tiro gastou, para o Desfazer devolver: a vaga como estava antes e o lugar dela na mochila. */
export interface MunicaoGasta {
  personagem: Personagem
  /** A vaga ANTES do tiro (com a quantidade de antes). */
  vaga: CarriedItem
  indice: number
}

/**
 * A bala de pé na aba Armas (subcartão "Tipos de bala") passa a apontar para o
 * item do Acervo da vaga que gastou. Sem isto, a bala ligada só pelo nome
 * perderia a ligação quando a última unidade sai (a vaga some), e o tiro com
 * 0 voltaria a sair. Bala que já tem `itemId`, ou vaga sem item: a MESMA ficha.
 */
function comABalaLigada(personagem: Personagem, armaId: string, balaId: string, itemId: string | undefined): Personagem {
  if (itemId === undefined) return personagem
  const cartoes = personagem.abas[ABA_DAS_ARMAS]
  if (cartoes === undefined) return personagem
  let mudou = false
  const ligar = (bala: CartaoDaFicha): CartaoDaFicha => {
    if (bala.id !== balaId || bala.itemId !== undefined) return bala
    mudou = true
    return { ...bala, itemId }
  }
  const novos = cartoes.map((cartao) => (cartao.id === armaId ? { ...cartao, subcartoes: cartao.subcartoes.map(ligar) } : cartao))
  return mudou ? { ...personagem, abas: { ...personagem.abas, [ABA_DAS_ARMAS]: novos } } : personagem
}

/**
 * Tira 1 da munição da bala `balaId` da arma `armaId`. `null` = nada a tirar:
 * a arma ou a bala não estão na ficha, a bala não está ligada à mochila ou
 * acabou (o `podeAgir` já recusa o tiro com 0).
 */
export function gastarMunicaoDaFicha(personagem: Personagem, armaId: string, balaId: string): MunicaoGasta | null {
  const arma = armasDe(personagem).find((candidata) => candidata.id === armaId)
  const bala = arma === undefined ? null : balaDaArma(arma, balaId)
  const municao = bala?.municao
  if (municao === undefined || municao.vagaId === null || municao.quantos < 1) return null
  const mochila = personagem.mochila ?? []
  const indice = mochila.findIndex((vaga) => vaga.id === municao.vagaId)
  const vaga = mochila[indice]
  if (vaga === undefined) return null
  const gasta = tirarDaMochilaDaFicha(personagem, vaga.id, 1)
  return { personagem: comABalaLigada(gasta, armaId, balaId, municao.itemId), vaga, indice }
}

/** A vaga com outra quantidade; 1 tira o campo (ausente === 1, como no disco). */
function vagaCom(vaga: CarriedItem, quantidade: number): CarriedItem {
  const { quantidade: _antes, ...semQuantidade } = vaga
  return quantidade > 1 ? { ...semQuantidade, quantidade } : semQuantidade
}

/**
 * O DESFAZER do tiro: a unidade volta. A vaga ainda na mochila ganha 1 (até
 * `ITEM_QUANTIDADE_MAX`); a que saiu com a última unidade volta no mesmo
 * lugar, com 1. Trabalha sobre a ficha de AGORA: o que mudou depois do tiro
 * (outro tiro, o mestre que deu mais) fica.
 */
export function devolverMunicaoNaFicha(personagem: Personagem, vaga: CarriedItem, indice: number): Personagem {
  const mochila = personagem.mochila ?? []
  const ainda = mochila.find((candidata) => candidata.id === vaga.id)
  if (ainda !== undefined) {
    const soma = Math.min(quantidadeDe(ainda) + 1, ITEM_QUANTIDADE_MAX)
    if (soma === quantidadeDe(ainda)) return personagem
    return fichaComMochila(personagem, mochila.map((candidata) => (candidata === ainda ? vagaCom(candidata, soma) : candidata)), moedasDe(personagem))
  }
  const lugar = Math.min(Math.max(indice, 0), mochila.length)
  return fichaComMochila(personagem, [...mochila.slice(0, lugar), vagaCom(vaga, 1), ...mochila.slice(lugar)], moedasDe(personagem))
}
