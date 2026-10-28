/**
 * A MONTAGEM DO TELHADO Desenhado (onda 2), fora do app e fora do Godot: a
 * implementação de referência da seção 8 do CONTRATO.md. Lê os arquivos que o
 * exportador gravou (exportado/<id>/), monta o telhado de cada casa da mesa de
 * prova com as águas do PRÓPRIO app (`client/src/lib/telhado/aguas.ts`), tinge
 * com a cor do mestre (a conta da PROPOSTA-TINGIR.md) e pinta o Atual ao lado
 * com o `pintarTelhado` de hoje. O Godot (comum/mesa_telhado.gd) só arruma os
 * painéis na folha.
 *
 * O app faz exatamente `campoDoTelhado` + `tingirCampo` + `porObjeto` quando
 * integrar (as funções são puras e só dependem do que o app já tem).
 *
 * Uso (o exportador chama; esbuild empacota em ferramentas/.build/telhado.mjs):
 *   node telhado.mjs --textura=<exportado/id> --saida=<pasta> [--sob=<exportado/id>] [--faixa=<exportado/id>] [--sem-atual]
 *     --sob    o telhado por baixo de uma faixa ou de um objeto (sem ele: telhado liso)
 *     --faixa  a faixa de outra textura (o "faixa": { "de": id } do telhado)
 * Grava em <saida>: cenaA-<k>-desenhado.png, cenaA-<k>-atual.png (k = 0..2, uma
 * por cor), cenaB-0-*.png (o telhado grande), arquivo-*.png e paineis.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync, inflateSync } from 'node:zlib'
import {
  amostrarAgua,
  BEIRAL_PX,
  cruzamentosDaLinha,
  novaAmostraDaAgua,
  prepararAguas,
  type GeometriaDasAguas,
  type PontoDoTelhado,
} from '../../../client/src/lib/telhado/aguas'
import { PALETA_DO_TETO, type ModeloDoTeto } from '../../../client/src/lib/telhado/paletas'
import { pintarTelhado } from '../../../client/src/texturas/telhado'
import { posicaoDaChamine } from '../../../client/src/texturas/meioTermo/chamine'
import { ehCumeeira, posicaoAoLongoDoCume } from '../../../client/src/texturas/meioTermo/cumeeiraAmarrada'
import { ruidoDoMundo } from '../../../client/src/texturas/meioTermo/ruidoDoMundo'
import { oklabDoRgb } from '../../../client/src/texturas/meioTermo/materiais'

const CASA = 64
/** A luz do app (texturas/telhado.ts): de cima à esquerda, mais da esquerda. */
const LUZ_X = -1 / Math.hypot(1, 0.45)
const LUZ_Y = -0.45 / Math.hypot(1, 0.45)
/** Sombra do telhado no chão (pixi/telhadosRenderer.ts). */
const SOMBRA_X = 6
const SOMBRA_Y = 8
const SOMBRA_ALFA = 0.25
const COR_DA_SOMBRA: Rgb = [10, 12, 6]
const COR_DO_CHAO: Rgb = [140, 191, 128] // GRAMA #8cbf80, chapada: o telhado é o assunto
/** As 3 cores da mesa por modelo: a padrão do modelo e duas da paleta do app (uma escura). */
const CORES_DA_MESA: Record<ModeloDoTeto, string[]> = {
  telhas: ['#8a5a46', '#656b72', '#35373b'],
  madeira: ['#8b6b47', '#7b776e', '#5f4532'],
  palha: ['#d6b56a', '#9a8155', '#7d7a5a'],
}

type Rgb = [number, number, number]

// ---------- PNG (8 bits, sem entrelaçar; o que o Godot grava) ----------

interface Img {
  w: number
  h: number
  /** canais por pixel: 1, 2, 3 ou 4 */
  c: number
  d: Uint8Array
}

function lerPng(caminho: string): Img {
  const b = readFileSync(caminho)
  let o = 8
  let w = 0
  let h = 0
  let tipo = -1
  const idat: Buffer[] = []
  while (o < b.length) {
    const n = b.readUInt32BE(o)
    const t = b.toString('latin1', o + 4, o + 8)
    const dado = b.subarray(o + 8, o + 8 + n)
    if (t === 'IHDR') {
      w = dado.readUInt32BE(0)
      h = dado.readUInt32BE(4)
      if (dado[8] !== 8 || dado[12] !== 0) throw new Error(`${caminho}: só PNG de 8 bits sem entrelaçar`)
      tipo = dado[9]
    } else if (t === 'IDAT') idat.push(dado)
    else if (t === 'IEND') break
    o += 12 + n
  }
  const c = ({ 0: 1, 4: 2, 2: 3, 6: 4 } as Record<number, number>)[tipo]
  if (c === undefined) throw new Error(`${caminho}: tipo de cor ${tipo} não suportado`)
  const cru = inflateSync(Buffer.concat(idat))
  const linha = w * c
  const d = new Uint8Array(w * h * c)
  for (let y = 0; y < h; y += 1) {
    const f = cru[y * (linha + 1)]
    const fonte = y * (linha + 1) + 1
    for (let x = 0; x < linha; x += 1) {
      const raw = cru[fonte + x]
      const a = x >= c ? d[y * linha + x - c] : 0
      const up = y > 0 ? d[(y - 1) * linha + x] : 0
      const ul = x >= c && y > 0 ? d[(y - 1) * linha + x - c] : 0
      let v = raw
      if (f === 1) v = raw + a
      else if (f === 2) v = raw + up
      else if (f === 3) v = raw + ((a + up) >> 1)
      else if (f === 4) {
        const p = a + up - ul
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - ul)
        v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? up : ul)
      }
      d[y * linha + x] = v & 255
    }
  }
  return { w, h, c, d }
}

function crc32(bytes: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < bytes.length; i += 1) {
    c ^= bytes[i]
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function bloco(tipo: string, dados: Uint8Array): Buffer {
  const cab = Buffer.alloc(8)
  cab.writeUInt32BE(dados.length, 0)
  cab.write(tipo, 4, 'latin1')
  const corpo = Buffer.concat([cab.subarray(4), Buffer.from(dados)])
  const fim = Buffer.alloc(4)
  fim.writeUInt32BE(crc32(corpo), 0)
  return Buffer.concat([cab.subarray(0, 4), corpo, fim])
}

function gravarPng(caminho: string, w: number, h: number, c: 3 | 4, d: Uint8Array): void {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = c === 3 ? 2 : 6
  const cru = Buffer.alloc((w * c + 1) * h)
  for (let y = 0; y < h; y += 1) Buffer.from(d.buffer, d.byteOffset + y * w * c, w * c).copy(cru, y * (w * c + 1) + 1)
  writeFileSync(
    caminho,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      bloco('IHDR', ihdr),
      bloco('IDAT', deflateSync(cru, { level: 6 })),
      bloco('IEND', new Uint8Array(0)),
    ]),
  )
}

/** Canal `k` (0..1) no ponto (x, y) da imagem, bilinear, centros de pixel em +0,5; `rodaX` repete em x. */
function bilinear(img: Img, x: number, y: number, k: number, rodaX: boolean, rodaY: boolean): number {
  const fx = x - 0.5
  const fy = y - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const ix = (i: number) => (rodaX ? ((i % img.w) + img.w) % img.w : Math.min(Math.max(i, 0), img.w - 1))
  const iy = (i: number) => (rodaY ? ((i % img.h) + img.h) % img.h : Math.min(Math.max(i, 0), img.h - 1))
  const a = ix(x0)
  const b = ix(x0 + 1)
  const c = iy(y0)
  const e = iy(y0 + 1)
  const v = (xx: number, yy: number) => img.d[(yy * img.w + xx) * img.c + k]
  return ((v(a, c) * (1 - tx) + v(b, c) * tx) * (1 - ty) + (v(a, e) * (1 - tx) + v(b, e) * tx) * ty) / 255
}

// ---------- a textura lida ----------

interface Mistura {
  semente: number
  escala: number
  faixa: number
  corte: number
}

export interface TexturaDeTelhado {
  bases: Img[]
  lado: number
  mistura: Mistura
  tom: { semente: number; escala: number; amplitude: number }
  luz: { agua: number; lado: number }
  beiral: { escuro: number; alturaPx: number; franjaPx: number; franjaPassoPx: number }
  rincao: { escuro: number; larguraPx: number }
}

export interface FaixaLida {
  img: Img
  comprimentoPx: number
  meiaLarguraPx: number
  pxPorMapa: number
  onde: Set<string>
  ganhoLado: number
}

export interface ObjetoLido {
  img: Img
  /** lado do corpo na imagem, px; e o centro do corpo na imagem, px */
  corpoPx: number
  ancora: [number, number]
}

export interface Tingir {
  neutro: number
  ganhoL: number
  escuroAte: number
  claroDesde: number
}

const TINGIR_PADRAO: Tingir = { neutro: 0.5, ganhoL: 0.48, escuroAte: 0.1, claroDesde: 0.94 }

function lerJson(caminho: string): Record<string, any> {
  return JSON.parse(readFileSync(caminho, 'utf8')) as Record<string, any>
}

function lerTelhado(pasta: string, j: Record<string, any>): TexturaDeTelhado {
  return {
    bases: (j.base.arquivos as string[]).map((a) => lerPng(join(pasta, a))),
    lado: j.base.ladoPx,
    mistura: j.mistura,
    tom: j.tom,
    luz: j.luz,
    beiral: j.beiral,
    rincao: j.rincao,
  }
}

function lerFaixa(pasta: string, f: Record<string, any>, ganhoLado: number): FaixaLida {
  return {
    img: lerPng(join(pasta, f.arquivo)),
    comprimentoPx: f.comprimentoPx,
    meiaLarguraPx: f.meiaLarguraPx,
    pxPorMapa: f.pxPorCasa / CASA,
    onde: new Set(f.onde as string[]),
    ganhoLado,
  }
}

// ---------- a conta (CONTRATO.md, seção 8) ----------

function suave(a: number, b: number, t: number): number {
  const x = Math.min(Math.max((t - a) / (b - a), 0), 1)
  return x * x * (3 - 2 * x)
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** Pesos das variantes no ponto do mundo: a mesma conta do chão (seção 4). */
function pesos(m: Mistura, n: number, quantas: number): [number, number, number] {
  if (quantas === 1) return [1, 0, 0]
  if (quantas === 2) {
    const t = suave(-m.faixa, m.faixa, n)
    return [1 - t, t, 0]
  }
  const w1 = 1 - suave(-m.corte - m.faixa, -m.corte + m.faixa, n)
  const w3 = suave(m.corte - m.faixa, m.corte + m.faixa, n)
  return [w1, 1 - w1 - w3, w3]
}

/** valor (0..1) e lado (-1..1) da base no espaço da água: u ao longo do beiral, v subindo da ponta do beiral. */
function amostrarBase(t: TexturaDeTelhado, u: number, v: number, x: number, y: number): [number, number] {
  const L = t.lado
  const ix = mod(u, L)
  const iy = mod(L - mod(v, L), L)
  const n = ruidoDoMundo(x / t.mistura.escala, y / t.mistura.escala, t.mistura.semente)
  const w = pesos(t.mistura, n, t.bases.length)
  let valor = 0
  let lado = 0
  for (let i = 0; i < t.bases.length; i += 1) {
    if (w[i] <= 0) continue
    valor += w[i] * bilinear(t.bases[i], ix, iy, 0, true, true)
    lado += w[i] * (bilinear(t.bases[i], ix, iy, 1, true, true) * 2 - 1)
  }
  valor *= 1 + t.tom.amplitude * ruidoDoMundo(x / t.tom.escala, y / t.tom.escala, t.tom.semente)
  return [valor, lado]
}

/** O recuo da franja do beiral (px do mapa), a fórmula da palha do app com outro tamanho. */
function franja(t: TexturaDeTelhado | null, u: number): number {
  if (t === null || t.beiral.franjaPx <= 0) return 0
  const meia = t.beiral.franjaPx / 2
  return meia + meia * Math.sin(u * ((2 * Math.PI) / t.beiral.franjaPassoPx) + 0.9 * Math.sin(u * 0.83))
}

/** O que o app guarda de um telhado montado antes de tingir: G (o valor final, 0..1) e a cobertura. */
export interface CampoDoTelhado {
  largura: number
  altura: number
  origemX: number
  origemY: number
  G: Float32Array
  alfa: Float32Array
  geo: GeometriaDasAguas
}

/** Liso (sem textura por baixo): o valor neutro com a luz da água, para provar faixa e objeto sozinhos. */
const LISO: Omit<TexturaDeTelhado, 'bases' | 'lado' | 'mistura' | 'tom'> = {
  luz: { agua: 0.18, lado: 0.12 },
  beiral: { escuro: 0.22, alturaPx: 2.2, franjaPx: 0, franjaPassoPx: 4.6 },
  rincao: { escuro: 0.1, larguraPx: 1.7 },
}

/**
 * O telhado do polígono (px do mapa) num campo de valor G, 1 px por px do mapa,
 * na mesma caixa da imagem do `pintarTelhado` do app (beiral + 1 px de margem).
 */
export function campoDoTelhado(poligono: readonly PontoDoTelhado[], tex: TexturaDeTelhado | null, faixa: FaixaLida | null): CampoDoTelhado | null {
  const geo = prepararAguas(poligono)
  if (geo === null) return null
  const par = tex ?? LISO
  const margem = BEIRAL_PX + 1
  const origemX = Math.floor(geo.minX - margem)
  const origemY = Math.floor(geo.minY - margem)
  const largura = Math.ceil(geo.maxX + margem) - origemX
  const altura = Math.ceil(geo.maxY + margem) - origemY
  const G = new Float32Array(largura * altura)
  const alfa = new Float32Array(largura * altura)
  const n = geo.n
  const luzDaAgua = new Float64Array(n)
  const luzAoLongo = new Float64Array(n)
  for (let i = 0; i < n; i += 1) {
    luzDaAgua[i] = -geo.nx[i] * LUZ_X - geo.ny[i] * LUZ_Y
    luzAoLongo[i] = geo.dx[i] * LUZ_X + geo.dy[i] * LUZ_Y
  }
  const valorNaAgua = (a: number, u: number, v: number, x: number, y: number): number => {
    if (tex === null) return 0.5 + par.luz.agua * luzDaAgua[a]
    const [valor, lado] = amostrarBase(tex, u, v, x, y)
    return valor + par.luz.lado * lado * luzAoLongo[a] + par.luz.agua * luzDaAgua[a]
  }
  const am = novaAmostraDaAgua()
  const cruz = new Float64Array(n)
  for (let py = 0; py < altura; py += 1) {
    const y = origemY + py + 0.5
    const total = cruzamentosDaLinha(geo, y, cruz)
    let proximo = 0
    let dentro = false
    for (let px = 0; px < largura; px += 1) {
      const x = origemX + px + 0.5
      while (proximo < total && cruz[proximo] <= x) {
        dentro = !dentro
        proximo += 1
      }
      if (!amostrarAgua(geo, x, y, dentro, BEIRAL_PX + 0.5, am)) continue
      const a = am.agua
      const v = am.dist + BEIRAL_PX
      const u = am.aoLongo + geo.regua[a]
      let g = valorNaAgua(a, u, v, x, y)
      const b = am.vizinha
      const ate = am.ateEmenda
      if (b >= 0 && ate < 0.5) {
        // Na emenda o pixel mistura as duas águas pela área de cada uma (como o app).
        const gb = valorNaAgua(b, geo.t[b] + geo.regua[b], geo.s[b] + BEIRAL_PX, x, y)
        const peso = 0.5 + ate
        g = g * peso + gb * (1 - peso)
      }
      if (b >= 0 && am.rincao) g -= par.rincao.escuro * (1 - suave(0.4, par.rincao.larguraPx, ate))
      const vb = v - franja(tex, u)
      if (vb < par.beiral.alturaPx) g -= par.beiral.escuro * (1 - suave(0, par.beiral.alturaPx, vb))
      if (faixa !== null && b >= 0 && !am.rincao && ate < faixa.meiaLarguraPx) {
        const tipo = ehCumeeira(geo, a, b) ? 'cumeeira' : 'espigao'
        if (faixa.onde.has(tipo)) {
          const lo = a < b ? a : b
          const hi = a < b ? b : a
          const s = posicaoAoLongoDoCume(geo, a, b, x, y)
          const c = a === lo ? ate : -ate
          // Atravessando a emenda, do lado da água de índice maior para o da menor.
          const wx = geo.nx[hi] - geo.nx[lo]
          const wy = geo.ny[hi] - geo.ny[lo]
          const wn = Math.hypot(wx, wy) || 1
          const luzAtravessada = (wx * LUZ_X + wy * LUZ_Y) / wn
          const fx = mod(s, faixa.comprimentoPx) * faixa.pxPorMapa
          const fy = (c + faixa.meiaLarguraPx) * faixa.pxPorMapa
          const gf = bilinear(faixa.img, fx, fy, 0, true, false)
          const lf = bilinear(faixa.img, fx, fy, 1, true, false) * 2 - 1
          const af = bilinear(faixa.img, fx, fy, 3, true, false)
          g += (gf + faixa.ganhoLado * lf * luzAtravessada - g) * af
        }
      }
      const o = py * largura + px
      G[o] = g
      alfa[o] = Math.min(Math.max(vb + 0.5, 0), 1)
    }
  }
  return { largura, altura, origemX, origemY, G, alfa, geo }
}

// ---------- tingir (PROPOSTA-TINGIR.md, a mesma conta do chão de sala) ----------

function linear(c8: number): number {
  const c = c8 / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function srgb8(l: number): number {
  const c = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055
  return Math.round(Math.min(Math.max(c, 0), 1) * 255)
}

function linearDoOklab(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function cabe(c: Rgb): boolean {
  return c.every((k) => k >= -1e-6 && k <= 1 + 1e-6)
}

export function hexParaRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** A rampa de 256 cores da cor do mestre: rampa[G · 255]. */
export function rampaDaCor(hex: string, t: Tingir = TINGIR_PADRAO): Uint8Array {
  const [r, g, b] = hexParaRgb(hex)
  const [L, A, B] = oklabDoRgb(r, g, b)
  const j = suave(0, t.escuroAte, L) * (1 - suave(t.claroDesde, 1, L))
  const rampa = new Uint8Array(256 * 3)
  for (let i = 0; i < 256; i += 1) {
    const Lp = Math.min(Math.max(L + t.ganhoL * j * (i / 255 - t.neutro), 0), 1)
    let c = linearDoOklab(Lp, A, B)
    if (!cabe(c)) {
      let lo = 0
      let hi = 1
      for (let k = 0; k < 18; k += 1) {
        const meio = (lo + hi) / 2
        if (cabe(linearDoOklab(Lp, A * meio, B * meio))) lo = meio
        else hi = meio
      }
      c = linearDoOklab(Lp, A * lo, B * lo)
    }
    rampa[i * 3] = srgb8(c[0])
    rampa[i * 3 + 1] = srgb8(c[1])
    rampa[i * 3 + 2] = srgb8(c[2])
  }
  return rampa
}

/** RGBA sem pré-multiplicar, o formato do `pintarTelhado`. */
export function tingirCampo(campo: CampoDoTelhado, rampa: Uint8Array): Uint8ClampedArray {
  const p = new Uint8ClampedArray(campo.largura * campo.altura * 4)
  for (let o = 0; o < campo.G.length; o += 1) {
    if (campo.alfa[o] <= 0) continue
    const i = Math.min(Math.max(Math.round(campo.G[o] * 255), 0), 255) * 3
    p[o * 4] = rampa[i]
    p[o * 4 + 1] = rampa[i + 1]
    p[o * 4 + 2] = rampa[i + 2]
    p[o * 4 + 3] = Math.round(campo.alfa[o] * 255)
  }
  return p
}

/** O objeto (a chaminé) por cima, onde o app a põe (`posicaoDaChamine`), no tamanho que ele escolhe. */
export function porObjeto(campo: CampoDoTelhado, pixels: Uint8ClampedArray, obj: ObjetoLido): boolean {
  const ch = posicaoDaChamine(campo.geo)
  if (ch === null) return false
  const k = obj.corpoPx / ch.lado // px da imagem do objeto por px do mapa
  for (let py = 0; py < campo.altura; py += 1) {
    for (let px = 0; px < campo.largura; px += 1) {
      const x = campo.origemX + px + 0.5
      const y = campo.origemY + py + 0.5
      const ix = obj.ancora[0] + (x - ch.x) * k
      const iy = obj.ancora[1] + (y - ch.y) * k
      if (ix < -1 || iy < -1 || ix > obj.img.w + 1 || iy > obj.img.h + 1) continue
      const a = bilinear(obj.img, ix, iy, 3, false, false) * (ix < 0 || iy < 0 || ix > obj.img.w || iy > obj.img.h ? 0 : 1)
      if (a <= 0) continue
      const o = (py * campo.largura + px) * 4
      for (let c = 0; c < 3; c += 1) pixels[o + c] = pixels[o + c] * (1 - a) + bilinear(obj.img, ix, iy, c, false, false) * 255 * a
      pixels[o + 3] = pixels[o + 3] + (255 - pixels[o + 3]) * a
    }
  }
  return true
}

// ---------- a mesa ----------

interface Imagem {
  largura: number
  altura: number
  origemX: number
  origemY: number
  pixels: Uint8ClampedArray
}

const P = (x: number, y: number): PontoDoTelhado => ({ x: x * CASA, y: y * CASA })
/** Cena A (18 x 10 casas): a casa retangular e a casa em L (cumeeira, espigão e rincão). */
const CENA_A = {
  casas: [18, 10],
  casasDaCena: [
    { nome: 'retangular', poligono: [P(1, 2), P(8, 2), P(8, 7), P(1, 7)] },
    { nome: 'em L', poligono: [P(10, 1), P(14, 1), P(14, 5), P(17, 5), P(17, 9), P(10, 9)] },
  ],
  /** O close a 300%: o encontro do rincão com as duas cumeeiras do L (3 x 3 casas). */
  perto: { x: 11.5 * CASA, y: 4.5 * CASA, lado: 3 * CASA },
}
/** Cena B (30 x 10 casas): um telhado grande, 28 x 8 casas, para procurar repetição. */
const CENA_B = { casas: [30, 10], casasDaCena: [{ nome: 'grande', poligono: [P(1, 1), P(29, 1), P(29, 9), P(1, 9)] }] }

function cena(casas: number[], telhados: Imagem[]): Uint8Array {
  const w = casas[0] * CASA
  const h = casas[1] * CASA
  const d = new Uint8Array(w * h * 3)
  for (let o = 0; o < w * h; o += 1) d.set(COR_DO_CHAO, o * 3)
  for (const t of telhados) {
    for (let y = 0; y < t.altura; y += 1) {
      for (let x = 0; x < t.largura; x += 1) {
        const a = (t.pixels[(y * t.largura + x) * 4 + 3] / 255) * SOMBRA_ALFA
        const cx = t.origemX + x + SOMBRA_X
        const cy = t.origemY + y + SOMBRA_Y
        if (a <= 0 || cx < 0 || cy < 0 || cx >= w || cy >= h) continue
        const o = (cy * w + cx) * 3
        for (let c = 0; c < 3; c += 1) d[o + c] = Math.round(d[o + c] * (1 - a) + COR_DA_SOMBRA[c] * a)
      }
    }
  }
  for (const t of telhados) {
    for (let y = 0; y < t.altura; y += 1) {
      for (let x = 0; x < t.largura; x += 1) {
        const i = (y * t.largura + x) * 4
        const a = t.pixels[i + 3] / 255
        const cx = t.origemX + x
        const cy = t.origemY + y
        if (a <= 0 || cx < 0 || cy < 0 || cx >= w || cy >= h) continue
        const o = (cy * w + cx) * 3
        for (let c = 0; c < 3; c += 1) d[o + c] = Math.round(d[o + c] * (1 - a) + t.pixels[i + c] * a)
      }
    }
  }
  return d
}

/** Média OKLab dos pixels cheios do telhado (alfa 255). */
function mediaOklab(imgs: Imagem[]): [number, number, number] {
  let L = 0
  let A = 0
  let B = 0
  let n = 0
  for (const t of imgs) {
    for (let i = 0; i < t.pixels.length; i += 4) {
      if (t.pixels[i + 3] < 255) continue
      const [l, a, b] = oklabDoRgb(t.pixels[i], t.pixels[i + 1], t.pixels[i + 2])
      L += l
      A += a
      B += b
      n += 1
    }
  }
  return n === 0 ? [0, 0, 0] : [L / n, A / n, B / n]
}

function nomeDaCor(modelo: ModeloDoTeto, hex: string): string {
  return PALETA_DO_TETO[modelo].find((c) => c.hex === hex.toLowerCase())?.nome ?? hex
}

function argumentos(): Map<string, string> {
  const m = new Map<string, string>()
  for (const a of process.argv.slice(2)) {
    const i = a.indexOf('=')
    if (a.startsWith('--')) m.set(i < 0 ? a.slice(2) : a.slice(2, i), i < 0 ? '1' : a.slice(i + 1))
  }
  return m
}

function canalComoCinza(img: Img, k: number, fundo: number | null): Uint8Array {
  const d = new Uint8Array(img.w * img.h * 3)
  for (let i = 0; i < img.w * img.h; i += 1) {
    let v = img.d[i * img.c + k]
    if (fundo !== null && img.c === 4) {
      const a = img.d[i * 4 + 3] / 255
      v = Math.round(v * a + fundo * (1 - a))
    }
    d.fill(v, i * 3, i * 3 + 3)
  }
  return d
}

function principal(): void {
  const args = argumentos()
  const pasta = args.get('textura')
  const saida = args.get('saida')
  if (pasta === undefined || saida === undefined) throw new Error('uso: --textura=<exportado/id> --saida=<pasta> [--sob=<dir>] [--faixa=<dir>] [--sem-atual]')
  mkdirSync(saida, { recursive: true })
  const j = lerJson(join(pasta, 'textura.json'))
  const tipo: string = j.tipo
  const avisos: string[] = []
  let tex: TexturaDeTelhado | null = null
  let jTelhado: Record<string, any> | null = null
  let pastaTelhado = ''
  if (tipo === 'telhado') {
    tex = lerTelhado(pasta, j)
    jTelhado = j
    pastaTelhado = pasta
  } else {
    const sob = args.get('sob')
    if (sob !== undefined && existsSync(join(sob, 'textura.json'))) {
      jTelhado = lerJson(join(sob, 'textura.json'))
      pastaTelhado = sob
      tex = lerTelhado(sob, jTelhado)
    } else avisos.push('sem telhado Desenhado por baixo: telhado liso (só a cor e a luz da água)')
  }
  let faixa: FaixaLida | null = null
  if (tipo === 'faixa') faixa = lerFaixa(pasta, j.faixa, j.luz.lado)
  else if (jTelhado !== null && jTelhado.faixa?.arquivo) faixa = lerFaixa(pastaTelhado, jTelhado.faixa, jTelhado.luz.lado)
  else if (jTelhado !== null && jTelhado.faixa?.de) {
    const outra = args.get('faixa')
    if (outra !== undefined && existsSync(join(outra, 'textura.json'))) {
      const jf = lerJson(join(outra, 'textura.json'))
      faixa = lerFaixa(outra, jf.faixa, jf.luz.lado)
    } else avisos.push(`a faixa vem de '${jTelhado.faixa.de}', que ainda não foi exportada: sem faixa`)
  }
  const obj: ObjetoLido | null =
    tipo === 'objeto' ? { img: lerPng(join(pasta, j.objeto.arquivo)), corpoPx: j.objeto.corpoPx, ancora: j.objeto.ancoraPx } : null
  const modelo: ModeloDoTeto = (tipo === 'telhado' ? j.idDoApp : (jTelhado?.idDoApp ?? (tipo === 'faixa' ? j.modelo : 'telhas'))) as ModeloDoTeto
  const cores: string[] = (j.cores as string[] | undefined) ?? CORES_DA_MESA[modelo]
  const tingir: Tingir = (j.tingir ?? jTelhado?.tingir ?? TINGIR_PADRAO) as Tingir
  const extras = { chamine: tipo === 'objeto', cumeeiraAmarrada: modelo === 'palha' }
  const semAtual = args.has('sem-atual')

  const montar = (cenaDef: typeof CENA_B, nomeDaCena: string, k: number) => {
    const rampa = rampaDaCor(cores[k], tingir)
    const desenhado: Imagem[] = []
    const atual: Imagem[] = []
    for (const casa of cenaDef.casasDaCena) {
      const campo = campoDoTelhado(casa.poligono, tex, faixa)
      if (campo === null) continue
      const pixels = tingirCampo(campo, rampa)
      if (obj !== null && !porObjeto(campo, pixels, obj)) avisos.push(`a casa ${casa.nome} não tem lugar para o objeto`)
      desenhado.push({ ...campo, pixels })
      if (!semAtual) atual.push(pintarTelhado(casa.poligono, modelo, cores[k], 1, extras))
    }
    gravarPng(join(saida, `${nomeDaCena}-${k}-desenhado.png`), cenaDef.casas[0] * CASA, cenaDef.casas[1] * CASA, 3, cena(cenaDef.casas, desenhado))
    if (!semAtual) gravarPng(join(saida, `${nomeDaCena}-${k}-atual.png`), cenaDef.casas[0] * CASA, cenaDef.casas[1] * CASA, 3, cena(cenaDef.casas, atual))
    return { desenhado, atual }
  }

  const alvo = (hex: string) => oklabDoRgb(...hexParaRgb(hex))
  const medidas = []
  for (let k = 0; k < cores.length; k += 1) {
    const { desenhado, atual } = montar(CENA_A, 'cenaA', k)
    const [L0, a0, b0] = alvo(cores[k])
    const [Ld, ad, bd] = mediaOklab(desenhado)
    const m: Record<string, number | string> = {
      cor: cores[k],
      nome: nomeDaCor(modelo, cores[k]),
      deltaLDesenhado: Number((Ld - L0).toFixed(4)),
      deltaEDesenhado: Number(Math.hypot(Ld - L0, ad - a0, bd - b0).toFixed(4)),
    }
    if (atual.length > 0) {
      const [La, aa, ba] = mediaOklab(atual)
      m.deltaLAtual = Number((La - L0).toFixed(4))
      m.deltaEAtual = Number(Math.hypot(La - L0, aa - a0, ba - b0).toFixed(4))
    }
    medidas.push(m)
  }
  montar(CENA_B, 'cenaB', 0)

  // Os arquivos, para a folha: o valor e o lado de cada base em cinza, a faixa e o objeto.
  const arquivos: string[] = []
  if (tex !== null && tipo === 'telhado') {
    tex.bases.forEach((b, i) => {
      gravarPng(join(saida, `arquivo-base-${i + 1}-valor.png`), b.w, b.h, 3, canalComoCinza(b, 0, null))
      gravarPng(join(saida, `arquivo-base-${i + 1}-lado.png`), b.w, b.h, 3, canalComoCinza(b, 1, null))
      arquivos.push(`arquivo-base-${i + 1}-valor.png`, `arquivo-base-${i + 1}-lado.png`)
    })
  }
  if (faixa !== null) {
    gravarPng(join(saida, 'arquivo-faixa-valor.png'), faixa.img.w, faixa.img.h, 3, canalComoCinza(faixa.img, 0, 40))
    gravarPng(join(saida, 'arquivo-faixa-lado.png'), faixa.img.w, faixa.img.h, 3, canalComoCinza(faixa.img, 1, 40))
    arquivos.push('arquivo-faixa-valor.png', 'arquivo-faixa-lado.png')
  }
  if (obj !== null) {
    const d = new Uint8Array(obj.img.w * obj.img.h * 3)
    const fundo = hexParaRgb(cores[0])
    for (let i = 0; i < obj.img.w * obj.img.h; i += 1) {
      const a = obj.img.d[i * 4 + 3] / 255
      for (let c = 0; c < 3; c += 1) d[i * 3 + c] = Math.round(obj.img.d[i * 4 + c] * a + fundo[c] * (1 - a))
    }
    gravarPng(join(saida, 'arquivo-objeto.png'), obj.img.w, obj.img.h, 3, d)
    arquivos.push('arquivo-objeto.png')
  }
  const paineis = {
    tipo,
    modelo,
    cores: cores.map((c) => ({ hex: c, nome: nomeDaCor(modelo, c) })),
    cenaA: { casas: CENA_A.casas, perto: CENA_A.perto, casasDaCena: CENA_A.casasDaCena.map((c) => c.nome) },
    cenaB: { casas: CENA_B.casas },
    atual: !semAtual,
    faixa: faixa !== null,
    objeto: obj !== null,
    telhadoPorBaixo: tex !== null,
    medidas,
    arquivos,
    avisos,
  }
  writeFileSync(join(saida, 'paineis.json'), JSON.stringify(paineis, null, 2))
  console.log(`telhado: ${cores.length} cores, ${medidas.map((m) => `${m.nome} dL ${m.deltaLDesenhado}`).join(', ')}${avisos.length ? ` (avisos: ${avisos.join('; ')})` : ''}`)
}

principal()
