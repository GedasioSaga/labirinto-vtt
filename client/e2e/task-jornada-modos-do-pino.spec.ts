// JORNADA DE USUÁRIO dos MODOS DO PINO DE VIAGEM (G2 do PEDIDOS.md) — escrita
// para SAIR VERMELHA no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (decidida no modo automático):
//   - no painel do pino de viagem, o mestre tem um controle "Passagem" com três
//     opções: "Pede ao mestre" (o padrão, o de hoje; pino antigo sem o campo se
//     comporta assim), "Livre" e "Trancada";
//   - "Livre": o cartão do jogador diz "Passar", a confirmação continua ("Passar
//     por aqui?"), e ao confirmar ele vai direto e lê "Você chegou". O mestre não
//     recebe pedido ("Deixar ir"), só o aviso "<jogador> entrou em <cena>" com
//     "Ir lá";
//   - "Trancada": o cartão do jogador diz "Está trancada", sem botão de pedir, e
//     nenhum pedido chega ao mestre;
//   - cada pino tem o SEU modo: a porta pode ser livre para ir e trancada para
//     voltar;
//   - o jogador nunca recebe o nome da cena de destino.
//
// ONDE ISSO MORRE HOJE: o painel do pino (`components/PinControls.tsx` e
// `components/PinTravelControls.tsx`) só tem tipo, destino, descrição, "Travado"
// e imagem; o `Pin` (`types/map.ts`) não tem modo de passagem; o cartão do
// jogador (`player/PlayerPinCard.tsx`) sempre oferece "Pedir para passar".
//
// COMO ESTE ARQUIVO PROVA, sem mentir (o mesmo preparo de
// `task-jornada-viagem-do-jogador.spec.ts`):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página; a
//   jogadora é o `player.html` inteiro no próprio contexto de navegador. Só o
//   TRANSPORTE Rust é falsificado: o que a jogadora manda pelo WebSocket vira o
//   evento `net:message` na página do mestre (com `JSON.parse` do que chegou), e
//   o `net_send` do mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA. As duas cenas e o par de pinos já
//   ligados vêm de um `adventure.json` no disco falso — SEM modo de passagem,
//   como todo pino gravado até hoje. O MODO é escolhido pelo PAINEL DO MESTRE,
//   com gesto real: ferramenta Pino na mão, clique na cabeça do pino, e a opção.
//   GESTO REAL NA AÇÃO SOB TESTE. Clique e toque pelo ponteiro; teclado de
//   verdade. Os únicos `evaluate` são o do transporte e a LEITURA de pixel (e o
//   `elementFromPoint` que confere se o toque cai no mapa).
//   PROVA NA TELA. Texto visível; e a cena que a jogadora vê é lida pela COR DO
//   CHÃO no canvas dela (cena A verde-água, cena B magenta).
//   ONDE O PINO ESTÁ NA TELA DO MESTRE. O editor enquadra o CONTEÚDO ao abrir a
//   cena (`contentBounds` + `fitCamera`, margem 40, `pixi/PixiCanvas.tsx`). O
//   chão não entra nessa conta, então as duas cenas têm quatro paredes no
//   contorno do mundo: o enquadramento vira o mundo inteiro, igual nas duas, e a
//   régua faz a mesma conta com as mesmas funções.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases decididas):
//   - o controle "Passagem" é um grupo de opções (radiogroup/group) ou um
//     seletor (combobox) com nome acessível que contém "Passagem", dentro do
//     painel do pino; as opções são radio, botão ou option com os nomes "Pede ao
//     mestre", "Livre" e "Trancada"; "marcada" = aria-checked, aria-pressed,
//     aria-selected ou option selecionada;
//   - no cartão do jogador, "Passar" é o nome EXATO do botão; a pergunta é
//     "Passar por aqui?"; quem confirma chama "Passar", "Sim", "Confirmar" ou
//     "Ir" (`CONFIRMAR_PASSAGEM`), de preferência dentro do grupo nomeado pela
//     pergunta (o molde do cartão de hoje);
//   - "Está trancada" aparece como texto dentro do cartão (`role="dialog"`);
//   - na cena B a ficha chega em cima do pino par ou a uma casa dele (a mesma
//     suposição da jornada da viagem).
//
// CONTROLE POSITIVO (verde hoje): teste 1. O pino de viagem sem modo abre o
// cartão com "Pedir para passar". Sem ele, o vermelho dos testes 2 a 5 poderia
// ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { PIN_HEAD_OFFSET } from '../src/lib/pins'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'MODO01'
const J1 = 'Ana'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'

const TOKEN_J1 = 'Lanterna'
const ESCADA_A = 'Escada que desce'
const ESCADA_B = 'Escada que sobe'
/** Texto que só existe na cena B: se viajar para a jogadora antes da hora, vazou. */
const ALTAR_B = 'Altar de ossos antigo'

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

const CHAO_A = '#1e8c8c'
const CHAO_B = '#8c1e8c'
const COR_J1 = '#3cff00'

type Ponto = { x: number; y: number }

const POS_J1: Ponto = { x: 700, y: 300 }
const POS_ESCADA_A: Ponto = { x: 900, y: 440 }
const POS_ESCADA_B: Ponto = { x: 1000, y: 300 }
const POS_ALTAR: Ponto = { x: 1600, y: 200 }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** Quanto a régua espera por um pedido que NÃO pode chegar ao mestre. */
const ESPERA_DO_SILENCIO = 2500
/** Cabeça do pino na tela do jogador: 31 px de mundo acima da ponta acerta a cabeça e foge do token. */
const CABECA_DO_PINO_JOGADOR = 31

const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/** Pixels máximos para dizer "isto NÃO está na tela" (antisserrilhado e sombra). */
const RESIDUO = 25

const FERRAMENTA_PINO = 'Pino'
const TITULO_DO_PAINEL = /pino de viagem/i
const PASSAGEM = /passagem/i
const PEDE_AO_MESTRE = 'Pede ao mestre'
const LIVRE = 'Livre'
const TRANCADA = 'Trancada'

const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PASSAR = 'Passar'
const PERGUNTA_LIVRE = 'Passar por aqui?'
const CONFIRMAR_PASSAGEM = /^(passar|sim|confirmar|ir)$/i
const ESTA_TRANCADA = /Está trancada/
const VOCE_CHEGOU = /Você chegou/
const DEIXAR_IR = 'Deixar ir'

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const AVISO_DE_CHEGADA = new RegExp(`${J1}[^]*entrou em[^]*${escapar(CENA_B)}`)
const AVISO_DE_PEDIDO = new RegExp(`${J1}[^]*quer passar`)

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: duas cenas ligadas por um par de pinos de viagem SEM modo
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
  [pino('pin-a-escada', POS_ESCADA_A, 'viagem', ESCADA_A, { sceneId: ID_CENA_B, pinId: 'pin-b-escada' })],
)
const MAPA_B = cena('map_cripta', CENA_B, CHAO_B, [], [
  pino('pin-b-escada', POS_ESCADA_B, 'viagem', ESCADA_B, { sceneId: ID_CENA_A, pinId: 'pin-a-escada' }),
  pino('pin-b-altar', POS_ALTAR, 'exclamacao', ALTAR_B),
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

/** O editor do mestre vai a outra cena pela lista de Cenas, como na mesa. */
async function mestreAbreCena(mestre: Page, nome: string): Promise<void> {
  const lista = await secaoCenas(mestre)
  await entradaDaCena(lista, nome).click()
  await expect.poll(() => estaDestacada(entradaDaCena(lista, nome)), { message: `o editor deveria abrir a cena "${nome}"`, timeout: ESPERA }).toBe(true)
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
// O painel do pino no mestre: ferramenta Pino, clique na cabeça, "Passagem"
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

/** Ferramenta Pino na mão e clique no pino: o painel "Pino de viagem" abre no rail. */
async function mestreAbrePainelDoPino(mestre: Page, mapa: MapData, p: Ponto, oQue: string): Promise<Locator> {
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await mestre.getByRole('button', { name: FERRAMENTA_PINO, exact: true }).click()
  await tocarNoMapa(mestre, await cabecaNoMestre(mestre, mapa, p))
  const titulo = mestre.getByRole('heading', { name: TITULO_DO_PAINEL }).first()
  await expect(titulo, `${oQue}: clicar no pino com a ferramenta Pino deveria abrir o painel "Pino de viagem"`).toBeVisible({ timeout: ESPERA })
  return titulo.locator('xpath=ancestor::*[self::section or @role="region" or @role="dialog"][1]')
}

/** Nomes acessíveis dos controles do painel — só para a mensagem de falha ajudar quem implementa. */
async function controlesDoPainel(painel: Locator): Promise<string> {
  const nomes = await painel
    .locator('button, select, textarea, [role="radio"], [role="radiogroup"], [role="group"], [role="combobox"], [role="switch"], [role="checkbox"]')
    .evaluateAll((elementos) => elementos.map((e) => e.getAttribute('aria-label') ?? e.textContent?.trim() ?? '').filter((n) => n !== ''))
  return nomes.join(' | ')
}

/** O controle "Passagem" do painel do pino. Falha dizendo o que o painel oferece hoje. */
async function controleDePassagem(painel: Locator, oQue: string): Promise<Locator> {
  const controle = painel
    .getByRole('radiogroup', { name: PASSAGEM })
    .or(painel.getByRole('group', { name: PASSAGEM }))
    .or(painel.getByRole('combobox', { name: PASSAGEM }))
    .first()
  const existe = await controle.isVisible().catch(() => false)
  if (!existe) {
    await expect(controle, `${oQue}: o painel do pino de viagem deveria ter o controle "Passagem". Controles do painel hoje: ${await controlesDoPainel(painel)}`).toBeVisible({ timeout: ESPERA })
  }
  return controle
}

/** Uma opção do controle "Passagem", em qualquer papel plausível. */
function opcaoDePassagem(controle: Locator, nome: string): Locator {
  const exato = new RegExp(`^\\s*${escapar(nome)}\\s*$`, 'i')
  return controle
    .getByRole('radio', { name: exato })
    .or(controle.getByRole('button', { name: exato }))
    .or(controle.getByRole('option', { name: exato }))
    .first()
}

async function estaMarcada(opcao: Locator): Promise<boolean> {
  for (const atributo of ['aria-checked', 'aria-pressed', 'aria-selected']) {
    if ((await opcao.getAttribute(atributo)) === 'true') return true
  }
  // `<option>` de um `<select>`: leitura da propriedade, nada muda.
  return opcao.evaluate((el) => el instanceof HTMLOptionElement && el.selected)
}

/** O mestre escolhe o modo pelo painel, com gesto: clique na opção (ou teclado, se for `<select>`). */
async function mestreEscolhePassagem(mestre: Page, mapa: MapData, p: Ponto, modo: string, oQue: string): Promise<void> {
  const painel = await mestreAbrePainelDoPino(mestre, mapa, p, oQue)
  const controle = await controleDePassagem(painel, oQue)
  const opcao = opcaoDePassagem(controle, modo)
  await expect(opcao, `${oQue}: o controle "Passagem" deveria oferecer "${modo}"`).toBeAttached({ timeout: ESPERA })
  const tag = await controle.evaluate((el) => el.tagName)
  if (tag === 'SELECT') {
    await controle.click()
    await mestre.keyboard.type(modo, { delay: 30 })
    await mestre.keyboard.press('Enter')
  } else {
    await opcao.click()
  }
  await expect.poll(() => estaMarcada(opcao), { message: `${oQue}: depois do clique, "${modo}" deveria ficar marcada`, timeout: ESPERA }).toBe(true)
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

interface Tela {
  fichaAna: number
  chaoA: number
  chaoB: number
  centroDaFichaDeAna: Ponto | null
}

/**
 * Fotografa a tela da jogadora e conta pixels por cor, só onde o CANVAS está por
 * cima (painéis e cartões não contam). Leitura pura: decodifica a foto num
 * canvas solto e pergunta `elementFromPoint`.
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
  if (foto === null) throw new Error('não consegui fotografar a tela da jogadora')
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
    const r: { fichaAna: number; chaoA: number; chaoB: number; centroDaFichaDeAna: { x: number; y: number } | null } = {
      fichaAna: 0,
      chaoA: 0,
      chaoB: 0,
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
        const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30
        const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
        if (!limao && !verdeAgua && !magenta) continue
        if (!canvasPorCima(x, y)) continue
        if (limao) {
          r.fichaAna += 1
          sx += x
          sy += y
        } else if (verdeAgua) {
          if (G >= 35) r.chaoA += 1
        } else r.chaoB += 1
      }
    }
    if (r.fichaAna > 0) r.centroDaFichaDeAna = { x: (sx / r.fichaAna) * escalaX, y: (sy / r.fichaAna) * escalaY }
    return r
  }, foto.toString('base64'))
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

/** Pino "Livre", do lado da jogadora: "Passar" → "Passar por aqui?" → confirmar. */
async function passarDireto(j: Jogador, cartao: Locator, oQue: string): Promise<void> {
  const passar = cartao.getByRole('button', { name: PASSAR, exact: true })
  await expect(passar, `${oQue}: o cartão do pino livre deveria oferecer "${PASSAR}". Botões do cartão hoje: ${await botoesDoCartao(cartao)}`).toBeVisible({ timeout: ESPERA })
  await expect(cartao.getByRole('button', { name: PEDIR_PARA_PASSAR }), `${oQue}: pino livre não pede ao mestre`).toHaveCount(0)
  await passar.click()
  await expect(j.page.getByText(PERGUNTA_LIVRE), `${oQue}: "${PASSAR}" deveria perguntar "${PERGUNTA_LIVRE}"`).toBeVisible({ timeout: ESPERA })
  const noGrupo = j.page.getByRole('group', { name: PERGUNTA_LIVRE }).getByRole('button', { name: CONFIRMAR_PASSAGEM })
  const confirmar = (await noGrupo.count()) > 0 ? noGrupo.first() : cartao.getByRole('button', { name: CONFIRMAR_PASSAGEM }).last()
  await expect(confirmar, `${oQue}: a pergunta deveria ter um botão de confirmar`).toBeVisible({ timeout: ESPERA })
  await confirmar.click()
}

/** Chegou à cena B: "Você chegou" e o chão magenta na tela, sem o chão da cena A. */
async function anaChegaNaCenaB(ana: Jogador): Promise<Tela> {
  await expect(ana.page.getByText(VOCE_CHEGOU).first(), `${J1} deveria ler "Você chegou"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await telaParada(ana.page)).chaoB, { timeout: ESPERA_TELA, message: `${J1} deveria passar a ver o chão da ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  const tela = await telaParada(ana.page)
  expect(tela.chaoA, `${J1} chegou à ${CENA_B} e continua vendo o chão do ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)
  expect(tela.fichaAna, `${J1} deveria ver a própria ficha na ${CENA_B}`).toBeGreaterThan(PIXELS_DE_TOKEN)
  return tela
}

/** Pino "Trancada", do lado da jogadora: o cartão diz que está trancada, sem pedir nem passar. */
async function cartaoTrancado(cartao: Locator, oQue: string): Promise<void> {
  await expect(cartao.getByText(ESTA_TRANCADA).first(), `${oQue}: o cartão do pino trancado deveria dizer "Está trancada". Botões do cartão hoje: ${await botoesDoCartao(cartao)}`).toBeVisible({ timeout: ESPERA })
  await expect(cartao.getByRole('button', { name: PEDIR_PARA_PASSAR }), `${oQue}: pino trancado não oferece "${PEDIR_PARA_PASSAR}"`).toHaveCount(0)
  await expect(cartao.getByRole('button', { name: PASSAR, exact: true }), `${oQue}: pino trancado não oferece "${PASSAR}"`).toHaveCount(0)
}

/** O mestre não recebe pedido: espera curta e confere que não há aviso com "Deixar ir". */
async function mestreSemPedido(mestre: Page, oQue: string): Promise<void> {
  await mestre.waitForTimeout(ESPERA_DO_SILENCIO)
  await expect(mestre.getByRole('button', { name: DEIXAR_IR, exact: true }), `${oQue}: nenhum aviso com "${DEIXAR_IR}" deveria chegar ao mestre`).toHaveCount(0)
  await expect(mestre.getByText(AVISO_DE_PEDIDO), `${oQue}: o mestre não deveria ler "${J1} quer passar…"`).toHaveCount(0)
}

/** Texto de frame que entrega a cena B ou o destino do pino. */
function vazamentos(frames: readonly string[]): string[] {
  return frames.filter((f) => f.includes(CENA_B) || f.includes(ALTAR_B) || f.includes('"destino"'))
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: o pino de viagem sem modo abre o cartão com "Pedir para passar" para a jogadora', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const cartao = await abrirCartao(ana, cabecaNoJogador(POS_ESCADA_A), ESCADA_A, `${J1} toca a ${ESCADA_A}`)
  await expect(cartao.getByRole('button', { name: PEDIR_PARA_PASSAR }), `o pino sem modo deveria oferecer "${PEDIR_PARA_PASSAR}". Botões do cartão hoje: ${await botoesDoCartao(cartao)}`).toBeVisible({ timeout: ESPERA })
  await expect(cartao.getByText(ESTA_TRANCADA), 'o pino sem modo não está trancado').toHaveCount(0)
})

test('2. o painel do pino de viagem tem "Passagem" com as três opções, e "Pede ao mestre" vem marcada no pino nunca mexido', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  await mesaMontada(browser, page, baseURL ?? '')
  const painel = await mestreAbrePainelDoPino(page, MAPA_A, POS_ESCADA_A, `o mestre abre a ${ESCADA_A}`)
  const controle = await controleDePassagem(painel, 'painel da escada')
  for (const modo of [PEDE_AO_MESTRE, LIVRE, TRANCADA]) {
    await expect(opcaoDePassagem(controle, modo), `o controle "Passagem" deveria oferecer "${modo}"`).toBeAttached({ timeout: ESPERA })
  }
  expect(await estaMarcada(opcaoDePassagem(controle, PEDE_AO_MESTRE)), `num pino nunca mexido, "${PEDE_AO_MESTRE}" deveria vir marcada`).toBe(true)
  expect(await estaMarcada(opcaoDePassagem(controle, LIVRE)), `num pino nunca mexido, "${LIVRE}" não deveria vir marcada`).toBe(false)
  expect(await estaMarcada(opcaoDePassagem(controle, TRANCADA)), `num pino nunca mexido, "${TRANCADA}" não deveria vir marcada`).toBe(false)
})

test('3. livre: a jogadora passa direto e chega à Cripta; o mestre só lê "Ana entrou em Cripta Rubra", sem "Deixar ir"', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await mestreEscolhePassagem(page, MAPA_A, POS_ESCADA_A, LIVRE, `o mestre deixa a ${ESCADA_A} livre`)

  const cartao = await abrirCartao(ana, cabecaNoJogador(POS_ESCADA_A), ESCADA_A, `${J1} toca a ${ESCADA_A}`)
  await passarDireto(ana, cartao, `${J1} na ${ESCADA_A} livre`)
  expect(vazamentos(ana.frames), `até confirmar, ${J1} recebeu o nome da ${CENA_B} ou o destino do pino`).toEqual([])

  // Nenhum clique do mestre daqui em diante: ela chega sozinha.
  await anaChegaNaCenaB(ana)
  await expect(page.getByText(AVISO_DE_CHEGADA).first(), `o mestre deveria ler "${J1} entrou em ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  await expect(page.getByRole('button', { name: 'Ir lá', exact: true }), 'o aviso de chegada deveria ter "Ir lá"').toBeVisible({ timeout: ESPERA })
  await expect(page.getByRole('button', { name: DEIXAR_IR, exact: true }), `pino livre: nenhum aviso com "${DEIXAR_IR}" deveria aparecer`).toHaveCount(0)
})

test('4. trancada: a jogadora lê "Está trancada", sem botão de pedir, e nenhum pedido chega ao mestre', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await mestreEscolhePassagem(page, MAPA_A, POS_ESCADA_A, TRANCADA, `o mestre tranca a ${ESCADA_A}`)

  const cartao = await abrirCartao(ana, cabecaNoJogador(POS_ESCADA_A), ESCADA_A, `${J1} toca a ${ESCADA_A}`)
  await cartaoTrancado(cartao, `${J1} na ${ESCADA_A} trancada`)
  await mestreSemPedido(page, 'pino trancado')

  const tela = await telaParada(ana.page)
  expect(tela.chaoA, `trancada, ${J1} deveria continuar vendo o ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(tela.chaoB, `trancada, ${J1} não deveria ver nada da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  expect(vazamentos(ana.frames), `trancada, ${J1} recebeu o nome da ${CENA_B} ou o destino do pino`).toEqual([])
})

test('5. cada pino tem o seu: A livre e o par B trancado — Ana vai à Cripta e, na volta, lê "Está trancada"', async ({ browser, page, baseURL }) => {
  test.setTimeout(210_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await mestreEscolhePassagem(page, MAPA_A, POS_ESCADA_A, LIVRE, `o mestre deixa a ${ESCADA_A} livre`)
  await mestreAbreCena(page, CENA_B)
  await mestreEscolhePassagem(page, MAPA_B, POS_ESCADA_B, TRANCADA, `o mestre tranca a ${ESCADA_B}`)
  // Mudar o par não mexeu no pino A: de volta ao Salão, a escada de lá continua livre.
  await mestreAbreCena(page, CENA_A)
  const painelA = await mestreAbrePainelDoPino(page, MAPA_A, POS_ESCADA_A, `o mestre confere a ${ESCADA_A}`)
  const controleA = await controleDePassagem(painelA, 'painel da escada de A')
  expect(await estaMarcada(opcaoDePassagem(controleA, LIVRE)), `trancar a ${ESCADA_B} não deveria trancar a ${ESCADA_A}`).toBe(true)

  // Ida: livre.
  const ida = await abrirCartao(ana, cabecaNoJogador(POS_ESCADA_A), ESCADA_A, `${J1} toca a ${ESCADA_A}`)
  await passarDireto(ana, ida, `${J1} na ${ESCADA_A} livre`)
  const naCripta = await anaChegaNaCenaB(ana)

  // Volta: a ficha chega em cima do pino par (ou a uma casa dele); toca a cabeça
  // do pino nesses pontos até o cartão da Escada que sobe abrir.
  const ficha = naCripta.centroDaFichaDeAna
  if (ficha === null) throw new Error(`${J1} sem ficha na ${CENA_B}`)
  const s = CAMERA_JOGADOR.scale
  const deslocamentos: Ponto[] = [{ x: 0, y: 0 }]
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (dx !== 0 || dy !== 0) deslocamentos.push({ x: dx * GRADE, y: dy * GRADE })
  let volta: Locator | null = null
  for (const d of deslocamentos) {
    await tocar(ana.page, { x: ficha.x - d.x * s, y: ficha.y - d.y * s - CABECA_DO_PINO_JOGADOR * s })
    const cartao = ana.page.getByRole('dialog').filter({ hasText: ESCADA_B })
    if (await cartao.isVisible()) {
      volta = cartao
      break
    }
  }
  expect(volta, `na ${CENA_B}, o pino par (${ESCADA_B}) deveria estar junto da ficha de ${J1}`).not.toBeNull()
  if (volta === null) return
  await cartaoTrancado(volta, `${J1} na ${ESCADA_B} trancada`)
  await mestreSemPedido(page, 'volta trancada')
  const aindaNaCripta = await telaParada(ana.page)
  expect(aindaNaCripta.chaoB, `a volta está trancada: ${J1} deveria continuar na ${CENA_B}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(aindaNaCripta.chaoA, `a volta está trancada: ${J1} não deveria ver o ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)
})
