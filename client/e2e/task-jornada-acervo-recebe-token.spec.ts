// JORNADA VERMELHA — "adicionei o token e o acervo continua vazio".
//
// Achado 12 do passeio de 20/09/2026 (`docs/passeio-2026-09-20.md`): em
// ACERVO DE TOKENS, "Adicionar token" → nome → Adicionar faz o token nascer
// no MAPA, mas o acervo continua "Nenhum token no acervo ainda." — e sem item
// não há o que arrastar de lá.
//
// O QUE O CÓDIGO DIZ (lido em 22/09/2026):
//   - "Adicionar token" (`components/SelectionControls.tsx`) cria um token no
//     mapa, sem foto (`App.tsx`, `handleAddToken` → `criarToken`). Não é um
//     botão do acervo;
//   - o acervo só recebe pelo "Salvar no acervo", e só token COM foto:
//     `guardarNoAcervo` (`lib/tokenLibrary.ts`) lança `SEM_FOTO_PARA_SALVAR`
//     quando não há foto;
//   - o item do acervo só se coloca no mapa por CLIQUE no nome
//     (`components/TokenLibraryPanel.tsx`, "Colocar <nome> no mapa"); não
//     existe arrastar do acervo para o mapa.
//
// DECISÃO que esta régua cobra, então:
//   (a) com o token sem foto recém-adicionado, o acervo diz em texto visível,
//       DENTRO da seção do acervo, que ele guarda token com foto — em vez de
//       continuar só com "Nenhum token no acervo ainda.";
//   (b) com um item no acervo, ARRASTAR o item até o mapa faz uma ficha nova
//       aparecer onde a pessoa soltou (pixel).
//
// CONTROLE POSITIVO: o caminho que JÁ enche o acervo hoje — token com foto →
// "Salvar no acervo" — lista o item. Sem ele, (b) vermelho podia ser só o item
// que nunca chegou à estante.
//
// REGRAS DE JORNADA: gesto real de ponteiro e teclado; o único `evaluate` é o
// decodificador de PNG de `corNaTela`, que não toca o app; disco e seletor de
// arquivo do Tauri são de mentira (como em `task-jornada-acervo-de-tokens.spec.ts`),
// o resto do app roda de verdade. Toda afirmação é sobre o que está na tela.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** 64x64 px: metade de cima #ff00ff, metade de baixo #00c853. */
const FOTO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nO3PUQkAIBTAwNfR0rbSEH4cwmABbnPmfN1wQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFrwOz1995QQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFb10lsMlp2HT+PAAAAABJRU5ErkJggg=='
const FOTO_DATA_URL = `data:image/png;base64,${FOTO_BASE64}`
const FOTO_NO_DISCO_DO_MESTRE = 'C:/fotos/goblin.png'

const PAUSA_ANTES_DE_SOLTAR_MS = 150
const PASSOS_DO_ARRASTO = 16
const PINTURA_MS = 300
/** Folga de poll em volta de leitura de pixel e de texto que chega do disco. */
const POLL_MS = 15_000

/** Onde a pessoa solta o item, em coordenada do canvas: longe dos painéis e
 *  do token que nasceu pelo "Adicionar token". */
const ONDE_SOLTAR = { x: 900, y: 600 }
const LONGE = { x: 1200, y: 760 }

type Foto = Awaited<ReturnType<Page['screenshot']>>

// ───────────────────────────────────────────────────────────────────────────
// Disco e seletor de arquivo de mentira (mesmo molde de
// `task-jornada-acervo-de-tokens.spec.ts`, sem a semente)
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

async function discoDoMestre(page: Page): Promise<void> {
  await page.addInitScript(
    (entrada: { foto: string; origem: string; dataUrl: string }) => {
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
      const gravar = () => {
        try {
          window.sessionStorage.setItem(CHAVE, JSON.stringify(disco))
        } catch {
          // Cota estourada: a jornada falha na asserção seguinte, que é onde deve.
        }
      }
      gravar()

      const bytesDaFoto = Array.from(Uint8Array.from(atob(entrada.foto), (c) => c.charCodeAt(0)))
      const existe = (caminho: string): boolean =>
        caminho in disco.textos || caminho in disco.binarios || disco.pastas.indexOf(caminho) !== -1

      alvo.isTauri = true
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        transformCallback: () => 0,
        convertFileSrc: (caminho: string) => (String(caminho).indexOf('token_') === -1 ? String(caminho) : entrada.dataUrl),
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
              if (caminho === entrada.origem) return bytesDaFoto
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
            case 'plugin:dialog|open':
              return entrada.origem
            case 'plugin:event|listen':
              return 1
            default:
              return null
          }
        },
      }
    },
    { foto: FOTO_BASE64, origem: FOTO_NO_DISCO_DO_MESTRE, dataUrl: FOTO_DATA_URL },
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos e leituras
// ───────────────────────────────────────────────────────────────────────────

/** A seção "Acervo de tokens" do painel lateral. */
function secaoDoAcervo(page: Page): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Acervo de tokens', exact: true }) })
}

/** "Adicionar token" → nome → Adicionar (Enter), como o passeio fez. Sem foto. */
async function adicionarToken(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  const campo = page.getByRole('textbox', { name: 'Nome do novo token' })
  await campo.click()
  await campo.pressSequentially(nome, { delay: 20 })
  await campo.press('Enter')
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' }), 'o token não nasceu no mapa').toBeVisible({
    timeout: POLL_MS,
  })
}

/** O caminho que JÁ enche o acervo: token com foto → "Salvar no acervo". */
async function guardarTokenComFotoNoAcervo(page: Page, nome: string): Promise<void> {
  await adicionarToken(page, nome)
  await page.getByRole('button', { name: 'Escolher imagem...' }).click()
  await expect(page.getByRole('button', { name: 'Trocar imagem...' }), 'a foto não entrou no token').toBeVisible({ timeout: POLL_MS })
  await page.getByRole('button', { name: 'Salvar no acervo' }).click()
  await expect(page.getByRole('button', { name: `Colocar ${nome} no mapa` })).toBeVisible({ timeout: POLL_MS })
}

async function naTela(page: Page, ponto: { x: number; y: number }): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { x: box.x + ponto.x, y: box.y + ponto.y }
}

/** Tira a seleção (Escape) e o ponteiro da frente antes de fotografar. */
async function limparAVista(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  const longe = await naTela(page, LONGE)
  await page.mouse.move(longe.x, longe.y)
  await page.waitForTimeout(PINTURA_MS)
}

async function pixelEm(page: Page, ponto: { x: number; y: number }): Promise<Foto> {
  const p = await naTela(page, ponto)
  return page.screenshot({ clip: { x: Math.round(p.x), y: Math.round(p.y), width: 1, height: 1 } })
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('CONTROLE POSITIVO: token com foto e "Salvar no acervo" põe o item na estante', async ({ page }) => {
  test.setTimeout(90_000)
  await discoDoMestre(page)
  await enterEditor(page)
  await expect(secaoDoAcervo(page).getByText('Nenhum token no acervo ainda.')).toBeVisible({ timeout: POLL_MS })

  await guardarTokenComFotoNoAcervo(page, 'Goblin')

  await expect(secaoDoAcervo(page).getByRole('button', { name: 'Colocar Goblin no mapa' })).toBeVisible()
  await expect(secaoDoAcervo(page).getByText('Nenhum token no acervo ainda.')).toHaveCount(0)
})

test('(a) depois de "Adicionar token" sem foto, o acervo diz na tela que guarda token com foto', async ({ page }) => {
  test.setTimeout(90_000)
  await discoDoMestre(page)
  await enterEditor(page)
  const acervo = secaoDoAcervo(page)
  await expect(acervo, 'a seção do acervo não está na tela').toBeVisible({ timeout: POLL_MS })

  await adicionarToken(page, 'Goblin')

  await expect(
    acervo.getByText(/foto/i).first(),
    'o token foi adicionado ao mapa e o acervo continua só com "Nenhum token no acervo ainda." — nada diz que o acervo só guarda token com foto',
  ).toBeVisible({ timeout: POLL_MS })
})

test('(b) arrastar o item do acervo até o mapa cria uma ficha nova onde a pessoa soltou', async ({ page }) => {
  test.setTimeout(90_000)
  await discoDoMestre(page)
  await enterEditor(page)
  await guardarTokenComFotoNoAcervo(page, 'Goblin')

  await limparAVista(page)
  const antes = await pixelEm(page, ONDE_SOLTAR)
  await page.waitForTimeout(PINTURA_MS)
  expect((await pixelEm(page, ONDE_SOLTAR)).equals(antes), 'a tela muda sozinha parada no ponto de soltar').toBe(true)

  // Arrastar de pessoa: pega o item, anda até o mapa, pausa, solta.
  const item = secaoDoAcervo(page).getByRole('button', { name: 'Colocar Goblin no mapa' })
  await item.scrollIntoViewIfNeeded()
  await expect(item, 'o item do acervo não está à vista para a pessoa pegar').toBeInViewport()
  const caixa = await item.boundingBox()
  if (!caixa) throw new Error('item do acervo sem bounding box')
  const de = { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }
  const ate = await naTela(page, ONDE_SOLTAR)
  await page.mouse.move(de.x, de.y)
  await page.waitForTimeout(80)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  for (let passo = 1; passo <= PASSOS_DO_ARRASTO; passo++) {
    const t = passo / PASSOS_DO_ARRASTO
    await page.mouse.move(de.x + (ate.x - de.x) * t, de.y + (ate.y - de.y) * t)
  }
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  await limparAVista(page)

  await expect
    .poll(async () => !(await pixelEm(page, ONDE_SOLTAR)).equals(antes), {
      timeout: POLL_MS,
      message: 'arrastar o item do acervo até o mapa não pôs ficha nenhuma onde a pessoa soltou',
    })
    .toBe(true)
})
