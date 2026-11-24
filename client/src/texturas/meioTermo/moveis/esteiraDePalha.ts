/**
 * ESTEIRA DE PALHA de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"; junta o monte de
 * palha e o enxergão). A cama do preso: um MONTE ACHATADO de palha velha, comprido como um corpo, de beira torta,
 * rente ao chão. Por baixo, a palha pisada, mais escura; por cima, os FIOS deitados quase todos ao comprido (uns
 * tortos, uns de través), cada um com a sombra miúda que faz no de baixo, os de cima mais claros; no meio, o FUNDO
 * onde o corpo afunda; em volta, os FIOS SOLTOS que escaparam para o chão. A palha nunca é trançada aqui (ao
 * contrário do assento da cadeira) nem vira bolo liso: é feita de fios. Cor de feno apagado: a palha da tabela
 * puxada para o cinza, com manchas mais velhas. Desenho original.
 *
 * Mora no chão (`ehMovelDoChao`), como o tapete: só sombras de chão, sem altura (o contato e a sombra mansa deitada
 * para baixo à direita). Na 3/4 (`alturaSolta` de 0,03 casa) sobe um fio e fica como de cima. Medidas pela pegada (1 x 2
 * casas de partida): esticada, o monte estica junto e os fios ficam do mesmo tamanho. Sem material escolhido: a palha
 * é fixa.
 */
import { hash, limitar01, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** O feno apagado: a palha do Meio-Termo puxada para o cinza quente. */
const FENO: Rgb = misturar(rgb(tomDoMeio('palha', 1)), [0x8a, 0x84, 0x74], 0.36)
const PALHA_VELHA: MaterialDaPeca = { classe: 'liso', rgb: FENO }
/** O cinza-esverdeado da palha mais velha, em manchas, e o escuro em que o pixel escuro demais é levantado. */
const VELHA: Rgb = [0x86, 0x82, 0x6c]
const ESCURO_DA_PALHA: Rgb = [0x4d, 0x44, 0x34]
/** O meio lado de partida, em px (a pegada de 1 x 2 casas): as medidas miúdas escalam por ele. */
const MEIA_LARGURA_DE_PARTIDA = 0.5 * G
/** Quantos pontos tem a beira torta do monte e quanto ela entra e sai (fração do raio). */
const PONTOS_DA_BEIRA = 26
const TORTO = 0.1
/** Os fios do monte (por cima da palha pisada) e os soltos no chão; o comprimento e o raio de um fio (px de partida). */
const FIOS_DO_MONTE = 170
const FIOS_NO_CHAO = 22
const FIO = { de: 6, ate: 14, raio: 0.44, raioAMais: 0.18 } as const
/** O fundo onde o corpo afunda: o meio (frações da pegada) e os raios (frações do monte). */
const FUNDO = { x: 0.02, y: -0.08, rx: 0.5, ry: 0.56 } as const

/**
 * A palha solta: os fios correm ao longo de `u` (o eixo da peça). Ruído fino de través e longo ao comprido, que vira
 * fio sem virar listra reta, e manchas largas da palha mais velha, acinzentada.
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

/** A beira torta do monte: a elipse da pegada com cada ponto entrando ou saindo um pouco, e (dx, dy) de deslocamento. */
function beiraDoMonte(rx: number, ry: number, dx = 0, dy = 0): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < PONTOS_DA_BEIRA; i += 1) {
    const a = (i / PONTOS_DA_BEIRA) * Math.PI * 2
    const f = 1 + (hash(i, 7, 2510) - 0.5) * 2 * TORTO
    pontos.push([dx + Math.cos(a) * rx * f, dy + Math.sin(a) * ry * f])
  }
  return poligono(pontos)
}

/** Um fio de palha: o traço de (x, y) no rumo dado, com o meio puxado `curva` px para o lado (a dobra leve). */
function fioDePalha(x: number, y: number, rumo: number, comprimento: number, curva: number, raio: number): Forma {
  const [co, si] = [Math.cos(rumo), Math.sin(rumo)]
  const meia = comprimento / 2
  return cadeia([[x - co * meia, y - si * meia], [x - si * curva, y + co * curva], [x + co * meia, y + si * meia]], raio)
}

export const montarEsteiraDePalha: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh / 2) / MEIA_LARGURA_DE_PARTIDA
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PALHA
  const [rx, ry] = [hw * 0.8, hh * 0.86]
  const monte = beiraDoMonte(rx, ry)

  // As sombras de chão: a mansa, deitada para baixo à direita, e o contato firme na beira.
  cena.sombras.push({ forma: beiraDoMonte(rx, ry, 2.2 * k, 2.6 * k), z: 0, suave: 3 * k, forca: 0.24 }, contato(monte, 0.3))

  // Os FIOS no chão: saem da beira para fora, cada um no rumo dele, com o contato.
  for (let i = 0; i < FIOS_NO_CHAO; i += 1) {
    const a = hash(i, 1, 2520) * Math.PI * 2
    const naBeira = 0.86 + 0.12 * hash(i, 2, 2520)
    const rumo = a + (hash(i, 3, 2520) - 0.5) * 1.4
    const comprimento = (FIO.de + (FIO.ate - FIO.de) * 0.6 * hash(i, 4, 2520)) * k
    const fio = fioDePalha(Math.cos(a) * rx * naBeira, Math.sin(a) * ry * naBeira, rumo, comprimento, (hash(i, 5, 2520) - 0.5) * 1.4 * k, FIO.raio * k)
    cena.sombras.push(contato(fio, 0.2))
    L.push(P(fio, PALHA_VELHA, { eixo: rumo, tabua: 0, bisel: 0.35 * k, tom: 0.8 + 0.4 * hash(i, 6, 2520), contorno: 0.14, textura: texDaPalha(0.5), semente: 25200 + i }))
  }

  // A palha PISADA por baixo: mais escura, de beira mansa e baixa.
  L.push(P(monte, PALHA_VELHA, { eixo: Math.PI / 2, tabua: 0, bisel: 2.4 * k, tom: 0.72, contorno: 0.22, textura: texDaPalha(1.3), semente: 25100 }))

  // Os FIOS do monte: mais juntos no meio, quase todos ao comprido; os de cima mais claros. No fundo do corpo, os fios
  // de cima são poucos (a palha está amassada ali).
  const [fx, fy, frx, fry] = [FUNDO.x * hw, FUNDO.y * hh, FUNDO.rx * rx, FUNDO.ry * ry]
  for (let i = 0; i < FIOS_DO_MONTE; i += 1) {
    const r = Math.sqrt(hash(i, 1, 2530)) * 0.9
    const a = hash(i, 2, 2530) * Math.PI * 2
    const [x, y] = [Math.cos(a) * r * rx, Math.sin(a) * r * ry]
    const deCima = i / FIOS_DO_MONTE
    const noFundo = ((x - fx) / frx) ** 2 + ((y - fy) / fry) ** 2 < 0.8
    if (noFundo && deCima > 0.55 && hash(i, 3, 2530) < 0.7) continue
    const atravessado = hash(i, 4, 2530) < 0.14
    const rumo = atravessado ? hash(i, 5, 2530) * Math.PI : Math.PI / 2 + (hash(i, 5, 2530) - 0.5) * 1.1
    const comprimento = (FIO.de + (FIO.ate - FIO.de) * hash(i, 6, 2530)) * k
    const raio = (FIO.raio + FIO.raioAMais * hash(i, 7, 2530)) * k
    const fio = fioDePalha(x, y, rumo, comprimento, (hash(i, 8, 2530) - 0.5) * 1.6 * k, raio)
    const tom = 0.76 + 0.3 * hash(i, 9, 2530) + 0.16 * deCima
    L.push(P(fio, PALHA_VELHA, { eixo: rumo, tabua: 0, bisel: raio * 0.8, tom, contorno: 0.1, textura: texDaPalha(0.5), semente: 25300 + i, projeta: { dist: 0.6 * k, forca: 0.18, suave: 0.5 * k } }))
    // O FUNDO onde o corpo afunda entra depois da camada de baixo: a palha amassada, com a beira fazendo sombra para dentro.
    if (i === Math.floor(FIOS_DO_MONTE * 0.55)) {
      L.push(P(elipse(fx, fy, frx, fry), PALHA_VELHA, { eixo: Math.PI / 2, tabua: 0, bisel: 0, contorno: 0, tom: 0.8, alfa: 0.42, suave: 4.5 * k, recesso: { k: 2.4 * k, forca: 0.3 }, textura: texDaPalha(0.8), semente: 25140 }))
    }
  }
}
