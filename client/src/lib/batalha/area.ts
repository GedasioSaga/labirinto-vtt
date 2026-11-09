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

/**
 * Quem entra: só os inimigos de quem usa, só os aliados (construtor C3: a
 * cura em área), ou todos (o jogador escolhe na mira, todos já marcados).
 */
export type QuemEntraNaArea = 'inimigos' | 'aliados' | 'todos'

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

/** Os 4 lados, no sentido horário a partir de cima. */
export const DIRECOES: readonly Direcao[] = ['norte', 'leste', 'sul', 'oeste']
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

/** Os tokens na área, na ordem dos candidatos. `quem` = "inimigos" deixa os aliados de fora; "aliados", os inimigos. */
export function alvosNaArea(forma: FormaDaArea, origem: Casa, direcao: Direcao, candidatos: readonly CandidatoDaArea[], quem: QuemEntraNaArea): string[] {
  return candidatos.filter((candidato) => (quem === 'todos' || candidato.inimigo === (quem === 'inimigos')) && casaNaArea(forma, origem, direcao, candidato)).map((candidato) => candidato.tokenId)
}

// ─── Construtor C3: a ficha inteira na grade (token grande) ─────────────────

/** A ficha na grade: a casa de cima e à esquerda e quantas casas ela ocupa por lado (a grande ocupa um quadrado). */
export interface PegadaNaGrade extends Casa {
  tamanho: number
}

/** Casas por lado da ficha de `size` (a pequena, 0,5, ocupa uma casa inteira). */
export function ladoDaFicha(size: number | undefined): number {
  return size === undefined || !Number.isFinite(size) ? 1 : Math.max(1, Math.round(size))
}

/**
 * A pegada da ficha pela casa de referência de `casaDoToken` (a do centro;
 * na ficha de lado par, a de cima e à esquerda do centro).
 */
export function pegadaDaFicha(referencia: Casa, size: number | undefined): PegadaNaGrade {
  const tamanho = ladoDaFicha(size)
  const recuo = Math.floor((tamanho - 1) / 2)
  return { col: referencia.col - recuo, row: referencia.row - recuo, tamanho }
}

/**
 * A casa vista por quem olha para `direcao` a partir da ficha inteira:
 * `frente` = quantas casas além da borda da frente (1 = colada nela); `lado`
 * = a coluna contada da casa mais à esquerda da ficha (positivo = à direita).
 */
function vistaDaFicha(origem: PegadaNaGrade, direcao: Direcao, casa: Casa): { frente: number; lado: number } {
  const ultimaCol = origem.col + origem.tamanho - 1
  const ultimaRow = origem.row + origem.tamanho - 1
  switch (direcao) {
    case 'norte':
      return { frente: origem.row - casa.row, lado: casa.col - origem.col }
    case 'sul':
      return { frente: casa.row - ultimaRow, lado: ultimaCol - casa.col }
    case 'leste':
      return { frente: casa.col - ultimaCol, lado: casa.row - origem.row }
    case 'oeste':
      return { frente: origem.col - casa.col, lado: ultimaRow - casa.row }
  }
}

/**
 * A casa está na área de quem usa, medida da ficha INTEIRA dele (nunca uma
 * casa dela). `raio`: até `casas` da borda da ficha. `linha`: da largura da
 * ficha, à frente. `frente`: o quadrado colado na frente, centrado na ficha
 * (com sobra ímpar, a metade a mais fica à direita de quem olha). Com a
 * ficha de 1 casa, dá o mesmo que `casaNaArea`.
 */
export function casaNaAreaDaFicha(forma: FormaDaArea, origem: PegadaNaGrade, direcao: Direcao, casa: Casa): boolean {
  const ultimaCol = origem.col + origem.tamanho - 1
  const ultimaRow = origem.row + origem.tamanho - 1
  const foraNaCol = Math.max(origem.col - casa.col, 0, casa.col - ultimaCol)
  const foraNaRow = Math.max(origem.row - casa.row, 0, casa.row - ultimaRow)
  if (foraNaCol === 0 && foraNaRow === 0) return false
  if (forma.tipo === 'raio') return Math.max(foraNaCol, foraNaRow) <= forma.casas
  const { frente, lado } = vistaDaFicha(origem, direcao, casa)
  if (forma.tipo === 'linha') return frente >= 1 && frente <= forma.alcance && lado >= 0 && lado < origem.tamanho
  const esquerda = -Math.floor((forma.lado - origem.tamanho) / 2)
  return frente >= 1 && frente <= forma.lado && lado >= esquerda && lado < esquerda + forma.lado
}

/** A ficha `alvo` entra na área se QUALQUER casa dela entra (o token grande com um pé na área). */
export function fichaNaArea(forma: FormaDaArea, origem: PegadaNaGrade, direcao: Direcao, alvo: PegadaNaGrade): boolean {
  for (let col = alvo.col; col < alvo.col + alvo.tamanho; col += 1) {
    for (let row = alvo.row; row < alvo.row + alvo.tamanho; row += 1) {
      if (casaNaAreaDaFicha(forma, origem, direcao, { col, row })) return true
    }
  }
  return false
}

/**
 * O dano dividido entre os alvos marcados, para baixo (Lua Incandescente: 71
 * em 3 = 23 em cada). Acima do `teto` de alvos, ou nenhum alvo = `null`.
 */
export function dividirDano(base: number, alvos: number, teto: number): number | null {
  if (!Number.isInteger(alvos) || alvos < 1 || alvos > teto) return null
  return Math.max(0, Math.floor(base / alvos))
}
