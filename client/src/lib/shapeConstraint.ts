import type { DrawingTool } from '../types/tools'

/**
 * Trava de proporção ao desenhar forma — item 14 do `docs/PLANO-REFINAMENTO.md`
 * (Onda 2, frente E). PURO: só recebe os dois pontos do arrasto e devolve o
 * ponto final ajustado; não lê `PixiCanvas.tsx`, não mexe em store nem em
 * Pixi. Quem chama isto — e SÓ dentro do bloco de mousemove/pointerup de cada
 * ferramenta de forma — é o integrador da onda; ver o bloco "CONTRATO" no
 * relatório do agente para o trecho pronto para colar.
 *
 * Decisão C3 do plano já resolveu Shift vs. Ctrl: "Shift trava proporção
 * (formas), Ctrl continua travando ângulo (parede/linha/escada)" — mesma
 * convenção de Figma/Excalidraw/Paint. Este módulo só cobre o lado Shift.
 *
 * Alt "desenhar a partir do centro" (pedido como "se fizer sentido" na tarefa)
 * FOI AVALIADO E NÃO ENTROU — ver o comentário longo no fim do arquivo.
 */

export interface Point {
  x: number
  y: number
}

export interface DraftModifiers {
  shift: boolean
  /**
   * Reservado pela assinatura pedida (`{ shift, alt }`), mas não lido por
   * esta função — ver o comentário no fim do arquivo sobre por que "Alt =
   * desenhar do centro" não foi implementado nesta onda. Mantido no tipo
   * (em vez de removido) para o integrador não precisar mudar a chamada se
   * uma resolução futura vier a usá-lo.
   */
  alt: boolean
}

// `rect` e `room` são as duas ferramentas cujo arrasto vai de CANTO a canto
// oposto, com largura e altura calculadas de forma INDEPENDENTE por quem
// constrói o Drawing/Region — `buildRectDrawing`/`buildRoomFromDraft`
// (drawingFactory.ts) fazem `Math.abs(end.x - start.x)` e
// `Math.abs(end.y - start.y)` sem relação entre os dois eixos. São as únicas
// duas ferramentas onde "quadrado perfeito" é um ajuste real, não um no-op —
// tratadas juntas no `switch` de `constrainDraft`, abaixo.

/**
 * Trava o arrasto de `inicio` → `atual` numa proporção 1:1 nos dois eixos,
 * preservando a MAIOR das duas extensões (não a menor) — mesma convenção de
 * Figma/Excalidraw/Paint: segurar Shift e continuar arrastando "puxa" o lado
 * mais curto até alcançar o mais longo, nunca trunca o mais longo até o mais
 * curto (isso pareceria o gesto ignorando metade do arrasto do usuário).
 * Preserva o sinal de cada eixo — arrastar para cima-esquerda continua
 * produzindo um quadrado para cima-esquerda, não espelha para outro
 * quadrante.
 */
function squareFromCorner(inicio: Point, atual: Point): Point {
  const dx = atual.x - inicio.x
  const dy = atual.y - inicio.y
  const side = Math.max(Math.abs(dx), Math.abs(dy))
  return {
    x: inicio.x + Math.sign(dx) * side,
    y: inicio.y + Math.sign(dy) * side,
  }
}

/**
 * Ajusta o ponto de arrasto de uma ferramenta de forma conforme os
 * modificadores de teclado. Sem Shift, devolve `atual` intacto (mesmo
 * comportamento de hoje) — a função é sempre segura de chamar incondicional-
 * mente no bloco de mousemove/pointerup, sem `if` extra no integrador.
 *
 * Cobertura por ferramenta:
 * - `rect`, `room` (Retângulo, Sala): `inicio` é um CANTO, `atual` o canto
 *   oposto — Shift trava em quadrado (ver `squareFromCorner`).
 * - `ellipse`: `inicio` é o CENTRO (já, por padrão — ver mapFactory/
 *   drawingFactory: `ellipseDraftCenter`), `atual` define rx/ry
 *   independentes (`Math.abs(dx)`, `Math.abs(dy)`) — Shift trava em círculo
 *   pela mesma matemática de `squareFromCorner` (o "lado" vira o raio nos
 *   dois eixos).
 * - `circle` (Desenho circular), `roomCircle`, `roomPolygon` (Sala Circular /
 *   Polígono Regular): NÃO fazem nada — devolvem `atual` intacto mesmo com
 *   Shift. Não é uma lacuna: as três já são regulares por construção. O raio
 *   nasce de `Math.hypot(atual - centro)` (uma distância só, não dx/dy
 *   independentes — ver `isValidCircleDraft`/`buildCircleDrawing` e
 *   `buildRegularPolygonRoomFromDraft`, drawingFactory.ts), então não existe
 *   "largura" e "altura" separadas para travar juntas. Se Shift for lido de
 *   qualquer forma nesses casos (porque o integrador chama esta função
 *   incondicionalmente em todo bloco de forma, por uniformidade), o retorno
 *   idêntico ao input já é o comportamento certo.
 * - qualquer outra ferramenta (`wall`, `line`, `stair`, `polygon` livre,
 *   `region`, ...): devolve `atual` intacto. Fora do escopo do item 14 —
 *   parede/linha já têm trava de ÂNGULO por Ctrl (`constrainToAngleStep`,
 *   pixi/world.ts), e polígono livre/região não têm noção de "proporção"
 *   (são uma lista de vértices clicados, não um arrasto de dois pontos).
 */
export function constrainDraft(inicio: Point, atual: Point, ferramenta: DrawingTool, modificadores: DraftModifiers): Point {
  if (!modificadores.shift) return atual

  switch (ferramenta) {
    case 'rect':
    case 'room':
      return squareFromCorner(inicio, atual)
    case 'ellipse':
      // Mesma conta de canto→quadrado: aqui `inicio` é o centro e o "lado"
      // vira o raio aplicado aos dois eixos — quem monta rx/ry
      // (PixiCanvas.tsx, `Math.abs(end.x - center.x)`) recebe os dois iguais
      // sem precisar saber que veio de um Shift.
      return squareFromCorner(inicio, atual)
    default:
      return atual
  }
}

// ─────────────────────────────────────────────────────────────
// POR QUE "ALT = DESENHAR DO CENTRO" NÃO FOI IMPLEMENTADO — ver CONTRATO no
// relatório do agente para o texto completo endereçado ao integrador. Resumo
// dos dois motivos, cada um sozinho já bastaria:
//
// 1. CONFLITO DE TECLA REAL, não hipotético: TODO bloco de arrasto de forma
//    em PixiCanvas.tsx já lê `event.altKey` para inverter o snap de grade
//    (`applySnap(worldPoint, map.grid, 'wall', event.altKey)` — presente nos
//    blocos de mousemove/pointerup de `rect`, `ellipse`, `room`,
//    `roomCircle`/`roomPolygon` e `circle`, sem exceção). Ler `event.altKey`
//    de novo para outro significado no MESMO gesto faria Alt fazer duas
//    coisas ao mesmo tempo — exatamente o que a tarefa pediu para evitar.
//
// 2. A ASSINATURA PEDIDA NÃO CONSEGUE EXPRESSAR "do centro" para `rect`/
//    `room`: estas duas são as únicas onde o ajuste teria efeito real (ver
//    tabela de cobertura acima), mas nelas `inicio` É um canto, fixado no
//    `pointerdown` (`rectDraftStart`/`roomDraftStart`, PixiCanvas.tsx) —
//    ANTES de `constrainDraft` rodar. "Do centro" exige reinterpretar
//    `inicio` como CENTRO e recalcular os DOIS cantos, mas esta função só
//    devolve um ponto ajustado (`atual`), nunca `inicio`. Não dá para
//    expressar isso sem também mudar o que fica gravado em `rectDraftStart`
//    no pointerdown — que já aconteceu antes de qualquer tecla modificadora
//    do arrasto ser lida.
//
// Proposta para o integrador, se "do centro" for reaberto numa onda futura:
// usar Ctrl, não Alt — Ctrl está LIVRE em rect/ellipse/room/roomCircle/
// roomPolygon/circle hoje (só wall/line/stair o usam, para ângulo — decisão
// C3 do plano). E precisaria de uma função irmã com assinatura diferente,
// por exemplo `centerFromCorner(inicio, atual): { start: Point; end: Point }`,
// chamada no PRÓPRIO pointerdown (recalculando `rectDraftStart` ali, não só
// no preview), porque é lá que `inicio` nasce.
// ─────────────────────────────────────────────────────────────
