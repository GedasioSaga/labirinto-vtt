import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { aliadosDe, type Equipe } from '../lib/batalha/equipes'
import type { BatalhaEmTurnos, PonteDaBatalha } from '../lib/batalha/ponte'
import { podeDesfazer } from '../lib/batalha/registro'
import { cartaDaVez, type AutorDaAcao } from '../lib/batalha/turnos'
import { vistaParaJogador, type ContextoDoJogador } from '../lib/batalha/vistaDoJogador'
import {
  ALIADOS_MAX,
  JANELA_DOS_PEDIDOS_DE_BATALHA_MS,
  PEDIDOS_DE_BATALHA_POR_JANELA,
  type BatalhaDesfazerMessage,
  type BatalhaHostMessage,
  type BatalhaPassarMessage,
} from './protocoloDaBatalha'

/**
 * BATALHA ONE PIECE, F1 — o lado do host (seção 3.1 de
 * docs/planos/batalha-one-piece-f1-plano.md): o recorte da ordem dos turnos
 * por conexão (`batalha.estado`), os aliados da equipe (`batalha.aliados`) e
 * os dois pedidos que o jogador manda (`batalha.passar`, `batalha.desfazer`).
 *
 * Puro e síncrono como a `tiroNoHost`: a `hostSession` diz onde cada conexão
 * está e que fichas a tela dela tem; o estado da batalha mora na store do
 * mestre e chega pela ponte (`PonteDaBatalha`). Este módulo não lê store nem
 * mundo.
 *
 * Só sai o que mudou PARA A CONEXÃO: o recorte pelo texto (JSON), os aliados
 * pela referência dos personagens — o retrato pesa até 48 mil caracteres e não
 * viaja a cada "Passar a vez". Sair da batalha (ou da cena dela) manda `null`
 * uma vez.
 */

export interface SaidaDaBatalha {
  clientId: string
  msg: BatalhaHostMessage
}

/** O que o host sabe da conexão de um jogador que está numa cena em batalha. */
export interface LugarNaBatalha {
  /** `tableSceneKey` da cena dele: a chave da batalha na store do mestre. */
  sceneKey: string
  /** As fichas dele (`ownership[playerId]`). */
  meusTokens: ReadonlySet<string>
  /** Id e nome das fichas que a tela da conexão tem agora (o último recorte da cena dele). Fora daqui, a carta não sai. */
  fichasNaTela: readonly { id: string; name: string }[]
  /** Os personagens ligados às fichas que são dele de verdade (sem as emprestadas). */
  meusPersonagens: ReadonlySet<string>
}

export interface ConexaoNaBatalha {
  clientId: string
  playerId: string
  /** O nome dele na mesa, como o registro mostra quem fez ou desfez. */
  nome: string
  /** `null` = fora de batalha: sem cena, cena fora de batalha, ou a tela dele ainda não é a da cena. */
  lugar: LugarNaBatalha | null
}

/** As fichas de personagem da mesa (a forma do `RpgDoMundo`). Ausente = mapa solto: cartas sem perfil nem vida. */
export interface FichasDaMesa {
  sistema: SistemaDeRpg | null
  personagens: readonly Personagem[]
  equipes?: readonly Equipe[]
}

export interface DepsDaBatalhaNoHost {
  /** A store do mestre. Ausente = o integrador não ligou a batalha à rede: nada sai, e todo pedido é recusado. */
  ponte: PonteDaBatalha | undefined
  agora: () => number
  /** O personagem como vai ao jogador (sem a conta dona: `semDono` da sessão). */
  paraOFio: (personagem: Personagem) => Personagem
}

/** A resposta a um pedido (vazia quando passou do teto: morre calado) e se a batalha mudou — aí quem chama manda o recorte novo a todos. */
export interface RespostaDaBatalha {
  saidas: SaidaDaBatalha[]
  mudou: boolean
}

export interface BatalhaNoHost {
  /** A cada broadcast, com todas as conexões de jogador: cada uma recebe só o que mudou para ela. */
  sync(conexoes: readonly ConexaoNaBatalha[], mesa: FichasDaMesa | undefined): SaidaDaBatalha[]
  /** Conexão nova (entrada, volta, "É ela"): começa sem nada, e o recorte de agora sai já. */
  entrou(conexao: ConexaoNaBatalha, mesa: FichasDaMesa | undefined): SaidaDaBatalha[]
  /** A conexão caiu ou foi expulsa: o que ela tinha não vale para a próxima. */
  caiu(clientId: string): void
  /** Expulso: o teto de pedidos dele também sai. */
  esquecer(playerId: string): void
  /** "Passar a vez": só a carta da vez, nesta rodada, de ficha dele. */
  passar(conexao: ConexaoNaBatalha, msg: BatalhaPassarMessage): RespostaDaBatalha
  /** Desfazer: só a linha dele, de tipo que o jogador desfaz, e só na vez dele (`podeDesfazer`). */
  desfazer(conexao: ConexaoNaBatalha, msg: BatalhaDesfazerMessage): RespostaDaBatalha
}

const NADA: RespostaDaBatalha = { saidas: [], mudou: false }

const mesmasReferencias = (a: readonly Personagem[], b: readonly Personagem[]): boolean => a.length === b.length && a.every((personagem, i) => personagem === b[i])

export function criarBatalhaNoHost(deps: DepsDaBatalhaNoHost): BatalhaNoHost {
  // Por clientId: o JSON do último `batalha.estado`. Ausente = nada enviado (ou o `null` já foi).
  const estadoEnviado = new Map<string, string>()
  // Por clientId: os aliados do último `batalha.aliados`, pela referência.
  const aliadosEnviados = new Map<string, readonly Personagem[]>()
  // Por playerId: os instantes dos pedidos na janela (PEDIDOS_DE_BATALHA_POR_JANELA).
  const pedidos = new Map<string, number[]>()

  /** Mais um pedido do jogador na janela; `false` = passou do teto. */
  const cabePedido = (playerId: string): boolean => {
    const agora = deps.agora()
    const recentes = (pedidos.get(playerId) ?? []).filter((at) => agora - at < JANELA_DOS_PEDIDOS_DE_BATALHA_MS)
    const cabe = recentes.length < PEDIDOS_DE_BATALHA_POR_JANELA
    pedidos.set(playerId, cabe ? [...recentes, agora] : recentes)
    return cabe
  }

  const contextoDe = (conexao: ConexaoNaBatalha, lugar: LugarNaBatalha, mesa: FichasDaMesa | undefined): ContextoDoJogador => {
    const personagens = mesa?.personagens ?? []
    const equipes = mesa?.equipes
    return {
      playerId: conexao.playerId,
      meusTokens: lugar.meusTokens,
      tokensNoRecorte: new Map(lugar.fichasNaTela.map((ficha) => [ficha.id, ficha.name])),
      meusPersonagens: lugar.meusPersonagens,
      // Equipe por PERSONAGEM (Q2): NPC nunca, jogador de outra equipe nunca.
      aliados: aliadosDe(lugar.meusPersonagens, equipes, personagens),
      equipes,
      personagens,
      sistema: mesa?.sistema ?? null,
    }
  }

  /**
   * Os aliados que estão NA ORDEM desta batalha, na ordem da aventura e até o
   * teto: o perfil e a vida só abrem pela carta, e o aliado fora da luta seria
   * só peso no fio.
   */
  const aliadosNaOrdem = (cena: BatalhaEmTurnos, aliados: ReadonlySet<string>, personagens: readonly Personagem[]): Personagem[] => {
    const naOrdem = new Set<string>()
    for (const carta of cena.turnos.cartas) if (carta.personagemId !== null && aliados.has(carta.personagemId)) naOrdem.add(carta.personagemId)
    return personagens.filter((personagem) => naOrdem.has(personagem.id)).slice(0, ALIADOS_MAX)
  }

  const syncDe = (conexao: ConexaoNaBatalha, mesa: FichasDaMesa | undefined): SaidaDaBatalha[] => {
    const { clientId, lugar } = conexao
    const cena = lugar === null || deps.ponte === undefined ? null : deps.ponte.cena(lugar.sceneKey)
    if (lugar === null || cena === null) {
      aliadosEnviados.delete(clientId)
      if (!estadoEnviado.has(clientId)) return []
      // O `null` leva a faixa e os perfis dos aliados embora (o jogador limpa os dois).
      estadoEnviado.delete(clientId)
      return [{ clientId, msg: { type: 'batalha.estado', estado: null } }]
    }
    const ctx = contextoDe(conexao, lugar, mesa)
    const saidas: SaidaDaBatalha[] = []
    // Os aliados ANTES do recorte: quando a faixa chega, a carta do aliado já acha o personagem dele.
    const aliados = aliadosNaOrdem(cena, ctx.aliados, ctx.personagens)
    const antes = aliadosEnviados.get(clientId)
    // Primeira vez sem aliado nenhum não manda a lista vazia: ausente, para o jogador, já é "nenhum".
    const mudaram = antes === undefined ? aliados.length > 0 : !mesmasReferencias(antes, aliados)
    if (mudaram) saidas.push({ clientId, msg: { type: 'batalha.aliados', personagens: aliados.map(deps.paraOFio) } })
    aliadosEnviados.set(clientId, aliados)
    const estado = vistaParaJogador(cena, ctx)
    const texto = JSON.stringify(estado)
    if (estadoEnviado.get(clientId) !== texto) {
      saidas.push({ clientId, msg: { type: 'batalha.estado', estado } })
      estadoEnviado.set(clientId, texto)
    }
    return saidas
  }

  const resultado = (clientId: string, reqId: string, ok: boolean): SaidaDaBatalha => ({ clientId, msg: { type: 'batalha.resultado', reqId, ok } })

  /** O autor no registro. O nome não decide nada: quem pode é conferido pelo `playerId`. */
  const autorDe = (conexao: ConexaoNaBatalha): AutorDaAcao => ({ tipo: 'jogador', playerId: conexao.playerId, nome: conexao.nome })

  return {
    sync(conexoes, mesa) {
      // Conexão que caiu ou saiu não recebe mais nada: a chave dela só ocuparia memória.
      const vivas = new Set(conexoes.map((conexao) => conexao.clientId))
      for (const clientId of estadoEnviado.keys()) if (!vivas.has(clientId)) estadoEnviado.delete(clientId)
      for (const clientId of aliadosEnviados.keys()) if (!vivas.has(clientId)) aliadosEnviados.delete(clientId)
      return conexoes.flatMap((conexao) => syncDe(conexao, mesa))
    },

    entrou(conexao, mesa) {
      estadoEnviado.delete(conexao.clientId)
      aliadosEnviados.delete(conexao.clientId)
      return syncDe(conexao, mesa)
    },

    caiu(clientId) {
      estadoEnviado.delete(clientId)
      aliadosEnviados.delete(clientId)
    },

    esquecer(playerId) {
      pedidos.delete(playerId)
    },

    passar(conexao, msg) {
      // Acima do teto morre calado: nem a recusa sai (o molde dos pedidos de ficha).
      if (!cabePedido(conexao.playerId)) return NADA
      // Uma recusa só, sem motivo: motivo ensinaria quais cartas e rodadas existem.
      const recusa: RespostaDaBatalha = { saidas: [resultado(conexao.clientId, msg.reqId, false)], mudou: false }
      const { ponte } = deps
      const { lugar } = conexao
      if (ponte === undefined || lugar === null) return recusa
      const cena = ponte.cena(lugar.sceneKey)
      const daVez = cena === null ? null : cartaDaVez(cena.turnos)
      // A vez tem de ser ESTA carta, NESTA rodada, de ficha dele: o clique duplo e o reenvio acham a vez já andada.
      if (cena === null || daVez === null || daVez.id !== msg.cartaId || cena.turnos.rodada !== msg.rodada || !lugar.meusTokens.has(daVez.tokenId)) return recusa
      const ok = ponte.passarVez(lugar.sceneKey, autorDe(conexao), { cartaId: msg.cartaId, rodada: msg.rodada })
      return { saidas: [resultado(conexao.clientId, msg.reqId, ok)], mudou: ok }
    },

    desfazer(conexao, msg) {
      if (!cabePedido(conexao.playerId)) return NADA
      const recusa: RespostaDaBatalha = { saidas: [resultado(conexao.clientId, msg.reqId, false)], mudou: false }
      const { ponte } = deps
      const { lugar } = conexao
      if (ponte === undefined || lugar === null) return recusa
      const cena = ponte.cena(lugar.sceneKey)
      if (cena === null) return recusa
      const linha = cena.registro.find((candidata) => candidata.id === msg.linhaId)
      const daVez = cartaDaVez(cena.turnos)
      const vezDele = daVez !== null && lugar.meusTokens.has(daVez.tokenId)
      // Só a linha DELE (pelo playerId, nunca pelo nome), de tipo que o jogador desfaz, não desfeita, e na vez dele.
      if (linha === undefined || !podeDesfazer(linha, { tipo: 'jogador', playerId: conexao.playerId }, vezDele)) return recusa
      const ok = ponte.desfazer(lugar.sceneKey, msg.linhaId, autorDe(conexao))
      return { saidas: [resultado(conexao.clientId, msg.reqId, ok)], mudou: ok }
    },
  }
}
