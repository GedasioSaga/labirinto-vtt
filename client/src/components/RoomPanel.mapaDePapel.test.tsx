/**
 * "Dar um mapa a…" no painel Sala do mestre: no card do jogador, o mestre
 * abre o mapa de papel, escolhe a cena, marca as Salas (com filtro por nome) e
 * entrega. A linha de status conta quantas Salas foram; sem Sala marcada o
 * botão fica indisponível e diz por quê.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { TunnelState } from '../net/hostBridge'
import { MAX_SCENE_MEMORIES_PER_PLAYER, type GiveMapOutcome, type HostWorld, type PlayerInfo } from '../net/hostSession'
import type { Region } from '../types/map'
import { giftScenesOf, RoomPanel, type GiftScene } from './RoomPanel'

function jogador(overrides: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: '?', status: 'waiting', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, ...overrides }
}

function sala(id: string, nome: string, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
    ...extra,
  }
}

const ANA = jogador({ clientId: 'c1', playerId: 'p1', name: 'Ana', status: 'playing', tokenIds: ['tok-a'], sceneId: 's-salao', sceneName: 'Salao Nobre' })
const ROOM = { code: 'PAPEL1', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

const CENAS: GiftScene[] = [
  { sceneId: 's-salao', name: 'Salao Nobre', rooms: [{ id: 'r-bib', name: 'Biblioteca' }, { id: 'r-coz', name: 'Cozinha' }] },
  { sceneId: 's-cripta', name: 'Cripta Funda', rooms: [{ id: 'r-pombal', name: 'Pombal' }, { id: 'r-passarela', name: 'Passarela' }, { id: 'r-porao', name: 'Porão' }] },
]

describe('giftScenesOf — o que o mestre pode pôr num mapa de papel', () => {
  it('a cena aberta primeiro; fica de fora Sala secreta, oculta, com teto, dentro de secreta, região comum e cena sem Sala', () => {
    const salao = createEmptyMap('m-salao', 'Salao Nobre', 10, 10, 50)
    const cripta = createEmptyMap('m-cripta', 'Cripta Funda', 10, 10, 50)
    const vazia = createEmptyMap('m-vazia', 'Poco Vazio', 10, 10, 50)
    const comum: Region = { ...sala('r-comum', 'x'), room: undefined }
    const world: HostWorld = {
      open: {
        sceneId: 's-salao',
        name: 'Salao Nobre',
        map: {
          ...salao,
          regions: [
            sala('r-bib', 'Biblioteca'),
            sala('r-sec', 'Passagem', { secret: true }),
            sala('r-dentro', 'Nicho', { parentId: 'r-sec' }),
            sala('r-oculta', 'Despensa', { hidden: true }),
            sala('r-teto', 'Torre', { room: { shape: 'rect', name: 'Torre', roof: true } }),
            sala('r-sob-teto', 'Sino', { parentId: 'r-teto' }),
            comum,
          ],
        },
      },
      background: [
        { sceneId: 's-cripta', name: 'Cripta Funda', map: { ...cripta, regions: [sala('r-pombal', 'Pombal'), sala('r-sem-nome', '  ')] } },
        { sceneId: 's-vazia', name: 'Poco Vazio', map: vazia },
      ],
    }
    expect(giftScenesOf(world)).toEqual([
      { sceneId: 's-salao', name: 'Salao Nobre', rooms: [{ id: 'r-bib', name: 'Biblioteca' }] },
      {
        sceneId: 's-cripta',
        name: 'Cripta Funda',
        rooms: [
          { id: 'r-pombal', name: 'Pombal' },
          { id: 'r-sem-nome', name: 'Sala sem nome' },
        ],
      },
    ])
  })
})

describe('RoomPanel: dar um mapa de papel', () => {
  let container: HTMLDivElement
  let root: Root
  let onGiveMap: ReturnType<typeof vi.fn<(playerId: string, sceneId: string | null, roomIds: string[]) => GiveMapOutcome>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onGiveMap = vi.fn<(playerId: string, sceneId: string | null, roomIds: string[]) => GiveMapOutcome>((_p, _s, ids) => ids.length)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(cenas: GiftScene[] = CENAS): void {
    const noop = (): void => {}
    act(() =>
      root.render(
        <RoomPanel
          room={ROOM}
          players={[ANA]}
          tokens={[{ id: 'tok-a', name: 'Lanterna' }]}
          tunnel={IDLE}
          onStart={noop}
          onStop={noop}
          onStartTunnel={noop}
          onStopTunnel={noop}
          onAssign={noop}
          onUnassign={noop}
          onKick={noop}
          onVisionRadiusChange={noop}
          onVisionFactorChange={noop}
          onRevealPlan={noop}
          onHidePlan={noop}
          clues={{ rows: [], onCenter: noop, onToggle: noop }}
          giftScenes={cenas}
          onGiveMap={onGiveMap}
        />,
      ),
    )
  }

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => (b.textContent ?? '').startsWith(texto))
    if (achado === undefined) throw new Error(`sem botão ${texto}`)
    return achado
  }

  function clica(el: HTMLElement): void {
    act(() => el.click())
  }

  function campoDoRotulo<T extends HTMLElement>(rotulo: string): T {
    const label = Array.from(container.querySelectorAll('label')).find((l) => (l.textContent ?? '').trim() === rotulo)
    const id = label?.htmlFor
    const campo = id === undefined || id === '' ? null : container.querySelector<T>(`[id="${id}"]`)
    if (campo === null) throw new Error(`sem campo ${rotulo}`)
    return campo
  }

  function escolhe(select: HTMLSelectElement, value: string): void {
    act(() => {
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  function digita(input: HTMLInputElement, texto: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, texto)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function salasVisiveis(): string[] {
    return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).map((c) => c.closest('label')?.textContent?.trim() ?? '')
  }

  it('fechado por padrão: o botão diz que abre (aria-expanded) e nada da lista aparece', () => {
    render()
    const abrir = botao('Dar um mapa a Ana')
    expect(abrir.getAttribute('aria-expanded')).toBe('false')
    expect(salasVisiveis()).toEqual([])
  })

  it('aberto: a cena da Ana vem escolhida, com as Salas dela; trocar a cena troca a lista', () => {
    render()
    clica(botao('Dar um mapa a Ana'))
    expect(botao('Dar um mapa a Ana').getAttribute('aria-expanded')).toBe('true')
    const cena = campoDoRotulo<HTMLSelectElement>('Cena do mapa')
    expect(Array.from(cena.options).map((o) => o.textContent)).toEqual(['Salao Nobre', 'Cripta Funda'])
    expect(cena.value).toBe('s-salao')
    expect(salasVisiveis()).toEqual(['Biblioteca', 'Cozinha'])
    escolhe(cena, 's-cripta')
    expect(salasVisiveis()).toEqual(['Pombal', 'Passarela', 'Porão'])
  })

  it('sem Sala marcada, "Entregar" fica indisponível e diz por quê; marcadas, entrega e conta', () => {
    render()
    clica(botao('Dar um mapa a Ana'))
    escolhe(campoDoRotulo<HTMLSelectElement>('Cena do mapa'), 's-cripta')
    const entregar = botao('Entregar')
    expect(entregar.disabled).toBe(true)
    expect(container.textContent).toContain('Marque ao menos uma sala.')

    clica(campoDoRotulo<HTMLInputElement>('Pombal'))
    clica(campoDoRotulo<HTMLInputElement>('Porão'))
    expect(botao('Entregar').disabled).toBe(false)
    expect(botao('Entregar').textContent).toBe('Entregar 2 salas')
    clica(botao('Entregar'))
    expect(onGiveMap).toHaveBeenCalledWith('p1', 's-cripta', ['r-pombal', 'r-porao'])
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Mapa entregue a Ana: 2 salas.')
    // Entregue, a marcação zera: o próximo mapa começa limpo.
    expect(Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).every((c) => !c.checked)).toBe(true)
  })

  it('o filtro por nome acha a Sala sem acento e sem maiúscula, e diz quando nada casa', () => {
    render()
    clica(botao('Dar um mapa a Ana'))
    escolhe(campoDoRotulo<HTMLSelectElement>('Cena do mapa'), 's-cripta')
    const filtro = campoDoRotulo<HTMLInputElement>('Filtrar salas')
    digita(filtro, 'PORAO')
    expect(salasVisiveis()).toEqual(['Porão'])
    digita(filtro, 'pa')
    expect(salasVisiveis()).toEqual(['Passarela'])
    digita(filtro, 'zzz')
    expect(salasVisiveis()).toEqual([])
    expect(container.textContent).toContain('Nenhuma sala com esse nome.')
  })

  it('nada entrou (Sala virou secreta no meio): diz que nada foi, em vez de fingir', () => {
    onGiveMap.mockReturnValue(0)
    render()
    clica(botao('Dar um mapa a Ana'))
    clica(campoDoRotulo<HTMLInputElement>('Biblioteca'))
    clica(botao('Entregar'))
    expect(onGiveMap).toHaveBeenCalledWith('p1', 's-salao', ['r-bib'])
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Nada foi: essas salas estão ocultas para jogadores agora, ou a sala da mesa fechou.')
  })

  it('memória da Ana cheia: diz ao mestre que nada foi e por quê, e mantém as Salas marcadas', () => {
    onGiveMap.mockReturnValue('memoria-cheia')
    render()
    clica(botao('Dar um mapa a Ana'))
    clica(campoDoRotulo<HTMLInputElement>('Biblioteca'))
    clica(botao('Entregar'))
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      `Nada foi: a memória de Ana já guarda ${MAX_SCENE_MEMORIES_PER_PLAYER} cenas, e o mapa de uma cena nova apagaria a mais antiga explorada.`,
    )
    expect(campoDoRotulo<HTMLInputElement>('Biblioteca').checked).toBe(true)
  })

  it('aventura sem nenhuma Sala desenhada: o card não oferece o mapa', () => {
    render([])
    expect(Array.from(container.querySelectorAll('button')).some((b) => (b.textContent ?? '').startsWith('Dar um mapa'))).toBe(false)
  })
})
