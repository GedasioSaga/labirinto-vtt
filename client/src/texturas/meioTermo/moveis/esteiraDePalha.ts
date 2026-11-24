/**
 * ESTEIRA DE PALHA de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"; junta o monte de
 * palha e o enxergão). A cama do preso: um ENXERGÃO de palha velha, um retângulo baixo de quinas bem redondas,
 * comprido como um corpo e rente ao chão. A beira não tem contorno: quem a desenha são os FIOS que passam dela. Por
 * baixo, a palha pisada, mais escura; por cima, os FIOS deitados quase todos ao comprido (uns poucos mais tortos), cada
 * um com a sombra miúda que faz no de baixo; numa das pontas a palha se AMONTOA mais alta e mais clara, a CABECEIRA,
 * que dá a orientação; no meio, o FUNDO manso onde o corpo afunda; em volta, uns FIOS SOLTOS que escaparam para o
 * chão. A palha nunca é trançada aqui (ao contrário do assento da cadeira) nem vira bolo liso: é feita de fios. Cor de
 * feno apagado: a palha da tabela puxada para o cinza quente, com manchas castanhas mais velhas. Desenho original.
 *
 * Mora no chão (`ehMovelDoChao`), como o tapete: só sombras de chão, sem altura (o contato e a sombra pousada, uma
 * faixa estreita embaixo à direita, que tira a cara de adesivo). Na 3/4 (`alturaSolta` de 0,03 casa) sobe um fio e
 * fica como de cima. Medidas pela pegada (1 x 2 casas de partida): esticada, o enxergão estica junto e os fios ficam do
 * mesmo tamanho. Sem material escolhido: a palha é fixa.
 */
import { hash, limitar01, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, elipse, type Forma } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** O feno apagado: a palha do Meio-Termo puxada para o cinza quente. */
const FENO: Rgb = misturar(rgb(tomDoMeio('palha', 1)), [0x8a, 0x84, 0x74], 0.36)
const PALHA_VELHA: MaterialDaPeca = { classe: 'liso', rgb: FENO }
/** O castanho-feno da palha mais velha, em manchas (o cinza-esverdeado de antes deixava a base verde), e o escuro... */
const VELHA: Rgb = [0x8c, 0x7e, 0x62]
/** ...em que o pixel escuro demais é levantado. */
const ESCURO_DA_PALHA: Rgb = [0x4d, 0x44, 0x34]
/** O meio lado de partida, em px (a pegada de 1 x 2 casas): as medidas miúdas escalam por ele. */
const MEIA_LARGURA_DE_PARTIDA = 0.5 * G
/** O enxergão: a meia largura e o meio comprimento (frações da meia pegada) e o raio das quinas (fração da meia largura). */
const ENXERGAO = { rx: 0.8, ry: 0.88, quina: 0.62 } as const
/** A cabeceira, na ponta de cima: o meio e o meio comprimento do monte (frações do meio comprimento do enxergão). */
const CABECEIRA = { y: -0.7, ry: 0.24 } as const
/**
 * Os fios do monte e os soltos no chão; o comprimento e o raio de um fio (px de partida). 70% dos fios do monte ficam
 * a até 15 graus do comprimento; os outros, a até 40 graus. Um terço cai na cabeceira.
 */
const FIOS_DO_MONTE = 110
const FIOS_NO_CHAO = 18
const FIO = { de: 6, ate: 14, raio: 0.44, raioAMais: 0.18 } as const
const AO_COMPRIDO = { parte: 0.7, desvio: 0.26, desvioDosOutros: 0.7 } as const
const PARTE_NA_CABECEIRA = 0.33
/** O tom dos fios: o de baixo, quanto varia e o quanto os de cima e os da cabeceira clareiam (o claro 20% mais manso). */
const TOM_DO_FIO = { base: 0.8, varia: 0.22, deCima: 0.1, cabeceira: 0.08 } as const
/** O fundo onde o corpo afunda: o meio (frações da pegada) e os raios (frações do enxergão). Abaixo da cabeceira. */
const FUNDO = { x: 0.02, y: 0.12, rx: 0.52, ry: 0.5 } as const

/**
 * A palha solta: os fios correm ao longo de `u` (o eixo da peça). Ruído fino de través e longo ao comprido, que vira
 * fio sem virar listra reta, e manchas largas da palha mais velha, castanha.
 */
function texDaPalha(forca: number): Textura {
  return (u, v, x, y, p, s) => {
    s[3] += (ruido(u * 0.06 + p.su, v * 1.2 + p.sv) * 0.24 + ruido(u * 0.03 + 17, v * 2.6 + p.su) * 0.1) * forca
    const velha = limitar01((ruido(x * 0.09 + p.sv, y * 0.09 + p.su) + 0.05) * 1.8) * 0.4
    if (velha > 0) {
      s[0] += (VELHA[0] - s[0]) * velha
      s[1] += (VELHA[1] - s[1]) * velha
      s[2] += (VELHA[2] - s[2]) * velha
    }
  }
}

/** Um fio de palha: o traço de (x, y) no rumo dado, com o meio puxado `curva` px para o lado (a dobra leve). */
function fioDePalha(x: number, y: number, rumo: number, comprimento: number, curva: number, raio: number): Forma {
  const [co, si] = [Math.cos(rumo), Math.sin(rumo)]
  const meia = comprimento / 2
  return cadeia([[x - co * meia, y - si * meia], [x - si * curva, y + co * curva], [x + co * meia, y + si * meia]], raio)
}

/** O rumo de um fio do monte: quase todos ao comprido (o eixo y da pegada), uns poucos mais tortos. */
function rumoDoFio(i: number): number {
  const desvio = hash(i, 4, 2530) < AO_COMPRIDO.parte ? AO_COMPRIDO.desvio : AO_COMPRIDO.desvioDosOutros
  return Math.PI / 2 + (hash(i, 5, 2530) - 0.5) * 2 * desvio
}

export const montarEsteiraDePalha: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh / 2) / MEIA_LARGURA_DE_PARTIDA
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PALHA
  const [rx, ry] = [hw * ENXERGAO.rx, hh * ENXERGAO.ry]
  const quina = rx * ENXERGAO.quina
  const enxergao = caixa(-rx, -ry, rx, ry, quina)
  const [cy, cry] = [CABECEIRA.y * ry, CABECEIRA.ry * ry]

  // As sombras de chão: o contato firme na beira e a sombra pousada, uma faixa estreita embaixo à direita.
  cena.sombras.push(contato(enxergao, 0.32), { forma: caixa(-rx + 1.2 * k, -ry + 1.4 * k, rx + 1.2 * k, ry + 1.4 * k, quina), z: 0, suave: 0.7 * k, forca: 0.3 })

  // Os FIOS no chão: saem da beira para fora, quase ao comprido, mansos.
  for (let i = 0; i < FIOS_NO_CHAO; i += 1) {
    const a = hash(i, 1, 2520) * Math.PI * 2
    const naBeira = 0.92 + 0.1 * hash(i, 2, 2520)
    const rumo = Math.PI / 2 + (hash(i, 3, 2520) - 0.5) * 1.2
    const comprimento = (FIO.de + (FIO.ate - FIO.de) * 0.6 * hash(i, 4, 2520)) * k
    const fio = fioDePalha(Math.cos(a) * rx * naBeira, Math.sin(a) * ry * naBeira, rumo, comprimento, (hash(i, 5, 2520) - 0.5) * 1.4 * k, FIO.raio * k)
    cena.sombras.push(contato(fio, 0.2))
    L.push(P(fio, PALHA_VELHA, { eixo: rumo, tabua: 0, bisel: 0.35 * k, tom: 0.82 + 0.24 * hash(i, 6, 2520), contorno: 0.12, textura: texDaPalha(0.5), semente: 25200 + i }))
  }

  // A palha PISADA por baixo: mais escura, baixa, sem contorno (a beira é dos fios).
  L.push(P(enxergao, PALHA_VELHA, { eixo: Math.PI / 2, tabua: 0, bisel: 1.2 * k, tom: 0.72, contorno: 0, textura: texDaPalha(1.3), semente: 25100 }))
  // A CABECEIRA: a palha amontoada na ponta de cima, mais clara, que faz uma sombra mansa no resto.
  L.push(P(elipse(0, cy, rx * 0.86, cry), PALHA_VELHA, { eixo: Math.PI / 2, tabua: 0, bisel: 0, contorno: 0, tom: 0.9, alfa: 0.7, suave: 3 * k, textura: texDaPalha(1), semente: 25110, projeta: { dist: 1.4 * k, forca: 0.22, suave: 1.6 * k } }))

  // Os FIOS do monte: espalhados pelo enxergão (os da beira passam dela), um terço na cabeceira; os de cima e os da
  // cabeceira mais claros. No fundo do corpo, os fios de cima são poucos (a palha está amassada ali).
  const [fx, fy, frx, fry] = [FUNDO.x * hw, FUNDO.y * hh, FUNDO.rx * rx, FUNDO.ry * ry]
  for (let i = 0; i < FIOS_DO_MONTE; i += 1) {
    const naCabeceira = hash(i, 1, 2530) < PARTE_NA_CABECEIRA
    const x = (hash(i, 2, 2530) - 0.5) * 2 * rx * 0.9
    const y = naCabeceira ? cy + (hash(i, 3, 2530) - 0.5) * 2 * cry * 1.1 : (hash(i, 3, 2530) - 0.5) * 2 * ry * 0.92
    const deCima = i / FIOS_DO_MONTE
    const noFundo = ((x - fx) / frx) ** 2 + ((y - fy) / fry) ** 2 < 0.8
    if (noFundo && deCima > 0.55 && hash(i, 9, 2530) < 0.7) continue
    const rumo = rumoDoFio(i)
    const comprimento = (FIO.de + (FIO.ate - FIO.de) * hash(i, 6, 2530)) * k
    const raio = (FIO.raio + FIO.raioAMais * hash(i, 7, 2530)) * k
    const fio = fioDePalha(x, y, rumo, comprimento, (hash(i, 8, 2530) - 0.5) * 1.6 * k, raio)
    const tom = TOM_DO_FIO.base + TOM_DO_FIO.varia * hash(i, 10, 2530) + TOM_DO_FIO.deCima * deCima + (naCabeceira ? TOM_DO_FIO.cabeceira : 0)
    L.push(P(fio, PALHA_VELHA, { eixo: rumo, tabua: 0, bisel: raio * 0.8, tom, contorno: 0.1, textura: texDaPalha(0.5), semente: 25300 + i, projeta: { dist: 0.6 * k, forca: 0.16, suave: 0.5 * k } }))
    // O FUNDO onde o corpo afunda entra depois da camada de baixo: a palha amassada, com a beira fazendo sombra para dentro.
    if (i === Math.floor(FIOS_DO_MONTE * 0.55)) {
      L.push(P(elipse(fx, fy, frx, fry), PALHA_VELHA, { eixo: Math.PI / 2, tabua: 0, bisel: 0, contorno: 0, tom: 0.8, alfa: 0.36, suave: 4.5 * k, recesso: { k: 2.4 * k, forca: 0.26 }, textura: texDaPalha(0.8), semente: 25140 }))
    }
  }
}
