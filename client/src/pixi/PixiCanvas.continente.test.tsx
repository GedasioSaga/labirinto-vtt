import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { useDonosDasFichasStore } from '../stores/donosDasFichasStore'
import { useToastStore } from '../stores/toastStore'
import type { PlayerInfo } from '../net/hostSession'
import type { MapData, Region, Token } from '../types/map'
import { MARCADOR_LABEL } from './vistaDoMarcador'
import { PixiCanvas } from './PixiCanvas'

/**
 * MAPA DE CONTINENTE com o PixiCanvas MONTADO — a fiação que os testes soltos
 * não veem: trocar o "Tipo de mapa" e a posse da sala repinta a ficha como
 * pino (e de volta), e o clique na CABEÇA do pino, com a camada Fichas
 * travada, é barrado em vez de pegar a sala de baixo.
 *
 * Mesmo arranjo sem navegador de `PixiCanvas.objetos.test.tsx`: só o
 * `Application` (pede WebGL) e a medida do texto (sem canvas 2d) são trocados.
 */

const tela = vi.hoisted(() => {
  const palcos: Container[] = []
  return { palcos, largura: 1200, altura: 800 }
})

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
    readonly renderer = Object.assign(new pixi.EventEmitter(), { resolution: 1 })
    readonly ticker = { add: () => {}, remove: () => {} }
    readonly canvas = document.createElement('canvas')
    constructor() {
      tela.palcos.push(this.stage)
    }
    async init(): Promise<void> {}
    resize(): void {}
    destroy(): void {
      this.canvas.remove()
    }
  }
  class TextSemMedida extends pixi.Text {
    protected override updateBounds(): void {
      this._bounds.set(0, 0, 40, 14)
    }
  }
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

const GRADE = 50
const BOTAO_ESQUERDO = 0

const SALA: Region = {
  id: 'sala',
  points: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
  ],
  tag: '',
  fillColor: '#3a7ad0',
  fillPattern: 'solid',
  data: {},
}

const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 500, y: 500, size: 1, image: null }

function mapa(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m_canvas_continente', 'Mundo', 80, 60, GRADE), regions: [SALA], tokens: [ANA], ...extra }
}

function jogadorCom(tokenIds: string[]): PlayerInfo {
  return { clientId: 'c1', playerId: 'p1', name: 'Bia', status: 'playing', connected: true, tokenIds, visionRadius: 400, visionFactor: 1 }
}

let raiz: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  tela.palcos.length = 0
  useDonosDasFichasStore.getState().clear()
  useToastStore.setState({ toasts: [] })
  useMapStore.setState({ map: mapa(), selection: [], past: [], future: [], activeTool: 'select', camera: { x: 0, y: 0, scale: 1 } })
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
  root = createRoot(raiz)
})

afterEach(() => {
  act(() => root.unmount())
  raiz.remove()
  useDonosDasFichasStore.getState().clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function monta(): Promise<void> {
  const exportador = vi.fn()
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
}

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('o PixiCanvas não criou o Application')
  return p
}

/** O pino À VISTA no palco (a raiz com `MARCADOR_LABEL` visível), ou `undefined`. */
function pinoVisivel(): Container | undefined {
  const pilha: Container[] = [palco()]
  for (let atual = pilha.pop(); atual !== undefined; atual = pilha.pop()) {
    if (atual.label === MARCADOR_LABEL && atual.visible) return atual
    pilha.push(...atual.children)
  }
  return undefined
}

function aperta(mundo: { x: number; y: number }): void {
  const camera = useMapStore.getState().camera
  const p = { x: camera.x + mundo.x * camera.scale, y: camera.y + mundo.y * camera.scale }
  const evento = (): FederatedPointerEvent => {
    const e = new FederatedPointerEvent(new EventBoundary())
    e.pointerType = 'mouse'
    e.pointerId = 1
    e.isPrimary = true
    e.button = BOTAO_ESQUERDO
    e.global.set(p.x, p.y)
    return e
  }
  act(() => {
    palco().emit('pointerdown', evento())
  })
  act(() => {
    palco().emit('pointerup', evento())
  })
}

/** Ponteiro do mouse num ponto de TELA. */
function ponteiroEm(tela: { x: number; y: number }): FederatedPointerEvent {
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.button = BOTAO_ESQUERDO
  e.global.set(tela.x, tela.y)
  return e
}

/** Aperta em `de`, anda em passos até `ate` e solta (pontos de MUNDO). */
function arrasta(de: { x: number; y: number }, ate: { x: number; y: number }): void {
  const camera = useMapStore.getState().camera
  const naTela = (m: { x: number; y: number }) => ({ x: camera.x + m.x * camera.scale, y: camera.y + m.y * camera.scale })
  const PASSOS = 8
  act(() => {
    palco().emit('pointerdown', ponteiroEm(naTela(de)))
  })
  for (let i = 1; i <= PASSOS; i += 1) {
    const t = i / PASSOS
    act(() => {
      palco().emit('pointermove', ponteiroEm(naTela({ x: de.x + (ate.x - de.x) * t, y: de.y + (ate.y - de.y) * t })))
    })
  }
  act(() => {
    palco().emit('pointerup', ponteiroEm(naTela(ate)))
  })
}

describe('PixiCanvas — mapa de continente', () => {
  it('a posse da sala e o "Tipo de mapa" repintam a ficha: disco, pino, disco', async () => {
    useMapStore.setState({ map: mapa({ continente: true }) })
    await monta()
    // Sem sala aberta ninguém é dono de nada: a ficha é disco.
    expect(pinoVisivel()).toBeUndefined()
    act(() => useDonosDasFichasStore.getState().setFromPlayers([jogadorCom(['ana'])]))
    expect(pinoVisivel()).toBeDefined()
    act(() => useMapStore.getState().setTipoDeMapa('normal'))
    expect(pinoVisivel()).toBeUndefined()
    act(() => useMapStore.getState().setTipoDeMapa('continente'))
    expect(pinoVisivel()).toBeDefined()
  })

  it('o clique na cabeça do pino seleciona a ficha', async () => {
    useMapStore.setState({ map: mapa({ continente: true }) })
    act(() => useDonosDasFichasStore.getState().setFromPlayers([jogadorCom(['ana'])]))
    await monta()
    // A sala grande abre o mapa com zoom bem abaixo de 100%: 40 px de tela acima
    // do ponto caem longe do disco (raio 25 de mundo), só a cabeça do pino está ali.
    expect(40 / useMapStore.getState().camera.scale).toBeGreaterThan(GRADE)
    const escala = useMapStore.getState().camera.scale
    aperta({ x: ANA.x, y: ANA.y - 40 / escala })
    expect(useMapStore.getState().selection).toEqual([{ kind: 'token', id: 'ana' }])
  })

  it('arrastar o pino pela cabeça mantém o deslocamento do ponteiro: o pé não pula para o dedo', async () => {
    useMapStore.setState({ map: mapa({ continente: true }) })
    const imaAntes = useMapStore.getState().snapTargets
    // Sem ímã de grade: a conta fica exata (com ímã, a ficha assenta na célula de qualquer jeito).
    useMapStore.getState().setSnapEnabled(false)
    act(() => useDonosDasFichasStore.getState().setFromPlayers([jogadorCom(['ana'])]))
    try {
      await monta()
      const escala = useMapStore.getState().camera.scale
      // Pega pela cabeça, 40 px de TELA acima do pé, e anda 120 x 80 px de tela.
      const pegada = { x: ANA.x, y: ANA.y - 40 / escala }
      const passo = { x: 120 / escala, y: 80 / escala }
      arrasta(pegada, { x: pegada.x + passo.x, y: pegada.y + passo.y })
      const ana = useMapStore.getState().map.tokens.find((t) => t.id === ANA.id)
      // A ficha anda o mesmo que o ponteiro; antes, o pé ia parar sob o ponteiro (40 px de tela acima).
      expect(ana?.x).toBeCloseTo(ANA.x + passo.x, 3)
      expect(ana?.y).toBeCloseTo(ANA.y + passo.y, 3)
    } finally {
      useMapStore.setState({ snapTargets: imaAntes })
    }
  })

  it('pino selecionado: apertar onde seria a alça de canto do disco arrasta o pino, não muda o tamanho', async () => {
    useMapStore.setState({ map: mapa({ continente: true }), selection: [{ kind: 'token', id: ANA.id }] })
    act(() => useDonosDasFichasStore.getState().setFromPlayers([jogadorCom(['ana'])]))
    await monta()
    const escala = useMapStore.getState().camera.scale
    // Canto de cima à esquerda da caixa do disco (meia célula), que cai dentro do pino na tela.
    const canto = { x: ANA.x - GRADE / 2, y: ANA.y - GRADE / 2 }
    arrasta(canto, { x: canto.x + 60 / escala, y: canto.y + 60 / escala })
    const ana = useMapStore.getState().map.tokens.find((t) => t.id === ANA.id)
    expect(ana?.size).toBe(1)
    expect(ana?.x).not.toBe(ANA.x)
  })

  it('camada Fichas travada: o clique na cabeça do pino não pega a sala de baixo', async () => {
    useMapStore.setState({ map: mapa({ continente: true, lockedLayers: ['tokens'] }) })
    act(() => useDonosDasFichasStore.getState().setFromPlayers([jogadorCom(['ana'])]))
    await monta()
    // A sala grande abre o mapa com zoom bem abaixo de 100%: 40 px de tela acima
    // do ponto caem longe do disco (raio 25 de mundo), só a cabeça do pino está ali.
    expect(40 / useMapStore.getState().camera.scale).toBeGreaterThan(GRADE)
    const escala = useMapStore.getState().camera.scale
    // 40 px de TELA acima do ponto da ficha: fora do disco, dentro do pino.
    aperta({ x: ANA.x, y: ANA.y - 40 / escala })
    expect(useMapStore.getState().selection).toEqual([])
    // O gesto parou na trava, com o aviso — não passou direto para a sala.
    expect(useToastStore.getState().toasts.map((t) => t.chave)).toContain('camada-travada:tokens')
  })
})
