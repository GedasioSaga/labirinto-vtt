import { describe, expect, it, vi } from 'vitest'
import { themeCss } from '../theme'

/**
 * Espaço nos botões do painel (bar: painel Design do Figma UI3). Um token de
 * vão e um de alvo mínimo, e as linhas de botões do rail derivam deles: nada
 * encosta, nada quebra no meio do rótulo, nada vaza da coluna.
 */

/** Um CSS como está no disco, relativo a esta pasta (ver `PropertiesPanel.moldura.test.ts`: `?raw` e `new URL` não leem o arquivo). */
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
    if (seletores.trim() !== seletor) continue
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

/** Os seletores de uma lista ("a, b:has(c, d)" → ["a", "b:has(c, d)"]): vírgula de dentro de parênteses não separa. */
function seletoresDaLista(lista: string): string[] {
  const seletores: string[] = []
  let atual = ''
  let nivel = 0
  for (const letra of lista) {
    if (letra === '(') nivel++
    if (letra === ')') nivel--
    if (letra === ',' && nivel === 0) {
      seletores.push(atual.trim())
      atual = ''
    } else {
      atual += letra
    }
  }
  return [...seletores, atual.trim()].filter(Boolean)
}

/** Como `regra`, mas acha também o seletor dentro de uma lista ("a, b { ... }"). */
function regraDaLista(css: string, seletor: string): Map<string, string> {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, seletores] of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (seletoresDaLista(seletores).includes(seletor)) return regra(semComentarios, seletores.trim())
  }
  return new Map()
}

const VAO = 'var(--lb-control-gap)'
/** Entre ícones sem moldura o Figma usa a metade do vão das peças com moldura. */
const MEIO_VAO = 'calc(var(--lb-control-gap) / 2)'
const ALVO = 'var(--lb-control-min)'

describe('linhas de botões do painel: um vão e um alvo mínimo só', () => {
  it('o tema publica o vão de 8 px e o alvo de 24 px', () => {
    const css = themeCss()
    expect(css).toContain('--lb-control-gap: 8px;')
    expect(css).toContain('--lb-control-min: 24px;')
  })

  it('cartão do jogador: as ações quebram de linha com o vão do token em vez de vazar', async () => {
    const css = await lerCss('../main.css')
    const acoes = regra(css, '.lb-player__actions')
    expect(acoes.get('flex-wrap')).toBe('wrap')
    expect(acoes.get('gap')).toBe(VAO)
    // O respiro de 6 px solto que espremia as ações numa linha só sai.
    expect(regra(css, '.lb-player__actions > .lb-btn').get('padding')).toBeUndefined()
    expect(regra(css, '.lb-player__line--acoes').get('gap')).toBe(VAO)
    expect(regra(css, '.lb-player__quick').get('gap')).toBe(VAO)
    const fichas = regra(css, '.lb-player__tokens')
    expect(fichas.get('flex-wrap')).toBe('wrap')
    expect(fichas.get('gap')).toBe(VAO)
    // A linha do nome deixa as fichas descerem em vez de cortar o nome em "A…".
    expect(regra(css, '.lb-player__line:has(> .lb-player__tokens)').get('flex-wrap')).toBe('wrap')
  })

  it('acervo: a confirmação desce para a linha de baixo e os ícones têm alvo de 24 px', async () => {
    const css = await lerCss('./TokenLibraryPanel.css')
    expect(regra(css, '.lb-acervo__item').get('flex-wrap')).toBe('wrap')
    const confirma = regra(css, '.lb-acervo__confirma')
    expect(confirma.get('flex')).toBe('1 1 100%')
    expect(confirma.get('gap')).toBe(VAO)
    for (const seletor of ['.lb-acervo__apagar', '.lb-acervo__mover']) {
      const icone = regraDaLista(css, seletor)
      expect(icone.get('min-width'), seletor).toBe(ALVO)
      expect(icone.get('min-height'), seletor).toBe(ALVO)
    }
    for (const seletor of ['.lb-acervo__nome', '.lb-acervo__destino']) {
      expect(regra(css, seletor).get('min-height'), seletor).toBe(ALVO)
    }
    // "+ Token" e "+ Pasta" da linha do título (o antigo "+ Nova pasta").
    expect(regra(await lerCss('./BotaoMais.css'), '.lb-mais').get('min-height')).toBe(ALVO)
    for (const seletor of ['.lb-acervo__form-acoes', '.lb-acervo__destinos']) {
      expect(regra(css, seletor).get('gap'), seletor).toBe(VAO)
    }
  })

  it('o acervo não tem regra em main.css: o desenho inteiro mora em TokenLibraryPanel.css', async () => {
    // Metade lá e metade cá, a folha do componente (que entra ANTES de
    // main.css) só ganhava com seletor mais pesado, e um empate perdia calado.
    const principal = (await lerCss('../main.css')).replace(/\/\*[\s\S]*?\*\//g, '')
    const doAcervo = [...principal.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .flatMap(([, seletores]) => seletoresDaLista(seletores))
      .filter((seletor) => seletor.includes('.lb-acervo'))
    expect(doAcervo).toEqual([])
  })

  it('ícones sem moldura (cenas, alinhar, cores da ficha) ficam a meio vão, sem encostar', async () => {
    const principal = await lerCss('../main.css')
    expect(regra(principal, '.lb-cenas__linha > .lb-cenas__controles').get('gap')).toBe(MEIO_VAO)
    const alinhar = await lerCss('./AlignDistributeControls.css')
    expect(regra(alinhar, '.lb-align__row').get('gap')).toBe(MEIO_VAO)
    const ficha = await lerCss('./TokenControls.css')
    expect(regra(ficha, '.lb-token-cores').get('column-gap')).toBe(MEIO_VAO)
  })
})
