/**
 * GABINETE DE BANHEIRO de cima com volume (banheiro moderno, pedido do mestre de 15/11/2026): a PIA de banheiro com
 * o GABINETE de portas embaixo, o TAMPO de louça branca com a CUBA oval cavada nele e o ESPELHO na parede, atrás. A
 * frente é o lado de baixo; o espelho fica no fundo (a beira de cima).
 *
 * DE CIMA aparecem o tampo branco, a cuba oval funda (a parede de dentro na sombra do tampo do lado da luz, o fundo
 * um degrau mais escuro e o ralo de cromo), a torneira monocomando atrás da cuba, com a bica sobre ela e a alavanca
 * para trás, o frasco de sabonete no canto e, no fundo, o fio do espelho visto de cima. A pia moderna de cozinha é a
 * bancada de pedra com a cuba de aço; esta é toda branca, com a cuba oval: é o oval branco no tampo branco que diz
 * "pia de banheiro" de longe.
 *
 * NA 3/4 A FRENTE É O GABINETE, desenhado de frente e guardado em faixas debaixo do tampo como a frente da pia
 * (`guardaRoupa.ts`): a beira do tampo de louça com o fio de luz e a sombra dela na madeira, as duas portas lisas de
 * madeira com o puxador reto de cromo deitado no alto de cada uma, e o rodapé escuro recuado. GIRADO, a face que fica
 * embaixo na tela é desenhada do mesmo jeito (`guardarFaceGirada`): de lado, a lateral com a beira das portas na
 * quina da frente; de costas, o fundo de madeira.
 *
 * O ESPELHO é uma coluna fina no fundo, da altura dele: sem giro a frente dela é o próprio espelho, com o brilho
 * no alto e os dois reflexos em diagonal (peças que só a 3/4 vê, `soNaTresQuartos`); de lado ele aparece de quina, a
 * chapa fina em pé; de costas (meia volta) ele ficaria na frente do gabinete e o esconderia, então fica só o fio de
 * cima, na beira do tampo.
 *
 * Material: `madeira` (o gabinete). A louça, o cromo e o espelho são fixos.
 */
import { caixa, capsula, dentroDe, elipse, poligono, type Forma } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { CANTONEIRA, FRESTA, SOMBRA_DA_MADEIRA, fatiar, guardarFaceGirada, naFaixa, type OpcoesDaFrente, type PecaDaFrente } from './guardaRoupa'
import { quartosDoGiro } from './pipaDeitada'
import { comMeioEm } from './andaimeDaTresQuartos'
import { BRILHO_DO_CROMO, CROMO, ESCURO, LOUCA, PISO_DO_BANHEIRO, REFLEXO, soNaTresQuartos, texLouca, type PecaDaTela } from './apoioDoBanheiroModerno'

/** A altura do tampo e a do alto do espelho, em casas. */
const ALTURA = 0.58
const ALTO_DO_ESPELHO = 1.25
/** O espelho de cima (px do protótipo): a grossura e o quanto ele fica para dentro de cada lado. */
const ESPELHO = { grossura: 1.5, margem: 5 } as const
/** O espelho: cinza-azulado claro (reflete o banheiro claro), mais escuro que a louça para ela se destacar dele. */
const VIDRO_DO_ESPELHO: MaterialDaPeca = { classe: 'liso', rgb: [0xbe, 0xcb, 0xce] }
/** De costas, o meio da caixa do fio do espelho fica este tanto para dentro do fundo (px): dentro do corpo. */
const MEIO_DO_ESPELHO_DE_COSTAS = 5
/** A sombra do espelho no chão: fraca (ele fica na parede, que faz a sombra de verdade). */
const SOMBRA_DO_ESPELHO = 0.12

// ---------- o tampo, de cima ----------

/** A cuba: a meia largura e a meia fundura em fração da pegada, e quanto o meio dela fica para a frente (px). */
const CUBA = { largura: 0.34, fundura: 0.3, paraFrente: 2.2 } as const
/** A parede de dentro da cuba (px) e o ralo. */
const PAREDE_DA_CUBA = 2
const RALO = { aro: 1.6, furo: 0.7 } as const
/** A torneira: a distância da base à boca da cuba e o raio da base (px). */
const TORNEIRA = { antesDaCuba: 3.8, base: 2 } as const
/** O frasco de sabonete: a distância dos cantos de trás e o raio (px). */
const FRASCO = { canto: 6.5, raio: 2.3 } as const

// ---------- o gabinete, de frente ----------

/** A beira do tampo de frente, a sombra dela na madeira e o fio de luz do polido (px). */
const BEIRA_DO_TAMPO = 2.4
const SOMBRA_DO_TAMPO = 2.2
const FIO_DE_LUZ = 0.5
/** O rodapé recuado, a lateral que sobra de cada lado das portas, o vão entre elas e as folgas (px). */
const RODAPE = 2.8
const LATERAL = 1.6
const VAO = 0.9
const FOLGA_DE_CIMA = 0.7
const FOLGA_DE_BAIXO = 0.5
/** Uma porta a cada tanto de largura, em casas. */
const LARGURA_DA_PORTA = 0.5
/** O puxador reto deitado no alto da porta: a folga do alto, o comprimento e o raio (px). */
const PUXADOR = { doAlto: 2.6, comprimento: 8, raio: 0.55 } as const
/** A madeira de frente: o corpo nas frestas, as portas, a lateral e as costas; a beira da porta de lado (px). */
const TOM_DO_CORPO = 0.74
const TOM_DA_PORTA = 1
const TOM_DA_LATERAL = 0.86
const TOM_DAS_COSTAS = 0.82
const PORTA_DE_LADO = 1.4
const JUNTA = 0.4
const RECORTE_DO_RODAPE = 2.2

/** A madeira de pé: veio de cima a baixo, sem tábuas (a porta lisa). */
function madeiraDePe(tom: number, semente: number, bisel: number): OpcoesDaFrente {
  return { eixo: QUARTO, tabua: 0, bisel, tom, contorno: 0.2, semente }
}

/** A caixa entre dois x quaisquer (a quina pode ficar à esquerda ou à direita). */
function entre(xa: number, xb: number, y0: number, y1: number, raio: number): Forma {
  return caixa(Math.min(xa, xb), y0, Math.max(xa, xb), y1, raio)
}

/** O que corre no alto das três faces: a sombra do tampo na madeira e, por cima, a beira de louça com o fio de luz. */
function beiraDoTampo(xa: number, xb: number, H: number): PecaDaFrente[] {
  const alto = -H + BEIRA_DO_TAMPO
  return [
    { forma: caixa(xa + 0.5, alto - 0.3, xb - 0.5, alto + SOMBRA_DO_TAMPO, 0), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.2, semente: 9420 } },
    { forma: caixa(xa, -H, xb, alto, 0.6), mat: LOUCA, o: { eixo: 0, tabua: 0, bisel: 0.8, tom: 0.97, contorno: 0.18, textura: texLouca, semente: 9421 } },
    { forma: caixa(xa + 0.6, -H + 0.3, xb - 0.6, -H + 0.3 + FIO_DE_LUZ, 0.2), mat: REFLEXO, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.6, semente: 9422 } },
  ]
}

/** O puxador reto de cromo, deitado: a sombra dele na porta e a barra. `x` = o meio; `y` = a altura (y < 0). */
function puxador(x: number, y: number): PecaDaFrente[] {
  const { comprimento, raio } = PUXADOR
  const meio = comprimento / 2
  return [
    { forma: capsula(x - meio + 0.8, y + 1, x + meio + 0.8, y + 1, raio + 0.25), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1, semente: 9423 } },
    { forma: capsula(x - meio, y, x + meio, y, raio), mat: CROMO, o: { tabua: 0, bisel: raio * 0.9, contorno: 0.24, metal: BRILHO_DO_CROMO, semente: 9424 } },
  ]
}

/** A FRENTE, de frente (x de `xa` a `xb`, y = 0 no chão e negativo para cima). */
function desenharFrente(c: ContextoDoMovel, H: number, xa: number, xb: number): PecaDaFrente[] {
  const mad = c.m.madeira
  const pecas: PecaDaFrente[] = [
    { forma: caixa(xa, -H, xb, 0, 0.5), mat: mad, o: madeiraDePe(TOM_DO_CORPO, 9430, 0.9) },
    { forma: caixa(xa + LATERAL, -RODAPE, xb - LATERAL, 0, 0.3), mat: ESCURO, o: { tabua: 0, bisel: 0.4, contorno: 0.1, recesso: { k: 1.2, forca: 0.3 }, semente: 9431 } },
  ]
  const largura = xb - xa
  const portas = Math.max(1, Math.round(largura / (c.g * LARGURA_DA_PORTA)))
  const larguraDaPorta = (largura - 2 * LATERAL - (portas - 1) * VAO) / portas
  const topo = H - BEIRA_DO_TAMPO - FOLGA_DE_CIMA
  const pe = RODAPE + FOLGA_DE_BAIXO
  for (let i = 0; i < portas; i += 1) {
    const x0 = xa + LATERAL + i * (larguraDaPorta + VAO)
    const x1 = x0 + larguraDaPorta
    pecas.push({ forma: caixa(x0, -topo, x1, -pe, 0.6), mat: mad, o: madeiraDePe(TOM_DA_PORTA, 9432 + i, 0.9) })
    pecas.push(...puxador((x0 + x1) / 2, -topo + PUXADOR.doAlto))
  }
  pecas.push(...beiraDoTampo(xa, xb, H))
  return pecas
}

/** A LATERAL, de frente (x na tela): a chapa de madeira, a beira das portas na quina da frente (`quina` = -1 à esquerda na tela, 1 à direita), o recorte do rodapé e a beira do tampo. */
function desenharLateral(c: ContextoDoMovel, H: number, hx: number, quina: -1 | 1): PecaDaFrente[] {
  const mad = c.m.madeira
  const xq = quina * hx
  const xPorta = xq - quina * PORTA_DE_LADO
  const topo = H - BEIRA_DO_TAMPO - FOLGA_DE_CIMA
  const pe = RODAPE + FOLGA_DE_BAIXO
  return [
    { forma: caixa(-hx, -H, hx, 0, 0.5), mat: mad, o: madeiraDePe(TOM_DA_LATERAL, 9440, 0.9) },
    { forma: entre(xPorta, xPorta - quina * JUNTA, -topo, -pe, 0), mat: ESCURO, o: { tabua: 0, bisel: 0, contorno: 0, semente: 9441 } },
    { forma: entre(xq, xPorta, -topo, -pe, 0.4), mat: mad, o: madeiraDePe(TOM_DA_PORTA, 9442, 0.5) },
    { forma: entre(xq, xq - quina * RECORTE_DO_RODAPE, -RODAPE, 0, 0.3), mat: ESCURO, o: { tabua: 0, bisel: 0.3, contorno: 0.1, recesso: { k: 1, forca: 0.3 }, semente: 9443 } },
    ...beiraDoTampo(-hx, hx, H),
  ]
}

/** As COSTAS, de frente: o fundo de madeira, a sombra no pé e a beira do tampo. */
function desenharCostas(c: ContextoDoMovel, H: number, hx: number): PecaDaFrente[] {
  return [
    { forma: caixa(-hx, -H, hx, 0, 0.5), mat: c.m.madeira, o: madeiraDePe(TOM_DAS_COSTAS, 9445, 0.9) },
    { forma: caixa(-hx + 0.4, -0.9, hx - 0.4, 0, 0.2), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.35, suave: 0.6, semente: 9446 } },
    ...beiraDoTampo(-hx, hx, H),
  ]
}

/** A frente guardada debaixo do tampo (sem giro): o corpo até as frestas, as cantoneiras, as frestas e as cópias. */
function guardarAFrente(c: ContextoDoMovel, cena: Cena, H: number): void {
  const { hw, hh, h } = c
  const { faixas, frente } = fatiar(H, 0, 0, h, hh)
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1.2), z: H })
  for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
  for (const fx of faixas) {
    if (fx.topo > fx.pe) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
  }
  const desenho = desenharFrente(c, H, -hw, hw)
  for (const fx of faixas) {
    for (const peca of desenho) {
      const copia = naFaixa(c.peca, peca, fx)
      if (copia !== null) cena.partes.push(copia)
    }
  }
}

/**
 * O espelho de frente, como a 3/4 o vê sem giro (x da pegada, y da tela): o brilho no alto, o fio de luz da beira de
 * cima e os dois reflexos em diagonal, presos no retângulo de vidro que aparece acima do tampo.
 */
function brilhosDoEspelho(c: ContextoDoMovel, H: number): PecaDaTela[] {
  const { hw, hh, g } = c
  const x0 = -hw + ESPELHO.margem
  const x1 = hw - ESPELHO.margem
  const alto = -hh + ESPELHO.grossura - g * ALTO_DO_ESPELHO
  const vidro = caixa(x0 + 0.6, alto + 0.6, x1 - 0.6, -hh - H - 0.5, 0.3)
  const reflexo = (xa: number, larg: number): Forma =>
    dentroDe(poligono([[xa, alto + 1], [xa + larg, alto + 1], [xa + larg - 13, alto + 21], [xa - 13, alto + 21]]), vidro)
  return [
    { forma: dentroDe(elipse(x0 + 7, alto + 5, 15, 9), vidro), mat: REFLEXO, o: { bisel: 0, contorno: 0, alfa: 0.16, suave: 4, semente: 9450 } },
    { forma: dentroDe(caixa(x0 + 1, alto + 0.9, x1 - 1, alto + 1.6), vidro), mat: REFLEXO, o: { bisel: 0, contorno: 0, alfa: 0.45, semente: 9451 } },
    { forma: reflexo(x0 + 15, 5.5), mat: REFLEXO, o: { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.8, semente: 9452 } },
    { forma: reflexo(x0 + 24, 2.2), mat: REFLEXO, o: { bisel: 0, contorno: 0, alfa: 0.22, suave: 0.6, semente: 9453 } },
  ]
}

export const montarGabineteDeBanheiro: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  cena.corDoPiso = PISO_DO_BANHEIRO
  const H = g * ALTURA
  const quartos = quartosDoGiro(c.giro)
  const L = cena.partes

  // O gabinete: a frente (sem giro) ou a face que o giro põe embaixo na tela, guardadas debaixo do tampo.
  if (quartos === 0) guardarAFrente(c, cena, H)
  else if (quartos % 2 === 1) guardarFaceGirada(P, cena, quartos, H, { xa: -hh, xb: hh, y0: -hw, y1: hw, raio: 1.2 }, desenharLateral(c, H, hh, quartos === 1 ? -1 : 1))
  else guardarFaceGirada(P, cena, quartos, H, { xa: -hw, xb: hw, y0: -hh, y1: hh, raio: 1.2 }, desenharCostas(c, H, hw))
  cena.sombras.push(contato(caixa(-hw, -hh, hw, hh, 1.2)))

  // O espelho: a coluna fina no fundo. De costas ele fica sem coluna (em pé esconderia o gabinete) e o fio de cima
  // sobe com o tampo: o meio da caixa dele vai para dentro do corpo, longe das frestas da face guardada na beira.
  const espelho = caixa(-hw + ESPELHO.margem, -hh, hw - ESPELHO.margem, -hh + ESPELHO.grossura, 0.4)
  if (quartos !== 2) cena.sombras.push({ forma: espelho, z: g * ALTO_DO_ESPELHO, forca: SOMBRA_DO_ESPELHO })
  if (quartos === 0) soNaTresQuartos(P, cena, 0, -hh + ESPELHO.grossura + 0.6, brilhosDoEspelho(c, H))

  // O TAMPO de louça e a CUBA oval cavada nele (a parede na sombra do tampo, o fundo e o ralo).
  L.push(P(caixa(-hw, -hh, hw, hh, 1.6), LOUCA, { bisel: 1.5, contorno: 0.24, textura: texLouca, semente: 9400 }))
  const rx = w * CUBA.largura
  const ry = h * CUBA.fundura
  const cy = CUBA.paraFrente
  L.push(P(elipse(0, cy, rx, ry), LOUCA, { bisel: 0.5, tom: 0.9, contorno: 0.26, recesso: { k: 2.8, forca: 0.36 }, textura: texLouca, semente: 9401 }))
  L.push(P(elipse(0.4, cy + 0.8, rx - PAREDE_DA_CUBA, ry - PAREDE_DA_CUBA), LOUCA, { bisel: 1.6, tom: 0.85, contorno: 0, textura: texLouca, semente: 9402 }))
  const yRalo = cy + ry * 0.22
  L.push(P(elipse(0, yRalo, RALO.aro, RALO.aro * 0.88), CROMO, { bisel: 1, contorno: 0.26, metal: BRILHO_DO_CROMO, semente: 9403 }))
  L.push(P(elipse(0, yRalo, RALO.furo, RALO.furo * 0.88), ESCURO, { bisel: 0, contorno: 0, semente: 9404 }))
  // O brilho da louça na beira da cuba, do lado da luz.
  L.push(P(elipse(-rx * 0.62, cy - ry * 0.55, rx * 0.22, ry * 0.18), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.35, suave: 1.2, semente: 9405 }))

  // A TORNEIRA atrás da cuba: a alavanca para trás, a bica sobre a cuba e a base redonda.
  const yBase = cy - ry - TORNEIRA.antesDaCuba
  L.push(P(capsula(0.8, yBase - 0.4, 3.4, yBase - 1.9, 0.6), CROMO, { bisel: 0.55, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9406, projeta: { dist: 1, forca: 0.28 } }))
  L.push(P(capsula(0, yBase, 0, cy - ry + 3, 1.1), CROMO, { bisel: 1, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9407, projeta: { dist: 1.6, forca: 0.3 } }))
  L.push(P(elipse(0, yBase, TORNEIRA.base, TORNEIRA.base), CROMO, { bisel: 1.6, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9408, projeta: { dist: 1, forca: 0.28 } }))

  // O FRASCO de sabonete no canto de trás à direita: o frasco de louça e a válvula de cromo.
  const xf = hw - FRASCO.canto
  const yf = -hh + FRASCO.canto
  L.push(P(elipse(xf, yf, FRASCO.raio, FRASCO.raio), LOUCA, { bisel: 1.6, tom: 0.96, contorno: 0.26, textura: texLouca, semente: 9409, projeta: { dist: 1.6, forca: 0.3 } }))
  L.push(P(capsula(xf, yf, xf - 2.2, yf + 0.4, 0.55), CROMO, { bisel: 0.5, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9410, projeta: { dist: 0.6, forca: 0.24 } }))
  L.push(P(elipse(xf, yf, 0.9, 0.9), CROMO, { bisel: 0.8, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9411 }))

  // O ESPELHO visto de cima, por cima de tudo: o fio de vidro na parede.
  const espelhoDeCima = quartos === 2 ? comMeioEm(espelho, 0, -hh + MEIO_DO_ESPELHO_DE_COSTAS) : espelho
  L.push(P(espelhoDeCima, VIDRO_DO_ESPELHO, { bisel: 0.5, contorno: 0.32, semente: 9412 }))
}
