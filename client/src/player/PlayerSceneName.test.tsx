import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PlayerSceneName } from './PlayerSceneName'

describe('PlayerSceneName: o selo "Onde estou"', () => {
  it('com nome, mostra o nome da cena como texto, num aviso de estado', () => {
    const html = renderToStaticMarkup(<PlayerSceneName name="1º andar" />)
    expect(html).toContain('role="status"')
    expect(html).toContain('Onde estou')
    expect(html).toContain('1º andar')
  })

  it('sem nome (cena sem nome público), não desenha nada', () => {
    expect(renderToStaticMarkup(<PlayerSceneName name={undefined} />)).toBe('')
    expect(renderToStaticMarkup(<PlayerSceneName name="" />)).toBe('')
  })

  it('nome com marcação sai como texto, nunca como HTML', () => {
    const html = renderToStaticMarkup(<PlayerSceneName name={'<img src=x onerror=alert(1)>'} />)
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})
