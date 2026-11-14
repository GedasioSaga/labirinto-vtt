/**
 * BALCÃO DE TAVERNA de cima com volume (L09 dos objetos novos, 14/11/2026,
 * grupo Taverna e festa): o balcão comprido de quem serve, com a CHOPEIRA, as
 * CANECAS e as BANQUETAS. É outro móvel que o Balcão de casa (`balcao.ts`):
 * aquele é a tábua lisa da cozinha; este conta a taverna.
 *
 * - O TAMPO de tábuas grossas ao comprido, a beira da frente mais clara (é
 *   onde se debruça) e a faixa de trás mais escura, um degrau abaixo, do lado
 *   de quem serve. A espessura do tampo aparece na frente, e o tampo passa um
 *   pouco do corpo (o beiral).
 * - A CHOPEIRA, numa ponta: o BARRIL deitado num berço de dois calços, as
 *   aduelas ao comprido, quatro aros de ferro e a TORNEIRA de latão saindo do
 *   tampo dele para o meio do balcão, com a manopla de pé e uma caneca
 *   esperando debaixo do bico.
 * - As CANECAS espalhadas, de madeira com cerveja escura e de estanho com
 *   espuma, as marcas molhadas de outras rodadas, um pano de prato listrado e
 *   umas moedas de troco.
 * - Rente ao chão, na frente, a BARRA DE PÉ de latão, presa no corpo por braços.
 * - As BANQUETAS altas na frente, uma por casa: o assento redondo gasto no
 *   meio e os quatro pés aparecendo em volta dele.
 *
 * A 25% de zoom sobram a faixa comprida do tampo, o barril com os aros na
 * ponta, os pontinhos claros das canecas e a fila de discos das banquetas.
 *
 * NA 3/4 (perfil `{ modo: 'derivado', espessura: 0 }`, como a mesa de jogo) o
 * CORPO é uma coluna e o TAMPO, um tampo solto um pouco mais alto e maior, com
 * a espessura desenhada (a peça deslocada e mais escura, como a da mesa): o
 * beiral cai por cima da frente do corpo. Tudo o que está no tampo sobe com
 * ele. A barra de pé é um tampo solto baixo, com os braços subindo junto, e cada
 * banqueta sobe como as da mesa de jogo: os pés são colunas e a estrutura do
 * assento é só o miolo, com a caixa da banqueta inteira (para ser o último a
 * pintar). O balcão ESTICA: as tábuas correm, e ganha uma banqueta e mais
 * canecas por casa; a chopeira fica sempre na ponta da esquerda.
 *
 * As medidas são por casa (`c.g`); só a fundura do balcão encolhe se a pegada
 * for rasa. Materiais: `madeira` (o balcão e as banquetas) e `barra` (a barra
 * de pé). O barril, os aros, a torneira, as canecas e o pano são fixos.
 */
import { rgb, type Rgb } from '../../ruido'
import { anel, barra, caixa, capsula, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, QUARTO, tomLongeDoChao, type ContextoDoMovel, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { comMeioEm, desgirado, quartosDeVolta } from './varalDeBandeirinhas'

// ---------- a banqueta alta (a mesa de queda de braço usa a mesma) ----------

/** Os pés da banqueta: onde ficam (fração do raio do assento, nas diagonais) e o raio de cada um (fração do raio). */
const PE_DA_BANQUETA = { longe: 1.12, raio: 0.2 } as const
/** A espessura do assento (casas) e o quanto ela aparece à direita (fração da espessura). */
const ESPESSURA_DO_ASSENTO = 0.045
const ESPESSURA_A_DIREITA = 0.25
/** O miolo do assento, a estrutura que o sobe na 3/4 (fração do raio): menor que o círculo dos pés. */
const MIOLO_DO_ASSENTO = 0.4
/** Os tons: os pés e a espessura na sombra do assento. */
const TOM_DO_PE = 0.78
const TOM_DA_ESPESSURA = 0.64
const LONGE_DO_CHAO = 0.08
/** O miolo gasto do assento: até onde vai (fração do raio) e a luz que ganha; a sujeira na beira. */
const GASTO = { ate: 0.6, luz: 0.13, sujeira: 0.08 } as const
const FORCA_DA_SOMBRA_DO_ASSENTO = 0.26

/** O assento gasto: o miolo polido mais claro e a sujeira na beira. */
function texDoAssento(cx: number, cy: number, raio: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const r = Math.hypot(x - cx, y - cy) / raio
    const beira = GASTO.ate + ruido(x * 0.45 + p.su, y * 0.45) * 0.25
    s[3] += GASTO.luz * Math.max(0, Math.min(1, (beira - r) / 0.3)) - GASTO.sujeira * Math.max(0, Math.min(1, (r - 0.7) / 0.3))
  }
}

/**
 * Uma BANQUETA ALTA em (cx, cy), de assento com `raio` px e na altura `zAssento`
 * px: os quatro pés nas diagonais, aparecendo em volta do assento (colunas na
 * 3/4), e o assento gasto com a espessura embaixo. `veio` = o rumo das tábuas.
 */
export function montarBanquetaAlta(c: ContextoDoMovel, cena: Cena, cx: number, cy: number, raio: number, zAssento: number, veio: number, semente: number): void {
  const P = c.peca
  const mad = c.m.madeira
  const tom = tomLongeDoChao(mad, LONGE_DO_CHAO)
  const espessura = c.g * ESPESSURA_DO_ASSENTO
  const zPe = zAssento - espessura
  const rPe = raio * PE_DA_BANQUETA.raio
  const longe = raio * PE_DA_BANQUETA.longe * Math.SQRT1_2
  const quartos = quartosDeVolta(c.giro)

  // A sombra do assento no chão, solta e caída para o lado (a estrutura dele é só o miolo, sem sombra).
  const [sx, sy] = desgirado(SOMBRA_X * zAssento, SOMBRA_Y * zAssento, quartos)
  cena.sombras.push({ forma: elipse(cx + sx, cy + sy, raio, raio), z: 0, suave: 0.8 + 0.09 * zAssento, forca: FORCA_DA_SOMBRA_DO_ASSENTO })

  // Os PÉS: colunas nas diagonais, com o contato no chão.
  ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy], i) => {
    const pe = elipse(cx + dx * longe, cy + dy * longe, rPe, rPe)
    cena.sombras.push({ forma: pe, z: zPe, suave: 0.9, forca: 0.28 }, contato(elipse(cx + dx * longe, cy + dy * longe, rPe * 1.15, rPe * 1.15), 0.34))
    cena.partes.push(P(pe, mad, { eixo: QUARTO, tabua: 0, bisel: rPe * 0.8, contorno: 0.28, tom: tom * TOM_DO_PE, semente: semente + i }))
  })

  // O ASSENTO: a estrutura é só o miolo, com a caixa da banqueta inteira (para ser o último a pintar).
  const alcance = longe + rPe + 1
  const miolo = elipse(cx, cy, raio * MIOLO_DO_ASSENTO, raio * MIOLO_DO_ASSENTO)
  cena.sombras.push({ forma: { b: [cx - alcance, cy - alcance, cx + alcance, cy + alcance], d: miolo.d }, z: zAssento, solta: true, forca: 0 })
  const assento = elipse(cx, cy, raio, raio)
  cena.partes.push(P(assento, mad, { dx: espessura * ESPESSURA_A_DIREITA, dy: espessura, eixo: veio, tabua: 0, bisel: 0.7, contorno: 0.24, tom: tom * TOM_DA_ESPESSURA, semente: semente + 5 }))
  cena.partes.push(P(assento, mad, { eixo: veio, tabua: 0, bisel: raio * 0.16, contorno: 0.16, tom, semente: semente + 6, textura: texDoAssento(cx, cy, raio) }))
}

// ---------- a caneca (a mesa de queda de braço usa a mesma) ----------

const ESTANHO: MaterialDaPeca = { classe: 'metal', rgb: [0x8c, 0x90, 0x8e] }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xdc, 0xc0] }
/** A cerveja escura vista de cima, e a madeira da caneca. */
const CERVEJA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x3a, 0x22] }
const MARCA_MOLHADA: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x28, 0x1c] }
/** A marca molhada é só uma sombra de anel: mais forte, ela lia como furo no tampo. */
const ALFA_DA_MARCA = 0.13

export type TipoDeCaneca = 'madeira' | 'estanho'

/** Uma CANECA vista de cima em (cx, cy): a parede em anel, a bebida (com espuma, na de estanho) e a asa para o rumo `asa`. */
export function montarCaneca(c: ContextoDoMovel, cena: Cena, cx: number, cy: number, r: number, asa: number, tipo: TipoDeCaneca, semente: number): void {
  const P = c.peca
  const parede = tipo === 'estanho' ? ESTANHO : materialDaPeca('nogueira')
  const espuma = tipo === 'estanho'
  const [ax, ay] = [Math.cos(asa), Math.sin(asa)]
  const L = cena.partes
  L.push(P(capsula(cx + ax * r * 0.75, cy + ay * r * 0.75, cx + ax * r * 1.5, cy + ay * r * 1.5, r * 0.24), parede, { bisel: r * 0.2, tom: 0.9, contorno: 0.24, metal: 0.3, semente }))
  L.push(P(anel(cx, cy, r, r, r * 0.72, r * 0.72), parede, { bisel: r * 0.22, contorno: 0.24, metal: 0.35, tabua: 0, semente: semente + 1, projeta: { dist: r * 0.32, forca: 0.32 } }))
  L.push(P(elipse(cx, cy, r * 0.72, r * 0.72), espuma ? ESPUMA : CERVEJA, { bisel: espuma ? r * 0.2 : 0, contorno: 0.1, tom: espuma ? 0.98 : 1, recesso: { k: r * 0.25, forca: espuma ? 0.16 : 0.28 }, ruga: espuma ? 0.8 : 0, semente: semente + 2 }))
  if (espuma) {
    for (const [bx, by, br] of [[-0.28, -0.16, 0.14], [0.2, 0.22, 0.12], [0.3, -0.2, 0.1]] as const) {
      L.push(P(elipse(cx + bx * r, cy + by * r, br * r, br * r), ESPUMA, { bisel: br * r, contorno: 0.12, tom: 1.06, semente: semente + 3 }))
    }
  }
}

/** Uma marca molhada de caneca no tampo: o anel escuro e fino de outra rodada. */
export function marcaDeCaneca(c: ContextoDoMovel, cena: Cena, cx: number, cy: number, r: number, semente: number): void {
  cena.partes.push(c.peca(anel(cx, cy, r, r, r * 0.8, r * 0.8), MARCA_MOLHADA, { bisel: 0, contorno: 0, alfa: ALFA_DA_MARCA, semente }))
}

// ---------- o balcão ----------

/** As alturas em casas: o tampo, a espessura dele, a barra de pé e o assento das banquetas. */
const ALTURA = 0.62
const ESPESSURA_DO_TAMPO = 0.06
const ALTURA_DA_BARRA = 0.16
const ALTURA_DA_BANQUETA = 0.46
/** A fundura do balcão (casas) e o máximo dela em fração da pegada (o resto é das banquetas). */
const FUNDURA = 0.92
const FUNDURA_MAXIMA = 0.6
/** O beiral: quanto o tampo passa do corpo na frente e nos lados (casas). */
const BEIRAL = 0.045
/** O tampo: a tábua (casas), a faixa clara da frente e a de trás, um degrau abaixo (casas). */
const TABUA = 0.15
const FAIXA_DA_FRENTE = 0.1
const FAIXA_DE_TRAS = 0.13
/** A barra de pé: a distância da frente do corpo (casas), o raio (px) e os braços (um a cada `passo` casas). */
const BARRA_A_FRENTE = 0.09
const RAIO_DA_BARRA = 1.6
const PASSO_DOS_BRACOS = 1
/** A banqueta: o raio do assento (casas) e o meio dela à frente do balcão (casas). */
const RAIO_DA_BANQUETA = 0.17
const BANQUETA_A_FRENTE = 0.36

/** O barril da chopeira (casas): o comprimento, o raio, a distância da ponta do balcão e quanto o bojo cresce no meio. */
const BARRIL = { comprimento: 0.64, raio: 0.21, daPonta: 0.08, bojo: 0.13 } as const
/** Os aros (onde ficam ao comprido, frações) e a largura deles (px). */
const AROS_DO_BARRIL: readonly number[] = [0.1, 0.27, 0.73, 0.9]
const LARGURA_DO_ARO = 1.5
/** Os calços do berço (frações do comprimento) e quanto passam do barril para os lados (px). */
const CALCOS: readonly number[] = [0.2, 0.8]
const CALCO_ALEM = 2.4
/** A torneira: o comprimento do bico (px), o raio, e a manopla de pé. */
const BICO = { comprimento: 6, raio: 1.25 } as const
const MANOPLA = { raio: 1.6, alem: 1.4 } as const
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('latao', 1)) }
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
/** O tampo do barril, de topo: a madeira mais clara do corte. */
const TOPO_DO_BARRIL = 0.9

/** A caneca (raio em casas) e quantas por casa de balcão. */
const RAIO_DA_CANECA = 0.088
/** O pano de prato listrado (casas) e a cor das listras. */
const PANO = { largura: 0.3, altura: 0.17, giro: -0.22 } as const
const LISTRA_DO_PANO: Rgb = [0x9a, 0x4a, 0x42]
/** O pano de prato: linho cru (o linho do Meio-Termo um pouco mais claro). */
const LENCO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: rgb(tomDoMeio('linho', 1.04)) }
/** As moedas de troco: latão e cobre. */
const MOEDA_DE_LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xb8, 0x98, 0x58] }
const MOEDA_DE_COBRE: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x6c, 0x4c] }
/** Onde ficam as moedas em relação ao pano (casas). */
const MOEDAS: readonly (readonly [number, number, MaterialDaPeca])[] = [
  [-0.2, 0.08, MOEDA_DE_LATAO],
  [-0.13, 0.12, MOEDA_DE_COBRE],
  [-0.16, 0.03, MOEDA_DE_LATAO],
]

/** O pano de prato: o linho cru com duas listras da cor de vinho perto das pontas. */
function texDoPano(cx: number, cy: number, ang: number, largura: number): Textura {
  const tecido = texturaDaClasse('tecido')
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return (u, v, x, y, p, s, escala) => {
    if (tecido !== null) tecido(u, v, x, y, p, s, escala)
    const ao = Math.abs((x - cx) * co + (y - cy) * si) / (largura / 2)
    if ((ao > 0.62 && ao < 0.7) || (ao > 0.76 && ao < 0.8)) {
      s[0] = LISTRA_DO_PANO[0]
      s[1] = LISTRA_DO_PANO[1]
      s[2] = LISTRA_DO_PANO[2]
    }
  }
}

/** O retângulo girado `ang` em volta de (cx, cy), de meias medidas (mx, my). */
function retanguloGirado(cx: number, cy: number, mx: number, my: number, ang: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const pontos: Ponto[] = [[-mx, -my], [mx, -my], [mx, my], [-mx, my]].map(([x, y]): Ponto => [cx + x * co - y * si, cy + x * si + y * co])
  return poligono(pontos)
}

/** O BARRIL deitado da chopeira, de x0 a x1, com o eixo em `cy`: o berço, o bojo de aduelas, os aros e a torneira para o leste. */
function montarChopeira(c: ContextoDoMovel, cena: Cena, x0: number, x1: number, cy: number, raio: number): void {
  const P = c.peca
  const L = cena.partes
  const mad = materialDaPeca('carvalho')
  const comprimento = x1 - x0
  // Os calços do berço, atravessados, aparecendo dos dois lados do bojo.
  CALCOS.forEach((t, i) => {
    const x = x0 + t * comprimento
    L.push(P(caixa(x - 2, cy - raio - CALCO_ALEM, x + 2, cy + raio + CALCO_ALEM, 0.6), c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 0.7, contorno: 0.26, semente: 9600 + i, projeta: { dist: 1, forca: 0.3 } }))
  })
  // O bojo: a meia largura cresce no meio (a barriga do barril); as aduelas correm ao comprido.
  const pontos: Ponto[] = []
  const passos = 16
  for (let i = 0; i <= passos; i += 1) {
    const t = i / passos
    pontos.push([x0 + t * comprimento, cy - raio * (1 - BARRIL.bojo + BARRIL.bojo * Math.sin(Math.PI * t))])
  }
  for (let i = passos; i >= 0; i -= 1) {
    const t = i / passos
    pontos.push([x0 + t * comprimento, cy + raio * (1 - BARRIL.bojo + BARRIL.bojo * Math.sin(Math.PI * t))])
  }
  const bojo = poligono(pontos)
  L.push(P(bojo, mad, { eixo: 0, tabua: raio * 0.42, bisel: raio * 0.35, curvaY: { c: cy, r: raio, forca: 0.5 }, contorno: 0.26, semente: 9605, projeta: { dist: 2.2, forca: 0.34, suave: 1 } }))
  AROS_DO_BARRIL.forEach((t, i) => {
    const x = x0 + t * comprimento
    L.push(P(dentroDe(caixa(x - LARGURA_DO_ARO / 2, cy - raio * 1.2, x + LARGURA_DO_ARO / 2, cy + raio * 1.2), bojo), FERRO, { bisel: 0.5, curvaY: { c: cy, r: raio, forca: 0.5 }, contorno: 0.26, semente: 9610 + i }))
  })
  // O tampo do barril, de topo, na ponta da torneira: a faixa clara do corte.
  const meioDoTopo = raio * (1 - BARRIL.bojo)
  L.push(P(caixa(x1 - 1.3, cy - meioDoTopo, x1 + 0.4, cy + meioDoTopo, 0.6), mad, { eixo: QUARTO, tabua: 0, bisel: 0.5, tom: TOPO_DO_BARRIL, luz: 0.05, contorno: 0.24, semente: 9615 }))
  // A TORNEIRA de latão: o bico para o leste, a manopla de pé e o anel de vedação.
  L.push(P(capsula(x1, cy, x1 + BICO.comprimento, cy, BICO.raio), LATAO, { bisel: BICO.raio * 0.8, contorno: 0.26, metal: 0.55, semente: 9616, projeta: { dist: 1.4, forca: 0.32 } }))
  L.push(P(elipse(x1 + BICO.comprimento * 0.45, cy, MANOPLA.raio, MANOPLA.raio + MANOPLA.alem), LATAO, { bisel: MANOPLA.raio * 0.8, contorno: 0.26, metal: 0.6, tom: 1.06, semente: 9617, projeta: { dist: 1.8, forca: 0.3 } }))
  L.push(P(anel(x1 + 0.2, cy, BICO.raio * 1.7, BICO.raio * 1.7, BICO.raio * 0.9, BICO.raio * 0.9), LATAO, { bisel: 0.5, contorno: 0.24, metal: 0.5, tom: 0.9, semente: 9618 }))
}

export const montarBalcaoDeTaverna: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const H = g * ALTURA
  const espessura = g * ESPESSURA_DO_TAMPO
  const fundura = Math.min(g * FUNDURA, c.h * FUNDURA_MAXIMA)
  const y0 = -hh
  const y1 = -hh + fundura
  const beiral = g * BEIRAL

  // O CORPO (coluna) e o TAMPO (solto, um beiral maior que o corpo): na 3/4 o beiral cai por cima da frente do corpo.
  const corpo = caixa(-hw + beiral, y0 + beiral, hw - beiral, y1 - beiral, 1)
  const tampo = caixa(-hw, y0, hw, y1, 1.4)
  cena.sombras.push({ forma: corpo, z: H - espessura, forca: 0.3 }, contato(corpo, 0.34))
  cena.sombras.push({ forma: tampo, z: H, solta: true, suave: 1.8, forca: 0.2 })
  L.push(P(tampo, mad, { eixo: 0, dx: espessura * 0.2, dy: espessura, tabua: 0, bisel: 0.7, contorno: 0.22, tom: 0.62, semente: 9620 }))
  L.push(P(tampo, mad, { eixo: 0, tabua: g * TABUA, bisel: 1.5, contorno: 0.1, tom: 0.97, semente: 9621 }))
  // A faixa de trás, um degrau abaixo (o lado de quem serve), e a beira grossa da frente, mais clara.
  L.push(P(caixa(-hw + 1.2, y0 + 0.6, hw - 1.2, y0 + g * FAIXA_DE_TRAS, 0.8), mad, { tabua: 0, bisel: 0.8, tom: 0.7, recesso: { k: 1.4, forca: 0.24 }, semente: 9622 }))
  L.push(P(caixa(-hw, y1 - g * FAIXA_DA_FRENTE, hw, y1, 1.2), mad, { tabua: 0, bisel: 1.3, luz: 0.08, semente: 9623, projeta: { dist: 1.2, forca: 0.26 } }))

  // As coisas do tampo, entre a faixa de trás e a da frente.
  const meioDoTampo = y0 + g * FAIXA_DE_TRAS + (fundura - g * (FAIXA_DE_TRAS + FAIXA_DA_FRENTE)) / 2
  const raioDoBarril = Math.min(g * BARRIL.raio, (fundura - g * (FAIXA_DE_TRAS + FAIXA_DA_FRENTE)) / 2 + 2)
  const xBarril0 = -hw + g * BARRIL.daPonta
  const xBarril1 = xBarril0 + g * BARRIL.comprimento
  const rCaneca = g * RAIO_DA_CANECA
  const casas = Math.max(1, Math.round(c.w / g))

  // As marcas molhadas, por baixo de tudo, e o pano de prato.
  for (let i = 0; i < casas; i += 1) {
    const x = -hw + g * (i + 0.5) + g * 0.18
    marcaDeCaneca(c, cena, x, meioDoTampo + g * 0.1, rCaneca * 1.02, 9630 + i)
  }
  const xPano = hw - g * 0.32
  const pano = retanguloGirado(xPano, meioDoTampo, (g * PANO.largura) / 2, (g * PANO.altura) / 2, PANO.giro)
  L.push(P(pano, LENCO, { bisel: 0.9, contorno: 0.22, ruga: 0.6, textura: texDoPano(xPano, meioDoTampo, PANO.giro, g * PANO.largura), semente: 9650, projeta: { dist: 0.9, forca: 0.26 } }))

  montarChopeira(c, cena, xBarril0, xBarril1, meioDoTampo - g * 0.02, raioDoBarril)
  // A caneca esperando debaixo do bico da torneira.
  montarCaneca(c, cena, xBarril1 + BICO.comprimento + rCaneca * 0.6, meioDoTampo + rCaneca * 0.9, rCaneca, Math.PI * 0.5, 'madeira', 9660)

  // As CANECAS: duas por casa depois da chopeira, uma de madeira e uma de estanho, em lugares sorteados.
  let n = 0
  for (let i = 0; i < casas; i += 1) {
    const base = -hw + g * (i + 0.5)
    for (const [dx, dy, tipo, asa] of [[-0.12, 0.12, 'estanho', 0.4], [0.2, -0.05, 'madeira', 2.6]] as const) {
      const x = base + g * dx
      if (x - rCaneca * 1.6 < xBarril1 + BICO.comprimento + rCaneca * 2.4 || x + rCaneca * 1.6 > xPano - g * PANO.largura * 0.5) continue
      montarCaneca(c, cena, x, meioDoTampo + g * dy, rCaneca, asa + i * 0.7, tipo, 9670 + n * 4)
      n += 1
    }
  }
  // As moedas de troco, perto do pano.
  MOEDAS.forEach(([dx, dy, mat], i) => {
    L.push(P(elipse(xPano + g * dx, meioDoTampo + g * dy, 1.7, 1.7), mat, { bisel: 0.7, contorno: 0.26, metal: 0.55, semente: 9700 + i, projeta: { dist: 0.5, forca: 0.3 } }))
  })

  // A BARRA DE PÉ de latão, presa na frente do corpo por braços (a barra de bar), no ar, rente ao chão.
  const yBarra = y1 - beiral + g * BARRA_A_FRENTE
  const zBarra = g * ALTURA_DA_BARRA
  const barraDePe = capsula(-hw + 3, yBarra, hw - 3, yBarra, RAIO_DA_BARRA)
  cena.sombras.push({ forma: barraDePe, z: zBarra, solta: true, suave: 1.2, forca: 0.24 })
  const bracos = Math.max(2, Math.round(c.w / (g * PASSO_DOS_BRACOS)) + 1)
  for (let i = 0; i < bracos; i += 1) {
    const x = -hw + 5 + ((c.w - 10) * i) / (bracos - 1)
    // O meio do braço fica na barra: ele sobe com ela na 3/4 e vai, na altura dela, até a frente do corpo.
    L.push(P(comMeioEm(barra(x, y1 - beiral, x, yBarra, 1.4), x, yBarra), c.m.barra, { eixo: QUARTO, bisel: 0.5, contorno: 0.26, tom: 0.82, semente: 9710 + i }))
  }
  L.push(P(barraDePe, c.m.barra, { tabua: 0, bisel: 1, contorno: 0.24, semente: 9720 }))

  // As BANQUETAS, uma por casa, na frente.
  const raio = g * RAIO_DA_BANQUETA
  const yBanqueta = y1 + g * BANQUETA_A_FRENTE
  for (let i = 0; i < casas; i += 1) {
    const x = -hw + (c.w * (i + 0.5)) / casas
    montarBanquetaAlta(c, cena, x, yBanqueta, raio, g * ALTURA_DA_BANQUETA, 0.3 + i * 1.1, 9730 + i * 10)
  }
}
