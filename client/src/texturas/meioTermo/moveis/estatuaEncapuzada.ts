/**
 * ESTÁTUA ENCAPUZADA (lote L04 de 24/11/2026, a Fortaleza do ritual;
 * construção, versão da estátua). O VULTO de pedra de capuz e túnica, EM PÉ e
 * de frente, como o anjo de pedra e a estátua de cavalo (de cima seria uma
 * roda de pano, e ninguém diria o que é): o CAPUZ de bico caído, com a murça
 * sobre os ombros e a boca escura onde devia haver um rosto (só o queixo sai
 * da sombra); as MANGAS largas que se juntam no peito, com as MÃOS postas, de
 * dedos para cima; a TÚNICA que desce em pregas até a barra; o CORDÃO de nó
 * na cintura, com as duas pontas caídas; e o PEDESTAL baixo, com uma placa de
 * sinal gasto. Ninguém de verdade; nenhum símbolo de religião de verdade (o
 * sinal da placa é inventado: um losango num aro).
 *
 * O que a separa do anjo: não tem asa nem cabelo, a cabeça é a ponta do capuz
 * e o rosto é um vão. Lê-se pela chama da silhueta (o bico em cima, a barra
 * larga embaixo) com a boca escura do capuz no alto.
 *
 * O tempo, o das estátuas do lote (`gargula.ts`): a pedra puxada para o
 * cinza-esverdeado, o escorrido da chuva em faixas de pé, manchas de verdete,
 * musgo ao pé e nos cantos do pedestal e líquen aqui e ali.
 *
 * Figura desenhada de frente nas duas vistas: de cima e na 3/4 é a mesma
 * imagem, e a 3/4 só põe a sombra de baixo (`EM_PE` em `tresQuartos.ts`); o
 * quarto de volta deita a figura, como nos outros em pé. O desenho é feito
 * numa casa de 56 px (y cresce para baixo), cabe nela e escala com o menor
 * lado da pegada. Material: `pedra`.
 */
import { hash } from '../../ruido'
import { anel, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import type { OpcoesDaPeca } from './motor'
import type { MontarMovel } from './contexto'
import {
  arredondada,
  conico,
  espelho,
  liquen,
  montarPedestalDeFrente,
  musgo,
  musgoDaPedra,
  pedraDoTempo,
  prepararEstatua,
  reguaDeSombra,
  sombraDoPedestalDeFrente,
  texDaPedraVelha,
  VAO_DA_PEDRA,
  type PedestalDeFrente,
  type PorNaEstatua,
} from './gargula'

// As alturas do desenho, em y da casa (0 no meio, para baixo cresce).
/** O pedestal baixo e largo: a figura é a peça, ele só a levanta do chão. */
const PEDESTAL: PedestalDeFrente = {
  chao: 24.5,
  soco: { meia: 17.4, topo: 21, frente: 22.2 },
  dado: { meia: 14.2, topo: 16.3, pe: 21.3 },
  cornija: { meia: 16, frente: 14.8, pe: 16.8 },
  tampo: 12.8,
  placa: { meia: 8.4, topo: 17.4, pe: 20.4 },
}
/**
 * O vulto é desenhado esguio, num quadro próprio (a barra da túnica no y 12, a cintura, os ombros e o bico do
 * capuz, o alto do desenho), e posto na casa mais largo e um pouco mais alto (`PORTE`), com a barra pousada no
 * tampo: esguio, ele sumia na casa.
 */
const BARRA = 12
const CINTURA = 1.4
const OMBRO = -12.6
const BICO = -27.4
const PORTE = { x: 1.2, y: 1.09, barra: 15.1 }

/** Quanto de verde vai na pedra da figura e na do pedestal, as manchas e a chuva da figura. */
const VERDE_NA_FIGURA = 0.24
const VERDE_NO_PEDESTAL = 0.14
const MANCHAS_NA_FIGURA = 0.3
const CHUVA_NA_FIGURA = 0.3
/** Os tons (vezes o da pedra): o capuz mais claro que a túnica, as pregas e as mãos em relevo, a boca do capuz no escuro. */
const TOM_DA_TUNICA = 0.94
const TOM_DO_CAPUZ = 1.08
const TOM_DA_MANGA = 1.02
const TOM_DA_PREGA = 1.14
const TOM_DA_BOCA = 0.4
const TOM_DO_QUEIXO = 0.72

/** A túnica, dos ombros à barra (o lado direito; o esquerdo é o espelho): reta até a cintura, abrindo até a barra ondulada. */
const TUNICA: readonly Ponto[] = [
  [1.6, -14],
  [5.4, OMBRO - 0.4],
  [7.3, -10.6],
  [7.8, -4],
  [7.2, CINTURA],
  [8.2, 6],
  [9.8, BARRA - 0.7],
  [9.2, BARRA + 0.2],
  [6.8, BARRA - 0.2],
  [4.6, BARRA + 0.6],
  [2.4, BARRA],
  [1, BARRA + 0.7],
]
/** As pregas da túnica, da cintura à barra (x, y e raio de cima, x, y e raio de baixo): a ponta de baixo ondula a barra. */
const PREGAS: readonly (readonly [number, number, number, number, number, number])[] = [
  [-5.3, 3, 0.5, -8.2, BARRA - 0.7, 1.1],
  [-3.1, 2.6, 0.55, -5.2, BARRA - 0.1, 1.25],
  [-0.9, 2.4, 0.5, -1.7, BARRA + 0.2, 1.2],
  [1.3, 2.4, 0.5, 2.1, BARRA + 0.1, 1.2],
  [3.5, 2.6, 0.55, 5.5, BARRA - 0.2, 1.25],
  [5.6, 3, 0.5, 8.4, BARRA - 0.8, 1.05],
]
/** O cordão: a volta na cintura (um pouco caída no meio), o nó e as duas pontas com a borla. */
const CORDAO: readonly Ponto[] = [[-7.2, CINTURA - 0.5], [-3.2, CINTURA + 0.6], [1.4, CINTURA + 0.8], [7.2, CINTURA - 0.4]]
const NO_DO_CORDAO: Ponto = [-2.7, CINTURA + 0.9]
const PONTAS_DO_CORDAO: readonly (readonly [number, number, number, number])[] = [[-3.2, CINTURA + 1.6, -4, 8.2], [-2.2, CINTURA + 1.6, -1.9, 6.8]]
/**
 * A manga direita (a esquerda é o espelho): do ombro ao cotovelo por fora, a boca larga que pende do antebraço
 * até a ponta, e de volta por dentro até o pulso, no meio do peito.
 */
const MANGA: readonly Ponto[] = [
  [4.4, OMBRO - 0.2],
  [7.4, -11.4],
  [8.9, -8.2],
  [9.5, -3.6],
  [9.1, 0.4],
  [7.7, 3.7],
  [5.7, 4.9],
  [4.5, 2],
  [3.3, -1.6],
  [1.6, -4.5],
  [1.3, -7.1],
  [2.9, -7.3],
  [4.6, -6.5],
  [5.2, -9.4],
]
/** As dobras de cada manga, ao comprido do pano que pende, e o vão escuro da boca dela, atrás da mão. */
const DOBRAS_DA_MANGA: readonly (readonly [number, number, number, number, number, number])[] = [
  [8, -8, 0.45, 7.6, 2.8, 0.8],
  [6.1, -5.6, 0.4, 6.1, 3.5, 0.65],
  [3.9, -4.4, 0.35, 5, 1.3, 0.5],
]
const BOCA_DA_MANGA = { x: 1.9, y: -5.6, rx: 1.2, ry: 1.7 }
/** As mãos postas, de dedos para cima: do pulso à ponta dos dedos. */
const MAOS: readonly [number, number, number, number, number, number] = [0, -4.8, 1.55, 0.1, -9.5, 0.62]
/**
 * O capuz com a murça (a capinha sobre os ombros), de uma peça só: do bico, caído um pouco para a direita, pelas
 * faces até os ombros, a barra da murça com o V do fecho no meio, e de volta pelo outro lado.
 */
const CAPUZ: readonly Ponto[] = [
  [1.6, BICO],
  [3.7, -25],
  [5.4, -21.8],
  [6, -18.2],
  [5.8, -15.4],
  [7.5, -13.6],
  [8.9, -11.5],
  [8.2, -9.9],
  [5, -10.5],
  [2.4, -9.9],
  [0, -10.9],
  [-2.4, -9.9],
  [-5, -10.5],
  [-8.2, -9.9],
  [-8.9, -11.5],
  [-7.5, -13.6],
  [-5.8, -15.4],
  [-6, -18.2],
  [-5.4, -21.8],
  [-3.4, -24.8],
  [-0.6, -27],
]
/** A boca do capuz, em ogiva (redonda embaixo, de bico em cima): o vão escuro e o aro do pano dobrado; dentro, o queixo que sai da sombra. */
const BOCA = { y: -17.6, rx: 2.9, ry: 3.9, bico: -22.7, aro: 0.9 }
const QUEIXO = { y: -15.1, rx: 1.7, ry: 1.3 }
/** Os vincos do capuz: a costura do alto, do bico à boca, e os dois da murça, do pescoço aos ombros. */
const COSTURA: readonly [number, number, number, number, number, number] = [1.3, -26.4, 0.4, 0.3, -23.4, 0.7]
const VINCOS_DA_MURCA: readonly (readonly [number, number, number, number])[] = [[3.2, -13.4, 6.6, -11], [1.2, -12.8, 2.2, -10.6]]
/** O sinal gasto da placa do pedestal: um losango num aro (inventado). */
const SINAL = { y: 18.9, r: 1.05 }

/** O musgo do pedestal e do pé, e o líquen (o meio e os raios, px da casa). */
const MUSGO_DO_PEDESTAL: readonly (readonly [number, number, number, number])[] = [
  [-14.6, 14.2, 1.5, 0.8],
  [-16.4, 23.8, 1.7, 0.8],
  [15.2, 24, 2, 0.8],
  [13.4, 21.4, 1.2, 0.7],
]
const LIQUENS: readonly (readonly [number, number, number])[] = [[-5.6, -20.4, 1.1], [8, 0.8, 1], [-7.8, 10.4, 1.1], [10.6, 18.6, 1.2], [-10.4, 17.8, 1]]

export const montarEstatuaEncapuzada: MontarMovel = (c, cena) => {
  const { por: porNaCasa, na, escala } = prepararEstatua(c, cena)
  /** A forma do quadro do vulto posta na casa: mais larga, mais alta e com a barra no tampo (`PORTE`). */
  const noPorte = (f: Forma): Forma => {
    const y0 = PORTE.barra + (f.b[1] - BARRA) * PORTE.y
    const y1 = PORTE.barra + (f.b[3] - BARRA) * PORTE.y
    return { b: [f.b[0] * PORTE.x, y0, f.b[2] * PORTE.x, y1], d: (x, y) => f.d(x / PORTE.x, BARRA + (y - PORTE.barra) / PORTE.y) * PORTE.y }
  }
  const por: PorNaEstatua = (f, mat, o) => porNaCasa(noPorte(f), mat, o)
  const figura = pedraDoTempo(c.m.pedra, VERDE_NA_FIGURA)
  const base = pedraDoTempo(c.m.pedra, VERDE_NO_PEDESTAL)
  const TEX = texDaPedraVelha(MANCHAS_NA_FIGURA, CHUVA_NA_FIGURA)
  const o = (semente: number, tom: number, bisel: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel, tom, contorno: 0.3, textura: TEX, semente, ...mais })
  const sombra = (dist: number, forca = 0.28): OpcoesDaPeca => ({ projeta: { dist, forca } })
  const vao = (f: Forma, alfa: number, semente: number): void => por(f, VAO_DA_PEDRA, { bisel: 0, contorno: 0, alfa, semente })
  const LADOS = [-1, 1] as const

  // ---------- a sombra no chão do vulto em pé: o pedestal, o corpo até os ombros e o capuz até o bico ----------
  const altura = (y: number): number => (PEDESTAL.chao - (PORTE.barra + (y - BARRA) * PORTE.y)) * escala
  sombraDoPedestalDeFrente(cena, na, PEDESTAL, escala)
  cena.sombras.push({ forma: na(reguaDeSombra(PEDESTAL.chao, 0, 10.4)), z: altura(OMBRO), forca: 0.28 })
  cena.sombras.push({ forma: na(reguaDeSombra(PEDESTAL.chao, 0, 6)), z: altura(BICO + 2), forca: 0.28 })

  // ---------- o pedestal, com o sinal gasto na placa ----------
  const naPlaca = (f: Forma, alfa: number, semente: number): void => porNaCasa(f, VAO_DA_PEDRA, { bisel: 0, contorno: 0, alfa, semente })
  montarPedestalDeFrente(porNaCasa, base, PEDESTAL, 3901)
  naPlaca(anel(0, SINAL.y, SINAL.r + 0.3, SINAL.r + 0.3, SINAL.r, SINAL.r), 0.5, 3908)
  naPlaca(poligono([[0, SINAL.y - 0.7], [0.62, SINAL.y], [0, SINAL.y + 0.7], [-0.62, SINAL.y]]), 0.5, 3909)
  for (const lado of LADOS) naPlaca(capsula(lado * 3, SINAL.y, lado * 5.6, SINAL.y, 0.26), 0.42, 3910)
  musgo(porNaCasa, musgoDaPedra(base), MUSGO_DO_PEDESTAL, 3912)

  // ---------- a túnica, as pregas até a barra e o cordão de nó ----------
  const tunica = arredondada(poligono([...TUNICA, ...espelho(TUNICA).reverse()]), 0.4)
  por(tunica, figura, o(3920, TOM_DA_TUNICA, 1.8, sombra(1.5, 0.32)))
  PREGAS.forEach(([ax, ay, ra, bx, by, rb], i) => {
    por(conico(ax, ay, ra, bx, by, rb), figura, o(3921 + i, TOM_DA_PREGA * (0.96 + 0.07 * hash(i, 2, 3921)), rb, { contorno: 0.22, ...sombra(0.6, 0.2) }))
  })
  PONTAS_DO_CORDAO.forEach(([ax, ay, bx, by], i) => {
    por(elipse(bx, by + 0.6, 0.85, 1.15), figura, o(3930 + i, 1.16, 0.7, { contorno: 0.26, ...sombra(0.6, 0.24) }))
    por(capsula(ax, ay, bx, by, 0.52), figura, o(3932 + i, 1.2, 0.5, { contorno: 0.26, ...sombra(0.6, 0.24) }))
  })
  por(capsula(CORDAO[0][0], CORDAO[0][1], CORDAO[1][0], CORDAO[1][1], 0.72), figura, o(3934, 1.2, 0.7, { contorno: 0.28, ...sombra(0.7, 0.26) }))
  por(capsula(CORDAO[1][0], CORDAO[1][1], CORDAO[2][0], CORDAO[2][1], 0.72), figura, o(3935, 1.2, 0.7, { contorno: 0.28, ...sombra(0.7, 0.26) }))
  por(capsula(CORDAO[2][0], CORDAO[2][1], CORDAO[3][0], CORDAO[3][1], 0.72), figura, o(3936, 1.2, 0.7, { contorno: 0.28, ...sombra(0.7, 0.26) }))
  por(elipse(NO_DO_CORDAO[0], NO_DO_CORDAO[1], 1.3, 1.15), figura, o(3937, 1.24, 1, { contorno: 0.3, ...sombra(0.7, 0.26) }))

  // ---------- as mangas largas, juntas no peito, e as mãos postas ----------
  for (const lado of LADOS) {
    vao(elipse(lado * BOCA_DA_MANGA.x, BOCA_DA_MANGA.y, BOCA_DA_MANGA.rx, BOCA_DA_MANGA.ry), 0.7, 3940)
    por(arredondada(poligono(lado > 0 ? [...MANGA] : espelho(MANGA)), 0.3), figura, o(3941, TOM_DA_MANGA * (lado < 0 ? 1.04 : 0.96), 1.6, sombra(1.3, 0.3)))
    DOBRAS_DA_MANGA.forEach(([ax, ay, ra, bx, by, rb], i) => {
      por(conico(lado * ax, ay, ra, lado * bx, by, rb), figura, o(3943 + i, TOM_DA_PREGA, rb, { contorno: 0.2 }))
    })
  }
  por(conico(MAOS[0], MAOS[1], MAOS[2], MAOS[3], MAOS[4], MAOS[5]), figura, o(3950, 1.16, 1, sombra(0.9, 0.26)))
  vao(capsula(0.05, MAOS[1] - 0.4, 0.1, MAOS[4] + 0.5, 0.14), 0.62, 3951)

  // ---------- o capuz com a murça: a peça de pano, a boca escura com o queixo, o aro e os vincos ----------
  por(arredondada(poligono(CAPUZ), 0.4), figura, o(3960, TOM_DO_CAPUZ, 2, sombra(1.5, 0.34)))
  for (const lado of LADOS) {
    VINCOS_DA_MURCA.forEach(([ax, ay, bx, by], i) => vao(capsula(lado * ax, ay, lado * bx, by, 0.22), 0.34, 3961 + i))
  }
  const boca = uniao(elipse(0, BOCA.y, BOCA.rx, BOCA.ry), conico(0, BOCA.y - 1, BOCA.rx * 0.86, 0, BOCA.bico, 0.3))
  por(boca, figura, { bisel: 1.4, tom: TOM_DA_BOCA, contorno: 0.2, recesso: { k: 1.6, forca: 0.4 }, textura: TEX, semente: 3964 })
  por(elipse(0, QUEIXO.y, QUEIXO.rx, QUEIXO.ry), figura, { bisel: 1.1, tom: TOM_DO_QUEIXO, contorno: 0.12, alfa: 0.92, suave: 0.4, textura: TEX, semente: 3965 })
  por(menos(arredondada(boca, BOCA.aro), boca), figura, o(3967, TOM_DO_CAPUZ * 1.06, 0.8, { contorno: 0.24, ...sombra(1.2, 0.36) }))
  por(conico(COSTURA[0], COSTURA[1], COSTURA[2], COSTURA[3], COSTURA[4], COSTURA[5]), figura, o(3968, TOM_DO_CAPUZ * 1.1, 0.5, { contorno: 0.14 }))

  liquen(por, LIQUENS, 3970)
}
