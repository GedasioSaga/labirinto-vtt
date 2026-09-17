// JORNADA DE USUÁRIO — "que estranho, o jogador consegue ver o bloco da
// esquerda mas não o da direita".
//
// Escrita para SAIR VERMELHA no código de hoje. Nenhum arquivo de produção é
// tocado por ela.
//
// A DOR (print do usuário): duas salas do MESMO tamanho, uma de cada lado de um
// corredor, olhadas do mesmo jeito. Na tela do jogador uma aparece inteira e a
// outra sai mordida, com a borda em degraus. É a memória: o que o jogador já
// viu não é guardado pelo contorno do que ele viu, e sim por CÉLULAS
// (`lib/exploration.ts:41-51`, célula = max(8, grade/4) = 16 px de mundo aqui),
// marcadas só quando a célula cabe INTEIRA dentro do anel de visão
// (`markRings`, `lib/exploration.ts:184-228`). Na hora de desenhar, a memória
// vira RETÂNGULO de célula (`player/PlayerView.tsx:305-346`, `knownMask.rect`),
// não o contorno da sala nem o contorno da visão. Resultado: some uma faixa de
// até uma célula em toda a volta do que foi visto, e a borda vira escadinha.
//
// O CONTRATO QUE ESTA JORNADA COBRA: o que o jogador VIU fica lembrado
// INTEIRO, com a mesma borda. E duas salas olhadas do mesmo jeito aparecem
// igualmente completas na tela dele.
//
// COMO A PROVA É FEITA — SÓ PIXEL DA TELA DO JOGADOR. Foto do `<canvas>` do
// player, decodificada no próprio navegador, e conta de pixel aceso dentro do
// retângulo de cada sala. `mapStore`, `PlayerMemory` e `data-explored-cells`
// não são lidos em lugar nenhum: são números que o app escreve sobre si mesmo,
// não o que o olho do jogador vê. Até a régua de mundo→tela sai da foto: a
// moldura do mapa (fora do mapa o fundo é 0x111111, dentro a névoa fechada é
// preto puro) dá origem e escala, então pan ou enquadramento diferente não
// desloca a medição em silêncio.
//
// POR QUE A COMPARAÇÃO É JUSTA. O raio de visão é encolhido para 250 px pelo
// próprio controle do mestre ("Raio de visão", RoomPanel.tsx), então de fora
// cada sala aparece por um pedaço só — e esse pedaço é fotografado NO MOMENTO
// em que o jogador está mais perto dela do que jamais estará. Tudo o que ele vê
// daquela sala em qualquer outro instante da jornada cabe dentro dessa foto
// (mesma coluna, mais longe = menos visão). Logo, a memória do fim não pode ser
// MAIOR que a foto ao vivo; o teste cobra que ela também não seja menor.
//
// GESTO REAL em todo passo: o mestre desenha as salas com
// move → down → vários move → PAUSA → up; o jogador anda arrastando o próprio
// token no canvas dele, e a tela dele é que diz se o token chegou. Nada de
// `dispatchEvent`, nada de escrever na store de ninguém. O mapa que o jogador
// recebe vem do caminho de produção inteiro: editor → `net/hostBridge.ts`
// (sessão real do mestre, névoa real de `lib/fogFilter.ts`) → WebSocket →
// `player/main.tsx`.
//
// CONTROLES POSITIVOS (todo teto numérico tem um):
//  a. pedaço do mapa onde o token nunca chegou perto → a régua devolve ~0%
//     aceso. Se devolvesse número alto, ela estaria contando fundo/moldura e
//     nenhum teto daqui valeria nada;
//  b. as duas fotos ao vivo têm de cair entre 25% e 90% do recorte: nem
//     saturada (aí qualquer memória passaria) nem vazia (aí não haveria o que
//     lembrar);
//  c. a mesma régua de escadinha roda na foto AO VIVO da mesma sala: a borda da
//     visão é o teto contra o qual a borda da memória é cobrada;
//  d. os recortes medidos não podem encostar no painel do jogador, que flutua
//     sobre o canvas — senão pixel de interface entraria na conta.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'

// Disco da máquina apertado: nada de trace nem vídeo por causa desta jornada.
test.use({ trace: 'off', video: 'off' })

const CODE = 'SALAS1'
/** Mapa do formulário "Criar mapa" com os valores padrão (screens/NewDungeonMap.tsx:15-17). */
const MUNDO = { w: 30 * 64, h: 20 * 64 } // 1920 x 1280
/** Viewport do playwright.config.ts. */
const VIEW = { width: 1280, height: 800 }
/** Raio que o mestre escolhe no painel Jogo (VISION_RADIUS_MIN 50 + 4 passos de 50). */
const RAIO = 250

/**
 * Geometria, em px do canvas do EDITOR — que, com a câmera 1:1 do mapa recém
 * criado, é px de mundo. As duas salas têm exatamente 360 x 210, uma de cada
 * lado do corredor. Nada é desenhado antes de x=460 nem acima de y=90: o painel
 * do editor cobre o canvas dele até x~280, a barra de ferramentas flutua até
 * y~70, e o painel do jogador flutua sobre o canvas dele até x~260 de tela
 * (o controle positivo (d) confere).
 */
const SALA_E = { x0: 460, y0: 90, x1: 820, y1: 300 }
const SALA_D = { x0: 880, y0: 90, x1: 1240, y1: 300 }
/**
 * Aproximação máxima de cada sala: é daqui que sai a foto "ao vivo" dela. Fica
 * mais perto da parede do que o ponto onde o token nasce (o centro da área
 * visível do editor, App.tsx:926-929, y=400 no corredor), então nenhum quadro
 * anterior mostrou mais da sala do que estas fotos.
 */
const PERTO_E = { x: (SALA_E.x0 + SALA_E.x1) / 2, y: 370 }
const PERTO_D = { x: (SALA_D.x0 + SALA_D.x1) / 2, y: 370 }
/** Fundo do corredor: a mais de 250 px das duas salas, então as duas viram memória pura. */
const LONGE_E = { x: PERTO_E.x, y: 700 }
const LONGE_D = { x: PERTO_D.x, y: 700 }
/** Canto do mapa onde o token nunca chegou perto. */
const NUNCA_VISTO = { x0: 1500, y0: 1000, x1: 1750, y1: 1150 }

/** Margem para dentro das paredes, para o recorte não medir a própria linha da parede. */
const RECUO = 10
/** Luminância mínima para o pixel contar como "conhecido". Névoa fechada é preto puro (alfa 1). */
const LIMIAR_DE_LUZ = 10
/** Luminância que separa o lado de FORA do mapa (0x111111 ≈ 17) da névoa fechada (0). */
const LIMIAR_DA_MOLDURA = 8
/** Salto de borda, em px de CSS, que já é degrau de célula e não curva de visão. */
const SALTO_DE_DEGRAU = 4
/** O Pixi pinta no rAF seguinte; o snapshot ainda faz a volta pela rede falsa. */
const PINTURA_MS = 400
/** Um humano não solta o botão no mesmo quadro do último movimento. */
const PAUSA_ANTES_DE_SOLTAR_MS = 120
/** Linha e coluna da foto usadas para achar a moldura do mapa: longe do painel e da visão. */
const LINHA_DA_MOLDURA = 700
const COLUNA_DA_MOLDURA = 1100

type Retangulo = { x0: number; y0: number; x1: number; y1: number }
type Ponto = { x: number; y: number }

/** Régua mundo→tela, tirada da própria foto. */
interface Regua {
  origem: Ponto
  escala: number
}

interface Medida {
  /** Fração de pixels acesos (conhecidos) dentro do recorte, de 0 a 1. */
  aceso: number
  /** Colunas em que a borda de cima do aceso salta 4 px de CSS ou mais: a escadinha. */
  degraus: number
  /** Maior salto da borda de cima entre colunas vizinhas, em px de CSS. */
  maiorSalto: number
}

/** O que `locator.screenshot()` devolve — sem @types/node no tsconfig dos e2e. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

async function caixaDoCanvas(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return box
}

async function fotografar(page: Page): Promise<string> {
  const foto: Foto = await page.locator('canvas').screenshot()
  return foto.toString('base64')
}

/** Caixa do painel flutuante do jogador, em px de CSS dentro do canvas. */
async function caixaDoPainel(page: Page): Promise<Retangulo> {
  const painel = await page.getByRole('complementary', { name: 'Painel do jogador' }).boundingBox()
  const canvas = await caixaDoCanvas(page)
  if (!painel) throw new Error('painel do jogador sem bounding box')
  return {
    x0: painel.x - canvas.x,
    y0: painel.y - canvas.y,
    x1: painel.x - canvas.x + painel.width,
    y1: painel.y - canvas.y + painel.height,
  }
}

function cruza(a: Retangulo, b: Retangulo): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
}

/**
 * Lê da foto a moldura do mapa e o token azul do próprio jogador.
 *
 * Moldura: fora do retângulo do mapa o fundo é 0x111111 (player/PlayerView.tsx:70)
 * e dentro, onde o jogador nada conhece, a névoa é preto puro. A borda entre os
 * dois dá origem e escala da câmera sem perguntar nada ao app — se ele
 * enquadrar diferente, a régua acompanha em vez de medir o lugar errado.
 *
 * Token: 0x3b82f6 (`OWN_TOKEN_COLOR`). Pixel dentro da caixa do painel é
 * ignorado: o rádio "Heroi" do painel é do mesmo azul e puxaria o centro.
 */
async function lerTela(page: Page, b64: string, painel: Retangulo) {
  const box = await caixaDoCanvas(page)
  return page.evaluate(
    async ({ foto, painel: semPainel, larguraCss, limiarMoldura, linha, coluna }) => {
      const blob = await (await fetch(`data:image/png;base64,${foto}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas2d = document.createElement('canvas')
      canvas2d.width = bmp.width
      canvas2d.height = bmp.height
      const ctx = canvas2d.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escalaFoto = bmp.width / larguraCss
      const luz = (px: number, py: number): number => {
        const i = (py * width + px) * 4
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }

      const py = Math.round(linha * escalaFoto)
      let esquerda = -1
      let direita = -1
      for (let px = 0; px < width; px += 1) {
        if (luz(px, py) >= limiarMoldura) continue
        if (esquerda < 0) esquerda = px
        direita = px
      }
      const px = Math.round(coluna * escalaFoto)
      let topo = -1
      for (let y = 0; y < height; y += 1) {
        if (luz(px, y) < limiarMoldura) {
          topo = y
          break
        }
      }

      let somaX = 0
      let somaY = 0
      let n = 0
      for (let y = 0; y < height; y += 1) {
        const yCss = y / escalaFoto
        for (let x = 0; x < width; x += 1) {
          const xCss = x / escalaFoto
          if (xCss >= semPainel.x0 && xCss <= semPainel.x1 && yCss >= semPainel.y0 && yCss <= semPainel.y1) continue
          const i = (y * width + x) * 4
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (b > 170 && b - r > 60 && b - g > 40) {
            somaX += x
            somaY += y
            n += 1
          }
        }
      }

      return {
        moldura: { esquerda: esquerda / escalaFoto, direita: direita / escalaFoto, topo: topo / escalaFoto },
        token: n === 0 ? null : { x: somaX / n / escalaFoto, y: somaY / n / escalaFoto },
      }
    },
    { foto: b64, painel, larguraCss: box.width, limiarMoldura: LIMIAR_DA_MOLDURA, linha: LINHA_DA_MOLDURA, coluna: COLUNA_DA_MOLDURA },
  )
}

function reguaDe(moldura: { esquerda: number; direita: number; topo: number }): Regua {
  const escala = (moldura.direita - moldura.esquerda + 1) / MUNDO.w
  if (!(escala > 0.5 && escala < 0.7)) {
    throw new Error(`a moldura do mapa não foi reconhecida na foto (escala ${escala.toFixed(3)}): a régua mundo→tela não vale`)
  }
  return { origem: { x: moldura.esquerda, y: moldura.topo }, escala }
}

function paraTela(regua: Regua, p: Ponto): Ponto {
  return { x: regua.origem.x + p.x * regua.escala, y: regua.origem.y + p.y * regua.escala }
}

function recorteNaTela(regua: Regua, r: Retangulo, recuo = 0): Retangulo {
  const a = paraTela(regua, { x: r.x0 + recuo, y: r.y0 + recuo })
  const b = paraTela(regua, { x: r.x1 - recuo, y: r.y1 - recuo })
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }
}

/**
 * Régua de pixel: dentro de cada recorte conta o que está aceso e mede a borda
 * DE CIMA do aceso, coluna a coluna. Borda de visão é curva e anda de 1 px por
 * coluna; borda de célula anda em degraus de 16 px de mundo. Nenhum estado do
 * app entra nesta conta — só a imagem que o jogador vê.
 */
async function medir(page: Page, b64: string, recortes: Retangulo[]): Promise<Medida[]> {
  const box = await caixaDoCanvas(page)
  return page.evaluate(
    async ({ foto, recortes: rects, larguraCss, limiar, saltoDeDegrau }) => {
      const blob = await (await fetch(`data:image/png;base64,${foto}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas2d = document.createElement('canvas')
      canvas2d.width = bmp.width
      canvas2d.height = bmp.height
      const ctx = canvas2d.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escalaFoto = bmp.width / larguraCss
      const luz = (px: number, py: number): number => {
        if (px < 0 || px >= width || py < 0 || py >= height) return 0
        const i = (py * width + px) * 4
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      return rects.map((r) => {
        const px0 = Math.round(r.x0 * escalaFoto)
        const px1 = Math.round(r.x1 * escalaFoto)
        const py0 = Math.round(r.y0 * escalaFoto)
        const py1 = Math.round(r.y1 * escalaFoto)
        let acesos = 0
        let total = 0
        let degraus = 0
        let maiorSalto = 0
        let anterior: number | null = null
        for (let px = px0; px < px1; px += 1) {
          let borda: number | null = null
          for (let py = py0; py < py1; py += 1) {
            total += 1
            if (luz(px, py) > limiar) {
              acesos += 1
              if (borda === null) borda = py
            }
          }
          if (borda === null) {
            anterior = null
            continue
          }
          if (anterior !== null) {
            const salto = Math.abs(borda - anterior) / escalaFoto
            if (salto > maiorSalto) maiorSalto = salto
            if (salto >= saltoDeDegrau) degraus += 1
          }
          anterior = borda
        }
        return { aceso: total === 0 ? 0 : acesos / total, degraus, maiorSalto: Math.round(maiorSalto * 10) / 10 }
      })
    },
    { foto: b64, recortes, larguraCss: box.width, limiar: LIMIAR_DE_LUZ, saltoDeDegrau: SALTO_DE_DEGRAU },
  )
}

/** Arrasto de ponteiro de verdade, com pausa antes de soltar. */
async function arrastar(page: Page, de: Ponto, ate: Ponto, passos = 14): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(ate.x, ate.y, { steps: passos })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/** Onde está o token do jogador e qual é a régua mundo→tela, tudo lido da foto. */
async function olhar(page: Page, painel: Retangulo): Promise<{ regua: Regua; token: Ponto }> {
  const lido = await lerTela(page, await fotografar(page), painel)
  if (lido.token === null) throw new Error('o token azul do jogador não está desenhado na tela dele')
  return { regua: reguaDe(lido.moldura), token: { x: lido.token.x, y: lido.token.y } }
}

/** O jogador arrasta o PRÓPRIO token até o destino; a tela dele confirma que o token chegou. */
async function andarAte(page: Page, painel: Retangulo, destino: Ponto, onde: string): Promise<void> {
  const box = await caixaDoCanvas(page)
  const antes = await olhar(page, painel)
  const alvo = paraTela(antes.regua, destino)
  await arrastar(page, { x: box.x + antes.token.x, y: box.y + antes.token.y }, { x: box.x + alvo.x, y: box.y + alvo.y })
  await expect
    .poll(
      async () => {
        const agora = await olhar(page, painel)
        const mira = paraTela(agora.regua, destino)
        return Math.round(Math.hypot(agora.token.x - mira.x, agora.token.y - mira.y))
      },
      { timeout: 20_000, message: `o token do jogador não chegou em ${onde} pelo arrasto` },
    )
    .toBeLessThan(12)
  await page.waitForTimeout(PINTURA_MS)
}

type EventoTauri = { event: string; id: number; payload: unknown }
type HandlerTauri = (evento: EventoTauri) => void
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __jornadaNetSend: (payload: { clientId: string; msg: unknown }) => void
  __TAURI_INTERNALS__: {
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: (cb: HandlerTauri) => number
  }
}

/**
 * Transporte do mestre (`net_*` / `net:*`) falsificado por cima do stub de
 * Tauri, como em `task-jornada-entrada-jogador.spec.ts`. O que corre por dentro
 * — sessão do mestre, recorte de névoa, memória do jogador — é o código de
 * produção; só o cano entre as duas abas é do teste.
 */
async function mestreNoTauri(page: Page, aoEnviar: (msg: unknown) => void): Promise<void> {
  await installTauriFsStub(page)
  await page.exposeFunction('__jornadaNetSend', (payload: { clientId: string; msg: unknown }) => aoEnviar(payload.msg))
  await page.addInitScript((codigo: string) => {
    const alvo = window as unknown as JanelaDoMestre
    const internals = alvo.__TAURI_INTERNALS__
    const base = internals.invoke.bind(internals)
    const callbacks = new Map<number, HandlerTauri>()
    const ouvintes = new Map<number, { event: string; handler: HandlerTauri }>()
    let proximoId = 1
    alvo.isTauri = true // sem isto o App fica no modo navegador, sem as abas Mapa | Jogo
    alvo.__emitTauri = (event, payload) => {
      for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
    }
    internals.transformCallback = (cb: HandlerTauri) => {
      const id = proximoId
      proximoId += 1
      callbacks.set(id, cb)
      return id
    }
    internals.invoke = async (cmd, args, options) => {
      const a = (args ?? {}) as Record<string, unknown>
      switch (cmd) {
        case 'net_start_room':
          return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
        case 'net_send':
          alvo.__jornadaNetSend({ clientId: String(a.clientId), msg: a.msg })
          return null
        case 'net_kick':
        case 'net_stop_room':
          return null
        case 'plugin:event|listen': {
          const id = Number(a.handler)
          const cb = callbacks.get(id)
          if (cb) ouvintes.set(id, { event: String(a.event), handler: cb })
          return id
        }
        case 'plugin:event|unlisten':
          ouvintes.delete(Number(a.eventId))
          return null
        default:
          return base(cmd, args, options)
      }
    }
  }, CODE)
}

async function ferramenta(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click()
}

function botaoDeSelecao(page: Page) {
  return page.getByRole('button', { name: /Apagar|Nada selecionado/ })
}

test('duas salas olhadas do mesmo jeito: o que o jogador viu tem de ficar lembrado inteiro, com a mesma borda', async ({
  page,
  context,
}) => {
  // Duas abas com Pixi/WebGL, mapa 1920x1280 e leitura de foto pixel a pixel.
  test.setTimeout(240_000)
  // Só a página do JOGADOR: é a tela medida. Exceção do lado do mestre vem do
  // cano falso de Tauri deste teste (unlisten), não do app.
  const errosDoJogador: string[] = []

  let socket: WebSocketRoute | null = null
  await mestreNoTauri(page, (msg) => {
    if (socket !== null) socket.send(JSON.stringify(msg))
  })
  await enterEditor(page)
  const box = await caixaDoCanvas(page)
  const noCanvas = (p: Ponto): Ponto => ({ x: box.x + p.x, y: box.y + p.y })
  const fotos = `${test.info().project.outputDir}/visao-sala-inteira`

  // 1. O mestre desenha as DUAS salas, do mesmo tamanho, uma de cada lado do corredor.
  await ferramenta(page, 'Sala')
  await arrastar(page, noCanvas({ x: SALA_E.x0, y: SALA_E.y0 }), noCanvas({ x: SALA_E.x1, y: SALA_E.y1 }))
  await ferramenta(page, 'Sala')
  await arrastar(page, noCanvas({ x: SALA_D.x0, y: SALA_D.y0 }), noCanvas({ x: SALA_D.x1, y: SALA_D.y1 }))

  // 2. Abre o lado de baixo de cada sala (é por ali que o jogador olha):
  //    a borracha apaga a parede de baixo com um clique em cima dela.
  await ferramenta(page, 'Borracha')
  await page.mouse.click(box.x + (SALA_E.x0 + SALA_E.x1) / 2, box.y + SALA_E.y1)
  await page.mouse.click(box.x + (SALA_D.x0 + SALA_D.x1) / 2, box.y + SALA_D.y1)
  await ferramenta(page, 'Selecionar')
  for (const sala of [SALA_E, SALA_D]) {
    await page.mouse.click(box.x + (sala.x0 + sala.x1) / 2, box.y + sala.y1)
    await expect(botaoDeSelecao(page), 'a borracha tinha de ter tirado a parede de baixo da sala').not.toHaveText(
      'Apagar parede selecionada',
    )
  }
  await page.screenshot({ path: `${fotos}/0-mapa-do-mestre.png` })

  // 3. O token do jogador, criado pelo painel Seleção, nasce no centro da área visível — o corredor.
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  await page.getByLabel('Nome do novo token').fill('Heroi')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()

  // 4. O mestre abre a sala.
  await page.getByRole('tab', { name: 'Jogo' }).click()
  await page.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(page.getByText(CODE)).toBeVisible()

  // 5. O jogador entra pela página dele, em outra aba.
  const playerPage = await context.newPage()
  playerPage.on('pageerror', (e) => errosDoJogador.push(e.message))
  await playerPage.setViewportSize(VIEW)
  await playerPage.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      socket = ws
      page
        .evaluate(() => (window as unknown as JanelaDoMestre).__emitTauri('net:peer', { clientId: '7', event: 'connected', name: 'Ana' }))
        .catch(() => {})
      ws.onMessage((raw) => {
        const texto = typeof raw === 'string' ? raw : raw.toString('utf8')
        page
          .evaluate(
            (t: string) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: '7', msg: JSON.parse(t) }),
            texto,
          )
          .catch(() => {})
      })
    },
  )
  await playerPage.goto('/player.html')
  await playerPage.getByLabel('Código da sala').fill(CODE)
  await playerPage.getByLabel('Seu nome').fill('Ana')
  await playerPage.getByRole('button', { name: 'Entrar' }).click()
  await expect(playerPage.getByRole('status')).toHaveText(/Aguardando o mestre/)

  // 6. O mestre encolhe a lanterna dela para 250 px pelo controle que existe na
  //    tela dele (RoomPanel: "Raio de visão") e SÓ ENTÃO dá o personagem: assim
  //    nenhum quadro é visto com o raio padrão de 700 px, e a memória inteira da
  //    jornada nasce da mesma lanterna.
  const raio = page.getByLabel('Raio de visão')
  await raio.click()
  await raio.press('Home')
  for (let passo = 0; passo < 4; passo += 1) await raio.press('ArrowRight')
  await expect(page.getByText(`${RAIO} px`), 'o mestre não conseguiu deixar a lanterna do jogador em 250 px').toBeVisible()
  await page.getByRole('button', { name: /Heroi/ }).click({ timeout: 10_000 })

  await expect(playerPage.locator('canvas')).toBeVisible({ timeout: 15_000 })
  // O jogador desliga os nomes no painel dele: rótulo branco dentro da sala
  // mancharia a conta de pixel aceso.
  await playerPage.getByLabel('Nomes').uncheck()
  await playerPage.waitForTimeout(PINTURA_MS)
  const painel = await caixaDoPainel(playerPage)

  // 7. Ele desce o corredor, atravessa e sobe encostando na sala da DIREITA:
  //    aqui está a aproximação máxima dela, e é esta a foto do que ele viu.
  await andarAte(playerPage, painel, LONGE_E, 'o fundo do corredor')
  await andarAte(playerPage, painel, LONGE_D, 'o fundo do corredor do lado direito')
  await andarAte(playerPage, painel, PERTO_D, 'encostado na sala da direita')
  const noLugar = await olhar(playerPage, painel)
  const recorteE = recorteNaTela(noLugar.regua, SALA_E, RECUO)
  const recorteD = recorteNaTela(noLugar.regua, SALA_D, RECUO)
  const recorteEscuro = recorteNaTela(noLugar.regua, NUNCA_VISTO)
  // Controle positivo (d): interface flutuante não pode entrar em recorte nenhum.
  for (const [nome, recorte] of [
    ['sala da esquerda', recorteE],
    ['sala da direita', recorteD],
    ['canto nunca visto', recorteEscuro],
  ] as const) {
    expect(cruza(recorte, painel), `o recorte da ${nome} encosta no painel do jogador: a conta contaria pixel de interface`).toBe(false)
  }
  const [direitaAoVivo] = await medir(playerPage, await fotografar(playerPage), [recorteD])
  await playerPage.screenshot({ path: `${fotos}/1-vendo-a-direita.png` })

  // 8. Volta e sobe encostando na sala da ESQUERDA: aproximação máxima dela.
  await andarAte(playerPage, painel, LONGE_D, 'o fundo do corredor de novo')
  await andarAte(playerPage, painel, LONGE_E, 'o fundo do corredor do lado esquerdo')
  await andarAte(playerPage, painel, PERTO_E, 'encostado na sala da esquerda')
  const [esquerdaAoVivo] = await medir(playerPage, await fotografar(playerPage), [recorteE])
  await playerPage.screenshot({ path: `${fotos}/2-vendo-a-esquerda.png` })

  // 9. Ele se afasta das duas. Agora as duas salas na tela dele são memória pura.
  await andarAte(playerPage, painel, LONGE_E, 'o fundo do corredor, longe das duas salas')
  const foto = await fotografar(playerPage)
  await playerPage.screenshot({ path: `${fotos}/3-longe-das-duas.png` })
  const [esquerdaLembrada, direitaLembrada, escuro] = await medir(playerPage, foto, [recorteE, recorteD, recorteEscuro])

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`

  // Controle positivo (a): onde ninguém pisou, a régua devolve ~0.
  expect(Number(escuro.aceso.toFixed(3)), 'controle: canto nunca visitado tinha de estar apagado').toBeLessThan(0.02)
  // Controle positivo (b): as duas fotos ao vivo mostram um pedaço de cada sala — nem tudo, nem nada.
  for (const [nome, vivo] of [
    ['esquerda', esquerdaAoVivo],
    ['direita', direitaAoVivo],
  ] as const) {
    expect(
      Number(vivo.aceso.toFixed(3)),
      `controle: a foto ao vivo da sala da ${nome} (${pct(vivo.aceso)}) precisa mostrar um pedaço de sala, nem saturada nem vazia`,
    ).toBeGreaterThan(0.25)
    expect(Number(vivo.aceso.toFixed(3)), `controle: a foto ao vivo da sala da ${nome} está saturada`).toBeLessThan(0.9)
  }
  // Premissa da comparação entre as duas: ele olhou as duas do mesmo jeito.
  expect(
    Number(Math.abs(esquerdaAoVivo.aceso - direitaAoVivo.aceso).toFixed(3)),
    `premissa: as duas salas foram olhadas do mesmo jeito — ao vivo deram ${pct(esquerdaAoVivo.aceso)} e ${pct(direitaAoVivo.aceso)}`,
  ).toBeLessThanOrEqual(0.05)

  // A DOR, medida. As três cobranças são `soft` de propósito: uma rodada só
  // mostra os três números, em vez de parar na primeira. O teste continua
  // vermelho — `expect.soft` reprova o teste no fim.
  // 1) o que ele viu tem de continuar lá.
  for (const [nome, vivo, lembrada] of [
    ['esquerda', esquerdaAoVivo, esquerdaLembrada],
    ['direita', direitaAoVivo, direitaLembrada],
  ] as const) {
    expect
      .soft(
        Number((vivo.aceso - lembrada.aceso).toFixed(3)),
        `a sala da ${nome} encolheu ao virar memória: o jogador viu ${pct(vivo.aceso)} do recorte e a tela lembra ${pct(lembrada.aceso)}`,
      )
      .toBeLessThanOrEqual(0.03)
  }

  // 2) a borda da memória não pode ser escadinha: a borda da MESMA sala vista ao
  //    vivo, medida pela MESMA régua, é o teto (controle positivo (c)).
  for (const [nome, vivo, lembrada] of [
    ['esquerda', esquerdaAoVivo, esquerdaLembrada],
    ['direita', direitaAoVivo, direitaLembrada],
  ] as const) {
    expect
      .soft(
        lembrada.degraus,
        `a borda da memória da sala da ${nome} saiu em escadinha — ${lembrada.degraus} degraus (maior salto ${lembrada.maiorSalto} px) contra ${vivo.degraus} degraus (maior salto ${vivo.maiorSalto} px) da mesma borda vista ao vivo`,
      )
      .toBeLessThanOrEqual(vivo.degraus)
  }

  // 3) e as duas salas, olhadas do mesmo jeito, têm de aparecer igualmente completas.
  expect
    .soft(
      Number(Math.abs(esquerdaLembrada.aceso - direitaLembrada.aceso).toFixed(3)),
      `duas salas iguais, completudes diferentes na tela do jogador — esquerda ${pct(esquerdaLembrada.aceso)} contra direita ${pct(direitaLembrada.aceso)}`,
    )
    .toBeLessThanOrEqual(0.03)

  expect(errosDoJogador, 'exceção na página do jogador derruba o render e falsifica a foto').toEqual([])
})
