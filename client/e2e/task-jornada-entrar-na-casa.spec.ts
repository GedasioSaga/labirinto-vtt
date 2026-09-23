// Jornada de usuário: "Que estranho, não consigo entrar na casa".
//
// O mestre novo desenha uma casa (Sala = região com paredes na borda), põe um
// token do lado de fora e arrasta para dentro. O token bate na parede e VOLTA.
// Hoje a recusa é MUDA: `moveTokenLive`/`moveToken` (src/stores/mapStore.ts:1023
// e :1183) chamam `resolveTokenMove` (src/lib/collision.ts:99), que devolve a
// posição de origem quando o traço cruza parede sem porta passável — e ninguém
// avisa nada. Sem toast (`stores/toastStore.ts` existe e é usado em 15 outros
// lugares no App), sem realce da parede que barrou, sem dica. A tela fica
// exatamente igual a "o arrasto não funcionou".
//
// O que esta jornada cobra, tudo pela TELA:
//   1. a recusa é EXPLICADA — aparece texto novo e visível que diz por que não
//      entrou (parede/bloqueio) e o que fazer (porta);
//   2. a recusa é APONTADA — o pixel em cima da parede que barrou muda de
//      aparência (realce), para o mestre saber QUAL parede o segurou;
//   3. seguindo só o que a tela ofereceu — o texto da recusa cita um controle
//      visível, o mestre clica nele — o token passa a entrar, provado pela
//      posição do token na tela.
//
// Nada de `mapStore` aqui: sala, token, seleção e arrasto saem de ponteiro e
// de botão de verdade. É de propósito — o próprio playwright.config.ts avisa
// (linha ~24) que `import('/src/stores/mapStore.ts')` dentro de um evaluate
// pode cair numa SEGUNDA store (o vite serve o módulo carimbado por HMR para o
// app e o sem carimbo para o spec), o que já produziu vermelho e verde falsos.
//
// Geometria (camera nasce {x:0,y:0,scale:1} em mapStore.ts:747 e nada dá fit,
// então px de mundo = px de CSS dentro do canvas; mapa novo é 30x20 de grade
// 64, ver screens/NewDungeonMap.tsx):
//   casa  (896,256)-(1216,448)  — cantos em múltiplos de 64, o snap não mexe
//   FORA  (352,352)             — centro de célula, à esquerda da casa
//   DENTRO(992,352)             — centro de célula, dentro da casa
//   BARRA (896,352)             — onde a horizontal FORA→DENTRO cruza a parede
//
// Tudo isso vive na FAIXA LIVRE do canvas. `canvas.screenshot()` fotografa a
// região da página ocupada pelo canvas, overlays de DOM incluídos: o painel da
// esquerda vai até x~280, a barra de ferramentas e a dica ocupam y<150 e o HUD
// de zoom mora no canto inferior direito. Ponto de amostra fora da faixa livre
// mede mudança de PAINEL, não de mapa — foi o que derrubou a primeira versão
// desta jornada (o centro da mudança caiu em x=219, dentro do painel).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

// Disco da máquina está em ~2 GB livres: esta jornada não deixa trace nem
// vídeo. O screenshot de falha (poucos KB, dentro de test-results/) fica.
test.use({ trace: 'off', video: 'off' })

const CASA = { x1: 896, y1: 256, x2: 1216, y2: 448 }
const FORA = { x: 352, y: 352 }
const DENTRO = { x: 992, y: 352 }
const BARRA = { x: 896, y: 352 }
/**
 * Onde a jornada LÊ a aparência da parede que barrou. É a mesma parede (a
 * aresta esquerda da casa vai de y=256 a y=448), 64 px acima do ponto de
 * choque. Não é em BARRA porque o token não volta para trás: ele desliza até
 * encostar e PARA em cima da parede (medido: distância de cor 171 em BARRA,
 * que é o token, não aviso nenhum). Ler ali daria verde de graça.
 */
const OLHO_NA_PAREDE = { x: 896, y: 288 }
/** Canto vazio do canvas, longe da casa e do token: clique que tira a seleção. */
const VAZIO = { x: 600, y: 700 }
/** Faixa do canvas que nenhum overlay de DOM cobre — ver comentário do cabeçalho. */
const FAIXA_LIVRE = { x1: 300, y1: 160, x2: 1270, y2: 730 }

/**
 * Distância de cor (máximo por canal) que conta como "mudou na tela".
 * Não é chute: cada uso é precedido de um CONTROLE POSITIVO que produz uma
 * mudança real no MESMO ponto e exige passar deste valor.
 */
const LIMIAR = 24
/** Raio (px de CSS) da janela lida em volta de cada ponto: a linha da parede
 *  tem 1-3 px e pode cair meio pixel para qualquer lado (lib/pixelAlign.ts). */
const RAIO = 6

/** O que `locator.screenshot()` devolve — sem @types/node no tsconfig dos e2e,
 *  o tipo vem da própria API em vez de `Buffer`. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

interface Retrato {
  foto: Foto
  largura: number
}

async function fotoDoCanvas(page: Page): Promise<Retrato> {
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { foto: await canvas.screenshot(), largura: box.width }
}

/**
 * Para cada ponto, a MAIOR distância de cor entre as duas fotos dentro de uma
 * janela de `RAIO` px — "alguma coisa mudou aqui na tela".
 *
 * Decodifica os dois PNGs com o próprio decodificador do navegador num canvas
 * 2D descartável. Nenhum estado do app é lido: entra imagem, sai número.
 */
async function mudancaNosPontos(
  page: Page,
  antes: Retrato,
  depois: Retrato,
  pontos: { x: number; y: number }[],
): Promise<number[]> {
  return page.evaluate(
    async ({ a, b, larguraCss, pontos, raio }) => {
      const ler = async (b64: string) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
        const bmp = await createImageBitmap(blob)
        const canvas = document.createElement('canvas')
        canvas.width = bmp.width
        canvas.height = bmp.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('sem contexto 2d para ler a foto')
        ctx.drawImage(bmp, 0, 0)
        return { img: ctx.getImageData(0, 0, bmp.width, bmp.height), escala: bmp.width / larguraCss }
      }
      const ia = await ler(a)
      const ib = await ler(b)
      return pontos.map((p) => {
        let maior = 0
        const cx = p.x * ia.escala
        const cy = p.y * ia.escala
        const passo = Math.max(1, Math.round(raio * ia.escala))
        for (let dy = -passo; dy <= passo; dy += 1) {
          for (let dx = -passo; dx <= passo; dx += 1) {
            const x = Math.min(ia.img.width - 1, Math.max(0, Math.round(cx + dx)))
            const y = Math.min(ia.img.height - 1, Math.max(0, Math.round(cy + dy)))
            const i = (y * ia.img.width + x) * 4
            const d = Math.max(
              Math.abs(ia.img.data[i] - ib.img.data[i]),
              Math.abs(ia.img.data[i + 1] - ib.img.data[i + 1]),
              Math.abs(ia.img.data[i + 2] - ib.img.data[i + 2]),
            )
            if (d > maior) maior = d
          }
        }
        return maior
      })
    },
    { a: antes.foto.toString('base64'), b: depois.foto.toString('base64'), larguraCss: antes.largura, pontos, raio: RAIO },
  )
}

/**
 * Centro (em px de CSS do canvas) da mancha de pixels que mudou entre duas
 * fotos. É assim que a jornada DESCOBRE onde o token nasceu: olhando a tela,
 * como o mestre faria — `handleAddToken` (App.tsx:926) solta o token no centro
 * da área visível, que não é um número que o usuário conheça.
 */
interface Regiao {
  x1: number
  y1: number
  x2: number
  y2: number
}

async function centroDaMudanca(
  page: Page,
  antes: Retrato,
  depois: Retrato,
  regiao: Regiao = FAIXA_LIVRE,
  excluir: Regiao | null = null,
): Promise<{ x: number; y: number; pixels: number }> {
  return page.evaluate(
    async ({ a, b, larguraCss, limiar, faixa, excluir }) => {
      const ler = async (b64: string) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
        const bmp = await createImageBitmap(blob)
        const canvas = document.createElement('canvas')
        canvas.width = bmp.width
        canvas.height = bmp.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('sem contexto 2d para ler a foto')
        ctx.drawImage(bmp, 0, 0)
        return { img: ctx.getImageData(0, 0, bmp.width, bmp.height), escala: bmp.width / larguraCss }
      }
      const ia = await ler(a)
      const ib = await ler(b)
      let somaX = 0
      let somaY = 0
      let n = 0
      // Só a faixa livre: mudança de painel/barra não é mudança de mapa.
      const x0 = Math.round(faixa.x1 * ia.escala)
      const x1 = Math.min(ia.img.width - 1, Math.round(faixa.x2 * ia.escala))
      const y0 = Math.round(faixa.y1 * ia.escala)
      const y1 = Math.min(ia.img.height - 1, Math.round(faixa.y2 * ia.escala))
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          if (
            excluir &&
            x >= excluir.x1 * ia.escala &&
            x <= excluir.x2 * ia.escala &&
            y >= excluir.y1 * ia.escala &&
            y <= excluir.y2 * ia.escala
          ) {
            continue
          }
          const i = (y * ia.img.width + x) * 4
          const d = Math.max(
            Math.abs(ia.img.data[i] - ib.img.data[i]),
            Math.abs(ia.img.data[i + 1] - ib.img.data[i + 1]),
            Math.abs(ia.img.data[i + 2] - ib.img.data[i + 2]),
          )
          if (d > limiar) {
            somaX += x
            somaY += y
            n += 1
          }
        }
      }
      if (n === 0) return { x: -1, y: -1, pixels: 0 }
      return { x: somaX / n / ia.escala, y: somaY / n / ia.escala, pixels: n }
    },
    { a: antes.foto.toString('base64'), b: depois.foto.toString('base64'), larguraCss: antes.largura, limiar: LIMIAR, faixa: regiao, excluir },
  )
}

/**
 * Todo texto que está VISÍVEL na página agora, um item por elemento que tem
 * texto próprio. `checkVisibility` derruba `display:none`, `visibility:hidden`
 * e `opacity:0` — a dica da Toolbar nasce com `visibility: hidden` enquanto se
 * mede (Toolbar.tsx:298), e texto invisível não avisa ninguém.
 */
async function textosVisiveis(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const linhas = new Set<string>()
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const visivel = el.checkVisibility
        ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })
        : true
      if (!visivel) continue
      let proprio = ''
      for (const no of Array.from(el.childNodes)) {
        if (no.nodeType === Node.TEXT_NODE) proprio += no.nodeValue ?? ''
      }
      const texto = proprio.replace(/\s+/g, ' ').trim()
      if (texto) linhas.add(texto)
    }
    return Array.from(linhas)
  })
}

/** Guarda tudo que já apareceu na tela, para "novo" significar novo mesmo. */
function monitorDeTexto() {
  const vistos = new Set<string>()
  return {
    async absorver(page: Page) {
      for (const t of await textosVisiveis(page)) vistos.add(t)
    },
    async novidades(page: Page): Promise<string[]> {
      return (await textosVisiveis(page)).filter((t) => !vistos.has(t))
    },
  }
}

async function ferramenta(page: Page, nome: string) {
  await page.getByRole('button', { name: nome, exact: true }).click()
}

type Caixa = { x: number; y: number }

/**
 * Pousa o ponteiro num ponto e força o app a reavaliar o que está sob ele
 * (mexe 6 px e volta, sempre dentro do mesmo alvo). Existe porque o realce de
 * HOVER não é recalculado sozinho depois de um `mouse.up`: sem este pouso, a
 * foto de antes tem o realce de hover da sala e a de depois não, e a diferença
 * (medida: 29, acima do limiar) seria lida como "o app avisou algo" quando é
 * só o cursor. Com o pouso nas duas fotos, o hover se cancela e sobra o que o
 * app realmente desenhou de novo.
 */
async function pousarPonteiro(page: Page, box: Caixa, ponto: Caixa) {
  await page.mouse.move(box.x + ponto.x + 6, box.y + ponto.y)
  await page.mouse.move(box.x + ponto.x, box.y + ponto.y)
  await page.waitForTimeout(250)
}

/** Arrasto de ponteiro de verdade: pega, anda em passos, PAUSA, solta. */
async function arrastar(page: Page, box: Caixa, de: Caixa, para: Caixa) {
  await page.mouse.move(box.x + de.x, box.y + de.y)
  await page.mouse.down()
  // Primeiro passo curto: passa do limiar que separa clique de arrasto.
  await page.mouse.move(box.x + de.x + 3, box.y + de.y + 3, { steps: 2 })
  await page.mouse.move(box.x + para.x, box.y + para.y, { steps: 16 })
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(150)
}

interface Cenario {
  box: { x: number; y: number }
  /** Canvas vazio, antes de existir token ou casa: linha de base de FORA. */
  inicial: Retrato
  /** Casa desenhada e token parado em FORA: linha de base de DENTRO e da parede. */
  casaPronta: Retrato
  texto: ReturnType<typeof monitorDeTexto>
}

/**
 * O caminho do mestre novo até a dor, só com gesto: cria o token pelo painel,
 * acha ele na tela, arrasta para fora da área onde a casa vai nascer, desenha
 * a casa e seleciona o token. Deixa dois controles positivos provados:
 *  - o arrasto de ponteiro REALMENTE move token (sem isso, "o token não
 *    entrou" não distingue parede de arrasto quebrado);
 *  - a leitura de pixel REALMENTE enxerga uma mudança de aparência na parede
 *    de BARRA (o realce da seleção), então o limiar é alcançável ali.
 */
async function mestreNovoComCasaFechada(page: Page): Promise<Cenario> {
  await enterEditor(page)
  const canvas = await page.locator('canvas').boundingBox()
  if (!canvas) throw new Error('canvas sem bounding box')
  const box = { x: canvas.x, y: canvas.y }

  const texto = monitorDeTexto()
  await texto.absorver(page)

  const inicial = await fotoDoCanvas(page)

  // --- o token nasce por botão, como o mestre faz -------------------------
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  await page.getByLabel('Nome do novo token').fill('Herói')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await page.waitForTimeout(150)

  const comToken = await fotoDoCanvas(page)
  const berco = await centroDaMudanca(page, inicial, comToken)
  expect(berco.pixels, 'o token não apareceu no canvas depois de "Adicionar"').toBeGreaterThan(200)

  // --- CONTROLE POSITIVO 1: arrasto de ponteiro move token ---------------
  // Sem este piso, o "não entrou" da jornada passaria também num app em que
  // arrastar token simplesmente não faz nada.
  await arrastar(page, box, berco, FORA)
  const tokenFora = await fotoDoCanvas(page)
  const [mudouEmFora] = await mudancaNosPontos(page, inicial, tokenFora, [FORA])
  expect(
    mudouEmFora,
    `CONTROLE POSITIVO: arrastar do berço (${Math.round(berco.x)},${Math.round(berco.y)}) até (${FORA.x},${FORA.y}) não mudou nada na tela em FORA — o arrasto de ponteiro não está movendo o token, e nada do que vem depois significaria coisa alguma`,
  ).toBeGreaterThan(LIMIAR)

  // --- a casa ------------------------------------------------------------
  await ferramenta(page, 'Sala')
  // CONTROLE POSITIVO 2: o detector de texto novo enxerga uma mensagem que o
  // app REALMENTE mostra hoje (a dica da ferramenta). Sem isto, "nenhum texto
  // novo" poderia ser cegueira do detector, não silêncio do app.
  const dicaDaSala = await texto.novidades(page)
  expect(
    dicaDaSala.length,
    'CONTROLE POSITIVO: escolher a ferramenta Sala não produziu NENHUM texto novo visível — o detector de texto está cego, não o app',
  ).toBeGreaterThan(0)
  await texto.absorver(page)

  await arrastar(page, box, { x: CASA.x1, y: CASA.y1 }, { x: CASA.x2, y: CASA.y2 })
  // O campo de nome nasce em cima da sala e rouba o foco; Esc mantém o padrão.
  await page.getByRole('textbox', { name: 'Nome da sala no mapa' }).press('Escape')
  await ferramenta(page, 'Selecionar')
  await texto.absorver(page)

  const casaPronta = await fotoDoCanvas(page)

  // --- CONTROLE POSITIVO 3: dá para ver mudança de aparência EM BARRA ----
  // Clicar na parede realça o que foi selecionado. Se nem isso o leitor de
  // pixel enxergar naquele ponto, a cobrança de "realce da parede que barrou"
  // seria impossível de satisfazer e o vermelho não valeria nada.
  await page.mouse.click(box.x + BARRA.x, box.y + BARRA.y)
  await page.waitForTimeout(150)
  const comParedeSelecionada = await fotoDoCanvas(page)
  const [mudouNoOlho] = await mudancaNosPontos(page, casaPronta, comParedeSelecionada, [OLHO_NA_PAREDE])
  expect(
    mudouNoOlho,
    `CONTROLE POSITIVO: selecionar a parede clicando em (${BARRA.x},${BARRA.y}) não mudou pixel nenhum em (${OLHO_NA_PAREDE.x},${OLHO_NA_PAREDE.y}) — o leitor de pixel não enxerga mudança de aparência nessa parede, então cobrar realce nela seria cobrança impossível`,
  ).toBeGreaterThan(LIMIAR)
  await texto.absorver(page)

  // Volta ao estado de partida: nada selecionado, parede sem realce.
  await page.mouse.click(box.x + VAZIO.x, box.y + VAZIO.y)
  await page.waitForTimeout(150)
  const semSelecao = await fotoDoCanvas(page)
  const [voltouNoOlho] = await mudancaNosPontos(page, casaPronta, semSelecao, [OLHO_NA_PAREDE])
  expect(
    voltouNoOlho,
    `a parede em (${OLHO_NA_PAREDE.x},${OLHO_NA_PAREDE.y}) não voltou à aparência de antes depois de tirar a seleção: a linha de base do pixel não é estável`,
  ).toBeLessThan(LIMIAR)

  // O mestre clica no token antes de arrastar — gesto normal, e garante que o
  // arrasto pega o token e não uma marquise de seleção.
  await page.mouse.click(box.x + FORA.x, box.y + FORA.y)
  await page.waitForTimeout(150)
  await texto.absorver(page)

  return { box, inicial, casaPronta, texto }
}

test('o mestre arrasta o token para dentro da casa fechada e a tela explica por que ele não entrou', async ({ page }) => {
  const { box, casaPronta, texto } = await mestreNovoComCasaFechada(page)

  // A foto "antes" é tirada com o ponteiro NO MESMO lugar em que ele vai parar
  // depois do arrasto. Sem isso, o realce de hover que o cursor produz ao
  // pousar dentro da sala entraria na conta como se fosse aviso de parede —
  // e a jornada passaria verde sem o app ter aprendido nada.
  await pousarPonteiro(page, box, DENTRO)
  const antes = await fotoDoCanvas(page)

  await arrastar(page, box, FORA, DENTRO)
  await pousarPonteiro(page, box, DENTRO)
  const depois = await fotoDoCanvas(page)

  // Premissa da dor: o token continua fora. (A casa não tem porta, então a
  // parede barra — collision.ts:40. Se isto falhar, a jornada está no cenário
  // errado e nada abaixo faz sentido.)
  const [chegouDentro] = await mudancaNosPontos(page, casaPronta, depois, [DENTRO])
  expect(
    chegouDentro,
    `premissa da jornada quebrada: o token ENTROU na casa fechada (mudou ${chegouDentro} em (${DENTRO.x},${DENTRO.y}))`,
  ).toBeLessThan(LIMIAR)

  const novidades = await texto.novidades(page)
  const naTela = novidades.length > 0 ? novidades.map((t) => `"${t}"`).join(' | ') : '(NADA — a tela não ganhou uma letra)'

  // --- A DOR, parte 1: POR QUE não entrou --------------------------------
  // Soft para o vermelho mostrar de uma vez tudo que falta, em vez de uma
  // ausência por execução.
  expect
    .soft(naTela, `o token voltou e a tela não disse o motivo. Texto novo visível depois do arrasto recusado: ${naTela}`)
    .toMatch(/parede|bloque|barr|fechad|passagem|não cabe|sem sa[íi]da/i)

  // --- A DOR, parte 2: O QUE FAZER ---------------------------------------
  expect
    .soft(naTela, `a tela não disse ao mestre o que fazer para entrar (nenhuma menção a porta). Texto novo visível: ${naTela}`)
    .toMatch(/porta/i)

  // --- A DOR, parte 3: QUAL parede barrou --------------------------------
  const [realceDaParede] = await mudancaNosPontos(page, antes, depois, [OLHO_NA_PAREDE])
  expect
    .soft(
      realceDaParede,
      `a parede que barrou o token não mudou de aparência nenhuma em (${OLHO_NA_PAREDE.x},${OLHO_NA_PAREDE.y}) (distância de cor ${realceDaParede}, limiar ${LIMIAR} — o mesmo ponto e o mesmo limiar que o realce de seleção passou no controle positivo): o mestre vê o token parar e não tem como saber QUAL parede o segurou`,
    )
    .toBeGreaterThan(LIMIAR)
})

/**
 * Nome acessível aproximado de um controle visível: o que o mestre lê no
 * botão. Sem ler a store, sem `data-testid` combinado com o app.
 */
async function controlesVisiveis(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const nomes = new Set<string>()
    const seletor = 'button, [role="button"], [role="radio"], a[href], [role="link"]'
    for (const el of Array.from(document.querySelectorAll(seletor))) {
      const habilitado = !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true'
      const visivel = el.checkVisibility ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) : true
      if (!habilitado || !visivel) continue
      const nome = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (nome.length >= 4) nomes.add(nome)
    }
    return Array.from(nomes)
  })
}

test('seguindo só o que a tela oferece depois da recusa, o mestre abre a casa e o token entra', async ({ page }) => {
  const { box, inicial, casaPronta, texto } = await mestreNovoComCasaFechada(page)

  const seguidos: string[] = []
  let entrou = false
  // Onde o token está AGORA, na tela. Não volta sozinho para FORA a cada
  // rodada: barrado, ele desliza até encostar na parede e para lá. O mestre
  // pega o token onde ele o vê.
  let ondeEstaOToken = { ...FORA }

  // Três tentativas: é quanto um mestre paciente repete antes de desistir — e
  // é quanto basta se cada recusa disser a próxima coisa a fazer (criar a
  // porta, abrir a porta, arrastar de novo).
  for (let rodada = 1; rodada <= 3 && !entrou; rodada += 1) {
    const antesDoArrasto = await fotoDoCanvas(page)
    await arrastar(page, box, ondeEstaOToken, DENTRO)
    await pousarPonteiro(page, box, DENTRO)
    const agora = await fotoDoCanvas(page)

    // Onde o token parou: a mancha que mudou na faixa da linha do arrasto,
    // descontando o lugar de onde ele saiu.
    const parada = await centroDaMudanca(
      page,
      antesDoArrasto,
      agora,
      { x1: FAIXA_LIVRE.x1, y1: DENTRO.y - 52, x2: FAIXA_LIVRE.x2, y2: DENTRO.y + 52 },
      { x1: ondeEstaOToken.x - 60, y1: ondeEstaOToken.y - 60, x2: ondeEstaOToken.x + 60, y2: ondeEstaOToken.y + 60 },
    )
    if (parada.pixels > 200) ondeEstaOToken = { x: Math.round(parada.x), y: Math.round(parada.y) }

    const [emDentro] = await mudancaNosPontos(page, casaPronta, agora, [DENTRO])
    if (emDentro > LIMIAR) {
      entrou = true
      break
    }

    const novidades = await texto.novidades(page)
    const naTela = novidades.length > 0 ? novidades.map((t) => `"${t}"`).join(' | ') : '(NADA)'
    expect(
      novidades.length,
      `rodada ${rodada}: o token não entrou e a tela não ofereceu nada novo para o mestre seguir. Já seguidos: [${seguidos.join(', ')}]`,
    ).toBeGreaterThan(0)

    // O mestre só pode seguir o que está escrito: procura um controle VISÍVEL
    // cujo nome a própria mensagem cita. Nada de atalho decorado (D) nem de
    // menu escondido.
    const mensagem = novidades.join(' ').toLowerCase()
    const oferecidos = (await controlesVisiveis(page)).filter(
      (nome) => !seguidos.includes(nome) && mensagem.includes(nome.toLowerCase()),
    )
    expect(
      oferecidos.length,
      `rodada ${rodada}: a tela falou mas não ofereceu caminho — nenhum controle visível é citado na mensagem. Mensagem: ${naTela}`,
    ).toBeGreaterThan(0)

    const alvo = oferecidos[0]
    seguidos.push(alvo)
    await page.getByRole('button', { name: alvo, exact: true }).first().click()
    await page.waitForTimeout(150)

    // Se o que a tela passou a pedir é um clique no mapa ("clique em cima de
    // uma parede..."), o mestre clica exatamente na parede que o barrou.
    const instrucao = (await texto.novidades(page)).join(' ')
    await texto.absorver(page)
    if (/clique/i.test(instrucao)) {
      await page.mouse.click(box.x + BARRA.x, box.y + BARRA.y)
      await page.waitForTimeout(150)
      await texto.absorver(page)
      // Volta para a ferramenta de arrastar, que está à vista na barra.
      await ferramenta(page, 'Selecionar')
      await texto.absorver(page)
    }
  }

  const fim = await fotoDoCanvas(page)
  const [emDentro] = await mudancaNosPontos(page, casaPronta, fim, [DENTRO])
  const [emFora] = await mudancaNosPontos(page, inicial, fim, [FORA])

  expect(
    emDentro,
    `depois de seguir o que a tela ofereceu ([${seguidos.join(', ')}]), o token ainda não aparece dentro da casa em (${DENTRO.x},${DENTRO.y}) (mudança ${emDentro}, limiar ${LIMIAR})`,
  ).toBeGreaterThan(LIMIAR)
  expect(
    emFora,
    `o token aparece dentro da casa mas continua desenhado em (${FORA.x},${FORA.y}) também (mudança ${emFora} contra o canvas vazio): não foi um token que andou`,
  ).toBeLessThan(LIMIAR)
})
