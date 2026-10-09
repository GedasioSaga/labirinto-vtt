/**
 * Onde o RPG mora agora (pedido de 08/10/2026): "Sistema de RPG" na janela
 * Configurações do mapa; "Livro de regras" e "Personagens" na aba Jogo, logo
 * abaixo da Sala; nada disso na zona Aventura do painel esquerdo. E as três
 * entradas aparecem também no mapa solto — escolher sistema ali pergunta antes
 * se o mapa vira aventura (o "Arquipélago" do usuário não tinha como).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'

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
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined), isTauri: () => false }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore } = await import('../stores/adventureStore')
const { useMapStore } = await import('../stores/mapStore')
const { useRpgStore } = await import('../stores/rpgStore')
const { useSessionStore } = await import('../stores/sessionStore')
const { PERGUNTA_VIRAR_AVENTURA, garantirAventura } = await import('../stores/virarAventura')
const { createEmptyMap } = await import('../lib/mapFactory')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')
const { MapSettingsButton } = await import('./MapSettingsDialog')
const { RoomPanel } = await import('./RoomPanel')
const { PersonagensDaAventura } = await import('./PersonagensSection')
const { RpgDialogs } = await import('./RpgDialogs')
const { PropertiesPanel } = await import('./PropertiesPanel')
const { propsDoPainel } = await import('./propertiesPanelTestProps')

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const nada = (): void => {}

function abrirMapaSolto(): void {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_arquipelago', 'Arquipélago', 30, 20, 64))
  useSessionStore.getState().markSaved()
}

const SALA_FECHADA = {
  room: null,
  players: [],
  tokens: [],
  tunnel: { kind: 'idle' } satisfies TunnelState,
  clues: { rows: [], onCenter: nada, onToggle: nada },
  onStart: nada,
  onStop: nada,
  onStartTunnel: nada,
  onStopTunnel: nada,
  onAssign: nada,
  onUnassign: nada,
  onKick: nada,
  onVisionRadiusChange: nada,
  onVisionFactorChange: nada,
  onRevealPlan: nada,
  onHidePlan: nada,
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidato) => candidato.textContent?.trim() === nome || candidato.getAttribute('aria-label') === nome,
  )
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

/** A seção "Sistema de RPG" da janela Configurações do mapa. */
function secaoDoSistema(): HTMLElement {
  const secao = document.body.querySelector<HTMLElement>('.lb-rpg-config')
  if (secao === null) throw new Error('a seção "Sistema de RPG" deveria estar na janela')
  return secao
}

describe('o RPG no lugar novo', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    abrirMapaSolto()
    useRpgStore.setState({ sistemasAbertos: false, livroAberto: false, personagemAberto: null })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function abrirConfiguracoes(): void {
    const vazio = vi.fn()
    act(() =>
      root.render(
        <MapSettingsButton
          grid={{
            showGrid: true,
            onShowGridChange: vazio,
            gridShape: 'square',
            onGridShapeChange: vazio,
            snapTargets: { token: true, wall: true, prop: false },
            onSnapTargetChange: vazio,
            gridSettings: { color: '#ffffff', opacity: 0.3, lineWidth: 1, lineStyle: 'solid' },
            onGridSettingsChange: vazio,
          }}
          gridAlign={{ backgroundFilename: null, imageWidth: null, imageHeight: null, cellSize: 64, offset: { x: 0, y: 0 }, onOffsetChange: vazio, onApply: vazio, onPreviewChange: vazio }}
          mapScale={{ scale: { unitsPerCell: 1.5, unit: 'm', precision: 1 }, onScaleChange: vazio, measurementMode: 'chessboard', onMeasurementModeChange: vazio, gridShape: 'square' }}
          scenarioLink={{ scenarioLink: null, onScenarioLinkChange: vazio }}
          mapSize={{ width: 30, height: 20, onApply: vazio }}
        />,
      ),
    )
    act(() => botao('Configurações do mapa').click())
  }

  it('mapa solto: "Sistema de RPG" está em Configurações do mapa, sem sistema, e o botão abre a grade', () => {
    abrirConfiguracoes()
    const secao = secaoDoSistema()
    expect(secao.querySelector('h2')?.textContent).toBe('Sistema de RPG')
    expect(secao.querySelector('.lb-rpg-config__nome')?.textContent).toBe('Nenhum sistema escolhido')
    act(() => botao('Escolher sistema…').click())
    expect(useRpgStore.getState().sistemasAbertos).toBe(true)
  })

  it('aventura com sistema: a capa (cor e iniciais) e o nome, e o botão vira "Trocar sistema…"', () => {
    useAdventureStore.getState().virarAventura(null)
    useAdventureStore.getState().setSistemaDeRpg(SISTEMA_ONE_PIECE.id)
    abrirConfiguracoes()
    const secao = secaoDoSistema()
    const capa = secao.querySelector<HTMLElement>('.lb-rpg-config__capa')
    expect(capa?.textContent).toBe('OP')
    expect(capa?.style.backgroundColor).not.toBe('')
    expect(secao.querySelector('.lb-rpg-config__nome')?.textContent).toBe('One Piece')
    expect(() => botao('Trocar sistema…')).not.toThrow()
  })

  it('aba Jogo: "Personagens" logo abaixo da Sala, com a sala fechada e aberta, também no mapa solto', () => {
    const rpg = <PersonagensDaAventura garantirAventura={async () => true} />
    const fechada = renderToStaticMarkup(<RoomPanel {...SALA_FECHADA} rpg={rpg} />)
    expect(fechada.indexOf('Personagens')).toBeGreaterThan(fechada.indexOf('Rede local'))
    expect(fechada.indexOf('Rede local')).toBeGreaterThan(fechada.indexOf('Abrir sala'))
    const aberta = renderToStaticMarkup(<RoomPanel {...SALA_FECHADA} room={{ code: 'K7Q2XM', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }} rpg={rpg} />)
    expect(aberta.indexOf('Personagens')).toBeGreaterThan(aberta.indexOf('K7Q2XM'))
    expect(aberta.indexOf('Som da mesa')).toBeGreaterThan(aberta.indexOf('Personagens'))
    // Mapa solto, sem sistema: a lista existe e diz onde escolher o sistema.
    act(() => root.render(<PersonagensDaAventura garantirAventura={async () => true} />))
    act(() => botao('Personagens').click())
    expect(container.textContent).toContain('Escolha o sistema de RPG em Configurações do mapa')
  })

  it('aba Jogo: "Livro de regras" aparece com o sistema da aventura e abre o livro', () => {
    useAdventureStore.getState().virarAventura(null)
    useAdventureStore.getState().setSistemaDeRpg(SISTEMA_ONE_PIECE.id)
    act(() => root.render(<PersonagensDaAventura garantirAventura={async () => true} />))
    act(() => botao('Livro de regras').click())
    expect(useRpgStore.getState().livroAberto).toBe(true)
  })

  it('mapa solto: escolher sistema pergunta antes; "não" deixa o mapa solto, "sim" vira aventura com o sistema', async () => {
    const respostas = [false, true]
    const perguntas: string[] = []
    const garantir = () =>
      garantirAventura({
        perguntar: async (texto) => {
          perguntas.push(texto)
          return respostas.shift() ?? false
        },
        caminhoDoMapaSolto: () => 'C:/mesa/arquipelago/arquipelago.json',
      })
    act(() => root.render(<RpgDialogs garantirAventura={garantir} />))

    const escolherOnePiece = async () => {
      act(() => useRpgStore.getState().abrirSistemas())
      const cartao = document.body.querySelector<HTMLButtonElement>('.lb-sistema:not(.lb-sistema--mais)')
      if (cartao === null) throw new Error('a grade deveria abrir no mapa solto')
      await act(async () => cartao.click())
    }
    await escolherOnePiece()
    await vi.waitFor(() => expect(perguntas).toEqual([PERGUNTA_VIRAR_AVENTURA]))
    expect(useAdventureStore.getState().adventure).toBeNull()

    await escolherOnePiece()
    await vi.waitFor(() => expect(useAdventureStore.getState().adventure?.sistemaDeRpg).toBe(SISTEMA_ONE_PIECE.id))
    expect(perguntas).toEqual([PERGUNTA_VIRAR_AVENTURA, PERGUNTA_VIRAR_AVENTURA])
    const { adventure, rootPath } = useAdventureStore.getState()
    expect(adventure?.scenes.map((cena) => cena.file)).toEqual(['arquipelago.json'])
    expect(rootPath).toBe('C:/mesa/arquipelago/arquipelago.json')
  })

  it('zona Aventura do painel esquerdo: nada de Sistema de RPG, Livro de regras nem Personagens', () => {
    useAdventureStore.getState().virarAventura(null)
    useAdventureStore.getState().setSistemaDeRpg(SISTEMA_ONE_PIECE.id)
    act(() => root.render(<PropertiesPanel {...propsDoPainel(null, { scenes: <p>Cenas da aventura</p> })} />))
    const zona = Array.from(container.querySelectorAll('.lb-zona')).find((grupo) => grupo.textContent?.startsWith('Aventura'))
    expect(zona?.textContent).toContain('Cenas da aventura')
    expect(zona?.textContent).not.toMatch(/Sistema de RPG|Livro de regras|Personagens/)
  })
})
