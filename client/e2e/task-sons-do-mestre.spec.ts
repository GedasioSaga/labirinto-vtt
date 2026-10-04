// E2E do pedido "sons" (PEDIDOS.md, 30/09/2026: "tocar um sound effect ao
// pegar um item ou ir para um cenário, tipo resident evil"), fatia 4: o que o
// MESTRE ouve no app.
//
// O QUE ESTA RÉGUA COBRA:
//   - o dado rolado na sala toca no app do mestre;
//   - a ficha que troca de cena na sessão ("Mandar para…" do Grupo, a viagem
//     que entra no diário) toca a passagem, uma vez;
//   - passar pelo pino de viagem DO EDITOR ("Ir para…", `handleTravelPin` em
//     App.tsx) não toca nada: é a vista do mestre, nenhuma ficha andou;
//   - o Mudo da mesa cala o bipe do "Chamar o mestre"; sem mudo, o bipe toca
//     no MESMO AudioContext dos sons de clima (um só na página).
//
// COMO PROVA: o app inteiro do mestre em modo Tauri, com disco e transporte de
// mentira (o mesmo preparo de task-jornada-diario-de-viagens.spec.ts), e o
// player.html inteiro de Ana, pelo WebSocket roteado. O áudio DO MESTRE é
// registrado por um `addInitScript` (como task-sons-do-jogador.spec.ts): cada
// oscilador e trecho de ruído que começa a tocar, e cada AudioContext criado.
// Gesto real (clique do Playwright); nada do app é trocado.
import { test, expect, type Browser, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Pin, Token } from '../src/types/map'
import { abrirAbaJogo, esconderColunaDireita } from './helpers/colunaDireita'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

interface RegistroDoSomDoMestre {
  /** Cada fonte que começou a tocar, na ordem: o tipo do oscilador, ou 'ruido'. */
  fontes: string[]
  /** Os contextos de áudio que a página criou. */
  contextos: BaseAudioContext[]
}

declare global {
  interface Window {
    __somDoMestre?: RegistroDoSomDoMestre
    /** O "Rust" de mentira entrega ao app um evento (`net:message`, o que chegou de um jogador). */
    __emitirNoMestre?: (evento: string, payload: unknown) => void
    /** `exposeFunction`: o `net_send` do mestre volta ao socket do jogador. */
    __mestreMandaAoJogador?: (clientId: string, texto: string) => Promise<void>
  }
}

const CODIGO = 'SOM444'
const AVENTURA = 'Casa do Som'
const PASTA = 'C:/appdata/maps/map_casa'
const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const CENA_A = 'Salão'
const CENA_B = 'Cripta'
const PINO_A = 'Escada que desce'
const JOGADORA = 'Ana'
const TELA = { width: 1280, height: 800 }
const ESPERA = 10_000
/** `CALL_MIN_INTERVAL_MS` (src/net/hostSession.ts) mais folga: chamado mais cedo é recusado pelo host. */
const DEPOIS_DO_INTERVALO_DO_CHAMADO_MS = 3_300
/** Folga para um som atrasado aparecer, antes de afirmar que nada mais tocou. */
const FOLGA_MS = 600

// As assinaturas são as receitas (src/lib/sons/receitas.ts), voz a voz, na ordem em que começam.
const DADO = ['ruido', 'sine', 'ruido', 'sine', 'ruido', 'sine', 'ruido', 'sine']
const PASSAGEM = ['sawtooth', 'sawtooth', 'sine', 'ruido', 'sine']
const ITEM = Array.from({ length: 8 }, () => 'sine')
/** O bipe de chamado (src/lib/signalSound.ts): um oscilador senoidal. */
const BIPE = ['sine']

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: duas cenas ligadas por um par de pinos de viagem
// ───────────────────────────────────────────────────────────────────────────

function pino(id: string, description: string, x: number, destino: NonNullable<Pin['destino']>): Pin {
  return { id, x, y: 300, kind: 'viagem', description, image: null, destino }
}

function cena(id: string, nome: string, tokens: Token[], pins: Pin[]): MapData {
  return { ...createEmptyMap(id, nome, 20, 12, 50), tokens, pins }
}

function discoDaAventura(): Record<string, string> {
  const ana: Token = { id: 'tok-ana', characterId: null, name: JOGADORA, x: 225, y: 225, size: 1, image: null }
  const salao = cena('map_casa', AVENTURA, [ana], [pino('pin-a', PINO_A, 700, { sceneId: ID_CENA_B, pinId: 'pin-b' })])
  const cripta = cena('map_cripta', CENA_B, [], [pino('pin-b', 'Escada que sobe', 300, { sceneId: ID_CENA_A, pinId: 'pin-a' })])
  const aventura = {
    version: 1,
    id: 'adv_casa',
    name: AVENTURA,
    startSceneId: ID_CENA_A,
    scenes: [
      { id: ID_CENA_A, name: CENA_A, file: 'map.json' },
      { id: ID_CENA_B, name: CENA_B, file: `scenes/${ID_CENA_B}/map.json` },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(salao),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_CENA_B}/map.json`]: serializeMap(cripta),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O áudio do mestre, registrado na própria página
// ───────────────────────────────────────────────────────────────────────────

/** Roda NA PÁGINA, antes de qualquer script dela: registra o áudio que começa a tocar. */
function instrumentarWebAudio(): void {
  const registro: RegistroDoSomDoMestre = { fontes: [], contextos: [] }
  window.__somDoMestre = registro
  const ContextoOriginal = window.AudioContext
  window.AudioContext = class extends ContextoOriginal {
    constructor(opcoes?: AudioContextOptions) {
      super(opcoes)
      registro.contextos.push(this)
    }
  }
  const tocarOscilador = OscillatorNode.prototype.start
  OscillatorNode.prototype.start = function (this: OscillatorNode, ...args: Parameters<OscillatorNode['start']>) {
    registro.fontes.push(this.type)
    tocarOscilador.apply(this, args)
  }
  const tocarBuffer = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
    // O buffer de 1 amostra é o destravamento do iOS (lib/sons/contexto.ts), não um som.
    if (this.buffer === null || this.buffer.length > 1) registro.fontes.push('ruido')
    tocarBuffer.apply(this, args)
  }
}

async function fontes(mestre: Page): Promise<string[]> {
  return mestre.evaluate(() => {
    const registro = window.__somDoMestre
    if (registro === undefined) throw new Error('o registro de som não foi instalado')
    return [...registro.fontes]
  })
}

async function estadosDosContextos(mestre: Page): Promise<string[]> {
  return mestre.evaluate(() => {
    const registro = window.__somDoMestre
    if (registro === undefined) throw new Error('o registro de som não foi instalado')
    return registro.contextos.map((ctx) => ctx.state)
  })
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco de mentira e transporte de mentira
// ───────────────────────────────────────────────────────────────────────────

/** O "Rust" de mentira: liga o WebSocket de Ana ao `net:*` do mestre, nos dois sentidos. */
interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Mensagens do jogador entregues ao mestre uma de cada vez, na ordem em que chegaram. */
  fila: Promise<void>
}

async function mestreAbreASala(mestre: Page): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), fila: Promise.resolve() }
  await mestre.exposeFunction('__mestreMandaAoJogador', (clientId: string, texto: string) => {
    rede.sockets.get(clientId)?.send(texto)
  })
  await mestre.addInitScript(instrumentarWebAudio)
  await mestre.addInitScript(
    ({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }) => {
      type EventoTauri = { event: string; id: number; payload: unknown }
      type HandlerTauri = (evento: EventoTauri) => void
      const textos: Record<string, string> = { ...arquivos }
      const pastas = new Set<string>()
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
      const existe = (caminho: string): boolean => {
        const c = semBarraFinal(caminho)
        return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
      }
      /** Os argumentos do `invoke` como campos soltos: o app manda objeto, e o resto vira vazio. */
      const campos = (valor: unknown): Record<string, unknown> => (typeof valor === 'object' && valor !== null ? Object.fromEntries(Object.entries(valor)) : {})
      const callbacks = new Map<number, HandlerTauri>()
      const ouvintes = new Map<number, { event: string; handler: HandlerTauri }>()
      let proximoId = 1
      window.__emitirNoMestre = (event, payload) => {
        for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
      }
      Object.assign(window, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
          convertFileSrc: (caminho: string) => String(caminho),
          transformCallback: (cb: HandlerTauri) => {
            const id = proximoId
            proximoId += 1
            callbacks.set(id, cb)
            return id
          },
          invoke: async (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => {
            const a = campos(args)
            switch (cmd) {
              case 'net_start_room':
                return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
              case 'net_send':
                void window.__mestreMandaAoJogador?.(String(a.clientId), JSON.stringify(a.msg))
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
                return Array.isArray(a.paths) ? a.paths.map(String).join('/') : ''
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
                if (args instanceof Uint8Array) textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args)
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
        },
      })
    },
    { arquivos: discoDaAventura(), codigo: CODIGO },
  )
  await mestre.setViewportSize(TELA)
  await mestre.goto('/')
  await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await mestre.waitForSelector('canvas')
  await abrirAbaJogo(mestre)
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

/** Aba Jogo, card de Ana em "Jogadores", "Atribuir Ana". */
async function mestreAtribuiAFicha(mestre: Page): Promise<void> {
  await abrirAbaJogo(mestre)
  const card = mestre.locator('#lb-rail-panel-room').locator('.lb-field').filter({ hasText: `${JOGADORA} —` })
  await card.getByRole('button', { name: `Atribuir ${JOGADORA}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${JOGADORA}` }), `${JOGADORA} deveria ficar com a ficha`).toBeVisible()
}

/** Abre o "Som da mesa" e aperta o Mudo; fecha com Esc. */
async function mestreAlternaOMudo(mestre: Page, mudoDepois: boolean): Promise<void> {
  await abrirAbaJogo(mestre)
  await mestre.locator('.lb-room').getByRole('button', { name: 'Som da mesa' }).click()
  const popover = mestre.getByRole('dialog', { name: 'Som da mesa' })
  await expect(popover).toBeVisible()
  const mudo = popover.getByRole('button', { name: 'Mudo' })
  await mudo.click()
  await expect(mudo).toHaveAttribute('aria-pressed', String(mudoDepois))
  await mestre.keyboard.press('Escape')
  await expect(popover).toBeHidden()
}

// ───────────────────────────────────────────────────────────────────────────
// Ana: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function anaEntra(browser: Browser, baseURL: string | undefined, rede: Rede): Promise<Page> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
  const clientId = 'c1'
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      rede.sockets.set(clientId, ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.fila = rede.fila
          .then(() =>
            rede.mestre.evaluate(
              ({ c, t }) => {
                const msg: unknown = JSON.parse(t)
                window.__emitirNoMestre?.('net:message', { clientId: c, msg })
              },
              { c: clientId, t: texto },
            ),
          )
          .catch(() => undefined)
      })
    },
  )
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODIGO)
  await page.getByLabel('Seu nome').fill(JOGADORA)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: ESPERA })
  return page
}

/** Mestre com a sala aberta e Ana na mesa, com a ficha dela no Salão. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string | undefined): Promise<{ ana: Page }> {
  const rede = await mestreAbreASala(mestre)
  const ana = await anaEntra(browser, baseURL, rede)
  await mestreAtribuiAFicha(mestre)
  await expect(ana.getByRole('button', { name: 'Chamar o mestre' }), 'Ana deveria estar no jogo, com a ficha').toBeVisible({ timeout: ESPERA })
  return { ana }
}

/** Ana chama o mestre (motivo padrão) e o mestre vê a linha "Ana: …" na caixa de chamados. */
async function anaChamaOMestre(ana: Page, mestre: Page): Promise<void> {
  await ana.getByRole('button', { name: 'Chamar o mestre' }).click()
  await ana.getByRole('button', { name: 'Chamar', exact: true }).click()
  await expect(ana.getByText(/^Esperando o mestre/)).toBeVisible({ timeout: ESPERA })
  await expect(mestre.getByText(new RegExp(`^${JOGADORA}: `)).first(), 'o chamado de Ana deveria chegar ao mestre').toBeVisible({ timeout: ESPERA })
}

// ───────────────────────────────────────────────────────────────────────────
// Os testes
// ───────────────────────────────────────────────────────────────────────────

test('o mestre ouve o dado e a passagem de verdade; o pino de viagem do editor fica mudo', async ({ page: mestre, browser, baseURL }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  mestre.on('pageerror', (erro) => erros.push(erro.message))
  await mesaMontada(browser, mestre, baseURL)
  // Os cliques do menu e o "Abrir sala" foram gestos: o áudio do mestre está destravado, e nada tocou.
  await expect.poll(() => estadosDosContextos(mestre), { message: 'o primeiro gesto no app destrava o áudio' }).toEqual(['running'])
  expect(await fontes(mestre)).toEqual([])

  // DADO: o mestre rola no dock da sala.
  await mestre.getByRole('button', { name: 'Dados', exact: true }).click()
  await mestre.getByRole('region', { name: 'Dados' }).getByRole('button', { name: 'Rolar', exact: true }).click()
  await expect.poll(() => fontes(mestre), { message: 'a rolagem da mesa toca o dado no mestre' }).toEqual(DADO)

  // EDITOR: o pino de viagem leva a VISTA do mestre à Cripta. Nenhuma ficha andou: nada toca.
  await esconderColunaDireita(mestre)
  await mestre.getByRole('button', { name: 'Pinos', exact: true }).click()
  await mestre.getByRole('list', { name: 'Pinos da aventura' }).getByRole('button').filter({ hasText: PINO_A }).click()
  await mestre.getByRole('group', { name: 'Destino da viagem' }).getByRole('button', { name: `Ir para ${CENA_B}` }).click()
  await expect(mestre.locator(`[data-cena-nome="${ID_CENA_B}"]`), 'o editor deveria estar na Cripta').toHaveAttribute('aria-current', 'true', { timeout: ESPERA })
  await mestre.waitForTimeout(FOLGA_MS)
  expect(await fontes(mestre), 'navegar no editor não é passagem').toEqual(DADO)

  // SESSÃO: o mestre manda Ana à Cripta. A ficha troca de cena de verdade: passagem, uma vez.
  await abrirAbaJogo(mestre)
  const grupo = mestre.locator('#lb-rail-panel-room').getByRole('region', { name: 'Grupo', exact: true })
  await grupo.getByRole('listitem').filter({ hasText: JOGADORA }).getByRole('button', { name: /^Mandar para(…|\.\.\.)$/ }).click()
  const envio = mestre.getByRole('form', { name: `Mandar ${JOGADORA} para outra cena` })
  await envio.getByLabel('Cena').selectOption({ label: CENA_B })
  await envio.getByRole('button', { name: 'Mandar', exact: true }).click()
  await expect.poll(() => fontes(mestre), { message: 'a ficha que troca de cena na sessão toca a passagem' }).toEqual([...DADO, ...PASSAGEM])
  await mestre.waitForTimeout(FOLGA_MS)
  expect(await fontes(mestre), 'uma viagem, uma passagem').toEqual([...DADO, ...PASSAGEM])
  expect(await estadosDosContextos(mestre)).toEqual(['running'])
  expect(erros).toEqual([])
})

test('o Mudo da mesa cala o bipe do chamado; sem mudo, o bipe toca no mesmo AudioContext dos sons', async ({ page: mestre, browser, baseURL }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  mestre.on('pageerror', (erro) => erros.push(erro.message))
  const { ana } = await mesaMontada(browser, mestre, baseURL)
  await expect.poll(() => estadosDosContextos(mestre)).toEqual(['running'])

  // MUDO: o chamado chega e aparece na caixa, sem bipe.
  await mestreAlternaOMudo(mestre, true)
  await anaChamaOMestre(ana, mestre)
  await mestre.waitForTimeout(FOLGA_MS)
  expect(await fontes(mestre), 'com o Mudo da mesa, o chamado não bipa').toEqual([])

  // Ana baixa a mão e espera o intervalo do host entre dois chamados.
  await ana.getByRole('button', { name: 'Baixar a mão' }).click()
  await ana.waitForTimeout(DEPOIS_DO_INTERVALO_DO_CHAMADO_MS)

  // SEM MUDO: tirar do mudo toca a amostra; o chamado seguinte bipa, no mesmo contexto.
  await mestreAlternaOMudo(mestre, false)
  await expect.poll(() => fontes(mestre), { message: 'tirar do mudo toca a amostra' }).toEqual(ITEM)
  await anaChamaOMestre(ana, mestre)
  await expect.poll(() => fontes(mestre), { message: 'sem mudo, o chamado bipa' }).toEqual([...ITEM, ...BIPE])
  expect(await estadosDosContextos(mestre), 'o bipe toca no contexto dos sons: nenhum AudioContext a mais').toEqual(['running'])
  expect(erros).toEqual([])
})
