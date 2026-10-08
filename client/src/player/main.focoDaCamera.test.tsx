/**
 * O PEDIDO DE CÂMERA montado na página do jogador (`main.tsx`), sem navegador:
 * quem pede diz como a câmera vai até a ficha.
 *
 * - O toque (ou clique) no "Onde estou" e no "Minha ficha" pede o deslize;
 *   Enter e Espaço (clique com `detail` 0) pedem o salto.
 * - A chegada pelo atalho na MESMA cena (`scene.changed` + snapshot do mesmo
 *   mapa) pede a ficha direto do outro lado (`focusSnap`), sem deslize.
 * - A chave da chegada (`arrivalKey`) é a do mapa AO VIVO nas duas telas: a do
 *   andar onde ele está e a da memória de outro andar. Olhar outro andar pelas
 *   abas não é chegar a lugar nenhum.
 * - O que a chegada muda chega à PlayerView num desenho só: a ficha do outro
 *   lado vem junto com o pedido de pular o deslize, e a chave nova junto com a
 *   volta ao andar ao vivo. Desenho a desenho, não só o último (`desenhos`).
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL) vira um
 * espião das props de câmera, e o `WebSocket` vira um falso que faz o papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration, type ExploredWire } from '../lib/exploration'
import type { MapData, RegionPoint, Token } from '../types/map'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

/** As props de câmera da última PlayerView desenhada. */
interface CameraPedida {
  mapId: string
  tokenId: string | null
  seq: number
  animate: boolean | undefined
  snap: boolean | undefined
  arrivalKey: string | undefined
}

const camera = vi.hoisted((): CameraPedida => ({ mapId: '', tokenId: null, seq: 0, animate: undefined, snap: undefined, arrivalKey: undefined }))

/** Um desenho da PlayerView: o que ela recebeu JUNTO, no mesmo render. */
interface Desenho {
  mapId: string
  /** Onde a ficha da Gabi está no mapa desse desenho; `undefined` = fora dele. */
  fichaX: number | undefined
  seq: number
  snap: boolean | undefined
  arrivalKey: string | undefined
}

/** Todos os desenhos, na ordem; cada teste que olha a sequência zera antes do gesto. */
const desenhos = vi.hoisted((): Desenho[] => [])

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ map, focusTokenId, focusSeq, focusAnimate, focusSnap, arrivalKey }: PlayerViewProps) => {
    camera.mapId = map.id
    camera.tokenId = focusTokenId
    camera.seq = focusSeq
    camera.animate = focusAnimate
    camera.snap = focusSnap
    camera.arrivalKey = arrivalKey
    desenhos.push({ mapId: map.id, fichaX: map.tokens.find((t) => t.id === 'gabi')?.x, seq: focusSeq, snap: focusSnap, arrivalKey })
    return <div data-testid="mapa" />
  },
}))

const CODE = 'ABC123'

class MestreFalso {
  static ultimo: MestreFalso | null = null
  readonly url: string
  readyState = 0
  sent: unknown[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor(url: string) {
    this.url = url
    MestreFalso.ultimo = this
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }
  close(): void {
    this.readyState = 3
  }
  abre(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  manda(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

function ficha(x: number, y: number): Token {
  return { id: 'gabi', characterId: null, name: 'Gabi', x, y, size: 1, image: null }
}

function torre(x: number, y: number): MapData {
  return { ...createEmptyMap('m-torre', '', 20, 20, 50), tokens: [ficha(x, y)] }
}

/** Memória do subsolo da torre: outro mapa, que o jogador olha pela aba "B1". */
const SUBSOLO = createEmptyMap('m-torre-b1', '', 20, 20, 50)

/** Um andar que ele conhece mas onde não está, como o mestre manda: a memória que a aba mostra. */
interface Lembranca {
  rotulo: string
  map: MapData
  explored: ExploredWire
  concealed: RegionPoint[][]
}

/** Os andares do prédio no pacote: onde a ficha dele está e os outros que ele conhece. */
interface Andares {
  atual: string
  outros: Lembranca[]
}

function lembranca(rotulo: string, map: MapData): Lembranca {
  return { rotulo, map, explored: encodeExploration(createExploration({ width: 1000, height: 1000, grid: 50 })), concealed: [] }
}

const ANDARES: Andares = { atual: '1F', outros: [lembranca('B1', SUBSOLO)] }

let rev = 0
function snapshot(map: MapData, andares: Andares = ANDARES): void {
  rev += 1
  act(() => mestre().manda({ type: 'snapshot', rev, map, vision: [], ownTokens: ['gabi'], concealed: [], andares }))
}

function botao(seletor: string): HTMLButtonElement {
  const achado = document.querySelector<HTMLButtonElement>(seletor)
  if (!achado) throw new Error(`sem o botão ${seletor}`)
  return achado
}

/** Toque do dedo ou clique do mouse: o navegador conta o clique em `detail`. */
function tocar(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
  })
}

/** Enter ou Espaço num botão focado: o clique sintetizado chega com `detail` 0, como o `click()` do DOM. */
function teclar(el: HTMLElement): void {
  act(() => el.click())
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Gabi' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./boot')
  })
  act(() => mestre().abre())
  act(() => mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gabi' }))
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: o pedido de câmera diz como ir até a ficha', () => {
  it('na entrada, a tela do mapa recebe a chave da chegada (o mapa ao vivo) e nenhum pedido de atalho', () => {
    snapshot(torre(100, 100))
    expect(camera.mapId).toBe('m-torre')
    expect(camera.arrivalKey).toBe('m-torre')
    expect(camera.snap).toBe(false)
  })

  it('chegada pelo atalho na mesma cena: a câmera vai à ficha que atravessou, direto do outro lado e sem deslize', () => {
    const antes = camera.seq
    act(() => mestre().manda({ type: 'scene.changed', tokenId: 'gabi' }))
    snapshot(torre(900, 900))
    expect(camera.tokenId).toBe('gabi')
    expect(camera.seq).toBe(antes + 1)
    expect(camera.snap).toBe(true)
    expect(camera.animate).toBe(false)
  })

  it('"Onde estou" pelo toque: desliza; pelo teclado: salta — e nenhum dos dois é atalho', () => {
    const antes = camera.seq
    tocar(botao('button.pp-where'))
    expect(camera.seq).toBe(antes + 1)
    expect(camera.tokenId).toBe('gabi')
    expect(camera.animate).toBe(true)
    expect(camera.snap).toBe(false)

    teclar(botao('button.pp-where'))
    expect(camera.seq).toBe(antes + 2)
    expect(camera.animate).toBe(false)
    expect(camera.snap).toBe(false)
  })

  it('"Minha ficha" pelo toque: desliza; pelo teclado: salta', () => {
    tocar(botao('button.pp-mine'))
    expect(camera.animate).toBe(true)
    expect(camera.snap).toBe(false)
    teclar(botao('button.pp-mine'))
    expect(camera.animate).toBe(false)
  })

  it('olhar o subsolo pela aba: a tela mostra a memória dele, com a chave da chegada ainda no andar ao vivo', () => {
    tocar(botao('button[aria-label="B1"]'))
    expect(camera.mapId).toBe('m-torre-b1')
    expect(camera.arrivalKey).toBe('m-torre')
    tocar(botao('button[aria-label="1F, você está aqui"]'))
    expect(camera.mapId).toBe('m-torre')
    expect(camera.arrivalKey).toBe('m-torre')
  })

  it('atalho na mesma cena: o desenho com a ficha do outro lado já traz o pedido de pular o deslize (nenhum quadro a mostra voando pela tela)', () => {
    snapshot(torre(100, 100))
    const antes = camera.seq
    desenhos.length = 0
    act(() => mestre().manda({ type: 'scene.changed', tokenId: 'gabi' }))
    snapshot(torre(700, 700))
    const primeiro = desenhos.find((d) => d.fichaX === 700)
    expect(primeiro, 'a PlayerView deveria ter desenhado a ficha do outro lado').toBeDefined()
    expect(primeiro?.seq).toBe(antes + 1)
    expect(primeiro?.snap).toBe(true)
  })

  it('levado a outro andar com a aba de um terceiro aberta: a tela volta ao andar ao vivo no mesmo desenho em que a chegada muda', () => {
    const segundoAndar = createEmptyMap('m-torre-2f', '', 20, 20, 50)
    snapshot(torre(100, 100), { atual: '1F', outros: [lembranca('2F', segundoAndar), lembranca('B1', SUBSOLO)] })
    tocar(botao('button[aria-label="2F"]'))
    expect(camera.mapId).toBe('m-torre-2f')
    desenhos.length = 0
    // O mestre leva a ficha ao subsolo: o andar ao vivo agora é o B1.
    const terreo = createEmptyMap('m-torre', '', 20, 20, 50)
    snapshot({ ...SUBSOLO, tokens: [ficha(100, 100)] }, { atual: 'B1', outros: [lembranca('1F', terreo), lembranca('2F', segundoAndar)] })
    expect(camera.mapId).toBe('m-torre-b1')
    expect(camera.arrivalKey).toBe('m-torre-b1')
    // Nenhum desenho da memória da aba velha com a chegada nova: a PlayerView
    // recebe a chegada junto com a troca de mapa, e é essa troca que ganha o véu.
    expect(desenhos.filter((d) => d.mapId === 'm-torre-2f')).toEqual([])
  })
})
