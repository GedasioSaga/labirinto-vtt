import type { SelectionSet } from '../selectionModel'

/**
 * Segunda auditoria da batalha (09/11/2026, achado 3): a carta da faixa da
 * ordem e a linha da lista de quem entra ACENDEM uma ficha pondo-a na seleção
 * de verdade do editor (o anel que o mestre já conhece). Com o mouse parado
 * na carta, Delete ou Backspace apagava a ficha acesa.
 *
 * Quem acende marca aqui a seleção que pôs; o editor consulta antes de apagar
 * ou recortar (`pixi/PixiCanvas.tsx`, no `onKeyDown`).
 *
 * A marca é a PRÓPRIA lista de seleção (a referência, não o conteúdo):
 * qualquer seleção que o mestre fizer depois é outra lista, e a marca deixa
 * de valer sozinha, mesmo se quem acendeu esquecer de desmarcar.
 *
 * Sem store e sem dependência da batalha: serve a qualquer lista que acenda
 * ficha pela seleção (o "Atribuir token" de `stores/destaqueNoMapa.ts`).
 */
let realce: SelectionSet | null = null

/** `selecao` (a lista que vai para o editor agora) é só realce. `null` = a seleção que entra não é realce. */
export function marcarRealceNoMapa(selecao: SelectionSet | null): void {
  realce = selecao
}

/** A seleção de agora do editor é só o realce de uma lista? Então apagar e recortar não agem nela. */
export function ehSoRealceNoMapa(selecao: SelectionSet): boolean {
  return selecao.length > 0 && selecao === realce
}
