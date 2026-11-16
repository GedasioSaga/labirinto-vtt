/**
 * PRATELEIRA DE FRASCOS (banheiro moderno, desenhista B, 15/11/2026; o mestre pediu "vários mais utensílios para
 * banheiro" no estilo moderno). A prateleira de parede de duas tábuas de vidro fosco presas em duas hastes de cromo,
 * cada tábua com a grade de cromo na frente; em cima, o xampu, o condicionador e a loção de bomba; embaixo (a tábua
 * de baixo é mais funda, em degrau), o sabonete líquido de vidro âmbar com a bomba de cromo e o pote de creme.
 *
 * DE CIMA aparecem a tábua de cima com os três frascos vistos de cima (as tampas e os ombros coloridos) e, na frente
 * dela, a beira da tábua de baixo com o sabonete e o pote; as grades são os riscos de cromo na frente de cada tábua.
 * A 25% de zoom sobram a faixa clara do vidro e a fileira de pontos coloridos: é o que diz "prateleira de banheiro"
 * e não "prateleira de potes" (a de madeira, com os potes de barro).
 *
 * NA 3/4 tudo é desenhado em fatias (`pilhaDeFatias.ts`): as tábuas no ar com a beira verde do vidro, os frascos de
 * pé com a luz do cilindro, os rótulos, as tampas e as bombas, e as grades passando na frente do pé dos frascos. A
 * ordem de pintura segue o apoio (a tábua, depois o que está nela) e o giro (de costas, as hastes e as grades
 * passam para a frente).
 *
 * As medidas saem da pegada (1 x 0,3 casa de partida; a parede é o lado de trás). O perfil da 3/4 tem de ser
 * `{ modo: 'derivado', espessura: 0 }`. Sem material escolhido: o vidro, o cromo e as cores dos frascos são fixos.
 */
import type { Rgb } from '../../ruido'
import { caixa, elipse } from './formas'
import type { MaterialDaPeca, Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, luzDoCilindro, luzDoDeitado, naTela, novoFatiador, sombraNoAr, type Fatiador } from './pilhaDeFatias'
import { CROMO, GRAFITE } from './tonsDoBanheiroModerno'

/** As alturas das tábuas (casas) e a grossura do vidro (px). */
const TABUA_DE_BAIXO = 0.88
const TABUA_DE_CIMA = 1.31
const VIDRO = 1.2
/** As tábuas: quanto ficam da parede e das pontas, a fundura da de cima e a folga da de baixo na frente (px). */
const DA_PAREDE = 1.6
const DAS_PONTAS = 2
const FUNDO_DE_CIMA = 8.5
const FOLGA_NA_FRENTE = 1
/** As hastes: quanto ficam das pontas, o raio e quanto passam da tábua de cima (px). */
const HASTE = { dasPontas: 3.4, raio: 0.7, passa: 5 } as const
/** A grade da frente: a altura sobre a tábua, o raio e o recuo da beira (px). */
const GRADE = { alta: 2.4, raio: 0.42, recuo: 0.6 } as const
/** O passo das fatias dos frascos e das peças finas (px). */
const PASSO = 0.4
const PASSO_FINO = 0.2

/** O vidro fosco: o alto claro e frio, a beira verde. */
const VIDRO_FOSCO: MaterialDaPeca = { classe: 'liso', rgb: [0xcb, 0xd7, 0xd4] }
const BEIRA_DO_VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0xab, 0xa2] }

const liso = (cor: Rgb): MaterialDaPeca => ({ classe: 'liso', rgb: cor })
/** As cores dos frascos, contidas: o verde-água do xampu, o creme do condicionador, o cinza azulado da loção, o âmbar do sabonete e o rosa queimado do pote. */
const VERDE_AGUA = liso([0x4f, 0x86, 0x84])
const ROTULO_CLARO = liso([0xe6, 0xe1, 0xd4])
const CREME = liso([0xe3, 0xdf, 0xd5])
const SALVIA = liso([0x8e, 0xa5, 0x8c])
const CINZA_AZUL = liso([0x9c, 0xa9, 0xb5])
const AMBAR = liso([0x8f, 0x63, 0x3e])
const PORCELANA = liso([0xe9, 0xe6, 0xdf])
const ROSA_QUEIMADO = liso([0xc4, 0x9f, 0x96])

/** Um corte do frasco na altura h: os raios (x e y, no frasco), o material, o reflexo e o tom da frente. */
interface Corte {
  readonly rx: number
  readonly ry: number
  readonly mat: MaterialDaPeca
  readonly brilho: number
  readonly tom?: number
}

/** O ombro: o raio passando de `de` a `ate` entre as alturas h0 e h1, arredondado. */
function ombro(h: number, h0: number, h1: number, de: number, ate: number): number {
  const t = Math.min(1, Math.max(0, (h - h0) / (h1 - h0)))
  return ate + (de - ate) * Math.sqrt(1 - t * t)
}

/** Um frasco de pé feito no torno: as fatias do perfil, com a luz do cilindro NA TELA e o alto debruado. */
function frasco(f: Fatiador, camada: number, cx: number, cy: number, z0: number, altura: number, perfil: (h: number) => Corte, semente: number): void {
  const xDoEixo = naTela(cx, cy, f.q)[0]
  for (const h of alturas(0, altura, PASSO)) {
    const k = perfil(h)
    const topo = h >= altura - 1e-6
    const meia = f.q % 2 === 0 ? k.rx : k.ry
    const textura: Textura = (_u, _v, x, y, _p, s) => {
      s[3] += luzDoCilindro((naTela(x, y, f.q)[0] - xDoEixo) / meia, k.brilho)
    }
    f.fatia(camada, z0 + h, elipse(cx, cy, k.rx, k.ry), k.mat,
      topo ? { tabua: 0, bisel: Math.min(1, Math.min(k.rx, k.ry) * 0.7), contorno: 0.24, metal: k.brilho > 0.2 ? 0.5 : 0.12, semente }
      : { tabua: 0, bisel: 0, contorno: 0, tom: k.tom ?? 0.92, textura, semente })
  }
}

/** A bomba de cromo: a gola, a haste e a cabeça com o bico deitado para o lado `+x` do frasco. */
function bomba(f: Fatiador, camada: number, cx: number, cy: number, z0: number, semente: number): void {
  frasco(f, camada, cx, cy, z0, 3.8, (h) => (h < 0.9 ? { rx: 1.25, ry: 1.25, mat: CROMO, brilho: 0.3 } : h < 2.8 ? { rx: 0.45, ry: 0.45, mat: CROMO, brilho: 0.3 } : { rx: 0.95, ry: 0.95, mat: CROMO, brilho: 0.3 }), semente)
  for (const z of alturas(z0 + 2.9, z0 + 3.6, PASSO_FINO)) {
    const textura: Textura = (_u, _v, _x, _y, _p, s) => {
      s[3] += luzDoDeitado((z - (z0 + 3.25)) / 0.4, 0.3)
    }
    f.fatia(camada, z, caixa(cx, cy - 0.38, cx + 2.4, cy + 0.38, 0.3), CROMO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.95, textura, semente: semente + 1 })
  }
}

export const montarPrateleiraDeFrascos: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const z1 = g * TABUA_DE_BAIXO
  const z2 = g * TABUA_DE_CIMA
  const yParede = -hh + DA_PAREDE
  const yFrenteDeCima = yParede + FUNDO_DE_CIMA
  const yFrenteDeBaixo = hh - FOLGA_NA_FRENTE
  const x0 = -hw + DAS_PONTAS
  const x1 = hw - DAS_PONTAS
  /** Se o ponto de fundura y (no objeto) fica na frente do meio NA TELA: de costas, a parede vem para a frente. */
  const naFrente = (y: number): boolean => naTela(0, y, q)[1] > naTela(0, 0, q)[1] + 1e-6

  const deBaixo = caixa(x0, yParede, x1, yFrenteDeBaixo, 0.6)
  const deCima = caixa(x0, yParede, x1, yFrenteDeCima, 0.6)
  cena.sombras.push(sombraNoAr(deBaixo, z1, q, 0.16, 2.4), sombraNoAr(deCima, z2, q, 0.14, 2.8))

  // As camadas da 3/4: a haste, a tábua de baixo, a grade dela (se atrás), os frascos de baixo, a grade (se na
  // frente), e o mesmo para a tábua de cima; as hastes de costas passam na frente de tudo.
  const tabua = (z: number, forma: ReturnType<typeof caixa>, camada: number) => {
    f.fatia(camada, z - VIDRO, forma, BEIRA_DO_VIDRO, { tabua: 0, bisel: 0, contorno: 0, tom: 1, semente: 5601 })
    f.fatia(camada, z - VIDRO / 2, forma, BEIRA_DO_VIDRO, { tabua: 0, bisel: 0, contorno: 0, tom: 1.08, semente: 5601 })
    f.fatia(camada, z, forma, VIDRO_FOSCO, { tabua: 0, bisel: 0.9, contorno: 0.2, metal: 0.25, semente: 5602 })
  }
  const grade = (z: number, y: number, camada: number) => {
    const zr = z + GRADE.alta
    for (const zz of alturas(zr - GRADE.raio, zr + GRADE.raio, PASSO_FINO)) {
      const meia = Math.sqrt(Math.max(0, GRADE.raio ** 2 - (zz - zr) ** 2))
      if (meia < 0.08) continue
      const textura: Textura = (_u, _v, _x, _y, _p, s) => {
        s[3] += luzDoDeitado((zz - zr) / GRADE.raio, 0.3)
      }
      f.fatia(camada, zz, caixa(x0 + 0.8, y - meia, x1 - 0.8, y + meia, Math.min(meia, 0.3)), CROMO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.95, metal: 0.3, textura, semente: 5603 })
    }
    for (const x of [x0 + 1.2, x1 - 1.2]) frasco(f, camada, x, y, z, GRADE.alta + GRADE.raio, () => ({ rx: GRADE.raio, ry: GRADE.raio, mat: CROMO, brilho: 0.3 }), 5604)
  }

  // As HASTES de cromo, encostadas na parede, com a bolinha no alto.
  const camadaDaHaste = naFrente(yParede) ? 9 : 0
  for (const lado of [-1, 1]) {
    const x = lado * (hw - HASTE.dasPontas)
    const zTopo = z2 + HASTE.passa
    frasco(f, camadaDaHaste, x, yParede - HASTE.raio, z1 - 3, zTopo - (z1 - 3), (h) => (h > zTopo - (z1 - 3) - 1.3 ? { rx: 1.05, ry: 1.05, mat: CROMO, brilho: 0.35 } : { rx: HASTE.raio, ry: HASTE.raio, mat: CROMO, brilho: 0.35 }), 5605)
  }

  // A TÁBUA DE BAIXO e o que está nela: o sabonete líquido âmbar com a bomba e o pote de creme, na frente.
  tabua(z1, deBaixo, 1)
  const yDeBaixo = (yFrenteDeCima + yFrenteDeBaixo) / 2 + 0.4
  const meioX = (x: number): number => x * (hw - 4)
  grade(z1, yFrenteDeBaixo - GRADE.recuo, naFrente(yFrenteDeBaixo) ? 3 : 1.5)
  const xSabonete = meioX(-0.3)
  frasco(f, 2, xSabonete, yDeBaixo, z1, 8.3, (h) => (h < 7.4 ? { rx: 2.3, ry: 2.3, mat: AMBAR, brilho: 0.24 } : { rx: ombro(h, 7.4, 8.3, 2.3, 1.1), ry: ombro(h, 7.4, 8.3, 2.3, 1.1), mat: AMBAR, brilho: 0.24 }), 5610)
  bomba(f, 2, xSabonete, yDeBaixo, z1 + 8.3, 5611)
  const xPote = meioX(0.24)
  frasco(f, 2, xPote, yDeBaixo - 0.2, z1, 4.6, (h) => (h < 3.3 ? { rx: 3, ry: 3, mat: PORCELANA, brilho: 0.08 } : h < 3.5 ? { rx: 2.8, ry: 2.8, mat: GRAFITE, brilho: 0, tom: 0.7 } : { rx: 3.15, ry: 3.15, mat: ROSA_QUEIMADO, brilho: 0.1 }), 5612)

  // A TÁBUA DE CIMA e os frascos dela: o xampu e o condicionador juntos, a loção de bomba do outro lado.
  tabua(z2, deCima, 4)
  const yDeCima = (yParede + yFrenteDeCima) / 2
  grade(z2, yFrenteDeCima - GRADE.recuo, naFrente(yFrenteDeCima) ? 6 : 4.5)
  frasco(f, 5, meioX(-0.62), yDeCima, z2, 13.6, (h) => {
    if (h < 10.5) return { rx: 2.6, ry: 1.7, mat: h > 3 && h < 7.5 ? ROTULO_CLARO : VERDE_AGUA, brilho: 0.12 }
    if (h < 11.8) return { rx: ombro(h, 10.5, 11.8, 2.6, 1.25), ry: ombro(h, 10.5, 11.8, 1.7, 1.15), mat: VERDE_AGUA, brilho: 0.12 }
    return { rx: 1.3, ry: 1.2, mat: GRAFITE, brilho: 0.1, tom: 1.1 }
  }, 5620)
  frasco(f, 5, meioX(-0.4), yDeCima + 0.3, z2, 11.8, (h) => {
    if (h < 9.2) return { rx: 2.35, ry: 1.6, mat: h > 2.6 && h < 6.6 ? SALVIA : CREME, brilho: 0.1 }
    if (h < 10.3) return { rx: ombro(h, 9.2, 10.3, 2.35, 1.2), ry: ombro(h, 9.2, 10.3, 1.6, 1.1), mat: CREME, brilho: 0.1 }
    return { rx: 1.25, ry: 1.15, mat: SALVIA, brilho: 0.1, tom: 0.95 }
  }, 5621)
  const xLocao = meioX(0.6)
  frasco(f, 5, xLocao, yDeCima, z2, 8.8, (h) => (h < 8 ? { rx: 2.1, ry: 2.1, mat: CINZA_AZUL, brilho: 0.14 } : { rx: ombro(h, 8, 8.8, 2.1, 1.1), ry: ombro(h, 8, 8.8, 2.1, 1.1), mat: CINZA_AZUL, brilho: 0.14 }), 5622)
  bomba(f, 5, xLocao, yDeCima, z2 + 8.8, 5623)

  f.fechar()
}
