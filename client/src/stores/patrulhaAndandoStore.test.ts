/**
 * PATRULHA ANDANDO no editor do mestre: "Patrulhar sozinha" faz a ficha andar
 * pelo relógio, sem aventura aberta, fora do Ctrl+Z; a pausa geral dos NPCs
 * congela patrulha e rotina e retoma de onde parou.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Token } from '../types/map'

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
const { usePatrulhaAndandoStore } = await import('./patrulhaAndandoStore')
const { usePausaDosNpcsStore } = await import('./pausaDosNpcsStore')
const { alternarPausaDosNpcs } = await import('./npcsAndando')
const { createEmptyMap } = await import('../lib/mapFactory')
const { ESPERA_NO_PONTO_MS, PASSO_DA_PATRULHA_MS } = await import('../lib/patrulhaAndando')
const { passoEmPx } = await import('../lib/rotinaAndando')

const GRID = 50
const PASSO = passoEmPx(GRID, 2)

function guarda(): Token {
  return {
    id: 'guarda',
    characterId: null,
    name: 'Guarda',
    x: 100,
    y: 100,
    size: 1,
    image: null,
    npc: true,
    patrulha: { pontos: [{ x: 100, y: 100 }, { x: 300, y: 100 }], atual: 0 },
  }
}

function montar(): void {
  const map: MapData = { ...createEmptyMap('m', 'Mapa solto', 30, 20, GRID), tokens: [guarda()] }
  useMapStore.getState().loadMap(map)
}

function ondeEsta(): { x: number; y: number; atual: number | undefined } {
  const t = useMapStore.getState().map.tokens.find((token) => token.id === 'guarda')
  if (t === undefined) throw new Error('sem o guarda')
  return { x: t.x, y: t.y, atual: t.patrulha?.atual }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  montar()
})

afterEach(() => {
  usePatrulhaAndandoStore.getState().reset()
  usePatrulhaAndandoStore.getState().setArrastadas(new Set())
  usePausaDosNpcsStore.getState().retomar()
  vi.useRealTimers()
})

describe('patrulha andando no editor', () => {
  it('sem aventura aberta, anda um passo por tique e chega ao ponto, fora do Ctrl+Z', () => {
    expect(useAdventureStore.getState().adventure).toBeNull()
    const historico = useMapStore.getState().past.length
    usePatrulhaAndandoStore.getState().ligar('guarda')
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS)
    expect(ondeEsta()).toMatchObject({ x: 100 + PASSO, y: 100 })
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS * 10)
    expect(ondeEsta()).toEqual({ x: 300, y: 100, atual: 1 })
    expect(useMapStore.getState().past.length).toBe(historico)
  })

  it('ficha arrastada pelo mestre não anda; solta, segue', () => {
    usePatrulhaAndandoStore.getState().ligar('guarda')
    usePatrulhaAndandoStore.getState().setArrastadas(new Set(['guarda']))
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS * 3)
    expect(ondeEsta()).toMatchObject({ x: 100, y: 100 })
    usePatrulhaAndandoStore.getState().setArrastadas(new Set())
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS)
    expect(ondeEsta().x).toBe(100 + PASSO)
  })

  it('ficha removida do mapa: a patrulha desliga sozinha', () => {
    usePatrulhaAndandoStore.getState().ligar('guarda')
    useMapStore.getState().loadMap({ ...createEmptyMap('m2', 'Outro', 30, 20, GRID), tokens: [] })
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS)
    expect(usePatrulhaAndandoStore.getState().andando.size).toBe(0)
  })

  it('abrir outro mapa para todo mundo', () => {
    usePatrulhaAndandoStore.getState().ligar('guarda')
    useAdventureStore.getState().reset()
    expect(usePatrulhaAndandoStore.getState().andando.size).toBe(0)
  })

  it('pausa geral: congela e retoma de onde parou, terminando a espera no ponto', () => {
    usePatrulhaAndandoStore.getState().ligar('guarda')
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS)
    alternarPausaDosNpcs()
    expect(usePausaDosNpcsStore.getState().pausadaDesde).not.toBeNull()
    const parada = ondeEsta()
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS * 20)
    expect(ondeEsta()).toEqual(parada)
    alternarPausaDosNpcs()
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS)
    expect(ondeEsta().x).toBe(parada.x + PASSO)

    // Chega ao ponto e pausa no meio da espera: retomar não encurta a espera.
    while (ondeEsta().atual !== 1) vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS)
    const chegada = Date.now()
    expect(ondeEsta().x).toBe(300)
    const PAUSA = ESPERA_NO_PONTO_MS * 5
    vi.advanceTimersByTime(ESPERA_NO_PONTO_MS / 2)
    alternarPausaDosNpcs()
    vi.advanceTimersByTime(PAUSA)
    alternarPausaDosNpcs()
    // Falta metade da espera: um tique antes do fim, ainda parado no ponto.
    vi.advanceTimersByTime(chegada + ESPERA_NO_PONTO_MS + PAUSA - PASSO_DA_PATRULHA_MS - Date.now())
    expect(ondeEsta().x).toBe(300)
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS * 2)
    expect(ondeEsta().x).toBeLessThan(300)
  })

  it('sem ninguém andando não pausa; o último parar solta a pausa', () => {
    alternarPausaDosNpcs()
    expect(usePausaDosNpcsStore.getState().pausadaDesde).toBeNull()
    usePatrulhaAndandoStore.getState().ligar('guarda')
    alternarPausaDosNpcs()
    expect(usePausaDosNpcsStore.getState().pausadaDesde).not.toBeNull()
    usePatrulhaAndandoStore.getState().desligar('guarda')
    expect(usePausaDosNpcsStore.getState().pausadaDesde).toBeNull()
  })
})

describe('macro do ponto no editor', () => {
  function comPassos(passos: NonNullable<NonNullable<Token['patrulha']>['pontos'][number]['passos']>): void {
    const g = guarda()
    const rota = g.patrulha
    if (rota === undefined) throw new Error('sem rota')
    const pontos = [rota.pontos[0] ?? { x: 100, y: 100 }, { x: 300, y: 100, passos }]
    useMapStore.getState().loadMap({ ...createEmptyMap('m', 'Mapa solto', 30, 20, GRID), tokens: [{ ...g, patrulha: { ...rota, pontos } }] })
  }

  it('"Esperar o mestre": a ficha para no ponto e "Seguir" a solta; falou, e parar cala', () => {
    comPassos([{ tipo: 'falar', texto: 'Alto!' }, { tipo: 'esperarMestre' }])
    usePatrulhaAndandoStore.getState().ligar('guarda')
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS * 12)
    expect(ondeEsta()).toMatchObject({ x: 300, atual: 1 })
    expect(useMapStore.getState().map.tokens[0]?.fala).toBe('Alto!')
    expect(usePatrulhaAndandoStore.getState().andando.get('guarda')?.esperandoMestre).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(ondeEsta().x).toBe(300)
    usePatrulhaAndandoStore.getState().seguir('guarda')
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS)
    expect(ondeEsta().x).toBeLessThan(300)
    // Voltou a andar: calou.
    expect(useMapStore.getState().map.tokens[0]).not.toHaveProperty('fala')
  })

  it('"Parar" no meio da fala: a ficha para e cala', () => {
    comPassos([{ tipo: 'falar', texto: 'Alto!' }, { tipo: 'esperar', segundos: 30 }])
    usePatrulhaAndandoStore.getState().ligar('guarda')
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS * 12)
    expect(useMapStore.getState().map.tokens[0]?.fala).toBe('Alto!')
    const historico = useMapStore.getState().past.length
    usePatrulhaAndandoStore.getState().desligar('guarda')
    expect(useMapStore.getState().map.tokens[0]).not.toHaveProperty('fala')
    expect(useMapStore.getState().past.length).toBe(historico)
  })

  it('pausa geral congela a espera de um passo e retoma de onde parou', () => {
    comPassos([{ tipo: 'esperar', segundos: 3 }])
    usePatrulhaAndandoStore.getState().ligar('guarda')
    while (ondeEsta().atual !== 1) vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS)
    const chegada = Date.now()
    vi.advanceTimersByTime(1000)
    alternarPausaDosNpcs()
    vi.advanceTimersByTime(10_000)
    alternarPausaDosNpcs()
    vi.advanceTimersByTime(chegada + 3000 + 10_000 - PASSO_DA_PATRULHA_MS - Date.now())
    expect(ondeEsta().x).toBe(300)
    vi.advanceTimersByTime(PASSO_DA_PATRULHA_MS * 2)
    expect(ondeEsta().x).toBeLessThan(300)
  })

  it('o ponto aberto no painel fica no store (destaque no mapa)', () => {
    usePatrulhaAndandoStore.getState().abrirPonto({ tokenId: 'guarda', indice: 1 })
    expect(usePatrulhaAndandoStore.getState().pontoAberto).toEqual({ tokenId: 'guarda', indice: 1 })
    usePatrulhaAndandoStore.getState().abrirPonto(null)
    expect(usePatrulhaAndandoStore.getState().pontoAberto).toBeNull()
  })
})
