import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { aliadosDe, type Equipe } from '../lib/batalha/equipes'
import type { BatalhaEmTurnos, PonteDaBatalha } from '../lib/batalha/ponte'
import { podeDesfazer } from '../lib/batalha/registro'
import { cartaDaVez, type AutorDaAcao } from '../lib/batalha/turnos'
import { efeitosParaJogador, vistaParaJogador, type ContextoDoJogador, type EfeitoParaJogador } from '../lib/batalha/vistaDoJogador'
import {
  ALIADOS_MAX,
  JANELA_DOS_PEDIDOS_DE_BATALHA_MS,
  PEDIDOS_DE_BATALHA_POR_JANELA,
  type BatalhaAgirMessage,
  type BatalhaArmasMessage,
  type BatalhaDanoMessage,
  type BatalhaDesfazerMessage,
  type BatalhaEvoluirMessage,
  type BatalhaHostMessage,
  type BatalhaPassarMessage,
  type BatalhaPassivaMessage,
  type BatalhaReagirMessage,
  type BatalhaZerarCargaMessage,
} from './protocoloDaBatalha'

/**
 * BATALHA ONE PIECE, F1 — o lado do host (seção 3.1 de
 * docs/planos/batalha-one-piece-f1-plano.md): o recorte da ordem dos turnos
 * por conexão (`batalha.estado`), os aliados da equipe (`batalha.aliados`) e
 * os dois pedidos que o jogador manda (`batalha.passar`, `batalha.desfazer`).
 *
 * F2 (seção 2.4 de docs/planos/batalha-one-piece-f2-plano.md): os pedidos
 * `batalha.agir`, `batalha.reagir`, `batalha.dano`, `batalha.armas` e
 * `batalha.zerarCarga` (posse e
 * vez conferidas aqui; a regra, na store), o mesmo `reqId` devolvendo o mesmo
 * `ok` sem agir de novo, e as animações (`batalha.efeitos`) só com fichas que
 * a tela da conexão tem, sem reprise ao entrar. O d20 da reação é rolado na
 * store (processo do host); nenhum pedido traz dado.
 *
 * F3 (fatia T): os números da forma (efeito "transformacao") só às conexões
 * donas da ficha ou aliadas (`numerosVisiveis`); a imagem da forma e os selos
 * vão no recorte (`vistaParaJogador`).
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
  /** F2: tokenId → personagemId das mesmas fichas de `meusPersonagens` (o dano livre só vale numa delas). */
  personagemDaFicha: ReadonlyMap<string, string>
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
  /**
   * F2: agir. Na vez: a carta da vez nesta rodada, token dele e personagem
   * dele. Fora da vez (`vez` null): só um contra-ataque guardado de ficha dele
   * (Q6). Alvos só entre as fichas que a tela dele tem.
   * F3: `transformar` e `destransformar` só na vez (a forma é do personagem da
   * carta da vez; a store confere o cartão). Selo à mão é só do mestre (direto
   * na store): pelo fio, só o sugerido que vai no golpe. Tipos de habilidade
   * F2: os mods desse selo a store filtra pelo sistema (`seloPedidoValido`);
   * natureza e cartaoId ela tira da técnica, nunca do pedido.
   */
  agir(conexao: ConexaoNaBatalha, msg: BatalhaAgirMessage): RespostaDaBatalha
  /** F2: reagir. Com golpe: o golpe está pendente e a ficha é alvo dele ainda sem resolver. Livre: token dele. */
  reagir(conexao: ConexaoNaBatalha, msg: BatalhaReagirMessage): RespostaDaBatalha
  /** F2: dano livre só numa ficha dele com personagem. */
  dano(conexao: ConexaoNaBatalha, msg: BatalhaDanoMessage): RespostaDaBatalha
  /** F2: as armas levadas, só de personagem dele com carta na ordem; troca quando quiser (Q8). */
  armas(conexao: ConexaoNaBatalha, msg: BatalhaArmasMessage): RespostaDaBatalha
  /** Zerar a concentração: só de personagem dele com carta na ordem, a qualquer hora (não só na vez). */
  zerarCarga(conexao: ConexaoNaBatalha, msg: BatalhaZerarCargaMessage): RespostaDaBatalha
  /**
   * Tipos de habilidade F3: a passiva de ficha DELE de verdade (token e
   * personagem dele, carta na ordem), fora da vez. O alvo escolhido, só entre
   * as fichas que a tela dele tem. A regra (é passiva, ligada ou não, custo,
   * teto de selos, Aplicar só com o lembrete) a store confere.
   */
  passiva(conexao: ConexaoNaBatalha, msg: BatalhaPassivaMessage): RespostaDaBatalha
  /**
   * Tipos de habilidade F4: Evoluir a técnica de ficha DELE de verdade (token
   * e personagem dele, carta na ordem), só na vez de uma carta dele com o
   * mesmo personagem. A regra (a técnica evolui, ainda não evoluiu, SP) a
   * store confere.
   */
  evoluir(conexao: ConexaoNaBatalha, msg: BatalhaEvoluirMessage): RespostaDaBatalha
}

const NADA: RespostaDaBatalha = { saidas: [], mudou: false }

/** F2: as respostas guardadas por conexão para o `reqId` repetido (o cliente não tem mais que isso no ar). */
const RESPOSTAS_GUARDADAS = 32

const mesmasReferencias = (a: readonly Personagem[], b: readonly Personagem[]): boolean => a.length === b.length && a.every((personagem, i) => personagem === b[i])

export function criarBatalhaNoHost(deps: DepsDaBatalhaNoHost): BatalhaNoHost {
  // Por clientId: o JSON do último `batalha.estado`. Ausente = nada enviado (ou o `null` já foi).
  const estadoEnviado = new Map<string, string>()
  // Por clientId: os aliados do último `batalha.aliados`, pela referência.
  const aliadosEnviados = new Map<string, readonly Personagem[]>()
  // Por playerId: os instantes dos pedidos na janela (PEDIDOS_DE_BATALHA_POR_JANELA).
  const pedidos = new Map<string, number[]>()
  // F2, por clientId: a cena e o último `seq` de efeito já passado à conexão (enviado ou pulado). Ausente = marca no próximo sync, sem reprise.
  const efeitoVisto = new Map<string, { sceneKey: string; seq: number }>()
  // F2, por clientId: reqId → ok, as últimas RESPOSTAS_GUARDADAS, na ordem de chegada.
  const respostas = new Map<string, Map<string, boolean>>()

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
      efeitoVisto.delete(clientId)
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
    // Os efeitos DEPOIS do recorte: o jogador só os aceita com a faixa na tela.
    const efeitos = efeitosNovos(clientId, lugar.sceneKey, cena, ctx.tokensNoRecorte, numerosVisiveisDe(cena, ctx))
    if (efeitos !== null) saidas.push({ clientId, msg: { type: 'batalha.efeitos', efeitos } })
    return saidas
  }

  /**
   * F2: os efeitos de `seq` maior que o último passado à conexão, só com
   * fichas que a tela dela tem (`efeitosParaJogador`). A marca anda até o
   * último `seq` da cena mesmo quando nada sai: o efeito que ela não pôde ver
   * não vira reprise depois. Primeira vez nesta cena (entrada, volta, cena
   * nova) ou `seq` que recomeçou: só marca. `null` = nada a mandar.
   */
  const efeitosNovos = (
    clientId: string,
    sceneKey: string,
    cena: BatalhaEmTurnos,
    tokensNoRecorte: ReadonlyMap<string, string>,
    numerosVisiveis: ReadonlySet<string>,
  ): EfeitoParaJogador[] | null => {
    const todos = cena.efeitos ?? []
    const ultimo = todos.at(-1)?.seq ?? 0
    const visto = efeitoVisto.get(clientId)
    efeitoVisto.set(clientId, { sceneKey, seq: ultimo })
    if (visto === undefined || visto.sceneKey !== sceneKey || visto.seq > ultimo || visto.seq === ultimo) return null
    const novos = efeitosParaJogador(todos, visto.seq, new Set(tokensNoRecorte.keys()), numerosVisiveis)
    return novos.length === 0 ? null : novos
  }

  /**
   * F3: as fichas cujos números da forma saem a esta conexão (os `numeros` do
   * efeito "transformacao"): as dele e as dos aliados de equipe, a mesma regra
   * da vida na carta (`ladoDa` da vista: "eu" ou "aliado"). NPC nunca entra.
   */
  const numerosVisiveisDe = (cena: BatalhaEmTurnos, ctx: ContextoDoJogador): ReadonlySet<string> => {
    const visiveis = new Set<string>(ctx.meusTokens)
    for (const carta of cena.turnos.cartas) {
      const { personagemId } = carta
      if (personagemId !== null && (ctx.meusPersonagens.has(personagemId) || ctx.aliados.has(personagemId))) visiveis.add(carta.tokenId)
    }
    return visiveis
  }

  const resultado = (clientId: string, reqId: string, ok: boolean): SaidaDaBatalha => ({ clientId, msg: { type: 'batalha.resultado', reqId, ok } })

  /** O autor no registro. O nome não decide nada: quem pode é conferido pelo `playerId`. */
  const autorDe = (conexao: ConexaoNaBatalha): AutorDaAcao => ({ tipo: 'jogador', playerId: conexao.playerId, nome: conexao.nome })

  /**
   * F2: o pedido passa pelo teto e, se o `reqId` já veio desta conexão, a
   * resposta de antes sai de novo sem `decidir` (sem agir de novo). Por
   * conexão: o `reqId` nasce no cliente, e outra conexão pode repeti-lo.
   * `decidir` devolve o `ok` (recusa do host ou o que a store fez).
   */
  const pedidoUnico = (conexao: ConexaoNaBatalha, reqId: string, decidir: () => boolean): RespostaDaBatalha => {
    if (!cabePedido(conexao.playerId)) return NADA
    const guardadas = respostas.get(conexao.clientId) ?? new Map<string, boolean>()
    const antes = guardadas.get(reqId)
    if (antes !== undefined) return { saidas: [resultado(conexao.clientId, reqId, antes)], mudou: false }
    const ok = decidir()
    guardadas.set(reqId, ok)
    if (guardadas.size > RESPOSTAS_GUARDADAS) {
      const maisVelha = guardadas.keys().next()
      if (maisVelha.done !== true) guardadas.delete(maisVelha.value)
    }
    respostas.set(conexao.clientId, guardadas)
    return { saidas: [resultado(conexao.clientId, reqId, ok)], mudou: ok }
  }

  /** A cena em batalha da conexão, com a ponte; `null` = fora (o pedido é recusado). */
  const cenaDa = (conexao: ConexaoNaBatalha): { ponte: PonteDaBatalha; lugar: LugarNaBatalha; cena: BatalhaEmTurnos } | null => {
    const { ponte } = deps
    const { lugar } = conexao
    if (ponte === undefined || lugar === null) return null
    const cena = ponte.cena(lugar.sceneKey)
    return cena === null ? null : { ponte, lugar, cena }
  }

  /** A ficha é DELE: o token é dele, ou o personagem ligado é dele (a mesma regra do recorte, `vistaDoJogador`). */
  const fichaDele = (lugar: LugarNaBatalha, tokenId: string, personagemId: string | null): boolean =>
    lugar.meusTokens.has(tokenId) || (personagemId !== null && lugar.meusPersonagens.has(personagemId))

  /** Na vez: a carta da vez, nesta rodada, token dele e personagem dele. Fora da vez: um contra-ataque guardado de ficha dele. */
  const podePedirAcao = (lugar: LugarNaBatalha, cena: BatalhaEmTurnos, msg: BatalhaAgirMessage): boolean => {
    const { vez, pedido } = msg
    // F3: Ativar e Desfazer a forma só na vez dele, na ficha da vez (que é dele): nunca fora da vez, nem na ficha de outro.
    if ((pedido.tipo === 'transformar' || pedido.tipo === 'destransformar') && vez === null) return false
    if (vez === null) {
      // O parser só deixa `vez` null com `contraDe`; o `concentrar` nunca chega aqui.
      const contraDe = pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
      return contraDe !== undefined && (cena.turnos.contras ?? []).some((contra) => contra.golpeId === contraDe && fichaDele(lugar, contra.tokenId, contra.personagemId))
    }
    const daVez = cartaDaVez(cena.turnos)
    return (
      daVez !== null &&
      daVez.id === vez.cartaId &&
      cena.turnos.rodada === vez.rodada &&
      lugar.meusTokens.has(daVez.tokenId) &&
      daVez.personagemId !== null &&
      lugar.meusPersonagens.has(daVez.personagemId)
    )
  }

  /** A ficha tem carta na ordem desta batalha (a reação livre e o dano livre só valem nela). */
  const naOrdem = (cena: BatalhaEmTurnos, tokenId: string): boolean => cena.turnos.cartas.some((carta) => carta.tokenId === tokenId)

  /** Os alvos só entre as fichas que a tela dele tem: o pedido não acha token que ele não vê. */
  const alvosNaTela = (lugar: LugarNaBatalha, msg: BatalhaAgirMessage): boolean => {
    const { pedido } = msg
    if (pedido.tipo !== 'atacar' && pedido.tipo !== 'habilidade') return true
    const naTela = new Set(lugar.fichasNaTela.map((ficha) => ficha.id))
    return pedido.alvos.every((alvo) => naTela.has(alvo.tokenId))
  }

  return {
    sync(conexoes, mesa) {
      // Conexão que caiu ou saiu não recebe mais nada: a chave dela só ocuparia memória.
      const vivas = new Set(conexoes.map((conexao) => conexao.clientId))
      for (const clientId of estadoEnviado.keys()) if (!vivas.has(clientId)) estadoEnviado.delete(clientId)
      for (const clientId of aliadosEnviados.keys()) if (!vivas.has(clientId)) aliadosEnviados.delete(clientId)
      for (const clientId of efeitoVisto.keys()) if (!vivas.has(clientId)) efeitoVisto.delete(clientId)
      for (const clientId of respostas.keys()) if (!vivas.has(clientId)) respostas.delete(clientId)
      return conexoes.flatMap((conexao) => syncDe(conexao, mesa))
    },

    entrou(conexao, mesa) {
      estadoEnviado.delete(conexao.clientId)
      aliadosEnviados.delete(conexao.clientId)
      // Sem reprise: o primeiro sync marca o `seq` de agora e não manda os velhos.
      efeitoVisto.delete(conexao.clientId)
      return syncDe(conexao, mesa)
    },

    caiu(clientId) {
      estadoEnviado.delete(clientId)
      aliadosEnviados.delete(clientId)
      efeitoVisto.delete(clientId)
      respostas.delete(clientId)
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

    // F2: uma recusa só, sem motivo, como na F1. A store confere a regra (`podeAgir` etc.) e rola o d20.
    agir(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        if (!podePedirAcao(lugar, cena, msg) || !alvosNaTela(lugar, msg)) return false
        return ponte.agir(lugar.sceneKey, autorDe(conexao), msg.vez, msg.pedido)
      })
    },

    reagir(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        const { pedido } = msg
        if (pedido.golpeId === null) {
          // Reação livre (o botão Reação sem golpe esperando): só com token dele que está na ordem.
          if (!lugar.meusTokens.has(pedido.tokenId) || !naOrdem(cena, pedido.tokenId)) return false
        } else {
          const golpe = (cena.turnos.golpes ?? []).find((candidato) => candidato.id === pedido.golpeId)
          const alvo = golpe?.alvos.find((candidato) => candidato.tokenId === pedido.tokenId)
          // O golpe ainda espera, e a ficha é um alvo DELE ainda sem resolver.
          if (alvo === undefined || alvo.danoFinal !== undefined || !fichaDele(lugar, alvo.tokenId, alvo.personagemId)) return false
          // "Não reagir" depois do d20 rolado seria fugir do resultado (o 1 natural, do crítico): só o mestre marca.
          if (pedido.tipo === 'naoReagir' && alvo.rolagem !== undefined) return false
          // "Passar" é a saída do jogador DEPOIS do dado: toma o golpe inteiro e o 1 natural continua crítico (a store decide a saída).
          if (pedido.tipo === 'passar' && alvo.rolagem === undefined) return false
          // Tipos de habilidade F1: a técnica vem NO LUGAR do d20 (antes dele), só em golpe que deixa reagir e em ficha com personagem.
          // A técnica ser do personagem, de reação, disponível e paga, e a saída no conjunto, a store confere (`motivoDaReacaoComTecnica`).
          if (pedido.tipo === 'tecnica' && (!alvo.podeReagir || alvo.rolagem !== undefined || alvo.personagemId === null)) return false
        }
        return ponte.reagir(lugar.sceneKey, autorDe(conexao), pedido)
      })
    },

    dano(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        // Só numa ficha DELE de verdade, com personagem e na ordem: nunca na emprestada nem no NPC (a vida deles é do mestre).
        if (!lugar.meusTokens.has(msg.tokenId) || !lugar.personagemDaFicha.has(msg.tokenId) || !naOrdem(cena, msg.tokenId)) return false
        return ponte.darDano(lugar.sceneKey, autorDe(conexao), msg.tokenId, msg.valor)
      })
    },

    armas(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        // Personagem dele com carta na ordem. Sem "ainda não escolheu": troca quando quiser (Q8); o limite é da store.
        if (!lugar.meusPersonagens.has(msg.personagemId) || !cena.turnos.cartas.some((carta) => carta.personagemId === msg.personagemId)) return false
        return ponte.escolherArmas(lugar.sceneKey, autorDe(conexao), msg.personagemId, msg.armas)
      })
    },

    zerarCarga(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        // Personagem dele com carta na ordem; fora da vez também (ele perde a concentração ao tomar o golpe).
        if (!lugar.meusPersonagens.has(msg.personagemId) || !cena.turnos.cartas.some((carta) => carta.personagemId === msg.personagemId)) return false
        return ponte.zerarCarga(lugar.sceneKey, autorDe(conexao), msg.personagemId)
      })
    },

    passiva(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        const { pedido } = msg
        const carta = cena.turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
        // A passiva é do personagem de uma ficha DELE de verdade: nunca da emprestada nem do NPC (essas o mestre ativa).
        if (ponte.passiva === undefined || carta === undefined || carta.personagemId === null) return false
        if (!lugar.meusTokens.has(carta.tokenId) || !lugar.meusPersonagens.has(carta.personagemId)) return false
        // O oponente escolhido, só entre as fichas que a tela dele tem: o pedido não acha token que ele não vê.
        if (pedido.tipo === 'passiva' && pedido.alvoTokenId !== undefined && !lugar.fichasNaTela.some((ficha) => ficha.id === pedido.alvoTokenId)) return false
        return ponte.passiva(lugar.sceneKey, autorDe(conexao), pedido)
      })
    },

    evoluir(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        const { pedido } = msg
        const carta = cena.turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
        // A técnica é do personagem de uma ficha DELE de verdade: nunca da emprestada nem do NPC (essas o mestre evolui).
        if (ponte.evoluir === undefined || carta === undefined || carta.personagemId === null) return false
        if (!lugar.meusTokens.has(carta.tokenId) || !lugar.meusPersonagens.has(carta.personagemId)) return false
        // Só na vez dele: a carta da vez é token dele com o MESMO personagem (a store confere de novo).
        const daVez = cartaDaVez(cena.turnos)
        if (daVez === null || daVez.personagemId !== carta.personagemId || !lugar.meusTokens.has(daVez.tokenId)) return false
        return ponte.evoluir(lugar.sceneKey, autorDe(conexao), pedido)
      })
    },
  }
}
