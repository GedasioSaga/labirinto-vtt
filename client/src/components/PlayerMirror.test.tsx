import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration } from '../lib/exploration'
import type { PlayerScreen } from '../net/playerScreens'
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
