// JORNADA DOS PINOS DE PONTO DE INTERESSE — escrita para SAIR VERMELHA hoje.
//
// Pedido do usuário, nas palavras dele: "dois pinos um com exclamação e outro
// com interrogação, que seriam ponto de interesse e quando o jogador clicasse
// na parte lateral dele iria abrir o que seria o pino poderia abrir a imagem
// de uma cenário ou um item e embaixo a descrição".
//
// Traduzido em comportamento observável, que é o que esta jornada cobra:
//   1. o mestre escolhe a ferramenta de Pino, clica no mapa e o desenho do
//      pino "!" aparece ONDE ele clicou (e não aparece longe dali);
//   2. trocando o tipo para "?", o desenho no MESMO ponto sai diferente — os
//      dois tipos se distinguem na tela, não só no dado;
//   3. o painel do pino selecionado aceita descrição digitada e oferece o
//      controle de imagem;
//   4. o JOGADOR toca o pino e abre um cartão com a imagem EM CIMA e a
//      descrição EMBAIXO; Escape fecha e tocar fora fecha.
//
// COMO ELA PROVA. Gesto de ponteiro e de teclado de verdade (nada de
// `dispatchEvent`, nada de escrever na store para chegar no que se prova) e
// asserção no que aparece: pixel do canvas no lado do mestre, elemento
// visível e posição de caixa no lado do jogador. A store aparece uma vez só,
// em LEITURA, para descobrir onde no mundo o pino ficou — o mapa entregue ao
// jogador é o que o gesto do mestre produziu, e viaja pela sessão REAL do
// host (`src/net/hostSession.ts`) por cima de `routeWebSocket`, sem transporte
// inventado dentro da página.
//
// O nome do campo do pino no schema NÃO é imposto aqui: a jornada acha o pino
// procurando, no mapa, o objeto que carrega a descrição digitada e tem x/y
// (`acharObjetoComTexto`). Quem implementar escolhe o schema.
//
// O QUE ESTA JORNADA NÃO PROVA, de propósito (ver relatório):
//   - que os BYTES da imagem cheguem ao jogador. Escolher imagem passa pelo
//     seletor de arquivo do sistema (`lib/imageImport.ts` exige `isTauri()`),
//     que não existe no navegador do Playwright, e caminho de arquivo local
//     não sai para o jogador hoje (`lib/fogFilter.ts`). O teste 3 cobra o
//     CONTROLE de imagem na tela; o teste 4 cobra a ÁREA de imagem do cartão,
//     visível e acima da descrição. Fabricar o disco do Tauri para "ver" a
//     imagem provaria o stub, não o app.
import { test, expect, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import type { HostMessage } from '../src/net/protocol'
import type { MapData } from '../src/types/map'
import { enterEditor } from './helpers/enterEditor'

const CODE = 'PINO01'
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
const DESCRICAO = 'Estatua de marmore rachada com uma moeda no pedestal'

/** Nome de pino: a barra pode chamar de "Pino" ou "Ponto de interesse"; os dois servem. */
const NOME_DA_FERRAMENTA = /pino|ponto de interesse/i
const NOME_TIPO_EXCLAMACAO = /exclama|!/i
const NOME_TIPO_INTERROGACAO = /interroga|\?/i

interface PontoDoMundo {
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

/** Todo nome acessível de controle na tela — só para a mensagem de falha ajudar quem implementa. */
async function nomesDeControleNaTela(page: Page): Promise<string[]> {
  return page
    .locator('button, [role="radio"], [role="menuitemradio"], [role="checkbox"], [role="tab"]')
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => elemento.getAttribute('aria-label') ?? elemento.textContent?.trim() ?? '')
        .filter((nome) => nome !== ''),
    )
}

/**
 * Um controle com este nome acessível, em qualquer papel plausível (a barra usa
 * `button` com `aria-label`, o painel de ferramenta usa `radio` — ver
 * task-door-kinds.spec.ts). Falha dizendo o que EXISTE hoje na tela.
 */
async function controlePorNome(page: Page, nome: RegExp, oQueEra: string): Promise<Locator> {
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

/** Caixa do `<canvas>` do editor, que ocupa a janela inteira (painéis flutuam por cima). */
async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

function recorteAoRedor(ponto: { x: number; y: number }): { x: number; y: number; width: number; height: number } {
  return { x: ponto.x - 40, y: ponto.y - 40, width: 80, height: 80 }
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
 * campo e tem `x`/`y` numéricos — o pino que o mestre acabou de criar e
 * descrever, sem esta jornada ditar o nome do campo no schema.
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
async function pontoNaTelaDoJogador(jogador: Page, mundo: PontoDoMundo, largura: number, altura: number): Promise<{ x: number; y: number }> {
  return jogador.evaluate(
    async ({ mundo, largura, altura, margem }) => {
      const mod = await import('/src/pixi/world.ts')
      const camera = mod.fitCamera({ minX: 0, minY: 0, maxX: largura, maxY: altura }, { width: window.innerWidth, height: window.innerHeight }, margem)
      return { x: Math.round(mundo.x * camera.scale + camera.x), y: Math.round(mundo.y * camera.scale + camera.y) }
    },
    { mundo, largura, altura, margem: FIT_MARGIN },
  )
}

/** Cria o pino pelo gesto da barra e devolve o ponto de tela onde ele foi cravado. */
async function mestreCravaPino(page: Page, ondeNoCanvas: { x: number; y: number }): Promise<void> {
  const ferramenta = await controlePorNome(page, NOME_DA_FERRAMENTA, 'ferramenta de pino na barra do mestre')
  await ferramenta.click()
  await tocarComoPessoa(page, ondeNoCanvas.x, ondeNoCanvas.y)
}

test('1. o mestre escolhe a ferramenta de Pino, clica no mapa e o pino aparece onde ele clicou', async ({ page }) => {
  test.setTimeout(90_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  // Ferramenta escolhida ANTES da primeira foto: se o painel da ferramenta
  // mexer no canvas, ele já mexeu, e as duas fotos medem o mesmo retângulo.
  const ferramenta = await controlePorNome(page, NOME_DA_FERRAMENTA, 'ferramenta de pino na barra do mestre')
  await ferramenta.click()

  const caixa = await caixaDoCanvas(page)
  const alvo = { x: caixa.x + 560, y: caixa.y + 360 }
  const longe = { x: caixa.x + 980, y: caixa.y + 620 }

  await page.waitForTimeout(PINTURA_MS)
  const antes = await page.screenshot({ clip: recorteAoRedor(alvo) })
  const longeAntes = await page.screenshot({ clip: recorteAoRedor(longe) })
  await page.waitForTimeout(PINTURA_MS)
  const aindaAntes = await page.screenshot({ clip: recorteAoRedor(alvo) })
  // Controle negativo: parada, a tela é estável. Sem isto, "mudou depois do
  // clique" não provaria que foi o clique.
  expect(antes.equals(aindaAntes), 'a tela do mestre muda sozinha parada: nenhuma foto antes/depois provaria o gesto').toBe(true)

  await tocarComoPessoa(page, alvo.x, alvo.y)
  await page.waitForTimeout(PINTURA_MS)

  const depois = await page.screenshot({ clip: recorteAoRedor(alvo) })
  expect(depois.equals(antes), 'o clique com a ferramenta de Pino não desenhou nada onde o mestre clicou').toBe(false)

  // Controle positivo do outro lado: o pino ficou ONDE ele clicou, não pela tela toda.
  const longeDepois = await page.screenshot({ clip: recorteAoRedor(longe) })
  expect(longeDepois.equals(longeAntes), 'a tela mudou longe do clique também: o desenho não está preso ao ponto clicado').toBe(true)

  expect(erros, 'a tela do mestre jogou erro ao criar o pino').toEqual([])
})

test('2. trocando o tipo para "?" o desenho muda: os dois pinos se distinguem na tela', async ({ page }) => {
  test.setTimeout(90_000)
  await enterEditor(page)

  const ferramenta = await controlePorNome(page, NOME_DA_FERRAMENTA, 'ferramenta de pino na barra do mestre')
  await ferramenta.click()

  const caixa = await caixaDoCanvas(page)
  const alvo = { x: caixa.x + 560, y: caixa.y + 360 }
  const recorte = recorteAoRedor(alvo)

  await page.waitForTimeout(PINTURA_MS)
  const vazio = await page.screenshot({ clip: recorte })

  // Pino "!" no ponto.
  const tipoExclamacao = await controlePorNome(page, NOME_TIPO_EXCLAMACAO, 'tipo de pino "!" (exclamação)')
  await tipoExclamacao.click()
  await tocarComoPessoa(page, alvo.x, alvo.y)
  await page.waitForTimeout(PINTURA_MS)
  const comExclamacao = await page.screenshot({ clip: recorte })
  expect(comExclamacao.equals(vazio), 'o pino "!" não desenhou nada no ponto clicado').toBe(false)

  // Desfaz pelo teclado, como a pessoa faria, para o "?" nascer no MESMO ponto,
  // sobre o MESMO fundo — assim a diferença entre as duas fotos só pode ser o desenho.
  await page.keyboard.press('Control+z')
  await expect
    .poll(async () => (await page.screenshot({ clip: recorte })).equals(vazio), { timeout: 10_000, intervals: [200, 400, 400, 1000, 1000, 2000] })
    .toBe(true)

  const tipoInterrogacao = await controlePorNome(page, NOME_TIPO_INTERROGACAO, 'tipo de pino "?" (interrogação)')
  await tipoInterrogacao.click()
  await tocarComoPessoa(page, alvo.x, alvo.y)
  await page.waitForTimeout(PINTURA_MS)
  const comInterrogacao = await page.screenshot({ clip: recorte })
  expect(comInterrogacao.equals(vazio), 'o pino "?" não desenhou nada no ponto clicado').toBe(false)
  expect(
    comInterrogacao.equals(comExclamacao),
    'o pino "?" desenha exatamente igual ao "!": na tela do jogador os dois tipos seriam o mesmo pino',
  ).toBe(false)
})

test('3. o mestre põe descrição no pino pelo painel, e o painel oferece a imagem', async ({ page }) => {
  test.setTimeout(90_000)
  await enterEditor(page)

  const caixa = await caixaDoCanvas(page)
  const alvo = { x: caixa.x + 560, y: caixa.y + 360 }
  await mestreCravaPino(page, alvo)

  // Volta para Selecionar e toca o pino: é assim que a pessoa reabre o painel
  // de um item já criado (mesmo gesto de task-conceal-zone.spec.ts).
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()
  await tocarComoPessoa(page, alvo.x, alvo.y)

  const painel = page.getByRole('heading', { name: NOME_DA_FERRAMENTA })
  await expect(painel, 'tocar o pino com Selecionar não abriu painel nenhum para ele').toBeVisible({ timeout: 5000 })

  // Descrição digitada tecla a tecla, como o dedo do mestre.
  const campo = page.getByLabel(/descri/i)
  await expect(campo, 'o painel do pino não tem campo de descrição').toBeVisible({ timeout: 5000 })
  await campo.click()
  await campo.pressSequentially(DESCRICAO, { delay: 15 })
  await expect(campo, 'a descrição digitada não ficou no campo').toHaveValue(DESCRICAO)

  // O controle de imagem tem de existir e estar alcançável no painel DO PINO.
  // Abrir o seletor de arquivo do sistema não dá para dirigir no navegador
  // (lib/imageImport.ts exige isTauri()), então a jornada para aqui de propósito.
  const imagem = await controlePorNome(page, /imagem/i, 'controle de imagem do pino')
  await expect(imagem, 'o painel do pino não oferece escolher imagem').toBeVisible()
})

test('4. o jogador toca o pino e abre o cartão com imagem em cima e descrição embaixo; Escape e toque fora fecham', async ({ page, context }) => {
  test.setTimeout(180_000)
  const errosDoJogador: string[] = []

  // --- Mestre monta a cena com gesto de verdade -----------------------------
  await enterEditor(page)

  // Token do jogador: o mesmo caminho de tela que o mestre usa (painel Seleção).
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  const nomeDoToken = page.getByLabel('Nome do novo token')
  await nomeDoToken.click()
  await nomeDoToken.pressSequentially('Heroi', { delay: 15 })
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' }), 'o token do jogador não foi criado').toBeVisible()

  const caixa = await caixaDoCanvas(page)
  // Longe do centro (onde o token nasce) e longe do painel da esquerda.
  const alvo = { x: caixa.x + 860, y: caixa.y + 260 }
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
  expect(pinoNoMundo, 'o mapa do mestre não tem nenhum objeto com a descrição digitada e coordenada x/y: o pino não existe no mapa que vai para o jogador').not.toBeNull()
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
  // Encanamento: o mapa chegou e o jogador está vendo o próprio token.
  await expect(vista, 'o mapa do mestre não chegou na tela do jogador').toHaveAttribute('data-tokens-count', '1', { timeout: 10_000 })
  await jogador.waitForTimeout(PINTURA_MS)

  const noPino = await pontoNaTelaDoJogador(jogador, pinoNoMundo, mapa.width * mapa.grid, mapa.height * mapa.grid)
  expect(noPino.x, 'o pino caiu embaixo do painel da esquerda do jogador: o toque não chegaria no canvas').toBeGreaterThan(300)

  // --- O toque que o usuário descreveu -------------------------------------
  await tocarComoPessoa(jogador, noPino.x, noPino.y)

  const cartao = jogador.getByRole('dialog')
  await expect(cartao, 'tocar o pino não abriu cartão nenhum na tela do jogador').toBeVisible({ timeout: 8000 })

  const descricaoNoCartao = cartao.getByText(DESCRICAO)
  await expect(descricaoNoCartao, 'o cartão abriu sem a descrição que o mestre escreveu').toBeVisible()
  const imagemNoCartao = cartao.getByRole('img').first()
  await expect(imagemNoCartao, 'o cartão abriu sem área de imagem do cenário/item').toBeVisible()

  const caixaDaImagem = await imagemNoCartao.boundingBox()
  const caixaDaDescricao = await descricaoNoCartao.boundingBox()
  expect(caixaDaImagem, 'a imagem do cartão não ocupa espaço na tela').not.toBeNull()
  expect(caixaDaDescricao, 'a descrição do cartão não ocupa espaço na tela').not.toBeNull()
  if (caixaDaImagem === null || caixaDaDescricao === null) return
  expect(caixaDaImagem.height, 'a área de imagem tem altura zero: está no DOM mas não na tela').toBeGreaterThan(0)
  // "embaixo a descrição": a imagem termina antes de a descrição começar.
  expect(
    caixaDaImagem.y + caixaDaImagem.height,
    'a descrição não está EMBAIXO da imagem, como o usuário pediu',
  ).toBeLessThanOrEqual(caixaDaDescricao.y + 1)

  // --- Fechar: Escape e toque fora -----------------------------------------
  await jogador.keyboard.press('Escape')
  await expect(cartao, 'Escape não fechou o cartão').toBeHidden({ timeout: 5000 })

  await tocarComoPessoa(jogador, noPino.x, noPino.y)
  await expect(cartao, 'o cartão não reabriu no segundo toque').toBeVisible({ timeout: 8000 })
  // Canto vazio, longe do pino e do painel da esquerda.
  await tocarComoPessoa(jogador, noPino.x, Math.min(noPino.y + 320, 780))
  await expect(cartao, 'tocar fora do cartão não o fechou').toBeHidden({ timeout: 5000 })

  expect(errosDoJogador, 'a tela do jogador jogou erro durante a jornada do pino').toEqual([])
})
