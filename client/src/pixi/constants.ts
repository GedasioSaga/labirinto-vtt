/** Cor do destaque visual de item selecionado, usada em todas as camadas do canvas. */
export const SELECTION_COLOR = 0xffdd55

/** Cor do indicador de ângulo mostrado durante o arrasto de Parede/Linha — cinza
 * claro discreto, pra não competir com o draft em SELECTION_COLOR nem sumir
 * contra o fundo escuro do canvas (0x2b2b2b, ver PixiCanvas.tsx). */
export const ANGLE_INDICATOR_COLOR = 0xaaaaaa

/** Cor de traço dos degraus de escada (drawStairs.ts) — bege claro, perto do
 * cinza de WALL_COLOR['exterior'] (drawWalls.ts) mas visivelmente distinto,
 * pra não confundir lance de escada com parede num relance à tela. */
export const STAIR_COLOR = 0xc9b896

/**
 * Escala única de peso de traço pro canvas (feedback F4, 31/08/2026: "tudo
 * muito gordo, deixa extremamente fino"). Antes desta constante, cada
 * arquivo escolhia seu próprio número solto sem relação com os outros —
 * `drawStairs.ts` tinha 1/2/3, `drawDoors.ts` tinha 3/4, `drawEditHandles.ts`
 * tinha um `2` isolado pro stroke do midpoint — e por isso "fino" queria
 * dizer coisas diferentes em cada arquivo. Esta é a fonte única pra
 * grade/alças/portas/escada (os 9 arquivos do agente G3). Parede tem escala
 * própria em `drawWalls.ts` (agente G1, fora deste arquivo).
 */
export const STROKE_WEIGHT = {
  /** Traço de referência, quase invisível — linha central da escada, contorno do alcance de luz. */
  hairline: 1,
  /** Traço padrão de elemento não selecionado — ombreira/folha/barra de porta, stroke do midpoint de aresta. */
  thin: 1.5,
  /** Traço de elemento selecionado ou degrau — precisa se destacar sem gritar. */
  medium: 2,
  /** Traço do elemento mais destacado da tela — degrau de escada selecionada. */
  bold: 2.5,
} as const

/**
 * Raio (alça redonda) / metade do lado (alça quadrada) do desenho VISUAL das
 * alças de edição — vértice de Região/Parede solta/Linha, canto de Sala
 * retangular, canto de bounding box (Token/Prop/Drawing rect-ellipse-polygon).
 * Antes, `drawEditHandles.ts`, `drawRoomHandles.ts` e `drawResizeHandles.ts`
 * tinham cada um seu próprio `5` local — mesmo número, sem fonte comum.
 *
 * NÃO é a área de clique: a área de clique é maior de propósito e vive em
 * outros arquivos, fora deste agente — `RESIZE_HANDLE_TOLERANCE` (10,
 * `lib/objectTransform.ts`), `ROOM_CORNER_HIT_TOLERANCE` (10,
 * `lib/roomOps.ts`), `LIGHT_RADIUS_HANDLE_TOLERANCE` (10,
 * `pixi/drawEditHandles.ts`). Alça fina demais pra ver != alça difícil de
 * clicar, e por isso os dois números são propositalmente diferentes agora
 * (visual 3.5, clique 10) — antes dividiam o mesmo `5`.
 */
export const HANDLE_VISUAL_RADIUS = 3.5

/** Raio do ponto médio de aresta (vazado) — sempre menor que o vértice
 *  (`HANDLE_VISUAL_RADIUS`), pra manter a hierarquia visual "vértice pesa
 *  mais que meio de aresta" que já existia (5 vs 4), só em escala menor. */
export const HANDLE_MIDPOINT_RADIUS = 2.5
