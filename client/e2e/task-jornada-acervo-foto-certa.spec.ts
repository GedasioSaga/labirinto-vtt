// JORNADA DE USUÁRIO — "o acervo traz a foto DAQUELE item".
//
// O QUE ESTA JORNADA COBRA, e que nenhuma outra cobra hoje:
//   O mestre tem DOIS NPCs na estante, cada um com a cara dele. Ele clica no
//   segundo. O token que nasce no mapa tem de vir com a foto DO SEGUNDO — não
//   com a do primeiro, não com um quadrado vazio.
//
// POR QUE ELA PRECISOU EXISTIR (varredura de 18/09/2026, achado
// `task-jornada-acervo-de-tokens.spec.ts:193`, status CONFIRMADO):
//   o disco de mentira da jornada selada devolve, em `convertFileSrc`, a MESMA
//   foto para QUALQUER caminho que contenha `token_`. Os pixels que ela mede
//   vêm do stub, não do disco: `salvarNoAcervo` poderia gravar o arquivo
//   errado (ou nenhum) e a medida de pixel continuaria verde. E a jornada
//   selada nunca põe DOIS itens no acervo, então o mapeamento item → arquivo
//   não tem testemunha nenhuma.
//
// O QUE MUDA AQUI: o disco de mentira mapeia CAMINHO → BYTES DE VERDADE, um
// arquivo por item, e `convertFileSrc` devolve exatamente os bytes que estão
// naquele caminho. Uma cópia trocada, um índice que aponta para o arquivo do
// vizinho, ou um `readFile` no caminho errado passam a mudar a COR do pixel.
//
// REGRAS DE JORNADA respeitadas: gesto real de ponteiro e teclado; nenhum
// `evaluate` que MUDE estado do app (os dois que existem LEEM: a posição do
// token, para saber onde fotografar, e o `naturalWidth` da miniatura; mais o
// decodificador de PNG de `corNaTela`, que desenha um screenshot num canvas
// solto). Toda afirmação é sobre o que está DESENHADO na tela.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/**
 * Duas fotos 64x64 de cor CHAPADA, geradas como PNG de verdade.
 *
 * Vermelho puro e verde puro, e nenhum dos dois é azul: o token sem foto é um
 * círculo `0x5a8fd6` (pixi/drawTokens.ts) e a moldura é `0xe0a44a`
 * (pixi/constants.ts). Uma foto azul deixaria "veio a foto" e "veio a bolinha
 * genérica" indistinguíveis dentro da tolerância — foi por isso que a jornada
 * não usa o vermelho/azul da conversa.
 */
const FOTO_VERMELHA_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAS0lEQVR42u3PQQkAAAgAsetfWiP4FgYrsKZeS0BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEDgsqnc8OJg6Ln3AAAAAElFTkSuQmCC'
const FOTO_VERDE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAATElEQVR42u3PQQkAAAgAseufzFhG8C0MVmA1/SYgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcFncr4C1OHup8AAAAABJRU5ErkJggg=='

/** Os dois arquivos que o mestre tem na pasta de fotos dele. */
const FOTO_VERMELHA_NO_DISCO = 'C:/fotos/npc-vermelho.png'
const FOTO_VERDE_NO_DISCO = 'C:/fotos/npc-verde.png'

type Cor = [number, number, number]
const VERMELHO: Cor = [255, 0, 0]
const VERDE: Cor = [0, 200, 0]

/** Mesma régua da jornada selada: separa com folga as cores em jogo (vermelho,
 *  verde, a bolinha azul genérica, a moldura alaranjada e o fundo) e ainda
 *  recusa qualquer uma trocada por outra. */
const TOLERANCIA = 60

const GRID = 64
const PAINT_MS = 200

type Foto = Awaited<ReturnType<Page['screenshot']>>

// ───────────────────────────────────────────────────────────────────────────
// Medida de pixel: o que está DESENHADO na tela, em RGB
// ───────────────────────────────────────────────────────────────────────────

/** Foto de um recorte, com três tentativas — o Chromium responde
 *  "Unable to capture screenshot" quando a aba fica sem compositor por um
 *  instante. É ruído de infraestrutura: fotografar não muda nada. */
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

/** Cor de UM pixel da tela. O screenshot é a fonte da verdade; o `evaluate`
 *  abaixo é só decodificador de PNG e não toca em estado nenhum do app. */
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

function ehAMesmaCor(a: Cor, b: Cor): boolean {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) <= TOLERANCIA
}

function emTexto(cor: Cor): string {
  return `rgb(${cor[0]}, ${cor[1]}, ${cor[2]})`
}

// ───────────────────────────────────────────────────────────────────────────
// Disco de mentira que sabe QUAL arquivo é QUAL
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
 * Disco e seletor de arquivo de mentira, em `sessionStorage` (sobrevive ao
 * reinício do app, como o da jornada selada).
 *
 * A DIFERENÇA que dá sentido a este arquivo: `convertFileSrc(caminho)` devolve
 * uma data URL construída com os BYTES QUE ESTÃO NAQUELE CAMINHO — do disco do
 * app, ou da pasta de fotos do mestre. Não há mais uma foto única devolvida
 * para todo caminho com `token_`: a tela passa a mostrar o arquivo de verdade,
 * e trocar um arquivo pelo outro muda a cor do pixel.
 *
 * `fila` é o seletor de arquivo do sistema: cada "Escolher imagem..." devolve
 * o PRÓXIMO caminho da fila, como a pessoa escolhendo uma foto diferente da
 * vez anterior. Fica em `sessionStorage` para não depender de nenhum
 * `evaluate` do teste.
 */
async function discoComDuasFotos(page: Page): Promise<void> {
  await page.addInitScript(
    (entrada: { arquivos: Record<string, string>; fila: string[] }) => {
      const CHAVE = 'labirinto.disco-de-mentira'
      const CHAVE_FILA = 'labirinto.fila-do-seletor'
      const alvo = window as unknown as JanelaDoMestre
      const vazio: DiscoSalvo = { textos: {}, binarios: {}, pastas: [] }
      let disco: DiscoSalvo = vazio
      try {
        const bruto = window.sessionStorage.getItem(CHAVE)
        disco = bruto === null ? vazio : (JSON.parse(bruto) as DiscoSalvo)
      } catch {
        disco = vazio
      }
      const gravar = () => {
        try {
          window.sessionStorage.setItem(CHAVE, JSON.stringify(disco))
        } catch {
          // Cota estourada deixa o disco sem persistir o último arquivo; a
          // jornada falha na asserção seguinte, que é onde ela deve falhar.
        }
      }
      gravar()

      /** Os arquivos que estão na pasta de fotos do mestre, fora do app. */
      const externos: Record<string, number[]> = {}
      for (const [caminho, base64] of Object.entries(entrada.arquivos)) {
        externos[caminho] = Array.from(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))
      }

      const filaGuardada = window.sessionStorage.getItem(CHAVE_FILA)
      const fila: string[] = filaGuardada === null ? [...entrada.fila] : (JSON.parse(filaGuardada) as string[])
      const gravarFila = () => {
        try {
          window.sessionStorage.setItem(CHAVE_FILA, JSON.stringify(fila))
        } catch {
          // Mesmo critério do disco.
        }
      }
      gravarFila()

      const bytesEm = (caminho: string): number[] | null => {
        if (caminho in disco.binarios) return disco.binarios[caminho]
        if (caminho in externos) return externos[caminho]
        return null
      }
      const existe = (caminho: string): boolean =>
        caminho in disco.textos || caminho in disco.binarios || disco.pastas.indexOf(caminho) !== -1

      alvo.isTauri = true
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        transformCallback: () => 0,
        // O protocolo de asset do Tauri, honesto: os bytes daquele caminho, e
        // só deles. Caminho que não existe volta como está — o `<img>` quebra,
        // que é exatamente o que aconteceria na máquina do mestre.
        convertFileSrc: (caminho: string) => {
          const bytes = bytesEm(String(caminho))
          if (bytes === null) return String(caminho)
          const extensao = String(caminho).split('.').pop()
          const tipo = extensao === 'webp' ? 'webp' : extensao === 'jpg' || extensao === 'jpeg' ? 'jpeg' : 'png'
          let texto = ''
          for (const b of bytes) texto += String.fromCharCode(b)
          return `data:image/${tipo};base64,${btoa(texto)}`
        },
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
              if (disco.pastas.indexOf(String(a.path)) === -1) disco.pastas.push(String(a.path))
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
              const bytes = bytesEm(String(a.path))
              if (bytes === null) throw new Error(`arquivo não existe: ${String(a.path)}`)
              return bytes
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
              const prefixo = `${String(a.path).replace(/[/]+$/, '')}/`
              const nomes = Object.keys(disco.textos)
                .concat(Object.keys(disco.binarios))
                .filter((p) => p.indexOf(prefixo) === 0)
                .map((p) => p.slice(prefixo.length))
                .filter((nome) => nome.length > 0 && nome.indexOf('/') === -1)
              return nomes.map((name) => ({ name, isDirectory: false, isFile: true, isSymlink: false }))
            }
            case 'plugin:dialog|open': {
              // A pessoa escolhe uma foto DIFERENTE a cada vez.
              const escolhido = fila.length > 1 ? (fila.shift() as string) : fila[0]
              gravarFila()
              return escolhido
            }
            case 'plugin:event|listen':
              return 1
            default:
              return null
          }
        },
      }
    },
    {
      arquivos: { [FOTO_VERMELHA_NO_DISCO]: FOTO_VERMELHA_BASE64, [FOTO_VERDE_NO_DISCO]: FOTO_VERDE_BASE64 },
      fila: [FOTO_VERMELHA_NO_DISCO, FOTO_VERDE_NO_DISCO],
    },
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos que a pessoa faz
// ───────────────────────────────────────────────────────────────────────────

/** "Adicionar token" → nome → "Escolher imagem..." → diálogo do sistema. */
async function criarTokenComFoto(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  const campo = page.getByRole('textbox', { name: 'Nome do novo token' })
  await campo.click()
  await campo.pressSequentially(nome, { delay: 20 })
  await campo.press('Enter')
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()

  await page.getByRole('button', { name: 'Escolher imagem...' }).click()
  await expect(page.getByRole('button', { name: 'Trocar imagem...' })).toBeVisible({ timeout: 15_000 })
}

/**
 * Guarda o token na estante e TIRA a peça deste mapa — é o gesto de quem está
 * montando a estante, não a mesa. Deixa o mapa limpo, para o token que vier do
 * acervo depois ser o único desenhado e a medida de pixel não ter vizinho.
 */
async function guardarNoAcervoELimparOMapa(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: 'Salvar no acervo' }).click()
  await expect(page.getByRole('button', { name: `Colocar ${nome} no mapa` })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Apagar token selecionado' }).click()
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toHaveCount(0)
}

/** Posição do ÚLTIMO token do mapa, para saber onde fotografar. Leitura pura. */
async function ondeEstaOUltimoToken(page: Page): Promise<{ x: number; y: number; size: number }> {
  const token = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const tokens = mod.useMapStore.getState().map.tokens
    const t = tokens[tokens.length - 1]
    return t ? { x: t.x, y: t.y, size: t.size } : null
  })
  if (!token) throw new Error('nenhum token foi colocado no mapa')
  return token
}

/**
 * Espera a tela mostrar `alvo` naquele pixel, e devolve a ÚLTIMA cor vista.
 *
 * Não existe nada visível que anuncie o fim da troca de foto (o rótulo do
 * arquivo não muda, não há aviso), então a jornada não tem por onde esperar a
 * não ser pela própria tela. Devolver a última cor — em vez de estourar — é o
 * que deixa a mensagem de falha dizer QUAL cor ficou lá.
 */
async function esperarCorNaTela(page: Page, x: number, y: number, alvo: Cor, limiteMs: number): Promise<Cor> {
  const fim = Date.now() + limiteMs
  let cor = await corNaTela(page, x, y)
  while (!ehAMesmaCor(cor, alvo) && Date.now() < fim) {
    await page.waitForTimeout(250)
    cor = await corNaTela(page, x, y)
  }
  return cor
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('CONTROLE POSITIVO: com dois NPCs na estante, o que a pessoa escolhe vem com a foto DELE e não com a do vizinho', async ({ page }) => {
  test.setTimeout(180_000)
  await discoComDuasFotos(page)
  await enterEditor(page)

  // Duas caras diferentes na estante, e o mapa vazio no fim.
  await criarTokenComFoto(page, 'Vermelho')
  await guardarNoAcervoELimparOMapa(page, 'Vermelho')
  await criarTokenComFoto(page, 'Verde')
  await guardarNoAcervoELimparOMapa(page, 'Verde')

  await expect(page.getByRole('button', { name: 'Colocar Vermelho no mapa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Colocar Verde no mapa' })).toBeVisible()

  // Miniatura que CARREGOU de verdade, uma por item: sem isto os dois itens
  // passariam com um quadrado vazio no lugar da foto.
  for (const nome of ['Vermelho', 'Verde']) {
    const miniatura = page.getByRole('img', { name: `Foto de ${nome}` })
    await expect(miniatura).toBeVisible()
    await expect
      .poll(async () => miniatura.evaluate((el) => (el instanceof HTMLImageElement ? el.naturalWidth : 0)), { timeout: 10_000 })
      .toBeGreaterThan(0)
  }

  // ── a pessoa clica no SEGUNDO da estante ─────────────────────────────────
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  await page.getByRole('button', { name: 'Colocar Verde no mapa' }).click()

  await expect(page.locator('#lb-token-name')).toHaveValue('Verde', { timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Trocar imagem...' })).toBeVisible({ timeout: 15_000 })

  const token = await ondeEstaOUltimoToken(page)
  const centro = { x: caixa.x + token.x, y: caixa.y + token.y }
  const raio = (GRID * token.size) / 2

  // Deselecionar ANTES de medir: token selecionado ganha um anel da cor de
  // seleção (pixi/tokensRenderer.ts), que sujaria a amostra.
  await page.mouse.click(centro.x + raio * 5, centro.y + raio * 4)
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toHaveCount(0)
  await page.waitForTimeout(PAINT_MS)

  const noCentro = await corNaTela(page, centro.x, centro.y)
  const acimaDoCentro = await corNaTela(page, centro.x, centro.y - raio * 0.4)

  expect(
    ehAMesmaCor(noCentro, VERDE),
    `o token colocado a partir de "Verde" tinha de estar com a foto VERDE dele; o pixel do centro veio ${emTexto(noCentro)}`,
  ).toBe(true)
  expect(
    ehAMesmaCor(acimaDoCentro, VERDE),
    `a foto de "Verde" tinha de cobrir o token inteiro; acima do centro veio ${emTexto(acimaDoCentro)}`,
  ).toBe(true)
  expect(
    ehAMesmaCor(noCentro, VERMELHO),
    `o token trouxe a foto do OUTRO item da estante ("Vermelho"): o pixel do centro veio ${emTexto(noCentro)}`,
  ).toBe(false)
})

/**
 * O DEFEITO — a estante guarda uma cara que a pessoa NUNCA viu na tela.
 *
 * A pessoa troca a foto do token ("Trocar imagem..."), olha a peça e clica em
 * "Salvar no acervo". Hoje o token continua desenhado com a foto ANTIGA: o
 * caminho do arquivo é o mesmo dos dois lados da troca
 * (`imageImport.ts` grava sempre `token_<id>_original.<ext>` na pasta do mapa),
 * e `pixi/tokensRenderer.ts` só recarrega a textura quando esse caminho MUDA
 * (`entry.loadedSrc !== photoRef`) — com o mesmo caminho, o `Assets.load` do
 * Pixi ainda devolveria a textura em cache.
 *
 * O resultado é o pior dos dois: o disco fica CERTO e a tela fica ERRADA. A
 * segunda metade desta jornada prova isso — o item novo da estante, trazido
 * para o mapa, vem com a cara nova. Ou seja: a pessoa guardou a cara certa por
 * sorte, olhando para a errada. No dia em que ela tiver três NPCs parecidos,
 * vai guardar o que está vendo, e o que está vendo é mentira.
 *
 * A cobrança da tela é `expect.soft` de propósito: assim a jornada continua e
 * prova, na mesma execução, que o disco estava certo o tempo todo — é essa a
 * diferença entre "a foto não foi gravada" e "a tela não mostrou".
 */
test('a foto que a pessoa acabou de escolher tem de ser a que aparece no token antes de ela guardar na estante', async ({ page }) => {
  test.setTimeout(180_000)
  await discoComDuasFotos(page)
  await enterEditor(page)

  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')

  // ── o bicho nasce com a foto vermelha e vai para a estante ───────────────
  await criarTokenComFoto(page, 'Bicho')
  await page.getByRole('button', { name: 'Salvar no acervo' }).click()
  await expect(page.getByRole('button', { name: 'Colocar Bicho no mapa' })).toBeVisible({ timeout: 15_000 })

  const bicho = await ondeEstaOUltimoToken(page)
  const centro = { x: caixa.x + bicho.x, y: caixa.y + bicho.y }
  await page.waitForTimeout(PAINT_MS)
  const antesDaTroca = await corNaTela(page, centro.x, centro.y)
  expect(
    ehAMesmaCor(antesDaTroca, VERMELHO),
    `o token tinha de nascer com a foto vermelha escolhida; veio ${emTexto(antesDaTroca)}`,
  ).toBe(true)

  // ── ela troca a foto: agora o bicho é o verde ────────────────────────────
  await page.getByRole('button', { name: 'Trocar imagem...' }).click()
  const depoisDaTroca = await esperarCorNaTela(page, centro.x, centro.y, VERDE, 8_000)

  expect
    .soft(
      ehAMesmaCor(depoisDaTroca, VERDE),
      `a pessoa escolheu a foto verde e o token continuou com a foto ANTIGA na tela: o pixel do centro veio ${emTexto(depoisDaTroca)} depois de 8 segundos — é essa cara velha que ela vê quando aperta "Salvar no acervo"`,
    )
    .toBe(true)

  // ── ela guarda de novo, achando que está guardando a cara nova ───────────
  await page.getByRole('button', { name: 'Salvar no acervo' }).click()
  await expect(page.getByRole('button', { name: 'Colocar Bicho (2) no mapa' })).toBeVisible({ timeout: 15_000 })

  // ── mapa limpo, para o token que vier da estante ser o único desenhado ───
  await page.getByRole('button', { name: 'Apagar token selecionado' }).click()
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toHaveCount(0)

  // ── o disco estava certo o tempo todo: o item novo volta VERDE ───────────
  await page.getByRole('button', { name: 'Colocar Bicho (2) no mapa' }).click()
  await expect(page.locator('#lb-token-name')).toHaveValue('Bicho (2)', { timeout: 15_000 })

  const trazido = await ondeEstaOUltimoToken(page)
  const centroTrazido = { x: caixa.x + trazido.x, y: caixa.y + trazido.y }
  const raioTrazido = (GRID * trazido.size) / 2
  await page.mouse.click(centroTrazido.x + raioTrazido * 5, centroTrazido.y + raioTrazido * 4)
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toHaveCount(0)
  await page.waitForTimeout(PAINT_MS)

  const corDoTrazido = await corNaTela(page, centroTrazido.x, centroTrazido.y)
  expect(
    ehAMesmaCor(corDoTrazido, VERDE),
    `"Bicho (2)" guardou a foto verde no disco e tinha de voltar verde; veio ${emTexto(corDoTrazido)}`,
  ).toBe(true)
})
