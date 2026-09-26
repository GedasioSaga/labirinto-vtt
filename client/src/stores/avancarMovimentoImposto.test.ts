/**
 * O AVANÇAR com a cabine que leva ao PAR, com as stores de verdade: o poço do
 * Térreo liga ao poço do Porão. Quem ficou parado no poço troca de cena — o
 * zumbi (sem dono) pelo "Levar para…", a ficha do jogador pelo "Mandar
 * para…" da sessão, com a ficha exata. Par que sumiu não leva ninguém calado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin, Token } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => ''),
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
const { useToastStore } = await import('./toastStore')
const { avancarMovimentoImposto, cabinFailureText, ownerFromPlayers } = await import('./avancarMovimentoImposto')
const { createEmptyMap, addPin } = await import('../lib/mapFactory')
const { arrivalSpot } = await import('../lib/pinTravel')

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

/** Térreo aberto com o poço (cabine ligada ao par) e o Porão de fundo com o par. */
function montar(): { terreo: string; porao: string; parNoPorao: Pin } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_terreo', 'Térreo', 30, 20, 64))
  useSessionStore.getState().markSaved()
  const porao = useAdventureStore.getState().createScene('Porão', null)
  const terreo = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(terreo)
  const parNoPorao: Pin = { id: 'poco-porao', x: 1000, y: 600, kind: 'viagem', description: '', image: null, destino: { sceneId: terreo, pinId: 'poco' } }
  useAdventureStore.getState().updateBackgroundScene(porao, (map) => addPin(map, parNoPorao))
  useMapStore.getState().addPin({
    id: 'poco',
    x: 96,
    y: 96,
    kind: 'viagem',
    description: 'Poço',
    image: null,
    destino: { sceneId: porao, pinId: 'poco-porao' },
    cabineContinua: 'poco-porao',
  })
  useMapStore.getState().addToken(ficha('zumbi', 96, 96, { name: 'Zumbi', npc: true }))
  useMapStore.getState().addToken(ficha('longe', 600, 600))
  return { terreo, porao, parNoPorao }
}

function tokensDe(sceneId: string): string[] {
  const slot = useAdventureStore.getState().cache[sceneId]
  return slot !== undefined && slot.status === 'ok' ? slot.map.tokens.map((t) => t.id) : []
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('avancarMovimentoImposto — a cabine leva ao par, em outra cena', () => {
  it('o zumbi parado no poço vai ao par no Porão; quem não está no poço fica', () => {
    const { porao, parNoPorao } = montar()
    const sendPlayer = vi.fn(() => true)
    expect(avancarMovimentoImposto(new Map(), { ownerOf: () => null, sendPlayer })).toBe(0)
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['longe'])
    const slot = useAdventureStore.getState().cache[porao]
    const zumbi = slot?.status === 'ok' ? slot.map.tokens.find((t) => t.id === 'zumbi') : undefined
    // A casa que o "Levar para…" escolheu: a do par, sem contar o próprio zumbi que já chegou nela.
    const esperado = arrivalSpot(slot?.status === 'ok' ? slot.map : createEmptyMap('x', 'x', 1, 1, 64), parNoPorao, 1, 'zumbi')
    expect(zumbi).toMatchObject({ name: 'Zumbi', x: esperado.x, y: esperado.y })
    expect(sendPlayer).not.toHaveBeenCalled()
  })

  it('a ficha do jogador vai pela sessão, com a ficha exata, e não pelo "Levar para…"', () => {
    const { porao } = montar()
    const sendPlayer = vi.fn(() => true)
    const ownerOf = ownerFromPlayers([{ playerId: 'p-ana', tokenIds: ['zumbi'] }])
    expect(avancarMovimentoImposto(new Map(), { ownerOf, sendPlayer })).toBe(0)
    expect(sendPlayer).toHaveBeenCalledWith('p-ana', porao, 'poco-porao', 'zumbi')
    // Quem move a ficha é a sessão (aqui, falsa): a cena aberta não a tirou por conta própria.
    expect(tokensDe(porao)).toEqual([])
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toContain('zumbi')
  })

  it('par que sumiu da outra cena: ninguém muda de cena e o mestre é avisado', () => {
    const { porao } = montar()
    useAdventureStore.getState().updateBackgroundScene(porao, (map) => ({ ...map, pins: [] }))
    expect(avancarMovimentoImposto(new Map(), { ownerOf: () => null, sendPlayer: vi.fn(() => true) })).toBe(1)
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toContain('zumbi')
    expect(useToastStore.getState().toasts.map((t) => t.text)).toContain(cabinFailureText(1))
  })

  it('sem ninguém no poço, o Avançar não leva ninguém nem avisa', () => {
    montar()
    useMapStore.getState().setTokenPosition('zumbi', 600, 96)
    expect(avancarMovimentoImposto(new Map(), { ownerOf: () => null, sendPlayer: vi.fn(() => true) })).toBe(0)
    expect(useToastStore.getState().toasts).toEqual([])
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['zumbi', 'longe'])
  })
})
