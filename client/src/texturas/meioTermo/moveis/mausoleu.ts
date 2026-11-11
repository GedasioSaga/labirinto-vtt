/**
 * MAUSOLÉU de cima com volume (11/11/2026, lote 2 dos objetos novos): a casa
 * pequena de pedra do cemitério, o parente grande da lápide e da cova. Sobre
 * uma laje de chão, a cela de paredes de pedra com o TELHADO de duas águas de
 * lajes (a cumeeira corre do fundo para a frente), o FRONTÃO na frente, a
 * PORTA de ferro de duas folhas entre as ombreiras, os DEGRAUS que sobem até
 * ela e uma COLUNA solta em cada canto, com o capitel quadrado. Nenhum símbolo
 * de religião de verdade. A frente é o lado de baixo (um dos lados menores).
 *
 * De cima aparecem a laje (com a sombra da casa pintada nela), os quatro
 * capitéis, o telhado (a água do lado da luz clara, a outra escura, as lajes
 * desencontradas de fileira em fileira e as pedras da cumeeira), o alto da
 * porta de ferro entre as ombreiras e os degraus. Na 3/4 a fachada aparece
 * inteira, e o desenho é montado para o que `tresQuartos.ts` faz com as
 * sombras (cada sombra com altura é uma estrutura; as estruturas são pintadas
 * do norte para o sul; cada peça sobe com a estrutura mais alta que contém o
 * meio da caixa dela). Do norte para o sul:
 * - a CELA são quatro paredes finas, cada uma uma coluna da altura dela (a
 *   sombra grande no chão), com as fiadas dos lados e do fundo em tiras;
 * - as FIADAS da fachada são tampos soltos empilhados, um por bloco, com a
 *   junta desencontrada de fiada em fiada: a beirada de cada um é a face do
 *   bloco. A espessura é `ESPESSURA_DA_FIADA`, que o perfil da 3/4 usa. Até a
 *   altura da porta as fiadas param nas ombreiras; a de cima dela tem a verga
 *   inteiriça, e a última sai um pouco mais, de cornija. O TÍMPANO do frontão
 *   são mais blocos, empilhados do alto da parede até cada fileira do telhado;
 * - o TELHADO são tampos soltos, um por fileira de lajes, cada fileira mais
 *   alta que a de fora: a beirada de cada uma, na frente, desenha a empena;
 * - a PORTA são duas folhas (colunas de ferro) com três travessas cada (tampos
 *   de ferro, cada um um pouco mais saído que o de cima, para o risco de
 *   ferro do alto de cada um ser a peça dele), entre as OMBREIRAS de pedra;
 * - as COLUNAS dos cantos (o pé, o fuste redondo e o capitel, um tampo) ficam
 *   fora da planta do telhado, para nenhum dos dois ser pintado em cima do
 *   outro;
 * - os DEGRAUS, os mais ao sul, são pintados por último e escondem o pé da
 *   porta. A LAJE não é estrutura: fica no chão, por baixo de tudo.
 * Só o que vai do chão ao alto sem nada na frente é coluna (as paredes, as
 * folhas da porta e os fustes): a sombra arrastada de cada coluna é a conta
 * mais cara da pintura, e o resto, em tampos, não a faz.
 *
 * As medidas da porta, dos degraus, das colunas e do beiral são em casas: o
 * mausoléu esticado ganha parede e telhado, não uma porta mais larga.
 * Materiais: `pedra` e `porta`; o musgo é fixo.
 */
import { hash, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, elipse, menos, type Forma } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'

/** A altura de uma fiada de blocos, em casas e em px do protótipo. O perfil do mausoléu em `tresQuartos.ts` usa o valor em px. */
const FIADA_EM_CASAS = 0.16
export const ESPESSURA_DA_FIADA = FIADA_EM_CASAS * G
/** Quantas fiadas tem a parede e quantas tem a porta (as de cima dela são a verga e a cornija). */
const FIADAS_DA_PAREDE = 9
const FIADAS_DA_PORTA = 7
/**
 * As travessas de cada folha da porta: a altura em que cada uma acaba, em fiadas, de cima para baixo. A de
 * cima fica um pouco abaixo do alto da folha: a peça da folha, que está debaixo das duas, sobe com a mais alta.
 */
const TRAVESSAS_DA_PORTA = [FIADAS_DA_PORTA - 0.2, 4, 1] as const
/** O telhado: as fileiras de lajes de cada água, quanto cada fileira sobe em relação à de fora e quanto a cumeeira passa da última, em casas. */
const FILEIRAS_DO_TELHADO = 4
const SUBIDA_DA_FILEIRA = 0.12
const SUBIDA_DA_CUMEEIRA = 0.05
/** O comprimento de uma laje do telhado, de uma pedra da cumeeira e de um bloco da fachada, em casas. */
const LAJE_DO_TELHADO = 0.75
const PEDRA_DA_CUMEEIRA = 0.5
const BLOCO = 0.42
/** A planta, em casas: quanto a parede recua da pegada dos lados e no fundo, a grossura dela, o beiral, e o que sobra na frente para a porta e os degraus. */
const RECUO_DA_PAREDE = 0.36
const RECUO_DO_FUNDO = 0.2
const PAREDE = 0.07
const BEIRAL = 0.065
const FRENTE = 0.78
/** A laje do chão, em fração da meia pegada, e o lado de cada pedra dela, em casas. */
const LAJE = 0.98
const PEDRA_DA_LAJE = 0.5
/** A porta: a meia largura, a largura de cada ombreira e quanto a verga passa das ombreiras, em casas. */
const MEIA_PORTA = 0.4
const OMBREIRA = 0.11
const SOBRA_DA_VERGA = 0.1
/** As colunas dos cantos, em casas: quanto o meio fica para dentro da pegada, o raio do fuste, o meio lado do capitel e o do pé, e a altura do pé. */
const RECUO_DA_COLUNA = 0.145
const RAIO_DO_FUSTE = 0.105
const CAPITEL = 0.135
const PE_DA_COLUNA = 0.125
const ALTURA_DO_PE = 0.08
/** Os degraus, em casas: quantos, o fundo e a altura de cada um, quanto o de cima passa das ombreiras e quanto cada um passa do de cima. */
const DEGRAUS = 3
const FUNDO_DO_DEGRAU = 0.17
const ALTURA_DO_DEGRAU = 0.07
const SOBRA_DO_PATAMAR = 0.08
const SOBRA_DO_DEGRAU = 0.07
/**
 * O relevo da fachada, em px do protótipo a partir da face da parede (são encaixes, não esticam): até onde
 * saem o tímpano, as fiadas, o rodapé e a cornija; de onde até onde vai a folha da porta e a primeira
 * travessa, e quanto cada travessa sai a mais que a de cima; até onde sai a ombreira; e quanto tudo isso
 * entra na parede, só para não abrir fresta. Nenhuma estrutura tem menos de 2,4 px de fundo: a frente
 * varrida de uma tira mais fina que o chanfro sai riscada (a distância dentro dela não passa de meia tira).
 */
const TIMPANO = 1.2
const RELEVO_DA_FIADA = 2.4
const RELEVO_DO_RODAPE = 3
const CORNIJA = 3.4
const FOLHA = { de: 0.5, ate: 5.2 }
const TRAVESSA = { de: 2.6, ate: 5.8, degrau: 0.6 }
const FRENTE_DA_OMBREIRA = 7.4
const ENCAIXE = 2
/** A junta entre as lajes do telhado e entre as pedras do chão (px do protótipo). */
const JUNTA = 0.45
const JUNTA_DA_LAJE = 0.9
/** A água do telhado virada para a luz (o oeste) e a outra. */
const TOM_DA_AGUA_DA_LUZ = 1.05
const TOM_DA_AGUA_DA_SOMBRA = 0.82
/** A borda da sombra no chão das colunas de verdade (px do protótipo): cada parede da cela, cada folha da porta e cada fuste. E a dos tampos que não fazem sombra. */
const BORDA_DA_SOMBRA_DA_CELA = 3
const BORDA_DA_SOMBRA_DA_PORTA = 1.5
const BORDA_DA_SOMBRA_DO_FUSTE = 2.4
const BORDA_DO_TAMPO_SEM_SOMBRA = 0.5
/** A sombra da casa pintada na laje e nos degraus: em quantos passos é arrastada, a borda e a força (nos degraus, mais fraca: a entrada não some no escuro). */
const PASSOS_DA_SOMBRA = 4
const BORDA_DA_SOMBRA = 2.4
const FORCA_DA_SOMBRA = 0.3
const FORCA_DA_SOMBRA_NOS_DEGRAUS = 0.14
/** O musgo: o verde-oliva do Meio-Termo puxado para a pedra, em tufos de bolinhas. */
const TOM_DO_MUSGO: Rgb = rgb(tomDoMeio('musgo', 0.84))
const QUANTO_DE_PEDRA_NO_MUSGO = 0.16
const BOLINHAS_POR_AREA = 0.06
const RAIO_DA_BOLINHA = 1.5
/** Os tufos da laje: o meio em frações da meia pegada e os dois raios em casas. Ao pé das paredes, dos degraus e das colunas. */
const TUFOS_DA_LAJE: readonly (readonly [number, number, number, number])[] = [
  [-0.87, -0.3, 0.05, 0.3],
  [-0.9, 0.5, 0.05, 0.2],
  [0.88, 0.1, 0.05, 0.24],
  [-0.62, 0.72, 0.16, 0.05],
  [0.66, 0.9, 0.2, 0.05],
  [0.2, -0.96, 0.3, 0.04],
]
/** Os tufos do telhado, na beira de baixo das águas e junto da cumeeira: o meio em frações do meio telhado e os dois raios em casas. */
const TUFOS_DO_TELHADO: readonly (readonly [number, number, number, number])[] = [
  [-0.93, -0.55, 0.05, 0.22],
  [-0.9, 0.62, 0.05, 0.14],
  [0.94, -0.1, 0.05, 0.26],
  [0.12, -0.8, 0.06, 0.1],
  [0.7, 0.4, 0.1, 0.06],
]
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): um cinza quente, de luminância linear
 * 0,056. Com o escuro de sempre (o da nogueira) a beira da pedra cinza, na sombra, saía marrom.
 */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]
/** Mais longe que qualquer peça: as fatias da laje são caixas até aqui. */
const LONGE = 4096
const LADOS = [-1, 1] as const

/** O quarto de volta que a 3/4 pinta no desenho (0 a 3; de cima é sempre 0: quem gira é a imagem pronta). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O deslocamento no desenho que, depois de `quartos` quartos de volta (`girarPonto` de `tresQuartos.ts`), cai em (dx, dy) na tela. */
function desgirado(dx: number, dy: number, quartos: number): [number, number] {
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/**
 * O fuste da coluna: o círculo com a distância exata, de uma raiz só (a da elipse faz duas e quatro
 * divisões). Cada fuste é varrido do pé ao alto na sombra e na frente da 3/4: é a conta que mais se repete.
 */
function disco(cx: number, cy: number, r: number): Forma {
  return {
    b: [cx - r, cy - r, cx + r, cy + r],
    d(x, y) {
      const dx = x - cx
      const dy = y - cy
      return Math.sqrt(dx * dx + dy * dy) - r
    },
  }
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
 * Quanto da sombra da casa cai no ponto, de 0 a 1: a planta dela (`casa`) arrastada do pé até `alto` px de
 * altura, para o lado (dx, dy) por px. A laje e os degraus são peças, e a sombra no chão do motor fica
 * debaixo delas.
 */
function sombraDaCasa(casa: Forma, dx: number, dy: number, alto: number): (x: number, y: number) => number {
  return (x, y) => {
    let k = 0
    for (let i = 1; i <= PASSOS_DA_SOMBRA && k < 1; i += 1) {
      const z = (alto * i) / PASSOS_DA_SOMBRA
      const ki = 0.5 - casa.d(x - dx * z, y - dy * z) / (2 * BORDA_DA_SOMBRA)
      if (ki > k) k = ki
    }
    return k < 1 ? k : 1
  }
}

/** A pedra dos degraus: o grão e a sombra da casa. */
function texDoDegrau(sombra: (x: number, y: number) => number): Textura {
  const daPedra = texturaDaClasse('pedra')
  return (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    s[3] -= FORCA_DA_SOMBRA_NOS_DEGRAUS * sombra(x, y)
  }
}

/** A pedra da laje do chão: pedras quadradas de `lado` px, desencontradas de fileira em fileira, cada uma com o seu tom, e a sombra da casa. */
function texDaLaje(sombra: (x: number, y: number) => number, lado: number): Textura {
  const daPedra = texturaDaClasse('pedra')
  return (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const fileira = Math.floor(y / lado)
    const xNaFileira = x + (fileira & 1) * lado * 0.5
    const pedra = Math.floor(xNaFileira / lado)
    const fx = xNaFileira - pedra * lado
    const fy = y - fileira * lado
    const ateAJunta = Math.min(fx, lado - fx, fy, lado - fy)
    if (ateAJunta < JUNTA_DA_LAJE) s[3] -= 0.24 * (1 - ateAJunta / JUNTA_DA_LAJE)
    s[3] += (hash(pedra, fileira, 141) - 0.5) * 0.1 - FORCA_DA_SOMBRA * sombra(x, y)
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

/** Os cortes de um trecho de `a` a `b` em `n` pedaços iguais, a junta desencontrada meio pedaço quando `desencontra`: de onde até onde vai cada pedaço. */
function emPedacos(a: number, b: number, n: number, desencontra: boolean): [number, number][] {
  const passo = (b - a) / n
  const cortes = [a]
  for (let j = desencontra ? 0.5 : 1; j < n; j += 1) cortes.push(a + j * passo)
  cortes.push(b)
  return cortes.slice(1).map((ate, j): [number, number] => [cortes[j], ate])
}

export const montarMausoleu: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const ferro = c.m.porta
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const fiada = ESPESSURA_DA_FIADA
  // A borda da sombra de cada coluna é dada aqui, mais firme que a do motor (que cresce com a altura): a
  // sombra arrastada do pé ao alto é a conta mais cara da pintura, e a borda larga dobra a área dela. A
  // borda macia da sombra da casa é a das fileiras do telhado, que não são arrastadas.
  const coluna = (forma: Forma, z: number, suave: number): void => {
    cena.sombras.push({ forma, z, suave })
  }
  // O tampo sem força não faz sombra (a da cela já cobre a dele): a borda mínima só encolhe a área que o motor varre à toa.
  const tampo = (forma: Forma, z: number, forca = 0): void => {
    cena.sombras.push(forca > 0 ? { forma, z, solta: true, forca } : { forma, z, solta: true, forca, suave: BORDA_DO_TAMPO_SEM_SOMBRA })
  }

  // A planta: a cela, o telhado (com o beiral dos lados e no fundo; na frente ele acaba na cornija) e a porta.
  const xParede = hw - g * RECUO_DA_PAREDE
  const yFundo = -hh + g * RECUO_DO_FUNDO
  const yFrente = hh - g * FRENTE
  const xTelhado = xParede + g * BEIRAL
  const yTelhadoN = yFundo - g * BEIRAL
  const yTelhadoS = yFrente + CORNIJA
  const xPorta = g * MEIA_PORTA
  const xOmbreira = xPorta + g * OMBREIRA
  const yOmbreira = yFrente + FRENTE_DA_OMBREIRA
  const zParede = FIADAS_DA_PAREDE * fiada
  const zPorta = FIADAS_DA_PORTA * fiada
  const zBeiral = zParede + fiada
  const zCumeeira = zBeiral + g * (SUBIDA_DA_FILEIRA * (FILEIRAS_DO_TELHADO - 1) + SUBIDA_DA_CUMEEIRA)
  const cela = caixa(-xParede, yFundo, xParede, yFrente)
  const sombra = sombraDaCasa(cela, ...desgirado(SOMBRA_X, SOMBRA_Y, quartosDoGiro(c.giro)), zCumeeira)

  // Os degraus, do de cima (o patamar, rente às ombreiras) ao de baixo: cada um mais baixo, mais largo e mais comprido.
  const yDosDegraus = yFrente + RELEVO_DA_FIADA
  const degraus = Array.from({ length: DEGRAUS }, (_, k) => {
    const x = xOmbreira + g * (SOBRA_DO_PATAMAR + SOBRA_DO_DEGRAU * k)
    const ySul = yOmbreira + g * FUNDO_DO_DEGRAU * (k + 1)
    return { forma: caixa(-x, yDosDegraus, x, ySul, 0.6), x, ySul, z: g * ALTURA_DO_DEGRAU * (DEGRAUS - k) }
  })
  const ultimo = degraus[DEGRAUS - 1]

  // A LAJE do chão, em fatias em volta do telhado e dos degraus (o meio de cada uma fora de toda estrutura:
  // ela não sobe na 3/4). A sombra da casa vai pintada nela.
  const laje = caixa(-hw * LAJE, -hh * LAJE, hw * LAJE, hh * LAJE, 1.2)
  cena.sombras.push(contato(laje, 0.3))
  const chao = { tabua: 0, bisel: 1.4, tom: 0.84, contorno: 0.3, textura: texDaLaje(sombra, g * PEDRA_DA_LAJE), semente: 6000 }
  // As dos lados e a do fundo vão até a parede, por baixo do beiral (na 3/4 o chão aparece ali): o meio
  // da caixa delas fica no que sobra para fora do telhado.
  const xDeFora = (hw * LAJE + xTelhado) / 2
  const fatias: readonly (readonly [number, number, number, number, number, number])[] = [
    [-LONGE, -LONGE, -xParede, LONGE, -xDeFora, 0],
    [xParede, -LONGE, LONGE, LONGE, xDeFora, 0],
    [-xParede, -LONGE, xParede, yFundo, 0, (yTelhadoN - hh * LAJE) / 2],
    [-xParede, yFrente, -ultimo.x, LONGE, -(xParede + ultimo.x) / 2, (yTelhadoS + hh * LAJE) / 2],
    [ultimo.x, yFrente, xParede, LONGE, (xParede + ultimo.x) / 2, (yTelhadoS + hh * LAJE) / 2],
    [-ultimo.x, ultimo.ySul, ultimo.x, LONGE, 0, (ultimo.ySul + hh * LAJE) / 2],
  ]
  for (const [x0, y0, x1, y1, mx, my] of fatias) L.push(P(comMeioEm(recortada(laje, x0, y0, x1, y1), mx, my), pedra, chao))
  TUFOS_DA_LAJE.forEach(([fx, fy, rx, ry], k) => tufoDeMusgo(c, L, fx * hw, fy * hh, rx * g, ry * g, pedra, 6010 + k))

  // A CELA: quatro paredes finas, cada uma uma coluna da altura dela. Num bloco só, a frente varrida do
  // bloco (a planta inteira, do chão ao alto) cobriria o telhado no mausoléu girado de lado na 3/4, em que
  // as fileiras do lado de lá são pintadas antes dele. De cima o telhado cobre as quatro.
  const parede = g * PAREDE
  for (const [x0, y0, x1, y1] of [
    [-xParede, yFundo, xParede, yFundo + parede],
    [-xParede, yFundo, -xParede + parede, yFrente],
    [xParede - parede, yFundo, xParede, yFrente],
    [-xParede, yFrente - parede, xParede, yFrente],
  ]) {
    coluna(caixa(x0, y0, x1, y1), zParede, BORDA_DA_SOMBRA_DA_CELA)
  }
  // As fiadas dos lados e do fundo, uma tira por fiada, de ponta a ponta: são a parede que aparece quando o
  // mausoléu é girado na 3/4 (de frente, só a beira delas, nas duas pontas da fachada).
  for (let k = 1; k <= FIADAS_DA_PAREDE; k += 1) {
    const sai = k === FIADAS_DA_PAREDE ? CORNIJA : k === 1 ? RELEVO_DO_RODAPE : RELEVO_DA_FIADA
    tampo(caixa(-xParede, yFundo - sai, xParede, yFundo + ENCAIXE), k * fiada)
    tampo(caixa(-xParede - sai, yFundo, -xParede + ENCAIXE, yFrente), k * fiada)
    tampo(caixa(xParede - ENCAIXE, yFundo, xParede + sai, yFrente), k * fiada)
  }

  // O TELHADO e o TÍMPANO. Cada fileira de lajes é um tampo, da de fora (o beiral) à de dentro, cada uma
  // mais alta; debaixo de cada uma, menos a do beiral, os blocos do tímpano, rentes à fachada e à parede
  // do fundo (a empena de trás, que aparece no mausoléu girado meia volta na 3/4): tampos empilhados do
  // alto da parede até a fileira.
  const larguraDaFileira = xTelhado / FILEIRAS_DO_TELHADO
  const lajesPorFileira = Math.max(2, Math.round((yTelhadoS - yTelhadoN) / (g * LAJE_DO_TELHADO)))
  const telhado: Peca[] = []
  for (const lado of LADOS) {
    const tom = lado < 0 ? TOM_DA_AGUA_DA_LUZ : TOM_DA_AGUA_DA_SOMBRA
    for (let i = 0; i < FILEIRAS_DO_TELHADO; i += 1) {
      const [xa, xb] = [lado * (xTelhado - i * larguraDaFileira), lado * (xTelhado - (i + 1) * larguraDaFileira)]
      const [x0, x1] = [Math.min(xa, xb), Math.max(xa, xb)]
      const z = zBeiral + g * SUBIDA_DA_FILEIRA * i
      const fileira = caixa(x0, yTelhadoN, x1, yTelhadoS)
      tampo(fileira, z, 0.24)
      const [t0, t1] = [Math.max(x0, -xParede), Math.min(x1, xParede)]
      for (let alto = z - fiada; alto > zParede; alto -= fiada) {
        tampo(caixa(t0, yFrente - ENCAIXE, t1, yFrente + TIMPANO), alto)
        tampo(caixa(t0, yFundo - TIMPANO, t1, yFundo + ENCAIXE), alto)
      }
      // O fundo das juntas e, por cima, as lajes; a água da sombra faz sombra na fileira de baixo dela.
      const sem = 6100 + (lado + 1) * 50 + i * 12
      telhado.push(P(fileira, pedra, { tabua: 0, bisel: 0.5, tom: tom * 0.62, contorno: 0.2, semente: sem }))
      emPedacos(yTelhadoN, yTelhadoS, lajesPorFileira, i % 2 === 1).forEach(([ya, yb], j) => {
        const lajota = caixa(x0 + JUNTA, ya + JUNTA, x1 - JUNTA, yb - JUNTA, 0.8)
        const projeta = lado > 0 ? { dist: 1.8, forca: 0.3 } : undefined
        telhado.push(P(lajota, pedra, { tabua: 0, bisel: 1.3, tom: tom * (0.94 + 0.12 * hash(j, sem, 142)), contorno: 0.24, semente: sem + 1 + j, projeta }))
      })
    }
  }
  // A CUMEEIRA: a fileira de pedras de lombo redondo em cima do encontro das duas águas.
  const xCumeeira = larguraDaFileira * 0.26
  const cumeeira = caixa(-xCumeeira, yTelhadoN - 1, xCumeeira, yTelhadoS + 0.8, 1)
  tampo(cumeeira, zCumeeira, 0.24)
  const pedrasDaCumeeira = Math.max(2, Math.round((yTelhadoS - yTelhadoN) / (g * PEDRA_DA_CUMEEIRA)))
  telhado.push(P(cumeeira, pedra, { tabua: 0, bisel: 0.5, tom: 0.6, contorno: 0.2, semente: 6300 }))
  emPedacos(yTelhadoN - 1, yTelhadoS + 0.8, pedrasDaCumeeira, false).forEach(([ya, yb], j) => {
    const lombo = caixa(-xCumeeira, ya + JUNTA, xCumeeira, yb - JUNTA, 1.4)
    telhado.push(P(lombo, pedra, { tabua: 0, bisel: xCumeeira * 0.8, tom: 0.98 + 0.08 * hash(j, 3, 143), contorno: 0.26, semente: 6301 + j, projeta: { dist: 2.2, forca: 0.32 } }))
  })

  // As FIADAS da fachada: um tampo por bloco, sem peça (só a beirada aparece, e só na 3/4).
  const xVerga = xOmbreira + g * SOBRA_DA_VERGA
  for (let k = 1; k <= FIADAS_DA_PAREDE; k += 1) {
    const ySul = yFrente + (k === FIADAS_DA_PAREDE ? CORNIJA : k === 1 ? RELEVO_DO_RODAPE : RELEVO_DA_FIADA)
    // Até a altura da porta, um trecho de cada lado das ombreiras; em cima dela, a verga inteiriça entre dois trechos; a cornija, de ponta a ponta.
    const trechos: readonly (readonly [number, number, boolean])[] =
      k <= FIADAS_DA_PORTA
        ? [[-xParede, -xOmbreira, false], [xOmbreira, xParede, false]]
        : k === FIADAS_DA_PORTA + 1
          ? [[-xParede, -xVerga, false], [-xVerga, xVerga, true], [xVerga, xParede, false]]
          : [[-xParede, xParede, false]]
    for (const [a, b, inteirico] of trechos) {
      const blocos = inteirico ? 1 : Math.max(1, Math.round((b - a) / (g * BLOCO)))
      for (const [x0, x1] of emPedacos(a, b, blocos, !inteirico && k % 2 === 0)) tampo(caixa(x0, yFrente - ENCAIXE, x1, ySul), k * fiada)
    }
  }

  // Os DEGRAUS: tampos baixos (a beirada de cada um desce até o chão, ou até o degrau de baixo esconder o
  // resto). O patamar é inteiro; cada degrau de baixo, só a ferradura que sobra em volta do de cima
  // (inteiro, a frente dele cobriria o piso do de cima). A peça de cada um é o piso que aparece (o que o
  // degrau de cima e a porta não cobrem), com o meio da caixa na tira da frente dele.
  const pisoDosDegraus: Peca[] = []
  const zonaDaPorta = caixa(-xOmbreira, yDosDegraus - 1, xOmbreira, yOmbreira)
  degraus.forEach((degrau, k) => {
    tampo(k === 0 ? degrau.forma : menos(degrau.forma, degraus[k - 1].forma), degrau.z, 0.22)
    const deCima = k === 0 ? zonaDaPorta : degraus[k - 1].forma
    const yDeCima = k === 0 ? yOmbreira : degraus[k - 1].ySul
    const piso = comMeioEm(menos(degrau.forma, deCima), 0, (yDeCima + degrau.ySul) / 2)
    pisoDosDegraus.push(P(piso, pedra, { tabua: 0, bisel: 1.1, tom: 1.06, contorno: 0.28, textura: texDoDegrau(sombra), semente: 6400 + k }))
  })
  // De cima o degrau de baixo fica por baixo do de cima.
  L.push(...pisoDosDegraus.reverse())

  // A PORTA: as duas folhas de ferro e as três travessas de cada uma; as OMBREIRAS de pedra dos lados, em
  // blocos empilhados na altura das fiadas (a peça do alto delas sobe com o bloco de cima).
  for (const lado of LADOS) {
    const [x0, x1] = [Math.min(0, lado * xPorta), Math.max(0, lado * xPorta)]
    coluna(caixa(x0, yFrente + FOLHA.de, x1, yFrente + FOLHA.ate), zPorta, BORDA_DA_SOMBRA_DA_PORTA)
    L.push(P(caixa(x0, yTelhadoS, x1, yFrente + FOLHA.ate), ferro, { bisel: 0.5, tom: 0.9, contorno: 0.3, semente: 6500 + lado }))
    TRAVESSAS_DA_PORTA.forEach((fiadas, n) => {
      const [ya, yb] = [yFrente + FOLHA.ate + TRAVESSA.degrau * n, yFrente + TRAVESSA.ate + TRAVESSA.degrau * n]
      tampo(caixa(x0, yFrente + TRAVESSA.de, x1, yb), fiadas * fiada)
      L.push(P(caixa(x0, ya, x1, yb), ferro, { bisel: 0.3, tom: 1.06 - 0.06 * n, contorno: 0.22, semente: 6510 + lado * 4 + n }))
    })
    const [o0, o1] = [Math.min(lado * xPorta, lado * xOmbreira), Math.max(lado * xPorta, lado * xOmbreira)]
    for (let k = 1; k <= FIADAS_DA_PORTA; k += 1) tampo(caixa(o0, yFrente - ENCAIXE, o1, yOmbreira), k * fiada)
    L.push(P(caixa(o0, yTelhadoS, o1, yOmbreira, 0.5), pedra, { tabua: 0, bisel: 1, tom: 1.02, contorno: 0.3, semente: 6520 + lado }))
  }

  // As COLUNAS dos cantos: o fuste redondo, o pé quadrado (um tampo baixo, a beirada até o chão) e o
  // capitel, o tampo solto no alto do fuste.
  const xColuna = hw - g * RECUO_DA_COLUNA
  const [rFuste, meioCapitel, meioPe] = [g * RAIO_DO_FUSTE, g * CAPITEL, g * PE_DA_COLUNA]
  for (const sx of LADOS) {
    for (const [n, cy] of [yTelhadoN + rFuste * 0.2, yFrente].entries()) {
      const cx = sx * xColuna
      coluna(disco(cx, cy, rFuste), zParede - fiada, BORDA_DA_SOMBRA_DO_FUSTE)
      tampo(caixa(cx - meioPe, cy - meioPe, cx + meioPe, cy + meioPe, 0.8), g * ALTURA_DO_PE)
      const capitel = caixa(cx - meioCapitel, cy - meioCapitel, cx + meioCapitel, cy + meioCapitel, 1)
      tampo(capitel, zParede, 0.24)
      const sem = 6600 + (sx + 1) * 4 + n * 2
      L.push(P(capitel, pedra, { tabua: 0, bisel: 1.6, tom: 1.04, contorno: 0.3, semente: sem, projeta: { dist: 3, forca: 0.3 } }))
      const friso = menos(caixa(cx - meioCapitel * 0.72, cy - meioCapitel * 0.72, cx + meioCapitel * 0.72, cy + meioCapitel * 0.72, 0.6), caixa(cx - meioCapitel * 0.5, cy - meioCapitel * 0.5, cx + meioCapitel * 0.5, cy + meioCapitel * 0.5, 0.4))
      L.push(P(friso, pedra, { tabua: 0, bisel: 0, tom: 0.76, contorno: 0, recesso: { k: 1, forca: 0.3 }, semente: sem + 1 }))
    }
  }

  // O telhado por cima de tudo, e o musgo dele.
  L.push(...telhado)
  TUFOS_DO_TELHADO.forEach(([fx, fy, rx, ry], k) => tufoDeMusgo(c, L, fx * xTelhado, (yTelhadoN + yTelhadoS) / 2 + (fy * (yTelhadoS - yTelhadoN)) / 2, rx * g, ry * g, pedra, 6700 + k))
}
