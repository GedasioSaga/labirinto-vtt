/**
 * APOIO das cinco construções do lote L17 de 14/11/2026 (farol, coreto, guindaste de porto, poste com relógio e
 * quiosque, grupo Cidade e porto): o que as cinco repetem para a 3/4 derivada (`tresQuartos.ts`).
 *
 * Na 3/4 cada sombra com altura vira uma ESTRUTURA; as estruturas saem do norte para o sul pela base da caixa
 * (`b[3]`), e na mesma base a mais baixa antes; cada peça sobe com a estrutura MAIS ALTA que contém o meio da
 * caixa dela; a frente de cada estrutura sai no material da maior peça que ficou com ela (sem peça, a maior do
 * objeto). Daí os truques daqui, os mesmos da torre de pedra e da torre de vigia:
 * - `esticadaAte`: a caixa da estrutura esticada para a frente NA TELA, para ela sair depois de outra;
 * - `comMeioEm`: a caixa da peça recentrada num ponto, para a peça subir com a estrutura daquele ponto;
 * - `pingo`: a peça mínima que dá o material da frente da estrutura em que cai;
 * - `furada`: a forma com furinhos onde há um pingo de outra estrutura, para a estrutura mais alta (a galeria
 *   do farol por cima do fuste) não levar o pingo. O furo é menor que meio px: a frente, varrida de pé, o cobre.
 */
import { capsula, elipse, poligono, type Caixa, type Forma, type Ponto } from './formas'
import type { CriarPeca, MaterialDaPeca, Peca, Sombra } from './motor'

/** O raio do pingo (px do protótipo): pequeno demais para aparecer, grande o bastante para ter meio. */
const RAIO_DO_PINGO = 0.25
/** O raio do furinho em volta de um pingo (px): passa o do pingo, e a varredura da frente o tapa. */
const RAIO_DO_FURO = 0.4

export function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto do desenho depois do quarto de volta que a 3/4 pinta (`girarPonto` de `tresQuartos.ts`). */
export function naTela(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [-y, x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [y, -x] : [x, y]
}

/** O ponto do desenho que cai em (x, y) NA TELA. */
export function doDesenho(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** O ângulo (rad, no desenho) que aponta para `angulo` NA TELA (90° = para baixo, a frente). */
export function anguloDoDesenho(angulo: number, quartos: number): number {
  const [x, y] = doDesenho(Math.cos(angulo), Math.sin(angulo), quartos)
  return Math.atan2(y, x)
}

/** A mesma forma com a caixa esticada até `ate` px do centro, do lado que fica embaixo NA TELA (sai depois). */
export function esticadaAte(forma: Forma, ate: number, quartos: number): Forma {
  const [dx, dy] = doDesenho(0, 1, quartos)
  const [x0, y0, x1, y1] = forma.b
  const b: Caixa =
    dx > 0.5 ? [x0, y0, Math.max(x1, ate), y1] : dx < -0.5 ? [Math.min(x0, -ate), y0, x1, y1] : dy > 0.5 ? [x0, y0, x1, Math.max(y1, ate)] : [x0, Math.min(y0, -ate), x1, y1]
  return { b, d: forma.d }
}

/** A mesma forma com a caixa recentrada em (mx, my): é pelo meio da caixa que a 3/4 escolhe a estrutura da peça. */
export function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** A forma andada (dx, dy) px: a sombra pintada no chão, longe do pé. */
export function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** O círculo com a distância exata, de uma raiz só (os discos dos postes e das colunas são muitos). */
export function disco(cx: number, cy: number, r: number): Forma {
  return {
    b: [cx - r, cy - r, cx + r, cy + r],
    d(x, y) {
      const dx = x - cx
      const dy = y - cy
      return Math.sqrt(dx * dx + dy * dy) - r
    },
  }
}

/** O polígono regular de `lados` lados com os cantos a `r` do centro, o primeiro canto no ângulo `giro`. */
export function poligonoRegular(cx: number, cy: number, r: number, lados: number, giro: number): Forma {
  return poligono(Array.from({ length: lados }, (_, i): Ponto => [cx + Math.cos(giro + (i * 2 * Math.PI) / lados) * r, cy + Math.sin(giro + (i * 2 * Math.PI) / lados) * r]))
}

/** O ângulo de (x, y) até `meio`, entre -π e π. */
export function desvio(x: number, y: number, meio: number): number {
  const a = Math.atan2(y, x) - meio
  return a - 2 * Math.PI * Math.round(a / (2 * Math.PI))
}

/** Um SETOR de anel: entre os raios r0 e r1, `meia` radianos para cada lado de `meio` (a porta, a janela). */
export function setor(r0: number, r1: number, meio: number, meia: number): Forma {
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i <= 8; i += 1) {
    const a = meio - meia + (meia * i) / 4
    for (const r of [r0, r1]) {
      xs.push(Math.cos(a) * r)
      ys.push(Math.sin(a) * r)
    }
  }
  return {
    b: [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1],
    d(x, y) {
      const r = Math.hypot(x, y)
      const fora = Math.abs(desvio(x, y, meio)) - meia
      return Math.max(r - r1, r0 - r, r * Math.sin(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, fora))))
    },
  }
}

/** Tampo solto no ar; sem força, não faz sombra (só dá a altura). */
export function solta(forma: Forma, z: number, forca = 0): Sombra {
  return { forma, z, solta: true, forca }
}

/** Coluna presa ao chão até `z`, sem sombra própria (a sombra do objeto é pintada à parte). */
export function coluna(forma: Forma, z: number): Sombra {
  return { forma, z, forca: 0 }
}

/** O pingo: a peça mínima que dá o material da frente da estrutura em que (x, y) cai. */
export function pingo(P: CriarPeca, x: number, y: number, mat: MaterialDaPeca, semente: number): Peca {
  return P(elipse(x, y, RAIO_DO_PINGO, RAIO_DO_PINGO), mat, { tabua: 0, bisel: 0, contorno: 0, semente })
}

/**
 * A forma com um furo de `raio` px em cada ponto (o pingo de uma estrutura mais baixa que fica debaixo desta: a
 * beira do fuste debaixo da galeria, a coluna debaixo do telhado). Furo mais largo que a espessura do tampo abre
 * uma fresta na frente varrida: só serve longe da beira da frente, onde as peças de cima o tapam.
 */
export function furada(forma: Forma, pontos: readonly Ponto[], raio = RAIO_DO_FURO): Forma {
  if (pontos.length === 0) return forma
  return {
    b: forma.b,
    d(x, y) {
      const dentro = forma.d(x, y)
      let perto = Infinity
      for (const [px, py] of pontos) {
        const dx = x - px
        const dy = y - py
        const d2 = dx * dx + dy * dy
        if (d2 < perto) perto = d2
      }
      return Math.max(dentro, raio - Math.sqrt(perto))
    },
  }
}

/**
 * A CÁPSULA AFUNILADA de A (raio ra) a B (raio rb), a casca convexa dos dois círculos: a sombra do fuste que
 * afina para cima, a lança do guindaste. Distância exata (a "uneven capsule" de Inigo Quilez, no eixo de A a B).
 */
export function capsulaAfunilada(ax: number, ay: number, ra: number, bx: number, by: number, rb: number): Forma {
  const h = Math.hypot(bx - ax, by - ay)
  if (h < 1e-6 || Math.abs(ra - rb) >= h) return ra >= rb ? disco(ax, ay, ra) : disco(bx, by, rb)
  const [ex, ey] = [(bx - ax) / h, (by - ay) / h]
  const b = (ra - rb) / h
  const a = Math.sqrt(1 - b * b)
  return {
    b: [Math.min(ax - ra, bx - rb), Math.min(ay - ra, by - rb), Math.max(ax + ra, bx + rb), Math.max(ay + ra, by + rb)],
    d(x, y) {
      const px0 = x - ax
      const py0 = y - ay
      const ly = px0 * ex + py0 * ey
      const lx = Math.abs(-px0 * ey + py0 * ex)
      const k = -b * lx + a * ly
      if (k < 0) return Math.hypot(lx, ly) - ra
      if (k > a * h) return Math.hypot(lx, ly - h) - rb
      return a * lx + b * ly - ra
    },
  }
}

/** Quanto cada disco de uma pilha de pé anda de lado (px): sem isso o pingo de um cairia em todos. */
const PASSO_DE_LADO_DA_PILHA = 0.15

/**
 * Discos empilhados ao longo do segmento de (x0, y0, z0) a (x1, y1, z1), um a cada `passo` px de altura ou de
 * chão (o que for maior): a coluna, a viga inclinada, a corda, o raio da roda. Cada disco é um tampo solto; a
 * caixa de cada um é esticada até `ate` para sair depois do que fica atrás. Devolve o PINGO de cada disco: o
 * ponto dele que nenhum disco mais alto contém (na beira do lado de onde a pilha sobe). Na pilha de pé, cada
 * disco anda um tico de lado, como os discos do mastro da torre de pedra.
 */
export function discosAoLongo(
  S: Sombra[],
  de: readonly [number, number, number],
  ate3: readonly [number, number, number],
  raio: number,
  passo: number,
  ate: number,
  quartos: number,
): Ponto[] {
  const [x0, y0, z0] = de
  const [x1, y1, z1] = ate3
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(z1 - z0), Math.hypot(x1 - x0, y1 - y0)) / passo))
  const deLado = Math.hypot(x1 - x0, y1 - y0) / n < PASSO_DE_LADO_DA_PILHA
  // O sentido em que a pilha SOBE: o pingo de cada disco fica na beira do outro lado.
  const sobe = z1 >= z0 ? 1 : -1
  const [ux, uy] = deLado ? [1, 0] : [((x1 - x0) / Math.hypot(x1 - x0, y1 - y0)) * sobe, ((y1 - y0) / Math.hypot(x1 - x0, y1 - y0)) * sobe]
  const pingos: Ponto[] = []
  for (let k = 0; k <= n; k += 1) {
    const t = k / n
    const lado = deLado ? PASSO_DE_LADO_DA_PILHA * k * sobe : 0
    const [x, y, z] = [x0 + (x1 - x0) * t + lado, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t]
    S.push(solta(esticadaAte(disco(x, y, raio), ate, quartos), z))
    pingos.push([x - ux * (raio - 0.08), y - uy * (raio - 0.08)])
  }
  return pingos
}

/** A grade de procura do `pontoSoDela`: tantos pontos por lado da caixa. */
const GRADE_DA_PROCURA = 7

/**
 * Um ponto da estrutura `dela` que nenhuma OUTRA estrutura com altura igual ou maior contém: o meio que faz a peça
 * subir com ela na 3/4 (o pingo, a peça de cima). Procura no centro da caixa e numa grade, do meio para fora; sem
 * ponto livre (a estrutura toda coberta por outra mais alta), devolve null e a estrutura fica sem peça. `procura` é a
 * forma de verdade quando a caixa da estrutura foi esticada para mudar a vez dela na 3/4.
 */
export function pontoSoDela(dela: Sombra, sombras: readonly Sombra[], procura: Forma = dela.forma): Ponto | null {
  const [x0, y0, x1, y1] = procura.b
  const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2]
  const candidatos: Ponto[] = [[mx, my]]
  for (let i = 0; i < GRADE_DA_PROCURA; i += 1) {
    for (let j = 0; j < GRADE_DA_PROCURA; j += 1) {
      candidatos.push([x0 + ((x1 - x0) * (i + 0.5)) / GRADE_DA_PROCURA, y0 + ((y1 - y0) * (j + 0.5)) / GRADE_DA_PROCURA])
    }
  }
  candidatos.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my))
  // Por último, um tico para dentro do meio de cada lado da caixa: a beira livre da pilha que anda de lado.
  candidatos.push([x0 + 0.1, my], [x1 - 0.1, my], [mx, y0 + 0.1], [mx, y1 - 0.1])
  for (const [x, y] of candidatos) {
    if (dela.forma.d(x, y) > -0.05) continue
    const livre = sombras.every((s) => s === dela || !(s.z > 0) || s.z < dela.z || s.forma.d(x, y) > 0)
    if (livre) return [x, y]
  }
  return null
}

/** Uma vara de `r` px entre dois pontos do desenho: a peça de cima da viga, do raio, do cabo. */
export function vara(ax: number, ay: number, bx: number, by: number, r: number): Forma {
  return capsula(ax, ay, bx, by, r)
}
