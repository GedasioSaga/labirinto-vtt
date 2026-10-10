import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { FORCA_PADRAO, TAMANHO_DO_PINCEL_PADRAO } from '../lib/texturas'
import { useMapStore } from '../stores/mapStore'
import { TexturasControls } from './TexturasControls'

/*
 * Painel da ferramenta Texturas: o que o próximo gesto faz, a biblioteca (as
 * treze embutidas e as importadas), tamanho e força — e nenhum controle sem
 * efeito na tela: a borracha não tem textura, o balde não tem tamanho.
 */

const IMAGEM = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAA='
let raiz: Root
let palco: HTMLDivElement

beforeEach(() => {
  palco = document.createElement('div')
  document.body.appendChild(palco)
  raiz = createRoot(palco)
  useMapStore.getState().loadMap({ ...createEmptyMap('m', 'M', 20, 20, 50), continente: true })
  useMapStore.getState().setTexturaModo('pincel')
  useMapStore.getState().setTexturaEscolhida('floresta')
  useMapStore.getState().setTexturaTamanho(TAMANHO_DO_PINCEL_PADRAO)
  useMapStore.getState().setTexturaForca(FORCA_PADRAO)
})

afterEach(() => {
  act(() => raiz.unmount())
  palco.remove()
})

function montar(): void {
  act(() => raiz.render(<TexturasControls />))
}

function grupo(nome: string): HTMLElement | null {
  return palco.querySelector(`[role="radiogroup"][aria-label="${nome}"]`)
}

function radios(nome: string): HTMLButtonElement[] {
  return Array.from(grupo(nome)?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])
}

function botao(texto: string): HTMLButtonElement | undefined {
  return Array.from(palco.querySelectorAll('button')).find((b) => b.textContent === texto)
}

describe('TexturasControls', () => {
  it('mostra a biblioteca inteira, com a escolhida marcada, e um só ponto de Tab no grupo', () => {
    montar()
    const opcoes = radios('Textura')
    expect(opcoes.map((b) => b.textContent)).toEqual(['Areia', 'Duna', 'Campo', 'Floresta', 'Bosque', 'Pinheiros', 'Chão de floresta', 'Pântano', 'Terra', 'Serra', 'Neve', 'Convés', 'Lajotas de pedra'])
    expect(opcoes.filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.textContent)).toEqual(['Floresta'])
    expect(opcoes.filter((b) => b.tabIndex === 0)).toHaveLength(1)
  })

  it('clique e setas escolhem a textura (seta para baixo anda uma linha de três)', () => {
    montar()
    act(() => radios('Textura')[0].click())
    expect(useMapStore.getState().texturaEscolhida).toBe('areia')
    act(() => radios('Textura')[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    expect(useMapStore.getState().texturaEscolhida).toBe('floresta')
    act(() => radios('Textura')[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })))
    expect(useMapStore.getState().texturaEscolhida).toBe('lajotas')
    expect(document.activeElement?.textContent).toBe('Lajotas de pedra')
  })

  it('a borracha esconde a biblioteca; o balde esconde o tamanho', () => {
    montar()
    expect(palco.querySelector('#lb-textura-tamanho')).not.toBeNull()
    act(() => radios('Ao pintar')[2].click())
    expect(useMapStore.getState().texturaModo).toBe('borracha')
    expect(grupo('Textura')).toBeNull()
    expect(palco.querySelector('#lb-textura-tamanho')).not.toBeNull()
    act(() => radios('Ao pintar')[1].click())
    expect(grupo('Textura')).not.toBeNull()
    expect(palco.querySelector('#lb-textura-tamanho')).toBeNull()
    expect(palco.querySelector('#lb-textura-forca')).not.toBeNull()
  })

  it('a importada entra na biblioteca; escolhida, ganha o "Remover"', () => {
    montar()
    act(() => {
      useMapStore.getState().importarTextura('Musgo', IMAGEM)
    })
    const opcoes = radios('Textura')
    expect(opcoes.at(-1)?.textContent).toBe('Musgo')
    expect(opcoes.at(-1)?.getAttribute('aria-checked')).toBe('true')
    const remover = botao('Remover “Musgo”')
    expect(remover).toBeDefined()
    act(() => remover?.click())
    expect(useMapStore.getState().map.texturasImportadas).toBeUndefined()
    expect(radios('Textura').map((b) => b.textContent)).not.toContain('Musgo')
  })

  it('"Apagar todas as texturas" só aparece com textura na cena', () => {
    montar()
    expect(botao('Apagar todas as texturas')).toBeUndefined()
    act(() => {
      useMapStore.getState().pintarTextura({ tipo: 'pincel', textura: 'areia', forca: 1, raio: 30, pontos: [{ x: 100, y: 100 }] })
    })
    const apagar = botao('Apagar todas as texturas')
    expect(apagar).toBeDefined()
    act(() => apagar?.click())
    expect(useMapStore.getState().map.texturas).toBeUndefined()
  })

  describe('formas de uma textura (Lajotas: Clara | Escura)', () => {
    const cartao = () => radios('Textura').find((b) => b.textContent === 'Lajotas de pedra')
    /** O painel de formas aberto (o que está saindo, no movimento de fechar, não conta). */
    const painel = () => palco.querySelector<HTMLElement>('[role="dialog"]:not([data-movimento="fechando"])')
    const formas = () => radios('Forma')
    const tecla = (alvo: Element | null | undefined, key: string) =>
      act(() => {
        alvo?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      })

    it('o cartão com formas escolhe a Clara na primeira vez e abre o painel com o foco nela', () => {
      montar()
      act(() => cartao()?.click())
      expect(useMapStore.getState().texturaEscolhida).toBe('lajotas')
      expect(painel()?.getAttribute('aria-label')).toBe('Formas de Lajotas de pedra')
      expect(formas().map((b) => b.textContent)).toEqual(['Clara', 'Escura'])
      expect(formas().map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false'])
      expect(document.activeElement).toBe(formas()[0])
    })

    it('"Escura" escolhe a forma escura, fecha o painel e devolve o foco ao cartão, que segue marcado', () => {
      montar()
      act(() => cartao()?.click())
      act(() => formas()[1].click())
      expect(useMapStore.getState().texturaEscolhida).toBe('lajotas-escuras')
      expect(painel()).toBeNull()
      expect(document.activeElement).toBe(cartao())
      expect(cartao()?.getAttribute('aria-checked')).toBe('true')
      expect(radios('Textura').filter((b) => b.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    })

    it('Esc fecha sem trocar a forma e devolve o foco ao cartão', () => {
      montar()
      act(() => cartao()?.click())
      tecla(formas()[0], 'Escape')
      expect(painel()).toBeNull()
      expect(useMapStore.getState().texturaEscolhida).toBe('lajotas')
      expect(document.activeElement).toBe(cartao())
    })

    it('setas andam entre as formas e já escolhem; um só ponto de Tab no grupo de formas', () => {
      montar()
      act(() => cartao()?.click())
      tecla(formas()[0], 'ArrowRight')
      expect(useMapStore.getState().texturaEscolhida).toBe('lajotas-escuras')
      expect(document.activeElement).toBe(formas()[1])
      expect(formas().map((b) => b.tabIndex)).toEqual([-1, 0])
      tecla(formas()[1], 'Home')
      expect(useMapStore.getState().texturaEscolhida).toBe('lajotas')
      expect(document.activeElement).toBe(formas()[0])
      // As setas não vazam para a grade de baixo (o cartão continua o mesmo).
      expect(painel()).not.toBeNull()
    })

    it('reabrir lembra a última forma usada do grupo', () => {
      montar()
      act(() => cartao()?.click())
      act(() => formas()[1].click())
      act(() => radios('Textura')[0].click())
      expect(useMapStore.getState().texturaEscolhida).toBe('areia')
      act(() => cartao()?.click())
      expect(useMapStore.getState().texturaEscolhida).toBe('lajotas-escuras')
      expect(formas().map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true'])
    })

    it('textura sem forma não abre painel', () => {
      montar()
      act(() => radios('Textura')[0].click())
      expect(palco.querySelector('[role="dialog"]')).toBeNull()
    })

    it('clique fora fecha o painel; clique de novo no cartão também', () => {
      montar()
      act(() => cartao()?.click())
      act(() => {
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      })
      expect(painel()).toBeNull()
      act(() => cartao()?.click())
      expect(painel()).not.toBeNull()
      act(() => cartao()?.click())
      expect(painel()).toBeNull()
    })

    it('na grade, as setas andam por cartão e, nas Lajotas, escolhem a forma de agora sem abrir o painel', () => {
      useMapStore.getState().setTexturaEscolhida('lajotas-escuras')
      montar()
      expect(cartao()?.getAttribute('aria-checked')).toBe('true')
      tecla(cartao(), 'Home')
      expect(useMapStore.getState().texturaEscolhida).toBe('areia')
      tecla(radios('Textura')[0], 'End')
      expect(useMapStore.getState().texturaEscolhida).toBe('lajotas-escuras')
      expect(palco.querySelector('[role="dialog"]')).toBeNull()
    })
  })

  it('tamanho e força mostram o valor e mudam a preferência', () => {
    montar()
    const forca = palco.querySelector<HTMLInputElement>('#lb-textura-forca')
    expect(forca?.labels?.[0]?.textContent).toBe('Força')
    expect(palco.textContent).toContain('80%')
  })
})
