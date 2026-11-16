/**
 * ABISMO (16/11/2026, `lib/abismo.ts`): segura o passo do jogador e não a
 * visão; salva e abre igual; entra no laço, no clique do Terreno, no cadeado,
 * no Delete e na Borracha geral como o risco do Barranco; vai ao jogador só se
 * ele conhece um pedaço; o fundo que brilha empresta a luz dos carimbos.
 *
 * Geometria (px de mundo, mapa 25 x 25 casas de 40): a boca é o quadrado
 * (400, 400)-(560, 560); a ficha está em (300, 460), à esquerda dela.
 */
import { describe, expect, it } from 'vitest'
import type { Abismo, MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { validateTokenMove } from './moveValidation'
import { deserializeMap, serializeMap } from './mapFile'
import { selectEntitiesInArea, moveAreaSelection } from './areaSelection'
import { selectionFromAreaSelection, selectionToAreaSelection } from './selectionModel'
import { semItensDoTerreno, terrenoNoPonto } from './terrenoNaSelecao'
import { abismosParaJogador, carimbosComOsAbismos, lerAbismos, paredesDosAbismos } from './abismo'

const GRADE = 40
const POSSE = { p1: ['heroi'] }
const HEROI: Token = { id: 'heroi', characterId: null, name: 'heroi', x: 300, y: 460, size: 1, image: null }
const BOCA = [
  { x: 400, y: 400 },
  { x: 560, y: 400 },
  { x: 560, y: 560 },
  { x: 400, y: 560 },
]
const ABISMO: Abismo = { id: 'fenda', pontos: BOCA, brilho: 'brasa' }
const DENTRO = { x: 480, y: 480 }
const DO_OUTRO_LADO = { x: 700, y: 460 }

function cena(extra: Partial<MapData> = {}, token: Token = HEROI): MapData {
  return { ...createEmptyMap('m', 'M', 25, 25, GRADE), tokens: [token], abismos: [ABISMO], ...extra }
}

function arrastar(map: MapData, para: { x: number; y: number }, isHost = false) {
  return validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: para.x, y: para.y }, POSSE, { isHost })
}

describe('abismo segura o passo do jogador, não a visão', () => {
  it('a ficha do jogador não entra nem atravessa; o mestre passa; a que está dentro sai', () => {
    expect(arrastar(cena(), DENTRO)).toEqual({ ok: false, reason: 'abismo' })
    expect(arrastar(cena(), DO_OUTRO_LADO)).toEqual({ ok: false, reason: 'abismo' })
    // Sem abismo, o mesmo passo anda (a recusa é do buraco e de mais nada).
    expect(arrastar(cena({ abismos: undefined }), DO_OUTRO_LADO).ok).toBe(true)
    expect(arrastar(cena(), DO_OUTRO_LADO, true).ok).toBe(true)
    expect(arrastar(cena({}, { ...HEROI, x: DENTRO.x, y: DENTRO.y }), { x: 300, y: 460 }).ok).toBe(true)
    // A beira vira parede só de andar: deixa ver.
    const paredes = paredesDosAbismos([ABISMO], 0)
    expect(paredes).toHaveLength(4)
    expect(paredes.every((w) => w.blocksMove && !w.blocksLight)).toBe(true)
    // O abismo de outro piso não segura a ficha do térreo.
    expect(arrastar(cena({ abismos: [{ ...ABISMO, piso: 1 }] }), DO_OUTRO_LADO).ok).toBe(true)
  })
})

describe('abismo no arquivo', () => {
  it('salva e abre idêntico; o mapa sem abismo abre sem o campo; o item torto sai', () => {
    const antes = cena({ abismos: [ABISMO, { id: 'poco', pontos: BOCA.map((p) => ({ x: p.x + 400, y: p.y })), piso: 2 }] })
    const reaberto = deserializeMap(serializeMap(antes))
    expect(reaberto.abismos).toEqual(antes.abismos)
    expect(serializeMap(deserializeMap(serializeMap(antes)))).toBe(serializeMap(antes))
    expect('abismos' in deserializeMap(serializeMap(cena({ abismos: undefined })))).toBe(false)
    expect(lerAbismos([{ id: 'a', pontos: BOCA.slice(0, 2) }, { id: 'b', pontos: BOCA, brilho: 'roxo' }, 'lixo', { id: 'b', pontos: BOCA }])).toEqual([{ id: 'b', pontos: BOCA }])
  })
})

describe('abismo na seleção comum, no cadeado e na borracha', () => {
  it('o laço pega a boca, anda com o arrasto e volta pelo modelo de seleção; a camada travada não deixa', () => {
    const map = cena()
    const area = selectEntitiesInArea(map, { x1: 380, y1: 380, x2: 580, y2: 580 })
    expect(area.abismos).toEqual(['fenda'])
    expect(selectionToAreaSelection(selectionFromAreaSelection(area)).abismos).toEqual(['fenda'])
    const andou = moveAreaSelection(map, area, 40, 0)
    expect(andou.abismos?.[0].pontos[0]).toEqual({ x: 440, y: 400 })
    expect(selectEntitiesInArea(cena({ lockedLayers: ['terreno'] }), { x1: 380, y1: 380, x2: 580, y2: 580 }).abismos).toBeUndefined()
  })

  it('o clique do Terreno e a Borracha geral acham o abismo pela boca, com a trava da camada; apagar tira o campo', () => {
    expect(terrenoNoPonto(cena(), 0, DENTRO, true)).toEqual({ acerto: { kind: 'abismo', id: 'fenda' }, travada: null })
    expect(terrenoNoPonto(cena({ lockedLayers: ['terreno'] }), 0, DENTRO, true)?.travada).toBe('terreno')
    expect(terrenoNoPonto(cena(), 0, { x: 300, y: 300 }, true)).toBeNull()
    const semNada = semItensDoTerreno(cena(), new Set(), new Set(), new Set(['fenda']))
    expect('abismos' in semNada).toBe(false)
  })
})

describe('abismo no recorte do jogador e na luz', () => {
  it('vai inteiro só se ele conhece um pedaço, do piso dele, fora do escondido', () => {
    const conheceOCanto = (p: { x: number; y: number }) => p.x <= 420 && p.y <= 420
    expect(abismosParaJogador([ABISMO], 0, GRADE, conheceOCanto, () => false)).toEqual([ABISMO])
    expect(abismosParaJogador([ABISMO], 0, GRADE, () => false, () => false)).toBeUndefined()
    expect(abismosParaJogador([ABISMO], 1, GRADE, () => true, () => false)).toBeUndefined()
    expect(abismosParaJogador([ABISMO], 0, GRADE, () => true, () => true)).toBeUndefined()
  })

  it('o brilho empresta a luz da fenda em brasa; sem brilho, a própria lista de carimbos', () => {
    const carimbos = [{ tipo: 'musgo', x: 10, y: 10 }]
    expect(carimbosComOsAbismos(carimbos, [{ ...ABISMO, brilho: undefined }], GRADE)).toBe(carimbos)
    const abismos = [ABISMO]
    const comLuz = carimbosComOsAbismos(carimbos, abismos, GRADE)
    expect(comLuz?.some((c) => c.tipo === 'fenda-em-brasa')).toBe(true)
    expect(carimbosComOsAbismos(carimbos, abismos, GRADE)).toBe(comLuz)
  })
})
