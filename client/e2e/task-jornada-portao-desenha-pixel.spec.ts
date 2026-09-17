// JORNADA DO PORTÃO — "o portão desenha pixel".
//
// POR QUE EXISTE. O portão desta bar era três comandos (`tsc`, `tsc`,
// `npm run test --workspace=client`). Nenhum dos três abre um navegador: 65
// specs e2e existem no repositório e o portão rodava ZERO. Quer dizer que
// nenhuma peça julgada até aqui teve um pixel conferido — o artefato em
// julgamento é a tela do mestre em http://localhost:1450/ e a tela do jogador
// em /player.html, e o portão nunca as viu.
//
// Esta jornada é o canário do próprio portão. Ela não afirma nada sobre a
// memória do explorado nem sobre a mensagem de cômodo bloqueado — isso é das
// peças irmãs. Ela afirma três coisas sobre o INSTRUMENTO:
//
//   1. o comando chega no navegador e o gesto de uma pessoa (ponteiro desce,
//      move, PAUSA, move, sobe) muda pixel de verdade na tela do mestre;
//   2. a tela do jogador (/player.html) sobe e pinta — sem isso, toda peça
//      sobre a tela do jogador é julgada por um portão cego;
//   3. o que o spec LÊ é o mesmo app que a pessoa VÊ. Com o vite reaproveitado
//      entre sessões, o HMR passa a servir o módulo carimbado
//      (`mapStore.ts?t=<ms>`) para a página e o sem carimbo para o
//      `page.evaluate(import(...))` do spec: duas stores zustand, e a asserção
//      conta sobre uma store que a interface nunca usou (vermelho falso) ou
//      escreve numa store que a tela não desenha (verde falso). Aqui as duas
//      pontas se encontram: a sala aparece em pixel E aparece na store lida
//      pelo caminho do spec. Discordância derruba a jornada em vez de
//      contaminar o julgamento das outras peças.
//
// Controle positivo e negativo, os dois: a mesma foto tirada duas vezes ANTES
// do gesto tem de sair idêntica (se a tela mexesse sozinha, "mudou depois do
// gesto" não provaria nada) e a foto depois do gesto tem de sair diferente.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Region } from '../src/types/map'

/** Tempo com o botão parado no meio do arrasto — gesto de pessoa, não de robô. */
const PAUSA_MS = 140
/** Folga para o Pixi terminar de pintar antes de fotografar. */
const PINTURA_MS = 400

/** Leitura, nunca escrita: é o mesmo caminho de import que todo spec usa. */
async function lerRegioes(page: Page): Promise<Region[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.regions
  })
}

/** Módulos de `/src/` carregados pela página, para flagrar instância dupla de HMR. */
async function modulosCarregados(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter((n) => n.includes('/src/')),
  )
}

function duplicadosPorHmr(modulos: string[]): string[] {
  const porCaminho = new Map<string, Set<string>>()
  for (const url of modulos) {
    const limpo = url.split('?')[0]
    const urls = porCaminho.get(limpo) ?? new Set<string>()
    urls.add(url)
    porCaminho.set(limpo, urls)
  }
  return [...porCaminho.entries()].filter(([, urls]) => urls.size > 1).map(([limpo, urls]) => `${limpo} -> ${[...urls].join(' , ')}`)
}

/** Ponteiro de pessoa: desce, anda, PARA, anda de novo, sobe. */
async function arrastarComoPessoa(page: Page, de: { x: number; y: number }, ate: { x: number; y: number }): Promise<void> {
  const meio = { x: (de.x + ate.x) / 2, y: (de.y + ate.y) / 2 }
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(meio.x, meio.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.move(ate.x, ate.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.up()
}

test('o portão desenha pixel: o gesto na tela do mestre muda a tela e a store que o spec lê', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  expect(await lerRegioes(page), 'o editor abriu com mapa sujo: a jornada partiria de um estado que não é o do usuário').toHaveLength(0)

  // A ferramenta é escolhida ANTES da primeira foto: se o painel da barra mexe
  // no tamanho do canvas, ele já mexeu, e a foto de antes e a de depois medem
  // o mesmo retângulo de tela.
  await page.getByRole('button', { name: 'Sala', exact: true }).click()
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')

  // À direita do painel da esquerda (que termina por volta de x=280) e abaixo
  // da barra de ferramentas: o `<canvas>` ocupa a janela inteira e os dois
  // flutuam por cima dele, então um gesto mais à esquerda cairia no painel.
  const de = { x: caixa.x + 360, y: caixa.y + 260 }
  const ate = { x: caixa.x + 700, y: caixa.y + 470 }
  const recorte = { x: de.x - 20, y: de.y - 20, width: ate.x - de.x + 40, height: ate.y - de.y + 40 }

  await page.waitForTimeout(PINTURA_MS)
  const antes = await page.screenshot({ clip: recorte })
  await page.waitForTimeout(PINTURA_MS)
  const aindaAntes = await page.screenshot({ clip: recorte })
  // Controle negativo: parada, a tela é estável. Sem isto, "mudou" poderia ser
  // só o canvas respirando sozinho.
  expect(antes.equals(aindaAntes), 'a tela do mestre muda sozinha parada: nenhuma foto de antes/depois prova gesto nenhum').toBe(true)

  await arrastarComoPessoa(page, de, ate)

  // Controle positivo pela store, pelo caminho de import que todo spec usa.
  await expect
    .poll(async () => (await lerRegioes(page)).length, { timeout: 10_000, message: 'o arrasto não criou sala nenhuma na store que o spec lê' })
    .toBe(1)
  const [sala] = await lerRegioes(page)
  expect(sala.room?.shape, 'o gesto criou uma Região comum, não uma Sala').toBe('rect')
  const xs = sala.points.map((p) => p.x)
  const ys = sala.points.map((p) => p.y)
  expect(Math.max(...xs) - Math.min(...xs), 'a sala saiu degenerada na horizontal').toBeGreaterThan(50)
  expect(Math.max(...ys) - Math.min(...ys), 'a sala saiu degenerada na vertical').toBeGreaterThan(50)

  // A caixa do canvas não pode ter mudado, senão a foto de depois olha outro
  // pedaço de mundo e a comparação não vale.
  const caixaDepois = await page.locator('canvas').boundingBox()
  expect(caixaDepois, 'o canvas sumiu depois do gesto').not.toBeNull()
  expect(
    { x: caixaDepois?.x, y: caixaDepois?.y, w: caixaDepois?.width, h: caixaDepois?.height },
    'o canvas mudou de lugar/tamanho depois do gesto: a foto de depois mede outro pedaço de tela',
  ).toEqual({ x: caixa.x, y: caixa.y, w: caixa.width, h: caixa.height })

  await page.waitForTimeout(PINTURA_MS)
  const depois = await page.screenshot({ clip: recorte })
  // Controle positivo em PIXEL: é isto que os três comandos do portão antigo
  // nunca conferiram uma vez.
  expect(depois.equals(antes), 'a sala existe na store mas a tela não mudou um pixel: o portão estaria julgando texto').toBe(false)

  // O spec e a interface precisam estar falando com o MESMO módulo.
  const duplicados = duplicadosPorHmr(await modulosCarregados(page))
  expect(
    duplicados,
    `módulo de /src/ carregado com E sem carimbo de HMR: são duas instâncias, e toda afirmação por store fica sobre a errada.\n${duplicados.join('\n')}\nReinicie o \`npm run dev\` antes de confiar no portão.`,
  ).toEqual([])

  expect(erros, 'a tela do mestre jogou erro durante a jornada').toEqual([])
})

test('o portão desenha pixel: a tela do jogador sobe e pinta', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await page.goto('/player.html')
  // A página do jogador começa pedindo o código da sala — é o que a pessoa vê.
  await expect(page.getByLabel('Código da sala')).toBeVisible()

  const foto = await page.screenshot()
  expect(foto.length, 'a tela do jogador voltou uma foto vazia').toBeGreaterThan(1000)

  // Controle positivo de CONTEÚDO: a foto não pode ser um retângulo de uma cor
  // só. `toBeGreaterThan(1)` com o número de cores distintas amostradas separa
  // "pintou" de "ficou em branco", que é o que uma página quebrada devolve.
  const cores = await page.evaluate(() => {
    const amostras = new Set<string>()
    const passo = 40
    for (let y = passo; y < window.innerHeight; y += passo) {
      for (let x = passo; x < window.innerWidth; x += passo) {
        const alvo = document.elementFromPoint(x, y)
        if (alvo) amostras.add(getComputedStyle(alvo).backgroundColor + '|' + getComputedStyle(alvo).color)
      }
    }
    return amostras.size
  })
  expect(cores, 'a tela do jogador é de uma cor só: ou não montou, ou montou vazia').toBeGreaterThan(1)

  expect(erros, 'a tela do jogador jogou erro ao abrir').toEqual([])
})
