import { describe, expect, it } from 'vitest'
import {
  eixoMaisProximo,
  endireitarNoMapa,
  endireitarPolilinha,
  endireitarSegmento,
  haAlgoParaEndireitar,
  jaEstaReta,
} from './endireitar'
import { addDoorOnWall, createEmptyMap } from './mapFactory'
import { buildLineDrawing, buildPathDrawing, buildWallFromDraft } from './drawingFactory'
import type { Drawing, LayerId, MapData, Wall } from '../types/map'
import type { SelectionKind } from '../types/tools'
import type { SelectionSet } from './selectionModel'

/**
 * Pedido 5 (PEDIDOS.md, 30/09/2026): "depois que eu faço uma linha seria legal
 * eu poder alinhar ela mesmo depois de feita apertando alt, para ela ficar em
 * angulos retos". Aqui só a geometria e as regras de quem entra; o Alt e o
 * Ctrl+Z ficam em toqueDeAlt.test.ts e mapStore.endireitar.test.ts.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { ...buildWallFromDraft(id, { x: x1, y: y1 }, { x: x2, y: y2 }), ...extra }
}

function linha(id: string, x1: number, y1: number, x2: number, y2: number): Drawing {
  return buildLineDrawing(id, { x: x1, y: y1 }, { x: x2, y: y2 }, '#ffffff', 2)
}

function mapa(conteudo: { walls?: Wall[]; drawings?: Drawing[]; lockedLayers?: LayerId[] }): MapData {
  return {
    ...createEmptyMap('m_endireitar', 'Endireitar', 30, 20, 64),
    walls: conteudo.walls ?? [],
    drawings: conteudo.drawings ?? [],
    lockedLayers: conteudo.lockedLayers ?? [],
  }
}

function sel(...itens: [SelectionKind, string][]): SelectionSet {
  return itens.map(([kind, id]) => ({ kind, id }))
}

function paredeDe(map: MapData, id: string): Wall {
  const achada = map.walls.find((w) => w.id === id)
  if (achada === undefined) throw new Error(`parede ${id} sumiu`)
  return achada
}

function linhaDe(map: MapData, id: string): { x1: number; y1: number; x2: number; y2: number } {
  const achada = map.drawings.find((d) => d.id === id)
  if (achada === undefined || achada.kind !== 'line') throw new Error(`linha ${id} sumiu`)
  return achada
}

function comprimento(s: { x1: number; y1: number; x2: number; y2: number }): number {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
}

describe('eixoMaisProximo', () => {
  it('mais para deitada fica deitada, mais para em pé fica em pé', () => {
    expect(eixoMaisProximo(100, 10)).toBe('h')
    expect(eixoMaisProximo(-100, 10)).toBe('h')
    expect(eixoMaisProximo(10, 100)).toBe('v')
    expect(eixoMaisProximo(10, -100)).toBe('v')
  })

  it('45 graus exatos é empate, e o empate fica deitado', () => {
    expect(eixoMaisProximo(10, 10)).toBe('h')
    expect(eixoMaisProximo(-10, 10)).toBe('h')
  })
})

describe('endireitarSegmento', () => {
  it('a linha da imagem 5, solta, fica em pé em x=157, com o mesmo tamanho e o mesmo centro', () => {
    const [a, b] = endireitarSegmento({ x: 219, y: 64 }, { x: 95, y: 480 }, 'meio')
    expect(a.x).toBe(157)
    expect(b.x).toBe(157)
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(Math.hypot(124, 416), 9)
    expect((a.y + b.y) / 2).toBeCloseTo(272, 9)
    // O sentido fica: a ponta a continua em cima.
    expect(a.y).toBeLessThan(b.y)
  })

  it('pivô numa ponta: ela fica exatamente onde estava e o eixo dela é copiado', () => {
    const [a, b] = endireitarSegmento({ x: 10, y: 0 }, { x: 64, y: 64 }, 'b')
    expect(b).toEqual({ x: 64, y: 64 })
    expect(a.x).toBe(64)
    expect(a.y).toBeCloseTo(64 - Math.hypot(54, 64), 9)
  })

  it('comprimento zero volta igual, sem NaN', () => {
    const [a, b] = endireitarSegmento({ x: 5, y: 7 }, { x: 5, y: 7 }, 'meio')
    expect(a).toEqual({ x: 5, y: 7 })
    expect(b).toEqual({ x: 5, y: 7 })
  })
})

describe('jaEstaReta', () => {
  it('tolera ruído de ponto flutuante abaixo de 0,01 px', () => {
    expect(jaEstaReta({ x: 0, y: 0 }, { x: 100, y: 0.005 })).toBe(true)
    expect(jaEstaReta({ x: 0, y: 0 }, { x: 100, y: 0.5 })).toBe(false)
    expect(jaEstaReta({ x: 3, y: 0 }, { x: 3, y: 90 })).toBe(true)
  })
})

describe('endireitarPolilinha (Caminho)', () => {
  it('o primeiro ponto fica parado e cada trecho endireita a partir do anterior já endireitado', () => {
    const pontos = endireitarPolilinha([{ x: 0, y: 0 }, { x: 100, y: 8 }, { x: 110, y: 108 }])
    expect(pontos[0]).toEqual({ x: 0, y: 0 })
    expect(pontos[1].y).toBe(0)
    expect(pontos[1].x).toBeCloseTo(Math.hypot(100, 8), 9)
    expect(pontos[2].x).toBe(pontos[1].x)
    expect(pontos[2].y).toBeCloseTo(Math.hypot(10, 100), 9)
  })
})

describe('endireitarNoMapa: Linha solta', () => {
  it('(0,0)-(100,10) solta fica deitada em y=5, centrada em x=50, com o comprimento de antes', () => {
    const r = endireitarNoMapa(mapa({ drawings: [linha('l', 0, 0, 100, 10)] }), sel(['drawing', 'l']))
    const l = linhaDe(r.map, 'l')
    expect(l.y1).toBe(5)
    expect(l.y2).toBe(5)
    expect((l.x1 + l.x2) / 2).toBeCloseTo(50, 9)
    expect(comprimento(l)).toBeCloseTo(Math.hypot(100, 10), 9)
    expect(r.alterados).toBe(1)
  })

  it('45 graus exatos fica deitada', () => {
    const l = linhaDe(endireitarNoMapa(mapa({ drawings: [linha('l', 0, 0, 10, 10)] }), sel(['drawing', 'l'])).map, 'l')
    expect(l.y1).toBe(l.y2)
  })

  it('o sentido é preservado: (100,0)-(0,8) continua indo para a esquerda', () => {
    const l = linhaDe(endireitarNoMapa(mapa({ drawings: [linha('l', 100, 0, 0, 8)] }), sel(['drawing', 'l'])).map, 'l')
    expect(l.y1).toBe(l.y2)
    expect(l.x1).toBeGreaterThan(l.x2)
  })

  it('linha já reta: devolve a MESMA referência de mapa e nada conta como alterado', () => {
    const antes = mapa({ drawings: [linha('l', 0, 40, 200, 40)] })
    const r = endireitarNoMapa(antes, sel(['drawing', 'l']))
    expect(r.map).toBe(antes)
    expect(r.alterados).toBe(0)
  })

  it('linha de comprimento zero: mesma referência, sem NaN', () => {
    const antes = mapa({ drawings: [linha('l', 9, 9, 9, 9)] })
    expect(endireitarNoMapa(antes, sel(['drawing', 'l'])).map).toBe(antes)
  })

  it('a ponta encostada numa parede fica parada e a linha gira em volta dela', () => {
    const antes = mapa({ walls: [parede('w', 0, 0, 0, -100)], drawings: [linha('l', 0, 0, 100, 10)] })
    const l = linhaDe(endireitarNoMapa(antes, sel(['drawing', 'l'])).map, 'l')
    expect([l.x1, l.y1]).toEqual([0, 0])
    expect(l.y2).toBe(0)
    expect(l.x2).toBeCloseTo(Math.hypot(100, 10), 9)
  })
})

describe('endireitarNoMapa: Parede solta e o ponto que fica parado', () => {
  it('ponta b em (64,64) encostada na ponta de outra parede: b fica fixa e a ponta a gira', () => {
    const antes = mapa({ walls: [parede('w', 10, 0, 64, 64), parede('vizinha', 64, 64, 200, 64)] })
    const w = paredeDe(endireitarNoMapa(antes, sel(['wall', 'w'])).map, 'w')
    expect([w.x2, w.y2]).toEqual([64, 64])
    expect(w.x1).toBe(64)
    expect(w.y1).toBeCloseTo(64 - Math.hypot(54, 64), 9)
  })

  it('ponta encostada no MEIO de outra parede (T) também conta como presa: b em (64,32) fica fixa', () => {
    const antes = mapa({ walls: [parede('w', 30, -150, 64, 32), parede('corredor', 0, 32, 128, 32)] })
    const w = paredeDe(endireitarNoMapa(antes, sel(['wall', 'w'])).map, 'w')
    expect([w.x2, w.y2]).toEqual([64, 32])
    expect(w.x1).toBe(64)
    expect(comprimento(w)).toBeCloseTo(Math.hypot(34, 182), 9)
  })

  it('outra parede que TERMINA no meio desta segura o ponto do T: ela gira em volta dele', () => {
    // A divisória termina em (50, 7.5), em cima da parede selecionada.
    const antes = mapa({ walls: [parede('w', 0, 0, 200, 30), parede('divisoria', 50, 7.5, 50, -100)] })
    const w = paredeDe(endireitarNoMapa(antes, sel(['wall', 'w'])).map, 'w')
    expect(w.y1).toBe(7.5)
    expect(w.y2).toBe(7.5)
    expect(Math.min(w.x1, w.x2)).toBeLessThan(50)
    expect(Math.max(w.x1, w.x2)).toBeGreaterThan(50)
    expect(comprimento(w)).toBeCloseTo(Math.hypot(200, 30), 9)
  })

  it('presa nas duas pontas: não muda e conta como presa', () => {
    const antes = mapa({ walls: [parede('w', 0, 0, 100, 20), parede('p', 0, 0, 0, -50), parede('q', 100, 20, 100, 100)] })
    const r = endireitarNoMapa(antes, sel(['wall', 'w']))
    expect(r.map).toBe(antes)
    expect(r.ignorados).toEqual({ presas: 1, travados: 0, sala: 0 })
  })

  it('presa por uma ponta e por um T no meio também é presa nas duas', () => {
    const antes = mapa({
      walls: [parede('w', 0, 0, 200, 30), parede('divisoria', 50, 7.5, 50, -100), parede('fim', 200, 30, 300, 30)],
    })
    const r = endireitarNoMapa(antes, sel(['wall', 'w']))
    expect(r.map).toBe(antes)
    expect(r.ignorados.presas).toBe(1)
  })

  it('duas paredes selecionadas que se encontram numa ponta continuam se encontrando depois', () => {
    const antes = mapa({ walls: [parede('a', 0, 0, 100, 10), parede('b', 100, 10, 110, 110)] })
    const depois = endireitarNoMapa(antes, sel(['wall', 'a'], ['wall', 'b'])).map
    const a = paredeDe(depois, 'a')
    const b = paredeDe(depois, 'b')
    expect([a.x2, a.y2]).toEqual([100, 10])
    expect([b.x1, b.y1]).toEqual([100, 10])
    expect(a.y1).toBe(a.y2)
    expect(b.x1).toBe(b.x2)
  })

  it('vizinha em outro piso não conta como encostada: gira em volta do meio', () => {
    const antes = mapa({ walls: [parede('w', 0, 0, 100, 10), parede('em_cima', 100, 10, 100, 200, { piso: 1 })] })
    const w = paredeDe(endireitarNoMapa(antes, sel(['wall', 'w'])).map, 'w')
    expect(w.y1).toBe(5)
    expect(w.y2).toBe(5)
  })
})

describe('endireitarNoMapa: quem fica de fora', () => {
  it('parede de sala (regionId) não muda e conta como sala', () => {
    const antes = mapa({ walls: [parede('w', 0, 0, 100, 10, { regionId: 'sala1', regionEdgeIndex: 0 })] })
    const r = endireitarNoMapa(antes, sel(['wall', 'w']))
    expect(r.map).toBe(antes)
    expect(r.ignorados).toEqual({ presas: 0, travados: 0, sala: 1 })
  })

  it('parede travada (locked) não muda e conta como travada', () => {
    const antes = mapa({ walls: [parede('w', 0, 0, 100, 10, { locked: true })] })
    const r = endireitarNoMapa(antes, sel(['wall', 'w']))
    expect(r.map).toBe(antes)
    expect(r.ignorados).toEqual({ presas: 0, travados: 1, sala: 0 })
  })

  it('camada travada: a linha não muda (Linha não tem campo locked, a trava é da camada)', () => {
    const antes = mapa({ drawings: [linha('l', 0, 0, 100, 10)], lockedLayers: ['anotacoes'] })
    const r = endireitarNoMapa(antes, sel(['drawing', 'l']))
    expect(r.map).toBe(antes)
    expect(r.ignorados.travados).toBe(1)
  })

  it('camada Paredes travada: a parede solta não muda', () => {
    const antes = mapa({ walls: [parede('w', 0, 0, 100, 10)], lockedLayers: ['paredes'] })
    const r = endireitarNoMapa(antes, sel(['wall', 'w']))
    expect(r.map).toBe(antes)
    expect(r.ignorados.travados).toBe(1)
  })

  it('travado que já está reto não conta: não há o que avisar', () => {
    const antes = mapa({ walls: [parede('w', 0, 0, 100, 0, { locked: true })] })
    expect(endireitarNoMapa(antes, sel(['wall', 'w'])).ignorados).toEqual({ presas: 0, travados: 0, sala: 0 })
  })

  it('outros tipos selecionados (curva, polígono, ficha) passam sem mudar e sem contar', () => {
    const curva: Drawing = { id: 'c', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 50, y: 30 }, { x: 100, y: 10 }], color: '#fff', width: 2 }
    const antes = mapa({ drawings: [curva] })
    const r = endireitarNoMapa(antes, sel(['drawing', 'c'], ['token', 't1'], ['region', 'r1']))
    expect(r.map).toBe(antes)
    expect(r.ignorados).toEqual({ presas: 0, travados: 0, sala: 0 })
  })

  it('id selecionado que não existe mais (o jogador apagou, o Ctrl+Z tirou) passa sem quebrar', () => {
    const antes = mapa({ drawings: [linha('l', 0, 0, 100, 10)] })
    const r = endireitarNoMapa(antes, sel(['wall', 'sumiu'], ['drawing', 'sumiu']))
    expect(r.map).toBe(antes)
    expect(r.ignorados).toEqual({ presas: 0, travados: 0, sala: 0 })
  })

  it('seleção mista: a linha solta endireita e a parede presa fica, contada', () => {
    const antes = mapa({
      walls: [parede('w', 0, 0, 100, 20), parede('p', 0, 0, 0, -50), parede('q', 100, 20, 100, 100)],
      drawings: [linha('l', 300, 0, 400, 10)],
    })
    const r = endireitarNoMapa(antes, sel(['wall', 'w'], ['drawing', 'l']))
    expect(r.alterados).toBe(1)
    expect(r.ignorados.presas).toBe(1)
    expect(paredeDe(r.map, 'w')).toBe(paredeDe(antes, 'w'))
    expect(linhaDe(r.map, 'l').y1).toBe(linhaDe(r.map, 'l').y2)
  })
})

describe('endireitarNoMapa: parede com porta gira inteira', () => {
  /** Parede solta inclinada de (0,0) a (300,40) com uma porta de 32 px no meio:
   *  `addDoorOnWall` troca a parede por 3 pedaços colineares (antes, porta, depois). */
  function paredeComPorta(extra: Wall[] = [], lockedLayers: LayerId[] = []): { map: MapData; antes: Wall; porta: Wall; depois: Wall } {
    const base = mapa({ walls: [parede('w', 0, 0, 300, 40), ...extra], lockedLayers })
    const map = addDoorOnWall(base, 'w', { x: 150, y: 20 }, 32, 'normal')
    const pedacos = map.walls.filter((w) => !extra.some((e) => e.id === w.id))
    const porta = pedacos.find((w) => w.door !== null)
    const outros = pedacos.filter((w) => w.door === null).sort((p, q) => p.x1 - q.x1)
    if (porta === undefined || outros.length !== 2) throw new Error('a porta não partiu a parede em 3')
    return { map, antes: outros[0], porta, depois: outros[1] }
  }

  function pedacosEmFila(map: MapData, ids: string[]): Wall[] {
    return ids.map((id) => paredeDe(map, id))
  }

  it('selecionar só a porta endireita os 3 pedaços numa reta só, emendados, com a porta do mesmo tamanho', () => {
    const { map, antes, porta, depois } = paredeComPorta()
    const r = endireitarNoMapa(map, sel(['wall', porta.id]))
    const [a, p, d] = pedacosEmFila(r.map, [antes.id, porta.id, depois.id])
    for (const w of [a, p, d]) {
      expect(w.y1).toBe(20)
      expect(w.y2).toBe(20)
    }
    expect([a.x2, a.y2]).toEqual([p.x1, p.y1])
    expect([p.x2, p.y2]).toEqual([d.x1, d.y1])
    expect(comprimento(p)).toBeCloseTo(32, 9)
    expect(d.x2 - a.x1).toBeCloseTo(Math.hypot(300, 40), 9)
    expect(r.alterados).toBe(3)
    expect(r.ignorados).toEqual({ presas: 0, travados: 0, sala: 0 })
  })

  it('selecionar só um pedaço de fora também leva a porta junto: nada de zigue-zague', () => {
    const { map, antes, porta, depois } = paredeComPorta()
    const r = endireitarNoMapa(map, sel(['wall', antes.id]))
    const [a, p, d] = pedacosEmFila(r.map, [antes.id, porta.id, depois.id])
    expect(new Set([a.y1, a.y2, p.y1, p.y2, d.y1, d.y2])).toEqual(new Set([20]))
    expect(r.ignorados.presas).toBe(0)
  })

  it('os 3 pedaços selecionados contam uma corrente só, endireitada uma vez', () => {
    const { map, antes, porta, depois } = paredeComPorta()
    const r = endireitarNoMapa(map, sel(['wall', antes.id], ['wall', porta.id], ['wall', depois.id]))
    expect(r.alterados).toBe(3)
    expect(paredeDe(r.map, porta.id).y1).toBe(20)
  })

  it('com a ponta da parede encostada em outra, a corrente inteira gira em volta dessa ponta', () => {
    const { map, antes, porta, depois } = paredeComPorta([parede('ancora', 0, 0, 0, -100)])
    const r = endireitarNoMapa(map, sel(['wall', porta.id]))
    const [a, p, d] = pedacosEmFila(r.map, [antes.id, porta.id, depois.id])
    expect([a.x1, a.y1]).toEqual([0, 0])
    expect(new Set([a.y2, p.y1, p.y2, d.y1, d.y2])).toEqual(new Set([0]))
  })

  it('camada Portas travada: a corrente inteira fica, contada como travada', () => {
    const { map, antes } = paredeComPorta([], ['portas'])
    const r = endireitarNoMapa(map, sel(['wall', antes.id]))
    expect(r.map).toBe(map)
    expect(r.ignorados).toEqual({ presas: 0, travados: 1, sala: 0 })
  })
})

describe('endireitarNoMapa: Caminho', () => {
  it('endireita trecho a trecho a partir do primeiro ponto', () => {
    const caminho = buildPathDrawing('c', [{ x: 0, y: 0 }, { x: 100, y: 8 }, { x: 110, y: 108 }], '#8a6a45', 1, 64)
    const r = endireitarNoMapa(mapa({ drawings: [caminho] }), sel(['drawing', 'c']))
    const depois = r.map.drawings[0]
    if (depois.kind !== 'path') throw new Error('o caminho mudou de tipo')
    expect(depois.points[0]).toEqual({ x: 0, y: 0 })
    expect(depois.points[1].y).toBe(0)
    expect(depois.points[2].x).toBe(depois.points[1].x)
    expect(r.alterados).toBe(1)
  })

  it('caminho já reto: mesma referência', () => {
    const caminho = buildPathDrawing('c', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 90 }], '#8a6a45', 1, 64)
    const antes = mapa({ drawings: [caminho] })
    expect(endireitarNoMapa(antes, sel(['drawing', 'c'])).map).toBe(antes)
  })
})

describe('haAlgoParaEndireitar (o Alt age ou fica mudo)', () => {
  it('seleção vazia, linha reta ou parede de sala: mudo', () => {
    const m = mapa({
      walls: [parede('sala', 0, 0, 100, 10, { regionId: 'r', regionEdgeIndex: 0 })],
      drawings: [linha('reta', 0, 50, 100, 50)],
    })
    expect(haAlgoParaEndireitar(m, [])).toBe(false)
    expect(haAlgoParaEndireitar(m, sel(['drawing', 'reta']))).toBe(false)
    expect(haAlgoParaEndireitar(m, sel(['wall', 'sala']))).toBe(false)
  })

  it('linha torta solta: age', () => {
    expect(haAlgoParaEndireitar(mapa({ drawings: [linha('l', 0, 0, 100, 10)] }), sel(['drawing', 'l']))).toBe(true)
  })

  it('parede torta presa nas duas pontas, ou linha torta travada: age, para o aviso explicar por que ficou', () => {
    const presa = mapa({ walls: [parede('w', 0, 0, 100, 20), parede('p', 0, 0, 0, -50), parede('q', 100, 20, 100, 100)] })
    expect(haAlgoParaEndireitar(presa, sel(['wall', 'w']))).toBe(true)
    const travada = mapa({ drawings: [linha('l', 0, 0, 100, 10)], lockedLayers: ['anotacoes'] })
    expect(haAlgoParaEndireitar(travada, sel(['drawing', 'l']))).toBe(true)
  })

  it('diz o mesmo que endireitarNoMapa: age exatamente quando ele mudaria ou avisaria algo', () => {
    // O atalho barato (sem procurar encostos) não pode divergir da conta inteira.
    const m = mapa({
      walls: [
        parede('solta', 0, 0, 100, 10),
        parede('presa', 0, 300, 100, 320),
        parede('p', 0, 300, 0, 250),
        parede('q', 100, 320, 100, 400),
        parede('reta', 500, 0, 600, 0),
        parede('travada', 500, 100, 600, 130, { locked: true }),
        parede('sala', 700, 0, 800, 10, { regionId: 'r', regionEdgeIndex: 0 }),
      ],
      drawings: [linha('l', 0, 600, 40, 700), linha('lr', 0, 800, 90, 800)],
    })
    const casos: SelectionSet[] = [
      [],
      sel(['wall', 'solta']),
      sel(['wall', 'presa']),
      sel(['wall', 'reta']),
      sel(['wall', 'travada']),
      sel(['wall', 'sala']),
      sel(['drawing', 'l']),
      sel(['drawing', 'lr']),
      sel(['wall', 'reta'], ['wall', 'sala'], ['drawing', 'lr']),
    ]
    for (const caso of casos) {
      const r = endireitarNoMapa(m, caso)
      const mudariaOuAvisaria = r.alterados > 0 || r.ignorados.presas > 0 || r.ignorados.travados > 0
      expect(haAlgoParaEndireitar(m, caso)).toBe(mudariaOuAvisaria)
    }
  })
})
