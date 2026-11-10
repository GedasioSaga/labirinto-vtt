/**
 * SUCATA DE METAL de cima com volume (10/11/2026, pedido do mestre: "sucatas
 * de metal com três variações diferentes"). São três OBJETOS do catálogo, não
 * três formas de um: cada um tem a sua silhueta, para o ferro-velho não virar
 * o mesmo carimbo repetido.
 *
 * - CHAPAS (2 x 2 casas): duas chapas tortas, uma com os rebites e o canto
 *   cortado, a outra com o canto dobrado; duas vigas em I cruzadas por cima
 *   (as abas claras, a alma funda) e um cano largado na frente.
 * - ENGRENAGENS (1 x 1): o monte de peças miúdas com três rodas dentadas (a
 *   grande com os furos de alívio, a média encostada de lado e a metade de uma
 *   partida), um eixo, porcas e arruelas.
 * - TAMBORES (2 x 2): o tambor em pé com a boca amassada, o deitado com os
 *   aros e o afundado no meio, o esmagado no chão, a tampa solta e a mancha de
 *   óleo embaixo.
 *
 * O que diz "sucata" a 25% de zoom é a silhueta quebrada e o tom: aço cinza
 * com a FERRUGEM em manchas (nunca em listras), contida. Sem material no
 * painel: o metal, a ferrugem e a tinta gasta dos tambores são fixos. As
 * medidas saem do menor lado da pegada (as rodas continuam redondas no objeto
 * esticado) e as posições, de frações dela.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, capsula, dentroDe, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { BURACO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** O aço das chapas e das vigas, em três luzes. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.14)) }
const ACO_ESCURO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
const ACO_CLARO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('metal', 1.08)) }
/** A ferrugem: o barranco do Meio-Termo um pouco baixo (saturação 0,48: marrom-alaranjado, não laranja). */
const FERRUGEM: Rgb = rgb('#935f47')
/** No miolo da mancha ainda sobra um pouco do metal de baixo. */
const FERRUGEM_CHEIA = 0.84
/** A tinta gasta dos tambores: o azul da telha clara, o verde da telha e uma mostarda desbotada, todos baixos. */
const TINTA_AZUL: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('telhaAzulClara', 0.94)) }
const TINTA_VERDE: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('telhaVerde', 0.92)) }
const TINTA_MOSTARDA: MaterialDaPeca = { classe: 'metal', rgb: rgb('#a39064') }
/** O óleo no chão: cinza-escuro neutro, meio transparente (o chão aparece por baixo). */
const OLEO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#3f3d3a') }
/** Brilho do metal velho: bem abaixo do metal novo (0,42), a ferrugem não espelha. */
const BRILHO_DE_SUCATA = 0.2

/**
 * A FERRUGEM em manchas: onde o ruído passa do limiar o tom vai para a ferrugem e perde a luz. `quanto` de
 * 0 (quase limpo) a 0,6 (quase tudo comido); cada peça desloca o ruído pela própria semente.
 */
function texFerrugem(quanto: number): Textura {
  return (_u, _v, x, y, p, s) => {
    // Três escalas: a mancha grande, o recorte dela e o grão miúdo, que desfaz a beira (ferrugem não tem contorno).
    const mancha = ruido(x * 0.085 + p.su, y * 0.085 + p.sv) * 1.5 + ruido(x * 0.3 + p.sv, y * 0.3 + p.su) * 0.9 + ruido(x * 1.1 + p.su, y * 1.1) * 0.55
    const q = (mancha + quanto - 0.2) / 0.5
    const t = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
    s[3] += ruido(x * 0.16 + p.su, y * 0.16) * 0.1 + ruido(x * 0.75, y * 0.75 + p.sv) * 0.04 - t * 0.06
  }
}

/** Pontos locais (x ao longo, y através) girados `ang` e postos em (cx, cy). */
function girados(pontos: readonly Ponto[], cx: number, cy: number, ang: number): Ponto[] {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return pontos.map(([x, y]) => [cx + x * co - y * si, cy + x * si + y * co])
}

/** O retângulo girado de `comp` x `larg` com o meio em (cx, cy). */
function tira(cx: number, cy: number, comp: number, larg: number, ang: number): Forma {
  const dx = (Math.cos(ang) * comp) / 2
  const dy = (Math.sin(ang) * comp) / 2
  return barra(cx - dx, cy - dy, cx + dx, cy + dy, larg)
}

/** A sombra no chão de uma peça da pilha: arrastada até `z` e o contato no pé. */
function assentar(cena: Cena, forma: Forma, z: number, forca = 0.28): void {
  cena.sombras.push({ forma, z, forca }, contato(forma, 0.26))
}

// ---------------------------------------------------------------------------
// CHAPAS: chapas tortas, vigas em I e um cano.

/** A viga em I deitada: a alma funda no meio e as duas abas claras nas beiras, com a ferrugem de cada uma. */
function vigaEmI(P: CriarPeca, cena: Cena, L: Peca[], cx: number, cy: number, comp: number, larg: number, ang: number, z: number, sem: number): void {
  const corpo = tira(cx, cy, comp, larg, ang)
  assentar(cena, corpo, z)
  L.push(P(corpo, ACO_ESCURO, { eixo: ang, tabua: 0, bisel: 0.6, tom: 0.84, contorno: 0.3, metal: BRILHO_DE_SUCATA, textura: texFerrugem(0.34), semente: sem, projeta: { dist: z * 0.16 + 0.8, forca: 0.32 } }))
  const aba = larg * 0.3
  const fora = (larg - aba) / 2
  for (const lado of [-1, 1] as const) {
    const ox = -Math.sin(ang) * fora * lado
    const oy = Math.cos(ang) * fora * lado
    L.push(P(tira(cx + ox, cy + oy, comp, aba, ang), ACO, { eixo: ang, tabua: 0, bisel: aba * 0.45, tom: lado < 0 ? 1.06 : 0.96, contorno: 0.26, metal: 0.3, textura: texFerrugem(0.16), semente: sem + 1 + (lado + 1) / 2 }))
  }
}

export const montarSucataDeChapas: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const L = cena.partes

  // A chapa grande, embaixo: torta, com o canto de baixo cortado a maçarico e a fileira de rebites.
  const aG = -0.2
  const cG: [number, number] = [-0.14 * hw, 0.16 * hh]
  const mG = R * 0.64
  const lG = R * 0.46
  const chapaGrande = poligono(girados([[-mG, -lG], [mG, -lG], [mG, lG * 0.42], [mG * 0.62, lG], [-mG, lG]], cG[0], cG[1], aG))
  assentar(cena, chapaGrande, g * 0.05, 0.24)
  L.push(P(chapaGrande, ACO_ESCURO, { eixo: aG, tabua: 0, bisel: 0.9, contorno: 0.32, metal: BRILHO_DE_SUCATA, textura: texFerrugem(0.3), semente: 2201 }))
  for (const [k, ponto] of girados([-0.8, -0.4, 0, 0.4, 0.8].map((f): Ponto => [f * mG, -lG * 0.82]), cG[0], cG[1], aG).entries()) {
    L.push(P(elipse(ponto[0], ponto[1], 1, 1), ACO, { bisel: 1, contorno: 0.2, metal: 0.3, tom: 1.1, semente: 2205 + k }))
  }

  // A viga de baixo, atravessada sobre a chapa grande.
  vigaEmI(P, cena, L, -0.1 * hw, -0.14 * hh, R * 1.6, R * 0.2, 0.62, g * 0.16, 2210)

  // A chapa menor, mais nova, com o canto dobrado para cima.
  const aM = 0.42
  const cM: [number, number] = [0.3 * hw, 0.36 * hh]
  const mM = R * 0.44
  const lM = R * 0.3
  const chapaMenor = poligono(girados([[-mM, -lM], [mM * 0.6, -lM], [mM, -lM * 0.3], [mM, lM], [-mM, lM]], cM[0], cM[1], aM))
  assentar(cena, chapaMenor, g * 0.1)
  L.push(P(chapaMenor, ACO, { eixo: aM, tabua: 0, bisel: 0.9, contorno: 0.3, metal: 0.3, textura: texFerrugem(0.1), semente: 2220, projeta: { dist: 1.3, forca: 0.3 } }))
  const dobra = poligono(girados([[mM * 0.6, -lM], [mM, -lM * 0.3], [mM * 0.52, -lM * 0.24]], cM[0], cM[1], aM))
  L.push(P(dobra, ACO_CLARO, { tabua: 0, bisel: 0.7, tom: 1.08, contorno: 0.3, metal: 0.36, semente: 2222, projeta: { dist: 1.1, forca: 0.3 } }))

  // A viga de cima, cruzando a de baixo.
  vigaEmI(P, cena, L, 0.14 * hw, -0.3 * hh, R * 1.46, R * 0.19, -0.42, g * 0.3, 2230)

  // O cano largado na frente, com a boca escura numa ponta.
  const rC = R * 0.075
  const [x0, y0, x1, y1] = [-0.72 * hw, 0.5 * hh, -0.02 * hw, 0.8 * hh]
  const aC = Math.atan2(y1 - y0, x1 - x0)
  const cano = capsula(x0, y0, x1, y1, rC)
  assentar(cena, cano, g * 0.12)
  L.push(P(cano, ACO_CLARO, { eixo: aC, tabua: 0, bisel: rC, contorno: 0.3, metal: 0.4, textura: texFerrugem(0.12), semente: 2240, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(elipseGirada(x0 - Math.cos(aC) * rC * 0.2, y0 - Math.sin(aC) * rC * 0.2, rC * 0.5, rC * 0.74, aC), BURACO, { bisel: 0.3, contorno: 0.1, semente: 2241 }))

  // As porcas soltas e os cacos de chapa.
  for (const [k, [fx, fy]] of ([[0.66, 0.74], [0.8, -0.04], [-0.84, -0.3]] as const).entries()) {
    const r = R * 0.055
    const porca = poligono(girados([0, 1, 2, 3, 4, 5].map((i): Ponto => [Math.cos((i * Math.PI) / 3) * r, Math.sin((i * Math.PI) / 3) * r]), fx * hw, fy * hh, k * 0.5))
    cena.sombras.push(contato(porca, 0.24))
    L.push(P(menos(porca, elipse(fx * hw, fy * hh, r * 0.42, r * 0.42)), ACO, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.3, textura: texFerrugem(0.2), semente: 2250 + k }))
  }
  for (const [k, [fx, fy, ang]] of ([[-0.56, 0.86, 0.3], [0.78, 0.34, 2.1]] as const).entries()) {
    const r = R * 0.09
    const caco = poligono(girados([[-r, -r * 0.5], [r, -r * 0.2], [-r * 0.2, r * 0.7]], fx * hw, fy * hh, ang))
    cena.sombras.push(contato(caco, 0.22))
    L.push(P(caco, ACO_ESCURO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: BRILHO_DE_SUCATA, textura: texFerrugem(0.4), semente: 2260 + k }))
  }
}

// ---------------------------------------------------------------------------
// ENGRENAGENS: o monte de peças com três rodas dentadas.

/** A roda dentada: `dentes` dentes de topo reto; `achatar` deita a roda (a que está encostada de lado). */
function rodaDentada(cx: number, cy: number, raio: number, dentes: number, giro: number, achatar = 1): Ponto[] {
  const pontos: Ponto[] = []
  const passo = (2 * Math.PI) / dentes
  const raiz = raio * 0.8
  for (let i = 0; i < dentes; i += 1) {
    for (const [f, r] of [[0, raiz], [0.16, raio], [0.44, raio], [0.6, raiz]] as const) {
      const t = giro + (i + f) * passo
      pontos.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r * achatar])
    }
  }
  return pontos
}

/** O monte: um contorno irregular de `n` pontos em volta de (cx, cy). */
function monte(cx: number, cy: number, rx: number, ry: number, n: number, sem: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * 2 * Math.PI
    const k = 0.84 + 0.3 * hash(i, sem, 23)
    pontos.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k])
  }
  return pontos
}

/** O miúdo do monte: cacos de ferro em células (cada caco um pouco mais claro ou mais escuro), com a ferrugem por cima. */
function texDoMiudo(lado: number): Textura {
  const ferrugem = texFerrugem(0.3)
  return (u, v, x, y, p, s, escala) => {
    const X = x / lado
    const Y = y / lado
    const cx = Math.floor(X)
    const cy = Math.floor(Y)
    let perto = Infinity
    let longe = Infinity
    let tom = 0.5
    for (let j = -1; j <= 1; j += 1) {
      for (let i = -1; i <= 1; i += 1) {
        const d = Math.hypot(X - (cx + i + hash(cx + i, cy + j, 61)), Y - (cy + j + hash(cx + i, cy + j, 62)))
        if (d < perto) {
          longe = perto
          perto = d
          tom = hash(cx + i, cy + j, 63)
        } else if (d < longe) longe = d
      }
    }
    s[3] += (tom - 0.5) * 0.22 + (0.5 - perto) * 0.18 - Math.max(0, 0.07 - (longe - perto)) * 2.2
    ferrugem(u, v, x, y, p, s, escala)
  }
}

export const montarSucataDeEngrenagens: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const L = cena.partes

  // O monte de peças miúdas por baixo de tudo.
  const base = poligono(monte(0.02 * hw, 0.06 * hh, hw * 0.8, hh * 0.78, 18, 31))
  assentar(cena, base, g * 0.08, 0.26)
  L.push(P(base, ACO_ESCURO, { tabua: 0, bisel: R * 0.22, tom: 0.86, contorno: 0.34, metal: 0.1, textura: texDoMiudo(R * 0.16), semente: 2301 }))

  // O eixo atravessado no fundo.
  const rE = R * 0.07
  const eixo = capsula(-0.74 * hw, -0.42 * hh, 0.04 * hw, -0.74 * hh, rE)
  assentar(cena, eixo, g * 0.12)
  L.push(P(eixo, ACO_CLARO, { eixo: Math.atan2(-0.32 * hh, 0.78 * hw), tabua: 0, bisel: rE, contorno: 0.3, metal: 0.4, textura: texFerrugem(0.1), semente: 2305, projeta: { dist: 1, forca: 0.3 } }))

  // A metade de uma roda partida, comida de ferrugem.
  const [qx, qy, rQ] = [0.4 * hw, 0.5 * hh, R * 0.3]
  const partida = dentroDe(poligono(rodaDentada(qx, qy, rQ, 7, 0.4)), tira(qx + rQ * 0.42, qy + rQ * 0.3, rQ * 2.6, rQ * 1.3, -0.7))
  assentar(cena, partida, g * 0.08)
  L.push(P(menos(partida, elipse(qx, qy, rQ * 0.3, rQ * 0.3)), ACO_ESCURO, { tabua: 0, bisel: 0.9, contorno: 0.32, metal: BRILHO_DE_SUCATA, textura: texFerrugem(0.46), semente: 2310, projeta: { dist: 1, forca: 0.3 } }))

  // A roda grande: o aro dos dentes, o prato fundo com os furos de alívio, o cubo e o furo do eixo.
  const [gx, gy, rG] = [-0.2 * hw, 0.14 * hh, R * 0.5]
  const grande = poligono(rodaDentada(gx, gy, rG, 10, 0.2))
  assentar(cena, grande, g * 0.12)
  L.push(P(grande, ACO, { tabua: 0, bisel: 1.1, contorno: 0.32, metal: 0.28, textura: texFerrugem(0.2), semente: 2320, projeta: { dist: 1.4, forca: 0.34 } }))
  L.push(P(anel(gx, gy, rG * 0.64, rG * 0.64, rG * 0.3, rG * 0.3), ACO_ESCURO, { tabua: 0, bisel: 0.5, tom: 1.02, contorno: 0.18, metal: 0.16, recesso: { k: 1.6, forca: 0.3 }, textura: texFerrugem(0.3), semente: 2321 }))
  for (let i = 0; i < 5; i += 1) {
    const t = 0.5 + (i * 2 * Math.PI) / 5
    L.push(P(elipse(gx + Math.cos(t) * rG * 0.47, gy + Math.sin(t) * rG * 0.47, rG * 0.1, rG * 0.1), BURACO, { bisel: 0.3, contorno: 0.1, semente: 2322 + i }))
  }
  L.push(P(elipse(gx, gy, rG * 0.3, rG * 0.3), ACO_CLARO, { tabua: 0, bisel: rG * 0.12, contorno: 0.26, metal: 0.36, semente: 2328 }))
  L.push(P(elipse(gx, gy, rG * 0.13, rG * 0.13), BURACO, { bisel: 0.3, contorno: 0.1, recesso: { k: 0.8, forca: 0.3 }, semente: 2329 }))

  // A roda média, encostada de lado na grande (por isso achatada).
  const [mx, my, rM] = [0.38 * hw, -0.36 * hh, R * 0.36]
  const media = poligono(rodaDentada(mx, my, rM, 8, 0.1, 0.82))
  assentar(cena, media, g * 0.2)
  L.push(P(menos(media, elipse(mx, my, rM * 0.2, rM * 0.2 * 0.82)), ACO_CLARO, { tabua: 0, bisel: 1, contorno: 0.32, metal: 0.34, textura: texFerrugem(0.06), semente: 2330, projeta: { dist: 1.5, forca: 0.34 } }))
  L.push(P(anel(mx, my, rM * 0.6, rM * 0.6 * 0.82, rM * 0.36, rM * 0.36 * 0.82), ACO, { tabua: 0, bisel: 0.4, tom: 0.9, contorno: 0.16, metal: 0.2, recesso: { k: 1.2, forca: 0.26 }, semente: 2331 }))

  // As arruelas e a porca caídas na beira.
  for (const [k, [fx, fy]] of ([[-0.72, 0.7], [-0.36, -0.84], [0.78, 0.04]] as const).entries()) {
    const r = R * 0.085
    const arruela = anel(fx * hw, fy * hh, r, r, r * 0.45, r * 0.45)
    cena.sombras.push(contato(arruela, 0.24))
    L.push(P(arruela, ACO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.3, textura: texFerrugem(0.2), semente: 2340 + k }))
  }
}

// ---------------------------------------------------------------------------
// TAMBORES: em pé, deitado e esmagado.

/** Um amassado na boca do tambor: onde (ângulo), quanto entra (fração do raio) e a largura (radianos). */
type Amassado = readonly [number, number, number]

/** A boca do tambor em pé: a roda com os amassados entrando; `k` encolhe (a borda de dentro, a tampa). */
function bocaAmassada(cx: number, cy: number, raio: number, amassados: readonly Amassado[], k: number): Ponto[] {
  const pontos: Ponto[] = []
  const n = 44
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * 2 * Math.PI
    let fundo = 0
    for (const [onde, quanto, largura] of amassados) {
      let d = t - onde
      d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI
      fundo += quanto * Math.exp(-(d * d) / (largura * largura))
    }
    const r = raio * k * (1 - fundo)
    pontos.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r])
  }
  return pontos
}

/** De onde vem a luz no chão (a do motor: de cima à esquerda). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
/** Quanto a luz muda de um lado ao outro do cilindro deitado. */
const FORCA_DO_BOJO = 0.45

interface TamborDeitado {
  readonly cx: number
  readonly cy: number
  readonly comp: number
  readonly larg: number
  readonly ang: number
  readonly tinta: MaterialDaPeca
  /** Quanto a cintura afunda (fração da meia largura): 0 inteiro, 0,4 esmagado. */
  readonly cintura: number
  readonly ferrugem: number
  /** Quanto o cilindro ainda é redondo (a força da luz de través): 1 inteiro, 0,5 chato. */
  readonly bojo: number
  readonly z: number
  readonly sem: number
}

/**
 * O tambor DEITADO, como a tora dos troncos: o corpo ao comprido (a luz de través faz o cilindro), os dois
 * aros, e nas pontas a tampa vista de viés (a da ponta da luz, com o bujão) e o fundo (na sombra). A
 * cintura afunda no esmagado, e os aros acompanham.
 */
function tamborDeitado(c: ContextoDoMovel, cena: Cena, L: Peca[], t: TamborDeitado): void {
  const P = c.peca
  const co = Math.cos(t.ang)
  const si = Math.sin(t.ang)
  const a = t.comp / 2
  const b = t.larg / 2
  const meiaLargEm = (x: number): number => b * (1 - t.cintura * Math.exp(-((x / (a * 0.3)) ** 2)))
  const noMapa = (x: number, y: number): Ponto => [t.cx + x * co - y * si, t.cy + x * si + y * co]
  const n = 12
  const contorno: Ponto[] = []
  for (let i = 0; i <= n; i += 1) {
    const x = -a + (2 * a * i) / n
    contorno.push(noMapa(x, -meiaLargEm(x)))
  }
  for (let i = n; i >= 0; i -= 1) {
    const x = -a + (2 * a * i) / n
    contorno.push(noMapa(x, meiaLargEm(x)))
  }
  const corpo = poligono(contorno)
  assentar(cena, corpo, t.z)
  // A luz de través: o lado do cilindro virado para a luz clareia, o outro escurece, e as duas beiras caem.
  const paraALuz = FORCA_DO_BOJO * (-si * LUZ_X + co * LUZ_Y)
  const ferrugem = texFerrugem(t.ferrugem)
  const cilindro: Textura = (u, v, x, y, p, s, escala) => {
    const lx = (x - t.cx) * co + (y - t.cy) * si
    const q = Math.max(-1, Math.min(1, (-(x - t.cx) * si + (y - t.cy) * co) / meiaLargEm(lx)))
    s[3] += t.bojo * (paraALuz * q - 0.2 * q * q * q * q)
    ferrugem(u, v, x, y, p, s, escala)
  }
  L.push(P(corpo, t.tinta, { eixo: t.ang, tabua: 0, bisel: 1.1, contorno: 0.32, metal: 0.2, textura: cilindro, semente: t.sem, projeta: { dist: t.z * 0.1 + 0.8, forca: 0.32 } }))
  // Os dois aros (as nervuras do tambor), um pouco para fora do corpo.
  for (const [k, f] of [-0.34, 0.34].entries()) {
    const x = f * a
    const [mx, my] = noMapa(x, 0)
    L.push(P(tira(mx, my, b * 0.14, meiaLargEm(x) * 2.06, t.ang), t.tinta, { eixo: t.ang, tabua: 0, bisel: 0.7, tom: 1.1, contorno: 0.2, metal: 0.24, textura: cilindro, semente: t.sem + 1 + k }))
  }
  // As pontas: a tampa do lado da luz (clara, com o bujão) e o fundo do outro (na sombra).
  for (const [k, lado] of ([-1, 1] as const).entries()) {
    const [ex, ey] = noMapa(lado * a, 0)
    const naLuz = lado * (co * LUZ_X + si * LUZ_Y) > 0
    const ponta = elipseGirada(ex, ey, b * 0.2, b * 0.97, t.ang)
    L.push(P(ponta, ACO, { tabua: 0, bisel: 0.8, tom: naLuz ? 1.06 : 0.8, contorno: 0.3, metal: 0.24, textura: texFerrugem(t.ferrugem + 0.1), semente: t.sem + 4 + k }))
    L.push(P(elipseGirada(ex, ey, b * 0.13, b * 0.78, t.ang), ACO_ESCURO, { tabua: 0, bisel: 0.4, tom: naLuz ? 1.12 : 0.9, contorno: 0.14, metal: 0.14, textura: texFerrugem(t.ferrugem + 0.16), semente: t.sem + 6 + k }))
    if (naLuz) {
      const [bx, by] = noMapa(lado * a, -b * 0.42)
      L.push(P(elipseGirada(bx, by, b * 0.05, b * 0.12, t.ang), ACO_CLARO, { tabua: 0, bisel: 0.5, contorno: 0.24, metal: 0.3, semente: t.sem + 8 }))
    }
  }
}

export const montarSucataDeTambores: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const L = cena.partes

  // A mancha de óleo no chão, por baixo do deitado e do esmagado.
  const mancha = poligono(monte(0.26 * hw, 0.36 * hh, hw * 0.66, hh * 0.5, 16, 47))
  L.push(P(mancha, OLEO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 2.4, semente: 2401 }))

  // O esmagado: passaram por cima dele. A cintura afundou, a tinta quase toda foi embora e ficaram as dobras.
  const esmagado: TamborDeitado = { cx: 0.46 * hw, cy: -0.42 * hh, comp: R * 0.9, larg: R * 0.62, ang: 0.62, tinta: TINTA_VERDE, cintura: 0.4, ferrugem: 0.34, bojo: 0.5, z: g * 0.2, sem: 2410 }
  tamborDeitado(c, cena, L, esmagado)
  const dobra = (x0: number, y0: number, x1: number, y1: number, k: number): void => {
    const co = Math.cos(esmagado.ang)
    const si = Math.sin(esmagado.ang)
    const noMapa = (x: number, y: number): Ponto => {
      const lx = x * esmagado.comp * 0.5
      const ly = y * esmagado.larg * 0.5
      return [esmagado.cx + lx * co - ly * si, esmagado.cy + lx * si + ly * co]
    }
    const [ax, ay] = noMapa(x0, y0)
    const [bx, by] = noMapa(x1, y1)
    L.push(P(capsula(ax, ay, bx, by, 0.8), BURACO, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.9, semente: 2420 + k }))
  }
  dobra(-0.04, -0.52, 0.05, 0.52, 0)
  dobra(-0.04, -0.2, -0.4, 0.34, 1)
  dobra(0.05, 0.1, 0.42, -0.4, 2)

  // O deitado: inteiro, só com um afundado de pancada no lombo.
  const deitado: TamborDeitado = { cx: 0.12 * hw, cy: 0.46 * hh, comp: R * 1.12, larg: R * 0.7, ang: -0.2, tinta: TINTA_MOSTARDA, cintura: 0.05, ferrugem: 0.2, bojo: 1, z: g * 0.5, sem: 2430 }
  tamborDeitado(c, cena, L, deitado)
  const [afx, afy] = girados([[deitado.comp * 0.04, -deitado.larg * 0.14]], deitado.cx, deitado.cy, deitado.ang)[0]
  L.push(P(elipseGirada(afx, afy, R * 0.14, R * 0.09, deitado.ang + 0.3), BURACO, { bisel: 0, contorno: 0, alfa: 0.42, suave: 2, semente: 2440 }))

  // A tampa solta, encostada na ponta do deitado.
  const [tx, ty, rT] = [-0.68 * hw, 0.66 * hh, R * 0.2]
  const tampa = elipse(tx, ty, rT, rT)
  assentar(cena, tampa, g * 0.04, 0.22)
  L.push(P(tampa, ACO, { tabua: 0, bisel: 1, contorno: 0.32, metal: 0.26, textura: texFerrugem(0.3), semente: 2450 }))
  L.push(P(elipse(tx, ty, rT * 0.78, rT * 0.78), ACO_ESCURO, { tabua: 0, bisel: 0.5, tom: 1.06, contorno: 0.16, metal: 0.16, recesso: { k: 1.4, forca: 0.3 }, textura: texFerrugem(0.34), semente: 2451 }))
  L.push(P(elipse(tx + rT * 0.3, ty - rT * 0.2, rT * 0.16, rT * 0.16), ACO_CLARO, { tabua: 0, bisel: rT * 0.12, contorno: 0.24, metal: 0.3, semente: 2452 }))

  // O tambor em pé: o corpo, a borda da boca e a tampa funda com os dois bujões. A boca levou duas pancadas.
  const [px, py, rP] = [-0.4 * hw, -0.36 * hh, R * 0.4]
  const pancadas: readonly Amassado[] = [[0.5, 0.12, 0.4], [3.5, 0.07, 0.3]]
  const corpo = poligono(bocaAmassada(px, py, rP, pancadas, 1))
  assentar(cena, corpo, g * 0.85, 0.26)
  L.push(P(corpo, TINTA_AZUL, { tabua: 0, bisel: rP * 0.24, contorno: 0.32, metal: 0.24, textura: texFerrugem(0.16), semente: 2460, projeta: { dist: 2.4, forca: 0.32 } }))
  L.push(P(menos(poligono(bocaAmassada(px, py, rP, pancadas, 0.95)), poligono(bocaAmassada(px, py, rP, pancadas, 0.84))), ACO, { tabua: 0, bisel: 0.9, tom: 1.04, contorno: 0.2, metal: 0.34, textura: texFerrugem(0.22), semente: 2461 }))
  L.push(P(poligono(bocaAmassada(px, py, rP, pancadas, 0.84)), TINTA_AZUL, { tabua: 0, bisel: 0.6, tom: 0.9, contorno: 0.16, metal: 0.18, recesso: { k: 2.2, forca: 0.34 }, textura: texFerrugem(0.24), semente: 2462 }))
  L.push(P(elipse(px - rP * 0.36, py - rP * 0.28, rP * 0.13, rP * 0.13), ACO_CLARO, { tabua: 0, bisel: rP * 0.1, contorno: 0.26, metal: 0.34, semente: 2463 }))
  L.push(P(elipse(px + rP * 0.4, py + rP * 0.22, rP * 0.075, rP * 0.075), ACO_CLARO, { tabua: 0, bisel: rP * 0.06, contorno: 0.26, metal: 0.34, semente: 2464 }))
}
