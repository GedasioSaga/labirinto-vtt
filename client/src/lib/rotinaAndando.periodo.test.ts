/**
 * ROTINA POR PERÍODO (Caminhos F3) — `PostoDaRotina.periodo?`: o loop da
 * rotina andando usa só os postos do período da cena onde o NPC está
 * (`periodoDaCena`: fixo > externa segue a sessão > interior = dia). Posto
 * sem `periodo` vale em todos. Na troca de período o NPC CAMINHA até o posto
 * novo pelo motor, passo a passo, nunca teletransporta.
 *
 * Metas (escritas antes do código):
 * - troca dia para noite no meio do caminho: o NPC larga o posto do dia e
 *   anda até o da noite; nenhum passo maior que 2 casas/s x 0,2 s + 1 px; não
 *   chega ao posto do dia depois da troca;
 * - cena interior ignora a troca; `periodoFixo` manda mais que a sessão;
 * - nenhum posto no período: fica onde está (sem passo) e retoma quando o
 *   período volta;
 * - posto sem `periodo`: as MESMAS posições da main (mesma semente), em
 *   qualquer período da sessão.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../pixi/world'
import type { MapData, Periodo, PostoDaRotina, Token } from '../types/map'
import { gerarMapaDoRobo, type Sala, sorteador } from './caminhamento/robo.fixture'
import { comPortasDoNpc, type MotorDosNpcs, motorImediato } from './caminhamento/tiqueDosNpcs'
import type { EstadoDoMundo } from './estadoDoMundo'
import { createEmptyMap } from './mapFactory'
import { darPassoDaRotina, ligarRotina, PASSO_DA_ROTINA_MS, passoEmPx, type RotinasAndando } from './rotinaAndando'
import { type CenaDaRotina, moverNaCena } from './rotinaDoNpc'

const G = 64
/** 2 casas/s x 0,2 s, mais 1 px de folga de arredondamento. */
const MAIOR_PASSO = passoEmPx(G) + 1
const APITO: EstadoDoMundo = { id: 'apito', nome: 'Apito', valores: ['Aurora', 'Meio', 'Brasa'], atual: 'Aurora' }
const ESTADOS = [APITO]
const CENA = 'praca'

const AURORA = { x: 160, y: 224 }
const MEIO = { x: 736, y: 224 }
const BRASA = { x: 160, y: 544 }

function posto(valor: string, p: Point, periodo?: Periodo): PostoDaRotina {
  return { valor, sceneId: CENA, x: p.x, y: p.y, ...(periodo === undefined ? {} : { periodo }) }
}

function tobias(p: Point, postos: PostoDaRotina[]): Token {
  return { id: 'tobias', characterId: null, name: 'Irmão Tobias', x: p.x, y: p.y, size: 1, image: null, npc: true, rotina: { estadoId: APITO.id, postos } }
}

/** Praça aberta de 15 x 10 casas; `marcas`: externa, periodoFixo. */
function praca(tokens: Token[], marcas: Partial<Pick<MapData, 'externa' | 'periodoFixo'>> = { externa: true }): CenaDaRotina[] {
  return [{ sceneId: CENA, map: { ...createEmptyMap(CENA, CENA, 15, 10, G), ...marcas, tokens } }]
}

interface Mundo {
  cenas: CenaDaRotina[]
  andando: RotinasAndando
  motor: MotorDosNpcs
  /** O tique seguinte. */
  t: number
}

function ligado(cenas: CenaDaRotina[], ids: readonly string[]): Mundo {
  let andando: RotinasAndando = new Map()
  for (const id of ids) andando = ligarRotina(andando, cenas, id, ESTADOS, 0)
  return { cenas, andando, motor: motorImediato(), t: 0 }
}

/** Um tique com a sessão em `sessao`, aplicado no mapa como o editor aplica. */
function tique(m: Mundo, sessao: Periodo | null, estados: readonly EstadoDoMundo[] = ESTADOS): void {
  const r = darPassoDaRotina(m.cenas, m.andando, estados, m.t * PASSO_DA_ROTINA_MS, new Set(), m.motor, sessao)
  m.cenas = m.cenas.map((c) => ({ ...c, map: comPortasDoNpc(moverNaCena(c.map, r.movimentos), r.portas.filter((p) => p.sceneId === c.sceneId)) }))
  m.andando = r.andando
  m.t += 1
}

function ondeEsta(m: Mundo, id = 'tobias'): Point {
  for (const c of m.cenas) {
    const t = c.map.tokens.find((token) => token.id === id)
    if (t !== undefined) return { x: t.x, y: t.y }
  }
  throw new Error(`${id} sumiu do mapa`)
}

const mesmoPonto = (a: Point, b: Point) => a.x === b.x && a.y === b.y

/** `n` tiques na sessão `sessao`: as posições depois de cada um, e o maior passo dado. */
function andar(m: Mundo, n: number, sessao: Periodo | null): { posicoes: Point[]; maiorPasso: number } {
  const posicoes: Point[] = []
  let antes = ondeEsta(m)
  let maiorPasso = 0
  for (let k = 0; k < n; k += 1) {
    tique(m, sessao)
    const agora = ondeEsta(m)
    maiorPasso = Math.max(maiorPasso, Math.hypot(agora.x - antes.x, agora.y - antes.y))
    posicoes.push(agora)
    antes = agora
  }
  return { posicoes, maiorPasso }
}

describe('rotina por período: troca no meio do caminho, sem teleporte', () => {
  it('dia para noite: larga o posto do dia, anda até o da noite e fica nele; de volta ao dia, anda de novo', () => {
    const m = ligado(praca([tobias(AURORA, [posto('Aurora', AURORA, 'dia'), posto('Meio', MEIO, 'dia'), posto('Brasa', BRASA, 'noite')])]), ['tobias'])
    // De dia: rumo ao Meio (o posto seguinte ao da Aurora).
    const dia = andar(m, 4, 'dia')
    expect(ondeEsta(m).x).toBeGreaterThan(AURORA.x)
    expect(ondeEsta(m).y).toBe(AURORA.y)
    // Anoitece: 30 tiques bastam para os ~13 de caminhada até a Brasa.
    const noite = andar(m, 30, 'noite')
    expect(noite.posicoes.some((p) => mesmoPonto(p, MEIO))).toBe(false)
    expect(ondeEsta(m)).toEqual(BRASA)
    // O único posto da noite: fica nele, loop após loop.
    const fica = andar(m, 40, 'noite')
    expect(fica.posicoes.every((p) => mesmoPonto(p, BRASA))).toBe(true)
    // Amanhece: sai da Brasa rumo à Aurora (o seguinte na ordem do apito), andando.
    const manha = andar(m, 40, 'dia')
    expect(manha.posicoes.some((p) => mesmoPonto(p, AURORA))).toBe(true)
    for (const trecho of [dia, noite, fica, manha]) expect(trecho.maiorPasso).toBeLessThanOrEqual(MAIOR_PASSO)
  })

  it('posto sem período vale em todos: de dia o loop fica nele, à noite entra o da noite', () => {
    const m = ligado(praca([tobias(AURORA, [posto('Aurora', AURORA), posto('Brasa', BRASA, 'noite')])]), ['tobias'])
    const dia = andar(m, 40, 'dia')
    expect(dia.posicoes.every((p) => mesmoPonto(p, AURORA))).toBe(true)
    const noite = andar(m, 30, 'noite')
    expect(noite.posicoes.some((p) => mesmoPonto(p, BRASA))).toBe(true)
    expect(noite.maiorPasso).toBeLessThanOrEqual(MAIOR_PASSO)
  })

  it('cena interior ignora a troca: com a sessão à noite, segue os postos do dia', () => {
    const m = ligado(praca([tobias(AURORA, [posto('Aurora', AURORA, 'dia'), posto('Meio', MEIO, 'dia'), posto('Brasa', BRASA, 'noite')])], {}), ['tobias'])
    const noite = andar(m, 30, 'noite')
    expect(noite.posicoes.some((p) => mesmoPonto(p, MEIO))).toBe(true)
    expect(noite.posicoes.some((p) => mesmoPonto(p, BRASA))).toBe(false)
  })

  it('cena com periodoFixo noite: os postos da noite, com a sessão de dia', () => {
    const m = ligado(praca([tobias(AURORA, [posto('Aurora', AURORA, 'dia'), posto('Meio', MEIO, 'dia'), posto('Brasa', BRASA, 'noite')])], { periodoFixo: 'noite' }), ['tobias'])
    const dia = andar(m, 30, 'dia')
    expect(dia.posicoes.some((p) => mesmoPonto(p, BRASA))).toBe(true)
    expect(dia.posicoes.some((p) => mesmoPonto(p, MEIO))).toBe(false)
  })

  it('nenhum posto no período: fica onde está, sem passo; o período volta e ela segue', () => {
    const m = ligado(praca([tobias(AURORA, [posto('Aurora', AURORA, 'dia'), posto('Meio', MEIO, 'dia')])]), ['tobias'])
    andar(m, 4, 'dia')
    const parou = ondeEsta(m)
    expect(parou.x).toBeGreaterThan(AURORA.x)
    const tarde = andar(m, 20, 'tarde')
    expect(tarde.posicoes.every((p) => mesmoPonto(p, parou))).toBe(true)
    expect(m.andando.has('tobias')).toBe(true)
    const dia = andar(m, 30, 'dia')
    expect(dia.posicoes.some((p) => mesmoPonto(p, MEIO))).toBe(true)
    expect(dia.maiorPasso).toBeLessThanOrEqual(MAIOR_PASSO)
  })

  it('ligada já à noite: sai rumo ao posto da noite, não ao do dia', () => {
    const m = ligado(praca([tobias(AURORA, [posto('Aurora', AURORA, 'dia'), posto('Meio', MEIO, 'dia'), posto('Brasa', BRASA, 'noite')])]), ['tobias'])
    andar(m, 2, 'noite')
    expect(ondeEsta(m).x).toBe(AURORA.x)
    expect(ondeEsta(m).y).toBeGreaterThan(AURORA.y)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Posto sem período: igual à main
// ───────────────────────────────────────────────────────────────────────────

const LADO = 40
const NPCS = 10
const POSTOS = 3
const TIQUES = 200
const SEMENTE = 7331
const ESTADO_DO_ROBO: EstadoDoMundo = { id: 'turno', nome: 'Turno', valores: ['p0', 'p1', 'p2'], atual: 'p0' }

/**
 * A digital das posições e portas dos `NPCS` em `TIQUES` tiques, com os postos
 * SEM período, capturada na main 44c59b9a antes da F3 (sem o argumento da
 * sessão: a função nem o conhecia). Muda se o motor de caminhos mudar o
 * trajeto; aí se captura de novo, com o mesmo cenário, na main da época.
 */
const DIGITAL_DA_MAIN = '2d57ae78'

function fnv1a(texto: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Um centro de casa numa sala sorteada, a 2 casas de tudo que já foi posto. */
function pontoLivre(sorte: () => number, salas: readonly Sala[], ocupados: readonly Point[]): Point {
  for (let tentativa = 0; tentativa < 10_000; tentativa += 1) {
    const sala = salas[Math.floor(sorte() * salas.length)]
    if (sala === undefined) continue
    const x = (sala.x0 + Math.floor(sorte() * (sala.x1 - sala.x0)) + 0.5) * G
    const y = (sala.y0 + Math.floor(sorte() * (sala.y1 - sala.y0)) + 0.5) * G
    if (ocupados.every((p) => Math.hypot(p.x - x, p.y - y) >= 2 * G)) return { x, y }
  }
  throw new Error('sem lugar livre no mapa gerado')
}

/** O mapa do robô de `LADO` casas, externo, com `NPCS` NPCs de `POSTOS` postos sem período cada. */
function vilaSemPeriodo(): { cenas: CenaDaRotina[]; ids: string[] } {
  const gerado = gerarMapaDoRobo(SEMENTE, G, false, 1, { largura: LADO, altura: LADO })
  const sorte = sorteador(SEMENTE)
  const ocupados: Point[] = gerado.fichas.map((f) => ({ x: f.x, y: f.y }))
  const npcs: Token[] = []
  for (let i = 0; i < NPCS; i += 1) {
    const pontos = Array.from({ length: POSTOS }, () => {
      const p = pontoLivre(sorte, gerado.salas, ocupados)
      ocupados.push(p)
      return p
    })
    const inicio = pontos[0] ?? { x: G / 2, y: G / 2 }
    const postos = pontos.map((p, k) => ({ valor: ESTADO_DO_ROBO.valores[k] ?? '', sceneId: CENA, x: p.x, y: p.y }))
    npcs.push({ id: `npc${i}`, characterId: null, name: `NPC ${i}`, x: inicio.x, y: inicio.y, size: 1, image: null, npc: true, rotina: { estadoId: ESTADO_DO_ROBO.id, postos } })
  }
  const parados: Token[] = gerado.fichas.map((f) => ({ id: f.id, characterId: null, name: f.id, x: f.x, y: f.y, size: 1, image: null }))
  const map: MapData = { ...createEmptyMap(CENA, CENA, LADO, LADO, G), externa: true, walls: [...gerado.mapa.walls], tokens: [...npcs, ...parados] }
  return { cenas: [{ sceneId: CENA, map }], ids: npcs.map((n) => n.id) }
}

/** O trajeto dos NPCs, tique a tique (posições e portas). `sessao`: ausente = a chamada da main, sem o argumento. */
function trajeto(sessao?: Periodo | null): { digital: string; passos: number; portas: number } {
  const { cenas: iniciais, ids } = vilaSemPeriodo()
  let andando: RotinasAndando = new Map()
  for (const id of ids) andando = ligarRotina(andando, iniciais, id, [ESTADO_DO_ROBO], 0)
  let cenas = iniciais
  const motor = motorImediato()
  const linhas: string[] = []
  let passos = 0
  let portas = 0
  for (let t = 0; t < TIQUES; t += 1) {
    const agora = t * PASSO_DA_ROTINA_MS
    const r =
      sessao === undefined
        ? darPassoDaRotina(cenas, andando, [ESTADO_DO_ROBO], agora, new Set(), motor)
        : darPassoDaRotina(cenas, andando, [ESTADO_DO_ROBO], agora, new Set(), motor, sessao)
    cenas = cenas.map((c) => ({ ...c, map: comPortasDoNpc(moverNaCena(c.map, r.movimentos), r.portas.filter((p) => p.sceneId === c.sceneId)) }))
    andando = r.andando
    passos += r.movimentos.length
    portas += r.portas.length
    const mapa = cenas[0]?.map
    const npcs = mapa === undefined ? [] : mapa.tokens.filter((tk) => ids.includes(tk.id)).map((tk) => `${tk.id}:${tk.x},${tk.y}`)
    linhas.push(`${t}|${npcs.join(';')}|${r.portas.map((p) => `${p.wallId}${p.aberta ? '+' : '-'}`).join(',')}`)
  }
  return { digital: fnv1a(linhas.join('\n')), passos, portas }
}

describe('posto sem período: igual à main', () => {
  it(`${NPCS} NPCs, ${TIQUES} tiques, semente ${SEMENTE}: a mesma digital da main, em qualquer período da sessão`, () => {
    const daMain = trajeto()
    console.log(`ROTINA-SEM-PERIODO ${JSON.stringify(daMain)}`)
    // O cenário anda de verdade (não é a digital de ninguém parado).
    expect(daMain.passos).toBeGreaterThan(NPCS * 20)
    expect(daMain.digital).toBe(DIGITAL_DA_MAIN)
    const sessoes: (Periodo | null)[] = [null, 'dia', 'tarde', 'noite']
    for (const sessao of sessoes) expect(trajeto(sessao).digital).toBe(DIGITAL_DA_MAIN)
  })
})
