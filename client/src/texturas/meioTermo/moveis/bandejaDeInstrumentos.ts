/**
 * BANDEJA DE INSTRUMENTOS de cima com volume (lote L1 de 16/11/2026, necrotério e laboratório; versão ORIGINAL, só a
 * ideia do objeto das referências): a mesinha de apoio de cirurgião, uma BANDEJA de inox de beira dobrada num pé só
 * de haste, com a base em H e quatro rodinhas que aparecem nos cantos. Na bandeja, o PANO dobrado de linho com os
 * instrumentos em fila e limpos: o BISTURI, a PINÇA, a TESOURA, a PINÇA DE ARGOLAS (a hemostática) e a SONDA; embaixo,
 * deitada de través, a SERRA de osso de cabo de madeira; à direita, fora do pano, a CUBA-RIM de esmalte branco de
 * beira azul e o FRASCO âmbar de iodo com a tampa.
 *
 * O que a separa da mesa de instrumentos de tortura (`mesaDeInstrumentos.ts`): lá é a mesa de madeira escura com o
 * couro e o ferro; aqui é o aço claro de hospital, o pano branco e a cuba-rim, que dizem "cirurgia" e não "carrasco".
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): a bandeja é um tampo solto na altura da mesa, com a beirada dobrada
 * (`ESPESSURA_DA_BANDEJA`, o perfil), sobre a haste (coluna no meio) e a base em H (coluna rasa); as rodinhas são
 * colunas baixas nos cantos, fora da bandeja. Tudo o que está em cima sobe com ela. Nada lê o giro.
 *
 * Sem material escolhido: o inox, o pano, o esmalte, o vidro e a madeira do cabo são fixos.
 */
import { anel, caixa, capsula, elipse, elipseGirada, menos, uniao, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, materialDaPeca, type MontarMovel } from './contexto'
import {
  BEIRA_AZUL, BORRACHA, ESCURO, ESMALTE, INOX, LIQUIDO_AMBAR, NIQUEL, PISO_DO_NECROTERIO, REFLEXO, VIDRO, texEscovado, texEsmalte,
} from './apoioDoNecroterio'

/** O pano de linho branco debaixo dos instrumentos. */
const PANO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xdf, 0xdc, 0xd2] }
/** O cabo da serra: a nogueira do Meio-Termo. */
const CABO: MaterialDaPeca = materialDaPeca('nogueira')

/** A altura da bandeja em casas e a beirada dobrada dela na 3/4 (px do protótipo). */
const ALTURA = 0.55
export const ESPESSURA_DA_BANDEJA = 0.04 * G
/** A bandeja recua isto da pegada; a beira dobrada (px). */
const FOLGA = 1.5
const BEIRA = 1.5
/** As rodinhas: o raio (px) e a altura (casas); a base em H (meia grossura da barra, px; altura em casas). */
const RAIO_DA_RODA = 1.6
const ALTURA_DA_RODA = 0.06
const BARRA_DA_BASE = 1.1
const ALTURA_DA_BASE = 0.05
const RAIO_DA_HASTE = 1.5

/** O brilho do aço dos instrumentos (polido). */
const BRILHO_DOS_FERROS = 0.75
const ferro = (semente: number, tom = 1.05) => ({ tabua: 0, bisel: 0.35, tom, contorno: 0.26, metal: BRILHO_DOS_FERROS, semente, projeta: { dist: 0.55, forca: 0.26 } })

/** Tesoura e pinça de argolas: as duas argolas embaixo, as lâminas cruzando no pino e a ponta em cima. */
function tesoura(x: number, yArgola: number, yPonta: number, ponta: number): { forma: Forma; pino: Forma }[] {
  const yPino = yArgola - (yArgola - yPonta) * 0.32
  const r = 1.15
  const pecas: { forma: Forma; pino: Forma }[] = []
  for (const lado of [-1, 1]) {
    const argola = anel(x + lado * 1.3, yArgola, r, r, r - 0.5, r - 0.5)
    const lamina = capsula(x + lado * 0.8, yArgola - r * 0.8, x - lado * ponta, yPonta, 0.42)
    pecas.push({ forma: uniao(argola, lamina), pino: elipse(x, yPino, 0.5, 0.5) })
  }
  return pecas
}

export const montarBandejaDeInstrumentos: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_NECROTERIO
  const z = g * ALTURA
  const [x0, y0, x1, y1] = [-hw + FOLGA, -hh + FOLGA, hw - FOLGA, hh - FOLGA]
  const bandeja = caixa(x0, y0, x1, y1, 1.6)

  // As estruturas: a bandeja solta, a haste no meio, a base em H rasa e as quatro rodinhas nos cantos.
  cena.sombras.push(
    { forma: caixa(x0 - 1, y0 - 1, x1 + 1, y1 + 1, 2.4), z: 0, suave: 1.4, forca: 0.26 },
    { forma: bandeja, z, solta: true, suave: 1.6, forca: 0.24 },
  )
  const haste = elipse(0, 0, RAIO_DA_HASTE, RAIO_DA_HASTE)
  cena.sombras.push({ forma: haste, z: z - ESPESSURA_DA_BANDEJA, suave: 0.8, forca: 0.24 })
  const xr = hw - 1.2
  const yr = hh - 1.1
  const base = uniao(uniao(capsula(-xr, -yr, -xr, yr, BARRA_DA_BASE), capsula(xr, -yr, xr, yr, BARRA_DA_BASE)), capsula(-xr, 0, xr, 0, BARRA_DA_BASE))
  cena.sombras.push({ forma: base, z: g * ALTURA_DA_BASE, forca: 0.2 }, contato(base, 0.3))
  const L = cena.partes
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const roda = elipse(sx * xr, sy * yr, RAIO_DA_RODA, RAIO_DA_RODA * 0.85)
      cena.sombras.push({ forma: roda, z: g * ALTURA_DA_RODA, forca: 0.2 }, contato(roda, 0.32))
      L.push(P(roda, BORRACHA, { tabua: 0, bisel: 0.8, contorno: 0.28, semente: 7701 }))
    }
  }

  // A bandeja: a beira dobrada e o fundo um degrau abaixo.
  L.push(P(bandeja, INOX, { eixo: 0, tabua: 0, bisel: 1, tom: 1.03, contorno: 0.28, metal: 0.35, textura: texEscovado, semente: 7710 }))
  const [fx0, fy0, fx1, fy1] = [x0 + BEIRA, y0 + BEIRA, x1 - BEIRA, y1 - BEIRA]
  L.push(P(caixa(fx0, fy0, fx1, fy1, 0.9), INOX, { eixo: 0, tabua: 0, bisel: 0.4, tom: 0.9, contorno: 0.22, metal: 0.3, recesso: { k: 1.6, forca: 0.36 }, textura: texEscovado, semente: 7711 }))

  // O pano dobrado (a dobra é a linha clara do meio) nos dois terços da esquerda.
  const largura = fx1 - fx0
  const altura = fy1 - fy0
  const xPano = fx0 + largura * 0.66
  L.push(P(caixa(fx0 + 0.8, fy0 + 0.8, xPano, fy1 - 0.8, 0.8), PANO, { tabua: 0, bisel: 0.8, contorno: 0.22, ruga: 0.25, semente: 7712, projeta: { dist: 0.6, forca: 0.22 } }))
  L.push(P(capsula(fx0 + 1.4, fy0 + altura * 0.5, xPano - 0.6, fy0 + altura * 0.5, 0.35), PANO, { tabua: 0, bisel: 0.2, tom: 0.9, contorno: 0, alfa: 0.6, semente: 7713 }))

  // Os instrumentos em fila, de pé no pano: o bisturi, a pinça, a tesoura, a pinça de argolas e a sonda.
  const yTopo = fy0 + 2.2
  const yPe = fy0 + altura * 0.62
  const passo = (xPano - fx0 - 3) / 5
  const xi = (i: number): number => fx0 + 2.6 + i * passo
  // O bisturi: o cabo chato e a lâmina clara.
  L.push(P(capsula(xi(0), yTopo + 3, xi(0), yPe, 0.62), NIQUEL, ferro(7720, 0.98)))
  L.push(P(elipseGirada(xi(0) + 0.15, yTopo + 1.5, 0.75, 1.9, 0.12), INOX, { ...ferro(7721, 1.22), bisel: 0.3 }))
  // A pinça: dois braços que se abrem para cima e se juntam no pé.
  for (const lado of [-1, 1]) L.push(P(capsula(xi(1), yPe, xi(1) + lado * 0.9, yTopo, 0.4), NIQUEL, ferro(7722)))
  // A tesoura e a pinça de argolas (mais longa, de ponta fina).
  for (const [i, ponta, semente] of [[2, 0.5, 7723], [3, 0.2, 7726]] as const) {
    for (const { forma, pino } of tesoura(xi(i), yPe - 0.6, yTopo + (i === 3 ? 0 : 2), ponta)) {
      L.push(P(forma, NIQUEL, ferro(semente)))
      L.push(P(pino, INOX, { ...ferro(semente + 1, 0.8), bisel: 0.2 }))
    }
  }
  // A sonda: a haste fina com a bolinha na ponta.
  L.push(P(capsula(xi(4), yTopo + 1, xi(4), yPe, 0.3), NIQUEL, ferro(7728)))
  L.push(P(elipse(xi(4), yTopo + 1, 0.55, 0.55), NIQUEL, ferro(7729, 1.1)))

  // A serra de osso deitada de través embaixo do pano: o cabo de madeira, a costa de aço e a lâmina com os dentes.
  const ySerra = fy0 + altura * 0.82
  const xc0 = fx0 + 1.6
  const xc1 = xc0 + largura * 0.17
  const xl1 = xPano + 1.4
  L.push(P(caixa(xc1, ySerra - 1.5, xl1, ySerra + 0.9, 0.3), INOX, { ...ferro(7730, 1.12), bisel: 0.3, eixo: 0 }))
  L.push(P(capsula(xc1, ySerra - 1.7, xl1, ySerra - 1.7, 0.5), NIQUEL, ferro(7731, 0.92)))
  L.push(P(caixa(xc1 + 0.4, ySerra + 0.6, xl1 - 0.3, ySerra + 1.05, 0), ESCURO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, semente: 7732 }))
  L.push(P(capsula(xc0, ySerra - 0.4, xc1 + 0.6, ySerra - 0.4, 1.4), CABO, { eixo: 0, tabua: 0, bisel: 1, contorno: 0.28, semente: 7733, projeta: { dist: 0.7, forca: 0.28 } }))
  for (const t of [0.3, 0.75]) L.push(P(elipse(xc0 + (xc1 - xc0) * t, ySerra - 0.4, 0.4, 0.4), NIQUEL, { ...ferro(7734), bisel: 0.2 }))

  // A cuba-rim de esmalte, fora do pano: a beira azul, o fundo branco e a lasca.
  const [kx, ky] = [xPano + (fx1 - xPano) / 2, fy0 + altura * 0.3]
  const rim = (k: number): Forma => menos(elipse(kx, ky, 3.7 * k, 6 * k), elipse(kx + 3.1 * k, ky, 1.9 * k, 2.6 * k))
  L.push(P(rim(1), BEIRA_AZUL, { tabua: 0, bisel: 0.6, contorno: 0.3, textura: texEsmalte, semente: 7740, projeta: { dist: 0.7, forca: 0.28 } }))
  L.push(P(rim(0.8), ESMALTE, { tabua: 0, bisel: 1.2, contorno: 0.14, recesso: { k: 1.4, forca: 0.32 }, textura: texEsmalte, semente: 7741 }))
  L.push(P(elipse(kx - 2.6, ky - 3.4, 0.55, 0.4), BEIRA_AZUL, { tabua: 0, bisel: 0, contorno: 0, tom: 0.7, semente: 7742 }))

  // O frasco âmbar de iodo: o vidro, o líquido por dentro, a tampa preta e o reflexo.
  const [bx, by] = [kx, fy0 + altura * 0.78]
  L.push(P(elipse(bx, by, 2.5, 2.5), VIDRO, { tabua: 0, bisel: 0.6, tom: 0.75, contorno: 0.28, alfa: 0.92, semente: 7743, projeta: { dist: 0.8, forca: 0.28 } }))
  L.push(P(elipse(bx, by, 2, 2), LIQUIDO_AMBAR, { tabua: 0, bisel: 0, tom: 0.8, contorno: 0, alfa: 0.8, semente: 7744 }))
  L.push(P(elipse(bx, by, 1.2, 1.2), BORRACHA, { tabua: 0, bisel: 0.5, tom: 1.2, contorno: 0.26, semente: 7745 }))
  L.push(P(elipse(bx - 1.2, by - 1.3, 0.6, 0.35), REFLEXO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.6, suave: 0.3, semente: 7746 }))
}
