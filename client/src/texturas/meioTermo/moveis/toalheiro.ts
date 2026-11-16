/**
 * TOALHEIRO de pé (banheiro moderno, desenhista B, 15/11/2026; o mestre pediu "vários mais utensílios para banheiro"
 * no estilo moderno): a ESCADA DE TOALHAS de cromo encostada na parede, com os pés na frente e o alto apoiado atrás,
 * a TOALHA DE BANHO dobrada num degrau alto e a TOALHA DE ROSTO, branca com a barra da cor da outra, num degrau
 * mais baixo, na frente dela.
 *
 * DE CIMA a escada aparece como escada: os dois banzos de cromo correndo da frente para trás e os degraus de través,
 * cada vez mais altos para o fundo; as toalhas atravessam a escada, a dobra clara em cima do degrau e as duas abas
 * abrindo para os lados, e a sombra comprida delas cai no chão. A 25% de zoom sobram as duas faixas de pano entre os
 * riscos de cromo: é o que diz "toalheiro" e não "estante" nem "varal".
 *
 * NA 3/4 tudo é desenhado em fatias (`pilhaDeFatias.ts`): os banzos subindo inclinados, os degraus, as tampinhas no
 * alto e os pés de borracha; as toalhas caem do degrau inteiras, com a felpa, as dobras abrindo para a barra e as
 * duas listras da barra; a de rosto, na frente, cobre a barra da de banho, e os degraus de baixo passam na frente da
 * de banho. Girada de lado, a escada fica de perfil (os banzos inclinados e as toalhas de canto).
 *
 * As medidas saem da pegada (1 x 0,5 casa de partida); a escada esticada ganha largura, as toalhas acompanham. O
 * perfil da 3/4 tem de ser `{ modo: 'derivado', espessura: 0 }`. Material: `toalha` (a de banho e a barra da de
 * rosto); o cromo e o branco da de rosto são fixos. Escreve `cena.corDoPiso` (o escuro do metal).
 */
import type { Rgb } from '../../ruido'
import { capsula, caixa, elipse, poligono, uniao, type Forma } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, luzDoCilindro, luzDoDeitado, naTela, novoFatiador, rumoDaSombra, type Fatiador } from './pilhaDeFatias'
import { CROMO, ESCURO_DO_METAL, GRAFITE, tingir } from './tonsDoBanheiroModerno'

/** A altura da escada em casas (o alto dos banzos). */
const ALTURA = 1.25
/** Os banzos: quanto ficam das pontas da pegada, o pé (da frente) e o alto (do fundo), em px do protótipo, e o raio. */
const BANZO = { daPonta: 4, peDaFrente: 3, altoDoFundo: 2.5, raio: 1 } as const
/** Os degraus: as alturas (frações da altura) e o raio (px). */
const DEGRAUS = [0.17, 0.4, 0.62, 0.84, 0.985] as const
const RAIO_DO_DEGRAU = 0.75
/** O passo das fatias (px) e o mais fino, das peças finas. */
const PASSO = 0.6
const PASSO_FINO = 0.3

/**
 * Uma toalha: o degrau em que está (índice em `DEGRAUS`), de onde a onde vai na largura (frações da meia distância
 * entre os banzos), quanto desce do degrau (px), se é a de rosto (branca, com a barra da cor da toalha).
 */
interface Toalha {
  readonly degrau: number
  readonly de: number
  readonly ate: number
  readonly desce: number
  readonly deRosto: boolean
}
const TOALHAS: readonly Toalha[] = [
  { degrau: 2, de: -0.7, ate: 0.78, desce: 29, deRosto: false },
  { degrau: 1, de: -0.86, ate: 0.32, desce: 16, deRosto: true },
]
/** A grossura de cada aba (px), quanto a aba da frente e a de trás abrem até a barra (px) e a quina arredondada. */
const GROSSURA = 1.1
const ABRE_NA_FRENTE = 2.6
const ABRE_ATRAS = 1.7
const QUINA = 0.6
/** O branco da toalha de rosto e a barra dela: as duas listras e a bainha (px a partir da barra). */
const BRANCO: Rgb = [0xe9, 0xe5, 0xda]
const LISTRAS = [{ de: 1.6, ate: 2.4 }, { de: 3.1, ate: 3.6 }] as const
const BAINHA = 0.7

/** O reflexo do cromo na frente e o brilho (do motor) do alto das tampinhas. */
const REFLEXO = 0.3

function suave01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

export const montarToalheiro: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const H = g * ALTURA
  const xb = hw - BANZO.daPonta
  const yPe = hh - BANZO.peDaFrente
  const yAlto = -hh + BANZO.altoDoFundo
  /** O y do banzo na altura z: ele se inclina para o fundo. */
  const yNa = (z: number): number => yPe + ((yAlto - yPe) * z) / H
  cena.corDoPiso = ESCURO_DO_METAL

  // As sombras no chão: o risco de cada banzo, o de cada degrau e o pano das toalhas.
  const [rx, ry] = rumoDaSombra(q)
  for (const lado of [-1, 1]) {
    cena.sombras.push({ forma: capsula(lado * xb, yPe, lado * xb + rx * H, yAlto + ry * H, BANZO.raio), z: 0, forca: 0.2, suave: 1.3 })
    cena.sombras.push(contato(elipse(lado * xb, yPe, 1.8, 1.2), 0.3))
  }
  for (const fr of DEGRAUS) {
    const z = fr * H
    const y = yNa(z)
    cena.sombras.push({ forma: capsula(-xb + rx * z, y + ry * z, xb + rx * z, y + ry * z, RAIO_DO_DEGRAU), z: 0, forca: 0.16, suave: 1.4 })
  }
  for (const t of TOALHAS) {
    const z1 = DEGRAUS[t.degrau] * H
    const z0 = z1 - t.desce
    const y = yNa(z1)
    const xa = t.de * xb
    const xz = t.ate * xb
    cena.sombras.push({ forma: poligono([[xa + rx * z0, y + ry * z0], [xz + rx * z0, y + ry * z0], [xz + rx * z1, y + ry * z1], [xa + rx * z1, y + ry * z1]]), z: 0, forca: 0.2, suave: 2.2 })
  }

  banzos(f, xb, H, yNa)
  degraus(f, xb, H, yNa)
  TOALHAS.forEach((t, i) => toalha(f, t, i, xb, H, yNa, c.m.toalha))
  f.fechar()
}

/** Os dois banzos inclinados, com o pé de borracha embaixo e a tampinha no alto. */
function banzos(f: Fatiador, xb: number, H: number, yNa: (z: number) => number): void {
  const r = BANZO.raio
  for (const lado of [-1, 1]) {
    const x = lado * xb
    for (const z of alturas(0, H, PASSO)) {
      const y = yNa(z)
      const topo = z >= H - 1e-6
      const noPe = z < 1.4
      const xDoEixo = naTela(x, y, f.q)[0]
      const textura: Textura = (_u, _v, px, py, _p, s) => {
        s[3] += luzDoCilindro((naTela(px, py, f.q)[0] - xDoEixo) / r, noPe ? 0.05 : REFLEXO)
      }
      f.fatia(0, z, elipse(x, y, noPe ? r * 1.15 : r, noPe ? r * 1.15 : r), noPe ? GRAFITE : CROMO, topo ? { tabua: 0, bisel: r * 0.9, contorno: 0.22, metal: 0.6, semente: 5300 } : { tabua: 0, bisel: 0, contorno: 0, tom: 0.92, textura, semente: 5301 })
    }
  }
}

/** Os degraus: cilindros deitados de banzo a banzo, cada fatia a faixa deles naquela altura. */
function degraus(f: Fatiador, xb: number, H: number, yNa: (z: number) => number): void {
  const r = RAIO_DO_DEGRAU
  for (const fr of DEGRAUS) {
    const zd = fr * H
    const y = yNa(zd)
    for (const z of alturas(zd - r, zd + r, PASSO_FINO)) {
      const meia = Math.sqrt(Math.max(0, r * r - (z - zd) ** 2))
      if (meia < 0.12) continue
      const t = (z - zd) / r
      const textura: Textura = (_u, _v, _x, _y, _p, s) => {
        s[3] += luzDoDeitado(t, REFLEXO)
      }
      f.fatia(0, z, caixa(-xb, y - meia, xb, y + meia, Math.min(meia, 0.3)), CROMO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.95, metal: 0.25, textura, semente: 5310 })
    }
  }
}

/**
 * Uma toalha dobrada no degrau: a dobra em cima dele (a fatia é a faixa da dobra) e, abaixo, as duas abas (a da
 * frente e a de trás), abrindo um pouco para a barra. A frente na 3/4 é a aba da frente, fatia a fatia.
 */
function toalha(f: Fatiador, t: Toalha, i: number, xb: number, H: number, yNa: (z: number) => number, pano: MaterialDaPeca): void {
  const zd = DEGRAUS[t.degrau] * H
  const y = yNa(zd)
  const xa = t.de * xb
  const xz = t.ate * xb
  const meiaLargura = (xz - xa) / 2
  const meio = (xa + xz) / 2
  const dentro = RAIO_DO_DEGRAU + 0.15
  const fora = dentro + GROSSURA
  const z0 = zd - t.desce
  const mat: MaterialDaPeca = t.deRosto ? { classe: 'tecido', fio: 'la', rgb: BRANCO } : pano
  const sem = 5320 + i * 7
  const meioNaTela = naTela(meio, y, f.q)[0]
  const meiaNaTela = f.q % 2 === 0 ? meiaLargura : fora + ABRE_NA_FRENTE

  /** A felpa, as dobras abrindo para a barra, a luz NA TELA, as beiras e (na de rosto) a barra listrada. */
  const pano_ = (z: number, alto: number): Textura => (_u, _v, x, yy, _p, s) => {
    const baixo = suave01((zd - z) / t.desce)
    const dobra = Math.sin((x - xa) * 0.42 + ruido(x * 0.06 + sem, z * 0.03) * 3) * (0.025 + 0.07 * baixo)
    const felpa = ruido(x * 0.55 + sem, z * 0.55 + yy * 0.5) * 0.07 + ruido(x * 0.15, z * 0.12 + sem) * 0.05
    const tela = (naTela(x, yy, f.q)[0] - meioNaTela) / meiaNaTela
    const beira = -0.2 * suave01((Math.abs(x - meio) - (meiaLargura - 1.2)) / 1.2)
    s[3] += felpa + dobra - 0.06 * tela + beira + alto
    if (!t.deRosto) return
    const daBarra = z - z0
    if (daBarra < BAINHA) s[3] -= 0.08
    for (const l of LISTRAS) if (daBarra >= l.de && daBarra < l.ate) tingir(s, pano.rgb, 0.85)
  }

  // As abas, da barra até o degrau.
  for (const z of alturas(z0, zd, PASSO)) {
    const s = ((zd - z) / t.desce) ** 1.5
    const frente = caixa(xa, y + dentro + ABRE_NA_FRENTE * s, xz, y + fora + ABRE_NA_FRENTE * s, QUINA)
    const atras = caixa(xa, y - fora - ABRE_ATRAS * s, xz, y - dentro - ABRE_ATRAS * s, QUINA)
    f.fatia(0, z, uniao(atras, frente), mat, { tabua: 0, bisel: 0, contorno: 0, tom: z < z0 + 0.5 ? 0.8 : 0.9, textura: pano_(z, 0), semente: sem })
  }
  // A dobra em cima do degrau: a faixa estreita até o alto, de luz de cima.
  for (const z of alturas(zd + PASSO_FINO, zd + fora, PASSO_FINO)) {
    const meia = fora * Math.sqrt(Math.max(0, 1 - ((z - zd) / fora) ** 2))
    if (meia < 0.2) continue
    const forma: Forma = caixa(xa, y - meia, xz, y + meia, Math.min(meia, QUINA))
    const alto = luzDoDeitado((z - zd) / fora, 0) + 0.04
    const topo = z >= zd + fora - PASSO_FINO - 1e-6
    f.fatia(0, z, forma, mat, { tabua: 0, bisel: topo ? 0.6 : 0, contorno: topo ? 0.16 : 0, tom: 0.98, textura: pano_(z, alto), semente: sem + 1 })
  }
}
