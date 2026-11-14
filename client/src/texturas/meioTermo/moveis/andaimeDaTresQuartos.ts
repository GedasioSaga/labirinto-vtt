/**
 * ANDAIME DA 3/4 das construções do lote L15 de 14/11/2026 (o portão com grade
 * levadiça, a torre de cerco, a estátua equestre, o obelisco, a forca e a torre
 * do sino): as ferramentas com que elas montam a vista 3/4 (`tresQuartos.ts`)
 * a partir das sombras da vista de cima. Não é um objeto: não tem registro nem
 * ficha.
 *
 * A 3/4 faz de cada sombra com altura uma ESTRUTURA (coluna do chão até `z`, ou
 * tampo solto em `z` com a beirada do perfil), pinta as estruturas do norte
 * para o sul pela base da caixa (`b[3]`) e sobe cada peça com a estrutura mais
 * alta que contém o meio da caixa dela. Daí:
 * - `solta` e `colunaSemSombra`: a estrutura que só a 3/4 vê (força 0: nada no
 *   chão da vista de cima);
 * - `pino`: um ponto que sobe uma peça até uma altura, sem frente que se veja
 *   (a beirada do pino é um fio do tamanho da espessura do perfil: só serve
 *   onde ela é fina);
 * - `crescida`: a caixa maior para os quatro lados, que põe a estrutura DEPOIS
 *   das vizinhas na ordem de pintura sem mudar a forma (para os quatro lados, e
 *   não só para a frente, para valer também com o objeto girado);
 * - `comMeioEm`: a caixa centrada noutro ponto, para a peça subir com a
 *   estrutura certa;
 * - `fiadaRetangular`: a casca de uma parede reta em blocos, com as juntas
 *   desencontradas de uma fiada para a outra (a fiada da torre de pedra);
 * - `arrastada`: a forma arrastada do pé até a altura `z`, a sombra no chão de
 *   uma coisa alta feita de tampos soltos (que não pode ser coluna).
 */
import { hash } from '../../ruido'
import { caixa, elipse, poligono, type Forma } from './formas'
import { SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type Sombra, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { desgirarCena, quartosDoGiro } from './pipaDeitada'

/**
 * O desenho montado JÁ NA TELA e devolvido ao referencial do objeto (`desgirarCena`, a conta do tonel): o quarto
 * de volta que as duas vistas pintam (`girarCena`) traz a cena de volta como ela foi montada. Para o que é igual
 * dos quatro lados (o obelisco, a torre do sino): a frente fica sempre embaixo na tela, e as divisões em metade do
 * norte e metade do sul, que acertam a ordem de pintura da 3/4, continuam do lado certo com o objeto girado.
 */
export function montadaNaTela(montar: MontarMovel): MontarMovel {
  return (c, cena) => {
    const quartos = quartosDoGiro(c.giro)
    if (quartos === 0) {
      montar(c, cena)
      return
    }
    // Com um quarto de volta, a pegada na tela é a do objeto deitada.
    const naTela = quartos % 2 === 1 ? { ...c, w: c.h, h: c.w, hw: c.hh, hh: c.hw } : c
    const tela: Cena = { partes: [], sombras: [] }
    montar(naTela, tela)
    desgirarCena(tela, quartos, cena)
  }
}

/** O raio do pino (px): pequeno o bastante para a frente dele não aparecer. */
const RAIO_DO_PINO = 0.3
/** A meia junta entre dois blocos de uma fiada (px), a da torre de pedra. */
const MEIA_JUNTA = 0.45
/** O arrasto da sombra anda em passos garantidos pela distância, nunca menores que este (px). */
const PASSO_MINIMO = 0.35
/** Abaixo desta distância (px, dentro da forma) o ponto já está na sombra com folga: para de andar. */
const FUNDO_DO_ARRASTO = -4
/** Até esta distância (px) o arrasto anda devagar, para não pular a borda. */
const PERTO_DA_BORDA = 2

/** Tampo solto que só a 3/4 vê (sem sombra no chão da vista de cima). */
export function solta(forma: Forma, z: number): Sombra {
  return { forma, z, solta: true, forca: 0 }
}

/** Coluna do chão até `z` que só a 3/4 vê. */
export function colunaSemSombra(forma: Forma, z: number): Sombra {
  return { forma, z, forca: 0 }
}

/** Um ponto em (x, y): com `solta(pino(x, y), z)`, a peça com o meio nele sobe até `z`. */
export function pino(x: number, y: number): Forma {
  return elipse(x, y, RAIO_DO_PINO, RAIO_DO_PINO)
}

/** A mesma forma com a caixa `k` px maior para os quatro lados (sai depois na ordem de pintura da 3/4). */
export function crescida(forma: Forma, k: number): Forma {
  const [x0, y0, x1, y1] = forma.b
  return { b: [x0 - k, y0 - k, x1 + k, y1 + k], d: forma.d }
}

/** O passo (px) entre as bases de duas estruturas postas em ordem por `emOrdem`. */
const PASSO_DA_ORDEM = 0.05

/**
 * As formas na ORDEM DE PINTURA da 3/4 dada pela lista: a caixa de cada uma cresce até a base dela ficar depois da
 * anterior e depois de `depoisDe` (px; use a maior base natural das estruturas do objeto), sem mudar a forma.
 */
export function emOrdem(formas: readonly Forma[], depoisDe: number): Forma[] {
  return formas.map((f, i) => crescida(f, Math.max(0, depoisDe + PASSO_DA_ORDEM * (i + 1) - f.b[3])))
}

/** A mesma forma com o meio da caixa em (mx, my): a peça sobe com a estrutura que contém esse ponto. */
export function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

export function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/**
 * A forma arrastada do pé até a altura `z` (px) na direção da sombra (`SOMBRA_X`, `SOMBRA_Y`): a sombra no chão de
 * uma coisa alta que, na 3/4, é feita de tampos soltos e não de uma coluna.
 */
export function arrastada(f: Forma, z: number): Forma {
  const ax = SOMBRA_X * z
  const ay = SOMBRA_Y * z
  const comprimento = Math.hypot(ax, ay)
  if (!(comprimento > 0)) return f
  const [ux, uy] = [ax / comprimento, ay / comprimento]
  const b = f.b
  return {
    b: [b[0], b[1], b[2] + ax, b[3] + ay],
    d(x, y) {
      let melhor = Infinity
      let t = 0
      for (;;) {
        const v = f.d(x - ux * t, y - uy * t)
        if (v < melhor) melhor = v
        if (melhor <= FUNDO_DO_ARRASTO || t >= comprimento) return melhor
        t = Math.min(comprimento, t + Math.max(PASSO_MINIMO, v - Math.min(melhor, PERTO_DA_BORDA)))
      }
    },
  }
}

/**
 * A caixa (x0, y0, x1, y1) arrastada do pé até a altura `z` (px): o mesmo que `arrastada(caixa(...), z)`, mas como o
 * hexágono exato (a conta é de um polígono, sem andar o arrasto a cada ponto: a sombra das massas grandes sai barata).
 */
export function caixaArrastada(x0: number, y0: number, x1: number, y1: number, z: number): Forma {
  const [ax, ay] = [SOMBRA_X * z, SOMBRA_Y * z]
  return poligono([[x0, y0], [x1, y0], [x1 + ax, y0 + ay], [x1 + ax, y1 + ay], [x0 + ax, y1 + ay], [x0, y1]])
}

/**
 * Uma FIADA de parede retangular: a casca de `casca` px por dentro do retângulo, em blocos de `bloco` px com a junta
 * começando em `desloc` px (desencontre de uma fiada para a outra). Em cada face a junta corre de través.
 */
export function fiadaRetangular(x0: number, y0: number, x1: number, y1: number, casca: number, bloco: number, desloc: number): Forma {
  const fora = caixa(x0, y0, x1, y1)
  return {
    b: [x0, y0, x1, y1],
    d(x, y) {
      const dFora = fora.d(x, y)
      const dentro = Math.min(x - x0, x1 - x, y - y0, y1 - y)
      // Nas faces de cima e de baixo a junta anda em x; nas dos lados, em y.
      const naFaceDeX = Math.min(y - y0, y1 - y) <= Math.min(x - x0, x1 - x)
      const t = ((naFaceDeX ? x - x0 : y - y0) - desloc) / bloco
      const junta = MEIA_JUNTA - Math.abs(t - Math.round(t)) * bloco
      return Math.max(dFora, dentro - casca, junta)
    },
  }
}

/** O que faz sombra num tampo: a forma (planta) e de que altura a que altura ela vai, acima do tampo (px). */
export interface QueFazSombra {
  readonly forma: Forma
  readonly de: number
  readonly ate: number
}

/** O passo (px) entre duas amostras da sombra pintada num tampo: menor que a borda, para não sair em degraus. */
const PASSO_DA_SOMBRA_PINTADA = 1.6

/**
 * A textura `base` com a SOMBRA PINTADA do que está em cima do tampo (a conta da estátua): o chão da 3/4 só recebe
 * a sombra que cai no chão; a que cai no degrau, no dado ou no piso do alto é pintada na peça, e sobe com ela.
 * A sombra anda na direção da luz (`SOMBRA_X`, `SOMBRA_Y`), de `de` a `ate` px de altura acima do tampo.
 */
export function texturaComSombra(base: Textura | null, sombras: readonly QueFazSombra[], borda: number, forca: number): Textura {
  const passos = sombras.map((s) => Math.max(1, Math.ceil((Math.hypot(SOMBRA_X, SOMBRA_Y) * (s.ate - s.de)) / PASSO_DA_SOMBRA_PINTADA)))
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    let k = 0
    sombras.forEach((sombra, i) => {
      const n = passos[i]
      for (let j = 0; j <= n && k < 1; j += 1) {
        const z = sombra.de + ((sombra.ate - sombra.de) * j) / n
        const kj = 0.5 - sombra.forma.d(x - SOMBRA_X * z, y - SOMBRA_Y * z) / (2 * borda)
        if (kj > k) k = kj
      }
    })
    if (k > 0) s[3] -= forca * (k < 1 ? k : 1)
  }
}

/**
 * Lajes de pedra (o terraço, o adarve, o cadafalso de pedra): a textura da pedra, as juntas escuras e cada laje com
 * o seu tom, em fileiras desencontradas de `largura` x `altura` px.
 */
export function texturaDeLajes(largura: number, altura: number, semente: number): Textura {
  const daPedra = texturaDaClasse('pedra')
  return (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const fileira = Math.floor(y / altura)
    const xx = x / largura + (((fileira % 2) + 2) % 2) * 0.5
    const coluna = Math.floor(xx)
    const [fx, fy] = [xx - coluna, y / altura - fileira]
    const junta = Math.min(fx * largura, (1 - fx) * largura, fy * altura, (1 - fy) * altura)
    s[3] += (hash(coluna, fileira, semente) - 0.5) * 0.14
    if (junta < 1) s[3] -= 0.3 * (1 - junta)
  }
}
