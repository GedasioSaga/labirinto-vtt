import { CONTAGEM } from '../minigames/alavanca/som'
import { criarPartida, DT, forcaMax, passo, regras, type Partida } from '../minigames/alavanca/sim'
import { ALAVANCA_JOGADORES_MAX, type DificuldadeAlavanca, type MinigameAlavanca } from '../minigames/alavanca/tipos'
import type {
  AlavancaComecarMessage,
  AlavancaConviteMessage,
  AlavancaEstadoMessage,
  AlavancaFimMessage,
  AlavancaHostMessage,
  AlavancaStatus,
  AlavancaTipoDoFim,
  AlavancaVivoMessage,
} from './protocoloDaAlavanca'

/**
 * MINIGAME ALAVANCA DA PONTE AO VIVO, lado do mestre. O HOST É A AUTORIDADE:
 * a partida (`minigames/alavanca/sim.ts`) roda só aqui, com o relógio do host.
 * Cada `alavanca.giro` entra na fila com a hora da chegada; o `repassar()`, a
 * cada `ALAVANCA_REPASSE_MS` (o relógio é da `hostBridge`, como o do fogo),
 * avança a partida passo a passo até agora, aplica cada aperto no passo em que
 * chegou e manda a ponte a quem gira. O fim (a ponte desceu, ou o tempo
 * acabou) sai daqui também, com o sinal da porta para a ponte do mestre abrir.
 *
 * Puro e síncrono como a `hostSession`, que o monta e encaminha as mensagens.
 * Uma alavanca ativa por vez na sala. Mensagem de outra sessão, de quem não
 * foi chamado ou fora de fase morre calada.
 */

export interface SaidaDaAlavanca {
  clientId: string
  msg: AlavancaHostMessage
}

/** `fim`: a rodada acabou; `encerrada`: o mestre encerrou antes. As duas deixam chamar de novo. */
export type AlavancaFase = 'convite' | 'contagem' | 'rodada' | 'pausa' | 'fim' | 'encerrada'

/** A porta que a vitória abre, congelada no convite (a `portaLigada` do desafio). */
export interface PortaDaAlavanca {
  wallId: string
  sceneId?: string
}

/** O desafio congelado no convite: mexer nele durante a rodada não muda o que está valendo. */
export interface AlavancaCongelada {
  pinId: string
  minigame: MinigameAlavanca
  porta?: PortaDaAlavanca
}

export interface AlavancaConvidado {
  playerId: string
  nome: string
}

export type AlavancaConviteResultado = { ok: true; sessao: string; convidados: number } | { ok: false; motivo: 'pino' | 'ocupada' | 'ninguem' }

export interface AlavancaParticipanteNoMestre {
  playerId: string
  nome: string
  status: AlavancaStatus
  conectado: boolean
}

export interface AlavancaResultadoNoMestre {
  tipo: AlavancaTipoDoFim
  tFim: number
  pMax: number
  giros: number[]
  portaAberta: boolean
}

/** O que o painel do MESTRE lê da alavanca (só o que muda devagar). Nunca vai pela rede. */
export interface AlavancaAoVivo {
  sessao: string
  pinId: string
  fase: AlavancaFase
  sozinho: boolean
  dificuldade: DificuldadeAlavanca
  tempo: number
  abrePorta: boolean
  /** Na pausa: quem pausou ("mestre" ou o nome de quem pausou). */
  pausaPor?: string
  participantes: AlavancaParticipanteNoMestre[]
  /** Quem gira, na ordem da rodada (depois do começo). */
  ordem: string[]
  resultado?: AlavancaResultadoNoMestre
}

/** A rodada AO VIVO, para o "Rodada ao vivo" do painel (lida a cada 100 ms, fora do estado do App). */
export interface AlavancaVivoNoMestre {
  t: number
  tempo: number
  p: number
  /** A força da corrente, de 0 a 1 da máxima. */
  tensao: number
  solta: number
  giros: number[]
}

/** O sinal do fim para a ponte do mestre: abrir a porta (só com a ponte baixada). */
export interface AlavancaDesfechoSinal {
  sessao: string
  tipo: AlavancaTipoDoFim
  porta?: PortaDaAlavanca
  /** O aviso na tela do mestre. */
  texto: string
}

export interface ContextoDaAlavanca {
  /** A conexão do jogador AGORA; `null` = fora do ar ou esquecido. */
  conexaoDe(playerId: string): string | null
  randomId(): string
  /** O relógio do host, em ms. */
  agora(): number
}

interface Participante {
  playerId: string
  nome: string
  status: AlavancaStatus
  /** O último aperto aceito (ms do host): o teto de apertos por segundo. */
  ultimoGiroMs: number
}

interface Aperto {
  j: number
  emMs: number
}

interface Alavanca {
  sessao: string
  conf: AlavancaCongelada
  fase: AlavancaFase
  sozinho: boolean
  tempo: number
  participantes: Participante[]
  /** Quem gira, na ordem da rodada. */
  ordem: string[]
  partida?: Partida
  /** Quando o "Já!" sai (ms do host): o t = 0 da partida, empurrado pelas pausas. */
  t0Ms: number
  pausadaEmMs?: number
  pausaPor?: string
  fila: Aperto[]
  resultado?: AlavancaResultadoNoMestre
}

export interface AlavancaNoHost {
  convidar(conf: AlavancaCongelada, convidados: readonly AlavancaConvidado[]): { outbound: SaidaDaAlavanca[]; resultado: AlavancaConviteResultado }
  /** SOZINHO NO SELO: o jogador pediu uma rodada só dele (o desafio deixa, `entrada: 'pino'`). */
  pedir(conf: AlavancaCongelada, quem: AlavancaConvidado): { outbound: SaidaDaAlavanca[]; resultado: { ok: true; sessao: string } | { ok: false; motivo: 'ocupado' } }
  /** "Começar" do convite. Com todos os que seguem prontos, a rodada começa. */
  pronto(playerId: string, sessao: string): SaidaDaAlavanca[]
  giro(playerId: string, sessao: string): SaidaDaAlavanca[]
  /** Pausa de um jogador: para a rodada de todos; quem gira (ou o mestre) continua. */
  pausarPeloJogador(playerId: string, sessao: string): SaidaDaAlavanca[]
  continuarPeloJogador(playerId: string, sessao: string): SaidaDaAlavanca[]
  /** "Agora não" no convite; no meio da rodada, sai (os outros seguem). */
  desistir(playerId: string, sessao: string): SaidaDaAlavanca[]
  /** O mestre começa com quem está pronto; os outros ficam de fora. `null` = ninguém pronto, ou fora de fase. */
  comecar(): SaidaDaAlavanca[] | null
  pausar(): SaidaDaAlavanca[] | null
  retomar(): SaidaDaAlavanca[] | null
  encerrar(): SaidaDaAlavanca[] | null
  /** O relógio: avança a partida até agora e manda a ponte. O fim traz o sinal da porta. */
  repassar(): { outbound: SaidaDaAlavanca[]; desfecho?: AlavancaDesfechoSinal }
  /** A conexão do jogador é nova (entrou, voltou): o que ela precisa receber da alavanca. */
  entrou(playerId: string): SaidaDaAlavanca[]
  /** O jogador foi expulso (já sem `conexaoDe`). */
  esquecer(playerId: string): SaidaDaAlavanca[]
  aoVivo(): AlavancaAoVivo | null
  vivo(): AlavancaVivoNoMestre | null
}

/** O mais rápido que um aperto conta (ms entre dois do mesmo jogador): 20 por segundo, bem acima de gente. */
const GIRO_MIN_MS = 50
/** Ninguém no convite nem na rodada leva a alavanca a fechar. */
const ativaNaFase = (fase: AlavancaFase): boolean => fase === 'convite' || fase === 'contagem' || fase === 'rodada' || fase === 'pausa'
const r = (v: number, casas: number): number => Number(v.toFixed(casas))

/** O aviso do fim na tela do mestre. */
export function textoDoDesfechoDaAlavanca(tipo: AlavancaTipoDoFim, portaAberta: boolean): string {
  if (tipo === 'baixou') return portaAberta ? 'Alavanca da ponte: a ponte desceu e a porta ligada abriu.' : 'Alavanca da ponte: a ponte desceu.'
  if (tipo === 'subiu') return 'Alavanca da ponte: o tempo acabou e a corrente puxou a ponte de volta.'
  return 'Alavanca da ponte: rodada encerrada.'
}

export function criarAlavancaNoHost(ctx: ContextoDaAlavanca): AlavancaNoHost {
  let alavanca: Alavanca | null = null

  const ativa = (): Alavanca | null => (alavanca !== null && ativaNaFase(alavanca.fase) ? alavanca : null)
  const daSessao = (sessao: string): Alavanca | null => {
    const a = ativa()
    return a !== null && a.sessao === sessao ? a : null
  }
  const participanteDe = (a: Alavanca, playerId: string): Participante | undefined => a.participantes.find((p) => p.playerId === playerId)

  const para = (playerId: string, msg: AlavancaHostMessage): SaidaDaAlavanca[] => {
    const clientId = ctx.conexaoDe(playerId)
    return clientId === null ? [] : [{ clientId, msg }]
  }
  /** A quem segue na alavanca: o `fora` já recebeu o `alavanca.encerra`. */
  const aTodos = (a: Alavanca, msg: AlavancaHostMessage): SaidaDaAlavanca[] =>
    a.participantes.filter((p) => p.status !== 'fora').flatMap((p) => para(p.playerId, msg))
  /** Só a quem gira nesta rodada (quem saiu não recebe mais a ponte). */
  const aQuemGira = (a: Alavanca, msg: AlavancaHostMessage): SaidaDaAlavanca[] =>
    a.participantes.filter((p) => p.status === 'girando').flatMap((p) => para(p.playerId, msg))

  const faseNoFio = (fase: AlavancaFase): AlavancaEstadoMessage['fase'] => (fase === 'encerrada' ? 'fim' : fase)

  const estadoDe = (a: Alavanca): AlavancaEstadoMessage => ({
    type: 'alavanca.estado',
    sessao: a.sessao,
    fase: faseNoFio(a.fase),
    participantes: a.participantes.map((p) => ({ playerId: p.playerId, status: p.status })),
    ...(a.fase === 'pausa' && a.pausaPor !== undefined ? { pausaPor: a.pausaPor } : {}),
  })

  const conviteDe = (a: Alavanca): AlavancaConviteMessage => {
    const m = a.conf.minigame
    return {
      type: 'alavanca.convite',
      sessao: a.sessao,
      pinId: a.conf.pinId,
      lugar: m.lugar,
      fala: m.fala,
      dificuldade: m.dificuldade,
      tempo: a.tempo,
      participantes: a.participantes.map((p) => ({ playerId: p.playerId, nome: p.nome })),
      sozinho: a.sozinho,
      abrePorta: a.conf.porta !== undefined,
    }
  }

  const comecarDe = (a: Alavanca): AlavancaComecarMessage => ({
    type: 'alavanca.comecar',
    sessao: a.sessao,
    dificuldade: a.conf.minigame.dificuldade,
    tempo: a.tempo,
    ordem: a.ordem.map((playerId) => ({ playerId, nome: participanteDe(a, playerId)?.nome ?? playerId })),
  })

  const vivoDe = (a: Alavanca, P: Partida): AlavancaVivoMessage => ({
    type: 'alavanca.vivo',
    sessao: a.sessao,
    t: r(P.t, 3),
    p: r(P.p, 4),
    vel: r(Math.max(-10, Math.min(10, P.vel)), 3),
    tensao: r(Math.min(1, P.forca / forcaMax(P.R)), 3),
    solta: r(P.solta, 3),
    giros: P.giros.slice(),
  })

  const novaSessao = (conf: AlavancaCongelada, quem: readonly AlavancaConvidado[], sozinho: boolean): Alavanca => ({
    sessao: ctx.randomId(),
    conf,
    fase: 'convite',
    sozinho,
    tempo: regras({ dif: conf.minigame.dificuldade, jogadores: 1, tempo: conf.minigame.tempo }).tempo,
    participantes: quem.map((p) => ({ playerId: p.playerId, nome: p.nome, status: 'convidado', ultimoGiroMs: -Infinity })),
    ordem: [],
    t0Ms: 0,
    fila: [],
  })

  /** A rodada começa com os prontos (até 4, na ordem da sala); quem não estava pronto fica de fora. */
  const iniciar = (a: Alavanca): SaidaDaAlavanca[] => {
    const prontos = a.participantes.filter((p) => p.status === 'pronto' && ctx.conexaoDe(p.playerId) !== null).slice(0, ALAVANCA_JOGADORES_MAX)
    const outbound: SaidaDaAlavanca[] = []
    for (const p of a.participantes) {
      if (prontos.includes(p)) continue
      if (p.status !== 'fora') outbound.push(...para(p.playerId, { type: 'alavanca.encerra', sessao: a.sessao, motivo: 'fora' }))
      p.status = 'fora'
    }
    for (const p of prontos) p.status = 'girando'
    a.ordem = prontos.map((p) => p.playerId)
    a.partida = criarPartida({ dif: a.conf.minigame.dificuldade, jogadores: a.ordem.length, tempo: a.tempo })
    a.fase = 'contagem'
    // O "Prontos…" dura o mesmo que no protótipo: a partida começa no "Já!".
    a.t0Ms = ctx.agora() + CONTAGEM * 1000
    a.fila = []
    outbound.push(...aTodos(a, comecarDe(a)), ...aTodos(a, estadoDe(a)))
    return outbound
  }

  /** Todos os que seguem (e estão na mesa) prontos: começa sozinho, sem o mestre. */
  const comecaSeTodosProntos = (a: Alavanca): SaidaDaAlavanca[] => {
    const seguem = a.participantes.filter((p) => p.status !== 'fora')
    if (seguem.length === 0) return encerrarSemRodada(a)
    return seguem.every((p) => p.status === 'pronto') ? iniciar(a) : aTodos(a, estadoDe(a))
  }

  const encerrarSemRodada = (a: Alavanca): SaidaDaAlavanca[] => {
    const outbound = aTodos(a, { type: 'alavanca.encerra', sessao: a.sessao, motivo: 'mestre' })
    a.fase = 'encerrada'
    return outbound
  }

  /** O fim da rodada: o resultado a todos que giraram e o sinal da porta. */
  const acabar = (a: Alavanca, P: Partida, tipo: AlavancaTipoDoFim): { outbound: SaidaDaAlavanca[]; desfecho: AlavancaDesfechoSinal } => {
    const porta = tipo === 'baixou' ? a.conf.porta : undefined
    const tFim = Math.min(P.R.tempo, P.tFim ?? P.t)
    a.fase = tipo === 'encerrado' ? 'encerrada' : 'fim'
    a.resultado = { tipo, tFim: r(tFim, 3), pMax: r(P.pMax, 4), giros: P.giros.slice(), portaAberta: porta !== undefined }
    const fim: AlavancaFimMessage = {
      type: 'alavanca.fim',
      sessao: a.sessao,
      tipo,
      tFim: r(tFim, 3),
      p: r(P.p, 4),
      pMax: r(P.pMax, 4),
      giros: P.giros.slice(),
      soltou: P.soltou,
      maiorPausa: r(Math.min(P.R.tempo, P.maiorPausa), 3),
      portaAberta: porta !== undefined,
    }
    const outbound = a.participantes.filter((p) => p.status === 'girando' || p.status === 'saiu').flatMap((p) => para(p.playerId, fim))
    const desfecho: AlavancaDesfechoSinal = { sessao: a.sessao, tipo, ...(porta === undefined ? {} : { porta: { ...porta } }), texto: textoDoDesfechoDaAlavanca(tipo, porta !== undefined) }
    return { outbound, desfecho }
  }

  /** Avança a partida até o passo de agora, cada aperto no passo em que chegou. */
  const avancar = (a: Alavanca, P: Partida, agoraMs: number): void => {
    const kAlvo = Math.floor((agoraMs - a.t0Ms) / 1000 / DT)
    const quem: number[] = []
    while (P.fase === 'rodada' && P.k < kAlvo) {
      quem.length = 0
      while (a.fila.length > 0 && Math.floor((a.fila[0].emMs - a.t0Ms) / 1000 / DT) <= P.k) {
        const aperto = a.fila.shift()
        if (aperto !== undefined) quem.push(aperto.j)
      }
      passo(P, quem)
      // Os eventos são do jogador (som e brilho, pela ponte que recebe): aqui não se acumulam.
      P.ev.length = 0
    }
  }

  const pausarAgora = (a: Alavanca, por: string): SaidaDaAlavanca[] => {
    if (a.fase !== 'rodada' && a.fase !== 'contagem') return []
    const P = a.partida
    if (P !== undefined && a.fase === 'rodada') avancar(a, P, ctx.agora())
    a.pausadaEmMs = ctx.agora()
    a.pausaPor = por
    a.fase = 'pausa'
    // Os apertos da fila morrem com a pausa, como no protótipo.
    a.fila = []
    return aTodos(a, estadoDe(a))
  }

  const continuarAgora = (a: Alavanca): SaidaDaAlavanca[] => {
    if (a.fase !== 'pausa' || a.pausadaEmMs === undefined) return []
    const agora = ctx.agora()
    const contagemRestava = a.t0Ms > a.pausadaEmMs
    a.t0Ms += agora - a.pausadaEmMs
    a.pausadaEmMs = undefined
    a.pausaPor = undefined
    a.fase = contagemRestava ? 'contagem' : 'rodada'
    return aTodos(a, estadoDe(a))
  }

  return {
    convidar(conf, convidados) {
      if (ativa() !== null) return { outbound: [], resultado: { ok: false, motivo: 'ocupada' } }
      if (convidados.length === 0) return { outbound: [], resultado: { ok: false, motivo: 'ninguem' } }
      const a = novaSessao(conf, convidados.slice(0, ALAVANCA_JOGADORES_MAX), false)
      alavanca = a
      const outbound = [...aTodos(a, conviteDe(a)), ...aTodos(a, estadoDe(a))]
      return { outbound, resultado: { ok: true, sessao: a.sessao, convidados: a.participantes.length } }
    },

    pedir(conf, quem) {
      if (ativa() !== null) return { outbound: [], resultado: { ok: false, motivo: 'ocupado' } }
      const a = novaSessao(conf, [quem], true)
      alavanca = a
      return { outbound: [...aTodos(a, conviteDe(a)), ...aTodos(a, estadoDe(a))], resultado: { ok: true, sessao: a.sessao } }
    },

    pronto(playerId, sessao) {
      const a = daSessao(sessao)
      const p = a === null ? undefined : participanteDe(a, playerId)
      if (a === null || p === undefined || a.fase !== 'convite' || p.status !== 'convidado') return []
      p.status = 'pronto'
      return comecaSeTodosProntos(a)
    },

    giro(playerId, sessao) {
      const a = daSessao(sessao)
      const p = a === null ? undefined : participanteDe(a, playerId)
      // Na 'contagem' o relógio do repasse pode não ter virado ainda: vale a hora do "Já!" logo abaixo.
      if (a === null || p === undefined || (a.fase !== 'rodada' && a.fase !== 'contagem') || p.status !== 'girando') return []
      const agora = ctx.agora()
      // Antes do "Já!" (a contagem do host ainda corria) o aperto não conta, como no protótipo.
      if (agora < a.t0Ms || agora - p.ultimoGiroMs < GIRO_MIN_MS) return []
      p.ultimoGiroMs = agora
      const j = a.ordem.indexOf(playerId)
      if (j >= 0) a.fila.push({ j, emMs: agora })
      return []
    },

    pausarPeloJogador(playerId, sessao) {
      const a = daSessao(sessao)
      const p = a === null ? undefined : participanteDe(a, playerId)
      if (a === null || p === undefined || p.status !== 'girando') return []
      return pausarAgora(a, playerId)
    },

    continuarPeloJogador(playerId, sessao) {
      const a = daSessao(sessao)
      const p = a === null ? undefined : participanteDe(a, playerId)
      // A pausa do mestre só o mestre continua.
      if (a === null || p === undefined || p.status !== 'girando' || a.pausaPor === 'mestre') return []
      return continuarAgora(a)
    },

    desistir(playerId, sessao) {
      const a = daSessao(sessao)
      const p = a === null ? undefined : participanteDe(a, playerId)
      if (a === null || p === undefined || p.status === 'fora' || p.status === 'saiu') return []
      if (a.fase === 'convite') {
        p.status = 'fora'
        return comecaSeTodosProntos(a)
      }
      p.status = 'saiu'
      // Ninguém mais girando: a rodada fecha sem desfecho.
      if (!a.participantes.some((q) => q.status === 'girando')) {
        a.fase = 'encerrada'
        return []
      }
      return aTodos(a, estadoDe(a))
    },

    comecar() {
      const a = ativa()
      if (a === null || a.fase !== 'convite' || !a.participantes.some((p) => p.status === 'pronto' && ctx.conexaoDe(p.playerId) !== null)) return null
      return iniciar(a)
    },

    pausar() {
      const a = ativa()
      if (a === null || (a.fase !== 'rodada' && a.fase !== 'contagem')) return null
      return pausarAgora(a, 'mestre')
    },

    retomar() {
      const a = ativa()
      if (a === null || a.fase !== 'pausa') return null
      return continuarAgora(a)
    },

    encerrar() {
      const a = ativa()
      if (a === null) return null
      const P = a.partida
      if (P === undefined || a.fase === 'convite') return encerrarSemRodada(a)
      if (P.fase === 'rodada') {
        P.fase = 'encerrado'
        P.tFim = P.t
      }
      return acabar(a, P, 'encerrado').outbound
    },

    repassar() {
      const a = ativa()
      if (a === null || a.partida === undefined) return { outbound: [] }
      const P = a.partida
      const agora = ctx.agora()
      if (a.fase === 'contagem') {
        if (agora < a.t0Ms) return { outbound: [] }
        a.fase = 'rodada'
      }
      if (a.fase !== 'rodada') return { outbound: [] }
      avancar(a, P, agora)
      if (P.fase === 'baixou' || P.fase === 'subiu') {
        const fim = acabar(a, P, P.fase)
        return { outbound: [...aQuemGira(a, vivoDe(a, P)), ...fim.outbound], desfecho: fim.desfecho }
      }
      return { outbound: aQuemGira(a, vivoDe(a, P)) }
    },

    entrou(playerId) {
      const a = ativa()
      const p = a === null ? undefined : participanteDe(a, playerId)
      if (a === null || p === undefined || p.status === 'fora' || p.status === 'saiu') return []
      const outbound = para(playerId, conviteDe(a))
      if (a.fase !== 'convite' && p.status === 'girando') outbound.push(...para(playerId, comecarDe(a)))
      outbound.push(...para(playerId, estadoDe(a)))
      return outbound
    },

    esquecer(playerId) {
      const a = ativa()
      const p = a === null ? undefined : participanteDe(a, playerId)
      if (a === null || p === undefined) return []
      if (a.fase === 'convite') {
        p.status = 'fora'
        return comecaSeTodosProntos(a)
      }
      if (p.status === 'girando') p.status = 'saiu'
      if (!a.participantes.some((q) => q.status === 'girando')) a.fase = 'encerrada'
      return []
    },

    aoVivo() {
      const a = alavanca
      if (a === null) return null
      const pausaPor = a.fase !== 'pausa' || a.pausaPor === undefined ? undefined : a.pausaPor === 'mestre' ? 'mestre' : (participanteDe(a, a.pausaPor)?.nome ?? 'um jogador')
      return {
        sessao: a.sessao,
        pinId: a.conf.pinId,
        fase: a.fase,
        sozinho: a.sozinho,
        dificuldade: a.conf.minigame.dificuldade,
        tempo: a.tempo,
        abrePorta: a.conf.porta !== undefined,
        ...(pausaPor === undefined ? {} : { pausaPor }),
        participantes: a.participantes.map((p) => ({ playerId: p.playerId, nome: p.nome, status: p.status, conectado: ctx.conexaoDe(p.playerId) !== null })),
        ordem: a.ordem.slice(),
        ...(a.resultado === undefined ? {} : { resultado: { ...a.resultado, giros: a.resultado.giros.slice() } }),
      }
    },

    vivo() {
      const a = alavanca
      const P = a?.partida
      if (a === null || P === undefined) return null
      return { t: Math.min(P.t, P.R.tempo), tempo: P.R.tempo, p: P.p, tensao: P.fase === 'rodada' ? P.forca / forcaMax(P.R) : 0, solta: P.fase === 'rodada' ? P.solta : 0, giros: P.giros.slice() }
    },
  }
}
