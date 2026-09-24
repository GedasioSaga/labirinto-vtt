/**
 * OBJETO COM RÓTULO OU IMAGEM, no FIO. A silhueta sozinha não diz o que é o
 * móvel; o mestre dá um "Rótulo para jogadores" ("Guarda-roupa") ou liga
 * "Mostrar imagem ao jogador" (cópia pequena, a mesma regra da foto da ficha).
 * Aqui a prova é o pacote de verdade que a sessão do mestre entrega: quem vê
 * o objeto recebe o rótulo e a imagem; quem não vê, o objeto oculto e o teto
 * fechado não mandam nem uma letra dele.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Prop, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const CAMINHO_DA_IMAGEM = 'C:\\Users\\mestre\\AppData\\Roaming\\labirinto\\props\\piano.png'
/** Menor PNG que passa na regra da foto da ficha (`isTokenPhotoData`). */
const IMAGEM_DO_PIANO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function sala(roof?: boolean): Region {
  return {
    id: 'sala-de-musica',
    points: [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 400 },
      { x: 100, y: 400 },
    ],
    tag: '',
    fillColor: '#654',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Sala de música', roof },
  }
}

/** O guarda-roupa com rótulo; o piano com rótulo E imagem, girado. */
function guardaRoupa(extra: Partial<Prop> = {}): Prop {
  return { id: 'guarda-roupa', src: CAMINHO_DA_IMAGEM, x: 150, y: 150, width: 40, height: 80, linkedMapPath: null, playerLabel: 'Guarda-roupa', ...extra }
}

function piano(extra: Partial<Prop> = {}): Prop {
  return {
    id: 'piano',
    src: CAMINHO_DA_IMAGEM,
    x: 300,
    y: 300,
    width: 80,
    height: 60,
    rotation: 30,
    linkedMapPath: null,
    playerImage: IMAGEM_DO_PIANO,
    ...extra,
  }
}

/** Sala de música à esquerda da parede cega em x=500 (Elisa), corredor à direita (Bruno). */
function mansao(props: Prop[], extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m-mansao', 'Mansão', 25, 25, 40),
    walls: [parede('divisoria', 500, 0, 500, 1000)],
    regions: [sala()],
    tokens: [ficha('ficha-elisa', 250, 350), ficha('ficha-bruno', 800, 350)],
    props,
    ...extra,
  }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, map: MapData): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

/** Elisa (c1) com a ficha dela, Bruno (c2) com a dele. */
function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  s.assignToken(entra(s, 'c1', 'Elisa', map), 'ficha-elisa')
  s.assignToken(entra(s, 'c2', 'Bruno', map), 'ficha-bruno')
  return s
}

function snapshotPara(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

describe('hostSession — rótulo e imagem do objeto no pacote do jogador', () => {
  it('Elisa recebe "Guarda-roupa" na silhueta; Bruno, sem visão da sala, não recebe nem o nome', () => {
    const map = mansao([guardaRoupa()])
    const r = mesa(map).broadcast(map)

    expect(snapshotPara(r, 'c1').map.props).toEqual([
      { id: 'guarda-roupa', x: 150, y: 150, width: 40, height: 80, src: '', linkedMapPath: null, playerLabel: 'Guarda-roupa' },
    ])
    const doBruno = snapshotPara(r, 'c2').map
    expect(doBruno.props).toEqual([])
    expect(JSON.stringify(doBruno)).not.toContain('Guarda-roupa')
  })

  it('o piano chega com a imagem pequena, na posição e rotação do editor; nunca com o caminho do disco', () => {
    const map = mansao([piano()])
    const r = mesa(map).broadcast(map)

    const [doPiano] = snapshotPara(r, 'c1').map.props
    expect(doPiano).toEqual({ id: 'piano', x: 300, y: 300, width: 80, height: 60, rotation: 30, src: '', linkedMapPath: null, playerImage: IMAGEM_DO_PIANO })
    expect(JSON.stringify(r.outbound)).not.toContain('C:\\\\')
    expect(JSON.stringify(snapshotPara(r, 'c2').map)).not.toContain(IMAGEM_DO_PIANO)
  })

  it('teto fechado com a Elisa fora: nem o rótulo nem a imagem saem; ela entra e os dois chegam', () => {
    const comTeto = (elisa: { x: number; y: number }): MapData =>
      mansao([guardaRoupa(), piano()], { walls: [], regions: [sala(true)], tokens: [ficha('ficha-elisa', elisa.x, elisa.y), ficha('ficha-bruno', 800, 900)] })
    const fora = comTeto({ x: 250, y: 600 })
    const s = mesa(fora)

    const deFora = snapshotPara(s.broadcast(fora), 'c1').map
    expect(deFora.props).toEqual([])
    const fio = JSON.stringify(deFora)
    expect(fio).not.toContain('Guarda-roupa')
    expect(fio).not.toContain(IMAGEM_DO_PIANO)

    const dentro = snapshotPara(s.broadcast(comTeto({ x: 250, y: 300 })), 'c1').map
    expect(dentro.props.map((p) => [p.id, p.playerLabel, p.playerImage])).toEqual([
      ['guarda-roupa', 'Guarda-roupa', undefined],
      ['piano', undefined, IMAGEM_DO_PIANO],
    ])
  })

  it('"Oculto para jogadores" e "Oculto no editor": o rótulo e a imagem somem junto com o objeto', () => {
    const secreto = mansao([guardaRoupa({ secret: true }), piano({ hidden: true })])
    const pacote = snapshotPara(mesa(secreto).broadcast(secreto), 'c1').map

    expect(pacote.props).toEqual([])
    expect(JSON.stringify(pacote)).not.toContain('Guarda-roupa')
    expect(JSON.stringify(pacote)).not.toContain(IMAGEM_DO_PIANO)
  })

  it('"Mostrar imagem ao jogador" guardando um caminho do disco (arquivo editado à mão) não manda o caminho', () => {
    const map = mansao([piano({ playerImage: CAMINHO_DA_IMAGEM })])
    const r = mesa(map).broadcast(map)

    const [doPiano] = snapshotPara(r, 'c1').map.props
    expect(doPiano.id).toBe('piano')
    expect(doPiano).not.toHaveProperty('playerImage')
    expect(JSON.stringify(r.outbound)).not.toContain('piano.png')
  })

  it('rótulo em branco não vira campo; rótulo com espaço sobrando chega aparado', () => {
    const map = mansao([guardaRoupa({ playerLabel: '   ' }), piano({ playerLabel: '  Piano  de cauda ', playerImage: undefined })])
    const [roupa, dePiano] = snapshotPara(mesa(map).broadcast(map), 'c1').map.props

    expect(roupa.id).toBe('guarda-roupa')
    expect(roupa).not.toHaveProperty('playerLabel')
    expect(dePiano.playerLabel).toBe('Piano de cauda')
    expect(dePiano).not.toHaveProperty('playerImage')
  })
})
