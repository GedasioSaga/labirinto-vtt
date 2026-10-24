// PROVAS DA MT10b (ajuste da MT10 do Meio-Termo): a folha de contato de ANTES
// e DEPOIS do ajuste (chaminé maior, amarras da cumeeira legíveis a 1x, grade
// de prisão reforçada). Só roda com GERAR_PROVAS_MT10B:
//   GERAR_PROVAS_MT10B=antes  MT10B_ANTES=<arquivo.json>  -> guarda os quadros do código de antes
//   GERAR_PROVAS_MT10B=depois MT10B_ANTES=<arquivo.json>  -> pinta os de depois e monta a folha
// O "antes" sai do código de antes do ajuste (rodado nele), e a folha põe os
// dois lado a lado em cada quadro. Os telhados são pintados pelo pintor de
// verdade no navegador (a 1x, a 3x e a 1x ampliada 3x, que é o que o app
// mostra no zoom de 300%); a grade é a do Pixi do editor, em 3 zooms.
// O jeito de abrir, centrar (cameraRequest) e fotografar é o da MT10
// (`task-meio-termo-chamine-grade.spec.ts`).
import { readFileSync, writeFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { createEmptyMap, setShowGrid } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { PALETA_DO_TETO } from '../src/lib/telhado/paletas'
import type { MapData, Wall } from '../src/types/map'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

const GRADE = 50
const OBRA = '?obra=meio-termo'
const PASTA_DO_MESTRE = 'C:/appdata/maps/map_mt10b'
const PROVAS = '../docs/design/objetos/provas'
const MODO = process.env.GERAR_PROVAS_MT10B ?? ''
const ARQUIVO_DO_ANTES = process.env.MT10B_ANTES ?? ''

type Png = Awaited<ReturnType<Page['screenshot']>>
type Caixa = { x0: number; y0: number; x1: number; y1: number }
/** Um quadro: a chave liga o antes ao depois. */
type Quadro = { chave: string; rotulo: string; png: string; tempo: string }

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** A cela da MT10: três paredes e a frente de janela com a grade. */
function mapaDoMestre(): MapData {
  const map = setShowGrid(createEmptyMap('mt10b-mestre', 'Cela', 24, 14, GRADE), false)
  const walls = [
    parede('cela-cima', 900, 100, 1100, 100),
    parede('cela-baixo', 900, 300, 1100, 300),
    parede('cela-fundo', 1100, 100, 1100, 300),
    parede('janela', 900, 100, 900, 300, { janela: true, grade: true }),
  ]
  return { ...map, regions: [], walls }
}

function discoDoMestre(): Record<string, string> {
  const aventura = { version: 1, id: 'adv_mt10b', name: 'Cela', startSceneId: 'scene_mt10b', scenes: [{ id: 'scene_mt10b', name: 'Cela', file: 'map.json' }] }
  return { [`${PASTA_DO_MESTRE}/map.json`]: serializeMap(mapaDoMestre()), [`${PASTA_DO_MESTRE}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

async function fotoDoMundo(page: Page, c: Caixa): Promise<Png> {
  const caixa = await page.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('canvas sem caixa')
  const camera = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)
  return page.screenshot({
    clip: { x: caixa.x + camera.x + c.x0 * camera.scale, y: caixa.y + camera.y + c.y0 * camera.scale, width: (c.x1 - c.x0) * camera.scale, height: (c.y1 - c.y0) * camera.scale },
    animations: 'disabled',
  })
}

async function fotoParada(page: Page, c: Caixa): Promise<Png> {
  let anterior: Png | null = null
  let atual: Png = await fotoDoMundo(page, c)
  for (let i = 0; i < 40; i += 1) {
    if (anterior !== null && anterior.equals(atual)) return atual
    anterior = atual
    await page.waitForTimeout(150)
    atual = await fotoDoMundo(page, c)
  }
  return atual
}

async function centrar(page: Page, c: Caixa, escala: number): Promise<void> {
  await page.evaluate(
    async ([cx, cy, s]) => {
      const aventura = await import('/src/stores/adventureStore.ts')
      const canvas = document.querySelector('canvas')
      const largura = canvas?.clientWidth ?? 800
      const altura = canvas?.clientHeight ?? 600
      aventura.useAdventureStore.setState({ cameraRequest: { camera: { x: largura / 2 - cx * s, y: altura / 2 - cy * s, scale: s } } })
    },
    [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, escala] as const,
  )
  await expect.poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera.scale)).toBeCloseTo(escala, 3)
}

/** Os quadros dos telhados, pintados pelo pintor de verdade no navegador. */
async function quadrosDosTelhados(page: Page): Promise<Quadro[]> {
  return page.evaluate(
    async ({ grade, barro, palha, preto, musgo }) => {
      const t = (await import('/src/texturas/telhado.ts')) as typeof import('../src/texturas/telhado') // cast seguro: o módulo do pintor servido pelo Vite
      const ch = (await import('/src/texturas/meioTermo/chamine.ts')) as typeof import('../src/texturas/meioTermo/chamine') // cast seguro: idem
      const GRAMA = '#56693f'
      // A casa de 4 x 3 casas de 50: a cumeeira vai de x = 75 a x = 125, em y = 75.
      const pontos = [{ x: 0, y: 0 }, { x: 4 * grade, y: 0 }, { x: 4 * grade, y: 3 * grade }, { x: 0, y: 3 * grade }]
      type Recorte = { x0: number; y0: number; x1: number; y1: number }
      const quadros: { chave: string; rotulo: string; png: string; tempo: string }[] = []
      /** A imagem do pintor, no recorte, ampliada `zoom` vezes (suave, como o Pixi; ou pixel a pixel). */
      const telaDe = (img: ReturnType<typeof t.pintarTelhado>, zoom: number, recorte: Recorte | null, pixelAPixel: boolean): HTMLCanvasElement => {
        const fonte = document.createElement('canvas')
        fonte.width = img.largura
        fonte.height = img.altura
        fonte.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(img.pixels), img.largura, img.altura), 0, 0)
        const r = recorte ?? { x0: img.origemX, y0: img.origemY, x1: img.origemX + img.largura / img.escala, y1: img.origemY + img.altura / img.escala }
        const tela = document.createElement('canvas')
        tela.width = Math.round((r.x1 - r.x0) * zoom)
        tela.height = Math.round((r.y1 - r.y0) * zoom)
        const g = tela.getContext('2d')
        if (g === null) return tela
        g.fillStyle = GRAMA
        g.fillRect(0, 0, tela.width, tela.height)
        g.imageSmoothingEnabled = !pixelAPixel
        g.imageSmoothingQuality = 'high'
        g.drawImage(fonte, (r.x0 - img.origemX) * img.escala, (r.y0 - img.origemY) * img.escala, (r.x1 - r.x0) * img.escala, (r.y1 - r.y0) * img.escala, 0, 0, tela.width, tela.height)
        return tela
      }
      const naChamine = (): Recorte => {
        const c = ch.chamineDoPoligono(pontos)
        if (c === null) throw new Error('a casa de 4x3 ficou sem chaminé')
        return { x0: c.x - 28, y0: c.y - 28, x1: c.x + 36, y1: c.y + 36 }
      }
      const noCume: Recorte = { x0: 2 * grade - 32, y0: 1.5 * grade - 16, x1: 2 * grade + 32, y1: 1.5 * grade + 16 }
      const quadro = (
        chave: string,
        rotulo: string,
        modelo: 'telhas' | 'palha',
        cor: string,
        extras: { chamine?: boolean; cumeeiraAmarrada?: boolean },
        escala: number,
        zoom: number,
        foco: 'chamine' | 'cume' | null,
        pixelAPixel = false,
      ) => {
        t.pintarTelhado(pontos, modelo, cor, escala, extras)
        const t0 = performance.now()
        const img = t.pintarTelhado(pontos, modelo, cor, escala, extras)
        const ms = performance.now() - t0
        const recorte = foco === 'chamine' ? naChamine() : foco === 'cume' ? noCume : null
        const png = telaDe(img, zoom, recorte, pixelAPixel).toDataURL('image/png').split(',')[1]
        quadros.push({ chave, rotulo, png, tempo: `pintura a ${escala}x ${ms.toFixed(1)} ms` })
      }
      const tudo = { chamine: true, cumeeiraAmarrada: true }
      quadro('telha-1x', 'TELHA 1X (CHAMINE)', 'telhas', barro, { chamine: true }, 1, 1, null)
      quadro('telha-3x', 'TELHA PINTADA A 3X (CHAMINE)', 'telhas', barro, { chamine: true }, 3, 3, 'chamine')
      quadro('telha-300', 'TELHA ZOOM 300% (1X AMPLIADA, O APP)', 'telhas', barro, { chamine: true }, 1, 3, 'chamine')
      quadro('palha-1x', 'PALHA 1X (CHAMINE + CUME)', 'palha', palha, tudo, 1, 1, null)
      quadro('palha-3x', 'PALHA PINTADA A 3X (CHAMINE)', 'palha', palha, tudo, 3, 3, 'chamine')
      quadro('palha-300', 'PALHA ZOOM 300% (CHAMINE)', 'palha', palha, tudo, 1, 3, 'chamine')
      quadro('cume-1x', 'CUMEEIRA 1X (PIXELS AMPLIADOS 3X)', 'palha', palha, tudo, 1, 3, 'cume', true)
      quadro('cume-300', 'CUMEEIRA ZOOM 300% (O APP)', 'palha', palha, tudo, 1, 3, 'cume')
      quadro('escuro-telha-1x', 'ESCURO: TELHA PRETA 1X', 'telhas', preto, { chamine: true }, 1, 1, null)
      quadro('escuro-telha-300', 'ESCURO: TELHA PRETA ZOOM 300%', 'telhas', preto, { chamine: true }, 1, 3, 'chamine')
      quadro('escuro-musgo-cume-1x', 'ESCURO: MUSGO CUMEEIRA 1X (PIXELS 3X)', 'palha', musgo, tudo, 1, 3, 'cume', true)
      return quadros
    },
    { grade: GRADE, barro: PALETA_DO_TETO.telhas[0].hex, palha: PALETA_DO_TETO.palha[0].hex, preto: PALETA_DO_TETO.telhas[5].hex, musgo: PALETA_DO_TETO.palha[5].hex },
  )
}

/** A grade de verdade (Pixi do editor, obra ligada) em 50%, 100% e 300%. */
async function quadrosDaGrade(page: Page): Promise<Quadro[]> {
  await abrirAventuraDeMentira(page, discoDoMestre(), 'Cela', 'MT10BF', `/${OBRA}`)
  await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().setSelection([]))
  const quadros: Quadro[] = []
  for (const escala of [0.5, 1, 3]) {
    const ms = await page.evaluate(async (s) => {
      const walls = (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.walls
      const { drawWalls } = await import('/src/pixi/drawWalls.ts')
      // Só o cálculo do desenho, com um Graphics de mentira (cada método devolve ele mesmo).
      const falso: Record<string, unknown> = new Proxy({}, { get: () => () => falso })
      const t0 = performance.now()
      for (let i = 0; i < 20; i += 1) drawWalls(falso as unknown as Parameters<typeof drawWalls>[0], walls, null, s, 1) // cast seguro: drawWalls só chama métodos encadeáveis do Graphics
      return (performance.now() - t0) / 20
    }, escala)
    const lado = 200 / escala
    const caixa = { x0: 900 - lado / 2, y0: 200 - lado / 2, x1: 900 + lado / 2, y1: 200 + lado / 2 }
    await centrar(page, caixa, escala)
    const png = await fotoParada(page, caixa)
    quadros.push({ chave: `grade-${escala * 100}`, rotulo: `GRADE ZOOM ${escala * 100}% (EDITOR REAL)`, png: png.toString('base64'), tempo: `desenho das paredes ${ms.toFixed(2)} ms` })
  }
  return quadros
}

test.use({ trace: 'off', video: 'off', viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion: 'reduce' } })

test('provas: folha de contato da MT10b (antes e depois do ajuste)', async ({ page }) => {
  test.skip(MODO !== 'antes' && MODO !== 'depois', 'só com GERAR_PROVAS_MT10B=antes ou depois')
  test.skip(ARQUIVO_DO_ANTES === '', 'falta MT10B_ANTES (o arquivo dos quadros de antes)')
  test.setTimeout(240_000)
  const quadros = [...(await quadrosDaGrade(page)), ...(await quadrosDosTelhados(page))]
  if (MODO === 'antes') {
    writeFileSync(ARQUIVO_DO_ANTES, JSON.stringify(quadros))
    return
  }
  // Lido em base64 e decodificado: o shim de tipos do node no e2e só conhece o `toString('base64')`.
  const texto = new TextDecoder().decode(Buffer.from(readFileSync(ARQUIVO_DO_ANTES).toString('base64'), 'base64'))
  const antes = JSON.parse(texto) as Quadro[] // cast seguro: o arquivo é o que o modo antes gravou
  const pares = quadros.map((d) => {
    const a = antes.find((q) => q.chave === d.chave)
    if (a === undefined) throw new Error(`sem o antes de ${d.chave}`)
    return { rotulo: d.rotulo, antes: a.png, depois: d.png, tempoAntes: a.tempo, tempoDepois: d.tempo }
  })
  const folha = await page.evaluate(async (lista) => {
    const ler = async (png: string): Promise<HTMLImageElement> => {
      const imagem = new Image()
      imagem.src = `data:image/png;base64,${png}`
      await imagem.decode()
      return imagem
    }
    const imagens = await Promise.all(lista.map(async (p) => ({ ...p, a: await ler(p.antes), d: await ler(p.depois) })))
    const COLUNAS = 3
    const MARGEM = 24
    const ENTRE = 10
    const TOPO = 22
    const LEGENDA = 50
    const larguraDoQuadro = Math.max(...imagens.map((q) => q.a.width + q.d.width + ENTRE))
    const alturaDoQuadro = Math.max(...imagens.map((q) => Math.max(q.a.height, q.d.height)))
    const linhas = Math.ceil(imagens.length / COLUNAS)
    const tela = document.createElement('canvas')
    tela.width = MARGEM + COLUNAS * (larguraDoQuadro + MARGEM)
    tela.height = MARGEM + 44 + linhas * (TOPO + alturaDoQuadro + LEGENDA + MARGEM)
    const g = tela.getContext('2d')
    if (g === null) throw new Error('sem 2D')
    g.fillStyle = '#1d211b'
    g.fillRect(0, 0, tela.width, tela.height)
    g.fillStyle = '#f2ead8'
    g.font = 'bold 18px sans-serif'
    g.fillText('MT10b - antes (esquerda) e depois (direita) do ajuste: chaminé maior, amarras da cumeeira, grade reforçada', MARGEM, MARGEM + 14)
    imagens.forEach((q, i) => {
      const x = MARGEM + (i % COLUNAS) * (larguraDoQuadro + MARGEM)
      const y = MARGEM + 44 + Math.floor(i / COLUNAS) * (TOPO + alturaDoQuadro + LEGENDA + MARGEM)
      g.fillStyle = '#c9c2b0'
      g.font = 'bold 12px sans-serif'
      g.fillText('ANTES', x, y + 14)
      g.fillText('DEPOIS', x + q.a.width + ENTRE, y + 14)
      g.drawImage(q.a, x, y + TOPO)
      g.drawImage(q.d, x + q.a.width + ENTRE, y + TOPO)
      g.fillStyle = '#f2ead8'
      g.font = 'bold 13px sans-serif'
      g.fillText(q.rotulo, x, y + TOPO + alturaDoQuadro + 18)
      g.font = '12px sans-serif'
      g.fillStyle = '#c9c2b0'
      g.fillText(`antes: ${q.tempoAntes} | depois: ${q.tempoDepois}`, x, y + TOPO + alturaDoQuadro + 36)
    })
    return { png: tela.toDataURL('image/png').split(',')[1], quadros: imagens.length }
  }, pares)
  expect(folha.quadros).toBeGreaterThanOrEqual(12)
  expect(folha.quadros).toBeLessThanOrEqual(16)
  writeFileSync(`${PROVAS}/mt10b-folha-de-contato.png`, Buffer.from(folha.png, 'base64'))
})
