/**
 * BARRANCO PELO CHÃO (17/11/2026, `lib/materialDoBarranco.ts`): o material de
 * cada barranco sai do chão pintado no lado alto (o que mais cobre), o
 * escolhido no painel vence, e sem chão pintado tudo continua a terra de hoje.
 *
 * Geometria (px de mundo, casas de 64): o risco é a reta y = 300, de x = 100 a
 * x = 500; o chão pintado é uma faixa de pincel de cada lado dela.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, PinceladaDeTextura } from '../types/map'
import { barrancoVazio, geosDoBarranco, pincelarArea, riscarBarranco, virarRisco } from './barranco'
import type { ConsultaDoChao } from './chaoPintado'
import { barrancoComMaterial, chaoDosBarrancos, chaoPintadoDoPiso } from './materialDoBarranco'

const GRADE = 64
const RETA = [
  { x: 100, y: 300 },
  { x: 300, y: 300 },
  { x: 500, y: 300 },
]
const VAZIO = barrancoVazio({ grid: GRADE })

function faixa(id: string, textura: string, y: number, x0 = 0, x1 = 600): PinceladaDeTextura {
  return { id, tipo: 'pincel', textura, forca: 1, raio: 60, pontos: [{ x: x0, y }, { x: x1, y }] }
}

function mapaCom(texturas: PinceladaDeTextura[]): Pick<MapData, 'texturas' | 'regions' | 'drawings'> {
  return { texturas, regions: [], drawings: [] }
}

describe('o material do barranco sai do chão pintado no lado alto', () => {
  it('o risco pega o chão do lado alto; virar o risco troca; sem chão pintado é terra', () => {
    const b = riscarBarranco(VAZIO, RETA, 'medio', 0, 'r1')
    const chao: ConsultaDoChao = (p) => (p.y < 300 ? 'neve' : 'duna')
    const antes = chaoDosBarrancos(b, 0, GRADE, geosDoBarranco(b, 0, GRADE), chao).get('r1')
    const virado = virarRisco(b, 'r1')
    const depois = chaoDosBarrancos(virado, 0, GRADE, geosDoBarranco(virado, 0, GRADE), chao).get('r1')
    expect([antes?.material, depois?.material].sort()).toEqual(['areia', 'neve'])
    expect([antes?.chao, depois?.chao].sort()).toEqual(['duna', 'neve'])
    expect(chaoDosBarrancos(b, 0, GRADE, geosDoBarranco(b, 0, GRADE), null).get('r1')).toEqual({ material: 'terra', chao: null })
  })

  it('dois chãos no lado alto: vale o que cobre mais; o material do painel vence o chão', () => {
    const chao: ConsultaDoChao = (p) => (p.x < 200 ? 'grama' : 'cascalho')
    const b = riscarBarranco(VAZIO, RETA, 'medio', 0, 'r1')
    expect(chaoDosBarrancos(b, 0, GRADE, geosDoBarranco(b, 0, GRADE), chao).get('r1')?.material).toBe('pedra')
    const escolhido = riscarBarranco(VAZIO, RETA, 'medio', 0, 'r2', 'neve')
    expect(chaoDosBarrancos(escolhido, 0, GRADE, geosDoBarranco(escolhido, 0, GRADE), chao).get('r2')?.material).toBe('neve')
  })

  it('a área alta pega o chão de dentro dela; o traço com material escolhido fica com ele', () => {
    const chao: ConsultaDoChao = () => 'duna'
    const automatica = pincelarArea(VAZIO, { x: 320, y: 320 }, 2.3, 0, false, 'medio', 0, null)
    const geos = geosDoBarranco(automatica, 0, GRADE)
    expect(geos.length).toBeGreaterThan(0)
    expect([...chaoDosBarrancos(automatica, 0, GRADE, geos, chao).values()].map((c) => c.material)).toEqual(geos.map(() => 'areia'))
    const escolhida = pincelarArea(VAZIO, { x: 320, y: 320 }, 2.3, 0, false, 'medio', 0, 'grama')
    const geosDaEscolhida = geosDoBarranco(escolhida, 0, GRADE)
    expect([...chaoDosBarrancos(escolhida, 0, GRADE, geosDaEscolhida, chao).values()].map((c) => c.material)).toEqual(geosDaEscolhida.map(() => 'grama'))
  })
})

describe('o barranco que vai ao jogador leva o material escrito', () => {
  it('sem chão pintado é o MESMO barranco; com chão, o risco sai com o material do lado alto', () => {
    const b = riscarBarranco(VAZIO, RETA, 'medio', 0, 'r1')
    expect(chaoPintadoDoPiso(mapaCom([]), 0)).toBeNull()
    expect(barrancoComMaterial(b, 0, GRADE, mapaCom([]))).toBe(b)
    // Neve de um lado da reta e duna do outro: o lado alto decide, e o outro lado não entra.
    const pintado = mapaCom([faixa('t1', 'neve', 240), faixa('t2', 'duna', 360)])
    const escrito = barrancoComMaterial(b, 0, GRADE, pintado)
    const doLadoAlto = chaoDosBarrancos(b, 0, GRADE, geosDoBarranco(b, 0, GRADE), chaoPintadoDoPiso(pintado, 0)).get('r1')?.material
    expect(['neve', 'areia']).toContain(doLadoAlto)
    expect(escrito?.riscos.find((r) => r.id === 'r1')?.material).toBe(doLadoAlto)
    // O chão de outro piso não conta para o térreo.
    expect(barrancoComMaterial(b, 0, GRADE, mapaCom([{ ...faixa('t3', 'neve', 240), piso: 1 }, { ...faixa('t4', 'neve', 360), piso: 1 }]))).toBe(b)
  })
})
