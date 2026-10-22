/**
 * DESEMPENHO DO CAMINHAMENTO, medido (metas escritas antes do código):
 * - mapa de 300 x 300 casas do gerador do robô (salas, corredores, portas,
 *   janelas, ~18 mil paredes, fichas paradas);
 * - consulta de caminho com a malha pronta: p95 <= 5 ms;
 * - montar a malha pela agenda: nenhuma fatia (quadro) >= 50 ms;
 * - 30 NPCs replanejando ao mesmo tempo, de novo a cada segundo, por 10 s a
 *   60 quadros/s: nenhum quadro >= 50 ms e custo médio por quadro <= 2 ms;
 *   a resposta sai em até 60 quadros (1 s) no p95;
 * - 30 NPCs, 10 deles indo para trás de uma porta trancada (a busca cara: duas
 *   rodadas varrem o mapa inteiro), cada um pedindo de novo 1 s depois da
 *   resposta, por 20 s: as baratas respondem em até 60 quadros no p95, toda
 *   cara responde (porta trancada) dentro dos 20 s, e os mesmos tetos de quadro.
 * Os números saem no console (`--reporter=verbose`).
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { AgendaDeCaminhos, CacheDeMalhas, ORCAMENTO_POR_QUADRO_MS } from './agenda'
import { acharCaminhoNaMalha, type FichaNoCaminho, type ResultadoDoCaminho } from './busca'
import { GRID, parede, porta } from './caminho.fixture'
import { type MapaDoCaminho, malhaPronta } from './malha'
import { avancarMalha } from './marcos'
import { gerarMapaDoRobo, type MapaDoRobo, sorteador } from './robo.fixture'

const LADO = 300
const CONSULTAS = 200
const MEDIDAS_POR_CONSULTA = 3
const NPCS = 30
const NPCS_CAROS = 10
const QUADROS = 600
const QUADROS_COM_CAROS = 1200
const QUADROS_ENTRE_REPLANOS = 60
const P95_DA_CONSULTA_MS = 5
const TAREFA_LONGA_MS = 50
const MEDIA_POR_QUADRO_MS = 2
const ESPERA_P95_QUADROS = 60

function percentil(valores: readonly number[], p: number): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))] ?? 0
}

const gerado = gerarMapaDoRobo(4242, GRID, false, 1, { largura: LADO, altura: LADO })
const raio = GRID / 2

function pontoSorteado(sorte: () => number): Point {
  return { x: (Math.floor(sorte() * LADO) + 0.5) * GRID, y: (Math.floor(sorte() * LADO) + 0.5) * GRID }
}

/**
 * O mapa com uma casa fechada no meio de uma sala pequena (3 ou 4 casas de
 * lado: o gerador não põe pilar nela), a porta trancada a oeste. O destino é
 * o centro da casa; as fichas da sala saem, para não taparem a porta.
 */
function comCasaTrancada(g: MapaDoRobo): { mapa: MapaDoCaminho; destino: Point; fichas: FichaNoCaminho[] } {
  const pequena = (a: number, b: number) => b - a >= 3 && b - a <= 4
  const sala = g.salas.find((s) => pequena(s.x0, s.x1) && pequena(s.y0, s.y1))
  if (sala === undefined) throw new Error('o mapa gerado não tem sala pequena')
  const [x0, y0, x1, y1] = [(sala.x0 + 1) * GRID, (sala.y0 + 1) * GRID, (sala.x0 + 2) * GRID, (sala.y0 + 2) * GRID]
  const casa: Wall[] = [
    parede('casa-n', x0, y0, x1, y0),
    parede('casa-l', x1, y0, x1, y1),
    parede('casa-s', x1, y1, x0, y1),
    parede('casa-o', x0, y1, x0, y0, { door: porta({ locked: true }) }),
  ]
  const naSala = (f: FichaNoCaminho) => f.x > sala.x0 * GRID && f.x < sala.x1 * GRID && f.y > sala.y0 * GRID && f.y < sala.y1 * GRID
  return { mapa: { ...g.mapa, walls: [...g.mapa.walls, ...casa] }, destino: { x: x0 + GRID / 2, y: y0 + GRID / 2 }, fichas: g.fichas.filter((f) => !naSala(f)) }
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
      // A consulta é determinística: o menor de algumas medidas é o custo dela, sem o
      // ruído de outros testes disputando a máquina.
      let ms = Number.POSITIVE_INFINITY
      let tipo = ''
      for (let vez = 0; vez < MEDIDAS_POR_CONSULTA; vez += 1) {
        const inicio = performance.now()
        tipo = acharCaminhoNaMalha(malha, gerado.mapa.walls, consulta).tipo
        ms = Math.min(ms, performance.now() - inicio)
      }
      tempos.push(ms)
      if (tipo === 'caminho') comCaminho.push(ms)
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
    expect(numeros.esperaP95Quadros).toBeLessThanOrEqual(ESPERA_P95_QUADROS)
    expect(numeros.quadroMaxMs).toBeLessThan(TAREFA_LONGA_MS)
    expect(numeros.mediaPorQuadroMs).toBeLessThanOrEqual(MEDIA_POR_QUADRO_MS)
    expect(numeros.mediaNosQuadrosOcupadosMs).toBeLessThanOrEqual(MEDIA_POR_QUADRO_MS)
  }, 120_000)

  it('10 dos 30 NPCs indo para trás de uma porta trancada: as buscas baratas não esperam as caras', () => {
    const tranca = comCasaTrancada(gerado)
    const agenda = new AgendaDeCaminhos(() => performance.now())
    const malha = agenda.cache.malhaPara(tranca.mapa, raio)
    while (!avancarMalha(malha, Number.POSITIVE_INFINITY));
    const sorte = sorteador(123)
    const atrasDaTranca = (de: Point) => acharCaminhoNaMalha(malha, tranca.mapa.walls, { de, para: tranca.destino, fichas: tranca.fichas })
    // O caminho com as trancas passando pode cruzar outras portas trancadas do mapa: a da casa está sempre entre elas.
    const peloMotivoCerto = (r: ResultadoDoCaminho) => r.tipo === 'sem-caminho' && r.motivo === 'porta-trancada' && r.portas.includes('casa-o')
    /** Um ponto de saída de onde a casa fica atrás da tranca (e não numa parte do mapa sem ligação). */
    const saidaDoCaro = (): Point => {
      for (let tentativa = 0; tentativa < 20; tentativa += 1) {
        const p = pontoSorteado(sorte)
        if (peloMotivoCerto(atrasDaTranca(p))) return p
      }
      throw new Error('nenhum ponto de saída com a casa atrás da tranca')
    }
    const npcs = Array.from({ length: NPCS }, (_, i) => {
      const caro = i < NPCS_CAROS
      return { id: `npc${i}`, caro, aqui: caro ? saidaDoCaro() : pontoSorteado(sorte), destino: caro ? tranca.destino : pontoSorteado(sorte), pedeEm: 0, pediuEm: -1 }
    })
    const esperaBarata: number[] = []
    const esperaCara: number[] = []
    const respostasCaras: ResultadoDoCaminho[] = []
    const carosRespondidos = new Set<string>()
    const quadros: number[] = []
    for (let q = 0; q < QUADROS_COM_CAROS; q += 1) {
      // Como o andarilho: pede, espera a resposta, e só pede de novo um tempo depois dela.
      for (const npc of npcs) {
        if (npc.pediuEm >= 0 || q < npc.pedeEm) continue
        agenda.pedir(npc.id, tranca.mapa, raio, { de: npc.aqui, para: npc.destino, fichas: tranca.fichas })
        npc.pediuEm = q
      }
      quadros.push(agenda.rodar(ORCAMENTO_POR_QUADRO_MS))
      for (const npc of npcs) {
        const resposta = agenda.pegar(npc.id)
        if (resposta === undefined) continue
        if (npc.caro) {
          esperaCara.push(q - npc.pediuEm)
          respostasCaras.push(resposta)
          carosRespondidos.add(npc.id)
        } else {
          esperaBarata.push(q - npc.pediuEm)
          npc.destino = pontoSorteado(sorte)
        }
        npc.pediuEm = -1
        npc.pedeEm = q + QUADROS_ENTRE_REPLANOS
      }
    }
    const numeros = {
      npcs: NPCS,
      caros: NPCS_CAROS,
      quadros: QUADROS_COM_CAROS,
      respostasBaratas: esperaBarata.length,
      esperaBarataP50Quadros: percentil(esperaBarata, 50),
      esperaBarataP95Quadros: percentil(esperaBarata, 95),
      esperaBarataMaxQuadros: Math.max(...esperaBarata),
      respostasCaras: esperaCara.length,
      carosRespondidos: carosRespondidos.size,
      esperaCaraMinQuadros: Math.min(...esperaCara),
      esperaCaraMaxQuadros: Math.max(...esperaCara),
      quadroMaxMs: Number(Math.max(...quadros).toFixed(2)),
      mediaPorQuadroMs: Number((quadros.reduce((a, b) => a + b, 0) / quadros.length).toFixed(3)),
    }
    console.log(`DESEMPENHO caros ${JSON.stringify(numeros)}`)
    expect(numeros.esperaBarataP95Quadros).toBeLessThanOrEqual(ESPERA_P95_QUADROS)
    expect(numeros.carosRespondidos).toBe(NPCS_CAROS)
    expect(respostasCaras.filter((r) => !peloMotivoCerto(r))).toEqual([])
    expect(numeros.quadroMaxMs).toBeLessThan(TAREFA_LONGA_MS)
    expect(numeros.mediaPorQuadroMs).toBeLessThanOrEqual(MEDIA_POR_QUADRO_MS)
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
