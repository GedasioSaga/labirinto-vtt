/**
 * CADEIRA DE PLÁSTICO de cima com volume (lote L10 de 24/11/2026, presídio moderno; versão da cadeira): a cadeira
 * de uma peça só (monobloco), de plástico azul apagado pelo sol, a do refeitório e a da sala de visita. De cima
 * aparecem o ASSENTO CÔNCAVO, sem quadro nem parafuso (o meio mais fundo e escuro, a beira mais clara, e o lado de
 * baixo à direita pegando a luz, como numa cuia), a aba curta que dobra para baixo na frente, o ENCOSTO curvo atrás
 * (abraçando as costas, mais fundo nas pontas) preso ao assento pelos dois MONTANTES de trás, com a sombra dele
 * caindo no assento, e as quatro PERNAS largas despontando abertas nos cantos.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`, beirada padrão): o assento é um tampo solto; o encosto é uma coluna do chão
 * até o alto dele (o assento, pintado depois, cobre o pé dela: sobra a placa acima do assento, como na cadeira de
 * verdade); os montantes sobem com o assento; as pernas são colunas na altura de baixo do assento. Só a 3/4 vê
 * (`soNaTresQuartos`, sem giro) as fendas do encosto, acompanhando a curva dele, com a aba clara embaixo de cada uma.
 * Com giro elas somem, e a placa fica lisa. Nada mais lê o giro.
 *
 * Sem material escolhido: o plástico é fixo (o azul apagado do pedido, saturação HSV ~0,27).
 */
import type { Rgb } from '../../ruido'
import { cadeia, caixa, capsula, dentroDe, elipse, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { comMeioEm } from './andaimeDaTresQuartos'
import { REFLEXO, soNaTresQuartos, type PecaDaTela } from './apoioDoBanheiroModerno'

/** O plástico azul apagado (saturação HSV ~0,27) e o escuro dele (o fundo das fendas). */
const AZUL: MaterialDaPeca = { classe: 'liso', rgb: [0x6d, 0x84, 0x96] }
const AZUL_ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x40, 0x4b, 0x56] }
/** O escuro em que o pixel escuro demais é levantado: o azul escuro do plástico (a nogueira amarronzava a beira). */
const PISO_DO_PLASTICO: Rgb = [0x40, 0x4b, 0x56]

/** Alturas em casas: o assento (0,45 m) e o alto do encosto (0,9 m). */
const ALTURA_DO_ASSENTO = 0.3
const ALTURA_DO_ENCOSTO = 0.6
/** A beirada padrão do tampo solto na 3/4 (px): as pernas vão até a parte de baixo do assento. */
const BEIRADA = 3.36
/** O assento: a meia largura, onde começa atrás e a quina (px). */
const ASSENTO = { meia: 12.2, tras: -7.4, quina: 4.2 } as const
/**
 * A cova do assento: a luz no meio (fundo, mais escuro) e na beira (mais clara), e o quanto o lado de baixo à direita
 * (a parede da cova virada para a luz) clareia e o de cima à esquerda escurece.
 */
const COVA = { meio: -0.13, beira: 0.04, inclinada: 0.05 } as const
/** A aba da frente que dobra para baixo: a fundura (px) e o tom (virada para longe da luz). */
const ABA = { fundura: 2.4, tom: 0.84 } as const
/** O encosto: o raio da curva, onde fica o meio dele (px a partir da beira de trás), a meia abertura (rad) e a grossura. */
const ENCOSTO = { raio: 24, daBeira: 3.4, abertura: 0.5, meia: 2.3 } as const
/** A sombra do encosto caindo no assento (px). */
const SOMBRA_DO_ENCOSTO = { dist: 3.2, forca: 0.3, suave: 1.4 } as const
/** Os montantes de trás, do canto do assento ao encosto: o x, de onde a onde vão (px) e a meia grossura. */
const MONTANTE = { x: 9.2, de: -6.2, ate: -9.6, meia: 1.8 } as const
/** As pernas: os quatro pés (px) e o tamanho de cada um. */
const PES: readonly Ponto[] = [[-12.6, 11.8], [12.6, 11.8], [-12.4, -10.9], [12.4, -10.9]]
const PE = { rx: 1.9, ry: 1.7 } as const
/** As fendas do encosto na 3/4: quanto descem do alto (px) e a meia largura de cada uma. */
const FENDAS: readonly (readonly [number, number, number])[] = [[4.2, 5.2, 1], [8, 7.2, 0.75], [11.4, 7.2, 0.75]]

/** O plástico: um grão muito leve e o desbotado do sol, mais claro do lado da luz. */
const texPlastico: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.45 + p.semente, y * 0.45) * 0.025 - (x + y) * 0.0018
}

/** O assento côncavo em volta de (cx, cy), de meios raios (rx, ry): o meio fundo e escuro, a beira clara. */
function texturaDoAssento(cx: number, cy: number, rx: number, ry: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    texPlastico(u, v, x, y, p, s, escala)
    const qx = (x - cx) / rx
    const qy = (y - cy) / ry
    const r = Math.min(1, Math.hypot(qx, qy))
    s[3] += COVA.meio + (COVA.beira - COVA.meio) * r * r + COVA.inclinada * r * (qx + qy) * 0.5
  }
}

export const montarCadeiraDePlastico: MontarMovel = (c, cena) => {
  const { hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_PLASTICO
  const zAssento = g * ALTURA_DO_ASSENTO
  const zEncosto = g * ALTURA_DO_ENCOSTO
  const frente = hh - 1.4
  const assento = caixa(-ASSENTO.meia, ASSENTO.tras, ASSENTO.meia, frente, ASSENTO.quina)
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

  // O ASSENTO côncavo, de uma peça: a cova em degradê (sem quadro e sem furo) e a aba da frente que dobra para baixo,
  // com o vinco claro da dobra.
  const cyAssento = (ASSENTO.tras + frente) / 2
  const cova = texturaDoAssento(0, cyAssento, ASSENTO.meia - 1, (frente - ASSENTO.tras) / 2 - 1)
  L.push(P(assento, AZUL, { tabua: 0, textura: cova, bisel: 1.8, contorno: 0.28, semente: 10110, projeta: { dist: 0.8, forca: 0.24 } }))
  L.push(P(dentroDe(assento, caixa(-ASSENTO.meia, frente - ABA.fundura, ASSENTO.meia, frente)), AZUL, { ...plastico, bisel: 0.8, tom: ABA.tom, contorno: 0.28, suave: 0.5, semente: 10111 }))
  L.push(P(capsula(-ASSENTO.meia + 3.4, frente - ABA.fundura - 0.3, ASSENTO.meia - 3.4, frente - ABA.fundura - 0.3, 0.35), REFLEXO, { ...liso, alfa: 0.16, suave: 0.5, semente: 10113 }))

  // Os MONTANTES de trás, do canto do assento ao encosto (sobem com o assento na 3/4).
  for (const lado of [-1, 1]) {
    const montante = capsula(lado * MONTANTE.x, MONTANTE.de, lado * (MONTANTE.x + 0.5), MONTANTE.ate, MONTANTE.meia)
    L.push(P(comMeioEm(montante, lado * MONTANTE.x, MONTANTE.de), AZUL, { ...plastico, bisel: 1.4, tom: 0.95, contorno: 0.26, semente: 10115 + (lado > 0 ? 1 : 0) }))
  }

  // O ENCOSTO curvo, por cima: a borda grossa arredondada, o brilho ao longo dela e a sombra dele no assento.
  L.push(P(encosto, AZUL, { ...plastico, bisel: ENCOSTO.meia * 0.9, tom: 1.03, contorno: 0.28, semente: 10120, projeta: SOMBRA_DO_ENCOSTO }))
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
