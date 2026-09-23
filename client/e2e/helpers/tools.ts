import type { Page } from '@playwright/test'

/**
 * As 7 formas que moram no botão "Desenho" da barra (TOOL_CLUSTERS.drawing em
 * src/components/labels.ts). Lista duplicada de propósito: é o contrato que o
 * usuário vê, e o spec task-drawing-group prova que a barra bate com ela.
 */
export const DRAWING_SHAPE_LABELS = ['Pincel', 'Linha', 'Curva', 'Círculo', 'Elipse', 'Retângulo', 'Polígono'] as const

function isDrawingShape(label: string): boolean {
  return (DRAWING_SHAPE_LABELS as readonly string[]).includes(label)
}

/**
 * Ativa uma ferramenta pela UI real. Forma de desenho: setinha "Opções de
 * Desenho" e o rádio da forma, escopado no grupo do menu (o rádio escolhe a
 * ferramenta e fecha o menu). Qualquer outra: o botão da barra pelo nome exato.
 */
export async function pickTool(page: Page, label: string): Promise<void> {
  if (isDrawingShape(label)) {
    await page.getByRole('button', { name: 'Opções de Desenho', exact: true }).click()
    await page.getByRole('group', { name: 'Opções de Desenho' }).getByRole('radio', { name: label, exact: true }).click()
    return
  }
  await page.getByRole('button', { name: label, exact: true }).click()
}
