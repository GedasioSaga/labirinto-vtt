import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PlayerTurnBanner } from './PlayerTurnBanner'

describe('PlayerTurnBanner', () => {
  it('o dono da ficha da vez lê "Sua vez"', () => {
    const html = renderToStaticMarkup(<PlayerTurnBanner turn="tok-machado" ownTokens={['tok-machado']} />)
    expect(html).toContain('Sua vez')
    expect(html).toContain('role="status"')
  })

  it('quem não é da vez não lê "sua vez" (a região fica vazia, pronta para anunciar)', () => {
    for (const turn of ['tok-goblin', undefined]) {
      const html = renderToStaticMarkup(<PlayerTurnBanner turn={turn} ownTokens={['tok-machado']} />)
      expect(html.toLowerCase()).not.toContain('sua vez')
      expect(html).toContain('role="status"')
    }
  })
})
