import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration } from '../lib/exploration'
import type { PlayerScreen } from '../net/playerScreens'
import { theme } from '../theme'
import { PlayerMirror, mirrorTitle } from './PlayerMirror'

function telaNaCripta(): PlayerScreen {
  // O nome do MAPA viaja no recorte; o espelho nunca o escreve na tela (o jogador também não lê).
  const map = createEmptyMap('mapa-b', 'Cripta Rubra', 40, 12, 50)
  return { kind: 'map', rev: 7, map, vision: [], explored: encodeExploration(createExploration(map)), ownTokens: ['machado'], concealed: [] }
}

function titulo(html: string): string {
  const id = /role="dialog"[^>]*aria-labelledby="([^"]+)"/.exec(html)?.[1]
  if (id === undefined) throw new Error('o espelho deveria ser um dialog com aria-labelledby')
  const texto = new RegExp(`id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([^<]*)<`).exec(html)?.[1]
  if (texto === undefined) throw new Error('o título do espelho deveria existir')
  return texto
}

describe('PlayerMirror: a tela do jogador dentro do app do mestre', () => {
  it('é um dialog com o nome do jogador e a palavra "Tela" no nome acessível', () => {
    const html = renderToStaticMarkup(<PlayerMirror playerName="Ana" screen={telaNaCripta()} onClose={vi.fn()} />)
    expect(mirrorTitle('Ana')).toBe('Tela de Ana')
    expect(titulo(html)).toBe('Tela de Ana')
    expect(html).toContain('aria-label="Fechar a tela de Ana"')
  })

  it('com mapa, desenha a tela e não escreve nome de cena nem de mapa', () => {
    const html = renderToStaticMarkup(<PlayerMirror playerName="Bruno" screen={telaNaCripta()} onClose={vi.fn()} />)
    expect(html).toContain('lb-mirror__screen')
    expect(html).not.toContain('Cripta Rubra')
    expect(html).not.toContain('aguardando')
  })

  it('jogador na espera: o espelho diz que ele aguarda o mestre, sem mapa', () => {
    const html = renderToStaticMarkup(<PlayerMirror playerName="Carla" screen={{ kind: 'waiting' }} onClose={vi.fn()} />)
    expect(html).toContain('Carla está aguardando o mestre')
    expect(html).not.toContain('lb-mirror__screen')
  })

  it('sem nada recebido (caiu ou saiu): o espelho diz que não há tela, sem mapa', () => {
    const html = renderToStaticMarkup(<PlayerMirror playerName="Bruno" screen={null} onClose={vi.fn()} />)
    expect(html).toContain('Bruno está sem tela agora')
    expect(html).not.toContain('lb-mirror__screen')
  })
})

/**
 * O main.css cru, lido do disco: o vitest esvazia todo CSS importado (até com
 * `?raw`). O projeto não tem @types/node, então o módulo chega sem tipo pelo
 * especificador em variável e é conferido aqui antes do uso.
 */
async function lerMainCss(): Promise<string> {
  const especificador = 'node:fs/promises'
  const fs: unknown = await import(/* @vite-ignore */ especificador)
  if (typeof fs !== 'object' || fs === null || !('readFile' in fs) || typeof fs.readFile !== 'function') {
    throw new Error('node:fs/promises sem readFile')
  }
  // Relativo à raiz do vitest (client/): no jsdom o import.meta.url não é file://.
  const texto: unknown = await fs.readFile('src/main.css', 'utf8')
  if (typeof texto !== 'string') throw new Error('main.css não veio como texto')
  return texto
}

/** Corpo da regra `seletor { ... }` do main.css (só a primeira, a que define o bloco). */
function regraCss(css: string, seletor: string): string {
  const abertura = `\n${seletor} {`
  const inicio = css.indexOf(abertura)
  if (inicio < 0) throw new Error(`main.css deveria ter a regra ${seletor}`)
  return css.slice(inicio + abertura.length, css.indexOf('}', inicio))
}

describe('PlayerMirror: o retângulo do espelho só mostra a tela do jogador', () => {
  // O espelho flutua sobre o editor. Canto arredondado ou fundo translúcido
  // deixam o chão do EDITOR aparecer dentro do retângulo do espelho, e o mestre
  // confunde o que vaza por trás com o que o jogador vê.
  it('o dialog não herda o painel flutuante (canto arredondado e vidro fosco)', () => {
    const html = renderToStaticMarkup(<PlayerMirror playerName="Bruno" screen={telaNaCripta()} onClose={vi.fn()} />)
    expect(/<div class="([^"]*)" role="dialog"/.exec(html)?.[1]).toBe('lb-mirror')
  })

  it('a moldura é opaca e de canto reto: nenhum pixel do editor atravessa', async () => {
    const regra = regraCss(await lerMainCss(), '.lb-mirror')
    expect(regra).toMatch(/\n\s*border-radius:\s*0;/)
    expect(regra).toMatch(/\n\s*background:\s*var\(--lb-color-stone-solid\);/)
    expect(theme.color.stoneSolid).toMatch(/^#[0-9a-f]{6}$/i)
    expect(regra).not.toMatch(/backdrop-filter/)
  })
})
