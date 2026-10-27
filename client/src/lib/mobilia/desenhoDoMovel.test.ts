import { describe, expect, it } from 'vitest'
import { desenhaEmLinhas, ofereceDesenhoEmLinhas, saiComTextura, TIPOS_COM_DESENHO_EM_LINHAS } from './desenhoDoMovel'
import { PECAS_NOVAS } from './pecasNovas'
import { TIPOS_MOBILIA } from './tipos'

/**
 * MT12: quais tipos o catálogo oferece EM LINHAS. A lista é fixa de propósito:
 * tipo novo que entrar em `TIPOS_MOBILIA` sem passar por aqui falha, e quem
 * mexer decide se ele tem versão em linhas (a peça nova não tem).
 */
describe('TIPOS_COM_DESENHO_EM_LINHAS', () => {
  it('são exatamente os 11 móveis de antes do Meio-Termo, na ordem do arquivo', () => {
    expect(TIPOS_COM_DESENHO_EM_LINHAS).toEqual([
      'barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete',
    ])
  })

  it('nenhuma peça nova oferece linhas, e todo tipo cai num dos dois lados', () => {
    for (const peca of PECAS_NOVAS) expect(ofereceDesenhoEmLinhas(peca)).toBe(false)
    const lados = TIPOS_MOBILIA.map((tipo) => (ofereceDesenhoEmLinhas(tipo) ? 'linhas' : 'nova'))
    expect(lados.filter((lado) => lado === 'linhas')).toHaveLength(11)
    expect(lados.filter((lado) => lado === 'nova')).toHaveLength(PECAS_NOVAS.length)
  })

  it('objeto sem tipo (imagem) não oferece', () => {
    expect(ofereceDesenhoEmLinhas(undefined)).toBe(false)
  })
})

describe('saiComTextura', () => {
  it('chave ligada: o móvel de antes sai com textura, e em linhas quando pede', () => {
    expect(saiComTextura({ mobilia: 'mesa' }, true)).toBe(true)
    expect(saiComTextura({ mobilia: 'mesa', mobiliaDesenho: 'linhas' }, true)).toBe(false)
    expect(desenhaEmLinhas({ mobilia: 'mesa', mobiliaDesenho: 'linhas' })).toBe(true)
  })

  it('a peça nova sai sempre com textura, mesmo com linhas gravado (arquivo forjado) e com a chave desligada', () => {
    expect(saiComTextura({ mobilia: 'mesaRedonda', mobiliaDesenho: 'linhas' }, true)).toBe(true)
    expect(saiComTextura({ mobilia: 'mesaRedonda' }, false)).toBe(true)
    expect(desenhaEmLinhas({ mobilia: 'mesaRedonda', mobiliaDesenho: 'linhas' })).toBe(false)
  })

  it('chave desligada: o móvel de antes é o de linhas, peça ou não', () => {
    expect(saiComTextura({ mobilia: 'mesa' }, false)).toBe(false)
    expect(saiComTextura({ mobilia: 'mesa', mobiliaDesenho: 'linhas' }, false)).toBe(false)
  })
})
