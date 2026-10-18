// JORNADA DO MINIGAME DE PESCA, de ponta a ponta (fase 5 do plano
// stateful-tumbling-cook, item e2e).
//
// A FEATURE: o pino de minigame troca para Pesca no painel do mestre. Em
// "Mestre chama", "Chamar para pescar" → "Enviar convite": cada jogador chamado
// escolhe a dificuldade e pesca N lances no próprio aparelho; o placar do
// mestre acompanha cada um ao vivo (estado, lance k de N, medidor, cesto, maior
// peixe) e "Pausar/Continuar/Encerrar para todos" chegam a todos. Em "Jogador
// toca no pino", o cartão do pino oferece "Pescar", apagado com a ficha longe;
// encostada, o toque pede o convite e só aquele jogador pesca. Pela Visão de
// jogador, o mestre chama o jogador de TESTE e a pesca roda dentro da janela de
// teste, no Olhar, sem tocar o jogo de verdade.
//
// COMO ESTE ARQUIVO PROVA (preparo herdado de task-jornada-danca e
// task-jornada-danca-visao-de-jogador):
//   TELAS DE VERDADE. O mestre é o app inteiro em modo Tauri; os jogadores são o
//   `player.html` inteiro, cada um no próprio contexto. Só o TRANSPORTE Rust é
//   falsificado: o WebSocket roteado do jogador vira `net:message` no mestre, e
//   o `net_send` do mestre volta ao socket por `exposeFunction`. Na Visão de
//   jogador, a janela nativa vira o popup do navegador e fala com o editor pelo
//   BroadcastChannel de verdade.
//   GESTO REAL: cliques do mestre no pino e no painel; o jogador escolhe a
//   dificuldade, toca o pino e arrasta a ficha com o mouse. A pesca é jogada
//   pelo TECLADO de verdade (`page.keyboard`: Espaço desce e sobe), não por
//   evento sintético.
//   O ROBÔ PESCADOR lê o que a TELA mostra — o título da coluna ("Lance",
//   "Força 63%", "Fisgou! Aperte já", "Medidor 41%") e os pixels do
//   instrumento (a borda da barra verde e o corpo do peixe) — e reage como
//   gente: ~250 ms depois de ver, nunca na hora. Na puxada segura quando o
//   peixe que ele viu está acima do meio da barra (a política `politicaSegue`
//   da sim, com o atraso de reação). Um lance que escapa ou foge é resultado
//   válido: os cenários conferem o fluxo, não a vitória.
//   PROVA: o que cada tela mostra (resultado de cada lance e o cesto no
//   jogador; a linha de cada um no placar do mestre). A pausa é lida no
//   instrumento do jogador (medidor, barra e peixe parados por 1 s).
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { buildPin, createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { CH, CW, CX, CY, MW, MX } from '../src/minigames/pesca/arte'
import { MINIGAME_PESCA_PADRAO } from '../src/minigames/pesca/tipos'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token, Wall } from '../src/types/map'
import { mostrarColunaDireita } from './helpers/colunaDireita'
import { pickTool } from './helpers/tools'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'PESCA1'
const ANA = 'Ana'
const BRUNO = 'Bruno'
const AVENTURA = 'Poco do Bento'
const ID_CENA = 'scene_poco'
const PASTA = 'C:/appdata/maps/map_bento'
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
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx. */
const FIT_MARGIN_JOGADOR = 24
/** Cabeça do pino na tela do jogador: 31 px de mundo acima da ponta acerta a cabeça e foge da ficha. */
const CABECA_DO_PINO_JOGADOR = 31
/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120

const ID_DO_PINO = 'pino-poco'
const NPC = MINIGAME_PESCA_PADRAO.npc
const DIALOGO_DA_PESCA = `Desafio de pesca: ${NPC}`
const PREFIXO_DO_TESTE = 'Teste · '

/** Espera de tela comum (mensagem cruzar o fio e a tela pintar). */
const ESPERA = 10_000
/** Teto de uma pesca inteira pelo robô (3 lances com espera longa e puxada até o fim). */
const PESCA_INTEIRA_MS = 180_000

type Ponto = { x: number; y: number }
const casa = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const POS_PINO = casa(20, 6)
/** Cenário (b): a ficha de Ana começa a 3 casas do pino (longe) e é arrastada para logo abaixo dele (encostada). */
const ANA_LONGE = casa(17, 7)
const ANA_ENCOSTADA = casa(20, 7)

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: uma cena e o pino de minigame (dança, o padrão)
// ───────────────────────────────────────────────────────────────────────────

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** O pino nasce com o desafio PADRÃO (a dança): quem troca para Pesca é o mestre, no painel. */
function mapaDoPoco(tokens: Token[]): MapData {
  const base = createEmptyMap('map_bento', AVENTURA, COLUNAS, LINHAS, GRADE)
  const pino: Pin = buildPin(ID_DO_PINO, POS_PINO, 'minigame')
  return {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    // O contorno faz o enquadramento do editor ser o mundo inteiro (a conta do clique no pino).
    walls: [parede('w-n', 0, 0, LARGURA, 0), parede('w-l', LARGURA, 0, LARGURA, ALTURA), parede('w-s', LARGURA, ALTURA, 0, ALTURA), parede('w-o', 0, ALTURA, 0, 0)],
    tokens,
    pins: [pino],
  }
}

function discoDaAventura(mapa: MapData): Record<string, string> {
  const aventura = { version: 1, id: 'adv_bento', name: AVENTURA, startSceneId: ID_CENA, scenes: [{ id: ID_CENA, name: AVENTURA, file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(mapa), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco de mentira e transporte de mentira
// ───────────────────────────────────────────────────────────────────────────

type EventoTauri = { event: string; id: number; payload: unknown }
type HandlerTauri = (evento: EventoTauri) => void
type InternosDoTauri = {
  metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
  invoke: (cmd: string, args?: unknown) => Promise<unknown>
  transformCallback: (cb: HandlerTauri) => number
  convertFileSrc: (filePath: string) => string
}
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __labParaJogador: (clientId: string, texto: string) => void
  __TAURI_INTERNALS__: InternosDoTauri
}
type JanelaComDisco = { isTauri: boolean; __TAURI_INTERNALS__: InternosDoTauri }

interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Mensagens do jogador entregues ao mestre uma de cada vez, na ordem em que chegaram. */
  fila: Promise<void>
}

/** O mestre abre a aventura e a SALA (cenários a e b): o transporte de mentira de task-jornada-danca. */
async function mestreAbreAventura(mestre: Page, mapa: MapData): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), fila: Promise.resolve() }
  await mestre.exposeFunction('__labParaJogador', (clientId: string, texto: string) => {
    rede.sockets.get(clientId)?.send(texto)
  })
  await mestre.addInitScript(
    ({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }) => {
      // O stub do Tauri mora na janela: as chaves não existem no tipo `Window` do DOM.
      const alvo = window as unknown as JanelaDoMestre
      // A lista de recursos guarda a URL de cada módulo que o app carregou (ver `mapaDoEditor`); o padrão de 250 não cabe o app em dev.
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
            case 'net_send':
              alvo.__labParaJogador(String(campo('clientId')), JSON.stringify(campo('msg')))
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

/**
 * O EDITOR SEM SALA (cenário c): disco de mentira e a janela nativa da Visão de
 * jogador como popup do navegador (o preparo de task-jornada-danca-visao-de-jogador).
 */
async function editorAbreAventura(mestre: Page, mapa: MapData): Promise<void> {
  await mestre.addInitScript((arquivos: Record<string, string>) => {
    // Só o editor: o popup da Visão de jogador é outra página e não leva o disco.
    if (location.pathname.indexOf('visao-jogador') !== -1) return
    performance.setResourceTimingBufferSize(10_000)
    const textos: Record<string, string> = { ...arquivos }
    const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
    const existe = (caminho: string): boolean => {
      const c = semBarraFinal(caminho)
      return Object.keys(textos).some((p) => p === c || p.indexOf(`${c}/`) === 0)
    }
    // O stub do Tauri mora na janela: as chaves não existem no tipo `Window` do DOM.
    const alvo = window as unknown as JanelaComDisco
    const callbacks = new Map<number, HandlerTauri>()
    let proximoId = 1
    /** A janela da Visão de jogador: o Rust de verdade cria janela nativa; aqui ela vira o popup do navegador. */
    let janelaDeTeste: Window | null = null
    alvo.isTauri = true
    alvo.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      convertFileSrc: (caminho: string) => String(caminho),
      transformCallback: (cb) => {
        const id = proximoId
        proximoId += 1
        callbacks.set(id, cb)
        return id
      },
      invoke: async (cmd, args) => {
        const campo = (nome: string): unknown => (typeof args === 'object' && args !== null ? Reflect.get(args, nome) : undefined)
        switch (cmd) {
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
          case 'plugin:event|listen':
            return Number(campo('handler'))
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
            return null
        }
      },
    }
  }, discoDaAventura(mapa))

  await mestre.goto('/')
  await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await mestre.waitForSelector('canvas')
  await mostrarColunaDireita(mestre)
}

/** Aba Grupo, card do jogador, "Atribuir <ficha>": o jogador passa a jogar, e só quem joga pode ser chamado. */
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

type ComoComeca = 'Mestre chama' | 'Jogador toca no pino'

/**
 * Selecionar, toque no pino, e no painel do minigame: "Pesca" no lugar da
 * Dança, como começa e quantos lances. Devolve a seção "Pesca ao vivo"
 * (só existe com a sala ou a Visão de jogador aberta).
 */
async function mestrePoePesca(mestre: Page, mapa: MapData, comoComeca: ComoComeca, lances: number): Promise<Locator> {
  await pickTool(mestre, 'Selecionar')
  const ponto = await naTelaDoMestre(mestre, mapa, POS_PINO)
  await mestre.mouse.click(ponto.x, ponto.y)
  const painel = mestre.locator('.lb-minigame')
  const jogo = painel.getByRole('radiogroup', { name: 'Jogo' })
  await expect(jogo, 'tocar o pino de minigame com Selecionar não abriu o painel do jogo').toBeVisible({ timeout: ESPERA })
  await expect(jogo.getByRole('radio', { name: 'Dança' }), 'o pino novo nasce com a dança').toHaveAttribute('aria-checked', 'true')
  await jogo.getByRole('radio', { name: 'Pesca' }).click()
  await expect(jogo.getByRole('radio', { name: 'Pesca' }), 'o clique em "Pesca" não trocou o jogo do pino').toHaveAttribute('aria-checked', 'true')
  const entrada = painel.getByRole('radiogroup', { name: 'Como começa' }).getByRole('radio', { name: comoComeca })
  await entrada.click()
  await expect(entrada).toHaveAttribute('aria-checked', 'true')
  const quantos = painel.getByRole('radiogroup', { name: 'Lances por pesca' }).getByRole('radio', { name: String(lances), exact: true })
  await quantos.click()
  await expect(quantos).toHaveAttribute('aria-checked', 'true')
  const aoVivo = painel.getByRole('region', { name: 'Pesca ao vivo' })
  await expect(aoVivo, 'com a pesca no pino, o painel deveria mostrar a "Pesca ao vivo"').toBeVisible({ timeout: ESPERA })
  return aoVivo
}

/** "Chamar para pescar": confere quem vem marcado e envia o convite. */
async function mestreChama(aoVivo: Locator, nomes: readonly (string | RegExp)[]): Promise<void> {
  await aoVivo.getByRole('button', { name: 'Chamar para pescar' }).click()
  const lista = aoVivo.locator('form.lb-pesca-vivo__convite')
  await expect(lista.getByRole('checkbox'), 'a lista do convite deveria ter só quem pode pescar').toHaveCount(nomes.length, { timeout: ESPERA })
  for (const nome of nomes) await expect(lista.getByRole('checkbox', { name: nome }), `${String(nome)} deveria vir marcado`).toBeChecked()
  await lista.getByRole('button', { name: 'Enviar convite' }).click()
  await expect(lista, 'o convite enviado deveria fechar a lista').toBeHidden({ timeout: ESPERA })
}

const placar = (aoVivo: Locator): Locator => aoVivo.locator('.lb-pesca-vivo__placar > li')

function linhaDoPlacar(aoVivo: Locator, nome: string | RegExp): Locator {
  return placar(aoVivo).filter({ has: aoVivo.page().locator('.lb-pesca-vivo__nome', { hasText: nome }) })
}

/**
 * O mapa do EDITOR (pinos, fichas, paredes), como está na store que o app usa:
 * num vite reaproveitado o módulo pode vir carimbado (`?t=<ms>`), e importar a
 * URL sem carimbo daria outra store (ver task-jornada-danca, `portaNoMestre`).
 */
async function mapaDoEditor(mestre: Page): Promise<string> {
  return mestre.evaluate(async () => {
    const carregada = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((nome) => new URL(nome).pathname === '/src/stores/mapStore.ts')
    const modulo: typeof import('/src/stores/mapStore.ts') = await import(/* @vite-ignore */ carregada ?? '/src/stores/mapStore.ts')
    const { pins, tokens, walls } = modulo.useMapStore.getState().map
    return JSON.stringify({ pins, tokens, walls })
  })
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador: player.html inteiro
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  nome: string
}

const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Jogador> {
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
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODIGO, { delay: 20 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.pressSequentially(nome, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: ESPERA })
  return { page, nome }
}

/** Mestre abre a aventura e a sala; Ana e Bruno entram e ganham ficha. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string, mapa: MapData): Promise<{ rede: Rede; ana: Jogador; bruno: Jogador }> {
  const rede = await mestreAbreAventura(mestre, mapa)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', ANA)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', BRUNO)
  await mestreAtribui(mestre, ANA, TOKEN_ANA)
  await mestreAtribui(mestre, BRUNO, TOKEN_BRUNO)
  for (const j of [ana, bruno]) await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu`).toBeVisible({ timeout: ESPERA })
  return { rede, ana, bruno }
}

type Dificuldade = 'Normal' | 'Extremo'

/** O convite na tela de quem pesca: escolhe a dificuldade e toca "Ir pescar". */
async function aceitaConvite(page: Page, quem: string, dificuldade: Dificuldade): Promise<void> {
  const dialogo = page.getByRole('dialog', { name: DIALOGO_DA_PESCA })
  await expect(dialogo, `${quem}: o convite da pesca não apareceu`).toBeVisible({ timeout: ESPERA })
  const radio = dialogo.getByRole('radio', { name: new RegExp(`^${dificuldade}`) })
  await radio.check()
  await expect(radio).toBeChecked()
  await dialogo.getByRole('button', { name: 'Ir pescar' }).click()
  await expect(dialogo.locator('.pz-coluna'), `${quem}: "Ir pescar" não levou ao primeiro lance`).toHaveAttribute('data-tela', 'jogo', { timeout: ESPERA })
}

// ───────────────────────────────────────────────────────────────────────────
// O robô pescador: lê a tela e aperta o Espaço com reação de gente
// ───────────────────────────────────────────────────────────────────────────

/** A geometria do instrumento (minigames/pesca/arte.ts), para ler os pixels dele. */
interface GeometriaDoInstrumento {
  cx: number
  cw: number
  cy: number
  ch: number
  mx: number
  mw: number
}
const INSTRUMENTO: GeometriaDoInstrumento = { cx: CX, cw: CW, cy: CY, ch: CH, mx: MX, mw: MW }

/** O que a tela da pesca mostra agora, em palavras e em pixels. */
interface Leitura {
  /** `performance.now()` da página, no instante da leitura. */
  agora: number
  /** `convite` | `jogo` | `resultado` | `cesto` | `encerrada`; `null` = a tela da pesca não está aberta. */
  tela: string | null
  /** O título da coluna durante o lance: "Lance", "Força 63%", "Fisgou! Aperte já", "Medidor 41%"... */
  titulo: string
  tom: string
  /** A caixa de pausa por cima do lago (a do mestre ou a do jogador). */
  pausa: boolean
  /** O primeiro rótulo da coluna: "Lance 2 de 3" no resultado. */
  rotulo: string | null
  /** O título grande do resultado ou do cesto ("Pegou!", "Escapou", "Cesto vazio"...). */
  manchete: string | null
  sub: string | null
  maior: string | null
  /** O botão principal da coluna (Próximo lance, Ver o cesto, Fechar). */
  botao: { texto: string; ligado: boolean } | null
  /** Linha do instrumento (px de canvas, de cima para baixo) onde está o corpo do peixe; `null` fora da puxada. */
  peixe: number | null
  /** Linha do meio da barra verde; `null` fora da puxada. */
  barra: number | null
  /** Altura do medidor pintado, em px de canvas. */
  medidor: number | null
}

/**
 * Roda NA PÁGINA: lê a coluna da pesca e o canvas do instrumento. A borda da
 * barra verde é `#c4e6c9` (a coluna `cx` é só água e barra: o peixe começa 9 px
 * à direita, e o baú 1 px); o corpo do peixe é `#eceae4`, lido nas colunas do
 * meio dele (fora do baú); o fundo do medidor é `#141417`.
 */
function lerPescaNaPagina(g: GeometriaDoInstrumento): Leitura {
  const agora = performance.now()
  const raiz = document.querySelector('.lb-pesca')
  const vazia: Leitura = { agora, tela: null, titulo: '', tom: '', pausa: false, rotulo: null, manchete: null, sub: null, maior: null, botao: null, peixe: null, barra: null, medidor: null }
  if (raiz === null) return vazia
  const coluna = raiz.querySelector('.pz-coluna')
  const texto = (el: Element | null | undefined): string | null => (el === null || el === undefined ? null : (el.textContent ?? '').trim())
  const fase = raiz.querySelector('.pz-hud__fase')
  const botaoEl = coluna?.querySelector('button.pz-btn--primario') ?? null
  const leitura: Leitura = {
    ...vazia,
    tela: coluna?.getAttribute('data-tela') ?? null,
    titulo: texto(fase) ?? '',
    tom: fase?.getAttribute('data-tom') ?? '',
    pausa: raiz.querySelector('.pz-pausa') !== null,
    rotulo: texto(coluna?.querySelector('.pz-rotulo')),
    manchete: texto(coluna?.querySelector('h2')),
    sub: texto(coluna?.querySelector('.pz-res__sub')),
    maior: texto(coluna?.querySelector('.pz-maior')),
    botao: botaoEl instanceof HTMLButtonElement ? { texto: (botaoEl.textContent ?? '').trim(), ligado: !botaoEl.disabled } : null,
  }
  const tela = raiz.querySelector('.pz-campo canvas')
  const ctx = tela instanceof HTMLCanvasElement ? tela.getContext('2d') : null
  if (!(tela instanceof HTMLCanvasElement) || ctx === null) return leitura
  const { data, width } = ctx.getImageData(0, 0, tela.width, tela.height)
  const eh = (x: number, y: number, r: number, gr: number, b: number): boolean => {
    const i = (y * width + x) * 4
    return data[i] === r && data[i + 1] === gr && data[i + 2] === b
  }
  let topo = -1
  let base = -1
  let somaDoPeixe = 0
  let pixelsDoPeixe = 0
  let medidor = 0
  const xDoMedidor = g.mx + Math.floor(g.mw / 2)
  for (let y = g.cy; y < g.cy + g.ch; y += 1) {
    if (eh(g.cx, y, 196, 230, 201)) {
      if (topo < 0) topo = y
      base = y
    }
    for (let x = g.cx + 11; x <= g.cx + 15; x += 1) {
      if (eh(x, y, 236, 234, 228)) {
        somaDoPeixe += y
        pixelsDoPeixe += 1
      }
    }
    if (!eh(xDoMedidor, y, 20, 20, 23)) medidor += 1
  }
  return { ...leitura, barra: topo >= 0 && base > topo ? (topo + base + 1) / 2 : null, peixe: pixelsDoPeixe > 0 ? somaDoPeixe / pixelsDoPeixe : null, medidor }
}

const lerPesca = (page: Page): Promise<Leitura> => page.evaluate(lerPescaNaPagina, INSTRUMENTO)

/** Reação de gente: o robô age sobre o que viu há ~250 ms (a regra dos jogos do usuário: nunca zero). */
const REACAO_MS = 250
/** Um quadro entre leituras (a leitura em si custa um ida e volta à página). */
const PASSO_DO_ROBO_MS = 16
/** Solta o lance quando a força passa disto (o título "Força N%"). */
const FORCA_ALVO = 50
/**
 * Na puxada o robô dá TOQUES (segura 80 ms, solta 80 ms) enquanto o peixe que
 * ele viu está acima do meio da barra, como gente faz com a barra pesada.
 * Medido na sim de verdade (`passo`, 300 puxadas, reação 250 ms, leitura a
 * cada ~31 ms): segurar direto pega ~29% no Normal, adiantar a barra pela
 * velocidade dela piora (~3%) e o toque de 80 ms pega ~53%. No Extremo
 * nenhum dos três passa de ~3%: lá o "Escapou" é o resultado esperado.
 */
const TOQUE_NA_PUXADA_MS = 80
/** Segurou e a força não começou (a tecla não pegou): solta e tenta de novo. */
const SEGURA_SEM_CARGA_MS = 1500

interface LanceNaTela {
  /** "Lance 2 de 3". */
  rotulo: string
  /** "Pegou!", "Escapou" ou "Fugiu". */
  manchete: string
  sub: string
}

interface FimDaPesca {
  lances: LanceNaTela[]
  cesto: Leitura
}

const percentual = (titulo: string): number => Number(/(\d+)%/.exec(titulo)?.[1] ?? '0')

/**
 * O que o robô VIU há `REACAO_MS`, nesta puxada: o peixe está acima do meio da
 * barra? `null` = ainda não há o que ter visto (fica como está, segurando da fisgada).
 */
function peixeAcimaDaBarra(historico: readonly Leitura[], agora: number, inicioDaPuxada: number): boolean | null {
  for (let i = historico.length - 1; i >= 0; i -= 1) {
    const h = historico[i]
    if (h === undefined || h.agora < inicioDaPuxada) return null
    // Canvas cresce para baixo: "acima" é a linha menor.
    if (h.agora <= agora - REACAO_MS && h.peixe !== null && h.barra !== null) return h.peixe < h.barra
  }
  return null
}

/**
 * O ROBÔ PESCADOR, do primeiro lance ao cesto, só com o Espaço do teclado de
 * verdade e o clique no botão da coluna. Devolve cada lance como a tela o
 * mostrou e a leitura do cesto.
 */
async function pescarComRobo(page: Page, quem: string): Promise<FimDaPesca> {
  const historico: Leitura[] = []
  const lances: LanceNaTela[] = []
  let segurando = false
  let apertouEm = 0
  let soltouEm = 0
  let inicioDaPuxada = 0
  let visto: { chave: string; em: number } | null = null
  let clicado = ''
  let ultima: Leitura | null = null
  const apertar = async (agora: number): Promise<void> => {
    if (segurando) return
    await page.keyboard.down('Space')
    segurando = true
    apertouEm = agora
  }
  const soltar = async (agora: number): Promise<void> => {
    if (!segurando) return
    await page.keyboard.up('Space')
    segurando = false
    soltouEm = agora
  }
  /** O robô viu `chave` agora; só age `REACAO_MS` depois da primeira vez que viu. */
  const reagiu = (chave: string, agora: number): boolean => {
    if (visto === null || visto.chave !== chave) visto = { chave, em: agora }
    return agora - visto.em >= REACAO_MS
  }
  const limite = Date.now() + PESCA_INTEIRA_MS
  while (Date.now() < limite) {
    const l = await lerPesca(page)
    if (l.titulo.startsWith('Medidor') && !(ultima?.titulo.startsWith('Medidor') ?? false)) inicioDaPuxada = l.agora
    ultima = l
    historico.push(l)
    if (historico.length > 600) historico.splice(0, 300)
    if (l.tela === 'cesto') {
      await soltar(l.agora)
      return { lances, cesto: l }
    }
    if (l.tela === null || l.tela === 'encerrada' || l.tela === 'convite') throw new Error(`${quem}: a tela da pesca ficou em "${l.tela ?? 'fechada'}" no meio do robô`)
    if (l.pausa) {
      // Pausado (pelo mestre): solta e espera; nada a fazer até a caixa sair.
      await soltar(l.agora)
      visto = null
    } else if (l.tela === 'resultado') {
      await soltar(l.agora)
      const rotulo = l.rotulo ?? ''
      if (!lances.some((x) => x.rotulo === rotulo)) lances.push({ rotulo, manchete: l.manchete ?? '', sub: l.sub ?? '' })
      if (l.botao !== null && l.botao.ligado && clicado !== rotulo && reagiu(`resultado ${rotulo}`, l.agora)) {
        clicado = rotulo
        await page.locator('.lb-pesca .pz-coluna').getByRole('button', { name: l.botao.texto, exact: true }).click()
      }
    } else if (l.titulo === 'Lance') {
      // Segurar enche a força; soltar lança.
      if (!segurando) {
        if (reagiu('lance', l.agora)) await apertar(l.agora)
      } else if (l.agora - apertouEm > SEGURA_SEM_CARGA_MS) await soltar(l.agora)
    } else if (l.titulo.startsWith('Força')) {
      if (percentual(l.titulo) >= FORCA_ALVO && reagiu('forca', l.agora)) await soltar(l.agora)
    } else if (l.tom === 'alerta') {
      // O "!": fisga depois de ver (na espera, apertar antes só recolhe a linha).
      if (reagiu('fisgada', l.agora)) await apertar(l.agora)
    } else if (l.titulo.startsWith('Medidor')) {
      // Toques curtos enquanto o peixe visto está acima do meio da barra; senão, solta.
      const acima = peixeAcimaDaBarra(historico, l.agora, inicioDaPuxada)
      if (acima === false) await soltar(l.agora)
      else if (acima === true) {
        if (segurando && l.agora - apertouEm >= TOQUE_NA_PUXADA_MS) await soltar(l.agora)
        else if (!segurando && l.agora - soltouEm >= TOQUE_NA_PUXADA_MS) await apertar(l.agora)
      }
    } else {
      // Lançou, Esperando, Puxou cedo e o fim do lance (Pegou!, Escapou, Fugiu): mãos fora.
      await soltar(l.agora)
    }
    await page.waitForTimeout(PASSO_DO_ROBO_MS)
  }
  throw new Error(`${quem}: o robô não chegou ao cesto em ${PESCA_INTEIRA_MS / 1000} s. Última tela: ${JSON.stringify(ultima)}`)
}

const MANCHETES_DO_LANCE = ['Pegou!', 'Escapou', 'Fugiu']

/** Confere os lances e o cesto que a tela do jogador mostrou; devolve quantos peixes ele pegou. */
function conferePesca(quem: string, fim: FimDaPesca, lances: number): number {
  expect(
    fim.lances.map((l) => l.rotulo),
    `${quem}: a tela deveria mostrar o resultado de cada lance, na ordem`,
  ).toEqual(Array.from({ length: lances }, (_, i) => `Lance ${i + 1} de ${lances}`))
  for (const l of fim.lances) expect(MANCHETES_DO_LANCE, `${quem}: ${l.rotulo} terminou em "${l.manchete}"`).toContain(l.manchete)
  const pegos = fim.lances.filter((l) => l.manchete === 'Pegou!').length
  const perdidos = lances - pegos
  const titulo = pegos === 0 ? 'Cesto vazio' : pegos === 1 ? '1 peixe no cesto' : `${pegos} peixes no cesto`
  expect(fim.cesto.manchete, `${quem}: o cesto deveria contar os peixes pegos. Lances: ${JSON.stringify(fim.lances)}`).toBe(titulo)
  const textoDosLances = lances === 1 ? '1 lance' : `${lances} lances`
  expect(fim.cesto.sub).toBe(`${textoDosLances}: ${pegos} ${pegos === 1 ? 'pego' : 'pegos'}, ${perdidos} ${perdidos === 1 ? 'perdido' : 'perdidos'}.`)
  if (pegos > 0) expect(fim.cesto.maior, `${quem}: com peixe no cesto, a tela deveria dizer o maior`).toMatch(/^Maior peixe: .+, \d+ cm$/)
  else expect(fim.cesto.maior).toBeNull()
  return pegos
}

/** A linha de quem terminou no placar do mestre: "terminou", N de N lances, o cesto, o maior e a dificuldade. */
async function placarMostraFim(aoVivo: Locator, nome: string | RegExp, fim: FimDaPesca, lances: number, dificuldade: Dificuldade): Promise<void> {
  const linha = linhaDoPlacar(aoVivo, nome)
  await expect(linha, `o placar deveria ter uma linha de ${String(nome)}`).toHaveCount(1)
  await expect(linha.locator('.lb-pesca-vivo__status'), `${String(nome)}: o placar deveria dizer que terminou`).toHaveText('terminou', { timeout: ESPERA })
  const nums = linha.locator('.lb-pesca-vivo__nums')
  await expect(nums).toContainText(`${lances} de ${lances} lances`)
  const pegos = fim.lances.filter((l) => l.manchete === 'Pegou!').length
  await expect(nums, `${String(nome)}: o cesto do placar deveria ter os ${pegos} peixes da tela dele`).toContainText(`Cesto ${pegos}`)
  await expect(nums).toContainText(dificuldade)
  // "Maior peixe: Bagre, 31 cm" na tela do jogador é "Maior Bagre, 31 cm" no placar.
  const maior = fim.cesto.maior === null ? 'Maior —' : fim.cesto.maior.replace(/^Maior peixe: /, 'Maior ')
  await expect(nums, `${String(nome)}: o maior peixe do placar deveria ser o da tela dele`).toContainText(maior)
}

/** "Fechar" no cesto: a tela da pesca some e o mapa volta. */
async function fechaOCesto(page: Page, quem: string): Promise<void> {
  const dialogo = page.getByRole('dialog', { name: DIALOGO_DA_PESCA })
  await dialogo.getByRole('button', { name: 'Fechar' }).click()
  await expect(dialogo, `${quem}: "Fechar" não fechou a tela da pesca`).toBeHidden({ timeout: ESPERA })
}

/** O instrumento parado: título, medidor, barra e peixe. */
const instrumento = (l: Leitura): { titulo: string; medidor: number | null; barra: number | null; peixe: number | null } => ({
  titulo: l.titulo,
  medidor: l.medidor,
  barra: l.barra,
  peixe: l.peixe,
})

/**
 * Com `j` no meio de uma puxada, o mestre pausa para todos: o instrumento de
 * `j` fica parado por 1 s (o medidor do placar também), e "Continuar para
 * todos" o destrava. O robô de `j` continua rodando: ele solta ao ver a pausa.
 */
async function pausaCongelaAPuxada(aoVivo: Locator, j: Jogador): Promise<void> {
  await expect
    .poll(async () => (await lerPesca(j.page)).titulo, { message: `${j.nome}: nenhuma puxada começou para o mestre pausar`, timeout: PESCA_INTEIRA_MS, intervals: [50] })
    .toMatch(/^Medidor/)
  const acoes = aoVivo.locator('.lb-pesca-vivo__acoes')
  await acoes.getByRole('button', { name: 'Pausar para todos' }).click()
  const pausa = j.page.locator('.lb-pesca .pz-pausa')
  await expect(pausa, `${j.nome}: a pausa do mestre não chegou`).toBeVisible({ timeout: ESPERA })
  await expect(pausa.getByRole('heading', { name: 'O mestre pausou a pesca' })).toBeVisible()
  await expect(aoVivo.getByRole('status')).toHaveText('Pausado para todos.')
  // O motor lê a pausa no efeito depois do render que mostra a caixa: um quadro de folga.
  await j.page.waitForTimeout(150)
  const congelada = await lerPesca(j.page)
  expect(congelada.titulo, `${j.nome}: a pausa deveria pegar a puxada no meio (a puxada mais curta dura 2,7 s)`).toMatch(/^Medidor/)
  expect(congelada.barra, `${j.nome}: a barra verde deveria estar no instrumento`).not.toBeNull()
  const linha = linhaDoPlacar(aoVivo, j.nome)
  await expect(linha.locator('.lb-pesca-vivo__status'), `${j.nome}: o placar deveria dizer "pausado"`).toHaveText('pausado', { timeout: ESPERA })
  const medidorNoMestre = await linha.getByRole('meter').getAttribute('aria-valuenow')
  const ate = Date.now() + 1000
  while (Date.now() < ate) {
    await j.page.waitForTimeout(100)
    expect(instrumento(await lerPesca(j.page)), `${j.nome}: com a pausa do mestre, o medidor, a barra e o peixe não podem andar`).toEqual(instrumento(congelada))
  }
  expect(await linha.getByRole('meter').getAttribute('aria-valuenow'), 'o medidor do placar também fica parado').toBe(medidorNoMestre)

  await acoes.getByRole('button', { name: 'Continuar para todos' }).click()
  await expect(pausa, `${j.nome}: "Continuar para todos" não tirou a caixa de pausa`).toBeHidden({ timeout: ESPERA })
  await expect
    .poll(async () => instrumento(await lerPesca(j.page)), { message: `${j.nome}: depois de "Continuar", a puxada deveria andar de novo`, timeout: ESPERA, intervals: [100] })
    .not.toEqual(instrumento(congelada))
}

// ───────────────────────────────────────────────────────────────────────────
// A tela do jogador: tocar o pino e arrastar a ficha (cenário b)
// ───────────────────────────────────────────────────────────────────────────

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

/** Toca a cabeça do pino na tela do jogador e devolve o botão "Pescar" do cartão. */
async function jogadorAbreOPino(j: Jogador): Promise<Locator> {
  const pescar = j.page.getByRole('dialog').getByRole('button', { name: 'Pescar', exact: true })
  await tocar(j.page, naTelaDoJogador({ x: POS_PINO.x, y: POS_PINO.y - CABECA_DO_PINO_JOGADOR }))
  await expect(pescar, `${j.nome}: tocar o pino de pesca não abriu o cartão com "Pescar"`).toBeVisible({ timeout: ESPERA })
  return pescar
}

// ───────────────────────────────────────────────────────────────────────────
// Os cenários
// ───────────────────────────────────────────────────────────────────────────

test('(a) Mestre chama: dois jogadores pescam 3 lances no teclado, o placar mostra o fim de cada um e a pausa congela a puxada', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(300_000)
  const LANCES = 3
  const mapa = mapaDoPoco([token('tok-lanterna', TOKEN_ANA, casa(30, 3), '#3cff00'), token('tok-machado', TOKEN_BRUNO, casa(31, 3), '#ff5a00')])
  const { ana, bruno } = await mesaMontada(browser, mestre, baseURL ?? '', mapa)
  const aoVivo = await mestrePoePesca(mestre, mapa, 'Mestre chama', LANCES)
  await mestreChama(aoVivo, [ANA, BRUNO])
  await expect(placar(aoVivo), 'o placar deveria ter os dois chamados').toHaveCount(2, { timeout: ESPERA })
  for (const nome of [ANA, BRUNO]) await expect(linhaDoPlacar(aoVivo, nome).locator('.lb-pesca-vivo__status')).toHaveText('no convite')

  await aceitaConvite(ana.page, ANA, 'Normal')
  await aceitaConvite(bruno.page, BRUNO, 'Extremo')

  // Os dois robôs pescam juntos; no meio, o mestre pausa uma puxada de Ana e continua.
  const [fimDaAna, fimDoBruno] = await Promise.all([pescarComRobo(ana.page, ANA), pescarComRobo(bruno.page, BRUNO), pausaCongelaAPuxada(aoVivo, ana)])
  const pegosAna = conferePesca(ANA, fimDaAna, LANCES)
  const pegosBruno = conferePesca(BRUNO, fimDoBruno, LANCES)
  console.log(`[pesca a] Ana ${pegosAna}/${LANCES} (${fimDaAna.lances.map((l) => l.manchete).join(', ')}); Bruno ${pegosBruno}/${LANCES} (${fimDoBruno.lances.map((l) => l.manchete).join(', ')})`)

  await placarMostraFim(aoVivo, ANA, fimDaAna, LANCES, 'Normal')
  await placarMostraFim(aoVivo, BRUNO, fimDoBruno, LANCES, 'Extremo')
  for (const j of [ana, bruno]) await fechaOCesto(j.page, j.nome)
})

test('(b) Jogador toca no pino: "Pescar" apagado longe, aceso com a ficha encostada, o convite vem só para ele e o mestre vê a linha dele', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(240_000)
  const LANCES = 2
  const mapa = mapaDoPoco([token('tok-lanterna', TOKEN_ANA, ANA_LONGE, '#3cff00'), token('tok-machado', TOKEN_BRUNO, casa(31, 3), '#ff5a00')])
  const { ana, bruno } = await mesaMontada(browser, mestre, baseURL ?? '', mapa)
  const aoVivo = await mestrePoePesca(mestre, mapa, 'Jogador toca no pino', LANCES)
  await expect(aoVivo.getByRole('button', { name: 'Chamar para pescar' }), 'no modo pino o mestre não chama').toHaveCount(0)
  await expect(placar(aoVivo), 'ninguém pesca antes de alguém tocar no pino').toHaveCount(0)

  // Longe: o cartão mostra "Pescar" apagado e diz para chegar perto.
  const pescarLonge = await jogadorAbreOPino(ana)
  await expect(pescarLonge, 'com a ficha a 3 casas, "Pescar" deveria ficar apagado').toBeDisabled()
  await expect(ana.page.getByText('Chegue mais perto para pescar.')).toBeVisible()
  await ana.page.keyboard.press('Escape')
  await expect(pescarLonge, 'Escape deveria fechar o cartão do pino').toBeHidden({ timeout: ESPERA })

  // Ana arrasta a própria ficha para logo abaixo do pino e toca de novo.
  await arrastar(ana.page, naTelaDoJogador(ANA_LONGE), naTelaDoJogador(ANA_ENCOSTADA))
  const pescar = await jogadorAbreOPino(ana)
  await expect(pescar, 'com a ficha encostada no pino, "Pescar" deveria acender').toBeEnabled({ timeout: ESPERA })
  await expect(ana.page.getByText('Chegue mais perto para pescar.')).toBeHidden()
  await pescar.click()

  // O convite volta só para Ana; Bruno, longe e sem pedir, não vê nada.
  await aceitaConvite(ana.page, ANA, 'Normal')
  await expect(bruno.page.locator('.lb-pesca'), 'o convite do modo pino é só de quem tocou: Bruno não pesca').toHaveCount(0)
  await expect(placar(aoVivo), 'o placar do mestre deveria ganhar a linha de Ana').toHaveCount(1, { timeout: ESPERA })
  await expect(linhaDoPlacar(aoVivo, ANA)).toHaveCount(1)

  const fim = await pescarComRobo(ana.page, ANA)
  const pegos = conferePesca(ANA, fim, LANCES)
  console.log(`[pesca b] Ana ${pegos}/${LANCES} (${fim.lances.map((l) => l.manchete).join(', ')})`)
  await placarMostraFim(aoVivo, ANA, fim, LANCES, 'Normal')
  await expect(placar(aoVivo), 'só Ana pescou').toHaveCount(1)
  await expect(bruno.page.locator('.lb-pesca'), 'Bruno continua fora da pesca').toHaveCount(0)
  await fechaOCesto(ana.page, ANA)
})

test('(c) Visão de jogador: o mestre chama o jogador de teste, a pesca roda na janela de teste no Olhar e o editor fica intacto', async ({ page: mestre }) => {
  test.setTimeout(240_000)
  const LANCES = 2
  const mapa = mapaDoPoco([token('tok-lanterna', TOKEN_ANA, casa(30, 3), '#3cff00')])
  await editorAbreAventura(mestre, mapa)

  // 1. Aba Grupo, SEM abrir sala: "Visão de jogador" → a ficha → o popup abre.
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  await expect(mestre.getByRole('button', { name: 'Abrir sala' }), 'a jornada é sem sala: "Abrir sala" deveria estar à vista').toBeVisible()
  await mestre.getByRole('button', { name: /Visão de jogador/ }).click()
  const escolha = mestre.getByRole('dialog', { name: 'Escolher a ficha' })
  await expect(escolha, 'o botão "Visão de jogador" não abriu a escolha da ficha').toBeVisible({ timeout: ESPERA })
  const [popup] = await Promise.all([mestre.waitForEvent('popup'), escolha.getByRole('option', { name: new RegExp(`^${TOKEN_ANA},`) }).click()])
  await popup.waitForLoadState('domcontentloaded')
  const barra = popup.locator('header.vj-barra')
  await expect(barra, 'a barra do teste não apareceu no popup').toBeVisible({ timeout: ESPERA })
  const olhar = barra.getByRole('radio', { name: 'Olhar' })
  await expect(olhar, 'o modo padrão da janela de teste deveria ser Olhar').toHaveAttribute('aria-checked', 'true')

  // 2. O pino no editor vira Pesca; o "Chamar para pescar" lista só o jogador de teste.
  const aoVivo = await mestrePoePesca(mestre, mapa, 'Mestre chama', LANCES)
  const antes = await mapaDoEditor(mestre)
  await mestreChama(aoVivo, [new RegExp(`^${PREFIXO_DO_TESTE}`)])

  // 3. O convite abre DENTRO da janela de teste, debaixo da barra; tudo no Olhar.
  await aceitaConvite(popup, 'jogador de teste', 'Normal')
  const telaDaPesca = popup.getByRole('dialog', { name: DIALOGO_DA_PESCA })
  await expect(telaDaPesca, 'a pesca da Visão de jogador abre na caixa da tela do jogador').toHaveAttribute('data-na-caixa', '')
  await expect(barra, 'a barra do teste deveria continuar à vista com a pesca aberta').toBeVisible()
  // Visível não basta: a pesca em tela cheia cobria a barra. O clique de ensaio confere que o mestre ainda alcança o modo.
  await olhar.click({ trial: true, timeout: ESPERA })
  await expect(placar(aoVivo), 'o painel do editor deveria mostrar o jogador de teste pescando').toHaveCount(1, { timeout: ESPERA })

  // 4. O robô pesca pelo teclado do popup.
  const fim = await pescarComRobo(popup, 'jogador de teste')
  const pegos = conferePesca('jogador de teste', fim, LANCES)
  console.log(`[pesca c] teste ${pegos}/${LANCES} (${fim.lances.map((l) => l.manchete).join(', ')})`)
  await expect(olhar, 'a pesca inteira rodou no Olhar').toHaveAttribute('aria-checked', 'true')
  await placarMostraFim(aoVivo, /./, fim, LANCES, 'Normal')
  await fechaOCesto(popup, 'jogador de teste')
  await expect(barra, 'fechada a pesca, a janela de teste continua').toBeVisible()

  // 5. O jogo de verdade não muda: o mapa do editor é o mesmo de antes do convite, e a sala segue fechada.
  expect(await mapaDoEditor(mestre), 'a pesca de teste não pode tocar o mapa do editor').toBe(antes)
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  await expect(mestre.getByRole('button', { name: 'Abrir sala' }), 'a pesca de teste não abre a sala').toBeVisible()
})
