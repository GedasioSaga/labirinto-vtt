import { describe, expect, it } from 'vitest'
import { tableCodeFromSearch, tableKeyFromSearch, tableScreenUrl } from './tableScreen'

describe('link da tela da mesa', () => {
  it('é o endereço do jogador com o código da sala em ?mesa= e a chave da tela em ?chave=', () => {
    expect(tableScreenUrl('http://10.0.0.2:7777/player', 'AB12CD', 'k-1')).toBe('http://10.0.0.2:7777/player?mesa=AB12CD&chave=k-1')
    expect(tableScreenUrl('https://abc.trycloudflare.com/player', 'AB12CD', 'k-1')).toBe('https://abc.trycloudflare.com/player?mesa=AB12CD&chave=k-1')
  })

  it('endereço que não é URL não vira link', () => {
    expect(tableScreenUrl('nao e url', 'AB12CD', 'k-1')).toBeNull()
    expect(tableScreenUrl('javascript:alert(1)', 'AB12CD', 'k-1')).toBeNull()
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

describe('tableKeyFromSearch', () => {
  it('lê a chave do link da TV; sem ela, vazio', () => {
    expect(tableKeyFromSearch('?mesa=AB12CD&chave=0f3a-9b')).toBe('0f3a-9b')
    expect(tableKeyFromSearch('?mesa=AB12CD')).toBe('')
    expect(tableKeyFromSearch('?mesa=AB12CD&chave= 0f3a ')).toBe('0f3a')
  })

  it('volta pelo mesmo link que tableScreenUrl monta', () => {
    const url = tableScreenUrl('http://10.0.0.2:7777/player', 'AB12CD', '5d1c2e7a-0b1f-4c2d-9e3a-7f6b5a4c3d2e')
    if (url === null) throw new Error('link inválido')
    expect(tableKeyFromSearch(new URL(url).search)).toBe('5d1c2e7a-0b1f-4c2d-9e3a-7f6b5a4c3d2e')
  })
})
