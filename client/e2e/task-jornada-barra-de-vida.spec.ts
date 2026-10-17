// JORNADA DE USUÁRIO da BARRA DE VIDA NA FICHA — reescrita na fatia 10 do
// design consolidado (docs/design/consolidado/PLANO.md, decisão D): a vida
// deixou de ser digitada no token e passou a vir da FICHA DO SISTEMA ligada a
// ele (o HP do One Piece). É a régua da feature, não a feature.
//
// A DOR: "Ninguém sabe quanto falta para o monstro cair sem o mestre narrar."
//
// A FEATURE (fatia 10):
//   - o mestre liga o token a um personagem (cartão "Personagem" da ficha do
//     token); a barra FINA aparece SOB o token, no mapa, com o HP da ficha. Sem
//     ficha ligada, sem barra;
//   - a barra é discreta (pinta menos que o token e não o cobre), é de CADA
//     token e muda quando o HP da ficha muda — pelo mestre (Abrir ficha, "-150"
//     no HP) ou pela sala (a jogadora digita o dano na ficha dela), na hora;
//   - quem vê (decisão 4.3): o mestre sempre; o jogador vê a barra das fichas de
//     JOGADOR e das que controla, a de NPC não, e só a proporção — os números
//     do monstro não viajam até ele (a regra da névoa: o jogador nunca recebe o
//     que o mestre esconde);
//   - a vida antiga gravada no token (`Token.health`) fica no arquivo sem uso
//     (decisão 4.4; `lib/fogFilter.vidaDaFicha.test.ts` cobre que não viaja).
//
// ONDE MORA: `lib/vidaDaFicha.ts` (token → personagem → recurso de vida com
// atual e máximo); `pixi/tokensRenderer.ts` desenha com as vidas que o
// `PixiCanvas` monta da aventura; `net/hostSession.ts` entrega ao recorte
// (`lib/fogFilter.ts`) só a proporção.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (mesmo preparo de
// task-jornada-painel-do-grupo.spec.ts e task-jornada-viagem-do-jogador.spec.ts):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   a jogadora Ana é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado: o que ela manda pelo WebSocket roteado
//   vira `net:message` na página do mestre, e o `net_send` do mestre volta ao
//   socket dela por `exposeFunction`. A sessão do host é a do app
//   (`net/hostBridge.ts`), sem estado injetado.
//   DISCO DE MENTIRA COM A CENA PRONTA: uma cena com dois tokens (Lu, da Ana,
//   verde-limão; Og, o monstro, laranja) e uma aventura com o sistema One Piece
//   e dois personagens — Lu (jogador, HP 10/10) e Og (NPC, HP 173/419) — vem
//   de um `adventure.json` no disco falso do Tauri e é aberta pelo menu
//   ("Carregar Mapa existente"). Os tokens nascem SEM ficha ligada: a foto de
//   referência é a tela sem barra nenhuma.
//   GESTO REAL NA AÇÃO SOB TESTE. Clique do ponteiro no token (ferramenta
//   Selecionar), escolha do personagem na lista "Personagem", "Abrir ficha",
//   clique no HP, Ctrl+A, ajuste tecla a tecla e Enter; Escape larga a seleção.
//   Os únicos `evaluate` são o repasse do transporte e a LEITURA de pixel
//   (decodifica a foto num canvas solto e pergunta `elementFromPoint`).
//   PROVA NA TELA, POR DIFERENÇA DE FOTO. A régua não dita a cor nem o
//   desenho da barra: ela acha cada token pela cor dele na foto (centro e
//   raio), fotografa a tela ANTES e DEPOIS, e conta os pixels que mudaram numa
//   faixa logo ABAIXO do token (de 0,45 a 2,6 raios do centro, 1,8 raio para
//   cada lado) e numa faixa igual logo ACIMA. "Apareceu uma barra sob o token"
//   = a faixa de baixo mudou bastante e mais que o dobro da de cima. O
//   controle positivo prova que, sem ninguém mexer, as faixas não mudam sozinhas
//   e que selecionar e largar (Escape) o token devolve a tela igual — sem isso,
//   "mudou" poderia ser ruído ou realce de seleção. Se a câmera se mexer entre
//   as duas fotos (centro do token andou mais de 2 px), a régua falha dizendo
//   isso, em vez de ler câmera como barra.
//   FRAMES. Com o socket roteado, o que a página da Ana recebe é o que a rota
//   entrega; a régua só anota (`Rede.enviados`) para cobrar que os números da
//   vida do monstro (173 de 419, escolhidos para não colidir com coordenada
//   nenhuma da cena) não viajem.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - a ficha do token tem o cartão "Personagem" com a lista "Personagem" e o
//     botão "Abrir ficha" (fatia 9); a ficha do sistema abre num diálogo com o
//     nome do personagem e fecha no botão "Fechar";
//   - na ficha (do mestre e da jogadora), o HP é um botão "HP <atual> de
//     <máximo>. Ajustar" que abre o ajuste rápido com o campo "HP"; "-150" e
//     Enter tira 150 (lib/ajusteDaFicha.ts);
//   - a jogadora abre a ficha dela no botão "Ficha de personagem" e fecha em
//     "Fechar a ficha";
//   - Escape larga a seleção do token (`pixi/PixiCanvas.tsx`), e o painel dele some.
//
// CONTROLE POSITIVO: teste 1. A mesa monta, Ana recebe o token, as duas telas
// mostram os dois tokens, as faixas não mudam sozinhas, e selecionar Og pelo
// clique abre o painel que o Escape fecha, sem deixar rastro na foto.
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

/**
 * O HP das fichas do sistema (One Piece) na aventura. Os do monstro não
 * colidem com coordenada nenhuma da cena: a varredura dos frames procura por eles.
 */
const VIDA_DO_HEROI = { atual: 10, maxima: 10 }
const VIDA_OCULTA = { atual: 173, maxima: 419 }
/** O mestre tira 150 de Og na ficha: 173 vira 23 (de 41% para 5% da barra, e a cor muda). */
const DANO_DO_MESTRE = '-150'
const VIDA_FERIDA = { atual: 23, maxima: 419 }
/** A Ana tira 7 de Lu na ficha dela: 10 vira 3. */
const DANO_DA_SALA = '-7'
const VIDA_DA_SALA = { atual: 3, maxima: 10 }

/** Os personagens da aventura têm o nome dos tokens; o id é o que a lista "Personagem" grava. */
const ID_PERSONAGEM: Readonly<Record<string, string>> = { [HEROI]: 'p-lu', [MONSTRO]: 'p-og' }

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
    // A ficha do sistema: One Piece (embutido no app), HP de atual e máximo.
    sistemaDeRpg: 'one-piece',
    personagens: [
      { id: ID_PERSONAGEM[HEROI], tipo: 'jogador', nome: HEROI, recursos: { hp: VIDA_DO_HEROI.atual }, maximos: { hp: VIDA_DO_HEROI.maxima } },
      { id: ID_PERSONAGEM[MONSTRO], tipo: 'npc', nome: MONSTRO, recursos: { hp: VIDA_OCULTA.atual }, maximos: { hp: VIDA_OCULTA.maxima } },
    ],
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

  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

function painelJogo(mestre: Page): Locator {
  return mestre.locator('#lb-rail-panel-room')
}

/** Aba Jogo, card da jogadora, "Atribuir <ficha>" — o clique que o painel oferece hoje. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDaFicha: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
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
// Os gestos: o mestre na ficha do token e na ficha do sistema; a Ana na dela
// ───────────────────────────────────────────────────────────────────────────

const apagarFicha = (mestre: Page): Locator => mestre.getByRole('button', { name: 'Apagar token selecionado' })

/** Ferramenta Selecionar, clique no centro do token: o painel dele abre. */
async function mestreSelecionaFicha(mestre: Page, ficha: Ficha, nome: string): Promise<void> {
  await mestre.getByRole('button', { name: 'Selecionar', exact: true }).click()
  await mestre.mouse.click(Math.round(ficha.x), Math.round(ficha.y))
  await mestre.mouse.move(DESCANSO.x, DESCANSO.y, { steps: 5 })
  await expect(apagarFicha(mestre), `clicar em ${nome} (${Math.round(ficha.x)}, ${Math.round(ficha.y)}) deveria abrir o painel do token`).toBeVisible({ timeout: ESPERA })
}

/** Escape larga a seleção; o painel do token some e o realce sai da foto. */
async function mestreLargaSelecao(mestre: Page): Promise<void> {
  await mestre.mouse.move(DESCANSO.x, DESCANSO.y, { steps: 5 })
  await mestre.keyboard.press('Escape')
  if (await apagarFicha(mestre).isVisible()) await mestre.keyboard.press('Escape')
  await expect(apagarFicha(mestre), 'Escape deveria largar o token selecionado').toBeHidden({ timeout: ESPERA })
}

/** Todo nome acessível de controle na tela — só para a falha dizer o que EXISTE hoje. */
async function controlesNaTela(mestre: Page): Promise<string> {
  const nomes = await mestre
    .locator('.gr-livro, [role="tabpanel"]')
    .locator('button, input, select, [role="checkbox"], [role="switch"], [role="radio"], [role="spinbutton"], [role="combobox"]')
    .evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null || el.getClientRects().length > 0) // o seletor só pega controles HTML (button, input, select…)
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

/** Com o token selecionado: o cartão "Personagem" da ficha do token, aberto, e a lista dele. */
async function cartaoPersonagem(mestre: Page, oQue: string): Promise<Locator> {
  const lista = mestre.getByRole('combobox', { name: 'Personagem', exact: true })
  if (!(await lista.isVisible())) await mestre.getByRole('button', { name: /^Personagem/ }).first().click()
  const achou = await lista.waitFor({ state: 'visible', timeout: ESPERA }).then(
    () => true,
    () => false,
  )
  if (!achou) expect(false, `${oQue}: a ficha do token deveria ter o cartão "Personagem" com a lista. O que o painel oferece hoje: ${await controlesNaTela(mestre)}`).toBe(true)
  return lista
}

/** Seleciona o token, liga a ficha do sistema de mesmo nome pela lista "Personagem" e larga a seleção. */
async function mestreLigaFicha(mestre: Page, ficha: Ficha, nome: string): Promise<void> {
  await mestreSelecionaFicha(mestre, ficha, nome)
  const lista = await cartaoPersonagem(mestre, `ligar ${nome}`)
  await lista.selectOption({ label: nome })
  await expect(lista, `${nome} deveria ficar ligado ao personagem "${nome}"`).toHaveValue(ID_PERSONAGEM[nome] ?? '')
  await mestreLargaSelecao(mestre)
}

/** Numa ficha aberta (do mestre ou da jogadora): o botão do HP, o campo "HP", o ajuste tecla a tecla e Enter. */
async function ajustarHP(page: Page, ficha: Locator, ajuste: string, depois: string, oQue: string): Promise<void> {
  const botao = ficha.getByRole('button', { name: /^HP \d+ de \d+\. Ajustar$/ })
  await expect(botao, `${oQue}: a ficha deveria mostrar o HP com "Ajustar"`).toBeVisible({ timeout: ESPERA })
  await botao.click()
  const campo = ficha.getByRole('textbox', { name: 'HP', exact: true })
  await campo.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type(ajuste, { delay: 25 })
  await page.keyboard.press('Enter')
  await expect(ficha.getByRole('button', { name: `HP ${depois}. Ajustar` }), `${oQue}: depois de "${ajuste}" o HP deveria ficar ${depois}`).toBeVisible({ timeout: ESPERA })
}

/** O mestre abre a ficha do sistema pelo token ("Abrir ficha"), tira vida no HP, fecha e larga a seleção. */
async function mestreAjustaVida(mestre: Page, ficha: Ficha, nome: string, ajuste: string, depois: string): Promise<void> {
  await mestreSelecionaFicha(mestre, ficha, nome)
  await cartaoPersonagem(mestre, `abrir a ficha de ${nome}`)
  await mestre.getByRole('button', { name: 'Abrir ficha', exact: true }).click()
  const janela = mestre.getByRole('dialog', { name: nome })
  await expect(janela, `"Abrir ficha" deveria abrir a ficha de ${nome}`).toBeVisible({ timeout: ESPERA })
  await ajustarHP(mestre, janela, ajuste, depois, `HP de ${nome} na ficha do mestre`)
  await janela.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(janela, 'a ficha deveria fechar').toBeHidden({ timeout: ESPERA })
  await mestreLargaSelecao(mestre)
}

/** A jogadora abre a própria ficha ("Ficha de personagem"), tira vida no HP e fecha. */
async function jogadoraAjustaVida(ana: Page, ajuste: string, depois: string): Promise<void> {
  await ana.getByRole('button', { name: 'Ficha de personagem', exact: true }).click()
  const ficha = ana.locator('.pp-ficha')
  await ajustarHP(ana, ficha, ajuste, depois, `HP de ${HEROI} na ficha da ${JOGADORA}`)
  await ficha.getByRole('button', { name: 'Fechar a ficha', exact: true }).click()
  await expect(ficha, `${JOGADORA}: a ficha deveria fechar`).toBeHidden({ timeout: ESPERA })
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

test('2. o mestre liga Og à ficha dele e uma barra fina e discreta aparece sob o token, e só sob ele', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(TEMPO_DE_TESTE)
  const mesa = await mesaMontada(browser, mestre, baseURL ?? '')
  const ref = mesa.noMestre

  await mestreLigaFicha(mestre, ref.monstro, MONSTRO)

  const barra = await esperaBarraSob(ref, 'monstro', `depois de ligar ${MONSTRO} à ficha dele (HP ${VIDA_OCULTA.atual}/${VIDA_OCULTA.maxima}), uma barra deveria aparecer SOB o token no mapa do mestre`, ESPERA_TELA)

  // Discreta: pinta menos que o token inteiro e não cobre o disco.
  const areaDaFicha = Math.PI * ref.monstro.r * ref.monstro.r
  expect(barra.sob, `a barra pinta mais que o próprio token (${barra.sob} pixels contra ${Math.round(areaDaFicha)}): não é discreta — ${barra.leitura}`).toBeLessThan(areaDaFicha)
  expect(barra.d.depois.monstro?.n ?? 0, `a barra cobriu o disco de ${MONSTRO} — ${barra.leitura}`).toBeGreaterThanOrEqual(DISCO_QUE_FICA * (barra.d.antes.monstro?.n ?? 0))

  // De CADA token: sob Lu, que segue sem ficha, nada mudou.
  const f = await faixasAgora(ref)
  expect(f.sobHeroi, `ligar ${MONSTRO} desenhou algo sob ${HEROI} também — ${f.leitura}`).toBeLessThanOrEqual(RESIDUO)
})

test('3. o mestre tira vida de Og na ficha do sistema e a barra muda na hora, e continua lá', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(TEMPO_DE_TESTE)
  const mesa = await mesaMontada(browser, mestre, baseURL ?? '')
  const ref = mesa.noMestre

  await mestreLigaFicha(mestre, ref.monstro, MONSTRO)
  await esperaBarraSob(ref, 'monstro', `com a ficha ligada (${VIDA_OCULTA.atual}/${VIDA_OCULTA.maxima}), a barra deveria aparecer sob ${MONSTRO}`, ESPERA_TELA)
  await mestre.waitForTimeout(PINTURA_MS)
  const antes = await fotografar(mestre)

  await mestreAjustaVida(mestre, ref.monstro, MONSTRO, DANO_DO_MESTRE, `${VIDA_FERIDA.atual} de ${VIDA_FERIDA.maxima}`)

  // A barra continua lá (comparada à tela sem barra nenhuma)...
  await esperaBarraSob(ref, 'monstro', `com ${VIDA_FERIDA.atual}/${VIDA_FERIDA.maxima}, a barra deveria continuar sob ${MONSTRO}`, ESPERA_TELA)
  // ...e não é a mesma de antes.
  const minimo = mudancaMinima(ref.monstro)
  await expect
    .poll(
      async () => {
        await mestre.waitForTimeout(PINTURA_MS)
        const d = await compararFotos(mestre, antes, await fotografar(mestre), [faixaSob(ref.monstro)])
        const camera = cameraParada(d)
        if (camera !== null) return `a câmera mexeu (${camera})`
        return d.mudados[0] >= minimo ? 'a barra mudou' : `a barra de ${VIDA_FERIDA.atual}/${VIDA_FERIDA.maxima} está igual à de ${VIDA_OCULTA.atual}/${VIDA_OCULTA.maxima}: ${d.mudados[0]} pixels mudados (mínimo ${Math.round(minimo)})`
      },
      { timeout: ESPERA_TELA, message: `tirar ${DANO_DO_MESTRE} do HP de ${MONSTRO} na ficha deveria mudar a barra no mapa` },
    )
    .toBe('a barra mudou')
})

test('4. Lu ligado à ficha de jogador: Ana vê a barra sob o próprio token, e o dano que ela digita na ficha dela muda a barra no mapa do mestre na hora', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(TEMPO_DE_TESTE)
  const mesa = await mesaMontada(browser, mestre, baseURL ?? '')

  await mestreLigaFicha(mestre, mesa.noMestre.heroi, HEROI)

  await esperaBarraSob(mesa.noMestre, 'heroi', `o mestre deveria ver a barra sob ${HEROI}`, ESPERA_TELA)
  await esperaBarraSob(mesa.naAna, 'heroi', `${JOGADORA} deveria ver a barra sob ${HEROI}, a ficha de jogador dela`, ESPERA_TELA)

  await mestre.waitForTimeout(PINTURA_MS)
  const cheia = await fotografar(mestre)
  await jogadoraAjustaVida(mesa.ana.page, DANO_DA_SALA, `${VIDA_DA_SALA.atual} de ${VIDA_DA_SALA.maxima}`)

  const minimo = mudancaMinima(mesa.noMestre.heroi)
  await expect
    .poll(
      async () => {
        await mestre.waitForTimeout(PINTURA_MS)
        const d = await compararFotos(mestre, cheia, await fotografar(mestre), [faixaSob(mesa.noMestre.heroi)])
        const camera = cameraParada(d)
        if (camera !== null) return `a câmera mexeu (${camera})`
        return d.mudados[0] >= minimo ? 'a barra mudou' : `a barra de ${HEROI} no mestre não mudou: ${d.mudados[0]} pixels mudados (mínimo ${Math.round(minimo)})`
      },
      { timeout: ESPERA_TELA, message: `o "${DANO_DA_SALA}" que ${JOGADORA} digitou na ficha dela deveria mudar a barra de ${HEROI} no mapa do mestre` },
    )
    .toBe('a barra mudou')
})

test('5. a barra de Og (NPC) fica só para o mestre: Ana vê a barra de Lu mas nada sob Og, e os números de Og não chegam a ela', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(TEMPO_DE_TESTE + 60_000)
  const mesa = await mesaMontada(browser, mestre, baseURL ?? '')

  // Og primeiro; depois Lu. Quando a barra de Lu chegar à Ana, a ligação de Og já passou pelo fio.
  await mestreLigaFicha(mestre, mesa.noMestre.monstro, MONSTRO)
  await mestreLigaFicha(mestre, mesa.noMestre.heroi, HEROI)

  // O mestre vê as duas barras.
  await esperaBarraSob(mesa.noMestre, 'monstro', `o mestre sempre vê a barra de ${MONSTRO}, mesmo sendo NPC`, ESPERA_TELA)
  await esperaBarraSob(mesa.noMestre, 'heroi', `o mestre deveria ver a barra de ${HEROI}`, ESPERA_TELA)

  // Ana vê a de Lu (prova que as mudanças chegaram)...
  const barraDeLu = await esperaBarraSob(mesa.naAna, 'heroi', `${JOGADORA} deveria ver a barra de ${HEROI}`, ESPERA_TELA)
  expect(barraDeLu.sob, `${JOGADORA} deveria ver a barra de ${HEROI} — ${barraDeLu.leitura}`).toBeGreaterThanOrEqual(barraMinima(mesa.naAna.heroi))
  // ...e nada sob Og.
  const f = await faixasAgora(mesa.naAna)
  expect(cameraParada(f.d), `${JOGADORA}: a câmera mexeu`).toBeNull()
  expect(f.sobMonstro, `${JOGADORA} vê algo sob ${MONSTRO}, um NPC que ela não controla — ${f.leitura}`).toBeLessThanOrEqual(RESIDUO)

  // E os números da vida do monstro nunca viajaram até ela.
  expect(vazamentoDaVidaOculta(mesa.ana.frames), `a vida de ${MONSTRO} (${VIDA_OCULTA.atual}/${VIDA_OCULTA.maxima}) foi entregue a ${JOGADORA}`).toBeNull()
})
