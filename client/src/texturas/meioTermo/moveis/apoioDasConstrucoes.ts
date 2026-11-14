/**
 * APOIO das sete construções do lote L16 de 14/11/2026 (guarita, bunker de concreto, contêiner, tenda militar,
 * caixa d'água elevada, torre de rádio e tanque de combustível): o que as sete repetem para a 3/4 derivada.
 *
 * Na 3/4 (`tresQuartos.ts`) cada peça sobe com a estrutura MAIS ALTA que contém o meio dela, e a frente de cada
 * estrutura sai no material da maior peça que ficou com ela. Para uma parede, uma janela ou uma faixa pintada
 * terem a cor certa na frente, cada estrutura precisa de uma peça só dela: o PINGO (a conta do mastro da torre de
 * pedra), posto onde nenhuma estrutura mais alta alcança. Por isso as faixas que saem da parede ficam um tico para
 * fora dela, e o pingo vai nesse tico.
 */
import { limitar01, luz } from '../../ruido'
import { elipse, type Forma, type Ponto } from './formas'
import type { Cena, CriarPeca, MaterialDaPeca, Peca, Sombra, Textura } from './motor'

/** O raio do pingo (px do protótipo): pequeno demais para aparecer, grande o bastante para ter meio. */
const RAIO_DO_PINGO = 0.25

/** Tampo solto no ar; sem força, não faz sombra (só dá a altura). */
export function solta(forma: Forma, z: number, forca = 0): Sombra {
  return { forma, z, solta: true, forca }
}

/** Tampos empilhados de `de` a `ate`, sem fresta: a faixa de parede que não começa no chão (a janela, o tanque). */
export function pilha(forma: Forma, de: number, ate: number, espessura: number): Sombra[] {
  const n = Math.max(1, Math.ceil((ate - de) / espessura - 0.01))
  const passo = n > 1 ? (ate - de - espessura) / (n - 1) : 0
  return Array.from({ length: n }, (_, k) => solta(forma, ate - k * passo))
}

/** Quanto cada tampo de uma faixa sai a mais que o de cima (px): o tico em que mora o pingo dele. */
const PASSO_DA_SAIDA = 0.25

/**
 * FAIXA DE TAMPOS de `de` a `ate` que sai da parede (a seteira, a janela), cada tampo com o pingo dele: o de cima
 * sai `sai` px, cada um de baixo `PASSO_DA_SAIDA` a mais, e o pingo fica no tico entre a saída do de cima e a dele.
 * `forma(sai)` = a faixa saindo `sai` px da parede; `ponto(sai)` = o meio da faixa a `sai` px da parede.
 */
export function faixaQueSai(
  P: CriarPeca,
  cena: Cena,
  forma: (sai: number) => Forma,
  ponto: (sai: number) => Ponto,
  faixa: { readonly sai: number; readonly de: number; readonly ate: number; readonly espessura: number },
  mat: MaterialDaPeca,
  semente: number,
): void {
  const tampos = pilha(forma(faixa.sai), faixa.de, faixa.ate, faixa.espessura)
  tampos.forEach((t, k) => {
    const sai = faixa.sai + k * PASSO_DA_SAIDA
    cena.sombras.push({ ...t, forma: forma(sai) })
    const [x, y] = ponto(sai - PASSO_DA_SAIDA / 2)
    cena.partes.push(pingo(P, x, y, mat, semente + k))
  })
}

/**
 * TAMPOS DE DISCO empilhados de `de` a `ate` em (cx, cy) (a cúpula, o cano, o tanque): o de cima com raio `r`, cada
 * um de baixo `alarga` px mais largo, com o pingo dele no anel entre o raio do de cima e o dele (do lado oeste).
 */
export function discosQueAlargam(
  P: CriarPeca,
  cena: Cena,
  centro: Ponto,
  r: number,
  alarga: number,
  faixa: { readonly de: number; readonly ate: number; readonly espessura: number; readonly forca?: number; readonly estica?: (f: Forma) => Forma },
  mat: MaterialDaPeca,
  semente: number,
): void {
  const [cx, cy] = centro
  const tampos = pilha(elipse(cx, cy, r, r), faixa.de, faixa.ate, faixa.espessura)
  tampos.forEach((t, k) => {
    const rk = r + k * alarga
    cena.sombras.push({ ...t, forma: (faixa.estica ?? ((f: Forma): Forma => f))(elipse(cx, cy, rk, rk)), forca: faixa.forca ?? 0 })
    cena.partes.push(pingo(P, cx - (rk - alarga / 2), cy, mat, semente + k))
  })
}

/** A mesma forma com a caixa recentrada em (mx, my): é pelo meio da caixa que a 3/4 escolhe a estrutura da peça. */
export function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** O pingo: a peça mínima que dá o material da frente da estrutura em que (x, y) cai. */
export function pingo(P: CriarPeca, x: number, y: number, mat: MaterialDaPeca, semente: number): Peca {
  return P(elipse(x, y, RAIO_DO_PINGO, RAIO_DO_PINGO), mat, { tabua: 0, bisel: 0, contorno: 0, semente })
}

/** O material com o tom multiplicado (a crista e o vale da chapa, a faixa pintada): é o material que a frente lê. */
export function tingido(mat: MaterialDaPeca, k: number): MaterialDaPeca {
  const [r, g, b] = luz(mat.rgb, k - 1)
  return { ...mat, rgb: [Math.min(255, Math.round(r)), Math.min(255, Math.round(g)), Math.min(255, Math.round(b))] }
}

/** O quarto de volta do objeto (0 a 3). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** A direção do desenho que cai "para baixo" na tela com o giro `giro` (a face que fica de frente na 3/4). */
export function frenteNoDesenho(giro: number): Ponto {
  const q = quartosDoGiro(giro)
  return q === 1 ? [1, 0] : q === 2 ? [0, -1] : q === 3 ? [-1, 0] : [0, 1]
}

/**
 * A mesma forma com a caixa esticada até `ate` px do centro, do lado que cai EMBAIXO NA TELA com o giro `giro`: a
 * 3/4 pinta as estruturas pela beira de baixo da caixa, e o que fica em cima do teto (a cúpula, o cano, a lâmpada)
 * tem de sair depois dele, senão o teto pinta por cima (a conta da torre de vigia).
 */
export function esticadaParaAFrente(forma: Forma, ate: number, giro: number): Forma {
  const [dx, dy] = frenteNoDesenho(giro)
  const [x0, y0, x1, y1] = forma.b
  const b: readonly [number, number, number, number] =
    dx > 0 ? [x0, y0, Math.max(x1, ate), y1] : dx < 0 ? [Math.min(x0, -ate), y0, x1, y1] : dy > 0 ? [x0, y0, x1, Math.max(y1, ate)] : [x0, Math.min(y0, -ate), x1, y1]
  return { b, d: forma.d }
}

/** Abaixo deste passo na imagem (px), a onda da chapa vira chuvisco: some aos poucos até `PASSO_SEM_ONDA`. */
const PASSO_COM_ONDA = 3
const PASSO_SEM_ONDA = 1.5

/**
 * CHAPA ONDULADA: a textura da classe com a onda da chapa por cima, de `passo` px, ao longo de x (`aoLongoDeX`) ou
 * de y. A onda some aos poucos quando o passo fica miúdo na imagem (no tamanho de mesa pequeno).
 */
export function chapaOndulada(base: Textura | null, passo: number, forca: number, aoLongoDeX: boolean): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    const nitidez = limitar01((passo * escala - PASSO_SEM_ONDA) / (PASSO_COM_ONDA - PASSO_SEM_ONDA))
    if (nitidez <= 0) return
    const t = ((aoLongoDeX ? x : y) / passo) * 2 * Math.PI
    s[3] += forca * nitidez * Math.sin(t)
  }
}
