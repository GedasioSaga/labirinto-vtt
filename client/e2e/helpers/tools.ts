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
    await escolherNoMenu(page, 'Desenho', label)
    return
  }
  const agrupada = FERRAMENTA_AGRUPADA[label]
  if (agrupada) {
    await page.getByRole('button', { name: `Opções de ${agrupada.botao}`, exact: true }).click()
    await escolherNoMenu(page, agrupada.botao, agrupada.opcao)
    return
  }
  await page.getByRole('button', { name: label, exact: true }).click()
}

/**
 * Clica o rádio e espera o menu sair da tela: o arrasto logo depois não pode
 * cair no menu que ainda está fechando.
 */
async function escolherNoMenu(page: Page, botao: string, opcao: string): Promise<void> {
  const menu = page.getByRole('group', { name: `Opções de ${botao}` })
  await menu.getByRole('radio', { name: opcao, exact: true }).click()
  await menu.waitFor({ state: 'detached' })
}

/** A ferramenta é um rádio do menu de Sala ou Objeto, não um botão próprio da barra. */
export function moraNumMenu(label: string): boolean {
  return FERRAMENTA_AGRUPADA[label] !== undefined
}

/**
 * Fatia 6 do design consolidado: as salas e a Região moram no botão "Sala", e
 * o móvel e a Peça no botão "Objeto" (TOOL_CLUSTERS em src/components/labels.ts).
 * A chave é o nome da ferramenta (TOOL_LABELS); o valor, o botão e o rádio do
 * menu dele (SALA_SHAPE_GROUP e OBJETO_KIND_GROUP em src/lib/toolVariants.ts).
 */
const FERRAMENTA_AGRUPADA: Record<string, { botao: string; opcao: string } | undefined> = {
  Sala: { botao: 'Sala', opcao: 'Retângulo' },
  'Sala Circular': { botao: 'Sala', opcao: 'Circular' },
  'Polígono Regular': { botao: 'Sala', opcao: 'Polígono' },
  'Sala livre': { botao: 'Sala', opcao: 'Livre' },
  Região: { botao: 'Sala', opcao: 'Região' },
  Objetos: { botao: 'Objeto', opcao: 'Móvel' },
  Peça: { botao: 'Objeto', opcao: 'Imagem' },
}
