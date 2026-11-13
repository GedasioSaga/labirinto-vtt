/**
 * Tamanho de uma ficha que nunca teve tamanho escolhido — o mesmo `size: 1`
 * que `mapFactory.createToken` grava desde sempre. Mapa salvo antes deste
 * painel abre idêntico: quem já tem `size` continua com o `size` que tem, e
 * `size` corrompido (mapa do disco chega cru, ver `lib/mapFile.ts`) cai aqui
 * em vez de virar `NaN` dentro do `circle()` do Pixi.
 */
export const TOKEN_SIZE_DEFAULT = 1

/**
 * Menor e maior lado, em casas, que o campo do tamanho aceita (pedido do
 * mestre de 12/11/2026: "eu quero dizer o quanto tem que mudar" — 0,5 numa
 * cidade grande, 1,5 num bicho médio). O menor é o mesmo da alça de canto
 * (`MIN_TOKEN_SIZE` em `lib/objectTransform.ts`); número fora da faixa vira o
 * limite mais perto (`limitarTamanho`).
 */
export const TOKEN_SIZE_MIN_SQUARES = 0.25
export const TOKEN_SIZE_MAX_SQUARES = 6

/** Quanto o − e o + do campo (e as setas do teclado) mudam o lado: um décimo de casa. */
export const TOKEN_SIZE_STEP = 0.1

/** Casas decimais que o campo guarda: 0,25 cabe, e 0,7 + 0,1 não vira 0,7999999999999999 no arquivo. */
const CENTESIMOS = 100

/** O lado com duas casas decimais: o que o campo mostra e o que vai gravado. */
function arredondarTamanho(casas: number): number {
  return Math.round(casas * CENTESIMOS) / CENTESIMOS
}

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
 * Os ATALHOS do tamanho, ao lado do campo (`CampoDoTamanho`): na mesa existe
 * gente (1 casa), bicho grande (2) e o que mal cabe no corredor (3). O lado
 * quebrado (0,5, 1,5) se digita no campo desde 12/11/2026; antes só a alça de
 * canto o fazia.
 */
export const TOKEN_SIZE_OPTIONS: readonly TokenSizeOption[] = [
  { value: 1, label: '1 casa' },
  { value: 2, label: '2 casas' },
  { value: 3, label: '3 casas' },
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
 * Qual atalho do painel está marcado, ou `null` quando a ficha está num
 * tamanho que não é atalho — digitado no campo (1,5) ou esticado pela alça de
 * canto (`resizeTokenSize`, que produz fração como 1,37). Nesse caso nenhum
 * atalho fica marcado, em vez de mentir que ela tem 1 casa: o número certo
 * está no campo ao lado.
 */
export function selectedTokenSize(token: { size?: unknown }): number | null {
  const size = tokenSizeInSquares(token)
  return TOKEN_SIZE_OPTIONS.some((option) => option.value === size) ? size : null
}

/**
 * O lado como o campo o mostra: vírgula, até duas casas decimais, sem zero
 * sobrando ("1,5", "0,25", "2"). O 1,3712 da alça de canto aparece "1,37".
 */
export function formatarTamanho(casas: number): string {
  return String(arredondarTamanho(casas)).replace('.', ',')
}

/**
 * "1 casa", "0,5 casa", "1,5 casa", "2 casas", "2,5 casas": o plural começa
 * no 2, como em "1,5 milhão" e "2 milhões". Para 1, 2 e 3 é o mesmo nome dos
 * atalhos (`TOKEN_SIZE_OPTIONS`).
 */
export function nomeDoTamanho(casas: number): string {
  const redondo = arredondarTamanho(casas)
  return `${formatarTamanho(redondo)} ${redondo < 2 ? 'casa' : 'casas'}`
}

/** Um lado já arredondado e dentro da faixa do campo. */
export interface TamanhoLimitado {
  casas: number
  /** O aviso curto quando o número saiu da faixa e virou o limite mais perto; `null` = coube como veio. */
  aviso: string | null
}

/**
 * O lado que o campo grava: duas casas decimais e dentro de 0,25 a 6. Fora da
 * faixa (10, 0,1, -1) vira o limite mais perto, com o aviso que o campo mostra
 * embaixo — o número digitado nunca some sem explicação.
 */
export function limitarTamanho(casas: number): TamanhoLimitado {
  const redondo = arredondarTamanho(casas)
  if (redondo < TOKEN_SIZE_MIN_SQUARES) {
    return { casas: TOKEN_SIZE_MIN_SQUARES, aviso: `Ficou ${nomeDoTamanho(TOKEN_SIZE_MIN_SQUARES)}, o menor tamanho.` }
  }
  if (redondo > TOKEN_SIZE_MAX_SQUARES) {
    return { casas: TOKEN_SIZE_MAX_SQUARES, aviso: `Ficou ${nomeDoTamanho(TOKEN_SIZE_MAX_SQUARES)}, o maior tamanho.` }
  }
  return { casas: redondo, aviso: null }
}

/** "1,5", "1.5", ",5", "-1", "2 casas": número com vírgula OU ponto, com o nome da unidade opcional no fim. */
const NUMERO_DIGITADO = /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/
const UNIDADE_NO_FIM = /\s*casas?$/i

/**
 * O número que a pessoa digitou no campo, em casas, ainda SEM limitar (quem
 * limita é `limitarTamanho`, que também diz o aviso). Vírgula e ponto valem
 * como decimal. Texto que não é número (vazio, "dois", "1,5,2") = `null`: o
 * campo não grava lixo.
 */
export function lerTamanhoDigitado(texto: string): number | null {
  const limpo = texto.trim().replace(UNIDADE_NO_FIM, '')
  if (!NUMERO_DIGITADO.test(limpo)) return null
  const casas = Number(limpo.replace(',', '.'))
  return Number.isFinite(casas) ? casas : null
}

/** 10 passos de 0,1 numa casa: a conta do passo anda em inteiros, e a divisão no fim dá o décimo exato. */
const PASSOS_POR_CASA = Math.round(1 / TOKEN_SIZE_STEP)

/** Folga para o lado que é décimo a menos de um resto de conta (1,3000000001 vindo da alça) não contar como "entre dois décimos". */
const FOLGA_DO_DECIMO = 1e-6

/**
 * O lado depois de um − (`-1`) ou + (`1`): um décimo de casa, já limitado.
 * Lado fora da grade de décimos (1,37 da alça de canto) vai primeiro ao
 * décimo vizinho naquele sentido (1,4 no +, 1,3 no −), como o passo de um
 * campo de número do navegador — e não a 1,47, que nunca mais cairia num
 * número redondo.
 */
export function passoDoTamanho(casas: number, sentido: 1 | -1): TamanhoLimitado {
  const passos = casas * PASSOS_POR_CASA
  const base = sentido > 0 ? Math.floor(passos + FOLGA_DO_DECIMO) : Math.ceil(passos - FOLGA_DO_DECIMO)
  return limitarTamanho((base + sentido) / PASSOS_POR_CASA)
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
 * Tamanho fracionário (0,5 ou 1,5 digitado no campo, 1,37 da alça de canto)
 * não é par nem ímpar: segue o snap de sempre, com o centro NO MEIO DA CASA —
 * a meia casa fica dentro de uma casa, a de 1,5 cobre a casa inteira e um
 * quarto de cada vizinha, por igual. É o mesmo ponto no arrasto, na chegada
 * (`lib/tamanhoAoEntrar.ts`) e no "Reunir o grupo", então a ficha não pula.
 */
export function seatTokenCenter(raw: Point, snapped: Point, gridSize: number, cells: number): Point {
  if (gridSize <= 0) return snapped
  if (!Number.isInteger(cells) || cells <= 0 || cells % 2 !== 0) return snapped
  return {
    x: Math.round(raw.x / gridSize) * gridSize,
    y: Math.round(raw.y / gridSize) * gridSize,
  }
}
