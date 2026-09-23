// JORNADA DE USUÁRIO do item "sala-secreta-nao-vaza" (backlog da simulação de
// 7 jogadores, cenário da mansão) — escrita para SAIR VERMELHA no código de
// hoje. É a régua do conserto, não o conserto.
//
// O ITEM: com o Quarto Secreto "Oculto para jogadores", a porta da estante (na
// parede leste da Biblioteca) some do recorte do jogador e a visão dele passa
// pelo vão. Parede ou porta de sala secreta na borda da área visível tem de
// chegar como PAREDE INTEIRA.
// Aceite (roteiro desta régua): Ana na Biblioteca vê a parede leste inteira,
// sem cone nem vão.
//
// ONDE ISSO MORRE HOJE:
//   - client/src/lib/fogFilter.ts:581-591 — `playerWalls` tira TODA parede com
//     `regionId` da sala secreta (a porta da estante inclusive) e a visão
//     enviada ao jogador é recalculada sem ela: o cone atravessa o vão;
//   - client/src/lib/fogFilter.ts:705 — a mesma regra tira a porta do pacote:
//     a parede leste chega com um buraco no lugar da estante.
//
// COMO ESTE ARQUIVO PROVA, sem mentir:
//   DUAS TELAS DE VERDADE: o mestre é o app inteiro (modo Tauri) numa página; a
//   Ana é o `player.html` inteiro no próprio contexto de navegador. Só o
//   transporte Rust é falsificado (mesmo mecanismo de
//   task-jornada-viagem-do-jogador.spec.ts): o que a Ana manda vira `net:message`
//   no mestre e o `net_send` do mestre vira frame no WebSocket dela. A sessão do
//   host é a do app (`net/hostBridge.ts`), sem estado injetado.
//   DISCO DE MENTIRA com a Biblioteca e o Quarto Secreto prontos, no formato que
//   o app grava (`createEmptyMap` + `serializeMap`); o mestre abre pelo menu.
//   GESTO REAL: a Ana entra digitando; o mestre atribui a ficha com clique; a Ana
//   ARRASTA a própria ficha até perto da estante (ponteiro, pausa antes de
//   soltar). Os únicos `evaluate` são o do transporte e a LEITURA de pixel.
//   PROVA NA TELA DA ANA: pixels do canvas dela, em caixas do mundo convertidas
//   pela mesma câmera de "encaixar a cena" do PlayerView. Chão verde-água =
//   lugar que ela está vendo; linha cinza-clara neutra = parede (medido na tela do jogador
//   em 23/09: 1 px de (147,143,135) na borda da visão).
//
// SUPOSIÇÕES (as únicas que esta régua dita além do aceite):
//   - a parede que o jogador recebe no lugar da porta secreta é desenhada como
//     parede comum (linha clara), na mesma espessura da parede ao lado;
//   - "sem cone" = nenhum chão verde-água dentro do Quarto Secreto na tela da Ana
//     (o que passar do resíduo de antisserrilhado é vazamento).
//
// CONTROLE POSITIVO (verde hoje): teste 1. A Ana arrasta a ficha, a ficha anda,
// ela vê o chão da Biblioteca e a parede leste acima da estante. Sem ele, o
// vermelho dos testes 2 e 3 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Region, Token, Wall } from '../src/types/map'

// Máquina carregada: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'SECR01'
const JOGADORA = 'Ana'
const AVENTURA = 'Mansao da Estante'
const TOKEN_ANA = 'Lanterna'
const PASTA = 'C:/appdata/maps/map_estante'
const ID_CENA = 'scene_terreo'

const GRADE = 50
const COLUNAS = 24
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx — a conta de câmera tem de ser a mesma. */
const FIT_MARGIN = 24

const CHAO = '#1e8c8c'
const COR_ANA = '#3cff00'

type Ponto = { x: number; y: number }
type Caixa = { x1: number; y1: number; x2: number; y2: number }

// Planta: Biblioteca x 500-900, y 100-450 (fechada); estante = porta trancada
// em x=900, y 250-300, da sala secreta; Quarto Secreto x 900-1150, y 100-450.
const ESTANTE_X = 900
const ANA_INICIO: Ponto = { x: 625, y: 275 }
const ANA_NA_ESTANTE: Ponto = { x: 825, y: 275 }

/** Caixas do MUNDO que a régua lê na tela da Ana. */
const CHAO_DA_BIBLIOTECA: Caixa = { x1: 520, y1: 120, x2: 760, y2: 430 }
const PAREDE_LESTE_ACIMA: Caixa = { x1: ESTANTE_X - 6, y1: 140, x2: ESTANTE_X + 6, y2: 230 }
const PAREDE_NA_ESTANTE: Caixa = { x1: ESTANTE_X - 6, y1: 262, x2: ESTANTE_X + 6, y2: 288 }
const QUARTO_SECRETO: Caixa = { x1: 930, y1: 130, x2: 1130, y2: 420 }

const TOQUE_MS = 120
const PINTURA_MS = 400
const ESPERA_TELA = 20_000
/** Primeiro teste de cada worker paga o vite frio: medido 2,6 a 4,5 min com 3 workers (23/09); 150 s estourava no arrasto. */
const TETO_DO_TESTE = 480_000
/** Parede de 1 px ao longo de ~90 px de tela: pelo menos 40 pixels de linha. */
const PIXELS_DE_PAREDE = 40
const PIXELS_DE_CHAO = 2000
/** Pixels máximos para dizer "isto NÃO está na tela" (antisserrilhado). */
const RESIDUO = 25
/** A parede na estante tem de ter ao menos esta fração da densidade de linha clara da parede ao lado. */
const FRACAO_DE_PAREDE = 0.5

// ───────────────────────────────────────────────────────────────────────────
// A mansão no disco
// ───────────────────────────────────────────────────────────────────────────

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, nome: string, c: Caixa, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: c.x1, y: c.y1 },
      { x: c.x2, y: c.y1 },
      { x: c.x2, y: c.y2 },
      { x: c.x1, y: c.y2 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    filled: false,
    room: { shape: 'rect', name: nome },
    ...extra,
  }
}

function discoDaMansao(): Record<string, string> {
  const base = createEmptyMap('map_estante', AVENTURA, COLUNAS, LINHAS, GRADE)
  const bib = { regionId: 'r-bib', wallKind: 'interior' as const }
  const sec = { regionId: 'r-secreto', wallKind: 'interior' as const }
  const ficha: Token = { id: 'tok-lanterna', characterId: null, name: TOKEN_ANA, x: ANA_INICIO.x, y: ANA_INICIO.y, size: 1, image: null, color: COR_ANA }
  const mapa: MapData = {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 10, h: ALTURA - 10 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: CHAO },
    walls: [
      parede('cn', 0, 0, LARGURA, 0),
      parede('cl', LARGURA, 0, LARGURA, ALTURA),
      parede('cs', LARGURA, ALTURA, 0, ALTURA),
      parede('co', 0, ALTURA, 0, 0),
      // Biblioteca: fechada; a parede leste tem o vão da estante em y 250-300.
      parede('bib-n', 500, 100, 900, 100, bib),
      parede('bib-l1', 900, 100, 900, 250, bib),
      parede('bib-l2', 900, 300, 900, 450, bib),
      parede('bib-s', 900, 450, 500, 450, bib),
      parede('bib-o', 500, 450, 500, 100, bib),
      // A estante: porta TRANCADA do Quarto Secreto.
      parede('estante', ESTANTE_X, 250, ESTANTE_X, 300, { ...sec, door: { open: false, locked: true, kind: 'normal' } }),
      parede('sec-n', 900, 100, 1150, 100, sec),
      parede('sec-l', 1150, 100, 1150, 450, sec),
      parede('sec-s', 1150, 450, 900, 450, sec),
    ],
    regions: [
      sala('r-bib', 'Biblioteca', { x1: 500, y1: 100, x2: 900, y2: 450 }),
      sala('r-secreto', 'Quarto Secreto', { x1: 900, y1: 100, x2: 1150, y2: 450 }, { secret: true }),
    ],
    tokens: [ficha],
  }
  const aventura = { version: 1, id: 'adv_estante', name: AVENTURA, startSceneId: ID_CENA, scenes: [{ id: ID_CENA, name: 'Terreo', file: 'map.json' }] }
  return {
    [`${PASTA}/map.json`]: serializeMap(mapa),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco e transporte de mentira
// (copiado de task-jornada-viagem-do-jogador.spec.ts:230-346)
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
  fila: Promise<void>
}

async function mestreAbreAMansao(mestre: Page): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), fila: Promise.resolve() }
  await mestre.exposeFunction('__labParaJogador', (clientId: string, texto: string) => {
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
    { arquivos: discoDaMansao(), codigo: CODIGO },
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
// A Ana: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

const contextosDeJogador: BrowserContext[] = []
test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function anaEntra(browser: Browser, baseURL: string, rede: Rede): Promise<Page> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      rede.sockets.set('c1', ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.fila = rede.fila
          .then(() =>
            rede.mestre.evaluate(
              ({ c, t }) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: c, msg: JSON.parse(t) as unknown }),
              { c: 'c1', t: texto },
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
  await campoNome.pressSequentially(JOGADORA, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return page
}

// ───────────────────────────────────────────────────────────────────────────
// Gesto e leitura da tela da Ana
// ───────────────────────────────────────────────────────────────────────────

const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)

function naTela(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round(p.y * CAMERA.scale + CAMERA.y) }
}

function caixaNaTela(c: Caixa): Caixa {
  const a = naTela({ x: c.x1, y: c.y1 })
  const b = naTela({ x: c.x2, y: c.y2 })
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
}

/** Arrasta a ficha: desce nela, anda em passos, para um instante e solta. */
async function arrastar(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 20 })
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

interface Contagem {
  /** Chão na visão (verde-água claro). */
  chaoClaro: number
  /** Chão lembrado (verde-água escurecido). */
  chaoEscuro: number
  /** Linha clara quase neutra: a parede. */
  parede: number
  ana: number
  /** Pixels do canvas dentro da caixa. */
  total: number
}

type Leitura = { zonas: Record<string, Contagem>; centroDaAna: Ponto | null }

/**
 * Fotografa a tela da Ana e conta pixels por cor dentro de cada caixa (px de
 * tela), só onde o CANVAS está por cima. Leitura pura: decodifica a foto num
 * canvas solto e pergunta `elementFromPoint`.
 */
async function lerTela(page: Page, caixas: Record<string, Caixa>): Promise<Leitura> {
  await page.waitForTimeout(PINTURA_MS)
  const foto = await page.screenshot()
  return page.evaluate(
    async ({ b64, zonas }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const ex = width / window.innerWidth
      const ey = height / window.innerHeight
      // Um `elementFromPoint` por bloco de 8x8: por pixel, a leitura levava segundos.
      const cache = new Map<number, boolean>()
      const noCanvas = (x: number, y: number): boolean => {
        const chave = (y >> 3) * 65536 + (x >> 3)
        let v = cache.get(chave)
        if (v === undefined) {
          v = document.elementFromPoint(((x >> 3) * 8 + 4) / ex, ((y >> 3) * 8 + 4) / ey)?.tagName === 'CANVAS'
          cache.set(chave, v)
        }
        return v
      }
      const classe = (x: number, y: number): 'claro' | 'escuro' | 'parede' | 'ana' | null => {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        if (G > 200 && R > 20 && R < 120 && B < 60) return 'ana'
        if (R > 110 && G > 110 && B > 100 && Math.max(R, G, B) - Math.min(R, G, B) < 30) return 'parede'
        if (G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30) return G >= 110 ? 'claro' : G >= 35 ? 'escuro' : null
        return null
      }
      const zonasLidas: Record<string, { chaoClaro: number; chaoEscuro: number; parede: number; ana: number; total: number }> = {}
      for (const [nome, c] of Object.entries(zonas)) {
        const z = { chaoClaro: 0, chaoEscuro: 0, parede: 0, ana: 0, total: 0 }
        for (let y = Math.max(0, Math.round(c.y1 * ey)); y < Math.min(height, Math.round(c.y2 * ey)); y += 1) {
          for (let x = Math.max(0, Math.round(c.x1 * ex)); x < Math.min(width, Math.round(c.x2 * ex)); x += 1) {
            if (!noCanvas(x, y)) continue
            z.total += 1
            const k = classe(x, y)
            if (k === 'claro') z.chaoClaro += 1
            else if (k === 'escuro') z.chaoEscuro += 1
            else if (k === 'parede') z.parede += 1
            else if (k === 'ana') z.ana += 1
          }
        }
        zonasLidas[nome] = z
      }
      // Centro da ficha da Ana na tela inteira (prova que o arrasto andou).
      let n = 0
      let sx = 0
      let sy = 0
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          if (classe(x, y) !== 'ana') continue
          n += 1
          sx += x
          sy += y
        }
      }
      return { zonas: zonasLidas, centroDaAna: n > 0 ? { x: sx / n / ex, y: sy / n / ey } : null }
    },
    { b64: foto.toString('base64'), zonas: caixas },
  )
}

const ZONAS = {
  biblioteca: caixaNaTela(CHAO_DA_BIBLIOTECA),
  paredeAcima: caixaNaTela(PAREDE_LESTE_ACIMA),
  estante: caixaNaTela(PAREDE_NA_ESTANTE),
  quartoSecreto: caixaNaTela(QUARTO_SECRETO),
}

const resumo = (l: Leitura): string => JSON.stringify(l.zonas)

/**
 * Mesa montada e a Ana já parada junto da estante, pelo gesto dela: o mestre
 * abre a mansão e a sala, a Ana entra, o mestre dá a ficha, ela ARRASTA a
 * própria ficha pela Biblioteca até a parede leste.
 */
async function anaJuntoDaEstante(browser: Browser, mestre: Page, baseURL: string): Promise<{ ana: Page; leitura: Leitura }> {
  const rede = await mestreAbreAMansao(mestre)
  const ana = await anaEntra(browser, baseURL, rede)
  await mestreAtribui(mestre, JOGADORA, TOKEN_ANA)
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await expect(ana.locator('canvas').first(), 'o mapa não apareceu na tela da Ana').toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerTela(ana, ZONAS)).centroDaAna !== null, { timeout: ESPERA_TELA, message: 'a ficha da Ana não apareceu na tela dela' })
    .toBe(true)

  await arrastar(ana, naTela(ANA_INICIO), naTela(ANA_NA_ESTANTE))
  const destino = naTela(ANA_NA_ESTANTE)
  let leitura: Leitura | null = null
  await expect
    .poll(
      async () => {
        leitura = await lerTela(ana, ZONAS)
        const c = leitura.centroDaAna
        return c === null ? Infinity : Math.hypot(c.x - destino.x, c.y - destino.y)
      },
      { timeout: ESPERA_TELA, message: 'a ficha da Ana deveria ter ido para junto da estante com o arrasto' },
    )
    .toBeLessThan(20)
  if (leitura === null) throw new Error('sem leitura da tela da Ana')
  return { ana, leitura }
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana arrasta a ficha pela Biblioteca e vê o chão dela e a parede leste acima da estante', async ({ browser, page, baseURL }) => {
  test.setTimeout(TETO_DO_TESTE)
  const { leitura } = await anaJuntoDaEstante(browser, page, baseURL ?? '')
  expect(leitura.zonas.biblioteca.chaoClaro, `a Ana deveria ver o chão da Biblioteca. Leitura: ${resumo(leitura)}`).toBeGreaterThan(PIXELS_DE_CHAO)
  expect(leitura.zonas.paredeAcima.parede, `a Ana deveria ver a parede leste da Biblioteca acima da estante. Leitura: ${resumo(leitura)}`).toBeGreaterThan(PIXELS_DE_PAREDE)
})

test('2. sem cone: junto da estante, a Ana não vê chão nenhum dentro do Quarto Secreto', async ({ browser, page, baseURL }) => {
  test.setTimeout(TETO_DO_TESTE)
  const { leitura } = await anaJuntoDaEstante(browser, page, baseURL ?? '')
  const q = leitura.zonas.quartoSecreto
  expect(leitura.zonas.biblioteca.chaoClaro, `controle interno: o chão da Biblioteca deveria estar na tela da Ana. Leitura: ${resumo(leitura)}`).toBeGreaterThan(PIXELS_DE_CHAO)
  expect(
    q.chaoClaro + q.chaoEscuro,
    `a visão da Ana atravessou a estante: ${q.chaoClaro + q.chaoEscuro} px de chão do Quarto Secreto na tela dela. Leitura: ${resumo(leitura)}`,
  ).toBeLessThanOrEqual(RESIDUO)
})

test('3. sem vão: a parede leste da Biblioteca chega inteira, com parede no lugar da estante', async ({ browser, page, baseURL }) => {
  test.setTimeout(TETO_DO_TESTE)
  const { leitura } = await anaJuntoDaEstante(browser, page, baseURL ?? '')
  const acima = leitura.zonas.paredeAcima
  const estante = leitura.zonas.estante
  const alturaAcima = ZONAS.paredeAcima.y2 - ZONAS.paredeAcima.y1
  const alturaEstante = ZONAS.estante.y2 - ZONAS.estante.y1
  const esperado = (acima.parede / alturaAcima) * alturaEstante * FRACAO_DE_PAREDE
  expect(acima.parede, `controle interno: a parede acima da estante deveria estar na tela. Leitura: ${resumo(leitura)}`).toBeGreaterThan(PIXELS_DE_PAREDE)
  expect(
    estante.parede,
    `a parede leste tem um vão na estante: ${estante.parede} px de linha clara ali, esperado ao menos ${Math.round(esperado)}. Leitura: ${resumo(leitura)}`,
  ).toBeGreaterThanOrEqual(esperado)
})
