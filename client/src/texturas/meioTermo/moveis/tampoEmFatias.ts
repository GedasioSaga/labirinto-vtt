/**
 * TAMPO INCLINADO EM FATIAS (lote L11 dos objetos novos, 14/11/2026): o que a
 * rede de dormir, a gangorra e o encosto da espreguiçadeira usam para subir
 * na 3/4 com a altura mudando ao longo da peça (a rede caída no meio, a
 * tábua da gangorra com uma ponta no chão e a outra no ar, o encosto deitado).
 *
 * A 3/4 (`tresQuartos.ts`) sobe cada peça pela estrutura que contém o meio da
 * caixa dela, uma altura só por peça. A peça inclinada é então cortada em
 * FATIAS ao longo do eixo em que a altura muda: cada fatia é a forma inteira,
 * pintada só dentro da faixa dela (a técnica da banqueta e do balanço), com
 * uma estrutura própria, um tampo solto na altura do meio da faixa. Cada
 * fatia pinta `sobra` px além do corte: na 3/4 a vizinha sobe um pouco mais ou
 * menos, e a sobra fecha o degrau. De cima as fatias caem no mesmo lugar, com
 * a mesma textura e a mesma semente, e a peça sai inteira.
 *
 * Ao longo de x a subida da 3/4 corre de través da fatia: a beira de cima e a
 * de baixo da peça (e as listras ao comprido) saíam em ESCADA, um degrau por
 * fatia. Ali cada fatia é CISALHADA: a forma e a textura dela descem, em cada
 * x, o quanto a altura ali passa da altura da fatia, e depois da subida todas
 * caem na mesma linha inclinada, sem degrau. De cima o cisalhamento é de menos
 * de meio degrau (meio pixel do protótipo nas fatias finas) e não aparece.
 * Ao longo de y a subida corre no próprio eixo e a sobra basta.
 *
 * A estrutura da fatia não faz sombra (força 0, como as fatias do balanço): a
 * sombra no chão de cada desenho é pintada à parte, caída da altura certa, e
 * centenas de sombras borradas pesavam na conta.
 */
import { caixa, dentroDe, type Forma } from './formas'
import { texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import type { ContextoDoMovel } from './contexto'

/** A altura muda ao longo de x (de oeste a leste) ou de y (de norte a sul). */
export type EixoDaInclinacao = 'x' | 'y'

export interface Inclinacao {
  readonly eixo: EixoDaInclinacao
  /** De onde até onde, ao longo do eixo, as fatias vão (px do protótipo): tem de cobrir a forma. */
  readonly de: number
  readonly ate: number
  /** A altura (px do protótipo) em cada ponto do eixo. */
  readonly altura: (t: number) => number
  readonly fatias: number
  /** Quanto cada fatia pinta além do corte (px do protótipo). */
  readonly sobra: number
  /**
   * Sem estrutura própria: a fatia sobe com a estrutura de outra peça fatiada que contém o meio dela (a franja da
   * rede, presa na beira do pano). Peça vazada precisa disso: debaixo da estrutura a 3/4 pinta a frente dela, uma
   * cópia escura e cheia da forma, que apareceria pelos vãos.
   */
  readonly semEstrutura?: boolean
}

/** Borda mínima da estrutura da fatia: só âncora, não sombra (a das frestas do varal e das fatias do balanço). */
const SUAVE_DA_ESTRUTURA = 0.1
/** Quanto a faixa passa da caixa da forma de través, para não cortar o contorno. */
const FOLGA_DE_TRAVES = 1

/** A coordenada do ponto ao longo do eixo. */
function aoLongo(eixo: EixoDaInclinacao, x: number, y: number): number {
  return eixo === 'x' ? x : y
}

/**
 * A textura só de `de` a `ate` ao longo do eixo; fora dali a peça não pinta. `descida(x)` = o cisalhamento (px que o
 * ponto desce): a textura é lida no ponto cisalhado, (u, v) andando junto pelo eixo do veio da peça.
 */
function soNaFaixa(textura: Textura | null, eixo: EixoDaInclinacao, de: number, ate: number, descida: (x: number) => number): Textura {
  return (u, v, x, y, p, s, escala) => {
    const t = aoLongo(eixo, x, y)
    if (t < de || t >= ate) {
      s[5] = 0
      return
    }
    if (textura === null) return
    const d = descida(x)
    textura(u + d * Math.sin(p.eixo), v + d * Math.cos(p.eixo), x, y + d, p, s, escala)
  }
}

/**
 * Corta a peça `forma` em fatias pela `inclinacao` e põe cada uma na cena, com a estrutura na altura dela. As
 * opções valem para todas as fatias (a textura própria também, cortada na faixa de cada uma).
 */
export function emFatias(c: ContextoDoMovel, cena: Cena, forma: Forma, mat: MaterialDaPeca, opcoes: OpcoesDaPeca, inc: Inclinacao): void {
  const [x0, y0, x1, y1] = forma.b
  const faixa = (de: number, ate: number): Forma =>
    inc.eixo === 'x' ? caixa(de, y0 - FOLGA_DE_TRAVES, ate, y1 + FOLGA_DE_TRAVES) : caixa(x0 - FOLGA_DE_TRAVES, de, x1 + FOLGA_DE_TRAVES, ate)
  const textura = opcoes.textura ?? texturaDaClasse(mat.classe)
  const passo = (inc.ate - inc.de) / inc.fatias
  for (let j = 0; j < inc.fatias; j += 1) {
    const de = inc.de + j * passo
    const ate = de + passo
    const z = inc.altura((de + ate) / 2)
    // A fatia que pisa não sobe: sem altura não é estrutura e fica no chão.
    if (z > 0 && inc.semEstrutura !== true) cena.sombras.push({ forma: dentroDe(forma, faixa(de, ate)), z, solta: true, forca: 0, suave: SUAVE_DA_ESTRUTURA })
    const [a, b] = [de - inc.sobra, ate + inc.sobra]
    if (inc.eixo === 'y') {
      const comSobra: Forma = { b: faixa(a, b).b, d: forma.d }
      cena.partes.push(c.peca(comSobra, mat, { ...opcoes, textura: soNaFaixa(textura, 'y', a, b, () => 0) }))
      continue
    }
    // Ao longo de x, a fatia cisalhada: em cada x ela desce o quanto a altura ali passa da dela.
    const descida = (x: number): number => inc.altura(x) - z
    const folga = Math.max(Math.abs(descida(a)), Math.abs(descida(b)))
    const [fx0, fy0, fx1, fy1] = faixa(a, b).b
    const cisalhada: Forma = { b: [fx0, fy0 - folga, fx1, fy1 + folga], d: (x, y) => forma.d(x, y + descida(x)) }
    cena.partes.push(c.peca(cisalhada, mat, { ...opcoes, textura: soNaFaixa(textura, 'x', a, b, descida) }))
  }
}

/**
 * A peça pequena posta no ar na altura `z` (o nó da corda, a franja, o punho): uma estrutura só dela, sem sombra,
 * para a 3/4 subir a peça com a parte do desenho em que ela está. Devolve a própria forma.
 */
export function noAr(cena: Cena, forma: Forma, z: number): Forma {
  if (z > 0) cena.sombras.push({ forma, z, solta: true, forca: 0, suave: SUAVE_DA_ESTRUTURA })
  return forma
}

/** O círculo de raio `r` com a distância exata (a conta da elipse custa várias vezes mais). */
export function circulo(cx: number, cy: number, r: number): Forma {
  return {
    b: [cx - r, cy - r, cx + r, cy + r],
    d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r,
  }
}
