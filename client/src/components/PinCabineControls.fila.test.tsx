import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CabineDeTransporte } from '../lib/cabine'
import { PinCabineControls, type PinCabineControlsProps } from './PinCabineControls'

/**
 * CABINE DE TRANSPORTE no painel do pino (mestre) — FILA e OCUPANTE: o mestre
 * lê quem chamou, na ordem, atende a primeira chamada (a cabine vai até lá),
 * limpa a fila, e lê quem está dentro esperando o "Deixar ir".
 */

const AQUI = { sceneId: 'cena-terreo', pinId: 'grade-terreo' }
const LA = { sceneId: 'cena-topo', pinId: 'grade-topo' }
const PORAO = { sceneId: 'cena-porao', pinId: 'grade-porao' }
const NOMES: Record<string, string> = { 'cena-terreo': 'Térreo', 'cena-topo': 'Topo do Farol', 'cena-porao': 'Porão' }

const COM_FILA: CabineDeTransporte = {
  id: 'cab-espinha',
  nome: 'Espinha',
  paradas: [AQUI, LA, PORAO],
  atual: AQUI,
  fila: [
    { parada: LA, tokenId: 'bia', nome: 'Bia' },
    { parada: PORAO, tokenId: 'caio', nome: 'Caio' },
  ],
}

describe('PinCabineControls: fila e ocupante', () => {
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

  function montar(extra: Partial<PinCabineControlsProps> = {}) {
    const props: PinCabineControlsProps = {
      cabines: [COM_FILA],
      parada: AQUI,
      nomeDaCena: (sceneId) => NOMES[sceneId] ?? 'Cena sem nome',
      onCriar: vi.fn(),
      onEscolher: vi.fn(),
      onTrazer: vi.fn(),
      onAtender: vi.fn(),
      onLimparFila: vi.fn(),
      ...extra,
    }
    act(() => root.render(<PinCabineControls {...props} />))
    return props
  }

  const botao = (texto: string): HTMLButtonElement => {
    const el = [...container.querySelectorAll('button')].find((b) => b.textContent === texto)
    if (el === undefined) throw new Error(`sem o botão ${texto}`)
    return el
  }

  it('a fila aparece em ordem, com a cena e quem chamou; "Atender a próxima chamada" atende a primeira', () => {
    const props = montar()
    const fila = container.querySelector('ol[aria-label="Fila de chamadas"]')
    expect([...(fila?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual(['Topo do Farol · Bia', 'Porão · Caio'])
    act(() => botao('Atender a próxima chamada').click())
    expect(props.onAtender).toHaveBeenCalledWith('cab-espinha')
    act(() => botao('Limpar a fila').click())
    expect(props.onLimparFila).toHaveBeenCalledWith('cab-espinha')
  })

  it('sem chamadas: diz que ninguém chamou e não oferece atender nem limpar', () => {
    montar({ cabines: [{ ...COM_FILA, fila: undefined }] })
    expect(container.textContent).toContain('Ninguém chamou a cabine.')
    expect(container.querySelector('ol[aria-label="Fila de chamadas"]')).toBeNull()
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Trazer a cabine para cá'])
  })

  it('com alguém dentro, o mestre lê quem é e que espera o "Deixar ir"', () => {
    montar({ ocupantes: { 'cab-espinha': 'Ana' } })
    expect(container.textContent).toContain('Na cabine: Ana, esperando você deixar ir.')
  })

  it('ocupante de outra cabine não aparece nesta', () => {
    montar({ ocupantes: { 'cab-outra': 'Ana' } })
    expect(container.textContent).not.toContain('Na cabine')
  })
})
