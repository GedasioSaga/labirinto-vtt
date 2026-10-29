import { oklabDoRgb } from '../meioTermo/materiais'

/**
 * DESENHADO, a textura que PEGA A COR da sala (`godot/desenhado/PROPOSTA-TINGIR.md`,
 * o piso): o chão é montado em cinza (R = G = B, g = R / 255, g = 0,5 é a cor do
 * mestre) e cada g vira a cor de uma rampa de 256 cores calculada UMA vez por cor
 * de sala (`FloorPiece.fillColor`, `Region.fillColor`).
 *
 * Cópia fiel de `rampaDaCor` de `godot/desenhado/ferramentas/telhado.ts` (a
 * referência do pacote, "a mesma conta do chão de sala"):
 *   (L, a, b) = OKLab da cor; j = suave(0, escuroAte, L) · (1 − suave(claroDesde, 1, L));
 *   L′ = L + ganhoL · j · (g − neutro); a e b iguais; fora do sRGB, a e b
 *   encolhem juntos (mesmo matiz) por busca binária até caber.
 * Por que não o `tint` do Pixi: ele só multiplica (escurece), e o chão sumiria
 * nas salas escuras dos mapas do usuário (`#612e05`, `#290e00`, `#050467`).
 */

/** Os números da conta, como saem no bloco `tingir` do `textura.json` (e no do telhado). */
export interface ContaDeTingir {
  readonly neutro: number
  readonly ganhoL: number
  readonly escuroAte: number
  readonly claroDesde: number
}

/** A conta da proposta aprovada, para quando o `textura.json` não trouxer o bloco. */
export const TINGIR_PADRAO: ContaDeTingir = { neutro: 0.5, ganhoL: 0.48, escuroAte: 0.1, claroDesde: 0.94 }

/** Passos da busca binária do croma (a referência usa 18: 2^-18 do croma, abaixo de 1/255). */
const PASSOS_DA_BUSCA = 18

type Rgb = [number, number, number]

function suave(a: number, b: number, t: number): number {
  const x = Math.min(Math.max((t - a) / (b - a), 0), 1)
  return x * x * (3 - 2 * x)
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

/** `#rrggbb` (ou `#rgb`) em 0..255; texto que não é cor = `null` (a sala fica no Atual). */
export function rgbDoHex(hex: string): Rgb | null {
  const curto = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex)
  const texto = curto === null ? hex : `#${curto[1]}${curto[1]}${curto[2]}${curto[2]}${curto[3]}${curto[3]}`
  if (!/^#[0-9a-f]{6}$/i.test(texto)) return null
  const n = Number.parseInt(texto.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** A rampa de 256 cores (RGB, 3 bytes por entrada) da cor do mestre: `rampa[g · 255]`. */
export function rampaDaCor(rgb: Readonly<Rgb>, t: ContaDeTingir = TINGIR_PADRAO): Uint8Array {
  const [L, A, B] = oklabDoRgb(rgb[0], rgb[1], rgb[2])
  const j = suave(0, t.escuroAte, L) * (1 - suave(t.claroDesde, 1, L))
  const rampa = new Uint8Array(256 * 3)
  for (let i = 0; i < 256; i += 1) {
    const Lp = Math.min(Math.max(L + t.ganhoL * j * (i / 255 - t.neutro), 0), 1)
    let c = linearDoOklab(Lp, A, B)
    if (!cabe(c)) {
      let lo = 0
      let hi = 1
      for (let k = 0; k < PASSOS_DA_BUSCA; k += 1) {
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

/** Rampas já feitas, por cor e conta: um mapa tem poucas cores de sala. */
const rampasGuardadas = new Map<string, Uint8Array>()
const TETO_DE_RAMPAS = 256

/** A rampa da cor, guardada; cor inválida = `null`. */
export function rampaGuardada(hex: string, t: ContaDeTingir = TINGIR_PADRAO): Uint8Array | null {
  const chave = `${hex.toLowerCase()}|${t.neutro}|${t.ganhoL}|${t.escuroAte}|${t.claroDesde}`
  const pronta = rampasGuardadas.get(chave)
  if (pronta !== undefined) return pronta
  const rgb = rgbDoHex(hex)
  if (rgb === null) return null
  // Sem crescer sem fim (o seletor de cor passa por centenas de cores num arrasto).
  if (rampasGuardadas.size >= TETO_DE_RAMPAS) rampasGuardadas.clear()
  const rampa = rampaDaCor(rgb, t)
  rampasGuardadas.set(chave, rampa)
  return rampa
}
