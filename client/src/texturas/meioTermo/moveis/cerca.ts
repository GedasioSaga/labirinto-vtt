/**
 * CERCA de cima com volume (`objetos.js:1237-1290`): o topo cortado de cada
 * mourão (a casca em volta e os anéis no meio) e, entre os mourões, as varas da
 * mesma madeira, a corda ou os dois fios de arame. Materiais: `madeira`
 * (mourões) e `ligacao` (varas, corda ou arame).
 *
 * Os mourões saem da MESMA geometria do desenho de linhas
 * (`geometriaDaCerca` de `lib/mobilia.ts`): um a cada ~1 casa pela reta ou
 * pelo ARCO da cerca curva, com o raio tirado da espessura. Assim a imagem
 * acompanha o comprimento e a curva com o padrão no tamanho de sempre (mais
 * mourões, nunca mourões esticados), e cada ligação é reta de mourão a mourão,
 * como numa cerca de verdade.
 */
import { geometriaDaCerca } from '../../../lib/mobilia'
import { ruido, contato, type Cena, type Textura } from './motor'
import { capsula, elipse } from './formas'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** Altura do mourão em casas (a sombra). */
const ALTURA_DO_MOURAO = 0.72
/** As ligações ficam a esta fração da altura do mourão (a sombra delas). */
const ALTURA_DA_LIGACAO = 0.7
/**
 * Raio de cada ligação, em px do protótipo, e quanto ela recua da borda do
 * mourão (fração do raio dele). A corda e o arame são mais grossos que no
 * protótipo (1,3 e 0,55): no nível 1 (0,89 pixel por px) o fio de 1,1 px não
 * chegava a um pixel opaco, e a cerca de arame cobria só 16% da pegada (o
 * piso é 25%); a de corda curva, 24%.
 */
const RAIO_DA_VARA = 1.8
const RAIO_DA_CORDA = 1.5
const RAIO_DO_ARAME = 0.9
/** Os dois fios do arame, afastados do eixo para cada lado (px do protótipo): separados, não um fio grosso. */
const AFASTAMENTO_DO_ARAME = 1.3
const RECUO_DA_LIGACAO = 0.55

type Ponto = readonly [number, number]

/** Topo de madeira cortada: anéis em volta do centro do mourão (`objetos.js:410-415`). */
function texTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const raio = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.4
    s[3] += Math.sin(raio * 4.2) * 0.035 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.06
  }
}

/** O segmento de `a` a `b` recuado `k` px em cada ponta. */
function encurtar(a: Ponto, b: Ponto, k: number): [number, number, number, number] {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  return [a[0] + (dx / l) * k, a[1] + (dy / l) * k, b[0] - (dx / l) * k, b[1] - (dy / l) * k]
}

/** As ligações entre dois mourões vizinhos, pela escolha do lugar `ligacao` (a classe do material diz qual). */
function ligar(c: ContextoDoMovel, cena: Cena, a: Ponto, b: Ponto, rp: number, i: number): void {
  const P = c.peca
  const [ax, ay, bx, by] = encurtar(a, b, rp * RECUO_DA_LIGACAO)
  const ang = Math.atan2(by - ay, bx - ax)
  const lig = c.m.ligacao
  if (lig.classe === 'metal') {
    // Dois fios, um de cada lado do eixo (pela normal do trecho: vale também na cerca em pé e na curva).
    const nx = -Math.sin(ang) * AFASTAMENTO_DO_ARAME
    const ny = Math.cos(ang) * AFASTAMENTO_DO_ARAME
    for (const lado of [-1, 1]) {
      cena.partes.push(P(capsula(ax + lado * nx, ay + lado * ny, bx + lado * nx, by + lado * ny, RAIO_DO_ARAME), lig, { eixo: ang, bisel: RAIO_DO_ARAME, contorno: 0.1, semente: 120 + i }))
    }
    return
  }
  if (lig.classe === 'corda') {
    cena.partes.push(P(capsula(ax, ay, bx, by, RAIO_DA_CORDA), lig, { eixo: ang, bisel: RAIO_DA_CORDA, contorno: 0.18, semente: 110 + i }))
    return
  }
  cena.partes.push(P(capsula(ax, ay, bx, by, RAIO_DA_VARA), lig, { eixo: ang, tabua: 0, bisel: 0.9, contorno: 0.26, tom: 0.94, semente: 100 + i }))
}

export const montarCerca: MontarMovel = (c, cena) => {
  const geometria = geometriaDaCerca(c.w, c.h, c.curva)
  if (geometria === null) return
  const rp = geometria.raio
  const pontos: Ponto[] = geometria.mouroes.map((m) => [m.x, m.y])
  const H = c.g * ALTURA_DO_MOURAO
  const arame = c.m.ligacao.classe === 'metal'
  for (const [px, py] of pontos) cena.sombras.push({ forma: elipse(px, py, rp, rp), z: H }, contato(elipse(px, py, rp, rp)))
  for (let i = 0; i + 1 < pontos.length; i += 1) {
    const [ax, ay, bx, by] = encurtar(pontos[i], pontos[i + 1], rp * 0.5)
    cena.sombras.push({ forma: capsula(ax, ay, bx, by, arame ? 0.6 : 1.6), z: H * ALTURA_DA_LIGACAO, forca: arame ? 0.18 : 0.26, solta: true })
  }
  for (let i = 0; i + 1 < pontos.length; i += 1) ligar(c, cena, pontos[i], pontos[i + 1], rp, i)
  const P = c.peca
  const mad = c.m.madeira
  pontos.forEach(([px, py], i) => {
    // A casca é o disco inteiro POR BAIXO do topo cortado (no protótipo, um anel até 0,8 do raio): com o anel, a
    // emenda das duas bordas suavizadas deixava um círculo meio transparente dentro do mourão, por onde o chão aparecia.
    cena.partes.push(P(elipse(px, py, rp, rp), mad, { polar: { cx: px, cy: py, r: rp }, tabua: 2.4, bisel: 1, tom: 0.66, semente: 80 + i }))
    cena.partes.push(P(elipse(px, py, rp * 0.81, rp * 0.81), mad, { textura: texTopo(px, py), bisel: 0.9, semente: 90 + i }))
  })
}
