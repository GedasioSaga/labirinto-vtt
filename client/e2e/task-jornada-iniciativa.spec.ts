// JORNADA DE USUÁRIO da ORDEM DE INICIATIVA (item 20 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - na aba Jogo, uma seção "Iniciativa" onde o mestre monta a ordem: cada
//     ficha da cena aberta tem um campo "Iniciativa de <ficha>"; a ficha com
//     valor entra na ordem, e a ordem aparece do MAIOR valor para o menor;
//     ficha sem valor fica de fora;
//   - a vez começa no primeiro da ordem; o botão "Próxima vez" (ou a tecla
//     que ele anuncia) passa a vez ao seguinte, e do último volta ao primeiro;
//   - a ficha da vez fica DESTACADA no mapa do mestre e na tela de quem joga;
//   - o dono da ficha da vez lê "sua vez" na tela dele; os outros não;
//   - ficha secreta (`secret`, que o jogador nunca recebe) pode estar na ordem:
//     na vez dela o jogador não recebe o nome dela nem vê destaque nenhum.
//
// ONDE ISSO MORRE HOJE: não há iniciativa, turno nem vez em lugar nenhum de
// `client/src` (grep "iniciativa|initiative|sua vez|aria-keyshortcuts" dá
// zero; a própria candidata registra isso em
// docs/features-candidatas-2026-09-21.md:30). A aba Jogo
// (`components/RoomPanel.tsx`) só tem a sala e os cards de "Jogadores" com
// "Atribuir <ficha>" (RoomPanel.tsx:89); o protocolo do jogador
// (`net/hostSession.ts`) não tem mensagem de vez; `lib/fogFilter.ts:650-652`
// manda ao jogador só fichas, sem nada que diga de quem é a vez.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (mesmo preparo de
// task-jornada-painel-do-grupo.spec.ts e task-jornada-viagem-do-jogador.spec.ts):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   cada jogador é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo WebSocket
//   roteado vira `net:message` na página do mestre, e o `net_send` do mestre
//   volta ao socket do jogador por `exposeFunction`. A sessão do host é a do
//   app (`net/hostBridge.ts`), sem estado injetado.
//   DISCO DE MENTIRA: a aventura (uma cena) vem de um `adventure.json` no disco
//   falso do Tauri, aberta pelo menu "Carregar Mapa existente", como na mesa.
//   GESTO REAL NA AÇÃO SOB TESTE: clique de ponteiro, digitação tecla a tecla
//   (`pressSequentially`), Tab para sair do campo e a tecla de atalho pelo
//   teclado. Os únicos `evaluate` são o repasse do transporte e a LEITURA de
//   pixel (decodifica a foto num canvas solto e pergunta `elementFromPoint`).
//   PROVA NA TELA: a ordem e a vez pelo nome acessível e pelo texto visível;
//   o "sua vez" pelo texto renderizado (`innerText`) da tela do jogador; o
//   DESTAQUE por pixel: foto de antes (sem iniciativa) contra foto de depois,
//   contando pixels que mudaram numa janela quadrada em volta de cada ficha.
//   Cada ficha tem cor própria (Lanterna verde-limão, Machado laranja, Goblin
//   azul) e a janela sai da mancha dessa cor na foto de antes. Assim a régua
//   não dita a COR nem a FORMA do destaque — só que ele aparece na ficha da
//   vez, não nas outras, e sai quando a vez sai.
//   FRAMES: o que cada jogador recebeu no WebSocket é anotado (só lido) para
//   provar que o nome da ficha secreta nunca foi a ele.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - a seção fica na aba Jogo (`#lb-rail-panel-room`), é um cabeçalho-botão
//     "Iniciativa" com `aria-controls` (como "Cenas") ou uma região/grupo com
//     nome acessível "Iniciativa";
//   - o valor de cada ficha é um campo (spinbutton ou textbox) com nome
//     acessível "Iniciativa de <nome da ficha>"; o valor vale ao sair do campo
//     (Tab);
//   - a ordem é uma lista (ou tabela) com nome acessível "Ordem de iniciativa";
//     cada entrada é um `listitem` (ou `row`) com o nome da ficha e o valor;
//   - a entrada da vez tem `aria-current` (qualquer valor diferente de
//     "false"), e só ela;
//   - a vez já começa no primeiro da ordem, OU um botão "Começar"/"Iniciar"
//     (`COMECAR`) da seção a põe lá;
//   - o botão que passa a vez chama "Próxima vez" (aceita também "Próximo",
//     "Próximo turno", "Avançar vez", "Passar a vez"; `PROXIMA_VEZ`) e declara
//     a tecla dele em `aria-keyshortcuts` (é assim que o mestre descobre o
//     atalho sem manual); a tecla funciona com o foco no mapa;
//   - o jogador da vez lê um texto com "sua vez" (ex.: "Sua vez", "É a sua
//     vez"); quem não é da vez não lê "sua vez";
//   - "destacada" = pelo menos `DESTAQUE_MIN` pixels mudam na janela da ficha
//     (lado ≈ 3,2 x o diâmetro dela), e no máximo `RESIDUO_ZONA` nas janelas
//     das outras.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Dois jogadores entram e recebem
// fichas; o mestre e os dois veem as três fichas visíveis em janelas que não
// se tocam; duas fotos seguidas da mesma tela NÃO mudam nas janelas (sem isso
// o "destaque" poderia ser ruído de animação); a escuta de frames ouve o nome
// do Goblin e não ouve o da ficha secreta. Sem ele, o vermelho dos testes 2 a
// 7 poderia ser a infraestrutura, e não a feature ausente.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'INIC01'
const J1 = 'Ana'
const J2 = 'Bruno'
const AVENTURA = 'Aventura da Ponte'
const CENA = 'Ponte Velha'
const ID_CENA = 'scene_ponte'
const PASTA = 'C:/appdata/maps/map_ponte'

/** Ficha de Ana. */
const LANTERNA = 'Lanterna'
/** Ficha de Bruno. */
const MACHADO = 'Machado'
/** Ficha do mestre, visível aos jogadores. */
const GOBLIN = 'Goblin'
/** Ficha do mestre SECRETA: o jogador nunca a recebe (lib/fogFilter.ts:650-652). */
const VULTO = 'Vulto'

/** Valores digitados: a ordem esperada (17, 12, 9, 5) não é a ordem do mapa nem a da digitação. */
const INICIATIVA: Record<string, number> = { [LANTERNA]: 12, [MACHADO]: 17, [GOBLIN]: 5, [VULTO]: 9 }

const GRADE = 50
const COLUNAS = 24
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }

const CHAO = '#1e8c8c'
const COR_LANTERNA = '#3cff00'
const COR_MACHADO = '#ff5a00'
const COR_GOBLIN = '#2a4dff'
/** Cinza neutro: nenhuma das cores que a régua conta. */
const COR_VULTO = '#808080'

type Ponto = { x: number; y: number }

// Fichas a 300 px de mundo umas das outras: o destaque de uma não cai na janela da outra.
// Calibrado em 23/09 pelas fotos da primeira rodada: o jogador enxerga ~700 px
// em volta da própria ficha (quem estava a 1200 px não aparecia) e o painel do
// jogador cobre a faixa esquerda da tela (~285 px). O editor do mestre abre
// ENQUADRANDO AS FICHAS na largura inteira do canvas, sem descontar o rail que
// cobre a mesma faixa (medido: fichas de 450 a 1050 → zoom 185% e a Lanterna
// debaixo do rail). Por isso a ficha SECRETA fica na ponta esquerda: ela
// alarga o enquadramento do mestre (a Lanterna sai de baixo do rail) e não
// existe para o jogador. Mapa de 1200 px: as três visíveis ficam ao alcance da
// visão de Ana e de Bruno.
const POS_LANTERNA: Ponto = { x: 450, y: 300 }
const POS_MACHADO: Ponto = { x: 750, y: 300 }
const POS_GOBLIN: Ponto = { x: 1050, y: 300 }
const POS_VULTO: Ponto = { x: 100, y: 300 }

/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** A tela do mestre custa mais para ler (foto ~2 s + contagem; medido na régua do Grupo). */
const ESPERA_TELA_MESTRE = 25_000

/** Pixels mínimos da cor de uma ficha para dizer "esta ficha está na tela". */
const PIXELS_DE_TOKEN = 60
/** Soma de |ΔR|+|ΔG|+|ΔB| acima da qual um pixel "mudou" entre a foto de antes e a de depois. */
const LIMIAR_DE_MUDANCA = 60
/** Pixels mudados na janela da ficha para dizer "esta ficha está destacada". */
const DESTAQUE_MIN = 40
/** Pixels mudados tolerados na janela de uma ficha que NÃO está destacada. */
const RESIDUO_ZONA = 12
/** Janela da ficha: meio-lado = FATOR x o raio da mancha + MARGEM (px da foto). */
const FATOR_DA_JANELA = 1.6
const MARGEM_DA_JANELA = 6

const INICIATIVA_SECAO = 'Iniciativa'
const ORDEM = 'Ordem de iniciativa'
const COMECAR = /^(começar|iniciar)( (o )?(combate|rodada|iniciativa))?$/i
const PROXIMA_VEZ = /^(próxima vez|próximo|próximo turno|avançar( a)? vez|passar (a )?vez)(\s*\(.+\))?$/i
const SUA_VEZ = /\bsua vez\b/i

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: uma cena, quatro fichas (uma secreta)
// ───────────────────────────────────────────────────────────────────────────

function ficha(id: string, name: string, p: Ponto, color: string, secret = false): Token {
  const t: Token = { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
  return secret ? { ...t, secret: true } : t
}

function discoDaAventura(): Record<string, string> {
  const base = createEmptyMap('map_ponte', AVENTURA, COLUNAS, LINHAS, GRADE)
  const mapa: MapData = {
    ...base,
    floor: [{ id: 'ponte-chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: CHAO },
    tokens: [
      ficha('tok-lanterna', LANTERNA, POS_LANTERNA, COR_LANTERNA),
      ficha('tok-machado', MACHADO, POS_MACHADO, COR_MACHADO),
      ficha('tok-goblin', GOBLIN, POS_GOBLIN, COR_GOBLIN),
      ficha('tok-vulto', VULTO, POS_VULTO, COR_VULTO, true),
    ],
  }
  const aventura = {
    version: 1,
    id: 'adv_ponte',
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
  await mestre.getByRole('button', { name: new RegExp(escapar(AVENTURA)) }).click()
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

/** Aba Jogo, card do jogador, "Atribuir <ficha>" — o clique de um toque que o painel oferece. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDaFicha: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const card = cardDeJogador(mestre, jogador)
  await card.getByRole('button', { name: `Atribuir ${nomeDaFicha}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDaFicha}` }), `${jogador} deveria ficar com ${nomeDaFicha}`).toBeVisible()
}

// ───────────────────────────────────────────────────────────────────────────
// A seção Iniciativa (o que a feature tem de pôr na tela)
// ───────────────────────────────────────────────────────────────────────────

/**
 * A seção "Iniciativa" da aba Jogo. Aceita as duas formas que o app já usa: um
 * cabeçalho-botão com `aria-controls` (como "Cenas"), aberto se estiver
 * fechado, ou uma região/grupo com nome acessível "Iniciativa".
 */
async function secaoIniciativa(mestre: Page): Promise<Locator> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = painelJogo(mestre)
  await expect(painel.getByText(CODIGO).first(), 'a aba Jogo deveria estar aberta, com a sala').toBeVisible({ timeout: ESPERA })
  const cabecalho = painel.getByRole('button', { name: INICIATIVA_SECAO, exact: true })
  if ((await cabecalho.count()) > 0) {
    if ((await cabecalho.getAttribute('aria-expanded')) === 'false') await cabecalho.click()
    const corpo = await cabecalho.getAttribute('aria-controls')
    if (corpo) return mestre.locator(`[id="${corpo}"]`)
  }
  const secao = painel
    .getByRole('region', { name: INICIATIVA_SECAO, exact: true })
    .or(painel.getByRole('group', { name: INICIATIVA_SECAO, exact: true }))
    .first()
  await expect(secao, `a aba Jogo deveria ter uma seção "${INICIATIVA_SECAO}" (cabeçalho "${INICIATIVA_SECAO}" ou região com esse nome)`).toBeVisible({ timeout: ESPERA })
  return secao
}

function campoDeIniciativa(secao: Locator, nomeDaFicha: string): Locator {
  const nome = `Iniciativa de ${nomeDaFicha}`
  return secao.getByRole('spinbutton', { name: nome, exact: true }).or(secao.getByRole('textbox', { name: nome, exact: true }))
}

function ordemDeIniciativa(secao: Locator): Locator {
  return secao.getByRole('list', { name: ORDEM, exact: true }).or(secao.getByRole('table', { name: ORDEM, exact: true }))
}

function entradasDaOrdem(ordem: Locator): Locator {
  return ordem.getByRole('listitem').or(ordem.getByRole('row'))
}

/** Digita o valor de cada ficha no campo dela, tecla a tecla, e sai do campo com Tab. */
async function montarOrdem(mestre: Page, fichas: string[]): Promise<Locator> {
  const secao = await secaoIniciativa(mestre)
  for (const nome of fichas) {
    const campo = campoDeIniciativa(secao, nome)
    await expect(campo, `a seção "${INICIATIVA_SECAO}" deveria ter o campo "Iniciativa de ${nome}"`).toBeVisible({ timeout: ESPERA })
    await campo.click()
    await mestre.keyboard.press('Control+A')
    await campo.pressSequentially(String(INICIATIVA[nome]), { delay: 20 })
    await mestre.keyboard.press('Tab')
  }
  const ordem = ordemDeIniciativa(secao)
  await expect(ordem, `a seção "${INICIATIVA_SECAO}" deveria mostrar a lista "${ORDEM}"`).toBeVisible({ timeout: ESPERA })
  return secao
}

/** A vez começa no primeiro: já começou, ou o botão "Começar"/"Iniciar" da seção a põe lá. */
async function comecar(secao: Locator): Promise<void> {
  const botao = secao.getByRole('button', { name: COMECAR })
  if ((await botao.count()) > 0 && (await botao.first().isVisible())) await botao.first().click()
}

function botaoProximaVez(secao: Locator): Locator {
  return secao.getByRole('button', { name: PROXIMA_VEZ })
}

async function proximaVez(mestre: Page): Promise<void> {
  const secao = await secaoIniciativa(mestre)
  const botao = botaoProximaVez(secao)
  await expect(botao.first(), `a seção "${INICIATIVA_SECAO}" deveria ter o botão "Próxima vez"`).toBeVisible({ timeout: ESPERA })
  await botao.first().click()
}

/** Quais fichas a ordem mostra, na ordem da tela. */
async function fichasNaOrdem(secao: Locator): Promise<string[]> {
  const entradas = entradasDaOrdem(ordemDeIniciativa(secao))
  const textos = await entradas.allInnerTexts()
  // Linha sem nome de ficha (cabeçalho de tabela) não é entrada da ordem.
  return textos.map((t) => [LANTERNA, MACHADO, GOBLIN, VULTO].find((n) => t.includes(n))).filter((n): n is string => n !== undefined)
}

/** As fichas das entradas marcadas com `aria-current` (a vez). */
async function fichasDaVez(secao: Locator): Promise<string[]> {
  const entradas = entradasDaOrdem(ordemDeIniciativa(secao))
  const n = await entradas.count()
  const daVez: string[] = []
  for (let i = 0; i < n; i += 1) {
    const atual = await entradas.nth(i).getAttribute('aria-current')
    if (atual === null || atual === 'false') continue
    const texto = await entradas.nth(i).innerText()
    daVez.push([LANTERNA, MACHADO, GOBLIN, VULTO].find((nome) => texto.includes(nome)) ?? `?(${texto.trim()})`)
  }
  return daVez
}

async function esperaVezNaOrdem(mestre: Page, nomeDaFicha: string, contexto: string): Promise<void> {
  await expect
    .poll(async () => fichasDaVez(await secaoIniciativa(mestre)), { timeout: ESPERA, message: `${contexto}: a ordem deveria marcar SÓ "${nomeDaFicha}" como a da vez (aria-current)` })
    .toEqual([nomeDaFicha])
}

// ───────────────────────────────────────────────────────────────────────────
// Os jogadores: player.html inteiro, cada um no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  clientId: string
  nome: string
  ficha: string
  /** Todo frame que a PÁGINA recebeu no WebSocket, desde antes de entrar. */
  frames: string[]
}

/** Contextos de jogador abertos pelo teste que está rodando: fechados no afterEach. */
const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string, fichaDele: string): Promise<Jogador> {
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
  return { page, clientId, nome, ficha: fichaDele, frames }
}

/** Só o texto RENDERIZADO da página (innerText ignora o que está escondido). */
async function textoNaTela(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura de pixel (pura: foto → canvas solto → contagem)
// ───────────────────────────────────────────────────────────────────────────

type Cor = 'limao' | 'laranja' | 'azul'
const COR_DA_FICHA: Record<string, Cor> = { [LANTERNA]: 'limao', [MACHADO]: 'laranja', [GOBLIN]: 'azul' }
const FICHAS_VISIVEIS = [LANTERNA, MACHADO, GOBLIN]

/** Janela quadrada em volta de uma ficha, em px da foto. */
interface Janela {
  cx: number
  cy: number
  meio: number
  n: number
}
type Janelas = Record<Cor, Janela | null>

type Foto = Awaited<ReturnType<Page['screenshot']>>

async function fotografar(page: Page): Promise<Foto> {
  await page.waitForTimeout(PINTURA_MS)
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
 * Acha a mancha de cada cor de ficha onde o canvas PRINCIPAL (o maior) está
 * por cima, e devolve a janela em volta dela. Leitura pura: nada do app muda.
 */
async function acharJanelas(page: Page, foto: Foto): Promise<Janelas> {
  return page.evaluate(
    async ({ b64, fator, margem, minimo }) => {
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
      const vazia = () => ({ n: 0, sx: 0, sy: 0, x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity })
      const m = { limao: vazia(), laranja: vazia(), azul: vazia() }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          let cor: keyof typeof m | null = null
          if (G > 200 && R > 20 && R < 120 && B < 60) cor = 'limao'
          else if (R > 200 && G > 50 && G < 140 && B < 60) cor = 'laranja'
          else if (B > 200 && R < 100 && G < 130) cor = 'azul'
          if (cor === null || !canvasPorCima(x, y)) continue
          const a = m[cor]
          a.n += 1
          a.sx += x
          a.sy += y
          if (x < a.x1) a.x1 = x
          if (y < a.y1) a.y1 = y
          if (x > a.x2) a.x2 = x
          if (y > a.y2) a.y2 = y
        }
      }
      const janela = (a: ReturnType<typeof vazia>) => {
        if (a.n < minimo) return null
        const raio = Math.max(a.x2 - a.x1, a.y2 - a.y1) / 2
        return { cx: a.sx / a.n, cy: a.sy / a.n, meio: raio * fator + margem, n: a.n }
      }
      return { limao: janela(m.limao), laranja: janela(m.laranja), azul: janela(m.azul) }
    },
    { b64: foto.toString('base64'), fator: FATOR_DA_JANELA, margem: MARGEM_DA_JANELA, minimo: PIXELS_DE_TOKEN },
  )
}

/**
 * Quantos pixels mudaram entre `antes` e `depois` na janela de cada ficha,
 * contando só onde o canvas principal está por cima AGORA (um aviso por cima
 * da ficha não vira "destaque"). Janela ausente → -1.
 */
async function mudancasNasJanelas(page: Page, antes: Foto, depois: Foto, janelas: Janelas): Promise<Record<Cor, number>> {
  return page.evaluate(
    async ({ a64, d64, js, limiar }) => {
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
      const A = await decodificar(a64)
      const D = await decodificar(d64)
      if (A.width !== D.width || A.height !== D.height) throw new Error('fotos de tamanhos diferentes')
      const escalaX = window.innerWidth / D.width
      const escalaY = window.innerHeight / D.height
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
      const contar = (j: { cx: number; cy: number; meio: number } | null): number => {
        if (j === null) return -1
        let n = 0
        const x1 = Math.max(0, Math.floor(j.cx - j.meio))
        const x2 = Math.min(D.width - 1, Math.ceil(j.cx + j.meio))
        const y1 = Math.max(0, Math.floor(j.cy - j.meio))
        const y2 = Math.min(D.height - 1, Math.ceil(j.cy + j.meio))
        for (let y = y1; y <= y2; y += 1) {
          for (let x = x1; x <= x2; x += 1) {
            const i = (y * D.width + x) * 4
            const delta = Math.abs(A.data[i] - D.data[i]) + Math.abs(A.data[i + 1] - D.data[i + 1]) + Math.abs(A.data[i + 2] - D.data[i + 2])
            if (delta > limiar && canvasPorCima(x, y)) n += 1
          }
        }
        return n
      }
      return { limao: contar(js.limao), laranja: contar(js.laranja), azul: contar(js.azul) }
    },
    { a64: antes.toString('base64'), d64: depois.toString('base64'), js: janelas, limiar: LIMIAR_DE_MUDANCA },
  )
}

/** A foto de ANTES de uma tela e as janelas das três fichas visíveis nela. */
interface Referencia {
  page: Page
  quem: string
  antes: Foto
  janelas: Janelas
}

async function referencia(page: Page, quem: string, espera: number): Promise<Referencia> {
  let ultima: { antes: Foto; janelas: Janelas } | null = null
  await expect
    .poll(
      async () => {
        const antes = await fotografar(page)
        const janelas = await acharJanelas(page, antes)
        ultima = { antes, janelas }
        return FICHAS_VISIVEIS.filter((n) => janelas[COR_DA_FICHA[n]] === null)
      },
      { timeout: espera, message: `${quem}: as três fichas visíveis (${FICHAS_VISIVEIS.join(', ')}) deveriam estar pintadas na tela` },
    )
    .toEqual([])
  if (ultima === null) throw new Error('sem foto de referência')
  const { antes, janelas } = ultima as { antes: Foto; janelas: Janelas }
  return { page, quem, antes, janelas }
}

/** Pixels mudados, agora, na janela de cada ficha visível, contra a foto de antes. */
async function mudancas(ref: Referencia): Promise<Record<string, number>> {
  const agora = await fotografar(ref.page)
  const porCor = await mudancasNasJanelas(ref.page, ref.antes, agora, ref.janelas)
  return Object.fromEntries(FICHAS_VISIVEIS.map((n) => [n, porCor[COR_DA_FICHA[n]]]))
}

/** Qual ficha está destacada: acima de `DESTAQUE_MIN`; "nenhuma"/"várias" quando for o caso. */
function destacadas(m: Record<string, number>): string[] {
  return FICHAS_VISIVEIS.filter((n) => m[n] >= DESTAQUE_MIN)
}

/** Espera o destaque estar SÓ na ficha `nome` (ou em nenhuma, com `null`) e as outras janelas limpas. */
async function esperaDestaque(ref: Referencia, nome: string | null, espera: number): Promise<void> {
  let ultimo: Record<string, number> = {}
  const alvo = nome === null ? 'nenhuma ficha' : `a ficha "${nome}"`
  await expect
    .poll(
      async () => {
        ultimo = await mudancas(ref)
        const limpas = FICHAS_VISIVEIS.filter((n) => n !== nome).every((n) => ultimo[n] <= RESIDUO_ZONA)
        return { destacadas: destacadas(ultimo), outrasLimpas: limpas }
      },
      { timeout: espera, message: `${ref.quem}: deveria destacar ${alvo} e deixar as outras como estavam (pixels mudados por janela: ${JSON.stringify(ultimo)})` },
    )
    .toEqual({ destacadas: nome === null ? [] : [nome], outrasLimpas: true })
}

// ───────────────────────────────────────────────────────────────────────────
// A mesa montada
// ───────────────────────────────────────────────────────────────────────────

interface Mesa {
  rede: Rede
  ana: Jogador
  bruno: Jogador
}

/** Mestre abre a aventura e a sala; Ana e Bruno entram e recebem as fichas; cada um vê a própria. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1, LANTERNA)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', J2, MACHADO)
  await mestreAtribui(mestre, J1, LANTERNA)
  await mestreAtribui(mestre, J2, MACHADO)
  for (const j of [ana, bruno]) {
    await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu na tela`).toBeVisible({ timeout: 45_000 })
  }
  return { rede, ana, bruno }
}

/** O mestre olha o MAPA: a aba Mapa aberta, como na mesa durante o combate. */
async function mestreOlhaMapa(mestre: Page): Promise<void> {
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
}

async function referenciaDoMestre(mestre: Page): Promise<Referencia> {
  await mestreOlhaMapa(mestre)
  return referencia(mestre, 'mapa do mestre', ESPERA_TELA_MESTRE)
}

/** Um ponto do canvas do editor FORA do mapa (faixa de baixo), para pôr o foco no mapa sem mexer em nada. */
async function pontoVazioDoCanvas(mestre: Page): Promise<Ponto> {
  const caixas = await mestre.locator('canvas').evaluateAll((cs) => cs.map((c) => {
    const r = c.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  }))
  const maior = caixas.sort((a, b) => b.w * b.h - a.w * a.h)[0]
  if (!maior) throw new Error('o editor não tem canvas')
  return { x: Math.round(maior.x + maior.w / 2), y: Math.round(maior.y + maior.h - 12) }
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: dois jogadores com fichas; mestre e jogadores veem as três fichas visíveis, a tela é estável e a ficha secreta não vai a ninguém', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  await page.getByRole('tab', { name: 'Jogo' }).click()
  for (const nome of [J1, J2]) {
    await expect(cardDeJogador(page, nome), `a aba Jogo deveria mostrar ${nome}`).toBeVisible({ timeout: ESPERA })
  }

  for (const ref of [await referenciaDoMestre(page), await referencia(ana.page, J1, ESPERA_TELA), await referencia(bruno.page, J2, ESPERA_TELA)]) {
    // As janelas não se tocam: o destaque de uma ficha não pode cair na janela da outra.
    const js = FICHAS_VISIVEIS.map((n) => ref.janelas[COR_DA_FICHA[n]]).filter((j): j is Janela => j !== null)
    for (let i = 0; i < js.length; i += 1) {
      for (let k = i + 1; k < js.length; k += 1) {
        const longe = Math.abs(js[i].cx - js[k].cx) > js[i].meio + js[k].meio || Math.abs(js[i].cy - js[k].cy) > js[i].meio + js[k].meio
        expect(longe, `${ref.quem}: as janelas de ${FICHAS_VISIVEIS[i]} e ${FICHAS_VISIVEIS[k]} se sobrepõem`).toBe(true)
      }
    }
    // Sem iniciativa nenhuma, a tela parada não muda nas janelas: o "destaque" dos outros testes não é ruído.
    await ref.page.waitForTimeout(1000)
    const m = await mudancas(ref)
    for (const n of FICHAS_VISIVEIS) {
      expect(m[n], `${ref.quem}: a janela de ${n} mudou ${m[n]} px com a tela parada`).toBeLessThanOrEqual(RESIDUO_ZONA)
    }
  }

  for (const j of [ana, bruno]) {
    expect(await textoNaTela(j.page), `${j.nome} não deveria ler "sua vez" sem iniciativa nenhuma`).not.toMatch(SUA_VEZ)
    // A escuta de frames ouve nomes de ficha (o do Goblin foi) e o filtro de hoje segura a secreta.
    expect(j.frames.some((f) => f.includes(GOBLIN)), `a escuta de frames de ${j.nome} não ouviu o nome "${GOBLIN}": a régua de vazamento estaria surda`).toBe(true)
    expect(j.frames.filter((f) => f.includes(VULTO)), `${j.nome} recebeu o nome da ficha secreta "${VULTO}"`).toEqual([])
  }
})

test('2. o mestre monta a ordem: digita a iniciativa de três fichas e a ordem aparece do maior para o menor, com a vez no primeiro', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  await mesaMontada(browser, page, baseURL ?? '')

  // Digitados na ordem do mapa (Lanterna, Machado, Goblin); a ordem na tela é pelo valor.
  const secao = await montarOrdem(page, [LANTERNA, MACHADO, GOBLIN])
  await expect
    .poll(() => fichasNaOrdem(secao), { timeout: ESPERA, message: `a "${ORDEM}" deveria ser ${MACHADO} (17), ${LANTERNA} (12), ${GOBLIN} (5); ${VULTO}, sem valor, fica de fora` })
    .toEqual([MACHADO, LANTERNA, GOBLIN])
  const entradas = entradasDaOrdem(ordemDeIniciativa(secao))
  for (const nome of [MACHADO, LANTERNA, GOBLIN]) {
    await expect(entradas.filter({ hasText: nome }), `a entrada de ${nome} deveria mostrar o valor ${INICIATIVA[nome]}`).toContainText(new RegExp(`\\b${INICIATIVA[nome]}\\b`))
  }

  await comecar(secao)
  await esperaVezNaOrdem(page, MACHADO, 'começada a ordem')
})

test('3. "Próxima vez" passa a vez na ordem e, depois do último, volta ao primeiro', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  await mesaMontada(browser, page, baseURL ?? '')
  const secao = await montarOrdem(page, [LANTERNA, MACHADO, GOBLIN])
  await comecar(secao)
  await esperaVezNaOrdem(page, MACHADO, 'começada a ordem')

  await proximaVez(page)
  await esperaVezNaOrdem(page, LANTERNA, 'depois de uma "Próxima vez"')
  await proximaVez(page)
  await esperaVezNaOrdem(page, GOBLIN, 'depois de duas "Próxima vez"')
  await proximaVez(page)
  await esperaVezNaOrdem(page, MACHADO, 'depois do último da ordem, a vez volta ao primeiro')
})

test('4. a tecla que o botão "Próxima vez" anuncia passa a vez com o foco no mapa', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  await mesaMontada(browser, page, baseURL ?? '')
  const secao = await montarOrdem(page, [LANTERNA, MACHADO, GOBLIN])
  await comecar(secao)
  await esperaVezNaOrdem(page, MACHADO, 'começada a ordem')

  const botao = botaoProximaVez(secao).first()
  await expect(botao, `a seção "${INICIATIVA_SECAO}" deveria ter o botão "Próxima vez"`).toBeVisible({ timeout: ESPERA })
  const atalho = (await botao.getAttribute('aria-keyshortcuts'))?.trim().split(/\s+/)[0] ?? ''
  expect(atalho, 'o botão "Próxima vez" deveria anunciar a tecla dele em aria-keyshortcuts').not.toBe('')

  // O mestre olha o mapa: toca o canvas fora do chão (nada é selecionado) e aperta a tecla.
  const vazio = await pontoVazioDoCanvas(page)
  await page.mouse.move(vazio.x, vazio.y)
  await page.mouse.down()
  await page.waitForTimeout(120)
  await page.mouse.up()
  await page.keyboard.press(atalho)

  await esperaVezNaOrdem(page, LANTERNA, `depois da tecla "${atalho}" com o foco no mapa`)
})

test('5. no mapa do mestre a ficha da vez fica destacada, e o destaque anda com a vez', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  await mesaMontada(browser, page, baseURL ?? '')
  const ref = await referenciaDoMestre(page)

  const secao = await montarOrdem(page, [LANTERNA, MACHADO, GOBLIN])
  await comecar(secao)
  await mestreOlhaMapa(page)
  await esperaDestaque(ref, MACHADO, ESPERA_TELA_MESTRE)

  await proximaVez(page)
  await mestreOlhaMapa(page)
  await esperaDestaque(ref, LANTERNA, ESPERA_TELA_MESTRE)
})

test('6. na tela de quem joga a ficha da vez fica destacada, e só o dono dela lê "sua vez"', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')
  const refAna = await referencia(ana.page, J1, ESPERA_TELA)
  const refBruno = await referencia(bruno.page, J2, ESPERA_TELA)

  const secao = await montarOrdem(page, [LANTERNA, MACHADO, GOBLIN])
  await comecar(secao)

  // Vez de Machado (Bruno).
  await expect.poll(() => textoNaTela(bruno.page), { timeout: ESPERA, message: `${J2} (dono de ${MACHADO}) deveria ler "sua vez"` }).toMatch(SUA_VEZ)
  expect(await textoNaTela(ana.page), `${J1} não é da vez e não deveria ler "sua vez"`).not.toMatch(SUA_VEZ)
  await esperaDestaque(refBruno, MACHADO, ESPERA_TELA)
  await esperaDestaque(refAna, MACHADO, ESPERA_TELA)

  // Vez de Lanterna (Ana).
  await proximaVez(page)
  await expect.poll(() => textoNaTela(ana.page), { timeout: ESPERA, message: `${J1} (dona de ${LANTERNA}) deveria ler "sua vez"` }).toMatch(SUA_VEZ)
  await expect.poll(() => textoNaTela(bruno.page), { timeout: ESPERA, message: `a vez saiu de ${J2}: ele não deveria ler mais "sua vez"` }).not.toMatch(SUA_VEZ)
  await esperaDestaque(refAna, LANTERNA, ESPERA_TELA)
  await esperaDestaque(refBruno, LANTERNA, ESPERA_TELA)
})

test('7. a ficha secreta na ordem: na vez dela o jogador não recebe o nome nem vê destaque, e a vez segue até o Goblin', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')
  const refAna = await referencia(ana.page, J1, ESPERA_TELA)
  const refBruno = await referencia(bruno.page, J2, ESPERA_TELA)

  // Ordem: Machado 17, Lanterna 12, Vulto 9 (secreto), Goblin 5.
  const secao = await montarOrdem(page, [LANTERNA, MACHADO, GOBLIN, VULTO])
  await expect.poll(() => fichasNaOrdem(secao), { timeout: ESPERA, message: `a "${ORDEM}" do mestre deveria incluir a ficha secreta no lugar dela` }).toEqual([MACHADO, LANTERNA, VULTO, GOBLIN])
  await comecar(secao)
  await expect.poll(() => textoNaTela(bruno.page), { timeout: ESPERA, message: `${J2} deveria ler "sua vez" na vez de ${MACHADO}` }).toMatch(SUA_VEZ)
  await proximaVez(page)
  await expect.poll(() => textoNaTela(ana.page), { timeout: ESPERA, message: `${J1} deveria ler "sua vez" na vez de ${LANTERNA}` }).toMatch(SUA_VEZ)

  // Vez do Vulto: o mestre vê; os jogadores não leem o nome, não leem "sua vez" e nada fica destacado.
  await proximaVez(page)
  await esperaVezNaOrdem(page, VULTO, 'depois de Lanterna')
  for (const j of [ana, bruno]) {
    await expect.poll(() => textoNaTela(j.page), { timeout: ESPERA, message: `na vez da ficha secreta, ${j.nome} não deveria ler "sua vez"` }).not.toMatch(SUA_VEZ)
    expect(await textoNaTela(j.page), `${j.nome} leu o nome da ficha secreta na tela`).not.toContain(VULTO)
  }
  await esperaDestaque(refAna, null, ESPERA_TELA)
  await esperaDestaque(refBruno, null, ESPERA_TELA)

  // Vez do Goblin: visível, então destacado na tela dos dois.
  await proximaVez(page)
  await esperaDestaque(refAna, GOBLIN, ESPERA_TELA)
  await esperaDestaque(refBruno, GOBLIN, ESPERA_TELA)

  for (const j of [ana, bruno]) {
    expect(j.frames.filter((f) => f.includes(VULTO)), `nenhum frame recebido por ${j.nome} deveria trazer o nome da ficha secreta "${VULTO}"`).toEqual([])
  }
})
