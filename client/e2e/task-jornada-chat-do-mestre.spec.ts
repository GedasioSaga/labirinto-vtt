// JORNADA DE USUÁRIO do CHAT DO MESTRE (fatia D de docs/plano-chat.md).
//
// O PEDIDO: "Eu não consigo ver o chat dos meus jogadores, pode colocar a
// opção de ver o chat". Decisões: o mestre lê o Global e o canal de cada cena
// (cena = só leitura para ele), escreve só no Global (a fala chega a todos
// marcada como do mestre) e '@mestre' acende para ele.
//
// COMO ESTE ARQUIVO PROVA (o preparo de task-jornada-dado-na-sala.spec.ts):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   Ana e Bruno são o `player.html` inteiro, cada um no próprio contexto, e
//   em CENAS DIFERENTES (Ana no Salão, Bruno na Cripta). Só o transporte Rust
//   é falsificado: o WebSocket do jogador vira `net:message` no mestre e o
//   `net_send` do mestre volta ao socket do jogador.
//   GESTO REAL: clique e teclado do Playwright. PROVA NA TELA: texto visível.

import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'CHAT01'
const J1 = 'Ana'
const J2 = 'Bruno'
/** Nome com que o mestre aparece no chat. */
const MESTRE = 'Mestre'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'
const TOKEN_J1 = 'Lanterna'
const TOKEN_J2 = 'Machado'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const PASTA = 'C:/appdata/maps/map_vale'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }

const CHAO_A = '#1e8c8c'
const CHAO_B = '#8c1e8c'
const COR_J1 = '#3cff00'
const COR_J2 = '#ff5a00'

/** Espera curta por controle: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera pela mensagem chegar a outra tela (passa pelo transporte de mentira). */
const ESPERA_FALA = 10_000

type Ponto = { x: number; y: number }

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: duas cenas (o formato que o app abre pelo menu)
// ───────────────────────────────────────────────────────────────────────────

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function cena(id: string, nome: string, chao: string, tokens: Token[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    tokens,
    pins: [],
  }
}

function discoDaAventura(): Record<string, string> {
  const cenaA = cena('map_vale', AVENTURA, CHAO_A, [
    token('tok-lanterna', TOKEN_J1, { x: 700, y: 300 }, COR_J1),
  ])
  // Bruno joga na OUTRA cena: o chat da cena dele não chega à Ana.
  const cenaB = cena('map_cripta', CENA_B, CHAO_B, [token('tok-machado', TOKEN_J2, { x: 820, y: 300 }, COR_J2)])
  const aventura = {
    version: 1,
    id: 'adv_vale',
    name: AVENTURA,
    startSceneId: ID_CENA_A,
    scenes: [
      { id: ID_CENA_A, name: CENA_A, file: 'map.json' },
      { id: ID_CENA_B, name: CENA_B, file: `scenes/${ID_CENA_B}/map.json` },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(cenaA),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_CENA_B}/map.json`]: serializeMap(cenaB),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco de mentira e transporte de mentira
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

/** O "Rust" de mentira: liga o WebSocket de cada jogador ao `net:*` do mestre, nos dois sentidos. */
interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Mensagens do jogador entregues ao mestre uma de cada vez, na ordem em que chegaram. */
  fila: Promise<void>
}

async function mestreAbreAventura(mestre: Page): Promise<Rede> {
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

/** Aba Jogo, card do jogador, "Atribuir <token>" — o clique de um toque que o painel oferece. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDoToken: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = mestre.locator('#lb-rail-panel-room')
  const card = painel.locator('.lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${nomeDoToken}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDoToken}` }), `${jogador} deveria ficar com ${nomeDoToken}`).toBeVisible()
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

/**
 * Contextos de jogador abertos pelo teste que está rodando. O `page` do mestre
 * o Playwright fecha sozinho; estes não — e cada tela de jogador viva desenha
 * Pixi e pesa no teste seguinte.
 */
const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Page> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
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
  return page
}

/** O jogador abre o "Painel" dele e vê a própria ficha: prova de que o mapa chegou com o token dele. */
async function jogadorVeAFicha(page: Page, nomeDoToken: string, quem: string): Promise<void> {
  await expect(page.locator('canvas').first(), `${quem}: o mapa não apareceu na tela`).toBeVisible({ timeout: 10_000 })
  const alternar = page.getByRole('button', { name: 'Painel', exact: true })
  if (await alternar.isVisible()) await alternar.click()
  await expect(page.getByRole('button', { name: `Centralizar em ${nomeDoToken}` }), `${quem}: a ficha ${nomeDoToken} deveria estar no painel`).toBeVisible({ timeout: 10_000 })
}

interface Mesa {
  mestre: Page
  ana: Page
  bruno: Page | null
}

/** Mestre abre a aventura e a sala; os jogadores pedidos entram e recebem a ficha de cada um. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string, quem: 'so-ana' | 'ana-e-bruno'): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = quem === 'ana-e-bruno' ? await jogadorEntra(browser, baseURL, rede, 'c2', J2) : null
  await mestreAtribui(mestre, J1, TOKEN_J1)
  if (bruno) await mestreAtribui(mestre, J2, TOKEN_J2)
  // O mestre volta para o mapa: é onde ele fica na mesa.
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await jogadorVeAFicha(ana, TOKEN_J1, J1)
  if (bruno) await jogadorVeAFicha(bruno, TOKEN_J2, J2)
  return { mestre, ana, bruno }
}

// ───────────────────────────────────────────────────────────────────────────
// O chat: o jogador pela aba Chat do Painel, o mestre pelo botão Chat
// ───────────────────────────────────────────────────────────────────────────

/** Abre a aba Chat do Painel do jogador e escolhe o canal. */
async function jogadorNoCanal(page: Page, canal: 'Cena' | 'Global'): Promise<void> {
  const painel = page.getByRole('complementary', { name: 'Painel do jogador' })
  if (!(await painel.isVisible())) await page.getByRole('button', { name: 'Painel', exact: true }).click()
  await page.getByRole('tab', { name: /^Chat/ }).click()
  await page.locator('button.pc-channel').filter({ hasText: canal }).click()
}

async function jogadorFala(page: Page, canal: 'Cena' | 'Global', texto: string): Promise<void> {
  await jogadorNoCanal(page, canal)
  const campo = page.getByLabel(canal === 'Cena' ? 'Mensagem para a cena' : 'Mensagem para o Global')
  await campo.click()
  await campo.pressSequentially(texto, { delay: 10 })
  await campo.press('Enter')
  // Só a confirmação do mestre limpa o campo.
  await expect(campo).toHaveValue('', { timeout: ESPERA_FALA })
}

function logDoJogador(page: Page): Locator {
  return page.locator('.pc-log')
}

function painelDoChat(mestre: Page): Locator {
  return mestre.getByRole('region', { name: 'Chat dos jogadores' })
}

function canalDoMestre(mestre: Page, nome: string): Locator {
  return painelDoChat(mestre).locator('button.lb-mchat__channel').filter({ has: mestre.locator('.lb-mchat__channel-name', { hasText: new RegExp(`^${nome}$`) }) })
}

test('o mestre lê o Global e as duas cenas, fala no Global e o @mestre acende', async ({ browser, page, baseURL }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(TELA)
  const { mestre, ana, bruno } = await mesaMontada(browser, page, baseURL ?? 'http://localhost:1420', 'ana-e-bruno')
  if (bruno === null) throw new Error('sem Bruno')

  await jogadorFala(ana, 'Cena', 'Alguém viu a porta do salão?')
  await jogadorFala(bruno, 'Cena', 'Aqui embaixo está escuro')
  await jogadorFala(ana, 'Global', '@mestre posso abrir o baú?')
  // Cena A não vê cena B (controle do que já existia).
  await jogadorNoCanal(ana, 'Cena')
  await expect(logDoJogador(ana)).toContainText('Alguém viu a porta do salão?')
  await expect(logDoJogador(ana)).not.toContainText('Aqui embaixo está escuro')

  // O botão Chat do mestre mostra o que não leu e a menção.
  const botao = mestre.getByRole('button', { name: /^Chat/ })
  await expect(botao).toBeVisible({ timeout: ESPERA })
  await expect(botao).toHaveAccessibleName('Chat (3 novas, menciona você)')
  await mestre.screenshot({ path: 'test-results/chat-do-mestre-1-botao.png' })
  await botao.click()
  const painel = painelDoChat(mestre)
  await expect(painel).toBeVisible()

  // Global: a fala com @mestre, destacada.
  await expect(canalDoMestre(mestre, 'Global')).toHaveAttribute('aria-pressed', 'true')
  const destaque = painel.locator('li.lb-mchat__msg--mention')
  await expect(destaque).toContainText('@mestre posso abrir o baú?')
  await expect(destaque).toContainText('menciona você')
  await mestre.screenshot({ path: 'test-results/chat-do-mestre-2-global.png' })

  // As duas cenas, cada uma com a sua conversa, só leitura.
  await canalDoMestre(mestre, CENA_A).click()
  await expect(painel.locator('.lb-mchat__log')).toContainText('Alguém viu a porta do salão?')
  await expect(painel.locator('.lb-mchat__log')).not.toContainText('Aqui embaixo está escuro')
  await expect(painel.getByText(/Só leitura/)).toBeVisible()
  await expect(painel.getByRole('textbox')).toHaveCount(0)
  await canalDoMestre(mestre, CENA_B).click()
  await expect(painel.locator('.lb-mchat__log')).toContainText('Aqui embaixo está escuro')
  await expect(painel.getByRole('textbox')).toHaveCount(0)
  await mestre.screenshot({ path: 'test-results/chat-do-mestre-3-cena.png' })
  // Tudo lido: o botão fica só "Chat".
  await expect(botao).toHaveAccessibleName('Chat')

  // O mestre fala no Global; os dois jogadores, em cenas diferentes, recebem como Mestre.
  await canalDoMestre(mestre, 'Global').click()
  const campo = painel.getByRole('textbox', { name: 'Mensagem para o Global' })
  await campo.click()
  await campo.pressSequentially('Pausa de 5 minutos, pessoal', { delay: 10 })
  await campo.press('Enter')
  await expect(campo).toHaveValue('')
  await expect(painel.locator('li.lb-mchat__msg--master')).toContainText('Pausa de 5 minutos, pessoal')
  for (const [quem, tela] of [
    [J1, ana],
    [J2, bruno],
  ] as const) {
    await jogadorNoCanal(tela, 'Global')
    const fala = tela.locator('li.pc-msg--master')
    await expect(fala, `${quem} deveria ver a fala do mestre no Global`).toContainText('Pausa de 5 minutos, pessoal', { timeout: ESPERA_FALA })
    await expect(fala.locator('.pc-msg__from')).toHaveText(MESTRE)
  }
  await bruno.screenshot({ path: 'test-results/chat-do-mestre-4-jogador.png' })

  // Linha nova numa cena com o painel no Global: acende só aquela cena.
  await jogadorFala(bruno, 'Cena', 'Ouvi passos')
  await expect(canalDoMestre(mestre, CENA_B).locator('.lb-mchat__badge')).toBeVisible({ timeout: ESPERA_FALA })
  await expect(canalDoMestre(mestre, CENA_A).locator('.lb-mchat__badge')).toHaveCount(0)
})
