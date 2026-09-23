// JORNADA VERMELHA — "Salvar respondeu com erro de programador".
//
// Achado 1 do passeio de 20/09/2026 (`docs/passeio-2026-09-20.md`): com a
// página aberta FORA do app desktop (navegador comum, sem Tauri), Salvar,
// Exportar e Início respondem com o texto técnico
// "Cannot read properties of undefined (reading 'invoke')". Quem lê isso não
// sabe se perdeu o mapa, se o app quebrou ou o que fazer.
//
// DECISÃO que esta régua cobra: fora do app, esses botões mostram uma frase
// em português dizendo que salvar em arquivo só funciona no app instalado. O
// texto técnico não aparece.
//
// ONDE O TEXTO NASCE HOJE: `reportFileError` (`src/App.tsx`) monta o aviso com
// `err.message` cru; `invoke` de `@tauri-apps/api/core` lê
// `window.__TAURI_INTERNALS__.invoke`, que não existe no navegador.
//
// CONTROLE POSITIVO: no modo Tauri de mentira que as jornadas vizinhas usam
// (`helpers/tauriFsStub.ts`, disco em memória), Salvar funciona — aparece
// "Mapa salvo" e nenhum aviso de erro. Sem ele, "não mostrou o texto técnico"
// passaria com um Salvar que não responde nada.
//
// REGRAS DE JORNADA: clique real na barra de ações; nenhum `evaluate` que
// mude estado; toda afirmação é sobre texto visível.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'

/** Folga para o aviso aparecer depois do clique. */
const AVISO_MS = 15_000
/** O que a pessoa nunca deveria ler. */
const TEXTO_TECNICO = /Cannot read properties|invoke/i
/** A frase de gente tem de falar do app instalado. */
const FALA_DO_APP = /\bapp\b|aplicativo/i

/** O primeiro aviso que surge no canto (Toast: `role=alert` ou `role=status`). */
function avisos(page: Page): Locator {
  return page.locator('.lb-toaststack .lb-toast')
}

async function clicarNaAcao(page: Page, nome: string): Promise<void> {
  const botao = page.getByRole('button', { name: nome, exact: true })
  await botao.hover()
  await page.waitForTimeout(80)
  await botao.click()
}

/** Espera o aviso que o clique provocou e devolve o texto visível dele. */
async function textoDoAviso(page: Page, oQue: string): Promise<string> {
  const primeiro = avisos(page).first()
  await expect(primeiro, `clicar em ${oQue} fora do app não mostrou aviso nenhum`).toBeVisible({ timeout: AVISO_MS })
  return (await avisos(page).allInnerTexts()).join(' | ')
}

test('CONTROLE POSITIVO: no modo app (disco de mentira), Salvar mostra "Mapa salvo" e nenhum erro', async ({ page }) => {
  test.setTimeout(60_000)
  await installTauriFsStub(page)
  await enterEditor(page)

  await clicarNaAcao(page, 'Salvar')

  await expect(page.getByRole('status').filter({ hasText: 'Mapa salvo' })).toBeVisible({ timeout: AVISO_MS })
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText(TEXTO_TECNICO)).toHaveCount(0)
})

test('(a) fora do app, Salvar explica em português que salvar só funciona no app instalado, sem texto técnico', async ({ page }) => {
  test.setTimeout(60_000)
  await enterEditor(page)

  await clicarNaAcao(page, 'Salvar')
  const texto = await textoDoAviso(page, 'Salvar')

  expect(texto, 'Salvar fora do app mostrou o erro técnico do Tauri em vez de uma frase de gente').not.toMatch(TEXTO_TECNICO)
  expect(texto, 'o aviso de Salvar fora do app não diz que salvar só funciona no app instalado').toMatch(FALA_DO_APP)
})

test('(b) fora do app, Exportar explica em português que só funciona no app instalado, sem texto técnico', async ({ page }) => {
  test.setTimeout(60_000)
  await enterEditor(page)

  await clicarNaAcao(page, 'Exportar mapa (pasta)')
  const texto = await textoDoAviso(page, 'Exportar')

  expect(texto, 'Exportar fora do app mostrou o erro técnico do Tauri em vez de uma frase de gente').not.toMatch(TEXTO_TECNICO)
  expect(texto, 'o aviso de Exportar fora do app não diz que isso só funciona no app instalado').toMatch(FALA_DO_APP)
})
