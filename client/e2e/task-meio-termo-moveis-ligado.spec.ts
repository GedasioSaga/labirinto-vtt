// MEIO-TERMO LIGADO (`?obra=meio-termo`, só no servidor de desenvolvimento): o
// MESMO mapa abre no jogador com os móveis em imagem (mesa, cadeira, baú e
// barril, os da casa do golden) e sai diferente do desenho de linhas. Não
// toca no golden nem nos 9 PNG dele: compara duas fotos tiradas aqui, pixel a
// pixel, num canvas 2D da própria página.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { addProp, addToken, createEmptyMap, setGridSettings, setShowGrid } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import { curvaForTurnDegrees } from '../src/lib/stairCurve'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import type { MapData, RegionPoint } from '../src/types/map'
import type { DesenhoDoMovel } from '../src/texturas/meioTermo/moveis'

const GRADE = 64
const COLUNAS = 16
const LINHAS = 12
const FICHA = 'ficha-ana'
/** Pixels diferentes que provam a troca: só a mesa (2 x 1 casa) a 1:1 já cobre mais de 8000. */
const PIXELS_DIFERENTES_MINIMOS = 4000

test.use({ trace: 'off', video: 'off', viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

/** A sala com os 4 móveis com textura da casa do golden, a ficha da Ana e a grade. */
function mapaDosMoveis(): MapData {
  let map = setGridSettings(setShowGrid(createEmptyMap('meio-termo-moveis', 'Casa', COLUNAS, LINHAS, GRADE), true), { color: '#6a6a6a', opacity: 0.6 })
  map = addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: 352, y: 448, size: 1, image: null })
  map = addProp(map, criarMovel('mesa', { x: 256, y: 224 }, GRADE, 'o1'))
  map = addProp(map, criarMovel('cadeira', { x: 320, y: 320 }, GRADE, 'o2'))
  map = addProp(map, criarMovel('bau', { x: 640, y: 320 }, GRADE, 'o4'))
  map = addProp(map, criarMovel('barril', { x: 640, y: 160 }, GRADE, 'o6'))
  return map
}

function anel(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

/** O host de mentira: a cada `join` manda a cena com a visão inteira e a ficha da Ana. */
function hostCom(map: MapData): (ws: WebSocketRoute) => void {
  const explored = encodeExploration(createExploration(map))
  return (ws) => {
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
      ws.send(JSON.stringify({ type: 'snapshot', rev: 1, map, vision: [anel(0, 0, COLUNAS * GRADE, LINHAS * GRADE)], explored, ownTokens: [FICHA], concealed: [], sceneName: map.name }))
    })
  }
}

/**
 * MT3: os 5 tipos que faltavam (cerca reta e curva, armário de cozinha,
 * aparador, fogueira e tapete retangular e redondo), longe da ficha da Ana.
 */
function mapaDosMoveisDaMt3(): MapData {
  let map = setGridSettings(setShowGrid(createEmptyMap('meio-termo-moveis-mt3', 'Pátio', COLUNAS, LINHAS, GRADE), true), { color: '#6a6a6a', opacity: 0.6 })
  map = addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: 352, y: 448, size: 1, image: null })
  map = addProp(map, criarMovel('tapete', { x: 300, y: 600 }, GRADE, 't1'))
  map = addProp(map, { ...criarMovel('tapete', { x: 760, y: 600 }, GRADE, 't2'), width: 2 * GRADE, height: 2 * GRADE, mobiliaForma: 'redondo' })
  map = addProp(map, criarMovel('cerca', { x: 200, y: 96 }, GRADE, 'c1'))
  map = addProp(map, { ...criarMovel('cerca', { x: 560, y: 96 }, GRADE, 'c2'), width: 3 * GRADE, mobiliaCurva: 90 })
  map = addProp(map, criarMovel('armario', { x: 160, y: 300 }, GRADE, 'a1'))
  map = addProp(map, criarMovel('aparador', { x: 440, y: 300 }, GRADE, 'a2'))
  map = addProp(map, criarMovel('fogueira', { x: 760, y: 320 }, GRADE, 'f1'))
  return map
}

async function fotoDoJogador(page: Page, busca: string, mapa: MapData = mapaDosMoveis()): Promise<string> {
  await page.routeWebSocket((url) => url.pathname === '/ws', hostCom(mapa))
  await page.goto(`/player.html${busca}`)
  // O código da sala tem 6 caracteres (o botão Entrar só liga com ele inteiro).
  await page.getByLabel('Código da sala').fill('MEIOTE')
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
  await page.addStyleTag({ content: '*:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }' })
  const canvas = page.locator('canvas').first()
  // Espera a tela parar: duas fotos seguidas iguais (com a obra ligada, as imagens dos móveis ficam prontas na fila).
  let anterior = ''
  await expect
    .poll(
      async () => {
        const atual = (await canvas.screenshot({ animations: 'disabled' })).toString('base64')
        const parada = atual === anterior
        anterior = atual
        return parada
      },
      { timeout: 30_000, intervals: [250, 500, 1000] },
    )
    .toBe(true)
  return anterior
}

/** Quantos pixels mudam entre duas fotos PNG (base64), contados num canvas 2D da página. */
async function pixelsDiferentes(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(
    async ([pngA, pngB]) => {
      const ler = async (png: string): Promise<ImageData> => {
        const imagem = new Image()
        imagem.src = `data:image/png;base64,${png}`
        await imagem.decode()
        const tela = document.createElement('canvas')
        tela.width = imagem.width
        tela.height = imagem.height
        const contexto = tela.getContext('2d')
        if (contexto === null) throw new Error('sem canvas 2D')
        contexto.drawImage(imagem, 0, 0)
        return contexto.getImageData(0, 0, imagem.width, imagem.height)
      }
      const [x, y] = await Promise.all([ler(pngA), ler(pngB)])
      if (x.width !== y.width || x.height !== y.height) return Number.POSITIVE_INFINITY
      let diferentes = 0
      for (let i = 0; i < x.data.length; i += 4) {
        if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2]) diferentes += 1
      }
      return diferentes
    },
    [a, b] as const,
  )
}

/** Margem do enquadramento do primeiro snapshot do jogador (`fitCamera` com a margem de `PlayerView.tsx`). */
const MARGEM_DO_ENQUADRAMENTO = 24
/** Fração mínima dos pixels da caixa de CADA móvel que muda com a obra (a cerca é fina: os mourões e o fio cobrem pouco da caixa). */
const FRACAO_MINIMA_POR_MOVEL = 0.1

interface RegiaoDoMovel {
  readonly nome: string
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** A caixa de cada móvel em px de mundo (o centro do objeto mais a meia pegada), com folga para a sombra e a flecha da cerca curva. */
function regioesDosMoveis(mapa: MapData): RegiaoDoMovel[] {
  return mapa.props.map((p) => {
    // A cerca curva arqueia para um lado só, até a flecha: a folga vai dos dois lados.
    const folga = 4 + (p.mobiliaCurva !== undefined ? Math.abs(curvaForTurnDegrees(p.mobiliaCurva, p.width)) : 0)
    return { nome: `${p.mobilia ?? 'objeto'} ${p.id}`, x0: p.x - p.width / 2 - 4, y0: p.y - p.height / 2 - folga, x1: p.x + p.width / 2 + 4, y1: p.y + p.height / 2 + folga }
  })
}

/**
 * Quantos pixels mudam DENTRO da caixa de cada móvel, levada para a tela pelo
 * enquadramento do primeiro snapshot (o mapa inteiro centrado, com margem).
 */
async function diferencasPorMovel(page: Page, a: string, b: string, mapa: MapData): Promise<{ nome: string; diferentes: number; area: number }[]> {
  const mundo = { w: mapa.width * mapa.grid, h: mapa.height * mapa.grid }
  return page.evaluate(
    async ([pngA, pngB, regioes, tamanho, margem]) => {
      const ler = async (png: string): Promise<ImageData> => {
        const imagem = new Image()
        imagem.src = `data:image/png;base64,${png}`
        await imagem.decode()
        const tela = document.createElement('canvas')
        tela.width = imagem.width
        tela.height = imagem.height
        const contexto = tela.getContext('2d')
        if (contexto === null) throw new Error('sem canvas 2D')
        contexto.drawImage(imagem, 0, 0)
        return contexto.getImageData(0, 0, imagem.width, imagem.height)
      }
      const [x, y] = await Promise.all([ler(pngA), ler(pngB)])
      const escala = Math.min((x.width - margem * 2) / tamanho.w, (x.height - margem * 2) / tamanho.h)
      const telaX = (v: number): number => x.width / 2 + (v - tamanho.w / 2) * escala
      const telaY = (v: number): number => x.height / 2 + (v - tamanho.h / 2) * escala
      return regioes.map((r) => {
        const i0 = Math.max(0, Math.floor(telaX(r.x0)))
        const i1 = Math.min(x.width, Math.ceil(telaX(r.x1)))
        const j0 = Math.max(0, Math.floor(telaY(r.y0)))
        const j1 = Math.min(x.height, Math.ceil(telaY(r.y1)))
        let diferentes = 0
        for (let j = j0; j < j1; j += 1) {
          for (let i = i0; i < i1; i += 1) {
            const o = (j * x.width + i) * 4
            if (x.data[o] !== y.data[o] || x.data[o + 1] !== y.data[o + 1] || x.data[o + 2] !== y.data[o + 2]) diferentes += 1
          }
        }
        return { nome: r.nome, diferentes, area: Math.max(0, i1 - i0) * Math.max(0, j1 - j0) }
      })
    },
    [a, b, regioesDosMoveis(mapa), mundo, MARGEM_DO_ENQUADRAMENTO] as const,
  )
}

test('o mesmo mapa no jogador: com ?obra=meio-termo os móveis saem em imagem, diferentes do desenho de linhas', async ({ browser }) => {
  test.setTimeout(120_000)
  const desligada = await browser.newPage()
  const ligada = await browser.newPage()
  const semObra = await fotoDoJogador(desligada, '?obra=linhas')
  const comObra = await fotoDoJogador(ligada, '?obra=meio-termo')
  const diferentes = await pixelsDiferentes(ligada, semObra, comObra)
  expect(diferentes).toBeGreaterThan(PIXELS_DIFERENTES_MINIMOS)
  // Controle: a obra desligada aberta de novo quase não muda (medido: 16 pixels de ruído entre aberturas),
  // então a diferença acima é dos móveis, não da abertura. Teto: 1% dela.
  const outraVez = await browser.newPage()
  const semObraDeNovo = await fotoDoJogador(outraVez, '?obra=linhas')
  expect(await pixelsDiferentes(ligada, semObra, semObraDeNovo)).toBeLessThan(diferentes / 100)
  await Promise.all([desligada.close(), ligada.close(), outraVez.close()])
})

/** Teto do plano para gerar uma imagem a 3x, na mediana morna (`docs/planos/meio-termo-texturas-objetos-2026-10-23.md`, "MT2/MT3 medido"). */
const TETO_DA_IMAGEM_MS = 50
/** A fria só é registrada contra o teto folgado da suíte (o dobro): a geração anda em fatias de 8 ms, então a fria não vira tarefa longa. */
const TETO_DA_FRIA_MS = TETO_DA_IMAGEM_MS * 2
const MORNAS = 5

test('tempo no Chromium a 3x: a primeira imagem da página (a cama, fria) e cada tipo da MT3, fria registrada e mediana morna abaixo de 50 ms', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/player.html')
  const tempos = await page.evaluate(async ({ caminho, mornasPedidas }) => {
    const m = (await import(/* @vite-ignore */ caminho)) as typeof import('../src/texturas/meioTermo/moveis') // cast seguro: o caminho é este mesmo módulo servido pelo Vite, e import por string não traz tipo
    const S = m.escalaDoNivel(3)
    const base = { lado: 'frente', semente: 7 } as const
    const casos: readonly [string, Parameters<typeof m.pintarMovel>[0]][] = [
      ['cama (a primeira da página: fria)', { ...base, tipo: 'catre', materiais: ['carvalho', 'vinho', 'linho'], casasW: 1, casasH: 2 }],
      ['cerca reta', { ...base, tipo: 'cerca', materiais: ['carvalho', 'varas'], casasW: 2, casasH: 0.25 }],
      ['cerca curva', { ...base, tipo: 'cerca', materiais: ['velha', 'arame'], casasW: 3, casasH: 0.25, curva: 90 }],
      ['armário', { ...base, tipo: 'armario', materiais: ['nogueira', 'latao'], casasW: 1, casasH: 0.5 }],
      ['armário de lado', { ...base, tipo: 'armario', lado: 'lado', materiais: ['nogueira', 'latao'], casasW: 1, casasH: 1.5 }],
      ['aparador', { ...base, tipo: 'aparador', materiais: ['nogueira', 'latao'], casasW: 2, casasH: 0.5 }],
      ['fogueira', { ...base, tipo: 'fogueira', materiais: ['granito', 'lenhaCarvalho'], casasW: 1, casasH: 1 }],
      ['tapete', { ...base, tipo: 'tapete', materiais: ['vinho'], casasW: 3, casasH: 2 }],
      ['tapete redondo', { ...base, tipo: 'tapete', materiais: ['azul'], casasW: 2, casasH: 2, forma: 'redondo' }],
    ]
    const medir = (d: Parameters<typeof m.pintarMovel>[0]): number => {
      const t0 = performance.now()
      m.pintarMovel(d, S)
      return performance.now() - t0
    }
    return casos.map(([nome, d]) => {
      const fria = medir(d)
      const mornas = Array.from({ length: mornasPedidas }, () => medir(d)).sort((a, b) => a - b)
      return { nome, fria, morna: mornas[Math.floor(mornasPedidas / 2)] }
    })
  }, { caminho: '/src/texturas/meioTermo/moveis/index.ts', mornasPedidas: MORNAS })
  console.log(`[medida] a 3x no Chromium (fria / mediana morna de ${MORNAS}): ${tempos.map((t) => `${t.nome} ${t.fria.toFixed(1)} / ${t.morna.toFixed(1)} ms`).join('; ')}`)
  for (const { nome, fria, morna } of tempos) {
    expect(morna, `${nome}: mediana morna`).toBeLessThanOrEqual(TETO_DA_IMAGEM_MS)
    expect(fria, `${nome}: fria`).toBeLessThan(TETO_DA_FRIA_MS)
  }
})

test('tempo no Chromium a 3x: cada tipo da MT3 como a PRIMEIRA imagem de uma página nova (motor frio), registrada contra o teto da fria', async ({ browser }) => {
  test.setTimeout(180_000)
  const base = { lado: 'frente', semente: 7 } as const
  const casos: readonly [string, DesenhoDoMovel][] = [
    ['cerca reta', { ...base, tipo: 'cerca', materiais: ['carvalho', 'varas'], casasW: 2, casasH: 0.25 }],
    ['cerca curva', { ...base, tipo: 'cerca', materiais: ['velha', 'arame'], casasW: 3, casasH: 0.25, curva: 90 }],
    ['armário', { ...base, tipo: 'armario', materiais: ['nogueira', 'latao'], casasW: 1, casasH: 0.5 }],
    ['armário de lado', { ...base, tipo: 'armario', lado: 'lado', materiais: ['nogueira', 'latao'], casasW: 1, casasH: 1.5 }],
    ['aparador', { ...base, tipo: 'aparador', materiais: ['nogueira', 'latao'], casasW: 2, casasH: 0.5 }],
    ['fogueira', { ...base, tipo: 'fogueira', materiais: ['granito', 'lenhaCarvalho'], casasW: 1, casasH: 1 }],
    ['tapete', { ...base, tipo: 'tapete', materiais: ['vinho'], casasW: 3, casasH: 2 }],
    ['tapete redondo', { ...base, tipo: 'tapete', materiais: ['azul'], casasW: 2, casasH: 2, forma: 'redondo' }],
  ]
  const frias: { nome: string; fria: number }[] = []
  for (const [nome, desenho] of casos) {
    const page = await browser.newPage()
    await page.goto('/player.html')
    const fria = await page.evaluate(async ({ caminho, d }) => {
      const m = (await import(/* @vite-ignore */ caminho)) as typeof import('../src/texturas/meioTermo/moveis') // cast seguro: o caminho é este mesmo módulo servido pelo Vite, e import por string não traz tipo
      const t0 = performance.now()
      m.pintarMovel(d, m.escalaDoNivel(3))
      return performance.now() - t0
    }, { caminho: '/src/texturas/meioTermo/moveis/index.ts', d: desenho })
    frias.push({ nome, fria })
    await page.close()
  }
  console.log(`[medida] a 3x no Chromium, a PRIMEIRA imagem de cada página (motor frio): ${frias.map((t) => `${t.nome} ${t.fria.toFixed(1)} ms`).join('; ')}`)
  for (const { nome, fria } of frias) expect(fria, `${nome}: fria, primeira da página`).toBeLessThan(TETO_DA_FRIA_MS)
})

test('MT3 no jogador: cerca reta e curva, armário, aparador, fogueira e os dois tapetes saem em imagem com ?obra=meio-termo, e chapados sem ela', async ({ browser }) => {
  test.setTimeout(120_000)
  const mapa = mapaDosMoveisDaMt3()
  const desligada = await browser.newPage()
  const ligada = await browser.newPage()
  const semObra = await fotoDoJogador(desligada, '?obra=linhas', mapa)
  const comObra = await fotoDoJogador(ligada, '?obra=meio-termo', mapa)
  const diferentes = await pixelsDiferentes(ligada, semObra, comObra)
  // Só o tapete retangular (3 x 2 casas) a 1:1 cobre mais de 20 mil pixels.
  expect(diferentes).toBeGreaterThan(PIXELS_DIFERENTES_MINIMOS)
  // E CADA móvel muda dentro da caixa dele: o tapete grande sozinho não basta para passar.
  const porMovel = await diferencasPorMovel(ligada, semObra, comObra, mapa)
  console.log(`[medida] pixels que mudam por móvel: ${porMovel.map((m) => `${m.nome} ${m.diferentes}/${m.area}`).join('; ')}`)
  expect(porMovel).toHaveLength(7)
  for (const m of porMovel) expect(m.diferentes / m.area, m.nome).toBeGreaterThanOrEqual(FRACAO_MINIMA_POR_MOVEL)
  // Controle: sem a obra, aberto de novo, o mesmo mapa sai igual (o desenho chapado de sempre), a menos do ruído de abertura.
  const outraVez = await browser.newPage()
  const semObraDeNovo = await fotoDoJogador(outraVez, '?obra=linhas', mapa)
  expect(await pixelsDiferentes(ligada, semObra, semObraDeNovo)).toBeLessThan(diferentes / 100)
  for (const m of await diferencasPorMovel(ligada, semObra, semObraDeNovo, mapa)) expect(m.diferentes / m.area, `${m.nome} (controle)`).toBeLessThan(FRACAO_MINIMA_POR_MOVEL / 10)
  await Promise.all([desligada.close(), ligada.close(), outraVez.close()])
})
