/**
 * SÓ REPINTA A FICHA QUE MUDOU (P7 da lista de desempenho, 01/10/2026).
 *
 * Cada passo do arrasto de uma ficha chama `draw` com o mapa inteiro. Antes,
 * `draw` limpava e refazia moldura, disco, marcas e barra de TODAS as fichas —
 * medido no dev com 800 fichas: ~75 mil `GraphicsContext.clear` num arrasto
 * de 30 passos. Agora a ficha cuja pintura não mudou só anda (o wrapper vai
 * para o lugar novo); quem muda é repintado sozinho.
 *
 * O risco é a ficha ficar com a cara velha: por isso cada campo que o desenho
 * lê tem um teste que o muda e exige a repintura.
 */
import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createTokensRenderer } from './tokensRenderer'
import type { Token } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

const GRID = 64

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y: 100, size: 1, image: null, ...extra }
}

/** Três fichas lado a lado; o nome de cada uma é o id. */
function tresFichas(): Token[] {
  return [ficha('a', 100), ficha('b', 300), ficha('c', 500)]
}

/** O nome que a ficha mostra (o `Text` do wrapper). */
function nomeDo(wrapper: Container): string {
  const label = wrapper.children.find((c): c is Text => c instanceof Text)
  if (!label) throw new Error('wrapper sem nome')
  return label.text
}

/** wrapper → id da ficha, lido logo depois do primeiro desenho (nome = id). */
function donosDosWrappers(container: Container): Map<Container, string> {
  return new Map(container.children.map((wrapper) => [wrapper, nomeDo(wrapper)]))
}

/** O wrapper (filho direto de `container`) que carrega `no`, ou null. */
function wrapperQueCarrega(no: Container, container: Container): Container | null {
  let atual: Container | null = no
  while (atual !== null && atual.parent !== container) atual = atual.parent
  return atual
}

/**
 * As fichas que tiveram algum Graphics limpo (= repintado) durante `acao`,
 * em ordem alfabética. Mede o que custa: cada `clear` refaz a geometria e
 * obriga o Pixi a refazer os lotes do grupo de render.
 */
function fichasRepintadas(container: Container, donos: Map<Container, string>, acao: () => void): string[] {
  const limpar = vi.spyOn(Graphics.prototype, 'clear')
  try {
    acao()
    const repintadas = new Set<string>()
    for (const contexto of limpar.mock.contexts) {
      if (!(contexto instanceof Graphics)) continue
      const wrapper = wrapperQueCarrega(contexto, container)
      const dono = wrapper === null ? undefined : donos.get(wrapper)
      if (dono !== undefined) repintadas.add(dono)
    }
    return [...repintadas].sort()
  } finally {
    limpar.mockRestore()
  }
}

function wrapperDa(container: Container, donos: Map<Container, string>, id: string): Container {
  for (const [wrapper, dono] of donos) if (dono === id && wrapper.parent === container) return wrapper
  throw new Error(`sem wrapper da ficha ${id}`)
}

describe('createTokensRenderer — só repinta a ficha que mudou', () => {
  it('redesenhar com as mesmas fichas não repinta nenhuma, e cada uma continua desenhada no lugar', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const fichas = tresFichas()
    renderer.draw(container, fichas, GRID, null, 1)
    const donos = donosDosWrappers(container)

    expect(fichasRepintadas(container, donos, () => renderer.draw(container, fichas, GRID, null, 1))).toEqual([])
    for (const token of fichas) {
      const wrapper = wrapperDa(container, donos, token.id)
      expect(wrapper.position.x).toBe(token.x)
      const disco = wrapper.children[0]
      if (!(disco instanceof Graphics)) throw new Error('sem disco')
      // O desenho de antes continua lá: pular a repintura não pode apagar a ficha.
      expect(disco.context.instructions.filter((i) => i.action === 'fill')).toHaveLength(1)
    }
  })

  it('arrastar uma ficha repinta só ela, e o wrapper dela vai ao lugar novo', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const fichas = tresFichas()
    renderer.draw(container, fichas, GRID, null, 1)
    const donos = donosDosWrappers(container)
    const movida = fichas.map((t) => (t.id === 'b' ? { ...t, x: 340, y: 164 } : t))

    expect(fichasRepintadas(container, donos, () => renderer.draw(container, movida, GRID, null, 1))).toEqual(['b'])
    expect(wrapperDa(container, donos, 'b').position.x).toBe(340)
    expect(wrapperDa(container, donos, 'b').position.y).toBe(164)
  })

  const campos: [string, Partial<Token>][] = [
    ['cor', { color: '#c0392b' }],
    ['nome', { name: 'Outro nome' }],
    ['tamanho', { size: 2 }],
    ['giro', { rotation: 90 }],
    ['foto', { image: 'C:\\imgs\\b.png' }],
    ['foto embutida', { imageData: 'data:image/png;base64,iVBORw0KGgo=' }],
    ['oculta no editor', { hidden: true }],
    ['oculta para jogadores', { secret: true }],
    ['congelada', { congelado: true }],
    ['condição', { conditions: ['envenenado'] }],
    ['vida', { health: { current: 3, max: 10, shownToPlayers: false } }],
  ]
  it.each(campos)('mudar %s repinta só a ficha mudada', (_campo, mudanca) => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const fichas = tresFichas()
    renderer.draw(container, fichas, GRID, null, 1)
    const donos = donosDosWrappers(container)
    const mudadas = fichas.map((t) => (t.id === 'b' ? { ...t, ...mudanca } : t))

    expect(fichasRepintadas(container, donos, () => renderer.draw(container, mudadas, GRID, null, 1))).toEqual(['b'])
  })

  it('a seleção que troca repinta só a ficha que saiu e a que entrou', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const fichas = tresFichas()
    renderer.draw(container, fichas, GRID, 'a', 1)
    const donos = donosDosWrappers(container)

    expect(fichasRepintadas(container, donos, () => renderer.draw(container, fichas, GRID, 'c', 1))).toEqual(['a', 'c'])
  })

  it('a vez que passa repinta só a ficha que perdeu e a que ganhou', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const fichas = tresFichas()
    renderer.draw(container, fichas, GRID, null, 1, 'a')
    const donos = donosDosWrappers(container)

    expect(fichasRepintadas(container, donos, () => renderer.draw(container, fichas, GRID, null, 1, 'b'))).toEqual(['a', 'b'])
  })

  it('sair da mesa (Volto já) repinta só aquela ficha, e voltar também', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const fichas = tresFichas()
    renderer.draw(container, fichas, GRID, null, 1, null, new Set())
    const donos = donosDosWrappers(container)

    expect(fichasRepintadas(container, donos, () => renderer.draw(container, fichas, GRID, null, 1, null, new Set(['c'])))).toEqual(['c'])
    expect(fichasRepintadas(container, donos, () => renderer.draw(container, fichas, GRID, null, 1, null, new Set()))).toEqual(['c'])
  })

  it('mudar a grade repinta todas: o raio de cada uma sai dela', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const fichas = tresFichas()
    renderer.draw(container, fichas, GRID, null, 1)
    const donos = donosDosWrappers(container)

    expect(fichasRepintadas(container, donos, () => renderer.draw(container, fichas, GRID * 2, null, 1))).toEqual(['a', 'b', 'c'])
  })

  it('só o zoom não repinta nenhuma, e o nome continua com o tamanho mínimo na tela', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const fichas = tresFichas()
    renderer.draw(container, fichas, GRID, null, 1)
    const donos = donosDosWrappers(container)

    expect(fichasRepintadas(container, donos, () => renderer.draw(container, fichas, GRID, null, 0.5))).toEqual([])
    const nome = wrapperDa(container, donos, 'a').children.find((c): c is Text => c instanceof Text)
    if (!nome) throw new Error('sem nome')
    // 12 px de mundo a 50% dariam 6 px: o nome é esticado até 11 px de tela (screenLabel.ts).
    expect(12 * 0.5 * nome.scale.x).toBeCloseTo(11, 6)
  })
})

describe('createTokensRenderer — quantos nomes pedem nova resolução de texto', () => {
  it('o primeiro desenho conta cada nome que nasceu; redesenhar igual conta zero', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const fichas = tresFichas()
    expect(renderer.draw(container, fichas, GRID, null, 1)).toBe(3)
    expect(renderer.draw(container, fichas, GRID, null, 1)).toBe(0)
  })

  it('mover, selecionar e passar a vez não contam; renomear conta (o teto da resolução depende do tamanho do nome)', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const fichas = tresFichas()
    renderer.draw(container, fichas, GRID, null, 1)

    const movida = fichas.map((t) => (t.id === 'b' ? { ...t, x: 340 } : t))
    expect(renderer.draw(container, movida, GRID, 'b', 1, 'a')).toBe(0)
    const renomeada = movida.map((t) => (t.id === 'b' ? { ...t, name: 'Bruno, o Batedor' } : t))
    expect(renderer.draw(container, renomeada, GRID, 'b', 1, 'a')).toBe(1)
  })

  it('ficha nova sem nome também conta: o Text dela nasceu agora, na resolução do renderer', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    expect(renderer.draw(container, [ficha('sem-nome', 100, { name: '' })], GRID, null, 1)).toBe(1)
  })
})
