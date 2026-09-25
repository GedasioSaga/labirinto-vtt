/**
 * LUGARES convivendo com o que já estava no painel do jogador em
 * auto/int-jogador: "Anotar" e "Minhas notas" (anotacao-pessoal), "Marcar
 * destino" e "Tirar marca" (marca-olhem-aqui) e a aba Dados (dado-na-sala).
 * O painel inteiro, com tudo ligado, tem as quatro abas e cada uma faz o seu.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, markRings } from '../lib/exploration'
import type { DiceRequest } from '../lib/dice'
import type { Pin } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'
import { rememberPlace, type VisitedPlace } from './playerPlaces'
import type { PersonalNote } from './personalNotes'

const TEMPLO: Pin = { id: 'pt', x: 300, y: 150, kind: 'exclamacao', description: 'Portas do Templo\nGrandes, de bronze.', image: null }

function explorado() {
  const exp = createExploration({ width: 500, height: 500, grid: 50 })
  markRings(exp, [
    [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 0, y: 200 },
    ],
  ])
  return exp
}

function doisLugares(): VisitedPlace[] {
  return ['l1', 'l2'].reduce<VisitedPlace[]>((lista, id) => rememberPlace(lista, id, createEmptyMap(`m-${id}`, '', 10, 10, 50), explorado(), [], undefined), [])
}

const NOTA: PersonalNote = { id: 'n1', mapId: 'm-l2', x: 40, y: 60, text: 'baú trancado aqui' }

describe('PlayerPanel: Lugares com Anotar, Marcar destino e Dados', () => {
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

  interface Chamadas {
    onFocusPoint: (point: { x: number; y: number }) => void
    onRollDice: (request: DiceRequest) => void
    onToggleNote: () => void
    onToggleDestination: () => void
    onClearDestination: () => void
    onFocusNote: (noteId: string) => void
  }

  function render(chamadas: Chamadas): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 't1', name: 'Eva' }]}
          characterColor="#fff"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => {}}
          onFocusToken={() => {}}
          signalArmed={false}
          onToggleSignal={() => {}}
          measureArmed={false}
          onToggleMeasure={() => {}}
          laserArmed={false}
          onToggleLaser={() => {}}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={() => {}}
          pins={[TEMPLO]}
          places={doisLugares()}
          currentPlace="l2"
          placeNames={{}}
          onFocusPoint={chamadas.onFocusPoint}
          onRenamePlace={() => {}}
          noteArmed={false}
          onToggleNote={chamadas.onToggleNote}
          personalNotes={[NOTA]}
          onFocusNote={chamadas.onFocusNote}
          onRemoveNote={() => {}}
          destinationArmed={false}
          onToggleDestination={chamadas.onToggleDestination}
          hasDestination
          onClearDestination={chamadas.onClearDestination}
          onRollDice={chamadas.onRollDice}
        />,
      ),
    )
  }

  function chamadas(): Chamadas {
    return {
      onFocusPoint: vi.fn(),
      onRollDice: vi.fn(),
      onToggleNote: vi.fn(),
      onToggleDestination: vi.fn(),
      onClearDestination: vi.fn(),
      onFocusNote: vi.fn(),
    }
  }

  const abas = (): HTMLButtonElement[] => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))

  function aba(nome: string): HTMLButtonElement {
    const achada = abas().find((b) => (b.textContent ?? '').trim().startsWith(nome))
    if (!achada) throw new Error(`aba ${nome} não existe`)
    return achada
  }

  function painelAberto(): HTMLElement {
    const aberto = container.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')
    if (!aberto) throw new Error('nenhum painel à vista')
    return aberto
  }

  function botao(dentro: HTMLElement, nome: string): HTMLButtonElement {
    const achado = Array.from(dentro.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === nome,
    )
    if (!achado) throw new Error(`sem o botão ${nome}`)
    return achado
  }

  it('as quatro abas, na ordem Jogo, Caderno, Lugares, Dados', () => {
    render(chamadas())
    expect(abas().map((b) => (b.textContent ?? '').trim())).toEqual(['Jogo', 'Caderno', 'Lugares', 'Dados'])
  })

  it('Lugares mostra o ponto e a miniatura e centra no ponto; Anotar e Mudar destino seguem na aba Jogo', () => {
    const c = chamadas()
    render(c)

    const jogo = painelAberto()
    act(() => botao(jogo, 'Anotar').click())
    expect(c.onToggleNote).toHaveBeenCalledTimes(1)
    // Com a marca já no mapa, o mesmo botão diz "Mudar destino".
    act(() => botao(jogo, 'Mudar destino').click())
    expect(c.onToggleDestination).toHaveBeenCalledTimes(1)
    act(() => botao(jogo, 'Tirar marca').click())
    expect(c.onClearDestination).toHaveBeenCalledTimes(1)

    act(() => aba('Lugares').click())
    const lugares = painelAberto()
    expect(lugares.getAttribute('aria-labelledby')).toBe(aba('Lugares').id)
    expect(lugares.textContent).toContain('Portas do Templo')
    expect(lugares.textContent).toContain('Lugar 2')
    act(() => botao(lugares, 'Centralizar em Portas do Templo').click())
    expect(c.onFocusPoint).toHaveBeenCalledWith({ x: 300, y: 150 })
  })

  it('Caderno segue com Minhas notas e Dados segue rolando, com Lugares no meio', () => {
    const c = chamadas()
    render(c)

    act(() => aba('Caderno').click())
    const caderno = painelAberto()
    expect(caderno.textContent).toContain('Minhas notas')
    expect(caderno.textContent).toContain('baú trancado aqui')
    // A lista de lugares não vaza para o Caderno: cada aba mostra só o seu.
    expect(caderno.textContent).not.toContain('Portas do Templo')

    act(() => aba('Dados').click())
    const dados = painelAberto()
    act(() => botao(dados, 'd6').click())
    act(() => botao(dados, 'Rolar').click())
    expect(c.onRollDice).toHaveBeenCalledWith({ count: 1, sides: 6, modifier: 0 })
    expect(dados.textContent).not.toContain('Portas do Templo')
  })
})
