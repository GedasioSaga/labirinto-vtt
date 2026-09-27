import { describe, expect, it, vi } from 'vitest'

/**
 * MOLDURA DO PAINEL ENXUTA (27/09/2026): menos página em volta do item. A bar
 * são os painéis laterais do Figma (camadas/propriedades) e do VS Code
 * (Explorer): cabeçalho numa faixa só, seção recolhida do tamanho do alvo que
 * a abre, e nada de respiro sobrando em volta de título fechado.
 *
 * O jsdom não faz layout, então o teste lê as regras do `main.css` que dão as
 * medidas — o app medido (1280x800) é a outra metade da prova.
 */

/** O main.css como está no disco (ver `Toggle.test.tsx`: `?raw` e `new URL` não leem o arquivo). */
async function lerMainCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'main.css'), 'utf8')
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

/** Onde começa a regra de seletor exato `seletor` no texto sem comentários; -1 se não existe. */
function posicaoDaRegra(css: string, seletor: string): number {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, (comentario) => ' '.repeat(comentario.length))
  for (const achado of semComentarios.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    if (achado[1].trim() === seletor) return achado.index ?? -1
  }
  return -1
}

/** '44px' vira 44; qualquer outra coisa (token, auto, ausente) vira NaN e reprova a comparação. */
function px(valor: string | undefined): number {
  const achado = /^(\d+(?:\.\d+)?)px$/.exec(valor?.trim() ?? '')
  return achado === null ? Number.NaN : Number(achado[1])
}

const RECOLHIDA = ".lb-collapsible:has(> .lb-collapsible__heading > .lb-collapsible__toggle[aria-expanded='false'])"

describe('moldura do painel: o cabeçalho do inspetor é uma faixa só', () => {
  it('a faixa tem altura fixa de até 48 px, contando a borda, e não encolhe na coluna', async () => {
    const cabeca = regra(await lerMainCss(), '.lb-inspector__head')
    expect(cabeca.get('box-sizing')).toBe('border-box')
    expect(px(cabeca.get('block-size'))).toBeLessThanOrEqual(48)
    expect(cabeca.get('flex')).toBe('none')
  })

  it('a marca cai para 24 px, para caber na faixa sem apertar o nome', async () => {
    const marca = regra(await lerMainCss(), '.lb-inspector__mark')
    expect(marca.get('width')).toBe('24px')
    expect(marca.get('height')).toBe('24px')
  })

  it('o nome do mapa continua em reticências, com linha justa para as duas linhas caberem na faixa', async () => {
    const nome = regra(await lerMainCss(), '.lb-inspector__mapname')
    expect(nome.get('text-overflow')).toBe('ellipsis')
    expect(nome.get('line-height')).toBe('var(--lb-font-leading-tight)')
  })
})

describe('moldura do painel: seção recolhida do tamanho do alvo que a abre', () => {
  it('o botão do cabeçalho é o alvo inteiro, de 44 px', async () => {
    const botao = regra(await lerMainCss(), '.lb-collapsible__toggle')
    expect(px(botao.get('min-height'))).toBeGreaterThanOrEqual(44)
  })

  it('a seção começa no botão: sem padding em cima, e o corpo aberto a 8 px dele', async () => {
    const secao = regra(await lerMainCss(), '.lb-collapsible')
    expect(secao.get('padding-top')).toBe('0')
    expect(secao.get('gap')).toBe('var(--lb-space-2)')
  })

  it('recolhida, não sobra padding embaixo do título', async () => {
    expect(regra(await lerMainCss(), RECOLHIDA).get('padding-bottom')).toBe('0')
  })

  it('o fio entre seções não soma altura: é sombra por dentro, não borda', async () => {
    const fio = regra(await lerMainCss(), '.lb-section + .lb-collapsible')
    expect(fio.get('border-top')).toBe('0')
    expect(fio.get('box-shadow')).toContain('inset')
  })

  it('as regras novas vêm depois das que corrigem, para vencerem na cascata', async () => {
    const css = await lerMainCss()
    const secao = posicaoDaRegra(css, '.lb-section')
    const fioDeSecao = posicaoDaRegra(css, '.lb-section + .lb-section')
    expect(secao).toBeGreaterThanOrEqual(0)
    expect(fioDeSecao).toBeGreaterThanOrEqual(0)
    expect(posicaoDaRegra(css, '.lb-collapsible')).toBeGreaterThan(secao)
    expect(posicaoDaRegra(css, '.lb-section + .lb-collapsible')).toBeGreaterThan(fioDeSecao)
    expect(posicaoDaRegra(css, RECOLHIDA)).toBeGreaterThan(posicaoDaRegra(css, '.lb-collapsible'))
  })
})
