// JORNADA DE USUÁRIO — zona-oculta-sem-buraco (defeito, backlog da simulação
// de 7 jogadores, cenário vila*). Escrita para SAIR VERMELHA no código de hoje.
//
// O DEFEITO: o mestre esconde o alçapão do quarto com uma Zona oculta
// ("Tapete"). Bruno entra no quarto e vê um QUADRADO PRETO exatamente em cima
// do alçapão: o segredo vira um alvo pintado. O pedido: na área visível, a
// zona não revelada tem a aparência do chão (preto só fora da visão), e o
// pacote que chega a Bruno não diz onde está o segredo. "Revelar para
// jogadores": o pino aparece no ponto.
//
// ONDE ISSO MORRE HOJE:
//   - client/src/lib/fogFilter.ts:414 — `concealed = activeConcealRings(map)`:
//     o polígono exato da zona ativa sai para o jogador em
//     client/src/lib/fogFilter.ts:729, e client/src/net/hostSession.ts:506 o
//     põe no snapshot (`concealed: view.concealed`), dentro ou fora da visão;
//   - client/src/player/PlayerView.tsx:506-512 — `redrawConcealed` pinta preto
//     opaco (`fill({ color: 0x000000, alpha: 1 })`) por cima de cada polígono.
//
// COMO ESTE ARQUIVO PROVA (mesmo preparo de task-jornada-painel-do-grupo):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   Bruno é o `player.html` inteiro no próprio contexto de navegador. Só o
//   TRANSPORTE Rust é falsificado (WebSocket roteado ↔ `net:message` /
//   `net_send`). A sessão do host é a do app (`net/hostBridge.ts`).
//   DISCO DE MENTIRA: uma cena com o Quarto do Prefeito (Sala), a ficha de
//   Bruno, o pino "Alcapao sob o tapete" e a zona "Tapete" por cima dele,
//   aberta pelo menu "Carregar Mapa existente".
//   GESTO REAL: clique e toque pelo ponteiro, com pausa antes de soltar. O
//   mestre revela pela ferramenta "Zona oculta" (clique na zona) e pelo
//   interruptor "Revelar para jogadores" do painel.
//   PROVA NA TELA: pixel da tela de Bruno (foto de 5x5 px decodificada num
//   canvas solto — o único `evaluate` do lado do jogador é essa LEITURA) e o
//   cartão do pino visível. O teste 2 também lê os frames que o fio entregou a
//   Bruno (é o que chega na tela dele; qualquer jogador abre o DevTools).
//
// SUPOSIÇÕES:
//   - "aparência do chão" = o pixel no meio da zona tem a mesma cor (±TOLERANCIA
//     por canal) que o chão da mesma Sala logo ao lado, à mesma distância da
//     ficha; nenhuma exigência sobre COMO o conserto desenha;
//   - "o pacote não tem o alçapão" = nenhum frame para Bruno traz o pino nem um
//     polígono `concealed` que caia sobre o Tapete enquanto ele está na visão;
//   - a ferramenta chama "Zona oculta" (botão da barra "Ferramentas do mapa")
//     e o painel dela fica na aba "Mapa" do rail, com o interruptor
//     "Revelar para jogadores" (o de hoje, `components/ConcealZoneControls.tsx`);
//   - câmera do editor ao abrir = `fitCamera(contentBounds, canvas, 40)`
//     (`pixi/PixiCanvas.tsx`, `fitToContent`); a do jogador =
//     `fitCamera(mundo inteiro, canvas, 24)` (`player/PlayerView.tsx:854`).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Bruno entra, vê a própria ficha e o
// chão da Sala; tocar onde está o alçapão não abre nada; o mestre revela a
// zona e o toque no ponto abre o cartão "Alcapao sob o tapete".
// O teste 2 cobra o defeito e TEM de falhar hoje: o meio do Tapete sai preto.
import { test, expect, type Browser, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { ConcealZone, MapData, Pin, Region, Token } from '../src/types/map'

// Máquina carregada: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'TAPE01'
const JOGADOR = 'Bruno'
const FICHA = 'Machado'
const AVENTURA = 'Vila de Pedravale'
const CENA = 'Casa do Prefeito'
const ID_CENA = 'scene_casa'
const PASTA = 'C:/appdata/maps/map_pedravale'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }
/** `FIT_MARGIN` de player/PlayerView.tsx. */
const MARGEM_JOGADOR = 24
/** `FIT_MARGIN` do `fitToContent` de pixi/PixiCanvas.tsx. */
const MARGEM_EDITOR = 40

const COR_CHAO = '#3a3a3a'
const COR_QUARTO = '#1e8c8c'
const COR_FICHA: Rgb = [0xff, 0x5a, 0x00]

type Ponto = { x: number; y: number }
type Rgb = [number, number, number]

/** O quarto inteiro é o `contentBounds` do editor (ficha dentro dele, sem parede). */
const QUARTO = { minX: 1000, minY: 50, maxX: 1900, maxY: 550 }
const POS_FICHA: Ponto = { x: 1200, y: 300 }
/** Tapete: 100x100 no alto do quarto, longe do rótulo (meio da Sala) e dos painéis das duas telas. */
const TAPETE = { minX: 1425, minY: 75, maxX: 1525, maxY: 175 }
const POS_ALCAPAO: Ponto = { x: 1475, y: 150 }
const ALCAPAO = 'Alcapao sob o tapete'
/** Pontos fora das linhas da grade (múltiplos de 50 ± 25). */
const MEIO_DO_TAPETE: Ponto = { x: 1475, y: 125 }
const CANTO_DO_TAPETE: Ponto = { x: 1445, y: 95 }
/** Chão do mesmo quarto logo abaixo e à esquerda do Tapete, à distância parecida da ficha. */
const CHAO_VIZINHO: Ponto[] = [
  { x: 1475, y: 225 },
  { x: 1375, y: 125 },
]
/**
 * Clique do mestre dentro do Tapete, no canto de baixo à direita: longe da
 * cabeça do pino e fora do balão de dica da barra (que cobre o alto do Tapete
 * no editor a 133%, medido na foto de falha de 23/09).
 */
const CLIQUE_NO_TAPETE: Ponto = { x: 1505, y: 160 }
const CABECA_DO_PINO = 31

const TOQUE_MS = 120
const PAUSA_ANTES_DE_SOLTAR_MS = 150
const ESPERA = 6000
const ESPERA_TELA = 15_000
/** Diferença máxima por canal para "mesma cor" (antisserrilhado e compressão nenhuma: PNG). */
const TOLERANCIA = 18
const PIXELS_DE_FICHA = 40

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco
// ───────────────────────────────────────────────────────────────────────────

function retangulo(b: { minX: number; minY: number; maxX: number; maxY: number }): Ponto[] {
  return [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ]
}

function discoDaAventura(): Record<string, string> {
  // O menu "Carregar Mapa" lista o map.json da pasta pelo nome dele (como no molde, o da aventura).
  const base = createEmptyMap('map_casa', AVENTURA, COLUNAS, LINHAS, GRADE)
  const quarto: Region = {
    id: 'r-quarto-prefeito',
    points: retangulo(QUARTO),
    tag: '',
    fillColor: COR_QUARTO,
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Quarto do Prefeito' },
  }
  const ficha: Token = { id: 'tk-bruno', characterId: null, name: FICHA, x: POS_FICHA.x, y: POS_FICHA.y, size: 1, image: null, color: '#ff5a00' }
  const alcapao: Pin = { id: 'p-alcapao', x: POS_ALCAPAO.x, y: POS_ALCAPAO.y, kind: 'exclamacao', description: ALCAPAO, image: null }
  const tapete: ConcealZone = { id: 'z-tapete', name: 'Tapete (alcapao)', revealed: false, points: retangulo(TAPETE) }
  const mapa: MapData = {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: COR_CHAO },
    regions: [quarto],
    tokens: [ficha],
    pins: [alcapao],
    concealZones: [tapete],
  }
  const aventura = { version: 1, id: 'adv_pedravale', name: AVENTURA, startSceneId: ID_CENA, scenes: [{ id: ID_CENA, name: CENA, file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(mapa), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco e transporte de mentira
// (cópia de mestreAbreAventura de task-jornada-painel-do-grupo.spec.ts)
// ───────────────────────────────────────────────────────────────────────────

type EventoTauri = { event: string; id: number; payload: unknown }
type HandlerTauri = (evento: EventoTauri) => void
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __labParaJogador: (clientId: string, texto: string) => void
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: (cb: HandlerTauri) => number
    convertFileSrc: (filePath: string) => string
  }
}

interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Tudo que o mestre mandou para cada jogador, em ordem (o que o fio entregou). */
  enviados: Map<string, string[]>
  fila: Promise<void>
}

async function mestreAbreAventura(mestre: Page): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), enviados: new Map(), fila: Promise.resolve() }
  await mestre.exposeFunction('__labParaJogador', (clientId: string, texto: string) => {
    rede.enviados.get(clientId)?.push(texto)
    rede.sockets.get(clientId)?.send(texto)
  })
  await mestre.addInitScript(
    ({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }) => {
      const alvo = window as unknown as JanelaDoMestre
      const textos: Record<string, string> = { ...arquivos }
      const pastas = new Set<string>()
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
      const existe = (caminho: string): boolean => {
        const c = semBarraFinal(caminho)
        return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
      }
      const callbacks = new Map<number, HandlerTauri>()
      const ouvintes = new Map<number, { event: string; handler: HandlerTauri }>()
      let proximoId = 1
      alvo.isTauri = true
      alvo.__emitTauri = (event, payload) => {
        for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
      }
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        convertFileSrc: (caminho: string) => String(caminho),
        transformCallback: (cb: HandlerTauri) => {
          const id = proximoId
          proximoId += 1
          callbacks.set(id, cb)
          return id
        },
        invoke: async (cmd, args, options) => {
          const a = (args ?? {}) as Record<string, unknown>
          switch (cmd) {
            case 'net_start_room':
              return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
            case 'net_send':
              alvo.__labParaJogador(String(a.clientId), JSON.stringify(a.msg))
              return null
            case 'net_kick':
            case 'net_stop_room':
              return null
            case 'plugin:event|listen': {
              const id = Number(a.handler)
              const cb = callbacks.get(id)
              if (cb) ouvintes.set(id, { event: String(a.event), handler: cb })
              return id
            }
            case 'plugin:event|unlisten':
              ouvintes.delete(Number(a.eventId))
              return null
            case 'plugin:path|resolve_directory':
              return 'C:/appdata'
            case 'plugin:path|join':
              return (a.paths as string[]).join('/')
            case 'plugin:path|dirname': {
              const p = String(a.path)
              return p.slice(0, Math.max(0, p.lastIndexOf('/')))
            }
            case 'plugin:fs|exists':
              return existe(String(a.path))
            case 'plugin:fs|mkdir':
              pastas.add(semBarraFinal(String(a.path)))
              return null
            case 'plugin:fs|write_text_file':
              textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args as Uint8Array)
              return null
            case 'plugin:fs|read_text_file': {
              const caminho = String(a.path)
              if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(textos[caminho]))
            }
            case 'plugin:fs|rename': {
              const de = String(a.oldPath)
              if (de in textos) {
                textos[String(a.newPath)] = textos[de]
                delete textos[de]
              }
              return null
            }
            case 'plugin:fs|read_dir': {
              const prefixo = `${semBarraFinal(String(a.path))}/`
              const filhos = new Map<string, boolean>()
              for (const p of todos()) {
                if (p.indexOf(prefixo) !== 0) continue
                const resto = p.slice(prefixo.length)
                if (resto.length === 0) continue
                const corte = resto.indexOf('/')
                const nome = corte === -1 ? resto : resto.slice(0, corte)
                filhos.set(nome, (filhos.get(nome) ?? false) || corte !== -1 || pastas.has(p))
              }
              return Array.from(filhos.entries()).map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
            }
            default:
              return null
          }
        },
      }
    },
    { arquivos: discoDaAventura(), codigo: CODIGO },
  )

  await mestre.goto('/')
  await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await mestre.waitForSelector('canvas')
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

async function mestreAtribui(mestre: Page, jogador: string, nomeDoToken: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const card = mestre.locator('#lb-rail-panel-room').locator('.lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${nomeDoToken}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDoToken}` }), `${jogador} deveria ficar com ${nomeDoToken}`).toBeVisible()
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  frames: string[]
}

const contextosDeJogador: BrowserContext[] = []
test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Jogador> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
  const frames: string[] = []
  rede.enviados.set(clientId, frames)
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      rede.sockets.set(clientId, ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.fila = rede.fila
          .then(() =>
            rede.mestre.evaluate(
              ({ c, t }) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: c, msg: JSON.parse(t) as unknown }),
              { c: clientId, t: texto },
            ),
          )
          .catch(() => undefined)
      })
    },
  )
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODIGO, { delay: 20 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.pressSequentially(nome, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return { page, frames }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura de pixel e câmeras
// ───────────────────────────────────────────────────────────────────────────

/** O maior canvas da página (o do mapa). */
async function caixaDoMapa(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixas = await page.locator('canvas').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }),
  )
  const maior = caixas.sort((a, b) => b.width * b.height - a.width * a.height)[0]
  if (!maior) throw new Error('sem canvas na tela')
  return maior
}

async function naTelaDoJogador(page: Page, p: Ponto): Promise<Ponto> {
  const caixa = await caixaDoMapa(page)
  const cam = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, { width: caixa.width, height: caixa.height }, MARGEM_JOGADOR)
  return { x: Math.round(caixa.x + p.x * cam.scale + cam.x), y: Math.round(caixa.y + p.y * cam.scale + cam.y) }
}

async function naTelaDoMestre(page: Page, p: Ponto): Promise<Ponto> {
  const caixa = await caixaDoMapa(page)
  const cam = fitCamera(QUARTO, { width: caixa.width, height: caixa.height }, MARGEM_EDITOR)
  return { x: Math.round(caixa.x + p.x * cam.scale + cam.x), y: Math.round(caixa.y + p.y * cam.scale + cam.y) }
}

/** Fotografa um retângulo da tela e devolve os pixels RGBA (só LEITURA: canvas solto). */
async function pixels(page: Page, centro: Ponto, lado: number): Promise<number[]> {
  const meio = Math.floor(lado / 2)
  const foto = await page.screenshot({ clip: { x: centro.x - meio, y: centro.y - meio, width: lado, height: lado } })
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = img.width
    cv.height = img.height
    const g = cv.getContext('2d')
    if (!g) throw new Error('sem contexto 2d')
    g.drawImage(img, 0, 0)
    return Array.from(g.getImageData(0, 0, img.width, img.height).data)
  }, foto.toString('base64'))
}

/** Cor média de 5x5 px em volta de um ponto de mundo da tela do jogador. */
async function corNoJogador(page: Page, mundo: Ponto): Promise<Rgb> {
  const d = await pixels(page, await naTelaDoJogador(page, mundo), 5)
  const soma: Rgb = [0, 0, 0]
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c += 1) soma[c] += d[i + c]
  const n = d.length / 4
  return [Math.round(soma[0] / n), Math.round(soma[1] / n), Math.round(soma[2] / n)]
}

const perto = (a: Rgb, b: Rgb, tol = TOLERANCIA): boolean => a.every((v, i) => Math.abs(v - b[i]) <= tol)
const preto = (c: Rgb): boolean => c[0] + c[1] + c[2] <= 12
const hex = (c: Rgb): string => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`

async function pixelsDaFicha(page: Page): Promise<number> {
  const d = await pixels(page, await naTelaDoJogador(page, POS_FICHA), 30)
  let n = 0
  for (let i = 0; i < d.length; i += 4) if (perto([d[i], d[i + 1], d[i + 2]], COR_FICHA, 40)) n += 1
  return n
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

async function cabecaDoPinoNoJogador(page: Page): Promise<Ponto> {
  return naTelaDoJogador(page, { x: POS_ALCAPAO.x, y: POS_ALCAPAO.y - CABECA_DO_PINO })
}

// ───────────────────────────────────────────────────────────────────────────
// A mesa
// ───────────────────────────────────────────────────────────────────────────

async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<{ rede: Rede; bruno: Jogador }> {
  await mestre.setViewportSize(TELA)
  const rede = await mestreAbreAventura(mestre)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c1', JOGADOR)
  await mestreAtribui(mestre, JOGADOR, FICHA)
  await expect(bruno.page.locator('canvas').first(), 'o mapa de Bruno não apareceu').toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => pixelsDaFicha(bruno.page), { timeout: ESPERA_TELA, message: 'Bruno deveria ver a própria ficha (laranja) no quarto' })
    .toBeGreaterThan(PIXELS_DE_FICHA)
  return { rede, bruno }
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Bruno vê o quarto, o alçapão escondido não abre nada e "Revelar para jogadores" põe o pino no ponto', async ({ browser, page, baseURL }) => {
  // Primeiro teste do arquivo paga o vite frio na máquina carregada (medido: 2,5 min sem sair do atribuir).
  test.setTimeout(240_000)
  const { bruno } = await mesaMontada(browser, page, baseURL ?? '')

  // A leitura de pixel enxerga o chão do quarto (não preto) nos dois vizinhos do Tapete.
  for (const p of CHAO_VIZINHO) {
    const cor = await corNoJogador(bruno.page, p)
    expect(preto(cor), `o chão do quarto em (${p.x},${p.y}) deveria estar visível para Bruno, veio ${hex(cor)}`).toBe(false)
  }

  // O alçapão escondido: tocar no ponto não abre cartão nenhum.
  const cartao = bruno.page.getByRole('dialog').filter({ hasText: ALCAPAO })
  await tocar(bruno.page, await cabecaDoPinoNoJogador(bruno.page))
  await bruno.page.waitForTimeout(1500)
  await expect(cartao, 'com o Tapete oculto, tocar no alçapão não pode abrir o cartão').toHaveCount(0)

  // O mestre revela o Tapete: ferramenta Zona oculta, clique na zona, interruptor do painel.
  await page.getByRole('tab', { name: 'Mapa' }).click()
  await page.getByRole('button', { name: 'Zona oculta', exact: true }).click()
  const alvo = await naTelaDoMestre(page, CLIQUE_NO_TAPETE)
  await page.mouse.move(alvo.x, alvo.y)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  const revelar = page.getByRole('checkbox', { name: 'Revelar para jogadores' })
  await expect(revelar, 'clicar no Tapete com a ferramenta Zona oculta deveria abrir o painel da zona').toBeAttached({ timeout: ESPERA })
  await page.getByText('Revelar para jogadores', { exact: true }).click()
  await expect(revelar).toBeChecked()

  // O pino aparece no ponto: o toque de Bruno na cabeça dele abre o cartão.
  await expect
    .poll(
      async () => {
        await tocar(bruno.page, await cabecaDoPinoNoJogador(bruno.page))
        return cartao.isVisible()
      },
      { timeout: ESPERA_TELA, message: `revelado, o toque no ponto do alçapão deveria abrir o cartão "${ALCAPAO}"` },
    )
    .toBe(true)
})

test('2. Tapete oculto no campo de visão: Bruno vê chão contínuo, sem quadrado preto, e o pacote não diz onde está o segredo', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { bruno } = await mesaMontada(browser, page, baseURL ?? '')
  await bruno.page.waitForTimeout(400)

  const chao = await corNoJogador(bruno.page, CHAO_VIZINHO[0])
  expect(preto(chao), `o chão do quarto ao lado do Tapete deveria estar visível, veio ${hex(chao)}`).toBe(false)

  // NA TELA: o meio e o canto do Tapete têm a cor do chão do quarto ao lado.
  for (const p of [MEIO_DO_TAPETE, CANTO_DO_TAPETE]) {
    const cor = await corNoJogador(bruno.page, p)
    expect
      .soft(perto(cor, chao), `no Tapete (${p.x},${p.y}) Bruno deveria ver o chão do quarto (${hex(chao)}), viu ${hex(cor)}${preto(cor) ? ' — um quadrado PRETO em cima do alçapão' : ''}`)
      .toBe(true)
  }

  // NO FIO: nada do que chegou a Bruno traz o alçapão nem um polígono em cima do Tapete.
  const sobreOTapete = (poligono: unknown): boolean =>
    Array.isArray(poligono) &&
    poligono.some((p: { x?: unknown; y?: unknown }) => typeof p?.x === 'number' && typeof p?.y === 'number' && p.x >= TAPETE.minX && p.x <= TAPETE.maxX && p.y >= TAPETE.minY && p.y <= TAPETE.maxY)
  const vazados = bruno.frames.flatMap((texto) => {
    const achados: string[] = []
    if (texto.includes(ALCAPAO)) achados.push(`pino "${ALCAPAO}"`)
    if (texto.includes('Tapete')) achados.push('nome da zona "Tapete"')
    try {
      const msg = JSON.parse(texto) as { type?: string; concealed?: unknown }
      if (Array.isArray(msg.concealed) && msg.concealed.some(sobreOTapete)) achados.push(`${msg.type ?? '?'}.concealed = ${JSON.stringify(msg.concealed)}`)
    } catch {
      // frame que não é JSON não carrega polígono
    }
    return achados
  })
  expect
    .soft(vazados, 'o que chegou a Bruno não pode marcar o lugar do alçapão (pino, nome da zona ou polígono `concealed` sobre o Tapete)')
    .toEqual([])
  expect(bruno.frames.length, 'Bruno deveria ter recebido o mapa pelo fio').toBeGreaterThan(0)
})
