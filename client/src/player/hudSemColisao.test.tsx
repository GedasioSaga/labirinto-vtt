import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { themeCss } from '../theme'
import type { DoorState, MapData, Token, Wall } from '../types/map'
import { emQualquerMidia, lerCss, lerPlayerCss, noContainer, px, regraBase, regraNaMidia, variaveis, type Regra } from './cssDoJogador.testkit'
import { PeekDoorButton } from './PeekDoorButton'

/*
 * O HUD do jogador flutua sobre o mapa: cada controle tem o seu canto e nenhum
 * cobre o outro (bar: Google Maps web em 390 px). Estes testes leem o
 * player.css de verdade e conferem a régua — as contas que ele declara, com
 * as variáveis resolvidas — que o jsdom não calcula. A prova na tela, com as
 * caixas de verdade em sete tamanhos e tudo aceso, é o e2e
 * task-hud-do-jogador-sem-sobreposicao.spec.ts.
 */

const CELULAR = '(max-width: 699px)'
/** Tela de gaveta: o painel nasce fechado e, aberto, cobre o mapa (`PlayerPanel`, DRAWER_QUERIES). */
const GAVETA = '(max-width: 699px), (max-height: 480px)'
const DEITADO = '(max-height: 480px)'
const ESTREITA = '(max-width: 379px)'
const POSICAO = ['position', 'top', 'right', 'bottom', 'left', 'inset', 'transform']

/** Uma linha da pilha do canto: o alvo de toque e o vão do tema. */
const LINHA = px('var(--lb-control-touch)') + px('var(--lb-control-gap)')
const VAO = px('var(--lb-control-gap)')

const zIndex = (regra: Regra): number => Number(regra.get('z-index'))

/** As propriedades de posição que a regra declara: quem não tem lugar próprio não declara nenhuma. */
const posicoes = (regra: Regra): string[] => POSICAO.filter((propriedade) => regra.has(propriedade))

describe('tokens de toque', () => {
  it('o tema tem o alvo de toque do jogador (44 px) ao lado do vão e do alvo de ponteiro', () => {
    expect(themeCss()).toContain('--lb-control-touch: 44px;')
    expect(themeCss()).toContain('--lb-control-gap: 8px;')
  })
})

describe('régua do HUD: a pilha do canto de baixo sai de uma conta só', () => {
  // Antes cada peça tinha o seu `bottom` somado à mão: a escada (126) caiu no
  // lugar da mão do chamado (127) e sumia atrás dela, e a hora do dia (12)
  // cruzava o zoom (24). Agora cada base é a anterior mais o que mora nela.
  it('zoom no chão, a folga dos avisos, as duas linhas do chamado, o alto-falante e o pé da coluna do canto', async () => {
    const css = await lerPlayerCss()
    const v = variaveis(css)
    const chao = px('var(--pp-chao)', v)
    const zoom = px('var(--pp-zoom-alto)', v)
    expect(zoom).toBe(2 * px('var(--lb-control-touch)') + 2)
    expect(px('var(--pp-base-chamado)', v)).toBe(chao + zoom + px('var(--pp-folga-dos-avisos)', v))
    expect(px('var(--pp-base-som)', v)).toBe(px('var(--pp-base-chamado)', v) + 2 * LINHA)
    expect(px('var(--pp-base-rolagens)', v)).toBe(px('var(--pp-base-som)', v) + px('var(--pp-pedra)', v) + VAO)
  })

  it('cada peça da pilha usa a sua base: o zoom, a mão, o alto-falante e o pé da coluna do canto', async () => {
    const css = await lerPlayerCss()
    const v = variaveis(css)
    expect(px(regraBase(css, '.pp-zoom').get('bottom'), v)).toBe(px('var(--pp-chao)', v))
    expect(px(regraBase(css, '.pp-call').get('bottom'), v)).toBe(px('var(--pp-base-chamado)', v))
    expect(px(regraBase(css, '.pp-som').get('bottom'), v)).toBe(px('var(--pp-base-som)', v))
    expect(px(regraBase(css, '.pp-canto').get('bottom'), v)).toBe(px('var(--pp-base-rolagens)', v))
  })

  it('a mão fica acima do grupo do zoom, e o zoom tem a altura que a régua soma (dois alvos e os filetes)', async () => {
    const css = await lerPlayerCss()
    const v = variaveis(css)
    const botao = regraBase(css, '.pp-zoom__button')
    expect(px(botao.get('height'))).toBe(px('var(--lb-control-touch)'))
    expect(px(regraBase(css, '.pp-call').get('bottom'), v)).toBeGreaterThan(px(regraBase(css, '.pp-zoom').get('bottom'), v) + px('var(--pp-zoom-alto)', v))
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
    // O nome inteiro também na tela estreita, onde só o começo ("Espiar") fica à vista.
    expect(botao?.getAttribute('aria-label')).toBe('Espiar pela porta')
    expect(botao?.querySelector('.pp-rotulo-resto')?.textContent).toBe(' pela porta')
  })

  it('a pílula não tem lugar próprio — quem a põe é a coluna das ações do lugar — e tem o alvo de toque de 44 px', async () => {
    const css = await lerPlayerCss()
    const espiar = regraBase(css, '.pp-espiar')
    expect(posicoes(espiar)).toEqual([])
    expect(espiar.has('width')).toBe(false)
    expect(px(espiar.get('min-height'))).toBeGreaterThanOrEqual(44)
    expect(emQualquerMidia(css, '.pp-espiar').flatMap(posicoes)).toEqual([])
    // O cartão do espiar (PlayerPeek) continua com a classe e o lugar dele, no alto.
    expect(regraBase(css, '.pp-peek').get('top')).toBeDefined()
  })

  it('entra subindo do lugar onde fica, sem o translate(-50%) dos avisos centrados', async () => {
    const espiar = regraBase(await lerPlayerCss(), '.pp-espiar')
    expect(espiar.get('animation') ?? '').toContain('pp-espiar-in')
    expect(espiar.get('animation') ?? '').not.toContain('pp-notice-in')
  })
})

describe('ações do lugar: uma coluna só, na metade esquerda', () => {
  // A escada morava no lugar da mão do chamado e sumia atrás dela; o ferrolho,
  // no canto de baixo à esquerda, por baixo da coluna do painel aberta no
  // notebook. As três ações do lugar (espiar, trancar, subir) viraram uma
  // coluna só, `.pp-lugar` (main.tsx).
  it('a coluna é fixa, à esquerda depois da coluna do painel aberta, em coluna com o vão do tema; o vão não pega toque', async () => {
    const css = await lerPlayerCss()
    const lugar = regraBase(css, '.pp-lugar')
    expect(lugar.get('position')).toBe('fixed')
    expect(lugar.get('left')).toContain('--pp-painel-ocupa')
    expect(px(lugar.get('left'))).toBe(12)
    expect(lugar.get('display')).toBe('flex')
    expect(lugar.get('flex-direction')).toBe('column')
    expect(lugar.get('gap')).toContain('--lb-control-gap')
    expect(lugar.get('pointer-events')).toBe('none')
    expect(regraBase(css, '.pp-lugar > *').get('pointer-events')).toBe('auto')
  })

  it('na altura do alto-falante: acima das duas linhas do chamado, que moram na direita', async () => {
    const css = await lerPlayerCss()
    const v = variaveis(css)
    const base = px(regraBase(css, '.pp-lugar').get('bottom'), v)
    expect(base).toBe(px(regraBase(css, '.pp-som').get('bottom'), v))
    expect(base).toBeGreaterThanOrEqual(px(regraBase(css, '.pp-call').get('bottom'), v) + 2 * LINHA)
  })

  it('não passa da metade da tela: do outro lado moram as rolagens e o alto-falante', async () => {
    expect(regraBase(await lerPlayerCss(), '.pp-lugar').get('max-width')).toContain('50vw')
  })

  it.each(['.pp-ferrolho', '.pp-escada', '.pp-escada__button'])('%s não se posiciona sozinho, em tela nenhuma', async (seletor) => {
    const css = await lerPlayerCss()
    const base = POSICAO.some((propriedade) => {
      try {
        return regraBase(css, seletor).has(propriedade)
      } catch {
        return false
      }
    })
    expect(base).toBe(false)
    expect(emQualquerMidia(css, seletor).flatMap(posicoes)).toEqual([])
  })

  it('deitado, sobe para logo abaixo da barra, aberta pela faixa "Sua vez" no fluxo dela', async () => {
    const css = await lerPlayerCss()
    const lugar = regraNaMidia(css, DEITADO, '.pp-lugar')
    expect(px(lugar.get('top'), variaveis(css, DEITADO))).toBe(12 + 1 + 12 + px('var(--lb-control-touch)') + VAO)
    expect(lugar.get('top')).toContain('--pp-alarm-space')
    expect(lugar.get('bottom')).toBe('auto')
    const vez = regraNaMidia(css, DEITADO, '.pp-lugar > .pp-turn')
    expect(vez.get('position')).toBe('static')
    expect(vez.get('transform')).toBe('none')
  })

  it('em tela estreita fica só o começo do rótulo ("Espiar", "Trancar", "Subir"), e a reserva do ferrolho acompanha', async () => {
    const css = await lerPlayerCss()
    expect(regraNaMidia(css, ESTREITA, '.pp-rotulo-resto').get('display')).toBe('none')
    expect(regraNaMidia(css, ESTREITA, '.pp-ferrolho::after').get('content')).toBe('attr(data-reserva-curta)')
  })
})

describe('ferrolho: aperta como o zoom e a escada', () => {
  // Na foto em 390 (celular, toque), o ferrolho tocado ganhava o realce padrão
  // do navegador: um retângulo azul de canto reto por cima da pílula.
  it('sem o realce azul do toque: afunda um pouco ao apertar e volta com calma', async () => {
    const css = await lerPlayerCss()
    const ferrolho = regraBase(css, '.pp-ferrolho')
    expect(ferrolho.get('-webkit-tap-highlight-color')).toBe('transparent')
    expect(ferrolho.get('transition')).toContain('transform')
    const apertado = regraBase(css, '.pp-ferrolho:active:not(:disabled)')
    expect(apertado.get('transform')).toBe('scale(0.97)')
    expect(apertado.get('transition-duration')).toBe('0ms')
    expect(regraNaMidia(css, '(prefers-reduced-motion: reduce)', '.pp-ferrolho').get('transition')).toBe('none')
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
    // Os botões da coluna do cartão do pino ("Pedir para passar", "Me avise
    // quando der", "Barrar a passagem") mediam 40: a mesma altura para todos.
    ['.pp-pincard__travel', false],
    ['.pp-pincard__watch', false],
    ['.pp-pincard__barrar', false],
  ]

  it.each(ALVOS)('%s tem o alvo de toque do tema no celular', async (seletor, soIcone) => {
    const regra = regraNaMidia(await lerPlayerCss(), CELULAR, seletor)
    expect(regra.get('min-height') ?? 'sem min-height').toContain('--lb-control-touch')
    expect(px(regra.get('min-height'))).toBeGreaterThanOrEqual(44)
    if (soIcone) expect(px(regra.get('min-width'))).toBeGreaterThanOrEqual(44)
  })
})

describe('cartão do pino: uma coluna de botões', () => {
  // Em 390 x 844 o "Barrar a passagem" usava a moldura do "Fechar" em linha:
  // esticava de borda a borda, mais largo que o "Pedir para passar", e o
  // "Fechar" ficava sozinho no canto. Agora os botões formam uma coluna só, na
  // mesma margem: o primário cheio, o secundário de contorno e o Fechar
  // discreto por último.
  /** A margem lateral de um `margin: cima lados baixo`. */
  const lados = (margem: string | undefined): string => (margem ?? '').split(/\s+/)[1] ?? ''

  it('"Barrar a passagem" é secundário de contorno, com a largura, a margem e a altura do "Pedir para passar"', async () => {
    const css = await lerPlayerCss()
    const pedir = regraBase(css, '.pp-pincard__travel')
    const barrar = regraBase(css, '.pp-pincard__barrar')
    expect(barrar.get('align-self')).toBe('stretch')
    expect(barrar.get('margin')).toBe(pedir.get('margin'))
    expect(barrar.get('padding')).toBe(pedir.get('padding'))
    expect(barrar.get('border-radius')).toBe(pedir.get('border-radius'))
    expect(barrar.get('background')).toBe('transparent')
    expect(barrar.get('border') ?? '').toMatch(/^1px solid /)
    expect(barrar.get('border') ?? '').toContain('--lb-color-line-panel')
  })

  it('o "Fechar" vem por último, discreto, nas mesmas laterais da coluna', async () => {
    const css = await lerPlayerCss()
    const fechar = regraBase(css, '.pp-pincard__close')
    expect(fechar.get('align-self')).toBe('stretch')
    expect(lados(fechar.get('margin'))).toBe(lados(regraBase(css, '.pp-pincard__travel').get('margin')))
    expect(fechar.get('border') ?? '').toContain('transparent')
    expect(fechar.get('color')).toContain('--lb-color-parchment-dim')
  })

  it('"Voltar" e "Cancelar", ao lado de um primário, seguem de contorno e com o texto claro', async () => {
    const emLinha = regraBase(await lerPlayerCss(), '.pp-pincard__close--inline')
    expect(emLinha.get('align-self')).toBe('auto')
    expect(emLinha.get('margin')).toBe('0')
    expect(emLinha.get('border-color')).toContain('--lb-color-line-panel')
    expect(emLinha.get('color')).toMatch(/--lb-color-parchment[,)]/)
  })

  it('a cabeça do pino abre a linha de título, com o texto embaixo, na largura toda, com ou sem foto', async () => {
    const css = await lerPlayerCss()
    const corpo = regraBase(css, '.pp-pincard__body')
    expect(corpo.get('flex-wrap')).toBe('wrap')
    expect(corpo.get('align-items')).toBe('center')
    expect(regraBase(css, '.pp-pincard--compacto .pp-pincard__body').get('flex-direction') ?? 'row').toBe('row')
    const titulo = regraBase(css, '.pp-pincard__title')
    expect(titulo.get('min-width')).toBe('0')
    expect(titulo.get('overflow-wrap')).toBe('anywhere')
    expect(regraBase(css, '.pp-pincard__text').get('flex-basis')).toBe('100%')
  })
})

describe('rolagens no pé da coluna do canto', () => {
  // Em 390 x 844 a rolagem mais nova ficava a 124 px do rodapé, atrás da mão
  // (z 22 sobre z 12); no celular deitado a lista, com lugar fixo, caía sobre
  // o pé da faixa da vez do confronto. Agora a lista mora no pé da coluna do
  // canto e fica com o que sobra dela: quem cede lugar são as rolagens.
  it('a caixa das rolagens fica com o que sobra da coluna e é um contêiner de altura, encostado no pé', async () => {
    const caixa = regraBase(await lerPlayerCss(), '.pp-rolagens')
    expect(caixa.get('flex')).toBe('1 1 0')
    expect(caixa.get('min-height')).toBe('0')
    expect(caixa.get('container-type')).toBe('size')
    expect(caixa.get('overflow')).toBe('hidden')
    expect(caixa.get('justify-content')).toBe('flex-end')
    // A mais nova embaixo, perto dos controles.
    expect(caixa.get('flex-direction')).toBe('column')
  })

  it('a lista encolhe até a rolagem mais larga, encostada à direita, com teto', async () => {
    const css = await lerPlayerCss()
    const lista = regraBase(css, '.pp-dice-feed')
    expect(lista.get('width')).toBe('max-content')
    expect(lista.get('max-width')).toBe('100%')
    expect(regraBase(css, '.pp-rolagens').get('width')).toContain('260px')
  })

  it('só ficam à vista as rolagens que cabem inteiras: cada corte do contêiner é a altura de N rolagens e dos vãos', async () => {
    const css = await lerPlayerCss()
    const linha = px(regraBase(css, '.pp-dice-feed .lb-dice-feed__item').get('height'))
    const vao = px(regraBase(await lerCss('../components/Dice.css'), '.lb-dice-feed').get('gap'))
    expect(linha).toBe(26)
    /** A altura que N rolagens inteiras pedem. */
    const alturaDe = (n: number): number => n * linha + (n - 1) * vao
    // `nth-last-child(n + k)` some quando não cabem k: a altura do contêiner é menor que a de k.
    for (const k of [2, 3, 4]) {
      const cortes = noContainer(css, `.pp-dice-feed > .lb-dice-feed__item:nth-last-child(n + ${k})`)
      expect(cortes.map(({ condicao }) => condicao)).toEqual([`(height < ${alturaDe(k)}px)`])
      expect(cortes[0]?.regra.get('display')).toBe('none')
    }
    expect(noContainer(css, '.pp-dice-feed > .lb-dice-feed__item').map(({ condicao }) => condicao)).toEqual([`(height < ${alturaDe(1)}px)`])
  })

  it('cada rolagem numa linha só, cortada com reticências no fim: a altura não depende da fonte', async () => {
    const item = regraBase(await lerPlayerCss(), '.pp-dice-feed .lb-dice-feed__item')
    expect(item.get('white-space')).toBe('nowrap')
    expect(item.get('text-overflow')).toBe('ellipsis')
    expect(item.get('box-sizing')).toBe('border-box')
  })
})

describe('aviso da porta trancada no celular', () => {
  // Em 390 x 844 a pílula centrada encolhia até 195 px e, com os botões de
  // 44 px, virava um bolo de três a quatro linhas por cima do "Chamar o mestre"
  // e do zoom.
  const FILETE = 2

  it('vira uma faixa presa à borda de baixo, da borda da esquerda até a coluna do zoom, sem cobri-la', async () => {
    const css = await lerPlayerCss()
    const aviso = regraNaMidia(css, CELULAR, '.pp-notice--door')
    const zoom = regraBase(css, '.pp-zoom')
    // A mesma margem da coluna das ações do lugar, com a coluna do painel fechada (gaveta).
    expect(px(aviso.get('left'))).toBe(px(regraBase(css, '.pp-lugar').get('left')))
    expect(aviso.get('transform')).toBe('none')
    const bordaEsquerdaDoZoom = px(zoom.get('right')) + px('var(--lb-control-touch)') + FILETE
    expect(px(aviso.get('right'))).toBeGreaterThanOrEqual(bordaEsquerdaDoZoom + VAO)
    // A entrada não pode puxar a faixa para o meio (o keyframe dos avisos centrados usa translate(-50%)).
    expect(aviso.get('animation') ?? '').not.toContain('pp-notice-in')
  })

  it('duas linhas de botões de toque cabem entre o rodapé e a mão do chamado', async () => {
    const css = await lerPlayerCss()
    const aviso = regraNaMidia(css, CELULAR, '.pp-notice--door')
    const [cima = '', , baixo = cima] = (aviso.get('padding') ?? '').split(/\s+/)
    const vao = px(aviso.get('gap'))
    const altura = px(cima) + 2 * px('var(--lb-control-touch)') + vao + px(baixo) + FILETE
    expect(vao).toBeGreaterThanOrEqual(VAO)
    expect(px(aviso.get('bottom')) + altura).toBeLessThanOrEqual(px(regraBase(css, '.pp-call').get('bottom'), variaveis(css)) - VAO)
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

  it('deitado, a mão mora no chão: a faixa para antes da coluna do chamado, que tem largura reservada', async () => {
    const css = await lerPlayerCss()
    const v = variaveis(css, DEITADO)
    const aviso = regraNaMidia(css, DEITADO, '.pp-notice--door')
    const chamado = regraNaMidia(css, DEITADO, '.pp-call')
    expect(chamado.get('max-width')).toBe('var(--pp-chamado-largura)')
    const bordaEsquerdaDoChamado = px(chamado.get('right'), v) + px('var(--pp-chamado-largura)', v)
    expect(px(aviso.get('right'), v)).toBeGreaterThanOrEqual(bordaEsquerdaDoChamado + VAO)
    expect(aviso.get('transform')).toBe('none')
  })
})

describe('canto da direita', () => {
  // Em 1280 x 800 as abas de andar, o selo da cena, o "Onde estou" e o
  // confronto moravam todos em top 12 / right 12, um por cima do outro. Em
  // 390 x 844 a barra cobria as abas e o selo, o alarme cobria o selo, e o
  // confronto descia para cima do "Chamar o mestre", do aviso e do ferrolho.
  // O selo da cena e o "Onde estou" viraram um selo só (`.pp-where`).
  const FILHOS = ['.pp-floors', '.pp-where', '.pp-confronto', '.pp-rolagens', '.pp-dice-feed']

  it('uma coluna só, presa ao canto, com o vão do tema entre os selos e descendo com o alarme', async () => {
    const canto = regraBase(await lerPlayerCss(), '.pp-canto')
    expect(canto.get('position')).toBe('fixed')
    expect(canto.get('right')).toBe('12px')
    expect(canto.get('top')).toContain('--pp-alarm-space')
    expect(canto.get('display')).toBe('flex')
    expect(canto.get('flex-direction')).toBe('column')
    expect(canto.get('align-items')).toBe('flex-end')
    expect(canto.get('gap')).toContain('--lb-control-gap')
    // O arrasto que começa no vão entre os selos continua sendo arrasto do mapa.
    expect(canto.get('pointer-events')).toBe('none')
  })

  it('os selos ficam inteiros: só a caixa das rolagens encolhe', async () => {
    const css = await lerPlayerCss()
    expect(regraBase(css, '.pp-canto > *').get('flex-shrink')).toBe('0')
    expect(regraBase(css, '.pp-rolagens').get('flex')).toBe('1 1 0')
  })

  it('no celular desce para baixo da barra: borda, filete, respiro, alvo de toque e o vão', async () => {
    const css = await lerPlayerCss()
    const canto = regraNaMidia(css, CELULAR, '.pp-canto')
    const fundoDaBarra = 12 + 1 + 12 + px('var(--lb-control-touch)')
    expect(px(canto.get('top'), variaveis(css))).toBeGreaterThanOrEqual(fundoDaBarra + VAO)
    expect(canto.get('top')).toContain('--pp-alarm-space')
  })

  it.each(FILHOS)('%s não se posiciona sozinho: segue a coluna, em qualquer tela', async (seletor) => {
    const css = await lerPlayerCss()
    expect(posicoes(regraBase(css, seletor))).toEqual([])
    expect(emQualquerMidia(css, seletor).flatMap(posicoes)).toEqual([])
  })

  it('as abas de andar e o "Onde estou" voltam a pegar o toque dentro da coluna', async () => {
    const css = await lerPlayerCss()
    expect(regraBase(css, '.pp-floors').get('pointer-events')).toBe('auto')
    expect(regraBase(css, '.pp-where').get('pointer-events')).toBe('auto')
  })

  it('sem ficha no mapa o "Onde estou" só diz a cena e não pega toque: o arrasto que começa nele é do mapa', async () => {
    expect(regraBase(await lerPlayerCss(), '.pp-where--static').get('pointer-events')).toBe('none')
  })
})

describe('selo de estado: a hora do dia e a "Tela acesa"', () => {
  // A hora do dia morava sozinha a 12 px do rodapé, no canto do zoom, e
  // cruzava o grupo do + e do −. Agora ela e a "Tela acesa" formam um selo só.
  it('no notebook o selo é o fim da coluna do canto, alinhado à direita, sem lugar próprio', async () => {
    const css = await lerPlayerCss()
    const estado = regraBase(css, '.pp-estado')
    expect(estado.get('display')).toBe('flex')
    expect(estado.get('justify-content')).toBe('flex-end')
    expect(posicoes(estado)).toEqual([])
    expect(posicoes(regraBase(css, '.pp-clock'))).toEqual([])
  })

  it('em tela de gaveta, no canto de baixo à esquerda, crescendo para cima, sem chegar à coluna do zoom', async () => {
    const css = await lerPlayerCss()
    const estado = regraNaMidia(css, GAVETA, '.pp-estado')
    expect(estado.get('position')).toBe('fixed')
    expect(px(estado.get('left'))).toBe(12)
    expect(px(estado.get('bottom'))).toBe(12)
    expect(estado.get('flex-wrap')).toBe('wrap-reverse')
    expect(estado.get('max-width')).toContain('--pp-coluna-de-pedra')
  })

  it('a "Tela acesa" da espera continua presa sozinha ao canto; no jogo, segue o selo', async () => {
    const css = await lerPlayerCss()
    expect(regraBase(css, '.pp-awake').get('position')).toBe('fixed')
    expect(regraBase(css, '.pp-estado .pp-awake').get('position')).toBe('static')
  })
})

describe('gaveta do painel: da largura da barra e das abas, com teto na janela', () => {
  // Em 390 a gaveta tinha uns 275 px e a barra de cima (Painel, Minha ficha,
  // Inventário) uns 355: a barra passava da gaveta. Nome, Foto ("Nenhum arquivo
  // escolhido"), Por quem e Onde passavam da borda direita, e em 1280 a fileira
  // de abas rolava de lado. A largura fixa era menor que a fileira de abas.
  const TETO = 'calc(100% - 2 * var(--pp-edge))'

  it('cresce até caber a fileira de abas, nunca mais estreita que a barra nem mais larga que a janela', async () => {
    const painel = regraBase(await lerPlayerCss(), '.pp-panel')
    expect(painel.get('width')).toBe('max-content')
    expect(painel.get('min-width')).toContain('var(--pp-bar-w')
    expect(painel.get('min-width')).toContain('248px')
    // `min-width` vence `max-width`: o teto mora dentro do próprio piso.
    expect(painel.get('min-width')).toContain(TETO)
    expect(painel.get('max-width')).toBe(TETO)
  })

  it('no celular só o piso sobe; a largura continua a das abas e o teto o mesmo', async () => {
    const gaveta = regraNaMidia(await lerPlayerCss(), CELULAR, '.pp-panel')
    expect(gaveta.get('width')).toBeUndefined()
    expect(gaveta.get('min-width')).toContain('280px')
    expect(gaveta.get('min-width')).toContain('var(--pp-bar-w')
    expect(gaveta.get('min-width')).toContain(TETO)
  })

  it('o conteúdo das abas não estica a gaveta', async () => {
    expect(regraBase(await lerPlayerCss(), '.pp-tabpanel').get('contain')).toBe('inline-size')
  })

  it.each(['.pp-panel .pp-input', '.pp-panel .pp-file'])('%s encolhe com a gaveta e nunca passa da borda', async (seletor) => {
    const campo = regraBase(await lerPlayerCss(), seletor)
    expect(campo.get('min-width')).toBe('0')
    expect(campo.get('max-width')).toBe('100%')
  })

  it('o seletor de arquivo é contido: "Nenhum arquivo escolhido" não vira o mínimo da coluna', async () => {
    const arquivo = regraBase(await lerPlayerCss(), '.pp-file')
    expect(arquivo.get('contain')).toBe('inline-size')
    expect(arquivo.get('overflow')).toBe('hidden')
    expect(arquivo.get('white-space')).toBe('nowrap')
  })

  it.each(['.pp-canto', '.pp-zoom', '.pp-som', '.pp-call', '.pp-lugar'])(
    'aberta, a gaveta é a tela: %s sai de cena em vez de ficar por cima dela (celular em pé e deitado)',
    async (seletor) => {
      const regra = regraNaMidia(await lerPlayerCss(), GAVETA, `body:has(.pp-panel:not([hidden])) ${seletor}`)
      expect(regra.get('display')).toBe('none')
    },
  )

  it('as rolagens aparecem dentro da aba Dados só na gaveta: na coluna do notebook a lista do mapa continua à vista', async () => {
    const css = await lerPlayerCss()
    expect(regraBase(css, '.pp-dados-rolagens').get('display')).toBe('none')
    expect(regraNaMidia(css, GAVETA, '.pp-dados-rolagens').get('display')).toBe('grid')
  })
})

describe('barra de cima em tela estreita', () => {
  // Em 320 x 568 a barra (Painel, Minha ficha, Inventário) media 338 px e
  // passava da borda da tela.
  it('abaixo de 380 px o Inventário fica só com a bolsa, num alvo quadrado de toque', async () => {
    const bolsa = regraNaMidia(await lerPlayerCss(), ESTREITA, '.pp-bag')
    expect(bolsa.get('width')).toBe('var(--pp-bar-h)')
    expect(bolsa.get('padding')).toBe('0')
  })

  it('o nome "Inventário" sai da vista e fica para o leitor de tela; a tecla I some junto', async () => {
    const css = await lerPlayerCss()
    const rotulo = regraNaMidia(css, ESTREITA, '.pp-bag__rotulo')
    expect(rotulo.get('position')).toBe('absolute')
    expect(rotulo.get('width')).toBe('1px')
    expect(rotulo.get('clip')).toBe('rect(0, 0, 0, 0)')
    expect(rotulo.get('display')).toBeUndefined()
    expect(regraNaMidia(css, ESTREITA, '.pp-bag__key').get('display')).toBe('none')
  })
})

describe('alto-falante (som da mesa) na pilha do canto de baixo à direita', () => {
  // Pedido "sons", fatia 3. O alto-falante entra acima das duas linhas do
  // chamado, no prumo do zoom; a mão e o zoom não mudam de lugar, e a coluna
  // do canto (com as rolagens no pé) termina acima dele.
  async function gatilhoFlutuante(): Promise<Regra> {
    return regraBase(await lerCss('../components/ControleDeSom.css'), '.lb-som--flutuante .lb-som__gatilho')
  }

  it('no prumo do zoom, acima da mão e da linha do aviso do chamado', async () => {
    const css = await lerPlayerCss()
    const v = variaveis(css)
    const som = regraBase(css, '.pp-som')
    expect(som.get('position')).toBe('fixed')
    expect(som.get('right')).toBe(regraBase(css, '.pp-zoom').get('right'))
    expect(px(som.get('bottom'), v)).toBeGreaterThanOrEqual(px(regraBase(css, '.pp-call').get('bottom'), v) + 2 * LINHA)
  })

  it('o botão tem o alvo de toque, e a coluna do canto (com as rolagens) termina acima dele com o vão do tema', async () => {
    const css = await lerPlayerCss()
    const v = variaveis(css)
    const gatilho = await gatilhoFlutuante()
    expect(px(gatilho.get('width'))).toBeGreaterThanOrEqual(44)
    expect(px(gatilho.get('height'))).toBeGreaterThanOrEqual(44)
    // Do mesmo tamanho do zoom: os dois controles de pedra formam uma coluna só.
    expect(px(gatilho.get('width'))).toBe(px('var(--pp-pedra)', v))
    const som = regraBase(css, '.pp-som')
    const canto = regraBase(css, '.pp-canto')
    expect(px(canto.get('bottom'), v)).toBeGreaterThanOrEqual(px(som.get('bottom'), v) + px(gatilho.get('height')) + VAO)
  })

  it('acima da coluna do canto e das rolagens (o popover abre por cima delas) e abaixo do chamado', async () => {
    const css = await lerPlayerCss()
    const som = zIndex(regraBase(css, '.pp-som'))
    expect(som).toBeGreaterThan(zIndex(regraBase(css, '.pp-canto')))
    expect(som).toBeLessThan(zIndex(regraBase(css, '.pp-call')))
  })

  it('o popover abre para cima, preso à borda direita do botão, e cabe numa tela de 320 px', async () => {
    const css = await lerCss('../components/ControleDeSom.css')
    const pop = regraBase(css, '.lb-som__pop')
    expect(px(pop.get('width'))).toBeLessThanOrEqual(320 - 2 * 12)
    expect(pop.get('max-width')).toContain('100vw')
    const acima = regraBase(css, '.lb-som--flutuante .lb-som__pop')
    expect(acima.get('right')).toBe('0')
    expect(acima.get('bottom')).toContain('100%')
    expect(acima.get('transform-origin')).toBe('bottom right')
  })
})

describe('celular deitado: a pilha do canto de baixo sem altura de sobra', () => {
  // Em 844 x 390 (uns 340 px úteis com a barra do navegador) a pilha em pé
  // não cabe: o popover do alto-falante saía pelo alto da tela, a coluna do
  // canto com o confronto aberto descia até a mão do chamado, e as rolagens
  // caíam sobre o pé da faixa da vez. Deitado, a pilha vira duas colunas no pé:
  // a de pedra (zoom e alto-falante) na borda e a do chamado ao lado.
  it('o popover abre para a esquerda do alto-falante, com o pé no pé dele: só cresce para cima', async () => {
    const pop = regraNaMidia(await lerCss('../components/ControleDeSom.css'), DEITADO, '.lb-som--flutuante .lb-som__pop')
    expect(pop.get('right')).toBe('calc(100% + 8px)')
    expect(pop.get('bottom')).toBe('0')
    // A entrada nasce do canto mais perto do botão.
    expect(pop.get('transform-origin')).toBe('bottom right')
  })

  it.each(['.pp-canto', '.pp-call'])('%s sai do prumo do alto-falante, para a esquerda da coluna de pedra', async (seletor) => {
    const css = await lerPlayerCss()
    const v = variaveis(css, DEITADO)
    const bordaDaColuna = px(regraBase(css, '.pp-zoom').get('right')) + px('var(--pp-pedra)', v) + VAO
    expect(px(regraNaMidia(css, DEITADO, seletor).get('right'), v)).toBeGreaterThanOrEqual(bordaDaColuna)
  })

  it('a régua deitada: a mão no chão, o alto-falante em cima do zoom e a coluna do canto acima das duas linhas do chamado', async () => {
    const css = await lerPlayerCss()
    const v = variaveis(css, DEITADO)
    const chao = px('var(--pp-chao)', v)
    expect(px('var(--pp-base-chamado)', v)).toBe(chao)
    expect(px('var(--pp-base-som)', v)).toBe(chao + px('var(--pp-zoom-alto)', v) + VAO)
    expect(px('var(--pp-base-rolagens)', v)).toBe(chao + 2 * LINHA)
    // A coluna do canto desce até ali; o alto-falante, na outra coluna, não a cruza.
    expect(px(regraBase(css, '.pp-canto').get('bottom'), v)).toBe(px('var(--pp-base-rolagens)', v))
  })

  it('o confronto numa linha só (a vez e a fila lado a lado), para a coluna caber na altura', async () => {
    const css = await lerPlayerCss()
    const confronto = regraNaMidia(css, DEITADO, '.pp-confronto')
    expect(confronto.get('display')).toBe('flex')
    expect(confronto.get('flex-wrap')).toBe('wrap')
    expect(regraNaMidia(css, DEITADO, '.pp-confronto__fila').get('margin')).toBe('0')
  })

  it('aberto, o alto-falante passa por cima do chamado: preso à margem da tela, o popover desce até a linha do aviso', async () => {
    const css = await lerPlayerCss()
    const aberto = Number(regraBase(css, '.pp-som:has(.lb-som__pop)').get('z-index'))
    expect(aberto).toBeGreaterThan(Number(regraBase(css, '.pp-call').get('z-index')))
  })
})
