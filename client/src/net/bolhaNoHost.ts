import type { CenarioBolha, DificuldadeBolha, MinigameBolha, ModoBolha } from '../minigames/bolha/tipos'
import {
  BOLHA_EQUIPE_MAX,
  BOLHA_SEMENTE_MAX,
  type BolhaComecarMessage,
  type BolhaConviteMessage,
  type BolhaDesfechoMessage,
  type BolhaDesistirMessage,
  type BolhaEstadoMessage,
  type BolhaFimMessage,
  type BolhaHostMessage,
  type BolhaLinhaDaMesa,
  type BolhaMotivoDoFim,
  type BolhaPlacar,
  type BolhaProntoMessage,
  type BolhaResultado,
  type BolhaStatus,
} from './protocoloDaBolha'

/**
 * MINIGAME BOLHA D'ÁGUA AO VIVO, lado do mestre: a partida ativa, quem joga e
 * o desfecho. Puro e síncrono como a `hostSession`, que o monta e encaminha as
 * mensagens. Molde do `fogoNoHost.ts` SEM o lockstep: cada um joga a própria
 * cópia, então não há entradas a repassar nem hash a conferir. Em equipe o
 * `bolha.comecar` é o mesmo para todos (semente, cenário e dificuldade).
 *
 * O resultado: passou = `placar.vitoria` de cada um; em equipe, a mesa tem uma
 * linha por jogador com os pontos dele. O prêmio vai a quem apagou; a
 * consequência, a quem não apagou (inclusive quem saiu no meio).
 *
 * Uma partida ativa por vez. Mensagem de outra sessão, de quem não foi
 * chamado ou fora de fase morre calada, como no fogo.
 */

export interface SaidaDaBolha {
  clientId: string
  msg: BolhaHostMessage
}

/** `fim`: saiu o desfecho; `encerrada`: o mestre encerrou antes. As duas deixam convidar de novo. */
export type BolhaFase = 'convite' | 'jogo' | 'pausa' | 'fim' | 'encerrada'

/** O desafio congelado no convite: mexer no pino durante o jogo não muda o que está valendo. */
export interface BolhaCongelada {
  pinId: string
  minigame: MinigameBolha
}

export interface BolhaConvidado {
  playerId: string
  nome: string
}

export type BolhaConviteResultado = { ok: true; sessao: string; convidados: number } | { ok: false; motivo: 'pino' | 'ocupada' | 'ninguem' }

export interface BolhaParticipanteNoMestre {
  playerId: string
  nome: string
  status: BolhaStatus
  conectado: boolean
  /** Só depois do desfecho. */
  pontos?: number
  estrelas?: number
  resultado?: BolhaResultado
}

/** O que o painel do MESTRE lê da bolha. Nunca vai pela rede. */
export interface BolhaAoVivo {
  sessao: string
  pinId: string
  npc: string
  cenario: CenarioBolha
  modo: ModoBolha
  fase: BolhaFase
  dificuldade?: DificuldadeBolha
  /** Começou sozinho no cartão do pino (o mestre só assiste). */
  sozinho: boolean
  participantes: BolhaParticipanteNoMestre[]
  /** Depois do desfecho: quantos apagaram e a soma dos pontos da mesa. */
  desfecho?: { apagaram: number; jogaram: number; pontos: number }
}

export interface ContextoDaBolha {
  /** A conexão do jogador AGORA; `null` = fora do ar ou esquecido. */
  conexaoDe(playerId: string): string | null
  randomId(): string
}

interface Participante {
  playerId: string
  nome: string
  status: BolhaStatus
  placar?: BolhaPlacar
  resultado?: BolhaResultado
}

interface Bolha {
  sessao: string
  conf: BolhaCongelada
  modo: ModoBolha
  fase: BolhaFase
  dificuldade?: DificuldadeBolha
  participantes: Participante[]
  desfecho?: BolhaAoVivo['desfecho']
  /** SOZINHO NO PINO (`pedir`): a dificuldade que o mestre deixou; o Pronto do jogador já começa. */
  sozinho?: { permitida: 'escolha' | DificuldadeBolha }
}

export interface BolhaNoHost {
  convidar(conf: BolhaCongelada, modo: ModoBolha, convidados: readonly BolhaConvidado[]): { outbound: SaidaDaBolha[]; resultado: BolhaConviteResultado }
  /** SOZINHO NO PINO: o jogador pediu uma partida só dele (o pino deixa, `entrada: 'pino'`). */
  pedir(conf: BolhaCongelada, quem: { playerId: string; nome: string }): { outbound: SaidaDaBolha[]; resultado: { ok: true; sessao: string } | { ok: false; motivo: 'ocupado' } }
  pronto(playerId: string, msg: BolhaProntoMessage): SaidaDaBolha[]
  fim(playerId: string, msg: BolhaFimMessage): SaidaDaBolha[]
  /** No convite: "Agora não" deixa de fora; o jogo que não carregou volta a Convidado. No jogo: sai como quem caiu. */
  desistir(playerId: string, msg: BolhaDesistirMessage): SaidaDaBolha[]
  /** `null` = nada a fazer (sem convite aberto, ou ninguém pronto e conectado). */
  comecar(dificuldade: DificuldadeBolha): SaidaDaBolha[] | null
  pausar(): SaidaDaBolha[] | null
  retomar(): SaidaDaBolha[] | null
  encerrar(): SaidaDaBolha[] | null
  /** A conexão do jogador é nova (entrou, voltou): o que ela precisa receber da bolha. */
  entrou(playerId: string): SaidaDaBolha[]
  /** A conexão caiu (já sem `conexaoDe`): no meio do jogo, quem jogava sai. */
  caiu(playerId: string): SaidaDaBolha[]
  /** O jogador foi expulso (já sem `conexaoDe`). */
  esquecer(playerId: string): SaidaDaBolha[]
  aoVivo(): BolhaAoVivo | null
}

const ativaNaFase = (fase: BolhaFase): boolean => fase === 'convite' || fase === 'jogo' || fase === 'pausa'

/** Semente do jogo (0 a 2^31-1) a partir de um id aleatório: FNV-1a de 32 bits. */
export function sementeDaBolha(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % (BOLHA_SEMENTE_MAX + 1)
}

/** O aviso do desfecho na tela do mestre: solo diz se apagou; equipe, quantos apagaram e os pontos da mesa. */
export function textoDoDesfechoDaBolha(bolha: Pick<BolhaAoVivo, 'modo' | 'participantes' | 'desfecho'>): string {
  const d = bolha.desfecho
  if (d === undefined || d.jogaram === 0) return "Bolha d'Água: todos terminaram."
  if (bolha.modo === 'solo' && d.jogaram === 1) {
    const quem = bolha.participantes.find((p) => p.resultado !== undefined)
    const nome = quem?.nome ?? 'O jogador'
    return d.apagaram === 1 ? `Bolha d'Água: ${nome} apagou o fogo (${d.pontos} pontos).` : `Bolha d'Água: ${nome} não apagou o fogo.`
  }
  return `Bolha d'Água: ${d.apagaram} de ${d.jogaram} apagaram o fogo (${d.pontos} pontos na mesa).`
}

export function criarBolhaNoHost(ctx: ContextoDaBolha): BolhaNoHost {
  let bolha: Bolha | null = null

  const ativa = (): Bolha | null => (bolha !== null && ativaNaFase(bolha.fase) ? bolha : null)

  const para = (p: Participante, msg: BolhaHostMessage): SaidaDaBolha[] => {
    const clientId = ctx.conexaoDe(p.playerId)
    return clientId === null ? [] : [{ clientId, msg }]
  }

  const estadoDe = (b: Bolha): BolhaEstadoMessage => ({
    type: 'bolha.estado',
    sessao: b.sessao,
    fase: b.fase === 'convite' ? 'convite' : b.fase === 'pausa' ? 'pausa' : 'jogo',
    participantes: b.participantes.map((p) => ({ playerId: p.playerId, status: p.status })),
  })

  /** O estado a quem segue na bolha: o `fora` já recebeu o `bolha.encerra`. */
  const estadoATodos = (b: Bolha): SaidaDaBolha[] => {
    const estado = estadoDe(b)
    return b.participantes.filter((p) => p.status !== 'fora').flatMap((p) => para(p, estado))
  }

  const conviteDe = (b: Bolha): BolhaConviteMessage => {
    const m = b.conf.minigame
    return {
      type: 'bolha.convite',
      sessao: b.sessao,
      pinId: b.conf.pinId,
      npc: m.npc,
      fala: m.fala,
      cenario: m.cenario,
      modo: b.modo,
      premio: { ...m.premio },
      consequencia: { ...m.consequencia },
      participantes: b.participantes.map((p) => ({ playerId: p.playerId, nome: p.nome })),
      ...(b.sozinho === undefined ? {} : { sozinho: { ...b.sozinho } }),
    }
  }

  const encerra = (b: Bolha, motivo: BolhaMotivoDoFim): BolhaHostMessage => ({ type: 'bolha.encerra', sessao: b.sessao, motivo })

  const doJogador = (playerId: string, sessao: string, fases: readonly BolhaFase[]): { b: Bolha; p: Participante } | null => {
    const b = bolha
    if (b === null || b.sessao !== sessao || !fases.includes(b.fase)) return null
    const p = b.participantes.find((item) => item.playerId === playerId)
    return p === undefined ? null : { b, p }
  }

  const noJogo = ['jogo', 'pausa'] as const
  const jogando = (b: Bolha): Participante[] => b.participantes.filter((p) => p.status === 'jogando')

  const linhaDe = (p: Participante): BolhaLinhaDaMesa => ({
    playerId: p.playerId,
    nome: p.nome,
    pontos: p.placar?.pontos ?? 0,
    estrelas: p.placar?.estrelas ?? 0,
    resultado: p.resultado ?? 'saiu',
  })

  /** Fecha a bolha ativa sem desfecho: ninguém ganha nem perde. Avisa todo mundo menos quem já ficou de fora. */
  const fecharSemDesfecho = (b: Bolha, motivo: BolhaMotivoDoFim): SaidaDaBolha[] => {
    b.fase = 'encerrada'
    const msg = encerra(b, motivo)
    return b.participantes.filter((p) => p.status !== 'fora').flatMap((p) => para(p, msg))
  }

  /** Ninguém mais jogando: o desfecho, uma vez só. Cada um com o SEU placar. */
  const concluirSePronto = (b: Bolha): SaidaDaBolha[] => {
    if ((b.fase !== 'jogo' && b.fase !== 'pausa') || jogando(b).length > 0) return []
    const jogaram = b.participantes.filter((p) => p.status === 'terminou' || p.status === 'saiu')
    for (const p of jogaram) {
      p.resultado = p.status === 'saiu' || p.placar === undefined ? 'saiu' : p.placar.vitoria ? 'venceu' : 'perdeu'
    }
    b.fase = 'fim'
    b.desfecho = {
      apagaram: jogaram.filter((p) => p.resultado === 'venceu').length,
      jogaram: jogaram.length,
      pontos: jogaram.reduce((soma, p) => soma + (p.placar?.pontos ?? 0), 0),
    }
    const m = b.conf.minigame
    const mesa = jogaram.map(linhaDe)
    return jogaram.flatMap((p) => {
      const passou = p.resultado === 'venceu'
      const seu: BolhaDesfechoMessage['seu'] = { passou }
      if (passou && m.premio.texto.trim() !== '') seu.premio = { ...m.premio }
      if (!passou && m.consequencia.texto.trim() !== '') seu.consequencia = { ...m.consequencia }
      const msg: BolhaDesfechoMessage = { type: 'bolha.desfecho', sessao: b.sessao, modo: b.modo, mesa: mesa.map((l) => ({ ...l })), seu }
      if (p.placar !== undefined) msg.placar = { ...p.placar }
      return para(p, msg)
    })
  }

  /** Começa o convite aberto com quem está pronto. `null` = nada a fazer. */
  const comecarBolha = (dificuldade: DificuldadeBolha): SaidaDaBolha[] | null => {
    const b = bolha
    if (b === null || b.fase !== 'convite') return null
    // Pronto E na sala agora: quem caiu depois do Pronto não ouviria o "começar".
    const jogam = b.participantes.filter((p) => p.status === 'pronto' && ctx.conexaoDe(p.playerId) !== null)
    if (jogam.length === 0) return null
    const outbound: SaidaDaBolha[] = []
    for (const p of b.participantes) {
      // Quem já ficou de fora no convite ("Agora não") fechou a tela: não precisa ouvir de novo.
      if (jogam.includes(p) || p.status === 'fora') continue
      outbound.push(...para(p, encerra(b, 'fora')))
      p.status = 'fora'
    }
    for (const p of jogam) p.status = 'jogando'
    b.fase = 'jogo'
    b.dificuldade = dificuldade
    // A mesma semente para todos: em equipe a partida começa igual em cada cópia.
    const semente = sementeDaBolha(ctx.randomId())
    const partida = (quem: readonly Participante[]): BolhaComecarMessage => ({
      type: 'bolha.comecar',
      sessao: b.sessao,
      semente,
      dificuldade,
      cenario: b.conf.minigame.cenario,
      modo: b.modo,
      jogadores: quem.map((p) => ({ id: p.playerId, nome: p.nome })),
    })
    // Equipe: a lista inteira (o jogo só mostra quem é quem); solo: cada um só com ele.
    const daEquipe = partida(jogam)
    for (const p of jogam) outbound.push(...para(p, b.modo === 'equipe' ? daEquipe : partida([p])))
    return [...outbound, ...estadoATodos(b)]
  }

  /** Quem jogava saiu (caiu, aba nova, expulso, desistiu): fica com 'saiu' e o desfecho não espera por ele. */
  const tirarDoJogo = (b: Bolha, p: Participante): SaidaDaBolha[] => {
    p.status = 'saiu'
    return [...estadoATodos(b), ...concluirSePronto(b)]
  }

  return {
    convidar(conf, modo, convidados) {
      if (ativa() !== null) return { outbound: [], resultado: { ok: false, motivo: 'ocupada' } }
      // Equipe: o jogo aceita até 6 na lista do `iniciar`; os de depois nem são chamados.
      const chamados = modo === 'equipe' ? convidados.slice(0, BOLHA_EQUIPE_MAX) : convidados
      if (chamados.length === 0) return { outbound: [], resultado: { ok: false, motivo: 'ninguem' } }
      const b: Bolha = {
        sessao: ctx.randomId(),
        conf,
        modo,
        fase: 'convite',
        participantes: chamados.map((c) => ({ playerId: c.playerId, nome: c.nome, status: 'convidado' })),
      }
      bolha = b
      const convite = conviteDe(b)
      return { outbound: b.participantes.flatMap((p) => para(p, convite)), resultado: { ok: true, sessao: b.sessao, convidados: b.participantes.length } }
    },

    pedir(conf, quem) {
      if (ativa() !== null) return { outbound: [], resultado: { ok: false, motivo: 'ocupado' } }
      const b: Bolha = {
        sessao: ctx.randomId(),
        conf,
        modo: 'solo',
        fase: 'convite',
        participantes: [{ playerId: quem.playerId, nome: quem.nome, status: 'convidado' }],
        sozinho: { permitida: conf.minigame.permitida },
      }
      bolha = b
      return { outbound: b.participantes.flatMap((p) => para(p, conviteDe(b))), resultado: { ok: true, sessao: b.sessao } }
    },

    pronto(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, ['convite'])
      if (achado === null) return []
      const { b, p } = achado
      if (p.status !== 'convidado' && p.status !== 'pronto') return []
      if (b.sozinho !== undefined) {
        // Sozinho no pino: o Pronto já começa. A dificuldade é a que o mestre
        // deixou; na "escolha", a do jogador (sem ela, nada começa).
        const permitida = b.sozinho.permitida
        const dificuldade = permitida === 'escolha' ? msg.dificuldade : permitida
        if (dificuldade === undefined) return []
        p.status = 'pronto'
        return comecarBolha(dificuldade) ?? estadoATodos(b)
      }
      if (p.status === 'pronto') return []
      p.status = 'pronto'
      return estadoATodos(b)
    },

    fim(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, noJogo)
      if (achado === null || achado.p.status !== 'jogando') return []
      const { b, p } = achado
      p.status = 'terminou'
      p.placar = { ...msg.placar }
      // O último a terminar fecha o jogo: o desfecho já diz tudo, sem estado antes.
      const fechou = concluirSePronto(b)
      return b.fase === 'jogo' || b.fase === 'pausa' ? estadoATodos(b) : fechou
    },

    desistir(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, ['convite', ...noJogo])
      if (achado === null) return []
      const { b, p } = achado
      if (b.fase === 'convite') {
        // "Agora não": fica de fora; o jogo que não carregou volta a Convidado, sem o Pronto.
        if (p.status === 'fora') return []
        const status: BolhaStatus = msg.motivo === 'recusou' ? 'fora' : 'convidado'
        if (p.status === status) return []
        p.status = status
        // SOZINHO NO PINO: quem pediu disse "Agora não" e não sobra ninguém no convite. Aberto,
        // ele prendia o pino: o próximo "Apagar com bolhas" voltava "ocupado" até o mestre
        // encerrar (achado na prova de 10/11/2026). Fecha sem desfecho, como o mestre fecharia.
        if (b.sozinho !== undefined && status === 'fora') return fecharSemDesfecho(b, 'fora')
        return estadoATodos(b)
      }
      // No jogo: quem já terminou fica com o placar que mandou; quem jogava sai.
      if (p.status !== 'jogando') return []
      return tirarDoJogo(b, p)
    },

    comecar(dificuldade) {
      return comecarBolha(dificuldade)
    },

    pausar() {
      const b = bolha
      if (b === null || b.fase !== 'jogo') return null
      b.fase = 'pausa'
      const msg: BolhaHostMessage = { type: 'bolha.pausa', sessao: b.sessao }
      return jogando(b).flatMap((p) => para(p, msg))
    },

    retomar() {
      const b = bolha
      if (b === null || b.fase !== 'pausa') return null
      b.fase = 'jogo'
      const msg: BolhaHostMessage = { type: 'bolha.retoma', sessao: b.sessao }
      return jogando(b).flatMap((p) => para(p, msg))
    },

    encerrar() {
      const b = ativa()
      if (b === null) return null
      return fecharSemDesfecho(b, 'mestre')
    },

    entrou(playerId) {
      const b = ativa()
      const p = b?.participantes.find((item) => item.playerId === playerId)
      if (b === null || p === undefined || p.status === 'fora') return []
      // No convite, a aba nova não tem nada: o convite e o estado de novo (o Pronto dela fica).
      if (b.fase === 'convite') return [...para(p, conviteDe(b)), ...para(p, estadoDe(b))]
      // No meio do jogo a aba nova perdeu a partida: quem jogava sai, e ela fica sabendo.
      if (p.status === 'jogando') return [...para(p, encerra(b, 'saiu')), ...tirarDoJogo(b, p)]
      if (p.status === 'saiu') return para(p, encerra(b, 'saiu'))
      return []
    },

    caiu(playerId) {
      const b = ativa()
      const p = b?.participantes.find((item) => item.playerId === playerId)
      // No convite a queda não muda nada: quem volta recebe o convite de novo.
      if (b === null || p === undefined || b.fase === 'convite' || p.status !== 'jogando') return []
      return tirarDoJogo(b, p)
    },

    esquecer(playerId) {
      const b = ativa()
      const p = b?.participantes.find((item) => item.playerId === playerId)
      if (b === null || p === undefined) return []
      if (b.fase === 'convite') {
        b.participantes = b.participantes.filter((item) => item !== p)
        // Sozinho no pino, sem quem pediu: o convite vazio prenderia o pino (o mesmo do "Agora não").
        if (b.sozinho !== undefined) return fecharSemDesfecho(b, 'fora')
        return estadoATodos(b)
      }
      if (p.status !== 'jogando') return []
      return tirarDoJogo(b, p)
    },

    aoVivo() {
      const b = bolha
      if (b === null) return null
      return {
        sessao: b.sessao,
        pinId: b.conf.pinId,
        npc: b.conf.minigame.npc,
        cenario: b.conf.minigame.cenario,
        modo: b.modo,
        fase: b.fase,
        ...(b.dificuldade === undefined ? {} : { dificuldade: b.dificuldade }),
        sozinho: b.sozinho !== undefined,
        participantes: b.participantes.map((p) => ({
          playerId: p.playerId,
          nome: p.nome,
          status: p.status,
          conectado: ctx.conexaoDe(p.playerId) !== null,
          ...(p.resultado === undefined ? {} : { resultado: p.resultado, pontos: p.placar?.pontos ?? 0, estrelas: p.placar?.estrelas ?? 0 }),
        })),
        ...(b.desfecho === undefined ? {} : { desfecho: { ...b.desfecho } }),
      }
    },
  }
}
