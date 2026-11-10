import type { CenarioBolha, DificuldadeBolha, ModoBolha } from '../tipos'
import { erroDaFalhaDoJogo } from '../../fogo/tela/textos'
import type { ProgressoDaCarga } from '../../fogo/tela/vigiaDaCarga'
import { BOLHA_NOME_NO_JOGO_MAX, placarDoJogoDaBolha, type BolhaJogadorDaPartida, type BolhaPlacar } from '../../../net/protocoloDaBolha'

/**
 * A PONTE COM A BOLHA D'ÁGUA (o export web do Godot num iframe), contrato em
 * `docs/ponte-app-labirinto.md` do projeto do jogo: só `postMessage`, texto
 * JSON com `{jogo: 'bolha', v: 1, tipo, ...}`.
 *
 *  - jogo → app: `pronto`, `iniciado`, `erro` (o `iniciar` veio torto) e
 *    `fim` (o placar). O pacote de hoje usa a casca padrão do Godot e NÃO
 *    manda `carga` nem `falha`: a carga que não chega é a vigia de tempo quem
 *    acusa (`falhouCarga`). Se uma casca nova mandar, a ponte entende, como no fogo;
 *  - app → jogo: `iniciar`, `pausa`, `retoma` e `encerrar`.
 *
 * Diferente do fogo, sem lockstep: cada aparelho joga a própria cópia, então
 * não há entradas, hash nem repasse. Sem React e sem rede: quem monta (a
 * `BolhaOverlay`) entrega o que chega do iframe em `receber`; a ponte guarda o
 * `iniciar` que chegou antes do `pronto`.
 */

export interface PartidaDaBolha {
  semente: number
  dificuldade: DificuldadeBolha
  cenario: CenarioBolha
  modo: ModoBolha
  /** Equipe: todos os que jogam; solo: só este aparelho. */
  jogadores: BolhaJogadorDaPartida[]
  /** O id deste aparelho na lista. */
  eu: string
}

/** `carregando` até o `pronto`; `esperando` = pronto, sem partida ainda (ou o `iniciar` saiu e o `iniciado` não voltou). */
export type EstadoDaPonteDaBolha = 'carregando' | 'esperando' | 'jogando' | 'fim' | 'erro'

export interface OpcoesDaPonteDaBolha {
  /** A janela do iframe agora (`null` = ainda não montou). */
  janela(): MessageEventSource | null
  /** Para onde vai cada mensagem: a origem do jogo. */
  enviar(texto: string): void
  /** O placar do fim deste aparelho, já no formato do app (a conexão manda ao mestre). */
  aoTerminar(placar: BolhaPlacar): void
  aoMudar?(estado: EstadoDaPonteDaBolha, erro?: string): void
  /** Enquanto carrega: os bytes que já chegaram (só uma casca que avisa; a de hoje não avisa). */
  aoCarregar?(carga: ProgressoDaCarga): void
}

export interface PonteDaBolha {
  /** Uma mensagem do `window` (o filtro de quem mandou é aqui). */
  receber(ev: { source: MessageEventSource | null; data: unknown }): void
  iniciar(partida: PartidaDaBolha): void
  pausar(pausada: boolean): void
  encerrar(): void
  /** O jogo não chegou (a rota não existe, demorou demais): `carregando` vira `erro`. Depois do `pronto`, nada muda. */
  falhouCarga(erro: string): void
  /** "Tentar de novo": só no `erro` da carga, antes de haver partida. Devolve se voltou a `carregando`. */
  recarregar(): boolean
  estado(): EstadoDaPonteDaBolha
}

const ENVELOPE = { jogo: 'bolha', v: 1 } as const

/** O erro quando o placar do `fim` não fecha com o contrato. */
export const ERRO_DO_PLACAR_TORTO = 'o placar do jogo veio torto'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const inteiro = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value)

/**
 * O nome que o jogo aceita: até `BOLHA_NOME_NO_JOGO_MAX` caracteres. Conta por
 * ponto de código (como a `String` do Godot), não por unidade UTF-16: um emoji
 * no corte não vira meio caractere.
 */
export function nomeParaOJogo(nome: string): string {
  const letras = Array.from(nome)
  return letras.length <= BOLHA_NOME_NO_JOGO_MAX ? nome : letras.slice(0, BOLHA_NOME_NO_JOGO_MAX).join('')
}

/** O texto do jogo, aberto: `null` = não é da Bolha d'Água na versão da ponte. */
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

export function criarPonteDaBolha(op: OpcoesDaPonteDaBolha): PonteDaBolha {
  let estado: EstadoDaPonteDaBolha = 'carregando'
  let partida: PartidaDaBolha | null = null
  let pausada = false

  const mudar = (novo: EstadoDaPonteDaBolha, erro?: string) => {
    if (novo === estado && erro === undefined) return
    estado = novo
    op.aoMudar?.(novo, erro)
  }

  const paraOJogo = (tipo: string, campos: Record<string, unknown> = {}) => op.enviar(JSON.stringify({ ...ENVELOPE, tipo, ...campos }))

  const mandarIniciar = () => {
    if (partida === null || estado !== 'esperando') return
    const { semente, dificuldade, cenario, modo, eu } = partida
    // Só os 2 campos que o jogo lê, com o nome no teto dele (acima de 40 o jogo recusa a partida inteira).
    const jogadores = partida.jogadores.map(({ id, nome }) => ({ id, nome: nomeParaOJogo(nome) }))
    paraOJogo('iniciar', { semente, dificuldade, cenario, modo, jogadores, eu })
  }

  const doJogo = (m: Record<string, unknown>) => {
    switch (m.tipo) {
      case 'carga':
        if (estado === 'carregando' && inteiro(m.atual) && inteiro(m.total) && m.atual >= 0 && m.total > 0 && m.atual <= m.total) op.aoCarregar?.({ atual: m.atual, total: m.total })
        return
      case 'falha':
        if (estado === 'carregando') mudar('erro', erroDaFalhaDoJogo(m.motivo))
        return
      case 'pronto':
        if (estado === 'carregando') {
          mudar('esperando')
          mandarIniciar()
        }
        return
      case 'iniciado':
        if (estado !== 'esperando' || partida === null) return
        mudar('jogando')
        // A pausa do mestre que chegou entre o `iniciar` e o `iniciado`.
        if (pausada) paraOJogo('pausa')
        return
      case 'erro':
        // Só existe como resposta ao `iniciar` (o jogo continua esperando, mas esta partida não abre).
        if (estado === 'esperando' && partida !== null) mudar('erro', typeof m.erro === 'string' && m.erro !== '' ? m.erro : 'o jogo recusou a partida')
        return
      case 'fim': {
        if (estado !== 'jogando') return
        const placar = placarDoJogoDaBolha(m.placar)
        if (placar === null) {
          mudar('erro', ERRO_DO_PLACAR_TORTO)
          return
        }
        op.aoTerminar(placar)
        mudar('fim')
        return
      }
      default:
        return
    }
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
    estado: () => estado,
  }
}
