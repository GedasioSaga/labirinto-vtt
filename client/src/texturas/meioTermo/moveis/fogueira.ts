/**
 * FOGUEIRA de cima com volume, PARADA (`objetos.js:1426-1492` sem a chama): a
 * roda de 8 pedras deitadas, o leito de cinza, a lenha em X queimada no
 * centro, o halo quente e as brasas por cima do cruzamento. De Lado: as 4
 * pedras em domo na frente, o leito de cinza atrás delas, a lenha em X, o halo
 * e as brasas (`FOGUEIRA_DE_LADO` de `lib/mobilia.ts`). Materiais: `pedras` e
 * `lenha`.
 *
 * A CHAMA não entra na imagem: ela é animada numa camada à parte, por cima
 * (`pixi/chamasDasFogueiras.ts`, que nasce de `chamaDaFogueira`), e não muda.
 * De lado, o alto do objeto fica vazio (só a sombra no chão e o halo, quase
 * transparente) para ela subir.
 *
 * Revisão da MT3: a brasa era ruído cor de ferrugem espalhado no leito e na
 * lenha (lia como respingo), havia uma "arruela" de cinza no cruzamento da
 * lenha (o X virava hélice) e, de lado, o leito flutuava no ar como uma lente
 * cinza. Agora: poucas brasas redondas, sem contorno, com o miolo quente, e um
 * halo quente fraco por baixo, que casa com a chama animada.
 */
import { hash } from '../../ruido'
import { capsula, elipse, elipseGirada, uniao, type Forma } from './formas'
import { ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { CINZA, QUARTO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'

type Rgb3 = readonly [number, number, number]

/**
 * A brasa, do vermelho apagado da borda ao laranja do miolo, contida (regra 5
 * do estilo: pastel, nunca neon): saturação HSV ≤ 0,60 nos dois tons, para
 * cada brasa passar sozinha no teto de 0,62 do p95. Quem dá o fogo vivo é a
 * chama animada por cima.
 */
export const BRASA_VIVA: Rgb3 = [150, 82, 62]
export const BRASA_QUENTE: Rgb3 = [196, 130, 82]

/** O halo quente por baixo das brasas: o tom do miolo, alfa 0,2 no centro, até 0,3 casa (no tamanho padrão). */
const ALFA_DO_HALO = 0.2
/** Raio do halo em fração do raio da roda (de cima) e da largura (de lado): 0,3 casa na fogueira de 1 casa. */
export const HALO_DE_CIMA = 0.6
export const HALO_DE_LADO = 0.3

/**
 * As brasas: [x, y] em fração do raio da roda a partir do centro do fogo (de
 * cima) e o raio em px do protótipo (1 a 1,5, o carvão do protótipo). Sempre as
 * mesmas, como as pedras: a roda não pula entre fogueiras.
 */
export const BRASAS_DE_CIMA: readonly (readonly [number, number, number])[] = [
  [0, 0, 1.5],
  [-0.05, -0.12, 1.2],
  [0.14, 0.03, 1.1],
  [-0.13, 0.08, 1.3],
  [0.05, 0.15, 1],
]
/** De lado: [x em fração da largura, y em fração da altura a partir de cima, raio em px], no colo do X da lenha. */
export const BRASAS_DE_LADO: readonly (readonly [number, number, number])[] = [
  [0, 0.695, 1.4],
  [-0.055, 0.672, 1.2],
  [0.055, 0.678, 1.1],
]

/**
 * Material do halo e das brasas: o da cinza do leito, onde elas estão (a
 * imagem parada só tem pedra, lenha e cinza; a chama é outra camada). A cor
 * sai toda da textura, que é emissão (não pega luz nem sombra).
 */
const BRASA: MaterialDaPeca = CINZA

function misturar(a: Rgb3, b: Rgb3, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Lenha: a casca, queimada (mais escura) perto do centro do fogo (`cx`, `cy`, raio `r`). */
function texLenha(cx: number, cy: number, r: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    texturaDaClasse(p.mat.classe)?.(u, v, x, y, p, s, escala)
    const d = Math.hypot(x - cx, y - cy)
    if (d >= r) return
    s[3] -= 0.5 * (1 - d / r)
  }
}

/** Leito de cinza: só a variação da cinza, um pouco mais clara para fora (centro `cx`, `cy`, raio `r`). */
function texCinza(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x - cx, y - cy) / r
    const n = ruido(x * 0.3 + 11, y * 0.3) + ruido(x * 0.85 + 3, y * 0.85 + 7) * 0.5
    s[3] += ruido(x * 0.12, y * 0.12) * 0.16 + n * 0.08 + (rr - 0.5) * 0.06
  }
}

/** O halo: o tom quente com alfa que cai suave do centro (`cx`, `cy`) até `r`. */
function texHalo(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r))
    s[0] = BRASA_QUENTE[0]
    s[1] = BRASA_QUENTE[1]
    s[2] = BRASA_QUENTE[2]
    s[4] = 1
    s[5] = ALFA_DO_HALO * (1 - q) * (1 - q)
  }
}

/** Uma brasa redonda: miolo quente, borda vermelha apagada, toda emissão. */
function texBrasa(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, Math.hypot(x - cx, y - cy) / r)
    const c = misturar(BRASA_QUENTE, BRASA_VIVA, q * q)
    s[0] = c[0]
    s[1] = c[1]
    s[2] = c[2]
    s[4] = 1
  }
}

/** O halo (de raio `r`) e as brasas em volta de (cx, cy); `px` e `py` levam as frações de cada brasa a px. */
function fogoParado(c: ContextoDoMovel, L: Peca[], cx: number, cy: number, r: number, brasas: readonly (readonly [number, number, number])[], px: (f: number) => number, py: (f: number) => number): void {
  L.push(c.peca(elipse(cx, cy, r, r), BRASA, { textura: texHalo(cx, cy, r), bisel: 0, contorno: 0, semente: 240 }))
  brasas.forEach(([fx, fy, raio], i) => {
    const bx = px(fx)
    const by = py(fy)
    L.push(c.peca(elipse(bx, by, raio, raio), BRASA, { textura: texBrasa(bx, by, raio), bisel: 0, contorno: 0, semente: 245 + i }))
  })
}

/** Uma tora de lenha de `a` a `b`, de raio `raio`, queimada perto do fogo. */
function tora(c: ContextoDoMovel, a: readonly [number, number], b: readonly [number, number], raio: number, fogo: readonly [number, number, number], k: number): Peca {
  return c.peca(capsula(a[0], a[1], b[0], b[1], raio), c.m.lenha, {
    eixo: Math.atan2(b[1] - a[1], b[0] - a[0]),
    textura: texLenha(fogo[0], fogo[1], fogo[2]),
    bisel: raio,
    contorno: 0.2,
    semente: 220 + k,
    projeta: k > 0 ? { dist: 1.2, forca: 0.35 } : undefined,
  })
}

const VOLTA = Math.PI * 2
/** Pedras da roda vista de cima. */
const PEDRAS_NA_RODA = 8
/** Raio da roda (o centro das pedras) em fração da pegada. */
const RAIO_DA_RODA = 0.81
/** Altura das pedras (a sombra), em px do protótipo. */
const ALTURA_DAS_PEDRAS = 7
/**
 * De lado, o leito de cinza fica ATRÁS das pedras, com o meio na altura do
 * topo delas (0,79 a 0,82 de cima): só a beirada aparece entre os domos. Antes
 * ele ficava em 0,735, acima das pedras e abaixo da base da chama (0,68), e
 * flutuava no ar.
 */
export const LEITO_DE_LADO = 0.8
export const ALTURA_DO_LEITO_DE_LADO = 1.6

function montarFogueiraDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hh, w, h } = c
  const nA = (f: number): number => -hh + f * h
  const picos = [0.81, 0.79, 0.82, 0.8]
  const pedras: Forma[] = picos.map((pico, i) => {
    const cx = (-0.375 + 0.25 * i) * w
    const topo = nA(pico)
    return elipse(cx, (topo + hh) / 2 + 0.6, 0.155 * w, (hh - topo) / 2 + 0.6)
  })
  sombraDeLado(cena, pedras.reduce(uniao), ALTURA_DAS_PEDRAS)
  const L = cena.partes
  const raio = 0.035 * w * 1.3
  const fogo = [0, nA(0.675), 0.2 * w] as const
  for (const [k, sx] of [[0, 1], [1, -1]]) L.push(tora(c, [-sx * 0.26 * w, nA(0.79)], [sx * 0.26 * w, nA(0.56)], raio, fogo, k))
  fogoParado(c, L, 0, nA(0.68), HALO_DE_LADO * w, BRASAS_DE_LADO, (f) => f * w, nA)
  L.push(c.peca(elipse(0, nA(LEITO_DE_LADO), 6.5, ALTURA_DO_LEITO_DE_LADO), CINZA, { textura: texCinza(0, nA(LEITO_DE_LADO), 6), bisel: 0, contorno: 0, suave: 0.8, semente: 250 }))
  pedras.forEach((forma, i) => L.push(c.peca(forma, c.m.pedras, { bisel: Math.min(0.155 * w, 6) * 0.9, contorno: 0.2, semente: 260 + i })))
}

export const montarFogueira: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarFogueiraDeLado(c, cena)
    return
  }
  const { hw, hh } = c
  const R = Math.min(hw, hh)
  const pedras: { forma: Forma; menor: number; eixo: number }[] = []
  for (let i = 0; i < PEDRAS_NA_RODA; i += 1) {
    // Um pouco desiguais, sempre do mesmo jeito (o sorteio não usa a semente: a roda não pula entre fogueiras).
    const a = ((i + 0.5) / PEDRAS_NA_RODA) * VOLTA + (hash(i, 3, 901) - 0.5) * 0.18
    const tang = 0.33 * R * (0.9 + 0.2 * hash(i, 4, 901))
    const rad = 0.21 * R * (0.9 + 0.2 * hash(i, 5, 901))
    const forma = elipseGirada(Math.cos(a) * hw * RAIO_DA_RODA, Math.sin(a) * hh * RAIO_DA_RODA, tang, rad, a + QUARTO)
    pedras.push({ forma, menor: Math.min(tang, rad), eixo: a + QUARTO })
    cena.sombras.push({ forma, z: ALTURA_DAS_PEDRAS, forca: 0.3 })
  }
  const L = cena.partes
  L.push(c.peca(elipse(0, 0, hw * 0.76, hh * 0.76), CINZA, { textura: texCinza(0, 0, R * 0.76), bisel: 0, contorno: 0, semente: 210 }))
  const comprimento = 0.56 * 2 * R
  const raio = 0.058 * 2 * R
  const fogo = [0, 0, R * 0.42] as const
  for (const [k, graus] of [[0, 35], [1, -35]]) {
    const ang = (graus * Math.PI) / 180
    const ax = (-Math.cos(ang) * comprimento) / 2
    const ay = (-Math.sin(ang) * comprimento) / 2
    L.push(tora(c, [ax, ay], [-ax, -ay], raio, fogo, k))
  }
  // A lenha já queima o cruzamento: as brasas e o halo vão por cima dela, sem a "arruela" de cinza que havia ali.
  fogoParado(c, L, 0, 0, HALO_DE_CIMA * R, BRASAS_DE_CIMA, (f) => f * R, (f) => f * R)
  // O veio da pedra corre ao longo dela: as camadas do arenito acompanham cada pedra deitada na roda.
  pedras.forEach(({ forma, menor, eixo }, i) => L.push(c.peca(forma, c.m.pedras, { eixo, bisel: menor * 0.92, contorno: 0.2, semente: 200 + i })))
}
