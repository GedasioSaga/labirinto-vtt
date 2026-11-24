/**
 * BALDE DE DEJETOS de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"; a versão de cela
 * do balde, que faz o papel do penico). As aduelas de MADEIRA ESCURA em volta, o ARO de ferro na boca (com a ferrugem
 * em manchas), a borda das aduelas e, por dentro, o CONTEÚDO escuro e fosco. Por cima, a TAMPA TORTA: um disco de três
 * tábuas da mesma madeira, um tom mais claro, com a travessa que serve de pega, caído para um lado e inclinado (por
 * isso achatado), deixando à mostra a MEIA-LUA escura do conteúdo, cerca de um terço da boca. A 25% de zoom sobram o
 * anel escuro, a tampa de madeira e a meia-lua: é a meia-lua que diz "dejeto", e não "barril". Desenho original.
 *
 * Baixo e de boca maior que o pé, com dois AROS de ferro no corpo, um perto da boca e um perto do pé. A 3/4 (DERIVADA,
 * com a beirada de `ESPESSURA_DO_ARO_DO_BALDE`) é feita das sombras: o corpo é uma coluna do tamanho do PÉ (a boca,
 * de cima, fica mais larga que ele) e cada aro é uma estrutura solta em meia-lua na frente do corpo, na altura dele,
 * cuja beirada é a faixa de ferro. A frente de cada estrutura toma o material da maior peça dela: por isso cada aro
 * tem um rebite só dele, escondido debaixo das aduelas na vista de cima, que a 3/4 sobe até a faixa. Sem a sombra
 * visível (força 0): de cima só a coluna e a boca fazem sombra. Sem material escolhido: a madeira, o ferro e o
 * conteúdo são fixos.
 */
import { limitar01, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, caixa, capsula, dentroDe, elipse, elipseGirada, type Forma } from './formas'
import { contato, ruido, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'
import { FERRO_DA_PRISAO, rebite, texFerroGasto } from './cadeiraDeFerro'

/** Altura do balde em casas: baixo (com 0,42 a 3/4 virava um cilindro alto, de pilar ou lixeira). */
const ALTURA = 0.28
/** A grossura de cada aro na 3/4: a beirada das estruturas soltas (o perfil da 3/4 do balde usa). */
export const ESPESSURA_DO_ARO_DO_BALDE = 0.025 * G
/**
 * A madeira escura: a nogueira mais funda puxada para o cinza (com 38% de cinza a 3/4 saía vermelho-mogno, saturação
 * p95 de 0,57; com 60% a cor de base fica em 0,30). A tampa é a mesma madeira, um tom mais clara.
 */
const MADEIRA_ESCURA: MaterialDaPeca = { classe: 'madeira', rgb: misturar(rgb(tomDoMeio('nogueira', 0.86)), [0x56, 0x51, 0x4b], 0.6) }
const TOM_DA_TAMPA = 1.22
/**
 * O escuro em que o pixel escuro demais é levantado: um castanho acinzentado. Sem ele o motor levanta para o castanho
 * quente da nogueira e as aduelas na sombra saíam vermelhas (a saturação p95 ficava em 0,57 com a madeira já cinza).
 */
const ESCURO_DA_MADEIRA: Rgb = [0x4c, 0x46, 0x3f]
/** O conteúdo: um castanho-oliva escuro e fosco, sem cor viva. */
const CONTEUDO: MaterialDaPeca = { classe: 'liso', rgb: [0x48, 0x41, 0x32] }
/** A tampa: o deslocamento do meio (fração do raio), o giro, o achatado da inclinação e o raio (fração do raio). */
const TAMPA = { dx: -0.3, dy: -0.3, giro: -0.42, achata: 0.8, raio: 0.6 } as const
/** O pé, mais estreito que a boca (fração do raio): a coluna da 3/4. */
const PE = 0.86
/**
 * Os aros (px de partida, 0,5 casa): a largura da meia-lua de cada um, quanto o de baixo sai do pé, quanto o de cima
 * fica abaixo da boca e o de baixo acima do chão (a altura da estrutura de cada um).
 */
const LARGURA_DO_ARO = 0.9
const ARO_DE_BAIXO_SAI = 0.5
const ARO_DE_CIMA_ABAIXO_DA_BOCA = 1.9
const ARO_DE_BAIXO_NO_AR = 3.1

/** O conteúdo: a borda das aduelas faz sombra nele do lado da luz, e um ruído largo e fraco tira o liso. */
function texDoConteudo(raio: number, k: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const d = Math.hypot(x + 1.4 * k, y + 1.2 * k) - raio
    s[3] += -0.3 * limitar01(0.5 + d / (1.4 * k)) + ruido(x * 0.35 + p.su, y * 0.35 + p.sv) * 0.07
  }
}

/** A meia-lua da frente de um aro (a metade de baixo do anel), de raio de fora `r`. */
function meiaLuaDoAro(r: number, largura: number): Forma {
  return dentroDe(anel(0, 0, r, r, r - largura, r - largura), caixa(-r - 1, 0, r + 1, r + 1))
}

/**
 * O rebite que dá ao aro o material de ferro na 3/4: na meia-lua, na frente, fora da coluna do pé (é o que o põe na
 * estrutura do aro, e não na do corpo); de cima fica debaixo das aduelas e do aro da boca.
 */
function rebiteDoAro(P: CriarPeca, r: number, largura: number, k: number, semente: number): Peca {
  return rebite(P, 0, r - largura * 0.4, 0.35 * k, semente, 1.06)
}

export const montarBaldeDeDejetos: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / 14
  const polar = { cx: 0, cy: 0, r: R }
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_MADEIRA
  const z = g * ALTURA
  const rPe = PE * R
  const largura = LARGURA_DO_ARO * k
  const rAroDeBaixo = rPe + ARO_DE_BAIXO_SAI * k

  // As sombras: o corpo é uma coluna do tamanho do pé; a boca, mais larga, faz a sombra dela no chão; o contato no
  // pé. Os aros são estruturas soltas sem sombra (força 0): só dizem à 3/4 onde está cada faixa de ferro.
  cena.sombras.push(
    { forma: elipse(0, 0, rPe, rPe), z },
    { forma: elipse(R * 0.2, R * 0.18, R, R), z: 0, suave: 2 * k, forca: 0.2 },
    contato(elipse(0, 0, rPe, rPe), 0.32),
    { forma: meiaLuaDoAro(R, largura), z: z - ARO_DE_CIMA_ABAIXO_DA_BOCA * k, solta: true, forca: 0 },
    { forma: meiaLuaDoAro(rAroDeBaixo, largura), z: ARO_DE_BAIXO_NO_AR * k, solta: true, forca: 0 },
  )

  // Os rebites dos dois aros, primeiro: de cima as aduelas os cobrem; na 3/4 cada um sobe com a faixa do seu aro.
  L.push(rebiteDoAro(P, R, largura, k, 24910), rebiteDoAro(P, rAroDeBaixo, largura, k, 24911))

  // As aduelas, o aro de ferro da boca e a borda das aduelas (a madeira cortada, mais clara).
  L.push(P(elipse(0, 0, hw, hh), MADEIRA_ESCURA, { polar, tabua: 3.2 * k, bisel: R * 0.18, contorno: 0.26, semente: 24901 }))
  const aro = anel(0, 0, hw * 0.99, hh * 0.99, hw * 0.9, hh * 0.9)
  L.push(P(aro, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.8 * k, tom: 0.96, metal: 0.36, contorno: 0.3, textura: texFerroGasto(aro, 0, 0.42), semente: 24902 }))
  L.push(P(anel(0, 0, hw * 0.9, hh * 0.9, hw * 0.75, hh * 0.75), MADEIRA_ESCURA, { polar, tabua: 3.2 * k, bisel: 0.8 * k, tom: 1.1, luz: 0.05, contorno: 0.2, semente: 24903 }))

  // O conteúdo escuro.
  L.push(P(elipse(0, 0, hw * 0.76, hh * 0.76), CONTEUDO, { tabua: 0, bisel: 0, contorno: 0.12, textura: texDoConteudo(R * 0.73, k), semente: 24904 }))

  // A TAMPA TORTA: o disco de tábuas inclinado (achatado), a beira dele na sombra e a travessa da pega.
  const [tx, ty] = [TAMPA.dx * R, TAMPA.dy * R]
  const rTampa = TAMPA.raio * R
  const tampa = elipseGirada(tx, ty, rTampa, rTampa * TAMPA.achata, TAMPA.giro)
  L.push(P(tampa, MADEIRA_ESCURA, { dx: 0.5 * k, dy: 1 * k, tabua: 0, bisel: 0.6 * k, tom: 0.62, contorno: 0.26, semente: 24905 }))
  L.push(P(tampa, MADEIRA_ESCURA, { eixo: TAMPA.giro + QUARTO, tabua: (rTampa * 2) / 3, bisel: 1.1 * k, tom: TOM_DA_TAMPA, contorno: 0.24, semente: 24906, projeta: { dist: 1.8 * k, forca: 0.38, suave: 1.3 * k } }))
  const [ex, ey] = [Math.cos(TAMPA.giro) * rTampa * 0.62, Math.sin(TAMPA.giro) * rTampa * 0.62 * TAMPA.achata]
  const travessa = capsula(tx - ex, ty - ey, tx + ex, ty + ey, 1.15 * k)
  L.push(P(travessa, MADEIRA_ESCURA, { eixo: TAMPA.giro, tabua: 0, bisel: 0.9 * k, tom: TOM_DA_TAMPA * 0.9, contorno: 0.26, semente: 24907, projeta: { dist: 0.9 * k, forca: 0.32, suave: 0.8 * k } }))
  // Os dois pregos da travessa.
  for (const f of [-0.62, 0.62]) {
    L.push(P(elipse(tx + ex * f, ty + ey * f, 0.55 * k, 0.55 * k), FERRO_DA_PRISAO, { tabua: 0, bisel: 0.45 * k, tom: 1.05, contorno: 0.2, semente: 24908 + Math.sign(f) }))
  }
}
