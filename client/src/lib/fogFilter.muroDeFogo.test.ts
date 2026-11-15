/**
 * O MURO DE FOGO no recorte do jogador (auditoria de 15/11/2026). A caixa do
 * muro é a do traço inteiro: num muro de 24 casas o centro dela fica a 12 casas
 * de cada ponta. Pelo centro, quem parava junto da ponta não recebia o muro e
 * era barrado por uma parede que não via. O muro conta como visto quando algum
 * ponto ao longo do traço está à vista. Pacote forjado, dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Prop, RegionPoint, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { criarMovel } from './mobilia'
import { muroDoTraco } from './mobilia/muroDeFogo'

const GRID = 50
const SO_ANA: Record<string, string[]> = { ana: ['heroi'] }

function casa(x: number, y: number): RegionPoint {
  return { x: x * GRID, y: y * GRID }
}

/** O muro como a ferramenta o põe (`porMuroDeFogoNoTraco`): a caixa do traço mais meia casa, o traço em frações dela. */
function muro(pontos: RegionPoint[]): Prop {
  const traco = muroDoTraco(pontos, GRID)
  if (traco === null) throw new Error('traço curto demais para virar muro')
  return { ...criarMovel('muroDeFogo', { x: traco.x, y: traco.y }, GRID, 'muro'), width: traco.width, height: traco.height, tracado: traco.tracado }
}

/** Muro reto de 24 casas, de (10, 20) a (34, 20): o centro da caixa fica em (22, 20). */
const MURO_DE_24_CASAS = muro([casa(10, 20), casa(34, 20)])

function cena(heroi: RegionPoint): MapData {
  const ficha: Token = { id: 'heroi', characterId: null, name: 'ficha-heroi', x: heroi.x, y: heroi.y, size: 1, image: null }
  return { ...createEmptyMap('campo', 'Campo', 60, 40, GRID), externa: true, tokens: [ficha], props: [MURO_DE_24_CASAS] }
}

function objetosQueChegam(heroi: RegionPoint, raioEmCasas: number): string[] {
  return filterMapForPlayer(cena(heroi), 'ana', SO_ANA, raioEmCasas * GRID).map.props.map((p) => p.id)
}

describe('o muro de fogo comprido sai pelo traço, não pelo centro da caixa', () => {
  it('a ficha a 2 casas da ponta recebe o muro (o centro da caixa está a 12 casas, fora da visão de 6)', () => {
    expect(objetosQueChegam(casa(10, 18), 6)).toEqual(['muro'])
    // Na outra ponta também, e com o traço junto (é ele que a tela do jogador desenha).
    const recebido = filterMapForPlayer(cena(casa(34, 22)), 'ana', SO_ANA, 6 * GRID).map.props
    expect(recebido.map((p) => p.id)).toEqual(['muro'])
    expect(recebido[0].tracado).toEqual(MURO_DE_24_CASAS.tracado)
    // Visão curta (2,5 casas), a 2 casas do muro e a 3 casas da ponta ao longo dele: nem o centro nem a ponta estão à vista, o trecho da frente está.
    expect(objetosQueChegam(casa(13, 18), 2.5)).toEqual(['muro'])
  })

  it('a ficha longe do muro inteiro não o recebe', () => {
    // A 15 casas da ponta e a 19 do centro, com a visão de 6.
    expect(objetosQueChegam(casa(10, 5), 6)).toEqual([])
    // Ao lado do meio do muro, mas a 7 casas da linha: fora da visão.
    expect(objetosQueChegam(casa(22, 13), 6)).toEqual([])
  })
})
