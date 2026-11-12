/**
 * LUZ DE OBJETO QUE O JOGADOR NÃO VÊ NÃO CLAREIA NADA PARA ELE (caça de
 * 12/11/2026, P-NEVOA F03(d)). A parede de camada escondida dos jogadores sai
 * da visão ENVIADA (ela não existe para ele), mas segura a da autoridade: a
 * tocha presa do outro lado dela não vai no pacote, e o claro dela, calculado
 * sem a parede, atravessava e aparecia na rua como um anel de luz sem fonte.
 * Pacote forjado, dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Prop, Token, Wall } from '../types/map'
import { CAMADAS_PADRAO } from './camadas/padrao'
import { filterMapForPlayer, raioDaNoite } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
const LIVRE = 'livre_0a1b2c3d'
const SO_ANA: Record<string, string[]> = { ana: ['heroi'] }
const noite = raioDaNoite(() => 3 * GRID)

function ficha(x: number, y: number): Token {
  return { id: 'heroi', characterId: null, name: 'Heroi', x: x * GRID, y: y * GRID, size: 1, image: null }
}

/** Parede de (24; 1,5) a (28; 1,5), na camada escondida dos jogadores ou comum. */
function parede(escondida: boolean): Wall {
  return { id: 'parede', x1: 24 * GRID, y1: 1.5 * GRID, x2: 28 * GRID, y2: 1.5 * GRID, blocksLight: true, blocksMove: true, door: null, ...(escondida ? { camada: LIVRE } : {}) }
}

function luz(id: string, mobilia: Prop['mobilia'], x: number, y: number): Prop {
  return { id, src: '', x, y, width: 0.4 * GRID, height: 0.5 * GRID, linkedMapPath: null, mobilia }
}

function cena(heroi: Token, props: Prop[], escondida = true): MapData {
  return {
    ...createEmptyMap('rua', 'Rua', 34, 22, GRID),
    externa: true,
    walls: [parede(escondida)],
    props,
    versaoDasCamadas: 2,
    modeloCamadas: { ordem: [...CAMADAS_PADRAO.map((id) => ({ id })), { id: LIVRE, nome: 'Segredo' }] },
    ocultasDoJogador: [LIVRE],
    tokens: [heroi],
  }
}

const recorte = (map: MapData) => filterMapForPlayer(map, 'ana', SO_ANA, noite)

describe('luz atrás de parede de camada escondida dos jogadores', () => {
  it('a tocha presa do outro lado e a fogueira atrás da parede não clareiam a rua: a visão sai igual à sem elas', () => {
    // Tocha a 1,35 px ao norte da parede; fogueira meia casa ao norte, solta. A ficha ao sul, de noite, nos dois
    // lugares da prova na tela (n3 e n4); a fogueira só da ficha bem em frente (da outra, a ponta da parede deixa vê-la).
    const tocha = luz('tocha', 'tochaDeParede', 26 * GRID, 1.5 * GRID - 1.35)
    const fogueira = luz('fogueira', 'fogueira', 26 * GRID, 1 * GRID)
    const casos: [Token, Prop[]][] = [
      [ficha(20, 1.8), [tocha]],
      [ficha(26, 2.6), [tocha]],
      [ficha(26, 2.6), [fogueira]],
    ]
    for (const [heroi, props] of casos) {
      const com = recorte(cena(heroi, props))
      expect(com.map.props).toEqual([])
      expect(com.vision).toEqual(recorte(cena(heroi, [])).vision)
    }
  })

  it('controle: do mesmo lado da tocha ela chega e clareia; com a parede comum, o claro que dobra a ponta da parede continua', () => {
    const tocha = luz('tocha', 'tochaDeParede', 26 * GRID, 1.5 * GRID - 1.35)
    // Ficha ao norte, a 4 casas da tocha (fora do raio da noite): a tocha chega e o claro dela entra na visão.
    const doLado = recorte(cena(ficha(22, 0.6), [tocha]))
    expect(doLado.map.props.map((p) => p.id)).toEqual(['tocha'])
    expect(doLado.vision).not.toEqual(recorte(cena(ficha(22, 0.6), [])).vision)
    // Parede comum (existe para o jogador): do sul ele vê, pela ponta oeste dela, o chão que a tocha clareia lá atrás.
    expect(recorte(cena(ficha(20, 1.8), [tocha], false)).vision).not.toEqual(recorte(cena(ficha(20, 1.8), [], false)).vision)
  })
})
