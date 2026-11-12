/**
 * GALINHEIRO de cima com volume (lote 10 dos objetos novos, 11/11/2026): a
 * CASINHA de tábuas das galinhas, em cima de quatro pés, no fundo à esquerda
 * da pegada, com o telhado de duas águas de tábuas sobrepostas e a cumeeira de
 * um lado ao outro; na frente dela, a PORTINHOLA aberta e a RAMPA de ripas
 * descendo até o chão; em volta, o TERREIRO de terra ciscada, com palhinhas
 * soltas, fechado por uma CERCA BAIXA de duas varas em mourões; e, dentro,
 * três GALINHAS (uma branca, uma ruiva e uma carijó: o corpo, as asas
 * fechadas, o rabo, a cabeça com a crista vermelha e o bico), o NINHO de palha
 * com três ovos e o PRATO DE MILHO com os grãos espalhados em volta. É a
 * construção de quintal, com telhado; não a gaiola com aves.
 *
 * De cima o telhado manda: a água do norte, virada para a luz, clara; a do sul
 * na sombra, cada tábua com a sombra da de cima; as tábuas emendadas em
 * pedaços desencontrados; a cumeeira no meio; a casinha faz a sombra dela no
 * terreiro, para baixo à direita.
 *
 * NA 3/4, pelo que `tresQuartos.ts` faz com as sombras: cada tábua do telhado
 * é um tampo solto na altura dela, e todas vão até a mesma frente na tela (a
 * 3/4 as pinta da mais baixa para a mais alta: a de cima cobre a beira da de
 * baixo, como na tábua sobreposta); os pés e os mourões são colunas; a rampa
 * sobe em lances, cada um um tampo um degrau abaixo do outro, do chão até a
 * porta; cada vara sobe num pino (uma estrutura sem tamanho nem tinta, como no
 * cesto de vime). A PAREDE DA FRENTE (a comprida, com a portinhola; girada, a
 * de trás com a janelinha ou um oitão com o respiro) é desenhada de frente e
 * presa a um pino na altura do piso: de cima ela fica toda debaixo do
 * telhado. As tábuas do telhado têm um furo minúsculo no ponto desse pino, no
 * de cada pé e num ponto de chão, para nenhuma peça de baixo subir com o
 * telhado. Debaixo do piso fica o vão escuro, com os pés.
 *
 * Lê `c.giro` (o quarto de volta que a 3/4 pinta, e que só chega nela): a
 * parede desenhada de frente é a do lado que cai embaixo na tela, já
 * desgirada; a luz das águas e as sombras pintadas ficam no lugar na tela.
 *
 * As medidas da casinha e da cerca saem da pegada (2 x 1,5 casas de partida);
 * as alturas, de casas (encolhem se a casinha ficar rasa demais para esconder
 * a parede debaixo do telhado). A sombra do motor fica por baixo de todas as
 * peças (no terreiro ela sumiria): toda sombra é pintada. Material: `madeira`
 * (a casinha, o telhado e a rampa); as varas, o chão, as galinhas, o ninho e o
 * prato são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { caixa, capsula, elipseGirada, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- medidas ----------

/** A casinha na pegada: frações da largura e da altura, a partir de cima à esquerda. */
const CASA = { x0: 0.035, x1: 0.44, y0: 0.07, y1: 0.5 } as const
/** A aba do telhado além das paredes (px do protótipo). */
const BEIRAL = 3
/** As alturas (casas): o piso, em cima dos pés; a beira do telhado; a cumeeira. */
const ALTURA_DO_PISO = 0.22
const ALTURA_DA_BEIRA = 0.6
const ALTURA_DA_CUMEEIRA = 0.86
/** A parede desenhada de frente passa este tanto (px) da linha do telhado: a beirada das tábuas cobre a emenda. */
const FOLGA_DA_PAREDE = 1.2
/** As tábuas de cada água do telhado (cada uma sobe menos que a grossura da beirada: os degraus emendam). */
const TABUAS_POR_AGUA = 6
/** A tábua da cumeeira: a meia largura e o quanto fica acima das águas (px). */
const CUMEEIRA = { meia: 2.2, acima: 1.6 } as const
/** O tom do telhado e o quanto a água virada para a luz clareia (e a outra escurece). */
const TOM_DO_TELHADO = 0.93
const LUZ_DAS_AGUAS = 0.3
/**
 * As emendas das tábuas do telhado (px): o comprimento de cada pedaço, a meia largura do risco e o escuro dele. A
 * tábua inteira de ponta a ponta, girada na 3/4 (a cumeeira de trás para a frente), lia como tubo de órgão.
 */
const EMENDA = { passo: 24, meia: 0.6, escuro: 0.24 } as const
/**
 * A grossura padrão da beirada de um tampo na 3/4 (a `ESPESSURA_DO_TAMPO` de `tresQuartos.ts`, a do perfil
 * DERIVADO): a rampa desce um lance por grossura, para os degraus emendarem.
 */
const ESPESSURA_DA_TABUA = 0.06 * G
/**
 * O quanto a caixa das tábuas do telhado passa da frente dele na tela (px): a 3/4 pinta as estruturas pela
 * frente da caixa, e o telhado vem depois da parede desenhada de frente e da rampa, todo junto, da tábua mais
 * baixa para a mais alta.
 */
const FRENTE_DO_TELHADO = 3
/** Os pés: o raio e o recuo do canto (px). */
const PE = { raio: 1.4, recuo: 1.6 } as const
/** A rampa: a meia largura e o comprimento no chão (casas); a meia grossura das ripas (px). */
const RAMPA = { meia: 0.065, comprimento: 0.42 } as const
const MEIA_RIPA = 0.7
/** A parede: a largura das tábuas, o esteio de cada canto, a viga do piso e a sombra do telhado (px). */
const TABUA_DA_PAREDE = 4.6
const ESTEIO = 2.2
const VIGA = 2.4
const SOMBRA_DO_TELHADO = 6
const TOM_DA_PAREDE = 0.84
/** A portinhola (casas): a meia largura e a altura do vão; o batente e a folha aberta para o lado (px). */
const PORTA = { meia: 0.085, altura: 0.21 } as const
const BATENTE = 1.1
const FOLHA_DA_PORTA = 4
/** O respiro do oitão (a altura entre a beira e a cumeeira, em fração; o meio lado, px) e a janelinha de trás (px). */
const RESPIRO = { altura: 0.42, meio: 2.4 } as const
const JANELINHA = { meiaLargura: 3.4, meiaAltura: 2.6, barra: 0.45 } as const
/** A cerca: o recuo da beira, o raio do mourão, a altura (casas), o passo máximo entre dois (casas) e o raio da vara. */
const CERCA = { recuo: 2.2, raioDoMourao: 1.35, altura: 0.31, passo: 0.36, raioDaVara: 0.85 } as const
/** As alturas das duas varas (casas) e onde fica o pino de cada uma ao longo dela (fração). */
const VARAS: readonly (readonly [altura: number, pino: number])[] = [
  [0.13, 0.42],
  [0.27, 0.58],
]
/** Um nada de folga entre o mourão da ponta da cerca e o telhado (px). */
const FOLGA_DA_CERCA = 0.8

/** O terreiro: a beira (px; como a da plantação) e as palhinhas soltas (o passo da grade, a chance, a meia largura e o meio comprimento). */
const BEIRA_DO_TERREIRO = { fora: 0.8, onda: 2.4, tufo: 1.1, rampa: 2 } as const
const PALHINHA = { passo: 5.5, chance: 0.16, meia: 0.36, meio: 1.35 } as const
const ALCANCE_DA_BEIRA = BEIRA_DO_TERREIRO.fora + (BEIRA_DO_TERREIRO.onda + BEIRA_DO_TERREIRO.tufo) / 2 + 0.5

/** As galinhas (casas): o comprimento e a largura do corpo, o raio da cabeça e a altura do lombo (a sombra). */
const GALINHA = { comp: 0.19, larg: 0.115, cabeca: 0.032, altura: 0.14 } as const

/** O ninho (frações da pegada e casas) e os três ovos (o rumo em volta do meio e o giro). */
const NINHO = { x: 0.87, y: 0.2, raio: 0.095, oco: 0.058 } as const
const OVOS: readonly (readonly [rumo: number, giro: number])[] = [
  [0.4, 0.9],
  [2.5, 2.2],
  [4.4, 0.2],
]
/** O prato de milho (frações da pegada e casas) e os grãos: no prato e espalhados em volta. */
const PRATO_DE_MILHO = { x: 0.62, y: 0.55, raio: 0.1 } as const
const GRAOS_NO_PRATO = 11
const GRAOS_NO_CHAO = 12

/** Ponto de chão dentro da casinha (frações dela): a âncora das peças pintadas no chão que ficam debaixo do telhado. */
const CHAO_DA_CASINHA = { x: 0.78, y: 0.22 } as const
/** O furo de cada pino no telhado (meio lado, px): só o ponto exato do pino fica fora. */
const FURO = 0.05

// ---------- cores fixas ----------

const VARA: MaterialDaPeca = materialDaPeca('lenhaCarvalho')
const CHAO_DO_TERREIRO: Rgb = rgb('#94775a')
const TOM_DA_PALHINHA: Rgb = [0xc9, 0xad, 0x6e]
const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x24, 0x1b] }
const COR_DA_SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [14, 11, 8] }
const PALHA_DO_NINHO: MaterialDaPeca = { classe: 'palha', rgb: [0xc2, 0xa0, 0x66] }
const OVO: MaterialDaPeca = { classe: 'liso', rgb: [0xec, 0xe2, 0xcc] }
const PRATO: MaterialDaPeca = { classe: 'liso', rgb: [0x96, 0x62, 0x4c] }
const MILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xd2, 0xae, 0x52] }
const CRISTA: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0x45, 0x3b] }
const BICO: MaterialDaPeca = { classe: 'liso', rgb: [0xd0, 0xa2, 0x4e] }

/** A plumagem: o corpo, o rabo e se é carijó (o cinza pintado de branco). */
interface Plumagem {
  readonly corpo: Rgb
  readonly rabo: Rgb
  readonly carijo: boolean
}
const BRANCA: Plumagem = { corpo: [0xe6, 0xdf, 0xcf], rabo: [0xd4, 0xcb, 0xb8], carijo: false }
const RUIVA: Plumagem = { corpo: [0x9a, 0x58, 0x35], rabo: [0x3f, 0x33, 0x28], carijo: false }
const CARIJO: Plumagem = { corpo: [0x7c, 0x77, 0x6e], rabo: [0x46, 0x42, 0x3c], carijo: true }
/** O branco das pintas da carijó e o quanto delas. */
const PINTA_DA_CARIJO: Rgb = [0xe2, 0xdc, 0xcf]
const CHANCE_DA_PINTA = 0.4

/** As galinhas: o lugar (frações da pegada), o rumo da cabeça (radianos), a plumagem e se está bicando o chão. */
const GALINHAS: readonly { readonly x: number; readonly y: number; readonly rumo: number; readonly pena: Plumagem; readonly bicando: boolean }[] = [
  { x: 0.56, y: 0.4, rumo: 1.0, pena: BRANCA, bicando: true },
  { x: 0.8, y: 0.66, rumo: 3.55, pena: RUIVA, bicando: false },
  { x: 0.36, y: 0.84, rumo: -0.35, pena: CARIJO, bicando: true },
]

/** De onde vem a luz do motor, no chão (cima à esquerda, na tela). */
const LUZ_NO_CHAO: readonly [number, number] = [-0.62, -0.48]

// ---------- formas e giro ----------

/** Círculo com a distância exata. */
function circulo(cx: number, cy: number, r: number): Forma {
  return { b: [cx - r, cy - r, cx + r, cy + r], d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r }
}

/**
 * A mesma forma com a caixa de pintura espelhada em volta de (mx, my): o desenho não muda, e o meio da caixa,
 * que é o que a 3/4 lê para saber em que estrutura a peça está, cai ali.
 */
function centrada(f: Forma, mx: number, my: number): Forma {
  const ax = Math.max(Math.abs(f.b[0] - mx), Math.abs(f.b[2] - mx))
  const ay = Math.max(Math.abs(f.b[1] - my), Math.abs(f.b[3] - my))
  return { b: [mx - ax, my - ay, mx + ax, my + ay], d: f.d }
}

/** Meia largura do pino (px do protótipo): só o meio exato da caixa de uma peça cai nele. */
const MEIO_PINO = 0.001

/**
 * Um PINO (o do cesto de vime), NA TELA: a estrutura da 3/4 sem tamanho nem tinta. Só a peça com o meio da caixa
 * em (x, y) sobe com ele; `frente` = até onde a caixa dele vai, que é por onde a 3/4 ordena as estruturas.
 */
function pino(x: number, y: number, frente: number): Forma {
  return {
    b: [x - MEIO_PINO, y - MEIO_PINO, x + MEIO_PINO, Math.max(frente, y + MEIO_PINO)],
    d: (px, py) => (Math.abs(px - x) <= MEIO_PINO && Math.abs(py - y) <= MEIO_PINO ? -MEIO_PINO : 1),
  }
}

/** A forma com furos minúsculos nos pontos dados que caem dentro dela: a peça com o meio ali não fica nela. */
function comFuros(f: Forma, furos: readonly Ponto[]): Forma {
  const dentro = furos.filter(([x, y]) => f.d(x, y) <= 0)
  if (dentro.length === 0) return f
  return {
    b: f.b,
    d: (x, y) => {
      for (const [fx, fy] of dentro) if (Math.abs(x - fx) < FURO && Math.abs(y - fy) < FURO) return FURO
      return f.d(x, y)
    },
  }
}

type Quartos = 0 | 1 | 2 | 3

/** Os quartos de volta do giro que a 3/4 pinta (0 fora dela). */
function quartosDoGiro(giro: number): Quartos {
  return (((Math.round(giro / 90) % 4) + 4) % 4) as Quartos
}

/** O ponto do desenho NA TELA, depois do quarto de volta que a 3/4 pinta (o `girarPonto` de `tresQuartos.ts`). */
function naTela(x: number, y: number, q: Quartos): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** O ponto (ou a direção) da tela de volta no desenho: a luz e a sombra, que ficam no lugar na tela. */
function noDesenho(x: number, y: number, q: Quartos): Ponto {
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : q === 3 ? [-y, x] : [x, y]
}

/** A caixa levada por `leva` (um quarto de volta leva caixa em caixa). */
function caixaLevada(b: Caixa, leva: (x: number, y: number) => Ponto): Caixa {
  const [ax, ay] = leva(b[0], b[1])
  const [bx, by] = leva(b[2], b[3])
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]
}

/** A forma desenhada NA TELA levada para o desenho: o giro da 3/4 a devolve exatamente para onde foi desenhada. */
function formaNoDesenho(f: Forma, q: Quartos): Forma {
  if (q === 0) return f
  return {
    b: caixaLevada(f.b, (x, y) => noDesenho(x, y, q)),
    d: (x, y) => {
      const [tx, ty] = naTela(x, y, q)
      return f.d(tx, ty)
    },
  }
}

/** A mesma forma do desenho com a caixa esticada até `frente` NA TELA: a 3/4 a pinta depois do que vai até antes. */
function comFrenteNaTela(f: Forma, q: Quartos, frente: number): Forma {
  const t = caixaLevada(f.b, (x, y) => naTela(x, y, q))
  return { b: caixaLevada([t[0], t[1], t[2], Math.max(t[3], frente)], (x, y) => noDesenho(x, y, q)), d: f.d }
}

/** A sombra pintada: escura e meio transparente, de borda borrada. */
function sombraPintada(P: CriarPeca, f: Forma, alfa: number, suave: number): Peca {
  return P(f, COR_DA_SOMBRA, { bisel: 0, contorno: 0, alfa, suave })
}

/** O menor polígono convexo que contém os pontos (a cadeia monótona). */
function envoltoria(pontos: readonly Ponto[]): Ponto[] {
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const vira = (o: Ponto, a: Ponto, b: Ponto): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const baixo: Ponto[] = []
  for (const ponto of p) {
    while (baixo.length >= 2 && vira(baixo[baixo.length - 2], baixo[baixo.length - 1], ponto) <= 0) baixo.pop()
    baixo.push(ponto)
  }
  const cima: Ponto[] = []
  for (let i = p.length - 1; i >= 0; i -= 1) {
    while (cima.length >= 2 && vira(cima[cima.length - 2], cima[cima.length - 1], p[i]) <= 0) cima.pop()
    cima.push(p[i])
  }
  return [...baixo.slice(0, -1), ...cima.slice(0, -1)]
}

// ---------- a casinha ----------

interface Casinha {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  /** O meio da frente (a porta e a rampa) e a linha da cumeeira, de um lado ao outro. */
  readonly meioX: number
  readonly cumeeira: number
  readonly zPiso: number
  readonly zBeira: number
  readonly zCumeeira: number
}

function medirCasinha(c: ContextoDoMovel): Casinha {
  const x0 = -c.hw + CASA.x0 * c.w
  const x1 = -c.hw + CASA.x1 * c.w
  const y0 = -c.hh + CASA.y0 * c.h
  const y1 = -c.hh + CASA.y1 * c.h
  // A parede da frente desenhada, do piso à beira, tem de caber debaixo do telhado de cima: na casinha rasa as alturas encolhem.
  const piso = ALTURA_DO_PISO * c.g
  const beira = ALTURA_DA_BEIRA * c.g
  const k = Math.min(1, (y1 - y0 + BEIRAL - FOLGA_DA_PAREDE) / (beira - piso))
  return { x0, y0, x1, y1, meioX: (x0 + x1) / 2, cumeeira: (y0 + y1) / 2, zPiso: piso * k, zBeira: beira * k, zCumeeira: ALTURA_DA_CUMEEIRA * c.g * k }
}

/** A altura das águas do telhado em y (a linha reta, sem os degraus das tábuas). */
function alturaDoTelhado(casa: Casinha, y: number): number {
  const meia = (casa.y1 - casa.y0) / 2
  return casa.zBeira + ((casa.zCumeeira - casa.zBeira) / meia) * (meia - Math.abs(y - casa.cumeeira))
}

/** A parede que fica de frente na tela: a caixa da casinha na tela, se é oitão (girada um quarto) e o pino. */
interface Frente {
  readonly tela: Caixa
  readonly oitao: boolean
  /** O chão da parede desenhada (y na tela + a altura do pino). */
  readonly chao: number
  /** O pino na tela e no desenho. */
  readonly naTela: Ponto
  readonly noDesenho: Ponto
}

function planejarAFrente(casa: Casinha, q: Quartos): Frente {
  const tela = caixaLevada([casa.x0, casa.y0, casa.x1, casa.y1], (x, y) => naTela(x, y, q))
  const oitao = q % 2 === 1
  // Sobe pelo pino até o piso: de cima, a parede (do piso à beira) fica debaixo do telhado.
  const chao = tela[3] + casa.zPiso
  const topo = (oitao ? casa.zCumeeira : casa.zBeira) + FOLGA_DA_PAREDE
  const ponto: Ponto = [tela[0] + 0.3 * (tela[2] - tela[0]), chao - (topo + casa.zPiso) / 2]
  return { tela, oitao, chao, naTela: ponto, noDesenho: noDesenho(ponto[0], ponto[1], q) }
}

/**
 * A parede de frente: tábuas em pé (a fresta escura entre duas, o tom de cada uma), o esteio de cada canto, a
 * viga do piso embaixo e a sombra do telhado em cima. Lê o ponto NA TELA (a 3/4 gira a cena antes de subir).
 */
function texDaParede(q: Quartos, x0: number, x1: number, chao: number, piso: number, topo: (x: number) => number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const [tx, ty] = naTela(x, y, q)
    const altura = chao - ty
    let luz = ruido(tx * 1.3 + 3, ty * 0.16 + 11) * 0.07
    if (altura < piso + VIGA) {
      luz += -0.05 + ruido(tx * 0.15 + 5, ty * 1.2) * 0.06
      if (altura > piso + VIGA - 0.5) luz -= 0.2
    } else if (tx - x0 < ESTEIO || x1 - tx < ESTEIO) {
      luz -= 0.06 + (Math.abs(tx - x0 - ESTEIO) < 0.45 || Math.abs(x1 - tx - ESTEIO) < 0.45 ? 0.16 : 0)
    } else {
      const ao = (tx - x0 - ESTEIO) / TABUA_DA_PAREDE
      const i = Math.floor(ao)
      const f = ao - i
      luz += (hash(i, 7, 5301) - 0.5) * 0.12
      if (f < 0.1) luz -= 0.2 * (1 - f / 0.1)
    }
    // A sombra do beiral: a parede escurece debaixo da beirada do telhado.
    const debaixo = topo(tx) - BEIRAL - ESPESSURA_DA_TABUA - altura
    if (debaixo < SOMBRA_DO_TELHADO) luz -= (1 - Math.max(0, debaixo) / SOMBRA_DO_TELHADO) * 0.26
    s[3] += luz
  }
}

/** A parede desenhada de frente (só a 3/4 a vê): a da portinhola, a de trás com a janelinha ou um oitão com o respiro. */
function paredeDaFrente(c: ContextoDoMovel, cena: Cena, casa: Casinha, q: Quartos, fr: Frente, alvo: Peca[]): void {
  const P = c.peca
  const mad = c.m.madeira
  const [X0, , X1, Y1] = fr.tela
  const xm = (X0 + X1) / 2
  const meia = (X1 - X0) / 2
  const y = (altura: number): number => fr.chao - altura
  cena.sombras.push({ forma: formaNoDesenho(pino(fr.naTela[0], fr.naTela[1], Y1 + BEIRAL + 0.6), q), z: casa.zPiso, solta: true, forca: 0 })
  const presa = (f: Forma): Forma => centrada(formaNoDesenho(f, q), fr.noDesenho[0], fr.noDesenho[1])
  const topo = fr.oitao
    ? (x: number): number => casa.zBeira + FOLGA_DA_PAREDE + (casa.zCumeeira - casa.zBeira) * (1 - Math.abs(x - xm) / meia)
    : (): number => casa.zBeira + FOLGA_DA_PAREDE
  const parede = fr.oitao
    ? poligono([
        [X0, y(casa.zPiso)],
        [X0, y(casa.zBeira + FOLGA_DA_PAREDE)],
        [xm, y(casa.zCumeeira + FOLGA_DA_PAREDE)],
        [X1, y(casa.zBeira + FOLGA_DA_PAREDE)],
        [X1, y(casa.zPiso)],
      ])
    : caixa(X0, y(casa.zBeira + FOLGA_DA_PAREDE), X1, y(casa.zPiso))
  alvo.push(P(presa(parede), mad, { tabua: 0, bisel: 0.6, contorno: 0.24, tom: TOM_DA_PAREDE, textura: texDaParede(q, X0, X1, fr.chao, casa.zPiso, topo), semente: 5100 }))
  const escuro = { bisel: 0.6, contorno: 0.3, recesso: { k: 1.4, forca: 0.32 } } as const
  if (q === 0) {
    // A portinhola: o vão escuro no meio, rente ao piso, com o batente; a folha aberta encostada à esquerda.
    const pm = PORTA.meia * c.g
    const topoDoVao = casa.zPiso + PORTA.altura * c.g
    const fora = xm - pm - BATENTE
    alvo.push(P(presa(caixa(fora - FOLHA_DA_PORTA, y(topoDoVao + 0.4), fora - 0.3, y(casa.zPiso + 0.5), 0.4)), mad, { eixo: QUARTO, tabua: 0, bisel: 0.5, contorno: 0.34, tom: 0.74, semente: 5109 }))
    alvo.push(P(presa(caixa(fora, y(topoDoVao + BATENTE), xm + pm + BATENTE, y(casa.zPiso + 0.2), 0.8)), mad, { tabua: 0, bisel: 0.6, contorno: 0.3, tom: 0.98, semente: 5110 }))
    alvo.push(P(presa(caixa(xm - pm, y(topoDoVao), xm + pm, y(casa.zPiso + 0.6), 1.2)), ESCURO, { ...escuro, semente: 5111 }))
  } else if (fr.oitao) {
    // O respiro do oitão: o losango escuro entre a beira e a cumeeira.
    const ry = y(casa.zBeira + RESPIRO.altura * (casa.zCumeeira - casa.zBeira))
    const r = RESPIRO.meio
    alvo.push(P(presa(poligono([[xm, ry - r], [xm + r, ry], [xm, ry + r], [xm - r, ry]])), ESCURO, { ...escuro, semente: 5113 }))
  } else {
    // A janelinha da parede de trás, com a cruz de madeira.
    const jy = y((casa.zPiso + casa.zBeira) / 2 - 1)
    const { meiaLargura: jl, meiaAltura: ja, barra } = JANELINHA
    alvo.push(P(presa(caixa(xm - jl, jy - ja, xm + jl, jy + ja, 0.6)), ESCURO, { ...escuro, semente: 5114 }))
    alvo.push(P(presa(uniao(caixa(xm - barra, jy - ja, xm + barra, jy + ja), caixa(xm - jl, jy - barra, xm + jl, jy + barra))), mad, { tabua: 0, bisel: 0.3, contorno: 0.28, tom: 0.92, semente: 5115 }))
  }
}

/** A tábua do telhado: o veio da madeira e as emendas, desencontradas de uma tábua para a outra. */
function texDaTabuaDoTelhado(veio: Textura | null, desencontro: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (veio !== null) veio(u, v, x, y, p, s, escala)
    const ao = x / EMENDA.passo + desencontro
    const longe = Math.abs(ao - Math.round(ao)) * EMENDA.passo
    if (longe < EMENDA.meia) s[3] -= EMENDA.escuro * (1 - longe / EMENDA.meia)
  }
}

/** O telhado de duas águas: as tábuas de cada água, do beiral à cumeeira, e a tábua da cumeeira por cima. */
function telhado(c: ContextoDoMovel, cena: Cena, casa: Casinha, q: Quartos, ly: number, furos: readonly Ponto[], alvo: Peca[]): void {
  const P = c.peca
  const mad = c.m.madeira
  const veio = texturaDaClasse(mad.classe)
  const larguraDaAgua = (casa.y1 - casa.y0) / 2 + BEIRAL
  const tabua = larguraDaAgua / TABUAS_POR_AGUA
  const x0 = casa.x0 - BEIRAL
  const x1 = casa.x1 + BEIRAL
  const frente = caixaLevada([x0, casa.y0 - BEIRAL, x1, casa.y1 + BEIRAL], (x, y) => naTela(x, y, q))[3] + FRENTE_DO_TELHADO
  const estrutura = (f: Forma): Forma => comFuros(comFrenteNaTela(f, q, frente), furos)
  for (const lado of [-1, 1]) {
    // A água que olha para o lado de onde a luz vem (a do norte, sem giro) clareia; na outra, cada tábua faz sombra na de baixo.
    const deFrenteParaALuz = lado * ly
    const tom = TOM_DO_TELHADO + LUZ_DAS_AGUAS * deFrenteParaALuz
    for (let k = 0; k < TABUAS_POR_AGUA; k += 1) {
      const fora = casa.cumeeira + lado * (larguraDaAgua - k * tabua)
      const dentro = casa.cumeeira + lado * (larguraDaAgua - (k + 1) * tabua)
      const forma = caixa(x0, Math.min(fora, dentro), x1, Math.max(fora, dentro))
      cena.sombras.push({ forma: estrutura(forma), z: alturaDoTelhado(casa, dentro), solta: true, forca: 0 })
      alvo.push(
        P(forma, mad, {
          tabua: 0,
          bisel: 0.7,
          contorno: 0.24,
          tom: tom * (0.94 + 0.12 * hash(k, lado, 5201)),
          textura: texDaTabuaDoTelhado(veio, hash(k, lado, 5202)),
          semente: 5200 + k * 2 + (lado > 0 ? 1 : 0),
          projeta: deFrenteParaALuz < 0 ? { dist: 1.2, forca: 0.34 } : undefined,
        }),
      )
    }
  }
  const cumeeira = caixa(x0 - 0.4, casa.cumeeira - CUMEEIRA.meia, x1 + 0.4, casa.cumeeira + CUMEEIRA.meia)
  cena.sombras.push({ forma: estrutura(cumeeira), z: casa.zCumeeira + CUMEEIRA.acima, solta: true, forca: 0 })
  alvo.push(P(cumeeira, mad, { tabua: 0, bisel: 1, contorno: 0.3, tom: TOM_DO_TELHADO, projeta: { dist: 1.5, forca: 0.38 }, semente: 5260 }))
}

/** A rampa de ripas, da portinhola ao chão, em lances; a sombra dela vai pintada. */
function rampa(c: ContextoDoMovel, cena: Cena, casa: Casinha, sx: number, sy: number, sombras: Peca[], alvo: Peca[]): void {
  const P = c.peca
  const mad = c.m.madeira
  const meia = RAMPA.meia * c.g
  const comp = RAMPA.comprimento * c.g
  const lances = Math.max(2, Math.round(casa.zPiso / ESPESSURA_DA_TABUA))
  const passo = comp / lances
  const x = casa.meioX
  const y = casa.y1
  const foraDoTelhado = casa.y1 + BEIRAL + 1.2
  const z = casa.zPiso
  const sombra = poligono([
    [x - meia, y + comp],
    [x + meia, y + comp],
    [x + meia + sx * z, y + sy * z],
    [x - meia + sx * z, y + sy * z],
  ])
  sombras.push(sombraPintada(P, centrada(sombra, x + meia + 3, y + comp / 2), 0.28, 1.2))
  const tabuas: Peca[] = []
  const ripas: Peca[] = []
  for (let i = 0; i < lances; i += 1) {
    const ya = y + i * passo
    const yb = ya + passo
    const forma = caixa(x - meia, ya, x + meia, yb)
    cena.sombras.push({ forma, z: z * (1 - i / lances), solta: true, forca: 0 })
    // O meio da caixa fica no lance e fora do telhado (o primeiro lance começa debaixo da aba).
    tabuas.push(P(centrada(forma, x, Math.max((ya + yb) / 2, foraDoTelhado)), mad, { eixo: QUARTO, tabua: 0, bisel: 0.5, contorno: 0.22, tom: 0.96, semente: 5300 + i }))
    for (const t of [0.5, 1]) {
      const yr = ya + t * passo
      if (yr < foraDoTelhado || yr > y + comp - MEIA_RIPA * 2) continue
      ripas.push(P(caixa(x - meia + 0.4, yr - MEIA_RIPA, x + meia - 0.4, yr + MEIA_RIPA, 0.3), mad, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.8, projeta: { dist: 0.8, forca: 0.3 }, semente: 5320 + i * 2 + t * 2 }))
    }
  }
  alvo.push(...tabuas, ...ripas)
}

// ---------- o terreiro ----------

/** O chão ciscado do terreiro: manchas, grãos de terra, palhinhas soltas e a beira irregular que some no chão. */
function texDoTerreiro(x0: number, y0: number, x1: number, y1: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    let luz = ruido(x * 0.22 + 31, y * 0.22 + 5) * 0.12 + ruido(x * 0.8 + 3, y * 0.8 + 11) * 0.06
    const grao = hash(Math.floor(x * 0.9), Math.floor(y * 0.9), 77)
    if (grao > 0.94) luz -= 0.09
    else if (grao < 0.04) luz += 0.07
    const cx = Math.floor(x / PALHINHA.passo)
    const cy = Math.floor(y / PALHINHA.passo)
    if (hash(cx, cy, 78) < PALHINHA.chance) {
      const a = hash(cx, cy, 79) * Math.PI
      const ox = (cx + 0.3 + 0.4 * hash(cx, cy, 80)) * PALHINHA.passo
      const oy = (cy + 0.3 + 0.4 * hash(cx, cy, 81)) * PALHINHA.passo
      const ux = Math.cos(a)
      const uy = Math.sin(a)
      const ao = (x - ox) * ux + (y - oy) * uy
      const atraves = Math.abs(-(x - ox) * uy + (y - oy) * ux)
      if (Math.abs(ao) < PALHINHA.meio && atraves < PALHINHA.meia) {
        const q = 0.65
        s[0] += (TOM_DA_PALHINHA[0] - s[0]) * q
        s[1] += (TOM_DA_PALHINHA[1] - s[1]) * q
        s[2] += (TOM_DA_PALHINHA[2] - s[2]) * q
        luz += 0.06
      }
    }
    const borda = Math.min(x - x0, x1 - x, y - y0, y1 - y)
    if (borda < BEIRA_DO_TERREIRO.rampa + ALCANCE_DA_BEIRA) {
      const { fora, onda, tufo, rampa: r } = BEIRA_DO_TERREIRO
      const beira = (borda + fora + ruido(x * 0.3 + 71, y * 0.3 + 13) * onda + ruido(x * 1.1 + 9, y * 1.1) * tufo) / r
      if (beira < 1) s[5] = beira <= 0 ? 0 : beira
    }
    s[3] += luz
  }
}

/** As penas da galinha: o chuvisco das penas e, na carijó, as pintas brancas. */
function texDaPena(carijo: boolean): Textura {
  return (_u, _v, x, y, p, s) => {
    s[3] += ruido(x * 0.9 + p.su, y * 0.9 + p.sv) * 0.08
    if (carijo && hash(Math.floor(x * 1.25), Math.floor(y * 1.25), 61) < CHANCE_DA_PINTA) {
      const q = 0.55
      s[0] += (PINTA_DA_CARIJO[0] - s[0]) * q
      s[1] += (PINTA_DA_CARIJO[1] - s[1]) * q
      s[2] += (PINTA_DA_CARIJO[2] - s[2]) * q
    }
  }
}

/** A galinha no terreiro: o meio do corpo, o rumo da cabeça, a plumagem e se está bicando. */
interface NoTerreiro {
  readonly x: number
  readonly y: number
  readonly rumo: number
  readonly pena: Plumagem
  readonly bicando: boolean
}

/** Uma galinha: o rabo, o corpo, as asas fechadas, a cabeça, a crista e o bico; a sombra vai pintada. */
function galinha(P: CriarPeca, g: number, ga: NoTerreiro, sx: number, sy: number, sem: number, sombras: Peca[], alvo: Peca[]): void {
  const { x, y, rumo, pena, bicando } = ga
  const comp = GALINHA.comp * g
  const larg = GALINHA.larg * g
  const ux = Math.cos(rumo)
  const uy = Math.sin(rumo)
  const nx = -uy
  const ny = ux
  const alto = GALINHA.altura * g
  sombras.push(sombraPintada(P, elipseGirada(x + sx * alto, y + sy * alto, comp * 0.52, larg * 0.6, rumo), 0.3, 1.6))
  const corpo: MaterialDaPeca = { classe: 'liso', rgb: pena.corpo }
  const textura = texDaPena(pena.carijo)
  alvo.push(P(elipseGirada(x - ux * comp * 0.47, y - uy * comp * 0.47, comp * 0.24, larg * 0.34, rumo), { classe: 'liso', rgb: pena.rabo }, { bisel: 0.8, contorno: 0.3, semente: sem }))
  alvo.push(P(elipseGirada(x, y, comp / 2, larg / 2, rumo), corpo, { bisel: larg * 0.38, contorno: 0.3, textura, semente: sem + 1 }))
  for (const lado of [-1, 1]) {
    const wx = x - ux * comp * 0.08 + nx * lado * larg * 0.2
    const wy = y - uy * comp * 0.08 + ny * lado * larg * 0.2
    alvo.push(P(elipseGirada(wx, wy, comp * 0.3, larg * 0.21, rumo + lado * 0.08), corpo, { bisel: 0.7, contorno: 0.26, tom: 0.86, textura, semente: sem + 2 + (lado > 0 ? 1 : 0) }))
  }
  // Bicando, a cabeça vai mais para a frente e mais para baixo (menor, de cima).
  const rc = GALINHA.cabeca * g * (bicando ? 0.88 : 1)
  const longe = comp * (bicando ? 0.62 : 0.52)
  const hx = x + ux * longe
  const hy = y + uy * longe
  alvo.push(P(circulo(hx, hy, rc), corpo, { bisel: rc * 0.7, contorno: 0.3, tom: 1.02, semente: sem + 4 }))
  alvo.push(P(capsula(hx - ux * rc * 0.35, hy - uy * rc * 0.35, hx + ux * rc * 0.55, hy + uy * rc * 0.55, rc * 0.4), CRISTA, { bisel: 0.4, contorno: 0.25, semente: sem + 5 }))
  const bx = hx + ux * (rc + 1.2)
  const by = hy + uy * (rc + 1.2)
  const base = rc * 0.7
  alvo.push(P(poligono([[bx, by], [hx + ux * base + nx * 0.6, hy + uy * base + ny * 0.6], [hx + ux * base - nx * 0.6, hy + uy * base - ny * 0.6]]), BICO, { bisel: 0.3, contorno: 0.25, semente: sem + 6 }))
}

/** O ninho de palha com os três ovos. */
function ninho(P: CriarPeca, g: number, x: number, y: number, sx: number, sy: number, sombras: Peca[], alvo: Peca[]): void {
  const r = NINHO.raio * g
  const oco = NINHO.oco * g
  sombras.push(sombraPintada(P, circulo(x + sx * 3, y + sy * 3, r + 0.4), 0.3, 1.6))
  alvo.push(P(circulo(x, y, r), PALHA_DO_NINHO, { bisel: r * 0.55, contorno: 0.28, semente: 5500 }))
  alvo.push(P(circulo(x, y, oco), PALHA_DO_NINHO, { bisel: 0, contorno: 0.2, tom: 0.7, recesso: { k: 1.6, forca: 0.34 }, semente: 5501 }))
  OVOS.forEach(([rumo, giro], i) => {
    const ox = x + Math.cos(rumo) * oco * 0.42
    const oy = y + Math.sin(rumo) * oco * 0.42
    alvo.push(P(elipseGirada(ox, oy, 1.45, 1.05, giro), OVO, { bisel: 0.9, contorno: 0.24, projeta: { dist: 0.7, forca: 0.3 }, semente: 5502 + i }))
  })
}

/** O prato de barro com o milho dentro, e os grãos espalhados no chão em volta. */
function pratoDeMilho(P: CriarPeca, g: number, x: number, y: number, sx: number, sy: number, sombras: Peca[], alvo: Peca[]): void {
  const r = PRATO_DE_MILHO.raio * g
  sombras.push(sombraPintada(P, circulo(x + sx * 2, y + sy * 2, r + 0.3), 0.3, 1.4))
  alvo.push(P(circulo(x, y, r), PRATO, { bisel: 1.3, contorno: 0.28, recesso: { k: 1.6, forca: 0.3 }, semente: 5600 }))
  const grao = (gx: number, gy: number, i: number): Peca =>
    P(elipseGirada(gx, gy, 0.85, 0.62, hash(i, 2, 5602) * Math.PI), MILHO, { bisel: 0.4, contorno: 0.22, tom: 0.9 + 0.18 * hash(i, 3, 5602), semente: 5610 + i })
  for (let i = 0; i < GRAOS_NO_PRATO; i += 1) {
    // Na espiral do girassol: o monte enche o prato sem fileira.
    const t = (i + 0.5) / GRAOS_NO_PRATO
    const a = i * 2.39996
    alvo.push(grao(x + Math.cos(a) * r * 0.62 * Math.sqrt(t), y + Math.sin(a) * r * 0.62 * Math.sqrt(t), i))
  }
  for (let i = 0; i < GRAOS_NO_CHAO; i += 1) {
    const a = hash(i, 4, 5602) * Math.PI * 2
    const d = r * (1.35 + 1.4 * hash(i, 5, 5602))
    alvo.push(grao(x + Math.cos(a) * d, y + Math.sin(a) * d, GRAOS_NO_PRATO + i))
  }
}

/** A cerca de varas: os mourões nos cantos e no meio dos lados, as duas varas entre dois, e as sombras pintadas. */
function cerca(c: ContextoDoMovel, cena: Cena, q: Quartos, beiraDoTelhado: Caixa, sx: number, sy: number, sombras: Peca[], alvo: Peca[]): void {
  const { hw, hh, g, peca: P } = c
  const r = CERCA.raioDoMourao
  const xO = -hw + CERCA.recuo
  const xL = hw - CERCA.recuo
  const yN = -hh + CERCA.recuo
  const yS = hh - CERCA.recuo
  const encosto = r + FOLGA_DA_CERCA
  // Do canto do telhado, em volta, até o outro canto: a casinha fecha o resto.
  const trechos: readonly (readonly [Ponto, Ponto])[] = [
    [[beiraDoTelhado[2] + encosto, yN], [xL, yN]],
    [[xL, yN], [xL, yS]],
    [[xL, yS], [xO, yS]],
    [[xO, yS], [xO, beiraDoTelhado[3] + encosto]],
  ]
  const mouroes: Ponto[] = [trechos[0][0]]
  const varas: (readonly [Ponto, Ponto])[] = []
  for (const [a, b] of trechos) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CERCA.passo * g)))
    let antes = a
    for (let i = 1; i <= n; i += 1) {
      const p: Ponto = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]
      mouroes.push(p)
      varas.push([antes, p])
      antes = p
    }
  }
  varas.forEach(([a, b], i) => {
    const eixo = Math.atan2(b[1] - a[1], b[0] - a[0])
    const ta = naTela(a[0], a[1], q)
    const tb = naTela(b[0], b[1], q)
    VARAS.forEach(([alturaEmCasas, aoLongo], j) => {
      const z = alturaEmCasas * g
      // Cada vara no seu pino, em pontos diferentes: no mesmo ponto as duas subiriam com a mais alta.
      const px = a[0] + (b[0] - a[0]) * aoLongo
      const py = a[1] + (b[1] - a[1]) * aoLongo
      const [tx, ty] = naTela(px, py, q)
      cena.sombras.push({ forma: formaNoDesenho(pino(tx, ty, Math.max(ta[1], tb[1]) + CERCA.raioDaVara), q), z, solta: true, forca: 0 })
      alvo.push(P(centrada(capsula(a[0], a[1], b[0], b[1], CERCA.raioDaVara), px, py), VARA, { eixo, bisel: 0.6, contorno: 0.3, tom: j === 0 ? 0.92 : 1, semente: 5800 + i * 2 + j }))
      sombras.push(sombraPintada(P, capsula(a[0] + sx * z, a[1] + sy * z, b[0] + sx * z, b[1] + sy * z, CERCA.raioDaVara * 0.9), 0.2, 0.8))
    })
  })
  const altura = CERCA.altura * g
  mouroes.forEach(([x, y], i) => {
    const f = circulo(x, y, r)
    cena.sombras.push({ forma: f, z: altura, forca: 0 })
    alvo.push(P(f, VARA, { bisel: r * 0.8, contorno: 0.3, tom: 1.05, semente: 5700 + i }))
    sombras.push(sombraPintada(P, capsula(x, y, x + sx * altura, y + sy * altura, r * 0.8), 0.26, 0.9))
  })
}

/** A sombra da casinha no chão: as paredes, do piso à beira, e o telhado, da beira à cumeeira, para baixo à direita na tela. */
function sombraDaCasinha(casa: Casinha, beira: Caixa, sx: number, sy: number): Forma {
  const paredes: Ponto[] = []
  for (const z of [casa.zPiso, casa.zBeira]) {
    paredes.push([casa.x0 + sx * z, casa.y0 + sy * z], [casa.x1 + sx * z, casa.y0 + sy * z], [casa.x1 + sx * z, casa.y1 + sy * z], [casa.x0 + sx * z, casa.y1 + sy * z])
  }
  const aba = alturaDoTelhado(casa, beira[1])
  const topo = casa.zCumeeira
  const telhado = poligono([
    [beira[0] + sx * aba, beira[1] + sy * aba],
    [beira[2] + sx * aba, beira[1] + sy * aba],
    [beira[2] + sx * topo, casa.cumeeira + sy * topo],
    [beira[2] + sx * aba, beira[3] + sy * aba],
    [beira[0] + sx * aba, beira[3] + sy * aba],
    [beira[0] + sx * topo, casa.cumeeira + sy * topo],
  ])
  return uniao(poligono(envoltoria(paredes)), telhado)
}

// ---------- montagem ----------

export const montarGalinheiro: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, g, peca: P } = c
  const q = quartosDoGiro(c.giro)
  const [sx, sy] = noDesenho(SOMBRA_X, SOMBRA_Y, q)
  const ly = noDesenho(LUZ_NO_CHAO[0], LUZ_NO_CHAO[1], q)[1]
  const casa = medirCasinha(c)
  const beira: Caixa = [casa.x0 - BEIRAL, casa.y0 - BEIRAL, casa.x1 + BEIRAL, casa.y1 + BEIRAL]
  const fr = planejarAFrente(casa, q)
  const pes: Ponto[] = [
    [casa.x0 + PE.recuo, casa.y0 + PE.recuo],
    [casa.x1 - PE.recuo, casa.y0 + PE.recuo],
    [casa.x0 + PE.recuo, casa.y1 - PE.recuo],
    [casa.x1 - PE.recuo, casa.y1 - PE.recuo],
  ]
  const chao: Ponto = [casa.x0 + CHAO_DA_CASINHA.x * (casa.x1 - casa.x0), casa.y0 + CHAO_DA_CASINHA.y * (casa.y1 - casa.y0)]
  /** A peça pintada no chão com o meio debaixo do telhado vai para o ponto de chão da casinha (furado no telhado). */
  const noChao = (f: Forma): Forma => {
    const mx = (f.b[0] + f.b[2]) / 2
    const my = (f.b[1] + f.b[3]) / 2
    return mx >= beira[0] && mx <= beira[2] && my >= beira[1] && my <= beira[3] ? centrada(f, chao[0], chao[1]) : f
  }

  const terra: Peca[] = []
  const sombras: Peca[] = []
  const doChao: Peca[] = []
  const daRampa: Peca[] = []
  const daCerca: Peca[] = []
  const daCasa: Peca[] = []
  const doTelhado: Peca[] = []

  // O terreiro: a terra ciscada de cerca a cerca (debaixo da casinha também: a 3/4 a mostra no vão).
  const r = CERCA.recuo
  const t0: Caixa = [-hw + r - 0.5, -hh + r - 0.5, hw - r + 0.5, hh - r + 0.5]
  terra.push(P(noChao(caixa(t0[0] - ALCANCE_DA_BEIRA, t0[1] - ALCANCE_DA_BEIRA, t0[2] + ALCANCE_DA_BEIRA, t0[3] + ALCANCE_DA_BEIRA)), { classe: 'liso', rgb: CHAO_DO_TERREIRO }, { bisel: 0, contorno: 0, textura: texDoTerreiro(t0[0], t0[1], t0[2], t0[3]), semente: 5000 }))
  sombras.push(sombraPintada(P, noChao(caixa(casa.x0, casa.y0, casa.x1, casa.y1)), 0.24, 3))
  sombras.push(sombraPintada(P, noChao(sombraDaCasinha(casa, beira, sx, sy)), 0.32, 2.4))

  ninho(P, g, (NINHO.x - 0.5) * w, (NINHO.y - 0.5) * h, sx, sy, sombras, doChao)
  pratoDeMilho(P, g, (PRATO_DE_MILHO.x - 0.5) * w, (PRATO_DE_MILHO.y - 0.5) * h, sx, sy, sombras, doChao)
  GALINHAS.forEach((ga, i) => galinha(P, g, { ...ga, x: (ga.x - 0.5) * w, y: (ga.y - 0.5) * h }, sx, sy, 5400 + i * 10, sombras, doChao))

  rampa(c, cena, casa, sx, sy, sombras, daRampa)
  cerca(c, cena, q, beira, sx, sy, sombras, daCerca)

  // Os pés: colunas do chão ao piso.
  pes.forEach(([x, y], i) => {
    const f = circulo(x, y, PE.raio)
    cena.sombras.push({ forma: f, z: casa.zPiso, forca: 0 })
    daCasa.push(P(f, c.m.madeira, { tabua: 0, bisel: PE.raio * 0.8, tom: 0.8, contorno: 0.26, semente: 5150 + i }))
  })
  paredeDaFrente(c, cena, casa, q, fr, daCasa)
  telhado(c, cena, casa, q, ly, [fr.noDesenho, chao, ...pes], doTelhado)

  cena.partes.push(...terra, ...sombras, ...doChao, ...daRampa, ...daCerca, ...daCasa, ...doTelhado)
}
