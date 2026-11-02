import { aliadosDe, type Equipe } from '../lib/batalha/equipes'
import type { FichaLida } from '../lib/dbt/batalha/leitura'
import type { PonteDaBatalhaDBT } from '../lib/dbt/batalha/ponte'
import { podeDesfazerDBT } from '../lib/dbt/batalha/registro'
import type { AutorDBT, ComandoDBT } from '../lib/dbt/batalha/tipos'
import {
  efeitosParaJogadorDBT,
  numerosVisiveisDBT,
  podeComandar,
  vistaParaJogadorDBT,
  type CenaParaVistaDBT,
  type ContextoDoJogadorDBT,
} from '../lib/dbt/batalha/vista'
import { paraOFio, type Personagem } from '../lib/personagem'
import {
  ALIADOS_DBT_MAX,
  JANELA_DOS_PEDIDOS_DBT_MS,
  MOTIVO_DBT_MAX,
  PEDIDOS_DBT_POR_JANELA,
  type BatalhaDBTAgirMessage,
  type BatalhaDBTDeclararMessage,
  type BatalhaDBTDesfazerMessage,
  type BatalhaDBTHostMessage,
  type BatalhaDBTPassarMessage,
  type BatalhaDBTResponderMessage,
} from './protocoloDaBatalhaDBT'

/**
 * BATALHA DRAGON BALL TALES — o lado do host (docs/planos/dbt-batalha.md,
 * seção 17). O molde do One Piece (`batalhaNoHost.ts`) COPIADO, não
 * importado (aquele arquivo mistura regra do One Piece): o recorte por
 * conexão com diff pelo JSON, os aliados da equipe pela referência (pelo
 * `paraOFio`), o teto de pedidos por jogador, o `reqId` idempotente por
 * conexão, os efeitos pelo `seq` e o `null` uma vez ao sair.
 * Teto, respostas guardadas e marca de efeito são DESTE módulo: nada se
 * mistura com a batalha One Piece.
 *
 * Puro e síncrono: a `hostSession` diz onde cada conexão está e que fichas a
 * tela dela tem; o estado mora na store do mestre e chega pela ponte
 * (`PonteDaBatalhaDBT`). Antes da store, cada pedido passa por
 * `podeComandar` (posse, vez, a chave entre as opções da vista, alvos na
 * tela). O autor é sempre o jogador da conexão, montado aqui.
 */

export interface SaidaDaBatalhaDBT {
  clientId: string
  msg: BatalhaDBTHostMessage
}

/** O mesmo formato do `LugarNaBatalha` do One Piece, mais a escala do mapa da cena. */
export interface LugarNaBatalhaDBT {
  /** `tableSceneKey` da cena dele: a chave da batalha na store do mestre. */
  sceneKey: string
  meusTokens: ReadonlySet<string>
  fichasNaTela: readonly { id: string; name: string }[]
  /** Personagens das fichas que são dele de verdade (sem as emprestadas). */
  meusPersonagens: ReadonlySet<string>
  personagemDaFicha: ReadonlyMap<string, string>
  /** Metros por casa do mapa da cena (`metrosPorCasa`); ausente = 1,5. */
  metrosPorCasa?: number
}

export interface ConexaoNaBatalhaDBT {
  clientId: string
  playerId: string
  /** O nome dele na mesa, como o registro mostra quem fez ou desfez. */
  nome: string
  /** `null` = fora de batalha (sem cena, cena fora de batalha, tela de outra cena). */
  lugar: LugarNaBatalhaDBT | null
}

/** As fichas da mesa (a forma do `RpgDoMundo`): só para saber quem é aliado. */
export interface FichasDaMesaDBT {
  personagens: readonly Personagem[]
  equipes?: readonly Equipe[]
}

export interface DepsDaBatalhaDBTNoHost {
  /** Ausente = a batalha DBT não está ligada à rede: nada sai, e todo pedido é recusado. */
  ponte: PonteDaBatalhaDBT | undefined
  agora: () => number
}

/** A resposta a um pedido (vazia acima do teto: morre calado) e se a batalha mudou. */
export interface RespostaDaBatalhaDBT {
  saidas: SaidaDaBatalhaDBT[]
  mudou: boolean
}

export interface BatalhaDBTNoHost {
  /** A cada broadcast, com todas as conexões de jogador: cada uma recebe só o que mudou para ela. */
  sync(conexoes: readonly ConexaoNaBatalhaDBT[], mesa: FichasDaMesaDBT | undefined): SaidaDaBatalhaDBT[]
  /** Conexão nova (entrada, volta): começa sem nada, e o recorte de agora sai já. */
  entrou(conexao: ConexaoNaBatalhaDBT, mesa: FichasDaMesaDBT | undefined): SaidaDaBatalhaDBT[]
  caiu(clientId: string): void
  esquecer(playerId: string): void
  declarar(conexao: ConexaoNaBatalhaDBT, msg: BatalhaDBTDeclararMessage): RespostaDaBatalhaDBT
  agir(conexao: ConexaoNaBatalhaDBT, msg: BatalhaDBTAgirMessage): RespostaDaBatalhaDBT
  responder(conexao: ConexaoNaBatalhaDBT, msg: BatalhaDBTResponderMessage): RespostaDaBatalhaDBT
  passar(conexao: ConexaoNaBatalhaDBT, msg: BatalhaDBTPassarMessage): RespostaDaBatalhaDBT
  desfazer(conexao: ConexaoNaBatalhaDBT, msg: BatalhaDBTDesfazerMessage): RespostaDaBatalhaDBT
}

/** A decisão sobre um pedido: `motivo` só na recusa do motor. */
interface Decisao {
  ok: boolean
  motivo?: string
}

const NADA: RespostaDaBatalhaDBT = { saidas: [], mudou: false }
const RECUSA_CALADA: Decisao = { ok: false }

/** O motivo do motor cabe no fio (`MOTIVO_DBT_MAX`): o leitor do jogador derruba o resultado acima do teto. */
function motivoNoFio(motivo: string): string {
  return motivo.length <= MOTIVO_DBT_MAX ? motivo : `${motivo.slice(0, MOTIVO_DBT_MAX - 1)}…`
}
/** As respostas guardadas por conexão para o `reqId` repetido (o mesmo número do One Piece). */
const RESPOSTAS_GUARDADAS = 32
const METROS_POR_CASA_PADRAO = 1.5
const SEM_PERSONAGENS: readonly Personagem[] = []

const mesmasReferencias = (a: readonly Personagem[], b: readonly Personagem[]): boolean => a.length === b.length && a.every((personagem, i) => personagem === b[i])

/**
 * Os aliados que estão NA ORDEM desta batalha, na ordem da aventura e até o
 * teto: o perfil só abre pela carta, e o aliado fora da luta seria só peso no fio.
 */
function aliadosNaOrdem(cena: CenaParaVistaDBT, aliados: ReadonlySet<string>, personagens: readonly Personagem[]): Personagem[] {
  const naOrdem = new Set<string>()
  for (const id of cena.ordem.cartas) {
    const personagemId = Object.hasOwn(cena.combatentes, id) ? cena.combatentes[id].personagemId : null
    if (personagemId !== null && aliados.has(personagemId)) naOrdem.add(personagemId)
  }
  return personagens.filter((personagem) => naOrdem.has(personagem.id)).slice(0, ALIADOS_DBT_MAX)
}

export function criarBatalhaDBTNoHost(deps: DepsDaBatalhaDBTNoHost): BatalhaDBTNoHost {
  // Por clientId: o JSON do último `batalhaDBT.estado`. Ausente = nada enviado (ou o `null` já foi).
  const estadoEnviado = new Map<string, string>()
  // Por clientId: os aliados do último `batalhaDBT.aliados`, pela referência.
  const aliadosEnviados = new Map<string, readonly Personagem[]>()
  // Por playerId: os instantes dos pedidos DBT na janela.
  const pedidos = new Map<string, number[]>()
  // Por clientId: a cena e o último `seq` de efeito já passado. Ausente = marca no próximo sync, sem reprise.
  const efeitoVisto = new Map<string, { sceneKey: string; seq: number }>()
  // Por clientId: reqId → a decisão, as últimas RESPOSTAS_GUARDADAS.
  const respostas = new Map<string, Map<string, Decisao>>()

  const cabePedido = (playerId: string): boolean => {
    const agora = deps.agora()
    const recentes = (pedidos.get(playerId) ?? []).filter((at) => agora - at < JANELA_DOS_PEDIDOS_DBT_MS)
    const cabe = recentes.length < PEDIDOS_DBT_POR_JANELA
    pedidos.set(playerId, cabe ? [...recentes, agora] : recentes)
    return cabe
  }

  const contextoDe = (conexao: ConexaoNaBatalhaDBT, lugar: LugarNaBatalhaDBT, mesa: FichasDaMesaDBT | undefined): ContextoDoJogadorDBT => ({
    playerId: conexao.playerId,
    meusTokens: lugar.meusTokens,
    tokensNoRecorte: new Map(lugar.fichasNaTela.map((ficha) => [ficha.id, ficha.name])),
    meusPersonagens: lugar.meusPersonagens,
    // Equipe por PERSONAGEM: NPC nunca, jogador de outra equipe nunca.
    aliados: aliadosDe(lugar.meusPersonagens, mesa?.equipes, mesa?.personagens ?? SEM_PERSONAGENS),
    metrosPorCasa: lugar.metrosPorCasa ?? METROS_POR_CASA_PADRAO,
  })

  /**
   * Os efeitos de `seq` maior que o último passado à conexão. A marca anda
   * até o último `seq` da cena mesmo quando nada sai; primeira vez nesta cena
   * (ou `seq` que recomeçou): só marca, sem reprise.
   */
  const efeitosNovos = (clientId: string, sceneKey: string, cena: CenaParaVistaDBT, ctx: ContextoDoJogadorDBT) => {
    const ultimo = cena.efeitos.at(-1)?.seq ?? 0
    const visto = efeitoVisto.get(clientId)
    efeitoVisto.set(clientId, { sceneKey, seq: ultimo })
    if (visto === undefined || visto.sceneKey !== sceneKey || visto.seq >= ultimo) return null
    const novos = efeitosParaJogadorDBT(cena.efeitos, visto.seq, new Set(ctx.tokensNoRecorte.keys()), numerosVisiveisDBT(cena, ctx))
    return novos.length === 0 ? null : novos
  }

  const syncDe = (
    conexao: ConexaoNaBatalhaDBT,
    mesa: FichasDaMesaDBT | undefined,
    fichasDa: (sceneKey: string) => ReadonlyMap<string, FichaLida | null>,
  ): SaidaDaBatalhaDBT[] => {
    const { clientId, lugar } = conexao
    const cena = lugar === null || deps.ponte === undefined ? null : deps.ponte.cena(lugar.sceneKey)
    if (lugar === null || cena === null) {
      aliadosEnviados.delete(clientId)
      efeitoVisto.delete(clientId)
      if (!estadoEnviado.has(clientId)) return []
      // Uma vez só: a cena saiu da batalha (ou ele saiu da cena). A cena de One Piece nunca recebeu nada daqui.
      // O `null` leva a faixa e os perfis dos aliados embora (o jogador limpa os dois).
      estadoEnviado.delete(clientId)
      return [{ clientId, msg: { type: 'batalhaDBT.estado', estado: null } }]
    }
    const ctx = contextoDe(conexao, lugar, mesa)
    const saidas: SaidaDaBatalhaDBT[] = []
    // Os aliados ANTES do recorte: quando a faixa chega, a carta do aliado já acha o personagem dele.
    const aliados = aliadosNaOrdem(cena, ctx.aliados, mesa?.personagens ?? SEM_PERSONAGENS)
    const antes = aliadosEnviados.get(clientId)
    // Primeira vez sem aliado nenhum não manda a lista vazia: ausente, para o jogador, já é "nenhum".
    const mudaram = antes === undefined ? aliados.length > 0 : !mesmasReferencias(antes, aliados)
    if (mudaram) saidas.push({ clientId, msg: { type: 'batalhaDBT.aliados', personagens: aliados.map(paraOFio) } })
    aliadosEnviados.set(clientId, aliados)
    const estado = vistaParaJogadorDBT(cena, fichasDa(lugar.sceneKey), ctx)
    const texto = JSON.stringify(estado)
    if (estadoEnviado.get(clientId) !== texto) {
      saidas.push({ clientId, msg: { type: 'batalhaDBT.estado', estado } })
      estadoEnviado.set(clientId, texto)
    }
    // Os efeitos DEPOIS do recorte: o jogador só os aceita com a faixa na tela.
    const efeitos = efeitosNovos(clientId, lugar.sceneKey, cena, ctx)
    if (efeitos !== null) saidas.push({ clientId, msg: { type: 'batalhaDBT.efeitos', efeitos } })
    return saidas
  }

  /** As fichas lidas de cada cena uma vez por sync (todas as conexões da cena usam as mesmas). */
  const leitorDeFichas = (): ((sceneKey: string) => ReadonlyMap<string, FichaLida | null>) => {
    const lidas = new Map<string, ReadonlyMap<string, FichaLida | null>>()
    return (sceneKey) => {
      const ja = lidas.get(sceneKey)
      if (ja !== undefined) return ja
      const fichas = deps.ponte?.fichasLidas(sceneKey) ?? new Map<string, FichaLida | null>()
      lidas.set(sceneKey, fichas)
      return fichas
    }
  }

  const resultado = (clientId: string, reqId: string, decisao: Decisao): SaidaDaBatalhaDBT => ({
    clientId,
    msg: decisao.motivo === undefined ? { type: 'batalhaDBT.resultado', reqId, ok: decisao.ok } : { type: 'batalhaDBT.resultado', reqId, ok: decisao.ok, motivo: decisao.motivo },
  })

  /** O autor no registro. O nome não decide nada: quem pode é conferido pelo `playerId`. */
  const autorDe = (conexao: ConexaoNaBatalhaDBT): AutorDBT => ({ tipo: 'jogador', playerId: conexao.playerId, nome: conexao.nome })

  /**
   * O pedido passa pelo teto e, se o `reqId` já veio desta conexão, a
   * resposta de antes sai de novo sem agir de novo. `decidir` devolve o `ok`
   * e, quando o motor recusou, o motivo dele.
   */
  const pedidoUnico = (conexao: ConexaoNaBatalhaDBT, reqId: string, decidir: () => Decisao): RespostaDaBatalhaDBT => {
    if (!cabePedido(conexao.playerId)) return NADA
    const guardadas = respostas.get(conexao.clientId) ?? new Map<string, Decisao>()
    const antes = guardadas.get(reqId)
    if (antes !== undefined) return { saidas: [resultado(conexao.clientId, reqId, antes)], mudou: false }
    const decisao = decidir()
    guardadas.set(reqId, decisao)
    if (guardadas.size > RESPOSTAS_GUARDADAS) {
      const maisVelha = guardadas.keys().next()
      if (maisVelha.done !== true) guardadas.delete(maisVelha.value)
    }
    respostas.set(conexao.clientId, guardadas)
    return { saidas: [resultado(conexao.clientId, reqId, decisao)], mudou: decisao.ok }
  }

  /**
   * Confere com a vista e manda à store; fora de batalha ou sem ponte, recusa.
   * A recusa da conferência sai SEM motivo (ensinaria quais ids e vezes
   * existem); a do motor, com o dele (o pedido já era dele, na vez dele).
   */
  const comandar = (conexao: ConexaoNaBatalhaDBT, comando: ComandoDBT): Decisao => {
    const { ponte } = deps
    const { lugar } = conexao
    if (ponte === undefined || lugar === null) return RECUSA_CALADA
    const cena = ponte.cena(lugar.sceneKey)
    if (cena === null) return RECUSA_CALADA
    const posse = { playerId: conexao.playerId, meusTokens: lugar.meusTokens, tokensNoRecorte: new Map(lugar.fichasNaTela.map((ficha) => [ficha.id, ficha.name])), meusPersonagens: lugar.meusPersonagens }
    if (!podeComandar(cena, ponte.fichasLidas(lugar.sceneKey), posse, comando)) return RECUSA_CALADA
    const resposta = ponte.comando(lugar.sceneKey, autorDe(conexao), comando)
    if (resposta.ok || resposta.motivo === undefined) return { ok: resposta.ok }
    return { ok: false, motivo: motivoNoFio(resposta.motivo) }
  }

  return {
    sync(conexoes, mesa) {
      // Conexão que caiu ou saiu não recebe mais nada: a chave dela só ocuparia memória.
      const vivas = new Set(conexoes.map((conexao) => conexao.clientId))
      for (const clientId of estadoEnviado.keys()) if (!vivas.has(clientId)) estadoEnviado.delete(clientId)
      for (const clientId of aliadosEnviados.keys()) if (!vivas.has(clientId)) aliadosEnviados.delete(clientId)
      for (const clientId of efeitoVisto.keys()) if (!vivas.has(clientId)) efeitoVisto.delete(clientId)
      for (const clientId of respostas.keys()) if (!vivas.has(clientId)) respostas.delete(clientId)
      const fichasDa = leitorDeFichas()
      return conexoes.flatMap((conexao) => syncDe(conexao, mesa, fichasDa))
    },

    entrou(conexao, mesa) {
      estadoEnviado.delete(conexao.clientId)
      aliadosEnviados.delete(conexao.clientId)
      // Sem reprise: o primeiro sync marca o `seq` de agora e não manda os velhos.
      efeitoVisto.delete(conexao.clientId)
      return syncDe(conexao, mesa, leitorDeFichas())
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

    declarar(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => comandar(conexao, { tipo: 'declarar', combatenteId: msg.combatenteId, transformacaoId: msg.transformacaoId }))
    },

    agir(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () =>
        comandar(conexao, {
          tipo: 'agir',
          combatenteId: msg.combatenteId,
          vez: msg.vez,
          opcao: msg.opcao,
          alvos: msg.alvos,
          ...(msg.extras === undefined ? {} : { extras: msg.extras }),
        }),
      )
    },

    responder(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () =>
        comandar(conexao, {
          tipo: 'responder',
          pendenciaId: msg.pendenciaId,
          combatenteId: msg.combatenteId,
          opcao: msg.opcao,
          ...(msg.aposta === undefined ? {} : { aposta: msg.aposta }),
          ...(msg.atributo === undefined ? {} : { atributo: msg.atributo }),
        }),
      )
    },

    passar(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => comandar(conexao, { tipo: 'passar', vez: msg.vez }))
    },

    desfazer(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const { ponte } = deps
        const { lugar } = conexao
        if (ponte === undefined || lugar === null) return RECUSA_CALADA
        const cena = ponte.cena(lugar.sceneKey)
        const linha = cena === null ? undefined : cena.registro.find((candidata) => candidata.id === msg.linhaId)
        const autor = autorDe(conexao)
        // A mesma regra da store (`podeDesfazerDBT`): a última de pé, dele, sem d20.
        if (cena === null || linha === undefined || !podeDesfazerDBT(linha, autor, cena.registro)) return RECUSA_CALADA
        return { ok: ponte.desfazer(lugar.sceneKey, msg.linhaId, autor) }
      })
    },
  }
}
