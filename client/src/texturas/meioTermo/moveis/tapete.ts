/**
 * TAPETE de cima com volume (`objetos.js:556-631` e `:1505-1544`), sempre no
 * chão (quem o põe por baixo dos outros móveis é a ordem de desenho de
 * `lib/mobilia.ts`, `emOrdemDeDesenho`, e o contêiner do chão do editor).
 *
 * - Retangular: a franja de linho nas pontas curtas, o campo, a borda escura
 *   com o fio claro, o medalhão em losango com o miolo e os cantos. Deitado ou
 *   em pé (o comprimento corre no lado maior, como `eixoDoTapete`).
 * - Redondo: a borda e o medalhão em volta do centro, sem franja.
 * - De Lado: a faixa deitada no chão, a borda escura nas pontas e a franja (só
 *   o retangular).
 *
 * A BORDA do retangular leva um MOTIVO (losangos claros) que se repete a cada
 * meia casa a partir do centro: a faixa de uma casa é igual à de qualquer
 * outra, base para o tapete longo de comprimento livre (fatia MT5).
 * Material: `tecido` (a borda e o medalhão saem do mesmo tecido, mais escuros,
 * com o fio puxado para o creme).
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, elipse } from './formas'
import { ruido, type Cena, type Textura } from './motor'
import { G, materialDaPeca, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'

/** O creme do fio claro (`objetos.js:329`). */
const CREME: Rgb = [232, 223, 202]

interface CoresDoTapete {
  readonly campo: Rgb
  readonly escuro: Rgb
  readonly meio: Rgb
  readonly claro: Rgb
  readonly miolo: Rgb
}

function escalar(c: Rgb, k: number): Rgb {
  return [c[0] * k, c[1] * k, c[2] * k]
}

function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Borda e medalhão mais escuros (x 0,70, como o desenho de linhas), fio claro puxado para o creme. */
function coresDoTapete(base: Rgb): CoresDoTapete {
  return { campo: base, escuro: escalar(base, 0.7), meio: escalar(base, 0.8), claro: misturar(base, CREME, 0.38), miolo: misturar(base, CREME, 0.2) }
}

/** Quanto um pixel de lado 1/S está dentro de uma área a `dist` px da borda (negativo dentro): borda suave sem supersample. */
function cobre(dist: number, S: number): number {
  const k = 0.5 - dist * S
  return k <= 0 ? 0 : k >= 1 ? 1 : k
}

/** Puxa a cor do ponto para `c` em `k`. */
function tingir(s: Float32Array, c: Rgb, k: number): void {
  if (k <= 0) return
  s[0] += (c[0] - s[0]) * k
  s[1] += (c[1] - s[1]) * k
  s[2] += (c[2] - s[2]) * k
}

function pintarCampo(s: Float32Array, c: Rgb): void {
  s[0] = c[0]
  s[1] = c[1]
  s[2] = c[2]
}

/**
 * O motivo da borda se repete a cada meia casa DA GRADE DE REFERÊNCIA (50 px,
 * `GRADE_DE_REFERENCIA` de `index.ts`): uma casa de 50 px tem sempre os mesmos
 * dois losangos. Em mapa de outra grade a pegada sai em casas de 50 px, então
 * a conta muda: na grade 70 o tapete 3 x 2 é desenhado como 4,2 x 2,8 e cada
 * casa do mapa leva 2,8 losangos (limite registrado no plano, seção 7).
 */
export const PERIODO_DO_MOTIVO = G / 2

/**
 * Distância com sinal (negativa dentro) ao losango do motivo da borda: `s` é a
 * posição ao longo da faixa medida do CENTRO do tapete, `v` a distância ao meio
 * da faixa e `borda` a largura dela. Periódica em `s` com `PERIODO_DO_MOTIVO`.
 */
export function distanciaAoMotivo(s: number, v: number, borda: number): number {
  const fase = s / PERIODO_DO_MOTIVO - Math.floor(s / PERIODO_DO_MOTIVO)
  const du = Math.abs(fase - 0.5) * PERIODO_DO_MOTIVO
  const a = PERIODO_DO_MOTIVO * 0.3
  const b = borda * 0.3
  return ((du / a + Math.abs(v) / b - 1) * (a * b)) / Math.hypot(a, b)
}

/** Fio de 0,5 px do contorno do losango e o ponto escuro do meio dele. */
const MEIO_FIO_DO_MOTIVO = 0.45

/** Medalhão e cantos do retangular, por tapete (não por pixel). U = ao longo, V = atravessado. */
interface GeometriaDoRetangular {
  readonly hu: number
  readonly hv: number
  readonly borda: number
  readonly mx: number
  readonly my: number
  readonly cx: number
  readonly cy: number
  readonly fhu: number
  readonly fhv: number
  readonly escalaM: number
  readonly escalaC: number
}

function geometriaDoRetangular(hu: number, hv: number, borda: number): GeometriaDoRetangular {
  const fhu = hu - borda
  const fhv = hv - borda
  const mx = 0.42 * fhu
  const my = 0.62 * fhv
  const cx = 0.24 * fhu
  const cy = 0.36 * fhv
  return { hu, hv, borda, mx, my, cx, cy, fhu, fhv, escalaM: (mx * my) / Math.hypot(mx, my), escalaC: (cx * cy) / Math.hypot(cx, cy) }
}

/** O ruído de lã do tapete inteiro (o mesmo do protótipo). */
function ruidoDeLa(u: number, v: number): number {
  return ruido(u * 0.5 + 9, v * 0.5) * 0.08 + ruido(u * 0.12, v * 0.12 + 3) * 0.06 + Math.sin((u + v) * 2.6) * 0.012
}

/** O desenho do retangular: campo, cantos, medalhão, borda com o motivo e o fio claro. */
function texRetangular(t: CoresDoTapete, g: GeometriaDoRetangular, deitado: boolean): Textura {
  return (u, v, x, y, _p, s, S) => {
    const U = deitado ? x : y
    const V = deitado ? y : x
    pintarCampo(s, t.campo)
    const au = Math.abs(U)
    const av = Math.abs(V)
    const ateU = g.hu - au
    const ateV = g.hv - av
    const de = Math.min(ateU, ateV)
    const q = au / g.mx + av / g.my
    const dm = (q - 1) * g.escalaM
    const dc = ((g.fhu - au) / g.cx + (g.fhv - av) / g.cy - 1) * g.escalaC
    tingir(s, t.escuro, cobre(dc, S))
    tingir(s, t.claro, cobre(Math.abs(dc) - 0.45, S))
    tingir(s, t.escuro, cobre(dm, S))
    tingir(s, t.claro, cobre(Math.abs(dm) - 0.5, S))
    tingir(s, t.miolo, cobre((q / MIOLO_DO_MEDALHAO - 1) * g.escalaM * MIOLO_DO_MEDALHAO, S))
    const B = g.borda
    const kB = cobre(de - B, S)
    tingir(s, t.escuro, kB)
    if (kB > 0) {
      tingir(s, t.meio, cobre(Math.abs(de - B / 2) - MEIO_FIO_DO_MOTIVO, S) * kB)
      // No lado comprido o motivo corre ao longo do tapete; nas pontas, atravessado.
      const dl = distanciaAoMotivo(ateV <= ateU ? U : V, de - B / 2, B)
      tingir(s, t.claro, cobre(dl, S) * kB)
      tingir(s, t.escuro, cobre(dl + B * 0.12, S) * kB)
    }
    tingir(s, t.claro, cobre(Math.abs(de - B - 0.75) - 0.55, S))
    s[3] += ruidoDeLa(u, v)
  }
}

/** O miolo do medalhão em losango, em fração dele (o mesmo no retangular e no redondo). */
const MIOLO_DO_MEDALHAO = 0.42

/**
 * O desenho do redondo: a borda com o fio do meio, UM fio claro por dentro
 * dela e o medalhão em LOSANGO com o miolo, igual ao do retangular e ao do
 * desenho de linhas (`TAPETE_REDONDO` de `lib/mobilia.ts`: o losango a 0,6 do
 * raio de dentro). Revisão da MT3: com o medalhão redondo, o anel claro dele, o
 * miolo e o botão com aro no centro, o tapete lia como um alvo.
 */
function texRedondo(t: CoresDoTapete, hw: number, hh: number, borda: number, medalhao: number): Textura {
  const menor = Math.min(hw, hh)
  const mx = (hw - borda) * medalhao
  const my = (hh - borda) * medalhao
  const escalaM = (mx * my) / Math.hypot(mx, my)
  return (u, v, x, y, _p, s, S) => {
    pintarCampo(s, t.campo)
    const raio = Math.sqrt((x / hw) * (x / hw) + (y / hh) * (y / hh))
    const de = (1 - raio) * menor
    const q = Math.abs(x) / mx + Math.abs(y) / my
    const dm = (q - 1) * escalaM
    tingir(s, t.escuro, cobre(dm, S))
    tingir(s, t.claro, cobre(Math.abs(dm) - 0.5, S))
    tingir(s, t.miolo, cobre((q / MIOLO_DO_MEDALHAO - 1) * escalaM * MIOLO_DO_MEDALHAO, S))
    const kB = cobre(de - borda, S)
    tingir(s, t.escuro, kB)
    if (kB > 0) tingir(s, t.meio, cobre(Math.abs(de - borda / 2) - MEIO_FIO_DO_MOTIVO, S) * kB)
    tingir(s, t.claro, cobre(Math.abs(de - borda - 0.75) - 0.55, S))
    s[3] += ruidoDeLa(u, v)
  }
}

/** A faixa de lado: a borda escura nas pontas e um fio claro (`objetos.js:607-617`). */
function texDeLado(t: CoresDoTapete, hw: number, borda: number): Textura {
  return (u, v, x, _y, _p, s, S) => {
    const de = hw - Math.abs(x)
    pintarCampo(s, t.campo)
    tingir(s, t.escuro, cobre(de - borda, S))
    tingir(s, t.claro, cobre(Math.abs(de - borda - 0.7) - 0.5, S))
    s[3] += ruido(u * 0.5 + 9, v * 0.5) * 0.08 + ruido(u * 0.12, v * 0.12 + 3) * 0.05
  }
}

/** Fios da franja, de 1,6 px, saindo da ponta do corpo, cada um de um comprimento (`objetos.js:620-631`). */
const LARGURA_DO_FIO = 1.6

function texFranja(corpo: number, comprimento: number, lado: number, deitado: boolean): Textura {
  return (_u, _v, x, y, _p, s, S) => {
    const U = deitado ? x : y
    const V = deitado ? y : x
    const k = Math.floor(V / LARGURA_DO_FIO)
    const fv = V / LARGURA_DO_FIO - k
    let alfa = Math.min(1, Math.max(0, (0.6 - Math.abs(fv - 0.5)) * 4))
    const fora = Math.abs(U) - corpo
    const deste = comprimento * (0.72 + 0.28 * hash(k, lado, 515))
    alfa *= Math.min(1, Math.max(0, (deste - fora) * S + 0.5))
    s[5] = alfa
    s[3] += ruido(U * 0.3, k * 3.1) * 0.08 + (hash(k, lado, 516) - 0.5) * 0.08
  }
}

/** Frações do desenho de linhas (`TAPETE_DE_CIMA`, `TAPETE_REDONDO` e `TAPETE_DE_LADO` de `lib/mobilia.ts`). */
const FRANJA = 0.06
const BORDA = 0.12
const MEDALHAO_REDONDO = 0.6
const TOPO_DE_LADO = 0.6
const FRANJA_DE_LADO = 0.04
const BORDA_DE_LADO = 0.08
/** Sombra do tapete: quase rente ao chão. */
const SOMBRA_DO_TAPETE = { z: 1.5, forca: 0.22, suave: 1.2 } as const

function montarTapeteDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, w, h, peca: P } = c
  const cores = coresDoTapete(c.m.tecido.rgb)
  const retangular = c.forma === 'retangular'
  const fr = retangular ? FRANJA_DE_LADO * w : 0
  const topo = -hh + TOPO_DE_LADO * h
  const corpoHW = hw - fr
  sombraDeLado(cena, caixa(-corpoHW, topo, corpoHW, hh), 2)
  if (retangular) {
    for (const lado of [-1, 1]) {
      const forma = caixa(lado < 0 ? -hw : corpoHW - 1, hh - LARGURA_DO_FIO, lado < 0 ? -corpoHW + 1 : hw, hh, 0)
      cena.partes.push(P(forma, materialDaPeca('linho'), { textura: texFranja(corpoHW, fr, lado, true), bisel: 0, contorno: 0 }))
    }
  }
  cena.partes.push(P(caixa(-corpoHW, topo, corpoHW, hh, 0.8), c.m.tecido, { textura: texDeLado(cores, corpoHW, BORDA_DE_LADO * w), bisel: 0.9, contorno: 0.18 }))
}

export const montarTapete: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarTapeteDeLado(c, cena)
    return
  }
  const { hw, hh, w, h, peca: P } = c
  const tecido = c.m.tecido
  const cores = coresDoTapete(tecido.rgb)
  if (c.forma === 'redondo') {
    const corpo = elipse(0, 0, hw, hh)
    cena.sombras.push({ forma: corpo, ...SOMBRA_DO_TAPETE })
    const menor = Math.min(hw, hh)
    cena.partes.push(P(corpo, tecido, { textura: texRedondo(cores, hw, hh, 2 * menor * BORDA, MEDALHAO_REDONDO), bisel: 1.4, contorno: 0.16 }))
    return
  }
  // O comprimento corre no lado maior: deitado, U = x; em pé, U = y.
  const deitado = w >= h
  const hu = deitado ? hw : hh
  const hv = deitado ? hh : hw
  const lado = 2 * hv
  const fr = FRANJA * lado
  const corpoHU = hu - fr
  const noMundo = (u0: number, v0: number, u1: number, v1: number, raio: number) => (deitado ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio))
  const corpo = noMundo(-corpoHU, -hv, corpoHU, hv, 1.2)
  cena.sombras.push({ forma: corpo, ...SOMBRA_DO_TAPETE })
  for (const ponta of [-1, 1]) {
    const u0 = ponta < 0 ? -hu : corpoHU - 1
    const u1 = ponta < 0 ? -corpoHU + 1 : hu
    cena.partes.push(P(noMundo(u0, -hv + 1.5, u1, hv - 1.5, 0), materialDaPeca('linho'), { textura: texFranja(corpoHU, fr, ponta, deitado), bisel: 0, contorno: 0 }))
  }
  const borda = BORDA * Math.min(2 * corpoHU, lado)
  cena.partes.push(P(corpo, tecido, { textura: texRetangular(cores, geometriaDoRetangular(corpoHU, hv, borda), deitado), bisel: 1.4, contorno: 0.16 }))
}
