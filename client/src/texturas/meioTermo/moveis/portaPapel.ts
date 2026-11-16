/**
 * SUPORTE DE PAPEL HIGIÊNICO de pé (banheiro moderno, desenhista B, 15/11/2026; o mestre pediu "vários mais
 * utensílios para banheiro" no estilo moderno). O pedestal de cromo: a base redonda, a haste com os dois rolos de
 * reserva enfiados nela e o bico redondo no alto, e o braço com o rolo em uso deitado, a ponta do papel caindo pela
 * frente.
 *
 * DE CIMA aparecem a base de cromo, o rolo de reserva de cima visto pela boca (o anel branco com a beira de papelão
 * do tubo e o bico da haste no meio), o braço de cromo e o rolo em uso deitado, com a luz do cilindro de través. A 25%
 * de zoom sobram o anel branco com o miolo e o retângulo branco ao lado: é o que diz "papel higiênico".
 *
 * NA 3/4 tudo é desenhado em fatias (`pilhaDeFatias.ts`): a base abaulada, os dois rolos de pé com o vinco entre
 * eles, a haste e o bico subindo acima deles, o rolo deitado no braço com a luz de cima e a ponta do papel caindo na
 * frente dele, com o picote. Girado, o braço vai para onde o giro o leva; com a ponta do rolo virada para quem olha
 * aparece a boca dele, com o tubo de papelão e o braço no meio.
 *
 * O perfil da 3/4 tem de ser `{ modo: 'derivado', espessura: 0 }`. Sem material escolhido: o cromo, o papel e o
 * papelão são fixos. Escreve `cena.corDoPiso` (o escuro do metal).
 */
import { caixa, elipse, menos, type Forma } from './formas'
import { contato, ruido, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, luzDoCilindro, luzDoDeitado, naTela, novoFatiador, sombraDoCilindro, sombraNoAr, type Fatiador, type OpcoesDaFatia } from './pilhaDeFatias'
import { CROMO, ESCURO_DO_METAL, PAPEL, PAPELAO, tingir } from './tonsDoBanheiroModerno'

/** O desenho foi medido com meia casa de lado (14 px de meio lado): as medidas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 14
/** A base: o raio (px) e a grossura (px). */
const BASE = { raio: 10.5, alta: 1.3 } as const
/** A haste: onde fica (px a partir do meio), o raio e a altura do bico (px); o bico é uma bola. */
const HASTE = { x: -4.5, y: -1, raio: 0.75, alta: 28.5, bico: 1.35 } as const
/** O rolo: o raio, o comprimento (a altura, de pé), o raio do furo e a grossura do papelão (px). */
const ROLO = { raio: 4.6, comprido: 7.2, furo: 1.75, papelao: 0.45 } as const
/** Quantos rolos de reserva na haste. */
const RESERVAS = 2
/** O braço: a altura, o raio e quanto passa da ponta do rolo (px); o rolo em uso começa este tanto depois da haste. */
const BRACO = { z: 22, raio: 0.6, passa: 1.1, folga: 1.2 } as const
/** A ponta do papel: quanto desce do braço e quanto recua das pontas do rolo (px). */
const PONTA = { desce: 10, recuo: 0.4, grossa: 0.75 } as const
/** O passo das fatias (px) e o passo mais fino das peças finas (o braço, a base). */
const PASSO = 0.5
const PASSO_FINO = 0.25

/** O reflexo do cromo na frente e o brilho (do motor) do que se vê de cima. */
const REFLEXO_DO_CROMO = 0.3
const BRILHO_DO_CROMO = 0.6

/** O papel enrolado visto de cima: anéis de camada bem leves em volta do meio. */
function texDasCamadas(cx: number, cy: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const r = Math.hypot(x - cx, y - cy)
    s[3] += Math.sin(r * 2.7) * 0.022 + ruido(x * 0.5, y * 0.5) * 0.03
  }
}

export const montarPortaPapel: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const k = Math.min(hw, hh) / MEIO_LADO_DE_PARTIDA
  cena.corDoPiso = ESCURO_DO_METAL
  const xh = HASTE.x * k
  const yh = HASTE.y * k
  const R = ROLO.raio * k
  const hRolo = ROLO.comprido * k
  const zBase = BASE.alta * k
  const zReservas = zBase + RESERVAS * hRolo
  const zBraco = Math.max(BRACO.z * k, zReservas + R + 1)
  const zHaste = Math.max(HASTE.alta * k, zBraco + R + 1.5)
  const x0Rolo = xh + R * 0.55 + BRACO.folga * k
  const x1Rolo = x0Rolo + hRolo
  const x1Braco = x1Rolo + BRACO.passa * k

  // As sombras no chão: a base, a pilha de reservas, a haste e o rolo em uso (no ar, afastado pela altura do braço).
  const rBase = BASE.raio * k
  cena.sombras.push(
    contato(elipse(0, 0, rBase, rBase), 0.3),
    sombraDoCilindro(xh, yh, R, zReservas, q, 0.22, 1.4),
    sombraDoCilindro(xh, yh, HASTE.raio * k, zHaste, q, 0.2, 1.2),
    sombraNoAr(caixa(x0Rolo, yh - R, x1Rolo, yh + R, R * 0.8), zBraco, q, 0.2, 2.2),
  )

  const xNaTela = (x: number, y: number): number => naTela(x, y, q)[0]
  const cromo = (cx: number, cy: number, r: number): OpcoesDaFatia => ({
    tabua: 0, bisel: 0, contorno: 0, tom: 0.92,
    textura: (_u, _v, x, y, _p, s) => {
      s[3] += luzDoCilindro((xNaTela(x, y) - xNaTela(cx, cy)) / r, REFLEXO_DO_CROMO)
    },
    semente: 5201,
  })

  // A BASE abaulada de cromo, sempre antes de tudo na 3/4 (é o chão de tudo).
  for (const z of alturas(0, zBase, PASSO_FINO)) {
    const topo = z >= zBase - 1e-6
    const r = rBase - (z / zBase) ** 2 * 0.9
    f.fatia(-1, z, elipse(0, 0, r, r), CROMO, topo ? { tabua: 0, bisel: rBase * 0.22, contorno: 0.24, metal: 0.4, semente: 5200 } : cromo(0, 0, r))
  }

  // A HASTE, do alto da base ao bico (a bola no alto).
  const rh = HASTE.raio * k
  const bico = HASTE.bico * k
  for (const z of alturas(zBase, zHaste + bico, PASSO)) {
    const noBico = z > zHaste - bico
    const r = noBico ? Math.sqrt(Math.max(0, bico * bico - (z - zHaste) ** 2)) : rh
    if (r < 0.15) continue
    const topo = z >= zHaste + bico - 1e-6 || (noBico && z + PASSO > zHaste + bico - 0.2)
    f.fatia(0, z, elipse(xh, yh, r, r), CROMO, topo ? { tabua: 0, bisel: r * 0.8, contorno: 0.22, metal: BRILHO_DO_CROMO, semente: 5202 } : cromo(xh, yh, Math.max(r, rh)))
  }

  rolosDeReserva(f, xh, yh, R, ROLO.furo * k, ROLO.papelao * k, zBase, hRolo)
  roloNoBraco(f, xh, yh, R, ROLO.furo * k, ROLO.papelao * k, BRACO.raio * k, x0Rolo, x1Rolo, x1Braco, zBraco, xNaTela)
  pontaDoPapel(f, yh + R, x0Rolo + PONTA.recuo * k, x1Rolo - PONTA.recuo * k, zBraco, PONTA.desce * k, PONTA.grossa * k, xNaTela)
  f.fechar()
}

/** O vinco entre dois rolos e a beira redonda de cada um (px): o papel arredonda nas pontas do rolo. */
const VINCO = 0.55
const BEIRA_DO_ROLO = 0.4

/** Os rolos de reserva de pé, enfiados na haste: o anel de papel, o vinco entre eles e a boca do de cima. */
function rolosDeReserva(f: Fatiador, cx: number, cy: number, R: number, furo: number, papelao: number, z0: number, h: number): void {
  const zTopo = z0 + RESERVAS * h
  const xDoEixo = naTela(cx, cy, f.q)[0]
  for (const z of alturas(z0, zTopo, PASSO)) {
    const local = (z - z0) % h
    const ate = Math.min(local, h - local, z - z0, zTopo - z)
    const r = R - (ate < BEIRA_DO_ROLO ? BEIRA_DO_ROLO - ate : 0)
    const vinco = Math.min(local, h - local) < VINCO && z > z0 + 0.1 && z < zTopo - 0.1
    const anel = menos(elipse(cx, cy, r, r), elipse(cx, cy, furo, furo))
    if (z >= zTopo - 1e-6) {
      f.fatia(0, z, anel, PAPEL, { tabua: 0, bisel: 0.9, contorno: 0.2, textura: texDasCamadas(cx, cy), semente: 5210 })
      continue
    }
    const textura: Textura = (_u, _v, x, y, _p, s) => {
      s[3] += luzDoCilindro((naTela(x, y, f.q)[0] - xDoEixo) / R, 0) + (vinco ? -0.2 : 0) + ruido(x * 0.4, z * 0.3) * 0.02
    }
    f.fatia(0, z, anel, PAPEL, { tabua: 0, bisel: 0, contorno: 0, tom: 0.92, textura, semente: 5211 })
  }
  // A beira de papelão do tubo, na boca do rolo de cima, e o fundo escuro do tubo.
  f.fatia(0, zTopo - 0.15, menos(elipse(cx, cy, furo + papelao, furo + papelao), elipse(cx, cy, furo, furo)), PAPELAO, { tabua: 0, bisel: 0.3, contorno: 0.2, semente: 5212 })
  f.fatia(0, zTopo - 2.5, elipse(cx, cy, furo, furo), PAPELAO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.55, semente: 5213 })
}

/** A cor do miolo do rolo (o tubo de papelão por dentro, na sombra) e o do papelão na boca. */
const FUNDO_DO_TUBO: readonly [number, number, number] = [0x6e, 0x5c, 0x46]

/**
 * O rolo em uso, deitado no braço (o eixo corre em x), e o braço de cromo: cada fatia é a faixa do rolo naquela
 * altura. Com a ponta do rolo virada para quem olha (o giro de um quarto de volta), a boca aparece na frente: o anel
 * de papelão, o tubo escuro e o braço no meio.
 */
function roloNoBraco(
  f: Fatiador, xh: number, cy: number, R: number, furo: number, papelao: number, rb: number,
  x0: number, x1: number, x1Braco: number, zb: number, xNaTela: (x: number, y: number) => number,
): void {
  const pontaNaFrente = f.q % 2 === 1
  const xDoEixoNaTela = (x: number): number => naTela(x, cy, f.q)[0]
  // O braço: um cilindro deitado fino, da haste até passar da ponta do rolo.
  for (const z of alturas(zb - rb, zb + rb, PASSO_FINO)) {
    const meia = Math.sqrt(Math.max(0, rb * rb - (z - zb) ** 2))
    if (meia < 0.1) continue
    const textura: Textura = (_u, _v, _x, _y, _p, s) => {
      s[3] += luzDoDeitado((z - zb) / rb, REFLEXO_DO_CROMO)
    }
    f.fatia(0, z, caixa(xh, cy - meia, x1Braco, cy + meia, Math.min(meia, 0.4)), CROMO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.95, metal: 0.3, textura, semente: 5220 })
  }
  // O rolo: a faixa de papel na altura z, com as pontas arredondadas. A luz é a do ponto do rolo que aparece NA TELA
  // (o corte não tem o redondo: o alto de uma fatia aparece onde a de cima não a cobre).
  const yDoEixoNaTela = (x: number): number => naTela(x, cy, f.q)[1]
  const pontaDaFrente = f.q === 1 ? x1 : x0
  for (const z of alturas(zb - R, zb + R, PASSO_FINO)) {
    const dz = z - zb
    const meia = Math.sqrt(Math.max(0, R * R - dz * dz))
    if (meia < 0.2) continue
    const textura: Textura = (_u, _v, x, y, _p, s) => {
      s[3] += ruido(x * 0.45, z * 0.4 + y * 0.3) * 0.025
      if (!pontaNaFrente) {
        s[3] += luzDoRoloDeitado((naTela(x, y, f.q)[1] - yDoEixoNaTela(x) - dz) / R)
        return
      }
      const dx = xNaTela(x, y) - xDoEixoNaTela(x)
      if (Math.abs(x - pontaDaFrente) > PASSO_FINO + 0.05) {
        // O alto do rolo fugindo para o fundo: a luz do cilindro de pé, de lado.
        s[3] += luzDoCilindro(dx / R, 0) + 0.04
        return
      }
      // A boca do rolo (de frente na tela, com um quarto de volta): o papelão, o tubo escuro e o braço.
      const raio = Math.hypot(dx, dz)
      if (raio < rb) {
        tingir(s, CROMO.rgb, 1)
        s[3] += luzDoDeitado(dz / rb, 0.2)
      } else if (raio < furo) tingir(s, FUNDO_DO_TUBO, 1)
      else if (raio < furo + papelao) tingir(s, PAPELAO.rgb, 1)
      else s[3] += Math.sin(raio * 2.7) * 0.03 - 0.06 - 0.16 * Math.max(0, (raio - R + 0.5) / 0.5)
    }
    f.fatia(0, z, caixa(x0, cy - meia, x1, cy + meia, Math.min(meia, BEIRA_DO_ROLO + 0.4)), PAPEL, { tabua: 0, bisel: 0, contorno: 0, tom: 0.94, textura, semente: 5221 })
  }
}

/** O seno de 45 graus: a 3/4 desce a altura inteira, então o rolo deitado aparece com raio R vezes raiz de 2. */
const RAIZ_DE_2 = Math.SQRT2

/**
 * A luz do rolo deitado de lado NA TELA: `s` é o quanto o ponto fica abaixo do eixo na tela, em raios (de -raiz de 2,
 * a beira de cima, a raiz de 2, a de baixo). Volta o ângulo do ponto à vista no corte (0 = de frente, 90 graus = o
 * alto) e o acende com a luz do motor (de cima, vinda do norte): o alto claro, a frente na sombra, as beiras escuras.
 */
function luzDoRoloDeitado(s: number): number {
  const c = Math.min(1, Math.max(-1, s / RAIZ_DE_2))
  const fi = Math.acos(c) - Math.PI / 4
  const luz = -0.48 * Math.cos(fi) + 0.62 * Math.sin(fi)
  const beira = Math.max(0, (Math.abs(c) - 0.86) / 0.14)
  return 0.24 * luz - 0.02 - 0.2 * beira * beira
}

/** A ponta do papel caindo pela frente do rolo, do braço para baixo, com o picote perto da barra. */
function pontaDoPapel(f: Fatiador, y: number, x0: number, x1: number, zb: number, desce: number, grossa: number, xNaTela: (x: number, y: number) => number): void {
  const picote = zb - desce + 1.6
  const meioNaTela = xNaTela((x0 + x1) / 2, y)
  const meiaLargura = (x1 - x0) / 2
  for (const z of alturas(zb - desce, zb, PASSO)) {
    const forma: Forma = caixa(x0, y - grossa / 2, x1, y + grossa / 2, 0.1)
    const textura: Textura = (_u, _v, x, yy, _p, s) => {
      const t = (xNaTela(x, yy) - meioNaTela) / meiaLargura
      // A folha descendo do rolo, mais escura junto dele (a sombra do rolo) e com o picote pontilhado.
      const junto = Math.max(0, 1 - (zb - z) / 2.5)
      s[3] += -0.05 * t - 0.16 * junto + (Math.abs(z - picote) < 0.3 && Math.sin(x * 3.1) > 0.2 ? -0.12 : 0) - (Math.abs(t) > 0.9 ? 0.12 : 0)
    }
    f.fatia(0, z, forma, PAPEL, { tabua: 0, bisel: 0, contorno: 0, tom: 0.96, textura, semente: 5230 })
  }
}

