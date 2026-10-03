// JORNADA DE USUÁRIO do CHAT SALVO (fatia B de docs/plano-chat.md).
//
// O PEDIDO: o chat fica salvo depois de fechar a sala. Decisões: histórico no
// PC do mestre, um JSONL por canal em `$APPDATA/chat/<mesa>/`; quem volta vê
// as últimas 200; o que o mestre apagou some para todos e sai do disco.
//
// COMO ESTE ARQUIVO PROVA (o preparo de task-jornada-chat-do-mestre.spec.ts):
//   O mestre é o app inteiro (modo Tauri) com um DISCO DE MENTIRA na página —
//   que vive enquanto a página vive, como o disco de verdade vive enquanto o
//   PC está ligado: fechar e reabrir a sala lê o que ficou nele. Ana é o
//   `player.html` inteiro. Só o transporte Rust e o disco são falsificados.
//   GESTO REAL: clique e teclado do Playwright. PROVA NA TELA: texto visível;
//   e o arquivo do canal, lido do disco de mentira.

import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'SALVO1'
const J1 = 'Ana'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const TOKEN_J1 = 'Lanterna'

const ID_CENA_A = 'scene_salao'
const PASTA = 'C:/appdata/maps/map_vale'
/** Onde o chat da aventura `adv_vale` mora: `$APPDATA/chat/<id da aventura>/`. */
const PASTA_DO_CHAT = 'C:/appdata/chat/adv_vale'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }

const ESPERA = 6000
const ESPERA_FALA = 10_000

const FALA_CENA = 'A porta do salão está trancada'
const FALA_APAGADA = 'isto aqui o mestre vai apagar'
const FALA_MESTRE = 'Pausa de 5 minutos, pessoal'

type Ponto = { x: number; y: number }

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function cena(id: string, nome: string, tokens: Token[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: '#1e8c8c' },
    tokens,
    pins: [],
  }
}

function discoDaAventura(): Record<string, string> {
  const cenaA = cena('map_vale', AVENTURA, [token('tok-lanterna', TOKEN_J1, { x: 700, y: 300 }, '#3cff00')])
  const aventura = { version: 1, id: 'adv_vale', name: AVENTURA, startSceneId: ID_CENA_A, scenes: [{ id: ID_CENA_A, name: CENA_A, file: 'map.json' }] }
  return {
    [`${PASTA}/map.json`]: serializeMap(cenaA),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
  }
}

type EventoTauri = { event: string; id: number; payload: unknown }
type HandlerTauri = (evento: EventoTauri) => void
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __labParaJogador: (clientId: string, texto: string) => void
  /** O disco de mentira, para o teste ler o arquivo do canal. */
  __labDisco: Record<string, string>
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
      alvo.__labDisco = textos
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
      // O `unlisten` do Tauri passa por aqui antes do invoke: sem isto, fechar a
      // sala deixaria o ouvinte velho vivo, e a sala reaberta ouviria tudo duas vezes.
      Reflect.set(window, '__TAURI_EVENT_PLUGIN_INTERNALS__', { unregisterListener: (_event: string, id: number) => ouvintes.delete(id) })
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
            case 'plugin:fs|write_text_file': {
              // O `append` do chat chega nas opções do cabeçalho, como no plugin de verdade.
              const caminho = decodeURIComponent(options?.headers?.path ?? '')
              const opcoes = JSON.parse(options?.headers?.options ?? 'null') as { append?: boolean } | null
              const texto = new TextDecoder().decode(args as Uint8Array)
              textos[caminho] = opcoes?.append === true ? (textos[caminho] ?? '') + texto : texto
              return null
            }
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
            case 'plugin:fs|remove':
              delete textos[String(a.path)]
              return null
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
  const painel = mestre.locator('#lb-rail-panel-room')
  const card = painel.locator('.lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${nomeDoToken}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDoToken}` }), `${jogador} deveria ficar com ${nomeDoToken}`).toBeVisible()
}

const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Page> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
  // Cada socket é uma conexão nova, como no Rust: a reconexão do jogador ganha outro id.
  let conexoes = 0
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      conexoes += 1
      const id = conexoes === 1 ? clientId : `${clientId}-${conexoes}`
      rede.sockets.set(id, ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.fila = rede.fila
          .then(() =>
            rede.mestre.evaluate(
              ({ c, t }) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: c, msg: JSON.parse(t) as unknown }),
              { c: id, t: texto },
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
  return page
}

async function jogadorVeAFicha(page: Page, nomeDoToken: string, quem: string): Promise<void> {
  await expect(page.locator('canvas').first(), `${quem}: o mapa não apareceu na tela`).toBeVisible({ timeout: 10_000 })
  const alternar = page.getByRole('button', { name: 'Painel', exact: true })
  if (await alternar.isVisible()) await alternar.click()
  await expect(page.getByRole('button', { name: `Centralizar em ${nomeDoToken}` }), `${quem}: a ficha ${nomeDoToken} deveria estar no painel`).toBeVisible({ timeout: 10_000 })
}

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

/** O arquivo de um canal no disco de mentira do mestre (`''` = não existe). */
async function arquivoDoCanal(mestre: Page, arquivo: string): Promise<string> {
  return mestre.evaluate((caminho) => (window as unknown as JanelaDoMestre).__labDisco[caminho] ?? '', `${PASTA_DO_CHAT}/${arquivo}`)
}

test('o chat fica salvo: fecha a sala, reabre, e a conversa volta para o mestre e para Ana; a apagada não volta', async ({ browser, page, baseURL }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(TELA)
  const mestre = page
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL ?? 'http://localhost:1420', rede, 'c1', J1)
  await expect(ana.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await jogadorVeAFicha(ana, TOKEN_J1, J1)

  // A conversa: Ana na cena e no Global, o mestre no Global.
  await jogadorFala(ana, 'Cena', FALA_CENA)
  await jogadorFala(ana, 'Global', FALA_APAGADA)
  const botao = mestre.getByRole('button', { name: /^Chat/ })
  await botao.click()
  const painel = painelDoChat(mestre)
  const campo = painel.getByRole('textbox', { name: 'Mensagem para o Global' })
  await campo.click()
  await campo.pressSequentially(FALA_MESTRE, { delay: 10 })
  await campo.press('Enter')
  await expect(painel.locator('li.lb-mchat__msg--master')).toContainText(FALA_MESTRE)

  // O mestre apaga a fala de Ana no Global.
  const apagavel = painel.locator('li.lb-mchat__msg').filter({ hasText: FALA_APAGADA })
  await apagavel.hover()
  await apagavel.getByRole('button', { name: /^Apagar a mensagem de Ana/ }).click()
  await apagavel.getByRole('button', { name: 'Apagar', exact: true }).click()
  await expect(painel.locator('.lb-mchat__log')).not.toContainText(FALA_APAGADA)

  // No disco: um arquivo por canal; a apagada saiu do Global.
  await expect.poll(() => arquivoDoCanal(mestre, 'global.jsonl'), { timeout: ESPERA }).toContain(FALA_MESTRE)
  await expect.poll(() => arquivoDoCanal(mestre, 'global.jsonl'), { timeout: ESPERA }).not.toContain(FALA_APAGADA)
  await expect.poll(() => arquivoDoCanal(mestre, 'cena-map_vale.jsonl'), { timeout: ESPERA }).toContain(FALA_CENA)

  // Fecha a sala: o painel do chat some junto.
  await botao.click()
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Fechar sala' }).click()
  await expect(mestre.getByRole('button', { name: /^Chat/ })).toHaveCount(0)
  await expect(ana.getByText('O mestre encerrou a sala.').first()).toBeVisible({ timeout: ESPERA_FALA })

  // Reabre retomando a mesa: a conversa volta para o mestre, sem contar como nova.
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await mestre.getByRole('button', { name: 'Retomar a mesa', exact: true }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  const botaoDeNovo = mestre.getByRole('button', { name: /^Chat/ })
  await expect(botaoDeNovo).toHaveAccessibleName('Chat', { timeout: ESPERA })
  await botaoDeNovo.click()
  await expect(painel.locator('.lb-mchat__log')).toContainText(FALA_MESTRE)
  await expect(painel.locator('.lb-mchat__log')).not.toContainText(FALA_APAGADA)
  await canalDoMestre(mestre, CENA_A).click()
  await expect(painel.locator('.lb-mchat__log')).toContainText(FALA_CENA)
  await mestre.screenshot({ path: 'test-results/chat-salvo-1-mestre-reabriu.png' })

  // Ana volta (aparelho novo, mesmo nome): a mesa devolve a ficha e o chat volta para ela.
  const anaDeNovo = await jogadorEntra(browser, baseURL ?? 'http://localhost:1420', rede, 'c2', J1)
  await jogadorVeAFicha(anaDeNovo, TOKEN_J1, J1)
  await jogadorNoCanal(anaDeNovo, 'Global')
  await expect(logDoJogador(anaDeNovo)).toContainText(FALA_MESTRE, { timeout: ESPERA_FALA })
  await expect(logDoJogador(anaDeNovo)).not.toContainText(FALA_APAGADA)
  await jogadorNoCanal(anaDeNovo, 'Cena')
  await expect(logDoJogador(anaDeNovo)).toContainText(FALA_CENA, { timeout: ESPERA_FALA })
  await anaDeNovo.screenshot({ path: 'test-results/chat-salvo-2-ana-voltou.png' })

  // A conversa continua gravando depois de reabrir.
  await jogadorFala(anaDeNovo, 'Cena', 'voltei')
  await expect.poll(() => arquivoDoCanal(mestre, 'cena-map_vale.jsonl'), { timeout: ESPERA }).toContain('voltei')
  expect((await arquivoDoCanal(mestre, 'cena-map_vale.jsonl')).trim().split('\n')).toHaveLength(2)
})
