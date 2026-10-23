// JORNADA DE USUÁRIO — "o telhado da casa é de madeira verde: o mestre escolhe,
// o jogador de fora vê o telhado, entra e ele some, sai e ele volta, sem a
// névoa preta aparecer no meio" (pedido de 19/10/2026, Fase 3).
//
// O preparo é o de `task-jornada-teto-de-construcao.spec.ts` (o mestre é o app
// inteiro com o transporte de Tauri falsificado; o jogador é o `player.html`
// inteiro em outra aba; sala, vão, mobília magenta e token saem de gesto de
// ponteiro), e a geometria é a mesma:
//   Sala        384..896 x 128..384 (múltiplos de 64, na faixa livre do canvas,
//               entre o livro e a coluna da direita), parede de BAIXO apagada;
//   mobília     432..848 x 200..300 (retângulo magenta);
//   AMOSTRA     700..820 x 230..364 — dentro da Sala, longe do caminho da ficha
//               (x = 640) e a menos de 250 px de DENTRO e do vão: até o teto
//               fechar, a lanterna cobre a amostra inteira (nada nela escurece
//               antes de o telhado começar a voltar).
//
// COMO A TELA É MEDIDA, sem ler store nem pacote:
// * Fotos do canvas (como na jornada do teto) para a cor do telhado e para os
//   botões do editor.
// * O FADE é medido QUADRO A QUADRO dentro da página do jogador: um
//   `requestAnimationFrame` pedido depois do relógio do Pixi copia a AMOSTRA
//   do canvas de WebGL (no mesmo quadro em que o Pixi acabou de desenhar) para
//   um canvas 2D e guarda a média de cor. Nenhum estado do app entra na conta —
//   só os pixels que a pessoa vê, a cada quadro.
//
// O QUE A JORNADA COBRA:
//   1. o mestre liga o teto e escolhe Madeira + Verde no painel da Sala;
//   2. no editor, o olho de Telhados (Camadas) e o Transparente mudam o pixel da Sala;
//   3. o jogador de fora vê o telhado na cor escolhida (média perto de #4d5f4f,
//      verde mandando) e nada da mobília;
//   4. ele entra: o telhado some em no máximo 300 ms (mais 2 quadros de folga)
//      depois de começar a sumir;
//   5. ele sai: o telhado volta por cima da FOTO DA SALA — nos primeiros quadros
//      do fade a mobília ainda aparece por baixo dele (sem a foto o interior
//      sumiria no mesmo quadro em que o telhado começa a voltar) — e nenhum
//      quadro da transição fica mais escuro que o telhado e o interior.
//   PORTA DE FORA (pedido de 20/10/2026): uma parede solta sobre a borda de baixo
//      da Sala, à direita do vão, ganha uma porta FECHADA por gesto. De fora (no
//      passo 3 e de novo depois do 5) a porta aparece por cima do telhado: a
//      média do recorte dela fica perto da cor da porta e longe da do telhado.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'
import { pickTool } from './helpers/tools'
import { abrirPaginaDoLivro } from './helpers/livroDoMestre'

test.use({ trace: 'off', video: 'off' })

const CODE = 'TELHA1'
const MUNDO = { w: 30 * 64, h: 20 * 64 }
const VIEW = { width: 1280, height: 800 }
const RAIO = 250
const ROTULO_DO_TETO = 'Teto fechado para jogadores'

type Retangulo = { x0: number; y0: number; x1: number; y1: number }
type Ponto = { x: number; y: number }
type Rgb = { r: number; g: number; b: number }

const SALA: Retangulo = { x0: 384, y0: 128, x1: 896, y1: 384 }
const VAO = { x: (SALA.x0 + SALA.x1) / 2, y: SALA.y1 }
const MOBILIA: Retangulo = { x0: 432, y0: 200, x1: 848, y1: 300 }
/** Na tela do jogador o painel dele cobre o mundo à esquerda de x ~ 520: as amostras ficam à direita disso. */
const INTERIOR: Retangulo = { x0: 560, y0: 148, x1: 876, y1: 364 }
const AMOSTRA: Retangulo = { x0: 700, y0: 230, x1: 820, y1: 364 }
/** No editor: só o chão da Sala (abaixo da mobília, acima da parede). */
const AMOSTRA_DO_EDITOR: Retangulo = { x0: 700, y0: 312, x1: 820, y1: 372 }
const PONTO_DA_SALA: Ponto = { x: 500, y: 330 }
const FORA: Ponto = { x: 640, y: 540 }
const DENTRO: Ponto = { x: 640, y: 340 }

/**
 * PORTA DE FORA: parede solta de uma casa sobre a borda de baixo da Sala, longe
 * do caminho da ficha (x = 640 ± o raio dela) e abaixo das amostras, com a porta
 * no meio. O lado de fora dela (meia casa abaixo, (736, 416)) fica a ~160 px de
 * FORA: na lanterna. (A ficha para onde a régua de `lerTela` manda, perto de
 * (600, 600) do mapa; de lá ele fica a ~230 px, ainda dentro dos 250.)
 */
const PAREDE_DA_PORTA = { de: { x: 704, y: SALA.y1 }, ate: { x: 768, y: SALA.y1 } }
const PORTA: Ponto = { x: 736, y: SALA.y1 }
/** Linha do meio da tela, sem botão nenhum à direita: lá a ponta direita da moldura é a do mapa. */
const LINHA_DO_MEIO = 400
/**
 * Porta normal: vão de 32 px do mapa. A folha enche o vão inteiro desde
 * 22/10/2026 (`pixi/drawDoors.ts`); a amostra fica nos 60% do meio, como antes,
 * longe das pontas e do painel do jogador.
 */
const MEIO_DA_PORTA_NO_MAPA = (32 * 0.6) / 2
/**
 * O recorte pula o meio da porta (o ponto de PORTAS POR ATRAVESSAR tem 1,5 px
 * de tela de raio) e fica 2 px longe da ponta (o contorno escuro de 1 px fecha
 * a folha ali); na espessura, 1 px para cada lado do meio (a cor tem 3 px de
 * tela entre os dois contornos).
 */
const PULO_DO_MEIO_PX = 2.5
const FOLGA_DA_PONTA_PX = 2
const MEIA_FAIXA_PX = 1
/** Cor da porta fechada (`DOOR_COLOR`, `pixi/drawDoors.ts`): o creme de 22/10/2026. */
const COR_DA_PORTA: Rgb = { r: 0xd9, g: 0xd2, b: 0xc0 }
/** Longe da cor do telhado: a porta creme e a madeira verde ficam a mais de 110 por canal uma da outra. */
const LONGE_DO_TELHADO = 60
/** Verde da madeira (`lib/telhado/paletas.ts`). */
const VERDE_DA_MADEIRA: Rgb = { r: 0x4d, g: 0x5f, b: 0x4f }
/** Média do telhado perto da cor escolhida: a luz das águas e a fresta mexem no tom, a média fica. */
const PERTO_DA_COR = 30
/** Médias de cor que contam como "mudou" (as médias de 5 mil pixels quase não tremem). */
const MUDOU = 10
const ASSENTOU = 6
/** 300 ms do fade e 2 quadros de folga (a amostra cai no quadro, não no milissegundo). */
const TETO_DO_FADE_MS = 300 + 34
/** Nenhum quadro da volta pode ficar abaixo disto × o mais escuro entre o telhado e o interior. */
const PISO_DE_LUZ = 0.75
/** Regra da casa: nenhuma tarefa longa de 200 ms ou mais durante o gesto. */
const TAREFA_LONGA_MAXIMA_MS = 200
const PINTURA_MS = 400
const PAUSA_ANTES_DE_SOLTAR_MS = 120
const LIMIAR_DA_MOLDURA = 8
const COLUNA_DA_MOLDURA = 1100
/** Quanto tempo a página do jogador fica amostrando cada travessia (arrasto + resposta + fade). */
const AMOSTRAGEM_MS = 6000

type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>
interface Regua {
  origem: Ponto
  escala: number
}
interface Quadro {
  t: number
  r: number
  g: number
  b: number
  luz: number
  magenta: number
}

const distancia = (a: Rgb, b: Rgb) => Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
const hex = (c: Rgb) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`

async function caixaDoCanvas(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return box
}

async function fotografar(page: Page): Promise<string> {
  const foto: Foto = await page.locator('canvas').screenshot()
  return foto.toString('base64')
}

async function caixaDoPainel(page: Page): Promise<Retangulo> {
  const painel = await page.getByRole('complementary', { name: 'Painel do jogador' }).boundingBox()
  const canvas = await caixaDoCanvas(page)
  if (!painel) throw new Error('painel do jogador sem bounding box')
  return { x0: painel.x - canvas.x, y0: painel.y - canvas.y, x1: painel.x - canvas.x + painel.width, y1: painel.y - canvas.y + painel.height }
}

/** Média de cor (e fração magenta) de cada recorte da foto, em px de CSS do canvas. */
async function mediaDaFoto(page: Page, b64: string, recortes: Retangulo[]): Promise<(Rgb & { magenta: number })[]> {
  const box = await caixaDoCanvas(page)
  return page.evaluate(
    async ({ foto, rects, larguraCss }) => {
      const blob = await (await fetch(`data:image/png;base64,${foto}`)).blob()
      const bmp = await createImageBitmap(blob)
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const k = bmp.width / larguraCss
      return rects.map((r) => {
        let sr = 0
        let sg = 0
        let sb = 0
        let mag = 0
        let n = 0
        for (let py = Math.max(0, Math.round(r.y0 * k)); py < Math.min(height, Math.round(r.y1 * k)); py += 1) {
          for (let px = Math.max(0, Math.round(r.x0 * k)); px < Math.min(width, Math.round(r.x1 * k)); px += 1) {
            const i = (py * width + px) * 4
            sr += data[i]
            sg += data[i + 1]
            sb += data[i + 2]
            if (Math.min(data[i], data[i + 2]) - data[i + 1] >= 60) mag += 1
            n += 1
          }
        }
        return n === 0 ? { r: 0, g: 0, b: 0, magenta: 0 } : { r: sr / n, g: sg / n, b: sb / n, magenta: mag / n }
      })
    },
    { foto: b64, rects: recortes, larguraCss: box.width },
  )
}

/** Token azul do jogador, lido da foto dele, fora do painel. */
async function lerTela(page: Page, b64: string, painel: Retangulo) {
  const box = await caixaDoCanvas(page)
  return page.evaluate(
    async ({ foto, semPainel, larguraCss }) => {
      const blob = await (await fetch(`data:image/png;base64,${foto}`)).blob()
      const bmp = await createImageBitmap(blob)
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const k = bmp.width / larguraCss
      let somaX = 0
      let somaY = 0
      let n = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const xCss = x / k
          const yCss = y / k
          if (xCss >= semPainel.x0 && xCss <= semPainel.x1 && yCss >= semPainel.y0 && yCss <= semPainel.y1) continue
          const i = (y * width + x) * 4
          if (data[i + 2] > 170 && data[i + 2] - data[i] > 60 && data[i + 2] - data[i + 1] > 40) {
            somaX += x
            somaY += y
            n += 1
          }
        }
      }
      return { token: n === 0 ? null : { x: somaX / n / k, y: somaY / n / k } }
    },
    { foto: b64, semPainel: painel, larguraCss: box.width },
  )
}

const paraTela = (regua: Regua, p: Ponto): Ponto => ({ x: regua.origem.x + p.x * regua.escala, y: regua.origem.y + p.y * regua.escala })

function recorteNaTela(regua: Regua, r: Retangulo): Retangulo {
  const a = paraTela(regua, { x: r.x0, y: r.y0 })
  const b = paraTela(regua, { x: r.x1, y: r.y1 })
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }
}

const cruza = (a: Retangulo, b: Retangulo) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** As duas metades da porta na tela (sem o meio, onde pode estar o ponto claro), em px de CSS do canvas. */
function recortesDaPorta(regua: Regua): Retangulo[] {
  const c = paraTela(regua, PORTA)
  const ponta = MEIO_DA_PORTA_NO_MAPA * regua.escala - FOLGA_DA_PONTA_PX
  const faixa = { y0: c.y - MEIA_FAIXA_PX, y1: c.y + MEIA_FAIXA_PX }
  return [
    { x0: c.x - ponta, x1: c.x - PULO_DO_MEIO_PX, ...faixa },
    { x0: c.x + PULO_DO_MEIO_PX, x1: c.x + ponta, ...faixa },
  ]
}

/**
 * A régua da tela do jogador. A moldura do mapa é medida pela ALTURA (topo e
 * fundo na coluna da moldura) e a ponta direita numa linha do meio, onde não há
 * botão: a ponta esquerda fica debaixo do painel do jogador, e medir pela
 * largura erra o lugar de tudo (era a régua antiga, que reprovava as amostras).
 */
async function reguaPelaAltura(page: Page, b64: string): Promise<Regua> {
  const box = await caixaDoCanvas(page)
  const moldura = await page.evaluate(
    async ({ foto, larguraCss, limiarMoldura, linha, coluna }) => {
      const blob = await (await fetch(`data:image/png;base64,${foto}`)).blob()
      const bmp = await createImageBitmap(blob)
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const k = bmp.width / larguraCss
      const escuro = (px: number, py: number): boolean => {
        const i = (py * width + px) * 4
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < limiarMoldura
      }
      const px = Math.round(coluna * k)
      let topo = -1
      let fundo = -1
      for (let y = 0; y < height; y += 1) {
        if (!escuro(px, y)) continue
        if (topo < 0) topo = y
        fundo = y
      }
      const py = Math.round(linha * k)
      let direita = -1
      for (let x = 0; x < width; x += 1) if (escuro(x, py)) direita = x
      return { topo: topo / k, fundo: fundo / k, direita: direita / k }
    },
    { foto: b64, larguraCss: box.width, limiarMoldura: LIMIAR_DA_MOLDURA, linha: LINHA_DO_MEIO, coluna: COLUNA_DA_MOLDURA },
  )
  const escala = (moldura.fundo - moldura.topo + 1) / MUNDO.h
  if (!(escala > 0.5 && escala < 0.7)) throw new Error(`a moldura do mapa não foi reconhecida pela altura (escala ${escala.toFixed(3)})`)
  return { origem: { x: moldura.direita + 1 - MUNDO.w * escala, y: moldura.topo }, escala }
}

/** Média de cor das duas metades da porta numa foto nova da tela do jogador. */
async function corDaPorta(page: Page, painel: Retangulo): Promise<Rgb> {
  const foto = await fotografar(page)
  const recortes = recortesDaPorta(await reguaPelaAltura(page, foto))
  for (const r of recortes) expect(cruza(r, painel), 'o recorte da porta encosta no painel do jogador: contaria pixel de interface').toBe(false)
  const [a, b] = await mediaDaFoto(page, foto, recortes)
  return { r: (a.r + b.r) / 2, g: (a.g + b.g) / 2, b: (a.b + b.b) / 2 }
}

function conferirAPortaDeFora(porta: Rgb, quando: string): void {
  const relato = `${quando}: média da porta ${hex(porta)} (porta ${hex(COR_DA_PORTA)}, telhado ${hex(VERDE_DA_MADEIRA)})`
  test.info().annotations.push({ type: 'porta de fora', description: relato })
  expect(distancia(porta, COR_DA_PORTA), `${relato} — a porta não aparece por cima do telhado`).toBeLessThan(PERTO_DA_COR)
  expect(distancia(porta, VERDE_DA_MADEIRA), `${relato} — o recorte da porta ainda mostra o telhado`).toBeGreaterThan(LONGE_DO_TELHADO)
}

async function arrastar(page: Page, de: Ponto, ate: Ponto, passos = 14): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(ate.x, ate.y, { steps: passos })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/**
 * A régua vem da ALTURA da moldura (`reguaPelaAltura`), não da largura: o
 * painel do jogador (374 px de largura desde o livro novo) cobre a ponta
 * esquerda do mapa, e a ponta lida na linha 700 era a borda do painel.
 */
async function olhar(page: Page, painel: Retangulo): Promise<{ regua: Regua; token: Ponto }> {
  const foto = await fotografar(page)
  const lido = await lerTela(page, foto, painel)
  if (lido.token === null) throw new Error('o token azul do jogador não está desenhado na tela dele')
  return { regua: await reguaPelaAltura(page, foto), token: lido.token }
}

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
}

/**
 * Liga a amostragem quadro a quadro na página do jogador: a cada
 * `requestAnimationFrame` (pedido depois do relógio do Pixi, então no mesmo
 * quadro já desenhado) a AMOSTRA do canvas de WebGL é copiada para um 2D e a
 * média de cor vai para a lista. Só pixels.
 */
async function amostrarQuadros(page: Page, recorte: Retangulo, ms: number): Promise<void> {
  await page.evaluate(
    ({ r, duracao }) => {
      const gl = document.querySelector('canvas')
      if (!(gl instanceof HTMLCanvasElement)) throw new Error('sem canvas do jogador')
      const k = gl.width / gl.clientWidth
      const sx = Math.round(r.x0 * k)
      const sy = Math.round(r.y0 * k)
      const sw = Math.max(1, Math.round((r.x1 - r.x0) * k))
      const sh = Math.max(1, Math.round((r.y1 - r.y0) * k))
      const copia = document.createElement('canvas')
      copia.width = sw
      copia.height = sh
      const ctx = copia.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('sem 2d para amostrar')
      const quadros: { t: number; r: number; g: number; b: number; luz: number; magenta: number }[] = []
      const alvo = window as unknown as { __quadrosDoTelhado: typeof quadros; __amostrando: boolean; __tarefasLongas: number[] } // as: global de teste posto nesta página pelo próprio spec; lib.dom não o tipa
      alvo.__quadrosDoTelhado = quadros
      alvo.__amostrando = true
      // Tarefas longas da página durante a travessia (a pintura do telhado e a foto da sala incluídas).
      const tarefas: number[] = []
      alvo.__tarefasLongas = tarefas
      const observador = new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) tarefas.push(e.duration)
      })
      observador.observe({ type: 'longtask', buffered: false })
      const fim = performance.now() + duracao
      const passo = (t: number) => {
        ctx.clearRect(0, 0, sw, sh)
        ctx.drawImage(gl, sx, sy, sw, sh, 0, 0, sw, sh)
        const d = ctx.getImageData(0, 0, sw, sh).data
        let sr = 0
        let sg = 0
        let sb = 0
        let mag = 0
        const n = sw * sh
        for (let i = 0; i < d.length; i += 4) {
          sr += d[i]
          sg += d[i + 1]
          sb += d[i + 2]
          if (Math.min(d[i], d[i + 2]) - d[i + 1] >= 60) mag += 1
        }
        const media = { r: sr / n, g: sg / n, b: sb / n }
        quadros.push({ t, ...media, luz: 0.299 * media.r + 0.587 * media.g + 0.114 * media.b, magenta: mag / n })
        if (t < fim) requestAnimationFrame(passo)
        else {
          observador.disconnect()
          alvo.__amostrando = false
        }
      }
      requestAnimationFrame(passo)
    },
    { r: recorte, duracao: ms },
  )
}

async function quadrosAmostrados(page: Page): Promise<{ quadros: Quadro[]; tarefasLongas: number[] }> {
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __amostrando: boolean }).__amostrando), { timeout: AMOSTRAGEM_MS + 10_000 }) // as: global de teste posto nesta página pelo próprio spec; lib.dom não o tipa
    .toBe(false)
  return page.evaluate(() => {
    const alvo = window as unknown as { __quadrosDoTelhado: Quadro[]; __tarefasLongas: number[] } // as: global de teste posto nesta página pelo próprio spec; lib.dom não o tipa
    return { quadros: alvo.__quadrosDoTelhado, tarefasLongas: alvo.__tarefasLongas }
  })
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

/** Transporte do mestre falsificado por cima do stub de Tauri (o de `task-jornada-teto-de-construcao`). */
async function mestreNoTauri(page: Page, aoEnviar: (msg: unknown) => void): Promise<void> {
  await installTauriFsStub(page)
  await page.exposeFunction('__jornadaNetSend', (payload: { clientId: string; msg: unknown }) => aoEnviar(payload.msg))
  await page.addInitScript((codigo: string) => {
    const alvo = window as unknown as JanelaDoMestre // as: global de teste posto nesta página pelo próprio spec; lib.dom não o tipa
    const internals = alvo.__TAURI_INTERNALS__
    const base = internals.invoke.bind(internals)
    const callbacks = new Map<number, HandlerTauri>()
    const ouvintes = new Map<number, { event: string; handler: HandlerTauri }>()
    let proximoId = 1
    alvo.isTauri = true
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
      const a = (args ?? {}) as Record<string, unknown> // as: args do invoke do Tauri chegam como unknown; aqui só se lê campo por campo com String()/Number()
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

const ferramenta = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true }).click()
const interruptor = (page: Page, rotulo: string | RegExp) => page.locator('label.lb-switch').filter({ hasText: rotulo })
async function clicarInterruptor(page: Page, rotulo: string | RegExp): Promise<void> {
  await interruptor(page, rotulo).locator('.lb-switch__track').click()
  await page.waitForTimeout(PINTURA_MS)
}
const noCanvas = (box: { x: number; y: number }, p: Ponto): Ponto => ({ x: box.x + p.x, y: box.y + p.y })

/** Sala, vão e mobília magenta, por gesto (o mesmo passo a passo da jornada do teto). */
async function construirACasa(page: Page) {
  const box = await caixaDoCanvas(page)
  await pickTool(page, 'Sala')
  await arrastar(page, noCanvas(box, { x: SALA.x0, y: SALA.y0 }), noCanvas(box, { x: SALA.x1, y: SALA.y1 }))
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await pickTool(page, 'Borracha')
  await page.mouse.click(box.x + VAO.x, box.y + VAO.y)
  await ferramenta(page, 'Selecionar')
  await page.keyboard.press('Escape')
  await pickTool(page, 'Retângulo')
  await page.locator('#lb-draw-color').fill('#ff00ff')
  await clicarInterruptor(page, 'Preenchido')
  const opacidade = page.locator('#lb-draw-fillalpha')
  await opacidade.click()
  await opacidade.press('End')
  await arrastar(page, noCanvas(box, { x: MOBILIA.x0, y: MOBILIA.y0 }), noCanvas(box, { x: MOBILIA.x1, y: MOBILIA.y1 }))
  await page.keyboard.press('Escape')
  // PORTA DE FORA: a parede solta sobre a borda de baixo e a porta (fechada, como nasce) no meio dela.
  await pickTool(page, 'Parede')
  await arrastar(page, noCanvas(box, PAREDE_DA_PORTA.de), noCanvas(box, PAREDE_DA_PORTA.ate))
  await page.keyboard.press('Escape')
  await pickTool(page, 'Porta')
  await page.mouse.click(box.x + PORTA.x, box.y + PORTA.y)
  await page.waitForTimeout(PINTURA_MS)
  await page.keyboard.press('Escape')
  return box
}

async function abrirOPainelDaSala(page: Page, box: { x: number; y: number }): Promise<void> {
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(box.x + PONTO_DA_SALA.x, box.y + PONTO_DA_SALA.y)
  await expect(page.locator('#lb-room-name'), 'o clique dentro da construção tinha de abrir o painel da Sala').toBeVisible()
}

async function corDoEditor(page: Page): Promise<Rgb> {
  await page.waitForTimeout(PINTURA_MS)
  const [media] = await mediaDaFoto(page, await fotografar(page), [AMOSTRA_DO_EDITOR])
  return media
}

test('telhado de madeira verde: o mestre escolhe, o jogador de fora vê, entra e some em 300 ms, sai e volta sem névoa no meio', async ({ page, context }) => {
  test.setTimeout(300_000)
  const errosDoJogador: string[] = []
  let socket: WebSocketRoute | null = null
  await mestreNoTauri(page, (msg) => {
    if (socket !== null) socket.send(JSON.stringify(msg))
  })
  await enterEditor(page)
  const box = await construirACasa(page)

  // 1. O mestre liga o teto e escolhe Madeira + Verde.
  await abrirOPainelDaSala(page, box)
  await clicarInterruptor(page, ROTULO_DO_TETO)
  await expect(interruptor(page, ROTULO_DO_TETO).locator('input')).toBeChecked()
  const madeira = page.getByRole('radiogroup', { name: 'Modelo do telhado' }).getByRole('radio', { name: 'Madeira' })
  await madeira.click()
  await expect(madeira).toHaveAttribute('aria-checked', 'true')
  const verde = page.getByRole('radiogroup', { name: 'Cor do telhado' }).getByRole('radio', { name: 'Verde' })
  await verde.click()
  await expect(verde).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')

  // 2. No editor, o olho de Telhados (painel de Camadas) e o Transparente mudam o pixel da Sala.
  // Fatia 6 das camadas (decisão do usuário): o olho do mestre da camada Telhados substitui o botão "Telhados".
  await abrirPaginaDoLivro(page, 'Cena')
  const grupo = page.getByRole('group', { name: 'Telhados' })
  await expect(grupo, 'o Transparente mora na linha Telhados de Camadas').toBeVisible()
  const transparente = await corDoEditor(page)
  await grupo.locator('label.lb-switch').filter({ hasText: /^Transparente$/ }).locator('.lb-switch__track').click()
  const opaco = await corDoEditor(page)
  await page.getByRole('button', { name: 'Ocultar Telhados', exact: true }).click()
  const semTelhado = await corDoEditor(page)
  const doEditor = `transparente ${hex(transparente)} | opaco ${hex(opaco)} | sem telhado ${hex(semTelhado)}`
  expect(distancia(transparente, opaco), `Transparente não mudou o pixel — ${doEditor}`).toBeGreaterThan(MUDOU)
  expect(distancia(opaco, semTelhado), `Telhados não mudou o pixel — ${doEditor}`).toBeGreaterThan(MUDOU)
  expect(distancia(transparente, semTelhado), `o telhado transparente não aparece — ${doEditor}`).toBeGreaterThan(MUDOU)
  expect(distancia(opaco, VERDE_DA_MADEIRA), `o telhado opaco do editor não é a madeira verde — ${doEditor}`).toBeLessThan(PERTO_DA_COR)
  // Volta ao começo (ligado e transparente) para o resto da jornada e os prints.
  await page.getByRole('button', { name: 'Mostrar Telhados', exact: true }).click()
  await grupo.locator('label.lb-switch').filter({ hasText: /^Transparente$/ }).locator('.lb-switch__track').click()
  await abrirPaginaDoLivro(page, 'Ficha')

  // O token do jogador, a sala aberta, o jogador entra, a lanterna de 250 px e o personagem.
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  await page.getByLabel('Nome do novo token').fill('Heroi')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()
  await page.getByRole('tab', { name: 'Grupo' }).click()
  await page.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(page.getByRole('button', { name: new RegExp(`Código da sala ${CODE}`) })).toBeVisible()

  const jogador = await context.newPage()
  jogador.on('pageerror', (e) => errosDoJogador.push(e.message))
  await jogador.setViewportSize(VIEW)
  await jogador.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      socket = ws
      page.evaluate(() => (window as unknown as JanelaDoMestre).__emitTauri('net:peer', { clientId: '7', event: 'connected', name: 'Ana' })).catch(() => {}) // as: global de teste posto nesta página pelo próprio spec; lib.dom não o tipa
      ws.onMessage((raw) => {
        const texto = typeof raw === 'string' ? raw : raw.toString('utf8')
        page
          .evaluate((t: string) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: '7', msg: JSON.parse(t) }), texto) // as: global de teste posto nesta página pelo próprio spec; lib.dom não o tipa
          .catch(() => {})
      })
    },
  )
  await jogador.goto('/player.html')
  await jogador.getByLabel('Código da sala').fill(CODE)
  await jogador.getByLabel('Seu nome').fill('Ana')
  await jogador.getByRole('button', { name: 'Entrar' }).click()
  await expect(jogador.getByRole('status')).toHaveText(/Aguardando o mestre/)
  const raio = page.getByLabel('Raio de visão')
  await raio.click()
  await raio.press('Home')
  for (let passo = 0; passo < 4; passo += 1) await raio.press('ArrowRight')
  await expect(page.getByText(`${RAIO} px`)).toBeVisible()
  await page.getByRole('button', { name: /Heroi/ }).click({ timeout: 10_000 })
  await expect(jogador.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await jogador.getByLabel('Nomes').uncheck()
  await jogador.waitForTimeout(PINTURA_MS)
  const painel = await caixaDoPainel(jogador)

  // 3. De fora, o telhado na cor escolhida e nada da mobília.
  await andarAte(jogador, painel, FORA, 'o campo em frente à casa')
  await jogador.waitForTimeout(PINTURA_MS)
  const daRua = await olhar(jogador, painel)
  const amostraNaTela = recorteNaTela(daRua.regua, AMOSTRA)
  const interiorNaTela = recorteNaTela(daRua.regua, INTERIOR)
  for (const r of [interiorNaTela, amostraNaTela]) expect(cruza(r, painel), `a amostra encosta no painel do jogador: contaria pixel de interface (amostra ${JSON.stringify(r)}, painel ${JSON.stringify(painel)})`).toBe(false)
  const [deFora] = await mediaDaFoto(jogador, await fotografar(jogador), [interiorNaTela])
  const corDeFora = `média do telhado ${hex(deFora)}, mobília ${(deFora.magenta * 100).toFixed(1)}%`
  expect(distancia(deFora, VERDE_DA_MADEIRA), `de fora, o telhado não está na madeira verde — ${corDeFora}`).toBeLessThan(PERTO_DA_COR)
  expect(deFora.g > deFora.r && deFora.g > deFora.b, `de fora, o verde não manda no telhado — ${corDeFora}`).toBe(true)
  expect(deFora.magenta, `de fora, a mobília vaza pelo telhado — ${corDeFora}`).toBeLessThan(0.01)
  // PORTA DE FORA: o lado de fora dela está na lanterna, então ela aparece por cima do telhado.
  conferirAPortaDeFora(await corDaPorta(jogador, painel), 'de fora, antes de entrar')

  // 4. Entra: o telhado some em no máximo 300 ms depois de começar a sumir.
  await amostrarQuadros(jogador, amostraNaTela, AMOSTRAGEM_MS)
  await andarAte(jogador, painel, DENTRO, 'dentro da casa')
  const { quadros: entrando, tarefasLongas: longasNaEntrada } = await quadrosAmostrados(jogador)
  const fechado = entrando[0]
  const aberto = entrando[entrando.length - 1]
  expect(aberto.magenta, 'controle: com o jogador dentro a mobília tem de aparecer na amostra (a amostragem lê o canvas de verdade)').toBeGreaterThan(0.2)
  const i0 = entrando.findIndex((q) => distancia(q, fechado) > MUDOU)
  // Assentou = 90% do caminho (ou ASSENTOU, se for maior). Medido em 22/10/2026:
  // depois que o telhado some, a lanterna ainda anda com a ficha e tinge a
  // amostra em até ~20 por canal (verde sobe e volta, azul o contrário) por uns
  // 500 ms; com só ASSENTOU, essa luz contava como telhado sumindo.
  const assentou = Math.max(ASSENTOU, 0.1 * distancia(fechado, aberto))
  const i1 = entrando.findIndex((q, i) => i >= i0 && distancia(q, aberto) < assentou)
  expect(i0, 'o telhado nunca começou a sumir').toBeGreaterThan(0)
  const sumiuEm = entrando[i1].t - entrando[i0].t
  const quadrosDoFade = entrando
    .slice(Math.max(0, i0 - 1), i1 + 2)
    .map((q) => `${(q.t - entrando[i0].t).toFixed(0)}ms ${hex(q)} m${(q.magenta * 100).toFixed(0)}%`)
    .join(' | ')
  expect(sumiuEm, `o telhado levou ${sumiuEm.toFixed(0)} ms para sumir (meta 300 ms) — ${quadrosDoFade}`).toBeLessThanOrEqual(TETO_DO_FADE_MS)
  const meioDaEntrada = entrando.reduce((perto, q) => (Math.abs(q.t - entrando[i0].t - 150) < Math.abs(perto.t - entrando[i0].t - 150) ? q : perto))

  // 5. Sai: o telhado volta e nenhum quadro escurece (a névoa preta não aparece por baixo).
  await amostrarQuadros(jogador, amostraNaTela, AMOSTRAGEM_MS)
  await andarAte(jogador, painel, FORA, 'de volta ao campo')
  const { quadros: saindo, tarefasLongas: longasNaSaida } = await quadrosAmostrados(jogador)
  const deDentro = saindo[0]
  const deVolta = saindo[saindo.length - 1]
  expect(deVolta.magenta, 'depois de sair, a mobília continua à vista: o telhado não voltou').toBeLessThan(0.01)
  expect(distancia(deVolta, VERDE_DA_MADEIRA), `depois de sair, o telhado não voltou verde (${hex(deVolta)})`).toBeLessThan(PERTO_DA_COR)
  const j0 = saindo.findIndex((q) => distancia(q, deDentro) > MUDOU)
  expect(j0, 'o telhado nunca começou a voltar').toBeGreaterThan(0)
  const piso = PISO_DE_LUZ * Math.min(deDentro.luz, deVolta.luz)
  const maisEscuro = saindo.reduce((pior, q) => (q.luz < pior.luz ? q : pior))
  const meioDaSaida = saindo.reduce((perto, q) => (Math.abs(q.t - saindo[j0].t - 150) < Math.abs(perto.t - saindo[j0].t - 150) ? q : perto))
  const relatorio =
    `entrada: some em ${sumiuEm.toFixed(0)} ms, meio ${hex(meioDaEntrada)} | saída: dentro luz ${deDentro.luz.toFixed(0)}, ` +
    `telhado luz ${deVolta.luz.toFixed(0)}, meio do fade ${hex(meioDaSaida)} luz ${meioDaSaida.luz.toFixed(0)}, ` +
    `quadro mais escuro luz ${maisEscuro.luz.toFixed(0)} (piso ${piso.toFixed(0)}), ${saindo.length} quadros, ` +
    `quadros com a mobília por baixo do telhado voltando ${saindo.filter((q, i) => i >= j0 && distancia(q, deDentro) > MUDOU && q.magenta >= 0.5 * deDentro.magenta).length}`
  const tarefaMaisLonga = Math.max(0, ...longasNaEntrada, ...longasNaSaida)
  const intervalos = [...entrando, ...saindo].slice(1).map((q, i, todos) => (i === 0 ? 0 : q.t - todos[i - 1].t)).filter((d) => d > 0 && d < 1000).sort((a, b) => a - b)
  const quadroP95 = intervalos[Math.floor(intervalos.length * 0.95)] ?? 0
  const fluidez = `tarefa longa máx ${tarefaMaisLonga.toFixed(0)} ms (${longasNaEntrada.length + longasNaSaida.length} tarefas), quadro p95 ${quadroP95.toFixed(1)} ms`
  test.info().annotations.push({ type: 'telhado', description: `${doEditor} | ${corDeFora} | ${relatorio} | ${fluidez}` })
  expect(tarefaMaisLonga, `travou durante a travessia — ${fluidez}`).toBeLessThan(TAREFA_LONGA_MAXIMA_MS)
  expect(maisEscuro.luz, `um quadro da volta do telhado escureceu: névoa preta por baixo — ${relatorio}`).toBeGreaterThanOrEqual(piso)
  // A foto da sala: com o telhado já voltando, a mobília continua por baixo dele em algum quadro.
  const comInteriorPorBaixo = saindo.filter((q, i) => i >= j0 && distancia(q, deDentro) > MUDOU && q.magenta >= 0.5 * deDentro.magenta).length
  expect(comInteriorPorBaixo, `o interior sumiu no mesmo quadro em que o telhado começou a voltar (sem a foto da sala) — ${relatorio}`).toBeGreaterThan(0)
  // PORTA DE FORA de novo, com o telhado de volta.
  conferirAPortaDeFora(await corDaPorta(jogador, painel), 'de fora, depois de sair')

  // Prints de layout: editor 1440 com o painel da Sala, jogador 1440 e 390 de fora.
  await page.setViewportSize({ width: 1440, height: 900 })
  await abrirPaginaDoLivro(page, 'Ficha')
  await abrirOPainelDaSala(page, await caixaDoCanvas(page))
  await page.waitForTimeout(PINTURA_MS)
  await page.screenshot({ path: test.info().outputPath('editor-1440-telhado-transparente.png') })
  await jogador.setViewportSize({ width: 1440, height: 900 })
  await jogador.waitForTimeout(PINTURA_MS * 2)
  await jogador.screenshot({ path: test.info().outputPath('jogador-1440-fora.png') })
  await jogador.setViewportSize({ width: 390, height: 844 })
  await jogador.waitForTimeout(PINTURA_MS * 2)
  await jogador.screenshot({ path: test.info().outputPath('jogador-390-fora.png') })

  expect(errosDoJogador, 'exceção na página do jogador derruba o render e falsifica a foto').toEqual([])
})
