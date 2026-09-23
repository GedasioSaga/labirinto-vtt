// JORNADAS DE USUÁRIO dos 4 gestos centrais do editor — escritas para FALHAR
// hoje (vermelhas). Cada teste descreve o que a PESSOA espera ver na tela,
// não como o código faz. Quem corrige o código é outra pessoa: aqui não se
// toca em nada de produção.
//
// Dores medidas em passeio cego (docs/features-olhar-usuario-2026-09-16.md e
// medições do gauntlet de 16/09/2026):
//   1. roda do mouse dá PAN, não zoom (pixi/wheelGesture.ts:43 exige Ctrl);
//      na referência do nicho (Dungeon Scrawl) roda pura é zoom no cursor.
//      Usuário novo rolou a roda, o mapa fugiu da tela e ele achou que tinha
//      quebrado o desenho.
//   2. arrastar token com a ferramenta Selecionar não moveu o token em 2
//      passeios independentes (0/3 e 0/8); só as setas moviam, e a moldura
//      de seleção ficava desenhada na posição antiga.
//   3. clique da ferramenta Porta em parede fina acertou 4 de 5; a tentativa
//      que erra não cria porta e NÃO AVISA NADA (sem cursor diferente, sem
//      realce da parede válida, sem mensagem).
//   4. alça de redimensionar sala errada por poucos px desseleciona a sala e
//      arrasta a vista inteira, sem aviso.
//
// REGRA DE PROVA DESTE ARQUIVO: a asserção roda na MESMA representação que o
// usuário vê — pixel do canvas (screenshot de 1x1 px comparado byte a byte,
// mesmo padrão de task4-selection-pixel-diff.spec.ts) ou texto/indicador
// visível na tela (ZoomHud, botão "Apagar … selecionada", toast). A store
// entra só como APOIO, nunca como prova única. Nenhum `data-*count`.
//
// GESTO REAL: page.mouse.down() → vários move → pausa → up(); roda com
// page.mouse.wheel. Nada de setState, ação de store no lugar do gesto ou
// evento sintético onde o gesto existe na tela.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

// O Pixi pinta no próximo tick do ticker (requestAnimationFrame): o redraw é
// síncrono na mutação, a PINTURA não. Mesma espera de task-token-image.spec.ts.
const PAINT_MS = 150
// Pausa antes de soltar o botão — um humano não solta no mesmo frame do
// último movimento, e vários bugs de drag só aparecem com o gesto parado.
const PAUSA_ANTES_DE_SOLTAR_MS = 120

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_jornada_gestos', 'E2E Jornada', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function ferramenta(page: Page, label: 'Selecionar' | 'Parede' | 'Porta' | 'Sala') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

/** O que `page.screenshot()` devolve. `Buffer` NÃO é tipo declarado no projeto
 *  de tipos dos e2e (não há `@types/node` instalado), então anotá-lo dava
 *  `TS2749: 'Buffer' refers to a value, but is being used as a type here` — dois
 *  erros de tipo VIVOS nesta jornada, invisíveis enquanto o portão só checava
 *  `src`. O tipo vem da própria API, como já faz task-jornada-porta-sem-buraco. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

/** 1 pixel do que está DESENHADO na tela, em px de CSS da página. */
async function pixelDaTela(page: Page, x: number, y: number): Promise<Foto> {
  return page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } })
}

/** Recorte do que está desenhado, para comparar byte a byte. */
async function recorteDaTela(page: Page, x: number, y: number, width: number, height: number): Promise<Foto> {
  return page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width, height } })
}

/**
 * Percentual de zoom que o usuário LÊ no canto da tela (ZoomHud.tsx: o nome
 * acessível é `Zoom: {n}%`, com sufixo fixo nos limites). Indicador visível —
 * não é o `camera.scale` da store.
 */
async function zoomVisivelPct(page: Page): Promise<number> {
  const hud = page.getByRole('button', { name: /^Zoom: \d+%/ })
  const rotulo = (await hud.getAttribute('aria-label')) ?? ''
  const match = /^Zoom: (\d+)%/.exec(rotulo)
  if (!match) throw new Error(`ZoomHud sem percentual legível: "${rotulo}"`)
  return Number(match[1])
}

/**
 * Textos de aviso VISÍVEIS na tela (toast de erro/informação, mensagem de
 * erro de painel). Deliberadamente NÃO é um `[role=status]` genérico: a dica
 * fixa da barra de ferramentas (Toolbar.tsx) também é `role="status"` e está
 * sempre lá — contá-la daria falso verde em "a tela diz por quê". Por isso a
 * asserção compara a lista ANTES e DEPOIS do gesto e exige texto NOVO.
 */
async function avisosVisiveis(page: Page): Promise<string[]> {
  const candidatos = page.locator('.lb-toast, [role="alert"]')
  const total = await candidatos.count()
  const textos: string[] = []
  for (let i = 0; i < total; i += 1) {
    const el = candidatos.nth(i)
    if (!(await el.isVisible())) continue
    const texto = (await el.innerText()).trim()
    if (texto) textos.push(texto)
  }
  return textos
}

/**
 * Cria um token pelo ÚNICO caminho que a interface oferece hoje: o botão
 * "Adicionar token" do painel (a ferramenta Token da barra está escondida por
 * `FEATURES.tokenTool`, lib/features.ts). Nada de `addToken` na store — o
 * gesto existe na tela. O token nasce no centro da vista e já selecionado
 * (App.tsx:806), então a posição não é escolhida aqui: é LIDA depois, da
 * tela, para o arrasto começar em cima do que foi desenhado.
 */
async function criarTokenPeloPainel(page: Page): Promise<{ x: number; y: number }> {
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nome do novo token' }).press('Enter')
  await page.waitForTimeout(PAINT_MS)
  const token = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const t = mod.useMapStore.getState().map.tokens[0]
    return t ? { x: t.x, y: t.y } : null
  })
  if (!token) throw new Error('"Adicionar token" não criou token nenhum')
  return token
}

/** Centro de célula (grid 64) mais próximo — onde o snap de token pousa. */
function centroDeCelula(valor: number, grid = 64): number {
  return Math.round((valor - grid / 2) / grid) * grid + grid / 2
}

/** Arrasto de gente: desce, anda em vários passos, PARA, e só então solta. */
async function arrastar(page: Page, de: { x: number; y: number }, para: { x: number; y: number }) {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(de.x + (para.x - de.x) * 0.25, de.y + (para.y - de.y) * 0.25, { steps: 6 })
  await page.mouse.move(de.x + (para.x - de.x) * 0.6, de.y + (para.y - de.y) * 0.6, { steps: 6 })
  await page.mouse.move(para.x, para.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PAINT_MS)
}

async function caixaDoCanvas(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return box
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

// ───────────────────────────────────────────────────────────────────────────
// JORNADA 1 — "rolei a roda para ver de perto"
// ───────────────────────────────────────────────────────────────────────────
// A pessoa põe o cursor em cima de uma coisa do mapa e rola a roda para
// frente esperando CHEGAR PERTO daquilo (é o que Dungeon Scrawl faz, é o que
// ela faz em mapa, foto e PDF). Duas coisas têm de ser verdade na tela:
//   a) o número de zoom no canto sobe;
//   b) o que estava debaixo do cursor continua debaixo do cursor.
// Hoje roda pura faz PAN (wheelGesture.ts:43 só dá zoom com Ctrl): o número
// fica em 100% e a coisa foge da tela.
test('1. roda do mouse sobre o canvas aproxima o mapa e mantém sob o cursor o que estava sob o cursor', async ({ page }) => {
  const box = await caixaDoCanvas(page)

  const mundo = await criarTokenPeloPainel(page)
  // Câmera nasce em {x:0, y:0, scale:1}: ponto de mundo = offset no canvas.
  const alvo = { x: box.x + mundo.x, y: box.y + mundo.y }

  // Sanidade: tem mesmo alguma coisa DESENHADA sob o cursor (senão a jornada
  // compararia fundo com fundo e passaria por acidente).
  const pixelDoToken = await pixelDaTela(page, alvo.x, alvo.y)
  const pixelDoVazio = await pixelDaTela(page, alvo.x, alvo.y + 200)
  expect(pixelDoToken.equals(pixelDoVazio)).toBe(false)

  await ferramenta(page, 'Selecionar')
  const zoomAntes = await zoomVisivelPct(page)

  // Gesto: cursor em cima do token, roda para frente (deltaY negativo).
  await page.mouse.move(alvo.x, alvo.y)
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(PAINT_MS)

  // (a) o indicador de zoom que a pessoa lê no canto tem de subir.
  // `expect.soft` nas duas: são duas queixas distintas do mesmo gesto, e quem
  // for corrigir precisa ver as DUAS no relatório, não só a primeira.
  const zoomDepois = await zoomVisivelPct(page)
  expect
    .soft(zoomDepois, 'o percentual de zoom visível na tela deveria subir ao rolar a roda para frente')
    .toBeGreaterThan(zoomAntes)

  // (b) prova no pixel: o ponto de mundo que estava sob o cursor continua sob
  // o cursor. Zoom ancorado no cursor mantém a mesma cor ali (o círculo só
  // cresce em volta do mesmo centro); pan tira o token de baixo do cursor.
  const pixelSobOCursor = await pixelDaTela(page, alvo.x, alvo.y)
  expect
    .soft(pixelSobOCursor.equals(pixelDoToken), 'o que estava desenhado sob o cursor deveria continuar sob o cursor depois da roda')
    .toBe(true)
})

// ───────────────────────────────────────────────────────────────────────────
// JORNADA 2 — "arrastei o boneco para a sala ao lado"
// ───────────────────────────────────────────────────────────────────────────
// Prova na posição DESENHADA: o pixel do centro de destino passa a ter a cor
// que o token tinha, e o pixel do centro de origem volta a ser o fundo que
// era ANTES do token existir. O segundo ponto também pega a queixa "a moldura
// de seleção fica desenhada na posição antiga": mede-se um pixel na borda do
// círculo antigo, onde a moldura seria desenhada.
test('2. arrastar um token com a ferramenta Selecionar leva o token para onde o ponteiro soltou', async ({ page }) => {
  const box = await caixaDoCanvas(page)

  const mundo = await criarTokenPeloPainel(page)
  const origem = { x: box.x + mundo.x, y: box.y + mundo.y }
  // Solta num centro de célula 3 quadrados à esquerda: é onde o snap de token
  // pousa, então o ponto pedido é o ponto obtido.
  const destinoMundo = { x: centroDeCelula(mundo.x - 192), y: centroDeCelula(mundo.y) }
  const destino = { x: box.x + destinoMundo.x, y: box.y + destinoMundo.y }
  // Ponto na borda ESQUERDA do círculo (raio = grid/2 = 32), na altura do
  // centro: é ali que a moldura de seleção é desenhada, longe do rótulo do
  // nome (que fica acima/abaixo do círculo).
  const bordaOrigem = { x: origem.x - 32, y: origem.y }
  const bordaDestino = { x: destino.x - 32, y: destino.y }

  const pixelDoToken = await pixelDaTela(page, origem.x, origem.y)
  const pixelDaMoldura = await pixelDaTela(page, bordaOrigem.x, bordaOrigem.y)
  const fundoDoDestino = await pixelDaTela(page, destino.x, destino.y)
  // Sanidade: token e moldura estão mesmo desenhados na origem, e o destino
  // está vazio antes do gesto.
  expect(pixelDoToken.equals(fundoDoDestino), 'sanidade: o token precisa estar desenhado na origem').toBe(false)
  expect(pixelDaMoldura.equals(pixelDoToken), 'sanidade: a moldura tem cor diferente do miolo do token').toBe(false)

  await ferramenta(page, 'Selecionar')
  await arrastar(page, origem, destino)

  // O token está DESENHADO onde o ponteiro soltou.
  expect(
    (await pixelDaTela(page, destino.x, destino.y)).equals(pixelDoToken),
    'o token deveria estar desenhado no ponto onde o ponteiro soltou',
  ).toBe(true)
  // E não está mais desenhado onde estava.
  expect(
    (await pixelDaTela(page, origem.x, origem.y)).equals(pixelDoToken),
    'o token não pode continuar desenhado na posição de onde saiu',
  ).toBe(false)
  // A moldura de seleção foi junto — não ficou desenhada na posição antiga.
  expect(
    (await pixelDaTela(page, bordaDestino.x, bordaDestino.y)).equals(pixelDaMoldura),
    'a moldura de seleção deveria estar desenhada em volta da posição nova',
  ).toBe(true)
  expect(
    (await pixelDaTela(page, bordaOrigem.x, bordaOrigem.y)).equals(pixelDaMoldura),
    'a moldura de seleção não pode continuar desenhada em volta da posição antiga',
  ).toBe(false)

  // APOIO (nunca prova única): a store concorda com o que a tela mostra.
  const token = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.tokens[0] ?? null
  })
  expect(token).not.toBeNull()
  expect({ x: token!.x, y: token!.y }).toEqual(destinoMundo)
})

// ───────────────────────────────────────────────────────────────────────────
// JORNADA 3 — "cliquei na parede para pôr uma porta"
// ───────────────────────────────────────────────────────────────────────────
// Parede fina é um risco de ~2 px na tela; ninguém acerta o centro dela. Duas
// exigências, uma por teste:
//   3a. um clique a ~8 px da linha ainda é "em cima da parede" para o usuário
//       — ou cria a porta, ou a tela explica por que não criou;
//   3b. quando o clique erra de verdade, a tela tem de dizer alguma coisa. O
//       usuário clicou e o app ficou mudo: é a queixa literal do passeio.
// Nota: a tolerância do clique (PixiCanvas.tsx:1619, 16 px de mundo) NÃO
// depende da espessura da parede — `distanceToSegment` só olha a linha de
// centro. A diferença medida entre parede fina (4/5) e muralha grossa (5/5)
// é de MIRA, não de regra: por isso a parede usada aqui é a padrão da
// ferramenta, e o que se cobra é o resultado na tela.
test('3a. clicar com a ferramenta Porta a ~8 px de uma parede fina cria a porta naquela parede (ou a tela diz por quê)', async ({ page }) => {
  const box = await caixaDoCanvas(page)

  await ferramenta(page, 'Parede')
  await arrastar(page, { x: box.x + 300, y: box.y + 320 }, { x: box.x + 700, y: box.y + 320 })

  const cliqueX = box.x + 512
  const cliqueY = box.y + 320 + 8 // 8 px abaixo da linha
  const recorteAntes = await recorteDaTela(page, cliqueX - 40, box.y + 320 - 20, 80, 40)
  const avisosAntes = await avisosVisiveis(page)

  await ferramenta(page, 'Porta')
  await page.mouse.click(cliqueX, cliqueY)
  await page.waitForTimeout(PAINT_MS)

  const recorteDepois = await recorteDaTela(page, cliqueX - 40, box.y + 320 - 20, 80, 40)
  const desenhoMudou = !recorteAntes.equals(recorteDepois)
  const avisosNovos = (await avisosVisiveis(page)).filter((t) => !avisosAntes.includes(t))

  // Contrato da jornada: OU a porta aparece desenhada na parede, OU a tela
  // explica. Ficar sem porta e sem explicação é o que não pode.
  expect(
    desenhoMudou || avisosNovos.length > 0,
    `clique a 8 px da parede: nada mudou no desenho e nenhuma mensagem apareceu (avisos novos: ${JSON.stringify(avisosNovos)})`,
  ).toBe(true)

  if (desenhoMudou) {
    // APOIO: se o desenho mudou, foi porque nasceu uma porta naquela parede.
    const pedacosComPorta = await page.evaluate(async () => {
      const mod = await import('/src/stores/mapStore.ts')
      return mod.useMapStore.getState().map.walls.filter((w) => w.door !== null).length
    })
    expect(pedacosComPorta, 'o desenho mudou mas nenhuma porta foi criada na parede').toBeGreaterThan(0)
  }
})

test('3b. clique da ferramenta Porta que erra a parede explica na tela por que nenhuma porta apareceu', async ({ page }) => {
  const box = await caixaDoCanvas(page)

  await ferramenta(page, 'Parede')
  await arrastar(page, { x: box.x + 300, y: box.y + 320 }, { x: box.x + 700, y: box.y + 320 })

  const avisosAntes = await avisosVisiveis(page)

  await ferramenta(page, 'Porta')
  // 24 px abaixo da linha: para quem mira num risco de 2 px isso é "na
  // parede", mas está fora do corredor de 16 px que o app aceita.
  await page.mouse.click(box.x + 512, box.y + 320 + 24)
  await page.waitForTimeout(PAINT_MS)

  const portas = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.walls.filter((w) => w.door !== null).length
  })
  // APOIO: confirma que este clique é mesmo o caso "errou" (se um dia a
  // tolerância crescer e a porta nascer, esta jornada precisa ser reescrita
  // com um ponto realmente fora, não passar em silêncio).
  expect(portas, 'este clique deveria estar FORA da tolerância — jornada precisa de outro ponto').toBe(0)

  const avisosNovos = (await avisosVisiveis(page)).filter((t) => !avisosAntes.includes(t))
  expect(
    avisosNovos.length,
    'o usuário clicou, nenhuma porta apareceu e a tela não disse nada — precisa de mensagem visível explicando',
  ).toBeGreaterThan(0)
})

// ───────────────────────────────────────────────────────────────────────────
// JORNADA 4 — "fui pegar o canto da sala para esticar"
// ───────────────────────────────────────────────────────────────────────────
// A alça de canto é um quadradinho de 7 px (drawRoomHandles.ts,
// HANDLE_VISUAL_RADIUS = 3.5) e o raio de acerto é 10 px de mundo
// (roomOps.ts:25). Errar por pouco é o caso NORMAL. Errar por pouco não pode
// custar a seleção nem jogar a vista inteira para o lado — o usuário perde
// o que estava fazendo e não entende o que aconteceu.
// Prova na tela: o botão "Apagar região selecionada" continua lá (a sala
// continua selecionada) e o canto oposto da sala — a âncora de qualquer
// resize legítimo — continua desenhado no mesmo lugar (a vista não andou).
const CANTO_SALA = { x: 600, y: 300 } // canto superior direito da sala 300,300→600,500
const CANTO_ANCORA = { x: 300, y: 500 } // canto oposto: fica parado num resize legítimo

async function desenharSalaESelecionar(page: Page, box: { x: number; y: number }) {
  await ferramenta(page, 'Sala')
  await arrastar(page, { x: box.x + 300, y: box.y + 300 }, { x: box.x + 600, y: box.y + 500 })
  // A sala nasce pedindo nome no mapa; Escape fecha o campo sem apagar a sala.
  await page.keyboard.press('Escape')
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(box.x + 450, box.y + 400)
  await expect(page.getByRole('button', { name: /Apagar|Nada selecionado/ })).toHaveText('Apagar região selecionada')
  await page.waitForTimeout(PAINT_MS)
}

for (const erro of [6, 14]) {
  test(`4. arrasto que começa a ${erro} px do canto de uma sala selecionada não desseleciona nem move a vista`, async ({ page }) => {
    const box = await caixaDoCanvas(page)
    await desenharSalaESelecionar(page, box)

    // Recorte apertado em volta do canto-âncora: num resize legítimo ele fica
    // parado; se a vista inteira andar, ele sai do recorte.
    const recorte = { x: box.x + CANTO_ANCORA.x - 8, y: box.y + CANTO_ANCORA.y - 8, w: 16, h: 16 }
    const ancoraAntes = await recorteDaTela(page, recorte.x, recorte.y, recorte.w, recorte.h)

    // Começa o arrasto errando a alça por `erro` px (na diagonal para fora da
    // sala, que é por onde a mão escorrega) e puxa para esticar.
    const inicio = { x: box.x + CANTO_SALA.x + erro, y: box.y + CANTO_SALA.y - erro }
    await arrastar(page, inicio, { x: inicio.x + 80, y: inicio.y - 40 })

    // `expect.soft`: perder a seleção e perder o enquadramento são dois
    // estragos distintos do mesmo gesto — o relatório mostra os dois.
    await expect
      .soft(page.getByRole('button', { name: /Apagar|Nada selecionado/ }), `errar a alça por ${erro} px não pode desselecionar a sala`)
      .toHaveText('Apagar região selecionada')

    const ancoraDepois = await recorteDaTela(page, recorte.x, recorte.y, recorte.w, recorte.h)
    expect
      .soft(
        ancoraDepois.equals(ancoraAntes),
        `errar a alça por ${erro} px não pode arrastar a vista inteira (o canto oposto da sala saiu do lugar na tela)`,
      )
      .toBe(true)
  })
}
