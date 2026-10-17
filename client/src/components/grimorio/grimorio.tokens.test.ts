import { describe, expect, it } from 'vitest'
import { lerCss } from '../../player/cssDoJogador.testkit'
import { theme, themeCss } from '../../theme'
import { GIRAR_DURACAO_MS, GIRAR_FECHAR_DURACAO_MS } from '../../portas/animacoesDePorta'

/*
 * Fidelidade ao protótipo aprovado e higiene do CSS novo. O protótipo é a
 * fonte da verdade visual (docs/design/consolidado/PLANO.md): os materiais e o
 * movimento dele (`--gr-*`) têm de chegar ao app com o mesmo valor, como
 * `--lb-gr-*`. E o grimorio.css não pode pintar nada fora dos componentes
 * dele, senão "nada visível muda" deixa de valer.
 */

const lerPrototipo = () => lerCss('../../../docs/design/consolidado/prototipo/css/grimorio.css')
const lerGrimorio = () => lerCss('../components/grimorio/grimorio.css')
const semComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** O primeiro `:root { ... }` do protótipo, onde moram os tokens. */
async function raizDoPrototipo(): Promise<string> {
  const css = semComentarios(await lerPrototipo())
  const inicio = css.indexOf(':root')
  return css.slice(inicio, css.indexOf('}', inicio))
}

/** Separa uma lista de seletores pelas vírgulas de fora dos parênteses (`:where(a, b)` fica inteiro). */
function dividirSeletores(lista: string): string[] {
  const partes: string[] = []
  let profundidade = 0
  let atual = ''
  for (const letra of lista) {
    if (letra === '(') profundidade++
    if (letra === ')') profundidade--
    if (letra === ',' && profundidade === 0) {
      partes.push(atual.trim())
      atual = ''
    } else atual += letra
  }
  return [...partes, atual.trim()]
}

function declaracoes(bloco: string, prefixo: string): [string, string][] {
  const achadas: [string, string][] = []
  const regra = new RegExp(`(${prefixo}[a-z0-9-]+):\\s*([^;]+);`, 'g')
  for (const [, nome, valor] of bloco.matchAll(regra)) achadas.push([nome, valor.trim()])
  return achadas
}

describe('tokens do Grimório', () => {
  it('cada --gr-* do protótipo existe no theme como --lb-gr-*, com o mesmo valor', async () => {
    const tokens = declaracoes(await raizDoPrototipo(), '--gr-')
    // 4 de movimento, 21 materiais e as 2 larguras do livro
    expect(tokens).toHaveLength(27)
    const css = themeCss()
    for (const [nome, valor] of tokens) expect(css).toContain(`--lb-${nome.slice(2)}: ${valor};`)
  })

  it('as cores, espaços, raios, sombras e tempos do app são os do protótipo (sem troca de valor)', async () => {
    // fontes ficam de fora: o app tem mais famílias de reserva na mesma ordem
    const tokens = declaracoes(await raizDoPrototipo(), '--lb-').filter(([nome]) => !nome.startsWith('--lb-font-'))
    expect(tokens.length).toBeGreaterThan(20)
    const css = themeCss()
    for (const [nome, valor] of tokens) expect(css).toContain(`${nome}: ${valor};`)
  })
})

describe('grimorio.css', () => {
  it('só usa variáveis que o theme declara (fora a origem do pop, posta pelo JS)', async () => {
    const usadas = new Set(Array.from((await lerGrimorio()).matchAll(/var\((--[a-z0-9-]+)/g), (m) => m[1]))
    const declaradas = themeCss()
    const soltas = [...usadas].filter((nome) => nome !== '--gr-origem' && !declaradas.includes(`${nome}:`))
    expect(soltas).toEqual([])
  })

  it('toda regra mira uma classe gr- e toda animação se chama gr-', async () => {
    const css = semComentarios(await lerGrimorio())
    const seletores = Array.from(css.matchAll(/([^{};]+)\{/g), (m) => m[1].trim())
      .filter((seletor) => !seletor.startsWith('@') && !/^(from|to|\d+%)$/.test(seletor))
      .flatMap(dividirSeletores)
    expect(seletores.length).toBeGreaterThan(100)
    expect(seletores.filter((seletor) => !seletor.includes('gr-'))).toEqual([])
    const classes = Array.from(css.matchAll(/\.([a-zA-Z][\w-]*)/g), (m) => m[1])
    expect(classes.filter((nome) => !nome.startsWith('gr-'))).toEqual([])
    const animacoes = Array.from(css.matchAll(/@keyframes\s+([\w-]+)/g), (m) => m[1])
    expect(animacoes.filter((nome) => !nome.startsWith('gr-'))).toEqual([])
  })
})

describe('folha da porta (fatia 11)', () => {
  it('o tempo e a curva de abrir são os do protótipo, e o giro do mapa usa os mesmos números', async () => {
    const prototipo = semComentarios(await lerCss('../../../docs/design/consolidado/prototipo/css/consolidado.css'))
    const doPrototipo = new Map(declaracoes(prototipo, '--cs-'))
    const css = themeCss()
    expect(css).toContain(`--lb-gr-porta-abre: ${doPrototipo.get('--cs-porta-abre')};`)
    expect(css).toContain(`--lb-gr-ease-porta: ${doPrototipo.get('--cs-ease-porta')};`)
    // O protótipo fecha em 260 ms pelo JS (app.js, atualizarPorta).
    expect(css).toContain('--lb-gr-porta-fecha: 260ms;')
    expect(`${GIRAR_DURACAO_MS}ms`).toBe(theme.gr.portaAbre)
    expect(`${GIRAR_FECHAR_DURACAO_MS}ms`).toBe(theme.gr.portaFecha)
  })
})
