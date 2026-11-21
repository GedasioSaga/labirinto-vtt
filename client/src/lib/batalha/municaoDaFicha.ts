import type { CarriedItem, Token } from '../../types/map'
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
 * A bala de pé na aba Armas (subcartão "Tipos de bala") fica ligada à vaga que
 * gastou. Sem isto, a bala ligada só pelo nome perderia a ligação quando a
 * última unidade sai (a vaga some), e o tiro com 0 voltaria a sair de graça.
 * Vaga com item do Acervo (`itemId`): a bala passa a apontar para ele. Vaga
 * só pelo nome (sem item: ficha de antes, digitado à mão, pino antigo): a
 * bala fica marcada como ligada pelo nome (`municaoPeloNome`, D1 da auditoria
 * de 16/11). Bala que já tem `itemId`, ou já marcada: a MESMA ficha.
 */
export function comABalaLigada(personagem: Personagem, armaId: string, balaId: string, itemId: string | undefined): Personagem {
  const cartoes = personagem.abas[ABA_DAS_ARMAS]
  if (cartoes === undefined) return personagem
  let mudou = false
  const ligar = (bala: CartaoDaFicha): CartaoDaFicha => {
    if (bala.id !== balaId || bala.itemId !== undefined) return bala
    if (itemId === undefined) {
      if (bala.municaoPeloNome === true) return bala
      mudou = true
      return { ...bala, municaoPeloNome: true }
    }
    mudou = true
    // Com o item, o `itemId` já a deixa ligada com 0: a marca pelo nome sai, e a ligação fica num lugar só.
    const { municaoPeloNome: _peloNome, ...semMarca } = bala
    return { ...semMarca, itemId }
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

/**
 * A ficha com a mochila do BONECO dono (aventura que ainda não migrou a
 * mochila para a ficha, `MesaDaBatalha.mochilaDoBoneco`): é dela que a bala
 * conta e gasta, e a da ficha lá não vale. `null` = a ficha manda: a mesma.
 */
export function fichaComAMochilaDoBoneco(personagem: Personagem, mochila: readonly CarriedItem[] | null): Personagem {
  if (mochila === null) return personagem
  const { mochila: _daFicha, ...semMochila } = personagem
  return mochila.length === 0 ? semMochila : { ...semMochila, mochila: [...mochila] }
}

/**
 * As fichas da tela da batalha com a mochila do boneco de cada uma (o
 * primeiro boneco ligado a ela no mapa), para a mira contar a bala da mesma
 * mochila que o tiro gasta. Só para a aventura não migrada: quem chama decide.
 */
export function fichasComAsMochilasDosBonecos(personagens: readonly Personagem[], bonecos: readonly Pick<Token, 'characterId' | 'mochila'>[]): Personagem[] {
  return personagens.map((personagem) => {
    const boneco = bonecos.find((candidato) => candidato.characterId === personagem.id)
    return boneco === undefined ? personagem : fichaComAMochilaDoBoneco(personagem, boneco.mochila ?? [])
  })
}

/**
 * NA TELA DO JOGADOR (pedido de 21/11/2026, Vincent com 40 Balas de prata no
 * inventário e "Sem Bala de Prata" na batalha): a sala LAN manda a ficha sem
 * a mochila (`paraOFio`), e a mochila dele chega no BONECO do recorte — é ela
 * que o inventário mostra. A mira contava a bala da ficha sem mochila (0).
 * Cada ficha com boneco ligado no recorte (`ligacoes`, `personagens.tokens`)
 * passa a contar da mochila dele; sem boneco à vista, a ficha como veio.
 * Nada mudando, a MESMA lista.
 */
export function fichasComAMochilaDasLigacoes(
  personagens: readonly Personagem[] | undefined,
  ligacoes: readonly { tokenId: string; personagemId: string | null }[] | undefined,
  bonecos: readonly Token[] | undefined,
): readonly Personagem[] | undefined {
  if (personagens === undefined || ligacoes === undefined || bonecos === undefined || ligacoes.length === 0) return personagens
  let mudou = false
  const lidas = personagens.map((personagem) => {
    const ligado = ligacoes.find((ligacao) => ligacao.personagemId === personagem.id && bonecos.some((boneco) => boneco.id === ligacao.tokenId))
    const boneco = ligado === undefined ? undefined : bonecos.find((candidato) => candidato.id === ligado.tokenId)
    if (boneco === undefined) return personagem
    mudou = true
    return fichaComAMochilaDoBoneco(personagem, boneco.mochila ?? [])
  })
  return mudou ? lidas : personagens
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
