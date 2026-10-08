import type { Canal } from '../../net/visaoDeTeste/canal'
import { lerMensagemDoHost, type MensagemDaJanela } from '../../net/visaoDeTeste/protocoloDoCanal'
import type { ModoDoTeste } from '../../net/visaoDeTeste/tipos'
import type { SocketLike } from '../playerConnection'

/**
 * O "WebSocket" da janela da Visão de jogador: fala com o host de teste pelo
 * canal (`net/visaoDeTeste/canal.ts`) em vez da rede. O cliente do jogador
 * (`createPlayerConnection`) não percebe a diferença: recebe `onopen`,
 * `onmessage` com o mesmo texto JSON que viria da LAN e `onclose`.
 *
 * GUARDA DO MODO OLHAR: só sai o que o cliente manda sozinho, sem gesto
 * (`MENSAGENS_AUTOMATICAS`). Qualquer pedido de jogador que escape do bloqueio
 * da tela morre aqui, antes de chegar ao host de teste.
 */

/**
 * O que o cliente manda sem gesto de ninguém (`player/playerConnection.ts`):
 * o `join` e o aviso `view.patches` ao abrir a conexão, o `ping` do relógio e
 * o `view.resync` quando a tela perde o passo. O resto nasce de toque.
 */
export const MENSAGENS_AUTOMATICAS: ReadonlySet<string> = new Set(['join', 'ping', 'view.patches', 'view.resync'])

const CONNECTING = 0
const OPEN = 1
const CLOSED = 3

/** A mensagem (texto JSON do cliente) pode sair no modo Olhar? */
export function saiNoOlhar(data: string): boolean {
  let mensagem: unknown
  try {
    mensagem = JSON.parse(data)
  } catch {
    return false
  }
  if (typeof mensagem !== 'object' || mensagem === null) return false
  const tipo: unknown = Reflect.get(mensagem, 'type')
  return typeof tipo === 'string' && MENSAGENS_AUTOMATICAS.has(tipo)
}

export interface OpcoesDoSocketDoCanal {
  canal: Canal
  sessao: string
  /** A geração da sessão de teste (`config`): o host só aceita conexão da geração dele. */
  geracao: number
  /** Número desta conexão, único na vida da janela. */
  conexao: number
  /** O modo de agora, lido a cada envio. */
  modo: () => ModoDoTeste
  /** Cópia de cada mensagem que chega (a página lê dela o nome com que o host registrou o jogador). */
  observar?: (data: string) => void
}

export function criarSocketDoCanal(opcoes: OpcoesDoSocketDoCanal): SocketLike {
  const { canal, sessao, conexao } = opcoes
  let estado = CONNECTING
  const enviar = (mensagem: MensagemDaJanela) => canal.enviar(mensagem)

  const socket: SocketLike = {
    get readyState() {
      return estado
    },
    send(data) {
      if (estado !== OPEN) return
      if (opcoes.modo() === 'olhar' && !saiNoOlhar(data)) return
      enviar({ de: 'janela', tipo: 'msg', sessao, conexao, data })
    },
    close() {
      if (estado === CLOSED) return
      enviar({ de: 'janela', tipo: 'fechar-conexao', sessao, conexao })
      encerrar()
    },
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  }

  /** Fecha deste lado; o `onclose` vem depois, como no WebSocket do navegador. */
  function encerrar(): void {
    estado = CLOSED
    pararDeOuvir()
    void Promise.resolve().then(() => socket.onclose?.(new CloseEvent('close', { code: 1000, wasClean: true })))
  }

  const pararDeOuvir = canal.ouvir((dado) => {
    const mensagem = lerMensagemDoHost(dado, sessao)
    if (mensagem === null || estado === CLOSED) return
    switch (mensagem.tipo) {
      case 'encerrar':
        encerrar()
        return
      case 'aberto':
        if (mensagem.conexao !== conexao || estado !== CONNECTING) return
        estado = OPEN
        socket.onopen?.(new Event('open'))
        return
      case 'msg': {
        if (mensagem.conexao !== conexao || estado !== OPEN) return
        // O mesmo texto que o WebSocket entregaria: o caminho de leitura do cliente fica idêntico.
        const texto = JSON.stringify(mensagem.msg)
        opcoes.observar?.(texto)
        socket.onmessage?.(new MessageEvent('message', { data: texto }))
        return
      }
      case 'derrubar':
        if (mensagem.conexao === conexao) encerrar()
        return
      default:
        return
    }
  })

  enviar({ de: 'janela', tipo: 'abrir', sessao, geracao: opcoes.geracao, conexao })
  return socket
}
