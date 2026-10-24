/**
 * ANDAR ATÉ AQUI: o caminho que a tela do jogador calcula usa SÓ o que ele já
 * conhece (memória explorada + visão de agora, fora de zona oculta). O que a
 * névoa esconde não vira atalho: se a única rua passa pelo escuro, não há
 * caminho. E cada trecho do caminho passa, sozinho, na validação do host.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { createExploration, markAll, markRings } from './exploration'
import { moveCrossesWall } from './collision'
import { validateTokenMove } from './moveValidation'
import { caminhoConhecido, findKnownPath, isPointKnown, type KnownArea } from './knownPath'
import type { MapData, RegionPoint, Token, Wall } from '../types/map'

const GRID = 50
/** 20 x 12 células de 50 px: mundo de 1000 x 600. */
const W = 1000
const H = 600

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Prédio fechado no meio da praça: x 400-600, y 150-450. Rua por cima (y < 150) e por baixo (y > 450). */
const PREDIO: Wall[] = [
  parede('n', 400, 150, 600, 150),
  parede('l', 600, 150, 600, 450),
  parede('s', 600, 450, 400, 450),
  parede('o', 400, 450, 400, 150),
]

function praca(): MapData {
  return { ...createEmptyMap('capital', 'Capital', 20, 12, GRID), walls: PREDIO }
}

function retangulo(x1: number, y1: number, x2: number, y2: number): RegionPoint[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

function conhecido(aneis: RegionPoint[][] | 'tudo', extra: Partial<KnownArea> = {}): KnownArea {
  // Em px de mundo, como o host monta a memória (`hostSession`).
  const explored = createExploration({ width: W, height: H, grid: GRID })
  if (aneis === 'tudo') markAll(explored)
  else markRings(explored, aneis)
  return { explored, vision: [], concealed: [], ...extra }
}

const ORIGEM = { x: 300, y: 300 }
const BECO = { x: 700, y: 300 }

/** Pontos a cada 5 px ao longo do caminho inteiro (origem incluída). */
function amostras(de: { x: number; y: number }, caminho: { x: number; y: number }[]): { x: number; y: number }[] {
  const pontos: { x: number; y: number }[] = []
  let a = de
  for (const b of caminho) {
    const passos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5))
    for (let i = 0; i <= passos; i += 1) pontos.push({ x: a.x + ((b.x - a.x) * i) / passos, y: a.y + ((b.y - a.y) * i) / passos })
    a = b
  }
  return pontos
}

describe('findKnownPath: andar até aqui pelas ruas conhecidas', () => {
  it('rua livre: um trecho só, direto ao ponto', () => {
    const caminho = findKnownPath(praca(), ORIGEM, { x: 300, y: 500 }, conhecido('tudo'))
    expect(caminho).toEqual([{ x: 300, y: 500 }])
  })

  it('prédio no meio: dobra as esquinas, nenhum trecho atravessa parede e termina no beco', () => {
    const mapa = praca()
    const caminho = findKnownPath(mapa, ORIGEM, BECO, conhecido('tudo'))
    if (caminho === null) throw new Error('esperava caminho em volta do prédio')
    expect(caminho.length).toBeGreaterThanOrEqual(3)
    expect(caminho.at(-1)).toEqual(BECO)
    let de = ORIGEM
    for (const ponto of caminho) {
      expect(mapa.walls.filter((w) => moveCrossesWall(de, ponto, w))).toEqual([])
      de = ponto
    }
  })

  it('cada trecho, um depois do outro, passa na validação do host (igual no mestre)', () => {
    const mapa = { ...praca(), tokens: [{ id: 'enzo', characterId: null, name: 'Enzo', x: ORIGEM.x, y: ORIGEM.y, size: 1, image: null }] }
    const caminho = findKnownPath(mapa, ORIGEM, BECO, conhecido('tudo'))
    if (caminho === null) throw new Error('esperava caminho')
    let atual = mapa
    for (const ponto of caminho) {
      const x = Math.round(ponto.x)
      const y = Math.round(ponto.y)
      const resultado = validateTokenMove(atual, { playerId: 'p1', tokenId: 'enzo', x, y }, { p1: ['enzo'] })
      expect(resultado).toEqual({ ok: true, x, y })
      atual = { ...atual, tokens: atual.tokens.map((t) => ({ ...t, x, y })) }
    }
    expect(atual.tokens[0]).toMatchObject({ x: BECO.x, y: BECO.y })
  })

  it('área preta (nunca vista): não há caminho', () => {
    // Só a metade esquerda foi explorada; o beco fica no escuro.
    expect(findKnownPath(praca(), ORIGEM, BECO, conhecido([retangulo(0, 0, 500, H)]))).toBeNull()
  })

  it('a única rua passa pelo escuro: não há caminho, mesmo que o chão exista', () => {
    // Conhece os dois lados do prédio, mas nem a rua de cima nem a de baixo.
    const lados = [retangulo(0, 150, 400, 450), retangulo(600, 150, W, 450)]
    expect(findKnownPath(praca(), ORIGEM, BECO, conhecido(lados))).toBeNull()
  })

  it('conhece só a rua de cima: o caminho inteiro fica no que ele conhece', () => {
    const semRuaDeBaixo = [retangulo(0, 0, W, 150), retangulo(0, 150, 400, 450), retangulo(600, 150, W, 450)]
    const area = conhecido(semRuaDeBaixo)
    const caminho = findKnownPath(praca(), ORIGEM, BECO, area)
    if (caminho === null) throw new Error('esperava caminho pela rua de cima')
    const fora = amostras(ORIGEM, caminho).filter((p) => !isPointKnown(area, p))
    expect(fora).toEqual([])
    expect(Math.min(...caminho.map((p) => p.y))).toBeLessThan(150)
    expect(caminho.at(-1)).toEqual(BECO)
  })

  it('zona oculta do mestre conta como escuro, mesmo explorada antes', () => {
    const ocultas = [retangulo(0, 0, W, 150), retangulo(0, 450, W, H)]
    expect(findKnownPath(praca(), ORIGEM, BECO, conhecido('tudo', { concealed: ocultas }))).toBeNull()
    expect(isPointKnown(conhecido('tudo', { concealed: ocultas }), { x: 100, y: 100 })).toBe(false)
  })

  it('a visão de agora vale como conhecido, sem memória nenhuma', () => {
    const area: KnownArea = { explored: undefined, vision: [retangulo(0, 0, W, H)], concealed: [] }
    const caminho = findKnownPath(praca(), ORIGEM, BECO, area)
    expect(caminho?.at(-1)).toEqual(BECO)
    expect(isPointKnown({ explored: undefined, vision: [], concealed: [] }, ORIGEM)).toBe(false)
  })

  it('porta fechada no único acesso: não há caminho; aberta, passa pelo vão', () => {
    // Beco DENTRO do prédio, com porta na parede leste.
    const fechada: Wall[] = [
      parede('n', 400, 150, 600, 150),
      parede('l1', 600, 150, 600, 275),
      { ...parede('porta', 600, 275, 600, 325), door: { open: false, locked: false, kind: 'normal' } },
      parede('l2', 600, 325, 600, 450),
      parede('s', 600, 450, 400, 450),
      parede('o', 400, 450, 400, 150),
    ]
    const dentro = { x: 500, y: 300 }
    const mapaFechado = { ...praca(), walls: fechada }
    expect(findKnownPath(mapaFechado, ORIGEM, dentro, conhecido('tudo'))).toBeNull()
    const aberta = fechada.map((w) => (w.door === null ? w : { ...w, door: { ...w.door, open: true } }))
    const caminho = findKnownPath({ ...praca(), walls: aberta }, ORIGEM, dentro, conhecido('tudo'))
    expect(caminho?.at(-1)).toEqual(dentro)
    expect(Math.max(...(caminho ?? []).map((p) => p.x))).toBeGreaterThan(600)
  })
})

/** O prédio com porta na parede leste: o beco DENTRO dele só se alcança por ela. */
function predioComPorta(estado: { open: boolean; locked: boolean }): Wall[] {
  return [
    parede('n', 400, 150, 600, 150),
    parede('l1', 600, 150, 600, 275),
    { ...parede('porta', 600, 275, 600, 325), door: { ...estado, kind: 'normal' } },
    parede('l2', 600, 325, 600, 450),
    parede('s', 600, 450, 400, 450),
    parede('o', 400, 450, 400, 150),
  ]
}

function custo(de: { x: number; y: number }, caminho: readonly { x: number; y: number }[]): number {
  let total = 0
  let a = de
  for (const b of caminho) {
    total += Math.hypot(b.x - a.x, b.y - a.y)
    a = b
  }
  return total
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

describe('caminhoConhecido: o motor de caminhamento com a máscara do que o jogador conhece', () => {
  it('destino no escuro: sem caminho, com o motivo, sem travar', () => {
    const r = caminhoConhecido(praca(), ORIGEM, BECO, conhecido([retangulo(0, 0, 500, H)]))
    expect(r).toEqual({ tipo: 'sem-caminho', motivo: 'sem-caminho', portas: [] })
  })

  it('destino conhecido atrás de porta TRANCADA: motivo porta-trancada, com a porta', () => {
    const r = caminhoConhecido({ ...praca(), walls: predioComPorta({ open: false, locked: true }) }, ORIGEM, { x: 500, y: 300 }, conhecido('tudo'))
    expect(r).toEqual({ tipo: 'sem-caminho', motivo: 'porta-trancada', portas: ['porta'] })
  })

  it('porta FECHADA destrancada no único acesso: como hoje, não passa (o host recusa o passo); o motivo diz porta-fechada', () => {
    const mapa = { ...praca(), walls: predioComPorta({ open: false, locked: false }) }
    expect(caminhoConhecido(mapa, ORIGEM, { x: 500, y: 300 }, conhecido('tudo'))).toEqual({ tipo: 'sem-caminho', motivo: 'porta-fechada', portas: ['porta'] })
    expect(findKnownPath(mapa, ORIGEM, { x: 500, y: 300 }, conhecido('tudo'))).toBeNull()
  })

  it('fichas NÃO são obstáculo: a rua de cima tapada por fichas continua sendo o caminho (quem decide é o host)', () => {
    const semRuaDeBaixo = [retangulo(0, 0, W, 150), retangulo(0, 150, 400, 450), retangulo(600, 150, W, 450)]
    const tapada = { ...praca(), tokens: [ficha('enzo', ORIGEM.x, ORIGEM.y), ficha('a', 500, 25), ficha('b', 500, 75), ficha('c', 500, 125)] }
    const r = caminhoConhecido(tapada, ORIGEM, BECO, conhecido(semRuaDeBaixo))
    if (r.tipo !== 'caminho') throw new Error(`esperava caminho, veio ${JSON.stringify(r)}`)
    expect(r.trechos.at(-1)).toEqual(BECO)
  })

  it('destino OCUPADO por outra ficha: o caminho chega nele (parar na casa livre é do host, F2)', () => {
    const ocupado = { ...praca(), tokens: [ficha('enzo', ORIGEM.x, ORIGEM.y), ficha('bruno', BECO.x, BECO.y)] }
    const r = caminhoConhecido(ocupado, ORIGEM, BECO, conhecido('tudo'))
    if (r.tipo !== 'caminho') throw new Error(`esperava caminho, veio ${JSON.stringify(r)}`)
    expect(r.trechos.at(-1)).toEqual(BECO)
  })

  it('a máscara vale na perna, no alisado e no traço direto: nenhum ponto amostrado fora do conhecido', () => {
    // Só uma faixa em L conhecida: a reta da origem ao destino corta o escuro.
    const area = conhecido([retangulo(250, 250, 350, H), retangulo(250, 500, 950, H), retangulo(850, 250, 950, H)])
    const r = caminhoConhecido({ ...praca(), walls: [] }, ORIGEM, { x: 900, y: 300 }, area)
    if (r.tipo !== 'caminho') throw new Error(`esperava caminho pela faixa, veio ${JSON.stringify(r)}`)
    expect(amostras(ORIGEM, r.trechos).filter((p) => !isPointKnown(area, p))).toEqual([])
  })
})

describe('regressão: mapas simples chegam ao mesmo destino com o custo de antes', () => {
  // Custo medido no `findKnownPath` antigo (busca paralela, nós de meia casa), em 23/10/2026, antes da troca.
  // O motor anda pelos centros das casas e guarda folga da parede: até 10% a mais é o preço aceito.
  const TOLERANCIA = 1.1
  const zigue: Wall[] = [parede('z1', 300, 0, 300, 450), parede('z2', 700, 150, 700, 600)]
  const casos: { nome: string; mapa: () => MapData; de: { x: number; y: number }; para: { x: number; y: number }; area: () => KnownArea; antes: number }[] = [
    { nome: 'A prédio no meio', mapa: praca, de: ORIGEM, para: BECO, area: () => conhecido('tudo'), antes: 595 },
    { nome: 'B rua livre', mapa: praca, de: ORIGEM, para: { x: 300, y: 500 }, area: () => conhecido('tudo'), antes: 200 },
    { nome: 'C porta aberta', mapa: () => ({ ...praca(), walls: predioComPorta({ open: true, locked: false }) }), de: ORIGEM, para: { x: 500, y: 300 }, area: () => conhecido('tudo'), antes: 673.98 },
    { nome: 'D só a rua de cima', mapa: praca, de: ORIGEM, para: BECO, area: () => conhecido([retangulo(0, 0, W, 150), retangulo(0, 150, 400, 450), retangulo(600, 150, W, 450)]), antes: 593.24 },
    { nome: 'E travessa', mapa: praca, de: { x: 100, y: 100 }, para: { x: 900, y: 550 }, area: () => conhecido('tudo'), antes: 982.71 },
    { nome: 'F zigue-zague', mapa: () => ({ ...praca(), walls: zigue }), de: { x: 150, y: 300 }, para: { x: 850, y: 300 }, area: () => conhecido('tudo'), antes: 960.76 },
  ]
  it.each(casos)('$nome', ({ mapa, de, para, area, antes }) => {
    const r = caminhoConhecido(mapa(), de, para, area())
    if (r.tipo !== 'caminho') throw new Error(`esperava caminho, veio ${JSON.stringify(r)}`)
    expect(r.trechos.at(-1)).toEqual(para)
    expect(custo(de, r.trechos)).toBeLessThanOrEqual(antes * TOLERANCIA)
  })
})
