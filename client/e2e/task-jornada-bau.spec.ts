// JORNADA DO BAÚ COM CONTEÚDO, de ponta a ponta (Fase C do pedido de 15/11/2026).
//
// A FEATURE: na ficha do objeto, seção "Conteúdo", o mestre põe itens do
// Acervo e uma armadilha num baú. O jogador só sabe que o baú se abre
// (`Prop.abrivel: 'fechado'`); encosta, toca, joga o minigame "Abrir o baú" na
// tela dele e, ao vencer, recebe o desfecho: os itens na mochila da ficha de
// personagem, a cobra (susto), -8 PV e Envenenado por 3 turnos. O mestre vê o
// aviso "Ana abriu o Baú" com "Ver" e a página Jogos ao vivo; o "Passar turno"
// do Grupo, fora da batalha, tira 4 PV e desconta 1 turno do veneno.
//
// COMO ESTE ARQUIVO PROVA (preparo herdado de task-jornada-pesca):
//   TELAS DE VERDADE. O mestre é o app inteiro em modo Tauri, com disco de
//   mentira (a aventura, as fichas One Piece e o Acervo em appData/itens); a
//   jogadora é o `player.html` inteiro, noutro contexto. Só o TRANSPORTE Rust é
//   falsificado: o WebSocket do jogador vira `net:message` no mestre, e o
//   `net_send` do mestre volta ao socket. A Visão de jogador NÃO serve aqui: ela
//   grava na camada de teste e nunca nas stores do editor, então a vida no
//   Grupo, a pastilha e o "Passar turno" (que só existe com a mesa aberta) não
//   mudariam por ela.
//   GESTO REAL: o mestre clica o baú no canvas, usa a busca do Acervo pelo
//   teclado (Enter) e a Armadilha; a jogadora toca o baú com o mouse, arrasta a
//   ficha e joga o baú pelo TECLADO de verdade (`page.keyboard`, Digit1-3).
//   O ROBÔ só LÊ o estado da tentativa: um invólucro em `JOGO_BAU.criar` guarda
//   a referência do estado que o jogo cria (nada da regra muda) e o robô decide
//   qual fecho tocar como gente decidiria, sem o atraso de 250 ms do robô de
//   balanceamento: aqui se prova o fluxo, não a dificuldade.
//   MAPA ANTIGO: o `map.json` do disco nasce sem nenhum campo novo (nem
//   `conteudo`, nem `semJumpscare`, nem `abrivel`); o barril dele, sem conteúdo,
//   abre o minigame igual.
import { test, expect, type Browser, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { armadilhaPadrao } from '../src/lib/conteudoDoObjeto'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { FRASE_DO_SUSTO } from '../src/minigames/abrir/tela/textos'
import type { Estado as EstadoDoBau } from '../src/minigames/bau/sim'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, PinItem, Prop, Token, Wall } from '../src/types/map'
import { mostrarColunaDireita } from './helpers/colunaDireita'
import { pickTool } from './helpers/tools'

// Disco apertado nesta máquina: sem trace, sem vídeo e sem foto de falha (as 5 fotos da prova são estas daqui).
test.use({ trace: 'off', video: 'off', screenshot: 'off' })

const CODIGO = 'BAUC01'
const ANA = 'Ana'
const AVENTURA = 'Porao do Bento'
const ID_CENA = 'scene_porao'
const PASTA = 'C:/appdata/maps/map_porao'
const TOKEN_ANA = 'Lanterna'
const ID_TOKEN = 'tok-lanterna'
const ID_PERSONAGEM = 'p-lanterna'
const VIDA_MAXIMA = 30

const ID_BAU = 'bau-porao'
const ID_BARRIL = 'barril-velho'
const POCAO = { id: 'item_pocao', nome: 'Poção de cura', categoria: 'Consumível' }
const CHAVE = { id: 'item_chave', nome: 'Chave de bronze', categoria: 'Chave' }
const LINHA_DA_COBRA = 'A cobra picou: -8 PV. Envenenado por 3 turnos.'

/** As fotos da prova: caminho relativo a client/, de onde o Playwright roda. */
const PASTA_DAS_FOTOS = '../tmp/minigame-bau-2026-11-15/fase-c'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }
/** Igual a `FIT_MARGIN` de pixi/PixiCanvas.tsx (enquadramento de abertura do editor). */
const FIT_MARGIN_MESTRE = 40
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx. */
const FIT_MARGIN_JOGADOR = 24
/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120

/** Espera de tela comum (mensagem cruzar o fio e a tela pintar). */
const ESPERA = 10_000
/** A vela do baú tem 20 s; três tentativas e folga. */
const PARTIDA_MS = 75_000
/** Teto do quadro e da tarefa longa na tela do jogador durante o minigame. */
const TRAVADA_MS = 200

type Ponto = { x: number; y: number }
const casa = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const POS_BAU = casa(20, 6)
/** O barril do mapa antigo: encostado na ficha quando ela chega ao lado do baú. */
const POS_BARRIL = casa(18, 7)
/** A ficha começa a 5 casas do baú (longe) e é arrastada para a casa à esquerda dele (encostada). */
const ANA_LONGE = casa(15, 6)
const ANA_ENCOSTADA = casa(19, 6)

// ───────────────────────────────────────────────────────────────────────────
// O disco: a aventura (mapa SEM campo novo), as fichas One Piece e o Acervo
// ───────────────────────────────────────────────────────────────────────────

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Baú e barril como um mapa de antes da Fase C os gravaria: só o tipo do móvel, nenhum conteúdo. */
function movelAntigo(id: string, p: Ponto, mobilia: 'bau' | 'barril'): Prop {
  return { id, src: '', x: p.x, y: p.y, width: 40, height: 40, linkedMapPath: null, mobilia }
}

function mapaDoPorao(): MapData {
  const base = createEmptyMap('map_porao', AVENTURA, COLUNAS, LINHAS, GRADE)
  const ficha: Token = { id: ID_TOKEN, characterId: ID_PERSONAGEM, name: TOKEN_ANA, x: ANA_LONGE.x, y: ANA_LONGE.y, size: 1, image: null, color: '#3cff00' }
  return {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    // O contorno faz o enquadramento do editor e o da chegada do jogador serem o mundo inteiro.
    walls: [parede('w-n', 0, 0, LARGURA, 0), parede('w-l', LARGURA, 0, LARGURA, ALTURA), parede('w-s', LARGURA, ALTURA, 0, ALTURA), parede('w-o', 0, ALTURA, 0, 0)],
    tokens: [ficha],
    props: [movelAntigo(ID_BAU, POS_BAU, 'bau'), movelAntigo(ID_BARRIL, POS_BARRIL, 'barril')],
  }
}

function itemDoAcervo(item: { id: string; nome: string; categoria: string }): Record<string, unknown> {
  return { id: item.id, nome: item.nome, imagem: null, descricao: '', categoria: item.categoria, preco: null, empilhavel: true }
}

function pinItem(item: { id: string; nome: string; categoria: string }): PinItem {
  return { nome: item.nome, itemId: item.id, categoria: item.categoria, empilhavel: true }
}

/** Para a Visão de jogador: o baú já cheio (formato novo, gravado pela ficha) e a ficha encostada nele. */
function mapaComBauCheio(): MapData {
  const antigo = mapaDoPorao()
  return {
    ...antigo,
    tokens: antigo.tokens.map((t) => ({ ...t, x: ANA_ENCOSTADA.x, y: ANA_ENCOSTADA.y })),
    props: antigo.props.map((p) =>
      p.id !== ID_BAU ? p : { ...p, conteudo: { itens: [{ item: pinItem(POCAO), quantidade: 1 }, { item: pinItem(CHAVE), quantidade: 1 }], moedas: 0, armadilha: armadilhaPadrao('cobra') } },
    ),
  }
}

function discoDaAventura(mapa: MapData): Record<string, string> {
  const textoDoMapa = serializeMap(mapa)
  const aventura = {
    version: 1,
    id: 'adv_porao',
    name: AVENTURA,
    startSceneId: ID_CENA,
    scenes: [{ id: ID_CENA, name: AVENTURA, file: 'map.json' }],
    // A ficha do sistema: One Piece (embutido no app), HP de atual e máximo; a vida mora AQUI, não no token.
    sistemaDeRpg: 'one-piece',
    personagens: [{ id: ID_PERSONAGEM, tipo: 'jogador', nome: TOKEN_ANA, recursos: { hp: VIDA_MAXIMA }, maximos: { hp: VIDA_MAXIMA } }],
  }
  // O Acervo de itens: appData/itens/itens.json (lib/acervoDeItens.ts).
  const acervo = { version: 1, categorias: ['Consumível', 'Chave'], itens: [itemDoAcervo(POCAO), itemDoAcervo(CHAVE)] }
  return {
    [`${PASTA}/map.json`]: textoDoMapa,
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    'C:/appdata/itens/itens.json': JSON.stringify(acervo, null, 2),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Os globais de página desta jornada (nomes próprios: o tipo `Window` é um só para todos os specs)
// ───────────────────────────────────────────────────────────────────────────

type HandlerTauri = (evento: { event: string; id: number; payload: unknown }) => void

interface MedidaDaTela {
  quadros: number[]
  tarefas: number[]
  parar: () => void
}

declare global {
  interface Window {
    /** Mestre: entrega um evento do Tauri de mentira aos ouvintes do app (`net:message`). */
    __bauEmitirTauri?: (event: string, payload: unknown) => void
    /** Mestre: o `net_send` do app, exposto pelo spec, leva o texto ao socket do jogador. */
    __bauParaJogador?: (clientId: string, texto: string) => void
    /** Jogadora: os estados de tentativa do baú que o jogo criou, na ordem (só leitura). */
    __bauEstados?: EstadoDoBau[]
    /** Jogadora: quadros e tarefas longas medidos durante o minigame. */
    __bauMedida?: MedidaDaTela
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco de mentira e transporte de mentira
// ───────────────────────────────────────────────────────────────────────────

interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Tudo o que o mestre mandou a cada jogador, na ordem, como foi pelo fio. */
  enviados: Map<string, string[]>
  /** Mensagens do jogador entregues ao mestre uma de cada vez, na ordem em que chegaram. */
  fila: Promise<void>
}

/** `comMesa`: abre a mesa online (Grupo, vida, "Passar turno"); sem ela, só o editor e a Visão de jogador. */
async function mestreAbreAMesa(mestre: Page, mapa: MapData, comMesa = true): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), enviados: new Map(), fila: Promise.resolve() }
  await mestre.exposeFunction('__bauParaJogador', (clientId: string, texto: string) => {
    const lista = rede.enviados.get(clientId) ?? []
    lista.push(texto)
    rede.enviados.set(clientId, lista)
    rede.sockets.get(clientId)?.send(texto)
  })
  await mestre.addInitScript(
    ({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }) => {
      // Só o editor: o popup da Visão de jogador é outra página e não leva o disco.
      if (location.pathname.indexOf('visao-jogador') !== -1) return
      // A lista de recursos guarda a URL de cada módulo que o app carregou (ver `lerEditor`); o padrão de 250 não cabe o app em dev.
      performance.setResourceTimingBufferSize(10_000)
      /** A janela da Visão de jogador: o Rust de verdade cria janela nativa; aqui ela vira o popup do navegador. */
      let janelaDeTeste: Window | null = null
      const textos: Record<string, string> = { ...arquivos }
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const existe = (caminho: string): boolean => {
        const c = semBarraFinal(caminho)
        return Object.keys(textos).some((p) => p === c || p.indexOf(`${c}/`) === 0)
      }
      const callbacks = new Map<number, HandlerTauri>()
      const ouvintes = new Map<number, { event: string; handler: HandlerTauri }>()
      let proximoId = 1
      window.__bauEmitirTauri = (event, payload) => {
        for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
      }
      // O app em modo Tauri: só nele há livro da mesa, sala e aventura do disco.
      Reflect.set(window, 'isTauri', true)
      Reflect.set(window, '__TAURI_INTERNALS__', {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        convertFileSrc: (caminho: string) => String(caminho),
        transformCallback: (cb: HandlerTauri) => {
          const id = proximoId
          proximoId += 1
          callbacks.set(id, cb)
          return id
        },
        invoke: async (cmd: string, args?: unknown) => {
          const campo = (nome: string): unknown => (typeof args === 'object' && args !== null ? Reflect.get(args, nome) : undefined)
          switch (cmd) {
            case 'net_start_room':
              return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
            case 'net_send':
              window.__bauParaJogador?.(String(campo('clientId')), JSON.stringify(campo('msg')))
              return null
            case 'abrir_visao_jogador':
              if (janelaDeTeste !== null) janelaDeTeste.close()
              janelaDeTeste = window.open(`/visao-jogador.html?sessao=${encodeURIComponent(String(campo('sessao')))}`, 'visao-jogador', 'popup,width=1280,height=800')
              return null
            case 'mostrar_visao_jogador':
              return janelaDeTeste !== null && !janelaDeTeste.closed
            case 'fechar_visao_jogador':
              if (janelaDeTeste !== null) janelaDeTeste.close()
              janelaDeTeste = null
              return null
            case 'plugin:event|listen': {
              const id = Number(campo('handler'))
              const cb = callbacks.get(id)
              if (cb) ouvintes.set(id, { event: String(campo('event')), handler: cb })
              return id
            }
            case 'plugin:event|unlisten':
              ouvintes.delete(Number(campo('eventId')))
              return null
            case 'plugin:path|resolve_directory':
              return 'C:/appdata'
            case 'plugin:path|join': {
              const partes = campo('paths')
              return Array.isArray(partes) ? partes.map(String).join('/') : ''
            }
            case 'plugin:path|dirname': {
              const p = String(campo('path'))
              return p.slice(0, Math.max(0, p.lastIndexOf('/')))
            }
            case 'plugin:fs|exists':
              return existe(String(campo('path')))
            case 'plugin:fs|read_text_file': {
              const caminho = String(campo('path'))
              if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(textos[caminho]))
            }
            case 'plugin:fs|read_dir': {
              const prefixo = `${semBarraFinal(String(campo('path')))}/`
              const filhos = new Map<string, boolean>()
              for (const p of Object.keys(textos)) {
                if (p.indexOf(prefixo) !== 0) continue
                const resto = p.slice(prefixo.length)
                const corte = resto.indexOf('/')
                const nome = corte === -1 ? resto : resto.slice(0, corte)
                filhos.set(nome, (filhos.get(nome) ?? false) || corte !== -1)
              }
              return Array.from(filhos.entries()).map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
            }
            default:
              // Gravar no disco, parar a sala, expulsar: nada disso muda o que esta jornada lê.
              return null
          }
        },
      })
    },
    { arquivos: discoDaAventura(mapa), codigo: CODIGO },
  )

  await mestre.goto('/')
  await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await mestre.waitForSelector('canvas')
  await mostrarColunaDireita(mestre)
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  if (!comMesa) return rede
  await mestre.getByRole('button', { name: 'Abrir mesa online' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

/** Aba Grupo, card do jogador, "Atribuir <ficha>". */
async function mestreAtribui(mestre: Page, jogador: string, nomeDoToken: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  const card = mestre.locator('#lb-rail-panel-room .lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${nomeDoToken}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDoToken}` }), `${jogador} deveria ficar com ${nomeDoToken}`).toBeVisible()
}

/** Mundo → tela do mestre, com o enquadramento de abertura da cena (conteúdo, margem 40). */
async function naTelaDoMestre(mestre: Page, mapa: MapData, p: Ponto): Promise<Ponto> {
  const caixa = await mestre.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('régua: o canvas do mestre não tem caixa')
  const limites = contentBounds(mapa)
  if (!limites) throw new Error('régua: a cena não tem conteúdo para o editor enquadrar')
  const c = fitCamera(limites, { width: caixa.width, height: caixa.height }, FIT_MARGIN_MESTRE)
  return { x: caixa.x + p.x * c.scale + c.x, y: caixa.y + p.y * c.scale + c.y }
}

/** O que o editor tem agora do baú, da ficha e da personagem (as stores que o app usa; ver task-jornada-pesca, `mapaDoEditor`). */
interface LidoDoEditor {
  bau: { itens: { nome: string; quantidade: number; itemId: string | null }[]; armadilha: string | null; aberto: string | null } | null
  condicoes: string[]
  prazos: { nome: string; turnos: number; porVez?: number }[]
  mochila: { nome: string; quantidade: number; itemId: string | null }[]
}

async function lerEditor(mestre: Page): Promise<LidoDoEditor> {
  return mestre.evaluate(
    async ({ idBau, idToken, idPersonagem }) => {
      // Num vite reaproveitado o módulo pode vir carimbado (`?t=<ms>`): importar a URL sem carimbo daria outra store.
      const urlDe = (caminho: string): string => performance.getEntriesByType('resource').map((e) => e.name).find((nome) => new URL(nome).pathname === caminho) ?? caminho
      const mapas: typeof import('/src/stores/mapStore.ts') = await import(/* @vite-ignore */ urlDe('/src/stores/mapStore.ts'))
      const aventuras: typeof import('/src/stores/adventureStore.ts') = await import(/* @vite-ignore */ urlDe('/src/stores/adventureStore.ts'))
      const { props, tokens } = mapas.useMapStore.getState().map
      const prop = props.find((p) => p.id === idBau)
      const token = tokens.find((t) => t.id === idToken)
      const personagem = aventuras.personagensAtivos(aventuras.useAdventureStore.getState()).find((p) => p.id === idPersonagem)
      const conteudo = prop?.conteudo
      return {
        bau:
          conteudo === undefined
            ? null
            : {
                itens: conteudo.itens.map(({ item, quantidade }) => ({ nome: item.nome, quantidade, itemId: item.itemId ?? null })),
                armadilha: conteudo.armadilha?.tipo ?? null,
                aberto: conteudo.aberto?.por ?? null,
              },
        condicoes: token?.conditions ?? [],
        prazos: (token?.prazosDasCondicoes ?? []).map((p) => ({ ...p })),
        mochila: (personagem?.mochila ?? []).map((item) => ({ nome: item.nome, quantidade: item.quantidade ?? 1, itemId: item.itemId ?? null })),
      }
    },
    { idBau: ID_BAU, idToken: ID_TOKEN, idPersonagem: ID_PERSONAGEM },
  )
}

// ───────────────────────────────────────────────────────────────────────────
// A jogadora: player.html inteiro
// ───────────────────────────────────────────────────────────────────────────

const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadoraEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Page> {
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
            rede.mestre.evaluate(({ c, t }) => {
              const msg: unknown = JSON.parse(t)
              window.__bauEmitirTauri?.('net:message', { clientId: c, msg })
            }, { c: clientId, t: texto }),
          )
          .catch(() => undefined)
      })
    },
  )
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da mesa online')
  await codigo.click()
  await codigo.pressSequentially(CODIGO, { delay: 20 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.pressSequentially(nome, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: ESPERA })
  return page
}

/** Com a ficha à vista e fora dos painéis, a câmera de chegada do jogador é a do mapa inteiro (player/arrivalCamera.ts). */
const CAMERA_JOGADOR = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN_JOGADOR)

function naTelaDoJogador(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.x), y: Math.round(p.y * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.y) }
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Arrasta a ficha: desce nela, anda em passos, para um instante e solta. */
async function arrastar(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.move(para.x, para.y, { steps: 20 })
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

// ───────────────────────────────────────────────────────────────────────────
// O robô do baú: lê o estado da tentativa e toca os fechos pelo teclado
// ───────────────────────────────────────────────────────────────────────────

/**
 * Roda NA PÁGINA da jogadora, antes do toque no baú: embrulha `JOGO_BAU.criar`
 * para guardar cada estado que o jogo cria. O invólucro devolve o mesmo estado
 * e não mexe em regra nenhuma; o motor continua sendo o único que dá passo.
 * Guarda TODOS: no dev o React (StrictMode) chama duas vezes o inicializador do
 * `useState` do motor e descarta o segundo, que nunca anda; quem anda é lido
 * pelo tempo (`t > 0`).
 */
async function instalarOlhoNoBau(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((nome) => new URL(nome).pathname === '/src/minigames/bau/jogo.ts') ?? '/src/minigames/bau/jogo.ts'
    const modulo: typeof import('/src/minigames/bau/jogo.ts') = await import(/* @vite-ignore */ url)
    const jogo = modulo.JOGO_BAU
    const criarDoJogo = jogo.criar
    // `Reflect.set`: a propriedade é do contrato `JogoDeAbrir`; o objeto exportado é literal e aceita a troca.
    Reflect.set(jogo, 'criar', (semente: string, dif: EstadoDoBau['dif']): EstadoDoBau => {
      const estado = criarDoJogo(semente, dif)
      window.__bauEstados = [...(window.__bauEstados ?? []), estado]
      return estado
    })
  })
}

interface LeituraDoBau {
  fim: string | null
  /** Fecho em aviso (o solavanco vem aí); -1 = nenhum. */
  alvo: number
  a: number[]
  preso: boolean[]
}

/** A tentativa que anda, criada a partir do índice `desde` (a mais nova com tempo corrido); `null` = nenhuma andou ainda. */
async function lerBau(page: Page, desde: number): Promise<LeituraDoBau | null> {
  return page.evaluate((inicio) => {
    const andando = (window.__bauEstados ?? []).slice(inicio).filter((e) => e.t > 0)
    const e = andando[andando.length - 1]
    if (e === undefined) return null
    return { fim: e.fim, alvo: e.avisoEm, a: e.fechos.map((f) => f.a), preso: e.fechos.map((f) => f.preso > 0) }
  }, desde)
}

async function quantosEstados(page: Page): Promise<number> {
  return page.evaluate(() => (window.__bauEstados ?? []).length)
}

/** O robô toca um fecho quando o vê abaixo disto (o "cedo demais" do Normal é 0,85: folga para o atraso do fio). */
const TOCA_ABAIXO = 0.6
/** O dedo de gente não bate mais rápido que isso. */
const INTERVALO_MIN_MS = 160
/** Não toca de novo um fecho que tocou há menos que isto (a leitura seguinte ainda pode ser de antes do toque). */
const MEMORIA_MS = 300
/** Entre duas leituras do robô. */
const OLHADA_MS = 40

function escolherFecho(l: LeituraDoBau, agora: number, tocouEm: readonly number[]): number {
  const livre = (i: number, memoria: number): boolean => l.preso[i] === false && agora - (tocouEm[i] ?? -Infinity) >= memoria
  // O fecho que acendeu: tocar já (segurar o que acendeu nunca emperra).
  if (l.alvo >= 0 && livre(l.alvo, OLHADA_MS * 3)) return l.alvo
  let melhor = -1
  l.a.forEach((a, i) => {
    if (!livre(i, MEMORIA_MS) || a > TOCA_ABAIXO) return
    if (melhor < 0 || a < (l.a[melhor] ?? 1)) melhor = i
  })
  return melhor
}

/** Joga até a tampa subir; se a vela apagar, "Tentar de novo" (sem consequência). Devolve quantas tentativas levou. */
async function jogarOBau(page: Page): Promise<number> {
  const fim = Date.now() + PARTIDA_MS
  let tentativas = 1
  let desde = 0
  let ultimoToque = -Infinity
  const tocouEm: number[] = []
  if ((await quantosEstados(page)) === 0) throw new Error('o olho no baú não viu tentativa nenhuma: o invólucro de JOGO_BAU.criar não pegou')
  while (Date.now() < fim) {
    const l = await lerBau(page, desde)
    if (l === null) {
      await page.waitForTimeout(OLHADA_MS)
      continue
    }
    if (l.fim === 'abriu') return tentativas
    if (l.fim === 'tempo') {
      const deNovo = page.locator('.lb-abrir').getByRole('button', { name: 'Tentar de novo' })
      await expect(deNovo, 'a vela apagou: o cartão "Não abriu" deveria oferecer "Tentar de novo"').toBeVisible({ timeout: ESPERA })
      desde = await quantosEstados(page)
      await deNovo.click()
      tentativas += 1
      tocouEm.length = 0
      continue
    }
    const agora = Date.now()
    const fecho = agora - ultimoToque < INTERVALO_MIN_MS ? -1 : escolherFecho(l, agora, tocouEm)
    if (fecho >= 0) {
      await page.keyboard.press(`Digit${fecho + 1}`)
      ultimoToque = Date.now()
      tocouEm[fecho] = ultimoToque
    }
    await page.waitForTimeout(OLHADA_MS)
  }
  const tempos = await page.evaluate(() => (window.__bauEstados ?? []).map((e) => `${e.t.toFixed(2)}s/${String(e.fim)}`).join(', '))
  throw new Error(`o baú não abriu em ${PARTIDA_MS / 1000} s (${tentativas} tentativas; estados vistos: ${tempos})`)
}

// ───────────────────────────────────────────────────────────────────────────
// A medida da travada na tela da jogadora (rAF e PerformanceObserver 'longtask')
// ───────────────────────────────────────────────────────────────────────────

async function comecarMedida(page: Page): Promise<void> {
  await page.evaluate(() => {
    const quadros: number[] = []
    const tarefas: number[] = []
    const observador = new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) tarefas.push(entrada.duration)
    })
    observador.observe({ type: 'longtask', buffered: false })
    let anterior = performance.now()
    let viva = true
    const quadro = (t: number): void => {
      if (!viva) return
      quadros.push(t - anterior)
      anterior = t
      requestAnimationFrame(quadro)
    }
    requestAnimationFrame(quadro)
    window.__bauMedida = {
      quadros,
      tarefas,
      parar: () => {
        viva = false
        observador.disconnect()
      },
    }
  })
}

async function pararMedida(page: Page): Promise<{ quadros: number; p95: number; maiorQuadro: number; tarefasLongas: number; maiorTarefa: number }> {
  const bruto = await page.evaluate(() => {
    const m = window.__bauMedida
    if (m === undefined) return null
    m.parar()
    return { quadros: [...m.quadros], tarefas: [...m.tarefas] }
  })
  if (bruto === null) throw new Error('a medida da tela não foi instalada')
  // O primeiro intervalo vai da instalação ao primeiro quadro: não é quadro.
  const quadros = bruto.quadros.slice(1).sort((a, b) => a - b)
  const p95 = quadros[Math.min(quadros.length - 1, Math.floor(quadros.length * 0.95))] ?? 0
  return { quadros: quadros.length, p95, maiorQuadro: quadros[quadros.length - 1] ?? 0, tarefasLongas: bruto.tarefas.length, maiorTarefa: Math.max(0, ...bruto.tarefas) }
}

async function foto(page: Page, nome: string): Promise<void> {
  const caminho = `${PASTA_DAS_FOTOS}/${nome}`
  await page.screenshot({ path: caminho })
  console.log(`[foto] ${caminho}`)
}

// ───────────────────────────────────────────────────────────────────────────
// A jornada
// ───────────────────────────────────────────────────────────────────────────

test('baú com 2 itens do Acervo e a cobra: a jogadora encosta, joga e vence; mochila, susto, -8 PV, Envenenado, aviso, página Jogos, Passar turno e o barril do mapa antigo', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(300_000)
  const erros: string[] = []
  mestre.on('pageerror', (erro) => erros.push(`mestre: ${erro.message}`))
  const mapa = mapaDoPorao()
  // A prova do "mapa antigo" (item 6) depende disto: o map.json de partida não traz nada da Fase C.
  const textoDoMapa = serializeMap(mapa)
  for (const campo of ['conteudo', 'semJumpscare', 'abrivel']) expect(textoDoMapa, `o map.json de partida não deveria trazer "${campo}"`).not.toContain(campo)
  const rede = await mestreAbreAMesa(mestre, mapa)
  const ana = await jogadoraEntra(browser, baseURL ?? '', rede, 'c1', ANA)
  ana.on('pageerror', (erro) => erros.push(`jogadora: ${erro.message}`))
  await mestreAtribui(mestre, ANA, TOKEN_ANA)
  await expect(ana.locator('canvas').first(), 'a jogadora: o mapa não apareceu').toBeVisible({ timeout: ESPERA })
  const vidaNoGrupo = mestre.locator('#lb-rail-panel-room .gr-vida-linha').first()
  await expect(vidaNoGrupo, 'antes de abrir, o Grupo deveria mostrar a vida cheia').toContainText(`${VIDA_MAXIMA}/${VIDA_MAXIMA} PV`, { timeout: ESPERA })

  // 1. O mestre clica o baú com Selecionar e, na ficha, seção Conteúdo: 2 itens do Acervo (busca + Enter) e a Cobra.
  await pickTool(mestre, 'Selecionar')
  const noBau = await naTelaDoMestre(mestre, mapa, POS_BAU)
  await mestre.mouse.click(noBau.x, noBau.y)
  const maisItem = mestre.getByRole('button', { name: '+ Item do acervo' })
  await expect(maisItem, 'clicar o baú com Selecionar deveria abrir a ficha do objeto com a seção Conteúdo').toBeVisible({ timeout: ESPERA })
  const pedidos: { busca: string; item: typeof POCAO }[] = [
    { busca: 'Poção', item: POCAO },
    { busca: 'Chave', item: CHAVE },
  ]
  for (const { busca, item } of pedidos) {
    await maisItem.click()
    const procurar = mestre.getByRole('dialog', { name: 'Itens do acervo' }).getByRole('searchbox', { name: 'Procurar no acervo' })
    await expect(procurar, '"+ Item do acervo" deveria abrir a busca no Acervo').toBeFocused({ timeout: ESPERA })
    await mestre.keyboard.type(busca, { delay: 25 })
    await expect(mestre.locator('.lb-conteudo__achado').first(), `a busca "${busca}" deveria achar ${item.nome} primeiro`).toContainText(item.nome)
    await mestre.keyboard.press('Enter')
    await expect(mestre.locator('.lb-conteudo__item').filter({ hasText: item.nome }), `Enter deveria pôr ${item.nome} no baú`).toHaveCount(1, { timeout: ESPERA })
  }
  const armadilha = mestre.getByRole('radiogroup', { name: 'Armadilha' })
  await armadilha.getByRole('radio', { name: 'Cobra' }).click()
  await expect(armadilha.getByRole('radio', { name: 'Cobra' }), 'o clique em Cobra deveria marcá-la').toHaveAttribute('aria-checked', 'true')
  await expect(mestre.getByText(/Padrão da cobra: 8 PV na hora e Envenenado por 3 turnos/)).toBeVisible()
  await foto(mestre, '01-ficha-do-bau-com-conteudo.png')
  const comConteudo = await lerEditor(mestre)
  expect(comConteudo.bau, 'controle: o baú do EDITOR tem os 2 itens e a cobra (senão a prova do recorte não prova nada)').toEqual({
    itens: [
      { nome: POCAO.nome, quantidade: 1, itemId: POCAO.id },
      { nome: CHAVE.nome, quantidade: 1, itemId: CHAVE.id },
    ],
    armadilha: 'cobra',
    aberto: null,
  })
  await mestre.keyboard.press('Escape')

  // 2. Antes de abrir: nada do conteúdo foi pelo fio nem está na tela da jogadora; o baú chega só "fechado".
  await ana.waitForTimeout(1500)
  const fioAntes = (rede.enviados.get('c1') ?? []).join('\n')
  expect(fioAntes, 'o mestre deveria ter mandado o recorte com o baú "fechado"').toContain('"abrivel":"fechado"')
  for (const segredo of [POCAO.nome, CHAVE.nome, 'cobra', 'conteudo']) expect(fioAntes, `"${segredo}" não pode ir ao jogador antes de abrir`).not.toContain(segredo)
  const telaAntes = await ana.content()
  for (const segredo of [POCAO.nome, CHAVE.nome, 'cobra', 'Cobra']) expect(telaAntes, `"${segredo}" não pode estar na tela da jogadora antes de abrir`).not.toContain(segredo)

  // 3. Longe: o toque no baú é recusado. Arrasta a ficha para o lado do baú e toca de novo: o minigame abre.
  await instalarOlhoNoBau(ana)
  await tocar(ana, naTelaDoJogador(POS_BAU))
  await expect(ana.getByText('Chegue mais perto para abrir.'), 'tocar o baú de longe deveria dizer para chegar perto').toBeVisible({ timeout: ESPERA })
  await expect(ana.locator('.lb-abrir'), 'de longe o minigame não abre').toHaveCount(0)
  await arrastar(ana, naTelaDoJogador(ANA_LONGE), naTelaDoJogador(ANA_ENCOSTADA))
  await expect
    .poll(async () => JSON.parse(await mestre.evaluate(async (id) => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((nome) => new URL(nome).pathname === '/src/stores/mapStore.ts') ?? '/src/stores/mapStore.ts'
      const modulo: typeof import('/src/stores/mapStore.ts') = await import(/* @vite-ignore */ url)
      const t = modulo.useMapStore.getState().map.tokens.find((token) => token.id === id)
      return JSON.stringify(t === undefined ? null : { x: t.x, y: t.y })
    }, ID_TOKEN)), { message: 'a ficha arrastada deveria chegar ao lado do baú no mapa do mestre', timeout: ESPERA })
    .toEqual({ x: ANA_ENCOSTADA.x, y: ANA_ENCOSTADA.y })
  await tocar(ana, naTelaDoJogador(POS_BAU))
  const jogo = ana.locator('.lb-abrir')
  await expect(jogo, 'encostada, tocar o baú deveria abrir o minigame na tela da jogadora').toBeVisible({ timeout: ESPERA })
  await expect(jogo).toHaveAttribute('aria-label', 'Abrir: Abrir o baú')
  const comecar = jogo.getByRole('button', { name: 'Começar' })
  await expect(comecar, 'o minigame deveria abrir no cartão "Começar"').toBeVisible()
  const fioNoJogo = (rede.enviados.get('c1') ?? []).join('\n')
  expect(fioNoJogo, 'o mestre deveria ter mandado o objeto.jogo').toContain('"objeto.jogo"')
  for (const segredo of [POCAO.nome, CHAVE.nome, 'cobra', 'conteudo']) expect(fioNoJogo, `"${segredo}" não pode ir ao jogador com o jogo aberto, antes de vencer`).not.toContain(segredo)

  // Joga: teclado de verdade, com a tela medida do "Começar" ao cartão do resultado.
  await comecarMedida(ana)
  await comecar.click()
  const tentativas = await jogarOBau(ana)

  // 4. Venceu. Na jogadora: a cobra (susto) e o cartão; no mestre, ao mesmo tempo: o aviso com "Ver" e a página Jogos.
  const narrador = jogo.locator('.ab-sr')
  const naJogadora = (async () => {
    await expect(narrador, 'depois da vitória a cobra deveria saltar (jumpscare)').toHaveText(FRASE_DO_SUSTO.cobra, { timeout: ESPERA })
    await foto(ana, '02-jumpscare-da-cobra.png')
    const cartao = jogo.locator('.ab-cartao')
    await expect(cartao.getByRole('heading', { name: 'Abriu!' }), 'depois do susto deveria vir o cartão "Abriu!"').toBeVisible({ timeout: ESPERA })
    await expect(cartao.locator('.ab-armadilha')).toHaveText(LINHA_DA_COBRA)
    await expect(cartao.getByRole('list', { name: 'Itens' }).getByRole('listitem')).toHaveText([`${POCAO.nome}×1`, `${CHAVE.nome}×1`])
    const medida = await pararMedida(ana)
    await foto(ana, '03-cartao-do-resultado.png')
    return medida
  })()
  const noMestre = (async () => {
    const aviso = mestre.locator('.lb-toast').filter({ hasText: `${ANA} abriu o Baú` })
    await expect(aviso, 'o mestre deveria ver o aviso "Ana abriu o Baú"').toBeVisible({ timeout: ESPERA })
    await expect(aviso).toContainText(`Levou ${POCAO.nome} e ${CHAVE.nome}. ${LINHA_DA_COBRA}`)
    await aviso.getByRole('button', { name: 'Ver' }).click()
    await expect(mestre.getByRole('heading', { name: /Baús, caixas e barris/ }), '"Ver" deveria abrir a página Jogos').toBeVisible({ timeout: ESPERA })
    const aoVivo = mestre.getByRole('list', { name: 'Abertos agora' })
    await expect(aoVivo, 'a página Jogos deveria listar a abertura ao vivo').toContainText(`${ANA} abriu o Baú`)
    await expect(aoVivo).toContainText(LINHA_DA_COBRA)
    return (await aoVivo.innerText()).replace(/\s+/g, ' ').trim()
  })()
  const [medida, linhaAoVivo] = await Promise.all([naJogadora, noMestre])
  console.log(`[bau] tentativas ${tentativas}; ao vivo: ${linhaAoVivo}`)
  console.log(`[medida] ${medida.quadros} quadros, p95 ${medida.p95.toFixed(1)} ms, maior quadro ${medida.maiorQuadro.toFixed(1)} ms; ${medida.tarefasLongas} tarefas longas, a maior ${medida.maiorTarefa.toFixed(1)} ms`)
  expect(medida.quadros, 'a medida deveria ter visto quadros durante o minigame').toBeGreaterThan(60)
  expect(medida.p95, 'p95 do quadro na tela da jogadora durante o minigame').toBeLessThan(TRAVADA_MS)
  expect(medida.maiorTarefa, 'a maior tarefa longa na tela da jogadora durante o minigame').toBeLessThan(TRAVADA_MS)

  // No mestre: a mochila da FICHA DE PERSONAGEM, a pastilha com prazo na ficha do mapa, o baú marcado aberto e a vida no Grupo.
  const depois = await lerEditor(mestre)
  expect(depois.mochila, 'os 2 itens deveriam ir para a mochila da ficha de personagem').toEqual([
    { nome: POCAO.nome, quantidade: 1, itemId: POCAO.id },
    { nome: CHAVE.nome, quantidade: 1, itemId: CHAVE.id },
  ])
  expect(depois.condicoes, 'a ficha do mapa deveria ganhar a pastilha Envenenado').toContain('envenenado')
  expect(depois.prazos).toEqual([{ nome: 'Envenenado', turnos: 3, porVez: 4 }])
  expect(depois.bau?.aberto, 'o baú deveria ficar marcado aberto por Ana').toBe(ANA)
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  await expect(vidaNoGrupo, 'a picada deveria tirar 8 PV na ficha (Grupo)').toContainText(`${VIDA_MAXIMA - 8}/${VIDA_MAXIMA} PV`, { timeout: ESPERA })
  await expect(vidaNoGrupo.locator('.gr-vida-linha__cond'), 'o Grupo deveria mostrar a pastilha Envenenado com 3 turnos').toContainText('Envenenado, faltam 3 turnos')

  // Fecha o cartão; 6. o barril do mapa antigo (sem conteúdo nenhum) abre o minigame dele do mesmo jeito.
  await jogo.locator('.ab-cartao').getByRole('button', { name: 'Fechar' }).click()
  await expect(jogo, '"Fechar" deveria tirar o minigame da tela').toHaveCount(0, { timeout: ESPERA })
  await tocar(ana, naTelaDoJogador(POS_BARRIL))
  await expect(jogo, 'o barril do mapa antigo deveria abrir o minigame dele').toBeVisible({ timeout: ESPERA })
  await expect(jogo).toHaveAttribute('aria-label', 'Abrir: Quebrar o barril')
  await expect(jogo.getByRole('button', { name: 'Começar' })).toBeVisible()
  await ana.keyboard.press('Escape')
  await expect(jogo, 'Esc deveria fechar o minigame do barril').toHaveCount(0, { timeout: ESPERA })

  // 5. "Passar turno" no topo do Grupo, fora da batalha: o veneno tira 4 PV e desconta 1 turno (3 -> 2).
  const turno = mestre.getByRole('region', { name: 'Turno fora da batalha' })
  await turno.getByRole('button', { name: 'Passar turno' }).click()
  await expect(vidaNoGrupo, '"Passar turno" deveria tirar os 4 PV do veneno').toContainText(`${VIDA_MAXIMA - 12}/${VIDA_MAXIMA} PV`, { timeout: ESPERA })
  await expect(vidaNoGrupo.locator('.gr-vida-linha__cond'), '"Passar turno" deveria descontar 1 turno do Envenenado').toContainText('Envenenado, faltam 2 turnos')
  expect((await lerEditor(mestre)).prazos).toEqual([{ nome: 'Envenenado', turnos: 2, porVez: 4 }])
  await foto(mestre, '04-grupo-depois-de-passar-turno.png')

  expect(erros, 'nenhum erro de página no mestre nem na jogadora').toEqual([])
})

/** Mundo → tela do popup da Visão de jogador: a câmera de chegada do jogador, sobre o canvas do popup. */
async function naTelaDoPopup(popup: Page, p: Ponto): Promise<Ponto> {
  const caixa = await popup.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('régua: o canvas do popup não tem caixa')
  const c = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, { width: caixa.width, height: caixa.height }, FIT_MARGIN_JOGADOR)
  return { x: Math.round(caixa.x + p.x * c.scale + c.x), y: Math.round(caixa.y + p.y * c.scale + c.y) }
}

test('Visão de jogador sem mesa: o baú abre e é vencido no popup de teste, a cobra pica só no teste e o jogo de verdade não muda', async ({ page: mestre }) => {
  test.setTimeout(240_000)
  const erros: string[] = []
  mestre.on('pageerror', (erro) => erros.push(`mestre: ${erro.message}`))
  await mestreAbreAMesa(mestre, mapaComBauCheio(), false)
  await expect(mestre.getByRole('button', { name: 'Abrir mesa online' }), 'a jornada é sem sala: "Abrir mesa online" deveria estar à vista').toBeVisible()

  // A janela de teste, pela ficha da Lanterna (encostada no baú cheio).
  await mestre.getByRole('button', { name: /Visão de jogador/ }).click()
  const escolha = mestre.getByRole('dialog', { name: 'Escolher a ficha' })
  await expect(escolha, 'o botão "Visão de jogador" não abriu a escolha da ficha').toBeVisible({ timeout: ESPERA })
  const [popup] = await Promise.all([mestre.waitForEvent('popup'), escolha.getByRole('option', { name: new RegExp(`^${TOKEN_ANA},`) }).click()])
  popup.on('pageerror', (erro) => erros.push(`popup: ${erro.message}`))
  await popup.waitForLoadState('domcontentloaded')
  const barra = popup.locator('header.vj-barra')
  await expect(barra, 'a barra do teste não apareceu no popup').toBeVisible({ timeout: ESPERA })
  await expect(barra.getByRole('radio', { name: 'Jogar' }), 'aberta pelo livro, a janela de teste nasce em Jogar').toHaveAttribute('aria-checked', 'true')
  await expect(popup.locator('canvas').first()).toBeVisible({ timeout: ESPERA })

  // Toca o baú no popup: o minigame abre debaixo da barra do teste; joga pelo teclado do popup.
  await instalarOlhoNoBau(popup)
  await tocar(popup, await naTelaDoPopup(popup, POS_BAU))
  const jogo = popup.locator('.lb-abrir')
  await expect(jogo, 'tocar o baú no popup de teste deveria abrir o minigame').toBeVisible({ timeout: ESPERA })
  await expect(jogo).toHaveAttribute('aria-label', 'Abrir: Abrir o baú')
  await jogo.getByRole('button', { name: 'Começar' }).click()
  const tentativas = await jogarOBau(popup)
  await expect(jogo.locator('.ab-sr'), 'no teste a cobra também salta').toHaveText(FRASE_DO_SUSTO.cobra, { timeout: ESPERA })
  const cartao = jogo.locator('.ab-cartao')
  await expect(cartao.getByRole('heading', { name: 'Abriu!' })).toBeVisible({ timeout: ESPERA })
  await expect(cartao.locator('.ab-armadilha')).toHaveText(LINHA_DA_COBRA)
  await expect(cartao.getByRole('list', { name: 'Itens' }).getByRole('listitem')).toHaveText([`${POCAO.nome}×1`, `${CHAVE.nome}×1`])
  await expect(barra, 'a barra do teste deveria continuar à vista no resultado').toBeVisible()
  console.log(`[visao de jogador] tentativas ${tentativas}`)

  // O jogo de verdade não muda: o baú do EDITOR segue fechado, a ficha sem veneno e a mochila da personagem vazia.
  await popup.waitForTimeout(1000)
  const editor = await lerEditor(mestre)
  expect(editor.bau?.aberto ?? null, 'o baú do editor não abre pela Visão de jogador').toBeNull()
  expect(editor.condicoes, 'a ficha do editor não ganha o Envenenado pela Visão de jogador').not.toContain('envenenado')
  expect(editor.mochila, 'a mochila da personagem do editor não muda pela Visão de jogador').toEqual([])
  expect(erros, 'nenhum erro de página no editor nem no popup').toEqual([])
})
