// E2E do pedido "sons" (PEDIDOS.md, 30/09/2026: "tocar um sound effect ao
// pegar um item ou ir para um cenário, tipo resident evil"), fatia 2: QUANDO o
// jogador ouve.
//
// COMO PROVA: `player.html` inteiro no Chromium de verdade, com o Web Audio de
// verdade. O host é o próprio teste, pelo WebSocket roteado (como
// task-conceal-zone.spec.ts), mandando a entrada na ordem de `entryOutbound`
// (src/net/hostSession.ts): recorte, caderno, recado da cena, alarme. O que se
// observa é o áudio: cada oscilador e cada trecho de ruído que começa a tocar
// fica registrado por um `addInitScript`. Nada do app é trocado.
//
// O segundo teste mede, num OfflineAudioContext do Chromium, cada som no
// volume padrão contra o bipe de chamado que o mestre já ouve hoje
// (`lib/signalSound.ts`): o primeiro som que o jogador ouvir não pode assustar.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { addToken, addWall, createEmptyMap } from '../src/lib/mapFactory'
import type { MapData, RegionPoint } from '../src/types/map'

interface RegistroDeSom {
  /** Cada fonte que começou a tocar, na ordem: o tipo do oscilador, ou 'ruido'. */
  fontes: string[]
  /** Os contextos de áudio que a página criou. */
  contextos: BaseAudioContext[]
}

declare global {
  interface Window {
    __registroDeSom?: RegistroDeSom
  }
}

const CODIGO = 'SOM123'
const RECADO = { id: 'n1', text: 'Não acendam as velas.', at: 1_000 }
const ALARME = { id: 'a1', text: 'O sino tocou!' }
const NOVO_ALARME = { id: 'a2', text: 'Desabamento no salão!' }
/** `SILENCIO_DA_CHEGADA_MS` (src/player/sonsDoJogador.ts) mais folga. */
const DEPOIS_DO_SILENCIO_MS = 1_800
/**
 * Quanto abaixo do bipe de chamado (um alerta, feito para chamar atenção) o
 * som de clima mais alto tem de ficar no volume padrão: 6 dB é metade da
 * amplitude. Medido em 01/10/2026 no Chromium: a folga real era de ~12 dB.
 */
const FOLGA_ABAIXO_DO_BIPE_DB = 6

// As assinaturas são as receitas (src/lib/sons/receitas.ts), voz a voz, na ordem em que começam.
const AVISO = ['sawtooth', 'sawtooth', 'sine']
const DADO = ['ruido', 'sine', 'ruido', 'sine', 'ruido', 'sine', 'ruido', 'sine']
const PORTA_ABRE = ['ruido', 'sawtooth', 'sawtooth']
const ITEM = Array.from({ length: 8 }, () => 'sine')
const PASSAGEM = ['sawtooth', 'sawtooth', 'sine', 'ruido', 'sine']

const VISAO_TODA: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
    { x: 500, y: 500 },
    { x: 0, y: 500 },
  ],
]

function mapa(id: string, portaAberta: boolean): MapData {
  const comPorta = addWall(createEmptyMap(id, id, 10, 10, 50), {
    id: 'porta-1',
    x1: 250,
    y1: 100,
    x2: 250,
    y2: 150,
    blocksLight: !portaAberta,
    blocksMove: !portaAberta,
    door: { open: portaAberta, locked: false, kind: 'normal' },
  })
  return addToken(comPorta, { id: 'ficha-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null })
}

function snapshot(rev: number, map: MapData) {
  return { type: 'snapshot', rev, map, vision: VISAO_TODA, ownTokens: ['ficha-ana'], concealed: [] }
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

/** O host de mentira: responde ao `join` de cada conexão e manda o que o teste pedir. */
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

  /** O Wi-Fi do celular piscou: o host perde o socket. */
  derrubar(): void {
    if (this.socket === null) throw new Error('nenhum jogador conectado')
    void this.socket.close()
    this.socket = null
  }
}

/** A entrada como o host manda (`entryOutbound`): welcome, recorte, caderno, recado da cena, alarme que vale. */
async function entrada(page: Page, host: HostDeMentira, rev: number, alarme: { id: string; text: string }, entreMensagensMs = 0): Promise<void> {
  const mensagens: object[] = [
    { type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' },
    snapshot(rev, mapa('m1', false)),
    { type: 'notes.book', notes: [RECADO] },
    { type: 'scene.note', ...RECADO },
    { type: 'scene.alarm', ...alarme },
  ]
  for (const msg of mensagens) {
    host.mandar(msg)
    if (entreMensagensMs > 0) await page.waitForTimeout(entreMensagensMs)
  }
}

test('o jogador ouve a novidade, e a entrada e a volta da queda não tocam nada', async ({ page }) => {
  test.setTimeout(90_000)
  const host = new HostDeMentira()
  const erros: string[] = []
  page.on('pageerror', (erro) => erros.push(erro.message))
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

  // O "Entrar" veio antes dos sons existirem (eles nascem com a sessão). O primeiro gesto da sessão destrava.
  expect(await estadosDosContextos(page)).toEqual([])
  await page.mouse.click(5, 5)
  await expect.poll(() => estadosDosContextos(page), { message: 'o primeiro toque na sessão destrava o áudio' }).toEqual(['running'])

  // ENTRADA com o áudio já destravado: recado e alarme da cena chegam, e nada toca.
  await entrada(page, host, 1, ALARME)
  await expect(page.getByText(ALARME.text)).toBeVisible()
  await expect(page.getByText(RECADO.text)).toBeVisible()
  expect(await fontes(page), 'a entrada não pode tocar nada').toEqual([])

  // Passado o silêncio da chegada, o alarme NOVO toca o aviso.
  await page.waitForTimeout(DEPOIS_DO_SILENCIO_MS)
  host.mandar({ type: 'scene.alarm', ...NOVO_ALARME })
  await expect(page.getByText(NOVO_ALARME.text)).toBeVisible()
  await expect.poll(() => fontes(page)).toEqual(AVISO)

  // O jogador fecha o recado; o Wi-Fi pisca. A volta reabre o recado e reenvia o alarme que vale,
  // devagar (cada mensagem depois do silêncio da chegada): só o "já visto" segura.
  await page.getByRole('region', { name: 'Recado do mestre' }).getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByText(RECADO.text)).toBeHidden()
  host.derrubar()
  await expect.poll(() => host.entradas, { timeout: 10_000, message: 'a página volta sozinha' }).toBe(2)
  await entrada(page, host, 2, NOVO_ALARME, DEPOIS_DO_SILENCIO_MS)
  await expect(page.getByText(RECADO.text)).toBeVisible()
  // Controle: o dado rolado agora toca, e é a ÚNICA coisa que tocou desde o aviso.
  host.mandar({ type: 'dice.rolled', roll: { id: 'r1', from: 'Bia', count: 1, sides: 6, modifier: 0, results: [4], total: 4, at: 2_000 } })
  await expect.poll(() => fontes(page), { message: 'a volta da queda não pode tocar recado nem alarme de novo' }).toEqual([...AVISO, ...DADO])

  // No jogo: a porta à vista abre, o item é pego e a troca de cena toca a passagem (uma vez só).
  host.mandar(snapshot(3, mapa('m1', true)))
  await expect.poll(() => fontes(page)).toEqual([...AVISO, ...DADO, ...PORTA_ABRE])
  host.mandar({ type: 'pin.take.answer', answer: 'taken', nome: 'Chave de latão' })
  await expect.poll(() => fontes(page)).toEqual([...AVISO, ...DADO, ...PORTA_ABRE, ...ITEM])
  host.mandar({ type: 'scene.changed', by: 'master' })
  host.mandar(snapshot(4, mapa('m2', true)))
  host.mandar({ type: 'scene.alarm', id: 'a3', text: 'Fumaça no corredor' })
  await expect(page.getByText('Fumaça no corredor')).toBeVisible()
  await expect.poll(() => fontes(page), { message: 'a chegada toca só a passagem' }).toEqual([...AVISO, ...DADO, ...PORTA_ABRE, ...ITEM, ...PASSAGEM])
  await page.waitForTimeout(300)
  expect(await fontes(page)).toEqual([...AVISO, ...DADO, ...PORTA_ABRE, ...ITEM, ...PASSAGEM])
  expect(erros).toEqual([])
})

test('no volume padrão, todo som de clima fica bem abaixo do bipe de chamado que o mestre já ouve', async ({ page }) => {
  await page.goto('/player.html')
  const medidas = await page.evaluate(async () => {
    const { RECEITAS } = await import('/src/lib/sons/receitas.ts')
    const { tocarReceita } = await import('/src/lib/sons/sintetizador.ts')
    const { ABAFADOR_HZ } = await import('/src/lib/sons/contexto.ts')
    const { PREFERENCIA_DE_SOM_PADRAO } = await import('/src/stores/somStore.ts')
    const { createSignalSound } = await import('/src/lib/signalSound.ts')
    const TAXA = 48_000
    // Janela do volume "de ouvido": 50 ms, curta o bastante para pegar o baque e longa para não ser um pico solto.
    const JANELA = Math.round(TAXA * 0.05)
    const emDb = (valor: number) => Math.round(20 * Math.log10(valor) * 10) / 10
    function medir(amostras: Float32Array): { picoDb: number; rmsDb: number } {
      let pico = 0
      let soma = 0
      let maiorRms = 0
      for (let i = 0; i < amostras.length; i += 1) {
        pico = Math.max(pico, Math.abs(amostras[i]))
        soma += amostras[i] ** 2
        if (i >= JANELA) soma -= amostras[i - JANELA] ** 2
        if (i >= JANELA - 1) maiorRms = Math.max(maiorRms, Math.sqrt(Math.max(0, soma) / JANELA))
      }
      return { picoDb: emDb(pico), rmsDb: emDb(maiorRms) }
    }
    const sons: Record<string, { picoDb: number; rmsDb: number }> = {}
    for (const [id, vozes] of Object.entries(RECEITAS)) {
      // A mesma saída do app (lib/sons/contexto.ts): ganho mestre -> passa-baixa geral -> destination.
      const ctx = new OfflineAudioContext(1, TAXA * 2, TAXA)
      const mestre = ctx.createGain()
      const abafador = ctx.createBiquadFilter()
      abafador.type = 'lowpass'
      abafador.frequency.value = ABAFADOR_HZ
      mestre.connect(abafador)
      abafador.connect(ctx.destination)
      if (!tocarReceita<AudioNode>({ ctx, mestre }, vozes, PREFERENCIA_DE_SOM_PADRAO.volume)) throw new Error(`a receita ${id} não tocou`)
      sons[id] = medir((await ctx.startRendering()).getChannelData(0))
    }
    const ctxDoBipe = new OfflineAudioContext(1, TAXA, TAXA)
    if (!createSignalSound<AudioNode>(() => ctxDoBipe)()) throw new Error('o bipe não tocou')
    const bipe = medir((await ctxDoBipe.startRendering()).getChannelData(0))
    return { volume: PREFERENCIA_DE_SOM_PADRAO.volume, sons, bipe }
  })
  await test.info().attach('niveis-dos-sons.json', { body: JSON.stringify(medidas, null, 2), contentType: 'application/json' })
  expect(Object.keys(medidas.sons)).toHaveLength(7)
  for (const [id, { picoDb, rmsDb }] of Object.entries(medidas.sons)) {
    const contexto = `${id}: pico ${picoDb} dBFS, ${rmsDb} dBFS em 50 ms; bipe ${medidas.bipe.picoDb} / ${medidas.bipe.rmsDb}`
    expect(picoDb, contexto).toBeLessThan(medidas.bipe.picoDb - FOLGA_ABAIXO_DO_BIPE_DB)
    expect(rmsDb, contexto).toBeLessThan(medidas.bipe.rmsDb - FOLGA_ABAIXO_DO_BIPE_DB)
  }
})
