/**
 * As VERSÕES da carroça (lote L06 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): a 1ª, a
 * de hoje (os dois sacos e o barrilzinho), é o desenho de `MONTADORES` (`../carroca.ts`). As outras são a MESMA
 * carroça (os varais, a caixa de tábuas, as rodas e a sombra dela) com outra CARGA, de cima e de lado:
 *
 * - COM FENO: o monte de feno passando um nada da borda, a crista mais clara, fiapos soltos em volta e o forcado
 *   deitado em cima. De lado, o monte sobe acima da caixa e alguns fiapos caem pela borda.
 * - COM BARRIS: seis barris em pé, três por fileira, cada um com as aduelas, o tampo de tábuas, o aro de ferro e o
 *   batoque. De lado, as três bocas aparecem acima da borda da caixa.
 * - COBERTA: a lona de linho esticada nos arcos (o carroção), a boca franzida na frente e atrás. De lado, o toldo
 *   em arco baixo sobre a caixa, com as costuras dos arcos e as cordas que amarram a lona na caixa.
 *
 * Como a troca acontece: o desenho de hoje é chamado com uma fábrica de peças que marca as peças da carga de hoje
 * (pela semente: os sacos e o barrilzinho) e elas saem da cena; o resto sai byte a byte igual. A carga nova entra por
 * cima (de cima) ou atrás da caixa (de lado: a tábua da frente esconde o pé do feno e dos barris). A carga alta faz
 * sombra própria, mais comprida que a da caixa, só na vista de cima: na 3/4 derivada (`../tresQuartos.ts`) cada
 * sombra com altura vira um tampo, e a carga sairia de cima da caixa; lá ela fica no tampo da caixa, como os sacos de
 * hoje. Pelo mesmo motivo a carga cabe na caixa (a frente da 3/4 tem a cor da maior peça, que tem de ser a caixa); só
 * os fiapos passam da borda. Lugares de material: os da carroça (`madeira` e `aros`); o feno (o de `../feno.ts`), o
 * carvalho dos barris e a lona são fixos, como os sacos de hoje.
 */
import { anel, caixa, capsula, elipse, poligono, uniao, type Forma, type Ponto } from '../formas'
import { hash } from '../../../ruido'
import type { Cena, CriarPeca, MaterialDaPeca, Peca } from '../motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from '../contexto'
import { montarCarroca } from '../carroca'
import { texMonte } from '../feno'
import type { VersoesDesenhadas } from '.'

/** As peças da carga de hoje, pela semente (`../carroca.ts`): de cima os dois sacos, o barrilzinho e o aro dele; de lado o saco. */
const CARGA_DE_CIMA: ReadonlySet<number> = new Set([462, 463, 464, 465])
const CARGA_DE_LADO: ReadonlySet<number> = new Set([463])
/** A peça da caixa de lado (`../carroca.ts`): a carga de lado entra antes dela, atrás da tábua da frente. */
const CAIXA_DE_LADO = 460

const BURACO_DA_LONA: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x33, 0x2a] }
const BATOQUE: MaterialDaPeca = { classe: 'liso', rgb: [0x4f, 0x3c, 0x2c] }
/** O feno de `../feno.ts`: o amarelo-palha contido; os fios soltos vêm de `texMonte`, no lugar da trama da palha. */
const FENO: MaterialDaPeca = { classe: 'palha', rgb: [0xc4, 0xa7, 0x69] }

/** A sombra própria da carga alta: só na vista de cima (na 3/4 derivada ela tiraria a carga de cima da caixa). */
function sombraDaCarga(c: ContextoDoMovel, cena: Cena, forma: Forma, z: number, forca: number): void {
  if (c.vista !== 'tres-quartos') cena.sombras.push({ forma, z, solta: true, forca })
}

/** O que o desenho de hoje deixou: onde a carga de lado entra (o índice da caixa em `cena.partes`). */
interface Base {
  readonly atrasDaCaixa: number
}

/** A carroça de hoje sem a carga: as peças marcadas pela semente saem da cena. */
function carrocaVazia(c: ContextoDoMovel, cena: Cena): Base {
  const carga = c.lado === 'lado' ? CARGA_DE_LADO : CARGA_DE_CIMA
  const tirar = new Set<Peca>()
  let caixaDeLado: Peca | undefined
  const peca: CriarPeca = (forma, mat, o) => {
    const p = c.peca(forma, mat, o)
    if (o?.semente !== undefined && carga.has(o.semente)) tirar.add(p)
    if (o?.semente === CAIXA_DE_LADO) caixaDeLado = p
    return p
  }
  montarCarroca({ ...c, peca }, cena)
  for (let i = cena.partes.length - 1; i >= 0; i -= 1) if (tirar.has(cena.partes[i])) cena.partes.splice(i, 1)
  const i = caixaDeLado === undefined ? -1 : cena.partes.indexOf(caixaDeLado)
  return { atrasDaCaixa: i < 0 ? cena.partes.length : i }
}

/** As medidas da carroça de cima (as de `../carroca.ts`): a caixa de `x0` a `hw` e de `-meia` a `meia`. */
function caixaDeCima(c: ContextoDoMovel): { x0: number; meia: number } {
  return { x0: -c.hw + 0.32 * c.w, meia: 0.33 * c.h }
}

/** As medidas da carroça de lado (as de `../carroca.ts`): a caixa de `x0` a `hw`, o alto dela em `y0`, o pé em `y1`. */
function caixaDeLado(c: ContextoDoMovel): { x0: number; y0: number; y1: number } {
  const R = Math.min(0.4 * c.h, 0.27 * c.w)
  const cy = c.hh - R
  return { x0: -0.3 * c.w, y0: cy - 0.42 * c.h, y1: cy + 0.04 * c.h }
}

/** Um contorno fechado e irregular em volta do retângulo (x0, y0, x1, y1): a borda de um monte, o pano frouxo. */
function contornoIrregular(x0: number, y0: number, x1: number, y1: number, tremor: number, semente: number): Forma {
  const [cx, cy, rx, ry] = [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2]
  const pontos: Ponto[] = []
  const lados = 36
  for (let i = 0; i < lados; i += 1) {
    const a = (i / lados) * 2 * Math.PI
    // A superelipse (o monte quase retangular, de cantos gordos) e o tremor de cada ponto.
    const [ca, sa] = [Math.cos(a), Math.sin(a)]
    const fx = Math.sign(ca) * Math.abs(ca) ** 0.55
    const fy = Math.sign(sa) * Math.abs(sa) ** 0.55
    const t = 1 + (hash(i, semente, 6061) - 0.5) * 2 * tremor
    pontos.push([cx + fx * rx * t, cy + fy * ry * t])
  }
  return poligono(pontos)
}

// ---------- com feno ----------

function fenoDeCima(c: ContextoDoMovel, cena: Cena): void {
  const { hw, w, h, g, peca: P } = c
  const { x0, meia } = caixaDeCima(c)
  const L = cena.partes
  // O monte dentro da caixa, a borda das tábuas aparecendo em volta (o tremor de 5% não passa da medida).
  const [mx, mrx, mry] = [(x0 + hw) / 2, ((hw - x0) / 2 - 1.4) / 1.05, (meia - 1.4) / 1.05]
  const monte = contornoIrregular(mx - mrx, -mry, mx + mrx, mry, 0.05, 1)
  sombraDaCarga(c, cena, monte, g * 0.85, 0.28)
  // Os fiapos soltos em volta, por baixo do monte (só as pontas passam da borda).
  for (let i = 0; i < 16; i += 1) {
    const a = hash(i, 2, 6062) * 2 * Math.PI
    const [px, py] = [mx + Math.cos(a) * mrx, Math.sin(a) * mry]
    const giro = a + (hash(i, 3, 6062) - 0.5) * 1.4
    const l = 0.05 * h + hash(i, 4, 6062) * 0.05 * h
    L.push(P(capsula(px, py, px + Math.cos(giro) * l, py + Math.sin(giro) * l, 0.55), FENO, { bisel: 0.4, tom: 0.9 + 0.25 * hash(i, 5, 6062), contorno: 0.2, semente: 6100 + i }))
  }
  L.push(P(monte, FENO, { bisel: 0.2 * h, tom: 0.94, contorno: 0.26, textura: texMonte(monte, mx - 0.08 * w, -0.2 * mry, Math.max(mrx, mry), 6120), semente: 6120, projeta: { dist: 3, forca: 0.3 } }))
  // A crista, mais clara: o alto do monte pega a luz.
  const crista = contornoIrregular(x0 + 0.12 * w, -meia * 0.55, hw - 0.1 * w, meia * 0.45, 0.08, 2)
  L.push(P(crista, FENO, { bisel: 0.14 * h, tom: 1.08, contorno: 0.12, textura: texMonte(crista, mx - 0.08 * w, -0.2 * mry, Math.max(mrx, mry) * 0.8, 6121), semente: 6121 }))
  // O forcado deitado no feno: o cabo de madeira da carroça e os três dentes de ferro na ponta.
  const [ax, ay, bx, by] = [x0 + 0.1 * w, 0.2 * h, hw - 0.2 * w, -0.16 * h]
  L.push(P(capsula(ax, ay, bx, by, 0.95), c.m.madeira, { bisel: 0.9, tabua: 0, eixo: Math.atan2(by - ay, bx - ax), tom: 1.12, contorno: 0.3, semente: 6122, projeta: { dist: 1.5, forca: 0.35 } }))
  const l = Math.hypot(bx - ax, by - ay)
  const [ux, uy] = [(bx - ax) / l, (by - ay) / l]
  const [nx, ny] = [-uy, ux]
  const travessa = capsula(bx - nx * 2.6, by - ny * 2.6, bx + nx * 2.6, by + ny * 2.6, 0.6)
  const dentes = [-2.4, 0, 2.4].map((d) => capsula(bx + nx * d, by + ny * d, bx + nx * d * 1.15 + ux * 0.1 * w, by + ny * d * 1.15 + uy * 0.1 * w, 0.45))
  L.push(P(dentes.reduce(uniao, travessa), c.m.aros, { bisel: 0.45, contorno: 0.3, metal: 0.4, semente: 6123, projeta: { dist: 1.2, forca: 0.35 } }))
}

function fenoDeLado(c: ContextoDoMovel, cena: Cena, base: Base): void {
  const { hh, hw, w, h, peca: P } = c
  const { x0, y0 } = caixaDeLado(c)
  // O monte, atrás da tábua da frente: a corcova sobe até perto do alto da pegada e desce para dentro da caixa.
  const topo = -hh + 1
  const pontos: Ponto[] = [[x0 - 1.5, y0 + 8]]
  const lados = 14
  for (let i = 0; i <= lados; i += 1) {
    const t = i / lados
    const corcova = Math.sin(Math.PI * t) ** 0.6
    pontos.push([x0 - 1.5 + t * (hw + 1 - x0), y0 + 1 - (y0 + 1 - topo) * corcova * (0.88 + 0.12 * hash(i, 7, 6064))])
  }
  pontos.push([hw + 1, y0 + 8])
  const pilha = poligono(pontos)
  const textura = texMonte(pilha, x0 + 0.45 * (hw - x0), topo + 0.3 * (y0 - topo), 0.6 * (hw - x0), 6130)
  cena.partes.splice(base.atrasDaCaixa, 0, P(pilha, FENO, { bisel: 0.09 * h, tom: 1.0, contorno: 0.26, textura, semente: 6130 }))
  // Os fiapos que caem pela borda da caixa, por cima da tábua.
  for (let i = 0; i < 7; i += 1) {
    const x = x0 + (i + 0.5) * ((hw - x0) / 7) + (hash(i, 8, 6064) - 0.5) * 4
    const l = 0.05 * h + hash(i, 9, 6064) * 0.05 * h
    cena.partes.push(P(capsula(x, y0 - 1, x + (hash(i, 10, 6064) - 0.5) * 5, y0 - 1 + l, 0.55), FENO, { bisel: 0.4, tom: 0.95 + 0.2 * hash(i, 11, 6064), contorno: 0.2, semente: 6131 + i }))
  }
  // O cabo do forcado espetado no monte, inclinado para trás.
  cena.partes.splice(base.atrasDaCaixa, 0, P(capsula(x0 + 0.55 * (hw - x0), y0 + 4, x0 + 0.55 * (hw - x0) + 0.1 * w, topo - 0.02 * h, 0.95), c.m.madeira, { bisel: 0.9, tabua: 0, eixo: QUARTO, tom: 1.1, contorno: 0.3, semente: 6140 }))
}

// ---------- com barris ----------

/** Um barril em pé visto de cima: as aduelas em volta, o tampo de tábuas, o aro de ferro e o batoque. */
function barrilDeCima(c: ContextoDoMovel, cena: Cena, bx: number, by: number, rb: number, i: number): void {
  const P = c.peca
  const carvalho = materialDaPeca('carvalho')
  sombraDaCarga(c, cena, elipse(bx, by, rb, rb), c.g * 0.78, 0.24)
  cena.partes.push(P(elipse(bx, by, rb, rb), carvalho, { bisel: 1.4, tabua: 2.6, polar: { cx: bx, cy: by, r: rb }, tom: 0.92 + 0.1 * hash(i, 1, 6065), contorno: 0.3, semente: 6150 + i * 4, projeta: { dist: 2.4, forca: 0.32 } }))
  cena.partes.push(P(elipse(bx, by, rb * 0.8, rb * 0.8), carvalho, { bisel: 0.8, tabua: rb * 0.42, eixo: hash(i, 2, 6065) * Math.PI, tom: 0.86 + 0.12 * hash(i, 3, 6065), contorno: 0.2, recesso: { k: 1.2, forca: 0.3 }, semente: 6151 + i * 4 }))
  cena.partes.push(P(anel(bx, by, rb + 0.15, rb + 0.15, rb * 0.9, rb * 0.9), c.m.aros, { bisel: 0.6, contorno: 0.28, metal: 0.35, semente: 6152 + i * 4 }))
  const a = hash(i, 4, 6065) * 2 * Math.PI
  cena.partes.push(P(elipse(bx + Math.cos(a) * rb * 0.42, by + Math.sin(a) * rb * 0.42, rb * 0.12, rb * 0.12), BATOQUE, { bisel: 0.4, contorno: 0.2, semente: 6153 + i * 4 }))
}

function barrisDeCima(c: ContextoDoMovel, cena: Cena): void {
  const { x0, meia } = caixaDeCima(c)
  const dentro = { x0: x0 + 2.6, x1: c.hw - 2.6, meia: meia - 2.6 }
  const rb = Math.min(dentro.meia / 2, (dentro.x1 - dentro.x0) / 6.6) - 0.3
  const passo = (dentro.x1 - dentro.x0 - 2 * rb) / 2.4
  let i = 0
  for (const fy of [-1, 1]) {
    for (let k = 0; k < 3; k += 1) {
      const bx = dentro.x0 + rb + 0.6 + k * passo + (hash(k, fy, 6066) - 0.5) * 1.6
      const by = fy * (dentro.meia - rb) + (hash(k, fy + 3, 6066) - 0.5) * 1.2
      barrilDeCima(c, cena, bx, by, rb, i)
      i += 1
    }
  }
}

function barrisDeLado(c: ContextoDoMovel, cena: Cena, base: Base): void {
  const { hh, hw, peca: P } = c
  const { x0, y0, y1 } = caixaDeLado(c)
  const carvalho = materialDaPeca('carvalho')
  const largura = 0.2 * (hw - x0)
  const pecas: Peca[] = []
  for (let k = 0; k < 3; k += 1) {
    const cx = x0 + (hw - x0) * (0.2 + 0.3 * k)
    const topo = -hh + 1.5 + hash(k, 5, 6067) * 2.5
    const meia = largura / 2
    // O bojo: mais largo no meio da altura, as aduelas de pé, e dois aros acima da borda da caixa.
    const corpo = poligono([[cx - meia * 0.86, topo], [cx + meia * 0.86, topo], [cx + meia, (topo + y1) / 2], [cx + meia * 0.86, y1], [cx - meia * 0.86, y1], [cx - meia, (topo + y1) / 2]])
    // O bojo em pé arredonda ao longo de x (`curvaX`, a curva da peça girada): `curvaY` arredondaria de través.
    pecas.push({ ...P(corpo, carvalho, { bisel: 1.6, tabua: 2.8, eixo: QUARTO, tom: 0.9 + 0.1 * hash(k, 6, 6067), contorno: 0.3, semente: 6170 + k * 3 }), curvaX: { c: cx, r: meia, forca: 0.35 } })
    for (const [j, y] of [topo + 1.6, topo + 0.25 * (y0 - topo) + 5].entries()) {
      pecas.push(P(caixa(cx - meia * 0.92, y - 0.9, cx + meia * 0.92, y + 0.9, 0.4), c.m.aros, { bisel: 0.5, contorno: 0.25, metal: 0.35, semente: 6171 + k * 3 + j }))
    }
  }
  cena.partes.splice(base.atrasDaCaixa, 0, ...pecas)
}

// ---------- coberta ----------

function cobertaDeCima(c: ContextoDoMovel, cena: Cena): void {
  const { hw, g, peca: P } = c
  const { x0, meia } = caixaDeCima(c)
  const L = cena.partes
  const linho = materialDaPeca('linho')
  const [l0, l1, lm] = [x0 + 0.6, hw - 0.6, meia - 0.6]
  const lona = caixa(l0, -lm, l1, lm, 6)
  sombraDaCarga(c, cena, lona, g * 1.15, 0.3)
  L.push(P(lona, linho, { bisel: 2.2, ruga: 1.4, tom: 0.98, contorno: 0.28, curvaY: { c: 0, r: lm, forca: 0.55 }, semente: 6180 }))
  // Os arcos por baixo da lona: a faixa esticada sobre cada um pega mais luz que o pano frouxo entre eles.
  const arcos = 5
  for (let i = 0; i < arcos; i += 1) {
    const x = l0 + ((i + 0.5) / arcos) * (l1 - l0)
    L.push(P(caixa(x - 1.3, -lm + 0.6, x + 1.3, lm - 0.6, 1), linho, { bisel: 1.1, tom: 1.07, contorno: 0.08, curvaY: { c: 0, r: lm, forca: 0.55 }, semente: 6181 + i }))
  }
  // As bocas franzidas: a da frente (para os varais) e a de trás, o escuro de dentro e o pano em volta.
  for (const [xb, rx, ry] of [[l0 + 2.6, 2.4, 0.42 * meia], [l1 - 2, 1.8, 0.32 * meia]] as const) {
    L.push(P(elipse(xb, 0, rx + 1.6, ry + 1.8), linho, { bisel: 1.4, ruga: 1.6, tom: 0.9, contorno: 0.22, semente: 6190 }))
    L.push(P(elipse(xb, 0, rx, ry), BURACO_DA_LONA, { bisel: 0.8, contorno: 0.25, recesso: { k: 1, forca: 0.3 }, semente: 6191 }))
  }
}

function cobertaDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hh, hw, h, peca: P } = c
  const { x0, y0 } = caixaDeLado(c)
  const L = cena.partes
  const linho = materialDaPeca('linho')
  const [l0, l1] = [x0 - 2, hw + 0.5]
  const [topo, pe] = [-hh + 0.8, y0 + 0.05 * h]
  // O toldo em arco baixo: o alto reto e as pontas arredondadas, descendo por cima da borda da caixa.
  const r = (pe - topo) * 0.9
  const toldo = uniao(caixa(l0 + r * 0.6, topo, l1 - r * 0.6, pe, 0), uniao(elipse(l0 + r * 0.6 + 0.01, pe, r * 0.6, pe - topo), elipse(l1 - r * 0.6 - 0.01, pe, r * 0.6, pe - topo)))
  const recortado: Forma = { b: [l0, topo, l1, pe], d: (x, y) => Math.max(toldo.d(x, y), y - pe) }
  L.push(P(recortado, linho, { bisel: 2.4, ruga: 1.3, tom: 1.0, contorno: 0.3, curvaY: { c: pe, r: pe - topo, forca: 0.45 }, semente: 6200 }))
  // As costuras dos arcos, de pé.
  for (let i = 1; i < 5; i += 1) {
    const x = l0 + (i / 5) * (l1 - l0)
    L.push(P(caixa(x - 0.7, topo + 0.8, x + 0.7, pe - 0.6, 0.4), linho, { bisel: 0.5, tom: 0.88, contorno: 0.1, semente: 6201 + i }))
  }
  // As cordas que amarram a lona na caixa.
  const corda = materialDaPeca('corda')
  for (let i = 0; i < 4; i += 1) {
    const x = l0 + ((i + 0.6) / 4.2) * (l1 - l0)
    L.push(P(capsula(x, pe - 1, x + 1.6, y0 + 0.11 * h, 0.5), corda, { bisel: 0.4, contorno: 0.25, semente: 6210 + i }))
  }
}

const comFeno: MontarMovel = (c, cena) => {
  const base = carrocaVazia(c, cena)
  if (c.lado === 'lado') fenoDeLado(c, cena, base)
  else fenoDeCima(c, cena)
}

const comBarris: MontarMovel = (c, cena) => {
  const base = carrocaVazia(c, cena)
  if (c.lado === 'lado') barrisDeLado(c, cena, base)
  else barrisDeCima(c, cena)
}

const coberta: MontarMovel = (c, cena) => {
  carrocaVazia(c, cena)
  if (c.lado === 'lado') cobertaDeLado(c, cena)
  else cobertaDeCima(c, cena)
}

/** Ids na ordem do painel, depois da 1ª (a de hoje, "Vazia" no plano: os sacos e o barrilzinho): comFeno, comBarris, coberta. */
export const versoesDoCarroca: VersoesDesenhadas = { comFeno, comBarris, coberta }
