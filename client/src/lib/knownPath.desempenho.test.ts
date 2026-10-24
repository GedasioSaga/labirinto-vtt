/**
 * DESEMPENHO DO "ANDAR ATÉ AQUI" (F1 de CAMINHOS), pelo mesmo método do
 * `caminhamento/desempenho.test.ts` (meta escrita antes do código):
 * - mapa de 300 x 300 casas do gerador do robô (~18 mil paredes), com as
 *   portas destrancadas abertas (o jogador já passou por elas; a fechada barra
 *   o passo dele e a consulta viraria quase toda "sem caminho");
 * - o jogador lembra o mapa todo e vê um círculo de 64 lados em volta;
 * - montar a malha em fatias (`prepararCaminhoConhecido`, 8 ms como no app):
 *   nenhuma fatia >= 50 ms (a meta da agenda dos NPCs);
 * - consulta inteira (`caminhoConhecido`, com a máscara e a conferência dos
 *   trechos) com a malha pronta: p95 <= 5 ms, e nenhuma >= 50 ms.
 * Cada consulta é medida em passadas separadas; vale o menor, dividido pela
 * lentidão da máquina na passada (a obra de referência de `relogio.fixture.ts`
 * antes e depois). A montagem de uma vez (a primeira consulta sem preparar,
 * outro mapa) sai no console como medida, sem meta.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../pixi/world'
import type { MapData, RegionPoint } from '../types/map'
import { lentidaoEntre, msDaReferencia } from './caminhamento/relogio.fixture'
import { gerarMapaDoRobo, percentil, sorteador } from './caminhamento/robo.fixture'
import { createExploration, markAll } from './exploration'
import { caminhoConhecido, type KnownArea, prepararCaminhoConhecido } from './knownPath'
import { createEmptyMap } from './mapFactory'

const GRID = 64
const LADO = 300
const CONSULTAS = 200
const PASSADAS = 3
const PASSADAS_MAX = 6
const P95_DA_CONSULTA_MS = 5
const LADOS_DA_VISAO = 64
const RAIO_DA_VISAO_CASAS = 12

const FATIA_MS = 8
const FATIA_MAXIMA_MS = 50
const CONSULTA_MAXIMA_MS = 50

const gerado = gerarMapaDoRobo(4242, GRID, false, 1, { largura: LADO, altura: LADO })
const abertas = gerado.mapa.walls.map((w) => (w.door !== null && !w.door.locked ? { ...w, door: { ...w.door, open: true } } : w))
const mapa: MapData = { ...createEmptyMap('grande', 'Grande', LADO, LADO, GRID), walls: abertas }
/** O mesmo mapa com a lista de paredes copiada e uma parede a mais: outra estrutura, a malha é montada de novo. */
const outroMapa: MapData = { ...mapa, walls: [...abertas, { id: 'extra', x1: 0, y1: 0, x2: GRID, y2: 0, blocksLight: true, blocksMove: true, door: null }] }

function pontoSorteado(sorte: () => number): Point {
  return { x: (Math.floor(sorte() * LADO) + 0.5) * GRID, y: (Math.floor(sorte() * LADO) + 0.5) * GRID }
}

function circulo(centro: Point): RegionPoint[] {
  const raio = RAIO_DA_VISAO_CASAS * GRID
  return Array.from({ length: LADOS_DA_VISAO }, (_, i) => {
    const a = (i / LADOS_DA_VISAO) * 2 * Math.PI
    return { x: centro.x + raio * Math.cos(a), y: centro.y + raio * Math.sin(a) }
  })
}

describe('desempenho do "Andar até aqui" (300 x 300 casas)', () => {
  it('consulta com a malha pronta: p95 <= 5 ms', () => {
    // Em px de mundo, como o host monta a memória.
    const explored = createExploration({ width: LADO * GRID, height: LADO * GRID, grid: GRID })
    markAll(explored)
    const sorte = sorteador(7)
    const consultas = Array.from({ length: CONSULTAS }, () => {
      const de = pontoSorteado(sorte)
      const area: KnownArea = { explored, vision: [circulo(de)], concealed: [] }
      return { de, para: pontoSorteado(sorte), area }
    })
    const primeira = consultas[0]
    if (primeira === undefined) throw new Error('sem consultas')
    // De uma vez (sem preparar): a medida do risco, no outro mapa.
    const inicioDeUmaVez = performance.now()
    caminhoConhecido(outroMapa, primeira.de, primeira.para, primeira.area)
    const deUmaVezMs = performance.now() - inicioDeUmaVez
    // Em fatias, como o app faz quando a cena chega.
    const fatias: number[] = []
    for (let pronta = false; !pronta; ) {
      const inicio = performance.now()
      pronta = prepararCaminhoConhecido(mapa, FATIA_MS)
      fatias.push(performance.now() - inicio)
    }
    const inicioDaPrimeira = performance.now()
    caminhoConhecido(mapa, primeira.de, primeira.para, primeira.area)
    const primeiraMs = performance.now() - inicioDaPrimeira
    const comCaminho = consultas.filter((c) => caminhoConhecido(mapa, c.de, c.para, c.area).tipo === 'caminho').length

    let menores = consultas.map(() => Number.POSITIVE_INFINITY)
    let crus = consultas.map(() => Number.POSITIVE_INFINITY)
    const lentidoes: number[] = []
    while (lentidoes.length < PASSADAS || (lentidoes.length < PASSADAS_MAX && percentil(menores, 95) > P95_DA_CONSULTA_MS)) {
      const antes = msDaReferencia()
      const medidas = consultas.map((c) => {
        const inicio = performance.now()
        caminhoConhecido(mapa, c.de, c.para, c.area)
        return performance.now() - inicio
      })
      const lentidao = lentidaoEntre(antes, msDaReferencia())
      lentidoes.push(Number(lentidao.toFixed(2)))
      menores = medidas.map((ms, k) => Math.min(menores[k] ?? Number.POSITIVE_INFINITY, ms / lentidao))
      crus = medidas.map((ms, k) => Math.min(crus[k] ?? Number.POSITIVE_INFINITY, ms))
    }
    const numeros = {
      paredes: mapa.walls.length,
      montagemDeUmaVezMs: Number(deUmaVezMs.toFixed(1)),
      fatiasDaMontagem: fatias.length,
      montagemEmFatiasMs: Number(fatias.reduce((a, b) => a + b, 0).toFixed(1)),
      fatiaMaxMs: Number(Math.max(...fatias).toFixed(2)),
      primeiraConsultaMs: Number(primeiraMs.toFixed(2)),
      consultas: CONSULTAS,
      comCaminho,
      lentidoes,
      consultaP95CruMs: Number(percentil(crus, 95).toFixed(2)),
      consultaP50Ms: Number(percentil(menores, 50).toFixed(2)),
      consultaP95Ms: Number(percentil(menores, 95).toFixed(2)),
      consultaMaxMs: Number(Math.max(...menores).toFixed(2)),
    }
    console.log(`DESEMPENHO-JOGADOR ${JSON.stringify(numeros)}`)
    expect(comCaminho).toBeGreaterThan(CONSULTAS / 2)
    expect(numeros.fatiaMaxMs).toBeLessThan(FATIA_MAXIMA_MS)
    expect(numeros.consultaMaxMs).toBeLessThan(CONSULTA_MAXIMA_MS)
    expect(numeros.consultaP95Ms).toBeLessThanOrEqual(P95_DA_CONSULTA_MS)
  }, 180_000)
})
