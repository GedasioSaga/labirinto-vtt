// JORNADA DE USUÁRIO da TOCHA PRESA NA FICHA (item 10 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - com a luz selecionada (ou a ficha), o mestre PRENDE a luz a uma ficha
//     pelo painel da direita; o painel passa a oferecer "Soltar";
//   - ao mover a ficha — o mestre arrastando no editor OU o jogador arrastando
//     a própria — a luz vai junto, com o mesmo deslocamento da ficha;
//   - a tela do jogador desenha a luz no lugar novo: a visão dele é iluminada
//     pela tocha que ele carrega;
//   - "Soltar" desprende: a ficha volta a andar sozinha e a luz fica onde está.
//   ("Mapa escuro com tocha" está fora de escopo, PEDIDOS.md:373 — aqui a luz
//   é o halo que já existe, só que carregado pela ficha.)
//
// ONDE ISSO MORRE HOJE:
//   - `client/src/types/map.ts:144-159`: `Light` não tem vínculo com ficha
//     nenhuma (só id, x, y, radius, color, intensity, locked, hidden);
//   - `client/src/components/LightControls.tsx:14-48`: o painel da luz só tem
//     "Cor" e "Intensidade" — não há como prender nem soltar;
//   - `client/src/lib/mapFactory.ts:621-626`: `setTokenPosition` muda SÓ a
//     ficha; nenhuma luz anda junto, nem no mestre nem no que vai ao jogador.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo de
// task-jornada-viagem-do-jogador.spec.ts):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   o jogador é o `player.html` inteiro no próprio contexto de navegador. Só o
//   TRANSPORTE Rust é falsificado: o que o jogador manda pelo WebSocket roteado
//   vira `net:message` na página do mestre, e o `net_send` do mestre volta ao
//   socket do jogador por `exposeFunction`. A sessão do host é a do app
//   (`net/hostBridge.ts`), sem estado injetado.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: uma cena com a luz e a ficha vem de
//   um `adventure.json` no disco falso do Tauri, aberto pelo menu ("Carregar
//   Mapa existente"), como na mesa.
//   GESTO REAL NA AÇÃO SOB TESTE. Toque e arrasto pelo ponteiro, com pausa
//   antes de soltar; escolha de ficha por clique ou pelo `<select>` do painel.
//   Os únicos `evaluate` são o repasse do transporte e a LEITURA de pixel
//   (decodifica a foto num canvas solto e pergunta `elementFromPoint`).
//   PROVA NA TELA, SEM CÂMERA: tudo sai da própria foto. A ficha é verde-limão
//   (#3cff00) e a luz é vermelho puro (#ff0000) sobre chão cinza neutro. A
//   "vermelhidão" `R - (G+B)/2` mede o alpha do halo (ver
//   task-jornada-luz-que-para-na-parede.spec.ts), e o pixel só conta se G e B
//   forem quase iguais — isso tira o amarelo do anel de seleção (#ffdd55) e a
//   própria ficha verde. O centro de massa da vermelhidão é o centro da luz na
//   tela; o da cor limão é o centro da ficha. "A luz foi junto" = a luz andou
//   na tela o mesmo que a ficha andou (tolerância `TOLERANCIA_PX`). Isso vale
//   com a luz grudada no centro da ficha OU presa com o afastamento que tinha,
//   e vale com a câmera do jogador seguindo a ficha ou parada: se a câmera
//   seguir e a luz ficar, a luz anda ao contrário e a ficha fica — reprova.
//   Só o canvas GRANDE de cada página conta (miniatura de mapa no painel não).
//
// SUPOSIÇÕES (as únicas que esta régua dita além da frase do pedido):
//   - o controle de prender mora na aba Mapa (painel da direita) e tem nome
//     acessível com "prender", "presa/preso", "seguir", "acompanha",
//     "carregad…" ou "tocha" (`PRENDER`) quando a LUZ está selecionada; OU, com
//     a FICHA selecionada, nome com "prender", "tocha", "carregar luz" ou
//     "segurar luz" (`PRENDER_PELA_FICHA`);
//   - o controle é um `<select>`/combobox com a ficha pelo nome ("Lanterna"),
//     ou um botão que abre uma escolha (opção, item de menu, rádio ou botão com
//     o nome da ficha) — ou, se nada disso aparece, que espera o clique na
//     ficha no mapa;
//   - depois de prender, a aba Mapa mostra um botão cujo nome começa com
//     "Soltar"; apertá-lo desprende e o botão some.
//
// GEOMETRIA (px de mundo; cena 20x12 de grade 50 = 1000x600):
//   luz em (425,325), raio 110; ficha "Lanterna" de Ana em (725,325);
//   todo movimento é de 150 px para a ESQUERDA (ficha para (575,325)): para a
//   direita, a luz grudada na ficha sairia da borda do editor e cortaria o halo.
//   Dois pilares cinza neutros nos cantos, (75,75) e (925,525), existem só para
//   o "enquadrar conteúdo" do editor (`pixi/world.ts:contentBounds`, que não
//   conta peça de chão) abrir a cena inteira, e não 276% em cima da luz e da
//   ficha (medido na 1ª corrida: o halo ficava metade atrás do painel).
//   Distância luz-ficha = 300: é dela que sai a escala de cada tela.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ana entra, vê a própria ficha e o
// halo vermelho; o mestre seleciona a luz (o painel mostra "Intensidade") e
// arrasta a ficha — a ficha anda nas duas telas e a luz fica (o de hoje). Sem
// ele, o vermelho dos testes 2 a 6 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { Light, MapData, Token } from '../src/types/map'
import { pickTool } from './helpers/tools'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'TOCH01'
const J1 = 'Ana'
const AVENTURA = 'Aventura da Tocha'
const CENA = 'Galeria Funda'
const ID_CENA = 'scene_galeria'
const PASTA = 'C:/appdata/maps/map_tocha'
const TOKEN_J1 = 'Lanterna'

const GRADE = 50
const COLUNAS = 20
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }

/** Chão cinza neutro: sobre ele a vermelhidão mede o alpha da luz. */
const CHAO = '#5a5a5a'
const COR_DA_FICHA = '#3cff00'
const COR_DA_LUZ = '#ff0000'

type Ponto = { x: number; y: number }

const POS_LUZ: Ponto = { x: 425, y: 325 }
const RAIO_DA_LUZ = 110
const POS_FICHA: Ponto = { x: 725, y: 325 }
/** Distância luz-ficha no mundo: a régua de escala de cada tela. */
const DISTANCIA_LUZ_FICHA = Math.hypot(POS_FICHA.x - POS_LUZ.x, POS_FICHA.y - POS_LUZ.y)
/** Quanto a ficha anda em cada arrasto, em px de mundo (3 casas para a esquerda). */
const PASSO_MUNDO = 150

/** Botão parado antes de soltar (toque e fim de arrasto). */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por controle de tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem lê pixel: cada foto + decodificação custa segundos sob carga. */
const ESPERA_TELA = 15_000

/** Pixels mínimos para dizer "a ficha está na tela". */
const PIXELS_DE_FICHA = 60
/** Pixels mínimos de halo (vermelhidão acima de `LIMIAR_DE_LUZ`) para dizer "a luz está na tela". */
const PIXELS_DE_LUZ = 400
/** Vermelhidão mínima de um pixel de halo (alpha ~0,1). */
const LIMIAR_DE_LUZ = 25
/** Diferença máxima entre o que a luz andou e o que a ficha andou, em px de tela. */
const TOLERANCIA_PX = 14

const PRENDER = /prender|presa|preso|seguir|acompanha|carregad|tocha/i
const PRENDER_PELA_FICHA = /prender|tocha|carregar luz|segurar luz/i
const SOLTAR = /^soltar/i

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: uma cena com a luz e a ficha de Ana
// ───────────────────────────────────────────────────────────────────────────

/** Pilares cinza neutros nos cantos: só alargam o "enquadrar conteúdo" do editor. */
const PILAR_A: Ponto = { x: 75, y: 75 }
const PILAR_B: Ponto = { x: 925, y: 525 }
const COR_DO_PILAR = '#808080'

function pilar(id: string, name: string, p: Ponto): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color: COR_DO_PILAR }
}

function discoDaAventura(): Record<string, string> {
  const base = createEmptyMap('map_tocha', AVENTURA, COLUNAS, LINHAS, GRADE)
  const ficha: Token = { id: 'tok-lanterna', characterId: null, name: TOKEN_J1, x: POS_FICHA.x, y: POS_FICHA.y, size: 1, image: null, color: COR_DA_FICHA }
  const luz: Light = { id: 'luz-tocha', x: POS_LUZ.x, y: POS_LUZ.y, radius: RAIO_DA_LUZ, color: COR_DA_LUZ, intensity: 1 }
  const cena: MapData = {
    ...base,
    floor: [{ id: 'galeria-chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: CHAO },
    tokens: [ficha, pilar('tok-pilar-a', 'Pilar A', PILAR_A), pilar('tok-pilar-b', 'Pilar B', PILAR_B)],
    lights: [luz],
  }
  const aventura = {
    version: 1,
    id: 'adv_tocha',
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
  rede: Rede
  ana: Page
}

/** Mestre abre a aventura e a sala; Ana entra e recebe a Lanterna; o mestre volta ao mapa com Selecionar. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await pickTool(mestre, 'Selecionar')
  await expect(ana.locator('canvas').first(), `${J1}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => {
      const t = await lerTela(ana)
      return Math.min(t.ficha, t.luz >= PIXELS_DE_LUZ ? PIXELS_DE_FICHA + 1 : 0)
    }, { timeout: ESPERA_TELA, message: `${J1} deveria ver a própria ficha e o halo da luz` })
    .toBeGreaterThan(PIXELS_DE_FICHA)
  await expect
    .poll(async () => {
      const t = await lerTela(mestre)
      return Math.min(t.ficha, t.luz >= PIXELS_DE_LUZ ? PIXELS_DE_FICHA + 1 : 0)
    }, { timeout: ESPERA_TELA, message: 'o editor do mestre deveria mostrar a ficha e o halo da luz' })
    .toBeGreaterThan(PIXELS_DE_FICHA)
  return { rede, ana }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura da tela (só leitura de pixel) e gestos
// ───────────────────────────────────────────────────────────────────────────

interface Tela {
  /** Pixels verde-limão (a ficha de Ana). */
  ficha: number
  centroDaFicha: Ponto | null
  /** Pixels de halo vermelho acima do limiar. */
  luz: number
  /** Centro de massa da vermelhidão (pesado por ela). */
  centroDaLuz: Ponto | null
}

/**
 * Fotografa a página e conta pixels por cor, só onde o MAIOR canvas da página
 * está por cima (painéis, cartões e miniaturas não contam). Leitura pura:
 * decodifica a foto num canvas solto e pergunta `elementFromPoint`.
 */
async function lerTela(page: Page): Promise<Tela> {
  let foto: Awaited<ReturnType<Page['screenshot']>> | null = null
  for (let tentativa = 1; tentativa <= 3 && foto === null; tentativa += 1) {
    try {
      foto = await page.screenshot()
    } catch {
      await page.waitForTimeout(200)
    }
  }
  if (foto === null) throw new Error('não consegui fotografar a tela')
  return page.evaluate(
    async ({ b64, limiar }) => {
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
      const noCanvas = new Map<number, boolean>()
      const canvasPorCima = (x: number, y: number): boolean => {
        const chave = (y >> 3) * 65536 + (x >> 3)
        let v = noCanvas.get(chave)
        if (v === undefined) {
          v = principal !== null && document.elementFromPoint(((x >> 3) * 8 + 4) * escalaX, ((y >> 3) * 8 + 4) * escalaY) === principal
          noCanvas.set(chave, v)
        }
        return v
      }
      let ficha = 0
      let fx = 0
      let fy = 0
      let luz = 0
      let peso = 0
      let lx = 0
      let ly = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          const limao = G > 200 && R > 20 && R < 120 && B < 60
          const vermelhidao = R - (G + B) / 2
          // Vermelho sobre cinza neutro deixa G e B iguais; o amarelo da seleção e o limão da ficha não.
          const halo = vermelhidao > limiar && Math.abs(G - B) <= 24 && R > G + 20
          if (!limao && !halo) continue
          if (!canvasPorCima(x, y)) continue
          if (limao) {
            ficha += 1
            fx += x
            fy += y
          } else {
            luz += 1
            peso += vermelhidao
            lx += x * vermelhidao
            ly += y * vermelhidao
          }
        }
      }
      return {
        ficha,
        centroDaFicha: ficha > 0 ? { x: (fx / ficha) * escalaX, y: (fy / ficha) * escalaY } : null,
        luz,
        centroDaLuz: peso > 0 ? { x: (lx / peso) * escalaX, y: (ly / peso) * escalaY } : null,
      }
    },
    { b64: foto.toString('base64'), limiar: LIMIAR_DE_LUZ },
  )
}

async function telaParada(page: Page): Promise<Tela> {
  await page.waitForTimeout(PINTURA_MS)
  return lerTela(page)
}

/** Foto em que a ficha E a luz aparecem, com os dois centros. */
async function centros(page: Page, quem: string): Promise<{ ficha: Ponto; luz: Ponto }> {
  const t = await telaParada(page)
  if (t.centroDaFicha === null || t.ficha <= PIXELS_DE_FICHA) throw new Error(`${quem}: a ficha verde-limão não está na tela (${t.ficha} px)`)
  if (t.centroDaLuz === null || t.luz <= PIXELS_DE_LUZ) throw new Error(`${quem}: o halo vermelho da luz não está na tela (${t.luz} px)`)
  return { ficha: t.centroDaFicha, luz: t.centroDaLuz }
}

const distancia = (a: Ponto, b: Ponto): number => Math.hypot(a.x - b.x, a.y - b.y)
const menos = (a: Ponto, b: Ponto): Ponto => ({ x: a.x - b.x, y: a.y - b.y })
const fmt = (p: Ponto): string => `(${Math.round(p.x)}, ${Math.round(p.y)})`

/** px de tela por px de mundo, medido na foto de antes de prender (luz e ficha a 300 px de mundo). */
function escalaDaTela(inicio: { ficha: Ponto; luz: Ponto }): number {
  return distancia(inicio.ficha, inicio.luz) / DISTANCIA_LUZ_FICHA
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Arrasta com o ponteiro: desce, anda em passos, para um instante e solta. */
async function arrastar(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 20 })
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/**
 * Arrasta a ficha PASSO_MUNDO para a esquerda e espera a ficha aparecer no
 * lugar novo na tela; devolve os centros de antes e de depois.
 */
async function arrastarFichaEEsperar(
  quemArrasta: Page,
  quemOlha: Page,
  escalaDeQuemArrasta: number,
  oQue: string,
  /** -1 = para a esquerda (o padrão da régua), +1 = para a direita. */
  sentido: -1 | 1 = -1,
): Promise<{ antes: { ficha: Ponto; luz: Ponto }; depois: { ficha: Ponto; luz: Ponto } }> {
  const antes = await centros(quemOlha, `${oQue} (antes)`)
  const deArrasto = quemArrasta === quemOlha ? antes.ficha : (await centros(quemArrasta, `${oQue} (quem arrasta)`)).ficha
  await arrastar(quemArrasta, deArrasto, { x: deArrasto.x + sentido * PASSO_MUNDO * escalaDeQuemArrasta, y: deArrasto.y })
  const depois = await esperaFichaAndar(quemOlha, antes.ficha, oQue)
  return { antes, depois }
}

/**
 * Espera a ficha sair do lugar na tela (a câmera do jogador só se encaixa
 * quando o MAPA muda, `PlayerView.tsx:848`, então ficha que anda no mundo anda
 * na tela) e devolve os centros de depois.
 */
async function esperaFichaAndar(page: Page, fichaAntes: Ponto, oQue: string): Promise<{ ficha: Ponto; luz: Ponto }> {
  await expect
    .poll(async () => {
      const t = await lerTela(page)
      return t.centroDaFicha === null ? 0 : distancia(t.centroDaFicha, fichaAntes)
    }, { timeout: ESPERA_TELA, message: `${oQue}: a ficha deveria andar na tela depois do arrasto` })
    .toBeGreaterThan(20)
  return centros(page, `${oQue} (depois)`)
}

/** "A luz foi junto": a luz andou na tela o mesmo vetor que a ficha. */
function exigeLuzJunto(r: { antes: { ficha: Ponto; luz: Ponto }; depois: { ficha: Ponto; luz: Ponto } }, oQue: string): void {
  const andouFicha = menos(r.depois.ficha, r.antes.ficha)
  const andouLuz = menos(r.depois.luz, r.antes.luz)
  expect(
    distancia(andouLuz, andouFicha),
    `${oQue}: a ficha andou ${fmt(andouFicha)} px na tela e a luz andou ${fmt(andouLuz)} — a luz presa deveria ir junto (luz ${fmt(r.antes.luz)} → ${fmt(r.depois.luz)})`,
  ).toBeLessThan(TOLERANCIA_PX)
}

/** Nomes do que é clicável/escolhível na aba Mapa, para a mensagem de falha dizer o que existe hoje. */
async function controlesDoPainel(painel: Locator): Promise<string> {
  const nomes: string[] = []
  for (const papel of ['button', 'combobox', 'checkbox', 'switch'] as const) {
    for (const el of await painel.getByRole(papel).all()) {
      if (!(await el.isVisible())) continue
      const nome = ((await el.getAttribute('aria-label')) ?? (await el.innerText()).trim()).replace(/\s+/g, ' ')
      if (nome) nomes.push(`${papel}:"${nome.slice(0, 40)}"`)
    }
  }
  return nomes.join(' | ')
}

async function primeiroVisivel(candidatos: Locator[], ate: number): Promise<Locator | null> {
  const fim = Date.now() + ate
  do {
    for (const c of candidatos) if (await c.first().isVisible().catch(() => false)) return c.first()
    await new Promise((r) => setTimeout(r, 200))
  } while (Date.now() < fim)
  return null
}

/**
 * O mestre prende a luz na Lanterna pelo painel: seleciona a luz no mapa e usa
 * o controle de prender; se o painel da luz não tiver, tenta pelo da ficha.
 * Termina com o botão "Soltar" visível na aba Mapa.
 */
async function mestrePrendeLuzNaFicha(mestre: Page, pontos: { ficha: Ponto; luz: Ponto }): Promise<void> {
  const painel = mestre.getByRole('tabpanel', { name: 'Mapa' })
  await tocar(mestre, pontos.luz)
  await expect(painel.getByRole('slider', { name: 'Intensidade' }), 'tocar a luz com Selecionar deveria abrir o painel "Luz"').toBeVisible({ timeout: ESPERA })

  const pelaLuz = [painel.getByRole('combobox', { name: PRENDER }), painel.getByRole('button', { name: PRENDER }), painel.getByRole('checkbox', { name: PRENDER }), painel.getByRole('switch', { name: PRENDER })]
  let controle = await primeiroVisivel(pelaLuz, ESPERA)
  const noPainelDaLuz = await controlesDoPainel(painel)
  let noPainelDaFicha = '(não olhado)'
  if (controle === null) {
    await tocar(mestre, pontos.ficha)
    const pelaFicha = [painel.getByRole('combobox', { name: PRENDER_PELA_FICHA }), painel.getByRole('button', { name: PRENDER_PELA_FICHA }), painel.getByRole('checkbox', { name: PRENDER_PELA_FICHA })]
    controle = await primeiroVisivel(pelaFicha, 2000)
    noPainelDaFicha = await controlesDoPainel(painel)
  }
  if (controle === null) {
    throw new Error(
      `não há como prender a luz numa ficha: nem o painel da luz nem o da ficha têm controle de prender.\n  Painel com a luz selecionada: ${noPainelDaLuz}\n  Painel com a ficha selecionada: ${noPainelDaFicha}`,
    )
  }

  const tag = await controle.evaluate((el) => el.tagName)
  if (tag === 'SELECT') {
    await controle.selectOption({ label: TOKEN_J1 })
  } else {
    await controle.click()
    const escolha = await primeiroVisivel(
      [
        mestre.getByRole('option', { name: TOKEN_J1 }),
        mestre.getByRole('menuitem', { name: TOKEN_J1 }),
        mestre.getByRole('menuitemradio', { name: TOKEN_J1 }),
        mestre.getByRole('radio', { name: TOKEN_J1 }),
        mestre.getByRole('dialog').getByRole('button', { name: TOKEN_J1 }),
        painel.getByRole('button', { name: TOKEN_J1, exact: true }),
      ],
      2000,
    )
    if (escolha !== null) await escolha.click()
    else if (!(await painel.getByRole('button', { name: SOLTAR }).first().isVisible())) await tocar(mestre, pontos.ficha)
  }
  await expect(painel.getByRole('button', { name: SOLTAR }).first(), `depois de prender a luz em ${TOKEN_J1}, a aba Mapa deveria oferecer "Soltar"`).toBeVisible({ timeout: ESPERA })
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana vê a ficha e o halo; o mestre seleciona a luz e arrasta a ficha, que anda nas duas telas (a luz fica)', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const noMestre = await centros(page, 'mestre')
  const escala = escalaDaTela(noMestre)
  expect(escala, 'a escala do editor saída da foto deveria ser plausível').toBeGreaterThan(0.2)

  // Tocar a luz abre o painel dela: é o ponto de partida da feature.
  await tocar(page, noMestre.luz)
  await expect(page.getByRole('tabpanel', { name: 'Mapa' }).getByRole('slider', { name: 'Intensidade' }), 'tocar a luz deveria abrir "Intensidade"').toBeVisible({ timeout: ESPERA })

  // Arrastar a ficha funciona hoje, no editor e na tela de Ana; a luz solta fica onde está.
  const emAnaAntes = await centros(ana, J1)
  const r = await arrastarFichaEEsperar(page, page, escala, 'mestre arrasta a ficha solta')
  expect(Math.abs(r.depois.ficha.x - r.antes.ficha.x + PASSO_MUNDO * escala), 'a ficha deveria andar 3 casas no editor').toBeLessThan(TOLERANCIA_PX * 2)
  expect(distancia(r.depois.luz, r.antes.luz), 'luz solta não anda quando a ficha anda').toBeLessThan(TOLERANCIA_PX)
  const emAnaDepois = await esperaFichaAndar(ana, emAnaAntes.ficha, `${J1} vendo o arrasto do mestre`)
  expect(distancia(emAnaDepois.luz, emAnaAntes.luz), `na tela de ${J1} a luz solta fica parada`).toBeLessThan(TOLERANCIA_PX)

  // O gesto do teste 5 funciona hoje: Ana arrasta a própria ficha de volta, e a luz solta fica.
  const escalaDeAna = escalaDaTela(emAnaAntes)
  const deAna = await arrastarFichaEEsperar(ana, ana, escalaDeAna, `${J1} arrasta a própria ficha solta`, 1)
  expect(Math.abs(deAna.depois.ficha.x - deAna.antes.ficha.x - PASSO_MUNDO * escalaDeAna), `${J1} deveria andar 3 casas com a própria ficha`).toBeLessThan(TOLERANCIA_PX * 2)
  expect(distancia(deAna.depois.luz, deAna.antes.luz), `na tela de ${J1} a luz solta não anda com a ficha dela`).toBeLessThan(TOLERANCIA_PX)
})

test('2. prender: com a luz selecionada o mestre a prende na Lanterna e o painel passa a oferecer "Soltar"', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  await mesaMontada(browser, page, baseURL ?? '')
  const noMestre = await centros(page, 'mestre')
  await mestrePrendeLuzNaFicha(page, noMestre)
})

test('3. no editor: com a luz presa, o mestre arrasta a Lanterna e a luz vai junto', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  await mesaMontada(browser, page, baseURL ?? '')
  const inicio = await centros(page, 'mestre')
  const escala = escalaDaTela(inicio)
  await mestrePrendeLuzNaFicha(page, inicio)
  const r = await arrastarFichaEEsperar(page, page, escala, 'editor do mestre')
  exigeLuzJunto(r, 'editor do mestre')
})

test('4. na tela do jogador: o mestre arrasta a Lanterna com a luz presa e Ana vê a luz ir junto', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const noMestre = await centros(page, 'mestre')
  const escala = escalaDaTela(noMestre)
  await mestrePrendeLuzNaFicha(page, noMestre)
  const r = await arrastarFichaEEsperar(page, ana, escala, `tela de ${J1} com o mestre arrastando`)
  exigeLuzJunto(r, `tela de ${J1}`)
})

test('5. Ana arrasta a própria ficha com a tocha presa e a luz anda com ela na tela dela', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const escalaDeAna = escalaDaTela(await centros(ana, J1))
  await mestrePrendeLuzNaFicha(page, await centros(page, 'mestre'))
  const r = await arrastarFichaEEsperar(ana, ana, escalaDeAna, `${J1} arrastando a própria ficha`)
  exigeLuzJunto(r, `${J1} arrastando a própria ficha`)
})

test('6. soltar: depois de "Soltar" a ficha anda sozinha e a luz fica onde estava, no editor e na tela de Ana', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const inicio = await centros(page, 'mestre')
  const escala = escalaDaTela(inicio)
  await mestrePrendeLuzNaFicha(page, inicio)

  const painel = page.getByRole('tabpanel', { name: 'Mapa' })
  const soltar = painel.getByRole('button', { name: SOLTAR }).first()
  await soltar.click()
  await expect(soltar, '"Soltar" deveria desprender e sumir do painel').toBeHidden({ timeout: ESPERA })

  const emAnaAntes = await centros(ana, J1)
  const r = await arrastarFichaEEsperar(page, page, escala, 'editor depois de soltar')
  // Controle positivo: sem a ficha andar, "a luz fica" passaria com o arrasto morto.
  expect(distancia(r.depois.ficha, r.antes.ficha), 'depois de "Soltar" a ficha deveria andar no editor').toBeGreaterThan((PASSO_MUNDO * escala) / 2)
  expect(distancia(r.depois.luz, r.antes.luz), `depois de "Soltar" a luz deveria ficar em ${fmt(r.antes.luz)}, e foi para ${fmt(r.depois.luz)}`).toBeLessThan(TOLERANCIA_PX)
  const emAnaDepois = await esperaFichaAndar(ana, emAnaAntes.ficha, `${J1} depois de soltar`)
  expect(distancia(emAnaDepois.ficha, emAnaAntes.ficha), `na tela de ${J1} a ficha deveria andar depois de "Soltar"`).toBeGreaterThan(TOLERANCIA_PX)
  expect(distancia(emAnaDepois.luz, emAnaAntes.luz), `na tela de ${J1} a luz solta deveria ficar em ${fmt(emAnaAntes.luz)}, e foi para ${fmt(emAnaDepois.luz)}`).toBeLessThan(TOLERANCIA_PX)
})
