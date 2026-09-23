// JORNADA DE USUÁRIO do "token do jogador com foto" — escrita para SAIR
// VERMELHA no código de hoje. Nada de produção é tocado aqui: quem corrige é
// outra pessoa.
//
// O QUE A PESSOA PEDIU (com prints, 17/09/2026):
//   1. o token deixa de ser bolinha azul chapada: fica REDONDO, com MOLDURA, e
//      a FOTO recortada DENTRO do círculo (referência mandada pelo usuário:
//      scratchpad/bar-2026-09-17/bar-tokens-redondos-moldura.png);
//   2. o JOGADOR VÊ a foto do próprio token;
//   3. o JOGADOR troca o NOME e a FOTO do próprio token, da tela dele.
//
// ONDE CADA UMA MORRE HOJE:
//   1. pixi/tokensRenderer.ts:123-181 põe a foto num `Sprite` QUADRADO de lado
//      `grid * size`, sem máscara e sem anel: a foto ocupa o quadrado inteiro,
//      cantos inclusive, e anel só existe enquanto o token está SELECIONADO (e
//      aí é a cor de seleção, não uma moldura).
//   2. lib/fogFilter.ts:392 apaga `image` de TODO token antes de mandar
//      (`.map((t) => (t.image === null ? t : { ...t, image: null }))`), e
//      player/PlayerView.tsx:173-179 (`paintTokenView`) só sabe desenhar
//      `circle().fill()` — não existe sprite do lado do jogador.
//   3. net/protocol.ts:48-108 não tem NENHUMA mensagem de editar token
//      (jogador manda `join`, `token.move`, `ping`, `signal`, `door.toggle`),
//      e a tela do jogador não tem controle nenhum de nome nem de foto.
//
// COMO ESTE ARQUIVO PROVA, sem mentir:
//   GESTO REAL. Ponteiro e teclado de verdade (clique, `pressSequentially`,
//   `setInputFiles`). A foto entra no token do MESTRE pelo caminho que existe
//   na tela — botão "Escolher imagem..." do painel, diálogo do sistema e o
//   pipeline inteiro de lib/imageImport.ts. O que é falsificado é só o DISCO e
//   o SELETOR DE ARQUIVO do Tauri (mesmo stub que e2e/helpers/tauriFsStub.ts
//   já usa), nunca o transporte do jogador.
//   PROVA NA TELA. Cor de pixel do canvas, lida do screenshot. Nenhuma
//   afirmação sai da store.
//   LADO DO JOGADOR. `page.routeWebSocket` com a sessão REAL do mestre
//   (src/net/hostSession.ts) e as mensagens REAIS do protocolo (`join`,
//   `welcome`, `snapshot`): o que a página DESENHA e o que ela ENVIA são os
//   dois observados de fora, como o servidor axum os veria.
//
// O QUE ESTE ARQUIVO NÃO DITA: como a foto viaja do mestre para o jogador. A
// foto do cenário é uma referência auto-contida (`data:image/png;base64`),
// então qualquer transporte que PRESERVE a foto — mandar a referência como
// está, embutir os bytes, servir por URL — deixa a jornada verde. O que ela
// cobra é o resultado: a foto na tela do jogador.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession, type HostSession, type Outbound } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'
import type { MapData, Token } from '../src/types/map'
import type { HostMessage } from '../src/net/protocol'

/** 64x64 px: metade de cima #ff00ff, metade de baixo #00c853. Duas cores de
 *  propósito — "a foto está desenhada" vira uma afirmação específica (as DUAS
 *  metades aparecem, cada uma no seu lado), não "tem alguma cor diferente do
 *  fundo". */
const FOTO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nO3PUQkAIBTAwNfR0rbSEH4cwmABbnPmfN1wQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFrwOz1995QQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFb10lsMlp2HT+PAAAAABJRU5ErkJggg=='
const FOTO_DATA_URL = `data:image/png;base64,${FOTO_BASE64}`
/** A mesma imagem em arquivo, para o `input[type=file]` do jogador (jornada 3). */
const FOTO_EM_ARQUIVO = 'e2e/fixtures/foto-do-jogador.png'
/** Caminho que o diálogo do sistema devolve quando o mestre escolhe a foto. */
const FOTO_NO_DISCO_DO_MESTRE = 'C:/fotos/heroi.png'

type Cor = [number, number, number]
const METADE_DE_CIMA: Cor = [255, 0, 255]
const METADE_DE_BAIXO: Cor = [0, 200, 83]
/** Fundo do mapa novo — `lib/mapFactory.ts` (`background.src` = #2b2b2b). */
const FUNDO_DO_EDITOR: Cor = [43, 43, 43]
/** Bolinha genérica do editor — `pixi/drawTokens.ts:17` (`0x5a8fd6`). */
const BOLINHA_DO_MESTRE: Cor = [90, 143, 214]

/**
 * Tolerância por canal. Não é frouxidão: no editor a cor sai exata (medido em
 * 17/09/2026), mas na tela do JOGADOR a camada "Brilho do explorado" (55% por
 * padrão, PlayerPanel.tsx) tinge tudo — o disco do próprio token não bate byte
 * a byte com #3b82f6, e duas amostras DENTRO do mesmo disco chapado não batem
 * entre si. Com igualdade exata, "a foto está na tela do jogador" seria
 * impossível de satisfazer mesmo com a feature pronta: vermelho eterno, tão
 * inútil quanto verde de mentira. 60 separa com folga as cores em jogo
 * (magenta, verde, fundo, azul) e ainda recusa qualquer uma trocada por outra.
 */
const TOLERANCIA = 60

const GRID = 64
const PAINT_MS = 200
const PAUSA_ANTES_DE_SOLTAR_MS = 120

type Foto = Awaited<ReturnType<Page['screenshot']>>

// ───────────────────────────────────────────────────────────────────────────
// Medida de pixel: o que está DESENHADO na tela, em RGB
// ───────────────────────────────────────────────────────────────────────────

/**
 * Foto de um recorte, com três tentativas. O Chromium responde
 * `Protocol error (Page.captureScreenshot): Unable to capture screenshot`
 * quando a aba fica sem compositor por um instante — visto 1 vez em 9
 * execuções desta jornada (17/09/2026). É ruído de infraestrutura, não
 * resposta do app: repetir é seguro (fotografar não muda nada na tela) e sem
 * isso a jornada ficaria INSTÁVEL — vermelha pelo motivo errado de vez em
 * quando.
 */
async function fotografar(page: Page, clip: { x: number; y: number; width: number; height: number }): Promise<Foto> {
  let ultimoErro: unknown = null
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await page.screenshot({ clip })
    } catch (erro) {
      ultimoErro = erro
      await page.waitForTimeout(200)
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro))
}

/**
 * Cor de UM pixel da tela. O screenshot é a fonte da verdade; o `evaluate`
 * abaixo é só decodificador de PNG (o projeto não tem um, e não vale instalar
 * dependência por isto) — ele desenha a foto de 1x1 num canvas solto e lê o
 * valor. Não toca em estado nenhum do app.
 */
async function corNaTela(page: Page, x: number, y: number): Promise<Cor> {
  const png = await fotografar(page, { x: Math.round(x), y: Math.round(y), width: 1, height: 1 })
  return page.evaluate(async (url: string) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const tela = document.createElement('canvas')
    tela.width = 1
    tela.height = 1
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('canvas 2D indisponível para ler o pixel')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2]] as [number, number, number]
  }, `data:image/png;base64,${png.toString('base64')}`)
}

function distancia(a: Cor, b: Cor): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
}

function ehAMesmaCor(a: Cor, b: Cor, tolerancia = TOLERANCIA): boolean {
  return distancia(a, b) <= tolerancia
}

function emTexto(cor: Cor): string {
  return `rgb(${cor[0]}, ${cor[1]}, ${cor[2]})`
}

/**
 * Ângulos de amostragem da moldura. Só a metade de CIMA e as horizontais: o
 * nome do token é desenhado logo ABAIXO do círculo (tokensRenderer.ts:231 e
 * PlayerView.tsx:177), e amostrar para baixo pegaria a letra branca — moldura
 * de mentira, teste verde por acidente.
 */
const ANGULOS_DA_MOLDURA = [0, 45, 90, 135, 180]

function pontoNoAnel(centro: { x: number; y: number }, raio: number, grau: number): { x: number; y: number } {
  const rad = (grau * Math.PI) / 180
  // y para CIMA é negativo na tela.
  return { x: centro.x + Math.cos(rad) * raio, y: centro.y - Math.sin(rad) * raio }
}

/**
 * Existe MOLDURA em volta do círculo? Verdadeiro quando algum raio entre
 * `raioMin` e `raioMax` tem, nos CINCO ângulos, a MESMA cor — e essa cor não é
 * a foto nem o fundo.
 *
 * Por que os cinco, e iguais entre si: moldura é um anel, aparece em volta
 * INTEIRA e numa cor só. Exigir menos deixaria o quadrado de hoje passar — a
 * borda serrilhada do sprite dá, num raio perto de 32 px, três ângulos com cor
 * de transição (0°, 90°, 180°, onde fica o lado do quadrado) e dois ainda
 * dentro da foto (45°, 135°). Três de cinco viraria verde de mentira.
 */
async function molduraEmVolta(
  page: Page,
  centro: { x: number; y: number },
  raioMin: number,
  raioMax: number,
  coresDaFoto: Cor[],
  fundo: Cor,
): Promise<{ achou: boolean; relato: string }> {
  const relatos: string[] = []
  for (let raio = Math.round(raioMin); raio <= Math.round(raioMax); raio += 1) {
    const amostras: Cor[] = []
    for (const grau of ANGULOS_DA_MOLDURA) {
      const p = pontoNoAnel(centro, raio, grau)
      amostras.push(await corNaTela(page, p.x, p.y))
    }
    relatos.push(`raio ${raio}px: ${amostras.map(emTexto).join(' | ')}`)
    const anelUniforme = amostras.every((a) => ehAMesmaCor(a, amostras[0], 24))
    if (!anelUniforme) continue
    if (ehAMesmaCor(amostras[0], fundo)) continue
    if (coresDaFoto.some((cor) => ehAMesmaCor(amostras[0], cor))) continue
    return { achou: true, relato: relatos[relatos.length - 1] }
  }
  return { achou: false, relato: relatos.join('\n') }
}

// ───────────────────────────────────────────────────────────────────────────
// JORNADA 1 — o mestre põe a foto no token e olha para ele
// ───────────────────────────────────────────────────────────────────────────

type InternalsDoTauri = {
  invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
  convertFileSrc: (filePath: string, protocol?: string) => string
}
type JanelaDoMestre = { isTauri: boolean; __TAURI_INTERNALS__: InternalsDoTauri }

/**
 * Disco e seletor de arquivo de mentira POR CIMA do stub que o projeto já tem
 * (helpers/tauriFsStub.ts): o diálogo devolve o caminho da foto, `read_file` e
 * `write_file` passam a existir em binário, e o protocolo de asset do Tauri
 * (`convertFileSrc`) devolve a mesma foto numa referência que o navegador
 * carrega. Nada aqui toca o transporte do jogador — o pipeline de
 * `lib/imageImport.ts` roda inteiro, de verdade.
 */
async function discoComFoto(page: Page): Promise<void> {
  await installTauriFsStub(page)
  await page.addInitScript(
    (entrada: { foto: string; origem: string; dataUrl: string }) => {
      const alvo = window as unknown as JanelaDoMestre
      const internals = alvo.__TAURI_INTERNALS__
      const base = internals.invoke.bind(internals)
      const binarios: Record<string, number[]> = {}
      const bytes = Uint8Array.from(atob(entrada.foto), (c) => c.charCodeAt(0))
      // sem isto o App fica no modo navegador e "Escolher imagem..." recusa
      // (lib/imageImport.ts:40, `ImagePickerUnavailableError`)
      alvo.isTauri = true
      internals.convertFileSrc = (filePath: string) =>
        String(filePath).indexOf('token_') === -1 ? String(filePath) : entrada.dataUrl
      internals.invoke = async (cmd, args, options) => {
        const a = (args ?? {}) as Record<string, unknown>
        switch (cmd) {
          case 'plugin:dialog|open':
            return entrada.origem
          case 'plugin:fs|read_file':
            return String(a.path) in binarios ? binarios[String(a.path)] : Array.from(bytes)
          case 'plugin:fs|write_file': {
            const caminho = decodeURIComponent(options?.headers?.path ?? '')
            binarios[caminho] = Array.from(args as Uint8Array)
            return null
          }
          case 'plugin:event|listen':
            return 1
          case 'plugin:event|unlisten':
            return null
          default:
            return base(cmd, args, options)
        }
      }
    },
    { foto: FOTO_BASE64, origem: FOTO_NO_DISCO_DO_MESTRE, dataUrl: FOTO_DATA_URL },
  )
}

test('1. token com foto no editor do mestre é redondo, com moldura, e a foto não vaza para o canto do quadrado', async ({ page }) => {
  test.setTimeout(120_000)
  await discoComFoto(page)
  await enterEditor(page)

  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')

  // Token pelo gesto que existe na tela (o mesmo de task-jornada-gestos-centrais).
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  const campoDoNovoToken = page.getByRole('textbox', { name: 'Nome do novo token' })
  await campoDoNovoToken.click()
  await campoDoNovoToken.pressSequentially('Heroi', { delay: 20 })
  await campoDoNovoToken.press('Enter')
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()

  // A foto entra pelo caminho da pessoa: painel -> "Escolher imagem..." ->
  // diálogo do sistema -> importTokenImage. O painel passando a oferecer
  // "Trocar imagem..." é a prova VISÍVEL de que a foto entrou no token.
  await page.getByRole('button', { name: 'Escolher imagem...' }).click()
  await expect(page.getByRole('button', { name: 'Trocar imagem...' })).toBeVisible({ timeout: 15_000 })

  const token = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const t = mod.useMapStore.getState().map.tokens[0]
    return t ? { x: t.x, y: t.y, size: t.size } : null
  })
  if (!token) throw new Error('"Adicionar token" não criou token nenhum')
  const centro = { x: caixa.x + token.x, y: caixa.y + token.y }
  const raio = (GRID * token.size) / 2

  // Deselecionar ANTES de medir: token selecionado ganha um anel da cor de
  // seleção (tokensRenderer.ts:176), que passaria por moldura.
  await page.mouse.click(centro.x + raio * 5, centro.y + raio * 4)
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toHaveCount(0)
  await page.waitForTimeout(PAINT_MS)

  // CONTROLE POSITIVO: a foto está mesmo desenhada no token (as duas metades
  // dela, cada uma no seu lado) e não é mais a bolinha azul. Sem isto, tudo
  // abaixo passaria com o token invisível.
  const dentroEmCima = await corNaTela(page, centro.x, centro.y - raio * 0.5)
  const dentroEmBaixo = await corNaTela(page, centro.x, centro.y + raio * 0.5)
  expect(ehAMesmaCor(dentroEmCima, METADE_DE_CIMA), `a metade de cima da foto deveria estar dentro do token; veio ${emTexto(dentroEmCima)}`).toBe(true)
  expect(ehAMesmaCor(dentroEmBaixo, METADE_DE_BAIXO), `a metade de baixo da foto deveria estar dentro do token; veio ${emTexto(dentroEmBaixo)}`).toBe(true)
  expect(ehAMesmaCor(dentroEmCima, BOLINHA_DO_MESTRE), 'com foto escolhida, o token não pode continuar sendo a bolinha azul').toBe(false)

  // A QUEIXA 1, primeira metade: RECORTE REDONDO. Os quatro cantos do quadrado
  // do token (dentro do lado, fora do círculo) não podem ter pixel da foto.
  // Hoje o sprite é quadrado e os quatro são a foto.
  const cantos = [
    { dx: raio * 0.81, dy: -raio * 0.81 },
    { dx: -raio * 0.81, dy: -raio * 0.81 },
    { dx: raio * 0.81, dy: raio * 0.81 },
    { dx: -raio * 0.81, dy: raio * 0.81 },
  ]
  for (const canto of cantos) {
    const cor = await corNaTela(page, centro.x + canto.dx, centro.y + canto.dy)
    const ehFoto = ehAMesmaCor(cor, METADE_DE_CIMA) || ehAMesmaCor(cor, METADE_DE_BAIXO)
    expect
      .soft(
        ehFoto,
        `o canto do quadrado do token (${canto.dx.toFixed(0)}, ${canto.dy.toFixed(0)} do centro) tem pixel da foto (${emTexto(cor)}): o token ainda é um quadrado, não um círculo`,
      )
      .toBe(false)
  }

  // A QUEIXA 1, segunda metade: MOLDURA em volta, sempre — não só quando o
  // token está selecionado.
  const moldura = await molduraEmVolta(page, centro, raio * 0.8, raio * 1.4, [METADE_DE_CIMA, METADE_DE_BAIXO], FUNDO_DO_EDITOR)
  expect(moldura.achou, `não há moldura nenhuma em volta da foto do token. O que há em cada raio:\n${moldura.relato}`).toBe(true)
})

// ───────────────────────────────────────────────────────────────────────────
// Lado do jogador: sessão REAL do mestre atrás de um WebSocket falso
// ───────────────────────────────────────────────────────────────────────────

const CODIGO = 'GATDFB'
const CELULAS_X = 20
const CELULAS_Y = 12
const MUNDO_W = CELULAS_X * GRID
const MUNDO_H = CELULAS_Y * GRID
const MARGEM_DO_ENQUADRAMENTO = 24 // igual a PlayerView.tsx:66
const JANELA = { width: 1280, height: 800 } // playwright.config.ts

function escalaDaTela(): number {
  return Math.min(
    (JANELA.width - MARGEM_DO_ENQUADRAMENTO * 2) / MUNDO_W,
    (JANELA.height - MARGEM_DO_ENQUADRAMENTO * 2) / MUNDO_H,
  )
}

/** Mesmo enquadramento que PlayerView aplica no primeiro snapshot (fitCamera). */
function mundoParaTela(x: number, y: number): { x: number; y: number } {
  const escala = escalaDaTela()
  return { x: JANELA.width / 2 + (x - MUNDO_W / 2) * escala, y: JANELA.height / 2 + (y - MUNDO_H / 2) * escala }
}

const TOKEN_DO_JOGADOR: Token = {
  id: 'tok-ana',
  characterId: null,
  name: 'Heroi',
  x: 320,
  y: 384,
  size: 1,
  // A foto que o mestre pôs no token. Referência auto-contida de propósito: a
  // jornada cobra a foto NA TELA do jogador, não um transporte específico.
  image: FOTO_DATA_URL,
}

function mapaComFoto(): MapData {
  const base = createEmptyMap('m-foto', 'Foto', CELULAS_X, CELULAS_Y, GRID)
  return {
    ...base,
    floor: [
      {
        id: 'f-chao',
        shape: { kind: 'rect', cx: MUNDO_W / 2, cy: MUNDO_H / 2, w: MUNDO_W - 20, h: MUNDO_H - 20 },
        op: 'add',
        modifiers: {},
      },
    ],
    tokens: [TOKEN_DO_JOGADOR],
  }
}

interface MesaDoMestre {
  session: HostSession
  /** Tudo que a PÁGINA DO JOGADOR mandou pelo socket, na ordem. */
  doJogador: Record<string, unknown>[]
  /** Tudo que o mestre mandou para o jogador. */
  doMestre: HostMessage[]
  transmitir: () => void
  atribuirToken: () => void
}

/** Mestre de verdade (hostSession) atrás de um WebSocket falso, como em task-player-page. */
async function mesaDoMestre(page: Page): Promise<MesaDoMestre> {
  const CLIENTE = 'c1'
  let mapa = mapaComFoto()
  let socket: WebSocketRoute | null = null
  let playerId: string | null = null
  const doJogador: Record<string, unknown>[] = []
  const doMestre: HostMessage[] = []
  const session = createHostSession({
    code: CODIGO,
    visionRadius: 2000,
    randomId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })

  const despachar = (saidas: Outbound[]) => {
    for (const saida of saidas) {
      if (saida.clientId !== CLIENTE || socket === null) continue
      doMestre.push(saida.msg)
      if (saida.msg.type === 'welcome') playerId = saida.msg.playerId
      socket.send(JSON.stringify(saida.msg))
    }
  }

  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      socket = ws
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        const analisada: unknown = JSON.parse(texto)
        if (typeof analisada === 'object' && analisada !== null) doJogador.push(analisada as Record<string, unknown>)
        const r = session.handleMessage(CLIENTE, texto, mapa)
        despachar(r.outbound)
        if (r.applyMove) {
          const { tokenId, x, y } = r.applyMove
          mapa = { ...mapa, tokens: mapa.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
          despachar(session.broadcast(mapa).outbound)
        }
      })
    },
  )

  return {
    session,
    doJogador,
    doMestre,
    transmitir: () => despachar(session.broadcast(mapa).outbound),
    atribuirToken: () => {
      if (playerId === null) throw new Error('o jogador nem entrou: sem playerId para atribuir o token')
      session.assignToken(playerId, TOKEN_DO_JOGADOR.id)
    },
  }
}

async function entrarNaSala(page: Page): Promise<void> {
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODIGO, { delay: 20 })
  const nome = page.getByLabel('Seu nome')
  await nome.click()
  await nome.pressSequentially('Ana', { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
}

/** O jogador com o token na mão e o primeiro quadro desenhado. */
async function jogadorComToken(page: Page): Promise<MesaDoMestre> {
  const mesa = await mesaDoMestre(page)
  await entrarNaSala(page)
  mesa.atribuirToken()
  mesa.transmitir()
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForTimeout(600) // primeiro quadro + carga da textura
  return mesa
}

// ───────────────────────────────────────────────────────────────────────────
// JORNADA 2 — o jogador olha o próprio token
// ───────────────────────────────────────────────────────────────────────────

test('2. o jogador vê a foto do próprio token, não um disco de uma cor só', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  const mesa = await jogadorComToken(page)

  const centro = mundoParaTela(TOKEN_DO_JOGADOR.x, TOKEN_DO_JOGADOR.y)
  const raio = (GRID / 2) * TOKEN_DO_JOGADOR.size * escalaDaTela()
  const longe = mundoParaTela(TOKEN_DO_JOGADOR.x + GRID * 4, TOKEN_DO_JOGADOR.y)

  const dentroEmCima = await corNaTela(page, centro.x, centro.y - raio * 0.5)
  const dentroEmBaixo = await corNaTela(page, centro.x, centro.y + raio * 0.5)
  const chaoVazio = await corNaTela(page, longe.x, longe.y)

  // CONTROLE POSITIVO: tem MESMO um token desenhado ali (senão as afirmações
  // abaixo passariam com a tela vazia).
  expect(ehAMesmaCor(dentroEmCima, chaoVazio), 'o token do jogador nem está desenhado: o cenário não aconteceu').toBe(false)
  expect(erros, 'a página do jogador quebrou antes de desenhar').toEqual([])

  // CAUSA RAIZ, antes da prova de tela: a foto é apagada no payload, então nem
  // chega para ser desenhada. Vem ANTES de propósito — uma afirmação dura que
  // falha aborta o teste, e posta depois da prova de pixel esta linha nunca
  // rodaria. Apoio, não prova: a prova é o pixel.
  const ultimo = [...mesa.doMestre].reverse().find((m) => m.type === 'snapshot' || m.type === 'delta')
  const tokenNoFio =
    ultimo && (ultimo.type === 'snapshot' || ultimo.type === 'delta')
      ? ultimo.map.tokens.find((t) => t.id === TOKEN_DO_JOGADOR.id)
      : undefined
  expect
    .soft(tokenNoFio?.image ?? null, 'o snapshot chega ao jogador com a foto apagada (lib/fogFilter.ts:392)')
    .not.toBeNull()

  // A QUEIXA 2: o jogador tem de VER a foto. Hoje chega `image: null`
  // (lib/fogFilter.ts:392) e a view só sabe desenhar círculo
  // (player/PlayerView.tsx:173-179), então o token é de uma cor só.
  expect
    .soft(
      ehAMesmaCor(dentroEmCima, dentroEmBaixo),
      `o token do jogador é de uma cor só (${emTexto(dentroEmCima)} em cima, ${emTexto(dentroEmBaixo)} embaixo): nenhuma foto dentro dele`,
    )
    .toBe(false)
  expect(
    ehAMesmaCor(dentroEmCima, METADE_DE_CIMA) && ehAMesmaCor(dentroEmBaixo, METADE_DE_BAIXO),
    `a foto do token não aparece na tela do jogador: em cima ${emTexto(dentroEmCima)} (esperado ${emTexto(METADE_DE_CIMA)}), embaixo ${emTexto(dentroEmBaixo)} (esperado ${emTexto(METADE_DE_BAIXO)})`,
  ).toBe(true)

})

// ───────────────────────────────────────────────────────────────────────────
// JORNADA 3 — o jogador troca o nome e a foto do próprio token
// ───────────────────────────────────────────────────────────────────────────

test('3. o jogador troca o nome e a foto do próprio token pela tela dele, e o mestre recebe a mudança', async ({ page }) => {
  test.setTimeout(120_000)
  const mesa = await jogadorComToken(page)

  const centro = mundoParaTela(TOKEN_DO_JOGADOR.x, TOKEN_DO_JOGADOR.y)
  const raio = (GRID / 2) * TOKEN_DO_JOGADOR.size * escalaDaTela()
  const NOVO_NOME = 'Brunilda'

  // (a) A tela do jogador precisa OFERECER a troca de nome. Botão ou campo de
  // texto: o interruptor "Nomes" do painel (PlayerPanel.tsx:185) fica de fora
  // de propósito — ele LIGA os rótulos, não deixa trocar nada, e contá-lo daria
  // verde numa tela que continua sem o controle.
  const controleDeNome = page.getByRole('button', { name: /nome/i }).or(page.getByRole('textbox', { name: /nome/i }))
  await expect
    .poll(async () => controleDeNome.count(), {
      message: 'a tela do jogador não oferece nenhum controle para trocar o nome do próprio token',
      timeout: 10_000,
    })
    .toBeGreaterThan(0)

  const recorteDoNome = {
    x: Math.round(centro.x - raio * 2),
    y: Math.round(centro.y),
    width: Math.round(raio * 4),
    height: Math.round(raio * 2),
  }
  const antesDoNome = await fotografar(page, recorteDoNome)

  // Gesto de gente: abre o controle, apaga o que estava lá e digita tecla a tecla.
  await controleDeNome.first().click()
  const campoDeNome = page.getByRole('textbox', { name: /nome/i }).first()
  await campoDeNome.click()
  await campoDeNome.press('ControlOrMeta+a')
  await campoDeNome.pressSequentially(NOVO_NOME, { delay: 20 })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await campoDeNome.press('Enter')
  await page.waitForTimeout(PAINT_MS)

  // (b) A foto: no navegador do jogador, o caminho é o seletor de arquivo.
  const entradaDeFoto = page.locator('input[type="file"]')
  await expect
    .poll(async () => entradaDeFoto.count(), {
      message: 'a tela do jogador não oferece nenhum jeito de escolher a foto do próprio token',
      timeout: 10_000,
    })
    .toBeGreaterThan(0)
  await entradaDeFoto.first().setInputFiles(FOTO_EM_ARQUIVO)
  await page.waitForTimeout(600)

  // (c) O que a PESSOA vê: o nome desenhado embaixo do token mudou, e a foto
  // dela está dentro do token.
  const depoisDoNome = await fotografar(page, recorteDoNome)
  expect(antesDoNome.equals(depoisDoNome), 'o nome desenhado no token não mudou na tela depois da troca').toBe(false)

  const dentroEmCima = await corNaTela(page, centro.x, centro.y - raio * 0.5)
  const dentroEmBaixo = await corNaTela(page, centro.x, centro.y + raio * 0.5)
  expect(
    ehAMesmaCor(dentroEmCima, METADE_DE_CIMA) && ehAMesmaCor(dentroEmBaixo, METADE_DE_BAIXO),
    `a foto que o jogador escolheu não apareceu no token dele: em cima ${emTexto(dentroEmCima)}, embaixo ${emTexto(dentroEmBaixo)}`,
  ).toBe(true)

  // (d) E o mestre precisa FICAR SABENDO: a mudança sai pelo socket, no
  // protocolo. Hoje net/protocol.ts:48-108 não tem mensagem nenhuma de editar
  // token — o jogador só manda join/token.move/ping/signal/door.toggle.
  const mensagensDeEdicao = mesa.doJogador.filter(
    (m) => typeof m.type === 'string' && String(m.type).startsWith('token.') && String(m.type) !== 'token.move',
  )
  expect(
    mensagensDeEdicao.length > 0,
    `o jogador não mandou nenhuma mensagem de editar o token pelo socket; só saiu: ${mesa.doJogador.map((m) => String(m.type)).join(', ')}`,
  ).toBe(true)
  const tudoQueSaiu = JSON.stringify(mensagensDeEdicao)
  expect(tudoQueSaiu.includes(NOVO_NOME), 'o nome novo não saiu pelo socket para o mestre').toBe(true)
  expect(tudoQueSaiu.length > FOTO_BASE64.length / 4, 'a foto escolhida pelo jogador não saiu pelo socket para o mestre').toBe(true)
})
