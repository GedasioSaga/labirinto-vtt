/**
 * ROTINA POR PERÍODO no editor (Caminhos F3): o relógio da rotina lê o
 * período da SESSÃO a cada tique (`periodoDaSessao`). Na cena externa, o
 * mestre troca para noite e o NPC que ia ao posto do dia vira, a pé, para o da
 * noite; na cena interior a troca não muda nada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Point } from '../pixi/world'
import type { Token } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco neste teste')
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { useRotinaAndandoStore } = await import('./rotinaAndandoStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { PASSO_DA_ROTINA_MS, passoEmPx } = await import('../lib/rotinaAndando')

const GRID = 50
const PASSO = passoEmPx(GRID)
const AURORA = { x: 100, y: 100 }
const MEIO = { x: 600, y: 100 }
const BRASA = { x: 100, y: 400 }

function ondeEsta(): Point {
  const t = useMapStore.getState().map.tokens.find((token) => token.id === 'tobias')
  if (t === undefined) throw new Error('o Tobias sumiu do mapa')
  return { x: t.x, y: t.y }
}

/** Praça com o Tobias na Aurora (dia); Meio (dia) a leste e Brasa (noite) ao sul. `externa`: a cena segue a sessão. */
function montar(externa: boolean): void {
  useMapStore.getState().loadMap(createEmptyMap('map_praca', 'Praça', 30, 20, GRID))
  useSessionStore.getState().markSaved()
  const praca = useAdventureStore.getState().createScene('Praça', null)
  const apito = useAdventureStore.getState().criarEstadoDoMundo('Apito', 'Aurora, Meio, Brasa')
  if (apito === null) throw new Error('não criou o estado')
  if (externa) useMapStore.getState().setOutdoor(true)
  const tobias: Token = {
    id: 'tobias',
    characterId: null,
    name: 'Irmão Tobias',
    x: AURORA.x,
    y: AURORA.y,
    size: 1,
    image: null,
    npc: true,
    rotina: {
      estadoId: apito,
      postos: [
        { valor: 'Aurora', sceneId: praca, ...AURORA, periodo: 'dia' },
        { valor: 'Meio', sceneId: praca, ...MEIO, periodo: 'dia' },
        { valor: 'Brasa', sceneId: praca, ...BRASA, periodo: 'noite' },
      ],
    },
  }
  useMapStore.getState().addToken(tobias)
}

/** `n` tiques do relógio: o maior passo dado entre eles. */
function tiques(n: number): number {
  let antes = ondeEsta()
  let maior = 0
  for (let k = 0; k < n; k += 1) {
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    const agora = ondeEsta()
    maior = Math.max(maior, Math.hypot(agora.x - antes.x, agora.y - antes.y))
    antes = agora
  }
  return maior
}

beforeEach(() => {
  vi.useFakeTimers()
  useAdventureStore.getState().reset()
})

afterEach(() => {
  useRotinaAndandoStore.getState().reset()
  vi.useRealTimers()
})

describe('rotina por período no editor', () => {
  it('cena externa: anoitece no meio do caminho e o NPC vira, a pé, para o posto da noite', () => {
    montar(true)
    useRotinaAndandoStore.getState().ligar('tobias')
    const dia = tiques(3)
    expect(ondeEsta()).toEqual({ x: AURORA.x + 3 * PASSO, y: AURORA.y })
    useAdventureStore.getState().setPeriodo('noite')
    const noite = tiques(20)
    expect(ondeEsta()).toEqual(BRASA)
    expect(Math.max(dia, noite)).toBeLessThanOrEqual(PASSO + 1)
  })

  it('cena interior: a noite da sessão não muda a rotina', () => {
    montar(false)
    useRotinaAndandoStore.getState().ligar('tobias')
    tiques(3)
    useAdventureStore.getState().setPeriodo('noite')
    tiques(3)
    expect(ondeEsta()).toEqual({ x: AURORA.x + 6 * PASSO, y: AURORA.y })
  })
})
