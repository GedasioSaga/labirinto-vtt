/**
 * MESA DE BANQUETE POSTA de cima com volume (lote L02 de 14/11/2026, o
 * castelo): a mesa comprida do salão no meio da festa. A mesa é a da
 * `mesaComPernas` (o tampo de tábuas com a borda clara, a espessura embaixo,
 * as pernas nas quinas e a sombra de baixo), copiada aqui para o desenho só
 * depender do motor. Em cima, o CAMINHO DE MESA ao comprido (o pano do lugar
 * `toalha`, com a barra bordada dos dois lados) e, nele, do meio para as
 * pontas: a TRAVESSA de estanho com o LEITÃO ASSADO (a maçã na boca, as
 * orelhas, as patas dobradas e as ervas em volta), as duas FRUTEIRAS (maçãs,
 * peras e um cacho de uva) e os PÃES nas pontas. Dos dois lados, os LUGARES
 * postos: o prato de estanho (uns com a coxa ou a fatia de pão, outros
 * vazios), a faca e a TAÇA de latão com o vinho.
 *
 * O que lê a 25% de zoom é a fila de pratos claros dos dois lados e a mancha
 * escura do leitão na travessa no meio. A mesa corre ao longo do lado maior
 * (a de partida, 3 x 1, deitada); esticada, ganha mais lugares, e o meio
 * (travessa, fruteiras e pães) fica onde está. Na 3/4 tudo o que está em cima
 * sobe com o tampo (o perfil derivado da mesa): as coisas de cima fazem sombra
 * só no pano e no tampo (`projeta`), nunca no chão. Materiais: `madeira` (a
 * mesa) e `toalha` (o caminho de mesa); o resto é fixo.
 */
import { anel, caixa, capsula, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Sombra, type Textura } from './motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

// ---------- a mesa (as medidas da `mesaComPernas`, em casas) ----------

const ALTURA_DA_MESA = 0.5
const RECUO_DO_TAMPO = 0.075
const LADO_DA_PERNA = 0.12
const LARGURA_DA_TABUA = 0.2
const RAIO_DA_QUINA = 0.04
const ESPESSURA_EMBAIXO = 0.032
const ESPESSURA_A_DIREITA = 0.008
const LARGURA_DA_BORDA_CLARA = 0.055
const LUZ_DA_BORDA_CLARA = 0.2
const SOMBRA_DE_BAIXO_ALEM = 0.025
const FORCA_DA_SOMBRA_DE_BAIXO = 0.4
const FORCA_DA_SOMBRA_DO_TAMPO = 0.22
const FORCA_DO_CONTATO_DA_PERNA = 0.34
const FORCA_DA_SOMBRA_DA_PERNA = 0.3
const TOM_DO_TAMPO = 0.97
const TOM_DA_ESPESSURA = 0.66
const TOM_DA_PERNA = 0.64

// ---------- o que vai em cima (em casas) ----------

/** Meia largura do caminho de mesa e a da barra bordada dele. */
const MEIO_CAMINHO = 0.17
const BARRA_DO_CAMINHO = 0.022
/** O caminho termina este tanto antes da ponta do tampo. */
const FOLGA_DO_CAMINHO = 0.1
/** Um lugar posto a cada tanto de comprimento (a de 3 casas tem 4 de cada lado). */
const PASSO_DO_LUGAR = 0.72
/** O prato: o raio e a distância do meio dele à beira do tampo. */
const RAIO_DO_PRATO = 0.11
const PRATO_DA_BEIRA = 0.15
/** A taça: o raio, e quanto ela fica ao lado do prato e para dentro dele. */
const RAIO_DA_TACA = 0.048
const TACA_AO_LADO = 0.16
const TACA_PARA_DENTRO = 0.11
/** A travessa do leitão (meio comprimento e meia largura) e a fruteira (raio). */
const TRAVESSA = { u: 0.34, v: 0.15 } as const
const RAIO_DA_FRUTEIRA = 0.15
/** O pão fica este tanto antes da ponta do tampo. */
const PAO_DA_PONTA = 0.3

// ---------- os materiais fixos ----------

/** O estanho dos pratos e da travessa: o cinza claro da pedra, que lê como ponto claro no tampo. */
const ESTANHO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('pedra', 0.9)) }
const LATAO: MaterialDaPeca = materialDaPeca('latao')
const FERRO: MaterialDaPeca = materialDaPeca('ferro')
/** A barra bordada do caminho: o ocre, que fica bem tanto no vinho quanto no linho. */
const BORDADO: MaterialDaPeca = materialDaPeca('ocre')
/** O vinho nas taças: a lã vinho escura (com 0,55 a mesa esticada caía abaixo do piso de luz). */
const VINHO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('vinho', 0.72)) }
/** O leitão: o marrom quente do assado e a pele tostada do lombo, mais clara. */
const ASSADO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('madeiraEscura', 1.0)) }
const TOSTADO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('madeira', 0.95)) }
const MACA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('vinho', 1.18)) }
const PERA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 1.38)) }
/** A uva: o violeta baixo, mas não tanto (com 0,6 a beira de cada bago, na sombra do vizinho, caía no piso de luz). */
const UVA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('violeta', 0.7)) }
/** O cabo da faca: o carvalho, e não a nogueira, que na sombra do prato passava do piso de luz. */
const CABO: MaterialDaPeca = materialDaPeca('carvalho')
/**
 * As ervas: com o verde em 0,72, o contorno de 0,24 e o bisel cheio, a beira delas, na sombra
 * do leitão, era o pixel mais escuro da mesa e passava do piso de luz.
 */
const ERVA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('folha', 1.02)) }
const PAO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('palha', 0.9)) }
const MIOLO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('reboco', 0.92)) }
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('branco', 0.9)) }

/**
 * A régua da mesa: `u` ao longo (do lado maior), `v` de través, centro na
 * origem. Deitada, u é x; em pé, u é y (como a ponte).
 */
interface Regua {
  readonly C: number
  readonly A: number
  readonly casa: number
  readonly eixo: number
  readonly pt: (u: number, v: number) => Ponto
  readonly ret: (u0: number, v0: number, u1: number, v1: number, raio: number) => Forma
  readonly oval: (u: number, v: number, ru: number, rv: number, giro?: number) => Forma
  readonly cap: (u0: number, v0: number, u1: number, v1: number, r: number) => Forma
  readonly poli: (pontos: readonly Ponto[]) => Forma
}

function reguaDa(c: ContextoDoMovel): Regua {
  const deitada = c.w >= c.h
  const pt = (u: number, v: number): Ponto => (deitada ? [u, v] : [-v, u])
  return {
    C: deitada ? c.hw : c.hh,
    A: deitada ? c.hh : c.hw,
    // Pegada mais estreita que uma casa encolhe tudo junto.
    casa: Math.min(c.g, c.w, c.h),
    eixo: deitada ? 0 : QUARTO,
    pt,
    ret: (u0, v0, u1, v1, raio) => (deitada ? caixa(u0, v0, u1, v1, raio) : caixa(-v1, u0, -v0, u1, raio)),
    oval: (u, v, ru, rv, giro = 0) => {
      const [x, y] = pt(u, v)
      return elipseGirada(x, y, ru, rv, deitada ? giro : giro + QUARTO)
    },
    cap: (u0, v0, u1, v1, r) => {
      const [ax, ay] = pt(u0, v0)
      const [bx, by] = pt(u1, v1)
      return capsula(ax, ay, bx, by, r)
    },
    poli: (pontos) => poligono(pontos.map(([u, v]) => pt(u, v))),
  }
}

/** O veio de madeira com a borda clara: a luz cresce do fim da faixa até a quina do tampo. */
function madeiraComBordaClara(forma: Forma, largura: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const t = -forma.d(x, y)
    if (t < largura) s[3] += LUZ_DA_BORDA_CLARA * (1 - (t > 0 ? t : 0) / largura)
  }
}

/** A mesa: as sombras, as pernas, a espessura e o tampo. Devolve o tampo (u0, v0, u1, v1). */
function montarAMesa(c: ContextoDoMovel, cena: Cena, r: Regua): readonly [number, number, number, number] {
  const P = c.peca
  const mad = c.m.madeira
  const { C, A, casa } = r
  const recuo = RECUO_DO_TAMPO * casa
  const tampo = r.ret(-C + recuo, -A + recuo, C - recuo, A - recuo, RAIO_DA_QUINA * casa)
  const alem = SOMBRA_DE_BAIXO_ALEM * casa
  const altura = c.g * ALTURA_DA_MESA
  const lado = LADO_DA_PERNA * casa
  const pernas: Forma[] = []
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      const u0 = su < 0 ? -C : C - lado
      const v0 = sv < 0 ? -A : A - lado
      pernas.push(r.ret(u0, v0, u0 + lado, v0 + lado, 0.12 * lado))
    }
  }
  const sombras: Sombra[] = [
    { forma: r.ret(-C + recuo - alem, -A + recuo - alem, C - recuo + alem, A - recuo + alem, RAIO_DA_QUINA * casa + alem), z: 0, suave: alem, forca: FORCA_DA_SOMBRA_DE_BAIXO },
    { forma: tampo, z: altura, solta: true, suave: 1.8, forca: FORCA_DA_SOMBRA_DO_TAMPO },
  ]
  for (const perna of pernas) {
    const b = perna.b
    const folga = 0.08 * (b[2] - b[0])
    sombras.push(contato(caixa(b[0] - folga, b[1] - folga, b[2] + folga, b[3] + folga, 0.3 * (b[2] - b[0])), FORCA_DO_CONTATO_DA_PERNA), { forma: perna, z: altura, suave: 0.9, forca: FORCA_DA_SOMBRA_DA_PERNA })
  }
  cena.sombras.push(...sombras)
  pernas.forEach((perna, i) => cena.partes.push(P(perna, mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, contorno: 0.16, tom: TOM_DA_PERNA, semente: 4204 + i })))
  // A espessura fica embaixo e à direita NA TELA, qualquer que seja a régua.
  cena.partes.push(P(tampo, mad, { eixo: r.eixo, dx: ESPESSURA_A_DIREITA * casa, dy: ESPESSURA_EMBAIXO * casa, tabua: 0, bisel: 0.7, contorno: 0.2, tom: TOM_DA_ESPESSURA, semente: 4203 }))
  cena.partes.push(P(tampo, mad, { eixo: r.eixo, tabua: LARGURA_DA_TABUA * casa, bisel: 1.6, contorno: 0.06, tom: TOM_DO_TAMPO, semente: 4200, textura: madeiraComBordaClara(tampo, LARGURA_DA_BORDA_CLARA * casa) }))
  return [-C + recuo, -A + recuo, C - recuo, A - recuo]
}

/** A sombra curta que a coisa de cima faz no pano ou no tampo (`k` = px por casa / 56). */
function sombraEmCima(k: number, dist = 0.9, forca = 0.3): OpcoesDaPeca['projeta'] {
  return { dist: dist * k, forca, suave: 0.7 * k }
}

/** Um lugar posto: o prato, a faca, a taça e o que sobrou no prato. `lado` = -1 em cima, 1 embaixo. */
function lugarPosto(c: ContextoDoMovel, partes: Peca[], r: Regua, u: number, v: number, lado: number, i: number): void {
  const L = c.peca
  const casa = r.casa
  const k = casa / c.g
  const rp = RAIO_DO_PRATO * casa
  // A faca deitada à esquerda do prato, de través.
  const uf = u - rp - 1.6 * k
  partes.push(L(r.cap(uf, v - lado * 4.2 * k, uf, v + lado * 3.4 * k, 0.6 * k), FERRO, { bisel: 0.5 * k, metal: 0.55, contorno: 0.2, semente: 4300 + i, projeta: sombraEmCima(k, 0.6, 0.26) }))
  partes.push(L(r.cap(uf, v + lado * 1.6 * k, uf, v + lado * 4.6 * k, 0.8 * k), CABO, { bisel: 0.6 * k, contorno: 0.2, semente: 4310 + i, projeta: sombraEmCima(k, 0.6, 0.26) }))
  // O prato de estanho: a aba e o fundo, um pouco afundado.
  partes.push(L(r.oval(u, v, rp, rp), ESTANHO, { bisel: rp * 0.2, contorno: 0.2, metal: 0.3, semente: 4320 + i, projeta: sombraEmCima(k, 1, 0.3) }))
  partes.push(L(r.oval(u, v, rp * 0.64, rp * 0.64), ESTANHO, { bisel: rp * 0.1, tom: 0.93, contorno: 0, metal: 0.2, recesso: { k: rp * 0.14, forca: 0.2 }, semente: 4330 + i }))
  // O que sobrou no prato: a coxa, a fatia de pão ou nada (o prato limpo).
  const resto = i % 3
  if (resto === 0) {
    partes.push(L(r.oval(u - 0.6 * k, v + 0.2 * k, 2.6 * k, 1.9 * k, 0.5), ASSADO, { bisel: 1.5 * k, contorno: 0.22, ruga: 0.5, semente: 4340 + i, projeta: sombraEmCima(k, 0.6, 0.26) }))
    partes.push(L(r.cap(u + 1.4 * k, v - 1.2 * k, u + 3.4 * k, v - 2.4 * k, 0.7 * k), OSSO, { bisel: 0.6 * k, contorno: 0.2, semente: 4350 + i }))
  } else if (resto === 1) {
    partes.push(L(r.oval(u + 0.4 * k, v, 3 * k, 2.2 * k, -0.4), PAO, { bisel: 0.6 * k, contorno: 0.22, semente: 4360 + i, projeta: sombraEmCima(k, 0.5, 0.24) }))
    partes.push(L(r.oval(u + 0.4 * k, v, 2.2 * k, 1.5 * k, -0.4), MIOLO, { bisel: 0.4 * k, contorno: 0, semente: 4370 + i }))
  }
  // A taça de latão ao lado, mais para o meio da mesa: o pé largo, o copo e o vinho.
  const rt = RAIO_DA_TACA * casa
  const ut = u + TACA_AO_LADO * casa
  const vt = v - lado * TACA_PARA_DENTRO * casa
  partes.push(L(r.oval(ut, vt, rt * 1.18, rt * 1.18), LATAO, { bisel: rt * 0.3, contorno: 0.24, metal: 0.45, tom: 0.86, semente: 4380 + i, projeta: sombraEmCima(k, 1.6, 0.34) }))
  partes.push(L(r.oval(ut, vt, rt, rt), LATAO, { bisel: rt * 0.35, contorno: 0.2, metal: 0.6, semente: 4390 + i }))
  partes.push(L(r.oval(ut, vt, rt * 0.66, rt * 0.66), VINHO, { bisel: 0, contorno: 0.12, recesso: { k: rt * 0.3, forca: 0.18 }, semente: 4400 + i }))
}

export const montarMesaDeBanquete: MontarMovel = (c, cena) => {
  const r = reguaDa(c)
  if (!(r.C > 0) || !(r.A > 0)) return
  const P = c.peca
  const L = cena.partes
  const { casa } = r
  const k = casa / c.g
  const [u0, v0, u1, v1] = montarAMesa(c, cena, r)

  // O caminho de mesa ao comprido, com a barra bordada dos dois lados.
  const fimDoCaminho = u1 - FOLGA_DO_CAMINHO * casa
  const meio = MEIO_CAMINHO * casa
  const pano = c.m.toalha
  L.push(P(r.ret(-fimDoCaminho, -meio, fimDoCaminho, meio, 0.6 * k), pano, { eixo: r.eixo, bisel: 1.2 * k, contorno: 0.22, semente: 4100, projeta: sombraEmCima(k, 0.7, 0.24) }))
  const barra = BARRA_DO_CAMINHO * casa
  for (const lado of [-1, 1]) {
    const vb = lado * (meio - 2.2 * k)
    L.push(P(r.ret(-fimDoCaminho + 1.4 * k, vb - barra / 2, fimDoCaminho - 1.4 * k, vb + barra / 2, 0.2), BORDADO, { eixo: r.eixo, bisel: 0.3, contorno: 0, tom: 0.92, semente: 4110 + lado }))
  }

  // Os lugares postos dos dois lados: o de cima e o de baixo de cada um, no mesmo comprimento.
  const comprimento = u1 - u0
  const n = Math.max(2, Math.round(comprimento / (PASSO_DO_LUGAR * casa)))
  const passo = comprimento / n
  for (const lado of [-1, 1]) {
    const v = lado < 0 ? v0 + PRATO_DA_BEIRA * casa : v1 - PRATO_DA_BEIRA * casa
    for (let i = 0; i < n; i += 1) lugarPosto(c, L, r, u0 + passo * (i + 0.5), v, lado, i * 2 + (lado + 1) / 2)
  }

  // A travessa de estanho no meio, com o leitão assado.
  const tu = TRAVESSA.u * casa
  const tv = TRAVESSA.v * casa
  L.push(P(r.oval(0, 0, tu, tv), ESTANHO, { bisel: tv * 0.22, contorno: 0.22, metal: 0.32, semente: 4500, projeta: sombraEmCima(k, 1.1, 0.32) }))
  L.push(P(r.oval(0, 0, tu * 0.84, tv * 0.74), ESTANHO, { bisel: tv * 0.1, tom: 0.92, contorno: 0, metal: 0.2, recesso: { k: tv * 0.16, forca: 0.22 }, semente: 4501 }))
  // As ervas em volta do leitão, no fundo da travessa.
  const ervas: readonly (readonly [number, number, number])[] = [[-15.5, -3.2, 0.6], [-14, 3.4, -0.5], [-6, -5.6, 0.2], [-2, 5.8, -0.2], [6.4, -5.4, -0.3], [9.6, 5, 0.4], [15.6, -3.4, -0.8], [15, 3.6, 0.7]]
  ervas.forEach(([u, v, giro], i) => L.push(P(r.oval(u * k, v * k, 2.3 * k, 1.1 * k, giro), ERVA, { bisel: 0.35 * k, contorno: 0.1, tom: 0.98 + (i % 3) * 0.06, semente: 4510 + i })))
  // As patas dobradas, saindo debaixo do corpo.
  for (const [u, v] of [[-9, -6], [-9, 6], [5, -6.2], [5, 6.2]] as const) {
    L.push(P(r.cap(u * k, v * 0.55 * k, (u + 1.6) * k, v * k, 1.3 * k), ASSADO, { bisel: 0.9 * k, contorno: 0.24, tom: 0.96, semente: 4520 + u + v }))
  }
  // O corpo, o lombo tostado por cima e a cabeça com as orelhas e a maçã na boca.
  L.push(P(r.oval(-1.6 * k, 0, 13.6 * k, 5.9 * k), ASSADO, { bisel: 4.2 * k, contorno: 0.26, ruga: 0.35, metal: 0.12, semente: 4530, projeta: sombraEmCima(k, 1.3, 0.26) }))
  L.push(P(r.oval(-2.4 * k, -0.6 * k, 9.6 * k, 2.4 * k), TOSTADO, { bisel: 2 * k, contorno: 0, alfa: 0.75, suave: 0.8 * k, ruga: 0.4, semente: 4531 }))
  L.push(P(r.oval(13.2 * k, 0, 4.6 * k, 3.9 * k), ASSADO, { bisel: 2.4 * k, contorno: 0.26, metal: 0.1, semente: 4532, projeta: sombraEmCima(k, 0.9, 0.3) }))
  for (const lado of [-1, 1]) {
    L.push(P(r.poli([[10.6 * k, lado * 2.2 * k], [9.4 * k, lado * 4.8 * k], [12.6 * k, lado * 3.4 * k]]), TOSTADO, { bisel: 0.7 * k, contorno: 0.24, tom: 0.84, semente: 4533 + lado }))
  }
  L.push(P(r.oval(18.4 * k, 0, 2.1 * k, 2.1 * k), MACA, { bisel: 1.4 * k, contorno: 0.24, semente: 4536, projeta: sombraEmCima(k, 0.5, 0.26) }))
  // O rabinho enrolado na outra ponta.
  L.push(P(r.cap(-15.4 * k, 0.4 * k, -17 * k, -0.8 * k, 0.6 * k), ASSADO, { bisel: 0.5 * k, contorno: 0.2, semente: 4537 }))

  // As duas fruteiras e os dois pães, um de cada lado do leitão.
  const uPao = u1 - PAO_DA_PONTA * casa
  const uFruta = Math.max(0.62 * casa, (tu + uPao) / 2)
  for (const ponta of [-1, 1]) fruteira(c, L, r, ponta * uFruta, 0, ponta)
  for (const ponta of [-1, 1]) {
    const up = ponta * uPao
    L.push(P(r.oval(up, 0.4 * k, 6.4 * k, 4.2 * k, 0.12 * ponta), PAO, { bisel: 3 * k, contorno: 0.24, ruga: 0.3, semente: 4600 + ponta, projeta: sombraEmCima(k, 1, 0.3) }))
    // Os cortes do pão, claros (o miolo aparecendo).
    for (const d of [-2.8, 0, 2.8]) L.push(P(r.cap(up + d * k - 1.1 * k, -1.6 * k, up + d * k + 1.1 * k, 2.4 * k, 0.55 * k), MIOLO, { bisel: 0.3 * k, contorno: 0.1, tom: 0.96, semente: 4610 + d }))
  }
}

/** A fruteira de estanho com três maçãs, duas peras e um cacho de uva. */
function fruteira(c: ContextoDoMovel, partes: Peca[], r: Regua, u: number, v: number, ponta: number): void {
  const P = c.peca
  const k = r.casa / c.g
  const rf = RAIO_DA_FRUTEIRA * r.casa
  partes.push(
    P(r.oval(u, v, rf, rf), ESTANHO, { bisel: rf * 0.25, contorno: 0.24, metal: 0.3, tom: 0.9, semente: 4700 + ponta, projeta: sombraEmCima(k, 1, 0.32) }),
    P(anel(...r.pt(u, v), rf * 0.82, rf * 0.82, rf * 0.7, rf * 0.7), ESTANHO, { bisel: 0.4, contorno: 0, tom: 0.84, semente: 4702 + ponta }),
  )
  // O cacho de uva para o lado da ponta da mesa; as peras e as maçãs por cima, para o meio.
  const uvas: readonly Ponto[] = [[0, 0], [1.9, 0.6], [1, -1.6], [-1.2, -1.1], [-0.6, 1.4], [2.6, -1.1], [3.4, 0.6]]
  uvas.forEach(([du, dv], i) => partes.push(P(r.oval(u + ponta * (2.6 + du) * k, v + (2.6 + dv) * k, 1.25 * k, 1.25 * k), UVA, { bisel: 1 * k, contorno: 0.26, tom: 0.92 + (i % 3) * 0.06, semente: 4710 + i, projeta: sombraEmCima(k, 0.4, 0.26) })))
  for (const [du, dv, giro] of [[2.2, -3.4, 0.7], [-3.6, 2.6, -0.4]] as const) {
    partes.push(P(r.oval(u + ponta * du * k, v + dv * k, 2.6 * k, 1.9 * k, giro), PERA, { bisel: 1.6 * k, contorno: 0.24, semente: 4720 + du, projeta: sombraEmCima(k, 0.6, 0.28) }))
  }
  for (const [du, dv] of [[-2.6, -1.8], [0.2, -0.4], [-0.6, -3.8]] as const) {
    partes.push(P(r.oval(u + ponta * du * k, v + dv * k, 2.3 * k, 2.3 * k), MACA, { bisel: 1.7 * k, contorno: 0.26, semente: 4730 + du * 3, projeta: sombraEmCima(k, 0.7, 0.3) }))
  }
}
