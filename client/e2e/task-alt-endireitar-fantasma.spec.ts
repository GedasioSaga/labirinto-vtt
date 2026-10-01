// E2E do pedido 5, fatia 4 (30/09/2026): depois que o Alt tocado endireita a
// linha selecionada, a posição de ANTES aparece um instante e apaga (~150 ms).
// Só visual: a linha já está reta no mesmo toque, o histórico ganha só o passo
// do endireitar, e com "reduzir movimento" do sistema não há fantasma.
//
// O fantasma vive menos de 0,2 s: olhar a tela depois não basta. O contêiner
// do canvas conta os traços dele em `data-straighten-ghost`, e o spec anota
// cada troca desse número, com a hora, desde antes do Alt.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'
import { pickTool } from './helpers/tools'
import type { Drawing } from '../src/types/map'

type Linha = Extract<Drawing, { kind: 'line' }>

/** Uma troca do contador de traços do fantasma: o valor novo, e quando (relógio da página). */
interface TrocaDoFantasma {
  tracos: string | undefined
  ms: number
}

declare global {
  interface Window {
    __trocasDoFantasma?: TrocaDoFantasma[]
    /** `timeStamp` do último keyup do Alt: o fantasma nasce dentro dele, então nunca antes disto. */
    __altSoltoEm?: number
  }
}

interface Caixa {
  x: number
  y: number
}

interface Estado {
  linhas: Linha[]
  passosDeDesfazer: number
}

/** A linha torta do gesto, em px do canvas (mapa novo: câmera na origem, 1 px de tela = 1 px de mundo). */
const DE = { x: 300, y: 200 }
const ATE = { x: 360, y: 420 }
const MEIO = { x: (DE.x + ATE.x) / 2, y: (DE.y + ATE.y) / 2 }

/** Bem mais que a vida do fantasma: se ele fosse aparecer, já teria aparecido e sumido. */
const ESPERA_DE_QUEM_NAO_VEM_MS = 400

async function lerEstado(page: Page): Promise<Estado> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map, past } = mod.useMapStore.getState()
    return {
      linhas: map.drawings.filter((d): d is Linha => d.kind === 'line'),
      passosDeDesfazer: past.length,
    }
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_alt_fantasma', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    // Sem grade: a ponta solta cai onde o mouse soltou, e o meio da linha é conhecido.
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

async function caixaDoCanvas(page: Page): Promise<Caixa> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return box
}

function linhaPorId(estado: Pick<Estado, 'linhas'>, id: string): Linha {
  const linha = estado.linhas.find((l) => l.id === id)
  if (linha === undefined) throw new Error(`a linha ${id} sumiu`)
  return linha
}

/** Em pé ou deitada, a menos de 0,01 px — a mesma régua do endireitar. */
function estaReta(l: Linha): boolean {
  return Math.abs(l.x2 - l.x1) <= 0.01 || Math.abs(l.y2 - l.y1) <= 0.01
}

/** O caminho do mestre: ferramenta Linha, arrasto torto, Selecionar, clique no meio da linha. */
async function desenharESelecionarLinhaTorta(page: Page, box: Caixa): Promise<Linha> {
  await pickTool(page, 'Linha')
  await page.mouse.move(box.x + DE.x, box.y + DE.y)
  await page.mouse.down()
  await page.mouse.move(box.x + ATE.x, box.y + ATE.y, { steps: 5 })
  await page.mouse.up()

  await pickTool(page, 'Selecionar')
  await page.mouse.click(box.x + MEIO.x, box.y + MEIO.y)

  const { linhas } = await lerEstado(page)
  expect(linhas).toHaveLength(1)
  const torta = linhas[0]
  expect(estaReta(torta)).toBe(false)
  return torta
}

/**
 * Daqui em diante, cada troca do contador de traços do fantasma fica anotada
 * em `window.__trocasDoFantasma`, e a hora do keyup do Alt em
 * `window.__altSoltoEm`. A anotação do observer roda num microtask, que pode
 * ficar atrás de outro trabalho do mesmo keyup: a hora em que o fantasma
 * APARECEU sai atrasada (contada daí, a primeira rodada deu 136 ms de vida a
 * um fantasma de 150). A vida conta, então, a partir do `timeStamp` do keyup,
 * que é de antes de o fantasma nascer.
 */
async function anotarOFantasma(page: Page): Promise<void> {
  await page.evaluate(() => {
    const alvo = document.querySelector<HTMLElement>('[data-straighten-ghost]')
    if (alvo === null) throw new Error('o contêiner do canvas não conta os traços do fantasma')
    const trocas: TrocaDoFantasma[] = []
    window.__trocasDoFantasma = trocas
    new MutationObserver(() => {
      trocas.push({ tracos: alvo.dataset.straightenGhost, ms: performance.now() })
    }).observe(alvo, { attributes: true, attributeFilter: ['data-straighten-ghost'] })
    window.addEventListener(
      'keyup',
      (evento) => {
        if (evento.key === 'Alt') window.__altSoltoEm = evento.timeStamp
      },
      true,
    )
  })
}

async function trocasDoFantasma(page: Page): Promise<TrocaDoFantasma[]> {
  return page.evaluate(() => window.__trocasDoFantasma ?? [])
}

test.beforeEach(async ({ page }) => {
  // Disco de mentira: sem ele o Início (salva e só depois troca de tela) para no erro de gravar.
  await installTauriFsStub(page)
  await enterEditor(page)
  await resetMap(page)
})

test('1. Alt tocado: a linha fica reta na hora, e a posição de antes aparece uma vez e some em menos de um segundo', async ({ page }) => {
  const box = await caixaDoCanvas(page)
  const torta = await desenharESelecionarLinhaTorta(page, box)
  const antes = await lerEstado(page)
  const vida = await page.evaluate(async () => (await import('/src/pixi/straightenGhost.ts')).ENDIREITAR_FANTASMA_MS)
  await anotarOFantasma(page)

  await page.keyboard.press('Alt')

  // A geometria não anima: a linha já está reta, e o histórico ganhou só o passo do endireitar.
  const depois = await lerEstado(page)
  expect(estaReta(linhaPorId(depois, torta.id))).toBe(true)
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer + 1)

  await page.waitForFunction(() => (window.__trocasDoFantasma ?? []).some((t) => t.tracos === '0'))
  const trocas = await trocasDoFantasma(page)
  // Um traço (a linha de antes) aparece, e depois some. Nada pisca de novo.
  expect(trocas.map((t) => t.tracos)).toEqual(['1', '0'])
  const soltou = await page.evaluate(() => window.__altSoltoEm)
  if (soltou === undefined) throw new Error('o keyup do Alt não foi visto')
  const viveu = trocas[1].ms - soltou
  // Apaga no primeiro quadro depois da vida dele, nunca antes; e longe de
  // ficar parado na tela, mesmo com a máquina carregada.
  expect(viveu).toBeGreaterThanOrEqual(vida)
  expect(viveu).toBeLessThan(1000)
})

test('2. com "reduzir movimento" no sistema: a linha só muda, sem fantasma', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const box = await caixaDoCanvas(page)
  const torta = await desenharESelecionarLinhaTorta(page, box)
  await anotarOFantasma(page)

  await page.keyboard.press('Alt')

  expect(estaReta(linhaPorId(await lerEstado(page), torta.id))).toBe(true)
  await page.waitForTimeout(ESPERA_DE_QUEM_NAO_VEM_MS)
  expect(await trocasDoFantasma(page)).toEqual([])
})

test('3. arrastar a ponta até a linha ficar em pé não é endireitar: sem fantasma', async ({ page }) => {
  const box = await caixaDoCanvas(page)
  const torta = await desenharESelecionarLinhaTorta(page, box)
  await anotarOFantasma(page)

  // A alça da ponta de baixo, até a vertical da ponta de cima: cada passo do
  // arrasto é um passo de desfazer, e o último deixa a linha reta — como o
  // endireitar, mas com a ponta de cima parada em vez do meio.
  await page.mouse.move(box.x + ATE.x, box.y + ATE.y)
  await page.mouse.down()
  await page.mouse.move(box.x + DE.x, box.y + ATE.y + 10, { steps: 6 })
  await page.mouse.up()

  const linha = linhaPorId(await lerEstado(page), torta.id)
  expect(linha).toMatchObject({ x1: torta.x1, y1: torta.y1 })
  expect(estaReta(linha)).toBe(true)
  await page.waitForTimeout(ESPERA_DE_QUEM_NAO_VEM_MS)
  expect(await trocasDoFantasma(page)).toEqual([])
})
