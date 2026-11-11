/**
 * ESTÁTUA de praça de cima com volume (11/11/2026, lote 2 dos objetos novos):
 * o PEDESTAL quadrado de pedra (o soco, o dado e a cornija com a moldura
 * rebaixada em volta) e, em cima, a FIGURA de pedra de um herói qualquer,
 * virada para o lado de baixo: o elmo com a crista, os ombros, a capa aberta
 * atrás, os braços descendo para a frente e as duas mãos no punho da espada,
 * de ponta no pedestal. Ninguém de verdade, nenhum brasão. O tempo deixou a
 * pedra manchada, com líquen na cornija e musgo nos cantos e ao pé.
 *
 * De cima aparecem a moldura do pedestal e a figura vista do alto (a roda do
 * elmo, as ombreiras, o leque da capa, o V dos braços e a cruz da espada),
 * com a sombra comprida dela pintada no tampo. Na 3/4 a figura fica de pé, e
 * o desenho é montado para o que `tresQuartos.ts` faz com as sombras (cada
 * sombra com altura é uma estrutura; as estruturas são pintadas do norte para
 * o sul; cada peça sobe com a estrutura mais alta que contém o meio da caixa
 * dela):
 * - o que vai do pé ao alto é COLUNA, cada uma com a sua altura: a capa
 *   (atrás, em duas: a barra aberta embaixo e o alto, mais estreito que os
 *   ombros), a cabeça, as duas pernas e a lâmina da espada, na frente.
 *   A frente de cada uma leva o tom do material da peça de cima dela: a capa
 *   mais escura (a figura clara se recorta nela), a lâmina mais clara, e a da
 *   cabeça é o rosto na sombra do elmo (uma roda escura escondida debaixo dele);
 * - o TRONCO são quatro tampos soltos empilhados, cada um mais largo que o de
 *   baixo (os quadris, a cintura, o peito com os braços e os ombros): uma
 *   coluna só daria um corpo de garrafa, da largura dos ombros até o pé. A
 *   beirada de cada tampo é uma faixa do tronco, e a espessura deles é a da
 *   CORNIJA do pedestal (`ESPESSURA_DA_CORNIJA`, que o perfil da 3/4 usa). Os
 *   ANTEBRAÇOS, do cotovelo às mãos, são outro tampo, na frente do peito;
 * - o dado e a cornija vão em duas METADES, a do norte e a do sul NA TELA:
 *   inteiros, seriam pintados depois da figura (a base deles é mais ao sul) e
 *   a cobririam. A metade do norte fica atrás dela; a do sul, na frente, tem
 *   um FURO com o pé de cada coluna, aberto até a linha do corte, para a
 *   figura aparecer pousada no tampo;
 * - o SOCO, o degrau em volta do dado, vai em quatro: a tira do norte, os
 *   dois braços dos lados até onde a cornija os esconde e a ferradura do sul
 *   (o resto dos braços e a tira da frente), a última a ser pintada. Inteiro,
 *   o braço do lado seria pintado por cima da beirada da cornija;
 * - as peças do pedestal vão em quartos e em tiras (a mesma pedra, sem
 *   emenda), para o meio da caixa de cada uma cair na estrutura certa e fora
 *   do que está em cima dela.
 * O corte, o furo, as tiras e a sombra pintada acompanham o quarto de volta
 * que a 3/4 pinta (`c.giro`): são dados no referencial da tela.
 *
 * As medidas da figura saem do menor lado da pegada (ela não estica); o
 * pedestal acompanha a pegada. Material: `pedra`; o musgo e o líquen são fixos.
 */
import { hash, luz, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, capsula, dentroDe, elipse, menos, uniao, type Forma } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Altura do soco e do alto do pedestal (a cornija), em casas. */
const ALTURA_DO_SOCO = 0.11
const ALTURA_DO_PEDESTAL = 0.56
/** A espessura da cornija, em casas e em px do protótipo: a beirada dela e a de cada faixa do tronco na 3/4. O perfil da estátua em `tresQuartos.ts` usa o valor em px. */
const CORNIJA_EM_CASAS = 0.1
export const ESPESSURA_DA_CORNIJA = CORNIJA_EM_CASAS * G
/**
 * As alturas da figura acima do pedestal, em casas. As pernas vão até os quadris; daí para cima o tronco são
 * as faixas de `TRONCO`, da espessura da cornija, uma em cima da outra (com quatro, os ombros ficam a 0,82).
 */
const ALTURA_DA_BARRA = 0.3
const ALTURA_DAS_PERNAS = 0.42
const ALTURA_DA_GUARDA = 0.5
const ALTURA_DAS_MAOS = 0.62
const ALTURA_DA_CAPA = 0.72
const ALTURA_DA_CABECA = 1.02
/** O meio lado do soco, do dado e da cornija, em fração da meia pegada. */
const SOCO = 0.96
const DADO = 0.74
const CORNIJA = 0.86
/** A moldura rebaixada do tampo: o recuo da beira e a largura do sulco, em fração do menor meio lado. */
const RECUO_DA_MOLDURA = 0.1
const SULCO_DA_MOLDURA = 0.05
/**
 * A planta da figura, em frações do menor meio lado, a partir do meio do pedestal: os meios e os raios da
 * barra da capa (a parte de baixo dela, mais aberta), da capa, da cabeça e de cada perna; as faixas do tronco,
 * de baixo para cima (os quadris, a cintura fina, o peito e os ombros largos); o braço de cima, que alarga a
 * faixa do peito; a ombreira; o cotovelo, a mão e o raio do antebraço; as mãos juntas; a lâmina (meia
 * largura, de onde até onde) e a guarda. A base de cada uma fica mais ao sul que a da anterior (capa, cabeça,
 * pernas, tronco, antebraços, lâmina): é a ordem em que a 3/4 as pinta.
 */
const BARRA = { y: -0.2, rx: 0.42, ry: 0.3 }
const CAPA = { y: -0.16, rx: 0.3, ry: 0.26 }
const CABECA = { y: -0.06, r: 0.17 }
const PERNA = { x: 0.105, y: 0.05, rx: 0.07, ry: 0.07 }
const TRONCO: readonly { readonly rx: number; readonly ry: number }[] = [
  { rx: 0.2, ry: 0.13 },
  { rx: 0.165, ry: 0.14 },
  { rx: 0.25, ry: 0.15 },
  { rx: 0.34, ry: 0.16 },
]
/** A faixa do peito, a que leva os braços de cima (o cotovelo do antebraço fica debaixo deles). */
const FAIXA_DO_PEITO = 2
const BRACO_DE_CIMA = { x: 0.3, y: 0.04, r: 0.07 }
const OMBREIRA = { x: 0.23, y: -0.01, r: 0.095 }
const ANTEBRACO = { cotoveloX: 0.3, cotoveloY: 0.06, maoX: 0.04, maoY: 0.25, r: 0.06 }
const MAOS = { y: 0.23, rx: 0.09, ry: 0.12 }
const LAMINA = { l: 0.065, y0: 0.24, y1: 0.39 }
const GUARDA = { l: 0.2, y0: 0.26, y1: 0.34 }
/**
 * O meio da caixa das peças que não podem subir com o que está em cima do meio de verdade delas: as dos
 * ombros (fora da cabeça), as dos antebraços (fora do tronco), as da espada (na ponta da lâmina, fora das
 * mãos), a fatia do meio da capa (atrás da cabeça) e as três da barra (fora da capa: as dos lados e a de trás).
 */
const MEIO_DO_OMBRO = 0.22
const MEIO_DO_ANTEBRACO = { x: 0.11, y: 0.2 }
const MEIO_DA_ESPADA = 0.37
const MEIO_DA_CAPA = -0.31
const MEIO_DA_BARRA = { x: 0.36, y: -0.46 }
/** Onde as fatias da capa e da barra se dividem (fração do menor meio lado): as duas de fora e a do meio. */
const FATIA_DA_CAPA = 0.2
/** As pregas da capa, em leque a partir da nuca: quantas na volta inteira e quanto de luz. */
const PREGAS_DA_CAPA = 16
const LUZ_DAS_PREGAS = 0.07
/**
 * O tom da capa (bem mais escura: é o fundo em que a figura clara se recorta na 3/4), o que as peças de cima
 * dela clareiam de volta, o tom da lâmina, o dos antebraços e o do rosto na sombra do elmo.
 */
const TOM_DA_CAPA = -0.4
const TOM_DA_CAPA_DE_CIMA = 1.34
const TOM_DA_LAMINA = 0.3
const TOM_DOS_ANTEBRACOS = 0.14
const TOM_DO_ROSTO = -0.4
/** A sombra da figura pintada no tampo: até que altura dela (casas) é arrastada, em quantos passos, a borda e a força. */
const ALTURA_DA_SOMBRA_NO_TAMPO = 0.8
const PASSOS_DA_SOMBRA_NO_TAMPO = 5
const BORDA_DA_SOMBRA_NO_TAMPO = 1.4
const FORCA_DA_SOMBRA_NO_TAMPO = 0.26
/** As manchas de tempo do tampo: o tamanho (px do protótipo por volta do ruído) e a força. */
const TAMANHO_DAS_MANCHAS = 14
const FORCA_DAS_MANCHAS = 0.36
/** O soco do lado da luz e do lado da sombra da cornija (o sul e o leste da tela). */
const TOM_DO_SOCO = 0.9
const TOM_DO_SOCO_NA_SOMBRA = 0.7
/** O líquen: rodelas claras e meio transparentes na cornija. O meio em frações do meio lado dela, o raio em fração do menor meio lado. */
const LIQUEN: MaterialDaPeca = { classe: 'liso', rgb: [0xb6, 0xb3, 0x9a] }
const LIQUENS: readonly (readonly [number, number, number])[] = [
  [-0.62, -0.66, 0.08],
  [-0.48, -0.74, 0.05],
  [0.7, 0.6, 0.07],
  [0.56, 0.72, 0.045],
  [-0.72, 0.5, 0.05],
]
/** O musgo: o verde-oliva do Meio-Termo puxado para a pedra, em tufos de bolinhas. */
const TOM_DO_MUSGO: Rgb = rgb(tomDoMeio('musgo', 0.84))
const QUANTO_DE_PEDRA_NO_MUSGO = 0.16
const BOLINHAS_POR_AREA = 0.12
const RAIO_DA_BOLINHA = 1.4
/** Os tufos: o meio em frações da meia pegada e os dois raios em frações do menor meio lado. Dois na cornija, três ao pé do soco. */
const TUFOS: readonly (readonly [number, number, number, number])[] = [
  [0.7, -0.7, 0.1, 0.08],
  [-0.74, 0.72, 0.08, 0.07],
  [-0.9, 0.93, 0.16, 0.05],
  [0.6, 0.95, 0.2, 0.045],
  [0.95, -0.3, 0.045, 0.16],
]
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): um cinza quente, de luminância linear
 * 0,056. Com o escuro de sempre (o da nogueira) a beira da pedra cinza, na sombra, saía marrom.
 */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]
/** Mais longe que qualquer peça: as metades e as tiras do desenho são caixas até aqui. */
const LONGE = 4096
const LADOS = [-1, 1] as const

/**
 * O quarto de volta que a 3/4 pinta no desenho (0 a 3; de cima é sempre 0: quem gira é a imagem pronta). Com
 * ele, o que tem de ficar no lugar NA TELA (o corte das metades, o furo, a sombra pintada) é desgirado no desenho.
 */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto (ou o deslocamento) do desenho que, depois de `quartos` quartos de volta (`girarPonto` de `tresQuartos.ts`), cai em (x, y) na tela. */
function desgirado(x: number, y: number, quartos: number): [number, number] {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** A caixa dada no referencial da TELA (o desenho depois de `quartos` quartos de volta), no referencial do desenho. */
function caixaDaTela(quartos: number, x0: number, y0: number, x1: number, y1: number): Forma {
  if (quartos === 1) return caixa(y0, -x1, y1, -x0)
  if (quartos === 2) return caixa(-x1, -y1, -x0, -y0)
  if (quartos === 3) return caixa(-y1, x0, -y0, x1)
  return caixa(x0, y0, x1, y1)
}

/** O canto (sx, sy) do desenho fica na metade do sul da tela? */
function cantoDoSul(sx: number, sy: number, quartos: number): boolean {
  return quartos === 1 ? sx > 0 : quartos === 2 ? sy < 0 : quartos === 3 ? sx < 0 : sy > 0
}

/**
 * O pé de uma coluna da figura arrastado para o norte da tela até a linha do meio: o furo que ele abre na
 * metade do sul do pedestal. Sem o trecho até a linha, a frente do pedestal (a metade do sul varrida do chão
 * ao alto) fecharia o furo e cobriria o pé. O pé é simétrico em volta do meio da caixa dele (roda, elipse,
 * caixa), então o trecho é a caixa da largura dele.
 */
function arrastadoAteOMeio(pe: Forma, quartos: number): Forma {
  const [x0, y0, x1, y1] = pe.b
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  if (quartos === 1) return mx > 0 ? uniao(pe, caixa(0, y0, mx, y1)) : pe
  if (quartos === 2) return my < 0 ? uniao(pe, caixa(x0, my, x1, 0)) : pe
  if (quartos === 3) return mx < 0 ? uniao(pe, caixa(mx, y0, 0, y1)) : pe
  return my > 0 ? uniao(pe, caixa(x0, 0, x1, my)) : pe
}

/** A forma pintada só dentro da caixa, SEM borda no corte (o chanfro e o contorno continuam os da forma inteira). */
function recortada(f: Forma, x0: number, y0: number, x1: number, y1: number): Forma {
  return { b: [Math.max(f.b[0], x0), Math.max(f.b[1], y0), Math.min(f.b[2], x1), Math.min(f.b[3], y1)], d: (x, y) => f.d(x, y) }
}

/**
 * A mesma forma numa caixa com o meio em (cx, cy): a 3/4 sobe cada peça com a estrutura que contém o meio da
 * caixa dela, e é por aqui que a peça diz de quem ela é quando o meio de verdade cairia em outra mais alta.
 */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - f.b[0], f.b[2] - cx)
  const my = Math.max(cy - f.b[1], f.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => f.d(x, y) }
}

/**
 * A forma em quatro quartos em volta do meio do desenho. Os dois do sul da tela levam `furada` (a mesma
 * forma sem o pé da figura); os do norte, a forma inteira, que passa por baixo da figura.
 */
function emQuartos(inteira: Forma, furada: Forma, quartos: number): Forma[] {
  const [x0, y0, x1, y1] = inteira.b
  return LADOS.flatMap((sx) =>
    LADOS.map((sy) => recortada(cantoDoSul(sx, sy, quartos) ? furada : inteira, sx < 0 ? x0 : 0, sy < 0 ? y0 : 0, sx < 0 ? 0 : x1, sy < 0 ? 0 : y1)),
  )
}

/**
 * A pedra do tampo do pedestal: as manchas de tempo (escuras, largas, sem borda) e a sombra da figura,
 * arrastada do pé dela até `alto` px de altura para o lado (dx, dy) por px. O chão da figura é o tampo, e a
 * sombra no chão do motor fica debaixo do pedestal.
 */
function texDoTampo(figura: Forma, dx: number, dy: number, alto: number): Textura {
  const daPedra = texturaDaClasse('pedra')
  return (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const mancha = ruido(x / TAMANHO_DAS_MANCHAS + p.su, y / TAMANHO_DAS_MANCHAS + p.sv)
    if (mancha > 0.08) s[3] -= FORCA_DAS_MANCHAS * (mancha - 0.08)
    let k = 0
    for (let i = 0; i <= PASSOS_DA_SOMBRA_NO_TAMPO && k < 1; i += 1) {
      const z = (alto * i) / PASSOS_DA_SOMBRA_NO_TAMPO
      const ki = 0.5 - figura.d(x - dx * z, y - dy * z) / (2 * BORDA_DA_SOMBRA_NO_TAMPO)
      if (ki > k) k = ki
    }
    if (k > 0) s[3] -= FORCA_DA_SOMBRA_NO_TAMPO * (k < 1 ? k : 1)
  }
}

/** A pedra da capa de cima: as pregas em leque a partir da nuca (nx, ny). */
function texDaCapa(nx: number, ny: number): Textura {
  const daPedra = texturaDaClasse('pedra')
  return (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    s[3] += Math.cos(Math.atan2(y - ny, x - nx) * PREGAS_DA_CAPA) * LUZ_DAS_PREGAS
  }
}

/** Um tufo de musgo: um punhado de bolinhas sorteadas dentro da mancha de meio (cx, cy) e raios (rx, ry), cada uma com o seu tom. */
function tufoDeMusgo(c: ContextoDoMovel, L: Peca[], cx: number, cy: number, rx: number, ry: number, pedra: MaterialDaPeca, sem: number): void {
  const cor: MaterialDaPeca = { classe: 'folha', rgb: misturar(TOM_DO_MUSGO, pedra.rgb, QUANTO_DE_PEDRA_NO_MUSGO) }
  const bolinhas = Math.max(3, Math.round(Math.PI * rx * ry * BOLINHAS_POR_AREA))
  for (let i = 0; i < bolinhas; i += 1) {
    const longe = hash(i, sem, 135)
    const t = hash(i, sem, 136) * 2 * Math.PI
    const r = RAIO_DA_BOLINHA * (0.7 + 0.7 * hash(i, sem, 137))
    const bolinha = elipse(cx + Math.cos(t) * rx * longe, cy + Math.sin(t) * ry * longe, r, r * 0.86)
    L.push(c.peca(bolinha, cor, { bisel: r * 0.7, contorno: 0.26, tom: 0.82 + 0.3 * hash(i, sem, 138), semente: sem * 31 + i }))
  }
}

export const montarEstatua: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const quartos = quartosDoGiro(c.giro)
  const naTela = (x0: number, y0: number, x1: number, y1: number): Forma => caixaDaTela(quartos, x0, y0, x1, y1)
  const norte = naTela(-LONGE, -LONGE, LONGE, 0)
  const sul = naTela(-LONGE, 0, LONGE, LONGE)
  const zSoco = g * ALTURA_DO_SOCO
  const zTopo = g * ALTURA_DO_PEDESTAL
  const zDado = zTopo - ESPESSURA_DA_CORNIJA

  // O pé de cada coluna da figura (a barra da capa, a capa, a cabeça, as duas pernas e a lâmina) e o furo
  // que eles abrem na metade do sul do pedestal.
  const barra = elipse(0, BARRA.y * R, BARRA.rx * R, BARRA.ry * R)
  const capa = elipse(0, CAPA.y * R, CAPA.rx * R, CAPA.ry * R)
  const cabeca = elipse(0, CABECA.y * R, CABECA.r * R, CABECA.r * R)
  const pernas = LADOS.map((lado) => elipse(lado * PERNA.x * R, PERNA.y * R, PERNA.rx * R, PERNA.ry * R))
  const lamina = caixa(-LAMINA.l * R, LAMINA.y0 * R, LAMINA.l * R, LAMINA.y1 * R, 0.5)
  const furo = [barra, capa, cabeca, ...pernas, lamina].map((pe) => arrastadoAteOMeio(pe, quartos)).reduce((a, b) => uniao(a, b))
  // As faixas do tronco, de baixo para cima: a do peito leva os braços de cima; a última são os ombros.
  const tronco = TRONCO.map(({ rx, ry }, k) => {
    const faixa = elipse(0, 0, rx * R, ry * R)
    if (k !== FAIXA_DO_PEITO) return faixa
    return LADOS.reduce((forma, lado) => uniao(forma, elipse(lado * BRACO_DE_CIMA.x * R, BRACO_DE_CIMA.y * R, BRACO_DE_CIMA.r * R, BRACO_DE_CIMA.r * R)), faixa)
  })
  const ombros = tronco[tronco.length - 1]

  // O PEDESTAL. O soco, o dado e a cornija no desenho, e o meio lado de cada um como fica na tela.
  const soco = caixa(-hw * SOCO, -hh * SOCO, hw * SOCO, hh * SOCO, 0.8)
  const dado = caixa(-hw * DADO, -hh * DADO, hw * DADO, hh * DADO, 0.6)
  const cornija = caixa(-hw * CORNIJA, -hh * CORNIJA, hw * CORNIJA, hh * CORNIJA, 1)
  const [tw, th] = quartos % 2 === 1 ? [hh, hw] : [hw, hh]
  const [xSoco, ySoco] = [tw * SOCO, th * SOCO]
  const [xDado, yDado] = [tw * DADO, th * DADO]
  const [xCornija, yCornija] = [tw * CORNIJA, th * CORNIJA]
  cena.sombras.push(contato(soco, 0.3))

  // O soco em quatro estruturas: a tira do norte, os dois braços (até onde a beirada da cornija os esconde
  // na 3/4) e a ferradura do sul, com o resto dos braços e a tira da frente.
  const yDoBraco = yCornija - zDado + zSoco
  const ferradura = uniao(uniao(naTela(-LONGE, yDoBraco, -xDado, LONGE), naTela(xDado, yDoBraco, LONGE, LONGE)), naTela(-LONGE, yDado, LONGE, LONGE))
  for (const parte of [naTela(-LONGE, -LONGE, LONGE, -yCornija), naTela(-LONGE, -yCornija, -xDado, yDoBraco), naTela(xDado, -yCornija, LONGE, yDoBraco), ferradura]) {
    cena.sombras.push({ forma: dentroDe(soco, parte), z: zSoco })
  }
  cena.sombras.push({ forma: dentroDe(dado, norte), z: zDado }, { forma: dentroDe(menos(dado, furo), sul), z: zDado })
  cena.sombras.push({ forma: dentroDe(cornija, norte), z: zTopo, solta: true, forca: 0.26 }, { forma: dentroDe(menos(cornija, furo), sul), z: zTopo, solta: true, forca: 0.26 })

  // As peças do soco, uma por tira (na tela: de onde até onde, o meio da caixa e se está na sombra da
  // cornija). O meio de cada uma fica na estrutura dela e fora da cornija, que é mais alta.
  const xDeFora = (xSoco + xCornija) / 2
  const tiras: readonly (readonly [number, number, number, number, number, number, boolean])[] = [
    [-xSoco, -ySoco, xSoco, -yCornija, 0, -(ySoco + yCornija) / 2, false],
    [-xSoco, -yCornija, -xDado, yDoBraco, -xDeFora, (yDoBraco - yCornija) / 2, false],
    [xDado, -yCornija, xSoco, yDoBraco, xDeFora, (yDoBraco - yCornija) / 2, true],
    [-xSoco, yDoBraco, -xDado, ySoco, -xDeFora, (yDoBraco + ySoco) / 2, false],
    [xDado, yDoBraco, xSoco, ySoco, xDeFora, (yDoBraco + ySoco) / 2, true],
    [-xDado, yDado, xDado, ySoco, 0, (yCornija + ySoco) / 2, true],
  ]
  for (const [x0, y0, x1, y1, mx, my, naSombra] of tiras) {
    const tira = recortada(soco, ...naTela(x0, y0, x1, y1).b)
    L.push(P(comMeioEm(tira, ...desgirado(mx, my, quartos)), pedra, { tabua: 0, bisel: 1.5, tom: naSombra ? TOM_DO_SOCO_NA_SOMBRA : TOM_DO_SOCO, contorno: 0.28, semente: 5000 }))
  }

  // O tampo da cornija, com as manchas e a sombra da figura, e a moldura rebaixada em volta.
  const comSombra = texDoTampo(uniao(barra, ombros), ...desgirado(SOMBRA_X, SOMBRA_Y, quartos), g * ALTURA_DA_SOMBRA_NO_TAMPO)
  for (const quarto of emQuartos(cornija, menos(cornija, furo), quartos)) {
    L.push(P(quarto, pedra, { tabua: 0, bisel: 1.8, contorno: 0.28, textura: comSombra, semente: 5010 }))
  }
  const [xTampo, yTampo] = [hw * CORNIJA, hh * CORNIJA]
  const recuo = R * RECUO_DA_MOLDURA
  const dentroDoSulco = recuo + R * SULCO_DA_MOLDURA
  const sulco = menos(
    caixa(-xTampo + recuo, -yTampo + recuo, xTampo - recuo, yTampo - recuo, 0.8),
    caixa(-xTampo + dentroDoSulco, -yTampo + dentroDoSulco, xTampo - dentroDoSulco, yTampo - dentroDoSulco, 0.5),
  )
  for (const quarto of emQuartos(sulco, menos(sulco, furo), quartos)) {
    L.push(P(quarto, pedra, { tabua: 0, bisel: 0, tom: 0.76, contorno: 0, recesso: { k: 1, forca: 0.3 }, textura: comSombra, semente: 5010 }))
  }
  LIQUENS.forEach(([fx, fy0, raio], k) => {
    const r = raio * R
    L.push(P(elipse(fx * xTampo, fy0 * yTampo, r, r * (0.7 + 0.3 * hash(k, 1, 139))), LIQUEN, { bisel: 0, contorno: 0, alfa: 0.42, suave: 0.9, semente: 5020 + k }))
  })
  TUFOS.forEach(([fx, fy0, rx, ry], k) => tufoDeMusgo(c, L, fx * hw, fy0 * hh, rx * R, ry * R, pedra, 5030 + k))

  // A CAPA: duas colunas atrás da figura, bem mais escuras que ela: a barra, baixa e aberta, e a capa, que
  // sobe até os ombros, mais estreita que eles. De cima, o leque com as pregas: cada coluna em três fatias,
  // o meio da caixa de cada uma fora do que está em cima dela (a do meio passa inteira por baixo dos ombros
  // e da cabeça: na 3/4 girada o alto da capa aparece, e sem ela ficava um buraco escuro no leque).
  const zDaFigura = (altura: number): number => zTopo + g * altura
  cena.sombras.push({ forma: barra, z: zDaFigura(ALTURA_DA_BARRA) }, { forma: capa, z: zDaFigura(ALTURA_DA_CAPA) })
  const pedraDaCapa: MaterialDaPeca = { ...pedra, rgb: luz(pedra.rgb, TOM_DA_CAPA) }
  const pregas = { tabua: 0, bisel: 1.6, tom: TOM_DA_CAPA_DE_CIMA, contorno: 0.3, textura: texDaCapa(0, CABECA.y * R), projeta: { dist: 1.6, forca: 0.26 } }
  const fatia = R * FATIA_DA_CAPA
  const [xDaBarra, yDaBarra] = [MEIO_DA_BARRA.x * R, MEIO_DA_BARRA.y * R]
  L.push(P(comMeioEm(recortada(barra, -LONGE, -LONGE, -fatia, LONGE), -xDaBarra, BARRA.y * R), pedraDaCapa, { ...pregas, semente: 5040 }))
  L.push(P(comMeioEm(recortada(barra, fatia, -LONGE, LONGE, LONGE), xDaBarra, BARRA.y * R), pedraDaCapa, { ...pregas, semente: 5040 }))
  L.push(P(comMeioEm(recortada(barra, -fatia, -LONGE, fatia, LONGE), 0, yDaBarra), pedraDaCapa, { ...pregas, semente: 5040 }))
  L.push(P(recortada(capa, -LONGE, -LONGE, -fatia, LONGE), pedraDaCapa, { ...pregas, semente: 5041 }))
  L.push(P(recortada(capa, fatia, -LONGE, LONGE, LONGE), pedraDaCapa, { ...pregas, semente: 5041 }))
  L.push(P(comMeioEm(recortada(capa, -fatia, -LONGE, fatia, LONGE), 0, MEIO_DA_CAPA * R), pedraDaCapa, { ...pregas, semente: 5041 }))

  // As PERNAS, duas colunas até os quadris, e o TRONCO, as faixas empilhadas em cima delas. Só a beirada de
  // cada faixa aparece, e só na 3/4; de cima os ombros cobrem tudo, e a sombra no chão é a deles.
  for (const perna of pernas) cena.sombras.push({ forma: perna, z: zDaFigura(ALTURA_DAS_PERNAS) })
  tronco.forEach((faixa, k) => {
    cena.sombras.push({ forma: faixa, z: zDaFigura(ALTURA_DAS_PERNAS + (k + 1) * CORNIJA_EM_CASAS), solta: true, forca: faixa === ombros ? 0.22 : 0 })
  })

  // A ESPADA: a lâmina é a coluna da frente; de cima, o corte dela e a guarda atravessada (o meio das duas
  // peças fica na ponta da lâmina, fora das mãos, que estão mais alto).
  cena.sombras.push({ forma: lamina, z: zDaFigura(ALTURA_DA_GUARDA) })
  const pedraDaLamina: MaterialDaPeca = { ...pedra, rgb: luz(pedra.rgb, TOM_DA_LAMINA) }
  const yDaEspada = MEIO_DA_ESPADA * R
  L.push(P(comMeioEm(lamina, 0, yDaEspada), pedraDaLamina, { tabua: 0, bisel: 0.6, tom: 0.92, contorno: 0.3, semente: 5060 }))
  const guarda = caixa(-GUARDA.l * R, GUARDA.y0 * R, GUARDA.l * R, GUARDA.y1 * R, 0.8)
  L.push(P(comMeioEm(guarda, 0, yDaEspada), pedraDaLamina, { tabua: 0, bisel: 0.8, contorno: 0.32, semente: 5061, projeta: { dist: 1, forca: 0.26, suave: 0.6 } }))

  // Os ANTEBRAÇOS: o tampo solto do cotovelo às mãos, as duas juntas no punho da espada, por cima da guarda.
  const antebracos = LADOS.map((lado) => capsula(lado * ANTEBRACO.cotoveloX * R, ANTEBRACO.cotoveloY * R, lado * ANTEBRACO.maoX * R, ANTEBRACO.maoY * R, ANTEBRACO.r * R))
  const maos = elipse(0, MAOS.y * R, MAOS.rx * R, MAOS.ry * R)
  cena.sombras.push({ forma: uniao(uniao(antebracos[0], antebracos[1]), maos), z: zDaFigura(ALTURA_DAS_MAOS), solta: true, forca: 0 })
  const pedraDosAntebracos: MaterialDaPeca = { ...pedra, rgb: luz(pedra.rgb, TOM_DOS_ANTEBRACOS) }
  const manga = { tabua: 0, bisel: 1.3, tom: 0.94, contorno: 0.3, projeta: { dist: 1.2, forca: 0.28, suave: 0.7 } }
  LADOS.forEach((lado, i) => {
    L.push(P(comMeioEm(antebracos[i], lado * MEIO_DO_ANTEBRACO.x * R, MEIO_DO_ANTEBRACO.y * R), pedraDosAntebracos, { ...manga, semente: 5070 + i }))
  })
  L.push(P(maos, pedraDosAntebracos, { ...manga, tom: 0.98, semente: 5072 }))

  // De cima, os OMBROS, por cima dos cotovelos: as duas metades (o meio de cada uma fora da cabeça) e as ombreiras.
  const alto = { tabua: 0, bisel: 2, tom: 1.02, contorno: 0.28, semente: 5050, projeta: { dist: 2, forca: 0.26 } }
  for (const lado of LADOS) {
    const metade = recortada(ombros, lado < 0 ? -LONGE : 0, -LONGE, lado < 0 ? 0 : LONGE, LONGE)
    L.push(P(comMeioEm(metade, lado * MEIO_DO_OMBRO * R, 0), pedra, alto))
  }
  for (const lado of LADOS) {
    const r = OMBREIRA.r * R
    L.push(P(elipse(lado * OMBREIRA.x * R, OMBREIRA.y * R, r, r), pedra, { tabua: 0, bisel: r * 0.8, tom: 1.1, contorno: 0.26, semente: 5052 + lado }))
  }

  // A CABEÇA: a coluna mais alta. A roda escura escondida debaixo do elmo é a maior peça dela e dá o tom
  // da frente (o rosto na sombra); por cima, o elmo redondo e a crista, da nuca à testa.
  cena.sombras.push({ forma: cabeca, z: zDaFigura(ALTURA_DA_CABECA) })
  const rDaCabeca = CABECA.r * R
  const yDaCabeca = CABECA.y * R
  L.push(P(cabeca, { ...pedra, rgb: luz(pedra.rgb, TOM_DO_ROSTO) }, { tabua: 0, bisel: 0, contorno: 0, semente: 5080 }))
  L.push(P(cabeca, pedra, { tabua: 0, bisel: rDaCabeca * 0.75, tom: 1.08, contorno: 0.3, semente: 5081, projeta: { dist: 2.2, forca: 0.3 } }))
  const crista = caixa(-rDaCabeca * 0.17, yDaCabeca - rDaCabeca * 0.96, rDaCabeca * 0.17, yDaCabeca + rDaCabeca * 0.8, rDaCabeca * 0.17)
  L.push(P(crista, pedra, { tabua: 0, bisel: rDaCabeca * 0.16, tom: 1.2, contorno: 0.26, semente: 5082 }))
}
