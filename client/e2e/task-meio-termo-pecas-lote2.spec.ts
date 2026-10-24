// PEÇAS NOVAS DO MEIO-TERMO, LOTE 2 (fatia MT5): a sebe (reta e curva), a
// jardineira, o arco do portão, a placa de seta (girada) e o tapete longo saem
// em imagem no JOGADOR mesmo SEM a chave de obra, e a mesa antiga continua no
// desenho de linhas sem ela. Não toca no golden: compara fotos tiradas aqui,
// pixel a pixel, por região de cada peça. No painel do mestre: o menu de Objeto
// oferece as 5 peças (nome numa linha, desenho próprio), a sebe troca as folhas
// pelo material, e o atalho da árvore arma o Carimbo com a árvore redonda.
//
// O DESENHO DE LINHAS de referência sai da mesma página com o módulo das
// imagens (`src/pixi/rasterDosMoveis.ts`) bloqueado na rede. Controle negativo:
// a mesa antiga, sem a chave, sai igual ao desenho de linhas. Controle
// positivo: com `?obra=meio-termo` a mesa antiga muda, e as peças novas não.
import { test, expect, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { addProp, addToken, createEmptyMap, setGridSettings, setShowGrid } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { serializeMap } from '../src/lib/mapFile'
import { MATERIAIS } from '../src/texturas/meioTermo/materiais'
import type { MapData, Prop, RegionPoint } from '../src/types/map'
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

/** Uma peça de cada tipo do lote 2 (a sebe também curva, a placa girada) e a mesa antiga (o controle), longe da ficha da Ana. */
function mapaDasPecas(): MapData {
  let map = setGridSettings(setShowGrid(createEmptyMap('meio-termo-pecas-lote2', 'Vila', COLUNAS, LINHAS, GRADE), true), { color: '#6a6a6a', opacity: 0.6 })
  map = addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: 960, y: 704, size: 1, image: null })
  map = addProp(map, criarMovel('sebe', { x: 160, y: 96 }, GRADE, 'n-sebe'))
  map = addProp(map, { ...criarMovel('sebe', { x: 448, y: 96 }, GRADE, 'n-sebe-curva'), mobiliaCurva: 90 })
  map = addProp(map, criarMovel('jardineira', { x: 704, y: 96 }, GRADE, 'n-jardineira'))
  map = addProp(map, criarMovel('arcoDoPortao', { x: 160, y: 320 }, GRADE, 'n-arco'))
  map = addProp(map, { ...criarMovel('placaDeSeta', { x: 384, y: 320 }, GRADE, 'n-placa'), rotation: 90 })
  map = addProp(map, criarMovel('tapeteLongo', { x: 576, y: 400 }, GRADE, 'n-tapete-longo'))
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
  await page.getByLabel('Código da sala').fill('PECAS5')
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
  return mapa.props.map((p) => ({ nome: p.id, id: p.id, x0: p.x - p.width / 2 - 4, y0: p.y - p.height / 2 - 4, x1: p.x + p.width / 2 + 4, y1: p.y + p.height / 2 + 4 }))
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

test('sem a chave de obra, cada peça do lote 2 sai em imagem no jogador; a mesa antiga continua no desenho de linhas', async ({ browser }) => {
  test.setTimeout(150_000)
  const paginaDeLinhas = await browser.newPage()
  const paginaSemChave = await browser.newPage()
  const linhas = await fotoDoJogador(paginaDeLinhas, '', true)
  const semChave = await fotoDoJogador(paginaSemChave, '')
  const porPeca = await diferencasPorPeca(paginaSemChave, linhas, semChave)
  console.log(`[medida] fração que muda do desenho de linhas para o sem-chave: ${porPeca.map((p) => `${p.nome} ${p.fracao.toFixed(3)}`).join('; ')}`)
  expect(porPeca).toHaveLength(7)
  for (const p of porPeca) {
    if (p.id === ID_DO_CONTROLE) expect(p.fracao, `${p.nome} (controle negativo: sem a chave fica no desenho de linhas)`).toBeLessThan(FRACAO_MAXIMA_DE_RUIDO)
    else expect(p.fracao, p.nome).toBeGreaterThanOrEqual(FRACAO_MINIMA_POR_PECA)
  }
  await Promise.all([paginaDeLinhas.close(), paginaSemChave.close()])
})

test('com ?obra=meio-termo a mesa antiga muda (controle positivo) e as peças do lote 2 saem iguais às de sem a chave', async ({ browser }) => {
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
/** A grade de referência do desenho (50 px por casa): o objeto no tamanho padrão dá a pegada padrão. */
const GRADE_DE_REFERENCIA = 50
/**
 * Cada caso é o OBJETO como o app o cria; o desenho (com a semente da chave,
 * não uma semente fixa) sai de `chaveDoMovel` dentro da página, como no app.
 */
const CASOS: readonly [string, Prop][] = [
  ['sebe', criarMovel('sebe', { x: 0, y: 0 }, GRADE_DE_REFERENCIA, 't-sebe')],
  ['sebe curva de 4 casas', { ...criarMovel('sebe', { x: 0, y: 0 }, GRADE_DE_REFERENCIA, 't-sebe-curva'), width: 4 * GRADE_DE_REFERENCIA, mobiliaCurva: 90, mobiliaCor: MATERIAIS.alfeneiro.hex }],
  ['jardineira', criarMovel('jardineira', { x: 0, y: 0 }, GRADE_DE_REFERENCIA, 't-jardineira')],
  ['arco do portão', criarMovel('arcoDoPortao', { x: 0, y: 0 }, GRADE_DE_REFERENCIA, 't-arco')],
  ['placa de seta girada 90', { ...criarMovel('placaDeSeta', { x: 0, y: 0 }, GRADE_DE_REFERENCIA, 't-placa'), rotation: 90 }],
  ['tapete longo', criarMovel('tapeteLongo', { x: 0, y: 0 }, GRADE_DE_REFERENCIA, 't-tapete-longo')],
]

test('tempo no Chromium a 3x: cada peça do lote 2 como a PRIMEIRA imagem de uma página nova (motor frio) e a mediana morna', async ({ browser }) => {
  test.setTimeout(240_000)
  const tempos: { nome: string; fria: number; morna: number }[] = []
  for (const [nome, prop] of CASOS) {
    const page = await browser.newPage()
    await page.goto('/player.html')
    tempos.push({
      nome,
      ...(await page.evaluate(
        async ({ caminho, caminhoDaChave, movel, mornasPedidas }) => {
          const m = (await import(/* @vite-ignore */ caminho)) as typeof import('../src/texturas/meioTermo/moveis') // cast seguro: o caminho é este mesmo módulo servido pelo Vite, e import por string não traz tipo
          const r = (await import(/* @vite-ignore */ caminhoDaChave)) as typeof import('../src/pixi/rasterDosMoveis') // cast seguro: idem, o módulo da chave da imagem
          const chave = r.chaveDoMovel(movel, 3, 1)
          if (chave === null) throw new Error(`${movel.mobilia}: sem desenho com textura`)
          const d = chave.desenho
          const medir = (): number => {
            const t0 = performance.now()
            m.pintarMovel(d, m.escalaDoNivel(3))
            return performance.now() - t0
          }
          const fria = medir()
          const mornas = Array.from({ length: mornasPedidas }, medir).sort((a, b) => a - b)
          return { fria, morna: mornas[Math.floor(mornasPedidas / 2)] }
        },
        { caminho: '/src/texturas/meioTermo/moveis/index.ts', caminhoDaChave: '/src/pixi/rasterDosMoveis.ts', movel: prop, mornasPedidas: MORNAS },
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

// O PAINEL do mestre.
const PROVAS = '../docs/design/objetos/provas'
/** Os 3 prints de layout só são regravados quando pedidos (GERAR_PROVAS_MT5=1): rodar o teste não suja a árvore. */
const GERAR_PROVAS = process.env.GERAR_PROVAS_MT5 === '1'
async function prova(alvo: Page | Locator, nome: string): Promise<void> {
  if (GERAR_PROVAS) await alvo.screenshot({ path: `${PROVAS}/${nome}` })
}
const PASTA_DO_MESTRE = 'C:/appdata/maps/map_pecas'
const NOVAS: readonly [string, string][] = [
  ['Sebe', 'uma sebe'],
  ['Jardineira', 'uma jardineira'],
  ['Tapete longo', 'um tapete longo'],
  ['Arco do portão', 'um arco do portão'],
  ['Placa de seta', 'uma placa de seta'],
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

/** Cada botão cabe inteiro no menu, o nome fica numa linha só e sem corte, e o menu cabe na janela. */
async function conferirQueCabe(page: Page, menu: Locator, botoes: readonly Locator[]): Promise<void> {
  const caixaDoMenu = await menu.boundingBox()
  const janela = page.viewportSize()
  if (caixaDoMenu === null || janela === null) throw new Error('menu sem caixa')
  expect(caixaDoMenu.x).toBeGreaterThanOrEqual(0)
  expect(caixaDoMenu.x + caixaDoMenu.width).toBeLessThanOrEqual(janela.width + 0.5)
  for (const botao of botoes) {
    await botao.scrollIntoViewIfNeeded()
    const nome = (await botao.getAttribute('aria-label')) ?? '?'
    const caixa = await botao.boundingBox()
    if (caixa === null) throw new Error(`${nome}: sem caixa`)
    expect(caixa.x, nome).toBeGreaterThanOrEqual(caixaDoMenu.x - 0.5)
    expect(caixa.x + caixa.width, nome).toBeLessThanOrEqual(caixaDoMenu.x + caixaDoMenu.width + 0.5)
    const { cortado, linhas, tracos } = await botao.evaluate((el, rotulo) => {
      const texto = [...el.querySelectorAll('span')].find((s) => s.textContent === rotulo)
      if (texto === undefined) return { cortado: true, linhas: 0, tracos: 0 }
      const estilo = getComputedStyle(texto)
      const linha = Number.parseFloat(estilo.lineHeight) || Number.parseFloat(estilo.fontSize) * 1.4
      return {
        cortado: texto.scrollWidth > texto.clientWidth + 1 || texto.getBoundingClientRect().right > el.getBoundingClientRect().right + 0.5,
        linhas: Math.round(texto.getBoundingClientRect().height / linha),
        tracos: el.querySelector('.lb-toolvariant-menu__option-icon svg')?.childElementCount ?? 0,
      }
    }, nome)
    expect(cortado, `${nome}: nome cortado`).toBe(false)
    expect(linhas, `${nome}: nome numa linha`).toBe(1)
    expect(tracos, `${nome}: desenho no menu`).toBeGreaterThan(0)
  }
}

test('painel a 1280: Objetos oferece as 5 peças do lote 2 com nome e dica; a sebe troca as folhas pelo material; o atalho arma o Carimbo com a árvore redonda', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await abrirAventuraDeMentira(page, discoDoMestre(), 'Vila', 'PECAS6')
  const menu = await abrirMenuDeObjeto(page)
  for (const [nome, artigo] of NOVAS) {
    const radio = menu.getByRole('radio', { name: nome, exact: true })
    await expect(radio, nome).toBeVisible()
    await expect(radio, nome).toHaveAccessibleDescription(`Clique no mapa para pôr ${artigo}.`)
  }
  const atalho = menu.getByRole('group', { name: 'Atalho' }).getByRole('button', { name: 'Árvore redonda', exact: true })
  await expect(atalho).toBeVisible()
  await expect(atalho).toHaveAccessibleDescription(/Carimbo/)
  await conferirQueCabe(page, menu, [...NOVAS.map(([nome]) => menu.getByRole('radio', { name: nome, exact: true })), atalho])
  await prova(page, 'mt5-painel-1280-menu.png')

  // O atalho: arma a ferramenta Carimbo com a árvore redonda, fecha o menu, e o clique no mapa carimba a árvore.
  await atalho.click()
  await expect(menu).toBeHidden()
  const armado = await page.evaluate(async () => {
    const s = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    return { ferramenta: s.activeTool, carimbo: s.carimboEscolhido }
  })
  expect(armado).toEqual({ ferramenta: 'carimbos', carimbo: 'arvore-redonda' })
  const canvas = page.locator('canvas').first()
  const caixa = await canvas.boundingBox()
  if (caixa === null) throw new Error('canvas sem caixa')
  await page.mouse.click(caixa.x + caixa.width * 0.3, caixa.y + caixa.height * 0.8)
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const { useMapStore } = await import('/src/stores/mapStore.ts')
        return (useMapStore.getState().map.carimbos ?? []).map((c) => c.tipo)
      }),
    )
    .toContain('arvore-redonda')

  await page.evaluate(async () => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.setActiveTool('select')
    store.setSelection([{ kind: 'prop', id: 'n-sebe' }])
  })
  const livro = page.getByRole('complementary', { name: 'Livro do mestre' })
  const aparencia = livro.getByRole('button', { name: /^Aparência/ }).first()
  if ((await aparencia.getAttribute('aria-expanded')) !== 'true') await aparencia.click()
  const folhas = livro.getByRole('radiogroup', { name: 'Folhas', exact: true })
  await expect(folhas).toBeVisible()
  await expect(folhas.getByRole('radio', { name: MATERIAIS.buxo.nome, exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(livro.getByRole('checkbox', { name: 'Preencher' })).toHaveCount(0)
  await folhas.getByRole('radio', { name: MATERIAIS.alfeneiro.nome, exact: true }).click()
  await expect(folhas.getByRole('radio', { name: MATERIAIS.alfeneiro.nome, exact: true })).toHaveAttribute('aria-checked', 'true')
  const gravado = await page.evaluate(async () => {
    const { useMapStore } = await import('/src/stores/mapStore.ts')
    return useMapStore.getState().map.props.find((p) => p.id === 'n-sebe')?.mobiliaCor ?? null
  })
  expect(gravado).toBe(MATERIAIS.alfeneiro.hex)
  await prova(livro, 'mt5-painel-1280-material.png')
})

// A 390 px quem usa é o JOGADOR no celular (o editor do mestre é de mesa): as peças do lote 2 no mapa dele e nada vaza para o lado.
test('jogador no celular (390 px): as peças do lote 2 no mapa, sem a página rolar para o lado', async ({ browser }) => {
  test.setTimeout(120_000)
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await fotoDoJogador(page, '')
  const larguraDaPagina = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(larguraDaPagina).toBeLessThanOrEqual(390)
  await prova(page, 'mt5-jogador-390.png')
  await page.close()
})
