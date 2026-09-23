// Jornada da TELA DE ENTRADA DO JOGADOR — escrita para SAIR VERMELHA no código
// de hoje (17/09/2026). Dor nas palavras do usuário: "quando um jogador vai
// entrar é simplismente um tela branca feia, se é para fazer um site que seja
// belo."
//
// Quatro provas, todas medidas na TELA (pixel de screenshot ou texto visível):
//
//  1. SEM JAVASCRIPT o fundo é branco. `player.html` entrega só
//     `<div id="root">`; TODO o tema (inclusive `body { background }`) é string
//     injetada em runtime por `src/player/main.tsx:18-21`. Script que não
//     carrega — 3G do celular do amigo, extensão que bloqueia módulo, bundle
//     quebrado — deixa a folha branca de fábrica. `player.css` não tem regra
//     para `html` nem para `body`.
//
//  2. A REDE DE SEGURANÇA NÃO É DO PRODUTO. `src/player/ErrorBoundary.tsx`
//     existe exatamente para não virar página branca, mas ela mesma é sem tema:
//     `boxStyle` = `system-ui`, sem fundo, sem cor; dois `<button>` cinza de
//     fábrica.
//
//  3. "Conectando…" NÃO TEM PRAZO. `main.tsx:644` mostra o texto e
//     `playerConnection.ts` só sai desse estado quando o socket abre, fecha ou
//     dá erro. Servidor que aceita a conexão e nunca responde (mestre travado,
//     porta errada, portal cativo do hotel) deixa a tela parada para sempre.
//
//  4. A TELA DE ENTRADA É UM FORMULÁRIO SOLTO. Cartão centrado sobre um retângulo
//     chapado de #121214 — nenhuma tinta fora do cartão, uma cor de marca só.
//
// REGRAS DE JORNADA seguidas aqui: gesto de verdade (clique e tecla), asserção
// no que aparece na tela, nada de escrever na store. O lado do mestre é a sessão
// REAL de produção (`src/net/hostSession.ts`) atrás de `routeWebSocket`, mesmo
// padrão de `task-player-page.spec.ts`.
//
// COMO A PROVA 2 É PROVOCADA (declarado por honestidade): o navegador é posto
// numa condição de máquina real — falha de alocação de bitmap. `ImageData` é
// embrulhado por `addInitScript` e passa a lançar `RangeError` quando a jornada
// arma a flag. É o que um celular com pouca memória faz ao redesenhar um mapa
// em "render fiel" (raster): `PlayerView.tsx:136` constrói um `ImageData` do
// tamanho do mapa inteiro a cada mudança de chão. O primeiro desenho passa; o
// segundo — quando o mestre mexe no mapa — estoura DENTRO do efeito síncrono de
// `PlayerView.tsx:889`, que é justamente o caminho que o PlayerErrorBoundary
// promete cobrir. Nenhum estado é escrito na página; só a memória é feita
// escassa.
import { test, expect, type Page } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, Token } from '../src/types/map'

test.use({ trace: 'off', video: 'off' })

// O endereco sai do baseURL do playwright.config deste checkout, nunca fixo: com porta
// escrita na mao a prova mediria o servidor de OUTRA arvore, e a correcao feita aqui
// nunca chegaria na porta medida (falso-vermelho eterno, e falso-verde no sentido oposto).
const enderecoJogador = (): string =>
  new URL('/player.html', test.info().project.use.baseURL ?? 'http://localhost:1440').toString()
const TELA = { width: 1280, height: 800 }
const CODIGO = 'ABC123'
const GRADE = 50
const CELULAS_X = 20
const CELULAS_Y = 12
const MUNDO_W = CELULAS_X * GRADE
const MUNDO_H = CELULAS_Y * GRADE

/** Fundo do app (`theme.ts` → color.ink). Luminância relativa ≈ 18/255. */
const TINTA_FUNDO = { r: 0x12, g: 0x12, b: 0x14 }
/** Latão do tema (`theme.ts` → color.brass). */
const LATAO = { r: 0xe0, g: 0xa4, b: 0x4a }

/** Teto de luminância média para uma tela ser "escura do tema". #121214 dá ~18. */
const TETO_LUMINANCIA_ESCURA = 60
/** Piso de luminância para uma tela ser "a branca de fábrica". #ffffff dá 255. */
const PISO_LUMINANCIA_CLARA = 200
/** Prazo generoso para "Conectando…" virar explicação. 12s é muito mais que qualquer handshake. */
const PRAZO_CONECTANDO_MS = 12_000
/** Piso de tinta fora do cartão para a tela contar como composta, não como formulário solto. */
const PISO_TINTA_FORA = 0.03
/** Piso de cores de marca distintas na tela de entrada. */
const PISO_FAMILIAS_DE_COR = 2

interface Retangulo {
  x: number
  y: number
  width: number
  height: number
}

interface Medida {
  largura: number
  altura: number
  /** Média da luminância relativa (0-255) de TODOS os pixels. */
  lumMedia: number
  /** Cor mais frequente da imagem — o "fundo" real, medido, não o declarado. */
  corModal: [number, number, number]
  /** Fração de pixels FORA do cartão que diferem da cor modal. 0 = retângulo chapado. */
  fracaoTintaFora: number
  /** Famílias de matiz (faixas de 30°) com presença relevante entre pixels saturados. */
  familiasDeCor: number
  /** Cores amostradas nos pontos pedidos, na ordem pedida. */
  amostras: [number, number, number][]
  /** Maior e menor luminância dentro do recorte pedido (para contraste). */
  lumMaxRecorte: number
  lumMinRecorte: number
}

/**
 * Decodifica o PNG do screenshot numa página auxiliar e devolve só números.
 * Sem pngjs no repo, e a página auxiliar NUNCA é a página do produto: a jornada
 * não injeta nada no app para medi-lo.
 */
async function medirPng(
  analista: Page,
  b64: string,
  opcoes: { cartao?: Retangulo | null; pontos?: { x: number; y: number }[]; recorte?: Retangulo | null } = {},
): Promise<Medida> {
  return analista.evaluate(
    async ({ b64, cartao, pontos, recorte }) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const largura = img.naturalWidth
      const altura = img.naturalHeight
      const tela = document.createElement('canvas')
      tela.width = largura
      tela.height = altura
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('canvas 2d indisponível na página analista')
      ctx.drawImage(img, 0, 0)
      const dados = ctx.getImageData(0, 0, largura, altura).data

      const luminancia = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

      let somaLum = 0
      const contagem = new Map<number, number>()
      const faixas = new Array<number>(12).fill(0)
      let saturados = 0
      const dentro = (x: number, y: number, r: Retangulo | null) =>
        r !== null && x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height

      let fora = 0
      let foraDiferente = 0
      let lumMaxRecorte = -1
      let lumMinRecorte = 256

      for (let y = 0; y < altura; y++) {
        for (let x = 0; x < largura; x++) {
          const i = (y * largura + x) * 4
          const r = dados[i]
          const g = dados[i + 1]
          const b = dados[i + 2]
          const lum = luminancia(r, g, b)
          somaLum += lum
          const chave = (r << 16) | (g << 8) | b
          contagem.set(chave, (contagem.get(chave) ?? 0) + 1)

          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const v = max / 255
          const s = max === 0 ? 0 : (max - min) / max
          if (s > 0.22 && v > 0.12) {
            saturados++
            let h = 0
            if (max === min) h = 0
            else if (max === r) h = (60 * ((g - b) / (max - min)) + 360) % 360
            else if (max === g) h = 60 * ((b - r) / (max - min)) + 120
            else h = 60 * ((r - g) / (max - min)) + 240
            faixas[Math.floor(h / 30) % 12]++
          }

          if (!dentro(x, y, cartao)) fora++
          if (dentro(x, y, recorte)) {
            if (lum > lumMaxRecorte) lumMaxRecorte = lum
            if (lum < lumMinRecorte) lumMinRecorte = lum
          }
        }
      }

      let modalChave = 0
      let modalQtd = -1
      for (const [chave, qtd] of contagem) {
        if (qtd > modalQtd) {
          modalQtd = qtd
          modalChave = chave
        }
      }
      const modal: [number, number, number] = [(modalChave >> 16) & 255, (modalChave >> 8) & 255, modalChave & 255]

      for (let y = 0; y < altura; y++) {
        for (let x = 0; x < largura; x++) {
          if (dentro(x, y, cartao)) continue
          const i = (y * largura + x) * 4
          const difere =
            Math.abs(dados[i] - modal[0]) > 8 || Math.abs(dados[i + 1] - modal[1]) > 8 || Math.abs(dados[i + 2] - modal[2]) > 8
          if (difere) foraDiferente++
        }
      }

      const total = largura * altura
      const pisoFamilia = total * 0.005
      const familiasDeCor = faixas.filter((n) => n >= pisoFamilia).length

      const amostras: [number, number, number][] = pontos.map((p) => {
        const x = Math.max(0, Math.min(largura - 1, Math.round(p.x)))
        const y = Math.max(0, Math.min(altura - 1, Math.round(p.y)))
        const i = (y * largura + x) * 4
        return [dados[i], dados[i + 1], dados[i + 2]]
      })

      return {
        largura,
        altura,
        lumMedia: somaLum / total,
        corModal: modal,
        fracaoTintaFora: fora === 0 ? 0 : foraDiferente / fora,
        familiasDeCor,
        amostras,
        lumMaxRecorte: lumMaxRecorte < 0 ? 0 : lumMaxRecorte,
        lumMinRecorte: lumMinRecorte > 255 ? 0 : lumMinRecorte,
      }
    },
    { b64, cartao: opcoes.cartao ?? null, pontos: opcoes.pontos ?? [], recorte: opcoes.recorte ?? null },
  )
}

/** Distância máxima por canal entre duas cores — "é esta cor do tema?" em pixel. */
function distanciaCor(a: [number, number, number], b: { r: number; g: number; b: number }): number {
  return Math.max(Math.abs(a[0] - b.r), Math.abs(a[1] - b.g), Math.abs(a[2] - b.b))
}

/** Página auxiliar para decodificar PNG e para os controles positivos das réguas. */
async function abrirAnalista(page: Page): Promise<Page> {
  const analista = await page.context().newPage()
  await analista.setViewportSize(TELA)
  await analista.goto('about:blank')
  return analista
}

/** Screenshot -> base64, sem depender de tipos de node no tsconfig.e2e. */
async function retrato(alvo: Page): Promise<string> {
  const png = await alvo.screenshot({ animations: 'disabled' })
  return (png as unknown as { toString(enc: string): string }).toString('base64')
}

function ficha(id: string, nome: string, x: number, y: number): Token {
  return { id, characterId: null, name: nome, x, y, size: 1, image: null }
}

/** Mapa em "render fiel" (raster): é o modo que passa por `ImageData` a cada mudança de chão. */
function mapaRaster(largura: number): MapData {
  const base = createEmptyMap('m-entrada', 'Casa', CELULAS_X, CELULAS_Y, GRADE)
  return {
    ...base,
    floorStyle: { ...base.floorStyle, renderMode: 'raster' },
    floor: [{ id: 'f-chao', shape: { kind: 'rect', cx: MUNDO_W / 2, cy: MUNDO_H / 2, w: largura, h: MUNDO_H - 20 }, op: 'add', modifiers: {} }],
    tokens: [ficha('tok-a', 'Heroi', 250, 300)],
  }
}

// ---------------------------------------------------------------------------
// 1. Fundo nunca branco, mesmo sem JavaScript
// ---------------------------------------------------------------------------
test('o jogador nunca cai numa folha branca: sem JavaScript o fundo continua o escuro do tema', async ({ browser, page }) => {
  const analista = await abrirAnalista(page)

  // CONTROLE POSITIVO da régua de luminância: ela precisa MORDER.
  await analista.setContent('<body style="margin:0;background:#ffffff"></body>')
  const branco = await medirPng(analista, await retrato(analista))
  await analista.setContent('<body style="margin:0;background:#121214"></body>')
  const escuro = await medirPng(analista, await retrato(analista))
  expect(branco.lumMedia, 'controle: folha branca tem de ser reprovada pela régua').toBeGreaterThan(PISO_LUMINANCIA_CLARA)
  expect(escuro.lumMedia, 'controle: o escuro do tema tem de ser aprovado pela régua').toBeLessThanOrEqual(TETO_LUMINANCIA_ESCURA)
  await analista.goto('about:blank')

  // O gesto do usuário: abrir o link do jogador numa máquina onde o módulo não roda.
  const semJs = await browser.newContext({ javaScriptEnabled: false, viewport: TELA })
  const jogador = await semJs.newPage()
  await jogador.goto(enderecoJogador(), { waitUntil: 'load' })
  const medida = await medirPng(analista, await retrato(jogador), {
    pontos: [
      { x: 8, y: 8 },
      { x: TELA.width / 2, y: TELA.height / 2 },
      { x: TELA.width - 8, y: TELA.height - 8 },
    ],
  })
  await semJs.close()

  expect(
    medida.lumMedia,
    `fundo medido no pixel: luminância média ${medida.lumMedia.toFixed(1)}, cor modal rgb(${medida.corModal.join(',')})`,
  ).toBeLessThanOrEqual(TETO_LUMINANCIA_ESCURA)
  for (const [indice, cor] of medida.amostras.entries()) {
    expect(distanciaCor(cor, TINTA_FUNDO), `canto ${indice}: rgb(${cor.join(',')}) deveria ser a tinta do tema`).toBeLessThanOrEqual(24)
  }

  await analista.close()
})

// ---------------------------------------------------------------------------
// 2. A rede de segurança é uma tela do produto
// ---------------------------------------------------------------------------
test('quando o desenho do mapa quebra, o jogador vê uma tela do produto e não os botões cinza do navegador', async ({ page }) => {
  test.setTimeout(90_000)
  const analista = await abrirAnalista(page)

  // CONTROLE POSITIVO da régua de "botão do produto": cinza de fábrica reprova, latão aprova.
  await analista.setContent(
    '<body style="margin:0;background:#121214"><button id="a" style="position:absolute;left:100px;top:100px;width:200px;height:60px;font-size:18px">Recarregar</button>' +
      '<button id="b" style="position:absolute;left:100px;top:300px;width:200px;height:60px;background:#e0a44a;color:#1c1608;border:0;border-radius:9px;font-size:18px">Recarregar</button></body>',
  )
  const controle = await medirPng(analista, await retrato(analista), { pontos: [{ x: 200, y: 130 }, { x: 200, y: 330 }] })
  expect(distanciaCor(controle.amostras[0], LATAO), 'controle: botão de fábrica tem de ser REPROVADO pela régua').toBeGreaterThan(40)
  expect(distanciaCor(controle.amostras[1], LATAO), 'controle: botão de latão tem de ser APROVADO pela régua').toBeLessThanOrEqual(40)
  await analista.goto('about:blank')

  // Máquina com pouca memória: a alocação de bitmap passa a falhar quando a jornada armar.
  await page.addInitScript(() => {
    const Real = window.ImageData
    const Falso = function (this: unknown, ...args: unknown[]) {
      if ((window as unknown as { __lbBitmapEscasso?: boolean }).__lbBitmapEscasso === true) {
        throw new RangeError('Failed to construct ImageData: Out of memory')
      }
      return new (Real as unknown as new (...a: unknown[]) => ImageData)(...args)
    } as unknown as typeof ImageData
    Falso.prototype = Real.prototype
    window.ImageData = Falso
  })

  let mapa = mapaRaster(MUNDO_W - 20)
  const sessao = createHostSession({
    code: CODIGO,
    visionRadius: 2000,
    randomId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  const CLIENTE = 'c1'
  let socket: { send(data: string): void } | null = null
  let playerId: string | null = null
  const despachar = (saidas: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of saidas) {
      if (clientId !== CLIENTE || socket === null) continue
      if (msg.type === 'welcome') playerId = msg.playerId
      socket.send(JSON.stringify(msg))
    }
  }
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      socket = ws
      ws.onMessage((raw) => {
        const texto = typeof raw === 'string' ? raw : raw.toString('utf8')
        despachar(sessao.handleMessage(CLIENTE, texto, mapa).outbound)
      })
    },
  )

  await page.goto('/player.html')
  await page.getByLabel('Código da sala').click()
  await page.getByLabel('Código da sala').pressSequentially(CODIGO, { delay: 20 })
  await page.getByLabel('Seu nome').click()
  await page.getByLabel('Seu nome').pressSequentially('Ana', { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)

  const idJogador: string | null = playerId
  if (idJogador === null) throw new Error('o host nao mandou welcome: sem playerId nao da para atribuir o token')
  sessao.assignToken(idJogador, 'tok-a')
  despachar(sessao.broadcast(mapa).outbound)
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 })

  // A memória acaba, e o mestre mexe no chão: o redesenho síncrono estoura.
  await page.evaluate(() => {
    ;(window as unknown as { __lbBitmapEscasso?: boolean }).__lbBitmapEscasso = true
  })
  mapa = mapaRaster(MUNDO_W - 120)
  despachar(sessao.broadcast(mapa).outbound)

  const aviso = page.getByRole('alert')
  await expect(aviso, 'a rede de segurança tem de aparecer, e não uma tela morta').toBeVisible({ timeout: 20_000 })

  const botao = page.getByRole('button', { name: 'Recarregar' })
  await expect(botao).toBeVisible()
  const caixa = await botao.boundingBox()
  expect(caixa, 'sem caixa do botão não há como medir no pixel').not.toBeNull()
  const alvo = caixa as Retangulo

  const medida = await medirPng(analista, await retrato(page), {
    pontos: [
      { x: 8, y: 8 },
      { x: TELA.width - 8, y: TELA.height - 8 },
      { x: alvo.x + alvo.width / 2, y: alvo.y + alvo.height / 2 },
      { x: alvo.x + 4, y: alvo.y + alvo.height / 2 },
    ],
  })
  const [cantoA, cantoB, centroBotao, bordaBotao] = medida.amostras

  expect(distanciaCor(cantoA, TINTA_FUNDO), `topo da tela de erro: rgb(${cantoA.join(',')})`).toBeLessThanOrEqual(24)
  expect(distanciaCor(cantoB, TINTA_FUNDO), `rodapé da tela de erro: rgb(${cantoB.join(',')})`).toBeLessThanOrEqual(24)
  expect(
    Math.min(distanciaCor(centroBotao, LATAO), distanciaCor(bordaBotao, LATAO)),
    `botão da tela de erro: centro rgb(${centroBotao.join(',')}), borda rgb(${bordaBotao.join(',')}) — nenhum é o latão do produto`,
  ).toBeLessThanOrEqual(40)

  await analista.close()
})

// ---------------------------------------------------------------------------
// 3. "Conectando…" tem prazo
// ---------------------------------------------------------------------------
test('"Conectando…" tem prazo: código de sala que não existe vira explicação e caminho de volta', async ({ page }) => {
  // O servidor aceita o upgrade e nunca responde: mestre travado, porta errada,
  // portal cativo do hotel. É a condição que deixa a tela parada hoje.
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    () => {
      // silêncio de propósito
    },
  )

  await page.goto('/player.html')
  await page.getByLabel('Código da sala').click()
  await page.getByLabel('Código da sala').pressSequentially('ZZZ999', { delay: 20 })
  await page.getByLabel('Seu nome').click()
  await page.getByLabel('Seu nome').pressSequentially('Ana', { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()

  // CONTROLE POSITIVO da régua de prazo: ela vê a transição quando ela existe.
  await expect(page.getByRole('status'), 'controle: a régua enxerga o estado "Conectando…" na tela').toHaveText(/Conectando/, {
    timeout: 5_000,
  })

  await expect(
    page.getByRole('status'),
    `passados ${PRAZO_CONECTANDO_MS / 1000}s a tela ainda diz "Conectando…" — sem prazo, sem erro, sem saída`,
  ).not.toHaveText(/Conectando/, { timeout: PRAZO_CONECTANDO_MS })

  await expect(
    page.getByRole('button', { name: /Voltar|Corrigir|outra sala|Tentar/ }),
    'o jogador precisa de um caminho de volta visível',
  ).toBeVisible({ timeout: 2_000 })
})

// ---------------------------------------------------------------------------
// 4. A tela de entrada é desenhada
// ---------------------------------------------------------------------------
test('a tela de entrada é uma tela composta, não um formulário solto no meio do nada', async ({ page }) => {
  const analista = await abrirAnalista(page)

  // CONTROLES POSITIVOS das duas réguas.
  const cartaoControle: Retangulo = { x: 460, y: 230, width: 360, height: 340 }
  await analista.setContent(
    '<body style="margin:0;background:#121214"><div style="position:absolute;left:460px;top:230px;width:360px;height:340px;background:#1a1a1e"></div></body>',
  )
  const chapado = await medirPng(analista, await retrato(analista), { cartao: cartaoControle })
  await analista.setContent(
    '<body style="margin:0;background:radial-gradient(circle at 30% 20%, #2a2118 0%, #121214 60%)">' +
      '<div style="position:absolute;left:0;top:0;width:100%;height:120px;background:#e0a44a"></div>' +
      '<div style="position:absolute;left:0;top:640px;width:100%;height:160px;background:#e2645a"></div>' +
      '<div style="position:absolute;left:460px;top:230px;width:360px;height:340px;background:#1a1a1e"></div></body>',
  )
  const composto = await medirPng(analista, await retrato(analista), { cartao: cartaoControle })
  expect(chapado.fracaoTintaFora, 'controle: fundo chapado tem de ser REPROVADO pela régua de tinta').toBeLessThan(PISO_TINTA_FORA)
  expect(composto.fracaoTintaFora, 'controle: fundo composto tem de ser APROVADO pela régua de tinta').toBeGreaterThanOrEqual(PISO_TINTA_FORA)
  expect(chapado.familiasDeCor, 'controle: tela neutra tem de ser REPROVADA pela régua de cor').toBeLessThan(PISO_FAMILIAS_DE_COR)
  expect(composto.familiasDeCor, 'controle: duas cores de marca têm de ser APROVADAS pela régua de cor').toBeGreaterThanOrEqual(
    PISO_FAMILIAS_DE_COR,
  )
  await analista.goto('about:blank')

  // A tela de verdade, como o jogador a recebe pelo QR.
  await page.goto('/player.html')
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  const cartao = await page.locator('.pe-card').boundingBox()
  expect(cartao, 'sem o cartão na tela não há o que medir').not.toBeNull()
  const alvoCartao = cartao as Retangulo
  const titulo = await page.getByRole('heading', { name: 'Labirinto' }).boundingBox()
  expect(titulo, 'sem título na tela não há contraste a medir').not.toBeNull()
  const alvoTitulo = titulo as Retangulo

  const medida = await medirPng(analista, await retrato(page), {
    // Margem de 24px: sombra do cartão não conta como composição do fundo.
    cartao: { x: alvoCartao.x - 24, y: alvoCartao.y - 24, width: alvoCartao.width + 48, height: alvoCartao.height + 48 },
    recorte: alvoTitulo,
  })

  // As duas medidas são `soft` para que a MESMA execução mostre os dois números:
  // parar na primeira esconderia metade do diagnóstico. Soft continua reprovando
  // o teste — o vermelho é o mesmo, a evidência é o dobro.
  expect
    .soft(
      medida.fracaoTintaFora,
      `tinta fora do cartão: ${(medida.fracaoTintaFora * 100).toFixed(2)}% — fundo é um retângulo chapado rgb(${medida.corModal.join(',')})`,
    )
    .toBeGreaterThanOrEqual(PISO_TINTA_FORA)

  expect
    .soft(medida.familiasDeCor, `famílias de cor de marca na tela: ${medida.familiasDeCor} — uma cor só não compõe uma tela`)
    .toBeGreaterThanOrEqual(PISO_FAMILIAS_DE_COR)

  // CONTRATO (soft): o contraste do título já é bom hoje; fica travado para não regredir.
  const claro = medida.lumMaxRecorte + 0.05 * 255
  const escuro = medida.lumMinRecorte + 0.05 * 255
  const contraste = claro / escuro
  expect
    .soft(contraste, `contraste do título medido no pixel: ${contraste.toFixed(2)}:1`)
    .toBeGreaterThanOrEqual(4.5)

  await analista.close()
})
