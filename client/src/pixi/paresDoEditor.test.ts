import { describe, expect, it } from 'vitest'
import type { CamadaId, MapData, MapLine } from '../types/map'
import { FAIXAS_EDITOR } from '../lib/camadas/ordem'
import { CAMADAS_PADRAO } from '../lib/camadas/padrao'
import { buildLightAt, buildRoomFromDraft, buildTextDrawing, buildWallFromDraft } from '../lib/drawingFactory'
import { buildFloorPiece } from '../lib/floorTool'
import { buildBlocosShape } from '../lib/floorBlocks'
import { addDrawing, addFloorPiece, addPin, addRoom, addToken, buildPin, createEmptyMap } from '../lib/mapFactory'
import { criarMovel } from '../lib/mobilia'
import { criarParesDoEditor } from './paresDoEditor'
import { criarPilha, distribuir, type PaiDaPilha } from './pilhaDeCamadas'

class No {
  alpha = 1
  constructor(readonly nome: string) {}
}

class Pai implements PaiDaPilha<No> {
  children: No[] = []
  addChildAt(no: No, indice: number): No {
    const atual = this.children.indexOf(no)
    if (atual === indice) return no
    if (atual >= 0) this.children.splice(atual, 1)
    this.children.splice(indice, 0, no)
    return no
  }
  removeChild(no: No): No {
    const atual = this.children.indexOf(no)
    if (atual >= 0) this.children.splice(atual, 1)
    return no
  }
}

function montarPilha(): { pilha: ReturnType<typeof criarPilha<No>> } {
  const pai = new Pai()
  const bases = new Map(FAIXAS_EDITOR.map((f) => [f.id, new No(f.id)]))
  pai.children.push(...bases.values())
  const pilha = criarPilha<No>({
    pai,
    faixas: FAIXAS_EDITOR,
    base: (faixa) => {
      const no = bases.get(faixa)
      if (no === undefined) throw new Error(`faixa sem nó: ${faixa}`)
      return no
    },
    criar: (plano) => new No(plano.chave),
    descartar: () => undefined,
    alfaProprio: () => 1,
    lerAlfa: (no) => no.alpha,
    definirAlfa: (no, alfa) => {
      no.alpha = alfa
    },
  })
  return { pilha }
}

const LIVRE: CamadaId = 'livre_moveis'
const comLivre = (map: MapData): MapData => ({ ...map, modeloCamadas: { ordem: [...CAMADAS_PADRAO, LIVRE].map((id) => ({ id })) } })

describe('pares do editor', () => {
  it('LIMITACAO ATUAL: fichas, pinos, salas (e o telhado delas), texto e chão com camada escolhida NÃO ganham par (ficam no container de hoje)', () => {
    let map = createEmptyMap('m', 'Mapa', 16, 12, 64)
    map = addToken(map, { id: 't1', characterId: null, name: 'Ana', x: 96, y: 96, size: 1, image: null, camada: LIVRE })
    map = addPin(map, { ...buildPin('p1', { x: 160, y: 160 }, 'exclamacao'), camada: LIVRE })
    const sala = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 64, y: 64 }, { x: 448, y: 384 }, undefined, undefined, 'Sala')
    map = addRoom(map, { ...sala.region, camada: LIVRE, room: { ...(sala.region.room ?? { shape: 'rect', name: 'Sala' }), camadaDoTelhado: LIVRE } }, sala.walls)
    map = addDrawing(map, { ...buildTextDrawing('d1', { x: 200, y: 200 }, '#ffffff', 20), camada: LIVRE })
    const forma = buildBlocosShape(64, [{ col: 1, row: 1 }])
    if (forma === null) throw new Error('sem forma')
    map = addFloorPiece(map, { ...buildFloorPiece('f1', forma, 'add'), camada: LIVRE })
    const pares = criarParesDoEditor()(comLivre(map))
    const faixasDaLivre = pares.filter((par) => par.camada === LIVRE).map((par) => par.faixa)
    // Hoje nenhuma dessas faixas divide itens por nó. Quando a fatia 3b chegar, este teste muda junto.
    expect(faixasDaLivre).toEqual([])
    const { pilha } = montarPilha()
    pilha.atualizar({ modelo: comLivre(map).modeloCamadas ?? { ordem: [] }, alfa: () => 1, pares })
    expect(pilha.criados()).toBe(0)
  })

  it('paredes, portas, linhas, móveis e luzes com camada escolhida ganham par; o texto (renderer próprio) não', () => {
    let map = createEmptyMap('m', 'Mapa', 16, 12, 64)
    map = { ...map, walls: [{ ...buildWallFromDraft('w1', { x: 0, y: 0 }, { x: 64, y: 0 }), camada: LIVRE }] }
    map = { ...map, props: [{ ...criarMovel('mesa', { x: 96, y: 96 }, 64, 'o1'), camada: LIVRE }], lights: [{ ...buildLightAt('l1', { x: 64, y: 64 }, 64), camada: LIVRE }] }
    const faixas = criarParesDoEditor()(comLivre(map)).filter((par) => par.camada === LIVRE).map((par) => par.faixa)
    expect(faixas).toEqual(['wallsGraphics', 'propsContainer', 'lightsContainer'])
  })
})

describe('microbenchmark: atualizar a pilha e distribuir ~1000 itens divididos', () => {
  /** Teto de SEGURANÇA (não meta): 25 ms por mudança na mediana, folga larga para máquina carregada. Medido em 23/10/2026: ver o plano, seção "Fatia 3". */
  const TETO_MS = 25

  function mapaDividido(n: number): MapData {
    const base = comLivre(createEmptyMap('bench', 'Bench', 64, 64, 64))
    const camadaDe = (i: number, padrao: readonly CamadaId[]): CamadaId => (i % 3 === 0 ? LIVRE : padrao[i % padrao.length])
    const walls = Array.from({ length: n * 0.3 }, (_, i) => ({ ...buildWallFromDraft(`w${i}`, { x: i * 8, y: 0 }, { x: i * 8 + 64, y: 0 }), camada: camadaDe(i, ['paredes', 'portas']) }))
    const props = Array.from({ length: n * 0.4 }, (_, i) => ({ ...criarMovel(i % 2 === 0 ? 'mesa' : 'tapete', { x: i * 8, y: 128 }, 64, `o${i}`), camada: camadaDe(i, ['objetos', 'decoracao']) }))
    const lights = Array.from({ length: n * 0.1 }, (_, i) => ({ ...buildLightAt(`l${i}`, { x: i * 16, y: 256 }, 64), camada: camadaDe(i, ['iluminacao']) }))
    const lines: MapLine[] = Array.from({ length: n * 0.2 }, (_, i) => ({ id: `ln${i}`, points: [{ x: i * 8, y: 300 }, { x: i * 8 + 32, y: 300 }], closed: false, dotted: false, color: '#ffffff', width: 2, camada: camadaDe(i, ['paredes', 'portas']) }))
    return { ...base, walls, props, lights, lines, opacidadeDasCamadas: { decoracao: 0.6 } }
  }

  it('mediana de 21 rodadas abaixo do teto, com nós criados de verdade', () => {
    const map = mapaDividido(1000)
    const tempos: number[] = []
    let criados = 0
    for (let rodada = 0; rodada < 21; rodada++) {
      // Lista nova a cada rodada: sem memória dos pares (o pior caso, como uma edição).
      const mapa: MapData = { ...map, walls: [...map.walls], props: [...map.props], lights: [...map.lights], lines: [...map.lines] }
      const { pilha } = montarPilha()
      const paresDoMapa = criarParesDoEditor()
      const inicio = performance.now()
      pilha.atualizar({ modelo: mapa.modeloCamadas ?? { ordem: [] }, alfa: (c) => mapa.opacidadeDasCamadas?.[c] ?? 1, pares: paresDoMapa(mapa) })
      const camadaDe = (item: { camada?: CamadaId }, padrao: CamadaId): CamadaId => item.camada ?? padrao
      distribuir(mapa.walls, pilha.nosDaFaixa('wallsGraphics'), (w) => camadaDe(w, 'paredes'))
      distribuir(mapa.props, pilha.nosDaFaixa('propsContainer'), (p) => camadaDe(p, 'objetos'))
      distribuir(mapa.lights, pilha.nosDaFaixa('lightsContainer'), (l) => camadaDe(l, 'iluminacao'))
      distribuir(mapa.lines, pilha.nosDaFaixa('mapLinesGraphics'), (l) => camadaDe(l, 'paredes'))
      tempos.push(performance.now() - inicio)
      criados = pilha.criados()
    }
    tempos.sort((a, b) => a - b)
    const mediana = tempos[Math.floor(tempos.length / 2)]
    // Registro do número da rodada (vai para o plano); não é depuração.
    console.info(`[microbenchmark camadas] 1000 itens divididos: mediana ${mediana.toFixed(3)} ms, máx ${tempos[tempos.length - 1].toFixed(3)} ms, ${criados} nós criados`)
    expect(criados).toBeGreaterThan(3)
    expect(mediana, `mediana ${mediana} ms`).toBeLessThan(TETO_MS)
  })
})
