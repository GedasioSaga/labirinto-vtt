import { describe, expect, it, vi } from 'vitest'
import { criarParDeCanais, type Canal } from '../../net/visaoDeTeste/canal'
import type { ModoDoTeste } from '../../net/visaoDeTeste/tipos'
import { criarSocketDoCanal, saiNoOlhar } from './socketDoCanal'

/** O "WebSocket" da janela de teste sobre o canal, e a guarda do modo Olhar. */

const SESSAO = 'sessao-de-teste-1'

/** O canal entrega numa microtarefa: uma volta da fila basta. */
const entregar = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function monta(modo: ModoDoTeste = 'olhar') {
  const [host, janela] = criarParDeCanais()
  const recebidas: unknown[] = []
  host.ouvir((dado) => recebidas.push(dado))
  const observar = vi.fn()
  let modoAtual = modo
  const socket = criarSocketDoCanal({ canal: janela, sessao: SESSAO, geracao: 2, conexao: 5, modo: () => modoAtual, observar })
  return {
    socket,
    host,
    recebidas,
    observar,
    trocarModo: (novo: ModoDoTeste) => {
      modoAtual = novo
    },
  }
}

async function abrir(host: Canal): Promise<void> {
  await entregar()
  host.enviar({ de: 'host', tipo: 'aberto', sessao: SESSAO, conexao: 5 })
  await entregar()
}

describe('socketDoCanal', () => {
  it('nasce pedindo a conexão e só abre com o `aberto` dela', async () => {
    const { socket, host, recebidas } = monta()
    const aberto = vi.fn()
    socket.onopen = aberto
    expect(socket.readyState).toBe(0)
    await entregar()
    expect(recebidas).toEqual([{ de: 'janela', tipo: 'abrir', sessao: SESSAO, geracao: 2, conexao: 5 }])

    // De outra conexão ou de outra sessão: não é com este socket.
    host.enviar({ de: 'host', tipo: 'aberto', sessao: SESSAO, conexao: 6 })
    host.enviar({ de: 'host', tipo: 'aberto', sessao: 'outra-sessao-1', conexao: 5 })
    await entregar()
    expect(aberto).not.toHaveBeenCalled()

    await abrir(host)
    expect(socket.readyState).toBe(1)
    expect(aberto).toHaveBeenCalledTimes(1)
  })

  it('a mensagem do host chega como o texto JSON do WebSocket, e o observador recebe uma cópia', async () => {
    const { socket, host, observar } = monta()
    const chegou = vi.fn()
    socket.onmessage = chegou
    await abrir(host)

    host.enviar({ de: 'host', tipo: 'msg', sessao: SESSAO, conexao: 5, msg: { type: 'welcome', name: 'Ana' } })
    await entregar()

    const texto = JSON.stringify({ type: 'welcome', name: 'Ana' })
    expect(chegou.mock.calls[0]?.[0]?.data).toBe(texto)
    expect(observar).toHaveBeenCalledWith(texto)
  })

  it('GUARDA DO OLHAR: só as mensagens automáticas saem; o pedido de jogador morre aqui', async () => {
    const { socket, host, recebidas, trocarModo } = monta('olhar')
    await abrir(host)
    recebidas.length = 0

    socket.send(JSON.stringify({ type: 'ping' }))
    socket.send(JSON.stringify({ type: 'view.resync' }))
    socket.send(JSON.stringify({ type: 'token.move', reqId: 'm1', tokenId: 't', x: 1, y: 2 }))
    socket.send(JSON.stringify({ type: 'door.toggle', wallId: 'w' }))
    socket.send('isto não é JSON')
    await entregar()
    expect(recebidas.map((m) => (typeof m === 'object' && m !== null ? Reflect.get(m, 'data') : null))).toEqual([
      JSON.stringify({ type: 'ping' }),
      JSON.stringify({ type: 'view.resync' }),
    ])

    // Em Jogar (entrega futura), o mesmo pedido passa.
    trocarModo('jogar')
    socket.send(JSON.stringify({ type: 'door.toggle', wallId: 'w' }))
    await entregar()
    expect(recebidas).toHaveLength(3)
  })

  it('nada sai antes de a conexão abrir', async () => {
    const { socket, recebidas } = monta()
    await entregar()
    socket.send(JSON.stringify({ type: 'join' }))
    await entregar()
    expect(recebidas).toHaveLength(1)
  })

  it('derrubar fecha o socket (onclose) e o que vier depois é ignorado', async () => {
    const { socket, host } = monta()
    const fechou = vi.fn()
    const chegou = vi.fn()
    socket.onclose = fechou
    socket.onmessage = chegou
    await abrir(host)

    host.enviar({ de: 'host', tipo: 'derrubar', sessao: SESSAO, conexao: 5 })
    await entregar()
    host.enviar({ de: 'host', tipo: 'msg', sessao: SESSAO, conexao: 5, msg: { type: 'snapshot' } })
    await entregar()

    expect(socket.readyState).toBe(3)
    expect(fechou).toHaveBeenCalledTimes(1)
    expect(chegou).not.toHaveBeenCalled()
  })

  it('close avisa o host (fechar-conexao) e dispara o onclose depois, como o navegador', async () => {
    const { socket, host, recebidas } = monta()
    const fechou = vi.fn()
    socket.onclose = fechou
    await abrir(host)

    socket.close()
    expect(fechou).not.toHaveBeenCalled()
    await entregar()

    expect(fechou).toHaveBeenCalledTimes(1)
    expect(recebidas.at(-1)).toEqual({ de: 'janela', tipo: 'fechar-conexao', sessao: SESSAO, conexao: 5 })
    socket.close()
    await entregar()
    expect(fechou).toHaveBeenCalledTimes(1)
  })

  it('encerrar (o teste acabou) fecha o socket', async () => {
    const { socket, host } = monta()
    const fechou = vi.fn()
    socket.onclose = fechou
    await abrir(host)

    host.enviar({ de: 'host', tipo: 'encerrar', sessao: SESSAO })
    await entregar()

    expect(socket.readyState).toBe(3)
    expect(fechou).toHaveBeenCalledTimes(1)
  })
})

describe('saiNoOlhar', () => {
  it('join, ping, view.patches e view.resync saem; o resto e o lixo não', () => {
    for (const type of ['join', 'ping', 'view.patches', 'view.resync']) expect(saiNoOlhar(JSON.stringify({ type }))).toBe(true)
    for (const type of ['token.move', 'away', 'signal', 'laser', 'pin.travel.request', 'chat.send']) expect(saiNoOlhar(JSON.stringify({ type }))).toBe(false)
    expect(saiNoOlhar('[]')).toBe(false)
    expect(saiNoOlhar('null')).toBe(false)
    expect(saiNoOlhar('{')).toBe(false)
  })
})
