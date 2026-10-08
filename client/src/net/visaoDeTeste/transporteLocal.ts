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
}

type Ouvinte = (event: { payload: unknown }) => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** O `clientId` dos argumentos de `net_send`/`net_kick`; `null` se não veio. */
function clientIdDe(args: InvokeArgs | undefined): string | null {
  if (!isRecord(args)) return null
  const { clientId } = args
  return typeof clientId === 'string' ? clientId : null
}

export function criarTransporteLocal(opcoes: OpcoesDoTransporte): TransporteLocal {
  const { sessao, geracao, codigo } = opcoes
  const ouvintes = new Map<string, Set<Ouvinte>>()
  /** Conexões abertas: `clientId` -> número da conexão na janela. */
  const conexoes = new Map<string, number>()
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
        enviar({ de: 'host', tipo: 'msg', sessao, conexao, msg })
        return undefined
      }
      case 'net_kick': {
        const clientId = clientIdDe(args)
        const conexao = clientId === null ? undefined : conexoes.get(clientId)
        if (clientId === null || conexao === undefined) return undefined
        conexoes.delete(clientId)
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
          if (clientId !== null) emitir('net:message', { clientId, msg: mensagem.data })
          return
        }
        case 'fechar-conexao': {
          const clientId = clientIdDaConexao(mensagem.conexao)
          if (clientId === null) return
          conexoes.delete(clientId)
          emitir('net:peer', { clientId, event: 'disconnected' })
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
    },
  }
}
