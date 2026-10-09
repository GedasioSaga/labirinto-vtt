import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import { inventoryCharacters } from './inventario'
import { PlayerInventory } from './PlayerInventory'
import { PlayerMarkForm } from './PlayerMarkForm'

/**
 * O PAIRAR DOS BOTÕES DO JOGADOR (`.pp-button` do player.css). Três leituras
 * dividem as mesmas regras:
 * - o botão comum acende em latão translúcido;
 * - o interruptor ligado (Bilhete e Seta de giz; Medir e Laser usam as mesmas
 *   classes) clareia o latão cheio e mantém o texto em pedra escura. Com o
 *   latão translúcido do botão comum por trás do texto escuro, o nome sumia;
 * - o indisponível que continua focável (`aria-disabled`, o Diego do "Pagar"
 *   com um valor que não vale) não acende.
 * Quem decide é a especificidade: a regra do interruptor ganha da do botão
 * comum só por vir depois, e um `:not()` a mais na do comum vira o jogo. O
 * jsdom não tem `:hover` nem cascata por especificidade, então o teste faz a
 * cascata com as regras do player.css que casam com o botão da tela de
 * verdade: `!important` primeiro, depois a mais específica, depois a que vem
 * depois no arquivo.
 */

/**
 * O player.css como está no disco. `import './player.css?raw'` não serve: o
 * Vitest troca todo `.css` importado por string vazia (mesmo motivo do
 * `cantoDoZoom.test.ts`).
 */
async function lerPlayerCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'player.css'), 'utf8')
}

type Peso = readonly [number, number, number]

interface Declaracao {
  propriedade: string
  valor: string
  importante: boolean
}

interface Regra {
  seletores: string[]
  declaracoes: Declaracao[]
  /** As condições dos `@media` em volta da regra (vazio: vale sempre). */
  midia: string[]
  /** O lugar da regra no arquivo: no empate de especificidade, a de depois vence. */
  ordem: number
}

/** O índice logo depois do `)` ou `]` que fecha o grupo aberto em `texto[inicio]`. */
function fimDoGrupo(texto: string, inicio: number): number {
  let fundo = 0
  let aspas: string | null = null
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]
    if (aspas !== null) {
      if (c === aspas) aspas = null
    } else if (c === '"' || c === "'") aspas = c
    else if (c === '(' || c === '[') fundo++
    else if (c === ')' || c === ']') {
      fundo--
      if (fundo === 0) return i + 1
    }
  }
  throw new Error(`grupo sem fechamento em "${texto}"`)
}

/** Parte `texto` em `separador` só no nível de cima: fora de parênteses, colchetes e aspas. */
function partir(texto: string, separador: string): string[] {
  const partes: string[] = []
  let fundo = 0
  let aspas: string | null = null
  let inicio = 0
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas !== null) {
      if (c === aspas) aspas = null
    } else if (c === '"' || c === "'") aspas = c
    else if (c === '(' || c === '[') fundo++
    else if (c === ')' || c === ']') fundo--
    else if (c === separador && fundo === 0) {
      partes.push(texto.slice(inicio, i))
      inicio = i + 1
    }
  }
  partes.push(texto.slice(inicio))
  return partes.map((parte) => parte.trim()).filter((parte) => parte !== '')
}

function fimDoNome(texto: string, inicio: number): number {
  let i = inicio
  while (i < texto.length && /[\w-]/.test(texto[i])) i++
  return i
}

function somar(a: Peso, b: Peso): Peso {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/** Comparação em ordem: o primeiro número diferente decide. */
function comparar(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

/** Pseudo-classes que valem o argumento mais forte da lista, e não a soma (Selectors 4). */
const VALEM_O_MAIS_FORTE = new Set(['not', 'is', 'has'])

/**
 * A especificidade de um seletor pelo Selectors 4: id (1,0,0); classe,
 * atributo e pseudo-classe (0,1,0); tipo e pseudo-elemento (0,0,1).
 * `:not()`, `:is()` e `:has()` valem o argumento mais forte; `:where()` vale zero.
 */
function especificidade(seletor: string): Peso {
  let peso: Peso = [0, 0, 0]
  let i = 0
  while (i < seletor.length) {
    const c = seletor[i]
    if (c === '#' || c === '.') {
      peso = somar(peso, c === '#' ? [1, 0, 0] : [0, 1, 0])
      i = fimDoNome(seletor, i + 1)
    } else if (c === '[') {
      peso = somar(peso, [0, 1, 0])
      i = fimDoGrupo(seletor, i)
    } else if (c === ':') {
      const pseudoElemento = seletor[i + 1] === ':'
      const inicioDoNome = pseudoElemento ? i + 2 : i + 1
      const fimDoNomeAqui = fimDoNome(seletor, inicioDoNome)
      const nome = seletor.slice(inicioDoNome, fimDoNomeAqui)
      const fim = seletor[fimDoNomeAqui] === '(' ? fimDoGrupo(seletor, fimDoNomeAqui) : fimDoNomeAqui
      if (pseudoElemento) peso = somar(peso, [0, 0, 1])
      else if (VALEM_O_MAIS_FORTE.has(nome)) {
        const lista = partir(seletor.slice(fimDoNomeAqui + 1, fim - 1), ',').map(especificidade)
        peso = somar(peso, lista.reduce((forte, outro) => (comparar(forte, outro) >= 0 ? forte : outro)))
      } else if (nome !== 'where') peso = somar(peso, [0, 1, 0])
      i = fim
    } else if (/[a-z]/i.test(c)) {
      peso = somar(peso, [0, 0, 1])
      i = fimDoNome(seletor, i)
    } else i++
  }
  return peso
}

function lerDeclaracoes(corpo: string): Declaracao[] {
  return partir(corpo, ';').flatMap((linha) => {
    const doisPontos = linha.indexOf(':')
    if (doisPontos < 0) return []
    const valor = linha.slice(doisPontos + 1).trim()
    const importante = /!\s*important$/i.test(valor)
    return [{ propriedade: linha.slice(0, doisPontos).trim().toLowerCase(), valor: valor.replace(/\s*!\s*important$/i, ''), importante }]
  })
}

/** As regras de estilo do player.css na ordem do arquivo, com os `@media` em volta; o miolo de `@keyframes` fica de fora. */
function lerRegras(css: string): Regra[] {
  const texto = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const regras: Regra[] = []
  let i = 0
  // `midia` null: dentro de um `@keyframes`, onde nada é regra de estilo.
  function lerBloco(midia: string[] | null): void {
    let inicio = i
    while (i < texto.length) {
      const c = texto[i]
      if (c === '}') {
        i++
        return
      }
      if (c === ';') inicio = i + 1
      if (c !== '{') {
        i++
        continue
      }
      const cabeca = texto.slice(inicio, i).trim()
      i++
      if (cabeca.startsWith('@media')) lerBloco(midia === null ? null : [...midia, cabeca.slice('@media'.length).trim()])
      else if (cabeca.startsWith('@')) lerBloco(null)
      else {
        const fim = texto.indexOf('}', i)
        if (midia !== null) regras.push({ seletores: partir(cabeca, ','), declaracoes: lerDeclaracoes(texto.slice(i, fim)), midia, ordem: regras.length })
        i = fim + 1
      }
      inicio = i
    }
  }
  lerBloco([])
  return regras
}

/** A tela do teste: mesa com mouse (o ponteiro paira), janela de 1280 px, movimento normal. */
const LARGURA_DA_JANELA = 1280

function midiaVale(condicao: string): boolean {
  if (condicao === '(hover: hover)') return true
  if (condicao === '(hover: none)') return false
  if (condicao === '(prefers-reduced-motion: reduce)') return false
  const larguraMaxima = /^\(max-width:\s*(\d+)px\)$/.exec(condicao)
  if (larguraMaxima !== null) return LARGURA_DA_JANELA <= Number(larguraMaxima[1])
  throw new Error(`o teste não sabe responder a "@media ${condicao}" (a regra casa com o botão)`)
}

/** No jsdom nada fica em `:hover`: o teste troca o `:hover` do seletor por este atributo. */
const PAIRANDO = 'data-pairando'

function casa(elemento: Element, seletor: string): boolean {
  // O seletor de pseudo-elemento pinta o `::before`/`::after`, não o botão.
  if (seletor.includes('::')) return false
  return elemento.matches(seletor.replace(/:hover(?![\w-])/g, `[${PAIRANDO}]`))
}

/**
 * O valor que vence para `propriedade` no elemento. `background` conta como
 * `background-color` (o atalho escreve a cor). `pairando`: o elemento e os
 * ancestrais em `:hover`, como no navegador.
 */
function vencedor(elemento: Element, propriedade: 'background-color' | 'color', regras: Regra[], pairando: boolean): string | undefined {
  const nomes = propriedade === 'background-color' ? ['background', 'background-color'] : [propriedade]
  const pairados: Element[] = []
  for (let no: Element | null = pairando ? elemento : null; no !== null; no = no.parentElement) {
    no.setAttribute(PAIRANDO, '')
    pairados.push(no)
  }
  try {
    let melhor: { valor: string; chave: number[] } | undefined
    for (const regra of regras) {
      const pesos = regra.seletores.filter((seletor) => casa(elemento, seletor)).map(especificidade)
      if (pesos.length === 0) continue
      const peso = pesos.reduce((forte, outro) => (comparar(forte, outro) >= 0 ? forte : outro))
      for (const [lugar, declaracao] of regra.declaracoes.entries()) {
        if (!nomes.includes(declaracao.propriedade) || !regra.midia.every(midiaVale)) continue
        const chave = [declaracao.importante ? 1 : 0, ...peso, regra.ordem, lugar]
        if (melhor === undefined || comparar(chave, melhor.chave) > 0) melhor = { valor: declaracao.valor, chave }
      }
    }
    return melhor?.valor
  } finally {
    for (const no of pairados) no.removeAttribute(PAIRANDO)
  }
}

const LATAO = 'var(--lb-color-brass, #e0a44a)'
const LATAO_CLARO = 'var(--lb-color-brass-bright, #f3ba66)'
const LATAO_TRANSLUCIDO = 'var(--lb-color-brass-soft, rgba(224, 164, 74, 0.14))'
const PEDRA = 'var(--lb-color-stone, #131317)'
const PEDRA_DO_BOTAO = 'var(--lb-color-stone-raised, #232328)'
const TEXTO_APAGADO = 'var(--lb-color-parchment-faint, #6d6c68)'

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

describe('o pairar dos botões do jogador (.pp-button no player.css)', () => {
  let container: HTMLDivElement
  let root: Root
  let regras: Regra[]

  beforeEach(async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    regras = lerRegras(await lerPlayerCss())
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === texto)
    if (achado === undefined) throw new Error(`sem o botão "${texto}"`)
    return achado
  }

  /** Fundo e texto que vencem no botão, parado ou com o mouse em cima. */
  function pele(elemento: Element, pairando: boolean): { fundo: string | undefined; texto: string | undefined } {
    return { fundo: vencedor(elemento, 'background-color', regras, pairando), texto: vencedor(elemento, 'color', regras, pairando) }
  }

  it('a conta de especificidade é a do Selectors 4', () => {
    expect(especificidade('.pp-button:hover:not(:disabled)')).toEqual([0, 3, 0])
    expect(especificidade(".pp-button:hover:not(:disabled):not([aria-disabled='true'])")).toEqual([0, 4, 0])
    expect(especificidade(".pp-button:hover:not(:disabled, [aria-disabled='true'])")).toEqual([0, 3, 0])
    expect(especificidade(".pp-button--toggle[aria-pressed='true']:hover")).toEqual([0, 3, 0])
    expect(especificidade(':is(#a, .b) > p::before')).toEqual([1, 0, 2])
    expect(especificidade(':where(#a, .b) .c')).toEqual([0, 1, 0])
  })

  it('o interruptor ligado ("Bilhete") em hover clareia o latão cheio e mantém o texto em pedra escura; o desligado ("Seta de giz") acende como o botão comum', () => {
    act(() => root.render(<PlayerMarkForm result={undefined} onPlace={() => {}} onClose={() => {}} onDismiss={() => {}} />))
    const ligado = botao('Bilhete')
    const desligado = botao('Seta de giz')
    expect(ligado.getAttribute('aria-pressed')).toBe('true')
    expect(desligado.getAttribute('aria-pressed')).toBe('false')

    expect(pele(ligado, false)).toEqual({ fundo: LATAO, texto: PEDRA })
    expect(pele(ligado, true)).toEqual({ fundo: LATAO_CLARO, texto: PEDRA })
    expect(pele(desligado, true).fundo).toBe(LATAO_TRANSLUCIDO)
  })

  it('o destinatário do "Pagar" acende em hover com um valor que vale e fica apagado com um que não vale (aria-disabled)', () => {
    const personagens = inventoryCharacters(
      { ...createEmptyMap('m1', '', 12, 6, 50), tokens: [ficha('jill', 'Jill', 100, { moedas: 15 }), ficha('diego', 'Diego', 150)] },
      ['jill'],
      ['diego'],
      '#4ea1ff',
    )
    act(() => root.render(<PlayerInventory characters={personagens} onGive={() => true} onPay={() => true} onClose={() => {}} instant />))
    act(() => botao('Pagar a…').click())
    const campo = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="number"]')
    if (campo === null) throw new Error('sem o campo de moedas')
    const digita = (valor: string): void =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, valor)
        campo.dispatchEvent(new Event('input', { bubbles: true }))
      })

    digita('5')
    const valendo = botao('Diego')
    expect(valendo.hasAttribute('aria-disabled')).toBe(false)
    expect(pele(valendo, true).fundo).toBe(LATAO_TRANSLUCIDO)

    digita('99')
    const apagado = botao('Diego')
    expect(apagado.getAttribute('aria-disabled')).toBe('true')
    expect(pele(apagado, false)).toEqual({ fundo: PEDRA_DO_BOTAO, texto: TEXTO_APAGADO })
    expect(pele(apagado, true)).toEqual(pele(apagado, false))
  })
})
