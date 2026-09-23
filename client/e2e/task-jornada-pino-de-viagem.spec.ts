// JORNADA DE USUÁRIO do "pino de viagem" (Entrega 2) — escrita para SAIR
// VERMELHA no código de hoje.
//
// A FEATURE: o marcador (pino) ganha o tipo "viagem", com ícone próprio. No
// painel dele entra "Leva a…": o mestre escolhe a cena de destino e, lá, um
// pino de viagem que já existe ou cria o pino de chegada, que nasce no centro
// da cena de destino. Os dois ficam ligados em mão dupla e o painel de cada um
// DIZ EM TEXTO para onde leva. Apagar um deixa o outro "sem destino", também
// dito em texto. No editor, clicar num pino de viagem ligado leva a visão do
// mestre para a cena de destino, que passa a ficar destacada na lista Cenas.
//
// ONDE ISSO MORRE HOJE: `PinKind` é só 'exclamacao' | 'interrogacao'
// (`client/src/types/map.ts:206`) e o painel (`components/PinControls.tsx`)
// não tem tipo "viagem" nem "Leva a…".
//
// COMO ESTE ARQUIVO PROVA, sem mentir (mesmo molde de
// task-jornada-varias-cenas.spec.ts):
//   GESTO REAL. Clique e teclado de ponteiro, com o botão parado um instante
//   antes de soltar. Nenhum `evaluate` que MUDA o app, nenhum `dispatchEvent`,
//   nenhuma escrita em store. Os `evaluate` daqui só DECODIFICAM o PNG da foto
//   num canvas solto e perguntam `elementFromPoint` — leitura pura.
//   PROVA NA TELA. "O pino aparece" é lido nos PIXELS do canvas; "leva à
//   Cripta" é TEXTO visível no painel; "a Cripta está aberta" é o destaque
//   acessível (aria-current/aria-selected/aria-pressed) na lista Cenas.
//   REINÍCIO. Só o DISCO do Tauri é falsificado, em `sessionStorage`, que
//   sobrevive ao `page.reload()`. O estado do app nunca é falsificado.
//
// A RÉGUA DE PIXEL NÃO DEPENDE DA CÂMERA. Trocar de cena pode recolocar a vista
// (a jornada das várias cenas mediu isso no reinício). Então a régua não
// compara pixel a pixel: ela fotografa a cena VAZIA, guarda a PALETA dela (fundo,
// grade e as misturas de antisserrilhado entre essas cores) e, depois, conta só
// os pixels com cor que a cena vazia não tem. Pan e zoom movem a grade mas não
// inventam cor; um pino desenhado inventa. O centro desses pixels novos é onde
// o pino está na tela, seja qual for a câmera. Como no molde, só conta pixel em
// que o CANVAS está por cima (o rail e os painéis ficam sobre ele).
//
// SUPOSIÇÕES DE GESTO que este arquivo faz (as únicas que dita):
//   - VIAJAR é clicar no pino ligado com a ferramenta Selecionar;
//   - ABRIR O PAINEL de um pino que já existe é clicar nele com a ferramenta
//     Pino na mão (é o que o app já faz hoje, `pixi/PixiCanvas.tsx:2706`), e
//     esse clique NÃO viaja — é o jeito de editar um pino ligado sem sair da cena.
//
// CONTROLE POSITIVO (verde hoje). Teste 1: a régua de "cor nova" não vê nada na
// cena vazia, vê o pino criado com a ferramenta de hoje exatamente onde ele foi
// posto, e o painel dele abre. Sem ele, o vermelho dos testes 2 a 5 poderia ser
// a régua cega e não a feature ausente.
import { test, expect, type Locator, type Page } from '@playwright/test'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

/** Nome da aventura: é por ele que a pessoa a reencontra depois de reiniciar. */
const AVENTURA = 'Aventura do Vale'
const CRIPTA = 'Cripta'

type Ponto = { x: number; y: number }
type Cor = [number, number, number]
type Foto = Awaited<ReturnType<Page['screenshot']>>

/** Onde o pino da cena A é cravado, em fração do canvas: LONGE do centro, para
 *  "o pino de chegada aparece perto do centro" não ser satisfeito pelo pino de A. */
const PINO_DE_A_FRACAO: Ponto = { x: 0.3, y: 0.3 }
/** Meia-largura da janela "perto do centro da tela", em fração do canvas. */
const JANELA_CENTRAL = 0.15
/** Pixels de cor nova mínimos para contar como "um pino desenhado ali". */
const PIXELS_DE_UM_PINO = 40
/** Pixels de cor nova máximos numa cena vazia parada: acima disso a régua enxerga fantasma. */
const RUIDO_MAXIMO = 8
/** Distância máxima (px de tela) entre o ponto clicado e o centro do desenho do pino (a cabeça fica acima da ponta). */
const DESENHO_PERTO_DO_CLIQUE = 45

/** Botão parado antes de soltar: toque de pessoa. */
const TOQUE_MS = 150
/** Folga para o Pixi terminar de pintar antes da foto. */
const PINTURA_MS = 400

/** Ferramentas da barra (nomes de hoje, `components/labels.ts`). */
const FERRAMENTA_PINO = 'Pino'
const FERRAMENTA_SELECIONAR = 'Selecionar'

/** Título do painel do pino: hoje "Ponto de interesse"; o de viagem pode chamar de outro jeito. */
const TITULO_DO_PAINEL = /ponto de interesse|pino|viagem/i
const TIPO_VIAGEM = /viagem/i
const LEVA_A = /leva a/i
const CRIAR_CHEGADA = /chegada|novo pino/i
const APAGAR_PINO = /excluir|apagar|remover (o )?pino/i
const SEM_DESTINO = /sem destino|não leva|desligad/i

// ───────────────────────────────────────────────────────────────────────────
// Disco de mentira que SOBREVIVE ao reinício do app (cópia do molde)
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

/** Disco do Tauri em `sessionStorage` — mesmo de task-jornada-varias-cenas.spec.ts. */
async function discoDoMestre(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const CHAVE = 'labirinto.disco-pino-de-viagem'
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
// Régua de pixel: cor que a cena vazia não tem
// ───────────────────────────────────────────────────────────────────────────

/** Screenshot com três tentativas (o Chromium às vezes responde "Unable to capture screenshot"). */
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

async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await page.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

/**
 * Paleta de uma cena vazia: as cores principais (fundo e grade, que se misturam
 * no antisserrilhado quando a câmera anda) e TODA cor quantizada vista (a sombra
 * das barras por cima do canvas, por exemplo, que não anda com a câmera).
 */
type Paleta = { principais: Cor[]; todas: number[] }

interface DesenhoNovo {
  /** Pixels de cor fora da paleta, onde o canvas está por cima. */
  pixels: number
  /** Desses, quantos caem na janela central do canvas. */
  noCentro: number
  /** Centro dos pixels novos, em px de PÁGINA (pronto para o mouse). */
  centro: Ponto | null
}

/**
 * Lê a foto do canvas. Com `paleta = null`, devolve a paleta da tela; com
 * paleta, devolve o que foi desenhado com cor fora dela. Só DECODIFICA o PNG
 * num canvas solto e pergunta `elementFromPoint`: não toca no app.
 */
async function lerCanvas(page: Page, paleta: Paleta | null): Promise<{ paleta: Paleta; novo: DesenhoNovo }> {
  const c = await caixaDoCanvas(page)
  const foto = await fotografar(page, { x: c.x, y: c.y, width: c.width, height: c.height })
  return page.evaluate(
    async ({ b64, paleta, origem, janela }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const canvasDoMapa = document.querySelector('canvas')
      const escalaX = origem.width / width
      const escalaY = origem.height / height
      const canvasPorCima = new Map<number, boolean>()
      const canvasVisivel = (x: number, y: number): boolean => {
        const bx = x >> 2
        const by = y >> 2
        const chave = by * 65536 + bx
        let visivel = canvasPorCima.get(chave)
        if (visivel === undefined) {
          visivel = document.elementFromPoint(origem.x + (bx * 4 + 2) * escalaX, origem.y + (by * 4 + 2) * escalaY) === canvasDoMapa
          canvasPorCima.set(chave, visivel)
        }
        return visivel
      }
      // Cor quantizada em 32 níveis por canal.
      const q = (v: number) => v >> 3
      const chaveDe = (r: number, g: number, b: number) => (r << 10) | (g << 5) | b

      if (paleta === null) {
        const contagem = new Map<number, { n: number; cor: [number, number, number] }>()
        let total = 0
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (!canvasVisivel(x, y)) continue
            const i = (y * width + x) * 4
            const k = chaveDe(q(data[i]), q(data[i + 1]), q(data[i + 2]))
            const atual = contagem.get(k)
            if (atual) atual.n += 1
            else contagem.set(k, { n: 1, cor: [data[i], data[i + 1], data[i + 2]] })
            total += 1
          }
        }
        const ordenadas = Array.from(contagem.values()).sort((a, b) => b.n - a.n)
        const principais: [number, number, number][] = []
        let coberto = 0
        for (const item of ordenadas) {
          if (coberto >= total * 0.99 || principais.length >= 16) break
          principais.push(item.cor)
          coberto += item.n
        }
        return { paleta: { principais, todas: Array.from(contagem.keys()) }, novo: { pixels: 0, noCentro: 0, centro: null } }
      }

      // Cores "de cena vazia": a paleta, toda mistura entre duas cores dela
      // (antisserrilhado da grade em qualquer zoom) e um nível de folga por canal.
      const conhecidas = new Set<number>()
      const comFolga = (r: number, g: number, bl: number) => {
        for (let dr = -1; dr <= 1; dr += 1)
          for (let dg = -1; dg <= 1; dg += 1)
            for (let db = -1; db <= 1; db += 1) {
              const rr = r + dr
              const gg = g + dg
              const bb = bl + db
              if (rr < 0 || gg < 0 || bb < 0 || rr > 31 || gg > 31 || bb > 31) continue
              conhecidas.add(chaveDe(rr, gg, bb))
            }
      }
      for (const k of paleta.todas) comFolga(k >> 10, (k >> 5) & 31, k & 31)
      const PASSOS = 16
      const cores = paleta.principais
      for (let a = 0; a < cores.length; a += 1) {
        for (let b = a; b < cores.length; b += 1) {
          for (let s = 0; s <= PASSOS; s += 1) {
            const t = s / PASSOS
            comFolga(
              q(Math.round(cores[a][0] * (1 - t) + cores[b][0] * t)),
              q(Math.round(cores[a][1] * (1 - t) + cores[b][1] * t)),
              q(Math.round(cores[a][2] * (1 - t) + cores[b][2] * t)),
            )
          }
        }
      }
      const x0 = width * (0.5 - janela)
      const x1 = width * (0.5 + janela)
      const y0 = height * (0.5 - janela)
      const y1 = height * (0.5 + janela)
      let pixels = 0
      let noCentro = 0
      let somaX = 0
      let somaY = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          if (conhecidas.has(chaveDe(q(data[i]), q(data[i + 1]), q(data[i + 2])))) continue
          if (!canvasVisivel(x, y)) continue
          pixels += 1
          somaX += x
          somaY += y
          if (x >= x0 && x <= x1 && y >= y0 && y <= y1) noCentro += 1
        }
      }
      const centro = pixels === 0 ? null : { x: origem.x + (somaX / pixels) * escalaX, y: origem.y + (somaY / pixels) * escalaY }
      return { paleta, novo: { pixels, noCentro, centro } }
    },
    { b64: foto.toString('base64'), paleta, origem: c, janela: JANELA_CENTRAL },
  )
}

/** Fotografa a cena vazia e guarda a paleta dela. Confere que a régua não vê fantasma nela. */
async function paletaDaCenaVazia(page: Page, qualCena: string): Promise<Paleta> {
  await page.waitForTimeout(PINTURA_MS)
  const { paleta } = await lerCanvas(page, null)
  expect(paleta.principais.length, `a foto da ${qualCena} vazia não tem cor nenhuma: o canvas nem apareceu`).toBeGreaterThan(0)
  const { novo } = await lerCanvas(page, paleta)
  expect(novo.pixels, `régua cega: a ${qualCena} vazia e parada já mostra ${novo.pixels} pixels de "desenho novo"`).toBeLessThanOrEqual(RUIDO_MAXIMO)
  return paleta
}

/** O que foi desenhado sobre a cena vazia (poll até aparecer `minimo` pixels onde se espera). */
async function esperarDesenho(page: Page, paleta: Paleta, onde: 'em qualquer lugar' | 'perto do centro', mensagem: string): Promise<DesenhoNovo> {
  let ultimo: DesenhoNovo = { pixels: 0, noCentro: 0, centro: null }
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(PINTURA_MS)
        ultimo = (await lerCanvas(page, paleta)).novo
        return onde === 'perto do centro' ? ultimo.noCentro : ultimo.pixels
      },
      { timeout: 10_000, message: mensagem },
    )
    .toBeGreaterThanOrEqual(PIXELS_DE_UM_PINO)
  return ultimo
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos que a pessoa faz
// ───────────────────────────────────────────────────────────────────────────

/** Desce, fica parado um instante, sobe — sem mover. */
async function tocarComoPessoa(page: Page, p: Ponto): Promise<void> {
  // Leitura pura: o toque tem de cair no CANVAS, não num painel por cima dele.
  const quem = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? 'nada', p)
  expect(quem, `régua: o ponto (${Math.round(p.x)}, ${Math.round(p.y)}) não está sobre o mapa, está sobre ${quem}`).toBe('CANVAS')
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

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

async function salvar(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Mapa salvo').first(), 'Salvar deveria mostrar o aviso "Mapa salvo"').toBeVisible({ timeout: 10_000 })
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

function cenaCripta(lista: Locator): Locator {
  return lista.getByRole('button', { name: CRIPTA, exact: true })
}

/** A primeira cena: a entrada que não é a Cripta, nem "Nova cena", nem "Renomear…". */
function cenaA(lista: Locator): Locator {
  return lista.getByRole('button').filter({ hasNotText: /cripta|nova cena|renomear|cancelar|criar/i }).first()
}

async function estaDestacada(entrada: Locator): Promise<boolean> {
  for (const atributo of ['aria-current', 'aria-selected', 'aria-pressed']) {
    const valor = await entrada.getAttribute(atributo)
    if (valor !== null && valor !== 'false') return true
  }
  return false
}

/** "+ Nova cena", batizada de Cripta; a Cripta abre na hora. */
async function criarCripta(page: Page): Promise<void> {
  const lista = await secaoCenas(page)
  await lista.getByRole('button', { name: /nova cena/i }).click()
  const nomeDaCena = page.getByRole('textbox', { name: /cena/i })
  await expect(nomeDaCena, 'criar uma cena deveria pedir o nome dela').toBeVisible()
  await nomeDaCena.click()
  await nomeDaCena.press('Control+a')
  await nomeDaCena.pressSequentially(CRIPTA, { delay: 10 })
  await nomeDaCena.press('Enter')
  await expect(cenaCripta(lista), 'a Cripta deveria aparecer na lista de Cenas').toBeVisible()
  await expect.poll(() => estaDestacada(cenaCripta(lista)), { message: 'a Cripta recém-criada deveria estar destacada como a cena aberta' }).toBe(true)
}

async function irParaCenaA(page: Page): Promise<void> {
  const lista = await secaoCenas(page)
  await cenaA(lista).click()
  await expect.poll(() => estaDestacada(cenaA(lista)), { message: 'clicar na cena A na lista deveria abri-la e destacá-la' }).toBe(true)
}

/** Todo nome acessível de controle na tela — só para a mensagem de falha ajudar quem implementa. */
async function nomesDeControleNaTela(page: Page): Promise<string[]> {
  return page
    .locator('button, select, [role="radio"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="combobox"], [role="tab"]')
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => elemento.getAttribute('aria-label') ?? elemento.textContent?.trim() ?? '')
        .filter((nome) => nome !== ''),
    )
}

/** Um controle com este nome acessível, em qualquer papel plausível. Falha dizendo o que EXISTE hoje. */
async function controlePorNome(raiz: Page | Locator, page: Page, nome: RegExp, oQueAPessoaProcura: string): Promise<Locator> {
  const alvo = raiz
    .getByRole('button', { name: nome })
    .or(raiz.getByRole('radio', { name: nome }))
    .or(raiz.getByRole('combobox', { name: nome }))
    .or(raiz.getByRole('menuitem', { name: nome }))
    .or(raiz.getByRole('menuitemradio', { name: nome }))
    .or(raiz.getByRole('option', { name: nome }))
    .or(raiz.getByRole('link', { name: nome }))
  try {
    await expect(alvo.first()).toBeVisible({ timeout: 5000 })
  } catch {
    const existentes = await nomesDeControleNaTela(page)
    expect(await alvo.count(), `${oQueAPessoaProcura}: nenhum controle com nome ${String(nome)} na tela. O que a tela oferece hoje: ${existentes.join(' | ')}`).toBeGreaterThan(0)
  }
  return alvo.first()
}

/** O painel do pino aberto: a seção que carrega o título dele. */
async function painelDoPino(page: Page, oQue: string): Promise<Locator> {
  const titulo = page.getByRole('heading', { name: TITULO_DO_PAINEL }).first()
  await expect(titulo, `${oQue}: o painel do pino deveria estar aberto no rail`).toBeVisible({ timeout: 5000 })
  return titulo.locator('xpath=ancestor::*[self::section or @role="region" or @role="dialog"][1]')
}

/**
 * Frase visível no painel. Não vale texto que só existe porque um seletor
 * lista as cenas como OPÇÃO — "Cripta" dentro de um `<select>` ao lado de
 * "Leva a…" não é o painel dizendo para onde leva.
 */
function frase(painel: Locator, page: Page, texto: RegExp): Locator {
  return painel
    .getByText(texto)
    .filter({ hasNot: page.getByRole('combobox') })
    .filter({ hasNot: page.getByRole('listbox') })
    .filter({ hasNot: page.getByRole('option') })
    .first()
}

/** Abre o painel de um pino que já existe: ferramenta Pino na mão e clique nele. */
async function abrirPainelDoPino(page: Page, ondeEsta: Ponto, oQue: string): Promise<Locator> {
  await page.getByRole('button', { name: FERRAMENTA_PINO, exact: true }).click()
  await tocarComoPessoa(page, ondeEsta)
  return painelDoPino(page, oQue)
}

/** Escolhe uma opção num controle que pode ser `<select>`, menu, lista ou botões. */
async function escolher(page: Page, painel: Locator, controle: Locator, opcao: RegExp, textoDaOpcao: string, oQue: string): Promise<void> {
  const tag = await controle.evaluate((el) => el.tagName)
  if (tag === 'SELECT') {
    // Seletor nativo: foco nele e digitar o começo do nome, como no teclado.
    await controle.click()
    await page.keyboard.type(textoDaOpcao, { delay: 30 })
    await page.keyboard.press('Enter')
    return
  }
  await controle.click()
  const alvo = painel
    .getByRole('button', { name: opcao })
    .or(painel.getByRole('radio', { name: opcao }))
    .or(painel.getByRole('option', { name: opcao }))
    .or(page.getByRole('menu').getByRole('menuitem', { name: opcao }))
    .or(page.getByRole('menu').getByRole('menuitemradio', { name: opcao }))
    .or(page.getByRole('listbox').getByRole('option', { name: opcao }))
    .or(page.getByRole('dialog').getByRole('button', { name: opcao }))
  await expect(alvo.first(), `${oQue}: depois de abrir "Leva a…" a pessoa deveria ver a opção ${String(opcao)}`).toBeVisible({ timeout: 5000 })
  await alvo.first().click()
}

interface Montagem {
  /** Nome da primeira cena, como a lista de Cenas mostra. */
  nomeDaCenaA: string
  paletaA: Paleta
  paletaCripta: Paleta
}

/**
 * Aventura com a cena A e a Cripta vazias; fotografa as duas vazias.
 * Termina na cena A, sem pino nenhum.
 */
async function montarAventura(page: Page): Promise<Montagem> {
  await discoDoMestre(page)
  await criarAventura(page)
  const paletaA = await paletaDaCenaVazia(page, 'cena A')
  const lista = await secaoCenas(page)
  const nomeDaCenaA = ((await cenaA(lista).textContent()) ?? '').trim()
  expect(nomeDaCenaA, 'a primeira cena deveria ter um nome visível na lista de Cenas').not.toBe('')
  await criarCripta(page)
  const paletaCripta = await paletaDaCenaVazia(page, 'Cripta')
  await irParaCenaA(page)
  return { nomeDaCenaA, paletaA, paletaCripta }
}

/** Crava um pino na cena A com a ferramenta de hoje e devolve onde ele está desenhado. */
async function cravarPinoNaCenaA(page: Page, paletaA: Paleta): Promise<Ponto> {
  const c = await caixaDoCanvas(page)
  const ponto = { x: c.x + c.width * PINO_DE_A_FRACAO.x, y: c.y + c.height * PINO_DE_A_FRACAO.y }
  await page.getByRole('button', { name: FERRAMENTA_PINO, exact: true }).click()
  await tocarComoPessoa(page, ponto)
  const desenho = await esperarDesenho(page, paletaA, 'em qualquer lugar', 'clicar com a ferramenta Pino deveria desenhar um pino no mapa')
  if (desenho.centro === null) throw new Error('pino sem centro')
  return desenho.centro
}

/** Caso 2 inteiro: pino em A, tipo viagem, "Leva a…" Cripta, criar a chegada. Devolve onde o pino de A está. */
async function ligarPinoDeAaCripta(page: Page, m: Montagem): Promise<Ponto> {
  const pinoDeA = await cravarPinoNaCenaA(page, m.paletaA)
  let painel = await painelDoPino(page, 'logo depois de cravar o pino')

  const viagem = await controlePorNome(painel, page, TIPO_VIAGEM, 'tipo "viagem" no painel do pino')
  await viagem.click()
  painel = await painelDoPino(page, 'depois de escolher o tipo viagem')

  const levaA = await controlePorNome(painel, page, LEVA_A, 'o pino de viagem deveria oferecer "Leva a…" no painel')
  await escolher(page, painel, levaA, new RegExp(`^${CRIPTA}$`, 'i'), CRIPTA, 'escolher a cena de destino')
  painel = await painelDoPino(page, 'depois de escolher a Cripta como destino')

  const chegada = await controlePorNome(painel.or(page.getByRole('dialog')).or(page.getByRole('menu')), page, CRIAR_CHEGADA, 'com a Cripta escolhida, a pessoa deveria poder criar o pino de chegada')
  await chegada.click()

  painel = await painelDoPino(page, 'depois de criar o pino de chegada')
  await expect(frase(painel, page, /lev.*cripta/i), 'o painel do pino da cena A deveria dizer em texto que ele leva à Cripta').toBeVisible({ timeout: 5000 })
  return pinoDeA
}

/** Com a ferramenta Selecionar, clica no pino ligado — é o gesto de viajar. */
async function viajarPeloPino(page: Page, pino: Ponto): Promise<void> {
  await page.getByRole('button', { name: FERRAMENTA_SELECIONAR, exact: true }).click()
  await tocarComoPessoa(page, pino)
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: o marcador de hoje aparece onde foi posto e o painel dele abre', async ({ page }) => {
  test.setTimeout(120_000)
  const m = await montarAventura(page)

  const c = await caixaDoCanvas(page)
  const ondePos = { x: c.x + c.width * PINO_DE_A_FRACAO.x, y: c.y + c.height * PINO_DE_A_FRACAO.y }
  const desenhado = await cravarPinoNaCenaA(page, m.paletaA)
  const distancia = Math.hypot(desenhado.x - ondePos.x, desenhado.y - ondePos.y)
  expect(distancia, `o pino deveria aparecer onde o mestre clicou; apareceu a ${Math.round(distancia)} px de lá`).toBeLessThanOrEqual(DESENHO_PERTO_DO_CLIQUE)

  const painel = await painelDoPino(page, 'logo depois de cravar o pino')
  await expect(painel.getByLabel(/descri/i), 'o painel do pino recém-criado deveria mostrar o campo de descrição').toBeVisible()

  // O mesmo pino, reaberto pelo clique com a ferramenta Pino (o gesto que os casos seguintes usam).
  await page.keyboard.press('Escape')
  await abrirPainelDoPino(page, desenhado, 'clicar de novo no pino com a ferramenta Pino')
})

test('2. o pino da cena A vira pino de viagem, leva à Cripta e o painel diz isso', async ({ page }) => {
  test.setTimeout(150_000)
  const m = await montarAventura(page)
  await ligarPinoDeAaCripta(page, m)
})

test('3. clicar no pino ligado leva o mestre à Cripta, onde o pino de chegada está no centro e leva de volta', async ({ page }) => {
  test.setTimeout(150_000)
  const m = await montarAventura(page)
  const pinoDeA = await ligarPinoDeAaCripta(page, m)

  await viajarPeloPino(page, pinoDeA)
  const lista = await secaoCenas(page)
  await expect
    .poll(() => estaDestacada(cenaCripta(lista)), { timeout: 10_000, message: 'clicar no pino de viagem ligado deveria abrir a Cripta e destacá-la na lista de Cenas' })
    .toBe(true)

  const chegada = await esperarDesenho(page, m.paletaCripta, 'perto do centro', 'na Cripta, o pino de chegada deveria aparecer desenhado perto do centro da tela')
  if (chegada.centro === null) throw new Error('chegada sem centro')

  const painel = await abrirPainelDoPino(page, chegada.centro, 'abrir o pino de chegada na Cripta')
  const deVolta = new RegExp(`lev.*${m.nomeDaCenaA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
  await expect(frase(painel, page, deVolta), `o painel do pino de chegada deveria dizer em texto que ele leva de volta a "${m.nomeDaCenaA}"`).toBeVisible({ timeout: 5000 })
})

test('4. apagar o pino de chegada deixa o pino da cena A sem destino, dito no painel', async ({ page }) => {
  test.setTimeout(180_000)
  const m = await montarAventura(page)
  const pinoDeA = await ligarPinoDeAaCripta(page, m)

  await viajarPeloPino(page, pinoDeA)
  const lista = await secaoCenas(page)
  await expect.poll(() => estaDestacada(cenaCripta(lista)), { timeout: 10_000, message: 'o pino ligado deveria levar à Cripta' }).toBe(true)
  const chegada = await esperarDesenho(page, m.paletaCripta, 'perto do centro', 'o pino de chegada deveria estar no centro da Cripta')
  if (chegada.centro === null) throw new Error('chegada sem centro')

  const painelDaChegada = await abrirPainelDoPino(page, chegada.centro, 'abrir o pino de chegada para apagá-lo')
  const apagar = await controlePorNome(painelDaChegada, page, APAGAR_PINO, 'o painel do pino de chegada deveria ter como apagá-lo')
  await apagar.click()
  await expect
    .poll(async () => (await lerCanvas(page, m.paletaCripta)).novo.noCentro, { timeout: 10_000, message: 'depois de apagar, o pino de chegada deveria sumir do centro da Cripta' })
    .toBeLessThan(PIXELS_DE_UM_PINO)

  await irParaCenaA(page)
  const pino = await esperarDesenho(page, m.paletaA, 'em qualquer lugar', 'de volta à cena A, o pino dela deveria continuar desenhado')
  if (pino.centro === null) throw new Error('pino de A sem centro')
  const painel = await abrirPainelDoPino(page, pino.centro, 'abrir o pino da cena A depois de apagar a chegada')
  await expect(frase(painel, page, SEM_DESTINO), 'com o pino de chegada apagado, o painel do pino da cena A deveria dizer em texto que ele está sem destino').toBeVisible({ timeout: 5000 })
})

test('5. a ligação sobrevive a salvar, reiniciar e reabrir o app', async ({ page }) => {
  test.setTimeout(180_000)
  const m = await montarAventura(page)
  await ligarPinoDeAaCripta(page, m)

  await salvar(page)
  await reiniciarEReabrir(page)
  await irParaCenaA(page)

  const pino = await esperarDesenho(page, m.paletaA, 'em qualquer lugar', 'depois de reiniciar, o pino da cena A deveria continuar desenhado')
  if (pino.centro === null) throw new Error('pino de A sem centro')
  const painel = await abrirPainelDoPino(page, pino.centro, 'abrir o pino da cena A depois de reiniciar')
  await expect(frase(painel, page, /lev.*cripta/i), 'depois de reiniciar, o painel do pino da cena A deveria continuar dizendo que ele leva à Cripta').toBeVisible({ timeout: 5000 })
})
