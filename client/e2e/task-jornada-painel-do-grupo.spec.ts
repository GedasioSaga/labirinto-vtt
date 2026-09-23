// JORNADA DE USUÁRIO do PAINEL DO GRUPO (G1) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (decidida no modo automático, registrada em PEDIDOS.md como G1):
//   - na aba Jogo, uma seção "Grupo" com UMA LINHA POR JOGADOR: bolinha da cor
//     da ficha dele, nome, online ou fora, e o nome da cena em que ele está;
//   - "Ir lá" na linha: o editor do mestre abre a cena daquele jogador e centra
//     a câmera na ficha dele; a lista Cenas passa a marcar essa cena;
//   - "Mandar para…" na linha: o mestre escolhe a cena de destino e o ponto de
//     chegada (um pino de viagem daquela cena ou "Centro da cena") e confirma;
//     a ficha vai para lá SEM pedido do jogador. O jogador passa a ver a cena
//     nova e lê "O mestre levou você para outro lugar"; o nome da cena de
//     destino nunca vai a ele; quem ficou na cena de origem vê a ficha sumir;
//   - a linha atualiza a cena na hora, depois do "Mandar para…" e depois de uma
//     viagem aprovada ("Deixar ir").
//
// ONDE ISSO MORRE HOJE: a aba Jogo (`components/RoomPanel.tsx`) só tem os cards
// de "Jogadores" com o texto " · em <cena>" e os botões de atribuir e remover
// ficha. Não há seção "Grupo", nem "Ir lá" nem "Mandar para…" por jogador; a
// troca de cena de uma ficha (`adventureStore.transferToken`) só roda quando o
// jogador pede e o mestre aprova.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (mesmo preparo de
// task-jornada-viagem-do-jogador.spec.ts):
//   QUATRO TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa
//   página; cada um dos três jogadores é o `player.html` inteiro no próprio
//   contexto de navegador. Só o TRANSPORTE Rust é falsificado: o que o jogador
//   manda pelo WebSocket roteado vira `net:message` na página do mestre (a
//   mensagem é o `JSON.parse` do que chegou no socket), e o `net_send` do
//   mestre volta ao socket do jogador por `exposeFunction`. A sessão do host é
//   a do app (`net/hostBridge.ts`), sem estado injetado.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: duas cenas e o par de pinos de
//   viagem vêm de um `adventure.json` no disco falso do Tauri, aberto pelo
//   menu ("Carregar Mapa existente"), como na mesa.
//   GESTO REAL NA AÇÃO SOB TESTE. Clique e toque pelo ponteiro. Os únicos
//   `evaluate` são o repasse do transporte e a LEITURA de pixel (decodifica a
//   foto num canvas solto e pergunta `elementFromPoint`).
//   PROVA NA TELA. Texto visível e pixel: a cena que cada tela mostra sai da
//   COR DO CHÃO (Salão verde-água, Cripta magenta) e cada ficha da própria cor
//   (Ana verde-limão, Bruno laranja, Carla azul — amarelo fica de fora porque
//   a cabeça dos pinos é dourada).
//   FRAMES. Com o socket roteado o navegador não emite `page.on('websocket')`;
//   o que a página recebe é o que a rota entrega com `ws.send`, e é ali que a
//   régua escuta, só anotando (`Rede.enviados`).
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - a seção "Grupo" é um cabeçalho-botão "Grupo" com `aria-controls` (como
//     "Cenas"), ou uma região/lista/grupo com nome acessível "Grupo";
//   - cada linha é um item de lista (`listitem`) ou uma linha de tabela (`row`)
//     e diz "online" para quem está conectado;
//   - os botões da linha chamam "Ir lá" e "Mandar para…" (reticência de um
//     caractere ou três pontos);
//   - no "Mandar para…", a cena e a chegada são escolhidas por botão, rádio,
//     item de menu, opção de lista ou `<select>` com o nome delas (o pino pelo
//     texto dele), dentro de um diálogo ou do próprio painel Jogo; o botão que
//     confirma chama "Mandar", "Confirmar", "Levar", "Enviar", "Mover" ou "OK"
//     (`CONFIRMAR_ENVIO`);
//   - "perto do centro" = a ficha a menos de 15% do menor lado do canvas do
//     editor, a partir do centro do canvas inteiro OU do centro da parte que o
//     painel não cobre. Calibrado em 22/09 com o "Ir lá" do aviso de chegada
//     (que já centra): ficha a 0,5 px do centro do canvas; o pino par da
//     Cripta fica longe do meio para "só abrir a cena" não passar.
//
// ACHADO AO CALIBRAR (22/09): depois de uma viagem aprovada, o snapshot que o
// jogador recebe traz `"map":{"name":"Cripta Rubra",…}` — o mapa da cena leva o
// nome dela. Para o teste 3 ficar verde, o nome do mapa não pode ir ao jogador.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Três jogadores entram, recebem
// fichas, a aba Jogo mostra os três e cada um vê a própria ficha. Os testes 4
// e 5 ainda passam por uma viagem aprovada (verde hoje) antes de cobrar o que
// falta, para o vermelho deles não ser a infraestrutura.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'GRUP01'
const J1 = 'Ana'
const J2 = 'Bruno'
const J3 = 'Carla'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'

const TOKEN_J1 = 'Lanterna'
const TOKEN_J2 = 'Machado'
const TOKEN_J3 = 'Cajado'
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
const COR_J3 = '#2a4dff'

type Ponto = { x: number; y: number }

const POS_J1: Ponto = { x: 700, y: 300 }
const POS_J2: Ponto = { x: 820, y: 300 }
const POS_J3: Ponto = { x: 580, y: 300 }
const POS_ESCADA_A: Ponto = { x: 900, y: 440 }
/**
 * Pino par LONGE do meio da Cripta (o meio do mundo é 1000,300): quem abre a
 * Cripta só com "encaixar a cena" deixa a ficha a ~440 px do centro da tela, e
 * o "Ir lá" que não centra na ficha não passa por acaso.
 */
const POS_ESCADA_B: Ponto = { x: 1700, y: 450 }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/**
 * A leitura da tela do MESTRE custa mais (medido em 22/09: foto ~2 s + contagem
 * 5-7 s, porque quase todo pixel é chão e passa pelo teste de cor): 15 s davam
 * só duas leituras.
 */
const ESPERA_TELA_MESTRE = 25_000
/** Cabeça do pino: centro 23 px de mundo acima da ponta (`lib/pins.ts`); 31 acerta a cabeça e foge do token. */
const CABECA_DO_PINO = 31

/** Pixels mínimos para dizer "isto está na tela". */
const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/** Pixels mínimos da bolinha de cor numa linha do Grupo. */
const PIXELS_DE_BOLINHA = 12
/** Pixels máximos para dizer "isto NÃO está na tela" (antisserrilhado e sombra). */
const RESIDUO = 25
/** "Perto do centro": fração do menor lado da área visível do canvas. */
const PERTO_DO_CENTRO = 0.15

const GRUPO = 'Grupo'
const IR_LA = 'Ir lá'
const MANDAR_PARA = /^Mandar para(…|\.\.\.)$/
const CENTRO_DA_CENA = 'Centro da cena'
const CONFIRMAR_ENVIO = /^(mandar|confirmar|levar|enviar|mover|ok|mandar para lá|levar para lá)$/i
const ONLINE = /\bonline\b/i
const LEVADO = 'O mestre levou você para outro lugar'
const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/
const VOCE_CHEGOU = /Você chegou/

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

// O mapa de cada cena leva o nome da cena, como o app grava (`adventureStore`
// cria a cena com `createEmptyMap(id, sceneName, …)`): é por isso que "o nome da
// Cripta nunca vai ao jogador" vale também para o mapa que viaja no snapshot.
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
    [token('tok-lanterna', TOKEN_J1, POS_J1, COR_J1), token('tok-machado', TOKEN_J2, POS_J2, COR_J2), token('tok-cajado', TOKEN_J3, POS_J3, COR_J3)],
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
  const lista = await secaoCenas(mestre)
  await expect.poll(() => estaDestacada(entradaDaCena(lista, CENA_A)), { message: `a aventura deveria abrir na cena "${CENA_A}"` }).toBe(true)
  await expect(entradaDaCena(lista, CENA_B), `a lista de Cenas deveria ter "${CENA_B}"`).toBeVisible()

  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

/** A seção "Cenas" da aba Mapa, aberta (mesmo gesto de task-jornada-pino-de-viagem). */
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

function painelJogo(mestre: Page): Locator {
  return mestre.locator('#lb-rail-panel-room')
}

/** Card de hoje em "Jogadores" (o que existe antes do G1). */
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

/**
 * A seção "Grupo" da aba Jogo. Aceita as duas formas que o app já usa: um
 * cabeçalho-botão com `aria-controls` (como "Cenas"), aberto se estiver
 * fechado, ou uma região/lista/grupo com nome acessível "Grupo".
 */
async function secaoGrupo(mestre: Page): Promise<Locator> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = painelJogo(mestre)
  await expect(painel.getByRole('button', { name: 'Fechar sala' }).or(painel.getByText(CODIGO)).first(), 'a aba Jogo deveria estar aberta, com a sala').toBeVisible({ timeout: ESPERA })
  const cabecalho = painel.getByRole('button', { name: GRUPO, exact: true })
  if ((await cabecalho.count()) > 0) {
    if ((await cabecalho.getAttribute('aria-expanded')) === 'false') await cabecalho.click()
    const corpo = await cabecalho.getAttribute('aria-controls')
    if (corpo) return mestre.locator(`[id="${corpo}"]`)
  }
  const secao = painel
    .getByRole('region', { name: GRUPO, exact: true })
    .or(painel.getByRole('list', { name: GRUPO, exact: true }))
    .or(painel.getByRole('group', { name: GRUPO, exact: true }))
    .or(painel.getByRole('table', { name: GRUPO, exact: true }))
    .first()
  await expect(secao, `a aba Jogo deveria ter uma seção "${GRUPO}" (cabeçalho "${GRUPO}" ou região/lista com esse nome)`).toBeVisible({ timeout: ESPERA })
  return secao
}

function linhasDoGrupo(secao: Locator): Locator {
  return secao.getByRole('listitem').or(secao.getByRole('row'))
}

/** A linha de um jogador na seção "Grupo". */
async function linhaDoGrupo(mestre: Page, jogador: string): Promise<Locator> {
  const secao = await secaoGrupo(mestre)
  const linha = linhasDoGrupo(secao).filter({ hasText: jogador })
  await expect(linha, `a seção "${GRUPO}" deveria ter UMA linha de ${jogador}`).toHaveCount(1, { timeout: ESPERA })
  return linha
}

/** Um botão da linha do jogador no Grupo, visível. */
async function botaoDaLinha(mestre: Page, jogador: string, nome: string | RegExp, rotulo: string): Promise<Locator> {
  const linha = await linhaDoGrupo(mestre, jogador)
  const botao = linha.getByRole('button', { name: nome })
  await expect(botao, `a linha de ${jogador} no "${GRUPO}" deveria ter o botão "${rotulo}"`).toBeVisible({ timeout: ESPERA })
  return botao
}

/**
 * Escolhe uma opção do "Mandar para…": botão, rádio, item de menu ou opção de
 * lista com esse nome; ou, se for `<select>`, a opção com esse texto.
 */
function opcaoDoEnvio(mestre: Page, escopo: Locator, nome: string): { clicavel: Locator; lista: Locator } {
  const exato = new RegExp(`^\\s*(●\\s*)?${escapar(nome)}\\s*$`)
  const clicavel = escopo
    .getByRole('radio', { name: exato })
    .or(escopo.getByRole('button', { name: exato }))
    .or(escopo.getByRole('menuitem', { name: exato }))
    .or(escopo.getByRole('menuitemradio', { name: exato }))
    .or(escopo.getByRole('option', { name: exato }))
  const lista = escopo.getByRole('combobox').filter({ has: mestre.locator('option', { hasText: nome }) })
  return { clicavel, lista }
}

/** O "Mandar para…" oferece esta opção (sem escolher). */
async function ofereceNoEnvio(mestre: Page, escopo: Locator, nome: string, oQue: string): Promise<void> {
  const { clicavel, lista } = opcaoDoEnvio(mestre, escopo, nome)
  await expect
    .poll(async () => (await clicavel.count()) + (await lista.count()), { timeout: ESPERA, message: `${oQue}: o "Mandar para…" deveria oferecer "${nome}"` })
    .toBeGreaterThan(0)
}

async function escolher(mestre: Page, escopo: Locator, nome: string, oQue: string): Promise<void> {
  const { clicavel, lista } = opcaoDoEnvio(mestre, escopo, nome)
  await ofereceNoEnvio(mestre, escopo, nome, oQue)
  if ((await lista.count()) > 0) {
    const texto = (await lista.first().locator('option', { hasText: nome }).first().textContent()) ?? nome
    await lista.first().selectOption({ label: texto.trim() })
    return
  }
  await clicavel.first().click()
}

/** "Mandar para…" na linha do jogador: escolhe a cena, a chegada e confirma. */
async function mandarPara(mestre: Page, jogador: string, destino: string, chegada: string): Promise<void> {
  const botao = await botaoDaLinha(mestre, jogador, MANDAR_PARA, 'Mandar para…')
  await botao.click()
  const escopo = mestre.locator('#lb-rail-panel-room, [role="dialog"]')
  await escolher(mestre, escopo, destino, `mandar ${jogador}: cena de destino`)
  // A chegada é um pino de viagem da cena escolhida OU o centro dela: as duas têm de estar lá.
  await ofereceNoEnvio(mestre, escopo, CENTRO_DA_CENA, `mandar ${jogador}: ponto de chegada`)
  await escolher(mestre, escopo, chegada, `mandar ${jogador}: ponto de chegada`)
  const confirmar = escopo.getByRole('button', { name: CONFIRMAR_ENVIO })
  await expect(confirmar.first(), `mandar ${jogador}: deveria haver um botão de confirmar o envio`).toBeVisible({ timeout: ESPERA })
  await confirmar.first().click()
}

// ───────────────────────────────────────────────────────────────────────────
// Os jogadores: player.html inteiro, cada um no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  clientId: string
  nome: string
  /** Todo frame que a PÁGINA recebeu no WebSocket, desde antes de entrar (a escuta é a própria rota). */
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
  page.on('websocket', (ws) => {
    ws.on('framereceived', (frame) => {
      frames.push(typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('utf8'))
    })
  })
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
  carla: Jogador
}

/** Mestre abre a aventura e a sala; os três entram e recebem a ficha de cada um. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', J2)
  const carla = await jogadorEntra(browser, baseURL, rede, 'c3', J3)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestreAtribui(mestre, J2, TOKEN_J2)
  await mestreAtribui(mestre, J3, TOKEN_J3)
  for (const j of [ana, bruno, carla]) await esperaFichaPropria(j)
  return { rede, ana, bruno, carla }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura de pixel (pura: foto → canvas solto → contagem por cor)
// ───────────────────────────────────────────────────────────────────────────

interface Pixels {
  limao: number
  laranja: number
  azul: number
  chaoA: number
  chaoB: number
  /** Centro da mancha laranja (ficha de Bruno), em px CSS. */
  centroLaranja: Ponto | null
  /** Centro do retângulo do canvas principal, em px CSS (é onde o "Ir lá" de hoje, o do aviso, põe a ficha). */
  centroDoCanvas: Ponto | null
  /** Centro da parte do canvas principal que nenhum painel cobre, em px CSS. */
  centroVisivel: Ponto | null
  /** Menor lado do retângulo do canvas principal, em px CSS. */
  ladoDoCanvas: number
}

type Foto = Awaited<ReturnType<Page['screenshot']>>

async function fotografar(alvo: Page | Locator): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await alvo.screenshot()
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error('não consegui fotografar a tela')
}

/**
 * Conta pixels por cor. `soCanvas`: só onde o canvas PRINCIPAL (o maior) está
 * por cima — painéis, cartões e o minimapa não contam. Sem `soCanvas`, conta a
 * foto inteira (foto de um elemento, como a linha do Grupo).
 */
async function contarCores(page: Page, foto: Foto, soCanvas: boolean): Promise<Pixels> {
  return page.evaluate(
    async ({ b64, apenasCanvas }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escalaX = apenasCanvas ? window.innerWidth / width : 1
      const escalaY = apenasCanvas ? window.innerHeight / height : 1
      let principal: Element | null = null
      let maiorArea = 0
      for (const c of Array.from(document.querySelectorAll('canvas'))) {
        const r = c.getBoundingClientRect()
        if (r.width * r.height > maiorArea) {
          maiorArea = r.width * r.height
          principal = c
        }
      }
      // Quem está por cima, em blocos de 16 px CSS, perguntado UMA vez por bloco:
      // no app do mestre cada `elementFromPoint` custa caro (medido: blocos de 8 px
      // e duas passadas levavam 15 s por leitura e estouravam o poll).
      const BLOCO = 16
      const colunas = Math.ceil(window.innerWidth / BLOCO)
      const linhas = Math.ceil(window.innerHeight / BLOCO)
      const cobertura = new Uint8Array(colunas * linhas) // 0 = não perguntado, 1 = canvas, 2 = outra coisa
      const blocoNoCanvas = (bx: number, by: number): boolean => {
        const k = by * colunas + bx
        if (cobertura[k] === 0) {
          const topo = document.elementFromPoint(bx * BLOCO + BLOCO / 2, by * BLOCO + BLOCO / 2)
          cobertura[k] = principal !== null && topo === principal ? 1 : 2
        }
        return cobertura[k] === 1
      }
      const canvasPorCima = (x: number, y: number): boolean => {
        if (!apenasCanvas) return true
        const bx = Math.min(colunas - 1, Math.floor((x * escalaX) / BLOCO))
        const by = Math.min(linhas - 1, Math.floor((y * escalaY) / BLOCO))
        return blocoNoCanvas(bx, by)
      }
      const r = { limao: 0, laranja: 0, azul: 0, chaoA: 0, chaoB: 0, centroLaranja: null as { x: number; y: number } | null, centroDoCanvas: null as { x: number; y: number } | null, centroVisivel: null as { x: number; y: number } | null, ladoDoCanvas: 0 }
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
          const azul = B > 200 && R < 100 && G < 130
          const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30 && G >= 35
          const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
          if (!limao && !laranja && !azul && !verdeAgua && !magenta) continue
          if (!canvasPorCima(x, y)) continue
          if (limao) r.limao += 1
          else if (laranja) {
            r.laranja += 1
            lx += x
            ly += y
          } else if (azul) r.azul += 1
          else if (verdeAgua) r.chaoA += 1
          else r.chaoB += 1
        }
      }
      if (r.laranja > 0) r.centroLaranja = { x: (lx / r.laranja) * escalaX, y: (ly / r.laranja) * escalaY }
      if (apenasCanvas && principal !== null) {
        const caixa = principal.getBoundingClientRect()
        r.centroDoCanvas = { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 }
        r.ladoDoCanvas = Math.min(caixa.width, caixa.height)
        // Centro da parte do canvas que NÃO está coberta por painel: centrar ali também vale.
        let sx = 0
        let sy = 0
        let n = 0
        for (let by = 0; by < linhas; by += 1) {
          for (let bx = 0; bx < colunas; bx += 1) {
            if (!blocoNoCanvas(bx, by)) continue
            sx += bx * BLOCO + BLOCO / 2
            sy += by * BLOCO + BLOCO / 2
            n += 1
          }
        }
        if (n > 0) r.centroVisivel = { x: sx / n, y: sy / n }
      }
      return r
    },
    { b64: foto.toString('base64'), apenasCanvas: soCanvas },
  )
}

async function lerTela(page: Page): Promise<Pixels> {
  await page.waitForTimeout(PINTURA_MS)
  return contarCores(page, await fotografar(page), true)
}

async function lerLinha(mestre: Page, linha: Locator): Promise<Pixels> {
  return contarCores(mestre, await fotografar(linha), false)
}

function fichaDe(p: Pixels, nome: string): number {
  if (nome === J1) return p.limao
  if (nome === J2) return p.laranja
  return p.azul
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

function cabecaDoPino(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round((p.y - CABECA_DO_PINO) * CAMERA.scale + CAMERA.y) }
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Pino de viagem → "Pedir para passar" → confirmar → o mestre "Deixar ir" → o jogador chega à Cripta. */
async function viagemAprovada(mestre: Page, j: Jogador): Promise<void> {
  await tocar(j.page, cabecaDoPino(POS_ESCADA_A))
  await expect(j.page.getByRole('dialog').filter({ hasText: ESCADA_A }), `${j.nome}: tocar o pino deveria abrir o cartão "${ESCADA_A}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('button', { name: PEDIR_PARA_PASSAR }).click()
  await expect(j.page.getByText(PERGUNTA_DO_PEDIDO), `${j.nome}: pedir deveria perguntar "${PERGUNTA_DO_PEDIDO}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('button', { name: CONFIRMAR_PEDIDO }).filter({ hasNotText: PEDIR_PARA_PASSAR }).first().click()
  await expect(j.page.getByText(AGUARDANDO).first(), `${j.nome}: depois de confirmar deveria ler "Aguardando o mestre…"`).toBeVisible({ timeout: ESPERA })
  const aviso = new RegExp(`${j.nome}[^]*quer passar[^]*${escapar(ESCADA_A)}[^]*${escapar(CENA_B)}`)
  await expect(mestre.getByText(aviso).first(), `o mestre deveria ler "${j.nome} quer passar por ${ESCADA_A} → ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  await mestre.getByRole('button', { name: 'Deixar ir', exact: true }).click()
  await expect(j.page.getByText(VOCE_CHEGOU).first(), `${j.nome} deveria ler "Você chegou"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await lerTela(j.page)).chaoB, { timeout: ESPERA_TELA, message: `${j.nome} deveria passar a ver o chão da ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: três jogadores entram e recebem fichas, a aba Jogo mostra os três e cada um vê a própria ficha', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana, bruno, carla } = await mesaMontada(browser, page, baseURL ?? '')

  await page.getByRole('tab', { name: 'Jogo' }).click()
  for (const nome of [J1, J2, J3]) {
    await expect(cardDeJogador(page, nome), `a aba Jogo deveria mostrar ${nome}`).toBeVisible({ timeout: ESPERA })
  }
  for (const j of [ana, bruno, carla]) {
    const tela = await lerTela(j.page)
    expect(fichaDe(tela, j.nome), `${j.nome} deveria ver a própria ficha`).toBeGreaterThan(PIXELS_DE_TOKEN)
    expect(tela.chaoA, `${j.nome} deveria ver o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
    expect(tela.chaoB, `${j.nome} não deveria ver chão da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  }
  // A leitura de pixel do EDITOR (a do teste 4) enxerga: chão do Salão, a ficha de Bruno e o canvas visível.
  await page.getByRole('tab', { name: 'Mapa' }).click()
  const doMestre = await lerTela(page)
  expect(doMestre.chaoA, `o editor do mestre deveria mostrar o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(doMestre.laranja, `o editor do mestre deveria mostrar a ficha de ${J2}`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(doMestre.centroDoCanvas, 'o canvas do editor deveria estar visível').not.toBeNull()
  expect(doMestre.ladoDoCanvas, 'a área visível do canvas do editor deveria ter tamanho de tela').toBeGreaterThan(300)
})

test('2. a seção "Grupo" tem uma linha por jogador, com bolinha da cor da ficha, nome, online e a cena', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  await mesaMontada(browser, page, baseURL ?? '')

  const secao = await secaoGrupo(page)
  await expect(linhasDoGrupo(secao), `a seção "${GRUPO}" deveria ter uma linha por jogador (3)`).toHaveCount(3, { timeout: ESPERA })
  for (const nome of [J1, J2, J3]) {
    const linha = await linhaDoGrupo(page, nome)
    await expect(linha, `a linha de ${nome} deveria dizer a cena "${CENA_A}"`).toContainText(CENA_A, { timeout: ESPERA })
    await expect(linha, `a linha de ${nome} deveria dizer que está online`).toContainText(ONLINE, { timeout: ESPERA })
    const cores = await lerLinha(page, linha)
    expect(fichaDe(cores, nome), `a linha de ${nome} deveria ter a bolinha da cor da ficha dele`).toBeGreaterThanOrEqual(PIXELS_DE_BOLINHA)
    const outras = [J1, J2, J3].filter((n) => n !== nome).map((n) => fichaDe(cores, n))
    expect(Math.max(...outras), `a linha de ${nome} não deveria ter a cor da ficha de outro jogador`).toBeLessThanOrEqual(RESIDUO)
  }
})

test('3. "Mandar para…" leva Bruno à Cripta sem pedido: a linha muda, Bruno vê a Cripta e o aviso, Ana perde a ficha dele, nada nomeia a Cripta', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  // Controle: antes, Ana vê Bruno no Salão e a escuta de Bruno já ouviu o mapa.
  await expect
    .poll(async () => (await lerTela(ana.page)).laranja, { timeout: ESPERA_TELA, message: `antes do envio, ${J1} deveria ver a ficha de ${J2}` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(bruno.frames.some((f) => f.includes('"snapshot"')), `a escuta de frames de ${J2} não viu nenhum snapshot: a régua de vazamento estaria surda`).toBe(true)
  expect(bruno.frames.filter((f) => f.includes(CENA_B)), `antes do envio, ${J2} já recebeu o nome "${CENA_B}"`).toEqual([])

  await mandarPara(page, J2, CENA_B, ESCADA_B)

  const linha = await linhaDoGrupo(page, J2)
  await expect(linha, `depois do "Mandar para…", a linha de ${J2} deveria dizer "${CENA_B}"`).toContainText(CENA_B, { timeout: ESPERA })
  await expect(linha, `depois do "Mandar para…", a linha de ${J2} não deveria dizer mais "${CENA_A}"`).not.toContainText(CENA_A)

  await expect(bruno.page.getByText(LEVADO).first(), `${J2} deveria ler "${LEVADO}"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await lerTela(bruno.page)).chaoB, { timeout: ESPERA_TELA, message: `${J2} deveria passar a ver o chão da ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  const telaDeBruno = await lerTela(bruno.page)
  expect(telaDeBruno.laranja, `${J2} deveria ver a própria ficha na ${CENA_B}`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(telaDeBruno.chaoA, `${J2} foi para a ${CENA_B} e continua vendo o chão do ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)

  await expect
    .poll(async () => (await lerTela(ana.page)).laranja, { timeout: ESPERA_TELA, message: `a ficha de ${J2} deveria sumir da tela de ${J1}` })
    .toBeLessThanOrEqual(RESIDUO)
  const telaDeAna = await lerTela(ana.page)
  expect(telaDeAna.chaoA, `${J1} deveria continuar vendo o ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(telaDeAna.limao, `${J1} deveria continuar vendo a própria ficha`).toBeGreaterThan(PIXELS_DE_TOKEN)

  expect(bruno.frames.filter((f) => f.includes(CENA_B)), `nenhum frame recebido por ${J2} deveria trazer o nome "${CENA_B}"`).toEqual([])
})

test('4. "Ir lá" na linha de Bruno: o editor abre a Cripta, a lista Cenas marca a Cripta e a ficha dele fica no centro da tela', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { bruno } = await mesaMontada(browser, page, baseURL ?? '')

  // Bruno vai à Cripta pelo caminho de hoje (verde): pedido pelo pino e "Deixar ir".
  await viagemAprovada(page, bruno)
  const antes = await secaoCenas(page)
  expect(await estaDestacada(entradaDaCena(antes, CENA_A)), `antes do "Ir lá", o editor do mestre continua no ${CENA_A}`).toBe(true)

  // Só o "Ir lá" DA LINHA: o aviso de chegada de hoje também tem um "Ir lá", e ele não conta.
  const irLa = await botaoDaLinha(page, J2, IR_LA, IR_LA)
  await irLa.click()

  const lista = await secaoCenas(page)
  await expect.poll(() => estaDestacada(entradaDaCena(lista, CENA_B)), { timeout: ESPERA, message: `depois do "Ir lá", a lista Cenas deveria marcar "${CENA_B}"` }).toBe(true)
  expect(await estaDestacada(entradaDaCena(lista, CENA_A)), `depois do "Ir lá", "${CENA_A}" não deveria continuar marcada`).toBe(false)

  await expect
    .poll(async () => (await lerTela(page)).chaoB, { timeout: ESPERA_TELA_MESTRE, message: `o editor do mestre deveria mostrar o chão da ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  const tela = await lerTela(page)
  expect(tela.laranja, `o editor do mestre deveria mostrar a ficha de ${J2}`).toBeGreaterThan(PIXELS_DE_TOKEN)
  const ficha = tela.centroLaranja
  const centros = [tela.centroDoCanvas, tela.centroVisivel].filter((c): c is Ponto => c !== null)
  expect(ficha, `a ficha de ${J2} sem centro na tela do mestre`).not.toBeNull()
  expect(centros.length, 'o canvas do editor não está visível').toBeGreaterThan(0)
  if (ficha) {
    // Vale o centro do canvas inteiro ou o da parte que o painel não cobre.
    const distancia = Math.min(...centros.map((c) => Math.hypot(ficha.x - c.x, ficha.y - c.y)))
    expect(distancia, `a ficha de ${J2} deveria ficar perto do centro da tela do mestre (limite ${Math.round(tela.ladoDoCanvas * PERTO_DO_CENTRO)} px)`).toBeLessThan(tela.ladoDoCanvas * PERTO_DO_CENTRO)
  }
})

test('5. depois de uma viagem aprovada pelo pino, a linha de Ana no Grupo passa a mostrar a Cripta', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  await viagemAprovada(page, ana)

  const linha = await linhaDoGrupo(page, J1)
  await expect(linha, `depois da viagem aprovada, a linha de ${J1} deveria dizer "${CENA_B}"`).toContainText(CENA_B, { timeout: ESPERA })
  await expect(linha, `depois da viagem aprovada, a linha de ${J1} não deveria dizer mais "${CENA_A}"`).not.toContainText(CENA_A)
})
