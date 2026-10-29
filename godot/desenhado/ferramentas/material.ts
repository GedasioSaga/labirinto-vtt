/**
 * A SUPERFÍCIE Desenhado dos móveis (CONTRATO.md, seção 10): a referência da
 * integração no app. Escrita contra o motor de hoje
 * (client/src/texturas/meioTermo/moveis/motor.ts), sem mudar nada nele: o
 * motor continua montando as peças, o chanfro, o contorno, a sombra e o brilho
 * do metal; o Desenhado troca só a função de textura da CLASSE do material
 * (a tabela TEXTURA do motor), que é onde a superfície entra hoje.
 *
 * Uma função de textura recebe (u, v) em px do protótipo (56 por casa), u ao
 * longo do veio (o motor já gira pelo `eixo`, dá a volta pelo `polar` e pelo
 * `arco`), e devolve em `s` a cor e a luz. A do Desenhado:
 *   1. lê a imagem da classe (valor em cinza, 0,5 = o tom do material) em
 *      (u, v) x 128 / 56 px, repetindo, com mipmap pela escala da pintura;
 *   2. troca o valor pela cor de uma RAMPA OKLab calculada do tom da peça
 *      (`p.base`, o tom do material vezes o `tom` da peça), como o chão de sala
 *      (PROPOSTA-TINGIR.md): a luz anda, o matiz e o croma ficam;
 *   3. na madeira, mantém a ESTRUTURA de hoje (tábua, fresta, emenda de topo e o
 *      tom de cada tábua) e dá a cada tábua, e a cada trecho entre emendas, uma
 *      janela sorteada da imagem.
 *
 * Não é teste e não entra no app: a mesa de prova (ferramentas/moveis.ts) usa.
 */
import { hash, type Rgb } from '@cliente/texturas/ruido'
import { oklabDoRgb } from '@cliente/texturas/meioTermo/materiais'
import type { ClasseDaPeca, Peca, Textura } from '@cliente/texturas/meioTermo/moveis/motor'

/** Px do protótipo por casa (contexto.ts, G). */
export const G = 56
/** Px da imagem do material por casa. */
export const PX_POR_CASA = 128
/** Texels da imagem por px do protótipo. */
export const TEXEL_POR_PROTO = PX_POR_CASA / G

export interface Tingir {
  readonly conta: 'luz-oklab'
  readonly neutro: number
  readonly ganhoL: number
  readonly escuroAte: number
  readonly claroDesde: number
}

/** Uma imagem decodificada em níveis de mipmap (valor 0..1, um canal). */
export interface ImagemDoMaterial {
  readonly nome: string
  readonly niveis: readonly { readonly w: number; readonly h: number; readonly v: Float32Array }[]
}

export interface MaterialCarregado {
  readonly classe: ClasseDaPeca
  /** A primeira é a da classe; as outras, pelo subtipo do motor (`fio`, `pedra`, `casca`). */
  readonly imagens: readonly ImagemDoMaterial[]
  readonly tingir: Tingir
  /** Tamanho da imagem em px do protótipo (período ao longo e atravessando). */
  readonly periodoProto: readonly [number, number]
}

// ---------- mipmap e leitura ----------

/** Os níveis de mipmap de uma imagem de lados em potência de 2 (média de 2 x 2). */
export function niveisDe(w: number, h: number, v: Float32Array): { w: number; h: number; v: Float32Array }[] {
  const niveis = [{ w, h, v }]
  let atual = niveis[0]
  while (atual.w > 4 && atual.h > 4) {
    const nw = atual.w >> 1
    const nh = atual.h >> 1
    const nv = new Float32Array(nw * nh)
    for (let y = 0; y < nh; y += 1) {
      for (let x = 0; x < nw; x += 1) {
        const o = 2 * y * atual.w + 2 * x
        nv[y * nw + x] = (atual.v[o] + atual.v[o + 1] + atual.v[o + atual.w] + atual.v[o + atual.w + 1]) / 4
      }
    }
    atual = { w: nw, h: nh, v: nv }
    niveis.push(atual)
  }
  return niveis
}

function bilinear(n: { w: number; h: number; v: Float32Array }, x: number, y: number): number {
  const fx = x - 0.5
  const fy = y - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const w = n.w
  const h = n.h
  const xa = ((x0 % w) + w) % w
  const xb = (xa + 1) % w
  const ya = ((y0 % h) + h) % h
  const yb = (ya + 1) % h
  const a = n.v[ya * w + xa]
  const b = n.v[ya * w + xb]
  const c = n.v[yb * w + xa]
  const d = n.v[yb * w + xb]
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
}

/**
 * O valor em (x, y) texels do nível 0, repetindo, com o mipmap escolhido pela
 * redução: `lod` = log2(texels por pixel da pintura). Trilinear entre os dois
 * níveis vizinhos (o que a placa faz com mipmap ligado).
 */
export function amostrar(img: ImagemDoMaterial, x: number, y: number, lod: number): number {
  const niveis = img.niveis
  if (lod <= 0) return bilinear(niveis[0], x, y)
  const max = niveis.length - 1
  const l = Math.min(lod, max)
  const i = Math.floor(l)
  const t = l - i
  const a = bilinear(niveis[i], x / 2 ** i, y / 2 ** i)
  if (t <= 0 || i >= max) return a
  const b = bilinear(niveis[i + 1], x / 2 ** (i + 1), y / 2 ** (i + 1))
  return a + (b - a) * t
}

/** `escala` do motor = pixels da pintura por px do protótipo. */
export function lodDaEscala(escala: number): number {
  return Math.log2(TEXEL_POR_PROTO / Math.max(1e-6, escala))
}

// ---------- a rampa OKLab (PROPOSTA-TINGIR.md) ----------

function suave(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function srgbDoLinear(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
}

/** sRGB 0..1 (sem cortar) do OKLab. */
function rgbDoOklab(L: number, a: number, b: number, saida: number[]): void {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  saida[0] = srgbDoLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  saida[1] = srgbDoLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  saida[2] = srgbDoLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
}

function cabe(c: number[]): boolean {
  return c[0] >= 0 && c[0] <= 1 && c[1] >= 0 && c[1] <= 1 && c[2] >= 0 && c[2] <= 1
}

/**
 * A rampa de 256 cores (0..255 por canal, em float) de um tom: o valor g vira
 * L' = L + ganhoL · j(L) · (g - neutro), com a e b do tom; se sair do sRGB, a e
 * b encolhem juntos (o mesmo matiz) até caber. g = neutro dá o próprio tom.
 */
export function rampaDoTom(tom: Rgb, t: Tingir): Float32Array {
  const [L, a, b] = oklabDoRgb(tom[0], tom[1], tom[2])
  const j = suave(0, t.escuroAte, L) * suave(1, t.claroDesde, L)
  const rampa = new Float32Array(256 * 3)
  const c = [0, 0, 0]
  for (let i = 0; i < 256; i += 1) {
    const Lr = Math.min(1, Math.max(0, L + t.ganhoL * j * (i / 255 - t.neutro)))
    rgbDoOklab(Lr, a, b, c)
    if (!cabe(c)) {
      let lo = 0
      let hi = 1
      for (let k = 0; k < 14; k += 1) {
        const meio = (lo + hi) / 2
        rgbDoOklab(Lr, a * meio, b * meio, c)
        if (cabe(c)) lo = meio
        else hi = meio
      }
      rgbDoOklab(Lr, a * lo, b * lo, c)
    }
    rampa[i * 3] = Math.min(255, Math.max(0, c[0] * 255))
    rampa[i * 3 + 1] = Math.min(255, Math.max(0, c[1] * 255))
    rampa[i * 3 + 2] = Math.min(255, Math.max(0, c[2] * 255))
  }
  return rampa
}

/** Uma rampa por tom de peça (o tom do material vezes o `tom` da peça): poucas por móvel. */
const RAMPAS = new Map<string, Float32Array>()

function rampaDaPeca(p: Peca, t: Tingir): Float32Array {
  const chave = `${p.base[0].toFixed(2)},${p.base[1].toFixed(2)},${p.base[2].toFixed(2)},${t.ganhoL}`
  let r = RAMPAS.get(chave)
  if (r === undefined) {
    r = rampaDoTom(p.base, t)
    RAMPAS.set(chave, r)
  }
  return r
}

function pintarValor(s: Float32Array, rampa: Float32Array, g: number): void {
  const i = Math.min(255, Math.max(0, Math.round(g * 255))) * 3
  s[0] = rampa[i]
  s[1] = rampa[i + 1]
  s[2] = rampa[i + 2]
}

// ---------- as texturas ----------

/** A imagem do subtipo da peça (fio, pedra, casca), ou a da classe. */
function imagemDaPeca(m: MaterialCarregado, p: Peca): ImagemDoMaterial {
  const sub = p.mat.fio ?? p.mat.pedra ?? p.mat.casca
  if (sub !== undefined) {
    const achada = m.imagens.find((i) => i.nome === sub)
    if (achada !== undefined) return achada
  }
  return m.imagens[0]
}

/**
 * Madeira: a estrutura de hoje (texMadeira do motor, a parte que não é veio:
 * tábua de `p.tabua` px, fresta, emenda de topo e o tom de cada tábua), e a
 * superfície da imagem numa janela sorteada por tábua e por trecho entre
 * emendas (a tábua vizinha e o trecho depois da emenda são outra madeira).
 */
function texMadeiraDesenhada(m: MaterialCarregado): Textura {
  const [Pu, Pv] = m.periodoProto
  return (u, v, _x, _y, p, s, escala) => {
    const W = p.tabua
    let j = 0
    let dentro = 99
    let fora = 99
    if (W > 0) {
      const fv = v / W
      j = Math.floor(fv)
      dentro = (fv - j) * W
      fora = W - dentro
    }
    const hj = hash(j, p.semente, 811)
    let luz = (hj - 0.5) * 0.12
    let trecho = 0
    if (W > 0) {
      const L = 60 + hash(j, p.semente, 812) * 90
      const uu = u / L + hash(j, p.semente, 813)
      trecho = Math.floor(uu)
      const fu = (uu - trecho) * L
      const ateTopo = fu < L - fu ? fu : L - fu
      if (ateTopo < 0.7) luz -= 0.22 * (1 - ateTopo / 0.7)
      const ate = dentro < fora ? dentro : fora
      if (ate < 0.75) luz -= 0.3 * (1 - ate / 0.75) * (1 - ate / 0.75)
      else if (dentro < 1.6) luz += 0.03
    }
    const ou = hash(j, trecho, p.semente + 815) * Pu
    const ov = hash(j, trecho, p.semente + 816) * Pv
    const g = amostrar(imagemDaPeca(m, p), (u + ou) * TEXEL_POR_PROTO, (v + ov) * TEXEL_POR_PROTO, lodDaEscala(escala))
    pintarValor(s, rampaDaPeca(p, m.tingir), g)
    s[3] += luz
  }
}

/** As outras classes: só a superfície, em (u, v) (a peça já desloca pela própria semente, `su` e `sv`). */
function texSuperficie(m: MaterialCarregado): Textura {
  return (u, v, _x, _y, p, s, escala) => {
    const g = amostrar(imagemDaPeca(m, p), u * TEXEL_POR_PROTO, v * TEXEL_POR_PROTO, lodDaEscala(escala))
    pintarValor(s, rampaDaPeca(p, m.tingir), g)
  }
}

/** A função de textura Desenhado da classe, no lugar da TEXTURA[classe] do motor. */
export function texturaDoMaterial(m: MaterialCarregado): Textura {
  return m.classe === 'madeira' ? texMadeiraDesenhada(m) : texSuperficie(m)
}
