import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemDoAcervoNaTela, PastaDoAcervo } from '../lib/tokenLibrary'
import { CloseIcon, MoveIntoIcon } from './icons'
import { TokenLibraryPanel, type TokenLibraryPanelProps } from './TokenLibraryPanel'

/**
 * ACERVO LIMPO (pedido painel-acervo, fatia 4): cada token é uma LINHA, não um
 * cartão; o Mover e o Apagar só aparecem sob o ponteiro, no foco ou com o menu
 * aberto; a pasta perde a faixa cheia e a pasta vazia deixa de ter seta.
 *
 * O CSS é conferido pela CASCATA, e não pelo texto de uma regra: o main.css
 * entra DEPOIS de TokenLibraryPanel.css no app (main.tsx importa o App antes
 * dele), e regra de mesmo peso perde para a de baixo em silêncio. O teste lê as
 * duas folhas na ordem do app e decide, para um elemento de verdade do painel,
 * qual declaração vence: maior especificidade, e no empate a que vem depois. O
 * jsdom só responde se o seletor casa com o elemento (`matches`, que entende
 * `:has` e `:focus-within`). A cascata dele mesmo não serve de juiz: ele dá a
 * uma lista de seletores o peso do mais pesado e guarda quatro longhands como um
 * shorthand, e aí pesa `margin` e `margin-left` como coisas diferentes.
 *
 * `:hover`, `:active` e `:focus-visible` viram classe (`sim-*`), que pesa o
 * mesmo que pseudo-classe; o teste põe a classe onde o ponteiro estaria. Os
 * blocos @media ficam fora da cascata (é a tela de mesa, com mouse) e são
 * conferidos no texto, como o que não é do elemento (`::before`).
 */

let container: HTMLDivElement
let root: Root

/** Um CSS como está no disco, relativo a esta pasta (molde de `PropertiesPanel.botoes.test.ts`). */
async function lerCss(relativo: string): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativo), 'utf8')
}

const semComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** O CSS sem os blocos `@media ... { ... }` (chaves balanceadas). */
function semMedias(css: string): string {
  let saida = ''
  let i = 0
  while (i < css.length) {
    const inicio = css.indexOf('@media', i)
    if (inicio === -1) return saida + css.slice(i)
    saida += css.slice(i, inicio)
    let nivel = 0
    let j = css.indexOf('{', inicio)
    for (; j < css.length; j++) {
      if (css[j] === '{') nivel++
      else if (css[j] === '}' && --nivel === 0) break
    }
    i = j + 1
  }
  return saida
}

/** O miolo do bloco `@media <condicao> { ... }`, ou '' sem ele. */
function blocoMedia(css: string, condicao: string): string {
  const inicio = css.indexOf(`@media ${condicao}`)
  if (inicio === -1) return ''
  const abre = css.indexOf('{', inicio)
  let nivel = 0
  for (let j = abre; j < css.length; j++) {
    if (css[j] === '{') nivel++
    else if (css[j] === '}' && --nivel === 0) return css.slice(abre + 1, j)
  }
  return ''
}

/** Divide `texto` em `separador` fora de parênteses: "0 calc(-1 * 8px)" → ["0", "calc(-1 * 8px)"]. */
function dividirForaDeParenteses(texto: string, separador: RegExp): string[] {
  const partes: string[] = []
  let atual = ''
  let nivel = 0
  for (const letra of texto) {
    if (letra === '(') nivel++
    if (letra === ')') nivel--
    if (nivel === 0 && separador.test(letra)) {
      if (atual.trim()) partes.push(atual.trim())
      atual = ''
    } else {
      atual += letra
    }
  }
  if (atual.trim()) partes.push(atual.trim())
  return partes
}

/** O que `seletor` declara em `css`, somando as regras cuja LISTA o contém, na ordem da folha. */
function regraCom(css: string, seletor: string): Map<string, string> {
  const declarado = new Map<string, string>()
  for (const [, seletores, corpo] of semComentarios(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!dividirForaDeParenteses(seletores, /,/).includes(seletor)) continue
    for (const [propriedade, ...valor] of corpo.split(';').map((declaracao) => declaracao.split(':'))) {
      if (valor.length > 0) declarado.set(propriedade.trim(), valor.join(':').trim())
    }
  }
  return declarado
}

const LADOS = ['top', 'right', 'bottom', 'left'] as const
const ESTILOS_DE_BORDA = ['none', 'hidden', 'solid', 'dashed', 'dotted', 'double']

/** 1 a 4 valores → topo, direita, baixo, esquerda (a regra do CSS). */
function quatroLados(valor: string): string[] {
  const [topo, direita = topo, baixo = topo, esquerda = direita] = dividirForaDeParenteses(valor, /\s/)
  return [topo, direita, baixo, esquerda]
}

/** Um shorthand como o navegador o lê: os longhands que ele põe. Os outros passam como estão. */
function longhands(propriedade: string, valor: string): [string, string][] {
  if (propriedade === 'margin' || propriedade === 'padding') {
    const valores = quatroLados(valor)
    return LADOS.map((lado, i) => [`${propriedade}-${lado}`, valores[i]])
  }
  if (propriedade === 'border-width' || propriedade === 'border-style' || propriedade === 'border-color') {
    const valores = quatroLados(valor)
    const qual = propriedade.slice('border-'.length)
    return LADOS.map((lado, i) => [`border-${lado}-${qual}`, valores[i]])
  }
  const borda = /^border(?:-(top|right|bottom|left))?$/.exec(propriedade)
  if (borda) {
    const partes = dividirForaDeParenteses(valor, /\s/)
    const largura = partes.find((parte) => /^-?[\d.]+(px)?$/.test(parte) || ['thin', 'medium', 'thick'].includes(parte)) ?? 'medium'
    const estilo = partes.find((parte) => ESTILOS_DE_BORDA.includes(parte)) ?? 'none'
    const cor = partes.find((parte) => parte !== largura && parte !== estilo) ?? 'currentcolor'
    return (borda[1] ? [borda[1]] : LADOS).flatMap((lado): [string, string][] => [
      [`border-${lado}-width`, largura],
      [`border-${lado}-style`, estilo],
      [`border-${lado}-color`, cor],
    ])
  }
  if (propriedade === 'background') return [['background-color', valor === 'none' ? 'transparent' : valor]]
  return [[propriedade, valor]]
}

type Peso = [number, number, number]

const somar = (a: Peso, b: Peso): Peso => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const pesaMais = (a: Peso, b: Peso) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/** Onde termina o nome que começa em `i` (classe, pseudo, tipo). */
function fimDoNome(texto: string, i: number): number {
  let j = i
  while (j < texto.length && /[\w-]/.test(texto[j])) j++
  return j
}

/** O `)` que fecha o `(` em `abre`. */
function fechaParenteses(texto: string, abre: number): number {
  let nivel = 0
  for (let j = abre; j < texto.length; j++) {
    if (texto[j] === '(') nivel++
    else if (texto[j] === ')' && --nivel === 0) return j
  }
  return texto.length
}

/** Especificidade (a, b, c) de UM seletor, como a do CSS Selectors 4: `:has`/`:not`/`:is` pesam o argumento mais pesado, `:where` não pesa. */
function especificidade(seletor: string): Peso {
  let peso: Peso = [0, 0, 0]
  let i = 0
  while (i < seletor.length) {
    const letra = seletor[i]
    if (letra === '#') {
      peso = somar(peso, [1, 0, 0])
      i = fimDoNome(seletor, i + 1)
    } else if (letra === '.') {
      peso = somar(peso, [0, 1, 0])
      i = fimDoNome(seletor, i + 1)
    } else if (letra === '[') {
      peso = somar(peso, [0, 1, 0])
      i = seletor.indexOf(']', i) + 1
    } else if (letra === ':' && seletor[i + 1] === ':') {
      peso = somar(peso, [0, 0, 1])
      i = fimDoNome(seletor, i + 2)
    } else if (letra === ':') {
      const fim = fimDoNome(seletor, i + 1)
      const nome = seletor.slice(i + 1, fim)
      if (seletor[fim] === '(') {
        const fecha = fechaParenteses(seletor, fim)
        const argumentos = dividirForaDeParenteses(seletor.slice(fim + 1, fecha), /,/)
        if (nome === 'has' || nome === 'not' || nome === 'is') {
          peso = somar(peso, argumentos.map(especificidade).reduce((maior, p) => (pesaMais(p, maior) > 0 ? p : maior), [0, 0, 0]))
        } else if (nome !== 'where') {
          peso = somar(peso, [0, 1, 0])
        }
        i = fecha + 1
      } else {
        peso = somar(peso, [0, 1, 0])
        i = fim
      }
    } else if (/[a-zA-Z]/.test(letra)) {
      peso = somar(peso, [0, 0, 1])
      i = fimDoNome(seletor, i)
    } else {
      i++
    }
  }
  return peso
}

interface Declaracao {
  /** 0 = TokenLibraryPanel.css, 1 = main.css. */
  folha: number
  seletor: string
  peso: Peso
  ordem: number
  importante: boolean
  valor: string
}

/** Propriedade (longhand) → as declarações dela, das duas folhas, na ordem em que o app as carrega. */
const declaracoes = new Map<string, Declaracao[]>()

/** Lê as folhas para a cascata: um seletor por declaração, só longhands, @media de fora, estados de ponteiro como classe. */
function carregarFolhas(folhas: readonly string[]): void {
  declaracoes.clear()
  let ordem = 0
  for (const [indice, folha] of folhas.entries()) {
    for (const [, seletores, corpo] of semMedias(semComentarios(folha)).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const cabeca = seletores.trim()
      // At-rule sem bloco interno (@font-face) e quadro de @keyframes (from, to, 50%) não são de elemento.
      if (cabeca.startsWith('@') || /^(from|to|[\d.]+%)(\s*,\s*(from|to|[\d.]+%))*$/.test(cabeca)) continue
      const lista = dividirForaDeParenteses(cabeca, /,/).map((seletor) =>
        seletor.replace(/:hover\b/g, '.sim-pairar').replace(/:active\b/g, '.sim-apertar').replace(/:focus-visible\b/g, '.sim-foco'),
      )
      for (const declaracao of dividirForaDeParenteses(corpo, /;/)) {
        const [propriedade, ...resto] = declaracao.split(':')
        if (resto.length === 0) continue
        const bruto = resto.join(':').trim()
        const importante = bruto.endsWith('!important')
        const valor = importante ? bruto.slice(0, -'!important'.length).trim() : bruto
        ordem++
        for (const [longhand, v] of longhands(propriedade.trim(), valor)) {
          const daPropriedade = declaracoes.get(longhand) ?? []
          for (const seletor of lista) {
            daPropriedade.push({ folha: indice, seletor, peso: especificidade(seletor), ordem, importante, valor: v })
          }
          declaracoes.set(longhand, daPropriedade)
        }
      }
    }
  }
}

/** O seletor casa com o elemento? Pseudo-elemento (`::before`) não é do elemento. */
function casa(el: Element, seletor: string): boolean {
  if (seletor.includes('::')) return false
  try {
    return el.matches(seletor)
  } catch {
    return false
  }
}

/** `a` vence `b` na cascata: !important primeiro, depois especificidade, e no empate a que vem depois. */
function vence(a: Declaracao, b: Declaracao): boolean {
  if (a.importante !== b.importante) return a.importante
  const peso = pesaMais(a.peso, b.peso)
  return peso > 0 || (peso === 0 && a.ordem > b.ordem)
}

/** A declaração que vence a cascata para `propriedade` (longhand) em `el`; `undefined` se nenhuma regra a declara. */
function vencedora(el: Element, propriedade: string): Declaracao | undefined {
  let melhor: Declaracao | undefined
  for (const declaracao of declaracoes.get(propriedade) ?? []) {
    if (casa(el, declaracao.seletor) && (melhor === undefined || vence(declaracao, melhor))) melhor = declaracao
  }
  return melhor
}

const valor = (el: Element, propriedade: string) => vencedora(el, propriedade)?.valor

/** Liga um estado simulado (`sim-pairar`, `sim-apertar`) só durante a leitura. */
function com(classe: string, el: Element, ler: () => string | undefined): string | undefined {
  el.classList.add(classe)
  try {
    return ler()
  } finally {
    el.classList.remove(classe)
  }
}

let cssDoAcervo = ''

beforeAll(async () => {
  cssDoAcervo = await lerCss('./TokenLibraryPanel.css')
  // A ordem do app: a folha do componente primeiro, o main.css por cima.
  carregarFolhas([cssDoAcervo, await lerCss('../main.css')])
})

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  Reflect.deleteProperty(document, 'elementFromPoint')
})

function item(id: string, nome: string, pasta: string | null): ItemDoAcervoNaTela {
  return { id, nome, tamanho: 1, arquivo: `token_${id}.webp`, pasta, imagemNoDisco: false, caminho: `C:/acervo/token_${id}.webp` }
}

const PASTAS: PastaDoAcervo[] = [
  { id: 'npcs', nome: 'NPCs', recolhida: false },
  { id: 'veiculos', nome: 'Veículos', recolhida: false },
  { id: 'jogadores', nome: 'Jogadores', recolhida: false },
]

const GOBLIN = item('g', 'Goblin', null)
const CARROCA = item('c', 'Carroça', 'veiculos')

function montar(extra: Partial<TokenLibraryPanelProps> = {}) {
  const props: TokenLibraryPanelProps = {
    itens: [GOBLIN, CARROCA],
    pastas: PASTAS,
    aviso: null,
    podeOrganizar: true,
    onPlace: vi.fn(),
    onDropOnMap: vi.fn(() => false),
    onDelete: vi.fn(),
    onCriarPasta: vi.fn(),
    onMover: vi.fn(),
    onRecolherPasta: vi.fn(),
    onApagarPasta: vi.fn(),
    ...extra,
  }
  act(() => root.render(<TokenLibraryPanel {...props} />))
  return props
}

function botao(nome: string, dentro: ParentNode = container): HTMLButtonElement {
  const alvo = [...dentro.querySelectorAll<HTMLButtonElement>('button')].find(
    (el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === nome,
  )
  if (!alvo) throw new Error(`botão "${nome}" não está na tela`)
  return alvo
}

function pasta(nome: string): HTMLElement {
  const alvo = [...container.querySelectorAll<HTMLElement>('[data-acervo-pasta]')].find((el) => el.getAttribute('aria-label') === nome)
  if (!alvo) throw new Error(`pasta ${nome} não está na tela`)
  return alvo
}

/** A linha (li) do token `nome`. */
function linhaDe(nome: string): HTMLLIElement {
  const linha = botao(`Colocar ${nome} no mapa`).closest('li')
  if (!linha) throw new Error(`a linha de ${nome} não está na tela`)
  return linha
}

function cabecalhoDe(nome: string): HTMLElement {
  return pasta(nome).querySelector('.lb-acervo__pasta-topo') as HTMLElement
}

const icone = (svg: ReactElement) => renderToStaticMarkup(svg)

describe('Acervo em linhas — o que fica no DOM', () => {
  it('o Mover e o Apagar de cada token moram em .lb-acervo__acoes, com a seta de mover e o X de fechar (sem "×" em texto)', () => {
    montar()
    for (const nome of ['Goblin', 'Carroça']) {
      const acoes = linhaDe(nome).querySelector('.lb-acervo__acoes')
      expect(acoes, nome).not.toBeNull()
      const mover = botao(`Mover ${nome} para outra pasta`, acoes as Element)
      const apagar = botao(`Apagar ${nome} do acervo`, acoes as Element)
      expect(mover.innerHTML).toBe(icone(<MoveIntoIcon size={14} />))
      expect(apagar.innerHTML).toBe(icone(<CloseIcon size={14} />))
      expect(apagar.textContent).toBe('')
    }
  })

  it('no navegador (sem pastas) a linha só tem o Apagar dentro das ações', () => {
    montar({ itens: [GOBLIN], pastas: [], podeOrganizar: false })
    const acoes = linhaDe('Goblin').querySelector('.lb-acervo__acoes') as Element
    expect([...acoes.querySelectorAll('button')].map((el) => el.getAttribute('aria-label'))).toEqual(['Apagar Goblin do acervo'])
  })

  it('a pergunta de apagar e o menu Mover ficam FORA das ações: descem para a linha de baixo, sempre à vista', () => {
    montar()
    act(() => botao('Mover Goblin para outra pasta').click())
    const destinos = linhaDe('Goblin').querySelector('.lb-acervo__destinos') as HTMLElement
    expect(destinos.parentElement).toBe(linhaDe('Goblin'))
    expect(linhaDe('Goblin').classList.contains('lb-acervo__item--movendo')).toBe(true)

    act(() => botao('Apagar Carroça do acervo').click())
    const linha = linhaDe('Carroça')
    expect(linha.querySelector(':scope > .lb-acervo__confirma')).not.toBeNull()
    // Com a pergunta aberta, o Apagar sai (o foco foi para "Manter no acervo").
    expect(linha.querySelector('.lb-acervo__acoes')).toBeNull()
  })

  it('pasta vazia não alterna: sem seta, sem aria-expanded, mostra 0; continua alvo do soltar e com "Apagar a pasta"', () => {
    const props = montar()
    const npcs = pasta('NPCs')
    expect(npcs.getAttribute('data-acervo-pasta')).toBe('npcs')
    expect(npcs.querySelector('[aria-expanded]')).toBeNull()
    expect(npcs.querySelector('.lb-acervo__chevron')).toBeNull()
    expect(npcs.querySelector('.lb-acervo__contagem')?.textContent).toBe('0')
    const cabecalho = npcs.querySelector('.lb-acervo__pasta-botao') as HTMLElement
    expect(cabecalho.tagName).toBe('DIV')
    act(() => cabecalho.click())
    expect(props.onRecolherPasta).not.toHaveBeenCalled()
    // O leitor de tela ouve que ela está vazia; a seta não promete nada.
    expect(cabecalho.textContent).toContain('vazia')
    expect(botao('Apagar a pasta NPCs', npcs.querySelector('.lb-acervo__acoes') as Element).innerHTML).toBe(icone(<CloseIcon size={14} />))

    // A pasta com token continua um botão de recolher que diz quantos tem.
    const veiculos = botao('Veículos (1)')
    expect(veiculos.getAttribute('aria-expanded')).toBe('true')
    expect(veiculos.querySelector('.lb-acervo__chevron')).not.toBeNull()
  })

  it('a contagem da pasta fica na ponta da linha, depois das ações: fora do botão de recolher', () => {
    montar()
    const filhos = [...cabecalhoDe('Veículos').children]
    expect(filhos.map((el) => el.className)).toEqual(['lb-acervo__pasta-botao', 'lb-acervo__acoes', 'lb-acervo__contagem'])
    expect(filhos[2].getAttribute('aria-hidden')).toBe('true')
    expect(filhos[2].textContent).toBe('1')
    expect(botao('Veículos (1)').querySelector('.lb-acervo__contagem')).toBeNull()
  })

  it('"Sem pasta" diz, discreto, quantos tokens estão soltos', () => {
    montar()
    const titulo = pasta('Sem pasta').querySelector('.lb-acervo__pasta-titulo') as HTMLElement
    const contagem = titulo.querySelector('.lb-acervo__contagem')
    expect(contagem?.textContent).toBe('1')
    expect(contagem?.getAttribute('aria-hidden')).toBe('true')
  })

  it('arrastando, a seção se marca com lb-acervo--arrastando; ao soltar, desmarca', () => {
    montar()
    const secao = container.querySelector('.lb-acervo-painel') as HTMLElement
    Reflect.set(document, 'elementFromPoint', () => document.body)
    const ponteiro = (tipo: string, alvo: EventTarget, x: number, y: number) => {
      const evento = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
      Object.defineProperty(evento, 'pointerId', { value: 1 })
      Object.defineProperty(evento, 'isPrimary', { value: true })
      act(() => {
        alvo.dispatchEvent(evento)
      })
    }
    ponteiro('pointerdown', botao('Colocar Goblin no mapa'), 10, 10)
    ponteiro('pointermove', window, 60, 60)
    expect(secao.classList.contains('lb-acervo--arrastando')).toBe(true)
    ponteiro('pointerup', window, 60, 60)
    expect(secao.classList.contains('lb-acervo--arrastando')).toBe(false)
  })
})

describe('Acervo em linhas — a cascata (TokenLibraryPanel.css antes, main.css por cima)', () => {
  it('a linha não é mais cartão: sem borda nem fundo, solta ou dentro da pasta; 4 px em cima e 8 px dos lados', () => {
    montar()
    for (const nome of ['Goblin', 'Carroça']) {
      const linha = linhaDe(nome)
      expect(valor(linha, 'background-color'), nome).toBe('transparent')
      expect(valor(linha, 'border-top-width'), nome).toBe('0')
      expect(valor(linha, 'border-left-width'), nome).toBe('0')
      expect(valor(linha, 'padding-top'), nome).toBe('var(--lb-space-1)')
      expect(valor(linha, 'padding-left'), nome).toBe('var(--lb-space-2)')
      expect(valor(linha, 'padding-right'), nome).toBe('var(--lb-space-2)')
    }
  })

  it('dentro da pasta quem decide a linha é esta folha, e não o `.lb-acervo--na-pasta .lb-acervo__item` (0,2,0) de main.css', () => {
    // Hoje os valores de lá coincidem com os daqui (4 e 8 px): conferir só o
    // valor não pegaria o empate que devolveria o respiro antigo no dia em que
    // um dos dois mudar. Confere-se QUEM vence.
    montar()
    const linha = linhaDe('Carroça')
    for (const propriedade of ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'background-color', 'border-left-width']) {
      expect(vencedora(linha, propriedade)?.folha, propriedade).toBe(0)
    }
  })

  it('pairar acende a linha em pedra; apertar o nome afunda; o latão do cartão antigo não volta', () => {
    montar()
    const linha = linhaDe('Carroça')
    expect(com('sim-pairar', linha, () => valor(linha, 'background-color'))).toBe('var(--lb-color-stone-hover)')
    const nome = botao('Colocar Carroça no mapa')
    expect(com('sim-apertar', nome, () => valor(linha, 'background-color'))).toBe('var(--lb-color-stone-sunken)')
    expect(com('sim-pairar', nome, () => valor(nome, 'color'))).toBe('var(--lb-color-parchment)')
  })

  it('com o menu Mover ou a pergunta de apagar aberta, a linha vira uma faixa só, e pairar não a apaga', () => {
    montar()
    act(() => botao('Mover Goblin para outra pasta').click())
    const goblin = linhaDe('Goblin')
    expect(valor(goblin, 'background-color')).toBe('var(--lb-color-stone-raised)')
    expect(com('sim-pairar', goblin, () => valor(goblin, 'background-color'))).toBe('var(--lb-color-stone-raised)')
    act(() => botao('Apagar Carroça do acervo').click())
    expect(valor(linhaDe('Carroça'), 'background-color')).toBe('var(--lb-color-stone-raised)')
  })

  it('foto de 24 px', () => {
    montar()
    const foto = linhaDe('Goblin').querySelector('.lb-acervo__foto') as HTMLElement
    expect(valor(foto, 'width')).toBe('var(--lb-space-6)')
    expect(valor(foto, 'height')).toBe('var(--lb-space-6)')
  })

  it('o nome se arrasta: cursor de mão aberta, fechada no aperto', () => {
    montar()
    const nome = botao('Colocar Goblin no mapa')
    expect(valor(nome, 'cursor')).toBe('grab')
    expect(com('sim-apertar', nome, () => valor(nome, 'cursor'))).toBe('grabbing')
  })

  it('as ações ficam apagadas em repouso e acendem com o ponteiro na linha, com o foco nela e com o menu Mover aberto', () => {
    montar()
    const linha = linhaDe('Goblin')
    const acoes = () => linha.querySelector('.lb-acervo__acoes') as HTMLElement
    expect(valor(acoes(), 'opacity')).toBe('0')
    expect(com('sim-pairar', linha, () => valor(acoes(), 'opacity'))).toBe('1')

    // O jsdom guarda o resultado de `matches` até o DOM mudar, e mudar o foco
    // não muda o DOM: depois de focar ou desfocar, a leitura passa por uma
    // classe de mentira (`sim-recalcular`) para o `:focus-within` valer de novo.
    act(() => botao('Colocar Goblin no mapa').focus())
    expect(com('sim-recalcular', linha, () => valor(acoes(), 'opacity'))).toBe('1')
    act(() => botao('Colocar Goblin no mapa').blur())
    expect(com('sim-recalcular', linha, () => valor(acoes(), 'opacity'))).toBe('0')

    act(() => botao('Mover Goblin para outra pasta').click())
    act(() => botao('Mover Goblin para outra pasta').blur())
    expect(com('sim-recalcular', linha, () => valor(acoes(), 'opacity'))).toBe('1')
  })

  it('o × da pasta acende com o ponteiro no cabeçalho dela', () => {
    montar()
    const topo = cabecalhoDe('Veículos')
    const acoes = topo.querySelector('.lb-acervo__acoes') as HTMLElement
    expect(valor(acoes, 'opacity')).toBe('0')
    expect(com('sim-pairar', topo, () => valor(acoes, 'opacity'))).toBe('1')
  })

  it('arrastando, nada acende sob o ponteiro de passagem: nem o fundo da linha nem as ações', () => {
    montar()
    const secao = container.querySelector('.lb-acervo-painel') as HTMLElement
    const linha = linhaDe('Carroça')
    const acoes = linha.querySelector('.lb-acervo__acoes') as HTMLElement
    const topo = cabecalhoDe('Veículos')
    secao.classList.add('lb-acervo--arrastando')
    try {
      expect(com('sim-pairar', linha, () => valor(acoes, 'opacity'))).toBe('0')
      expect(com('sim-pairar', linha, () => valor(linha, 'background-color'))).toBe('transparent')
      expect(com('sim-pairar', topo, () => valor(topo, 'background-color'))).toBe('transparent')
    } finally {
      secao.classList.remove('lb-acervo--arrastando')
    }
  })

  it('os botões de ação: 24 px; Mover aberto fica em latão; o Apagar sob o ponteiro fica em brasa', () => {
    montar()
    act(() => botao('Mover Goblin para outra pasta').click())
    const mover = botao('Mover Goblin para outra pasta')
    expect(valor(mover, 'width')).toBe('var(--lb-space-6)')
    expect(valor(mover, 'height')).toBe('var(--lb-space-6)')
    expect(valor(mover, 'color')).toBe('var(--lb-color-brass)')
    const apagar = botao('Apagar Carroça do acervo')
    expect(valor(apagar, 'color')).toBe('var(--lb-color-parchment-dim)')
    expect(com('sim-pairar', apagar, () => valor(apagar, 'color'))).toBe('var(--lb-color-ember)')
  })

  it('pasta sem faixa: o cabeçalho é transparente e acende só sob o ponteiro; nome em peso médio, sem virar latão', () => {
    montar()
    const topo = cabecalhoDe('Veículos')
    expect(valor(topo, 'background-color')).toBe('transparent')
    expect(com('sim-pairar', topo, () => valor(topo, 'background-color'))).toBe('var(--lb-color-stone-hover)')
    const cabecalho = botao('Veículos (1)')
    expect(valor(cabecalho, 'font-weight')).toBe('var(--lb-font-weight-medium)')
    expect(com('sim-pairar', cabecalho, () => valor(cabecalho, 'color'))).toBe('var(--lb-color-parchment)')
    const seta = cabecalho.querySelector('.lb-acervo__chevron') as HTMLElement
    expect(com('sim-pairar', cabecalho, () => valor(seta, 'color'))).toBe('var(--lb-color-parchment-dim)')
  })

  it('nome de pasta comprido corta com reticências, e nem a seta nem o ícone da pasta encolhem', () => {
    montar({ pastas: [{ id: 'longa', nome: 'Inimigos recorrentes da campanha principal', recolhida: false }], itens: [{ ...CARROCA, pasta: 'longa' }] })
    const cabecalho = pasta('Inimigos recorrentes da campanha principal').querySelector('.lb-acervo__pasta-botao') as HTMLElement
    expect(valor(cabecalho.querySelector(':scope > svg') as Element, 'flex')).toBe('none')
    expect(valor(cabecalho.querySelector('.lb-acervo__chevron') as Element, 'flex')).toBe('none')
    expect(valor(cabecalho.querySelector('.lb-acervo__pasta-nome') as Element, 'text-overflow')).toBe('ellipsis')
  })

  it('o fio da pasta: 1 px na cor de linha, descendo do centro da seta; a foto de dentro alinha com o ícone da pasta', () => {
    montar()
    const lista = pasta('Veículos').querySelector('.lb-acervo--na-pasta') as HTMLElement
    expect(valor(lista, 'border-left-width')).toBe('1px')
    expect(valor(lista, 'border-left-style')).toBe('solid')
    expect(valor(lista, 'border-left-color')).toBe('var(--lb-color-line)')
    // A pasta começa 8 px antes do texto da seção (x=-8). Com os 8 px de
    // respiro da linha, a caixa de 16 px da seta vai de x=0 a x=16 (centro em
    // x=8), e o ícone da pasta começa em x=24 (16 + 8 de vão). A lista de
    // dentro começa onde a pasta começa: com a margem de 16, o fio cai em x=8,
    // no centro da seta; com o 1 px do fio, os 7 px depois dele e os 8 px da
    // linha do token, a foto começa em x=24, embaixo do ícone da pasta.
    expect(valor(lista, 'margin-left')).toBe('var(--lb-space-4)')
    expect(valor(lista, 'padding-left')).toBe('calc(var(--lb-space-2) - 1px)')
    const seta = cabecalhoDe('Veículos').querySelector('.lb-acervo__chevron') as HTMLElement
    expect(valor(seta, 'width')).toBe('var(--lb-space-4)')
    expect(valor(cabecalhoDe('Veículos'), 'padding-left')).toBe('var(--lb-space-2)')
    expect(valor(pasta('Veículos').parentElement as HTMLElement, 'margin-left')).toBe('calc(-1 * var(--lb-space-2))')
  })

  it('o realce da pasta sob o token arrastado continua (fundo de latão), sem moldura que empurre a lista', () => {
    montar()
    const veiculos = pasta('Veículos')
    expect(valor(veiculos, 'border-top-width')).toBe('0')
    expect(valor(veiculos, 'padding-top')).toBe('0')
    veiculos.setAttribute('data-alvo', 'dentro')
    expect(valor(veiculos, 'background-color')).toBe('var(--lb-color-brass-soft)')
  })

  it('"Sem pasta" é rótulo apagado, na vertical das setas', () => {
    montar()
    const titulo = pasta('Sem pasta').querySelector('.lb-acervo__pasta-titulo') as HTMLElement
    expect(valor(titulo, 'color')).toBe('var(--lb-color-parchment-faint)')
    expect(valor(titulo, 'padding-left')).toBe('var(--lb-space-2)')
  })
})

describe('Acervo em linhas — o que não é do elemento, conferido na regra', () => {
  it('as ações não têm transição: pairar é gesto de toda hora', () => {
    const acoes = regraCom(semMedias(cssDoAcervo), '.lb-acervo-painel .lb-acervo__acoes')
    expect(acoes.get('opacity')).toBe('0')
    expect(acoes.has('transition')).toBe(false)
  })

  it('tela sem pairar (toque): as ações ficam sempre à vista', () => {
    expect(regraCom(blocoMedia(cssDoAcervo, '(hover: none)'), '.lb-acervo-painel .lb-acervo__acoes').get('opacity')).toBe('1')
  })

  it('o anel de foco do nome, dos botões e do cabeçalho da pasta fica DENTRO da linha, como nas linhas da coluna', () => {
    const css = semMedias(cssDoAcervo)
    const anel = 'inset 0 0 0 2px var(--lb-color-brass)'
    expect(regraCom(css, '.lb-acervo-painel .lb-acervo__item:has(> .lb-acervo__nome:focus-visible)').get('box-shadow')).toBe(anel)
    expect(regraCom(css, '.lb-acervo-painel .lb-acervo__pasta-topo:has(> .lb-acervo__pasta-botao:focus-visible)').get('box-shadow')).toBe(anel)
    expect(regraCom(css, '.lb-acervo-painel .lb-acervo__acoes > button:focus-visible').get('box-shadow')).toBe(anel)
  })

  it('a linha inteira pega o token: o alvo do nome cobre os 32 px de cima da linha (foto incluída)', () => {
    const css = semMedias(cssDoAcervo)
    expect(regraCom(css, '.lb-acervo-painel .lb-acervo__item').get('position')).toBe('relative')
    const alvo = regraCom(css, '.lb-acervo-painel .lb-acervo__nome::before')
    expect(alvo.get('position')).toBe('absolute')
    expect(alvo.get('height')).toBe('var(--lb-space-8)')
  })

  it('o botão de recolher alcança o cabeçalho inteiro, atrás do conteúdo; a contagem deixa o ponteiro passar', () => {
    const css = semMedias(cssDoAcervo)
    const alvo = regraCom(css, '.lb-acervo-painel .lb-acervo__pasta-botao:not([data-vazia])::before')
    expect(alvo.get('inset')).toBe('0')
    expect(alvo.get('z-index')).toBe('-1')
    expect(regraCom(css, '.lb-acervo-painel .lb-acervo__pasta-topo').get('isolation')).toBe('isolate')
    expect(regraCom(css, '.lb-acervo-painel .lb-acervo__contagem').get('pointer-events')).toBe('none')
  })

  it('o realce da pasta sob o token arrastado é um contorno de dentro, de latão', () => {
    expect(regraCom(semMedias(cssDoAcervo), ".lb-acervo-painel .lb-acervo__pasta[data-alvo='dentro']").get('box-shadow')).toBe(
      'inset 0 0 0 1px var(--lb-color-brass)',
    )
  })

  it('a seta que gira respeita "reduzir movimento"', () => {
    expect(regraCom(blocoMedia(cssDoAcervo, '(prefers-reduced-motion: reduce)'), '.lb-acervo-painel .lb-acervo__chevron').get('transition')).toBe('none')
  })

  it('a especificidade da cascata do teste é a do CSS: lista não soma, :has pesa o argumento', () => {
    expect(especificidade('.lb-acervo-painel .lb-acervo--na-pasta .lb-acervo__item')).toEqual([0, 3, 0])
    expect(especificidade(".lb-acervo__pasta[data-alvo='dentro']")).toEqual([0, 2, 0])
    expect(especificidade('.lb-acervo-painel .lb-acervo__item:has(> .lb-acervo__nome:active)')).toEqual([0, 4, 0])
    expect(especificidade('.lb-acervo-painel .lb-acervo__acoes > button:hover')).toEqual([0, 3, 1])
    expect(especificidade('*::before')).toEqual([0, 0, 1])
  })
})
