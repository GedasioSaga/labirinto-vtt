/**
 * O cartão do recado avisa que fechar não perde nada: o recado fica no
 * Caderno. O texto da Sala usa o mesmo cartão e não ganha o aviso (ele não
 * entra no Caderno).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PlayerNoteCard } from './PlayerNoteCard'

describe('PlayerNoteCard: aviso de que o recado fica no Caderno', () => {
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

  it('recado com aviso: a linha aparece dentro do cartão, depois do texto, e o texto do recado segue intacto', () => {
    act(() => root.render(<PlayerNoteCard text="o baú tem fundo falso" hint="Fica guardado no Caderno do Painel." onClose={() => {}} />))
    const aviso = container.querySelector('.pp-note__hint')
    expect(aviso?.textContent).toBe('Fica guardado no Caderno do Painel.')
    expect(container.querySelector('.pp-note__text')?.textContent).toBe('o baú tem fundo falso')
    // Ordem de leitura: título, recado, aviso, "Fechar".
    const ordem = Array.from(container.querySelectorAll('.pp-note > *')).map((el) => el.className)
    expect(ordem).toEqual(['pp-note__title', 'pp-note__text', 'pp-note__hint', 'pp-note__close'])
  })

  it('sem aviso (texto da Sala): nenhuma linha a mais no cartão', () => {
    act(() => root.render(<PlayerNoteCard title="Cozinha" text="Pão queimado." onClose={() => {}} />))
    expect(container.querySelector('.pp-note__hint')).toBeNull()
    expect(container.querySelectorAll('.pp-note > *')).toHaveLength(3)
  })
})
