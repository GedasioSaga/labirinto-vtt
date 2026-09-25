import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Pin } from '../types/map'

/*
 * ATALHO NA MESMA CENA na TELA do mestre: o "Leva a…" do painel do pino
 * oferece "Esta cena" antes das outras, o passo 2 fala de "outro ponto desta
 * cena" (e não do nome da cena aberta), e depois de ligar o painel diz "Leva a
 * outro ponto desta cena" e "Ir para outro ponto desta cena". O painel é
 * montado com a MESMA ligação do App (`travelDestinationOptions`,
 * `pinTravelOptions`, `linkPinToExisting`…), nas stores de verdade: props
 * inventadas não provariam que o App oferece a opção.
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

const { useAdventureStore, pinExitsTravelOf, pinTravelOptions, subscribeToTravelLinks, travelDestinationOptions } = await import('../stores/adventureStore')
const { useMapStore } = await import('../stores/mapStore')
const { useSessionStore } = await import('../stores/sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { isArrivalOnly, SAIDA_PRINCIPAL } = await import('../lib/pinTravel')
const { passageOf } = await import('../lib/pins')
const { PinTravelControls } = await import('./PinTravelControls')

subscribeToTravelLinks()

function viagem(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 200, y: 200, kind: 'viagem', description: '', image: null, ...extra }
}

function pinoAberto(pinId: string): Pin {
  const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
  if (pin === undefined) throw new Error(`pino ${pinId} não está na cena aberta`)
  return pin
}

/** Torre aberta (numa aventura com a Cripta), com a escada de baixo "a" e a de cima "b", soltas. */
function montar(): { torre: string } {
  useAdventureStore.getState().reset()
  const mapa: MapData = createEmptyMap('map_raiz', 'Torre', 30, 20, 64)
  useMapStore.getState().loadMap(mapa)
  useSessionStore.getState().markSaved()
  useAdventureStore.getState().createScene('Cripta', null)
  const torre = useAdventureStore.getState().adventure?.scenes[0]?.id ?? ''
  useAdventureStore.getState().switchScene(torre)
  useMapStore.getState().addPin(viagem('a', { description: 'Escada do térreo' }))
  useMapStore.getState().addPin(viagem('b', { x: 1400, y: 900, description: 'Escada do topo' }))
  return { torre }
}

describe('PinTravelControls: atalho na mesma cena, com a ligação do App', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  /** O painel do pino `pinId` como o App o monta (`pinTravelPanel`), lido das stores agora. */
  function renderPainel(pinId: string): void {
    const state = useAdventureStore.getState()
    const map = useMapStore.getState().map
    const pin = pinoAberto(pinId)
    const aventura = useAdventureStore.getState
    act(() =>
      root.render(
        <PinTravelControls
          exits={pinExitsTravelOf(state, map, pin)}
          scenes={travelDestinationOptions(state)}
          pinsIn={(sceneId) => pinTravelOptions(state, map, sceneId, pin.id)}
          onLinkNew={(sceneId, exitId) => aventura().linkPinToNewArrival(pin.id, sceneId, exitId)}
          onLinkExisting={(sceneId, partnerId, exitId) => aventura().linkPinToExisting(pin.id, sceneId, partnerId, exitId)}
          onUnlink={(exitId) => aventura().unlinkPin(pin.id, exitId)}
          onRename={(exitId, rotulo) => aventura().renamePinExit(pin.id, exitId, rotulo)}
          onGo={(exitId) => aventura().travelThroughPin(pin.id, exitId)}
          passage={passageOf(pin)}
          onPassageChange={(passagem) => useMapStore.getState().updatePin(pin.id, { passagem })}
          motivo={undefined}
          onMotivoChange={() => {}}
          onOneWayChange={(exitId, on) => aventura().setPinOneWay(pin.id, exitId, on)}
          onBothSidesChange={() => {}}
          arrivalOnly={isArrivalOnly(pin)}
        />,
      ),
    )
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === nome)
    if (achado === undefined) throw new Error(`sem o botão "${nome}"`)
    return achado
  }

  function clicar(nome: string): void {
    act(() => botao(nome).click())
  }

  it('"Leva a…" oferece "Esta cena" primeiro, e o passo 2 fala do outro ponto desta cena', () => {
    montar()
    renderPainel('a')
    clicar('Leva a…')
    const cenas = Array.from(container.querySelectorAll<HTMLButtonElement>('.lb-travel__choice')).map((b) => b.textContent)
    expect(cenas).toEqual(['Esta cena', 'Cripta'])
    clicar('Esta cena')
    expect(container.textContent).toContain('Chegada em outro ponto desta cena')
    expect(container.textContent).toContain('Nasce ao lado deste pino, já ligado de volta; arraste até o outro ponto.')
    expect(container.textContent).toContain('Ou um pino de viagem que já está aqui')
    // O próprio pino não é par de si mesmo: só a escada de cima aparece.
    const pinos = Array.from(container.querySelectorAll<HTMLButtonElement>('.lb-travel__choice')).map((b) => b.textContent)
    expect(pinos).toEqual(['Escada do topo'])
  })

  it('ligar a escada que já está no mapa: os dois lados ligados, e o painel diz "Leva a outro ponto desta cena"', () => {
    const { torre } = montar()
    renderPainel('a')
    clicar('Leva a…')
    clicar('Esta cena')
    clicar('Escada do topo')
    expect(pinoAberto('a').destino).toEqual({ sceneId: torre, pinId: 'b' })
    expect(pinoAberto('b').destino).toEqual({ sceneId: torre, pinId: 'a' })
    renderPainel('a')
    const status = container.querySelector('#lb-pin-travel-status')
    expect(status?.textContent).toBe('Leva a outro ponto desta cenaaté “Escada do topo”')
    expect(botao('Ir para outro ponto desta cena')).toBeDefined()
    // O nome da cena aberta não aparece como destino: é "desta cena".
    expect(container.textContent).not.toContain('Leva a Torre')
  })

  it('"Ir para outro ponto desta cena": não troca de cena e abre o par', () => {
    const { torre } = montar()
    useAdventureStore.getState().linkPinToExisting('a', torre, 'b')
    renderPainel('a')
    clicar('Ir para outro ponto desta cena')
    expect(useAdventureStore.getState().activeSceneId).toBe(torre)
    expect(useMapStore.getState().selectedPinId).toBe('b')
  })

  it('"Criar pino de chegada" em "Esta cena": nasce no mapa aberto, ligado de volta', () => {
    const { torre } = montar()
    renderPainel('a')
    clicar('Leva a…')
    clicar('Esta cena')
    clicar('Criar pino de chegada')
    const pinos = useMapStore.getState().map.pins
    expect(pinos).toHaveLength(3)
    const chegada = pinos.find((p) => p.id !== 'a' && p.id !== 'b')
    expect(chegada?.destino).toEqual({ sceneId: torre, pinId: 'a' })
    expect(pinoAberto('a').destino).toEqual({ sceneId: torre, pinId: chegada?.id })
  })

  it('mão única no atalho: a origem diz "chega em outro ponto desta cena" e a chegada diz de onde vem', () => {
    const { torre } = montar()
    useAdventureStore.getState().linkPinToExisting('a', torre, 'b')
    renderPainel('a')
    clicar('Mão única')
    expect(pinoAberto('b').soChegada).toBe(true)
    renderPainel('a')
    expect(container.textContent).toContain('Não volta: o jogador chega em outro ponto desta cena e não vê o pino de chegada.')
    renderPainel('b')
    expect(container.textContent).toContain('Só chegada')
    expect(container.textContent).toContain('Mão única vinda de outro ponto desta cena: não leva de volta.')
    // Desligar pela origem desfaz a mão única no par.
    act(() => useAdventureStore.getState().unlinkPin('a', SAIDA_PRINCIPAL))
    expect(pinoAberto('b').soChegada).toBeUndefined()
    expect(pinoAberto('b').destino ?? null).toBeNull()
  })
})
