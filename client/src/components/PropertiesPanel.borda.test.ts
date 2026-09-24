import { describe, expect, it, vi } from 'vitest'

/**
 * O corpo que rola do inspetor (aba Mapa) não encosta na borda de fora do
 * painel. Sem folga, o que rola é cortado EM CIMA da borda: com a seção
 * "Objetos do mapa" o trilho cresceu, e a amostra "Cor do chão" (a cor exata
 * do chão da sala) passou a ser cortada no último pixel do painel. Uma leitura
 * da tela por blocos de 4 px perguntando `elementFromPoint` no centro do bloco
 * achava o canvas do mapa logo abaixo e contava essas linhas como chão da
 * cena (e2e/task-jornada-varias-cenas, teste 1: a caixa do chão cresceu de
 * 486 para 528 px de altura, e a sala "virou" salas misturadas). Com a folga,
 * o corte fica dentro do painel e o bloco da borda é do painel.
 *
 * O jsdom não desenha: a prova é a regra do main.css.
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

/** Metade do bloco de 4 px: o centro do bloco da borda cai até 2 px dentro dela. */
const FOLGA_MINIMA_PX = 2

describe('inspetor da aba Mapa: o corpo que rola termina antes da borda do painel', () => {
  it('.lb-inspector tem folga embaixo de pelo menos 2 px (o corte do que rola fica dentro do painel)', async () => {
    const valor = regra(await lerMainCss(), '.lb-inspector').get('padding-bottom') ?? ''
    const tokens: Record<string, number> = { 'var(--lb-space-1)': 4, 'var(--lb-space-2)': 8 }
    const px = tokens[valor] ?? Number.parseFloat(valor)
    expect(Number.isFinite(px) ? px : 0).toBeGreaterThanOrEqual(FOLGA_MINIMA_PX)
  })
})
