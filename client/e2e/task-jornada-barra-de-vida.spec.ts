// JORNADA DE USUÁRIO da BARRA DE VIDA NA FICHA (item 14 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A DOR: "Ninguém sabe quanto falta para o monstro cair sem o mestre narrar."
//
// A FEATURE:
//   - com uma ficha selecionada, o mestre informa no painel dela a VIDA ATUAL e
//     a VIDA MÁXIMA;
//   - uma barra FINA aparece SOB a ficha, no mapa; ela é discreta (pinta menos
//     que a própria ficha e não a cobre) e muda quando a vida muda;
//   - a barra é de CADA ficha: dar vida ao monstro não desenha nada sob a ficha
//     do herói;
//   - o mestre escolhe, ficha por ficha, se os JOGADORES veem a barra; o
//     mestre sempre vê. Barra oculta não aparece na tela do jogador e os
//     números dela não viajam até ele (o jogador nunca recebe o que o mestre
//     escondeu — mesma regra da névoa em HANDOFF.md/PEDIDOS.md).
//
// ONDE ISSO MORRE HOJE:
//   - `src/types/map.ts:413` — `Token` não tem campo de vida (só nome,
//     posição, tamanho, imagem, rotação, cor, travado, oculto, segredo);
//   - `src/components/PropertiesPanel.tsx:403-427` — o painel da ficha só
//     oferece Nome, Tamanho, Cor, Imagem e Rotação/Travado/Ocultos; não há
//     onde digitar vida;
//   - `src/pixi/tokensRenderer.ts:325-343` — a ficha é disco + contorno +
//     rótulo com o nome logo abaixo (`radius + 2`); nada mais é desenhado.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (mesmo preparo de
// task-jornada-painel-do-grupo.spec.ts e task-jornada-viagem-do-jogador.spec.ts):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   a jogadora Ana é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado: o que ela manda pelo WebSocket roteado
//   vira `net:message` na página do mestre, e o `net_send` do mestre volta ao
//   socket dela por `exposeFunction`. A sessão do host é a do app
//   (`net/hostBridge.ts`), sem estado injetado.
//   DISCO DE MENTIRA COM A CENA PRONTA: uma cena com duas fichas (Lu, da Ana,
//   verde-limão; Og, o monstro, laranja) vem de um `adventure.json` no disco
//   falso do Tauri e é aberta pelo menu ("Carregar Mapa existente").
//   GESTO REAL NA AÇÃO SOB TESTE. Clique do ponteiro na ficha (ferramenta
//   Selecionar), clique no campo, Ctrl+A, dígitos tecla a tecla, Tab para sair
//   do campo, Escape para largar a seleção. Os únicos `evaluate` são o repasse
//   do transporte e a LEITURA de pixel (decodifica a foto num canvas solto e
//   pergunta `elementFromPoint`).
//   PROVA NA TELA, POR DIFERENÇA DE FOTO. A régua não dita a cor nem o
//   desenho da barra: ela acha cada ficha pela cor dela na foto (centro e
//   raio), fotografa a tela ANTES e DEPOIS, e conta os pixels que mudaram numa
//   faixa logo ABAIXO da ficha (de 0,45 a 2,6 raios do centro, 1,8 raio para
//   cada lado) e numa faixa igual logo ACIMA. "Apareceu uma barra sob a ficha"
//   = a faixa de baixo mudou bastante e mais que o dobro da de cima. O
//   controle positivo prova que, sem ninguém mexer, as faixas não mudam sozinhas
//   e que selecionar e largar (Escape) a ficha devolve a tela igual — sem isso,
//   "mudou" poderia ser ruído ou realce de seleção. Se a câmera se mexer entre
//   as duas fotos (centro da ficha andou mais de 2 px), a régua falha dizendo
//   isso, em vez de ler câmera como barra.
//   FRAMES. Com o socket roteado, o que a página da Ana recebe é o que a rota
//   entrega; a régua só anota (`Rede.enviados`) para cobrar que os números da
//   vida oculta do monstro (173 de 419, escolhidos para não colidir com
//   coordenada nenhuma da cena) não viajem.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - os campos ficam no painel da ficha selecionada, na aba Mapa do rail, e
//     são campos de número ou de texto com nome acessível "Vida atual" e "Vida
//     máxima" (`VIDA_ATUAL`/`VIDA_MAXIMA` aceitam também "PV atual", "Pontos de
//     vida", "Vida total", "Máxima");
//   - o valor digitado vale ao sair do campo com Tab;
//   - a escolha "os jogadores veem a barra" é, por ficha, um interruptor
//     (checkbox/switch) cujo nome fala de barra ou vida E de jogadores/mesa
//     ("Jogadores veem a barra", "Mostrar vida aos jogadores" — ou o inverso,
//     "Esconder a barra dos jogadores"), OU um grupo de opções (radiogroup ou
//     lista) com nome de barra/vida e as opções "Jogadores/Todos" e "Só o
//     mestre/Oculta". O "Oculto para jogadores" que já existe é da FICHA
//     inteira e fica de fora;
//   - Escape larga a seleção da ficha (é o que o editor faz hoje,
//     `pixi/PixiCanvas.tsx:5288-5306`), e o painel da ficha some.
//
// CONTROLE POSITIVO (verde hoje): teste 1. A mesa monta, Ana recebe a ficha,
// as duas telas mostram as duas fichas, as faixas não mudam sozinhas, e
// selecionar Og pelo clique abre o painel da ficha que o Escape fecha, sem
// deixar rastro na foto. Os testes 2 a 5 cobram a feature e morrem hoje ao
// procurar o campo de vida no painel.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'VIDA01'
const JOGADORA = 'Ana'
const AVENTURA = 'Aventura da Vida'
const CENA = 'Sala do Ogro'
const ID_CENA = 'scene_ogro'
const PASTA = 'C:/appdata/maps/map_vida'

/** Nomes curtos: o rótulo com o nome fica sob a ficha e a régua quer pouca tinta de texto ali. */
const HEROI = 'Lu'
const MONSTRO = 'Og'
const ID_HEROI = 'tok-lu'
const ID_MONSTRO = 'tok-og'

const GRADE = 50
const COLUNAS = 20
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }

const CHAO = '#1e8c8c'
const COR_HEROI = '#3cff00'
const COR_MONSTRO = '#ff5a00'

type Ponto = { x: number; y: number }

/**
 * As duas fichas no meio do mapa (o painel do mestre cobre a esquerda do
 * canvas), na MESMA linha e a três casas uma da outra: as faixas de uma não
 * encostam nas da outra, e as duas cabem no raio de visão de 700 px da Ana.
 */
const POS_HEROI: Ponto = { x: 400, y: 300 }
const POS_MONSTRO: Ponto = { x: 550, y: 300 }

/**
 * Paredes na borda do chão. O editor enquadra ao abrir pelo CONTEÚDO
 * (`pixi/world.ts:contentBounds`), que não conta o chão: sem as paredes o
 * enquadramento pega só as duas fichas e abre a 400%, com a ficha do tamanho
 * de meia tela (medido na primeira calibração, 23/09: raio de 80 px).
 */
function paredesDaBorda(): Wall[] {
  const [x0, y0, x1, y1] = [10, 10, LARGURA - 10, ALTURA - 10]
  const parede = (id: string, a: Ponto, b: Ponto): Wall => ({ id, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: true, blocksMove: true, door: null })
  return [
    parede('p-norte', { x: x0, y: y0 }, { x: x1, y: y0 }),
    parede('p-leste', { x: x1, y: y0 }, { x: x1, y: y1 }),
    parede('p-sul', { x: x1, y: y1 }, { x: x0, y: y1 }),
    parede('p-oeste', { x: x0, y: y1 }, { x: x0, y: y0 }),
  ]
}

/**
 * Onde o ponteiro do mestre descansa entre os gestos: fora do mapa, no canto
 * de baixo do canvas. Ponteiro parado em cima da ficha acende o realce de
 * passar o mouse, e em cima da ferramenta abre a dica — os dois entram na foto.
 */
const DESCANSO: Ponto = { x: 1000, y: 790 }

/** Vidas escolhidas para a régua. As do monstro oculto não colidem com coordenada nenhuma da cena. */
const VIDA_CHEIA = { atual: 10, maxima: 10 }
const VIDA_POUCA = { atual: 3, maxima: 10 }
const VIDA_DO_MONSTRO = { atual: 7, maxima: 10 }
const VIDA_DO_HEROI = { atual: 6, maxima: 10 }
const VIDA_OCULTA = { atual: 173, maxima: 419 }

/**
 * Teto de cada teste. Medido na calibração de 23/09 com a máquina carregada
 * (várias pistas rodando Playwright): só montar a mesa e ler as duas telas
 * levou 2,8 min no controle positivo.
 */
const TEMPO_DE_TESTE = 330_000
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por controle: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** A leitura com cobertura na tela do mestre custa mais (medido no painel do grupo: 5-7 s). */
const ESPERA_TELA_MESTRE = 25_000

/** Pixels mínimos para dizer "esta ficha está na tela". */
const PIXELS_DE_TOKEN = 60
/** Um canal que muda mais que isto conta o pixel como "mudou". */
const LIMIAR_DE_MUDANCA = 35
/** Pixels que podem mudar numa faixa sem ninguém mexer (antisserrilhado, arredondamento). */
const RESIDUO = 12
/** Quanto o centro de uma ficha pode andar entre duas fotos sem ser câmera mexendo. */
const CAMERA_PARADA_PX = 2
/** Barra: pixels mudados na faixa de baixo, em fração de r² (r = raio da ficha na tela). */
const BARRA_MIN_R2 = 0.06
const BARRA_MIN_ABS = 30
/** Mudança de vida: a barra de 10/10 para 3/10 muda pelo menos isto (fração de r²). */
const MUDANCA_MIN_R2 = 0.04
const MUDANCA_MIN_ABS = 20
/** Discreta: a barra pinta menos que a ficha inteira (π r²) e deixa pelo menos 85% do disco à vista. */
const DISCO_QUE_FICA = 0.85

const VIDA_ATUAL = /vida atual|^\s*vida\s*$|pv atua|pontos de vida( atuais)?\s*$/i
const VIDA_MAXIMA = /vida m[áa]x|vida total|pv m[áa]x|^\s*m[áa]xim[ao]\s*$/i
const FALA_DE_BARRA = /barra|vida/i
const FALA_DE_JOGADOR = /jogador|mesa|todos/i
const POLARIDADE_OCULTA = /escond|ocult|s[óo]\s*(o|para o)?\s*mestre|n[ãa]o/i
const OPCAO_JOGADORES_VEEM = /jogador|todos|mesa|vis[ií]vel|mostrar/i
const OPCAO_SO_O_MESTRE = /s[óo]\s*(o|para o)?\s*mestre|ocult|escond|n[ãa]o/i
const OCULTO_DA_FICHA_INTEIRA = /^oculto para jogadores$/i

// ───────────────────────────────────────────────────────────────────────────
// A cena no disco: duas fichas no chão verde-água
// ───────────────────────────────────────────────────────────────────────────

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function discoDaCena(): Record<string, string> {
  const base = createEmptyMap('map_vida', AVENTURA, COLUNAS, LINHAS, GRADE)
  const mapa: MapData = {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: CHAO },
    walls: paredesDaBorda(),
    tokens: [token(ID_HEROI, HEROI, POS_HEROI, COR_HEROI), token(ID_MONSTRO, MONSTRO, POS_MONSTRO, COR_MONSTRO)],
    pins: [],
  }
  const aventura = {
    version: 1,
    id: 'adv_vida',
    name: AVENTURA,
    startSceneId: ID_CENA,
    scenes: [{ id: ID_CENA, name: CENA, file: 'map.json' }],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(mapa),
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

/** O "Rust" de mentira: liga o WebSocket da jogadora ao `net:*` do mestre, nos dois sentidos. */
interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Tudo que o mestre mandou para cada jogador, em ordem (o que o fio entregou). */
  enviados: Map<string, string[]>
  fila: Promise<void>
}

async function mestreAbreACena(mestre: Page): Promise<Rede> {
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
    { arquivos: discoDaCena(), codigo: CODIGO },
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

function painelJogo(mestre: Page): Locator {
  return mestre.locator('#lb-rail-panel-room')
}

/** Aba Jogo, card da jogadora, "Atribuir <ficha>" — o clique que o painel oferece hoje. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDaFicha: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const card = painelJogo(mestre).locator('.lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${nomeDaFicha}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDaFicha}` }), `${jogador} deveria ficar com ${nomeDaFicha}`).toBeVisible()
}

// ───────────────────────────────────────────────────────────────────────────
// A jogadora: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  clientId: string
  nome: string
  frames: string[]
}

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
// Leitura de pixel (pura: foto → canvas solto → contagem)
// ───────────────────────────────────────────────────────────────────────────

type Foto = Awaited<ReturnType<Page['screenshot']>>

/** Uma ficha achada na tela: centro e raio em px CSS, e quantos pixels da cor dela há. */
interface Ficha {
  x: number
  y: number
  r: number
  n: number
}

interface Fichas {
  heroi: Ficha | null
  monstro: Ficha | null
}

interface Retangulo {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** O que mudou entre duas fotos: pixels mudados por retângulo, e onde estavam as fichas em cada uma. */
interface Diferenca {
  mudados: number[]
  antes: Fichas
  depois: Fichas
}

async function fotografar(page: Page): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await page.screenshot()
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error('não consegui fotografar a tela')
}

/**
 * Acha as duas fichas pela cor, SÓ onde o canvas principal (o maior) está por
 * cima: painéis, cartões e o minimapa não contam. Mesmo truque de blocos de
 * 16 px de task-jornada-painel-do-grupo.spec.ts para `elementFromPoint` não
 * custar uma leitura por pixel.
 */
async function acharFichas(page: Page, foto: Foto): Promise<Fichas> {
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
    const soma = { limao: { n: 0, x: 0, y: 0 }, laranja: { n: 0, x: 0, y: 0 } }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const limao = G > 200 && R > 20 && R < 120 && B < 60
        const laranja = R > 200 && G > 50 && G < 140 && B < 60
        if (!limao && !laranja) continue
        if (!canvasPorCima(x, y)) continue
        const alvo = limao ? soma.limao : soma.laranja
        alvo.n += 1
        alvo.x += x
        alvo.y += y
      }
    }
    const ficha = (s: { n: number; x: number; y: number }) =>
      s.n === 0 ? null : { x: (s.x / s.n) * escalaX, y: (s.y / s.n) * escalaY, r: Math.sqrt(s.n / Math.PI) * escalaX, n: s.n }
    return { heroi: ficha(soma.limao), monstro: ficha(soma.laranja) }
  }, foto.toString('base64'))
}

/**
 * Compara duas fotos da MESMA tela: conta, em cada retângulo (px CSS), os
 * pixels em que algum canal mudou mais que `LIMIAR_DE_MUDANCA`; e acha as
 * fichas pela cor em cada foto (sem cobertura: é só para saber se a câmera
 * ficou parada e se o disco continua à vista).
 */
async function compararFotos(page: Page, antes: Foto, depois: Foto, retangulos: Retangulo[]): Promise<Diferenca> {
  return page.evaluate(
    async ({ a, b, rets, limiar }) => {
      const decodificar = async (b64: string) => {
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
        const tela = document.createElement('canvas')
        tela.width = bmp.width
        tela.height = bmp.height
        const ctx = tela.getContext('2d')
        if (!ctx) throw new Error('sem contexto 2d')
        ctx.drawImage(bmp, 0, 0)
        return ctx.getImageData(0, 0, bmp.width, bmp.height)
      }
      const A = await decodificar(a)
      const B = await decodificar(b)
      const width = Math.min(A.width, B.width)
      const height = Math.min(A.height, B.height)
      const escalaX = window.innerWidth / width
      const escalaY = window.innerHeight / height
      const mudados = rets.map((r) => {
        const x0 = Math.max(0, Math.floor(r.x0 / escalaX))
        const x1 = Math.min(width - 1, Math.ceil(r.x1 / escalaX))
        const y0 = Math.max(0, Math.floor(r.y0 / escalaY))
        const y1 = Math.min(height - 1, Math.ceil(r.y1 / escalaY))
        let n = 0
        for (let y = y0; y <= y1; y += 1) {
          for (let x = x0; x <= x1; x += 1) {
            const ia = (y * A.width + x) * 4
            const ib = (y * B.width + x) * 4
            const d = Math.max(Math.abs(A.data[ia] - B.data[ib]), Math.abs(A.data[ia + 1] - B.data[ib + 1]), Math.abs(A.data[ia + 2] - B.data[ib + 2]))
            if (d > limiar) n += 1
          }
        }
        return n
      })
      const fichas = (img: ImageData) => {
        const soma = { limao: { n: 0, x: 0, y: 0 }, laranja: { n: 0, x: 0, y: 0 } }
        for (let y = 0; y < img.height; y += 1) {
          for (let x = 0; x < img.width; x += 1) {
            const i = (y * img.width + x) * 4
            const R = img.data[i]
            const G = img.data[i + 1]
            const Bl = img.data[i + 2]
            const limao = G > 200 && R > 20 && R < 120 && Bl < 60
            const laranja = R > 200 && G > 50 && G < 140 && Bl < 60
            if (!limao && !laranja) continue
            const alvo = limao ? soma.limao : soma.laranja
            alvo.n += 1
            alvo.x += x
            alvo.y += y
          }
        }
        const ficha = (s: { n: number; x: number; y: number }) =>
          s.n === 0 ? null : { x: (s.x / s.n) * escalaX, y: (s.y / s.n) * escalaY, r: Math.sqrt(s.n / Math.PI) * escalaX, n: s.n }
        return { heroi: ficha(soma.limao), monstro: ficha(soma.laranja) }
      }
      return { mudados, antes: fichas(A), depois: fichas(B) }
    },
    { a: antes.toString('base64'), b: depois.toString('base64'), rets: retangulos, limiar: LIMIAR_DE_MUDANCA },
  )
}

/** Faixa logo ABAIXO da ficha: onde a barra tem de aparecer. */
function faixaSob(f: Ficha): Retangulo {
  return { x0: f.x - 1.8 * f.r, x1: f.x + 1.8 * f.r, y0: f.y + 0.45 * f.r, y1: f.y + 2.6 * f.r }
}

/** Faixa do mesmo tamanho logo ACIMA da ficha: onde a barra NÃO é "sob a ficha". */
function faixaSobre(f: Ficha): Retangulo {
  return { x0: f.x - 1.8 * f.r, x1: f.x + 1.8 * f.r, y0: f.y - 2.6 * f.r, y1: f.y - 0.45 * f.r }
}

function barraMinima(f: Ficha): number {
  return Math.max(BARRA_MIN_ABS, BARRA_MIN_R2 * f.r * f.r)
}

function mudancaMinima(f: Ficha): number {
  return Math.max(MUDANCA_MIN_ABS, MUDANCA_MIN_R2 * f.r * f.r)
}

const emTexto = (f: Ficha | null): string => (f === null ? 'ausente' : `(${Math.round(f.x)}, ${Math.round(f.y)}) r=${f.r.toFixed(1)} n=${f.n}`)

/** A câmera ficou parada entre as duas fotos: nenhuma ficha andou mais que `CAMERA_PARADA_PX`. */
function cameraParada(d: Diferenca): string | null {
  for (const qual of ['heroi', 'monstro'] as const) {
    const a = d.antes[qual]
    const b = d.depois[qual]
    if (a === null || b === null) return `${qual}: ${emTexto(a)} → ${emTexto(b)}`
    if (Math.hypot(a.x - b.x, a.y - b.y) > CAMERA_PARADA_PX) return `${qual} andou de ${emTexto(a)} para ${emTexto(b)}`
  }
  return null
}

/** Uma tela com as duas fichas achadas e a foto de referência (antes de qualquer vida). */
interface Referencia {
  page: Page
  quem: string
  heroi: Ficha
  monstro: Ficha
  foto: Foto
}

/** Espera as duas fichas aparecerem na tela e guarda a foto de referência. */
async function referencia(page: Page, quem: string, espera: number): Promise<Referencia> {
  const ultima: { foto: Foto | null; fichas: Fichas } = { foto: null, fichas: { heroi: null, monstro: null } }
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(PINTURA_MS)
        const foto = await fotografar(page)
        ultima.foto = foto
        ultima.fichas = await acharFichas(page, foto)
        return Math.min(ultima.fichas.heroi?.n ?? 0, ultima.fichas.monstro?.n ?? 0)
      },
      { timeout: espera, message: `${quem} deveria ver as duas fichas (${HEROI} limão e ${MONSTRO} laranja) na tela` },
    )
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  const { heroi, monstro } = ultima.fichas
  if (heroi === null || monstro === null || ultima.foto === null) throw new Error(`${quem}: fichas não achadas`)
  return { page, quem, heroi, monstro, foto: ultima.foto }
}

/** Foto de agora comparada com a de referência, nas faixas de baixo e de cima das duas fichas. */
async function faixasAgora(ref: Referencia): Promise<{ d: Diferenca; sobHeroi: number; sobreHeroi: number; sobMonstro: number; sobreMonstro: number; leitura: string }> {
  await ref.page.waitForTimeout(PINTURA_MS)
  const agora = await fotografar(ref.page)
  const d = await compararFotos(ref.page, ref.foto, agora, [faixaSob(ref.heroi), faixaSobre(ref.heroi), faixaSob(ref.monstro), faixaSobre(ref.monstro)])
  const [sobHeroi, sobreHeroi, sobMonstro, sobreMonstro] = d.mudados
  const leitura =
    `${ref.quem}: mudados sob ${HEROI}=${sobHeroi}, sobre ${HEROI}=${sobreHeroi}, sob ${MONSTRO}=${sobMonstro}, sobre ${MONSTRO}=${sobreMonstro}; ` +
    `${HEROI} ${emTexto(d.depois.heroi)}, ${MONSTRO} ${emTexto(d.depois.monstro)}`
  return { d, sobHeroi, sobreHeroi, sobMonstro, sobreMonstro, leitura }
}

/**
 * Espera a barra aparecer sob uma ficha: a faixa de baixo muda o bastante e
 * mais que o dobro da de cima, com a câmera parada. Devolve a última leitura.
 */
async function esperaBarraSob(ref: Referencia, qual: 'heroi' | 'monstro', oQue: string, espera: number): Promise<{ sob: number; leitura: string; d: Diferenca }> {
  const ficha = ref[qual]
  let ultima = { sob: 0, leitura: '(sem leitura)', d: null as Diferenca | null }
  await expect
    .poll(
      async () => {
        const f = await faixasAgora(ref)
        const camera = cameraParada(f.d)
        if (camera !== null) return `a câmera mexeu entre as fotos (${camera}) — a régua não lê câmera como barra`
        const sob = qual === 'heroi' ? f.sobHeroi : f.sobMonstro
        const sobre = qual === 'heroi' ? f.sobreHeroi : f.sobreMonstro
        ultima = { sob, leitura: f.leitura, d: f.d }
        if (sob < barraMinima(ficha)) return `nada novo sob a ficha: ${sob} pixels mudados (mínimo ${Math.round(barraMinima(ficha))}) — ${f.leitura}`
        if (sob <= 2 * sobre) return `mudou tanto em cima quanto embaixo (sob=${sob}, sobre=${sobre}): não é uma barra SOB a ficha — ${f.leitura}`
        return 'barra sob a ficha'
      },
      { timeout: espera, message: oQue },
    )
    .toBe('barra sob a ficha')
  if (ultima.d === null) throw new Error('sem leitura')
  return { sob: ultima.sob, leitura: ultima.leitura, d: ultima.d }
}

// ───────────────────────────────────────────────────────────────────────────
// Os gestos do mestre no painel da ficha
// ───────────────────────────────────────────────────────────────────────────

const apagarFicha = (mestre: Page): Locator => mestre.getByRole('button', { name: 'Apagar token selecionado' })

/** Aba Mapa, ferramenta Selecionar, clique no centro da ficha: o painel dela abre. */
async function mestreSelecionaFicha(mestre: Page, ficha: Ficha, nome: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await mestre.getByRole('button', { name: 'Selecionar', exact: true }).click()
  await mestre.mouse.click(Math.round(ficha.x), Math.round(ficha.y))
  await mestre.mouse.move(DESCANSO.x, DESCANSO.y, { steps: 5 })
  await expect(apagarFicha(mestre), `clicar em ${nome} (${Math.round(ficha.x)}, ${Math.round(ficha.y)}) deveria abrir o painel da ficha`).toBeVisible({ timeout: ESPERA })
}

/** Escape larga a seleção; o painel da ficha some e o realce sai da foto. */
async function mestreLargaSelecao(mestre: Page): Promise<void> {
  await mestre.mouse.move(DESCANSO.x, DESCANSO.y, { steps: 5 })
  await mestre.keyboard.press('Escape')
  if (await apagarFicha(mestre).isVisible()) await mestre.keyboard.press('Escape')
  await expect(apagarFicha(mestre), 'Escape deveria largar a ficha selecionada').toBeHidden({ timeout: ESPERA })
}

/** Todo nome acessível de controle na tela — só para a falha dizer o que EXISTE hoje. */
async function controlesNaTela(mestre: Page): Promise<string> {
  const nomes = await mestre
    .locator('#lb-rail-panel-map, [role="tabpanel"]')
    .locator('button, input, select, [role="checkbox"], [role="switch"], [role="radio"], [role="spinbutton"], [role="combobox"]')
    .evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null || el.getClientRects().length > 0)
        .map((el) => {
          const id = el.getAttribute('id')
          const rotulo = id ? document.querySelector(`label[for="${id}"]`)?.textContent : null
          const pai = el.closest('label')?.textContent
          return (el.getAttribute('aria-label') ?? rotulo ?? pai ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
        })
        .filter((n) => n !== ''),
    )
  return Array.from(new Set(nomes)).join(' | ') || '(nenhum)'
}

function campoDeVida(mestre: Page, nome: RegExp): Locator {
  return mestre.getByRole('spinbutton', { name: nome }).or(mestre.getByRole('textbox', { name: nome }))
}

/** Clique no campo, Ctrl+A, dígitos tecla a tecla, Tab para sair. */
async function digitarNoCampo(mestre: Page, campo: Locator, valor: number): Promise<void> {
  await campo.click()
  await mestre.keyboard.press('Control+A')
  await mestre.keyboard.type(String(valor), { delay: 25 })
  await mestre.keyboard.press('Tab')
}

/** Com a ficha selecionada, informa vida atual e máxima no painel dela. */
async function informarVida(mestre: Page, vida: { atual: number; maxima: number }, oQue: string): Promise<void> {
  const atual = campoDeVida(mestre, VIDA_ATUAL)
  const maxima = campoDeVida(mestre, VIDA_MAXIMA)
  const achou = await expect
    .poll(async () => (await atual.count()) > 0 && (await maxima.count()) > 0, { timeout: ESPERA })
    .toBe(true)
    .then(() => true)
    .catch(() => false)
  if (!achou) {
    expect(
      false,
      `${oQue}: com a ficha selecionada, o painel deveria ter os campos "Vida atual" e "Vida máxima". ` +
        `Achados: atual=${await atual.count()}, máxima=${await maxima.count()}. O que o painel oferece hoje: ${await controlesNaTela(mestre)}`,
    ).toBe(true)
  }
  // Máxima antes da atual: um app que limita a atual à máxima não corta o 173 de 419.
  await digitarNoCampo(mestre, maxima.first(), vida.maxima)
  await digitarNoCampo(mestre, atual.first(), vida.atual)
  await expect(maxima.first(), `${oQue}: a vida máxima deveria ficar ${vida.maxima}`).toHaveValue(String(vida.maxima))
  await expect(atual.first(), `${oQue}: a vida atual deveria ficar ${vida.atual}`).toHaveValue(String(vida.atual))
}

/**
 * Com a ficha selecionada, escolhe se os jogadores veem a barra dela. Aceita
 * um interruptor (checkbox/switch) que fale de barra/vida e de jogadores, em
 * qualquer polaridade, ou um grupo de opções/lista com nome de barra/vida.
 */
async function jogadoresVeemABarra(mestre: Page, veem: boolean, oQue: string): Promise<void> {
  const chaves = mestre.getByRole('checkbox').or(mestre.getByRole('switch'))
  const total = await chaves.count()
  for (let i = 0; i < total; i += 1) {
    const chave = chaves.nth(i)
    if (!(await chave.isVisible()) && !(await chave.locator('xpath=ancestor::label[1]').isVisible().catch(() => false))) continue
    const nome = await nomeAcessivel(chave)
    if (OCULTO_DA_FICHA_INTEIRA.test(nome) || !FALA_DE_BARRA.test(nome) || !FALA_DE_JOGADOR.test(nome)) continue
    const desejado = POLARIDADE_OCULTA.test(nome) ? !veem : veem
    if ((await chave.isChecked()) !== desejado) {
      // O checkbox nativo do `Toggle` fica visualmente escondido: o clique de pessoa é no rótulo.
      const rotulo = chave.locator('xpath=ancestor::label[1]')
      if ((await rotulo.count()) > 0 && !(await chave.isVisible())) await rotulo.click()
      else await chave.click()
    }
    await expect.poll(() => chave.isChecked(), { timeout: ESPERA, message: `${oQue}: "${nome}" deveria ficar ${desejado ? 'ligado' : 'desligado'}` }).toBe(desejado)
    return
  }

  const grupo = mestre.getByRole('radiogroup', { name: FALA_DE_BARRA })
  if ((await grupo.count()) > 0) {
    const opcoes = grupo.first().getByRole('radio')
    const n = await opcoes.count()
    for (let i = 0; i < n; i += 1) {
      const nome = await nomeAcessivel(opcoes.nth(i))
      const serve = veem ? OPCAO_JOGADORES_VEEM.test(nome) && !OPCAO_SO_O_MESTRE.test(nome) : OPCAO_SO_O_MESTRE.test(nome)
      if (!serve) continue
      await opcoes.nth(i).click()
      await expect(opcoes.nth(i), `${oQue}: a opção "${nome}" deveria ficar marcada`).toBeChecked({ timeout: ESPERA })
      return
    }
  }

  const lista = mestre.getByRole('combobox', { name: FALA_DE_BARRA })
  if ((await lista.count()) > 0) {
    const textos = await lista.first().locator('option').allTextContents()
    const escolhida = textos.find((t) => (veem ? OPCAO_JOGADORES_VEEM.test(t) && !OPCAO_SO_O_MESTRE.test(t) : OPCAO_SO_O_MESTRE.test(t)))
    if (escolhida !== undefined) {
      await lista.first().selectOption({ label: escolhida.trim() })
      return
    }
  }

  expect(
    false,
    `${oQue}: com a ficha selecionada, o painel deveria deixar o mestre escolher se os jogadores veem a barra dela ` +
      `(interruptor que fale de barra/vida e de jogadores, ou opções "Jogadores" / "Só o mestre"). O que o painel oferece hoje: ${await controlesNaTela(mestre)}`,
  ).toBe(true)
}

async function nomeAcessivel(el: Locator): Promise<string> {
  return el.evaluate((e) => {
    const aria = e.getAttribute('aria-label')
    if (aria) return aria
    const rotuladoPor = e.getAttribute('aria-labelledby')
    if (rotuladoPor) return rotuladoPor.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    const id = e.getAttribute('id')
    const porFor = id ? document.querySelector(`label[for="${id}"]`)?.textContent : null
    return (porFor ?? e.closest('label')?.textContent ?? e.textContent ?? '').replace(/\s+/g, ' ').trim()
  })
}

/** Seleciona a ficha, informa a vida (e, se pedido, quem vê a barra) e larga a seleção. */
async function darVida(mestre: Page, ficha: Ficha, nome: string, vida: { atual: number; maxima: number }, veem?: boolean): Promise<void> {
  await mestreSelecionaFicha(mestre, ficha, nome)
  await informarVida(mestre, vida, `vida de ${nome}`)
  if (veem !== undefined) await jogadoresVeemABarra(mestre, veem, `barra de ${nome}`)
  await mestreLargaSelecao(mestre)
}

// ───────────────────────────────────────────────────────────────────────────
// A mesa montada
// ───────────────────────────────────────────────────────────────────────────

interface Mesa {
  rede: Rede
  ana: Jogador
  noMestre: Referencia
  naAna: Referencia
}

async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreACena(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', JOGADORA)
  await mestreAtribui(mestre, JOGADORA, HEROI)
  await expect(ana.page.locator('canvas').first(), `${JOGADORA}: o mapa não apareceu na tela`).toBeVisible({ timeout: 10_000 })
  const naAna = await referencia(ana.page, JOGADORA, ESPERA_TELA)
  // O mestre fica na aba Mapa, sem nada selecionado: é a tela que a foto de referência guarda.
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await mestre.getByRole('button', { name: 'Selecionar', exact: true }).click()
  await mestre.mouse.move(DESCANSO.x, DESCANSO.y, { steps: 5 })
  await mestre.keyboard.press('Escape')
  const noMestre = await referencia(mestre, 'mestre', ESPERA_TELA_MESTRE)
  return { rede, ana, noMestre, naAna }
}

/** Algum frame entregue à jogadora carrega os números da vida oculta do monstro? */
function vazamentoDaVidaOculta(frames: string[]): string | null {
  const proibidos = new Set([VIDA_OCULTA.atual, VIDA_OCULTA.maxima])
  const temNumeroProibido = (v: unknown): boolean => {
    if (typeof v === 'number') return proibidos.has(v)
    if (typeof v === 'string') return proibidos.has(Number(v))
    if (Array.isArray(v)) return v.some(temNumeroProibido)
    if (v !== null && typeof v === 'object') return Object.values(v as Record<string, unknown>).some(temNumeroProibido)
    return false
  }
  const falaDoMonstro = (o: Record<string, unknown>): boolean => Object.values(o).some((v) => v === ID_MONSTRO)
  const procurar = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.some(procurar)
    if (v === null || typeof v !== 'object') return false
    const o = v as Record<string, unknown>
    if (falaDoMonstro(o) && temNumeroProibido(o)) return true
    return Object.values(o).some(procurar)
  }
  for (const frame of frames) {
    let msg: unknown
    try {
      msg = JSON.parse(frame)
    } catch {
      continue
    }
    if (procurar(msg)) return frame.length > 300 ? `${frame.slice(0, 300)}…` : frame
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// Os testes
// ───────────────────────────────────────────────────────────────────────────

test('1. CONTROLE POSITIVO: as duas telas mostram as duas fichas, as faixas não mudam sozinhas e selecionar/largar a ficha não deixa rastro', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(TEMPO_DE_TESTE)
  const erros: string[] = []
  mestre.on('pageerror', (e) => erros.push(e.message))
  const mesa = await mesaMontada(browser, mestre, baseURL ?? '')

  // As fichas têm tamanho de ficha (raio de ~23 px de mundo) nas duas telas.
  for (const ref of [mesa.naAna, mesa.noMestre]) {
    for (const f of [ref.heroi, ref.monstro]) {
      expect(f.r, `${ref.quem}: ficha com raio estranho na tela ${emTexto(f)}`).toBeGreaterThan(8)
      expect(f.r, `${ref.quem}: ficha com raio estranho na tela ${emTexto(f)}`).toBeLessThan(80)
    }
    expect(ref.monstro.x - ref.heroi.x, `${ref.quem}: ${MONSTRO} deveria estar à direita de ${HEROI}, na mesma linha`).toBeGreaterThan(3 * ref.heroi.r)
    expect(Math.abs(ref.monstro.y - ref.heroi.y), `${ref.quem}: as duas fichas deveriam estar na mesma linha`).toBeLessThan(ref.heroi.r)
  }

  // Sem ninguém mexer, as faixas sob e sobre as fichas ficam iguais nas duas telas.
  for (const ref of [mesa.naAna, mesa.noMestre]) {
    await ref.page.waitForTimeout(1000)
    const f = await faixasAgora(ref)
    expect(cameraParada(f.d), `${ref.quem}: a câmera andou sozinha`).toBeNull()
    expect(Math.max(f.sobHeroi, f.sobreHeroi, f.sobMonstro, f.sobreMonstro), `faixas mudaram sozinhas — ${f.leitura}`).toBeLessThanOrEqual(RESIDUO)
  }

  // Clicar em Og abre o painel da ficha; Escape fecha, e a tela volta à da referência.
  await mestreSelecionaFicha(mestre, mesa.noMestre.monstro, MONSTRO)
  await mestreLargaSelecao(mestre)
  const depois = await faixasAgora(mesa.noMestre)
  expect(cameraParada(depois.d), 'mestre: a câmera andou ao selecionar e largar a ficha').toBeNull()
  expect(Math.max(depois.sobHeroi, depois.sobMonstro), `selecionar e largar ${MONSTRO} deixou rastro na tela — ${depois.leitura}`).toBeLessThanOrEqual(RESIDUO)

  expect(erros, 'o app do mestre jogou erro').toEqual([])
})

test('2. o mestre informa vida atual e máxima de Og e uma barra fina e discreta aparece sob a ficha dele, e só dele', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(TEMPO_DE_TESTE)
  const mesa = await mesaMontada(browser, mestre, baseURL ?? '')
  const ref = mesa.noMestre

  await darVida(mestre, ref.monstro, MONSTRO, VIDA_DO_MONSTRO)

  const barra = await esperaBarraSob(ref, 'monstro', `depois de ${MONSTRO} receber ${VIDA_DO_MONSTRO.atual}/${VIDA_DO_MONSTRO.maxima}, uma barra deveria aparecer SOB a ficha dele no mapa do mestre`, ESPERA_TELA)

  // Discreta: pinta menos que a ficha inteira e não cobre o disco.
  const areaDaFicha = Math.PI * ref.monstro.r * ref.monstro.r
  expect(barra.sob, `a barra pinta mais que a própria ficha (${barra.sob} pixels contra ${Math.round(areaDaFicha)}): não é discreta — ${barra.leitura}`).toBeLessThan(areaDaFicha)
  expect(barra.d.depois.monstro?.n ?? 0, `a barra cobriu o disco de ${MONSTRO} — ${barra.leitura}`).toBeGreaterThanOrEqual(DISCO_QUE_FICA * (barra.d.antes.monstro?.n ?? 0))

  // De CADA ficha: sob Lu nada mudou.
  const f = await faixasAgora(ref)
  expect(f.sobHeroi, `dar vida a ${MONSTRO} desenhou algo sob ${HEROI} também — ${f.leitura}`).toBeLessThanOrEqual(RESIDUO)
})

test('3. mudar a vida atual de Og de cheia para pouca muda a barra, que continua lá', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(TEMPO_DE_TESTE)
  const mesa = await mesaMontada(browser, mestre, baseURL ?? '')
  const ref = mesa.noMestre

  await darVida(mestre, ref.monstro, MONSTRO, VIDA_CHEIA)
  await esperaBarraSob(ref, 'monstro', `com ${VIDA_CHEIA.atual}/${VIDA_CHEIA.maxima}, a barra deveria aparecer sob ${MONSTRO}`, ESPERA_TELA)
  await mestre.waitForTimeout(PINTURA_MS)
  const cheia = await fotografar(mestre)

  await darVida(mestre, ref.monstro, MONSTRO, VIDA_POUCA)

  // A barra continua lá (comparada à tela sem vida nenhuma)...
  await esperaBarraSob(ref, 'monstro', `com ${VIDA_POUCA.atual}/${VIDA_POUCA.maxima}, a barra deveria continuar sob ${MONSTRO}`, ESPERA_TELA)
  // ...e não é a mesma de antes.
  const minimo = mudancaMinima(ref.monstro)
  await expect
    .poll(
      async () => {
        await mestre.waitForTimeout(PINTURA_MS)
        const d = await compararFotos(mestre, cheia, await fotografar(mestre), [faixaSob(ref.monstro)])
        const camera = cameraParada(d)
        if (camera !== null) return `a câmera mexeu (${camera})`
        return d.mudados[0] >= minimo ? 'a barra mudou' : `a barra de ${VIDA_POUCA.atual}/${VIDA_POUCA.maxima} está igual à de ${VIDA_CHEIA.atual}/${VIDA_CHEIA.maxima}: ${d.mudados[0]} pixels mudados (mínimo ${Math.round(minimo)})`
      },
      { timeout: ESPERA_TELA, message: `baixar a vida de ${MONSTRO} de ${VIDA_CHEIA.atual} para ${VIDA_POUCA.atual} deveria mudar a barra na tela` },
    )
    .toBe('a barra mudou')
})

test('4. o mestre deixa os jogadores verem a barra de Lu e Ana vê a barra sob a própria ficha', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(TEMPO_DE_TESTE)
  const mesa = await mesaMontada(browser, mestre, baseURL ?? '')

  await darVida(mestre, mesa.noMestre.heroi, HEROI, VIDA_DO_HEROI, true)

  await esperaBarraSob(mesa.noMestre, 'heroi', `o mestre deveria ver a barra sob ${HEROI}`, ESPERA_TELA)
  await esperaBarraSob(mesa.naAna, 'heroi', `${JOGADORA} deveria ver a barra sob ${HEROI}, que o mestre deixou visível aos jogadores`, ESPERA_TELA)
})

test('5. a barra de Og fica só para o mestre: Ana vê a barra de Lu mas nada sob Og, e os números de Og não chegam a ela', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(TEMPO_DE_TESTE + 60_000)
  const mesa = await mesaMontada(browser, mestre, baseURL ?? '')

  // Og primeiro, oculto; depois Lu, visível. Quando a barra de Lu chegar à Ana, a mudança de Og já passou pelo fio.
  await darVida(mestre, mesa.noMestre.monstro, MONSTRO, VIDA_OCULTA, false)
  await darVida(mestre, mesa.noMestre.heroi, HEROI, VIDA_DO_HEROI, true)

  // O mestre vê as duas barras.
  await esperaBarraSob(mesa.noMestre, 'monstro', `o mestre sempre vê a barra de ${MONSTRO}, mesmo oculta aos jogadores`, ESPERA_TELA)
  await esperaBarraSob(mesa.noMestre, 'heroi', `o mestre deveria ver a barra de ${HEROI}`, ESPERA_TELA)

  // Ana vê a de Lu (prova que as mudanças chegaram)...
  const barraDeLu = await esperaBarraSob(mesa.naAna, 'heroi', `${JOGADORA} deveria ver a barra de ${HEROI}`, ESPERA_TELA)
  expect(barraDeLu.sob, `${JOGADORA} deveria ver a barra de ${HEROI} — ${barraDeLu.leitura}`).toBeGreaterThanOrEqual(barraMinima(mesa.naAna.heroi))
  // ...e nada sob Og.
  const f = await faixasAgora(mesa.naAna)
  expect(cameraParada(f.d), `${JOGADORA}: a câmera mexeu`).toBeNull()
  expect(f.sobMonstro, `${JOGADORA} vê algo sob ${MONSTRO}, cuja barra o mestre deixou só para ele — ${f.leitura}`).toBeLessThanOrEqual(RESIDUO)

  // E os números da vida oculta nunca viajaram até ela.
  expect(vazamentoDaVidaOculta(mesa.ana.frames), `a vida oculta de ${MONSTRO} (${VIDA_OCULTA.atual}/${VIDA_OCULTA.maxima}) foi entregue a ${JOGADORA}`).toBeNull()
})
