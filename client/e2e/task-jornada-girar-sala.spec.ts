// JORNADA — "quero GIRAR a sala inteira, com parede e porta junto".
//
// O mestre desenhou o cômodo em pé e percebe que ele tinha de estar deitado.
// Hoje a única saída é apagar e redesenhar (paredes, portas e sub-salas de
// novo). O que esta régua cobra é a feature que falta:
//
//   - com a sala selecionada (Selecionar), uma ALÇA DE GIRAR — bolinha acima
//     do topo da caixa, ligada por um traço fino; arrastar gira ao vivo em
//     torno do centro; com Shift, de 15 em 15 graus;
//   - no painel, o campo "Rotação" (graus, Enter confirma) e os botões
//     "−90°" / "+90°";
//   - giram sala, sub-salas, paredes e portas; o conteúdo (fichas) fica;
//   - um Ctrl+Z desfaz o giro inteiro de um arrasto;
//   - sala travada não mostra a alça e o campo fica desabilitado.
//
// TUDO é provado pela TELA. O gesto é ponteiro e teclado de verdade (pausa
// antes de apertar e antes de soltar, movimento em passos); a alça é achada
// pelo PIXEL (diferença entre a foto com e sem seleção, na faixa acima do
// topo da sala), nunca por coordenada da store. A forma da sala é medida pela
// cor do chão ao longo de uma linha e de uma coluna. A store só entra no
// PREPARO: mapa limpo (como as jornadas vizinhas) e a ficha do caso 6, porque
// a ferramenta Token está escondida por feature flag (FEATURES.tokenTool).
//
// VERMELHO ESPERADO HOJE: o caso 1 (controle) passa; os casos 2-7 caem em
// "a alça de girar não apareceu" ou "o painel não tem o campo Rotação".
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

test.use({ trace: 'off', video: 'off' })

/** Coluna da esquerda (PropertiesPanel) — o corpo rolável, sem o cabeçalho. */
const PAINEL = '.lb-inspector__body'

/** Espera de controle que existe OU não existe: curta, para a ausência falhar rápido. */
const ESPERA_CONTROLE = 3000

/**
 * A sala da jornada: 2 x 6 quadrados de 64 px, em pé. Câmera 1:1 e canvas em
 * (0,0), então mundo = tela. O topo fica em y=256 para a alça (acima do topo)
 * não cair embaixo da barra de ferramentas, que termina em y~102.
 */
const SALA = { x0: 576, y0: 256, x1: 704, y1: 640 }
const CENTRO = { x: (SALA.x0 + SALA.x1) / 2, y: (SALA.y0 + SALA.y1) / 2 } // (640, 448)

/**
 * Onde se lê a cor do chão e por onde passam a LINHA e a COLUNA de medida.
 * (+40,+40) do centro: dentro da sala em pé E da sala deitada, e fora da
 * pílula do nome (ancorada no centro, ~106 x 36 px).
 */
const CHAO = { x: CENTRO.x + 40, y: CENTRO.y + 40 } // (680, 488)

/** Canto vazio: clicar aqui com Selecionar tira a seleção. */
const VAZIO = { x: 1120, y: 720 }

/** Faixa onde a alça tem de aparecer: acima do topo, perto do eixo vertical do centro. */
const FAIXA_DA_ALCA = { x0: CENTRO.x - 24, x1: CENTRO.x + 24, y0: SALA.y0 - 130, y1: SALA.y0 - 10 }

/** Cor da ficha do caso 6 — magenta, que não existe em nenhum outro lugar da tela. */
const COR_DA_FICHA = '#e0209a'
const RGB_DA_FICHA: [number, number, number] = [0xe0, 0x20, 0x9a]
/** A ficha: dentro da sala em pé, perto do pé dela; fora da sala depois do giro. */
const FICHA = { x: CENTRO.x, y: CENTRO.y + 144 } // (640, 592)
/** Onde a ficha iria parar se girasse junto (90° horário e anti-horário). */
const FICHA_GIRADA = [
  { x: CENTRO.x - 144, y: CENTRO.y },
  { x: CENTRO.x + 144, y: CENTRO.y },
]

type Ponto = { x: number; y: number }
type Rgb = [number, number, number]
/** O que `locator.screenshot()` devolve — sem @types/node nos e2e, o tipo vem da API. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

async function fotoDoCanvas(page: Page): Promise<{ foto: Foto; largura: number }> {
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { foto: await canvas.screenshot(), largura: box.width }
}

/**
 * Decodifica a(s) foto(s) no próprio navegador (canvas 2D descartável) e roda
 * a medida lá dentro — nenhum estado do app é lido ou tocado, e só o
 * resultado pequeno volta para o teste.
 */
type Medida =
  | { tipo: 'amostra'; pontos: Ponto[] }
  | { tipo: 'forma'; chao: Rgb; linhaY: number; colunaX: number }
  | { tipo: 'alca'; faixa: { x0: number; x1: number; y0: number; y1: number } }

type Resultado = {
  amostras: { luz: number; rgb: Rgb }[]
  forma: { largura: number; altura: number }
  alca: { x: number; y: number; pixels: number } | null
}

async function medir(page: Page, fotos: Foto[], larguraCss: number, medida: Medida): Promise<Resultado> {
  return page.evaluate(
    async ({ b64s, larguraCss, medida }) => {
      const decodificar = async (b64: string) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
        const bmp = await createImageBitmap(blob)
        const canvas = document.createElement('canvas')
        canvas.width = bmp.width
        canvas.height = bmp.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('sem contexto 2d para ler a foto')
        ctx.drawImage(bmp, 0, 0)
        return ctx.getImageData(0, 0, bmp.width, bmp.height)
      }
      const imagens = await Promise.all(b64s.map(decodificar))
      const { width, height } = imagens[0]
      const escala = width / larguraCss
      const em = (img: ImageData, x: number, y: number): [number, number, number] => {
        const cx = Math.min(width - 1, Math.max(0, Math.round(x * escala)))
        const cy = Math.min(height - 1, Math.max(0, Math.round(y * escala)))
        const i = (cy * width + cx) * 4
        return [img.data[i], img.data[i + 1], img.data[i + 2]]
      }
      const dist = (a: number[], b: number[]) =>
        Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
      const vazio = { amostras: [], forma: { largura: 0, altura: 0 }, alca: null }

      if (medida.tipo === 'amostra') {
        const img = imagens[0]
        const amostras = medida.pontos.map((p) => {
          // Luminância MÁXIMA de uma janela 7x7 (em px de CSS): a linha da
          // parede tem 1-3 px e pode cair meio pixel para qualquer lado.
          let luz = 0
          for (let dy = -3; dy <= 3; dy += 1) {
            for (let dx = -3; dx <= 3; dx += 1) {
              const [r, g, b] = em(img, p.x + dx, p.y + dy)
              luz = Math.max(luz, 0.299 * r + 0.587 * g + 0.114 * b)
            }
          }
          return { luz: Math.round(luz), rgb: em(img, p.x, p.y) }
        })
        return { ...vazio, amostras }
      }

      if (medida.tipo === 'forma') {
        // Quantos pixels da LINHA y=linhaY e da COLUNA x=colunaX têm a cor do
        // chão: é a largura e a altura da sala como o usuário vê.
        const img = imagens[0]
        let largura = 0
        for (let x = 0; x < larguraCss; x += 1) if (dist(em(img, x, medida.linhaY), medida.chao) < 28) largura += 1
        let altura = 0
        const alturaCss = height / escala
        for (let y = 0; y < alturaCss; y += 1) if (dist(em(img, medida.colunaX, y), medida.chao) < 28) altura += 1
        return { ...vazio, forma: { largura, altura } }
      }

      // 'alca': o que mudou na faixa acima do topo entre a foto SEM seleção
      // (imagens[0]) e a foto COM seleção (imagens[1]). A bolinha é o grupo de
      // pixels mais alto; o traço fino desce dela até a caixa. Centro = média
      // dos pixels que mudaram nos 12 px abaixo do pixel mais alto.
      const [sem, com] = imagens
      const mudou: { x: number; y: number }[] = []
      const f = medida.faixa
      for (let y = f.y0; y <= f.y1; y += 1) {
        for (let x = f.x0; x <= f.x1; x += 1) {
          if (dist(em(sem, x, y), em(com, x, y)) > 40) mudou.push({ x, y })
        }
      }
      if (mudou.length === 0) return { ...vazio, alca: null }
      const topo = Math.min(...mudou.map((p) => p.y))
      const bolinha = mudou.filter((p) => p.y <= topo + 12)
      const x = bolinha.reduce((s, p) => s + p.x, 0) / bolinha.length
      const y = bolinha.reduce((s, p) => s + p.y, 0) / bolinha.length
      return { ...vazio, alca: { x, y, pixels: mudou.length } }
    },
    { b64s: fotos.map((f) => f.toString('base64')), larguraCss, medida },
  )
}

// ---------------------------------------------------------------------------
// Gestos
// ---------------------------------------------------------------------------

/** Um clique de ponteiro com pausa antes de soltar. */
async function clicar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.waitForTimeout(40)
  await page.mouse.down()
  await page.waitForTimeout(60)
  await page.mouse.up()
  await page.waitForTimeout(120)
}

/**
 * Logo depois de nascer, a Sala pede o nome num campo sobre o próprio mapa e
 * esse campo rouba o foco — Esc mantém o nome padrão. Se não aparecer, segue.
 */
async function dispensarCampoDeNomeSobreOMapa(page: Page): Promise<void> {
  const campo = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  const apareceu = await campo.waitFor({ state: 'visible', timeout: 1500 }).then(
    () => true,
    () => false,
  )
  if (apareceu) await campo.press('Escape')
}

/** Desenha a sala 2 x 6 com a ferramenta Sala (1 arrasto canto a canto). */
async function desenharSalaEmPe(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sala', exact: true }).click()
  await page.mouse.move(SALA.x0, SALA.y0)
  await page.waitForTimeout(40)
  await page.mouse.down()
  await page.mouse.move(SALA.x1, SALA.y1, { steps: 12 })
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(120)
  await dispensarCampoDeNomeSobreOMapa(page)
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()
}

async function desselecionar(page: Page): Promise<void> {
  await clicar(page, VAZIO)
  await page.waitForTimeout(150)
}

async function selecionarSala(page: Page): Promise<void> {
  await clicar(page, CHAO)
  await expect(
    page.locator(`${PAINEL} h2:visible`).filter({ hasText: /^sala$/i }).first(),
    'clicar no chão da sala com Selecionar não abriu o painel da Sala',
  ).toBeVisible({ timeout: ESPERA_CONTROLE })
  await page.waitForTimeout(150)
}

/** Cor do chão lida na foto SEM seleção (o realce não entra). */
async function corDoChao(page: Page): Promise<Rgb> {
  const { foto, largura } = await fotoDoCanvas(page)
  const r = await medir(page, [foto], largura, { tipo: 'amostra', pontos: [CHAO] })
  return r.amostras[0].rgb
}

/** Largura e altura da sala na tela, pela cor do chão. */
async function formaNaTela(page: Page, chao: Rgb): Promise<{ largura: number; altura: number }> {
  const { foto, largura } = await fotoDoCanvas(page)
  const r = await medir(page, [foto], largura, { tipo: 'forma', chao, linhaY: CHAO.y, colunaX: CHAO.x })
  return r.forma
}

const ehAlta = (f: { largura: number; altura: number }) => f.altura > f.largura * 1.8 && f.largura > 40
const ehLarga = (f: { largura: number; altura: number }) => f.largura > f.altura * 1.8 && f.altura > 40

/**
 * Acha a alça de girar PELO PIXEL: foto sem seleção, seleciona, foto com
 * seleção, e procura o que apareceu na faixa acima do topo da sala. É AQUI
 * que a régua fica vermelha hoje — a faixa não muda nada ao selecionar.
 * Termina com a sala SELECIONADA.
 */
async function acharAlca(page: Page): Promise<Ponto> {
  await desselecionar(page)
  const sem = await fotoDoCanvas(page)
  await selecionarSala(page)
  const com = await fotoDoCanvas(page)
  const r = await medir(page, [sem.foto, com.foto], sem.largura, { tipo: 'alca', faixa: FAIXA_DA_ALCA })
  expect(
    r.alca,
    `a alça de girar não apareceu: selecionar a sala não desenhou nada na faixa acima do topo ` +
      `(x ${FAIXA_DA_ALCA.x0}-${FAIXA_DA_ALCA.x1}, y ${FAIXA_DA_ALCA.y0}-${FAIXA_DA_ALCA.y1})`,
  ).not.toBeNull()
  const alca = r.alca as { x: number; y: number }
  return { x: alca.x, y: alca.y }
}

/**
 * Arrasta a alça num ARCO em volta do centro até `graus` (0 = em cima,
 * positivo = sentido horário), em passos, com pausa antes de apertar e antes
 * de soltar. `shift` segura a tecla durante o arrasto.
 */
async function girarPelaAlca(page: Page, alca: Ponto, graus: number, shift = false): Promise<void> {
  const raio = Math.hypot(alca.x - CENTRO.x, alca.y - CENTRO.y)
  const inicio = Math.atan2(alca.x - CENTRO.x, CENTRO.y - alca.y)
  await page.mouse.move(alca.x, alca.y)
  await page.waitForTimeout(80)
  await page.mouse.down()
  await page.waitForTimeout(80)
  if (shift) await page.keyboard.down('Shift')
  const PASSOS = 12
  for (let i = 1; i <= PASSOS; i += 1) {
    const a = inicio + ((graus * Math.PI) / 180) * (i / PASSOS)
    await page.mouse.move(CENTRO.x + raio * Math.sin(a), CENTRO.y - raio * Math.cos(a), { steps: 3 })
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(200)
  await page.mouse.up()
  if (shift) await page.keyboard.up('Shift')
  await page.waitForTimeout(200)
}

/** Campo "Rotação" do painel da sala — procurado pelo rótulo que o usuário lê. */
function campoRotacao(page: Page) {
  return page.locator(PAINEL).getByLabel(/^\s*rota[cç][aã]o/i).first()
}

async function esperarCampoRotacao(page: Page) {
  const campo = campoRotacao(page)
  await expect(campo, 'o painel da sala não tem o campo "Rotação"').toBeVisible({ timeout: ESPERA_CONTROLE })
  return campo
}

/** Botão de +90° / −90° pelo texto visível (aceita "−" U+2212 ou hífen). */
function botaoGiro(page: Page, sinal: '+' | '-') {
  const texto = sinal === '+' ? /^\s*\+\s*90\s*°\s*$/ : /^\s*[−-]\s*90\s*°\s*$/
  return page.locator(PAINEL).getByRole('button').filter({ hasText: texto }).first()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  // Mapa limpo: a foto do canvas tem de ter só o que a jornada desenhou.
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.loadMap(mapFactory.createEmptyMap('map_e2e_girar_sala', 'E2E Girar sala', 30, 20, 64))
    store.setActiveTool('select')
  })
  await desenharSalaEmPe(page)
})

// ---------------------------------------------------------------------------
// 1. CONTROLE POSITIVO — tem de passar HOJE. Prova que o preparo e o medidor
//    de forma funcionam; sem ele, os vermelhos abaixo não valem nada.
// ---------------------------------------------------------------------------
test('1. controle: a sala 2x6 nasce em pé, o painel da Sala abre e a tela mede mais alta que larga', async ({ page }) => {
  await desselecionar(page)
  const chao = await corDoChao(page)
  const forma = await formaNaTela(page, chao)
  expect(
    ehAlta(forma),
    `a sala 2x6 deveria aparecer em pé na tela (largura=${forma.largura}px, altura=${forma.altura}px, chão=${chao.join(',')})`,
  ).toBe(true)
  // Medida bate com o desenho (128 x 384, menos parede e pílula do nome).
  expect(forma.largura, 'largura medida longe de 128 px').toBeGreaterThan(100)
  expect(forma.largura, 'largura medida longe de 128 px').toBeLessThan(140)
  expect(forma.altura, 'altura medida longe de 384 px').toBeGreaterThan(300)

  await selecionarSala(page)
  await expect(page.locator(PAINEL).getByLabel('Nome', { exact: true })).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2. Arrastar a alça 90° deita a sala, e a parede vai junto.
// ---------------------------------------------------------------------------
test('2. arrastar a alça 90° em volta do centro deixa a sala larga, com a parede na borda nova', async ({ page }) => {
  await desselecionar(page)
  const chao = await corDoChao(page)
  const PAREDE_VELHA = { x: SALA.x0, y: SALA.y1 - 40 } // borda esquerda da sala em pé, perto do pé
  const PAREDE_NOVA = { x: CENTRO.x + 150, y: CENTRO.y - 64 } // borda de cima da sala deitada
  const antes = await fotoDoCanvas(page)
  const [paredeVelhaAntes, paredeNovaAntes, chaoAntes] = (
    await medir(page, [antes.foto], antes.largura, { tipo: 'amostra', pontos: [PAREDE_VELHA, PAREDE_NOVA, CHAO] })
  ).amostras
  // Calibração: a parede em pé é clara contra o chão, e a borda nova ainda é fundo.
  expect(paredeVelhaAntes.luz - chaoAntes.luz, 'a parede da sala em pé não se destaca do chão').toBeGreaterThan(30)
  const limiar = chaoAntes.luz + (paredeVelhaAntes.luz - chaoAntes.luz) * 0.6
  expect(paredeNovaAntes.luz, 'a borda da sala deitada já era clara antes do giro').toBeLessThan(limiar)

  const alca = await acharAlca(page)
  await girarPelaAlca(page, alca, 90)
  await desselecionar(page)

  const forma = await formaNaTela(page, chao)
  expect(
    ehLarga(forma),
    `depois de arrastar a alça 90°, a sala continua em pé (largura=${forma.largura}px, altura=${forma.altura}px)`,
  ).toBe(true)

  const depois = await fotoDoCanvas(page)
  const [paredeVelha, paredeNova] = (
    await medir(page, [depois.foto], depois.largura, { tipo: 'amostra', pontos: [PAREDE_VELHA, PAREDE_NOVA] })
  ).amostras
  expect(
    paredeNova.luz,
    `a linha clara da parede não acompanhou a borda de cima da sala deitada em x=${PAREDE_NOVA.x}, y=${PAREDE_NOVA.y}`,
  ).toBeGreaterThan(limiar)
  expect(
    paredeVelha.luz,
    `a parede ficou para trás na borda velha em x=${PAREDE_VELHA.x}, y=${PAREDE_VELHA.y}`,
  ).toBeLessThan(limiar)
})

// ---------------------------------------------------------------------------
// 3. Com Shift, o giro anda de 15 em 15 graus.
// ---------------------------------------------------------------------------
test('3. arrastar a alça até ~37° com Shift para num múltiplo de 15 no campo Rotação', async ({ page }) => {
  const alca = await acharAlca(page)
  await girarPelaAlca(page, alca, 37, true)

  const campo = await esperarCampoRotacao(page)
  const valor = Number((await campo.inputValue()).replace(',', '.'))
  expect(Number.isFinite(valor), `o campo Rotação não mostra um número: "${await campo.inputValue()}"`).toBe(true)
  expect(((valor % 360) + 360) % 360, 'o arrasto com Shift não girou nada (Rotação = 0)').not.toBe(0)
  expect(Math.abs(valor % 15), `com Shift a rotação deveria andar de 15 em 15°, mas o campo mostra ${valor}`).toBe(0)
})

// ---------------------------------------------------------------------------
// 4. Campo e botões do painel.
// ---------------------------------------------------------------------------
test('4. digitar 90 + Enter no campo Rotação deita a sala, e +90° a põe em pé de novo', async ({ page }) => {
  await desselecionar(page)
  const chao = await corDoChao(page)
  await selecionarSala(page)

  const campo = await esperarCampoRotacao(page)
  await campo.click()
  await campo.press('Control+a')
  await campo.pressSequentially('90', { delay: 30 })
  await campo.press('Enter')
  await page.waitForTimeout(200)
  await desselecionar(page)
  const deitada = await formaNaTela(page, chao)
  expect(
    ehLarga(deitada),
    `90 + Enter no campo Rotação não deitou a sala (largura=${deitada.largura}px, altura=${deitada.altura}px)`,
  ).toBe(true)

  await selecionarSala(page)
  const mais90 = botaoGiro(page, '+')
  await expect(mais90, 'o painel da sala não tem o botão "+90°"').toBeVisible({ timeout: ESPERA_CONTROLE })
  await expect(botaoGiro(page, '-'), 'o painel da sala não tem o botão "−90°"').toBeVisible({
    timeout: ESPERA_CONTROLE,
  })
  await mais90.click()
  await page.waitForTimeout(200)
  await desselecionar(page)
  const emPe = await formaNaTela(page, chao)
  expect(
    ehAlta(emPe),
    `+90° depois de 90° deveria pôr a sala em pé (180°), mas a tela mede largura=${emPe.largura}px, altura=${emPe.altura}px`,
  ).toBe(true)
})

// ---------------------------------------------------------------------------
// 5. Um Ctrl+Z desfaz o arrasto de giro inteiro.
// ---------------------------------------------------------------------------
test('5. depois de um arrasto de giro, um Ctrl+Z devolve a sala em pé', async ({ page }) => {
  await desselecionar(page)
  const chao = await corDoChao(page)

  const alca = await acharAlca(page)
  await girarPelaAlca(page, alca, 90)
  await desselecionar(page)
  const girada = await formaNaTela(page, chao)
  expect(ehLarga(girada), `o arrasto de giro não deitou a sala (largura=${girada.largura}, altura=${girada.altura})`).toBe(
    true,
  )

  await page.keyboard.press('Control+z')
  await page.waitForTimeout(250)
  const desfeita = await formaNaTela(page, chao)
  expect(
    ehAlta(desfeita),
    `um Ctrl+Z não desfez o giro inteiro: a sala não voltou em pé (largura=${desfeita.largura}px, altura=${desfeita.altura}px)`,
  ).toBe(true)
})

// ---------------------------------------------------------------------------
// 6. O que está dentro fica no lugar.
// ---------------------------------------------------------------------------
test('6. a ficha dentro da sala continua no mesmo ponto da tela depois do giro', async ({ page }) => {
  await desselecionar(page)
  const chao = await corDoChao(page)
  // Preparo: ficha pela store (FEATURES.tokenTool esconde a ferramenta Token).
  await page.evaluate(
    async ({ x, y, cor }) => {
      const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
      store.addToken({ id: 'tk_girar_sala', characterId: null, name: 'Guarda', x, y, size: 1, image: null, color: cor })
      store.setSelection([])
    },
    { x: FICHA.x, y: FICHA.y, cor: COR_DA_FICHA },
  )
  await page.waitForTimeout(200)

  const antes = await fotoDoCanvas(page)
  const [fichaAntes] = (await medir(page, [antes.foto], antes.largura, { tipo: 'amostra', pontos: [FICHA] })).amostras
  const dist = (a: Rgb, b: Rgb) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
  // Controle: a ficha aparece onde foi posta, com a cor dela.
  expect(
    dist(fichaAntes.rgb, RGB_DA_FICHA),
    `a ficha não apareceu magenta em x=${FICHA.x}, y=${FICHA.y} (cor lida ${fichaAntes.rgb.join(',')})`,
  ).toBeLessThan(40)

  const alca = await acharAlca(page)
  await girarPelaAlca(page, alca, 90)
  await desselecionar(page)

  const forma = await formaNaTela(page, chao)
  expect(ehLarga(forma), `o arrasto de giro não deitou a sala (largura=${forma.largura}, altura=${forma.altura})`).toBe(true)

  const depois = await fotoDoCanvas(page)
  const [fichaDepois, ...giradas] = (
    await medir(page, [depois.foto], depois.largura, { tipo: 'amostra', pontos: [FICHA, ...FICHA_GIRADA] })
  ).amostras
  expect(
    dist(fichaDepois.rgb, RGB_DA_FICHA),
    `a ficha saiu do lugar com o giro: em x=${FICHA.x}, y=${FICHA.y} a cor virou ${fichaDepois.rgb.join(',')}`,
  ).toBeLessThan(40)
  for (let i = 0; i < giradas.length; i += 1) {
    expect(
      dist(giradas[i].rgb, RGB_DA_FICHA),
      `a ficha girou junto com a sala e apareceu em x=${FICHA_GIRADA[i].x}, y=${FICHA_GIRADA[i].y}`,
    ).toBeGreaterThan(80)
  }
})

// ---------------------------------------------------------------------------
// 7. Sala travada não gira.
// ---------------------------------------------------------------------------
test('7. sala travada não mostra a alça de girar e o campo Rotação fica desabilitado', async ({ page }) => {
  // Controle: sem trava, a alça aparece. Sem isto, "a alça sumiu" passaria
  // num app que nunca desenhou alça nenhuma.
  await acharAlca(page)

  const linhaTravado = page.locator(`${PAINEL} label.lb-switch`).filter({ hasText: /travad|trancad/i }).first()
  await expect(linhaTravado, 'o painel da sala não tem o interruptor "Travado"').toBeVisible({ timeout: ESPERA_CONTROLE })
  // O input real é invisível (pointer-events:none); o usuário clica no trilho.
  await linhaTravado.locator('.lb-switch__track').click()
  await expect(linhaTravado.locator('input[type="checkbox"]')).toBeChecked()

  await desselecionar(page)
  const sem = await fotoDoCanvas(page)
  await selecionarSala(page)
  const com = await fotoDoCanvas(page)
  const r = await medir(page, [sem.foto, com.foto], sem.largura, { tipo: 'alca', faixa: FAIXA_DA_ALCA })
  expect(r.alca, 'a sala está travada e mesmo assim a alça de girar apareceu acima dela').toBeNull()

  const campo = await esperarCampoRotacao(page)
  await expect(campo, 'sala travada: o campo Rotação continua editável').toBeDisabled()
})
