import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayerInfo } from '../net/hostSession'
import type { Pin, Token } from '../types/map'

/*
 * "Levar para…" tem de estar no painel de propriedades DE VERDADE, na seção da
 * ficha selecionada, com a ligação que o App passa em `tokenCarry`
 * (`ligacaoLevarFicha`): as cenas que abriram MENOS a aberta, as fichas com
 * dono tiradas dos jogadores da sala e o `levarFichaPara` das stores. Montar o
 * `TokenCarryControls` solto, com props inventadas, não prova nada disso:
 * tirá-lo do painel, ou deixar a cena aberta na lista, deixaria aquele teste
 * verde.
 */

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

const { useAdventureStore, hostWorldOf } = await import('../stores/adventureStore')
const { useMapStore } = await import('../stores/mapStore')
const { useSessionStore } = await import('../stores/sessionStore')
const { useToastStore } = await import('../stores/toastStore')
const { ligacaoLevarFicha, levarFichaPara } = await import('../stores/levarFicha')
const { createEmptyMap, addPin } = await import('../lib/mapFactory')
const { arrivalSpot } = await import('../lib/pinTravel')
const { partyDestinations, PARTY_CENTER_LABEL } = await import('../lib/party')
const { PropertiesPanel } = await import('./PropertiesPanel')
const { propsDoPainel } = await import('./propertiesPanelTestProps')
const { CARRY_OWNED_HINT, CARRY_TO_LABEL } = await import('./TokenCarryControls')

const ALCAPAO: Pin = { id: 'alcapao', x: 1500, y: 900, kind: 'viagem', description: 'Alçapão', image: null, destino: null }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

/** Diego joga com a ficha `diego`; o zumbi não é de ninguém. */
const DIEGO: PlayerInfo = {
  clientId: 'c-diego',
  playerId: 'p-diego',
  name: 'Diego',
  status: 'playing',
  connected: true,
  tokenIds: ['diego'],
  visionRadius: 5,
}

/** Porão aberto (Diego e o zumbi); Térreo (com o alçapão) e Sótão de fundo. */
function montarAventura(): { porao: string; terreo: string; sotao: string } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_porao', 'Porão', 30, 20, 64))
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('diego', 192, 320))
  useMapStore.getState().addToken(ficha('zumbi', 320, 320, { name: 'Zumbi', npc: true }))
  const terreo = useAdventureStore.getState().createScene('Térreo', null)
  const sotao = useAdventureStore.getState().createScene('Sótão', null)
  const porao = useAdventureStore.getState().adventure?.scenes[0]?.id ?? ''
  useAdventureStore.getState().switchScene(porao)
  useAdventureStore.getState().updateBackgroundScene(terreo, (map) => addPin(map, ALCAPAO))
  return { porao, terreo, sotao }
}

function tokensDaCena(sceneId: string): Token[] {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map.tokens
  const slot = cache[sceneId]
  return slot?.status === 'ok' ? slot.map.tokens : []
}

/** A ligação exatamente como o App monta: o mundo do host e os jogadores da sala. */
function ligacaoDoApp(players: PlayerInfo[]) {
  return ligacaoLevarFicha(hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map), players)
}

describe('"Levar para…" no painel de propriedades', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useToastStore.setState({ toasts: [] })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function fichaNoMapa(id: string): Token {
    const achada = useMapStore.getState().map.tokens.find((t) => t.id === id)
    if (achada === undefined) throw new Error(`ficha ${id} não está no mapa aberto`)
    return achada
  }

  /** Renderiza o painel com a ficha selecionada e a ligação `tokenCarry` do App. */
  function renderPainel(id: string, players: PlayerInfo[]): void {
    const props = propsDoPainel(fichaNoMapa(id), { tokenCarry: ligacaoDoApp(players) })
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => b.textContent === nome)
  }

  function escolher(select: HTMLSelectElement, valor: string): void {
    act(() => {
      select.value = valor
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  it('a ligação do App: destinos sem a cena aberta, dono tirado dos jogadores e o levarFichaPara das stores', () => {
    const { porao, terreo, sotao } = montarAventura()
    const mundo = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
    // O mundo do host tem a cena aberta: é o filtro da ligação que a tira.
    expect(partyDestinations(mundo).map((d) => d.sceneId)).toContain(porao)

    const ligacao = ligacaoDoApp([DIEGO])
    expect(ligacao.destinations.map((d) => d.sceneId)).toEqual([terreo, sotao])
    expect([...ligacao.ownedTokenIds]).toEqual(['diego'])
    expect(ligacao.onCarry).toBe(levarFichaPara)
  })

  it('zumbi selecionado: o painel tem "Levar para…", a lista não tem a cena aberta, e "Levar" o põe ao lado do alçapão do Térreo', () => {
    const { porao, terreo } = montarAventura()
    const nomeDoPorao = useAdventureStore.getState().adventure?.scenes.find((s) => s.id === porao)?.name
    expect(nomeDoPorao).toBeDefined()
    renderPainel('zumbi', [DIEGO])

    const abrir = botao(CARRY_TO_LABEL)
    expect(abrir).toBeDefined()
    act(() => abrir?.click())
    const form = container.querySelector('form[aria-label="Levar Zumbi para outra cena"]')
    expect(form).not.toBeNull()
    const [cena, chegada] = Array.from(form?.querySelectorAll('select') ?? [])
    if (cena === undefined || chegada === undefined) throw new Error('faltam as listas de cena e chegada')
    const cenas = Array.from(cena.options).map((o) => o.textContent)
    expect(cenas).toEqual(['Térreo', 'Sótão'])
    expect(cenas).not.toContain(nomeDoPorao)
    expect(Array.from(chegada.options).map((o) => o.textContent)).toEqual([PARTY_CENTER_LABEL, 'Alçapão'])

    const slot = useAdventureStore.getState().cache[terreo]
    if (slot?.status !== 'ok') throw new Error('o Térreo deveria estar de fundo')
    const esperado = arrivalSpot(slot.map, ALCAPAO, 1)
    escolher(chegada, 'alcapao')
    act(() => botao('Levar')?.click())

    expect(tokensDaCena(porao).map((t) => t.id)).toEqual(['diego'])
    expect(tokensDaCena(terreo).filter((t) => t.id === 'zumbi').map((t) => [t.name, t.x, t.y])).toEqual([['Zumbi', esperado.x, esperado.y]])
    expect(useToastStore.getState().toasts.map((a) => a.text)).toEqual(['Zumbi foi para Térreo'])
  })

  it('ficha do Diego (dono na sala): o painel não oferece "Levar para…" e aponta o "Mandar para…" do Grupo', () => {
    montarAventura()
    renderPainel('diego', [DIEGO])
    expect(botao(CARRY_TO_LABEL)).toBeUndefined()
    expect(container.textContent).toContain(CARRY_OWNED_HINT)
  })

  it('a mesma ficha, sem jogador na sala com ela, ganha "Levar para…"', () => {
    montarAventura()
    renderPainel('diego', [])
    expect(botao(CARRY_TO_LABEL)).toBeDefined()
    expect(container.textContent).not.toContain(CARRY_OWNED_HINT)
  })

  it('mapa solto (sem aventura): o painel da ficha abre sem "Levar para…"', () => {
    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap(createEmptyMap('m-solto', 'Casa', 20, 20, 64))
    useMapStore.getState().addToken(ficha('zumbi', 320, 320, { name: 'Zumbi' }))
    renderPainel('zumbi', [])

    expect(ligacaoDoApp([]).destinations).toEqual([])
    // O painel da ficha está lá (o interruptor de NPC dela aparece): só o "Levar para…" falta.
    expect(container.textContent).toContain('Ficha de NPC')
    expect(botao(CARRY_TO_LABEL)).toBeUndefined()
  })
})
