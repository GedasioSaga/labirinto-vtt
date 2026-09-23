/**
 * FRENTE DA FICHA, no FIO. A rotação que o mestre dá à ficha é o que a tela
 * do jogador usa para desenhar o bico (`player/facingMarker.ts`), e ela viaja
 * DENTRO da própria ficha, sem campo novo no pacote. Aqui a prova é o pacote
 * de verdade (`snapshot`) que a sessão do mestre entrega ao transporte: a
 * frente da ficha que o jogador enxerga chega junto dela, e a de quem ele não
 * enxerga não chega por caminho nenhum — nem atrás da parede, nem na zona
 * oculta, nem no segredo do mestre, nem debaixo do teto, nem de outra cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
/** Frente com casas que número nenhum do pacote teria por acaso: se aparecer no fio, veio da ficha escondida. */
const FRENTE_ESCONDIDA = 211.75
const FOTO_NO_DISCO = 'C:\\Users\\mestre\\AppData\\Roaming\\labirinto\\tokens\\guarda.png'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Guarita: parede cega em x=500. A Ana e o guarda do lado oeste; o Bruno do lado leste. */
function guarita(guarda: Partial<Token> = {}, extra: Partial<MapData> = {}): MapData {
  return {
    // 25 x 25 casas de 40 px: 1000 x 1000 px de mundo.
    ...createEmptyMap('m-guarita', 'Guarita', 25, 25, 40),
    walls: [parede('divisoria', 500, 0, 500, 1000)],
    tokens: [ficha('ficha-ana', 250, 600, { rotation: 180 }), ficha('guarda', 300, 250, { rotation: 90, ...guarda }), ficha('ficha-bruno', 800, 600, { rotation: 45 })],
    ...extra,
  }
}

/** A casa do guarda, de teto fechado: a Ana está do lado de fora dela. */
function casaComTeto(): Region {
  return {
    id: 'casa-do-guarda',
    points: [
      { x: 200, y: 150 },
      { x: 400, y: 150 },
      { x: 400, y: 350 },
      { x: 200, y: 350 },
    ],
    tag: '',
    fillColor: '#654',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Casa do guarda', roof: true },
  }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, source: MapData | HostWorld): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, source).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

/** Ana (c1) com a ficha dela, Bruno (c2) com a dele. */
function mesa(source: MapData | HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  s.assignToken(entra(s, 'c1', 'Ana', source), 'ficha-ana')
  s.assignToken(entra(s, 'c2', 'Bruno', source), 'ficha-bruno')
  return s
}

function snapshotPara(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

function frenteNoPacote(r: HostResult, clientId: string, tokenId: string): number | undefined {
  return snapshotPara(r, clientId).map.tokens.find((t) => t.id === tokenId)?.rotation
}

function fioPara(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

describe('hostSession — a frente da ficha no pacote do jogador', () => {
  it('o pacote da Ana leva a frente da ficha dela e a do guarda que ela enxerga', () => {
    const map = guarita()
    const r = mesa(map).broadcast(map)

    expect(frenteNoPacote(r, 'c1', 'ficha-ana')).toBe(180)
    expect(frenteNoPacote(r, 'c1', 'guarda')).toBe(90)
    // O Bruno, do outro lado da parede, não está no pacote dela; a frente dele vai só para ele.
    expect(snapshotPara(r, 'c1').map.tokens.map((t) => t.id)).toEqual(['ficha-ana', 'guarda'])
    expect(frenteNoPacote(r, 'c2', 'ficha-bruno')).toBe(45)
  })

  it('a foto do guarda no disco do mestre sai do pacote; a frente dele fica', () => {
    const map = guarita({ image: FOTO_NO_DISCO })
    const r = mesa(map).broadcast(map)

    const guarda = snapshotPara(r, 'c1').map.tokens.find((t) => t.id === 'guarda')
    expect(guarda?.image).toBeNull()
    expect(guarda?.rotation).toBe(90)
    expect(JSON.stringify(r.outbound)).not.toContain('guarda.png')
  })

  it('o Bruno, sem visão do guarda, não recebe a ficha nem a frente dela', () => {
    const map = guarita({ rotation: FRENTE_ESCONDIDA })
    const r = mesa(map).broadcast(map)

    expect(snapshotPara(r, 'c2').map.tokens.map((t) => t.id)).toEqual(['ficha-bruno'])
    expect(fioPara(r, 'c2')).not.toContain(String(FRENTE_ESCONDIDA))
    // Controle: a Ana, que enxerga o guarda, recebe essa mesma frente — o cenário mede o que diz medir.
    expect(frenteNoPacote(r, 'c1', 'guarda')).toBe(FRENTE_ESCONDIDA)
  })

  it('guarda escondido pelo mestre, pela zona oculta ou pelo teto fechado: a frente não vai para ninguém', () => {
    const zonaNoGuarda = {
      id: 'zona-guarda',
      name: 'Emboscada',
      revealed: false,
      points: [
        { x: 250, y: 200 },
        { x: 350, y: 200 },
        { x: 350, y: 300 },
        { x: 250, y: 300 },
      ],
    }
    const casos: Array<[string, MapData]> = [
      ['oculto para jogadores', guarita({ rotation: FRENTE_ESCONDIDA, secret: true })],
      ['oculto no editor', guarita({ rotation: FRENTE_ESCONDIDA, hidden: true })],
      ['zona oculta ativa', guarita({ rotation: FRENTE_ESCONDIDA }, { concealZones: [zonaNoGuarda] })],
      ['teto fechado com a Ana fora', guarita({ rotation: FRENTE_ESCONDIDA }, { regions: [casaComTeto()] })],
    ]
    for (const [caso, map] of casos) {
      const r = mesa(map).broadcast(map)
      expect(snapshotPara(r, 'c1').map.tokens.map((t) => t.id), caso).toEqual(['ficha-ana'])
      expect(JSON.stringify(r.outbound), caso).not.toContain(String(FRENTE_ESCONDIDA))
    }
  })

  it('cada um na sua cena: a frente do vigia da Cripta nunca chega ao Salão, e a do guarda do Salão nunca chega à Cripta', () => {
    const FRENTE_DO_SALAO = 123.25
    const salao: MapData = {
      ...createEmptyMap('m-salao', 'Salao', 25, 25, 40),
      tokens: [ficha('ficha-ana', 250, 600), ficha('guarda', 300, 250, { rotation: FRENTE_DO_SALAO })],
    }
    const cripta: MapData = {
      ...createEmptyMap('m-cripta', 'Cripta', 25, 25, 40),
      tokens: [ficha('ficha-bruno', 250, 600), ficha('vigia', 300, 250, { rotation: FRENTE_ESCONDIDA })],
    }
    const mundo: HostWorld = { open: { sceneId: 's-a', name: 'Salao', map: salao }, background: [{ sceneId: 's-b', name: 'Cripta', map: cripta }] }
    const r = mesa(mundo).broadcast(mundo)

    expect(frenteNoPacote(r, 'c1', 'guarda')).toBe(FRENTE_DO_SALAO)
    expect(frenteNoPacote(r, 'c2', 'vigia')).toBe(FRENTE_ESCONDIDA)
    expect(fioPara(r, 'c1')).not.toContain(String(FRENTE_ESCONDIDA))
    expect(fioPara(r, 'c2')).not.toContain(String(FRENTE_DO_SALAO))
  })
})
