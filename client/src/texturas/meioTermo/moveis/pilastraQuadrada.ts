/**
 * PILASTRA QUADRADA (lote L05 de 24/11/2026, item 47: a versão do pilar das paredes do grande salão da cripta do mapa
 * 8; desenho próprio, só a ideia do objeto). O BLOCO de pedra ENCOSTADO NA PAREDE: o lado de cima da pegada é o da
 * parede, liso e rente a ela. O FUSTE é retangular, o dobro de largo que fundo (0,72 por 0,36 casa), colado na parede;
 * em volta dos três lados soltos, o PLINTO baixo em blocos; no alto, o CAPITEL de laje simples, que passa 3 px do
 * fuste, com o filete gravado em volta, a quina da frente à direita partida e o musgo no canto úmido junto da parede.
 * De cima, quem diz "pilastra" é o retângulo colado na parede, o plinto em U e a sombra comprida.
 *
 * Revisão do diretor de arte (24/11): o fuste quadrado lia como pilar solto encostado; a face da 3/4 era chapada; o
 * capitel passava pouco do fuste e não fazia sombra nela; a trinca em Y saiu (repetia a das outras peças do lote).
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura, pintada do norte para o sul; cada peça sobe com a
 * estrutura mais alta que contém o meio da caixa dela; no empate, a de caixa menor):
 * - o FUSTE vai em FAIXAS de pé, colunas na altura do capitel: o filete claro de 1 px na quina da esquerda, a face no
 *   tom 0,8 e, no terço da direita, cinco faixas que escurecem até 10%. O tom de cada faixa vai numa peça VAZIA (não
 *   pinta nada), que empata com o capitel e fica na faixa (a caixa menor). As faixas são LISAS: com o grão da pedra,
 *   cada uma sairia com o sorteio dela (a 3/4 dá uma semente a cada frente) e a face ficaria listrada;
 * - a SOMBRA do capitel na face é uma lasca solta rente à frente do fuste, logo abaixo do capitel: a beirada dela é a
 *   faixa escura de uns 3 px que aparece embaixo da beirada do capitel. A peça vazia dela tem o meio num toco atrás da
 *   parede, fora do capitel (dentro dele, o capitel, mais alto, ficaria com ela); a sombra no chão é a do capitel;
 * - o CAPITEL é um tampo solto com a beirada `ESPESSURA_DO_CAPITEL_DA_PILASTRA` (o perfil da 3/4 usa). As peças dele
 *   têm o meio da caixa na aba da frente, fora do fuste (`comMeioEm`): senão as faixas, menores, ficariam com elas;
 * - o PLINTO vai em três estruturas baixas (os dois braços e a fileira da frente), como o basamento do túmulo:
 *   inteiro, ele seria pintado depois do fuste e cobriria a pilastra. Cada bloco tem o meio fora do capitel.
 * Fica de fora o degradê de cima para baixo da face: a 3/4 pinta a frente de cada estrutura num tom só, e faixas
 * deitadas com tons diferentes riscariam a face.
 * Material: `pedra`; o musgo é fixo.
 */
import { hash, luz, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, elipse, menos, poligono, uniao, type Caixa, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

/** Altura do alto do capitel e a do plinto, em casas, e a grossura do capitel (px do protótipo). */
const ALTURA = 1.85
const ALTURA_DO_PLINTO = 0.1
export const ESPESSURA_DO_CAPITEL_DA_PILASTRA = 0.13 * G
/** O fuste: a largura ao longo da parede e o fundo, em casas. */
const LARGURA_DO_FUSTE = 0.72
const FUNDO_DO_FUSTE = 0.36
/** O que o plinto sobra do fuste (px) e quanto o capitel passa dele (px). */
const SOBRA_DO_PLINTO = 6.5
const ABA_DO_CAPITEL = 3
/** O filete gravado do capitel (px a partir da beira) e a quina partida (px). */
const FILETE = 3.4
const QUINA = 4.6
/**
 * A face do fuste na 3/4: o tom da frente que a 3/4 aplica (o `TOM_DA_FRENTE` de `tresQuartos.ts`; importá-lo daqui
 * fecharia um ciclo, porque a 3/4 importa a espessura do capitel deste arquivo), o tom que a face deve ter, o filete
 * claro da quina da esquerda (px e o quanto clareia), a parte da direita que escurece (fração da largura), em quantas
 * faixas, e quanto.
 */
const TOM_DA_FRENTE_NA_3_4 = 0.74
const TOM_DA_FACE = 0.8
const FILETE_DE_LUZ = 1
const LUZ_DO_FILETE = 0.2
const PARTE_DA_DIREITA = 0.38
const FAIXAS_DA_DIREITA = 5
const ESCURO_NA_DIREITA = 0.1
/** A sombra do capitel na face: a altura dela que aparece embaixo da beirada do capitel (px) e o tom. */
const SOMBRA_DO_CAPITEL = 3
const TOM_DA_SOMBRA = 0.6
/** A distância "longe" fora da faixa: nada é pintado. */
const FORA = 1000
/** O musgo: o verde-oliva da lápide, um pouco mais escuro (o do túmulo de pedra). */
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** A mesma forma com a caixa esticada até o meio dela cair em (cx, cy): muda só a estrutura da 3/4 em que ela sobe. */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const [x0, y0, x1, y1] = f.b
  const rx = Math.max(cx - x0, x1 - cx)
  const ry = Math.max(cy - y0, y1 - cy)
  return { b: [cx - rx, cy - ry, cx + rx, cy + ry], d: f.d }
}

/** A forma `f` só entre x0 (incluso) e x1, sem chanfro nem contorno no corte (fora, "longe"). */
function naFaixa(f: Forma, x0: number, x1: number): Forma {
  return { b: [Math.max(f.b[0], x0), f.b[1], Math.min(f.b[2], x1), f.b[3]], d: (x, y) => (x >= x0 && x < x1 ? f.d(x, y) : FORA) }
}

export const montarPilastraQuadrada: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const alto = g * ALTURA
  const zPlinto = g * ALTURA_DO_PLINTO

  // A parede é o lado de cima: o fuste e o capitel encostam nela.
  const yParede = -hh + 0.5
  const largura = Math.min(g * LARGURA_DO_FUSTE, 2 * (hw - 0.5 - SOBRA_DO_PLINTO))
  const fundo = Math.min(g * FUNDO_DO_FUSTE, 2 * hh - 1 - SOBRA_DO_PLINTO)
  const [fx0, fx1] = [-largura / 2, largura / 2]
  const fy1 = yParede + fundo
  const [px0, px1, py1] = [fx0 - SOBRA_DO_PLINTO, fx1 + SOBRA_DO_PLINTO, fy1 + SOBRA_DO_PLINTO]
  const [cx0, cx1, cy1] = [fx0 - ABA_DO_CAPITEL, fx1 + ABA_DO_CAPITEL, fy1 + ABA_DO_CAPITEL]
  // As peças do capitel com o meio na aba da frente. A laje ganha uma folga na caixa para ser a maior peça do capitel
  // (é dela que a 3/4 tira o material da beirada; sem a folga, a caixa esticada do musgo ganhava e a beirada saía verde).
  const naAba = (f: Forma, folga = 0): Forma => {
    const m = comMeioEm(f, 0, fy1 + ABA_DO_CAPITEL / 2)
    return { b: [m.b[0] - folga, m.b[1] - folga, m.b[2] + folga, m.b[3] + folga], d: m.d }
  }

  // As sombras: o contato do plinto e o plinto em três trechos.
  cena.sombras.push(contato(caixa(px0, yParede, px1, py1, 0.8), 0.32))
  const trechos: readonly Caixa[] = [
    [px0, yParede, fx0, fy1],
    [fx1, yParede, px1, fy1],
    [px0, fy1, px1, py1],
  ]
  for (const [x0, y0, x1, y1] of trechos) cena.sombras.push({ forma: caixa(x0, y0, x1, y1), z: zPlinto })

  // O FUSTE em faixas de pé, na altura do capitel, cada uma com a peça vazia que dá o tom da frente dela.
  const fuste = caixa(fx0, yParede, fx1, fy1, 0.6)
  const tomDaFace = TOM_DA_FACE / TOM_DA_FRENTE_NA_3_4 - 1
  const xDaDireita = fx1 - largura * PARTE_DA_DIREITA
  const faixas: { readonly x0: number; readonly x1: number; readonly luz: number }[] = [
    { x0: -Infinity, x1: fx0 + FILETE_DE_LUZ, luz: tomDaFace + LUZ_DO_FILETE },
    { x0: fx0 + FILETE_DE_LUZ, x1: xDaDireita, luz: tomDaFace },
  ]
  for (let k = 0; k < FAIXAS_DA_DIREITA; k += 1) {
    const x0 = xDaDireita + ((fx1 - xDaDireita) * k) / FAIXAS_DA_DIREITA
    const x1 = k === FAIXAS_DA_DIREITA - 1 ? Infinity : xDaDireita + ((fx1 - xDaDireita) * (k + 1)) / FAIXAS_DA_DIREITA
    faixas.push({ x0, x1, luz: (1 + tomDaFace) * (1 - (ESCURO_NA_DIREITA * (k + 1)) / FAIXAS_DA_DIREITA) - 1 })
  }
  faixas.forEach(({ x0, x1, luz: f }, k) => {
    const faixa = naFaixa(fuste, x0, x1)
    cena.sombras.push({ forma: faixa, z: alto })
    L.push(P({ b: faixa.b, d: () => FORA }, { classe: 'liso', rgb: luz(pedra.rgb, f) }, { tabua: 0, semente: 4720 + k }))
  })

  // A SOMBRA do capitel na face: a lasca solta rente à frente do fuste (sem a quina partida), mais o toco atrás da
  // parede onde fica o meio da peça vazia dela. Força zero: no chão, quem faz a sombra é o capitel.
  // A altura dela põe o pé da beirada `SOMBRA_DO_CAPITEL` px abaixo do pé da beirada do capitel, na tela: a frente da
  // lasca fica 0,4 px à frente do fuste e a do capitel, `ABA_DO_CAPITEL` px; o resto da beirada some atrás do capitel.
  const zDaSombra = alto - ABA_DO_CAPITEL - SOMBRA_DO_CAPITEL + 0.4
  // A lasca tem 3,4 px de fundo (entra no fuste): fina, a varredura da beirada pulava linhas e a faixa saía riscada.
  const lasca = uniao(caixa(fx0, fy1 - 3, Math.min(fx1, cx1 - QUINA), fy1 + 0.4), caixa(-1, yParede - 3.2, 1, yParede - 0.2))
  cena.sombras.push({ forma: lasca, z: zDaSombra, solta: true, forca: 0 })
  L.push(P({ b: [-1, yParede - 3.2, 1, yParede - 0.2], d: () => FORA }, { classe: 'liso', rgb: luz(pedra.rgb, TOM_DA_SOMBRA / TOM_DA_FRENTE_NA_3_4 - 1) }, { tabua: 0, semente: 4729 }))

  // O CAPITEL solto no alto.
  const capitel = poligono([[cx0, yParede], [cx1, yParede], [cx1, cy1 - QUINA], [cx1 - QUINA * 0.36, cy1 - QUINA * 0.58], [cx1 - QUINA * 0.7, cy1 - QUINA * 0.44], [cx1 - QUINA, cy1], [cx0, cy1]])
  cena.sombras.push({ forma: capitel, z: alto, solta: true, forca: 0.26 })

  // O MUSGO no chão, no pé do plinto (fica embaixo de tudo).
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9 }
  L.push(P(elipse(px0 + 1.4, py1 + 1, 3.2, 1.8), MUSGO, { ...musgo, semente: 4790 }))

  // O PLINTO em blocos: um em cada braço e três na frente, de tons um pouco diferentes; o meio de cada um fica fora
  // do capitel (sobe com o plinto na 3/4).
  const blocos: readonly Caixa[] = [
    [px0, yParede, fx0, fy1],
    [fx1, yParede, px1, fy1],
    [px0, fy1, px0 + (px1 - px0) * 0.3, py1],
    [px0 + (px1 - px0) * 0.3, fy1, px0 + (px1 - px0) * 0.68, py1],
    [px0 + (px1 - px0) * 0.68, fy1, px1, py1],
  ]
  blocos.forEach(([x0, y0, x1, y1], k) => {
    L.push(P(caixa(x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35, 0.7), pedra, { tabua: 0, bisel: 1.3, tom: 0.8 + 0.1 * hash(k, 1, 4700), contorno: 0.26, semente: 4701 + k }))
  })

  // O CAPITEL: a laje, o filete gravado e o musgo da parede, todos com o meio na aba da frente.
  L.push(P(naAba(capitel, 8), pedra, { tabua: 0, bisel: 2.2, tom: 1.02, contorno: 0.3, semente: 4711 }))
  const fora = caixa(cx0 + FILETE, yParede + FILETE * 0.6, cx1 - FILETE, cy1 - FILETE, 0.5)
  const dentro = caixa(cx0 + FILETE + 1.2, yParede + FILETE * 0.6 + 1.2, cx1 - FILETE - 1.2, cy1 - FILETE - 1.2, 0.3)
  L.push(P(naAba(menos(fora, dentro)), pedra, { tabua: 0, bisel: 0, tom: 0.66, contorno: 0, recesso: { k: 0.6, forca: 0.3 }, semente: 4712 }))
  L.push(P(naAba(elipse(cx1 - 3.4, yParede + 3, 4.2, 2.6)), MUSGO, { ...musgo, alfa: 0.5, semente: 4714 }))
  L.push(P(naAba(elipse(cx0 + 2.4, yParede + 1.8, 2.4, 1.5)), MUSGO, { ...musgo, alfa: 0.4, semente: 4715 }))
}
