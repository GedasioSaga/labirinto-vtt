/**
 * O MODO DO GESTO do editor (`PixiCanvas.tsx`): o estado da máquina de gestos
 * do palco — o que o botão apertado está fazendo agora. `pointerdown` escolhe o
 * modo, `pointermove` e `pointerup` leem, e o fim do gesto volta a `idle`.
 * Mora fora do canvas para o tipo e as perguntas sobre ele (o gesto mexe no
 * mapa?) terem um lugar só.
 */
export type ModoDoGesto =
  | 'idle'
  | 'panning'
  | 'dragging-token'
  | 'dragging-prop'
  | 'drawing-wall'
  | 'drawing-freehand'
  | 'drawing-line'
  | 'drawing-circle'
  | 'drawing-rect'
  | 'drawing-ellipse'
  | 'drawing-polygon'
  | 'drawing-light'
  | 'drawing-curve'
  | 'dragging-curve-point'
  | 'dragging-curve-body'
  // Alça de ponto-chave do traço do Pincel e do polígono (lib/pontosChave.ts).
  | 'dragging-drawing-key-point'
  | 'dragging-light-radius'
  | 'erasing'
  | 'drawing-room'
  | 'drawing-polygon-room'
  | 'drawing-stair'
  | 'resizing-room-corner'
  | 'dragging-wall-point'
  | 'dragging-region-point'
  | 'dragging-wall-body'
  | 'dragging-region-body'
  | 'dragging-stair-body'
  // Alças da escada selecionada (pixi/stairHandleGesture.ts).
  | 'resizing-stair'
  // Alça de curvar da cerca selecionada (pixi/cercaCurvaGesture.ts).
  | 'curving-fence'
  // Alça de ponta da porta selecionada (pixi/doorEndGesture.ts).
  | 'resizing-door'
  | 'dragging-line-point'
  | 'dragging-line-body'
  // B3 (bug3 "mover e redimensionar"): resize por canto de Drawing
  // rect/ellipse/polygon, Token e Prop — geometria em objectTransform.ts.
  | 'resizing-drawing-corner'
  // Onda 3, item 18 (Frente B) — alça de raio do Drawing 'circle'.
  | 'resizing-drawing-radius'
  | 'resizing-token'
  | 'resizing-prop-corner'
  // Chip de canto do carimbo selecionado (`carimboAlcaGesture.ts`).
  | 'resizing-carimbo'
  // N3 "ferramenta de seleção de área".
  | 'area-marquee-drag'
  | 'dragging-area-selection'
  // Chão por peças: arrasto de criação e mover corpo da peça selecionada.
  | 'drawing-floor'
  | 'dragging-floor-body'
  // Pincel de blocos: arrasto que pinta (botão esquerdo) ou apaga (direito).
  | 'painting-floor-blocks'
  // A4 — arrastar só o nome da Sala.
  | 'dragging-room-label'
  // A5 — arrasto de criação da Zona oculta.
  | 'drawing-conceal-zone'
  // Pincel de revelar: arrasto que revela (ou, com Alt, esconde) um pedaço da zona oculta.
  | 'painting-reveal-brush'
  // Penhasco: arrasto que risca (ou, com Alt, apaga) penhasco na costa.
  | 'painting-penhasco'
  // Barranco: risco, traço da área alta ou clique de rampa (`barrancoNoEditor.ts`).
  | 'painting-barranco'
  // Abismo: o contorno da boca à mão (`abismoNoEditor.ts`).
  | 'painting-abismo'
  // Água: o traço do rio ou o contorno do lago e do mar (`aguaNoEditor.ts`).
  | 'painting-agua'
  // Muro de fogo: o traço à mão ou o canto do ponto a ponto (`muroDeFogoNoEditor.ts`).
  | 'painting-muro-de-fogo'
  // Texturas: arrasto do pincel (ou da borracha) de textura.
  | 'painting-textura'
  // Neblina: arrasto do pincel (ou da borracha) de neblina (`neblinaNoEditor.ts`).
  | 'painting-neblina'
  // Carimbos: o clique (ou o spray, ou a borracha) de objetos.
  | 'painting-carimbo'
  // Mover um pino de ponto de interesse já cravado.
  | 'dragging-pin'
  // Papel no chão (`papelNoMapaGesture.ts`): o corpo segura (toque abre a ficha, arrasto move) e o chip de canto muda o tamanho.
  | 'dragging-papel'
  | 'resizing-papel'
  // Selo do desafio (`seloNoMapaGesture.ts`): o corpo segura (toque abre a ficha, arrasto move o posto num ponto) e o chip de canto muda o tamanho.
  | 'dragging-selo'
  | 'resizing-selo'
  // A alça de girar do selo do desafio (`seloNoMapaGesture.ts`).
  | 'rotating-selo'
  // Girar sala pela alça (pixi/roomRotateGesture.ts).
  | 'rotating-room'

/**
 * SINAL DE GESTO EM CURSO (análise de 18/11/2026): com o botão apertado num
 * arrasto, a store barra Ctrl+Z, Ctrl+Y, Delete, Ctrl+D e as setas. Mover a
 * vista (`panning`) não mexe no mapa e não barra nada.
 */
export function gestoMexeNoMapa(modo: ModoDoGesto): boolean {
  return modo !== 'idle' && modo !== 'panning'
}
