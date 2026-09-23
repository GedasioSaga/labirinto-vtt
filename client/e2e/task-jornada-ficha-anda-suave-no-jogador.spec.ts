// JORNADA DE USUÁRIO da FICHA QUE ANDA SUAVE NA TELA DO JOGADOR (item 6 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - na tela de quem joga, quando a ficha de ALGUÉM muda de lugar (o mestre
//     arrasta no editor, ou outro jogador anda com a dele), ela DESLIZA do
//     ponto antigo ao novo numa animação curta (cerca de 150 a 250 ms), em
//     linha reta, sem sumir no caminho, e para no ponto novo;
//   - troca de cena continua INSTANTÂNEA: a ficha que chega a outra cena não
//     atravessa a tela vinda do lugar onde estava na cena de antes;
//   - a própria ficha que o jogador arrasta continua sob o dedo: ao soltar, ela
//     não volta ao ponto antigo para então deslizar de novo.
//
// ONDE ISSO MORRE HOJE: `client/src/player/PlayerView.tsx:829` faz
// `view.wrapper.position.set(token.x, token.y)` direto a cada snapshot — a
// ficha pisca do ponto antigo ao novo. Nenhum tween nem ticker de ficha no
// render do jogador (o ticker de lá só cuida de sinal, laser e medida,
// `PlayerView.tsx:1047-1064`). O doc de candidatas aponta
// `pixi/tokensRenderer.ts:338`, que é o render do MESTRE; o do jogador é este.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-entrada-jogador.spec.ts e task-player-page.spec.ts):
//   MESTRE DE VERDADE NO FIO: a sessão REAL do mestre (`src/net/hostSession.ts`)
//   atrás de `page.routeWebSocket`, e o integrador deste arquivo faz o que
//   `net/hostBridge.ts:507-512` faz: movimento aceito vira mapa novo +
//   `broadcast`. "O mestre arrasta" chega ao jogador exatamente como chega na
//   mesa: um `snapshot` com a ficha no ponto novo (`session.broadcast`).
//   DUAS TELAS DE JOGADOR DE VERDADE: Ana (quem olha) e Bruno (quem anda), cada
//   um no `player.html` inteiro, em contextos de navegador separados.
//   GESTO REAL NA AÇÃO SOB TESTE: Bruno arrasta a própria ficha com o ponteiro,
//   devagar como um dedo, com pausa antes de soltar; Ana arrasta a dela no
//   teste 5. Nenhum setState, evento sintético ou `evaluate` que muta.
//   PROVA NA TELA, QUADRO A QUADRO: a animação dura ~200 ms e uma foto do
//   Playwright é lenta demais para vê-la. Por isso a tela de Ana é GRAVADA
//   pelo screencast do Chromium (CDP `Page.startScreencast`, só leitura: os
//   quadros que o compositor já produziu). Cada quadro é decodificado num
//   canvas solto (o único `evaluate`, LEITURA de pixel) e a ficha laranja é
//   achada pela cor: centro de massa e tamanho. Nada é lido da store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - "desliza" = pelo menos DOIS quadros mostram a ficha inteira no MEIO do
//     caminho (entre 15% e 85% do trajeto, na mesma linha), a posição só
//     avança, e ela chega ao ponto novo em até ~800 ms depois de sair do
//     antigo (a feature pede 150-250 ms; a folga é da máquina carregada e da
//     cadência dos quadros);
//   - o deslize vale tanto para a ficha de outro jogador quanto para a do
//     mestre (monstro sem dono);
//   - a câmera do jogador NÃO se move quando a ficha de outro anda (hoje não
//     move: `PlayerView.tsx:1251-1255`), então a posição na tela é a conta de
//     `fitCamera` com a margem de `PlayerView.tsx:94`;
//   - duas cenas do MESMO tamanho têm o mesmo enquadramento (`fitCamera`
//     refeito por id de mapa, `PlayerView.tsx:848-855`).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Prova que o fio, a câmera, o
// classificador de cor e a GRAVAÇÃO funcionam na tela de quem olha — a mesma
// gravação vê a ficha de Ana no meio do caminho enquanto o dedo dela arrasta,
// e o mestre deixa a ficha no destino. Sem ele, o vermelho dos testes 2 e 3
// poderia ser a gravação cega, e não a feature ausente. (A segunda tela, a de
// Bruno, fica provada no próprio vermelho do teste 2: o filme mostra a ficha
// dele saindo da origem e chegando ao destino na tela de Ana.)
// GUARDAS (verdes hoje, e têm de continuar verdes): testes 4 e 5. Um deslize
// ingênuo por id de ficha quebraria os dois — a ficha atravessaria a tela na
// troca de cena, e a do próprio jogador voltaria ao ponto antigo ao soltar.
import { test, expect, type Browser, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession, type HostMapSource, type HostSession, type HostWorld, type Outbound } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'SUAVE1'
const ANA = 'Ana'
const BRUNO = 'Bruno'

const GRADE = 50
const COLUNAS = 20
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE

const TELA = { width: 1280, height: 800 }
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx:94 — a conta de câmera tem de ser a mesma. */
const FIT_MARGIN = 24
const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)

/** A ficha que anda é laranja: cor que nada mais na tela do jogador usa. */
const LARANJA = '#ff5a00'
/** Trajeto horizontal longo (400 px de mundo, ~490 px de tela). */
const ORIGEM = { x: 300, y: 250 }
const DESTINO = { x: 700, y: 250 }
/** Ficha de Ana quando ela só olha: longe do trajeto, com a cor de sempre (azul). */
const LUGAR_DE_ANA = { x: 500, y: 500 }

/** Gravação em meia resolução: 640 x 400, quadro leve o bastante para vir em sequência. */
const QUADRO_MAX = { maxWidth: TELA.width / 2, maxHeight: TELA.height / 2 }
/** Quanto tempo gravar depois do gesto: cobre a animação (~250 ms) com muita folga. */
const GRAVAR_DEPOIS_MS = 1500

/** Ficha "inteira" num quadro: disco de raio ~31 px de tela, ~15 px no quadro de meia resolução (~700 px). */
const PIXELS_DA_FICHA = 150
/** Faixa do trajeto que conta como "origem" e "destino" (fração do caminho). */
const PONTA = 0.15
/** Desvio vertical máximo do centro da ficha, em px de TELA: a ficha anda em linha reta. */
const DESVIO_Y = 20
/** A feature pede 150-250 ms; a folga cobre máquina carregada e cadência dos quadros. */
const DESLIZE_MAX_MS = 800
/** Menos que isto entre "saiu" e "chegou" não é animação, é piscada. */
const DESLIZE_MIN_MS = 60

/** Espera de quem LÊ PIXEL: cada leitura custa segundos sob carga. */
const ESPERA_TELA = 20_000
/** Cada passo do dedo no arrasto: 20 passos de ~30 ms, arrasto de ~0,6 s como o de uma pessoa. */
const PASSOS_DO_DEDO = 20
const PASSO_MS = 30
/** Pausa com o dedo parado antes de soltar. */
const PAUSA_ANTES_DE_SOLTAR_MS = 200

type Ponto = { x: number; y: number }

function paraTela(p: Ponto): Ponto {
  return { x: p.x * CAMERA.scale + CAMERA.x, y: p.y * CAMERA.scale + CAMERA.y }
}

// ───────────────────────────────────────────────────────────────────────────
// Os mapas
// ───────────────────────────────────────────────────────────────────────────

function ficha(id: string, name: string, p: Ponto, color?: string): Token {
  const base: Token = { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null }
  return color === undefined ? base : { ...base, color }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    tokens,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre no fio: sessão real + o integrador de net/hostBridge.ts
// ───────────────────────────────────────────────────────────────────────────

interface Mesa {
  session: HostSession
  fonte: HostMapSource
  sockets: Map<string, WebSocketRoute>
  jogadorDe: Map<string, string>
}

function abrirMesa(fonte: HostMapSource): Mesa {
  const session = createHostSession({
    code: CODIGO,
    visionRadius: 2000,
    randomId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  return { session, fonte, sockets: new Map(), jogadorDe: new Map() }
}

function despachar(mesa: Mesa, outbound: Outbound[]): void {
  for (const { clientId, msg } of outbound) {
    if (msg.type === 'welcome') mesa.jogadorDe.set(clientId, msg.playerId)
    mesa.sockets.get(clientId)?.send(JSON.stringify(msg))
  }
}

/** A ficha muda de lugar na cena onde está — o que `deps.applyMove` faz no app. */
function moverNaFonte(fonte: HostMapSource, tokenId: string, x: number, y: number): HostMapSource {
  const mover = (m: MapData): MapData => ({ ...m, tokens: m.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) })
  if (!('open' in fonte)) return mover(fonte)
  return {
    open: { ...fonte.open, map: mover(fonte.open.map) },
    background: fonte.background.map((cena) => ({ ...cena, map: mover(cena.map) })),
  }
}

/** Transmite o mundo de agora a todo jogador — o `broadcastNow` do app. */
function transmitir(mesa: Mesa): void {
  despachar(mesa, mesa.session.broadcast(mesa.fonte).outbound)
}

async function ligarNoFio(page: Page, mesa: Mesa, clientId: string): Promise<void> {
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      mesa.sockets.set(clientId, ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        const resultado = mesa.session.handleMessage(clientId, texto, mesa.fonte)
        despachar(mesa, resultado.outbound)
        // net/hostBridge.ts:507-512: movimento aceito → mapa novo → snapshot para todos.
        if (resultado.applyMove !== undefined) {
          const { tokenId, x, y } = resultado.applyMove
          mesa.fonte = moverNaFonte(mesa.fonte, tokenId, x, y)
          transmitir(mesa)
        }
      })
    },
  )
}

const contextosExtras: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosExtras.splice(0).map((contexto) => contexto.close()))
})

async function outraTela(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosExtras.push(contexto)
  return contexto.newPage()
}

/** Entra pela tela de entrada, tecla a tecla, e o mestre dá a ficha: o caminho de toda mesa. */
async function jogadorEntra(page: Page, mesa: Mesa, clientId: string, nome: string, tokenId: string): Promise<void> {
  await ligarNoFio(page, mesa, clientId)
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODIGO, { delay: 20 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.pressSequentially(nome, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 30_000 })
  const jogador = mesa.jogadorDe.get(clientId)
  if (jogador === undefined) throw new Error(`${nome}: o mestre não deu boas-vindas`)
  despachar(mesa, mesa.session.assignToken(jogador, tokenId).outbound)
  transmitir(mesa)
  await expect(page.locator('canvas').first(), `${nome}: o mapa não apareceu na tela`).toBeVisible({ timeout: 30_000 })
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura de pixel: a ficha laranja num quadro
// ───────────────────────────────────────────────────────────────────────────

/** Onde a ficha laranja está num quadro, em px de TELA (CSS). `t` em ms, do relógio do compositor. */
interface Leitura {
  n: number
  cx: number
  cy: number
  t: number
}

/**
 * Decodifica quadros (JPEG/PNG em base64) num canvas solto da própria página
 * e acha a mancha laranja de cada um: quantos pixels e o centro de massa,
 * convertidos para px de tela. Leitura pura — nada do app é tocado.
 */
async function lerFicha(page: Page, quadros: { b64: string; mime: string }[]): Promise<Omit<Leitura, 't'>[]> {
  return page.evaluate(
    async ({ lista, larguraDaTela }) => {
      const saida: { n: number; cx: number; cy: number }[] = []
      for (const q of lista) {
        const bmp = await createImageBitmap(await (await fetch(`data:${q.mime};base64,${q.b64}`)).blob())
        const tela = document.createElement('canvas')
        tela.width = bmp.width
        tela.height = bmp.height
        const ctx = tela.getContext('2d')
        if (!ctx) throw new Error('sem contexto 2d')
        ctx.drawImage(bmp, 0, 0)
        const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
        let n = 0
        let sx = 0
        let sy = 0
        // Um pixel a cada dois, nas duas direções: 4x menos trabalho sob carga, e o
        // disco da ficha (~700 px no quadro) continua com ~175 amostras.
        const PASSO = 2
        for (let y = 0; y < height; y += PASSO) {
          for (let x = 0; x < width; x += PASSO) {
            const i = (y * width + x) * 4
            // #ff5a00 com folga para antisserrilhado e compressão.
            if (data[i] > 200 && data[i + 1] > 50 && data[i + 1] < 140 && data[i + 2] < 70) {
              n += 1
              sx += x
              sy += y
            }
          }
        }
        const escala = larguraDaTela / width
        saida.push({ n: n * PASSO * PASSO * escala * escala, cx: n > 0 ? (sx / n) * escala : NaN, cy: n > 0 ? (sy / n) * escala : NaN })
      }
      return saida
    },
    { lista: quadros, larguraDaTela: TELA.width },
  )
}

/** Foto de agora da tela, lida como um quadro. */
async function fichaAgora(page: Page): Promise<Omit<Leitura, 't'>> {
  const foto = await page.screenshot({ type: 'png' })
  const [leitura] = await lerFicha(page, [{ b64: foto.toString('base64'), mime: 'image/png' }])
  return leitura
}

// ───────────────────────────────────────────────────────────────────────────
// Gravação da tela (screencast do Chromium: só leitura)
// ───────────────────────────────────────────────────────────────────────────

interface Gravacao {
  quadros: { b64: string; t: number }[]
  /** Quantos quadros já tinham chegado — marca o instante do gesto. */
  marca: () => number
  parar: () => Promise<void>
}

async function gravar(page: Page): Promise<Gravacao> {
  const cdp = await page.context().newCDPSession(page)
  const quadros: { b64: string; t: number }[] = []
  cdp.on('Page.screencastFrame', (quadro) => {
    quadros.push({ b64: quadro.data, t: (quadro.metadata.timestamp ?? 0) * 1000 })
    cdp.send('Page.screencastFrameAck', { sessionId: quadro.sessionId }).catch(() => undefined)
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1, ...QUADRO_MAX })
  // A gravação só vale depois do primeiro quadro: antes dele não há "antes do gesto".
  await expect.poll(() => quadros.length, { timeout: 10_000, message: 'o screencast não mandou quadro nenhum' }).toBeGreaterThan(0)
  return {
    quadros,
    marca: () => quadros.length,
    parar: async () => {
      await cdp.send('Page.stopScreencast').catch(() => undefined)
      await cdp.detach().catch(() => undefined)
    },
  }
}

/**
 * Grava até o ÚLTIMO quadro recebido mostrar a ficha no destino, e mais um
 * pouco. Sob carga o screencast entrega com atraso: parar num relógio fixo
 * cortava o filme antes do quadro da chegada (medido: "origem origem" com a
 * ficha já no destino na foto seguinte).
 */
async function gravarAteChegar(page: Page, g: Gravacao, desde: number, quem: string): Promise<void> {
  await page.waitForTimeout(GRAVAR_DEPOIS_MS)
  await expect
    .poll(
      async () => {
        const ultimo = g.quadros[g.quadros.length - 1]
        if (g.quadros.length <= desde || ultimo === undefined) return 'sem quadro novo'
        const [leitura] = await lerFicha(page, [{ b64: ultimo.b64, mime: 'image/jpeg' }])
        return lugar({ ...leitura, t: ultimo.t })
      },
      { timeout: ESPERA_TELA, intervals: [250, 500, 1000], message: `${quem}: a gravação nunca mostrou a ficha no destino` },
    )
    .toBe('destino')
  await page.waitForTimeout(GRAVAR_DEPOIS_MS / 3)
}

async function lerGravacao(page: Page, g: Gravacao, desde: number): Promise<Leitura[]> {
  const trecho = g.quadros.slice(desde)
  const leituras = await lerFicha(page, trecho.map((q) => ({ b64: q.b64, mime: 'image/jpeg' })))
  return leituras.map((l, i) => ({ ...l, t: trecho[i].t }))
}

// ───────────────────────────────────────────────────────────────────────────
// Onde a ficha está no trajeto
// ───────────────────────────────────────────────────────────────────────────

type Lugar = 'origem' | 'meio' | 'destino' | 'sumiu' | 'fora'

/** Fração do trajeto ORIGEM → DESTINO em que o centro da ficha está (0 = origem, 1 = destino). */
function progresso(l: Leitura): number {
  const a = paraTela(ORIGEM)
  const b = paraTela(DESTINO)
  return (l.cx - a.x) / (b.x - a.x)
}

function lugar(l: Leitura): Lugar {
  if (l.n < PIXELS_DA_FICHA) return 'sumiu'
  if (Math.abs(l.cy - paraTela(ORIGEM).y) > DESVIO_Y) return 'fora'
  const p = progresso(l)
  if (Math.abs(p) < PONTA) return 'origem'
  if (Math.abs(p - 1) < PONTA) return 'destino'
  if (p > PONTA && p < 1 - PONTA) return 'meio'
  return 'fora'
}

/** O filme em uma linha, para a mensagem de falha: "origem origem destino destino". */
function filme(leituras: Leitura[]): string {
  return leituras.map((l) => `${lugar(l)}(${Number.isFinite(l.cx) ? Math.round(l.cx) : '-'})`).join(' ')
}

/** Espera a tela mostrar a ficha laranja inteira no lugar dado. */
async function telaMostraFichaEm(page: Page, onde: 'origem' | 'destino', quem: string): Promise<void> {
  await expect
    .poll(async () => lugar({ ...(await fichaAgora(page)), t: 0 }), { timeout: ESPERA_TELA, message: `${quem}: a ficha laranja deveria estar na ${onde}` })
    .toBe(onde)
}

/** Arrasta a ficha de ORIGEM a DESTINO como um dedo: aperta, anda em passos, para, solta. */
async function arrastarDevagar(page: Page, antesDeSoltar?: () => number): Promise<number> {
  const a = paraTela(ORIGEM)
  const b = paraTela(DESTINO)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  for (let i = 1; i <= PASSOS_DO_DEDO; i += 1) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / PASSOS_DO_DEDO, a.y + ((b.y - a.y) * i) / PASSOS_DO_DEDO)
    await page.waitForTimeout(PASSO_MS)
  }
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  const marca = antesDeSoltar ? antesDeSoltar() : 0
  await page.mouse.up()
  return marca
}

/** Tudo o que a feature pede de um deslize, lido no filme da tela de quem olha. */
function conferirDeslize(depois: Leitura[], quem: string): void {
  const visto = filme(depois)

  // 1. A ficha passa PELO MEIO do caminho, em mais de um quadro.
  const meio = depois.filter((l) => lugar(l) === 'meio')
  expect(meio.length, `${quem}: a ficha deveria DESLIZAR (≥2 quadros no meio do caminho), mas pulou. Filme depois do gesto (${depois.length} quadros): ${visto}`).toBeGreaterThanOrEqual(2)

  // 2. Nunca some nem sai da linha no caminho.
  const ruins = depois.filter((l) => lugar(l) === 'sumiu' || lugar(l) === 'fora')
  expect(ruins.length, `${quem}: a ficha sumiu ou saiu da linha no caminho. Filme: ${visto}`).toBe(0)

  // 3. Só avança: nada de ir e voltar.
  const ps = depois.map(progresso)
  for (let i = 1; i < ps.length; i += 1) {
    expect(ps[i], `${quem}: a ficha voltou para trás no quadro ${i}. Filme: ${visto}`).toBeGreaterThanOrEqual(ps[i - 1] - 0.05)
  }

  // 4. Curta: sai e chega dentro da janela da feature.
  const ultimoNaOrigem = [...depois].reverse().find((l) => lugar(l) === 'origem') ?? depois[0]
  const primeiroNoDestino = depois.find((l) => lugar(l) === 'destino')
  expect(primeiroNoDestino, `${quem}: a ficha nunca chegou ao destino. Filme: ${visto}`).toBeDefined()
  const duracao = (primeiroNoDestino as Leitura).t - ultimoNaOrigem.t
  expect(duracao, `${quem}: deslize de ${Math.round(duracao)} ms. Filme: ${visto}`).toBeGreaterThanOrEqual(DESLIZE_MIN_MS)
  expect(duracao, `${quem}: deslize de ${Math.round(duracao)} ms, longo demais. Filme: ${visto}`).toBeLessThanOrEqual(DESLIZE_MAX_MS)

  // 5. E para no ponto novo.
  expect(lugar(depois[depois.length - 1] ?? { n: 0, cx: NaN, cy: NaN, t: 0 }), `${quem}: a ficha deveria terminar no destino. Filme: ${visto}`).toBe('destino')
}

/** Mesa de dois: Ana (ficha azul, longe) olha; Bruno (ficha laranja na origem) anda. */
async function mesaDeDois(page: Page, browser: Browser, baseURL: string | undefined): Promise<{ mesa: Mesa; bruno: Page }> {
  const mesa = abrirMesa(mapa('map_suave', 'Salão', [ficha('tok-ana', 'Lanterna', LUGAR_DE_ANA), ficha('tok-bruno', 'Machado', ORIGEM, LARANJA)]))
  await jogadorEntra(page, mesa, 'c1', ANA, 'tok-ana')
  const bruno = await outraTela(browser, baseURL)
  await jogadorEntra(bruno, mesa, 'c2', BRUNO, 'tok-bruno')
  await telaMostraFichaEm(page, 'origem', ANA)
  await telaMostraFichaEm(bruno, 'origem', BRUNO)
  return { mesa, bruno }
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana arrasta a própria ficha, a gravação da tela dela a vê no meio do caminho, e o mestre deixa a ficha no lugar novo', async ({ page }) => {
  test.setTimeout(300_000)
  const mesa = abrirMesa(mapa('map_suave', 'Salão', [ficha('tok-ana', 'Lanterna', ORIGEM, LARANJA)]))
  await jogadorEntra(page, mesa, 'c1', ANA, 'tok-ana')
  await telaMostraFichaEm(page, 'origem', ANA)

  // A MESMA gravação dos testes 2 e 3, na MESMA tela (a de quem olha): se ela
  // enxerga a ficha sob o dedo no meio do caminho, enxergaria um deslize.
  const gravacao = await gravar(page)
  const inicio = gravacao.marca()
  await arrastarDevagar(page)
  await gravarAteChegar(page, gravacao, inicio, ANA)
  await gravacao.parar()

  const visto = await lerGravacao(page, gravacao, inicio)
  const meioNoDedo = visto.filter((l) => lugar(l) === 'meio')
  expect(meioNoDedo.length, `a gravação deveria ver a ficha sob o dedo, no meio do caminho. Filme: ${filme(visto)}`).toBeGreaterThanOrEqual(3)
  await telaMostraFichaEm(page, 'destino', ANA)
})

test('2. outro jogador anda: na tela de Ana a ficha de Bruno desliza do ponto antigo ao novo, em vez de pular', async ({ page, browser, baseURL }) => {
  test.setTimeout(300_000)
  const { bruno } = await mesaDeDois(page, browser, baseURL)

  const gravacao = await gravar(page)
  const marca = await arrastarDevagar(bruno, gravacao.marca)
  await gravarAteChegar(page, gravacao, marca, ANA)
  await gravacao.parar()

  // O movimento chegou à tela de Ana (verde hoje): o vermelho abaixo é do deslize, não do fio.
  await telaMostraFichaEm(page, 'destino', ANA)
  conferirDeslize(await lerGravacao(page, gravacao, marca), ANA)
})

test('3. o mestre arrasta um monstro: na tela de Ana a ficha dele desliza até o lugar novo', async ({ page }) => {
  test.setTimeout(300_000)
  const mesa = abrirMesa(mapa('map_suave', 'Salão', [ficha('tok-ana', 'Lanterna', LUGAR_DE_ANA), ficha('tok-lobo', 'Lobo', ORIGEM, LARANJA)]))
  await jogadorEntra(page, mesa, 'c1', ANA, 'tok-ana')
  await telaMostraFichaEm(page, 'origem', ANA)

  const gravacao = await gravar(page)
  const marca = gravacao.marca()
  // O arrasto do mestre no editor chega à mesa como isto: mapa novo + snapshot (net/hostBridge.ts).
  mesa.fonte = moverNaFonte(mesa.fonte, 'tok-lobo', DESTINO.x, DESTINO.y)
  transmitir(mesa)
  await gravarAteChegar(page, gravacao, marca, ANA)
  await gravacao.parar()

  // O movimento chegou à tela de Ana (verde hoje): o vermelho abaixo é do deslize, não do fio.
  await telaMostraFichaEm(page, 'destino', ANA)
  conferirDeslize(await lerGravacao(page, gravacao, marca), ANA)
})

test('4. guarda: levada a outra cena, a ficha de Ana aparece no lugar novo sem atravessar a tela', async ({ page }) => {
  test.setTimeout(300_000)
  const cenaA = mapa('map_salao', 'Salão', [ficha('tok-ana', 'Lanterna', ORIGEM, LARANJA)])
  const cenaB = mapa('map_cripta', 'Cripta', [])
  const mundo: HostWorld = { open: { sceneId: 'scene_salao', name: 'Salão', map: cenaA }, background: [{ sceneId: 'scene_cripta', name: 'Cripta', map: cenaB }] }
  const mesa = abrirMesa(mundo)
  await jogadorEntra(page, mesa, 'c1', ANA, 'tok-ana')
  await telaMostraFichaEm(page, 'origem', ANA)

  const gravacao = await gravar(page)
  const marca = gravacao.marca()
  // "Mandar para…" do painel Grupo, pelo caminho do app: transferência, aviso, snapshot.
  const jogadora = mesa.jogadorDe.get('c1') as string
  const envio = mesa.session.sendPlayer(jogadora, 'scene_cripta', null, mesa.fonte, DESTINO)
  const transferencia = envio.applyTransfer
  expect(transferencia, 'o mestre deveria conseguir mandar Ana para a Cripta').toBeDefined()
  const tokenLevado = cenaA.tokens[0]
  mesa.fonte = {
    open: { ...mundo.open, map: { ...cenaA, tokens: [] } },
    background: [{ ...mundo.background[0], map: { ...cenaB, tokens: [{ ...tokenLevado, x: transferencia?.x ?? DESTINO.x, y: transferencia?.y ?? DESTINO.y }] } }],
  }
  despachar(mesa, envio.outbound)
  transmitir(mesa)
  await gravarAteChegar(page, gravacao, marca, ANA)
  await gravacao.parar()

  const depois = await lerGravacao(page, gravacao, marca)
  const visto = filme(depois)
  const noCaminho = depois.filter((l) => lugar(l) === 'meio')
  expect(noCaminho.length, `troca de cena é instantânea: a ficha não pode atravessar a tela. Filme: ${visto}`).toBe(0)
  await telaMostraFichaEm(page, 'destino', ANA)
})

test('5. guarda: Ana arrasta a própria ficha e, ao soltar, ela fica sob o dedo — não volta ao ponto antigo para deslizar de novo', async ({ page }) => {
  test.setTimeout(300_000)
  const mesa = abrirMesa(mapa('map_suave', 'Salão', [ficha('tok-ana', 'Lanterna', ORIGEM, LARANJA)]))
  await jogadorEntra(page, mesa, 'c1', ANA, 'tok-ana')
  await telaMostraFichaEm(page, 'origem', ANA)

  const gravacao = await gravar(page)
  // A gravação começa a contar com o dedo já parado no destino, logo antes de soltar.
  const marca = await arrastarDevagar(page, gravacao.marca)
  await page.waitForTimeout(GRAVAR_DEPOIS_MS)
  await gravacao.parar()

  const depois = await lerGravacao(page, gravacao, marca)
  const visto = filme(depois)
  const foraDoDedo = depois.filter((l) => lugar(l) !== 'destino')
  expect(foraDoDedo.length, `solta sob o dedo, a ficha tem de ficar no destino em todo quadro. Filme: ${visto}`).toBe(0)
  await telaMostraFichaEm(page, 'destino', ANA)
})
