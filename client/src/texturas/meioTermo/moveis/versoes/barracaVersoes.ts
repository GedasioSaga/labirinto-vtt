/**
 * As VERSÕES da barraca de feira (lote L06 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`):
 * a 1ª, a de hoje (as frutas), é o desenho de `MONTADORES` (`../barraca.ts`). As outras são a MESMA barraca (o toldo
 * listrado, a sanefa em gomos, os esteios e o balcão de tábuas) com outra MERCADORIA, de cima e de lado:
 *
 * - TECIDOS: de cima, as pilhas de pano dobrado (as dobras marcam as camadas) e duas peças enroladas na frente, com a
 *   vara de medir; de lado, as pilhas no balcão e três panos pendurados na beira do toldo.
 * - CERÂMICA: de cima, os potes de boca escura (barro, vidrado azul, creme e mel) e, na frente, as pilhas de pratos,
 *   as tigelas e a moringa de asa; de lado, a ânfora, o pote, a moringa e a pilha de tigelas em pé.
 * - PEIXE: de cima, os peixes deitados em duas fileiras, cabeça para um lado e para o outro, e o cesto de sardinhas;
 *   de lado, os peixes pendurados pelo rabo na beira do toldo e o cesto no balcão.
 *
 * Como a troca acontece: o desenho de hoje é chamado com uma fábrica de peças que marca as frutas (pela semente) e
 * elas saem da cena; a mercadoria nova entra no lugar delas na ordem de pintura. O resto sai byte a byte igual.
 * Lugares de material: os da barraca (`toldo` e `madeira`); a mercadoria tem cores fixas e contidas, como as frutas.
 */
import { anel, caixa, capsula, elipse, poligono, type Forma, type Ponto } from '../formas'
import { hash } from '../../../ruido'
import type { Cena, CriarPeca, MaterialDaPeca, Peca } from '../motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from '../contexto'
import { montarBarraca } from '../barraca'
import type { VersoesDesenhadas } from '.'

/** As frutas do desenho de hoje (`../barraca.ts`), pela semente: de cima 402 a 408, de lado 403 a 409. */
const FRUTAS_DE_CIMA: ReadonlySet<number> = new Set([402, 403, 404, 405, 406, 407, 408])
const FRUTAS_DE_LADO: ReadonlySet<number> = new Set([403, 404, 405, 406, 407, 408, 409])
/** As medidas de `../barraca.ts` (o desenho da vila): o toldo de meia largura 30, de -23 a 31,5. */
const MEIA_LARGURA_DA_VILA = 30
const ALTURA_DA_VILA = 54.5

const BOCA: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2e, 0x28] }
const BARRO = materialDaPeca('barro')
const VIDRADO_AZUL: MaterialDaPeca = { classe: 'liso', rgb: [0x66, 0x7c, 0x84] }
const CREME: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xb9, 0x9a] }
const VIDRADO_MEL: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x6c, 0x42] }
const ESCAMA: MaterialDaPeca = { classe: 'metal', rgb: [0x92, 0x9c, 0x9c] }
const DORSO: MaterialDaPeca = { classe: 'liso', rgb: [0x58, 0x66, 0x6c] }
const SALMAO: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x8e, 0x84] }
const OLHO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2a, 0x28] }

/** A barraca de hoje sem as frutas: devolve o lugar delas na ordem de pintura, onde a mercadoria entra. */
function barracaSemFrutas(c: ContextoDoMovel, cena: Cena): number {
  const frutas = c.lado === 'lado' ? FRUTAS_DE_LADO : FRUTAS_DE_CIMA
  const tirar = new Set<Peca>()
  const peca: CriarPeca = (forma, mat, o) => {
    const p = c.peca(forma, mat, o)
    if (o?.semente !== undefined && frutas.has(o.semente)) tirar.add(p)
    return p
  }
  montarBarraca({ ...c, peca }, cena)
  let lugar = cena.partes.length
  for (let i = cena.partes.length - 1; i >= 0; i -= 1) {
    if (!tirar.has(cena.partes[i])) continue
    cena.partes.splice(i, 1)
    lugar = i
  }
  return lugar
}

/** As medidas de cima da barraca: x na escala da vila, a altura em fração da pegada, e as escalas. */
function deCima(c: ContextoDoMovel): { X: (x: number) => number; F: (f: number) => number; sx: number; sy: number } {
  const sx = (c.hw * 0.98) / MEIA_LARGURA_DA_VILA
  const sy = c.h / ALTURA_DA_VILA
  return { X: (x) => x * sx, F: (f) => -c.hh + f * c.h, sx, sy }
}

/** De lado: a beira do toldo e o tampo do balcão (as alturas de `../barraca.ts`). */
function deLado(c: ContextoDoMovel): { beira: number; tampo: number } {
  return { beira: -c.hh + 0.3 * c.h, tampo: -c.hh + 0.66 * c.h - 0.035 * c.h }
}

/**
 * O peixe deitado: o corpo fusiforme em volta de (x, y), `comprido` px, a cabeça para `lado` (1 = à direita), o rabo,
 * o dorso escuro e o olho. `em` leva cada forma para o lugar final (o peixe pendurado gira um quarto de volta); sem
 * ela, o corpo ganha a curva da barriga (`curvaY`), que só vale deitado.
 */
function peixe(P: CriarPeca, x: number, y: number, comprido: number, largo: number, lado: number, escama: MaterialDaPeca, semente: number, em?: (f: Forma) => Forma): Peca[] {
  const lugar = em ?? ((f: Forma): Forma => f)
  const pontos: Ponto[] = []
  const lados = 16
  for (let i = 0; i <= lados; i += 1) {
    const t = i / lados
    // O corpo: mais largo a um terço da cabeça, afinando até o rabo.
    const meia = largo * Math.sin(Math.PI * t ** 0.8) * 0.5
    pontos.push([x + lado * (t - 0.5) * comprido, y - meia])
  }
  for (let i = lados; i >= 0; i -= 1) {
    const t = i / lados
    const meia = largo * Math.sin(Math.PI * t ** 0.8) * 0.5
    pontos.push([x + lado * (t - 0.5) * comprido, y + meia])
  }
  const xr = x - lado * comprido * 0.5
  const rabo = poligono([[xr + lado * 1.2, y], [xr - lado * comprido * 0.2, y - largo * 0.55], [xr - lado * comprido * 0.14, y], [xr - lado * comprido * 0.2, y + largo * 0.55]])
  return [
    P(lugar(rabo), escama, { bisel: 0.5, tom: 0.85, contorno: 0.3, metal: 0.3, semente }),
    P(lugar(poligono(pontos)), escama, { bisel: largo * 0.35, contorno: 0.32, metal: 0.35, curvaY: em === undefined ? { c: y, r: largo * 0.5, forca: 0.5 } : undefined, semente: semente + 1, projeta: { dist: 1.2, forca: 0.3 } }),
    P(lugar(caixa(x - comprido * 0.3, y - largo * 0.42, x + comprido * 0.3, y - largo * 0.18, largo * 0.12)), DORSO, { bisel: 0.4, alfa: 0.55, contorno: 0, suave: 0.6, semente: semente + 2 }),
    P(lugar(elipse(x + lado * comprido * 0.36, y - largo * 0.08, largo * 0.11, largo * 0.11)), OLHO, { bisel: 0.2, contorno: 0, semente: semente + 3 }),
  ]
}

// ---------- tecidos ----------

const PANOS: readonly MaterialDaPeca[] = [materialDaPeca('linho'), materialDaPeca('azul'), materialDaPeca('musgo'), materialDaPeca('ocre'), materialDaPeca('vinho')]

function tecidosDeCima(c: ContextoDoMovel): Peca[] {
  const P = c.peca
  const { X, F, sx, sy } = deCima(c)
  const pecas: Peca[] = []
  // As pilhas de pano dobrado, cada uma um nada torta, com as dobras das camadas.
  for (let i = 0; i < 5; i += 1) {
    const [cx, cy] = [X(-20 + i * 10), F(0.78)]
    const [mx, my] = [3.9 * sx, 3.3 * sy]
    const pano = PANOS[i]
    pecas.push(P(caixa(cx - mx, cy - my, cx + mx, cy + my, 1), pano, { bisel: 1.4, ruga: 0.8, tom: 1.02, contorno: 0.3, semente: 6300 + i * 3, projeta: { dist: 1.6, forca: 0.32 } }))
    for (const [j, f] of [0.3, 0.65].entries()) {
      pecas.push(P(caixa(cx - mx + 0.6, cy - my + f * 2 * my - 0.35, cx + mx - 0.6, cy - my + f * 2 * my + 0.35, 0.3), pano, { bisel: 0.3, tom: 0.78, contorno: 0, semente: 6301 + i * 3 + j }))
    }
  }
  // As duas peças enroladas na frente (o rolo deitado ao comprido) e a vara de medir.
  for (const [i, [x0, x1, pano]] of ([[-23, -4, PANOS[1]], [4, 23, PANOS[3]]] as const).entries()) {
    const y = F(0.9)
    const r = 2.5 * sy
    pecas.push(P(capsula(X(x0), y, X(x1), y, r), pano, { bisel: r * 0.6, ruga: 0.6, contorno: 0.3, curvaY: { c: y, r, forca: 0.5 }, semente: 6320 + i, projeta: { dist: 1.6, forca: 0.32 } }))
    pecas.push(P(elipse(X(i === 0 ? x0 : x1), y, 1.2 * sx, r * 0.9), pano, { bisel: 0.6, tom: 0.82, contorno: 0.25, semente: 6322 + i }))
  }
  pecas.push(P(capsula(X(-24), F(0.965), X(18), F(0.955), 0.75), c.m.madeira, { bisel: 0.5, tabua: 0, tom: 1.15, contorno: 0.3, semente: 6324, projeta: { dist: 1, forca: 0.3 } }))
  return pecas
}

function tecidosDeLado(c: ContextoDoMovel): Peca[] {
  const { hw, w, h, peca: P } = c
  const { beira, tampo } = deLado(c)
  const pecas: Peca[] = []
  // Os panos pendurados na beira do toldo, entre os esteios: a barra de baixo ondulada.
  for (let i = 0; i < 3; i += 1) {
    const cx = -0.24 * w + i * 0.24 * w
    const meia = 0.09 * w
    const fundo = beira + 0.17 * h + hash(i, 1, 6330) * 0.05 * h
    const pontos: Ponto[] = [[cx - meia, beira + 1]]
    for (let k = 0; k <= 6; k += 1) pontos.push([cx - meia + (k / 6) * 2 * meia, fundo + Math.sin(k * 1.7 + i) * 1.2])
    pontos.push([cx + meia, beira + 1])
    pecas.push(P(poligono(pontos), PANOS[(i + 1) % PANOS.length], { bisel: 1.2, ruga: 1.4, eixo: QUARTO, contorno: 0.28, semente: 6331 + i }))
  }
  // As pilhas no balcão: panos dobrados de cores alternadas, um por cima do outro.
  for (let p = 0; p < 4; p += 1) {
    const cx = -0.62 * hw + p * 0.41 * hw
    const meia = 0.075 * w
    let y = tampo
    for (let k = 0; k < 3 + (p % 2); k += 1) {
      const alto = 0.028 * h
      pecas.push(P(caixa(cx - meia + (k % 2) * 0.8, y - alto, cx + meia - ((k + 1) % 2) * 0.8, y + 0.3, 0.8), PANOS[(p + k) % PANOS.length], { bisel: 0.8, ruga: 0.6, contorno: 0.3, semente: 6340 + p * 4 + k }))
      y -= alto
    }
  }
  return pecas
}

// ---------- cerâmica ----------

/** Um pote de boca escura visto de cima: o bojo, a boca com o lábio claro e o escuro de dentro. */
function poteDeCima(P: CriarPeca, x: number, y: number, r: number, mat: MaterialDaPeca, semente: number): Peca[] {
  return [
    P(elipse(x, y, r, r), mat, { bisel: r * 0.55, contorno: 0.3, semente, projeta: { dist: 1.8, forca: 0.32 } }),
    P(anel(x, y, r * 0.58, r * 0.58, r * 0.4, r * 0.4), mat, { bisel: 0.4, tom: 1.16, contorno: 0.18, semente: semente + 1 }),
    P(elipse(x, y, r * 0.42, r * 0.42), BOCA, { bisel: 0.4, contorno: 0.1, recesso: { k: 0.8, forca: 0.35 }, semente: semente + 2 }),
  ]
}

function ceramicaDeCima(c: ContextoDoMovel): Peca[] {
  const P = c.peca
  const { X, F, sx } = deCima(c)
  const pecas: Peca[] = []
  const potes: readonly MaterialDaPeca[] = [BARRO, VIDRADO_AZUL, CREME, VIDRADO_MEL, BARRO]
  for (let i = 0; i < 5; i += 1) pecas.push(...poteDeCima(P, X(-21 + i * 10.5), F(0.775), (3.3 + 0.5 * hash(i, 1, 6350)) * sx, potes[i], 6350 + i * 3))
  // Na frente: duas pilhas de pratos, as tigelas e a moringa com a asa.
  for (const [i, x] of [-21, 9].entries()) {
    const [cx, cy, r] = [X(x), F(0.905), 2.9 * sx]
    pecas.push(P(elipse(cx, cy, r, r), CREME, { bisel: 0.5, contorno: 0.3, semente: 6370 + i * 3, projeta: { dist: 1.4, forca: 0.3 } }))
    pecas.push(P(anel(cx, cy, r * 0.7, r * 0.7, r * 0.62, r * 0.62), CREME, { bisel: 0.2, tom: 0.84, contorno: 0, semente: 6371 + i * 3 }))
    pecas.push(P(elipse(cx, cy, r * 0.4, r * 0.4), CREME, { bisel: 0.4, tom: 0.92, contorno: 0.1, recesso: { k: 0.6, forca: 0.2 }, semente: 6372 + i * 3 }))
  }
  for (const [i, x] of [-12, -6].entries()) {
    const [cx, cy, r] = [X(x), F(0.91), 2 * sx]
    pecas.push(P(elipse(cx, cy, r, r), i === 0 ? VIDRADO_AZUL : BARRO, { bisel: 0.6, contorno: 0.3, semente: 6380 + i * 2, projeta: { dist: 1.2, forca: 0.3 } }))
    pecas.push(P(elipse(cx, cy, r * 0.7, r * 0.7), BOCA, { bisel: 0.3, contorno: 0, recesso: { k: 0.6, forca: 0.3 }, semente: 6381 + i * 2 }))
  }
  const [mx, my, mr] = [X(19.5), F(0.9), 3.1 * sx]
  pecas.push(P(anel(mx + mr * 1.05, my, mr * 0.5, mr * 0.42, mr * 0.28, mr * 0.2), BARRO, { bisel: 0.4, contorno: 0.28, semente: 6390 }))
  pecas.push(...poteDeCima(P, mx, my, mr, BARRO, 6391))
  pecas.push(P(capsula(mx - mr * 0.9, my - mr * 0.2, mx - mr * 1.45, my - mr * 0.5, mr * 0.16), BARRO, { bisel: 0.3, contorno: 0.25, semente: 6394 }))
  return pecas
}

function ceramicaDeLado(c: ContextoDoMovel): Peca[] {
  const { w, h, peca: P } = c
  const { tampo } = deLado(c)
  const pecas: Peca[] = []
  /** Um vaso de perfil: a lista de (meia largura, altura) de baixo para cima, espelhada em volta de `cx`. */
  const vaso = (cx: number, perfil: readonly Ponto[], mat: MaterialDaPeca, semente: number): void => {
    const ida = perfil.map(([m, a]): Ponto => [cx + m, tampo - a])
    const volta = [...perfil].reverse().map(([m, a]): Ponto => [cx - m, tampo - a])
    const meia = Math.max(...perfil.map(([m]) => m))
    // O vaso em pé arredonda ao longo de x (`curvaX`, a curva da peça girada): `curvaY` o escurecia de través.
    pecas.push({ ...P(poligono([...ida, ...volta]), mat, { bisel: 1.4, contorno: 0.3, semente }), curvaX: { c: cx, r: meia, forca: 0.45 } })
  }
  const u = 0.01 * h
  vaso(-0.32 * w, [[2.6 * u, 0], [5.5 * u, 4 * u], [6.4 * u, 9 * u], [5 * u, 14 * u], [2.2 * u, 17 * u], [2.2 * u, 20 * u], [3.2 * u, 21 * u]], BARRO, 6400)
  vaso(-0.12 * w, [[4.5 * u, 0], [7 * u, 4 * u], [7.4 * u, 7 * u], [5.8 * u, 10.5 * u], [6.2 * u, 11.5 * u]], VIDRADO_AZUL, 6401)
  vaso(0.1 * w, [[3 * u, 0], [5.4 * u, 3.5 * u], [5.6 * u, 7.5 * u], [3.6 * u, 11 * u], [2.6 * u, 14 * u], [3.4 * u, 15 * u]], CREME, 6402)
  pecas.push(P(anel(0.1 * w + 6.4 * u, tampo - 9.5 * u, 2.6 * u, 3.4 * u, 1.4 * u, 2.2 * u), CREME, { bisel: 0.5, contorno: 0.28, semente: 6403 }))
  for (let k = 0; k < 3; k += 1) vaso(0.3 * w, [[2.8 * u - k * 0.2, k * 2.6 * u], [5.6 * u - k * 0.3, k * 2.6 * u + 2.4 * u]], k % 2 === 0 ? VIDRADO_MEL : BARRO, 6404 + k)
  return pecas
}

// ---------- peixe ----------

function peixeDeCima(c: ContextoDoMovel): Peca[] {
  const P = c.peca
  const { X, F, sx, sy } = deCima(c)
  const pecas: Peca[] = []
  // Os peixes de cabeça para o mesmo lado, com um vão entre o focinho de um e o rabo do outro (de cabeça trocada,
  // os rabos se encontravam e liam como uma estrela).
  for (let i = 0; i < 4; i += 1) {
    pecas.push(...peixe(P, X(-19.1 + i * 12.8), F(0.775) + (hash(i, 1, 6420) - 0.5) * 1.5, 9.4 * sx, 3.4 * sy, 1, ESCAMA, 6420 + i * 4))
  }
  for (let i = 0; i < 2; i += 1) pecas.push(...peixe(P, X(-18 + i * 17), F(0.905), 13 * sx, 4 * sy, 1, SALMAO, 6440 + i * 4))
  // O cesto de vime com três sardinhas deitadas lado a lado, de cabeça trocada, na ponta da frente.
  const [cx, cy, r] = [X(19.5), F(0.9), 4.4 * sx]
  const palha = materialDaPeca('palha')
  pecas.push(P(elipse(cx, cy, r, r), palha, { bisel: 1.4, tabua: 1.2, polar: { cx, cy, r }, tom: 0.86, contorno: 0.3, semente: 6450, projeta: { dist: 1.6, forca: 0.32 } }))
  pecas.push(P(elipse(cx, cy, r * 0.78, r * 0.78), BOCA, { bisel: 0.4, contorno: 0, recesso: { k: 1, forca: 0.3 }, semente: 6451 }))
  for (let k = 0; k < 3; k += 1) pecas.push(...peixe(P, cx + (k - 1) * r * 0.06, cy + (k - 1) * r * 0.42, r * (k === 1 ? 1.25 : 1.05), r * 0.32, k % 2 === 0 ? 1 : -1, ESCAMA, 6452 + k * 4))
  return pecas
}

function peixeDeLado(c: ContextoDoMovel): Peca[] {
  const { w, h, peca: P } = c
  const { beira, tampo } = deLado(c)
  const pecas: Peca[] = []
  const corda = materialDaPeca('corda')
  // Os peixes pendurados pelo rabo na beira do toldo, de cabeça para baixo, cada um num gancho de corda.
  for (let i = 0; i < 5; i += 1) {
    const x = -0.3 * w + i * 0.15 * w
    const comprido = 0.15 * h + hash(i, 1, 6460) * 0.04 * h
    const topo = beira + 0.03 * h
    pecas.push(P(capsula(x, beira - 0.5, x, topo + 0.5, 0.4), corda, { bisel: 0.3, contorno: 0.2, semente: 6460 + i * 5 }))
    // O peixe é desenhado deitado em volta de (0, 0), a cabeça à direita, e posto de pé: um quarto de volta, a cabeça para baixo.
    const meio = topo + comprido * 0.5
    const dePe = (f: Forma): Forma => ({ b: [x - f.b[3], meio + f.b[0], x - f.b[1], meio + f.b[2]], d: (px, py) => f.d(py - meio, x - px) })
    pecas.push(...peixe(P, 0, 0, comprido, 0.045 * w, 1, i % 2 === 0 ? ESCAMA : SALMAO, 6461 + i * 5, dePe))
  }
  // O cesto de vime no balcão, com as sardinhas aparecendo na boca.
  const [cx, meia, alto] = [0.3 * w, 0.085 * w, 0.07 * h]
  const palha = materialDaPeca('palha')
  for (let k = 0; k < 5; k += 1) pecas.push(P(capsula(cx - meia * 0.7 + k * meia * 0.35, tampo - alto - 0.02 * h, cx - meia * 0.8 + k * meia * 0.35, tampo - alto + 0.01 * h, 0.012 * h), ESCAMA, { bisel: 0.4, contorno: 0.25, metal: 0.4, semente: 6490 + k }))
  pecas.push(P(poligono([[cx - meia, tampo - alto], [cx + meia, tampo - alto], [cx + meia * 0.8, tampo], [cx - meia * 0.8, tampo]]), palha, { bisel: 1.2, tabua: 1.4, eixo: QUARTO, tom: 0.9, contorno: 0.3, semente: 6495 }))
  return pecas
}

/** A versão: a barraca de hoje sem as frutas e a mercadoria nova no lugar delas. */
function barracaCom(deCimaFn: (c: ContextoDoMovel) => Peca[], deLadoFn: (c: ContextoDoMovel) => Peca[]): MontarMovel {
  return (c, cena) => {
    const lugar = barracaSemFrutas(c, cena)
    cena.partes.splice(lugar, 0, ...(c.lado === 'lado' ? deLadoFn(c) : deCimaFn(c)))
  }
}

/** Ids na ordem do painel, depois da 1ª (as frutas, a de hoje): tecidos, ceramica, peixe. */
export const versoesDoBarraca: VersoesDesenhadas = {
  tecidos: barracaCom(tecidosDeCima, tecidosDeLado),
  ceramica: barracaCom(ceramicaDeCima, ceramicaDeLado),
  peixe: barracaCom(peixeDeCima, peixeDeLado),
}
