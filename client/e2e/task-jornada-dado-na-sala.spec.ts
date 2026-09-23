// JORNADA DE USUÁRIO do DADO ROLADO NA SALA (item 21 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - mestre e jogadores rolam dados num painel "Dados": escolhem o dado (d4,
//     d6, d8, d10, d12 ou d20), a quantidade e o modificador, e apertam "Rolar";
//   - o resultado aparece para TODOS da mesa (mestre e cada jogador), com o
//     nome de quem rolou, a expressão rolada ("2d6+3") e o total;
//   - o mestre pode rolar ESCONDIDO: o resultado aparece só na tela dele. Na
//     tela do jogador não aparece rolagem de d20 do mestre (regra da casa: o
//     jogador nunca recebe o que o mestre esconde).
//
// ONDE ISSO MORRE HOJE: não existe sistema de dados.
//   - `src/net/protocol.ts:133` — `PlayerMessage` não tem mensagem de rolagem;
//     `src/net/protocol.ts:162-181` — `HostMessage` também não;
//   - `src/net/hostSession.ts:834-848` — o `switch` do host não trata rolagem;
//   - `src/player/PlayerPanel.tsx:196-229` — o "Painel do jogador" só tem
//     personagens, Sinalizar e Medir; nenhum botão "Dados";
//   - `src/components/RoomPanel.tsx:200` — a aba Jogo do mestre ("Sala") não
//     tem painel de dados, e nenhum componente do app se chama "Dados".
//
// COMO ESTE ARQUIVO PROVA, sem mentir (mesmo preparo de
// task-jornada-viagem-do-jogador.spec.ts e task-jornada-painel-do-grupo.spec.ts):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   cada jogador é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo WebSocket
//   roteado vira `net:message` na página do mestre (o `JSON.parse` do que
//   chegou no socket), e o `net_send` do mestre volta ao socket do jogador por
//   `exposeFunction`. A sessão do host é a do app, sem estado injetado.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA, aberta pelo menu ("Carregar Mapa
//   existente"), como na mesa.
//   GESTO REAL. Clique no botão e tecla no campo, pelo ponteiro e teclado do
//   Playwright. O único `evaluate` é o repasse do transporte (a outra máquina).
//   PROVA NA TELA. Texto VISÍVEL: a régua procura, entre os elementos
//   visíveis, os MENORES que contêm o nome de quem rolou E a expressão; tira
//   deles o nome, a expressão e horários, e o que sobra de número é candidato
//   a total. O total tem de caber na faixa da rolagem (2d6+3 → 5 a 15) e o
//   MESMO total tem de aparecer em todas as telas.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o painel abre por um botão (ou aba) de nome acessível "Dados" ou "Rolar
//     dados"; no jogador ele pode estar direto na tela ou dentro do "Painel"
//     (botão `Painel` que já existe); no mestre, em qualquer lugar da tela;
//   - o painel aberto é uma região, diálogo ou tabpanel de nome "Dados" (ou
//     "Rolar dados");
//   - dentro dele: um botão (ou rádio) por dado com o nome exato "d4", "d6",
//     "d8", "d10", "d12", "d20"; campos rotulados "Quantidade" e "Modificador"
//     (o rótulo pode ser mais longo, ex. "Quantidade de dados"); o botão que
//     rola chama exatamente "Rolar"; escolher o dado NÃO rola sozinho;
//   - só o mestre tem "Rolar escondido" (caixa de seleção ou chave com
//     "escondid" no nome); o jogador não tem;
//   - a rolagem aparece como texto com o nome de quem rolou ("Ana"; o mestre
//     aparece como "Mestre"), a expressão em notação padrão ("2d6+3", espaços
//     livres, "1d20" pode vir como "d20", menos pode ser "-", "−" ou "–") e o
//     total como número.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ana e Bruno entram, recebem fichas,
// e cada um vê a própria ficha no painel dele. Sem ele, o vermelho dos testes
// 2 a 6 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'DADO01'
const J1 = 'Ana'
const J2 = 'Bruno'
/** Nome com que o mestre aparece nas rolagens (suposição da régua). */
const MESTRE = 'Mestre'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'
const TOKEN_J1 = 'Lanterna'
const TOKEN_J2 = 'Machado'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const PASTA = 'C:/appdata/maps/map_vale'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }

const CHAO_A = '#1e8c8c'
const CHAO_B = '#8c1e8c'
const COR_J1 = '#3cff00'
const COR_J2 = '#ff5a00'

/** Espera curta por controle: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera pela rolagem chegar a outra tela (passa pelo transporte de mentira). */
const ESPERA_ROLAGEM = 10_000
/** Depois da rolagem escondida, quanto a régua dá para ela (não) chegar ao jogador. */
const FOLGA_DO_FIO_MS = 1500

const DADOS = /^(Dados|Rolar dados)$/i
const ESCONDIDO = /escondid/i
const TIPOS_DE_DADO = [4, 6, 8, 10, 12, 20] as const
type Lados = (typeof TIPOS_DE_DADO)[number]

type Ponto = { x: number; y: number }

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: duas cenas (o formato que o app abre pelo menu)
// ───────────────────────────────────────────────────────────────────────────

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function cena(id: string, nome: string, chao: string, tokens: Token[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    tokens,
    pins: [],
  }
}

function discoDaAventura(): Record<string, string> {
  const cenaA = cena('map_vale', AVENTURA, CHAO_A, [
    token('tok-lanterna', TOKEN_J1, { x: 700, y: 300 }, COR_J1),
    token('tok-machado', TOKEN_J2, { x: 820, y: 300 }, COR_J2),
  ])
  const cenaB = cena('map_cripta', CENA_B, CHAO_B, [])
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
  /** Mensagens do jogador entregues ao mestre uma de cada vez, na ordem em que chegaram. */
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

  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

/** Aba Jogo, card do jogador, "Atribuir <token>" — o clique de um toque que o painel oferece. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDoToken: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = mestre.locator('#lb-rail-panel-room')
  const card = painel.locator('.lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${nomeDoToken}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDoToken}` }), `${jogador} deveria ficar com ${nomeDoToken}`).toBeVisible()
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

/**
 * Contextos de jogador abertos pelo teste que está rodando. O `page` do mestre
 * o Playwright fecha sozinho; estes não — e cada tela de jogador viva desenha
 * Pixi e pesa no teste seguinte.
 */
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
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.pressSequentially(nome, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return page
}

/** O jogador abre o "Painel" dele e vê a própria ficha: prova de que o mapa chegou com o token dele. */
async function jogadorVeAFicha(page: Page, nomeDoToken: string, quem: string): Promise<void> {
  await expect(page.locator('canvas').first(), `${quem}: o mapa não apareceu na tela`).toBeVisible({ timeout: 10_000 })
  const alternar = page.getByRole('button', { name: 'Painel', exact: true })
  if (await alternar.isVisible()) await alternar.click()
  await expect(page.getByRole('button', { name: `Centralizar em ${nomeDoToken}` }), `${quem}: a ficha ${nomeDoToken} deveria estar no painel`).toBeVisible({ timeout: 10_000 })
}

interface Mesa {
  mestre: Page
  ana: Page
  bruno: Page | null
}

/** Mestre abre a aventura e a sala; os jogadores pedidos entram e recebem a ficha de cada um. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string, quem: 'so-ana' | 'ana-e-bruno'): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = quem === 'ana-e-bruno' ? await jogadorEntra(browser, baseURL, rede, 'c2', J2) : null
  await mestreAtribui(mestre, J1, TOKEN_J1)
  if (bruno) await mestreAtribui(mestre, J2, TOKEN_J2)
  // O mestre volta para o mapa: é onde ele fica na mesa.
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await jogadorVeAFicha(ana, TOKEN_J1, J1)
  if (bruno) await jogadorVeAFicha(bruno, TOKEN_J2, J2)
  return { mestre, ana, bruno }
}

// ───────────────────────────────────────────────────────────────────────────
// O painel de dados: abrir, escolher, rolar (clique e tecla, nada injetado)
// ───────────────────────────────────────────────────────────────────────────

function painelDeDados(page: Page): Locator {
  return page
    .getByRole('region', { name: DADOS })
    .or(page.getByRole('dialog', { name: DADOS }))
    .or(page.getByRole('tabpanel', { name: DADOS }))
    .first()
}

function gatilhoDeDados(page: Page): Locator {
  return page.getByRole('button', { name: DADOS }).or(page.getByRole('tab', { name: DADOS })).first()
}

/** Abre o painel "Dados" pelo gesto que a tela oferecer; no jogador, pode estar dentro do "Painel". */
async function abrirDados(page: Page, quem: string): Promise<Locator> {
  const painel = painelDeDados(page)
  if (await painel.isVisible()) return painel
  const gatilho = gatilhoDeDados(page)
  if (!(await gatilho.isVisible())) {
    const painelDoJogador = page.getByRole('button', { name: 'Painel', exact: true })
    if (await painelDoJogador.isVisible()) await painelDoJogador.click()
  }
  await expect(gatilho, `${quem}: deveria haver um botão "Dados" (ou "Rolar dados") na tela`).toBeVisible({ timeout: ESPERA })
  if (!(await painel.isVisible())) await gatilho.click()
  await expect(painel, `${quem}: o botão "Dados" deveria abrir um painel "Dados"`).toBeVisible({ timeout: ESPERA })
  return painel
}

function botaoDoDado(painel: Locator, lados: Lados): Locator {
  const nome = `d${lados}`
  return painel.getByRole('button', { name: nome, exact: true }).or(painel.getByRole('radio', { name: nome, exact: true })).first()
}

function chaveEscondido(painel: Locator): Locator {
  return painel.getByRole('checkbox', { name: ESCONDIDO }).or(painel.getByRole('switch', { name: ESCONDIDO })).first()
}

/** Troca o valor do campo pelo teclado: clica, seleciona tudo e digita. */
async function digitarNoCampo(campo: Locator, texto: string): Promise<void> {
  await campo.click()
  await campo.press('Control+A')
  await campo.pressSequentially(texto, { delay: 20 })
}

interface Rolagem {
  quantidade: number
  lados: Lados
  modificador: number
  escondido?: boolean
}

async function rolar(page: Page, quem: string, r: Rolagem): Promise<void> {
  const painel = await abrirDados(page, quem)
  await digitarNoCampo(painel.getByLabel('Quantidade'), String(r.quantidade))
  await digitarNoCampo(painel.getByLabel('Modificador'), String(r.modificador))
  await botaoDoDado(painel, r.lados).click()
  if (r.escondido === true) {
    const chave = chaveEscondido(painel)
    await expect(chave, `${quem}: deveria haver "Rolar escondido" no painel`).toBeVisible({ timeout: ESPERA })
    if (!(await chave.isChecked())) await chave.click()
    await expect(chave).toBeChecked()
  }
  await painel.getByRole('button', { name: 'Rolar', exact: true }).click()
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura da tela: onde está a rolagem, e que total ela mostra
// ───────────────────────────────────────────────────────────────────────────

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "2d6+3" em notação padrão, espaços livres; "1d20" também vale como "d20". */
function expressao(r: Rolagem, flags = ''): RegExp {
  const qtd = r.quantidade === 1 ? '(?:1\\s*)?' : `${r.quantidade}\\s*`
  const mod = r.modificador > 0 ? `\\s*[+＋]\\s*${r.modificador}` : r.modificador < 0 ? `\\s*[-−–]\\s*${-r.modificador}` : ''
  return new RegExp(`(?<![0-9a-z])${qtd}d\\s*${r.lados}${mod}(?![0-9])`, `i${flags}`)
}

/** Qualquer expressão de dado com esse número de lados, de qualquer quantidade. */
function qualquerDe(lados: Lados): RegExp {
  return new RegExp(`(?<![0-9a-z])\\d*\\s*d\\s*${lados}(?![0-9])`, 'i')
}

/**
 * Os textos das MENORES entradas visíveis que contêm o nome de quem rolou e a
 * expressão: um ancestral (o painel, a página) contém o texto do filho e é
 * descartado. Só leitura de texto visível.
 */
async function entradas(page: Page, quem: string, expr: RegExp): Promise<string[]> {
  const nome = new RegExp(`(?<![\\p{L}])${escapar(quem)}(?![\\p{L}])`, 'u')
  const textos = (await page.locator('body *:visible').filter({ hasText: nome }).filter({ hasText: expr }).allInnerTexts())
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => nome.test(t) && expr.test(t))
  const unicos = Array.from(new Set(textos))
  return unicos.filter((t) => !unicos.some((outro) => outro !== t && outro.length < t.length && t.includes(outro)))
}

/** Números da entrada que podem ser o total: sem o nome, sem a expressão, sem horário. */
function candidatosATotal(texto: string, quem: string, r: Rolagem): number[] {
  const min = r.quantidade + r.modificador
  const max = r.quantidade * r.lados + r.modificador
  const limpo = texto
    .replace(new RegExp(escapar(quem), 'g'), ' ')
    .replace(expressao(r, 'g'), ' ')
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' ')
  const numeros = (limpo.match(/[-−–]?\d+/g) ?? []).map((n) => Number(n.replace(/[−–]/, '-')))
  return numeros.filter((n) => Number.isInteger(n) && n >= min && n <= max)
}

async function totaisNaTela(page: Page, quem: string, r: Rolagem): Promise<number[]> {
  const achados = (await entradas(page, quem, expressao(r))).flatMap((t) => candidatosATotal(t, quem, r))
  return Array.from(new Set(achados)).sort((a, b) => a - b)
}

/** Espera a rolagem aparecer na tela, com um total na faixa; devolve os totais candidatos. */
async function esperaRolagemNaTela(page: Page, tela: string, quem: string, r: Rolagem): Promise<number[]> {
  let ultimo: number[] = []
  await expect
    .poll(
      async () => {
        ultimo = await totaisNaTela(page, quem, r)
        return ultimo.length
      },
      { timeout: ESPERA_ROLAGEM, message: `tela de ${tela}: deveria aparecer a rolagem de ${quem} (${r.quantidade}d${r.lados}${r.modificador >= 0 ? '+' : ''}${r.modificador}) com um total na faixa` },
    )
    .toBeGreaterThan(0)
  return ultimo
}

function emComum(listas: number[][]): number[] {
  return listas.reduce((acc, lista) => acc.filter((n) => lista.includes(n)))
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana e Bruno entram, recebem fichas e cada um vê a própria ficha no painel', async ({ browser, page, baseURL }) => {
  test.setTimeout(120_000)
  const mesa = await mesaMontada(browser, page, baseURL ?? '', 'ana-e-bruno')
  // A aba Jogo do mestre lista os dois, cada um com a ficha dele.
  await mesa.mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painelJogo = mesa.mestre.locator('#lb-rail-panel-room')
  await expect(painelJogo.getByRole('button', { name: `Remover ${TOKEN_J1}` })).toBeVisible()
  await expect(painelJogo.getByRole('button', { name: `Remover ${TOKEN_J2}` })).toBeVisible()
})

test('2. o painel "Dados" oferece d4 a d20, quantidade e modificador no mestre e no jogador; só o mestre rola escondido', async ({ browser, page, baseURL }) => {
  test.setTimeout(120_000)
  const mesa = await mesaMontada(browser, page, baseURL ?? '', 'so-ana')

  for (const [tela, alvo] of [[MESTRE, mesa.mestre], [J1, mesa.ana]] as const) {
    const painel = await abrirDados(alvo, tela)
    for (const lados of TIPOS_DE_DADO) await expect(botaoDoDado(painel, lados), `${tela}: falta o dado d${lados}`).toBeVisible()
    await expect(painel.getByLabel('Quantidade'), `${tela}: falta o campo Quantidade`).toBeVisible()
    await expect(painel.getByLabel('Modificador'), `${tela}: falta o campo Modificador`).toBeVisible()
    await expect(painel.getByRole('button', { name: 'Rolar', exact: true }), `${tela}: falta o botão Rolar`).toBeVisible()
  }
  await expect(chaveEscondido(painelDeDados(mesa.mestre)), 'o mestre deveria poder rolar escondido').toBeVisible()
  await expect(chaveEscondido(painelDeDados(mesa.ana)), 'o jogador não rola escondido do mestre').toHaveCount(0)
})

test('3. Ana rola 2d6+3 e o mesmo total, com o nome dela, aparece na tela dela, na do Bruno e na do mestre', async ({ browser, page, baseURL }) => {
  test.setTimeout(120_000)
  const mesa = await mesaMontada(browser, page, baseURL ?? '', 'ana-e-bruno')
  const bruno = mesa.bruno as Page
  const r: Rolagem = { quantidade: 2, lados: 6, modificador: 3 }

  await rolar(mesa.ana, J1, r)

  const naAna = await esperaRolagemNaTela(mesa.ana, J1, J1, r)
  const noBruno = await esperaRolagemNaTela(bruno, J2, J1, r)
  const noMestre = await esperaRolagemNaTela(mesa.mestre, MESTRE, J1, r)
  expect(emComum([naAna, noBruno, noMestre]), `o MESMO total deveria aparecer nas três telas (Ana ${naAna}, Bruno ${noBruno}, mestre ${noMestre})`).not.toHaveLength(0)
})

test('4. o mestre rola 1d20 aberto e Ana e Bruno veem o mesmo total com o nome "Mestre"', async ({ browser, page, baseURL }) => {
  test.setTimeout(120_000)
  const mesa = await mesaMontada(browser, page, baseURL ?? '', 'ana-e-bruno')
  const bruno = mesa.bruno as Page
  const r: Rolagem = { quantidade: 1, lados: 20, modificador: 0 }

  await rolar(mesa.mestre, MESTRE, r)

  const noMestre = await esperaRolagemNaTela(mesa.mestre, MESTRE, MESTRE, r)
  const naAna = await esperaRolagemNaTela(mesa.ana, J1, MESTRE, r)
  const noBruno = await esperaRolagemNaTela(bruno, J2, MESTRE, r)
  expect(emComum([noMestre, naAna, noBruno]), `o MESMO total deveria aparecer nas três telas (mestre ${noMestre}, Ana ${naAna}, Bruno ${noBruno})`).not.toHaveLength(0)
})

test('5. o mestre rola 1d20 escondido: aparece só na tela dele; a rolagem aberta seguinte chega aos jogadores e a escondida não', async ({ browser, page, baseURL }) => {
  test.setTimeout(120_000)
  const mesa = await mesaMontada(browser, page, baseURL ?? '', 'ana-e-bruno')
  const bruno = mesa.bruno as Page
  const escondida: Rolagem = { quantidade: 1, lados: 20, modificador: 0, escondido: true }
  const aberta: Rolagem = { quantidade: 1, lados: 4, modificador: 0 }

  await rolar(mesa.mestre, MESTRE, escondida)
  await esperaRolagemNaTela(mesa.mestre, MESTRE, MESTRE, escondida)
  await mesa.mestre.waitForTimeout(FOLGA_DO_FIO_MS)

  // Desmarca o "escondido" pelo mesmo clique e rola aberto: quando esta chega
  // ao jogador, a escondida (anterior) já teria chegado se fosse ao fio.
  const painel = await abrirDados(mesa.mestre, MESTRE)
  const chave = chaveEscondido(painel)
  if (await chave.isChecked()) await chave.click()
  await expect(chave).not.toBeChecked()
  await rolar(mesa.mestre, MESTRE, aberta)

  for (const [tela, alvo] of [[J1, mesa.ana], [J2, bruno]] as const) {
    await esperaRolagemNaTela(alvo, tela, MESTRE, aberta)
    expect(await entradas(alvo, MESTRE, qualquerDe(20)), `tela de ${tela}: a rolagem escondida do mestre não pode aparecer`).toEqual([])
  }
})

test('6. modificador negativo: Ana rola 1d4-5 e o total negativo aparece na tela dela e na do mestre', async ({ browser, page, baseURL }) => {
  test.setTimeout(120_000)
  const mesa = await mesaMontada(browser, page, baseURL ?? '', 'so-ana')
  const r: Rolagem = { quantidade: 1, lados: 4, modificador: -5 }

  await rolar(mesa.ana, J1, r)

  const naAna = await esperaRolagemNaTela(mesa.ana, J1, J1, r)
  const noMestre = await esperaRolagemNaTela(mesa.mestre, MESTRE, J1, r)
  expect(emComum([naAna, noMestre]), `o MESMO total (de -4 a -1) deveria aparecer nas duas telas (Ana ${naAna}, mestre ${noMestre})`).not.toHaveLength(0)
})
