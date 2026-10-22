// LARGURAS E LIVROS RECOLHIDOS (fatia 21 do design consolidado, 22/10/2026).
//
// Critérios escritos antes de mexer, medidos por getBoundingClientRect no app
// do mestre de verdade (sala fechada, nenhuma escolha lembrada):
//  - a 1280, 1366 e 1920 a página não rola na horizontal;
//  - a 1280 a barra de ferramentas fica numa fileira só, com o botão de 38 px
//    (antes: duas fileiras de 28 px), porque o livro da mesa recolhe sozinho
//    abaixo de 1366 com a sala fechada (decisão 7 do PLANO.md) e a barra passa
//    a usar o vão que ele devolve;
//  - a 1366 e a 1920 o livro da mesa nasce aberto, e a barra continua numa
//    fileira, sem tocar nenhum dos dois livros;
//  - a 1440, com o livro do mestre recolhido, o da mesa recolhido e os dois, o
//    vão devolvido é mapa (o ponto do meio da página que saiu acerta o canvas),
//    a barra se centra no vão novo e nada se sobrepõe (livros, barra, chip da
//    cena, zoom);
//  - a 1280, 1366, 1440 e 1530 com os DOIS livros abertos (o da mesa pelo
//    marcador quando nasce recolhido), o lado do botão é o degrau do vão entre
//    os livros (acima de 833 px, 38; de 720 a 833, 32; até 719, 28), a barra
//    fica a 4 px de cada livro, cabe no vão e só quebra em fileiras no degrau
//    de 28, e sempre por grupo inteiro.
// Prints (um por largura) só com LAB_EVIDENCIA apontando uma pasta.
import { test, expect, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { abrirPaginaDaMesa, livroDaMesa } from './helpers/colunaDireita'
import { livroDoMestre } from './helpers/livroDoMestre'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

test.use({ trace: 'off', video: 'off' })

const AVENTURA = 'Largura'
const CODIGO = 'LARG01'
const PASTA = 'C:/appdata/maps/map_largura'
const EVIDENCIA = process.env.LAB_EVIDENCIA ?? ''
/** O lado do botão no protótipo. */
const BOTAO_DO_PROTOTIPO_PX = 38
/** Folga mínima entre a barra e a borda de um livro. */
const FOLGA_DA_BARRA_PX = 4
/** Os degraus de `@container lb-base` (main.css): até 833 px de vão o botão vai a 32, até 719 a 28. */
const VAO_DO_BOTAO_32_PX = 833
const VAO_DO_BOTAO_28_PX = 719

function ladoDoDegrau(vao: number): number {
  if (vao <= VAO_DO_BOTAO_28_PX) return 28
  return vao <= VAO_DO_BOTAO_32_PX ? 32 : BOTAO_DO_PROTOTIPO_PX
}

interface Caixa { left: number; right: number; top: number; bottom: number; width: number; height: number }

interface Medida {
  rolagemX: number
  fileiras: number
  ladoDoBotao: number
  /** A largura do contêiner `lb-base` (o vão entre os livros que os degraus leem). */
  vao: number
  /** Grupos com botões em mais de uma fileira (a quebra é sempre por grupo inteiro). */
  gruposPartidos: number
  barra: Caixa
  /** O que cada livro tapa: a lombada, se recolhido; o livro inteiro, se aberto. */
  esquerdo: Caixa
  direito: Caixa
  esquerdoRecolhido: boolean
  direitoRecolhido: boolean
  chip: Caixa | null
  zoom: Caixa | null
}

function disco(): Record<string, string> {
  const aventura = { version: 1, id: 'adv_largura', name: AVENTURA, startSceneId: 'scene_largura', scenes: [{ id: 'scene_largura', name: AVENTURA, file: 'map.json' }] }
  return {
    [`${PASTA}/map.json`]: serializeMap(createEmptyMap('map_largura', AVENTURA, 30, 20, 50)),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
  }
}

async function medir(page: Page): Promise<Medida> {
  return page.evaluate(() => {
    const caixa = (el: Element | null) => {
      if (el === null) return null
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
    }
    const tapado = (rotulo: string) => {
      const livro = document.querySelector(`aside[aria-label="${rotulo}"]`)
      if (livro === null) throw new Error(`sem o ${rotulo}`)
      const recolhido = livro.classList.contains('gr-e-recolhido')
      const alvo = recolhido ? livro.querySelector('.gr-lombada') : livro
      return { recolhido, caixa: caixa(alvo) }
    }
    const botoes = Array.from(document.querySelectorAll('.lb-toolbar .lb-ferr'), (b) => b.getBoundingClientRect())
    const grupos = Array.from(document.querySelectorAll('.lb-toolbar .lb-toolbar__group'), (g) => new Set(Array.from(g.querySelectorAll('.lb-ferr'), (b) => Math.round(b.getBoundingClientRect().top))).size)
    const base = document.querySelector('.lb-editor__base')
    if (base === null) throw new Error('sem o pé do mapa')
    const estiloDaBase = getComputedStyle(base)
    const esq = tapado('Livro do mestre')
    const dir = tapado('Livro da mesa')
    const raiz = document.documentElement
    return {
      rolagemX: Math.max(raiz.scrollWidth - raiz.clientWidth, document.body.scrollWidth - document.body.clientWidth),
      fileiras: new Set(botoes.map((b) => Math.round(b.top))).size,
      ladoDoBotao: botoes[0]?.width ?? 0,
      vao: base.clientWidth - parseFloat(estiloDaBase.paddingLeft) - parseFloat(estiloDaBase.paddingRight),
      gruposPartidos: grupos.filter((fileirasDoGrupo) => fileirasDoGrupo > 1).length,
      barra: caixa(document.querySelector('.lb-toolbar'))!,
      esquerdo: esq.caixa!,
      direito: dir.caixa!,
      esquerdoRecolhido: esq.recolhido,
      direitoRecolhido: dir.recolhido,
      chip: caixa(document.querySelector('[role="group"][aria-label="Cena aberta"]')),
      zoom: caixa(document.querySelector('.lb-zoomhud')),
    }
  })
}

function sobrepoe(a: Caixa, b: Caixa): boolean {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
}

/** Nenhum par das peças à vista se cruza. */
function sobreposicoes(m: Medida): string[] {
  const pecas: [string, Caixa | null][] = [['livro do mestre', m.esquerdo], ['livro da mesa', m.direito], ['barra', m.barra], ['chip da cena', m.chip], ['zoom', m.zoom]]
  const achadas: string[] = []
  for (let i = 0; i < pecas.length; i++) {
    for (let j = i + 1; j < pecas.length; j++) {
      const [na, a] = pecas[i]
      const [nb, b] = pecas[j]
      if (a !== null && b !== null && sobrepoe(a, b)) achadas.push(`${na} x ${nb}`)
    }
  }
  return achadas
}

/** O elemento no ponto é o canvas do mapa (nada pintado por cima). */
async function eMapa(page: Page, x: number, y: number): Promise<boolean> {
  return page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', { x, y })
}

async function recolher(page: Page, lado: 'esquerdo' | 'direito'): Promise<void> {
  const livro = lado === 'esquerdo' ? livroDoMestre(page) : livroDaMesa(page)
  await livro.getByRole('button', { name: 'Recolher a página' }).click()
  await expect(livro.getByRole('button', { name: 'Abrir a página' })).toBeVisible()
}

async function abrir(page: Page, lado: 'esquerdo' | 'direito'): Promise<void> {
  const livro = lado === 'esquerdo' ? livroDoMestre(page) : livroDaMesa(page)
  await livro.getByRole('button', { name: 'Abrir a página' }).click()
  await expect(livro.getByRole('button', { name: 'Recolher a página' })).toBeVisible()
}

for (const largura of [1280, 1366, 1920] as const) {
  test(`${largura} px com a sala fechada: sem rolagem lateral, barra numa fileira entre os livros`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 })
    await abrirAventuraDeMentira(page, disco(), AVENTURA, CODIGO)
    await expect(page.getByRole('toolbar', { name: 'Ferramentas do mapa' })).toBeVisible()
    // A página do livro que recolhe leva até 260 ms: a medida espera o livro parar.
    await expect.poll(async () => (await medir(page)).fileiras, { message: 'a barra não assentou numa fileira' }).toBe(1)
    const m = await medir(page)
    const relato = JSON.stringify(m)
    expect(m.rolagemX, relato).toBeLessThanOrEqual(0)
    expect(m.fileiras, relato).toBe(1)
    expect(m.direitoRecolhido, `livro da mesa recolhido a ${largura}: ${relato}`).toBe(largura < 1366)
    expect(m.esquerdoRecolhido, relato).toBe(false)
    if (largura === 1280) expect(m.ladoDoBotao, relato).toBe(BOTAO_DO_PROTOTIPO_PX)
    if (largura === 1920) expect(m.ladoDoBotao, relato).toBe(BOTAO_DO_PROTOTIPO_PX)
    expect(m.barra.left - m.esquerdo.right, relato).toBeGreaterThanOrEqual(FOLGA_DA_BARRA_PX)
    expect(m.direito.left - m.barra.right, relato).toBeGreaterThanOrEqual(FOLGA_DA_BARRA_PX)
    expect(sobreposicoes(m), relato).toEqual([])
    if (EVIDENCIA !== '') await page.screenshot({ path: `${EVIDENCIA}/largura-${largura}.png` })
  })
}

/** A medida depois que a página do livro parou de deslizar (duas leituras iguais com 150 ms entre elas). */
async function medirParado(page: Page): Promise<Medida> {
  let anterior = ''
  let medida = await medir(page)
  await expect
    .poll(async () => {
      await page.waitForTimeout(150)
      anterior = JSON.stringify(medida)
      medida = await medir(page)
      return JSON.stringify(medida) === anterior
    }, { message: 'os livros não pararam de mexer' })
    .toBe(true)
  return medida
}

/**
 * Uma largura por degrau, com os dois livros abertos (cada um tapa 342 px com a
 * folga): 1280 e 1366 caem no de 28 (vão de 596 e 682 px), 1440 no de 32 (756)
 * e 1530 no de 38 com o respiro curto (846).
 */
const DOIS_LIVROS: readonly { largura: number; degrau: number }[] = [
  { largura: 1280, degrau: 28 },
  { largura: 1366, degrau: 28 },
  { largura: 1440, degrau: 32 },
  { largura: 1530, degrau: BOTAO_DO_PROTOTIPO_PX },
]

for (const { largura, degrau } of DOIS_LIVROS) {
  test(`${largura} px com os dois livros abertos: o botão segue o degrau do vão, a barra cabe entre os livros e só quebra por grupo`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 })
    await abrirAventuraDeMentira(page, disco(), AVENTURA, CODIGO)
    await expect(page.getByRole('toolbar', { name: 'Ferramentas do mapa' })).toBeVisible()
    // Abaixo de 1366 a sala fechada recolhe o livro da mesa: o marcador o abre (acima ele já nasce aberto).
    if (largura < 1366) await abrirPaginaDaMesa(page, 'Cenas')
    const m = await medirParado(page)
    const relato = JSON.stringify(m)
    expect(ladoDoDegrau(m.vao), `o vão de ${Math.round(m.vao)} px saiu do degrau que este caso prova: ${relato}`).toBe(degrau)
    expect(m.esquerdoRecolhido || m.direitoRecolhido, relato).toBe(false)
    expect(m.rolagemX, relato).toBeLessThanOrEqual(0)
    expect(sobreposicoes(m), relato).toEqual([])
    expect(m.barra.left - m.esquerdo.right, relato).toBeGreaterThanOrEqual(FOLGA_DA_BARRA_PX)
    expect(m.direito.left - m.barra.right, relato).toBeGreaterThanOrEqual(FOLGA_DA_BARRA_PX)
    expect(m.barra.width, relato).toBeLessThanOrEqual(m.vao + 0.5)
    expect(m.ladoDoBotao, `degrau do vão de ${Math.round(m.vao)} px: ${relato}`).toBe(ladoDoDegrau(m.vao))
    expect(m.gruposPartidos, relato).toBe(0)
    // Quebrar em fileiras só quando nem o botão de 28 cabe numa fileira.
    if (m.fileiras > 1) expect(m.ladoDoBotao, relato).toBe(28)
    if (EVIDENCIA !== '') await page.screenshot({ path: `${EVIDENCIA}/largura-${largura}-dois-livros.png` })
  })
}

test('1440 px: livro do mestre, livro da mesa e os dois recolhidos devolvem o vão ao mapa, sem sobreposição', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await abrirAventuraDeMentira(page, disco(), AVENTURA, CODIGO)
  await expect(page.getByRole('toolbar', { name: 'Ferramentas do mapa' })).toBeVisible()
  const meioY = 450
  const aberto = await medir(page)
  expect(aberto.esquerdoRecolhido || aberto.direitoRecolhido, JSON.stringify(aberto)).toBe(false)
  expect(sobreposicoes(aberto), JSON.stringify(aberto)).toEqual([])
  // Onde a página do livro do mestre fica quando aberta: o meio dela vira mapa ao recolher.
  const meioDaPaginaEsq = (aberto.esquerdo.left + aberto.esquerdo.right) / 2 + 26
  const meioDaPaginaDir = (aberto.direito.left + aberto.direito.right) / 2 - 26
  expect(await eMapa(page, meioDaPaginaEsq, meioY), 'a página aberta do livro do mestre já deixava ver o mapa').toBe(false)

  const casos: { nome: string; preparar: () => Promise<void>; livres: number[] }[] = [
    { nome: 'livro do mestre recolhido', preparar: () => recolher(page, 'esquerdo'), livres: [meioDaPaginaEsq] },
    { nome: 'livro da mesa recolhido', preparar: async () => { await abrir(page, 'esquerdo'); await recolher(page, 'direito') }, livres: [meioDaPaginaDir] },
    { nome: 'os dois recolhidos', preparar: () => recolher(page, 'esquerdo'), livres: [meioDaPaginaEsq, meioDaPaginaDir] },
  ]
  for (const caso of casos) {
    await caso.preparar()
    for (const x of caso.livres) await expect.poll(() => eMapa(page, x, meioY), { message: `${caso.nome}: o vão em x=${Math.round(x)} não virou mapa` }).toBe(true)
    const m = await medir(page)
    const relato = `${caso.nome}: ${JSON.stringify(m)}`
    expect(sobreposicoes(m), relato).toEqual([])
    expect(m.rolagemX, relato).toBeLessThanOrEqual(0)
    expect(m.fileiras, relato).toBe(1)
    expect(m.ladoDoBotao, relato).toBe(BOTAO_DO_PROTOTIPO_PX)
    // A barra se centra no vão entre o que os livros tapam (a mesma folga de 16 px dos dois lados).
    const centroDoVao = (m.esquerdo.right + m.direito.left) / 2
    expect(Math.abs((m.barra.left + m.barra.right) / 2 - centroDoVao), relato).toBeLessThanOrEqual(2)
  }
})
