// JORNADA DE USUÁRIO da ENCRUZILHADA (G8 do PEDIDOS.md) — escrita para SAIR
// VERMELHA no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - um pino de viagem pode ter VÁRIAS saídas. No painel do pino, além do
//     destino de hoje, "+ Outra saída" acrescenta outra ligação (cena + pino de
//     chegada, criado ou escolhido como hoje), e cada saída tem um RÓTULO que o
//     mestre escreve no campo "Nome da saída" ("Porta da cripta", "Escada da
//     torre");
//   - a jogadora toca o pino e o cartão lista as saídas pelos RÓTULOS, nunca
//     pelo nome da cena, cada uma com o seu botão;
//   - o pedido vai com a saída escolhida; o mestre lê "<jogador> quer passar
//     por <rótulo> → <cena>" e, ao deixar, ela chega no pino par DAQUELA saída;
//   - pino com UMA saída continua exatamente como hoje (cartão simples, sem
//     lista).
//
// ONDE ISSO MORRE HOJE: `Pin.destino` (`types/map.ts`) é UM `{ sceneId, pinId }`;
// o painel (`components/PinTravelControls.tsx`) só tem "Leva a…"/"Trocar
// destino"/"Desligar"; o cartão da jogadora (`player/PlayerPinCard.tsx`) só tem
// "Pedir para passar"; o aviso do host (`net/hostBridge.ts`) nomeia o PINO, não
// uma saída.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (o mesmo preparo de
// `task-jornada-viagem-do-jogador.spec.ts` e `task-jornada-modos-do-pino.spec.ts`):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página; a
//   jogadora é o `player.html` inteiro no próprio contexto de navegador. Só o
//   TRANSPORTE Rust é falsificado: o que ela manda pelo WebSocket vira o evento
//   `net:message` na página do mestre (com `JSON.parse` do que chegou), e o
//   `net_send` do mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA. Três cenas — Salão (verde-água),
//   Cripta Rubra (magenta) e Torre Alta (vermelho) — num `adventure.json` do disco
//   falso. O pino do Salão já vem ligado à Cripta, em mão dupla, pelo disco; a
//   SEGUNDA saída (Torre) o mestre acrescenta pelo PAINEL, com gesto real.
//   GESTO REAL NA AÇÃO SOB TESTE. Clique e toque pelo ponteiro, teclado de
//   verdade. Os únicos `evaluate` são o do transporte e LEITURAS (pixel,
//   `elementFromPoint`, e o texto do bloco de cada campo "Nome da saída").
//   PROVA NA TELA. Texto visível e valor dos campos; e a cena que a jogadora vê
//   é lida pela COR DO CHÃO no canvas dela.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o botão que acrescenta a saída tem nome que contém "Outra saída";
//     depois dele a escolha é a de hoje: botão com o nome da cena ("Torre Alta")
//     e "Criar pino de chegada"; o editor do mestre continua no Salão;
//   - cada saída tem um campo de texto cujo nome acessível contém "Nome da
//     saída"; o campo de uma saída mora no mesmo bloco que o nome da cena dela
//     (é por aí que a régua sabe qual campo é da Cripta e qual é da Torre; se o
//     bloco não disser, vale a ordem: a primeira saída é a de hoje);
//   - o nome vale ao sair do campo (Tab) e continua lá ao reabrir o painel;
//   - no cartão da jogadora, cada saída é um botão cujo nome CONTÉM o rótulo
//     ("Escada da torre" ou "Pedir para passar por Escada da torre"); escolher
//     leva a uma confirmação com um botão "Pedir", "Sim", "Confirmar", "Pedir
//     ao mestre", "Pedir passagem" ou "Enviar pedido", e depois a "Aguardando o
//     mestre…";
//   - o aviso do mestre é "<jogador> quer passar por <rótulo> → <cena>" (a
//     régua aceita qualquer coisa entre as partes).
//
// CONTROLE POSITIVO (verde hoje): teste 1 (o pino de uma saída leva à Cripta) e
// teste 5 (o par de uma saída só continua com o cartão simples). Sem eles, o
// vermelho dos testes 2 a 4 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { PIN_HEAD_OFFSET } from '../src/lib/pins'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'ENCR01'
const J1 = 'Ana'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'
const CENA_C = 'Torre Alta'

const TOKEN_J1 = 'Lanterna'
/** O pino encruzilhada, no Salão. */
const ENCRUZILHADA = 'Encruzilhada do salao'
/** O par dele na Cripta, que só tem UMA saída (de volta ao Salão). */
const PAR_NA_CRIPTA = 'Escada que sobe'

const ROTULO_CRIPTA = 'Porta da cripta'
const ROTULO_TORRE = 'Escada da torre'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const ID_CENA_C = 'scene_torre'
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
const CHAO_C = '#8c1e1e'
const COR_J1 = '#3cff00'

type Ponto = { x: number; y: number }

const POS_J1: Ponto = { x: 700, y: 300 }
const POS_ENCRUZILHADA: Ponto = { x: 900, y: 440 }
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
/** Pixels máximos para dizer "isto NÃO está na tela" (antisserrilhado e sombra). */
const RESIDUO = 25

const FERRAMENTA_PINO = 'Pino'
const TITULO_DO_PAINEL = /pino de viagem/i
const OUTRA_SAIDA = /Outra saída/i
const NOME_DA_SAIDA = /Nome da saída/i
const CRIAR_CHEGADA = 'Criar pino de chegada'

const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/
const VOCE_CHEGOU = /Você chegou/
const DEIXAR_IR = 'Deixar ir'

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Nome de cena na tela da jogadora: nunca. O rótulo pode ter a palavra ("Porta da cripta"), o nome inteiro não. */
const NOME_DE_CENA_ESCONDIDO = new RegExp(`${escapar(CENA_B)}|${escapar(CENA_C)}`, 'i')

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: três cenas; o pino do Salão já leva à Cripta
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
  [pino('pin-a-encruzilhada', POS_ENCRUZILHADA, 'viagem', ENCRUZILHADA, { sceneId: ID_CENA_B, pinId: 'pin-b-escada' })],
)
const MAPA_B = cena('map_cripta', CENA_B, CHAO_B, [], [
  pino('pin-b-escada', POS_PAR_NA_CRIPTA, 'viagem', PAR_NA_CRIPTA, { sceneId: ID_CENA_A, pinId: 'pin-a-encruzilhada' }),
])
/** A Torre nasce sem pino: a chegada é criada pelo painel do mestre. */
const MAPA_C = cena('map_torre', CENA_C, CHAO_C, [], [])

function discoDaAventura(): Record<string, string> {
  const aventura = {
    version: 1,
    id: 'adv_vale',
    name: AVENTURA,
    startSceneId: ID_CENA_A,
    scenes: [
      { id: ID_CENA_A, name: CENA_A, file: 'map.json' },
      { id: ID_CENA_B, name: CENA_B, file: `scenes/${ID_CENA_B}/map.json` },
      { id: ID_CENA_C, name: CENA_C, file: `scenes/${ID_CENA_C}/map.json` },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(MAPA_A),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_CENA_B}/map.json`]: serializeMap(MAPA_B),
    [`${PASTA}/scenes/${ID_CENA_C}/map.json`]: serializeMap(MAPA_C),
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

/** Ferramenta Pino na mão e clique na encruzilhada: o painel "Pino de viagem" abre no rail. */
async function mestreAbrePainelDaEncruzilhada(mestre: Page, oQue: string): Promise<Locator> {
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await mestre.getByRole('button', { name: FERRAMENTA_PINO, exact: true }).click()
  await tocarNoMapa(mestre, await cabecaNoMestre(mestre, MAPA_A, POS_ENCRUZILHADA))
  const titulo = mestre.getByRole('heading', { name: TITULO_DO_PAINEL }).first()
  await expect(titulo, `${oQue}: clicar no pino com a ferramenta Pino deveria abrir o painel "Pino de viagem"`).toBeVisible({ timeout: ESPERA })
  return titulo.locator('xpath=ancestor::*[self::section or @role="region" or @role="dialog"][1]')
}

/** Nomes acessíveis dos controles do painel — só para a mensagem de falha ajudar quem implementa. */
async function controlesDoPainel(painel: Locator): Promise<string> {
  const nomes = await painel
    .locator('button, input, select, textarea, [role="radio"], [role="group"], [role="combobox"], [role="textbox"]')
    .evaluateAll((elementos) => elementos.map((e) => e.getAttribute('aria-label') ?? e.textContent?.trim() ?? '').filter((n) => n !== ''))
  return nomes.join(' | ')
}

function camposDeNome(painel: Locator): Locator {
  return painel.getByRole('textbox', { name: NOME_DA_SAIDA })
}

/**
 * Qual campo "Nome da saída" é de qual cena. LEITURA: para cada campo, sobe no
 * DOM até o maior bloco que ainda não contém outro campo, e lê o texto dele.
 * O bloco que fala da Cripta (e não da Torre) é o da Cripta, e vice-versa; sem
 * essa pista, vale a ordem (a primeira saída é a de hoje).
 */
async function camposPorCena(painel: Locator): Promise<{ cripta: Locator; torre: Locator }> {
  const campos = camposDeNome(painel)
  const textos = await campos.evaluateAll((els) =>
    els.map((el) => {
      let bloco: Element = el
      while (bloco.parentElement && !els.some((outro) => outro !== el && bloco.parentElement?.contains(outro))) bloco = bloco.parentElement
      return bloco.textContent ?? ''
    }),
  )
  const soDe = (sim: string, nao: string): number[] => textos.map((t, i) => (t.includes(sim) && !t.includes(nao) ? i : -1)).filter((i) => i >= 0)
  const daCripta = soDe(CENA_B, CENA_C)
  const daTorre = soDe(CENA_C, CENA_B)
  const iCripta = daCripta.length === 1 ? daCripta[0] : 0
  const iTorre = daTorre.length === 1 ? daTorre[0] : 1
  return { cripta: campos.nth(iCripta), torre: campos.nth(iTorre) }
}

/** Escreve o nome no campo como a pessoa escreve: clique, seleciona tudo, digita, Tab. */
async function escreverNome(mestre: Page, campo: Locator, nome: string): Promise<void> {
  await campo.click()
  await mestre.keyboard.press('Control+A')
  await campo.pressSequentially(nome, { delay: 15 })
  await mestre.keyboard.press('Tab')
}

/**
 * O mestre transforma a encruzilhada em duas saídas: "+ Outra saída" → Torre
 * Alta → "Criar pino de chegada"; depois dá nome às duas.
 */
async function mestreMontaEncruzilhada(mestre: Page): Promise<void> {
  const painel = await mestreAbrePainelDaEncruzilhada(mestre, 'o mestre abre a encruzilhada')
  const outra = painel.getByRole('button', { name: OUTRA_SAIDA })
  await expect(outra, `o painel do pino de viagem deveria ter "+ Outra saída". Controles do painel hoje: ${await controlesDoPainel(painel)}`).toBeVisible({ timeout: ESPERA })
  await outra.click()
  const torre = painel.getByRole('button', { name: CENA_C, exact: true })
  await expect(torre, `"+ Outra saída" deveria perguntar a cena, com "${CENA_C}" entre as opções. Controles do painel agora: ${await controlesDoPainel(painel)}`).toBeVisible({ timeout: ESPERA })
  await torre.click()
  const criar = painel.getByRole('button', { name: CRIAR_CHEGADA, exact: true })
  await expect(criar, `depois da cena, deveria vir "${CRIAR_CHEGADA}"`).toBeVisible({ timeout: ESPERA })
  await criar.click()

  await expect
    .poll(() => camposDeNome(painel).count(), { timeout: ESPERA, message: `com duas saídas, o painel deveria ter um campo "Nome da saída" por saída. Controles do painel agora: ${await controlesDoPainel(painel)}` })
    .toBeGreaterThanOrEqual(2)
  const { cripta, torre: campoTorre } = await camposPorCena(painel)
  await escreverNome(mestre, cripta, ROTULO_CRIPTA)
  await escreverNome(mestre, campoTorre, ROTULO_TORRE)
  await expect(cripta, `o campo da saída para a ${CENA_B} deveria ficar com "${ROTULO_CRIPTA}"`).toHaveValue(ROTULO_CRIPTA)
  await expect(campoTorre, `o campo da saída para a ${CENA_C} deveria ficar com "${ROTULO_TORRE}"`).toHaveValue(ROTULO_TORRE)
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

/** Mestre abre a aventura (com as três cenas) e a sala; Ana entra e recebe a Lanterna; o mestre volta ao mapa. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<{ rede: Rede; ana: Jogador }> {
  const rede = await mestreAbreAventura(mestre)
  await expect(entradaDaCena(await secaoCenas(mestre), CENA_C), `a lista de Cenas deveria ter "${CENA_C}"`).toBeVisible()
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
  /** Chão do Salão (verde-água), da Cripta (magenta) e da Torre (vermelho), iluminado ou lembrado. */
  chaoSalao: number
  chaoCripta: number
  chaoTorre: number
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
    const r: { fichaAna: number; chaoSalao: number; chaoCripta: number; chaoTorre: number; centroDaFichaDeAna: { x: number; y: number } | null } = {
      fichaAna: 0,
      chaoSalao: 0,
      chaoCripta: 0,
      chaoTorre: 0,
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
        // Vermelho da Torre (não azul: o anel da ficha da própria jogadora é azul,
        // medido 51 px na Cripta). |G - B| pequeno tira o dourado da cabeça dos pinos.
        const vermelho = R > G * 1.8 + 8 && R > B * 1.8 + 8 && Math.abs(G - B) < 30 && R >= 60
        if (!limao && !verdeAgua && !magenta && !vermelho) continue
        if (!canvasPorCima(x, y)) continue
        if (limao) {
          r.fichaAna += 1
          sx += x
          sy += y
        } else if (verdeAgua) r.chaoSalao += 1
        else if (magenta) r.chaoCripta += 1
        else r.chaoTorre += 1
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

/** O botão de uma saída no cartão: o nome dele CONTÉM o rótulo. */
function botaoDaSaida(cartao: Locator, rotulo: string): Locator {
  return cartao.getByRole('button', { name: new RegExp(escapar(rotulo), 'i') })
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

type Chao = 'chaoSalao' | 'chaoCripta' | 'chaoTorre'

/** Chegou: "Você chegou" e o chão da cena certa na tela, sem o das outras duas. */
async function anaChegaEm(ana: Jogador, chao: Chao, nomeDaCena: string): Promise<Tela> {
  await expect(ana.page.getByText(VOCE_CHEGOU).first(), `${J1} deveria ler "Você chegou" (${nomeDaCena})`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await telaParada(ana.page))[chao], { timeout: ESPERA_TELA, message: `${J1} deveria passar a ver o chão da ${nomeDaCena}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  const tela = await telaParada(ana.page)
  for (const outro of ['chaoSalao', 'chaoCripta', 'chaoTorre'] as const) {
    if (outro !== chao) expect(tela[outro], `${J1} chegou à ${nomeDaCena} e ainda vê chão de outra cena (${outro})`).toBeLessThanOrEqual(RESIDUO)
  }
  expect(tela.fichaAna, `${J1} deveria ver a própria ficha na ${nomeDaCena}`).toBeGreaterThan(PIXELS_DE_TOKEN)
  return tela
}

/** Frames que entregam nome de cena à jogadora antes da hora. */
function vazamentos(frames: readonly string[]): string[] {
  return frames.filter((f) => f.includes(CENA_B) || f.includes(CENA_C))
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: o pino de uma saída abre o cartão com "Pedir para passar", o mestre deixa e Ana vê o chão da Cripta', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const antes = await telaParada(ana.page)
  expect(antes.chaoSalao, `${J1} deveria começar vendo o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)

  const cartao = await abrirCartao(ana, cabecaNoJogador(POS_ENCRUZILHADA), ENCRUZILHADA, `${J1} toca a ${ENCRUZILHADA}`)
  await pedirPeloCartaoSimples(ana, cartao, `${J1} na ${ENCRUZILHADA} de uma saída`)
  await mestreDeixaIr(page, ENCRUZILHADA, CENA_B)
  await anaChegaEm(ana, 'chaoCripta', CENA_B)
})

test('2. o mestre acrescenta "+ Outra saída" para a Torre, dá nome às duas, e o painel as guarda pelos nomes', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  await mesaMontada(browser, page, baseURL ?? '')
  await mestreMontaEncruzilhada(page)

  // Fecha o painel (outra aba) e reabre pelo mesmo gesto: os nomes ficaram no pino, não no campo.
  await page.getByRole('tab', { name: 'Jogo' }).click()
  const painel = await mestreAbrePainelDaEncruzilhada(page, 'o mestre reabre a encruzilhada')
  await expect
    .poll(() => camposDeNome(painel).count(), { timeout: ESPERA, message: 'reaberto, o painel deveria continuar com um "Nome da saída" por saída' })
    .toBeGreaterThanOrEqual(2)
  const { cripta, torre } = await camposPorCena(painel)
  await expect(cripta, `reaberto, a saída para a ${CENA_B} deveria se chamar "${ROTULO_CRIPTA}"`).toHaveValue(ROTULO_CRIPTA)
  await expect(torre, `reaberto, a saída para a ${CENA_C} deveria se chamar "${ROTULO_TORRE}"`).toHaveValue(ROTULO_TORRE)
  await expect(painel.getByText(CENA_B).first(), `o painel deveria continuar dizendo que uma saída leva à ${CENA_B}`).toBeVisible({ timeout: ESPERA })
  await expect(painel.getByText(CENA_C).first(), `o painel deveria dizer que uma saída leva à ${CENA_C}`).toBeVisible({ timeout: ESPERA })
})

test('3. a jogadora toca a encruzilhada e vê as duas saídas pelos rótulos, sem nome de cena na tela nem nos frames', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await mestreMontaEncruzilhada(page)

  const cartao = await abrirCartao(ana, cabecaNoJogador(POS_ENCRUZILHADA), ENCRUZILHADA, `${J1} toca a ${ENCRUZILHADA}`)
  await expect(botaoDaSaida(cartao, ROTULO_CRIPTA).first(), `o cartão da encruzilhada deveria ter uma opção "${ROTULO_CRIPTA}". Botões do cartão hoje: ${await botoesDoCartao(cartao)}`).toBeVisible({ timeout: ESPERA })
  await expect(botaoDaSaida(cartao, ROTULO_TORRE).first(), `o cartão da encruzilhada deveria ter uma opção "${ROTULO_TORRE}". Botões do cartão hoje: ${await botoesDoCartao(cartao)}`).toBeVisible({ timeout: ESPERA })
  await expect(ana.page.getByText(NOME_DE_CENA_ESCONDIDO), `a tela de ${J1} não deveria mostrar "${CENA_B}" nem "${CENA_C}"`).toHaveCount(0)
  expect(ana.frames.some((f) => f.includes('"snapshot"')), `a escuta de frames de ${J1} não viu nenhum snapshot: a régua de vazamento estaria surda`).toBe(true)
  expect(vazamentos(ana.frames), `${J1} recebeu o nome de uma cena de destino pelo fio`).toEqual([])
})

test('4. Ana escolhe "Escada da torre", o mestre lê o pedido com o rótulo e a Torre, deixa ir, e ela vê o chão da Torre', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await mestreMontaEncruzilhada(page)

  const cartao = await abrirCartao(ana, cabecaNoJogador(POS_ENCRUZILHADA), ENCRUZILHADA, `${J1} toca a ${ENCRUZILHADA}`)
  const escada = botaoDaSaida(cartao, ROTULO_TORRE).first()
  await expect(escada, `o cartão da encruzilhada deveria ter uma opção "${ROTULO_TORRE}". Botões do cartão hoje: ${await botoesDoCartao(cartao)}`).toBeVisible({ timeout: ESPERA })
  await escada.click()
  await confirmarPedido(ana, cartao, `${J1} escolhe "${ROTULO_TORRE}"`)
  expect(vazamentos(ana.frames), `até o "Aguardando o mestre…", ${J1} recebeu o nome de uma cena de destino`).toEqual([])

  await mestreDeixaIr(page, ROTULO_TORRE, CENA_C)
  await anaChegaEm(ana, 'chaoTorre', CENA_C)
})

test('5. controle: o par na Cripta, de uma saída só, continua com o cartão simples "Pedir para passar", sem lista, e leva de volta ao Salão', async ({ browser, page, baseURL }) => {
  test.setTimeout(210_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  // Ida à Cripta pelo pino de uma saída.
  const ida = await abrirCartao(ana, cabecaNoJogador(POS_ENCRUZILHADA), ENCRUZILHADA, `${J1} toca a ${ENCRUZILHADA}`)
  await pedirPeloCartaoSimples(ana, ida, `${J1} na ${ENCRUZILHADA}`)
  await mestreDeixaIr(page, ENCRUZILHADA, CENA_B)
  const naCripta = await anaChegaEm(ana, 'chaoCripta', CENA_B)

  // A ficha chega em cima do pino par (ou a uma casa dele): toca a cabeça do pino nesses pontos até o cartão abrir.
  const ficha = naCripta.centroDaFichaDeAna
  if (ficha === null) throw new Error(`${J1} sem ficha na ${CENA_B}`)
  const s = CAMERA_JOGADOR.scale
  const deslocamentos: Ponto[] = [{ x: 0, y: 0 }]
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (dx !== 0 || dy !== 0) deslocamentos.push({ x: dx * GRADE, y: dy * GRADE })
  let volta: Locator | null = null
  for (const d of deslocamentos) {
    await tocar(ana.page, { x: ficha.x - d.x * s, y: ficha.y - d.y * s - CABECA_DO_PINO_JOGADOR * s })
    const cartao = ana.page.getByRole('dialog').filter({ hasText: PAR_NA_CRIPTA })
    if (await cartao.isVisible()) {
      volta = cartao
      break
    }
  }
  expect(volta, `na ${CENA_B}, o pino par (${PAR_NA_CRIPTA}) deveria estar junto da ficha de ${J1}`).not.toBeNull()
  if (volta === null) return

  // Cartão simples: UM botão de pedir, nenhuma lista de saídas, e além dele só o de fechar.
  await expect(volta.getByRole('button', { name: PEDIR_PARA_PASSAR }), `o par de uma saída deveria ter exatamente um "${PEDIR_PARA_PASSAR}". Botões hoje: ${await botoesDoCartao(volta)}`).toHaveCount(1)
  await expect(volta.getByRole('list'), 'o par de uma saída não deveria mostrar lista de saídas').toHaveCount(0)
  await expect(volta.getByRole('button').filter({ hasNotText: PEDIR_PARA_PASSAR }).filter({ hasNotText: /Fechar/i }), `o par de uma saída só tem "${PEDIR_PARA_PASSAR}" e "Fechar". Botões hoje: ${await botoesDoCartao(volta)}`).toHaveCount(0)

  await pedirPeloCartaoSimples(ana, volta, `${J1} no ${PAR_NA_CRIPTA}`)
  await mestreDeixaIr(page, PAR_NA_CRIPTA, CENA_A)
  await anaChegaEm(ana, 'chaoSalao', CENA_A)
})
