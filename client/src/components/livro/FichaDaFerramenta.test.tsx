import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLivroDoMestreStore } from '../../stores/livroDoMestreStore'
import type { DrawingTool } from '../../types/tools'
import type { ToolVariantBindings } from '../ToolVariantMenu'
import { FichaDaFerramenta, variantesDaFicha } from './FichaDaFerramenta'

/**
 * A ficha da ferramenta (fatia 7 do design consolidado): a cabeça com o nome,
 * a dica e a tecla, e o cartão com as variantes que os controles de sempre não
 * têm — os mesmos eixos do cantinho da barra, lidos e escritos na mesma store.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useLivroDoMestreStore.setState({ pagina: 'ficha', recolhido: false })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

/** As preferências da próxima peça, como o App passa, com o que a ficha escreve espionado. */
function preferencias(mudar: Partial<{ [K in keyof ToolVariantBindings]: ToolVariantBindings[K]['value'] }> = {}, ativa: DrawingTool = 'room') {
  const espiao = vi.fn<(eixo: string, valor: unknown) => void>()
  const eixo = <V,>(nome: string, value: V) => ({ value, onChange: (valor: V) => espiao(nome, valor) })
  const bindings: ToolVariantBindings = {
    doorKind: eixo('doorKind', mudar.doorKind ?? 'normal'),
    wallKind: eixo('wallKind', mudar.wallKind ?? 'exterior'),
    regionFillPattern: eixo('regionFillPattern', mudar.regionFillPattern ?? 'solid'),
    polygonSides: eixo('polygonSides', mudar.polygonSides ?? 6),
    stairSizePreset: eixo('stairSizePreset', mudar.stairSizePreset ?? 'medium'),
    drawTexture: eixo('drawTexture', mudar.drawTexture ?? 'pen'),
    brushMode: eixo('brushMode', mudar.brushMode ?? 'traco'),
    eraseMode: eixo('eraseMode', mudar.eraseMode ?? 'objeto'),
    floorShapeKind: eixo('floorShapeKind', mudar.floorShapeKind ?? 'rect'),
    floorOp: eixo('floorOp', mudar.floorOp ?? 'add'),
    floorPolygonSides: eixo('floorPolygonSides', mudar.floorPolygonSides ?? 6),
    floorBrushSize: eixo('floorBrushSize', mudar.floorBrushSize ?? 1),
    floorCamada: eixo('floorCamada', mudar.floorCamada ?? 'chao'),
    roomFreeKind: eixo('roomFreeKind', mudar.roomFreeKind ?? 'sala'),
    roomFreeRounded: eixo('roomFreeRounded', mudar.roomFreeRounded ?? false),
    mobiliaTipo: eixo('mobiliaTipo', mudar.mobiliaTipo ?? 'barril'),
    drawShape: eixo('drawShape', ativa),
  }
  return { bindings, espiao }
}

const grupo = (nome: string) => container.querySelector<HTMLElement>(`[role="radiogroup"][aria-labelledby="${[...container.querySelectorAll('.gr-campo__rot')].find((r) => r.textContent === nome)?.id}"]`)
const radios = (nome: string) => [...(grupo(nome)?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])]
const marcada = (nome: string) => radios(nome).find((r) => r.getAttribute('aria-checked') === 'true')?.textContent

describe('FichaDaFerramenta — a cabeça', () => {
  it('nome da ferramenta como título ("Ferramenta · " só para o leitor de tela), a dica curta e a tecla dela', () => {
    const { bindings } = preferencias({}, 'roomCircle')
    act(() => root.render(<FichaDaFerramenta ferramenta="roomCircle" variantes={bindings} />))
    const titulo = container.querySelector('h2')
    expect(titulo?.textContent).toBe('Ferramenta · Sala Circular')
    expect(titulo?.querySelector('.gr-sr')?.textContent).toBe('Ferramenta · ')
    expect(container.querySelector('.gr-cabeca__tipo')?.textContent).toBe('Arraste do centro até a borda.')
    expect(container.querySelector('.gr-cabeca > .gr-kbd')?.textContent).toBe('J')
  })

  it('Sala livre no modo Parede: a dica acompanha o traçado que fica aberto', () => {
    const { bindings } = preferencias({ roomFreeKind: 'parede' }, 'roomFree')
    act(() => root.render(<FichaDaFerramenta ferramenta="roomFree" variantes={bindings} />))
    expect(container.querySelector('.gr-cabeca__tipo')?.textContent).toBe('Clique ponto a ponto; duplo clique termina.')
    // Sem letra (lib/keymap.ts): sem tecla na cabeça.
    expect(container.querySelector('.gr-cabeca > .gr-kbd')).toBeNull()
  })
})

describe('FichaDaFerramenta — as variantes', () => {
  it('a forma da Sala é a escolhida na barra, e escolher outra arma a outra ferramenta pelo mesmo caminho', () => {
    const { bindings, espiao } = preferencias({}, 'roomCircle')
    act(() => root.render(<FichaDaFerramenta ferramenta="roomCircle" variantes={bindings} />))
    expect(radios('Forma').map((r) => r.textContent)).toEqual(['RetânguloN', 'CircularJ', 'PolígonoQ', 'Livre', 'RegiãoG'])
    expect(marcada('Forma')).toBe('CircularJ')
    act(() => radios('Forma')[2]?.click())
    expect(espiao).toHaveBeenCalledWith('drawShape', 'roomPolygon')
  })

  it('não repete o que a ficha já tem pelos controles de sempre: tipo de parede, tipo de porta, hachurado e lados', () => {
    expect(variantesDaFicha('wall')).toEqual([])
    expect(variantesDaFicha('door')).toEqual([])
    expect(variantesDaFicha('roomPolygon').map((g) => g.label)).toEqual(['Forma'])
    expect(variantesDaFicha('roomFree').map((g) => g.label)).toEqual(['Forma', 'Criar', 'Arredondar'])
  })

  it('o Chão mostra o tamanho do pincel só com o Pincel de blocos, e os lados só com o Polígono regular', () => {
    const comRetangulo = preferencias({ floorShapeKind: 'rect' }, 'floor')
    act(() => root.render(<FichaDaFerramenta ferramenta="floor" variantes={comRetangulo.bindings} />))
    expect(grupo('Tamanho do pincel')).toBeNull()
    expect(grupo('Lados do polígono')).toBeNull()
    expect(marcada('Tinta')).toBe('Chão')

    const comBlocos = preferencias({ floorShapeKind: 'blocos' }, 'floor')
    act(() => root.render(<FichaDaFerramenta ferramenta="floor" variantes={comBlocos.bindings} />))
    expect(grupo('Tamanho do pincel')).not.toBeNull()
    act(() => radios('Tinta').find((r) => r.textContent === 'Mar')?.click())
    expect(comBlocos.espiao).toHaveBeenCalledWith('floorCamada', 'mar')
  })

  it('sem as preferências (quem não passa a store), só os controles de sempre', () => {
    act(() => root.render(<FichaDaFerramenta ferramenta="floor">controles de sempre</FichaDaFerramenta>))
    expect(container.querySelector('[role="radiogroup"]')).toBeNull()
    expect(container.querySelector('.gr-ficha__dentro')?.textContent).toContain('controles de sempre')
  })
})

describe('FichaDaFerramenta — as notas', () => {
  it('o Chão leva ao "Chão do mapa" da página Cena', () => {
    const { bindings } = preferencias({}, 'floor')
    act(() => root.render(<FichaDaFerramenta ferramenta="floor" variantes={bindings} />))
    const ir = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Ir para Cena')
    act(() => ir?.click())
    expect(useLivroDoMestreStore.getState().pagina).toBe('cena')
  })

  it('a Luz diz onde se ajusta a cor depois de criada', () => {
    act(() => root.render(<FichaDaFerramenta ferramenta="light" variantes={preferencias({}, 'light').bindings} />))
    expect(container.querySelector('.gr-nota')?.textContent).toContain('na ficha da luz')
  })
})
