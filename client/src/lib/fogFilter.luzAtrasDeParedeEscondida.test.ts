/**
 * LUZ DE OBJETO QUE O JOGADOR NÃO VÊ NÃO CLAREIA NADA PARA ELE (caça de
 * 12/11/2026, P-NEVOA F03(d)). A tocha presa do outro lado da parede de camada
 * escondida dos jogadores não ia no pacote, e o claro dela atravessava a
 * parede e aparecia na rua como um anel de luz sem fonte.
 *
 * Desde o FX-SEG-A (a regra da decisão 30 do mestre): o que mora em camada
 * escondida dos jogadores não existe para eles — a parede não tapa (nem a
 * visão enviada nem a da autoridade) e a tocha presa SÓ nela mora na camada
 * dela e some junto, dos DOIS lados, com o claro. A fogueira solta atrás da
 * parede é a da cena sem a parede. Pacote forjado, dados inventados.
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

function cena(heroi: Token, props: Prop[], escondida = true, comParede = true): MapData {
  return {
    ...createEmptyMap('rua', 'Rua', 34, 22, GRID),
    externa: true,
    walls: comParede ? [parede(escondida)] : [],
    props,
    versaoDasCamadas: 2,
    modeloCamadas: { ordem: [...CAMADAS_PADRAO.map((id) => ({ id })), { id: LIVRE, nome: 'Segredo' }] },
    ocultasDoJogador: [LIVRE],
    tokens: [heroi],
  }
}

const recorte = (map: MapData) => filterMapForPlayer(map, 'ana', SO_ANA, noite)

describe('luz atrás de parede de camada escondida dos jogadores', () => {
  it('a tocha presa do outro lado não clareia a rua; a fogueira atrás da parede é a da cena sem a parede', () => {
    // Tocha a 1,35 px ao norte da parede; fogueira meia casa ao norte, solta. A ficha ao sul, de noite, nos dois
    // lugares da prova na tela (n3 e n4).
    const tocha = luz('tocha', 'tochaDeParede', 26 * GRID, 1.5 * GRID - 1.35)
    const fogueira = luz('fogueira', 'fogueira', 26 * GRID, 1 * GRID)
    for (const heroi of [ficha(20, 1.8), ficha(26, 2.6)]) {
      const com = recorte(cena(heroi, [tocha]))
      expect(com.map.props).toEqual([])
      expect(com.vision).toEqual(recorte(cena(heroi, [])).vision)
      expect(com.vision).toEqual(recorte(cena(heroi, [], true, false)).vision)
    }
    // A fogueira solta não mora na camada: a parede escondida não a tapa, e ela chega e clareia como sem a parede.
    const comFogueira = recorte(cena(ficha(26, 2.6), [fogueira]))
    const semParede = recorte(cena(ficha(26, 2.6), [fogueira], true, false))
    expect(comFogueira.map.props.map((p) => p.id)).toEqual(['fogueira'])
    expect(comFogueira.map.props).toEqual(semParede.map.props)
    expect(comFogueira.vision).toEqual(semParede.vision)
  })

  it('do mesmo lado da tocha ela também não chega nem clareia; com a parede comum, ela chega e o claro que dobra a ponta continua', () => {
    const tocha = luz('tocha', 'tochaDeParede', 26 * GRID, 1.5 * GRID - 1.35)
    // Ficha ao norte, a 4 casas da tocha (fora do raio da noite): presa SÓ na parede escondida, a tocha mora na camada
    // dela; antes chegava boiando na linha da parede que o jogador não recebe, e o claro dela entrava na visão.
    const doLado = recorte(cena(ficha(22, 0.6), [tocha]))
    expect(doLado.map.props).toEqual([])
    expect(doLado.vision).toEqual(recorte(cena(ficha(22, 0.6), [], true, false)).vision)
    // Controle: na parede comum, a mesma tocha chega a quem está do lado dela e clareia.
    const comum = recorte(cena(ficha(22, 0.6), [tocha], false))
    expect(comum.map.props.map((p) => p.id)).toEqual(['tocha'])
    expect(comum.vision).not.toEqual(recorte(cena(ficha(22, 0.6), [], false)).vision)
    // Parede comum (existe para o jogador): do sul ele vê, pela ponta oeste dela, o chão que a tocha clareia lá atrás.
    expect(recorte(cena(ficha(20, 1.8), [tocha], false)).vision).not.toEqual(recorte(cena(ficha(20, 1.8), [], false)).vision)
  })
})
