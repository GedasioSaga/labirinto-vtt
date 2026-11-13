/**
 * ÁGUA: o CAMPO de cada água, refeito só quando ela muda (lógica pura, é o
 * código do protótipo aprovado, `docs/design/agua/prototipo-agua.html`,
 * `campoDoRio`, `campoDaArea` e `compor`). Por quadro, o shader
 * (`pixi/aguaDoMapa.ts`) só muda o tempo.
 *
 * Tudo aqui está em UNIDADES DO PROTÓTIPO (u): uma casa vale 40 u em qualquer
 * mapa, então as medidas aprovadas (margem de 52, praia, espuma que sobe 7 a
 * 18) valem iguais em toda grade. `uPorPx` converte px de mundo em u.
 *
 * O campo composto tem quatro canais em float (distância com sinal até a
 * margem, + dentro; posição ao longo do rio; deslocamento para o lado; peso do
 * rio) e dois em byte (a cor e o peso do mar; velocidade, ondas e espuma).
 */
import type { TipoDeAgua } from '../../types/map'

/** Uma casa em u (a casa do protótipo). */
export const CASA_U = 40
/** Até onde, fora da água, o campo vale (margem molhada, praia, espuma que sobe). */
export const FORA = 52
/** A distância da margem a partir da qual é tudo fundo. */
export const FUNDO = 240
/** Distância exata até aqui; além, propagada (chanfro). */
export const PERTO = 56
/** u por texel do campo: 10 texels por casa (`PROPOSTA.md`, "4 px de mundo por texel"). */
export const TEXEL_U = 4
/** Teto de texels do campo composto: acima disso o texel cresce (mar enorme fica mais macio, nunca estoura memória). */
export const TEXELS_MAX = 1_200_000

export function uPorPx(grid: number): number {
  return CASA_U / Math.max(1, grid)
}

export interface CorpoDoCampo {
  id: string
  tipo: TipoDeAgua
  /** A base da cor, 0 a 255. */
  cor: [number, number, number]
  /** Os ajustes, 0 a 1. */
  velocidade: number
  ondas: number
  espuma: number
  /** Rio: os trechos do traço (u) e a posição ao longo do rio de cada ponto (u). */
  trechos?: { xy: number[]; s: number[] }[]
  /** Rio: meia largura (u). */
  meia?: number
  /** Lago e mar no editor: o contorno fechado (u). */
  contorno?: number[]
  /** Lago e mar no jogador: só a margem que ele conhece (u), a água do lado em que o produto vetorial é positivo. */
  margens?: number[][]
  /** Lago e mar no jogador: as células conhecidas com água (lado em u, "col,lin"). */
  celulas?: { lado: number; chaves: ReadonlySet<string> }
  /**
   * Lago e mar: por ponto de cada linha (o contorno, ou cada margem do jogador, na mesma ordem), 1 = margem e
   * 0 = não (borda do mapa, perto de sala; `lib/agua/entorno.ts`). O trecho que não é margem não dá raso, espuma
   * nem areia: a água segue funda até ele. Ausente = tudo margem, como antes.
   */
  margem?: readonly (Uint8Array | null)[]
  /** Mar: por ponto de cada linha, 0 (com areia) a 1 (sem areia), do pincel de areia (`semAreiaDaBeira`). Ausente = areia em toda a margem. */
  semAreia?: readonly (Float32Array | null)[]
  /** O retângulo do mapa (u): o campo não passa dele (mais 2 texels, para o filtro da borda). Ausente = sem corte. */
  limite?: { x0: number; y0: number; x1: number; y1: number }
}

/** Texels além do retângulo do mapa que o campo ainda guarda (o filtro linear da borda). */
const ALEM_DO_LIMITE = 2

/** Retângulo em texels do campo (a origem do mundo é o texel 0). */
export interface CaixaEmTexels {
  x0: number
  y0: number
  w: number
  h: number
}

export interface CampoDoCorpo extends CaixaEmTexels {
  sd: Float32Array
  /** Só lago e mar com pincel de areia ou com beira que não é margem: 0 (com areia) a 255 (sem), da beira mais perto. */
  semAreia?: Uint8Array
  /** Só rio. */
  s?: Float32Array
  n?: Float32Array
}

export interface CampoComposto extends CaixaEmTexels {
  /** u por texel. */
  texel: number
  f1: Float32Array
  f2: Uint8Array
  f3: Uint8Array
  /** Vermelho: o chão por cima da água (cobertura do buraco das salas e do Chão Liso, 0 = água a 1 = chão). Verde: a areia tirada pelo pincel (0 = com areia). */
  f4: Uint8Array
  /** Só quando pedido (`comporCampo`): por texel, a posição na lista do corpo que manda ali (a água mais funda), -1 = nenhum. */
  dono?: Int16Array
}

/** Uma forma do buraco (anéis em u, par ou ímpar). `soNas`: só onde manda um destes corpos (a posição na lista do campo composto). */
export interface FormaDoBuraco {
  aneis: readonly (readonly number[])[]
  soNas?: readonly number[]
}

const grampo = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v)
const passo = (a: number, b: number, x: number): number => {
  const t = grampo((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function caixaDosPontos(listas: readonly (readonly number[])[], folga: number, texel: number): CaixaEmTexels {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const xy of listas) {
    for (let i = 0; i + 1 < xy.length; i += 2) {
      x0 = Math.min(x0, xy[i])
      y0 = Math.min(y0, xy[i + 1])
      x1 = Math.max(x1, xy[i])
      y1 = Math.max(y1, xy[i + 1])
    }
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, w: 0, h: 0 }
  const a = Math.floor((x0 - folga) / texel)
  const b = Math.floor((y0 - folga) / texel)
  return { x0: a, y0: b, w: Math.max(0, Math.ceil((x1 + folga) / texel) - a), h: Math.max(0, Math.ceil((y1 + folga) / texel) - b) }
}

/**
 * A caixa cortada ao retângulo do mapa (e os 2 texels do filtro). A margem do
 * campo mora toda dentro do mapa (a beira de fora não é margem), e o caminho
 * mais curto entre dois pontos de um retângulo fica nele: cortar não muda
 * nenhuma distância que se vê.
 */
function cortarAoLimite(caixa: CaixaEmTexels, limite: CorpoDoCampo['limite'], texel: number): CaixaEmTexels {
  if (limite === undefined || caixa.w <= 0 || caixa.h <= 0) return caixa
  const x0 = Math.max(caixa.x0, Math.floor(limite.x0 / texel) - ALEM_DO_LIMITE)
  const y0 = Math.max(caixa.y0, Math.floor(limite.y0 / texel) - ALEM_DO_LIMITE)
  const x1 = Math.min(caixa.x0 + caixa.w, Math.ceil(limite.x1 / texel) + ALEM_DO_LIMITE)
  const y1 = Math.min(caixa.y0 + caixa.h, Math.ceil(limite.y1 / texel) + ALEM_DO_LIMITE)
  return x1 <= x0 || y1 <= y0 ? { x0: 0, y0: 0, w: 0, h: 0 } : { x0, y0, w: x1 - x0, h: y1 - y0 }
}

/** A caixa (texels) que o corpo ocupa no campo, com a margem de fora. */
export function caixaDoCorpo(c: CorpoDoCampo, texel: number): CaixaEmTexels {
  if (c.tipo === 'rio') return cortarAoLimite(caixaDosPontos((c.trechos ?? []).map((t) => t.xy), (c.meia ?? 0) + FORA, texel), c.limite, texel)
  const listas = c.contorno !== undefined ? [c.contorno] : (c.margens ?? [])
  const caixa = caixaDosPontos(listas, FORA + 4, texel)
  if (c.celulas === undefined) return cortarAoLimite(caixa, c.limite, texel)
  // No jogador a água também vai até a beira das células conhecidas (a margem pode não ter vindo).
  const pontos: number[] = []
  for (const chave of c.celulas.chaves) {
    const [col, lin] = chave.split(',').map(Number)
    pontos.push(col * c.celulas.lado, lin * c.celulas.lado, (col + 1) * c.celulas.lado, (lin + 1) * c.celulas.lado)
  }
  return cortarAoLimite(unirCaixas(caixa, caixaDosPontos([pontos], FORA + 4, texel)) ?? caixa, c.limite, texel)
}

export function unirCaixas(a: CaixaEmTexels | null, b: CaixaEmTexels | null): CaixaEmTexels | null {
  if (a === null || a.w <= 0 || a.h <= 0) return b
  if (b === null || b.w <= 0 || b.h <= 0) return a
  const x0 = Math.min(a.x0, b.x0)
  const y0 = Math.min(a.y0, b.y0)
  return { x0, y0, w: Math.max(a.x0 + a.w, b.x0 + b.w) - x0, h: Math.max(a.y0 + a.h, b.y0 + b.h) - y0 }
}

/** O texel (u) do campo para que a caixa de todas as águas caiba no teto de memória. */
export function texelParaCaber(caixaEmU: { largura: number; altura: number }): number {
  let texel = TEXEL_U
  while ((caixaEmU.largura / texel) * (caixaEmU.altura / texel) > TEXELS_MAX) texel *= 1.5
  return texel
}

function campoDoRio(c: CorpoDoCampo, texel: number): CampoDoCorpo {
  const meia = c.meia ?? 0
  const cx = caixaDoCorpo(c, texel)
  const n = cx.w * cx.h
  const dm = new Float32Array(n).fill(1e18)
  const S = new Float32Array(n)
  const N = new Float32Array(n)
  const alcance = meia + FORA
  for (const trecho of c.trechos ?? []) {
    const { xy, s } = trecho
    for (let i = 0; i + 3 < xy.length; i += 2) {
      const ax = xy[i]
      const ay = xy[i + 1]
      const bx = xy[i + 2]
      const by = xy[i + 3]
      const vx = bx - ax
      const vy = by - ay
      const L = Math.hypot(vx, vy) || 1e-6
      const ux = vx / L
      const uy = vy / L
      const s0 = s[i / 2]
      const tx0 = Math.max(cx.x0, Math.floor((Math.min(ax, bx) - alcance) / texel))
      const tx1 = Math.min(cx.x0 + cx.w - 1, Math.ceil((Math.max(ax, bx) + alcance) / texel))
      const ty0 = Math.max(cx.y0, Math.floor((Math.min(ay, by) - alcance) / texel))
      const ty1 = Math.min(cx.y0 + cx.h - 1, Math.ceil((Math.max(ay, by) + alcance) / texel))
      for (let ty = ty0; ty <= ty1; ty += 1) {
        const py = (ty + 0.5) * texel
        for (let tx = tx0; tx <= tx1; tx += 1) {
          const px = (tx + 0.5) * texel
          const qx = px - ax
          const qy = py - ay
          const t = grampo((qx * ux + qy * uy) / L, 0, 1)
          const ex = qx - ux * L * t
          const ey = qy - uy * L * t
          const d2 = ex * ex + ey * ey
          const k = (ty - cx.y0) * cx.w + (tx - cx.x0)
          // O lado vem da distância à reta do trecho (contínua também depois da ponta do rio).
          if (d2 < dm[k]) {
            dm[k] = d2
            S[k] = s0 + t * L
            N[k] = ux * qy - uy * qx
          }
        }
      }
    }
  }
  const sd = new Float32Array(n)
  for (let k = 0; k < n; k += 1) sd[k] = dm[k] > 1e17 ? -1e9 : grampo(meia - Math.sqrt(dm[k]), -1e9, FUNDO)
  return { ...cx, sd, s: S, n: N }
}

/** Dentro do contorno, linha por linha (par ou ímpar), no centro de cada texel. */
function preencherContorno(xy: readonly number[], cx: CaixaEmTexels, texel: number, dentro: Uint8Array): void {
  const m = xy.length / 2
  const cortes: number[] = []
  for (let ty = 0; ty < cx.h; ty += 1) {
    const py = (cx.y0 + ty + 0.5) * texel
    cortes.length = 0
    for (let i = 0, j = m - 1; i < m; j = i, i += 1) {
      const yi = xy[i * 2 + 1]
      const yj = xy[j * 2 + 1]
      if (yi > py !== yj > py) {
        const xi = xy[i * 2]
        const xj = xy[j * 2]
        cortes.push(xi + ((py - yi) * (xj - xi)) / (yj - yi))
      }
    }
    cortes.sort((a, b) => a - b)
    for (let c = 0; c + 1 < cortes.length; c += 2) {
      const a = Math.max(0, Math.ceil(cortes[c] / texel - 0.5) - cx.x0)
      const b = Math.min(cx.w - 1, Math.floor(cortes[c + 1] / texel - 0.5) - cx.x0)
      for (let tx = a; tx <= b; tx += 1) dentro[ty * cx.w + tx] = 1
    }
  }
}

function campoDaArea(c: CorpoDoCampo, texel: number): CampoDoCorpo {
  const cx = caixaDoCorpo(c, texel)
  const n = cx.w * cx.h
  if (n === 0) return { ...cx, sd: new Float32Array(0) }
  const w = cx.w
  // A margem: o contorno inteiro (editor) ou só os trechos que o jogador conhece. A
  // margem que ele não conhece não conta: nem o raso nem a espuma entregam onde está a terra.
  const fechado = c.contorno !== undefined
  const linhas = fechado ? [c.contorno ?? []] : (c.margens ?? [])
  // A distância vai só até a MARGEM; no jogador o lado da água sai de todas as linhas (a beira que não é margem
  // continua dizendo de que lado está a água). Sem marca, as duas contas são a mesma, como antes.
  const comMarca = c.margem !== undefined && c.margem.some((m) => m !== null)
  const ladoAParte = comMarca && !fechado
  const dm = new Float32Array(n).fill(1e9)
  const dTodas = comMarca ? new Float32Array(n).fill(1e9) : dm
  // Com marca, a beira mais perto de cada texel (margem ou não), 0 a 255 = quanto ela é margem: a faixa de areia de um
  // trecho de margem só vai até onde ele é a beira mais perto. Sem isto a areia contornava a ponta do trecho e encostava
  // na sala, no Chão Liso e na construção (a beira a menos de meia casa deles não é margem, `entorno.ts`).
  const margemPerto = comMarca ? new Uint8Array(n).fill(255) : null
  const lado = new Int8Array(n)
  // A areia tirada pelo pincel: o valor da margem mais perto, ao longo do segmento (só até PERTO; além nada se vê).
  const comAreia = c.semAreia !== undefined && c.semAreia.some((s) => s !== null)
  const sa = comAreia ? new Float32Array(n) : null
  for (let li = 0; li < linhas.length; li += 1) {
    const xy = linhas[li]
    const marca = comMarca ? (c.margem?.[li] ?? null) : null
    const areia = comAreia ? (c.semAreia?.[li] ?? null) : null
    const m = xy.length / 2
    const segmentos = fechado ? m : m - 1
    for (let i = 0; i < segmentos; i += 1) {
      const j = (i + 1) % m
      const ehMargem = marca === null || (marca[i] === 1 && marca[j] === 1)
      if (!ehMargem && !comMarca) continue
      const ax = xy[i * 2]
      const ay = xy[i * 2 + 1]
      const bx = xy[j * 2]
      const by = xy[j * 2 + 1]
      const vx = bx - ax
      const vy = by - ay
      const L = Math.hypot(vx, vy) || 1e-6
      const ux = vx / L
      const uy = vy / L
      const tx0 = Math.max(cx.x0, Math.floor((Math.min(ax, bx) - PERTO) / texel))
      const tx1 = Math.min(cx.x0 + w - 1, Math.ceil((Math.max(ax, bx) + PERTO) / texel))
      const ty0 = Math.max(cx.y0, Math.floor((Math.min(ay, by) - PERTO) / texel))
      const ty1 = Math.min(cx.y0 + cx.h - 1, Math.ceil((Math.max(ay, by) + PERTO) / texel))
      for (let ty = ty0; ty <= ty1; ty += 1) {
        const py = (ty + 0.5) * texel
        for (let tx = tx0; tx <= tx1; tx += 1) {
          const px = (tx + 0.5) * texel
          const qx = px - ax
          const qy = py - ay
          const t = grampo((qx * ux + qy * uy) / L, 0, 1)
          const dx = qx - ux * L * t
          const dy = qy - uy * L * t
          const d2 = dx * dx + dy * dy
          const k = (ty - cx.y0) * w + (tx - cx.x0)
          if (margemPerto !== null && d2 < dTodas[k]) {
            dTodas[k] = d2
            if (ladoAParte) lado[k] = ux * qy - uy * qx >= 0 ? 1 : -1
            margemPerto[k] = marca === null ? 255 : Math.round(255 * (marca[i] + (marca[j] - marca[i]) * t))
          }
          if (ehMargem && d2 < dm[k]) {
            dm[k] = d2
            if (!ladoAParte) lado[k] = ux * qy - uy * qx >= 0 ? 1 : -1
            if (sa !== null) sa[k] = areia === null ? 0 : areia[i] + (areia[j] - areia[i]) * t
          }
        }
      }
    }
  }
  for (let k = 0; k < n; k += 1) if (dm[k] < 1e8) dm[k] = Math.sqrt(dm[k])
  // Além de PERTO, chanfro em duas passadas (o erro de poucos % some no degradê do fundo).
  const a = texel
  const b = texel * Math.SQRT2
  for (let y = 0; y < cx.h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const k = y * w + x
      let v = dm[k]
      if (x > 0 && dm[k - 1] + a < v) v = dm[k - 1] + a
      if (y > 0) {
        if (dm[k - w] + a < v) v = dm[k - w] + a
        if (x > 0 && dm[k - w - 1] + b < v) v = dm[k - w - 1] + b
        if (x < w - 1 && dm[k - w + 1] + b < v) v = dm[k - w + 1] + b
      }
      dm[k] = v
    }
  }
  for (let y = cx.h - 1; y >= 0; y -= 1) {
    for (let x = w - 1; x >= 0; x -= 1) {
      const k = y * w + x
      let v = dm[k]
      if (x < w - 1 && dm[k + 1] + a < v) v = dm[k + 1] + a
      if (y < cx.h - 1) {
        if (dm[k + w] + a < v) v = dm[k + w] + a
        if (x < w - 1 && dm[k + w + 1] + b < v) v = dm[k + w + 1] + b
        if (x > 0 && dm[k + w - 1] + b < v) v = dm[k + w - 1] + b
      }
      dm[k] = v
    }
  }
  const dentro = new Uint8Array(n)
  if (fechado) preencherContorno(c.contorno ?? [], cx, texel, dentro)
  else if (c.celulas !== undefined) {
    // No jogador: dentro = célula conhecida com água e, perto de uma margem conhecida, do lado da água.
    const { lado: ladoDaCelula, chaves } = c.celulas
    for (let ty = 0; ty < cx.h; ty += 1) {
      const lin = Math.floor(((cx.y0 + ty + 0.5) * texel) / ladoDaCelula)
      for (let tx = 0; tx < w; tx += 1) {
        const col = Math.floor(((cx.x0 + tx + 0.5) * texel) / ladoDaCelula)
        const k = ty * w + tx
        if (!chaves.has(`${col},${lin}`)) continue
        dentro[k] = lado[k] === 0 || lado[k] > 0 ? 1 : 0
      }
    }
  }
  const sd = new Float32Array(n)
  for (let k = 0; k < n; k += 1) {
    const v = Math.min(dm[k], FUNDO)
    sd[k] = dentro[k] === 1 ? v : -v
  }
  if (sa === null && margemPerto === null) return { ...cx, sd }
  // Sem areia: a tirada pelo pincel e, junto do trecho que não é margem, a que ele não tem (a regra automática vence o "Pôr areia").
  const semAreia = new Uint8Array(n)
  for (let k = 0; k < n; k += 1) semAreia[k] = Math.max(sa === null ? 0 : Math.round(255 * grampo(sa[k], 0, 1)), margemPerto === null ? 0 : 255 - margemPerto[k])
  return { ...cx, sd, semAreia }
}

/** O campo de um corpo, sozinho (a distância; a junção com os outros é `comporCampo`). */
export function campoDoCorpo(c: CorpoDoCampo, texel: number): CampoDoCorpo {
  return c.tipo === 'rio' ? campoDoRio(c, texel) : campoDaArea(c, texel)
}

/**
 * Junta os campos no retângulo `r`: a água mais funda ganha; na foz, o rio vira
 * o lago (ou o mar): dentro da área, a área manda e a correnteza some em ~20 u.
 * Na terra, a beira mais perto ganha (barro do rio ou areia da praia), sem
 * corte reto entre elas.
 */
export function comporCampo(lista: readonly { corpo: CorpoDoCampo; campo: CampoDoCorpo }[], r: CaixaEmTexels, texel: number, comDono = false): CampoComposto {
  const n = Math.max(0, r.w * r.h)
  const f1 = new Float32Array(n * 4)
  const f2 = new Uint8Array(n * 4)
  const f3 = new Uint8Array(n * 4)
  const f4 = new Uint8Array(n * 4)
  const dono = comDono ? new Int16Array(n).fill(-1) : null
  const presentes = lista
    .map((item, posicao) => ({ ...item, posicao }))
    .filter(({ campo: k }) => k.w > 0 && k.h > 0 && k.x0 < r.x0 + r.w && k.x0 + k.w > r.x0 && k.y0 < r.y0 + r.h && k.y0 + k.h > r.y0)
  for (let y = r.y0; y < r.y0 + r.h; y += 1) {
    for (let x = r.x0; x < r.x0 + r.w; x += 1) {
      let melhor = -1e9
      let quem = -1
      let rio: CorpoDoCampo | null = null
      let vRio = -1e9
      let sRio = 0
      let nRio = 0
      let area: CorpoDoCampo | null = null
      let vArea = -1e9
      let saArea = 0
      for (const { corpo, campo: k, posicao } of presentes) {
        if (x < k.x0 || y < k.y0 || x >= k.x0 + k.w || y >= k.y0 + k.h) continue
        const i = (y - k.y0) * k.w + (x - k.x0)
        const v = k.sd[i]
        if (v > melhor) {
          melhor = v
          quem = posicao
        }
        if (corpo.tipo === 'rio') {
          if (v > vRio) {
            vRio = v
            rio = corpo
            sRio = k.s === undefined ? 0 : k.s[i]
            nRio = k.n === undefined ? 0 : k.n[i]
          }
        } else if (v > vArea) {
          vArea = v
          area = corpo
          saArea = k.semAreia === undefined ? 0 : k.semAreia[i]
        }
      }
      const p = ((y - r.y0) * r.w + (x - r.x0)) * 4
      if (melhor <= -FORA || (rio === null && area === null)) {
        f1[p] = -FORA - 1
        continue
      }
      if (dono !== null) dono[p / 4] = quem
      const pr = rio !== null ? (area !== null ? Math.min(passo(-12, 12, vRio - vArea), 1 - passo(-4, 16, vArea)) : 1) : 0
      f1[p] = area !== null && vArea > 0 ? vArea + (melhor - vArea) * pr : melhor
      f1[p + 1] = sRio
      f1[p + 2] = nRio
      f1[p + 3] = pr
      const pa = area ?? rio
      const pb = rio ?? area
      if (pa === null || pb === null) continue
      for (let j = 0; j < 3; j += 1) f2[p + j] = Math.round(pa.cor[j] + (pb.cor[j] - pa.cor[j]) * pr)
      f2[p + 3] = area !== null && area.tipo === 'mar' ? Math.round(255 * (1 - pr)) : 0
      f3[p] = Math.round(255 * pb.velocidade)
      f3[p + 1] = Math.round(255 * (pa.ondas + (pb.ondas - pa.ondas) * pr))
      f3[p + 2] = Math.round(255 * (pa.espuma + (pb.espuma - pa.espuma) * pr))
      f4[p + 1] = saArea
    }
  }
  return { ...r, texel, f1, f2, f3, f4, ...(dono === null ? {} : { dono }) }
}

/** Sublinhas por texel na cobertura do buraco (na horizontal a conta é exata). */
const SUBLINHAS_DO_BURACO = 4

/**
 * O BURACO da água (MAR MAIS FÁCIL, 13/11/2026): o chão das salas e do Chão Liso
 * fica por cima da água. Quanto de cada texel da caixa o chão cobre (0 a 255,
 * `null` = nada), que vai no vermelho de `f4`; o shader lê a cobertura como distância (meio = a borda)
 * e corta fino em qualquer zoom. Cada forma são anéis em u (par ou ímpar entre
 * eles); formas que se sobrepõem somam (até cobrir tudo). A forma com `soNas`
 * só cobre o texel cujo `dono` (`comporCampo`) é um daqueles corpos.
 */
export function buracoDoCampo(r: CaixaEmTexels, texel: number, formas: readonly FormaDoBuraco[], dono?: Int16Array): Uint8Array | null {
  const n = Math.max(0, r.w * r.h)
  if (n === 0 || formas.length === 0) return null
  const cob = new Float32Array(n)
  const cortes: number[] = []
  for (const { aneis, soNas } of formas) {
    // Sem o dono (quem chamou não pediu), a forma cobre como as outras.
    const restrita = soNas !== undefined && dono !== undefined ? soNas : null
    let y0 = Infinity
    let y1 = -Infinity
    for (const a of aneis) {
      for (let i = 1; i < a.length; i += 2) {
        y0 = Math.min(y0, a[i])
        y1 = Math.max(y1, a[i])
      }
    }
    const ty0 = Math.max(0, Math.floor(y0 / texel) - r.y0)
    const ty1 = Math.min(r.h - 1, Math.floor(y1 / texel) - r.y0)
    if (!(ty1 >= ty0)) continue
    // Os segmentos de cada linha de texels: a sublinha só olha os que passam por ela.
    const porLinha: number[][] = Array.from({ length: ty1 - ty0 + 1 }, () => [])
    for (const a of aneis) {
      const m = a.length / 2
      for (let i = 0; i < m; i += 1) {
        const j = (i + 1) % m
        const ay = a[i * 2 + 1]
        const by = a[j * 2 + 1]
        const l0 = Math.max(ty0, Math.floor(Math.min(ay, by) / texel) - r.y0)
        const l1 = Math.min(ty1, Math.floor(Math.max(ay, by) / texel) - r.y0)
        for (let l = l0; l <= l1; l += 1) porLinha[l - ty0].push(a[i * 2], ay, a[j * 2], by)
      }
    }
    for (let ty = ty0; ty <= ty1; ty += 1) {
      const segs = porLinha[ty - ty0]
      if (segs.length < 8) continue
      const base = ty * r.w
      for (let sub = 0; sub < SUBLINHAS_DO_BURACO; sub += 1) {
        const py = (r.y0 + ty + (sub + 0.5) / SUBLINHAS_DO_BURACO) * texel
        cortes.length = 0
        for (let i = 0; i + 3 < segs.length; i += 4) {
          const ay = segs[i + 1]
          const by = segs[i + 3]
          if (ay > py !== by > py) cortes.push(segs[i] + ((py - ay) * (segs[i + 2] - segs[i])) / (by - ay))
        }
        if (cortes.length < 2) continue
        cortes.sort((a, b) => a - b)
        for (let c = 0; c + 1 < cortes.length; c += 2) {
          const fa = Math.max(0, cortes[c] / texel - r.x0)
          const fb = Math.min(r.w, cortes[c + 1] / texel - r.x0)
          if (fb <= fa) continue
          const ultima = Math.min(r.w - 1, Math.ceil(fb) - 1)
          for (let col = Math.floor(fa); col <= ultima; col += 1) {
            const cobre = Math.min(col + 1, fb) - Math.max(col, fa)
            if (cobre > 0 && (restrita === null || (dono !== undefined && restrita.includes(dono[base + col])))) cob[base + col] += cobre / SUBLINHAS_DO_BURACO
          }
        }
      }
    }
  }
  const saida = new Uint8Array(n)
  let algum = false
  for (let k = 0; k < n; k += 1) {
    if (cob[k] <= 0) continue
    saida[k] = Math.round(255 * Math.min(1, cob[k]))
    algum = true
  }
  return algum ? saida : null
}

/** O buraco (`buracoDoCampo`) no vermelho do `f4` do campo composto. */
export function porOBuraco(f4: Uint8Array, buraco: Uint8Array | null): void {
  if (buraco === null) return
  for (let k = 0; k < buraco.length; k += 1) f4[k * 4] = buraco[k]
}
