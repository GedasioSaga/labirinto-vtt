/**
 * DESEMPENHO DA ROTINA PELO MOTOR, medido como o editor roda (metas escritas
 * antes do código):
 * - mapa de 300 x 300 casas do gerador do robô (o do `desempenho.test.ts`:
 *   salas, corredores, portas, janelas, ~18 mil paredes, fichas paradas);
 * - 30 NPCs com a rotina ligada (3 postos cada, a até 6 casas um do outro,
 *   às vezes atrás de parede ou porta), 10 s simulados: um tique da rotina a cada
 *   200 ms (o `darPassoDaRotina` com o motor do editor, relógio de verdade e
 *   orçamento de 8 ms) e, entre os tiques, a agenda regada a cada quadro de
 *   16 ms (como o `regarAgenda` do store);
 * - nenhuma tarefa (tique ou quadro) >= 50 ms;
 * - eles andam: a maioria dá passo e algum chega a um posto.
 * Os números saem no console (`--reporter=verbose`).
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import type { MapData, Token } from '../../types/map'
import type { EstadoDoMundo } from '../estadoDoMundo'
import { createEmptyMap } from '../mapFactory'
import { darPassoDaRotina, ligarRotina, PASSO_DA_ROTINA_MS, type RotinasAndando } from '../rotinaAndando'
import { moverNaCena } from '../rotinaDoNpc'
import { ORCAMENTO_POR_QUADRO_MS } from './agenda'
import { GRID } from './caminho.fixture'
import { gerarMapaDoRobo, percentil, type Sala, sorteador } from './robo.fixture'
import { comPortasDoNpc, motorComRelogio, QUADRO_DA_AGENDA_MS } from './tiqueDosNpcs'

const LADO = 300
const NPCS = 30
const POSTOS = 3
const SEGUNDOS = 10
/** Os postos de um NPC ficam a até tantas casas um do outro. */
const PERTO = 6
const TAREFA_LONGA_MS = 50
const CENA = 'grande'
const ESTADO = 'turno'

const gerado = gerarMapaDoRobo(4242, GRID, false, 1, { largura: LADO, altura: LADO })

/** Um centro de casa numa sala sorteada, longe (2 casas) de toda ficha já posta. */
function pontoLivre(sorte: () => number, salas: readonly Sala[], ocupados: readonly Point[]): Point {
  for (let tentativa = 0; tentativa < 10_000; tentativa += 1) {
    const sala = salas[Math.floor(sorte() * salas.length)]
    if (sala === undefined) continue
    const x = (sala.x0 + Math.floor(sorte() * (sala.x1 - sala.x0)) + 0.5) * GRID
    const y = (sala.y0 + Math.floor(sorte() * (sala.y1 - sala.y0)) + 0.5) * GRID
    if (ocupados.every((p) => Math.hypot(p.x - x, p.y - y) >= 2 * GRID)) return { x, y }
  }
  throw new Error('sem lugar livre no mapa gerado')
}

/** Um centro de casa a até `PERTO` casas de `centro` (dentro do mapa), longe (2 casas) de toda ficha já posta. */
function pontoPerto(sorte: () => number, centro: Point, ocupados: readonly Point[]): Point {
  for (let tentativa = 0; tentativa < 10_000; tentativa += 1) {
    const i = Math.floor(centro.x / GRID) + Math.floor(sorte() * (2 * PERTO + 1)) - PERTO
    const j = Math.floor(centro.y / GRID) + Math.floor(sorte() * (2 * PERTO + 1)) - PERTO
    if (i < 0 || j < 0 || i >= LADO || j >= LADO) continue
    const p = { x: (i + 0.5) * GRID, y: (j + 0.5) * GRID }
    if (ocupados.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= 2 * GRID)) return p
  }
  throw new Error('sem lugar livre perto do posto')
}

function montar(): { map: MapData; estados: EstadoDoMundo[] } {
  const sorte = sorteador(30)
  const valores = Array.from({ length: POSTOS }, (_, i) => `p${i}`)
  const estados: EstadoDoMundo[] = [{ id: ESTADO, nome: 'Turno', valores, atual: valores[0] ?? '' }]
  const ocupados: Point[] = gerado.fichas.map((f) => ({ x: f.x, y: f.y }))
  const npcs: Token[] = []
  for (let i = 0; i < NPCS; i += 1) {
    // O primeiro posto numa sala sorteada; os outros perto dele (dá para chegar em 10 s), às vezes atrás de parede ou porta trancada.
    const primeiro = pontoLivre(sorte, gerado.salas, ocupados)
    ocupados.push(primeiro)
    const postos = valores.map((_, k) => {
      if (k === 0) return primeiro
      const p = pontoPerto(sorte, primeiro, ocupados)
      ocupados.push(p)
      return p
    })
    const inicio = postos[0] ?? { x: GRID / 2, y: GRID / 2 }
    const rotina = { estadoId: ESTADO, postos: postos.map((p, k) => ({ valor: valores[k] ?? '', sceneId: CENA, x: p.x, y: p.y })) }
    npcs.push({ id: `npc${i}`, characterId: null, name: `NPC ${i}`, x: inicio.x, y: inicio.y, size: 1, image: null, npc: true, rotina })
  }
  const parados: Token[] = gerado.fichas.map((f) => ({ id: f.id, characterId: null, name: f.id, x: f.x, y: f.y, size: 1, image: null }))
  const map: MapData = { ...createEmptyMap(CENA, CENA, LADO, LADO, GRID), walls: [...gerado.mapa.walls], tokens: [...npcs, ...parados] }
  return { map, estados }
}

describe('desempenho da rotina pelo motor', () => {
  it('30 NPCs com a rotina ligada num mapa de 300 x 300 por 10 s: nenhuma tarefa >= 50 ms', () => {
    const { map: inicial, estados } = montar()
    const motor = motorComRelogio(() => performance.now())
    const quadrosPorTique = Math.floor(PASSO_DA_ROTINA_MS / QUADRO_DA_AGENDA_MS)
    const tiques = (SEGUNDOS * 1000) / PASSO_DA_ROTINA_MS
    let map = inicial
    let andando: RotinasAndando = new Map()
    for (let i = 0; i < NPCS; i += 1) andando = ligarRotina(andando, [{ sceneId: CENA, map }], `npc${i}`, estados, 0)
    const msDosTiques: number[] = []
    const msDosQuadros: number[] = []
    const andaram = new Set<string>()
    let chegadas = 0
    let desistencias = 0
    let portas = 0
    for (let t = 0; t < tiques; t += 1) {
      const inicio = performance.now()
      const r = darPassoDaRotina([{ sceneId: CENA, map }], andando, estados, t * PASSO_DA_ROTINA_MS, new Set(), motor)
      map = comPortasDoNpc(moverNaCena(map, r.movimentos), r.portas)
      msDosTiques.push(performance.now() - inicio)
      for (const m of r.movimentos) andaram.add(m.tokenId)
      for (const [id, depois] of r.andando) {
        const antes = andando.get(id)
        if (antes === undefined || antes.destino === depois.destino) continue
        if (depois.andarilho?.fim?.tipo === 'desistiu') desistencias += 1
        else chegadas += 1
      }
      portas += r.portas.length
      andando = r.andando
      for (let q = 0; q < quadrosPorTique; q += 1) {
        const inicioDoQuadro = performance.now()
        if (motor.agenda.temTrabalho) motor.agenda.rodar(ORCAMENTO_POR_QUADRO_MS)
        msDosQuadros.push(performance.now() - inicioDoQuadro)
      }
    }
    const numeros = {
      npcs: NPCS,
      tiques: msDosTiques.length,
      quadros: msDosQuadros.length,
      tiqueP50: Number(percentil(msDosTiques, 50).toFixed(2)),
      tiqueP95: Number(percentil(msDosTiques, 95).toFixed(2)),
      tiqueMax: Number(Math.max(...msDosTiques).toFixed(2)),
      quadroP50: Number(percentil(msDosQuadros, 50).toFixed(2)),
      quadroP95: Number(percentil(msDosQuadros, 95).toFixed(2)),
      quadroMax: Number(Math.max(...msDosQuadros).toFixed(2)),
      andaram: andaram.size,
      chegadas,
      desistencias,
      portas,
    }
    console.log(`DESEMPENHO-ROTINA ${JSON.stringify(numeros)}`)
    expect(numeros.tiqueMax).toBeLessThan(TAREFA_LONGA_MS)
    expect(numeros.quadroMax).toBeLessThan(TAREFA_LONGA_MS)
    expect(andaram.size).toBeGreaterThanOrEqual(NPCS / 2)
    expect(chegadas).toBeGreaterThan(0)
  }, 120_000)
})
