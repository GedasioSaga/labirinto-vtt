/**
 * O ATUAL para a mesa de prova: pinta, fora do app e fora do Godot, a textura
 * de hoje do app (o chão do Meio-Termo, SEM manchas, como o mapa do usuário)
 * numa área de N x N casas, com o mesmo código que o app usa
 * (catálogo -> ladrilho -> pintarPedaco). Opcionalmente lê um mapa real (só
 * leitura) e escolhe a janela de N x N casas em que a textura mais aparece,
 * gravando a máscara dessas casas.
 *
 * Não é teste e não entra no app: o exportador do Godot chama isto quando a
 * folha é pedida (scripts/exportar_uma.gd). Construção: esbuild empacota este
 * arquivo com o código de client/src num .mjs em ferramentas/.build/.
 *
 * Uso: node ferramentas/.build/atual.mjs --id=grama --saida=<pasta> [--casas=40] [--mapa=<map.json>]
 * Grava em <saida>: atual-100.png (N*64 px de lado), janela.json e, com --mapa, mascara.png (N x N).
 * NUNCA aponte --saida para dentro do repositório quando usar --mapa: o repo é público.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { texturaDoCatalogo } from '../../../client/src/texturas/catalogo'
import { LADO_DO_LADRILHO, pixelsDoLadrilho } from '../../../client/src/texturas/ladrilhos'
import {
  LADO_DO_PEDACO,
  pintarPedaco,
  sementeDoChao,
  torcaoDaTextura,
  type ChaoDaTextura,
} from '../../../client/src/texturas/meioTermo/chaoNoMundo'
import { dentroDoPoligono, formaDoBalde } from '../../../client/src/lib/baldeDeTextura'
import type { Drawing, PinceladaDeTextura, Region, RegionPoint } from '../../../client/src/types/map'

const GRID = 64
/** Lado do mapa do protótipo do relevo (client/src/lib/relevo.ts, LADO_DO_PROTOTIPO). */
const LADO_DO_PROTOTIPO = 1242
/** client/src/pixi/drawTexturas.ts, ESCALA_DA_IMPORTADA. */
const ESCALA_PADRAO = 40

function argumentos(): Map<string, string> {
  const m = new Map<string, string>()
  for (const a of process.argv.slice(2)) {
    const i = a.indexOf('=')
    if (a.startsWith('--')) m.set(i < 0 ? a.slice(2) : a.slice(2, i), i < 0 ? '1' : a.slice(i + 1))
  }
  return m
}

/** client/src/pixi/drawTexturas.ts, escalaDaTextura + ladoDoLadrilhoNoMundo, copiados (lá puxa o Pixi). */
function ladoNoMundo(id: string, mapa: { width: number; height: number; grid: number }): number {
  const t = texturaDoCatalogo(id)
  if (t !== null && t.casas !== undefined) return t.casas * mapa.grid
  const escala = t?.escala ?? ESCALA_PADRAO
  const unidade = (Math.max(mapa.width, mapa.height) * mapa.grid) / LADO_DO_PROTOTIPO
  return Math.max(escala * unidade, 3 * mapa.grid)
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

/** PNG RGB de 8 bits, sem filtro por linha. `rgb` tem largura * altura * 3 bytes. */
function png(largura: number, altura: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const cru = Buffer.alloc((largura * 3 + 1) * altura)
  for (let y = 0; y < altura; y += 1) {
    cru[y * (largura * 3 + 1)] = 0
    Buffer.from(rgb.buffer, rgb.byteOffset + y * largura * 3, largura * 3).copy(cru, y * (largura * 3 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(cru, { level: 6 })),
    bloco('IEND', new Uint8Array(0)),
  ])
}

function distanciaAoCaminho(p: RegionPoint, pontos: readonly RegionPoint[]): number {
  if (pontos.length === 1) return Math.hypot(p.x - pontos[0].x, p.y - pontos[0].y)
  let menor = Infinity
  for (let k = 1; k < pontos.length; k += 1) {
    const a = pontos[k - 1]
    const b = pontos[k]
    const bx = b.x - a.x
    const by = b.y - a.y
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * bx + (p.y - a.y) * by) / Math.max(bx * bx + by * by, 1e-9)))
    menor = Math.min(menor, Math.hypot(p.x - a.x - bx * t, p.y - a.y - by * t))
  }
  return menor
}

interface MapaLido {
  width: number
  height: number
  grid: number
  texturas?: PinceladaDeTextura[]
  regions?: Region[]
  drawings?: Drawing[]
}

/**
 * A textura de cada casa (pelo centro), refazendo os passos em ordem: o de
 * depois cobre o de antes. APROXIMADA: pincel e borracha contam com força
 * >= 0,3 até o raio cheio; balde enche o contorno sem os recortes; sala apaga
 * a região. Basta para escolher a janela e desenhar a máscara da folha.
 */
function casasDoMapa(mapa: MapaLido): (string | null)[] {
  const casas: (string | null)[] = new Array(mapa.width * mapa.height).fill(null)
  const regioes = mapa.regions ?? []
  const desenhos = mapa.drawings ?? []
  for (const passo of mapa.texturas ?? []) {
    let dentro: ((p: RegionPoint) => boolean) | null = null
    let valor: string | null = null
    if (passo.tipo === 'pincel' || passo.tipo === 'borracha') {
      if (passo.forca < 0.3) continue
      const { pontos, raio } = passo
      dentro = (p) => distanciaAoCaminho(p, pontos) <= raio
      valor = passo.tipo === 'pincel' ? passo.textura : null
    } else if (passo.tipo === 'balde') {
      const forma = formaDoBalde(passo.alvo, regioes, desenhos)
      if (forma === null) continue
      dentro = (p) => dentroDoPoligono(p, forma.contorno)
      valor = passo.textura
    } else if (passo.tipo === 'sala') {
      const forma = formaDoBalde({ tipo: 'regiao', id: passo.regiao }, regioes, [])
      if (forma === null) continue
      dentro = (p) => dentroDoPoligono(p, forma.contorno)
      valor = null
    }
    if (dentro === null) continue
    for (let j = 0; j < mapa.height; j += 1) {
      for (let i = 0; i < mapa.width; i += 1) {
        if (dentro({ x: (i + 0.5) * mapa.grid, y: (j + 0.5) * mapa.grid })) casas[j * mapa.width + i] = valor
      }
    }
  }
  return casas
}

/** A janela N x N com mais casas da textura (soma por imagem integral). */
function melhorJanela(casas: (string | null)[], w: number, h: number, id: string, n: number): { x0: number; y0: number; soma: number } {
  const integral = new Float64Array((w + 1) * (h + 1))
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const v = casas[j * w + i] === id ? 1 : 0
      integral[(j + 1) * (w + 1) + i + 1] = v + integral[j * (w + 1) + i + 1] + integral[(j + 1) * (w + 1) + i] - integral[j * (w + 1) + i]
    }
  }
  let melhor = { x0: 0, y0: 0, soma: -1 }
  for (let y0 = 0; y0 + n <= h; y0 += 1) {
    for (let x0 = 0; x0 + n <= w; x0 += 1) {
      const s = integral[(y0 + n) * (w + 1) + x0 + n] - integral[y0 * (w + 1) + x0 + n] - integral[(y0 + n) * (w + 1) + x0] + integral[y0 * (w + 1) + x0]
      if (s > melhor.soma) melhor = { x0, y0, soma: s }
    }
  }
  return melhor
}

function principal(): void {
  const args = argumentos()
  const id = args.get('id')
  const saida = args.get('saida')
  if (id === undefined || saida === undefined) throw new Error('uso: --id=<id do app> --saida=<pasta> [--casas=40] [--mapa=<map.json>]')
  const n = Number(args.get('casas') ?? '40')
  const textura = texturaDoCatalogo(id)
  if (textura === null) throw new Error(`a textura ${id} não está no catálogo do app`)
  mkdirSync(saida, { recursive: true })

  let mapa: MapaLido = { width: 200, height: 200, grid: GRID }
  let janela = { x0: 0, y0: 0, soma: n * n }
  let mascara: Uint8Array | null = null
  const caminhoDoMapa = args.get('mapa')
  if (caminhoDoMapa !== undefined) {
    mapa = JSON.parse(readFileSync(caminhoDoMapa, 'utf8')) as MapaLido
    const casas = casasDoMapa(mapa)
    janela = melhorJanela(casas, mapa.width, mapa.height, id, n)
    mascara = new Uint8Array(n * n * 3)
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const v = casas[(janela.y0 + j) * mapa.width + janela.x0 + i] === id ? 255 : 0
        mascara.fill(v, (j * n + i) * 3, (j * n + i) * 3 + 3)
      }
    }
    writeFileSync(join(saida, 'mascara.png'), png(n, n, mascara))
  }

  // O chão do Meio-Termo sem manchas (o mapa do usuário não liga manchasDoChao), na
  // grade de 64 px por casa da mesa de prova, na posição real da janela no mundo.
  const lado = textura.lado ?? LADO_DO_LADRILHO
  const chao: ChaoDaTextura = {
    ladrilho: { lado, pixels: pixelsDoLadrilho(textura.cor, lado) },
    ladoNoMundo: ladoNoMundo(id, { width: mapa.width, height: mapa.height, grid: GRID }),
    semente: sementeDoChao(id),
    torcao: torcaoDaTextura(textura),
    manchas: false,
  }
  const px = n * GRID
  const x0 = janela.x0 * GRID
  const y0 = janela.y0 * GRID
  const rgb = new Uint8Array(px * px * 3)
  const i0 = Math.floor(x0 / LADO_DO_PEDACO)
  const j0 = Math.floor(y0 / LADO_DO_PEDACO)
  const i1 = Math.floor((x0 + px - 1) / LADO_DO_PEDACO)
  const j1 = Math.floor((y0 + px - 1) / LADO_DO_PEDACO)
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const pedaco = pintarPedaco(chao, { i, j, nivel: 0 })
      for (let y = 0; y < LADO_DO_PEDACO; y += 1) {
        const wy = j * LADO_DO_PEDACO + y - y0
        if (wy < 0 || wy >= px) continue
        for (let x = 0; x < LADO_DO_PEDACO; x += 1) {
          const wx = i * LADO_DO_PEDACO + x - x0
          if (wx < 0 || wx >= px) continue
          const o = (y * LADO_DO_PEDACO + x) * 4
          const d = (wy * px + wx) * 3
          rgb[d] = pedaco[o]
          rgb[d + 1] = pedaco[o + 1]
          rgb[d + 2] = pedaco[o + 2]
        }
      }
    }
  }
  writeFileSync(join(saida, 'atual-100.png'), png(px, px, rgb))
  writeFileSync(
    join(saida, 'janela.json'),
    JSON.stringify(
      {
        id,
        nome: textura.nome,
        casas: n,
        janela: { x0: janela.x0, y0: janela.y0 },
        coberturaNaJanela: caminhoDoMapa === undefined ? null : janela.soma / (n * n),
        ladrilhoPx: lado,
        ladrilhoNoMundoPx: chao.ladoNoMundo,
        mapa: { width: mapa.width, height: mapa.height, grid: GRID, real: caminhoDoMapa !== undefined },
        estilo: 'Meio-Termo sem manchas',
      },
      null,
      2,
    ),
  )
  console.log(`atual: ${id} (${textura.nome}) janela ${janela.x0},${janela.y0} ${n}x${n} casas -> ${saida}`)
}

principal()
