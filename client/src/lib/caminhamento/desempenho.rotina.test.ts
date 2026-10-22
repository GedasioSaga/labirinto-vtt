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
 * E com mais malhas em uso do que o cache guarda sem uso: 10 cenas carregadas
 * (mapas de 100 x 100 casas, cada um com as suas paredes), 3 NPCs em cada —
 * dez combinações de cena e tamanho de ficha pedidas a cada tique, sempre na
 * mesma ordem: as mesmas metas, e cada cena com alguém andando.
 * LÓGICA E RELÓGIO, separados (`relogio.fixture.ts`):
 * - no relógio lógico, com as malhas já montadas, quem anda, quem chega e em
 *   que cenas: o mesmo número com a CPU livre ou ocupada (no relógio de
 *   verdade, com a suíte da área rodando, chegavam 1 ou 2 contra a meta de mais
 *   de 0). A malha vem pronta porque a fatia de montar custa bem menos que a de
 *   busca, e o relógio lógico cobra as duas igual: a montagem comeria os 10 s;
 * - no relógio de verdade, com a montagem dentro: os ms do tique e do quadro e
 *   a malha pronta a tempo de a maioria andar, pela primeira de até 3 rodadas
 *   que cumpre as metas.
 * Os números saem no console (`--reporter=verbose`).
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import type { MapData, Token } from '../../types/map'
import type { EstadoDoMundo } from '../estadoDoMundo'
import { createEmptyMap } from '../mapFactory'
import { darPassoDaRotina, ligarRotina, PASSO_DA_ROTINA_MS, type RotinasAndando } from '../rotinaAndando'
import { type CenaDaRotina, moverNaCena } from '../rotinaDoNpc'
import { MALHAS_GUARDADAS, ORCAMENTO_POR_QUADRO_MS } from './agenda'
import { GRID } from './caminho.fixture'
import { entradaDaFicha } from './daFicha'
import { avancarMalha } from './marcos'
import { primeiraQueCumpre, type RelogioLogico, relogioLogico } from './relogio.fixture'
import { gerarMapaDoRobo, type MapaDoRobo, percentil, type Sala, sorteador } from './robo.fixture'
import { comPortasDoNpc, type MotorDosNpcs, motorComRelogio, QUADRO_DA_AGENDA_MS } from './tiqueDosNpcs'

const LADO = 300
const NPCS = 30
const POSTOS = 3
const SEGUNDOS = 10
/** Os postos de um NPC ficam a até tantas casas um do outro. */
const PERTO = 6
const TAREFA_LONGA_MS = 50
const CENA = 'grande'
const ESTADO = 'turno'
/** O caso de muitas cenas: mais cenas que as malhas guardadas sem uso, cada uma menor. */
const CENAS = 10
const LADO_DAS_CENAS = 100

const gerado = gerarMapaDoRobo(4242, GRID, false, 1, { largura: LADO, altura: LADO })
const VALORES = Array.from({ length: POSTOS }, (_, i) => `p${i}`)
const ESTADOS: EstadoDoMundo[] = [{ id: ESTADO, nome: 'Turno', valores: VALORES, atual: VALORES[0] ?? '' }]

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

/** Um centro de casa a até `PERTO` casas de `centro` (dentro do mapa de `lado` casas), longe (2 casas) de toda ficha já posta. */
function pontoPerto(sorte: () => number, centro: Point, ocupados: readonly Point[], lado: number): Point {
  for (let tentativa = 0; tentativa < 10_000; tentativa += 1) {
    const i = Math.floor(centro.x / GRID) + Math.floor(sorte() * (2 * PERTO + 1)) - PERTO
    const j = Math.floor(centro.y / GRID) + Math.floor(sorte() * (2 * PERTO + 1)) - PERTO
    if (i < 0 || j < 0 || i >= lado || j >= lado) continue
    const p = { x: (i + 0.5) * GRID, y: (j + 0.5) * GRID }
    if (ocupados.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= 2 * GRID)) return p
  }
  throw new Error('sem lugar livre perto do posto')
}

/** A cena `sceneId` do mapa `mapa` (de `lado` casas), com `npcs` NPCs de rotina ligável (ids `${sceneId}-npc${i}`). */
function montarCena(mapa: MapaDoRobo, sceneId: string, lado: number, npcs: number, semente: number): { cena: CenaDaRotina; ids: string[] } {
  const sorte = sorteador(semente)
  const ocupados: Point[] = mapa.fichas.map((f) => ({ x: f.x, y: f.y }))
  const fichas: Token[] = []
  for (let i = 0; i < npcs; i += 1) {
    // O primeiro posto numa sala sorteada; os outros perto dele (dá para chegar em 10 s), às vezes atrás de parede ou porta trancada.
    const primeiro = pontoLivre(sorte, mapa.salas, ocupados)
    ocupados.push(primeiro)
    const postos = VALORES.map((_, k) => {
      if (k === 0) return primeiro
      const p = pontoPerto(sorte, primeiro, ocupados, lado)
      ocupados.push(p)
      return p
    })
    const inicio = postos[0] ?? { x: GRID / 2, y: GRID / 2 }
    const rotina = { estadoId: ESTADO, postos: postos.map((p, k) => ({ valor: VALORES[k] ?? '', sceneId, x: p.x, y: p.y })) }
    fichas.push({ id: `${sceneId}-npc${i}`, characterId: null, name: `NPC ${i}`, x: inicio.x, y: inicio.y, size: 1, image: null, npc: true, rotina })
  }
  const parados: Token[] = mapa.fichas.map((f) => ({ id: `${sceneId}-${f.id}`, characterId: null, name: f.id, x: f.x, y: f.y, size: 1, image: null }))
  const map: MapData = { ...createEmptyMap(sceneId, sceneId, lado, lado, GRID), walls: [...mapa.mapa.walls], tokens: [...fichas, ...parados] }
  return { cena: { sceneId, map }, ids: fichas.map((f) => f.id) }
}

/** As malhas que o motor vai pedir para os NPCs `ids` (a do piso e do tamanho de cada um), montadas de uma vez no cache dele. */
function montarAsMalhas(motor: MotorDosNpcs, cenas: readonly CenaDaRotina[], ids: readonly string[]): void {
  for (const cena of cenas) {
    for (const id of ids) {
      const entrada = entradaDaFicha(cena.map, id)
      if (entrada === null) continue
      const malha = motor.agenda.cache.malhaPara(entrada.mapa, entrada.raio)
      while (!avancarMalha(malha, Number.POSITIVE_INFINITY));
    }
  }
}

/**
 * Os números de `SEGUNDOS` simulados da rotina como o editor roda (tique de 200 ms, agenda regada a cada quadro de
 * 16 ms). `logico`: o relógio da agenda, levado à hora simulada de cada tique e quadro, com as malhas já montadas;
 * `null`, o de verdade, com a montagem dentro.
 */
function simular(cenasIniciais: readonly CenaDaRotina[], ids: readonly string[], logico: RelogioLogico | null) {
  const motor = motorComRelogio(logico === null ? () => performance.now() : logico.ler)
  if (logico !== null) montarAsMalhas(motor, cenasIniciais, ids)
  const quadrosPorTique = Math.floor(PASSO_DA_ROTINA_MS / QUADRO_DA_AGENDA_MS)
  const tiques = (SEGUNDOS * 1000) / PASSO_DA_ROTINA_MS
  let cenas = [...cenasIniciais]
  let andando: RotinasAndando = new Map()
  for (const id of ids) andando = ligarRotina(andando, cenas, id, ESTADOS, 0)
  const msDosTiques: number[] = []
  const msDosQuadros: number[] = []
  const andaram = new Set<string>()
  let chegadas = 0
  let desistencias = 0
  let portas = 0
  for (let t = 0; t < tiques; t += 1) {
    logico?.irPara(t * PASSO_DA_ROTINA_MS)
    const inicio = performance.now()
    const r = darPassoDaRotina(cenas, andando, ESTADOS, t * PASSO_DA_ROTINA_MS, new Set(), motor)
    cenas = cenas.map((c) => ({ ...c, map: comPortasDoNpc(moverNaCena(c.map, r.movimentos), r.portas.filter((p) => p.sceneId === c.sceneId)) }))
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
      logico?.irPara(t * PASSO_DA_ROTINA_MS + (q + 1) * QUADRO_DA_AGENDA_MS)
      const inicioDoQuadro = performance.now()
      if (motor.agenda.temTrabalho) motor.agenda.rodar(ORCAMENTO_POR_QUADRO_MS)
      msDosQuadros.push(performance.now() - inicioDoQuadro)
    }
  }
  return {
    /** Do relógio de verdade (no relógio lógico, só para o console). */
    ms: {
      tiques: msDosTiques.length,
      quadros: msDosQuadros.length,
      tiqueP50: Number(percentil(msDosTiques, 50).toFixed(2)),
      tiqueP95: Number(percentil(msDosTiques, 95).toFixed(2)),
      tiqueMax: Number(Math.max(...msDosTiques).toFixed(2)),
      quadroP50: Number(percentil(msDosQuadros, 50).toFixed(2)),
      quadroP95: Number(percentil(msDosQuadros, 95).toFixed(2)),
      quadroMax: Number(Math.max(...msDosQuadros).toFixed(2)),
    },
    /** Quem andou: depende de quantas fatias couberam, então só vale no relógio lógico. */
    logica: {
      npcs: ids.length,
      cenas: cenas.length,
      andaram: andaram.size,
      chegadas,
      desistencias,
      portas,
    },
    andaram,
  }
}

/** Uma rodada no relógio de verdade: os ms e quantos andaram (com a montagem das malhas dentro dos 10 s). */
function deVerdade(cenas: readonly CenaDaRotina[], ids: readonly string[]) {
  const { ms, logica } = simular(cenas, ids, null)
  return { ...ms, andaram: logica.andaram }
}

const semTarefaLonga = (r: { tiqueMax: number; quadroMax: number }) => r.tiqueMax < TAREFA_LONGA_MS && r.quadroMax < TAREFA_LONGA_MS

describe('desempenho da rotina pelo motor', () => {
  const grande = montarCena(gerado, CENA, LADO, NPCS, 30)
  const montadas = Array.from({ length: CENAS }, (_, k) =>
    montarCena(gerarMapaDoRobo(5100 + k, GRID, false, 1, { largura: LADO_DAS_CENAS, altura: LADO_DAS_CENAS }), `cena${k}`, LADO_DAS_CENAS, NPCS / CENAS, 40 + k),
  )
  const cenasMontadas = montadas.map((m) => m.cena)
  const idsMontados = montadas.flatMap((m) => m.ids)

  it('30 NPCs com a rotina ligada num mapa de 300 x 300 por 10 s, no relógio lógico: a maioria anda e alguém chega', () => {
    const { logica } = simular([grande.cena], grande.ids, relogioLogico())
    console.log(`DESEMPENHO-ROTINA-logico ${JSON.stringify(logica)}`)
    expect(logica.andaram).toBeGreaterThanOrEqual(NPCS / 2)
    expect(logica.chegadas).toBeGreaterThan(0)
  }, 120_000)

  it('30 NPCs com a rotina ligada num mapa de 300 x 300 por 10 s, no relógio de verdade: nenhuma tarefa >= 50 ms, e a malha fica pronta a tempo de a maioria andar', () => {
    const { escolhida, todas } = primeiraQueCumpre(
      () => deVerdade([grande.cena], grande.ids),
      (r) => semTarefaLonga(r) && r.andaram >= NPCS / 2,
    )
    console.log(`DESEMPENHO-ROTINA-relogio ${JSON.stringify({ rodadas: todas })}`)
    expect(escolhida.tiqueMax).toBeLessThan(TAREFA_LONGA_MS)
    expect(escolhida.quadroMax).toBeLessThan(TAREFA_LONGA_MS)
    expect(escolhida.andaram).toBeGreaterThanOrEqual(NPCS / 2)
  }, 120_000)

  it(`${CENAS} cenas carregadas (mais malhas em uso que as ${MALHAS_GUARDADAS} guardadas sem uso), 3 NPCs em cada, por 10 s, no relógio lógico: a maioria anda, em toda cena`, () => {
    const { logica, andaram } = simular(cenasMontadas, idsMontados, relogioLogico())
    const cenasComQuemAndou = new Set(montadas.filter((m) => m.ids.some((id) => andaram.has(id))).map((m) => m.cena.sceneId))
    console.log(`DESEMPENHO-ROTINA-CENAS-logico ${JSON.stringify({ ...logica, cenasComQuemAndou: cenasComQuemAndou.size })}`)
    expect(CENAS).toBeGreaterThan(MALHAS_GUARDADAS)
    expect(logica.andaram).toBeGreaterThan(idsMontados.length / 2)
    expect(cenasComQuemAndou.size).toBe(CENAS)
    expect(logica.chegadas).toBeGreaterThan(0)
  }, 120_000)

  it(`${CENAS} cenas carregadas, 3 NPCs em cada, por 10 s, no relógio de verdade: nenhuma tarefa >= 50 ms, e as malhas ficam prontas a tempo de a maioria andar`, () => {
    const { escolhida, todas } = primeiraQueCumpre(
      () => deVerdade(cenasMontadas, idsMontados),
      (r) => semTarefaLonga(r) && r.andaram > idsMontados.length / 2,
    )
    console.log(`DESEMPENHO-ROTINA-CENAS-relogio ${JSON.stringify({ rodadas: todas })}`)
    expect(escolhida.tiqueMax).toBeLessThan(TAREFA_LONGA_MS)
    expect(escolhida.quadroMax).toBeLessThan(TAREFA_LONGA_MS)
    expect(escolhida.andaram).toBeGreaterThan(idsMontados.length / 2)
  }, 120_000)
})
