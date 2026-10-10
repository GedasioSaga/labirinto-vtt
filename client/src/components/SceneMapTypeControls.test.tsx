/**
 * "Tipo de mapa" do "Configurar cena": Normal | Continente, e a caravana
 * ("Grupo anda junto") só dentro do Continente. A chave antiga "Mapa-mundi
 * (caravana)" saiu das Configurações do mapa (`MovementControls`).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MovementControls } from './MovementControls'
import { SceneMapTypeControls, type SceneMapTypeControlsProps } from './SceneMapTypeControls'

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

function render(props: Partial<SceneMapTypeControlsProps> = {}) {
  const onTipoChange = vi.fn()
  const onCaravanaChange = vi.fn()
  act(() => root.render(<SceneMapTypeControls tipo="normal" caravana={false} onTipoChange={onTipoChange} onCaravanaChange={onCaravanaChange} {...props} />))
  return { onTipoChange, onCaravanaChange }
}

function opcao(rotulo: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent === rotulo)
  if (found === undefined) throw new Error(`opção "${rotulo}" ausente`)
  return found
}

function interruptorCaravana(): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Grupo anda junto'))
  return label?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
}

describe('SceneMapTypeControls', () => {
  it('cena Normal: "Normal" marcado, sem a chave da caravana; escolher Continente avisa', () => {
    const { onTipoChange } = render()
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Tipo de mapa')
    expect(opcao('Normal').getAttribute('aria-checked')).toBe('true')
    expect(opcao('Continente').getAttribute('aria-checked')).toBe('false')
    expect(interruptorCaravana()).toBeNull()
    act(() => opcao('Continente').click())
    expect(onTipoChange).toHaveBeenCalledWith('continente')
  })

  it('cena Continente: explica o pino e mostra a caravana desligada, com a explicação ligada a ela', () => {
    const { onCaravanaChange } = render({ tipo: 'continente' })
    expect(opcao('Continente').getAttribute('aria-checked')).toBe('true')
    expect(container.textContent).toContain('vira um pino')
    const input = interruptorCaravana()
    expect(input?.checked).toBe(false)
    const dica = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('pino só')
    act(() => input?.click())
    expect(onCaravanaChange).toHaveBeenCalledWith(true)
  })

  it('caravana ligada: desligar avisa `false`; voltar a Normal avisa `normal`', () => {
    const { onCaravanaChange, onTipoChange } = render({ tipo: 'continente', caravana: true })
    const input = interruptorCaravana()
    expect(input?.checked).toBe(true)
    act(() => input?.click())
    expect(onCaravanaChange).toHaveBeenCalledWith(false)
    act(() => opcao('Normal').click())
    expect(onTipoChange).toHaveBeenCalledWith('normal')
  })

  it('chave "Relevo": mostra o valor resolvido, avisa ao trocar e tem a explicação ligada a ela', () => {
    const onRelevoChange = vi.fn()
    render({ tipo: 'continente', relevo: true, onRelevoChange })
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Relevo'))
    const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
    expect(input?.checked).toBe(true)
    const dica = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('sombra da terra no mar')
    act(() => input?.click())
    expect(onRelevoChange).toHaveBeenCalledWith(false)
  })

  it('chave "Nomes dos lugares": mostra o valor resolvido, avisa ao trocar e tem a explicação ligada a ela', () => {
    const onNomesDosLugaresChange = vi.fn()
    render({ tipo: 'continente', nomesDosLugares: true, onNomesDosLugaresChange })
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Nomes dos lugares'))
    const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
    expect(input?.checked).toBe(true)
    const dica = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('pílula')
    expect(dica?.textContent).toContain('já descobriu')
    act(() => input?.click())
    expect(onNomesDosLugaresChange).toHaveBeenCalledWith(false)
  })

  it('sem quem ouça a chave "Relevo" (tela antiga), ela não aparece', () => {
    render({ tipo: 'continente' })
    expect(container.textContent).not.toContain('Relevo')
  })

  it('a chave antiga "Mapa-mundi (caravana)" não está mais nas Configurações do mapa', () => {
    act(() => root.render(<MovementControls movement={undefined} onMovementChange={vi.fn()} />))
    expect(container.textContent).not.toContain('Mapa-mundi')
    expect(container.textContent).not.toContain('caravana')
  })
})
