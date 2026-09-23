// JORNADA DE USUÁRIO da TELA DE ATALHOS — escrita para SAIR VERMELHA no código
// de hoje. É a régua da feature, não a feature.
//
// A FEATURE (docs/features-candidatas-2026-09-21.md, item 5):
//   - a tecla ? SEM pino selecionado abre um painel com o que cada letra e
//     cada combinação faz, agrupado por assunto;
//   - com pino selecionado, ? continua trocando o tipo do pino ("!" <-> "?")
//     e NÃO abre o painel;
//   - Esc fecha o painel;
//   - o painel também abre por um botão de ajuda visível no editor;
//   - ? digitado dentro de campo de texto é texto, não abre nada.
// A dor (passeio, achados 2 e 13): digitar SAIDA no rótulo trocou de
// ferramenta cinco vezes e nada avisou; o atalho só aparece em tooltip solto.
//
// ONDE ISSO MORRE HOJE:
//   - client/src/lib/keymap.ts:267 — `?` sempre vira `togglePinType`; não há
//     ação de "abrir ajuda" no mapa de teclas;
//   - client/src/pixi/PixiCanvas.tsx:5371-5374 — sem pino selecionado o
//     `togglePinType` faz `break` e a tecla some sem efeito;
//   - client/src/components/Toolbar.tsx:219-223 (`tipWithShortcut`) — a única
//     vitrine dos atalhos é o "(W)" no tooltip de cada botão; Ctrl+Z, F, setas
//     e ? não aparecem em lugar nenhum. Não existe botão de ajuda.
//
// COMO ESTE ARQUIVO PROVA, sem mentir:
//   MAPA NOVO PELO MENU: `enterEditor` cria o mapa pelo menu inicial, como a
//   pessoa faz. Nenhum `evaluate` muda estado (o do helper só IMPORTA módulos).
//   GESTO REAL: clique de ponteiro (move, pausa, desce, pausa, sobe), arrasto
//   com pausa antes de soltar para desenhar a sala, teclas reais do teclado
//   (? como o dedo aperta: Shift + a tecla da barra).
//   PROVA NA TELA: nome acessível do painel e do botão, texto visível de cada
//   linha do painel, `aria-checked` do rádio do tipo do pino, valor do campo
//   de texto. Nada é lido da store. A lista de letras cobrada vem de
//   `TOOL_SHORTCUTS`/`TOOL_LABELS` (src) só como GABARITO: é a mesma tabela que
//   escreve o "(W)" dos tooltips da barra, então o painel tem de bater com o
//   que a barra já promete.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o painel é `dialog` (ou `region`) com nome acessível contendo "Atalhos"
//     (ex.: "Atalhos do teclado");
//   - o botão de ajuda é um `button` visível no editor, sem precisar de hover,
//     com nome acessível contendo "Atalhos", "Ajuda" ou "teclado"; o lugar é
//     livre (barra de ferramentas, barra de ações, canto do mapa);
//   - "agrupado por assunto" = pelo menos 2 títulos (`heading`) ou grupos
//     (`group`) dentro do painel;
//   - cada linha do painel é um elemento cujo texto visível tem a tecla e o
//     que ela faz, com a letra em MAIÚSCULA como no tooltip ("W" ... "Parede");
//     uma linha tem menos de 120 caracteres (não vale o painel inteiro);
//   - combinação aparece com "Ctrl" e a letra ("Ctrl+Z", "Ctrl Z", "Ctrl + Z")
//     junto de algo com "desfaz"; F junto de algo com "enquadr"; ? junto de
//     algo com "pino".
//
// CONTROLE POSITIVO (verde hoje): teste 1. Prova que o clique no mapa, a
// ferramenta Pino, a seleção e a tecla Shift+Slash chegam ao app (o pino troca
// de "!" para "?"). Sem ele, o vermelho dos testes 2 a 6 poderia ser a tecla
// não chegando, e não a feature ausente.
//
// Não há lado do jogador: o painel é do mestre, no editor, e não trafega nada
// pela rede. Fluidez não se aplica: não há gesto contínuo sob teste.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'
import { TOOL_SHORTCUTS, hiddenTools } from '../src/lib/keymap'
import { TOOL_LABELS } from '../src/components/labels'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })
// Teto do teste INTEIRO, com o beforeEach dentro: medido em 22/09/2026, sob
// várias lanes de Playwright, o `page.goto('/')` do primeiro teste no vite frio
// estourou os 30 s padrão ANTES de o corpo do teste rodar (o `test.setTimeout`
// no corpo chega tarde para o gancho). As esperas da feature seguem curtas.
test.describe.configure({ timeout: 120_000 })

const PAUSA_ANTES_DE_SOLTAR_MS = 150
const PAUSA_DO_DEDO_MS = 80
const PINTURA_MS = 300
const PASSOS_DO_ARRASTO = 12
/** Espera de algo que JÁ existe hoje (controle, painel do pino). */
const TELA_MS = 15_000
/** Espera curta da feature: ausente, tem de falhar rápido. */
const ESPERA_FEATURE_MS = 6_000
/** Uma linha do painel, não o painel inteiro. */
const MAX_CHARS_DA_LINHA = 120

interface Ponto {
  x: number
  y: number
}

/** Pontos em coordenada do canvas, longe dos painéis e da barra (mesmos da vizinha de atalho). */
const VAZIO: Ponto = { x: 760, y: 560 }
const ONDE_CRAVAR_O_PINO: Ponto = { x: 620, y: 360 }
const SALA = { x0: 480, y0: 260, x1: 800, y1: 480 }

const NOME_DO_PAINEL = /atalhos/i
const NOME_DO_BOTAO_DE_AJUDA = /atalhos|ajuda|teclado/i

const barra = (page: Page) => page.getByRole('toolbar', { name: 'Ferramentas do mapa' })
const botaoDaParede = (page: Page) => barra(page).getByRole('button', { name: 'Parede', exact: true })

/** O painel de atalhos: diálogo ou região com "Atalhos" no nome. */
function painelDeAtalhos(page: Page): Locator {
  return page.getByRole('dialog', { name: NOME_DO_PAINEL }).or(page.getByRole('region', { name: NOME_DO_PAINEL }))
}

function tipoDoPino(page: Page): Locator {
  return page.getByRole('radiogroup', { name: 'Tipo do pino' })
}

async function caixaDoCanvas(page: Page): Promise<Ponto> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { x: box.x, y: box.y }
}

/** Clique de pessoa no mapa: move, pausa, desce, pausa, sobe. */
async function clicarNoMapa(page: Page, ponto: Ponto): Promise<void> {
  const c = await caixaDoCanvas(page)
  await page.mouse.move(c.x + ponto.x, c.y + ponto.y)
  await page.waitForTimeout(PAUSA_DO_DEDO_MS)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/** Clique de pessoa num controle: passa o ponteiro, pausa, clica. */
async function clicarNoControle(page: Page, alvo: Locator): Promise<void> {
  await alvo.scrollIntoViewIfNeeded()
  await alvo.hover()
  await page.waitForTimeout(PAUSA_DO_DEDO_MS)
  await alvo.click()
}

/** "?" como o dedo aperta: Shift + a tecla da barra. */
async function apertarInterrogacao(page: Page): Promise<void> {
  await page.keyboard.press('Shift+Slash')
}

/** Crava um pino e o seleciona com Selecionar; devolve com o painel do pino aberto e marcando "!". */
async function cravarESelecionarPino(page: Page): Promise<void> {
  await pickTool(page, 'Pino')
  await clicarNoMapa(page, ONDE_CRAVAR_O_PINO)
  await pickTool(page, 'Selecionar')
  await clicarNoMapa(page, ONDE_CRAVAR_O_PINO)
  await expect(tipoDoPino(page), 'tocar o pino com Selecionar não abriu o painel dele').toBeVisible({ timeout: TELA_MS })
  await expect(
    tipoDoPino(page).getByRole('radio', { name: 'Exclamação (!)' }),
    'o pino recém-cravado não nasceu do tipo "!"',
  ).toHaveAttribute('aria-checked', 'true')
}

/** Letra isolada (não pedaço de palavra), em maiúscula como no tooltip da barra. */
function letraIsolada(letra: string): RegExp {
  return new RegExp(`(^|[^\\p{L}])${letra}([^\\p{L}]|$)`, 'u')
}

/**
 * Existe, dentro do painel, uma LINHA (texto curto) que mostra a tecla e o que
 * ela faz. Lê só o texto visível dos elementos do painel.
 */
async function linhaDoPainel(painel: Locator, tecla: RegExp, oQueFaz: RegExp | string): Promise<string | null> {
  const candidatos = painel.locator('*').filter({ hasText: oQueFaz }).filter({ hasText: tecla })
  const textos = await candidatos.allInnerTexts()
  const linha = textos.map((t) => t.replace(/\s+/g, ' ').trim()).find((t) => t.length > 0 && t.length < MAX_CHARS_DA_LINHA)
  return linha ?? null
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('CONTROLE POSITIVO: com pino selecionado, ? troca o pino de "!" para "?" (a tecla chega ao app)', async ({ page }) => {
  await cravarESelecionarPino(page)

  await apertarInterrogacao(page)

  await expect(
    tipoDoPino(page).getByRole('radio', { name: 'Interrogação (?)' }),
    '? com o pino selecionado não trocou o tipo: a tecla não chegou ao app',
  ).toHaveAttribute('aria-checked', 'true', { timeout: TELA_MS })
})

test('(1) sem pino selecionado, ? com o foco no mapa abre o painel de atalhos', async ({ page }) => {
  await clicarNoMapa(page, VAZIO)
  await expect(painelDeAtalhos(page), 'o painel de atalhos já estava aberto antes da tecla').toHaveCount(0)

  await apertarInterrogacao(page)

  await expect(
    painelDeAtalhos(page),
    '? sem pino selecionado não abriu nenhum painel com "Atalhos" no nome: a tecla some sem efeito (PixiCanvas.tsx togglePinType faz break)',
  ).toBeVisible({ timeout: ESPERA_FEATURE_MS })
})

test('(2) o painel diz o que cada letra e combinação faz, agrupado por assunto', async ({ page }) => {
  await clicarNoMapa(page, VAZIO)
  await apertarInterrogacao(page)
  const painel = painelDeAtalhos(page)
  await expect(painel, '? sem pino selecionado não abriu o painel de atalhos').toBeVisible({ timeout: ESPERA_FEATURE_MS })

  // Agrupado por assunto: pelo menos dois títulos ou grupos dentro do painel.
  const grupos = painel.getByRole('heading').or(painel.getByRole('group'))
  expect(await grupos.count(), 'o painel não tem pelo menos 2 títulos/grupos de assunto').toBeGreaterThanOrEqual(2)

  // Cada ferramenta que a barra promete por letra aparece no painel com a
  // mesma letra. Gabarito = a tabela que escreve o "(W)" dos tooltips.
  const escondidas = hiddenTools()
  const faltando: string[] = []
  for (const [ferramenta, letra] of Object.entries(TOOL_SHORTCUTS) as [keyof typeof TOOL_SHORTCUTS, string][]) {
    const nome = TOOL_LABELS[ferramenta]
    if (!letra || !nome || escondidas.has(ferramenta)) continue
    const linha = await linhaDoPainel(painel, letraIsolada(letra), nome)
    if (linha === null) faltando.push(`${letra} → ${nome}`)
  }
  expect(faltando, `letras de ferramenta ausentes do painel (tecla → ferramenta)`).toEqual([])

  // As combinações e teclas que hoje não aparecem em lugar nenhum.
  const ctrlZ = await linhaDoPainel(painel, /Ctrl\s*\+?\s*Z/i, /desfaz/i)
  expect(ctrlZ, 'o painel não mostra Ctrl+Z com "Desfazer"').not.toBeNull()
  const f = await linhaDoPainel(painel, letraIsolada('F'), /enquadr/i)
  expect(f, 'o painel não mostra F com "enquadrar"').not.toBeNull()
  const interrogacao = await linhaDoPainel(painel, /\?/, /pino/i)
  expect(interrogacao, 'o painel não mostra ? com o que ele faz no pino').not.toBeNull()
})

test('(3) Esc fecha o painel de atalhos', async ({ page }) => {
  await clicarNoMapa(page, VAZIO)
  await apertarInterrogacao(page)
  await expect(painelDeAtalhos(page), '? sem pino selecionado não abriu o painel de atalhos').toBeVisible({
    timeout: ESPERA_FEATURE_MS,
  })

  await page.keyboard.press('Escape')

  await expect(painelDeAtalhos(page), 'Esc não fechou o painel de atalhos').toBeHidden({ timeout: TELA_MS })
})

test('(4) um botão de ajuda visível no editor abre o painel de atalhos, e Esc fecha', async ({ page }) => {
  const botao = page.getByRole('button', { name: NOME_DO_BOTAO_DE_AJUDA }).first()
  await expect(
    botao,
    'não há botão visível com "Atalhos", "Ajuda" ou "teclado" no nome: o atalho só existe em tooltip solto',
  ).toBeVisible({ timeout: ESPERA_FEATURE_MS })

  await clicarNoControle(page, botao)

  await expect(painelDeAtalhos(page), 'o clique no botão de ajuda não abriu o painel de atalhos').toBeVisible({
    timeout: ESPERA_FEATURE_MS,
  })
  await page.keyboard.press('Escape')
  await expect(painelDeAtalhos(page), 'Esc não fechou o painel aberto pelo botão').toBeHidden({ timeout: TELA_MS })
})

test('(5) com pino selecionado ? troca o tipo SEM abrir o painel; desmarcado o pino, ? abre o painel', async ({ page }) => {
  await cravarESelecionarPino(page)

  await apertarInterrogacao(page)
  await expect(
    tipoDoPino(page).getByRole('radio', { name: 'Interrogação (?)' }),
    '? com pino selecionado deixou de trocar o tipo do pino',
  ).toHaveAttribute('aria-checked', 'true', { timeout: TELA_MS })
  await expect(painelDeAtalhos(page), '? com pino selecionado abriu o painel de atalhos em vez de só trocar o tipo').toHaveCount(0)

  // Desmarca o pino com Esc, o "deixa pra lá" do mapa (PixiCanvas.tsx, case
  // 'cancel'). Clique no vazio NÃO larga o pino hoje (medido: o painel dele
  // continua aberto), então não é ele o gesto desta régua.
  await page.keyboard.press('Escape')
  await expect(tipoDoPino(page), 'Esc não desmarcou o pino').toBeHidden({ timeout: TELA_MS })

  await apertarInterrogacao(page)
  await expect(painelDeAtalhos(page), 'desmarcado o pino, ? não abriu o painel de atalhos').toBeVisible({
    timeout: ESPERA_FEATURE_MS,
  })
})

test('(6) ? digitado no nome de uma sala é texto; de volta ao mapa, ? abre o painel', async ({ page }) => {
  const c = await caixaDoCanvas(page)
  await pickTool(page, 'Sala')
  await page.mouse.move(c.x + SALA.x0, c.y + SALA.y0)
  await page.mouse.down()
  for (let passo = 1; passo <= PASSOS_DO_ARRASTO; passo++) {
    const t = passo / PASSOS_DO_ARRASTO
    await page.mouse.move(c.x + SALA.x0 + (SALA.x1 - SALA.x0) * t, c.y + SALA.y0 + (SALA.y1 - SALA.y0) * t)
  }
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()

  const campo = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await expect(campo, 'desenhar a sala tinha de abrir o campo do nome sobre o mapa').toBeFocused({ timeout: TELA_MS })
  await page.keyboard.press('Control+a')
  await page.keyboard.type('Onde?')
  await expect(campo, 'o ? digitado no nome da sala não ficou no campo').toHaveValue('Onde?')
  await expect(painelDeAtalhos(page), '? digitado no nome da sala abriu o painel de atalhos').toHaveCount(0)
  await page.keyboard.press('Enter')

  // De volta ao mapa, sem nada selecionado.
  await pickTool(page, 'Selecionar')
  await clicarNoMapa(page, VAZIO)
  await expect(botaoDaParede(page)).not.toHaveAttribute('aria-pressed', 'true')
  await apertarInterrogacao(page)

  await expect(painelDeAtalhos(page), 'com o foco de volta no mapa, ? não abriu o painel de atalhos').toBeVisible({
    timeout: ESPERA_FEATURE_MS,
  })
})
