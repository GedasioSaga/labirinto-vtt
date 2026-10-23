// MEIO-TERMO LIGADO (`?obra=meio-termo`, só no servidor de desenvolvimento): o
// MESMO mapa abre no jogador com os móveis em imagem (mesa, cadeira, baú e
// barril, os da casa do golden) e sai diferente do desenho de linhas. Não
// toca no golden nem nos 9 PNG dele: compara duas fotos tiradas aqui, pixel a
// pixel, num canvas 2D da própria página.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { addProp, addToken, createEmptyMap, setGridSettings, setShowGrid } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import type { MapData, RegionPoint } from '../src/types/map'

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

async function fotoDoJogador(page: Page, busca: string): Promise<string> {
  await page.routeWebSocket((url) => url.pathname === '/ws', hostCom(mapaDosMoveis()))
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

test('o mesmo mapa no jogador: com ?obra=meio-termo os móveis saem em imagem, diferentes do desenho de linhas', async ({ browser }) => {
  test.setTimeout(120_000)
  const desligada = await browser.newPage()
  const ligada = await browser.newPage()
  const semObra = await fotoDoJogador(desligada, '')
  const comObra = await fotoDoJogador(ligada, '?obra=meio-termo')
  const diferentes = await pixelsDiferentes(ligada, semObra, comObra)
  expect(diferentes).toBeGreaterThan(PIXELS_DIFERENTES_MINIMOS)
  // Controle: a obra desligada aberta de novo quase não muda (medido: 16 pixels de ruído entre aberturas),
  // então a diferença acima é dos móveis, não da abertura. Teto: 1% dela.
  const outraVez = await browser.newPage()
  const semObraDeNovo = await fotoDoJogador(outraVez, '')
  expect(await pixelsDiferentes(ligada, semObra, semObraDeNovo)).toBeLessThan(diferentes / 100)
  await Promise.all([desligada.close(), ligada.close(), outraVez.close()])
})
