// JORNADA DE USUÁRIO do LASER DO JOGADOR (item 7) — escrita para SAIR VERMELHA
// no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (docs/features-candidatas-2026-09-21.md, item 7):
//   - o jogador aponta com laser: com o botão "Laser" do painel dele ligado,
//     segurar e arrastar na tela desenha um rastro;
//   - o rastro aparece, por alguns segundos, na tela do mestre e na de cada
//     jogador da MESMA cena, na COR DA FICHA de quem apontou;
//   - quem está em outra cena não vê nada e não recebe nada pelo socket;
//   - soltar o botão deixa o rastro sumir sozinho em poucos segundos.
//
// ONDE ISSO MORRE HOJE: o laser só vai do mestre ao jogador. O protocolo
// (`net/protocol.ts:148-149`, bloco "Mestre -> jogador") só tem `LaserMessage`
// do mestre, e a sessão do host (`net/hostSession.ts:834-846`) não tem `case`
// para laser vindo do jogador; a cor é fixa (`lib/laser.ts:16`, LASER_COLOR
// '#ff2d2d', rótulo "Mestre"). Na tela do jogador, o painel
// (`player/PlayerPanel.tsx:220-229`) tem "Centralizar", "Sinalizar" e "Medir",
// e arrastar no chão só move a câmera dele (`player/PlayerView.tsx:1093`,
// `scene.drag = { kind: 'pan' ... }`).
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-recado-por-cena.spec.ts e task-jornada-medir-na-tela-do-jogador.spec.ts):
//   QUATRO TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   Ana, Caio e Bruno são o `player.html` inteiro, cada um no próprio contexto
//   de navegador. Só o TRANSPORTE Rust é falsificado: o que o jogador manda
//   pelo WebSocket roteado vira `net:message` no mestre, e o `net_send` do
//   mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: Salão e Cripta num
//   `adventure.json`, aberto pelo menu como na mesa. Ana (ficha verde-limão) e
//   Caio (ficha azul) estão no Salão; Bruno (ficha laranja) na Cripta. As
//   fichas são atribuídas pelo gesto "Atribuir <ficha>" da aba Jogo.
//   GESTO REAL NA AÇÃO SOB TESTE: clique no botão "Laser" da tela de Ana; o
//   ponteiro dela desce no chão, para um instante, vai e volta sobre o chão
//   (quem aponta com laser acena) e, antes de soltar, para de novo. Os únicos
//   `evaluate` são o do transporte e a LEITURA de pixel (decodificar a foto
//   num canvas solto e perguntar `elementFromPoint`).
//   PROVA NA TELA: verde-limão NOVO (que não estava na foto de antes do gesto)
//   só onde o CANVAS está por cima, e a EXTENSÃO dele somada nas fotos tiradas
//   enquanto Ana acena: o laser atravessa a tela seguindo o ponteiro dela; a
//   ficha parada, o ponto do "Sinalizar" (anel fixo de no máximo 68 px, cor da
//   paleta de sinais, nunca o verde-limão) e o painel não passam no corte.
//   Somar fotos, e não exigir o rastro inteiro numa foto só, é medido: sob
//   carga a foto do laser do MESTRE pegava só a ponta (164 px, 38 px de lado).
//   Nada é lido da store.
//   O editor do mestre é posto a 100% pelo clique no indicador de zoom (ele
//   abre a 218% enquadrando só as fichas).
//   FRAMES. Com o socket roteado o navegador não emite `framereceived`; o que a
//   página recebe é o que a rota entrega com `ws.send`, e é ali que a régua
//   anota (`Rede.enviados`).
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - a tela do jogador tem um botão cujo nome acessível começa por "Laser"
//     (no "Painel do jogador", ao lado de "Medir"), que ligado fica
//     `aria-pressed="true"`; com ele ligado, apertar e arrastar no chão desenha
//     o rastro (o arrasto sem o botão continua sendo mover a câmera);
//   - o rastro é desenhado com a cor da ficha do jogador (#3cff00 para Ana),
//     no espaço do mapa, e fica visível para quem está na cena enquanto o
//     ponteiro se move e por alguns segundos depois de soltar;
//   - "some sozinho": até 10 s depois de soltar, nada do rastro resta na tela
//     de Caio. A régua NÃO cobra que o rastro continue visível depois de
//     soltar (a foto sob carga custa segundos e um rastro de 1 s escaparia).
//   - o mestre vê o rastro quando o editor dele está na cena de Ana; o que o
//     mestre vê com o editor em OUTRA cena não é cobrado aqui.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ele prova que a mesa monta, que o
// caminho do gesto na tela de Ana é chão do Salão sem painel por cima, que o
// classificador acha a cor da ficha de Ana na tela de Caio, e que o leitor de
// EXTENSÃO acha um rastro de verdade: o laser do mestre (que existe hoje)
// chega vermelho e comprido à tela de Caio e nenhum frame dele chega a Bruno.
// Sem ele, o vermelho dos testes 2 a 5 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

// Código da sala que não é palavra da interface (não casa com "Laser").
const CODIGO = 'LSR077'
const J1 = 'Ana'
const J2 = 'Bruno'
const J3 = 'Caio'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'

const TOKEN_J1 = 'Lanterna'
const TOKEN_J2 = 'Machado'
const TOKEN_J3 = 'Adaga'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const PASTA = 'C:/appdata/maps/map_vale'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx — a conta de câmera tem de ser a mesma. */
const FIT_MARGIN = 24

const CHAO_A = '#1e8c8c'
const CHAO_B = '#8c1e8c'
/** Ficha de Ana: verde-limão, cor que nada mais no app usa (nem a paleta de sinais). */
const COR_J1 = '#3cff00'
const COR_J2 = '#ff5a00'
const COR_J3 = '#2850ff'

type Ponto = { x: number; y: number }
const casa = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const POS_J1 = casa(14, 4)
const POS_J2 = casa(20, 4)
const POS_J3 = casa(24, 4)
/** Caminho do laser de Ana, em px de mundo: chão livre três casas abaixo das fichas. */
const LASER_DE = casa(12, 7)
const LASER_ATE = casa(26, 7)

/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Parada do ponteiro antes de andar e antes de soltar. */
const PAUSA_MS = 300
/** Espera curta por elemento: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** "Alguns segundos": até aqui depois de soltar, o rastro já sumiu. */
const SOME_EM_MS = 10_000
const PIXELS_DE_CENA = 2000
/** Pixels da ficha de Ana na tela de outro (ficha de 50 px de mundo: ~30 px de tela). */
const PIXELS_DE_FICHA = 60
/** Pixels máximos para dizer "esta cor NÃO está aqui" (antisserrilhado). */
const RESIDUO = 25
/** Laser que atravessa a tela: a cor nova, somada nas fotos, cobre pelo menos isto (px CSS). O anel do sinal tem 68. */
const EXTENSAO_DE_RASTRO = 120
/** Pixels da cor nova numa foto só para dizer "o laser está na tela" (a ponta do laser do mestre sozinha deu 164). */
const PIXELS_DE_RASTRO = 40
/** Janela para somar as fotos enquanto o ponteiro acena (cada foto custa segundos sob carga). */
const ESPERA_RASTRO = 30_000

const BOTAO_LASER = /^Laser/

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: Ana e Caio no Salão, Bruno na Cripta
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
  const cenaA = cena('map_vale', AVENTURA, CHAO_A, [token('tok-lanterna', TOKEN_J1, POS_J1, COR_J1), token('tok-adaga', TOKEN_J3, POS_J3, COR_J3)])
  const cenaB = cena('map_cripta', CENA_B, CHAO_B, [token('tok-machado', TOKEN_J2, POS_J2, COR_J2)])
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
  /** Tudo que o mestre mandou para cada jogador, em ordem (o que o fio entregou). */
  enviados: Map<string, string[]>
  /** Mensagens do jogador entregues ao mestre uma de cada vez, na ordem em que chegaram. */
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
  const lista = await secaoCenas(mestre)
  await expect.poll(() => estaDestacada(entradaDaCena(lista, CENA_A)), { message: `a aventura deveria abrir na cena "${CENA_A}"` }).toBe(true)
  await expect(entradaDaCena(lista, CENA_B), `a lista de Cenas deveria ter "${CENA_B}"`).toBeVisible()

  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

/** A seção "Cenas" da aba Mapa, aberta. */
async function secaoCenas(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Mapa' }).click()
  const painel = page.getByRole('tabpanel', { name: 'Mapa' })
  const cabecalho = painel.getByRole('button', { name: 'Cenas', exact: true })
  await expect(cabecalho, 'a aba Mapa do rail deveria ter uma seção "Cenas"').toBeVisible({ timeout: 10_000 })
  if ((await cabecalho.getAttribute('aria-expanded')) === 'false') await cabecalho.click()
  await expect(cabecalho).toHaveAttribute('aria-expanded', 'true')
  const corpo = await cabecalho.getAttribute('aria-controls')
  return corpo ? page.locator(`[id="${corpo}"]`) : painel
}

function entradaDaCena(lista: Locator, nome: string): Locator {
  return lista.getByRole('button', { name: nome, exact: true })
}

async function estaDestacada(entrada: Locator): Promise<boolean> {
  for (const atributo of ['aria-current', 'aria-selected', 'aria-pressed']) {
    const valor = await entrada.getAttribute(atributo)
    if (valor !== null && valor !== 'false') return true
  }
  return false
}

/** O editor do mestre vai a outra cena pela lista de Cenas, como na mesa. */
async function mestreAbreCena(mestre: Page, nome: string): Promise<void> {
  const lista = await secaoCenas(mestre)
  await entradaDaCena(lista, nome).click()
  await expect.poll(() => estaDestacada(entradaDaCena(lista, nome)), { message: `o editor deveria abrir a cena "${nome}"`, timeout: ESPERA }).toBe(true)
}

/** Aba Jogo, card do jogador, "Atribuir <ficha>" — o clique de um toque que o painel oferece. */
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

interface Jogador {
  page: Page
  clientId: string
  nome: string
  /** Todo frame que a PÁGINA recebeu no WebSocket, desde antes de entrar (anotado na rota). */
  frames: string[]
}

/** Contextos de jogador abertos pelo teste que está rodando; o `page` do mestre o Playwright fecha sozinho. */
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
  return { page, clientId, nome, frames }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura da tela (só leitura: foto decodificada num canvas solto)
// ───────────────────────────────────────────────────────────────────────────

interface Leitura {
  /** Chão do Salão (verde-água), qualquer brilho. */
  salao: number
  /** Chão da Cripta (magenta), qualquer brilho. */
  cripta: number
  /** Verde-limão (cor da ficha de Ana), em toda a área do canvas. */
  lima: number
  /** Verde-limão em blocos de 8 px que NÃO tinham verde-limão na foto de base. */
  limaNova: number
  /** Caixa (px CSS) que envolve o verde-limão novo; `null` se não há. */
  caixaLima: Caixa | null
  /** Blocos de 8 px com verde-limão (a base da próxima leitura). */
  blocosLima: number[]
  /** Vermelho do laser do mestre (#ff2d2d). */
  vermelho: number
  /** Caixa (px CSS) que envolve o vermelho; `null` se não há. */
  caixaVermelho: Caixa | null
}

interface Caixa {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Soma o que o olho viu em várias fotos enquanto o ponteiro acena: a caixa
 * que envolve TODAS as marcas. Um rastro (ou a ponta do laser atravessando a
 * tela) cresce a caixa; a ficha parada e o anel fixo do "Sinalizar" não.
 * Medido em 22/09: sob carga, a foto pegava só a ponta do laser do mestre
 * (164 px, 38 px de lado) — o rastro de 1 s já tinha esmaecido.
 */
class Acumulado {
  private caixa: Caixa | null = null
  soma(c: Caixa | null): void {
    if (c === null) return
    this.caixa = this.caixa === null ? { ...c } : { x0: Math.min(this.caixa.x0, c.x0), y0: Math.min(this.caixa.y0, c.y0), x1: Math.max(this.caixa.x1, c.x1), y1: Math.max(this.caixa.y1, c.y1) }
  }
  get extensao(): number {
    return this.caixa === null ? 0 : Math.max(this.caixa.x1 - this.caixa.x0, this.caixa.y1 - this.caixa.y0)
  }
}

async function foto(page: Page): Promise<string> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return (await page.screenshot()).toString('base64')
    } catch {
      await page.waitForTimeout(200)
    }
  }
  throw new Error('régua: não consegui fotografar a tela')
}

/**
 * Fotografa e classifica os pixels onde o CANVAS está por cima (painéis,
 * pontinho de cor do painel e cartões não contam). `base`: blocos que já
 * tinham verde-limão antes do gesto (a ficha de Ana, parada).
 */
async function lerTela(page: Page, base: readonly number[] = []): Promise<Leitura> {
  await page.waitForTimeout(PINTURA_MS)
  const b64 = await foto(page)
  return page.evaluate(
    async ({ b64, base }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escalaX = window.innerWidth / width
      const escalaY = window.innerHeight / height
      const noCanvas = new Map<number, boolean>()
      const chave = (x: number, y: number): number => (y >> 3) * 65536 + (x >> 3)
      const canvasPorCima = (x: number, y: number): boolean => {
        const k = chave(x, y)
        let v = noCanvas.get(k)
        if (v === undefined) {
          v = document.elementFromPoint(((x >> 3) * 8 + 4) * escalaX, ((y >> 3) * 8 + 4) * escalaY)?.tagName === 'CANVAS'
          noCanvas.set(k, v)
        }
        return v
      }
      const jaTinha = new Set(base)
      const blocosLima = new Set<number>()
      let salao = 0
      let cripta = 0
      let lima = 0
      let limaNova = 0
      let vermelho = 0
      const caixaLima = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
      const caixaVermelho = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
      const cresce = (c: typeof caixaLima, x: number, y: number): void => {
        c.x0 = Math.min(c.x0, x)
        c.y0 = Math.min(c.y0, y)
        c.x1 = Math.max(c.x1, x)
        c.y1 = Math.max(c.y1, y)
      }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30
          const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
          const verdeLimao = G > 170 && G > R * 2 && G > B * 2
          const vermelhoLaser = R > 190 && G < 90 && B < 90 && Math.abs(G - B) < 40
          if (!verdeAgua && !magenta && !verdeLimao && !vermelhoLaser) continue
          if (!canvasPorCima(x, y)) continue
          if (verdeAgua) salao += 1
          else if (magenta) cripta += 1
          else if (verdeLimao) {
            lima += 1
            const k = chave(x, y)
            blocosLima.add(k)
            if (!jaTinha.has(k)) {
              limaNova += 1
              cresce(caixaLima, x, y)
            }
          } else {
            vermelho += 1
            cresce(caixaVermelho, x, y)
          }
        }
      }
      const emCss = (c: typeof caixaLima) => (c.x1 < c.x0 ? null : { x0: c.x0 * escalaX, y0: c.y0 * escalaY, x1: c.x1 * escalaX, y1: c.y1 * escalaY })
      return {
        salao,
        cripta,
        lima,
        limaNova,
        caixaLima: emCss(caixaLima),
        blocosLima: Array.from(blocosLima),
        vermelho,
        caixaVermelho: emCss(caixaVermelho),
      }
    },
    { b64, base: Array.from(base) },
  )
}

/** Para cada ponto (px CSS): o canvas está por cima e o pixel é chão do Salão? Só leitura da foto. */
async function saoChaoDoSalao(page: Page, pontos: readonly Ponto[]): Promise<boolean[]> {
  await page.waitForTimeout(PINTURA_MS)
  const b64 = await foto(page)
  return page.evaluate(
    async ({ b64, pontos }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')
      ctx.drawImage(bmp, 0, 0)
      const fx = bmp.width / window.innerWidth
      const fy = bmp.height / window.innerHeight
      return pontos.map((p) => {
        if (document.elementFromPoint(p.x, p.y)?.tagName !== 'CANVAS') return false
        const [R, G, B] = ctx.getImageData(Math.round(p.x * fx), Math.round(p.y * fy), 1, 1).data
        return G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30
      })
    },
    { b64, pontos: Array.from(pontos) },
  )
}

/** Espera o chão da cena dele chegar à tela do jogador (poll de pixel com folga). */
async function esperaChaoNaTela(j: Jogador, cena: 'salao' | 'cripta', nomeDaCena: string): Promise<void> {
  await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerTela(j.page))[cena], { timeout: ESPERA_TELA, message: `${j.nome}: o chão de "${nomeDaCena}" não foi pintado na tela dele` })
    .toBeGreaterThan(PIXELS_DE_CENA)
}

// ───────────────────────────────────────────────────────────────────────────
// A mesa e os gestos
// ───────────────────────────────────────────────────────────────────────────

interface Mesa {
  rede: Rede
  ana: Jogador
  bruno: Jogador
  caio: Jogador
}

/**
 * Mestre abre a aventura e a sala; Ana, Bruno e Caio entram; Ana e Caio
 * ganham a ficha no Salão, Bruno a dele com o editor na Cripta. O editor volta
 * ao Salão, que é onde o mestre fica olhando.
 */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', J2)
  const caio = await jogadorEntra(browser, baseURL, rede, 'c3', J3)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestreAtribui(mestre, J3, TOKEN_J3)
  await mestreAbreCena(mestre, CENA_B)
  await mestreAtribui(mestre, J2, TOKEN_J2)
  await mestreAbreCena(mestre, CENA_A)
  await esperaChaoNaTela(ana, 'salao', CENA_A)
  await esperaChaoNaTela(caio, 'salao', CENA_A)
  await esperaChaoNaTela(bruno, 'cripta', CENA_B)
  await mestreVoltaAoZoom100(mestre)
  return { rede, ana, bruno, caio }
}

/**
 * Clique no indicador de zoom do editor ("Zoom: N%"): volta a 100%, com o
 * canto do mapa no canto da tela. Sem isso o editor abria a 218% enquadrando
 * só as fichas (medido em 22/09; a tecla F faz o mesmo enquadramento), e o
 * caminho do laser de Ana ficava na beirada da tela do mestre.
 */
async function mestreVoltaAoZoom100(mestre: Page): Promise<void> {
  const zoom = mestre.getByRole('button', { name: /^Zoom: / })
  await zoom.click()
  await expect(zoom, 'o indicador de zoom do editor deveria voltar a 100%').toHaveAccessibleName(/^Zoom: 100%/, { timeout: ESPERA })
  await mestre.waitForTimeout(PINTURA_MS)
}

const CAMERA_DO_JOGADOR = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)

/** Ponto do mundo → ponto da tela do jogador, com a câmera de "encaixar a cena". */
function naTelaDoJogador(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA_DO_JOGADOR.scale + CAMERA_DO_JOGADOR.x), y: Math.round(p.y * CAMERA_DO_JOGADOR.scale + CAMERA_DO_JOGADOR.y) }
}

/** O botão "Laser" na tela do jogador. */
function botaoLaser(page: Page): Locator {
  return page.getByRole('button', { name: BOTAO_LASER })
}

/** Clica "Laser" na tela do jogador e confere que ele ficou pressionado. */
async function jogadorLigaLaser(j: Jogador): Promise<void> {
  const botao = botaoLaser(j.page)
  await expect(botao, `a tela de ${j.nome} deveria ter o botão "Laser" (no painel do jogador, ao lado de "Medir")`).toBeVisible({ timeout: ESPERA })
  await botao.click()
  await expect(botao, `"Laser" clicado deveria ficar pressionado (aria-pressed="true")`).toHaveAttribute('aria-pressed', 'true', { timeout: ESPERA })
}

/**
 * Quem aponta com laser acena: o ponteiro desce em `de`, para um instante e
 * vai e volta até `ate` enquanto `enquanto` roda (a régua olha as outras
 * telas nesse meio-tempo). Antes de soltar, para de novo.
 */
async function acenar(page: Page, de: Ponto, ate: Ponto, enquanto: () => Promise<void>): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_MS)
  let parar = false
  const vaiEVolta = (async () => {
    let ida = true
    while (!parar) {
      const alvo = ida ? ate : de
      await page.mouse.move(alvo.x, alvo.y, { steps: 14 })
      ida = !ida
    }
  })()
  try {
    await enquanto()
  } finally {
    parar = true
    await vaiEVolta.catch(() => undefined)
    await page.waitForTimeout(PAUSA_MS)
    await page.mouse.up()
  }
}

/** Ana liga o Laser e acena sobre o chão do Salão enquanto `enquanto` roda. */
async function anaApontaComLaser(ana: Jogador, enquanto: () => Promise<void>): Promise<void> {
  await jogadorLigaLaser(ana)
  await acenar(ana.page, naTelaDoJogador(LASER_DE), naTelaDoJogador(LASER_ATE), enquanto)
}

/**
 * Poll enquanto Ana acena: verde-limão NOVO aparece na tela `page` (o laser,
 * não a ficha parada) e, somando as fotos, se espalha pela tela — o laser
 * acompanha o ponteiro de Ana de uma ponta à outra do caminho.
 */
async function esperaRastroLima(page: Page, base: readonly number[], quem: string): Promise<void> {
  const visto = new Acumulado()
  let maior = 0
  await expect
    .poll(
      async () => {
        const l = await lerTela(page, base)
        visto.soma(l.caixaLima)
        maior = Math.max(maior, l.limaNova)
        return maior >= PIXELS_DE_RASTRO && visto.extensao >= EXTENSAO_DE_RASTRO
          ? 'rastro'
          : `sem rastro (lima nova até ${maior} px, espalhada por ${Math.round(visto.extensao)} px)`
      },
      { timeout: ESPERA_RASTRO, message: `${quem} deveria ver o laser de ${J1}, na cor da ficha dela (${COR_J1}), atravessar a tela` },
    )
    .toBe('rastro')
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: a mesa monta, o caminho de Ana é chão, Caio vê a ficha verde-limão dela e o laser do mestre chega comprido a Caio e não a Bruno', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { ana, bruno, caio } = await mesaMontada(browser, page, baseURL ?? '')

  // O caminho do gesto na tela de Ana é chão do Salão, com o canvas por cima (sem painel).
  const caminho = [LASER_DE, casa(19, 7), LASER_ATE].map(naTelaDoJogador)
  expect(await saoChaoDoSalao(ana.page, caminho), `o caminho do laser na tela de ${J1} deveria ser chão do ${CENA_A}, sem painel por cima`).toEqual([true, true, true])

  // O classificador acha a cor da ficha de Ana na tela de OUTRO jogador da cena.
  const telaDeCaio = await lerTela(caio.page)
  expect(telaDeCaio.salao, `${J3} deveria ver o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(telaDeCaio.lima, `${J3} deveria ver a ficha verde-limão de ${J1}`).toBeGreaterThan(PIXELS_DE_FICHA)
  expect(telaDeCaio.vermelho, `antes do laser do mestre, nada vermelho na tela de ${J3}`).toBeLessThanOrEqual(RESIDUO)
  const telaDeBruno = await lerTela(bruno.page)
  expect(telaDeBruno.cripta, `${J2} deveria ver o chão da ${CENA_B}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(telaDeBruno.salao, `${J2} não deveria ver chão do ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)
  expect(telaDeBruno.lima, `${J2} não deveria ver verde-limão`).toBeLessThanOrEqual(RESIDUO)

  // O leitor de EXTENSÃO acha um rastro de verdade: o laser do mestre, que existe hoje.
  await page.getByRole('tab', { name: 'Jogo' }).click()
  const laserDoMestre = page.getByRole('button', { name: 'Laser', exact: true })
  await laserDoMestre.click()
  await expect(laserDoMestre, 'o Laser do mestre deveria ficar pressionado').toHaveAttribute('aria-pressed', 'true')
  const canvas = await page.locator('canvas').first().boundingBox()
  if (canvas === null) throw new Error('régua: o editor do mestre sem canvas')
  const de = { x: Math.round(canvas.x + canvas.width * 0.3), y: Math.round(canvas.y + canvas.height * 0.55) }
  const ate = { x: Math.round(canvas.x + canvas.width * 0.9), y: de.y }
  await acenar(page, de, ate, async () => {
    const visto = new Acumulado()
    let maior = 0
    await expect
      .poll(
        async () => {
          const l = await lerTela(caio.page)
          visto.soma(l.caixaVermelho)
          maior = Math.max(maior, l.vermelho)
          return maior >= PIXELS_DE_RASTRO && visto.extensao >= EXTENSAO_DE_RASTRO
            ? 'rastro'
            : `sem rastro (vermelho até ${maior} px, espalhado por ${Math.round(visto.extensao)} px)`
        },
        { timeout: ESPERA_RASTRO, message: `${J3} deveria ver o laser vermelho do mestre atravessar a tela dele` },
      )
      .toBe('rastro')
  })
  expect(caio.frames.some((f) => f.includes('"type":"laser"')), `o laser do mestre deveria ter chegado a ${J3} pelo socket`).toBe(true)
  expect(bruno.frames.filter((f) => f.includes('"type":"laser"')), `${J2} está na ${CENA_B} e recebeu o laser do mestre apontado no ${CENA_A}`).toEqual([])
})

test('2. Ana liga o "Laser" e acena sobre o chão: Caio, na mesma cena, vê o rastro na cor da ficha de Ana', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { ana, caio } = await mesaMontada(browser, page, baseURL ?? '')
  const base = (await lerTela(caio.page)).blocosLima

  await anaApontaComLaser(ana, () => esperaRastroLima(caio.page, base, J3))
})

test('3. o mestre, com o editor no Salão, vê o rastro do laser de Ana na cor da ficha dela', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  // O mestre olha o mapa (aba Mapa), onde fica na mesa.
  await page.getByRole('tab', { name: 'Mapa' }).click()
  const base = (await lerTela(page)).blocosLima

  await anaApontaComLaser(ana, () => esperaRastroLima(page, base, 'O mestre'))
})

test('4. Bruno, na Cripta, não vê nem recebe o laser que Ana aponta no Salão enquanto Caio o vê', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { ana, bruno, caio } = await mesaMontada(browser, page, baseURL ?? '')
  expect(bruno.frames.some((f) => f.includes('"snapshot"')), `a escuta de frames de ${J2} não viu nenhum snapshot: a régua de vazamento estaria surda`).toBe(true)
  const base = (await lerTela(caio.page)).blocosLima
  const framesDeBrunoAntes = bruno.frames.length

  await anaApontaComLaser(ana, async () => {
    // Controle do olho: o rastro está no ar, Caio o vê agora.
    await esperaRastroLima(caio.page, base, J3)
    const telaDeBruno = await lerTela(bruno.page)
    expect(telaDeBruno.cripta, `${J2} continua vendo a ${CENA_B}`).toBeGreaterThan(PIXELS_DE_CENA)
    expect(telaDeBruno.lima, `${J2} está na ${CENA_B} e viu verde-limão do laser de ${J1}`).toBeLessThanOrEqual(RESIDUO)
  })

  const novos = bruno.frames.slice(framesDeBrunoAntes)
  expect(novos.filter((f) => /laser/i.test(f)), `${J2} está na ${CENA_B} e recebeu no socket o laser de ${J1}`).toEqual([])
})

test('5. Ana solta o botão e o rastro some sozinho da tela de Caio em poucos segundos', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { ana, caio } = await mesaMontada(browser, page, baseURL ?? '')
  const base = (await lerTela(caio.page)).blocosLima

  let caioViuORastro = false
  await anaApontaComLaser(ana, async () => {
    await esperaRastroLima(caio.page, base, J3)
    caioViuORastro = true
  })
  // Controle positivo: sem o rastro ter aparecido, "o rastro some" passaria com o laser morto.
  expect(caioViuORastro, `${J3} deveria ter visto o rastro antes de ${J1} soltar`).toBe(true)
  // Soltou (o `acenar` para e solta). Ninguém mexe em nada: o rastro tem de sumir.
  await expect
    .poll(async () => (await lerTela(caio.page, base)).limaNova, {
      timeout: SOME_EM_MS,
      message: `o rastro do laser de ${J1} deveria sumir sozinho da tela de ${J3} em até ${SOME_EM_MS / 1000} s depois de soltar`,
    })
    .toBeLessThanOrEqual(RESIDUO)
})
