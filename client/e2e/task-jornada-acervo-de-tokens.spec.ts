// JORNADA DE USUÁRIO do "acervo de tokens prontos" — escrita para SAIR
// VERMELHA no código de hoje.
//
// O QUE A PESSOA PEDIU (18/09/2026, palavras dela):
//   "Os tokens, eu queria que eu pudesse salvar Tokens pre prontos, tipos
//    tokens de npcs e afins para colocar para os jogadores"
//   E a decisão de produto que ela já tomou: o acervo é GLOBAL DO APP. Salvou
//   o goblin uma vez, ele aparece em QUALQUER mapa que ela abrir.
//
// ONDE ISSO MORRE HOJE:
//   - não existe `client/src/lib/tokenLibrary.ts`: o único armazenamento do
//     app é `lib/mapFileIO.ts` (`defaultMapsDir` = `appDataDir()/maps`), e ele
//     só sabe guardar MAPA;
//   - `components/PropertiesPanel.tsx` (bloco `tokenImage`) tem Nome e Imagem
//     do token, e nada que leve a foto para fora do mapa atual;
//   - não existe painel nenhum de galeria/acervo no rail: `App.tsx` monta
//     `PropertiesPanel` e `ActionBar`, mais nada;
//   - `App.tsx:998` (`handleAddToken`) sempre cria o token com `image: null`.
//
// COMO ESTE ARQUIVO PROVA, sem mentir:
//   GESTO REAL. Ponteiro e teclado de verdade (`click`, `pressSequentially`,
//   `page.mouse`). Nenhum `page.evaluate` que MUDA estado do app, nenhum
//   `dispatchEvent` sintético, nenhum `__emitTauri`. O único `evaluate` que
//   existe aqui LÊ (posição do token para saber onde fotografar, e
//   `naturalWidth` da miniatura) — e o decodificador de PNG de `corNaTela`,
//   que desenha um screenshot num canvas solto e não toca no app.
//   PROVA NA TELA. O que aparece: nome do item, miniatura carregada de
//   verdade (`naturalWidth > 0`) e a COR DOS PIXELS do token desenhado no
//   canvas. Nenhuma afirmação sai da store.
//   DISCO DE VERDADE-O-BASTANTE. O que é falsificado é só o disco e o seletor
//   de arquivo do Tauri; o pipeline de `lib/imageImport.ts` roda inteiro. E o
//   disco de mentira sobrevive ao `page.reload()` (fica em `sessionStorage`),
//   porque "o acervo é global do app" só está provado quando o app REINICIA e
//   o goblin continua lá — sem isso, um `useState` que nunca chega ao disco
//   passaria neste arquivo.
//
// O QUE ESTE ARQUIVO NÃO DITA: o formato do `acervo.json`, o nome do arquivo
// de imagem, nem se a imagem é reamostrada. Ele cobra o resultado: o item na
// tela, o item sobrevivendo ao outro mapa e ao reinício, o token nascendo com
// nome e foto, e o apagar que pergunta antes.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** 64x64 px: metade de cima #ff00ff, metade de baixo #00c853 — as mesmas duas
 *  cores de `task-jornada-token-com-foto.spec.ts`, para "a foto está
 *  desenhada" ser uma afirmação específica (as DUAS metades, cada uma no seu
 *  lado) e não "tem alguma cor diferente do fundo". */
const FOTO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nO3PUQkAIBTAwNfR0rbSEH4cwmABbnPmfN1wQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFrwOz1995QQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFb10lsMlp2HT+PAAAAABJRU5ErkJggg=='
/** Caminho que o diálogo do sistema devolve quando o mestre escolhe a foto. */
const FOTO_NO_DISCO_DO_MESTRE = 'C:/fotos/goblin.png'

/** A foto do SEGUNDO item: as mesmas duas cores, trocadas de metade (verde em
 *  cima, magenta embaixo). Sem uma segunda foto diferente, "o item trazido
 *  mostra a foto DELE" não se distingue de "mostra a foto de qualquer item do
 *  acervo" — e é exatamente o erro de trocar um item pelo outro que esta régua
 *  precisa pegar. Cores já provadas separáveis do fundo e da bolinha genérica. */
const FOTO_DO_ORC_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAUElEQVR42u3PQQkAAAgEsOtoaVtpBp/CYAWWdP0mICAgICAgICAgICAgICAgICAgICAgIHA2mdcEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBM4WHg3Jad0FTcQAAAAASUVORK5CYII='
const FOTO_DO_ORC_NO_DISCO = 'C:/fotos/orc.png'

type Cor = [number, number, number]
const METADE_DE_CIMA: Cor = [255, 0, 255]
const METADE_DE_BAIXO: Cor = [0, 200, 83]

/** Tolerância por canal — mesma régua e mesmo motivo de
 *  `task-jornada-token-com-foto.spec.ts`: separa com folga as cores em jogo
 *  (magenta, verde, fundo, azul da bolinha genérica) e ainda recusa qualquer
 *  uma trocada por outra. */
const TOLERANCIA = 60

const GRID = 64
const PAINT_MS = 200

type Foto = Awaited<ReturnType<Page['screenshot']>>

// ───────────────────────────────────────────────────────────────────────────
// Medida de pixel: o que está DESENHADO na tela, em RGB
// ───────────────────────────────────────────────────────────────────────────

/**
 * Foto de um recorte, com três tentativas. O Chromium responde
 * `Protocol error (Page.captureScreenshot): Unable to capture screenshot`
 * quando a aba fica sem compositor por um instante (visto na jornada da foto
 * do token, 17/09/2026). É ruído de infraestrutura, não resposta do app:
 * repetir é seguro, fotografar não muda nada.
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
 * dependência por isto). Não toca em estado nenhum do app.
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

function ehAMesmaCor(a: Cor, b: Cor): boolean {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) <= TOLERANCIA
}

function emTexto(cor: Cor): string {
  return `rgb(${cor[0]}, ${cor[1]}, ${cor[2]})`
}

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

/** O que fica guardado entre um `page.reload()` e o seguinte. */
interface DiscoSalvo {
  textos: Record<string, string>
  binarios: Record<string, number[]>
  pastas: string[]
  /** Quantas vezes o diálogo "Escolher imagem..." já respondeu. */
  escolhas?: number
}

/**
 * Disco e seletor de arquivo de mentira, em `sessionStorage`.
 *
 * Diferente de `helpers/tauriFsStub.ts` (que guarda tudo numa closure e por
 * isso ZERA a cada navegação), este sobrevive ao `page.reload()`. É essa a
 * diferença que dá sentido à jornada: um acervo que só existe em `useState`
 * passaria pelo "outro mapa" e morreria no reinício — e é justamente o
 * reinício que a pessoa vai fazer todo dia antes da sessão de jogo.
 *
 * `semente` escreve arquivos ANTES do app subir, para a jornada do
 * `acervo.json` ilegível poder existir sem nenhum `evaluate` que mexa no app.
 */
async function discoDoMestre(page: Page, semente: Record<string, string> = {}): Promise<void> {
  await page.addInitScript(
    (entrada: { fotos: Record<string, string>; fila: string[]; semente: Record<string, string> }) => {
      const CHAVE = 'labirinto.disco-de-mentira'
      const alvo = window as unknown as JanelaDoMestre
      const vazio: DiscoSalvo = { textos: {}, binarios: {}, pastas: [] }
      let disco: DiscoSalvo = vazio
      try {
        const bruto = window.sessionStorage.getItem(CHAVE)
        disco = bruto === null ? vazio : (JSON.parse(bruto) as DiscoSalvo)
      } catch {
        disco = vazio
      }
      for (const [caminho, conteudo] of Object.entries(entrada.semente)) {
        if (!(caminho in disco.textos)) disco.textos[caminho] = conteudo
      }
      const gravar = () => {
        try {
          window.sessionStorage.setItem(CHAVE, JSON.stringify(disco))
        } catch {
          // Cota estourada só deixa o disco sem persistir o último arquivo; a
          // jornada falha na asserção seguinte, que é onde ela deve falhar.
        }
      }
      gravar()

      const bytesDe = (base64: string): number[] => Array.from(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))
      // O protocolo de asset do Tauri serve o ARQUIVO que está naquele caminho.
      // Aqui também: a referência sai dos bytes gravados ali, e caminho sem
      // arquivo não vira foto nenhuma. Antes, qualquer `token_*` virava a MESMA
      // foto, e o app trazer o arquivo de OUTRO item passava despercebido.
      const tipoPorExtensao = (caminho: string): string => {
        const ext = caminho.slice(caminho.lastIndexOf('.') + 1).toLowerCase()
        return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      }
      const referenciaDoArquivo = (caminho: string): string => {
        const bytes = disco.binarios[caminho]
        if (!bytes) return caminho
        let binario = ''
        for (let i = 0; i < bytes.length; i += 1) binario += String.fromCharCode(bytes[i])
        return `data:${tipoPorExtensao(caminho)};base64,${btoa(binario)}`
      }
      const existe = (caminho: string): boolean =>
        caminho in disco.textos || caminho in disco.binarios || disco.pastas.indexOf(caminho) !== -1

      // Sem isto o App fica no modo navegador e "Escolher imagem..." recusa
      // (lib/imageImport.ts, `ImagePickerUnavailableError`).
      alvo.isTauri = true
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        transformCallback: () => 0,
        convertFileSrc: (caminho: string) => referenciaDoArquivo(String(caminho)),
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
              const caminho = String(a.path)
              if (caminho in disco.binarios) return disco.binarios[caminho]
              // A foto que o mestre escolheu no diálogo mora "fora" do disco
              // do app: é o arquivo original dele.
              if (caminho in entrada.fotos) return bytesDe(entrada.fotos[caminho])
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
              const prefixo = `${String(a.path).replace(/[/]+$/, '')}/`
              const nomes = Object.keys(disco.textos)
                .concat(Object.keys(disco.binarios))
                .filter((p) => p.indexOf(prefixo) === 0)
                .map((p) => p.slice(prefixo.length))
                .filter((nome) => nome.length > 0 && nome.indexOf('/') === -1)
              return nomes.map((name) => ({ name, isDirectory: false, isFile: true, isSymlink: false }))
            }
            case 'plugin:dialog|open': {
              // O mestre escolhe as fotos da pasta dele na ordem da fila:
              // primeiro o goblin, depois o orc.
              const vez = disco.escolhas ?? 0
              disco.escolhas = vez + 1
              gravar()
              return entrada.fila[vez % entrada.fila.length]
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
      fotos: { [FOTO_NO_DISCO_DO_MESTRE]: FOTO_BASE64, [FOTO_DO_ORC_NO_DISCO]: FOTO_DO_ORC_BASE64 },
      fila: [FOTO_NO_DISCO_DO_MESTRE, FOTO_DO_ORC_NO_DISCO],
      semente,
    },
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos que a pessoa faz
// ───────────────────────────────────────────────────────────────────────────

/** Menu inicial -> formulário -> editor, o mesmo caminho de `enterEditor`, mas
 *  a partir de uma página que JÁ está carregada (depois do reinício do app). */
async function criarOutroMapa(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Criar Mapas' }).click()
  await page.getByRole('button', { name: 'Criar mapa', exact: true }).click()
  await page.waitForSelector('canvas')
}

/** O token com foto, pelo caminho que existe na tela: "Adicionar token" ->
 *  nome -> "Escolher imagem..." -> diálogo do sistema -> `importTokenImage`. */
async function criarTokenComFoto(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  const campo = page.getByRole('textbox', { name: 'Nome do novo token' })
  await campo.click()
  await campo.pressSequentially(nome, { delay: 20 })
  await campo.press('Enter')
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()

  await page.getByRole('button', { name: 'Escolher imagem...' }).click()
  // "Trocar imagem..." no lugar de "Escolher imagem..." é a prova VISÍVEL de
  // que a foto entrou no token.
  await expect(page.getByRole('button', { name: 'Trocar imagem...' })).toBeVisible({ timeout: 15_000 })
}

/** Posição do token que acabou de nascer (o último) para saber ONDE
 *  fotografar. Leitura pura: não muda nada. */
async function ondeEstaOToken(page: Page): Promise<{ x: number; y: number; size: number }> {
  const token = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const tokens = mod.useMapStore.getState().map.tokens
    const t = tokens[tokens.length - 1]
    return t ? { x: t.x, y: t.y, size: t.size } : null
  })
  if (!token) throw new Error('nenhum token foi criado no mapa')
  return token
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. o goblin salvo no acervo aparece com nome e miniatura, continua lá em outro mapa e depois de reiniciar o app, e volta ao mapa com nome e foto', async ({ page }) => {
  // Dois itens salvos e dois trazidos: com a máquina carregada a volta leva
  // ~2,2 min, perto demais dos 3 de antes.
  test.setTimeout(300_000)
  await discoDoMestre(page)
  await enterEditor(page)

  await criarTokenComFoto(page, 'Goblin')

  // ── salvar no acervo ─────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Salvar no acervo' }).click()

  // ── o item aparece com NOME e MINIATURA ──────────────────────────────────
  const goblinNoAcervo = page.getByRole('button', { name: 'Colocar Goblin no mapa' })
  await expect(goblinNoAcervo).toBeVisible({ timeout: 15_000 })
  const miniatura = page.getByRole('img', { name: 'Foto de Goblin' })
  await expect(miniatura).toBeVisible()
  // Miniatura que CARREGOU, não `<img>` quebrado: sem isto o item passaria com
  // um quadrado vazio no lugar da foto.
  await expect
    .poll(async () => miniatura.evaluate((el) => (el instanceof HTMLImageElement ? el.naturalWidth : 0)), { timeout: 10_000 })
    .toBeGreaterThan(0)

  // ── um SEGUNDO item, com OUTRA foto: sem ele, trazer o item errado passa ──
  await criarTokenComFoto(page, 'Orc')
  await page.getByRole('button', { name: 'Salvar no acervo' }).click()
  const orcNoAcervo = page.getByRole('button', { name: 'Colocar Orc no mapa' })
  await expect(orcNoAcervo).toBeVisible({ timeout: 15_000 })

  // ── OUTRO MAPA, mesma sessão: o acervo é do app, não do mapa ─────────────
  await page.getByRole('button', { name: 'Início' }).click()
  await criarOutroMapa(page)
  await expect(goblinNoAcervo).toBeVisible({ timeout: 15_000 })

  // ── APP REINICIADO: é isto que separa "está no disco" de "está na memória" ─
  await page.reload()
  await criarOutroMapa(page)
  await expect(goblinNoAcervo).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('img', { name: 'Foto de Goblin' })).toBeVisible()

  // ── clicar coloca o token no mapa, com NOME e FOTO ───────────────────────
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  await goblinNoAcervo.click()

  await expect(page.locator('#lb-token-name')).toHaveValue('Goblin', { timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Trocar imagem...' })).toBeVisible({ timeout: 15_000 })

  const token = await ondeEstaOToken(page)
  const centro = { x: caixa.x + token.x, y: caixa.y + token.y }
  const raio = (GRID * token.size) / 2

  // Deselecionar ANTES de medir: token selecionado ganha um anel da cor de
  // seleção (pixi/tokensRenderer.ts), que sujaria a amostra da borda.
  await page.mouse.click(centro.x + raio * 5, centro.y + raio * 4)
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toHaveCount(0)
  await page.waitForTimeout(PAINT_MS)

  const emCima = await corNaTela(page, centro.x, centro.y - raio * 0.5)
  const emBaixo = await corNaTela(page, centro.x, centro.y + raio * 0.5)
  expect(ehAMesmaCor(emCima, METADE_DE_CIMA), `a metade de cima da foto do GOBLIN deveria estar no token Goblin; veio ${emTexto(emCima)}`).toBe(true)
  expect(ehAMesmaCor(emBaixo, METADE_DE_BAIXO), `a metade de baixo da foto do GOBLIN deveria estar no token Goblin; veio ${emTexto(emBaixo)}`).toBe(true)

  // ── e o Orc chega com a foto DELE (metades trocadas), não com a do goblin ─
  // Os dois sentidos juntos pegam "sempre o primeiro item" e "sempre o
  // último", além de "o item vizinho".
  await orcNoAcervo.click()
  await expect(page.locator('#lb-token-name')).toHaveValue('Orc', { timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Trocar imagem...' })).toBeVisible({ timeout: 15_000 })
  const orc = await ondeEstaOToken(page)
  const centroDoOrc = { x: caixa.x + orc.x, y: caixa.y + orc.y }
  const raioDoOrc = (GRID * orc.size) / 2
  await page.mouse.click(centroDoOrc.x + raioDoOrc * 5, centroDoOrc.y + raioDoOrc * 4)
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toHaveCount(0)
  await page.waitForTimeout(PAINT_MS)

  const orcEmCima = await corNaTela(page, centroDoOrc.x, centroDoOrc.y - raioDoOrc * 0.5)
  const orcEmBaixo = await corNaTela(page, centroDoOrc.x, centroDoOrc.y + raioDoOrc * 0.5)
  expect(ehAMesmaCor(orcEmCima, METADE_DE_BAIXO), `a metade de cima da foto do ORC (verde) deveria estar no token Orc; veio ${emTexto(orcEmCima)}`).toBe(true)
  expect(ehAMesmaCor(orcEmBaixo, METADE_DE_CIMA), `a metade de baixo da foto do ORC (magenta) deveria estar no token Orc; veio ${emTexto(orcEmBaixo)}`).toBe(true)
})

test('2. apagar do acervo pergunta antes, e o que foi apagado não volta quando o app reinicia', async ({ page }) => {
  test.setTimeout(180_000)
  await discoDoMestre(page)
  await enterEditor(page)

  await criarTokenComFoto(page, 'Orc')
  await page.getByRole('button', { name: 'Salvar no acervo' }).click()
  const orcNoAcervo = page.getByRole('button', { name: 'Colocar Orc no mapa' })
  await expect(orcNoAcervo).toBeVisible({ timeout: 15_000 })

  // ── pergunta antes, e desistir deixa tudo como estava ────────────────────
  await page.getByRole('button', { name: 'Apagar Orc do acervo' }).click()
  await expect(page.getByRole('button', { name: 'Manter no acervo' })).toBeVisible()
  await page.getByRole('button', { name: 'Manter no acervo' }).click()
  await expect(orcNoAcervo).toBeVisible()

  // ── confirmar apaga de verdade, e o painel fica com o estado vazio ───────
  await page.getByRole('button', { name: 'Apagar Orc do acervo' }).click()
  await page.getByRole('button', { name: 'Apagar Orc para sempre' }).click()
  await expect(orcNoAcervo).toHaveCount(0)
  await expect(page.getByText('Nenhum token no acervo ainda.')).toBeVisible()

  // ── e some do disco, não só da tela ──────────────────────────────────────
  await page.reload()
  await criarOutroMapa(page)
  await expect(page.getByRole('button', { name: 'Colocar Orc no mapa' })).toHaveCount(0)
  await expect(page.getByText('Nenhum token no acervo ainda.')).toBeVisible()
})

test('3. acervo.json ilegível não derruba a tela: o editor abre, o acervo aparece vazio e diz o que houve', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  // O arquivo já está corrompido ANTES do app subir — é o caso do disco cheio
  // no meio da gravação, ou do arquivo editado à mão.
  await discoDoMestre(page, { 'C:/appdata/tokens/acervo.json': '{ isto não é json' })
  page.on('pageerror', (erro) => erros.push(erro.message))
  await enterEditor(page)

  // A tela abre inteira: a barra de ações e o inspetor continuam lá.
  await expect(page.getByRole('button', { name: 'Adicionar token', exact: true })).toBeVisible()
  await expect(page.getByText('Não foi possível ler o acervo de tokens', { exact: false })).toBeVisible({ timeout: 15_000 })
  expect(erros, `o acervo ilegível não pode derrubar a tela; erros: ${erros.join(' | ')}`).toEqual([])
})
