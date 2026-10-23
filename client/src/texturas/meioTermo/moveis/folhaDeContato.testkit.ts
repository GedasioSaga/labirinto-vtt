/**
 * FOLHA DE CONTATO sem canvas: uma tela RGB em memória, colagem de imagem
 * RGBA (cor pura) sobre ela, letreiro em fonte de bitmap 5 x 7 e gravação em
 * PNG (zlib do Node). Assim a folha sai do mesmo teste que mede os pixels,
 * sem navegador.
 *
 * Só para teste: nenhum código do app importa isto.
 */
import { deflateSync } from 'node:zlib'

export interface Tela {
  readonly largura: number
  readonly altura: number
  /** RGB, 3 bytes por pixel. */
  readonly rgb: Uint8Array
}

export function novaTela(largura: number, altura: number, fundo: readonly [number, number, number]): Tela {
  const rgb = new Uint8Array(largura * altura * 3)
  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = fundo[0]
    rgb[i + 1] = fundo[1]
    rgb[i + 2] = fundo[2]
  }
  return { largura, altura, rgb }
}

/** Cola a imagem RGBA (cor pura, `W` x `H`) com o canto de cima à esquerda em (x, y), misturando pelo alfa. */
export function colar(tela: Tela, px: Uint8ClampedArray, W: number, H: number, x: number, y: number): void {
  for (let j = 0; j < H; j += 1) {
    const ty = y + j
    if (ty < 0 || ty >= tela.altura) continue
    for (let i = 0; i < W; i += 1) {
      const tx = x + i
      if (tx < 0 || tx >= tela.largura) continue
      const o = (j * W + i) * 4
      const a = px[o + 3] / 255
      if (a <= 0) continue
      const d = (ty * tela.largura + tx) * 3
      for (let c = 0; c < 3; c += 1) tela.rgb[d + c] = Math.round(px[o + c] * a + tela.rgb[d + c] * (1 - a))
    }
  }
}

/** Letras 5 x 7 (linha de cima primeiro, `#` = aceso). Só as que os rótulos usam; o resto sai em branco. */
const FONTE: Readonly<Record<string, readonly string[]>> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
}

/** Largura de uma letra com o espaço depois, em pixels de fonte. */
const PASSO_DA_LETRA = 6

/** Escreve `texto` (maiúsculas) em (x, y), cada pixel da fonte com `escala` px de lado. */
export function escrever(tela: Tela, texto: string, x: number, y: number, escala: number, cor: readonly [number, number, number]): void {
  for (let k = 0; k < texto.length; k += 1) {
    const letra = FONTE[texto[k]]
    if (letra === undefined) continue
    for (let j = 0; j < letra.length; j += 1) {
      for (let i = 0; i < letra[j].length; i += 1) {
        if (letra[j][i] !== '#') continue
        for (let sy = 0; sy < escala; sy += 1) {
          for (let sx = 0; sx < escala; sx += 1) {
            const tx = x + (k * PASSO_DA_LETRA + i) * escala + sx
            const ty = y + j * escala + sy
            if (tx < 0 || ty < 0 || tx >= tela.largura || ty >= tela.altura) continue
            const d = (ty * tela.largura + tx) * 3
            tela.rgb[d] = cor[0]
            tela.rgb[d + 1] = cor[1]
            tela.rgb[d + 2] = cor[2]
          }
        }
      }
    }
  }
}

const TABELA_CRC = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  TABELA_CRC[n] = c >>> 0
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloco(tipo: string, dados: Uint8Array): Uint8Array {
  const saida = new Uint8Array(12 + dados.length)
  const vista = new DataView(saida.buffer)
  vista.setUint32(0, dados.length)
  for (let i = 0; i < 4; i += 1) saida[4 + i] = tipo.charCodeAt(i)
  saida.set(dados, 8)
  vista.setUint32(8 + dados.length, crc32(saida.subarray(4, 8 + dados.length)))
  return saida
}

const ASSINATURA_PNG = [137, 80, 78, 71, 13, 10, 26, 10]
const PROFUNDIDADE_DE_BITS = 8
const TIPO_RGB = 2

/** A tela em PNG RGB de 8 bits, sem filtro por linha. */
export function emPng(tela: Tela): Uint8Array {
  const cabecalho = new Uint8Array(13)
  const vista = new DataView(cabecalho.buffer)
  vista.setUint32(0, tela.largura)
  vista.setUint32(4, tela.altura)
  cabecalho[8] = PROFUNDIDADE_DE_BITS
  cabecalho[9] = TIPO_RGB
  const linha = tela.largura * 3
  const cru = new Uint8Array((linha + 1) * tela.altura)
  for (let y = 0; y < tela.altura; y += 1) cru.set(tela.rgb.subarray(y * linha, (y + 1) * linha), y * (linha + 1) + 1)
  const partes = [new Uint8Array(ASSINATURA_PNG), bloco('IHDR', cabecalho), bloco('IDAT', new Uint8Array(deflateSync(cru))), bloco('IEND', new Uint8Array(0))]
  const total = new Uint8Array(partes.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of partes) {
    total.set(p, o)
    o += p.length
  }
  return total
}
