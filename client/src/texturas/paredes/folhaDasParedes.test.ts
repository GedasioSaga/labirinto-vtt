import { it, vi } from 'vitest'
import { montarParedes, type MalhaEmPecas, type TrechoDeEntrada, type TriangulosDaParede } from '../../pixi/paredeEmPecas'
import type { MaterialDaParede } from '../../types/map'
import { colar, emPng, escrever, novaTela, type Tela } from '../meioTermo/moveis/folhaDeContato.testkit'
import { ehMaterialDaParede, FORMATO_DA_IMAGEM } from './catalogo'

/**
 * FOLHA DAS PAREDES MONTADAS (correção da auditoria de 14/11/2026: "nenhuma folha mostra a parede montada no app").
 * Não é teste: é como o desenhista e o integrador veem a parede com textura do jeito que o app a monta, sem
 * navegador. A montagem é a do app (`montarParedes` de `pixi/paredeEmPecas.ts`, a mesma malha que o Pixi desenha) e
 * a imagem é a folha de peças do material (`imagens/<id>.png`); daqui só sai o pintor de triângulos em software (a
 * textura com o x e o y repetindo e a mistura pelo alfa, como a malha do Pixi), todas as malhas de baixo antes das
 * de cima.
 *
 * A CENA de cada material, a 64 px por casa (1 texel = 1 px): um canto em L e um T de parede média, um braço fino no
 * T e uma parede grossa solta (as duas tampas da ponta), sobre um chão liso com a grade das casas. Ao lado, a MESMA
 * cena a 32 px por casa (a MESA). Cada linha da folha é um par: o material e o parente dele que já estava no app.
 *
 * Rodar, de `client/`:
 * `FOLHA_DE_PAREDES=../tmp/.../pedido.json rtk proxy npx vitest run src/texturas/paredes/folhaDasParedes.test.ts`
 * O pedido: `{ "saida": "folha.png", "pares": [["troncos", "bambu"], ["madeira-gasta", "madeira"]] }` (`saida`
 * a partir da pasta do pedido). As medidas (o tempo de cada cena) saem em `<saida>.txt`.
 */

const PEDIDO: unknown = import.meta.env.FOLHA_DE_PAREDES
const PEDIDA = typeof PEDIDO === 'string' && PEDIDO !== ''
const TETO_DA_FOLHA_MS = 5 * 60_000

/** A casa da cena e a da mesa, em px. */
const CASA = FORMATO_DA_IMAGEM.casa
const REDUZ_NA_MESA = 2
/** A cena em casas e as meias espessuras do app (`ESPESSURA_DO_MATERIAL_PX` de `lib/faixasDaParede.ts`, a 64 px). */
const CENA = { largura: 7, altura: 5 }
const MEIA = { fina: 6, media: 10, grossa: 16 }
/** O chão da cena: um cinza-pardo neutro de lajota, e a linha da grade um nada mais escura. */
const CHAO: readonly [number, number, number] = [132, 127, 116]
const GRADE: readonly [number, number, number] = [120, 115, 105]
/** A folha. */
const FUNDO: readonly [number, number, number] = [40, 38, 34]
const LETRA: readonly [number, number, number] = [220, 214, 200]
const MARGEM = 20
const ESCALA_DA_LETRA = 2
const LINHA_DO_NOME = 26

/** As paredes da cena, em casas: o L e o T de parede média, o braço fino e a grossa solta. */
function paredesDaCena(material: MaterialDaParede): TrechoDeEntrada[] {
  const p = (id: string, x1: number, y1: number, x2: number, y2: number, h: number): TrechoDeEntrada => ({
    id,
    x1: x1 * CASA,
    y1: y1 * CASA,
    x2: x2 * CASA,
    y2: y2 * CASA,
    h,
    alpha: 1,
    material,
    desenha: true,
  })
  return [
    p('topo', 0.6, 0.6, 6.4, 0.6, MEIA.media),
    p('esquerda', 0.6, 0.6, 0.6, 4.4, MEIA.media),
    p('braco', 3.6, 0.6, 3.6, 2.6, MEIA.fina),
    p('solta', 1.8, 3.7, 6.2, 3.7, MEIA.grossa),
  ]
}

// ---------- a imagem da folha de peças ----------

interface Imagem {
  readonly largura: number
  readonly altura: number
  /** RGBA, 4 bytes por pixel. */
  readonly px: Uint8Array
}

/** O PNG RGBA de 8 bits sem entrelaçar que o estúdio grava (o que o app usa). Outro formato é erro. */
function lerPng(dados: Uint8Array, inflar: (d: Uint8Array) => Uint8Array): Imagem {
  const vista = new DataView(dados.buffer, dados.byteOffset, dados.byteLength)
  let largura = 0
  let altura = 0
  const partes: Uint8Array[] = []
  for (let i = 8; i < dados.length; ) {
    const tamanho = vista.getUint32(i)
    const tipo = String.fromCharCode(dados[i + 4], dados[i + 5], dados[i + 6], dados[i + 7])
    const corpo = dados.subarray(i + 8, i + 8 + tamanho)
    if (tipo === 'IHDR') {
      largura = vista.getUint32(i + 8)
      altura = vista.getUint32(i + 12)
      if (corpo[8] !== 8 || corpo[9] !== 6 || corpo[12] !== 0) throw new Error('a folha da parede não é PNG RGBA de 8 bits sem entrelaçar')
    } else if (tipo === 'IDAT') partes.push(corpo)
    i += 12 + tamanho
  }
  const total = partes.reduce((n, p) => n + p.length, 0)
  const junto = new Uint8Array(total)
  let onde = 0
  for (const p of partes) {
    junto.set(p, onde)
    onde += p.length
  }
  const cru = inflar(junto)
  const bpp = 4
  const linha = largura * bpp
  const px = new Uint8Array(largura * altura * bpp)
  for (let y = 0; y < altura; y += 1) {
    const filtro = cru[y * (linha + 1)]
    const de = y * (linha + 1) + 1
    for (let x = 0; x < linha; x += 1) {
      const a = x >= bpp ? px[y * linha + x - bpp] : 0
      const b = y > 0 ? px[(y - 1) * linha + x] : 0
      const c = x >= bpp && y > 0 ? px[(y - 1) * linha + x - bpp] : 0
      const bruto = cru[de + x]
      let previsto = 0
      if (filtro === 1) previsto = a
      else if (filtro === 2) previsto = b
      else if (filtro === 3) previsto = (a + b) >> 1
      else if (filtro === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        previsto = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[y * linha + x] = (bruto + previsto) & 0xff
    }
  }
  return { largura, altura, px }
}

// ---------- o pintor de triângulos ----------

/** A cor da folha de peças em (u, v), de 0 a 1, com o x e o y repetindo e a mistura entre os 4 texels (linear). */
function amostrar(img: Imagem, u: number, v: number, saida: Float64Array): void {
  const x = u * img.largura - 0.5
  const y = v * img.altura - 0.5
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  saida.fill(0)
  for (let j = 0; j < 2; j += 1) {
    for (let i = 0; i < 2; i += 1) {
      const peso = (i === 0 ? 1 - fx : fx) * (j === 0 ? 1 - fy : fy)
      if (peso === 0) continue
      const xx = (((x0 + i) % img.largura) + img.largura) % img.largura
      const yy = (((y0 + j) % img.altura) + img.altura) % img.altura
      const k = (yy * img.largura + xx) * 4
      // Pré-multiplicada, como a placa mistura.
      const alfa = img.px[k + 3] / 255
      saida[0] += peso * img.px[k] * alfa
      saida[1] += peso * img.px[k + 1] * alfa
      saida[2] += peso * img.px[k + 2] * alfa
      saida[3] += peso * alfa
    }
  }
}

/** Pinta a malha na tela RGB (px do mundo vezes `escala`), cada triângulo por cima do anterior, misturando pelo alfa. */
function pintarMalha(tela: Tela, t: TriangulosDaParede, img: Imagem, alfaDaMalha: number, escala: number): void {
  const cor = new Float64Array(4)
  const { posicoes: p, uvs, indices } = t
  for (let n = 0; n < indices.length; n += 3) {
    const a = indices[n]
    const b = indices[n + 1]
    const c = indices[n + 2]
    const ax = p[2 * a] * escala
    const ay = p[2 * a + 1] * escala
    const bx = p[2 * b] * escala
    const by = p[2 * b + 1] * escala
    const cx = p[2 * c] * escala
    const cy = p[2 * c + 1] * escala
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    if (Math.abs(area) < 1e-9) continue
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)))
    const maxX = Math.min(tela.largura - 1, Math.ceil(Math.max(ax, bx, cx)))
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)))
    const maxY = Math.min(tela.altura - 1, Math.ceil(Math.max(ay, by, cy)))
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5
        const py = y + 0.5
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area
        const w2 = 1 - w0 - w1
        if (w0 < 0 || w1 < 0 || w2 < 0) continue
        const u = w0 * uvs[2 * a] + w1 * uvs[2 * b] + w2 * uvs[2 * c]
        const v = w0 * uvs[2 * a + 1] + w1 * uvs[2 * b + 1] + w2 * uvs[2 * c + 1]
        amostrar(img, u, v, cor)
        const alfa = cor[3] * alfaDaMalha
        if (alfa <= 0) continue
        const k = (y * tela.largura + x) * 3
        for (let canal = 0; canal < 3; canal += 1) tela.rgb[k + canal] = Math.round(cor[canal] * alfaDaMalha + tela.rgb[k + canal] * (1 - alfa))
      }
    }
  }
}

/** A cena do material a 64 px por casa: o chão com a grade e as paredes como o app as monta. */
function cena(material: MaterialDaParede, img: Imagem): Tela {
  const tela = novaTela(CENA.largura * CASA, CENA.altura * CASA, CHAO)
  for (let y = 0; y < tela.altura; y += 1) {
    for (let x = 0; x < tela.largura; x += 1) {
      if (x % CASA !== 0 && y % CASA !== 0) continue
      tela.rgb.set(GRADE, (y * tela.largura + x) * 3)
    }
  }
  const malhas: MalhaEmPecas[] = montarParedes(paredesDaCena(material), CASA)
  for (const m of malhas) pintarMalha(tela, m.baixo, img, m.alpha, 1)
  for (const m of malhas) pintarMalha(tela, m.cima, img, m.alpha, 1)
  return tela
}

/** A tela reduzida pela média de cada bloco `fator` x `fator` (como a placa com mipmap, na mesa). */
function reduzir(tela: Tela, fator: number): Tela {
  const largura = Math.floor(tela.largura / fator)
  const altura = Math.floor(tela.altura / fator)
  const menor = novaTela(largura, altura, FUNDO)
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      for (let canal = 0; canal < 3; canal += 1) {
        let soma = 0
        for (let j = 0; j < fator; j += 1) for (let i = 0; i < fator; i += 1) soma += tela.rgb[((y * fator + j) * tela.largura + x * fator + i) * 3 + canal]
        menor.rgb[(y * largura + x) * 3 + canal] = Math.round(soma / (fator * fator))
      }
    }
  }
  return menor
}

/** A tela RGB como RGBA opaco, para `colar`. */
function rgba(tela: Tela): Uint8ClampedArray {
  const px = new Uint8ClampedArray(tela.largura * tela.altura * 4)
  for (let i = 0, j = 0; i < tela.rgb.length; i += 3, j += 4) {
    px[j] = tela.rgb[i]
    px[j + 1] = tela.rgb[i + 1]
    px[j + 2] = tela.rgb[i + 2]
    px[j + 3] = 255
  }
  return px
}

async function nodeDaFolha() {
  const fs = await vi.importActual<{
    readFileSync(caminho: string, codificacao: 'utf8'): string
    readFileSync(caminho: string): Uint8Array
    writeFileSync(caminho: string, dados: Uint8Array): void
    mkdirSync(caminho: string, opcoes: { recursive: true }): string | undefined
  }>('node:fs')
  const path = await vi.importActual<{ dirname(caminho: string): string; resolve(...partes: string[]): string }>('node:path')
  const zlib = await vi.importActual<{ inflateSync(dados: Uint8Array): Uint8Array }>('node:zlib')
  return { fs, path, zlib }
}

/** O pedido lido e conferido: os pares de ids de material do catálogo. */
function lerPedido(texto: string): { saida: string; pares: [MaterialDaParede, MaterialDaParede][] } {
  const cru: unknown = JSON.parse(texto)
  if (typeof cru !== 'object' || cru === null || !('saida' in cru) || typeof cru.saida !== 'string' || !('pares' in cru) || !Array.isArray(cru.pares)) {
    throw new Error('pedido: { "saida": "folha.png", "pares": [["troncos", "bambu"]] }')
  }
  const pares: [MaterialDaParede, MaterialDaParede][] = []
  for (const par of cru.pares as unknown[]) {
    if (!Array.isArray(par) || par.length !== 2 || !ehMaterialDaParede(par[0]) || !ehMaterialDaParede(par[1])) throw new Error(`pedido: par torto ${JSON.stringify(par)}`)
    pares.push([par[0], par[1]])
  }
  return { saida: cru.saida, pares }
}

it.skipIf(!PEDIDA)('gera a folha das paredes montadas do pedido', { timeout: TETO_DA_FOLHA_MS }, async () => {
  if (typeof PEDIDO !== 'string') return
  const node = await nodeDaFolha()
  const caminhoDoPedido = node.path.resolve(PEDIDO)
  const pedido = lerPedido(node.fs.readFileSync(caminhoDoPedido, 'utf8'))
  const saida = node.path.resolve(node.path.dirname(caminhoDoPedido), pedido.saida)
  const larguraDaCena = CENA.largura * CASA
  const alturaDaCena = CENA.altura * CASA
  const larguraDoItem = larguraDaCena + MARGEM + larguraDaCena / REDUZ_NA_MESA
  const alturaDoItem = LINHA_DO_NOME + alturaDaCena
  const tela = novaTela(MARGEM + 2 * (larguraDoItem + MARGEM), MARGEM + pedido.pares.length * (alturaDoItem + MARGEM), FUNDO)
  const relato: string[] = []
  pedido.pares.forEach((par, linha) => {
    par.forEach((material, coluna) => {
      const inicio = performance.now()
      const img = lerPng(node.fs.readFileSync(node.path.resolve('src/texturas/paredes/imagens', `${material}.png`)), node.zlib.inflateSync)
      const perto = cena(material, img)
      const mesa = reduzir(perto, REDUZ_NA_MESA)
      const ms = performance.now() - inicio
      const x = MARGEM + coluna * (larguraDoItem + MARGEM)
      const y = MARGEM + linha * (alturaDoItem + MARGEM)
      escrever(tela, `${material.toUpperCase()}${coluna === 1 ? ' (PARENTE)' : ''}  PERTO 64 PX POR CASA / MESA 32`, x, y, ESCALA_DA_LETRA, LETRA)
      colar(tela, rgba(perto), perto.largura, perto.altura, x, y + LINHA_DO_NOME)
      colar(tela, rgba(mesa), mesa.largura, mesa.altura, x + larguraDaCena + MARGEM, y + LINHA_DO_NOME)
      relato.push(`${material}: cena de ${CENA.largura} x ${CENA.altura} casas pintada em ${Math.round(ms)} ms (perto e mesa)`)
    })
  })
  node.fs.mkdirSync(node.path.dirname(saida), { recursive: true })
  node.fs.writeFileSync(saida, emPng(tela))
  relato.push(`folha: ${saida} (${tela.largura} x ${tela.altura} px)`)
  node.fs.writeFileSync(saida.replace(/\.png$/i, '.txt'), new TextEncoder().encode(`${relato.join('\n')}\n`))
})
