// Jornada de usuário: "desenhei o cômodo, aproximei a vista e cliquei em
// 'Adicionar token'. A peça nasceu ATRAVESSANDO a parede — metade dentro,
// metade fora — e o app não disse nada."
//
// Achado no passeio cego. A causa está em `src/App.tsx:926-931`
// (`handleAddToken`): a linha 928 escolhe o ponto com
// `at ?? viewportCenterWorld(camera, host.clientWidth, host.clientHeight)` e
// o `addToken` da linha seguinte aceita esse ponto sem perguntar nada. As duas
// funções que sabem responder — `moveCrossesWall` (src/lib/collision.ts:40) e
// `resolveTokenMove` (:99) — só são chamadas ao MOVER token; nascer não passa
// por elas.
//
// O QUE ESTA JORNADA PROVA, TUDO PELA TELA (nenhuma asserção lê `mapStore`):
//  1. o usuário desenha um cômodo, aproxima com a RODA (ancorada no ponteiro)
//     e arrasta com o BOTÃO DO MEIO até o centro da vista cair em cima da
//     linha da parede — e isso é conferido no pixel, não na câmera da store;
//  2. clica "Adicionar token" e confirma o nome;
//  3. o disco do token que apareceu na tela não pode ter NENHUM pixel da cor
//     da parede dentro dele;
//  4. se o app não criar peça nenhuma (não achou lugar livre), então ele tem
//     de DIZER isso na tela.
//
// POR QUE A CONTAGEM DE PAREDE SAI DA FOTO DE ANTES: o `tokensContainer` é
// adicionado ao `world` DEPOIS do `wallsGraphics` (src/pixi/PixiCanvas.tsx:517
// em diante), então o disco do token é pintado POR CIMA da parede e esconde
// exatamente os pixels que interessam. A câmera não se mexe entre as duas
// fotos (criar token não mexe em câmera), então a mesma região de tela vale
// para as duas: o disco é medido na foto DEPOIS, e os pixels de parede que
// caem dentro dele são contados na foto ANTES. "Quanto de parede a peça
// cobriu" é a pergunta, e é essa a resposta honesta.
//
// A COR DA PAREDE NÃO É CHUTE NEM CONSTANTE COPIADA: ela é lida da própria
// tela, no pixel mais claro de uma faixa fina em cima da linha que o usuário
// acabou de desenhar, longe do token, e com NADA selecionado (o painel mostra
// "Nada selecionado" na hora da foto — então não existe realce de seleção na
// tela para confundir com parede). O teste `controle positivo` abaixo fecha os
// dois lados: a régua acha parede onde tem parede e acha zero no meio do chão.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

test.use({ trace: 'off', video: 'off' })

/** O que `page.screenshot()` devolve — sem @types/node no tsconfig dos e2e. */
type Foto = Awaited<ReturnType<Page['screenshot']>>
type Cor = [number, number, number]
interface Ponto {
  x: number
  y: number
}
interface Retangulo extends Ponto {
  width: number
  height: number
}
interface Disco {
  cx: number
  cy: number
  r: number
}

/** Sala desenhada com a ferramenta Sala, em px de tela = px de mundo (câmera 1:1 ao abrir). */
const SALA = { x1: 448, y1: 192, x2: 1152, y2: 576 }
/** Ponto da aresta de cima onde a jornada ancora a roda: dentro da sala e longe do painel. */
const X_ANCORA = 900
/** Um giro de roda (deltaY em px). Negativo = aproximar (`resolveMapWheel` → `zoomAt`). */
const GIRO_RODA = -200
const GIROS = 4
/** Canto vazio do canvas, fora da sala e acima do HUD de zoom (canto inferior direito). */
const VAZIO: Ponto = { x: 1200, y: 620 }
/** Quanto a cor de um pixel pode se afastar da cor lida da parede, por canal. */
const TOLERANCIA_COR = 20
/**
 * O disco é medido a 92% do raio. Token encostado na parede por fora (centro a
 * meia célula dela, que é o encaixe legítimo mais apertado) fica TANGENTE: a
 * linha da parede toca a borda do disco e nada mais. Os 8% (~6 px de tela
 * aqui) cobrem essa tangência e o meio-pixel de erro da estimativa do raio,
 * sem chegar perto de perdoar o que esta jornada acusa — parede cruzando o
 * MEIO do disco, de lado a lado.
 */
const FRACAO_DO_DISCO = 0.92

type Pedido =
  | { tipo: 'linha'; faixa: Retangulo }
  | { tipo: 'disco' }
  | { tipo: 'medir'; faixaCalibragem: Retangulo; discos: Disco[] }

interface RespostaLinha {
  y: number
  cor: Cor
  luz: number
}
interface RespostaDisco {
  cx: number
  cy: number
  r: number
  area: number
  larguraCaixa: number
  alturaCaixa: number
  cor: Cor
}
interface RespostaMedida {
  corParede: Cor
  contagens: number[]
  areas: number[]
}

/**
 * Lê a FOTO da tela (o que o usuário vê) decodificando o PNG com o próprio
 * decodificador do navegador num canvas 2D descartável. Não toca em nenhum
 * estado do app — só pixels. Coordenadas de entrada e saída em px CSS
 * relativos ao recorte da foto.
 */
async function analisar(page: Page, foto: Foto, larguraCss: number, pedido: Pedido) {
  return page.evaluate(
    async ({ b64, larguraCss, pedido }) => {
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
      const cor = (px: number, py: number): [number, number, number] => {
        const i = (py * width + px) * 4
        return [data[i], data[i + 1], data[i + 2]]
      }
      const luz = (c: [number, number, number]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
      const distancia = (a: [number, number, number], b: [number, number, number]) =>
        Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))

      if (pedido.tipo === 'linha') {
        const f = pedido.faixa
        const x0 = Math.max(0, Math.round(f.x * escala))
        const x1 = Math.min(width, Math.round((f.x + f.width) * escala))
        const y0 = Math.max(0, Math.round(f.y * escala))
        const y1 = Math.min(height, Math.round((f.y + f.height) * escala))
        let melhor = { y: y0, cor: cor(x0, y0), luz: -1 }
        for (let py = y0; py < y1; py += 1) {
          for (let px = x0; px < x1; px += 1) {
            const c = cor(px, py)
            const l = luz(c)
            if (l > melhor.luz) melhor = { y: py, cor: c, luz: l }
          }
        }
        return { y: melhor.y / escala, cor: melhor.cor, luz: Math.round(melhor.luz) }
      }

      if (pedido.tipo === 'disco') {
        // Pixel do token = azul dominante. O preenchimento do disco é o único
        // azul do canvas (contorno e alças de seleção são amarelos, parede é
        // bege, chão é marrom, fundo é cinza escuro) — e o teste ainda confere
        // que o borrão achado é REDONDO antes de chamá-lo de token.
        let soma = 0
        let minX = width
        let maxX = -1
        let minY = height
        let maxY = -1
        let somaR = 0
        let somaG = 0
        let somaB = 0
        for (let py = 0; py < height; py += 1) {
          for (let px = 0; px < width; px += 1) {
            const [r, g, b] = cor(px, py)
            if (b - r < 40 || b - g < 30 || b < 110) continue
            soma += 1
            somaR += r
            somaG += g
            somaB += b
            if (px < minX) minX = px
            if (px > maxX) maxX = px
            if (py < minY) minY = py
            if (py > maxY) maxY = py
          }
        }
        if (soma < 200) return null
        const larguraCaixa = (maxX - minX + 1) / escala
        const alturaCaixa = (maxY - minY + 1) / escala
        return {
          cx: (minX + maxX + 1) / 2 / escala,
          cy: (minY + maxY + 1) / 2 / escala,
          r: (larguraCaixa + alturaCaixa) / 4,
          area: soma / (escala * escala),
          larguraCaixa,
          alturaCaixa,
          cor: [Math.round(somaR / soma), Math.round(somaG / soma), Math.round(somaB / soma)] as [number, number, number],
        }
      }

      const f = pedido.faixaCalibragem
      const cx0 = Math.max(0, Math.round(f.x * escala))
      const cx1 = Math.min(width, Math.round((f.x + f.width) * escala))
      const cy0 = Math.max(0, Math.round(f.y * escala))
      const cy1 = Math.min(height, Math.round((f.y + f.height) * escala))
      let corParede = cor(cx0, cy0)
      let melhorLuz = -1
      for (let py = cy0; py < cy1; py += 1) {
        for (let px = cx0; px < cx1; px += 1) {
          const c = cor(px, py)
          const l = luz(c)
          if (l > melhorLuz) {
            melhorLuz = l
            corParede = c
          }
        }
      }
      const contagens: number[] = []
      const areas: number[] = []
      for (const disco of pedido.discos) {
        const raio = disco.r * escala
        const centroX = disco.cx * escala
        const centroY = disco.cy * escala
        let dentro = 0
        let parede = 0
        const px0 = Math.max(0, Math.floor(centroX - raio))
        const px1 = Math.min(width, Math.ceil(centroX + raio) + 1)
        const py0 = Math.max(0, Math.floor(centroY - raio))
        const py1 = Math.min(height, Math.ceil(centroY + raio) + 1)
        for (let py = py0; py < py1; py += 1) {
          for (let px = px0; px < px1; px += 1) {
            const dx = px + 0.5 - centroX
            const dy = py + 0.5 - centroY
            if (dx * dx + dy * dy > raio * raio) continue
            dentro += 1
            if (distancia(cor(px, py), corParede) <= 20) parede += 1
          }
        }
        contagens.push(Math.round(parede / (escala * escala)))
        areas.push(Math.round(dentro / (escala * escala)))
      }
      return { corParede, contagens, areas }
    },
    { b64: foto.toString('base64'), larguraCss, pedido },
  )
}

async function acharLinha(page: Page, foto: Foto, larguraCss: number, faixa: Retangulo): Promise<RespostaLinha> {
  const r = await analisar(page, foto, larguraCss, { tipo: 'linha', faixa })
  return r as RespostaLinha
}

async function acharDisco(page: Page, foto: Foto, larguraCss: number): Promise<RespostaDisco | null> {
  const r = await analisar(page, foto, larguraCss, { tipo: 'disco' })
  return r as RespostaDisco | null
}

async function medir(page: Page, foto: Foto, larguraCss: number, faixaCalibragem: Retangulo, discos: Disco[]): Promise<RespostaMedida> {
  const r = await analisar(page, foto, larguraCss, { tipo: 'medir', faixaCalibragem, discos })
  return r as RespostaMedida
}

const distanciaCor = (a: Cor, b: Cor): number => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))

async function ferramenta(page: Page, nome: string) {
  await page.getByRole('button', { name: nome, exact: true }).click()
}

/** Arrasto de verdade: aperta, anda em passos, pausa e só então solta. */
async function arrastar(page: Page, de: Ponto, ate: Ponto, botao: 'left' | 'middle') {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down({ button: botao })
  await page.mouse.move((de.x + ate.x) / 2, (de.y + ate.y) / 2, { steps: 6 })
  await page.mouse.move(ate.x, ate.y, { steps: 6 })
  await page.waitForTimeout(120)
  await page.mouse.up({ button: botao })
}

interface Cenario {
  /** Centro da área visível do canvas, em px de página — o ponto onde o app larga a peça nova. */
  centro: Ponto
  /** Recorte do canvas livre de painel e barra, sempre centrado em `centro`. */
  janela: Retangulo
  /** Foto da janela ANTES de existir qualquer token. */
  antes: Foto
}

/**
 * Abre o editor, desenha um cômodo, tira a seleção, aproxima com a roda
 * ancorada na parede de cima e arrasta com o botão do meio até essa parede
 * passar pelo centro da vista. Tudo por gesto de ponteiro e roda; o
 * enquadramento é conferido no PIXEL, não na câmera.
 */
async function montarCenario(page: Page): Promise<Cenario> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')

  // Cômodo com paredes, arrastando como o mestre faz.
  await ferramenta(page, 'Sala')
  await arrastar(page, { x: caixa.x + SALA.x1, y: caixa.y + SALA.y1 }, { x: caixa.x + SALA.x2, y: caixa.y + SALA.y2 }, 'left')
  // O campo de nome nasce em cima da Sala e rouba o foco; Esc mantém o padrão.
  await page.getByRole('textbox', { name: 'Nome da sala no mapa' }).press('Escape')

  // Nada selecionado: sem isso o realce amarelo entraria na leitura da cor da
  // parede. O painel é a prova visível de que não há seleção na tela.
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(caixa.x + VAZIO.x, caixa.y + VAZIO.y)
  await expect(page.getByRole('button', { name: 'Nada selecionado', exact: true })).toBeVisible()

  // Onde, na tela, está a aresta de cima do cômodo.
  const faixaBusca = { x: caixa.x + X_ANCORA - 20, y: caixa.y + SALA.y1 - 32, width: 40, height: 64 }
  const linha = await acharLinha(page, await page.screenshot({ clip: faixaBusca }), faixaBusca.width, {
    x: 0,
    y: 0,
    width: faixaBusca.width,
    height: faixaBusca.height,
  })
  const ancora: Ponto = { x: faixaBusca.x + faixaBusca.width / 2, y: faixaBusca.y + linha.y }

  // Roda em cima da parede: `zoomAt` ancora no ponteiro, então essa parede
  // continua exatamente debaixo do cursor enquanto a vista aproxima.
  await page.mouse.move(ancora.x, ancora.y)
  for (let i = 0; i < GIROS; i += 1) {
    await page.mouse.wheel(0, GIRO_RODA)
    await page.waitForTimeout(60)
  }
  await expect(page.getByRole('button', { name: /^Zoom: (?!100%)\d+%/ })).toBeVisible()

  const centro: Ponto = { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }

  // Botão do meio arrasta o mapa: o ponto agarrado acompanha o cursor, então
  // levar o cursor da parede até o centro leva a parede até o centro.
  await arrastar(page, ancora, centro, 'middle')

  // Conferência e acerto fino do enquadramento, sempre pelo que está na tela.
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const faixa = { x: centro.x - 40, y: centro.y - 30, width: 80, height: 60 }
    const atual = await acharLinha(page, await page.screenshot({ clip: faixa }), faixa.width, { x: 0, y: 0, width: faixa.width, height: faixa.height })
    const erro = centro.y - (faixa.y + atual.y)
    if (Math.abs(erro) <= 1) break
    await arrastar(page, { x: centro.x, y: centro.y - 120 }, { x: centro.x, y: centro.y - 120 + erro }, 'middle')
  }

  // Ponteiro para longe: parado em cima da parede ele acende o anel de hover, e
  // esse realce entraria na foto.
  await page.mouse.move(caixa.x + VAZIO.x, caixa.y + VAZIO.y)
  await page.waitForTimeout(150)

  // Maior quadrado centrado na vista que não encosta no painel da esquerda nem
  // na barra de cima — medidos no DOM, não chutados.
  const trilho = await page.locator('.lb-editor__rail').boundingBox()
  const barra = await page.locator('.lb-toolbar').first().boundingBox()
  const bordaEsquerda = trilho ? trilho.x + trilho.width + 16 : caixa.x + 16
  const bordaSuperior = barra ? barra.y + barra.height + 16 : caixa.y + 16
  const raioJanela = Math.floor(
    Math.min(
      300,
      centro.x - bordaEsquerda,
      caixa.x + caixa.width - 16 - centro.x,
      centro.y - bordaSuperior,
      caixa.y + caixa.height - 16 - centro.y,
    ),
  )
  expect(raioJanela, 'não sobrou área de canvas livre de painel para medir').toBeGreaterThan(120)
  const janela = { x: centro.x - raioJanela, y: centro.y - raioJanela, width: raioJanela * 2, height: raioJanela * 2 }

  const antes = await page.screenshot({ clip: janela })
  return { centro, janela, antes }
}

/** Faixa fina em cima da linha da parede, à direita do centro: onde a cor da parede é lida. */
function faixaDeCalibragem(raioJanela: number): Retangulo {
  return { x: raioJanela + raioJanela * 0.5, y: raioJanela - 6, width: raioJanela * 0.3, height: 12 }
}

/**
 * O que conta como "o app FALOU" — e por que não é um `[role=status]` genérico.
 *
 * A dica fixa da barra de ferramentas (`src/components/Toolbar.tsx:380`) é um
 * `<p role="status">` que está SEMPRE na tela: mostra `TOOL_HINTS[activeTool]`
 * desde que o editor abre. O locator que estava aqui
 * (`[role="alert"], [role="status"], .lb-toast` com `hasText`) casava com essa
 * dica, então o caminho alternativo deste teste — "a peça não nasceu, logo o
 * app tem de dizer por quê" — saía VERDE com o app completamente calado, em
 * qualquer mapa, sem nenhuma peça e sem nenhum aviso. Asserção que não morde.
 *
 * Valem só os avisos de verdade: o toast (`.lb-toast`, com `role="alert"` ou
 * `role="status"` conforme o tipo — `src/components/Toast.tsx:37`) e qualquer
 * `alert`/`alertdialog` fora da barra. Mesmo recorte, pelo mesmo motivo, de
 * `task-jornada-gestos-centrais.spec.ts:83-91`.
 */
const AVISOS_DE_VERDADE = '.lb-toast, [role="alert"], [role="alertdialog"]'

async function avisosVisiveis(page: Page): Promise<string[]> {
  const candidatos = page.locator(AVISOS_DE_VERDADE)
  const total = await candidatos.count()
  const textos: string[] = []
  for (let i = 0; i < total; i += 1) {
    const alvo = candidatos.nth(i)
    if (!(await alvo.isVisible())) continue
    const texto = (await alvo.innerText()).trim()
    if (texto.length > 0) textos.push(texto)
  }
  return textos
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('controle positivo: a régua enxerga a parede que o usuário desenhou e não confunde chão com parede', async ({ page }) => {
  const { janela, antes } = await montarCenario(page)
  const raio = janela.width / 2
  // Raio de sonda qualquer, do tamanho de uma célula: aqui não se mede token,
  // mede-se a régua. Um disco no centro (em cima da parede) e outro três
  // sondas abaixo (no meio do cômodo, longe de qualquer parede).
  const sonda = 64
  const medida = await medir(page, antes, janela.width, faixaDeCalibragem(raio), [
    { cx: raio, cy: raio, r: sonda },
    { cx: raio, cy: raio + sonda * 3, r: sonda },
  ])

  // A cor lida é clara e bem diferente do chão marrom (#a8776a) e do fundo
  // (#2b2b2b) — e não pode ser o amarelo de seleção, porque o painel mostrava
  // "Nada selecionado" quando a foto foi tirada.
  const luzParede = 0.299 * medida.corParede[0] + 0.587 * medida.corParede[1] + 0.114 * medida.corParede[2]
  expect(luzParede, `cor lida na linha da parede: ${medida.corParede.join(',')}`).toBeGreaterThan(120)
  expect(distanciaCor(medida.corParede, [168, 119, 106]), 'cor lida está em cima do marrom do chão').toBeGreaterThan(TOLERANCIA_COR)
  expect(distanciaCor(medida.corParede, [255, 221, 85]), 'cor lida está em cima do amarelo de seleção').toBeGreaterThan(TOLERANCIA_COR)

  // Um lado: onde tem parede, a régua conta parede.
  expect(medida.contagens[0], 'a régua não achou parede no centro da vista, onde a jornada acabou de enquadrar a parede').toBeGreaterThan(50)
  // Outro lado: no meio do cômodo, a régua conta zero.
  expect(medida.contagens[1], 'a régua contou "parede" no meio do chão — o classificador de cor está frouxo').toBe(0)
})

test('peça nova nunca nasce em cima de uma parede', async ({ page }) => {
  const { janela, antes } = await montarCenario(page)
  const raio = janela.width / 2

  // Lista de avisos ANTES do gesto. O caminho alternativo lá embaixo exige
  // texto NOVO: um aviso que já estava na tela antes de a pessoa pedir a peça
  // não é resposta a esse pedido.
  const avisosAntes = await avisosVisiveis(page)

  // O usuário cria a peça: botão, nome, confirmar. Nenhuma pista de onde ela
  // deve nascer — é exatamente esse o gesto que o passeio cego reclamou.
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nome do novo token' }).fill('Guarda')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()

  let disco: RespostaDisco | null = null
  for (let tentativa = 0; tentativa < 10 && disco === null; tentativa += 1) {
    await page.waitForTimeout(200)
    disco = await acharDisco(page, await page.screenshot({ clip: janela }), janela.width)
  }

  if (disco === null) {
    // Caminho honesto alternativo: não achou lugar livre, então FALA. Texto
    // visível na tela, NOVO, e num aviso de verdade — a dica fixa da barra não
    // vale como resposta (ver `AVISOS_DE_VERDADE` acima).
    let novos: string[] = []
    for (let tentativa = 0; tentativa < 10 && novos.length === 0; tentativa += 1) {
      await page.waitForTimeout(200)
      novos = (await avisosVisiveis(page)).filter((t) => !avisosAntes.includes(t))
    }
    expect(
      novos.length,
      'nenhuma peça apareceu na tela e o app não disse por quê: nenhum aviso novo em ' +
        `${AVISOS_DE_VERDADE} depois de "Adicionar token" (avisos já na tela antes do gesto: ${JSON.stringify(avisosAntes)})`,
    ).toBeGreaterThan(0)
    return
  }

  // O borrão azul é mesmo um disco, e não um pedaço de interface: caixa
  // quadrada e área igual à de um círculo do mesmo raio.
  const proporcao = disco.larguraCaixa / disco.alturaCaixa
  expect(proporcao, `o azul achado não é redondo (caixa ${disco.larguraCaixa}x${disco.alturaCaixa})`).toBeGreaterThan(0.85)
  expect(proporcao).toBeLessThan(1.18)
  expect(disco.area / (Math.PI * disco.r * disco.r), 'área do azul não bate com a de um disco').toBeGreaterThan(0.8)

  const medida = await medir(page, antes, janela.width, faixaDeCalibragem(raio), [
    { cx: disco.cx, cy: disco.cy, r: disco.r * FRACAO_DO_DISCO },
    { cx: raio, cy: raio, r: disco.r * FRACAO_DO_DISCO },
  ])
  const paredeSobAPeca = medida.contagens[0]
  const paredeNoCentro = medida.contagens[1]

  // Controle positivo com a MESMA régua e o MESMO raio usados na acusação:
  // no centro da vista, onde a jornada enquadrou a parede, tem de dar bem mais
  // que zero. Sem isto, um zero na linha de baixo não provaria nada.
  expect(paredeNoCentro, 'a régua não vê parede nem no centro da vista — medida inválida, não julgue a linha seguinte').toBeGreaterThan(50)

  expect(
    paredeSobAPeca,
    `a peça nasceu em cima da parede: ${paredeSobAPeca} px da cor da parede (${medida.corParede.join(',')}) ficam dentro do disco ` +
      `de raio ${disco.r.toFixed(1)} px centrado em (${disco.cx.toFixed(1)}, ${disco.cy.toFixed(1)}) da janela; ` +
      `para comparar, o mesmo disco no centro da vista cobre ${paredeNoCentro} px de parede`,
  ).toBe(0)
})
