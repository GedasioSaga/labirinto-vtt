import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { PlayerTurnBanner, TurnWaitNotice } from './PlayerTurnBanner'

function ficha(id: string, name: string): Token {
  return { id, characterId: null, name, x: 0, y: 0, size: 1, image: null }
}

const FICHAS = [ficha('tok-machado', 'Machado'), ficha('tok-goblin', 'Goblin'), ficha('tok-lanterna', 'Lanterna'), ficha('tok-sem-nome', '  ')]

function faixa(turn?: string): string {
  return renderToStaticMarkup(<PlayerTurnBanner turn={turn} ownTokens={['tok-machado']} tokens={FICHAS} />)
}

describe('PlayerTurnBanner', () => {
  it('o dono da ficha da vez lê "Sua vez"', () => {
    const html = faixa('tok-machado')
    expect(html).toContain('Sua vez')
    expect(html).toContain('role="status"')
  })

  it('a vez de uma ficha que ele vê é "Vez de <nome visível>", nunca "sua vez"', () => {
    expect(faixa('tok-goblin')).toContain('Vez de Goblin')
    expect(faixa('tok-lanterna')).toContain('Vez de Lanterna')
    expect(faixa('tok-goblin').toLowerCase()).not.toContain('sua vez')
  })

  it('ficha à vista sem nome não vira "Vez de " pendurado', () => {
    const html = faixa('tok-sem-nome')
    expect(html).toContain('Vez de outra ficha')
    expect(html.toLowerCase()).not.toContain('sua vez')
  })

  it('SEGURANÇA: sem vez, ou vez de ficha que não está no mapa dele, a faixa é a MESMA: vazia', () => {
    const vazia = faixa(undefined)
    expect(vazia.toLowerCase()).not.toContain('vez')
    expect(vazia).toContain('role="status"')
    expect(faixa('tok-vulto')).toBe(vazia)
  })
})

describe('TurnWaitNotice', () => {
  it('com aviso: "Espere sua vez", anunciado', () => {
    const html = renderToStaticMarkup(<TurnWaitNotice notice={{ id: 3 }} />)
    expect(html).toContain('Espere sua vez')
    expect(html).toContain('role="status"')
  })

  it('sem aviso não desenha nada', () => {
    expect(renderToStaticMarkup(<TurnWaitNotice notice={undefined} />)).toBe('')
  })
})
