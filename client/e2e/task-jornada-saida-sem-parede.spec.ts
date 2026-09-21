// JORNADA DA SAÍDA SEM PAREDE — escrita para SAIR VERMELHA hoje.
//
// A feature pedida: um VÃO ABERTO na parede da sala. Nem parede, nem porta —
// o buraco por onde se entra e se sai sem nada no caminho. Hoje a única forma
// de furar a aresta de uma sala é a ferramenta Porta, e porta é um objeto: ela
// desenha folha/portão na aresta e, fechada, ainda barra o movimento
// (`lib/collision.ts:isDoorPassable`). Não existe no editor nenhum controle que
// simplesmente TIRE a parede de um trecho e deixe passagem livre.
//
// O que esta jornada cobra, tudo no que APARECE NA TELA:
//   1. depois de abrir o vão, o pixel em cima daquele trecho da aresta deixa de
//      ser linha de parede — fica na cor de dentro da sala, não na cor da
//      parede sólida ao lado;
//   2. a ficha arrastada pelo ponteiro ATRAVESSA esse trecho: ela é largada do
//      lado de fora e o pixel de lá muda;
//   3. no MESMO gesto, num trecho da mesma aresta que continua com parede, a
//      ficha NÃO passa: o pixel do destino fica como estava.
//
// A prova 3 sozinha seria um teto que um app morto cumpriria (ninguém arrasta
// nada, nada muda, o teto aprova). Por isso ela vem DEPOIS da prova 2, no mesmo
// teste: o mesmo gesto já provou que arrasta e que atravessa.
//
// GEOMETRIA (px de mundo = px do canvas, câmera 1:1 como nos specs irmãos;
// grade de 64 px, mapa novo nasce SEM grade desenhada — `mapFactory.ts:21`):
//   sala de (320,256) a (832,576); a aresta de cima vai de x=320 a x=832.
//   x=544 e x=416 são centros de célula (32 + 64k), então a ficha arrastada
//   para lá assenta exatamente em cima deles (`applySnap(..., 'token')`).
//   y=288 é a primeira fileira DENTRO da sala; y=224, a primeira FORA.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Aresta de cima da sala. */
const ARESTA_Y = 256
/** Onde o vão é aberto — centro de célula, para a ficha assentar em cima dele. */
const X_VAO = 544
/** Trecho da MESMA aresta que continua sólido: é a calibração de cor e o teto da prova 3. */
const X_PAREDE = 416
/** Fileira de células logo dentro da sala. */
const Y_DENTRO = 288
/** Fileira de células logo fora da sala. */
const Y_FORA = 224
/**
 * Chão limpo, com que a parede contrasta — uma fileira ABAIXO do meio da sala.
 *
 * Era 416, o centro exato, e em 21/09/2026 isso passou a medir a coisa errada: a
 * etiqueta em pílula do nome da sala (`pixi/drawRoomNames.ts`) ocupa ~104x32 px
 * bem no centro, e a amostra lia a plaqueta (luma 193) achando que era chão. A
 * calibração então reprovava — `parede sólida=210, vão=132, chão=193` — com a
 * feature funcionando: o 132 é o traço tendo sumido no trecho do vão.
 *
 * Quem estava errada era a régua, não a obra, e o conserto é medir chão onde há
 * chão. 480 continua sendo centro de célula (32 + 64k) e fica dentro da sala,
 * longe da plaqueta e longe da aresta de baixo (576).
 */
const Y_CHAO = 480
const SALA = { x1: 320, y1: ARESTA_Y, x2: 832, y2: 576 }
/** Canto vazio do canvas, fora da sala: clique que tira a seleção antes de fotografar. */
const VAZIO = { x: 1150, y: 720 }
/** Botão parado antes de soltar. Abaixo disso o arrasto vira clique em muito toolkit. */
const PAUSA_MS = 180
/** Folga para o Pixi terminar de pintar antes da foto. */
const PINTURA_MS = 400
/** Quanto a cor precisa mudar num ponto para contar como "apareceu/sumiu coisa ali". */
const MUDANCA_DE_COR = 24

/**
 * Como o vão pode se chamar na interface. A jornada NÃO dita a implementação:
 * serve rádio no painel da Porta, item na setinha de opções ou ferramenta
 * própria na barra — o que ela cobra é que exista um controle com este nome e
 * que ele produza passagem livre. Nenhum controle do editor de hoje casa com
 * isto (conferido em 20/09/2026), então é aqui que a jornada sai vermelha.
 */
const NOME_DO_VAO = /v[ãa]o|abertura|passagem|sa[íi]da/i

/** O tipo da foto vem da própria API: o tsconfig dos e2e não carrega os tipos do Node. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

interface Ponto {
  x: number
  y: number
}

interface Amostra {
  /** Maior luminância de uma janela 7x7 em volta do ponto: a linha da parede tem
   *  1-3 px de tela e pode cair meio pixel para qualquer lado (pixelAlign.ts). */
  luz: number
  /** Cor do pixel central, para comparar duas fotos do mesmo ponto. */
  rgb: [number, number, number]
}

/**
 * Lê pixels da FOTO do canvas — o que o usuário vê —, decodificando o PNG no
 * próprio navegador num canvas 2D descartável. Só LEITURA: nada do app é
 * tocado (mesmo helper de `task-jornada-porta-sem-buraco.spec.ts`).
 */
async function amostrar(page: Page, foto: Foto, larguraCss: number, pontos: Ponto[]): Promise<Amostra[]> {
  return page.evaluate(
    async ({ b64, larguraCss, pontos }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escala = bmp.width / larguraCss
      const em = (x: number, y: number): [number, number, number] => {
        const cx = Math.min(width - 1, Math.max(0, Math.round(x)))
        const cy = Math.min(height - 1, Math.max(0, Math.round(y)))
        const i = (cy * width + cx) * 4
        return [data[i], data[i + 1], data[i + 2]]
      }
      return pontos.map((p) => {
        const px = p.x * escala
        const py = p.y * escala
        let luz = 0
        for (let dy = -3; dy <= 3; dy += 1) {
          for (let dx = -3; dx <= 3; dx += 1) {
            const [r, g, b] = em(px + dx, py + dy)
            luz = Math.max(luz, 0.299 * r + 0.587 * g + 0.114 * b)
          }
        }
        return { luz: Math.round(luz), rgb: em(px, py) }
      })
    },
    { b64: foto.toString('base64'), larguraCss, pontos },
  )
}

async function fotoDoCanvas(page: Page): Promise<{ foto: Foto; largura: number }> {
  const canvas = page.locator('canvas')
  const caixa = await canvas.boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return { foto: await canvas.screenshot(), largura: caixa.width }
}

const distanciaCor = (a: [number, number, number], b: [number, number, number]): number =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))

/** Cor de um único ponto do canvas, agora. */
async function corEm(page: Page, ponto: Ponto): Promise<[number, number, number]> {
  const { foto, largura } = await fotoDoCanvas(page)
  const [amostra] = await amostrar(page, foto, largura, [ponto])
  return amostra.rgb
}

/** Todo nome acessível de controle na tela — só para a falha dizer o que EXISTE hoje. */
async function nomesDeControleNaTela(page: Page): Promise<string[]> {
  return page
    .locator('button, [role="radio"], [role="menuitemradio"], [role="checkbox"], [role="tab"]')
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => elemento.getAttribute('aria-label') ?? elemento.textContent?.trim() ?? '')
        .filter((nome) => nome !== ''),
    )
}

/**
 * Um controle com este nome acessível, em qualquer papel plausível (barra usa
 * `button` com `aria-label`, painel de ferramenta usa `radio`, setinha de
 * variantes usa `menuitemradio`). Falha listando o que a tela oferece hoje.
 */
async function controlePorNome(page: Page, nome: RegExp, oQueEra: string): Promise<Locator> {
  const alvo = page
    .getByRole('button', { name: nome })
    .or(page.getByRole('radio', { name: nome }))
    .or(page.getByRole('menuitemradio', { name: nome }))
    .or(page.getByRole('checkbox', { name: nome }))
    .or(page.getByRole('tab', { name: nome }))
  const quantos = await alvo.count()
  if (quantos === 0) {
    const existentes = await nomesDeControleNaTela(page)
    expect(
      quantos,
      `${oQueEra}: nenhum controle com nome ${String(nome)} na tela. O que a tela oferece hoje: ${existentes.join(' | ')}`,
    ).toBeGreaterThan(0)
  }
  return alvo.first()
}

async function ferramenta(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: nome, exact: true }).click()
}

/** Caixa do `<canvas>` do editor (os painéis flutuam por cima dele). */
async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

/**
 * Arrasto de pessoa: pega, espera o "pegar" registrar, caminha em passos,
 * PARA em cima do destino e só então solta.
 */
async function arrastarComoPessoa(page: Page, caixa: { x: number; y: number }, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(caixa.x + de.x, caixa.y + de.y)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.move(caixa.x + (de.x + para.x) / 2, caixa.y + (de.y + para.y) / 2, { steps: 8 })
  await page.mouse.move(caixa.x + para.x, caixa.y + para.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/** Desenha a sala arrastando, como o mestre faz, e tira o campo de nome da frente. */
async function desenharSala(page: Page, caixa: { x: number; y: number }): Promise<void> {
  await ferramenta(page, 'Sala')
  await page.mouse.move(caixa.x + SALA.x1, caixa.y + SALA.y1)
  await page.mouse.down()
  await page.mouse.move(caixa.x + SALA.x2, caixa.y + SALA.y2, { steps: 10 })
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.up()
  // O campo de nome nasce em cima da Sala e rouba o foco: Esc mantém o padrão.
  const nome = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await expect(nome, 'a Sala não foi criada: o campo de nome dela nem apareceu').toBeVisible({ timeout: 5000 })
  await nome.press('Escape')
}

/**
 * Coloca a ficha pelo caminho do painel ("Adicionar token"), que é o único
 * caminho de interface hoje — a ferramenta Token está escondida por
 * `FEATURES.tokenTool`. A peça nasce no CENTRO DA VISTA (`App.tsx:criarToken`
 * com `viewportCenterWorld`), então é de lá que os arrastos partem.
 */
async function colocarFicha(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  const campo = page.getByLabel('Nome do novo token')
  await campo.click()
  await campo.pressSequentially(nome, { delay: 15 })
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Apagar token selecionado' }),
    'a ficha não entrou no mapa: o painel não mostra nada de token selecionado',
  ).toBeVisible({ timeout: 5000 })
}

/** Tira a seleção para que nenhum realce entre nas amostras de cor. */
async function limparSelecao(page: Page, caixa: { x: number; y: number }): Promise<void> {
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(caixa.x + VAZIO.x, caixa.y + VAZIO.y)
  await page.waitForTimeout(PINTURA_MS)
}

/**
 * Abre o VÃO na aresta, pelo caminho que o mestre tentaria: a ferramenta que
 * fura parede (Porta), a setinha de opções dela se existir, e o controle do
 * vão. É aqui que a jornada morde hoje — esse controle não existe.
 */
async function abrirVaoNaParede(page: Page, caixa: { x: number; y: number }, onde: Ponto): Promise<void> {
  await ferramenta(page, 'Porta')
  const setinha = page.getByRole('button', { name: 'Opções de Porta', exact: true })
  if ((await setinha.count()) > 0) await setinha.first().click()
  const controle = await controlePorNome(page, NOME_DO_VAO, 'controle do vão aberto — nem parede, nem porta')
  await controle.click()
  await page.mouse.click(caixa.x + onde.x, caixa.y + onde.y)
  await page.waitForTimeout(PINTURA_MS)
}

test('CONTROLE POSITIVO: o mapa abre, a sala se desenha e a ficha se move dentro dela', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  // Sem isto, todas as coordenadas desta jornada estariam fora do desenho e a
  // leitura de pixel não significaria nada.
  expect(
    Math.min(caixa.width, caixa.height),
    `o canvas veio ${Math.round(caixa.width)}x${Math.round(caixa.height)}: a sala desta jornada (até 832x576) não cabe nele`,
  ).toBeGreaterThan(600)

  await desenharSala(page, caixa)
  await limparSelecao(page, caixa)

  // A sala APARECE: a linha da parede é mais clara que o chão de dentro.
  const { foto, largura } = await fotoDoCanvas(page)
  const [parede, chao] = await amostrar(page, foto, largura, [
    { x: X_PAREDE, y: ARESTA_Y },
    { x: X_VAO, y: Y_CHAO },
  ])
  expect(
    parede.luz - chao.luz,
    `a sala não aparece desenhada: parede em x=${X_PAREDE} deu ${parede.luz} e o chão deu ${chao.luz}`,
  ).toBeGreaterThan(30)

  await colocarFicha(page, 'Pe')
  // A peça nasce no centro da vista; é de lá que ela é arrastada.
  const origem = { x: Math.round(caixa.width / 2), y: Math.round(caixa.height / 2) }
  expect(
    origem.x > SALA.x1 && origem.x < SALA.x2 && origem.y > SALA.y1 && origem.y < SALA.y2,
    `a ficha nasceu em (${origem.x}, ${origem.y}), fora da sala (${SALA.x1}..${SALA.x2}, ${SALA.y1}..${SALA.y2})`,
  ).toBe(true)

  await limparSelecao(page, caixa)
  const destino = { x: X_VAO, y: Y_DENTRO }
  const antes = await corEm(page, destino)

  await arrastarComoPessoa(page, caixa, origem, destino)

  const depois = await corEm(page, destino)
  expect(
    distanciaCor(antes, depois),
    `a ficha não se moveu dentro da sala: a cor em (${destino.x}, ${destino.y}) continuou ${antes.join(',')}`,
  ).toBeGreaterThan(MUDANCA_DE_COR)

  expect(erros, 'o editor jogou erro no controle positivo').toEqual([])
})

test('a ficha atravessa o vão aberto na parede, e não atravessa o trecho que ainda tem parede', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  await desenharSala(page, caixa)
  await colocarFicha(page, 'Pe')
  const origem = { x: Math.round(caixa.width / 2), y: Math.round(caixa.height / 2) }

  // ---------------------------------------------------------------------
  // O VÃO, aberto pela interface.
  // ---------------------------------------------------------------------
  await abrirVaoNaParede(page, caixa, { x: X_VAO, y: ARESTA_Y })
  await limparSelecao(page, caixa)

  // ---------------------------------------------------------------------
  // PROVA 1 — na tela, aquele trecho da aresta deixou de ser parede.
  // ---------------------------------------------------------------------
  const { foto, largura } = await fotoDoCanvas(page)
  const [solido, vao, chao] = await amostrar(page, foto, largura, [
    { x: X_PAREDE, y: ARESTA_Y },
    { x: X_VAO, y: ARESTA_Y },
    { x: X_VAO, y: Y_CHAO },
  ])
  const leitura = `parede sólida=${solido.luz}, vão=${vao.luz}, chão=${chao.luz}`
  // Calibração: sem contraste entre parede e chão, a prova abaixo passaria à toa.
  expect(solido.luz - chao.luz, `a foto não distingue parede de chão (${leitura})`).toBeGreaterThan(30)
  expect(
    vao.luz,
    `ainda há linha de parede em cima do vão, em x=${X_VAO}, y=${ARESTA_Y} (${leitura}): o vão não abriu buraco nenhum`,
  ).toBeLessThan(chao.luz + (solido.luz - chao.luz) * 0.4)

  // ---------------------------------------------------------------------
  // PISO — o mesmo gesto move a ficha dentro da sala. Sem este piso, a prova 3
  // ("não passou") seria cumprida por um app que não arrasta nada.
  // ---------------------------------------------------------------------
  const dentroDoVao = { x: X_VAO, y: Y_DENTRO }
  const antesDeDentro = await corEm(page, dentroDoVao)
  await arrastarComoPessoa(page, caixa, origem, dentroDoVao)
  expect(
    distanciaCor(antesDeDentro, await corEm(page, dentroDoVao)),
    `PISO: o arrasto não moveu a ficha nem dentro da sala, até (${dentroDoVao.x}, ${dentroDoVao.y})`,
  ).toBeGreaterThan(MUDANCA_DE_COR)

  // ---------------------------------------------------------------------
  // PROVA 2 — a ficha ATRAVESSA o vão e aparece do lado de fora.
  // ---------------------------------------------------------------------
  const foraPeloVao = { x: X_VAO, y: Y_FORA }
  const antesDeFora = await corEm(page, foraPeloVao)
  await arrastarComoPessoa(page, caixa, dentroDoVao, foraPeloVao)
  expect(
    distanciaCor(antesDeFora, await corEm(page, foraPeloVao)),
    `a ficha não saiu pelo vão: a cor em (${foraPeloVao.x}, ${foraPeloVao.y}), fora da sala, continuou ${antesDeFora.join(',')}`,
  ).toBeGreaterThan(MUDANCA_DE_COR)

  // ---------------------------------------------------------------------
  // PROVA 3 — no trecho que continua com parede, a mesma ficha NÃO passa.
  // Ela caminha por fora até em frente ao trecho sólido e tenta entrar.
  // ---------------------------------------------------------------------
  const dentroDaParede = { x: X_PAREDE, y: Y_DENTRO }
  const antesDaParede = await corEm(page, dentroDaParede)
  const foraDaParede = { x: X_PAREDE, y: Y_FORA }
  await arrastarComoPessoa(page, caixa, foraPeloVao, foraDaParede)
  await arrastarComoPessoa(page, caixa, foraDaParede, dentroDaParede)
  expect(
    distanciaCor(antesDaParede, await corEm(page, dentroDaParede)),
    `a ficha entrou por cima da parede sólida em x=${X_PAREDE}: abrir o vão em x=${X_VAO} furou a aresta inteira`,
  ).toBeLessThan(MUDANCA_DE_COR)

  expect(erros, 'o editor jogou erro ao abrir o vão ou ao atravessá-lo').toEqual([])
})
