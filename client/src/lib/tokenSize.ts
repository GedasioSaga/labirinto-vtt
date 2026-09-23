/**
 * Tamanho de uma ficha que nunca teve tamanho escolhido — o mesmo `size: 1`
 * que `mapFactory.createToken` grava desde sempre. Mapa salvo antes deste
 * painel abre idêntico: quem já tem `size` continua com o `size` que tem, e
 * `size` corrompido (mapa do disco chega cru, ver `lib/mapFile.ts`) cai aqui
 * em vez de virar `NaN` dentro do `circle()` do Pixi.
 */
export const TOKEN_SIZE_DEFAULT = 1

/** Menor e maior lado, em quadrados, que o painel oferece. */
export const TOKEN_SIZE_MIN_SQUARES = 1
export const TOKEN_SIZE_MAX_SQUARES = 3

export interface TokenSizeOption {
  /** O que vai gravado em `Token.size`: multiplicador de célula da grade. */
  value: number
  /**
   * NOME ACESSÍVEL do botão, e nada mais que isso: "2 quadrados". Sem papel
   * colado ("— dragão") de propósito, ao contrário de `tokenColorName`: aqui o
   * número É o conteúdo, e um sufixo só afastaria o nome do que a pessoa lê e
   * fala ("clique em dois quadrados").
   */
  label: string
}

/**
 * Os tamanhos do painel. Três, não um campo livre: na mesa existe gente
 * (1 quadrado), bicho grande (2) e o que mal cabe no corredor (3) — e o
 * arrasto pela alça de canto continua lá para o caso raro de um tamanho
 * quebrado. Todos são INTEIROS porque é assim que a peça assenta na grade
 * (ver `seatTokenCenter`).
 */
export const TOKEN_SIZE_OPTIONS: readonly TokenSizeOption[] = [
  { value: 1, label: '1 quadrado' },
  { value: 2, label: '2 quadrados' },
  { value: 3, label: '3 quadrados' },
]

/**
 * O tamanho com que a ficha é DESENHADA hoje, já com o default resolvido.
 *
 * O parâmetro é `{ size?: unknown }` e não `Pick<Token, 'size'>` de propósito:
 * `Token` PROMETE `size: number`, mas a entrada real é mapa lido do disco
 * (`lib/mapFile.ts` espalha o JSON cru) e token montado por `page.evaluate`
 * num spec — lá o campo pode faltar ou vir como qualquer coisa. O tipo largo
 * é o que deixa esta função tratar isso sem um cast mentiroso no caller, e
 * todo `Token` de verdade continua entrando sem conversão.
 */
export function tokenSizeInSquares(token: { size?: unknown } | undefined): number {
  const raw = token?.size
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return TOKEN_SIZE_DEFAULT
  return raw
}

/**
 * Qual botão do painel está marcado, ou `null` quando a ficha está num tamanho
 * que o painel não oferece — o caso real é a ficha esticada pela alça de canto
 * (`resizeTokenSize`, que produz fração como 1,37). Nesse caso nenhum botão
 * fica marcado, em vez de mentir que ela tem 1 quadrado: a pessoa vê que o
 * tamanho é "outro" e escolhe um dos três se quiser voltar para a grade.
 */
export function selectedTokenSize(token: { size?: unknown }): number | null {
  const size = tokenSizeInSquares(token)
  return TOKEN_SIZE_OPTIONS.some((option) => option.value === size) ? size : null
}

export interface Point {
  x: number
  y: number
}

/**
 * ONDE O CENTRO DE UMA FICHA GRANDE ASSENTA.
 *
 * A ficha de lado ÍMPAR (1, 3) cobre um número ímpar de células, então o
 * centro dela é o centro de uma célula — é o `snapToGridCenter` de sempre
 * (`pixi/tokenInteraction.ts`), e esta função devolve o ponto já snapado sem
 * tocar nele.
 *
 * A ficha de lado PAR (2) cobre um número par de células, e aí o centro cai na
 * LINHA da grade, não no meio de uma célula: um disco de 2 quadrados centrado
 * no meio de uma célula fica meio fora dos quatro quadrados que deveria
 * cobrir. Para o par, portanto, o ponto CRU (`raw`) é arredondado direto para
 * a linha mais próxima — arredondar o já-snapado empurraria a ficha sempre
 * meia célula para o mesmo lado, porque o centro de célula está exatamente no
 * meio do caminho entre duas linhas.
 *
 * Tamanho fracionário (a ficha esticada pela alça de canto) não é par nem
 * ímpar: segue o snap de sempre.
 */
export function seatTokenCenter(raw: Point, snapped: Point, gridSize: number, cells: number): Point {
  if (gridSize <= 0) return snapped
  if (!Number.isInteger(cells) || cells <= 0 || cells % 2 !== 0) return snapped
  return {
    x: Math.round(raw.x / gridSize) * gridSize,
    y: Math.round(raw.y / gridSize) * gridSize,
  }
}
