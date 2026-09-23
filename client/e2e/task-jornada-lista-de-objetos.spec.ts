// JORNADA DE USUÁRIO da LISTA DE OBJETOS DO MAPA (item 17 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A DOR: com 30 salas, achar a "Cripta" é rolar o mapa no olho. O mestre
// aproxima numa ponta do mapa, a coisa que ele procura está na outra, e não
// há como chegar nela a não ser arrastando a tela às cegas.
//
// A FEATURE:
//   - um painel lista, PELO NOME, os objetos da cena aberta: salas, portas,
//     marcadores (pinos), fichas e textos — só os da cena aberta;
//   - o painel tem um campo de busca que filtra a lista enquanto se digita;
//   - clicar num item SELECIONA o objeto (o painel de propriedades passa a
//     mostrar o Nome dele) e LEVA A CÂMERA até ele ("Ir até lá"): o objeto,
//     que estava fora da tela, aparece no meio do canvas;
//   - a lista é do mestre: a tela do jogador não ganha lista nem busca, e o
//     "Ir até lá" do mestre não mexe na câmera do jogador (decisão de produto:
//     o jogador nunca recebe o que não é dele — HANDOFF.md / PEDIDOS.md).
//
// ONDE ISSO MORRE HOJE: `components/LayersPanel.tsx:16` só mostra a CONTAGEM
// por camada ("Salas 2", "Tokens 1") — nenhum nome, nenhum item clicável;
// `components/PropertiesPanel.tsx:453-460` tem só "Chão do mapa" e "Camadas";
// não há campo de busca no editor (nenhum `searchbox` em `src/components`), e
// a câmera só se move por gesto (`pixi/PixiCanvas.tsx:807`, `fitCamera` ao
// abrir) ou pela chegada por pino (`lib/pinTravel.ts:409`).
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-visao-geral-das-cenas.spec.ts e, para o jogador, de
// task-jornada-viagem-do-jogador.spec.ts):
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: duas cenas num `adventure.json`,
//   abertas pelo menu "Carregar Mapa existente", como na mesa. A cena aberta
//   (Salão) tem uma sala à esquerda (chão verde-água), a Cripta à direita
//   (chão magenta) com uma porta, um pino, um texto e a ficha Lanterna
//   (laranja) no meio do caminho; a outra cena (Torre) tem uma ficha que NÃO
//   pode aparecer na lista.
//   GESTO REAL. Roda do mouse sobre a sala da esquerda para aproximar (é assim
//   que a Cripta sai da tela), toque de ponteiro com pausa antes de soltar,
//   clique no item da lista, digitação tecla a tecla na busca. O jogador entra
//   pelo `player.html` inteiro, com código e nome digitados. Os únicos
//   `evaluate` são o do TRANSPORTE falso (entregar ao mestre o que o jogador
//   mandou, igual à régua da viagem) e a LEITURA de pixel (decodificar a foto
//   num canvas solto e perguntar `elementFromPoint`); nenhum toca no app.
//   PROVA NA TELA. Nome acessível dos itens e do campo; valor visível do campo
//   "Nome" do painel de propriedades (seleção); COR lida em pixel nos pontos
//   onde o canvas do mapa está por cima: a câmera chegou à Cripta quando o
//   magenta aparece e o centro dele está no meio do canvas. Nada é lido da store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o painel abre por um botão cujo nome acessível começa com "Lista de
//     objetos" ou "Objetos do mapa" (em qualquer lugar da tela do mestre; na
//     aba Mapa, se ela existir). Se o botão for cabeçalho de seção recolhível
//     (`aria-controls`), o corpo dele é o painel; senão o painel é um
//     elemento `region`/`dialog`/`complementary`/`list`/`listbox`/`tree` com
//     nome acessível "Objetos do mapa";
//   - o campo de busca é um `searchbox`, ou um `textbox` cujo nome acessível
//     começa com "Buscar" ou "Procurar", dentro do painel;
//   - cada item é um controle clicável (`button`, `option`, `link` ou
//     `treeitem`) dentro do painel cujo nome acessível CONTÉM o nome do
//     objeto: nome da sala, nome da ficha, texto do texto, DESCRIÇÃO do pino
//     (pino não tem outro nome) e a palavra "Porta" para a porta;
//   - a busca ignora maiúsculas/minúsculas ("crip" acha "Cripta");
//   - "leva a câmera até ele": o centro do objeto fica na faixa central do
//     canvas (a 25% da largura e da altura do centro), sem exigir zoom certo.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ele prova que o disco falso abre a
// cena, que o classificador enxerga os três tons (verde-água, magenta,
// laranja), que a roda do mouse tira a Cripta e a Lanterna da tela e que tocar
// numa sala mostra o Nome dela no painel. Sem ele, o vermelho dos testes 2 a 6
// poderia ser a infraestrutura quebrada, e não a feature ausente.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { Drawing, MapData, Pin, Region, Token, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'LISTA1'
const JOGADOR = 'Ana'
const AVENTURA = 'Aventura da Cripta'
const SALAO = 'Salão'
const TORRE = 'Torre'
const ID_SALAO = 'scene_salao'
const ID_TORRE = 'scene_torre'
const PASTA = 'C:/appdata/maps/map_cripta_lista'

/** Os objetos da cena aberta, pelo nome que a lista deve mostrar. */
const SALA_ENTRADA = 'Salão de Entrada'
const CRIPTA = 'Cripta'
const PORTA = 'Porta'
const PINO_BAU = 'Baú do tesouro'
const FICHA_LANTERNA = 'Lanterna'
const FICHA_HEROI = 'Heroi'
const TEXTO_AVISO = 'Cuidado com o chão'
/** Objeto da OUTRA cena: não pode aparecer na lista do Salão. */
const FICHA_DA_TORRE = 'Guarda da Torre'

const BOTAO_DA_LISTA = /^(Lista de objetos|Objetos do mapa)/
const NOME_DO_PAINEL = 'Objetos do mapa'
const CAMPO_DE_BUSCA = /^(Buscar|Procurar)/

// Mundo: 40 x 16 células de 50 px — largo, para a Cripta ficar longe da entrada.
const GRADE = 50
const COLUNAS = 40
const LINHAS = 16
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }

type Ponto = { x: number; y: number }

/** Sala da esquerda (verde-água) e Cripta à direita (magenta), em px de mundo. */
const RET_ENTRADA = { x1: 100, y1: 150, x2: 600, y2: 650 }
const RET_CRIPTA = { x1: 1500, y1: 200, x2: 1850, y2: 600 }
/** Lanterna no meio-direita, embaixo: sai da tela quando se aproxima na entrada. */
const POS_LANTERNA: Ponto = { x: 1250, y: 700 }
/** Heroi, a ficha do jogador, dentro da sala da esquerda. */
const POS_HEROI: Ponto = { x: 250, y: 300 }
const POS_PINO: Ponto = { x: 1650, y: 250 }
const POS_TEXTO: Ponto = { x: 900, y: 100 }

const COR_ENTRADA = '#1e8c8c'
const COR_CRIPTA = '#8c1e8c'
const COR_LANTERNA = '#ff5a00'
const COR_HEROI = '#3cff00'
/** Chão cinza: não cai em nenhuma cor da régua. */
const COR_DO_CHAO = '#505050'

/** Botão parado antes de soltar: toque de dedo. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por elemento: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** Quantos "cliques" de roda, no máximo, para aproximar na sala da esquerda. */
const RODADAS_DE_RODA = 8
const RODA_DELTA = -240

/** Pixels para dizer "esta sala está na tela". */
const PIXELS_DE_SALA = 2000
/** Pixels para dizer "esta ficha está na tela". */
const PIXELS_DE_FICHA = 60
/** Pixels máximos para dizer "esta cor NÃO está na tela" (antisserrilhado). */
const RESIDUO = 25
/** "No meio do canvas": até esta fração da largura/altura longe do centro. */
const FAIXA_CENTRAL = 0.25
/** Tela do jogador "parada": a contagem de uma cor não muda mais que isto. */
const VARIACAO_TOLERADA = 0.15

type Cor = 'verdeAgua' | 'magenta' | 'laranja'
type Foto = Awaited<ReturnType<Page['screenshot']>>

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco
// ───────────────────────────────────────────────────────────────────────────

function ficha(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function sala(id: string, nome: string, r: { x1: number; y1: number; x2: number; y2: number }, cor: string): Region {
  return {
    id,
    points: [
      { x: r.x1, y: r.y1 },
      { x: r.x2, y: r.y1 },
      { x: r.x2, y: r.y2 },
      { x: r.x1, y: r.y2 },
    ],
    tag: '',
    fillColor: cor,
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
}

/** Porta fechada na parede esquerda da Cripta. */
function portaDaCripta(): Wall {
  const x = RET_CRIPTA.x1
  return { id: 'w-porta-cripta', x1: x, y1: 350, x2: x, y2: 450, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
}

function pinoDoBau(): Pin {
  return { id: 'pin-bau', x: POS_PINO.x, y: POS_PINO.y, kind: 'exclamacao', description: PINO_BAU, image: null }
}

function textoDeAviso(): Drawing {
  return { id: 'txt-aviso', kind: 'text', x: POS_TEXTO.x, y: POS_TEXTO.y, text: TEXTO_AVISO, color: '#ffffff', fontSize: 24 }
}

function cena(id: string, nome: string, extra: Partial<MapData>): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: COR_DO_CHAO },
    ...extra,
  }
}

function discoDaAventura(): Record<string, string> {
  const salao = cena('map_cripta_lista', AVENTURA, {
    regions: [sala('sala-entrada', SALA_ENTRADA, RET_ENTRADA, COR_ENTRADA), sala('sala-cripta', CRIPTA, RET_CRIPTA, COR_CRIPTA)],
    walls: [portaDaCripta()],
    pins: [pinoDoBau()],
    drawings: [textoDeAviso()],
    tokens: [ficha('tok-lanterna', FICHA_LANTERNA, POS_LANTERNA, COR_LANTERNA), ficha('tok-heroi', FICHA_HEROI, POS_HEROI, COR_HEROI)],
  })
  const torre = cena('map_torre', TORRE, { tokens: [ficha('tok-guarda', FICHA_DA_TORRE, { x: 1000, y: 400 }, '#2040ff')] })
  const aventura = {
    version: 1,
    id: 'adv_cripta_lista',
    name: AVENTURA,
    startSceneId: ID_SALAO,
    scenes: [
      { id: ID_SALAO, name: SALAO, file: 'map.json' },
      { id: ID_TORRE, name: TORRE, file: `scenes/${ID_TORRE}/map.json` },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(salao),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_TORRE}/map.json`]: serializeMap(torre),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco de mentira e transporte de mentira
// (o transporte só é usado no teste do jogador; nos outros fica parado)
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
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  // A cena abre encaixada: as duas salas e a Lanterna estão na tela.
  await editorMostra(mestre, 'verdeAgua', PIXELS_DE_SALA, `o editor deveria abrir mostrando a sala "${SALA_ENTRADA}"`)
  await editorMostra(mestre, 'magenta', PIXELS_DE_SALA, `o editor deveria abrir mostrando a sala "${CRIPTA}"`)
  return rede
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura de pixel (só LÊ a foto; não toca no app)
// ───────────────────────────────────────────────────────────────────────────

interface Mancha {
  n: number
  /** Caixa e centro de massa em px CSS da página (já convertidos da foto). */
  x1: number
  y1: number
  x2: number
  y2: number
  cx: number
  cy: number
}
type Leitura = Record<Cor, Mancha>

/**
 * Lê uma foto PNG da página: para cada cor da régua, quantos pixels, a caixa
 * e o centro de massa, contando só onde o CANVAS do mapa está por cima (o rail
 * e os painéis não contam). Decodifica a foto num canvas solto da própria
 * página — leitura pura, nada do app é tocado.
 */
async function lerCores(page: Page, foto: Foto): Promise<Leitura> {
  return page.evaluate(
    async ({ b64 }) => {
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
      const vazia = () => ({ n: 0, x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity, sx: 0, sy: 0 })
      const r = { verdeAgua: vazia(), magenta: vazia(), laranja: vazia() }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          let alvoCor: keyof typeof r | null = null
          if (R > 200 && G > 50 && G < 140 && B < 60) alvoCor = 'laranja'
          else if (G >= 110 && G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30) alvoCor = 'verdeAgua'
          else if (R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30) alvoCor = 'magenta'
          if (alvoCor === null || !canvasPorCima(x, y)) continue
          const m = r[alvoCor]
          m.n += 1
          m.sx += x
          m.sy += y
          if (x < m.x1) m.x1 = x
          if (y < m.y1) m.y1 = y
          if (x > m.x2) m.x2 = x
          if (y > m.y2) m.y2 = y
        }
      }
      const fechar = (m: ReturnType<typeof vazia>) => ({
        n: m.n,
        x1: m.x1 * escalaX,
        y1: m.y1 * escalaY,
        x2: m.x2 * escalaX,
        y2: m.y2 * escalaY,
        cx: m.n > 0 ? (m.sx / m.n) * escalaX : NaN,
        cy: m.n > 0 ? (m.sy / m.n) * escalaY : NaN,
      })
      return { verdeAgua: fechar(r.verdeAgua), magenta: fechar(r.magenta), laranja: fechar(r.laranja) }
    },
    { b64: foto.toString('base64') },
  )
}

async function foto(page: Page): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await page.screenshot()
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error('não consegui fotografar')
}

/** O que o canvas do mapa mostra agora. */
async function lerTela(page: Page): Promise<Leitura> {
  await page.waitForTimeout(PINTURA_MS)
  return lerCores(page, await foto(page))
}

async function editorMostra(page: Page, cor: Cor, minimo: number, mensagem: string): Promise<void> {
  await expect.poll(async () => (await lerTela(page))[cor].n, { timeout: ESPERA_TELA, message: mensagem }).toBeGreaterThan(minimo)
}

/** A caixa do maior canvas da página (o do mapa), em px CSS. */
async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixas = await page.locator('canvas').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }),
  )
  const maior = caixas.sort((a, b) => b.width * b.height - a.width * a.height)[0]
  if (!maior) throw new Error('nenhum canvas na página')
  return maior
}

/** O centro de uma mancha está na faixa central do canvas? Devolve a explicação quando não está. */
async function noMeioDoCanvas(page: Page, m: Mancha): Promise<string | null> {
  const c = await caixaDoCanvas(page)
  const meio = { x: c.x + c.width / 2, y: c.y + c.height / 2 }
  const dx = Math.abs(m.cx - meio.x) / c.width
  const dy = Math.abs(m.cy - meio.y) / c.height
  if (m.n > 0 && dx <= FAIXA_CENTRAL && dy <= FAIXA_CENTRAL) return null
  return `centro da mancha em (${m.cx.toFixed(0)}, ${m.cy.toFixed(0)}), meio do canvas em (${meio.x.toFixed(0)}, ${meio.y.toFixed(0)}), ${m.n} px`
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos do mestre
// ───────────────────────────────────────────────────────────────────────────

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y, { steps: 4 })
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/**
 * Aproxima com a roda do mouse em cima da sala da esquerda até a Cripta e a
 * Lanterna saírem da tela — o mestre "perdido" numa ponta do mapa.
 */
async function aproximarNaEntrada(page: Page): Promise<void> {
  for (let i = 0; i < RODADAS_DE_RODA; i += 1) {
    const agora = await lerTela(page)
    if (agora.magenta.n <= RESIDUO && agora.laranja.n <= RESIDUO) return
    const entrada = agora.verdeAgua
    if (entrada.n === 0) throw new Error('a sala da esquerda sumiu da tela durante a aproximação')
    await page.mouse.move(entrada.cx, entrada.cy, { steps: 4 })
    await page.mouse.wheel(0, RODA_DELTA)
  }
}

function campoNome(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Mapa' }).getByLabel('Nome', { exact: true })
}

// ───────────────────────────────────────────────────────────────────────────
// A lista de objetos (o que ainda não existe)
// ───────────────────────────────────────────────────────────────────────────

/** Clique no botão que abre a lista; devolve o painel dela. */
async function abrirLista(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Mapa' }).click()
  const botao = page.getByRole('button', { name: BOTAO_DA_LISTA }).first()
  await expect(botao, 'a tela do mestre deveria ter um botão "Lista de objetos" / "Objetos do mapa"').toBeVisible({ timeout: ESPERA })
  if ((await botao.getAttribute('aria-expanded')) !== 'true') await botao.click()
  const corpo = await botao.getAttribute('aria-controls')
  const painel = corpo
    ? page.locator(`[id="${corpo}"]`)
    : page
        .getByRole('region', { name: NOME_DO_PAINEL })
        .or(page.getByRole('dialog', { name: NOME_DO_PAINEL }))
        .or(page.getByRole('complementary', { name: NOME_DO_PAINEL }))
        .or(page.getByRole('list', { name: NOME_DO_PAINEL }))
        .or(page.getByRole('listbox', { name: NOME_DO_PAINEL }))
        .or(page.getByRole('tree', { name: NOME_DO_PAINEL }))
  await expect(painel.first(), `o botão deveria abrir o painel "${NOME_DO_PAINEL}"`).toBeVisible({ timeout: ESPERA })
  return painel.first()
}

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** O item de um objeto: controle clicável do painel cujo nome acessível contém o nome do objeto. */
function item(painel: Locator, nome: string): Locator {
  const contem = new RegExp(escapar(nome), 'i')
  return painel
    .getByRole('button', { name: contem })
    .or(painel.getByRole('option', { name: contem }))
    .or(painel.getByRole('link', { name: contem }))
    .or(painel.getByRole('treeitem', { name: contem }))
}

function campoDeBusca(painel: Locator): Locator {
  return painel.getByRole('searchbox').or(painel.getByRole('textbox', { name: CAMPO_DE_BUSCA })).first()
}

/** Clique de ponteiro no item (o "Ir até lá"). */
async function irAte(page: Page, nome: string): Promise<void> {
  const painel = await abrirLista(page)
  const alvo = item(painel, nome).first()
  await expect(alvo, `a lista deveria ter um item "${nome}"`).toBeVisible({ timeout: ESPERA })
  await alvo.click()
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador: player.html inteiro, no próprio navegador (mecanismo da régua da viagem)
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
  const campoNomeJogador = page.getByLabel('Seu nome')
  await campoNomeJogador.click()
  await campoNomeJogador.pressSequentially(nome, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return page
}

/** Aba Jogo: abre a sala; o jogador entra; o mestre atribui a ficha; volta para o Mapa. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Page> {
  const rede = await mestreAbreAventura(mestre)
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  const jogador = await jogadorEntra(browser, baseURL, rede, 'c1', JOGADOR)
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const card = mestre.locator('#lb-rail-panel-room').locator('.lb-field').filter({ hasText: `${JOGADOR} —` })
  await card.getByRole('button', { name: `Atribuir ${FICHA_HEROI}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${FICHA_HEROI}` }), `${JOGADOR} deveria ficar com ${FICHA_HEROI}`).toBeVisible()
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await expect(jogador.locator('canvas').first(), 'o mapa não apareceu na tela do jogador').toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerTela(jogador)).verdeAgua.n, { timeout: ESPERA_TELA, message: `o jogador deveria ver a sala "${SALA_ENTRADA}" onde está a ficha dele` })
    .toBeGreaterThan(PIXELS_DE_SALA)
  return jogador
}

function parecido(antes: number, depois: number): boolean {
  if (antes <= RESIDUO) return depois <= RESIDUO * 4
  return Math.abs(depois - antes) / antes <= VARIACAO_TOLERADA
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: a cena abre com as duas salas; a roda aproxima na entrada e tira a Cripta e a Lanterna da tela; tocar na sala mostra o Nome dela', async ({ page }) => {
  test.setTimeout(90_000)
  await mestreAbreAventura(page)
  await editorMostra(page, 'laranja', PIXELS_DE_FICHA / 4, `o editor deveria mostrar a ficha "${FICHA_LANTERNA}" com a cena encaixada`)

  await aproximarNaEntrada(page)
  const perto = await lerTela(page)
  expect(perto.verdeAgua.n, `aproximado, a sala "${SALA_ENTRADA}" continua na tela`).toBeGreaterThan(PIXELS_DE_SALA)
  expect(perto.magenta.n, `aproximado na entrada, a "${CRIPTA}" deveria ter saído da tela`).toBeLessThanOrEqual(RESIDUO)
  expect(perto.laranja.n, `aproximado na entrada, a "${FICHA_LANTERNA}" deveria ter saído da tela`).toBeLessThanOrEqual(RESIDUO)

  // Toque no chão da sala, longe do rótulo do nome (que fica no centro da sala):
  // na coluna do centro de massa do verde visível (o painel lateral flutua por
  // cima do canvas, então a borda esquerda da mancha pode estar atrás dele) e
  // perto da borda de baixo. O painel mostra o Nome.
  const e = perto.verdeAgua
  await tocar(page, { x: e.cx, y: e.y1 + (e.y2 - e.y1) * 0.85 })
  await expect(campoNome(page), `tocar na sala deveria mostrar o Nome "${SALA_ENTRADA}" no painel`).toHaveValue(SALA_ENTRADA, { timeout: ESPERA })
})

test('2. a lista mostra pelo nome as salas, a porta, o marcador, as fichas e o texto da cena aberta, e nada da outra cena', async ({ page }) => {
  test.setTimeout(90_000)
  await mestreAbreAventura(page)
  const painel = await abrirLista(page)

  for (const nome of [SALA_ENTRADA, CRIPTA, PORTA, PINO_BAU, FICHA_LANTERNA, FICHA_HEROI, TEXTO_AVISO]) {
    await expect(item(painel, nome).first(), `a lista deveria ter um item com "${nome}"`).toBeVisible({ timeout: ESPERA })
  }
  await expect(item(painel, FICHA_DA_TORRE), `"${FICHA_DA_TORRE}" é da cena "${TORRE}" e não deveria estar na lista do "${SALAO}"`).toHaveCount(0)
})

test('3. digitar na busca filtra a lista, sem diferença de maiúscula, e apagar a busca traz tudo de volta', async ({ page }) => {
  test.setTimeout(90_000)
  await mestreAbreAventura(page)
  const painel = await abrirLista(page)
  const busca = campoDeBusca(painel)
  await expect(busca, 'o painel deveria ter um campo de busca').toBeVisible({ timeout: ESPERA })

  await busca.click()
  await busca.pressSequentially('crip', { delay: 30 })

  await expect(item(painel, CRIPTA).first(), `buscando "crip", a "${CRIPTA}" deveria continuar na lista`).toBeVisible({ timeout: ESPERA })
  for (const outro of [SALA_ENTRADA, PINO_BAU, FICHA_LANTERNA, TEXTO_AVISO]) {
    await expect(item(painel, outro), `buscando "crip", "${outro}" deveria sair da lista`).toHaveCount(0, { timeout: ESPERA })
  }

  await busca.press('Control+a')
  await busca.press('Backspace')
  for (const nome of [SALA_ENTRADA, CRIPTA, PINO_BAU, FICHA_LANTERNA, TEXTO_AVISO]) {
    await expect(item(painel, nome).first(), `com a busca vazia, "${nome}" deveria voltar à lista`).toBeVisible({ timeout: ESPERA })
  }
})

test('4. aproximado na entrada, clicar em "Cripta" na lista seleciona a sala e leva a câmera até ela', async ({ page }) => {
  test.setTimeout(90_000)
  await mestreAbreAventura(page)
  await aproximarNaEntrada(page)
  const antes = await lerTela(page)
  expect(antes.magenta.n, `preparo: a "${CRIPTA}" deveria estar fora da tela antes do clique`).toBeLessThanOrEqual(RESIDUO)

  await irAte(page, CRIPTA)

  await expect(campoNome(page), `o clique no item deveria selecionar a "${CRIPTA}" (painel com o Nome dela)`).toHaveValue(CRIPTA, { timeout: ESPERA })
  await editorMostra(page, 'magenta', PIXELS_DE_SALA, `a câmera deveria ter ido até a "${CRIPTA}" (chão magenta na tela)`)
  const depois = await lerTela(page)
  expect(depois.magenta.n, `a "${CRIPTA}" deveria estar na tela depois do clique`).toBeGreaterThan(PIXELS_DE_SALA)
  expect(await noMeioDoCanvas(page, depois.magenta), `a "${CRIPTA}" deveria ficar no meio do canvas`).toBeNull()
})

test('5. aproximado na entrada, clicar na ficha "Lanterna" na lista seleciona a ficha e a traz para o meio da tela', async ({ page }) => {
  test.setTimeout(90_000)
  await mestreAbreAventura(page)
  await aproximarNaEntrada(page)
  const antes = await lerTela(page)
  expect(antes.laranja.n, `preparo: a "${FICHA_LANTERNA}" deveria estar fora da tela antes do clique`).toBeLessThanOrEqual(RESIDUO)

  await irAte(page, FICHA_LANTERNA)

  await expect(campoNome(page), `o clique no item deveria selecionar a ficha "${FICHA_LANTERNA}"`).toHaveValue(FICHA_LANTERNA, { timeout: ESPERA })
  await editorMostra(page, 'laranja', PIXELS_DE_FICHA / 4, `a câmera deveria ter ido até a ficha "${FICHA_LANTERNA}"`)
  const depois = await lerTela(page)
  expect(depois.laranja.n, `a ficha "${FICHA_LANTERNA}" deveria estar na tela depois do clique`).toBeGreaterThan(PIXELS_DE_FICHA / 4)
  expect(await noMeioDoCanvas(page, depois.laranja), `a ficha "${FICHA_LANTERNA}" deveria ficar no meio do canvas`).toBeNull()
})

test('6. a lista é do mestre: o "Ir até lá" dele não mexe na tela do jogador, e o jogador não ganha lista nem busca', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const jogador = await mesaMontada(browser, page, baseURL ?? '')
  const antes = await lerTela(jogador)

  await irAte(page, CRIPTA)
  await editorMostra(page, 'magenta', PIXELS_DE_SALA, `no mestre, a câmera deveria ter ido até a "${CRIPTA}"`)

  // O jogador fica onde estava: a mesma quantidade de cada cor na tela dele.
  await jogador.waitForTimeout(1000)
  const depois = await lerTela(jogador)
  const resumo = `antes: verde-água ${antes.verdeAgua.n}, magenta ${antes.magenta.n}; depois: verde-água ${depois.verdeAgua.n}, magenta ${depois.magenta.n}`
  expect(parecido(antes.verdeAgua.n, depois.verdeAgua.n), `a tela do jogador não deveria se mexer com o "Ir até lá" do mestre — ${resumo}`).toBe(true)
  expect(parecido(antes.magenta.n, depois.magenta.n), `a tela do jogador não deveria ir até a "${CRIPTA}" — ${resumo}`).toBe(true)
  await expect(jogador.getByRole('button', { name: BOTAO_DA_LISTA }), 'o jogador não deveria ter o botão da lista de objetos').toHaveCount(0)
  await expect(jogador.getByRole('searchbox'), 'o jogador não deveria ter busca de objetos').toHaveCount(0)
})
