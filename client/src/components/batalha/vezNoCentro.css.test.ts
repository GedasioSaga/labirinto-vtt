// @vitest-environment node
/**
 * Segunda auditoria da batalha (09/11/2026, achado 4): a dica da ferramenta
 * (`.lb-hint`, da barra do pé) sumia a vez inteira do NPC, mesmo com o menu
 * recolhido. Ela só atrapalha o pé da mira: some só com a mira aberta.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Os seletores das regras do `vezNoCentro.css` que mexem na dica da ferramenta. */
function seletoresDaDica(): string[] {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'vezNoCentro.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  return [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((regra) => (regra[1] ?? '').trim()).filter((seletor) => seletor.includes('.lb-hint'))
}

describe('o menu da vez do NPC no centro e a dica da ferramenta', () => {
  it('a dica só some com a mira aberta no centro; com o menu recolhido ou só a lista de ações, ela fica', () => {
    expect(seletoresDaDica()).toEqual(['body:has(.bt-centro-do-mestre .bt-mira) .lb-hint'])
  })
})
