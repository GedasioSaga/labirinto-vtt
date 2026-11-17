/**
 * ABISMO POR PINCEL (17/11/2026, `lib/abismoPintado.ts`): os quadrados cavados
 * viram um abismo de verdade, e tapar no meio deixa uma ILHA: chão de pé em
 * que a ficha fica, que a luz do fundo não acende e que vai ao jogador junto.
 *
 * Geometria (px de mundo, mapa 25 x 25 casas de 40): o buraco são os quadrados
 * de (10, 10) a (14, 14), o mundo (400, 400)-(600, 600); a ilha é o quadrado do
 * meio, (12, 12), com o centro em (500, 500). O herói está em (300, 460), fora.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, RegionPoint, Token } from '../types/map'
import { abismosParaJogador, carimbosComOsAbismos, paredesDosAbismos, pontoNoAbismo, pontoNoContorno } from './abismo'
import { abismoPintadoVazio, abismosDoMapa, bocasDoAbismoPintado, comAbismoPintado, lerAbismoPintado, pincelarAbismo, type AbismoPintado } from './abismoPintado'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { validateTokenMove } from './moveValidation'

const GRADE = 40
const POSSE = { p1: ['heroi'] }
const HEROI: Token = { id: 'heroi', characterId: null, name: 'heroi', x: 300, y: 460, size: 1, image: null }
const NA_ILHA = { x: 500, y: 500 }
const NO_BURACO = { x: 460, y: 500 }
/** Menor que meia casa: o toque do pincel cava só o quadrado em que cai. */
const UM_QUADRADO = 0.3

function centro(x: number, y: number): RegionPoint {
  return { x: (x + 0.5) * GRADE, y: (y + 0.5) * GRADE }
}

const BLOCO: RegionPoint[] = []
for (let y = 10; y <= 14; y += 1) for (let x = 10; x <= 14; x += 1) BLOCO.push(centro(x, y))

const BASE = createEmptyMap('m', 'M', 25, 25, GRADE)
const CAVADO = pincelarAbismo(abismoPintadoVazio(BASE), BLOCO, UM_QUADRADO, false, 'brasa', 0)
const COM_ILHA = pincelarAbismo(CAVADO, [NA_ILHA], UM_QUADRADO, true, null, 0)

function cena(pintado: AbismoPintado = COM_ILHA, token: Token = HEROI): MapData {
  return comAbismoPintado({ ...BASE, tokens: [token] }, pintado)
}

function arrastar(map: MapData, para: RegionPoint) {
  return validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: para.x, y: para.y }, POSSE, { isHost: false })
}

describe('o pincel cava o buraco e a borracha deixa a ilha', () => {
  it('os quadrados vizinhos viram um abismo só; tapar no meio dá uma ilha de chão', () => {
    expect(CAVADO.quadrados).toHaveLength(25)
    const [inteiro] = bocasDoAbismoPintado(CAVADO)
    expect(bocasDoAbismoPintado(CAVADO)).toHaveLength(1)
    expect(inteiro).toMatchObject({ id: 'pintado:0:10,10', brilho: 'brasa' })
    expect(inteiro.ilhas).toBeUndefined()
    expect(pontoNoAbismo(inteiro, NA_ILHA)).toBe(true)

    expect(COM_ILHA.quadrados).toHaveLength(24)
    const [boca] = bocasDoAbismoPintado(COM_ILHA)
    expect(boca.ilhas).toHaveLength(1)
    expect(pontoNoAbismo(boca, NA_ILHA)).toBe(false)
    expect(pontoNoAbismo(boca, NO_BURACO)).toBe(true)
    expect(pontoNoAbismo(boca, HEROI)).toBe(false)
    // A mesma entrada devolve a MESMA lista (as paredes e a luz guardam cache por ela).
    expect(bocasDoAbismoPintado(COM_ILHA)).toBe(bocasDoAbismoPintado(COM_ILHA))
    expect(abismosDoMapa(cena())).toBe(abismosDoMapa(cena()))
  })

  it('cavar sem nada novo e tapar fora do buraco devolvem o MESMO abismo; o brilho é do buraco inteiro', () => {
    expect(pincelarAbismo(CAVADO, [NO_BURACO], UM_QUADRADO, false, 'brasa', 0)).toBe(CAVADO)
    expect(pincelarAbismo(CAVADO, [HEROI], UM_QUADRADO, true, null, 0)).toBe(CAVADO)
    const verde = pincelarAbismo(CAVADO, [NO_BURACO], UM_QUADRADO, false, 'verde', 0)
    expect(verde.quadrados.every((c) => c.brilho === 'verde')).toBe(true)
    // O último quadrado tapado tira o campo do mapa.
    expect(comAbismoPintado(cena(), pincelarAbismo(COM_ILHA, BLOCO, UM_QUADRADO, true, null, 0)).abismoPintado).toBeUndefined()
  })
})

describe('o abismo pintado segura o passo, e a ilha é chão', () => {
  it('a ficha do jogador não entra no buraco; a que está na ilha fica nela e anda nela', () => {
    expect(arrastar(cena(), NO_BURACO)).toEqual({ ok: false, reason: 'abismo' })
    expect(arrastar(cena(), NA_ILHA)).toEqual({ ok: false, reason: 'abismo' })
    const naIlha = cena(COM_ILHA, { ...HEROI, ...NA_ILHA })
    expect(arrastar(naIlha, { x: 504, y: 497 }).ok).toBe(true)
    expect(arrastar(naIlha, NO_BURACO)).toEqual({ ok: false, reason: 'abismo' })
    expect(arrastar(naIlha, HEROI)).toEqual({ ok: false, reason: 'abismo' })
  })

  it('a beira da ilha é parede de andar que não tapa a visão', () => {
    const [boca] = bocasDoAbismoPintado(COM_ILHA)
    const paredes = paredesDosAbismos([boca], 0)
    const daIlha = paredes.filter((w) => w.id.includes(':ilha0:'))
    expect(daIlha).toHaveLength(boca.ilhas?.[0].length ?? 0)
    expect(paredes.every((w) => w.blocksMove && !w.blocksLight)).toBe(true)
  })
})

describe('o abismo pintado no arquivo, no recorte do jogador e na luz', () => {
  it('salva e abre igual; o quadrado torto sai e o resto fica', () => {
    expect(deserializeMap(serializeMap(cena())).abismoPintado).toEqual(COM_ILHA)
    const torto = { quadrado: GRADE, origem: { x: 0, y: 0 }, quadrados: [{ x: 1, y: 2, brilho: 'roxo' }, { x: 1.5, y: 2 }, { x: 1, y: 2 }, 'lixo'] }
    expect(lerAbismoPintado(torto)).toEqual({ quadrado: GRADE, origem: { x: 0, y: 0 }, quadrados: [{ x: 1, y: 2 }] })
    expect(lerAbismoPintado({ quadrado: 0, quadrados: [{ x: 1, y: 2 }] })).toBeUndefined()
  })

  it('o jogador recebe o buraco pronto com a ilha, nunca os quadrados; a luz do fundo não acende na ilha', () => {
    // Os quadrados cavados não vazam pelo recorte (contariam o buraco que ele não conhece): o que
    // vai ao jogador é o JSON do recorte, e o campo não pode estar nele.
    expect(JSON.stringify(filterMapForPlayer(cena(), 'p1', POSSE, 400))).not.toContain('abismoPintado')
    // A regra do contornado à mão vale igual: basta conhecer um pedaço, e o buraco vai inteiro, com a ilha.
    const [boca] = bocasDoAbismoPintado(COM_ILHA)
    const conheceOCanto = (p: RegionPoint) => p.x <= 420 && p.y <= 420
    expect(abismosParaJogador(abismosDoMapa(cena()), 0, GRADE, conheceOCanto, () => false)).toEqual([boca])
    expect(abismosParaJogador(abismosDoMapa(cena()), 0, GRADE, () => false, () => false)).toBeUndefined()
    const luzes = (carimbosComOsAbismos(undefined, abismosDoMapa(cena()), GRADE) ?? []).filter((c) => c.tipo === 'fenda-em-brasa')
    expect(luzes.length).toBeGreaterThan(0)
    expect(luzes.filter((c) => pontoNoContorno(boca.ilhas?.[0] ?? [], c))).toEqual([])
  })
})
