/**
 * CADEIRA DE PLÁSTICO de cima com volume (lote L10 de 24/11/2026, presídio moderno; versão da cadeira): a cadeira
 * de uma peça só, de plástico azul desbotado pelo sol, a do refeitório e a da sala de visita. De cima aparecem o
 * ASSENTO com a cova rasa e o furinho de escorrer água no meio, a beira da frente arredondada que pega a luz, as
 * marcas claras de gasto onde todo mundo senta, o ENCOSTO curvo atrás (abraçando as costas, mais fundo nas pontas)
 * e as quatro PERNAS largas despontando abertas nos cantos.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`, beirada padrão): o assento é um tampo solto; o encosto é uma coluna do chão
 * até o alto dele (o assento, pintado depois, cobre o pé dela: sobra a placa acima do assento, como na cadeira de
 * verdade); as pernas são colunas na altura de baixo do assento. Só a 3/4 vê (`soNaTresQuartos`, sem giro) as
 * fendas do encosto, acompanhando a curva dele, com a aba clara embaixo de cada uma. Com giro elas somem, e a
 * placa fica lisa. Nada mais lê o giro.
 *
 * Sem material escolhido: o plástico é fixo (o azul apagado do pedido).
 */
import type { Rgb } from '../../ruido'
import { cadeia, caixa, capsula, elipse, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { REFLEXO, soNaTresQuartos, type PecaDaTela } from './apoioDoBanheiroModerno'

/** O plástico azul desbotado (saturação HSV ~0,34) e o escuro dele (o fundo das fendas e do furo). */
const AZUL: MaterialDaPeca = { classe: 'liso', rgb: [0x67, 0x82, 0x9b] }
const AZUL_ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x48, 0x56] }
/** O escuro em que o pixel escuro demais é levantado: o azul escuro do plástico (a nogueira amarronzava a beira). */
const PISO_DO_PLASTICO: Rgb = [0x3a, 0x48, 0x56]

/** Alturas em casas: o assento (0,45 m) e o alto do encosto (0,9 m). */
const ALTURA_DO_ASSENTO = 0.3
const ALTURA_DO_ENCOSTO = 0.6
/** A beirada padrão do tampo solto na 3/4 (px): as pernas vão até a parte de baixo do assento. */
const BEIRADA = 3.36
/** O assento: a meia largura, onde começa atrás e a quina (px). */
const ASSENTO = { meia: 12.2, tras: -7.4, quina: 4.2 } as const
/** O encosto: o raio da curva, onde fica o meio dele (px a partir da beira de trás), a meia abertura (rad) e a grossura. */
const ENCOSTO = { raio: 24, daBeira: 3.4, abertura: 0.5, meia: 2.3 } as const
/** As pernas: os quatro pés (px) e o tamanho de cada um. */
const PES: readonly Ponto[] = [[-12.6, 11.8], [12.6, 11.8], [-12.4, -10.9], [12.4, -10.9]]
const PE = { rx: 1.9, ry: 1.7 } as const
/** As fendas do encosto na 3/4: quanto descem do alto (px) e a meia largura de cada uma. */
const FENDAS: readonly (readonly [number, number, number])[] = [[4.2, 5.2, 1], [8, 7.2, 0.75], [11.4, 7.2, 0.75]]

/** O plástico: um grão muito leve e o desbotado do sol, mais claro do lado da luz. */
const texPlastico: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.45 + p.semente, y * 0.45) * 0.025 - (x + y) * 0.0018
}

export const montarCadeiraDePlastico: MontarMovel = (c, cena) => {
  const { hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_PLASTICO
  const zAssento = g * ALTURA_DO_ASSENTO
  const zEncosto = g * ALTURA_DO_ENCOSTO
  const assento = caixa(-ASSENTO.meia, ASSENTO.tras, ASSENTO.meia, hh - 1.4, ASSENTO.quina)
  // O encosto: a curva de raio grande, com o meio mais para trás e as pontas vindo para a frente.
  const yMeioDoEncosto = -hh + ENCOSTO.daBeira
  const cyCurva = yMeioDoEncosto + ENCOSTO.raio
  const curva = (x: number): number => cyCurva - Math.sqrt(ENCOSTO.raio * ENCOSTO.raio - x * x)
  const pontos: Ponto[] = []
  for (let i = 0; i <= 10; i += 1) {
    const x = ENCOSTO.raio * Math.sin(-ENCOSTO.abertura + (2 * ENCOSTO.abertura * i) / 10)
    pontos.push([x, curva(x)])
  }
  const encosto = cadeia(pontos, ENCOSTO.meia)

  cena.sombras.push({ forma: assento, z: zAssento, solta: true, suave: 1.4, forca: 0.26 }, { forma: encosto, z: zEncosto, forca: 0.2 })
  const pernas = PES.map(([x, y]) => elipse(x, y, PE.rx, PE.ry))
  for (const perna of pernas) cena.sombras.push({ forma: perna, z: zAssento - BEIRADA, forca: 0.2 }, contato(perna, 0.3))

  const L = cena.partes
  const plastico = { tabua: 0, textura: texPlastico }
  const liso = { tabua: 0, bisel: 0, contorno: 0 }

  // As PERNAS primeiro: o assento cobre quase tudo, sobram os pés abertos nos cantos.
  pernas.forEach((perna, i) => L.push(P(perna, AZUL, { ...plastico, bisel: 1.2, tom: 0.9, contorno: 0.28, semente: 10101 + i })))

  // O ASSENTO: a peça, a cova rasa, o furinho, a beira da frente que pega a luz e o gasto claro.
  L.push(P(assento, AZUL, { ...plastico, bisel: 1.8, contorno: 0.28, semente: 10110, projeta: { dist: 0.8, forca: 0.24 } }))
  L.push(P(caixa(-ASSENTO.meia + 2.8, ASSENTO.tras + 2.4, ASSENTO.meia - 2.8, hh - 4.2, ASSENTO.quina - 0.8), AZUL, { ...plastico, bisel: 1.4, tom: 0.97, contorno: 0.06, recesso: { k: 1.6, forca: 0.26 }, semente: 10111 }))
  L.push(P(elipse(0, 2.6, 0.85, 0.85), AZUL_ESCURO, { tabua: 0, bisel: 0.3, contorno: 0.2, alfa: 0.8, semente: 10112 }))
  L.push(P(capsula(-ASSENTO.meia + 3.2, hh - 2.4, ASSENTO.meia - 3.2, hh - 2.4, 0.8), REFLEXO, { ...liso, alfa: 0.18, suave: 0.8, semente: 10113 }))
  L.push(P(elipse(-4.5, 8, 3.2, 1.5), REFLEXO, { ...liso, alfa: 0.1, suave: 1.4, semente: 10114 }))
  L.push(P(elipse(5, 6.4, 2.4, 1.2), REFLEXO, { ...liso, alfa: 0.08, suave: 1.2, semente: 10115 }))

  // O ENCOSTO curvo, por cima: a borda grossa arredondada e o brilho ao longo dela.
  L.push(P(encosto, AZUL, { ...plastico, bisel: ENCOSTO.meia * 0.9, tom: 1.03, contorno: 0.28, semente: 10120, projeta: { dist: 1.4, forca: 0.3, suave: 1.2 } }))
  L.push(P(cadeia(pontos.slice(1, -1).map(([x, y]): Ponto => [x - 0.3, y - 0.7]), 0.45), REFLEXO, { ...liso, alfa: 0.22, suave: 0.4, semente: 10121 }))

  // Só a 3/4: as fendas da placa do encosto, acompanhando a curva, cada uma com a aba clara embaixo.
  const frenteDoEncosto = (x: number): number => curva(x) + ENCOSTO.meia - zEncosto
  const fendas: PecaDaTela[] = []
  FENDAS.forEach(([desce, meia, r], i) => {
    const traco: Ponto[] = []
    const aba: Ponto[] = []
    for (let k = 0; k <= 6; k += 1) {
      const x = -meia + (2 * meia * k) / 6
      traco.push([x, frenteDoEncosto(x) + desce])
      aba.push([x, frenteDoEncosto(x) + desce + r + 0.45])
    }
    fendas.push({ forma: cadeia(traco, r), mat: AZUL_ESCURO, o: { ...liso, alfa: 0.88, semente: 10130 + i } })
    fendas.push({ forma: cadeia(aba, 0.35), mat: REFLEXO, o: { ...liso, alfa: 0.2, semente: 10135 + i } })
  })
  soNaTresQuartos(P, cena, 0, -5, fendas)
}
