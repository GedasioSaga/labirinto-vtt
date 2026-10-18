import type { DificuldadePesca, MinigamePesca } from '../minigames/pesca/tipos'
import type {
  PeixeNoCesto,
  PescaConviteMessage,
  PescaDesfechoDoLance,
  PescaEstadoMessage,
  PescaFimMessage,
  PescaHostMessage,
  PescaLanceMessage,
  PescaMotivoDoFim,
  PescaProntoMessage,
  PescaStatus,
  PescaVivo,
  PescaVivoMessage,
} from './protocoloDaPesca'

/**
 * MINIGAME DE PESCA AO VIVO, lado do mestre: uma sessão por pino e as regras
 * de quem entra, quem pesca e quem saiu. Puro e síncrono como a `hostSession`,
 * que o monta, confere o pino (tipo, modo, visão e distância) e encaminha as
 * mensagens.
 *
 * Decisões do usuário (18/10/2026): por pino, o mestre escolhe "Mestre chama"
 * (ele convida quem quiser) ou "Jogador toca no pino" (o jogador perto pede e
 * entra sozinho). Não há "começar" junto: cada um começa ao mandar o Pronto.
 * Prêmio e consequência são só texto — não há desfecho com efeito: nada de
 * porta, item ou recado. O peixe fica no cesto e no placar.
 *
 * Mensagem de outra sessão, de quem não entrou ou fora de fase morre calada:
 * responder "recusado" só ensinaria que ela existe.
 */

/** Uma mensagem da pesca para uma conexão (cabe em `Outbound` da sessão). */
export interface SaidaDaPesca {
  clientId: string
  msg: PescaHostMessage
}

/** `encerrada`: o mestre encerrou. Fica no painel até a próxima chamada no mesmo pino. */
export type PescaFase = 'aberta' | 'pausa' | 'encerrada'

/** O desafio congelado na abertura da sessão: editar o pino no meio não muda a pesca que está valendo. */
export interface PescaCongelada {
  pinId: string
  minigame: MinigamePesca
}

/** Um lance que terminou, como o placar do mestre lê. */
export type PescaLanceNoMestre = { lance: number } & PescaDesfechoDoLance

export interface PescaParticipanteNoMestre {
  playerId: string
  nome: string
  status: PescaStatus
  conectado: boolean
  dificuldade?: DificuldadePesca
  /** O último `pesca.vivo` (fase, lance k de N, medidor). */
  vivo?: PescaVivo
  /** Os lances que terminaram, na ordem em que chegaram. */
  lances: PescaLanceNoMestre[]
  /** O que pegou: o do `pesca.fim` de quem terminou; antes dele, o dos lances. */
  cesto: PeixeNoCesto[]
  /** O maior peixe do cesto (por cm). */
  maior?: PeixeNoCesto
}

/** O que o painel do MESTRE lê de cada pino com pesca. Nunca vai pela rede. */
export interface PescaAoVivo {
  sessao: string
  pinId: string
  npc: string
  lago: string
  entrada: MinigamePesca['entrada']
  lances: number
  fase: PescaFase
  participantes: PescaParticipanteNoMestre[]
}

export type PescaConviteResultado = { ok: true; sessao: string; convidados: number } | { ok: false; motivo: 'pino' | 'ninguem' }
export type PescaPedidoResultado = { ok: true; sessao: string } | { ok: false; motivo: 'pino' | 'modo' | 'ocupado' }

export interface ContextoDaPesca {
  /** A conexão do jogador AGORA; `null` = fora do ar ou esquecido. */
  conexaoDe(playerId: string): string | null
  randomId(): string
}

interface Participante {
  playerId: string
  nome: string
  status: PescaStatus
  dificuldade?: DificuldadePesca
  vivo?: PescaVivo
  lances: PescaLanceNoMestre[]
  /** O cesto do `pesca.fim`; ausente = ainda pescando (vale o dos lances). */
  final?: PeixeNoCesto[]
}

interface Pesca {
  sessao: string
  conf: PescaCongelada
  fase: PescaFase
  /** Na ordem em que entraram. */
  participantes: Participante[]
}

export interface PescaNoHost {
  /** "Chamar para pescar" (modo mestre): os convidados entram na sessão do pino. */
  convidar(conf: PescaCongelada, convidados: readonly { playerId: string; nome: string }[]): { outbound: SaidaDaPesca[]; resultado: PescaConviteResultado }
  /** "Pescar" (modo pino): quem pediu entra, e o convite volta só para ele. O host já conferiu visão e distância. */
  pedir(conf: PescaCongelada, jogador: { playerId: string; nome: string }): { outbound: SaidaDaPesca[]; resultado: PescaPedidoResultado }
  pronto(playerId: string, msg: PescaProntoMessage): SaidaDaPesca[]
  vivo(playerId: string, msg: PescaVivoMessage): SaidaDaPesca[]
  lance(playerId: string, msg: PescaLanceMessage): SaidaDaPesca[]
  fim(playerId: string, msg: PescaFimMessage): SaidaDaPesca[]
  /** "Pausar para todos" do pino. `null` = nada a fazer (sem sessão aberta). */
  pausar(pinId: string): SaidaDaPesca[] | null
  retomar(pinId: string): SaidaDaPesca[] | null
  encerrar(pinId: string): SaidaDaPesca[] | null
  /** A conexão do jogador é nova (entrou, voltou, "É ela"): o que ela precisa receber da pesca. */
  entrou(playerId: string): SaidaDaPesca[]
  /** A conexão caiu (já sem `conexaoDe`): quem pescava sai. */
  caiu(playerId: string): SaidaDaPesca[]
  /** O jogador foi expulso (já sem `conexaoDe`). */
  esquecer(playerId: string): SaidaDaPesca[]
  /** Cada pino com pesca (aberta, pausada ou a última encerrada), para o painel. */
  aoVivo(): PescaAoVivo[]
}

/** Quem ainda está no jogo: recebe pausa, retomada e encerramento. */
const emJogo = (p: Participante): boolean => p.status === 'convidado' || p.status === 'pescando'
const ativa = (s: Pesca): boolean => s.fase === 'aberta' || s.fase === 'pausa'

function maiorDe(cesto: readonly PeixeNoCesto[]): PeixeNoCesto | undefined {
  return cesto.reduce<PeixeNoCesto | undefined>((maior, peixe) => (maior === undefined || peixe.cm > maior.cm ? peixe : maior), undefined)
}

function cestoDe(p: Participante): PeixeNoCesto[] {
  return p.final ?? p.lances.flatMap((l) => (l.resultado === 'pegou' ? [l.peixe] : []))
}

export function criarPescaNoHost(ctx: ContextoDaPesca): PescaNoHost {
  /** Por pino: a sessão de agora (ou a última encerrada). */
  const sessoes = new Map<string, Pesca>()

  const para = (p: Participante, msg: PescaHostMessage): SaidaDaPesca[] => {
    const clientId = ctx.conexaoDe(p.playerId)
    return clientId === null ? [] : [{ clientId, msg }]
  }

  const estadoDe = (s: Pesca): PescaEstadoMessage => ({
    type: 'pesca.estado',
    sessao: s.sessao,
    fase: s.fase === 'pausa' ? 'pausa' : 'aberta',
    participantes: s.participantes.map((p) => ({ playerId: p.playerId, nome: p.nome, status: p.status })),
  })

  /** O estado a quem segue na sessão (quem saiu já recebeu o `pesca.encerra`). */
  const estadoATodos = (s: Pesca): SaidaDaPesca[] => {
    const estado = estadoDe(s)
    return s.participantes.filter((p) => p.status !== 'saiu').flatMap((p) => para(p, estado))
  }

  const conviteDe = (s: Pesca): PescaConviteMessage => {
    const m = s.conf.minigame
    return {
      type: 'pesca.convite',
      sessao: s.sessao,
      pinId: s.conf.pinId,
      npc: m.npc,
      fala: m.fala,
      lago: m.lago,
      lances: m.lances,
      permitida: m.permitida,
      premio: { ...m.premio },
      consequencia: { ...m.consequencia },
      participantes: s.participantes.map((p) => ({ playerId: p.playerId, nome: p.nome })),
    }
  }

  /** O que a conexão de quem acaba de entrar recebe: o convite, o estado e, se pausada, a pausa. */
  const boasVindas = (s: Pesca, p: Participante): SaidaDaPesca[] => [
    ...para(p, conviteDe(s)),
    ...para(p, estadoDe(s)),
    ...(s.fase === 'pausa' ? para(p, { type: 'pesca.pausa', sessao: s.sessao }) : []),
  ]

  const encerra = (s: Pesca, motivo: PescaMotivoDoFim): PescaHostMessage => ({ type: 'pesca.encerra', sessao: s.sessao, motivo })

  /** Quem está convidado ou pescando em ALGUM pino: não entra em outra pesca ao mesmo tempo. */
  const ocupado = (playerId: string): boolean =>
    [...sessoes.values()].some((s) => ativa(s) && s.participantes.some((p) => p.playerId === playerId && emJogo(p)))

  /**
   * A sessão do pino que ainda serve: aberta ou pausada e com alguém em jogo.
   * Sem ninguém em jogo, a próxima chamada abre outra — com o desafio de agora
   * do pino (o mestre pode ter mudado os lances) e o placar zerado.
   */
  const sessaoQueServe = (pinId: string): Pesca | null => {
    const s = sessoes.get(pinId)
    return s !== undefined && ativa(s) && s.participantes.some(emJogo) ? s : null
  }

  const abrir = (conf: PescaCongelada): Pesca => {
    const s: Pesca = { sessao: ctx.randomId(), conf, fase: 'aberta', participantes: [] }
    sessoes.set(conf.pinId, s)
    return s
  }

  /** Entra (ou volta, se já tinha terminado ou saído) com a pesca zerada. */
  const entrar = (s: Pesca, jogador: { playerId: string; nome: string }): Participante => {
    const novo: Participante = { playerId: jogador.playerId, nome: jogador.nome, status: 'convidado', lances: [] }
    const i = s.participantes.findIndex((p) => p.playerId === jogador.playerId)
    if (i === -1) s.participantes.push(novo)
    else s.participantes[i] = novo
    return novo
  }

  /** A sessão e o participante, se a mensagem vale: mesma sessão, aberta ou pausada, e quem entrou. */
  const doJogador = (playerId: string, sessao: string): { s: Pesca; p: Participante } | null => {
    for (const s of sessoes.values()) {
      if (s.sessao !== sessao || !ativa(s)) continue
      const p = s.participantes.find((item) => item.playerId === playerId)
      return p === undefined ? null : { s, p }
    }
    return null
  }

  /** Em cada sessão aberta em que o jogador está: o que muda, e as mensagens. */
  const emCadaSessao = (playerId: string, fazer: (s: Pesca, p: Participante) => SaidaDaPesca[]): SaidaDaPesca[] =>
    [...sessoes.values()].flatMap((s) => {
      const p = ativa(s) ? s.participantes.find((item) => item.playerId === playerId) : undefined
      return p === undefined ? [] : fazer(s, p)
    })

  const mudarPausa = (pinId: string, de: PescaFase, nova: PescaFase, tipo: 'pesca.pausa' | 'pesca.retoma'): SaidaDaPesca[] | null => {
    const s = sessoes.get(pinId)
    if (s === undefined || s.fase !== de) return null
    s.fase = nova
    const msg: PescaHostMessage = { type: tipo, sessao: s.sessao }
    return s.participantes.filter(emJogo).flatMap((p) => para(p, msg))
  }

  return {
    convidar(conf, convidados) {
      const livres = convidados.filter((c) => !ocupado(c.playerId))
      if (livres.length === 0) return { outbound: [], resultado: { ok: false, motivo: 'ninguem' } }
      const s = sessaoQueServe(conf.pinId) ?? abrir(conf)
      const novos = livres.map((c) => entrar(s, c))
      const convite = conviteDe(s)
      const outbound = [
        ...novos.flatMap((p) => [...para(p, convite), ...(s.fase === 'pausa' ? para(p, { type: 'pesca.pausa', sessao: s.sessao }) : [])]),
        ...estadoATodos(s),
      ]
      return { outbound, resultado: { ok: true, sessao: s.sessao, convidados: novos.length } }
    },

    pedir(conf, jogador) {
      if (conf.minigame.entrada !== 'pino') return { outbound: [], resultado: { ok: false, motivo: 'modo' } }
      if (ocupado(jogador.playerId)) return { outbound: [], resultado: { ok: false, motivo: 'ocupado' } }
      const s = sessaoQueServe(conf.pinId) ?? abrir(conf)
      const p = entrar(s, jogador)
      // O convite só para quem pediu; o estado (com ele na lista) a todos da sessão.
      const outbound = [...para(p, conviteDe(s)), ...(s.fase === 'pausa' ? para(p, { type: 'pesca.pausa', sessao: s.sessao }) : []), ...estadoATodos(s)]
      return { outbound, resultado: { ok: true, sessao: s.sessao } }
    },

    pronto(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao)
      if (achado === null || achado.p.status !== 'convidado') return []
      const { s, p } = achado
      // "Só Extremo" do mestre vale no host: a tela do jogador pode estar velha (ou mentir).
      const permitida = s.conf.minigame.permitida
      if (permitida !== 'escolha' && permitida !== msg.dificuldade) return []
      p.status = 'pescando'
      p.dificuldade = msg.dificuldade
      return estadoATodos(s)
    },

    vivo(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao)
      if (achado === null || achado.p.status !== 'pescando' || msg.de !== achado.s.conf.minigame.lances) return []
      const { type: _type, sessao: _sessao, ...vivo } = msg
      achado.p.vivo = vivo
      return []
    },

    lance(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao)
      if (achado === null || achado.p.status !== 'pescando') return []
      const { p, s } = achado
      // Lance fora da chamada, ou repetido (a mesma mensagem duas vezes), não conta.
      if (msg.lance > s.conf.minigame.lances || p.lances.some((l) => l.lance === msg.lance)) return []
      p.lances.push(msg.resultado === 'pegou' ? { lance: msg.lance, resultado: 'pegou', peixe: { ...msg.peixe } } : { lance: msg.lance, resultado: msg.resultado })
      return []
    },

    fim(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao)
      if (achado === null || achado.p.status !== 'pescando' || msg.cesto.length > achado.s.conf.minigame.lances) return []
      achado.p.status = 'terminou'
      achado.p.final = msg.cesto.map((peixe) => ({ ...peixe }))
      return estadoATodos(achado.s)
    },

    pausar(pinId) {
      return mudarPausa(pinId, 'aberta', 'pausa', 'pesca.pausa')
    },

    retomar(pinId) {
      return mudarPausa(pinId, 'pausa', 'aberta', 'pesca.retoma')
    },

    encerrar(pinId) {
      const s = sessoes.get(pinId)
      if (s === undefined || !ativa(s)) return null
      s.fase = 'encerrada'
      const msg = encerra(s, 'mestre')
      // Quem já terminou fica com o resultado na tela: o encerramento é para quem ainda estava no jogo.
      return s.participantes.filter(emJogo).flatMap((p) => para(p, msg))
    },

    entrou(playerId) {
      return emCadaSessao(playerId, (s, p) => {
        // No convite, a aba nova não tem nada: o convite e o estado de novo.
        if (p.status === 'convidado') return boasVindas(s, p)
        // No meio da pesca a aba nova perdeu o jogo: quem pescava sai, e ela fica sabendo.
        if (p.status !== 'pescando') return []
        p.status = 'saiu'
        return [...para(p, encerra(s, 'saiu')), ...estadoATodos(s)]
      })
    },

    caiu(playerId) {
      // No convite a queda não muda nada: quem volta recebe o convite de novo.
      return emCadaSessao(playerId, (s, p) => {
        if (p.status !== 'pescando') return []
        p.status = 'saiu'
        return estadoATodos(s)
      })
    },

    esquecer(playerId) {
      return emCadaSessao(playerId, (s, p) => {
        if (p.status === 'convidado') s.participantes = s.participantes.filter((item) => item !== p)
        else if (p.status === 'pescando') p.status = 'saiu'
        else return []
        return estadoATodos(s)
      })
    },

    aoVivo() {
      return [...sessoes.values()].map((s) => ({
        sessao: s.sessao,
        pinId: s.conf.pinId,
        npc: s.conf.minigame.npc,
        lago: s.conf.minigame.lago,
        entrada: s.conf.minigame.entrada,
        lances: s.conf.minigame.lances,
        fase: s.fase,
        participantes: s.participantes.map((p) => {
          const cesto = cestoDe(p).map((peixe) => ({ ...peixe }))
          const maior = maiorDe(cesto)
          return {
            playerId: p.playerId,
            nome: p.nome,
            status: p.status,
            conectado: ctx.conexaoDe(p.playerId) !== null,
            ...(p.dificuldade === undefined ? {} : { dificuldade: p.dificuldade }),
            ...(p.vivo === undefined ? {} : { vivo: { ...p.vivo } }),
            lances: p.lances.map((l) => (l.resultado === 'pegou' ? { ...l, peixe: { ...l.peixe } } : { ...l })),
            cesto,
            ...(maior === undefined ? {} : { maior: { ...maior } }),
          }
        }),
      }))
    },
  }
}
