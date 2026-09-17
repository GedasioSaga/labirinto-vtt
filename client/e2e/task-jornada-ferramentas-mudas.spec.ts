// Jornadas de usuário escritas ANTES do conserto, a partir do passeio cego de
// 16/09/2026 (persona: mestre veterano). Cada teste descreve o que a pessoa
// espera VER na tela — nunca o que o store guarda. Por isso a prova de região,
// escada e grade é por PIXEL do canvas ou por texto do painel lateral, e nunca
// por contagem em `map.*` (contagem reflete a entrada, não o render: a lista
// CAMADAS mostrava "Escadas 1" para uma escada que o usuário não conseguia
// selecionar nem ver selecionada).
//
// As 5 dores medidas, uma jornada cada:
//   1. Ferramenta Região não cria nada no arrasto; ponto a ponto não fecha com Enter.
//   2. Escada dentro de sala não é selecionável pelo clique (0 de 4 tentativas).
//   3. Alças de seleção ficam desenhadas na posição ANTIGA depois de mover o token.
//   4. Mapa novo com "Formato da grade: Quadrado" abre preto, sem grade e sem limite.
//   5. Ctrl+A + Delete apaga tudo sem confirmação e sem dizer que dá para desfazer.
//
// Coordenadas: a câmera nasce em { x: 0, y: 0, scale: 1 } (mapStore.ts:747), então
// ponto de mundo == offset dentro do `<canvas>`. O painel lateral cobre ~0-280px
// e a barra ~0-70px POR CIMA do canvas, então todo gesto fica em x >= 340, y >= 120
// (mesmo cuidado de task-many-regions.spec.ts).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

type Rgb = [number, number, number]

/** Fundo chapado do palco Pixi (PixiCanvas.tsx:340, `backgroundColor: 0x2b2b2b`). */
const FUNDO: Rgb = [43, 43, 43]
/** Amarelo do destaque/alça de seleção (pixi/constants.ts, `SELECTION_COLOR = 0xffdd55`). */
const AMARELO_SELECAO: Rgb = [255, 221, 85]

const ehFundo = ([r, g, b]: Rgb) =>
  Math.abs(r - FUNDO[0]) < 8 && Math.abs(g - FUNDO[1]) < 8 && Math.abs(b - FUNDO[2]) < 8

/**
 * Área preenchida = deixou de ser o fundo chapado. Deliberadamente NÃO checa
 * uma cor específica: a cor de Região/Sala é escolhida pelo usuário (o padrão
 * é um terracota, não o azul do schema antigo), e a jornada não deve travar
 * numa paleta. Mapa novo nasce sem grade, então o fundo é liso e qualquer
 * pixel diferente ali é desenho de verdade.
 */
const ehAreaPreenchida = (p: Rgb) => !ehFundo(p)

/** Quadradinho de seleção: amarelo quente, longe do cinza do fundo. */
const ehAmareloDeSelecao = ([r, g, b]: Rgb) =>
  r > AMARELO_SELECAO[0] - 60 && g > AMARELO_SELECAO[1] - 70 && b < AMARELO_SELECAO[2] + 70 && r > g && g > b

/** Pixels [r,g,b] de um recorte da tela, lidos da screenshot real (mesmo padrão de task-render-selection-labels). */
async function pixelsDoRecorte(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
): Promise<Rgb[]> {
  const shot = await page.screenshot({ clip })
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d')
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, img.width, img.height).data
    const out: [number, number, number][] = []
    for (let i = 0; i < data.length; i += 4) out.push([data[i], data[i + 1], data[i + 2]])
    return out
  }, shot.toString('base64'))
}

async function caixaDoCanvas(page: Page) {
  const box = await page.locator('canvas').first().boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return box
}

/** Mapa limpo de 30x20 quadros de 64px, ferramenta Selecionar, sem ímã de grade. */
async function reiniciarMapa(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_mudas', 'E2E Ferramentas', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

function ferramenta(page: Page, rotulo: string) {
  return page.getByRole('button', { name: rotulo, exact: true })
}

/** O painel mostra o mesmo cabeçalho em mais de uma seção (Token tem "Nome" e
 *  "Rotação" em seções separadas), então basta a primeira ocorrência. */
function tituloDoPainel(page: Page, nome: string) {
  return page.getByRole('heading', { name: nome, exact: true }).first()
}

/**
 * Arrasto de gente: aperta, move em vários passos, PAUSA com o botão ainda
 * apertado e só então solta. A pausa importa — sem ela o app às vezes trata o
 * gesto como clique.
 */
async function arrastar(page: Page, de: { x: number; y: number }, ate: { x: number; y: number }, passos = 12) {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  for (let i = 1; i <= passos; i++) {
    await page.mouse.move(de.x + ((ate.x - de.x) * i) / passos, de.y + ((ate.y - de.y) * i) / passos)
  }
  await page.waitForTimeout(160)
  await page.mouse.up()
  await page.waitForTimeout(220)
}

// ---------------------------------------------------------------------------
// Dor 1 — "arrastei com a Região e não ficou nada; ponto a ponto não fecha"
// ---------------------------------------------------------------------------

test('arrastar com a ferramenta Região deixa uma região desenhada na tela e clicável com Selecionar', async ({ page }) => {
  await enterEditor(page)
  await reiniciarMapa(page)
  const box = await caixaDoCanvas(page)

  await ferramenta(page, 'Região').click()
  await arrastar(page, { x: box.x + 400, y: box.y + 300 }, { x: box.x + 700, y: box.y + 520 })

  // 1) A pessoa precisa VER a área pintada dentro do retângulo que ela arrastou.
  const miolo = await pixelsDoRecorte(page, { x: box.x + 520, y: box.y + 380, width: 60, height: 60 })
  expect.soft(miolo.filter(ehAreaPreenchida).length, 'o miolo do arrasto continua cor de fundo: nada foi desenhado').toBeGreaterThan(
    miolo.length / 3,
  )

  // 2) E precisa conseguir clicar nela depois, com Selecionar, e ver as propriedades da Região.
  await ferramenta(page, 'Selecionar').click()
  await page.mouse.click(box.x + 550, box.y + 410)
  await expect.soft(tituloDoPainel(page, 'Região'), 'clicar dentro da área arrastada não mostra as propriedades da Região').toBeVisible({
    timeout: 3000,
  })
  await expect.soft(tituloDoPainel(page, 'Sala'), 'o clique pegou uma Sala, não a Região').toBeHidden()
})

test('no modo ponto a ponto da Região, Enter fecha o traçado e vira uma região desenhada', async ({ page }) => {
  await enterEditor(page)
  await reiniciarMapa(page)
  const box = await caixaDoCanvas(page)

  await ferramenta(page, 'Região').click()
  await page.mouse.click(box.x + 420, box.y + 260)
  await page.mouse.click(box.x + 720, box.y + 260)
  await page.mouse.click(box.x + 720, box.y + 500)
  await page.mouse.click(box.x + 420, box.y + 500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(280)

  const miolo = await pixelsDoRecorte(page, { x: box.x + 540, y: box.y + 350, width: 60, height: 60 })
  expect.soft(miolo.filter(ehAreaPreenchida).length, 'Enter não fechou o traçado: o miolo continua vazio').toBeGreaterThan(
    miolo.length / 3,
  )

  await ferramenta(page, 'Selecionar').click()
  await page.mouse.click(box.x + 570, box.y + 380)
  await expect.soft(tituloDoPainel(page, 'Região'), 'depois do Enter não há região nenhuma para selecionar').toBeVisible({
    timeout: 3000,
  })
})

// ---------------------------------------------------------------------------
// Dor 2 — "cliquei 4 vezes em cima da escada e nunca selecionei a escada"
// ---------------------------------------------------------------------------

test('escada desenhada dentro de uma sala fica selecionada ao nascer e volta a ser selecionada com um clique', async ({ page }) => {
  await enterEditor(page)
  await reiniciarMapa(page)
  const box = await caixaDoCanvas(page)

  // Uma sala grande, do jeito que o mestre faz: arrasto com a ferramenta Sala.
  await ferramenta(page, 'Sala').click()
  await arrastar(page, { x: box.x + 360, y: box.y + 180 }, { x: box.x + 780, y: box.y + 540 })
  await expect(tituloDoPainel(page, 'Sala')).toBeVisible({ timeout: 3000 })

  // E a escada DENTRO dela, longe das paredes da sala.
  await ferramenta(page, 'Escada').click()
  await arrastar(page, { x: box.x + 460, y: box.y + 320 }, { x: box.x + 660, y: box.y + 320 })

  // 1) Igual à sala, a escada recém-desenhada já nasce selecionada: o painel mostra "Escada".
  await expect
    .soft(tituloDoPainel(page, 'Escada'), 'a escada não nasce selecionada (a sala nasce) — não há como renomear/mover logo após desenhar')
    .toBeVisible({ timeout: 3000 })

  // 2) E clicar em cima dela com Selecionar seleciona A ESCADA — não a sala de baixo, não a parede.
  await ferramenta(page, 'Selecionar').click()
  await page.mouse.click(box.x + 900, box.y + 650) // clique no vazio, para limpar a seleção antes
  await page.waitForTimeout(150)
  await page.mouse.click(box.x + 560, box.y + 320) // meio do lance da escada
  await page.waitForTimeout(250)

  await expect.soft(tituloDoPainel(page, 'Escada'), 'clicar em cima da escada não seleciona a escada').toBeVisible({ timeout: 3000 })
  await expect.soft(tituloDoPainel(page, 'Sala'), 'o clique na escada pegou a Sala de baixo').toBeHidden()
  await expect.soft(tituloDoPainel(page, 'Parede'), 'o clique na escada pegou a Parede').toBeHidden()
})

// ---------------------------------------------------------------------------
// Dor 3 — "movi o token e os quadradinhos ficaram no lugar antigo"
// ---------------------------------------------------------------------------

test('depois de arrastar um token, não sobra marca de seleção na posição antiga', async ({ page }) => {
  await enterEditor(page)
  await reiniciarMapa(page)
  const box = await caixaDoCanvas(page)

  // Token pelo caminho da UI: botão do painel, nome padrão confirmado com Enter.
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  await page.getByLabel('Nome do novo token').press('Enter')
  await expect(tituloDoPainel(page, 'Token')).toBeVisible({ timeout: 3000 })

  // Posição só para MIRAR o gesto — a prova é o pixel, não o store.
  const origem = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const t = mod.useMapStore.getState().map.tokens[0]
    return { x: t.x, y: t.y }
  })
  const antes = { x: box.x + origem.x, y: box.y + origem.y }
  const recorteAntigo = { x: antes.x - 40, y: antes.y - 40, width: 80, height: 80 }

  // Linha de base: o token nasce selecionado, então HÁ amarelo de seleção aqui.
  // Se isto falhar, o detector de cor está errado e o resto do teste não vale.
  const comSelecao = await pixelsDoRecorte(page, recorteAntigo)
  expect(comSelecao.some(ehAmareloDeSelecao), 'linha de base: token novo deveria nascer com marca de seleção visível').toBe(true)

  await arrastar(page, antes, { x: antes.x + 260, y: antes.y + 20 })

  const depois = await pixelsDoRecorte(page, recorteAntigo)
  expect(
    depois.filter(ehAmareloDeSelecao).length,
    'sobraram quadradinhos de seleção na posição ANTIGA do token depois do arrasto',
  ).toBe(0)
})

// ---------------------------------------------------------------------------
// Dor 4 — "escolhi grade Quadrado, a prévia mostrou grade, o editor abriu preto"
// ---------------------------------------------------------------------------

test('mapa recém-criado com grade quadrada já abre mostrando a grade e o limite do mapa', async ({ page }) => {
  // Caminho completo do menu, sem reiniciarMapa: a dor é no mapa que NASCE do formulário.
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Mapas' }).click()
  await page.getByLabel('Largura (quadros)').fill('14')
  await page.getByLabel('Altura (quadros)').fill('9')
  await page.getByLabel('Tamanho do quadro').fill('64')
  await page.getByRole('radiogroup', { name: 'Formato da grade' }).getByRole('radio', { name: 'Quadrado', exact: true }).click()
  await page.getByRole('button', { name: 'Criar mapa', exact: true }).click()
  await page.waitForSelector('canvas')
  await page.waitForTimeout(500)

  const box = await caixaDoCanvas(page)

  // 1) O interruptor que a pessoa NÃO deveria precisar mexer já está ligado.
  await expect.soft(page.getByLabel('Mostrar grade'), 'o mapa novo abre com "Mostrar grade" desligado').toBeChecked()

  // 2) Há linha de grade desenhada: faixa horizontal atravessando a divisa de
  //    quadros em x = 8 * 64 = 512 (fora do painel lateral). Com a grade
  //    desligada o fundo é chapado, então QUALQUER pixel diferente do fundo ali
  //    é a linha. Escolhido em x=512/y=300, bem dentro do mapa (896 x 576).
  const faixaGrade = await pixelsDoRecorte(page, { x: box.x + 508, y: box.y + 300, width: 9, height: 1 })
  expect.soft(faixaGrade.some((p) => !ehFundo(p)), 'não há nenhuma linha de grade desenhada no mapa novo').toBe(true)

  // 3) Dá para ver onde o mapa acaba: a borda direita fica em x = 14 * 64 = 896.
  const faixaLimite = await pixelsDoRecorte(page, { x: box.x + 890, y: box.y + 300, width: 14, height: 1 })
  expect.soft(faixaLimite.some((p) => !ehFundo(p)), 'não dá para ver onde o mapa termina: nem borda, nem sombra fora dele').toBe(true)
})

// ---------------------------------------------------------------------------
// Dor 5 — "Ctrl+A, Delete: sumiu tudo, sem perguntar e sem dizer que dá para voltar"
// ---------------------------------------------------------------------------

test('apagar tudo com Ctrl+A e Delete pede confirmação ou avisa na tela o caminho de volta', async ({ page }) => {
  await enterEditor(page)
  await reiniciarMapa(page)
  const box = await caixaDoCanvas(page)

  // Conta também o diálogo nativo do navegador, caso o conserto venha por confirm().
  let dialogoNativo = false
  page.on('dialog', async (dialog) => {
    dialogoNativo = true
    await dialog.dismiss()
  })

  // Trabalho de verdade em cima da mesa: uma sala desenhada e visível.
  await ferramenta(page, 'Sala').click()
  await arrastar(page, { x: box.x + 380, y: box.y + 200 }, { x: box.x + 800, y: box.y + 560 })
  const antes = await pixelsDoRecorte(page, { x: box.x + 560, y: box.y + 360, width: 40, height: 40 })
  expect(antes.filter(ehAreaPreenchida).length, 'linha de base: a sala deveria estar desenhada antes do Ctrl+A').toBeGreaterThan(
    antes.length / 3,
  )

  await ferramenta(page, 'Selecionar').click()
  await page.mouse.click(box.x + 1000, box.y + 680) // foco no canvas, no vazio
  await page.keyboard.press('Control+a')
  await page.waitForTimeout(150)
  await page.keyboard.press('Delete')

  // Alguma coisa precisa APARECER: um diálogo para confirmar, ou um aviso
  // dizendo como voltar atrás (Ctrl+Z / desfazer / cancelar).
  const avisos = page.locator('[role="alert"], [role="status"], [role="alertdialog"], dialog[open]')
  const temCaminhoDeVolta = /desfaz|desfazer|ctrl\s*\+?\s*z|cancelar|confirmar/i

  await expect
    .poll(
      async () => {
        if (dialogoNativo) return true
        const total = await avisos.count()
        for (let i = 0; i < total; i++) {
          const alvo = avisos.nth(i)
          if (!(await alvo.isVisible())) continue
          if (temCaminhoDeVolta.test((await alvo.innerText()).trim())) return true
        }
        return false
      },
      { timeout: 5000, message: 'Ctrl+A + Delete apagou o mapa inteiro sem confirmar e sem mostrar o caminho de volta' },
    )
    .toBe(true)
})
