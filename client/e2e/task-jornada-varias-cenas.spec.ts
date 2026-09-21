// JORNADA DE USUÁRIO de "várias cenas numa aventura" (Entrega 1) — escrita
// para SAIR VERMELHA no código de hoje.
//
// A FEATURE: o mestre tem VÁRIAS CENAS (mapas) dentro de uma mesma aventura.
// No rail do editor, aba Mapa, uma seção retrátil "Cenas" lista as cenas, com
// a aberta destacada e um botão "+ Nova cena". Trocar de cena é um clique na
// lista. E tudo persiste: fechar e reabrir o app traz as duas cenas, cada uma
// com o que foi desenhado nela.
//
// ONDE ISSO MORRE HOJE: o app guarda UM mapa por vez
// (`client/src/stores/mapStore.ts:1267`, `loadMap` troca o único mapa), e não
// existe lista de cenas em lugar nenhum do rail.
//
// COMO ESTE ARQUIVO PROVA, sem mentir:
//   GESTO REAL. Clique, teclado e arrasto de ponteiro com pausa antes de
//   soltar. Nenhum `page.evaluate` que MUDA o app, nenhum `dispatchEvent`,
//   nenhuma escrita em store. O único `evaluate` daqui DECODIFICA o PNG do
//   screenshot num canvas solto (o projeto não tem decodificador e não vale
//   dependência nova por isto); ele não toca no app.
//   PROVA NA TELA. "A cena mostra a sala dela" é lido nos PIXELS do canvas
//   (régua abaixo); "a lista mostra as duas cenas" é o texto visível no rail.
//   Nada sai da store.
//   REINÍCIO DE VERDADE-O-BASTANTE. Falsifica-se só o DISCO do Tauri, em
//   `sessionStorage`, o mesmo mecanismo de `task-jornada-acervo-de-tokens` —
//   ele sobrevive ao `page.reload()`, que zera toda a memória do app. Cenas
//   que só existissem em `useState` passariam pela troca na mesma sessão e
//   morreriam no reload. O estado do app nunca é falsificado.
//
// O QUE ESTE ARQUIVO NÃO DITA: o formato no disco (um arquivo por cena ou um
// só), o nome padrão da primeira cena, nem se a cena é trocada por botão,
// aba ou item de lista. Ele cobra o que a pessoa vê.
//
// CONTROLES POSITIVOS (verdes hoje). Teste 1: a sala desenhada aparece e
// volta depois de Salvar, reiniciar e reabrir pelo "Carregar Mapa existente"
// — prova que a régua, o disco falso e o caminho de reabrir funcionam. Teste
// 1b: as duas salas no mesmo mapa são lidas como "misturadas" — prova que a
// régua não confunde "as duas" com "só uma". Sem eles, o vermelho do teste 2
// poderia ser a régua cega e não a feature ausente.
//
// A RÉGUA DE PIXEL NÃO DEPENDE DA CÂMERA. Reabrir a aventura recoloca a vista
// (medido: a sala desenhada em x=380..580 volta em outro lugar da tela), então
// "tem sala no pixel X" não serve depois do reinício. Cada cena ganha uma sala
// de FORMATO próprio: a da cena A é DEITADA (5 x 2 células), a da Cripta é EM
// PÉ (2 x 5). A régua acha, na foto do canvas, a caixa que envolve todo pixel
// com a cor do chão de sala e lê a proporção dela — que não muda com pan nem
// com zoom. Deitada = só a cena A; em pé = só a Cripta; as duas juntas dão uma
// caixa de proporção intermediária, que não passa por nenhuma das duas; nada
// da cor do chão = cena vazia.
import { test, expect, type Locator, type Page } from '@playwright/test'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

/** Nome da aventura: é por ele que a pessoa a reencontra depois de reiniciar. */
const AVENTURA = 'Aventura do Vale'
const CRIPTA = 'Cripta'

type Retangulo = { x1: number; y1: number; x2: number; y2: number }
type Ponto = { x: number; y: number }
type Cor = [number, number, number]
type Foto = Awaited<ReturnType<Page['screenshot']>>

// Geometria em px do canvas, grade de 64 px. As duas salas usam o mesmo trecho
// da tela de propósito: o que as separa é o formato, não o lugar.
/** Sala da cena A: deitada, 5 x 2 células (proporção 2,5). */
const SALA_DA_CENA_A: Retangulo = { x1: 384, y1: 256, x2: 704, y2: 384 }
/** Sala da Cripta: em pé, 2 x 5 células (proporção 0,4). */
const SALA_DA_CRIPTA: Retangulo = { x1: 448, y1: 192, x2: 576, y2: 512 }
/** Ponto de chão da sala A, longe do rótulo (centro) e da parede, para ler a cor do chão. */
const CHAO_DA_SALA_A: Ponto = { x: 410, y: 360 }

/** Proporção largura/altura acima da qual a caixa é "a sala deitada da cena A". */
const PROPORCAO_SO_A = 1.8
/** Proporção abaixo da qual a caixa é "a sala em pé da Cripta". */
const PROPORCAO_SO_CRIPTA = 0.6
/** Uma linha/coluna só entra na caixa com pelo menos isto de pixels de chão — ruído de antisserrilhado fica fora. */
const PIXELS_MINIMOS_POR_LINHA = 6

/** Botão parado antes de soltar: é o que separa um arrasto de pessoa de um clique. */
const PAUSA_MS = 200
/** Folga para o Pixi terminar de pintar antes da foto. */
const PINTURA_MS = 400
/** Distância máxima (maior canal) para um pixel contar como "cor do chão de sala". */
const TOLERANCIA_CHAO = 18

// ───────────────────────────────────────────────────────────────────────────
// Disco de mentira que SOBREVIVE ao reinício do app
// ───────────────────────────────────────────────────────────────────────────

type InternalsDoTauri = {
  metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
  invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
  transformCallback: () => number
  convertFileSrc: (filePath: string, protocol?: string) => string
}
type JanelaDoMestre = { isTauri: boolean; __TAURI_INTERNALS__: InternalsDoTauri }

interface DiscoSalvo {
  textos: Record<string, string>
  binarios: Record<string, number[]>
  pastas: string[]
}

/**
 * Disco do Tauri em `sessionStorage`, mesmo mecanismo da jornada do acervo.
 * Diferença: aqui `read_dir` também devolve PASTAS e `exists` enxerga pasta
 * implícita (com arquivo dentro) — é assim que a tela "Carregar Mapa" acha
 * `maps/<id>/map.json` (`lib/mapFileIO.ts`, `listSavedMaps`).
 */
async function discoDoMestre(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const CHAVE = 'labirinto.disco-varias-cenas'
    const alvo = window as unknown as JanelaDoMestre
    let disco: DiscoSalvo = { textos: {}, binarios: {}, pastas: [] }
    try {
      const bruto = window.sessionStorage.getItem(CHAVE)
      if (bruto !== null) disco = JSON.parse(bruto) as DiscoSalvo
    } catch {
      disco = { textos: {}, binarios: {}, pastas: [] }
    }
    const gravar = () => {
      try {
        window.sessionStorage.setItem(CHAVE, JSON.stringify(disco))
      } catch {
        // Cota estourada: a jornada falha na asserção seguinte, onde deve falhar.
      }
    }
    const todosOsCaminhos = (): string[] => Object.keys(disco.textos).concat(Object.keys(disco.binarios), disco.pastas)
    const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
    const existe = (caminho: string): boolean => {
      const alvoCaminho = semBarraFinal(caminho)
      return todosOsCaminhos().some((p) => p === alvoCaminho || p.indexOf(`${alvoCaminho}/`) === 0)
    }

    alvo.isTauri = true
    alvo.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      transformCallback: () => 0,
      convertFileSrc: (caminho: string) => String(caminho),
      invoke: async (cmd, args, options) => {
        const a = (args ?? {}) as Record<string, unknown>
        switch (cmd) {
          case 'plugin:path|resolve_directory':
            return 'C:/appdata'
          case 'plugin:path|join':
            return (a.paths as string[]).join('/')
          case 'plugin:path|dirname': {
            const p = String(a.path)
            return p.slice(0, Math.max(0, p.lastIndexOf('/')))
          }
          case 'plugin:fs|exists':
            return existe(String(a.path))
          case 'plugin:fs|mkdir': {
            const p = semBarraFinal(String(a.path))
            if (disco.pastas.indexOf(p) === -1) disco.pastas.push(p)
            gravar()
            return null
          }
          case 'plugin:fs|write_text_file': {
            const caminho = decodeURIComponent(options?.headers?.path ?? '')
            disco.textos[caminho] = new TextDecoder().decode(args as Uint8Array)
            gravar()
            return null
          }
          case 'plugin:fs|read_text_file': {
            const caminho = String(a.path)
            if (!(caminho in disco.textos)) throw new Error(`arquivo não existe: ${caminho}`)
            return Array.from(new TextEncoder().encode(disco.textos[caminho]))
          }
          case 'plugin:fs|write_file': {
            const caminho = decodeURIComponent(options?.headers?.path ?? '')
            disco.binarios[caminho] = Array.from(args as Uint8Array)
            gravar()
            return null
          }
          case 'plugin:fs|read_file': {
            const caminho = String(a.path)
            if (caminho in disco.binarios) return disco.binarios[caminho]
            throw new Error(`arquivo não existe: ${caminho}`)
          }
          case 'plugin:fs|rename': {
            const de = String(a.oldPath)
            const para = String(a.newPath)
            if (de in disco.textos) {
              disco.textos[para] = disco.textos[de]
              delete disco.textos[de]
            }
            if (de in disco.binarios) {
              disco.binarios[para] = disco.binarios[de]
              delete disco.binarios[de]
            }
            gravar()
            return null
          }
          case 'plugin:fs|remove': {
            const caminho = String(a.path)
            delete disco.textos[caminho]
            delete disco.binarios[caminho]
            disco.pastas = disco.pastas.filter((p) => p !== caminho)
            gravar()
            return null
          }
          case 'plugin:fs|read_dir': {
            const prefixo = `${semBarraFinal(String(a.path))}/`
            const filhos = new Map<string, boolean>()
            for (const p of todosOsCaminhos()) {
              if (p.indexOf(prefixo) !== 0) continue
              const resto = p.slice(prefixo.length)
              if (resto.length === 0) continue
              const corte = resto.indexOf('/')
              const nome = corte === -1 ? resto : resto.slice(0, corte)
              const ehPasta = corte !== -1 || disco.pastas.indexOf(p) !== -1
              filhos.set(nome, (filhos.get(nome) ?? false) || ehPasta)
            }
            return Array.from(filhos.entries()).map(([name, isDirectory]) => ({
              name,
              isDirectory,
              isFile: !isDirectory,
              isSymlink: false,
            }))
          }
          case 'plugin:event|listen':
            return 1
          default:
            return null
        }
      },
    }
  })
}

// ───────────────────────────────────────────────────────────────────────────
// Régua de pixel: o que está DESENHADO na tela
// ───────────────────────────────────────────────────────────────────────────

/** Screenshot com três tentativas: o Chromium às vezes responde "Unable to
 *  capture screenshot" com a aba sem compositor por um instante. Fotografar
 *  não muda nada, então repetir é seguro. */
async function fotografar(page: Page, clip?: { x: number; y: number; width: number; height: number }): Promise<Foto> {
  let ultimoErro: unknown = null
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await page.screenshot(clip ? { clip } : {})
    } catch (erro) {
      ultimoErro = erro
      await page.waitForTimeout(200)
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro))
}

/** O canvas em coordenadas de página. */
async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await page.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

/** Cor de um ponto do canvas (px do canvas), lida da foto. Leitura pura. */
async function corNoCanvas(page: Page, p: Ponto): Promise<Cor> {
  const c = await caixaDoCanvas(page)
  const foto = await fotografar(page, { x: Math.round(c.x + p.x), y: Math.round(c.y + p.y), width: 1, height: 1 })
  return page.evaluate(async (b64: string) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const tela = document.createElement('canvas')
    tela.width = 1
    tela.height = 1
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d para ler a foto')
    ctx.drawImage(bmp, 0, 0)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2]] as [number, number, number]
  }, foto.toString('base64'))
}

interface CaixaDoChao {
  pixels: number
  largura: number
  altura: number
}

/**
 * Caixa que envolve todo pixel com a cor do chão de sala, na foto do canvas.
 * Só DECODIFICA o PNG num canvas solto: não toca no app.
 */
async function caixaDoChao(page: Page, chao: Cor): Promise<CaixaDoChao> {
  const c = await caixaDoCanvas(page)
  const foto = await fotografar(page, { x: c.x, y: c.y, width: c.width, height: c.height })
  return page.evaluate(
    async ({ b64, chao, tolerancia, minimo }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const porColuna = new Array<number>(width).fill(0)
      const porLinha = new Array<number>(height).fill(0)
      let pixels = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const perto =
            Math.abs(data[i] - chao[0]) <= tolerancia && Math.abs(data[i + 1] - chao[1]) <= tolerancia && Math.abs(data[i + 2] - chao[2]) <= tolerancia
          if (!perto) continue
          pixels += 1
          porColuna[x] += 1
          porLinha[y] += 1
        }
      }
      const extensao = (contagem: number[]): number => {
        const primeiro = contagem.findIndex((n) => n >= minimo)
        if (primeiro === -1) return 0
        let ultimo = contagem.length - 1
        while (contagem[ultimo] < minimo) ultimo -= 1
        return ultimo - primeiro + 1
      }
      return { pixels, largura: extensao(porColuna), altura: extensao(porLinha) }
    },
    { b64: foto.toString('base64'), chao, tolerancia: TOLERANCIA_CHAO, minimo: PIXELS_MINIMOS_POR_LINHA },
  )
}

type OQueATelaMostra = 'só a sala da cena A' | 'só a sala da Cripta' | 'nenhuma sala' | 'salas misturadas'

function ler(caixa: CaixaDoChao): OQueATelaMostra {
  if (caixa.largura === 0 || caixa.altura === 0) return 'nenhuma sala'
  const proporcao = caixa.largura / caixa.altura
  if (proporcao >= PROPORCAO_SO_A) return 'só a sala da cena A'
  if (proporcao <= PROPORCAO_SO_CRIPTA) return 'só a sala da Cripta'
  return 'salas misturadas'
}

/** Espera a tela mostrar `esperado` (a troca de cena pode levar alguns quadros) e explica o que viu quando não mostra. */
async function telaMostra(page: Page, chao: Cor, esperado: OQueATelaMostra, contexto: string): Promise<void> {
  let ultima: CaixaDoChao = { pixels: 0, largura: 0, altura: 0 }
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(PINTURA_MS)
        ultima = await caixaDoChao(page, chao)
        return ler(ultima)
      },
      { timeout: 10_000, message: `${contexto}: a tela deveria mostrar ${esperado}` },
    )
    .toBe(esperado)
  // Guarda contra régua cega: "só a sala X" com uma caixa minúscula seria ruído, não sala.
  if (esperado !== 'nenhuma sala') {
    expect(Math.min(ultima.largura, ultima.altura), `${contexto}: a caixa do chão (${ultima.largura}x${ultima.altura}) é pequena demais para ser a sala`).toBeGreaterThan(40)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos que a pessoa faz
// ───────────────────────────────────────────────────────────────────────────

/** Menu inicial -> "Criar Mapas" -> dá nome à aventura -> "Criar mapa". */
async function criarAventura(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Mapas' }).click()
  const nome = page.getByLabel('Nome do mapa')
  await nome.click()
  await nome.press('Control+a')
  await nome.pressSequentially(AVENTURA, { delay: 10 })
  await page.getByRole('button', { name: 'Criar mapa', exact: true }).click()
  await page.waitForSelector('canvas')
}

/** Ferramenta Sala, arrasto com pausa antes de soltar, e nome da sala no campo que aparece. */
async function desenharSala(page: Page, r: Retangulo, nomeDaSala: string): Promise<void> {
  const o = await caixaDoCanvas(page)
  await page.getByRole('button', { name: 'Sala', exact: true }).click()
  await page.mouse.move(o.x + r.x1, o.y + r.y1)
  await page.mouse.down()
  await page.mouse.move(o.x + (r.x1 + r.x2) / 2, o.y + (r.y1 + r.y2) / 2, { steps: 8 })
  await page.mouse.move(o.x + r.x2, o.y + r.y2, { steps: 8 })
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.up()

  const nome = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await expect(nome).toBeVisible()
  await page.keyboard.type(nomeDaSala)
  await page.keyboard.press('Enter')
  await expect(nome).toHaveCount(0)
  // Esc devolve a ferramenta de seleção e tira a sala recém-criada da seleção,
  // para as alças de seleção não sujarem a foto.
  await page.keyboard.press('Escape')
}

/** Salvar pela barra e esperar o aviso que a pessoa vê. */
async function salvar(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Mapa salvo').first()).toBeVisible({ timeout: 10_000 })
}

/** Fecha e reabre o app (reload zera a memória; o disco falso fica) e abre a aventura pela lista. */
async function reiniciarEReabrir(page: Page): Promise<void> {
  await page.reload()
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await page.waitForSelector('canvas')
}

/** A seção "Cenas" da aba Mapa, aberta. Devolve o corpo dela, onde mora a lista. */
async function secaoCenas(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Mapa' }).click()
  const painel = page.getByRole('tabpanel', { name: 'Mapa' })
  const cabecalho = painel.getByRole('button', { name: 'Cenas', exact: true })
  await expect(cabecalho, 'a aba Mapa do rail deveria ter uma seção "Cenas"').toBeVisible({ timeout: 10_000 })
  if ((await cabecalho.getAttribute('aria-expanded')) === 'false') await cabecalho.click()
  await expect(cabecalho).toHaveAttribute('aria-expanded', 'true')
  const corpo = await cabecalho.getAttribute('aria-controls')
  return corpo ? page.locator(`[id="${corpo}"]`) : painel
}

/** A entrada da Cripta na lista de cenas. */
function cenaCripta(lista: Locator): Locator {
  return lista.getByRole('button', { name: CRIPTA, exact: true })
}

/** A entrada da primeira cena: qualquer entrada que não seja a Cripta nem o botão de criar. */
function cenaA(lista: Locator): Locator {
  return lista.getByRole('button').filter({ hasNotText: /cripta|nova cena/i }).first()
}

/** A entrada está destacada como a cena aberta (qualquer um dos jeitos acessíveis de dizer isso). */
async function estaDestacada(entrada: Locator): Promise<boolean> {
  for (const atributo of ['aria-current', 'aria-selected', 'aria-pressed']) {
    const valor = await entrada.getAttribute(atributo)
    if (valor !== null && valor !== 'false') return true
  }
  return false
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

/** Desenha a sala da cena A e devolve a cor do chão de sala, lida da tela. */
async function desenharSalaDaCenaA(page: Page): Promise<Cor> {
  const antes = await corNoCanvas(page, CHAO_DA_SALA_A)
  await desenharSala(page, SALA_DA_CENA_A, 'Salão')
  await page.waitForTimeout(PINTURA_MS)
  const chao = await corNoCanvas(page, CHAO_DA_SALA_A)
  const mudou = Math.max(Math.abs(chao[0] - antes[0]), Math.abs(chao[1] - antes[1]), Math.abs(chao[2] - antes[2]))
  expect(mudou, `desenhar a sala deveria pintar o chão; antes rgb(${antes.join(',')}), depois rgb(${chao.join(',')})`).toBeGreaterThan(40)
  return chao
}

test('1. controle: a sala desenhada aparece na tela e volta depois de salvar, reiniciar e reabrir', async ({ page }) => {
  test.setTimeout(120_000)
  await discoDoMestre(page)
  await criarAventura(page)

  const chao = await desenharSalaDaCenaA(page)
  await telaMostra(page, chao, 'só a sala da cena A', 'logo depois de desenhar')

  await salvar(page)
  await reiniciarEReabrir(page)
  await telaMostra(page, chao, 'só a sala da cena A', 'depois de reiniciar e reabrir a aventura')
})

test('1b. controle: a régua não é cega para as duas salas juntas no mesmo mapa', async ({ page }) => {
  test.setTimeout(120_000)
  await discoDoMestre(page)
  await criarAventura(page)
  const chao = await desenharSalaDaCenaA(page)
  // Com a sala em pé desenhada no MESMO mapa (o único que existe hoje), a
  // régua tem de ler "misturadas" — é isso que o teste 2 recusa quando cobra
  // "só a sala da Cripta" ou "só a sala da cena A".
  await desenharSala(page, SALA_DA_CRIPTA, 'Ossário')
  await telaMostra(page, chao, 'salas misturadas', 'as duas salas no mesmo mapa')
})

test('2. duas cenas na mesma aventura: cada uma mostra só o que foi desenhado nela, e as duas voltam depois de reiniciar o app', async ({ page }) => {
  test.setTimeout(180_000)
  await discoDoMestre(page)
  await criarAventura(page)

  // ── cena A: uma sala deitada ─────────────────────────────────────────────
  const chao = await desenharSalaDaCenaA(page)
  await telaMostra(page, chao, 'só a sala da cena A', 'cena A')

  // ── "+ Nova cena", batizada de Cripta ─────────────────────────────────────
  let lista = await secaoCenas(page)
  await lista.getByRole('button', { name: /nova cena/i }).click()
  const nomeDaCena = page.getByRole('textbox', { name: /cena/i })
  await expect(nomeDaCena, 'criar uma cena deveria pedir o nome dela').toBeVisible()
  await nomeDaCena.click()
  await nomeDaCena.press('Control+a')
  await nomeDaCena.pressSequentially(CRIPTA, { delay: 10 })
  await nomeDaCena.press('Enter')
  await expect(cenaCripta(lista)).toBeVisible()
  expect(await estaDestacada(cenaCripta(lista)), 'a Cripta acabou de ser criada e aberta: deveria estar destacada na lista').toBe(true)

  // A cena nova começa vazia: a sala da cena A não vem junto.
  await telaMostra(page, chao, 'nenhuma sala', 'Cripta recém-criada')

  // ── Cripta: uma sala em pé ───────────────────────────────────────────────
  await desenharSala(page, SALA_DA_CRIPTA, 'Ossário')
  await telaMostra(page, chao, 'só a sala da Cripta', 'na Cripta, depois de desenhar a sala dela')

  // ── trocar de cena é um clique na lista ──────────────────────────────────
  await cenaA(lista).click()
  await telaMostra(page, chao, 'só a sala da cena A', 'depois de clicar na cena A')
  expect(await estaDestacada(cenaA(lista)), 'a cena A foi aberta: deveria estar destacada').toBe(true)

  await cenaCripta(lista).click()
  await telaMostra(page, chao, 'só a sala da Cripta', 'depois de clicar de volta na Cripta')

  // ── fechar e reabrir o app ───────────────────────────────────────────────
  await salvar(page)
  await reiniciarEReabrir(page)
  lista = await secaoCenas(page)
  await expect(cenaCripta(lista), 'depois de reiniciar, a Cripta deveria continuar na lista').toBeVisible({ timeout: 10_000 })
  await expect(cenaA(lista), 'depois de reiniciar, a cena A deveria continuar na lista').toBeVisible()

  await cenaA(lista).click()
  await telaMostra(page, chao, 'só a sala da cena A', 'depois de reiniciar, na cena A')
  await cenaCripta(lista).click()
  await telaMostra(page, chao, 'só a sala da Cripta', 'depois de reiniciar, na Cripta')
})
