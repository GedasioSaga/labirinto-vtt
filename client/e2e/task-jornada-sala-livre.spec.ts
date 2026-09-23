// JORNADA — "quero uma Sala com o formato que eu desenhar, canto a canto".
//
// O mestre desenha a masmorra à mão: o cômodo quase nunca é um retângulo nem
// um polígono regular. Hoje a barra só oferece Sala (1 arrasto = retângulo,
// lib/drawingFactory.ts:115) e Sala Circular / Polígono Regular (centro +
// raio, drawingFactory.ts:195). O desenho canto a canto existe — mas só na
// ferramenta Região (pixi/PixiCanvas.tsx:2899), e Região NÃO faz parede, não
// aceita porta e não é Sala.
//
// O que esta jornada cobra é a ferramenta que falta, pelo nome que o usuário
// leria na barra ("Sala livre"): clicar os cantos, fechar, e ter uma SALA de
// verdade — com parede em TODOS os lados, bloqueando token, com o painel de
// Sala (não o de Região) e com o rascunho desfazível ponto a ponto.
//
// TUDO é provado pela TELA: o gesto é ponteiro e teclado de verdade (com pausa
// antes de soltar), e a asserção é pixel do canvas ou DOM visível. Nada de
// `addRegion`/`setState` para chegar no que se prova — o único uso da store é
// pôr um token em cena no teste 2, porque a ferramenta Token está escondida
// por feature flag (FEATURES.tokenTool); o gesto julgado lá é o ARRASTO.
//
// VERMELHO ESPERADO HOJE: a ferramenta não existe, então `abrirSalaLivre`
// falha em `toBeVisible` com o nome procurado. É a falha honesta — ausência.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

test.use({ trace: 'off', video: 'off' })

/** Coluna da esquerda (PropertiesPanel) — o corpo rolável, sem o cabeçalho. */
const PAINEL = '.lb-inspector__body'

/**
 * Como o usuário acharia a ferramenta na barra. Regex (e não texto exato) de
 * propósito: quem implementar pode chamá-la "Sala livre", "Sala Livre" ou
 * "Sala de formato livre" — a jornada cobra a FERRAMENTA, não o rótulo exato.
 */
const NOME_DA_FERRAMENTA = /sala\s+(de\s+formato\s+)?livre/i

/**
 * Os 5 cantos da sala de formato livre — irregular de propósito: não é
 * retângulo (a ferramenta Sala já faz) nem polígono regular (Sala Circular já
 * faz). Nenhuma aresta é horizontal ou vertical pura, então a colisão do teste
 * 2 é contra parede INCLINADA. Coordenadas do mundo = offset do canvas
 * (câmera 1:1, como nos demais specs) e x > 240 para fugir do painel esquerdo.
 */
const CANTOS = [
  { x: 384, y: 192 },
  { x: 704, y: 224 },
  { x: 768, y: 448 },
  { x: 512, y: 544 },
  { x: 320, y: 384 },
]

/** Meio de cada uma das 5 arestas — onde tem de haver pixel de parede. */
const MEIOS_DAS_ARESTAS = [
  { x: 544, y: 208, aresta: '1 (384,192)→(704,224)' },
  { x: 736, y: 336, aresta: '2 (704,224)→(768,448)' },
  { x: 640, y: 496, aresta: '3 (768,448)→(512,544)' },
  { x: 416, y: 464, aresta: '4 (512,544)→(320,384)' },
  { x: 352, y: 288, aresta: '5 (320,384)→(384,192)' },
]

/**
 * Chão da sala — a cor do "fundo", a ~105px da aresta mais próxima. Fica uma
 * célula ABAIXO do centróide (543, 356) de propósito: é no centróide que o app
 * ancora o rótulo branco da Sala (drawRoomNames.ts, `roomLabelAnchor`), e como
 * a amostra é a luminância MÁXIMA de uma janela 7x7, o glifo saturaria a
 * leitura e o chão passaria por parede.
 */
const DENTRO = { x: 544, y: 416 }
/** Bem LONGE da sala, canvas vazio: o controle positivo do teste 1. */
const LONGE = { x: 1056, y: 608 }
/** Canto vazio para tirar a seleção antes de fotografar (realce não entra na amostra). */
const VAZIO = { x: 1120, y: 700 }

/** O que `locator.screenshot()` devolve — sem @types/node nos e2e, o tipo vem da API. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

interface Amostra {
  /** Maior luminância de uma janela 7x7 em volta do ponto: a linha da parede
   *  tem 1-3px de tela e pode cair meio pixel para qualquer lado. */
  luz: number
  /** Cor do pixel central, para comparar duas fotos do mesmo ponto. */
  rgb: [number, number, number]
}

/**
 * Lê pixels da FOTO do canvas (o que o usuário vê), decodificando o PNG com o
 * próprio decodificador do navegador num canvas 2D descartável — nenhum estado
 * do app é lido ou tocado.
 */
async function amostrar(
  page: Page,
  foto: Foto,
  larguraCss: number,
  pontos: { x: number; y: number }[],
): Promise<Amostra[]> {
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
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { foto: await canvas.screenshot(), largura: box.width }
}

const distanciaCor = (a: [number, number, number], b: [number, number, number]): number =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))

/** Pixel de parede = mais claro que o fundo em pelo menos 60% do contraste medido. */
const limiarDeParede = (fundo: number, referencia: number): number => fundo + (referencia - fundo) * 0.6

/**
 * Ativa a ferramenta de Sala livre pelo botão da barra — o caminho do usuário.
 * É AQUI que a jornada fica vermelha hoje: nenhum botão da barra tem esse nome.
 */
async function abrirSalaLivre(page: Page): Promise<void> {
  const botao = page.getByRole('button', { name: NOME_DA_FERRAMENTA }).first()
  await expect(
    botao,
    'A barra não tem nenhuma ferramenta chamada "Sala livre" (procurado por ' +
      String(NOME_DA_FERRAMENTA) +
      '). Hoje só existem Sala (1 arrasto = retângulo), Sala Circular e Polígono Regular; ' +
      'desenhar canto a canto só existe na Região, que não faz parede nem é Sala.',
  ).toBeVisible({ timeout: 5000 })
  await botao.click()
  await expect(botao, 'a ferramenta de Sala livre não ficou apertada depois do clique').toHaveAttribute(
    'aria-pressed',
    'true',
  )
}

/** Um clique de canto: ponteiro de verdade, com pausa antes de soltar. */
async function clicarCanto(page: Page, box: { x: number; y: number }, ponto: { x: number; y: number }): Promise<void> {
  await page.mouse.move(box.x + ponto.x, box.y + ponto.y)
  await page.mouse.down()
  await page.waitForTimeout(60)
  await page.mouse.up()
  await page.waitForTimeout(60)
}

/**
 * Fecha o traçado ponto a ponto com Enter — a MESMA saída que a Região já tem
 * (`finishRegion`, pixi/PixiCanvas.tsx:4071), e a que a mão do usuário bateu no
 * passeio cego de 16/09/2026.
 */
async function fecharTracado(page: Page): Promise<void> {
  await page.keyboard.press('Enter')
  await page.waitForTimeout(120)
}

/**
 * Logo depois de nascer, a Sala pede o nome num campo sobre o próprio mapa
 * (pixi/PixiCanvas.tsx) e esse campo rouba o foco — Esc mantém o nome padrão e
 * devolve o teclado ao canvas. Se o campo não aparecer, segue em frente.
 */
async function dispensarCampoDeNomeSobreOMapa(page: Page): Promise<void> {
  const campo = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  const apareceu = await campo.waitFor({ state: 'visible', timeout: 1500 }).then(
    () => true,
    () => false,
  )
  if (apareceu) await campo.press('Escape')
}

/** Desenha a sala de formato livre de ponta a ponta, como o mestre faria. */
async function desenharSalaLivre(page: Page, cantos: { x: number; y: number }[]) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await abrirSalaLivre(page)
  for (const canto of cantos) await clicarCanto(page, box, canto)
  await fecharTracado(page)
  return box
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  // Mapa limpo: a foto do canvas tem de ter só o que a jornada desenhou.
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.loadMap(mapFactory.createEmptyMap('map_e2e_sala_livre', 'E2E Sala livre', 30, 20, 64))
    store.setActiveTool('select')
  })
})

// ---------------------------------------------------------------------------
// 1. O contorno fechado — parede em TODOS os lados, inclusive nos inclinados.
// ---------------------------------------------------------------------------
test('1. clicar 5 cantos e fechar desenha parede em TODAS as arestas da sala', async ({ page }) => {
  const box = await desenharSalaLivre(page, CANTOS)
  await dispensarCampoDeNomeSobreOMapa(page)
  // Tira a seleção: o realce da sala recém-criada não pode entrar na amostra.
  await page.mouse.click(box.x + VAZIO.x, box.y + VAZIO.y)
  await page.waitForTimeout(120)

  const { foto, largura } = await fotoDoCanvas(page)
  const amostras = await amostrar(page, foto, largura, [DENTRO, LONGE, ...MEIOS_DAS_ARESTAS])
  const [dentro, longe] = amostras
  const arestas = amostras.slice(2)

  // Calibração: a foto precisa distinguir parede de chão. A referência é a
  // aresta mais clara — se NENHUMA aresta virou parede, não há contraste e a
  // calibração já reprova, que é o vermelho honesto.
  const referencia = Math.max(...arestas.map((a) => a.luz))
  const leitura = `dentro=${dentro.luz}, longe=${longe.luz}, arestas=[${arestas.map((a) => a.luz).join(', ')}]`
  expect(
    referencia - dentro.luz,
    `nenhum contorno de parede apareceu na tela em volta da sala desenhada (${leitura})`,
  ).toBeGreaterThan(30)

  const limiar = limiarDeParede(dentro.luz, referencia)
  for (let i = 0; i < arestas.length; i += 1) {
    const meio = MEIOS_DAS_ARESTAS[i]
    expect(
      arestas[i].luz,
      `a aresta ${meio.aresta} ficou SEM parede na tela em x=${meio.x}, y=${meio.y} (${leitura})`,
    ).toBeGreaterThan(limiar)
  }

  // CONTROLE POSITIVO do detector: um ponto bem longe da sala continua sem
  // parede. Sem isso, um canvas inteiro claro aprovaria as 5 asserções acima.
  expect(
    longe.luz,
    `o detector acha parede até LONGE da sala, em x=${LONGE.x}, y=${LONGE.y} — a medida acima não vale nada (${leitura})`,
  ).toBeLessThan(limiar)
})

// ---------------------------------------------------------------------------
// 2. A parede inclinada bloqueia mesmo — é Sala, não Região.
// ---------------------------------------------------------------------------
test('2. a sala de formato livre segura o token na parede inclinada', async ({ page }) => {
  const box = await desenharSalaLivre(page, CANTOS)
  await dispensarCampoDeNomeSobreOMapa(page)
  await page.mouse.click(box.x + VAZIO.x, box.y + VAZIO.y)

  // Token de cenário pela store: a ferramenta Token está escondida por feature
  // flag (FEATURES.tokenTool). O GESTO sob teste é o arrasto abaixo.
  await page.evaluate(async () => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.addToken({ id: 'tk_sala_livre', characterId: null, name: 'Pé', x: 672, y: 352, size: 1, image: null })
    store.setSelection([])
  })

  const arrastar = async (de: { x: number; y: number }, para: { x: number; y: number }) => {
    await page.mouse.move(box.x + de.x, box.y + de.y)
    await page.mouse.down()
    await page.mouse.move(box.x + para.x, box.y + para.y, { steps: 12 })
    await page.waitForTimeout(150)
    await page.mouse.up()
    await page.waitForTimeout(150)
  }

  // CONTROLE POSITIVO — sem ele o teto abaixo aprova um app que simplesmente
  // não arrasta token nenhum: nada muda na tela, o delta é 0, e o teste diria
  // "a parede segurou" quando o ponteiro não moveu nada.
  const livre = { x: 544, y: 416 } // dentro da sala, longe de qualquer aresta
  const antesDoControle = await fotoDoCanvas(page)
  const [livreAntes] = await amostrar(page, antesDoControle.foto, antesDoControle.largura, [livre])

  await arrastar({ x: 672, y: 352 }, livre)

  const depoisDoControle = await fotoDoCanvas(page)
  const [livreDepois] = await amostrar(page, depoisDoControle.foto, depoisDoControle.largura, [livre])
  expect(
    distanciaCor(livreAntes.rgb, livreDepois.rgb),
    `CONTROLE POSITIVO: o arrasto não moveu o token nem para um destino LIVRE dentro da sala (x=${livre.x}, y=${livre.y}). Sem este piso, o teto abaixo aprovaria um app que não arrasta.`,
  ).toBeGreaterThan(24)

  // A DOR — o mesmo gesto atravessando a aresta inclinada (704,224)→(768,448)
  // não pode depositar o token do lado de fora.
  const fora = { x: 800, y: 352 }
  const antes = await fotoDoCanvas(page)
  const [foraAntes] = await amostrar(page, antes.foto, antes.largura, [fora])

  await arrastar(livre, fora)

  const depois = await fotoDoCanvas(page)
  const [foraDepois] = await amostrar(page, depois.foto, depois.largura, [fora])
  expect(
    distanciaCor(foraAntes.rgb, foraDepois.rgb),
    `o token atravessou a parede inclinada e apareceu FORA da sala em x=${fora.x}, y=${fora.y}: a cor mudou de ${foraAntes.rgb.join(',')} para ${foraDepois.rgb.join(',')}`,
  ).toBeLessThan(24)
})

// ---------------------------------------------------------------------------
// 3. O painel diz SALA e deixa dar nome — não é uma Região disfarçada.
// ---------------------------------------------------------------------------
test('3. o painel da sala recém-criada diz SALA e aceita um nome', async ({ page }) => {
  await desenharSalaLivre(page, CANTOS)
  await dispensarCampoDeNomeSobreOMapa(page)

  // O que o usuário lê primeiro na coluna da esquerda. `innerText` (e não
  // `textContent`) porque é o texto RENDERIZADO, já com o caixa-alta do CSS.
  const primeiroTitulo = page.locator(`${PAINEL} h2:visible`).first()
  await expect(
    primeiroTitulo,
    'a coluna da esquerda não mostrou nenhum título depois de fechar a sala de formato livre',
  ).toBeVisible()
  const visto = (await primeiroTitulo.innerText())
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  expect(
    visto,
    `o painel da sala recém-desenhada abre com o título "${visto}" — o usuário desenhou uma SALA e a tela diz outra coisa`,
  ).toContain('sala')

  // E dá nome pelo painel, digitando de verdade.
  const campoNome = page.locator(PAINEL).getByLabel('Nome', { exact: true })
  await expect(campoNome, 'o painel da sala de formato livre não tem campo de Nome').toBeVisible()
  await campoNome.click()
  await campoNome.press('Control+a')
  await campoNome.pressSequentially('Cripta torta', { delay: 30 })
  await expect(campoNome, 'o nome digitado não ficou no campo do painel').toHaveValue('Cripta torta')
})

// ---------------------------------------------------------------------------
// 4. Desfazer no rascunho tira só o último canto — e não come a sala anterior.
// ---------------------------------------------------------------------------
test('4. Backspace e Ctrl+Z no rascunho tiram só o último canto, sem apagar a sala anterior', async ({ page }) => {
  // Primeira sala, a que NÃO pode sumir.
  const box = await desenharSalaLivre(page, CANTOS)
  await dispensarCampoDeNomeSobreOMapa(page)

  // Segunda sala, com dois cantos errados descartados no meio do caminho.
  const SEGUNDA = [
    { x: 860, y: 200 },
    { x: 1060, y: 240 },
    { x: 1120, y: 440 },
    { x: 900, y: 480 },
  ]
  const ERRADO_BACKSPACE = { x: 992, y: 608 }
  const ERRADO_CTRL_Z = { x: 864, y: 672 }

  await abrirSalaLivre(page)
  await clicarCanto(page, box, SEGUNDA[0])
  await clicarCanto(page, box, SEGUNDA[1])
  await clicarCanto(page, box, ERRADO_BACKSPACE)
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(80)
  await clicarCanto(page, box, SEGUNDA[2])
  await clicarCanto(page, box, ERRADO_CTRL_Z)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(80)
  await clicarCanto(page, box, SEGUNDA[3])
  await fecharTracado(page)
  await dispensarCampoDeNomeSobreOMapa(page)
  await page.mouse.click(box.x + VAZIO.x, box.y + VAZIO.y)
  await page.waitForTimeout(120)

  /** Fundo vazio embaixo das duas salas — a régua do que é "sem parede". */
  const FUNDO = { x: 416, y: 672 }
  /** Meio de uma aresta da segunda sala: prova que ELA nasceu. */
  const MEIO_DA_SEGUNDA = { x: 1090, y: 340 }

  const { foto, largura } = await fotoDoCanvas(page)
  const amostras = await amostrar(page, foto, largura, [
    FUNDO,
    DENTRO,
    MEIO_DA_SEGUNDA,
    ERRADO_BACKSPACE,
    ERRADO_CTRL_Z,
    ...MEIOS_DAS_ARESTAS,
  ])
  const [fundo, dentro, meioDaSegunda, erradoBackspace, erradoCtrlZ] = amostras
  const arestasDaPrimeira = amostras.slice(5)

  const referencia = Math.max(...arestasDaPrimeira.map((a) => a.luz), meioDaSegunda.luz)
  const leitura =
    `fundo=${fundo.luz}, dentro da 1ª=${dentro.luz}, 2ª sala=${meioDaSegunda.luz}, ` +
    `arestas da 1ª=[${arestasDaPrimeira.map((a) => a.luz).join(', ')}], ` +
    `canto do Backspace=${erradoBackspace.luz}, canto do Ctrl+Z=${erradoCtrlZ.luz}`
  expect(referencia - fundo.luz, `nenhuma parede na tela depois dos dois desenhos (${leitura})`).toBeGreaterThan(30)

  const limiar = limiarDeParede(fundo.luz, referencia)

  // A primeira sala continua inteira: desfazer ponto de rascunho não é desfazer mapa.
  for (let i = 0; i < arestasDaPrimeira.length; i += 1) {
    const meio = MEIOS_DAS_ARESTAS[i]
    expect(
      arestasDaPrimeira[i].luz,
      `Backspace/Ctrl+Z no rascunho da segunda sala apagou a aresta ${meio.aresta} da PRIMEIRA sala (${leitura})`,
    ).toBeGreaterThan(limiar)
  }

  // A segunda sala existe — sem isso, "os cantos errados não deixaram traço"
  // passaria com um app que não desenha nada.
  expect(
    meioDaSegunda.luz,
    `a segunda sala não apareceu na tela em x=${MEIO_DA_SEGUNDA.x}, y=${MEIO_DA_SEGUNDA.y} (${leitura})`,
  ).toBeGreaterThan(limiar)

  // E os dois cantos descartados não viraram parede em lugar nenhum.
  expect(
    erradoBackspace.luz,
    `o canto descartado com Backspace (x=${ERRADO_BACKSPACE.x}, y=${ERRADO_BACKSPACE.y}) continuou no polígono (${leitura})`,
  ).toBeLessThan(limiar)
  expect(
    erradoCtrlZ.luz,
    `o canto descartado com Ctrl+Z (x=${ERRADO_CTRL_Z.x}, y=${ERRADO_CTRL_Z.y}) continuou no polígono (${leitura})`,
  ).toBeLessThan(limiar)
})
