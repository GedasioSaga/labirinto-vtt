// JORNADA DE USUÁRIO de ESPELHAR A TELA DO JOGADOR (item 15 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - na linha do jogador na seção "Grupo" (aba Jogo) há um botão de espelhar
//     a tela dele ("Ver tela", "Espelhar", "Ver como Ana"…);
//   - o clique abre, num painel ou numa janela, EXATAMENTE o que aquele jogador
//     vê: a cena em que ele está, a ficha dele, a névoa e a zona oculta
//     escondendo o que escondem. O mestre confere se nada vazou antes de
//     mostrar;
//   - o espelho é do jogador, não do editor: segue a cena DELE (se ele viajou,
//     o espelho mostra a cena nova, mesmo com o editor ainda na antiga) e não
//     mostra ficha de quem saiu da cena dele;
//   - o espelho respeita as decisões do produto (PEDIDOS.md/HANDOFF.md): nada
//     nele traz o nome de outra cena nem o que a névoa ou a zona escondem.
//
// ONDE ISSO MORRE HOJE: a linha do Grupo (`components/PartySection.tsx:196-210`)
// só tem "Ir lá", "Seguir" e "Mandar para…"; o card de "Jogadores"
// (`components/RoomPanel.tsx:318-323`) só oferece "Revelar planta" e "Esconder
// de novo". O que o jogador vê só existe no `player.html` dele
// (`player/PlayerView.tsx`, alimentado por `lib/fogFilter.ts:filterMapForPlayer`);
// o mestre não tem nenhuma tela que monte essa visão. "Seguir"/"Ir lá" mexem
// na câmera do EDITOR, que mostra tudo (inclusive a zona oculta, só escurecida
// a 45% por `pixi/drawConcealZones.ts`).
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-painel-do-grupo.spec.ts e task-jornada-viagem-do-jogador.spec.ts):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   Ana e Bruno são o `player.html` inteiro, cada um no próprio contexto de
//   navegador. Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo
//   WebSocket roteado vira `net:message` no mestre (com `JSON.parse` do que
//   chegou), e o `net_send` do mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA: Salão e Cripta num `adventure.json`, aberto pelo menu.
//   No Salão, uma ZONA OCULTA (não revelada) cobre a faixa de cima e esconde a
//   ficha do Espião (violeta), sem dono. O Espião está DENTRO do raio de visão de
//   Ana e de Bruno (700 px, `net/hostBridge.ts:137`): quem o esconde é a zona,
//   não a distância.
//   GESTO REAL NA AÇÃO SOB TESTE: clique no botão da linha do Grupo; a viagem
//   de Bruno é o toque no pino + "Pedir para passar" + "Deixar ir" do mestre.
//   Os únicos `evaluate` são o do transporte e a LEITURA de pixel (decodifica a
//   foto num canvas solto; nada do app é tocado).
//   PROVA NA TELA: nome acessível do botão e do espelho; pixel na foto do
//   PRÓPRIO espelho (o retângulo dele, ou a janela inteira): a cena pela cor do
//   chão (Salão verde-água, Cripta magenta), cada ficha pela cor (Ana
//   verde-limão, Bruno laranja, Espião violeta). Texto visível do espelho para o
//   que não pode vazar. Nada é lido da store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o botão fica na linha do jogador (`listitem`) da seção "Grupo" da aba
//     Jogo, e o nome acessível dele casa `BOTAO_ESPELHAR` ("Espelhar",
//     "Espelhar tela", "Ver tela", "Ver a tela de Ana", "Ver como Ana", "Tela
//     do jogador", "O que Ana vê");
//   - o espelho abre DENTRO do app do mestre como `dialog`, `region`,
//     `complementary` ou `figure` cujo nome acessível traz o nome do jogador E
//     uma destas palavras: tela, vê, visão, vista, espelho (ex.: "Tela de Ana",
//     "O que Ana vê") — OU como janela nova do navegador (`window.open`), que a
//     régua fotografa inteira. Janela nativa do Tauri não é vista pelo
//     Playwright e não conta;
//   - o espelho desenha a cena do jogador no enquadramento que o jogador usa (a
//     cena inteira cabe); em escala menor vale, desde que o chão e as fichas
//     tenham pixels para contar (limiares `*_NO_ESPELHO`).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Prova que a mesa monta, que a tela
// de Ana esconde o Espião (a zona funciona do lado do jogador), que o EDITOR
// do mestre mostra o Espião (a diferença que o espelho tem de reproduzir) e
// que o classificador de cor enxerga o violeta escurecido pela zona. Sem ele, o
// vermelho dos testes 2 a 5 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { ConcealZone, MapData, Pin, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'ESPE15'
const J1 = 'Ana'
const J2 = 'Bruno'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'
const NOME_DA_ZONA = 'Galeria do Espiao'

const TOKEN_J1 = 'Lanterna'
const TOKEN_J2 = 'Machado'
const TOKEN_ESPIAO = 'Espiao'
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
const COR_ESPIAO = '#b000ff'

type Ponto = { x: number; y: number }

/** Zona oculta: a faixa de cima do Salão inteiro (y de 10 a 290). */
const ZONA_TOPO = 10
const ZONA_BASE = 290
const POS_J1: Ponto = { x: 700, y: 450 }
const POS_J2: Ponto = { x: 820, y: 450 }
/** Dentro da zona e a ~420 px de Ana e ~350 px de Bruno: dentro do raio de visão (700). */
const POS_ESPIAO: Ponto = { x: 1000, y: 150 }
const POS_ESCADA_A: Ponto = { x: 1300, y: 450 }
/** Pino par da Cripta, longe do meio. */
const POS_ESCADA_B: Ponto = { x: 1700, y: 450 }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** A leitura da tela do MESTRE custa mais (medido em 22/09 na régua do Grupo). */
const ESPERA_TELA_MESTRE = 25_000
/** Cabeça do pino: centro 23 px de mundo acima da ponta (`lib/pins.ts`); 31 acerta a cabeça e foge do token. */
const CABECA_DO_PINO = 31

/** Pixels mínimos para dizer "isto está na tela" (tela cheia do jogador ou do editor). */
const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/**
 * No espelho, a cena pode vir menor que a tela do jogador. Um painel de 320 px
 * de largura para um mundo de 2000 px dá escala ~0,15: ficha de 50 px vira ~7
 * px de diâmetro (~40 px de área) e o chão ~90 x 25 px no mínimo.
 */
const PIXELS_DE_TOKEN_NO_ESPELHO = 15
const PIXELS_DE_CENA_NO_ESPELHO = 600
/** Pixels máximos para dizer "isto NÃO está na tela" (antisserrilhado e sombra). */
const RESIDUO = 25

const GRUPO = 'Grupo'
const IR_LA = 'Ir lá'
/** Nome do botão de espelhar na linha do jogador. Não casa "Ir lá", "Seguir" nem "Mandar para…". */
const BOTAO_ESPELHAR = /(espelh|ver (a )?tela|ver como|tela d[aeo]|o que .* vê)/i
const PALAVRAS_DO_ESPELHO = '(tela|vê|visão|vista|espelh)'
const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/
const VOCE_CHEGOU = /Você chegou/

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: Salão com zona oculta sobre o Espião; Cripta vazia
// ───────────────────────────────────────────────────────────────────────────

function pino(id: string, p: Ponto, description: string, destino: NonNullable<Pin['destino']>): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description, image: null, destino }
}

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function zonaOculta(): ConcealZone {
  return {
    id: 'zona-espiao',
    name: NOME_DA_ZONA,
    revealed: false,
    points: [
      { x: 10, y: ZONA_TOPO },
      { x: LARGURA - 10, y: ZONA_TOPO },
      { x: LARGURA - 10, y: ZONA_BASE },
      { x: 10, y: ZONA_BASE },
    ],
  }
}

function cena(id: string, nome: string, chao: string, tokens: Token[], pins: Pin[], zonas: ConcealZone[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    tokens,
    pins,
    concealZones: zonas,
  }
}

function discoDaAventura(): Record<string, string> {
  const cenaA = cena(
    'map_vale',
    AVENTURA,
    CHAO_A,
    [token('tok-lanterna', TOKEN_J1, POS_J1, COR_J1), token('tok-machado', TOKEN_J2, POS_J2, COR_J2), token('tok-espiao', TOKEN_ESPIAO, POS_ESPIAO, COR_ESPIAO)],
    [pino('pin-a-escada', POS_ESCADA_A, ESCADA_A, { sceneId: ID_CENA_B, pinId: 'pin-b-escada' })],
    [zonaOculta()],
  )
  const cenaB = cena('map_cripta', CENA_B, CHAO_B, [], [pino('pin-b-escada', POS_ESCADA_B, ESCADA_B, { sceneId: ID_CENA_A, pinId: 'pin-a-escada' })], [])
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

/** A seção "Grupo" da aba Jogo (mesmo localizador da régua do Grupo). */
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
  await expect(secao, `a aba Jogo deveria ter uma seção "${GRUPO}"`).toBeVisible({ timeout: ESPERA })
  return secao
}

/** A linha de um jogador na seção "Grupo". */
async function linhaDoGrupo(mestre: Page, jogador: string): Promise<Locator> {
  const secao = await secaoGrupo(mestre)
  const linha = secao.getByRole('listitem').or(secao.getByRole('row')).filter({ hasText: jogador })
  await expect(linha, `a seção "${GRUPO}" deveria ter UMA linha de ${jogador}`).toHaveCount(1, { timeout: ESPERA })
  return linha
}

// ───────────────────────────────────────────────────────────────────────────
// O espelho: painel dentro do app ou janela nova
// ───────────────────────────────────────────────────────────────────────────

interface Espelho {
  /** A página onde o espelho está (a do mestre, ou a janela nova). */
  page: Page
  /** O que fotografar: o elemento do espelho, ou a janela inteira. */
  alvo: Locator | Page
  /** Texto visível do espelho (para o que não pode vazar). */
  texto: Locator
  onde: 'painel' | 'janela'
}

/** O espelho de um jogador DENTRO do app: nome acessível com o nome dele e uma palavra de "tela". */
function painelDoEspelho(mestre: Page, jogador: string): Locator {
  const nome = new RegExp(`^(?=.*\\b${escapar(jogador)}\\b)(?=.*${PALAVRAS_DO_ESPELHO}).*$`, 'isu')
  return mestre
    .getByRole('dialog', { name: nome })
    .or(mestre.getByRole('region', { name: nome }))
    .or(mestre.getByRole('complementary', { name: nome }))
    .or(mestre.getByRole('figure', { name: nome }))
}

/** Clique de ponteiro no botão de espelhar da linha do jogador; devolve o espelho aberto. */
async function abrirEspelho(mestre: Page, jogador: string): Promise<Espelho> {
  const linha = await linhaDoGrupo(mestre, jogador)
  const botao = linha.getByRole('button', { name: BOTAO_ESPELHAR })
  await expect(botao, `a linha de ${jogador} no "${GRUPO}" deveria ter um botão de espelhar a tela dele ("Ver tela", "Espelhar"…)`).toBeVisible({ timeout: ESPERA })

  const janelas: Page[] = []
  const ouvir = (nova: Page): void => {
    janelas.push(nova)
  }
  mestre.context().on('page', ouvir)
  const painel = painelDoEspelho(mestre, jogador).first()
  try {
    await botao.click()
    await expect
      .poll(async () => janelas.length > 0 || (await painel.isVisible()), {
        timeout: ESPERA,
        message: `o botão deveria abrir a tela de ${jogador}: painel ("Tela de ${jogador}") ou janela nova`,
      })
      .toBe(true)
  } finally {
    mestre.context().off('page', ouvir)
  }
  if (janelas.length > 0) {
    const janela = janelas[0]
    await janela.waitForLoadState()
    return { page: janela, alvo: janela, texto: janela.locator('body'), onde: 'janela' }
  }
  return { page: mestre, alvo: painel, texto: painel, onde: 'painel' }
}

// ───────────────────────────────────────────────────────────────────────────
// Os jogadores: player.html inteiro, cada um no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  clientId: string
  nome: string
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
  rede.enviados.set(clientId, [])
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
  return { page, clientId, nome }
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
  /** Espião. Classificador por matiz: pega o violeta também escurecido pela zona no editor (45% de preto). */
  violeta: number
  chaoA: number
  chaoB: number
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
 * por cima — painéis e cartões não contam. Sem `soCanvas`, conta a foto
 * inteira (foto do espelho: o retângulo dele, nada fora).
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
      const BLOCO = 16
      const colunas = Math.ceil(window.innerWidth / BLOCO)
      const linhas = Math.ceil(window.innerHeight / BLOCO)
      const cobertura = new Uint8Array(colunas * linhas) // 0 = não perguntado, 1 = canvas, 2 = outra coisa
      const canvasPorCima = (x: number, y: number): boolean => {
        if (!apenasCanvas) return true
        const bx = Math.min(colunas - 1, Math.floor((x * escalaX) / BLOCO))
        const by = Math.min(linhas - 1, Math.floor((y * escalaY) / BLOCO))
        const k = by * colunas + bx
        if (cobertura[k] === 0) {
          const topo = document.elementFromPoint(bx * BLOCO + BLOCO / 2, by * BLOCO + BLOCO / 2)
          cobertura[k] = principal !== null && topo === principal ? 1 : 2
        }
        return cobertura[k] === 1
      }
      const r = { limao: 0, laranja: 0, violeta: 0, chaoA: 0, chaoB: 0 }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          const limao = G > 200 && R > 20 && R < 120 && B < 60
          const laranja = R > 200 && G > 50 && G < 140 && B < 60
          const violeta = B > 90 && R > 60 && G < 40 && B > R * 1.25 && B < R * 2.2
          const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30 && G >= 35
          const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
          if (!limao && !laranja && !violeta && !verdeAgua && !magenta) continue
          if (!canvasPorCima(x, y)) continue
          if (limao) r.limao += 1
          else if (laranja) r.laranja += 1
          else if (violeta) r.violeta += 1
          else if (verdeAgua) r.chaoA += 1
          else r.chaoB += 1
        }
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

async function lerEspelho(espelho: Espelho): Promise<Pixels> {
  await espelho.page.waitForTimeout(PINTURA_MS)
  return contarCores(espelho.page, await fotografar(espelho.alvo), false)
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

test('1. controle: a tela de Ana esconde o Espião na zona oculta, o editor do mestre o mostra, e a linha de Ana está no Grupo', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  for (const j of [ana, bruno]) {
    const tela = await lerTela(j.page)
    expect(fichaDe(tela, j.nome), `${j.nome} deveria ver a própria ficha`).toBeGreaterThan(PIXELS_DE_TOKEN)
    expect(tela.chaoA, `${j.nome} deveria ver o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
    expect(tela.chaoB, `${j.nome} não deveria ver chão da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
    expect(tela.violeta, `${j.nome} não deveria ver o ${TOKEN_ESPIAO}: ele está na zona oculta`).toBeLessThanOrEqual(RESIDUO)
  }

  // O editor mostra tudo: o Espião aparece (escurecido pela zona), e o classificador o enxerga.
  await page.getByRole('tab', { name: 'Mapa' }).click()
  await expect
    .poll(async () => (await lerTela(page)).violeta, { timeout: ESPERA_TELA_MESTRE, message: `o editor do mestre deveria mostrar o ${TOKEN_ESPIAO}` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  const doMestre = await lerTela(page)
  expect(doMestre.chaoA, `o editor do mestre deveria mostrar o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(doMestre.limao, `o editor do mestre deveria mostrar a ficha de ${J1}`).toBeGreaterThan(PIXELS_DE_TOKEN)

  const linha = await linhaDoGrupo(page, J1)
  await expect(linha.getByRole('button', { name: IR_LA }), `a linha de ${J1} no "${GRUPO}" deveria ter "Ir lá"`).toBeVisible({ timeout: ESPERA })
})

test('2. o botão da linha de Ana abre a tela de Ana: o chão do Salão e a ficha dela', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  await mesaMontada(browser, page, baseURL ?? '')

  const espelho = await abrirEspelho(page, J1)

  await expect
    .poll(async () => (await lerEspelho(espelho)).chaoA, { timeout: ESPERA_TELA, message: `a tela de ${J1} (${espelho.onde}) deveria mostrar o chão do ${CENA_A}` })
    .toBeGreaterThan(PIXELS_DE_CENA_NO_ESPELHO)
  const tela = await lerEspelho(espelho)
  expect(tela.limao, `a tela de ${J1} (${espelho.onde}) deveria mostrar a ficha dela`).toBeGreaterThan(PIXELS_DE_TOKEN_NO_ESPELHO)
  expect(tela.chaoB, `a tela de ${J1} (${espelho.onde}) não deveria ter chão da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
})

test('3. a tela de Ana esconde o que a zona oculta esconde: sem o Espião, sem o nome da zona, sem o nome da outra cena', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  const espelho = await abrirEspelho(page, J1)

  // Primeiro a cena tem de estar pintada: espelho vazio não "esconde" nada.
  await expect
    .poll(async () => (await lerEspelho(espelho)).chaoA, { timeout: ESPERA_TELA, message: `a tela de ${J1} (${espelho.onde}) deveria mostrar o chão do ${CENA_A}` })
    .toBeGreaterThan(PIXELS_DE_CENA_NO_ESPELHO)
  const tela = await lerEspelho(espelho)
  expect(tela.limao, `a tela de ${J1} deveria mostrar a ficha dela`).toBeGreaterThan(PIXELS_DE_TOKEN_NO_ESPELHO)
  expect(tela.violeta, `a tela de ${J1} mostra o ${TOKEN_ESPIAO}, que a zona oculta esconde dela: o espelho vazou o editor`).toBeLessThanOrEqual(RESIDUO)
  await expect(espelho.texto, `a tela de ${J1} não deveria trazer o nome da zona oculta "${NOME_DA_ZONA}"`).not.toContainText(NOME_DA_ZONA)
  await expect(espelho.texto, `a tela de ${J1} não deveria trazer o nome da ficha escondida "${TOKEN_ESPIAO}"`).not.toContainText(TOKEN_ESPIAO)
  await expect(espelho.texto, `a tela de ${J1} não deveria trazer o nome da outra cena "${CENA_B}"`).not.toContainText(CENA_B)

  // E a tela de verdade de Ana continua igual: abrir o espelho não mexe no jogador.
  const real = await lerTela(ana.page)
  expect(real.limao, `${J1} deveria continuar vendo a própria ficha`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(real.violeta, `${J1} não deveria passar a ver o ${TOKEN_ESPIAO}`).toBeLessThanOrEqual(RESIDUO)
})

test('4. o espelho segue a cena do jogador: Bruno foi à Cripta e a tela dele mostra a Cripta, com o editor ainda no Salão', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const { bruno } = await mesaMontada(browser, page, baseURL ?? '')

  // Bruno vai à Cripta pelo caminho de hoje (verde): pedido pelo pino e "Deixar ir".
  await viagemAprovada(page, bruno)
  const lista = await secaoCenas(page)
  expect(await estaDestacada(entradaDaCena(lista, CENA_A)), `o editor do mestre continua no ${CENA_A}`).toBe(true)

  const espelho = await abrirEspelho(page, J2)

  await expect
    .poll(async () => (await lerEspelho(espelho)).chaoB, { timeout: ESPERA_TELA, message: `a tela de ${J2} (${espelho.onde}) deveria mostrar o chão da ${CENA_B}, onde ele está` })
    .toBeGreaterThan(PIXELS_DE_CENA_NO_ESPELHO)
  const tela = await lerEspelho(espelho)
  expect(tela.laranja, `a tela de ${J2} deveria mostrar a ficha dele na ${CENA_B}`).toBeGreaterThan(PIXELS_DE_TOKEN_NO_ESPELHO)
  expect(tela.chaoA, `a tela de ${J2} está na ${CENA_B} e não deveria mostrar o chão do ${CENA_A} (o do editor)`).toBeLessThanOrEqual(RESIDUO)
  expect(tela.limao, `a tela de ${J2} não deveria mostrar a ficha de ${J1}, que ficou no ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)
  expect(tela.violeta, `a tela de ${J2} não deveria mostrar o ${TOKEN_ESPIAO}`).toBeLessThanOrEqual(RESIDUO)
})

test('5. depois que Bruno sai, a tela de Ana mostra o Salão sem a ficha dele', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  // Controle: Ana via Bruno; depois da viagem, a tela de verdade dela o perde.
  await viagemAprovada(page, bruno)
  await expect
    .poll(async () => (await lerTela(ana.page)).laranja, { timeout: ESPERA_TELA, message: `a ficha de ${J2} deveria sumir da tela de ${J1}` })
    .toBeLessThanOrEqual(RESIDUO)

  const espelho = await abrirEspelho(page, J1)

  await expect
    .poll(async () => (await lerEspelho(espelho)).chaoA, { timeout: ESPERA_TELA, message: `a tela de ${J1} (${espelho.onde}) deveria mostrar o chão do ${CENA_A}` })
    .toBeGreaterThan(PIXELS_DE_CENA_NO_ESPELHO)
  const tela = await lerEspelho(espelho)
  expect(tela.limao, `a tela de ${J1} deveria mostrar a ficha dela`).toBeGreaterThan(PIXELS_DE_TOKEN_NO_ESPELHO)
  expect(tela.laranja, `a tela de ${J1} não deveria mostrar a ficha de ${J2}, que foi para a ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  expect(tela.chaoB, `a tela de ${J1} não deveria ter chão da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
})
