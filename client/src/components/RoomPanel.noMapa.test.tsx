import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { selectionFromItems, selectionOfItem, type SelectionSet } from '../lib/selectionModel'
import type { TunnelState } from '../net/hostBridge'
import type { PlayerInfo } from '../net/hostSession'
import { useMapStore } from '../stores/mapStore'
import type { Token } from '../types/map'
import { ComSaida } from './grimorio/ComSaida'
import { PaginaAVistaProvider } from './livro/paginaAVista'
import { LuzDaCenaRapida } from './LuzDaCenaRapida'
import { RoomPanel, type RoomPanelToken } from './RoomPanel'

/*
 * "Atribuir token" e o mapa (auditoria da frente D, 09/11/2026): quatro alces
 * na clareira, Gina e Hugo esperando personagem. O "clicar no token no mapa"
 * só vale para um clique de verdade no canvas, e desarma quando o card deixa
 * de estar à vista.
 */
const ALCES = ['a', 'b', 'c', 'd'].map((letra) => `alce-${letra}`)
const TOKENS: RoomPanelToken[] = ALCES.map((id) => ({ id, name: 'Alce', npc: true }))
const NO_MAPA: Token[] = ALCES.map((id) => ({ id, characterId: null, name: 'Alce', x: 0, y: 0, size: 1, image: null }))

function jogador(overrides: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: '?', status: 'waiting', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, ...overrides }
}
const GINA = jogador({ clientId: 'c7', playerId: 'p7', name: 'Gina' })
const HUGO = jogador({ clientId: 'c8', playerId: 'p8', name: 'Hugo' })

const ROOM = { code: 'ALCE01', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }
/** O mesmo atraso do destaque no `RoomPanel` (`ATRASO_DO_DESTAQUE_MS`). */
const ATRASO_DO_DESTAQUE_MS = 70

const doToken = (id: string) => selectionOfItem({ kind: 'token', id })

/** O balão "Luz da cena" como a barra o monta: fecha pelo `onClose` e ainda sai por 120 ms (`ComSaida`). */
function BalaoDaLuz() {
  const [aberto, setAberto] = useState(true)
  return <ComSaida>{aberto && <LuzDaCenaRapida onClose={() => setAberto(false)} onPorLuz={() => {}} />}</ComSaida>
}

describe('RoomPanel: "clicar no token no mapa" só escolhe com um clique de verdade e não fica ligado escondido', () => {
  let container: HTMLDivElement
  let root: Root
  let mapa: HTMLDivElement
  let canvas: HTMLCanvasElement
  let onAssign: ReturnType<typeof vi.fn<(playerId: string, tokenId: string) => void>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useMapStore.getState().loadMap({ ...createEmptyMap('m1', 'Clareira', 10, 10, 50), tokens: NO_MAPA })
    useMapStore.getState().setActiveTool('select')
    // O canvas do editor mora em `.lb-editor__canvas` (App.tsx): o clique no mapa nasce nele.
    mapa = document.createElement('div')
    mapa.className = 'lb-editor__canvas'
    canvas = document.createElement('canvas')
    mapa.appendChild(canvas)
    document.body.appendChild(mapa)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onAssign = vi.fn<(playerId: string, tokenId: string) => void>()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    mapa.remove()
    useMapStore.setState({ itemGroups: {} })
    vi.useRealTimers()
  })

  function render(players: PlayerInfo[], { tokens = TOKENS, aVista = true }: { tokens?: RoomPanelToken[]; aVista?: boolean } = {}): void {
    const noop = (): void => {}
    act(() =>
      root.render(
        <PaginaAVistaProvider value={aVista}>
          <RoomPanel
            room={ROOM}
            players={players}
            tokens={tokens}
            tunnel={IDLE}
            onStart={noop}
            onStop={noop}
            onStartTunnel={noop}
            onStopTunnel={noop}
            onAssign={onAssign}
            onUnassign={noop}
            onKick={noop}
            onVisionRadiusChange={noop}
            onVisionFactorChange={noop}
            onRevealPlan={noop}
            onHidePlan={noop}
            clues={{ rows: [], onCenter: noop, onToggle: noop }}
          />
        </PaginaAVistaProvider>,
      ),
    )
  }

  function card(nome: string): HTMLElement {
    const achado = Array.from(container.querySelectorAll<HTMLElement>('.lb-field')).find((el) => (el.textContent ?? '').includes(`${nome} —`))
    if (achado === undefined) throw new Error(`sem card de ${nome}`)
    return achado
  }

  /** Abre a lista do card e devolve as linhas dela (a lista mora no `body`). */
  function linhasDaLista(nome: string): HTMLElement[] {
    const campo = card(nome).querySelector<HTMLButtonElement>('.lb-atribuir__campo')
    if (campo === null) throw new Error(`sem o campo "Atribuir token" no card de ${nome}`)
    if (campo.getAttribute('aria-expanded') !== 'true') act(() => campo.click())
    return Array.from(document.body.querySelectorAll<HTMLElement>('.lb-atribuir [role="option"]'))
  }

  /** Abre a lista do card e aperta "Clicar no token no mapa". */
  function armar(nome: string): void {
    linhasDaLista(nome)
    const botao = document.body.querySelector<HTMLButtonElement>('.lb-atribuir__no-mapa')
    if (botao === null) throw new Error('sem o botão "Clicar no token no mapa"')
    act(() => botao.click())
  }

  /** O ponteiro para em cima da linha: depois do atraso, o token dela acende no mapa. */
  function apontar(linha: HTMLElement): void {
    act(() => {
      linha.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }))
    })
    act(() => {
      vi.advanceTimersByTime(ATRASO_DO_DESTAQUE_MS)
    })
  }

  /** O clique de verdade: o aperto nasce no canvas do mapa e é dentro dele que o editor seleciona, como o Pixi faz. */
  function clicarSelecionando(selecao: SelectionSet): void {
    canvas.addEventListener('pointerdown', () => useMapStore.getState().setSelection(selecao), { once: true })
    act(() => {
      canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }))
    })
  }

  function clicarNoToken(tokenId: string): void {
    clicarSelecionando(doToken(tokenId))
  }

  const espera = (nome: string): Element | null => card(nome).querySelector('.lb-atribuir__espera')
  /** O aviso que fica sobre o mapa, fora do card, enquanto a espera está armada. */
  const aviso = (): Element | null => document.body.querySelector('.lb-atribuir__aviso')

  it('Gina esperando o clique no mapa e a lista do Hugo só aponta uma linha: ninguém recebe o token e a espera da Gina acaba', () => {
    vi.useFakeTimers()
    render([GINA, HUGO])
    armar('Gina')
    expect(espera('Gina')).not.toBeNull()

    apontar(linhasDaLista('Hugo')[0])

    // A linha do Hugo acendeu o alce no mapa, e foi só isso.
    expect(useMapStore.getState().selection).toEqual(doToken('alce-a'))
    expect(onAssign).not.toHaveBeenCalled()
    expect(espera('Gina')).toBeNull()
  })

  it('armado, o clique num token do mapa atribui a quem armou, e o aviso fora do card diz de quem é a vez', () => {
    render([GINA, HUGO])
    armar('Hugo')
    expect(aviso()?.textContent).toContain('Clique no token de Hugo no mapa')
    expect(aviso()?.textContent).toContain('Esc cancela')

    clicarNoToken('alce-c')

    expect(onAssign).toHaveBeenCalledTimes(1)
    expect(onAssign).toHaveBeenCalledWith('p8', 'alce-c')
    expect(aviso()).toBeNull()
  })

  it('armado, o clique num alce agrupado (Ctrl+G) não atribui: a espera acaba e o card diz para desagrupar ou escolher pela lista', () => {
    // O clique num membro seleciona o grupo inteiro, como o editor faz.
    const grupo = selectionFromItems(ALCES.slice(0, 2).map((id) => ({ kind: 'token', id })))
    useMapStore.setState({ itemGroups: { m1: [{ id: 'g-alces', members: grupo }] } })
    render([GINA])
    armar('Gina')

    clicarSelecionando(grupo)

    expect(onAssign).not.toHaveBeenCalled()
    expect(espera('Gina')).toBeNull()
    expect(aviso()).toBeNull()
    expect(card('Gina').querySelector('.lb-player__note[role="status"]')?.textContent).toBe('Esse token está num grupo. Desagrupe ou escolha pela lista.')
  })

  it('espera armada e o balão "Luz da cena" aberto por cima: o primeiro Esc fecha só o balão, e o seguinte cancela a espera', () => {
    render([GINA])
    armar('Gina')
    const lugarDoBalao = document.createElement('div')
    document.body.appendChild(lugarDoBalao)
    const raizDoBalao = createRoot(lugarDoBalao)
    act(() => raizDoBalao.render(<BalaoDaLuz />))
    // O que está saindo (`.gr-sai`) já fechou.
    const balao = (): Element | null => lugarDoBalao.querySelector('[role="dialog"]:not(.gr-sai)')
    // O foco costuma estar no mapa: o Esc nasce fora do card e fora do balão.
    const apertarEsc = (): void => {
      act(() => {
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
    }
    try {
      expect(balao()).not.toBeNull()

      apertarEsc()
      expect(balao()).toBeNull()
      expect(espera('Gina')).not.toBeNull()

      apertarEsc()
      expect(espera('Gina')).toBeNull()
      expect(aviso()).toBeNull()
    } finally {
      act(() => raizDoBalao.unmount())
      lugarDoBalao.remove()
    }
  })

  it('trocar de página com a espera armada desarma: o aviso some e o token clicado depois não vai para ninguém', () => {
    render([GINA])
    armar('Gina')
    expect(aviso()).not.toBeNull()

    render([GINA], { aVista: false })
    expect(aviso()).toBeNull()
    clicarNoToken('alce-a')
    expect(onAssign).not.toHaveBeenCalled()

    // De volta à página, o card mostra o campo de sempre, não a espera.
    render([GINA])
    expect(espera('Gina')).toBeNull()
  })

  it('a lista esvazia com a espera armada: a espera desarma e a ferramenta de antes volta', () => {
    useMapStore.getState().setActiveTool('wall')
    render([GINA])
    armar('Gina')
    expect(useMapStore.getState().activeTool).toBe('select')

    render([GINA], { tokens: [] })

    expect(useMapStore.getState().activeTool).toBe('wall')
    expect(aviso()).toBeNull()
  })

  it('a lista esvazia com a caixa aberta e uma linha acesa: o mapa volta ao que estava selecionado', () => {
    vi.useFakeTimers()
    render([GINA])
    apontar(linhasDaLista('Gina')[0])
    expect(useMapStore.getState().selection).toEqual(doToken('alce-a'))

    render([GINA], { tokens: [] })

    expect(useMapStore.getState().selection).toEqual([])
    expect(document.body.querySelector('.lb-atribuir')).toBeNull()
  })
})
