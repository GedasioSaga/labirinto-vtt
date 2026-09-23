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
import type { HostMessage } from './protocol'
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
    expect(msgsPara(r, 'c-gabi')).toEqual([
      { type: 'clue.added', clue: { id: expect.any(String), title: 'Bilhete', text: BILHETE, image: FOTO, at: AGORA } },
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
    expect(disco).toEqual({ id: expect.any(String), title: 'Mapa rasgado', text: 'Mapa rasgado', image: null, at: AGORA })
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
      { type: 'clue.added', clue: { id: expect.any(String), title: 'Quarto', text: 'Uma carta sob o travesseiro.', image: null, at: AGORA } },
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
      { type: 'clue.shown', from: 'Gabi', clue: { id: expect.any(String), title: 'Bilhete', text: BILHETE, image: FOTO, at: AGORA, from: 'Gabi' } },
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
