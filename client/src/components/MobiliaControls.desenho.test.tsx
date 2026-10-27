import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { useMapStore } from '../stores/mapStore'
import { MATERIAIS } from '../texturas/meioTermo/materiais'
import { MobiliaControls, type ParteDoMovel } from './MobiliaControls'

/**
 * MT12, o DESENHO do móvel no painel com o Meio-Termo ligado: "Desenho"
 * (Textura | Linhas) no essencial, só nos 11 móveis de antes; grava
 * `mobiliaDesenho` com desfazer. A ficha Aparência segue o desenho: com
 * textura, o MATERIAL de cada lugar (sem "Preencher" nem cor livre, que não
 * mudariam nada na imagem); em linhas, os controles de sempre.
 */

function movel(id: string, extra: Partial<Prop> = {}): Prop {
  return { id, src: '', x: 100, y: 100, width: 50, height: 50, linkedMapPath: null, mobilia: 'mesa', ...extra }
}

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
  trocarObraNoTeste()
})

function porNoMapa(props: Prop[]): void {
  useMapStore.setState({ map: { ...useMapStore.getState().map, props }, selection: [], past: [], future: [] })
}

function doMapa(id: string): Prop {
  const achado = useMapStore.getState().map.props.find((p) => p.id === id)
  if (achado === undefined) throw new Error(`sem ${id}`)
  return achado
}

function render(id: string, parte: ParteDoMovel): void {
  const nada = (): void => {}
  act(() =>
    root.render(
      <MobiliaControls
        parte={parte}
        prop={doMapa(id)}
        onTipoChange={nada}
        onVistaChange={nada}
        onFormaChange={nada}
        onAparenciaChange={(alvo, pedido) => useMapStore.getState().setAparenciaDoMovel(alvo, pedido)}
      />,
    ),
  )
}

function opcao(grupo: string, nome: string): HTMLButtonElement | undefined {
  const radios = container.querySelector(`[role="radiogroup"][aria-label="${grupo}"]`)?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  return [...(radios ?? [])].find((b) => b.textContent === nome)
}

function lugares(): string[] {
  return [...container.querySelectorAll('.lb-material .lb-label')].map((l) => l.textContent ?? '')
}

function temPreencher(): boolean {
  return [...container.querySelectorAll('label.lb-switch')].some((l) => l.textContent?.includes('Preencher'))
}

describe('"Desenho" no essencial do móvel', () => {
  it('com a obra, na mesa: Textura marcada; Linhas grava o pedido, Ctrl+Z (desfazer) volta, Textura tira o campo', () => {
    trocarObraNoTeste(true)
    porNoMapa([movel('mesa')])
    render('mesa', 'essencial')
    expect(opcao('Desenho', 'Textura')?.getAttribute('aria-checked')).toBe('true')
    expect(opcao('Desenho', 'Linhas')?.getAttribute('aria-checked')).toBe('false')

    act(() => opcao('Desenho', 'Linhas')?.click())
    expect(doMapa('mesa').mobiliaDesenho).toBe('linhas')
    render('mesa', 'essencial')
    expect(opcao('Desenho', 'Linhas')?.getAttribute('aria-checked')).toBe('true')

    act(() => useMapStore.getState().undo())
    expect('mobiliaDesenho' in doMapa('mesa')).toBe(false)
    act(() => useMapStore.getState().redo())
    expect(doMapa('mesa').mobiliaDesenho).toBe('linhas')

    render('mesa', 'essencial')
    act(() => opcao('Desenho', 'Textura')?.click())
    expect('mobiliaDesenho' in doMapa('mesa')).toBe(false)
  })

  it('não aparece na peça nova (nasceu com textura) nem com a obra desligada', () => {
    trocarObraNoTeste(true)
    porNoMapa([movel('redonda', { mobilia: 'mesaRedonda' })])
    render('redonda', 'essencial')
    expect(container.querySelector('[aria-label="Desenho"]')).toBeNull()

    trocarObraNoTeste(false)
    porNoMapa([movel('mesa')])
    render('mesa', 'essencial')
    expect(container.querySelector('[aria-label="Desenho"]')).toBeNull()
  })
})

describe('Aparência do móvel de antes segue o desenho', () => {
  it('com textura: o material de cada lugar, sem "Preencher"; em linhas: "Preencher" e a cor livre, sem material', () => {
    trocarObraNoTeste(true)
    porNoMapa([movel('mesa'), movel('mesa-em-linhas', { mobiliaDesenho: 'linhas' })])
    render('mesa', 'aparencia')
    expect(lugares()).toEqual(['Madeira'])
    expect(temPreencher()).toBe(false)

    render('mesa-em-linhas', 'aparencia')
    expect(lugares()).toEqual([])
    expect(temPreencher()).toBe(true)
  })

  it('a obra desligada mostra os controles de sempre', () => {
    trocarObraNoTeste(false)
    porNoMapa([movel('mesa')])
    render('mesa', 'aparencia')
    expect(lugares()).toEqual([])
    expect(temPreencher()).toBe(true)
  })

  it('a cama: madeira, cobertor e travesseiro gravam nos 3 campos de hoje', () => {
    trocarObraNoTeste(true)
    porNoMapa([movel('cama', { mobilia: 'catre', width: 50, height: 100 })])
    render('cama', 'aparencia')
    expect(lugares()).toEqual(['Madeira', 'Cobertor', 'Travesseiro'])
    const amostra = (lugar: string, nome: string): HTMLButtonElement | undefined => {
      const campo = [...container.querySelectorAll('.lb-material')].find((c) => c.querySelector('.lb-label')?.textContent === lugar)
      return [...(campo?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])].find((b) => b.getAttribute('aria-label') === nome)
    }
    act(() => amostra('Cobertor', MATERIAIS.azul.nome)?.click())
    expect(doMapa('cama').mobiliaCorDoCobertor).toBe(MATERIAIS.azul.hex)
    render('cama', 'aparencia')
    act(() => amostra('Travesseiro', MATERIAIS.ocre.nome)?.click())
    expect(doMapa('cama').mobiliaCorDoTravesseiro).toBe(MATERIAIS.ocre.hex)
    render('cama', 'aparencia')
    act(() => amostra('Madeira', MATERIAIS.pinho.nome)?.click())
    expect(doMapa('cama').mobiliaCor).toBe(MATERIAIS.pinho.hex)
  })

  it('a cerca: "Varas" (o padrão, sem cor própria) é escolha; Arame grava a cor da linha e Varas tira', () => {
    trocarObraNoTeste(true)
    porNoMapa([movel('cerca', { mobilia: 'cerca', width: 100, height: 10 })])
    render('cerca', 'aparencia')
    expect(lugares()).toEqual(['Mourões', 'Entre os mourões'])
    const ligacao = (nome: string): HTMLButtonElement | undefined => {
      const campo = [...container.querySelectorAll('.lb-material')].find((c) => c.querySelector('.lb-label')?.textContent === 'Entre os mourões')
      return [...(campo?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])].find((b) => b.getAttribute('aria-label') === nome)
    }
    expect(ligacao('Varas')?.getAttribute('aria-checked')).toBe('true')
    act(() => ligacao(MATERIAIS.arame.nome)?.click())
    expect(doMapa('cerca').mobiliaCorDaLinha).toBe(MATERIAIS.arame.hex)
    render('cerca', 'aparencia')
    expect(ligacao(MATERIAIS.arame.nome)?.getAttribute('aria-checked')).toBe('true')
    act(() => ligacao('Varas')?.click())
    expect('mobiliaCorDaLinha' in doMapa('cerca')).toBe(false)
  })

  it('a cadeira: o assento só tem palha gravável (a madeira do assento não cabe nos campos), então só a Madeira aparece', () => {
    trocarObraNoTeste(true)
    porNoMapa([movel('cadeira', { mobilia: 'cadeira', width: 25, height: 25 })])
    render('cadeira', 'aparencia')
    expect(lugares()).toEqual(['Madeira'])
  })
})
