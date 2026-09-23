// JORNADA DE USUÁRIO — atribuir-livres-primeiro (DEFEITO), escrita para SAIR
// VERMELHA no código de hoje. É a régua do conserto, não o conserto.
//
// O ITEM (C:/dev/backlog-simulacao-7-jogadores.md, "### atribuir-livres-primeiro"):
//   com 7 jogadores, os botões de um clique do card de quem espera oferecem ao
//   sétimo as fichas DOS OUTROS e escondem a ficha livre; um clique errado
//   derruba um jogador. Conserto: botões só com fichas sem dono, de TODAS as
//   cenas, sem NPC; ficha de outro jogador só na lista, marcada, com confirmação.
//   Aceite: 7 fichas em 2 cenas, editor na Cozinha. Após 6 atribuições, o card
//   da Gina mostra 'Biblioteca · Atribuir Livro' primeiro, sem ficha com dono
//   nem Mordomo. Um clique: o celular da Gina abre na Biblioteca; o editor fica
//   na Cozinha. 'Machado — de Bruno' pede confirmação; Cancelar mantém Bruno.
//
// ONDE ISSO MORRE HOJE:
//   - client/src/App.tsx:526 — `tokens` do RoomPanel é só `map.tokens` (a cena
//     ABERTA): o Livro, na Biblioteca, nunca vira botão nem opção;
//   - client/src/components/RoomPanel.tsx:57-59 — `assignableTokens` só tira as
//     fichas do PRÓPRIO jogador: as de Ana…Fábio e o Mordomo viram "Atribuir …";
//   - client/src/components/RoomPanel.tsx:283 — `slice(0, QUICK_ASSIGN_MAX)` (6)
//     na ordem do mapa: os 6 botões da Gina são as 6 fichas com dono;
//   - client/src/components/RoomPanel.tsx:311 — a opção da lista é '● Machado',
//     sem "de Bruno", e o `onChange` atribui na hora, sem confirmação;
//   - client/src/net/hostSession.ts:922-933 — `assignToken` tira a ficha de quem
//     tinha e manda o antigo dono de volta a "aguardando", sem perguntar.
//
// COMO ESTE ARQUIVO PROVA (mesmo preparo de task-jornada-painel-do-grupo.spec.ts):
//   O mestre é o app inteiro (modo Tauri, disco de mentira) numa página; cada
//   um dos 7 jogadores é o player.html inteiro no próprio contexto de navegador,
//   em tela de celular. Só o TRANSPORTE Rust é falsificado (WebSocket roteado ↔
//   `net:message` / `net_send`). A sessão do host é a real. Todo gesto do mestre
//   é clique de ponteiro ou escolha na lista nativa; a asserção é o que está na
//   tela: nome acessível do botão, texto e pixel (evaluate só LÊ a foto).
//   Teste 1 = CONTROLE POSITIVO (verde hoje e depois do conserto). Testes 2-4
//   cobram o item e caem hoje pelo motivo certo.
//
// SUPOSIÇÕES (o conserto pode ajustar SÓ estas, declarando):
//   - o botão de um clique da ficha livre de outra cena tem nome acessível com a
//     cena e a ficha: /Biblioteca · Atribuir Livro/ (o separador pode variar);
//   - todo botão de um clique continua com "Atribuir <ficha>" no nome, dentro do
//     card do jogador (`.lb-field` com "<nome> —", o mesmo da régua do Grupo);
//   - NPC: o app não tem marca de NPC hoje (client/src/types/map.ts:413). A régua
//     marca o Mordomo com `npc: true` na ficha gravada; se o conserto escolher
//     outro critério, troque só a função `ficha()` do Mordomo;
//   - a ficha de outro jogador fica na lista "Atribuir token" (select nativo) com
//     o texto 'Machado — de Bruno'; escolhê-la abre uma confirmação com o botão
//     "Cancelar" (diálogo ou dentro do card).
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'

test.use({ trace: 'off', video: 'off' })

const CODIGO = 'LIVR01'
const AVENTURA = 'Casa do Juiz'
const COZINHA = 'Cozinha'
const BIBLIOTECA = 'Biblioteca'
const ID_COZINHA = 'scene_cozinha'
const ID_BIBLIOTECA = 'scene_biblioteca'
const PASTA = 'C:/appdata/maps/map_juiz'

/** Os seis primeiros recebem a ficha da Cozinha; Gina é a sétima e chega depois. */
const JOGADORES = [
  { nome: 'Ana', ficha: 'Lanterna' },
  { nome: 'Bruno', ficha: 'Machado' },
  { nome: 'Carla', ficha: 'Cajado' },
  { nome: 'Duda', ficha: 'Arco' },
  { nome: 'Enzo', ficha: 'Adaga' },
  { nome: 'Fabio', ficha: 'Escudo' },
] as const
const GINA = 'Gina'
const LIVRO = 'Livro'
const MORDOMO = 'Mordomo'

const GRADE = 50
const COLUNAS = 20
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const CELULAR = { width: 390, height: 844 }

const CHAO_COZINHA = '#1e8c8c'
const CHAO_BIBLIOTECA = '#8c1e8c'
const COR_LIVRO = '#3cff00'
const COR_MACHADO = '#ff5a00'
const COR_NEUTRA = '#a0a0a0'

const PINTURA_MS = 400
const ESPERA = 6000
const ESPERA_TELA = 15_000
const PIXELS_DE_FICHA = 60
const PIXELS_DE_CENA = 2000
const RESIDUO = 25

const AGUARDANDO_PERSONAGEM = /Aguardando o mestre atribuir/
const DE_BRUNO = /Machado\s*—\s*de Bruno/
const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ── A aventura no disco: Cozinha (6 fichas de jogador + Mordomo) e Biblioteca (Livro)

function ficha(id: string, name: string, x: number, color: string, size = 1): Token {
  return { id, characterId: null, name, x, y: 300, size, image: null, color }
}

function cena(id: string, nome: string, chao: string, tokens: Token[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    tokens,
  }
}

function discoDaAventura(): Record<string, string> {
  const daCozinha = JOGADORES.map((j, i) => ficha(`tok-${j.ficha.toLowerCase()}`, j.ficha, 150 + i * 110, j.ficha === 'Machado' ? COR_MACHADO : COR_NEUTRA))
  // Suposição do NPC: a marca `npc: true` (ver cabeçalho).
  const mordomo = { ...ficha('tok-mordomo', MORDOMO, 850, COR_NEUTRA), npc: true } as Token
  const cozinha = cena('map_juiz', AVENTURA, CHAO_COZINHA, [...daCozinha, mordomo])
  const biblioteca = cena('map_biblioteca', BIBLIOTECA, CHAO_BIBLIOTECA, [ficha('tok-livro', LIVRO, 500, COR_LIVRO, 2)])
  const aventura = {
    version: 1,
    id: 'adv_juiz',
    name: AVENTURA,
    startSceneId: ID_COZINHA,
    scenes: [
      { id: ID_COZINHA, name: COZINHA, file: 'map.json' },
      { id: ID_BIBLIOTECA, name: BIBLIOTECA, file: `scenes/${ID_BIBLIOTECA}/map.json` },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(cozinha),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_BIBLIOTECA}/map.json`]: serializeMap(biblioteca),
  }
}

// ── O mestre: app em modo Tauri, disco e transporte de mentira (cópia enxuta da régua do Grupo)

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
  await esperaEditorNa(mestre, COZINHA)
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

/** A lista "Cenas" da aba Mapa marca a cena aberta no editor. */
async function esperaEditorNa(mestre: Page, nome: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  const painel = mestre.getByRole('tabpanel', { name: 'Mapa' })
  const cabecalho = painel.getByRole('button', { name: 'Cenas', exact: true })
  await expect(cabecalho, 'a aba Mapa deveria ter a seção "Cenas"').toBeVisible({ timeout: 10_000 })
  if ((await cabecalho.getAttribute('aria-expanded')) === 'false') await cabecalho.click()
  const corpo = await cabecalho.getAttribute('aria-controls')
  const lista = corpo ? mestre.locator(`[id="${corpo}"]`) : painel
  const destacada = async (cenaNome: string): Promise<boolean> => {
    const entrada = lista.getByRole('button', { name: cenaNome, exact: true })
    for (const atributo of ['aria-current', 'aria-selected', 'aria-pressed']) {
      const valor = await entrada.getAttribute(atributo)
      if (valor !== null && valor !== 'false') return true
    }
    return false
  }
  await expect.poll(() => destacada(nome), { timeout: ESPERA, message: `o editor do mestre deveria estar na cena "${nome}"` }).toBe(true)
  for (const outra of [COZINHA, BIBLIOTECA].filter((c) => c !== nome)) {
    expect(await destacada(outra), `o editor do mestre NÃO deveria ter trocado para "${outra}"`).toBe(false)
  }
}

function cardDeJogador(mestre: Page, jogador: string): Locator {
  return mestre.locator('#lb-rail-panel-room').locator('.lb-field').filter({ hasText: `${jogador} —` })
}

/** Botões de um clique do card: todo botão com "Atribuir <ficha>" no nome. */
function botoesDeAtribuir(card: Locator): Locator {
  return card.getByRole('button', { name: /Atribuir / })
}

/** Aba Jogo → card → "Atribuir <ficha>" (um clique); sem o botão, a lista "Atribuir token". */
async function mestreAtribui(mestre: Page, jogador: string, nomeDaFicha: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const card = cardDeJogador(mestre, jogador)
  const botao = card.getByRole('button', { name: new RegExp(`Atribuir ${escapar(nomeDaFicha)}$`) })
  if ((await botao.count()) > 0) {
    await botao.first().click()
  } else {
    const lista = card.getByRole('combobox')
    const texto = (await lista.locator('option', { hasText: nomeDaFicha }).first().textContent()) ?? nomeDaFicha
    await lista.selectOption({ label: texto.trim() })
  }
  await expect(card.getByRole('button', { name: `Remover ${nomeDaFicha}` }), `${jogador} deveria ficar com ${nomeDaFicha}`).toBeVisible({ timeout: ESPERA })
}

// ── Os jogadores: player.html inteiro, cada um no próprio navegador, em tela de celular

interface Jogador {
  page: Page
  nome: string
}

const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Jogador> {
  const contexto = await browser.newContext({ baseURL, viewport: CELULAR })
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
  return { page, nome }
}

interface Mesa {
  bruno: Jogador
  gina: Jogador
}

/** Sete entram; o mestre dá a ficha da Cozinha aos seis primeiros. Gina fica esperando. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const entrados: Jogador[] = []
  for (const [i, j] of JOGADORES.entries()) entrados.push(await jogadorEntra(browser, baseURL, rede, `c${i + 1}`, j.nome))
  const gina = await jogadorEntra(browser, baseURL, rede, 'c7', GINA)
  for (const j of JOGADORES) await mestreAtribui(mestre, j.nome, j.ficha)
  return { bruno: entrados[1], gina }
}

// ── Leitura de pixel (só LÊ a foto)

interface Pixels {
  limao: number
  laranja: number
  chaoCozinha: number
  chaoBiblioteca: number
}

async function lerTela(page: Page): Promise<Pixels> {
  await page.waitForTimeout(PINTURA_MS)
  const foto = await page.screenshot()
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const tela = document.createElement('canvas')
    tela.width = bmp.width
    tela.height = bmp.height
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d')
    ctx.drawImage(bmp, 0, 0)
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height)
    const r = { limao: 0, laranja: 0, chaoCozinha: 0, chaoBiblioteca: 0 }
    for (let i = 0; i < data.length; i += 4) {
      const R = data[i]
      const G = data[i + 1]
      const B = data[i + 2]
      if (G > 200 && R > 20 && R < 120 && B < 60) r.limao += 1
      else if (R > 200 && G > 50 && G < 140 && B < 60) r.laranja += 1
      else if (G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30 && G >= 35) r.chaoCozinha += 1
      else if (R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30) r.chaoBiblioteca += 1
    }
    return r
  }, foto.toString('base64'))
}

// ── As jornadas

test('1. controle: sete entram, seis recebem a ficha da Cozinha, Gina espera e o editor está na Cozinha', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { bruno, gina } = await mesaMontada(browser, page, baseURL ?? '')

  await expect(cardDeJogador(page, GINA), 'a aba Jogo deveria mostrar o card da Gina').toBeVisible({ timeout: ESPERA })
  await expect(cardDeJogador(page, GINA), 'Gina deveria estar aguardando').toContainText('aguardando')
  await expect(gina.page.getByText(AGUARDANDO_PERSONAGEM), 'o celular da Gina deveria dizer que aguarda personagem').toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await lerTela(bruno.page)).laranja, { timeout: ESPERA_TELA, message: 'Bruno deveria ver a própria ficha (Machado) no celular' })
    .toBeGreaterThan(PIXELS_DE_FICHA)
  expect((await lerTela(bruno.page)).chaoCozinha, 'Bruno deveria ver o chão da Cozinha').toBeGreaterThan(PIXELS_DE_CENA)
  await esperaEditorNa(page, COZINHA)
})

test('2. o card da Gina oferece primeiro "Biblioteca · Atribuir Livro" e nenhum botão com ficha de dono nem o Mordomo', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  await mesaMontada(browser, page, baseURL ?? '')
  await page.getByRole('tab', { name: 'Jogo' }).click()
  const card = cardDeJogador(page, GINA)
  await expect(card, 'a aba Jogo deveria mostrar o card da Gina').toBeVisible({ timeout: ESPERA })

  const botoes = botoesDeAtribuir(card)
  await expect(botoes.first(), 'o card da Gina deveria ter botões de um clique').toBeVisible({ timeout: ESPERA })
  const nomes = (await botoes.allInnerTexts()).map((t) => t.replace(/●/g, '').replace(/\s+/g, ' ').trim())
  expect(nomes[0] ?? '', `o PRIMEIRO botão de um clique da Gina deveria ser "Biblioteca · Atribuir Livro" (a ficha livre da outra cena); hoje: ${JSON.stringify(nomes)}`).toMatch(
    /Biblioteca\s*·?\s*Atribuir Livro|Atribuir Livro.*Biblioteca/,
  )
  const comDono = nomes.filter((n) => JOGADORES.some((j) => new RegExp(`Atribuir ${j.ficha}\\b`).test(n)))
  expect(comDono, 'nenhum botão de um clique da Gina pode oferecer a ficha de outro jogador (um clique derruba quem joga)').toEqual([])
  expect(nomes.filter((n) => /Atribuir Mordomo\b/.test(n)), 'o Mordomo (NPC) não pode virar botão de um clique').toEqual([])
})

test('3. um clique em "Atribuir Livro": o celular da Gina abre na Biblioteca e o editor fica na Cozinha', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { gina } = await mesaMontada(browser, page, baseURL ?? '')
  await page.getByRole('tab', { name: 'Jogo' }).click()
  const card = cardDeJogador(page, GINA)
  const livro = card.getByRole('button', { name: /Atribuir Livro\b/ })
  await expect(livro.first(), 'o card da Gina deveria oferecer "Atribuir Livro" em um clique (ficha livre da Biblioteca)').toBeVisible({ timeout: ESPERA })
  await livro.first().click()

  await expect(card.getByRole('button', { name: `Remover ${LIVRO}` }), 'Gina deveria ficar com o Livro').toBeVisible({ timeout: ESPERA })
  await expect(gina.page.getByText(AGUARDANDO_PERSONAGEM), 'o celular da Gina deveria sair da espera').toHaveCount(0, { timeout: ESPERA })
  await expect
    .poll(async () => (await lerTela(gina.page)).chaoBiblioteca, { timeout: ESPERA_TELA, message: 'o celular da Gina deveria abrir no chão da Biblioteca' })
    .toBeGreaterThan(PIXELS_DE_CENA)
  const tela = await lerTela(gina.page)
  expect(tela.limao, 'Gina deveria ver a própria ficha (Livro)').toBeGreaterThan(PIXELS_DE_FICHA)
  expect(tela.chaoCozinha, 'Gina NÃO deveria ver o chão da Cozinha').toBeLessThanOrEqual(RESIDUO)
  await esperaEditorNa(page, COZINHA)
})

test('4. "Machado — de Bruno" na lista pede confirmação e Cancelar mantém Bruno com o Machado', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { bruno } = await mesaMontada(browser, page, baseURL ?? '')
  await page.getByRole('tab', { name: 'Jogo' }).click()
  const card = cardDeJogador(page, GINA)
  const lista = card.getByRole('combobox', { name: 'Atribuir token' })
  await expect(lista, 'o card da Gina deveria ter a lista "Atribuir token"').toBeVisible({ timeout: ESPERA })
  const opcao = lista.locator('option').filter({ hasText: DE_BRUNO })
  await expect
    .poll(() => opcao.count(), { timeout: ESPERA, message: `a lista da Gina deveria marcar a ficha do Bruno como "Machado — de Bruno"; hoje: ${JSON.stringify(await lista.locator('option').allInnerTexts())}` })
    .toBeGreaterThan(0)
  await lista.selectOption({ label: ((await opcao.first().textContent()) ?? '').trim() })

  const confirmacao = page.getByRole('alertdialog').or(page.getByRole('dialog')).or(card)
  const cancelar = confirmacao.getByRole('button', { name: 'Cancelar', exact: true })
  await expect(cancelar.first(), 'escolher a ficha de outro jogador deveria pedir confirmação (botão "Cancelar")').toBeVisible({ timeout: ESPERA })
  await expect(cardDeJogador(page, 'Bruno').getByRole('button', { name: 'Remover Machado' }), 'antes de confirmar, o Machado ainda é do Bruno').toBeVisible()
  await cancelar.first().click()

  await page.waitForTimeout(800)
  await expect(cardDeJogador(page, 'Bruno').getByRole('button', { name: 'Remover Machado' }), 'Cancelar deveria manter o Machado com o Bruno').toBeVisible()
  await expect(card.getByRole('button', { name: 'Remover Machado' }), 'Cancelar não pode dar o Machado à Gina').toHaveCount(0)
  await expect(bruno.page.getByText(AGUARDANDO_PERSONAGEM), 'o celular do Bruno não pode voltar para a espera').toHaveCount(0)
})
