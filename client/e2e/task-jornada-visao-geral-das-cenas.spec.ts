// JORNADA DE USUÁRIO da VISÃO GERAL DAS CENAS (G14) — escrita para SAIR
// VERMELHA no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (PEDIDOS.md, G14):
//   - na seção "Cenas" da aba Mapa, um botão "Visão geral" abre um painel ou
//     diálogo com nome acessível "Visão geral das cenas", com UMA MINIATURA
//     por cena da aventura;
//   - cada miniatura mostra o chão da cena e as fichas nas posições delas, em
//     escala reduzida e no estilo minimapa, com o nome da cena como legenda;
//   - clicar numa miniatura abre aquela cena no editor e fecha o painel;
//   - Esc fecha o painel sem trocar de cena;
//   - a miniatura da cena aberta fica destacada (aria-current ou equivalente).
//
// ONDE ISSO MORRE HOJE: `components/ScenesSection.tsx` só tem a lista (nome,
// "N tokens", bolinhas) e "+ Nova cena". Para saber onde cada ficha está, o
// mestre abre as cenas uma por uma.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-cenas-com-gente.spec.ts, só o lado do mestre):
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: três cenas num `adventure.json`,
//   aberto pelo menu "Carregar Mapa existente", como na mesa. Nenhum
//   transporte de rede é falsificado: não há jogador nesta régua.
//   GESTO REAL NA AÇÃO SOB TESTE: clique de ponteiro no botão e na miniatura,
//   tecla Esc do teclado. O único `evaluate` é a LEITURA de pixel (decodificar
//   a foto PNG num canvas solto); ele não toca no app.
//   PROVA NA TELA: nome acessível do painel e das miniaturas; COR lida em
//   pixel na foto do PRÓPRIO elemento da miniatura (o retângulo dela, nada
//   fora); posição da ficha lida nessa mesma foto; chão do editor lido nos
//   pixels onde o canvas está por cima. Nada é lido da store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o botão fica dentro do painel da aba Mapa e se chama "Visão geral"
//     (nome acessível começando assim);
//   - o painel é `dialog` ou `region` com nome acessível "Visão geral das cenas";
//   - cada miniatura é um controle clicável (`button` ou `link`) dentro do
//     painel, cujo nome acessível contém o nome da cena, e a legenda é o nome
//     da cena em texto visível dentro dela;
//   - o destaque da cena aberta é `aria-current` (qualquer valor diferente de
//     "false"), ou `aria-selected="true"`, ou `aria-pressed="true"`;
//   - a miniatura desenha o mapa inteiro sem espelhar: o que está no canto de
//     cima à direita do mapa aparece no canto de cima à direita do chão
//     desenhado na miniatura. O quadrante é medido contra a caixa do CHÃO na
//     foto (não contra o elemento inteiro), para a legenda não deslocar a conta.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ele prova que o disco falso, a
// lista Cenas e o classificador de cor (verde-água, magenta, vermelho-escuro,
// laranja) funcionam. Sem ele, o vermelho dos testes 2 a 5 poderia ser a
// infraestrutura quebrada, e não a feature ausente.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const AVENTURA = 'Aventura das Três Salas'
const SALAO = 'Salão'
const CRIPTA = 'Cripta'
const TORRE = 'Torre'
const ID_SALAO = 'scene_salao'
const ID_CRIPTA = 'scene_cripta'
const ID_TORRE = 'scene_torre'
const PASTA = 'C:/appdata/maps/map_tres_salas'
const NOME_DO_PAINEL = 'Visão geral das cenas'
const BOTAO_VISAO_GERAL = /^Visão geral/

// Mapa quase quadrado (20 x 16 células de 50 px): a miniatura não fica uma
// fita fina, e a ficha tem pixels suficientes para ser achada.
const GRADE = 50
const COLUNAS = 20
const LINHAS = 16
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE

/** Chão de cada cena: cores que nada mais no app usa. */
const CHAO_SALAO = '#1e8c8c'
const CHAO_CRIPTA = '#8c1e8c'
const CHAO_TORRE = '#8c1414'
/** Ficha da Cripta: laranja, no canto de CIMA À DIREITA do mapa. */
const COR_DA_FICHA = '#ff5a00'
const POS_DA_FICHA = { x: LARGURA - 125, y: 125 }

/** Espera curta por elemento: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400

/** Pixels do chão no editor para dizer "esta cena está aberta". */
const PIXELS_DE_CENA = 2000
/** Pixels do chão dentro de uma miniatura para dizer "esta miniatura mostra este chão". */
const PIXELS_DE_CHAO_NA_MINIATURA = 300
/** Pixels laranja da ficha no editor. */
const PIXELS_DE_FICHA_NO_EDITOR = 60
/** Pixels laranja da ficha numa miniatura (ficha de 50 px num mapa de 1000 px: ~5% da largura). */
const PIXELS_DE_FICHA_NA_MINIATURA = 4
/** Pixels máximos para dizer "esta cor NÃO está aqui" (antisserrilhado). */
const RESIDUO = 3

type Cor = 'verdeAgua' | 'magenta' | 'vermelhoEscuro' | 'laranja'
type Foto = Awaited<ReturnType<Page['screenshot']>>

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: três cenas, a Cripta com uma ficha num canto conhecido
// ───────────────────────────────────────────────────────────────────────────

function ficha(id: string, name: string, p: { x: number; y: number }, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function cena(id: string, nome: string, chao: string, tokens: Token[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    tokens,
  }
}

function discoDaAventura(): Record<string, string> {
  const aventura = {
    version: 1,
    id: 'adv_tres_salas',
    name: AVENTURA,
    startSceneId: ID_SALAO,
    scenes: [
      { id: ID_SALAO, name: SALAO, file: 'map.json' },
      { id: ID_CRIPTA, name: CRIPTA, file: `scenes/${ID_CRIPTA}/map.json` },
      { id: ID_TORRE, name: TORRE, file: `scenes/${ID_TORRE}/map.json` },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(cena('map_tres_salas', AVENTURA, CHAO_SALAO, [])),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_CRIPTA}/map.json`]: serializeMap(
      cena('map_cripta', CRIPTA, CHAO_CRIPTA, [ficha('tok-lanterna', 'Lanterna', POS_DA_FICHA, COR_DA_FICHA)]),
    ),
    [`${PASTA}/scenes/${ID_TORRE}/map.json`]: serializeMap(cena('map_torre', TORRE, CHAO_TORRE, [])),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri com disco de mentira (só disco; sem rede)
// ───────────────────────────────────────────────────────────────────────────

type JanelaDoMestre = {
  isTauri: boolean
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: () => number
    convertFileSrc: (filePath: string) => string
  }
}

async function mestreAbreAventura(page: Page): Promise<Locator> {
  await page.addInitScript(
    ({ arquivos }: { arquivos: Record<string, string> }) => {
      const alvo = window as unknown as JanelaDoMestre
      const textos: Record<string, string> = { ...arquivos }
      const pastas = new Set<string>()
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
      const existe = (caminho: string): boolean => {
        const c = semBarraFinal(caminho)
        return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
      }
      alvo.isTauri = true
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        convertFileSrc: (caminho: string) => String(caminho),
        transformCallback: () => 0,
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
            case 'plugin:fs|mkdir':
              pastas.add(semBarraFinal(String(a.path)))
              return null
            case 'plugin:fs|write_text_file':
              textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args as Uint8Array)
              return null
            case 'plugin:fs|read_text_file': {
              const caminho = String(a.path)
              if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(textos[caminho]))
            }
            case 'plugin:fs|rename': {
              const de = String(a.oldPath)
              if (de in textos) {
                textos[String(a.newPath)] = textos[de]
                delete textos[de]
              }
              return null
            }
            case 'plugin:fs|read_dir': {
              const prefixo = `${semBarraFinal(String(a.path))}/`
              const filhos = new Map<string, boolean>()
              for (const p of todos()) {
                if (p.indexOf(prefixo) !== 0) continue
                const resto = p.slice(prefixo.length)
                if (resto.length === 0) continue
                const corte = resto.indexOf('/')
                const nome = corte === -1 ? resto : resto.slice(0, corte)
                filhos.set(nome, (filhos.get(nome) ?? false) || corte !== -1 || pastas.has(p))
              }
              return Array.from(filhos.entries()).map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
            }
            default:
              return null
          }
        },
      }
    },
    { arquivos: discoDaAventura() },
  )

  await page.goto('/')
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await page.waitForSelector('canvas')
  const lista = await secaoCenas(page)
  for (const nome of [SALAO, CRIPTA, TORRE]) {
    await expect(entradaDaCena(lista, nome), `a lista de Cenas deveria ter "${nome}"`).toBeVisible({ timeout: ESPERA })
  }
  return lista
}

/** A seção "Cenas" da aba Mapa, aberta (mesmo gesto de task-jornada-cenas-com-gente). */
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

function entradaDaCena(lista: Locator, nome: string): Locator {
  return lista.getByRole('button', { name: nome, exact: true })
}

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** O painel da visão geral: diálogo ou região com o nome acessível do pedido. */
function painelDaVisaoGeral(page: Page): Locator {
  return page.getByRole('dialog', { name: NOME_DO_PAINEL }).or(page.getByRole('region', { name: NOME_DO_PAINEL }))
}

/** A miniatura de uma cena: controle clicável do painel cujo nome acessível contém o nome da cena. */
function miniatura(painel: Locator, nome: string): Locator {
  const nomeDaCena = new RegExp(`(^|[^\\p{L}])${escapar(nome)}([^\\p{L}]|$)`, 'u')
  return painel.getByRole('button', { name: nomeDaCena }).or(painel.getByRole('link', { name: nomeDaCena }))
}

/** Clique de ponteiro no botão "Visão geral" da seção Cenas; devolve o painel aberto. */
async function abrirVisaoGeral(page: Page): Promise<Locator> {
  await secaoCenas(page)
  const botao = page.getByRole('tabpanel', { name: 'Mapa' }).getByRole('button', { name: BOTAO_VISAO_GERAL })
  await expect(botao, 'a seção Cenas da aba Mapa deveria ter um botão "Visão geral"').toBeVisible({ timeout: ESPERA })
  await botao.click()
  const painel = painelDaVisaoGeral(page)
  await expect(painel, `o botão "Visão geral" deveria abrir um painel chamado "${NOME_DO_PAINEL}"`).toBeVisible({ timeout: ESPERA })
  return painel
}

/** Destaque da cena aberta: aria-current (não "false"), aria-selected ou aria-pressed verdadeiros. */
async function destacada(elemento: Locator): Promise<boolean> {
  const atual = await elemento.getAttribute('aria-current')
  if (atual !== null && atual !== 'false') return true
  return (await elemento.getAttribute('aria-selected')) === 'true' || (await elemento.getAttribute('aria-pressed')) === 'true'
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura de pixel
// ───────────────────────────────────────────────────────────────────────────

interface Mancha {
  n: number
  x1: number
  y1: number
  x2: number
  y2: number
  /** Centro de massa (média de x e y dos pixels da cor). */
  cx: number
  cy: number
}
type Leitura = Record<Cor, Mancha>

/**
 * Lê uma foto PNG: para cada cor da régua, quantos pixels, a caixa que os
 * envolve e o centro de massa. Decodifica a foto num canvas solto da própria
 * página — leitura pura, nada do app é tocado. Com `soCanvas`, conta só onde o
 * CANVAS do mapa está por cima (o rail e o painel não contam); sem ele, conta
 * a foto inteira (foto de um elemento: a miniatura).
 */
async function lerCores(page: Page, foto: Foto, soCanvas: boolean): Promise<Leitura> {
  return page.evaluate(
    async ({ b64, filtrar }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escalaX = window.innerWidth / width
      const escalaY = window.innerHeight / height
      const noCanvas = new Map<number, boolean>()
      const canvasPorCima = (x: number, y: number): boolean => {
        if (!filtrar) return true
        const chave = (y >> 3) * 65536 + (x >> 3)
        let v = noCanvas.get(chave)
        if (v === undefined) {
          v = document.elementFromPoint(((x >> 3) * 8 + 4) * escalaX, ((y >> 3) * 8 + 4) * escalaY)?.tagName === 'CANVAS'
          noCanvas.set(chave, v)
        }
        return v
      }
      const vazia = () => ({ n: 0, x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity, sx: 0, sy: 0 })
      const r = { verdeAgua: vazia(), magenta: vazia(), vermelhoEscuro: vazia(), laranja: vazia() }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          let alvoCor: keyof typeof r | null = null
          if (R > 200 && G > 50 && G < 140 && B < 60) alvoCor = 'laranja'
          else if (G >= 110 && G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30) alvoCor = 'verdeAgua'
          else if (R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30) alvoCor = 'magenta'
          else if (R >= 90 && R <= 190 && R > G * 2.5 + 10 && R > B * 2.5 + 10) alvoCor = 'vermelhoEscuro'
          if (alvoCor === null || !canvasPorCima(x, y)) continue
          const m = r[alvoCor]
          m.n += 1
          m.sx += x
          m.sy += y
          if (x < m.x1) m.x1 = x
          if (y < m.y1) m.y1 = y
          if (x > m.x2) m.x2 = x
          if (y > m.y2) m.y2 = y
        }
      }
      const fechar = (m: ReturnType<typeof vazia>) => ({
        n: m.n,
        x1: m.x1,
        y1: m.y1,
        x2: m.x2,
        y2: m.y2,
        cx: m.n > 0 ? m.sx / m.n : NaN,
        cy: m.n > 0 ? m.sy / m.n : NaN,
      })
      return {
        verdeAgua: fechar(r.verdeAgua),
        magenta: fechar(r.magenta),
        vermelhoEscuro: fechar(r.vermelhoEscuro),
        laranja: fechar(r.laranja),
      }
    },
    { b64: foto.toString('base64'), filtrar: soCanvas },
  )
}

async function foto(alvo: Page | Locator): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await alvo.screenshot()
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error('não consegui fotografar')
}

/** O editor: cores sobre o canvas do mapa. */
async function editor(page: Page): Promise<Leitura> {
  await page.waitForTimeout(PINTURA_MS)
  return lerCores(page, await foto(page), true)
}

/** A miniatura: cores dentro do retângulo do próprio elemento, e nada fora dele. */
async function dentroDaMiniatura(page: Page, elemento: Locator): Promise<Leitura> {
  return lerCores(page, await foto(elemento), false)
}

async function editorMostra(page: Page, cor: Cor, cena: string): Promise<void> {
  await expect
    .poll(async () => (await editor(page))[cor].n, { timeout: ESPERA_TELA, message: `o editor deveria mostrar o chão de "${cena}"` })
    .toBeGreaterThan(PIXELS_DE_CENA)
}

const CHAO_DE: Record<string, Cor> = { [SALAO]: 'verdeAgua', [CRIPTA]: 'magenta', [TORRE]: 'vermelhoEscuro' }

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: a lista Cenas mostra as três cenas, e cada uma pinta o próprio chão no editor', async ({ page }) => {
  test.setTimeout(90_000)
  const lista = await mestreAbreAventura(page)
  await expect(entradaDaCena(lista, SALAO), `"${SALAO}" é a cena de partida e deveria estar marcada`).toHaveAttribute('aria-current', 'true')
  await editorMostra(page, 'verdeAgua', SALAO)

  await entradaDaCena(lista, CRIPTA).click()
  await expect(entradaDaCena(lista, CRIPTA), `clicada, "${CRIPTA}" deveria ficar marcada na lista`).toHaveAttribute('aria-current', 'true')
  await editorMostra(page, 'magenta', CRIPTA)
  // A ficha laranja da Cripta aparece no editor: o classificador enxerga a cor dela.
  await expect
    .poll(async () => (await editor(page)).laranja.n, { timeout: ESPERA_TELA, message: `o editor deveria mostrar a ficha laranja da "${CRIPTA}"` })
    .toBeGreaterThan(PIXELS_DE_FICHA_NO_EDITOR)

  // O vermelho-escuro da Torre também é lido: o caso 4 depende dele.
  await entradaDaCena(lista, TORRE).click()
  await editorMostra(page, 'vermelhoEscuro', TORRE)
  const naTorre = await editor(page)
  expect(naTorre.magenta.n, `aberta a "${TORRE}", o chão magenta da "${CRIPTA}" não deveria estar no editor`).toBeLessThanOrEqual(RESIDUO)
})

test('2. o botão "Visão geral" abre o painel com uma miniatura por cena, legendada e pintada com o chão da própria cena', async ({ page }) => {
  test.setTimeout(90_000)
  await mestreAbreAventura(page)
  const painel = await abrirVisaoGeral(page)

  for (const nome of [SALAO, CRIPTA, TORRE]) {
    const mini = miniatura(painel, nome)
    await expect(mini, `o painel deveria ter UMA miniatura de "${nome}" (botão ou link com o nome da cena)`).toHaveCount(1, { timeout: ESPERA })
    await expect(mini.getByText(nome, { exact: true }), `a miniatura de "${nome}" deveria ter o nome da cena como legenda visível`).toBeVisible()
    const chao = CHAO_DE[nome]
    await expect
      .poll(async () => (await dentroDaMiniatura(page, mini))[chao].n, {
        timeout: ESPERA_TELA,
        message: `a miniatura de "${nome}" deveria mostrar, dentro do retângulo dela, o chão da cena`,
      })
      .toBeGreaterThan(PIXELS_DE_CHAO_NA_MINIATURA)
    const leitura = await dentroDaMiniatura(page, mini)
    for (const outro of [SALAO, CRIPTA, TORRE].filter((n) => n !== nome)) {
      expect(leitura[CHAO_DE[outro]].n, `a miniatura de "${nome}" não deveria ter o chão de "${outro}"`).toBeLessThanOrEqual(RESIDUO)
    }
  }

  // A cena aberta (Salão, a de partida) é a destacada; as outras não.
  expect(await destacada(miniatura(painel, SALAO)), `a miniatura de "${SALAO}", a cena aberta, deveria estar destacada (aria-current)`).toBe(true)
  expect(await destacada(miniatura(painel, CRIPTA)), `a miniatura de "${CRIPTA}" não está aberta e não deveria estar destacada`).toBe(false)
  expect(await destacada(miniatura(painel, TORRE)), `a miniatura de "${TORRE}" não está aberta e não deveria estar destacada`).toBe(false)
})

test('3. na miniatura da Cripta, a ficha laranja aparece no canto de cima à direita do chão', async ({ page }) => {
  test.setTimeout(90_000)
  await mestreAbreAventura(page)
  const painel = await abrirVisaoGeral(page)
  const cripta = miniatura(painel, CRIPTA)
  await expect(cripta, `o painel deveria ter a miniatura de "${CRIPTA}"`).toHaveCount(1, { timeout: ESPERA })

  await expect
    .poll(async () => (await dentroDaMiniatura(page, cripta)).laranja.n, {
      timeout: ESPERA_TELA,
      message: `a miniatura de "${CRIPTA}" deveria mostrar a ficha laranja`,
    })
    .toBeGreaterThanOrEqual(PIXELS_DE_FICHA_NA_MINIATURA)
  const leitura = await dentroDaMiniatura(page, cripta)
  const chao = leitura.magenta
  expect(chao.n, `a miniatura de "${CRIPTA}" deveria mostrar o chão magenta em volta da ficha`).toBeGreaterThan(PIXELS_DE_CHAO_NA_MINIATURA)
  const meioX = (chao.x1 + chao.x2) / 2
  const meioY = (chao.y1 + chao.y2) / 2
  const onde = `ficha em (${leitura.laranja.cx.toFixed(1)}, ${leitura.laranja.cy.toFixed(1)}), chão de (${chao.x1}, ${chao.y1}) a (${chao.x2}, ${chao.y2})`
  expect(leitura.laranja.cx, `a ficha deveria estar na metade DIREITA do chão da miniatura — ${onde}`).toBeGreaterThan(meioX)
  expect(leitura.laranja.cy, `a ficha deveria estar na metade de CIMA do chão da miniatura — ${onde}`).toBeLessThan(meioY)

  // A ficha é da Cripta: as outras miniaturas não a mostram.
  for (const nome of [SALAO, TORRE]) {
    const mini = miniatura(painel, nome)
    await expect(mini, `o painel deveria ter a miniatura de "${nome}"`).toHaveCount(1)
    expect((await dentroDaMiniatura(page, mini)).laranja.n, `a miniatura de "${nome}" não tem ficha e não deveria ter laranja`).toBeLessThanOrEqual(RESIDUO)
  }
})

test('4. clicar na miniatura da Torre fecha o painel, abre a Torre no editor e marca a Torre na lista', async ({ page }) => {
  test.setTimeout(90_000)
  const lista = await mestreAbreAventura(page)
  await editorMostra(page, 'verdeAgua', SALAO)
  const painel = await abrirVisaoGeral(page)
  const torre = miniatura(painel, TORRE)
  await expect(torre, `o painel deveria ter a miniatura de "${TORRE}"`).toHaveCount(1, { timeout: ESPERA })

  await torre.click()

  await expect(painel, 'clicada uma miniatura, o painel deveria fechar').toBeHidden({ timeout: ESPERA })
  await editorMostra(page, 'vermelhoEscuro', TORRE)
  const depois = await editor(page)
  expect(depois.verdeAgua.n, `aberta a "${TORRE}", o chão do "${SALAO}" não deveria continuar no editor`).toBeLessThanOrEqual(RESIDUO)
  await secaoCenas(page)
  await expect(entradaDaCena(lista, TORRE), `a lista Cenas deveria marcar "${TORRE}" como a aberta`).toHaveAttribute('aria-current', 'true', { timeout: ESPERA })
  await expect(entradaDaCena(lista, SALAO), `"${SALAO}" deixou de ser a aberta`).not.toHaveAttribute('aria-current', 'true')
})

test('5. Esc fecha o painel sem trocar de cena', async ({ page }) => {
  test.setTimeout(90_000)
  const lista = await mestreAbreAventura(page)
  await entradaDaCena(lista, CRIPTA).click()
  await editorMostra(page, 'magenta', CRIPTA)
  const painel = await abrirVisaoGeral(page)
  await expect(miniatura(painel, CRIPTA), `o painel deveria ter a miniatura de "${CRIPTA}"`).toHaveCount(1, { timeout: ESPERA })

  await page.keyboard.press('Escape')

  await expect(painel, 'Esc deveria fechar o painel da visão geral').toBeHidden({ timeout: ESPERA })
  await editorMostra(page, 'magenta', CRIPTA)
  await secaoCenas(page)
  await expect(entradaDaCena(lista, CRIPTA), `Esc não troca de cena: "${CRIPTA}" continua a aberta`).toHaveAttribute('aria-current', 'true')
  await expect(entradaDaCena(lista, SALAO), `Esc não troca de cena: "${SALAO}" continua fechada`).not.toHaveAttribute('aria-current', 'true')
})
