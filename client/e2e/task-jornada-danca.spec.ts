// JORNADA DO MINIGAME DE DANÇA AO VIVO, de ponta a ponta (fase 4 do plano
// moonlit-sauteeing-barto, seção Verification).
//
// A FEATURE: o mestre põe um pino de minigame ligado a uma porta trancada,
// "Chamar para dançar" → "Enviar convite"; cada jogador chamado vê o convite,
// escolhe o ritmo e marca "Estou pronto"; o mestre "Começar" e todos dançam
// juntos. Todos passando, a porta destranca e abre e o prêmio vai para a
// mochila de cada um; alguém abaixo da nota, a porta fica fechada e só ele leva
// a consequência. "Pausar/Retomar/Encerrar para todos" chegam a todos.
//
// COMO ESTE ARQUIVO PROVA (preparo herdado de task-jornada-pausa-por-cena):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro em modo Tauri; Ana e Bruno
//   são o `player.html` inteiro, cada um no próprio contexto. Só o TRANSPORTE
//   Rust é falsificado: o WebSocket roteado do jogador vira `net:message` no
//   mestre, e o `net_send` do mestre volta ao socket por `exposeFunction`. Como
//   o Rust (SONS F5d), cada socket recebe primeiro a `midia.chave`, e a rota
//   `/sons/<id>` vira um `route` que serve um wav gerado aqui SÓ com a chave
//   daquele jogador e só se o `net_send` liberou o id a ele (`liberar`);
//   `/media/<id>` não serve mais áudio e não pode ser pedido.
//   GESTO REAL nas telas: cliques do mestre no pino e no painel; o jogador
//   escolhe o ritmo e marca Pronto com o mouse.
//   AS SETAS: um auto-tocador no jogador (o mesmo da vitrine,
//   minigames/danca/tela/vitrine) aperta as teclas de seta na hora de cada
//   seta. A hora sai do FIO: ele lê o `danca.comecar` no mesmo evento em que a
//   tela o lê (o `recebidoEm` dela) e calcula a posição 0 da música pela mesma
//   regra pura da tela (`esperaDaMusica`). Quem "não toca nada" só não aperta.
//   PROVA: o que cada tela mostra (painel do mestre, resultado e "Comigo" do
//   jogador). A porta é lida da store do mestre: no canvas, porta aberta e
//   destrancada não tem um texto para ler.
//
// ÁUDIO EM HEADLESS: `--autoplay-policy=no-user-gesture-required`, como em
// docs/design/minigame-danca/provas/gerar-provas.cjs — sem ele a música pode
// não tocar sozinha, e sem música a tela não julga nenhuma seta.
import { test as base, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { buildPin, createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { MINIGAME_PADRAO, type MinigameDanca, type NotaDaDanca, type TrilhaDanca } from '../src/minigames/danca/tipos'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token, Wall } from '../src/types/map'
import { mostrarColunaDireita } from './helpers/colunaDireita'
import { pickTool } from './helpers/tools'

const AUTOPLAY = '--autoplay-policy=no-user-gesture-required'

/** O navegador do config (GPU, `LAB_NAVEGADOR`) com o áudio liberado: só esta jornada precisa dele. */
const test = base.extend({
  launchOptions: [
    async ({ launchOptions }, use) => {
      await use({ ...launchOptions, args: [...(launchOptions.args ?? []), AUTOPLAY] })
    },
    { scope: 'worker' },
  ],
})

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'DANCA1'
const ANA = 'Ana'
const BRUNO = 'Bruno'
const AVENTURA = 'Salao da Dona Ziza'
const ID_CENA = 'scene_salao'
const PASTA = 'C:/appdata/maps/map_ziza'
const TOKEN_ANA = 'Lanterna'
const TOKEN_BRUNO = 'Machado'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }
/** Igual a `FIT_MARGIN` de pixi/PixiCanvas.tsx (enquadramento de abertura do editor). */
const FIT_MARGIN_MESTRE = 40

const ID_DO_PINO = 'pino-danca'
const ID_DA_PORTA = 'porta-ziza'
const PREMIO = MINIGAME_PADRAO.premio.texto
const PENALIDADE = MINIGAME_PADRAO.consequencia.texto
const NPC = MINIGAME_PADRAO.npc

/** Espera de tela comum (mensagem cruzar o fio e a tela pintar). */
const ESPERA = 10_000
/** A demo inteira (~46 s) + 3 s de contagem + folga para a máquina carregada. */
const ESPERA_DA_DEMO = 90_000
/** Toques no meio da música antes de o mestre pausar: depois da contagem de 3 s. */
const DENTRO_DA_MUSICA_MS = 5000

type Ponto = { x: number; y: number }
const casa = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const POS_PINO = casa(20, 6)

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: uma cena, a porta trancada e o pino ligado a ela
// ───────────────────────────────────────────────────────────────────────────

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function mapaDaDanca(minigame: MinigameDanca): MapData {
  const base = createEmptyMap('map_ziza', AVENTURA, COLUNAS, LINHAS, GRADE)
  const pino: Pin = { ...buildPin(ID_DO_PINO, POS_PINO, 'minigame'), minigame, portaLigada: ID_DA_PORTA }
  return {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    // O contorno faz o enquadramento do editor ser o mundo inteiro (a conta do clique no pino).
    walls: [
      parede('w-n', 0, 0, LARGURA, 0),
      parede('w-l', LARGURA, 0, LARGURA, ALTURA),
      parede('w-s', LARGURA, ALTURA, 0, ALTURA),
      parede('w-o', 0, ALTURA, 0, 0),
      parede(ID_DA_PORTA, 1700, 250, 1700, 350, { open: false, locked: true, kind: 'normal' }),
    ],
    tokens: [token('tok-lanterna', TOKEN_ANA, casa(30, 3), '#3cff00'), token('tok-machado', TOKEN_BRUNO, casa(31, 3), '#ff5a00')],
    pins: [pino],
  }
}

function discoDaAventura(mapa: MapData): Record<string, string> {
  const aventura = { version: 1, id: 'adv_ziza', name: AVENTURA, startSceneId: ID_CENA, scenes: [{ id: ID_CENA, name: AVENTURA, file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(mapa), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

// ───────────────────────────────────────────────────────────────────────────
// A música importada: um wav curto e as duas coreografias prontas
// ───────────────────────────────────────────────────────────────────────────

const ID_DA_MUSICA = `${'ab'.repeat(32)}.wav`
const DURACAO_DA_MUSICA_S = 5
const TRILHAS: readonly TrilhaDanca[] = [0, 1, 2, 3]
const COREOGRAFIA: NotaDaDanca[] = [1, 1.5, 2, 2.5, 3, 3.5].map((t, i) => ({ t, lane: TRILHAS[i % TRILHAS.length] ?? 0, len: 0, sub: 4 }))

const MUSICA_IMPORTADA: MinigameDanca = {
  ...MINIGAME_PADRAO,
  musica: {
    tipo: 'arquivo',
    midia: `midia:${ID_DA_MUSICA}`,
    nome: 'Valsa curta',
    bpm: 120,
    primeiraBatida: 0.5,
    fase4: 0,
    duracaoS: DURACAO_DA_MUSICA_S,
    coreografias: { diversao: COREOGRAFIA, expert: COREOGRAFIA },
  },
}

/** WAV PCM 16 bits mono: um lá de 440 Hz com volume baixo, `segundos` de duração. */
function wavDeTeste(segundos: number): Uint8Array {
  const taxa = 22_050
  const amostras = Math.round(taxa * segundos)
  const bytes = new Uint8Array(44 + amostras * 2)
  const v = new DataView(bytes.buffer)
  const texto = (em: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(em + i, s.charCodeAt(i))
  }
  texto(0, 'RIFF')
  v.setUint32(4, 36 + amostras * 2, true)
  texto(8, 'WAVE')
  texto(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, taxa, true)
  v.setUint32(28, taxa * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  texto(36, 'data')
  v.setUint32(40, amostras * 2, true)
  for (let i = 0; i < amostras; i += 1) v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / taxa) * 3000), true)
  return bytes
}

/**
 * O `Buffer` do Node, que o `route.fulfill` pede para corpo binário (um
 * `Uint8Array` vira "1,2,3" lá dentro). O tsconfig das jornadas não carrega os
 * tipos do Node (ver playwright.config.ts), então ele vem do global: o
 * `Reflect.get` devolve `any`, e o tipo mínimo é declarado aqui. Existe em todo
 * processo Node, que é onde o spec roda.
 */
const BufferDoNode: { from(bytes: Uint8Array): string } = Reflect.get(globalThis, 'Buffer')

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco de mentira e transporte de mentira
// ───────────────────────────────────────────────────────────────────────────

type EventoTauri = { event: string; id: number; payload: unknown }
type HandlerTauri = (evento: EventoTauri) => void
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __labParaJogador: (clientId: string, texto: string, liberar: string[]) => void
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: (cmd: string, args?: unknown) => Promise<unknown>
    transformCallback: (cb: HandlerTauri) => number
    convertFileSrc: (filePath: string) => string
  }
}

interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Mensagens do jogador entregues ao mestre uma de cada vez, na ordem em que chegaram. */
  fila: Promise<void>
  /** A chave de cada conexão (`midia.chave`, 64 hex), como o Rust sorteia por socket. */
  chaves: Map<string, string>
  /** Os áudios liberados a cada conexão pelo `liberar` do `net_send`, como o Rust guarda. */
  liberadas: Map<string, Set<string>>
}

async function mestreAbreAventura(mestre: Page, mapa: MapData): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), fila: Promise.resolve(), chaves: new Map(), liberadas: new Map() }
  await mestre.exposeFunction('__labParaJogador', (clientId: string, texto: string, liberar: string[]) => {
    // Como o Rust: libera ANTES de pôr a mensagem no socket.
    const liberadas = rede.liberadas.get(clientId) ?? new Set<string>()
    for (const id of liberar) liberadas.add(id)
    rede.liberadas.set(clientId, liberadas)
    rede.sockets.get(clientId)?.send(texto)
  })
  await mestre.addInitScript(
    ({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }) => {
      // O stub do Tauri mora na janela: as chaves não existem no tipo `Window` do DOM.
      const alvo = window as unknown as JanelaDoMestre
      // A lista de recursos guarda a URL de cada módulo que o app carregou (ver `portaNoMestre`); o padrão de 250 não cabe o app em dev.
      performance.setResourceTimingBufferSize(10_000)
      const textos: Record<string, string> = { ...arquivos }
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const existe = (caminho: string): boolean => {
        const c = semBarraFinal(caminho)
        return Object.keys(textos).some((p) => p === c || p.indexOf(`${c}/`) === 0)
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
        invoke: async (cmd, args) => {
          const campo = (nome: string): unknown => (typeof args === 'object' && args !== null ? Reflect.get(args, nome) : undefined)
          switch (cmd) {
            case 'net_start_room':
              return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
            case 'net_send': {
              const liberar = campo('liberar')
              alvo.__labParaJogador(String(campo('clientId')), JSON.stringify(campo('msg')), Array.isArray(liberar) ? liberar.map(String) : [])
              return null
            }
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
      }
    },
    { arquivos: discoDaAventura(mapa), codigo: CODIGO },
  )

  await mestre.goto('/')
  await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await mestre.waitForSelector('canvas')
  await mostrarColunaDireita(mestre)
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

/** Aba Jogo, card do jogador, "Atribuir <ficha>": o jogador passa a jogar, e só quem joga pode ser chamado. */
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

/** O painel da dança do pino: Selecionar, toque no pino, e a seção "Dança ao vivo" aparece. */
async function mestreAbrePino(mestre: Page, mapa: MapData): Promise<Locator> {
  await pickTool(mestre, 'Selecionar')
  const ponto = await naTelaDoMestre(mestre, mapa, POS_PINO)
  await mestre.mouse.click(ponto.x, ponto.y)
  const painel = mestre.getByRole('region', { name: 'Dança ao vivo' })
  await expect(painel, 'tocar o pino de minigame com Selecionar não abriu a "Dança ao vivo"').toBeVisible({ timeout: ESPERA })
  return painel
}

async function mestreConvidaTodos(painel: Locator): Promise<void> {
  await painel.getByRole('button', { name: 'Chamar para dançar' }).click()
  await expect(painel.getByRole('checkbox', { name: ANA }), 'Ana deveria vir marcada').toBeChecked()
  await expect(painel.getByRole('checkbox', { name: BRUNO }), 'Bruno deveria vir marcado').toBeChecked()
  await painel.getByRole('button', { name: 'Enviar convite' }).click()
  await expect(painel.getByText('Convidado'), 'os dois deveriam aparecer como convidados').toHaveCount(2, { timeout: ESPERA })
}

async function mestreComeca(painel: Locator): Promise<void> {
  await expect(painel.getByText('Pronto · Diversão'), 'os dois deveriam estar prontos antes do Começar').toHaveCount(2, { timeout: ESPERA })
  await painel.getByRole('button', { name: 'Começar' }).click()
  await expect(painel.getByText('Dançando').first(), 'depois do Começar, o painel deveria mostrar quem dança').toBeVisible({ timeout: ESPERA })
}

/**
 * A porta ligada, como está agora no mapa do mestre. A store é a MESMA que o
 * app usa: num vite reaproveitado, o módulo que mudou depois de o servidor subir
 * é servido com `?t=<ms>`, e importar a URL sem carimbo daria outra store
 * (playwright.config.ts, `reuseExistingServer`). A URL sai da lista de recursos.
 */
async function portaNoMestre(mestre: Page): Promise<{ open: boolean; locked: boolean } | null> {
  return mestre.evaluate(async (id) => {
    const carregada = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((nome) => new URL(nome).pathname === '/src/stores/mapStore.ts')
    const modulo: typeof import('/src/stores/mapStore.ts') = await import(/* @vite-ignore */ carregada ?? '/src/stores/mapStore.ts')
    const { useMapStore } = modulo
    const porta = useMapStore.getState().map.walls.find((w) => w.id === id)?.door
    return porta === null || porta === undefined ? null : { open: porta.open, locked: porta.locked === true }
  }, ID_DA_PORTA)
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador: player.html inteiro, com o auto-tocador no fio
// ───────────────────────────────────────────────────────────────────────────

/** O que o auto-tocador deixa na janela do jogador, para o teste ler. */
interface EspiaoDaDanca {
  /** `false` = o jogador que não toca nada. */
  toca: boolean
  /** As setas da coreografia DESTE jogador, como chegaram no fio (JSON). */
  notas: string | null
  /** Posição 0 da música em `performance.now()` deste aparelho. */
  inicioMs: number | null
  apertadas: number
}

declare global {
  interface Window {
    __espiaoDaDanca?: EspiaoDaDanca
  }
}

interface Jogador {
  page: Page
  nome: string
  /** Quantas vezes a música importada foi ENTREGUE por `/sons/<id>` (com a chave dele e liberada a ele). */
  musicaPedida: () => number
  /** Quantas vezes `/sons/<id>` recusou (sem chave, chave de outro, não liberado). */
  musicaRecusada: () => number
  /** Quantas vezes a música foi pedida a `/media/<id>`, que não serve mais áudio (F5d): deve ficar em 0. */
  musicaPorMedia: () => number
}

const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

/**
 * O AUTO-TOCADOR (o da vitrine, ligado ao fio de verdade). Roda na página do
 * jogador antes do app: embrulha o `WebSocket` (o mock do `routeWebSocket`, que
 * já está no lugar) e ouve as mensagens da dança no MESMO evento em que a
 * conexão do app as lê. No `danca.comecar`, agenda cada seta: tecla de seta
 * descendo na hora em que ela soa, subindo logo depois. Pausa desagenda.
 */
function instalarAutoTocador({ nome, toca }: { nome: string; toca: boolean }): void {
  const espiao: EspiaoDaDanca = { toca, notas: null, inicioMs: null, apertadas: 0 }
  window.__espiaoDaDanca = espiao
  const TECLA = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight']
  const timers: number[] = []
  let modulos: Promise<[typeof import('/src/net/protocoloDaDanca.ts'), typeof import('/src/minigames/danca/coreografia.ts'), typeof import('/src/minigames/danca/tela/partidaDoConvite.ts')]> | null = null
  const carregar = () => {
    modulos ??= Promise.all([import('/src/net/protocoloDaDanca.ts'), import('/src/minigames/danca/coreografia.ts'), import('/src/minigames/danca/tela/partidaDoConvite.ts')])
    return modulos
  }
  let convite: { pinId: string; musica: MinigameDanca['musica'] } | null = null
  let fila: Promise<void> = Promise.resolve()

  const receber = async (texto: string, recebidoEm: number): Promise<void> => {
    let bruto: unknown
    try {
      bruto = JSON.parse(texto)
    } catch {
      return
    }
    const [protocolo, coreografia, partida] = await carregar()
    const msg = protocolo.parseDancaHostMessage(bruto)
    if (msg === null) return
    if (msg.type === 'danca.convite') convite = { pinId: msg.pinId, musica: msg.musica }
    if (msg.type === 'danca.pausa' || msg.type === 'danca.encerra' || msg.type === 'danca.desfecho') {
      for (const id of timers.splice(0)) window.clearTimeout(id)
    }
    if (msg.type !== 'danca.comecar' || convite === null) return
    const eu = msg.participantes.find((p) => p.nome === nome)
    if (eu === undefined) return
    const notas = coreografia.notasDaMusica(convite.musica, eu.dificuldade, convite.pinId)
    // A mesma conta de `configDaPartida`: `recebidoEm + emMs + espera da música importada`.
    const inicioMs = recebidoEm + msg.emMs + partida.esperaDaMusica(convite.musica) * 1000
    espiao.notas = JSON.stringify(notas)
    espiao.inicioMs = inicioMs
    if (!espiao.toca) return
    for (const n of notas) {
      const quando = inicioMs + n.t * 1000 - performance.now()
      if (quando < 0) continue
      const code = TECLA[n.lane]
      timers.push(
        window.setTimeout(() => {
          espiao.apertadas += 1
          window.dispatchEvent(new KeyboardEvent('keydown', { code }))
        }, quando),
      )
      timers.push(window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code })), quando + Math.max(80, n.len * 1000)))
    }
  }

  const Original = window.WebSocket
  class SocketComEspiao extends Original {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols)
      this.addEventListener('message', (ev: MessageEvent) => {
        // A hora da chegada, antes de qualquer espera: é o `recebidoEm` da tela.
        const recebidoEm = performance.now()
        if (typeof ev.data !== 'string') return
        const texto = ev.data
        fila = fila.then(() => receber(texto, recebidoEm)).catch(() => undefined)
      })
    }
  }
  window.WebSocket = SocketComEspiao
}

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string, toca: boolean): Promise<Jogador> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  let pedidos = 0
  let recusas = 0
  let porMedia = 0
  // Uma chave por jogador, 64 hex minúsculos como a do Rust ('1…1', '2…2').
  const chave = String(rede.chaves.size + 1).repeat(64)
  rede.chaves.set(clientId, chave)
  // A rota dos sons do servidor Rust (F5d): o wav da música importada, só com a chave DESTE
  // jogador e só se o mestre a liberou a ele. Toda recusa é o mesmo 404 vazio.
  // Só o caminho da sala: um glob com 'sons' pegaria também os módulos do Vite em /src/lib/sons/.
  await contexto.route(
    (url) => url.pathname.startsWith('/sons/'),
    async (route) => {
      const id = new URL(route.request().url()).pathname.slice('/sons/'.length)
      const veio = route.request().headers()['x-labirinto-chave']
      if (id !== ID_DA_MUSICA || veio !== chave || rede.liberadas.get(clientId)?.has(id) !== true) {
        recusas += 1
        await route.fulfill({ status: 404, body: '' })
        return
      }
      pedidos += 1
      await route.fulfill({ status: 200, contentType: 'audio/wav', body: BufferDoNode.from(wavDeTeste(DURACAO_DA_MUSICA_S)) })
    },
  )
  // `/media/<id>` não serve mais áudio: a música não pode ser pedida ali.
  await contexto.route(`**/media/${ID_DA_MUSICA}`, async (route) => {
    porMedia += 1
    await route.fulfill({ status: 404, body: '' })
  })
  const page = await contexto.newPage()
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      rede.sockets.set(clientId, ws)
      // Como o Rust: o primeiro frame de toda conexão é a chave dela.
      ws.send(JSON.stringify({ type: 'midia.chave', chave }))
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.fila = rede.fila
          .then(() =>
            rede.mestre.evaluate(
              ({ c, t }) => {
                const msg: unknown = JSON.parse(t)
                // O stub do Tauri mora na janela: as chaves não existem no tipo `Window` do DOM.
                ;(window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: c, msg })
              },
              { c: clientId, t: texto },
            ),
          )
          .catch(() => undefined)
      })
    },
  )
  // Depois do `routeWebSocket`: o auto-tocador embrulha o mock dele, não o contrário.
  await page.addInitScript(instalarAutoTocador, { nome, toca })
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODIGO, { delay: 20 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.pressSequentially(nome, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: ESPERA })
  return { page, nome, musicaPedida: () => pedidos, musicaRecusada: () => recusas, musicaPorMedia: () => porMedia }
}

const dialogoDaDanca = (j: Jogador): Locator => j.page.getByRole('dialog', { name: `Desafio de dança: ${NPC}` })

/** O convite na tela do jogador: escolhe Diversão e marca "Estou pronto". */
async function jogadorFicaPronto(j: Jogador): Promise<void> {
  const dialogo = dialogoDaDanca(j)
  await expect(dialogo, `${j.nome}: o convite da dança não apareceu`).toBeVisible({ timeout: ESPERA })
  await dialogo.getByRole('radio', { name: /Diversão/ }).check()
  const pronto = dialogo.getByRole('button', { name: 'Estou pronto' })
  await expect(pronto, `${j.nome}: "Estou pronto" não ficou disponível (a música não baixou?)`).toBeEnabled({ timeout: ESPERA })
  await pronto.click()
}

/** O resultado da dança na tela do jogador, já com o desfecho do grupo. */
async function jogadorVeDesfecho(j: Jogador, timeout: number): Promise<Locator> {
  const desfecho = dialogoDaDanca(j).locator('.dz-desfecho')
  await expect(desfecho, `${j.nome}: o desfecho do grupo não chegou`).not.toHaveAttribute('data-tom', 'espera', { timeout })
  return desfecho
}

/** A mesa do resultado: "Você" e o colega, cada um com a letra. */
async function mesaDoJogador(j: Jogador): Promise<string[]> {
  return dialogoDaDanca(j)
    .locator('.dz-mesa li')
    .evaluateAll((linhas) => linhas.map((l) => Array.from(l.querySelectorAll('span'), (s) => (s.textContent ?? '').trim()).join(' | ')))
}

/** Volta ao mapa e lê a seção "Comigo" (a mochila) do painel do jogador. */
async function mochilaDoJogador(j: Jogador): Promise<Locator> {
  await dialogoDaDanca(j).getByRole('button', { name: 'Voltar ao mapa' }).click()
  await expect(dialogoDaDanca(j), `${j.nome}: "Voltar ao mapa" não fechou a dança`).toBeHidden({ timeout: ESPERA })
  const comigo = j.page.getByRole('region', { name: 'Comigo' })
  await expect(comigo, `${j.nome}: o painel não mostra a seção "Comigo"`).toBeVisible({ timeout: ESPERA })
  return comigo
}

interface Mesa {
  rede: Rede
  ana: Jogador
  bruno: Jogador
  painel: Locator
}

/** Mestre abre a aventura e a sala; Ana e Bruno entram e ganham ficha; o mestre abre o pino e convida os dois. */
async function mesaConvidada(browser: Browser, mestre: Page, baseURL: string, mapa: MapData, brunoToca = true): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre, mapa)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', ANA, true)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', BRUNO, brunoToca)
  await mestreAtribui(mestre, ANA, TOKEN_ANA)
  await mestreAtribui(mestre, BRUNO, TOKEN_BRUNO)
  for (const j of [ana, bruno]) await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu`).toBeVisible({ timeout: ESPERA })
  const painel = await mestreAbrePino(mestre, mapa)
  await mestreConvidaTodos(painel)
  await jogadorFicaPronto(ana)
  await jogadorFicaPronto(bruno)
  return { rede, ana, bruno, painel }
}

/** O desfecho do painel do mestre, com o texto de cada linha. */
async function desfechoDoMestre(painel: Locator, timeout: number): Promise<string> {
  const desfecho = painel.locator('.lb-danca__desfecho')
  await expect(desfecho, 'o painel do mestre não mostrou o desfecho').toBeVisible({ timeout })
  return (await desfecho.textContent()) ?? ''
}

const contar = (texto: string, trecho: string): number => texto.split(trecho).length - 1

// ───────────────────────────────────────────────────────────────────────────
// Os cenários
// ───────────────────────────────────────────────────────────────────────────

test('(a) os dois passam: a porta destranca e abre, a chave vai para a mochila de cada um e o resultado mostra a mesa', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(240_000)
  const mapa = mapaDaDanca(MINIGAME_PADRAO)
  const { ana, bruno, painel } = await mesaConvidada(browser, mestre, baseURL ?? '', mapa)
  expect(await portaNoMestre(mestre), 'a porta deveria começar fechada e trancada').toEqual({ open: false, locked: true })
  await mestreComeca(painel)

  for (const j of [ana, bruno]) {
    const desfecho = await jogadorVeDesfecho(j, ESPERA_DA_DEMO)
    await expect(desfecho).toHaveText(`${PREMIO} foi para a sua mochila.`)
    await expect(dialogoDaDanca(j).getByRole('heading', { name: 'A porta se abriu' })).toBeVisible()
    const mesa = await mesaDoJogador(j)
    const outro = j === ana ? BRUNO : ANA
    expect(mesa.length, `${j.nome}: a mesa deveria ter os dois`).toBe(2)
    expect(mesa.some((l) => /^Você \| (S|A|B) \|/.test(l)), `${j.nome}: a própria linha deveria passar (S, A ou B). Mesa: ${mesa.join(' / ')}`).toBe(true)
    expect(mesa.some((l) => new RegExp(`^${outro} \\| (S|A|B) \\|`).test(l)), `${j.nome}: a linha de ${outro} deveria passar. Mesa: ${mesa.join(' / ')}`).toBe(true)
  }

  const texto = await desfechoDoMestre(painel, ESPERA)
  expect(texto).toContain('Todos passaram')
  expect(texto).toContain('A porta abriu.')
  expect(contar(texto, `Recebeu: ${PREMIO}`), 'o painel deveria dizer o prêmio de cada um').toBe(2)
  await expect.poll(() => portaNoMestre(mestre), { message: 'a porta deveria ficar aberta e destrancada no mapa do mestre', timeout: ESPERA }).toEqual({ open: true, locked: false })

  for (const j of [ana, bruno]) await expect(await mochilaDoJogador(j), `${j.nome}: a chave deveria estar na mochila`).toContainText(PREMIO, { timeout: ESPERA })
})

test('(b) um não toca nada: nota abaixo de B, a porta continua fechada, só ele leva a consequência e ninguém ganha o prêmio', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(240_000)
  const mapa = mapaDaDanca(MINIGAME_PADRAO)
  const { ana, bruno, painel } = await mesaConvidada(browser, mestre, baseURL ?? '', mapa, false)
  await mestreComeca(painel)

  const desfechoDaAna = await jogadorVeDesfecho(ana, ESPERA_DA_DEMO)
  await expect(desfechoDaAna).toHaveText('Você passou, mas nem todos passaram: o prêmio só sai quando o grupo inteiro passa.')
  const desfechoDoBruno = await jogadorVeDesfecho(bruno, ESPERA)
  await expect(desfechoDoBruno).toContainText(`Anotado no seu caderno: ${PENALIDADE}.`)
  const mesa = await mesaDoJogador(ana)
  expect(mesa.some((l) => new RegExp(`^${BRUNO} \\| (C|D|Falhou) \\|`).test(l)), `a linha de Bruno deveria ficar abaixo de B. Mesa: ${mesa.join(' / ')}`).toBe(true)
  expect(mesa.some((l) => /^Você \| (S|A|B) \|/.test(l)), `Ana tocou tudo e deveria passar. Mesa: ${mesa.join(' / ')}`).toBe(true)

  const texto = await desfechoDoMestre(painel, ESPERA)
  expect(texto).toContain('Nem todos passaram')
  expect(texto).toContain('A porta continua fechada.')
  expect(contar(texto, `Penalidade: ${PENALIDADE}`), 'a consequência é só de quem não passou').toBe(1)
  expect(texto).not.toContain('Recebeu')
  expect(await portaNoMestre(mestre), 'a porta deveria continuar fechada e trancada').toEqual({ open: false, locked: true })

  for (const j of [ana, bruno]) await expect(await mochilaDoJogador(j), `${j.nome}: ninguém deveria ganhar a chave`).not.toContainText(PREMIO)
})

test('(c) pausar, retomar e encerrar para todos: os dois veem cada passo, e nada é aplicado', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(150_000)
  const mapa = mapaDaDanca(MINIGAME_PADRAO)
  const { ana, bruno, painel } = await mesaConvidada(browser, mestre, baseURL ?? '', mapa)
  await mestreComeca(painel)
  await mestre.waitForTimeout(DENTRO_DA_MUSICA_MS)

  await painel.getByRole('button', { name: 'Pausar para todos' }).click()
  for (const j of [ana, bruno]) await expect(j.page.getByRole('heading', { name: 'O mestre pausou a dança' }), `${j.nome}: não viu a pausa do mestre`).toBeVisible({ timeout: ESPERA })
  await expect(painel.getByText('Pausado', { exact: true }), 'o painel deveria mostrar os dois pausados').toHaveCount(2)

  await painel.getByRole('button', { name: 'Retomar para todos' }).click()
  for (const j of [ana, bruno]) await expect(j.page.getByRole('heading', { name: 'O mestre pausou a dança' }), `${j.nome}: a pausa não saiu ao retomar`).toBeHidden({ timeout: ESPERA })
  await expect(painel.getByText('Dançando', { exact: true }), 'o painel deveria mostrar os dois dançando de novo').toHaveCount(2, { timeout: ESPERA })

  await painel.getByRole('button', { name: 'Encerrar para todos' }).click()
  for (const j of [ana, bruno]) {
    await expect(dialogoDaDanca(j).getByRole('heading', { name: 'O mestre encerrou a dança' }), `${j.nome}: não viu o aviso do encerramento`).toBeVisible({ timeout: ESPERA })
    await expect(dialogoDaDanca(j).getByText('Nada foi ganho nem perdido.', { exact: true })).toBeVisible()
  }
  await expect(painel.getByText('Dança encerrada: nada foi ganho nem perdido.')).toBeVisible({ timeout: ESPERA })
  expect(await portaNoMestre(mestre), 'encerrar não abre a porta').toEqual({ open: false, locked: true })
})

test('(d) música importada: /sons/<id> com a chave serve o wav aos dois (nunca /media), a coreografia é a mesma nos dois e a dança fecha', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(150_000)
  const mapa = mapaDaDanca(MUSICA_IMPORTADA)
  const { ana, bruno, painel } = await mesaConvidada(browser, mestre, baseURL ?? '', mapa)
  for (const j of [ana, bruno]) {
    await expect.poll(() => j.musicaPedida(), { message: `${j.nome}: a música importada deveria vir da sala por /sons, com a chave dele`, timeout: ESPERA }).toBeGreaterThan(0)
    expect(j.musicaRecusada(), `${j.nome}: /sons não deveria ter recusado (sem chave, chave de outro ou não liberada)`).toBe(0)
    expect(j.musicaPorMedia(), `${j.nome}: a música não pode ser pedida a /media`).toBe(0)
  }
  await mestreComeca(painel)

  for (const j of [ana, bruno]) await jogadorVeDesfecho(j, 45_000)
  const [notasDaAna, notasDoBruno] = await Promise.all([ana, bruno].map((j) => j.page.evaluate(() => window.__espiaoDaDanca?.notas ?? null)))
  expect(notasDaAna, 'a coreografia de Ana deveria ser a do pino').toBe(JSON.stringify(COREOGRAFIA))
  expect(notasDoBruno, 'a coreografia de Bruno deveria ser a mesma de Ana').toBe(notasDaAna)
  for (const j of [ana, bruno]) {
    // Na tela: a soma de Perfeito, Bom, Ok e Errou é o número de setas da coreografia.
    const contas = await dialogoDaDanca(j)
      .locator('.dz-contas li:not([data-seg]) b')
      .evaluateAll((bs) => bs.reduce((soma, b) => soma + Number(b.textContent ?? '0'), 0))
    expect(contas, `${j.nome}: o resultado deveria julgar as ${COREOGRAFIA.length} setas`).toBe(COREOGRAFIA.length)
  }
  const texto = await desfechoDoMestre(painel, ESPERA)
  expect(texto).toContain('Todos passaram')
  await expect.poll(() => portaNoMestre(mestre), { timeout: ESPERA }).toEqual({ open: true, locked: false })
})
