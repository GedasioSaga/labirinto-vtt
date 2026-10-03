import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

// IMAGEM DO TOKEN POR ARRASTAR E COLAR — o mesmo que o painel do pino ganhou
// (commit d485e232): acima do "Escolher imagem..." / "Trocar imagem..." fica a
// área "Arraste uma imagem para cá / ou clique aqui e cole com Ctrl+V".
//
// O QUE PROVA, no editor de verdade (vite, Chromium):
//   1. o mestre cria um token sem foto; a área aparece ACIMA do "Escolher imagem...";
//   2. SOLTA um PNG vermelho de verdade na área: o arquivo vai para a pasta do
//      mapa pelo MESMO caminho do diálogo (token_<id>_original.png), o token
//      ganha a cópia que viaja ao jogador (data URL) e aparece VERMELHO no mapa;
//   3. copia um PNG verde para a área de transferência do navegador, clica na
//      área e aperta Ctrl+V de verdade: o token fica VERDE (e o Ctrl+V não cola
//      nada no mapa);
//   4. Ctrl+Z volta a foto vermelha (a troca passou pelo histórico);
//   5. colar um texto avisa "Não veio imagem" e não mexe na foto.
//
// O disco e o Tauri são de mentira (`__TAURI_INTERNALS__`, como em
// task-jornada-acervo-foto-certa.spec.ts): `convertFileSrc` devolve os BYTES
// gravados naquele caminho, então a cor na tela é a do arquivo que o app gravou.
// O arrastar vem de um `DragEvent` com um `DataTransfer` do próprio Chromium
// (o Playwright não arrasta arquivo do sistema operacional) — o mesmo evento
// que o webview recebe com `dragDropEnabled: false`. O colar do passo 3 é o
// Ctrl+V do teclado sobre a área de transferência real; o do passo 5, um
// `ClipboardEvent` com um arquivo de texto.

type Cor = [number, number, number]
const VERMELHO: Cor = [255, 0, 0]
const VERDE: Cor = [0, 200, 0]
const TOLERANCIA = 60
const GRID = 64
const PAINT_MS = 300

type InternalsDoTauri = {
  metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
  invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
  transformCallback: () => number
  convertFileSrc: (filePath: string, protocol?: string) => string
}
type JanelaDoMestre = { isTauri: boolean; __TAURI_INTERNALS__: InternalsDoTauri; __discoDeMentira: Record<string, number[]> }

/** Tauri de mentira com um disco em memória; `window.__discoDeMentira` é o que foi gravado. */
async function discoDeMentira(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const alvo = window as unknown as JanelaDoMestre
    const binarios: Record<string, number[]> = {}
    const pastas: string[] = []
    alvo.__discoDeMentira = binarios
    alvo.isTauri = true
    alvo.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      transformCallback: () => 0,
      convertFileSrc: (caminho: string) => {
        const bytes = binarios[String(caminho)]
        if (bytes === undefined) return String(caminho)
        let texto = ''
        for (const b of bytes) texto += String.fromCharCode(b)
        return `data:image/png;base64,${btoa(texto)}`
      },
      invoke: async (cmd, args, options) => {
        const a = (args ?? {}) as Record<string, unknown>
        switch (cmd) {
          case 'plugin:path|resolve_directory':
            return 'C:/appdata'
          case 'plugin:path|join':
            return (a.paths as string[]).join('/')
          case 'plugin:fs|exists':
            return String(a.path) in binarios || pastas.indexOf(String(a.path)) !== -1
          case 'plugin:fs|mkdir':
            pastas.push(String(a.path))
            return null
          case 'plugin:fs|write_file': {
            const caminho = decodeURIComponent(options?.headers?.path ?? '')
            binarios[caminho] = Array.from(args as Uint8Array)
            return null
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

/** Um PNG de verdade, 64x64 de cor chapada, como um `File` dentro de um `DataTransfer` — e o evento solto na área. */
async function entregarImagem(page: Page, gesto: 'drop' | 'paste', cor: Cor | 'texto'): Promise<void> {
  await page.evaluate(
    async ({ gesto, cor }) => {
      const area = document.querySelector<HTMLElement>('[aria-label="Colar ou soltar imagem do token"]')
      if (area === null) throw new Error('sem a área de imagem do token')
      const dados = new DataTransfer()
      if (cor === 'texto') {
        dados.items.add(new File(['só texto'], 'notas.txt', { type: 'text/plain' }))
      } else {
        const tela = document.createElement('canvas')
        tela.width = 64
        tela.height = 64
        const ctx = tela.getContext('2d')
        if (ctx === null) throw new Error('canvas 2D indisponível')
        ctx.fillStyle = `rgb(${cor[0]}, ${cor[1]}, ${cor[2]})`
        ctx.fillRect(0, 0, 64, 64)
        const blob = await new Promise<Blob | null>((resolve) => tela.toBlob(resolve, 'image/png'))
        if (blob === null) throw new Error('PNG não saiu')
        dados.items.add(new File([blob], 'foto.png', { type: 'image/png' }))
      }
      if (gesto === 'drop') {
        area.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dados }))
        area.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dados }))
      } else {
        area.focus()
        area.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dados }))
      }
    },
    { gesto, cor },
  )
}

async function oToken(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map } = mod.useMapStore.getState()
    const t = map.tokens[map.tokens.length - 1]
    return t ? { id: t.id, mapId: map.id, x: t.x, y: t.y, size: t.size, image: t.image, imageData: t.imageData ?? null } : null
  })
}

const gravados = (page: Page) => page.evaluate(() => Object.keys((window as unknown as JanelaDoMestre).__discoDeMentira))

async function corNaTela(page: Page, x: number, y: number): Promise<Cor> {
  const png = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } })
  return page.evaluate(async (url: string) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const tela = document.createElement('canvas')
    tela.width = 1
    tela.height = 1
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('canvas 2D indisponível')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2]] as Cor
  }, `data:image/png;base64,${png.toString('base64')}`)
}

const mesmaCor = (a: Cor, b: Cor) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) <= TOLERANCIA

/** Tira a seleção (o anel sujaria a amostra), espera a cor no centro do token e devolve a última vista. */
async function corDoToken(page: Page, alvo: Cor): Promise<Cor> {
  const caixa = await page.locator('canvas').first().boundingBox()
  const token = await oToken(page)
  if (!caixa || !token) throw new Error('sem canvas ou sem token')
  const centro = { x: caixa.x + token.x, y: caixa.y + token.y }
  await page.mouse.click(centro.x + GRID * 3, centro.y + GRID * 2)
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toHaveCount(0)
  await page.waitForTimeout(PAINT_MS)
  const fim = Date.now() + 8000
  let cor = await corNaTela(page, centro.x, centro.y)
  while (!mesmaCor(cor, alvo) && Date.now() < fim) {
    await page.waitForTimeout(250)
    cor = await corNaTela(page, centro.x, centro.y)
  }
  // Seleciona de novo: o painel do token volta para o próximo gesto.
  await page.mouse.click(centro.x, centro.y)
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()
  return cor
}

test('imagem do token: soltar e colar usam o mesmo caminho do "Trocar imagem...", com histórico e aviso sem imagem', async ({ page }) => {
  test.setTimeout(180_000)
  await discoDeMentira(page)
  await enterEditor(page)

  // 1. Token novo, sem foto: a área fica acima do "Escolher imagem...".
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  const campo = page.getByRole('textbox', { name: 'Nome do novo token' })
  await campo.click()
  await campo.pressSequentially('Kael', { delay: 20 })
  await campo.press('Enter')
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()
  const area = page.getByRole('region', { name: 'Colar ou soltar imagem do token' })
  await expect(area).toBeVisible()
  await expect(area).toContainText('Arraste uma imagem para cá')
  await expect(area).toContainText('ou clique aqui e cole com Ctrl+V')
  const escolher = page.getByRole('button', { name: 'Escolher imagem...' })
  const [caixaArea, caixaBotao] = [await area.boundingBox(), await escolher.boundingBox()]
  expect(caixaArea !== null && caixaBotao !== null && caixaArea.y < caixaBotao.y).toBe(true)

  // 2. Solta um PNG vermelho: grava na pasta do mapa e o token fica vermelho.
  await entregarImagem(page, 'drop', VERMELHO)
  await expect(page.getByRole('button', { name: 'Trocar imagem...' })).toBeVisible({ timeout: 15_000 })
  const depoisDoSoltar = await oToken(page)
  if (depoisDoSoltar === null) throw new Error('sem token')
  const arquivo = `C:/appdata/maps/${depoisDoSoltar.mapId}/token_${depoisDoSoltar.id}_original.png`
  expect(depoisDoSoltar.image).toBe(arquivo)
  expect(await gravados(page)).toContain(arquivo)
  expect(depoisDoSoltar.imageData).toMatch(/^data:image\//)
  await expect(page.getByRole('button', { name: 'Remover imagem (voltar ao círculo)' })).toBeVisible()
  const vermelho = await corDoToken(page, VERMELHO)
  expect(mesmaCor(vermelho, VERMELHO), `depois de soltar o PNG vermelho, o token veio rgb(${vermelho.join(', ')})`).toBe(true)

  // 3. Copia um PNG verde para a área de transferência DE VERDADE, clica na
  // área e aperta Ctrl+V no teclado: o token fica verde.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate(async (cor) => {
    const tela = document.createElement('canvas')
    tela.width = 64
    tela.height = 64
    const ctx = tela.getContext('2d')
    if (ctx === null) throw new Error('canvas 2D indisponível')
    ctx.fillStyle = `rgb(${cor[0]}, ${cor[1]}, ${cor[2]})`
    ctx.fillRect(0, 0, 64, 64)
    const blob = await new Promise<Blob | null>((resolve) => tela.toBlob(resolve, 'image/png'))
    if (blob === null) throw new Error('PNG não saiu')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  }, VERDE)
  await area.click()
  await page.keyboard.press('Control+v')
  const verde = await corDoToken(page, VERDE)
  expect((await oToken(page))?.image).toBe(arquivo)
  // O Ctrl+V era da área: nada foi colado no mapa (nenhum token novo).
  expect(await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.tokens.length)).toBe(1)
  expect(mesmaCor(verde, VERDE), `depois de colar o PNG verde, o token veio rgb(${verde.join(', ')})`).toBe(true)

  // 4. Ctrl+Z desfaz a troca: a foto vermelha volta (o caminho é o mesmo
  // arquivo, então o que volta é a cópia que viaja — a que o jogador vê).
  const dataVerde = (await oToken(page))?.imageData
  await page.locator('canvas').first().click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await oToken(page))?.imageData, { timeout: 10_000 }).not.toBe(dataVerde)
  expect((await oToken(page))?.imageData).toBe(depoisDoSoltar.imageData)

  // 5. Colar um texto: avisa e não mexe na foto.
  const caixa = await page.locator('canvas').first().boundingBox()
  const token = await oToken(page)
  if (!caixa || !token) throw new Error('sem canvas ou sem token')
  await page.mouse.click(caixa.x + token.x, caixa.y + token.y)
  await expect(area).toBeVisible()
  const antes = (await oToken(page))?.imageData
  await entregarImagem(page, 'paste', 'texto')
  await expect(area.getByRole('status')).toContainText('Não veio imagem')
  expect((await oToken(page))?.imageData).toBe(antes)
})
