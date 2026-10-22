// E2E do som da porta animada na tela do JOGADOR (fatia 22, correção da
// revisão de 22/10/2026). Quem toca o som da animação é o animador do mapa
// (`pixi/animadorDePortas.ts`), e ele só vê o desenho de antes e o de agora.
// Na tela do jogador a porta fora da visão chega com o estado LEMBRADO
// (`lib/fogFilter.ts`): quando ela volta à vista com outro estado, o desenho
// troca sem ninguém ter mexido nela, e isso não pode soar.
//
// COMO PROVA: `player.html` no Chromium, Web Audio de verdade, o host é o
// teste pelo WebSocket roteado (molde de task-sons-do-jogador.spec.ts). Cada
// fonte de som que começa a tocar fica registrada por um `addInitScript`.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createExploration, encodeExploration, markAll } from '../src/lib/exploration'
import { addToken, addWall, createEmptyMap } from '../src/lib/mapFactory'
import type { MapData, RegionPoint } from '../src/types/map'

interface RegistroDeSom {
  /** Cada fonte que começou a tocar, na ordem: o tipo do oscilador, ou 'ruido'. */
  fontes: string[]
  contextos: BaseAudioContext[]
}

declare global {
  interface Window {
    __registroDeSom?: RegistroDeSom
  }
}

const CODIGO = 'PORTA1'
/** `SILENCIO_DA_CHEGADA_MS` (src/player/sonsDoJogador.ts) mais folga. */
const DEPOIS_DO_SILENCIO_MS = 1_800
/** O caminho de "Girar" (300 ms) e o intervalo mínimo da porta (250 ms), com folga: o próximo toque não é cortado. */
const DEPOIS_DO_CAMINHO_MS = 600

// As assinaturas, voz a voz, na ordem em que começam: `agendarSomDePorta` (src/portas/somDePorta.ts) e a receita de clima.
/** Abrir "Girar": o trinco solta (estalo, anel, estalo) e a dobradiça range. */
const GIRAR_ABRE = ['ruido', 'triangle', 'ruido', 'sawtooth']
/** O rangido de clima (src/lib/sons/receitas.ts, `portaAbre`). */
const PORTA_ABRE_DE_CLIMA = ['ruido', 'sawtooth', 'sawtooth']

const MAPA_LADO = 500
/** Visão que cobre o mapa inteiro: a porta está à vista. */
const VISAO_TODA: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: MAPA_LADO, y: 0 },
    { x: MAPA_LADO, y: MAPA_LADO },
    { x: 0, y: MAPA_LADO },
  ],
]
/** Só em volta da ficha (125, 125): a porta (x = 250) fica fora, na lembrança. */
const VISAO_DA_FICHA: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 },
    { x: 0, y: 200 },
  ],
]

function mapa(portaAberta: boolean): MapData {
  const comPorta = addWall(createEmptyMap('m1', 'm1', 10, 10, 50), {
    id: 'porta-1',
    x1: 250,
    y1: 100,
    x2: 250,
    y2: 150,
    blocksLight: !portaAberta,
    blocksMove: !portaAberta,
    door: { open: portaAberta, locked: false, kind: 'normal', animacao: 'girar' },
  })
  return addToken(comPorta, { id: 'ficha-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null })
}

/** O mapa todo explorado: a porta fora da visão continua desenhada (`playerCulling.ts`), com o estado lembrado. */
function exploradoTodo(map: MapData) {
  const explorado = createExploration(map)
  markAll(explorado)
  return encodeExploration(explorado)
}

function snapshot(rev: number, portaAberta: boolean, vision: RegionPoint[][]) {
  const map = mapa(portaAberta)
  return { type: 'snapshot', rev, map, vision, explored: exploradoTodo(map), ownTokens: ['ficha-ana'], concealed: [] }
}

/** Roda NA PÁGINA, antes de qualquer script dela: registra o áudio que começa a tocar. */
function instrumentarWebAudio(): void {
  const registro: RegistroDeSom = { fontes: [], contextos: [] }
  window.__registroDeSom = registro
  const ContextoOriginal = window.AudioContext
  window.AudioContext = class extends ContextoOriginal {
    constructor(opcoes?: AudioContextOptions) {
      super(opcoes)
      registro.contextos.push(this)
    }
  }
  const tocarOscilador = OscillatorNode.prototype.start
  OscillatorNode.prototype.start = function (this: OscillatorNode, ...args: Parameters<OscillatorNode['start']>) {
    registro.fontes.push(this.type)
    tocarOscilador.apply(this, args)
  }
  const tocarBuffer = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
    // O buffer de 1 amostra é o destravamento do iOS (lib/sons/contexto.ts), não um som.
    if (this.buffer === null || this.buffer.length > 1) registro.fontes.push('ruido')
    tocarBuffer.apply(this, args)
  }
}

async function fontes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const registro = window.__registroDeSom
    if (registro === undefined) throw new Error('o registro de som não foi instalado')
    return [...registro.fontes]
  })
}

async function estadosDosContextos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const registro = window.__registroDeSom
    if (registro === undefined) throw new Error('o registro de som não foi instalado')
    return registro.contextos.map((ctx) => ctx.state)
  })
}

/** O host de mentira: conta os `join` e manda o que o teste pedir. */
class HostDeMentira {
  private socket: WebSocketRoute | null = null
  entradas = 0

  ligar(ws: WebSocketRoute): void {
    this.socket = ws
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'join') this.entradas += 1
    })
  }

  mandar(msg: object): void {
    if (this.socket === null) throw new Error('nenhum jogador conectado')
    this.socket.send(JSON.stringify(msg))
  }
}

/** Entra na sala, destrava o áudio com o primeiro toque e espera o silêncio da chegada: daqui em diante, só novidade toca. */
async function entrarComAPorta(page: Page, host: HostDeMentira, portaAberta: boolean): Promise<void> {
  await page.addInitScript(instrumentarWebAudio)
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => host.ligar(ws),
  )
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODIGO)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect.poll(() => host.entradas).toBe(1)
  await page.mouse.click(5, 5)
  await expect.poll(() => estadosDosContextos(page), { message: 'o primeiro toque na sessão destrava o áudio' }).toEqual(['running'])
  host.mandar({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' })
  host.mandar(snapshot(1, portaAberta, VISAO_TODA))
  await expect(page.locator('canvas').first()).toBeVisible()
  await page.waitForTimeout(DEPOIS_DO_SILENCIO_MS)
  expect(await fontes(page), 'a entrada não toca nada').toEqual([])
}

test('porta animada: soa quando mexem nela à vista, e fica muda quando só volta à vista com outro estado', async ({ page }) => {
  test.setTimeout(60_000)
  const host = new HostDeMentira()
  const erros: string[] = []
  page.on('pageerror', (erro) => erros.push(erro.message))
  await entrarComAPorta(page, host, true)

  // Ana sai dali: a porta segue no recorte com o estado lembrado (aberta). Nada muda, nada toca.
  host.mandar(snapshot(2, true, VISAO_DA_FICHA))
  await page.waitForTimeout(DEPOIS_DO_CAMINHO_MS)
  // O mestre fechou a porta longe dela. Ana volta a ver a porta: ela chega FECHADA, sem ninguém mexer agora.
  host.mandar(snapshot(3, false, VISAO_TODA))
  await page.waitForTimeout(DEPOIS_DO_CAMINHO_MS)
  expect(await fontes(page), 'a porta que só voltou à vista com outro estado não range').toEqual([])

  // Controle: alguém abre a porta à vista dela. Toca o som da animação, uma vez, e não o rangido de clima por cima.
  host.mandar(snapshot(4, true, VISAO_TODA))
  await expect.poll(() => fontes(page), { message: 'a porta mexida à vista soa' }).toEqual(GIRAR_ABRE)
  await page.waitForTimeout(DEPOIS_DO_CAMINHO_MS)
  expect(await fontes(page), 'uma vez só, sem o de clima por cima').toEqual(GIRAR_ABRE)
  expect(erros).toEqual([])
})

test('movimento reduzido: a porta animada troca na hora, sem o som do caminho, e o rangido de clima toca', async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const host = new HostDeMentira()
  const erros: string[] = []
  page.on('pageerror', (erro) => erros.push(erro.message))
  await entrarComAPorta(page, host, false)

  host.mandar(snapshot(2, true, VISAO_TODA))
  await expect.poll(() => fontes(page), { message: 'quem prefere menos movimento ainda ouve a porta' }).toEqual(PORTA_ABRE_DE_CLIMA)
  await page.waitForTimeout(DEPOIS_DO_CAMINHO_MS)
  expect(await fontes(page), 'um som só').toEqual(PORTA_ABRE_DE_CLIMA)
  expect(erros).toEqual([])
})
