import type { DificuldadeFogo } from '../tipos'
import { erroDaFalhaDoJogo } from './textos'
import type { ProgressoDaCarga } from './vigiaDaCarga'
import {
  FOGO_LOTE_MAX,
  FOGO_LOTES_MAX,
  lerEntradaDoFogo,
  placarDoJogo,
  type FogoEntrada,
  type FogoJogadorDaPartida,
  type FogoLote,
  type FogoPlacar,
} from '../../../net/protocoloDoFogo'

/**
 * A PONTE COM O JOGO (o export web do Godot num iframe), contrato da seção 6
 * do GDD do Fogo na Floresta: só `postMessage`, texto JSON com
 * `{jogo: 'fogo', v: 2, tipo, ...}` (a versão 2 é a primeira pessoa: o
 * `iniciar` leva a `ferramenta` de cada um, e o jogo ignora `v: 1`).
 *
 *  - jogo → app: `pronto`, `iniciado`, `erro`, `entrada` (a MINHA, uma por
 *    tique), `hash` (a cada 50 tiques) e `fim` (o placar); antes do `pronto`,
 *    a casca do export web manda `carga` (bytes que já chegaram e o total) e
 *    `falha` (o motivo de não carregar). Pacote antigo não manda nenhum dos dois;
 *  - app → jogo: `iniciar`, `entradas` (as dos colegas), `sair`, `pausa`,
 *    `retoma` e `encerrar`.
 *
 * Sem React e sem rede: quem monta (a `FogoOverlay`, ou a mesa de prova)
 * entrega o que chega do iframe em `receber` e as mensagens do mestre nos
 * outros métodos; a ponte guarda o que chegou cedo (o `iniciar` antes do
 * `pronto`, entradas antes do `iniciado`) e junta as minhas entradas até
 * `repassar()`, chamado a cada `FOGO_REPASSE_MS`.
 */

/** Por onde as MINHAS coisas saem para o mestre (a conexão do jogador). */
export interface SaidaDaPonte {
  entradas(de: number, lista: FogoEntrada[]): boolean
  hash(tique: number, hash: number): boolean
  fim(tique: number, hash: number, placar: FogoPlacar): boolean
}

export interface PartidaDoFogo {
  semente: number
  dificuldade: DificuldadeFogo
  atraso: number
  /** Na ordem do mestre: é o número de cada um na simulação. */
  jogadores: FogoJogadorDaPartida[]
  /** O id deste aparelho na lista. */
  eu: string
}

/** `carregando` até o `pronto`; `esperando` = pronto, sem partida ainda. */
export type EstadoDaPonte = 'carregando' | 'esperando' | 'jogando' | 'fim' | 'erro'

export interface OpcoesDaPonte {
  /** A janela do iframe agora (`null` = ainda não montou). */
  janela(): MessageEventSource | null
  /** Para onde vai cada mensagem: a origem do jogo. */
  enviar(texto: string): void
  saida: SaidaDaPonte
  /** Solo: ninguém precisa das minhas entradas. */
  repassarMinhas: boolean
  aoMudar?(estado: EstadoDaPonte, erro?: string): void
  /** Enquanto carrega: os bytes do jogo que já chegaram (só o pacote novo avisa). */
  aoCarregar?(carga: ProgressoDaCarga): void
}

export interface PonteDoJogo {
  /** Uma mensagem do `window` (o filtro de quem mandou é aqui). */
  receber(ev: { source: MessageEventSource | null; data: unknown }): void
  iniciar(partida: PartidaDoFogo): void
  entradasDosColegas(lotes: readonly FogoLote[]): void
  sair(id: string, depoisDe: number): void
  pausar(pausada: boolean): void
  encerrar(): void
  /** O jogo não chegou (a rota não existe, o download caiu, demorou demais): `carregando` vira `erro`. Depois do `pronto`, nada muda. */
  falhouCarga(erro: string): void
  /**
   * "Tentar de novo": o iframe vai carregar outra vez, e o `erro` da carga
   * volta a `carregando`. Só antes de haver partida (no convite); devolve se voltou.
   */
  recarregar(): boolean
  /** Manda ao mestre as minhas entradas juntas desde o último. */
  repassar(): void
  estado(): EstadoDaPonte
}

const ENVELOPE = { jogo: 'fogo', v: 2 } as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const inteiro = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value)

/** O texto do jogo, aberto: `null` = não é do Fogo na versão da ponte (`ENVELOPE.v`). */
function lerDoJogo(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'string') return null
  let valor: unknown
  try {
    valor = JSON.parse(data)
  } catch {
    return null
  }
  return isRecord(valor) && valor.jogo === ENVELOPE.jogo && valor.v === ENVELOPE.v && typeof valor.tipo === 'string' ? valor : null
}

export function criarPonteDoJogo(op: OpcoesDaPonte): PonteDoJogo {
  let estado: EstadoDaPonte = 'carregando'
  let partida: PartidaDoFogo | null = null
  let pausada = false
  /** Entradas dos colegas que chegaram antes do `iniciado`. */
  let lotesCedo: FogoLote[] = []
  const saidasCedo: { id: string; depoisDe: number }[] = []
  /** As minhas entradas desde o último repasse: um trecho de tiques seguidos por vez. */
  let minhas: { de: number; lista: FogoEntrada[] }[] = []
  let ultimaMinha = 0

  const mudar = (novo: EstadoDaPonte, erro?: string) => {
    if (novo === estado && erro === undefined) return
    estado = novo
    op.aoMudar?.(novo, erro)
  }

  const paraOJogo = (tipo: string, campos: Record<string, unknown> = {}) => op.enviar(JSON.stringify({ ...ENVELOPE, tipo, ...campos }))

  const mandarLotes = (lotes: readonly FogoLote[]) => {
    for (let i = 0; i < lotes.length; i += FOGO_LOTES_MAX) paraOJogo('entradas', { lotes: lotes.slice(i, i + FOGO_LOTES_MAX) })
  }

  const mandarIniciar = () => {
    if (partida === null || estado !== 'esperando') return
    const { semente, dificuldade, atraso, eu } = partida
    // Só os 3 campos que o jogo lê, na ordem do mestre (a ordem é o número na simulação).
    const jogadores = partida.jogadores.map(({ id, nome, ferramenta }) => ({ id, nome, ferramenta }))
    paraOJogo('iniciar', { semente, dificuldade, atraso, jogadores, eu })
  }

  const guardarMinha = (tique: number, e: FogoEntrada) => {
    // Repetida ou atrasada: o jogo nunca manda, mas se mandar a primeira vale.
    if (tique <= ultimaMinha) return
    ultimaMinha = tique
    const trecho = minhas.at(-1)
    if (trecho !== undefined && trecho.de + trecho.lista.length === tique && trecho.lista.length < FOGO_LOTE_MAX) trecho.lista.push(e)
    else minhas.push({ de: tique, lista: [e] })
  }

  const doJogo = (m: Record<string, unknown>) => {
    switch (m.tipo) {
      case 'carga':
        if (estado === 'carregando' && inteiro(m.atual) && inteiro(m.total) && m.atual >= 0 && m.total > 0 && m.atual <= m.total) op.aoCarregar?.({ atual: m.atual, total: m.total })
        return
      case 'falha':
        // A casca do jogo desistiu de carregar e disse por quê (sem WebGL 2, conexão que caiu...).
        if (estado === 'carregando') mudar('erro', erroDaFalhaDoJogo(m.motivo))
        return
      case 'pronto':
        if (estado === 'carregando') {
          mudar('esperando')
          mandarIniciar()
        }
        return
      case 'iniciado':
        if (estado !== 'esperando') return
        mudar('jogando')
        if (lotesCedo.length > 0) mandarLotes(lotesCedo)
        lotesCedo = []
        for (const s of saidasCedo.splice(0)) paraOJogo('sair', { id: s.id, depois_de: s.depoisDe })
        if (pausada) paraOJogo('pausa')
        return
      case 'erro':
        mudar('erro', typeof m.erro === 'string' ? m.erro : 'o jogo recusou a partida')
        return
      case 'entrada': {
        const e = lerEntradaDoFogo(m.e)
        if (estado !== 'jogando' || !op.repassarMinhas || !inteiro(m.tique) || m.tique < 1 || e === null) return
        guardarMinha(m.tique, e)
        return
      }
      case 'hash':
        if (estado === 'jogando' && inteiro(m.tique) && inteiro(m.hash)) op.saida.hash(m.tique, m.hash)
        return
      case 'fim': {
        if (estado !== 'jogando' || !inteiro(m.tique) || !inteiro(m.hash)) return
        const placar = placarDoJogo(m.placar)
        if (placar === null) {
          mudar('erro', 'o placar do jogo veio torto')
          return
        }
        // As últimas entradas antes do fim: os colegas ainda podem precisar delas.
        repassar()
        op.saida.fim(m.tique, m.hash, placar)
        mudar('fim')
        return
      }
      default:
        return
    }
  }

  function repassar() {
    if (minhas.length === 0) return
    const trechos = minhas
    minhas = []
    for (const t of trechos) op.saida.entradas(t.de, t.lista)
  }

  return {
    receber(ev) {
      const janela = op.janela()
      if (janela === null || ev.source !== janela) return
      const m = lerDoJogo(ev.data)
      if (m !== null) doJogo(m)
    },
    iniciar(nova) {
      if (partida !== null) return
      partida = nova
      mandarIniciar()
    },
    entradasDosColegas(lotes) {
      if (estado === 'jogando') mandarLotes(lotes)
      else if (estado === 'carregando' || estado === 'esperando') lotesCedo.push(...lotes)
    },
    sair(id, depoisDe) {
      if (estado === 'jogando') paraOJogo('sair', { id, depois_de: depoisDe })
      else if (estado === 'carregando' || estado === 'esperando') saidasCedo.push({ id, depoisDe })
    },
    pausar(nova) {
      if (pausada === nova) return
      pausada = nova
      if (estado === 'jogando') paraOJogo(nova ? 'pausa' : 'retoma')
    },
    encerrar() {
      if (estado === 'jogando') paraOJogo('encerrar')
      mudar('fim')
    },
    falhouCarga(erro) {
      if (estado === 'carregando') mudar('erro', erro)
    },
    recarregar() {
      if (estado !== 'erro' || partida !== null) return false
      mudar('carregando')
      return true
    },
    repassar,
    estado: () => estado,
  }
}
