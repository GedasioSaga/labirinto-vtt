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
 * Raio do desenho VISUAL das alças de VÉRTICE — mover um ponto de Região /
 * Parede solta / Linha, e a alça de raio de Luz/Círculo. Bolinha preenchida.
 * Antes, `drawEditHandles.ts`, `drawRoomHandles.ts` e `drawResizeHandles.ts`
 * tinham cada um seu próprio `5` local — mesmo número, sem fonte comum.
 *
 * Alça de CANTO (redimensionar) NÃO usa mais este número desde 21/09/2026:
 * é o chip de `CORNER_HANDLE_RADIUS` logo abaixo. Este continua sendo o piso
 * do chip em objeto pequeno, para a alça nunca ficar menor do que já era.
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

/**
 * Metade do lado do CHIP de canto — o "quadradinho de canto" que todo editor
 * de desenho tem, e que diz "pegue aqui para redimensionar". Vale para Sala
 * retangular (`drawRoomHandles.ts`) e para bounding box de Token / Prop /
 * Drawing rect-ellipse-polygon (`drawResizeHandles.ts`), que dividem o mesmo
 * desenho.
 *
 * POR QUE NÃO É `HANDLE_VISUAL_RADIUS`. Até 21/09/2026 o canto era um quadrado
 * de 7 px na MESMA cor do contorno de seleção, e cabia inteiro dentro da faixa
 * dupla do contorno (parede de 2 px + 2 px de amarelo de cada lado). Medido
 * pela jornada `e2e/task-jornada-selecao-mostra-alcas.spec.ts` em 21/09/2026:
 * a 4..10 px do canto a seleção acrescentava 4 px de espessura — exatamente os
 * mesmos 4 px que ela acrescenta no MEIO da aresta. Ou seja, o canto era
 * indistinguível de "aqui as duas linhas da moldura se cruzam", e quem não
 * sabia que dava para redimensionar não descobria olhando.
 *
 * A hierarquia fica MAIS legível com o chip maior, não menos: bolinha redonda
 * de `HANDLE_VISUAL_RADIUS` = "move este vértice"; chip quadrado com borda
 * escura = "redimensiona a partir deste canto". Duas formas, dois gestos.
 *
 * Continua NÃO sendo a área de clique, que é maior de propósito e vive em
 * `ROOM_CORNER_HIT_TOLERANCE` (24, `lib/roomOps.ts`) e
 * `RESIZE_HANDLE_TOLERANCE` (10, `lib/objectTransform.ts`).
 */
export const CORNER_HANDLE_RADIUS = 6

/**
 * Faixa escura desenhada POR BAIXO e em volta do chip, sobrando de cada lado.
 * É ela que SEPARA a alça do contorno: o contorno de seleção é amarelo, e o
 * único amarelo do canvas com uma borda escura em volta é a alça de canto.
 * Sem a faixa, crescer o chip só engrossaria a moldura naquele ponto — a
 * pessoa leria "a linha ficou mais gorda aqui", não "isto é uma peça solta
 * para pegar".
 *
 * Mesmo peso de `STROKE_WEIGHT.medium` (traço de elemento selecionado), mas é
 * fill e não stroke: desenhada como um quadrado maior por baixo, a faixa RECORTA
 * o contorno em vez de somar mais uma linha em cima dele.
 */
export const CORNER_HANDLE_KEYLINE_WIDTH = 2

/**
 * Cor da faixa: um passo abaixo do fundo do canvas (0x2b2b2b, `PixiCanvas.tsx`),
 * para o chip ter borda tanto sobre o fundo escuro (fora da sala) quanto sobre
 * o chão claro (dentro dela). Não é hue nova — é a família do fundo, para não
 * brigar com o estilo do minimapa (fundo escuro, parede como linha fina clara).
 */
export const CORNER_HANDLE_KEYLINE_COLOR = 0x1e1e1e

/** A5 — item "Oculto para jogadores" desenhado esmaecido no editor. */
export const SECRET_ITEM_ALPHA = 0.5

/**
 * Moldura do token com foto — o anel de latão que fica SEMPRE em volta da
 * foto, não só quando o token está selecionado. Pedido do usuário (prints de
 * 17/09/2026): token redondo, foto recortada dentro do círculo e moldura em
 * volta. `--lb-color-brass` do tema (theme.ts), para o mapa e a interface
 * falarem a mesma língua.
 */
export const TOKEN_FRAME_COLOR = 0xe0a44a
/** Espessura da moldura, em px de mundo: a foto é recortada no raio do token MENOS isto. */
export const TOKEN_FRAME_WIDTH = 4
