import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TurnWaitNotice } from './TurnWaitNotice'

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
