import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { filterMapForPlayer } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { PlayerVeiculo, VEICULO_PENDENTE_MAX_MS } from './PlayerVeiculo'

/**
 * VEÍCULO na tela do jogador: encostado num veículo que ele vê, "Subir"; a
 * bordo, o rótulo "No veículo · motorista" (ou "No veículo") e o "Descer". O
 * mapa de cada caso é o RECORTE de verdade (`filterMapForPlayer`): as marcas
 * `embarcavel` e `aBordo` vêm dele, e nada mais do veículo.
 */
const GRADE = 64

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function cena(passageiros: string[] = [], extra: Token[] = []): MapData {
  return {
    ...createEmptyMap('m', 'M', 20, 20, GRADE),
    tokens: [ficha('cesto', 352, 352, { veiculo: { lugares: 2, passageiros } }), ficha('lia', 288, 352), ficha('caio', 416, 352), ...extra],
  }
}

const POSSE = { p1: ['lia'], p2: ['caio'] }
const recorte = (map: MapData, playerId = 'p1') => filterMapForPlayer(map, playerId, POSSE, 400).map

describe('PlayerVeiculo — subir e descer na tela do jogador', () => {
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
    vi.useRealTimers()
  })

  const render = (
    map: MapData,
    own: string[] = ['lia'],
    handlers: { onSubir?: (tokenId: string, vehicleId: string) => void; onDescer?: (tokenId: string) => void } = {},
    paused = false,
    aviso?: number,
  ) =>
    act(() =>
      root.render(
        <PlayerVeiculo map={map} ownTokens={own} paused={paused} aviso={aviso} onSubir={handlers.onSubir ?? (() => {})} onDescer={handlers.onDescer ?? (() => {})} />,
      ),
    )
  const botao = (): HTMLButtonElement | null => container.querySelector('button')
  const rotulo = (): string | null => container.querySelector('.pp-veiculo__rotulo')?.textContent ?? null

  it('encostada no cesto que ela vê: "Subir", e o toque manda os dois ids', () => {
    const onSubir = vi.fn()
    render(recorte(cena()), ['lia'], { onSubir })
    expect(botao()?.textContent).toBe('Subir no veículo')
    expect(rotulo()).toBeNull()
    act(() => botao()?.click())
    expect(onSubir).toHaveBeenCalledWith('lia', 'cesto')
    expect(botao()?.textContent).toBe('Subindo…')
  })

  it('longe do cesto, ficha comum por perto, ficha que não é dela ou mesa pausada: nenhum botão', () => {
    render(recorte({ ...cena(), tokens: [ficha('cesto', 352, 352, { veiculo: { lugares: 2 } }), ficha('lia', 800, 800)] }))
    expect(botao()).toBeNull()
    // A mesma ficha encostada numa ficha que NÃO é veículo.
    render(recorte({ ...cena(), tokens: [ficha('barril', 352, 352), ficha('lia', 288, 352)] }))
    expect(botao()).toBeNull()
    render(recorte(cena()), ['ninguem'])
    expect(botao()).toBeNull()
    render(recorte(cena()), ['lia'], {}, true)
    expect(botao()).toBeNull()
  })

  it('veículo que o recorte não mostra (escondido pelo mestre): nenhum botão', () => {
    const escondido = { ...cena(), tokens: [ficha('cesto', 352, 352, { veiculo: { lugares: 2 }, hidden: true }), ficha('lia', 288, 352)] }
    render(recorte(escondido))
    expect(botao()).toBeNull()
  })

  it('ficha travada pelo mestre (cadeado ou congelada) não ganha o "Subir"', () => {
    render(recorte({ ...cena(), tokens: [ficha('cesto', 352, 352, { veiculo: { lugares: 2 } }), ficha('lia', 288, 352, { locked: true })] }))
    expect(botao()).toBeNull()
    render(recorte({ ...cena(), tokens: [ficha('cesto', 352, 352, { veiculo: { lugares: 2 } }), ficha('lia', 288, 352, { congelado: true })] }))
    expect(botao()).toBeNull()
  })

  it('a bordo e primeira da lista: "No veículo · motorista" e o "Descer", que manda o id dela', () => {
    const onDescer = vi.fn()
    render(recorte(cena(['lia', 'caio'])), ['lia'], { onDescer })
    expect(rotulo()).toBe('No veículo · motorista')
    expect(botao()?.textContent).toBe('Descer do veículo')
    act(() => botao()?.click())
    expect(onDescer).toHaveBeenCalledWith('lia')
    expect(botao()?.textContent).toBe('Descendo…')
  })

  it('a bordo atrás de outro: só "No veículo" — e o recorte não diz quem dirige', () => {
    const doCaio = recorte(cena(['lia', 'caio']), 'p2')
    render(doCaio, ['caio'])
    expect(rotulo()).toBe('No veículo')
    expect(botao()?.textContent).toBe('Descer do veículo')
    // A ficha da Lia chega ao Caio sem marca de bordo, e o cesto sem lugares nem lista.
    expect(doCaio.tokens.find((t) => t.id === 'lia')?.aBordo).toBeUndefined()
    expect(JSON.stringify(doCaio)).not.toContain('passageiros')
    expect(JSON.stringify(doCaio)).not.toContain('lugares')
  })

  it('a bordo com a mesa pausada: o rótulo fica, o "Descer" sai', () => {
    render(recorte(cena(['lia'])), ['lia'], {}, true)
    expect(rotulo()).toBe('No veículo · motorista')
    expect(botao()).toBeNull()
  })

  it('a espera do botão acaba sozinha, ou com o aviso da recusa ("Veículo cheio")', () => {
    vi.useFakeTimers()
    const map = recorte(cena())
    render(map)
    act(() => botao()?.click())
    expect(botao()?.textContent).toBe('Subindo…')
    act(() => vi.advanceTimersByTime(VEICULO_PENDENTE_MAX_MS))
    expect(botao()?.textContent).toBe('Subir no veículo')
    act(() => botao()?.click())
    render(map, ['lia'], {}, false, 7)
    expect(botao()?.textContent).toBe('Subir no veículo')
  })
})
