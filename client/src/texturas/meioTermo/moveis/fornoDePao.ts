/**
 * FORNO DE PÃO de cima com volume (lote 2 dos objetos novos, 11/11/2026): o
 * forno de lenha da padaria, de barro e tijolo. A frente é o lado de baixo,
 * como na lareira: o mestre encosta o fundo na parede e gira. De trás para a
 * frente: a CÚPULA de barro claro, redonda, com a CHAMINÉ curta de tijolo no
 * fundo, as trincas do barro e a mancha de fuligem por cima da boca; a BOCA
 * em arco, de tijolo (as duas OMBREIRAS e as ADUELAS do arco
 * entre elas); o LAR, o chão da boca, escuro de fuligem para dentro, com a
 * cinza, duas achas e as brasas; e a SOLEIRA de lajes, rente ao chão. Ao lado
 * da boca, a tábua com três PÃES (duas broas e uma bengala, com a farinha e
 * os cortes) e a PÁ de padeiro deitada no chão.
 *
 * ACESO (variante 0): as achas queimam, as brasas acendem, o halo quente fica
 * no lar e um mais fraco pega a soleira. APAGADO (variante 1): a lenha fria, a
 * cinza e uns carvões escuros. A chama não entra na imagem: é a camada animada
 * da lareira e da fornalha, e a disposição que ela lê é `FORNO_DE_PAO`.
 *
 * NA 3/4 a boca aparece de frente, pelo que `tresQuartos.ts` faz com as
 * sombras (cada sombra com altura é uma estrutura, pintada do norte para o
 * sul; cada peça sobe com a mais alta que contém o meio da caixa dela):
 * - a cúpula é uma coluna redonda: o disco de cima sobe e a frente varrida
 *   fecha o tambor. A luz de esfera do disco é pintada na textura e acaba, na
 *   beira da frente, perto do tom da frente varrida: a cúpula desce no tambor
 *   sem degrau;
 * - a chaminé, no fundo, é mais alta: sobra por cima da crista da cúpula;
 * - cada ADUELA do arco é um tampo no ar, com o pedaço dela do vão recortado
 *   na beira da frente: a beirada de cada uma desce com o recorte (a boca sai
 *   em arco) e leva o chanfro e o contorno dela (as juntas do arco). A
 *   espessura é `ESPESSURA_DO_ARCO_DO_FORNO`, que o perfil da 3/4 usa;
 * - as ombreiras são colunas, e a frente delas ganha as FIADAS de tijolo,
 *   desenhadas de frente e guardadas debaixo do tampo da ombreira e da
 *   soleira; cada fiada sobe para a altura dela pela fresta dela (a ideia do
 *   guarda-roupa, `fiadasDaFrente`);
 * - o FUNDO DA BOCA é uma coluna escura e fina atrás do lar, escondida debaixo
 *   do arco na vista de cima: na 3/4 é o escuro de dentro do forno, e a chama
 *   sobe na frente dele;
 * - o lar não está em estrutura nenhuma: fica no chão, e a chama não sobe.
 * A boca é mais alta que a cúpula (e o fundo dela, mais alto que o arco): a
 * peça com o meio em duas estruturas sobe com a mais alta, e o tijolo que
 * encosta na cúpula tem de ficar com a boca. Girado na 3/4 (`c.giro`), o que é
 * desenhado de frente não entra (as fiadas, o escuro de dentro), e a luz da
 * cúpula fica onde está na tela.
 *
 * A 25% de zoom sobram o disco claro com o quadradinho da chaminé, o bloco de
 * tijolo com o ponto quente e os pães: é o que diz "forno de pão" e não
 * "poço" nem "lareira". As posições são frações da pegada (2 x 2 casas de
 * partida); as alturas, casas. Materiais: `pedra` (o lar e a soleira) e
 * `madeira` (a pá e a tábua dos pães); o barro, o tijolo e o pão são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { MATERIAIS } from '../materiais'
import { cadeia, caixa, capsula, dentroDe, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { BURACO, CINZA, G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { alvenaria, brasas, FOGO_PARADO, texCinza, texFuligem, texHalo, texLenhaQueimada } from './fogoDeCasa'

/**
 * A disposição do forno, em frações da largura (x) e da altura (y) da pegada a
 * partir do centro, a frente embaixo e sem giro, como `LAREIRA` e `FORNALHA`
 * em `lib/mobilia/fogoDeCasa.ts`. A imagem parada e a chama animada leem a
 * mesma: `fogo` é o meio das brasas, onde as línguas nascem.
 */
export const FORNO_DE_PAO = {
  cupula: { x: 0, y: -0.105, raio: 0.385 },
  /** O meio lado da chaminé é fração do menor lado: ela continua quadrada no forno esticado. */
  chamine: { x: 0, y: -0.33, meioLado: 0.058 },
  ombreira: { de: 0.125, ate: 0.25, topo: 0.25, base: 0.415 },
  /** O arco entre as ombreiras: o vão é a meia elipse recortada na beira da frente (`ate`), de meia largura `vao` e altura `flecha`. */
  arco: { meiaLargura: 0.13, de: 0.215, ate: 0.365, vao: 0.12, flecha: 0.06 },
  /** Um nada mais largo que o vão: entra debaixo das ombreiras, sem fresta de barro entre ele e o tijolo. */
  fundoDaBoca: { meiaLargura: 0.127, de: 0.285, ate: 0.3 },
  lar: { meiaLargura: 0.125, de: 0.295, ate: 0.415 },
  soleira: { meiaLargura: 0.27, de: 0.405, ate: 0.495 },
  /** O meio do fogo no lar: as achas, as brasas e o halo. Atrás da soleira, que na 3/4 sobe e taparia as brasas da frente. */
  fogo: { x: 0, y: 0.355 },
} as const

/**
 * A espessura do arco e a altura de cada fiada de tijolo da frente, em casas: a beirada de todo tampo no ar
 * do forno na 3/4. O perfil do forno em `tresQuartos.ts` usa `ESPESSURA_DO_ARCO_DO_FORNO` (px do protótipo).
 */
const FIADA = 0.14
export const ESPESSURA_DO_ARCO_DO_FORNO = FIADA * G
/** Fiadas da frente das ombreiras. */
const FIADAS_DA_OMBREIRA = 4
/**
 * Alturas em casas: a cúpula, a chaminé (do chão ao alto), as ombreiras (as fiadas inteiras), o arco, o fundo
 * da boca e a soleira. Em ordem: a cúpula abaixo das ombreiras, as ombreiras abaixo do arco, o arco abaixo do
 * fundo da boca (quem fica com a peça que está em dois).
 */
const ALTURA_DA_CUPULA = 0.55
const ALTURA_DA_CHAMINE = 1.15
const ALTURA_DA_OMBREIRA = FIADAS_DA_OMBREIRA * FIADA
const ALTURA_DO_ARCO = 0.58
const ALTURA_DO_FUNDO_DA_BOCA = 0.62
const ALTURA_DA_SOLEIRA = 0.06
/** A fresta de cada fiada da frente das ombreiras (px do protótipo), escondida debaixo do tampo da ombreira. */
const FRESTA = 0.5
/** A junta entre os tijolos (px do protótipo) e o tom dela: os da `alvenaria` de `fogoDeCasa.ts`. */
const JUNTA = 0.9
const TOM_DA_JUNTA = 0.62
/** O tom da frente que a 3/4 varre (`TOM_DA_FRENTE` de `tresQuartos.ts`): os tijolos pintados de frente ficam nele. */
const TOM_DA_FRENTE_VARRIDA = 0.74

/** O barro claro da cúpula: reboco alisado à mão. Liso: a textura do disco pinta as manchas e a luz de esfera. */
const BARRO_DA_CUPULA: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xaa, 0x8a] }
/** O tijolo: o barro cozido da tabela, com o grão da pedra. */
const TIJOLO: MaterialDaPeca = { classe: 'pedra', rgb: rgb(MATERIAIS.barro.tom) }
/** A fuligem: a mancha por cima da boca e o escuro de dentro do forno. */
const FULIGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x2c, 0x27] }
const ALFA_DA_MANCHA_DE_FULIGEM = 0.66
/**
 * O escuro em que o pixel escuro demais é levantado: cinza-escuro quente, de fuligem. Com o piso padrão (a
 * nogueira) o fundo da boca saía castanho e lia como uma porta de madeira.
 */
const ESCURO_DO_FORNO: Rgb = [0x48, 0x40, 0x3a]
/** O pão: a crosta dourada, a farinha por cima e o corte, onde a massa abriu. */
const CROSTA: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0x96, 0x5c] }
const FARINHA: MaterialDaPeca = { classe: 'liso', rgb: [0xe8, 0xd8, 0xb6] }
const CORTE_DO_PAO: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xbe, 0x8a] }
/** O halo no lar e o que pega a soleira, alfa no centro (os da lareira). */
const ALFA_DO_HALO = 0.22
const ALFA_DO_HALO_NA_SOLEIRA = 0.11
/** Aduelas do arco: ímpar, para a do meio ser o fecho. */
const ADUELAS = 7

/** De onde vem a luz do motor (`motor.ts`): de cima à esquerda, 52° acima do chão. */
const LUZ: readonly [number, number, number] = [-0.62, -0.48, 0.62]
/**
 * A luz de esfera da cúpula: quanto o tom muda com a inclinação. Com 0,34 a beira da frente fica em ~0,66 do
 * tom (a frente varrida da 3/4 é 0,74) e a do lado da sombra em ~0,55, sem chegar ao escuro levantado: com o
 * chanfro do motor (raio inteiro) o lado da sombra era uma meia-lua quase preta.
 */
const FORCA_DA_LUZ_NA_CUPULA = 0.34
/** Até onde a esfera inclina (o quadrado do raio): perto da beira a parede já é quase de pé. */
const BEIRA_DA_ESFERA = 0.92

/** As trincas do barro: riscos finos, em frações da pegada. Nenhuma passa pela chaminé. */
const TRINCAS: readonly (readonly Ponto[])[] = [
  [[-0.245, -0.2], [-0.205, -0.135], [-0.22, -0.07], [-0.175, -0.02]],
  [[0.165, -0.3], [0.2, -0.225], [0.185, -0.16]],
  [[0.1, 0.02], [0.145, 0.08], [0.125, 0.13]],
]
/** A tábua dos pães, à esquerda da boca, e os três pães nela: x, y, os dois raios (frações do menor lado) e o giro. */
const TABUA_DOS_PAES = { de: -0.485, ate: -0.285, topo: 0.215, base: 0.47 } as const
const PAES: readonly (readonly [x: number, y: number, rx: number, ry: number, giro: number])[] = [
  [-0.43, 0.275, 0.05, 0.047, 0.3],
  [-0.336, 0.29, 0.046, 0.044, -0.5],
  [-0.385, 0.4, 0.078, 0.04, -0.22],
]
/** A pá de padeiro, deitada à direita da boca: a ponta do cabo e o meio da pá (frações da pegada). */
const CABO_DA_PA: Ponto = [0.3, 0.485]
const MEIO_DA_PA: Ponto = [0.405, 0.2]
/** A pá: meio comprimento, meia largura e o raio do cabo, em frações do menor lado. */
const MEIO_COMPRIMENTO_DA_PA = 0.07
const MEIA_LARGURA_DA_PA = 0.058
const RAIO_DO_CABO_DA_PA = 0.011

/**
 * O barro da cúpula: as manchas largas do reboco, uns fiapos de palha e a luz de esfera, a partir do meio
 * (cx, cy) e dos raios da cúpula. A luz é a do motor, mais branda (`FORCA_DA_LUZ_NA_CUPULA`); (luzX, luzY) é
 * de onde ela vem no desenho, já descontado o quarto de volta que a 3/4 pinta.
 */
function texCupula(cx: number, cy: number, rx: number, ry: number, luzX: number, luzY: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const rho2 = Math.min(BEIRA_DA_ESFERA, dx * dx + dy * dy)
    const esfera = dx * luzX + dy * luzY + (Math.sqrt(1 - rho2) - 1) * LUZ[2]
    const fiapo = hash(Math.floor(x * 1.3), Math.floor(y * 1.3), 3677) > 0.972 ? -0.09 : 0
    s[3] += FORCA_DA_LUZ_NA_CUPULA * esfera + ruido(x * 0.07 + 13, y * 0.07) * 0.09 + ruido(x * 0.33, y * 0.33 + 5) * 0.035 + fiapo
  }
}

/** A mancha de fuligem por cima da boca: some do meio (cx, cy) para fora, manchada pelo ruído. */
function texManchaDeFuligem(cx: number, cy: number, rx: number, ry: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const q = Math.min(1, dx * dx + dy * dy)
    s[5] = ALFA_DA_MANCHA_DE_FULIGEM * (1 - q) * (1 - q) * (0.8 + ruido(x * 0.3, y * 0.3) * 0.8)
  }
}

/**
 * As aduelas do arco: os tijolos em cunha entre o vão (a meia elipse de centro (0, base), raios `rx` e `ry`) e
 * o retângulo de fora (meia largura `meia`, do `topo` à `base`), cortados em raio a partir do meio do vão.
 */
function aduelas(meia: number, topo: number, base: number, rx: number, ry: number): Forma[] {
  const noVao = (a: number): Ponto => [Math.cos(a) * rx, base - Math.sin(a) * ry]
  /** Onde o raio do ângulo `a` sai do retângulo: pelo topo ou por um dos lados. */
  const naBeira = (a: number): Ponto => {
    const co = Math.cos(a)
    const si = Math.sin(a)
    const peloTopo = si > 1e-6 ? (co * (base - topo)) / si : Infinity
    if (Math.abs(peloTopo) <= meia) return [peloTopo, topo]
    const lado = co >= 0 ? meia : -meia
    return [lado, base - (si * meia) / Math.abs(co)]
  }
  const formas: Forma[] = []
  for (let i = 0; i < ADUELAS; i += 1) {
    const a0 = (Math.PI * i) / ADUELAS
    const a1 = (Math.PI * (i + 1)) / ADUELAS
    const fora0 = naBeira(a0)
    const fora1 = naBeira(a1)
    const pontos: Ponto[] = [noVao(a0), noVao((a0 + a1) / 2), noVao(a1), fora1]
    // A quina do retângulo entra na aduela que sai por um lado e chega pelo topo (ou o contrário).
    if (fora0[1] !== topo && fora1[1] === topo) pontos.push([meia, topo])
    if (fora0[1] === topo && fora1[1] !== topo) pontos.push([-meia, topo])
    pontos.push(fora0)
    formas.push(poligono(pontos))
  }
  return formas
}

/**
 * As FIADAS da frente de uma ombreira, só para a 3/4 (a ideia do guarda-roupa): a frente que a 3/4 varre
 * sozinha é tijolo liso; aqui cada fiada é desenhada de frente (a junta escura e os tijolos, desencontrados
 * de uma fiada para a outra) e guardada debaixo do tampo da ombreira e da soleira, onde de cima nada dela
 * aparece. Cada fiada tem a sua FRESTA, um tampo no ar de `FRESTA` px colado na frente da ombreira, na
 * altura dela: a regra da 3/4 sobe a fiada até lá. As frestas vão uma na frente da outra, a da fiada de cima
 * mais para dentro: a 3/4 pinta do norte para o sul, e a beirada de cada fresta (meia fiada para baixo) fica
 * debaixo da fiada seguinte. A altura de cada uma desconta o quanto a fresta está à frente do pé.
 */
function fiadasDaFrente(c: ContextoDoMovel, cena: Cena, x0: number, x1: number, frente: number, semente: number): void {
  const P = c.peca
  const fiada = c.g * FIADA
  const largura = x1 - x0
  for (let j = 0; j < FIADAS_DA_OMBREIRA; j += 1) {
    const y = frente + j * FRESTA
    const meio = y + FRESTA / 2
    // A fiada j (0 = a de cima) tem o meio a (n - j - 0,5) fiadas do chão.
    cena.sombras.push({ forma: caixa(x0, y, x1, y + FRESTA), z: (FIADAS_DA_OMBREIRA - j - 0.5) * fiada + (meio - frente), solta: true, forca: 0 })
    const y0 = meio - fiada / 2
    const y1 = meio + fiada / 2
    cena.partes.push(P(caixa(x0, y0, x1, y1), TIJOLO, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DA_JUNTA * TOM_DA_FRENTE_VARRIDA, semente: semente + j * 8 }))
    // Dois tijolos numa fiada; meio, um e meio na outra.
    const cortes = j % 2 === 0 ? [0, 0.5, 1] : [0, 0.25, 0.75, 1]
    for (let i = 0; i + 1 < cortes.length; i += 1) {
      const a = x0 + cortes[i] * largura + JUNTA / 2
      const b = x0 + cortes[i + 1] * largura - JUNTA / 2
      cena.partes.push(P(caixa(a, y0 + JUNTA / 2, b, y1 - JUNTA / 2, 1.2), TIJOLO, { tabua: 0, bisel: 1.4, tom: TOM_DA_FRENTE_VARRIDA * (0.92 + 0.16 * hash(j, i, semente)), contorno: 0.15, semente: semente + j * 8 + 1 + i }))
    }
  }
}

/** Os quartos de volta do giro que a 3/4 pinta (0 fora dela). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** A direção (x, y) NA TELA vista do desenho, depois do quarto de volta que a 3/4 pinta: a luz fica onde está. */
function desgirada(x: number, y: number, quartos: number): readonly [number, number] {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** Um pão: a crosta redonda, a farinha por cima e os cortes atravessados. */
function pao(c: ContextoDoMovel, L: Peca[], x: number, y: number, rx: number, ry: number, giro: number, semente: number): void {
  const P = c.peca
  const menor = Math.min(rx, ry)
  L.push(P(elipseGirada(x, y, rx, ry, giro), CROSTA, { bisel: menor * 0.9, contorno: 0.26, semente, projeta: { dist: 1.1, forca: 0.32 } }))
  L.push(P(elipseGirada(x - menor * 0.12, y - menor * 0.12, rx * 0.62, ry * 0.58, giro), FARINHA, { bisel: 0, contorno: 0, alfa: 0.42, suave: menor * 0.45, semente: semente + 1 }))
  // Os cortes: atravessados na bengala (comprida), em cruz na broa (redonda).
  const comprido = rx > ry * 1.4
  const cortes: readonly (readonly [ao: number, giroDoCorte: number])[] = comprido ? [[-0.45, 1.1], [0, 1.1], [0.45, 1.1]] : [[0, 0.2], [0, 0.2 + QUARTO]]
  cortes.forEach(([ao, giroDoCorte], i) => {
    const mx = x + Math.cos(giro) * ao * rx
    const my = y + Math.sin(giro) * ao * rx
    const a = giro + giroDoCorte
    const meio = menor * 0.5
    L.push(P(capsula(mx - Math.cos(a) * meio, my - Math.sin(a) * meio, mx + Math.cos(a) * meio, my + Math.sin(a) * meio, Math.max(0.45, menor * 0.09)), CORTE_DO_PAO, { bisel: 0, contorno: 0.3, semente: semente + 2 + i }))
  })
}

export const montarFornoDePao: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const pedra = c.m.pedra
  const mad = c.m.madeira
  const lenha = materialDaPeca('lenhaCarvalho')
  const aceso = c.variante !== 1
  const R = Math.min(w, h)
  const X = (f: number): number => f * w
  const Y = (f: number): number => f * h
  const { cupula: cu, chamine: ch, ombreira: om, arco: ar, fundoDaBoca: fb, lar, soleira: so, fogo } = FORNO_DE_PAO
  cena.corDoPiso = ESCURO_DO_FORNO

  const formaCupula = elipse(X(cu.x), Y(cu.y), X(cu.raio), Y(cu.raio))
  const meioLado = ch.meioLado * R
  const formaChamine = caixa(X(ch.x) - meioLado, Y(ch.y) - meioLado, X(ch.x) + meioLado, Y(ch.y) + meioLado, 1.2)
  /**
   * A boca está de frente para quem olha? Só sem giro: de cima sempre (a imagem inteira gira) e, na 3/4, com
   * a frente embaixo. Girado na 3/4, o que é desenhado de frente (as fiadas, o escuro de dentro) sairia de
   * lado, solto no ar: fica só o que a 3/4 varre sozinha.
   */
  const quartos = quartosDoGiro(c.giro)
  const bocaDeFrente = quartos === 0
  // As fiadas guardadas têm de caber debaixo do tampo da ombreira e da soleira (no forno encolhido não cabem).
  const meiaFiada = (g * FIADA) / 2
  const frestas = FIADAS_DA_OMBREIRA * FRESTA
  const comFiadas = bocaDeFrente && Y(om.base) - Y(om.topo) > meiaFiada + frestas && Y(so.ate) - Y(om.base) > meiaFiada + 0.5
  // Com as fiadas, a coluna da ombreira acaba um nada antes da frente: é onde ficam as frestas delas.
  const frenteDasOmbreiras = comFiadas ? Y(om.base) - frestas : Y(om.base)
  const ombreiras = [-1, 1].map((lado) => {
    const a = lado * X(om.de)
    const b = lado * X(om.ate)
    return { forma: caixa(Math.min(a, b), Y(om.topo), Math.max(a, b), frenteDasOmbreiras, 1), x0: Math.min(a, b), x1: Math.max(a, b) }
  })
  const formasDasAduelas = aduelas(X(ar.meiaLargura), Y(ar.de), Y(ar.ate), X(ar.vao), Y(ar.flecha))
  const formaFundo = caixa(-X(fb.meiaLargura), Y(fb.de), X(fb.meiaLargura), Y(fb.ate))
  const formaLar = caixa(-X(lar.meiaLargura), Y(lar.de), X(lar.meiaLargura), Y(lar.ate), 0.6)
  const formaSoleira = caixa(-X(so.meiaLargura), Y(so.de), X(so.meiaLargura), Y(so.ate), 1.2)
  const formaTabua = caixa(X(TABUA_DOS_PAES.de), Y(TABUA_DOS_PAES.topo), X(TABUA_DOS_PAES.ate), Y(TABUA_DOS_PAES.base), 1.2)

  cena.sombras.push(
    { forma: formaCupula, z: g * ALTURA_DA_CUPULA },
    { forma: formaChamine, z: g * ALTURA_DA_CHAMINE, forca: 0.2 },
    ...ombreiras.map((o) => ({ forma: o.forma, z: g * ALTURA_DA_OMBREIRA })),
    // As aduelas e o fundo da boca não fazem sombra no chão (estão entre as ombreiras): a altura é só a da 3/4.
    ...formasDasAduelas.map((forma) => ({ forma, z: g * ALTURA_DO_ARCO, solta: true, forca: 0 })),
    ...(bocaDeFrente ? [{ forma: formaFundo, z: g * ALTURA_DO_FUNDO_DA_BOCA, forca: 0 }] : []),
    { forma: formaSoleira, z: g * ALTURA_DA_SOLEIRA, forca: 0.22 },
    contato(formaCupula),
    contato(formaSoleira, 0.2),
    contato(formaTabua, 0.26),
  )
  const L = cena.partes

  // ---------- no chão: o lar com o fogo, a tábua dos pães e a pá ----------
  L.push(P(formaLar, pedra, { tabua: 0, bisel: 0.6, tom: 0.62, contorno: 0.1, textura: texFuligem(Y(lar.de), Y(lar.ate), 0.42), semente: 3601 }))
  const fx = X(fogo.x)
  const fy = Y(fogo.y)
  L.push(P(elipse(fx, fy, X(0.1), Y(0.034)), CINZA, { textura: texCinza(fx, fy, X(0.1)), bisel: 0, contorno: 0, suave: 0.8, semente: 3602 }))
  if (aceso) L.push(P(elipse(fx, fy, X(0.115), Y(0.042)), FOGO_PARADO, { textura: texHalo(fx, fy, X(0.115), Y(0.042), ALFA_DO_HALO), bisel: 0, contorno: 0, semente: 3603 }))
  // Duas achas deitadas no lar, a de trás um pouco torta; queimadas no meio quando o forno está aceso.
  const raioDaAcha = Math.max(1.6, R * 0.017)
  const queima = aceso ? 0.55 : 0.35
  const achas: readonly (readonly [number, number, number, number])[] = [
    [X(-0.085), fy - Y(0.016), X(0.07), fy - Y(0.022)],
    [X(-0.06), fy + Y(0.012), X(0.09), fy + Y(0.018)],
  ]
  achas.forEach(([ax, ay, bx, by], k) => {
    L.push(P(capsula(ax, ay, bx, by, raioDaAcha), lenha, {
      eixo: Math.atan2(by - ay, bx - ax),
      textura: texLenhaQueimada(fx, fy, X(0.08), queima),
      bisel: raioDaAcha,
      contorno: 0.2,
      semente: 3605 + k,
      projeta: { dist: 0.9, forca: 0.3 },
    }))
  })
  brasas(c, L, fx, fy, X(0.07), Y(0.018), aceso ? 7 : 4, Math.max(1, R * 0.011), aceso, 3610)
  // A tábua com os pães: escura, para a crosta clara ler em cima dela.
  L.push(P(formaTabua, mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.62, contorno: 0.26, semente: 3620 }))
  PAES.forEach(([x, y, rx, ry, giro], i) => pao(c, L, X(x), Y(y), rx * R, ry * R, giro, 3625 + i * 8))
  // A pá de padeiro: o cabo comprido e a pá larga e fina, de quina arredondada.
  const [caboX, caboY] = [X(CABO_DA_PA[0]), Y(CABO_DA_PA[1])]
  const [paX, paY] = [X(MEIO_DA_PA[0]), Y(MEIO_DA_PA[1])]
  const aoLongo = Math.atan2(paY - caboY, paX - caboX)
  const co = Math.cos(aoLongo)
  const si = Math.sin(aoLongo)
  const meioComp = MEIO_COMPRIMENTO_DA_PA * R
  const meiaLarg = MEIA_LARGURA_DA_PA * R
  const naPa = (ao: number, tr: number): Ponto => [paX + co * ao * meioComp - si * tr * meiaLarg, paY + si * ao * meioComp + co * tr * meiaLarg]
  const formaPa = poligono([naPa(1, -0.82), naPa(1, 0.82), naPa(0.7, 1), naPa(-0.75, 1), naPa(-1.25, 0.2), naPa(-1.25, -0.2), naPa(-0.75, -1), naPa(0.7, -1)])
  const formaCabo = capsula(caboX, caboY, paX - co * meioComp, paY - si * meioComp, RAIO_DO_CABO_DA_PA * R)
  cena.sombras.push(contato(uniao(formaPa, formaCabo), 0.24))
  L.push(P(formaCabo, mad, { eixo: aoLongo, tabua: 0, bisel: RAIO_DO_CABO_DA_PA * R, tom: 0.92, contorno: 0.26, semente: 3660 }))
  L.push(P(formaPa, mad, { eixo: aoLongo, tabua: 0, bisel: 0.8, tom: 1.06, contorno: 0.26, semente: 3661 }))

  // ---------- a cúpula ----------
  const [luzX, luzY] = desgirada(LUZ[0], LUZ[1], quartos)
  L.push(P(formaCupula, BARRO_DA_CUPULA, { bisel: 1.6, contorno: 0.22, textura: texCupula(X(cu.x), Y(cu.y), X(cu.raio), Y(cu.raio), luzX, luzY), semente: 3670 }))
  // A fuligem por cima da boca: a fumaça que lambe o barro ao sair.
  const mx = 0
  const my = Y(cu.y + cu.raio - 0.045)
  L.push(P(dentroDe(elipse(mx, my, X(0.15), Y(0.13)), formaCupula), FULIGEM, { textura: texManchaDeFuligem(mx, my, X(0.15), Y(0.13)), bisel: 0, contorno: 0, semente: 3671 }))
  TRINCAS.forEach((trinca, i) => {
    L.push(P(cadeia(trinca.map(([x, y]): Ponto => [X(x), Y(y)]), Math.max(0.35, R * 0.0035)), BARRO_DA_CUPULA, { bisel: 0, contorno: 0, tom: 0.56, alfa: 0.7, semente: 3672 + i }))
  })
  // A chaminé curta de tijolo, no fundo, e a boca escura dela.
  L.push(P(formaChamine, TIJOLO, { tabua: 0, bisel: 1.3, contorno: 0.28, semente: 3680, projeta: { dist: 5, forca: 0.32, suave: 1.6 } }))
  const furo = meioLado * 0.52
  L.push(P(caixa(X(ch.x) - furo, Y(ch.y) - furo, X(ch.x) + furo, Y(ch.y) + furo, 0.8), BURACO, { bisel: 0.6, contorno: 0.15, recesso: { k: 1.2, forca: 0.35 }, semente: 3681 }))

  // ---------- a boca ----------
  // O fundo da boca: o escuro de dentro, atrás do lar.
  L.push(P(formaFundo, FULIGEM, { bisel: 0, contorno: 0, semente: 3690 }))
  ombreiras.forEach((o, i) => {
    // As fiadas da frente vão antes do tampo da ombreira e da soleira: de cima, ficam debaixo deles.
    if (comFiadas) fiadasDaFrente(c, cena, o.x0, o.x1, frenteDasOmbreiras, 3780 + i * 40)
    // O tampo da ombreira vai até a frente, por cima das frestas (a coluna dela acaba um nada antes).
    alvenaria(c, L, caixa(o.x0, Y(om.topo), o.x1, Y(om.base), 1), o.x0, Y(om.topo), o.x1, Y(om.base), 3, 1, TIJOLO, 3700 + i * 20)
  })
  // A soleira: lajes largas, rentes ao chão, e o halo fraco do fogo pegando nelas.
  alvenaria(c, L, formaSoleira, -X(so.meiaLargura), Y(so.de), X(so.meiaLargura), Y(so.ate), 1, 3, pedra, 3740)
  if (aceso) {
    const hy = Y(so.de)
    L.push(P(dentroDe(elipse(fx, hy, X(0.2), Y(0.12)), formaSoleira), FOGO_PARADO, { textura: texHalo(fx, hy, X(0.2), Y(0.12), ALFA_DO_HALO_NA_SOLEIRA), bisel: 0, contorno: 0, semente: 3750 }))
  }
  // O arco, por cima do lar: uma aduela por tijolo, cada uma no tom dela.
  formasDasAduelas.forEach((forma, i) => {
    L.push(P(forma, TIJOLO, { tabua: 0, bisel: 0.9, contorno: 0.28, tom: 0.92 + 0.16 * hash(i, 7, 517), semente: 3760 + i }))
  })
}
