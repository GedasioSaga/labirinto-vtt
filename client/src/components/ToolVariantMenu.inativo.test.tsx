import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOOL_VARIANTS } from '../lib/toolVariants'
import type { RoomFreeKind } from '../types/tools'
import { ToolVariantMenu, type ToolVariantBindings } from './ToolVariantMenu'

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

function bindings(roomFreeKind: RoomFreeKind): ToolVariantBindings {
  return {
    doorKind: { value: 'normal', onChange: vi.fn() },
    wallKind: { value: undefined, onChange: vi.fn() },
    regionFillPattern: { value: 'solid', onChange: vi.fn() },
    polygonSides: { value: 6, onChange: vi.fn() },
    stairSizePreset: { value: 'medium', onChange: vi.fn() },
    drawTexture: { value: 'pen', onChange: vi.fn() },
    brushMode: { value: 'traco', onChange: vi.fn() },
    eraseMode: { value: 'objeto', onChange: vi.fn() },
    floorShapeKind: { value: 'rect', onChange: vi.fn() },
    floorOp: { value: 'add', onChange: vi.fn() },
    floorPolygonSides: { value: 6, onChange: vi.fn() },
    floorBrushSize: { value: 1, onChange: vi.fn() },
    floorCamada: { value: 'chao', onChange: vi.fn() },
    mobiliaTipo: { value: 'mesa', onChange: vi.fn() },
    roomFreeKind: { value: roomFreeKind, onChange: vi.fn() },
    roomFreeRounded: { value: false, onChange: vi.fn() },
    drawShape: { value: 'roomFree', onChange: vi.fn() },
  }
}

/** Abre o menu da Sala livre com o modo dado e devolve os espiões. */
function abrirMenuDaSalaLivre(roomFreeKind: RoomFreeKind) {
  const entry = TOOL_VARIANTS.roomFree
  if (!entry || !entry.available) throw new Error('roomFree deveria estar disponível')
  const eixos = bindings(roomFreeKind)
  const onClose = vi.fn()
  act(() => root.render(<ToolVariantMenu title="Sala livre" groups={entry.groups} bindings={eixos} onClose={onClose} />))
  return { eixos, onClose }
}

const grupo = (nome: string) => {
  const radiogroup = container.querySelector<HTMLElement>(`[role="radiogroup"][aria-label="${nome}"]`)
  if (!radiogroup) throw new Error(`grupo "${nome}" ausente`)
  return radiogroup
}

const opcoes = (nome: string) => Array.from(grupo(nome).querySelectorAll<HTMLButtonElement>('[role="radio"]'))

const motivoDoPreenchimento = () => {
  const preenchimento = TOOL_VARIANTS.roomFree?.available
    ? TOOL_VARIANTS.roomFree.groups.find((g) => g.storeKey === 'regionFillPattern')
    : undefined
  const motivo = preenchimento?.inativoQuando?.motivo
  if (!motivo) throw new Error('o preenchimento da Sala livre deveria dizer por que fica esmaecido')
  return motivo
}

describe('ToolVariantMenu — grupo que não vale no modo atual', () => {
  it('modo Parede: as opções de Preenchimento ficam esmaecidas e o motivo aparece ligado ao grupo', () => {
    abrirMenuDaSalaLivre('parede')
    expect(opcoes('Preenchimento').map((b) => b.disabled)).toEqual([true, true])

    const preenchimento = grupo('Preenchimento')
    expect(preenchimento.getAttribute('aria-disabled')).toBe('true')
    const motivoId = preenchimento.getAttribute('aria-describedby')
    expect(motivoId).toBeTruthy()
    expect(document.getElementById(motivoId ?? '')?.textContent).toBe(motivoDoPreenchimento())
  })

  it('modo Parede: clicar numa opção esmaecida não muda a preferência nem fecha o menu', () => {
    const { eixos, onClose } = abrirMenuDaSalaLivre('parede')
    const hachurado = opcoes('Preenchimento').find((b) => b.getAttribute('aria-label') === 'Hachurado')
    act(() => hachurado?.click())
    expect(eixos.regionFillPattern.onChange).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('modo Parede: Criar e Arredondar continuam valendo', () => {
    const { eixos, onClose } = abrirMenuDaSalaLivre('parede')
    for (const nome of ['Criar', 'Arredondar']) {
      expect(opcoes(nome).every((b) => !b.disabled), nome).toBe(true)
      expect(grupo(nome).hasAttribute('aria-describedby'), nome).toBe(false)
    }
    const ligado = opcoes('Arredondar').find((b) => b.getAttribute('aria-label') === 'Ligado')
    act(() => ligado?.click())
    expect(eixos.roomFreeRounded.onChange).toHaveBeenCalledWith(true)
    expect(onClose).toHaveBeenCalled()
  })

  it('modo Sala: Preenchimento vale, sem motivo nenhum na tela', () => {
    const { eixos } = abrirMenuDaSalaLivre('sala')
    expect(opcoes('Preenchimento').every((b) => !b.disabled)).toBe(true)
    expect(grupo('Preenchimento').hasAttribute('aria-describedby')).toBe(false)
    expect(container.textContent).not.toContain(motivoDoPreenchimento())
    const hachurado = opcoes('Preenchimento').find((b) => b.getAttribute('aria-label') === 'Hachurado')
    act(() => hachurado?.click())
    expect(eixos.regionFillPattern.onChange).toHaveBeenCalledWith('hatch')
  })
})
