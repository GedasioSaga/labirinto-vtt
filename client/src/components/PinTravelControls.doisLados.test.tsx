import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin, PinPassage } from '../types/map'
import { PinTravelControls, type PinTravelControlsProps, type PinTravelExitView } from './PinTravelControls'

/**
 * TRANCAR OS DOIS LADOS no painel do mestre: com a passagem ligada, um toque
 * tranca este pino E o par da outra cena ("cortar a corda"), sem abrir a
 * outra cena. Com os dois lados já trancados, o mesmo botão destranca.
 */

function par(id: string, passagem?: PinPassage): Pin {
  const base: Pin = { id, x: 0, y: 0, kind: 'viagem', description: '', image: null }
  return passagem === undefined ? base : { ...base, passagem }
}

function ligada(id: string, sceneName: string, partner: Pin): PinTravelExitView {
  return { id, rotulo: '', travel: { status: 'ligado', sceneId: `cena-${sceneName}`, sceneName, partner } }
}

function props(
  passage: PinPassage,
  exits: readonly PinTravelExitView[],
  onBothSidesChange: (trancar: boolean) => void,
  arrivalOnly = false,
): PinTravelControlsProps {
  return {
    exits,
    scenes: [],
    pinsIn: () => [],
    onLinkNew: () => {},
    onLinkExisting: () => {},
    onUnlink: () => {},
    onRename: () => {},
    onGo: () => {},
    passage,
    onPassageChange: () => {},
    motivo: undefined,
    onMotivoChange: () => {},
    onOneWayChange: () => {},
    onBothSidesChange,
    arrivalOnly,
  }
}

describe('PinTravelControls: trancar os dois lados', () => {
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

  const botao = (): HTMLButtonElement | undefined =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => /os dois lados/.test(b.textContent ?? ''))

  it('ligado e aberto: "Trancar os dois lados" pede trancar', () => {
    const onBothSidesChange = vi.fn()
    act(() => root.render(<PinTravelControls {...props('pede', [ligada('principal', 'Cripta', par('p'))], onBothSidesChange)} />))
    expect(botao()?.textContent).toBe('Trancar os dois lados')
    act(() => botao()?.click())
    expect(onBothSidesChange).toHaveBeenCalledTimes(1)
    expect(onBothSidesChange).toHaveBeenCalledWith(true)
  })

  it('o efeito diz o nome da outra cena ao mestre', () => {
    act(() => root.render(<PinTravelControls {...props('pede', [ligada('principal', 'Cripta', par('p'))], () => {})} />))
    const efeitoId = botao()?.getAttribute('aria-describedby') ?? ''
    expect(efeitoId).not.toBe('')
    expect(document.getElementById(efeitoId)?.textContent).toContain('Cripta')
  })

  it('só este lado trancado: o botão ainda oferece trancar os dois', () => {
    const onBothSidesChange = vi.fn()
    act(() => root.render(<PinTravelControls {...props('trancada', [ligada('principal', 'Cripta', par('p', 'livre'))], onBothSidesChange)} />))
    expect(botao()?.textContent).toBe('Trancar os dois lados')
    act(() => botao()?.click())
    expect(onBothSidesChange).toHaveBeenCalledWith(true)
  })

  it('os dois lados trancados: vira "Destrancar os dois lados" e pede destrancar', () => {
    const onBothSidesChange = vi.fn()
    act(() => root.render(<PinTravelControls {...props('trancada', [ligada('principal', 'Cripta', par('p', 'trancada'))], onBothSidesChange)} />))
    expect(botao()?.textContent).toBe('Destrancar os dois lados')
    act(() => botao()?.click())
    expect(onBothSidesChange).toHaveBeenCalledWith(false)
  })

  it('encruzilhada: só destranca quando TODOS os pares estão trancados', () => {
    const umAberto = [ligada('principal', 'Cripta', par('p1', 'trancada')), ligada('s2', 'Poço', par('p2'))]
    act(() => root.render(<PinTravelControls {...props('trancada', umAberto, () => {})} />))
    expect(botao()?.textContent).toBe('Trancar os dois lados')

    const todos = [ligada('principal', 'Cripta', par('p1', 'trancada')), ligada('s2', 'Poço', par('p2', 'trancada'))]
    act(() => root.render(<PinTravelControls {...props('trancada', todos, () => {})} />))
    expect(botao()?.textContent).toBe('Destrancar os dois lados')
  })

  it('sem destino: não há outro lado, o botão não aparece', () => {
    act(() => root.render(<PinTravelControls {...props('pede', [{ id: 'principal', rotulo: '', travel: { status: 'sem-destino' } }], () => {})} />))
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull()
    expect(botao()).toBeUndefined()
  })

  it('chegada oculta: o painel não oferece o botão', () => {
    act(() => root.render(<PinTravelControls {...props('pede', [ligada('principal', 'Cripta', par('p'))], () => {}, true)} />))
    expect(container.textContent).toContain('Só chegada')
    expect(botao()).toBeUndefined()
  })
})
