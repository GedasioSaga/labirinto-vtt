import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { EstadoDoMundo } from '../lib/estadoDoMundo'
import type { RotinaDoNpc, Token } from '../types/map'
import { RotinaDaFichaControls } from './RotinaDaFichaControls'
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
})
