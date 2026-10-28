import { DIF, medalha, passou, pontosMaximos, pontosMaximosPorAcertos, tirosMaximos } from '../minigames/tiro/sim'
import type { DificuldadeTiro, MedalhaTiro, MinigameTiro } from '../minigames/tiro/tipos'
import type {
  TiroConviteMessage,
  TiroDesfecho,
  TiroEstadoMessage,
  TiroFimMessage,
  TiroHostMessage,
  TiroMotivoDoFim,
  TiroProntoMessage,
  TiroStatus,
  TiroUltimaRodada,
  TiroVivo,
  TiroVivoMessage,
} from './protocoloDoTiro'

/**
 * MINIGAME DE TIRO AO VIVO, lado do mestre: uma sessão por pino (a barraca),
 * as tentativas de cada jogador e as regras de quem entra, quem atira e quem
 * saiu. Puro e síncrono como a `pescaNoHost`; a `hostSession` o monta, confere
 * o pino (tipo, modo, visão e distância) e encaminha as mensagens.
 *
 * As TENTATIVAS são do host: o `tiro.pronto` só vira rodada (o `tiro.inicio`,
 * com a semente) se o jogador ainda tem tentativa, a barraca está aberta e a
 * dificuldade é a que o mestre permitiu. O `tiro.vivo` e o `tiro.fim` são
 * conferidos contra o teto de pontos e tiros do tempo jogado e da
 * dificuldade, a coerência entre os números e o relógio do host; o torto morre
 * calado. A medalha e o "passou" são julgados aqui, com a meta do pino.
 * Prêmio e consequência são só texto.
 */

export interface SaidaDoTiro {
  clientId: string
  msg: TiroHostMessage
}

/** `encerrada`: o mestre encerrou. Fica no painel até "Reabrir para todos" ou a próxima chamada. */
export type TiroFase = 'aberta' | 'pausa' | 'encerrada'

/** O desafio congelado na abertura da sessão: editar o pino no meio não muda a barraca que está valendo. */
export interface TiroCongelado {
  pinId: string
  minigame: MinigameTiro
}

/** Como uma rodada acabou no placar: as do jogador, mais `encerrado` (o mestre) e `saiu` (a conexão). */
export type TiroDesfechoNoMestre = TiroDesfecho | 'encerrado' | 'saiu'

/** Uma rodada que acabou, como o placar do mestre lê. */
export interface TiroRodadaNoMestre {
  rodada: number
  dificuldade: DificuldadeTiro
  desfecho: TiroDesfechoNoMestre
  pontos: number
  tiros: number
  acertos: number
  medalha: MedalhaTiro | null
  passou: boolean
}

export interface TiroParticipanteNoMestre {
  playerId: string
  nome: string
  status: TiroStatus
  conectado: boolean
  /** Tentativas usadas (a rodada de agora conta). */
  usadas: number
  dificuldade?: DificuldadeTiro
  /** O último `tiro.vivo` da rodada de agora. */
  vivo?: TiroVivo
  rodadas: TiroRodadaNoMestre[]
  /** A melhor rodada que foi até o sino (vale a melhor). */
  melhor?: TiroRodadaNoMestre
}

/** O que o painel do MESTRE lê de cada pino com tiro. Nunca vai pela rede. */
export interface TiroAoVivo {
  sessao: string
  pinId: string
  npc: string
  barraca: string
  entrada: MinigameTiro['entrada']
  tentativas: number
  meta: MinigameTiro['meta']
  fase: TiroFase
  participantes: TiroParticipanteNoMestre[]
}

export type TiroConviteResultado = { ok: true; sessao: string; convidados: number } | { ok: false; motivo: 'pino' | 'ninguem' }
export type TiroPedidoResultado = { ok: true; sessao: string } | { ok: false; motivo: 'pino' | 'modo' | 'ocupado' }

export interface ContextoDoTiro {
  /** A conexão do jogador AGORA; `null` = fora do ar ou esquecido. */
  conexaoDe(playerId: string): string | null
  randomId(): string
  /** Relógio do host, em ms. */
  agora(): number
}

/** O `tiro.vivo` sai a cada 250 ms; mais de 1 a cada 150 ms (folga para o atraso da rede) é lixo. */
const VIVO_MIN_MS = 150
/**
 * A rodada que diz que foi até o sino não pode chegar antes do tempo dela no
 * relógio do host (a contagem e as pausas só atrasam). 2 s de folga para o
 * relógio do aparelho que corre um pouco mais rápido.
 */
const FOLGA_DO_RELOGIO_MS = 2000
/** O sino toca em `tempo` s; o número que o jogador manda vem arredondado a 1 ms. */
const FOLGA_DO_SINO_S = 0.01
/** O clique seco segura o cão por 0,15 s (`sim.ts`). */
const CAO_DO_SECO_S = 0.15

interface Participante {
  playerId: string
  nome: string
  status: TiroStatus
  usadas: number
  dificuldade?: DificuldadeTiro
  /** A rodada aberta agora (só em `atirando`) e quando o host a liberou. */
  rodada?: { n: number; dificuldade: DificuldadeTiro; inicioEm: number }
  vivo?: TiroVivo
  vivoEm?: number
  rodadas: TiroRodadaNoMestre[]
}

interface Tiro {
  sessao: string
  conf: TiroCongelado
  fase: TiroFase
  participantes: Participante[]
}

export interface TiroNoHost {
  /** "Chamar para a barraca" (modo mestre): os convidados entram (ou voltam com as tentativas zeradas). */
  convidar(conf: TiroCongelado, convidados: readonly { playerId: string; nome: string }[]): { outbound: SaidaDoTiro[]; resultado: TiroConviteResultado }
  /** "Atirar" do cartão (modo pino): quem pediu entra, e o convite volta só para ele. Quem já está não ganha tentativa nova. */
  pedir(conf: TiroCongelado, jogador: { playerId: string; nome: string }): { outbound: SaidaDoTiro[]; resultado: TiroPedidoResultado }
  pronto(playerId: string, msg: TiroProntoMessage): SaidaDoTiro[]
  vivo(playerId: string, msg: TiroVivoMessage): SaidaDoTiro[]
  fim(playerId: string, msg: TiroFimMessage): SaidaDoTiro[]
  /** "Pausar para todos" do pino. `null` = nada a fazer. */
  pausar(pinId: string): SaidaDoTiro[] | null
  retomar(pinId: string): SaidaDoTiro[] | null
  encerrar(pinId: string): SaidaDoTiro[] | null
  /** "Reabrir para todos": barraca nova com o desafio de agora do pino, as tentativas zeradas e quem estava nela de volta ao convite. */
  reabrir(conf: TiroCongelado): SaidaDoTiro[] | null
  entrou(playerId: string): SaidaDoTiro[]
  caiu(playerId: string): SaidaDoTiro[]
  esquecer(playerId: string): SaidaDoTiro[]
  aoVivo(): TiroAoVivo[]
}

const ativa = (s: Tiro): boolean => s.fase === 'aberta' || s.fase === 'pausa'
/** Na barraca: recebe pausa, retomada e encerramento. */
const naBarraca = (p: Participante): boolean => p.status === 'convidado' || p.status === 'atirando'

/** A última rodada, para a mesa dos colegas: as mesmas palavras do placar do mestre (`estadoNoPlacar`). */
function ultimaNoFio(r: TiroRodadaNoMestre | undefined): TiroUltimaRodada | undefined {
  if (r === undefined) return undefined
  if (r.desfecho === 'encerrado' || r.desfecho === 'desistiu') return r.desfecho
  return r.medalha === null ? 'nenhuma' : r.medalha
}

function melhorDe(rodadas: readonly TiroRodadaNoMestre[]): TiroRodadaNoMestre | undefined {
  return rodadas.reduce<TiroRodadaNoMestre | undefined>((m, r) => (r.desfecho === 'fim' && (m === undefined || r.pontos > m.pontos) ? r : m), undefined)
}

/**
 * Os números de uma rodada contra o que o jogo permite: tetos do tempo jogado
 * e da dificuldade, e a coerência entre eles (todo acerto derruba um alvo; o
 * proibido conta tiro sem acerto; o combo não passa dos acertos).
 */
function numerosPossiveis(dif: DificuldadeTiro, n: { t: number; pontos: number; tiros: number; acertos: number }): boolean {
  if (n.t > DIF[dif].tempo + FOLGA_DO_SINO_S) return false
  if (n.tiros > tirosMaximos(dif, n.t) || n.acertos > n.tiros) return false
  return n.pontos <= pontosMaximos(dif, n.t) && n.pontos <= pontosMaximosPorAcertos(dif, n.acertos)
}

export function criarTiroNoHost(ctx: ContextoDoTiro): TiroNoHost {
  /** Por pino: a sessão de agora (ou a última encerrada). */
  const sessoes = new Map<string, Tiro>()

  const para = (p: Participante, msg: TiroHostMessage): SaidaDoTiro[] => {
    const clientId = ctx.conexaoDe(p.playerId)
    return clientId === null ? [] : [{ clientId, msg }]
  }

  const estadoDe = (s: Tiro): TiroEstadoMessage => ({
    type: 'tiro.estado',
    sessao: s.sessao,
    fase: s.fase === 'pausa' ? 'pausa' : 'aberta',
    participantes: s.participantes.map((p) => {
      const ultima = ultimaNoFio(p.rodadas.at(-1))
      return ultima === undefined ? { playerId: p.playerId, nome: p.nome, status: p.status } : { playerId: p.playerId, nome: p.nome, status: p.status, ultima }
    }),
  })

  const estadoATodos = (s: Tiro): SaidaDoTiro[] => {
    const estado = estadoDe(s)
    return s.participantes.filter((p) => p.status !== 'saiu').flatMap((p) => para(p, estado))
  }

  const conviteDe = (s: Tiro, p: Participante): TiroConviteMessage => {
    const m = s.conf.minigame
    return {
      type: 'tiro.convite',
      sessao: s.sessao,
      pinId: s.conf.pinId,
      npc: m.npc,
      fala: m.fala,
      barraca: m.barraca,
      tentativas: m.tentativas,
      usadas: Math.min(p.usadas, m.tentativas),
      permitida: m.permitida,
      meta: m.meta,
      premio: { ...m.premio },
      consequencia: { ...m.consequencia },
      participantes: s.participantes.map((item) => ({ playerId: item.playerId, nome: item.nome })),
    }
  }

  /** O que a conexão de quem entra (ou volta) recebe: o convite, o estado e, se pausada, a pausa. */
  const boasVindas = (s: Tiro, p: Participante): SaidaDoTiro[] => [
    ...para(p, conviteDe(s, p)),
    ...para(p, estadoDe(s)),
    ...(s.fase === 'pausa' ? para(p, { type: 'tiro.pausa', sessao: s.sessao }) : []),
  ]

  const encerra = (s: Tiro, motivo: TiroMotivoDoFim): TiroHostMessage => ({ type: 'tiro.encerra', sessao: s.sessao, motivo })

  /** Na barraca de ALGUM pino: não entra noutra ao mesmo tempo. */
  const ocupado = (playerId: string, excetoPino?: string): boolean =>
    [...sessoes.values()].some((s) => ativa(s) && s.conf.pinId !== excetoPino && s.participantes.some((p) => p.playerId === playerId && naBarraca(p)))

  const abrir = (conf: TiroCongelado): Tiro => {
    const s: Tiro = { sessao: ctx.randomId(), conf, fase: 'aberta', participantes: [] }
    sessoes.set(conf.pinId, s)
    return s
  }

  const sessaoAtiva = (pinId: string): Tiro | null => {
    const s = sessoes.get(pinId)
    return s !== undefined && ativa(s) ? s : null
  }

  /** Entra (ou volta) com as tentativas zeradas: só o mestre faz isso (chamar ou reabrir). */
  const entrar = (s: Tiro, jogador: { playerId: string; nome: string }): Participante => {
    const novo: Participante = { playerId: jogador.playerId, nome: jogador.nome, status: 'convidado', usadas: 0, rodadas: [] }
    const i = s.participantes.findIndex((p) => p.playerId === jogador.playerId)
    if (i === -1) s.participantes.push(novo)
    else s.participantes[i] = novo
    return novo
  }

  const doJogador = (playerId: string, sessao: string): { s: Tiro; p: Participante } | null => {
    for (const s of sessoes.values()) {
      if (s.sessao !== sessao || !ativa(s)) continue
      const p = s.participantes.find((item) => item.playerId === playerId)
      return p === undefined ? null : { s, p }
    }
    return null
  }

  const emCadaSessao = (playerId: string, fazer: (s: Tiro, p: Participante) => SaidaDoTiro[]): SaidaDoTiro[] =>
    [...sessoes.values()].flatMap((s) => {
      const p = ativa(s) ? s.participantes.find((item) => item.playerId === playerId) : undefined
      return p === undefined ? [] : fazer(s, p)
    })

  /** Fecha a rodada aberta do participante no placar (sem números novos: vale o último vivo). */
  const fecharRodada = (s: Tiro, p: Participante, desfecho: TiroDesfechoNoMestre): void => {
    const r = p.rodada
    if (r === undefined) return
    const v = p.vivo
    p.rodadas.push({ rodada: r.n, dificuldade: r.dificuldade, desfecho, pontos: v?.pontos ?? 0, tiros: v?.tiros ?? 0, acertos: v?.acertos ?? 0, medalha: null, passou: false })
    p.rodada = undefined
    p.vivo = undefined
    p.status = p.usadas >= s.conf.minigame.tentativas ? 'terminou' : 'convidado'
  }

  const mudarPausa = (pinId: string, de: TiroFase, nova: TiroFase, tipo: 'tiro.pausa' | 'tiro.retoma'): SaidaDoTiro[] | null => {
    const s = sessoes.get(pinId)
    if (s === undefined || s.fase !== de) return null
    s.fase = nova
    const msg: TiroHostMessage = { type: tipo, sessao: s.sessao }
    return s.participantes.filter(naBarraca).flatMap((p) => para(p, msg))
  }

  return {
    convidar(conf, convidados) {
      const livres = convidados.filter((c) => !ocupado(c.playerId))
      if (livres.length === 0) return { outbound: [], resultado: { ok: false, motivo: 'ninguem' } }
      const s = sessaoAtiva(conf.pinId) ?? abrir(conf)
      const novos = livres.map((c) => entrar(s, c))
      const outbound = [
        ...novos.flatMap((p) => [...para(p, conviteDe(s, p)), ...(s.fase === 'pausa' ? para(p, { type: 'tiro.pausa', sessao: s.sessao }) : [])]),
        ...estadoATodos(s),
      ]
      return { outbound, resultado: { ok: true, sessao: s.sessao, convidados: novos.length } }
    },

    pedir(conf, jogador) {
      if (conf.minigame.entrada !== 'pino') return { outbound: [], resultado: { ok: false, motivo: 'modo' } }
      if (ocupado(jogador.playerId, conf.pinId)) return { outbound: [], resultado: { ok: false, motivo: 'ocupado' } }
      const s = sessaoAtiva(conf.pinId) ?? abrir(conf)
      const ja = s.participantes.find((p) => p.playerId === jogador.playerId && p.status !== 'saiu')
      // Quem já está (até sem tentativa) recebe o convite de novo com as tentativas que usou: tocar no pino não dá tentativa nova.
      if (ja !== undefined) return { outbound: boasVindas(s, ja), resultado: { ok: true, sessao: s.sessao } }
      const antigo = s.participantes.find((p) => p.playerId === jogador.playerId)
      const p = entrar(s, jogador)
      // Quem caiu e volta pelo pino continua com as tentativas que gastou.
      if (antigo !== undefined) {
        p.usadas = antigo.usadas
        p.rodadas = antigo.rodadas
        p.status = p.usadas >= s.conf.minigame.tentativas ? 'terminou' : 'convidado'
      }
      const outbound = [...para(p, conviteDe(s, p)), ...(s.fase === 'pausa' ? para(p, { type: 'tiro.pausa', sessao: s.sessao }) : []), ...estadoATodos(s)]
      return { outbound, resultado: { ok: true, sessao: s.sessao } }
    },

    pronto(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao)
      if (achado === null) return []
      const { s, p } = achado
      const m = s.conf.minigame
      if (s.fase !== 'aberta' || p.status !== 'convidado' || p.usadas >= m.tentativas) return []
      // "Só Extremo" do mestre vale no host: a tela do jogador pode estar velha (ou mentir).
      if (m.permitida !== 'escolha' && m.permitida !== msg.dificuldade) return []
      p.usadas++
      p.status = 'atirando'
      p.dificuldade = msg.dificuldade
      p.rodada = { n: p.usadas, dificuldade: msg.dificuldade, inicioEm: ctx.agora() }
      p.vivo = undefined
      p.vivoEm = undefined
      const semente = `${s.conf.pinId}|${s.sessao}|${ctx.randomId()}`
      return [...para(p, { type: 'tiro.inicio', sessao: s.sessao, rodada: p.usadas, dificuldade: msg.dificuldade, semente }), ...estadoATodos(s)]
    },

    vivo(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao)
      if (achado === null) return []
      const { p } = achado
      const r = p.rodada
      if (p.status !== 'atirando' || r === undefined || msg.rodada !== r.n) return []
      const agora = ctx.agora()
      if (p.vivoEm !== undefined && agora - p.vivoEm < VIVO_MIN_MS) return []
      if (!numerosPossiveis(r.dificuldade, msg)) return []
      // O tempo só anda para a frente dentro da rodada.
      if (p.vivo !== undefined && msg.t < p.vivo.t) return []
      const { type: _type, sessao: _sessao, ...vivo } = msg
      p.vivo = vivo
      p.vivoEm = agora
      return []
    },

    fim(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao)
      if (achado === null) return []
      const { s, p } = achado
      const r = p.rodada
      if (p.status !== 'atirando' || r === undefined || msg.rodada !== r.n) return []
      const D = DIF[r.dificuldade]
      if (!numerosPossiveis(r.dificuldade, msg)) return []
      if (msg.proibidos > msg.tiros - msg.acertos || msg.comboMax > msg.acertos || msg.derrubados !== msg.acertos) return []
      if (msg.secos > Math.floor(msg.t / CAO_DO_SECO_S) + 1 || msg.recargas > Math.floor(msg.t / D.recarga) + 1) return []
      if (msg.desfecho === 'fim') {
        // Foi até o sino: o tempo inteiro, e o relógio do host viu esse tempo passar.
        if (msg.t < D.tempo - FOLGA_DO_SINO_S || ctx.agora() - r.inicioEm < D.tempo * 1000 - FOLGA_DO_RELOGIO_MS) return []
      }
      const med = msg.desfecho === 'fim' ? medalha(r.dificuldade, msg.pontos) : null
      p.rodadas.push({ rodada: r.n, dificuldade: r.dificuldade, desfecho: msg.desfecho, pontos: msg.pontos, tiros: msg.tiros, acertos: msg.acertos, medalha: med, passou: passou(med, s.conf.minigame.meta) })
      p.rodada = undefined
      p.vivo = undefined
      p.status = p.usadas >= s.conf.minigame.tentativas ? 'terminou' : 'convidado'
      return estadoATodos(s)
    },

    pausar(pinId) {
      return mudarPausa(pinId, 'aberta', 'pausa', 'tiro.pausa')
    },

    retomar(pinId) {
      return mudarPausa(pinId, 'pausa', 'aberta', 'tiro.retoma')
    },

    encerrar(pinId) {
      const s = sessoes.get(pinId)
      if (s === undefined || !ativa(s)) return null
      s.fase = 'encerrada'
      const msg = encerra(s, 'mestre')
      const avisados = s.participantes.filter((p) => p.status !== 'saiu')
      for (const p of s.participantes) if (p.status === 'atirando') fecharRodada(s, p, 'encerrado')
      // Quem está na barraca, ou já gastou as tentativas, fica sabendo: a tela fecha a barraca.
      return avisados.flatMap((p) => para(p, msg))
    },

    reabrir(conf) {
      const antiga = sessoes.get(conf.pinId)
      if (antiga === undefined || antiga.fase !== 'encerrada') return null
      const s = abrir(conf)
      const voltam = antiga.participantes.filter((p) => p.status !== 'saiu' && ctx.conexaoDe(p.playerId) !== null && !ocupado(p.playerId))
      const novos = voltam.map((p) => entrar(s, p))
      return [...novos.flatMap((p) => para(p, conviteDe(s, p))), ...estadoATodos(s)]
    },

    entrou(playerId) {
      return emCadaSessao(playerId, (s, p) => {
        if (p.status === 'saiu') return []
        // No meio da rodada a aba nova perdeu o jogo: a tentativa foi gasta, e a barraca volta ao convite.
        if (p.status === 'atirando') {
          fecharRodada(s, p, 'saiu')
          return [...boasVindas(s, p), ...estadoATodos(s)]
        }
        return boasVindas(s, p)
      })
    },

    caiu(playerId) {
      return emCadaSessao(playerId, (s, p) => {
        if (p.status !== 'atirando') return []
        fecharRodada(s, p, 'saiu')
        return estadoATodos(s)
      })
    },

    esquecer(playerId) {
      return emCadaSessao(playerId, (s, p) => {
        if (p.status === 'saiu') return []
        if (p.status === 'atirando') fecharRodada(s, p, 'saiu')
        p.status = 'saiu'
        return estadoATodos(s)
      })
    },

    aoVivo() {
      return [...sessoes.values()].map((s) => ({
        sessao: s.sessao,
        pinId: s.conf.pinId,
        npc: s.conf.minigame.npc,
        barraca: s.conf.minigame.barraca,
        entrada: s.conf.minigame.entrada,
        tentativas: s.conf.minigame.tentativas,
        meta: s.conf.minigame.meta,
        fase: s.fase,
        participantes: s.participantes.map((p) => {
          const melhor = melhorDe(p.rodadas)
          return {
            playerId: p.playerId,
            nome: p.nome,
            status: p.status,
            conectado: ctx.conexaoDe(p.playerId) !== null,
            usadas: p.usadas,
            ...(p.dificuldade === undefined ? {} : { dificuldade: p.dificuldade }),
            ...(p.vivo === undefined ? {} : { vivo: { ...p.vivo } }),
            rodadas: p.rodadas.map((r) => ({ ...r })),
            ...(melhor === undefined ? {} : { melhor: { ...melhor } }),
          }
        }),
      }))
    },
  }
}
