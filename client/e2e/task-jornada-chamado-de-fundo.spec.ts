// JORNADA DE USUÁRIO do CHAMADO DE CENA DE FUNDO (G6) — escrita para SAIR
// VERMELHA no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (PEDIDOS.md, G6):
//   - o sinal (tocar e segurar no mapa) de um jogador que está numa cena que
//     NÃO é a aberta no editor chega ao mestre como aviso na tela:
//     "<jogador> chamou em <cena>", com um botão "Ir lá";
//   - "Ir lá" abre a cena desse jogador no editor e centra a câmera no ponto
//     do sinal; a lista Cenas passa a marcar essa cena;
//   - o sinal na cena aberta continua como hoje: o ping no mapa, sem aviso;
//   - vários sinais seguidos do mesmo jogador não empilham avisos: fica UM
//     aviso por jogador, atualizado.
//
// ONDE ISSO MORRE HOJE: `net/hostBridge.ts` repassa todo sinal ao `onSignal`
// do App, que só empilha o ping na `signalStore` e toca o bipe. O ping é
// desenhado nas coordenadas do sinal SOBRE A CENA ABERTA (a store não sabe de
// cena): o chamado da Cripta vira um ping solto no Salão, e nenhum texto diz
// quem chamou nem onde.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-viagem-do-jogador.spec.ts e task-jornada-painel-do-grupo.spec.ts):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   Ana e Bruno são o `player.html` inteiro, cada um no próprio contexto. Só o
//   TRANSPORTE Rust é falsificado: o que o jogador manda pelo WebSocket
//   roteado vira `net:message` no mestre (o `JSON.parse` do que chegou no
//   socket), e o `net_send` do mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: Salão (a ficha de Ana) e Cripta (a
//   ficha de Bruno) num `adventure.json`, aberto pelo menu como na mesa. Cada
//   ficha é dada ao jogador pelo gesto da aba Jogo ("Atribuir <ficha>"), com a
//   cena dela aberta no editor — é o único jeito que o painel oferece.
//   GESTO REAL NA AÇÃO SOB TESTE: tocar e SEGURAR parado no mapa do jogador
//   (1,5 s: o sinal sai de um temporizador de 500 ms que atrasa com a máquina
//   cheia), cliques no aviso e na lista. Os únicos `evaluate` são o repasse do
//   transporte e a LEITURA de pixel (decodificar a foto num canvas solto).
//   PROVA NA TELA: texto visível do aviso; o ping de Ana lido em pixel (a
//   região em volta da ficha dela muda enquanto a onda anima); depois do "Ir
//   lá", a ficha laranja de Bruno perto do centro do canvas do editor.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o aviso diz "Bruno chamou em Cripta Rubra" num texto só (qualquer coisa
//     pode vir entre as partes: "Bruno chamou em: Cripta Rubra" também vale);
//   - o botão chama "Ir lá" (exato) e fica DENTRO do mesmo elemento que o
//     texto do aviso (um toast, um cartão, uma linha);
//   - "perto do centro" = o ponto do sinal a menos de 15% do menor lado do
//     canvas do editor, do centro do canvas inteiro OU do centro da parte que o
//     painel não cobre. O ponto sai da ficha laranja de Bruno na foto (o sinal
//     cai 70 px de mundo abaixo dela; a escala vem do tamanho da ficha). A
//     ficha fica a 700 px de mundo do meio da Cripta: "só abrir a cena"
//     (encaixar) a deixa longe do centro;
//   - "um aviso por jogador" = um único elemento com o texto "Bruno chamou".
//
// CONTROLE POSITIVO (verde hoje): teste 1. O teste 5 (sinal na cena aberta
// NÃO gera aviso) pode passar hoje: é o controle de não-regressão.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { SIGNAL_MIN_INTERVAL_MS } from '../src/lib/signals'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'CHAMA1'
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
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx — a conta de câmera tem de ser a mesma. */
const FIT_MARGIN = 24

const CHAO_A = '#1e8c8c'
const CHAO_B = '#8c1e8c'
const COR_J1 = '#3cff00'
const COR_J2 = '#ff5a00'

type Ponto = { x: number; y: number }

const POS_J1: Ponto = { x: 700, y: 300 }
/**
 * Ficha de Bruno LONGE do meio da Cripta (o meio do mundo é 1000,300): quem
 * abre a Cripta só com "encaixar a cena" deixa a ficha a centenas de px do
 * centro da tela, e o "Ir lá" que não centra no sinal não passa por acaso.
 */
const POS_J2: Ponto = { x: 1700, y: 300 }
/** Onde cada um segura: 70 px de mundo abaixo da própria ficha, no chão livre. */
const SINAL_J1: Ponto = { x: POS_J1.x, y: POS_J1.y + 70 }
const SINAL_J2: Ponto = { x: POS_J2.x, y: POS_J2.y + 70 }

/** Segurar parado: bem acima dos 500 ms do temporizador do sinal, que atrasa com a máquina cheia. */
const SEGURAR_MS = 1500
/** Quantas vezes Ana repete o gesto no controle, se o mestre ainda não viu o ping (ver `anaSinalizaEOMestreVe`). */
const TENTATIVAS_DE_SINAL = 4
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** A leitura da tela inteira do MESTRE custa mais (medido em 22/09 na régua do painel: até 9 s por leitura). */
const ESPERA_TELA_MESTRE = 25_000
/**
 * Recorte na tela do mestre onde o ping de Ana tem de aparecer (px CSS): uma
 * faixa que desce da ficha dela, porque ela segura 70 px de mundo ABAIXO da
 * ficha. A câmera do editor encaixa o conteúdo e chega a 400% (medido em 22/09:
 * a onda caiu 280 px abaixo do centro da ficha); a faixa cobre até 5x. Não sobe
 * muito acima da ficha: lá em cima mora a dica da ferramenta, que não é o ping.
 */
const RECORTE = { meiaLargura: 200, acima: 60, abaixo: 380 }
/** Pixels que mudaram no recorte para dizer "o ping apareceu" (a onda é um anel largo, com cor forte). */
const PIXELS_DE_PING = 40

/** Pixels mínimos para dizer "isto está na tela". */
const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/** "Perto do centro": fração do menor lado do canvas do editor. */
const PERTO_DO_CENTRO = 0.15
/**
 * Diâmetro, em px de mundo, do miolo colorido de uma ficha de 1 casa (sem a
 * borda escura). Medido em 22/09 na foto do editor: 176 px a 400% = 44.
 */
const MIOLO_DA_FICHA = 44

const IR_LA = 'Ir lá'

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** "Bruno chamou em Cripta Rubra" (texto do pedido G6). */
const CHAMADO_DE_BRUNO = new RegExp(`${J2}[^]*chamou em[^]*${escapar(CENA_B)}`)
const QUALQUER_CHAMADO = /chamou em/
const BRUNO_CHAMOU = new RegExp(`${J2} chamou`)

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: Salão com a ficha de Ana, Cripta com a de Bruno
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


/** A seção "Cenas" da aba Mapa, aberta (mesmo gesto de task-jornada-pino-de-viagem). */
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

/** O mestre abre uma cena pela lista Cenas, com um clique, e espera ela ficar marcada. */
async function mestreAbreCena(mestre: Page, nome: string): Promise<void> {
  const lista = await secaoCenas(mestre)
  await entradaDaCena(lista, nome).click()
  await expect.poll(() => estaDestacada(entradaDaCena(lista, nome)), { timeout: ESPERA, message: `a lista Cenas deveria marcar "${nome}" depois do clique` }).toBe(true)
}

/** Aba Jogo, card do jogador, "Atribuir <token>" — o clique de um toque que o painel oferece. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDoToken: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const card = mestre.locator('#lb-rail-panel-room').locator('.lb-field').filter({ hasText: `${jogador} —` })
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
}

/** Contextos de jogador abertos pelo teste que está rodando: fechados no afterEach. */
const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Jogador> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
  rede.enviados.set(clientId, [])
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
  return { page, clientId, nome }
}

interface Mesa {
  ana: Jogador
  bruno: Jogador
}

/**
 * Mestre abre a aventura e a sala; Ana e Bruno entram. Ana recebe a ficha do
 * Salão; o mestre abre a Cripta, dá a ficha de lá a Bruno e VOLTA ao Salão —
 * é onde o editor fica durante o jogo. Cada jogador confere na própria tela o
 * chão da cena dele e a própria ficha.
 */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', J2)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestreAbreCena(mestre, CENA_B)
  await mestreAtribui(mestre, J2, TOKEN_J2)
  await mestreAbreCena(mestre, CENA_A)

  await expect
    .poll(async () => {
      const t = await lerTela(ana.page)
      return t.limao > PIXELS_DE_TOKEN && t.chaoA > PIXELS_DE_CENA
    }, { timeout: ESPERA_TELA, message: `${J1} deveria ver a própria ficha no chão do ${CENA_A}` })
    .toBe(true)
  await expect
    .poll(async () => {
      const t = await lerTela(bruno.page)
      return t.laranja > PIXELS_DE_TOKEN && t.chaoB > PIXELS_DE_CENA
    }, { timeout: ESPERA_TELA, message: `${J2} deveria ver a própria ficha no chão da ${CENA_B}` })
    .toBe(true)
  return { ana, bruno }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura de pixel (pura: foto → canvas solto → contagem por cor)
// ───────────────────────────────────────────────────────────────────────────

interface Pixels {
  limao: number
  laranja: number
  chaoA: number
  chaoB: number
  /** Centro da mancha verde-limão (ficha de Ana), em px CSS. */
  centroLimao: Ponto | null
  /** Centro da mancha laranja (ficha de Bruno), em px CSS. */
  centroLaranja: Ponto | null
  /** Centro do retângulo do canvas principal, em px CSS. */
  centroDoCanvas: Ponto | null
  /** Centro da parte do canvas principal que nenhum painel cobre, em px CSS. */
  centroVisivel: Ponto | null
  /** Menor lado do retângulo do canvas principal, em px CSS. */
  ladoDoCanvas: number
}

type Foto = Awaited<ReturnType<Page['screenshot']>>

async function fotografar(page: Page, recorte?: { x: number; y: number; width: number; height: number }): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await page.screenshot(recorte === undefined ? {} : { clip: recorte })
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error('não consegui fotografar a tela')
}

/** Conta pixels por cor só onde o canvas PRINCIPAL (o maior) está por cima — painéis e cartões não contam. */
async function contarCores(page: Page, foto: Foto): Promise<Pixels> {
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
    let principal: Element | null = null
    let maiorArea = 0
    for (const c of Array.from(document.querySelectorAll('canvas'))) {
      const r = c.getBoundingClientRect()
      if (r.width * r.height > maiorArea) {
        maiorArea = r.width * r.height
        principal = c
      }
    }
    // Quem está por cima, em blocos de 16 px CSS, perguntado UMA vez por bloco.
    const BLOCO = 16
    const colunas = Math.ceil(window.innerWidth / BLOCO)
    const linhas = Math.ceil(window.innerHeight / BLOCO)
    const cobertura = new Uint8Array(colunas * linhas) // 0 = não perguntado, 1 = canvas, 2 = outra coisa
    const blocoNoCanvas = (bx: number, by: number): boolean => {
      const k = by * colunas + bx
      if (cobertura[k] === 0) {
        const topo = document.elementFromPoint(bx * BLOCO + BLOCO / 2, by * BLOCO + BLOCO / 2)
        cobertura[k] = principal !== null && topo === principal ? 1 : 2
      }
      return cobertura[k] === 1
    }
    const canvasPorCima = (x: number, y: number): boolean =>
      blocoNoCanvas(Math.min(colunas - 1, Math.floor((x * escalaX) / BLOCO)), Math.min(linhas - 1, Math.floor((y * escalaY) / BLOCO)))
    const r = {
      limao: 0,
      laranja: 0,
      chaoA: 0,
      chaoB: 0,
      centroLimao: null as { x: number; y: number } | null,
      centroLaranja: null as { x: number; y: number } | null,
      centroDoCanvas: null as { x: number; y: number } | null,
      centroVisivel: null as { x: number; y: number } | null,
      ladoDoCanvas: 0,
    }
    let vx = 0
    let vy = 0
    let lx = 0
    let ly = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const limao = G > 200 && R > 20 && R < 120 && B < 60
        const laranja = R > 200 && G > 50 && G < 140 && B < 60
        const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30 && G >= 35
        const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
        if (!limao && !laranja && !verdeAgua && !magenta) continue
        if (!canvasPorCima(x, y)) continue
        if (limao) {
          r.limao += 1
          vx += x
          vy += y
        } else if (laranja) {
          r.laranja += 1
          lx += x
          ly += y
        } else if (verdeAgua) r.chaoA += 1
        else r.chaoB += 1
      }
    }
    if (r.limao > 0) r.centroLimao = { x: (vx / r.limao) * escalaX, y: (vy / r.limao) * escalaY }
    if (r.laranja > 0) r.centroLaranja = { x: (lx / r.laranja) * escalaX, y: (ly / r.laranja) * escalaY }
    if (principal !== null) {
      const caixa = principal.getBoundingClientRect()
      r.centroDoCanvas = { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 }
      r.ladoDoCanvas = Math.min(caixa.width, caixa.height)
      let sx = 0
      let sy = 0
      let n = 0
      for (let by = 0; by < linhas; by += 1) {
        for (let bx = 0; bx < colunas; bx += 1) {
          if (!blocoNoCanvas(bx, by)) continue
          sx += bx * BLOCO + BLOCO / 2
          sy += by * BLOCO + BLOCO / 2
          n += 1
        }
      }
      if (n > 0) r.centroVisivel = { x: sx / n, y: sy / n }
    }
    return r
  }, foto.toString('base64'))
}

async function lerTela(page: Page): Promise<Pixels> {
  await page.waitForTimeout(PINTURA_MS)
  return contarCores(page, await fotografar(page))
}

/** Quantos pixels mudaram de verdade (soma das diferenças de canal acima de 90) entre duas fotos do mesmo recorte. */
async function pixelsQueMudaram(page: Page, antes: Foto, depois: Foto): Promise<number> {
  return page.evaluate(async ({ a, b }) => {
    const pixels = async (b64: string): Promise<Uint8ClampedArray> => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')
      ctx.drawImage(bmp, 0, 0)
      return ctx.getImageData(0, 0, bmp.width, bmp.height).data
    }
    const pa = await pixels(a)
    const pb = await pixels(b)
    let mudaram = 0
    for (let i = 0; i < Math.min(pa.length, pb.length); i += 4) {
      if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 90) mudaram += 1
    }
    return mudaram
  }, { a: antes.toString('base64'), b: depois.toString('base64') })
}

/**
 * Vigia do ping de Ana na tela do mestre. A leitura da tela inteira do mestre
 * custa segundos e o ping vive 3 s, então: acha a ficha de Ana UMA vez, guarda
 * a foto de um recorte em volta dela e, a partir de `vigiar()`, fotografa só o
 * recorte até ele mudar (a onda do ping anima) ou o prazo acabar.
 */
async function vigiaDoPingDeAna(mestre: Page): Promise<{ vigiar: () => Promise<number> }> {
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  let tela: Pixels | null = null
  await expect
    .poll(async () => {
      tela = await lerTela(mestre)
      return tela.limao
    }, { timeout: ESPERA_TELA_MESTRE, message: `o editor do mestre deveria mostrar a ficha de ${J1} no ${CENA_A}` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  const centro = (tela as Pixels | null)?.centroLimao ?? null
  if (centro === null) throw new Error(`ficha de ${J1} sem centro na tela do mestre`)
  const vista = mestre.viewportSize() ?? TELA
  const x = Math.max(0, Math.round(centro.x - RECORTE.meiaLargura))
  const y = Math.max(0, Math.round(centro.y - RECORTE.acima))
  const recorte = {
    x,
    y,
    width: Math.min(vista.width - x, Math.round(centro.x + RECORTE.meiaLargura) - x),
    height: Math.min(vista.height - y, Math.round(centro.y + RECORTE.abaixo) - y),
  }
  const base = await fotografar(mestre, recorte)
  return {
    vigiar: async () => {
      const prazo = Date.now() + ESPERA_TELA_MESTRE
      let maior = 0
      while (Date.now() < prazo) {
        maior = Math.max(maior, await pixelsQueMudaram(mestre, base, await fotografar(mestre, recorte)))
        if (maior >= PIXELS_DE_PING) return maior
        await mestre.waitForTimeout(100)
      }
      return maior
    },
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos e o aviso
// ───────────────────────────────────────────────────────────────────────────

const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)

/** Ponto do mundo → ponto da tela do jogador, com a câmera de "encaixar a cena". */
function naTela(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round(p.y * CAMERA.scale + CAMERA.y) }
}

/** Tocar e SEGURAR parado no mapa: o gesto do sinal. */
async function segurar(j: Jogador, p: Ponto): Promise<void> {
  const alvo = naTela(p)
  await j.page.mouse.move(alvo.x, alvo.y)
  await j.page.mouse.down()
  await j.page.waitForTimeout(SEGURAR_MS)
  await j.page.mouse.up()
}

/**
 * Ana segura no Salão e o mestre vê o ping dela na tela (pixel). Devolve os
 * pixels que mudaram. Com a máquina cheia, uma leitura do recorte pode levar
 * mais que os 3 s de vida do ping (medido em 22/09: 1 em 3 rodadas perdeu a
 * onda); por isso Ana repete o gesto, respeitando o intervalo mínimo entre
 * sinais, até o mestre ver ou as tentativas acabarem.
 */
async function anaSinalizaEOMestreVe(mestre: Page, ana: Jogador): Promise<number> {
  const vigia = await vigiaDoPingDeAna(mestre)
  let visto = false
  const vigiando = vigia.vigiar().then((n) => {
    visto = n >= PIXELS_DE_PING
    return n
  })
  for (let vez = 1; vez <= TENTATIVAS_DE_SINAL && !visto; vez += 1) {
    await segurar(ana, SINAL_J1)
    await ana.page.waitForTimeout(SIGNAL_MIN_INTERVAL_MS)
  }
  return vigiando
}

/** O menor elemento da tela do mestre que tem o texto do chamado de Bruno E o botão "Ir lá". */
function avisoDoChamado(mestre: Page): Locator {
  return mestre
    .locator('*')
    .filter({ has: mestre.getByText(CHAMADO_DE_BRUNO) })
    .filter({ has: mestre.getByRole('button', { name: IR_LA, exact: true }) })
    .last()
}

async function mestreLeOChamadoDeBruno(mestre: Page): Promise<Locator> {
  await expect(mestre.getByText(CHAMADO_DE_BRUNO).first(), `o mestre deveria ler "${J2} chamou em ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  const aviso = avisoDoChamado(mestre)
  await expect(aviso.getByRole('button', { name: IR_LA, exact: true }), `o aviso "${J2} chamou em ${CENA_B}" deveria ter o botão "${IR_LA}"`).toBeVisible({ timeout: ESPERA })
  return aviso
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana, no Salão aberto no editor, toca e segura e o mestre vê o ping dela no mapa', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const mudaram = await anaSinalizaEOMestreVe(page, ana)
  expect(mudaram, `o ping de ${J1} deveria aparecer na tela do mestre, em volta da ficha dela`).toBeGreaterThanOrEqual(PIXELS_DE_PING)
})

test('2. Bruno, na Cripta (cena de fundo), toca e segura e o mestre lê "Bruno chamou em Cripta Rubra" com "Ir lá"', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { bruno } = await mesaMontada(browser, page, baseURL ?? '')
  await segurar(bruno, SINAL_J2)
  await mestreLeOChamadoDeBruno(page)
})

test('3. "Ir lá" abre a Cripta no editor, a lista Cenas marca a Cripta e o ponto do sinal fica perto do centro', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { bruno } = await mesaMontada(browser, page, baseURL ?? '')
  await segurar(bruno, SINAL_J2)
  const aviso = await mestreLeOChamadoDeBruno(page)
  await aviso.getByRole('button', { name: IR_LA, exact: true }).click()

  const lista = await secaoCenas(page)
  await expect.poll(() => estaDestacada(entradaDaCena(lista, CENA_B)), { timeout: ESPERA, message: `"${IR_LA}" deveria abrir a ${CENA_B}: a lista Cenas marcaria ela` }).toBe(true)
  expect(await estaDestacada(entradaDaCena(lista, CENA_A)), `com a ${CENA_B} aberta, o ${CENA_A} não deveria continuar marcado`).toBe(false)

  let tela: Pixels | null = null
  await expect
    .poll(async () => {
      tela = await lerTela(page)
      return tela.laranja
    }, { timeout: ESPERA_TELA_MESTRE, message: `depois de "${IR_LA}", o editor deveria mostrar a ficha de ${J2}` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  const lida = tela as Pixels | null
  if (lida === null || lida.centroLaranja === null) throw new Error(`ficha de ${J2} sem centro na tela do mestre`)
  expect(lida.chaoB, `depois de "${IR_LA}", o editor deveria mostrar o chão da ${CENA_B}`).toBeGreaterThan(PIXELS_DE_CENA)
  // O sinal caiu 70 px de mundo abaixo da ficha. A escala do editor sai do
  // tamanho da própria ficha na foto (o zoom do editor muda: 400% medido).
  const escala = (2 * Math.sqrt(lida.laranja / Math.PI)) / MIOLO_DA_FICHA
  const sinal = { x: lida.centroLaranja.x + (SINAL_J2.x - POS_J2.x) * escala, y: lida.centroLaranja.y + (SINAL_J2.y - POS_J2.y) * escala }
  const centros = [lida.centroDoCanvas, lida.centroVisivel].filter((c): c is Ponto => c !== null)
  expect(centros.length, 'o canvas do editor deveria estar visível').toBeGreaterThan(0)
  const distancia = Math.min(...centros.map((c) => Math.hypot(sinal.x - c.x, sinal.y - c.y)))
  expect(distancia, `o ponto do sinal de ${J2} (70 px de mundo abaixo da ficha, escala ${escala.toFixed(2)}) deveria ficar perto do centro da tela do mestre (limite ${Math.round(lida.ladoDoCanvas * PERTO_DO_CENTRO)} px)`).toBeLessThan(lida.ladoDoCanvas * PERTO_DO_CENTRO)
})

test('4. Bruno sinaliza 3 vezes seguidas e a tela do mestre tem UM aviso "Bruno chamou"', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { bruno } = await mesaMontada(browser, page, baseURL ?? '')
  for (let vez = 1; vez <= 3; vez += 1) {
    await segurar(bruno, { x: SINAL_J2.x + (vez - 2) * GRADE, y: SINAL_J2.y })
    // Acima do intervalo mínimo entre sinais do mesmo jogador: cada um dos 3 conta.
    await bruno.page.waitForTimeout(SIGNAL_MIN_INTERVAL_MS + 200)
  }
  await mestreLeOChamadoDeBruno(page)
  await expect(page.getByText(BRUNO_CHAMOU), `três sinais de ${J2} deveriam deixar UM aviso só, atualizado`).toHaveCount(1)
})

test('5. não-regressão: o sinal de Ana na cena aberta vira ping no mapa e NÃO gera aviso "chamou em"', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const mudaram = await anaSinalizaEOMestreVe(page, ana)
  expect(mudaram, `o ping de ${J1} deveria aparecer na tela do mestre (sem ele, a ausência do aviso não prova nada)`).toBeGreaterThanOrEqual(PIXELS_DE_PING)
  await expect(page.getByText(QUALQUER_CHAMADO), `o sinal de ${J1} na cena aberta não deveria gerar aviso "chamou em"`).toHaveCount(0)
})
