/**
 * O MÓVEL DESENHADO QUE PEGA COR (onda 4, CONTRATO.md seção 10; decisão do usuário de
 * 29/10/2026, "Desenho à mão que pega cor"). Esta é a conta de referência para o app,
 * escrita sem nada do motor de hoje: a mesa de prova (ferramentas/mesa_movel.ts) pinta
 * com ela, e a integração faz a mesma coisa em pixi/rasterDosMoveis.ts.
 *
 * Por móvel, o exportador do Godot entrega, a 128 px por casa:
 *   <vista>-<variante>-<virada>.png        R = G = B = o valor (0,5 = o tom do material), A
 *   <vista>-<variante>-<virada>-partes.png R, G, B = o peso do lugar 1, 2, 3, A
 *   (opcional) ...-cor.png                 a cor própria (louça, água, chama), A
 * A conta, para um pedido (vista, opções de material por lugar, pegada, giro):
 *   1. a variante (a opção que muda o desenho, como o assento de palha ou de madeira);
 *   2. a virada k = round(giro / 90) mod 4 e a forma (a desenhada, ou a transposta);
 *   3. o tingir: cada pixel = soma dos pesos x rampa(tom do lugar)[valor] (10.5);
 *   4. o esticar (ponta + meio + ponta) ou a escala da pegada (10.6);
 *   5. a sombra pela silhueta (10.7). A tela gira só o resto (giro - 90 k).
 */
import type { Imagem } from './png'

export const PX_POR_CASA = 128

export type Rgb = readonly [number, number, number]
export type Vista = 'frente' | 'lado'

export interface Esticar {
  readonly eixo: 'x' | 'xy'
  readonly pontasCasas: readonly [number, number]
  readonly pontasCasasY: readonly [number, number] | null
  readonly ladoMaior: boolean
}

export interface VistaDoMovel {
  readonly casas: readonly [number, number]
  readonly viradas: 1 | 2 | 4
  readonly esticar?: Esticar
}

export interface FormaDoMovel {
  readonly nome: string
  readonly vista: Vista
  readonly variante: string
  readonly virada: number
  readonly casas: readonly [number, number]
  readonly valor: string
  readonly partes: string
  readonly cor?: string
}

export interface Rampa {
  readonly escuro: readonly (readonly [number, number])[]
  readonly claro: readonly (readonly [number, number])[]
  readonly cromaNaSombra: number
  readonly amareloNaLuz: number
  readonly cromaNaLuz: number
  readonly escuroAte: number
  readonly claroDesde: number
}

export interface ParamsDoMovel {
  readonly id: string
  readonly idDoApp: string
  readonly margemCasas: number
  readonly lugares: readonly string[]
  readonly variantes: readonly { readonly nome: string; readonly quando: Readonly<Record<string, string>> }[]
  readonly vistas: Readonly<Partial<Record<Vista, VistaDoMovel>>>
  readonly formas: readonly FormaDoMovel[]
  readonly sombra: { readonly jeito: 'deslocada' | 'nenhuma'; readonly direcao: readonly [number, number]; readonly deslocamentoCasas: number; readonly borraoCasas: number; readonly alfa: number; readonly cor: string }
  readonly tingir: Rampa
}

export interface MovelCarregado {
  readonly p: ParamsDoMovel
  /** Pelo nome do arquivo. */
  readonly imagens: ReadonlyMap<string, Imagem>
}

export interface Pedido {
  readonly vista: Vista
  /** A opção de cada lugar, na ordem de p.lugares (carvalho, palha, mesma, ferro...). */
  readonly opcoes: readonly string[]
  /** O tom (o `tom` do material, #rrggbb já em RGB) de cada lugar; "mesma" já resolvida. */
  readonly tons: readonly Rgb[]
  /** A pegada SEM giro, em casas (o que o mestre desenhou). */
  readonly casasW: number
  readonly casasH: number
  /** O giro do objeto, em graus (Prop.rotation). */
  readonly giro: number
}

/** RGBA pré-multiplicado, 0..255, em float. */
export interface Camada {
  readonly w: number
  readonly h: number
  readonly px: Float32Array
}

export interface Composto {
  /** O móvel, sem a sombra. */
  readonly corpo: Camada
  /** A sombra (só o alfa, 0..1, já com o alfa da sombra), do mesmo tamanho. */
  readonly sombra: Float32Array | null
  /** O meio da pegada (já virada), em px da camada. */
  readonly cx: number
  readonly cy: number
  /** O quarto de volta pintado e o resto que a tela gira. */
  readonly k: number
  readonly resto: number
  readonly forma: string
  readonly transposta: boolean
}

// ---------- OKLab ----------

function linear(c: number): number {
  const u = c / 255
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
}

function srgb(c: number): number {
  const u = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
  return u * 255
}

export function oklab(c: Rgb): [number, number, number] {
  const r = linear(c[0])
  const g = linear(c[1])
  const b = linear(c[2])
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

/** sRGB linear (sem cortar) de um OKLab. */
function linearDoOklab(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
}

function cabe(c: readonly number[]): boolean {
  return c.every((v) => v >= -1e-4 && v <= 1 + 1e-4)
}

function suave(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function interpolar(nos: readonly (readonly [number, number])[], g: number): number {
  if (g <= nos[0][0]) return nos[0][1]
  for (let i = 1; i < nos.length; i += 1) {
    const [x0, y0] = nos[i - 1]
    const [x1, y1] = nos[i]
    if (g <= x1) return y0 + ((y1 - y0) * (g - x0)) / (x1 - x0)
  }
  return nos[nos.length - 1][1]
}

/** O matiz do amarelo da paleta (AMARELO #f0d266), para onde a luz puxa um pouco. */
const MATIZ_DO_AMARELO = (() => {
  const [, a, b] = oklab([240, 210, 102])
  return Math.atan2(b, a)
})()

/**
 * A rampa de um tom: 256 cores (RGB 0..255), uma por valor. No escuro (valor < 0,5) a luz
 * OKLab vira L x fator (contorno 0,50, sombra 0,78) e o croma cresce um pouco; no claro
 * anda a fração do caminho até o branco (luz 0,12, realce 0,26), o matiz puxa para o
 * amarelo e o croma cai um pouco. Perto do preto e do branco, anda menos. Fora do sRGB,
 * o croma encolhe com o mesmo matiz.
 */
export function rampaDoTom(tom: Rgb, r: Rampa): Float32Array {
  const [L, a, b] = oklab(tom)
  const C = Math.hypot(a, b)
  const h = Math.atan2(b, a)
  let dh = MATIZ_DO_AMARELO - h
  while (dh > Math.PI) dh -= 2 * Math.PI
  while (dh < -Math.PI) dh += 2 * Math.PI
  const j = suave(0, r.escuroAte, L) * suave(1, r.claroDesde, L)
  const saida = new Float32Array(256 * 3)
  for (let i = 0; i < 256; i += 1) {
    const g = i / 255
    let L2: number
    let C2: number
    let h2 = h
    if (g <= 0.5) {
      const f = interpolar(r.escuro, g)
      L2 = L * f
      C2 = C * (1 + r.cromaNaSombra * (1 - f))
    } else {
      const f = interpolar(r.claro, g)
      L2 = L + (1 - L) * f
      C2 = C * (1 - r.cromaNaLuz * f)
      h2 = h + dh * r.amareloNaLuz * Math.min(1, f / 0.26)
    }
    L2 = L + j * (L2 - L)
    C2 = C + j * (C2 - C)
    let lo = 0
    let hi = 1
    let c = linearDoOklab(L2, C2 * Math.cos(h2), C2 * Math.sin(h2))
    if (!cabe(c)) {
      for (let t = 0; t < 14; t += 1) {
        const m = (lo + hi) / 2
        const cc = linearDoOklab(L2, C2 * m * Math.cos(h2), C2 * m * Math.sin(h2))
        if (cabe(cc)) lo = m
        else hi = m
      }
      c = linearDoOklab(L2, C2 * lo * Math.cos(h2), C2 * lo * Math.sin(h2))
    }
    for (let k = 0; k < 3; k += 1) saida[i * 3 + k] = Math.min(255, Math.max(0, srgb(Math.min(1, Math.max(0, c[k])))))
  }
  return saida
}

const RAMPAS = new Map<string, Float32Array>()

function rampaGuardada(tom: Rgb, r: Rampa): Float32Array {
  const chave = tom.join(',')
  let pronta = RAMPAS.get(chave)
  if (pronta === undefined) {
    pronta = rampaDoTom(tom, r)
    RAMPAS.set(chave, pronta)
  }
  return pronta
}

// ---------- 1 e 2: a variante e a forma ----------

export function varianteDoPedido(p: ParamsDoMovel, opcoes: readonly string[]): string {
  for (const v of p.variantes) {
    const bate = Object.entries(v.quando).every(([lugar, opcao]) => opcoes[p.lugares.indexOf(lugar)] === opcao)
    if (bate && Object.keys(v.quando).length > 0) return v.nome
  }
  return p.variantes[p.variantes.length - 1].nome
}

/** A forma da virada k (0..3): a desenhada ou a transposta (CONTRATO 10.4). */
export function formaDaVirada(viradas: 1 | 2 | 4, k: number): { virada: number; transposta: boolean } {
  if (viradas === 4) return { virada: k, transposta: false }
  if (viradas === 2) return k === 0 || k === 2 ? { virada: k, transposta: false } : { virada: k === 1 ? 2 : 0, transposta: true }
  return { virada: 0, transposta: k % 2 === 1 }
}

// ---------- 3: o tingir ----------

/** A forma tingida a 128 px por casa, pré-multiplicada (transposta, se pedida). */
function tingir(m: MovelCarregado, f: FormaDoMovel, tons: readonly Rgb[], transposta: boolean): Camada {
  const valor = m.imagens.get(f.valor)
  const partes = m.imagens.get(f.partes)
  if (valor === undefined || partes === undefined) throw new Error(`${m.p.id}: falta ${f.valor} ou ${f.partes}`)
  const cor = f.cor !== undefined ? m.imagens.get(f.cor) : undefined
  const rampas = tons.map((t) => rampaGuardada(t, m.p.tingir))
  const w = transposta ? valor.h : valor.w
  const h = transposta ? valor.w : valor.h
  const px = new Float32Array(w * h * 4)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = ((transposta ? x : y) * valor.w + (transposta ? y : x)) * 4
      const a = valor.px[o + 3] / 255
      const d = (y * w + x) * 4
      if (a <= 0) continue
      const g = valor.px[o]
      const pesos = [partes.px[o] / 255, partes.px[o + 1] / 255, partes.px[o + 2] / 255]
      let fixa = 1
      const c = [0, 0, 0]
      for (let k = 0; k < rampas.length; k += 1) {
        const p = pesos[k]
        if (p <= 0) continue
        fixa -= p
        for (let q = 0; q < 3; q += 1) c[q] += p * rampas[k][g * 3 + q]
      }
      if (fixa > 1e-3) {
        for (let q = 0; q < 3; q += 1) c[q] += fixa * (cor !== undefined ? cor.px[o + q] : rampas.length > 0 ? rampas[0][g * 3 + q] : g)
      }
      for (let q = 0; q < 3; q += 1) px[d + q] = c[q] * a
      px[d + 3] = a * 255
    }
  }
  return { w, h, px }
}

// ---------- 4: o esticar e a escala ----------

/** O ponto da imagem (casas, a partir da borda da pegada) para o ponto t do móvel de T casas. */
export function mapearEixo(t: number, T: number, S: number, pontas: readonly [number, number] | null): number {
  if (pontas === null) return (t * S) / T
  const [pE, pD] = pontas
  if (T >= pE + pD) {
    if (t <= pE) return t
    if (t >= T - pD) return S - (T - t)
    return pE + ((t - pE) * (S - pE - pD)) / (T - pE - pD)
  }
  // Mais curto que as duas pontas: metade de cada ponta, o corte no meio (no meio liso).
  return t < T / 2 ? t : S - (T - t)
}

function niveis(c: Camada): Camada[] {
  const r = [c]
  let a = c
  while (a.w > 1 && a.h > 1) {
    const w = Math.max(1, a.w >> 1)
    const h = Math.max(1, a.h >> 1)
    const px = new Float32Array(w * h * 4)
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        for (let k = 0; k < 4; k += 1) {
          let s = 0
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) s += a.px[(Math.min(a.h - 1, 2 * y + dy) * a.w + Math.min(a.w - 1, 2 * x + dx)) * 4 + k]
          px[(y * w + x) * 4 + k] = s / 4
        }
      }
    }
    a = { w, h, px }
    r.push(a)
  }
  return r
}

/** Bilinear pré-multiplicado num nível; fora da imagem é transparente. */
function ler(n: Camada, x: number, y: number, saida: number[]): void {
  const fx = x - 0.5
  const fy = y - 0.5
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = fx - ix
  const ty = fy - iy
  for (let k = 0; k < 4; k += 1) saida[k] = 0
  for (const [dx, dy, p] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]] as const) {
    const X = ix + dx
    const Y = iy + dy
    if (X < 0 || Y < 0 || X >= n.w || Y >= n.h || p === 0) continue
    const o = (Y * n.w + X) * 4
    for (let k = 0; k < 4; k += 1) saida[k] += n.px[o + k] * p
  }
}

const NIVEIS = new Map<string, Camada[]>()

// ---------- 5: a sombra ----------

/** Desfoque gaussiano aproximado por 3 caixas (desvio sigma em px). */
export function desfocar(a: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma < 0.3) return a
  const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2 - 0.5))
  let src = a
  for (let passada = 0; passada < 3; passada += 1) {
    const tmp = new Float32Array(w * h)
    for (let y = 0; y < h; y += 1) {
      let s = 0
      for (let x = -r; x <= r; x += 1) s += x >= 0 && x < w ? src[y * w + x] : 0
      for (let x = 0; x < w; x += 1) {
        tmp[y * w + x] = s / (2 * r + 1)
        const sai = x - r
        const entra = x + r + 1
        if (sai >= 0) s -= src[y * w + sai]
        if (entra < w) s += src[y * w + entra]
      }
    }
    const out = new Float32Array(w * h)
    for (let x = 0; x < w; x += 1) {
      let s = 0
      for (let y = -r; y <= r; y += 1) s += y >= 0 && y < h ? tmp[y * w + x] : 0
      for (let y = 0; y < h; y += 1) {
        out[y * w + x] = s / (2 * r + 1)
        const sai = y - r
        const entra = y + r + 1
        if (sai >= 0) s -= tmp[sai * w + x]
        if (entra < h) s += tmp[entra * w + x]
      }
    }
    src = out
  }
  return src
}

// ---------- a conta inteira ----------

/**
 * O móvel pronto para pôr na tela, a `pxPorCasa` px por casa (64 = 100%), com a borda
 * que a sombra precisa. Ponha o (cx, cy) da camada no meio da pegada do objeto e gire a
 * camada pelo `resto` em volta dele.
 */
export function comporMovel(m: MovelCarregado, pedido: Pedido, pxPorCasa: number): Composto {
  const p = m.p
  const vista = p.vistas[pedido.vista] ?? p.vistas.frente
  if (vista === undefined) throw new Error(`${p.id}: sem a vista ${pedido.vista}`)
  const nomeDaVista: Vista = p.vistas[pedido.vista] !== undefined ? pedido.vista : 'frente'
  const quartos = Math.round(pedido.giro / 90)
  let k = ((quartos % 4) + 4) % 4
  const resto = pedido.giro - quartos * 90
  let w = pedido.casasW
  let h = pedido.casasH
  if (vista.esticar?.ladoMaior === true && h > w) {
    // A mesa de 1 x 2 sem giro é a de 2 x 1 com um quarto de volta.
    ;[w, h] = [h, w]
    k = (k + 1) % 4
  }
  const variante = varianteDoPedido(p, pedido.opcoes)
  const { virada, transposta } = formaDaVirada(vista.viradas, k)
  const f = p.formas.find((x) => x.vista === nomeDaVista && x.variante === variante && x.virada === virada)
  if (f === undefined) throw new Error(`${p.id}: falta a forma ${nomeDaVista}-${variante}-${virada}`)
  // O id do móvel entra na chave: dois móveis com a mesma forma ("frente-padrao-0") e o mesmo tom trocavam de imagem.
  const chave = `${p.id}|${f.nome}|${transposta ? 't' : ''}|${pedido.tons.map((t) => t.join(',')).join('|')}`
  let nv = NIVEIS.get(chave)
  if (nv === undefined) {
    nv = niveis(tingir(m, f, pedido.tons, transposta))
    NIVEIS.set(chave, nv)
  }
  // A pegada da fonte e a pedida, já na tela (a fonte já vem virada).
  const fonte = transposta ? [f.casas[1], f.casas[0]] : [f.casas[0], f.casas[1]]
  const alvo = k % 2 === 1 ? [h, w] : [w, h]
  const mg = p.margemCasas
  // As pontas na ordem da tela: o eixo ao longo do móvel é o x da tela nas viradas 0 e 2.
  const es = vista.esticar
  const ordem = (par: readonly [number, number]): readonly [number, number] => (k >= 2 ? [par[1], par[0]] : par)
  const pontasAoLongo = es !== undefined ? ordem(es.pontasCasas) : null
  const pontasAtraves = es !== undefined && es.eixo === 'xy' ? ordem(es.pontasCasasY ?? es.pontasCasas) : null
  const pontasX = k % 2 === 0 ? pontasAoLongo : pontasAtraves
  const pontasY = k % 2 === 0 ? pontasAtraves : pontasAoLongo
  const sb = p.sombra
  const nd = Math.hypot(sb.direcao[0], sb.direcao[1])
  const desl = sb.jeito === 'nenhuma' ? 0 : sb.deslocamentoCasas * pxPorCasa
  const sigma = sb.jeito === 'nenhuma' ? 0 : sb.borraoCasas * pxPorCasa
  const borda = Math.ceil(mg * pxPorCasa + desl + 3 * sigma + 2)
  const W = Math.ceil(alvo[0] * pxPorCasa) + 2 * borda
  const H = Math.ceil(alvo[1] * pxPorCasa) + 2 * borda
  const px = new Float32Array(W * H * 4)
  const escala = Math.max(fonte[0] / alvo[0], fonte[1] / alvo[1], 1e-6)
  const fontePorPx = (escala * PX_POR_CASA) / pxPorCasa
  const nivel = Math.min(nv.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, fontePorPx)))))
  const n = nv[nivel]
  const kN = n.w / nv[0].w
  const amostra = [0, 0, 0, 0]
  for (let Y = 0; Y < H; Y += 1) {
    const ty = (Y + 0.5 - borda) / pxPorCasa
    const sy = mapearEixo(ty, alvo[1], fonte[1], pontasY)
    for (let X = 0; X < W; X += 1) {
      const tx = (X + 0.5 - borda) / pxPorCasa
      const sx = mapearEixo(tx, alvo[0], fonte[0], pontasX)
      ler(n, (sx + mg) * PX_POR_CASA * kN, (sy + mg) * PX_POR_CASA * kN, amostra)
      const o = (Y * W + X) * 4
      for (let q = 0; q < 4; q += 1) px[o + q] = amostra[q]
    }
  }
  let sombra: Float32Array | null = null
  if (sb.jeito !== 'nenhuma') {
    const dx = Math.round((sb.direcao[0] / nd) * desl)
    const dy = Math.round((sb.direcao[1] / nd) * desl)
    const a = new Float32Array(W * H)
    for (let Y = 0; Y < H; Y += 1) {
      for (let X = 0; X < W; X += 1) {
        const x0 = X - dx
        const y0 = Y - dy
        if (x0 >= 0 && y0 >= 0 && x0 < W && y0 < H) a[Y * W + X] = px[(y0 * W + x0) * 4 + 3] / 255
      }
    }
    sombra = desfocar(a, W, H, sigma).map((v) => v * sb.alfa)
  }
  return { corpo: { w: W, h: H, px }, sombra, cx: borda + (alvo[0] * pxPorCasa) / 2, cy: borda + (alvo[1] * pxPorCasa) / 2, k, resto, forma: f.nome, transposta }
}
