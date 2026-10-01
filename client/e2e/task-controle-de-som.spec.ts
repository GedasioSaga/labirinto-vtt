// E2E do pedido "sons" (PEDIDOS.md, 30/09/2026: "alguns sons baixo para dar
// imersão"), fatia 3: o CONTROLE de volume e mudo, no jogador e no mestre.
//
// COMO PROVA: as duas telas inteiras no Chromium de verdade.
//   - Jogador: `player.html`, com o host feito pelo próprio teste no WebSocket
//     roteado (como task-sons-do-jogador.spec.ts). A pilha do canto de baixo à
//     direita é medida pelas caixas reais em 1280, 390 e 320 px de largura e
//     no celular deitado (844 x 390, e 844 x 340 com a barra do navegador),
//     com um confronto aberto: o alto-falante e o popover não podem sair da
//     tela nem cobrir o zoom, a mão do "Chamar o mestre" (inclusive com a
//     linha "Esperando o mestre"), as rolagens, a coluna do canto de cima nem
//     a gaveta do painel. O áudio é o Web Audio de verdade, só registrado.
//   - Mestre: o app em modo Tauri com disco e transporte de mentira (como
//     task-jornada-dado-na-sala.spec.ts); o alto-falante mora no cabeçalho da
//     sala e o popover tem de caber dentro do painel da sala, que rola por dentro.
import { test, expect, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { addToken, createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, RegionPoint } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

interface RegistroDoControleDeSom {
  /** Cada fonte que começou a tocar, na ordem: o tipo do oscilador, ou 'ruido'. */
  fontes: string[]
  contextos: BaseAudioContext[]
}

/** O pedaço do `__TAURI_INTERNALS__` que o app usa (`@tauri-apps/api/core`): o "Rust" de mentira do mestre. */
interface InternosDoTauri {
  metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
  invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
  transformCallback: () => number
  convertFileSrc: (filePath: string) => string
}

declare global {
  interface Window {
    __registroDoControleDeSom?: RegistroDoControleDeSom
    isTauri?: boolean
    __TAURI_INTERNALS__?: InternosDoTauri
  }
}

/** A assinatura do sino de "item obtido" (src/lib/sons/receitas.ts): 2 notas × 4 parciais senoidais. */
const AMOSTRA = Array.from({ length: 8 }, () => 'sine')

const VISAO_TODA: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ],
]

function mapaDoJogador(): MapData {
  const comAna = addToken(createEmptyMap('m1', 'Salão', 20, 20, 50), { id: 'ficha-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null })
  // Os outros da fila do confronto: a faixa só mostra quem chegou no recorte.
  const comRato = addToken(comAna, { id: 'rato-1', characterId: null, name: 'Rato 1', x: 225, y: 125, size: 1, image: null })
  return addToken(comRato, { id: 'bia', characterId: null, name: 'Bia', x: 325, y: 125, size: 1, image: null })
}

/**
 * A vez num confronto, a faixa da coluna do canto de cima à direita: com ela
 * aberta, a coluna desce até a faixa do alto-falante no celular deitado.
 */
const CONFRONTO = { fila: ['ficha-ana', 'rato-1', 'bia'], vez: 'ficha-ana', suaVez: true, passo: 6, restam: 6 }

/** Roda NA PÁGINA, antes de qualquer script dela: registra o áudio que começa a tocar. */
function instrumentarWebAudio(): void {
  const registro: RegistroDoControleDeSom = { fontes: [], contextos: [] }
  window.__registroDoControleDeSom = registro
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
    const registro = window.__registroDoControleDeSom
    if (registro === undefined) throw new Error('o registro de som não foi instalado')
    return [...registro.fontes]
  })
}

async function estadosDosContextos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const registro = window.__registroDoControleDeSom
    if (registro === undefined) throw new Error('o registro de som não foi instalado')
    return registro.contextos.map((ctx) => ctx.state)
  })
}

/** Campos a mais do recorte que o host manda (o confronto da cena, por exemplo). */
type ExtrasDoRecorte = Record<string, unknown>

/** O host de mentira: a cada `join` (a entrada e a volta depois de recarregar) responde com a sessão e o recorte. */
class HostDeMentira {
  private socket: WebSocketRoute | null = null
  private readonly extras: ExtrasDoRecorte

  constructor(extras: ExtrasDoRecorte) {
    this.extras = extras
  }

  ligar(ws: WebSocketRoute): void {
    this.socket = ws
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      this.mandar({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' })
      this.mandar({ type: 'snapshot', rev: 1, map: mapaDoJogador(), vision: VISAO_TODA, ownTokens: ['ficha-ana'], concealed: [], ...this.extras })
    })
  }

  mandar(msg: object): void {
    if (this.socket === null) throw new Error('nenhum jogador conectado')
    this.socket.send(JSON.stringify(msg))
  }
}

async function jogadorEntra(page: Page, extras: ExtrasDoRecorte = {}): Promise<HostDeMentira> {
  const host = new HostDeMentira(extras)
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => host.ligar(ws),
  )
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill('SOM123')
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
  return host
}

type Caixa = { x: number; y: number; width: number; height: number }

async function caixa(alvo: Locator): Promise<Caixa> {
  const achada = await alvo.boundingBox()
  if (achada === null) throw new Error('elemento sem caixa (fora da tela ou escondido)')
  return achada
}

function cruzam(a: Caixa, b: Caixa): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function dentroDaTela(c: Caixa, tela: { width: number; height: number }): boolean {
  return c.x >= 0 && c.y >= 0 && c.x + c.width <= tela.width && c.y + c.height <= tela.height
}

/** Mede o popover só depois da entrada (160 ms, `scale(0.95)` e opacidade): no meio dela a caixa é menor e o fundo, transparente. */
async function esperarAEntrada(alvo: Locator): Promise<void> {
  await alvo.evaluate((el) => Promise.all(el.getAnimations().map((animacao) => animacao.finished)))
}

/**
 * A camada (z-index) do contêiner fixo onde o elemento mora. O alto-falante,
 * as rolagens, a coluna do canto de cima e o chamado são irmãos na mesma
 * pilha; as rolagens e a coluna não pegam toque (`pointer-events: none`), e o
 * `elementFromPoint` passaria por elas sem dizer quem está por cima.
 */
async function camada(alvo: Locator): Promise<number> {
  return alvo.evaluate((el) => {
    for (let atual: Element | null = el; atual !== null; atual = atual.parentElement) {
      const estilo = getComputedStyle(atual)
      if (estilo.position === 'fixed') return Number(estilo.zIndex)
    }
    throw new Error('o elemento não mora num contêiner fixo')
  })
}

function rolagem(id: string, total: number) {
  return { type: 'dice.rolled', roll: { id, from: 'Bia', count: 1, sides: 20, modifier: 0, results: [total], total, at: 2_000 } }
}

/**
 * O notebook do mestre, o celular comum (390) e o estreito (320) em pé, e o
 * celular deitado (844 x 390): na tela cheia e com a barra do navegador, que
 * deixa uns 340 px de altura.
 */
const TELAS: ReadonlyArray<{ width: number; height: number }> = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
]

for (const tela of TELAS) {
  test(`jogador ${tela.width}x${tela.height}: o alto-falante entra na pilha do canto sem cobrir zoom, mão, rolagens, coluna do canto nem gaveta`, async ({ page }) => {
    await page.setViewportSize(tela)
    const host = await jogadorEntra(page, { confronto: CONFRONTO })
    host.mandar(rolagem('r1', 17))
    host.mandar(rolagem('r2', 4))
    const som = page.getByRole('button', { name: 'Som', exact: true })
    const zoom = page.getByRole('group', { name: 'Zoom do mapa' })
    const mao = page.getByRole('button', { name: 'Chamar o mestre' })
    const rolagens = page.getByRole('log', { name: 'Rolagens' })
    // A coluna do canto de cima à direita: o "Onde estou" e, com o confronto aberto, a faixa da vez.
    const canto = page.locator('.pp-canto')
    await expect(som).toBeVisible()
    await expect(rolagens.getByText('17')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Confronto' })).toBeVisible()

    const caixaDoSom = await caixa(som)
    expect(dentroDaTela(caixaDoSom, tela)).toBe(true)
    // Alvo de toque de 44 px, no prumo do zoom (mesma borda direita), acima da mão.
    expect(caixaDoSom.width).toBeGreaterThanOrEqual(44)
    expect(caixaDoSom.height).toBeGreaterThanOrEqual(44)
    const caixaDoZoom = await caixa(zoom)
    expect(Math.abs(caixaDoSom.x + caixaDoSom.width - (caixaDoZoom.x + caixaDoZoom.width))).toBeLessThanOrEqual(1)
    const caixaDaMao = await caixa(mao)
    expect(caixaDoSom.y + caixaDoSom.height).toBeLessThanOrEqual(caixaDaMao.y)
    const caixaDasRolagens = await caixa(rolagens)
    for (const outra of [caixaDoZoom, caixaDaMao, caixaDasRolagens, await caixa(canto)]) expect(cruzam(caixaDoSom, outra)).toBe(false)
    // As rolagens inteiras na tela: empurradas para cima do alto-falante, saíam pelo alto no celular deitado.
    expect(dentroDaTela(caixaDasRolagens, tela)).toBe(true)
    await test.info().attach(`pilha-${tela.width}x${tela.height}.png`, { body: await page.screenshot(), contentType: 'image/png' })

    // O popover abre inteiro na tela (para cima; deitado, para a esquerda), sem cobrir o zoom, a mão nem o próprio alto-falante.
    await som.click()
    const popover = page.getByRole('dialog', { name: 'Som da mesa' })
    await expect(popover).toBeVisible()
    await esperarAEntrada(popover)
    const caixaDoPopover = await caixa(popover)
    expect(dentroDaTela(caixaDoPopover, tela)).toBe(true)
    for (const outra of [caixaDoZoom, caixaDaMao, caixaDoSom]) expect(cruzam(caixaDoPopover, outra)).toBe(false)
    // Por cima do que ele cruza: as rolagens e, deitado, a coluna do canto de cima.
    for (const fundo of [rolagens, canto]) {
      if (cruzam(caixaDoPopover, await caixa(fundo))) expect(await camada(popover)).toBeGreaterThan(await camada(fundo))
    }
    await expect(popover.getByRole('slider', { name: 'Volume' })).toBeFocused()
    await test.info().attach(`popover-${tela.width}x${tela.height}.png`, { body: await page.screenshot(), contentType: 'image/png' })
    await page.keyboard.press('Escape')
    await expect(popover).toBeHidden()
    await expect(som).toBeFocused()

    // A mão acesa ocupa as duas linhas do chamado ("Esperando o mestre" e "Baixar a mão"): o alto-falante fica acima delas.
    await mao.click()
    await page.getByRole('button', { name: 'Chamar', exact: true }).click()
    const esperando = page.getByText(/^Esperando o mestre/)
    const baixar = page.getByRole('button', { name: 'Baixar a mão' })
    await expect(esperando).toBeVisible()
    for (const linha of [await caixa(esperando), await caixa(baixar)]) expect(cruzam(await caixa(som), linha)).toBe(false)
    await test.info().attach(`mao-acesa-${tela.width}x${tela.height}.png`, { body: await page.screenshot(), contentType: 'image/png' })

    // Com a mão acesa o popover segue inteiro na tela e por cima das linhas do
    // chamado que cruzar: em 340 ele, preso à margem de cima, desce até a do aviso.
    await som.click()
    await expect(popover).toBeVisible()
    await esperarAEntrada(popover)
    const comAMaoAcesa = await caixa(popover)
    expect(dentroDaTela(comAMaoAcesa, tela)).toBe(true)
    for (const linha of [esperando, baixar]) {
      if (cruzam(comAMaoAcesa, await caixa(linha))) expect(await camada(popover)).toBeGreaterThan(await camada(linha))
    }
    await page.keyboard.press('Escape')
    await expect(popover).toBeHidden()

    // Celular: a gaveta aberta tira o alto-falante de cena (não fica por cima do painel), e fechar a devolve.
    if (tela.width < 700) {
      // Fechada ela se chama "Painel"; aberta, "Fechar painel".
      const painel = page.getByRole('button', { name: /^(Fechar )?painel$/i })
      await painel.click()
      await expect(som).toBeHidden()
      await test.info().attach(`gaveta-${tela.width}.png`, { body: await page.screenshot(), contentType: 'image/png' })
      await painel.click()
      await expect(som).toBeVisible()
    }
  })
}

test('jogador: a barra regula durante o arrasto, soltar toca a amostra, mudo num clique, e a escolha volta depois de recarregar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const erros: string[] = []
  page.on('pageerror', (erro) => erros.push(erro.message))
  await page.addInitScript(instrumentarWebAudio)
  await jogadorEntra(page)
  const som = page.getByRole('button', { name: 'Som', exact: true })
  const popover = page.getByRole('dialog', { name: 'Som da mesa' })
  const barra = popover.getByRole('slider', { name: 'Volume' })
  const mudo = popover.getByRole('button', { name: 'Mudo' })

  // O toque no alto-falante é o primeiro gesto da sessão: abre o popover e destrava o áudio.
  await som.click()
  await expect(barra).toHaveValue('35')
  await expect.poll(() => estadosDosContextos(page), { message: 'o toque no alto-falante destrava o áudio' }).toEqual(['running'])

  // Arrasto da alça de 35 até perto de 70: o valor muda DURANTE o gesto, e nada toca antes de soltar.
  const trilho = await caixa(barra)
  const ALCA = 20
  const xDoValor = (valor: number) => trilho.x + ALCA / 2 + (valor / 100) * (trilho.width - ALCA)
  const y = trilho.y + trilho.height / 2
  await page.mouse.move(xDoValor(35), y)
  await page.mouse.down()
  await page.mouse.move(xDoValor(70), y, { steps: 8 })
  await page.waitForTimeout(150)
  const duranteOGesto = Number(await barra.inputValue())
  expect(duranteOGesto).toBeGreaterThanOrEqual(66)
  expect(duranteOGesto).toBeLessThanOrEqual(74)
  await expect(popover).toContainText(`${duranteOGesto}%`)
  expect(await fontes(page), 'arrastar não toca; só soltar').toEqual([])
  await page.mouse.up()
  await expect.poll(() => fontes(page), { message: 'soltar a alça toca o sino de amostra' }).toEqual(AMOSTRA)
  await expect(som).toHaveAttribute('title', `Som: ${duranteOGesto}%`)

  // Mudo num clique: o alto-falante do botão fica cortado, e nada toca.
  await mudo.click()
  await expect(mudo).toHaveAttribute('aria-pressed', 'true')
  await expect(som).toHaveAttribute('data-estado', 'mudo')
  await expect(popover).toContainText('Mudo')
  await page.waitForTimeout(700)
  expect(await fontes(page)).toEqual(AMOSTRA)

  // Recarregar: a escolha é do aparelho (localStorage) e volta com a sessão.
  await page.reload()
  await expect(som).toBeVisible()
  await expect(som).toHaveAttribute('data-estado', 'mudo')
  await som.click()
  await expect(mudo).toHaveAttribute('aria-pressed', 'true')
  await expect(barra).toHaveValue(String(duranteOGesto))
  expect(erros).toEqual([])
})

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco e transporte de mentira
// ───────────────────────────────────────────────────────────────────────────

const CODIGO = 'SOM777'
const AVENTURA = 'Aventura do Som'
const PASTA = 'C:/appdata/maps/map_som'

function discoDaAventura(): Record<string, string> {
  const cena = createEmptyMap('map_som', AVENTURA, 20, 12, 50)
  const aventura = { version: 1, id: 'adv_som', name: AVENTURA, startSceneId: 'scene_som', scenes: [{ id: 'scene_som', name: AVENTURA, file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(cena), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

async function mestreAbreASala(mestre: Page): Promise<void> {
  await mestre.addInitScript(
    ({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }) => {
      const textos: Record<string, string> = { ...arquivos }
      const pastas = new Set<string>()
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
      const existe = (caminho: string): boolean => {
        const c = semBarraFinal(caminho)
        return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
      }
      /** Os argumentos do `invoke` como campos soltos: o app manda objeto, e o resto vira vazio. */
      const campos = (valor: unknown): Record<string, unknown> => (typeof valor === 'object' && valor !== null ? Object.fromEntries(Object.entries(valor)) : {})
      let proximoId = 0
      window.isTauri = true
      window.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        convertFileSrc: (caminho: string) => String(caminho),
        // Nenhum evento do "Rust" é emitido aqui: basta um id por ouvinte.
        transformCallback: () => {
          proximoId += 1
          return proximoId
        },
        invoke: async (cmd, args, options) => {
          const a = campos(args)
          switch (cmd) {
            case 'net_start_room':
              return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
            case 'plugin:event|listen':
              return Number(a.handler)
            case 'plugin:path|resolve_directory':
              return 'C:/appdata'
            case 'plugin:path|join':
              return Array.isArray(a.paths) ? a.paths.map(String).join('/') : ''
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
              if (args instanceof Uint8Array) textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args)
              return null
            case 'plugin:fs|read_text_file': {
              const caminho = String(a.path)
              if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(textos[caminho]))
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
}

test('mestre: "Som da mesa" abaixo do cabeçalho da sala abre o popover inteiro dentro do painel, e as setas regulam', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await mestreAbreASala(page)
  const sala = page.locator('.lb-room')
  const som = sala.getByRole('button', { name: 'Som da mesa' })
  await expect(som).toBeVisible()
  // O cabeçalho continua numa linha só: SALA e o código inteiros (um botão a mais nele quebrava o código).
  const codigo = sala.locator('.lb-room__code')
  const eyebrow = sala.locator('.lb-room__head .lb-eyebrow')
  const linhaDoCodigo = await caixa(codigo)
  expect(linhaDoCodigo.height).toBeLessThan(36)
  expect((await caixa(eyebrow)).height).toBeLessThan(20)
  // Entre o cabeçalho e o Ruído, alinhado à direita da coluna.
  const ruido = sala.getByRole('button', { name: 'Ruído', exact: true })
  const caixaDoSom = await caixa(som)
  expect(caixaDoSom.y).toBeGreaterThan(linhaDoCodigo.y + linhaDoCodigo.height)
  expect(caixaDoSom.y + caixaDoSom.height).toBeLessThan((await caixa(ruido)).y)
  expect(Math.abs(caixaDoSom.x + caixaDoSom.width - ((await caixa(ruido)).x + (await caixa(ruido)).width))).toBeLessThanOrEqual(1)

  // A legenda também abre: o alvo do clique é a linha. Clique de mouse abre com a entrada curta, não "pelo teclado".
  await sala.getByText('Som da mesa', { exact: true }).click()
  const popover = page.getByRole('dialog', { name: 'Som da mesa' })
  await expect(popover).toBeVisible()
  await expect(popover).toHaveAttribute('data-abertura', 'ponteiro')
  await esperarAEntrada(popover)
  // O painel da sala rola por dentro: o popover tem de caber nele, sem corte e sem barra de rolagem de lado.
  const caixaDaSala = await caixa(sala)
  const caixaDoPopover = await caixa(popover)
  expect(caixaDoPopover.x).toBeGreaterThanOrEqual(caixaDaSala.x)
  expect(caixaDoPopover.x + caixaDoPopover.width).toBeLessThanOrEqual(caixaDaSala.x + caixaDaSala.width)
  expect(caixaDoPopover.y + caixaDoPopover.height).toBeLessThanOrEqual(caixaDaSala.y + caixaDaSala.height)
  expect(await sala.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await test.info().attach('mestre-popover.png', { body: await page.screenshot(), contentType: 'image/png' })

  const barra = popover.getByRole('slider', { name: 'Volume' })
  await expect(barra).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(barra).toHaveValue('37')
  await expect(popover).toContainText('37%')
  const mudo = popover.getByRole('button', { name: 'Mudo' })
  await mudo.click()
  await expect(mudo).toHaveAttribute('aria-pressed', 'true')
  await expect(som).toHaveAttribute('data-estado', 'mudo')
  // Clicar no mapa fecha o popover.
  await page.mouse.click(700, 400)
  await expect(popover).toBeHidden()
})
