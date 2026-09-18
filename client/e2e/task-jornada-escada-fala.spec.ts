// Jornada de usuário escrita ANTES do conserto (relato de 18/09/2026).
//
// DOR: com a ferramenta "Escada" armada (a barra ecoando "PRÓXIMA ESCADA
// Grande"), um CLIQUE SIMPLES no mapa não produz nada. Nenhuma escada, nenhum
// contorno, nenhuma mensagem — a tela fica exatamente igual. A pessoa esperava
// o comportamento das duas vizinhas de barra (Porta e Luz, que nascem com um
// clique), ou pelo menos uma frase dizendo que ali é preciso arrastar. O mesmo
// gesto COM arrasto cria a escada normalmente.
//
// CAUSA (localizada, não re-descoberta aqui — é só o endereço para quem for
// consertar, esta jornada não afirma nada sobre o código):
//   - client/src/lib/stairs.ts:6-8 — `isValidStairDraft` só recusa quando
//     início e fim são o MESMO ponto, que é exatamente o clique sem arrasto.
//   - client/src/pixi/PixiCanvas.tsx:3158-3174 — no pointerup, draft recusado
//     zera `stairDraftStart` e limpa o `draftGraphics` e acabou: nenhum toast,
//     nenhuma dica, nada. A ferramenta Porta, no mesmo arquivo (linha 2259),
//     empurra um aviso pelo `useToastStore` quando o clique erra o alvo — o
//     caminho de fala já existe no projeto e a Escada não usa.
//
// CONTRATO QUE ESTA JORNADA FIXA — e o builder escolhe QUAL das duas saídas
// entrega, porque as duas atendem a pessoa:
//   (a) o clique cria uma escada de tamanho padrão, e ela APARECE no mapa; ou
//   (b) a tela ganha uma frase nova, legível, dizendo o que fazer (ou por que
//       não deu).
// O que esta jornada recusa é a terceira opção de hoje: a tela continuar igual.
//
// POR QUE A REGRA DE "TEXTO NOVO" (e não "existe um aviso na tela"). A barra já
// tem um balão `role="status"` com a dica da ferramenta ativa
// (Toolbar.tsx:523), e para a Escada essa dica JÁ diz "Clique e arraste para
// desenhar um lance de escada" (labels.ts:92). Exigir só a PRESENÇA de um aviso
// seria verde desde antes do defeito existir. Por isso a linha de base é lida
// com a ferramenta já armada e o balão já na tela: só conta o que APARECEU
// depois do clique. Consequência assumida: um conserto cujo único efeito fosse
// re-exibir aquela mesma frase, palavra por palavra, não seria visto por este
// detector — a dica já foi lida pela pessoa e não a ajudou. Frase nova, toast,
// ou a escada desenhada: qualquer um dos três passa.
//
// Coordenadas: o painel lateral (~0-280px) e a barra (~0-70px) ficam POR CIMA
// do canvas, então o ponto do relato (500, 300) está em área livre de mapa —
// mesmo cuidado de task-jornada-peca-muda e task-jornada-ferramentas-mudas.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'

// Disco apertado: esta spec não precisa de trace/vídeo/screenshot de falha — a
// prova que interessa já vai na mensagem da asserção.
test.use({ trace: 'off', video: 'off', screenshot: 'off' })

/** O ponto exato do relato, em offset dentro do `<canvas>`. */
const PONTO_DO_RELATO = { dx: 500, dy: 300 }

/**
 * Lado do quadrado de tela que a sonda observa, centrado no ponto do clique.
 * Generoso de propósito: uma escada "Grande" nascida ali pode ser desenhada a
 * partir do ponto, centrada nele ou encostada na grade mais próxima, e a
 * jornada não deve depender de qual dessas o conserto escolher.
 */
const LADO_DA_SONDA = 160

/**
 * Quantos pixels precisam mudar para contar como "tem desenho novo aqui".
 * Muito acima do ruído medido (o controle positivo prova que parado dá zero) e
 * muito abaixo do que um lance de escada pinta.
 */
const PIXELS_PARA_CONTAR_COMO_DESENHO = 200

/** Diferença por canal que já conta como pixel diferente (anti-serrilhado). */
const TOLERANCIA_DE_CANAL = 12

/** "Em segundos, não para sempre em silêncio." */
const LIMIAR_DE_RESPOSTA_MS = 5_000
const PASSO_POLL_MS = 200

/**
 * Vocabulário de RESPOSTA ao gesto. Largo em forma, estreito em tema: a jornada
 * não trava a redação (isso é de quem conserta), mas o texto novo precisa falar
 * do gesto ou da falha — não serve qualquer número que piscou na tela.
 */
const FALA_DO_GESTO =
  /arrast|n[ãa]o foi poss[íi]vel|n[ãa]o consegu|n[ãa]o deu|n[ãa]o criou|precis|falh|erro|curt|curto demais|pequen|segure|solte/i

/** O que `page.screenshot()` devolve. Escrito assim porque o tsconfig do e2e
 *  não carrega os tipos do Node, e `Buffer` só existe lá como valor. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

async function caixaDoCanvas(page: Page) {
  const caixa = await page.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

/** Recorte de tela centrado no ponto do gesto. */
function recorteDaSonda(alvo: { x: number; y: number }) {
  return {
    x: alvo.x - LADO_DA_SONDA / 2,
    y: alvo.y - LADO_DA_SONDA / 2,
    width: LADO_DA_SONDA,
    height: LADO_DA_SONDA,
  }
}

/**
 * Quantos pixels diferem entre duas fotos do MESMO recorte. Compara imagem
 * decodificada, nunca bytes do PNG: encoder que varia por capricho daria
 * "mudou" sem nada ter mudado, que é verde falso — o pior resultado possível
 * para uma jornada cujo veredito é justamente "mudou ou não mudou".
 */
async function pixelsDiferentes(page: Page, antes: Foto, depois: Foto, tolerancia: number): Promise<number> {
  return page.evaluate(
    async ([b64Antes, b64Depois, tol]: [string, string, number]) => {
      const decodificar = async (b64: string) => {
        const img = new Image()
        img.src = `data:image/png;base64,${b64}`
        await img.decode()
        const tela = document.createElement('canvas')
        tela.width = img.width
        tela.height = img.height
        const ctx = tela.getContext('2d')
        if (!ctx) throw new Error('sem contexto 2d')
        ctx.drawImage(img, 0, 0)
        return ctx.getImageData(0, 0, img.width, img.height).data
      }
      const a = await decodificar(b64Antes)
      const b = await decodificar(b64Depois)
      if (a.length !== b.length) throw new Error('recortes de tamanhos diferentes')
      let diferentes = 0
      for (let i = 0; i < a.length; i += 4) {
        if (
          Math.abs(a[i] - b[i]) > tol ||
          Math.abs(a[i + 1] - b[i + 1]) > tol ||
          Math.abs(a[i + 2] - b[i + 2]) > tol
        ) {
          diferentes++
        }
      }
      return diferentes
    },
    [antes.toString('base64'), depois.toString('base64'), tolerancia] as [string, string, number],
  )
}

/**
 * Tudo que uma pessoa CONSEGUE LER agora, linha a linha. `innerText` (não
 * `textContent`) de propósito: já respeita `display:none`, `visibility:hidden` e
 * o que está fora de fluxo — é a leitura do olho. Nenhuma store é consultada.
 */
async function textoNaTela(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document.body.innerText
      .split('\n')
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0),
  )
}

function linhasNovas(base: string[], agora: string[]): string[] {
  const conhecidas = new Set(base)
  return agora.filter((linha) => !conhecidas.has(linha))
}

/**
 * Arma a Escada do jeito que a pessoa armou: botão da barra e, na setinha de
 * variantes, o tamanho "Grande" — o estado que ela descreveu ver na tela
 * ("PRÓXIMA ESCADA Grande") antes de dar o clique.
 */
async function armarEscadaGrande(page: Page) {
  await pickTool(page, 'Escada')
  await expect(page.getByRole('button', { name: 'Escada', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Opções de Escada', exact: true }).click()
  await page
    .getByRole('group', { name: 'Opções de Escada' })
    .getByRole('radio', { name: 'Grande', exact: true })
    .click()
  // A barra precisa terminar de trocar dica/eco antes da linha de base: o que
  // já estava na tela quando a pessoa clicou não pode contar como resposta.
  await page.waitForTimeout(800)
}

/** Arrasto de gente: aperta, move em vários passos, PAUSA apertado, só então solta. */
async function arrastar(page: Page, de: { x: number; y: number }, ate: { x: number; y: number }, passos = 12) {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  for (let i = 1; i <= passos; i++) {
    await page.mouse.move(de.x + ((ate.x - de.x) * i) / passos, de.y + ((ate.y - de.y) * i) / passos)
  }
  await page.waitForTimeout(160)
  await page.mouse.up()
  await page.waitForTimeout(300)
}

/** Clique de gente: aperta, segura um instante no mesmo ponto, solta. */
async function clicar(page: Page, alvo: { x: number; y: number }) {
  await page.mouse.move(alvo.x, alvo.y)
  await page.mouse.down()
  await page.waitForTimeout(90)
  await page.mouse.up()
}

test.describe('A ferramenta Escada responde ao clique simples', () => {
  test('controle positivo: a sonda de tela enxerga a escada do arrasto, fica em zero parada, e o detector de texto vê texto novo', async ({
    page,
  }) => {
    await enterEditor(page)
    await armarEscadaGrande(page)

    const caixa = await caixaDoCanvas(page)
    const alvo = { x: caixa.x + PONTO_DO_RELATO.dx, y: caixa.y + PONTO_DO_RELATO.dy }
    const recorte = recorteDaSonda(alvo)

    // 1. Calibração NEGATIVA: parada, sem gesto nenhum, a sonda não pode acusar
    //    mudança. Sem isto, "mudou" poderia ser ruído e a jornada ficaria verde
    //    com o app morto.
    const primeiraFoto = await page.screenshot({ clip: recorte })
    await page.waitForTimeout(500)
    const segundaFoto = await page.screenshot({ clip: recorte })
    expect(
      await pixelsDiferentes(page, primeiraFoto, segundaFoto, TOLERANCIA_DE_CANAL),
      'a sonda acusou mudança sem gesto nenhum: ela é ruidosa e o veredito da jornada não valeria',
    ).toBe(0)

    // 2. Calibração POSITIVA: o MESMO ponto, a MESMA ferramenta, mudando só o
    //    gesto — arrasto em vez de clique. Se a sonda não vir a escada aqui,
    //    "nada mudou" e "sonda cega" seriam o mesmo resultado.
    await arrastar(page, alvo, { x: alvo.x + 240, y: alvo.y + 12 })
    const depoisDoArrasto = await page.screenshot({ clip: recorte })
    expect(
      await pixelsDiferentes(page, primeiraFoto, depoisDoArrasto, TOLERANCIA_DE_CANAL),
      'o arrasto com a Escada não deixou marca visível no recorte: a sonda de pixel está cega',
    ).toBeGreaterThan(PIXELS_PARA_CONTAR_COMO_DESENHO)

    // 3. Calibração do DETECTOR DE TEXTO: trocar de ferramenta troca a dica da
    //    barra, então há texto novo de verdade para ele achar.
    const baseDeTexto = await textoNaTela(page)
    await pickTool(page, 'Porta')
    await expect
      .poll(async () => linhasNovas(baseDeTexto, await textoNaTela(page)).length, { timeout: LIMIAR_DE_RESPOSTA_MS })
      .toBeGreaterThan(0)
  })

  test('clique simples com a Escada armada não deixa a tela igual: ou nasce a escada, ou a tela diz o que fazer', async ({
    page,
  }) => {
    await enterEditor(page)
    await armarEscadaGrande(page)

    const caixa = await caixaDoCanvas(page)
    const alvo = { x: caixa.x + PONTO_DO_RELATO.dx, y: caixa.y + PONTO_DO_RELATO.dy }
    const recorte = recorteDaSonda(alvo)

    // Linha de base COM a ferramenta já armada: a dica que já estava na tela
    // não conta como resposta ao clique.
    const telaAntes = await page.screenshot({ clip: recorte })
    const textoAntes = await textoNaTela(page)

    // --- O GESTO DO RELATO: um clique simples, sem arrastar.
    await clicar(page, alvo)

    // A resposta pode vir por qualquer um dos dois caminhos, e pode demorar um
    // instante (animação de toast, render do Pixi). Espera até o limiar.
    const limite = Date.now() + LIMIAR_DE_RESPOSTA_MS
    let pixelsMudados = 0
    let novas: string[] = []
    let frase: string | undefined
    for (;;) {
      const telaAgora = await page.screenshot({ clip: recorte })
      pixelsMudados = await pixelsDiferentes(page, telaAntes, telaAgora, TOLERANCIA_DE_CANAL)
      novas = linhasNovas(textoAntes, await textoNaTela(page))
      frase = novas.find((linha) => FALA_DO_GESTO.test(linha))
      if (pixelsMudados > PIXELS_PARA_CONTAR_COMO_DESENHO || frase) break
      if (Date.now() >= limite) break
      await page.waitForTimeout(PASSO_POLL_MS)
    }

    const nasceuEscada = pixelsMudados > PIXELS_PARA_CONTAR_COMO_DESENHO
    const telaFalou = Boolean(frase)

    expect(
      nasceuEscada || telaFalou,
      `A tela ficou muda: ${LIMIAR_DE_RESPOSTA_MS}ms depois do clique simples com a Escada armada` +
        ` em (${PONTO_DO_RELATO.dx}, ${PONTO_DO_RELATO.dy}) nada apareceu.` +
        ` Pixels mudados no recorte de ${LADO_DA_SONDA}x${LADO_DA_SONDA} em volta do clique: ${pixelsMudados}` +
        ` (precisa de mais de ${PIXELS_PARA_CONTAR_COMO_DESENHO} para contar como desenho).` +
        ` Linhas de texto que apareceram depois do clique: ${JSON.stringify(novas)}` +
        ` (nenhuma delas fala do gesto nem da falha).` +
        ' Porta e Luz, as vizinhas de barra, respondem a um clique; a Escada precisa criar a escada' +
        ' ou dizer na tela que ali é preciso arrastar.',
    ).toBe(true)
  })
})
