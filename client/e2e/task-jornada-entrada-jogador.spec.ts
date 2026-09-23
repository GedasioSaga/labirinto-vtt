// Jornadas da ENTRADA do jogador na sala — escritas para SAIR VERMELHAS no
// código de hoje. Dor medida em dois passeios cegos: o jogador entra com
// código e nome e fica parado em "Aguardando o mestre atribuir um personagem."
// (2 min 45 s num passeio, mais de 15 min no outro) numa tela sem mapa, sem
// botão, sem o nome com que ele entrou, sem o código da sala; o mestre não é
// avisado de que alguém chegou; código colado do chat com espaço (" GATDFB")
// perde a última letra; e entrar com o nome de outra pessoa é aceito calado.
//
// Lado do jogador: mesmo padrão de `task-player-page.spec.ts` — `routeWebSocket`
// com a sessão REAL do mestre (`src/net/hostSession.ts`), nada de estado
// injetado na página. Lado do mestre: o transporte Rust (`net_*`, `net:*`) é
// falsificado por cima do stub de Tauri já existente, e a tela do mestre é
// dirigida por clique de verdade.
//
// Asserção sempre no que APARECE na tela (texto visível, elemento acessível,
// canvas). `data-tokens-count`/`data-walls-count` são escritos pelo próprio
// componente a partir da entrada (PlayerView.tsx:429,570) e não provam render.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession, type HostSession, type Outbound } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'
import type { MapData } from '../src/types/map'

const CODE = 'GATDFB'
const GRID = 50

function mapaComTokenLivre(): MapData {
  const base = createEmptyMap('m-entrada', 'Entrada', 20, 12, GRID)
  return {
    ...base,
    floor: [{ id: 'f-chao', shape: { kind: 'rect', cx: 500, cy: 300, w: 980, h: 580 }, op: 'add', modifiers: {} }],
    // Token livre, sem dono: nada impede o jogador de já estar jogando.
    tokens: [{ id: 'tok-a', characterId: null, name: 'Heroi', x: 250, y: 300, size: 1, image: null }],
  }
}

interface MestreFalso {
  session: HostSession
}

/** Mestre de verdade (hostSession) atrás de um WebSocket falso, como em task-player-page. */
async function mestreFalso(page: Page, mapa: () => MapData, clientId: string): Promise<MestreFalso> {
  const session = createHostSession({
    code: CODE,
    visionRadius: 2000,
    randomId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  let socket: WebSocketRoute | null = null
  const despachar = (outbound: Outbound[]) => {
    for (const saida of outbound) {
      if (saida.clientId !== clientId || socket === null) continue
      socket.send(JSON.stringify(saida.msg))
    }
  }
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      socket = ws
      ws.onMessage((raw) => {
        const texto = typeof raw === 'string' ? raw : raw.toString('utf8')
        despachar(session.handleMessage(clientId, texto, mapa()).outbound)
      })
    },
  )
  return { session }
}

/**
 * Digita tecla a tecla, como o dedo do jogador. `fill` escreve o valor direto e
 * ATRAVESSA o `maxLength` do campo — o que esconderia justamente a dor 3.
 */
async function digitar(page: Page, rotulo: string, texto: string): Promise<void> {
  const campo = page.getByLabel(rotulo)
  await campo.click()
  await campo.pressSequentially(texto, { delay: 20 })
}

/** Só o texto RENDERIZADO da página (innerText ignora o que está escondido). */
async function textoNaTela(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
}

test('1. jogador entra em sala com token livre e a tela não lhe dá mapa, nem o nome com que entrou, nem o código da sala', async ({ page }) => {
  test.setTimeout(60_000)
  const mapa = mapaComTokenLivre()
  await mestreFalso(page, () => mapa, 'c1')

  await page.goto('/player.html')
  await digitar(page, 'Código da sala', CODE)
  await digitar(page, 'Seu nome', 'Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()

  // "Ter o que fazer" = ver o mapa (havia token livre, o mestre não precisava
  // decidir nada) OU, se o mestre decide mesmo, ler na tela QUEM ele é e ONDE
  // entrou. Hoje a tela só diz "Aguardando o mestre atribuir um personagem."
  const oQueApareceNaTela = async (): Promise<string> => {
    if (await page.locator('canvas').isVisible()) return 'mapa'
    const texto = await textoNaTela(page)
    return texto.includes('Ana') && texto.includes(CODE) ? 'nome e código na tela' : `nem mapa nem quem/onde — só isto: "${texto}"`
  }
  await expect
    .poll(oQueApareceNaTela, { timeout: 12_000, intervals: [500, 1000, 1000, 1000, 2000, 2000, 2000, 2000] })
    .toMatch(/^(mapa|nome e código na tela)$/)

  // Ter o que fazer inclui poder agir: a tela de espera precisa de pelo menos
  // um controle (sair, trocar de nome, avisar o mestre).
  await expect(page.getByRole('button')).not.toHaveCount(0)
})

/** Transporte do mestre (comandos `net_*` e eventos `net:*`) falsificado sobre o stub de Tauri. */
type EventoTauri = { event: string; id: number; payload: unknown }
type HandlerTauri = (evento: EventoTauri) => void
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __netSent: unknown[]
  __TAURI_INTERNALS__: {
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: (cb: HandlerTauri) => number
  }
}

async function mestreNoTauri(page: Page): Promise<void> {
  await installTauriFsStub(page)
  await page.addInitScript((codigo: string) => {
    const alvo = window as unknown as JanelaDoMestre
    const internals = alvo.__TAURI_INTERNALS__
    const base = internals.invoke.bind(internals)
    const callbacks = new Map<number, HandlerTauri>()
    const ouvintes = new Map<number, { event: string; handler: HandlerTauri }>()
    const enviadas: unknown[] = []
    let proximoId = 1
    alvo.isTauri = true // sem isto o App fica no modo navegador, sem as abas Mapa | Jogo
    alvo.__netSent = enviadas
    alvo.__emitTauri = (event, payload) => {
      for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
    }
    internals.transformCallback = (cb: HandlerTauri) => {
      const id = proximoId
      proximoId += 1
      callbacks.set(id, cb)
      return id
    }
    internals.invoke = async (cmd, args, options) => {
      const a = (args ?? {}) as Record<string, unknown>
      switch (cmd) {
        case 'net_start_room':
          return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
        case 'net_send':
          enviadas.push(a)
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
        default:
          return base(cmd, args, options)
      }
    }
  }, CODE)
}

test('2. jogador entra sem token e o mestre não fica sabendo que alguém está esperando nem atribui em um clique', async ({ page }) => {
  test.setTimeout(120_000)
  await mestreNoTauri(page)
  await enterEditor(page)

  // Token no mapa do mestre pelo gesto que existe na tela: "Adicionar token"
  // no painel Seleção, com o nome digitado (SelectionControls.tsx).
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  await page.getByLabel('Nome do novo token').fill('Heroi')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  // Token criado e selecionado: o painel Seleção passa a oferecer apagá-lo.
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()

  await page.getByRole('tab', { name: 'Jogo' }).click()
  await page.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(page.getByText(CODE)).toBeVisible()
  // O mestre volta para o mapa: é onde ele fica na mesa de verdade enquanto espera.
  await page.getByRole('tab', { name: 'Mapa' }).click()

  // Ana entra pelo celular. Isso chega ao mestre pelo transporte (conexão nova
  // + join), não por gesto na tela dele.
  await page.evaluate((codigo: string) => {
    const alvo = window as unknown as JanelaDoMestre
    alvo.__emitTauri('net:peer', { clientId: '7', event: 'connected', name: 'Ana' })
    alvo.__emitTauri('net:message', { clientId: '7', msg: { type: 'join', code: codigo, name: 'Ana' } })
  }, CODE)

  // Gate de encanamento (passa hoje): o join chegou de verdade à ponte do
  // mestre — o painel Jogo, escondido na aba inativa, já lista Ana.
  await expect(page.locator('#lb-rail-panel-room')).toContainText('Ana', { timeout: 5000 })

  // A dor: nada disso chega ao olho do mestre, que está no mapa. A tela dele
  // tem de dizer que Ana chegou e está esperando, sem ele ir conferir.
  await expect.poll(() => textoNaTela(page), { timeout: 8000, intervals: [500, 1000, 1000, 1000, 2000, 2000] }).toMatch(/Ana/)

  // E atribuir um personagem tem de caber em UM clique.
  await page.getByRole('tab', { name: 'Jogo' }).click()
  await page.getByRole('button', { name: /Heroi/ }).click({ timeout: 5000 })
  await expect.poll(() => textoNaTela(page), { timeout: 5000 }).toMatch(/Ana[^]*jogando/)
})

test('3a. código colado do chat com espaço na frente (" GATDFB") perde a última letra e o Entrar nem liga', async ({ page }) => {
  test.setTimeout(60_000)
  const mapa = mapaComTokenLivre()
  await mestreFalso(page, () => mapa, 'c1')

  await page.goto('/player.html')
  await digitar(page, 'Código da sala', ` ${CODE}`)
  await digitar(page, 'Seu nome', 'Ana')

  const entrar = page.getByRole('button', { name: 'Entrar' })
  await expect(entrar, 'o campo para em 6 caracteres contando o espaço: " GATDFB" vira " GATDF" e o Entrar fica desligado').toBeEnabled({ timeout: 4000 })
  await entrar.click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 8000 })
})

test('3b. código digitado com espaço no meio ("gat dfb") é mandado como está e o mestre recusa em vez de entrar', async ({ page }) => {
  test.setTimeout(60_000)
  const mapa = mapaComTokenLivre()
  await mestreFalso(page, () => mapa, 'c1')

  await page.goto('/player.html')
  await digitar(page, 'Código da sala', 'gat dfb')
  await digitar(page, 'Seu nome', 'Ana')

  const entrar = page.getByRole('button', { name: 'Entrar' })
  await expect(entrar, 'espaço no meio do código deveria ser ignorado').toBeEnabled({ timeout: 4000 })
  await entrar.click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 8000 })
})

test('4. entrar com um nome que já está na sala é aceito calado: a tela do segundo jogador não sinaliza nada', async ({ page }) => {
  test.setTimeout(60_000)
  const mapa = mapaComTokenLivre()
  const mestre = await mestreFalso(page, () => mapa, 'c2')
  // A primeira Ana já está na sala, de outra máquina: entra pelo transporte do
  // mestre, não pela tela que este teste dirige.
  mestre.session.handleMessage('c1', JSON.stringify({ type: 'join', code: CODE, name: 'Ana' }), mapa)

  await page.goto('/player.html')
  await digitar(page, 'Código da sala', CODE)
  await digitar(page, 'Seu nome', 'Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre|Conectando/, { timeout: 8000 })

  // O mestre já renomeia por dentro para "Ana (2)" (hostSession.uniqueName),
  // mas nunca conta ao jogador: na tela dele nada diz que o nome era de outro.
  await expect
    .poll(() => textoNaTela(page), { timeout: 8000, intervals: [500, 1000, 1000, 1000, 2000, 2000] })
    .toMatch(/Ana \(2\)|j[áa] (est[áa]|existe)|em uso|outro jogador|nome repetido|escolha outro nome/i)
})
