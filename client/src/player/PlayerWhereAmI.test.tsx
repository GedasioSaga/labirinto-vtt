import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerWhereAmI } from './PlayerWhereAmI'
import type { WhereAmI } from './whereAmI'

describe('PlayerWhereAmI (selo "Onde estou": cena e sala)', () => {
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

  function render(where: WhereAmI | null, showTokenName: boolean, onFocus: (tokenId: string) => void, sceneName?: string): void {
    act(() => root.render(<PlayerWhereAmI sceneName={sceneName} where={where} showTokenName={showTokenName} onFocus={onFocus} />))
  }

  function faixa(): HTMLButtonElement {
    const found = container.querySelector('button')
    if (!found) throw new Error('sem a faixa')
    return found
  }

  function anuncios(): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('[role="status"]')]
  }

  const noFarol: WhereAmI = { tokenId: 'ana', tokenName: 'Ana', trail: ['Farol', 'Farol, piso 5', 'Sala do Faroleiro'] }
  const foraDasSalas: WhereAmI = { tokenId: 'ana', tokenName: 'Ana', trail: [] }

  it('um botão de verdade com o caminho prédio › piso › cômodo', () => {
    render(noFarol, false, () => {})
    const button = faixa()
    expect(button.type).toBe('button')
    expect(button.textContent).toBe('Farol›Farol, piso 5›Sala do Faroleiro')
    expect(button.getAttribute('aria-label')).toBe('Onde estou: Farol › Farol, piso 5 › Sala do Faroleiro. Centralizar Ana')
    // O cômodo é o destaque: é ele que muda a cada passo.
    expect(button.querySelector('.pp-where__step--here')?.textContent).toBe('Sala do Faroleiro')
  })

  it('tocar na faixa centraliza a ficha que ela acompanha', () => {
    const onFocus = vi.fn()
    render(noFarol, false, onFocus)
    act(() => faixa().click())
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onFocus).toHaveBeenCalledWith('ana')
  })

  it('com duas fichas, diz de qual ficha é o caminho', () => {
    render(noFarol, true, () => {})
    expect(faixa().querySelector('.pp-where__who')?.textContent).toBe('Ana')
    render(noFarol, false, () => {})
    expect(faixa().querySelector('.pp-where__who')).toBeNull()
  })

  it('fora de toda Sala: "Fora das salas", e o toque continua centralizando', () => {
    const onFocus = vi.fn()
    render(foraDasSalas, false, onFocus)
    expect(faixa().textContent).toBe('Fora das salas')
    act(() => faixa().click())
    expect(onFocus).toHaveBeenCalledWith('ana')
  })

  it('sem ficha no mapa e sem nome de cena: nada aparece (nada clicável sem efeito)', () => {
    render(null, false, () => {})
    expect(container.querySelector('button')).toBeNull()
    expect(container.childElementCount).toBe(0)
  })

  describe('um selo só: o nome da cena entra no mesmo "Onde estou"', () => {
    // Antes eram dois, um embaixo do outro: o selo da cena ("ONDE ESTOU / Casa
    // do porto") e a faixa da sala ("Fora das salas").

    it('fora das salas: "Casa do porto · Fora das salas", num botão só, e a cena é o lugar em destaque', () => {
      render(foraDasSalas, false, () => {}, 'Casa do porto')
      expect(container.querySelectorAll('.pp-where')).toHaveLength(1)
      expect(faixa().textContent).toBe('Casa do porto·Fora das salas')
      expect(faixa().getAttribute('aria-label')).toBe('Onde estou: Casa do porto · Fora das salas. Centralizar Ana')
      expect(faixa().querySelector('.pp-where__scene--here')?.textContent).toBe('Casa do porto')
    })

    it('numa sala: a cena vem antes do caminho, e o destaque continua no cômodo', () => {
      render(noFarol, false, () => {}, 'Casa do porto')
      expect(faixa().textContent).toBe('Casa do porto·Farol›Farol, piso 5›Sala do Faroleiro')
      expect(faixa().getAttribute('aria-label')).toBe('Onde estou: Casa do porto · Farol › Farol, piso 5 › Sala do Faroleiro. Centralizar Ana')
      expect(faixa().querySelector('.pp-where__scene--here')).toBeNull()
      expect(faixa().querySelector('.pp-where__step--here')?.textContent).toBe('Sala do Faroleiro')
    })

    it('cena com o nome do prédio onde a ficha está não se repete ("Farol · Farol")', () => {
      render(noFarol, false, () => {}, 'Farol')
      expect(faixa().textContent).toBe('Farol›Farol, piso 5›Sala do Faroleiro')
      expect(faixa().getAttribute('aria-label')).toBe('Onde estou: Farol › Farol, piso 5 › Sala do Faroleiro. Centralizar Ana')
    })

    it('sem ficha no mapa: o selo mostra só a cena e não é botão (não há ficha para centralizar)', () => {
      render(null, false, () => {}, 'Casa do porto')
      expect(container.querySelector('button')).toBeNull()
      expect(container.querySelectorAll('.pp-where')).toHaveLength(1)
      expect(container.querySelector('.pp-where--static')?.textContent).toBe('Casa do porto')
    })

    it('a troca de cena é anunciada a quem usa leitor de tela, com ou sem ficha no mapa', () => {
      render(null, false, () => {}, 'Casa do porto')
      expect(anuncios().map((anuncio) => anuncio.textContent)).toEqual(['Onde estou: Casa do porto'])
      render(noFarol, false, () => {}, 'Cripta')
      expect(anuncios().map((anuncio) => anuncio.textContent)).toEqual(['Onde estou: Cripta'])
    })

    it('cena sem nome público: nem cena nem anúncio, o selo é só a sala', () => {
      render(noFarol, false, () => {}, '')
      expect(anuncios()).toEqual([])
      expect(faixa().textContent).toBe('Farol›Farol, piso 5›Sala do Faroleiro')
      render(null, false, () => {}, '')
      expect(container.childElementCount).toBe(0)
    })

    it('nome de cena com marcação sai como texto, nunca como HTML', () => {
      render(null, false, () => {}, '<img src=x onerror=alert(1)>')
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('.pp-where--static')?.textContent).toBe('<img src=x onerror=alert(1)>')
    })
  })
})
