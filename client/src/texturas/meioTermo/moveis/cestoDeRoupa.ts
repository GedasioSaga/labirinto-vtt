/**
 * CESTO DE ROUPA SUJA com tampa (banheiro moderno, desenhista B, 15/11/2026; o mestre pediu "vários mais utensílios
 * para banheiro" no estilo moderno). O cesto redondo de corda trançada, um nada mais largo em cima, com a tampa de
 * beira debruada e a alça de couro no meio; a manga de uma camisa escapa por baixo da tampa e cai pela frente, e a
 * ponta de uma toalha branca aparece atrás, do outro lado.
 *
 * DE CIMA aparece a TAMPA: a trama em anéis em volta da alça de couro, a beira debruada mais escura e, fora dela, a
 * manga da camisa e a ponta da toalha saindo do cesto. A 25% de zoom sobram o disco claro com o ponto escuro no meio
 * e as duas pontas de pano: é o que diz "cesto de roupa" e não "lixeira" (o inox) nem "cesto de vime" (aberto).
 *
 * NA 3/4 o cesto é desenhado em fatias (`pilhaDeFatias.ts`): a trama de corda em fileiras desencontradas que fogem
 * nas beiras (o cilindro), a sombra do lado direito, a tampa debruada por cima e, na frente, a manga caindo do
 * debrum até o meio do cesto, com o punho. Girado, a manga e a toalha vão com o cesto: de costas, a manga some atrás
 * dele e a ponta da toalha passa para a frente.
 *
 * O perfil da 3/4 tem de ser `{ modo: 'derivado', espessura: 0 }`. Materiais: `trama` (a cor da corda do cesto e da
 * tampa; o fio do tecido não aparece, a trama é desenhada) e `roupa` (a camisa).
 */
import type { Rgb } from '../../ruido'
import { capsula, elipse, poligono } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, luzDoCilindro, naTela, novoFatiador, sombraDoCilindro, type Fatiador } from './pilhaDeFatias'

/** A altura do cesto (o debrum de cima) em casas, a grossura da tampa (px) e os raios (fração do menor meio lado). */
const ALTURA = 0.55
const TAMPA = 1.5
const RAIO_EM_CIMA = 0.8
const RAIO_EMBAIXO = 0.72
/** Quanto a tampa passa do cesto e o debrum dele (px). */
const ABA_DA_TAMPA = 0.8
const DEBRUM = 1.6
/** A trama: a altura de cada fileira de corda e o passo das voltas ao longo da roda (px). */
const FILEIRA = 2
const VOLTA = 2.4
/** O passo das fatias (px). */
const PASSO = 0.5

/** A manga: o ângulo (no cesto, de +x para +y), o quanto desce do debrum, a largura, o punho (px) e a ponta da toalha. */
const MANGA = { angulo: 1.05, desce: 13, larga: 3.8, punho: 1.8 } as const
const TOALHA = { angulo: -2.35, desce: 5, larga: 5.5 } as const

/** O couro da alça e o branco da toalha. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x4b, 0x34] }
const BRANCO: Rgb = [0xe9, 0xe5, 0xda]

/** Abaixo desta escala (pixels por px do protótipo) a trama vira chuvisco: fica um terço dela. */
const ESCALA_DO_RISCO = 1.5

function suave01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

export const montarCestoDeRoupa: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const menor = Math.min(hw, hh)
  const R = menor * RAIO_EM_CIMA
  const R0 = menor * RAIO_EMBAIXO
  const H = g * ALTURA
  const raioNa = (z: number): number => R0 + ((R - R0) * z) / H
  const xDoEixo = naTela(0, 0, q)[0]
  // A trama sem o fio do tecido: a cor do lugar, desenhada aqui.
  const corda: MaterialDaPeca = { classe: 'liso', rgb: c.m.trama.rgb }

  cena.sombras.push(sombraDoCilindro(0, 0, R, H + TAMPA, q, 0.22, 1.6), contato(elipse(0, 0, R0, R0), 0.3))

  /** A trama de corda na frente, na altura z: fileiras desencontradas, voltas que fogem na beira, a luz do cilindro. */
  const trama = (z: number, r: number): Textura => (_u, _v, x, y, _p, s, escala) => {
    const t = (naTela(x, y, q)[0] - xDoEixo) / r
    const arco = Math.asin(t < -1 ? -1 : t > 1 ? 1 : t) * r
    const fileira = Math.floor(z / FILEIRA)
    const fz = z / FILEIRA - fileira
    const u = arco / VOLTA + (fileira % 2 === 0 ? 0 : 0.5)
    const miudo = escala < ESCALA_DO_RISCO ? 0.33 : 1
    const corda_ = 0.07 * Math.sin(Math.PI * fz) + 0.05 * Math.cos(2 * Math.PI * u) - (fz < 0.14 || fz > 0.86 ? 0.07 : 0)
    s[3] += luzDoCilindro(t, 0.04) + corda_ * miudo + ruido(arco * 0.7, z * 0.5) * 0.03
  }

  // O CESTO: a trama de baixo até o debrum; o debrum é a corda mais escura, mais grossa.
  for (const z of alturas(0, H, PASSO)) {
    const r = raioNa(z)
    const noDebrum = z > H - DEBRUM
    f.fatia(0, z, elipse(0, 0, r, r), corda, { tabua: 0, bisel: 0, contorno: 0, tom: noDebrum ? 0.74 : 0.9, textura: trama(z, r), semente: 5501 })
  }
  manga(f, c.m.roupa, raioNa, H)
  pontaDaToalha(f, raioNa, H)

  // A TAMPA, depois de tudo o que passa por baixo dela: a beira debruada e o alto com a trama em anéis.
  const Rt = R + ABA_DA_TAMPA
  for (const z of alturas(H, H + TAMPA, PASSO)) {
    const topo = z >= H + TAMPA - 1e-6
    if (topo) {
      const aneis: Textura = (_u, _v, x, y, _p, s, escala) => {
        const raio = Math.hypot(x, y)
        const miudo = escala < ESCALA_DO_RISCO ? 0.33 : 1
        s[3] += (0.06 * Math.sin((2 * Math.PI * raio) / FILEIRA) + 0.03 * Math.cos(Math.atan2(y, x) * Math.round((2 * Math.PI * raio) / VOLTA))) * miudo
        if (raio > Rt - DEBRUM) s[3] -= 0.16
      }
      f.fatia(1, z, elipse(0, 0, Rt - 0.4, Rt - 0.4), corda, { tabua: 0, bisel: Rt * 0.16, contorno: 0.22, textura: aneis, semente: 5502 })
    } else f.fatia(1, z, elipse(0, 0, Rt, Rt), corda, { tabua: 0, bisel: 0, contorno: 0, tom: 0.72, textura: trama(z, Rt), semente: 5503 })
  }
  // A alça de couro no meio da tampa: a presilha deitada e a dobra dela.
  for (const z of alturas(H + TAMPA, H + TAMPA + 1.2, PASSO)) {
    const topo = z >= H + TAMPA + 1.2 - 1e-6
    f.fatia(2, z, capsula(-1.8, 0, 1.8, 0, 1.1), COURO, topo ? { tabua: 0, bisel: 0.8, contorno: 0.24, semente: 5504 } : { tabua: 0, bisel: 0, contorno: 0, tom: 0.75, semente: 5505 })
  }
  f.fechar()
}

/** A manga da camisa saindo por baixo da tampa: sobe pela beira, passa o debrum e cai pela frente até o punho. */
function manga(f: Fatiador, roupa: MaterialDaPeca, raioNa: (z: number) => number, H: number): void {
  const z0 = H - MANGA.desce
  const pano: MaterialDaPeca = { classe: 'liso', rgb: roupa.rgb }
  for (const z of alturas(z0, H - 0.2, PASSO)) {
    const caida = (H - z) / MANGA.desce
    // No alto a manga sai do cesto por cima do debrum; embaixo encosta na trama e vira um nada para o lado.
    const fora = 0.7 + 1.6 * suave01((z - (H - 3)) / 3)
    const ang = MANGA.angulo + 0.07 * caida
    const r = raioNa(z) + fora
    const cx = r * Math.cos(ang)
    const cy = r * Math.sin(ang)
    const tx = -Math.sin(ang)
    const ty = Math.cos(ang)
    const meia = (MANGA.larga - 0.6 * caida) / 2
    const noPunho = z < z0 + MANGA.punho
    const meioNaTela = naTela(cx, cy, f.q)[0]
    const dobras: Textura = (_u, _v, x, y, _p, s) => {
      const t = (naTela(x, y, f.q)[0] - meioNaTela) / meia
      s[3] += -0.1 * t - 0.16 * suave01((Math.abs(t) - 0.6) / 0.4) + ruido(x * 0.6, z * 0.35) * 0.05 + (Math.abs(z - (z0 + MANGA.punho)) < 0.3 ? -0.12 : 0)
    }
    f.fatia(0, z, capsula(cx - tx * meia, cy - ty * meia, cx + tx * meia, cy + ty * meia, 0.65), pano, { tabua: 0, bisel: 0, contorno: 0, tom: noPunho ? 0.86 : 0.95, textura: dobras, semente: 5510 })
  }
}

/** A ponta da toalha branca saindo atrás, do outro lado: o triângulo de pano caindo por cima do debrum. */
function pontaDaToalha(f: Fatiador, raioNa: (z: number) => number, H: number): void {
  const pano: MaterialDaPeca = { classe: 'liso', rgb: BRANCO }
  const z0 = H - TOALHA.desce
  for (const z of alturas(z0, H - 0.2, PASSO)) {
    const k = (z - z0) / TOALHA.desce
    const fora = 0.6 + 1.4 * suave01((z - (H - 2.5)) / 2.5)
    const r = raioNa(z) + fora
    const ang = TOALHA.angulo
    const cx = r * Math.cos(ang)
    const cy = r * Math.sin(ang)
    const tx = -Math.sin(ang)
    const ty = Math.cos(ang)
    const meia = Math.max(0.3, (TOALHA.larga * k) / 2)
    const nx = Math.cos(ang) * 0.55
    const ny = Math.sin(ang) * 0.55
    const forma = poligono([[cx - tx * meia - nx, cy - ty * meia - ny], [cx + tx * meia - nx, cy + ty * meia - ny], [cx + tx * meia + nx, cy + ty * meia + ny], [cx - tx * meia + nx, cy - ty * meia + ny]])
    const felpa: Textura = (_u, _v, x, y, _p, s) => {
      s[3] += ruido(x * 0.9, z * 0.8 + y * 0.5) * 0.06
    }
    f.fatia(0, z, forma, pano, { tabua: 0, bisel: 0, contorno: 0, tom: 0.92, textura: felpa, semente: 5520 })
  }
}
