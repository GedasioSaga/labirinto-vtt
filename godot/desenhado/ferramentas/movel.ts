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
 *   1. a variante (a opção que muda o desenho, como o assento de palha ou de madeira; a
 *      forma do objeto, como o tapete redondo; a variação que o app sorteia pelo id, como
 *      a lápide);
 *   2. a virada k = round(giro / 90) mod 4 e a forma (a desenhada, ou a transposta);
 *   3. o tingir: cada pixel = soma dos pesos x rampa(tom do lugar)[valor] (10.5; a pedra
 *      com menos croma no escuro);
 *   4. o esticar (ponta + meio + ponta; o meio liso estica, o que repete põe módulos
 *      inteiros, o centro fixo fica inteiro e centrado) ou a escala da pegada (10.6);
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
  /** O meio que repete (opcional, 10.6): o período do módulo em casas; sem ele, o meio é liso. */
  readonly periodoCasas?: number
  /** Quantos módulos o desenho tem entre as pontas (só com periodoCasas). */
  readonly modulos?: number
  /**
   * O centro fixo (opcional, 10.6, lote 12): a largura em casas da peça do meio que não
   * estica e fica sempre centrada (a placa do arco do portão); o meio liso fica dos dois
   * lados dela. No eixo "x" ou "xy" (ao longo), nunca com periodoCasas.
   */
  readonly centroCasas?: number
  /**
   * O centro fixo atravessado (opcional, 10.6, lote 13, o tapete): só no "xy", a largura em
   * casas da peça do meio que não estica no y; com centroCasas, o medalhão fica inteiro e no
   * meio nos dois eixos, e a barra em volta corre lisa dos dois lados dele.
   */
  readonly centroCasasY?: number
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

/**
 * A cerca por peças (opcional, só a cerca; CONTRATO 10.12): de onde a conta tira o mourão
 * e a coluna da ligação na forma 0 de cada variante, para deitar a cerca na geometria do
 * app (reta ou curva).
 */
export interface PecasDaCerca {
  /** O meio de um mourão na forma 0, casas a partir do canto da pegada (sem a margem). */
  readonly mouraoCasas: readonly [number, number]
  /** O raio do recorte do mourão, casas: o mourão inteiro com o contorno, nada da ligação além dele. */
  readonly raioCasas: number
  /** A coluna da ligação (x na forma 0, casas a partir do canto da pegada): igual em todo x perto dela. */
  readonly colunaCasas: number
  /** De -l a l do quanto o lado da ligação olha para a luz, a luz passa de uma borda para a outra (smoothstep). */
  readonly viradaDaLuz: number
}

export interface ParamsDoMovel {
  readonly id: string
  readonly idDoApp: string
  readonly margemCasas: number
  readonly lugares: readonly string[]
  /**
   * quando: {lugar: opção}, {forma: "redondo"} (a forma do objeto, só o tapete) ou
   * {variacao: "1"} (a variação que o app sorteia pelo id, só a lápide; 10.2, lote 15). vistas
   * (opcional, 10.6, lote 13): a pegada e o esticar próprios desta variante numa vista (o
   * tapete redondo, 2 x 2, que não estica: vira oval pela escala).
   */
  readonly variantes: readonly { readonly nome: string; readonly quando: Readonly<Record<string, string>>; readonly vistas?: Readonly<Partial<Record<Vista, VistaDoMovel>>> }[]
  readonly vistas: Readonly<Partial<Record<Vista, VistaDoMovel>>>
  readonly formas: readonly FormaDoMovel[]
  readonly sombra: { readonly jeito: 'deslocada' | 'nenhuma'; readonly direcao: readonly [number, number]; readonly deslocamentoCasas: number; readonly borraoCasas: number; readonly alfa: number; readonly cor: string }
  readonly tingir: Rampa
  /** Só a cerca: as peças que a conta deita na geometria do app (10.12). */
  readonly pecas?: PecasDaCerca
  /**
   * Só quem escolhe o desenho pela variação do app (10.2, lote 15: a lápide): a função do app
   * que sorteia (doApp) e quantos desenhos. O número vai no Pedido (variacao).
   */
  readonly variacao?: { readonly chave: string; readonly doApp: string; readonly quantas: number; readonly conta: string }
}

/**
 * A geometria da cerca que o app já calcula (`geometriaDaCerca(largura, altura, volta)` de
 * lib/mobilia.ts), em CASAS, no referencial do objeto (o meio da pegada na origem, sem o
 * giro): os meios dos mourões, o raio deles e o arco que passa pelos meios (null na reta).
 */
export interface GeometriaDaCercaEmCasas {
  readonly mouroes: readonly { readonly x: number; readonly y: number }[]
  readonly raio: number
  readonly arco: { readonly center: { readonly x: number; readonly y: number }; readonly radius: number; readonly startAngle: number; readonly sweep: number } | null
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
  /** A forma do objeto (Prop.forma do app: só o tapete, "redondo"; ausente = "retangular"). */
  readonly forma?: string
  /**
   * A variação do desenho que o app sorteia pelo id do objeto (só a lápide:
   * varianteDaLapide(prop.id) de lib/mobilia/pecasNovas.ts; ausente = 0). Bate com
   * quando.variacao (10.2, lote 15).
   */
  readonly variacao?: number
  /** Só a cerca com `pecas`: a geometria do app; com ela a cerca sai por peças (10.12), reta ou curva. */
  readonly cerca?: GeometriaDaCercaEmCasas
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

/**
 * A classe PEDRA tinge com menos croma no escuro (10.5, lote 12). Com o cromaNaSombra da
 * família (+0,25) o arenito chegava ao contorno em (74, 51, 0), azul zero: a borda da pedra
 * lia como ocre saturado (o poço, 29/10). Com -0,6 o croma cai para 65% no contorno
 * (70, 52, 16) e o meio, a luz e o realce não mudam. Os ids são os de classe 'pedra' em
 * MATERIAIS do app (meioTermo/materiais.ts); a madeira e o resto ficam com a rampa da família.
 */
export const CROMA_NA_SOMBRA_DA_PEDRA = -0.6
export const MATERIAIS_DE_PEDRA: ReadonlySet<string> = new Set(['granito', 'arenito', 'ardosia', 'barro'])

/** A rampa de um lugar: a da família, com o croma do escuro da pedra se a opção é de pedra. */
export function rampaDaOpcao(r: Rampa, opcao: string | undefined): Rampa {
  return opcao !== undefined && MATERIAIS_DE_PEDRA.has(opcao) ? { ...r, cromaNaSombra: CROMA_NA_SOMBRA_DA_PEDRA } : r
}

/** O que entra na chave das formas tingidas além dos tons: quais lugares são de pedra. */
function classesDoPedido(opcoes: readonly string[]): string {
  return opcoes.map((o) => (MATERIAIS_DE_PEDRA.has(o) ? 'p' : '-')).join('')
}

const RAMPAS = new Map<string, Float32Array>()

function rampaGuardada(tom: Rgb, r: Rampa): Float32Array {
  const chave = `${tom.join(',')}|${r.cromaNaSombra}`
  let pronta = RAMPAS.get(chave)
  if (pronta === undefined) {
    pronta = rampaDoTom(tom, r)
    RAMPAS.set(chave, pronta)
  }
  return pronta
}

// ---------- 1 e 2: a variante e a forma ----------

/** A chave de "quando" que não é lugar: a forma do objeto (só o tapete; 10.6, lote 13). */
export const CHAVE_DA_FORMA = 'forma'
export const FORMA_PADRAO = 'retangular'
/** A chave de "quando" que não é lugar: a variação que o app sorteia pelo id (só a lápide; 10.2, lote 15). */
export const CHAVE_DA_VARIACAO = 'variacao'

/** Se uma chave de "quando" bate com o pedido: a forma, a variação (o texto do número) ou a opção do lugar. */
function bateComOPedido(p: ParamsDoMovel, chave: string, opcao: string, opcoes: readonly string[], forma: string | undefined, variacao: number | undefined): boolean {
  if (chave === CHAVE_DA_FORMA) return (forma ?? FORMA_PADRAO) === opcao
  if (chave === CHAVE_DA_VARIACAO) return String(variacao ?? 0) === opcao
  return opcoes[p.lugares.indexOf(chave)] === opcao
}

export function varianteDoPedido(p: ParamsDoMovel, opcoes: readonly string[], forma?: string, variacao?: number): string {
  for (const v of p.variantes) {
    const bate = Object.entries(v.quando).every(([chave, opcao]) => bateComOPedido(p, chave, opcao, opcoes, forma, variacao))
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
function tingir(m: MovelCarregado, f: FormaDoMovel, tons: readonly Rgb[], opcoes: readonly string[], transposta: boolean): Camada {
  const valor = m.imagens.get(f.valor)
  const partes = m.imagens.get(f.partes)
  if (valor === undefined || partes === undefined) throw new Error(`${m.p.id}: falta ${f.valor} ou ${f.partes}`)
  const cor = f.cor !== undefined ? m.imagens.get(f.cor) : undefined
  const rampas = tons.map((t, i) => rampaGuardada(t, rampaDaOpcao(m.p.tingir, opcoes[i])))
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

/**
 * O meio que repete (10.6): um meio de M casas leva n = round(M / P) módulos inteiros, cada
 * um com M / n casas (a sobra se reparte pelos módulos, que crescem ou encolhem); mais curto
 * que meio período, n = 0 e o meio é a coluna da emenda (lisa). Devolve, para o ponto u do
 * meio (0..M), a posição dentro do primeiro módulo da imagem (0..P).
 */
export function faseNoModulo(u: number, M: number, P: number): number {
  const n = Math.round(M / P)
  if (n < 1) return 0
  const s = M / n
  const f = u / s - Math.floor(u / s)
  return f * P
}

/**
 * O ponto da imagem (casas, a partir da borda da pegada) para o ponto t do móvel de T casas.
 * Com `periodo`, o meio repete o primeiro módulo da imagem em vez de esticar. Com `centro`
 * (10.6), a peça do meio de `centro` casas fica inteira e centrada, e o meio liso dos dois
 * lados dela estica; mais curto que pontas + centro, o centro continua inteiro e as pontas
 * perdem por dentro (o meio liso some primeiro, depois a borda de dentro das pontas).
 */
export function mapearEixo(t: number, T: number, S: number, pontas: readonly [number, number] | null, periodo: number | null = null, centro: number | null = null): number {
  if (pontas === null) return (t * S) / T
  const [pE, pD] = pontas
  if (centro !== null) {
    const h = centro / 2
    const cT = T / 2
    const cS = S / 2
    if (Math.abs(t - cT) <= h) return cS + (t - cT)
    if (T >= pE + pD + centro) {
      if (t <= pE) return t
      if (t >= T - pD) return S - (T - t)
      if (t < cT) return pE + ((t - pE) * (cS - h - pE)) / (cT - h - pE)
      return cS + h + ((t - cT - h) * (S - pD - cS - h)) / (T - pD - cT - h)
    }
    return t < cT ? t : S - (T - t)
  }
  if (T >= pE + pD) {
    if (t <= pE) return t
    if (t >= T - pD) return S - (T - t)
    if (periodo !== null) return pE + faseNoModulo(t - pE, T - pE - pD, periodo)
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
  if (p.pecas !== undefined && pedido.cerca !== undefined) return comporCerca(m, p.pecas, pedido, pedido.cerca, pxPorCasa)
  const nomeDaVista: Vista = p.vistas[pedido.vista] !== undefined ? pedido.vista : 'frente'
  const variante = varianteDoPedido(p, pedido.opcoes, pedido.forma, pedido.variacao)
  // A vista própria da variante (o tapete redondo, 10.6), se ela tem; senão a do móvel.
  const vista = p.variantes.find((v) => v.nome === variante)?.vistas?.[nomeDaVista] ?? p.vistas[nomeDaVista]
  if (vista === undefined) throw new Error(`${p.id}: sem a vista ${pedido.vista}`)
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
  const { virada, transposta } = formaDaVirada(vista.viradas, k)
  const f = p.formas.find((x) => x.vista === nomeDaVista && x.variante === variante && x.virada === virada)
  if (f === undefined) throw new Error(`${p.id}: falta a forma ${nomeDaVista}-${variante}-${virada}`)
  // O id do móvel entra na chave: dois móveis com a mesma forma ("frente-padrao-0") e o mesmo tom trocavam de imagem.
  const chave = `${p.id}|${f.nome}|${transposta ? 't' : ''}|${pedido.tons.map((t) => t.join(',')).join('|')}|${classesDoPedido(pedido.opcoes)}`
  let nv = NIVEIS.get(chave)
  if (nv === undefined) {
    nv = niveis(tingir(m, f, pedido.tons, pedido.opcoes, transposta))
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
  // O meio que repete só anda ao longo do móvel.
  const periodo = es?.periodoCasas ?? null
  const periodoX = k % 2 === 0 ? periodo : null
  const periodoY = k % 2 === 0 ? null : periodo
  // O centro fixo anda ao longo e, no "xy" com centroCasasY, também atravessado (o tapete).
  const centro = es?.centroCasas ?? null
  const centroAtraves = es !== undefined && es.eixo === 'xy' ? (es.centroCasasY ?? null) : null
  const centroX = k % 2 === 0 ? centro : centroAtraves
  const centroY = k % 2 === 0 ? centroAtraves : centro
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
    const sy = mapearEixo(ty, alvo[1], fonte[1], pontasY, periodoY, centroY)
    for (let X = 0; X < W; X += 1) {
      const tx = (X + 0.5 - borda) / pxPorCasa
      const sx = mapearEixo(tx, alvo[0], fonte[0], pontasX, periodoX, centroX)
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

// ---------- a cerca por peças (10.12) ----------

/** LUZ da tela (de cima à esquerda), a mesma dos shaders. */
const LUZ_DA_TELA: readonly [number, number] = [-Math.SQRT1_2, -Math.SQRT1_2]

/**
 * A CERCA POR PEÇAS (só quem tem `pecas`, a cerca; CONTRATO 10.12), reta ou curva, em
 * qualquer giro, com a luz sempre de cima à esquerda. A geometria é a do app (os mourões e
 * o arco de `geometriaDaCerca`, girados pelo giro do objeto); as peças saem da forma 0 da
 * variante, já tingida:
 *   1. a LIGAÇÃO: para cada ponto perto do eixo (o segmento do primeiro ao último mourão,
 *      ou o arco), s ao longo, c atravessando (+ do lado n = (-t.y, t.x), t a direção de
 *      andar). A cor é a coluna `colunaCasas` da forma na altura c, misturada com a mesma
 *      coluna na altura -c: w = smoothstep(-l, l, -dot(n, LUZ) / 0,7071). Na cerca deitada
 *      (t = (1, 0)) w = 1 e sai a forma 0 como foi desenhada; em pé, w = 0 e a borda acesa
 *      passa para a esquerda (é a transposta); na curva a luz troca de borda devagar,
 *      onde a cerca anda na direção da luz.
 *   2. os MOURÕES, em pé (nunca giram: são redondos e a luz deles fica no lugar), por cima:
 *      o recorte de raio `raioCasas` em volta de `mouraoCasas`, posto no meio de cada
 *      mourão da geometria, com a borda suavizada em meio px.
 *   3. a sombra pela silhueta, como no resto (10.7).
 * A tela não gira mais nada (resto 0): o giro já está na conta.
 */
export function comporCerca(m: MovelCarregado, pc: PecasDaCerca, pedido: Pedido, g: GeometriaDaCercaEmCasas, pxPorCasa: number): Composto {
  const p = m.p
  const variante = varianteDoPedido(p, pedido.opcoes)
  const f = p.formas.find((x) => x.vista === 'frente' && x.variante === variante && x.virada === 0)
  if (f === undefined) throw new Error(`${p.id}: falta a forma frente-${variante}-0`)
  if (g.mouroes.length < 2) throw new Error(`${p.id}: a cerca precisa de 2 mourões`)
  // A mesma chave do comporMovel sem transpor: as duas contas dividem a forma tingida.
  const chave = `${p.id}|${f.nome}||${pedido.tons.map((t) => t.join(',')).join('|')}|${classesDoPedido(pedido.opcoes)}`
  let nv = NIVEIS.get(chave)
  if (nv === undefined) {
    nv = niveis(tingir(m, f, pedido.tons, pedido.opcoes, false))
    NIVEIS.set(chave, nv)
  }
  const nivel = Math.min(nv.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, PX_POR_CASA / pxPorCasa)))))
  const n = nv[nivel]
  /** px do nível por casa. */
  const kN = (n.w / nv[0].w) * PX_POR_CASA
  const mg = p.margemCasas
  const altura = f.casas[1]
  const meia = altura / 2 + mg
  const ang = (pedido.giro * Math.PI) / 180
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const naTela = (x: number, y: number): [number, number] => [x * co - y * si, x * si + y * co]
  const mouroes = g.mouroes.map((q) => naTela(q.x, q.y))
  const arco = g.arco === null ? null : { c: naTela(g.arco.center.x, g.arco.center.y), r: g.arco.radius, a0: g.arco.startAngle + ang, sw: g.arco.sweep }
  // Os limites: os mourões e o eixo, com a meia altura da forma.
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  const incluir = (x: number, y: number, r: number): void => {
    x0 = Math.min(x0, x - r)
    x1 = Math.max(x1, x + r)
    y0 = Math.min(y0, y - r)
    y1 = Math.max(y1, y + r)
  }
  for (const [x, y] of mouroes) incluir(x, y, Math.max(meia, pc.raioCasas))
  if (arco !== null) {
    for (let i = 0; i <= 64; i += 1) {
      const a = arco.a0 + (arco.sw * i) / 64
      incluir(arco.c[0] + Math.cos(a) * arco.r, arco.c[1] + Math.sin(a) * arco.r, meia)
    }
  }
  const sb = p.sombra
  const nd = Math.hypot(sb.direcao[0], sb.direcao[1])
  const desl = sb.jeito === 'nenhuma' ? 0 : sb.deslocamentoCasas * pxPorCasa
  const sigma = sb.jeito === 'nenhuma' ? 0 : sb.borraoCasas * pxPorCasa
  const borda = Math.ceil(desl + 3 * sigma + 2)
  const X0 = Math.floor(x0 * pxPorCasa) - borda
  const Y0 = Math.floor(y0 * pxPorCasa) - borda
  const W = Math.ceil(x1 * pxPorCasa) + borda - X0
  const H = Math.ceil(y1 * pxPorCasa) + borda - Y0
  const px = new Float32Array(W * H * 4)
  const a1 = [0, 0, 0, 0]
  const a2 = [0, 0, 0, 0]
  // 1. A ligação.
  const xCol = (pc.colunaCasas + mg) * kN
  const yMeio = meia * kN
  const [ax, ay] = mouroes[0]
  const [bx, by] = mouroes[mouroes.length - 1]
  const L = Math.hypot(bx - ax, by - ay) || 1
  const tx = (bx - ax) / L
  const ty = (by - ay) / L
  const sentido = arco === null ? 1 : Math.sign(arco.sw)
  for (let Y = 0; Y < H; Y += 1) {
    const wy = (Y + 0.5 + Y0) / pxPorCasa
    for (let X = 0; X < W; X += 1) {
      const wx = (X + 0.5 + X0) / pxPorCasa
      let c: number
      let nx: number
      let ny: number
      if (arco === null) {
        const s = (wx - ax) * tx + (wy - ay) * ty
        if (s < 0 || s > L) continue
        nx = -ty
        ny = tx
        c = (wx - ax) * nx + (wy - ay) * ny
      } else {
        const vx = wx - arco.c[0]
        const vy = wy - arco.c[1]
        const rr = Math.hypot(vx, vy) || 1e-9
        let d = Math.atan2(vy, vx) - arco.a0
        d -= 2 * Math.PI * Math.round(d / (2 * Math.PI))
        const u = d / arco.sw
        if (!(u >= 0 && u <= 1)) continue
        const ux = vx / rr
        const uy = vy / rr
        // t = sentido x (-sen, cos) no ângulo do ponto; n = (-t.y, t.x).
        nx = -ux * sentido
        ny = -uy * sentido
        c = (rr - arco.r) * (ux * nx + uy * ny)
      }
      if (Math.abs(c) > meia) continue
      const olha = -(nx * LUZ_DA_TELA[0] + ny * LUZ_DA_TELA[1]) / Math.SQRT1_2
      const w = suave(-pc.viradaDaLuz, pc.viradaDaLuz, olha)
      ler(n, xCol, yMeio + c * kN, a1)
      ler(n, xCol, yMeio - c * kN, a2)
      const o = (Y * W + X) * 4
      for (let q = 0; q < 4; q += 1) px[o + q] = w * a1[q] + (1 - w) * a2[q]
    }
  }
  // 2. Os mourões, em pé, por cima.
  const raioPx = pc.raioCasas * pxPorCasa
  const mx = (pc.mouraoCasas[0] + mg) * kN
  const my = (pc.mouraoCasas[1] + mg) * kN
  for (const [qx, qy] of mouroes) {
    const cx = qx * pxPorCasa - X0
    const cy = qy * pxPorCasa - Y0
    for (let Y = Math.max(0, Math.floor(cy - raioPx - 1)); Y < Math.min(H, Math.ceil(cy + raioPx + 1)); Y += 1) {
      for (let X = Math.max(0, Math.floor(cx - raioPx - 1)); X < Math.min(W, Math.ceil(cx + raioPx + 1)); X += 1) {
        const dx = X + 0.5 - cx
        const dy = Y + 0.5 - cy
        const mascara = Math.min(1, Math.max(0, raioPx - Math.hypot(dx, dy) + 0.5))
        if (mascara <= 0) continue
        ler(n, mx + (dx / pxPorCasa) * kN, my + (dy / pxPorCasa) * kN, a1)
        const a = (a1[3] / 255) * mascara
        if (a <= 0) continue
        const o = (Y * W + X) * 4
        for (let q = 0; q < 4; q += 1) px[o + q] = a1[q] * mascara + px[o + q] * (1 - a)
      }
    }
  }
  // 3. A sombra pela silhueta.
  let sombra: Float32Array | null = null
  if (sb.jeito !== 'nenhuma') {
    const dx = Math.round((sb.direcao[0] / nd) * desl)
    const dy = Math.round((sb.direcao[1] / nd) * desl)
    const a = new Float32Array(W * H)
    for (let Y = 0; Y < H; Y += 1) {
      for (let X = 0; X < W; X += 1) {
        const xs = X - dx
        const ys = Y - dy
        if (xs >= 0 && ys >= 0 && xs < W && ys < H) a[Y * W + X] = px[(ys * W + xs) * 4 + 3] / 255
      }
    }
    sombra = desfocar(a, W, H, sigma).map((v) => v * sb.alfa)
  }
  return { corpo: { w: W, h: H, px }, sombra, cx: -X0, cy: -Y0, k: 0, resto: 0, forma: f.nome, transposta: false }
}
