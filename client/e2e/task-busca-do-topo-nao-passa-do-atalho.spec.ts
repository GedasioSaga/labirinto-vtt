// A BUSCA DO TOPO DA PÁGINA CENA NÃO CORRE POR BAIXO DO "Ctrl K" (revisão da
// faixa B, 22/10/2026). O chip do atalho mora dentro do campo, no canto
// direito, em posição absoluta; o campo só reservava a largura do "Limpar
// busca" (que vem com texto digitado), e a frase de exemplo "Sala, pino ou
// ficha, em qualquer cena" passava por baixo do chip.
//
// O QUE ESTE ARQUIVO MEDE, em px de tela, no app de verdade:
//  - onde o texto do campo pode chegar: o começo da caixa de conteúdo mais a
//    largura da frase na fonte do campo, sem passar do fim da caixa (o campo
//    corta o texto ali);
//  - onde o chip começa.
// A diferença tem de ser de pelo menos FOLGA_MINIMA_PX, em 1280 e em 1440, com
// a ficha "Objetos do mapa" fechada e aberta. Com texto digitado, o chip dá
// lugar ao "Limpar busca", e o texto também não passa dele.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { enterEditor } from './helpers/enterEditor'
import { abrirPaginaDoLivro, livroDoMestre } from './helpers/livroDoMestre'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

test.use({ trace: 'off', video: 'off' })

/** Escrita antes do conserto: menos que isto, a última letra encosta na borda do chip. */
const FOLGA_MINIMA_PX = 4
const AVENTURA = 'Porto'
const PASTA = 'C:/appdata/maps/map_busca'
const TELAS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const
/** Mais comprido que a caixa do campo em qualquer das duas telas. */
const BUSCA_COMPRIDA = 'Taverna do porto velho, a que fica perto do cais de pedra'

interface Medida {
  frase: string
  /** Até onde o texto pode pintar: o fim da frase, ou o fim da caixa de conteúdo se ela não couber. */
  fimDoTexto: number
  larguraDaFrase: number
  larguraDaCaixa: number
  /** Onde começa o que mora no canto direito do campo (o chip ou o "Limpar busca"). */
  inicioDoCanto: number
  /** A frase que não cabe termina em reticências (`text-overflow` do campo). */
  reticencias: boolean
}

/** Duas cenas: com outra cena para procurar, a frase de exemplo é a comprida. */
function discoComDuasCenas(): Record<string, string> {
  const aventura = {
    version: 1,
    id: 'adv_busca',
    name: AVENTURA,
    startSceneId: 'scene_porto',
    scenes: [
      { id: 'scene_porto', name: AVENTURA, file: 'map.json' },
      { id: 'scene_cais', name: 'Cais', file: 'cais.json' },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(createEmptyMap('map_busca', AVENTURA, 30, 20, 50)),
    [`${PASTA}/cais.json`]: serializeMap(createEmptyMap('map_cais', 'Cais', 20, 12, 50)),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
  }
}

function buscaDoTopo(page: Page): Locator {
  return livroDoMestre(page).getByRole('searchbox', { name: 'Buscar objeto' })
}

/**
 * A régua: a fonte do campo (a do `::placeholder` sem texto, a do campo com
 * texto) num canvas solto. Só lê; não toca em estado do app.
 */
async function medir(busca: Locator, canto: 'chip' | 'limpar'): Promise<Medida> {
  return busca.evaluate((campo, qual) => {
    if (!(campo instanceof HTMLInputElement)) throw new Error('a busca não é um <input>')
    const dono = campo.parentElement
    const cantoDoCampo = qual === 'chip' ? dono?.querySelector('kbd') : dono?.querySelector('button')
    if (!(cantoDoCampo instanceof HTMLElement)) throw new Error(`sem o ${qual} dentro do campo da busca`)
    const px = (valor: string): number => Number.parseFloat(valor) || 0
    const doCampo = getComputedStyle(campo)
    const daFrase = qual === 'chip' ? getComputedStyle(campo, '::placeholder') : doCampo
    const frase = qual === 'chip' ? campo.placeholder : campo.value
    const caixa = campo.getBoundingClientRect()
    const comeco = caixa.left + px(doCampo.borderLeftWidth) + px(doCampo.paddingLeft)
    const fimDaCaixa = caixa.right - px(doCampo.borderRightWidth) - px(doCampo.paddingRight)
    const regua = document.createElement('canvas').getContext('2d')
    if (regua === null) throw new Error('sem canvas 2D para medir a frase')
    const fonte = `${daFrase.fontStyle} ${daFrase.fontWeight} ${daFrase.fontSize} ${daFrase.fontFamily}`
    regua.font = fonte
    // A régua recusa fonte que não entende e fica na de fábrica: aí a medida mentiria.
    if (!regua.font.includes(daFrase.fontSize)) throw new Error(`a régua não aceitou a fonte do campo: ${fonte}`)
    const larguraDaFrase = regua.measureText(frase).width + px(daFrase.letterSpacing) * frase.length
    return {
      frase,
      fimDoTexto: Math.min(comeco + larguraDaFrase, fimDaCaixa),
      larguraDaFrase,
      larguraDaCaixa: fimDaCaixa - comeco,
      inicioDoCanto: cantoDoCampo.getBoundingClientRect().left,
      reticencias: doCampo.textOverflow === 'ellipsis',
    }
  }, canto)
}

/** Confere a folga e deixa o número no relatório (verde também diz quanto sobrou). */
function conferir(medida: Medida, onde: string): void {
  const folga = medida.inicioDoCanto - medida.fimDoTexto
  test.info().annotations.push({
    type: 'medida',
    description: `${onde}: folga ${folga.toFixed(1)} px (frase ${medida.larguraDaFrase.toFixed(1)} px, caixa ${medida.larguraDaCaixa.toFixed(1)} px) — "${medida.frase}"`,
  })
  expect(folga, `${onde}: o texto chega a ${medida.fimDoTexto.toFixed(1)} px e o canto começa em ${medida.inicioDoCanto.toFixed(1)} px`).toBeGreaterThanOrEqual(FOLGA_MINIMA_PX)
  if (medida.larguraDaFrase > medida.larguraDaCaixa) expect(medida.reticencias, `${onde}: a frase não cabe e sai cortada, sem reticências`).toBe(true)
}

async function abrirFichaDosObjetos(page: Page): Promise<void> {
  const cabecalho = livroDoMestre(page).getByRole('button', { name: /^Objetos do mapa/ })
  if ((await cabecalho.getAttribute('aria-expanded')) !== 'true') await cabecalho.click()
  await expect(cabecalho).toHaveAttribute('aria-expanded', 'true')
}

for (const tela of TELAS) {
  test(`${tela.width} px, duas cenas: a frase de exemplo e o texto digitado não chegam ao canto do campo, com a ficha fechada e aberta`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(tela)
    await abrirAventuraDeMentira(page, discoComDuasCenas(), AVENTURA, 'BUSCA1')
    await abrirPaginaDoLivro(page, 'Cena')
    const busca = buscaDoTopo(page)
    await expect(busca).toBeVisible()
    await expect(busca).toHaveAttribute('placeholder', 'Sala, pino ou ficha, em qualquer cena')

    conferir(await medir(busca, 'chip'), `${tela.width} px, ficha fechada`)
    await abrirFichaDosObjetos(page)
    conferir(await medir(busca, 'chip'), `${tela.width} px, ficha aberta`)

    await busca.fill(BUSCA_COMPRIDA)
    await expect(livroDoMestre(page).getByRole('button', { name: 'Limpar busca' })).toBeVisible()
    conferir(await medir(busca, 'limpar'), `${tela.width} px, texto digitado`)
  })
}

test('1280 px, uma cena no navegador: a frase curta também não chega ao chip', async ({ page }) => {
  await enterEditor(page)
  await abrirPaginaDoLivro(page, 'Cena')
  const busca = buscaDoTopo(page)
  await expect(busca).toHaveAttribute('placeholder', 'Sala, porta, pino, token ou texto')
  conferir(await medir(busca, 'chip'), '1280 px, uma cena')
})
