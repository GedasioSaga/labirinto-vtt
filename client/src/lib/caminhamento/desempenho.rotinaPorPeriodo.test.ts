/**
 * TROCA DE PERÍODO COM 30 NPCS (Caminhos F3), medida como o editor roda.
 * Metas (escritas antes do código):
 * - mapa de 300 x 300 casas do gerador do robô (o do `desempenho.rotina.test.ts`),
 *   cena externa; 30 NPCs com a rotina ligada, 4 postos cada na MESMA sala
 *   (sempre há caminho): dois só de dia, um só de noite e um sem período;
 * - 4 s de dia, troca para noite, 12 s de noite: um tique da rotina a cada
 *   200 ms e a agenda regada a cada quadro de 16 ms (o `regarAgenda` do store);
 * - posições amostradas a cada 0,1 s, sem renderizar: 0 deslocamentos entre
 *   amostras maiores que 2 casas/s x 0,2 s + 1 px (sem teleporte na troca);
 * - 0 chegadas a posto de outro período (de dia ao da noite; depois da troca
 *   aos do dia);
 * - depois da troca, pelo menos 27 dos 30 (90%) chegam a um posto que vale à
 *   noite (o da noite ou o sem período): eles andam de verdade;
 * - no relógio de verdade: nenhum tique nem quadro >= 50 ms, na troca e fora
 *   dela (a primeira de até 3 rodadas que cumpre, `relogio.fixture.ts`).
 * A lógica (deslocamento, chegadas) roda no relógio lógico com as malhas já
 * montadas; os ms, no de verdade, com a montagem dentro. Números no console.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import type { MapData, Periodo, PostoDaRotina, Token, Wall } from '../../types/map'
import type { EstadoDoMundo } from '../estadoDoMundo'
import { createEmptyMap } from '../mapFactory'
import { darPassoDaRotina, ligarRotina, PASSO_DA_ROTINA_MS, passoEmPx, type RotinasAndando } from '../rotinaAndando'
import { type CenaDaRotina, moverNaCena } from '../rotinaDoNpc'
import { ORCAMENTO_POR_QUADRO_MS } from './agenda'
import { GRID } from './caminho.fixture'
import { entradaDaFicha } from './daFicha'
import { distanciaAoTraco } from './malha'
import { avancarMalha } from './marcos'
import { primeiraQueCumpre, type RelogioLogico, relogioLogico } from './relogio.fixture'
import { gerarMapaDoRobo, percentil, type Sala, sorteador } from './robo.fixture'
import { comPortasDoNpc, type MotorDosNpcs, motorComRelogio, QUADRO_DA_AGENDA_MS } from './tiqueDosNpcs'

const LADO = 300
const NPCS = 30
const CENA = 'vila'
const VALORES = ['v0', 'v1', 'v2', 'v3']
/** O período de cada posto, na ordem de `VALORES`: dois do dia, um da noite, um de sempre. */
const PERIODOS_DOS_POSTOS: readonly (Periodo | undefined)[] = ['dia', 'dia', 'noite', undefined]
const ESTADOS: EstadoDoMundo[] = [{ id: 'turno', nome: 'Turno', valores: VALORES, atual: VALORES[0] ?? '' }]
const SEGUNDOS_DE_DIA = 4
const SEGUNDOS_DE_NOITE = 12
const AMOSTRA_MS = 100
/** 2 casas/s x 0,2 s, mais 1 px. */
const MAIOR_PASSO = passoEmPx(GRID) + 1
const META_DE_CHEGADAS = 27
const TAREFA_LONGA_MS = 50
/** Janela "durante a troca", para o console: os 2 s depois dela. */
const JANELA_DA_TROCA_MS = 2000
/** O posto fica a esta distância (em casas) de toda parede: o pilar torto no meio da sala não encosta na ficha. */
const FOLGA_DA_PAREDE = 0.75
/** Sala com menos casas de lado não cabe 4 postos a 2 casas um do outro. */
const LADO_MINIMO_DA_SALA = 5

const TROCA_MS = SEGUNDOS_DE_DIA * 1000
const TIQUES = ((SEGUNDOS_DE_DIA + SEGUNDOS_DE_NOITE) * 1000) / PASSO_DA_ROTINA_MS

const gerado = gerarMapaDoRobo(4242, GRID, false, 1, { largura: LADO, altura: LADO })

function paredesPerto(paredes: readonly Wall[], sala: Sala): Wall[] {
  const x0 = (sala.x0 - 1) * GRID
  const x1 = (sala.x1 + 1) * GRID
  const y0 = (sala.y0 - 1) * GRID
  const y1 = (sala.y1 + 1) * GRID
  return paredes.filter((w) => Math.max(w.x1, w.x2) >= x0 && Math.min(w.x1, w.x2) <= x1 && Math.max(w.y1, w.y2) >= y0 && Math.min(w.y1, w.y2) <= y1)
}

/** Os 4 postos de um NPC numa sala sorteada (casas de dentro, longe de parede e a 2 casas de tudo que já foi posto). */
function postosNumaSala(sorte: () => number, ocupados: readonly Point[]): Point[] {
  for (let tentativa = 0; tentativa < 5000; tentativa += 1) {
    const sala = gerado.salas[Math.floor(sorte() * gerado.salas.length)]
    if (sala === undefined || sala.x1 - sala.x0 < LADO_MINIMO_DA_SALA || sala.y1 - sala.y0 < LADO_MINIMO_DA_SALA) continue
    const paredes = paredesPerto(gerado.mapa.walls, sala)
    const escolhidos: Point[] = []
    for (let k = 0; k < 200 && escolhidos.length < VALORES.length; k += 1) {
      const x = (sala.x0 + 1 + Math.floor(sorte() * (sala.x1 - sala.x0 - 2)) + 0.5) * GRID
      const y = (sala.y0 + 1 + Math.floor(sorte() * (sala.y1 - sala.y0 - 2)) + 0.5) * GRID
      if (![...ocupados, ...escolhidos].every((p) => Math.hypot(p.x - x, p.y - y) >= 2 * GRID)) continue
      if (paredes.some((w) => distanciaAoTraco(x, y, w.x1, w.y1, w.x2, w.y2) < FOLGA_DA_PAREDE * GRID)) continue
      escolhidos.push({ x, y })
    }
    if (escolhidos.length === VALORES.length) return escolhidos
  }
  throw new Error('sem sala com lugar para os postos')
}

interface Vila {
  cena: CenaDaRotina
  ids: string[]
  postos: ReadonlyMap<string, readonly PostoDaRotina[]>
}

function montarVila(): Vila {
  const sorte = sorteador(77)
  const ocupados: Point[] = gerado.fichas.map((f) => ({ x: f.x, y: f.y }))
  const npcs: Token[] = []
  const postos = new Map<string, PostoDaRotina[]>()
  for (let i = 0; i < NPCS; i += 1) {
    const pontos = postosNumaSala(sorte, ocupados)
    ocupados.push(...pontos)
    const dele = pontos.map((p, k): PostoDaRotina => {
      const periodo = PERIODOS_DOS_POSTOS[k]
      return { valor: VALORES[k] ?? '', sceneId: CENA, x: p.x, y: p.y, ...(periodo === undefined ? {} : { periodo }) }
    })
    const id = `npc${i}`
    postos.set(id, dele)
    const inicio = pontos[0] ?? { x: GRID / 2, y: GRID / 2 }
    npcs.push({ id, characterId: null, name: `NPC ${i}`, x: inicio.x, y: inicio.y, size: 1, image: null, npc: true, rotina: { estadoId: 'turno', postos: dele } })
  }
  const parados: Token[] = gerado.fichas.map((f) => ({ id: `parado-${f.id}`, characterId: null, name: f.id, x: f.x, y: f.y, size: 1, image: null }))
  const map: MapData = { ...createEmptyMap(CENA, CENA, LADO, LADO, GRID), externa: true, walls: [...gerado.mapa.walls], tokens: [...npcs, ...parados] }
  return { cena: { sceneId: CENA, map }, ids: npcs.map((n) => n.id), postos }
}

function montarAsMalhas(motor: MotorDosNpcs, cena: CenaDaRotina, ids: readonly string[]): void {
  for (const id of ids) {
    const entrada = entradaDaFicha(cena.map, id)
    if (entrada === null) continue
    const malha = motor.agenda.cache.malhaPara(entrada.mapa, entrada.raio)
    while (!avancarMalha(malha, Number.POSITIVE_INFINITY));
  }
}

function sessaoNo(ms: number): Periodo {
  return ms < TROCA_MS ? 'dia' : 'noite'
}

function posicoes(cena: CenaDaRotina, ids: readonly string[]): Map<string, Point> {
  const onde = new Map<string, Point>()
  for (const t of cena.map.tokens) if (ids.includes(t.id)) onde.set(t.id, { x: t.x, y: t.y })
  return onde
}

const valeEm = (posto: PostoDaRotina, periodo: Periodo) => posto.periodo === undefined || posto.periodo === periodo

/** `logico`: o relógio da agenda levado à hora simulada, com as malhas montadas; `null`, o de verdade. */
function simular(vila: Vila, logico: RelogioLogico | null) {
  const motor = motorComRelogio(logico === null ? () => performance.now() : logico.ler)
  if (logico !== null) montarAsMalhas(motor, vila.cena, vila.ids)
  const quadrosPorTique = Math.floor(PASSO_DA_ROTINA_MS / QUADRO_DA_AGENDA_MS)
  let cena = vila.cena
  let andando: RotinasAndando = new Map()
  for (const id of vila.ids) andando = ligarRotina(andando, [cena], id, ESTADOS, 0)
  const tiques: { ms: number; hora: number }[] = []
  const quadros: { ms: number; hora: number }[] = []
  let antes = posicoes(cena, vila.ids)
  let maiorDeslocamento = 0
  const deslocamentosGrandes: string[] = []
  const foraDoPeriodo: string[] = []
  const chegaramANoite = new Set<string>()
  const chegaramAoDaNoite = new Set<string>()
  /** Uma amostra na hora `hora`: o deslocamento desde a anterior. */
  const amostrar = (hora: number) => {
    const agora = posicoes(cena, vila.ids)
    for (const [id, p] of agora) {
      const q = antes.get(id)
      if (q === undefined) continue
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      maiorDeslocamento = Math.max(maiorDeslocamento, d)
      if (d > MAIOR_PASSO) deslocamentosGrandes.push(`${id} ${d.toFixed(1)} px em ${hora} ms`)
    }
    antes = agora
  }
  /**
   * As chegadas do tique da hora `hora`: o trecho terminou em "chegou" e o NPC
   * mirou o posto seguinte. (Passar por cima do ponto de outro posto no
   * caminho não é chegar.)
   */
  const chegadas = (hora: number, depois: RotinasAndando, onde: ReadonlyMap<string, Point>) => {
    for (const [id, ficha] of depois) {
      const anterior = andando.get(id)
      if (anterior === undefined || anterior.destino === ficha.destino || ficha.andarilho?.fim?.tipo !== 'chegou') continue
      const p = onde.get(id)
      const posto = p === undefined ? undefined : (vila.postos.get(id) ?? []).find((x) => x.x === p.x && x.y === p.y)
      if (posto === undefined) continue
      const periodo = sessaoNo(hora)
      if (!valeEm(posto, periodo)) foraDoPeriodo.push(`${id} chegou em ${posto.valor} (${posto.periodo ?? 'sempre'}) em ${hora} ms, de ${periodo}`)
      if (hora >= TROCA_MS && valeEm(posto, 'noite')) chegaramANoite.add(id)
      if (hora >= TROCA_MS && posto.periodo === 'noite') chegaramAoDaNoite.add(id)
    }
  }
  for (let t = 0; t < TIQUES; t += 1) {
    const hora = t * PASSO_DA_ROTINA_MS
    logico?.irPara(hora)
    const inicio = performance.now()
    const r = darPassoDaRotina([cena], andando, ESTADOS, hora, new Set(), motor, sessaoNo(hora))
    cena = { ...cena, map: comPortasDoNpc(moverNaCena(cena.map, r.movimentos), r.portas.filter((p) => p.sceneId === cena.sceneId)) }
    tiques.push({ ms: performance.now() - inicio, hora })
    chegadas(hora, r.andando, posicoes(cena, vila.ids))
    andando = r.andando
    amostrar(hora)
    for (let q = 0; q < quadrosPorTique; q += 1) {
      const horaDoQuadro = hora + (q + 1) * QUADRO_DA_AGENDA_MS
      if (hora + AMOSTRA_MS > horaDoQuadro - QUADRO_DA_AGENDA_MS && hora + AMOSTRA_MS <= horaDoQuadro) amostrar(hora + AMOSTRA_MS)
      logico?.irPara(horaDoQuadro)
      const inicioDoQuadro = performance.now()
      if (motor.agenda.temTrabalho) motor.agenda.rodar(ORCAMENTO_POR_QUADRO_MS)
      quadros.push({ ms: performance.now() - inicioDoQuadro, hora: horaDoQuadro })
    }
  }
  const naTroca = (x: { hora: number }) => x.hora >= TROCA_MS && x.hora < TROCA_MS + JANELA_DA_TROCA_MS
  const maximo = (lista: readonly { ms: number }[]) => Number(Math.max(0, ...lista.map((x) => x.ms)).toFixed(2))
  return {
    ms: {
      tiqueMax: maximo(tiques),
      tiqueP95: Number(percentil(tiques.map((x) => x.ms), 95).toFixed(2)),
      quadroMax: maximo(quadros),
      quadroP95: Number(percentil(quadros.map((x) => x.ms), 95).toFixed(2)),
      tiqueMaxNaTroca: maximo(tiques.filter(naTroca)),
      quadroMaxNaTroca: maximo(quadros.filter(naTroca)),
    },
    logica: {
      maiorDeslocamento: Number(maiorDeslocamento.toFixed(2)),
      limite: MAIOR_PASSO,
      deslocamentosGrandes,
      foraDoPeriodo,
      chegaramANoite: chegaramANoite.size,
      chegaramAoDaNoite: chegaramAoDaNoite.size,
    },
  }
}

describe('troca de período com 30 NPCs pelo motor', () => {
  const vila = montarVila()

  it('no relógio lógico: nenhum passo maior que 2 casas/s x 0,2 s + 1 px, ninguém chega a posto de outro período, e 27 ou mais chegam a um posto da noite', () => {
    const { logica } = simular(vila, relogioLogico())
    console.log(`TROCA-DE-PERIODO-logico ${JSON.stringify({ ...logica, deslocamentosGrandes: logica.deslocamentosGrandes.slice(0, 5), foraDoPeriodo: logica.foraDoPeriodo.slice(0, 5) })}`)
    expect(logica.deslocamentosGrandes).toEqual([])
    expect(logica.foraDoPeriodo).toEqual([])
    expect(logica.chegaramANoite).toBeGreaterThanOrEqual(META_DE_CHEGADAS)
  }, 120_000)

  it('no relógio de verdade: nenhum tique nem quadro >= 50 ms, e nenhum passo grande', () => {
    const { escolhida, todas } = primeiraQueCumpre(
      () => simular(vila, null),
      (r) => r.ms.tiqueMax < TAREFA_LONGA_MS && r.ms.quadroMax < TAREFA_LONGA_MS,
    )
    console.log(`TROCA-DE-PERIODO-relogio ${JSON.stringify({ rodadas: todas.map((r) => ({ ...r.ms, maiorDeslocamento: r.logica.maiorDeslocamento, chegaramANoite: r.logica.chegaramANoite })) })}`)
    expect(escolhida.ms.tiqueMax).toBeLessThan(TAREFA_LONGA_MS)
    expect(escolhida.ms.quadroMax).toBeLessThan(TAREFA_LONGA_MS)
    expect(escolhida.logica.deslocamentosGrandes).toEqual([])
  }, 120_000)
})
