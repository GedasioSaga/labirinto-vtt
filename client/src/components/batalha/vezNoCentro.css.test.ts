// @vitest-environment node
/**
 * Segunda auditoria da batalha (09/11/2026, achado 4): a dica da ferramenta
 * (`.lb-hint`, da barra do pé) sumia a vez inteira do NPC, mesmo com o menu
 * recolhido. Ela só atrapalha o pé da mira: some só com a mira aberta.
 */
import { describe, expect, it, vi } from 'vitest'

/** Os seletores das regras do `vezNoCentro.css` que mexem na dica da ferramenta. O projeto não tem os tipos do Node: vêm pelo `importActual`, como nos outros testes de CSS. */
async function seletoresDaDica(): Promise<string[]> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'vezNoCentro.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  return [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((regra) => (regra[1] ?? '').trim()).filter((seletor) => seletor.includes('.lb-hint'))
}

describe('o menu da vez do NPC no centro e a dica da ferramenta', () => {
  it('a dica só some com a mira aberta no centro ou com a carta REAÇÃO aberta; com o menu recolhido, a lista de ações ou a reação recolhida, ela fica', async () => {
    expect(await seletoresDaDica()).toEqual(['body:has(.bt-centro-do-mestre .bt-mira) .lb-hint', 'body:has(.bt-reacao-no-centro > .bt-reacao) .lb-hint'])
  })
})
