/**
 * CHÃO SEM REPETIÇÃO do Meio-Termo (fatia MT7, plano
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`, seção 3): a
 * textura do mapa deixa de ser um ladrilho repetido e passa a ser lida POR
 * POSIÇÃO no mundo. Cada pixel do pedaço sai de:
 *
 * 1. o ladrilho de hoje (os mesmos pixels que o `TilingSprite` repete), lido
 *    numa coordenada TORCIDA por ruído sem período (domain warp): a mesma
 *    folha, a mesma copa, mas nunca duas vezes no mesmo lugar;
 * 2. as MANCHAS do protótipo aprovado (`vila-meio-termo/prototipo/meio.js:255-283`):
 *    ruído em 3 escalas (230, 80 e 27 px) que clareia para o realce e
 *    escurece para a sombra, com os números da grama (`#8cbf80` → realce
 *    `#a2cc92`, sombra `#76ac6d`);
 * 3. o GRÃO de papel do protótipo (`meio.js:285-308`): ruído branco em células
 *    de 2 x 2 px do mundo, em luz suave, força 22.
 *
 * Tudo é conta inteira (`hash`) e as quatro operações: sem `Math.random`, sem
 * seno; a mesma entrada dá os mesmos bytes em qualquer motor. Puro, sem
 * canvas nem Pixi: o teste mede os bytes que a tela vai mostrar
 * (`pixi/pedacosDoChao.ts` só põe estes bytes numa textura).
 */
import { hash, mod } from '../ruido'
import { ruidoDeValor, ruidoDoMundo } from './ruidoDoMundo'

/** Lado do pedaço em pixels (no nível 0, um pixel do pedaço é um pixel do mundo). */
export const LADO_DO_PEDACO = 256

/** Passo da grade grossa (px do pedaço) onde a torção e as manchas são calculadas; o pixel interpola entre os pontos. */
const PASSO_DA_GRADE = 8
const PONTOS_DA_GRADE = LADO_DO_PEDACO / PASSO_DA_GRADE + 1
/** Campos da grade: torção em x, torção em y, manchas. */
const CAMPOS = 3

/** Torção das texturas naturais, em fração do lado do ladrilho no mundo (medida em `chaoNoMundo.test.ts`). */
export const TORCAO_NATURAL = 0.15
/** As de assentamento em casas (convés, lajotas, calçamento) não torcem: a junta fica reta e na grade. */
export const TORCAO_DO_ASSENTAMENTO = 0

/** As duas escalas da torção, em lados do ladrilho no mundo, e o peso de cada uma. */
const TORCAO_LARGA = { lado: 1, peso: 0.65 }
const TORCAO_FINA = { lado: 0.37, peso: 0.35 }

/** Manchas: o protótipo clareia 18% para o branco e escurece 13% (do realce e da sombra da grama). */
const MANCHA_CLARA = 0.18
const MANCHA_ESCURA = 0.13
const GANHO_DA_MANCHA = 1.5

/** Grão: força do protótipo (22 em 255, em luz suave) e a semente dele. */
const FORCA_DO_GRAO = 22
const SEMENTE_DO_GRAO = 821

/** Um ladrilho em RGBA, quadrado (os do catálogo e os importados têm lado em potência de 2). */
export interface ImagemDoLadrilho {
  readonly lado: number
  readonly pixels: Uint8ClampedArray
}

/** O chão de UMA textura num mapa: o ladrilho dela, o tamanho dele no mundo, a semente e a torção. */
export interface ChaoDaTextura {
  readonly ladrilho: ImagemDoLadrilho
  /** Lado do ladrilho no mundo, em px (`drawTexturas.ladoDoLadrilhoNoMundo`). */
  readonly ladoNoMundo: number
  readonly semente: number
  /** Amplitude da torção em fração de `ladoNoMundo`. */
  readonly torcao: number
}

/**
 * Um pedaço do mundo: o quadrado (i, j) da grade de lado
 * `LADO_DO_PEDACO * 2^nivel` px. No nível 0 cada pixel do pedaço é um pixel
 * do mundo; no nível k, 2^k (o mapa afastado pede menos pixels).
 */
export interface Pedaco {
  readonly i: number
  readonly j: number
  readonly nivel: number
}

/** Lado do pedaço no mundo, em px. */
export function ladoDoPedacoNoMundo(nivel: number): number {
  return LADO_DO_PEDACO * 2 ** nivel
}

/** A SEMENTE do chão de uma textura: FNV-1a do id (a mesma no app e nos testes; Campo e Terra não dividem manchas). */
export function sementeDoChao(id: string): number {
  let h = 2166136261
  for (let k = 0; k < id.length; k += 1) h = Math.imul(h ^ id.charCodeAt(k), 16777619)
  return (h >>> 0) % 1_000_003
}

/** A torção de uma textura: as assentadas em casas (`casas`) não torcem, as naturais torcem `TORCAO_NATURAL`. */
export function torcaoDaTextura(textura: { readonly casas?: number } | null): number {
  return textura?.casas !== undefined ? TORCAO_DO_ASSENTAMENTO : TORCAO_NATURAL
}

/** Os níveis de mip de cada ladrilho (média de 2 x 2), feitos sob demanda e guardados com ele. */
const mipsGuardados = new WeakMap<ImagemDoLadrilho, ImagemDoLadrilho[]>()

function metade(img: ImagemDoLadrilho): ImagemDoLadrilho {
  const L = Math.max(1, img.lado >> 1)
  const pixels = new Uint8ClampedArray(L * L * 4)
  const W = img.lado
  const ultimo = W - 1
  for (let y = 0; y < L; y += 1) {
    const y0 = Math.min(ultimo, y * 2) * W
    const y1 = Math.min(ultimo, y * 2 + 1) * W
    for (let x = 0; x < L; x += 1) {
      const x0 = Math.min(ultimo, x * 2)
      const x1 = Math.min(ultimo, x * 2 + 1)
      const a = (y0 + x0) * 4
      const b = (y0 + x1) * 4
      const c = (y1 + x0) * 4
      const d = (y1 + x1) * 4
      const o = (y * L + x) * 4
      for (let k = 0; k < 4; k += 1) pixels[o + k] = (img.pixels[a + k] + img.pixels[b + k] + img.pixels[c + k] + img.pixels[d + k]) / 4
    }
  }
  return { lado: L, pixels }
}

/** O mip `m` do ladrilho (0 = ele mesmo); para no lado 4. */
export function mipDoLadrilho(img: ImagemDoLadrilho, m: number): ImagemDoLadrilho {
  let mips = mipsGuardados.get(img)
  if (mips === undefined) {
    mips = [img]
    mipsGuardados.set(img, mips)
  }
  while (mips.length <= m && mips[mips.length - 1].lado > 4) mips.push(metade(mips[mips.length - 1]))
  return mips[Math.min(m, mips.length - 1)]
}

/** O mip que o pedaço lê: o passo no ladrilho (px do ladrilho por px do pedaço) arredondado para baixo em potência de 2. */
export function mipDoPedaco(chao: ChaoDaTextura, nivel: number): number {
  const passo = (chao.ladrilho.lado / chao.ladoNoMundo) * 2 ** nivel
  return passo < 2 ? 0 : Math.floor(Math.log2(passo))
}

/** A pintura de um pedaço em andamento: os bytes, a grade grossa e a próxima linha. */
export interface PinturaDoPedaco {
  readonly pixels: Uint8ClampedArray
  readonly grade: Float32Array
  linha: number
}

/** Torção e manchas nos pontos da grade grossa do pedaço (33 x 33 pontos, 3 campos). */
function gradeDoPedaco(chao: ChaoDaTextura, pedaco: Pedaco): Float32Array {
  const grade = new Float32Array(PONTOS_DA_GRADE * PONTOS_DA_GRADE * CAMPOS)
  const passo = 2 ** pedaco.nivel
  const x0 = pedaco.i * LADO_DO_PEDACO * passo
  const y0 = pedaco.j * LADO_DO_PEDACO * passo
  const amplitude = chao.torcao * chao.ladoNoMundo
  const larga = TORCAO_LARGA.lado * chao.ladoNoMundo
  const fina = TORCAO_FINA.lado * chao.ladoNoMundo
  const s = chao.semente
  for (let gy = 0; gy < PONTOS_DA_GRADE; gy += 1) {
    const y = y0 + gy * PASSO_DA_GRADE * passo
    for (let gx = 0; gx < PONTOS_DA_GRADE; gx += 1) {
      const x = x0 + gx * PASSO_DA_GRADE * passo
      const o = (gy * PONTOS_DA_GRADE + gx) * CAMPOS
      if (amplitude > 0) {
        grade[o] = amplitude * (ruidoDeValor(x / larga, y / larga, s + 10) * TORCAO_LARGA.peso + ruidoDeValor(x / fina, y / fina, s + 11) * TORCAO_FINA.peso)
        grade[o + 1] = amplitude * (ruidoDeValor(x / larga, y / larga, s + 20) * TORCAO_LARGA.peso + ruidoDeValor(x / fina, y / fina, s + 21) * TORCAO_FINA.peso)
      }
      grade[o + 2] = ruidoDoMundo(x, y, s)
    }
  }
  return grade
}

export function comecarPedaco(chao: ChaoDaTextura, pedaco: Pedaco): PinturaDoPedaco {
  return { pixels: new Uint8ClampedArray(LADO_DO_PEDACO * LADO_DO_PEDACO * 4), grade: gradeDoPedaco(chao, pedaco), linha: 0 }
}

/**
 * Pinta as linhas da pintura até `ate` (exclusivo). Pintar em pedaços de
 * linhas dá os MESMOS bytes de pintar de uma vez (teste): a fila de fatias de
 * 8 ms (`pedacosDoChao.ts`) para em qualquer linha.
 */
export function pintarLinhas(chao: ChaoDaTextura, pedaco: Pedaco, p: PinturaDoPedaco, ate: number): void {
  const fim = Math.min(LADO_DO_PEDACO, ate)
  if (p.linha >= fim) return
  const passo = 2 ** pedaco.nivel
  const x0 = pedaco.i * LADO_DO_PEDACO * passo
  const y0 = pedaco.j * LADO_DO_PEDACO * passo
  const m = mipDoPedaco(chao, pedaco.nivel)
  const tex = mipDoLadrilho(chao.ladrilho, m)
  const L = tex.lado
  const mascara = L - 1
  const potencia = (L & mascara) === 0
  const fonte = tex.pixels
  // Px do ladrilho (no mip) por px do mundo.
  const escala = tex.lado / chao.ladoNoMundo
  // O grão: no nível 0 uma célula tem 2 x 2 px do mundo; acima, uma célula por pixel do pedaço, mais fraca (a média de várias).
  const celula = pedaco.nivel === 0 ? 2 : 1
  const forcaDoGrao = ((FORCA_DO_GRAO * 2) / 255) / 2 ** Math.max(0, pedaco.nivel - 1)
  const sementeDoGrao = SEMENTE_DO_GRAO + pedaco.nivel * 7
  const gx0 = pedaco.i * LADO_DO_PEDACO
  const gy0 = pedaco.j * LADO_DO_PEDACO
  const G = PONTOS_DA_GRADE
  const linhaDaGrade = new Float32Array(G * CAMPOS)
  const destino = p.pixels
  const grade = p.grade
  for (let py = p.linha; py < fim; py += 1) {
    // A grade interpolada na vertical para esta linha.
    const ty = (py + 0.5) / PASSO_DA_GRADE
    const gyA = Math.min(G - 2, Math.floor(ty))
    const fy = ty - gyA
    for (let k = 0; k < G * CAMPOS; k += 1) {
      const a = grade[gyA * G * CAMPOS + k]
      linhaDaGrade[k] = a + (grade[(gyA + 1) * G * CAMPOS + k] - a) * fy
    }
    const yMundo = y0 + (py + 0.5) * passo
    const cy = Math.floor((gy0 + py) / celula)
    for (let px = 0; px < LADO_DO_PEDACO; px += 1) {
      const tx = (px + 0.5) / PASSO_DA_GRADE
      const gxA = Math.min(G - 2, Math.floor(tx))
      const fx = tx - gxA
      const oa = gxA * CAMPOS
      const ob = oa + CAMPOS
      const torX = linhaDaGrade[oa] + (linhaDaGrade[ob] - linhaDaGrade[oa]) * fx
      const torY = linhaDaGrade[oa + 1] + (linhaDaGrade[ob + 1] - linhaDaGrade[oa + 1]) * fx
      const n = linhaDaGrade[oa + 2] + (linhaDaGrade[ob + 2] - linhaDaGrade[oa + 2]) * fx
      // O ladrilho, bilinear e dando a volta, na coordenada torcida (centro do texel em 0,5).
      const u = (x0 + (px + 0.5) * passo + torX) * escala - 0.5
      const v = (yMundo + torY) * escala - 0.5
      const iu = Math.floor(u)
      const iv = Math.floor(v)
      const fu = u - iu
      const fv = v - iv
      const ua = potencia ? iu & mascara : mod(iu, L)
      const ub = potencia ? (iu + 1) & mascara : mod(iu + 1, L)
      const va = (potencia ? iv & mascara : mod(iv, L)) * L
      const vb = (potencia ? (iv + 1) & mascara : mod(iv + 1, L)) * L
      const a = (va + ua) * 4
      const b = (va + ub) * 4
      const c = (vb + ua) * 4
      const d = (vb + ub) * 4
      const pa = (1 - fu) * (1 - fv)
      const pb = fu * (1 - fv)
      const pc = (1 - fu) * fv
      const pd = fu * fv
      // Manchas (claro para o branco, escuro por multiplicação) e grão em luz suave.
      const k = Math.min(1, Math.abs(n) * GANHO_DA_MANCHA)
      const claro = n > 0 ? MANCHA_CLARA * k : 0
      const escuro = n > 0 ? 1 : 1 - MANCHA_ESCURA * k
      const grao = (hash(Math.floor((gx0 + px) / celula), cy, sementeDoGrao) - 0.5) * forcaDoGrao
      const o = (py * LADO_DO_PEDACO + px) * 4
      for (let canal = 0; canal < 3; canal += 1) {
        let cor = fonte[a + canal] * pa + fonte[b + canal] * pb + fonte[c + canal] * pc + fonte[d + canal] * pd
        cor = (cor + (255 - cor) * claro) * escuro
        destino[o + canal] = cor + (grao * cor * (255 - cor)) / 255
      }
      destino[o + 3] = 255
    }
  }
  p.linha = fim
}

/** O pedaço inteiro de uma vez (teste e folha de contato). */
export function pintarPedaco(chao: ChaoDaTextura, pedaco: Pedaco): Uint8ClampedArray {
  const p = comecarPedaco(chao, pedaco)
  pintarLinhas(chao, pedaco, p, LADO_DO_PEDACO)
  return p.pixels
}
