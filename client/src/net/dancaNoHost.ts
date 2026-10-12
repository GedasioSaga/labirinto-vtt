import { passouDaNota } from '../minigames/danca/regras'
import type { DificuldadeDanca, LetraDanca, MinigameDoPino } from '../minigames/danca/tipos'
import {
  DANCA_COMECAR_EM_MS,
  type DancaColegasMessage,
  type DancaConviteMessage,
  type DancaDesfechoMessage,
  type DancaEstadoMessage,
  type DancaFimMessage,
  type DancaHostMessage,
  type DancaLinhaDaMesa,
  type DancaMotivoDoFim,
  type DancaPlacarAoVivo,
  type DancaPlacarFinal,
  type DancaProntoMessage,
  type DancaStatus,
  type DancaToquesMessage,
} from './protocoloDaDanca'

/**
 * MINIGAME DE DANÇA AO VIVO, lado do mestre: a dança ativa e as regras de
 * quem dança, quem fica de fora e quando sai o desfecho. Puro e síncrono como
 * a `hostSession`, que o monta, encaminha as mensagens e aplica o que volta.
 *
 * Decisões do usuário (12/10/2026): o mestre escolhe quem dança; todos
 * começam juntos; a porta ligada só abre se TODOS os que dançaram passarem.
 * Quem cai no meio da música conta como "não passou". Encerrar antes do fim
 * não tem desfecho: nada foi ganho nem perdido.
 *
 * Uma dança ativa por vez. Mensagem de outra sessão, de quem não foi chamado
 * ou fora de fase morre calada: responder "recusado" só ensinaria que ela existe.
 */

/** Uma mensagem da dança para uma conexão (cabe em `Outbound` da sessão). */
export interface SaidaDaDanca {
  clientId: string
  msg: DancaHostMessage
}

/** `fim`: saiu o desfecho; `encerrada`: o mestre encerrou antes. As duas deixam convidar de novo. */
export type DancaFase = 'convite' | 'musica' | 'pausa' | 'fim' | 'encerrada'

/** A porta ligada no convite, com a cena dela (ausente = a aberta no editor), para o "Applied" da ponte. */
export interface PortaDaDanca {
  wallId: string
  sceneId?: string
  /** Nome da cena de FUNDO, para o aviso do mestre dizer onde. */
  sceneName?: string
}

/**
 * O desafio congelado no convite: o mestre pode mexer no pino durante a dança
 * sem mudar a que está valendo (as setas que já foram aos jogadores, inclusive).
 */
export interface DancaCongelada {
  pinId: string
  minigame: MinigameDoPino
  porta?: PortaDaDanca
}

export interface DancaParticipanteNoMestre {
  playerId: string
  nome: string
  status: DancaStatus
  conectado: boolean
  dificuldade?: DificuldadeDanca
  /** O último placar ao vivo que chegou (`danca.toques`). */
  placar?: DancaPlacarAoVivo
  /** O placar final de quem terminou (`danca.fim`). */
  final?: DancaPlacarFinal
  /** Só depois do desfecho. */
  passou?: boolean
}

/** O que o painel do MESTRE lê da dança: fase, cada participante e, no fim, o desfecho. Nunca vai pela rede. */
export interface DancaAoVivo {
  sessao: string
  pinId: string
  npc: string
  fase: DancaFase
  notaMin: LetraDanca
  temPorta: boolean
  /**
   * Prêmio e consequência CONGELADOS no convite, não os do pino de agora: o
   * mestre pode editar o pino no meio da dança, e o desfecho do painel tem de
   * dizer o mesmo que os avisos e o que foi aplicado.
   */
  premio: MinigameDoPino['premio']
  consequencia: MinigameDoPino['consequencia']
  participantes: DancaParticipanteNoMestre[]
  desfecho?: { todosPassaram: boolean; portaAberta: boolean }
}

export type DancaConviteResultado = { ok: true; sessao: string; convidados: number } | { ok: false; motivo: 'pino' | 'ocupada' | 'ninguem' }

/**
 * O desfecho para o INTEGRADOR (a ponte): a porta a destrancar e abrir, os
 * itens a pôr nas mochilas e o que o mestre precisa ler para aplicar à mão.
 * Nada disto vai a jogador.
 */
export interface DancaDesfechoSinal {
  sessao: string
  npc: string
  todosPassaram: boolean
  porta?: PortaDaDanca
  premio: MinigameDoPino['premio']
  consequencia: MinigameDoPino['consequencia']
  mesa: { playerId: string; nome: string; passou: boolean; letra: DancaLinhaDaMesa['letra']; precisao: number }[]
  /** Prêmio `item` com todos passando: o id novo do item de cada um. A ponte acha a ficha dele e grava a mochila. */
  itens: { playerId: string; nome: string; itemId: string; texto: string }[]
}

/** O que a SESSÃO grava por conta do desfecho: recados e pistas no caderno de cada um. */
export interface EfeitosDaDanca {
  notas: { playerId: string; texto: string }[]
  pistas: { playerId: string; titulo: string; texto: string; fonte: string }[]
}

export interface DesfechoDaDanca {
  outbound: SaidaDaDanca[]
  sinal: DancaDesfechoSinal
  efeitos: EfeitosDaDanca
}

export interface ContextoDaDanca {
  /** A conexão do jogador AGORA; `null` = fora do ar ou esquecido. */
  conexaoDe(playerId: string): string | null
  randomId(): string
}

/** Título da pista quando o NPC ficou sem nome. */
const TITULO_DA_PISTA_SEM_NPC = 'Desafio de dança'

interface Participante {
  playerId: string
  nome: string
  status: DancaStatus
  dificuldade?: DificuldadeDanca
  placar?: DancaPlacarAoVivo
  final?: DancaPlacarFinal
  passou?: boolean
}

interface Danca {
  sessao: string
  conf: DancaCongelada
  fase: DancaFase
  /** Na ordem da sala (a do painel Grupo). */
  participantes: Participante[]
  desfecho?: { todosPassaram: boolean; portaAberta: boolean }
}

export interface DancaNoHost {
  convidar(conf: DancaCongelada, convidados: readonly { playerId: string; nome: string }[]): { outbound: SaidaDaDanca[]; resultado: DancaConviteResultado }
  pronto(playerId: string, msg: DancaProntoMessage): SaidaDaDanca[]
  toques(playerId: string, msg: DancaToquesMessage): SaidaDaDanca[]
  fim(playerId: string, msg: DancaFimMessage): SaidaDaDanca[]
  /** `null` = nada a fazer (sem convite aberto, ou ninguém pronto e conectado). */
  comecar(): SaidaDaDanca[] | null
  pausar(): SaidaDaDanca[] | null
  retomar(): SaidaDaDanca[] | null
  encerrar(): SaidaDaDanca[] | null
  /** A conexão do jogador é nova (entrou, voltou, "É ela"): o que ela precisa receber da dança. */
  entrou(playerId: string): SaidaDaDanca[]
  /** A conexão caiu (já sem `conexaoDe`): no meio da música, quem dançava sai. */
  caiu(playerId: string): SaidaDaDanca[]
  /** O jogador foi expulso (já sem `conexaoDe`). */
  esquecer(playerId: string): SaidaDaDanca[]
  /** Todos os que dançam terminaram ou saíram: o desfecho, uma vez só. */
  concluirSePronta(): DesfechoDaDanca | null
  aoVivo(): DancaAoVivo | null
}

const comPrimeiro = (fase: DancaFase): boolean => fase === 'convite' || fase === 'musica' || fase === 'pausa'

export function criarDancaNoHost(ctx: ContextoDaDanca): DancaNoHost {
  let danca: Danca | null = null

  /** A dança que ainda aceita mensagem (convite, música ou pausa). */
  const ativa = (): Danca | null => (danca !== null && comPrimeiro(danca.fase) ? danca : null)

  const para = (p: Participante, msg: DancaHostMessage): SaidaDaDanca[] => {
    const clientId = ctx.conexaoDe(p.playerId)
    return clientId === null ? [] : [{ clientId, msg }]
  }

  const estadoDe = (d: Danca): DancaEstadoMessage => ({
    type: 'danca.estado',
    sessao: d.sessao,
    fase: d.fase === 'convite' ? 'convite' : d.fase === 'pausa' ? 'pausa' : 'musica',
    participantes: d.participantes.map((p) => ({ playerId: p.playerId, status: p.status })),
  })

  /** O estado a quem segue na dança: o `fora` já recebeu o `danca.encerra`. */
  const estadoATodos = (d: Danca): SaidaDaDanca[] => {
    const estado = estadoDe(d)
    return d.participantes.filter((p) => p.status !== 'fora').flatMap((p) => para(p, estado))
  }

  const conviteDe = (d: Danca): DancaConviteMessage => {
    const m = d.conf.minigame
    return {
      type: 'danca.convite',
      sessao: d.sessao,
      pinId: d.conf.pinId,
      npc: m.npc,
      fala: m.fala,
      permitida: m.permitida,
      notaMin: m.notaMin,
      premio: { ...m.premio },
      musica: m.musica,
      participantes: d.participantes.map((p) => ({ playerId: p.playerId, nome: p.nome })),
    }
  }

  const encerra = (d: Danca, motivo: DancaMotivoDoFim): DancaHostMessage => ({ type: 'danca.encerra', sessao: d.sessao, motivo })

  /** A dança e o participante, se a mensagem vale: mesma sessão, fase certa e quem foi chamado. */
  const doJogador = (playerId: string, sessao: string, fases: readonly DancaFase[]): { d: Danca; p: Participante } | null => {
    const d = danca
    if (d === null || d.sessao !== sessao || !fases.includes(d.fase)) return null
    const p = d.participantes.find((item) => item.playerId === playerId)
    return p === undefined ? null : { d, p }
  }

  const naMusica = ['musica', 'pausa'] as const

  /** Pausa e retoma vão a quem ainda dança: quem terminou espera o desfecho. */
  const aQuemDanca = (d: Danca, msg: DancaHostMessage): SaidaDaDanca[] => d.participantes.filter((p) => p.status === 'dancando').flatMap((p) => para(p, msg))

  const linhaDaMesa = (p: Participante): DancaLinhaDaMesa['letra'] => (p.final === undefined ? 'Saiu' : p.final.falhou ? 'Falhou' : p.final.letra)

  /** Quem terminou, pela música inteira; quem saiu, pelo último placar ao vivo (0 = caiu antes do primeiro lote). */
  const precisaoFinal = (p: Participante): number => p.final?.precisao ?? p.placar?.precisao ?? 0

  return {
    convidar(conf, convidados) {
      if (ativa() !== null) return { outbound: [], resultado: { ok: false, motivo: 'ocupada' } }
      if (convidados.length === 0) return { outbound: [], resultado: { ok: false, motivo: 'ninguem' } }
      const d: Danca = {
        sessao: ctx.randomId(),
        conf,
        fase: 'convite',
        participantes: convidados.map((c) => ({ playerId: c.playerId, nome: c.nome, status: 'convidado' })),
      }
      danca = d
      const convite = conviteDe(d)
      return { outbound: d.participantes.flatMap((p) => para(p, convite)), resultado: { ok: true, sessao: d.sessao, convidados: d.participantes.length } }
    },

    pronto(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, ['convite'])
      if (achado === null) return []
      const { d, p } = achado
      if (p.status !== 'convidado' && p.status !== 'pronto') return []
      // "Só Expert" do mestre vale no host: a tela do jogador pode estar velha (ou mentir).
      const permitida = d.conf.minigame.permitida
      if (permitida !== 'escolha' && permitida !== msg.dificuldade) return []
      if (p.status === 'pronto' && p.dificuldade === msg.dificuldade) return []
      p.status = 'pronto'
      p.dificuldade = msg.dificuldade
      return estadoATodos(d)
    },

    toques(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, naMusica)
      if (achado === null || achado.p.status !== 'dancando') return []
      const { d, p } = achado
      p.placar = { ...msg.placar }
      const colegas: DancaColegasMessage = { type: 'danca.colegas', sessao: d.sessao, playerId, eventos: msg.eventos, placar: msg.placar }
      // Nunca ao remetente: a tela dele já desenhou os próprios toques.
      return d.participantes.filter((o) => o.playerId !== playerId && (o.status === 'dancando' || o.status === 'terminou')).flatMap((o) => para(o, colegas))
    },

    fim(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, naMusica)
      if (achado === null || achado.p.status !== 'dancando') return []
      achado.p.status = 'terminou'
      achado.p.final = { ...msg.placar }
      return estadoATodos(achado.d)
    },

    comecar() {
      const d = danca
      if (d === null || d.fase !== 'convite') return null
      // Pronto E na sala agora: quem caiu depois do Pronto não ouviria o "começar".
      const dancam = d.participantes.flatMap((p) => (p.status === 'pronto' && p.dificuldade !== undefined && ctx.conexaoDe(p.playerId) !== null ? [{ p, dificuldade: p.dificuldade }] : []))
      if (dancam.length === 0) return null
      const outbound: SaidaDaDanca[] = []
      for (const p of d.participantes) {
        if (dancam.some((item) => item.p === p)) continue
        outbound.push(...para(p, encerra(d, 'fora')))
        p.status = 'fora'
      }
      for (const { p } of dancam) p.status = 'dancando'
      d.fase = 'musica'
      const comecar: DancaHostMessage = {
        type: 'danca.comecar',
        sessao: d.sessao,
        emMs: DANCA_COMECAR_EM_MS,
        participantes: dancam.map(({ p, dificuldade }) => ({ playerId: p.playerId, nome: p.nome, dificuldade })),
      }
      for (const { p } of dancam) outbound.push(...para(p, comecar))
      return [...outbound, ...estadoATodos(d)]
    },

    pausar() {
      const d = danca
      if (d === null || d.fase !== 'musica') return null
      d.fase = 'pausa'
      return aQuemDanca(d, { type: 'danca.pausa', sessao: d.sessao })
    },

    retomar() {
      const d = danca
      if (d === null || d.fase !== 'pausa') return null
      d.fase = 'musica'
      return aQuemDanca(d, { type: 'danca.retoma', sessao: d.sessao })
    },

    encerrar() {
      const d = ativa()
      if (d === null) return null
      d.fase = 'encerrada'
      const msg = encerra(d, 'mestre')
      return d.participantes.filter((p) => p.status !== 'fora').flatMap((p) => para(p, msg))
    },

    entrou(playerId) {
      const d = ativa()
      const p = d?.participantes.find((item) => item.playerId === playerId)
      if (d === null || p === undefined || p.status === 'fora') return []
      // No convite, a aba nova não tem nada: o convite e o estado de novo (o Pronto dela fica).
      if (d.fase === 'convite') return [...para(p, conviteDe(d)), ...para(p, estadoDe(d))]
      // No meio da música a aba nova perdeu a música: quem dançava sai, e ela fica sabendo.
      if (p.status === 'dancando') {
        p.status = 'saiu'
        return [...para(p, encerra(d, 'saiu')), ...estadoATodos(d)]
      }
      if (p.status === 'saiu') return para(p, encerra(d, 'saiu'))
      // Quem terminou só espera o desfecho.
      return []
    },

    caiu(playerId) {
      const d = ativa()
      const p = d?.participantes.find((item) => item.playerId === playerId)
      // No convite a queda não muda nada: quem volta recebe o convite de novo, e quem não volta fica de fora no "Começar".
      if (d === null || p === undefined || d.fase === 'convite' || p.status !== 'dancando') return []
      p.status = 'saiu'
      return estadoATodos(d)
    },

    esquecer(playerId) {
      const d = ativa()
      const p = d?.participantes.find((item) => item.playerId === playerId)
      if (d === null || p === undefined) return []
      if (d.fase === 'convite') d.participantes = d.participantes.filter((item) => item !== p)
      else if (p.status === 'dancando') p.status = 'saiu'
      else return []
      return estadoATodos(d)
    },

    concluirSePronta() {
      const d = danca
      if (d === null || (d.fase !== 'musica' && d.fase !== 'pausa')) return null
      const dancaram = d.participantes.filter((p) => p.status === 'dancando' || p.status === 'terminou' || p.status === 'saiu')
      if (dancaram.some((p) => p.status === 'dancando')) return null
      const m = d.conf.minigame
      for (const p of dancaram) p.passou = p.final !== undefined && !p.final.falhou && passouDaNota(p.final.letra, m.notaMin)
      const todosPassaram = dancaram.length > 0 && dancaram.every((p) => p.passou === true)
      // A dança é a chave: com todos passando, a porta ligada é destrancada e aberta.
      const porta = todosPassaram ? d.conf.porta : undefined
      d.fase = 'fim'
      d.desfecho = { todosPassaram, portaAberta: porta !== undefined }
      const mesa: DancaLinhaDaMesa[] = dancaram.map((p) => ({ playerId: p.playerId, nome: p.nome, letra: linhaDaMesa(p), precisao: precisaoFinal(p) }))
      const outbound: SaidaDaDanca[] = []
      const efeitos: EfeitosDaDanca = { notas: [], pistas: [] }
      const itens: DancaDesfechoSinal['itens'] = []
      for (const p of dancaram) {
        const passou = p.passou === true
        const seu: DancaDesfechoMessage['seu'] = { passou }
        if (todosPassaram && m.premio.tipo !== 'nada') seu.premio = { ...m.premio }
        if (!passou && m.consequencia.tipo !== 'nada') seu.consequencia = { ...m.consequencia }
        outbound.push(...para(p, { type: 'danca.desfecho', sessao: d.sessao, todosPassaram, portaAberta: porta !== undefined, mesa, seu }))
        if (todosPassaram) {
          // O prêmio é de CADA um: a chave de latão na mochila de todos, a pista no caderno de todos.
          if (m.premio.tipo === 'item' && m.premio.texto.trim() !== '') itens.push({ playerId: p.playerId, nome: p.nome, itemId: ctx.randomId(), texto: m.premio.texto })
          if (m.premio.tipo === 'pista') {
            const titulo = m.npc.trim() === '' ? TITULO_DA_PISTA_SEM_NPC : m.npc.trim()
            efeitos.pistas.push({ playerId: p.playerId, titulo, texto: m.premio.texto, fonte: `danca|${d.sessao}` })
          }
          // O app não tem modificador de uma vez só: o bônus vira recado, e o mestre aplica à mão.
          if (m.premio.tipo === 'bonus') efeitos.notas.push({ playerId: p.playerId, texto: `Bônus guardado: ${m.premio.texto}` })
        } else if (!passou && m.consequencia.tipo === 'teste') {
          efeitos.notas.push({ playerId: p.playerId, texto: `Consequência: ${m.consequencia.texto}` })
        }
      }
      const sinal: DancaDesfechoSinal = {
        sessao: d.sessao,
        npc: m.npc,
        todosPassaram,
        ...(porta === undefined ? {} : { porta: { ...porta } }),
        premio: { ...m.premio },
        consequencia: { ...m.consequencia },
        mesa: dancaram.map((p) => ({ playerId: p.playerId, nome: p.nome, passou: p.passou === true, letra: linhaDaMesa(p), precisao: precisaoFinal(p) })),
        itens,
      }
      return { outbound, sinal, efeitos }
    },

    aoVivo() {
      const d = danca
      if (d === null) return null
      return {
        sessao: d.sessao,
        pinId: d.conf.pinId,
        npc: d.conf.minigame.npc,
        fase: d.fase,
        notaMin: d.conf.minigame.notaMin,
        temPorta: d.conf.porta !== undefined,
        premio: { ...d.conf.minigame.premio },
        consequencia: { ...d.conf.minigame.consequencia },
        participantes: d.participantes.map((p) => ({
          playerId: p.playerId,
          nome: p.nome,
          status: p.status,
          conectado: ctx.conexaoDe(p.playerId) !== null,
          ...(p.dificuldade === undefined ? {} : { dificuldade: p.dificuldade }),
          ...(p.placar === undefined ? {} : { placar: { ...p.placar } }),
          ...(p.final === undefined ? {} : { final: { ...p.final } }),
          ...(p.passou === undefined ? {} : { passou: p.passou }),
        })),
        ...(d.desfecho === undefined ? {} : { desfecho: { ...d.desfecho } }),
      }
    },
  }
}
