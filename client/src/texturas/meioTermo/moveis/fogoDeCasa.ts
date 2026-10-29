/**
 * O que a LAREIRA e a FORNALHA dividem (29/10/2026): o fogo parado da imagem
 * (o halo quente, as brasas redondas, a lenha queimada e o leito de cinza, nas
 * cores da fogueira) e a ALVENARIA, as pedras assentadas em fiadas com a
 * junta escura entre elas. A chama é a camada animada de sempre
 * (`pixi/chamasDasFogueiras.ts`), que lê a mesma disposição
 * (`lib/mobilia/fogoDeCasa.ts`).
 *
 * Apagado, a imagem não tem halo nem brasa acesa: sobra a lenha fria, a cinza
 * e um ou outro carvão escuro. O brilho é contido (regra 5 do estilo): o
 * halo é o da fogueira, alfa 0,2 no centro, e cai suave até a borda.
 */
import { hash } from '../../ruido'
import { caixa, type Forma } from './formas'
import { ruido, texturaDaClasse, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { CINZA, type ContextoDoMovel } from './contexto'
import { BRASA_QUENTE, BRASA_VIVA } from './fogueira'

type Rgb3 = readonly [number, number, number]

/** O carvão apagado: quase preto, quente, com a luz do motor dando o volume. */
export const CARVAO_FRIO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x33, 0x2c] }
/** O material das peças de fogo (halo, brasas): o da cinza, onde estão; a cor sai toda da textura. */
export const FOGO_PARADO: MaterialDaPeca = CINZA

function misturar(a: Rgb3, b: Rgb3, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** O halo: o tom do miolo das brasas com alfa que cai suave do centro (cx, cy) até os raios rx, ry. */
export function texHalo(cx: number, cy: number, rx: number, ry: number, alfa: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const q = Math.min(1, dx * dx + dy * dy)
    s[0] = BRASA_QUENTE[0]
    s[1] = BRASA_QUENTE[1]
    s[2] = BRASA_QUENTE[2]
    s[4] = 1
    s[5] = alfa * (1 - q) * (1 - q)
  }
}

/** Uma brasa redonda: miolo quente, borda vermelha apagada, toda emissão (a da fogueira). */
export function texBrasa(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, Math.hypot(x - cx, y - cy) / r)
    const c = misturar(BRASA_QUENTE, BRASA_VIVA, q * q)
    s[0] = c[0]
    s[1] = c[1]
    s[2] = c[2]
    s[4] = 1
  }
}

/** A lenha: a casca do material, queimada (mais escura) perto do centro do fogo (cx, cy, raio r). */
export function texLenhaQueimada(cx: number, cy: number, r: number, forca: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    texturaDaClasse(p.mat.classe)?.(u, v, x, y, p, s, escala)
    const d = Math.hypot(x - cx, y - cy)
    if (d >= r) return
    s[3] -= forca * (1 - d / r)
  }
}

/** O leito de cinza: a variação miúda da cinza, um pouco mais clara para fora (centro cx, cy, raio r). */
export function texCinza(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x - cx, y - cy) / r
    const n = ruido(x * 0.3 + 11, y * 0.3) + ruido(x * 0.85 + 3, y * 0.85 + 7) * 0.5
    s[3] += ruido(x * 0.12, y * 0.12) * 0.16 + n * 0.08 + (rr - 0.5) * 0.06
  }
}

/** A fuligem no fundo da boca: escurece de `y0` (o fundo, mais escuro) até `y1`, sem pintar cor. */
export function texFuligem(y0: number, y1: number, forca: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    texturaDaClasse(p.mat.classe)?.(u, v, x, y, p, s, escala)
    const t = Math.max(0, Math.min(1, (y1 - y) / (y1 - y0)))
    s[3] -= forca * t * t + ruido(x * 0.4, y * 0.4) * 0.05
  }
}

/**
 * As brasas espalhadas em volta de (cx, cy): `n` brasas redondas de raio `r` a
 * `r` x 1,5, dentro da elipse rx, ry, sempre nos mesmos lugares (o sorteio é
 * fixo pela `semente`, não pelo móvel: duas lareiras iguais têm o mesmo fogo).
 * Apagado, são carvões escuros com o volume do motor.
 */
export function brasas(c: ContextoDoMovel, L: Peca[], cx: number, cy: number, rx: number, ry: number, n: number, r: number, acesa: boolean, semente: number): void {
  for (let i = 0; i < n; i += 1) {
    const a = i * 2.39996 + hash(i, 1, semente) * 0.6
    const d = Math.sqrt((i + 0.5) / n)
    const bx = cx + Math.cos(a) * d * rx
    const by = cy + Math.sin(a) * d * ry
    const raio = r * (1 + 0.5 * hash(i, 2, semente))
    const forma = caixa(bx - raio, by - raio * 0.8, bx + raio, by + raio * 0.8, raio * 0.75)
    if (acesa) L.push(c.peca(forma, FOGO_PARADO, { textura: texBrasa(bx, by, raio), bisel: 0, contorno: 0, semente: semente + i }))
    else L.push(c.peca(forma, CARVAO_FRIO, { bisel: raio * 0.8, contorno: 0.15, tom: 0.9 + 0.2 * hash(i, 3, semente), semente: semente + i }))
  }
}

/**
 * ALVENARIA: pedras em fiadas (`fiadas` linhas de `porFiada` pedras, a fiada
 * de cima e a de baixo desencontradas meia pedra), sobre a junta escura que
 * é a própria forma inteira (`fundo`). Cada pedra tem o tom dela, fixo pela
 * posição. Devolve nada: empurra as peças em `L`, a junta primeiro.
 */
export function alvenaria(
  c: ContextoDoMovel,
  L: Peca[],
  fundo: Forma,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fiadas: number,
  porFiada: number,
  pedra: MaterialDaPeca,
  semente: number,
): void {
  const junta = 0.9
  L.push(c.peca(fundo, pedra, { tabua: 0, bisel: 1.2, tom: 0.62, contorno: 0.25, semente }))
  const altura = (y1 - y0) / fiadas
  const largura = (x1 - x0) / porFiada
  for (let f = 0; f < fiadas; f += 1) {
    const desencontro = f % 2 === 1 ? largura / 2 : 0
    const ya = y0 + f * altura + junta / 2
    const yb = y0 + (f + 1) * altura - junta / 2
    for (let i = -1; i < porFiada + 1; i += 1) {
      const xa = Math.max(x0 + junta / 2, x0 + i * largura + desencontro + junta / 2)
      const xb = Math.min(x1 - junta / 2, x0 + (i + 1) * largura + desencontro - junta / 2)
      if (xb - xa < junta * 1.5) continue
      const raio = Math.min(1.6, (yb - ya) / 3)
      L.push(c.peca(caixa(xa, ya, xb, yb, raio), pedra, { tabua: 0, bisel: Math.min(2.2, (yb - ya) * 0.3), tom: 0.9 + 0.18 * hash(f, i, semente), contorno: 0.15, semente: semente + 1 + f * 7 + i }))
    }
  }
}
