// MAPA DE LUZ (Luz L4b): a tinta do período e a luz quente, no editor e na
// tela do jogador, numa vila externa com 20 luzes.
//
// COMO PROVA: o mestre é o app inteiro em modo Tauri com o disco de mentira e
// a Ana é o `player.html` inteiro (mesmo transporte de mentira de
// task-jogador-periodo-da-cena.spec.ts). Gestos reais: o rádio Dia/Tarde/Noite
// e o "Ver como jogador" do painel Período, arrasto e roda do mouse no mapa
// da Ana. O brilho é lido dos pixels da tela (luminância Rec. 709, 0 a 255),
// como as medidas do protótipo aprovado (docs/design/luz/README.md).
//
// Com LAB_FOLHA_L4B=1 grava a folha de contato em
// docs/design/luz/provas/l4b-folha-de-contato.png (fora disso, nada é escrito).
import { test, expect, type Browser, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { FloorPiece, Light, MapData, Region, Token, Wall } from '../src/types/map'

test.use({ trace: 'off', video: 'off' })

const CODIGO = 'LUZ4B1'
const AVENTURA = 'Vila do Lampiao'
const PASTA = 'C:/appdata/maps/map_vila'
const TELA = { width: 1280, height: 800 }
const GRADE = 50
const ASSENTAR_MS = 700
/** Tetos do aceite da L4b (plano, seção L4b). */
const QUADRO_P95_MS = 20
const REFAZER_MS = 8
const TAREFA_LONGA_MS = 200

/** Onde o gesto de pan começa na tela da Ana: longe da ficha dela (centrada), senão o arrasto pega a ficha. */
const LONGE_DA_FICHA = { x: TELA.width / 2 + 220, y: TELA.height / 2 + 160 }

const LAMPIAO = { color: '#ffba7b', intensity: 0.85, radius: 3.5 * GRADE }
const FOGUEIRA = { color: '#ffba7b', intensity: 0.95, radius: 5 * GRADE }

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, x: number, y: number, w: number, h: number, roof: boolean): Region {
  return {
    id,
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    tag: '',
    fillColor: '#333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: `Casa ${id}`, roof },
  }
}

function chao(id: string, cx: number, cy: number, w: number, h: number): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {} }
}

function luz(id: string, x: number, y: number, tipo: typeof LAMPIAO): Light {
  return { id, x, y, ...tipo }
}

/** Casa de 400 x 300 com porta no meio da parede sul e lampião no canto noroeste de dentro. */
function casa(n: number, x: number, y: number, telhado: boolean) {
  const id = `c${n}`
  const meio = x + 200
  return {
    walls: [
      parede(`${id}-n`, x, y, x + 400, y),
      parede(`${id}-l`, x + 400, y, x + 400, y + 300),
      parede(`${id}-s1`, x + 400, y + 300, meio + 25, y + 300),
      parede(`${id}-porta`, meio + 25, y + 300, meio - 25, y + 300, { door: { open: false, locked: false, kind: 'normal' } }),
      parede(`${id}-s2`, meio - 25, y + 300, x, y + 300),
      parede(`${id}-o`, x, y + 300, x, y),
    ],
    region: sala(id, x, y, 400, 300, telhado),
    floor: chao(`${id}-chao`, x + 200, y + 150, 400, 300),
    light: luz(`${id}-lampiao`, x + 80, y + 80, LAMPIAO),
  }
}

/** Pontos de prova, em px de mundo (com o zoom em 100% e a câmera na origem, são px da tela do editor). */
const PROVA = {
  /** Poste a leste da casa 0 (sem telhado): o claro na frente da parede e o escuro atrás dela. */
  posteDaParede: { x: 610, y: 300 },
  frenteDaParede: { x: 580, y: 300 },
  atrasDaParede: { x: 515, y: 300 },
  /** Poste ao sul da casa 1 (com telhado): o chão sob o poste e o telhado logo depois da parede. */
  posteDoTelhado: { x: 710, y: 510 },
  chaoSobOPoste: { x: 710, y: 540 },
  telhado: { x: 710, y: 410 },
  fogueira: { x: 420, y: 590 },
  ana: { x: 330, y: 590 },
}

function vila(): MapData {
  const base = createEmptyMap('map_vila', AVENTURA, 36, 22, GRADE)
  const casas = [casa(0, 150, 150, false), casa(1, 650, 150, true), casa(2, 1150, 150, false), casa(3, 150, 700, true), casa(4, 650, 700, false), casa(5, 1150, 700, true)]
  const postes = [100, 260, 420, 580, 740, 900, 1060, 1220, 1380, 1540, 1700].map((x, i) => luz(`poste${i}`, x, 1060, LAMPIAO))
  const ana: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: PROVA.ana.x, y: PROVA.ana.y, size: 1, image: null }
  const lights = [
    ...casas.map((c) => c.light),
    luz('fogueira', PROVA.fogueira.x, PROVA.fogueira.y, FOGUEIRA),
    luz('poste-parede', PROVA.posteDaParede.x, PROVA.posteDaParede.y, LAMPIAO),
    luz('poste-telhado', PROVA.posteDoTelhado.x, PROVA.posteDoTelhado.y, LAMPIAO),
    ...postes,
  ]
  return {
    ...base,
    externa: true,
    walls: casas.flatMap((c) => c.walls),
    regions: casas.map((c) => c.region),
    floor: [chao('rua', 900, 550, 1800, 1100), ...casas.map((c) => c.floor)],
    tokens: [ana],
    lights,
  }
}

function disco(): Record<string, string> {
  const aventura = { version: 1, id: 'adv_vila', name: AVENTURA, startSceneId: 'scene_vila', scenes: [{ id: 'scene_vila', name: AVENTURA, file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(vila()), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

type HandlerTauri = (evento: { event: string; id: number; payload: unknown }) => void
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __labParaJogador: (clientId: string, texto: string) => void
  __TAURI_INTERNALS__: unknown
}

interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  fila: Promise<void>
}

async function mestreAbreASala(mestre: Page): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), fila: Promise.resolve() }
  await mestre.exposeFunction('__labParaJogador', (clientId: string, texto: string) => {
    rede.sockets.get(clientId)?.send(texto)
  })
  await mestre.addInitScript(
    ({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }) => {
      const alvo = window as unknown as JanelaDoMestre // a janela de teste ganha o Tauri de mentira: os campos são escritos logo abaixo
      const textos: Record<string, string> = { ...arquivos }
      const pastas = new Set<string>()
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
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
        invoke: async (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => {
          const a = (args ?? {}) as Record<string, unknown> // o invoke do Tauri manda objeto de argumentos; cada campo é convertido com String/Number antes do uso
          switch (cmd) {
            case 'net_start_room':
              return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
            case 'net_send':
              alvo.__labParaJogador(String(a.clientId), JSON.stringify(a.msg))
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
              return (a.paths as string[]).join('/') // o plugin path do Tauri manda `paths` como lista de texto
            case 'plugin:path|dirname': {
              const p = String(a.path)
              return p.slice(0, Math.max(0, p.lastIndexOf('/')))
            }
            case 'plugin:fs|exists': {
              const c = semBarraFinal(String(a.path))
              return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
            }
            case 'plugin:fs|mkdir':
              pastas.add(semBarraFinal(String(a.path)))
              return null
            case 'plugin:fs|write_text_file':
              textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args as Uint8Array) // o plugin fs grava o texto como bytes no corpo
              return null
            case 'plugin:fs|read_text_file': {
              const caminho = String(a.path)
              if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(textos[caminho]))
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
    { arquivos: disco(), codigo: CODIGO },
  )
  await mestre.goto('/')
  await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await mestre.waitForSelector('canvas')
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

const contextos: BrowserContext[] = []
test.afterEach(async () => {
  await Promise.all(contextos.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Page> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextos.push(contexto)
  const page = await contexto.newPage()
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      rede.sockets.set(clientId, ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.fila = rede.fila
          // `as`: a janela do mestre ganhou `__emitTauri` no init script acima; a mensagem vai crua, como o Rust a entregaria.
          .then(() => rede.mestre.evaluate(({ c, t }) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: c, msg: JSON.parse(t) as unknown }), { c: clientId, t: texto }))
          .catch(() => undefined)
      })
    },
  )
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODIGO)
  await page.getByLabel('Seu nome').fill(nome)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return page
}

interface Ponto {
  x: number
  y: number
}

/** Luminância média (Rec. 709, 0 a 255) num quadrado de 9 px em volta de cada ponto da página. */
async function brilhoNosPontos(page: Page, pontos: Ponto[]): Promise<number[]> {
  const png = (await page.screenshot()).toString('base64')
  return page.evaluate(
    async ({ dados, alvos }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${dados}`
      await img.decode()
      const tela = new OffscreenCanvas(img.width, img.height)
      const ctx = tela.getContext('2d')
      if (ctx === null) throw new Error('sem contexto 2d')
      ctx.drawImage(img, 0, 0)
      const escala = img.width / window.innerWidth
      return alvos.map(({ x, y }) => {
        const d = ctx.getImageData(Math.round(x * escala) - 4, Math.round(y * escala) - 4, 9, 9).data
        let soma = 0
        for (let i = 0; i < d.length; i += 4) soma += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
        return soma / (d.length / 4)
      })
    },
    { dados: png, alvos: pontos },
  )
}

/** Luminância média de um retângulo da página. */
async function brilhoMedio(page: Page, caixa: { x: number; y: number; width: number; height: number }): Promise<number> {
  const png = (await page.screenshot({ clip: caixa })).toString('base64')
  return page.evaluate(async (dados) => {
    const img = new Image()
    img.src = `data:image/png;base64,${dados}`
    await img.decode()
    const tela = new OffscreenCanvas(img.width, img.height)
    const ctx = tela.getContext('2d')
    if (ctx === null) throw new Error('sem contexto 2d')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, img.width, img.height).data
    let soma = 0
    for (let i = 0; i < d.length; i += 16) soma += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    return soma / (d.length / 16)
  }, png)
}

/** Centro da ficha azul da jogadora na tela (a cor de dono, `OWN_TOKEN_COLOR`); `null` se não achou. */
async function centroDaFicha(page: Page): Promise<Ponto | null> {
  const png = (await page.screenshot()).toString('base64')
  return page.evaluate(async (dados) => {
    const img = new Image()
    img.src = `data:image/png;base64,${dados}`
    await img.decode()
    const tela = new OffscreenCanvas(img.width, img.height)
    const ctx = tela.getContext('2d')
    if (ctx === null) throw new Error('sem contexto 2d')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, img.width, img.height).data
    let sx = 0
    let sy = 0
    let n = 0
    // Só a metade direita: à esquerda fica o painel do jogador, que também tem o azul de dono.
    for (let y = 0; y < img.height; y += 2) {
      for (let x = Math.round(img.width * 0.45); x < img.width; x += 2) {
        const i = (y * img.width + x) * 4
        if (d[i + 2] > 170 && d[i + 2] > d[i] + 70 && d[i + 2] > d[i + 1] + 30) {
          sx += x
          sy += y
          n += 1
        }
      }
    }
    const escala = img.width / window.innerWidth
    return n < 20 ? null : { x: sx / n / escala, y: sy / n / escala }
  }, png)
}

/** Duração de cada quadro (rAF) e das tarefas longas enquanto `gesto` roda. */
async function medirQuadros(page: Page, gesto: () => Promise<void>): Promise<{ p95: number; quadros: number; maiorTarefa: number }> {
  await page.evaluate(() => {
    const w = window as unknown as { __quadros: number[]; __longas: number[]; __medindo: boolean } // campos de medida deste teste
    w.__quadros = []
    w.__longas = []
    w.__medindo = true
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) w.__longas.push(e.duration)
    }).observe({ type: 'longtask' })
    let antes = performance.now()
    const passo = (agora: number) => {
      w.__quadros.push(agora - antes)
      antes = agora
      if (w.__medindo) requestAnimationFrame(passo)
    }
    requestAnimationFrame(passo)
  })
  await gesto()
  return page.evaluate(() => {
    const w = window as unknown as { __quadros: number[]; __longas: number[]; __medindo: boolean } // campos escritos acima
    w.__medindo = false
    const quadros = w.__quadros.slice(1).sort((a, b) => a - b)
    const p95 = quadros[Math.min(quadros.length - 1, Math.ceil(quadros.length * 0.95) - 1)] ?? 0
    return { p95, quadros: quadros.length, maiorTarefa: Math.max(0, ...w.__longas) }
  })
}

/** Observa tarefas longas a partir de agora (troca de período). */
async function vigiarTarefas(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __trocas: number[] } // campo de medida deste teste
    w.__trocas = []
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) w.__trocas.push(e.duration)
    }).observe({ type: 'longtask' })
  })
}

async function maiorTarefa(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, ...(window as unknown as { __trocas: number[] }).__trocas)) // campo escrito em vigiarTarefas
}

interface Quadro {
  nome: string
  png: string
  t: number
}

test('a tinta do período e a luz quente: editor e jogador, dia, tarde e noite', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(180_000)
  if (baseURL === undefined) throw new Error('sem baseURL')
  const inicio = Date.now()
  const quadros: Quadro[] = []
  await mestre.setViewportSize(TELA)
  const rede = await mestreAbreASala(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', 'Ana')
  await mestre.locator('#lb-rail-panel-room .lb-field').filter({ hasText: 'Ana —' }).getByRole('button', { name: 'Atribuir Ana', exact: true }).click()
  await expect(ana.locator('.pp-estado')).toHaveAttribute('data-periodo', 'dia', { timeout: 15_000 })

  const painel = mestre.locator('#lb-rail-panel-room')
  const radio = (nome: string) => painel.getByRole('radiogroup', { name: 'Período' }).getByRole('radio', { name: nome })
  const comoJogador = painel.getByRole('checkbox', { name: 'Ver como jogador' })
  const editor = mestre.locator('[data-light-gradients]')
  const telaDaAna = ana.locator('[data-own-tokens]')
  // Zoom em 100% com a câmera na origem: px de mundo = px do canvas do editor.
  await mestre.getByRole('button', { name: /^Zoom:/ }).click()
  await expect(mestre.getByRole('button', { name: /^Zoom: 100%/ })).toBeVisible()
  const caixa = await editor.locator('canvas').boundingBox()
  if (caixa === null) throw new Error('o editor não tem canvas')
  const naTela = (p: Ponto): Ponto => ({ x: caixa.x + p.x, y: caixa.y + p.y })
  const recorte = (p: Ponto, lado: number) => ({ x: Math.max(caixa.x, caixa.x + p.x - lado / 2), y: Math.max(caixa.y, caixa.y + p.y - lado / 2), width: lado, height: lado })
  const vistaDoEditor = { x: caixa.x, y: caixa.y, width: Math.min(caixa.width, 820), height: Math.min(caixa.height, 620) }
  const foto = async (page: Page, nome: string, clip?: { x: number; y: number; width: number; height: number }) => {
    await page.waitForTimeout(ASSENTAR_MS)
    quadros.push({ nome, png: (await page.screenshot(clip === undefined ? {} : { clip })).toString('base64'), t: (Date.now() - inicio) / 1000 })
  }

  // ── DIA: nada muda (sem mapa de luz, nada desenhado).
  await mestre.waitForTimeout(ASSENTAR_MS)
  await expect(editor).not.toHaveAttribute('data-mapa-de-luz-refeitos')
  await expect(telaDaAna).not.toHaveAttribute('data-mapa-de-luz-refeitos')
  await foto(mestre, 'Editor · dia (como antes)', vistaDoEditor)
  await foto(ana, 'Jogadora · dia (como antes)')
  const telaInteira = { x: 0, y: 0, width: TELA.width, height: TELA.height }
  const diaNoMestre = await brilhoMedio(mestre, vistaDoEditor)
  const diaNaAna = await brilhoMedio(ana, telaInteira)
  const quadrosDeDia = await medirQuadros(ana, async () => {
    const centro = LONGE_DA_FICHA
    await ana.mouse.move(centro.x, centro.y)
    await ana.mouse.down()
    await ana.mouse.move(centro.x - 300, centro.y - 120, { steps: 40 })
    await ana.mouse.move(centro.x, centro.y, { steps: 40 })
    await ana.mouse.up()
    for (let i = 0; i < 8; i += 1) await ana.mouse.wheel(0, i < 4 ? -240 : 240)
    await ana.waitForTimeout(400)
  })

  // ── TARDE.
  await vigiarTarefas(mestre)
  await vigiarTarefas(ana)
  await radio('Tarde').click()
  await expect(ana.locator('.pp-estado')).toHaveAttribute('data-periodo', 'tarde', { timeout: 5_000 })
  await foto(mestre, 'Editor · tarde (tinta a 50%)', vistaDoEditor)
  await foto(ana, 'Jogadora · tarde')
  const tardeNoMestre = await brilhoMedio(mestre, vistaDoEditor)
  const tardeNaAna = await brilhoMedio(ana, telaInteira)
  await comoJogador.click()
  await foto(mestre, 'Editor · tarde · Ver como jogador', vistaDoEditor)
  const tardeComoJogador = await brilhoMedio(mestre, vistaDoEditor)
  await comoJogador.click()

  // ── NOITE.
  await radio('Noite').click()
  await expect(ana.locator('.pp-estado')).toHaveAttribute('data-periodo', 'noite', { timeout: 5_000 })
  await mestre.waitForTimeout(ASSENTAR_MS)
  const trocaNoMestre = await maiorTarefa(mestre)
  const trocaNaAna = await maiorTarefa(ana)
  await foto(mestre, 'Editor · noite (tinta a 50%)', vistaDoEditor)
  const brilhoDoMestre = await brilhoMedio(mestre, vistaDoEditor)
  const [frenteMestre, atrasMestre] = await brilhoNosPontos(mestre, [naTela(PROVA.frenteDaParede), naTela(PROVA.atrasDaParede)])
  await comoJogador.click()
  await foto(mestre, 'Editor · noite · Ver como jogador', vistaDoEditor)
  const brilhoComoJogador = await brilhoMedio(mestre, vistaDoEditor)
  const [frente, atras, chaoSobOPoste, telhado] = await brilhoNosPontos(mestre, [naTela(PROVA.frenteDaParede), naTela(PROVA.atrasDaParede), naTela(PROVA.chaoSobOPoste), naTela(PROVA.telhado)])
  await foto(mestre, 'Fogueira (5 casas) · como jogador', recorte({ x: PROVA.fogueira.x, y: PROVA.fogueira.y - 70 }, 260))
  await foto(mestre, 'Poste e parede (a parede barra)', recorte({ x: 560, y: 300 }, 300))
  await foto(mestre, 'Poste e telhado (o telhado não acende)', recorte({ x: 710, y: 470 }, 300))
  await foto(ana, 'Jogadora · noite (contorno creme na própria ficha)')
  const brilhoDaAna = await brilhoMedio(ana, telaInteira)
  // De perto: a roda aproxima onde a ficha azul da Ana está na tela.
  const ficha = await centroDaFicha(ana)
  if (ficha !== null) {
    await ana.mouse.move(ficha.x, ficha.y)
    for (let i = 0; i < 3; i += 1) await ana.mouse.wheel(0, -240)
    const perto = (await centroDaFicha(ana)) ?? ficha
    await foto(ana, 'Jogadora · noite · a própria ficha, de perto', { x: Math.max(0, perto.x - 130), y: Math.max(0, perto.y - 130), width: 260, height: 260 })
  }

  // Pan e zoom à noite na tela da Ana: o mapa de luz se refaz a cada quadro que a vista muda.
  const quadrosDeNoite = await medirQuadros(ana, async () => {
    const centro = LONGE_DA_FICHA
    await ana.mouse.move(centro.x, centro.y)
    await ana.mouse.down()
    await ana.mouse.move(centro.x - 300, centro.y - 120, { steps: 40 })
    await ana.mouse.move(centro.x, centro.y, { steps: 40 })
    await ana.mouse.up()
    for (let i = 0; i < 8; i += 1) await ana.mouse.wheel(0, i < 4 ? -240 : 240)
    await ana.waitForTimeout(400)
  })
  const refeitosDaAna = Number(await telaDaAna.getAttribute('data-mapa-de-luz-refeitos'))
  const refazerDaAna = Number(await telaDaAna.getAttribute('data-mapa-de-luz-maior-ms'))
  const refazerDoEditor = Number(await editor.getAttribute('data-mapa-de-luz-maior-ms'))

  // ── De volta ao dia: o mapa de luz sai.
  await comoJogador.click()
  await radio('Dia').click()
  await expect(ana.locator('.pp-estado')).toHaveAttribute('data-periodo', 'dia', { timeout: 5_000 })
  await foto(mestre, 'Editor · dia de novo (DEPOIS = ANTES)', vistaDoEditor)

  const medidas = {
    periodos: { diaNoMestre, tardeNoMestre, tardeComoJogador, noiteNoMestre: brilhoDoMestre, diaNaAna, tardeNaAna, noiteNaAna: brilhoDaAna },
    brilho: { frenteDaParede: frente, atrasDaParede: atras, chaoSobOPoste, telhado, mestreMedia: brilhoDoMestre, comoJogadorMedia: brilhoComoJogador, anaMedia: brilhoDaAna, frenteMestre, atrasMestre },
    quadros: { diaP95: quadrosDeDia.p95, noiteP95: quadrosDeNoite.p95, noiteQuadros: quadrosDeNoite.quadros, maiorTarefaNoGesto: quadrosDeNoite.maiorTarefa },
    refazer: { anaMaiorMs: refazerDaAna, editorMaiorMs: refazerDoEditor, refeitosDaAna },
    troca: { mestreMaiorTarefa: trocaNoMestre, anaMaiorTarefa: trocaNaAna },
  }
  console.log(`MEDIDAS L4b ${JSON.stringify(medidas)}`)

  if (process.env.LAB_FOLHA_L4B === '1') {
    const folha = await mestre.context().newPage()
    await folha.setViewportSize({ width: 1600, height: 900 })
    const figuras = quadros
      .map((q) => `<figure><img src="data:image/png;base64,${q.png}"><figcaption>${q.nome}<br><b>t = ${q.t.toFixed(1)} s</b></figcaption></figure>`)
      .join('')
    await folha.setContent(
      `<html><body style="margin:0;background:#1d1c1a;color:#eceae4;font:13px 'Segoe UI',sans-serif"><h1 style="font-size:16px;margin:12px 16px">Luz L4b · mapa de luz (tinta do período e luz quente) · vila com 20 luzes</h1><main style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:0 16px 16px">${figuras}</main><style>figure{margin:0;background:#2a2926;padding:6px;border-radius:6px}img{width:100%;height:220px;object-fit:contain;background:#111;display:block}figcaption{margin-top:4px}</style></body></html>`,
    )
    await folha.screenshot({ path: '../docs/design/luz/provas/l4b-folha-de-contato.png', fullPage: true })
    await folha.close()
  }

  // A tinta escurece de verdade, na ordem dia > tarde > noite, e a meia força do mestre fica entre o dia e o como-jogador.
  expect(tardeNoMestre, 'tarde a 50% no editor').toBeLessThan(diaNoMestre - 2)
  expect(tardeComoJogador, 'tarde como jogador').toBeLessThan(tardeNoMestre - 2)
  expect(brilhoDoMestre, 'noite a 50% no editor').toBeLessThan(tardeNoMestre)
  expect(tardeNaAna, 'tarde na tela da Ana').toBeLessThan(diaNaAna - 2)
  expect(brilhoDaAna, 'noite na tela da Ana').toBeLessThan(tardeNaAna)
  // A parede barra a luz; o telhado não acende; o mestre vê mais claro que o jogador.
  expect(frente, 'na frente da parede, sob o poste').toBeGreaterThan(atras * 1.3)
  expect(chaoSobOPoste, 'o chão sob o poste').toBeGreaterThan(telhado * 1.3)
  expect(brilhoDoMestre, 'o mestre (50%) vê mais claro que o como-jogador (100%)').toBeGreaterThan(brilhoComoJogador)
  // Fluidez e custo (PC; sem estrangular CPU).
  expect(quadrosDeNoite.p95, 'pan e zoom à noite, p95 do quadro').toBeLessThanOrEqual(QUADRO_P95_MS)
  expect(refeitosDaAna, 'o mapa da Ana se refez no gesto').toBeGreaterThan(5)
  expect(refazerDaAna, 'refazer o mapa de luz (CPU)').toBeLessThanOrEqual(REFAZER_MS)
  expect(refazerDoEditor, 'refazer o mapa de luz no editor (CPU)').toBeLessThanOrEqual(REFAZER_MS)
  expect(trocaNoMestre, 'troca de período sem tarefa longa no mestre').toBeLessThan(TAREFA_LONGA_MS)
  expect(trocaNaAna, 'troca de período sem tarefa longa na Ana').toBeLessThan(TAREFA_LONGA_MS)
  // Dia de novo: o mapa de luz não fica para trás no editor nem na tela da Ana.
  await expect.poll(async () => brilhoMedio(mestre, vistaDoEditor)).toBeGreaterThan(brilhoDoMestre)
})
