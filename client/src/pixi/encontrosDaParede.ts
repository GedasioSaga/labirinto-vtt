import type { MaterialDaParede } from '../types/map'

/**
 * OS ENCONTROS das paredes com textura (`paredeEmPecas.ts`): como cada ponta de
 * cada parede acaba (solta, em dobra, num pilar, embutida noutra parede) e o
 * polígono de cada PILAR (canto em L, T de três pontas, cruz, espessuras
 * diferentes). Função pura: só os pontos e as espessuras entram.
 */

/** Uma parede com textura, já com a espessura e a opacidade resolvidas. */
export interface TrechoDeEntrada {
  readonly id: string
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  /** Meia espessura em px do mundo. */
  readonly h: number
  readonly alpha: number
  readonly material: MaterialDaParede
  /** Sai na tela? As outras só dão forma aos encontros (o jogador recebe todas as do nó). */
  readonly desenha: boolean
}

/**
 * Como a ponta acaba. O corte da ponta, no quadro dela (s = distância da ponta
 * para dentro da parede, t = para o lado esquerdo de quem entra): `s = recuo + k * t`.
 */
export interface Ponta {
  tipo: 'solta' | 'dobra' | 'pilar' | 'embutida' | 'junta'
  recuo: number
  k: number
}

/** A parede no sentido canônico (o mesmo para quem a riscou de lá para cá): origem, direção, comprimento. */
export interface Trecho {
  readonly entrada: TrechoDeEntrada
  readonly ax: number
  readonly ay: number
  readonly dx: number
  readonly dy: number
  readonly comp: number
  readonly h: number
  /** A ponta da origem e a ponta do fim. */
  readonly pontas: [Ponta, Ponta]
}

/** O pilar de um encontro: o polígono (sentido anti-horário nos números) e quais arestas encostam numa parede. */
export interface Pilar {
  /** x, y de cada vértice. */
  readonly pontos: number[]
  /** `interna[i]`: a aresta do vértice i ao seguinte é o corte de uma parede (sem contorno nem sombra macia). */
  readonly interna: boolean[]
  /** O nó do encontro e a direção da parede dona (o quadro da tampa). */
  readonly x: number
  readonly y: number
  readonly ox: number
  readonly oy: number
  readonly h: number
  readonly material: MaterialDaParede
  readonly alpha: number
  readonly desenha: boolean
}

export interface Encontros {
  readonly trechos: Trecho[]
  readonly pilares: Pilar[]
}

/** A dobra de duas paredes iguais até este ângulo fecha na bissetriz; acima, pilar. */
const COS_DA_DOBRA = Math.cos((55 * Math.PI) / 180)
/** O encontro não alcança mais que isto (em meias espessuras) dentro de cada parede: canto muito fechado. */
const ALCANCE_DO_PILAR = 2.5
/** A quina de fora mais longe que isto (em meias espessuras) é chanfrada. */
const ALCANCE_DA_QUINA = 1.7
/** A ponta embutida precisa chegar na outra parede com pelo menos este seno (uns 15 graus). */
const SENO_MINIMO_DO_EMBUTIDO = 0.26
/** O pilar menor que isto (px²) não é pilar: a emenda reta de duas paredes diferentes. */
const AREA_MINIMA_DO_PILAR = 1
const PERTO = 1e-6

function chaveDoPonto(x: number, y: number): string {
  return `${Math.round(x * 1000)},${Math.round(y * 1000)}`
}

/** A chegada de uma parede num nó: a ponta dela e a direção de saída (do nó para dentro da parede). */
interface Chegada {
  readonly t: Trecho
  readonly fim: 0 | 1
  readonly ox: number
  readonly oy: number
  readonly angulo: number
}

function mesmoGrupo(a: Trecho, b: Trecho): boolean {
  return a.entrada.material === b.entrada.material && Math.abs(a.h - b.h) <= PERTO && a.entrada.alpha === b.entrada.alpha
}

/** A parede no sentido canônico: para a direita; a vertical, para baixo. */
function trechoDe(e: TrechoDeEntrada): Trecho | null {
  const comp = Math.hypot(e.x2 - e.x1, e.y2 - e.y1)
  if (!(comp > PERTO) || !(e.h > 0)) return null
  let dx = (e.x2 - e.x1) / comp
  let dy = (e.y2 - e.y1) / comp
  const invertida = dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)
  if (invertida) {
    dx = -dx
    dy = -dy
  }
  const solta = (): Ponta => ({ tipo: 'solta', recuo: 0, k: 0 })
  return { entrada: e, ax: invertida ? e.x2 : e.x1, ay: invertida ? e.y2 : e.y1, dx, dy, comp, h: e.h, pontas: [solta(), solta()] }
}

/** A dobra suave de duas paredes iguais: o corte de cada uma na bissetriz. */
function dobrar(a: Chegada, b: Chegada): void {
  const h = a.t.h
  const cruz = a.ox * b.oy - a.oy * b.ox
  let ka = 0
  let kb = 0
  if (Math.abs(cruz) > 1e-6) {
    // A quina de dentro: a borda esquerda de quem tem a outra à esquerda com a borda direita da outra.
    const [p, q, c] = cruz > 0 ? [a, b, cruz] : [b, a, -cruz]
    const rx = p.oy * h + q.oy * h
    const ry = -p.ox * h - q.ox * h
    // (P2 - P1) com P1 = n_p * h e P2 = -n_q * h, n = (-oy, ox).
    const sp = (rx * q.oy - ry * q.ox) / c
    const tq = (rx * p.oy - ry * p.ox) / c
    const kp = sp / h
    const kq = -tq / h
    ka = p === a ? kp : kq
    kb = p === a ? kq : kp
  }
  a.t.pontas[a.fim] = { tipo: 'dobra', recuo: 0, k: ka }
  b.t.pontas[b.fim] = { tipo: 'dobra', recuo: 0, k: kb }
}

/**
 * O pilar do nó: o miolo do encontro das paredes, de borda a borda. Cada parede é
 * cortada reta onde o encontro acaba dentro dela (`recuo`). Sem miolo (duas
 * paredes diferentes emendadas em linha reta), as pontas viram junta.
 */
function levantarPilar(x: number, y: number, chegadas: Chegada[]): Pilar | null {
  const ordem = [...chegadas].sort((p, q) => p.angulo - q.angulo)
  const n = ordem.length
  const recuo = new Array<number>(n).fill(0)
  const quinas: number[][] = []
  for (let i = 0; i < n; i += 1) {
    const p = ordem[i]
    const q = ordem[(i + 1) % n]
    // A borda esquerda de p (n_p * h_p) com a borda direita de q (-n_q * h_q), relativas ao nó.
    const p1x = -p.oy * p.t.h
    const p1y = p.ox * p.t.h
    const p2x = q.oy * q.t.h
    const p2y = -q.ox * q.t.h
    const cruz = p.ox * q.oy - p.oy * q.ox
    if (Math.abs(cruz) < 1e-4) {
      quinas.push([x + p1x, y + p1y, x + p2x, y + p2y])
      continue
    }
    const rx = p2x - p1x
    const ry = p2y - p1y
    let s = (rx * q.oy - ry * q.ox) / cruz
    let t = (rx * p.oy - ry * p.ox) / cruz
    const cx = p1x + p.ox * s
    const cy = p1y + p.oy * s
    const maior = Math.max(p.t.h, q.t.h)
    if (s > 0 || t > 0) {
      // Quina de dentro. Canto fechado demais: o encontro para no alcance e as paredes se cobrem dali em diante.
      const limite = ALCANCE_DO_PILAR * maior
      if (s > limite || t > limite) {
        s = Math.min(s, limite)
        t = Math.min(t, limite)
        quinas.push([])
      } else {
        quinas.push([x + cx, y + cy])
      }
      recuo[i] = Math.max(recuo[i], s)
      recuo[(i + 1) % n] = Math.max(recuo[(i + 1) % n], t)
    } else {
      // Quina de fora; longe demais (canto agudo), chanfra.
      const longe = Math.hypot(cx, cy)
      const limite = ALCANCE_DA_QUINA * maior
      if (longe > limite) {
        const f = limite / longe
        quinas.push([x + p1x + p.ox * s * f, y + p1y + p.oy * s * f, x + p2x + q.ox * t * f, y + p2y + q.oy * t * f])
      } else {
        quinas.push([x + cx, y + cy])
      }
    }
  }
  const pontos: number[] = []
  const interna: boolean[] = []
  const por = (px: number, py: number, corte: boolean): void => {
    pontos.push(px, py)
    interna.push(corte)
  }
  for (let i = 0; i < n; i += 1) {
    const p = ordem[i]
    const ex = x + p.ox * recuo[i]
    const ey = y + p.oy * recuo[i]
    por(ex + p.oy * p.t.h, ey - p.ox * p.t.h, true)
    por(ex - p.oy * p.t.h, ey + p.ox * p.t.h, false)
    for (let k = 0; k < quinas[i].length; k += 2) por(quinas[i][k], quinas[i][k + 1], false)
  }
  // Vértice repetido (a quina que cai em cima do corte): fica o segundo, com a aresta dele.
  for (let i = interna.length - 1; i >= 0 && interna.length > 3; i -= 1) {
    const j = (i + 1) % interna.length
    if (Math.abs(pontos[i * 2] - pontos[j * 2]) < 1e-4 && Math.abs(pontos[i * 2 + 1] - pontos[j * 2 + 1]) < 1e-4) {
      pontos.splice(i * 2, 2)
      interna.splice(i, 1)
    }
  }
  let area = 0
  for (let i = 0; i < interna.length; i += 1) {
    const j = (i + 1) % interna.length
    area += pontos[i * 2] * pontos[j * 2 + 1] - pontos[j * 2] * pontos[i * 2 + 1]
  }
  if (interna.length < 3 || area / 2 < AREA_MINIMA_DO_PILAR) {
    for (const c of ordem) c.t.pontas[c.fim] = { tipo: 'junta', recuo: 0, k: 0 }
    return null
  }
  ordem.forEach((c, i) => {
    c.t.pontas[c.fim] = { tipo: 'pilar', recuo: recuo[i], k: 0 }
  })
  // A dona do pilar: a mais grossa (no empate, a primeira da lista); dela saem o material e o quadro da tampa.
  const dona = chegadas.reduce((m, c) => (c.t.h > m.t.h + PERTO ? c : m))
  return { pontos, interna, x, y, ox: dona.ox, oy: dona.oy, h: dona.t.h, material: dona.t.entrada.material, alpha: dona.t.entrada.alpha, desenha: chegadas.some((c) => c.t.entrada.desenha) }
}

/** A ponta sozinha que cai no meio de outra parede acaba rente à borda dela (o T sem nó). */
function embutir(c: Chegada, x: number, y: number, trechos: readonly Trecho[]): void {
  let melhor: { recuo: number; k: number; fora: number } | null = null
  for (const hospede of trechos) {
    if (hospede === c.t) continue
    const u = (x - hospede.ax) * hospede.dx + (y - hospede.ay) * hospede.dy
    if (u <= 0.5 || u >= hospede.comp - 0.5) continue
    const lado = -(x - hospede.ax) * hospede.dy + (y - hospede.ay) * hospede.dx
    if (Math.abs(lado) > hospede.h + 0.5) continue
    // A normal da outra parede virada para dentro desta.
    const frente = -hospede.dy * c.ox + hospede.dx * c.oy
    const sinal = frente >= 0 ? 1 : -1
    const seno = Math.abs(frente)
    if (seno < SENO_MINIMO_DO_EMBUTIDO) continue
    const mx = -hospede.dy * sinal
    const my = hospede.dx * sinal
    const recuo = (hospede.h - lado * sinal) / seno
    const k = -(-c.oy * mx + c.ox * my) / seno
    if (melhor === null || Math.abs(lado) < melhor.fora) melhor = { recuo, k, fora: Math.abs(lado) }
  }
  if (melhor === null) return
  c.t.pontas[c.fim] = { tipo: 'embutida', recuo: Math.max(0, Math.min(melhor.recuo, c.t.comp * 0.6)), k: melhor.k }
}

export function analisarEncontros(entradas: readonly TrechoDeEntrada[]): Encontros {
  const trechos: Trecho[] = []
  for (const e of entradas) {
    const t = trechoDe(e)
    if (t !== null) trechos.push(t)
  }
  const nos = new Map<string, { x: number; y: number; chegadas: Chegada[] }>()
  for (const t of trechos) {
    for (const fim of [0, 1] as const) {
      const x = fim === 0 ? t.ax : t.ax + t.dx * t.comp
      const y = fim === 0 ? t.ay : t.ay + t.dy * t.comp
      const ox = fim === 0 ? t.dx : -t.dx
      const oy = fim === 0 ? t.dy : -t.dy
      const chave = chaveDoPonto(x, y)
      let no = nos.get(chave)
      if (no === undefined) {
        no = { x, y, chegadas: [] }
        nos.set(chave, no)
      }
      no.chegadas.push({ t, fim, ox, oy, angulo: Math.atan2(oy, ox) })
    }
  }
  const pilares: Pilar[] = []
  for (const no of nos.values()) {
    const cs = no.chegadas
    if (cs.length === 1) {
      embutir(cs[0], no.x, no.y, trechos)
      continue
    }
    if (cs.length === 2 && mesmoGrupo(cs[0].t, cs[1].t) && -(cs[0].ox * cs[1].ox + cs[0].oy * cs[1].oy) >= COS_DA_DOBRA) {
      dobrar(cs[0], cs[1])
      continue
    }
    const pilar = levantarPilar(no.x, no.y, cs)
    if (pilar !== null) pilares.push(pilar)
  }
  return { trechos, pilares }
}
