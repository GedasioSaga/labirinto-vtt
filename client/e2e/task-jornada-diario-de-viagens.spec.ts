// JORNADA DE USUÁRIO do DIÁRIO DE VIAGENS (G15) — escrita para SAIR VERMELHA
// no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (PEDIDOS.md, G15):
//   - no painel Jogo do mestre, um "Diário de viagens" com UMA LINHA POR
//     VIAGEM de jogador entre cenas, no formato "22:10 Ana: Salão → Cripta"
//     (hora, nome da ficha, cena de origem e cena de destino);
//   - a mais nova em cima;
//   - um botão "Desfazer" na ÚLTIMA viagem de cada jogador (e só nela), que
//     devolve a ficha à cena e à casa de onde ela saiu;
//   - só o mestre vê o diário: nada dele aparece na tela do jogador.
//
// ONDE ISSO MORRE HOJE: a aba Jogo (`components/RoomPanel.tsx:221`) só monta a
// seção "Grupo" (`components/PartySection.tsx`) e, abaixo, os cards de
// "Jogadores" (`RoomPanel.tsx:245`). A viagem aprovada ("Deixar ir") passa por
// `applyTransfer` (`App.tsx:453-455`) direto para
// `adventureStore.transferToken` (`stores/adventureStore.ts:536`), que troca a
// ficha de cena e não guarda registro nenhum: não há diário, nem hora da
// viagem, nem como desfazê-la.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (mesmo preparo de
// task-jornada-painel-do-grupo.spec.ts e task-jornada-viagem-do-jogador.spec.ts):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   Ana e Bruno são o `player.html` inteiro, cada um no próprio contexto de
//   navegador. Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo
//   WebSocket roteado vira `net:message` na página do mestre, e o `net_send`
//   do mestre volta ao socket do jogador por `exposeFunction`.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: duas cenas e o par de pinos de
//   viagem num `adventure.json`, aberto pelo menu "Carregar Mapa existente".
//   GESTO REAL NA AÇÃO SOB TESTE. Toque de ponteiro no pino (com pausa antes de
//   soltar), clique nos botões. Os únicos `evaluate` são o repasse do
//   transporte e a LEITURA de pixel (foto → canvas solto → contagem por cor).
//   PROVA NA TELA. Texto visível do diário (nome acessível da seção, linhas,
//   botão "Desfazer"); cena de cada jogador pela COR DO CHÃO (Salão verde-água,
//   Cripta magenta); ficha pela cor (Ana verde-limão, Bruno laranja) e a casa
//   dela pelo CENTRO da mancha verde-limão na tela da própria Ana.
//   HORA. A régua não mexe no relógio do navegador (congelar `Date` mexe no
//   toque e no longo-toque do app): anota a hora antes do "Deixar ir" e depois
//   da linha aparecer, e aceita qualquer "HH:MM" dessa janela.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o diário fica dentro do painel da aba Jogo (`#lb-rail-panel-room`) e é
//     um cabeçalho-botão "Diário de viagens" (ou "Diário") com `aria-controls`,
//     ou uma região/lista/grupo/tabela/log com esse nome acessível;
//   - cada viagem é um item de lista (`listitem`) ou linha de tabela (`row`)
//     cujo texto tem "HH:MM", depois "<ficha>: <origem> → <destino>" (seta
//     "→", "->", "⟶", "➜" ou "➔"; espaços livres entre as partes);
//   - a ficha de cada jogador tem o MESMO nome do jogador (Ana, Bruno), para
//     "nome da ficha" e "nome do jogador" não brigarem;
//   - "Desfazer" é um botão da linha cujo nome acessível começa com
//     "Desfazer"; se o app pedir confirmação, o botão que confirma chama
//     "Desfazer", "Confirmar", "Sim" ou "OK" (`CONFIRMAR_DESFAZER`);
//   - "a casa de onde saiu": o centro da ficha, na tela de Ana, a menos de meia
//     casa do centro medido antes da viagem (a câmera do jogador reencaixa a
//     cena ao trocar de mapa, e as duas cenas têm o mesmo tamanho).
//
// ACHADO AO CALIBRAR (22/09): duas fichas que viajam pelo MESMO pino chegam no
// mesmo ponto do pino par, uma exatamente em cima da outra — na tela de Ana, a
// ficha de Bruno cobre a dela inteira (0 px verde-limão). Não é desta feature;
// o controle confere cada ficha logo depois da própria viagem.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ana e Bruno viajam à Cripta pelo
// pino com "Deixar ir", cada um vê a Cripta, a linha do Grupo diz a Cripta e a
// ficha de Ana é achada onde a conta de câmera diz. Sem ele, o vermelho dos
// testes 2 a 5 poderia ser a infraestrutura, e não a feature ausente.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'DIAR01'
const J1 = 'Ana'
const J2 = 'Bruno'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'

/** Ficha com o nome do jogador: "22:10 Ana: …" é o nome da ficha E o do jogador. */
const TOKEN_J1 = J1
const TOKEN_J2 = J2
const ESCADA_A = 'Escada que desce'
const ESCADA_B = 'Escada que sobe'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const PASTA = 'C:/appdata/maps/map_vale'

// As duas cenas têm o MESMO tamanho: "encaixar a cena na tela" dá a mesma câmera nas duas.
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
const POS_J2: Ponto = { x: 820, y: 300 }
/** Pino do Salão LONGE da casa de Ana: devolver a ficha "ao pino" em vez de "à casa" não passa. */
const POS_ESCADA_A: Ponto = { x: 900, y: 440 }
const POS_ESCADA_B: Ponto = { x: 1700, y: 450 }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** Cabeça do pino: centro 23 px de mundo acima da ponta (`lib/pins.ts`); 31 acerta a cabeça e foge do token. */
const CABECA_DO_PINO = 31

/** Pixels mínimos para dizer "isto está na tela". */
const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/** Pixels máximos para dizer "isto NÃO está na tela" (antisserrilhado e sombra). */
const RESIDUO = 25

const DIARIO = /^Diário( de viagens)?$/i
const SETA = '\\s*(→|->|⟶|➜|➔)\\s*'
const DESFAZER = /^Desfazer\b/i
const CONFIRMAR_DESFAZER = /^(desfazer|confirmar|sim|ok)$/i
const HORA = /\d{1,2}:\d{2}/
const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: duas cenas ligadas por um par de pinos de viagem
// ───────────────────────────────────────────────────────────────────────────

function pino(id: string, p: Ponto, description: string, destino: NonNullable<Pin['destino']>): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description, image: null, destino }
}

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function cena(id: string, nome: string, chao: string, tokens: Token[], pins: Pin[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    tokens,
    pins,
  }
}

function discoDaAventura(): Record<string, string> {
  const cenaA = cena(
    'map_vale',
    AVENTURA,
    CHAO_A,
    [token('tok-ana', TOKEN_J1, POS_J1, COR_J1), token('tok-bruno', TOKEN_J2, POS_J2, COR_J2)],
    [pino('pin-a-escada', POS_ESCADA_A, ESCADA_A, { sceneId: ID_CENA_B, pinId: 'pin-b-escada' })],
  )
  const cenaB = cena('map_cripta', CENA_B, CHAO_B, [], [pino('pin-b-escada', POS_ESCADA_B, ESCADA_B, { sceneId: ID_CENA_A, pinId: 'pin-a-escada' })])
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
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

function painelJogo(mestre: Page): Locator {
  return mestre.locator('#lb-rail-panel-room')
}

/** Card de hoje em "Jogadores". */
function cardDeJogador(mestre: Page, jogador: string): Locator {
  return painelJogo(mestre).locator('.lb-field').filter({ hasText: `${jogador} —` })
}

/** Aba Jogo, card do jogador, "Atribuir <token>" — o clique de um toque que o painel oferece. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDoToken: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const card = cardDeJogador(mestre, jogador)
  await card.getByRole('button', { name: `Atribuir ${nomeDoToken}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDoToken}` }), `${jogador} deveria ficar com ${nomeDoToken}`).toBeVisible()
}

/** A linha do jogador na seção "Grupo" (G1, que já existe): a cena que ele está, em texto. */
function linhaDoGrupo(mestre: Page, jogador: string): Locator {
  return painelJogo(mestre).getByRole('region', { name: 'Grupo', exact: true }).getByRole('listitem').filter({ hasText: jogador })
}

/**
 * O diário de viagens da aba Jogo. Aceita um cabeçalho-botão com
 * `aria-controls` (como "Cenas"), aberto se estiver fechado, ou uma
 * região/lista/grupo/tabela/log com nome acessível "Diário de viagens".
 */
async function secaoDiario(mestre: Page): Promise<Locator> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = painelJogo(mestre)
  await expect(painel.getByText(CODIGO).first(), 'a aba Jogo deveria estar aberta, com a sala').toBeVisible({ timeout: ESPERA })
  const cabecalho = painel.getByRole('button', { name: DIARIO })
  if ((await cabecalho.count()) > 0) {
    if ((await cabecalho.first().getAttribute('aria-expanded')) === 'false') await cabecalho.first().click()
    const corpo = await cabecalho.first().getAttribute('aria-controls')
    if (corpo) return mestre.locator(`[id="${corpo}"]`)
  }
  const secao = painel
    .getByRole('region', { name: DIARIO })
    .or(painel.getByRole('list', { name: DIARIO }))
    .or(painel.getByRole('group', { name: DIARIO }))
    .or(painel.getByRole('table', { name: DIARIO }))
    .or(painel.getByRole('log', { name: DIARIO }))
    .first()
  await expect(secao, 'a aba Jogo deveria ter um "Diário de viagens" (cabeçalho ou região/lista/log com esse nome)').toBeVisible({ timeout: ESPERA })
  return secao
}

/** As linhas de viagem do diário, na ordem da tela (cabeçalho de tabela fica de fora: não tem hora). */
function linhasDoDiario(secao: Locator): Locator {
  return secao.getByRole('listitem').or(secao.getByRole('row')).filter({ hasText: HORA })
}

function textoDaViagem(ficha: string, de: string, para: string): RegExp {
  return new RegExp(`${escapar(ficha)}\\s*:\\s*${escapar(de)}${SETA}${escapar(para)}`)
}

function linhaDaViagem(secao: Locator, ficha: string, de: string, para: string): Locator {
  return linhasDoDiario(secao).filter({ hasText: textoDaViagem(ficha, de, para) })
}

/** Todo "HH:MM" entre `antes` e `depois` (inclusive), na hora local desta máquina — a mesma do navegador. */
function horasDaJanela(antes: Date, depois: Date): string[] {
  const horas: string[] = []
  const t = new Date(antes)
  t.setSeconds(0, 0)
  while (t.getTime() <= depois.getTime()) {
    horas.push(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`)
    t.setMinutes(t.getMinutes() + 1)
  }
  return horas
}

/** "Desfazer" da linha, com a confirmação se o app pedir uma. */
async function desfazer(mestre: Page, linha: Locator, oQue: string): Promise<void> {
  const botao = linha.getByRole('button', { name: DESFAZER })
  await expect(botao, `${oQue}: a linha deveria ter o botão "Desfazer"`).toBeVisible({ timeout: ESPERA })
  await botao.click()
  const confirmar = mestre.getByRole('dialog').getByRole('button', { name: CONFIRMAR_DESFAZER })
  try {
    await confirmar.first().waitFor({ state: 'visible', timeout: 1500 })
    await confirmar.first().click()
  } catch {
    // Sem confirmação: o clique já desfez.
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Os jogadores: player.html inteiro, cada um no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  clientId: string
  nome: string
  /** Todo frame que a PÁGINA recebeu no WebSocket (a escuta é a própria rota). */
  frames: string[]
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

interface Mesa {
  rede: Rede
  ana: Jogador
  bruno: Jogador
}

/** Mestre abre a aventura e a sala; Ana e Bruno entram e recebem a ficha de cada um. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', J2)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestreAtribui(mestre, J2, TOKEN_J2)
  for (const j of [ana, bruno]) await esperaFichaPropria(j)
  return { rede, ana, bruno }
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
}

type Foto = Awaited<ReturnType<Page['screenshot']>>

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

/** Conta pixels por cor só onde o canvas PRINCIPAL (o maior) está por cima: avisos e cartões não contam. */
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
    const r = { limao: 0, laranja: 0, chaoA: 0, chaoB: 0, centroLimao: null as { x: number; y: number } | null }
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
          lx += x
          ly += y
        } else if (laranja) r.laranja += 1
        else if (verdeAgua) r.chaoA += 1
        else r.chaoB += 1
      }
    }
    if (r.limao > 0) r.centroLimao = { x: (lx / r.limao) * escalaX, y: (ly / r.limao) * escalaY }
    return r
  }, foto.toString('base64'))
}

async function lerTela(page: Page): Promise<Pixels> {
  await page.waitForTimeout(PINTURA_MS)
  return contarCores(page, await fotografar(page))
}

function fichaDe(p: Pixels, nome: string): number {
  return nome === J1 ? p.limao : p.laranja
}

/** Espera o mapa chegar e a ficha do próprio jogador aparecer pintada. */
async function esperaFichaPropria(j: Jogador): Promise<void> {
  await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu na tela`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => fichaDe(await lerTela(j.page), j.nome), { timeout: ESPERA_TELA, message: `${j.nome} deveria ver a própria ficha na tela` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
}

// ───────────────────────────────────────────────────────────────────────────
// A viagem aprovada de hoje (gestos da régua da viagem do jogador)
// ───────────────────────────────────────────────────────────────────────────

const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)
/** Meia casa, em px de tela do jogador: "a mesma casa". */
const MEIA_CASA = (GRADE * CAMERA.scale) / 2

function naTela(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round(p.y * CAMERA.scale + CAMERA.y) }
}

function cabecaDoPino(p: Ponto): Ponto {
  return naTela({ x: p.x, y: p.y - CABECA_DO_PINO })
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/**
 * Toca os pontos até o cartão do pino abrir, pede para passar, e o mestre
 * "Deixar ir". Termina quando a tela do jogador mostra o chão do destino.
 */
async function viagemAprovada(mestre: Page, j: Jogador, pontos: Ponto[], pinoDoPedido: string, destino: string): Promise<void> {
  const cartao = j.page.getByRole('dialog').filter({ hasText: pinoDoPedido })
  let achou = false
  for (const p of pontos) {
    await tocar(j.page, p)
    try {
      await cartao.waitFor({ state: 'visible', timeout: 1500 })
      achou = true
      break
    } catch {
      // Tocou fora da cabeça do pino: tenta o próximo ponto.
    }
  }
  expect(achou, `${j.nome}: tocar o pino deveria abrir o cartão "${pinoDoPedido}"`).toBe(true)
  await j.page.getByRole('button', { name: PEDIR_PARA_PASSAR }).click()
  await expect(j.page.getByText(PERGUNTA_DO_PEDIDO), `${j.nome}: pedir deveria perguntar "${PERGUNTA_DO_PEDIDO}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('button', { name: CONFIRMAR_PEDIDO }).filter({ hasNotText: PEDIR_PARA_PASSAR }).first().click()
  await expect(j.page.getByText(AGUARDANDO).first(), `${j.nome}: depois de confirmar deveria ler "Aguardando o mestre…"`).toBeVisible({ timeout: ESPERA })
  const aviso = new RegExp(`${j.nome}[^]*quer passar[^]*${escapar(pinoDoPedido)}[^]*${escapar(destino)}`)
  await expect(mestre.getByText(aviso).first(), `o mestre deveria ler "${j.nome} quer passar por ${pinoDoPedido} → ${destino}"`).toBeVisible({ timeout: ESPERA })
  await mestre.getByRole('button', { name: 'Deixar ir', exact: true }).click()
  const chaoDoDestino = (p: Pixels): number => (destino === CENA_B ? p.chaoB : p.chaoA)
  await expect
    .poll(async () => chaoDoDestino(await lerTela(j.page)), { timeout: ESPERA_TELA, message: `${j.nome} deveria passar a ver o chão de ${destino}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
}

/** Ida pelo pino do Salão. */
async function vaiACripta(mestre: Page, j: Jogador): Promise<void> {
  await viagemAprovada(mestre, j, [cabecaDoPino(POS_ESCADA_A)], ESCADA_A, CENA_B)
}

/** Volta pelo pino par: a ficha chega em cima dele (ou a uma casa); toca a cabeça do pino e as casas em volta da ficha. */
async function voltaAoSalao(mestre: Page, j: Jogador): Promise<void> {
  const tela = await lerTela(j.page)
  const pontos: Ponto[] = [cabecaDoPino(POS_ESCADA_B)]
  const ficha = tela.centroLimao
  if (ficha !== null) {
    const s = CAMERA.scale
    for (const dx of [0, -1, 1]) for (const dy of [0, -1, 1]) pontos.push({ x: ficha.x - dx * GRADE * s, y: ficha.y - dy * GRADE * s - CABECA_DO_PINO * s })
  }
  await viagemAprovada(mestre, j, pontos, ESCADA_B, CENA_A)
}

/** Centro da ficha de Ana na tela dela, esperando a pintura assentar. */
async function centroDaFichaDeAna(ana: Jogador): Promise<Ponto> {
  await expect
    .poll(async () => (await lerTela(ana.page)).limao, { timeout: ESPERA_TELA, message: `${J1} deveria ver a própria ficha` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  const c = (await lerTela(ana.page)).centroLimao
  if (c === null) throw new Error(`${J1} sem ficha na tela`)
  return c
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana e Bruno viajam à Cripta pelo pino com "Deixar ir", a linha do Grupo diz a Cripta e a ficha de Ana é achada na casa dela', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  // A conta de câmera que o teste 4 usa acha a ficha de Ana na casa de partida.
  const antes = await centroDaFichaDeAna(ana)
  const esperado = naTela(POS_J1)
  expect(Math.hypot(antes.x - esperado.x, antes.y - esperado.y), `a ficha de ${J1} deveria estar na casa de partida (${esperado.x},${esperado.y})`).toBeLessThan(MEIA_CASA)

  // Cada um confere a própria ficha logo depois da PRÓPRIA viagem: os dois
  // chegam no mesmo ponto do pino par, e a ficha de quem chega depois cobre a
  // de quem chegou antes (medido em 22/09 — ver ACHADO no cabeçalho).
  for (const j of [ana, bruno]) {
    await vaiACripta(page, j)
    const tela = await lerTela(j.page)
    expect(fichaDe(tela, j.nome), `${j.nome} deveria ver a própria ficha na ${CENA_B}`).toBeGreaterThan(PIXELS_DE_TOKEN)
    expect(tela.chaoA, `${j.nome} foi à ${CENA_B} e continua vendo o ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)
    await expect(linhaDoGrupo(page, j.nome), `a linha de ${j.nome} no Grupo deveria dizer "${CENA_B}"`).toContainText(CENA_B, { timeout: ESPERA })
  }
})

test('2. uma viagem aprovada vira UMA linha "HH:MM Ana: Salão → Cripta" no diário do mestre, com Desfazer; o jogador não vê diário nenhum', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  const antes = new Date()
  await vaiACripta(page, ana)
  const secao = await secaoDiario(page)
  const linha = linhaDaViagem(secao, TOKEN_J1, CENA_A, CENA_B)
  await expect(linha, `o diário deveria ter UMA linha "${TOKEN_J1}: ${CENA_A} → ${CENA_B}"`).toHaveCount(1, { timeout: ESPERA })
  const depois = new Date()

  const horas = horasDaJanela(antes, depois)
  const comHora = new RegExp(`(^|\\D)(${horas.join('|')})\\s*${escapar(TOKEN_J1)}\\s*:\\s*${escapar(CENA_A)}${SETA}${escapar(CENA_B)}`)
  await expect(linha, `a linha deveria começar pela hora da viagem (uma de ${horas.join(', ')})`).toContainText(comHora)
  await expect(linhasDoDiario(secao), 'uma viagem só, uma linha só').toHaveCount(1)
  await expect(linha.getByRole('button', { name: DESFAZER }), 'a última (e única) viagem de Ana deveria ter "Desfazer"').toBeVisible()

  // Só o mestre vê: nem a tela nem o fio dos jogadores trazem o diário.
  for (const j of [ana, bruno]) {
    await expect(j.page.getByText(/Diário/i), `${j.nome} não deveria ver o diário`).toHaveCount(0)
    await expect(j.page.getByText(textoDaViagem(TOKEN_J1, CENA_A, CENA_B)), `${j.nome} não deveria ver a linha da viagem`).toHaveCount(0)
    expect(j.frames.filter((f) => /Di[aá]rio/i.test(f)), `nenhum frame recebido por ${j.nome} deveria trazer o diário`).toEqual([])
  }
})

test('3. a viagem mais nova fica em cima: Ana viaja, depois Bruno; a linha de Bruno vem primeiro e as duas têm Desfazer', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  await vaiACripta(page, ana)
  await vaiACripta(page, bruno)

  const secao = await secaoDiario(page)
  const linhas = linhasDoDiario(secao)
  await expect(linhas, 'duas viagens, duas linhas no diário').toHaveCount(2, { timeout: ESPERA })
  await expect(linhas.nth(0), `a linha de cima deveria ser a de ${J2}, a mais nova`).toContainText(textoDaViagem(TOKEN_J2, CENA_A, CENA_B))
  await expect(linhas.nth(1), `a segunda linha deveria ser a de ${J1}`).toContainText(textoDaViagem(TOKEN_J1, CENA_A, CENA_B))
  // Cada uma é a última viagem do próprio jogador.
  await expect(linhas.nth(0).getByRole('button', { name: DESFAZER }), `a última viagem de ${J2} deveria ter "Desfazer"`).toBeVisible()
  await expect(linhas.nth(1).getByRole('button', { name: DESFAZER }), `a última viagem de ${J1} deveria ter "Desfazer"`).toBeVisible()
})

test('4. "Desfazer" na viagem de Ana devolve a ficha ao Salão, na casa de onde saiu: Ana vê o Salão, Bruno volta a vê-la e o Grupo diz Salão', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  const casaDePartida = await centroDaFichaDeAna(ana)
  await vaiACripta(page, ana)
  // Controle (verde hoje): a ficha de Ana sumiu da tela de Bruno, que ficou no Salão.
  await expect
    .poll(async () => (await lerTela(bruno.page)).limao, { timeout: ESPERA_TELA, message: `a ficha de ${J1} deveria sumir da tela de ${J2}` })
    .toBeLessThanOrEqual(RESIDUO)

  const secao = await secaoDiario(page)
  await desfazer(page, linhaDaViagem(secao, TOKEN_J1, CENA_A, CENA_B), `viagem de ${J1}`)

  await expect
    .poll(async () => (await lerTela(ana.page)).chaoA, { timeout: ESPERA_TELA, message: `depois do "Desfazer", ${J1} deveria voltar a ver o chão do ${CENA_A}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  const telaDeAna = await lerTela(ana.page)
  expect(telaDeAna.chaoB, `depois do "Desfazer", ${J1} não deveria ver mais a ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  const agora = await centroDaFichaDeAna(ana)
  expect(
    Math.hypot(agora.x - casaDePartida.x, agora.y - casaDePartida.y),
    `a ficha de ${J1} deveria voltar à casa de onde saiu (${Math.round(casaDePartida.x)},${Math.round(casaDePartida.y)} na tela dela), não ao pino nem ao centro`,
  ).toBeLessThan(MEIA_CASA)

  await expect
    .poll(async () => (await lerTela(bruno.page)).limao, { timeout: ESPERA_TELA, message: `${J2}, no ${CENA_A}, deveria voltar a ver a ficha de ${J1}` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  await expect(linhaDoGrupo(page, J1), `depois do "Desfazer", a linha de ${J1} no Grupo deveria dizer "${CENA_A}"`).toContainText(CENA_A, { timeout: ESPERA })
  await expect(linhaDoGrupo(page, J1)).not.toContainText(CENA_B)
})

test('5. só a ÚLTIMA viagem de cada jogador tem Desfazer: Ana vai à Cripta e volta; a volta (em cima) tem, a ida (embaixo) não', async ({ browser, page, baseURL }) => {
  test.setTimeout(300_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  await vaiACripta(page, ana)
  await voltaAoSalao(page, ana)

  const secao = await secaoDiario(page)
  const linhas = linhasDoDiario(secao)
  await expect(linhas, 'ida e volta, duas linhas no diário').toHaveCount(2, { timeout: ESPERA })
  await expect(linhas.nth(0), 'a linha de cima deveria ser a volta, a mais nova').toContainText(textoDaViagem(TOKEN_J1, CENA_B, CENA_A))
  await expect(linhas.nth(1), 'a linha de baixo deveria ser a ida').toContainText(textoDaViagem(TOKEN_J1, CENA_A, CENA_B))
  await expect(linhas.nth(0).getByRole('button', { name: DESFAZER }), 'a volta é a última viagem de Ana: deveria ter "Desfazer"').toBeVisible()
  await expect(linhas.nth(1).getByRole('button', { name: DESFAZER }), 'a ida não é mais a última viagem de Ana: não deveria ter "Desfazer"').toHaveCount(0)
})
