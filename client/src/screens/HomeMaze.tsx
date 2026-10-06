/**
 * Ilustração da tela inicial: um labirinto de traço latão que se desenha uma
 * vez na abertura (stroke-dashoffset via CSS, `pathLength=1` normaliza todo
 * segmento) e acende o centro no fim. Puramente decorativa — fica fora da
 * árvore de acessibilidade.
 */

/** Paredes em coordenadas de grade 10×10; cada uma vira um `<line>`. */
const WALLS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 10, 0],
  [10, 0, 10, 4],
  [10, 6, 10, 10],
  [10, 10, 0, 10],
  [0, 10, 0, 6],
  [0, 4, 0, 0],
  [2, 2, 8, 2],
  [2, 2, 2, 8],
  [2, 8, 6, 8],
  [8, 2, 8, 6],
  [8, 8, 10, 8],
  [4, 4, 6, 4],
  [4, 4, 4, 6],
  [6, 6, 8, 6],
  [6, 8, 6, 10],
  [6, 4, 6, 6],
  [0, 4, 2, 4],
  [4, 0, 4, 2],
]

const CELL = 40
const PAD = 8
const SIZE = CELL * 10 + PAD * 2
/** Passo entre o início de cada parede; com 18 paredes a entrada termina em ~1,1 s. */
const STAGGER_MS = 45

export function HomeMaze() {
  return (
    <svg className="lb-home__maze" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
      <g transform={`translate(${PAD} ${PAD})`}>
        {WALLS.map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            className="lb-home__wall"
            x1={x1 * CELL}
            y1={y1 * CELL}
            x2={x2 * CELL}
            y2={y2 * CELL}
            pathLength={1}
            style={{ animationDelay: `${300 + i * STAGGER_MS}ms` }}
          />
        ))}
        <circle className="lb-home__core-halo" cx={5 * CELL} cy={5 * CELL} r={34} />
        <circle className="lb-home__core" cx={5 * CELL} cy={5 * CELL} r={7} />
      </g>
    </svg>
  )
}
