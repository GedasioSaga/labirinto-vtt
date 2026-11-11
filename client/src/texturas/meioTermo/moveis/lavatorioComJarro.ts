/**
 * LAVATÓRIO COM JARRO de cima com volume (lote 5 dos objetos novos,
 * 11/11/2026): a mesinha de lavar o rosto do quarto. De cima aparecem o TAMPO
 * de tábuas com a quina clara, o ESPALDAR no fundo (a tábua em pé que apara
 * os respingos, com a sombra dela no tampo), a BACIA de louça com o filete
 * azul e a água (a sombra da borda, a beira rasa, o reflexo), o JARRO de louça
 * ao lado (o bojo redondo, o filete, o gargalo com o bico virado para a bacia
 * e a asa para o outro lado), o SABÃO no pires e, na frente, a BARRA de latão
 * presa por dois braços, com a TOALHA dobrada por cima. A frente é o lado de
 * baixo.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura; cada peça
 * sobe com a mais alta que contém o meio da caixa dela) tudo usa a mesma
 * beirada, `ESPESSURA_DO_LAVATORIO`, que o perfil usa:
 * - o TAMPO é um tampo solto, e a beirada dele é a saia da mesinha;
 * - as quatro PERNAS são colunas sem peça, escondidas debaixo do tampo na
 *   vista de cima (a frente delas é a madeira do tampo);
 * - o ESPALDAR é um tampo solto uma beirada acima do tampo: fica em pé no
 *   fundo dele;
 * - a TOALHA é um tampo solto na frente, na altura do tampo: desce a beirada
 *   por cima da saia e passa dela (está mais à frente). A barra sobe com ela
 *   e os braços, com o tampo: ficam na mesma altura.
 * A bacia, o jarro e o sabão sobem com o tampo, como estão.
 *
 * A 25% de zoom sobram o tampo escuro com os dois discos brancos (o grande com
 * o miolo azul) e a faixa da toalha na frente: é o que diz "lavatório" e não
 * "mesa" nem "pia". A bacia, o jarro e o sabão têm o tamanho do menor lado; os
 * lugares são frações da pegada (1 x 0,6 casa de partida). Materiais:
 * `madeira` e `toalha`. A louça, a água, o sabão e o latão são fixos.
 */
import { limitar01, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, caixa, capsula, elipse, elipseGirada, uniao, type Forma } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, LENCOL, materialDaPeca, type MontarMovel } from './contexto'

/** O desenho foi medido em 1 x 0,6 casa (28 e 16,8 px de meio lado): as medidas miúdas escalam pelo que apertar primeiro. */
const MEIA_LARGURA_DE_PARTIDA = 0.5 * G
const MEIA_FUNDURA_DE_PARTIDA = 0.3 * G
const GRAUS = Math.PI / 180

/** A altura do tampo, em casas. */
const ALTURA = 0.72
/** A beirada de tudo na 3/4 (px do protótipo): a saia do tampo, o espaldar e a queda da toalha. O perfil do lavatório em `tresQuartos.ts` usa este valor. */
export const ESPESSURA_DO_LAVATORIO = 0.2 * G
/** Quanto a perna entra na saia (px do protótipo): só para não abrir fresta. */
const ENCAIXE_DA_PERNA = 0.6

/** A folga do tampo até a beira da pegada, a faixa da barra na frente, a fundura do espaldar e a meia perna (px da pegada de partida). */
const FOLGA = 0.4
const FAIXA_DA_BARRA = 4.8
const ESPALDAR = 2.8
const MEIA_PERNA = 1.6
const RECUO_DA_PERNA = 0.5
/** A quina clara do tampo: a largura da faixa (px) e a luz somada na beira, caindo até zero no fim dela. */
const QUINA_CLARA = 2.6
const LUZ_DA_QUINA = 0.16

/** Onde ficam a bacia, o jarro e o pires do sabão, em frações da meia largura. */
const LUGAR_DA_BACIA = -0.5
const LUGAR_DO_JARRO = 0.43
const LUGAR_DO_SABAO = 0.64
/** A bacia não passa desta fração da meia largura; a folga dela até o espaldar e até a frente (px). */
const BACIA_MAXIMA = 0.42
const FOLGA_DA_BACIA = 1.2
/** O raio do bojo do jarro (px) e quanto ele fica para o fundo do meio do tampo. */
const RAIO_DO_JARRO = 7.4
const JARRO_PARA_O_FUNDO = 2.2
/** Para onde aponta o bico do jarro, em graus (180 = a esquerda, onde está a bacia; mais que isso, um pouco para o fundo). */
const BICO_DO_JARRO = 205

/** A barra da toalha: até onde vai (fração da meia largura), a toalha de um lado e do outro e a meia fundura dela (px). */
const MEIA_BARRA = 0.54
const TOALHA_A_ESQUERDA = -0.4
const TOALHA_A_DIREITA = 0.34
const MEIA_TOALHA = 2.1
/** As duas listras claras da toalha: quanto cada uma fica antes da ponta direita (px). */
const LISTRAS_DA_TOALHA: readonly number[] = [2.4, 4.4]
/** Quanto os braços da barra entram no tampo (px): o meio de cada um tem de cair dentro dele, para subirem juntos na 3/4. */
const BRACO_NO_TAMPO = 3.6

/** A louça, como a dos pratos, e o filete azul pintado nela (um cobalto calmo). */
const LOUCA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('branco', 0.93)) }
const FILETE: MaterialDaPeca = { classe: 'liso', rgb: [0x5b, 0x7a, 0xa6] }
/** A água da bacia: o azul-petróleo do Meio-Termo bem claro (é rasa, sobre louça), a beira rasa e o reflexo. */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 1.36)) }
const AGUA_RASA: Rgb = [0xb4, 0xd0, 0xcf]
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xea, 0xe6] }
/** A boca do jarro (a água lá no fundo, na sombra do gargalo) e o sabão amarelado. */
const BOCA_DO_JARRO: MaterialDaPeca = { classe: 'liso', rgb: [0x64, 0x74, 0x78] }
const SABAO: MaterialDaPeca = { classe: 'liso', rgb: [0xcf, 0xb0, 0x78] }

/** Para o lado da luz, no chão (os mesmos números do motor): a borda desse lado faz sombra na água. */
const PARA_A_LUZ_X = -0.79
const PARA_A_LUZ_Y = -0.61
/** O comprimento da sombra da borda na água e o borrão dela (px), quanto ela escurece, e a beira rasa. */
const SOMBRA_DA_BORDA = 2
const BORRAO_DA_SOMBRA = 1.5
const FORCA_DA_SOMBRA = 0.24
const RASO = 3.4
const COR_DO_RASO = 0.6

/** A água da bacia: a sombra da borda do lado da luz, a beira rasa (a louça aparece por baixo) e a marola miúda. */
function texDaAgua(agua: Forma, k: number, sem: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const naSombra = limitar01(0.5 + agua.d(x + PARA_A_LUZ_X * SOMBRA_DA_BORDA * k, y + PARA_A_LUZ_Y * SOMBRA_DA_BORDA * k) / (BORRAO_DA_SOMBRA * k))
    const rasa = limitar01(1 + agua.d(x, y) / (RASO * k))
    const t = rasa * rasa * COR_DO_RASO
    s[0] += (AGUA_RASA[0] - s[0]) * t
    s[1] += (AGUA_RASA[1] - s[1]) * t
    s[2] += (AGUA_RASA[2] - s[2]) * t
    s[3] += ruido((x / k) * 0.16 + sem, (y / k) * 0.16) * 0.07 - FORCA_DA_SOMBRA * naSombra
  }
}

const daMadeira = texturaDaClasse('madeira')

/** O veio do tampo com a quina clara: a beira gasta de mão pega luz, como na mesa. */
function texDoTampo(tampo: Forma, k: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (daMadeira !== null) daMadeira(u, v, x, y, p, s, escala)
    const t = -tampo.d(x, y)
    if (t < QUINA_CLARA * k) s[3] += LUZ_DA_QUINA * (1 - (t > 0 ? t : 0) / (QUINA_CLARA * k))
  }
}

export const montarLavatorioComJarro: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const toalha = c.m.toalha
  const latao = materialDaPeca('latao')
  const k = Math.min(hw / MEIA_LARGURA_DE_PARTIDA, hh / MEIA_FUNDURA_DE_PARTIDA)
  const L = cena.partes
  const xTampo = hw - FOLGA * k
  const yFundo = -hh + FOLGA * k
  const yFrente = hh - FAIXA_DA_BARRA * k
  const yEspaldar = yFundo + ESPALDAR * k
  const zTampo = g * ALTURA
  const tampo = caixa(-xTampo, yFundo, xTampo, yFrente, 1.3 * k)
  const espaldar = caixa(-xTampo, yFundo, xTampo, yEspaldar, 0.7 * k)

  // As sombras são as alturas da 3/4: a de baixo (pesada, logo em volta), o tampo e o espaldar soltos, e as quatro pernas.
  const alem = 1.2 * k
  cena.sombras.push(
    { forma: caixa(-xTampo - alem, yFundo - alem, xTampo + alem, yFrente + alem, 1.3 * k + alem), z: 0, suave: alem, forca: 0.3 },
    { forma: tampo, z: zTampo, solta: true, suave: 1.8, forca: 0.24 },
    { forma: espaldar, z: zTampo + ESPESSURA_DO_LAVATORIO, solta: true, forca: 0.2 },
  )
  const zPerna = zTampo - ESPESSURA_DO_LAVATORIO + ENCAIXE_DA_PERNA
  const meiaPerna = MEIA_PERNA * k
  const recuoDaPerna = (RECUO_DA_PERNA + MEIA_PERNA) * k
  for (const x of [-xTampo + recuoDaPerna, xTampo - recuoDaPerna]) {
    for (const y of [yFundo + recuoDaPerna, yFrente - recuoDaPerna]) {
      const perna = caixa(x - meiaPerna, y - meiaPerna, x + meiaPerna, y + meiaPerna, 0.3 * k)
      cena.sombras.push({ forma: perna, z: zPerna, suave: 0.9, forca: 0.3 }, contato(perna, 0.34))
    }
  }

  // O TAMPO de tábuas ao comprido, com a quina clara.
  L.push(P(tampo, mad, { tabua: 6.4 * k, bisel: 1.2 * k, contorno: 0.24, textura: texDoTampo(tampo, k), semente: 6301 }))

  // Os dois BRAÇOS da barra da toalha, deitados no tampo e saindo pela frente.
  const xBarra = hw * MEIA_BARRA
  const yBarra = hh - (FAIXA_DA_BARRA * k) / 2 + 0.1 * k
  for (const lado of [-1, 1]) {
    L.push(P(capsula(lado * xBarra, yFrente - BRACO_NO_TAMPO * k, lado * xBarra, yBarra, 0.7 * k), latao, { bisel: 0.6 * k, metal: 0.45, contorno: 0.26, semente: 6302 + lado, projeta: { dist: 0.8 * k, forca: 0.26 } }))
  }

  // O ESPALDAR no fundo: a tábua em pé, mais clara em cima, com a sombra dela no tampo.
  L.push(P(espaldar, mad, { tabua: 0, bisel: 0.9 * k, tom: 1.12, contorno: 0.24, semente: 6304, projeta: { dist: 2.8 * k, forca: 0.34 } }))

  // A BACIA de louça: a borda roliça com o filete azul, o fundo cavado e a água.
  const yMeio = (yEspaldar + yFrente) / 2
  const rBacia = Math.min((yFrente - yEspaldar) / 2 - FOLGA_DA_BACIA * k, hw * BACIA_MAXIMA)
  const xBacia = hw * LUGAR_DA_BACIA
  const bacia = (encolhe: number): Forma => elipse(xBacia, yMeio, rBacia - encolhe * k, rBacia - encolhe * k)
  L.push(P(bacia(0), LOUCA, { bisel: 1.9 * k, contorno: 0.24, semente: 6310, projeta: { dist: 1.8 * k, forca: 0.32 } }))
  L.push(P(anel(xBacia, yMeio, rBacia - 0.8 * k, rBacia - 0.8 * k, rBacia - 1.35 * k, rBacia - 1.35 * k), FILETE, { bisel: 0, contorno: 0, alfa: 0.8, semente: 6311 }))
  L.push(P(bacia(2.1), LOUCA, { bisel: 0, tom: 0.88, contorno: 0, recesso: { k: 2.6 * k, forca: 0.34 }, semente: 6312 }))
  const agua = bacia(4.4)
  L.push(P(agua, AGUA, { bisel: 0, contorno: 0.14, textura: texDaAgua(agua, k, 6313), semente: 6313 }))
  L.push(P(elipse(xBacia + rBacia * 0.14, yMeio + rBacia * 0.24, rBacia * 0.3, 0.6 * k), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.34, suave: 0.8 * k, semente: 6314 }))

  // O JARRO de louça: o bojo redondo com o filete, o gargalo com o bico, a boca escura e a asa.
  const rJarro = Math.min(RAIO_DO_JARRO * k, rBacia * 0.7)
  const xJarro = hw * LUGAR_DO_JARRO
  const yJarro = yMeio - JARRO_PARA_O_FUNDO * k
  const bx = Math.cos(BICO_DO_JARRO * GRAUS)
  const by = Math.sin(BICO_DO_JARRO * GRAUS)
  const noJarro = (fracao: number): Forma => elipse(xJarro, yJarro, rJarro * fracao, rJarro * fracao)
  L.push(P(noJarro(1), LOUCA, { bisel: rJarro * 0.62, contorno: 0.26, semente: 6320, projeta: { dist: 3 * k, forca: 0.34 } }))
  L.push(P(anel(xJarro, yJarro, rJarro * 0.84, rJarro * 0.84, rJarro * 0.75, rJarro * 0.75), FILETE, { bisel: 0, contorno: 0, alfa: 0.62, semente: 6321 }))
  // A asa sai do gargalo para o lado contrário do bico e passa do bojo.
  L.push(P(capsula(xJarro - bx * rJarro * 0.44, yJarro - by * rJarro * 0.44, xJarro - bx * rJarro * 1.2, yJarro - by * rJarro * 1.2, rJarro * 0.19), LOUCA, { bisel: rJarro * 0.15, contorno: 0.28, semente: 6322, projeta: { dist: 1.5 * k, forca: 0.3 } }))
  const bico = elipseGirada(xJarro + bx * rJarro * 0.68, yJarro + by * rJarro * 0.68, rJarro * 0.4, rJarro * 0.21, BICO_DO_JARRO * GRAUS)
  L.push(P(uniao(noJarro(0.52), bico), LOUCA, { bisel: rJarro * 0.12, tom: 1.03, contorno: 0.26, semente: 6323, projeta: { dist: 1.1 * k, forca: 0.28 } }))
  const canal = elipseGirada(xJarro + bx * rJarro * 0.56, yJarro + by * rJarro * 0.56, rJarro * 0.36, rJarro * 0.1, BICO_DO_JARRO * GRAUS)
  L.push(P(uniao(noJarro(0.37), canal), BOCA_DO_JARRO, { bisel: 0, contorno: 0.1, recesso: { k: 1.2 * k, forca: 0.4 }, semente: 6324 }))

  // O SABÃO no pires, na frente do jarro.
  const xSabao = hw * LUGAR_DO_SABAO
  const ySabao = yFrente - 3.7 * k
  L.push(P(elipse(xSabao, ySabao, 3.7 * k, 2.6 * k), LOUCA, { bisel: 0.8 * k, contorno: 0.24, semente: 6330, projeta: { dist: 0.9 * k, forca: 0.28 } }))
  L.push(P(caixa(xSabao - 2.1 * k, ySabao - 1.25 * k, xSabao + 2.1 * k, ySabao + 1.25 * k, 0.8 * k), SABAO, { bisel: 0.8 * k, contorno: 0.22, semente: 6331, projeta: { dist: 0.5 * k, forca: 0.2 } }))

  // A BARRA de latão e a TOALHA dobrada por cima dela: a tira da toalha é a estrutura que desce pela frente na 3/4.
  L.push(P(capsula(-xBarra, yBarra, xBarra, yBarra, 0.75 * k), latao, { bisel: 0.6 * k, metal: 0.5, contorno: 0.26, semente: 6340 }))
  const tira = caixa(hw * TOALHA_A_ESQUERDA, yBarra - MEIA_TOALHA * k, hw * TOALHA_A_DIREITA, yBarra + MEIA_TOALHA * k, 0.8 * k)
  cena.sombras.push({ forma: tira, z: zTampo, solta: true, forca: 0 }, contato(tira, 0.2))
  L.push(P(tira, toalha, { bisel: 1.3 * k, ruga: 0.4, contorno: 0.26, semente: 6341 }))
  // As duas listras da barra da toalha, perto de uma ponta (as mesmas da toalha da banheira).
  for (const antes of LISTRAS_DA_TOALHA) {
    const x = hw * TOALHA_A_DIREITA - antes * k
    L.push(P(caixa(x - 0.5 * k, yBarra - (MEIA_TOALHA - 0.4) * k, x + 0.5 * k, yBarra + (MEIA_TOALHA - 0.4) * k), LENCOL, { bisel: 0, contorno: 0, alfa: 0.8, semente: 6342 }))
  }
}
