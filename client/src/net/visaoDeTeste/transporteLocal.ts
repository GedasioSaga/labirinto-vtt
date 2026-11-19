import type { InvokeArgs } from '@tauri-apps/api/core'
import type { InvokeFn, ListenFn } from '../hostBridge'
import type { MensagemDaJanela, MensagemDoHost } from './protocoloDoCanal'

/**
 * O "Rust" da ponte de teste: os comandos `net_*` e os eventos `net:*` que a
 * ponte do host (`hostBridge.ts`) usa, atendidos aqui mesmo, sem servidor e
 * sem rede. Cada conexão da janela de teste (`abrir`) vira um `clientId`
 * `teste-<n>`; o que a ponte manda a ele (`net_send`) vai pelo canal, e o que
 * a janela manda volta como `net:message`. É o mesmo contrato do Rust
 * (ver o topo de `hostBridge.ts`), para uma conexão só por vez.
 *
 * Um transporte por geração da ponte de teste: trocar de ficha desliga este e
 * cria outro, e nada do de antes chega mais à janela.
 */

export interface TransporteLocal {
  invoke: InvokeFn
  listen: ListenFn
  /** Mensagem da janela, já validada e desta sessão. */
  receber(mensagem: MensagemDaJanela): void
  /** Para de falar com a janela: o que a ponte mandar depois some, como num socket fechado. */
  desligar(): void
}

export interface OpcoesDoTransporte {
  sessao: string
  /** A geração da ponte de teste que este transporte atende: `abrir` de outra geração é de uma ponte que já acabou. */
  geracao: number
  /** O código que `net_start_room` devolve (o mesmo da mesa-semente: a ponte não acusa "código mudou"). */
  codigo: string
  enviar(mensagem: MensagemDoHost): void
  /**
   * COMO O RUST (análise 18/11/2026, 2.2): sem isto a janela de teste entrega
   * tudo na hora, em ordem e sem limite, e o que passa nela pode falhar na sala
   * real. Ligado, faz o que `desktop/src-tauri/src/net/server.rs` faz:
   * - `net_send`: a mensagem vai por JSON ida e volta (o `invoke` do Tauri) e
   *   chega DEPOIS de o comando voltar, em ordem por conexão; mais de
   *   `FILA_DE_SAIDA` esperando = `net_send` falha (`OUTBOX_CAPACITY`);
   * - do jogador: texto acima de `MAX_BYTES_DO_JOGADOR` derruba a conexão
   *   (`MAX_MESSAGE_BYTES`), e acima de `MENSAGENS_POR_SEGUNDO` o excesso some
   *   calado (`MAX_MESSAGES_PER_SECOND`, balde que começa cheio).
   * Desligado (padrão), o de sempre: os testes da ponte de teste contam com a entrega na hora.
   */
  comoORust?: boolean
  /** Relógio do balde de mensagens, em ms. Padrão: `performance.now`. */
  agora?: () => number
}

/** `MAX_MESSAGE_BYTES` de `server.rs`: maior que isto, o Rust derruba o jogador. */
export const MAX_BYTES_DO_JOGADOR = 64 * 1024
/** `MAX_MESSAGES_PER_SECOND` de `server.rs`: o balde por conexão. */
export const MENSAGENS_POR_SEGUNDO = 30
/** `OUTBOX_CAPACITY` de `server.rs`: mensagens do host esperando para sair a uma conexão. */
export const FILA_DE_SAIDA = 256

type Ouvinte = (event: { payload: unknown }) => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * O texto do jogador como o Rust o entrega no `net:message`: o objeto JSON já
 * lido (`parse_object` em `desktop/src-tauri/src/net/server.rs`). Sem isto,
 * o que a ponte trata FORA da sessão só quando chega objeto (o andamento da
 * cutscene em vídeo, o `som.falhou`, o "pronta" da abertura) caía na sessão e
 * voltava como erro. O que não é objeto segue como texto: a sessão o recusa,
 * como antes.
 */
function objetoDoTexto(texto: string): unknown {
  try {
    const lido: unknown = JSON.parse(texto)
    return isRecord(lido) ? lido : texto
  } catch {
    return texto
  }
}

/** O balde do Rust (`TokenBucket` de `server.rs`): `MENSAGENS_POR_SEGUNDO` por segundo, começa cheio, teto = a taxa. */
function criarBalde(agora: () => number): () => boolean {
  let fichas = MENSAGENS_POR_SEGUNDO
  let ultima = agora()
  return () => {
    const instante = agora()
    fichas = Math.min(MENSAGENS_POR_SEGUNDO, fichas + ((instante - ultima) / 1000) * MENSAGENS_POR_SEGUNDO)
    ultima = instante
    if (fichas < 1) return false
    fichas -= 1
    return true
  }
}

const codificador = new TextEncoder()

/** O `clientId` dos argumentos de `net_send`/`net_kick`; `null` se não veio. */
function clientIdDe(args: InvokeArgs | undefined): string | null {
  if (!isRecord(args)) return null
  const { clientId } = args
  return typeof clientId === 'string' ? clientId : null
}

export function criarTransporteLocal(opcoes: OpcoesDoTransporte): TransporteLocal {
  const { sessao, geracao, codigo } = opcoes
  const comoORust = opcoes.comoORust === true
  const agora = opcoes.agora ?? (() => performance.now())
  const ouvintes = new Map<string, Set<Ouvinte>>()
  /** Conexões abertas: `clientId` -> número da conexão na janela. */
  const conexoes = new Map<string, number>()
  /** COMO O RUST: por conexão, as mensagens do host que ainda não saíram, e o balde do que o jogador manda. */
  const naFila = new Map<number, number>()
  const baldes = new Map<number, () => boolean>()
  let desligado = false

  const emitir = (evento: string, payload: unknown) => {
    for (const ouvinte of [...(ouvintes.get(evento) ?? [])]) ouvinte({ payload })
  }
  const enviar = (mensagem: MensagemDoHost) => {
    if (!desligado) opcoes.enviar(mensagem)
  }
  const clientIdDaConexao = (conexao: number): string | null => {
    for (const [clientId, numero] of conexoes) if (numero === conexao) return clientId
    return null
  }

  const invoke: InvokeFn = async (cmd, args) => {
    switch (cmd) {
      case 'net_start_room':
        return { code: codigo, urls: [], qrSvg: '' }
      case 'net_send': {
        const clientId = clientIdDe(args)
        const conexao = clientId === null ? undefined : conexoes.get(clientId)
        const msg = isRecord(args) ? args.msg : undefined
        // Conexão que já fechou: a mensagem se perde, como num socket fechado. Não é erro da ponte.
        if (conexao === undefined || typeof msg !== 'object' || msg === null) return undefined
        if (!comoORust) {
          enviar({ de: 'host', tipo: 'msg', sessao, conexao, msg })
          return undefined
        }
        mandarComoORust(conexao, msg)
        return undefined
      }
      case 'net_kick': {
        const clientId = clientIdDe(args)
        const conexao = clientId === null ? undefined : conexoes.get(clientId)
        if (clientId === null || conexao === undefined) return undefined
        conexoes.delete(clientId)
        baldes.delete(conexao)
        enviar({ de: 'host', tipo: 'derrubar', sessao, conexao })
        // O Rust avisa a queda de quem ele derrubou; aqui também, depois de o comando voltar.
        void Promise.resolve().then(() => emitir('net:peer', { clientId, event: 'disconnected' }))
        return undefined
      }
      case 'net_stop_room':
      case 'net_stop_tunnel':
        return undefined
      case 'net_start_tunnel':
        throw new Error('a Visão de jogador não tem link público')
      default:
        throw new Error(`comando desconhecido na Visão de jogador: ${cmd}`)
    }
  }

  /**
   * COMO O RUST, a ida: JSON ida e volta (campo `undefined` some, `Map` vira `{}`, ciclo lança como no `invoke`),
   * fila cheia lança como o `net_send` do Rust, e a entrega fica para depois de o comando voltar. `setTimeout`
   * mantém a ordem de chegada, então cada conexão recebe na ordem em que a ponte mandou.
   */
  const mandarComoORust = (conexao: number, msg: object): void => {
    const copia: unknown = JSON.parse(JSON.stringify(msg))
    if (typeof copia !== 'object' || copia === null) return
    const esperando = naFila.get(conexao) ?? 0
    if (esperando >= FILA_DE_SAIDA) throw new Error('fila de saída cheia: a janela de teste não está lendo')
    naFila.set(conexao, esperando + 1)
    setTimeout(() => {
      const resta = (naFila.get(conexao) ?? 1) - 1
      if (resta > 0) naFila.set(conexao, resta)
      else naFila.delete(conexao)
      // Fechou enquanto esperava: some, como no socket fechado.
      if (clientIdDaConexao(conexao) === null) return
      enviar({ de: 'host', tipo: 'msg', sessao, conexao, msg: copia })
    }, 0)
  }

  /** COMO O RUST, a volta: `false` = a mensagem não chega à ponte (grande demais derruba; acima da taxa, some). */
  const passaComoORust = (clientId: string, conexao: number, texto: string): boolean => {
    if (codificador.encode(texto).length > MAX_BYTES_DO_JOGADOR) {
      fecharConexao(clientId, conexao)
      enviar({ de: 'host', tipo: 'derrubar', sessao, conexao })
      return false
    }
    let balde = baldes.get(conexao)
    if (balde === undefined) {
      balde = criarBalde(agora)
      baldes.set(conexao, balde)
    }
    return balde()
  }

  /** A conexão acabou (a janela fechou, ou o Rust a derrubou): a ponte ouve a queda. */
  const fecharConexao = (clientId: string, conexao: number): void => {
    conexoes.delete(clientId)
    baldes.delete(conexao)
    emitir('net:peer', { clientId, event: 'disconnected' })
  }

  const listen: ListenFn = async (evento, handler) => {
    const lista = ouvintes.get(evento) ?? new Set<Ouvinte>()
    lista.add(handler)
    ouvintes.set(evento, lista)
    return () => {
      lista.delete(handler)
    }
  }

  return {
    invoke,
    listen,
    receber(mensagem) {
      if (desligado) return
      switch (mensagem.tipo) {
        case 'abrir': {
          if (mensagem.geracao !== geracao || clientIdDaConexao(mensagem.conexao) !== null) return
          conexoes.set(`teste-${mensagem.conexao}`, mensagem.conexao)
          enviar({ de: 'host', tipo: 'aberto', sessao, conexao: mensagem.conexao })
          return
        }
        case 'msg': {
          const clientId = clientIdDaConexao(mensagem.conexao)
          if (clientId === null) return
          if (comoORust && !passaComoORust(clientId, mensagem.conexao, mensagem.data)) return
          emitir('net:message', { clientId, msg: objetoDoTexto(mensagem.data) })
          return
        }
        case 'fechar-conexao': {
          const clientId = clientIdDaConexao(mensagem.conexao)
          if (clientId === null) return
          fecharConexao(clientId, mensagem.conexao)
          return
        }
        default:
          // `ola`, `pong`, `trocar-ficha` e `pedir-fechar` são do controlador, não da ponte.
          return
      }
    },
    desligar() {
      desligado = true
      conexoes.clear()
      naFila.clear()
      baldes.clear()
    },
  }
}
