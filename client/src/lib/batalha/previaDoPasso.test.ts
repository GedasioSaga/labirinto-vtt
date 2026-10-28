/**
 * B6 (docs/planos/modo-batalha-2026-10-24.md): a prévia do jogador, feita no
 * cliente sobre o recorte dele, dá o mesmo veredito, a mesma casa e os mesmos
 * blocos do host quando o caminho não encosta em parede fora do recorte. E,
 * para a prova ter dente: com a parede invisível no caminho, o host para antes
 * (é o esbarrão que a tela avisa).
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../mapFactory'
import { validateTokenMove } from '../moveValidation'
import type { MapData, Token } from '../../types/map'
import { GRID, inteiro, parede, sorteador } from './batalha.fixture'
import { centroDaCasa, type Casa } from './blocos'
import { previaDoPassoEmBatalha } from './previaDoPasso'

const COLUNAS = 24
const LINHAS = 14
/** As paredes que a Lia conhece: estão no recorte dela e no host. */
const CONHECIDAS = [parede('p1', 4, 2, 4, 7), parede('p2', 7, 9, 12, 9), parede('p3', 9, 3, 9, 6)]
/** Só o host tem: na coluna 20, longe de todo caminho sorteado (colunas 0 a 12). */
const INVISIVEL = parede('invisivel', 20, 0, 20, LINHAS)

function ficha(id: string, casa: Casa): Token {
  const centro = centroDaCasa(casa, GRID)
  return { id, characterId: null, name: id, x: centro.x, y: centro.y, size: 1, image: null }
}

function mapa(walls: MapData['walls'], tokens: Token[]): MapData {
  return { ...createEmptyMap('mapa-previa', 'Prévia', COLUNAS, LINHAS, GRID), walls, tokens, movement: { tokensOccupy: true } }
}

/** O host como `hostSession` chama: todas as paredes no mapa, o recorte da Lia como `paredesDoJogador`. */
function passoNoHost(host: MapData, recorte: MapData, para: Casa) {
  const alvo = centroDaCasa(para, GRID)
  return validateTokenMove(host, { playerId: 'ana', tokenId: 'lia', x: alvo.x, y: alvo.y }, { ana: ['lia'] }, {
    occupants: recorte.tokens,
    batalha: { paredesDoJogador: recorte.walls },
  })
}

describe('prévia do passo em batalha (B6)', () => {
  it('50 de 50 movimentos sem parede fora do recorte: prévia = host', () => {
    const rnd = sorteador(20261028)
    const iguais: number[] = []
    for (let k = 0; k < 50; k += 1) {
      const de = { col: inteiro(rnd, 0, 12), row: inteiro(rnd, 0, LINHAS - 1) }
      const para = { col: inteiro(rnd, 0, 12), row: inteiro(rnd, 0, LINHAS - 1) }
      const tokens = [ficha('lia', de), ficha('goblin', { col: 11, row: 1 })]
      const recorte = mapa(CONHECIDAS, tokens)
      const host = mapa([...CONHECIDAS, INVISIVEL], tokens)
      const previa = previaDoPassoEmBatalha(recorte, 'lia', centroDaCasa(para, GRID))
      // Tudo o que o host responde (veredito, casa, blocos) a prévia diz igual; ela leva a mais só o caminho que desenha.
      expect({ k, previa }).toMatchObject({ k, previa: passoNoHost(host, recorte, para) })
      if (previa.ok) expect((previa.caminho?.length ?? 0) - 1).toBe(previa.blocos)
      iguais.push(k)
    }
    expect(iguais).toHaveLength(50)
  })

  it('a parede invisível no caminho: o host para antes da prévia', () => {
    const tokens = [ficha('lia', { col: 18, row: 5 })]
    const recorte = mapa(CONHECIDAS, tokens)
    const host = mapa([...CONHECIDAS, INVISIVEL], tokens)
    const para = { col: 22, row: 5 }
    const previa = previaDoPassoEmBatalha(recorte, 'lia', centroDaCasa(para, GRID))
    const noHost = passoNoHost(host, recorte, para)
    expect(previa).toMatchObject({ ok: true, blocos: 4 })
    expect(noHost).toMatchObject({ ok: true, blocos: 1, ...centroDaCasa({ col: 19, row: 5 }, GRID) })
  })
})
