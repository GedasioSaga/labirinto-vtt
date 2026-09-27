import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { EstadoDoMundo } from '../lib/estadoDoMundo'
import type { RotinaDoNpc, Token } from '../types/map'
import { ROTINA_HINT, ROTINA_SEM_ESTADO, RotinaDaFichaControls } from './RotinaDaFichaControls'
import { trocaText } from './WorldStateSection'

describe('trocaText: o aviso do apito conta as fichas que foram ao posto', () => {
  it('só fichas, fichas e elementos, e o aviso antigo quando nenhuma andou', () => {
    expect(trocaText('Apito', 'Meio', { elementos: 0, cenas: 2, fichas: 3 })).toBe('Apito: Meio. 3 fichas foram ao posto em 2 cenas.')
    expect(trocaText('Apito', 'Meio', { elementos: 1, cenas: 1, fichas: 1 })).toBe('Apito: Meio. 1 elemento mudou e 1 ficha foi ao posto em 1 cena.')
    expect(trocaText('Apito', 'Meio', { elementos: 0, cenas: 0 })).toBe('Apito: Meio. Nenhum elemento mudou.')
  })
})

const APITO: EstadoDoMundo = { id: 'apito', nome: 'Apito', valores: ['Aurora', 'Meio', 'Brasa'], atual: 'Aurora' }
const CENAS = [
  { id: 'capela', name: 'Capela' },
  { id: 'conf', name: 'Confessionário 77' },
]

function tobias(rotina?: RotinaDoNpc): Token {
  const base: Token = { id: 'tobias', characterId: null, name: 'Irmão Tobias', x: 120, y: 80, size: 1, image: null, npc: true }
  return rotina === undefined ? base : { ...base, rotina }
}

describe('RotinaDaFichaControls: a rotina da ficha no painel do mestre', () => {
  let container: HTMLDivElement
  let root: Root
  let recebidas: (RotinaDoNpc | undefined)[]

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    recebidas = []
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(token: Token, estados: readonly EstadoDoMundo[] = [APITO], cenaAberta = 'capela'): void {
    act(() =>
      root.render(<RotinaDaFichaControls token={token} estados={estados} cenas={CENAS} cenaAberta={cenaAberta} onChange={(r) => recebidas.push(r)} />),
    )
  }

  function lista(rotulo: string): HTMLSelectElement {
    const label = Array.from(container.querySelectorAll('label')).find((l) => (l.textContent ?? '').trim().startsWith(rotulo))
    const alvo = label === undefined ? null : document.getElementById(label.htmlFor)
    if (!(alvo instanceof HTMLSelectElement)) throw new Error(`sem lista "${rotulo}"`)
    return alvo
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === nome)
    if (achado === undefined) throw new Error(`sem botão "${nome}"`)
    return achado
  }

  function escolher(select: HTMLSelectElement, valor: string): void {
    act(() => {
      select.value = valor
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  it('sem estado na aventura: diz como começar, sem lista', () => {
    render(tobias(), [])
    expect(container.textContent).toContain('Estado do mundo')
    expect(container.querySelector('select')).toBeNull()
  })

  it('sem estado é UMA linha apagada: "Rotina" e o que falta no lugar da lista, nada clicável', () => {
    render(tobias(), [])
    const secao = container.querySelector('section')
    expect(secao?.classList.contains('lb-token-linha')).toBe(true)
    const linha = secao?.querySelector('.lb-token-par--vazio')
    expect(linha?.querySelector('.lb-label')?.textContent).toBe('Rotina')
    expect(linha?.textContent).toContain(ROTINA_SEM_ESTADO)
    expect(secao?.querySelector('button, select, input')).toBeNull()
  })

  it('com estado e sem rotina, é UMA linha: "Rotina por" ao lado da lista, com a frase do que ela faz ligada à lista', () => {
    render(tobias())
    const secao = container.querySelector('section')
    expect(secao?.classList.contains('lb-token-linha')).toBe(true)
    const par = secao?.querySelector('.lb-token-par')
    expect(par?.contains(lista('Rotina por'))).toBe(true)
    expect(secao?.querySelector('ul')).toBeNull()
    const dica = document.getElementById(lista('Rotina por').getAttribute('aria-describedby') ?? 'sem-id')
    expect(dica?.textContent).toBe(ROTINA_HINT)
  })

  it('com rotina, os turnos aparecem embaixo da linha da lista', () => {
    render(tobias({ estadoId: 'apito', postos: [] }))
    const secao = container.querySelector('section')
    expect(secao?.firstElementChild?.contains(lista('Rotina por'))).toBe(true)
    expect(secao?.querySelector('.lb-token-linha__corpo ul')?.querySelectorAll('li')).toHaveLength(3)
  })

  it('escolher o estado começa a rotina sem posto nenhum', () => {
    render(tobias())
    escolher(lista('Rotina por'), 'apito')
    expect(recebidas).toEqual([{ estadoId: 'apito', postos: [] }])
  })

  it('"Gravar aqui" grava a cena aberta e o lugar ATUAL da ficha naquele turno', () => {
    render(tobias({ estadoId: 'apito', postos: [] }), [APITO], 'conf')
    act(() => botao('Gravar aqui para Meio').click())
    expect(recebidas).toEqual([{ estadoId: 'apito', postos: [{ valor: 'Meio', sceneId: 'conf', x: 120, y: 80 }] }])
  })

  it('cada turno mostra onde a ficha vai; "Tirar" apaga só aquele posto', () => {
    const rotina: RotinaDoNpc = {
      estadoId: 'apito',
      postos: [
        { valor: 'Aurora', sceneId: 'capela', x: 1, y: 1 },
        { valor: 'Meio', sceneId: 'conf', x: 2, y: 2 },
      ],
    }
    render(tobias(rotina))
    expect(container.textContent).toContain('Confessionário 77')
    expect(container.textContent).toContain('Fica onde está')
    act(() => botao('Tirar posto de Aurora').click())
    expect(recebidas).toEqual([{ estadoId: 'apito', postos: [{ valor: 'Meio', sceneId: 'conf', x: 2, y: 2 }] }])
  })

  it('"Nenhuma" tira a rotina da ficha', () => {
    render(tobias({ estadoId: 'apito', postos: [{ valor: 'Aurora', sceneId: 'capela', x: 1, y: 1 }] }))
    escolher(lista('Rotina por'), '')
    expect(recebidas).toEqual([undefined])
  })

  describe('"Andar sozinha": a rotina vira macro', () => {
    let pedidos: boolean[]

    beforeEach(() => {
      pedidos = []
    })

    function renderAndando(token: Token, andando: boolean): void {
      act(() =>
        root.render(
          <RotinaDaFichaControls
            token={token}
            estados={[APITO]}
            cenas={CENAS}
            cenaAberta="capela"
            onChange={(r) => recebidas.push(r)}
            andando={andando}
            onAndar={(ligar) => pedidos.push(ligar)}
          />,
        ),
      )
    }

    const comPostos: RotinaDoNpc = {
      estadoId: 'apito',
      postos: [
        { valor: 'Aurora', sceneId: 'capela', x: 1, y: 1 },
        { valor: 'Meio', sceneId: 'conf', x: 2, y: 2 },
      ],
    }

    it('parada: "Andar sozinha" pede para ligar', () => {
      renderAndando(tobias(comPostos), false)
      const andar = botao('Andar sozinha')
      expect(andar.getAttribute('aria-pressed')).toBe('false')
      act(() => andar.click())
      expect(pedidos).toEqual([true])
      // Ligar não mexe na rotina gravada.
      expect(recebidas).toEqual([])
    })

    it('andando: o mesmo botão diz que está andando e pede para parar', () => {
      renderAndando(tobias(comPostos), true)
      const andar = botao('Andar sozinha')
      expect(andar.getAttribute('aria-pressed')).toBe('true')
      expect(andar.textContent).toContain('Parar')
      act(() => andar.click())
      expect(pedidos).toEqual([false])
    })

    it('sem posto gravado não há para onde andar: botão apagado', () => {
      renderAndando(tobias({ estadoId: 'apito', postos: [] }), false)
      expect(botao('Andar sozinha').disabled).toBe(true)
    })

    it('sem quem ligue (painel sem o relógio da rotina), o botão não aparece', () => {
      render(tobias(comPostos))
      expect(Array.from(container.querySelectorAll('button')).some((b) => b.getAttribute('aria-label') === 'Andar sozinha')).toBe(false)
    })
  })
})
