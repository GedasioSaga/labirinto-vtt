/**
 * LUZ L2 — a visão do jogador depende do período DA CENA dele, pelo pacote
 * REAL do host (`createHostSession` + `broadcast`). `visaoPorPeriodo` em casas
 * (0 apaga a visão); sem o campo, noite = metade e tarde = cheia; dia sempre
 * cheia; cena interior ignora; período fixo vale. À noite, além do raio, só o
 * claro das luzes na linha de visão chega.
 *
 * Os 500 cenários sem o campo comparam com o veredito gravado ANTES da L2
 * (`luzL2.vereditoDeHoje.json`, main 7694da6e): igual em tudo, menos o que o
 * lampião acende à noite — e isso tem de estar sob uma luz, na linha de visão.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { periodoDaCena, raioNoPeriodo } from '../lib/periodo'
import { playerVisionRadius } from '../lib/sceneVision'
import type { Light, MapData, Periodo, RegionPoint, Token, Wall } from '../types/map'
import { createHostSession, type HostWorld } from './hostSession'
import { cenario, CODIGO, GRID, RAIO_BASE, snapshotDoHeroi, vereditoDoHost, type Cenario } from './luzL2.cenarios.fixture'
import vereditoDeHoje from './luzL2.vereditoDeHoje.json'

const HEROI = { x: 1000, y: 1000 }
const OITO_CASAS = 8 * GRID

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function luz(id: string, x: number, y: number, radius: number): Light {
  return { id, x, y, radius, color: '#ffb347', intensity: 0.8 }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function vila(extra: Partial<MapData> = {}, tokens: Token[] = [], lights: Light[] = [], walls: Wall[] = []): MapData {
  return { ...createEmptyMap('vila', 'Vila', 40, 40, GRID), externa: true, tokens: [ficha('heroi', HEROI.x, HEROI.y), ...tokens], lights, walls, ...extra }
}

function snapshot(map: MapData, periodo: Periodo) {
  return snapshotDoHeroi({ map, periodo, heroi: ficha('heroi', HEROI.x, HEROI.y) })
}

function alcance(vision: RegionPoint[][]): number {
  const pontos = vision.flat()
  return pontos.length === 0 ? 0 : Math.max(...pontos.map((p) => Math.hypot(p.x - HEROI.x, p.y - HEROI.y)))
}

/** O raio que a regra dá ao herói (`raioNoPeriodo` sobre a visão cheia da cena). */
function raioDaRegra(map: MapData, sessao: Periodo): number {
  return raioNoPeriodo(playerVisionRadius(map, RAIO_BASE, 1), periodoDaCena(map, sessao), map, 1)
}

describe('visão por período no pacote real do host (tabela)', () => {
  const casos: { nome: string; extra: Partial<MapData>; sessao: Periodo; raio: number }[] = [
    { nome: 'sem campo, noite: metade', extra: {}, sessao: 'noite', raio: 350 },
    { nome: 'noite 3 casas', extra: { visaoPorPeriodo: { noite: 3 } }, sessao: 'noite', raio: 150 },
    { nome: 'noite maior que a cheia: a cheia', extra: { visaoPorPeriodo: { noite: 30 } }, sessao: 'noite', raio: RAIO_BASE },
    { nome: 'tarde só, de tarde', extra: { visaoPorPeriodo: { tarde: 4 } }, sessao: 'tarde', raio: 200 },
    { nome: 'tarde só, à noite: a regra de antes', extra: { visaoPorPeriodo: { tarde: 4 } }, sessao: 'noite', raio: 350 },
    { nome: 'dia ignora o campo', extra: { visaoPorPeriodo: { tarde: 1, noite: 0 } }, sessao: 'dia', raio: RAIO_BASE },
    { nome: 'cena interior ignora o campo', extra: { externa: undefined, visaoPorPeriodo: { noite: 1 } }, sessao: 'noite', raio: RAIO_BASE },
    { nome: 'periodoFixo na noite com a sessão de dia', extra: { externa: undefined, periodoFixo: 'noite', visaoPorPeriodo: { noite: 2 } }, sessao: 'dia', raio: 100 },
    { nome: 'com "Visão nesta cena" (10 casas), noite 4', extra: { visionCells: 10, visaoPorPeriodo: { noite: 4 } }, sessao: 'noite', raio: 200 },
  ]
  for (const { nome, extra, sessao, raio } of casos) {
    it(nome, () => {
      const a = alcance(snapshot(vila(extra), sessao).vision)
      expect(a).toBeGreaterThan(raio - 5)
      expect(a).toBeLessThanOrEqual(raio + 1)
    })
  }

  it('noite 0: visão nenhuma, e só a própria ficha chega', () => {
    const snap = snapshot(vila({ visaoPorPeriodo: { noite: 0 } }, [ficha('rato', HEROI.x + 60, HEROI.y)]), 'noite')
    expect(snap.vision.every((anel) => anel.length < 3)).toBe(true)
    expect(snap.map.tokens.map((t) => t.id)).toEqual(['heroi'])
  })
})

describe('vazamento à noite no pacote real do host', () => {
  const NOITE_3: Partial<MapData> = { visaoPorPeriodo: { noite: 3 } }

  it('NPC no escuro a 8 casas NÃO chega; NPC sob o lampião, com a linha livre, chega', () => {
    const map = vila(NOITE_3, [ficha('lobo', HEROI.x + OITO_CASAS, HEROI.y), ficha('guarda', HEROI.x, HEROI.y + OITO_CASAS)], [luz('lampiao', HEROI.x, HEROI.y + OITO_CASAS + 20, 100)])
    const snap = snapshot(map, 'noite')
    expect(snap.map.tokens.map((t) => t.id).sort()).toEqual(['guarda', 'heroi'])
    expect(JSON.stringify(snap)).not.toContain('"lobo"')
    // De dia, com a visão cheia, os dois estão à vista.
    expect(snapshot(map, 'dia').map.tokens.map((t) => t.id).sort()).toEqual(['guarda', 'heroi', 'lobo'])
  })

  it('luz atrás de parede não revela', () => {
    const map = vila(NOITE_3, [ficha('ladrao', HEROI.x - OITO_CASAS, HEROI.y)], [luz('vela', HEROI.x - OITO_CASAS, HEROI.y, 120)], [parede('muro', 800, 700, 800, 1300)])
    const snap = snapshot(map, 'noite')
    expect(snap.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(snap.vision.flat().every((p) => p.x >= 799)).toBe(true)
  })

  it('períodos de outra cena nunca entram: cada um vê com a noite da PRÓPRIA cena', () => {
    let n = 0
    const world: HostWorld = {
      open: { sceneId: 's-vila', name: 'Vila', map: vila(NOITE_3) },
      background: [{ sceneId: 's-campo', name: 'Campo', map: { ...vila({ visaoPorPeriodo: { noite: 12 } }), id: 'campo', tokens: [ficha('bruno', HEROI.x, HEROI.y)] } }],
    }
    const s = createHostSession({ code: CODIGO, visionRadius: RAIO_BASE, now: () => 0, randomId: () => `id-${(n += 1)}`, getPeriodo: () => 'noite' })
    const entra = (clientId: string, name: string): string => {
      const welcome = s.handleMessage(clientId, { type: 'join', code: CODIGO, name }, world).outbound[0]?.msg
      if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
      return welcome.playerId
    }
    s.assignToken(entra('c1', 'Ana'), 'heroi')
    s.assignToken(entra('c2', 'Bruno'), 'bruno')
    const r = s.broadcast(world)
    const de = (clientId: string) => {
      const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
      if (msg?.type !== 'snapshot') throw new Error(`sem snapshot para ${clientId}`)
      return msg
    }
    expect(alcance(de('c1').vision)).toBeLessThanOrEqual(151)
    expect(alcance(de('c2').vision)).toBeGreaterThan(595)
    expect(JSON.stringify(r.outbound)).not.toContain('"visaoPorPeriodo"')
  })
})

/** O segmento a-b cruza a parede (encostar conta: na dúvida, bloqueia). */
function cruza(a: RegionPoint, b: RegionPoint, w: Wall): boolean {
  const lado = (p: RegionPoint, q: RegionPoint, r: RegionPoint): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const p1 = { x: w.x1, y: w.y1 }
  const p2 = { x: w.x2, y: w.y2 }
  const d1 = lado(p1, p2, a)
  const d2 = lado(p1, p2, b)
  const d3 = lado(a, b, p1)
  const d4 = lado(a, b, p2)
  return d1 * d2 <= 0 && d3 * d4 <= 0
}

function livre(a: RegionPoint, b: RegionPoint, walls: readonly Wall[]): boolean {
  return !walls.some((w) => w.blocksLight && cruza(a, b, w))
}

/** Centro e borda da ficha: o recorte vê a ficha pela borda (`TOKEN_RIM_FRACTION` < 1, então a borda cheia é folga). */
function amostras(t: Token): RegionPoint[] {
  const borda = Array.from({ length: 16 }, (_, i) => ({ x: t.x + Math.cos((i / 16) * Math.PI * 2) * (GRID / 2), y: t.y + Math.sin((i / 16) * Math.PI * 2) * (GRID / 2) }))
  return [{ x: t.x, y: t.y }, ...borda]
}

/**
 * A REGRA: a ficha pode chegar se algum ponto dela está na linha de visão do
 * herói e (perto o bastante para a visão do período) ou (no claro de uma luz,
 * na linha da luz), com luz valendo à noite e em cena escura.
 */
function permitido(c: Cenario, t: Token, soPelaLuz = false): boolean {
  const periodo = periodoDaCena(c.map, c.periodo)
  const raio = raioDaRegra(c.map, c.periodo)
  if (!(raio > 0)) return false
  const proprio = c.map.dark === true ? Math.min(raio, GRID) : raio
  const luzes = c.map.dark === true || periodo === 'noite' ? c.map.lights : []
  const heroi = { x: c.heroi.x, y: c.heroi.y }
  return amostras(t).some(
    (p) =>
      livre(heroi, p, c.map.walls) &&
      ((!soPelaLuz && Math.hypot(p.x - heroi.x, p.y - heroi.y) <= proprio + 1) ||
        luzes.some((l) => Math.hypot(p.x - l.x, p.y - l.y) <= l.radius + 1 && livre({ x: l.x, y: l.y }, p, c.map.walls))),
  )
}

describe('pedidos sorteados (semente fixa)', () => {
  it('1.000 cenários com visaoPorPeriodo: nenhuma ficha chega fora da regra', () => {
    let pelaLuz = 0
    let chegaram = 0
    for (let semente = 1001; semente <= 2000; semente += 1) {
      const c = cenario(semente, true)
      const fichas = new Map(c.map.tokens.map((t) => [t.id, t]))
      for (const id of vereditoDoHost(c)) {
        const t = fichas.get(id)
        if (t === undefined || id === c.heroi.id) continue
        chegaram += 1
        expect(permitido(c, t), `semente ${semente}, ficha ${id}`).toBe(true)
        if (!permitido({ ...c, map: { ...c.map, lights: [] } }, t)) pelaLuz += 1
      }
    }
    console.info(`[luz-l2] 1000 cenários: ${chegaram} fichas chegaram, ${pelaLuz} só pela luz`)
    expect(pelaLuz).toBeGreaterThan(0)
  })

  it('500 mapas sem o campo: o veredito de antes da L2, salvo o que o lampião acende à noite', () => {
    const hoje: Record<string, string[] | undefined> = vereditoDeHoje
    let acesos = 0
    let iguais = 0
    for (let semente = 1; semente <= 500; semente += 1) {
      const c = cenario(semente)
      expect(c.map.visaoPorPeriodo).toBeUndefined()
      const antes = hoje[String(semente)] ?? []
      const agora = vereditoDoHost(c)
      const novos = agora.filter((id) => !antes.includes(id))
      expect(antes.every((id) => agora.includes(id)), `semente ${semente}: sumiu ficha`).toBe(true)
      const luzDaNoite = c.map.dark !== true && periodoDaCena(c.map, c.periodo) === 'noite' && c.map.lights.length > 0
      if (!luzDaNoite) expect(agora, `semente ${semente}`).toEqual(antes)
      for (const id of novos) {
        const t = c.map.tokens.find((f) => f.id === id)
        expect(t !== undefined && permitido(c, t, true), `semente ${semente}, ficha ${id} chegou sem luz`).toBe(true)
      }
      if (novos.length === 0) iguais += 1
      else acesos += 1
    }
    console.info(`[luz-l2] 500 mapas antigos: ${iguais} iguais, ${acesos} com ficha nova sob lampião à noite`)
  })
})
