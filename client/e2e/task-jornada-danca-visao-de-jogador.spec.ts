// JORNADA: O MESTRE TESTA A DANÇA SOZINHO, PELA VISÃO DE JOGADOR, SEM SALA.
//
// A FEATURE: com a janela de teste ("Visão de jogador") aberta, o painel do
// pino de minigame lista só o jogador de teste ("Teste · <nome>") no "Chamar
// para dançar" e manda a dança pela ponte de TESTE. A tela da dança abre DENTRO
// da janela de teste, debaixo da barra do teste, e no modo Olhar (o padrão) o
// Pronto e as setas passam — o resto da HUD continua barrado. Passando, a porta
// ligada abre só no mundo de TESTE: o mapa do editor (o jogo de verdade) não
// muda.
//
// COMO ESTE ARQUIVO PROVA:
//   O EDITOR é o app em modo Tauri (só nele a coluna direita tem a aba Jogo)
//   com disco de mentira para carregar a aventura. Nenhuma sala é aberta. O
//   comando que no app cria a janela nativa da Visão de jogador vira popup do
//   navegador (o mesmo truque de task-jornada-espelhar-tela-do-jogador), e a
//   janela fala com o editor pelo BroadcastChannel de verdade.
//   GESTO REAL: cliques do mestre no editor; na janela de teste o Pronto é
//   clicado e as setas são TECLAS de verdade (`popup.keyboard`), não evento
//   sintético. Só a HORA de cada seta vem de um espião no popup, que ouve o
//   canal e faz a mesma conta da tela (`esperaDaMusica`) — como o auto-tocador
//   de task-jornada-danca.spec.ts, mas sem disparar nada.
//   A PORTA NA JANELA DE TESTE é lida na tela: com a ficha encostada nela, a
//   tela do jogador mostra "Espiar pela porta" enquanto ela está fechada
//   (`player/PeekDoorButton.tsx`); aberta e destrancada, o botão some.
//   A PORTA NO EDITOR é lida da store do editor (no canvas não há texto).
import { test as base, expect, type Page } from '@playwright/test'
import { buildPin, createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { MINIGAME_PADRAO, type MinigameDoPino } from '../src/minigames/danca/tipos'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token, Wall } from '../src/types/map'
import { NOME_DO_CANAL } from '../src/net/visaoDeTeste/canal'
import { mostrarColunaDireita } from './helpers/colunaDireita'
import { pickTool } from './helpers/tools'

const AUTOPLAY = '--autoplay-policy=no-user-gesture-required'

/** O navegador do config (GPU, `LAB_NAVEGADOR`) com o áudio liberado: sem ele a música não toca sozinha e nada é julgado. */
const test = base.extend({
  launchOptions: [
    async ({ launchOptions }, use) => {
      await use({ ...launchOptions, args: [...(launchOptions.args ?? []), AUTOPLAY] })
    },
    { scope: 'worker' },
  ],
})

test.use({ trace: 'off', video: 'off' })

const AVENTURA = 'Salao da Dona Ziza'
const ID_CENA = 'scene_salao'
const PASTA = 'C:/appdata/maps/map_ziza'
const TOKEN = 'Lanterna'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
/** Igual a `FIT_MARGIN` de pixi/PixiCanvas.tsx (enquadramento de abertura do editor). */
const FIT_MARGIN_MESTRE = 40

const ID_DO_PINO = 'pino-danca'
const ID_DA_PORTA = 'porta-ziza'
const PREMIO = MINIGAME_PADRAO.premio.texto
const NPC = MINIGAME_PADRAO.npc
const PREFIXO_DO_TESTE = 'Teste · '

const ESPERA = 10_000
/** A demo inteira (~46 s) + 3 s de contagem + folga. */
const ESPERA_DA_DEMO = 90_000
/** Segura mínima de uma seta curta (a mesma do auto-tocador). */
const SEGURA_MIN_MS = 80
/** Folga entre soltar uma seta e apertar a próxima na MESMA pista. */
const FOLGA_NA_PISTA_MS = 30

type Ponto = { x: number; y: number }
const casa = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const POS_PINO = casa(20, 6)
/** A ficha encostada na porta (parede vertical em x=1700, y 250-350): a tela do jogador oferece "Espiar pela porta". */
const POS_TOKEN = casa(33, 5)

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function mapaDaDanca(minigame: MinigameDoPino): MapData {
  const base = createEmptyMap('map_ziza', AVENTURA, COLUNAS, LINHAS, GRADE)
  const pino: Pin = { ...buildPin(ID_DO_PINO, POS_PINO, 'minigame'), minigame, portaLigada: ID_DA_PORTA }
  const ficha: Token = { id: 'tok-lanterna', characterId: null, name: TOKEN, x: POS_TOKEN.x, y: POS_TOKEN.y, size: 1, image: null, color: '#3cff00' }
  return {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    walls: [
      parede('w-n', 0, 0, LARGURA, 0),
      parede('w-l', LARGURA, 0, LARGURA, ALTURA),
      parede('w-s', LARGURA, ALTURA, 0, ALTURA),
      parede('w-o', 0, ALTURA, 0, 0),
      parede(ID_DA_PORTA, 1700, 250, 1700, 350, { open: false, locked: true, kind: 'normal' }),
    ],
    tokens: [ficha],
    pins: [pino],
  }
}

function discoDaAventura(mapa: MapData): Record<string, string> {
  const aventura = { version: 1, id: 'adv_ziza', name: AVENTURA, startSceneId: ID_CENA, scenes: [{ id: ID_CENA, name: AVENTURA, file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(mapa), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

// ───────────────────────────────────────────────────────────────────────────
// O editor: app em modo Tauri com disco de mentira; NENHUMA sala é aberta
// ───────────────────────────────────────────────────────────────────────────

type HandlerTauri = (evento: { event: string; id: number; payload: unknown }) => void
type JanelaComDisco = {
  isTauri: boolean
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: (cmd: string, args?: unknown) => Promise<unknown>
    transformCallback: (cb: HandlerTauri) => number
    convertFileSrc: (filePath: string) => string
  }
}

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
    const alvo = window as unknown as JanelaComDisco
    const callbacks = new Map<number, HandlerTauri>()
    let proximoId = 1
    /** A janela da Visão de jogador: o Rust de verdade cria janela nativa; aqui ela vira o popup do navegador. */
    let janelaDeTeste: Window | null = null
    // O app em modo Tauri: só nele a coluna direita tem a aba Jogo (e nela a "Visão de jogador").
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

async function naTelaDoMestre(mestre: Page, mapa: MapData, p: Ponto): Promise<Ponto> {
  const caixa = await mestre.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('régua: o canvas do mestre não tem caixa')
  const limites = contentBounds(mapa)
  if (!limites) throw new Error('régua: a cena não tem conteúdo para o editor enquadrar')
  const c = fitCamera(limites, { width: caixa.width, height: caixa.height }, FIT_MARGIN_MESTRE)
  return { x: caixa.x + p.x * c.scale + c.x, y: caixa.y + p.y * c.scale + c.y }
}

/** A porta ligada, como está no mapa do EDITOR (a mesma store que o app usa; ver task-jornada-danca.spec.ts). */
async function portaNoEditor(mestre: Page): Promise<{ open: boolean; locked: boolean } | null> {
  return mestre.evaluate(async (id) => {
    const carregada = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((nome) => new URL(nome).pathname === '/src/stores/mapStore.ts')
    const modulo: typeof import('/src/stores/mapStore.ts') = await import(/* @vite-ignore */ carregada ?? '/src/stores/mapStore.ts')
    const porta = modulo.useMapStore.getState().map.walls.find((w) => w.id === id)?.door
    return porta === null || porta === undefined ? null : { open: porta.open, locked: porta.locked === true }
  }, ID_DA_PORTA)
}

// ───────────────────────────────────────────────────────────────────────────
// O espião da janela de teste: só LÊ o canal, para o teste saber a hora das setas
// ───────────────────────────────────────────────────────────────────────────

interface EspiaoDoTeste {
  /** As setas do jogador de teste (JSON), como a tela as calcula. */
  notas: string | null
  /** Posição 0 da música em `performance.now()` do popup. */
  inicioMs: number | null
  /** Os tipos de mensagem do host que passaram pelo canal (diagnóstico de falha). */
  tipos: string[]
}

declare global {
  interface Window {
    __espiaoDoTeste?: EspiaoDoTeste
  }
}

/**
 * Roda no popup logo que ele abre (antes do convite). Ouve o canal da Visão de
 * jogador junto com a janela de teste: as mensagens do host de teste
 * (`{ de: 'host', tipo: 'msg', msg }`). Nada é enviado nem disparado.
 */
function instalarEspiaoDoCanal(nomeDoCanal: string): void {
  const espiao: EspiaoDoTeste = { notas: null, inicioMs: null, tipos: [] }
  window.__espiaoDoTeste = espiao
  let modulos: Promise<[typeof import('/src/net/protocoloDaDanca.ts'), typeof import('/src/minigames/danca/coreografia.ts'), typeof import('/src/minigames/danca/tela/partidaDoConvite.ts')]> | null = null
  const carregar = () => {
    modulos ??= Promise.all([import('/src/net/protocoloDaDanca.ts'), import('/src/minigames/danca/coreografia.ts'), import('/src/minigames/danca/tela/partidaDoConvite.ts')])
    return modulos
  }
  let convite: { pinId: string; musica: MinigameDoPino['musica'] } | null = null
  let fila: Promise<void> = Promise.resolve()

  const receber = async (msgBruta: unknown, recebidoEm: number): Promise<void> => {
    if (typeof msgBruta === 'object' && msgBruta !== null) espiao.tipos.push(String(Reflect.get(msgBruta, 'type')))
    const [protocolo, coreografia, partida] = await carregar()
    const msg = protocolo.parseDancaHostMessage(msgBruta)
    if (msg === null) return
    if (msg.type === 'danca.convite') convite = { pinId: msg.pinId, musica: msg.musica }
    if (msg.type !== 'danca.comecar' || convite === null) return
    // Na Visão de jogador só o jogador de teste dança.
    const eu = msg.participantes[0]
    if (eu === undefined) return
    espiao.notas = JSON.stringify(coreografia.notasDaMusica(convite.musica, eu.dificuldade, convite.pinId))
    espiao.inicioMs = recebidoEm + msg.emMs + partida.esperaDaMusica(convite.musica) * 1000
  }

  // Um ouvinte a mais no MESMO canal: o BroadcastChannel entrega cada mensagem do editor a todo objeto
  // aberto com o nome, inclusive este, na mesma volta em que entrega à janela de teste. Ele nunca envia nada.
  const ouvinte = new BroadcastChannel(nomeDoCanal)
  // Preso na janela: o coletor de lixo não leva o ouvinte no meio da dança.
  Reflect.set(window, '__ouvinteDoEspiao', ouvinte)
  ouvinte.addEventListener('message', (ev: MessageEvent) => {
    const recebidoEm = performance.now()
    const dado: unknown = ev.data
    if (typeof dado !== 'object' || dado === null) return
    if (Reflect.get(dado, 'de') !== 'host' || Reflect.get(dado, 'tipo') !== 'msg') return
    const msg: unknown = Reflect.get(dado, 'msg')
    fila = fila.then(() => receber(msg, recebidoEm)).catch(() => undefined)
  })
}

const TECLA = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'] as const
type Toque = { ms: number; tecla: (typeof TECLA)[number]; desce: boolean }

/** Cada seta vira "desce" na hora dela e "sobe" depois da segura, sem sobrepor a próxima seta da mesma pista. */
function toquesDasNotas(notas: readonly { t: number; lane: number; len: number }[], inicioMs: number): Toque[] {
  const toques: Toque[] = []
  notas.forEach((n, i) => {
    const tecla = TECLA[n.lane]
    if (tecla === undefined) return
    const desce = inicioMs + n.t * 1000
    const proxima = notas.slice(i + 1).find((m) => m.lane === n.lane)
    const limite = proxima === undefined ? Number.POSITIVE_INFINITY : inicioMs + proxima.t * 1000 - FOLGA_NA_PISTA_MS
    const sobe = Math.max(desce + 10, Math.min(desce + Math.max(SEGURA_MIN_MS, n.len * 1000), limite))
    toques.push({ ms: desce, tecla, desce: true }, { ms: sobe, tecla, desce: false })
  })
  return toques.sort((a, b) => a.ms - b.ms)
}

/** Aperta as setas com o TECLADO do popup, cada uma na hora certa do relógio do popup. */
async function tocarNoPopup(popup: Page, toques: readonly Toque[]): Promise<number> {
  let apertadas = 0
  for (const toque of toques) {
    await popup.evaluate((alvo) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, alvo - performance.now()))), toque.ms)
    if (toque.desce) {
      await popup.keyboard.down(toque.tecla)
      apertadas += 1
    } else {
      await popup.keyboard.up(toque.tecla)
    }
  }
  return apertadas
}

async function foto(page: Page, nome: string): Promise<string> {
  const caminho = test.info().outputPath(nome)
  await page.screenshot({ path: caminho })
  console.log(`[foto] ${caminho}`)
  return caminho
}

// ───────────────────────────────────────────────────────────────────────────
// A jornada
// ───────────────────────────────────────────────────────────────────────────

test('Visão de jogador sem sala: o mestre chama o jogador de teste, dança no Olhar pelo popup e a porta abre só no teste', async ({ page: mestre }) => {
  test.setTimeout(240_000)
  const mapa = mapaDaDanca(MINIGAME_PADRAO)
  await editorAbreAventura(mestre, mapa)
  expect(await portaNoEditor(mestre), 'a porta do editor deveria começar fechada e trancada').toEqual({ open: false, locked: true })

  // 1. Aba Jogo, SEM abrir sala: "Visão de jogador" → a ficha → o popup abre.
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  await expect(mestre.getByRole('button', { name: 'Abrir sala' }), 'a jornada é sem sala: "Abrir sala" deveria estar à vista').toBeVisible()
  await mestre.getByRole('button', { name: /Visão de jogador/ }).click()
  const escolha = mestre.getByRole('dialog', { name: 'Escolher a ficha' })
  await expect(escolha, 'o botão "Visão de jogador" não abriu a escolha da ficha').toBeVisible({ timeout: ESPERA })
  const [popup] = await Promise.all([mestre.waitForEvent('popup'), escolha.getByRole('option', { name: new RegExp(`^${TOKEN},`) }).click()])
  await popup.waitForLoadState('domcontentloaded')
  await popup.evaluate(instalarEspiaoDoCanal, NOME_DO_CANAL)

  // A barra do teste e o modo padrão (Olhar).
  const barra = popup.locator('header.vj-barra')
  await expect(barra, 'a barra do teste não apareceu no popup').toBeVisible({ timeout: ESPERA })
  await expect(barra).toHaveAttribute('aria-label', `Visão de jogador: ${TOKEN} (teste)`)
  await expect(barra.getByRole('radio', { name: 'Olhar' }), 'o modo padrão da janela de teste deveria ser Olhar').toHaveAttribute('aria-checked', 'true')
  // Controle: a ficha está encostada na porta FECHADA, então a tela do jogador oferece espiar.
  const espiar = popup.getByRole('button', { name: 'Espiar pela porta' })
  await expect(espiar, 'controle: com a ficha na porta fechada, a tela de teste deveria mostrar "Espiar pela porta"').toBeVisible({ timeout: ESPERA })

  // 2. O pino no editor: "Dança ao vivo" lista só o jogador de teste.
  await pickTool(mestre, 'Selecionar')
  const ponto = await naTelaDoMestre(mestre, mapa, POS_PINO)
  await mestre.mouse.click(ponto.x, ponto.y)
  const painel = mestre.getByRole('region', { name: 'Dança ao vivo' })
  await expect(painel, 'tocar o pino com Selecionar não abriu a "Dança ao vivo"').toBeVisible({ timeout: ESPERA })
  await painel.getByRole('button', { name: 'Chamar para dançar' }).click()
  const chamados = painel.getByRole('checkbox')
  await expect(chamados, 'com o teste aberto, a lista deveria ter só o jogador de teste').toHaveCount(1, { timeout: ESPERA })
  const doTeste = painel.getByRole('checkbox', { name: new RegExp(`^${PREFIXO_DO_TESTE}`) })
  await expect(doTeste, `o jogador de teste deveria aparecer como "${PREFIXO_DO_TESTE}<nome>"`).toBeVisible()
  await expect(doTeste).toBeChecked()
  await painel.getByRole('button', { name: 'Enviar convite' }).click()
  await expect(painel.getByText('Convidado'), 'o jogador de teste deveria aparecer como convidado').toHaveCount(1, { timeout: ESPERA })

  // 3. O convite no popup; Pronto clicado no Olhar.
  const dialogo = popup.getByRole('dialog', { name: `Desafio de dança: ${NPC}` })
  await expect(dialogo, 'o convite da dança não apareceu na janela de teste').toBeVisible({ timeout: ESPERA })
  await expect(barra, 'a barra do teste deveria continuar à vista com a dança aberta').toBeVisible()
  await foto(popup, '01-convite-no-popup.png')
  await dialogo.getByRole('radio', { name: /Diversão/ }).check()
  const pronto = dialogo.getByRole('button', { name: 'Estou pronto' })
  await expect(pronto, '"Estou pronto" não ficou disponível na janela de teste').toBeEnabled({ timeout: ESPERA })
  await pronto.click()
  await expect(painel.getByText('Pronto · Diversão'), 'o Pronto clicado no Olhar deveria chegar ao painel do editor').toHaveCount(1, { timeout: ESPERA })

  // 4. Começar; o popup toca a demo e as setas vão pelo teclado do popup.
  await painel.getByRole('button', { name: 'Começar' }).click()
  await expect(painel.getByText('Dançando').first(), 'depois do Começar, o painel deveria mostrar o jogador de teste dançando').toBeVisible({ timeout: ESPERA })
  const espiaoDiz = () => popup.evaluate(() => JSON.stringify(window.__espiaoDoTeste?.tipos ?? 'sem espião'))
  await expect
    .poll(() => popup.evaluate(() => window.__espiaoDoTeste?.inicioMs ?? null), { message: 'o danca.comecar não chegou à janela de teste', timeout: ESPERA })
    .not.toBeNull()
    .catch(async (erro: unknown) => {
      throw new Error(`${String(erro)} | mensagens do host vistas no popup: ${await espiaoDiz()}`)
    })
  const lido = await popup.evaluate(() => window.__espiaoDoTeste ?? null)
  if (lido === null || lido.notas === null || lido.inicioMs === null) throw new Error('espião vazio depois do danca.comecar')
  const notas: { t: number; lane: number; len: number }[] = JSON.parse(lido.notas)
  expect(notas.length, 'a demo deveria ter setas para o jogador de teste').toBeGreaterThan(0)
  const toques = toquesDasNotas(notas, lido.inicioMs)
  const meio = toques[Math.floor(toques.length / 2)]
  if (meio === undefined) throw new Error('sem toques')
  // A foto da pista no meio da música: dispara junto com o teclado.
  const fotoDaPista = (async () => {
    await popup.evaluate((alvo) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, alvo - performance.now()))), meio.ms)
    await expect(barra, 'a barra do teste deveria continuar à vista durante a pista').toBeVisible()
    return foto(popup, '02-pista-tocando.png')
  })()
  const apertadas = await tocarNoPopup(popup, toques)
  await fotoDaPista
  expect(apertadas).toBe(notas.length)

  // 5. O desfecho: no popup, no painel do editor; a porta abre no teste e não no editor.
  const desfecho = dialogo.locator('.dz-desfecho')
  await expect(desfecho, 'o desfecho não chegou à janela de teste').not.toHaveAttribute('data-tom', 'espera', { timeout: ESPERA_DA_DEMO })
  await expect(desfecho).toHaveText(`${PREMIO} foi para a sua mochila.`)
  await expect(dialogo.getByRole('heading', { name: 'A porta se abriu' })).toBeVisible()
  const mesa = await dialogo.locator('.dz-mesa li').evaluateAll((linhas) => linhas.map((l) => Array.from(l.querySelectorAll('span'), (s) => (s.textContent ?? '').trim()).join(' | ')))
  expect(mesa.some((l) => /^Você \| (S|A|B) \|/.test(l)), `o jogador de teste deveria passar (S, A ou B). Mesa: ${mesa.join(' / ')}`).toBe(true)
  await expect(barra, 'a barra do teste deveria continuar à vista no resultado').toBeVisible()
  await foto(popup, '03-desfecho-no-popup.png')

  const textoDoPainel = (await painel.locator('.lb-danca__desfecho').textContent({ timeout: ESPERA })) ?? ''
  expect(textoDoPainel).toContain('Todos passaram')
  expect(textoDoPainel).toContain('A porta abriu.')
  await foto(mestre, '04-desfecho-no-editor.png')

  await dialogo.getByRole('button', { name: 'Voltar ao mapa' }).click()
  await expect(dialogo, '"Voltar ao mapa" não fechou a dança na janela de teste').toBeHidden({ timeout: ESPERA })
  await expect(espiar, 'a porta deveria estar aberta na janela de teste: "Espiar pela porta" some').toBeHidden({ timeout: ESPERA })
  expect(await portaNoEditor(mestre), 'o jogo de verdade não muda: a porta do EDITOR continua fechada e trancada').toEqual({ open: false, locked: true })
})

