import { describe, expect, it } from 'vitest'
import { comFolga, contem, criarPortaoDaVista } from './vistaCoberta'

const vista = (left: number, top: number, w = 100, h = 50) => ({ left, top, right: left + w, bottom: top + h })

describe('portão da vista coberta (moldura do mapa)', () => {
  it('a primeira chamada desenha com uma tela de folga para cada lado', () => {
    const portao = criarPortaoDaVista()
    expect(portao.precisa('k', vista(0, 0))).toEqual({ left: -100, top: -50, right: 200, bottom: 100 })
  })

  it('pan dentro da área coberta não redesenha; saindo dela, redesenha centrado na vista nova', () => {
    const portao = criarPortaoDaVista()
    portao.precisa('k', vista(0, 0))
    expect(portao.precisa('k', vista(60, 20))).toBeNull()
    expect(portao.precisa('k', vista(100, 50))).toBeNull()
    expect(portao.precisa('k', vista(101, 0))).toEqual(comFolga(vista(101, 0)))
  })

  it('chave diferente (zoom, resolução, tamanho do mapa) sempre redesenha, mesmo com a vista coberta', () => {
    const portao = criarPortaoDaVista()
    portao.precisa('escala 1', vista(0, 0))
    expect(portao.precisa('escala 1.1', vista(0, 0))).not.toBeNull()
    expect(portao.precisa('escala 1.1', vista(0, 0))).toBeNull()
  })

  it('esquecer obriga o próximo a redesenhar (exportar imagem desenha a cena inteira)', () => {
    const portao = criarPortaoDaVista()
    portao.precisa('k', vista(0, 0))
    portao.esquecer()
    expect(portao.precisa('k', vista(0, 0))).not.toBeNull()
  })

  it('vista não finita (tela 0, escala inválida) desenha como veio e não guarda', () => {
    const portao = criarPortaoDaVista()
    const ruim = { left: Number.NaN, top: 0, right: 10, bottom: 10 }
    expect(portao.precisa('k', ruim)).toBe(ruim)
    expect(portao.precisa('k', vista(0, 0))).not.toBeNull()
  })

  it('contem é inclusivo nas bordas', () => {
    expect(contem(vista(0, 0), vista(0, 0))).toBe(true)
    expect(contem(vista(0, 0), vista(0, 1))).toBe(false)
  })
})
