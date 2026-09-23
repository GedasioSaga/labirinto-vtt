// JORNADA DO PINO QUE SE MOVE E DO CARTÃO À DIREITA — escrita para SAIR
// VERMELHA hoje.
//
// Pedido do usuário, nas palavras dele (18/09/2026): "Sobre o pino, seria
// interessante poder mover ele depois de colocado, e ao invés de aparece no
// meio da tela, aparede do lado direito e inclusive eu imagino o jogador tendo
// no lado direito um pequeno lugar para ver essas coisas."
//
// Traduzido em comportamento observável, que é o que esta jornada cobra:
//   1. o mestre arrasta um pino já cravado e ele vai para o lugar novo — some
//      de onde estava, aparece onde foi solto — e UM Ctrl+Z traz ele de volta
//      (o arrasto inteiro é um desfazer só, não quarenta);
//   2. pino TRAVADO não sai do lugar quando arrastado, mas continua clicável e
//      selecionável (o painel dele reabre no toque);
//   3. na tela do jogador o cartão do pino abre na METADE DIREITA da janela,
//      sem tapar o centro do mapa, e em janela estreita volta a ocupar a
//      largura — encostado à direita numa tela de 400 px ele seria uma tira
//      ilegível.
//
// COMO ELA PROVA. Gesto de ponteiro de verdade, com o botão parado antes de
// soltar (nada de `dispatchEvent`, nada de `page.evaluate` que escreve na
// store). Asserção no que APARECE: pixel do canvas no lado do mestre, caixa de
// elemento medida contra a janela no lado do jogador. A store aparece uma vez
// só, em LEITURA, para descobrir onde no mundo o pino ficou — e o mapa viaja
// para o jogador pela sessão REAL do host (`src/net/hostSession.ts`) por cima
// de `routeWebSocket`, sem transporte inventado dentro da página (mesmo
// encanamento de task-jornada-pinos-ponto-de-interesse.spec.ts).
import { test, expect, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import type { HostMessage } from '../src/net/protocol'
import type { MapData } from '../src/types/map'
import { enterEditor } from './helpers/enterEditor'

const CODE = 'PINO02'
/** Folga para o Pixi terminar de pintar antes de fotografar (mesmo valor das jornadas irmãs). */
const PINTURA_MS = 400
/**
 * Botão parado antes de soltar. 120 ms é toque de dedo humano E fica abaixo dos
 * 500 ms de `SIGNAL_LONG_PRESS_MS` (lib/signals.ts): segurar mais que isso na
 * tela do jogador vira SINAL de mapa, não toque no pino.
 */
const TOQUE_MS = 120
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx — a conta de câmera tem de ser a mesma. */
const FIT_MARGIN = 24
const DESCRICAO = 'Porta de ferro enferrujada com uma marca de garra funda'

/** Nome de pino: a barra pode chamar de "Pino" ou "Ponto de interesse"; os dois servem. */
const NOME_DA_FERRAMENTA = /pino|ponto de interesse/i
/** Metade da aresta do recorte que fotografa "tem pino aqui?" — a gota tem 34 px de mundo. */
const RAIO_DO_RECORTE = 40
/** Janela estreita da terceira prova: celular em pé, o caso que o `@media` do player cobre. */
const JANELA_ESTREITA = { width: 400, height: 800 }

interface PontoDoMundo {
  x: number
  y: number
}

interface Ponto {
  x: number
  y: number
}

/** Toque de pessoa: desce, fica parado um instante, sobe. */
async function tocarComoPessoa(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/**
 * Arrasto de pessoa: pega, espera o gesto "pegar" registrar, caminha em passos
 * (ninguém teleporta o mouse), PARA em cima do destino e só então solta. A
 * pausa final é o que separa "arrastei até aqui" de "passei correndo por aqui".
 */
async function arrastarComoPessoa(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.move((de.x + para.x) / 2, (de.y + para.y) / 2, { steps: 10 })
  await page.mouse.move(para.x, para.y, { steps: 10 })
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Todo nome acessível de controle na tela — só para a mensagem de falha ajudar quem implementa. */
async function nomesDeControleNaTela(page: Page): Promise<string[]> {
  return page
    .locator('button, [role="radio"], [role="menuitemradio"], [role="checkbox"], input[type="checkbox"], [role="tab"]')
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => elemento.getAttribute('aria-label') ?? elemento.textContent?.trim() ?? '')
        .filter((nome) => nome !== ''),
    )
}

/**
 * Um controle com este nome acessível, em qualquer papel plausível (a barra usa
 * `button` com `aria-label`, o painel de ferramenta usa `radio`, os toggles do
 * painel usam `checkbox`). Falha dizendo o que EXISTE hoje na tela.
 */
async function controlePorNome(page: Page, nome: RegExp | string, oQueEra: string): Promise<Locator> {
  const alvo = page
    .getByRole('button', { name: nome })
    .or(page.getByRole('radio', { name: nome }))
    .or(page.getByRole('menuitemradio', { name: nome }))
    .or(page.getByRole('checkbox', { name: nome }))
    .or(page.getByRole('tab', { name: nome }))
  const quantos = await alvo.count()
  if (quantos === 0) {
    const existentes = await nomesDeControleNaTela(page)
    expect(
      quantos,
      `${oQueEra}: nenhum controle com nome ${String(nome)} na tela. O que a tela oferece hoje: ${existentes.join(' | ')}`,
    ).toBeGreaterThan(0)
  }
  return alvo.first()
}

/**
 * O interruptor do painel do mestre. A caixinha real (`input[type=checkbox]`)
 * tem `pointer-events: none` (main.css:433-440): quem recebe o clique é o
 * TRILHO, então é nele que o ponteiro bate — mesmo padrão de
 * `task-jornada-teto-de-construcao.spec.ts:479-491`.
 */
function interruptor(page: Page, rotulo: string): Locator {
  return page.locator('label.lb-switch').filter({ hasText: rotulo })
}

/** Clique de ponteiro no trilho. Falha dizendo o que a tela oferece hoje. */
async function clicarInterruptor(page: Page, rotulo: string, oQueEra: string): Promise<void> {
  const alvo = interruptor(page, rotulo)
  if ((await alvo.count()) === 0) {
    const existentes = await nomesDeControleNaTela(page)
    expect(
      await alvo.count(),
      `${oQueEra}: nenhum interruptor "${rotulo}" na tela. O que a tela oferece hoje: ${existentes.join(' | ')}`,
    ).toBeGreaterThan(0)
  }
  await alvo.locator('.lb-switch__track').click()
}

/** Caixa do `<canvas>` do editor, que ocupa a janela inteira (painéis flutuam por cima). */
async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

function recorteAoRedor(ponto: Ponto): { x: number; y: number; width: number; height: number } {
  return { x: ponto.x - RAIO_DO_RECORTE, y: ponto.y - RAIO_DO_RECORTE, width: RAIO_DO_RECORTE * 2, height: RAIO_DO_RECORTE * 2 }
}

/** LEITURA da store, nunca escrita: é só para descobrir onde o gesto pôs o pino. */
async function lerMapa(page: Page): Promise<MapData> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map
  })
}

/**
 * Procura, em qualquer canto do mapa, o objeto que carrega `texto` em algum
 * campo e tem `x`/`y` numéricos — o pino que o mestre acabou de descrever, sem
 * esta jornada ditar o nome do campo no schema.
 */
function acharObjetoComTexto(valor: unknown, texto: string): PontoDoMundo | null {
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const achado = acharObjetoComTexto(item, texto)
      if (achado !== null) return achado
    }
    return null
  }
  if (typeof valor !== 'object' || valor === null) return null
  const registro = valor as Record<string, unknown>
  const carregaOTexto = Object.values(registro).some((v) => typeof v === 'string' && v.includes(texto))
  if (carregaOTexto && typeof registro.x === 'number' && typeof registro.y === 'number') {
    return { x: registro.x, y: registro.y }
  }
  for (const v of Object.values(registro)) {
    const achado = acharObjetoComTexto(v, texto)
    if (achado !== null) return achado
  }
  return null
}

/** Ponto de mundo → ponto de tela do jogador, pela MESMA conta de câmera do PlayerView. */
async function pontoNaTelaDoJogador(jogador: Page, mundo: PontoDoMundo, largura: number, altura: number): Promise<Ponto> {
  return jogador.evaluate(
    async ({ mundo, largura, altura, margem }) => {
      const mod = await import('/src/pixi/world.ts')
      const camera = mod.fitCamera({ minX: 0, minY: 0, maxX: largura, maxY: altura }, { width: window.innerWidth, height: window.innerHeight }, margem)
      return { x: Math.round(mundo.x * camera.scale + camera.x), y: Math.round(mundo.y * camera.scale + camera.y) }
    },
    { mundo, largura, altura, margem: FIT_MARGIN },
  )
}

/** Crava um pino com a ferramenta da barra, no ponto de tela pedido. */
async function mestreCravaPino(page: Page, ondeNoCanvas: Ponto): Promise<void> {
  const ferramenta = await controlePorNome(page, NOME_DA_FERRAMENTA, 'ferramenta de pino na barra do mestre')
  await ferramenta.click()
  await tocarComoPessoa(page, ondeNoCanvas.x, ondeNoCanvas.y)
}

/**
 * Controle negativo obrigatório: parada, a tela do mestre é estável. Sem isto,
 * "mudou depois do gesto" não provaria que foi o gesto.
 */
// O tsconfig das jornadas não carrega os tipos do Node, e `Buffer` só existe
// como valor aqui. O tipo vem do próprio Playwright, que é quem devolve a foto.
type Foto = Awaited<ReturnType<Page['screenshot']>>

async function telaEstavel(page: Page, recorte: ReturnType<typeof recorteAoRedor>): Promise<Foto> {
  await page.waitForTimeout(PINTURA_MS)
  const primeira = await page.screenshot({ clip: recorte })
  await page.waitForTimeout(PINTURA_MS)
  const segunda = await page.screenshot({ clip: recorte })
  expect(primeira.equals(segunda), 'a tela do mestre muda sozinha parada: nenhuma foto antes/depois provaria o gesto').toBe(true)
  return segunda
}

test('1. o mestre arrasta um pino já colocado e ele vai para o lugar novo; um Ctrl+Z traz de volta', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)

  const caixa = await caixaDoCanvas(page)
  // Longe do painel da esquerda e longe um do outro: os dois recortes de 80 px
  // não podem se tocar, senão "sumiu de lá" e "apareceu aqui" viram a mesma foto.
  const origem = { x: caixa.x + 560, y: caixa.y + 300 }
  const destino = { x: caixa.x + 860, y: caixa.y + 470 }

  await mestreCravaPino(page, origem)
  // Selecionar é a ferramenta com que a pessoa mexe no que já existe.
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()
  await tocarComoPessoa(page, origem.x, origem.y)

  const origemAntes = await telaEstavel(page, recorteAoRedor(origem))
  const destinoAntes = await telaEstavel(page, recorteAoRedor(destino))

  await arrastarComoPessoa(page, origem, destino)
  await page.waitForTimeout(PINTURA_MS)

  const origemDepois = await page.screenshot({ clip: recorteAoRedor(origem) })
  const destinoDepois = await page.screenshot({ clip: recorteAoRedor(destino) })
  expect(
    origemDepois.equals(origemAntes),
    'o pino continua desenhado onde estava depois do arrasto: arrastar não moveu nada',
  ).toBe(false)
  expect(
    destinoDepois.equals(destinoAntes),
    'nada foi desenhado onde o pino foi solto: o arrasto não levou o pino para o lugar novo',
  ).toBe(false)

  // Um gesto = um desfazer. Se cada pointermove virasse uma entrada de
  // histórico, um Ctrl+Z só deixaria o pino no meio do caminho.
  await page.keyboard.press('Control+z')
  await expect
    .poll(async () => (await page.screenshot({ clip: recorteAoRedor(origem) })).equals(origemAntes), {
      timeout: 10_000,
      intervals: [200, 400, 400, 1000, 1000, 2000],
    })
    .toBe(true)
  const destinoDesfeito = await page.screenshot({ clip: recorteAoRedor(destino) })
  expect(destinoDesfeito.equals(destinoAntes), 'o Ctrl+Z trouxe o pino de volta mas deixou uma cópia no destino').toBe(true)

  expect(erros, 'a tela do mestre jogou erro ao arrastar o pino').toEqual([])
})

test('2. pino travado não sai do lugar quando arrastado, mas continua clicável e selecionável', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)

  const caixa = await caixaDoCanvas(page)
  const origem = { x: caixa.x + 560, y: caixa.y + 300 }
  const destino = { x: caixa.x + 860, y: caixa.y + 470 }

  await mestreCravaPino(page, origem)
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()
  await tocarComoPessoa(page, origem.x, origem.y)

  await clicarInterruptor(page, 'Travado', 'interruptor "Travado" no painel do ponto de interesse')
  await expect(
    interruptor(page, 'Travado').locator('input'),
    'o interruptor "Travado" do pino não ficou ligado depois do clique',
  ).toBeChecked()

  const origemAntes = await telaEstavel(page, recorteAoRedor(origem))
  const destinoAntes = await telaEstavel(page, recorteAoRedor(destino))

  await arrastarComoPessoa(page, origem, destino)
  await page.waitForTimeout(PINTURA_MS)

  const origemDepois = await page.screenshot({ clip: recorteAoRedor(origem) })
  const destinoDepois = await page.screenshot({ clip: recorteAoRedor(destino) })
  expect(origemDepois.equals(origemAntes), 'o pino TRAVADO saiu do lugar: travar deixou de significar alguma coisa').toBe(true)
  expect(destinoDepois.equals(destinoAntes), 'apareceu desenho onde o pino travado foi solto: ele se moveu mesmo travado').toBe(true)

  // Travado continua CLICÁVEL — é o único caminho de volta para o interruptor
  // que o destrava. Some do hit-test e o pino fica preso para sempre.
  await tocarComoPessoa(page, caixa.x + 380, caixa.y + 700)
  await tocarComoPessoa(page, origem.x, origem.y)
  await expect(
    page.getByRole('heading', { name: NOME_DA_FERRAMENTA }),
    'depois de travado o pino sumiu do clique: não há como reabrir o painel para destravar',
  ).toBeVisible({ timeout: 5000 })
  await expect(page.getByLabel(/descri/i), 'o painel reabriu sem os campos do pino: não é o pino que foi selecionado').toBeVisible()

  expect(erros, 'a tela do mestre jogou erro no arrasto do pino travado').toEqual([])
})

test('3. na tela do jogador o cartão do pino abre à direita, sem tapar o centro; em janela estreita ocupa a largura', async ({ page, context }) => {
  test.setTimeout(180_000)
  const errosDoJogador: string[] = []

  // --- Mestre monta a cena com gesto de verdade -----------------------------
  await enterEditor(page)

  await page.getByRole('button', { name: 'Adicionar token' }).click()
  const nomeDoToken = page.getByLabel('Nome do novo token')
  await nomeDoToken.click()
  await nomeDoToken.pressSequentially('Heroi', { delay: 15 })
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' }), 'o token do jogador não foi criado').toBeVisible()

  const caixa = await caixaDoCanvas(page)
  // À ESQUERDA do centro de propósito: o cartão vai nascer à direita, e o teste
  // mede que ele não cobre o ponto que o jogador acabou de tocar.
  const alvo = { x: caixa.x + 470, y: caixa.y + 300 }
  await mestreCravaPino(page, alvo)
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()
  await tocarComoPessoa(page, alvo.x, alvo.y)
  const campo = page.getByLabel(/descri/i)
  await expect(campo, 'o painel do pino não tem campo de descrição').toBeVisible({ timeout: 5000 })
  await campo.click()
  await campo.pressSequentially(DESCRICAO, { delay: 15 })
  await expect(campo, 'a descrição digitada não ficou no campo').toHaveValue(DESCRICAO)

  const mapa = await lerMapa(page)
  const pinoNoMundo = acharObjetoComTexto(mapa, DESCRICAO)
  expect(pinoNoMundo, 'o mapa do mestre não tem objeto com a descrição digitada e x/y: o pino não existe no mapa que vai para o jogador').not.toBeNull()
  if (pinoNoMundo === null) return
  const token = mapa.tokens[0]
  expect(token, 'o mapa do mestre saiu sem token: o jogador entraria sem nada para ver').toBeTruthy()

  // --- Jogador entra pela página dele, com o host REAL do outro lado --------
  const session = createHostSession({
    code: CODE,
    visionRadius: 2000,
    randomId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  let socket: WebSocketRoute | null = null
  let playerId: string | null = null
  const despachar = (saidas: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of saidas) {
      if (clientId !== 'c1' || socket === null) continue
      socket.send(JSON.stringify(msg))
      if (msg.type === 'welcome') playerId = msg.playerId
    }
  }

  const jogador = await context.newPage()
  jogador.on('pageerror', (e) => errosDoJogador.push(e.message))
  await jogador.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      socket = ws
      ws.onMessage((raw) => {
        const texto = typeof raw === 'string' ? raw : raw.toString('utf8')
        despachar(session.handleMessage('c1', texto, mapa).outbound)
      })
    },
  )

  await jogador.goto('/player.html')
  const codigo = jogador.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODE, { delay: 20 })
  const nome = jogador.getByLabel('Seu nome')
  await nome.click()
  await nome.pressSequentially('Ana', { delay: 20 })
  await jogador.getByRole('button', { name: 'Entrar' }).click()
  await expect(jogador.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  expect(playerId, 'o jogador entrou mas não recebeu welcome').not.toBeNull()
  if (playerId === null) return

  session.assignToken(playerId, token.id)
  despachar(session.broadcast(mapa).outbound)
  const vista = jogador.locator('[data-explored-cells]')
  await expect(vista, 'o mapa do mestre não chegou na tela do jogador').toHaveAttribute('data-tokens-count', '1', { timeout: 10_000 })
  await jogador.waitForTimeout(PINTURA_MS)

  const noPino = await pontoNaTelaDoJogador(jogador, pinoNoMundo, mapa.width * mapa.grid, mapa.height * mapa.grid)
  expect(noPino.x, 'o pino caiu embaixo do painel da esquerda do jogador: o toque não chegaria no canvas').toBeGreaterThan(300)

  await tocarComoPessoa(jogador, noPino.x, noPino.y)
  const cartao = jogador.getByRole('dialog')
  await expect(cartao, 'tocar o pino não abriu cartão nenhum na tela do jogador').toBeVisible({ timeout: 8000 })

  // --- "aparece do lado direito", medido contra a janela --------------------
  const janela = jogador.viewportSize()
  expect(janela, 'a janela do jogador não tem tamanho: não dá para medir onde o cartão caiu').not.toBeNull()
  if (janela === null) return
  const caixaDoCartao = await cartao.boundingBox()
  expect(caixaDoCartao, 'o cartão está no DOM mas não ocupa espaço na tela').not.toBeNull()
  if (caixaDoCartao === null) return

  expect(
    caixaDoCartao.x,
    `o cartão começa em x=${Math.round(caixaDoCartao.x)} numa janela de ${janela.width}px: ele não está na metade direita, está no meio da tela`,
  ).toBeGreaterThanOrEqual(janela.width / 2)
  expect(
    caixaDoCartao.x + caixaDoCartao.width,
    'o cartão passa da borda direita da janela: parte dele fica fora da tela',
  ).toBeLessThanOrEqual(janela.width + 1)
  // Encostado à direita é para deixar o mapa à vista: o centro da janela não
  // pode estar debaixo do cartão.
  expect(
    caixaDoCartao.x,
    'o cartão cobre o centro da janela: continua tapando o mapa, que é o que o usuário pediu para parar de acontecer',
  ).toBeGreaterThan(janela.width / 2)
  // E não pode comer o mapa inteiro: "um pequeno lugar", não meia tela e mais.
  expect(
    caixaDoCartao.width,
    'o cartão ocupa metade ou mais da janela larga: não é o "pequeno lugar" do lado direito',
  ).toBeLessThan(janela.width / 2)
  // O ponto que o jogador tocou continua visível.
  expect(
    noPino.x,
    'o cartão abriu EM CIMA do pino que o jogador tocou',
  ).toBeLessThan(caixaDoCartao.x)

  // --- Janela estreita: volta a ocupar a largura ----------------------------
  await jogador.setViewportSize(JANELA_ESTREITA)
  await jogador.waitForTimeout(PINTURA_MS)
  await expect(cartao, 'o cartão sumiu ao estreitar a janela').toBeVisible()
  const caixaEstreita = await cartao.boundingBox()
  expect(caixaEstreita, 'o cartão não ocupa espaço na janela estreita').not.toBeNull()
  if (caixaEstreita === null) return
  expect(
    caixaEstreita.width,
    `numa janela de ${JANELA_ESTREITA.width}px o cartão ficou com ${Math.round(caixaEstreita.width)}px: encostado à direita virou uma tira ilegível`,
  ).toBeGreaterThan(JANELA_ESTREITA.width * 0.8)
  await expect(
    cartao.getByText(DESCRICAO),
    'a descrição sumiu da tela estreita: o cartão estreito deixou de ser legível',
  ).toBeVisible()

  expect(errosDoJogador, 'a tela do jogador jogou erro durante a jornada do cartão à direita').toEqual([])
})
