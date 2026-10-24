// TELHADO DE PALHA (fatia MT6 do Meio-Termo): a palha é o 3º modelo do
// telhado e não passa pela chave de obra (modelo novo). Este spec prova a
// costura que os testes de unidade não veem:
// 1. JOGADOR (390 px): o mapa sai do ARQUIVO (serializeMap/deserializeMap),
//    passa pelo recorte REAL do jogador (filterMapForPlayer, com a planta
//    inteira lembrada, como em task-camadas-painel.spec.ts) e pela rede (JSON
//    no WebSocket, depois do welcome); a sala de palha é pintada como palha.
//    Controles: a mesma sala como TELHA e como MADEIRA na MESMA cor sai
//    diferente na região dela, e a sala vizinha (telha barro nas três fotos)
//    sai igual.
// 2. TEMPO no Chromium: a palha a 3x (fria = a primeira da página, morna =
//    mediana de 9, intercalada com telha e madeira) e na escala do app ao lado
//    da madeira; e na CPU 4x (CDP), a textura da sala grande pelo renderer de
//    verdade: a palha sai em fatias, sem tarefa longa de 200 ms.
// 3. PAINEL do mestre a 1280: "Modelo do telhado" oferece Palha (com a
//    miniatura e o nome inteiro à vista), o clique grava 'palha' no mapa, as
//    cores passam a ser as da palha e salvar e reabrir mantém a palha.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { addToken, createEmptyMap, setShowGrid } from '../src/lib/mapFactory'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { filterMapForPlayer, planOfWholeMap } from '../src/lib/fogFilter'
import { deserializeMap, serializeMap } from '../src/lib/mapFile'
import { PALETA_DO_TETO, type ModeloDoTeto } from '../src/lib/telhado/paletas'
import type { MapData, Region, RegionPoint } from '../src/types/map'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

const GRADE = 64
const COLUNAS = 8
const LINHAS = 10
const FICHA = 'ficha-ana'
const PALHA = PALETA_DO_TETO.palha[0].hex
const BARRO = PALETA_DO_TETO.telhas[0].hex
const CARVALHO = PALETA_DO_TETO.madeira[0].hex
const MARGEM_DO_ENQUADRAMENTO = 24
/** Diferença de luz (0-255) a partir da qual o pixel "mudou" entre as duas fotos. */
const MUDOU = 6
/** Fração mínima da sala A que muda de telha (ou madeira) para palha na mesma cor. */
const FRACAO_MINIMA_DA_PALHA = 0.3
/** Teto da mudança na sala B (igual nas fotos): ruído de abertura. */
const FRACAO_MAXIMA_DE_RUIDO = 0.01

test.use({ trace: 'off', video: 'off', viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

const PROVAS = '../docs/design/objetos/provas'
/** Os prints de layout só são regravados quando pedidos (GERAR_PROVAS_MT6=1): rodar o teste não suja a árvore. */
const GERAR_PROVAS = process.env.GERAR_PROVAS_MT6 === '1'

type Caixa = { x0: number; y0: number; x1: number; y1: number }
const SALA_A: Caixa = { x0: 64, y0: 64, x1: 448, y1: 256 }
const SALA_B: Caixa = { x0: 64, y0: 384, x1: 448, y1: 576 }

function anel(c: Caixa): RegionPoint[] {
  return [{ x: c.x0, y: c.y0 }, { x: c.x1, y: c.y0 }, { x: c.x1, y: c.y1 }, { x: c.x0, y: c.y1 }]
}

function sala(id: string, c: Caixa, modelo: ModeloDoTeto | undefined, cor: string | undefined): Region {
  return {
    id,
    points: anel(c),
    tag: '',
    fillColor: '#6b5a48',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: id, roof: true, ...(modelo === undefined ? {} : { modeloDoTeto: modelo }), ...(cor === undefined ? {} : { corDoTeto: cor }) },
  }
}

/** A sala A no modelo pedido (cor da palha), a B em telha barro; a Ana fora das duas. */
function mapaDasCasas(modeloDeA: ModeloDoTeto): MapData {
  let map = setShowGrid(createEmptyMap('meio-termo-palha', 'Vila', COLUNAS, LINHAS, GRADE), false)
  map = { ...map, regions: [sala('casa-a', SALA_A, modeloDeA, PALHA), sala('casa-b', SALA_B, undefined, undefined)] }
  return addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: 256, y: 320, size: 1, image: null })
}

/**
 * O que o host manda: o mapa reaberto do ARQUIVO, recortado para a Ana pelo
 * `filterMapForPlayer` de verdade (a ficha dela atribuída e a planta inteira
 * lembrada, o método de `task-camadas-painel.spec.ts`), mandado DEPOIS do
 * `welcome`; o JSON do WebSocket é a rede. Antes o spec mandava o mapa
 * inteiro: o recorte sem a planta lembrada deixava o jogador em "Aguardando o
 * mestre atribuir um personagem".
 */
function hostCom(modeloDeA: ModeloDoTeto): (ws: WebSocketRoute) => void {
  const doArquivo = deserializeMap(serializeMap(mapaDasCasas(modeloDeA)))
  const mundo = COLUNAS * GRADE
  const recorte = filterMapForPlayer(doArquivo, 'p-ana', { 'p-ana': [FICHA] }, mundo, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(doArquivo)).map
  const salaA = recorte.regions.find((r) => r.id === 'casa-a')?.room
  if (salaA?.modeloDoTeto !== modeloDeA || salaA.corDoTeto !== PALHA || salaA.roof !== true) throw new Error(`o recorte do jogador perdeu o telhado: ${JSON.stringify(salaA)}`)
  const explored = encodeExploration(createExploration(doArquivo))
  const snapshot = JSON.stringify({ type: 'snapshot', rev: 1, map: recorte, vision: [anel({ x0: 0, y0: 0, x1: COLUNAS * GRADE, y1: LINHAS * GRADE })], explored, ownTokens: [FICHA], concealed: [], sceneName: doArquivo.name })
  return (ws) => {
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
      ws.send(snapshot)
    })
  }
}

/** Foto do canvas do jogador quando a tela para. */
async function fotoDoJogador(page: Page, modeloDeA: ModeloDoTeto): Promise<string> {
  await page.routeWebSocket((url) => url.pathname === '/ws', hostCom(modeloDeA))
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill('PALHA6')
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Aguardando o mestre atribuir um personagem.')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
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

interface MedidaDaSala {
  readonly fracaoQueMuda: number
  readonly media: readonly [number, number, number]
}

/** Por sala (miolo, longe do beiral): fração dos pixels cuja luz muda entre as fotos e a cor média da primeira. */
async function medirSalas(page: Page, a: string, b: string, caixas: readonly Caixa[]): Promise<MedidaDaSala[]> {
  const mundo = { w: COLUNAS * GRADE, h: LINHAS * GRADE }
  return page.evaluate(
    async ([pngA, pngB, salas, tamanho, margem, mudou]) => {
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
      const luz = (d: Uint8ClampedArray, o: number): number => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]
      return salas.map((c) => {
        const i0 = Math.max(0, Math.floor(telaX(c.x0 + 16)))
        const i1 = Math.min(x.width, Math.ceil(telaX(c.x1 - 16)))
        const j0 = Math.max(0, Math.floor(telaY(c.y0 + 16)))
        const j1 = Math.min(x.height, Math.ceil(telaY(c.y1 - 16)))
        let muda = 0
        const soma = [0, 0, 0]
        let n = 0
        for (let j = j0; j < j1; j += 1) {
          for (let i = i0; i < i1; i += 1) {
            const o = (j * x.width + i) * 4
            if (Math.abs(luz(x.data, o) - luz(y.data, o)) > mudou) muda += 1
            for (let k = 0; k < 3; k += 1) soma[k] += x.data[o + k]
            n += 1
          }
        }
        return { fracaoQueMuda: muda / Math.max(1, n), media: [soma[0] / n, soma[1] / n, soma[2] / n] as const }
      })
    },
    [a, b, [...caixas], mundo, MARGEM_DO_ENQUADRAMENTO, MUDOU] as const,
  )
}

test('jogador no celular (390 px): a palha sai do arquivo, passa pelo recorte e pela rede e é pintada como palha', async ({ browser }) => {
  test.setTimeout(180_000)
  const viewport = { width: 390, height: 844 }
  const [comPalha, comTelha, comMadeira] = await Promise.all([browser.newPage({ viewport }), browser.newPage({ viewport }), browser.newPage({ viewport })])
  const [fotoPalha, fotoTelha, fotoMadeira] = await Promise.all([fotoDoJogador(comPalha, 'palha'), fotoDoJogador(comTelha, 'telhas'), fotoDoJogador(comMadeira, 'madeira')])
  const [a, b] = await medirSalas(comPalha, fotoPalha, fotoTelha, [SALA_A, SALA_B])
  const [aMadeira, bMadeira] = await medirSalas(comPalha, fotoPalha, fotoMadeira, [SALA_A, SALA_B])
  const hex = (m: readonly [number, number, number]): string => `#${m.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
  console.log(
    `[medida] 390 px: sala A muda ${a.fracaoQueMuda.toFixed(3)} de telha e ${aMadeira.fracaoQueMuda.toFixed(3)} de madeira para palha (média ${hex(a.media)}, a palha é ${PALHA}); ` +
      `sala B (controle) muda ${b.fracaoQueMuda.toFixed(3)} e ${bMadeira.fracaoQueMuda.toFixed(3)}`,
  )
  expect(a.fracaoQueMuda, 'a sala A tem de sair diferente da telha na mesma cor').toBeGreaterThanOrEqual(FRACAO_MINIMA_DA_PALHA)
  expect(aMadeira.fracaoQueMuda, 'a sala A tem de sair diferente da madeira na mesma cor').toBeGreaterThanOrEqual(FRACAO_MINIMA_DA_PALHA)
  expect(b.fracaoQueMuda, 'a sala B (telha nas fotos) tem de sair igual').toBeLessThan(FRACAO_MAXIMA_DE_RUIDO)
  expect(bMadeira.fracaoQueMuda, 'a sala B (telha nas fotos) tem de sair igual').toBeLessThan(FRACAO_MAXIMA_DE_RUIDO)
  // Lê como palha: o jogador escurece o telhado (luz da cena), mas o matiz fica o da palha. A proporção
  // de cada canal na soma fica a menos de 0,02 da proporção da palha, e a luz entre 60% e 110% dela.
  const alvo = [1, 3, 5].map((k) => Number.parseInt(PALHA.slice(k, k + 2), 16))
  const somaAlvo = alvo[0] + alvo[1] + alvo[2]
  const somaMedia = a.media[0] + a.media[1] + a.media[2]
  for (let k = 0; k < 3; k += 1) expect(Math.abs(a.media[k] / somaMedia - alvo[k] / somaAlvo), `proporção do canal ${k} da média ${hex(a.media)}`).toBeLessThan(0.02)
  expect(somaMedia / somaAlvo, `luz da média ${hex(a.media)}`).toBeGreaterThan(0.6)
  expect(somaMedia / somaAlvo, `luz da média ${hex(a.media)}`).toBeLessThan(1.1)
  const larguraDaPagina = await comPalha.evaluate(() => document.documentElement.scrollWidth)
  expect(larguraDaPagina).toBeLessThanOrEqual(390)
  if (GERAR_PROVAS) await comPalha.screenshot({ path: `${PROVAS}/mt6-jogador-390.png` })
  await Promise.all([comPalha.close(), comTelha.close(), comMadeira.close()])
})

const TETO_MORNO_MS = 50
const TETO_FRIO_MS = 100
const MORNAS = 9
/** A palha grande na escala do app custa no máximo isto vezes a madeira (o pior caso de antes da palha). */
const PALHA_SOBRE_MADEIRA = 1.15
/** Regra da casa: nenhuma tarefa de 200 ms ou mais. */
const TETO_DA_TAREFA_LONGA_MS = 200

test('tempo no Chromium: a palha a 3x (fria e mediana morna de 9) e na escala do app, intercalada com telha e madeira', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/player.html')
  const r = await page.evaluate(
    async ({ caminho, caminhoDoRenderer, grade, mornas, cores }) => {
      const t = (await import(/* @vite-ignore */ caminho)) as typeof import('../src/texturas/telhado') // cast seguro: o caminho é este mesmo módulo servido pelo Vite, e import por string não traz tipo
      const r = (await import(/* @vite-ignore */ caminhoDoRenderer)) as typeof import('../src/pixi/telhadosRenderer') // cast seguro: idem, a escala que o app usa
      const sala = (c: number, l: number) => [{ x: 0, y: 0 }, { x: c * grade, y: 0 }, { x: c * grade, y: l * grade }, { x: 0, y: l * grade }]
      const pequena = sala(6, 4)
      const grande = sala(20, 14)
      const kApp = r.escalaDaTexturaDoTelhado(grande)
      const medir = (pontos: { x: number; y: number }[], modelo: 'palha' | 'telhas' | 'madeira', escala: number): number => {
        const t0 = performance.now()
        t.pintarTelhado(pontos, modelo, cores[modelo], escala)
        return performance.now() - t0
      }
      const fria = medir(pequena, 'palha', 3)
      const casos = [
        { nome: 'palha 6x4 a 3x', pontos: pequena, modelo: 'palha', escala: 3 },
        { nome: 'telha 6x4 a 3x', pontos: pequena, modelo: 'telhas', escala: 3 },
        { nome: 'madeira 6x4 a 3x', pontos: pequena, modelo: 'madeira', escala: 3 },
        { nome: 'palha 20x14 na escala do app', pontos: grande, modelo: 'palha', escala: kApp },
        { nome: 'telha 20x14 na escala do app', pontos: grande, modelo: 'telhas', escala: kApp },
        { nome: 'madeira 20x14 na escala do app', pontos: grande, modelo: 'madeira', escala: kApp },
      ] as const
      for (const c of casos) medir([...c.pontos], c.modelo, c.escala)
      // Intercaladas: a carga da máquina pesa igual em todos os modelos.
      const tempos = casos.map(() => [] as number[])
      for (let i = 0; i < mornas; i += 1) casos.forEach((c, j) => tempos[j].push(medir([...c.pontos], c.modelo, c.escala)))
      const mediana = (l: number[]) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)]
      return { fria, kApp, mornas: casos.map((c, j) => ({ nome: c.nome, morna: mediana(tempos[j]) })) }
    },
    { caminho: '/src/texturas/telhado.ts', caminhoDoRenderer: '/src/pixi/telhadosRenderer.ts', grade: GRADE, mornas: MORNAS, cores: { palha: PALHA, telhas: BARRO, madeira: CARVALHO } },
  )
  console.log(`[medida] Chromium, palha 6x4 a 3x fria (primeira da página) ${r.fria.toFixed(1)} ms; medianas mornas de ${MORNAS} (escala do app ${r.kApp.toFixed(2)}x): ${r.mornas.map((m) => `${m.nome} ${m.morna.toFixed(1)}`).join('; ')} ms`)
  const [palha6x4, , , palhaGrande, , madeiraGrande] = r.mornas
  expect(r.fria, 'palha 6x4 a 3x, fria').toBeLessThan(TETO_FRIO_MS)
  expect(palha6x4.morna, 'palha 6x4 a 3x, morna').toBeLessThanOrEqual(TETO_MORNO_MS)
  expect(palhaGrande.morna, `palha 20x14 na escala do app contra a madeira (${madeiraGrande.morna.toFixed(1)} ms)`).toBeLessThanOrEqual(madeiraGrande.morna * PALHA_SOBRE_MADEIRA)
})

test('CPU 4x: a textura da palha de 20x14 casas sai pelo renderer em fatias, sem tarefa longa de 200 ms', async ({ browser }) => {
  test.setTimeout(240_000)
  const medidas: { modelo: ModeloDoTeto; maior: number; longas: number; totalMs: number }[] = []
  for (const modelo of ['palha', 'telhas', 'madeira'] as const) {
    const page = await browser.newPage()
    await page.goto('/player.html')
    // Os módulos carregam antes do freio: a medida é da pintura, não do import.
    await page.evaluate(async (caminho) => void (await import(/* @vite-ignore */ caminho)), '/src/pixi/telhadosRenderer.ts')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    const r = await page.evaluate(
      async ({ caminho, modelo, cor, w, h }) => {
        const mod = (await import(/* @vite-ignore */ caminho)) as typeof import('../src/pixi/telhadosRenderer') // cast seguro: o módulo do renderer servido pelo Vite
        const longas: number[] = []
        const observador = new PerformanceObserver((lista) => {
          for (const e of lista.getEntries()) longas.push(e.duration)
        })
        observador.observe({ type: 'longtask' })
        const renderer = mod.createTelhadosRenderer()
        // Sem palco: a camada só recebe o telhado (o teste mede a pintura e a subida para o canvas).
        const camada = { addChild: () => undefined } as unknown as import('../src/pixi/telhadosRenderer').TelhadoParaDesenhar['camada'] // cast seguro: o renderer só chama addChild na camada
        const t0 = performance.now()
        renderer.desenhar([{ id: 'grande', points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], modelo, cor, camada }], 'mapa-4x')
        while (renderer.pintadas() < 1) await new Promise((fim) => setTimeout(fim, 16))
        const totalMs = performance.now() - t0
        await new Promise((fim) => setTimeout(fim, 200))
        observador.disconnect()
        renderer.destruir()
        return { maior: longas.length === 0 ? 0 : Math.max(...longas), longas: longas.length, totalMs }
      },
      { caminho: '/src/pixi/telhadosRenderer.ts', modelo, cor: modelo === 'palha' ? PALHA : modelo === 'telhas' ? BARRO : CARVALHO, w: 20 * GRADE, h: 14 * GRADE },
    )
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    medidas.push({ modelo, ...r })
    await page.close()
  }
  console.log(`[medida] CPU 4x, sala 20x14 casas na escala do app, pelo renderer: ${medidas.map((m) => `${m.modelo}: maior tarefa longa ${m.maior.toFixed(0)} ms (${m.longas} longas), pronta em ${m.totalMs.toFixed(0)} ms`).join('; ')}`)
  const palha = medidas[0]
  expect(palha.maior, 'a maior tarefa longa da palha na CPU 4x').toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
})

const PASTA_DO_MESTRE = 'C:/appdata/maps/map_palha'

function discoDoMestre(): Record<string, string> {
  let map = createEmptyMap('meio-termo-palha-mestre', 'Vila', 16, 12, GRADE)
  map = { ...map, regions: [sala('casa-a', { x0: 256, y0: 192, x1: 640, y1: 448 }, undefined, undefined)] }
  const aventura = { version: 1, id: 'adv_palha', name: 'Vila', startSceneId: 'scene_palha', scenes: [{ id: 'scene_palha', name: 'Vila', file: 'map.json' }] }
  return { [`${PASTA_DO_MESTRE}/map.json`]: serializeMap(map), [`${PASTA_DO_MESTRE}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

test('painel a 1280: Palha no Modelo do telhado, com miniatura; o clique grava palha, as cores viram as da palha e salvar e reabrir mantém', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await abrirAventuraDeMentira(page, discoDoMestre(), 'Vila', 'PALHA7')
  await page.evaluate(async () => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.setActiveTool('select')
    store.setSelection([{ kind: 'region', id: 'casa-a' }])
  })
  const modelos = page.getByRole('radiogroup', { name: 'Modelo do telhado' })
  await expect(modelos).toBeVisible()
  await expect(modelos.getByRole('radio')).toHaveCount(3)
  const palha = modelos.getByRole('radio', { name: 'Palha' })
  await expect(palha).toHaveAttribute('aria-checked', 'false')
  // A miniatura da palha é o desenho de verdade: o canvas dela tem pixels.
  const pintada = await palha.locator('canvas').evaluate((c) => {
    if (!(c instanceof HTMLCanvasElement)) return 0
    const g = c.getContext('2d')
    if (g === null) return 0
    const d = g.getImageData(0, 0, c.width, c.height).data
    let cheios = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] === 255) cheios += 1
    return cheios / (c.width * c.height)
  })
  expect(pintada, 'miniatura da palha pintada').toBeGreaterThan(0.4)
  // As 3 opções cabem no grupo e o NOME de cada uma aparece inteiro: o texto não passa da própria caixa
  // (scrollWidth) nem da caixa do botão. Só a caixa do botão passava com "Madei" cortado na foto.
  const grupo = await modelos.boundingBox()
  if (grupo === null) throw new Error('grupo sem caixa')
  for (const radio of await modelos.getByRole('radio').all()) {
    const caixa = await radio.boundingBox()
    const nome = radio.locator('span')
    const caixaDoNome = await nome.boundingBox()
    if (caixa === null || caixaDoNome === null) throw new Error('opção sem caixa')
    const rotulo = (await nome.textContent()) ?? ''
    expect(caixa.x + caixa.width, rotulo).toBeLessThanOrEqual(grupo.x + grupo.width + 0.5)
    const medida = await nome.evaluate((el) => ({ rolagem: el.scrollWidth, visivel: el.clientWidth }))
    expect(medida.rolagem, `"${rotulo}" cortado`).toBeLessThanOrEqual(medida.visivel)
    expect(caixaDoNome.x, `"${rotulo}" sai pela esquerda do botão`).toBeGreaterThanOrEqual(caixa.x - 0.5)
    expect(caixaDoNome.x + caixaDoNome.width, `"${rotulo}" sai pela direita do botão`).toBeLessThanOrEqual(caixa.x + caixa.width + 0.5)
    expect(caixaDoNome.y + caixaDoNome.height, `"${rotulo}" sai por baixo do botão`).toBeLessThanOrEqual(caixa.y + caixa.height + 0.5)
  }

  await palha.click()
  await expect(palha).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radiogroup', { name: 'Cor do telhado' }).getByRole('radio', { name: 'Palha dourada', exact: true })).toHaveAttribute('aria-checked', 'true')
  const gravado = await page.evaluate(async () => {
    const { useMapStore } = await import('/src/stores/mapStore.ts')
    const { deserializeMap, serializeMap } = await import('/src/lib/mapFile.ts')
    const map = useMapStore.getState().map
    const reaberto = deserializeMap(serializeMap(map))
    const room = (m: typeof map) => m.regions.find((r) => r.id === 'casa-a')?.room
    return { agora: room(map)?.modeloDoTeto ?? null, reaberto: room(reaberto)?.modeloDoTeto ?? null }
  })
  expect(gravado).toEqual({ agora: 'palha', reaberto: 'palha' })
  await page.getByRole('radiogroup', { name: 'Cor do telhado' }).getByRole('radio', { name: 'Feno', exact: true }).click()
  const cor = await page.evaluate(async () => {
    const { useMapStore } = await import('/src/stores/mapStore.ts')
    return useMapStore.getState().map.regions.find((r) => r.id === 'casa-a')?.room?.corDoTeto ?? null
  })
  expect(cor).toBe(PALETA_DO_TETO.palha[2].hex)
  if (GERAR_PROVAS) await page.getByRole('complementary', { name: 'Livro do mestre' }).screenshot({ path: `${PROVAS}/mt6-painel-1280.png` })
})
