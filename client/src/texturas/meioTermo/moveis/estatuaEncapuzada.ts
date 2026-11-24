/**
 * ESTÁTUA ENCAPUZADA (lote L04 de 24/11/2026, a Fortaleza do ritual;
 * construção, versão da estátua). O VULTO de pedra de capuz e túnica, EM PÉ e
 * de frente, como o anjo de pedra e a estátua de cavalo (de cima seria uma
 * roda de pano, e ninguém diria o que é): o CAPUZ de bico caído para um lado,
 * com a murça sobre os ombros e a cabeça um pouco BAIXA, de modo que a boca
 * do capuz é um vão que escurece para o fundo, e não um rosto; as duas MANGAS
 * largas que se encontram no peito, com as MÃOS juntas num nó, mais claras
 * que o pano; a TÚNICA em trapézio, que abre dos ombros até a barra em quatro
 * pregas largas e desiguais; o CORDÃO de nó na cintura; e o PEDESTAL baixo,
 * pouco mais largo que a barra, com uma placa de sinal gasto. Ninguém de
 * verdade; nenhum símbolo de religião de verdade (o sinal da placa é
 * inventado: um losango num aro).
 *
 * Revisão do diretor de arte (24/11/2026): a túnica de seis pregas iguais e
 * paralelas lia como um feixe de tubos de órgão; as mãos postas, de dedos
 * para cima, liam como barba; o rosto era um buraco preto em gota; e o
 * pedestal era largo demais para o vulto.
 *
 * O que a separa do anjo: não tem asa nem cabelo, a cabeça é a ponta do capuz
 * e o rosto é um vão. Lê-se pela chama da silhueta (o bico em cima, a barra
 * larga embaixo), com o vão do capuz no alto e o nó claro das mãos no peito.
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
import { anel, cadeia, caixa, capsula, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import type { OpcoesDaPeca, Textura } from './motor'
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
} from './gargula'

// As medidas do desenho, em px da casa (0 no meio, y para baixo cresce).
/** A barra da túnica: onde ela pousa (o tampo do pedestal) e a meia largura dela. */
const BARRA = 14.4
const MEIA_BARRA = 11.2
/** O pedestal baixo: o soco tem perto de 1,15 vez a largura da barra da túnica (mais largo, o vulto parecia posto numa mesa). */
const PEDESTAL: PedestalDeFrente = {
  chao: 24.5,
  soco: { meia: MEIA_BARRA * 1.17, topo: 21.2, frente: 22.3 },
  dado: { meia: MEIA_BARRA, topo: 17.2, pe: 21.5 },
  cornija: { meia: MEIA_BARRA * 1.11, frente: 15.8, pe: 17.6 },
  tampo: 13.9,
  placa: { meia: 6.6, topo: 18.2, pe: 20.7 },
}
/** As alturas do vulto: a cintura, os ombros e o bico do capuz (o alto do desenho). */
const CINTURA = 1.2
const OMBRO = -9.6
const BICO = -26.6

/** Quanto de verde vai na pedra da figura e na do pedestal, as manchas e a chuva da figura. */
const VERDE_NA_FIGURA = 0.24
const VERDE_NO_PEDESTAL = 0.14
const MANCHAS_NA_FIGURA = 0.28
const CHUVA_NA_FIGURA = 0.24
/** Os tons (vezes o da pedra): a túnica no fundo das pregas, o lombo das pregas, as mangas, o capuz e as mãos, o mais claro. */
const TOM_DA_TUNICA = 0.86
const TOM_DA_PREGA = 1.02
const TOM_DA_MANGA = 0.98
const TOM_DO_CAPUZ = 1.08
const TOM_DAS_MAOS = 1.24
const TOM_DO_CORDAO = 1.16

/** Um cone de pontas redondas: x, y e raio de uma ponta, x, y e raio da outra. */
type Cone = readonly [number, number, number, number, number, number]

/** A túnica (o lado direito; o esquerdo é o espelho): um TRAPÉZIO, dos ombros à barra, que ondula onde as pregas acabam. */
const TUNICA: readonly Ponto[] = [
  [1.4, OMBRO - 1.2],
  [5.4, OMBRO - 0.4],
  [6.8, -6.8],
  [7.7, CINTURA],
  [9.5, 8.2],
  [MEIA_BARRA, BARRA - 0.5],
  [8.6, BARRA + 0.5],
  [5.8, BARRA - 0.2],
  [2.8, BARRA + 0.6],
  [0.2, BARRA],
]
/**
 * As quatro pregas, da cintura à barra: largas e DESIGUAIS (a de fora da esquerda e a do meio da direita são as
 * mais largas), abrindo em leque com o trapézio. Cada uma é um lombo claro; o fundo entre elas é a túnica. Passam
 * da barra e são cortadas por ela: com a ponta redonda dentro da túnica, as duas largas liam como joelhos.
 */
const PREGAS: readonly Cone[] = [
  [-4.7, CINTURA + 0.4, 0.9, -8.9, BARRA + 3, 2.6],
  [-1.5, CINTURA + 1.2, 0.6, -3.1, BARRA + 3, 1.5],
  [2, CINTURA + 0.5, 1, 4, BARRA + 3, 3.1],
  [5.5, CINTURA + 0.9, 0.7, 9.4, BARRA + 3, 1.8],
]
/** O cordão: a volta na cintura (um pouco caída no meio), o nó, do lado, e a ponta caída com a borla. */
const CORDAO: readonly Ponto[] = [[-7.5, CINTURA - 0.5], [-3, CINTURA + 0.5], [2, CINTURA + 0.7], [7.5, CINTURA - 0.4]]
const NO_DO_CORDAO: Ponto = [-3.6, CINTURA + 0.7]
const PONTA_DO_CORDAO: readonly [number, number, number, number] = [-3.9, CINTURA + 1.4, -4.6, 7.4]
/**
 * A manga direita (a esquerda é o espelho): larga, do ombro ao cotovelo por fora, o pano que pende do antebraço e
 * a boca dela, que chega ao meio do peito, onde as duas se encontram.
 */
const MANGA: readonly Ponto[] = [
  [4.6, OMBRO - 0.6],
  [7.4, OMBRO + 0.8],
  [9.3, -4.2],
  [9.5, -0.4],
  [8.2, 2.6],
  [5.2, 3.6],
  [2.4, 1.6],
  [0.5, -0.4],
  [0.5, -5],
  [2.6, -6.6],
  [3.6, -8.4],
]
/** As dobras de cada manga, ao comprido do pano, e o vão escuro da boca dela, de cada lado das mãos. */
const DOBRAS_DA_MANGA: readonly Cone[] = [
  [7.5, -6.8, 0.45, 7, 1.8, 0.85],
  [5.2, -5.6, 0.4, 3.8, 1.9, 0.75],
]
const BOCA_DA_MANGA = { x: 2.3, y: -2.5, rx: 1.3, ry: 2.3 }
/** As mãos juntas: um NÓ no meio do peito (as duas mãos, uma na outra), os polegares em cima e os dedos cruzados. */
const MAOS = { y: -2.6, rx: 2.5, ry: 2.3 }
const POLEGAR = { x: 0.75, y: -4.5, r: 0.8 }
const DEDOS_CRUZADOS: readonly number[] = [-3.3, -2.5, -1.7]
/**
 * O capuz com a murça (a capinha sobre os ombros), de uma peça só e ASSIMÉTRICO: o bico cai para a direita e o
 * lado direito é mais cheio, como numa cabeça um pouco baixa e virada. Do bico, pelas faces até os ombros, a
 * barra da murça com o V do fecho no meio, e de volta pelo outro lado.
 */
const CAPUZ: readonly Ponto[] = [
  [2.3, BICO],
  [4.7, -23.6],
  [6.4, -19.6],
  [6.7, -15.6],
  [6.1, -12.6],
  [8.3, -10.8],
  [9.1, -8.5],
  [7.5, -7.3],
  [4.6, -8.1],
  [2.2, -7.1],
  [0, -8.3],
  [-2.2, -7.1],
  [-4.6, -8.1],
  [-7.5, -7.3],
  [-9.1, -8.5],
  [-8.3, -10.8],
  [-6, -12.6],
  [-6.5, -15.8],
  [-5.8, -19.8],
  [-3.5, -23.6],
  [-0.3, -26],
]
/**
 * A boca do capuz: o vão em ogiva (a roda de baixo e o bico de cima, um pouco torto para o lado do bico do capuz),
 * o ponto mais fundo dele, debaixo da aba, e a aba do pano dobrado: uma meia-lua só em cima, onde ela avança (em
 * aro pela volta inteira, o vão lia como uma vigia de navio).
 */
const VAO_DO_CAPUZ = { x: 0.3, y: -13.9, rx: 3.5, ry: 3.6, bico: [1, -19.6] as Ponto, raioDoBico: 0.5 }
const FUNDO_DO_VAO: Ponto = [0.5, -16]
const ABA = { x: 0.5, y: -15.4, rx: 4.5, ry: 5.2, corte: -13.6 }
/** Quanto o fundo do vão escurece (em luz da textura), até onde vai o degradê (px) e a curva dele até a borda, que fica no tom da pedra. */
const ESCURO_DO_VAO = 0.62
const ALCANCE_DO_VAO = 6.2
const CURVA_DO_VAO = 1.5
/** Os vincos do capuz: a costura do alto, do bico à aba, e os dois da murça, do pescoço aos ombros. */
const COSTURA: Cone = [2, -25.6, 0.35, 0.9, -20.2, 0.6]
const VINCOS_DA_MURCA: readonly (readonly [number, number, number, number])[] = [[3.4, -11.4, 6.8, -8.8], [1.2, -10.6, 2.2, -8.2]]
/** O sinal gasto da placa do pedestal: um losango num aro (inventado). */
const SINAL = { y: 19.45, r: 0.95 }

/** O musgo do pedestal e do pé, e o líquen (o meio e os raios, px da casa). */
const MUSGO_DO_PEDESTAL: readonly (readonly [number, number, number, number])[] = [
  [-11.4, 15.2, 1.4, 0.7],
  [-12.4, 23.8, 1.6, 0.8],
  [11.8, 24, 1.8, 0.8],
  [10.2, 21.4, 1.1, 0.6],
]
const LIQUENS: readonly (readonly [number, number, number])[] = [[-5.2, -20.6, 1.1], [8.2, -1.6, 0.9], [-8, 10.6, 1.1], [9.2, 18.8, 1], [-9.4, 18.4, 0.9]]

export const montarEstatuaEncapuzada: MontarMovel = (c, cena) => {
  const { por, na, escala } = prepararEstatua(c, cena)
  const figura = pedraDoTempo(c.m.pedra, VERDE_NA_FIGURA)
  const base = pedraDoTempo(c.m.pedra, VERDE_NO_PEDESTAL)
  const TEX = texDaPedraVelha(MANCHAS_NA_FIGURA, CHUVA_NA_FIGURA)
  const o = (semente: number, tom: number, bisel: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel, tom, contorno: 0.3, textura: TEX, semente, ...mais })
  const sombra = (dist: number, forca = 0.28): OpcoesDaPeca => ({ projeta: { dist, forca } })
  const vao = (f: Forma, alfa: number, semente: number): void => por(f, VAO_DA_PEDRA, { bisel: 0, contorno: 0, alfa, semente })
  const cone = (m: Cone, lado = 1): Forma => conico(lado * m[0], m[1], m[2], lado * m[3], m[4], m[5])
  const LADOS = [-1, 1] as const

  // ---------- a sombra no chão do vulto em pé: o pedestal, o corpo até os ombros e o capuz até o bico ----------
  const altura = (y: number): number => (PEDESTAL.chao - y) * escala
  sombraDoPedestalDeFrente(cena, na, PEDESTAL, escala)
  cena.sombras.push({ forma: na(reguaDeSombra(PEDESTAL.chao, 0, 9.4)), z: altura(OMBRO), forca: 0.28 })
  cena.sombras.push({ forma: na(reguaDeSombra(PEDESTAL.chao, 0, 5.6)), z: altura(BICO + 2.5), forca: 0.28 })

  // ---------- o pedestal, com o sinal gasto na placa ----------
  montarPedestalDeFrente(por, base, PEDESTAL, 3901)
  vao(anel(0, SINAL.y, SINAL.r + 0.3, SINAL.r + 0.3, SINAL.r, SINAL.r), 0.5, 3908)
  vao(poligono([[0, SINAL.y - 0.65], [0.6, SINAL.y], [0, SINAL.y + 0.65], [-0.6, SINAL.y]]), 0.5, 3909)
  for (const lado of LADOS) vao(capsula(lado * 2.6, SINAL.y, lado * 4.8, SINAL.y, 0.24), 0.42, 3910)
  musgo(por, musgoDaPedra(base), MUSGO_DO_PEDESTAL, 3912)

  // ---------- a túnica em trapézio, as quatro pregas desiguais e o cordão de nó ----------
  const tunica = arredondada(poligono([...TUNICA, ...espelho(TUNICA).reverse()]), 0.4)
  por(tunica, figura, o(3920, TOM_DA_TUNICA, 1.8, sombra(1.5, 0.32)))
  PREGAS.forEach((prega, i) => {
    // O lombo de cada prega é arredondado até o meio (o chanfro tem perto do raio dela): lê de pano, e não de régua.
    por(dentroDe(cone(prega), tunica), figura, o(3921 + i, TOM_DA_PREGA * (i % 2 === 0 ? 1.03 : 0.97), prega[5] * 0.8, { contorno: 0.18, ...sombra(0.9, 0.22) }))
  })
  por(elipse(PONTA_DO_CORDAO[2], PONTA_DO_CORDAO[3] + 0.6, 0.85, 1.15), figura, o(3930, TOM_DO_CORDAO, 0.7, { contorno: 0.26, ...sombra(0.6, 0.24) }))
  por(capsula(PONTA_DO_CORDAO[0], PONTA_DO_CORDAO[1], PONTA_DO_CORDAO[2], PONTA_DO_CORDAO[3], 0.5), figura, o(3932, TOM_DO_CORDAO, 0.5, { contorno: 0.26, ...sombra(0.6, 0.24) }))
  por(cadeia(CORDAO, 0.68), figura, o(3934, TOM_DO_CORDAO, 0.66, { contorno: 0.28, ...sombra(0.7, 0.26) }))
  por(elipse(NO_DO_CORDAO[0], NO_DO_CORDAO[1], 1.25, 1.1), figura, o(3937, TOM_DO_CORDAO * 1.04, 1, { contorno: 0.3, ...sombra(0.7, 0.26) }))

  // ---------- as duas mangas largas, que se encontram no peito, e o nó claro das mãos ----------
  for (const lado of LADOS) {
    por(arredondada(poligono(lado > 0 ? MANGA : espelho(MANGA)), 0.5), figura, o(3941, TOM_DA_MANGA * (lado < 0 ? 1.04 : 0.96), 1.7, sombra(1.4, 0.32)))
    DOBRAS_DA_MANGA.forEach((dobra, i) => por(cone(dobra, lado), figura, o(3943 + i, TOM_DA_PREGA, dobra[5], { contorno: 0.18 })))
    vao(elipse(lado * BOCA_DA_MANGA.x, BOCA_DA_MANGA.y, BOCA_DA_MANGA.rx, BOCA_DA_MANGA.ry), 0.62, 3946)
  }
  por(elipse(0, MAOS.y, MAOS.rx, MAOS.ry), figura, o(3950, TOM_DAS_MAOS, 1.5, { contorno: 0.32, ...sombra(1.1, 0.34) }))
  for (const lado of LADOS) por(elipse(lado * POLEGAR.x, POLEGAR.y, POLEGAR.r, POLEGAR.r * 0.85), figura, o(3951, TOM_DAS_MAOS * 1.04, 0.6, { contorno: 0.24, ...sombra(0.5, 0.24) }))
  DEDOS_CRUZADOS.forEach((y, i) => vao(capsula(-1.5, y + 0.25 * (i - 1), 1.5, y - 0.25 * (i - 1), 0.15), 0.46, 3953 + i))

  // ---------- o capuz com a murça: o pano, os vincos, o vão que escurece para o fundo e a aba ----------
  por(arredondada(poligono(CAPUZ), 0.4), figura, o(3960, TOM_DO_CAPUZ, 2, sombra(1.5, 0.34)))
  for (const lado of LADOS) {
    VINCOS_DA_MURCA.forEach(([ax, ay, bx, by], i) => vao(capsula(lado * ax, ay, lado * bx, by, 0.22), 0.34, 3961 + i))
  }
  const boca = uniao(
    elipse(VAO_DO_CAPUZ.x, VAO_DO_CAPUZ.y, VAO_DO_CAPUZ.rx, VAO_DO_CAPUZ.ry),
    conico(VAO_DO_CAPUZ.x, VAO_DO_CAPUZ.y - 1, VAO_DO_CAPUZ.rx * 0.86, VAO_DO_CAPUZ.bico[0], VAO_DO_CAPUZ.bico[1], VAO_DO_CAPUZ.raioDoBico),
  )
  /** O vão: a pedra do capuz, do escuro no ponto mais fundo (debaixo da aba) ao tom dela na borda de baixo. Sem rosto. */
  const TEX_DO_VAO: Textura = (u, v, x, y, p, s, e) => {
    TEX(u, v, x, y, p, s, e)
    const q = Math.hypot(x / escala - FUNDO_DO_VAO[0], y / escala - FUNDO_DO_VAO[1]) / ALCANCE_DO_VAO
    s[3] -= ESCURO_DO_VAO * (1 - (q >= 1 ? 1 : q) ** CURVA_DO_VAO)
  }
  // Sem contorno nem chanfro: embaixo, o vão acaba no tom do pano, como uma cova, e não como um furo.
  por(boca, figura, { bisel: 0, tom: TOM_DO_CAPUZ * 0.9, contorno: 0, textura: TEX_DO_VAO, semente: 3964 })
  const aba = dentroDe(menos(elipse(ABA.x, ABA.y, ABA.rx, ABA.ry), boca), caixa(-12, -30, 12, ABA.corte, 0))
  por(aba, figura, o(3967, TOM_DO_CAPUZ * 1.06, 0.8, { contorno: 0.14, ...sombra(1.5, 0.34) }))
  por(cone(COSTURA), figura, o(3968, TOM_DO_CAPUZ * 1.1, 0.5, { contorno: 0.14 }))

  liquen(por, LIQUENS, 3970)
}
