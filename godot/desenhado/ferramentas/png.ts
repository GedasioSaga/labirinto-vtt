/**
 * PNG mínimo para as ferramentas da mesa (Node, sem dependência): lê PNG de 8
 * bits sem entrelaçamento (cinza, cinza com alfa, RGB, RGBA: o que o Godot
 * grava) e grava RGBA ou RGB.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

export interface Imagem {
  readonly w: number
  readonly h: number
  /** RGBA, 8 bits por canal, alfa reto. */
  readonly px: Uint8ClampedArray
}

const CANAIS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 4: 2, 6: 4 }

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

export function lerPng(caminho: string): Imagem {
  const b = readFileSync(caminho)
  let o = 8
  let w = 0
  let h = 0
  let tipo = 0
  const dados: Buffer[] = []
  while (o < b.length) {
    const n = b.readUInt32BE(o)
    const nome = b.toString('ascii', o + 4, o + 8)
    const corpo = b.subarray(o + 8, o + 8 + n)
    if (nome === 'IHDR') {
      w = corpo.readUInt32BE(0)
      h = corpo.readUInt32BE(4)
      if (corpo[8] !== 8 || corpo[12] !== 0) throw new Error(`${caminho}: só PNG de 8 bits sem entrelaçamento`)
      tipo = corpo[9]
    } else if (nome === 'IDAT') dados.push(corpo)
    else if (nome === 'IEND') break
    o += 12 + n
  }
  const c = CANAIS[tipo]
  if (c === undefined) throw new Error(`${caminho}: tipo de cor ${tipo} não lido`)
  const cru = inflateSync(Buffer.concat(dados))
  const linha = w * c
  const atual = new Uint8Array(linha)
  const antes = new Uint8Array(linha)
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y += 1) {
    const f = cru[y * (linha + 1)]
    const ini = y * (linha + 1) + 1
    for (let i = 0; i < linha; i += 1) {
      const x = cru[ini + i]
      const a = i >= c ? atual[i - c] : 0
      const up = antes[i]
      const ul = i >= c ? antes[i - c] : 0
      atual[i] = (f === 0 ? x : f === 1 ? x + a : f === 2 ? x + up : f === 3 ? x + ((a + up) >> 1) : x + paeth(a, up, ul)) & 255
    }
    for (let x = 0; x < w; x += 1) {
      const d = (y * w + x) * 4
      const s = x * c
      if (c === 1 || c === 2) {
        px[d] = px[d + 1] = px[d + 2] = atual[s]
        px[d + 3] = c === 2 ? atual[s + 1] : 255
      } else {
        px[d] = atual[s]
        px[d + 1] = atual[s + 1]
        px[d + 2] = atual[s + 2]
        px[d + 3] = c === 4 ? atual[s + 3] : 255
      }
    }
    antes.set(atual)
  }
  return { w, h, px }
}

function crc32(bytes: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < bytes.length; i += 1) {
    c ^= bytes[i]
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function pedaco(nome: string, corpo: Buffer): Buffer {
  const cab = Buffer.alloc(8)
  cab.writeUInt32BE(corpo.length, 0)
  cab.write(nome, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(nome, 'ascii'), corpo])), 0)
  return Buffer.concat([cab, corpo, crc])
}

/** Grava RGBA (ou RGB, com `semAlfa`), filtro 0. */
export function gravarPng(caminho: string, img: Imagem, semAlfa = false): void {
  const c = semAlfa ? 3 : 4
  const cru = Buffer.alloc(img.h * (img.w * c + 1))
  for (let y = 0; y < img.h; y += 1) {
    const o = y * (img.w * c + 1)
    for (let x = 0; x < img.w; x += 1) {
      const s = (y * img.w + x) * 4
      for (let k = 0; k < c; k += 1) cru[o + 1 + x * c + k] = img.px[s + k]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(img.w, 0)
  ihdr.writeUInt32BE(img.h, 4)
  ihdr[8] = 8
  ihdr[9] = semAlfa ? 2 : 6
  writeFileSync(caminho, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pedaco('IHDR', ihdr), pedaco('IDAT', deflateSync(cru, { level: 6 })), pedaco('IEND', Buffer.alloc(0))]))
}
