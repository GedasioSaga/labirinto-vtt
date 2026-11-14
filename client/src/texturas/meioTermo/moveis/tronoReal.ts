/**
 * TRONO de cima com volume (objetos de 14/11/2026, grupo Castelo: "cadeira
 * alta de espaldar, almofada vermelha"). O espaldar fica no fundo (a beira de
 * cima da pegada) e o assento na frente. De cima aparecem a CRISTA do espaldar
 * (a régua de cima com o frontão pontudo no meio e o medalhão de metal com a
 * pedra), os dois POSTES do fundo com a pinha de metal, o ESPALDAR estofado
 * (inclinado, mostra o capitonê), os dois BRAÇOS largos com a almofadinha e a
 * voluta de metal na ponta e o ASSENTO de almofada capitonê, com as duas borlas
 * de metal caindo pela frente.
 *
 * O que separa o trono da poltrona a 1x: o vermelho emoldurado de madeira, os
 * quatro pontos de metal (as pinhas e as voltas dos braços) e a sombra comprida
 * do espaldar alto.
 *
 * NA 3/4 (`tresQuartos.ts`, derivado com espessura 0) o espaldar e os postes
 * são colunas e sobem acima de tudo. A FACE do espaldar (a moldura de madeira
 * com o estofado capitonê e as tachas) é desenhada de frente e fica GUARDADA
 * debaixo do assento e do espaldar na vista de cima, onde nada dela aparece,
 * como as faces da cama de casal: a caixa de pintura de cada peça é espelhada
 * em volta de uma FRESTA (um tampo no ar de um quarto de px, sem sombra, no
 * meio do assento) que sobe o quanto a face precisa para cair entre o alto do
 * espaldar e o assento. Girado (`c.giro`), o trono não guarda a face: de lado
 * ou de costas a 3/4 varre a madeira do espaldar (a tábua de trás é a maior
 * peça dele), que é o que se veria. A espessura 0 é pela fresta: com a beirada
 * padrão ela apareceria como uma tira no meio da face.
 *
 * As alturas são por casa; o trono menor que o de partida encolhe tudo junto.
 *
 * Materiais: `madeira`, `almofada` (o estofado, um tecido) e `metal` (as
 * pinhas, as voltas, o medalhão e as borlas). A pedra do medalhão é fixa.
 */
import { caixa, elipse, poligono, uniao, type Forma } from './formas'
import { contato, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Alturas, em casas: o assento, os braços, o espaldar e os postes do fundo (com a pinha). */
const ALTURA_DO_ASSENTO = 0.46
const ALTURA_DOS_BRACOS = 0.74
const ALTURA_DO_ESPALDAR = 1.55
const ALTURA_DOS_POSTES = 1.72
/** O lado do trono de partida, em casas: abaixo dele as alturas encolhem junto (senão a face não cabe guardada). */
const LADO_DE_PARTIDA = 1.2
/** A fresta da face guardada (px do protótipo) e a moldura de madeira em volta do estofado da face (fração da largura). */
const FRESTA = 0.25
const MOLDURA_DA_FACE = 0.07

/** As medidas de cima: o lado do poste e a largura do braço (fração da largura); o fundo do espaldar e o da crista (fração da altura). */
const POSTE = 0.17
const BRACO = 0.16
const FUNDO_DO_ESPALDAR = 0.36
const FUNDO_DA_CRISTA = 0.13
/** A régua da frente do assento que a almofada deixa à mostra (fração da altura). */
const FRENTE_DO_ASSENTO = 0.07
/** O frontão da crista: a meia largura (fração da largura) e quanto a ponta passa da régua (fração da altura). */
const MEIO_FRONTAO = 0.24
const PONTA_DO_FRONTAO = 0.085
/** As pinhas dos postes e o medalhão, em fração do lado do poste; a volta de metal na ponta do braço, da largura dele. */
const RAIO_DA_PINHA = 0.4
const RAIO_DA_VOLTA = 0.38
const RAIO_DO_MEDALHAO = 0.5

/**
 * O capitonê: o passo dos losangos (px do protótipo; 6 pixels a 1x), a luz do
 * gomo estufado, a costura e o botão afundado em cada cruzamento.
 */
const PASSO_DO_CAPITONE = 7
const LUZ_DO_GOMO = 0.34
const LARGURA_DA_COSTURA = 0.09
const FUNDO_DA_COSTURA = 0.12
const RAIO_DO_BOTAO = 1.1
const FUNDO_DO_BOTAO = 0.26
/** De onde vem a luz do motor, no chão (cima à esquerda): o lado do gomo virado para ela clareia. */
const LUZ_X = -0.62
const LUZ_Y = -0.48

/** A pedra do medalhão: rubi escuro, com o brilho do metal. */
const RUBI: MaterialDaPeca = { classe: 'metal', rgb: [0x8e, 0x2a, 0x2e] }

/**
 * O estofado capitonê: o pano do material com losangos costurados em
 * diagonal, cada um um gomo (claro do lado da luz), e o botão afundado em cada
 * cruzamento das costuras. Só luz: a cor é a do material.
 */
function texCapitone(): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    const a = (x + y) / PASSO_DO_CAPITONE
    const b = (x - y) / PASSO_DO_CAPITONE
    const fa = a - Math.floor(a) - 0.5
    const fb = b - Math.floor(b) - 0.5
    // O gomo: a inclinação a partir do meio do losango, vista pela luz.
    const dx = (fa + fb) / 2
    const dy = (fa - fb) / 2
    s[3] += LUZ_DO_GOMO * (LUZ_X * dx + LUZ_Y * dy)
    const borda = 0.5 - Math.max(Math.abs(fa), Math.abs(fb))
    if (borda < LARGURA_DA_COSTURA) s[3] -= FUNDO_DA_COSTURA * (1 - borda / LARGURA_DA_COSTURA)
    const canto = Math.hypot(0.5 - Math.abs(fa), 0.5 - Math.abs(fb)) * PASSO_DO_CAPITONE
    if (canto < RAIO_DO_BOTAO) s[3] -= FUNDO_DO_BOTAO * (1 - canto / RAIO_DO_BOTAO)
  }
}

/**
 * A peça desenhada DE FRENTE (no lugar em que a 3/4 a mostra) guardada na vista
 * de cima `desce` px mais abaixo, com a caixa de pintura espelhada em volta de
 * `meio` (o meio da fresta): o desenho não muda, e o meio da caixa, que é o que
 * a 3/4 lê para saber com que estrutura a peça sobe, cai na fresta.
 */
function guardada(forma: Forma, desce: number, meio: number): Forma {
  const alcance = Math.max(Math.abs(forma.b[1] + desce - meio), Math.abs(forma.b[3] + desce - meio))
  return { b: [forma.b[0], meio - alcance, forma.b[2], meio + alcance], d: (x, y) => forma.d(x, y - desce) }
}

/**
 * A FACE do espaldar, guardada: entre `yTopo` (o alto do espaldar na 3/4) e
 * `yBase` (onde o assento a cobre), a moldura de madeira, o estofado capitonê e
 * uma tacha de metal em cada canto dele; e a fresta, no meio do assento, que
 * sobe `subida` px e leva a face junto.
 */
function guardarFace(c: ContextoDoMovel, cena: Cena, yTopo: number, yBase: number, subida: number, yFresta: number, capitone: Textura): void {
  const { w, hw, peca: P } = c
  const p = POSTE * w
  const meio = yFresta + FRESTA / 2
  const naFace = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    cena.partes.push(P(guardada(forma, subida, meio), mat, o))
  }
  const m = MOLDURA_DA_FACE * w
  naFace(caixa(-hw + p, yTopo, hw - p, yBase + 2, 0.8), c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 0.84, contorno: 0.24, semente: 50 })
  naFace(caixa(-hw + p + m, yTopo + m, hw - p - m, yBase, 2.4), c.m.almofada, { bisel: 2.2, tom: 0.9, contorno: 0.24, textura: capitone, semente: 51 })
  for (const [i, [x, y]] of ([[-hw + p + m, yTopo + m], [hw - p - m, yTopo + m]] as const).entries()) {
    naFace(elipse(x, y, 1.3, 1.3), c.m.metal, { bisel: 0.9, contorno: 0.26, metal: 0.6, semente: 52 + i })
  }
  cena.sombras.push({ forma: caixa(-hw + p + 0.5, yFresta, hw - p - 0.5, yFresta + FRESTA), z: subida, solta: true, forca: 0 })
}

export const montarTronoReal: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const pano = c.m.almofada
  const metal = c.m.metal
  const L = cena.partes
  const p = POSTE * w
  const br = BRACO * w
  const yEsp = -hh + FUNDO_DO_ESPALDAR * h
  const yCrista = -hh + FUNDO_DA_CRISTA * h
  const capitone = texCapitone()
  const casa = g * Math.min(1, Math.min(w, h) / (g * LADO_DE_PARTIDA))
  const zAssento = casa * ALTURA_DO_ASSENTO
  const zEspaldar = casa * ALTURA_DO_ESPALDAR

  // A face do espaldar, só de frente, guardada antes de tudo: o assento e o espaldar a cobrem na vista de cima.
  // A subida é a do meio da faixa em que ela cabe inteira dentro da pegada.
  if (c.giro === 0) {
    const [yTopo, yBase] = [yEsp - zEspaldar, yEsp - zAssento]
    const subida = (-hh - yTopo + (hh - yBase)) / 2
    guardarFace(c, cena, yTopo, yBase, subida, (yEsp + hh) / 2, capitone)
  }

  // As alturas: o espaldar entre os postes, os postes, os braços e o assento entre eles.
  cena.sombras.push(
    contato(caixa(-hw, -hh, hw, hh, 1.5), 0.32),
    { forma: caixa(-hw + p, -hh, hw - p, yEsp), z: zEspaldar },
    { forma: caixa(-hw + br, yEsp, hw - br, hh), z: zAssento },
  )
  for (const x0 of [-hw, hw - p]) cena.sombras.push({ forma: caixa(x0, -hh, x0 + p, -hh + p), z: casa * ALTURA_DOS_POSTES })
  for (const x0 of [-hw, hw - br]) cena.sombras.push({ forma: caixa(x0, -hh + p, x0 + br, hh), z: casa * ALTURA_DOS_BRACOS })

  // A tábua de trás do espaldar, inteira debaixo do estofado e da crista: é a maior peça dele, e a 3/4 do trono
  // girado varre a madeira dela (de lado ou de costas não se vê estofado).
  L.push(P(caixa(-hw + p, -hh, hw - p, yEsp), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.9, semente: 9 }))

  // O ASSENTO: a caixa de madeira, a almofada capitonê por cima (a régua da frente fica à mostra) e as duas borlas.
  L.push(P(caixa(-hw + br - 1, yEsp - 3, hw - br + 1, hh, 1.2), mad, { tabua: 0, bisel: 1.2, tom: 0.9, semente: 10 }))
  const yAlmofada = hh - FRENTE_DO_ASSENTO * h
  L.push(P(caixa(-hw + br + 0.8, yEsp - 1, hw - br - 0.8, yAlmofada, 3), pano, { bisel: 2.6, contorno: 0.24, textura: capitone, semente: 11, projeta: { dist: 1.2, forca: 0.3, suave: 0.6 } }))
  for (const [i, x] of [-hw + br + 3.4, hw - br - 3.4].entries()) {
    const borla = uniao(elipse(x, yAlmofada - 0.6, 1.3, 1.1), poligono([[x - 1.2, yAlmofada], [x + 1.2, yAlmofada], [x + 1.7, yAlmofada + 3.3], [x - 1.7, yAlmofada + 3.3]]))
    L.push(P(borla, metal, { bisel: 0.8, contorno: 0.24, semente: 12 + i, projeta: { dist: 0.8, forca: 0.3 } }))
  }

  // O ESPALDAR estofado, inclinado: o capitonê aparece entre a crista e o assento.
  L.push(P(caixa(-hw + p * 0.8, yCrista - 1, hw - p * 0.8, yEsp + 1.5, 2.4), pano, { bisel: 2.2, tom: 0.92, contorno: 0.24, textura: capitone, semente: 14 }))

  // Os BRAÇOS: a madeira larga, a almofadinha no meio e a volta de metal na ponta da frente.
  for (const [i, x0] of [-hw, hw - br].entries()) {
    const xm = x0 + br / 2
    const yVolta = hh - br * 0.56
    const braco = uniao(caixa(x0, -hh + p * 0.7, x0 + br, yVolta, br * 0.3), elipse(xm, yVolta, br * 0.6, br * 0.56))
    L.push(P(braco, mad, { eixo: QUARTO, tabua: 0, bisel: 1.6, semente: 20 + i * 4, projeta: { dist: 1.6, forca: 0.32, suave: 0.8 } }))
    L.push(P(caixa(x0 + br * 0.2, yEsp, x0 + br * 0.8, yVolta - br * 0.62, br * 0.28), pano, { eixo: QUARTO, bisel: 1.6, tom: 0.95, contorno: 0.24, semente: 21 + i * 4 }))
    L.push(P(elipse(xm, yVolta, br * RAIO_DA_VOLTA, br * RAIO_DA_VOLTA * 0.92), metal, { bisel: 1.4, contorno: 0.26, metal: 0.55, semente: 22 + i * 4 }))
  }

  // Os POSTES do fundo, com a pinha de metal.
  for (const [i, x0] of [-hw, hw - p].entries()) {
    L.push(P(caixa(x0, -hh, x0 + p, -hh + p, 1.2), mad, { eixo: QUARTO, tabua: 0, bisel: 1.6, tom: 1.04, semente: 30 + i * 2, projeta: { dist: 1.4, forca: 0.3 } }))
    L.push(P(elipse(x0 + p / 2, -hh + p / 2, p * RAIO_DA_PINHA, p * RAIO_DA_PINHA), metal, { bisel: p * 0.3, contorno: 0.28, metal: 0.6, semente: 31 + i * 2 }))
  }

  // A CRISTA: a régua de cima com o frontão pontudo, que faz sombra no estofado, e o medalhão com a pedra.
  const a = MEIO_FRONTAO * w
  const ponta = PONTA_DO_FRONTAO * h
  const frontao = poligono([[-a, yCrista - 1], [-a * 0.42, yCrista + ponta * 0.62], [0, yCrista + ponta], [a * 0.42, yCrista + ponta * 0.62], [a, yCrista - 1]])
  const crista = uniao(caixa(-hw + p - 1, -hh + 0.6, hw - p + 1, yCrista, 1), frontao)
  L.push(P(crista, mad, { tabua: 0, bisel: 1.5, tom: 1.06, semente: 40, projeta: { dist: 2.4, forca: 0.34, suave: 1.2 } }))
  const ym = (-hh + 0.6 + yCrista) / 2 + ponta * 0.35
  const rm = RAIO_DO_MEDALHAO * p
  L.push(P(elipse(0, ym, rm * 1.15, rm), metal, { bisel: rm * 0.5, contorno: 0.28, metal: 0.55, semente: 41 }))
  L.push(P(elipse(0, ym, rm * 0.46, rm * 0.42), RUBI, { bisel: rm * 0.3, contorno: 0.2, metal: 0.7, semente: 42 }))
}
