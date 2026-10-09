/**
 * MINIATURA DO CHAT: a foto de quem falou é uma bolinha de 20px ao lado do
 * nome, na fala de QUALQUER um — não só na do mestre. Um comentário colado
 * no seletor (`.pc-msg--master /* … *\/ .pc-msg__face`) prendeu o tamanho à
 * fala do mestre, e a do jogador saía com a foto inteira.
 */
import { describe, expect, it, vi } from 'vitest'

async function lerCss(relativo: string): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativo), 'utf8')
}

/** As declarações da PRIMEIRA regra que tem `seletor` na lista de seletores: propriedade → valor. */
function regra(css: string, seletor: string): Map<string, string> {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, seletores, corpo] of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!seletores.split(',').some((s) => s.replace(/\s+/g, ' ').trim() === seletor)) continue
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

describe('miniatura de quem falou no chat', () => {
  it.each([
    ['PlayerChat.css', '.pc-msg__face', '.pc-msg--master .pc-msg__from'],
    ['../components/MasterChatPanel.css', '.lb-mchat__face', '.lb-mchat__msg--master .lb-mchat__from'],
  ])('%s: a bolinha vale para toda fala, e o latão do nome só para a do mestre', async (arquivo, face, nomeDoMestre) => {
    const css = await lerCss(arquivo)
    const bolinha = regra(css, face)
    expect(bolinha.get('width')).toBe('20px')
    expect(bolinha.get('height')).toBe('20px')
    expect(bolinha.get('border-radius')).toBe('50%')
    expect(regra(css, nomeDoMestre).get('color')).toBe('var(--lb-color-brass-bright, #f3ba66)')
  })
})
