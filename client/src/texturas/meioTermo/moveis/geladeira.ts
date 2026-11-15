/**
 * GELADEIRA de inox de cima com volume (refeita em 15/11/2026, pedido do
 * mestre: "a geladeira coloque a versão original de metal"; ele escolheu a
 * moderna de inox, de porta dupla e puxadores retos). Até então era a caixa de
 * gelo de madeira com tampa de zinco (28/10/2026). As duas portas ficam LADO A
 * LADO: numa casa de largura é a geladeira de duas portas que tem a proporção
 * certa, e a fresta de pé no meio com os dois puxadores é o que diz "geladeira"
 * de longe.
 *
 * DE CIMA aparece o TAMPO de aço escovado (os riscos correm de lado a lado),
 * com a beira de trás um degrau mais escura e as tampas das dobradiças nos
 * cantos da frente; na beira da frente, o alto das portas: a beira clara do
 * tampo, a fresta do meio e a ponta de cima dos dois puxadores. O cinza frio no
 * meio do mapa quente é o que diz "metal" a 25% de zoom, e a sombra comprida
 * diz que ela é alta.
 *
 * NA 3/4 A FRENTE MOSTRA AS PORTAS INTEIRAS, com a frente em faixas do
 * guarda-roupa (`guardaRoupa.ts`): as duas folhas de aço escovado de pé, a
 * fresta escura entre elas, os puxadores retos com os pés e a sombra deles na
 * porta, o dispenser de água na porta da esquerda, a beira clara do tampo em
 * cima e a grade escura do rodapé embaixo. Nada da frente sobe para o tampo:
 * cada faixa tem a sua fresta, e a 3/4 a põe na altura dela. O perfil da 3/4 é
 * sem beirada (`tresQuartos.ts`), para a grade do rodapé chegar ao chão.
 *
 * Sem material escolhido: o aço, a grade e o vão do dispenser são fixos (o mapa
 * antigo com madeira e latão escolhidos na geladeira abre de inox).
 */
import type { Rgb } from '../../ruido'
import { caixa, capsula, type Forma } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type MontarMovel } from './contexto'
import { CANTONEIRA, FRESTA, fatiar, naFaixa, type Faixa, type OpcoesDaFrente, type PecaDaFrente } from './guardaRoupa'
import { quartosDeVolta } from './varalDeBandeirinhas'

/** Altura da geladeira em casas (a sombra; na 3/4, a frente). */
const ALTURA = 1.45
/** A faixa de cima da frente (o alto das portas, que se vê também de cima), em casas, e o máximo dela em fração da profundidade. */
const FAIXA_DE_CIMA = 0.13
const PARTE_DA_FAIXA_DE_CIMA = 0.3

/**
 * O aço escovado: cinza frio e claro, quase sem cor (saturação HSV 0,03). A classe é a lisa: o risco do escovado é
 * textura própria de cada peça, e a lateral que a 3/4 varre (a geladeira girada) sai chapa limpa; com a classe do
 * metal, ela ganhava as manchas do ferro batido e parecia concreto.
 */
const INOX: MaterialDaPeca = { classe: 'liso', rgb: [0xa9, 0xad, 0xaf] }
/** A grade do rodapé, o fundo da fresta e o vão do dispenser: o mesmo cinza frio, bem escuro. */
const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x40, 0x43, 0x46] }
/** A sombra do puxador na porta: o escuro do aço, meio transparente. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x2f, 0x32] }
/** O escuro em que o pixel escuro demais é levantado: com o padrão (a nogueira), a fresta e a grade saíam marrons. */
const ESCURO_DO_INOX: Rgb = [0x46, 0x49, 0x4c]

/** Os tons do aço: o tampo, as portas (de frente, com menos luz), o corpo que aparece em volta delas, a beira de cima e o puxador. */
const TOM_DO_TAMPO = 1
const TOM_DA_PORTA = 0.86
const TOM_DO_CORPO = 0.72
const TOM_DA_BEIRA = 1.04
const TOM_DO_PUXADOR = 1.14
/** Brilho do metal: o tampo e as portas, foscos de escovado; o puxador, polido. */
const BRILHO_DA_CHAPA = 0.3
const BRILHO_DO_PUXADOR = 0.7

/** Abaixo desta escala (pixels da imagem por px do protótipo) o risco fino cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_RISCO = 1.5
/** O que sobra do risco fino abaixo dessa escala. */
const RISCO_MIUDO = 0.3

/** O aço escovado: riscos finos e longos ao comprido do veio (u) e uma mancha larga bem leve por baixo. */
const texEscovado: Textura = (u, v, _x, _y, p, s, escala) => {
  const risco = escala < ESCALA_DO_RISCO ? RISCO_MIUDO : 1
  s[3] += (ruido(u * 0.03, v * 0.9) * 0.09 + ruido(u * 0.012, v * 0.33) * 0.045) * risco + ruido(u * 0.06 + p.semente * 3, v * 0.06) * 0.06
}

// ---------- a frente, desenhada de frente ----------

/** O rodapé (a grade, em casas), a beira clara do tampo e a folga das portas em cima e embaixo (px do protótipo). */
const RODAPE = 0.07
const BEIRA_DE_CIMA = 1.6
const FOLGA = 0.5
/** O corpo que sobra de cada lado das portas e a fresta entre as duas (px do protótipo). */
const LATERAL = 0.9
const VAO = 1.1
/** O puxador: a distância da fresta, o raio da barra, o pé (fração da altura) e a folga do alto da porta (px). */
const AFASTAMENTO_DO_PUXADOR = 3
const RAIO_DO_PUXADOR = 1.05
const PE_DO_PUXADOR = 0.42
const FOLGA_DO_PUXADOR = 2.4
/** O pé do puxador (o bloco que o prende na porta): meia largura e meia altura (px). */
const PE_DA_BARRA = { meiaLargura: 1.5, meiaAltura: 1.3 } as const
/** O dispenser na porta da esquerda: a meia largura (px) e as alturas de baixo e de cima (frações da altura). */
const DISPENSER = { meiaLargura: 5.2, de: 0.5, ate: 0.68 } as const

/** A frente inteira, de frente: x como na pegada, y = 0 no chão e negativo para cima. */
function desenharFrente(hw: number, H: number, g: number): PecaDaFrente[] {
  const pecas: PecaDaFrente[] = []
  const por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFrente): void => {
    pecas.push({ forma, mat, o })
  }
  const chapaDePe = (tom: number, semente: number, bisel: number): OpcoesDaFrente => ({ eixo: QUARTO, tabua: 0, bisel, tom, metal: BRILHO_DA_CHAPA, textura: texEscovado, semente })
  const rodape = g * RODAPE
  const peDaPorta = rodape + FOLGA
  const topoDaPorta = H - BEIRA_DE_CIMA - FOLGA

  // O corpo por trás de tudo (as laterais que aparecem dos dois lados das portas) e a grade recuada do rodapé.
  por(caixa(-hw, -H, hw, 0, 0.6), INOX, chapaDePe(TOM_DO_CORPO, 820, 0.9))
  por(caixa(-hw + 1.2, -rodape, hw - 1.2, 0, 0.4), ESCURO, { tabua: 0, bisel: 0.5, contorno: 0.1, recesso: { k: 1.2, forca: 0.3 }, semente: 821 })
  // A fresta do meio e as duas folhas.
  por(caixa(-VAO / 2 - 0.3, -topoDaPorta, VAO / 2 + 0.3, -peDaPorta), ESCURO, { tabua: 0, bisel: 0, contorno: 0, semente: 822 })
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? -hw + LATERAL : VAO / 2
    const x1 = lado < 0 ? -VAO / 2 : hw - LATERAL
    por(caixa(x0, -topoDaPorta, x1, -peDaPorta, 1.3), INOX, { ...chapaDePe(TOM_DA_PORTA, 824 + lado, 1.4), contorno: 0.2 })
  }

  // O dispenser na porta da esquerda (o freezer): a moldura de aço, o vão escuro e a bandeja de pingos.
  const xd = (-hw + LATERAL - VAO / 2) / 2
  const yd0 = -H * DISPENSER.de
  const yd1 = -H * DISPENSER.ate
  const md = DISPENSER.meiaLargura
  por(caixa(xd - md, yd1, xd + md, yd0, 1.4), INOX, { tabua: 0, bisel: 0.9, tom: 0.74, contorno: 0.2, metal: 0.25, semente: 830 })
  por(caixa(xd - md + 1.2, yd1 + 2.8, xd + md - 1.2, yd0 - 1.1, 1), ESCURO, { tabua: 0, bisel: 0.4, contorno: 0.1, recesso: { k: 1.6, forca: 0.35 }, semente: 831 })
  por(caixa(xd - md + 1.4, yd1 + 0.9, xd + md - 1.4, yd1 + 2, 0.5), ESCURO, { tabua: 0, bisel: 0.3, contorno: 0.1, tom: 1.25, semente: 832 })
  por(caixa(xd - md + 1.5, yd0 - 2.3, xd + md - 1.5, yd0 - 1.1, 0.4), INOX, { tabua: 0, bisel: 0.5, tom: 0.92, contorno: 0.16, metal: 0.4, semente: 833 })

  // Os puxadores retos, de pé junto da fresta: a sombra na porta, os dois pés e a barra.
  const pePux = H * PE_DO_PUXADOR
  const topoPux = topoDaPorta - FOLGA_DO_PUXADOR
  for (const lado of [-1, 1]) {
    const x = lado * (VAO / 2 + AFASTAMENTO_DO_PUXADOR)
    por(capsula(x + 1.3, -topoPux + 1.3, x + 1.3, -pePux + 1.3, RAIO_DO_PUXADOR + 0.25), SOMBRA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.2, semente: 840 })
    for (const t of [pePux + PE_DA_BARRA.meiaAltura, topoPux - PE_DA_BARRA.meiaAltura]) {
      por(caixa(x - PE_DA_BARRA.meiaLargura, -t - PE_DA_BARRA.meiaAltura, x + PE_DA_BARRA.meiaLargura, -t + PE_DA_BARRA.meiaAltura, 0.8), INOX, { tabua: 0, bisel: 0.8, tom: 0.9, contorno: 0.22, metal: 0.4, semente: 841 })
    }
    por(capsula(x, -topoPux, x, -pePux, RAIO_DO_PUXADOR), INOX, { eixo: QUARTO, tabua: 0, bisel: RAIO_DO_PUXADOR * 0.9, tom: TOM_DO_PUXADOR, contorno: 0.24, metal: BRILHO_DO_PUXADOR, semente: 842 })
  }

  // A beira clara do tampo, em cima de tudo.
  por(caixa(-hw, -H, hw, -H + BEIRA_DE_CIMA, 0.5), INOX, { eixo: 0, tabua: 0, bisel: 0.7, tom: TOM_DA_BEIRA, contorno: 0.16, metal: 0.4, textura: texEscovado, semente: 850 })
  return pecas
}

// ---------- o tampo ----------

/** A beira de trás do tampo, um degrau mais escura (px do protótipo), e as tampas das dobradiças nos cantos da frente. */
const BEIRA_DE_TRAS = 3.4
const DOBRADICA = { meiaLargura: 3, meiaAltura: 1.7, doCanto: 4.4, daFrente: 2.6 } as const

export const montarGeladeira: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  const H = g * ALTURA
  const deCima = Math.min(g * FAIXA_DE_CIMA, h * PARTE_DA_FAIXA_DE_CIMA)
  const { faixas, frente } = fatiar(H, 0, deCima, h, hh)
  const desenho = desenharFrente(hw, H, g)
  cena.corDoPiso = ESCURO_DO_INOX

  // Sem giro, o corpo dá a sombra comprida e a frente lisa por baixo das faixas; as cantoneiras fecham as frestas dos
  // dois lados e a fresta de cada faixa não faz sombra no chão: só diz à 3/4 a altura da faixa. Girado, a frente fica
  // de lado ou atrás na 3/4, que só varre o inox: o corpo vai até a beira e só entra a faixa de cima (a que se vê de
  // cima), que sobe com ele. A frente guardada ali só deixaria um fio dela na beira da lateral.
  const deFrente = quartosDeVolta(c.giro) === 0
  if (deFrente) {
    cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1), z: H })
    for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
    for (const fx of faixas) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
  } else {
    cena.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 1), z: H })
  }
  cena.sombras.push(contato(caixa(-hw, -hh, hw, hh, 1)))

  const L = cena.partes
  const pintarFaixa = (fx: Faixa): void => {
    for (const peca of desenho) {
      const copia = naFaixa(P, peca, fx)
      if (copia !== null) L.push(copia)
    }
  }
  // As faixas guardadas primeiro, escondidas pelo tampo; depois o tampo e, na frente dele, a faixa de cima.
  if (deFrente) faixas.slice(0, -1).forEach(pintarFaixa)
  L.push(P(caixa(-hw, -hh, hw, hh, 1.6), INOX, { eixo: 0, tabua: 0, bisel: 1.8, tom: TOM_DO_TAMPO, contorno: 0.26, metal: BRILHO_DA_CHAPA, textura: texEscovado, semente: 800 }))
  L.push(P(caixa(-hw + 1.4, -hh + 0.8, hw - 1.4, -hh + BEIRA_DE_TRAS, 0.6), INOX, { eixo: 0, tabua: 0, bisel: 0.6, tom: 0.86, contorno: 0.12, metal: 0.2, textura: texEscovado, semente: 801 }))
  const yDobradica = frente - deCima - DOBRADICA.daFrente
  for (const sx of [-1, 1]) {
    const xm = sx * (hw - DOBRADICA.doCanto)
    L.push(P(caixa(xm - DOBRADICA.meiaLargura, yDobradica - DOBRADICA.meiaAltura, xm + DOBRADICA.meiaLargura, yDobradica + DOBRADICA.meiaAltura, 1), INOX, { tabua: 0, bisel: 0.9, tom: 0.9, contorno: 0.2, metal: 0.35, semente: 802 }))
  }
  pintarFaixa(faixas[faixas.length - 1])
}
