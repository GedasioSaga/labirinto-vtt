/**
 * ESTÁTUA DE BESTA (lote L04 de 24/11/2026, a Fortaleza do ritual; construção
 * nova, do grupo Monumentos e colunas). A criatura GRANDE de pedra do fundo de
 * um salão de ritual, EM PÉ e de frente, como o anjo de pedra (de cima seria
 * uma roda de ombros entre duas asas): sentada sobre as ancas num PEDESTAL
 * largo, as costas na parede, com a CABEÇA baixa entre os ombros (a testa
 * pesada, os olhos fundos, as duas presas que sobem do queixo), os dois
 * CHIFRES grandes abertos e virados para cima, as ASAS de morcego meio
 * abertas atrás dos ombros (o osso até o punho, três dedos e a membrana
 * recortada entre as pontas), os BRAÇOS grossos com as mãos de garras
 * pousadas nos joelhos, as PERNAS dobradas com os pés de três garras na beira
 * do pedestal e o RABO que sai por trás, corre pelo tampo e cai na frente, em
 * ponta de lança. Criatura inventada: de nenhuma religião nem de jogo algum.
 *
 * Lê-se pela silhueta: os dois chifres e as duas asas em volta de uma massa
 * larga de ombros. As asas são o tom escuro, o corpo o do meio e a cabeça com
 * os chifres o claro, como na gárgula, que é da mesma pedreira.
 *
 * É desenhada para ficar ENCOSTADA NA PAREDE: o pedestal toma a largura toda
 * e as asas abrem para os lados, sem nada que saia para trás. O mestre gira a
 * peça para a parede em que ela encosta.
 *
 * O tempo, o das estátuas do lote (`gargula.ts`): a pedra puxada para o
 * cinza-esverdeado, o escorrido da chuva, manchas de verdete, musgo ao pé e
 * nos cantos do pedestal e líquen nas asas. A placa do pedestal tem uma
 * fileira de sinais gastos de talhe reto (inventados, como os do fosso).
 *
 * Figura desenhada de frente nas duas vistas: de cima e na 3/4 é a mesma
 * imagem, e a 3/4 só põe a sombra de baixo (em pé em `tresQuartos.ts`, com a
 * força `FORCA_DA_SOMBRA_DE_BAIXO_DA_BESTA`); o quarto de volta deita a
 * figura, como nos outros em pé. O desenho é feito
 * num quadro de DUAS casas (112 px, y para baixo), cabe nele e escala com o
 * menor lado da pegada (2 x 2 casas de partida). Material: `pedra`.
 */
import { cadeia, capsula, dentroDe, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import type { OpcoesDaPeca } from './motor'
import type { MontarMovel } from './contexto'
import {
  arredondada,
  conico,
  emTrechos,
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
  type Trechos,
} from './gargula'

/** O lado do quadro em que a besta é desenhada: duas casas (px do protótipo). */
const QUADRO = 112
/**
 * A força da sombra de baixo da besta na 3/4 (o perfil dela em `tresQuartos.ts` usa:
 * `{ modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DE_BAIXO_DA_BESTA }`). Com a de sempre (0,34) ela some
 * debaixo da sombra do pedestal, que tem a largura das asas, e a 3/4 não passa no portão da sombra de baixo
 * (a folha de objetos novos mediu: não passa com 0,34; passa com 0,38, 0,44 e 0,5).
 */
export const FORCA_DA_SOMBRA_DE_BAIXO_DA_BESTA = 0.44

// As medidas do desenho, em px do quadro (0 no meio, y para baixo cresce). O lado direito; o esquerdo é o espelho.
/** O pedestal largo e baixo, da largura das asas. */
const PEDESTAL: PedestalDeFrente = {
  chao: 50,
  soco: { meia: 46, topo: 43.2, frente: 45.4 },
  dado: { meia: 41, topo: 32.6, pe: 43.8 },
  cornija: { meia: 44, frente: 28, pe: 33 },
  tampo: 23,
  placa: { meia: 26, topo: 35, pe: 41.4 },
}
/** Os sinais gastos da placa: o meio de cada um na fileira e o meio lado do quadrado. */
const SINAIS: readonly number[] = [-19.5, -9.75, 0, 9.75, 19.5]
const LADO_DO_SINAL = 2.3

/** Quanto de verde vai na pedra da figura e na do pedestal, as manchas e a chuva da figura. */
const VERDE_NA_FIGURA = 0.24
const VERDE_NO_PEDESTAL = 0.14
const MANCHAS_NA_FIGURA = 0.3
const CHUVA_NA_FIGURA = 0.26
/** Os três tons da figura (vezes o da pedra): as asas, o corpo e a cabeça com os chifres. */
const TOM_DA_ASA = 0.6
const TOM_DO_CORPO = 0.9
const TOM_DA_CABECA = 1.06
const TOM_DO_CHIFRE = 1.2
const TOM_DA_GARRA = 1.16

/**
 * A asa direita, meio aberta atrás do ombro: da raiz, sobe pelo osso até o punho (o alto), desce pela beira de
 * fora até a primeira ponta, e daí a beira de baixo, recortada em arco entre as pontas dos três dedos, até voltar
 * para trás da coxa.
 */
const ASA: readonly Ponto[] = [
  [8, -30],
  [20, -39.5],
  [32, -49],
  [38.5, -52.6],
  [43, -48.5],
  [48.6, -37.4],
  [52.6, -22],
  [48.2, -22.6],
  [45.2, -17],
  [44.6, -10],
  [46.6, -3],
  [49.2, 3.4],
  [44.6, 2.4],
  [41, 6.4],
  [39, 12.6],
  [39.2, 19],
  [34, 14.4],
  [26, 12],
  [17, 14],
  [9, 12],
]
/** O osso da asa, do ombro ao punho; a garra do polegar, no punho; e os três dedos, do punho às pontas da membrana. */
const OSSO_DA_ASA: Trechos = [[12, -24, 3.5], [26, -40, 3], [38.4, -49.8, 2.6]]
const POLEGAR: readonly [number, number, number, number, number, number] = [39, -51, 1.6, 42.4, -55.2, 0.4]
const DEDOS_DA_ASA: readonly Trechos[] = [
  [[38.6, -49.6, 1.8], [47.4, -37.6, 1.4], [52, -22.8, 0.6]],
  [[38.6, -49.2, 1.7], [43.4, -24, 1.3], [48.6, 2.6, 0.6]],
  [[38.2, -48.8, 1.6], [38, -16, 1.2], [38.8, 18, 0.6]],
]
/** O rabo: sai de trás do pé direito, corre pelo tampo do pedestal e cai na frente dele, em ponta de lança. */
const RABO: readonly Ponto[] = [[22, 24.4], [29.5, 25.6], [35.4, 24.8], [39, 27.4], [39.4, 31.6]]
const PONTA_DO_RABO: readonly Ponto[] = [[35.4, 31.4], [43.4, 31.8], [39.6, 39.4]]
/** O tronco: o peito largo, a barriga, os dois peitorais e os sulcos (o do meio e os dois da barriga). */
const PEITO = { y: -10, rx: 18, ry: 13.6 }
const BARRIGA = { y: 8, rx: 10.8, ry: 13.4 }
const SULCOS_DA_BARRIGA: readonly number[] = [4.8, 9.6, 14.2]
const PEITORAL = { x: 7.4, y: -9.4, rx: 7.8, ry: 6.4 }
/** As pernas dobradas: a coxa (do quadril ao joelho, aberta para o lado), a canela (do joelho ao tornozelo), o pé e as três garras na beira do pedestal. */
const COXA: readonly [number, number, number, number, number, number] = [8, 13.6, 8.6, 23, 4.4, 7.6]
const CANELA: readonly [number, number, number, number, number, number] = [23.2, 5.4, 6.6, 18.6, 20.4, 4.7]
const PE = { x: 18.4, y: 25.2, rx: 6.8, ry: 3.5 }
const GARRAS_DO_PE: readonly (readonly [number, number, number, number])[] = [[14, 26.6, 13, 31.4], [18.4, 27.2, 18.4, 32.4], [22.8, 26.6, 23.8, 31.4]]
/** Os braços: o ombro, o braço (do ombro ao cotovelo), o antebraço (do cotovelo ao pulso), a mão pousada no joelho e as quatro garras caídas na frente dele. */
const OMBRO = { x: 20, y: -19, rx: 8.8, ry: 8.2 }
const BRACO: readonly [number, number, number, number, number, number] = [21.6, -16.4, 6.8, 28.4, -4, 5.6]
const ANTEBRACO: readonly [number, number, number, number, number, number] = [28.4, -3.4, 5.4, 24.6, 4.6, 4.6]
const MAO = { x: 23.4, y: 6.6, rx: 6, ry: 4.2 }
const GARRAS_DA_MAO: readonly (readonly [number, number, number, number])[] = [[19, 8.6, 18.3, 13], [21.9, 9.4, 21.7, 14.2], [24.9, 9.4, 25.1, 14.2], [27.8, 8.6, 28.5, 12.8]]
/**
 * A cabeça baixa entre os ombros: o pescoço na sombra, o crânio largo, a queixada, a testa pesada em V (de bravo),
 * os olhos fundos e rasgados debaixo dela, o nariz curto e chato, a boca virada para baixo com as duas presas e as
 * orelhas de ponta.
 */
const PESCOCO = { y: -18.6, rx: 11.6, ry: 6.6 }
const CRANIO = { y: -30.2, rx: 12, ry: 10.6 }
const QUEIXADA = { y: -22.2, rx: 9.2, ry: 6.8 }
const TESTA: readonly [number, number, number, number, number, number] = [0.9, -29.4, 2, 10.8, -34, 2.7]
const OLHO = { x: 5.5, y: -27.9, rx: 3, ry: 1.45, giro: -0.42 }
const NARIZ: readonly [number, number, number, number, number, number] = [0, -27.4, 1.1, 0, -24.4, 2]
const NARINA = { x: 1.5, y: -23.7, rx: 0.8, ry: 0.55 }
const BOCA_DA_BESTA: readonly Ponto[] = [[-6.6, -19.8], [-3.4, -20.9], [0, -21.2], [3.4, -20.9], [6.6, -19.8]]
const PRESA: readonly [number, number, number, number, number, number] = [3.4, -20.8, 1.25, 3.6, -17.1, 0.35]
const ORELHA: readonly Ponto[] = [[10.6, -31.8], [20, -33], [11.6, -26.6]]
/** O chifre direito, da cabeça à ponta, abrindo para o lado e virando para cima e para dentro; e os anéis talhados nele, de través. */
const CHIFRE: Trechos = [[8.4, -36.4, 4.5], [15.6, -40.4, 3.8], [20.4, -46.6, 2.9], [20, -52, 1.8], [17.4, -55.2, 0.6]]
const ANEIS_DO_CHIFRE: readonly (readonly [number, number, number, number])[] = [[10, -42, 14, -34.8], [15, -45.8, 21, -41.2], [17.4, -49.4, 23, -49.2]]
/**
 * As alturas da figura (y do quadro) para a sombra no chão: os ombros, o alto da cabeça e o punho das asas. A
 * sombra conta só `PARTE_DA_ALTURA` delas: a besta é desenhada com quase duas casas de alto, e a sombra inteira
 * atravessava o salão.
 */
const ALTURA_DOS_OMBROS = -26
const ALTO_DA_CABECA = -40
const PUNHO_DA_ASA = -52
const PARTE_DA_ALTURA = 0.66

/** O musgo do pedestal e do pé, e o líquen (o meio e os raios, px do quadro). */
const MUSGO_DO_PEDESTAL: readonly (readonly [number, number, number, number])[] = [
  [-42.4, 27.6, 2, 0.9],
  [-44.6, 49.3, 2.6, 0.9],
  [43.6, 49.5, 2.8, 0.8],
  [40, 43.9, 1.6, 0.8],
  [-30, 44.6, 1.8, 0.8],
]
const LIQUENS: readonly (readonly [number, number, number])[] = [[-44, -30, 2], [41.6, -8, 1.7], [-33, 6, 1.8], [-14, -14.6, 1.5], [27.4, 38, 2], [-36, 37.6, 1.6], [12.4, 3, 1.4]]

export const montarEstatuaDeBesta: MontarMovel = (c, cena) => {
  const { por, na, escala } = prepararEstatua(c, cena, QUADRO)
  const figura = pedraDoTempo(c.m.pedra, VERDE_NA_FIGURA)
  const base = pedraDoTempo(c.m.pedra, VERDE_NO_PEDESTAL)
  const TEX = texDaPedraVelha(MANCHAS_NA_FIGURA, CHUVA_NA_FIGURA)
  const o = (semente: number, tom: number, bisel: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel, tom, contorno: 0.3, textura: TEX, semente, ...mais })
  const sombra = (dist: number, forca = 0.28): OpcoesDaPeca => ({ projeta: { dist, forca } })
  const vao = (f: Forma, alfa: number, semente: number): void => por(f, VAO_DA_PEDRA, { bisel: 0, contorno: 0, alfa, semente })
  const cone = (m: readonly [number, number, number, number, number, number], lado: number): Forma => conico(lado * m[0], m[1], m[2], lado * m[3], m[4], m[5])
  const LADOS = [-1, 1] as const
  /** O lado da luz (a esquerda) um pouco mais claro que o outro. */
  const peloLado = (lado: number, tom: number): number => tom * (lado < 0 ? 1.04 : 0.96)

  // ---------- a sombra no chão da besta sentada: o pedestal, o corpo, a cabeça e as duas asas ----------
  const altura = (y: number): number => (PEDESTAL.chao - y) * PARTE_DA_ALTURA * escala
  const regua = (x: number, meia: number): Forma => na(reguaDeSombra(PEDESTAL.chao, x, meia, 2.4))
  sombraDoPedestalDeFrente(cena, na, PEDESTAL, escala)
  cena.sombras.push({ forma: regua(0, 30), z: altura(ALTURA_DOS_OMBROS), forca: 0.28 })
  cena.sombras.push({ forma: regua(0, 13), z: altura(ALTO_DA_CABECA), forca: 0.28 })
  for (const lado of LADOS) cena.sombras.push({ forma: regua(lado * 38, 11), z: altura(PUNHO_DA_ASA), forca: 0.24 })

  // ---------- o pedestal, com a fileira de sinais gastos na placa ----------
  montarPedestalDeFrente(por, base, PEDESTAL, 3801)
  const meio = (PEDESTAL.placa.topo + PEDESTAL.placa.pe) / 2
  SINAIS.forEach((x, i) => {
    const l = LADO_DO_SINAL
    // Cada sinal: três lados de um quadrado (o lado aberto roda de um para o outro) e um ponto dentro.
    const lados: readonly (readonly [number, number, number, number])[] = [[-l, -l, l, -l], [l, -l, l, l], [l, l, -l, l], [-l, l, -l, -l]]
    lados.forEach(([ax, ay, bx, by], k) => {
      if (k !== i % 4) vao(capsula(x + ax, meio + ay, x + bx, meio + by, 0.34), 0.5, 3810 + i)
    })
    vao(elipse(x + (i % 2 === 0 ? 0.5 : -0.5), meio + (i % 3 === 0 ? 0.5 : -0.3), 0.6, 0.6), 0.5, 3816 + i)
  })
  musgo(por, musgoDaPedra(base), MUSGO_DO_PEDESTAL, 3822)

  // ---------- as asas, atrás de tudo: a membrana escura, os dedos, o osso e a garra do polegar ----------
  for (const lado of LADOS) {
    por(arredondada(poligono(lado > 0 ? [...ASA] : espelho(ASA)), 0.5), figura, o(3830, peloLado(lado, TOM_DA_ASA), 2.2))
    DEDOS_DA_ASA.forEach((dedo, i) => por(emTrechos(dedo, lado), figura, o(3832 + i, peloLado(lado, TOM_DA_ASA * 1.3), 1.1, { contorno: 0.22, ...sombra(1, 0.24) })))
    por(cone(POLEGAR, lado), figura, o(3836, TOM_DA_GARRA, 0.9, sombra(0.8, 0.24)))
    por(emTrechos(OSSO_DA_ASA, lado), figura, o(3837, peloLado(lado, TOM_DA_ASA * 1.42), 2.2, sombra(1.6, 0.3)))
  }

  // ---------- o rabo, pelo tampo do pedestal, e a ponta de lança caída na frente ----------
  por(cadeia(RABO, 2.1), figura, o(3840, TOM_DO_CORPO, 1.7, sombra(1.4, 0.3)))
  por(arredondada(poligono(PONTA_DO_RABO), 0.6), figura, o(3841, TOM_DO_CORPO * 1.06, 1.5, sombra(1.6, 0.32)))

  // ---------- o tronco: a barriga, o peito e os peitorais ----------
  por(elipse(0, BARRIGA.y, BARRIGA.rx, BARRIGA.ry), figura, o(3850, TOM_DO_CORPO * 0.9, 4, sombra(2.4, 0.32)))
  SULCOS_DA_BARRIGA.forEach((y) => vao(capsula(-5.6, y, 5.6, y, 0.5), 0.2, 3851))
  vao(capsula(0, 3, 0, 15, 0.45), 0.18, 3851)
  por(elipse(0, PEITO.y, PEITO.rx, PEITO.ry), figura, o(3852, TOM_DO_CORPO * 0.96, 4, sombra(2.4, 0.32)))
  for (const lado of LADOS) por(elipse(lado * PEITORAL.x, PEITORAL.y, PEITORAL.rx, PEITORAL.ry), figura, o(3853, peloLado(lado, TOM_DO_CORPO * 1.08), 3.2, { contorno: 0.2, ...sombra(1.4, 0.26) }))
  vao(capsula(0, -15.6, 0, -3.8, 0.5), 0.26, 3855)

  // ---------- as pernas dobradas, com os pés de garras na beira do pedestal ----------
  for (const lado of LADOS) {
    por(cone(COXA, lado), figura, o(3860, peloLado(lado, TOM_DO_CORPO * 0.94), 3.6, sombra(2.2, 0.3)))
    GARRAS_DO_PE.forEach(([ax, ay, bx, by], i) => por(conico(lado * ax, ay, 1.7, lado * bx, by, 0.55), figura, o(3862 + i, TOM_DA_GARRA, 1.1, sombra(1, 0.28))))
    por(elipse(lado * PE.x, PE.y, PE.rx, PE.ry), figura, o(3866, peloLado(lado, TOM_DO_CORPO * 1.06), 2.2, sombra(1.4, 0.3)))
    por(cone(CANELA, lado), figura, o(3867, peloLado(lado, TOM_DO_CORPO * 1.04), 3.2, sombra(2, 0.3)))
  }

  // ---------- os braços, com as mãos de garras pousadas nos joelhos ----------
  // O ombro com o braço e o antebraço com a mão são uma forma só cada: em rodas soltas, o braço lia de boneco.
  for (const lado of LADOS) {
    por(uniao(elipse(lado * OMBRO.x, OMBRO.y, OMBRO.rx, OMBRO.ry), cone(BRACO, lado)), figura, o(3870, peloLado(lado, TOM_DO_CORPO * 1.04), 3.8, sombra(2.2, 0.3)))
    GARRAS_DA_MAO.forEach(([ax, ay, bx, by], i) => por(conico(lado * ax, ay, 1.5, lado * bx, by, 0.5), figura, o(3872 + i, TOM_DA_GARRA, 1, sombra(0.9, 0.28))))
    por(uniao(cone(ANTEBRACO, lado), elipse(lado * MAO.x, MAO.y, MAO.rx, MAO.ry)), figura, o(3877, peloLado(lado, TOM_DO_CORPO * 1.1), 2.8, sombra(2, 0.3)))
  }

  // ---------- a cabeça: o pescoço, as orelhas, o crânio com a queixada, a boca, o nariz, as presas, a testa e os chifres ----------
  por(elipse(0, PESCOCO.y, PESCOCO.rx, PESCOCO.ry), figura, o(3880, TOM_DO_CORPO * 0.84, 3, sombra(1.8, 0.3)))
  for (const lado of LADOS) por(arredondada(poligono(lado > 0 ? [...ORELHA] : espelho(ORELHA)), 0.5), figura, o(3881, peloLado(lado, TOM_DO_CORPO), 1.4, sombra(1.2, 0.28)))
  const cabeca = uniao(elipse(0, CRANIO.y, CRANIO.rx, CRANIO.ry), elipse(0, QUEIXADA.y, QUEIXADA.rx, QUEIXADA.ry))
  por(cabeca, figura, o(3882, TOM_DA_CABECA, 4, sombra(3, 0.36)))
  vao(cadeia(BOCA_DA_BESTA, 0.5), 0.66, 3883)
  por(cone(NARIZ, 1), figura, o(3889, TOM_DA_CABECA * 1.06, 1.2, { contorno: 0.16, ...sombra(0.8, 0.26) }))
  for (const lado of LADOS) {
    vao(elipse(lado * NARINA.x, NARINA.y, NARINA.rx, NARINA.ry), 0.7, 3884)
    vao(elipseGirada(lado * OLHO.x, OLHO.y, OLHO.rx, OLHO.ry, lado * OLHO.giro), 0.82, 3885)
    por(cone(PRESA, lado), figura, o(3886, TOM_DA_GARRA * 1.04, 0.9, sombra(0.8, 0.3)))
    por(cone(TESTA, lado), figura, o(3887, TOM_DA_CABECA * 1.08, 1.8, { contorno: 0.22, ...sombra(1.5, 0.4) }))
  }
  for (const lado of LADOS) {
    const chifre = emTrechos(CHIFRE, lado)
    por(chifre, figura, o(3894, peloLado(lado, TOM_DO_CHIFRE), 2.6, { contorno: 0.32, ...sombra(2.2, 0.34) }))
    ANEIS_DO_CHIFRE.forEach(([ax, ay, bx, by], i) => vao(dentroDe(capsula(lado * ax, ay, lado * bx, by, 0.36), chifre), 0.24, 3890 + i))
  }

  liquen(por, LIQUENS, 3896)
}
