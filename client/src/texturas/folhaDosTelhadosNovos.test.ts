import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { PontoDoTelhado } from '../lib/telhado/aguas'
import { AMBIENTE_PADRAO } from '../lib/periodo'
import { MODELOS_DO_TETO, NOME_DO_MODELO, PALETA_DO_TETO, type ModeloDoTeto } from '../lib/telhado/paletas'
import { pintarTelhado, type ImagemDoTelhado } from './telhado'
import { colar, emPng, escrever, novaTela, type Tela } from './meioTermo/moveis/folhaDeContato.testkit'
import { medirCorDoTelhado } from './telhadoPalha.testkit'

// O projeto não tem `@types/node`: `meioTermo/moveis/node-minimo.d.ts` declara só o que as folhas usam.
// Esta folha cria a pasta dela em `tmp/` (que não vai para o git).
declare module 'node:fs' {
  export function mkdirSync(caminho: string, opcoes: { recursive: true }): void
}

/**
 * FOLHAS DOS TELHADOS DE 12/11/2026 (ardósia, metal, tabuinhas), para o mestre
 * aprovar ANTES de sair numa versão. Duas:
 *
 * - `folha.png`: os SEIS modelos (os três de antes como referência), uma linha
 *   por modelo, cada um nas 6 cores da paleta, numa casa média (4 x 3 casas) e
 *   numa pequena (2 x 2), a 1x (o que o app pinta), com o nome embaixo e o
 *   tempo de pintar a casa média (uma medida, nesta máquina).
 * - `folha-noite.png`: uma vilinha de 8 casas misturando os seis, duas delas
 *   giradas 45 graus, de dia e com a tinta do período Noite
 *   (`AMBIENTE_PADRAO.noite`, a mesma conta de `pixi/mapaDeLuz.ts`:
 *   `corDaTinta`, em multiply), em 1x e reduzida à metade (o zoom longe).
 *
 * A sombra no chão é a do renderer (`telhadosRenderer.ts`: 6 x 8 px, 25%).
 * Só roda quando pedida (prova para o usuário, não teste de regressão):
 * `GERAR_FOLHA_TELHADOS=1 npx vitest run src/texturas/folhaDosTelhadosNovos.test.ts`.
 */

const PASTA = '../tmp/telhados-2026-11-12'
const PEDIDA = import.meta.env.GERAR_FOLHA_TELHADOS === '1'
const GRAMA: readonly [number, number, number] = [0x56, 0x69, 0x3f]
const RUA: readonly [number, number, number] = [0x5d, 0x5a, 0x54]
const TINTA: readonly [number, number, number] = [0xf2, 0xea, 0xd8]
const FUNDO_DA_FOLHA: readonly [number, number, number] = [0x2a, 0x2b, 0x27]
const CASA = 40
const MARGEM = 24
const VAO = 14
const LETRA = 2
const ALTURA_DA_LETRA = 7 * LETRA + 6
const SOMBRA_X = 6
const SOMBRA_Y = 8
const ALFA_DA_SOMBRA = 0.25
const COR_DA_SOMBRA: readonly [number, number, number] = [0x0a, 0x0c, 0x06]

const sala = (x: number, y: number, w: number, h: number): readonly PontoDoTelhado[] => [
  { x, y },
  { x: x + w * CASA, y },
  { x: x + w * CASA, y: y + h * CASA },
  { x, y: y + h * CASA },
]

/** Retângulo de `w` x `h` casas girado 45 graus em volta do centro (cx, cy). */
function salaGirada(cx: number, cy: number, w: number, h: number): readonly PontoDoTelhado[] {
  const c = Math.SQRT1_2
  const hw = (w * CASA) / 2
  const hh = (h * CASA) / 2
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => ({ x: cx + x * c - y * c, y: cy + x * c + y * c }))
}

/** Rótulo na fonte da folha: maiúsculas, sem acento, hífen vira espaço. */
function rotulo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/-/g, ' ')
    .toUpperCase()
}

function retangulo(tela: Tela, x: number, y: number, w: number, h: number, cor: readonly number[]): void {
  for (let j = Math.max(0, y); j < Math.min(tela.altura, y + h); j += 1) {
    for (let i = Math.max(0, x); i < Math.min(tela.largura, x + w); i += 1) {
      const o = (j * tela.largura + i) * 3
      tela.rgb[o] = cor[0]
      tela.rgb[o + 1] = cor[1]
      tela.rgb[o + 2] = cor[2]
    }
  }
}

/** A sombra do telhado no chão: a silhueta (alfa da imagem) escura, deslocada. */
function sombra(tela: Tela, img: ImagemDoTelhado, x: number, y: number): void {
  for (let j = 0; j < img.altura; j += 1) {
    for (let i = 0; i < img.largura; i += 1) {
      const a = (img.pixels[(j * img.largura + i) * 4 + 3] / 255) * ALFA_DA_SOMBRA
      if (a <= 0) continue
      const tx = x + i + SOMBRA_X
      const ty = y + j + SOMBRA_Y
      if (tx < 0 || ty < 0 || tx >= tela.largura || ty >= tela.altura) continue
      const d = (ty * tela.largura + tx) * 3
      for (let c = 0; c < 3; c += 1) tela.rgb[d + c] = Math.round(COR_DA_SOMBRA[c] * a + tela.rgb[d + c] * (1 - a))
    }
  }
}

/** A cor da tinta do período (branco misturado à cor na força dela), como `corDaTinta`. */
function tintaDaNoite(): [number, number, number] {
  const { cor, forca } = AMBIENTE_PADRAO.noite
  return [1, 3, 5].map((k) => Math.round(255 + (Number.parseInt(cor.slice(k, k + 2), 16) - 255) * forca)) as [number, number, number]
}

/** Copia a tela, em multiply pela tinta (o que `mapaDeLuz.ts` faz com o mapa). */
function emMultiply(tela: Tela, tinta: readonly number[]): Tela {
  const rgb = new Uint8Array(tela.rgb.length)
  for (let i = 0; i < rgb.length; i += 3) for (let c = 0; c < 3; c += 1) rgb[i + c] = Math.round((tela.rgb[i + c] * tinta[c]) / 255)
  return { largura: tela.largura, altura: tela.altura, rgb }
}

/** Reduz à metade (média de 2 x 2), como o mipmap no zoom longe. */
function metade(tela: Tela): Tela {
  const largura = Math.floor(tela.largura / 2)
  const altura = Math.floor(tela.altura / 2)
  const rgb = new Uint8Array(largura * altura * 3)
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        const s = (yy: number, xx: number) => tela.rgb[(yy * tela.largura + xx) * 3 + c]
        rgb[(y * largura + x) * 3 + c] = Math.round((s(2 * y, 2 * x) + s(2 * y, 2 * x + 1) + s(2 * y + 1, 2 * x) + s(2 * y + 1, 2 * x + 1)) / 4)
      }
    }
  }
  return { largura, altura, rgb }
}

/** Cola a tela `de` dentro de `em`, com o canto em (x, y). */
function colarTela(em: Tela, de: Tela, x: number, y: number): void {
  for (let j = 0; j < de.altura; j += 1) {
    const o = ((y + j) * em.largura + x) * 3
    em.rgb.set(de.rgb.subarray(j * de.largura * 3, (j + 1) * de.largura * 3), o)
  }
}

const emMs = (ms: number): string => ms.toFixed(1).replace('.', ',')

/** Recorte (x, y, w, h em pixels da imagem) ampliado `z` vezes com filtro linear, como a câmera no zoom. */
function recorteAmpliado(img: ImagemDoTelhado, x0: number, y0: number, w: number, h: number, z: number): { pixels: Uint8ClampedArray; largura: number; altura: number } {
  const largura = w * z
  const altura = h * z
  const pixels = new Uint8ClampedArray(largura * altura * 4)
  const canal = (x: number, y: number, c: number): number => {
    const xx = Math.min(img.largura - 1, Math.max(0, x0 + x))
    const yy = Math.min(img.altura - 1, Math.max(0, y0 + y))
    return img.pixels[(yy * img.largura + xx) * 4 + c]
  }
  for (let y = 0; y < altura; y += 1) {
    const sy = (y + 0.5) / z - 0.5
    const iy = Math.floor(sy)
    const fy = sy - iy
    for (let x = 0; x < largura; x += 1) {
      const sx = (x + 0.5) / z - 0.5
      const ix = Math.floor(sx)
      const fx = sx - ix
      for (let c = 0; c < 4; c += 1) {
        const cima = canal(ix, iy, c) * (1 - fx) + canal(ix + 1, iy, c) * fx
        const baixo = canal(ix, iy + 1, c) * (1 - fx) + canal(ix + 1, iy + 1, c) * fx
        pixels[(y * largura + x) * 4 + c] = cima * (1 - fy) + baixo * fy
      }
    }
  }
  return { pixels, largura, altura }
}

const MEDIA = sala(0, 0, 4, 3)
const PEQUENA = sala(0, 0, 2, 2)

it.skipIf(!PEDIDA)('gera a folha dos seis modelos nas 6 cores (casa média e pequena) e a vilinha de dia e de noite', () => {
  mkdirSync(PASTA, { recursive: true })
  // ---------- folha.png ----------
  const medidas: string[] = []
  const linhas = MODELOS_DO_TETO.map((modelo) =>
    PALETA_DO_TETO[modelo].map((cor) => {
      const t0 = performance.now()
      const media = pintarTelhado(MEDIA, modelo, cor.hex, 1)
      const ms = performance.now() - t0
      const pequena = pintarTelhado(PEQUENA, modelo, cor.hex, 1)
      const m = medirCorDoTelhado(media)
      medidas.push(`${modelo}/${cor.id}: croma p95 ${m.cromaP95.toFixed(3)} médio ${m.cromaMedio.toFixed(3)} sat p95 ${m.saturacaoP95.toFixed(3)} ${emMs(ms)} ms`)
      return { media, pequena, nome: rotulo(cor.nome), tempo: `${emMs(ms)} MS` }
    }),
  )
  console.log(`[medida] telhados 12/11:\n${medidas.join('\n')}`)
  writeFileSync(`${PASTA}/medidas.txt`, new TextEncoder().encode(`${medidas.join('\n')}\n`))
  const celula = Math.max(...linhas.flat().map((c) => c.media.largura + VAO + c.pequena.largura))
  const alturaDaLinha = ALTURA_DA_LETRA + Math.max(...linhas.flat().map((c) => c.media.altura)) + ALTURA_DA_LETRA * 2 + VAO
  const largura = MARGEM * 2 + 6 * (celula + VAO * 2)
  // Embaixo, cada modelo na cor padrão no ZOOM de 300% (um canto da casa média com beiral, espigão e cumeeira).
  const zooms = linhas.map((cores) => recorteAmpliado(cores[0].media, 4, 4, 90, 66, 3))
  const alturaDosZooms = ALTURA_DA_LETRA * 2 + Math.max(...zooms.map((z) => z.altura)) + VAO
  const tela = novaTela(largura, MARGEM * 2 + linhas.length * alturaDaLinha + alturaDosZooms, FUNDO_DA_FOLHA)
  const yZoom = MARGEM + linhas.length * alturaDaLinha
  escrever(tela, 'ZOOM 300 NA COR PADRAO', MARGEM, yZoom, LETRA, TINTA)
  zooms.forEach((z, i) => {
    const x = MARGEM + i * (z.largura + VAO * 2)
    escrever(tela, rotulo(NOME_DO_MODELO[MODELOS_DO_TETO[i]]), x, yZoom + ALTURA_DA_LETRA, LETRA, TINTA)
    retangulo(tela, x, yZoom + ALTURA_DA_LETRA * 2, z.largura, z.altura, GRAMA)
    colar(tela, z.pixels, z.largura, z.altura, x, yZoom + ALTURA_DA_LETRA * 2)
  })
  linhas.forEach((cores, i) => {
    const modelo = MODELOS_DO_TETO[i]
    const y = MARGEM + i * alturaDaLinha
    escrever(tela, rotulo(NOME_DO_MODELO[modelo]) + (i >= 3 ? ' NOVO' : ''), MARGEM, y, LETRA, TINTA)
    cores.forEach((c, k) => {
      const x = MARGEM + k * (celula + VAO * 2)
      const yImg = y + ALTURA_DA_LETRA
      retangulo(tela, x - 6, yImg - 4, celula + 12, c.media.altura + 8 + SOMBRA_Y, GRAMA)
      sombra(tela, c.media, x, yImg)
      colar(tela, c.media.pixels, c.media.largura, c.media.altura, x, yImg)
      sombra(tela, c.pequena, x + c.media.largura + VAO, yImg)
      colar(tela, c.pequena.pixels, c.pequena.largura, c.pequena.altura, x + c.media.largura + VAO, yImg)
      escrever(tela, c.nome, x, yImg + c.media.altura + 14, LETRA, TINTA)
      escrever(tela, c.tempo, x, yImg + c.media.altura + 14 + ALTURA_DA_LETRA, LETRA, TINTA)
    })
  })
  writeFileSync(`${PASTA}/folha.png`, emPng(tela))

  // ---------- folha-noite.png ----------
  const casas: readonly { poligono: readonly PontoDoTelhado[]; modelo: ModeloDoTeto; cor: number }[] = [
    { poligono: sala(30, 30, 5, 3), modelo: 'tabuinhas', cor: 0 },
    { poligono: sala(270, 30, 3, 3), modelo: 'ardosia', cor: 0 },
    { poligono: sala(430, 40, 4, 2), modelo: 'telhas', cor: 0 },
    { poligono: salaGirada(130, 250, 4, 2), modelo: 'metal', cor: 2 },
    { poligono: sala(260, 200, 3, 4), modelo: 'madeira', cor: 0 },
    { poligono: salaGirada(505, 275, 4, 3), modelo: 'palha', cor: 4 },
    { poligono: sala(30, 360, 3, 2), modelo: 'ardosia', cor: 4 },
    { poligono: sala(420, 400, 4, 2), modelo: 'metal', cor: 3 },
    { poligono: sala(200, 400, 4, 2), modelo: 'tabuinhas', cor: 3 },
  ]
  const LADO_X = 620
  const LADO_Y = 520
  const vila = novaTela(LADO_X, LADO_Y, GRAMA)
  // Uma rua de pedra cruzando a vila.
  retangulo(vila, 0, 158, LADO_X, 30, RUA)
  const roofs = casas.map((c) => ({ img: pintarTelhado(c.poligono, c.modelo, PALETA_DO_TETO[c.modelo][c.cor].hex, 1), modelo: c.modelo }))
  for (const r of roofs) sombra(vila, r.img, r.img.origemX, r.img.origemY)
  for (const r of roofs) colar(vila, r.img.pixels, r.img.largura, r.img.altura, r.img.origemX, r.img.origemY)
  const noite = emMultiply(vila, tintaDaNoite())
  const vilaMeia = metade(vila)
  const noiteMeia = metade(noite)
  const topo = ALTURA_DA_LETRA + 6
  const folhaDaNoite = novaTela(MARGEM * 3 + LADO_X * 2, MARGEM * 3 + topo * 2 + LADO_Y + vilaMeia.altura, FUNDO_DA_FOLHA)
  escrever(folhaDaNoite, 'DIA 1X', MARGEM, MARGEM, LETRA, TINTA)
  escrever(folhaDaNoite, 'NOITE 1X', MARGEM * 2 + LADO_X, MARGEM, LETRA, TINTA)
  colarTela(folhaDaNoite, vila, MARGEM, MARGEM + topo)
  colarTela(folhaDaNoite, noite, MARGEM * 2 + LADO_X, MARGEM + topo)
  const yMeia = MARGEM * 2 + topo + LADO_Y
  escrever(folhaDaNoite, 'DIA 0,5X', MARGEM, yMeia, LETRA, TINTA)
  escrever(folhaDaNoite, 'NOITE 0,5X', MARGEM * 2 + LADO_X, yMeia, LETRA, TINTA)
  colarTela(folhaDaNoite, vilaMeia, MARGEM, yMeia + topo)
  colarTela(folhaDaNoite, noiteMeia, MARGEM * 2 + LADO_X, yMeia + topo)
  // Legenda: o modelo de cada casa, em ordem de leitura.
  const legenda = casas.map((c, i) => `${i + 1} ${rotulo(NOME_DO_MODELO[c.modelo])}`).join('  ')
  console.log(`[medida] vila: ${legenda}`)
  writeFileSync(`${PASTA}/folha-noite.png`, emPng(folhaDaNoite))
  expect(roofs.every((r) => r.img.largura > 0)).toBe(true)
})
