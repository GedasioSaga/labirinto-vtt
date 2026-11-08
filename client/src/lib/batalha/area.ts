/**
 * ÁREA DO GOLPE (conserto das fichas F2, fatia A; respostas do grilling:
 * Aplauso 6x6 à frente da May, Giro de Pá a 1 casa do Harvey, Projeção Letal
 * em linha reta do Vagn, Lua Incandescente dividida do Siegfried, Batata-mina
 * 3x3 e Imã-Gumelo 5x5 do Alexei). As casas são as da grade (`col`, `row`);
 * a distância é a do xadrez (a diagonal conta 1), a mesma do "a 1 casa".
 *
 * Puro: sem store, sem rede.
 */

export interface Casa {
  col: number
  row: number
}

/** Para onde quem usa está virado. */
export type Direcao = 'norte' | 'sul' | 'leste' | 'oeste'

/**
 * A forma da área. `raio`: todas as casas até `casas` de distância, menos a
 * do centro (Giro de Pá 1; 3x3 = raio 1, 5x5 = raio 2). `frente`: o quadrado
 * `lado` x `lado` logo à frente, centrado na linha de quem usa (Aplauso 6x6).
 * `linha`: a linha reta à frente até `alcance` casas (Projeção Letal).
 */
export type FormaDaArea = { tipo: 'raio'; casas: number } | { tipo: 'frente'; lado: number } | { tipo: 'linha'; alcance: number }

/** Quem entra: só os inimigos de quem usa, ou todos (o jogador escolhe na mira, todos já marcados). */
export type QuemEntraNaArea = 'inimigos' | 'todos'

/** Um candidato no campo. */
export interface CandidatoDaArea extends Casa {
  tokenId: string
  /** Inimigo de quem usa. */
  inimigo: boolean
}

const PASSO: Readonly<Record<Direcao, Casa>> = {
  norte: { col: 0, row: -1 },
  sul: { col: 0, row: 1 },
  leste: { col: 1, row: 0 },
  oeste: { col: -1, row: 0 },
}

/** A distância do xadrez entre duas casas. */
export function distanciaEmCasas(a: Casa, b: Casa): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))
}

/** A casa está na área (a origem nunca está). */
export function casaNaArea(forma: FormaDaArea, origem: Casa, direcao: Direcao, casa: Casa): boolean {
  if (casa.col === origem.col && casa.row === origem.row) return false
  if (forma.tipo === 'raio') return distanciaEmCasas(origem, casa) <= forma.casas
  const passo = PASSO[direcao]
  // "à frente": quanto anda na direção e quanto desvia para o lado (positivo = à direita de quem olha).
  const frente = (casa.col - origem.col) * passo.col + (casa.row - origem.row) * passo.row
  const lado = (casa.row - origem.row) * passo.col - (casa.col - origem.col) * passo.row
  if (forma.tipo === 'linha') return lado === 0 && frente >= 1 && frente <= forma.alcance
  // O quadrado começa na casa da frente; com lado par, a metade a mais fica à direita de quem olha.
  const esquerda = -Math.floor((forma.lado - 1) / 2)
  return frente >= 1 && frente <= forma.lado && lado >= esquerda && lado < esquerda + forma.lado
}

const DIRECOES: readonly Direcao[] = ['norte', 'leste', 'sul', 'oeste']
const QUARTO_DE_VOLTA = 90
const VOLTA = 360

/**
 * F2 (fatia B): para onde a ficha olha, pela rotação do token (graus no
 * sentido horário, 0 = para cima), no lado mais perto. Sem rotação = `null`:
 * o mestre nunca deu frente à ficha.
 */
export function direcaoDaRotacao(graus: number | undefined): Direcao | null {
  if (graus === undefined || !Number.isFinite(graus)) return null
  const lado = Math.round((((graus % VOLTA) + VOLTA) % VOLTA) / QUARTO_DE_VOLTA) % DIRECOES.length
  return DIRECOES[lado] ?? null
}

/** F2 (fatia B): a casa está na área de quem olha para `direcao`; sem frente (`null`), vale qualquer dos 4 lados. */
export function casaNaAreaVirada(forma: FormaDaArea, origem: Casa, direcao: Direcao | null, casa: Casa): boolean {
  if (direcao !== null) return casaNaArea(forma, origem, direcao, casa)
  return DIRECOES.some((lado) => casaNaArea(forma, origem, lado, casa))
}

/** Os tokens na área, na ordem dos candidatos. `quem` = "inimigos" deixa os aliados de fora. */
export function alvosNaArea(forma: FormaDaArea, origem: Casa, direcao: Direcao, candidatos: readonly CandidatoDaArea[], quem: QuemEntraNaArea): string[] {
  return candidatos.filter((candidato) => (quem === 'todos' || candidato.inimigo) && casaNaArea(forma, origem, direcao, candidato)).map((candidato) => candidato.tokenId)
}

/**
 * O dano dividido entre os alvos marcados, para baixo (Lua Incandescente: 71
 * em 3 = 23 em cada). Acima do `teto` de alvos, ou nenhum alvo = `null`.
 */
export function dividirDano(base: number, alvos: number, teto: number): number | null {
  if (!Number.isInteger(alvos) || alvos < 1 || alvos > teto) return null
  return Math.max(0, Math.floor(base / alvos))
}
