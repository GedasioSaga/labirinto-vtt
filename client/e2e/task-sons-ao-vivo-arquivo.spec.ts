// E2E dos SONS AO VIVO, fatia F5b (contrato em
// docs/planos/sons-f5-plano-tecnico-2026-10-23.md, seções 2 e 3): o jogador e
// a tela da mesa tocam o som que o mestre manda, trazendo o arquivo de
// `/sons/<id>` com a chave da conexão.
//
// COMO PROVA: `player.html` inteiro no Chromium de verdade, com o Web Audio de
// verdade. O host é o próprio teste, pelo WebSocket roteado (como
// task-sons-do-jogador.spec.ts), e o servidor de mídia da sala (a F5a, em
// Rust, ainda não existe) é um `page.route('/sons/*')` que exige o cabeçalho
// X-Labirinto-Chave e devolve o MESMO 404 sem ele. O que se observa é o áudio:
// cada trecho decodificado que começa a tocar (duração e ponto de início) e
// cada um que para fica registrado por um `addInitScript`. Nada do app é trocado.
//
// NÃO selado: nasce na F5b e fica fora do portão até o auditor passar.
import { test, expect, type Page, type Route, type WebSocketRoute } from '@playwright/test'
import { addToken, createEmptyMap } from '../src/lib/mapFactory'
import type { MapData, RegionPoint } from '../src/types/map'

interface Toque {
  duracaoS: number
  inicioS: number
  loop: boolean
}

interface RegistroAoVivo {
  toques: Toque[]
  paradas: number
  contextos: BaseAudioContext[]
}

declare global {
  interface Window {
    __aoVivo?: RegistroAoVivo
  }
}

const CODIGO = 'SOM123'
const CHAVE = 'ab'.repeat(32)
const ID_CHUVA = `${'a'.repeat(64)}.wav`
const ID_GRITO = `${'b'.repeat(64)}.wav`
/** O arquivo servido: 10 s de silêncio em WAV (8 kHz, 8 bits, mono), 80 KB, decodificado pelo motor (até 1 MB). */
const DURACAO_S = 10
/** O loop já tocava havia 3 s na mesa quando o jogador chegou. */
const JA_TOCAVA_S = 3
/** Quanto o loop espera o toque na faixinha: o início dele anda junto. */
const ESPERA_ANTES_DO_TOQUE_MS = 1_500
const PASTA_DE_PROVAS = process.env.LAB_PROVAS ?? 'test-results/provas-sons-ao-vivo'

const VISAO_TODA: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
    { x: 500, y: 500 },
    { x: 0, y: 500 },
  ],
]

/** Os bytes do WAV mudo em base64 (o e2e não tem os tipos do Node; o `Buffer.from` de base64 é o que os outros specs usam). */
function wavMudoEmBase64(segundos: number): string {
  const taxa = 8_000
  const amostras = taxa * segundos
  const bytes = new Uint8Array(44 + amostras).fill(0x80)
  const vista = new DataView(bytes.buffer)
  const texto = (pos: number, valor: string) => [...valor].forEach((letra, i) => vista.setUint8(pos + i, letra.charCodeAt(0)))
  texto(0, 'RIFF')
  vista.setUint32(4, 36 + amostras, true)
  texto(8, 'WAVE')
  texto(12, 'fmt ')
  vista.setUint32(16, 16, true)
  vista.setUint16(20, 1, true)
  vista.setUint16(22, 1, true)
  vista.setUint32(24, taxa, true)
  vista.setUint32(28, taxa, true)
  vista.setUint16(32, 1, true)
  vista.setUint16(34, 8, true)
  texto(36, 'data')
  vista.setUint32(40, amostras, true)
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario)
}

const ARQUIVO_B64 = wavMudoEmBase64(DURACAO_S)
const ARQUIVO_BYTES = 44 + 8_000 * DURACAO_S

function mapa(ownTokens: boolean): MapData {
  const vazio = createEmptyMap('m1', 'Cais', 10, 10, 50)
  return ownTokens ? addToken(vazio, { id: 'ficha-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null }) : vazio
}

/** Roda NA PÁGINA, antes de qualquer script dela: registra o áudio decodificado que começa e que para. */
function instrumentarWebAudio(): void {
  const registro: RegistroAoVivo = { toques: [], paradas: 0, contextos: [] }
  window.__aoVivo = registro
  const ContextoOriginal = window.AudioContext
  window.AudioContext = class extends ContextoOriginal {
    constructor(opcoes?: AudioContextOptions) {
      super(opcoes)
      registro.contextos.push(this)
    }
  }
  const comecar = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
    // O buffer de 1 amostra é o destravamento do iOS (lib/sons/contexto.ts), não um som.
    if (this.buffer !== null && this.buffer.length > 1) registro.toques.push({ duracaoS: this.buffer.duration, inicioS: args[1] ?? 0, loop: this.loop })
    comecar.apply(this, args)
  }
  const parar = AudioBufferSourceNode.prototype.stop
  AudioBufferSourceNode.prototype.stop = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['stop']>) {
    if (this.buffer !== null && this.buffer.length > 1) registro.paradas += 1
    parar.apply(this, args)
  }
}

async function registro(page: Page): Promise<RegistroAoVivo> {
  return page.evaluate(() => {
    const atual = window.__aoVivo
    if (atual === undefined) throw new Error('o registro do áudio não foi instalado')
    return { toques: [...atual.toques], paradas: atual.paradas, contextos: [] }
  })
}

/** O servidor de mídia da sala: só com a chave da conexão; sem ela, o mesmo 404 de um arquivo que não existe. */
class MidiaDeMentira {
  buscas = new Map<string, number>()
  semChave = 0

  async atender(route: Route): Promise<void> {
    const url = new URL(route.request().url())
    const id = url.pathname.slice('/sons/'.length)
    if (route.request().headers()['x-labirinto-chave'] !== CHAVE) {
      this.semChave += 1
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'nao encontrado' })
      return
    }
    this.buscas.set(id, (this.buscas.get(id) ?? 0) + 1)
    if (id !== ID_CHUVA && id !== ID_GRITO) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'nao encontrado' })
      return
    }
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(ARQUIVO_BYTES) }, body: Buffer.from(ARQUIVO_B64, 'base64') })
  }
}

class HostDeMentira {
  private socket: WebSocketRoute | null = null
  entradas = 0
  falhas: unknown[] = []

  ligar(ws: WebSocketRoute): void {
    this.socket = ws
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg)) return
      if (msg.type === 'join') this.entradas += 1
      if (msg.type === 'som.falhou') this.falhas.push(msg)
    })
  }

  mandar(msg: object): void {
    if (this.socket === null) throw new Error('ninguém conectado')
    this.socket.send(JSON.stringify(msg))
  }
}

async function preparar(page: Page, largura: number, altura: number) {
  const host = new HostDeMentira()
  const midia = new MidiaDeMentira()
  const erros: string[] = []
  page.on('pageerror', (erro) => erros.push(erro.message))
  await page.setViewportSize({ width: largura, height: altura })
  await page.addInitScript(instrumentarWebAudio)
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => host.ligar(ws),
  )
  await page.route('**/sons/*', (route) => midia.atender(route))
  return { host, midia, erros }
}

const tocarLoop = (instancia: string, midia: string, deslocamentoS?: number) => ({
  type: 'som.tocar',
  instancia,
  fonte: { tipo: 'arquivo', midia },
  volume: 0.5,
  loop: true,
  ...(deslocamentoS === undefined ? {} : { deslocamentoS }),
})

test('jogador: nada toca antes do toque, a faixinha destrava, o loop entra no ponto certo, 1 busca para 2 toques, e a sala fechada para tudo', async ({ page }) => {
  test.setTimeout(60_000)
  const { host, midia, erros } = await preparar(page, 390, 844)
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODIGO)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect.poll(() => host.entradas).toBe(1)
  host.mandar({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' })
  host.mandar({ type: 'snapshot', rev: 1, map: mapa(true), vision: VISAO_TODA, ownTokens: ['ficha-ana'], concealed: [] })
  host.mandar({ type: 'midia.chave', chave: CHAVE })

  // Pré-carga antes de qualquer toque: o arquivo desce uma vez, com a chave.
  host.mandar({ type: 'som.precarregar', midias: [ID_GRITO] })
  await expect.poll(() => midia.buscas.get(ID_GRITO) ?? 0, { message: 'a pré-carga traz o grito' }).toBe(1)

  // O loop que já tocava há 3 s chega antes do gesto: espera, sem tocar, e a faixinha aparece.
  host.mandar(tocarLoop('i-chuva', ID_CHUVA, JA_TOCAVA_S))
  const faixa = page.getByRole('button', { name: 'Toque para ouvir' })
  await expect(faixa).toBeVisible()
  await expect.poll(() => midia.buscas.get(ID_CHUVA) ?? 0).toBe(1)
  expect((await registro(page)).toques, 'nada toca antes do toque').toEqual([])
  await page.waitForTimeout(ESPERA_ANTES_DO_TOQUE_MS)
  await page.screenshot({ path: `${PASTA_DE_PROVAS}/faixinha-jogador-390.png` })

  await faixa.click()
  await expect(faixa).toBeHidden()
  await expect.poll(async () => (await registro(page)).toques.length, { message: 'o toque destrava e a chuva começa' }).toBe(1)
  const [chuva] = (await registro(page)).toques
  expect(chuva?.loop).toBe(true)
  expect(chuva?.duracaoS).toBeCloseTo(DURACAO_S, 1)
  // Começa onde a mesa está: os 3 s de antes mais a espera pelo toque (com folga para o lento da máquina).
  expect(chuva?.inicioS ?? 0).toBeGreaterThan(JA_TOCAVA_S + ESPERA_ANTES_DO_TOQUE_MS / 1000 - 0.2)
  expect(chuva?.inicioS ?? 0).toBeLessThan(DURACAO_S)

  // Dois toques do mesmo grito: os dois soam, e o arquivo já veio na pré-carga (nenhuma busca nova).
  host.mandar({ type: 'som.tocar', instancia: 'i-grito-1', fonte: { tipo: 'arquivo', midia: ID_GRITO }, volume: 0.8, loop: false })
  host.mandar({ type: 'som.tocar', instancia: 'i-grito-2', fonte: { tipo: 'arquivo', midia: ID_GRITO }, volume: 0.8, loop: false })
  await expect.poll(async () => (await registro(page)).toques.length).toBe(3)
  expect(midia.buscas.get(ID_GRITO)).toBe(1)
  expect(midia.semChave, 'toda busca leva a chave da conexão').toBe(0)

  // A sala fecha: tudo o que soa para.
  const paradasAntes = (await registro(page)).paradas
  host.mandar({ type: 'room.closed' })
  await expect.poll(async () => (await registro(page)).paradas - paradasAntes, { message: 'room.closed para a chuva e os gritos' }).toBeGreaterThanOrEqual(3)
  expect(host.falhas).toEqual([])
  expect(erros).toEqual([])
})

test('tela da mesa: a TV também toca, com a faixinha no 1280', async ({ page }) => {
  test.setTimeout(60_000)
  const { host, midia, erros } = await preparar(page, 1280, 800)
  await page.goto(`/player.html?mesa=${CODIGO}&chave=chave-da-tv`)
  await expect.poll(() => host.entradas).toBe(1)
  host.mandar({ type: 'welcome', playerId: 'p-tv', resumeToken: 'tok-tv', name: 'Tela da mesa' })
  host.mandar({ type: 'snapshot', rev: 1, map: mapa(false), vision: VISAO_TODA, ownTokens: [], concealed: [] })
  host.mandar({ type: 'midia.chave', chave: CHAVE })
  host.mandar(tocarLoop('i-chuva', ID_CHUVA))
  const faixa = page.getByRole('button', { name: 'Toque para ouvir' })
  await expect(faixa).toBeVisible()
  await expect.poll(() => midia.buscas.get(ID_CHUVA) ?? 0).toBe(1)
  expect((await registro(page)).toques).toEqual([])
  await page.screenshot({ path: `${PASTA_DE_PROVAS}/faixinha-tv-1280.png` })
  await faixa.click()
  await expect(faixa).toBeHidden()
  await expect.poll(async () => (await registro(page)).toques.length, { message: 'a TV toca depois do toque' }).toBe(1)
  expect(erros).toEqual([])
})
