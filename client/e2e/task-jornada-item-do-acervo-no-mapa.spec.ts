// ITEM DO ACERVO NO MAPA, pelo "+" e pelo arrasto (fatia 18b, revisão de
// 22/10/2026). O "+" do cartão do item (`handlePorItemNoCentro`) e o soltar do
// arrasto (`handleSoltarItemNoMapa`) passam pela mesma `colocarItemNoMapa`
// desde o commit 5b90ba97, e só o painel tinha teste: ninguém provava que o
// clique chega ao mapa, nem que o arrasto continuou igual depois da troca.
//
// O que esta jornada prova no app de verdade, com a câmera mexida pela roda
// (o ponto do mundo no centro da vista não é o de sempre):
//  1. "+" num item com imagem: a imagem desenhada no centro da vista, de pé (a
//     metade magenta em cima, a verde embaixo); o Acervo continua aberto, e a
//     página Ficha mostra o item selecionado;
//  2. "+" num item sem imagem: o pino de item desenhado no mesmo centro, e a
//     Ficha mostra o pino com o item;
//  3. cada um sai num Ctrl+Z só, o último primeiro: o pino some e depois a
//     imagem, e a tela volta ao que era;
//  4. arrastar o cartão até o mapa: a imagem no ponto solto (longe do centro);
//     com Alt, o pino ali; soltar no livro não põe nada (o Ctrl+Z seguinte tira
//     o pino, não um item escondido), e o clique do gesto não abre a janela.
//
// COMO PROVA, sem ler a store:
//   NA TELA. Cor dos pixels do canvas, lida do screenshot (o `evaluate` de
//   `retrato` só decodifica o PNG num canvas solto). Os `evaluate` que sobram
//   LEEM onde olhar: o retângulo do canvas e o que está por cima de um ponto.
//   O CATÁLOGO VEM DO DISCO. O app abre em modo Tauri com um disco de mentira:
//   `itens.json` e a imagem da espada estão nele antes de o app subir, e o
//   painel os lê pelo caminho de sempre (`recarregar`); a imagem chega ao
//   canvas pela ponte de arquivos (`convertFileSrc`), servida por `page.route`.
//   GESTO DE GENTE. O arrasto anda em passos, para perto do alvo e solta.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { abrirPaginaDoLivro, livroDoMestre } from './helpers/livroDoMestre'

test.use({ trace: 'off', video: 'off' })

interface Ponto {
  x: number
  y: number
}

type Cor = [number, number, number]
type Retangulo = { x: number; y: number; width: number; height: number }

/** 64x64 px: metade de cima #ff00ff, metade de baixo #00c853 (a foto de `task-jornada-acervo-de-tokens.spec.ts`). */
const FOTO_DA_ESPADA_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nO3PUQkAIBTAwNfR0rbSEH4cwmABbnPmfN1wQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFrwOz1995QQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFb10lsMlp2HT+PAAAAABJRU5ErkJggg=='
const ID_DA_MIDIA = `${'a'.repeat(64)}.png`
/** Referência de mídia válida (`midia:<64 hex>.png`): o item "tem imagem" para o mapa. */
const IMAGEM_DA_ESPADA = `midia:${ID_DA_MIDIA}`
const APPDATA = 'C:/appdata'
const MIDIA_DA_ESPADA_NO_DISCO = `${APPDATA}/midia/${ID_DA_MIDIA}`
/** O endereço que a ponte de arquivos de mentira devolve: `page.route` serve o arquivo que está ali. */
const PONTE_DE_ARQUIVOS = '/__disco__/'

const ACERVO_NO_DISCO = JSON.stringify({
  version: 1,
  categorias: ['Arma', 'Consumível'],
  itens: [
    { id: 'item_e2e_espada', nome: 'Espada', imagem: IMAGEM_DA_ESPADA, descricao: 'Afiada.', categoria: 'Arma', preco: null, empilhavel: false },
    { id: 'item_e2e_pocao', nome: 'Poção', imagem: null, descricao: '', categoria: 'Consumível', preco: null, empilhavel: true },
  ],
})

const MAGENTA: Cor = [255, 0, 255]
const VERDE: Cor = [0, 200, 83]
/** Por canal: separa magenta, verde e o chão do editor com folga, e recusa um pelo outro. */
const TOLERANCIA = 60
/** Distância (px de tela) do ponto de pouso até onde se lê cada metade da imagem: dentro dela em qualquer zoom de trabalho. */
const DENTRO_DA_METADE_PX = 8
/** O recorte onde o pino aparece: a cabeça e a haste ficam em cima do ponto de pouso. */
const LADO_DO_RECORTE = 32
const ACIMA_DO_POUSO_PX = 12
/** Pixels do recorte que o pino tem de mudar (cabeça + haste passam disso com sobra)... */
const PIXELS_DO_PINO_MIN = 40
/** ...e quantos podem continuar diferentes depois que ele sai (borda suavizada, nada mais). */
const PIXELS_DE_SOBRA_MAX = 8
/** Quanto a mão para em cima do alvo antes de soltar. */
const PAUSA_ANTES_DE_SOLTAR_MS = 150

// ───────────────────────────────────────────────────────────────────────────
// O app em modo Tauri, com o disco de mentira
// ───────────────────────────────────────────────────────────────────────────

/**
 * Disco de mentira com o acervo de itens já gravado. A ponte de arquivos
 * (`convertFileSrc`) devolve um endereço do próprio servidor, e `page.route`
 * responde com os bytes daquele caminho, como o protocolo de asset do Tauri.
 */
async function abrirOAppComOAcervo(page: Page): Promise<void> {
  await page.route(`**${PONTE_DE_ARQUIVOS}**`, async (rota) => {
    const caminho = decodeURIComponent(new URL(rota.request().url()).pathname.slice(PONTE_DE_ARQUIVOS.length))
    if (caminho !== MIDIA_DA_ESPADA_NO_DISCO) return rota.fulfill({ status: 404, body: '' })
    return rota.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(FOTO_DA_ESPADA_BASE64, 'base64') })
  })
  await page.addInitScript(
    ({ appdata, acervo, ponte }) => {
      const textos: Record<string, string> = { [`${appdata}/itens/itens.json`]: acervo }
      const pastas = new Set<string>([`${appdata}/itens`, `${appdata}/midia`])
      const campos = (valor: unknown): Record<string, unknown> => (typeof valor === 'object' && valor !== null ? Object.fromEntries(Object.entries(valor)) : {})
      const caminhoDoCabecalho = (opcoes: unknown): string => decodeURIComponent(String(campos(campos(opcoes).headers).path ?? ''))
      Reflect.set(window, 'isTauri', true)
      Reflect.set(window, '__TAURI_INTERNALS__', {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        transformCallback: () => 0,
        convertFileSrc: (caminho: string) => `${location.origin}${ponte}${encodeURIComponent(String(caminho))}`,
        invoke: async (cmd: string, args: unknown, opcoes: unknown) => {
          const a = campos(args)
          switch (cmd) {
            case 'plugin:path|resolve_directory':
              return appdata
            case 'plugin:path|join':
              return Array.isArray(a.paths) ? a.paths.map(String).join('/') : ''
            case 'plugin:path|dirname': {
              const p = String(a.path)
              return p.slice(0, Math.max(0, p.lastIndexOf('/')))
            }
            case 'plugin:fs|exists': {
              const p = String(a.path)
              return p in textos || pastas.has(p)
            }
            case 'plugin:fs|mkdir':
              pastas.add(String(a.path))
              return null
            case 'plugin:fs|write_text_file':
              if (args instanceof Uint8Array) textos[caminhoDoCabecalho(opcoes)] = new TextDecoder().decode(args)
              return null
            case 'plugin:fs|read_text_file': {
              const p = String(a.path)
              if (!(p in textos)) throw new Error(`arquivo não existe: ${p}`)
              return Array.from(new TextEncoder().encode(textos[p]))
            }
            case 'plugin:fs|read_dir':
              return []
            case 'plugin:event|listen':
              return 1
            default:
              return null
          }
        },
      })
    },
    { appdata: APPDATA, acervo: ACERVO_NO_DISCO, ponte: PONTE_DE_ARQUIVOS },
  )
  await enterEditor(page)
}

// ───────────────────────────────────────────────────────────────────────────
// Medida de pixel: o que está DESENHADO na tela
// ───────────────────────────────────────────────────────────────────────────

/** Screenshot de um recorte, com três tentativas: o Chromium às vezes responde "Unable to capture screenshot" sem compositor. */
async function fotografar(page: Page, clip: Retangulo): Promise<Awaited<ReturnType<Page['screenshot']>>> {
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

/** Os pixels de um recorte da tela, em RGB seguidos. O `evaluate` só decodifica o PNG num canvas solto. */
async function retrato(page: Page, clip: Retangulo): Promise<number[]> {
  const png = await fotografar(page, clip)
  return page.evaluate(async (url) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const tela = document.createElement('canvas')
    tela.width = img.width
    tela.height = img.height
    const ctx = tela.getContext('2d')
    if (ctx === null) throw new Error('canvas 2D indisponível para ler os pixels')
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, img.width, img.height)
    const rgb: number[] = []
    for (let i = 0; i < data.length; i += 4) rgb.push(data[i], data[i + 1], data[i + 2])
    return rgb
  }, `data:image/png;base64,${png.toString('base64')}`)
}

async function corNaTela(page: Page, ponto: Ponto): Promise<Cor> {
  const [r, g, b] = await retrato(page, { x: Math.round(ponto.x), y: Math.round(ponto.y), width: 1, height: 1 })
  return [r, g, b]
}

function ehAMesmaCor(a: Cor, b: Cor): boolean {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) <= TOLERANCIA
}

/** Quantos pixels mudaram de um retrato para o outro, além da tolerância. */
function pixelsQueMudaram(antes: readonly number[], depois: readonly number[]): number {
  let mudaram = 0
  for (let i = 0; i < antes.length; i += 3) {
    const diferenca = Math.max(Math.abs(antes[i] - depois[i]), Math.abs(antes[i + 1] - depois[i + 1]), Math.abs(antes[i + 2] - depois[i + 2]))
    if (diferenca > TOLERANCIA) mudaram += 1
  }
  return mudaram
}

const acima = (ponto: Ponto): Ponto => ({ x: ponto.x, y: ponto.y - DENTRO_DA_METADE_PX })
const abaixo = (ponto: Ponto): Ponto => ({ x: ponto.x, y: ponto.y + DENTRO_DA_METADE_PX })
const recorteDoPino = (ponto: Ponto): Retangulo => ({
  x: Math.round(ponto.x - LADO_DO_RECORTE / 2),
  y: Math.round(ponto.y - ACIMA_DO_POUSO_PX - LADO_DO_RECORTE / 2),
  width: LADO_DO_RECORTE,
  height: LADO_DO_RECORTE,
})

/** A imagem da espada está desenhada com o centro em `ponto`, de pé: magenta em cima, verde embaixo. */
async function esperarEspadaEm(page: Page, ponto: Ponto, onde: string): Promise<void> {
  await expect.poll(async () => ehAMesmaCor(await corNaTela(page, acima(ponto)), MAGENTA), { message: `${onde}: a metade magenta não está desenhada acima do ponto` }).toBe(true)
  await expect.poll(async () => ehAMesmaCor(await corNaTela(page, abaixo(ponto)), VERDE), { message: `${onde}: a metade verde não está desenhada abaixo do ponto` }).toBe(true)
}

/** Nada da espada em `ponto`: as duas leituras voltam à cor que tinham antes. */
async function esperarSemEspadaEm(page: Page, ponto: Ponto, chao: { acima: Cor; abaixo: Cor }, onde: string): Promise<void> {
  await expect.poll(async () => ehAMesmaCor(await corNaTela(page, acima(ponto)), chao.acima), { message: `${onde}: ainda há imagem acima do ponto` }).toBe(true)
  await expect.poll(async () => ehAMesmaCor(await corNaTela(page, abaixo(ponto)), chao.abaixo), { message: `${onde}: ainda há imagem abaixo do ponto` }).toBe(true)
}

async function chaoEm(page: Page, ponto: Ponto): Promise<{ acima: Cor; abaixo: Cor }> {
  const chao = { acima: await corNaTela(page, acima(ponto)), abaixo: await corNaTela(page, abaixo(ponto)) }
  // O chão do editor não pode já ter a cor da imagem: a leitura seguinte não provaria nada.
  expect(ehAMesmaCor(chao.acima, MAGENTA) || ehAMesmaCor(chao.abaixo, VERDE), 'o chão já tem a cor da espada').toBe(false)
  return chao
}

// ───────────────────────────────────────────────────────────────────────────
// Onde olhar e o que a mão faz
// ───────────────────────────────────────────────────────────────────────────

function canvasDoMapa(page: Page): Locator {
  return page.locator('.lb-editor__canvas')
}

/** O centro do canvas do mapa na tela: é ali que o centro da vista aparece. */
async function centroDaVistaNaTela(page: Page): Promise<Ponto> {
  const caixa = await canvasDoMapa(page).boundingBox()
  if (caixa === null) throw new Error('o canvas do editor não está na tela')
  const centro = { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }
  expect(await mapaPorCima(page, centro), 'o centro da vista está coberto (livro, barra ou HUD)').toBe(true)
  return centro
}

/** O que está por cima de `ponto` é o canvas do mapa? (Só lê.) */
async function mapaPorCima(page: Page, ponto: Ponto): Promise<boolean> {
  return page.evaluate(({ x, y }) => {
    const host = document.querySelector('.lb-editor__canvas')
    const sob = document.elementFromPoint(x, y)
    return host !== null && sob instanceof HTMLCanvasElement && host.contains(sob)
  }, ponto)
}

/**
 * Um ponto da tela onde o que está por cima é o canvas do mapa, o mais perto
 * do centro a pelo menos `distancia` px: o soltar precisa cair longe do centro
 * da vista para não se confundir com o "+".
 */
async function pontoNoMapa(page: Page, distancia: number): Promise<Ponto> {
  const centro = await centroDaVistaNaTela(page)
  const caixa = await canvasDoMapa(page).boundingBox()
  if (caixa === null) throw new Error('o canvas do editor não está na tela')
  let melhor: (Ponto & { d: number }) | null = null
  for (let y = caixa.y + 40; y < caixa.y + caixa.height - 40; y += 20) {
    for (let x = caixa.x + 40; x < caixa.x + caixa.width - 40; x += 20) {
      const d = Math.hypot(x - centro.x, y - centro.y)
      if (d < distancia || (melhor !== null && d >= melhor.d)) continue
      if (await mapaPorCima(page, { x, y })) melhor = { x, y, d }
    }
  }
  if (melhor === null) throw new Error(`nenhum ponto do mapa à vista a ${distancia} px do centro`)
  return { x: melhor.x, y: melhor.y }
}

/** Aproxima pela roda num ponto fora do centro: a câmera sai da de sempre, como num uso de verdade. */
async function mexerNaCamera(page: Page): Promise<void> {
  const ancora = await pontoNoMapa(page, 120)
  // O mapa novo é chão liso: quem diz que o zoom pegou é o mostrador de zoom do canto.
  const zoom = page.getByRole('button', { name: /^Zoom: / })
  await expect(zoom).toHaveAccessibleName('Zoom: 100%')
  await page.mouse.move(ancora.x, ancora.y)
  await page.mouse.wheel(0, -200)
  await page.mouse.wheel(0, -200)
  await expect(zoom, 'a roda não aproximou o mapa').toHaveAccessibleName(/^Zoom: 1[1-9]\d%$/)
}

/** Arrasta o cartão até `para` como a mão: aperta, anda em passos, chega perto, para em cima e solta (com Alt, se pedido). */
async function arrastar(page: Page, cartao: Locator, para: Ponto, comAlt = false): Promise<void> {
  const caixa = await cartao.boundingBox()
  if (caixa === null) throw new Error('o cartão do item não está na tela')
  const de = { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x - 30, para.y - 18, { steps: 16 })
  await page.mouse.move(para.x, para.y, { steps: 6 })
  if (comAlt) await page.keyboard.down('Alt')
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  if (comAlt) await page.keyboard.up('Alt')
}

async function voltarAosItens(page: Page): Promise<void> {
  await abrirPaginaDoLivro(page, 'Acervo')
  const itens = livroDoMestre(page).getByRole('radio', { name: 'Itens' })
  if ((await itens.getAttribute('aria-checked')) !== 'true') await itens.click()
  await expect(page.getByRole('button', { name: 'Abrir Espada' })).toBeVisible()
}

/** A página Ficha mostra a seleção: o nome do item no campo dele (no pino, dentro da ficha "Item pegável"). */
async function esperarSelecionadoNaFicha(page: Page, nome: string): Promise<void> {
  await abrirPaginaDoLivro(page, 'Ficha')
  const livro = livroDoMestre(page)
  const recurso = livro.getByRole('button', { name: /^Item pegável/ })
  if ((await recurso.count()) > 0 && (await recurso.first().getAttribute('aria-expanded')) === 'false') await recurso.first().click()
  await expect(livro.getByRole('textbox', { name: 'Nome do item' })).toHaveValue(nome)
  await voltarAosItens(page)
}

test.beforeEach(async ({ page }) => {
  await abrirOAppComOAcervo(page)
  await abrirPaginaDoLivro(page, 'Acervo')
  await livroDoMestre(page).getByRole('radio', { name: 'Itens' }).click()
  // O catálogo é o do disco: os dois cartões vêm do itens.json, sem ninguém pôr na store.
  await expect(page.getByRole('button', { name: 'Abrir Espada' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir Poção' })).toBeVisible()
  await mexerNaCamera(page)
})

test('o "+" do cartão põe o item no centro da vista, já selecionado, e cada um sai num Ctrl+Z', async ({ page }) => {
  test.setTimeout(60_000)
  const centro = await centroDaVistaNaTela(page)
  const chao = await chaoEm(page, centro)

  await page.getByRole('button', { name: 'Pôr Espada no centro do mapa' }).click()
  await esperarEspadaEm(page, centro, 'a espada pelo "+"')
  // O que nasce do Acervo não puxa a página Ficha: o próximo "+" continua à mão.
  await expect(livroDoMestre(page).getByRole('tab', { name: 'Acervo', exact: true })).toHaveAttribute('aria-selected', 'true')
  await esperarSelecionadoNaFicha(page, 'Espada')

  const semPino = await retrato(page, recorteDoPino(centro))
  await page.getByRole('button', { name: 'Pôr Poção no centro do mapa' }).click()
  // Sem imagem não há o que desenhar no chão: o "+" faz o pino de item, por cima da espada.
  await expect.poll(async () => pixelsQueMudaram(semPino, await retrato(page, recorteDoPino(centro))), { message: 'o pino da poção não apareceu no centro' }).toBeGreaterThanOrEqual(PIXELS_DO_PINO_MIN)
  await esperarSelecionadoNaFicha(page, 'Poção')

  await page.keyboard.press('Control+z')
  await expect.poll(async () => pixelsQueMudaram(semPino, await retrato(page, recorteDoPino(centro))), { message: 'o Ctrl+Z não tirou o pino' }).toBeLessThanOrEqual(PIXELS_DE_SOBRA_MAX)
  await esperarEspadaEm(page, centro, 'a espada depois do primeiro Ctrl+Z')
  await page.keyboard.press('Control+z')
  await esperarSemEspadaEm(page, centro, chao, 'o segundo Ctrl+Z')
})

test('arrastar o cartão até o mapa põe a imagem no ponto solto; com Alt, o pino; no livro, nada', async ({ page }) => {
  test.setTimeout(60_000)
  const cartao = page.getByRole('button', { name: 'Abrir Espada' })
  const centro = await centroDaVistaNaTela(page)
  const solto = await pontoNoMapa(page, 160)
  const chaoNoSolto = await chaoEm(page, solto)
  const chaoNoCentro = await chaoEm(page, centro)

  await arrastar(page, cartao, solto)
  await esperarEspadaEm(page, solto, 'a espada solta')
  // O ponto solto não é o centro: o arrasto não caiu na conta do "+".
  await esperarSemEspadaEm(page, centro, chaoNoCentro, 'o centro depois do arrasto')
  // O clique que o navegador manda depois do arrasto é engolido: a janela do item não abre.
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await esperarSelecionadoNaFicha(page, 'Espada')

  const comAlt = await pontoNoMapa(page, 260)
  const semPino = await retrato(page, recorteDoPino(comAlt))
  await arrastar(page, cartao, comAlt, true)
  await expect.poll(async () => pixelsQueMudaram(semPino, await retrato(page, recorteDoPino(comAlt))), { message: 'com Alt, o pino não apareceu no ponto solto' }).toBeGreaterThanOrEqual(PIXELS_DO_PINO_MIN)
  // Com Alt é o pino, e não uma segunda imagem no chão.
  expect(ehAMesmaCor(await corNaTela(page, abaixo(comAlt)), VERDE), 'com Alt saiu a imagem no chão, não o pino').toBe(false)
  await esperarSelecionadoNaFicha(page, 'Espada')
  const comPino = await retrato(page, recorteDoPino(comAlt))

  // Soltar em cima do livro é desistir: nada nasce, e a janela não abre.
  const estante = await page.getByRole('region', { name: 'Itens' }).boundingBox()
  if (estante === null) throw new Error('a estante de itens não está na tela')
  await arrastar(page, cartao, { x: estante.x + estante.width / 2, y: estante.y + 12 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(pixelsQueMudaram(comPino, await retrato(page, recorteDoPino(comAlt))), 'soltar no livro mexeu no pino').toBeLessThanOrEqual(PIXELS_DE_SOBRA_MAX)
  await esperarEspadaEm(page, solto, 'a espada depois de soltar no livro')

  // Se o soltar no livro tivesse posto um item escondido, o primeiro Ctrl+Z o tiraria e o pino ficaria.
  await page.keyboard.press('Control+z')
  await expect.poll(async () => pixelsQueMudaram(semPino, await retrato(page, recorteDoPino(comAlt))), { message: 'o Ctrl+Z não tirou o pino' }).toBeLessThanOrEqual(PIXELS_DE_SOBRA_MAX)
  await esperarEspadaEm(page, solto, 'a espada depois do primeiro Ctrl+Z')
  await page.keyboard.press('Control+z')
  await esperarSemEspadaEm(page, solto, chaoNoSolto, 'o segundo Ctrl+Z')
})
