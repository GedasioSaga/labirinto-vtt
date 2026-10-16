import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapObjectEntry } from '../lib/mapObjects'
import type { MapData, RegionPoint } from '../types/map'
import { NadaSelecionado, exemplosDoMapa, tipoDoExemplo } from './NadaSelecionado'

/**
 * A página Ficha com Selecionar na mão e nada selecionado (fatia 7 do design
 * consolidado): o convite tracejado com "Nada selecionado" e os atalhos, e
 * "Neste mapa" com um exemplo de cada tipo da cena. O "+ Token" mora no topo
 * do livro, o mesmo lugar com e sem seleção (PropertiesPanel.selecao.test.tsx).
 */

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

const quadrado = (x: number, y: number, lado: number): RegionPoint[] => [{ x, y }, { x: x + lado, y }, { x: x + lado, y: y + lado }, { x, y: y + lado }]

/** A cena do protótipo: um token de NPC, uma porta trancada, um pino de exclamação e uma sala. */
function cenaDoPorto(): MapData {
  return {
    ...createEmptyMap('map_porto', 'Porto de Tasmaturi', 30, 20, 64),
    walls: [{ id: 'p2', x1: 300, y1: 600, x2: 400, y2: 600, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }],
    regions: [{ id: 'cais', points: quadrado(500, 300, 300), tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Cais do Porto' } }],
    tokens: [{ id: 'saga', characterId: null, name: 'Saga', x: 640, y: 420, size: 1, image: null, npc: true }],
    pins: [
      { id: 'escondido', x: 650, y: 360, kind: 'interrogacao', description: 'Bilhete rasgado', image: null, hidden: true },
      { id: 'caixas', x: 700, y: 360, kind: 'exclamacao', description: 'Caixas suspeitas', image: null },
    ],
  }
}

const botoes = () => Array.from(container.querySelectorAll('button'))

describe('NadaSelecionado — o convite', () => {
  it('"Nada selecionado" continua um botão desabilitado com o texto exato, e é o único trecho que diz isso', () => {
    act(() => root.render(<NadaSelecionado />))
    const estado = botoes().filter((b) => b.textContent === 'Nada selecionado')
    expect(estado).toHaveLength(1)
    expect(estado[0]?.disabled).toBe(true)
    // `getByText('Nada selecionado')` das jornadas não aceitaria dois.
    expect(container.textContent?.match(/nada selecionado/gi)).toHaveLength(1)
    // Estado, não ação: o "+ Token" mora no topo do livro.
    expect(container.querySelector('button[aria-label="Adicionar token"]')).toBeNull()
  })

  it('os atalhos de quem vai selecionar: Ctrl K procura, Esc limpa, Del apaga', () => {
    act(() => root.render(<NadaSelecionado />))
    const pares = Array.from(container.querySelectorAll('dl dt')).map((dt) => [dt.textContent, dt.nextElementSibling?.textContent])
    expect(pares).toEqual([
      ['Ctrl K', 'Procurar no mapa'],
      ['Esc', 'Limpar a seleção'],
      ['Del', 'Apagar o selecionado'],
    ])
  })

  it('cena vazia (ou sem a cena): sem o "Neste mapa", que não teria o que mostrar', () => {
    act(() => root.render(<NadaSelecionado nesteMapa={{ map: createEmptyMap('vazio', 'Vazio', 10, 10, 64), onIr: () => {} }} />))
    expect(container.querySelector('h2')).toBeNull()
    act(() => root.render(<NadaSelecionado />))
    expect(container.querySelector('h2')).toBeNull()
  })
})

describe('NadaSelecionado — "Neste mapa"', () => {
  it('um exemplo de cada tipo, na ordem do protótipo, e o clique vai até ele pelo mesmo caminho da lista de objetos', () => {
    const onIr = vi.fn<(entry: MapObjectEntry) => void>()
    act(() => root.render(<NadaSelecionado nesteMapa={{ map: cenaDoPorto(), onIr }} />))
    expect(container.querySelector('h2')?.textContent).toBe('Neste mapapara experimentar')
    const linhas = Array.from(container.querySelectorAll<HTMLButtonElement>('li button'))
    expect(linhas.map((b) => b.textContent)).toEqual([
      'SagaToken de NPC',
      'PortaPorta trancada',
      'Caixas suspeitasPino de exclamação',
      'Cais do PortoSala',
    ])
    act(() => linhas[2]?.click())
    expect(onIr).toHaveBeenCalledTimes(1)
    expect(onIr.mock.calls[0]?.[0]).toMatchObject({ kind: 'pin', id: 'caixas' })
  })

  it('só exemplo que o clique seleciona: o pino oculto no editor fica de fora e o próximo entra no lugar', () => {
    const exemplos = exemplosDoMapa(cenaDoPorto())
    expect(exemplos.map((e) => `${e.kind}:${e.id}`)).toEqual(['token:saga', 'door:p2', 'pin:caixas', 'room:cais'])
  })

  it('a linha de baixo diz o que o exemplo é: ficha de jogador, porta aberta ou fechada, tipo do pino', () => {
    const mapa = cenaDoPorto()
    const comoJogador: MapData = { ...mapa, tokens: [{ ...mapa.tokens[0], npc: false, playerCharacter: true }] }
    const [token] = exemplosDoMapa(comoJogador)
    expect(tipoDoExemplo(comoJogador, token)).toBe('Token de jogador')
    const aberta: MapData = { ...mapa, walls: [{ ...mapa.walls[0], door: { open: true, locked: false, kind: 'normal' } }] }
    const porta = exemplosDoMapa(aberta).find((e) => e.kind === 'door')
    expect(porta && tipoDoExemplo(aberta, porta)).toBe('Porta aberta')
  })
})

/** Um CSS como está no disco, relativo a esta pasta (o mesmo jeito de `PropertiesPanel.botoes.test.ts`). */
async function lerCss(relativo: string): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativo), 'utf8')
}

/** As declarações da PRIMEIRA regra cujo seletor é exatamente `seletor`: propriedade → valor. */
function regra(css: string, seletor: string): Map<string, string> {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, seletores, corpo] of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (seletores.trim().replace(/\s+/g, ' ') !== seletor) continue
    return new Map(
      corpo
        .split(';')
        .map((declaracao) => declaracao.split(':'))
        .filter((partes) => partes.length >= 2)
        .map(([propriedade, ...valor]) => [propriedade.trim(), valor.join(':').trim()]),
    )
  }
  return new Map()
}

describe('NadaSelecionado — CSS', () => {
  it('"Nada selecionado" é estado, não ação: sem caixa e sem o cursor de proibido, nem desabilitado', async () => {
    const estado = regra(await lerCss('./NadaSelecionado.css'), '.lb-ficha-vazia__estado, .lb-ficha-vazia__estado:disabled')
    expect(estado.get('cursor')).toBe('default')
    expect(estado.get('border')).toBe('0')
    expect(estado.get('background')).toBe('none')
  })

  it('o realce de pairar do exemplo só com mouse: no toque ele ficaria grudado', async () => {
    const css = await lerCss('./NadaSelecionado.css')
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\s*\.lb-ficha-vazia__item:hover/)
  })
})
