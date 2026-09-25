import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinBlockReason, PinPassage } from '../types/map'
import { PinTravelControls, type PinTravelControlsProps } from './PinTravelControls'

/**
 * MOTIVO DO BLOQUEIO no painel do mestre: com a passagem em "Trancada", logo
 * abaixo aparece "Por que está fechada" — Trancada (a chave, o de sempre),
 * Desabou, Alagada, Em chamas, Sem energia. Nos outros modos a escolha some:
 * não há o que explicar a quem passa.
 */

function props(passage: PinPassage, motivo: PinBlockReason | undefined, onMotivoChange: (m: PinBlockReason | undefined) => void): PinTravelControlsProps {
  return {
    exits: [{ id: 'principal', rotulo: '', travel: { status: 'sem-destino' } }],
    scenes: [],
    pinsIn: () => [],
    onLinkNew: () => {},
    onLinkExisting: () => {},
    onUnlink: () => {},
    onRename: () => {},
    onGo: () => {},
    passage,
    onPassageChange: () => {},
    motivo,
    onMotivoChange,
    onOneWayChange: () => {},
    onBothSidesChange: () => {},
    arrivalOnly: false,
  }
}

describe('PinTravelControls: motivo do bloqueio', () => {
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

  const grupoMotivo = (): HTMLElement | null => container.querySelector('[role="radiogroup"][aria-labelledby="lb-pin-travel-reason"]')
  const opcoes = (): HTMLButtonElement[] => Array.from(grupoMotivo()?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])

  it('trancada: as cinco escolhas, na ordem, com a atual marcada', () => {
    act(() => root.render(<PinTravelControls {...props('trancada', 'alagada', () => {})} />))
    expect(grupoMotivo()).not.toBeNull()
    expect(opcoes().map((b) => b.textContent)).toEqual(['Trancada', 'Desabou', 'Alagada', 'Em chamas', 'Sem energia'])
    expect(opcoes().filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.textContent)).toEqual(['Alagada'])
  })

  it('sem motivo gravado, "Trancada" é a marcada; escolher outra chama onMotivoChange', () => {
    const onMotivoChange = vi.fn()
    act(() => root.render(<PinTravelControls {...props('trancada', undefined, onMotivoChange)} />))
    expect(opcoes().find((b) => b.getAttribute('aria-checked') === 'true')?.textContent).toBe('Trancada')
    act(() => opcoes().find((b) => b.textContent === 'Sem energia')?.click())
    expect(onMotivoChange).toHaveBeenCalledWith('sem-energia')
    act(() => opcoes().find((b) => b.textContent === 'Trancada')?.click())
    expect(onMotivoChange).toHaveBeenLastCalledWith(undefined)
  })

  it('pede ou livre: a escolha do motivo não aparece', () => {
    for (const passage of ['pede', 'livre'] as const) {
      act(() => root.render(<PinTravelControls {...props(passage, 'desabou', () => {})} />))
      expect(grupoMotivo(), passage).toBeNull()
    }
  })
})
