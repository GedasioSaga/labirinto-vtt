/**
 * CANDELABRO DE CHÃO de cima com volume (lote 4 dos objetos novos, 11/11/2026):
 * o candelabro alto de sala, em pé num tripé, com cinco velas ACESAS. De cima
 * é um anel de velas em volta do mastro: os três pés no chão (dois abertos
 * para a frente, um para trás), os cinco braços em redemoinho saindo do cubo,
 * um prato de metal na ponta de cada braço e, no prato, a vela de cera com a
 * chama pintada e um halo pequeno e quente.
 *
 * A LUZ (decisão do mestre): ele só ilumina em volta. Aqui não há chama
 * animada nem botão Aceso/Apagado; as chamas e os halos são pintura, e a luz
 * de verdade é uma linha que o integrador põe. O centro dela é o MASTRO, o
 * meio exato da pegada (0,5 da largura e 0,5 da altura): as cinco chamas
 * ficam em volta dele, num anel de raio `RAIO_DO_ANEL` da meia pegada.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura; cada peça
 * sobe com a estrutura mais alta que contém o meio da CAIXA dela) o
 * candelabro fica erguido:
 * - os PÉS ficam no chão: a caixa de cada um é centrada num ponto entre o
 *   soquete e o anel, onde não há estrutura nenhuma (`comMeioEm`);
 * - o SOQUETE do tripé e o MASTRO são colunas; os NÓS torneados do mastro são
 *   tampos soltos sem peça (cada um vira uma luva da altura da beirada);
 * - o cubo, os BRAÇOS e os PRATOS sobem com o mastro: a caixa de cada peça é
 *   centrada nele, então a coroa inteira sobe junta;
 * - cada VELA é um tampo solto na altura do alto dela, e a beirada do tampo é
 *   o corpo de cera: por isso a espessura do perfil da 3/4 é a altura da vela
 *   (`ALTURA_DA_VELA_DO_CANDELABRO`). A caixa desse tampo é a pegada inteira
 *   (`naOrdemDaFrente`): a 3/4 pinta as estruturas do norte para o sul pela
 *   base da caixa, e a vela do fundo sairia antes do prato dela, que a cobriria.
 *
 * As chamas apontam para cima NA TELA: de cima o `giro` é sempre 0 (quem gira
 * é a imagem pronta); na 3/4 o quarto de volta é pintado na cena, e a chama é
 * desenhada já desgirada (`desgirado`, a conta do altar).
 *
 * Tudo tem o tamanho do menor lado (o candelabro é redondo); as alturas são em
 * casas. Material: `metal` (ferro ou latão). A cera, o pavio e as chamas são
 * fixos.
 */
import type { Rgb } from '../../ruido'
import { cadeia, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, G, type MontarMovel } from './contexto'

/**
 * Alturas, em casas: o soquete do tripé (onde os três pés se juntam) e a coroa
 * (o cubo, os braços e os pratos). O soquete é alto o bastante para, na 3/4,
 * esconder o pé de trás inteiro: mais baixo, a sapata dele aparecia dos dois
 * lados do mastro como um caroço.
 */
const ALTURA_DO_SOQUETE = 0.24
const ALTURA_DA_COROA = 1.14
/**
 * A altura da vela (px do protótipo). Na 3/4 ela é a BEIRADA do tampo de cada
 * vela: o perfil do candelabro em `tresQuartos.ts` usa este valor como espessura.
 */
export const ALTURA_DA_VELA_DO_CANDELABRO = 0.16 * G
/** Os nós torneados do mastro: a altura do alto de cada um, em casas (na 3/4 cada um desce a altura de uma vela). */
const NOS_DO_MASTRO: readonly number[] = [0.5, 1]

/** As medidas de cima, em fração da meia pegada. */
const RAIO_DO_ANEL = 0.65
const RAIO_DO_PRATO = 0.23
const RAIO_DA_VELA = 0.14
const RAIO_DO_MASTRO = 0.075
const RAIO_DO_NO = 0.125
const RAIO_DO_SOQUETE = 0.16
const RAIO_DO_CUBO = 0.17
const GROSSURA_DO_BRACO = 0.05
/** O pé: até onde vai o meio da sapata, a meia grossura da perna e o raio da sapata. */
const COMPRIMENTO_DO_PE = 0.78
const GROSSURA_DO_PE = 0.08
const RAIO_DA_SAPATA = 0.12
/** Os pés estão no chão, na sombra da coroa: mais escuros que ela, para de cima não se confundirem com os braços. */
const TOM_DOS_PES = 0.7
/** Quanto do raio do soquete a ponta redonda dele já cobre do pé de trás na 3/4: a coluna pode ficar esse tanto mais baixa que o pé. */
const FOLGA_DO_SOQUETE = 0.6
/**
 * O raio em que a caixa de cada pé é centrada: depois do soquete e antes do
 * alto das velas, o único trecho do pé sem estrutura por cima.
 */
const MEIO_SEGURO_DO_PE = 0.36

const VELAS = 5
/** A primeira vela fica no fundo; as outras quatro, duas de cada lado, com o par da frente aberto. */
const ANGULO_DA_PRIMEIRA_VELA = -Math.PI / 2
/** Os pés: dois abertos para a frente, entre as velas, e um para trás (na 3/4, atrás do mastro). */
const ABERTURA_DOS_PES_DA_FRENTE = 0.35
const ANGULOS_DOS_PES: readonly number[] = [ABERTURA_DOS_PES_DA_FRENTE, Math.PI - ABERTURA_DOS_PES_DA_FRENTE, -Math.PI / 2]
/** O braço em redemoinho: o raio (fração da meia pegada) e o atraso do ângulo (radianos) de cada ponto, do cubo ao prato. */
const CURVA_DO_BRACO: readonly (readonly [number, number])[] = [[0.1, 0.7], [0.3, 0.36], [0.48, 0.12], [RAIO_DO_ANEL, 0]]

/** A cera: creme, sem brilho (a do castiçal do altar). */
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd7, 0xbc] }
/**
 * A cera do CORPO da vela, que só a 3/4 pinta: a frente que ela varre tem 0,74
 * da luz do material (`TOM_DA_FRENTE` de `tresQuartos.ts`), e com a cera do
 * alto a vela acesa saía cinza. Este tom, vezes 0,74, dá a cera um pouco
 * abaixo do alto. É o material do halo, a maior peça de cada vela: a frente
 * leva o material da maior peça, e o halo pinta a própria cor na textura.
 */
const LUZ_DO_CORPO_DA_VELA = 0.92 / 0.74
const CERA_DO_CORPO: MaterialDaPeca = { classe: 'liso', rgb: [CERA.rgb[0] * LUZ_DO_CORPO_DA_VELA, CERA.rgb[1] * LUZ_DO_CORPO_DA_VELA, CERA.rgb[2] * LUZ_DO_CORPO_DA_VELA] }

/** A chama: quase branca no pé, amarela no meio, laranja contido na ponta. */
const PE_DA_CHAMA: Rgb = [0xff, 0xf4, 0xcf]
const MEIO_DA_CHAMA: Rgb = [0xf6, 0xd0, 0x7e]
const PONTA_DA_CHAMA: Rgb = [0xe4, 0x9a, 0x52]
const CHAMA: MaterialDaPeca = { classe: 'liso', rgb: PE_DA_CHAMA }
/** Meia largura e meio comprimento da chama, em fração da meia pegada, e quanto do meio comprimento o meio dela fica acima do pavio. */
const LARGURA_DA_CHAMA = 0.07
const COMPRIMENTO_DA_CHAMA = 0.135
const SUBIDA_DA_CHAMA = 0.75
/**
 * A gota da chama: ao longo dela (de -1, o pé, a 1, a ponta), a meia largura
 * em fração da maior. O lado direito; o esquerdo é o espelho.
 */
const GOTA_DA_CHAMA: readonly (readonly [number, number])[] = [[-1, 0.35], [-0.7, 0.8], [-0.3, 1], [0.15, 0.85], [0.6, 0.45], [1, 0]]
/** O halo de cada chama: a cor do brilho do lampião, o alfa no meio e o raio (fração da meia pegada). */
const COR_DO_HALO: Rgb = [226, 170, 96]
const ALFA_DO_HALO = 0.34
const RAIO_DO_HALO = 0.36

function polar(raio: number, angulo: number): Ponto {
  return [raio * Math.cos(angulo), raio * Math.sin(angulo)]
}

/**
 * A mesma forma com a caixa de pintura centrada em (mx, my): o desenho não
 * muda (fora da forma nada pinta), mas o meio da caixa, que é o que a 3/4 lê
 * para saber com que estrutura a peça sobe, cai onde se quer.
 */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/**
 * A mesma forma com a caixa da pegada inteira (meio lado `R`): a 3/4 ordena as
 * estruturas pela base da caixa, e com esta todas as velas saem depois do
 * mastro e dos pratos, na ordem em que entram, em qualquer giro.
 */
function naOrdemDaFrente(forma: Forma, R: number): Forma {
  return { b: [-R, -R, R, R], d: (x, y) => forma.d(x, y) }
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de
 * volta que a 3/4 pinta (`giro`, em graus): a conta do altar (`altar.ts`).
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** O halo: a cor quente com alfa que cai suave do meio (cx, cy) até `r`, sem pegar luz nem sombra. */
function texHalo(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r))
    s[0] = COR_DO_HALO[0]
    s[1] = COR_DO_HALO[1]
    s[2] = COR_DO_HALO[2]
    s[4] = 1
    s[5] = ALFA_DO_HALO * (1 - q) * (1 - q)
  }
}

/** A gota da chama de meio (cx, cy), apontada para (ux, uy), com as meias medidas `comprida` e `larga`. */
function gotaDaChama(cx: number, cy: number, ux: number, uy: number, comprida: number, larga: number): Forma {
  const em = (ao: number, de: number): Ponto => [cx + ao * comprida * ux - de * larga * uy, cy + ao * comprida * uy + de * larga * ux]
  const direita = GOTA_DA_CHAMA.map(([ao, de]) => em(ao, de))
  const esquerda = GOTA_DA_CHAMA.slice(0, -1).reverse().map(([ao, de]) => em(ao, -de))
  return poligono([...direita, ...esquerda])
}

/** A chama: do pé (px, py), quase branco, pelo amarelo, até o laranja da ponta, `comprimento` px adiante na direção (ux, uy); só emissão. */
function texChama(px: number, py: number, ux: number, uy: number, comprimento: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = Math.max(0, Math.min(1, ((x - px) * ux + (y - py) * uy) / comprimento)) * 2
    const naPonta = t >= 1
    const de = naPonta ? MEIO_DA_CHAMA : PE_DA_CHAMA
    const para = naPonta ? PONTA_DA_CHAMA : MEIO_DA_CHAMA
    const k = naPonta ? t - 1 : t
    s[0] = de[0] + (para[0] - de[0]) * k
    s[1] = de[1] + (para[1] - de[1]) * k
    s[2] = de[2] + (para[2] - de[2]) * k
    s[4] = 1
  }
}

export const montarCandelabroDeChao: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const R = Math.min(c.hw, c.hh)
  const metal = c.m.metal
  const L = cena.partes
  const zCoroa = g * ALTURA_DA_COROA
  const rMastro = RAIO_DO_MASTRO * R
  const rSoquete = RAIO_DO_SOQUETE * R
  const rPrato = RAIO_DO_PRATO * R
  const angulos = Array.from({ length: VELAS }, (_, i) => ANGULO_DA_PRIMEIRA_VELA + (i * 2 * Math.PI) / VELAS)

  // O mastro e o soquete são colunas. A sombra comprida do mastro e a da coroa, lá no fim dela, ficam presas ao
  // chão (z = 0, como a do poste do lampião): com altura, a da coroa viraria uma estrutura e os pés subiriam com ela.
  const [sx, sy] = [SOMBRA_X * zCoroa, SOMBRA_Y * zCoroa]
  const rCoroa = (RAIO_DO_ANEL + RAIO_DO_PRATO) * R
  // No candelabro esticado o pé cresce e o soquete cresce com ele, para continuar a esconder o pé de trás.
  const zSoquete = Math.max(g * ALTURA_DO_SOQUETE, (COMPRIMENTO_DO_PE + RAIO_DA_SAPATA) * R - rSoquete * FOLGA_DO_SOQUETE)
  cena.sombras.push(
    contato(elipse(0, 0, rSoquete * 1.3, rSoquete * 1.3), 0.32),
    { forma: capsula(0, 0, sx, sy, rMastro * 1.15), z: 0, suave: 1.4, forca: 0.3 },
    { forma: elipse(sx, sy, rCoroa, rCoroa), z: 0, suave: 4.5, forca: 0.17 },
    { forma: elipse(0, 0, rSoquete, rSoquete), z: zSoquete },
    { forma: elipse(0, 0, rMastro, rMastro), z: zCoroa },
  )
  const rNo = RAIO_DO_NO * R
  for (const alto of NOS_DO_MASTRO) cena.sombras.push({ forma: elipse(0, 0, rNo, rNo), z: g * alto, solta: true, forca: 0 })

  // Os PÉS: a perna do soquete até a sapata redonda, rente ao chão.
  for (const [i, a] of ANGULOS_DOS_PES.entries()) {
    const [x, y] = polar(COMPRIMENTO_DO_PE * R, a)
    const pe = uniao(capsula(0, 0, x, y, GROSSURA_DO_PE * R), elipse(x, y, RAIO_DA_SAPATA * R, RAIO_DA_SAPATA * R))
    const [mx, my] = polar(MEIO_SEGURO_DO_PE * R, a)
    cena.sombras.push(contato(pe, 0.3))
    L.push(P(comMeioEm(pe, mx, my), metal, { bisel: GROSSURA_DO_PE * R, contorno: 0.26, tom: TOM_DOS_PES, semente: 480 + i }))
  }

  // A COROA, presa ao mastro: os braços em redemoinho, o prato de cada vela (com a cera que escorreu) e o cubo.
  for (const [i, a] of angulos.entries()) {
    const pontos = CURVA_DO_BRACO.map(([raio, atraso]): Ponto => polar(raio * R, a - atraso))
    const braco = cadeia(pontos, GROSSURA_DO_BRACO * R)
    L.push(P(comMeioEm(braco, 0, 0), metal, { bisel: GROSSURA_DO_BRACO * R, contorno: 0.24, tom: 0.94, semente: 490 + i, projeta: { dist: 1, forca: 0.22, suave: 0.6 } }))
  }
  for (const [i, a] of angulos.entries()) {
    const [x, y] = polar(RAIO_DO_ANEL * R, a)
    const escorre = i % 2 === 0 ? 1 : -1
    L.push(P(comMeioEm(elipse(x, y, rPrato, rPrato), 0, 0), metal, { bisel: rPrato * 0.32, contorno: 0.28, semente: 500 + i, projeta: { dist: 1.3, forca: 0.3 } }))
    L.push(P(comMeioEm(elipse(x, y, rPrato * 0.74, rPrato * 0.74), 0, 0), metal, { bisel: 0, tom: 0.78, contorno: 0.1, recesso: { k: 0.9, forca: 0.32 }, semente: 510 + i }))
    L.push(P(comMeioEm(elipse(x + escorre * rPrato * 0.3, y + rPrato * 0.26, rPrato * 0.4, rPrato * 0.33), 0, 0), CERA, { bisel: rPrato * 0.12, tom: 0.9, contorno: 0.14, semente: 520 + i }))
  }
  const rCubo = RAIO_DO_CUBO * R
  L.push(P(elipse(0, 0, rCubo, rCubo), metal, { bisel: rCubo * 0.55, contorno: 0.28, semente: 530, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(elipse(0, 0, rCubo * 0.48, rCubo * 0.48), metal, { bisel: rCubo * 0.48, contorno: 0.2, tom: 1.12, semente: 531 }))

  // As VELAS, do fundo para a frente: o alto de cera com a cova derretida e o pavio, o halo e a chama.
  const rVela = RAIO_DA_VELA * R
  const rHalo = RAIO_DO_HALO * R
  const [ux, uy] = desgirado(0, -1, c.giro)
  const [comprida, larga] = [COMPRIMENTO_DA_CHAMA * R, LARGURA_DA_CHAMA * R]
  const centros = angulos.map((a) => polar(RAIO_DO_ANEL * R, a)).sort((p, q) => p[1] - q[1])
  for (const [i, [x, y]] of centros.entries()) {
    const alto = elipse(x, y, rVela, rVela)
    // O tampo da vela não faz sombra no chão (a da coroa já a cobre): só dá à 3/4 a altura e o corpo de cera.
    cena.sombras.push({ forma: naOrdemDaFrente(alto, R), z: zCoroa + ALTURA_DA_VELA_DO_CANDELABRO, solta: true, forca: 0, suave: 0.5 })
    L.push(P(alto, CERA, { bisel: rVela * 0.4, contorno: 0.2, semente: 540 + i }))
    L.push(P(elipse(x, y, rVela * 0.56, rVela * 0.56), CERA, { bisel: 0, tom: 0.92, contorno: 0, recesso: { k: 0.5, forca: 0.2 }, semente: 550 + i }))
    L.push(P(elipse(x, y, rVela * 0.17, rVela * 0.17), BURACO, { bisel: 0, contorno: 0, semente: 560 + i }))
    // O halo e a chama ficam acima do pavio, mas a caixa de cada um é centrada na vela: sobem com o alto dela.
    const [cx, cy] = [x + ux * SUBIDA_DA_CHAMA * comprida, y + uy * SUBIDA_DA_CHAMA * comprida]
    L.push(P(comMeioEm(elipse(cx, cy, rHalo, rHalo), x, y), CERA_DO_CORPO, { bisel: 0, contorno: 0, textura: texHalo(cx, cy, rHalo), semente: 570 + i }))
    const textura = texChama(cx - ux * comprida, cy - uy * comprida, ux, uy, 2 * comprida)
    L.push(P(comMeioEm(gotaDaChama(cx, cy, ux, uy, comprida, larga), x, y), CHAMA, { bisel: 0, contorno: 0, suave: 0.6, textura, semente: 580 + i }))
  }
}
