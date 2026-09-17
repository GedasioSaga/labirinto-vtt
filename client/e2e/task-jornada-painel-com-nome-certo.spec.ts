// JORNADA — "o painel diz o nome da ferramenta que eu apertei".
//
// Dor observada em passeio cego: o usuário aperta Sala Circular (J) e a coluna
// da esquerda abre com o título "REGIÃO", que é o nome de OUTRA ferramenta da
// mesma barra. Quem chega acha que errou o botão. O título só vira "SALA"
// depois de desenhar — tarde demais, a dúvida já aconteceu.
//
// Tudo aqui é pela TELA: gesto real (tecla e clique no botão da barra), estado
// lido pelo `aria-pressed` do botão, e a asserção no texto do primeiro título
// visível do painel. Nada de store, nada de `relevantPropertyGroups` — se a
// regra passasse a valer por outro caminho de implementação, esta jornada
// continuaria válida.
//
// Não desenha e não seleciona nada de propósito: o momento que dói é o
// PRIMEIRO, entre apertar a ferramenta e o primeiro traço.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

test.use({ trace: 'off', video: 'off' })

/** Coluna da esquerda (PropertiesPanel) — só o corpo rolável, sem o cabeçalho do mapa. */
const PAINEL = '.lb-inspector__body'

/**
 * Nomes que o usuário lê nos botões da barra. Lista escrita à mão de
 * propósito: é o contrato visível, não um import do código sob teste.
 */
const NOMES_DA_BARRA = [
  'Selecionar',
  'Parede',
  'Porta',
  'Luz',
  'Região',
  'Sala',
  'Sala Circular',
  'Polígono Regular',
  'Chão',
  'Escada',
  'Peça',
  'Zona oculta',
  'Texto',
  'Medir',
  'Borracha',
]

interface Ferramenta {
  /** Nome exato do botão na barra — o que o usuário lê e clica. */
  botao: string
  /** Letra do atalho, o outro caminho até o MESMO comando. */
  tecla: string
}

const FERRAMENTAS: Record<string, Ferramenta> = {
  regiao: { botao: 'Região', tecla: 'g' },
  parede: { botao: 'Parede', tecla: 'w' },
  salaCircular: { botao: 'Sala Circular', tecla: 'j' },
  sala: { botao: 'Sala', tecla: 'n' },
  poligonoRegular: { botao: 'Polígono Regular', tecla: 'q' },
}

/** minúscula, sem acento — o título aparece em CAIXA ALTA por CSS (`.lb-eyebrow`). */
function normaliza(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** "Sala Circular" -> "sala"; "Polígono Regular" -> "poligono". */
function palavraChave(nomeDaFerramenta: string): string {
  return normaliza(nomeDaFerramenta).split(' ')[0]
}

/**
 * O que o usuário lê primeiro na coluna da esquerda. `:visible` porque seção
 * recolhida não conta — e `innerText` (não `textContent`) porque é o texto
 * RENDERIZADO, já com o caixa-alta do CSS: é literalmente o que está na tela.
 */
async function primeiroTituloDoPainel(page: Page): Promise<string> {
  const primeiro = page.locator(`${PAINEL} h2:visible`).first()
  await expect(primeiro).toBeVisible()
  return (await primeiro.innerText()).trim()
}

/** Ativa pela tecla e confirma na tela que o botão da barra ficou apertado. */
async function ativarPorTecla(page: Page, ferramenta: Ferramenta): Promise<void> {
  await page.locator('canvas').first().waitFor()
  await page.keyboard.press(ferramenta.tecla)
  await expect(page.getByRole('button', { name: ferramenta.botao, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
}

/** Ativa clicando no botão da barra e confirma na tela que ele ficou apertado. */
async function ativarPorClique(page: Page, ferramenta: Ferramenta): Promise<void> {
  const botao = page.getByRole('button', { name: ferramenta.botao, exact: true })
  await botao.click()
  await expect(botao).toHaveAttribute('aria-pressed', 'true')
}

/** Volta para Selecionar entre os dois caminhos, para o segundo começar do zero. */
async function voltarParaSelecionar(page: Page): Promise<void> {
  await ativarPorClique(page, { botao: 'Selecionar', tecla: 'v' })
}

/**
 * A REGRA: com a ferramenta X ativa e nada desenhado nem selecionado, o
 * primeiro título do painel tem que falar de X.
 *
 * Duas checagens, a mesma ideia: (1) o título não pode ser, letra por letra, o
 * nome de OUTRA ferramenta da barra — esse é o caso que engana o usuário; e
 * (2) o título tem que trazer a palavra-chave da ferramenta ativa.
 */
async function painelPrecisaNomearFerramenta(page: Page, ferramenta: Ferramenta, caminho: string): Promise<void> {
  const titulo = await primeiroTituloDoPainel(page)
  const visto = normaliza(titulo)

  const nomeDeOutra = NOMES_DA_BARRA.find(
    (nome) => normaliza(nome) === visto && normaliza(nome) !== normaliza(ferramenta.botao),
  )
  expect(
    nomeDeOutra ?? null,
    `[${caminho}] Ferramenta ativa: "${ferramenta.botao}". O primeiro título do painel é "${titulo}", ` +
      `que é o nome de OUTRA ferramenta da barra ("${nomeDeOutra}"). ` +
      'O usuário lê isso e acha que apertou o botão errado.',
  ).toBeNull()

  expect(
    visto,
    `[${caminho}] Ferramenta ativa: "${ferramenta.botao}". O primeiro título do painel é "${titulo}", ` +
      `que não fala de "${ferramenta.botao}" (esperava conter "${palavraChave(ferramenta.botao)}").`,
  ).toContain(palavraChave(ferramenta.botao))
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

// ---------------------------------------------------------------------------
// CONTROLES POSITIVOS — provam que o leitor de "primeiro título" lê certo.
// Se estes dois falharem, o vermelho dos outros não vale nada: seria o leitor
// quebrado, não o app.
// ---------------------------------------------------------------------------

test('controle positivo: com Região ativa, o painel abre dizendo "Região"', async ({ page }) => {
  await ativarPorTecla(page, FERRAMENTAS.regiao)
  await painelPrecisaNomearFerramenta(page, FERRAMENTAS.regiao, 'tecla G')

  await voltarParaSelecionar(page)

  await ativarPorClique(page, FERRAMENTAS.regiao)
  await painelPrecisaNomearFerramenta(page, FERRAMENTAS.regiao, 'clique no botão')
})

test('controle positivo: com Parede ativa, o painel abre dizendo "Parede"', async ({ page }) => {
  await ativarPorTecla(page, FERRAMENTAS.parede)
  await painelPrecisaNomearFerramenta(page, FERRAMENTAS.parede, 'tecla W')

  await voltarParaSelecionar(page)

  await ativarPorClique(page, FERRAMENTAS.parede)
  await painelPrecisaNomearFerramenta(page, FERRAMENTAS.parede, 'clique no botão')
})

// ---------------------------------------------------------------------------
// A DOR — a mesma regra, nas ferramentas que hoje mentem o nome.
// ---------------------------------------------------------------------------

test('Sala Circular pela tecla J: o painel abre com o nome da Sala Circular, não de outra ferramenta', async ({
  page,
}) => {
  await ativarPorTecla(page, FERRAMENTAS.salaCircular)
  await painelPrecisaNomearFerramenta(page, FERRAMENTAS.salaCircular, 'tecla J')
})

test('Sala Circular pelo botão da barra: o painel abre com o nome da Sala Circular', async ({ page }) => {
  await ativarPorClique(page, FERRAMENTAS.salaCircular)
  await painelPrecisaNomearFerramenta(page, FERRAMENTAS.salaCircular, 'clique no botão')
})

test('Sala: o painel abre com o nome da Sala pelos dois caminhos', async ({ page }) => {
  await ativarPorTecla(page, FERRAMENTAS.sala)
  await painelPrecisaNomearFerramenta(page, FERRAMENTAS.sala, 'tecla N')

  await voltarParaSelecionar(page)

  await ativarPorClique(page, FERRAMENTAS.sala)
  await painelPrecisaNomearFerramenta(page, FERRAMENTAS.sala, 'clique no botão')
})

test('Polígono Regular: o painel abre com o nome do Polígono Regular pelos dois caminhos', async ({ page }) => {
  await ativarPorTecla(page, FERRAMENTAS.poligonoRegular)
  await painelPrecisaNomearFerramenta(page, FERRAMENTAS.poligonoRegular, 'tecla Q')

  await voltarParaSelecionar(page)

  await ativarPorClique(page, FERRAMENTAS.poligonoRegular)
  await painelPrecisaNomearFerramenta(page, FERRAMENTAS.poligonoRegular, 'clique no botão')
})
