import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useLivroDoMestreStore } from '../../stores/livroDoMestreStore'
import { SEM_SELECAO, useFichaAFrente, type AlvoDaFicha, type FichaAFrente } from './useFichaAFrente'

/*
 * A Ficha vem à frente pelo GESTO, como o armar() e o selecionar() do
 * protótipo (prototipo/js/app.js): clicar de novo no token selecionado ou na
 * ferramenta já armada também a traz, e pelo ponteiro ela entra animada; pelo
 * atalho de teclado, troca na hora.
 */

describe('useFichaAFrente — a Ficha vem à frente pelo gesto', () => {
  let container: HTMLDivElement
  let root: Root
  let agora: AlvoDaFicha
  let ficha: FichaAFrente | null = null
  let mapa: HTMLCanvasElement

  function Sonda({ alvo }: { alvo: AlvoDaFicha }) {
    ficha = useFichaAFrente(alvo.ferramenta, alvo.selecao, () => agora, 'select')
    return null
  }

  function mostrar(alvo: AlvoDaFicha): void {
    agora = alvo
    act(() => root.render(<Sonda alvo={alvo} />))
  }

  function clicarNoMapa(x = 10, y = 10, mudarPara?: AlvoDaFicha): void {
    act(() => {
      ficha?.apertarNoMapa({ button: 0, clientX: x, clientY: y, target: mapa })
      if (mudarPara !== undefined) mostrar(mudarPara)
    })
    act(() => {
      mapa.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: x, clientY: y }))
    })
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useLivroDoMestreStore.setState({ pagina: 'ficha', recolhido: false, novoTokenAberto: false, trocaAnimada: false })
    container = document.createElement('div')
    document.body.appendChild(container)
    mapa = document.createElement('canvas')
    document.body.appendChild(mapa)
    root = createRoot(container)
    mostrar({ ferramenta: 'select', selecao: 'token:t1||' })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    mapa.remove()
  })

  it('clicar de novo no token já selecionado, com a Cena aberta, traz a Ficha animada e tira o livro da lombada', () => {
    act(() => useLivroDoMestreStore.setState({ pagina: 'cena', recolhido: true }))
    clicarNoMapa()
    expect(useLivroDoMestreStore.getState()).toMatchObject({ pagina: 'ficha', recolhido: false, trocaAnimada: true })
  })

  it('selecionar outro token com o mouse traz a Ficha animada', () => {
    act(() => useLivroDoMestreStore.setState({ pagina: 'aventura' }))
    clicarNoMapa(10, 10, { ferramenta: 'select', selecao: 'token:t2||' })
    expect(useLivroDoMestreStore.getState()).toMatchObject({ pagina: 'ficha', trocaAnimada: true })
  })

  it('arrastar no mapa (pan) com algo selecionado não troca a página', () => {
    act(() => useLivroDoMestreStore.setState({ pagina: 'cena' }))
    act(() => ficha?.apertarNoMapa({ button: 0, clientX: 10, clientY: 10, target: mapa }))
    act(() => {
      mapa.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 80, clientY: 10 }))
    })
    expect(useLivroDoMestreStore.getState().pagina).toBe('cena')
  })

  it('clicar no mapa vazio (a seleção some) não troca a página', () => {
    act(() => useLivroDoMestreStore.setState({ pagina: 'cena' }))
    clicarNoMapa(10, 10, { ferramenta: 'select', selecao: SEM_SELECAO })
    expect(useLivroDoMestreStore.getState().pagina).toBe('cena')
  })

  it('clicar de novo na ferramenta já armada traz a Ficha animada', () => {
    mostrar({ ferramenta: 'wall', selecao: SEM_SELECAO })
    act(() => useLivroDoMestreStore.setState({ pagina: 'cena', recolhido: true }))
    act(() => ficha?.armarPeloPonteiro('wall'))
    expect(useLivroDoMestreStore.getState()).toMatchObject({ pagina: 'ficha', recolhido: false, trocaAnimada: true })
  })

  it('armar outra ferramenta pela barra traz a Ficha animada; pelo atalho, na hora', () => {
    act(() => useLivroDoMestreStore.setState({ pagina: 'cena' }))
    act(() => {
      ficha?.armarPeloPonteiro('wall')
      mostrar({ ferramenta: 'wall', selecao: SEM_SELECAO })
    })
    expect(useLivroDoMestreStore.getState()).toMatchObject({ pagina: 'ficha', trocaAnimada: true })
    act(() => useLivroDoMestreStore.setState({ pagina: 'cena' }))
    mostrar({ ferramenta: 'door', selecao: SEM_SELECAO })
    expect(useLivroDoMestreStore.getState()).toMatchObject({ pagina: 'ficha', trocaAnimada: false })
  })

  it('o que nasce do Acervo deixa o Acervo aberto', () => {
    act(() => useLivroDoMestreStore.setState({ pagina: 'acervo' }))
    act(() => ficha?.marcarSelecaoDoAcervo())
    mostrar({ ferramenta: 'select', selecao: 'token:t9||' })
    expect(useLivroDoMestreStore.getState().pagina).toBe('acervo')
  })
})
