/**
 * O CARIMBO QUE ILUMINA (lote C6 de 14/11/2026: os cogumelos que brilham e a
 * rocha vulcânica, `LUZ_DOS_CARIMBOS` em `lib/luzDoFogo.ts`). Prova: os do
 * mesmo tipo numa célula de 3 x 3 casas viram um ponto de luz só, no centro
 * de massa, com força e alcance reforçados; tipo de outro tom fica à parte; o
 * que não ilumina não entra; o teto de pontos por tela. E no recorte do
 * jogador, de noite, o claro do cogumelo revela quem está nele, e o mesmo
 * cogumelo numa sala secreta não revela nada. Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { Carimbo, MapData, Region, Token } from '../types/map'
import { TETO_DE_LUZES_DE_CARIMBO, luzesDosCarimbos, raioDaLuzDosCarimbos, type CarimboQueIlumina } from './luzDoFogo'
import { filterMapForPlayer, raioDaNoite } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
/** A célula que junta os carimbos: 3 casas = 150 px nesta grade. */
const CELULA = 3 * GRID

const ponto = (tipo: string, x: number, y: number): CarimboQueIlumina => ({ tipo, x, y })

describe('luzesDosCarimbos: um ponto de luz por célula e por tipo', () => {
  it('quatro cogumelos na célula viram um ponto reforçado; a rocha ao lado fica à parte; pinheiro e "constructor" não acendem; o teto corta o resto', () => {
    const pontos = luzesDosCarimbos(
      [
        ponto('cogumelos-que-brilham', 10, 10),
        ponto('cogumelos-que-brilham', 20, 10),
        ponto('cogumelos-que-brilham', 30, 40),
        ponto('cogumelos-que-brilham', 40, 20),
        ponto('rocha-vulcanica', 50, 50),
        ponto('pinheiro', 60, 60),
        ponto('constructor', 70, 70),
        ponto('cogumelos-que-brilham', 400, 10),
      ],
      GRID,
    )
    expect(pontos.map((p) => [p.id, p.quantos])).toEqual([
      ['carimbos:cogumelos-que-brilham:0,0', 4],
      // Empate em 1: pela chave, para as duas telas escolherem os mesmos.
      ['carimbos:cogumelos-que-brilham:2,0', 1],
      ['carimbos:rocha-vulcanica:0,0', 1],
    ])
    const [cheio, sozinho, rocha] = pontos
    expect([cheio.x, cheio.y]).toEqual([25, 20])
    // 4 = duas dobras: + 0,5 casa no alcance (1,5 -> 2,5); força 0,55 x (1 + 0,25 x 3).
    expect(cheio.alcanceEmCasas).toBeCloseTo(2.5)
    expect(cheio.forca).toBeCloseTo(0.9625)
    expect(raioDaLuzDosCarimbos(cheio, GRID)).toBeCloseTo(125)
    expect(cheio.treme).toBe(false)
    expect([sozinho.alcanceEmCasas, sozinho.forca]).toEqual([1.5, 0.55])
    expect(rocha).toMatchObject({ x: 50, y: 50, alcanceEmCasas: 1.5, forca: 0.6, cor: 0xffd29c, treme: true })

    // O spray solta centenas: só as `TETO_DE_LUZES_DE_CARIMBO` células passam.
    const espalhados = Array.from({ length: TETO_DE_LUZES_DE_CARIMBO + 8 }, (_, i) => ponto('cogumelos-que-brilham', i * CELULA + 1, 1))
    expect(luzesDosCarimbos(espalhados, GRID)).toHaveLength(TETO_DE_LUZES_DE_CARIMBO)
  })
})

const HEROI = { x: 1000, y: 1000 }
/** 3 casas: o raio da noite (a visão cheia do dia nesta cena é o dobro, 6 casas). */
const noite = raioDaNoite(() => 3 * GRID)
const SO_ANA: Record<string, string[]> = { ana: ['heroi'] }

function ficha(id: string, onde: { x: number; y: number }): Token {
  return { id, characterId: null, name: `ficha-${id}`, x: onde.x, y: onde.y, size: 1, image: null }
}

/** Ponto a `casasX`, `casasY` do herói. */
function a(casasX: number, casasY = 0): { x: number; y: number } {
  return { x: HEROI.x + casasX * GRID, y: HEROI.y + casasY * GRID }
}

/** Uma sala secreta de 1 casa em volta do ponto (o guarda, 1 casa ao sul, fica fora dela). */
function salaSecretaEm(centro: { x: number; y: number }): Region {
  const meia = GRID / 2
  return {
    id: 'cofre',
    tag: 'region',
    fillColor: '#444444',
    fillPattern: 'solid',
    data: {},
    secret: true,
    room: { shape: 'rect', name: 'Cofre' },
    points: [
      { x: centro.x - meia, y: centro.y - meia },
      { x: centro.x + meia, y: centro.y - meia },
      { x: centro.x + meia, y: centro.y + meia },
      { x: centro.x - meia, y: centro.y + meia },
    ],
  }
}

/** O carimbo a 5 casas do herói (fora do raio da noite) e o guarda a 1 casa dele (dentro do claro de 1,5 casa). */
function clareira(tipo: string, regions: Region[] = []): MapData {
  const carimbo: Carimbo = { id: 'c1', tipo, ...a(5), tamanho: 20, giro: 0 }
  return {
    ...createEmptyMap('clareira', 'Clareira', 120, 40, GRID),
    externa: true,
    tokens: [ficha('heroi', HEROI), ficha('guarda', a(5, 1))],
    regions,
    carimbos: [carimbo],
  }
}

function fichasQueChegam(map: MapData): string[] {
  return filterMapForPlayer(map, 'ana', SO_ANA, noite)
    .map.tokens.map((t) => t.id)
    .sort()
}

describe('no recorte do jogador, de noite, o carimbo que ilumina clareia como o fogo', () => {
  it('o claro do cogumelo revela o guarda; o pinheiro não clareia, e o cogumelo numa sala secreta também não', () => {
    expect(fichasQueChegam(clareira('cogumelos-que-brilham'))).toEqual(['guarda', 'heroi'])
    expect(fichasQueChegam(clareira('pinheiro'))).toEqual(['heroi'])
    expect(fichasQueChegam(clareira('cogumelos-que-brilham', [salaSecretaEm(a(5))]))).toEqual(['heroi'])
  })
})
