/**
 * MINHAS PISTAS no host: o cartão de pino que o jogador abriu e o texto de Sala
 * que ele leu ficam no caderno de pistas DELE, guardado no host (sobrevive a
 * recarregar a página). A pista leva só título, texto e foto: nem posição, nem
 * nome ou id de cena, nem o id do pino. "Mostrar para…" manda a pista a um
 * colega da MESMA cena; quem está em outra cena nem aparece na lista.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Region, Token } from '../types/map'
import type { FalaDoPino } from '../types/cenarioEFalas'
import { comFalas, falasDoPino, ID_DA_FALA_ANTIGA, novaFala } from '../lib/falasDoPino'
import type { HostMessage } from './protocol'
import { parsePlayerMessage } from './protocol'
import { CLUE_SHOW_MIN_INTERVAL_MS, createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const FOTO = 'data:image/png;base64,QklMSEVURQ=='
const BILHETE = 'Bilhete\nEncontre-me na torre à meia-noite.'
const AGORA = new Date(2026, 8, 23, 21, 15).getTime()

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function pino(id: string, x: number, y: number, description: string, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description, image: null, ...extra }
}

/** Casa Velha (aberta): Gabi e Ana lado a lado, o bilhete perto delas e os pinos que ela NÃO pode ler. */
function casa(pins: Pin[] = [], regions: Region[] = []): HostScene {
  const base = createEmptyMap('m-casa', 'Casa Velha', 30, 10, 50)
  const map: MapData = {
    ...base,
    tokens: [ficha('gabi', 100, 100), ficha('ana', 200, 100)],
    pins: [
      pino('bilhete', 150, 150, BILHETE, { image: FOTO }),
      pino('segredo', 160, 160, 'PISTA-SECRETA', { secret: true }),
      pino('escondido', 170, 170, 'PISTA-ESCONDIDA', { hidden: true }),
      pino('longe', 1450, 450, 'PISTA-LONGE'),
      pino('na-zona', 400, 300, 'PISTA-NA-ZONA'),
      pino('disco', 120, 180, 'Mapa rasgado', { image: 'C:\\mestre\\segredos\\mapa.png' }),
      pino('porta', 130, 130, 'Porta do porão', { kind: 'viagem', destino: { sceneId: 's-porao', pinId: 'escada' } }),
      ...pins,
    ],
    regions,
    concealZones: [
      {
        id: 'z1',
        name: 'escuro',
        revealed: false,
        points: [
          { x: 350, y: 250 },
          { x: 450, y: 250 },
          { x: 450, y: 350 },
          { x: 350, y: 350 },
        ],
      },
    ],
  }
  return { sceneId: 's-casa', name: 'Casa Velha', map }
}

/** Porão Úmido (fundo): Bruno, com uma pista que só existe lá. */
function porao(): HostScene {
  const base = createEmptyMap('m-porao', 'Porao Umido', 30, 10, 50)
  return {
    sceneId: 's-porao',
    name: 'Porao Umido',
    map: { ...base, tokens: [ficha('bruno', 100, 100)], pins: [pino('porao-pin', 150, 150, 'PISTA-DO-PORAO')] },
  }
}

function mundo(aberta: HostScene = casa()): HostWorld {
  return { open: aberta, background: [porao()] }
}

type Sessao = ReturnType<typeof createHostSession>

function entra(s: Sessao, clientId: string, name: string, world: HostWorld, resume?: string): { playerId: string; resume: string; r: HostResult } {
  const join = resume === undefined ? { type: 'join', code: CODE, name } : { type: 'join', code: CODE, name, resume }
  const r = s.handleMessage(clientId, join, world)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return { playerId: welcome.playerId, resume: welcome.resumeToken, r }
}

/** Gabi e Ana na Casa Velha, Bruno no Porão; todos já receberam o primeiro snapshot. */
function mesa(world: HostWorld = mundo()) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => AGORA, randomId: () => `id-${(n += 1)}` })
  const gabi = entra(s, 'c-gabi', 'Gabi', world)
  const ana = entra(s, 'c-ana', 'Ana', world)
  const bruno = entra(s, 'c-bruno', 'Bruno', world)
  s.assignToken(gabi.playerId, 'gabi')
  s.assignToken(ana.playerId, 'ana')
  s.assignToken(bruno.playerId, 'bruno')
  const primeiro = s.broadcast(world)
  return { s, world, gabi, ana, bruno, primeiro }
}

function msgsPara(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function pistaLida(r: HostResult, clientId: string) {
  const added = msgsPara(r, clientId).find((m) => m.type === 'clue.added')
  if (added?.type !== 'clue.added') throw new Error('esperava clue.added')
  return added.clue
}

describe('Minhas pistas — ler um cartão guarda a pista no host', () => {
  it('Gabi abre o bilhete: só ela recebe a pista, com título, texto e foto, e sem posição, pino ou cena', () => {
    const { s, world } = mesa()
    const r = s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'bilhete' }, world)
    // `place`: o LUGAR dela (o contador do `snapshot.place`), nunca a cena — é por ele que a aba Lugares agrupa as pistas.
    expect(msgsPara(r, 'c-gabi')).toEqual([
      // "!" CENÁRIO (P4): o texto de um "!" lido entra no caderno como lugar ("Ler de novo").
      { type: 'clue.added', clue: { id: expect.any(String), title: 'Bilhete', text: BILHETE, image: FOTO, at: AGORA, place: 'l1', tipo: 'cenario' } },
    ])
    expect(msgsPara(r, 'c-ana')).toEqual([])
    expect(msgsPara(r, 'c-bruno')).toEqual([])
    const json = JSON.stringify(r.outbound)
    for (const vazamento of ['Casa Velha', 's-casa', 'm-casa', '"bilhete"', '"x"', '"y"']) expect(json).not.toContain(vazamento)
  })

  it('sai de perto e recarrega a página: o caderno de pistas volta inteiro no join', () => {
    const { s, world, gabi } = mesa()
    const lida = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'bilhete' }, world), 'c-gabi')
    // Gabi anda para longe: o bilhete sai do recorte dela.
    const longe = casa()
    const andou: HostWorld = mundo({ ...longe, map: { ...longe.map, tokens: [ficha('gabi', 1300, 400), ficha('ana', 200, 100)] } })
    s.broadcast(andou)
    s.disconnect('c-gabi')
    const volta = entra(s, 'c-gabi-2', 'Gabi', andou, gabi.resume)
    const livro = msgsPara(volta.r, 'c-gabi-2').find((m) => m.type === 'clues.book')
    expect(livro).toEqual({ type: 'clues.book', clues: [lida] })
  })

  it('ler de novo o mesmo pino não duplica: a pista mantém o id e sobe para o fim', () => {
    const { s, world } = mesa()
    const primeira = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'bilhete' }, world), 'c-gabi')
    const outra = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'porta' }, world), 'c-gabi')
    const deNovo = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'bilhete' }, world), 'c-gabi')
    expect(deNovo.id).toBe(primeira.id)
    s.disconnect('c-gabi')
    const livro = s.handleMessage('c-gabi-2', { type: 'join', code: CODE, name: 'Gabi', resume: 'id-2' }, world).outbound.find((o) => o.msg.type === 'clues.book')?.msg
    expect(livro?.type === 'clues.book' ? livro.clues.map((c) => c.id) : []).toEqual([outra.id, primeira.id])
  })

  it('o que o mestre ou a névoa escondem não vira pista: secreto, oculto, longe, em zona oculta', () => {
    const { s, world } = mesa()
    for (const pinId of ['segredo', 'escondido', 'longe', 'na-zona', 'nao-existe']) {
      const r = s.handleMessage('c-gabi', { type: 'clue.read', pinId }, world)
      expect(r.outbound).toEqual([])
    }
    s.disconnect('c-gabi')
    const volta = s.handleMessage('c-gabi-2', { type: 'join', code: CODE, name: 'Gabi', resume: 'id-2' }, world)
    expect(volta.outbound.some((o) => o.msg.type === 'clues.book')).toBe(false)
    const json = JSON.stringify(volta.outbound)
    for (const texto of ['PISTA-SECRETA', 'PISTA-ESCONDIDA', 'PISTA-LONGE', 'PISTA-NA-ZONA']) expect(json).not.toContain(texto)
  })

  it('pino de OUTRA cena não vira pista, mesmo com o id certo', () => {
    const { s, world } = mesa()
    const r = s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'porao-pin' }, world)
    expect(r.outbound).toEqual([])
    expect(JSON.stringify(r.outbound)).not.toContain('PISTA-DO-PORAO')
  })

  it('foto em caminho de disco não viaja; pino de viagem vira pista sem destino', () => {
    const { s, world } = mesa()
    const disco = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'disco' }, world), 'c-gabi')
    expect(disco).toEqual({ id: expect.any(String), title: 'Mapa rasgado', text: 'Mapa rasgado', image: null, at: AGORA, place: 'l1', tipo: 'cenario' })
    const r = s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'porta' }, world)
    expect(pistaLida(r, 'c-gabi').title).toBe('Porta do porão')
    expect(JSON.stringify(r.outbound)).not.toContain('s-porao')
    expect(JSON.stringify(r.outbound)).not.toContain('escada')
  })

  it('texto de Sala lido ao entrar também vira pista, com o nome que o jogador pode ver', () => {
    const quarto: Region = {
      id: 'quarto',
      points: [
        { x: 50, y: 50 },
        { x: 300, y: 50 },
        { x: 300, y: 300 },
        { x: 50, y: 300 },
      ],
      tag: '',
      fillColor: '#3a7ad0',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'Quarto', textoAoEntrar: 'Uma carta sob o travesseiro.', notaDoMestre: 'NOTA-DO-MESTRE' },
    }
    const { primeiro } = mesa(mundo(casa([], [quarto])))
    expect(msgsPara(primeiro, 'c-gabi').filter((m) => m.type === 'clue.added')).toEqual([
      { type: 'clue.added', clue: { id: expect.any(String), title: 'Quarto', text: 'Uma carta sob o travesseiro.', image: null, at: AGORA, place: 'l1' } },
    ])
    expect(JSON.stringify(primeiro.outbound)).not.toContain('NOTA-DO-MESTRE')
    expect(msgsPara(primeiro, 'c-bruno').some((m) => m.type === 'clue.added')).toBe(false)
  })
})

describe('Minhas pistas — "Mostrar para…"', () => {
  it('a lista de colegas tem só quem está na MESMA cena', () => {
    const { s, world } = mesa()
    const r = s.handleMessage('c-gabi', { type: 'clue.peers' }, world)
    expect(msgsPara(r, 'c-gabi')).toEqual([{ type: 'clue.peers', names: ['Ana'] }])
    expect(JSON.stringify(r.outbound)).not.toContain('Bruno')
  })

  it('Gabi mostra o bilhete para Ana: Ana recebe "Gabi mostrou" com a pista, e ela entra no caderno dela', () => {
    const { s, world, ana } = mesa()
    const lida = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'bilhete' }, world), 'c-gabi')
    const r = s.handleMessage('c-gabi', { type: 'clue.show', clueId: lida.id, to: 'Ana' }, world)
    expect(msgsPara(r, 'c-ana')).toEqual([
      { type: 'clue.shown', from: 'Gabi', clue: { id: expect.any(String), title: 'Bilhete', text: BILHETE, image: FOTO, at: AGORA, from: 'Gabi', place: 'l1' } },
    ])
    expect(msgsPara(r, 'c-gabi')).toEqual([{ type: 'clue.show.result', to: 'Ana', ok: true }])
    expect(msgsPara(r, 'c-bruno')).toEqual([])
    s.disconnect('c-ana')
    const volta = entra(s, 'c-ana-2', 'Ana', world, ana.resume)
    const livro = msgsPara(volta.r, 'c-ana-2').find((m) => m.type === 'clues.book')
    expect(livro?.type === 'clues.book' ? livro.clues.map((c) => c.title) : []).toEqual(['Bilhete'])
  })

  it('colega em outra cena não recebe nada: a recusa volta para Gabi', () => {
    const { s, world } = mesa()
    const lida = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'bilhete' }, world), 'c-gabi')
    const r = s.handleMessage('c-gabi', { type: 'clue.show', clueId: lida.id, to: 'Bruno' }, world)
    expect(msgsPara(r, 'c-bruno')).toEqual([])
    expect(msgsPara(r, 'c-gabi')).toEqual([{ type: 'clue.show.result', to: 'Bruno', ok: false }])
  })

  it('dois colegas em menos de 1 s: a segunda volta como "espere", não como "saiu da cena", e passa depois do intervalo', () => {
    let agora = AGORA
    const base = casa()
    // Bia também na Casa Velha, ao lado de Gabi e Ana; Bruno segue no Porão.
    const world: HostWorld = { open: { ...base, map: { ...base.map, tokens: [...base.map.tokens, ficha('bia', 250, 100)] } }, background: [porao()] }
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => agora, randomId: () => `id-${(n += 1)}` })
    const gabi = entra(s, 'c-gabi', 'Gabi', world)
    const ana = entra(s, 'c-ana', 'Ana', world)
    const bia = entra(s, 'c-bia', 'Bia', world)
    const bruno = entra(s, 'c-bruno', 'Bruno', world)
    s.assignToken(gabi.playerId, 'gabi')
    s.assignToken(ana.playerId, 'ana')
    s.assignToken(bia.playerId, 'bia')
    s.assignToken(bruno.playerId, 'bruno')
    s.broadcast(world)
    const lida = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'bilhete' }, world), 'c-gabi')
    expect(msgsPara(s.handleMessage('c-gabi', { type: 'clue.show', clueId: lida.id, to: 'Ana' }, world), 'c-gabi')).toEqual([
      { type: 'clue.show.result', to: 'Ana', ok: true },
    ])

    agora = AGORA + CLUE_SHOW_MIN_INTERVAL_MS / 2
    const cedo = s.handleMessage('c-gabi', { type: 'clue.show', clueId: lida.id, to: 'Bia' }, world)
    expect(msgsPara(cedo, 'c-bia')).toEqual([])
    expect(msgsPara(cedo, 'c-gabi')).toEqual([{ type: 'clue.show.result', to: 'Bia', ok: false, reason: 'too_soon' }])
    // Quem está em outra cena continua sendo só "não chegou": o "espere" nunca diz que Bruno está na cena.
    const outraCena = s.handleMessage('c-gabi', { type: 'clue.show', clueId: lida.id, to: 'Bruno' }, world)
    expect(msgsPara(outraCena, 'c-gabi')).toEqual([{ type: 'clue.show.result', to: 'Bruno', ok: false }])

    agora = AGORA + CLUE_SHOW_MIN_INTERVAL_MS
    const depois = s.handleMessage('c-gabi', { type: 'clue.show', clueId: lida.id, to: 'Bia' }, world)
    expect(msgsPara(depois, 'c-gabi')).toEqual([{ type: 'clue.show.result', to: 'Bia', ok: true }])
    expect(msgsPara(depois, 'c-bia').map((m) => m.type)).toEqual(['clue.shown'])
  })

  it('pista que não é dela, ou para si mesma, não sai', () => {
    const { s, world } = mesa()
    const inventada = s.handleMessage('c-gabi', { type: 'clue.show', clueId: 'id-999', to: 'Ana' }, world)
    expect(msgsPara(inventada, 'c-ana')).toEqual([])
    expect(msgsPara(inventada, 'c-gabi')).toEqual([{ type: 'clue.show.result', to: 'Ana', ok: false }])
    const lida = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'bilhete' }, world), 'c-gabi')
    const propria = s.handleMessage('c-gabi', { type: 'clue.show', clueId: lida.id, to: 'Gabi' }, world)
    expect(propria.outbound).toEqual([{ clientId: 'c-gabi', msg: { type: 'clue.show.result', to: 'Gabi', ok: false } }])
  })
})

/**
 * PAINEL PISTAS, lado da sessão: para cada pino, quem RECEBEU (o pino saiu
 * no pacote dele, com o texto) e quem LEU (abriu o cartão, `pin.read`). É o
 * que o mestre anotava no papel antes do combate. Mesa do crime em
 * miniatura: Gabi ao lado do bilhete, Fábio no mesmo quarto, Ana longe.
 */

const CODE_PAINEL = 'CR1ME7'
const RADIUS_PAINEL = 700
const ANDAR = 'cena-andar-de-cima'
const TEXTO_DO_BILHETE = 'Bilhete: encontre-me no cais à meia-noite'

const PINO_BILHETE: Pin = { id: 'bilhete', x: 300, y: 200, kind: 'interrogacao', description: TEXTO_DO_BILHETE, image: null }
/** Carta que só se lê de perto: a Gabi está colada nela; o Fábio a vê, mas longe. */
const CARTA: Pin = { id: 'carta', x: 300, y: 200, kind: 'exclamacao', description: 'Carta lacrada', image: null, lerDePerto: 1 }

function andar(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('mapa-andar', 'Andar de cima', 40, 10, 50),
    tokens: [ficha('ficha-gabi', 275, 200), ficha('ficha-fabio', 100, 200), ficha('ficha-ana', 1900, 200)],
    pins,
  }
}

function mundoPainel(pins: Pin[] = [PINO_BILHETE]): HostWorld {
  return { open: { sceneId: ANDAR, name: 'Andar de cima', map: andar(pins) }, background: [] }
}

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function pinosDo(result: HostResult, clientId: string): string[] {
  const msg: HostMessage | undefined = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg.map.pins.map((p) => p.id)
}

function mesaPainel(pins?: Pin[]) {
  let n = 0
  const w = mundoPainel(pins)
  const s = createHostSession({
    code: CODE_PAINEL,
    visionRadius: RADIUS_PAINEL,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const gabi = welcomeOf(s.handleMessage('c-gabi', { type: 'join', code: CODE_PAINEL, name: 'Gabi' }, w))
  const fabio = welcomeOf(s.handleMessage('c-fabio', { type: 'join', code: CODE_PAINEL, name: 'Fábio' }, w))
  const ana = welcomeOf(s.handleMessage('c-ana', { type: 'join', code: CODE_PAINEL, name: 'Ana' }, w))
  s.assignToken(gabi, 'ficha-gabi')
  s.assignToken(fabio, 'ficha-fabio')
  s.assignToken(ana, 'ficha-ana')
  return { s, w, gabi, fabio, ana }
}

describe('protocolo: pin.read', () => {
  it('aceita só o id do pino, e recusa a forma errada', () => {
    expect(parsePlayerMessage({ type: 'pin.read', pinId: 'bilhete', extra: 'x' })).toEqual({ type: 'pin.read', pinId: 'bilhete' })
    expect(parsePlayerMessage({ type: 'pin.read' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.read', pinId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.read', pinId: 42 })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.read', pinId: 'x'.repeat(65) })).toBeNull()
  })
})

describe('hostSession: quem recebeu e quem leu cada pista', () => {
  it('recebeu = o pino saiu no pacote dele: Gabi e Fábio sim, Ana longe não', () => {
    const { s, w, gabi, fabio } = mesaPainel()
    const r = s.broadcast(w)
    expect(pinosDo(r, 'c-gabi')).toContain('bilhete')
    expect(pinosDo(r, 'c-ana')).not.toContain('bilhete')
    expect(s.pinClues()).toEqual({ bilhete: { received: [gabi, fabio], read: [] } })
  })

  it('leu = a Gabi abriu o cartão; a leitura chega sem mandar nada de volta', () => {
    const { s, w, gabi, fabio } = mesaPainel()
    s.broadcast(w)
    const lida = s.handleMessage('c-gabi', { type: 'pin.read', pinId: 'bilhete' }, w)
    expect(lida.outbound).toEqual([])
    expect(s.pinClues().bilhete).toEqual({ received: [gabi, fabio], read: [gabi] })
  })

  it('leitura de quem nunca recebeu o pino, ou de pino inventado, não conta', () => {
    const { s, w, gabi, fabio } = mesaPainel()
    s.broadcast(w)
    s.handleMessage('c-ana', { type: 'pin.read', pinId: 'bilhete' }, w)
    s.handleMessage('c-gabi', { type: 'pin.read', pinId: 'inventado' }, w)
    expect(s.pinClues()).toEqual({ bilhete: { received: [gabi, fabio], read: [] } })
    expect(Object.keys(s.pinClues())).toEqual(['bilhete'])
  })

  it('pin.read malformado responde invalid_message; de quem não entrou, not_joined', () => {
    const { s, w } = mesaPainel()
    const torta = s.handleMessage('c-gabi', { type: 'pin.read' }, w)
    expect(torta.outbound[0]?.msg).toEqual({ type: 'error', reason: 'invalid_message' })
    const estranho = s.handleMessage('c-x', { type: 'pin.read', pinId: 'bilhete' }, w)
    expect(estranho.outbound[0]?.msg).toEqual({ type: 'error', reason: 'not_joined' })
  })

  it('carta só de perto: o Fábio a vê de longe, sem o texto — não recebeu, e a leitura dele não vale', () => {
    const { s, w, gabi, fabio } = mesaPainel([CARTA])
    const r = s.broadcast(w)
    expect(pinosDo(r, 'c-fabio')).toContain('carta')
    s.handleMessage('c-fabio', { type: 'pin.read', pinId: 'carta' }, w)
    s.handleMessage('c-gabi', { type: 'pin.read', pinId: 'carta' }, w)
    expect(s.pinClues().carta).toEqual({ received: [gabi], read: [gabi] })
    expect(s.pinClues().carta?.received).not.toContain(fabio)
  })

  it('esconder a pista do Fábio depois não apaga que ele já recebeu', () => {
    const { s, w, gabi, fabio } = mesaPainel()
    s.broadcast(w)
    s.setPinAudience('bilhete', [gabi])
    expect(pinosDo(s.broadcast(w), 'c-fabio')).not.toContain('bilhete')
    expect(s.pinClues().bilhete).toEqual({ received: [gabi, fabio], read: [] })
  })

  it('expulsar tira o jogador das bolinhas', () => {
    const { s, w, fabio } = mesaPainel()
    s.broadcast(w)
    s.handleMessage('c-gabi', { type: 'pin.read', pinId: 'bilhete' }, w)
    s.kick('c-gabi')
    expect(s.pinClues().bilhete).toEqual({ received: [fabio], read: [] })
  })
})

describe('"?" Falas e pistas (P5): Dizer agora e o caderno', () => {
  const falas: FalaDoPino[] = [
    { id: 'f1', etiqueta: 'Fala', quem: 'Bento', texto: 'SEGREDO-XYZ fala oculta' },
    { id: 'f2', etiqueta: 'Boato', quem: 'Bento', texto: 'O moinho range à noite' },
    { id: 'f3', etiqueta: 'Pista', texto: 'Pegadas de lama', livre: true },
  ]
  const comPergunta = () => mundo(casa([pino('taverna', 140, 140, '', { kind: 'interrogacao', falas })]))

  it('dita só à Ana: só ela ouve, com o texto como foi dito; a oculta não sai a ninguém', () => {
    const { s, world, ana, primeiro } = mesa(comPergunta())
    expect(JSON.stringify(primeiro)).not.toContain('SEGREDO-XYZ')
    expect(JSON.stringify(primeiro)).not.toContain('O moinho')
    const { result, para } = s.dizerFala('taverna', 'f2', [ana.playerId], world)
    expect(para).toEqual([ana.playerId])
    expect(msgsPara(result, 'c-ana')).toEqual([
      { type: 'clue.added', clue: expect.objectContaining({ title: 'Boato · Bento', text: 'O moinho range à noite', image: null, tipo: 'fala', quem: 'Bento' }) },
    ])
    expect(msgsPara(result, 'c-gabi')).toEqual([])
    const depois = s.broadcast(world)
    const daAna = JSON.stringify(msgsPara(depois, 'c-ana'))
    const daGabi = JSON.stringify(msgsPara(depois, 'c-gabi'))
    expect(daAna).toContain('O moinho range à noite')
    // Gabi não muda de vista (nada novo para ela): a livre ela já tinha no primeiro mapa.
    expect(daGabi).not.toContain('O moinho')
    expect(JSON.stringify(msgsPara(primeiro, 'c-gabi'))).toContain('Pegadas de lama')
    expect(JSON.stringify(depois)).not.toContain('SEGREDO-XYZ')
    expect(JSON.stringify(depois)).not.toContain('"falas"')
    expect(s.falasDitas()).toEqual({ taverna: { f2: [ana.playerId] } })
  })

  it('a livre entra no caderno de quem toca, uma vez; "?" de outra cena não vira fala', () => {
    const { s, world, bruno } = mesa(comPergunta())
    const lida = s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'taverna' }, world)
    expect(msgsPara(lida, 'c-gabi')).toEqual([{ type: 'clue.added', clue: expect.objectContaining({ title: 'Pista', text: 'Pegadas de lama', tipo: 'fala' }) }])
    expect(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'taverna' }, world).outbound).toEqual([])
    expect(s.dizerFala('taverna', 'f2', [bruno.playerId], world).para).toEqual([])
    expect(s.dizerFala('taverna', 'nao-existe', null, world).para).toEqual([])
  })
})

describe('"?" antigo depois que o mestre mexe nele: o caderno não muda (auditoria 16/11/2026)', () => {
  const POCO = 'Poço velho\nPista antiga do poço.'
  const antigo = pino('poco', 140, 140, POCO, { kind: 'interrogacao' })
  // A 1ª mexida da ficha: o texto vira a entrada 1 (`comFalas(falasDoPino(pin))`) e o mestre põe uma entrada oculta.
  const convertido = comFalas(antigo, [...falasDoPino(antigo), novaFala('f-nova', 'Boato', 'SEGREDO-XYZ boato novo')])
  const antes = mundo(casa([antigo]))
  const depois = mundo(casa([convertido]))

  /** O caderno inteiro que o jogador recebe ao voltar (o `clues.book` do join). */
  function cadernoAoVoltar(s: Sessao, clientId: string, name: string, resume: string) {
    s.disconnect(clientId)
    const volta = entra(s, `${clientId}-2`, name, depois, resume)
    const livro = msgsPara(volta.r, `${clientId}-2`).find((m) => m.type === 'clues.book')
    if (livro?.type !== 'clues.book') throw new Error('esperava clues.book')
    return livro.clues
  }

  it('Gabi leu o "?" antigo; depois da 1ª mexida, tocar de novo não dá 2ª entrada, e o título segue o nome do lugar', () => {
    expect(convertido.falas?.[0]?.id).toBe(ID_DA_FALA_ANTIGA)
    const { s, gabi } = mesa(antes)
    const lida = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'poco' }, antes), 'c-gabi')
    expect(lida).toEqual(expect.objectContaining({ title: 'Poço velho', text: POCO }))
    s.broadcast(depois)
    expect(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'poco' }, depois).outbound).toEqual([])
    const caderno = cadernoAoVoltar(s, 'c-gabi', 'Gabi', gabi.resume)
    expect(caderno).toEqual([lida])
  })

  it('Ana toca só depois da mexida: a pista é a do pino de antes (nome do lugar, no lugar, não nas falas)', () => {
    const { s } = mesa(depois)
    const lida = pistaLida(s.handleMessage('c-ana', { type: 'clue.read', pinId: 'poco' }, depois), 'c-ana')
    expect(lida.title).toBe('Poço velho')
    expect(lida.text).toBe(POCO)
    expect(lida.tipo).toBeUndefined()
    expect(JSON.stringify(lida)).not.toContain('SEGREDO-XYZ')
  })

  it('"Dizer agora" da entrada antiga a quem já leu troca a mesma entrada: segue uma só, mesmo id', () => {
    const { s, gabi } = mesa(antes)
    const lida = pistaLida(s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'poco' }, antes), 'c-gabi')
    s.broadcast(depois)
    const { result, para } = s.dizerFala('poco', ID_DA_FALA_ANTIGA, [gabi.playerId], depois)
    expect(para).toEqual([gabi.playerId])
    expect(pistaLida(result, 'c-gabi')).toEqual(expect.objectContaining({ id: lida.id, title: 'Poço velho', text: POCO }))
    expect(cadernoAoVoltar(s, 'c-gabi', 'Gabi', gabi.resume).map((c) => c.id)).toEqual([lida.id])
  })
})

describe('"Ler para todos" e "Dizer agora" a todos: só quem VÊ o pino (auditoria 16/11/2026)', () => {
  const SALA = 'SEGREDO-XYZ sala da Gabi'
  const SUSSURRO: FalaDoPino = { id: 's1', etiqueta: 'Fala', texto: 'SEGREDO-XYZ sussurro' }
  const salaDaGabi = pino('sala-gabi', 150, 120, SALA)
  const sussurro = pino('sussurro', 160, 130, '', { kind: 'interrogacao', falas: [SUSSURRO] })
  const naZonaQ = pino('zona-q', 410, 310, '', { kind: 'interrogacao', falas: [SUSSURRO] })
  const comTudo = () => mundo(casa([salaDaGabi, sussurro, naZonaQ]))

  /** Quem recebeu alguma mensagem com `texto` nesta resposta. */
  function quemRecebeu(r: HostResult, texto: string): string[] {
    return ['c-gabi', 'c-ana', 'c-bruno'].filter((c) => JSON.stringify(msgsPara(r, c)).includes(texto))
  }

  it('"!" com "Quem vê" só da Gabi: Ler para todos chega só a ela; Escolher a Ana põe a Ana no "Quem vê" e chega', () => {
    const { s, world, gabi, ana } = mesa(comTudo())
    s.setPinAudience('sala-gabi', [gabi.playerId])
    s.broadcast(world)
    const todos = s.lerCenario('sala-gabi', null, world)
    expect(todos.para).toEqual([gabi.playerId])
    expect(quemRecebeu(todos.result, SALA)).toEqual(['c-gabi'])
    const escolhida = s.lerCenario('sala-gabi', [ana.playerId], world)
    expect(escolhida.para).toEqual([ana.playerId])
    expect(quemRecebeu(escolhida.result, SALA)).toEqual(['c-ana'])
    expect(s.pinAudience('sala-gabi')).toEqual([gabi.playerId, ana.playerId])
    expect(pinosDo(s.broadcast(world), 'c-ana')).toContain('sala-gabi')
  })

  it('"?" com "Quem vê" só da Gabi: Dizer agora chega só a ela; Dizer a Ana põe a Ana no "Quem vê" e chega', () => {
    const { s, world, gabi, ana } = mesa(comTudo())
    s.setPinAudience('sussurro', [gabi.playerId])
    s.broadcast(world)
    const todos = s.dizerFala('sussurro', 's1', null, world)
    expect(todos.para).toEqual([gabi.playerId])
    expect(quemRecebeu(todos.result, SUSSURRO.texto)).toEqual(['c-gabi'])
    const aAna = s.dizerFala('sussurro', 's1', [ana.playerId], world)
    expect(aAna.para).toEqual([ana.playerId])
    expect(quemRecebeu(aAna.result, SUSSURRO.texto)).toEqual(['c-ana'])
    expect(s.pinAudience('sussurro')).toEqual([gabi.playerId, ana.playerId])
  })

  it('"?" só com entrada oculta e sem "Quem vê": Dizer agora chega a todos da cena que o veem', () => {
    const { s, world, gabi, ana } = mesa(comTudo())
    expect(s.dizerFala('sussurro', 's1', null, world).para).toEqual([gabi.playerId, ana.playerId])
    expect(s.pinAudience('sussurro')).toBeNull()
  })

  it('pino em zona oculta: ninguém recebe até revelar; o Escolher do mestre ainda chega', () => {
    const { s, world, gabi, ana } = mesa(comTudo())
    expect(s.lerCenario('na-zona', null, world).para).toEqual([])
    expect(s.dizerFala('zona-q', 's1', null, world).para).toEqual([])
    const escolhida = s.lerCenario('na-zona', [ana.playerId], world)
    expect(escolhida.para).toEqual([ana.playerId])
    expect(quemRecebeu(escolhida.result, 'PISTA-NA-ZONA')).toEqual(['c-ana'])
    // O mestre revela a zona; o broadcast sai antes do "Ler para todos" (o integrador faz o pendente).
    const aberta = comTudo()
    const revelada: HostWorld = { ...aberta, open: { ...aberta.open, map: { ...aberta.open.map, concealZones: (aberta.open.map.concealZones ?? []).map((z) => ({ ...z, revealed: true })) } } }
    s.broadcast(revelada)
    expect(s.lerCenario('na-zona', null, revelada).para).toEqual([gabi.playerId, ana.playerId])
    expect(s.dizerFala('zona-q', 's1', null, revelada).para).toEqual([gabi.playerId, ana.playerId])
  })
})
