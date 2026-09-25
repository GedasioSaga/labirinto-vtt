import { describe, expect, it } from 'vitest'
import { contarComodosConhecidos, lerPortasPorAtravessar, MAX_PORTAS_POR_ATRAVESSAR, regioesComContagem, rotuloComContagem } from './portasPorAtravessar'
import type { Region, RegionPoint } from '../types/map'

function quadrado(x: number, y: number, lado = 100): RegionPoint[] {
  return [
    { x, y },
    { x: x + lado, y },
    { x: x + lado, y: y + lado },
    { x, y: y + lado },
  ]
}

function sala(id: string, name: string, parentId?: string): Region {
  return { id, points: quadrado(0, 0), tag: '', fillColor: '#333', fillPattern: 'solid', data: {}, room: { shape: 'rect', name }, ...(parentId === undefined ? {} : { parentId }) }
}

describe('lerPortasPorAtravessar (o que chega pelo fio)', () => {
  it('lista de ids vira a lista; ausente é tratado por quem chama', () => {
    expect(lerPortasPorAtravessar(['pa', 'pb'])).toEqual(['pa', 'pb'])
    expect(lerPortasPorAtravessar([])).toEqual([])
  })

  it('forma errada devolve null (a mensagem inteira é descartada)', () => {
    expect(lerPortasPorAtravessar('pa')).toBeNull()
    expect(lerPortasPorAtravessar([1])).toBeNull()
    expect(lerPortasPorAtravessar([''])).toBeNull()
    expect(lerPortasPorAtravessar(['x'.repeat(65)])).toBeNull()
    expect(lerPortasPorAtravessar(Array.from({ length: MAX_PORTAS_POR_ATRAVESSAR + 1 }, (_, i) => `p${i}`))).toBeNull()
  })
})

describe('contarComodosConhecidos', () => {
  it('conta, no prédio de fora, os cômodos de dentro que chegaram com nome (netos inclusive)', () => {
    const regions = [sala('alb', 'Albergue'), sala('q1', 'Quarto 1', 'alb'), sala('q2', '', 'alb'), sala('arm', 'Armário', 'q1'), sala('rua', 'Rua')]
    expect([...contarComodosConhecidos(regions)]).toEqual([['alb', 2]])
  })

  it('prédio sem nome (oculto, teto fechado) não ganha contagem; cômodo cuja mãe não chegou não conta em ninguém', () => {
    expect([...contarComodosConhecidos([sala('alb', ''), sala('q1', 'Quarto 1', 'alb')])]).toEqual([])
    // 'ala' não veio no recorte: a corrente para nela, e o jogador não fica sabendo de quem a ala é filha.
    const semAla = [sala('alb', 'Albergue'), sala('q1', 'Quarto 1', 'ala')]
    expect([...contarComodosConhecidos(semAla)]).toEqual([])
  })

  it('região que não é Sala não conta nem vira prédio', () => {
    const area: Region = { id: 'area', points: quadrado(0, 0), tag: '', fillColor: '#333', fillPattern: 'solid', data: {} }
    expect([...contarComodosConhecidos([area, sala('q1', 'Quarto 1', 'area')])]).toEqual([])
  })
})

describe('rótulo do prédio com a contagem', () => {
  it('singular e plural', () => {
    expect(rotuloComContagem('Albergue', 1)).toBe('Albergue · 1 cômodo visto')
    expect(rotuloComContagem('Albergue', 3)).toBe('Albergue · 3 cômodos vistos')
  })

  it('só o prédio muda de rótulo; sem contagem nenhuma, a mesma lista volta', () => {
    const regions = [sala('alb', 'Albergue'), sala('q1', 'Quarto 1', 'alb')]
    const com = regioesComContagem(regions)
    expect(com.map((r) => r.room?.name)).toEqual(['Albergue · 1 cômodo visto', 'Quarto 1'])
    expect(regions[0].room?.name).toBe('Albergue')
    const sozinha = [sala('rua', 'Rua')]
    expect(regioesComContagem(sozinha)).toBe(sozinha)
  })
})
