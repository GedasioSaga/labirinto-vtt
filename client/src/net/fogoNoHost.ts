import { ALTURAS_FOGO, type DificuldadeFogo, type FerramentaFogo, type MinigameFogo, type ModoFogo } from '../minigames/fogo/tipos'
import {
  FOGO_ATRASO_PADRAO,
  FOGO_EQUIPE_MAX,
  FOGO_LOTE_MAX,
  FOGO_LOTES_MAX,
  FOGO_SEMENTE_MAX,
  type FogoComecarMessage,
  type FogoConviteMessage,
  type FogoDesfechoMessage,
  type FogoDesistirMessage,
  type FogoEntrada,
  type FogoEntradasMessage,
  type FogoEstadoMessage,
  type FogoFimMessage,
  type FogoHashMessage,
  type FogoHostMessage,
  type FogoLinhaDaMesa,
  type FogoLote,
  type FogoMotivoDoFim,
  type FogoPlacar,
  type FogoProntoMessage,
  type FogoResultado,
  type FogoResumoDoPlacar,
  type FogoStatus,
} from './protocoloDoFogo'

/**
 * MINIGAME FOGO NA FLORESTA AO VIVO, lado do mestre: o incêndio ativo, quem
 * joga, o REPASSE das entradas (lockstep) e a conferência dos hashes. Puro e
 * síncrono como a `hostSession`, que o monta, encaminha as mensagens e chama
 * `repassar()` a cada `FOGO_REPASSE_MS` (o relógio é da `hostBridge`).
 *
 * Regras do lockstep (contrato do jogo, `ponte-app-labirinto.md` seção 2):
 *  1. o mesmo `fogo.comecar` para todos da equipe (semente, dificuldade,
 *     atraso e a lista de jogadores NA MESMA ORDEM);
 *  2. toda entrada de um jogador chega a todos os OUTROS, uma vez, sem mudar
 *     (nunca de volta ao remetente);
 *  3. quem cai: `fogo.sair` com `depoisDe` = o último tique dele que foi
 *     repassado; o que estava na fila dele morre ali (ninguém o recebeu);
 *  4. hash diferente no mesmo tique é defeito: o painel do mestre avisa;
 *  5. na equipe, todo fim (tique, hash e placar) tem de ser igual: com
 *     divergência, o jogo fecha como `divergiu`, sem prêmio nem consequência.
 *
 * Quem desiste (`fogo.desistir`: "Agora não", ou o jogo não carregou) sai do
 * convite ou da partida, para a equipe não ficar esperando as entradas dele.
 *
 * Um incêndio ativo por vez. Mensagem de outra sessão, de quem não foi
 * chamado ou fora de fase morre calada, como na dança.
 */

export interface SaidaDoFogo {
  clientId: string
  msg: FogoHostMessage
}

/** `fim`: saiu o desfecho; `encerrada`: o mestre encerrou antes. As duas deixam convidar de novo. */
export type FogoFase = 'convite' | 'jogo' | 'pausa' | 'fim' | 'encerrada'

/** O desafio congelado no convite: mexer no pino durante o jogo não muda o que está valendo. */
export interface FogoCongelado {
  pinId: string
  minigame: MinigameFogo
}

export interface FogoConvidado {
  playerId: string
  nome: string
  ferramenta: FerramentaFogo
}

export type FogoConviteResultado = { ok: true; sessao: string; convidados: number } | { ok: false; motivo: 'pino' | 'ocupada' | 'ninguem' }

export interface FogoParticipanteNoMestre {
  playerId: string
  nome: string
  ferramenta: FerramentaFogo
  status: FogoStatus
  conectado: boolean
  /** Só depois do desfecho. */
  pontos?: number
  /** Só depois do desfecho: o fogo que as ferramentas dele tiraram das alturas que contam. */
  fogoCerto?: number
  resultado?: FogoResultado
}

/** O que o painel do MESTRE lê do fogo. Nunca vai pela rede. */
export interface FogoAoVivo {
  sessao: string
  pinId: string
  npc: string
  floresta: string
  modo: ModoFogo
  fase: FogoFase
  dificuldade?: DificuldadeFogo
  participantes: FogoParticipanteNoMestre[]
  /** O primeiro tique em que os aparelhos discordaram, e de quem era cada lado. */
  divergencia?: { tique: number; nomes: string[] }
  /** No modo equipe, o placar do time (ausente quando ninguém terminou); no solo, o desfecho inteiro fica ausente (cada linha tem o seu). */
  desfecho?: { vitoria: boolean; placar?: FogoResumoDoPlacar }
}

export interface ContextoDoFogo {
  /** A conexão do jogador AGORA; `null` = fora do ar ou esquecido. */
  conexaoDe(playerId: string): string | null
  randomId(): string
}

interface Participante {
  playerId: string
  nome: string
  ferramenta: FerramentaFogo
  status: FogoStatus
  /** Último tique dele que chegou ao mestre (0 = nenhum). */
  ultimoRecebido: number
  /** Último tique dele repassado aos colegas: o `depoisDe` do `fogo.sair`. */
  ultimoRepassado: number
  /** O que chegou e ainda não foi repassado, por tique (em ordem crescente). */
  fila: { tique: number; e: FogoEntrada }[]
  fim?: { tique: number; hash: number; placar: FogoPlacar }
  resultado?: FogoResultado
  pontos?: number
  fogoCerto?: number
}

interface Fogo {
  sessao: string
  conf: FogoCongelado
  modo: ModoFogo
  fase: FogoFase
  dificuldade?: DificuldadeFogo
  /** Na ordem da sala; no modo equipe, é a ordem dos jogadores na simulação. */
  participantes: Participante[]
  /** O hash de cada tique (o primeiro que chegou) e de quem: os outros são comparados com ele. */
  hashes: Map<number, { hash: number; playerId: string }>
  divergencia?: { tique: number; nomes: string[] }
  desfecho?: FogoAoVivo['desfecho']
}

export interface FogoNoHost {
  convidar(conf: FogoCongelado, modo: ModoFogo, convidados: readonly FogoConvidado[]): { outbound: SaidaDoFogo[]; resultado: FogoConviteResultado }
  pronto(playerId: string, msg: FogoProntoMessage): SaidaDoFogo[]
  /** O mestre troca a ferramenta inicial de alguém no painel (só no convite). */
  mudarFerramenta(playerId: string, ferramenta: FerramentaFogo): SaidaDoFogo[] | null
  entradas(playerId: string, msg: FogoEntradasMessage): SaidaDoFogo[]
  hash(playerId: string, msg: FogoHashMessage): SaidaDoFogo[]
  fim(playerId: string, msg: FogoFimMessage): SaidaDoFogo[]
  /** No convite: "Agora não" deixa de fora; o jogo que não carregou volta a Convidado. No jogo: sai como quem caiu. */
  desistir(playerId: string, msg: FogoDesistirMessage): SaidaDoFogo[]
  /** O que chegou desde o último repasse, a cada colega. Vazio quando não há o que mandar. */
  repassar(): SaidaDoFogo[]
  /** `null` = nada a fazer (sem convite aberto, ou ninguém pronto e conectado). */
  comecar(dificuldade: DificuldadeFogo, atraso?: number): SaidaDoFogo[] | null
  pausar(): SaidaDoFogo[] | null
  retomar(): SaidaDoFogo[] | null
  encerrar(): SaidaDoFogo[] | null
  /** A conexão do jogador é nova (entrou, voltou): o que ela precisa receber do fogo. */
  entrou(playerId: string): SaidaDoFogo[]
  /** A conexão caiu (já sem `conexaoDe`): no meio do jogo, quem jogava sai. */
  caiu(playerId: string): SaidaDoFogo[]
  /** O jogador foi expulso (já sem `conexaoDe`). */
  esquecer(playerId: string): SaidaDoFogo[]
  aoVivo(): FogoAoVivo | null
}

const ativaNaFase = (fase: FogoFase): boolean => fase === 'convite' || fase === 'jogo' || fase === 'pausa'

/** Semente do jogo (0 a 2^31-1) a partir de um id aleatório: FNV-1a de 32 bits. */
export function sementeDoFogo(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % (FOGO_SEMENTE_MAX + 1)
}

/** Cópia funda do resumo: o painel e cada desfecho não dividem objeto. */
function copiaDoResumo(resumo: FogoResumoDoPlacar): FogoResumoDoPlacar {
  const { contam, alturas } = resumo
  return { ...resumo, contam: [...contam], alturas: { rasteiro: { ...alturas.rasteiro }, tronco: { ...alturas.tronco }, copa: { ...alturas.copa } } }
}

/** O placar do time sem as linhas de cada um. */
function resumoDe(placar: FogoPlacar): FogoResumoDoPlacar {
  const { porJogador: _porJogador, ...resumo } = placar
  return copiaDoResumo(resumo)
}

/** Os lotes de um jogador: trechos de tiques seguidos, até `FOGO_LOTE_MAX` entradas cada. */
function lotesDaFila(id: string, fila: readonly { tique: number; e: FogoEntrada }[]): FogoLote[] {
  const lotes: FogoLote[] = []
  for (const { tique, e } of fila) {
    const ultimo = lotes.at(-1)
    if (ultimo !== undefined && ultimo.de + ultimo.lista.length === tique && ultimo.lista.length < FOGO_LOTE_MAX) ultimo.lista.push(e)
    else lotes.push({ id, de: tique, lista: [e] })
  }
  return lotes
}

export function criarFogoNoHost(ctx: ContextoDoFogo): FogoNoHost {
  let fogo: Fogo | null = null

  const ativo = (): Fogo | null => (fogo !== null && ativaNaFase(fogo.fase) ? fogo : null)

  const para = (p: Participante, msg: FogoHostMessage): SaidaDoFogo[] => {
    const clientId = ctx.conexaoDe(p.playerId)
    return clientId === null ? [] : [{ clientId, msg }]
  }

  const estadoDe = (f: Fogo): FogoEstadoMessage => ({
    type: 'fogo.estado',
    sessao: f.sessao,
    fase: f.fase === 'convite' ? 'convite' : f.fase === 'pausa' ? 'pausa' : 'jogo',
    participantes: f.participantes.map((p) => ({ playerId: p.playerId, status: p.status, ferramenta: p.ferramenta })),
  })

  /** O estado a quem segue no fogo: o `fora` já recebeu o `fogo.encerra`. */
  const estadoATodos = (f: Fogo): SaidaDoFogo[] => {
    const estado = estadoDe(f)
    return f.participantes.filter((p) => p.status !== 'fora').flatMap((p) => para(p, estado))
  }

  const conviteDe = (f: Fogo): FogoConviteMessage => {
    const m = f.conf.minigame
    return {
      type: 'fogo.convite',
      sessao: f.sessao,
      pinId: f.conf.pinId,
      npc: m.npc,
      fala: m.fala,
      floresta: m.floresta,
      modo: f.modo,
      premio: { ...m.premio },
      consequencia: { ...m.consequencia },
      participantes: f.participantes.map((p) => ({ playerId: p.playerId, nome: p.nome, ferramenta: p.ferramenta })),
    }
  }

  const encerra = (f: Fogo, motivo: FogoMotivoDoFim): FogoHostMessage => ({ type: 'fogo.encerra', sessao: f.sessao, motivo })

  const doJogador = (playerId: string, sessao: string, fases: readonly FogoFase[]): { f: Fogo; p: Participante } | null => {
    const f = fogo
    if (f === null || f.sessao !== sessao || !fases.includes(f.fase)) return null
    const p = f.participantes.find((item) => item.playerId === playerId)
    return p === undefined ? null : { f, p }
  }

  const noJogo = ['jogo', 'pausa'] as const
  const jogando = (f: Fogo): Participante[] => f.participantes.filter((p) => p.status === 'jogando')

  /** Confere o hash de um tique com o primeiro que chegou; a primeira diferença fica para o painel. */
  const conferirHash = (f: Fogo, p: Participante, tique: number, hash: number): void => {
    if (f.modo !== 'equipe') return
    const primeiro = f.hashes.get(tique)
    if (primeiro === undefined) {
      f.hashes.set(tique, { hash, playerId: p.playerId })
      return
    }
    if (primeiro.hash === hash || f.divergencia !== undefined) return
    const nomeDe = (playerId: string) => f.participantes.find((o) => o.playerId === playerId)?.nome ?? playerId
    f.divergencia = { tique, nomes: [nomeDe(primeiro.playerId), p.nome] }
  }

  /**
   * Quem jogava saiu (caiu, aba nova, expulso): a fila dele morre, e os
   * colegas da equipe recebem o `fogo.sair` com o último tique repassado.
   */
  const tirarDoJogo = (f: Fogo, p: Participante): SaidaDoFogo[] => {
    p.status = 'saiu'
    p.fila = []
    if (f.modo !== 'equipe') return []
    const sair: FogoHostMessage = { type: 'fogo.sair', sessao: f.sessao, id: p.playerId, depoisDe: p.ultimoRepassado }
    return jogando(f).flatMap((o) => para(o, sair))
  }

  const linhaDe = (p: Participante): FogoLinhaDaMesa => ({
    playerId: p.playerId,
    nome: p.nome,
    ferramenta: p.ferramenta,
    pontos: p.pontos ?? 0,
    fogoCerto: p.fogoCerto ?? 0,
    resultado: p.resultado ?? 'saiu',
  })

  /** Fecha o fogo ativo sem desfecho: ninguém ganha nem perde. Avisa todo mundo menos quem já ficou de fora. */
  const fecharSemDesfecho = (f: Fogo, motivo: FogoMotivoDoFim): SaidaDoFogo[] => {
    f.fase = 'encerrada'
    const msg = encerra(f, motivo)
    return f.participantes.filter((p) => p.status !== 'fora').flatMap((p) => para(p, msg))
  }

  /** O fim de um aparelho, para comparar com o dos colegas: tique, hash e o placar inteiro (as linhas por id, as alturas na ordem fixa). */
  const chaveDoFim = (fim: NonNullable<Participante['fim']>): string => {
    const p = fim.placar
    const linhas = [...p.porJogador].sort((a, b) => a.id.localeCompare(b.id)).map((l) => [l.id, l.ferramenta, l.pontos, l.fogoCerto])
    const alturas = ALTURAS_FOGO.map((a) => [a, p.alturas[a].viva, p.alturas[a].inicial, p.alturas[a].vivasNoFim, p.alturas[a].queimadas])
    return JSON.stringify([fim.tique, fim.hash, p.vitoria, p.motivo, p.modo, p.contam, p.pontos, p.estrelas, p.florestaViva, alturas, p.casas, p.tempoS, linhas])
  }

  /**
   * Equipe: todo aparelho roda a MESMA partida, então todo fim tem de ser
   * igual. Hash que já divergiu no meio, ou um fim diferente (aparelho com
   * defeito, placar forjado), derruba o desfecho. A primeira diferença fica
   * para o painel, como a do hash.
   */
  const finsDivergem = (f: Fogo, fins: readonly { p: Participante; fim: NonNullable<Participante['fim']> }[]): boolean => {
    if (f.divergencia !== undefined) return true
    const [primeiro, ...outros] = fins
    if (primeiro === undefined) return false
    const chave = chaveDoFim(primeiro.fim)
    const outro = outros.find((o) => chaveDoFim(o.fim) !== chave)
    if (outro === undefined) return false
    f.divergencia = { tique: Math.min(primeiro.fim.tique, outro.fim.tique), nomes: [primeiro.p.nome, outro.p.nome] }
    return true
  }

  /** Ninguém mais jogando: o desfecho, uma vez só. */
  const concluirSePronto = (f: Fogo): SaidaDoFogo[] => {
    if ((f.fase !== 'jogo' && f.fase !== 'pausa') || jogando(f).length > 0) return []
    const jogaram = f.participantes.filter((p) => p.status === 'terminou' || p.status === 'saiu')
    const fins = jogaram.flatMap((p) => (p.fim === undefined ? [] : [{ p, fim: p.fim }]))
    if (f.modo === 'equipe' && finsDivergem(f, fins)) return fecharSemDesfecho(f, 'divergiu')
    const m = f.conf.minigame
    // Equipe: os fins conferidos são todos iguais, então o placar do time é o de qualquer um.
    const doTime = f.modo === 'equipe' ? fins[0]?.fim.placar : undefined
    for (const p of jogaram) {
      const placar = f.modo === 'equipe' ? doTime : p.fim?.placar
      // Quem saiu no meio não está no placar do time: fica com 0.
      const linha = placar?.porJogador.find((item) => item.id === p.playerId)
      p.pontos = linha?.pontos ?? 0
      p.fogoCerto = linha?.fogoCerto ?? 0
      p.resultado = p.status === 'saiu' || placar === undefined ? 'saiu' : placar.vitoria ? 'venceu' : 'perdeu'
    }
    f.fase = 'fim'
    if (f.modo === 'equipe') {
      f.desfecho = doTime === undefined ? { vitoria: false } : { vitoria: doTime.vitoria, placar: resumoDe(doTime) }
    }
    const mesa = jogaram.map(linhaDe)
    return jogaram.flatMap((p) => {
      const passou = p.resultado === 'venceu'
      const placar = f.modo === 'equipe' ? doTime : p.fim?.placar
      const seu: FogoDesfechoMessage['seu'] = { passou }
      if (passou && m.premio.texto.trim() !== '') seu.premio = { ...m.premio }
      if (!passou && m.consequencia.texto.trim() !== '') seu.consequencia = { ...m.consequencia }
      const msg: FogoDesfechoMessage = { type: 'fogo.desfecho', sessao: f.sessao, modo: f.modo, mesa, seu }
      if (placar !== undefined) msg.placar = resumoDe(placar)
      return para(p, msg)
    })
  }

  return {
    convidar(conf, modo, convidados) {
      if (ativo() !== null) return { outbound: [], resultado: { ok: false, motivo: 'ocupada' } }
      // Equipe: a simulação aceita até 6 no mesmo incêndio; os de depois nem são chamados.
      const chamados = modo === 'equipe' ? convidados.slice(0, FOGO_EQUIPE_MAX) : convidados
      if (chamados.length === 0) return { outbound: [], resultado: { ok: false, motivo: 'ninguem' } }
      const f: Fogo = {
        sessao: ctx.randomId(),
        conf,
        modo,
        fase: 'convite',
        participantes: chamados.map((c) => ({ playerId: c.playerId, nome: c.nome, ferramenta: c.ferramenta, status: 'convidado', ultimoRecebido: 0, ultimoRepassado: 0, fila: [] })),
        hashes: new Map(),
      }
      fogo = f
      const convite = conviteDe(f)
      return { outbound: f.participantes.flatMap((p) => para(p, convite)), resultado: { ok: true, sessao: f.sessao, convidados: f.participantes.length } }
    },

    pronto(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, ['convite'])
      if (achado === null) return []
      const { f, p } = achado
      if (p.status !== 'convidado' && p.status !== 'pronto') return []
      if (p.status === 'pronto' && p.ferramenta === msg.ferramenta) return []
      p.status = 'pronto'
      p.ferramenta = msg.ferramenta
      return estadoATodos(f)
    },

    mudarFerramenta(playerId, ferramenta) {
      const f = fogo
      const p = f?.participantes.find((item) => item.playerId === playerId)
      if (f === null || f.fase !== 'convite' || p === undefined) return null
      if (p.ferramenta === ferramenta) return []
      p.ferramenta = ferramenta
      return estadoATodos(f)
    },

    entradas(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, noJogo)
      if (achado === null || achado.p.status !== 'jogando' || achado.f.modo !== 'equipe') return []
      const { p } = achado
      msg.lista.forEach((e, i) => {
        const tique = msg.de + i
        // Repetida (a mesma de novo) ou atrasada: a primeira que chegou vale, como no jogo.
        if (tique <= p.ultimoRecebido) return
        p.fila.push({ tique, e })
        p.ultimoRecebido = tique
      })
      return []
    },

    hash(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, noJogo)
      if (achado === null || achado.p.status !== 'jogando') return []
      conferirHash(achado.f, achado.p, msg.tique, msg.hash)
      return []
    },

    fim(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, noJogo)
      if (achado === null || achado.p.status !== 'jogando') return []
      const { f, p } = achado
      conferirHash(f, p, msg.tique, msg.hash)
      p.status = 'terminou'
      p.fim = { tique: msg.tique, hash: msg.hash, placar: msg.placar }
      // O último a terminar fecha o jogo: o desfecho (ou o encerra da divergência) já diz tudo, sem estado antes.
      const fechou = concluirSePronto(f)
      return f.fase === 'jogo' || f.fase === 'pausa' ? estadoATodos(f) : fechou
    },

    desistir(playerId, msg) {
      const achado = doJogador(playerId, msg.sessao, ['convite', ...noJogo])
      if (achado === null) return []
      const { f, p } = achado
      if (f.fase === 'convite') {
        // "Agora não": fica de fora (o painel mostra, e a volta da conexão não reabre o convite).
        // O jogo não carregou: volta a Convidado, sem o Pronto; se carregar depois (recarregou a página), entra de novo.
        if (p.status === 'fora') return []
        const status: FogoStatus = msg.motivo === 'recusou' ? 'fora' : 'convidado'
        if (p.status === status) return []
        p.status = status
        return estadoATodos(f)
      }
      // No jogo: quem já terminou fica com o fim que mandou; quem jogava sai como quem caiu.
      if (p.status !== 'jogando') return []
      const colegas = tirarDoJogo(f, p)
      return [...colegas, ...estadoATodos(f), ...concluirSePronto(f)]
    },

    repassar() {
      const f = fogo
      if (f === null || f.modo !== 'equipe' || (f.fase !== 'jogo' && f.fase !== 'pausa')) return []
      const remetentes = f.participantes.filter((p) => p.fila.length > 0)
      if (remetentes.length === 0) return []
      const lotesDe = new Map(remetentes.map((p) => [p.playerId, lotesDaFila(p.playerId, p.fila)]))
      const outbound: SaidaDoFogo[] = []
      for (const destino of jogando(f)) {
        // Nunca as do próprio: o jogo dele já as tem.
        const lotes = remetentes.filter((p) => p !== destino).flatMap((p) => lotesDe.get(p.playerId) ?? [])
        for (let i = 0; i < lotes.length; i += FOGO_LOTES_MAX) {
          outbound.push(...para(destino, { type: 'fogo.entradas', sessao: f.sessao, lotes: lotes.slice(i, i + FOGO_LOTES_MAX) }))
        }
      }
      for (const p of remetentes) {
        p.ultimoRepassado = p.fila[p.fila.length - 1].tique
        p.fila = []
      }
      return outbound
    },

    comecar(dificuldade, atraso = FOGO_ATRASO_PADRAO) {
      const f = fogo
      if (f === null || f.fase !== 'convite') return null
      // Pronto E na sala agora: quem caiu depois do Pronto não ouviria o "começar".
      const jogam = f.participantes.filter((p) => p.status === 'pronto' && ctx.conexaoDe(p.playerId) !== null)
      if (jogam.length === 0) return null
      const outbound: SaidaDoFogo[] = []
      for (const p of f.participantes) {
        // Quem já ficou de fora no convite ("Agora não") fechou a tela: não precisa ouvir de novo.
        if (jogam.includes(p) || p.status === 'fora') continue
        outbound.push(...para(p, encerra(f, 'fora')))
        p.status = 'fora'
      }
      for (const p of jogam) p.status = 'jogando'
      f.fase = 'jogo'
      f.dificuldade = dificuldade
      const semente = sementeDoFogo(ctx.randomId())
      const partida = (quem: readonly Participante[]): FogoComecarMessage => ({
        type: 'fogo.comecar',
        sessao: f.sessao,
        semente,
        dificuldade,
        atraso,
        jogadores: quem.map((p) => ({ id: p.playerId, nome: p.nome, ferramenta: p.ferramenta })),
      })
      // Equipe: o MESMO começar para todos (a ordem é o número na simulação); solo: cada um no seu incêndio.
      const daEquipe = partida(jogam)
      for (const p of jogam) outbound.push(...para(p, f.modo === 'equipe' ? daEquipe : partida([p])))
      return [...outbound, ...estadoATodos(f)]
    },

    pausar() {
      const f = fogo
      if (f === null || f.fase !== 'jogo') return null
      f.fase = 'pausa'
      const msg: FogoHostMessage = { type: 'fogo.pausa', sessao: f.sessao }
      return jogando(f).flatMap((p) => para(p, msg))
    },

    retomar() {
      const f = fogo
      if (f === null || f.fase !== 'pausa') return null
      f.fase = 'jogo'
      const msg: FogoHostMessage = { type: 'fogo.retoma', sessao: f.sessao }
      return jogando(f).flatMap((p) => para(p, msg))
    },

    encerrar() {
      const f = ativo()
      if (f === null) return null
      return fecharSemDesfecho(f, f.divergencia === undefined ? 'mestre' : 'divergiu')
    },

    entrou(playerId) {
      const f = ativo()
      const p = f?.participantes.find((item) => item.playerId === playerId)
      if (f === null || p === undefined || p.status === 'fora') return []
      // No convite, a aba nova não tem nada: o convite e o estado de novo (o Pronto dela fica).
      if (f.fase === 'convite') return [...para(p, conviteDe(f)), ...para(p, estadoDe(f))]
      // No meio do jogo a aba nova perdeu a partida: quem jogava sai, e ela fica sabendo.
      if (p.status === 'jogando') {
        const colegas = tirarDoJogo(f, p)
        return [...para(p, encerra(f, 'saiu')), ...colegas, ...estadoATodos(f), ...concluirSePronto(f)]
      }
      if (p.status === 'saiu') return para(p, encerra(f, 'saiu'))
      return []
    },

    caiu(playerId) {
      const f = ativo()
      const p = f?.participantes.find((item) => item.playerId === playerId)
      // No convite a queda não muda nada: quem volta recebe o convite de novo.
      if (f === null || p === undefined || f.fase === 'convite' || p.status !== 'jogando') return []
      const colegas = tirarDoJogo(f, p)
      return [...colegas, ...estadoATodos(f), ...concluirSePronto(f)]
    },

    esquecer(playerId) {
      const f = ativo()
      const p = f?.participantes.find((item) => item.playerId === playerId)
      if (f === null || p === undefined) return []
      if (f.fase === 'convite') {
        f.participantes = f.participantes.filter((item) => item !== p)
        return estadoATodos(f)
      }
      if (p.status !== 'jogando') return []
      const colegas = tirarDoJogo(f, p)
      return [...colegas, ...estadoATodos(f), ...concluirSePronto(f)]
    },

    aoVivo() {
      const f = fogo
      if (f === null) return null
      return {
        sessao: f.sessao,
        pinId: f.conf.pinId,
        npc: f.conf.minigame.npc,
        floresta: f.conf.minigame.floresta,
        modo: f.modo,
        fase: f.fase,
        ...(f.dificuldade === undefined ? {} : { dificuldade: f.dificuldade }),
        participantes: f.participantes.map((p) => ({
          playerId: p.playerId,
          nome: p.nome,
          ferramenta: p.ferramenta,
          status: p.status,
          conectado: ctx.conexaoDe(p.playerId) !== null,
          ...(p.pontos === undefined ? {} : { pontos: p.pontos }),
          ...(p.fogoCerto === undefined ? {} : { fogoCerto: p.fogoCerto }),
          ...(p.resultado === undefined ? {} : { resultado: p.resultado }),
        })),
        ...(f.divergencia === undefined ? {} : { divergencia: { tique: f.divergencia.tique, nomes: [...f.divergencia.nomes] } }),
        ...(f.desfecho === undefined
          ? {}
          : { desfecho: { vitoria: f.desfecho.vitoria, ...(f.desfecho.placar === undefined ? {} : { placar: copiaDoResumo(f.desfecho.placar) }) } }),
      }
    },
  }
}
