// JORNADA DE USUÁRIO do ALINHAR E DISTRIBUIR (item 19 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - com 2 ou mais itens selecionados, o painel mostra seis botões de
//     alinhar: à esquerda, ao centro, à direita, ao topo, ao meio e à base;
//   - com 3 ou mais, mostra também distribuir na horizontal e na vertical
//     (com 2 esses dois não fazem sentido e não ficam clicáveis);
//   - alinhar à esquerda leva a borda esquerda de cada item até a borda
//     esquerda do item mais à esquerda (direita, topo e base, idem, cada um
//     pela borda dele); ao centro e ao meio deixam os centros numa mesma
//     vertical/horizontal; o outro eixo não mexe;
//   - distribuir deixa o espaço entre vizinhos igual, com os dois itens das
//     pontas parados;
//   - um Ctrl+Z desfaz o alinhamento inteiro (os três itens voltam juntos).
//   A dor: "cinco pilares 'quase' alinhados deixam o mapa torto".
//
// ONDE ISSO MORRE HOJE:
//   - `client/src/components/PropertiesPanel.tsx:440-443`: com vários itens
//     selecionados, o painel só mostra `AreaSelectionControls` ("N itens
//     selecionados … Arraste para mover o grupo inteiro" + "Limpar seleção de
//     área") e `SelectionControls` ("Adicionar token" e "Apagar N itens
//     selecionados"). Nenhum botão de alinhar nem de distribuir;
//   - `client/src/lib/alignmentGuides.ts` é só a guia de encaixe que aparece
//     DURANTE o arrasto de um item: não há nenhuma ação que alinhe ou
//     distribua um conjunto (`grep -ri "distribu" client/src` não acha nada
//     além de comentários). O único "Alinhar" do app é "Alinhar grade à
//     imagem" (`components/GridAlignControls.tsx:111`), que é outra coisa.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-agrupar-objetos.spec.ts, só o lado do mestre):
//   DISCO DE MENTIRA. Um mapa avulso ("Pátio dos Pilares") no disco falso do
//   Tauri, aberto pelo menu "Carregar Mapa existente", como na mesa. Nele,
//   três PILARES quadrados do MESMO tamanho (desenhos cheios), cada um de uma
//   cor — vermelho, azul, magenta — espalhados torto de propósito, sem dois
//   alinhados em nenhuma borda nem centro e sem espaçamento igual. Tamanho
//   igual faz "espaço igual entre vizinhos" e "centros a passo igual" darem a
//   mesma conta. Nenhum transporte de rede é falsificado: não há jogador.
//   GESTO REAL. Tecla V (Selecionar); retângulo de seleção arrastado pelo
//   ponteiro no fundo vazio, com PAUSA antes de soltar; clique de ponteiro nos
//   botões do painel e no fundo vazio; Ctrl+Z pelo teclado.
//   PROVA NA TELA. Nome acessível dos botões e cor lida em pixel na foto da
//   página, contando só onde o CANVAS do mapa está por cima: a caixa e o
//   centro de massa de cada cor dizem onde cada pilar está. O único
//   `evaluate` é a LEITURA de pixel (decodificar a foto num canvas solto e
//   perguntar `elementFromPoint`); ele não toca no app. Nada é lido da store.
//   ANTES DE CADA FOTO DE CONFERÊNCIA a seleção é desfeita (clique no fundo
//   vazio), para o contorno de seleção não comer borda de pilar.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - os controles são BOTÕES (role button) visíveis em algum lugar da janela
//     (o natural é o painel lateral, junto da seleção), com estes nomes
//     acessíveis, aceitando crase/preposição e rótulo por `aria-label`/`title`:
//       "Alinhar à esquerda", "Alinhar ao centro", "Alinhar à direita",
//       "Alinhar ao topo", "Alinhar ao meio", "Alinhar à base",
//       "Distribuir na horizontal", "Distribuir na vertical"
//     (ver as regex `ALINHAR_*` e `DISTRIBUIR_*` logo abaixo);
//   - "centro" é o eixo horizontal (os centros ficam numa mesma vertical) e
//     "meio" é o eixo vertical (os centros ficam numa mesma horizontal), como
//     no Figma e no PowerPoint;
//   - esquerda/direita/topo/base alinham pela borda EXTREMA do conjunto (o
//     item mais à esquerda não sai do lugar ao alinhar à esquerda); centro e
//     meio só exigem os centros iguais e dentro da faixa que o conjunto já
//     ocupava (a referência exata — centro da caixa ou do item — fica livre);
//   - com 1 item selecionado nenhum botão de alinhar está clicável; com 2, os
//     de distribuir não estão (podem sumir ou ficar desabilitados);
//   - o alinhamento é UM passo do desfazer: um Ctrl+Z, com o foco no mapa,
//     devolve os três pilares aonde estavam.
//
// FORA DESTA RÉGUA, de propósito: o lado do JOGADOR. Alinhar é gesto do
// editor; o que o jogador recebe é o mesmo mapa editado que já chega a ele
// quando o mestre move itens (arrastar a seleção de vários já existe e já
// sincroniza). Também ficam de fora: alinhar tipos misturados (sala, parede,
// token), item travado dentro da seleção e alinhar à grade.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ele prova que o disco falso, o
// classificador de cor, a calibração mundo→tela, o laço que pega dois e
// depois três pilares ("Apagar 2/3 itens selecionados") e o clique no fundo vazio que
// desmarca funcionam. Sem ele, o vermelho dos demais poderia ser a
// infraestrutura quebrada, e não a feature ausente.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { Drawing, MapData } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const MAPA = 'Patio dos Pilares'
const PASTA = 'C:/appdata/maps/map_patio_pilares'

const GRADE = 50
const COLUNAS = 20
const LINHAS = 16
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE

/** Lado de cada pilar (mundo). Todos iguais: distribuir por espaço ou por centro dá a mesma conta. */
const LADO = 60

type Cor = 'vermelho' | 'azul' | 'magenta'
type Pilar = Cor
type Ponto = { x: number; y: number }
type Foto = Awaited<ReturnType<Page['screenshot']>>

/**
 * Canto de cima-esquerda de cada pilar (mundo). Tortos de propósito:
 *   x: 250 / 380 / 800  → nenhuma borda nem centro em comum; o azul NÃO está no
 *      meio do caminho (centro 410; o meio entre 280 e 830 é 555);
 *   y: 230 / 320 / 600  → idem (centro do azul 350; o meio entre 260 e 630 é 445).
 * Tudo fica à direita de x=200 e abaixo de y=200 (mundo): o painel da esquerda
 * cobre a faixa x<~120 e a dica da ferramenta Selecionar, logo abaixo da barra,
 * cobre a faixa y<~160 (medido na foto de 23/09).
 * Depois de qualquer alinhamento os três continuam sem se encostar.
 */
const PILARES: Record<Pilar, Ponto> = {
  vermelho: { x: 250, y: 230 },
  azul: { x: 380, y: 320 },
  magenta: { x: 800, y: 600 },
}
const HEX: Record<Pilar, string> = {
  vermelho: '#d21e1e',
  azul: '#1e32d2',
  magenta: '#d21ed2',
}
const TODOS: Pilar[] = ['vermelho', 'azul', 'magenta']

/** Laço que pega só o vermelho e o azul (mundo): começa no fundo vazio. */
const LACO_DE_DOIS = { x1: 215, y1: 205, x2: 470, y2: 410 }
/** Laço que pega os três (mundo). */
const LACO_DE_TRES = { x1: 215, y1: 205, x2: 900, y2: 700 }
/** Fundo vazio, à esquerda e abaixo de tudo (mundo): fora de qualquer caixa de seleção. */
const VAZIO = { x: 180, y: 740 }

/** Espera curta por elemento: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 30_000
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Botão parado antes de soltar o arrasto. */
const PAUSA_ANTES_DE_SOLTAR_MS = 150

const PIXELS_DE_PILAR = 700
/** "Na mesma linha": bordas/centros a até isto um do outro (px CSS; antisserrilhado e arredondamento). */
const ALINHADO_PX = 4
/** "Não saiu do lugar": até isto de desvio (px CSS). */
const PARADO_PX = 3
/** "Andou de verdade": a conferência só vale se alguém saiu do lugar mais que isto. */
const ANDOU_PX = 10

const ALINHAR_ESQUERDA = /^alinhar (à|a|pela) esquerda$/i
const ALINHAR_CENTRO = /^alinhar (ao |no |pelo )?centro$/i
const ALINHAR_DIREITA = /^alinhar (à|a|pela) direita$/i
const ALINHAR_TOPO = /^alinhar (ao |no |pelo )?topo$/i
const ALINHAR_MEIO = /^alinhar (ao |no |pelo )?meio$/i
const ALINHAR_BASE = /^alinhar (à|a|na|pela) base$/i
const DISTRIBUIR_HORIZONTAL = /^distribuir (na )?horizontal(mente)?$/i
const DISTRIBUIR_VERTICAL = /^distribuir (na )?vertical(mente)?$/i

const ALINHAR: ReadonlyArray<{ nome: string; re: RegExp }> = [
  { nome: 'Alinhar à esquerda', re: ALINHAR_ESQUERDA },
  { nome: 'Alinhar ao centro', re: ALINHAR_CENTRO },
  { nome: 'Alinhar à direita', re: ALINHAR_DIREITA },
  { nome: 'Alinhar ao topo', re: ALINHAR_TOPO },
  { nome: 'Alinhar ao meio', re: ALINHAR_MEIO },
  { nome: 'Alinhar à base', re: ALINHAR_BASE },
]
const DISTRIBUIR: ReadonlyArray<{ nome: string; re: RegExp }> = [
  { nome: 'Distribuir na horizontal', re: DISTRIBUIR_HORIZONTAL },
  { nome: 'Distribuir na vertical', re: DISTRIBUIR_VERTICAL },
]

// ───────────────────────────────────────────────────────────────────────────
// O disco: um mapa avulso com os três pilares
// ───────────────────────────────────────────────────────────────────────────

/**
 * Dois tracinhos brancos nos cantos opostos do mapa. O app enquadra ao abrir
 * pelo CONTEÚDO (`pixi/world.ts` `contentBounds`, que não conta o chão): sem
 * eles o mapa abria com zoom só em volta dos pilares. Branco não entra em
 * nenhuma cor que a régua conta.
 */
function marcosDosCantos(): Drawing[] {
  const traco = (sufixo: string, x: number, y: number): Drawing => ({
    id: `marco-${sufixo}`,
    kind: 'line',
    x1: x,
    y1: y,
    x2: x + 20,
    y2: y,
    color: '#ffffff',
    width: 2,
  })
  return [traco('a', 15, 15), traco('b', LARGURA - 35, ALTURA - 15)]
}

function pilar(cor: Pilar): Drawing {
  const { x, y } = PILARES[cor]
  return { id: `pilar-${cor}`, kind: 'rect', x, y, w: LADO, h: LADO, color: HEX[cor], width: 2, filled: true, fillAlpha: 1 }
}

function discoDeMentira(): Record<string, string> {
  const base = createEmptyMap('map_patio_pilares', MAPA, COLUNAS, LINHAS, GRADE)
  // SEM peça de chão, de propósito: a peça de chão é selecionável
  // (`PixiCanvas.tsx` `floorHitAt`), e um laço que começa em cima dela pega e
  // ARRASTA o chão em vez de abrir o retângulo de seleção (medido em 23/09: o
  // painel virou "Peça de chão · Retângulo" e o chão andou). Sem chão, o fundo
  // é vazio e o arrasto do Selecionar nele é o laço.
  const mapa: MapData = { ...base, drawings: [...marcosDosCantos(), ...TODOS.map(pilar)] }
  return { [`${PASTA}/map.json`]: serializeMap(mapa) }
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

async function instalarDisco(page: Page): Promise<void> {
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
    { arquivos: discoDeMentira() },
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura de pixel (só LÊ a foto; coordenadas devolvidas em px CSS da página)
// ───────────────────────────────────────────────────────────────────────────

interface Mancha {
  n: number
  x1: number
  y1: number
  x2: number
  y2: number
  cx: number
  cy: number
}
type Leitura = Record<Cor, Mancha>

/**
 * Para cada cor da régua: quantos pixels, a caixa que os envolve e o centro de
 * massa, contando só onde o CANVAS do mapa está por cima (rail e painéis não
 * contam). Decodifica a foto num canvas solto — nada do app é tocado.
 */
async function lerCores(page: Page, foto: Foto): Promise<Leitura> {
  return page.evaluate(
    async ({ b64 }) => {
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
        const chave = (y >> 3) * 65536 + (x >> 3)
        let v = noCanvas.get(chave)
        if (v === undefined) {
          v = document.elementFromPoint(((x >> 3) * 8 + 4) * escalaX, ((y >> 3) * 8 + 4) * escalaY)?.tagName === 'CANVAS'
          noCanvas.set(chave, v)
        }
        return v
      }
      const vazia = () => ({ n: 0, x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity, sx: 0, sy: 0 })
      const r = { vermelho: vazia(), azul: vazia(), magenta: vazia() }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          let alvoCor: keyof typeof r | null = null
          if (R > 170 && G < 60 && B < 60) alvoCor = 'vermelho'
          else if (B > 150 && B > R * 2.5 && B > G * 2) alvoCor = 'azul'
          else if (R > 150 && B > 150 && R > G * 2.5 && B > G * 2.5 && Math.abs(R - B) < 40) alvoCor = 'magenta'
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
        x1: m.x1 * escalaX,
        y1: m.y1 * escalaY,
        x2: (m.x2 + 1) * escalaX,
        y2: (m.y2 + 1) * escalaY,
        cx: m.n > 0 ? (m.sx / m.n + 0.5) * escalaX : NaN,
        cy: m.n > 0 ? (m.sy / m.n + 0.5) * escalaY : NaN,
      })
      return { vermelho: fechar(r.vermelho), azul: fechar(r.azul), magenta: fechar(r.magenta) }
    },
    { b64: foto.toString('base64') },
  )
}

async function foto(page: Page): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await page.screenshot()
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error('não consegui fotografar')
}

/** Os três pilares à vista, cada um com o mínimo de pixels. */
async function pilaresAVista(page: Page): Promise<Leitura> {
  const minimos: Record<Cor, number> = { vermelho: PIXELS_DE_PILAR, azul: PIXELS_DE_PILAR, magenta: PIXELS_DE_PILAR }
  const guarda: { ultima: Leitura | null } = { ultima: null }
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(PINTURA_MS)
        const l = await lerCores(page, await foto(page))
        guarda.ultima = l
        return (Object.keys(minimos) as Cor[]).filter((c) => l[c].n <= minimos[c]).map((c) => `${c}=${l[c].n}`)
      },
      { timeout: ESPERA_TELA, message: 'o editor deveria mostrar os pilares vermelho, azul e magenta inteiros' },
    )
    .toEqual([])
  if (!guarda.ultima) throw new Error('sem leitura')
  return guarda.ultima
}

async function mestreAbreOMapa(page: Page): Promise<Leitura> {
  await instalarDisco(page)
  await page.goto('/')
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(MAPA) }).click()
  await page.waitForSelector('canvas')
  return pilaresAVista(page)
}

// ───────────────────────────────────────────────────────────────────────────
// Mundo → tela, calibrado pelos centros do pilar vermelho e do magenta na foto
// ───────────────────────────────────────────────────────────────────────────

interface Tela {
  escala: number
  ponto: (mundo: Ponto) => Ponto
}

function centroNoMundo(cor: Pilar): Ponto {
  return { x: PILARES[cor].x + LADO / 2, y: PILARES[cor].y + LADO / 2 }
}

/** Dois centros conhecidos no mundo, longe um do outro: dão escala e origem com folga de erro pequena. */
function telaPelosPilares(l: Leitura): Tela {
  const a = centroNoMundo('vermelho')
  const b = centroNoMundo('magenta')
  const escala = (l.magenta.cx - l.vermelho.cx) / (b.x - a.x)
  const escalaY = (l.magenta.cy - l.vermelho.cy) / (b.y - a.y)
  expect(escala, 'o pilar magenta deveria aparecer à direita do vermelho').toBeGreaterThan(0)
  expect(Math.abs(escala - escalaY) / escala, 'os pilares deveriam aparecer sem distorção (mesma escala nos dois eixos)').toBeLessThan(0.05)
  return {
    escala,
    ponto: (m) => ({ x: l.vermelho.cx + (m.x - a.x) * escala, y: l.vermelho.cy + (m.y - a.y) * escala }),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos (todos pelo ponteiro e pelo teclado de verdade)
// ───────────────────────────────────────────────────────────────────────────

async function ferramentaSelecionar(page: Page): Promise<void> {
  await page.keyboard.press('v')
}

/** Clique curto de ponteiro no ponto. */
async function clicarEm(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y, { steps: 4 })
  await page.mouse.down()
  await page.waitForTimeout(80)
  await page.mouse.up()
  await page.waitForTimeout(150)
}

/** Arrasto de ponteiro em passos, com pausa antes de soltar. */
async function arrastar(page: Page, de: Ponto, ate: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y, { steps: 4 })
  await page.mouse.down()
  await page.waitForTimeout(80)
  await page.mouse.move(de.x + (ate.x - de.x) * 0.3, de.y + (ate.y - de.y) * 0.3, { steps: 6 })
  await page.mouse.move(ate.x, ate.y, { steps: 12 })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(200)
}

function botaoApagar(page: Page, n: number): Locator {
  return page.getByRole('button', { name: `Apagar ${n} itens selecionados` })
}

/** Retângulo de seleção arrastado no fundo vazio; confere a contagem no painel. */
async function lacar(page: Page, tela: Tela, laco: { x1: number; y1: number; x2: number; y2: number }, n: number): Promise<void> {
  await ferramentaSelecionar(page)
  await arrastar(page, tela.ponto({ x: laco.x1, y: laco.y1 }), tela.ponto({ x: laco.x2, y: laco.y2 }))
  await expect(botaoApagar(page, n), `o laço deveria selecionar ${n} pilares (o painel diria "Apagar ${n} itens selecionados")`).toBeVisible({ timeout: ESPERA })
}

async function desmarcar(page: Page, tela: Tela): Promise<void> {
  await clicarEm(page, tela.ponto(VAZIO))
  await expect(page.getByRole('button', { name: /^Apagar \d+ itens selecionados$/ }), 'clicar no fundo vazio deveria desmarcar tudo').toHaveCount(0, { timeout: ESPERA })
}

/** Botões visíveis e clicáveis com esse nome, em qualquer lugar da janela. */
function clicaveis(page: Page, nome: RegExp): Locator {
  return page.getByRole('button', { name: nome, disabled: false }).filter({ visible: true })
}

/** Clica no botão pelo ponteiro, como o mestre faz. */
async function apertar(page: Page, nome: string, re: RegExp): Promise<void> {
  const botao = clicaveis(page, re).first()
  await expect(botao, `com os pilares selecionados, o painel deveria mostrar o botão "${nome}"; hoje só há "Apagar N itens selecionados" e "Limpar seleção de área"`).toBeVisible({ timeout: ESPERA })
  await botao.click()
  await page.waitForTimeout(200)
}

// ───────────────────────────────────────────────────────────────────────────
// Conferências na foto
// ───────────────────────────────────────────────────────────────────────────

const NOMES: Record<Pilar, string> = { vermelho: 'o pilar vermelho', azul: 'o pilar azul', magenta: 'o pilar magenta' }

function px(v: number): string {
  return `${v.toFixed(1)} px`
}

type Medida = (m: Mancha) => number
const ESQUERDA: Medida = (m) => m.x1
const DIREITA: Medida = (m) => m.x2
const TOPO: Medida = (m) => m.y1
const BASE: Medida = (m) => m.y2
const CENTRO_X: Medida = (m) => m.cx
const CENTRO_Y: Medida = (m) => m.cy

/** Os três pilares com a mesma medida (borda ou centro), a até ALINHADO_PX. */
function conferirMesmaLinha(l: Leitura, medida: Medida, oQue: string): void {
  const valores = TODOS.map((c) => medida(l[c]))
  const espalho = Math.max(...valores) - Math.min(...valores)
  expect(espalho, `${oQue} dos três pilares deveria estar na mesma linha; ficou ${TODOS.map((c, i) => `${c}=${px(valores[i])}`).join(', ')}`).toBeLessThanOrEqual(ALINHADO_PX)
}

/** Cada pilar com a mesma medida de antes (o eixo que o botão NÃO mexe). */
function conferirParado(antes: Leitura, depois: Leitura, medida: Medida, oQue: string, quem: Pilar[] = TODOS): void {
  for (const c of quem) {
    const d = medida(depois[c]) - medida(antes[c])
    expect(Math.abs(d), `${oQue} de ${NOMES[c]} não deveria mudar; mudou ${px(d)}`).toBeLessThanOrEqual(PARADO_PX)
  }
}

/** Alguém de fato andou (sem isso "já estavam alinhados" passaria). */
function conferirQueAndou(antes: Leitura, depois: Leitura): void {
  const maior = Math.max(...TODOS.map((c) => Math.hypot(depois[c].cx - antes[c].cx, depois[c].cy - antes[c].cy)))
  expect(maior, 'pelo menos um pilar deveria ter saído do lugar').toBeGreaterThan(ANDOU_PX)
}

/** Seleciona os três, aperta o botão, desmarca e devolve a foto de depois. */
async function aplicarNosTres(page: Page, tela: Tela, nome: string, re: RegExp): Promise<Leitura> {
  await lacar(page, tela, LACO_DE_TRES, 3)
  await apertar(page, nome, re)
  await desmarcar(page, tela)
  return pilaresAVista(page)
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: os três pilares aparecem tortos, o laço pega dois e depois três, e o clique no fundo vazio desmarca', async ({ page }) => {
  test.setTimeout(180_000)
  const inicio = await mestreAbreOMapa(page)
  const tela = telaPelosPilares(inicio)

  // Tortos de verdade: nenhuma borda nem centro em comum entre os três.
  for (const [medida, oQue] of [[ESQUERDA, 'borda esquerda'], [CENTRO_X, 'centro'], [TOPO, 'topo'], [CENTRO_Y, 'meio']] as const) {
    const v = TODOS.map((c) => medida(inicio[c]))
    expect(Math.max(...v) - Math.min(...v), `no começo, ${oQue} dos pilares NÃO deveria coincidir`).toBeGreaterThan(ANDOU_PX * 3)
  }

  await lacar(page, tela, LACO_DE_DOIS, 2)
  await desmarcar(page, tela)
  await lacar(page, tela, LACO_DE_TRES, 3)
  await desmarcar(page, tela)

  // Nada mexeu os pilares.
  const depois = await pilaresAVista(page)
  conferirParado(inicio, depois, CENTRO_X, 'o centro')
  conferirParado(inicio, depois, CENTRO_Y, 'o meio')
})

test('2. com 1 pilar nenhum alinhar fica clicável; com 2, o painel mostra os seis botões de alinhar e os de distribuir não ficam clicáveis', async ({ page }) => {
  test.setTimeout(180_000)
  const inicio = await mestreAbreOMapa(page)
  const tela = telaPelosPilares(inicio)

  await ferramentaSelecionar(page)
  await clicarEm(page, { x: inicio.vermelho.cx, y: inicio.vermelho.cy })
  for (const { nome, re } of ALINHAR) {
    await expect(clicaveis(page, re), `com UM pilar selecionado, "${nome}" não deveria estar clicável`).toHaveCount(0, { timeout: ESPERA })
  }
  await desmarcar(page, tela)

  await lacar(page, tela, LACO_DE_DOIS, 2)
  for (const { nome, re } of ALINHAR) {
    await expect(clicaveis(page, re).first(), `com 2 pilares selecionados, o painel deveria mostrar o botão "${nome}"`).toBeVisible({ timeout: ESPERA })
  }
  for (const { nome, re } of DISTRIBUIR) {
    await expect(clicaveis(page, re), `com só 2 pilares, "${nome}" não deveria estar clicável`).toHaveCount(0, { timeout: ESPERA })
  }
})

test('3. com 3 pilares, o painel mostra "Distribuir na horizontal" e "Distribuir na vertical" clicáveis', async ({ page }) => {
  test.setTimeout(180_000)
  const inicio = await mestreAbreOMapa(page)
  const tela = telaPelosPilares(inicio)

  await lacar(page, tela, LACO_DE_TRES, 3)
  for (const { nome, re } of DISTRIBUIR) {
    await expect(clicaveis(page, re).first(), `com 3 pilares selecionados, o painel deveria mostrar o botão "${nome}"`).toBeVisible({ timeout: ESPERA })
  }
})

// Alinhar: um teste por botão. `borda` é a medida que tem de igualar; `extremo`
// diz qual pilar serve de régua (o que já está na ponta não sai do lugar);
// `outroEixo` é o que não pode mudar.
const CASOS_DE_ALINHAR: ReadonlyArray<{
  n: number
  nome: string
  re: RegExp
  borda: Medida
  oQue: string
  extremo: Pilar | null
  outroEixo: Medida
  oQueOutro: string
}> = [
  { n: 4, nome: 'Alinhar à esquerda', re: ALINHAR_ESQUERDA, borda: ESQUERDA, oQue: 'a borda esquerda', extremo: 'vermelho', outroEixo: CENTRO_Y, oQueOutro: 'a altura' },
  { n: 5, nome: 'Alinhar ao centro', re: ALINHAR_CENTRO, borda: CENTRO_X, oQue: 'o centro', extremo: null, outroEixo: CENTRO_Y, oQueOutro: 'a altura' },
  { n: 6, nome: 'Alinhar à direita', re: ALINHAR_DIREITA, borda: DIREITA, oQue: 'a borda direita', extremo: 'magenta', outroEixo: CENTRO_Y, oQueOutro: 'a altura' },
  { n: 7, nome: 'Alinhar ao topo', re: ALINHAR_TOPO, borda: TOPO, oQue: 'o topo', extremo: 'vermelho', outroEixo: CENTRO_X, oQueOutro: 'a posição na horizontal' },
  { n: 8, nome: 'Alinhar ao meio', re: ALINHAR_MEIO, borda: CENTRO_Y, oQue: 'o meio', extremo: null, outroEixo: CENTRO_X, oQueOutro: 'a posição na horizontal' },
  { n: 9, nome: 'Alinhar à base', re: ALINHAR_BASE, borda: BASE, oQue: 'a base', extremo: 'magenta', outroEixo: CENTRO_X, oQueOutro: 'a posição na horizontal' },
]

for (const caso of CASOS_DE_ALINHAR) {
  test(`${caso.n}. "${caso.nome}" com três pilares: ${caso.oQue} dos três fica na mesma linha e ${caso.oQueOutro} de cada um não muda`, async ({ page }) => {
    test.setTimeout(180_000)
    const inicio = await mestreAbreOMapa(page)
    const tela = telaPelosPilares(inicio)

    const depois = await aplicarNosTres(page, tela, caso.nome, caso.re)

    conferirQueAndou(inicio, depois)
    conferirMesmaLinha(depois, caso.borda, caso.oQue)
    conferirParado(inicio, depois, caso.outroEixo, caso.oQueOutro)
    if (caso.extremo) {
      // Alinha pela borda extrema: o pilar que já estava na ponta é a régua e não sai do lugar.
      conferirParado(inicio, depois, caso.borda, caso.oQue, [caso.extremo])
    } else {
      // Centro/meio: a linha comum cai dentro da faixa que o conjunto já ocupava.
      const linha = caso.borda(depois.vermelho)
      const faixa = TODOS.map((c) => caso.borda(inicio[c]))
      expect(linha, `${caso.oQue} comum deveria cair entre os centros de antes`).toBeGreaterThanOrEqual(Math.min(...faixa) - ALINHADO_PX)
      expect(linha, `${caso.oQue} comum deveria cair entre os centros de antes`).toBeLessThanOrEqual(Math.max(...faixa) + ALINHADO_PX)
    }
  })
}

test('10. "Distribuir na horizontal": as pontas ficam e o pilar do meio vai para o passo igual entre elas; a altura não muda', async ({ page }) => {
  test.setTimeout(180_000)
  const inicio = await mestreAbreOMapa(page)
  const tela = telaPelosPilares(inicio)

  const depois = await aplicarNosTres(page, tela, 'Distribuir na horizontal', DISTRIBUIR_HORIZONTAL)

  conferirQueAndou(inicio, depois)
  expect(Math.abs(depois.azul.cx - inicio.azul.cx), 'o pilar do meio (azul) deveria andar na horizontal').toBeGreaterThan(ANDOU_PX)
  // Da esquerda para a direita: vermelho, azul, magenta. As pontas não saem do lugar.
  conferirParado(inicio, depois, CENTRO_X, 'a posição na horizontal', ['vermelho', 'magenta'])
  conferirParado(inicio, depois, CENTRO_Y, 'a altura')
  const vaoEsquerdo = depois.azul.x1 - depois.vermelho.x2
  const vaoDireito = depois.magenta.x1 - depois.azul.x2
  expect(Math.abs(vaoEsquerdo - vaoDireito), `o espaço entre vizinhos deveria ficar igual; ficou ${px(vaoEsquerdo)} e ${px(vaoDireito)}`).toBeLessThanOrEqual(ALINHADO_PX)
})

test('11. "Distribuir na vertical": as pontas ficam e o pilar do meio vai para o passo igual entre elas; a posição na horizontal não muda', async ({ page }) => {
  test.setTimeout(180_000)
  const inicio = await mestreAbreOMapa(page)
  const tela = telaPelosPilares(inicio)

  const depois = await aplicarNosTres(page, tela, 'Distribuir na vertical', DISTRIBUIR_VERTICAL)

  conferirQueAndou(inicio, depois)
  expect(Math.abs(depois.azul.cy - inicio.azul.cy), 'o pilar do meio (azul) deveria andar na vertical').toBeGreaterThan(ANDOU_PX)
  // De cima para baixo: vermelho, azul, magenta. As pontas não saem do lugar.
  conferirParado(inicio, depois, CENTRO_Y, 'a altura', ['vermelho', 'magenta'])
  conferirParado(inicio, depois, CENTRO_X, 'a posição na horizontal')
  const vaoDeCima = depois.azul.y1 - depois.vermelho.y2
  const vaoDeBaixo = depois.magenta.y1 - depois.azul.y2
  expect(Math.abs(vaoDeCima - vaoDeBaixo), `o espaço entre vizinhos deveria ficar igual; ficou ${px(vaoDeCima)} e ${px(vaoDeBaixo)}`).toBeLessThanOrEqual(ALINHADO_PX)
})

test('12. um Ctrl+Z depois de "Alinhar à esquerda" devolve os três pilares aonde estavam', async ({ page }) => {
  test.setTimeout(180_000)
  const inicio = await mestreAbreOMapa(page)
  const tela = telaPelosPilares(inicio)

  const alinhado = await aplicarNosTres(page, tela, 'Alinhar à esquerda', ALINHAR_ESQUERDA)
  conferirMesmaLinha(alinhado, ESQUERDA, 'a borda esquerda')

  await page.keyboard.press('Control+z')
  const desfeito = await pilaresAVista(page)
  conferirParado(inicio, desfeito, CENTRO_X, 'a posição na horizontal')
  conferirParado(inicio, desfeito, CENTRO_Y, 'a altura')
})
