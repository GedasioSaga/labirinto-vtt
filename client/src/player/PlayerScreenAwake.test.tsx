import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PlayerScreenAwake } from './PlayerScreenAwake'

describe('PlayerScreenAwake: o selo "Tela acesa"', () => {
  it('com a trava ativa, mostra o selo discreto, sem controle nenhum dentro', () => {
    const html = renderToStaticMarkup(<PlayerScreenAwake active />)
    expect(html).toContain('Tela acesa')
    expect(html).toContain('class="pp-awake"')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('tabindex')
  })

  it('sem trava (navegador sem suporte, recusou ou soltou), não desenha nada', () => {
    expect(renderToStaticMarkup(<PlayerScreenAwake active={false} />)).toBe('')
  })
})
