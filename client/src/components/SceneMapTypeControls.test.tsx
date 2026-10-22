/**
 * "Tipo de mapa" do "Configurar cena": Normal | Continente, e a caravana
 * ("Grupo anda junto") só dentro do Continente. A chave antiga "Mapa-mundi
 * (caravana)" saiu das Configurações do mapa (`MovementControls`). As chaves
 * Relevo, Nomes dos lugares e Nuvens moram na seção "Mapa vivo" (fatia 20).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MovementControls } from './MovementControls'
import { SceneMapaVivoControls, SceneMapTypeControls, type SceneMapTypeControlsProps } from './SceneMapTypeControls'

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

/** A seção "Mapa vivo", com as mesmas props do Tipo de mapa (`SceneSettingsDialog`). */
function renderMapaVivo(props: Partial<SceneMapTypeControlsProps> = {}) {
  act(() =>
    root.render(<SceneMapaVivoControls tipo="continente" caravana={false} onTipoChange={vi.fn()} onCaravanaChange={vi.fn()} {...props} />),
  )
}

function chave(rotulo: string): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(rotulo))
  return label?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
}

function opcao(rotulo: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent === rotulo)
  if (found === undefined) throw new Error(`opção "${rotulo}" ausente`)
  return found
}

const interruptorCaravana = () => chave('Grupo anda junto')

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

  it('Mapa vivo, chave "Relevo": mostra o valor resolvido, avisa ao trocar e tem a explicação ligada a ela', () => {
    const onRelevoChange = vi.fn()
    renderMapaVivo({ relevo: true, onRelevoChange })
    const input = chave('Relevo')
    expect(input?.checked).toBe(true)
    const dica = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('sombra da terra no mar')
    act(() => input?.click())
    expect(onRelevoChange).toHaveBeenCalledWith(false)
  })

  it('Mapa vivo, chave "Nomes dos lugares": mostra o valor resolvido, avisa ao trocar e tem a explicação ligada a ela', () => {
    const onNomesDosLugaresChange = vi.fn()
    renderMapaVivo({ nomesDosLugares: true, onNomesDosLugaresChange })
    const input = chave('Nomes dos lugares')
    expect(input?.checked).toBe(true)
    const dica = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('pílula')
    expect(dica?.textContent).toContain('já descobriu')
    act(() => input?.click())
    expect(onNomesDosLugaresChange).toHaveBeenCalledWith(false)
  })

  it('Mapa vivo, chave "Nuvens": mostra o valor resolvido, avisa ao trocar e a explicação diz o que o jogador vê', () => {
    const onNuvensChange = vi.fn()
    renderMapaVivo({ nuvens: true, onNuvensChange })
    const input = chave('Nuvens')
    expect(input?.checked).toBe(true)
    const dica = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('sombra no chão')
    expect(dica?.textContent).toContain('Efeitos do mapa')
    act(() => input?.click())
    expect(onNuvensChange).toHaveBeenCalledWith(false)
  })

  it('Mapa vivo sem quem ouça as chaves (tela antiga): nenhuma aparece', () => {
    renderMapaVivo()
    expect(chave('Relevo')).toBeNull()
    expect(chave('Nomes dos lugares')).toBeNull()
    expect(chave('Nuvens')).toBeNull()
  })

  it('o Tipo de mapa não desenha mais as chaves do Mapa vivo, mesmo com quem as ouça', () => {
    render({ tipo: 'continente', onRelevoChange: vi.fn(), onNomesDosLugaresChange: vi.fn(), onNuvensChange: vi.fn() })
    expect(chave('Relevo')).toBeNull()
    expect(chave('Nomes dos lugares')).toBeNull()
    expect(chave('Nuvens')).toBeNull()
  })

  it('a chave antiga "Mapa-mundi (caravana)" não está mais nas Configurações do mapa', () => {
    act(() => root.render(<MovementControls movement={undefined} onMovementChange={vi.fn()} />))
    expect(container.textContent).not.toContain('Mapa-mundi')
    expect(container.textContent).not.toContain('caravana')
  })
})
