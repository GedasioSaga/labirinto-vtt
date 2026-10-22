/**
 * DESEMPENHO DO CAMINHAMENTO, medido (metas escritas antes do código):
 * - mapa de 300 x 300 casas do gerador do robô (salas, corredores, portas,
 *   janelas, ~18 mil paredes, fichas paradas);
 * - consulta de caminho com a malha pronta: p95 <= 5 ms;
 * - montar a malha pela agenda: nenhuma fatia (quadro) >= 50 ms;
 * - 30 NPCs replanejando ao mesmo tempo, de novo a cada segundo, por 10 s a
 *   60 quadros/s: nenhum quadro >= 50 ms e custo médio por quadro <= 2 ms.
 * Os números saem no console (`--reporter=verbose`).
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import { AgendaDeCaminhos, CacheDeMalhas, ORCAMENTO_POR_QUADRO_MS } from './agenda'
import { acharCaminhoNaMalha } from './busca'
import { GRID } from './caminho.fixture'
import { malhaPronta } from './malha'
import { avancarMalha } from './marcos'
import { gerarMapaDoRobo, sorteador } from './robo.fixture'

const LADO = 300
const CONSULTAS = 200
const NPCS = 30
const QUADROS = 600
const QUADROS_ENTRE_REPLANOS = 60
const P95_DA_CONSULTA_MS = 5
const TAREFA_LONGA_MS = 50
const MEDIA_POR_QUADRO_MS = 2

function percentil(valores: readonly number[], p: number): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))] ?? 0
}

const gerado = gerarMapaDoRobo(4242, GRID, false, 1, { largura: LADO, altura: LADO })
const raio = GRID / 2

function pontoSorteado(sorte: () => number): Point {
  return { x: (Math.floor(sorte() * LADO) + 0.5) * GRID, y: (Math.floor(sorte() * LADO) + 0.5) * GRID }
}

describe('desempenho do caminhamento (300 x 300 casas)', () => {
  it('montar a malha pela agenda não faz quadro longo; consulta com p95 <= 5 ms', () => {
    const agenda = new AgendaDeCaminhos(() => performance.now())
    const sorte = sorteador(7)
    const de = pontoSorteado(sorte)
    agenda.pedir('primeiro', gerado.mapa, raio, { de, para: pontoSorteado(sorte), fichas: gerado.fichas })
    const quadrosDaMontagem: number[] = []
    while (agenda.temTrabalho) quadrosDaMontagem.push(agenda.rodar(ORCAMENTO_POR_QUADRO_MS))
    const malha = agenda.cache.malhaPara(gerado.mapa, raio)
    expect(malhaPronta(malha)).toBe(true)

    const tempos: number[] = []
    const comCaminho: number[] = []
    for (let k = 0; k < CONSULTAS; k += 1) {
      const consulta = { de: pontoSorteado(sorte), para: pontoSorteado(sorte), fichas: gerado.fichas }
      const inicio = performance.now()
      const r = acharCaminhoNaMalha(malha, gerado.mapa.walls, consulta)
      const ms = performance.now() - inicio
      tempos.push(ms)
      if (r.tipo === 'caminho') comCaminho.push(ms)
    }
    const numeros = {
      paredes: gerado.mapa.walls.length,
      fichas: gerado.fichas.length,
      pontosDaRede: malha.nx * malha.ny,
      quadrosDaMontagem: quadrosDaMontagem.length,
      montagemMsTotal: Number(quadrosDaMontagem.reduce((a, b) => a + b, 0).toFixed(1)),
      montagemQuadroMaxMs: Number(Math.max(...quadrosDaMontagem).toFixed(2)),
      consultas: CONSULTAS,
      comCaminho: comCaminho.length,
      consultaP50Ms: Number(percentil(tempos, 50).toFixed(2)),
      consultaP95Ms: Number(percentil(tempos, 95).toFixed(2)),
      consultaMaxMs: Number(Math.max(...tempos).toFixed(2)),
    }
    console.log(`DESEMPENHO consulta ${JSON.stringify(numeros)}`)
    expect(numeros.montagemQuadroMaxMs).toBeLessThan(TAREFA_LONGA_MS)
    expect(numeros.consultaP95Ms).toBeLessThanOrEqual(P95_DA_CONSULTA_MS)
  }, 120_000)

  it('30 NPCs replanejando juntos: nenhum quadro >= 50 ms, média por quadro <= 2 ms', () => {
    const agenda = new AgendaDeCaminhos(() => performance.now())
    // A malha já montada (outro trecho acima mede a montagem): aqui é o custo das buscas.
    const cache = agenda.cache
    const malha = cache.malhaPara(gerado.mapa, raio)
    while (!avancarMalha(malha, Number.POSITIVE_INFINITY));
    const sorte = sorteador(99)
    const npcs = Array.from({ length: NPCS }, (_, i) => ({ id: `npc${i}`, aqui: pontoSorteado(sorte), destino: pontoSorteado(sorte) }))
    const pedidoEm = new Map<string, number>()
    const espera: number[] = []
    const quadros: number[] = []
    for (let q = 0; q < QUADROS; q += 1) {
      if (q % QUADROS_ENTRE_REPLANOS === 0) {
        for (const npc of npcs) {
          agenda.pedir(npc.id, gerado.mapa, raio, { de: npc.aqui, para: npc.destino, fichas: gerado.fichas })
          pedidoEm.set(npc.id, q)
          npc.destino = pontoSorteado(sorte)
        }
      }
      quadros.push(agenda.rodar(ORCAMENTO_POR_QUADRO_MS))
      for (const npc of npcs) {
        if (agenda.pegar(npc.id) !== undefined) espera.push(q - (pedidoEm.get(npc.id) ?? q))
      }
    }
    const ocupados = quadros.filter((ms) => ms > 0.01)
    const numeros = {
      npcs: NPCS,
      quadros: QUADROS,
      pedidos: (QUADROS / QUADROS_ENTRE_REPLANOS) * NPCS,
      respondidos: espera.length,
      orcamentoPorQuadroMs: ORCAMENTO_POR_QUADRO_MS,
      quadroMaxMs: Number(Math.max(...quadros).toFixed(2)),
      mediaPorQuadroMs: Number((quadros.reduce((a, b) => a + b, 0) / quadros.length).toFixed(3)),
      mediaNosQuadrosOcupadosMs: Number((ocupados.reduce((a, b) => a + b, 0) / Math.max(1, ocupados.length)).toFixed(3)),
      esperaP50Quadros: percentil(espera, 50),
      esperaP95Quadros: percentil(espera, 95),
      esperaMaxQuadros: Math.max(...espera),
    }
    console.log(`DESEMPENHO 30npcs ${JSON.stringify(numeros)}`)
    expect(numeros.respondidos).toBe(numeros.pedidos)
    expect(numeros.quadroMaxMs).toBeLessThan(TAREFA_LONGA_MS)
    expect(numeros.mediaPorQuadroMs).toBeLessThanOrEqual(MEDIA_POR_QUADRO_MS)
    expect(numeros.mediaNosQuadrosOcupadosMs).toBeLessThanOrEqual(MEDIA_POR_QUADRO_MS)
  }, 120_000)

  it('o cache reaproveita a malha quando só uma porta abre ou fecha', () => {
    const cache = new CacheDeMalhas()
    const malha = cache.malhaPara(gerado.mapa, raio)
    const portaIndice = gerado.mapa.walls.findIndex((w) => w.door !== null && !w.door.locked)
    const walls = gerado.mapa.walls.map((w, i) => (i === portaIndice && w.door !== null ? { ...w, door: { ...w.door, open: !w.door.open } } : w))
    expect(portaIndice).toBeGreaterThanOrEqual(0)
    expect(cache.malhaPara({ ...gerado.mapa, walls }, raio)).toBe(malha)
    const trancada = gerado.mapa.walls.map((w, i) => (i === portaIndice && w.door !== null ? { ...w, door: { ...w.door, locked: true } } : w))
    expect(cache.malhaPara({ ...gerado.mapa, walls: trancada }, raio)).not.toBe(malha)
  })
})
