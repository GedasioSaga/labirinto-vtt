/// <reference types="vite/client" />
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import appSource from '../App.tsx?raw'
import { createEmptyMap } from '../lib/mapFactory'
import { MARCAS_POR_JOGADOR_POR_CENA } from '../lib/marcas'
import { createHostSession, type HostResult, type HostWorld } from '../net/hostSession'
import { hostPlayerChanges } from '../net/playerChanges'
import { useMapStore } from '../stores/mapStore'
import type { MapData, MarcaNoLugar, Token } from '../types/map'
import { MarcasDaCena, type MarcasDaCenaProps } from './MarcasDaCena'

/**
 * BILHETE NO LUGAR, lado do mestre: "Marcas dos jogadores" relê e apaga a
 * marca a qualquer hora, não só nos 12 s do aviso. É a saída do jogador que
 * bateu o teto ("Peça ao mestre para apagar alguma") e do bilhete que não cabe
 * na mesa.
 */

const ESCADA: MarcaNoLugar = { id: 'b-escada', tipo: 'bilhete', x: 230, y: 200, texto: 'Fui pela escada', autor: 'Ana', em: 1 }
const SETA: MarcaNoLugar = { id: 's-leste', tipo: 'seta', x: 260, y: 200, rumo: 'ne', autor: 'Caio', em: 2 }
const SEM_AUTOR: MarcaNoLugar = { id: 'b-velho', tipo: 'bilhete', x: 100, y: 100, texto: '<i>gravado à mão</i>' }

describe('MarcasDaCena', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    // A seção lembra aberta/fechada no localStorage: cada teste começa do zero.
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(props: MarcasDaCenaProps): void {
    act(() => root.render(<MarcasDaCena {...props} />))
  }

  function linhas(): string[] {
    return Array.from(container.querySelectorAll('li')).map((li) => (li.querySelector('.lb-marcas__texto')?.textContent ?? '').trim())
  }

  function apagarDe(markId: string): HTMLButtonElement {
    const botao = container.querySelector(`button[data-marca="${markId}"]`)
    if (!(botao instanceof HTMLButtonElement)) throw new Error(`sem "Apagar" da marca ${markId}`)
    return botao
  }

  it('lista cada marca da cena, a mais nova primeiro, com o recado inteiro e quem deixou', () => {
    render({ marcas: [SEM_AUTOR, ESCADA, SETA], onApagar: vi.fn() })
    expect(container.textContent).toContain('Marcas dos jogadores')
    expect(container.textContent).toContain('3 marcas nesta cena')
    expect(linhas()).toEqual(['Seta de giz para o nordeste de Caio', '“Fui pela escada” de Ana', '“<i>gravado à mão</i>” autor desconhecido'])
    // O recado de um jogador vai como texto: nada de marcação no painel do mestre.
    expect(container.querySelector('.lb-marcas__recado i')).toBeNull()
  })

  it('cada "Apagar" tem nome próprio para o leitor de tela: tipo, autor e recado', () => {
    render({ marcas: [ESCADA, SETA], onApagar: vi.fn() })
    expect(apagarDe(ESCADA.id).getAttribute('aria-label')).toBe('Apagar bilhete de Ana: “Fui pela escada”')
    expect(apagarDe(SETA.id).getAttribute('aria-label')).toBe('Apagar seta de Caio: Seta de giz para o nordeste')
    expect(apagarDe(ESCADA.id).textContent).toBe('Apagar')
  })

  it('"Apagar" pede para tirar aquela marca, e o foco passa para a vizinha', () => {
    const onApagar = vi.fn<(markId: string) => void>()
    render({ marcas: [SEM_AUTOR, ESCADA, SETA], onApagar })
    apagarDe(ESCADA.id).focus()
    act(() => apagarDe(ESCADA.id).click())
    expect(onApagar).toHaveBeenCalledTimes(1)
    expect(onApagar).toHaveBeenCalledWith(ESCADA.id)
    // A mais nova vem primeiro: a vizinha de baixo da Escada é a gravada à mão.
    expect(document.activeElement).toBe(apagarDe(SEM_AUTOR.id))
  })

  it('Delete com o foco no "Apagar" apaga aquela marca e não segue para o mapa', () => {
    const onApagar = vi.fn<(markId: string) => void>()
    const noMapa = vi.fn()
    document.addEventListener('keydown', noMapa)
    render({ marcas: [ESCADA, SETA], onApagar })
    const botao = apagarDe(SETA.id)
    botao.focus()
    act(() => {
      botao.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    })
    document.removeEventListener('keydown', noMapa)
    expect(onApagar).toHaveBeenCalledWith(SETA.id)
    expect(noMapa).not.toHaveBeenCalled()
  })

  it('sem marca na cena (ou mapa antigo sem o campo), a seção não aparece', () => {
    render({ marcas: [], onApagar: vi.fn() })
    expect(container.innerHTML).toBe('')
  })

  it('ligada ao mapa do editor: "Apagar" tira a marca da cena aberta fora do Ctrl+Z do mestre', () => {
    const map: MapData = { ...createEmptyMap('m', 'M', 20, 20, 50), marcas: [ESCADA, SETA] }
    useMapStore.getState().loadMap(map)
    const passos = useMapStore.getState().past.length
    const mostrar = () => render({ marcas: useMapStore.getState().map.marcas ?? [], onApagar: hostPlayerChanges.removeMark })

    mostrar()
    act(() => apagarDe(ESCADA.id).click())
    mostrar()

    expect(useMapStore.getState().map.marcas).toEqual([SETA])
    expect(useMapStore.getState().past).toHaveLength(passos)
    expect(container.querySelector(`button[data-marca="${ESCADA.id}"]`)).toBeNull()
    expect(linhas()).toEqual(['Seta de giz para o nordeste de Caio'])
  })

  it('o jogador que bateu o teto volta a poder deixar marca depois que o mestre apaga uma pela lista', () => {
    const ana: Token = { id: 'lanterna', characterId: null, name: 'ficha-ana', x: 200, y: 200, size: 1, image: null }
    const cheio: MarcaNoLugar[] = Array.from({ length: MARCAS_POR_JOGADOR_POR_CENA }, (_, i) => ({ id: `v${i}`, tipo: 'seta', x: 100, y: 100, rumo: 'n', autor: 'Ana', em: i }))
    useMapStore.getState().loadMap({ ...createEmptyMap('m-salao', 'Salao', 60, 20, 50), tokens: [ana], marcas: cheio })
    const mundo = (): HostWorld => ({ open: { sceneId: 's-salao', name: 'Salao', map: useMapStore.getState().map }, background: [] })
    const relogio = { t: 1_000_000 }
    let n = 0
    const sessao = createHostSession({ code: 'MARC02', visionRadius: 400, now: () => relogio.t, randomId: () => `id-${(n += 1)}` })
    const entrou = sessao.handleMessage('c1', { type: 'join', code: 'MARC02', name: 'Ana' }, mundo()).outbound[0]?.msg
    if (entrou?.type !== 'welcome') throw new Error('Ana não entrou')
    sessao.assignToken(entrou.playerId, 'lanterna')
    // O primeiro recorte: Ana passa a conhecer o canto onde está (como `mesa()` de hostSession.marcas.test.ts).
    sessao.broadcast(mundo())
    const deixar = (): HostResult => sessao.handleMessage('c1', { type: 'mark.place', x: 230, y: 200, tipo: 'bilhete', texto: 'mais um' }, mundo())
    const resposta = (r: HostResult) => r.outbound.filter((o) => o.clientId === 'c1').map((o) => o.msg)

    expect(resposta(deixar())).toEqual([{ type: 'mark.place.result', ok: false, reason: 'full' }])

    render({ marcas: useMapStore.getState().map.marcas ?? [], onApagar: hostPlayerChanges.removeMark })
    act(() => apagarDe('v7').click())
    relogio.t += 5000

    const depois = deixar()
    expect(useMapStore.getState().map.marcas).toHaveLength(MARCAS_POR_JOGADOR_POR_CENA - 1)
    expect(resposta(depois)).toEqual([{ type: 'mark.place.result', ok: true }])
    expect(depois.applyMark?.marca.texto).toBe('mais um')
  })
})

describe('App.tsx põe a lista no painel do mestre', () => {
  it('as marcas da cena aberta, com "Apagar" ligado ao apagar do jogador (fora do Ctrl+Z)', () => {
    expect(appSource.replace(/\s+/g, ' ')).toContain('<MarcasDaCena marcas={map.marcas ?? []} onApagar={hostPlayerChanges.removeMark} />')
  })
})
