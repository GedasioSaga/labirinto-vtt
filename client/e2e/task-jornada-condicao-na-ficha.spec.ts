// JORNADA DE USUÁRIO da CONDIÇÃO NA FICHA (item 12 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - com uma ficha selecionada, o mestre marca nela uma CONDIÇÃO de uma lista
//     curta: Envenenado, Caído, Dormindo, Atordoado, Invisível;
//   - a marca é um ícone simples, no estilo do minimapa (chapado, sem
//     brilho), desenhado EM CIMA da ficha;
//   - aparece no editor do mestre e na tela de quem joga, sempre que a ficha
//     estiver visível para aquele jogador;
//   - desmarcar tira o ícone das duas telas; cada condição tem ícone próprio.
//
// ONDE ISSO MORRE HOJE:
//   - `client/src/types/map.ts:413-452`: `Token` não tem campo de condição
//     (só id, nome, posição, tamanho, foto, rotação, cor, travar, ocultar);
//   - `client/src/components/PropertiesPanel.tsx:403-415`: com a ficha
//     selecionada o painel oferece Nome, Tamanho, "Cor da ficha" e Imagem —
//     nada de condição;
//   - `client/src/pixi/tokensRenderer.ts:200-345`: o desenho da ficha é disco
//     (ou foto com moldura), anel de seleção e o nome embaixo; nenhum estado.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (mesmo preparo de
// task-jornada-painel-do-grupo.spec.ts e task-jornada-viagem-do-jogador.spec.ts):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   o jogador é o `player.html` inteiro no próprio contexto de navegador. Só o
//   TRANSPORTE Rust é falsificado: o que o jogador manda pelo WebSocket
//   roteado vira `net:message` na página do mestre, e o `net_send` do mestre
//   volta ao socket do jogador por `exposeFunction`. A sessão do host é a do
//   app (`net/hostBridge.ts`), sem estado injetado.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: uma cena com duas fichas vem de um
//   `adventure.json` no disco falso do Tauri, aberta pelo menu ("Carregar Mapa
//   existente"), como na mesa.
//   GESTO REAL NA AÇÃO SOB TESTE. A ficha é selecionada por toque do ponteiro
//   no mapa (botão parado antes de soltar), a condição por clique no painel e
//   a seleção é largada com a tecla Escape. Os únicos `evaluate` são o repasse
//   do transporte e a LEITURA de pixel (decodificam a foto num canvas solto e
//   perguntam `elementFromPoint`).
//   PROVA NA TELA, POR DIFERENÇA DE FOTO. Cada ficha tem cor própria (Lanterna
//   verde-limão, Ogro laranja) sobre chão cinza neutro: a mancha de cor dá o
//   centro e o raio da ficha EM CADA TELA (a escala do editor e a do jogador
//   não precisam ser conhecidas). Em volta de cada ficha fica uma CAIXA — do
//   raio abaixo do centro (antes do nome, que é escrito embaixo) até três
//   raios acima, e dois raios para cada lado. "A marca apareceu em cima da
//   ficha" = a caixa daquela ficha mudou em pelo menos `MARCA_MIN` pixels
//   entre a foto de antes e a de depois, com a seleção largada e o ponteiro
//   no mesmo lugar nas duas fotos. A caixa da OUTRA ficha não pode mudar
//   (`RESIDUO`): a marca é de uma ficha, não do mapa. A foto da caixa é da
//   página inteira naquela região, então vale marca pintada no canvas OU
//   desenhada por cima dele em HTML.
//
// SUPOSIÇÕES (as únicas que esta régua dita além da frase do pedido):
//   - com a ficha selecionada, as condições aparecem na página como controles
//     de ligar/desligar (botão com `aria-pressed`, caixa de marcar, switch,
//     item de menu marcável ou rádio) cujo nome acessível contém o nome da
//     condição (`CONDICOES`); se não estiverem à vista, um botão do painel
//     Mapa chamado "Condição" / "Condições" os abre;
//   - marcado, o controle diz que está marcado (`aria-pressed`/`aria-checked`
//     "true"); clicar de novo desmarca;
//   - a marca fica dentro da caixa descrita acima (em cima da ficha, sobre o
//     disco ou acima dele), e cada condição tem desenho próprio.
//
// ZOOM DO EDITOR: a aventura abre enquadrando as duas fichas no zoom máximo
// (400%), com a Lanterna meio sob o painel. O mestre clica no indicador de
// zoom (volta a 100%) e a régua exige que a caixa de cada ficha esteja
// inteira à vista antes de fotografar: marca escondida sob painel não conta.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ana entra e recebe a Lanterna; as
// duas telas mostram as duas fichas; o toque do mestre seleciona a ficha (o
// painel mostra o Nome dela) e o Escape larga; sem mudança nenhuma as caixas
// ficam iguais nas duas telas; e trocar a "Cor da ficha" do Ogro (que existe
// hoje) muda a caixa do Ogro nas duas telas e não a da Lanterna. Sem ele, o
// vermelho dos testes 2 a 6 poderia ser o método de foto cego ou barulhento.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'
import { pickTool } from './helpers/tools'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'COND01'
const J1 = 'Ana'
const AVENTURA = 'Aventura da Febre'
const CENA = 'Enfermaria'
const ID_CENA = 'scene_enfermaria'
const PASTA = 'C:/appdata/maps/map_febre'

const LANTERNA = 'Lanterna'
const OGRO = 'Ogro'

const GRADE = 50
const COLUNAS = 20
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }

/** Chão cinza neutro: nem limão nem laranja, e qualquer ícone colorido destoa dele. */
const CHAO = '#5a5a5a'
const COR_LANTERNA = '#3cff00'
const COR_OGRO = '#ff5a00'

type Ponto = { x: number; y: number }

/** Três casas de distância: as caixas das duas fichas não se tocam. */
const POS_LANTERNA: Ponto = { x: 425, y: 325 }
const POS_OGRO: Ponto = { x: 625, y: 325 }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 500
/** Espera curta por controle de tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem lê pixel: cada foto + decodificação custa segundos sob carga. */
const ESPERA_TELA = 25_000

/** Pixels mínimos de uma mancha de cor para dizer "a ficha está na tela". */
const PIXELS_DE_FICHA = 60
/** Diferença de cor (|dR|+|dG|+|dB|) a partir da qual um pixel "mudou". */
const LIMIAR_DE_MUDANCA = 60
/** Pixels mudados na caixa para dizer "apareceu (ou sumiu) algo em cima da ficha". */
const MARCA_MIN = 40
/** Pixels mudados tolerados numa caixa em que nada deveria mudar (antisserrilhado). */
const RESIDUO = 12
/** Quanto a mancha de uma ficha parada pode andar entre duas fotos (câmera parada). */
const CAMERA_PARADA_PX = 3

/** As cinco condições do pedido, pelo nome que a pessoa lê. */
const CONDICOES = {
  envenenado: /envenenad[oa]/i,
  caido: /ca[íi]d[oa]/i,
  dormindo: /dormindo/i,
  atordoado: /atordoad[oa]/i,
  invisivel: /invis[íi]vel/i,
} as const
type Condicao = keyof typeof CONDICOES
const ROTULO: Record<Condicao, string> = {
  envenenado: 'Envenenado',
  caido: 'Caído',
  dormindo: 'Dormindo',
  atordoado: 'Atordoado',
  invisivel: 'Invisível',
}
/** Botão que abre a lista, se ela não estiver à vista no painel. */
const ABRIR_CONDICOES = /^\s*condi[çc](ão|ao|ões|oes)\b/i

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: uma cena com a Lanterna (de Ana) e o Ogro (sem dono)
// ───────────────────────────────────────────────────────────────────────────

function ficha(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function discoDaAventura(): Record<string, string> {
  const base = createEmptyMap('map_febre', AVENTURA, COLUNAS, LINHAS, GRADE)
  const cena: MapData = {
    ...base,
    floor: [{ id: 'enfermaria-chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: CHAO },
    tokens: [ficha('tok-lanterna', LANTERNA, POS_LANTERNA, COR_LANTERNA), ficha('tok-ogro', OGRO, POS_OGRO, COR_OGRO)],
  }
  const aventura = {
    version: 1,
    id: 'adv_febre',
    name: AVENTURA,
    startSceneId: ID_CENA,
    scenes: [{ id: ID_CENA, name: CENA, file: 'map.json' }],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(cena),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
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

/** O "Rust" de mentira: liga o WebSocket do jogador ao `net:*` do mestre, nos dois sentidos. */
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

/** Aba Jogo, card do jogador, "Atribuir <ficha>" — o clique de um toque que o painel oferece. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDaFicha: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = mestre.locator('#lb-rail-panel-room')
  const card = painel.locator('.lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${nomeDaFicha}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDaFicha}` }), `${jogador} deveria ficar com ${nomeDaFicha}`).toBeVisible()
}

/** Só o mestre, já no mapa com Selecionar, vendo as duas fichas. */
async function mestrePronto(mestre: Page): Promise<Fichas> {
  await mestreAbreAventura(mestre)
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await pickTool(mestre, 'Selecionar')
  return mestreEnquadra(mestre)
}

/**
 * O editor abre a aventura enquadrando o CONTEÚDO (as duas fichas) no zoom
 * máximo — medido em 22/09: 400%, a Lanterna meio escondida sob o painel e o
 * F ("enquadrar tudo") dá o mesmo quadro. O mestre clica no indicador de zoom
 * do canto ("Clique para redefinir o zoom para 100%", `components/ZoomHud.tsx`):
 * em 100% as duas fichas ficam à vista, com espaço em cima de cada uma.
 */
async function mestreEnquadra(mestre: Page): Promise<Fichas> {
  const zoom = mestre.getByRole('button', { name: /^Zoom: \d+%/ })
  await zoom.click()
  await expect(zoom, 'o clique no indicador de zoom deveria voltar a 100%').toHaveAccessibleName(/^Zoom: 100%/, { timeout: ESPERA })
  const fichas = await fichasNaTela(mestre, 'o editor do mestre')
  await exigeCaixasAVista(mestre, fichas, 'o editor do mestre, em 100%')
  return fichas
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

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

interface Mesa {
  ana: Page
  noMestre: Fichas
  naAna: Fichas
}

/** Mestre abre a aventura e a sala; Ana entra e recebe a Lanterna; as duas telas mostram as duas fichas. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  await mestreAtribui(mestre, J1, LANTERNA)
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await pickTool(mestre, 'Selecionar')
  await expect(ana.locator('canvas').first(), `${J1}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
  const naAna = await fichasNaTela(ana, `a tela de ${J1}`)
  await exigeCaixasAVista(ana, naAna, `a tela de ${J1}`)
  const noMestre = await mestreEnquadra(mestre)
  return { ana, noMestre, naAna }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura da tela (só leitura de pixel)
// ───────────────────────────────────────────────────────────────────────────

interface Mancha {
  centro: Ponto
  pixels: number
  /** Raio do disco na tela, tirado da área da mancha (área = πr²). */
  raio: number
}

interface Fichas {
  lanterna: Mancha
  ogro: Mancha
}

interface Caixa {
  x: number
  y: number
  width: number
  height: number
}

type Foto = Awaited<ReturnType<Page['screenshot']>>

async function fotografar(page: Page, clip?: Caixa): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await page.screenshot(clip ? { clip } : undefined)
    } catch {
      await page.waitForTimeout(200)
    }
  }
  throw new Error('não consegui fotografar a tela')
}

interface Contagem {
  limao: number
  limaoCentro: Ponto | null
  laranja: number
  laranjaCentro: Ponto | null
}

/**
 * Conta os pixels limão (Lanterna) e laranja (Ogro) só onde o MAIOR canvas da
 * página está por cima — painéis, cartões e miniaturas não contam. Leitura
 * pura: decodifica a foto num canvas solto e pergunta `elementFromPoint`.
 */
async function contarFichas(page: Page): Promise<Contagem> {
  const foto = await fotografar(page)
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
    const BLOCO = 16
    const colunas = Math.ceil(window.innerWidth / BLOCO)
    const linhas = Math.ceil(window.innerHeight / BLOCO)
    const cobertura = new Uint8Array(colunas * linhas)
    const canvasPorCima = (x: number, y: number): boolean => {
      const bx = Math.min(colunas - 1, Math.floor((x * escalaX) / BLOCO))
      const by = Math.min(linhas - 1, Math.floor((y * escalaY) / BLOCO))
      const k = by * colunas + bx
      if (cobertura[k] === 0) {
        const topo = document.elementFromPoint(bx * BLOCO + BLOCO / 2, by * BLOCO + BLOCO / 2)
        cobertura[k] = principal !== null && topo === principal ? 1 : 2
      }
      return cobertura[k] === 1
    }
    let limao = 0
    let lx = 0
    let ly = 0
    let laranja = 0
    let ox = 0
    let oy = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const ehLimao = G > 200 && R > 20 && R < 120 && B < 60
        const ehLaranja = R > 200 && G > 50 && G < 140 && B < 60
        if (!ehLimao && !ehLaranja) continue
        if (!canvasPorCima(x, y)) continue
        if (ehLimao) {
          limao += 1
          lx += x
          ly += y
        } else {
          laranja += 1
          ox += x
          oy += y
        }
      }
    }
    return {
      limao,
      limaoCentro: limao > 0 ? { x: (lx / limao) * escalaX, y: (ly / limao) * escalaY } : null,
      laranja,
      laranjaCentro: laranja > 0 ? { x: (ox / laranja) * escalaX, y: (oy / laranja) * escalaY } : null,
    }
  }, foto.toString('base64'))
}

/** As duas fichas na tela (espera até as duas aparecerem). */
async function fichasNaTela(page: Page, quem: string): Promise<Fichas> {
  // Só vale a leitura PARADA: duas fotos seguidas com as duas manchas no
  // mesmo lugar. A câmera do editor anda até o zoom novo (medido em 22/09: a
  // caixa medida no meio do caminho ficava no chão vazio e a cor nova do Ogro
  // "não mudava nada").
  let ultima: Contagem = { limao: 0, limaoCentro: null, laranja: 0, laranjaCentro: null }
  let anterior: Contagem | null = null
  const perto = (a: Ponto | null, b: Ponto | null): boolean => a !== null && b !== null && Math.hypot(a.x - b.x, a.y - b.y) <= 1
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(PINTURA_MS)
        anterior = ultima
        ultima = await contarFichas(page)
        const parada = perto(anterior.limaoCentro, ultima.limaoCentro) && perto(anterior.laranjaCentro, ultima.laranjaCentro)
        return parada ? Math.min(ultima.limao, ultima.laranja) : 0
      },
      { timeout: ESPERA_TELA, message: `${quem} deveria mostrar a ${LANTERNA} (limão) e o ${OGRO} (laranja), paradas` },
    )
    .toBeGreaterThan(PIXELS_DE_FICHA)
  const mancha = (pixels: number, centro: Ponto | null): Mancha => {
    if (centro === null) throw new Error(`${quem}: mancha sem centro`)
    return { centro, pixels, raio: Math.sqrt(pixels / Math.PI) }
  }
  return { lanterna: mancha(ultima.limao, ultima.limaoCentro), ogro: mancha(ultima.laranja, ultima.laranjaCentro) }
}

/** Em cima da ficha: do raio abaixo do centro (antes do nome) até três raios acima; dois raios para cada lado. */
function caixaEmCima(m: Mancha): Caixa {
  const x = Math.max(0, Math.round(m.centro.x - 2 * m.raio))
  const y = Math.max(0, Math.round(m.centro.y - 3 * m.raio))
  const direita = Math.min(TELA.width, Math.round(m.centro.x + 2 * m.raio))
  const baixo = Math.min(TELA.height, Math.round(m.centro.y + 0.9 * m.raio))
  return { x, y, width: direita - x, height: baixo - y }
}

/** A foto de uma caixa da tela, como PNG em base64 (é o que se compara depois). */
async function fotoDaCaixa(page: Page, caixa: Caixa): Promise<string> {
  return (await fotografar(page, caixa)).toString('base64')
}

/**
 * Quantos pixels mudaram entre duas fotos da MESMA caixa. Leitura pura: as
 * duas fotos são decodificadas num canvas solto e comparadas ali mesmo, para
 * não carregar centenas de milhares de números de volta ao teste.
 */
async function pixelsMudados(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(
    async ({ fotoA, fotoB, limiar }) => {
      const ler = async (b64: string): Promise<ImageData> => {
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
        const tela = document.createElement('canvas')
        tela.width = bmp.width
        tela.height = bmp.height
        const ctx = tela.getContext('2d')
        if (!ctx) throw new Error('sem contexto 2d')
        ctx.drawImage(bmp, 0, 0)
        return ctx.getImageData(0, 0, bmp.width, bmp.height)
      }
      const da = await ler(fotoA)
      const db = await ler(fotoB)
      if (da.width !== db.width || da.height !== db.height) return Number.MAX_SAFE_INTEGER
      let n = 0
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2])
        if (d > limiar) n += 1
      }
      return n
    },
    { fotoA: a, fotoB: b, limiar: LIMIAR_DE_MUDANCA },
  )
}

/** Retrato das duas caixas de uma tela (PNG em base64). */
interface Retrato {
  lanterna: string
  ogro: string
}

async function retratar(page: Page, fichas: Fichas): Promise<Retrato> {
  await page.waitForTimeout(PINTURA_MS)
  return { lanterna: await fotoDaCaixa(page, caixaEmCima(fichas.lanterna)), ogro: await fotoDaCaixa(page, caixaEmCima(fichas.ogro)) }
}

/** Quantos pixels mudaram em cima de cada ficha, desde o retrato `antes`. */
async function mudancas(page: Page, fichas: Fichas, antes: Retrato): Promise<{ lanterna: number; ogro: number }> {
  const agora = await retratar(page, fichas)
  return { lanterna: await pixelsMudados(page, antes.lanterna, agora.lanterna), ogro: await pixelsMudados(page, antes.ogro, agora.ogro) }
}

/**
 * A caixa inteira de cada ficha está à vista: nos quatro cantos e no meio,
 * quem está por cima é o canvas grande da página (nenhum painel cobre o lugar
 * onde a marca vai aparecer). Leitura pura (`elementFromPoint`).
 */
async function exigeCaixasAVista(page: Page, fichas: Fichas, quem: string): Promise<void> {
  for (const qual of ['lanterna', 'ogro'] as const) {
    const c = caixaEmCima(fichas[qual])
    const pontos = [
      { x: c.x + 2, y: c.y + 2 },
      { x: c.x + c.width - 2, y: c.y + 2 },
      { x: c.x + 2, y: c.y + c.height - 2 },
      { x: c.x + c.width - 2, y: c.y + c.height - 2 },
      { x: c.x + c.width / 2, y: c.y + c.height / 2 },
    ]
    const livres = await page.evaluate((ps) => {
      let principal: Element | null = null
      let maiorArea = 0
      for (const cv of Array.from(document.querySelectorAll('canvas'))) {
        const r = cv.getBoundingClientRect()
        if (r.width * r.height > maiorArea) {
          maiorArea = r.width * r.height
          principal = cv
        }
      }
      return ps.filter((p) => principal !== null && document.elementFromPoint(p.x, p.y) === principal).length
    }, pontos)
    expect(livres, `${quem}: a caixa em cima da ficha "${qual === 'lanterna' ? LANTERNA : OGRO}" deveria estar inteira à vista (sem painel por cima)`).toBe(pontos.length)
  }
}


/** A câmera daquela tela não mexeu: a mancha da ficha de referência está onde estava. */
async function exigeCameraParada(page: Page, referencia: 'lanterna' | 'ogro', antes: Fichas, quem: string): Promise<void> {
  const c = await contarFichas(page)
  const centro = referencia === 'lanterna' ? c.limaoCentro : c.laranjaCentro
  expect(centro, `${quem}: a ficha de referência sumiu da tela`).not.toBeNull()
  if (centro === null) return
  const andou = Math.hypot(centro.x - antes[referencia].centro.x, centro.y - antes[referencia].centro.y)
  expect(andou, `${quem}: a câmera andou ${andou.toFixed(1)} px entre as fotos — a comparação de caixa não vale`).toBeLessThanOrEqual(CAMERA_PARADA_PX)
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos do mestre
// ───────────────────────────────────────────────────────────────────────────

/** Onde o ponteiro descansa antes de cada foto: chão, bem abaixo das fichas e dos nomes. */
function descanso(noMestre: Fichas): Ponto {
  return { x: (noMestre.lanterna.centro.x + noMestre.ogro.centro.x) / 2, y: noMestre.lanterna.centro.y + 5 * noMestre.lanterna.raio }
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y, { steps: 4 })
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

function campoNomeDaFicha(mestre: Page): Locator {
  return mestre.getByRole('tabpanel', { name: 'Mapa' }).getByLabel('Nome', { exact: true })
}

/** Toque na ficha, no mapa: o painel passa a mostrar o Nome dela. */
async function selecionarFicha(mestre: Page, fichas: Fichas, qual: 'lanterna' | 'ogro'): Promise<void> {
  const nome = qual === 'lanterna' ? LANTERNA : OGRO
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await tocar(mestre, fichas[qual].centro)
  await expect(campoNomeDaFicha(mestre), `o toque na ficha deveria selecionar "${nome}" (painel com o Nome dela)`).toHaveValue(nome, { timeout: ESPERA })
}

/** Escape larga a seleção; o ponteiro volta ao descanso. */
async function largarSelecao(mestre: Page, fichas: Fichas): Promise<void> {
  await mestre.keyboard.press('Escape')
  await expect(campoNomeDaFicha(mestre), 'o Escape deveria largar a ficha selecionada').toHaveCount(0, { timeout: ESPERA })
  const p = descanso(fichas)
  await mestre.mouse.move(p.x, p.y, { steps: 4 })
}

/** O controle de uma condição, onde quer que a página o ponha (abre "Condição" se preciso). */
function controleDaCondicao(mestre: Page, condicao: Condicao): Locator {
  const nome = CONDICOES[condicao]
  return mestre
    .getByRole('button', { name: nome })
    .or(mestre.getByRole('checkbox', { name: nome }))
    .or(mestre.getByRole('switch', { name: nome }))
    .or(mestre.getByRole('menuitemcheckbox', { name: nome }))
    .or(mestre.getByRole('radio', { name: nome }))
    .first()
}

async function acharCondicao(mestre: Page, condicao: Condicao): Promise<Locator> {
  const controle = controleDaCondicao(mestre, condicao)
  if (!(await controle.isVisible())) {
    const abrir = mestre.getByRole('tabpanel', { name: 'Mapa' }).getByRole('button', { name: ABRIR_CONDICOES })
    if ((await abrir.count()) > 0 && (await abrir.first().isVisible())) await abrir.first().click()
  }
  await expect(controle, `com a ficha selecionada, a página deveria oferecer a condição "${ROTULO[condicao]}"`).toBeVisible({ timeout: ESPERA })
  return controle
}

async function estaMarcada(controle: Locator): Promise<boolean> {
  for (const atributo of ['aria-pressed', 'aria-checked']) {
    if ((await controle.getAttribute(atributo)) === 'true') return true
  }
  return false
}

/** Seleciona a ficha, clica na condição e larga a seleção. `ligar` diz o estado esperado do controle depois do clique. */
async function alternarCondicao(mestre: Page, fichas: Fichas, qual: 'lanterna' | 'ogro', condicao: Condicao, ligar: boolean): Promise<void> {
  await selecionarFicha(mestre, fichas, qual)
  const controle = await acharCondicao(mestre, condicao)
  await controle.click()
  await expect
    .poll(() => estaMarcada(controle), { timeout: ESPERA, message: `"${ROTULO[condicao]}" deveria ficar ${ligar ? 'marcada' : 'desmarcada'} no painel` })
    .toBe(ligar)
  await largarSelecao(mestre, fichas)
}

/** Espera a marca aparecer (ou sumir) em cima da ficha `qual`, e exige a outra caixa parada. */
async function esperaMudancaEmCima(page: Page, fichas: Fichas, antes: Retrato, qual: 'lanterna' | 'ogro', oQue: string): Promise<void> {
  const outra = qual === 'lanterna' ? 'ogro' : 'lanterna'
  let ultima = { lanterna: 0, ogro: 0 }
  await expect
    .poll(
      async () => {
        ultima = await mudancas(page, fichas, antes)
        return ultima[qual]
      },
      { timeout: ESPERA_TELA, message: oQue },
    )
    .toBeGreaterThanOrEqual(MARCA_MIN)
  expect(ultima[outra], `${oQue}: a caixa da OUTRA ficha também mudou (${ultima[outra]} px) — a marca é de uma ficha só`).toBeLessThanOrEqual(RESIDUO)
  await exigeCameraParada(page, outra, fichas, oQue)
}

// ───────────────────────────────────────────────────────────────────────────
// Os testes
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana vê as duas fichas; o toque seleciona e o Escape larga; sem mudança as caixas ficam iguais, e a Cor da ficha do Ogro muda só a caixa dele nas duas telas', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const mesa = await mesaMontada(browser, page, baseURL ?? '')

  // Linha de base: o ponteiro descansa e as duas telas são fotografadas.
  await page.mouse.move(descanso(mesa.noMestre).x, descanso(mesa.noMestre).y, { steps: 4 })
  const antesMestre = await retratar(page, mesa.noMestre)
  const antesAna = await retratar(mesa.ana, mesa.naAna)

  // Selecionar e largar, sem mudar nada: as caixas não podem mudar (o método não é barulhento).
  await selecionarFicha(page, mesa.noMestre, 'lanterna')
  await largarSelecao(page, mesa.noMestre)
  const quietoMestre = await mudancas(page, mesa.noMestre, antesMestre)
  const quietoAna = await mudancas(mesa.ana, mesa.naAna, antesAna)
  expect(quietoMestre.lanterna, 'editor: selecionar e largar sem mudar nada mexeu na caixa da Lanterna').toBeLessThanOrEqual(RESIDUO)
  expect(quietoMestre.ogro, 'editor: selecionar e largar sem mudar nada mexeu na caixa do Ogro').toBeLessThanOrEqual(RESIDUO)
  expect(quietoAna.lanterna, `tela de ${J1}: nada mudou e a caixa da Lanterna mexeu`).toBeLessThanOrEqual(RESIDUO)
  expect(quietoAna.ogro, `tela de ${J1}: nada mudou e a caixa do Ogro mexeu`).toBeLessThanOrEqual(RESIDUO)

  // Uma mudança de aparência que EXISTE hoje (Cor da ficha) é vista pelo método, na ficha certa, nas duas telas.
  await selecionarFicha(page, mesa.noMestre, 'ogro')
  const roxo = page.getByRole('radiogroup', { name: 'Cor da ficha' }).getByRole('radio', { name: 'Roxo', exact: true })
  await roxo.click()
  await expect(roxo).toHaveAttribute('aria-checked', 'true')
  await largarSelecao(page, mesa.noMestre)
  await esperaMudancaEmCima(page, mesa.noMestre, antesMestre, 'ogro', 'editor: a cor nova do Ogro deveria mudar a caixa dele')
  await esperaMudancaEmCima(mesa.ana, mesa.naAna, antesAna, 'ogro', `tela de ${J1}: a cor nova do Ogro deveria mudar a caixa dele`)
})

test('2. painel: com a Lanterna selecionada, o mestre encontra as cinco condições pelo nome', async ({ page }) => {
  test.setTimeout(240_000)
  const noMestre = await mestrePronto(page)
  await selecionarFicha(page, noMestre, 'lanterna')
  for (const condicao of Object.keys(CONDICOES) as Condicao[]) {
    await acharCondicao(page, condicao)
  }
})

test('3. no editor: o mestre marca "Envenenado" na Lanterna e a marca aparece em cima dela (e não no Ogro)', async ({ page }) => {
  test.setTimeout(240_000)
  const noMestre = await mestrePronto(page)
  await page.mouse.move(descanso(noMestre).x, descanso(noMestre).y, { steps: 4 })
  const antes = await retratar(page, noMestre)

  await alternarCondicao(page, noMestre, 'lanterna', 'envenenado', true)
  await esperaMudancaEmCima(page, noMestre, antes, 'lanterna', 'editor: depois de marcar "Envenenado", a marca deveria aparecer em cima da Lanterna')
})

test('4. na tela do jogador: o mestre marca "Envenenado" na Lanterna e Ana vê a marca em cima da própria ficha', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const mesa = await mesaMontada(browser, page, baseURL ?? '')
  const antesAna = await retratar(mesa.ana, mesa.naAna)

  await alternarCondicao(page, mesa.noMestre, 'lanterna', 'envenenado', true)
  await esperaMudancaEmCima(mesa.ana, mesa.naAna, antesAna, 'lanterna', `tela de ${J1}: depois de o mestre marcar "Envenenado", a marca deveria aparecer em cima da Lanterna`)
})

test('5. outra ficha visível: o mestre marca "Caído" no Ogro, Ana vê a marca nele; desmarcar tira a marca das duas telas', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const mesa = await mesaMontada(browser, page, baseURL ?? '')
  await page.mouse.move(descanso(mesa.noMestre).x, descanso(mesa.noMestre).y, { steps: 4 })
  const antesMestre = await retratar(page, mesa.noMestre)
  const antesAna = await retratar(mesa.ana, mesa.naAna)

  await alternarCondicao(page, mesa.noMestre, 'ogro', 'caido', true)
  await esperaMudancaEmCima(page, mesa.noMestre, antesMestre, 'ogro', 'editor: depois de marcar "Caído", a marca deveria aparecer em cima do Ogro')
  await esperaMudancaEmCima(mesa.ana, mesa.naAna, antesAna, 'ogro', `tela de ${J1}: o Ogro está à vista dela, e a marca "Caído" deveria aparecer em cima dele`)
  // Controle positivo: sem a marca ter aparecido, "desmarcar tira a marca" passaria com o painel morto.
  expect((await mudancas(page, mesa.noMestre, antesMestre)).ogro, 'editor: com "Caído" marcado, a caixa do Ogro deveria estar diferente').toBeGreaterThan(RESIDUO)

  // Desmarcar: as duas caixas voltam a ser o que eram antes de marcar.
  await alternarCondicao(page, mesa.noMestre, 'ogro', 'caido', false)
  await expect
    .poll(async () => (await mudancas(page, mesa.noMestre, antesMestre)).ogro, { timeout: ESPERA_TELA, message: 'editor: depois de desmarcar "Caído", a marca deveria sumir de cima do Ogro' })
    .toBeLessThanOrEqual(RESIDUO)
  await expect
    .poll(async () => (await mudancas(mesa.ana, mesa.naAna, antesAna)).ogro, { timeout: ESPERA_TELA, message: `tela de ${J1}: depois de desmarcar "Caído", a marca deveria sumir de cima do Ogro` })
    .toBeLessThanOrEqual(RESIDUO)
})

test('6. cada condição tem ícone próprio: "Envenenado" e "Caído" desenham marcas diferentes em cima da Lanterna', async ({ page }) => {
  test.setTimeout(240_000)
  const noMestre = await mestrePronto(page)
  await page.mouse.move(descanso(noMestre).x, descanso(noMestre).y, { steps: 4 })
  const limpo = await retratar(page, noMestre)

  await alternarCondicao(page, noMestre, 'lanterna', 'envenenado', true)
  await esperaMudancaEmCima(page, noMestre, limpo, 'lanterna', 'editor: "Envenenado" deveria desenhar uma marca em cima da Lanterna')
  const comVeneno = await retratar(page, noMestre)

  // Só "Caído": tira o veneno e marca a queda.
  await alternarCondicao(page, noMestre, 'lanterna', 'envenenado', false)
  await alternarCondicao(page, noMestre, 'lanterna', 'caido', true)
  await esperaMudancaEmCima(page, noMestre, limpo, 'lanterna', 'editor: "Caído" deveria desenhar uma marca em cima da Lanterna')
  const comQueda = await retratar(page, noMestre)

  expect(
    await pixelsMudados(page, comVeneno.lanterna, comQueda.lanterna),
    'as marcas de "Envenenado" e de "Caído" saíram iguais na tela — cada condição precisa de um ícone próprio',
  ).toBeGreaterThanOrEqual(MARCA_MIN)
})
