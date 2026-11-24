/**
 * TAPETE de cima com volume (`objetos.js:556-631` e `:1505-1544`), sempre no
 * chão (quem o põe por baixo dos outros móveis é a ordem de desenho de
 * `lib/mobilia.ts`, `emOrdemDeDesenho`, e o contêiner do chão do editor).
 *
 * - Retangular: o desenho "Medalhão com haste" (`tapeteComHaste.ts`, o mesmo
 *   do tapete longo): moldura e franja fixas, um medalhão no centro e, quando
 *   o tapete é comprido o bastante, a haste e as duas pontas.
 * - Redondo: a borda e o medalhão em volta do centro, sem franja.
 * - De Lado: a faixa deitada no chão, a borda escura nas pontas e a franja (só
 *   o retangular).
 *
 * Material: `tecido` (a borda e o medalhão saem do mesmo tecido, mais escuros,
 * com o fio puxado para o creme).
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, elipse } from './formas'
import { ruido, type Cena, type Textura } from './motor'
import { materialDaPeca, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'
import { montarTapeteComHaste, SOMBRA_DO_TAPETE } from './tapeteComHaste'

export { SOMBRA_DO_TAPETE }

/** O creme do fio claro (`objetos.js:329`). */
const CREME: Rgb = [232, 223, 202]

export interface CoresDoTapete {
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
export function coresDoTapete(base: Rgb): CoresDoTapete {
  return { campo: base, escuro: escalar(base, 0.7), meio: escalar(base, 0.8), claro: misturar(base, CREME, 0.38), miolo: misturar(base, CREME, 0.2) }
}

/** Quanto um pixel de lado 1/S está dentro de uma área a `dist` px da borda (negativo dentro): borda suave sem supersample. */
export function cobre(dist: number, S: number): number {
  const k = 0.5 - dist * S
  return k <= 0 ? 0 : k >= 1 ? 1 : k
}

/** Puxa a cor do ponto para `c` em `k`. */
export function tingir(s: Float32Array, c: Rgb, k: number): void {
  if (k <= 0) return
  s[0] += (c[0] - s[0]) * k
  s[1] += (c[1] - s[1]) * k
  s[2] += (c[2] - s[2]) * k
}

export function pintarCampo(s: Float32Array, c: Rgb): void {
  s[0] = c[0]
  s[1] = c[1]
  s[2] = c[2]
}

/** Fio de 0,5 px do contorno do losango e o ponto escuro do meio dele. */
export const MEIO_FIO_DO_MOTIVO = 0.45

/** O ruído de lã do tapete inteiro (o mesmo do protótipo). */
export function ruidoDeLa(u: number, v: number): number {
  return ruido(u * 0.5 + 9, v * 0.5) * 0.08 + ruido(u * 0.12, v * 0.12 + 3) * 0.06 + Math.sin((u + v) * 2.6) * 0.012
}

/** O miolo do medalhão em losango, em fração dele (o mesmo no retangular e no redondo). */
export const MIOLO_DO_MEDALHAO = 0.42

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
export const LARGURA_DO_FIO = 1.6

export function texFranja(corpo: number, comprimento: number, lado: number, deitado: boolean): Textura {
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

/** Frações do desenho de linhas (`TAPETE_REDONDO` e `TAPETE_DE_LADO` de `lib/mobilia.ts`). */
const BORDA = 0.12
const MEDALHAO_REDONDO = 0.6
const TOPO_DE_LADO = 0.6
const FRANJA_DE_LADO = 0.04
const BORDA_DE_LADO = 0.08

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
  if (c.forma !== 'redondo') {
    montarTapeteComHaste(c, cena)
    return
  }
  const { hw, hh, peca: P } = c
  const tecido = c.m.tecido
  const corpo = elipse(0, 0, hw, hh)
  cena.sombras.push({ forma: corpo, ...SOMBRA_DO_TAPETE })
  const menor = Math.min(hw, hh)
  cena.partes.push(P(corpo, tecido, { textura: texRedondo(coresDoTapete(tecido.rgb), hw, hh, 2 * menor * BORDA, MEDALHAO_REDONDO), bisel: 1.4, contorno: 0.16 }))
}
