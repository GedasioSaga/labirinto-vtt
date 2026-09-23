import type { FloorPiece, FloorShape } from '../types/map'

/**
 * Chão preso à grade: a parte PURA do pincel de blocos e do balde. De "o
 * ponteiro passou por aqui" para "estas células", de "cliquei aqui dentro" para
 * "a área fechada é esta", e a distância assinada da união das células (o que o
 * motor do chão, `lib/floorSdf.ts`, precisa para tirar o contorno).
 *
 * Fora de `pixi/PixiCanvas.tsx` pelo mesmo motivo de `lib/floorTool.ts`:
 * testável sem Pixi nem DOM. Não importa `lib/floorSdf.ts` de propósito — é o
 * contrário que acontece (`floorSdf` chama `blocosDistance` daqui), e o
 * ciclo quebraria os dois.
 */

export type BlocosShape = Extract<FloorShape, { kind: 'blocos' }>

/** Uma célula da grade, por coluna e linha (nunca em px). */
export interface Bloco {
  col: number
  row: number
}

/** Tamanhos do pincel, em blocos de lado. */
export const TAMANHOS_DE_PINCEL = [1, 2, 3] as const
export type TamanhoDePincel = (typeof TAMANHOS_DE_PINCEL)[number]

export function clampTamanhoDePincel(tamanho: number): TamanhoDePincel {
  const inteiro = Math.round(tamanho)
  if (inteiro <= 1) return 1
  return inteiro >= 3 ? 3 : 2
}

/**
 * Teto de células que um gesto do balde enche de uma vez. Existe para o balde
 * clicado numa área que parece fechada mas é enorme não travar a aba enquanto
 * a busca anda: acima disto o gesto é recusado como qualquer área aberta.
 */
const TETO_DO_BALDE = 20000

export function chaveDoBloco(col: number, row: number): string {
  return `${col},${row}`
}

/** Célula que contém o ponto de mundo. */
export function blocoNoPonto(x: number, y: number, cell: number): Bloco {
  return { col: Math.floor(x / cell), row: Math.floor(y / cell) }
}

/** Centro da célula, em px de mundo. */
export function centroDoBloco(bloco: Bloco, cell: number): { x: number; y: number } {
  return { x: (bloco.col + 0.5) * cell, y: (bloco.row + 0.5) * cell }
}

/**
 * Células que o pincel cobre com o ponteiro em (x, y).
 *
 * Tamanho ímpar (1 e 3) fica centrado na célula sob o ponteiro — é o que a mão
 * espera de um pincel. Tamanho 2 não tem centro possível numa grade, então a
 * célula sob o ponteiro é o canto superior esquerdo do quadrado 2×2: escolhido
 * assim, e não "arredonda para a esquerda", para o que nasce ficar sempre à
 * frente do ponteiro, nunca atrás dele.
 */
export function blocosDoPincel(x: number, y: number, cell: number, tamanho: TamanhoDePincel): Bloco[] {
  const centro = blocoNoPonto(x, y, cell)
  const inicio = tamanho === 1 ? 0 : tamanho === 2 ? 0 : -1
  const blocos: Bloco[] = []
  for (let dc = inicio; dc < inicio + tamanho; dc += 1) {
    for (let dr = inicio; dr < inicio + tamanho; dr += 1) {
      blocos.push({ col: centro.col + dc, row: centro.row + dr })
    }
  }
  return blocos
}

/**
 * Células do trecho percorrido entre dois pontos do ponteiro. O navegador
 * entrega pointermove em saltos (e pula mais ainda quando o quadro atrasa):
 * sem amostrar o caminho inteiro, um arrasto rápido deixaria buraco no traço.
 * O passo é meia célula — menor que qualquer célula, então nenhuma fica de fora.
 */
export function blocosDoTraco(
  de: { x: number; y: number },
  ate: { x: number; y: number },
  cell: number,
  tamanho: TamanhoDePincel,
): Bloco[] {
  const distancia = Math.hypot(ate.x - de.x, ate.y - de.y)
  const passos = Math.max(1, Math.ceil(distancia / (cell / 2)))
  const blocos: Bloco[] = []
  for (let passo = 0; passo <= passos; passo += 1) {
    const t = passo / passos
    blocos.push(...blocosDoPincel(de.x + (ate.x - de.x) * t, de.y + (ate.y - de.y) * t, cell, tamanho))
  }
  return blocos
}

/** Tira repetição mantendo a ordem de chegada. */
function blocosUnicos(blocos: readonly Bloco[]): Bloco[] {
  const vistos = new Set<string>()
  const saida: Bloco[] = []
  for (const bloco of blocos) {
    const chave = chaveDoBloco(bloco.col, bloco.row)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    saida.push(bloco)
  }
  return saida
}

/** `null` quando não sobrou célula nenhuma — peça vazia não é peça. */
export function buildBlocosShape(cell: number, blocos: readonly Bloco[]): BlocosShape | null {
  const unicos = blocosUnicos(blocos)
  if (unicos.length === 0 || !(cell > 0)) return null
  return { kind: 'blocos', cell, cells: unicos.map((b) => ({ col: b.col, row: b.row })) }
}

/**
 * Índice das células por referência da forma. A store é imutável — forma
 * editada é objeto novo — então a própria referência é a chave do cache, sem
 * invalidação manual (mesmo truque de `polygonDistanceCache` em floorSdf.ts).
 */
const cacheDeCelulas = new WeakMap<object, Set<string>>()

function celulasDe(shape: BlocosShape): Set<string> {
  let celulas = cacheDeCelulas.get(shape)
  if (!celulas) {
    celulas = new Set(shape.cells.map((c) => chaveDoBloco(c.col, c.row)))
    cacheDeCelulas.set(shape, celulas)
  }
  return celulas
}

/** Quantas células em volta a distância olha. Ver `blocosDistance`. */
const JANELA_EM_CELULAS = 2

function distanciaAoSegmento(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const ex = x1 - x0
  const ey = y1 - y0
  const comprimentoQuadrado = ex * ex + ey * ey
  const t = comprimentoQuadrado === 0 ? 0 : Math.max(0, Math.min(1, ((px - x0) * ex + (py - y0) * ey) / comprimentoQuadrado))
  return Math.hypot(px - x0 - ex * t, py - y0 - ey * t)
}

/**
 * Distância assinada à união das células (negativa dentro, positiva fora).
 *
 * A borda da união são os lados de célula cheia que fazem divisa com célula
 * vazia — e SÓ eles. É por isso que a conta não é o `min` das distâncias a cada
 * célula, que é o caminho óbvio e está errado aqui: esse `min` dá exatamente 0
 * em cima de toda divisa INTERNA entre duas células cheias, e o marching
 * squares (`lib/floorContour.ts`, "dentro" é valor < 0) desenharia uma linha de
 * contorno em cada divisa — costura no meio do chão, que é justo o que o estilo
 * aprovado proíbe.
 *
 * Só as células de uma janela de ±2 em volta entram na conta. Célula fora dessa
 * janela está a pelo menos `2 * cell` do ponto, então o resultado é recortado
 * nesse valor: o SINAL é sempre exato e o MÓDULO é exato enquanto for menor que
 * `2 * cell` — que é o contrato que `compileFloor` já declara ("sinal exato;
 * módulo exato só perto da borda") e o que a amostragem por grade grossa de
 * `sampleFloorGrid` precisa (um limite inferior nunca deixa pular borda).
 */
export function blocosDistance(shape: BlocosShape, x: number, y: number): number {
  const { cell } = shape
  const celulas = celulasDe(shape)
  const col = Math.floor(x / cell)
  const row = Math.floor(y / cell)
  const teto = JANELA_EM_CELULAS * cell
  let melhor = teto
  for (let c = col - JANELA_EM_CELULAS; c <= col + JANELA_EM_CELULAS; c += 1) {
    for (let r = row - JANELA_EM_CELULAS; r <= row + JANELA_EM_CELULAS; r += 1) {
      if (!celulas.has(chaveDoBloco(c, r))) continue
      const x0 = c * cell
      const y0 = r * cell
      const x1 = x0 + cell
      const y1 = y0 + cell
      if (!celulas.has(chaveDoBloco(c, r - 1))) melhor = Math.min(melhor, distanciaAoSegmento(x, y, x0, y0, x1, y0))
      if (!celulas.has(chaveDoBloco(c, r + 1))) melhor = Math.min(melhor, distanciaAoSegmento(x, y, x0, y1, x1, y1))
      if (!celulas.has(chaveDoBloco(c - 1, r))) melhor = Math.min(melhor, distanciaAoSegmento(x, y, x0, y0, x0, y1))
      if (!celulas.has(chaveDoBloco(c + 1, r))) melhor = Math.min(melhor, distanciaAoSegmento(x, y, x1, y0, x1, y1))
    }
  }
  return celulas.has(chaveDoBloco(col, row)) ? -melhor : melhor
}

export interface RetanguloDeBlocos {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Retângulo exato da união das células. `null` = forma sem célula. */
export function blocosBounds(shape: BlocosShape): RetanguloDeBlocos | null {
  if (shape.cells.length === 0) return null
  let minCol = Infinity
  let minRow = Infinity
  let maxCol = -Infinity
  let maxRow = -Infinity
  for (const c of shape.cells) {
    minCol = Math.min(minCol, c.col)
    minRow = Math.min(minRow, c.row)
    maxCol = Math.max(maxCol, c.col)
    maxRow = Math.max(maxRow, c.row)
  }
  return {
    minX: minCol * shape.cell,
    minY: minRow * shape.cell,
    maxX: (maxCol + 1) * shape.cell,
    maxY: (maxRow + 1) * shape.cell,
  }
}

export function blocosCenter(shape: BlocosShape): { x: number; y: number } {
  const b = blocosBounds(shape)
  if (!b) return { x: 0, y: 0 }
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
}

/**
 * Move a peça em CÉLULAS INTEIRAS. Arrastar com o mouse entrega px, e aceitar
 * px quebraria a única promessa desta forma (estar presa à grade), então o
 * deslocamento é arredondado para o múltiplo de célula mais próximo — meia
 * célula de arrasto move uma célula.
 */
export function moveBlocos(shape: BlocosShape, dx: number, dy: number): BlocosShape {
  const dCol = Math.round(dx / shape.cell)
  const dRow = Math.round(dy / shape.cell)
  if (dCol === 0 && dRow === 0) return shape
  return { ...shape, cells: shape.cells.map((c) => ({ col: c.col + dCol, row: c.row + dRow })) }
}

/**
 * Tira `blocos` de toda peça de blocos com a MESMA célula. Peça que fica sem
 * célula nenhuma some da lista. `null` quando nada mudou — assim quem chama não
 * gasta uma entrada de Ctrl+Z à toa.
 *
 * Peça de blocos com célula diferente (o mapa mudou de grade depois de pintada)
 * fica intocada de propósito: apagar "meia célula" dela deixaria a peça fora da
 * grade, que é pior do que não apagar. Peça travada ou oculta também: travada é
 * o que o usuário pediu para não mexer, e oculta não está na tela — a borracha
 * apaga o que se vê.
 */
export function tirarBlocosDasPecas(
  pecas: readonly FloorPiece[],
  blocos: readonly Bloco[],
  cell: number,
): FloorPiece[] | null {
  const alvo = new Set(blocos.map((b) => chaveDoBloco(b.col, b.row)))
  if (alvo.size === 0) return null
  let mudou = false
  const saida: FloorPiece[] = []
  for (const peca of pecas) {
    const { shape } = peca
    if (shape.kind !== 'blocos' || shape.cell !== cell || peca.locked || peca.hidden) {
      saida.push(peca)
      continue
    }
    const restantes = shape.cells.filter((c) => !alvo.has(chaveDoBloco(c.col, c.row)))
    if (restantes.length === shape.cells.length) {
      saida.push(peca)
      continue
    }
    mudou = true
    if (restantes.length > 0) saida.push({ ...peca, shape: { ...shape, cells: restantes } })
  }
  return mudou ? saida : null
}

/**
 * Células vazias alcançáveis a partir de `inicio`, dentro dos limites do mapa.
 *
 * `null` quando a área NÃO é fechada: ou a busca escapou pela borda do mapa
 * (não há parede ali, então o vazio segue para fora), ou passou de
 * `TETO_DO_BALDE` células. Devolver `null` em vez de encher meio mapa é a
 * diferença entre "o balde encheu o cômodo" e "o balde comeu o mapa".
 */
export function areaFechadaAPartirDe(
  temChao: (col: number, row: number) => boolean,
  inicio: Bloco,
  colunas: number,
  linhas: number,
): Bloco[] | null {
  if (inicio.col < 0 || inicio.row < 0 || inicio.col >= colunas || inicio.row >= linhas) return null
  if (temChao(inicio.col, inicio.row)) return null

  const vistos = new Set<string>([chaveDoBloco(inicio.col, inicio.row)])
  const fila: Bloco[] = [inicio]
  const area: Bloco[] = []
  const vizinhos: ReadonlyArray<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]

  for (;;) {
    const atual = fila.pop()
    if (atual === undefined) break
    area.push(atual)
    if (area.length > TETO_DO_BALDE) return null
    for (const [dc, dr] of vizinhos) {
      const col = atual.col + dc
      const row = atual.row + dr
      // Sair do mapa é a prova de que a área não é fechada: ali não há parede.
      if (col < 0 || row < 0 || col >= colunas || row >= linhas) return null
      const chave = chaveDoBloco(col, row)
      if (vistos.has(chave) || temChao(col, row)) continue
      vistos.add(chave)
      fila.push({ col, row })
    }
  }
  return area
}
