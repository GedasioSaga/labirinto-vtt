/**
 * CADEIRA GIRATÓRIA de cima com volume (lote L1 de 16/11/2026, necrotério e laboratório; versão ORIGINAL, só a ideia
 * do objeto das referências): a cadeira de escritório de hospital antigo. Embaixo, a ESTRELA de cinco pés de ferro com
 * as RODINHAS de borracha nas pontas; no meio, a coluna do parafuso de girar; em cima, o ASSENTO redondo de couro
 * escuro, abaulado, com o vivo em volta e os botões do capitonê; atrás, a HASTE que sobe até o ENCOSTO curvo, uma
 * faixa de couro sobre o aro de ferro.
 *
 * A 25% de zoom sobram o disco marrom do assento, a meia-lua do encosto atrás e as cinco pontas da estrela saindo
 * por baixo: é o que diz "cadeira de girar", e não "banqueta".
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): cada pé da estrela é uma coluna rasa (assim, em qualquer giro, o pé que
 * aponta para a frente não sai por cima do assento), as rodinhas são colunas baixas nas pontas, a coluna do meio
 * (de ferro, com a capa dela) sobe até o assento, o assento é um tampo solto (a beirada é o couro do lado, `ESPESSURA_DO_ASSENTO_GIRATORIO`), a haste é uma
 * coluna atrás dele com o aro de ferro no topo, e o encosto é um tampo solto de couro logo acima do aro. Nada lê o
 * giro: girada, a 3/4 gira a cena e o encosto vai para o lado do giro.
 *
 * Sem material escolhido: o couro, o ferro e a borracha são fixos.
 */
import { anel, capsula, caixa, dentroDe, elipse, menos, type Forma } from './formas'
import { contato } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm } from './varalDeBandeirinhas'
import { BORRACHA, COURO, FERRO_VELHO, PISO_DO_NECROTERIO } from './apoioDoNecroterio'

/** Alturas em casas: o assento, o encosto (o couro e o aro de baixo), a estrela e as rodinhas. */
const ALTURA_DO_ASSENTO = 0.3
const ALTURA_DO_ENCOSTO = 0.64
const ALTURA_DO_ARO = 0.58
const ALTURA_DA_ESTRELA = 0.05
const ALTURA_DA_RODA = 0.06
/** A beirada de cada tampo solto na 3/4 (px do protótipo): o couro do lado do assento e a faixa do encosto. */
export const ESPESSURA_DO_ASSENTO_GIRATORIO = 0.06 * G

/** As medidas em frações do menor meio lado. */
const ASSENTO = { y: 0.06, r: 0.74 } as const
const ENCOSTO = { raio: 0.86, largura: 0.2, corte: -0.36 } as const
const HASTE = { de: -0.62, ate: -0.88, raio: 0.07 } as const
const PES = 5
const PONTA_DO_PE = 0.93
const RAIO_DO_PE = 0.07
const RAIO_DA_RODA = 0.11
const RAIO_DA_COLUNA = 0.13
const BOTOES = 5
/** Onde o pé nasce (debaixo da coluna) e onde fica o meio da caixa dele, perto da ponta (fração do menor meio lado). */
const INICIO_DO_PE = 0.15
const MEIO_DO_PE = 0.82
/** O furinho no meio do assento, só da 3/4 (fração do menor meio lado). */
const FURO_DO_ASSENTO = 0.03
/** Onde fica o meio da caixa do aro do encosto: na haste, fora do couro (fração do menor meio lado). */
const MEIO_DO_ARO = -0.7

export const montarCadeiraGiratoria: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_NECROTERIO
  const m = Math.min(hw, hh)
  const L = cena.partes

  // A estrela de cinco pés e as rodinhas nas pontas. Cada pé é uma coluna rasa própria, com a peça própria: a 3/4
  // pinta do fundo para a frente pela beira de baixo de cada estrutura, e a estrela inteira, com um pé apontando para
  // a frente (o giro de 180 graus), saía por cima do assento. Os pés nascem debaixo da coluna do meio.
  const angulo = (i: number): number => -Math.PI / 2 + (i / PES) * Math.PI * 2
  for (let i = 0; i < PES; i += 1) {
    const [cos, sen] = [Math.cos(angulo(i)), Math.sin(angulo(i))]
    const pe = capsula(cos * m * INICIO_DO_PE, sen * m * INICIO_DO_PE, cos * m * PONTA_DO_PE * 0.92, sen * m * PONTA_DO_PE * 0.92, m * RAIO_DO_PE)
    const roda = elipse(cos * m * PONTA_DO_PE, sen * m * PONTA_DO_PE, m * RAIO_DA_RODA, m * RAIO_DA_RODA * 0.8)
    cena.sombras.push(
      { forma: pe, z: g * ALTURA_DA_ESTRELA, forca: 0.22 }, contato(pe, 0.3),
      { forma: roda, z: g * ALTURA_DA_RODA, forca: 0.2 }, contato(roda, 0.32),
    )
    // O pé de trás fica debaixo da haste e do encosto (de cima) e do assento (na 3/4), e o meio dele cai na haste,
    // que o subiria: dele só ficam as sombras e as colunas.
    if (i === 0) continue
    L.push(P(roda, BORRACHA, { tabua: 0, bisel: 0.7, contorno: 0.28, semente: 8001 }))
    // O meio da caixa do pé vai para perto da ponta, fora do assento: senão a 3/4 o subiria com ele.
    L.push(P(comMeioEm(pe, cos * m * MEIO_DO_PE, sen * m * MEIO_DO_PE), FERRO_VELHO, { tabua: 0, bisel: m * 0.05, contorno: 0.28, semente: 8002 + i }))
  }

  // A coluna do meio, do pé ao assento; o assento solto; a haste atrás dele; o encosto. O assento tem um furinho no
  // meio, só para a 3/4: a capa de ferro da coluna (o meio dela cai nele) fica com a coluna, e a frente da coluna sai
  // de ferro (sem peça, ela levaria o material da maior caixa do desenho, o couro).
  const zAssento = g * ALTURA_DO_ASSENTO
  const assento = elipse(0, m * ASSENTO.y, m * ASSENTO.r, m * ASSENTO.r)
  const coluna = elipse(0, 0, m * RAIO_DA_COLUNA, m * RAIO_DA_COLUNA)
  cena.sombras.push(
    { forma: coluna, z: zAssento - ESPESSURA_DO_ASSENTO_GIRATORIO, suave: 0.8, forca: 0.24 },
    { forma: menos(assento, elipse(0, 0, m * FURO_DO_ASSENTO, m * FURO_DO_ASSENTO)), z: zAssento, solta: true, suave: 1.6, forca: 0.26 },
  )
  L.push(P(coluna, FERRO_VELHO, { tabua: 0, bisel: m * 0.05, tom: 0.9, contorno: 0.28, semente: 8011 }))
  const haste = capsula(0, m * HASTE.de, 0, m * HASTE.ate, m * HASTE.raio)
  cena.sombras.push({ forma: haste, z: g * ALTURA_DO_ARO - ESPESSURA_DO_ASSENTO_GIRATORIO, suave: 0.8, forca: 0.24 })
  const faixa = (k: number): Forma => dentroDe(anel(0, m * ASSENTO.y, m * (ENCOSTO.raio + ENCOSTO.largura * k), m * (ENCOSTO.raio + ENCOSTO.largura * k), m * ENCOSTO.raio, m * ENCOSTO.raio), caixa(-m * 1.2, -m * 1.2, m * 1.2, m * ENCOSTO.corte))
  const encosto = faixa(1)
  cena.sombras.push({ forma: encosto, z: g * ALTURA_DO_ENCOSTO, solta: true, suave: 1.4, forca: 0.24 })

  // A haste de ferro (o meio dela fica entre o assento e o encosto: sobe com a coluna dela).
  L.push(P(haste, FERRO_VELHO, { tabua: 0, bisel: m * 0.05, tom: 1.15, contorno: 0.28, semente: 8003, projeta: { dist: 1.2, forca: 0.28 } }))

  // O assento: o vivo em volta, o couro abaulado, as costuras do capitonê e os botões.
  const [ax, ay, ar] = [0, m * ASSENTO.y, m * ASSENTO.r]
  L.push(P(assento, COURO, { tabua: 0, bisel: 0.8, tom: 0.85, contorno: 0.3, semente: 8004, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(elipse(ax, ay, ar * 0.9, ar * 0.9), COURO, { tabua: 0, bisel: ar * 0.4, tom: 1.08, contorno: 0.12, ruga: 0.2, semente: 8005 }))
  const botoes: [number, number][] = [[ax, ay]]
  for (let i = 0; i < BOTOES - 1; i += 1) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    botoes.push([ax + Math.cos(a) * ar * 0.5, ay + Math.sin(a) * ar * 0.5])
  }
  for (const [bx, by] of botoes.slice(1)) {
    L.push(P(capsula(ax, ay, bx, by, 0.35), COURO, { tabua: 0, bisel: 0, tom: 0.7, contorno: 0, alfa: 0.5, suave: 0.5, semente: 8006 }))
  }
  for (const [bx, by] of botoes) L.push(P(elipse(bx, by, 0.75, 0.75), COURO, { tabua: 0, bisel: 0.4, tom: 0.72, contorno: 0.2, recesso: { k: 0.4, forca: 0.3 }, semente: 8007 }))
  // O brilho largo do couro, do lado da luz.
  L.push(P(elipse(ax - ar * 0.3, ay - ar * 0.32, ar * 0.32, ar * 0.2), COURO, { tabua: 0, bisel: 0, tom: 1.35, contorno: 0, alfa: 0.35, suave: 1.2, semente: 8008 }))

  // O encosto: o aro de ferro aparecendo em volta e a faixa de couro estofada por cima. O aro mora na haste (o meio
  // da caixa dele vai para ela): na 3/4 fica no topo da haste, logo abaixo do couro, e a frente do couro sai de couro.
  // O couro tem o meio da caixa no alto da faixa (o de uma meia-lua cai fora dela, na haste).
  L.push(P(comMeioEm(faixa(1.08), 0, m * MEIO_DO_ARO), FERRO_VELHO, { tabua: 0, bisel: 0.6, contorno: 0.28, semente: 8009, projeta: { dist: 1.4, forca: 0.3 } }))
  const [ux, uy] = [0, m * (ASSENTO.y - ENCOSTO.raio - ENCOSTO.largura / 2)]
  L.push(P(comMeioEm(encosto, ux, uy), COURO, { tabua: 0, bisel: m * ENCOSTO.largura * 0.45, tom: 1.04, contorno: 0.26, ruga: 0.2, semente: 8010 }))
}
