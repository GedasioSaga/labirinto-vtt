import { describe, expect, it, vi } from 'vitest'
import { theme, themeCss } from '../theme'

/**
 * POLIMENTO DO MESTRE (lote A da lista de UX, 30/09/2026): aperto dos botões,
 * estados honestos, dica da barra, entrada de janelas, menus e confirmações, e
 * os balões de ferramenta. Quase tudo mora em CSS, e o jsdom não pinta nem
 * anima: o teste lê as regras como estão no disco. A conferência visual no app
 * é a outra metade da prova.
 *
 * Toda regra que mexe em `transform` ou em `animation` precisa do par em
 * `@media (prefers-reduced-motion: reduce)`: o bloco global do main.css só
 * encurta a duração para 1 ms, e um salto de escala de 1 ms continua sendo
 * movimento.
 */

/** Um CSS como está no disco, relativo a esta pasta (ver `Toggle.test.tsx`: `?raw` e `new URL` não leem o arquivo). */
async function lerCss(relativo: string): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativo), 'utf8')
}

const REDUZIDO = '@media (prefers-reduced-motion: reduce)'

/** O CSS sem comentários, separado entre fora e dentro dos blocos de movimento reduzido. */
function separar(css: string): { normal: string; reduzido: string } {
  const texto = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let normal = ''
  let reduzido = ''
  let cursor = 0
  for (let inicio = texto.indexOf(REDUZIDO); inicio >= 0; inicio = texto.indexOf(REDUZIDO, cursor)) {
    const abre = texto.indexOf('{', inicio)
    let fim = abre + 1
    for (let profundidade = 1; profundidade > 0 && fim < texto.length; fim += 1) {
      if (texto[fim] === '{') profundidade += 1
      else if (texto[fim] === '}') profundidade -= 1
    }
    normal += texto.slice(cursor, inicio)
    reduzido += texto.slice(abre + 1, fim - 1)
    cursor = fim
  }
  return { normal: normal + texto.slice(cursor), reduzido }
}

const compacto = (texto: string) => texto.replace(/\s+/g, ' ').trim()

/** Os seletores de uma lista, cortando só nas vírgulas de fora dos parênteses (`:has(...)`, `:not(...)`). */
function seletoresDa(lista: string): string[] {
  const partes: string[] = []
  let atual = ''
  let profundidade = 0
  for (const letra of lista) {
    if (letra === '(') profundidade += 1
    if (letra === ')') profundidade -= 1
    if (letra === ',' && profundidade === 0) {
      partes.push(compacto(atual))
      atual = ''
    } else {
      atual += letra
    }
  }
  return [...partes, compacto(atual)]
}

/** A regra vale para `seletor`: a lista inteira é ele, ou ele é um dos seletores da lista. */
function vale(lista: string, seletor: string): boolean {
  const alvo = compacto(seletor)
  return compacto(lista) === alvo || seletoresDa(lista).includes(alvo)
}

/** As declarações da PRIMEIRA regra que vale para `seletor`: propriedade → valor (espaços normalizados). */
function regra(trecho: string, seletor: string): Map<string, string> {
  for (const [, seletores, corpo] of trecho.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!vale(seletores, seletor)) continue
    return new Map(
      corpo
        .split(';')
        .map((declaracao) => declaracao.split(':'))
        .filter((partes) => partes.length >= 2)
        .map(([propriedade, ...valor]) => [propriedade.trim(), compacto(valor.join(':'))]),
    )
  }
  return new Map()
}

/** Onde começa a primeira regra que vale para `seletor`; -1 se não existe. */
function posicao(trecho: string, seletor: string): number {
  for (const achado of trecho.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    if (vale(achado[1], seletor)) return achado.index ?? -1
  }
  return -1
}

const RAPIDO = 'var(--lb-motion-fast) var(--lb-motion-ease)'
const BASE = 'var(--lb-motion-base) var(--lb-motion-ease)'

describe('M1 — apertar afunda, e a borda acompanha o fundo', () => {
  it('botões, ícones, abas, cartões e linhas animam transform e border-color no tempo curto', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    const transicao = (seletor: string) => regra(normal, seletor).get('transition') ?? ''
    for (const seletor of ['.lb-btn', '.lb-iconbtn', '.lb-railtabs__tab', '.lb-menucard', '.lb-maplist__item']) {
      expect(transicao(seletor), seletor).toContain(`transform ${RAPIDO}`)
    }
    for (const seletor of ['.lb-iconbtn', '.lb-seg__option', '.lb-seg--pairs .lb-seg__option', '.lb-railtabs__tab', '.lb-maplist__item', '.lb-cenas__item']) {
      expect(transicao(seletor), seletor).toContain(`border-color ${RAPIDO}`)
    }
  })

  it('o aperto é scale(0.97) nos botões e 0.985 nos cartões largos, e some com movimento reduzido', async () => {
    const { normal, reduzido } = separar(await lerCss('../main.css'))
    const apertos: [string, string][] = [
      ['.lb-btn:active:not(:disabled)', 'scale(0.97)'],
      ['.lb-iconbtn:active:not(:disabled)', 'scale(0.97)'],
      ['.lb-railtabs__tab:active', 'scale(0.97)'],
      ['.lb-menucard:active:not(:disabled)', 'scale(0.985)'],
      // O cartão de mapa é um <div> com quatro botões e o campo de renomear
      // dentro: só o botão que abre o mapa afunda o cartão.
      ['.lb-maplist__item:has(> button:not(:disabled):active)', 'scale(0.985)'],
    ]
    for (const [seletor, escala] of apertos) {
      expect(regra(normal, seletor).get('transform'), seletor).toBe(escala)
      expect(regra(reduzido, seletor).get('transform'), `${seletor} com movimento reduzido`).toBe('none')
    }
  })

  it('apertado, o ícone sobe acima dos vizinhos: o balão dele não fica por baixo da segunda fileira da barra', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    // O transform faz do botão um contexto de empilhamento, e o balão (z-index
    // 10) passa a valer só dentro dele. 2 fica abaixo da setinha de variantes (3).
    expect(regra(normal, '.lb-iconbtn:active:not(:disabled)').get('z-index')).toBe('2')
    expect(regra(normal, '.lb-toolvariant-arrow').get('z-index')).toBe('3')
  })

  it('o "Limpar busca" segue centrado no campo enquanto afunda', async () => {
    const { normal, reduzido } = separar(await lerCss('../main.css'))
    const seletor = '.lb-objetos__limpar:active:not(:disabled)'
    expect(regra(normal, seletor).get('transform')).toBe('translateY(-50%) scale(0.97)')
    expect(regra(reduzido, seletor).get('transform')).toBe('translateY(-50%)')
    // Mesma especificidade do aperto genérico do ícone: vence por vir depois.
    expect(posicao(normal, seletor)).toBeGreaterThan(posicao(normal, '.lb-iconbtn:active:not(:disabled)'))
    expect(posicao(reduzido, seletor)).toBeGreaterThan(posicao(reduzido, '.lb-iconbtn:active:not(:disabled)'))
  })
})

describe('M4 — desabilitado parece desabilitado, e o foco aparece', () => {
  it('o anel de foco é latão sólido com folga escura, e não um halo translúcido', () => {
    expect(theme.shadow.focus).toBe('0 0 0 2px var(--lb-color-stone-solid), 0 0 0 4px var(--lb-color-brass)')
    expect(themeCss()).toContain('--lb-shadow-focus: 0 0 0 2px var(--lb-color-stone-solid), 0 0 0 4px var(--lb-color-brass);')
  })

  it('botão desabilitado perde a borda de latão; o fantasma continua sem moldura', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    expect(regra(normal, '.lb-btn:disabled').get('border-color')).toBe('var(--lb-color-line)')
    expect(regra(normal, '.lb-btn--ghost:disabled').get('border-color')).toBe('transparent')
    expect(posicao(normal, '.lb-btn--ghost:disabled')).toBeGreaterThan(posicao(normal, '.lb-btn:disabled'))
  })

  it('ícone desabilitado é regra global, e as cópias locais saíram', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    const desabilitado = regra(normal, '.lb-iconbtn:disabled')
    expect(desabilitado.get('opacity')).toBe('0.35')
    expect(desabilitado.get('cursor')).toBe('default')
    expect(await lerCss('./ActionBar.css')).not.toMatch(/\.lb-iconbtn:disabled\s*\{/)
    expect(await lerCss('./AlignDistributeControls.css')).not.toMatch(/\.lb-iconbtn:disabled\s*\{/)
  })

  it('no Corte da Torre o anel de foco não é apagado pela sombra do ponto', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    expect(regra(normal, '.lb-corte__ponto:focus-visible').get('box-shadow')).toBe(
      'inset 0 0 0 1px var(--lb-color-parchment), var(--lb-shadow-focus)',
    )
    expect(posicao(normal, '.lb-corte__ponto:focus-visible')).toBeGreaterThan(posicao(normal, '.lb-corte__ponto:hover'))
  })
})

describe('M8 — com o menu da setinha aberto, a dica da ferramenta sai', () => {
  it('a dica fica transparente enquanto a barra tem um menu de variantes', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    expect(regra(normal, '.lb-toolbar:has(.lb-toolvariant-menu) ~ .lb-hint').get('opacity')).toBe('0')
  })
})

describe('M9 — o fundo da janela escurece num esmaecer curto', () => {
  it('o véu é uma camada própria que entra esmaecendo; a janela não leva a opacidade dele', async () => {
    const { normal, reduzido } = separar(await lerCss('../main.css'))
    expect(regra(normal, '.lb-dialog-backdrop').get('background')).toBeUndefined()
    expect(regra(normal, '.lb-dialog-backdrop').get('animation')).toBeUndefined()
    const veu = regra(normal, '.lb-dialog-backdrop::before')
    expect(veu.get('background')).toBe('rgba(0, 0, 0, 0.32)')
    expect(veu.get('animation')).toBe(`lb-fundo-entra ${BASE}`)
    expect(compacto(normal)).toContain('@keyframes lb-fundo-entra { from { opacity: 0; } }')
    // Atalhos abre pela tecla "?": nem a caixa nem o véu animam.
    expect(regra(normal, '.lb-dialog-backdrop:has(> .lb-shortcuts)::before').get('animation')).toBe('none')
    expect(regra(reduzido, '.lb-dialog-backdrop::before').get('animation')).toBe('none')
  })

  it('o balão da engrenagem cresce para dentro do painel, e não por baixo da barra de ferramentas', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    // Centrado no botão, o balão passava quase 50 px da borda direita do
    // inspetor, e a barra de ferramentas (z-index 2, acima do painel inteiro)
    // cobria o fim do texto em 1280 e 1440 ("Configurações do m"). Alinhado
    // pela direita do botão, ele cabe no painel; a setinha (::before) segue no
    // meio do botão.
    const repouso = regra(normal, '.lb-inspector__settings.lb-tip::after')
    expect(repouso.get('left')).toBe('auto')
    expect(repouso.get('right')).toBe('0')
    expect(repouso.get('transform')).toBe('translateY(-3px)')
    expect(regra(normal, '.lb-inspector__settings.lb-tip::before').size).toBe(0)
    for (const seletor of ['.lb-inspector__settings.lb-tip:hover::after', '.lb-inspector__settings.lb-tip:focus-visible::after']) {
      expect(regra(normal, seletor).get('transform'), seletor).toBe('translateY(0)')
    }
  })
})

describe('M10 — menus e confirmações entram de onde foram chamados', () => {
  it('o menu da setinha cresce do canto do botão, dos dois lados', async () => {
    const { normal, reduzido } = separar(await lerCss('../main.css'))
    const menu = regra(normal, '.lb-toolvariant-menu')
    expect(menu.get('transform-origin')).toBe('top left')
    expect(menu.get('animation')).toBe(`lb-cenas-menu-entra ${RAPIDO}`)
    expect(regra(normal, '.lb-toolvariant-menu--direita').get('transform-origin')).toBe('top right')
    expect(regra(reduzido, '.lb-toolvariant-menu').get('animation')).toBe('none')
  })

  it('as confirmações em linha descem da linha de onde vieram', async () => {
    const { normal, reduzido } = separar(await lerCss('../main.css'))
    for (const seletor of ['.lb-room__confirm', '.lb-cenas__apagar']) {
      expect(regra(normal, seletor).get('animation'), seletor).toBe(`lb-mais-abre ${BASE}`)
      expect(regra(reduzido, seletor).get('animation'), `${seletor} com movimento reduzido`).toBe('none')
    }
  })

  it('o menu de imagem de fundo nasce da barra, de baixo para cima', async () => {
    const { normal, reduzido } = separar(await lerCss('./ActionBar.css'))
    const menu = regra(normal, '.lb-panel.lb-actionbar-menu')
    expect(menu.get('transform-origin')).toBe('bottom center')
    expect(menu.get('animation')).toBe(`lb-cenas-menu-entra ${RAPIDO}`)
    expect(regra(reduzido, '.lb-panel.lb-actionbar-menu').get('animation')).toBe('none')
  })
})

describe('M11 — balões de ferramenta: só o primeiro espera', () => {
  it('a espera do primeiro balão é token, lido pelo CSS e pelo Toolbar', async () => {
    expect(themeCss()).toContain('--lb-motion-tip-delay: 320ms;')
    const { normal } = separar(await lerCss('../main.css'))
    expect(regra(normal, '.lb-tip:hover::after, .lb-tip:focus-visible::after').get('transition-delay')).toBe('var(--lb-motion-tip-delay)')
    expect(regra(normal, '.lb-tip:hover::before, .lb-tip:focus-visible::before').get('transition-delay')).toBe('var(--lb-motion-tip-delay)')
  })

  it('o foco do teclado e a barra aquecida trazem o balão na hora, sem espera e sem movimento', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    for (const seletor of [
      '.lb-tip:focus-visible::after, .lb-tip:focus-visible::before',
      '.lb-toolbar[data-tip-quente] .lb-tip::after, .lb-toolbar[data-tip-quente] .lb-tip::before',
    ]) {
      const instantaneo = regra(normal, seletor)
      expect(instantaneo.get('transition-delay'), seletor).toBe('0ms')
      expect(instantaneo.get('transition-duration'), seletor).toBe('0ms')
      // Vem depois da regra do pairar, que tem a mesma especificidade no caso do foco.
      expect(posicao(normal, seletor), seletor).toBeGreaterThan(posicao(normal, '.lb-tip:hover::after, .lb-tip:focus-visible::after'))
    }
  })

  it('só a entrada anima: o balão que sai some na hora e não esmaece por cima do próximo', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    // A saída usa o tempo do estado de REPOUSO. No Tab, o Chrome recalcula o
    // estilo entre tirar o foco de um ícone e dar ao outro, e nesse meio-tempo
    // nada na fileira está focado: nenhuma regra "de teclado" alcança o balão
    // que sai (a conferência mediu 1 → 0,17 → 0,03 em 60 ms, por cima do
    // novo). Só o repouso instantâneo resolve, no Tab e no mouse.
    for (const seletor of ['.lb-tip::after', '.lb-tip::before']) {
      const repouso = regra(normal, seletor)
      expect(repouso.get('transition-property'), seletor).toBe('opacity, transform')
      expect(repouso.get('transition-duration'), seletor).toBe('0ms')
      expect(repouso.get('transition-delay'), seletor).toBe('0ms')
      expect(repouso.has('transition'), `${seletor} sem o atalho, que zeraria as partes acima`).toBe(false)
    }
    // O tempo da entrada mora nos estados de mostrar.
    expect(regra(normal, '.lb-tip:hover::after, .lb-tip:focus-visible::after').get('transition-duration')).toBe('var(--lb-motion-fast)')
    expect(regra(normal, '.lb-tip:hover::before, .lb-tip:focus-visible::before').get('transition-duration')).toBe('var(--lb-motion-fast)')
  })

  it('o balão sobe um degrau acima da pedra do painel', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    expect(regra(normal, '.lb-tip::after').get('background')).toBe('var(--lb-color-stone-raised)')
    expect(regra(normal, '.lb-tip::before').get('background')).toBe('var(--lb-color-stone-raised)')
  })

  it('botão com o próprio menu aberto: o menu responde, e o balão sai na hora', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    // Visto na conferência do M10: com o menu de imagem de fundo aberto, o
    // balão do botão de imagem ficava atrás do menu, com o texto vazando pela
    // borda. O pairar continua valendo enquanto o menu está aberto, então a
    // regra também zera a espera e o tempo que ele traria.
    const seletor = ".lb-tip[aria-expanded='true']::after, .lb-tip[aria-expanded='true']::before"
    const aberto = regra(normal, seletor)
    expect(aberto.get('opacity')).toBe('0')
    expect(aberto.get('transition-delay')).toBe('0ms')
    expect(aberto.get('transition-duration')).toBe('0ms')
    // Mesma especificidade do pairar e do foco: vence por vir depois dos dois.
    expect(posicao(normal, seletor)).toBeGreaterThan(posicao(normal, '.lb-tip:hover::after, .lb-tip:focus-visible::after'))
    expect(posicao(normal, seletor)).toBeGreaterThan(posicao(normal, '.lb-tip:focus-visible::after, .lb-tip:focus-visible::before'))
  })

  it('na barra de ferramentas o menu é da setinha: o balão do botão irmão também sai com ele aberto', async () => {
    const { normal } = separar(await lerCss('../main.css'))
    // O menu nasce 6 px abaixo da âncora, colado à esquerda; o balão do botão
    // nasce 8 px abaixo, centrado nele, e o pedaço que passa da borda esquerda
    // do menu ficaria à vista atrás dele.
    const par = ".lb-toolvariant-anchor:has(> .lb-toolvariant-arrow[aria-expanded='true']) > .lb-tip"
    const aberto = regra(normal, `${par}::after, ${par}::before`)
    expect(aberto.get('opacity')).toBe('0')
    expect(aberto.get('transition-delay')).toBe('0ms')
    expect(aberto.get('transition-duration')).toBe('0ms')
  })
})
