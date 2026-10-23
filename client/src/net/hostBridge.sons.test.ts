/**
 * SONS AO VIVO, fatia F4, lado do mestre: a ponte manda tocar, parar e mudar o
 * volume só a quem o seletor escolheu, e o LOOP é estado — quem entra, volta ou
 * chega à cena com um loop tocando recebe `som.tocar` com o deslocamento; quem
 * sai da cena recebe `som.parar`. Efeito curto é evento: não se repete a quem
 * chega depois. A ponte e a sessão são as de verdade; só o transporte é falso
 * (o "host de mentira" dos outros testes da ponte).
 *
 * Segurança: o canal é só mestre → jogador. O jogador não faz o host tocar nem
 * parar nada; o `som.falhou` só conta para um toque que foi mesmo para ele,
 * com teto por janela; e o que sai é só id opaco (contrato da F5 com `/media`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { HostWorld } from './hostSession'
import { parseSomHostMessage, type FonteDeSomNaRede } from './protocol'

const ROOM = { code: 'S0M4OV', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const ID_GRITO = `${'a'.repeat(64)}.mp3`
const ID_CHUVA = `${'b'.repeat(64)}.ogg`
const GRITO: FonteDeSomNaRede = { tipo: 'arquivo', midia: ID_GRITO }
const CHUVA: FonteDeSomNaRede = { tipo: 'arquivo', midia: ID_CHUVA }
const TAVERNA = 's-taverna'
const CRIPTA = 's-cripta'

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
}

const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 100, size: 1, image: null })

/** Taverna aberta com Ana, Bia e o lugar da Duda; Cripta de fundo com Caio. */
function mundoCom(naTaverna: string[], naCripta: string[]): HostWorld {
  const mapa = (id: string, nome: string, fichas: string[]): MapData => ({ ...createEmptyMap(id, nome, 30, 10, 50), tokens: fichas.map((f, i) => ficha(f, 100 + i * 100)) })
  return {
    open: { sceneId: TAVERNA, name: 'Taverna', map: mapa('m-taverna', 'Taverna', naTaverna) },
    background: [{ sceneId: CRIPTA, name: 'Cripta', map: mapa('m-cripta', 'Cripta', naCripta) }],
  }
}

async function mesa() {
  let mundo = mundoCom(['t-ana', 't-bia', 't-duda'], ['t-caio'])
  let agora = 1_000
  const ouvintes = new Map<string, (event: { payload: unknown }) => void>()
  const enviados: Enviado[] = []
  const invoke = vi.fn(async (cmd: string, args?: unknown) => {
    if (cmd === 'net_start_room') return ROOM
    if (cmd === 'net_send') enviados.push(JSON.parse(JSON.stringify(args)))
    return undefined
  })
  const listen = vi.fn(async (nome: string, handler: (event: { payload: unknown }) => void) => {
    ouvintes.set(nome, handler)
    return () => undefined
  })
  const bridge = createHostBridge({ invoke, listen, getMap: () => mundo.open.map, getWorld: () => mundo, applyMove: vi.fn(), applyDoor: vi.fn(), now: () => agora })
  await bridge.start()
  const emit = (nome: string, payload: unknown) => {
    const handler = ouvintes.get(nome)
    if (handler === undefined) throw new Error(`sem listener de ${nome}`)
    handler({ payload })
  }
  const resumes = new Map<string, string>()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
    const welcome = enviados.find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    const resume = welcome?.msg.resumeToken
    if (typeof resume !== 'string') throw new Error('sem resumeToken')
    resumes.set(name, resume)
    return player.playerId
  }
  const cai = (clientId: string) => emit('net:peer', { clientId, event: 'disconnected' })
  const volta = (clientId: string, name: string) => emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name, resume: resumes.get(name) } })
  const tvEntra = (clientId: string) => {
    const tableKey = bridge.tableKey()
    if (tableKey === null) throw new Error('sala sem chave da tela')
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name: 'Tela da mesa', role: 'table', tableKey } })
  }
  const doJogador = (clientId: string, msg: unknown) => emit('net:message', { clientId, msg })
  /** O mestre (ou a viagem) muda quem está em cada cena; o broadcast seguinte reconcilia. */
  const mudaMundo = (naTaverna: string[], naCripta: string[]) => {
    mundo = mundoCom(naTaverna, naCripta)
    bridge.notifyTurnChanged()
  }
  const ana = entra('c-ana', 'Ana', 't-ana')
  const bia = entra('c-bia', 'Bia', 't-bia')
  const caio = entra('c-caio', 'Caio', 't-caio')
  tvEntra('tv')
  bridge.setTableScene(TAVERNA)
  enviados.length = 0
  useToastStore.setState({ toasts: [] })
  const sons = (clientId?: string) => enviados.filter((e) => e.msg.type.startsWith('som.') && (clientId === undefined || e.clientId === clientId))
  const quem = (tipo: string) => sons().filter((e) => e.msg.type === tipo).map((e) => e.clientId)
  return {
    bridge,
    ids: { ana, bia, caio },
    enviados,
    sons,
    quem,
    entra,
    cai,
    volta,
    tvEntra,
    doJogador,
    mudaMundo,
    limpa: () => {
      enviados.length = 0
    },
    avanca: (ms: number) => {
      agora += ms
    },
  }
}

const loop = (instancia: string, fonte: FonteDeSomNaRede = CHUVA) => ({ instancia, fonte, volume: 0.6, loop: true })
const curto = (instancia: string, fonte: FonteDeSomNaRede = GRITO) => ({ instancia, fonte, volume: 0.9, loop: false })

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('hostBridge: quem recebe o som', () => {
  it('"Só a cena" chega só a quem está nela, e à TV que mostra a cena', async () => {
    const m = await mesa()
    expect(m.bridge.tocarSomAoVivo(curto('grito'), { tipo: 'cena', sceneId: TAVERNA })).toEqual({ ok: true, enviados: 3 })
    expect(m.quem('som.tocar').sort()).toEqual(['c-ana', 'c-bia', 'tv'])
    expect(m.sons('c-ana')[0]?.msg).toEqual({ type: 'som.tocar', instancia: 'grito', fonte: GRITO, volume: 0.9, loop: false })
  })

  it('"Só a cena" da Cripta: só o Caio; a TV, que mostra a Taverna, não', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(curto('grito'), { tipo: 'cena', sceneId: CRIPTA })
    expect(m.quem('som.tocar')).toEqual(['c-caio'])
  })

  it('"Todos": todo jogador conectado e a TV', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(curto('grito'), { tipo: 'todos' })
    expect(m.quem('som.tocar').sort()).toEqual(['c-ana', 'c-bia', 'c-caio', 'tv'])
  })

  it('"Escolhidos": o escolhido desconectado não recebe, e a TV nunca', async () => {
    const m = await mesa()
    m.cai('c-caio')
    expect(m.bridge.tocarSomAoVivo(curto('grito'), { tipo: 'escolhidos', playerIds: [m.ids.caio, m.ids.bia] })).toEqual({ ok: true, enviados: 1 })
    expect(m.quem('som.tocar')).toEqual(['c-bia'])
  })

  it('jogador que acabou de entrar, sem loop tocando, não recebe nada de som (nem a biblioteca)', async () => {
    const m = await mesa()
    m.entra('c-duda', 'Duda', 't-duda')
    expect(m.sons()).toEqual([])
  })
})

describe('hostBridge: o loop é estado', () => {
  it('quem entra com o loop tocando recebe tocar com o deslocamento; os outros nada de novo', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'todos' })
    m.limpa()
    m.avanca(12_500)
    m.entra('c-duda', 'Duda', 't-duda')
    expect(m.sons()).toEqual([{ clientId: 'c-duda', msg: { type: 'som.tocar', instancia: 'chuva', fonte: CHUVA, volume: 0.6, loop: true, deslocamentoS: 12.5 } }])
  })

  it('quem cai e volta pelo resume recebe o loop de novo, no ponto de agora', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'todos' })
    m.cai('c-bia')
    m.limpa()
    m.avanca(3_000)
    m.volta('c-bia-2', 'Bia')
    expect(m.sons()).toEqual([{ clientId: 'c-bia-2', msg: expect.objectContaining({ type: 'som.tocar', instancia: 'chuva', deslocamentoS: 3 }) }])
  })

  it('quem sai da cena recebe parar; quem volta para ela recebe tocar com deslocamento', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'cena', sceneId: TAVERNA })
    m.limpa()
    m.mudaMundo(['t-ana'], ['t-caio', 't-bia'])
    expect(m.sons()).toEqual([{ clientId: 'c-bia', msg: { type: 'som.parar', instancia: 'chuva' } }])
    m.limpa()
    m.avanca(4_250)
    m.mudaMundo(['t-ana', 't-bia'], ['t-caio'])
    expect(m.sons()).toEqual([{ clientId: 'c-bia', msg: expect.objectContaining({ type: 'som.tocar', instancia: 'chuva', deslocamentoS: 4.25 }) }])
  })

  it('quem chega à cena do loop (viagem) recebe tocar; reconciliar de novo sem mudança não manda nada', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'cena', sceneId: TAVERNA })
    m.limpa()
    m.mudaMundo(['t-ana', 't-bia', 't-caio'], [])
    expect(m.quem('som.tocar')).toEqual(['c-caio'])
    m.limpa()
    m.mudaMundo(['t-ana', 't-bia', 't-caio'], [])
    expect(m.sons()).toEqual([])
  })

  it('a TV que troca de cena perde o loop da cena e o recebe de volta, com deslocamento', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'cena', sceneId: TAVERNA })
    m.limpa()
    m.bridge.setTableScene(CRIPTA)
    expect(m.sons()).toEqual([{ clientId: 'tv', msg: { type: 'som.parar', instancia: 'chuva' } }])
    m.limpa()
    m.avanca(2_000)
    m.bridge.setTableScene(TAVERNA)
    expect(m.sons()).toEqual([{ clientId: 'tv', msg: expect.objectContaining({ type: 'som.tocar', deslocamentoS: 2 }) }])
  })

  it('a TV que conecta com loop em "Todos" já recebe o loop', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'todos' })
    m.limpa()
    m.avanca(1_000)
    m.tvEntra('tv-2')
    expect(m.sons()).toEqual([{ clientId: 'tv-2', msg: expect.objectContaining({ type: 'som.tocar', instancia: 'chuva', deslocamentoS: 1 }) }])
  })

  it('efeito curto é evento: quem chega depois não recebe', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(curto('grito'), { tipo: 'todos' })
    m.limpa()
    m.entra('c-duda', 'Duda', 't-duda')
    m.mudaMundo(['t-ana', 't-bia', 't-duda', 't-caio'], [])
    expect(m.sons()).toEqual([])
  })

  it('parar o loop manda parar a quem o ouve, e quem entra depois não recebe mais', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'cena', sceneId: CRIPTA })
    m.limpa()
    expect(m.bridge.pararSomAoVivo('chuva', 150)).toBe(1)
    expect(m.sons()).toEqual([{ clientId: 'c-caio', msg: { type: 'som.parar', instancia: 'chuva', fadeMs: 150 } }])
    m.limpa()
    m.mudaMundo(['t-ana'], ['t-caio', 't-bia'])
    expect(m.sons()).toEqual([])
  })

  it('parar o efeito curto vai só a quem o recebeu; parar o que não existe não manda nada', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(curto('grito'), { tipo: 'escolhidos', playerIds: [m.ids.ana] })
    m.limpa()
    expect(m.bridge.pararSomAoVivo('grito')).toBe(1)
    expect(m.quem('som.parar')).toEqual(['c-ana'])
    m.limpa()
    expect(m.bridge.pararSomAoVivo('nunca-tocou')).toBe(0)
    expect(m.sons()).toEqual([])
  })

  it('Parar tudo vai a todos os conectados (TV junto) e encerra os loops', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'todos' })
    m.bridge.tocarSomAoVivo(loop('vento', GRITO), { tipo: 'cena', sceneId: CRIPTA })
    m.limpa()
    expect(m.bridge.pararTodosOsSons()).toBe(4)
    expect(m.sons().map((e) => [e.clientId, e.msg.type]).sort()).toEqual([
      ['c-ana', 'som.pararTudo'],
      ['c-bia', 'som.pararTudo'],
      ['c-caio', 'som.pararTudo'],
      ['tv', 'som.pararTudo'],
    ])
    m.limpa()
    m.entra('c-duda', 'Duda', 't-duda')
    expect(m.sons()).toEqual([])
  })

  it('volume do loop vai a quem o ouve, e quem entra depois recebe o volume novo', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'cena', sceneId: CRIPTA })
    m.limpa()
    expect(m.bridge.volumeDoSom('chuva', 0.2)).toBe(1)
    expect(m.sons()).toEqual([{ clientId: 'c-caio', msg: { type: 'som.volume', instancia: 'chuva', volume: 0.2 } }])
    m.limpa()
    m.mudaMundo(['t-ana'], ['t-caio', 't-bia'])
    expect(m.sons('c-bia')[0]?.msg).toMatchObject({ type: 'som.tocar', volume: 0.2 })
  })

  it('tocar de novo a mesma instância troca o loop: quem já não está no alvo novo recebe parar', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'todos' })
    m.limpa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'cena', sceneId: CRIPTA })
    expect(m.quem('som.tocar')).toEqual(['c-caio'])
    expect(m.quem('som.parar').sort()).toEqual(['c-ana', 'c-bia', 'tv'])
  })
})

describe('hostBridge: recusas', () => {
  it('o 4º loop é recusado e nada sai', async () => {
    const m = await mesa()
    for (const instancia of ['l1', 'l2', 'l3']) expect(m.bridge.tocarSomAoVivo(loop(instancia), { tipo: 'todos' })).toMatchObject({ ok: true })
    m.limpa()
    expect(m.bridge.tocarSomAoVivo(loop('l4'), { tipo: 'todos' })).toEqual({ ok: false, motivo: 'limite-de-loops' })
    expect(m.sons()).toEqual([])
    // Trocar um dos 3 não é loop a mais.
    expect(m.bridge.tocarSomAoVivo(loop('l2'), { tipo: 'todos' })).toMatchObject({ ok: true })
  })

  it('pedido torto (volume fora de 0 a 1, instância com barra, fonte com caminho) é recusado e nada sai', async () => {
    const m = await mesa()
    const tortos = [
      { ...curto('grito'), volume: 2 },
      { ...curto('grito'), volume: Number.NaN },
      { ...curto('a/b') },
      curto('grito', { tipo: 'arquivo', midia: '../../segredo.mp3' }),
    ]
    for (const pedido of tortos) expect(m.bridge.tocarSomAoVivo(pedido, { tipo: 'todos' })).toEqual({ ok: false, motivo: 'pedido-invalido' })
    expect(m.bridge.volumeDoSom('grito', 7)).toBe(0)
    expect(m.sons()).toEqual([])
  })

  it('sem sala aberta: recusa', async () => {
    const bridge = createHostBridge({ invoke: vi.fn(async () => undefined), listen: vi.fn(async () => () => undefined), getMap: () => createEmptyMap('m', 'M', 10, 10, 50), applyMove: vi.fn(), applyDoor: vi.fn() })
    expect(bridge.tocarSomAoVivo(curto('grito'), { tipo: 'todos' })).toEqual({ ok: false, motivo: 'sem-sala' })
    expect(bridge.pararTodosOsSons()).toBe(0)
  })
})

describe('hostBridge: segurança do canal dos sons', () => {
  it('o jogador não faz o host tocar, parar nem pré-carregar nada', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'todos' })
    m.limpa()
    m.doJogador('c-ana', { type: 'som.tocar', instancia: 'x', fonte: GRITO, volume: 1, loop: true })
    m.doJogador('c-ana', { type: 'som.parar', instancia: 'chuva' })
    m.doJogador('c-ana', { type: 'som.pararTudo' })
    m.doJogador('c-ana', { type: 'som.volume', instancia: 'chuva', volume: 0 })
    m.doJogador('c-ana', { type: 'som.precarregar', midias: [ID_GRITO] })
    m.doJogador('tv', { type: 'som.pararTudo' })
    expect(m.sons()).toEqual([])
    // Nem resposta de erro: a mensagem some calada, e o loop segue de pé para quem chega.
    expect(m.enviados).toEqual([])
    m.entra('c-duda', 'Duda', 't-duda')
    expect(m.quem('som.tocar')).toEqual(['c-duda'])
  })

  it('som.falhou conta só para quem recebeu aquele toque, e só uma vez por aparelho', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(curto('grito'), { tipo: 'cena', sceneId: TAVERNA })
    m.doJogador('c-ana', { type: 'som.falhou', instancia: 'grito', motivo: 'sem-gesto' })
    m.doJogador('c-ana', { type: 'som.falhou', instancia: 'grito', motivo: 'sem-gesto' })
    m.doJogador('tv', { type: 'som.falhou', instancia: 'grito', motivo: 'sem-gesto' })
    // Caio está na Cripta: não recebeu, não conta.
    m.doJogador('c-caio', { type: 'som.falhou', instancia: 'grito', motivo: 'sem-gesto' })
    // Instância que nunca saiu, motivo fora da lista, conexão que nem entrou.
    m.doJogador('c-bia', { type: 'som.falhou', instancia: 'inventado', motivo: 'sem-gesto' })
    m.doJogador('c-bia', { type: 'som.falhou', instancia: 'grito', motivo: 'me-deixa-tocar' })
    m.doJogador('c-estranho', { type: 'som.falhou', instancia: 'grito', motivo: 'nao-carregou' })
    expect(m.bridge.falhasDoSom('grito')).toBe(2)
    expect(m.bridge.falhasDoSom('inventado')).toBe(0)
    // Só os 3 `som.tocar` do começo: falha relatada não vira mensagem para ninguém.
    expect(m.sons().map((e) => e.msg.type)).toEqual(['som.tocar', 'som.tocar', 'som.tocar'])
  })

  it('som.falhou tem teto por janela: rajada além dele não conta até a janela virar', async () => {
    const m = await mesa()
    const instancias = Array.from({ length: 14 }, (_, i) => `g${i}`)
    for (const instancia of instancias) m.bridge.tocarSomAoVivo(curto(instancia), { tipo: 'escolhidos', playerIds: [m.ids.ana] })
    for (const instancia of instancias) m.doJogador('c-ana', { type: 'som.falhou', instancia, motivo: 'nao-carregou' })
    const contadas = instancias.filter((instancia) => m.bridge.falhasDoSom(instancia) === 1)
    expect(contadas).toHaveLength(10)
    m.avanca(10_001)
    m.doJogador('c-ana', { type: 'som.falhou', instancia: 'g13', motivo: 'nao-carregou' })
    expect(m.bridge.falhasDoSom('g13')).toBe(1)
  })

  it('contrato com a F5: o que sai é só id opaco — nem nome, nem ref do disco, nem caminho', async () => {
    const m = await mesa()
    m.bridge.tocarSomAoVivo(loop('chuva'), { tipo: 'todos' })
    m.bridge.tocarSomAoVivo(curto('grito'), { tipo: 'cena', sceneId: TAVERNA })
    m.bridge.volumeDoSom('chuva', 0.3)
    expect(m.bridge.precarregarSonsAoVivo([ID_GRITO, ID_CHUVA])).toBe(4)
    m.mudaMundo(['t-ana'], ['t-caio', 't-bia'])
    m.entra('c-duda', 'Duda', 't-duda')
    m.bridge.pararSomAoVivo('chuva')
    const saidas = m.sons()
    expect(saidas.length).toBeGreaterThan(8)
    const FORMA_DO_ID = /^[0-9a-f]{64}\.(mp3|ogg|wav|m4a)$/
    for (const { msg: crua } of saidas) {
      expect(JSON.stringify(crua)).not.toMatch(/midia:|[\\]|\.\.|nome|pasta/)
      // A cópia do parser do jogador é igual ao que saiu: não foi campo a mais.
      const msg = parseSomHostMessage(crua)
      expect(msg).toEqual(crua)
      if (msg?.type === 'som.tocar') {
        expect(Object.keys(msg.fonte).sort()).toEqual(['midia', 'tipo'])
        expect(msg.fonte.midia).toMatch(FORMA_DO_ID)
      }
      if (msg?.type === 'som.precarregar') for (const id of msg.midias) expect(id).toMatch(FORMA_DO_ID)
    }
    expect(m.bridge.midiasDeSomLiberadas().sort()).toEqual([ID_GRITO, ID_CHUVA].sort())
  })

  it('pré-carga com id torto não sai', async () => {
    const m = await mesa()
    expect(m.bridge.precarregarSonsAoVivo(['../../x.mp3'])).toBe(0)
    expect(m.sons()).toEqual([])
    expect(m.bridge.midiasDeSomLiberadas()).toEqual([])
  })
})
