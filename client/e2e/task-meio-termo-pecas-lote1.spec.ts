// PEÇAS NOVAS DO MEIO-TERMO, LOTE 1 (fatia MT4): as 9 peças (e as vistas de lado
// da barraca e da carroça) saem em imagem no JOGADOR mesmo SEM a chave de obra,
// e a mesa antiga continua no desenho de linhas sem ela. Não toca no golden:
// compara fotos tiradas aqui, pixel a pixel, por região de cada peça.
//
// O DESENHO DE LINHAS de referência sai da mesma página com o módulo das
// imagens (`src/pixi/rasterDosMoveis.ts`) bloqueado na rede: sem ele, toda
// peça fica no provisório de linhas. Controle negativo: a mesa antiga, sem a
// chave, sai igual ao desenho de linhas. Controle positivo: com
// `?obra=meio-termo` a mesa antiga muda, e as peças novas ficam como estavam.
import { test, expect, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { addProp, addToken, createEmptyMap, setGridSettings, setShowGrid } from '../src/lib/mapFactory'
import { criarMovel, movelComOutraVista } from '../src/lib/mobilia'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { serializeMap } from '../src/lib/mapFile'
import { MATERIAIS } from '../src/texturas/meioTermo/materiais'
import type { MapData, RegionPoint } from '../src/types/map'
import type { DesenhoDoMovel } from '../src/texturas/meioTermo/moveis'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

const GRADE = 64
const COLUNAS = 16
const LINHAS = 12
const FICHA = 'ficha-ana'
/** Fração mínima dos pixels da caixa de cada peça que muda entre o desenho de linhas e a imagem. */
const FRACAO_MINIMA_POR_PECA = 0.1
/** Teto da mudança onde o desenho tem de ser o MESMO (controle): ruído de abertura. */
const FRACAO_MAXIMA_DE_RUIDO = 0.01
const MARGEM_DO_ENQUADRAMENTO = 24

test.use({ trace: 'off', video: 'off', viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

function anel(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

/** Uma peça nova de cada tipo, as vistas de lado da barraca e da carroça, e a mesa antiga (o controle), longe da ficha da Ana. */
function mapaDasPecas(): MapData {
  let map = setGridSettings(setShowGrid(createEmptyMap('meio-termo-pecas-lote1', 'Vila', COLUNAS, LINHAS, GRADE), true), { color: '#6a6a6a', opacity: 0.6 })
  map = addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: 960, y: 704, size: 1, image: null })
  map = addProp(map, criarMovel('mesaQuadrada', { x: 96, y: 96 }, GRADE, 'n-mesa-quadrada'))
  map = addProp(map, criarMovel('mesaRedonda', { x: 256, y: 96 }, GRADE, 'n-mesa-redonda'))
  map = addProp(map, criarMovel('lapide', { x: 400, y: 96 }, GRADE, 'n-lapide'))
  map = addProp(map, criarMovel('vaso', { x: 512, y: 96 }, GRADE, 'n-vaso'))
  map = addProp(map, criarMovel('lampiao', { x: 624, y: 96 }, GRADE, 'n-lampiao'))
  map = addProp(map, criarMovel('quadroDeAvisos', { x: 768, y: 96 }, GRADE, 'n-quadro'))
  map = addProp(map, criarMovel('poco', { x: 128, y: 320 }, GRADE, 'n-poco'))
  map = addProp(map, criarMovel('barraca', { x: 352, y: 320 }, GRADE, 'n-barraca'))
  map = addProp(map, criarMovel('carroca', { x: 608, y: 320 }, GRADE, 'n-carroca'))
  map = addProp(map, movelComOutraVista(criarMovel('barraca', { x: 160, y: 576 }, GRADE, 'n-barraca-de-lado'), 'lado', GRADE))
  map = addProp(map, movelComOutraVista(criarMovel('carroca', { x: 448, y: 576 }, GRADE, 'n-carroca-de-lado'), 'lado', GRADE))
  map = addProp(map, criarMovel('mesa', { x: 864, y: 320 }, GRADE, 'controle-mesa'))
  return map
}

const ID_DO_CONTROLE = 'controle-mesa'

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

/** Foto do canvas do jogador quando a tela para. `semImagens` bloqueia o módulo das imagens: fica o desenho de linhas. */
async function fotoDoJogador(page: Page, busca: string, semImagens = false): Promise<string> {
  if (semImagens) await page.route('**/src/pixi/rasterDosMoveis.ts*', (rota) => rota.abort())
  await page.routeWebSocket((url) => url.pathname === '/ws', hostCom(mapaDasPecas()))
  await page.goto(`/player.html${busca}`)
  await page.getByLabel('Código da sala').fill('PECAS1')
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
  await page.addStyleTag({ content: '*:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }' })
  const canvas = page.locator('canvas').first()
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

interface Regiao {
  readonly nome: string
  readonly id: string
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

function regioes(mapa: MapData): Regiao[] {
  return mapa.props.map((p) => ({ nome: `${p.mobilia ?? 'objeto'}${p.mobiliaVista === 'lado' ? ' de lado' : ''}`, id: p.id, x0: p.x - p.width / 2 - 4, y0: p.y - p.height / 2 - 4, x1: p.x + p.width / 2 + 4, y1: p.y + p.height / 2 + 4 }))
}

/** Pixels que mudam DENTRO da caixa de cada peça, levada para a tela pelo enquadramento do primeiro snapshot. */
async function diferencasPorPeca(page: Page, a: string, b: string): Promise<{ nome: string; id: string; fracao: number }[]> {
  const mapa = mapaDasPecas()
  const mundo = { w: mapa.width * mapa.grid, h: mapa.height * mapa.grid }
  return page.evaluate(
    async ([pngA, pngB, caixas, tamanho, margem]) => {
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
      return caixas.map((r) => {
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
        return { nome: r.nome, id: r.id, fracao: diferentes / Math.max(1, (i1 - i0) * (j1 - j0)) }
      })
    },
    [a, b, regioes(mapa), mundo, MARGEM_DO_ENQUADRAMENTO] as const,
  )
}

test('sem a chave de obra, cada peça nova sai em imagem no jogador; a mesa antiga continua no desenho de linhas', async ({ browser }) => {
  test.setTimeout(150_000)
  const paginaDeLinhas = await browser.newPage()
  const paginaSemChave = await browser.newPage()
  const linhas = await fotoDoJogador(paginaDeLinhas, '', true)
  const semChave = await fotoDoJogador(paginaSemChave, '')
  const porPeca = await diferencasPorPeca(paginaSemChave, linhas, semChave)
  console.log(`[medida] fração que muda do desenho de linhas para o sem-chave: ${porPeca.map((p) => `${p.nome} ${p.fracao.toFixed(3)}`).join('; ')}`)
  expect(porPeca).toHaveLength(12)
  for (const p of porPeca) {
    if (p.id === ID_DO_CONTROLE) expect(p.fracao, `${p.nome} (controle negativo: sem a chave fica no desenho de linhas)`).toBeLessThan(FRACAO_MAXIMA_DE_RUIDO)
    else expect(p.fracao, p.nome).toBeGreaterThanOrEqual(FRACAO_MINIMA_POR_PECA)
  }
  await Promise.all([paginaDeLinhas.close(), paginaSemChave.close()])
})

test('com ?obra=meio-termo a mesa antiga muda (controle positivo) e as peças novas saem iguais às de sem a chave', async ({ browser }) => {
  test.setTimeout(150_000)
  const paginaSemChave = await browser.newPage()
  const paginaComObra = await browser.newPage()
  const semChave = await fotoDoJogador(paginaSemChave, '')
  const comObra = await fotoDoJogador(paginaComObra, '?obra=meio-termo')
  const porPeca = await diferencasPorPeca(paginaComObra, semChave, comObra)
  console.log(`[medida] fração que muda do sem-chave para o com-obra: ${porPeca.map((p) => `${p.nome} ${p.fracao.toFixed(3)}`).join('; ')}`)
  for (const p of porPeca) {
    if (p.id === ID_DO_CONTROLE) expect(p.fracao, `${p.nome} (controle positivo: a obra troca a mesa antiga)`).toBeGreaterThanOrEqual(FRACAO_MINIMA_POR_PECA)
    else expect(p.fracao, `${p.nome}: a peça nova não depende da chave`).toBeLessThan(FRACAO_MAXIMA_DE_RUIDO)
  }
  await Promise.all([paginaSemChave.close(), paginaComObra.close()])
})

const TETO_DA_IMAGEM_MS = 50
const TETO_DA_FRIA_MS = TETO_DA_IMAGEM_MS * 2
const MORNAS = 5
const BASE = { lado: 'frente', semente: 7 } as const
const CASOS: readonly [string, DesenhoDoMovel][] = [
  ['mesa quadrada', { ...BASE, tipo: 'mesaQuadrada', materiais: ['carvalho'], casasW: 1, casasH: 1 }],
  ['mesa redonda', { ...BASE, tipo: 'mesaRedonda', materiais: ['carvalho'], casasW: 1.25, casasH: 1.25 }],
  ['lápide', { ...BASE, tipo: 'lapide', materiais: ['granito'], casasW: 0.6, casasH: 0.35, variante: 0 }],
  ['vaso', { ...BASE, tipo: 'vaso', materiais: ['barro'], casasW: 0.5, casasH: 0.5 }],
  ['lampião', { ...BASE, tipo: 'lampiao', materiais: ['ferro'], casasW: 0.5, casasH: 0.5 }],
  ['quadro de avisos', { ...BASE, tipo: 'quadroDeAvisos', materiais: ['nogueira'], casasW: 1, casasH: 0.4 }],
  ['poço', { ...BASE, tipo: 'poco', materiais: ['granito', 'carvalho'], casasW: 1.5, casasH: 1.5 }],
  ['barraca', { ...BASE, tipo: 'barraca', materiais: ['vinho', 'pinho'], casasW: 2, casasH: 2 }],
  ['barraca de lado', { ...BASE, tipo: 'barraca', lado: 'lado', materiais: ['vinho', 'pinho'], casasW: 2, casasH: 2 }],
  ['carroça', { ...BASE, tipo: 'carroca', materiais: ['nogueira', 'ferro'], casasW: 2, casasH: 1.25 }],
  ['carroça de lado', { ...BASE, tipo: 'carroca', lado: 'lado', materiais: ['nogueira', 'ferro'], casasW: 2, casasH: 1.25 }],
]

test('tempo no Chromium a 3x: cada peça nova como a PRIMEIRA imagem de uma página nova (motor frio) e a mediana morna', async ({ browser }) => {
  test.setTimeout(240_000)
  const tempos: { nome: string; fria: number; morna: number }[] = []
  for (const [nome, desenho] of CASOS) {
    const page = await browser.newPage()
    await page.goto('/player.html')
    tempos.push({
      nome,
      ...(await page.evaluate(
        async ({ caminho, d, mornasPedidas }) => {
          const m = (await import(/* @vite-ignore */ caminho)) as typeof import('../src/texturas/meioTermo/moveis') // cast seguro: o caminho é este mesmo módulo servido pelo Vite, e import por string não traz tipo
          const medir = (): number => {
            const t0 = performance.now()
            m.pintarMovel(d, m.escalaDoNivel(3))
            return performance.now() - t0
          }
          const fria = medir()
          const mornas = Array.from({ length: mornasPedidas }, medir).sort((a, b) => a - b)
          return { fria, morna: mornas[Math.floor(mornasPedidas / 2)] }
        },
        { caminho: '/src/texturas/meioTermo/moveis/index.ts', d: desenho, mornasPedidas: MORNAS },
      )),
    })
    await page.close()
  }
  console.log(`[medida] a 3x no Chromium, primeira imagem da página (fria) / mediana morna de ${MORNAS}: ${tempos.map((t) => `${t.nome} ${t.fria.toFixed(1)} / ${t.morna.toFixed(1)} ms`).join('; ')}`)
  for (const { nome, fria, morna } of tempos) {
    expect(fria, `${nome}: fria, primeira da página`).toBeLessThan(TETO_DA_FRIA_MS)
    expect(morna, `${nome}: mediana morna`).toBeLessThanOrEqual(TETO_DA_IMAGEM_MS)
  }
})

// O PAINEL do mestre: o menu de Objeto oferece as 9 peças novas com o nome e a
// dica certos, e a barraca escolhida mostra o material no lugar da cor; clicar
// numa amostra grava o tom oficial do material no campo de cor do objeto.
const PROVAS = '../docs/design/objetos/provas'
/** Os 3 prints de layout só são regravados quando pedidos (GERAR_PROVAS_MT4=1): rodar o teste não suja a árvore. */
const GERAR_PROVAS = process.env.GERAR_PROVAS_MT4 === '1'
async function prova(alvo: Page | Locator, nome: string): Promise<void> {
  if (GERAR_PROVAS) await alvo.screenshot({ path: `${PROVAS}/${nome}` })
}
const PASTA_DO_MESTRE = 'C:/appdata/maps/map_pecas'
const NOVAS: readonly [string, string][] = [
  ['Mesa quadrada', 'uma mesa quadrada'],
  ['Mesa redonda', 'uma mesa redonda'],
  ['Lápide', 'uma lápide'],
  ['Vaso de planta', 'um vaso de planta'],
  ['Lampião', 'um lampião'],
  ['Quadro de avisos', 'um quadro de avisos'],
  ['Poço', 'um poço'],
  ['Barraca de feira', 'uma barraca de feira'],
  ['Carroça', 'uma carroça'],
]

function discoDoMestre(): Record<string, string> {
  const aventura = { version: 1, id: 'adv_pecas', name: 'Vila', startSceneId: 'scene_pecas', scenes: [{ id: 'scene_pecas', name: 'Vila', file: 'map.json' }] }
  return { [`${PASTA_DO_MESTRE}/map.json`]: serializeMap(mapaDasPecas()), [`${PASTA_DO_MESTRE}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

async function abrirMenuDeObjeto(page: Page): Promise<Locator> {
  await page.getByRole('toolbar', { name: 'Ferramentas do mapa' }).getByRole('button', { name: 'Opções de Objeto', exact: true }).click()
  const menu = page.getByRole('group', { name: 'Opções de Objeto' })
  await expect(menu).toBeVisible()
  return menu
}

/** Cada rádio das peças novas cabe inteiro no menu, e o menu cabe na janela (nada vaza para o lado). */
async function conferirQueCabe(page: Page, menu: Locator): Promise<void> {
  const caixaDoMenu = await menu.boundingBox()
  const janela = page.viewportSize()
  if (caixaDoMenu === null || janela === null) throw new Error('menu sem caixa')
  expect(caixaDoMenu.x).toBeGreaterThanOrEqual(0)
  expect(caixaDoMenu.x + caixaDoMenu.width).toBeLessThanOrEqual(janela.width + 0.5)
  for (const [nome] of NOVAS) {
    const radio = menu.getByRole('radio', { name: nome, exact: true })
    await radio.scrollIntoViewIfNeeded()
    const caixa = await radio.boundingBox()
    if (caixa === null) throw new Error(`${nome}: sem caixa`)
    expect(caixa.x, nome).toBeGreaterThanOrEqual(caixaDoMenu.x - 0.5)
    expect(caixa.x + caixa.width, nome).toBeLessThanOrEqual(caixaDoMenu.x + caixaDoMenu.width + 0.5)
    // O nome (quebra em duas linhas como "Armário de cozinha", mas não é cortado) e o desenho da peça ao lado, como os 11 de antes.
    const { cortado, tracos } = await radio.evaluate((botao, rotulo) => {
      const texto = [...botao.querySelectorAll('span')].find((s) => s.textContent === rotulo)
      return {
        cortado: texto === undefined || texto.scrollWidth > texto.clientWidth + 1 || texto.getBoundingClientRect().right > botao.getBoundingClientRect().right + 0.5,
        tracos: botao.querySelector('.lb-toolvariant-menu__option-icon svg')?.childElementCount ?? 0,
      }
    }, nome)
    expect(cortado, `${nome}: nome cortado`).toBe(false)
    expect(tracos, `${nome}: desenho no menu`).toBeGreaterThan(0)
  }
}

test('painel a 1280: Objetos oferece as 9 peças novas com nome e dica; a barraca troca o toldo pelo material e grava o tom oficial', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await abrirAventuraDeMentira(page, discoDoMestre(), 'Vila', 'PECAS2')
  const menu = await abrirMenuDeObjeto(page)
  for (const [nome, artigo] of NOVAS) {
    const radio = menu.getByRole('radio', { name: nome, exact: true })
    await expect(radio, nome).toBeVisible()
    await expect(radio, nome).toHaveAccessibleDescription(`Clique no mapa para pôr ${artigo}.`)
  }
  await conferirQueCabe(page, menu)
  await prova(page, 'mt4-painel-1280-menu.png')
  // A escolha arma a ferramenta: o eco da barra diz o próximo objeto.
  await menu.getByRole('radio', { name: 'Barraca de feira', exact: true }).click()
  await expect(menu).toBeHidden()

  await page.evaluate(async () => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.setActiveTool('select')
    store.setSelection([{ kind: 'prop', id: 'n-barraca' }])
  })
  const livro = page.getByRole('complementary', { name: 'Livro do mestre' })
  // O material mora na seção Aparência da ficha, que nasce recolhida.
  const aparencia = livro.getByRole('button', { name: /^Aparência/ }).first()
  if ((await aparencia.getAttribute('aria-expanded')) !== 'true') await aparencia.click()
  const toldo = livro.getByRole('radiogroup', { name: 'Toldo', exact: true })
  const madeira = livro.getByRole('radiogroup', { name: 'Madeira', exact: true })
  await expect(toldo).toBeVisible()
  await expect(madeira).toBeVisible()
  await expect(toldo.getByRole('radio', { name: MATERIAIS.vinho.nome, exact: true })).toHaveAttribute('aria-checked', 'true')
  // Sem "Preencher" nem cor livre: a peça nova é sempre desenhada com material.
  await expect(livro.getByRole('checkbox', { name: 'Preencher' })).toHaveCount(0)
  await toldo.getByRole('radio', { name: MATERIAIS.azul.nome, exact: true }).click()
  await expect(toldo.getByRole('radio', { name: MATERIAIS.azul.nome, exact: true })).toHaveAttribute('aria-checked', 'true')
  const gravado = await page.evaluate(async () => {
    const { useMapStore } = await import('/src/stores/mapStore.ts')
    return useMapStore.getState().map.props.find((p) => p.id === 'n-barraca')?.mobiliaCor ?? null
  })
  expect(gravado).toBe(MATERIAIS.azul.hex)
  await prova(livro, 'mt4-painel-1280-material.png')
})

// A 390 px quem usa é o JOGADOR no celular (o editor do mestre é de mesa): as peças novas aparecem no mapa dele e nada vaza para o lado.
test('jogador no celular (390 px): as peças novas no mapa, sem a página rolar para o lado', async ({ browser }) => {
  test.setTimeout(120_000)
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await fotoDoJogador(page, '')
  const larguraDaPagina = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(larguraDaPagina).toBeLessThanOrEqual(390)
  await prova(page, 'mt4-jogador-390.png')
  await page.close()
})
