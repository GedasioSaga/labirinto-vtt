/**
 * ROLOS DE TECIDO de cima com volume (lote 9 dos objetos novos, 11/11/2026): a
 * banca de pano do mercador na feira. Uma MESA BAIXA de tábuas com a PILHA de
 * rolos deitados ao comprido (três embaixo e dois por cima, cada um de um pano:
 * o xadrez miúdo, o liso mostarda, o liso ameixa, o bordado e o listrado) e, na
 * frente da pilha, o rolo MEIO DESENROLADO: o pano corre pela mesa, cai pela
 * beira da frente e se amontoa no chão em dobras. Na ponta direita da mesa, a
 * FITA DE MEDIR enrolada (a ponta dela atravessa a pilha) e a TESOURA aberta.
 * Ao lado, no chão, o CAIXOTE com três rolos EM PÉ e um vão vazio (o rolo que
 * já foi vendido).
 *
 * As pontas dos rolos mostram a espiral do pano enrolado em volta do miolo de
 * madeira: nos deitados, na elipse de cada ponta (como o corte dos troncos, a
 * da esquerda na luz); nos em pé, no círculo inteiro, que é o que se vê de cima.
 * O padrão de cada pano encolhe para as beiras do rolo, como numa coisa
 * redonda.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) a mesa é um tampo solto sobre quatro pés
 * e leva a pilha, a fita e a tesoura. O pano que cai pela frente é uma coluna
 * estreita na beira da mesa: a frente dela é o pano pendurado até o chão, e o
 * monte de dobras fica no chão, na frente. Cada rolo em pé é uma coluna de
 * pano; o caixote são quatro colunas de ripa (a de trás sai antes dos rolos, a
 * da frente e as dos lados depois, então os rolos ficam dentro da caixa), e o
 * vão vazio é um tampo raso na altura da borda, escuro.
 *
 * Material: `madeira` (a mesa) e `pano` (o pano desenrolado e o rolo dele). Os
 * outros panos, o caixote, a fita e a tesoura são fixos.
 */
import { hash, limitar01, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, caixa, elipse, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { BURACO, materialDaPeca, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- medidas ----------

/** A altura do tampo da mesa baixa, do caixote e de cada rolo em pé, em casas. */
const ALTURA_DA_MESA = 0.4
const ALTURA_DO_CAIXOTE = 0.36
/**
 * Os rolos em pé têm a altura que os deitados têm de comprimento (a largura do pano), uns mais, outros menos;
 * os de trás são mais altos, para a ponta deles aparecer por cima do da frente na 3/4.
 */
const ALTURA_DOS_ROLOS_EM_PE: readonly number[] = [0.8, 0.7, 0.62]
/** A beirada padrão de um tampo solto na 3/4 (`ESPESSURA_DO_TAMPO` de `tresQuartos.ts`): os pés vão até ela. */
const BEIRADA = 0.06

/** A mesa e o caixote em frações da meia pegada (o x da meia largura, o y da meia altura). */
const MESA: Caixa = [-0.985, -0.98, 0.28, 0.24]
const CAIXOTE: Caixa = [0.39, -0.9, 0.985, 0.02]
/** Onde a pilha acaba à direita (fração da meia largura): a ponta da mesa fica para a fita e a tesoura. */
const FIM_DA_PILHA = 0.02
/** O raio dos rolos deitados, em fração da meia altura, e o do rolo desenrolado, em fração do raio. */
const RAIO_DO_ROLO = 0.14
const RAIO_DO_DESENROLADO = 0.8
/** A folga entre a beira da mesa e a pilha (px do protótipo). */
const FOLGA_DA_PILHA = 1
/** A elipse da ponta do rolo: a largura dela em fração do raio (o "bojo" dos troncos). */
const BOJO_DA_PONTA = 0.5
/** O monte de pano no chão: até onde ele vai, em fração da meia altura, e quanto ele abre para cada lado (px). */
const FUNDO_DO_MONTE = 0.97
const ABERTURA_DO_MONTE = 3.4

/** As pernas da mesa: o lado de cada uma e o quanto ficam para dentro do canto (px do protótipo). */
const LADO_DA_PERNA = 2.6
const RECUO_DA_PERNA = 2
/** A grossura da ripa do caixote vista de cima (px do protótipo), a mesma da banca de frutas. */
const RIPA = 1.8

// ---------- as cores ----------

/** Os panos fixos: vivos mas contidos (saturação HSV até 0,56 antes da luz). */
const VERMELHO: Rgb = [0x98, 0x4a, 0x42]
const CRU: Rgb = [0xdc, 0xd0, 0xb2]
const VERDE: Rgb = [0x5e, 0x79, 0x52]
const MOSTARDA: Rgb = [0xb4, 0x8c, 0x4e]
const AMEIXA: Rgb = [0x76, 0x58, 0x78]
const LINHO_DO_BORDADO: Rgb = [0xd2, 0xc6, 0xa6]
const LINHA_VERMELHA: Rgb = [0xa4, 0x46, 0x40]
const LINHA_AZUL: Rgb = [0x4c, 0x62, 0x8c]
/** Os rolos em pé: vinho e verde-mar (o terceiro é mostarda). */
const VINHO: Rgb = [0x8c, 0x40, 0x44]
const VERDE_MAR: Rgb = [0x4e, 0x7a, 0x74]
/** O miolo de madeira do rolo (o cerne claro do pinho) e o furo dele. */
const MIOLO: Rgb = [0xc2, 0x9c, 0x68]
const FURO: Rgb = [0x4a, 0x38, 0x2a]
/** A fita de medir: o pano amarelado dela, a tinta das marcas e a ponteira de latão. */
const FITA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xd6, 0xbc, 0x76] }
const TINTA: Rgb = [0x4a, 0x3a, 0x2e]
const LATAO = materialDaPeca('latao')
/** A tesoura: as lâminas de aço claro (aparecem na madeira escura) e as argolas de latão. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.42)) }
const PINHO = materialDaPeca('pinho')

/** Abaixo desta escala (pixels da imagem por px do protótipo) o padrão miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

// ---------- os panos ----------

type Padrao = 'liso' | 'listrado' | 'xadrez' | 'bordado'

interface Pano {
  readonly cor: Rgb
  readonly padrao: Padrao
  /** A cor da listra, do xadrez ou da linha do bordado. */
  readonly segunda: Rgb
  /** A segunda linha do bordado (o miolo do losango e as linhas da barra). */
  readonly terceira: Rgb
}

function pano(cor: Rgb, padrao: Padrao = 'liso', segunda: Rgb = cor, terceira: Rgb = cor): Pano {
  return { cor, padrao, segunda, terceira }
}

const LISTRADO = pano(VERMELHO, 'listrado', CRU)
const XADREZ = pano(CRU, 'xadrez', VERDE)
const BORDADO = pano(LINHO_DO_BORDADO, 'bordado', LINHA_VERMELHA, LINHA_AZUL)

/** As listras correm ao comprido do rolo: quantas por raio de volta, a parte de cada passo que é listra e a beira macia dela (px). */
const LISTRAS_POR_RAIO = 0.8
const PARTE_DA_LISTRA = 0.42
const BEIRA_DA_LISTRA = 0.45
/** O xadrez miúdo: o passo (px do protótipo) nos dois sentidos. */
const PASSO_DO_XADREZ = 2.1
/** O bordado: a barra de losangos perto de cada ponta (o começo e a largura, px) e o passo dos losangos na volta. */
const RECUO_DA_BARRA = 2.4
const LARGURA_DA_BARRA = 3.2
const PASSO_DO_LOSANGO = 2.6
/** No campo do bordado, um raminho a cada tanto (px), em fileiras desencontradas. */
const PASSO_DO_RAMINHO = 4.6
/** A beira da volta de fora do pano: onde ela corre ao comprido do rolo (fração do arco de cima) e a largura do vinco (px). */
const BEIRA_DA_VOLTA = 0.42
const VINCO = 0.45

const tecido = texturaDaClasse('tecido')

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/** Quanto do losango do bordado cobre o ponto (dx ao comprido, ds na volta), com a beira macia. */
function noLosango(dx: number, ds: number, meio: number): number {
  return limitar01((1 - (Math.abs(dx) + Math.abs(ds)) / meio) * 3)
}

/**
 * O padrão do pano no ponto: `x` ao comprido (o bordado tem uma barra perto de cada ponta, `xa` e `xb`) e `arco`
 * de través (as listras correm ao comprido, a cada `passoDaListra` px). `fino` = o detalhe miúdo ainda cabe.
 */
function pintarPadrao(s: Float32Array, p: Pano, x: number, arco: number, xa: number, xb: number, passoDaListra: number, fino: boolean): void {
  if (p.padrao === 'listrado') {
    const f = arco / passoDaListra - Math.floor(arco / passoDaListra)
    const dentroDaListra = (PARTE_DA_LISTRA / 2 - Math.abs(f - 0.5)) * passoDaListra
    misturarEm(s, p.segunda, limitar01(0.5 + dentroDaListra / BEIRA_DA_LISTRA))
  } else if (p.padrao === 'xadrez') {
    if (!fino) {
      misturarEm(s, p.segunda, 0.42)
      return
    }
    const naX = Math.sin((x * Math.PI) / PASSO_DO_XADREZ) > 0 ? 1 : 0
    const naVolta = Math.sin((arco * Math.PI) / PASSO_DO_XADREZ) > 0 ? 1 : 0
    misturarEm(s, p.segunda, (naX + naVolta) * 0.42)
  } else if (p.padrao === 'bordado') {
    for (const meioDaBarra of [xa + RECUO_DA_BARRA + LARGURA_DA_BARRA / 2, xb - RECUO_DA_BARRA - LARGURA_DA_BARRA / 2]) {
      const dx = x - meioDaBarra
      if (Math.abs(dx) > LARGURA_DA_BARRA / 2 + 0.5) continue
      if (!fino) {
        misturarEm(s, p.segunda, 0.55)
        continue
      }
      // As duas linhas azuis da barra e, entre elas, os losangos vermelhos com o ponto azul no meio.
      if (Math.abs(Math.abs(dx) - LARGURA_DA_BARRA / 2) < 0.32) misturarEm(s, p.terceira, 0.9)
      const ds = arco - (Math.floor(arco / PASSO_DO_LOSANGO) + 0.5) * PASSO_DO_LOSANGO
      misturarEm(s, p.segunda, noLosango(dx, ds, LARGURA_DA_BARRA * 0.42))
      misturarEm(s, p.terceira, noLosango(dx, ds, 0.45))
    }
    if (fino && x > xa + RECUO_DA_BARRA * 2 + LARGURA_DA_BARRA && x < xb - RECUO_DA_BARRA * 2 - LARGURA_DA_BARRA) {
      const fileira = Math.floor(arco / PASSO_DO_RAMINHO)
      const deslocado = x + (fileira & 1) * PASSO_DO_RAMINHO * 0.5
      const dx = deslocado - (Math.floor(deslocado / PASSO_DO_RAMINHO) + 0.5) * PASSO_DO_RAMINHO
      const ds = arco - (fileira + 0.5) * PASSO_DO_RAMINHO
      misturarEm(s, p.segunda, noLosango(dx, ds, 0.75) * 0.85)
    }
  }
}

/**
 * O corpo do rolo deitado (ao comprido em x, o meio em `yc`, de raio `r`, de `xa` a `xb`): a trama do pano, o
 * padrão (que encolhe para as beiras, pela volta do rolo) e o vinco da volta de fora, ao comprido.
 */
function texDoRolo(p: Pano, yc: number, r: number, xa: number, xb: number): Textura {
  return (u, v, x, y, peca, s, escala) => {
    if (tecido !== null) tecido(u, v, x, y, peca, s, escala)
    const q = (y - yc) / r
    // O arco na volta do rolo: perto da beira um passo de pano ocupa menos tela.
    const arco = Math.asin(q > 0.999 ? 0.999 : q < -0.999 ? -0.999 : q) * r
    const fino = escala >= ESCALA_DO_DETALHE
    pintarPadrao(s, p, x, arco, xa, xb, r / LISTRAS_POR_RAIO, fino)
    // O vinco da volta de fora: a beira do pano que acaba ali, ao comprido do rolo.
    const ate = Math.abs(arco + BEIRA_DA_VOLTA * r * (Math.PI / 2))
    if (fino && ate < VINCO) s[3] -= 0.14 * (1 - ate / VINCO)
  }
}

/** A espiral do pano enrolado: as voltas que cabem no raio e a parte de cada volta que é a fresta escura. */
const VOLTAS = 4.2
const FRESTA_DA_VOLTA = 0.3
/** O miolo de madeira e o furo dele, em fração do raio. */
const RAIO_DO_MIOLO = 0.24
const RAIO_DO_FURO = 0.1

/** A ponta do rolo vista de frente (a elipse de raios `rx`, `ry` em volta de (cx, cy)): a espiral, o miolo e o furo. */
function texDaPonta(cx: number, cy: number, rx: number, ry: number, comMiolo: boolean): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const q = Math.sqrt(dx * dx + dy * dy)
    if (comMiolo && q < RAIO_DO_MIOLO) {
      misturarEm(s, q < RAIO_DO_FURO ? FURO : MIOLO, 1)
      s[3] += q < RAIO_DO_FURO ? 0 : 0.06
      return
    }
    const fase = q * VOLTAS - Math.atan2(dy, dx) / (2 * Math.PI)
    const f = fase - Math.floor(fase)
    const forca = escala >= ESCALA_DO_DETALHE ? 0.17 : 0.08
    if (f < FRESTA_DA_VOLTA) s[3] -= forca * (1 - f / FRESTA_DA_VOLTA)
    s[3] += ruido(x * 0.9 + cx, y * 0.9) * 0.04
  }
}

// ---------- a pilha ----------

/** Um rolo deitado na mesa: a camada (0 na mesa, 1 nas frestas da de baixo), o meio em raios a partir do fundo, as pontas e o pano. */
interface RoloDeitado {
  readonly camada: 0 | 1
  readonly y: number
  /** O quanto cada ponta fica para dentro da pilha, em raios (as pontas desencontradas). */
  readonly recuoEsquerdo: number
  readonly recuoDireito: number
  readonly pano: Pano
}

/** A pilha, de baixo para cima e de trás para a frente. */
const PILHA: readonly RoloDeitado[] = [
  { camada: 0, y: 1, recuoEsquerdo: 0.1, recuoDireito: 0.5, pano: XADREZ },
  { camada: 0, y: 3, recuoEsquerdo: 0.6, recuoDireito: 0, pano: pano(AMEIXA) },
  { camada: 0, y: 5, recuoEsquerdo: 0, recuoDireito: 0.3, pano: pano(MOSTARDA) },
  { camada: 1, y: 2, recuoEsquerdo: 1.1, recuoDireito: 0.9, pano: BORDADO },
  { camada: 1, y: 4, recuoEsquerdo: 0.5, recuoDireito: 1.3, pano: LISTRADO },
]
/** O tom de cada camada (a de cima pega mais luz) e o das duas pontas (a da esquerda olha para a luz). */
const TOM_DA_CAMADA = [0.92, 1.03] as const
const TOM_DA_PONTA_NA_LUZ = 1.06
const TOM_DA_PONTA_NA_SOMBRA = 0.84
/** O rolo desenrolado fica logo na frente da pilha, encostado no da frente de baixo (6 raios + o raio dele), em raios a partir do fundo. */
const LUGAR_DO_DESENROLADO = 6 + RAIO_DO_DESENROLADO

/** Um rolo deitado de `xa` a `xb` (com as pontas), no meio `yc`: o corpo com o padrão e as duas pontas com a espiral. */
function montarRolo(P: CriarPeca, L: Peca[], xa: number, xb: number, yc: number, r: number, p: Pano, tom: number, emCima: boolean, sem: number): void {
  const bojo = r * BOJO_DA_PONTA
  const x0 = xa + bojo
  const x1 = xb - bojo
  if (x1 <= x0) return
  const corpo = uniao(caixa(x0, yc - r, x1, yc + r), uniao(elipse(x0, yc, bojo, r), elipse(x1, yc, bojo, r)))
  L.push(P(corpo, { classe: 'tecido', fio: 'la', rgb: p.cor }, {
    bisel: r * 0.9,
    tom,
    contorno: 0.24,
    textura: texDoRolo(p, yc, r, xa, xb),
    semente: sem,
    projeta: emCima ? { dist: r * 0.5, forca: 0.34 } : { dist: 0.9, forca: 0.26 },
  }))
  for (const [xp, tomDaPonta] of [[x0, TOM_DA_PONTA_NA_LUZ], [x1, TOM_DA_PONTA_NA_SOMBRA]] as const) {
    const rx = bojo * 0.86
    const ry = r * 0.86
    L.push(P(elipse(xp, yc, rx, ry), { classe: 'liso', rgb: p.cor }, {
      bisel: 0.6,
      tom: tom * tomDaPonta,
      contorno: 0.2,
      textura: texDaPonta(xp, yc, rx, ry, true),
      semente: sem + (xp === x0 ? 1 : 2),
    }))
  }
}

// ---------- o pano desenrolado ----------

/** As dobras do monte no chão: quantas cabem na largura, quanto entortam e a sombra da beira da mesa sobre o começo dele (px). */
const DOBRAS_DO_MONTE = 4.5
const SOMBRA_NO_MONTE = 4.6

/** O monte de pano no chão: as dobras que abrem em leque para baixo e a sombra da mesa no começo dele. */
function texDoMonte(cx: number, meiaEmCima: number, yTopo: number, yFundo: number, sem: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (tecido !== null) tecido(u, v, x, y, p, s, escala)
    const f = limitar01((y - yTopo) / (yFundo - yTopo))
    const meia = meiaEmCima + ABERTURA_DO_MONTE * f
    const k = (x - cx) / meia
    const dobra = Math.sin(k * DOBRAS_DO_MONTE * Math.PI + ruido(x * 0.07 + sem, y * 0.05) * 2.6 + f * 1.4)
    s[3] += dobra * (0.05 + 0.08 * f) - 0.26 * limitar01(1 - (y - yTopo) / SOMBRA_NO_MONTE)
  }
}

/** A dobra do pano na quina da mesa: a quina pega a luz, e a volta escurece para baixo. */
function texDaDobra(y0: number, y1: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (tecido !== null) tecido(u, v, x, y, p, s, escala)
    s[3] += 0.1 - 0.3 * limitar01((y - y0) / (y1 - y0))
  }
}

/**
 * O contorno do monte de pano no chão: o topo reto debaixo da quina da mesa e o pé ondulado, mais largo e
 * torto (o pano escorregou mais para a esquerda, e a direita acaba mais curta).
 */
function contornoDoMonte(x0: number, x1: number, yTopo: number, yFundo: number): Ponto[] {
  const meio = (yTopo + yFundo) / 2
  const pontos: Ponto[] = [[x0 + 0.4, yTopo], [x1 - 0.4, yTopo], [x1 + ABERTURA_DO_MONTE * 0.4, meio], [x1 + ABERTURA_DO_MONTE * 0.7, yFundo - 3.4]]
  const passos = 10
  for (let i = 1; i < passos; i += 1) {
    const t = i / passos
    const x = x1 + ABERTURA_DO_MONTE * 0.7 - (x1 - x0 + ABERTURA_DO_MONTE * 2) * t
    // O pé desce para a esquerda (o pano escorregou para lá) e ondula em três dobras.
    const onda = Math.sin(t * Math.PI * 3 + 0.4) * 1.5 + (hash(i, 3, 9141) - 0.5) * 1
    pontos.push([x, yFundo - 3.2 + 2.6 * t + onda])
  }
  pontos.push([x0 - ABERTURA_DO_MONTE * 1.3, yFundo - 0.6], [x0 - ABERTURA_DO_MONTE * 0.8, meio], [x0 - 0.3, yTopo + 2])
  return pontos
}

/** A aba do pano no pé do monte, virada do avesso (mais clara), no canto da esquerda: os três cantos, em px a partir do canto de baixo à esquerda do monte. */
const ABA: readonly Ponto[] = [
  [0.6, -7.2],
  [8.4, -1.4],
  [-1.2, 0.2],
]
const TOM_DO_AVESSO = 1.14

// ---------- os panos dobrados ----------

/**
 * Os panos dobrados no chão, no canto da frente à direita, de baixo para cima: a caixa (frações da meia pegada),
 * o giro e o pano. Cada um fica um pouco para o fundo do de baixo, que aparece na frente dele.
 */
const DOBRADOS: readonly { readonly caixa: Caixa; readonly giro: number; readonly pano: Pano }[] = [
  { caixa: [0.31, 0.44, 0.93, 0.96], giro: 0.05, pano: pano(MOSTARDA) },
  { caixa: [0.34, 0.33, 0.95, 0.85], giro: -0.07, pano: pano(CRU, 'xadrez', VERMELHO) },
  { caixa: [0.33, 0.21, 0.91, 0.74], giro: 0.03, pano: pano(CRU, 'listrado', LINHA_AZUL) },
]
/** As listras do pano dobrado (px do protótipo) e o vinco da dobra no meio dele. */
const PASSO_DA_LISTRA_DOBRADA = 3.4
const VINCO_DA_DOBRA = 0.6

/** O pano dobrado (o meio em (cx, cy), no giro `giro`, de meio comprimento `meio`): a trama, o padrão e o vinco da dobra no meio. */
function texDoDobrado(p: Pano, cx: number, cy: number, giro: number, meio: number): Textura {
  const co = Math.cos(giro)
  const si = Math.sin(giro)
  return (u, v, x, y, peca, s, escala) => {
    if (tecido !== null) tecido(u, v, x, y, peca, s, escala)
    const ao = (x - cx) * co + (y - cy) * si
    const atraves = -(x - cx) * si + (y - cy) * co
    const fino = escala >= ESCALA_DO_DETALHE
    pintarPadrao(s, p, ao, atraves, -meio, meio, PASSO_DA_LISTRA_DOBRADA, fino)
    const ate = Math.abs(ao)
    if (ate < VINCO_DA_DOBRA) s[3] -= 0.09 * (1 - ate / VINCO_DA_DOBRA)
  }
}

function montarDobrados(c: ContextoDoMovel, cena: Cena, L: Peca[]): void {
  const { hw, hh, peca: P } = c
  const formas: Forma[] = []
  DOBRADOS.forEach((d, k) => {
    const cx = ((d.caixa[0] + d.caixa[2]) / 2) * hw
    const cy = ((d.caixa[1] + d.caixa[3]) / 2) * hh
    const meio = ((d.caixa[2] - d.caixa[0]) / 2) * hw
    const meiaAltura = ((d.caixa[3] - d.caixa[1]) / 2) * hh
    const co = Math.cos(d.giro)
    const si = Math.sin(d.giro)
    const em = (ao: number, atraves: number): Ponto => [cx + ao * co - atraves * si, cy + ao * si + atraves * co]
    const forma = poligono([em(-meio, -meiaAltura), em(meio, -meiaAltura), em(meio, meiaAltura), em(-meio, meiaAltura)])
    formas.push(forma)
    L.push(P(forma, { classe: 'tecido', fio: 'linho', rgb: d.pano.cor }, {
      eixo: d.giro,
      bisel: 1.6,
      ruga: 0.7,
      tom: 0.94 + 0.05 * k,
      contorno: 0.26,
      textura: texDoDobrado(d.pano, cx, cy, d.giro, meio),
      semente: 9250 + k,
      projeta: k > 0 ? { dist: 1.4, forca: 0.34 } : undefined,
    }))
  })
  cena.sombras.push(contato(formas.reduce(uniao), 0.34))
}

// ---------- a fita e a tesoura ----------

/** A fita de medir: o raio do rolo dela, a largura da fita e o passo das marcas (px do protótipo). */
const RAIO_DA_FITA = 2.9
const LARGURA_DA_FITA = 1.3
const PASSO_DAS_MARCAS = 1.25

/** As marcas da fita que sai de (ax, ay) no rumo `eixo`: um risco de través a cada passo, só de um lado, e um inteiro a cada cinco. */
function texDaFita(ax: number, ay: number, eixo: number): Textura {
  const co = Math.cos(eixo)
  const si = Math.sin(eixo)
  return (u, v, x, y, p, s, escala) => {
    if (tecido !== null) tecido(u, v, x, y, p, s, escala)
    if (escala < ESCALA_DO_DETALHE) return
    const ao = (x - ax) * co + (y - ay) * si
    const atraves = -(x - ax) * si + (y - ay) * co
    const k = Math.floor(ao / PASSO_DAS_MARCAS)
    const f = ao / PASSO_DAS_MARCAS - k
    if (f < 0.2 && atraves > (k % 5 === 0 ? -LARGURA_DA_FITA / 2 : 0)) misturarEm(s, TINTA, 0.8)
  }
}

/** A tesoura aberta: o eixo, as duas lâminas para um lado e as duas argolas para o outro (px do protótipo). */
const LAMINA = 7.4
const ABERTURA_DA_TESOURA = 0.2
const CABO_DA_TESOURA = 3.4

function montarTesoura(P: CriarPeca, L: Peca[], cx: number, cy: number, giro: number): void {
  const em = (ao: number, atraves: number): Ponto => [cx + ao * Math.cos(giro) - atraves * Math.sin(giro), cy + ao * Math.sin(giro) + atraves * Math.cos(giro)]
  const sombra = { dist: 0.7, forca: 0.36, suave: 0.5 }
  for (const lado of [-1, 1]) {
    const a = lado * ABERTURA_DA_TESOURA
    const ponta: Ponto = [LAMINA * Math.cos(a), LAMINA * Math.sin(a)]
    const largura = 0.75
    // A lâmina: larga no eixo, afinando até a ponta (um triângulo comprido de pontas cegas).
    const lamina = poligono([
      em(-0.6, -largura * lado * 0.2),
      em(-0.2, largura * lado),
      em(ponta[0], ponta[1] + lado * 0.15),
      em(ponta[0] - 0.3, ponta[1] - lado * 0.2),
    ])
    L.push(P(lamina, ACO, { bisel: 0.5, contorno: 0.3, metal: 0.55, semente: 9180 + lado, projeta: sombra }))
    // A haste até a argola, do outro lado do eixo, e a argola de latão.
    const [hx, hy] = em(-CABO_DA_TESOURA, lado * 1.7)
    const [ex, ey] = em(-0.4, lado * 0.3)
    L.push(P(barra(ex, ey, hx, hy, 0.8), ACO, { bisel: 0.35, contorno: 0.3, metal: 0.45, semente: 9182 + lado, projeta: sombra }))
    L.push(P(anel(hx, hy, 1.55, 1.55, 0.85, 0.85), LATAO, { bisel: 0.45, contorno: 0.3, metal: 0.5, semente: 9184 + lado, projeta: sombra }))
  }
  const [px, py] = em(0, 0)
  L.push(P(elipse(px, py, 0.55, 0.55), LATAO, { bisel: 0.4, contorno: 0.25, metal: 0.5, semente: 9186 }))
}

// ---------- o caixote com os rolos em pé ----------

/** Os vãos do caixote (2 x 2): quais têm rolo, de trás para a frente, da esquerda para a direita. O da frente à direita fica vazio. */
const VAOS_COM_ROLO: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
]
/** O cru não entra em pé: a frente da coluna, mais escura, o deixa cinzento como um cano. */
const PANOS_EM_PE: readonly Rgb[] = [VINHO, VERDE_MAR, MOSTARDA]

function montarCaixote(c: ContextoDoMovel, cena: Cena, L: Peca[]): void {
  const { hw, hh, g, peca: P } = c
  const x0 = CAIXOTE[0] * hw
  const y0 = CAIXOTE[1] * hh
  const x1 = CAIXOTE[2] * hw
  const y1 = CAIXOTE[3] * hh
  const zCaixote = g * ALTURA_DO_CAIXOTE
  cena.sombras.push(contato(caixa(x0, y0, x1, y1, 0.6), 0.32))
  // O fundo, escuro, no chão: só aparece entre os rolos e no vão vazio.
  L.push(P(caixa(x0 + RIPA / 2, y0 + RIPA / 2, x1 - RIPA / 2, y1 - RIPA / 2), BURACO, { bisel: 0, contorno: 0, semente: 9200 }))
  const dentro: Caixa = [x0 + RIPA, y0 + RIPA, x1 - RIPA, y1 - RIPA]
  const vaoW = (dentro[2] - dentro[0]) / 2
  const vaoH = (dentro[3] - dentro[1]) / 2
  const vao = (i: number, j: number): Caixa => [dentro[0] + i * vaoW, dentro[1] + j * vaoH, dentro[0] + (i + 1) * vaoW, dentro[1] + (j + 1) * vaoH]
  // O vão vazio: um tampo raso na altura da borda, sem sombra no chão, que na 3/4 vira o escuro de dentro do caixote.
  const [vx0, vy0, vx1, vy1] = vao(1, 1)
  const vazio = caixa(vx0 + 0.3, vy0 + 0.3, vx1 - 0.3, vy1 - 0.3, 0.6)
  cena.sombras.push({ forma: vazio, z: zCaixote, solta: true, forca: 0 })
  L.push(P(vazio, BURACO, { bisel: 0, contorno: 0, tom: 0.92, recesso: { k: 2.2, forca: 0.4 }, semente: 9201 }))
  // As quatro ripas, cada uma uma coluna da altura do caixote (ver o comentário do arquivo).
  const ripas: readonly (readonly [Forma, number])[] = [
    [caixa(x0, y0, x0 + RIPA, y1, 0.4), QUARTO],
    [caixa(x1 - RIPA, y0, x1, y1, 0.4), QUARTO],
    [caixa(x0 + RIPA - 0.2, y0, x1 - RIPA + 0.2, y0 + RIPA, 0.3), 0],
    [caixa(x0 + RIPA - 0.2, y1 - RIPA, x1 - RIPA + 0.2, y1, 0.3), 0],
  ]
  ripas.forEach(([forma, eixo], k) => {
    cena.sombras.push({ forma, z: zCaixote })
    L.push(P(forma, PINHO, { eixo, tabua: 0, bisel: 0.8, tom: 0.96 + 0.1 * hash(k, 9, 9211), contorno: 0.26, semente: 9210 + k, projeta: { dist: 0.9, forca: 0.26, suave: 0.6 } }))
  })
  for (const x of [x0 + RIPA / 2, x1 - RIPA / 2]) {
    for (const y of [y0 + RIPA / 2, y1 - RIPA / 2]) L.push(P(elipse(x, y, 0.42, 0.42), PREGO, { bisel: 0.4, contorno: 0, metal: 0.2 }))
  }
  // Os rolos em pé: de cima, a ponta inteira com a espiral; cada um uma coluna de pano.
  VAOS_COM_ROLO.forEach(([i, j], k) => {
    const [ax0, ay0, ax1, ay1] = vao(i, j)
    const r = Math.min(ax1 - ax0, ay1 - ay0) / 2 - 0.25
    const cx = (ax0 + ax1) / 2 + (hash(k, 1, 9221) - 0.5) * 0.5
    const cy = (ay0 + ay1) / 2 + (hash(k, 2, 9221) - 0.5) * 0.5
    const disco = elipse(cx, cy, r, r)
    const z = g * ALTURA_DOS_ROLOS_EM_PE[k % ALTURA_DOS_ROLOS_EM_PE.length]
    cena.sombras.push({ forma: disco, z, forca: 0.3 })
    const cor = PANOS_EM_PE[k % PANOS_EM_PE.length]
    L.push(P(disco, { classe: 'tecido', fio: 'la', rgb: cor }, {
      bisel: r * 0.34,
      tom: 1.02,
      contorno: 0.26,
      textura: texDaPonta(cx, cy, r, r, true),
      semente: 9230 + k,
      projeta: { dist: (z - zCaixote) * 0.16, forca: 0.32 },
    }))
  })
}

// ---------- a banca ----------

export const montarRolosDeTecido: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const L = cena.partes
  const mad = c.m.madeira
  const panoDaFrente = c.m.pano
  const tx0 = MESA[0] * hw
  const ty0 = MESA[1] * hh
  const tx1 = MESA[2] * hw
  const ty1 = MESA[3] * hh
  const zMesa = g * ALTURA_DA_MESA
  const r = RAIO_DO_ROLO * hh
  const xa = tx0 + FOLGA_DA_PILHA
  const xb = FIM_DA_PILHA * hw
  const noFundo = ty0 + FOLGA_DA_PILHA

  // O rolo desenrolado e o pano dele: a largura do pano é o corpo do rolo, sem as pontas.
  const ru = r * RAIO_DO_DESENROLADO
  const yDesenrolado = noFundo + LUGAR_DO_DESENROLADO * r
  const px0 = xa + r * 0.9
  const px1 = xb - r * 1.3
  const yFundoDoMonte = FUNDO_DO_MONTE * hh

  // O monte de pano no chão, primeiro: fica por baixo de tudo, na frente da mesa.
  const monte = poligono(contornoDoMonte(px0, px1, ty1 + 0.3, yFundoDoMonte))
  cena.sombras.push(contato(monte, 0.2))
  L.push(P(monte, panoDaFrente, { bisel: 1.6, ruga: 1.3, contorno: 0.24, textura: texDoMonte((px0 + px1) / 2, (px1 - px0) / 2, ty1 + 0.3, yFundoDoMonte, 9100), semente: 9100 }))
  // A aba virada do avesso no pé do monte, à esquerda: mais clara, e faz sombra no pano.
  const xAba = px0 - ABERTURA_DO_MONTE * 1.1
  L.push(P(poligono(ABA.map(([dx, dy]): Ponto => [xAba + dx, yFundoDoMonte + dy - 0.8])), panoDaFrente, { bisel: 1, ruga: 0.8, tom: TOM_DO_AVESSO, contorno: 0.26, semente: 9101, projeta: { dist: 1.2, forca: 0.34 } }))
  montarDobrados(c, cena, L)

  // A mesa baixa: o tampo solto de tábuas sobre quatro pés (só a 3/4 os mostra).
  const tampo = caixa(tx0, ty0, tx1, ty1, 0.8)
  cena.sombras.push({ forma: tampo, z: zMesa, solta: true, forca: 0.3 })
  for (const x of [tx0 + RECUO_DA_PERNA, tx1 - RECUO_DA_PERNA - LADO_DA_PERNA]) {
    for (const y of [ty0 + RECUO_DA_PERNA, ty1 - RECUO_DA_PERNA - LADO_DA_PERNA]) {
      const perna = caixa(x, y, x + LADO_DA_PERNA, y + LADO_DA_PERNA, 0.4)
      cena.sombras.push({ forma: perna, z: zMesa - g * BEIRADA }, contato(perna, 0.3))
    }
  }
  L.push(P(tampo, mad, { tabua: (ty1 - ty0) / 5, bisel: 1.1, contorno: 0.24, semente: 9110, projeta: { dist: 5.5, forca: 0.3, suave: 1.4 } }))

  // O pano corrido na mesa, do rolo desenrolado até a quina da frente.
  L.push(P(caixa(px0, yDesenrolado, px1, ty1 + 0.2, 0.3), panoDaFrente, { bisel: 0.6, ruga: 1.1, contorno: 0.2, tom: 1.04, semente: 9111 }))

  // A pilha, de baixo para cima.
  PILHA.forEach((rolo, k) => {
    const yc = noFundo + rolo.y * r
    const de = xa + rolo.recuoEsquerdo * r
    const ate = xb - rolo.recuoDireito * r
    const tom = TOM_DA_CAMADA[rolo.camada] * (0.97 + 0.06 * hash(k, 4, 9121))
    montarRolo(P, L, de, ate, yc, r, rolo.pano, tom, rolo.camada === 1, 9120 + k * 4)
  })
  // O rolo desenrolado, mais fino, na frente da pilha, do pano da frente.
  montarRolo(P, L, xa + r * 0.3, xb - r * 0.7, yDesenrolado, ru, pano(panoDaFrente.rgb), 1.02, false, 9150)

  // A dobra do pano na quina da frente: uma coluna estreita, que na 3/4 é o pano pendurado até o chão.
  const faixa = caixa(px0, ty1 - 0.6, px1, ty1 + 1.5, 0.5)
  cena.sombras.push({ forma: faixa, z: zMesa, forca: 0.24 })
  L.push(P(caixa(px0 - 0.1, ty1 - 0.3, px1 + 0.1, ty1 + 1.3, 0.6), panoDaFrente, { bisel: 0.7, contorno: 0.24, textura: texDaDobra(ty1 - 0.3, ty1 + 1.3), semente: 9160 }))

  // A fita de medir, enrolada na ponta da mesa, com a ponta atravessando a pilha até o rolo listrado.
  const xFerramentas = (xb + tx1) / 2
  const cxFita = xFerramentas + 0.4
  const cyFita = ty0 + RAIO_DA_FITA + 2.2
  const fimDaFita: Ponto = [xa + (xb - xa) * 0.52, noFundo + 3.4 * r]
  const eixoDaFita = Math.atan2(fimDaFita[1] - cyFita, fimDaFita[0] - cxFita)
  const fita = barra(cxFita, cyFita, fimDaFita[0], fimDaFita[1], LARGURA_DA_FITA)
  L.push(P(fita, FITA, { eixo: eixoDaFita, bisel: 0.3, contorno: 0.3, textura: texDaFita(cxFita, cyFita, eixoDaFita), semente: 9170, projeta: { dist: 0.8, forca: 0.32, suave: 0.5 } }))
  const ponteira = barra(fimDaFita[0] - Math.cos(eixoDaFita) * 0.9, fimDaFita[1] - Math.sin(eixoDaFita) * 0.9, fimDaFita[0] + Math.cos(eixoDaFita) * 0.4, fimDaFita[1] + Math.sin(eixoDaFita) * 0.4, LARGURA_DA_FITA + 0.3)
  L.push(P(ponteira, LATAO, { bisel: 0.3, contorno: 0.3, metal: 0.5, semente: 9171 }))
  L.push(P(elipse(cxFita, cyFita, RAIO_DA_FITA, RAIO_DA_FITA), FITA, { bisel: 1.1, contorno: 0.28, textura: texDaPonta(cxFita, cyFita, RAIO_DA_FITA, RAIO_DA_FITA, false), semente: 9172, projeta: { dist: 1, forca: 0.32 } }))
  L.push(P(elipse(cxFita, cyFita, 0.45, 0.45), { classe: 'liso', rgb: FURO }, { bisel: 0, contorno: 0 }))

  // A tesoura aberta, de pé na ponta da mesa, as lâminas para o fundo.
  montarTesoura(P, L, xFerramentas, ty1 - 6.2, -Math.PI / 2 - 0.32)

  montarCaixote(c, cena, L)
}
