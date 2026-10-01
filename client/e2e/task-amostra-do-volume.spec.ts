// E2E das sobras dos sons (commits 65f1a1b2, 68bce4bc, d42e9f0b, 574003dc):
// a amostra da barra de volume e o bipe no 0%.
//
// COMO PROVA: a página do jogador no Chromium de verdade, com o host feito pelo
// próprio teste no WebSocket roteado (como task-controle-de-som.spec.ts). O
// áudio é o Web Audio de verdade, só registrado: cada oscilador que começa.
//   - A amostra fica fora do intervalo mínimo do item (600 ms): cinco toques
//     na seta tocam cinco sinos, e o item pego logo depois toca também.
//   - A seta SEGURADA (a repetição do teclado) toca no primeiro passo e ao
//     soltar, sem rajada no meio.
//   - A barra no 0% cala o bipe do "Chamar o mestre" (`playSignalSound`), e 1%
//     já o devolve. O bipe é chamado pelo mesmo módulo que o app carrega.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { addToken, createEmptyMap } from '../src/lib/mapFactory'
import type { MapData, RegionPoint } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

interface RegistroDaAmostra {
  /** Cada fonte que começou a tocar, na ordem: o tipo do oscilador, ou 'ruido'. */
  fontes: string[]
  contextos: BaseAudioContext[]
}

declare global {
  interface Window {
    __registroDaAmostra?: RegistroDaAmostra
  }
}

/** A assinatura do sino de "item obtido" (src/lib/sons/receitas.ts): 2 notas × 4 parciais senoidais. */
const SINO = Array.from({ length: 8 }, () => 'sine')
/** O bipe de chamado (src/lib/signalSound.ts): um oscilador senoidal. */
const BIPE = ['sine']
/** Passado o silêncio da chegada (SILENCIO_DA_CHEGADA_MS, src/player/sonsDoJogador.ts: 1,5 s), o item toca. */
const DEPOIS_DO_SILENCIO_MS = 1_800

function sinos(quantos: number): string[] {
  return Array.from({ length: quantos }, () => SINO).flat()
}

const VISAO_TODA: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ],
]

function mapaDoJogador(): MapData {
  return addToken(createEmptyMap('m1', 'Salão', 20, 20, 50), { id: 'ficha-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null })
}

/** Roda NA PÁGINA, antes de qualquer script dela: registra o áudio que começa a tocar. */
function instrumentarWebAudio(): void {
  const registro: RegistroDaAmostra = { fontes: [], contextos: [] }
  window.__registroDaAmostra = registro
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
    const registro = window.__registroDaAmostra
    if (registro === undefined) throw new Error('o registro de som não foi instalado')
    return [...registro.fontes]
  })
}

async function estadosDosContextos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const registro = window.__registroDaAmostra
    if (registro === undefined) throw new Error('o registro de som não foi instalado')
    return registro.contextos.map((ctx) => ctx.state)
  })
}

/** O bipe do chamado (`playSignalSound`), pelo mesmo módulo que o app carrega: mesma preferência, mesmo áudio. */
async function bipar(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const { playSignalSound } = await import('/src/lib/signalSound.ts')
    return playSignalSound()
  })
}

/** O host de mentira: responde ao `join` com a sessão e o recorte, e manda o que o teste pedir. */
class HostDeMentira {
  private socket: WebSocketRoute | null = null

  ligar(ws: WebSocketRoute): void {
    this.socket = ws
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      this.mandar({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' })
      this.mandar({ type: 'snapshot', rev: 1, map: mapaDoJogador(), vision: VISAO_TODA, ownTokens: ['ficha-ana'], concealed: [] })
    })
  }

  mandar(msg: object): void {
    if (this.socket === null) throw new Error('nenhum jogador conectado')
    this.socket.send(JSON.stringify(msg))
  }
}

/** Entra no jogo e abre o "Som da mesa": o toque no alto-falante é o gesto que destrava o áudio. */
async function entrarEAbrirOSom(page: Page): Promise<HostDeMentira> {
  await page.addInitScript(instrumentarWebAudio)
  const host = new HostDeMentira()
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => host.ligar(ws),
  )
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill('SOM123')
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
  await page.waitForTimeout(DEPOIS_DO_SILENCIO_MS)
  await page.getByRole('button', { name: 'Som', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Som da mesa' }).getByRole('slider', { name: 'Volume' })).toBeFocused()
  await expect.poll(() => estadosDosContextos(page), { message: 'o toque no alto-falante destrava o áudio' }).toEqual(['running'])
  expect(await fontes(page), 'abrir o controle não toca nada').toEqual([])
  return host
}

test('cinco setas tocam cinco amostras e o item pego logo depois toca; a seta segurada não vira rajada', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', (erro) => erros.push(erro.message))
  const host = await entrarEAbrirOSom(page)
  const barra = page.getByRole('dialog', { name: 'Som da mesa' }).getByRole('slider', { name: 'Volume' })

  // Cinco toques na seta e o item pego em seguida: tudo bem dentro dos 600 ms do intervalo do item.
  for (let toque = 0; toque < 5; toque += 1) await page.keyboard.press('ArrowRight')
  host.mandar({ type: 'pin.take.answer', answer: 'taken', nome: 'Chave de latão' })
  await expect(barra).toHaveValue('40')
  await expect.poll(() => fontes(page), { message: 'cinco amostras e o item de verdade' }).toEqual(sinos(6))

  // Segurada: o primeiro passo toca; a repetição (keydown com repeat) anda o valor em silêncio.
  await page.keyboard.down('ArrowRight')
  await expect.poll(() => fontes(page), { message: 'o primeiro passo da seta segurada toca' }).toEqual(sinos(7))
  for (let repeticao = 0; repeticao < 5; repeticao += 1) await page.keyboard.down('ArrowRight')
  await expect(barra).toHaveValue('46')
  await page.waitForTimeout(300)
  expect(await fontes(page), 'a repetição do teclado não toca a cada passo').toEqual(sinos(7))
  // Soltar a tecla toca de novo, no volume final.
  await page.keyboard.up('ArrowRight')
  await expect.poll(() => fontes(page), { message: 'soltar a seta toca a amostra' }).toEqual(sinos(8))
  expect(erros).toEqual([])
})

test('a barra no 0% cala o bipe do chamado; 1% já o devolve', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', (erro) => erros.push(erro.message))
  await entrarEAbrirOSom(page)
  const som = page.getByRole('button', { name: 'Som', exact: true })
  const barra = page.getByRole('dialog', { name: 'Som da mesa' }).getByRole('slider', { name: 'Volume' })

  // Home leva a barra ao 0%: o alto-falante corta, a amostra cala e o bipe também.
  await page.keyboard.press('Home')
  await expect(barra).toHaveValue('0')
  await expect(som).toHaveAttribute('data-estado', 'mudo')
  expect(await bipar(page), 'no 0% o chamado não bipa').toBe(false)
  await page.waitForTimeout(300)
  expect(await fontes(page)).toEqual([])

  // Um passo acima: a amostra toca e o chamado volta a bipar, no mesmo áudio do app.
  await page.keyboard.press('ArrowRight')
  await expect(barra).toHaveValue('1')
  await expect(som).toHaveAttribute('data-estado', 'ligado')
  await expect.poll(() => fontes(page), { message: 'no 1% a amostra toca' }).toEqual(SINO)
  expect(await bipar(page), 'no 1% o chamado bipa').toBe(true)
  await expect.poll(() => fontes(page)).toEqual([...SINO, ...BIPE])
  expect(await estadosDosContextos(page), 'o bipe toca no contexto dos sons: nenhum AudioContext a mais').toEqual(['running'])
  expect(erros).toEqual([])
})
