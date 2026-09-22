// JORNADA DE USUÁRIO da CHEGADA OCULTA, DE MÃO ÚNICA (G9 do PEDIDOS.md) —
// escrita para SAIR VERMELHA no código de hoje. É a régua da feature, não a
// feature.
//
// A FEATURE:
//   - no painel do pino de viagem, ao ligar ou depois de ligar, o mestre marca
//     "Mão única". O pino de chegada (o par, na outra cena) vira uma CHEGADA
//     OCULTA:
//       - não é desenhado para a jogadora: nem pixel da cabeça do pino no mapa
//         dela, nem cartão ao tocar ali;
//       - não leva de volta: no mestre ele tem desenho próprio e o painel dele
//         diz "Só chegada";
//       - o pino de origem continua funcionando: a jogadora pede, o mestre
//         deixa e ela chega no ponto da chegada oculta;
//   - desmarcar "Mão única" volta ao par de hoje, visível e de mão dupla.
//
// ONDE ISSO MORRE HOJE: o painel (`components/PinTravelControls.tsx`) só tem
// "Leva a…"/"Trocar destino"/"Desligar"/"Ir" e os três modos de passagem; o
// `Pin` (`types/map.ts`) não tem marca de mão única; o recorte da jogadora
// (`net/hostSession.ts`) manda todo pino de viagem da cena, com id.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (o mesmo preparo de
// `task-jornada-viagem-do-jogador.spec.ts` e `task-jornada-encruzilhada.spec.ts`):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página; a
//   jogadora é o `player.html` inteiro no próprio contexto de navegador. Só o
//   TRANSPORTE Rust é falsificado: o que ela manda pelo WebSocket vira o evento
//   `net:message` na página do mestre (com `JSON.parse` do que chegou), e o
//   `net_send` do mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA. Duas cenas — Salão (verde-água) e
//   Cripta Rubra (magenta) — num `adventure.json` do disco falso. O pino do
//   Salão já vem ligado ao par na Cripta, em mão dupla, pelo disco; a "Mão
//   única" o mestre marca pelo PAINEL, com gesto real.
//   GESTO REAL NA AÇÃO SOB TESTE. Clique e toque pelo ponteiro, teclado de
//   verdade. Os únicos `evaluate` são o do transporte e LEITURAS (pixel,
//   `elementFromPoint`, e se o controle "Mão única" está marcado).
//   PROVA NA TELA. Texto visível; a cena que a jogadora vê é lida pela COR DO
//   CHÃO no canvas dela, e o pino par pelo LATÃO do aro e do símbolo da cabeça
//   do pino de viagem (`pixi/drawPins.ts`: 0xf2c14e sobre a cabeça escura),
//   contado numa caixa em volta da ficha dela, onde ela chegou.
//   FRAMES. A rota do WebSocket anota tudo que a página da jogadora recebeu: o
//   id do par (`pin-b-fundo`) não pode passar por lá com a mão única marcada.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - "Mão única" é um controle do painel do pino de viagem com esse nome
//     acessível: caixa de marcar, chave (`switch`) ou botão de alternar
//     (`aria-pressed`); o clique nele marca e desmarca;
//   - o painel do par, na Cripta, abre pelo gesto de hoje (lista Cenas →
//     Cripta Rubra → ferramenta Pino → clique na cabeça do pino, que continua
//     no mesmo lugar no mestre) e tem um título com "pino de viagem" ou
//     "chegada"; a frase "Só chegada" aparece dentro dele;
//   - a ficha chega em cima do pino par ou a uma casa dele (`arrivalSpot` de
//     hoje): a cabeça do pino fica a até duas casas da ficha.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Sem ele, o vermelho dos testes 2 a 5
// poderia ser a infraestrutura quebrada — ele também prova que a leitura de
// latão enxerga o par e que a escuta de frames ouve a Cripta (e o id do par).
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { PIN_HEAD_OFFSET } from '../src/lib/pins'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'OCUL01'
const J1 = 'Ana'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'

const TOKEN_J1 = 'Lanterna'
/** O pino de origem, no Salão. */
const ALCAPAO = 'Alcapao do salao'
/** O par dele na Cripta: vira a chegada oculta com a mão única. */
const PAR_NA_CRIPTA = 'Fundo do alcapao'
const ID_DO_PAR = 'pin-b-fundo'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const PASTA = 'C:/appdata/maps/map_vale'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx. */
const FIT_MARGIN_JOGADOR = 24
/** Igual a `FIT_MARGIN` do enquadramento de abertura em pixi/PixiCanvas.tsx. */
const FIT_MARGIN_MESTRE = 40

/** Chão de cada cena: é por ele que a régua sabe qual cena está na tela da jogadora. */
const CHAO_A = '#1e8c8c'
const CHAO_B = '#8c1e8c'
const COR_J1 = '#3cff00'

type Ponto = { x: number; y: number }

const POS_J1: Ponto = { x: 700, y: 300 }
const POS_ALCAPAO: Ponto = { x: 900, y: 440 }
const POS_PAR_NA_CRIPTA: Ponto = { x: 1000, y: 300 }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** Cabeça do pino na tela da jogadora: 31 px de mundo acima da ponta acerta a cabeça e foge do token. */
const CABECA_DO_PINO_JOGADOR = 31

const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/** Latão mínimo para dizer "a cabeça do pino de viagem está ali" (aro + símbolo). */
const PIXELS_DE_CABECA = 15
/** Pixels máximos para dizer "isto NÃO está na tela" (antisserrilhado e sombra). */
const RESIDUO = 25
/** Latão máximo para dizer "não há cabeça de pino ali": bem abaixo do que uma cabeça pinta. */
const RESIDUO_DE_LATAO = 4

const FERRAMENTA_PINO = 'Pino'
const TITULO_DO_PAINEL = /pino de viagem/i
const TITULO_DO_PAINEL_DO_PAR = /pino de viagem|chegada/i
const MAO_UNICA = /Mão única/i
const SO_CHEGADA = /Só chegada/i

const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/
const VOCE_CHEGOU = /Você chegou/
const DEIXAR_IR = 'Deixar ir'

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: duas cenas; o pino do Salão já leva à Cripta, em mão dupla
// ───────────────────────────────────────────────────────────────────────────

function pino(id: string, p: Ponto, kind: Pin['kind'], description: string, destino?: Pin['destino']): Pin {
  const base: Pin = { id, x: p.x, y: p.y, kind, description, image: null }
  return destino === undefined ? base : { ...base, destino }
}

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

/** Quatro paredes no contorno do mundo: fazem o enquadramento do editor ser o mundo inteiro. */
function contorno(prefixo: string): Wall[] {
  const lado = (sufixo: string, x1: number, y1: number, x2: number, y2: number): Wall => ({
    id: `${prefixo}-${sufixo}`,
    x1,
    y1,
    x2,
    y2,
    blocksLight: true,
    blocksMove: true,
    door: null,
  })
  return [
    lado('n', 0, 0, LARGURA, 0),
    lado('l', LARGURA, 0, LARGURA, ALTURA),
    lado('s', LARGURA, ALTURA, 0, ALTURA),
    lado('o', 0, ALTURA, 0, 0),
  ]
}

function cena(id: string, nome: string, chao: string, tokens: Token[], pins: Pin[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    walls: contorno(id),
    tokens,
    pins,
  }
}

const MAPA_A = cena(
  'map_vale',
  AVENTURA,
  CHAO_A,
  [token('tok-lanterna', TOKEN_J1, POS_J1, COR_J1)],
  [pino('pin-a-alcapao', POS_ALCAPAO, 'viagem', ALCAPAO, { sceneId: ID_CENA_B, pinId: ID_DO_PAR })],
)
/** A Cripta só tem o par: todo latão de pino na tela dela, ali, é dele. */
const MAPA_B = cena('map_cripta', CENA_B, CHAO_B, [], [
  pino(ID_DO_PAR, POS_PAR_NA_CRIPTA, 'viagem', PAR_NA_CRIPTA, { sceneId: ID_CENA_A, pinId: 'pin-a-alcapao' }),
])

function discoDaAventura(): Record<string, string> {
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
    [`${PASTA}/map.json`]: serializeMap(MAPA_A),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_CENA_B}/map.json`]: serializeMap(MAPA_B),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco de mentira e transporte de mentira
// (o mesmo preparo de task-jornada-modos-do-pino.spec.ts)
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

/** Aba Jogo, card do jogador, "Atribuir <token>". */
async function mestreAtribui(mestre: Page, jogador: string, nomeDoToken: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = mestre.locator('#lb-rail-panel-room')
  const card = painel.locator('.lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${nomeDoToken}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDoToken}` }), `${jogador} deveria ficar com ${nomeDoToken}`).toBeVisible()
}

// ───────────────────────────────────────────────────────────────────────────
// O painel do pino no mestre: ferramenta Pino, clique na cabeça
// ───────────────────────────────────────────────────────────────────────────

/** Onde a cabeça de um pino está na tela do mestre, com o enquadramento de abertura da cena. */
async function cabecaNoMestre(mestre: Page, mapa: MapData, p: Ponto): Promise<Ponto> {
  const caixa = await mestre.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('régua: o canvas do mestre não tem caixa')
  const limites = contentBounds(mapa)
  if (!limites) throw new Error('régua: a cena não tem conteúdo para o editor enquadrar')
  const camera = fitCamera(limites, { width: caixa.width, height: caixa.height }, FIT_MARGIN_MESTRE)
  return {
    x: caixa.x + p.x * camera.scale + camera.x,
    y: caixa.y + (p.y - PIN_HEAD_OFFSET) * camera.scale + camera.y,
  }
}

/** Desce, fica parado um instante, sobe — sem mover. O toque tem de cair no MAPA, não num painel. */
async function tocarNoMapa(page: Page, p: Ponto): Promise<void> {
  const quem = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? 'nada', p)
  expect(quem, `régua: o ponto (${Math.round(p.x)}, ${Math.round(p.y)}) não está sobre o mapa, está sobre ${quem}`).toBe('CANVAS')
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Nomes acessíveis dos controles do painel — só para a mensagem de falha ajudar quem implementa. */
async function controlesDoPainel(painel: Locator): Promise<string> {
  const nomes = await painel
    .locator('button, input, select, textarea, [role="radio"], [role="group"], [role="combobox"], [role="textbox"]')
    .evaluateAll((elementos) => elementos.map((e) => e.getAttribute('aria-label') ?? e.textContent?.trim() ?? '').filter((n) => n !== ''))
  return nomes.join(' | ')
}

/** Ferramenta Pino na mão e clique na cabeça de um pino da cena aberta: o painel dele abre no rail. */
async function mestreAbrePainelDoPino(mestre: Page, mapa: MapData, onde: Ponto, titulo: RegExp, oQue: string): Promise<Locator> {
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await mestre.getByRole('button', { name: FERRAMENTA_PINO, exact: true }).click()
  await tocarNoMapa(mestre, await cabecaNoMestre(mestre, mapa, onde))
  const cabecalho = mestre.getByRole('heading', { name: titulo }).first()
  await expect(cabecalho, `${oQue}: clicar no pino com a ferramenta Pino deveria abrir o painel dele (título ${String(titulo)})`).toBeVisible({ timeout: ESPERA })
  return cabecalho.locator('xpath=ancestor::*[self::section or @role="region" or @role="dialog"][1]')
}

/** O controle "Mão única" do painel, em qualquer papel plausível de alternar. */
function controleMaoUnica(painel: Locator): Locator {
  return painel
    .getByRole('checkbox', { name: MAO_UNICA })
    .or(painel.getByRole('switch', { name: MAO_UNICA }))
    .or(painel.getByRole('button', { name: MAO_UNICA }))
    .first()
}

/** LEITURA do estado que a tela mostra: marcado (caixa, chave ou botão pressionado). */
async function estaMarcado(controle: Locator): Promise<boolean> {
  return controle.evaluate(
    (el) => (el instanceof HTMLInputElement && el.checked) || el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true',
  )
}

/** Abre o painel do alçapão (no Salão) e deixa "Mão única" como pedido, com um clique. */
async function mestreDefineMaoUnica(mestre: Page, marcar: boolean): Promise<void> {
  const oQue = marcar ? 'o mestre marca "Mão única"' : 'o mestre desmarca "Mão única"'
  const painel = await mestreAbrePainelDoPino(mestre, MAPA_A, POS_ALCAPAO, TITULO_DO_PAINEL, oQue)
  const controle = controleMaoUnica(painel)
  await expect(controle, `${oQue}: o painel do pino de viagem deveria ter "Mão única". Controles do painel hoje: ${await controlesDoPainel(painel)}`).toBeVisible({ timeout: ESPERA })
  if ((await estaMarcado(controle)) !== marcar) await controle.click({ timeout: ESPERA })
  await expect.poll(() => estaMarcado(controle), { timeout: ESPERA, message: `${oQue}: o controle deveria ficar ${marcar ? 'marcado' : 'desmarcado'}` }).toBe(marcar)
}

/** Lista Cenas → Cripta Rubra: o editor do mestre abre a Cripta. */
async function mestreAbreCripta(mestre: Page): Promise<void> {
  const lista = await secaoCenas(mestre)
  await entradaDaCena(lista, CENA_B).click()
  await expect.poll(() => estaDestacada(entradaDaCena(lista, CENA_B)), { timeout: ESPERA, message: `clicar em "${CENA_B}" na lista deveria abrir a cena` }).toBe(true)
}

// ───────────────────────────────────────────────────────────────────────────
// A jogadora: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  clientId: string
  /** Todo frame que a PÁGINA recebeu no WebSocket (anotado pela própria rota). */
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
  return { page, clientId, frames }
}

/** Mestre abre a aventura e a sala; Ana entra e recebe a Lanterna; o mestre volta ao mapa. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<{ rede: Rede; ana: Jogador }> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await expect(ana.page.locator('canvas').first(), `${J1}: o mapa não apareceu na tela da jogadora`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerTela(ana.page)).fichaAna, { timeout: ESPERA_TELA, message: `${J1}: a ficha dela não foi pintada` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  return { rede, ana }
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos e leitura da tela da jogadora
// ───────────────────────────────────────────────────────────────────────────

const CAMERA_JOGADOR = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN_JOGADOR)

function naTelaDoJogador(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.x), y: Math.round(p.y * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.y) }
}

function cabecaNoJogador(p: Ponto): Ponto {
  return naTelaDoJogador({ x: p.x, y: p.y - CABECA_DO_PINO_JOGADOR })
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Retângulo da tela, em px CSS. */
type Caixa = { x0: number; y0: number; x1: number; y1: number }

interface Tela {
  fichaAna: number
  /** Chão do Salão (verde-água) e da Cripta (magenta), iluminado ou lembrado. */
  chaoSalao: number
  chaoCripta: number
  /** Latão da cabeça de pino de viagem (aro e símbolo) DENTRO da caixa pedida; 0 sem caixa. */
  latao: number
  centroDaFichaDeAna: Ponto | null
}

/**
 * Fotografa a tela da jogadora e conta pixels por cor, só onde o CANVAS está por
 * cima (painéis e cartões não contam). Leitura pura: decodifica a foto num
 * canvas solto e pergunta `elementFromPoint`.
 */
async function lerTela(page: Page, caixa: Caixa | null = null): Promise<Tela> {
  let foto: Awaited<ReturnType<Page['screenshot']>> | null = null
  for (let tentativa = 1; tentativa <= 3 && foto === null; tentativa += 1) {
    try {
      foto = await page.screenshot()
    } catch {
      await page.waitForTimeout(200)
    }
  }
  if (foto === null) throw new Error('não consegui fotografar a tela da jogadora')
  return page.evaluate(
    async ({ b64, caixa }) => {
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
      const naCaixa = (x: number, y: number): boolean => {
        if (caixa === null) return false
        const cx = x * escalaX
        const cy = y * escalaY
        return cx >= caixa.x0 && cx <= caixa.x1 && cy >= caixa.y0 && cy <= caixa.y1
      }
      const r: { fichaAna: number; chaoSalao: number; chaoCripta: number; latao: number; centroDaFichaDeAna: { x: number; y: number } | null } = {
        fichaAna: 0,
        chaoSalao: 0,
        chaoCripta: 0,
        latao: 0,
        centroDaFichaDeAna: null,
      }
      let sx = 0
      let sy = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          const limao = G > 200 && R > 20 && R < 120 && B < 60
          const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30 && G >= 35
          const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
          // Latão do pino (0xf2c14e = 242,193,78): vermelho alto, verde médio-alto,
          // azul baixo. Não pega o limão (R baixo), o magenta (G baixo) nem o anel azul.
          const latao = R > 190 && G > 130 && G < 225 && B < 140 && R - B > 90 && R - G > 15
          if (!limao && !verdeAgua && !magenta && !latao) continue
          if (!canvasPorCima(x, y)) continue
          if (limao) {
            r.fichaAna += 1
            sx += x
            sy += y
          } else if (verdeAgua) r.chaoSalao += 1
          else if (magenta) r.chaoCripta += 1
          else if (naCaixa(x, y)) r.latao += 1
        }
      }
      if (r.fichaAna > 0) r.centroDaFichaDeAna = { x: (sx / r.fichaAna) * escalaX, y: (sy / r.fichaAna) * escalaY }
      return r
    },
    { b64: foto.toString('base64'), caixa },
  )
}

async function telaParada(page: Page): Promise<Tela> {
  await page.waitForTimeout(PINTURA_MS)
  return lerTela(page)
}

/** Toca o pino e espera o cartão dele com a descrição. */
async function abrirCartao(j: Jogador, ondeTocar: Ponto, descricao: string, oQue: string): Promise<Locator> {
  await tocar(j.page, ondeTocar)
  const cartao = j.page.getByRole('dialog').filter({ hasText: descricao })
  await expect(cartao, `${oQue}: tocar o pino deveria abrir o cartão com "${descricao}"`).toBeVisible({ timeout: ESPERA })
  return cartao
}

async function botoesDoCartao(cartao: Locator): Promise<string> {
  return (await cartao.getByRole('button').allInnerTexts()).join(' | ')
}


/** Depois de escolher: confirmar e ler "Aguardando o mestre…". */
async function confirmarPedido(j: Jogador, cartao: Locator, oQue: string): Promise<void> {
  const confirmar = cartao
    .getByRole('button', { name: CONFIRMAR_PEDIDO })
    .or(j.page.getByRole('group').getByRole('button', { name: CONFIRMAR_PEDIDO }))
    .first()
  await expect(confirmar, `${oQue}: escolher deveria levar a uma confirmação com "Pedir"/"Sim"/"Confirmar". Botões do cartão agora: ${await botoesDoCartao(cartao)}`).toBeVisible({ timeout: ESPERA })
  await confirmar.click()
  await expect(j.page.getByText(AGUARDANDO).first(), `${oQue}: depois de confirmar a jogadora deveria ler "Aguardando o mestre…"`).toBeVisible({ timeout: ESPERA })
}

/** O pino de UMA saída, do jeito de hoje: "Pedir para passar" → a pergunta → confirmar. */
async function pedirPeloCartaoSimples(j: Jogador, cartao: Locator, oQue: string): Promise<void> {
  const pedir = cartao.getByRole('button', { name: PEDIR_PARA_PASSAR })
  await expect(pedir, `${oQue}: o cartão deveria oferecer "${PEDIR_PARA_PASSAR}". Botões do cartão hoje: ${await botoesDoCartao(cartao)}`).toBeVisible({ timeout: ESPERA })
  await pedir.click()
  await expect(j.page.getByText(PERGUNTA_DO_PEDIDO), `${oQue}: pedir deveria perguntar "${PERGUNTA_DO_PEDIDO}"`).toBeVisible({ timeout: ESPERA })
  await confirmarPedido(j, cartao, oQue)
}

/** O aviso que espera, na tela do mestre: "<jogador> quer passar por <o quê> → <cena>", com "Deixar ir". */
async function mestreDeixaIr(mestre: Page, porOnde: string, destino: string): Promise<void> {
  const aviso = new RegExp(`${J1}[^]*quer passar por[^]*${escapar(porOnde)}[^]*${escapar(destino)}`)
  await expect(mestre.getByText(aviso).first(), `o mestre deveria ler "${J1} quer passar por ${porOnde} → ${destino}"`).toBeVisible({ timeout: ESPERA })
  const deixar = mestre.getByRole('button', { name: DEIXAR_IR, exact: true })
  await expect(deixar, `o aviso do pedido deveria ter "${DEIXAR_IR}"`).toBeVisible({ timeout: ESPERA })
  await deixar.click()
}

/** Chegou: "Você chegou" e o chão da Cripta na tela, sem o do Salão, com a ficha dela. */
async function anaChegaNaCripta(ana: Jogador): Promise<Tela> {
  await expect(ana.page.getByText(VOCE_CHEGOU).first(), `${J1} deveria ler "Você chegou" (${CENA_B})`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await telaParada(ana.page)).chaoCripta, { timeout: ESPERA_TELA, message: `${J1} deveria passar a ver o chão da ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  await expect
    .poll(async () => (await telaParada(ana.page)).fichaAna, { timeout: ESPERA_TELA, message: `${J1} deveria ver a própria ficha na ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  const tela = await telaParada(ana.page)
  expect(tela.chaoSalao, `${J1} chegou à ${CENA_B} e ainda vê o chão do ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)
  return tela
}

/** A viagem inteira pelo alçapão: toque, "Pedir para passar", confirmar, o mestre deixa, ela chega. */
async function anaDesceOAlcapao(ana: Jogador, mestre: Page): Promise<Ponto> {
  const cartao = await abrirCartao(ana, cabecaNoJogador(POS_ALCAPAO), ALCAPAO, `${J1} toca o ${ALCAPAO}`)
  await pedirPeloCartaoSimples(ana, cartao, `${J1} no ${ALCAPAO}`)
  await mestreDeixaIr(mestre, ALCAPAO, CENA_B)
  const tela = await anaChegaNaCripta(ana)
  if (tela.centroDaFichaDeAna === null) throw new Error(`${J1} sem ficha na ${CENA_B}`)
  return tela.centroDaFichaDeAna
}

/**
 * Em volta de onde a ficha chegou: duas casas para cada lado e três para cima
 * (a cabeça do pino fica acima da ponta, e a ficha assenta na ponta ou a uma
 * casa dela). A Cripta não tem outro pino: latão aqui é o do par.
 */
function caixaDaChegada(ficha: Ponto): Caixa {
  const casa = GRADE * CAMERA_JOGADOR.scale
  return { x0: ficha.x - 2.5 * casa, x1: ficha.x + 2.5 * casa, y0: ficha.y - 3 * casa, y1: ficha.y + 1.5 * casa }
}

async function lataoPerto(ana: Jogador, ficha: Ponto): Promise<number> {
  await ana.page.waitForTimeout(PINTURA_MS)
  return (await lerTela(ana.page, caixaDaChegada(ficha))).latao
}

/** Onde a cabeça do par pode estar, se a ficha chegou na ponta dele ou a uma casa: os nove toques. */
function toquesNaCabecaDoPar(ficha: Ponto): Ponto[] {
  const s = CAMERA_JOGADOR.scale
  const pontos: Ponto[] = []
  for (const dx of [0, -1, 1]) for (const dy of [0, -1, 1]) pontos.push({ x: ficha.x - dx * GRADE * s, y: ficha.y - dy * GRADE * s - CABECA_DO_PINO_JOGADOR * s })
  return pontos
}

/** Toca os nove pontos até o cartão do par abrir; devolve o cartão ou `null`. */
async function acharCartaoDoPar(ana: Jogador, ficha: Ponto): Promise<Locator | null> {
  const cartao = ana.page.getByRole('dialog').filter({ hasText: PAR_NA_CRIPTA })
  for (const p of toquesNaCabecaDoPar(ficha)) {
    await tocar(ana.page, p)
    const abriu = await cartao.waitFor({ state: 'visible', timeout: 800 }).then(
      () => true,
      () => false,
    )
    if (abriu) return cartao
  }
  return null
}

function framesComOPar(frames: readonly string[]): string[] {
  return frames.filter((f) => f.includes(ID_DO_PAR))
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: sem mão única, Ana desce o alçapão, chega na Cripta e vê o pino par (latão da cabeça e cartão)', async ({ browser, page, baseURL }) => {
  test.setTimeout(210_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const antes = await telaParada(ana.page)
  expect(antes.chaoSalao, `${J1} deveria começar vendo o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(ana.frames.some((f) => f.includes('"snapshot"')), `a escuta de frames de ${J1} não viu nenhum snapshot: a régua de vazamento estaria surda`).toBe(true)
  // A leitura de latão não inventa pino: em volta da ficha no Salão (o alçapão fica fora da caixa) não há latão.
  if (antes.centroDaFichaDeAna === null) throw new Error(`${J1} sem ficha no ${CENA_A}`)
  const lataoSemPino = await lataoPerto(ana, antes.centroDaFichaDeAna)
  expect(lataoSemPino, `no ${CENA_A}, sem pino perto da ficha, a leitura de latão deveria dar ~0 (deu ${lataoSemPino} px): a régua do teste 3 estaria cega`).toBeLessThanOrEqual(RESIDUO_DE_LATAO)

  const ficha = await anaDesceOAlcapao(ana, page)
  await expect
    .poll(() => lataoPerto(ana, ficha), { timeout: ESPERA_TELA, message: `na ${CENA_B}, o latão da cabeça do pino par (${PAR_NA_CRIPTA}) deveria aparecer em volta de onde ${J1} chegou` })
    .toBeGreaterThanOrEqual(PIXELS_DE_CABECA)
  const cartao = await acharCartaoDoPar(ana, ficha)
  expect(cartao, `na ${CENA_B}, tocar a cabeça do pino par junto da ficha de ${J1} deveria abrir o cartão "${PAR_NA_CRIPTA}"`).not.toBeNull()
  // A escuta ouve a Cripta: hoje o par vai no recorte dela, com id (é isso que o teste 4 cobra que suma).
  expect(framesComOPar(ana.frames).length, `a escuta de frames de ${J1} não ouviu o pino par da ${CENA_B}: o teste 4 estaria surdo`).toBeGreaterThan(0)
})

test('2. o mestre marca "Mão única" no pino do Salão e o painel do par, na Cripta, diz "Só chegada"', async ({ page }) => {
  test.setTimeout(120_000)
  await mestreAbreAventura(page)
  await mestreDefineMaoUnica(page, true)

  await mestreAbreCripta(page)
  const painelDoPar = await mestreAbrePainelDoPino(page, MAPA_B, POS_PAR_NA_CRIPTA, TITULO_DO_PAINEL_DO_PAR, `o mestre abre o par na ${CENA_B}`)
  await expect(painelDoPar.getByText(SO_CHEGADA).first(), `com a mão única, o painel do par deveria dizer "Só chegada". Controles do painel hoje: ${await controlesDoPainel(painelDoPar)}`).toBeVisible({ timeout: ESPERA })
})

test('3. com "Mão única", Ana desce o alçapão e chega na Cripta, mas não vê o par: nenhum latão em volta e tocar ali não abre cartão', async ({ browser, page, baseURL }) => {
  test.setTimeout(210_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await mestreDefineMaoUnica(page, true)

  const ficha = await anaDesceOAlcapao(ana, page)
  // Folga para o par pintar, se fosse pintar: o controle (teste 1) mostra que ele pinta junto com a chegada.
  await ana.page.waitForTimeout(1500)
  const latao = await lataoPerto(ana, ficha)
  expect(latao, `com a mão única, ${J1} não deveria ver a cabeça do pino par em volta de onde chegou (latão contado: ${latao} px)`).toBeLessThanOrEqual(RESIDUO_DE_LATAO)

  for (const p of toquesNaCabecaDoPar(ficha)) {
    await tocar(ana.page, p)
    await ana.page.waitForTimeout(PINTURA_MS)
    await expect(ana.page.getByRole('dialog'), `com a mão única, tocar onde estaria o par (${Math.round(p.x)}, ${Math.round(p.y)}) não deveria abrir cartão nenhum`).toHaveCount(0)
  }
})

test('4. com "Mão única", nenhum frame recebido por Ana traz o id do pino par, nem antes nem depois de chegar', async ({ browser, page, baseURL }) => {
  test.setTimeout(210_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await mestreDefineMaoUnica(page, true)
  expect(framesComOPar(ana.frames), `antes de descer, ${J1} já recebeu o pino par (${ID_DO_PAR})`).toEqual([])

  const antesDeDescer = ana.frames.length
  await anaDesceOAlcapao(ana, page)
  await ana.page.waitForTimeout(1500)
  // A escuta está ligada: chegar à Cripta trouxe frames novos.
  expect(ana.frames.length, `a escuta de frames de ${J1} não ouviu nada da chegada: a régua estaria surda`).toBeGreaterThan(antesDeDescer)
  const vazados = framesComOPar(ana.frames).map((f) => f.slice(0, 300))
  expect(vazados, `com a mão única, o pino par (${ID_DO_PAR}) não deveria ir no recorte de ${J1}`).toEqual([])
})

test('5. desmarcar "Mão única" devolve o par: Ana desce e vê o latão da cabeça dele em volta de onde chegou', async ({ browser, page, baseURL }) => {
  test.setTimeout(210_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await mestreDefineMaoUnica(page, true)
  await mestreDefineMaoUnica(page, false)

  const ficha = await anaDesceOAlcapao(ana, page)
  await expect
    .poll(() => lataoPerto(ana, ficha), { timeout: ESPERA_TELA, message: `sem a mão única, o latão da cabeça do pino par deveria voltar a aparecer em volta de onde ${J1} chegou` })
    .toBeGreaterThanOrEqual(PIXELS_DE_CABECA)
  const cartao = await acharCartaoDoPar(ana, ficha)
  expect(cartao, `sem a mão única, tocar a cabeça do par deveria abrir o cartão "${PAR_NA_CRIPTA}"`).not.toBeNull()
})
