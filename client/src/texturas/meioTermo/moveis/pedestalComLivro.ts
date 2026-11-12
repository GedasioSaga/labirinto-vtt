/**
 * PEDESTAL COM LIVRO ABERTO de cima com volume (lote 13 dos objetos novos,
 * 11/11/2026): o atril de pedra lavrada (o plinto em dois degraus, o fuste com
 * caneluras, o capitel e a tábua inclinada para o leitor, com o friso de
 * dentículos na frente e o ressalto que segura o livro) e, na tábua, um livro
 * grande e grosso aberto no meio: as folhas amareladas com linhas de uma
 * escrita inventada (só traços: nenhuma letra que se leia nem símbolo de
 * verdade) e um diagrama de órbitas, a capa de couro com cantoneiras de latão,
 * a fita marcadora caindo para a frente e a corrente que prende o livro ao
 * atril. Não é fonte de luz.
 *
 * As duas vistas são desenhadas cada uma no seu referencial:
 * - de cima, os degraus em volta da tábua, a tábua e o livro chato, com a
 *   sombra da tábua pintada nos degraus (`soNoLugar`: só são pintadas com
 *   `dy` zero, e a 3/4 os sobe);
 * - na 3/4, na TELA: os degraus, o fuste, o capitel, a tábua inclinada e o
 *   livro em pé para o leitor. A tábua inclinada fica mais alta na tela que de
 *   cima (a profundidade mais a subida da beira de trás), e o livro, as linhas
 *   e o diagrama esticam junto (`Vista`). Essas peças nascem deslocadas a
 *   altura da tábua, ancoradas nela, e só aparecem quando a 3/4 as sobe de volta
 *   ao lugar (a conta da prateleira de potes).
 *
 * As estruturas da 3/4 (`tresQuartos.ts`) ficam por baixo do desenho da tela e
 * dão o que ele não dá: a sombra no chão de cada parte, o contato e a ordem. Os
 * degraus são colunas cortadas em metade do norte e metade do sul (a conta do
 * altar), o fuste é uma coluna redonda e a tábua é um tampo solto na altura do
 * meio dela, com um FURO no meio da forma: o topo do fuste, que tem o meio da
 * caixa no furo, sobe com o fuste e lhe dá a pedra da frente. A tábua vai por
 * último (a caixa dela é esticada até o sul), e com ela tudo o que a tela mostra.
 * A sombra do fuste no chão cobre o furo da sombra da tábua (o chão fica com a
 * mais forte).
 *
 * Com o objeto girado, a 3/4 mostra as estruturas com as peças de cima subidas
 * (a cena girada passa à textura a peça de antes do giro): os degraus e o fuste
 * lisos e o livro chato na altura da tábua, sem a inclinação. É o mesmo limite
 * da bola de cristal e da prateleira de potes. A sombra da tábua pintada nos
 * degraus cai para o mesmo lado NA TELA (`desgirado`, a conta do altar).
 *
 * As medidas são frações da meia largura (o pedestal é quadrado); as alturas,
 * em casas no tamanho de partida, crescem e encolhem junto com a largura: o
 * pedestal esticado é o mesmo pedestal maior (com a altura fixa, a 1,5 casa o
 * fuste virava um toco gordo debaixo de uma tábua enorme). A pedra vem do
 * material escolhido (`pedra`); o couro, as folhas, a fita, o latão e o ferro
 * são fixos. Escreve `cena.corDoPiso`.
 */
import { hash, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, elipse, elipseGirada, menos, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { materialDaPeca, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas: frações da meia largura; as alturas em casas no tamanho de partida ----------

/** A meia largura do tamanho de partida (0,8 casa), em casas: a régua das alturas. */
const MEIA_DE_PARTIDA = 0.4

/** Os dois degraus do plinto: a meia largura e a altura do topo de cada um. */
const DEGRAU_DE_BAIXO = { meia: 0.7, altura: 0.07 }
const DEGRAU_DE_CIMA = { meia: 0.5, altura: 0.14 }
/** O arredondado das quinas da pedra (px). */
const QUINA = 0.4
/** O fuste: o raio e a altura do topo, debaixo da tábua. */
const RAIO_DO_FUSTE = 0.3
const ALTURA_DO_FUSTE = 0.54
/** O toro da base do fuste e o capitel: o raio em raios do fuste e a altura em px. */
const TORO = { raio: 1.2, altura: 1.8 }
const CAPITEL = { raio: 1.25, altura: 3.2 }
/** Quanto do capitel aparece embaixo da frente da tábua, na 3/4 (px). */
const CAPITEL_A_MOSTRA = 5.6
/** As caneluras do fuste (o padrão dá metade disto de sulcos na meia volta que se vê) e a sombra da tábua no alto dele. */
const CANELURAS = 10
const SOMBRA_DA_TABUA_NO_FUSTE = { forca: 0.3, alcance: 6 }

/**
 * A tábua: a meia largura, a beira do norte e a do sul (frações da meia
 * largura) e a altura da beira baixa (sul) e da alta (norte), em casas.
 */
const TABUA = { meia: 0.9, norte: -0.48, sul: 0.42, baixa: 0.68, alta: 0.84 }
/** A frente da tábua na 3/4 (px) e o friso de dentículos nela. */
const FRENTE_DA_TABUA = 3.4
const DENTICULOS = 14
/** O ressalto que segura o livro na beira de baixo da tábua: a largura e a altura (px). */
const RESSALTO = { largura: 1.3, altura: 1 }
/** O furo no meio da forma da tábua (px): o que tem o meio da caixa nele sobe com o fuste. */
const FURO = 2.2
/** O y da tábua (px) em que se ancora a peça cujo meio cairia no furo. */
const FORA_DO_FURO = -6
/** A sombra da tábua pintada nos degraus: o alfa e o borrão. */
const SOMBRA_NOS_DEGRAUS = { alfa: 0.3, suave: 1.3 }

/**
 * O livro: a meia largura da capa (fração da meia largura) e, em px, a folga
 * da capa até o norte da tábua, o recuo das folhas, a beira da capa nos lados,
 * o corte das folhas e a meia lombada.
 */
const LIVRO = { meia: 0.84, folgaNorte: 1, recuo: 0.75, beira: 1.9, corte: 1.1, lombada: 0.3 }
/** As folhas: a altura do bloco no alto do arco (px), o que sobra dela no vale e até onde a curva sobe (fração da folha). */
const ALTURA_DAS_FOLHAS = 3.2
const VALE_DAS_FOLHAS = 0.42
const SUBIDA_DAS_FOLHAS = 0.42
/** Quantos pontos tem a beira curva de cada folha na 3/4. */
const PONTOS_DA_FOLHA = 10
/** A luz da curva das folhas e a sombra do vale da lombada (até que fração da folha). */
const LUZ_DA_CURVA = 0.9
const SOMBRA_DO_VALE = 0.32
const VALE = 0.1
/** As cantoneiras de latão nas quinas da capa e a capitular (o quadrado sem letra no alto da página da esquerda), em px. */
const CANTONEIRA = 2.4
const CAPITULAR = 2.2
/** A sombra do livro na tábua (px). */
const SOMBRA_DO_LIVRO = { x: 0.9, y: 0.7, alfa: 0.3 }

/** A escrita inventada: a margem, o passo e o traço da linha, o comprimento de uma "palavra", a chance de espaço e a força da tinta. */
const MARGEM = 1.2
const PASSO_DA_LINHA = 1.7
const TRACO_DA_LINHA = 0.46
/** A haste que sobe da linha de vez em quando (a escrita parece mão, e não tracejado): a chance, a altura e a largura (px). */
const HASTE = { chance: 0.2, altura: 0.5, largura: 0.42 }
const PALAVRA = 1.4
const ESPACOS = 0.18
const FORCA_DA_TINTA = 0.62
/** A linha que acaba antes (o fim do parágrafo): a chance. */
const FIM_DE_PARAGRAFO = 0.28

/**
 * O diagrama de órbitas na página da direita: o meio (frações da página), os
 * raios das órbitas, o traço, o miolo e os astros (a órbita e o ângulo), em px
 * da tela da 3/4 (de cima ele sai achatado, como a folha inclinada vista do alto).
 */
const DIAGRAMA = {
  u: 0.5,
  v: 0.64,
  orbitas: [3.6, 2.1],
  traco: 0.34,
  miolo: 0.7,
  astro: 0.5,
  astros: [[3.6, 0.5], [3.6, 2.7], [3.6, 4.3], [2.1, 1.7], [2.1, 4.9]],
} as const

/** A fita marcadora: a meia largura e o quanto a ponta desce abaixo da frente da tábua, na 3/4 (px). */
const FITA_LARGA = 0.55
const PONTA_DA_FITA = 5.5
/** Os elos da corrente: o passo e as meias medidas (o elo de frente e o de lado). */
const PASSO_DO_ELO = 0.92
const ELO = { comprido: 0.62, largo: 0.38, fino: 0.2 }

const SEMENTE = 7400

// ---------- os materiais (o couro, as folhas, a fita e os metais são fixos) ----------

/** O couro da capa: castanho de sangue de boi, velho. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x38, 0x30] }
/** As folhas amareladas e o corte delas (o bloco visto de lado). */
const FOLHA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd4, 0xae] }
const CORTE: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0xb8, 0x92] }
/** A moldura da capitular. */
const OCRE: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xa4, 0x66] }
const FITA = materialDaPeca('vinho')
const LATAO = materialDaPeca('latao')
const FERRO = materialDaPeca('ferro')
/** As sombras pintadas (a da tábua nos degraus e a do livro na tábua). */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1e, 0x18, 0x16] }
/** A tinta sépia da escrita e do diagrama. */
const TINTA: Rgb = [0x4e, 0x3e, 0x36]
/** O escuro em que o pixel escuro demais é levantado: o da pedra do altar. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

// ---------- as contas de lugar ----------

/** As medidas do pedestal em px do protótipo. */
interface Medidas {
  readonly p1: number
  readonly z1: number
  readonly p2: number
  readonly z2: number
  readonly rS: number
  readonly zS: number
  readonly t: Tabua
}

/** A tábua em px: as beiras, as alturas, a do meio (a da estrutura) e a inclinação. */
interface Tabua {
  readonly bw: number
  readonly yN: number
  readonly yS: number
  readonly zBaixa: number
  readonly z: number
  /** Quanto a tábua sobe por px de profundidade, para o norte. */
  readonly k: number
  /** Quanto uma altura acima da tábua sobe na tela da 3/4, por px. */
  readonly alto: number
}

function medirTabua(m: number, g: number): Tabua {
  const yN = TABUA.norte * m
  const yS = TABUA.sul * m
  const zBaixa = TABUA.baixa * g
  const zAlta = TABUA.alta * g
  const k = (zAlta - zBaixa) / (yS - yN)
  const inclinacao = Math.atan(k)
  return { bw: TABUA.meia * m, yN, yS, zBaixa, z: (zBaixa + zAlta) / 2, k, alto: Math.cos(inclinacao) - Math.sin(inclinacao) }
}

/**
 * A mesma forma com a caixa de pintura centrada em (mx, my): o desenho não
 * muda (fora da forma nada pinta), mas o meio da caixa, que é o que a 3/4 lê
 * para saber com que estrutura a peça sobe, cai onde se quer.
 */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** A mesma forma com a caixa esticada para o sul até `sul`: a 3/4 pinta as estruturas do norte para o sul pela base da caixa. */
function naOrdemDaFrente(forma: Forma, sul: number): Forma {
  return { b: [forma.b[0], forma.b[1], forma.b[2], sul], d: (x, y) => forma.d(x, y) }
}

/**
 * A peça só é pintada NO LUGAR em que foi desenhada (`dy` zero): a da 3/4
 * nasce deslocada a altura da tábua e aparece quando a 3/4 a sobe de volta; a
 * de cima, que a 3/4 sobe, some lá.
 */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** Mistura `cor` na cor do ponto com o peso `k` (0 a 1). */
function misturar(s: Float32Array, cor: Rgb, k: number): void {
  s[0] += (cor[0] - s[0]) * k
  s[1] += (cor[1] - s[1]) * k
  s[2] += (cor[2] - s[2]) * k
}

/** A cobertura de um traço de meia grossura `meia` a `d` px do meio dele, com meio pixel da imagem de borda. */
function faixa(d: number, meia: number, escala: number): number {
  return Math.min(1, Math.max(0, (meia - d) * escala + 0.5))
}

/**
 * A vista em que o livro e a tábua são desenhados: de cima (o y da tábua é o
 * da tela) ou a 3/4 (o y da tábua estica com a subida dela e desce a altura).
 * `por` cria a peça da vista: ancorada na tábua, nascida no deslocamento certo
 * e pintada só nela.
 */
interface Vista {
  readonly tres: boolean
  readonly y: (y: number) => number
  readonly daTela: (y: number) => number
  readonly estica: number
  readonly alto: number
  readonly por: (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => Peca
}

function criarVista(P: CriarPeca, t: Tabua, tres: boolean): Vista {
  const estica = tres ? 1 + t.k : 1
  const desce = tres ? t.zBaixa + t.yS * t.k : 0
  const dy = tres ? t.z : 0
  // O meio da caixa, com o deslocamento de nascença, cai num ponto da tábua fora do furo: a peça sobe com a tábua.
  const ancorar = (f: Forma): Forma => {
    const cx = (f.b[0] + f.b[2]) / 2
    const cy = (f.b[1] + f.b[3]) / 2 + dy
    const ax = Math.min(t.bw - 1, Math.max(1 - t.bw, cx))
    const naTabua = Math.min(t.yS - 1, Math.max(t.yN + 1, cy))
    const ay = Math.hypot(ax, naTabua) < FURO + 1 ? FORA_DO_FURO : naTabua
    return ax === cx && ay === cy ? f : comMeioEm(f, ax, ay - dy)
  }
  return {
    tres,
    estica,
    alto: tres ? t.alto : 0,
    y: (y) => y * estica - desce,
    daTela: (y) => (y + desce) / estica,
    por: (forma, mat, o) => P(ancorar(forma), mat, { ...o, dy, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }),
  }
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de
 * volta que a 3/4 pinta (`giro`, em graus): a conta do altar (`altar.ts`).
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/**
 * A sombra da tábua no topo de um degrau de meia largura `p` e altura `z`, no
 * chão (a caixa já cortada no degrau). Com o objeto girado ela cai para o
 * mesmo lado NA TELA (`giro`; o desenho da tela passa 0).
 */
function sombraDaTabua(t: Tabua, z: number, p: number, giro: number): Caixa {
  const [ox, oy] = desgirado(SOMBRA_X * (t.z - z), SOMBRA_Y * (t.z - z), giro)
  return [Math.max(-p, ox - t.bw), Math.max(-p, t.yN + oy), Math.min(p, t.bw + ox), Math.min(p, t.yS + oy)]
}

// ---------- as folhas ----------

/** Uma folha aberta: as beiras (px da tábua) e o lado (-1 a da esquerda, 1 a da direita). */
interface Folha {
  readonly x0: number
  readonly x1: number
  readonly yt: number
  readonly yb: number
  readonly lado: number
}

/** A altura da folha acima da capa: baixa no vale da lombada, sobe e cai um pouco na beira de fora. */
function arcoDaFolha(u: number): number {
  const sobe = Math.sin((Math.min(1, u / SUBIDA_DAS_FOLHAS) * Math.PI) / 2)
  const cai = u > 0.9 ? 1 - 0.3 * ((u - 0.9) / 0.1) ** 2 : 1
  return ALTURA_DAS_FOLHAS * (VALE_DAS_FOLHAS + (1 - VALE_DAS_FOLHAS) * sobe) * cai
}

/** Onde `x` cai na folha: 0 na lombada, 1 na beira de fora. */
function uDaFolha(f: Folha, x: number): number {
  const t = (x - f.x0) / (f.x1 - f.x0)
  return Math.min(1, Math.max(0, f.lado < 0 ? 1 - t : t))
}

/** A folha na vista: na 3/4 a beira de cima e a de baixo sobem com o arco. */
function contornoDaFolha(v: Vista, f: Folha): Forma {
  const cima: Ponto[] = []
  const baixo: Ponto[] = []
  for (let i = 0; i <= PONTOS_DA_FOLHA; i += 1) {
    const x = f.x0 + ((f.x1 - f.x0) * i) / PONTOS_DA_FOLHA
    const sobe = v.alto * arcoDaFolha(uDaFolha(f, x))
    cima.push([x, v.y(f.yt) - sobe])
    baixo.push([x, v.y(f.yb) - sobe])
  }
  return poligono([...cima, ...baixo.reverse()])
}

/** A frente do bloco de folhas na 3/4: da beira de baixo da folha, subida, até a capa. */
function frenteDoBloco(v: Vista, f: Folha): Forma {
  const cima: Ponto[] = []
  for (let i = 0; i <= PONTOS_DA_FOLHA; i += 1) {
    const x = f.x0 + ((f.x1 - f.x0) * i) / PONTOS_DA_FOLHA
    cima.push([x, v.y(f.yb) - v.alto * arcoDaFolha(uDaFolha(f, x))])
  }
  return poligono([...cima, [f.x1, v.y(f.yb) + 0.35], [f.x0, v.y(f.yb) + 0.35]])
}

/** O diagrama de órbitas em volta do meio, com (dx, dy) em px da tela da 3/4. */
function tintaDoDiagrama(dx: number, dy: number, escala: number): number {
  const r = Math.hypot(dx, dy)
  let tinta = faixa(r, DIAGRAMA.miolo, escala)
  for (const orbita of DIAGRAMA.orbitas) tinta = Math.max(tinta, faixa(Math.abs(r - orbita), DIAGRAMA.traco / 2, escala))
  for (const [raio, ang] of DIAGRAMA.astros) {
    tinta = Math.max(tinta, faixa(Math.hypot(dx - raio * Math.cos(ang), dy - raio * Math.sin(ang)), DIAGRAMA.astro, escala))
  }
  return tinta
}

/**
 * A folha, ponto a ponto: a luz da curva (a folha da direita sobe da lombada
 * de frente para a luz, a da esquerda de costas), a sombra do vale e a tinta:
 * linhas de "palavras" sem letra, que acabam antes no fim do parágrafo, e o
 * diagrama na da direita. As contas são no referencial da tábua: na 3/4 o
 * ponto da tela volta para ela (`daTela`), descontada a subida do arco.
 */
function texDaFolha(v: Vista, f: Folha, comDiagrama: boolean, capitular: Caixa | null, redondo: number): Textura {
  const largura = f.x1 - f.x0
  const dentro0 = f.x0 + MARGEM
  const dentro1 = f.x1 - MARGEM
  const topo = f.yt + MARGEM
  const pe = f.yb - MARGEM
  const dcx = f.x0 + largura * DIAGRAMA.u
  const dcy = f.yt + (f.yb - f.yt) * DIAGRAMA.v
  const meiaAlturaDoDiagrama = (DIAGRAMA.orbitas[0] + DIAGRAMA.astro) / redondo + PASSO_DA_LINHA * 0.4
  const semente = SEMENTE + (f.lado < 0 ? 300 : 400)
  return (_u, _v, x, y, _p, s, escala) => {
    const u = uDaFolha(f, x)
    const by = v.daTela(y + v.alto * arcoDaFolha(u))
    const inclina = (arcoDaFolha(Math.min(1, u + 0.02)) - arcoDaFolha(Math.max(0, u - 0.02))) / (0.04 * largura)
    s[3] += LUZ_DA_CURVA * inclina * f.lado
    if (u < VALE) s[3] -= SOMBRA_DO_VALE * (1 - u / VALE) ** 2
    let tinta = 0
    if (comDiagrama && Math.abs(by - dcy) < meiaAlturaDoDiagrama) {
      tinta = tintaDoDiagrama(x - dcx, (by - dcy) * redondo, escala)
    } else if (x > dentro0 && x < dentro1 && by > topo && by < pe) {
      const k = Math.floor((by - topo) / PASSO_DA_LINHA)
      const meio = topo + (k + 0.5) * PASSO_DA_LINHA
      const d = Math.abs(by - meio) * v.estica
      const meia = (TRACO_DA_LINHA * v.estica) / 2
      const fim = hash(k, 3, semente) < FIM_DE_PARAGRAFO ? dentro1 - (dentro1 - dentro0) * (0.25 + 0.45 * hash(k, 4, semente)) : dentro1
      const naCapitular = capitular !== null && x < capitular[2] + 0.6 && meio < capitular[3] + 0.4
      // Duas grades de "palavra" de passos diferentes: os espaços caem desencontrados e as palavras variam de tamanho.
      const espaco =
        hash(Math.floor((x - dentro0) / PALAVRA), k, semente) < ESPACOS ||
        hash(Math.floor((x - dentro0 + 0.47) / (PALAVRA * 0.63)), k + 31, semente) < ESPACOS * 0.35
      const haste = by < meio && hash(Math.floor((x - dentro0) / HASTE.largura), k + 77, semente) < HASTE.chance
      const dDoTraco = haste ? Math.max(0, d - HASTE.altura * v.estica) : d
      if (dDoTraco < meia + 0.5 && meio + TRACO_DA_LINHA < pe && x < fim && !naCapitular && !espaco) {
        tinta = faixa(dDoTraco, meia, escala) * (0.55 + 0.45 * Math.abs(Math.sin(x * 5.3 + k * 2.1)))
      }
    }
    if (tinta > 0) misturar(s, TINTA, tinta * FORCA_DA_TINTA)
  }
}

/** O fuste: o lado da luz mais claro, as caneluras e a sombra da tábua no alto dele (y da tela). */
function texDoFuste(r: number, yDaSombra: number, pedra: MaterialDaPeca): Textura {
  const base = texturaDaClasse(pedra.classe)
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    const q = Math.max(-1, Math.min(1, x / r))
    const angulo = Math.asin(q)
    s[3] += -0.2 * q - 0.1 * q * q
    const canelura = Math.cos(angulo * CANELURAS)
    if (canelura > 0.5) s[3] -= ((canelura - 0.5) / 0.5) * 0.22 * Math.cos(angulo)
    else if (canelura < -0.7) s[3] += 0.06
    const abaixo = y - yDaSombra
    if (abaixo < SOMBRA_DA_TABUA_NO_FUSTE.alcance) s[3] -= SOMBRA_DA_TABUA_NO_FUSTE.forca * (1 - Math.max(0, abaixo) / SOMBRA_DA_TABUA_NO_FUSTE.alcance)
  }
}

// ---------- as partes ----------

/** De cima: as metades dos degraus (a emenda fica debaixo da tábua), a sombra da tábua neles e o topo do fuste. */
function pedestalDeCima(L: Peca[], P: CriarPeca, pedra: MaterialDaPeca, med: Medidas, giro: number): void {
  const { p1, z1, p2, z2, rS, t } = med
  const pedraDeCima = soNoLugar(texturaDaClasse(pedra.classe))
  const sombraDeCima = soNoLugar(null)
  const degrau = { bisel: 0.8, contorno: 0.3, textura: pedraDeCima }
  const pintarSombra = (z: number, p: number, my: number, semente: number): void => {
    const [x0, y0, x1, y1] = sombraDaTabua(t, z, p, giro)
    const f = caixa(x0, y0, x1, y1, 1)
    L.push(P(comMeioEm(f, (x0 + x1) / 2, my), SOMBRA, { bisel: 0, contorno: 0, alfa: SOMBRA_NOS_DEGRAUS.alfa, suave: SOMBRA_NOS_DEGRAUS.suave, textura: sombraDeCima, semente }))
  }
  // Cada metade é ancorada na faixa dela que fica fora da tábua e do degrau de cima.
  const fora1 = (p1 + p2) / 2
  L.push(P(comMeioEm(caixa(-p1, -p1, p1, 0, QUINA), 0, -fora1), pedra, { ...degrau, tom: 0.92, semente: SEMENTE + 1 }))
  L.push(P(comMeioEm(caixa(-p1, 0, p1, p1, QUINA), 0, fora1), pedra, { ...degrau, tom: 0.92, semente: SEMENTE + 2 }))
  pintarSombra(z1, p1, fora1, SEMENTE + 3)
  L.push(P(comMeioEm(caixa(-p2, -p2, p2, 0, QUINA), 0, (t.yN - p2) / 2), pedra, { ...degrau, tom: 1, semente: SEMENTE + 4 }))
  L.push(P(comMeioEm(caixa(-p2, 0, p2, p2, QUINA), 0, (t.yS + p2) / 2), pedra, { ...degrau, tom: 1, semente: SEMENTE + 5 }))
  pintarSombra(z2, p2, (t.yS + p2) / 2, SEMENTE + 6)
  // O topo do fuste, debaixo da tábua: o meio dele cai no furo, então ele sobe com o fuste e lhe dá a pedra.
  L.push(P(elipse(0, 0, rS, rS), pedra, { bisel: 1, contorno: 0.3, textura: pedraDeCima, semente: SEMENTE + 7 }))
}

/** Na 3/4: os degraus com a sombra da tábua, o toro, o fuste e o capitel (coordenadas da tela). */
function pedestalNaTela(L: Peca[], v: Vista, pedra: MaterialDaPeca, med: Medidas): void {
  const { p1, z1, p2, z2, rS, t } = med
  const pintarSombra = (z: number, p: number, semente: number): void => {
    const [x0, y0, x1, y1] = sombraDaTabua(t, z, p, 0)
    L.push(v.por(caixa(x0, y0 - z, x1, y1 - z, 1), SOMBRA, { bisel: 0, contorno: 0, alfa: SOMBRA_NOS_DEGRAUS.alfa, suave: SOMBRA_NOS_DEGRAUS.suave, semente }))
  }
  L.push(v.por(caixa(-p1, -p1 - z1, p1, p1 - z1, QUINA), pedra, { bisel: 0.8, contorno: 0.3, tom: 0.96, semente: SEMENTE + 40 }))
  L.push(v.por(caixa(-p1, p1 - z1 - 0.3, p1, p1, QUINA), pedra, { bisel: 0.5, contorno: 0.3, tom: 0.72, eixo: 0, semente: SEMENTE + 41 }))
  pintarSombra(z1, p1, SEMENTE + 42)
  L.push(v.por(caixa(-p2, -p2 - z2, p2, p2 - z2, QUINA), pedra, { bisel: 0.8, contorno: 0.3, tom: 1.02, semente: SEMENTE + 43 }))
  L.push(v.por(caixa(-p2, p2 - z2 - 0.3, p2, p2, QUINA), pedra, { bisel: 0.5, contorno: 0.3, tom: 0.74, eixo: 0, semente: SEMENTE + 44 }))
  pintarSombra(z2, p2, SEMENTE + 45)
  // O toro na base; o fuste, que sobe de dentro do toro até dentro do capitel; e o capitel com o topo dele.
  const rT = TORO.raio * rS
  const rC = CAPITEL.raio * rS
  const yOmbro = v.y(t.yS) + FRENTE_DA_TABUA
  const zCapitel = rC - yOmbro - CAPITEL_A_MOSTRA
  L.push(v.por(capsula(0, -z2, 0, -z2 - TORO.altura, rT), pedra, { bisel: rT * 0.35, contorno: 0.3, tom: 0.9, eixo: QUARTO, semente: SEMENTE + 46 }))
  L.push(v.por(capsula(0, -z2 - TORO.altura, 0, -zCapitel - 1, rS), pedra, { bisel: rS * 0.4, contorno: 0.3, eixo: QUARTO, textura: texDoFuste(rS, rC - zCapitel, pedra), semente: SEMENTE + 47 }))
  L.push(v.por(capsula(0, -zCapitel, 0, -zCapitel - CAPITEL.altura, rC), pedra, { bisel: rC * 0.3, contorno: 0.3, tom: 0.8, eixo: QUARTO, semente: SEMENTE + 48 }))
  L.push(v.por(elipse(0, -zCapitel - CAPITEL.altura, rC, rC), pedra, { bisel: 0.8, contorno: 0.26, tom: 0.98, semente: SEMENTE + 49 }))
}

/** Os elos da corrente ao longo de `pontos`, um de frente e um de lado. */
function corrente(L: Peca[], v: Vista, pontos: readonly Ponto[], semente: number): void {
  let i = 0
  let sobra = 0
  for (let n = 1; n < pontos.length; n += 1) {
    const [ax, ay] = pontos[n - 1]
    const [bx, by] = pontos[n]
    const comprimento = Math.hypot(bx - ax, by - ay)
    if (sobra >= comprimento) {
      sobra -= comprimento
      continue
    }
    const angulo = Math.atan2(by - ay, bx - ax)
    for (let d = sobra; d < comprimento; d += PASSO_DO_ELO) {
      const x = ax + ((bx - ax) * d) / comprimento
      const y = ay + ((by - ay) * d) / comprimento
      L.push(v.por(elipseGirada(x, y, ELO.comprido, i % 2 === 0 ? ELO.largo : ELO.fino, angulo), FERRO, { bisel: 0.25, contorno: 0.34, metal: 0.5, semente: semente + i }))
      i += 1
      sobra = d + PASSO_DO_ELO - comprimento
    }
  }
}

/** O livro aberto na tábua: a sombra, a capa, o bloco, as folhas escritas, a capitular e as cantoneiras. */
function livro(L: Peca[], v: Vista, t: Tabua, m: number): void {
  const Y = v.y
  const xc = LIVRO.meia * m
  const ytC = t.yN + LIVRO.folgaNorte
  const ybC = t.yS - RESSALTO.largura
  const yt = ytC + LIVRO.recuo
  const yb = ybC - LIVRO.recuo
  const xf = xc - LIVRO.beira
  const xb = xf + LIVRO.corte
  const { x: sx, y: sy, alfa } = SOMBRA_DO_LIVRO
  L.push(v.por(caixa(sx - xc, Y(ytC) + sy, xc + sx, Y(ybC) + sy, 0.6), SOMBRA, { bisel: 0, contorno: 0, alfa, suave: 0.9, semente: SEMENTE + 60 }))
  L.push(v.por(caixa(-xc, Y(ytC), xc, Y(ybC), 0.5), COURO, { bisel: 0.6, contorno: 0.34, ruga: 0.4, semente: SEMENTE + 61 }))
  if (v.tres) L.push(v.por(caixa(-xc, Y(ybC) - 0.3, xc, Y(ybC) + 0.7, 0.3), COURO, { bisel: 0.3, contorno: 0.3, tom: 0.7, semente: SEMENTE + 62 }))
  L.push(v.por(caixa(-xb, Y(yt - 0.45), xb, Y(yb + 0.45), 0.3), CORTE, { bisel: 0.3, contorno: 0.22, tom: 0.94, semente: SEMENTE + 63 }))
  const capitular: Caixa = [MARGEM - xf, yt + MARGEM, MARGEM - xf + CAPITULAR, yt + MARGEM + CAPITULAR]
  for (const lado of [-1, 1]) {
    const f: Folha = { x0: lado < 0 ? -xf : LIVRO.lombada, x1: lado < 0 ? -LIVRO.lombada : xf, yt, yb, lado }
    if (v.tres) L.push(v.por(frenteDoBloco(v, f), CORTE, { bisel: 0, contorno: 0.2, tom: 0.86, semente: SEMENTE + 64 }))
    const textura = texDaFolha(v, f, lado > 0, lado < 0 ? capitular : null, 1 + t.k)
    L.push(v.por(contornoDaFolha(v, f), FOLHA, { bisel: 0.25, contorno: 0.16, textura, semente: SEMENTE + 66 + lado }))
    if (lado < 0) {
      // A capitular: o quadrado de ocre com o miolo de vinho, sem letra, subido com a folha.
      const sobe = v.alto * arcoDaFolha(uDaFolha(f, (capitular[0] + capitular[2]) / 2))
      L.push(v.por(caixa(capitular[0], Y(capitular[1]) - sobe, capitular[2], Y(capitular[3]) - sobe, 0.2), OCRE, { bisel: 0.2, contorno: 0.24, semente: SEMENTE + 68 }))
      L.push(v.por(caixa(capitular[0] + 0.45, Y(capitular[1] + 0.45) - sobe, capitular[2] - 0.45, Y(capitular[3] - 0.45) - sobe, 0.2), FITA, { bisel: 0, contorno: 0, semente: SEMENTE + 69 }))
    }
  }
  // As cantoneiras de latão nas quatro quinas de fora da capa.
  for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = qx * xc
    const yq = qy < 0 ? ytC : ybC
    L.push(v.por(poligono([[x, Y(yq)], [x - qx * CANTONEIRA, Y(yq)], [x, Y(yq - qy * CANTONEIRA)]]), LATAO, { bisel: 0.4, contorno: 0.3, metal: 0.6, semente: SEMENTE + 70 }))
  }
}

/** A tábua (de cima, chata; na 3/4, inclinada, com a frente e os dentículos), o livro, o ressalto, a fita e a corrente. */
function tabuaELivro(L: Peca[], v: Vista, pedra: MaterialDaPeca, t: Tabua, m: number): void {
  const Y = v.y
  const yF = Y(t.yS)
  const yR = t.yS - RESSALTO.largura
  if (v.tres) {
    L.push(v.por(caixa(-t.bw, Y(t.yN), t.bw, yF + 0.3, 0.6), pedra, { bisel: 0.9, contorno: 0.32, tom: 0.92, semente: SEMENTE + 80 }))
    L.push(v.por(caixa(-t.bw, yF - 0.2, t.bw, yF + FRENTE_DA_TABUA, 0.4), pedra, { bisel: 0.5, contorno: 0.32, tom: 0.72, eixo: 0, semente: SEMENTE + 81 }))
    const passo = (2 * t.bw - 2.2) / DENTICULOS
    for (let i = 0; i < DENTICULOS; i += 1) {
      const x0 = 1.1 - t.bw + (i + 0.2) * passo
      L.push(v.por(caixa(x0, yF + 1.2, x0 + passo * 0.6, yF + FRENTE_DA_TABUA - 0.5, 0.2), pedra, { bisel: 0.3, contorno: 0.16, tom: 0.9, semente: SEMENTE + 82 }))
    }
  } else {
    L.push(v.por(caixa(-t.bw, t.yN, t.bw, t.yS, 0.6), pedra, { bisel: 0.9, contorno: 0.32, tom: 0.88, semente: SEMENTE + 80 }))
  }
  livro(L, v, t, m)
  // O ressalto na beira de baixo: o topo e, na 3/4, a frente dele por cima do pé do livro.
  if (v.tres) {
    L.push(v.por(caixa(0.5 - t.bw, Y(yR) - RESSALTO.altura, t.bw - 0.5, yF - RESSALTO.altura + 0.3, 0.3), pedra, { bisel: 0.4, contorno: 0.3, tom: 1.04, semente: SEMENTE + 83 }))
    L.push(v.por(caixa(0.5 - t.bw, yF - RESSALTO.altura, t.bw - 0.5, yF + 0.2, 0.3), pedra, { bisel: 0.3, contorno: 0.3, tom: 0.8, eixo: 0, semente: SEMENTE + 84 }))
  } else {
    L.push(v.por(caixa(0.5 - t.bw, yR, t.bw - 0.5, t.yS, 0.3), pedra, { bisel: 0.4, contorno: 0.3, tom: 1.04, semente: SEMENTE + 83 }))
  }
  // A fita: sai da lombada perto do pé, passa o ressalto e (na 3/4) cai pela frente da tábua, de ponta em rabo de andorinha.
  const xc = LIVRO.meia * m
  const yb = yR - LIVRO.recuo
  const naLombada = v.alto * arcoDaFolha(0.05)
  if (v.tres) {
    const fundo = yF + FRENTE_DA_TABUA + PONTA_DA_FITA
    L.push(v.por(cadeia([[0.7, Y(yb - 2.6) - naLombada], [0.95, Y(yb) - naLombada], [1.15, Y(yR) - RESSALTO.altura], [1.3, yF + 0.3], [1.4, fundo]], FITA_LARGA), FITA, { bisel: 0.3, contorno: 0.3, semente: SEMENTE + 85 }))
    L.push(v.por(poligono([[1.4 - FITA_LARGA, fundo], [1.4 + FITA_LARGA, fundo], [1.4 + FITA_LARGA, fundo + 1.6], [1.4, fundo + 0.8], [1.4 - FITA_LARGA, fundo + 1.6]]), FITA, { bisel: 0.2, contorno: 0.3, semente: SEMENTE + 86 }))
  } else {
    L.push(v.por(capsula(0.7, yb - 2.6, 1.3, t.yS + 0.5, FITA_LARGA), FITA, { bisel: 0.3, contorno: 0.3, semente: SEMENTE + 85 }))
  }
  // A corrente: da argola na beira da capa da esquerda, por cima da beira da tábua, pendurada em laço até o olhal na frente.
  const yArgola = t.yN + LIVRO.folgaNorte + 0.68 * (yR - t.yN - LIVRO.folgaNorte)
  const lado = -t.bw
  const caminho: readonly Ponto[] = v.tres
    ? [[-xc, Y(yArgola)], [lado - 0.4, Y(yArgola) + 0.3], [lado - 0.85, Y(yArgola) + 7], [lado - 0.7, yF + FRENTE_DA_TABUA + 1], [lado + 0.9, yF + FRENTE_DA_TABUA + 3.6], [lado + 2.7, yF + FRENTE_DA_TABUA + 2.6], [lado + 3.2, yF + 1.8]]
    : [[-xc, yArgola], [lado - 0.4, yArgola + 0.3], [lado - 1, yArgola + 3.2], [lado - 0.5, t.yS + 0.6], [lado + 1.6, t.yS + 1.2], [lado + 2.8, t.yS + 0.3]]
  L.push(v.por(elipse(-xc - 0.2, Y(yArgola), 0.75, 0.75), LATAO, { bisel: 0.3, contorno: 0.3, metal: 0.6, semente: SEMENTE + 87 }))
  corrente(L, v, caminho, SEMENTE + 100)
  if (v.tres) L.push(v.por(elipse(lado + 3.2, yF + 1.5, 0.8, 0.8), FERRO, { bisel: 0.3, contorno: 0.34, metal: 0.5, semente: SEMENTE + 88 }))
}

// ---------- o pedestal ----------

export const montarPedestalComLivro: MontarMovel = (c, cena) => {
  const P = c.peca
  const m = Math.min(c.hw, c.hh)
  const pedra = c.m.pedra
  cena.corDoPiso = ESCURO_DA_PEDRA
  // A casa das alturas: a casa de verdade no tamanho de partida, maior ou menor com a largura.
  const gz = m / MEIA_DE_PARTIDA
  const t = medirTabua(m, gz)
  const med: Medidas = {
    p1: DEGRAU_DE_BAIXO.meia * m,
    z1: DEGRAU_DE_BAIXO.altura * gz,
    p2: DEGRAU_DE_CIMA.meia * m,
    z2: DEGRAU_DE_CIMA.altura * gz,
    rS: RAIO_DO_FUSTE * m,
    zS: ALTURA_DO_FUSTE * gz,
    t,
  }
  const { p1, z1, p2, z2, rS, zS } = med
  // Os degraus em metades (a do sul do de cima vai depois da do sul do de baixo), o fuste e a tábua, que vai por último.
  cena.sombras.push(
    contato(caixa(-p1 - 0.6, -p1 - 0.6, p1 + 0.6, p1 + 0.6, 1), 0.32),
    { forma: caixa(-p1, -p1, p1, 0), z: z1 },
    { forma: caixa(-p1, 0, p1, p1), z: z1 },
    { forma: caixa(-p2, -p2, p2, 0), z: z2 },
    { forma: naOrdemDaFrente(caixa(-p2, 0, p2, p2), p1 + 0.5), z: z2 },
    { forma: elipse(0, 0, rS, rS), z: zS },
    { forma: naOrdemDaFrente(menos(caixa(-t.bw, t.yN, t.bw, t.yS, 0.6), elipse(0, 0, FURO, FURO)), c.hh + 1), z: t.z, solta: true },
  )
  const L = cena.partes
  pedestalDeCima(L, P, pedra, med, c.giro)
  tabuaELivro(L, criarVista(P, t, false), pedra, t, m)
  const tela = criarVista(P, t, true)
  pedestalNaTela(L, tela, pedra, med)
  tabuaELivro(L, tela, pedra, t, m)
}
