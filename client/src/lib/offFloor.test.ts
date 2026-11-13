/**
 * FORA DO CHÃO: LIVRE / BLOQUEADO, por cena (`MapData.offFloor`, pedido do
 * mestre de 12/11/2026: "eu quero me mover fora do chão e ver tudo").
 *
 * LIVRE quer dizer: para limite de visão e de movimento a cena se comporta
 * como a MESMA cena sem nenhuma peça de Chão. As peças continuam no mapa (são
 * pintura), mas não barram visão, arrasto, clique para andar, modo batalha,
 * reunir grupo nem o olhar do guarda. BLOQUEADO e campo ausente: a regra de
 * sempre, que os testes de cada arquivo já prendem.
 *
 * Geometria (px de mundo, mapa 1000 x 1000, grade 40, sem parede): o Chão é
 * a metade esquerda (x de 0 a 500); a ficha fica em (200, 200), dentro dele.
 */
import { describe, expect, it } from 'vitest'
import type { Agua, FloorPiece, MapData, Token } from '../types/map'
import { createExploration, markAll } from './exploration'
import { pointInRing } from './floorContour'
import { filterMapForPlayer } from './fogFilter'
import { gatherSpots, seatChecker } from './gatherParty'
import { caminhoConhecido, type KnownArea } from './knownPath'
import { createEmptyMap } from './mapFactory'
import { validateTokenMove } from './moveValidation'
import { guardSightings } from './npcWatch'
import { chaoQueLimita, foraDoChaoLivre, readOffFloor } from './offFloor'
import { computeVisibility, visionSegments } from './visibility'

const GRADE = 40
const RAIO = 700
const posse = { p1: ['heroi'] }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

const CHAO: FloorPiece = { id: 'chao', shape: { kind: 'rect', cx: 250, cy: 500, w: 500, h: 1000 }, op: 'add', modifiers: {} }
const HEROI = ficha('heroi', 200, 200)
/** Fora do Chão, 300 px além da borda dele. */
const LA_FORA = { x: 800, y: 200 }

function cena(patch: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 25, 25, GRADE), floor: [CHAO], tokens: [HEROI], ...patch }
}

const livre = (patch: Partial<MapData> = {}): MapData => cena({ ...patch, offFloor: 'free' })
const bloqueada = (patch: Partial<MapData> = {}): MapData => cena({ ...patch, offFloor: 'blocked' })
const semChao = (patch: Partial<MapData> = {}): MapData => cena({ ...patch, floor: [] })

function tudoConhecido(): KnownArea {
  const explored = createExploration({ width: 1000, height: 1000, grid: GRADE })
  markAll(explored)
  return { explored, vision: [], concealed: [] }
}

describe('o ponto único: chaoQueLimita', () => {
  it('LIVRE devolve lista vazia (sempre a mesma); bloqueado e ausente devolvem o Chão da cena', () => {
    expect(chaoQueLimita(livre())).toEqual([])
    expect(chaoQueLimita(livre())).toBe(chaoQueLimita(livre({ floor: [] })))
    const antiga = cena()
    expect(chaoQueLimita(antiga)).toBe(antiga.floor)
    const marcada = bloqueada()
    expect(chaoQueLimita(marcada)).toBe(marcada.floor)
    expect([foraDoChaoLivre(livre()), foraDoChaoLivre(antiga), foraDoChaoLivre(marcada)]).toEqual([true, false, false])
  })

  it('valor torto do arquivo é ausente (bloqueado), nunca livre', () => {
    expect([readOffFloor('free'), readOffFloor('blocked')]).toEqual(['free', 'blocked'])
    for (const torto of [true, 1, 'livre', 'FREE', null, undefined, {}]) expect(readOffFloor(torto)).toBeUndefined()
  })
})

describe('LIVRE: a visão passa da borda do Chão', () => {
  it('os obstáculos de visão são os da mesma cena sem Chão; bloqueado e ausente continuam com a borda', () => {
    expect(visionSegments(livre())).toEqual(visionSegments(semChao()))
    expect(visionSegments(cena()).length).toBeGreaterThan(0)
    expect(visionSegments(bloqueada())).toEqual(visionSegments(cena()))
    const olhar = (m: MapData) => computeVisibility(HEROI, visionSegments(m), RAIO)
    expect(pointInRing(LA_FORA, olhar(livre()))).toBe(true)
    expect(pointInRing(LA_FORA, olhar(cena()))).toBe(false)
  })

  it('o recorte do jogador enxerga igual à cena sem Chão, e recebe a ficha que está fora do Chão', () => {
    const tokens = [HEROI, ficha('la-fora', LA_FORA.x, LA_FORA.y)]
    const visto = filterMapForPlayer(livre({ tokens }), 'p1', posse, RAIO)
    expect(JSON.stringify(visto.vision)).toBe(JSON.stringify(filterMapForPlayer(semChao({ tokens }), 'p1', posse, RAIO).vision))
    expect(visto.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'la-fora'])
    // A opção atravessa no recorte: a tela do jogador confere o próprio passo com ela.
    expect(visto.map.offFloor).toBe('free')
    // Bloqueado e ausente: a ficha de fora do Chão continua fora do pacote.
    for (const m of [cena({ tokens }), bloqueada({ tokens })]) {
      expect(filterMapForPlayer(m, 'p1', posse, RAIO).map.tokens.map((t) => t.id)).toEqual(['heroi'])
    }
  })
})

describe('LIVRE: a ficha anda fora do Chão', () => {
  const pedido = { playerId: 'p1', tokenId: 'heroi', x: LA_FORA.x, y: LA_FORA.y }

  it('arrastar para fora do Chão é aceito; bloqueado e ausente recusam com "outside_floor"', () => {
    expect(validateTokenMove(livre(), pedido, posse)).toEqual({ ok: true, x: LA_FORA.x, y: LA_FORA.y })
    expect(validateTokenMove(cena(), pedido, posse)).toEqual({ ok: false, reason: 'outside_floor' })
    expect(validateTokenMove(bloqueada(), pedido, posse)).toEqual({ ok: false, reason: 'outside_floor' })
  })

  it('ficha que já está fora do Chão não é puxada para o Chão mais perto', () => {
    const fora = livre({ tokens: [ficha('heroi', 700, 700)] })
    expect(validateTokenMove(fora, { playerId: 'p1', tokenId: 'heroi', x: 760, y: 700 }, posse)).toEqual({ ok: true, x: 760, y: 700 })
  })

  it('modo batalha: a casa de fora do Chão é destino; bloqueado recusa', () => {
    const batalha = { paredesDoJogador: [] }
    const aceito = validateTokenMove(livre(), pedido, posse, { batalha })
    expect(aceito.ok).toBe(true)
    if (aceito.ok) expect(aceito.x).toBeGreaterThan(500)
    expect(validateTokenMove(cena(), pedido, posse, { batalha })).toEqual({ ok: false, reason: 'outside_floor' })
  })

  it('clicar para andar acha caminho até fora do Chão; bloqueado e ausente não', () => {
    const area = tudoConhecido()
    const caminho = caminhoConhecido(livre(), HEROI, LA_FORA, area)
    expect(caminho.tipo).toBe('caminho')
    if (caminho.tipo === 'caminho') expect(caminho.trechos.at(-1)).toEqual(LA_FORA)
    expect(caminhoConhecido(cena(), HEROI, LA_FORA, area).tipo).toBe('sem-caminho')
    expect(caminhoConhecido(bloqueada(), HEROI, LA_FORA, area).tipo).toBe('sem-caminho')
  })

  it('reunir o grupo senta as fichas em volta do pino de fora do Chão; bloqueado não acha casa lá', () => {
    const casa = { x: 820, y: 220 }
    expect(seatChecker(livre())(casa, 1)).toBe(true)
    expect(seatChecker(cena())(casa, 1)).toBe(false)
    const lugares = gatherSpots(livre(), LA_FORA, [1, 1])
    expect(lugares.every((p) => p !== null && Math.hypot(p.x - LA_FORA.x, p.y - LA_FORA.y) <= 2 * GRADE)).toBe(true)
    expect(gatherSpots(cena(), LA_FORA, [1, 1]).every((p) => p === null || p.x <= 500)).toBe(true)
  })
})

describe('LIVRE: o guarda NPC enxerga além da borda do Chão', () => {
  it('guarda no Chão vê a ficha que está fora dele; bloqueado não vê', () => {
    const guarda = ficha('guarda', 400, 200, { vigia: { direcao: 0, abertura: 90, alcance: 12 } })
    const tokens = [guarda, ficha('heroi', 700, 200)]
    const alvos = new Set(['heroi'])
    expect(guardSightings(livre({ tokens }), alvos).map((v) => v.tokenId)).toEqual(['heroi'])
    expect(guardSightings(cena({ tokens }), alvos)).toEqual([])
  })
})

describe('cena antiga sem o campo, só com pintura de material (pedido de 13/11/2026: "O Token não consegue andar sem chão")', () => {
  // A faixa de calçamento é o Chão da cena; à direita, um lago (a água conta como Chão só na cena bloqueada).
  const PEDRA: FloorPiece = { ...CHAO, id: 'pedra', material: 'calcamento' }
  const LAGO: Agua = { id: 'lago', tipo: 'lago', cor: '#3a7ca5', pontos: [{ x: 600, y: 600 }, { x: 900, y: 600 }, { x: 900, y: 900 }, { x: 600, y: 900 }] }
  const soPintura = (patch: Partial<MapData> = {}): MapData => cena({ floor: [PEDRA], aguas: [LAGO], ...patch })
  const pedido = { playerId: 'p1', tokenId: 'heroi', x: LA_FORA.x, y: LA_FORA.y }

  it('vale livre e a ficha anda fora da pintura; Bloqueado gravado e Chão de antes junto continuam recusando', () => {
    expect(foraDoChaoLivre(soPintura())).toBe(true)
    expect(validateTokenMove(soPintura(), pedido, posse)).toEqual({ ok: true, x: LA_FORA.x, y: LA_FORA.y })
    expect(validateTokenMove(soPintura({ offFloor: 'blocked' }), pedido, posse)).toEqual({ ok: false, reason: 'outside_floor' })
    expect(validateTokenMove(soPintura({ floor: [PEDRA, { ...CHAO, id: 'liso' }] }), pedido, posse)).toEqual({ ok: false, reason: 'outside_floor' })
  })

  it('o recorte do jogador vale o mesmo que o host, também quando ele não vê o Chão de antes', () => {
    expect(foraDoChaoLivre(filterMapForPlayer(soPintura(), 'p1', posse, RAIO).map)).toBe(true)
    // O Chão liso numa zona oculta: o host vale bloqueado, e o recorte, que não leva a peça, também.
    const longe: FloorPiece = { ...CHAO, id: 'liso-longe', shape: { kind: 'rect', cx: 900, cy: 900, w: 100, h: 100 } }
    const zona = { id: 'zona', name: 'Tesouro', revealed: false, points: [{ x: 800, y: 800 }, { x: 1000, y: 800 }, { x: 1000, y: 1000 }, { x: 800, y: 1000 }] }
    const visto = filterMapForPlayer(cena({ floor: [PEDRA, longe], concealZones: [zona] }), 'p1', posse, RAIO).map
    expect(visto.floor.map((f) => f.id)).not.toContain('liso-longe')
    expect(foraDoChaoLivre(visto)).toBe(false)
  })
})
