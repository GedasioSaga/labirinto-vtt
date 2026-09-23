import { describe, expect, it } from 'vitest'
import { tableCodeFromSearch, tableScreenUrl } from './tableScreen'

describe('link da tela da mesa', () => {
  it('é o endereço do jogador com o código da sala em ?mesa=', () => {
    expect(tableScreenUrl('http://10.0.0.2:7777/player', 'AB12CD')).toBe('http://10.0.0.2:7777/player?mesa=AB12CD')
    expect(tableScreenUrl('https://abc.trycloudflare.com/player', 'AB12CD')).toBe('https://abc.trycloudflare.com/player?mesa=AB12CD')
  })

  it('endereço que não é URL não vira link', () => {
    expect(tableScreenUrl('nao e url', 'AB12CD')).toBeNull()
    expect(tableScreenUrl('javascript:alert(1)', 'AB12CD')).toBeNull()
  })
})

describe('tableCodeFromSearch', () => {
  it('sem ?mesa a página é a do jogador', () => {
    expect(tableCodeFromSearch('')).toBeNull()
    expect(tableCodeFromSearch('?x=1')).toBeNull()
  })

  it('com ?mesa, devolve o código normalizado (ou vazio para a tela pedir)', () => {
    expect(tableCodeFromSearch('?mesa=ab12cd')).toBe('AB12CD')
    expect(tableCodeFromSearch('?mesa= AB 12 CD ')).toBe('AB12CD')
    expect(tableCodeFromSearch('?mesa')).toBe('')
    expect(tableCodeFromSearch('?mesa=<script>')).toBe('SCRIPT')
  })
})
