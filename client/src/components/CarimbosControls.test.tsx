import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { DENSIDADE_PADRAO, LARGURA_DO_SPRAY_PADRAO, TAMANHO_DO_CARIMBO_PADRAO } from '../lib/carimbos'
import { useMapStore } from '../stores/mapStore'
import { CarimbosControls } from './CarimbosControls'

/*
 * Painel da ferramenta Carimbos: o que o próximo gesto faz, a biblioteca (os
 * oito embutidos e os importados), tamanho, largura e densidade — e nenhum
 * controle sem efeito na tela: a borracha não tem objeto, tamanho nem densidade.
 */

const IMAGEM = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAA='
let raiz: Root
let palco: HTMLDivElement

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  palco = document.createElement('div')
  document.body.appendChild(palco)
  raiz = createRoot(palco)
  useMapStore.getState().loadMap({ ...createEmptyMap('m', 'M', 20, 20, 50), continente: true })
  useMapStore.setState({
    carimboModo: 'carimbo',
    carimboEscolhido: 'pinheiro',
    carimboTamanho: TAMANHO_DO_CARIMBO_PADRAO,
    carimboLargura: LARGURA_DO_SPRAY_PADRAO,
    carimboDensidade: DENSIDADE_PADRAO,
  })
})

afterEach(() => {
  act(() => raiz.unmount())
  palco.remove()
  vi.restoreAllMocks()
})

function montar(): void {
  act(() => raiz.render(<CarimbosControls />))
}

function radios(nome: string): HTMLButtonElement[] {
  return Array.from(palco.querySelector(`[role="radiogroup"][aria-label="${nome}"]`)?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])
}

function botao(texto: string): HTMLButtonElement | undefined {
  return Array.from(palco.querySelectorAll('button')).find((b) => b.textContent === texto)
}

function mudarFaixa(rotulo: string, valor: number): void {
  const campo = Array.from(palco.querySelectorAll('label')).find((l) => l.textContent === rotulo)?.htmlFor
  const input = campo === undefined ? null : palco.querySelector<HTMLInputElement>(`#${campo}`)
  if (input === null) throw new Error(`sem a faixa ${rotulo}`)
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    set?.call(input, String(valor))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('CarimbosControls', () => {
  it('mostra os oito objetos da biblioteca, com o escolhido marcado, e escolher outro muda a ferramenta', () => {
    montar()
    const objetos = radios('Objeto')
    expect(objetos.map((b) => b.textContent)).toEqual(['Pinheiro', 'Pinheiro com neve', 'Árvore', 'Arbusto', 'Palmeira', 'Pedras', 'Poça', 'Juncos'])
    expect(objetos[0].getAttribute('aria-checked')).toBe('true')
    // Um só ponto de parada do Tab no grupo.
    expect(objetos.filter((b) => b.tabIndex === 0)).toHaveLength(1)
    act(() => objetos[4].click())
    expect(useMapStore.getState().carimboEscolhido).toBe('palmeira')
  })

  it('as setas andam pela grade de três em três; Home e End vão às pontas', () => {
    montar()
    const grade = palco.querySelector('[role="radiogroup"][aria-label="Objeto"]')
    const tecla = (key: string) => act(() => grade?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
    tecla('ArrowDown')
    expect(useMapStore.getState().carimboEscolhido).toBe('arbusto')
    tecla('ArrowRight')
    expect(useMapStore.getState().carimboEscolhido).toBe('palmeira')
    tecla('End')
    expect(useMapStore.getState().carimboEscolhido).toBe('juncos')
    tecla('Home')
    expect(useMapStore.getState().carimboEscolhido).toBe('pinheiro')
  })

  it('a borracha não mostra objeto, tamanho nem densidade; a largura vira a da borracha', () => {
    montar()
    act(() => radios('Ao clicar')[1].click())
    expect(useMapStore.getState().carimboModo).toBe('borracha')
    expect(radios('Objeto')).toHaveLength(0)
    const rotulos = Array.from(palco.querySelectorAll('label')).map((l) => l.textContent)
    expect(rotulos).toEqual(['Largura da borracha'])
  })

  it('as faixas mudam a ferramenta na hora', () => {
    montar()
    mudarFaixa('Tamanho', 150)
    mudarFaixa('Largura do spray', 90)
    mudarFaixa('Densidade do spray', 0.8)
    const s = useMapStore.getState()
    expect([s.carimboTamanho, s.carimboLargura, s.carimboDensidade]).toEqual([150, 90, 0.8])
    expect(palco.textContent).toContain('150%')
    expect(palco.textContent).toContain('80%')
  })

  it('o importado entra na grade e pode ser removido; a contagem e o "apagar todos" só aparecem com objeto', () => {
    act(() => {
      useMapStore.getState().importarCarimbo('Farol', IMAGEM)
    })
    montar()
    expect(radios('Objeto').map((b) => b.textContent)).toContain('Farol')
    expect(botao('Apagar todos os objetos')).toBeUndefined()
    const remover = botao('Remover “Farol”')
    expect(remover).toBeDefined()
    act(() => remover?.click())
    expect(radios('Objeto').map((b) => b.textContent)).not.toContain('Farol')
    act(() => {
      useMapStore.getState().carimbar([{ id: 'a', tipo: 'pinheiro', x: 1, y: 1, tamanho: 20, giro: 0 }])
    })
    expect(palco.textContent).toContain('1 objeto nesta cena')
    act(() => botao('Apagar todos os objetos')?.click())
    expect(useMapStore.getState().map.carimbos).toBeUndefined()
  })
})
