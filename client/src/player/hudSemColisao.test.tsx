import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { themeCss } from '../theme'
import type { DoorState, MapData, Token, Wall } from '../types/map'
import { PeekDoorButton } from './PeekDoorButton'

/*
 * O HUD do jogador flutua sobre o mapa: cada controle tem o seu canto e nenhum
 * cobre o outro (bar: Google Maps web em 390 px). Estes testes leem o
 * player.css de verdade e conferem as posições que o jsdom não calcula.
 */

async function lerPlayerCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'player.css'), 'utf8')
}

type Regra = Map<string, string>

function semComentarios(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function declaracoes(corpo: string): Regra {
  return new Map(
    corpo
      .split(';')
      .map((declaracao) => declaracao.split(':'))
      .filter((partes) => partes.length >= 2)
      .map(([propriedade, ...valor]) => [propriedade.trim(), valor.join(':').trim()]),
  )
}

/** Blocos de `@media <condicao> { ... }`, casando as chaves. */
function blocosDaMidia(css: string, condicao: string): string[] {
  const texto = semComentarios(css)
  const abertura = `@media ${condicao} {`
  const blocos: string[] = []
  let inicio = texto.indexOf(abertura)
  while (inicio !== -1) {
    let profundidade = 1
    let fim = inicio + abertura.length
    while (profundidade > 0 && fim < texto.length) {
      if (texto[fim] === '{') profundidade += 1
      if (texto[fim] === '}') profundidade -= 1
      fim += 1
    }
    blocos.push(texto.slice(inicio + abertura.length, fim - 1))
    inicio = texto.indexOf(abertura, fim)
  }
  return blocos
}

/** A lista de seletores de uma regra (`a,\n b {`) contém o seletor exato. */
function temSeletor(seletores: string, seletor: string): boolean {
  return seletores.split(',').some((um) => um.trim() === seletor)
}

/** Regras de nível de topo (fora de qualquer `@media`) com o seletor exato. */
function regraBase(css: string, seletor: string): Regra {
  let texto = semComentarios(css)
  for (const condicao of new Set([...texto.matchAll(/@media ([^{]+) \{/g)].map(([, c]) => c))) {
    for (const bloco of blocosDaMidia(texto, condicao)) texto = texto.replace(`@media ${condicao} {${bloco}}`, '')
  }
  const achadas = [...texto.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, seletores]) => temSeletor(seletores, seletor))
  if (achadas.length === 0) throw new Error(`o player.css não tem a regra "${seletor}" fora de @media`)
  return new Map(achadas.flatMap(([, , corpo]) => [...declaracoes(corpo)]))
}

/** Regra com o seletor exato dentro de `@media <condicao>` (as declarações de todos os blocos, a última vence). */
function regraNaMidia(css: string, condicao: string, seletor: string): Regra {
  const achadas = blocosDaMidia(css, condicao).flatMap((bloco) =>
    [...bloco.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, seletores]) => temSeletor(seletores, seletor)),
  )
  if (achadas.length === 0) throw new Error(`o player.css não tem "${seletor}" dentro de @media ${condicao}`)
  return new Map(achadas.flatMap(([, , corpo]) => [...declaracoes(corpo)]))
}

const TOKENS = new Map([...themeCss().matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, nome, valor]) => [nome, valor.trim()]))

/** Soma os px de um `calc(a + b + ...)`: token do tema vira o valor dele, `env()` e variável de fora do tema valem 0. */
function px(valor: string | undefined): number {
  if (valor === undefined) return Number.NaN
  const semVar = valor.replace(/var\((--[\w-]+)(?:,[^)]*)?\)/g, (_, nome: string) => TOKENS.get(nome) ?? '0px')
  const semEnv = semVar.replace(/env\([^)]*\)/g, '0px')
  return [...semEnv.matchAll(/(\d+(?:\.\d+)?)px/g)].reduce((soma, [, numero]) => soma + Number(numero), 0)
}

const CELULAR = '(max-width: 699px)'

describe('tokens de toque', () => {
  it('o tema tem o alvo de toque do jogador (44 px) ao lado do vão e do alvo de ponteiro', () => {
    expect(themeCss()).toContain('--lb-control-touch: 44px;')
    expect(themeCss()).toContain('--lb-control-gap: 8px;')
  })
})

describe('Espiar pela porta: pílula, não placa', () => {
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

  function mapaComPorta(): MapData {
    const fechada: DoorState = { open: false, locked: true, kind: 'normal' }
    const porta: Wall = { id: 'porta', x1: 500, y1: 250, x2: 500, y2: 350, blocksLight: true, blocksMove: true, door: fechada }
    const ficha: Token = { id: 'ana', characterId: null, name: 'Ana', x: 460, y: 300, size: 1, image: null }
    return { ...createEmptyMap('m', 'M', 20, 12, 50), walls: [porta], tokens: [ficha] }
  }

  it('o botão não herda a classe do cartão do espiar (que o estica do alto da tela até a pílula)', () => {
    act(() => root.render(<PeekDoorButton map={mapaComPorta()} ownTokens={['ana']} onPeek={vi.fn()} />))
    const botao = container.querySelector('button')
    expect(botao?.textContent).toBe('Espiar pela porta')
    expect(botao?.classList.contains('pp-peek')).toBe(false)
    expect(botao?.className).toBe('pp-espiar')
  })

  it('a pílula tem só a borda de baixo: sem top nem largura fixa, alvo de toque de 44 px', async () => {
    const css = await lerPlayerCss()
    const espiar = regraBase(css, '.pp-espiar')
    expect(espiar.get('position')).toBe('fixed')
    expect(espiar.has('top')).toBe(false)
    expect(espiar.has('width')).toBe(false)
    expect(px(espiar.get('min-height'))).toBeGreaterThanOrEqual(44)
    // O cartão do espiar (PlayerPeek) continua com a classe e o lugar dele, no alto.
    expect(regraBase(css, '.pp-peek').get('top')).toBeDefined()
  })

  it('no celular vai para a coluna da esquerda, logo acima do ferrolho, sem encostar nele', async () => {
    const css = await lerPlayerCss()
    const espiar = regraNaMidia(css, CELULAR, '.pp-espiar')
    const ferrolho = regraNaMidia(css, CELULAR, '.pp-ferrolho')
    const alturaDoFerrolho = px(regraBase(css, '.pp-ferrolho').get('min-height'))
    expect(espiar.get('left')).toBe(regraBase(css, '.pp-ferrolho').get('left'))
    expect(espiar.get('transform')).toBe('none')
    expect(px(espiar.get('bottom'))).toBeGreaterThanOrEqual(px(ferrolho.get('bottom')) + alturaDoFerrolho + px('var(--lb-control-gap)'))
    // A entrada não pode puxar a pílula para o meio (o keyframe dos avisos centrados usa translate(-50%)).
    expect(espiar.get('animation') ?? '').not.toContain('pp-notice-in')
  })
})

describe('alvos de toque no celular', () => {
  // Os controles do HUD que mediam menos de 44 px em 390 x 844 (abas 44x36,
  // "Onde estou" 110x36, botões do aviso da porta 32, motivos do chamado 32,
  // campo 34, "Chamar"/"Cancelar" 38, "Fechar" do cartão 40). `true` = botão
  // só-ícone, que precisa dos 44 px também na largura.
  const ALVOS: ReadonlyArray<readonly [string, boolean]> = [
    ['.pp-floors__tab', false],
    ['.pp-where', false],
    ['.pp-notice__action', false],
    ['.pp-notice__close', true],
    ['.pp-call__reason', false],
    ['.pp-call .pp-input', false],
    ['.pp-call .pp-button', false],
    ['.pp-pincard__close', false],
  ]

  it.each(ALVOS)('%s tem o alvo de toque do tema no celular', async (seletor, soIcone) => {
    const regra = regraNaMidia(await lerPlayerCss(), CELULAR, seletor)
    expect(regra.get('min-height') ?? 'sem min-height').toContain('--lb-control-touch')
    expect(px(regra.get('min-height'))).toBeGreaterThanOrEqual(44)
    if (soIcone) expect(px(regra.get('min-width'))).toBeGreaterThanOrEqual(44)
  })
})

describe('rolagens acima do chamar o mestre', () => {
  // Em 390 x 844 a rolagem mais nova ficava a 124 px do rodapé, atrás da mão
  // (z 22 sobre z 12), e a caixa de 260 px cruzava o aviso da porta.
  it('a lista começa acima da coluna do chamado: a mão e a linha do aviso ("O mestre viu", "Esperando o mestre")', async () => {
    const css = await lerPlayerCss()
    const feed = regraBase(css, '.pp-dice-feed')
    const chamado = regraBase(css, '.pp-call')
    const linha = px('var(--lb-control-touch)') + px('var(--lb-control-gap)')
    expect(px(feed.get('bottom'))).toBeGreaterThanOrEqual(px(chamado.get('bottom')) + 2 * linha)
  })

  it('a caixa encolhe até a rolagem mais larga, sem largura fixa, com teto', async () => {
    const feed = regraBase(await lerPlayerCss(), '.pp-dice-feed')
    expect(feed.get('width') ?? 'auto').toBe('auto')
    expect(feed.get('max-width')).toBeDefined()
  })
})

describe('aviso da porta trancada no celular', () => {
  // Em 390 x 844 a pílula centrada encolhia até 195 px e, com os botões de
  // 44 px, virava um bolo de três a quatro linhas por cima do "Chamar o mestre"
  // e do zoom.
  const FILETE = 2

  it('vira uma faixa presa à borda de baixo, da coluna da esquerda até o zoom, sem cobri-lo', async () => {
    const css = await lerPlayerCss()
    const aviso = regraNaMidia(css, CELULAR, '.pp-notice--door')
    const zoom = regraBase(css, '.pp-zoom')
    expect(aviso.get('left')).toBe(regraBase(css, '.pp-ferrolho').get('left'))
    expect(aviso.get('transform')).toBe('none')
    const bordaEsquerdaDoZoom = px(zoom.get('right')) + px('var(--lb-control-touch)') + FILETE
    expect(px(aviso.get('right'))).toBeGreaterThanOrEqual(bordaEsquerdaDoZoom + px('var(--lb-control-gap)'))
    // A entrada não pode puxar a faixa para o meio (o keyframe dos avisos centrados usa translate(-50%)).
    expect(aviso.get('animation') ?? '').not.toContain('pp-notice-in')
  })

  it('duas linhas de botões de toque cabem entre o rodapé e a mão do chamado', async () => {
    const css = await lerPlayerCss()
    const aviso = regraNaMidia(css, CELULAR, '.pp-notice--door')
    const [cima = '', , baixo = cima] = (aviso.get('padding') ?? '').split(/\s+/)
    const vao = px(aviso.get('gap'))
    const altura = px(cima) + 2 * px('var(--lb-control-touch)') + vao + px(baixo) + FILETE
    expect(vao).toBeGreaterThanOrEqual(px('var(--lb-control-gap)'))
    expect(px(aviso.get('bottom')) + altura).toBeLessThanOrEqual(px(regraBase(css, '.pp-call').get('bottom')) - px('var(--lb-control-gap)'))
  })

  it('os pedidos ao mestre ficam só com o vão da faixa: a margem do "Desistir" não empurra a segunda linha', async () => {
    const acao = regraNaMidia(await lerPlayerCss(), CELULAR, '.pp-notice--door .pp-notice__action')
    expect(acao.get('margin-left')).toBe('0')
  })

  it('as insígnias do canto (hora do dia, tela acesa) saem de baixo da faixa enquanto ela está aberta', async () => {
    const css = await lerPlayerCss()
    const sob = (insignia: string) => regraNaMidia(css, CELULAR, `body:has(.pp-notice--door) ${insignia}`)
    expect(sob('.pp-clock').get('opacity')).toBe('0')
    expect(sob('.pp-awake').get('opacity')).toBe('0')
  })
})
