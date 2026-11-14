/**
 * ARMÁRIO DE FERRO de cima com volume (14/11/2026, lote L05 dos objetos
 * novos, base militar): a fileira de armários de aço do alojamento, um por
 * soldado, pintada de verde-acinzentado. De cima aparece o TAMPO de chapa com
 * a dobra em volta e a junta entre um armário e outro, e o que se joga em
 * cima de um armário de quartel: o SACO de lona com as duas correias e a boca
 * franzida, e o CAPACETE. Na beira da frente despontam os PUXADORES e os
 * CADEADOS de latão.
 *
 * NA 3/4 A FRENTE MOSTRA AS PORTAS. A frente que a 3/4 varre sozinha
 * (`tresQuartos.ts`) é chapa lisa; as portas saem de estruturas finas coladas
 * na frente da pegada, cada uma com a caixa passando um nada da base do corpo
 * (para a 3/4 pintá-las depois dele): a JUNTA entre duas portas é uma coluna
 * de um terço de px; cada aleta das VENEZIANAS (em cima e embaixo de cada
 * porta), o PORTA-NOME, o PUXADOR e o CADEADO são tampos no ar, sem sombra,
 * na altura deles; o RODAPÉ escuro é o tampo mais baixo. A beirada de um
 * tampo leva o material da peça dele: as aletas, sem peça, saem da chapa do
 * corpo (a maior peça do armário); o porta-nome, o puxador, o cadeado e o
 * rodapé têm uma peça miúda colada na frente da pegada, que de cima é um fio
 * na beira (o puxador e o cadeado, que saem da porta de verdade, despontam).
 *
 * Uma porta a cada `LARGURA_DA_PORTA` casas (três no tamanho de partida, 1 x
 * 0,5). O saco e o capacete têm medida própria e ficam em cima do primeiro e
 * do último armário. Sem material escolhido: a pintura, a lona, o latão e o
 * cartão do nome são fixos.
 */
import { type Rgb } from '../../ruido'
import { anel, cadeia, caixa, capsula, elipse, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { QUARTO, type MontarMovel } from './contexto'

/** A pintura do aço: verde-acinzentado de quartel (saturação HSV 0,2), metal fosco. */
const PINTURA: MaterialDaPeca = { classe: 'metal', rgb: [0x76, 0x7c, 0x64] }
/** O rodapé e o fundo das juntas: a pintura bem escura. */
const ESCURO_DA_PINTURA: MaterialDaPeca = { classe: 'liso', rgb: [0x3f, 0x42, 0x37] }
/** A lona do saco, as correias, o capacete (pano de capa) e o latão. */
const LONA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xa9, 0x9e, 0x7c] }
const CORREIA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x5a, 0x5c, 0x45] }
const CAPACETE: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x5f, 0x66, 0x47] }
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x8f, 0x55] }
/** O puxador cromado e o cartão do porta-nome. */
const CROMO: MaterialDaPeca = { classe: 'metal', rgb: [0xb8, 0xb7, 0xb0] }
const CARTAO: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xd6, 0xc6] }
/** O escuro em que o pixel escuro demais é levantado: o verde-escuro da pintura (com a nogueira, a junta saía marrom). */
const ESCURO_DO_ARMARIO: Rgb = [0x45, 0x48, 0x3e]

/** A altura do armário, em casas (1,8 m). */
const ALTURA = 1.2
/** Uma porta a cada tanto de largura, em casas. */
const LARGURA_DA_PORTA = 0.34
/** A dobra da chapa em volta do tampo (px do protótipo). */
const DOBRA = 1.6
/** A junta entre dois armários (meia largura, px do protótipo). */
const MEIA_JUNTA = 0.35
/** As venezianas: aletas por grupo, o passo entre elas (px do protótipo), onde começa cada grupo (fração da altura, de cima para baixo) e o recuo dos lados (fração da porta). */
const ALETAS = 4
const PASSO_DA_ALETA = 4.6
const VENEZIANA_DE_CIMA = 0.93
const VENEZIANA_DE_BAIXO = 0.36
const RECUO_DA_ALETA = 0.2
/** O puxador (altura em fração da altura do armário e lugar em fração da porta, a partir do lado de fora) e o cadeado logo abaixo (px). */
const ALTURA_DO_PUXADOR = 0.52
const LUGAR_DO_PUXADOR = 0.2
const CADEADO_ABAIXO = 4.6
/** O porta-nome: a altura (fração) e a meia largura (fração da porta). */
const ALTURA_DO_NOME = 0.76
const MEIO_NOME = 0.16
/** O rodapé escuro, em casas. */
const ALTURA_DO_RODAPE = 0.07
/**
 * A tira de cada estrutura da frente, em px do protótipo a partir da frente da pegada ([de, até]; negativo é
 * para dentro). A 3/4 pinta primeiro a de base mais ao norte. As tiras de quem tem peça não se cruzam com as
 * outras no meio da peça: senão ela subiria com a estrutura mais alta (a aleta de cima levaria o porta-nome).
 */
const TIRA_DA_JUNTA = [-0.6, 0.3] as const
const TIRA_DA_ALETA = [-0.2, 0.35] as const
const TIRA_DO_RODAPE = [0.36, 0.5] as const
const TIRA_DO_NOME = [0.51, 0.65] as const
const TIRA_DO_PUXADOR = [-0.2, 1.15] as const
const TIRA_DO_CADEADO = [1.16, 2.7] as const
/** O saco de lona (comprimento e raio, px do protótipo) e o capacete (raio da copa e da aba). */
const SACO = 26
const RAIO_DO_SACO = 5.6
const COPA = 5.4
const ABA = 6.3
/** Os pedaços do arco da jugular. */
const PASSOS_DA_JUGULAR = 8

export const montarArmarioDeFerro: MontarMovel = (c, cena) => {
  const { hw, hh, w, g, peca: P } = c
  const Z = ALTURA * g
  const portas = Math.max(1, Math.round(w / (LARGURA_DA_PORTA * g)))
  const larguraDaPorta = w / portas
  const corpo = caixa(-hw, -hh, hw, hh, 0.9)
  cena.sombras.push({ forma: corpo, z: Z }, contato(corpo, 0.32))
  const L = cena.partes
  /** Uma estrutura sem sombra colada na frente, na `tira`: a 3/4 a pinta na altura `z`, depois do corpo. */
  const naFrente = (x0: number, x1: number, tira: readonly [number, number], z: number, coluna = false): void => {
    cena.sombras.push({ forma: caixa(x0, hh + tira[0], x1, hh + tira[1], 0.3), z, solta: !coluna, forca: 0 })
  }
  /** A peça miúda de uma tira (a que dá o material à beirada da estrutura dela). */
  const pecaDaTira = (x0: number, x1: number, tira: readonly [number, number], raio = 0): Forma => caixa(x0, hh + Math.max(tira[0], 0), x1, hh + tira[1], raio)

  // O tampo: a chapa com a dobra em volta e a junta entre os armários.
  L.push(P(corpo, PINTURA, { tabua: 0, bisel: 1.5, contorno: 0.3, metal: 0.25, semente: 600 }))
  L.push(P(caixa(-hw + DOBRA, -hh + DOBRA, hw - DOBRA, hh - DOBRA, 0.6), PINTURA, { tabua: 0, bisel: 0.6, contorno: 0.1, metal: 0.2, tom: 0.95, semente: 601 }))
  for (let k = 1; k < portas; k += 1) {
    const x = -hw + larguraDaPorta * k
    L.push(P(caixa(x - MEIA_JUNTA, -hh + 0.5, x + MEIA_JUNTA, hh - 0.5), ESCURO_DA_PINTURA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.75, semente: 602 + k }))
    naFrente(x - MEIA_JUNTA, x + MEIA_JUNTA, TIRA_DA_JUNTA, Z - 1, true)
  }

  // O saco de lona em cima do primeiro armário (deitado ao comprido, até o do lado), com as correias e a boca
  // franzida. No armário estreito demais para o saco e o capacete, fica só o capacete.
  const xSaco = -hw + Math.min(larguraDaPorta * 0.2, 4) + RAIO_DO_SACO
  const fimDoSaco = Math.min(xSaco + SACO - 2 * RAIO_DO_SACO, hw - 2 * ABA - RAIO_DO_SACO)
  const ySaco = -hh * 0.08
  if (fimDoSaco - xSaco >= RAIO_DO_SACO) {
    L.push(P(capsula(xSaco, ySaco, fimDoSaco, ySaco, RAIO_DO_SACO), LONA, { eixo: 0, bisel: RAIO_DO_SACO * 0.8, ruga: 1.3, semente: 610, projeta: { dist: 2, forca: 0.34, suave: 1.4 } }))
    for (const f of [0.3, 0.72]) {
      const x = xSaco + (fimDoSaco - xSaco) * f
      L.push(P(caixa(x - 1, ySaco - RAIO_DO_SACO * 0.98, x + 1, ySaco + RAIO_DO_SACO * 0.98, 0.5), CORREIA, { eixo: QUARTO, tabua: 0, bisel: 0.6, contorno: 0.2, semente: 611 }))
    }
    L.push(P(anel(fimDoSaco + RAIO_DO_SACO * 0.55, ySaco, RAIO_DO_SACO * 0.5, RAIO_DO_SACO * 0.62, RAIO_DO_SACO * 0.22, RAIO_DO_SACO * 0.3), LONA, { tabua: 0, bisel: 0.8, ruga: 2.4, tom: 0.84, semente: 612 }))
    L.push(P(elipse(fimDoSaco + RAIO_DO_SACO * 0.55, ySaco, RAIO_DO_SACO * 0.22, RAIO_DO_SACO * 0.3), ESCURO_DA_PINTURA, { tabua: 0, bisel: 0.4, contorno: 0.1, semente: 613 }))
  }

  // O capacete em cima do último armário: a aba, um nada maior que a copa, e a copa com o pano de capa.
  const xCap = hw - Math.max(larguraDaPorta / 2, ABA + 1)
  const yCap = hh * 0.12
  L.push(P(elipse(xCap, yCap, ABA, ABA * 0.94), CAPACETE, { tabua: 0, bisel: 0.9, contorno: 0.3, tom: 0.8, semente: 620, projeta: { dist: 1.8, forca: 0.36, suave: 1.2 } }))
  // A jugular solta, caída para a frente da aba, com a fivela: é o que separa o capacete de uma tampa de panela.
  const jugular: Ponto[] = []
  for (let i = 0; i <= PASSOS_DA_JUGULAR; i += 1) {
    const a = Math.PI * (0.18 + (0.64 * i) / PASSOS_DA_JUGULAR)
    jugular.push([xCap + Math.cos(a) * (ABA + 1.1), yCap + Math.sin(a) * (ABA + 1.1) * 0.94])
  }
  L.push(P(cadeia(jugular, 0.5), CORREIA, { tabua: 0, bisel: 0.3, contorno: 0.3, semente: 622, projeta: { dist: 0.7, forca: 0.3 } }))
  L.push(P(caixa(xCap - 1, yCap + (ABA + 1.1) * 0.94 - 0.8, xCap + 1, yCap + (ABA + 1.1) * 0.94 + 0.8, 0.3), CROMO, { tabua: 0, bisel: 0.4, contorno: 0.3, metal: 0.5, tom: 0.8 }))
  L.push(P(elipse(xCap - 0.3, yCap - 0.3, COPA, COPA * 0.92), CAPACETE, { tabua: 0, bisel: COPA * 0.85, contorno: 0.16, semente: 621 }))

  // A frente: o rodapé escuro e, em cada porta, as venezianas, o porta-nome, o puxador e (em duas de cada três) o cadeado.
  naFrente(-hw + 0.5, hw - 0.5, TIRA_DO_RODAPE, ALTURA_DO_RODAPE * g)
  L.push(P(pecaDaTira(-hw + 0.6, hw - 0.6, TIRA_DO_RODAPE), ESCURO_DA_PINTURA, { tabua: 0, bisel: 0, contorno: 0, semente: 630 }))
  for (let p = 0; p < portas; p += 1) {
    const x0 = -hw + larguraDaPorta * p
    const x1 = x0 + larguraDaPorta
    const xm = (x0 + x1) / 2
    const recuo = RECUO_DA_ALETA * larguraDaPorta
    for (const topo of [VENEZIANA_DE_CIMA, VENEZIANA_DE_BAIXO]) {
      for (let a = 0; a < ALETAS; a += 1) naFrente(x0 + recuo, x1 - recuo, TIRA_DA_ALETA, topo * Z - a * PASSO_DA_ALETA)
    }
    const meioNome = MEIO_NOME * larguraDaPorta
    naFrente(xm - meioNome, xm + meioNome, TIRA_DO_NOME, ALTURA_DO_NOME * Z)
    L.push(P(pecaDaTira(xm - meioNome, xm + meioNome, TIRA_DO_NOME), CARTAO, { tabua: 0, bisel: 0.2, contorno: 0.2, semente: 640 + p }))
    // O puxador do lado de fora da porta: a da direita abre para a direita, as outras para a esquerda.
    const xp = p === portas - 1 && portas > 1 ? x0 + LUGAR_DO_PUXADOR * larguraDaPorta : x1 - LUGAR_DO_PUXADOR * larguraDaPorta
    naFrente(xp - 0.7, xp + 0.7, TIRA_DO_PUXADOR, ALTURA_DO_PUXADOR * Z)
    L.push(P(pecaDaTira(xp - 0.6, xp + 0.6, TIRA_DO_PUXADOR, 0.4), CROMO, { tabua: 0, bisel: 0.4, contorno: 0.24, metal: 0.6, semente: 650 + p }))
    if (p % 3 !== 1) {
      naFrente(xp - 1.2, xp + 1.2, TIRA_DO_CADEADO, ALTURA_DO_PUXADOR * Z - CADEADO_ABAIXO)
      L.push(P(pecaDaTira(xp - 1.1, xp + 1.1, TIRA_DO_CADEADO, 0.6), LATAO, { tabua: 0, bisel: 0.6, contorno: 0.26, metal: 0.55, semente: 660 + p, projeta: { dist: 0.8, forca: 0.3 } }))
    }
  }
  cena.corDoPiso = ESCURO_DO_ARMARIO
}
