/**
 * CÂMARA FRIGORÍFICA de cima com volume (lote L1 de 16/11/2026, necrotério e laboratório; versão ORIGINAL, só a
 * ideia do objeto das referências): a parede de GAVETAS de corpo do necrotério, um armário alto de inox encostado na
 * parede, com três colunas de três portas quadradas. Cada porta tem as duas dobradiças do lado de fora, o TRINCO de
 * alavanca do lado de dentro e o PORTA-ETIQUETA com o cartão de papel no alto; em cima das portas corre a GRELHA de
 * ventilação e embaixo, o rodapé escuro.
 *
 * DE CIMA aparece o teto de aço escovado com a CASA DE MÁQUINAS no fundo: a caixa cinza do compressor com o
 * ventilador redondo e os dois canos de cobre fosco que descem para a frente. Na beira da frente fica o alto da
 * frente (a grelha de ventilação), como o alto das portas da geladeira (`geladeira.ts`).
 *
 * NA 3/4 A FRENTE MOSTRA AS NOVE PORTAS, com a frente em faixas do guarda-roupa (`guardaRoupa.ts`, a regra da
 * geladeira): desenhada de frente uma vez e fatiada, cada faixa guardada debaixo do teto com a sua fresta. A casa de
 * máquinas sobe com o teto (a sombra pintada no aço é que lhe dá a altura). GIRADA, a face que
 * fica embaixo na tela é a LATERAL (a chapa com o brilho largo) ou as COSTAS (a chapa mais escura com os canos e a
 * caixa de ligação), desenhadas e guardadas do mesmo jeito (`guardarFaceGirada`).
 *
 * Sem material escolhido: o aço, a borracha, o cobre e o papel são fixos.
 */
import { anel, caixa, capsula, elipse } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type MontarMovel } from './contexto'
import { CANTONEIRA, FRESTA, fatiar, guardarFaceGirada, naFaixa, type Faixa, type OpcoesDaFrente, type PecaDaFrente } from './guardaRoupa'
import { quartosDeVolta } from './varalDeBandeirinhas'
import { ESCURO, INOX, NIQUEL, PAPEL, PISO_DO_NECROTERIO, BRILHO_DO_NIQUEL, texEscovado } from './apoioDoNecroterio'

/** Altura do armário em casas (a sombra; na 3/4, a frente). */
const ALTURA = 1.5
/** A faixa de cima da frente (a grelha, que se vê também de cima), em casas, e o máximo dela em fração da profundidade. */
const FAIXA_DE_CIMA = 0.12
const PARTE_DA_FAIXA_DE_CIMA = 0.3
/** As portas: colunas e fileiras. */
const COLUNAS = 3
const FILEIRAS = 3

/** O cobre fosco dos canos da casa de máquinas: contido, quase marrom. */
const COBRE: MaterialDaPeca = { classe: 'metal', rgb: [0x96, 0x6e, 0x52] }
/** A sombra do trinco e da grelha na porta: o escuro do aço, meio transparente. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x2f, 0x32] }

/** Os tons do aço: o teto, as portas (de frente), o corpo em volta delas, a beira de cima e o trinco. */
const TOM_DO_TETO = 1
const TOM_DA_PORTA = 0.88
const TOM_DO_CORPO = 0.7
const TOM_DA_BEIRA = 1.04
const BRILHO_DA_CHAPA = 0.3

/** A chapa de pé, com o escovado correndo de cima a baixo. */
const chapaDePe = (tom: number, semente: number, bisel: number): OpcoesDaFrente => ({ eixo: QUARTO, tabua: 0, bisel, tom, metal: BRILHO_DA_CHAPA, textura: texEscovado, semente })

/** O brilho largo da chapa grande (a lateral e as costas): a faixa clara no alto e o pé mais escuro (a da geladeira). */
function texChapaGrande(H: number, forca: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    texEscovado(u, v, x, y, p, s, escala)
    const t = -y / H
    const d = (t - 0.7) / 0.2
    s[3] += forca * (0.08 * Math.exp(-d * d) - 0.08 * (1 - t) ** 4) + ruido(u * 0.02, v * 0.02) * 0.01
  }
}

// ---------- a frente, desenhada de frente ----------

/** O rodapé (casas), a beira clara de cima, a grelha, a folga das portas e o vão entre elas (px do protótipo). */
const RODAPE = 0.08
const BEIRA_DE_CIMA = 1.6
const GRELHA = 5.2
const LATERAL = 1.6
const VAO = 1.3
/** As dobradiças (meia largura, meia altura, a quanto da ponta) e o trinco (comprimento, raio, a quanto da beira). */
const DOBRADICA = { meiaLargura: 1.1, meiaAltura: 2, daPonta: 0.22 } as const
const TRINCO = { comprimento: 7, raio: 0.95, daBeira: 3.6, base: 2.2 } as const
/** O porta-etiqueta no alto da porta: meia largura, meia altura e a quanto do alto (px). */
const ETIQUETA = { meiaLargura: 4.2, meiaAltura: 1.9, doAlto: 4.2 } as const

/** A grelha de ventilação no alto e a beira de cima, que correm na frente e nas faces giradas. */
function grelhaEBeira(hw: number, H: number, comGrelha: boolean, semente: number): PecaDaFrente[] {
  const pecas: PecaDaFrente[] = []
  if (comGrelha) {
    const y0 = -H + BEIRA_DE_CIMA
    pecas.push({ forma: caixa(-hw + LATERAL, y0, hw - LATERAL, y0 + GRELHA, 0.5), mat: ESCURO, o: { tabua: 0, bisel: 0.4, contorno: 0.14, tom: 1.2, recesso: { k: 1.2, forca: 0.3 }, semente } })
    for (let k = 0; k < 3; k += 1) {
      const y = y0 + 1.1 + k * 1.5
      pecas.push({ forma: caixa(-hw + LATERAL + 1, y, hw - LATERAL - 1, y + 0.6, 0.3), mat: INOX, o: { tabua: 0, bisel: 0.3, tom: 0.95, contorno: 0.1, metal: 0.4, semente: semente + 1 + k } })
    }
  }
  pecas.push({ forma: caixa(-hw, -H, hw, -H + BEIRA_DE_CIMA, 0.5), mat: INOX, o: { eixo: 0, tabua: 0, bisel: 0.7, tom: TOM_DA_BEIRA, contorno: 0.16, metal: 0.4, textura: texEscovado, semente: semente + 5 } })
  return pecas
}

/** O rodapé escuro e recuado. */
function rodape(hw: number, g: number, semente: number): PecaDaFrente {
  return { forma: caixa(-hw + 1.2, -g * RODAPE, hw - 1.2, 0, 0.4), mat: ESCURO, o: { tabua: 0, bisel: 0.5, contorno: 0.1, recesso: { k: 1.2, forca: 0.3 }, semente } }
}

/** Uma porta: a folha, as dobradiças do lado de fora (`fora` = -1 à esquerda), o trinco e o porta-etiqueta. */
function porta(pecas: PecaDaFrente[], x0: number, x1: number, y0: number, y1: number, fora: -1 | 1, semente: number): void {
  pecas.push({ forma: caixa(x0, y0, x1, y1, 1.1), mat: INOX, o: { ...chapaDePe(TOM_DA_PORTA, semente, 1.3), contorno: 0.22 } })
  const alto = y1 - y0
  const xd = fora < 0 ? x0 - 0.2 : x1 + 0.2
  for (const f of [DOBRADICA.daPonta, 1 - DOBRADICA.daPonta]) {
    const y = y0 + alto * f
    pecas.push({ forma: caixa(xd - DOBRADICA.meiaLargura, y - DOBRADICA.meiaAltura, xd + DOBRADICA.meiaLargura, y + DOBRADICA.meiaAltura, 0.5), mat: NIQUEL, o: { tabua: 0, bisel: 0.5, tom: 0.92, contorno: 0.24, metal: BRILHO_DO_NIQUEL, semente: semente + 1 } })
  }
  // O trinco: a base presa na porta, a sombra da alavanca e a alavanca deitada, do lado de dentro.
  const xb = fora < 0 ? x1 - TRINCO.daBeira : x0 + TRINCO.daBeira
  const ym = y0 + alto * 0.5
  const xa = xb + fora * TRINCO.comprimento
  pecas.push({ forma: caixa(xb - TRINCO.base, ym - TRINCO.base * 1.3, xb + TRINCO.base, ym + TRINCO.base * 1.3, 0.7), mat: NIQUEL, o: { tabua: 0, bisel: 0.7, tom: 0.9, contorno: 0.24, metal: BRILHO_DO_NIQUEL, semente: semente + 2 } })
  pecas.push({ forma: capsula(xb + 0.8, ym + 1, xa + 0.8, ym + 1.6, TRINCO.raio + 0.2), mat: SOMBRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.28, suave: 1, semente: semente + 3 } })
  pecas.push({ forma: capsula(xb, ym, xa, ym + 0.5, TRINCO.raio), mat: NIQUEL, o: { tabua: 0, bisel: TRINCO.raio * 0.8, tom: 1.1, contorno: 0.26, metal: BRILHO_DO_NIQUEL, semente: semente + 4 } })
  // O porta-etiqueta no alto, com o cartão de papel e a linha escrita.
  const xm = (x0 + x1) / 2
  const ye = y0 + ETIQUETA.doAlto
  pecas.push({ forma: caixa(xm - ETIQUETA.meiaLargura, ye - ETIQUETA.meiaAltura, xm + ETIQUETA.meiaLargura, ye + ETIQUETA.meiaAltura, 0.4), mat: NIQUEL, o: { tabua: 0, bisel: 0.4, tom: 0.85, contorno: 0.24, metal: 0.5, semente: semente + 5 } })
  pecas.push({ forma: caixa(xm - ETIQUETA.meiaLargura + 0.7, ye - ETIQUETA.meiaAltura + 0.6, xm + ETIQUETA.meiaLargura - 0.7, ye + ETIQUETA.meiaAltura - 0.5, 0.2), mat: PAPEL, o: { tabua: 0, bisel: 0.2, contorno: 0.06, semente: semente + 6 } })
  pecas.push({ forma: capsula(xm - ETIQUETA.meiaLargura + 1.6, ye, xm + ETIQUETA.meiaLargura * 0.3, ye, 0.25), mat: ESCURO, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.55, semente: semente + 7 } })
}

/** A frente inteira, de frente: x como na pegada, y = 0 no chão e negativo para cima. */
function desenharFrente(hw: number, H: number, g: number): PecaDaFrente[] {
  const pecas: PecaDaFrente[] = []
  pecas.push({ forma: caixa(-hw, -H, hw, 0, 0.6), mat: INOX, o: chapaDePe(TOM_DO_CORPO, 7201, 0.9) })
  pecas.push(rodape(hw, g, 7202))
  const topo = H - BEIRA_DE_CIMA - GRELHA - 1.2
  const pe = g * RODAPE + 1
  const largura = (2 * hw - 2 * LATERAL - (COLUNAS - 1) * VAO) / COLUNAS
  const alto = (topo - pe - (FILEIRAS - 1) * VAO) / FILEIRAS
  for (let i = 0; i < COLUNAS; i += 1) {
    const x0 = -hw + LATERAL + i * (largura + VAO)
    // As dobradiças ficam do lado de fora de cada coluna (a do meio abre para a esquerda).
    const fora: -1 | 1 = i === COLUNAS - 1 ? 1 : -1
    for (let j = 0; j < FILEIRAS; j += 1) {
      const y1 = -pe - j * (alto + VAO)
      porta(pecas, x0 + 0.6, x0 + largura - 0.6, y1 - alto, y1, fora, 7210 + (i * FILEIRAS + j) * 10)
    }
  }
  pecas.push(...grelhaEBeira(hw, H, true, 7300))
  return pecas
}

// ---------- girada: a lateral e as costas ----------

/** A LATERAL, de frente: a chapa de aço com o brilho largo, o rodapé e a beira de cima. */
function desenharLateral(hw: number, H: number, g: number): PecaDaFrente[] {
  return [
    { forma: caixa(-hw, -H, hw, 0, 0.6), mat: INOX, o: { ...chapaDePe(0.8, 7310, 0.9), textura: texChapaGrande(H, 1) } },
    rodape(hw, g, 7311),
    ...grelhaEBeira(hw, H, false, 7312),
  ]
}

/** As COSTAS, de frente: a chapa mais escura, os dois canos de pé e a caixa de ligação. */
function desenharCostas(hw: number, H: number, g: number): PecaDaFrente[] {
  const pecas: PecaDaFrente[] = [{ forma: caixa(-hw, -H, hw, 0, 0.6), mat: INOX, o: { ...chapaDePe(0.66, 7320, 0.9), textura: texChapaGrande(H, 0.6) } }]
  for (const x of [hw * 0.18, hw * 0.26]) {
    pecas.push({ forma: capsula(x, -H + BEIRA_DE_CIMA + 1, x, -g * RODAPE - 6, 0.9), mat: COBRE, o: { eixo: QUARTO, tabua: 0, bisel: 0.8, contorno: 0.24, metal: 0.4, semente: 7321 } })
  }
  pecas.push({ forma: caixa(hw * 0.1, -g * RODAPE - 12, hw * 0.34, -g * RODAPE - 3, 0.8), mat: INOX, o: { ...chapaDePe(0.55, 7322, 0.7), contorno: 0.24 } })
  pecas.push(rodape(hw, g, 7323), ...grelhaEBeira(hw, H, false, 7324))
  return pecas
}

// ---------- o teto e a casa de máquinas ----------

/** A casa de máquinas no fundo do teto: meia largura (fração), fundura (px), o raio do ventilador e os canos. */
const MAQUINAS = { meiaLargura: 0.36, fundura: 15, recuo: 2.4 } as const
const RAIO_DO_VENTILADOR = 5.2
const PAS = 5

export const montarCamaraFrigorifica: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  const H = g * ALTURA
  const deCima = Math.min(g * FAIXA_DE_CIMA, h * PARTE_DA_FAIXA_DE_CIMA)
  const { faixas, frente } = fatiar(H, 0, deCima, h, hh)
  cena.corDoPiso = PISO_DO_NECROTERIO

  // Sem giro, o corpo dá a sombra comprida e a frente vai em faixas; girada, a face de baixo na tela é a lateral ou
  // as costas, e da frente só entra a faixa de cima (a grelha, que se vê de cima).
  const quartos = quartosDeVolta(c.giro)
  const deFrente = quartos === 0
  if (deFrente) {
    cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1), z: H })
    for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
    for (const fx of faixas) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
  } else if (quartos % 2 === 1) {
    guardarFaceGirada(P, cena, quartos, H, { xa: -hh, xb: hh, y0: -hw, y1: hw, raio: 1 }, desenharLateral(hh, H, g))
  } else {
    guardarFaceGirada(P, cena, quartos, H, { xa: -hw, xb: hw, y0: -hh, y1: hh, raio: 1 }, desenharCostas(hw, H, g))
  }
  cena.sombras.push(contato(caixa(-hw, -hh, hw, hh, 1)))

  // A casa de máquinas no fundo do teto. Não é estrutura própria: uma coluna mais alta sairia, na 3/4, por baixo ou
  // por cima do armário inteiro (a ordem da 3/4 é pela base). Sobe com o teto, e a sombra pintada dá a altura.
  const mx = hw * MAQUINAS.meiaLargura
  const my0 = -hh + MAQUINAS.recuo
  const my1 = my0 + Math.min(MAQUINAS.fundura, (frente + hh) * 0.6)
  const casa = caixa(-mx, my0, mx, my1, 1.4)

  const L = cena.partes
  const desenho = desenharFrente(hw, H, g)
  const pintarFaixa = (fx: Faixa): void => {
    for (const peca of desenho) {
      const copia = naFaixa(P, peca, fx)
      if (copia !== null) L.push(copia)
    }
  }
  if (deFrente) faixas.slice(0, -1).forEach(pintarFaixa)
  // O teto de aço escovado, com a beira de trás um degrau mais escura.
  L.push(P(caixa(-hw, -hh, hw, hh, 1.6), INOX, { eixo: 0, tabua: 0, bisel: 1.8, tom: TOM_DO_TETO, contorno: 0.26, metal: BRILHO_DA_CHAPA, textura: texEscovado, semente: 7400 }))
  L.push(P(caixa(-hw + 1.4, -hh + 0.8, hw - 1.4, -hh + 3.2, 0.6), INOX, { eixo: 0, tabua: 0, bisel: 0.6, tom: 0.86, contorno: 0.12, metal: 0.2, textura: texEscovado, semente: 7401 }))

  // Os dois canos de cobre que saem da casa de máquinas e correm pelo teto até a beira da frente.
  for (const x of [mx * 0.55, mx * 0.75]) {
    L.push(P(capsula(x, my1 - 1, x, frente - deCima - 1.5, 0.9), COBRE, { eixo: QUARTO, tabua: 0, bisel: 0.8, contorno: 0.24, metal: 0.4, semente: 7402, projeta: { dist: 0.7, forca: 0.26 } }))
  }
  // A casa de máquinas: a caixa cinza, o ventilador redondo com a grade e as pás, e as frestas de ar do lado.
  L.push(P(casa, INOX, { eixo: 0, tabua: 0, bisel: 1.4, tom: 0.66, contorno: 0.28, metal: 0.2, textura: texEscovado, semente: 7410, projeta: { dist: 2.2, forca: 0.32, suave: 1.2 } }))
  const cx = -mx * 0.35
  const cy = (my0 + my1) / 2
  const r = Math.min(RAIO_DO_VENTILADOR, (my1 - my0) / 2 - 1.2)
  L.push(P(elipse(cx, cy, r, r), ESCURO, { tabua: 0, bisel: 0.5, contorno: 0.24, recesso: { k: 1.4, forca: 0.4 }, semente: 7411 }))
  for (let i = 0; i < PAS; i += 1) {
    const a = (i / PAS) * Math.PI * 2 + 0.3
    L.push(P(capsula(cx, cy, cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82, r * 0.16), INOX, { tabua: 0, bisel: 0.3, tom: 0.62, contorno: 0.1, metal: 0.3, semente: 7412 + i }))
  }
  L.push(P(anel(cx, cy, r + 0.4, r + 0.4, r - 0.5, r - 0.5), INOX, { tabua: 0, bisel: 0.4, tom: 0.9, contorno: 0.2, metal: 0.4, semente: 7418 }))
  L.push(P(elipse(cx, cy, r * 0.22, r * 0.22), INOX, { tabua: 0, bisel: 0.4, tom: 0.95, contorno: 0.2, metal: 0.5, semente: 7419 }))
  for (let k = 0; k < 4; k += 1) {
    const y = my0 + 2.4 + ((my1 - my0 - 4.8) * k) / 3
    L.push(P(caixa(mx * 0.25, y - 0.4, mx - 2.2, y + 0.4, 0.4), ESCURO, { tabua: 0, bisel: 0.2, contorno: 0.08, recesso: { k: 0.6, forca: 0.3 }, semente: 7420 + k }))
  }
  pintarFaixa(faixas[faixas.length - 1])
}
