/// <reference types="vite/client" />
/**
 * COLEÇÃO DE PISTAS do lado do mestre, pela costura inteira que o `App.tsx`
 * monta: pino aberto → `pinColecaoPanel` → `PinControls` → `PinColecaoControls`
 * → pino no mapa. Os testes de `PinColecaoControls` provam o componente
 * sozinho; este quebra se a peça sair do `PinControls` ou se o `App.tsx`
 * deixar de entregá-la.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import appSource from '../App.tsx?raw'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import type { Pin, PinColecao } from '../types/map'
import { PinControls } from './PinControls'
import { pinColecaoPanel } from './pinColecaoPanel'

const FOTO = 'data:image/png;base64,QklMSEVURQ=='
const LETREIRO: PinColecao = { nome: 'Letreiro', parte: 2, total: 3 }

function pino(id: string, description: string, image: string | null = null, colecao?: PinColecao): Pin {
  const pin: Pin = { id, x: 100, y: 100, kind: 'exclamacao', description, image }
  if (colecao !== undefined) pin.colecao = colecao
  return pin
}

function pinoNoMapa(id: string): Pin {
  const achado = useMapStore.getState().map.pins.find((p) => p.id === id)
  if (achado === undefined) throw new Error(`pino ${id} sumiu do mapa`)
  return achado
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
})

/** O painel do pino como o `App.tsx` o monta, lendo o pino atual do mapa. */
function renderPainel(pinId: string): void {
  const pin = pinoNoMapa(pinId)
  const pins = useMapStore.getState().map.pins
  act(() =>
    root.render(
      <PinControls
        kind={pin.kind}
        onKindChange={vi.fn()}
        description={pin.description}
        onDescriptionChange={vi.fn()}
        locked={false}
        onLockedChange={vi.fn()}
        image={pin.image}
        onChooseImage={vi.fn()}
        onClearImage={vi.fn()}
        onDelete={vi.fn()}
        colecao={pinColecaoPanel(pin, pins)}
      />,
    ),
  )
}

function interruptor(): HTMLInputElement {
  const achado = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((i) => i.closest('label')?.textContent?.includes('Peça de coleção'))
  if (achado === undefined) throw new Error('sem o interruptor "Peça de coleção" no painel do pino')
  return achado
}

function dica(): string | null | undefined {
  return container.querySelector('.lb-travel__hint')?.textContent
}

describe('painel do pino: a peça de coleção chega ao mapa', () => {
  it('ligar "Peça de coleção" no painel grava a peça no pino do mapa; as outras coleções da cena viram sugestão', () => {
    useMapStore.getState().loadMap({ ...createEmptyMap('m1', '', 10, 10, 50), pins: [pino('a', 'Letra A'), pino('b', 'Letra B', null, { nome: 'Mapa de Drenagem', parte: 1, total: 4 })] })
    renderPainel('a')
    act(() => interruptor().click())
    expect(pinoNoMapa('a').colecao).toEqual({ nome: '', parte: 1, total: 2 })
    renderPainel('a')
    expect([...container.querySelectorAll('datalist option')].map((o) => o.getAttribute('value'))).toEqual(['Mapa de Drenagem'])
    act(() => interruptor().click())
    expect(pinoNoMapa('a').colecao).toBeUndefined()
  })

  it('pino com texto, ou só com foto: a peça conta e o painel promete a casa', () => {
    useMapStore.getState().loadMap({ ...createEmptyMap('m1', '', 10, 10, 50), pins: [pino('texto', 'Letra A', null, LETREIRO), pino('foto', '', FOTO, LETREIRO)] })
    renderPainel('texto')
    expect(dica()).toBe('Quem lê esta peça ganha a casa 2 de “Letreiro” no Caderno.')
    renderPainel('foto')
    expect(dica()).toBe('Quem lê esta peça ganha a casa 2 de “Letreiro” no Caderno.')
  })

  it('pino sem texto e sem foto que o jogador receba (vazio, ou foto em caminho de disco): o painel avisa que a peça não conta', () => {
    useMapStore.getState().loadMap({ ...createEmptyMap('m1', '', 10, 10, 50), pins: [pino('vazio', '   ', null, LETREIRO), pino('disco', '', 'C:/fotos/letra.png', LETREIRO)] })
    renderPainel('vazio')
    expect(dica()).toBe('Sem texto nem imagem, ninguém lê este pino: a peça não conta.')
    renderPainel('disco')
    expect(dica()).toBe('Sem texto nem imagem, ninguém lê este pino: a peça não conta.')
  })
})

describe('App.tsx entrega a peça ao painel do pino', () => {
  it('o bloco pin={{ … }} passa colecao: pinColecaoPanel(selectedPin, map.pins)', () => {
    const inicio = appSource.indexOf('pin={{')
    const fim = appSource.indexOf('pinIcon={{', inicio)
    expect(inicio).toBeGreaterThan(-1)
    expect(fim).toBeGreaterThan(inicio)
    const blocoDoPino = appSource.slice(inicio, fim)
    expect(blocoDoPino).toMatch(/\bcolecao:\s*selectedPin\s*\?\s*pinColecaoPanel\(selectedPin,\s*map\.pins\)\s*:\s*null/)
  })
})
