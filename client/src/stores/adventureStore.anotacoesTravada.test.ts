/**
 * ESCADA, VIAGEM E PASSAGEM COM ANOTAÇÕES TRAVADA (fase 3, fatia 5, revisão).
 * O cadeado do pino é do GESTO do mestre (ferramenta Pino, arrasto, Delete);
 * o pino de uma escada segue a escada (camada Escadas, livre) e mudar a
 * passagem é estado de sessão, não mover. Num mapa antigo com Anotações
 * travada, ligar, desligar e mudar a passagem funcionam inteiros, nas duas
 * cenas, sem escada órfã do outro lado e sem aviso de camada.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Pin, Stair } from '../types/map'

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

const { useAdventureStore, subscribeToTravelLinks } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { useToastStore } = await import('./toastStore')
const { buildPin, createEmptyMap } = await import('../lib/mapFactory')
const { setPinPassageFromRequest } = await import('../net/pinPassageFromRequest')

subscribeToTravelLinks()

const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 400, y1: 300, x2: 400, y2: 180 }], stepWidth: 64 }
/** Trancado: o jogador pede passagem e o mestre aceita "Passar para pede" (ausente já É "pede"). */
const PORTAL: Pin = { ...buildPin('portal', { x: 100, y: 500 }, 'viagem'), passagem: 'trancada' }

/** Térreo aberto com a escada e um pino de viagem, a Praça de fundo, e Anotações travada (mapa antigo, sem `versaoDasCamadas`). */
function montar(): { terreo: string; praca: string } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Térreo', 30, 20, 64))
  useSessionStore.getState().markSaved()
  useAdventureStore.getState().createScene('Praça', null)
  const cenas = useAdventureStore.getState().adventure?.scenes ?? []
  const terreo = cenas[0]?.id ?? ''
  const praca = cenas[1]?.id ?? ''
  useAdventureStore.getState().switchScene(terreo)
  useMapStore.getState().addStair(ESCADA)
  useMapStore.getState().addPin(PORTAL)
  useMapStore.setState((s) => ({ map: { ...s.map, lockedLayers: ['anotacoes'] } }))
  useToastStore.setState({ toasts: [] })
  return { terreo, praca }
}

function mapaDoFundo(sceneId: string): MapData {
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error(`cena ${sceneId} fora do cache`)
  return slot.map
}

function pinoDaEscada(map: MapData, stairId: string): Pin | undefined {
  return map.pins.find((p) => p.escadaId === stairId)
}

function aqui(): MapData {
  return useMapStore.getState().map
}

function avisosDeCamada(): string[] {
  return useToastStore
    .getState()
    .toasts.map((aviso) => aviso.text)
    .filter((texto) => texto.includes('travada'))
}

/** O par do outro lado existe: escada par e o pino dela, e o pino daqui aponta para ele. */
function ligadaNasDuasCenas(sceneId: string): void {
  const meu = pinoDaEscada(aqui(), ESCADA.id)
  expect(meu?.destino?.sceneId).toBe(sceneId)
  const la = mapaDoFundo(sceneId)
  const par = la.pins.find((p) => p.id === meu?.destino?.pinId)
  expect(par).toBeDefined()
  expect(la.stairs.some((s) => s.id === par?.escadaId)).toBe(true)
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('Anotações travada no mapa antigo: os fluxos de escada, viagem e passagem funcionam', () => {
  it('o mapa está mesmo com Anotações travada e sem versão das camadas', () => {
    montar()
    expect(aqui().lockedLayers).toEqual(['anotacoes'])
    expect(aqui().versaoDasCamadas).toBeUndefined()
  })

  it('criar o andar a partir da escada liga as duas pontas, sem escada órfã', () => {
    montar()
    const novo = useAdventureStore.getState().createFloorFromStair(ESCADA.id, 'livre')
    if (novo === null) throw new Error('não criou o andar')
    ligadaNasDuasCenas(novo)
    expect(avisosDeCamada()).toEqual([])
  })

  it('ligar a escada a uma cena que já existe grava o pino daqui e o par de lá', () => {
    const { praca } = montar()
    expect(useAdventureStore.getState().linkStairToFloor(ESCADA.id, praca, 'livre')).not.toBeNull()
    ligadaNasDuasCenas(praca)
    expect(avisosDeCamada()).toEqual([])
  })

  it('mudar a passagem da escada e desligá-la funcionam', () => {
    const { praca } = montar()
    useAdventureStore.getState().linkStairToFloor(ESCADA.id, praca, 'livre')
    useAdventureStore.getState().setStairPassage(ESCADA.id, 'pede')
    expect(pinoDaEscada(aqui(), ESCADA.id)?.passagem).toBe('pede')
    useAdventureStore.getState().unlinkStair(ESCADA.id)
    expect(pinoDaEscada(aqui(), ESCADA.id)).toBeUndefined()
    expect(avisosDeCamada()).toEqual([])
  })

  it('ligar o pino de viagem a uma chegada nova grava a ida aqui e a chegada lá', () => {
    const { praca } = montar()
    const chegada = useAdventureStore.getState().linkPinToNewArrival(PORTAL.id, praca)
    if (chegada === null) throw new Error('não ligou')
    expect(aqui().pins.find((p) => p.id === PORTAL.id)?.destino).toEqual({ sceneId: praca, pinId: chegada })
    expect(mapaDoFundo(praca).pins.some((p) => p.id === chegada)).toBe(true)
    expect(avisosDeCamada()).toEqual([])
  })

  it('aceitar "Passar para pede" do jogador muda a passagem na cena aberta', () => {
    const { praca } = montar()
    // O pedido só existe num pino ligado: o jogador pede para atravessar ele.
    useAdventureStore.getState().linkPinToNewArrival(PORTAL.id, praca)
    setPinPassageFromRequest(PORTAL.id, 'pede')
    expect(aqui().pins.find((p) => p.id === PORTAL.id)?.passagem).toBe('pede')
    expect(avisosDeCamada()).toEqual([])
  })
})
