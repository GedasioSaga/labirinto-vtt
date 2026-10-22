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
//
// A RESERVA DO CHIP É SÓ DE QUEM TEM CHIP (revisão da mesma faixa). O campo
// é o mesmo do "Filtrar cenas" da lista Cenas e do "Buscar cena" dos
// seletores de cena ("Leva a…", "Mandar para…"), que não têm chip: vazios,
// eles guardam no canto menos que o "Buscar objeto", e a frase de exemplo
// cabe inteira. Medido antes do conserto: os dois guardavam os 60 px do chip,
// e mesmo com os 32 px de antes da faixa (o lugar de um "limpar" que o campo
// vazio não mostra) o fim do "Parte do nome, como “tav”" saía cortado.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { addPin, buildPin, createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { SCENE_FILTER_MIN } from '../src/lib/sceneSearch'
import { abrirPaginaDaMesa, livroDaMesa } from './helpers/colunaDireita'
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
/** A descrição é o nome do pino na lista de objetos: é por ela que a busca do topo o acha. */
const PINO_DE_VIAGEM = 'Portão do cais'
/** As outras cenas da aventura comprida: a régua inteira sem contar a aberta (com ela, uma a mais). */
const OUTRAS_CENAS = Array.from({ length: SCENE_FILTER_MIN }, (_, i) => `Sala ${i + 1}`)

/** O que mora no canto direito do campo: o chip do Ctrl K (vazio), o "Limpar" (com texto) ou nada. */
type Canto = 'chip' | 'limpar' | 'nenhum'

interface Medida {
  frase: string
  /** Até onde o texto pode pintar: o fim da frase, ou o fim da caixa de conteúdo se ela não couber. */
  fimDoTexto: number
  larguraDaFrase: number
  larguraDaCaixa: number
  /** O `padding-right` do campo: o canto que ele guarda à direita do texto. */
  recuoDireito: number
  /** Onde começa o que mora no canto direito do campo; `null` = canto vazio. */
  inicioDoCanto: number | null
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

/**
 * A aventura comprida: o Porto com um pino de viagem e mais `OUTRAS_CENAS`.
 * Com elas a lista Cenas ganha o "Filtrar cenas" e o "Leva a…" ganha o "Buscar cena".
 */
function discoComMuitasCenas(): Record<string, string> {
  const pino = { ...buildPin('pin_portao', { x: 400, y: 300 }, 'viagem'), description: PINO_DE_VIAGEM }
  const outras = OUTRAS_CENAS.map((nome, i) => ({ id: `scene_${i}`, name: nome, file: `cena_${i}.json` }))
  const aventura = {
    version: 1,
    id: 'adv_busca_longa',
    name: AVENTURA,
    startSceneId: 'scene_porto',
    scenes: [{ id: 'scene_porto', name: AVENTURA, file: 'map.json' }, ...outras],
  }
  const disco: Record<string, string> = {
    [`${PASTA}/map.json`]: serializeMap(addPin(createEmptyMap('map_busca', AVENTURA, 30, 20, 50), pino)),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
  }
  outras.forEach((cena, i) => {
    disco[`${PASTA}/${cena.file}`] = serializeMap(createEmptyMap(`map_${i}`, cena.name, 20, 12, 50))
  })
  return disco
}

function buscaDoTopo(page: Page): Locator {
  return livroDoMestre(page).getByRole('searchbox', { name: 'Buscar objeto' })
}

/**
 * A régua: a fonte do campo (a do `::placeholder` sem texto, a do campo com
 * texto) num canvas solto. Só lê; não toca em estado do app.
 */
async function medir(busca: Locator, canto: Canto): Promise<Medida> {
  return busca.evaluate((campo, qual) => {
    if (!(campo instanceof HTMLInputElement)) throw new Error('a busca não é um <input>')
    const dono = campo.parentElement
    const seletor = qual === 'chip' ? 'kbd' : qual === 'limpar' ? 'button' : null
    const cantoDoCampo = seletor === null ? null : dono?.querySelector(seletor)
    if (seletor !== null && !(cantoDoCampo instanceof HTMLElement)) throw new Error(`sem o ${qual} dentro do campo da busca`)
    // "Sem canto" com um chip ou um "Limpar" ali dentro mediria o campo errado.
    if (seletor === null && dono?.querySelector('kbd, button')) throw new Error('o campo tem chip ou "Limpar": não é um canto vazio')
    const px = (valor: string): number => Number.parseFloat(valor) || 0
    const doCampo = getComputedStyle(campo)
    const vazio = campo.value === ''
    const daFrase = vazio ? getComputedStyle(campo, '::placeholder') : doCampo
    const frase = vazio ? campo.placeholder : campo.value
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
      recuoDireito: px(doCampo.paddingRight),
      inicioDoCanto: cantoDoCampo instanceof HTMLElement ? cantoDoCampo.getBoundingClientRect().left : null,
      reticencias: doCampo.textOverflow === 'ellipsis',
    }
  }, canto)
}

/** Confere a folga e deixa o número no relatório (verde também diz quanto sobrou). */
function conferir(medida: Medida, onde: string): void {
  if (medida.inicioDoCanto === null) throw new Error(`${onde}: sem chip nem "Limpar" no canto, não há folga a medir`)
  const folga = medida.inicioDoCanto - medida.fimDoTexto
  test.info().annotations.push({
    type: 'medida',
    description: `${onde}: folga ${folga.toFixed(1)} px (frase ${medida.larguraDaFrase.toFixed(1)} px, caixa ${medida.larguraDaCaixa.toFixed(1)} px) — "${medida.frase}"`,
  })
  expect(folga, `${onde}: o texto chega a ${medida.fimDoTexto.toFixed(1)} px e o canto começa em ${medida.inicioDoCanto.toFixed(1)} px`).toBeGreaterThanOrEqual(FOLGA_MINIMA_PX)
  if (medida.larguraDaFrase > medida.larguraDaCaixa) expect(medida.reticencias, `${onde}: a frase não cabe e sai cortada, sem reticências`).toBe(true)
}

/**
 * Campo vazio sem chip: a frase de exemplo cabe inteira, com a folga, e o
 * canto guarda menos que o do "Buscar objeto" vazio (`recuoDoChip`), que é o
 * único com o Ctrl K.
 */
function conferirSemChip(medida: Medida, recuoDoChip: number, onde: string): void {
  test.info().annotations.push({
    type: 'medida',
    description: `${onde}: canto ${medida.recuoDireito.toFixed(1)} px (o do Ctrl K: ${recuoDoChip.toFixed(1)} px), frase ${medida.larguraDaFrase.toFixed(1)} px numa caixa de ${medida.larguraDaCaixa.toFixed(1)} px — "${medida.frase}"`,
  })
  expect(medida.recuoDireito, `${onde}: o campo vazio guarda o canto do Ctrl K, que ele não tem`).toBeLessThan(recuoDoChip)
  expect(medida.larguraDaFrase + FOLGA_MINIMA_PX, `${onde}: a frase de exemplo não cabe inteira na caixa`).toBeLessThanOrEqual(medida.larguraDaCaixa)
}

async function abrirFichaDosObjetos(page: Page): Promise<void> {
  const cabecalho = livroDoMestre(page).getByRole('button', { name: /^Objetos do mapa/ })
  if ((await cabecalho.getAttribute('aria-expanded')) !== 'true') await cabecalho.click()
  await expect(cabecalho).toHaveAttribute('aria-expanded', 'true')
}

/** O canto que o "Buscar objeto" vazio guarda para o Ctrl K: a régua dos campos sem chip. */
async function recuoDoCampoComChip(page: Page, tela: string): Promise<number> {
  await abrirPaginaDoLivro(page, 'Cena')
  const busca = buscaDoTopo(page)
  await expect(busca).toHaveValue('')
  const comChip = await medir(busca, 'chip')
  conferir(comChip, `${tela}, Buscar objeto vazio`)
  return comChip.recuoDireito
}

/** O "Filtrar cenas" da página Cenas do livro da mesa, com a seção aberta. */
async function filtroDeCenas(page: Page): Promise<Locator> {
  await abrirPaginaDaMesa(page, 'Cenas')
  const cabecalho = livroDaMesa(page).getByRole('region', { name: 'Cenas' }).getByRole('button', { name: 'Cenas', exact: true })
  if ((await cabecalho.getAttribute('aria-expanded')) === 'false') await cabecalho.click()
  const filtro = livroDaMesa(page).getByRole('searchbox', { name: 'Filtrar cenas' })
  await expect(filtro).toBeVisible()
  return filtro
}

/** O "Buscar cena" do "Leva a…": o pino achado pela busca do topo, a Ficha dele e o botão. */
async function buscaDeCenaDoPino(page: Page): Promise<Locator> {
  await abrirPaginaDoLivro(page, 'Cena')
  const busca = buscaDoTopo(page)
  await busca.fill(PINO_DE_VIAGEM)
  await busca.press('Enter')
  await abrirPaginaDoLivro(page, 'Ficha')
  await livroDoMestre(page).getByRole('button', { name: 'Leva a…', exact: true }).click()
  const campo = livroDoMestre(page).getByRole('searchbox', { name: 'Buscar cena' })
  await expect(campo).toBeVisible()
  await expect(campo).toHaveValue('')
  return campo
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

for (const tela of TELAS) {
  test(`${tela.width} px, aventura comprida: o "Filtrar cenas" vazio não guarda o canto do Ctrl K, e com texto não passa do "Limpar filtro"`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(tela)
    await abrirAventuraDeMentira(page, discoComMuitasCenas(), AVENTURA, 'BUSCA2')
    const recuoDoChip = await recuoDoCampoComChip(page, `${tela.width} px`)

    const filtro = await filtroDeCenas(page)
    const vazio = await medir(filtro, 'nenhum')
    conferirSemChip(vazio, recuoDoChip, `${tela.width} px, Filtrar cenas vazio`)

    await filtro.fill(BUSCA_COMPRIDA)
    await expect(livroDaMesa(page).getByRole('button', { name: 'Limpar filtro' })).toBeVisible()
    const comTexto = await medir(filtro, 'limpar')
    conferir(comTexto, `${tela.width} px, Filtrar cenas com texto`)
    expect(vazio.recuoDireito, `${tela.width} px: vazio, o "Filtrar cenas" guarda mais canto que o "Limpar filtro" que só vem com texto`).toBeLessThanOrEqual(comTexto.recuoDireito)
  })

  test(`${tela.width} px, aventura comprida: o "Buscar cena" do "Leva a…" não tem chip nem guarda o canto dele`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(tela)
    await abrirAventuraDeMentira(page, discoComMuitasCenas(), AVENTURA, 'BUSCA3')
    const recuoDoChip = await recuoDoCampoComChip(page, `${tela.width} px`)
    conferirSemChip(await medir(await buscaDeCenaDoPino(page), 'nenhum'), recuoDoChip, `${tela.width} px, Buscar cena do "Leva a…"`)
  })
}
