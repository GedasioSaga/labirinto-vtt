// JORNADA DE USUÁRIO do RECADO POR CENA (G11) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (PEDIDOS.md, G11):
//   - na lista "Cenas" da aba Mapa, cada cena tem um botão "Recado"; ele abre
//     um campo de texto ("Recado para quem está em <cena>") e o botão "Enviar";
//   - enviar mostra o texto na tela de CADA jogador que está naquela cena, num
//     cartão que fica até o jogador fechar ("Fechar" ou Escape);
//   - quem está em outra cena não recebe nada: nem o texto nos frames do
//     socket, nem o cartão;
//   - o texto é só texto: HTML vindo do mestre aparece literal;
//   - o recado tem limite de tamanho (ex.: 500 caracteres).
//
// ONDE ISSO MORRE HOJE: a lista Cenas (`components/ScenesSection.tsx`) só tem
// o nome da cena e "N tokens"; não há mensagem de texto do mestre para o
// jogador no protocolo (`net/protocol.ts`) nem cartão na tela do jogador.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-cenas-com-gente.spec.ts e task-jornada-reunir-o-grupo.spec.ts):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   cada jogador é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo WebSocket
//   roteado vira `net:message` no mestre (com `JSON.parse` do que chegou), e o
//   `net_send` do mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: Salão e Cripta num
//   `adventure.json`, aberto pelo menu como na mesa. A ficha de Ana está no
//   Salão e a de Bruno na Cripta; as duas são atribuídas pelo gesto "Atribuir
//   <ficha>" da aba Jogo — a de Bruno com o editor na Cripta, aberta pela lista
//   Cenas, como o mestre faria.
//   GESTO REAL NA AÇÃO SOB TESTE: clique no "Recado", clique e digitação tecla
//   a tecla no campo, clique em "Enviar", Escape na tela do jogador. Os únicos
//   `evaluate` são o do transporte e a LEITURA de pixel.
//   PROVA NA TELA: texto visível na tela de cada jogador; a cena de cada um
//   pela COR DO CHÃO (Salão verde-água, Cripta magenta). Nada é lido da store.
//   FRAMES. Com o socket roteado o navegador não emite `framereceived`; o que a
//   página recebe é o que a rota entrega com `ws.send`, e é ali que a régua
//   anota (`Rede.enviados`).
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - cada cena da lista continua sendo um item de lista (`listitem`) com o
//     botão do nome da cena, e o botão "Recado" fica DENTRO desse item;
//   - o campo é um `textbox` cujo nome acessível contém "Recado para quem está
//     em <nome da cena>"; quem envia é um botão de nome exato "Enviar";
//   - o jogador lê o texto do recado exato como um nó de texto próprio
//     (`getByText(texto, { exact: true })`), sem prefixo no mesmo elemento;
//   - Escape na tela do jogador, com o cartão aberto, fecha o cartão.
//   O limite de 500 caracteres NÃO é cobrado aqui (fora dos cinco casos
//   pedidos); fica para uma régua de unidade ou para um caso a mais.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Sem ele, o vermelho dos testes 2 a
// 5 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

// Código da sala que não é palavra da interface: 'RECADO' casava, pelo
// getByText sem distinguir maiúscula, com o botão "Recado" da lista Cenas
// (achado do builder da G11 em 22/09).
const CODIGO = 'RCD042'
const J1 = 'Ana'
const J2 = 'Bruno'
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

type Ponto = { x: number; y: number }
const casa = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const POS_J1 = casa(14, 5)
const POS_J2 = casa(20, 5)

/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
const PIXELS_DE_CENA = 2000
/** Pixels máximos para dizer "este chão NÃO está na tela" (antisserrilhado). */
const RESIDUO = 25

const RECADO = /Recado/
const CAMPO_DO_RECADO = (cena: string): RegExp => new RegExp(`Recado para quem está em ${cena}`)
const ENVIAR = 'Enviar'
const RECADO_DO_SALAO = 'A porta range ao longe.'
const TRECHO_DO_SALAO = 'A porta range'
const RECADO_DA_CRIPTA = 'Algo se mexe no sarcófago.'
const RECADO_COM_HTML = '<b>negrito</b>'

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: Ana no Salão, Bruno na Cripta
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
  const cenaA = cena('map_vale', AVENTURA, CHAO_A, [token('tok-lanterna', TOKEN_J1, POS_J1, COR_J1)])
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

/** O item da lista "Cenas" que tem o botão com o nome da cena. */
function linhaDaCena(lista: Locator, nome: string): Locator {
  return lista.getByRole('listitem').filter({ has: lista.page().getByRole('button', { name: nome, exact: true }) })
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

/**
 * O gesto do mestre: "Recado" na linha da cena, clique no campo, digitação
 * tecla a tecla, "Enviar". Falha no primeiro passo que a tela não oferece.
 */
async function mestreMandaRecado(mestre: Page, nomeDaCena: string, texto: string): Promise<void> {
  const lista = await secaoCenas(mestre)
  const linha = linhaDaCena(lista, nomeDaCena)
  await expect(linha, `"${nomeDaCena}" deveria ser um item da lista Cenas`).toHaveCount(1)
  const botao = linha.getByRole('button', { name: RECADO })
  await expect(botao.first(), `a linha "${nomeDaCena}" da lista Cenas deveria ter o botão "Recado"`).toBeVisible({ timeout: ESPERA })
  await botao.first().click()
  const campo = mestre.getByRole('textbox', { name: CAMPO_DO_RECADO(nomeDaCena) })
  await expect(campo, `"Recado" deveria abrir o campo "Recado para quem está em ${nomeDaCena}"`).toBeVisible({ timeout: ESPERA })
  await campo.click()
  await campo.pressSequentially(texto, { delay: 15 })
  await expect(campo, 'o campo deveria mostrar o que o mestre digitou').toHaveValue(texto)
  await mestre.getByRole('button', { name: ENVIAR, exact: true }).click({ timeout: ESPERA })
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

interface Chao {
  /** Chão do Salão (verde-água), qualquer brilho. */
  salao: number
  /** Chão da Cripta (magenta), qualquer brilho. */
  cripta: number
}

/**
 * Fotografa a página e conta os pixels do chão de cada cena, só onde o CANVAS
 * está por cima (painéis e cartões não contam). Leitura pura: decodifica a
 * foto num canvas solto e pergunta `elementFromPoint`.
 */
async function lerChao(page: Page): Promise<Chao> {
  await page.waitForTimeout(PINTURA_MS)
  let foto: Awaited<ReturnType<Page['screenshot']>> | null = null
  for (let tentativa = 1; tentativa <= 3 && foto === null; tentativa += 1) {
    try {
      foto = await page.screenshot()
    } catch {
      await page.waitForTimeout(200)
    }
  }
  if (foto === null) throw new Error('régua: não consegui fotografar a tela')
  return page.evaluate(async (b64) => {
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
    const canvasPorCima = (x: number, y: number): boolean => {
      const chave = (y >> 3) * 65536 + (x >> 3)
      let v = noCanvas.get(chave)
      if (v === undefined) {
        v = document.elementFromPoint(((x >> 3) * 8 + 4) * escalaX, ((y >> 3) * 8 + 4) * escalaY)?.tagName === 'CANVAS'
        noCanvas.set(chave, v)
      }
      return v
    }
    let salao = 0
    let cripta = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30
        const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
        if (!verdeAgua && !magenta) continue
        if (!canvasPorCima(x, y)) continue
        if (verdeAgua) salao += 1
        else cripta += 1
      }
    }
    return { salao, cripta }
  }, foto.toString('base64'))
}

/** Espera o chão da cena dele chegar à tela do jogador (poll de pixel com folga). */
async function esperaChaoNaTela(j: Jogador, cena: keyof Chao, nomeDaCena: string): Promise<void> {
  await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerChao(j.page))[cena], { timeout: ESPERA_TELA, message: `${j.nome}: o chão de "${nomeDaCena}" não foi pintado na tela dele` })
    .toBeGreaterThan(PIXELS_DE_CENA)
}

interface Mesa {
  rede: Rede
  ana: Jogador
  bruno: Jogador
}

/**
 * Mestre abre a aventura e a sala; Ana e Bruno entram; Ana ganha a ficha no
 * Salão, Bruno a dele com o editor na Cripta. O editor volta ao Salão.
 */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', J2)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestreAbreCena(mestre, CENA_B)
  await mestreAtribui(mestre, J2, TOKEN_J2)
  await mestreAbreCena(mestre, CENA_A)
  await esperaChaoNaTela(ana, 'salao', CENA_A)
  await esperaChaoNaTela(bruno, 'cripta', CENA_B)
  return { rede, ana, bruno }
}

/** O recado na tela de um jogador: o texto exato, visível. */
function recadoNaTela(j: Jogador, texto: string): Locator {
  return j.page.getByText(texto, { exact: true })
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: a lista Cenas mostra o Salão e a Cripta, Ana vê o chão do Salão e Bruno o da Cripta', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  const lista = await secaoCenas(page)
  await expect(entradaDaCena(lista, CENA_A), `a lista Cenas deveria mostrar "${CENA_A}"`).toBeVisible()
  await expect(entradaDaCena(lista, CENA_B), `a lista Cenas deveria mostrar "${CENA_B}"`).toBeVisible()
  // A linha que a régua usa existe: é nela que o botão "Recado" vai aparecer.
  await expect(linhaDaCena(lista, CENA_A), `"${CENA_A}" deveria ser um item da lista`).toHaveCount(1)
  await expect(linhaDaCena(lista, CENA_B), `"${CENA_B}" deveria ser um item da lista`).toHaveCount(1)

  const telaDeAna = await lerChao(ana.page)
  expect(telaDeAna.salao, `${J1} deveria ver o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(telaDeAna.cripta, `${J1} não deveria ver chão da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  const telaDeBruno = await lerChao(bruno.page)
  expect(telaDeBruno.cripta, `${J2} deveria ver o chão da ${CENA_B}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(telaDeBruno.salao, `${J2} não deveria ver chão do ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)

  // O ouvido de frames está ligado: cada página já recebeu o mapa pelo socket.
  expect(bruno.frames.some((f) => f.includes('"snapshot"')), `a escuta de frames de ${J2} não viu nenhum snapshot`).toBe(true)
})

test('2. "Recado" do Salão abre o campo; o mestre envia "A porta range ao longe." e só Ana lê o cartão', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  await mestreMandaRecado(page, CENA_A, RECADO_DO_SALAO)

  await expect(recadoNaTela(ana, RECADO_DO_SALAO), `${J1} está no ${CENA_A} e deveria ler "${RECADO_DO_SALAO}" num cartão`).toBeVisible({ timeout: ESPERA })
  // Ana já leu: se fosse chegar a Bruno, já teria chegado.
  await expect(bruno.page.getByText(TRECHO_DO_SALAO), `${J2} está na ${CENA_B} e não deveria ler o recado do ${CENA_A}`).toHaveCount(0)
})

test('3. nenhum frame recebido por Bruno traz "A porta range"', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')
  expect(bruno.frames.some((f) => f.includes('"snapshot"')), `a escuta de frames de ${J2} não viu nenhum snapshot: a régua de vazamento estaria surda`).toBe(true)

  await mestreMandaRecado(page, CENA_A, RECADO_DO_SALAO)
  await expect(recadoNaTela(ana, RECADO_DO_SALAO), `${J1} deveria ler "${RECADO_DO_SALAO}"`).toBeVisible({ timeout: ESPERA })
  // Controle do ouvido: o recado passou pelo fio, na conversa de Ana.
  expect(ana.frames.some((f) => f.includes(TRECHO_DO_SALAO)), `o recado deveria ter ido a ${J1} pelo socket`).toBe(true)

  expect(bruno.frames.filter((f) => f.includes(TRECHO_DO_SALAO)), `${J2} recebeu no socket o recado do ${CENA_A}`).toEqual([])
})

test('4. Ana fecha o cartão com Escape; um recado para a Cripta chega a Bruno e não a Ana', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  await mestreMandaRecado(page, CENA_A, RECADO_DO_SALAO)
  await expect(recadoNaTela(ana, RECADO_DO_SALAO), `${J1} deveria ler "${RECADO_DO_SALAO}"`).toBeVisible({ timeout: ESPERA })
  await ana.page.keyboard.press('Escape')
  await expect(recadoNaTela(ana, RECADO_DO_SALAO), `Escape deveria fechar o cartão de recado de ${J1}`).toHaveCount(0, { timeout: ESPERA })

  await mestreMandaRecado(page, CENA_B, RECADO_DA_CRIPTA)
  await expect(recadoNaTela(bruno, RECADO_DA_CRIPTA), `${J2} está na ${CENA_B} e deveria ler "${RECADO_DA_CRIPTA}"`).toBeVisible({ timeout: ESPERA })
  await expect(ana.page.getByText(RECADO_DA_CRIPTA), `${J1} está no ${CENA_A} e não deveria ler o recado da ${CENA_B}`).toHaveCount(0)
})

test('5. o recado "<b>negrito</b>" aparece para Ana com os sinais < e > como texto, e não como negrito', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  await mestreMandaRecado(page, CENA_A, RECADO_COM_HTML)

  await expect(recadoNaTela(ana, RECADO_COM_HTML), `${J1} deveria ler "${RECADO_COM_HTML}" literal, com < e > na tela`).toBeVisible({ timeout: ESPERA })
  await expect(ana.page.locator('b', { hasText: 'negrito' }), 'o HTML do mestre não pode virar marcação na tela do jogador').toHaveCount(0)
})
