/**
 * RINGUE DE LUTA de cima com volume (lote 11 dos objetos novos, 11/11/2026): o ringue de feira ou de arena. O
 * TABLADO quadrado e baixo, de tábuas, com a LONA clara esticada por cima, já gasta, com manchas de suor e de pó e
 * o CÍRCULO pintado no meio; a PASSARELA de tábuas fora das cordas, com o FRISO na beira; nos cantos, os quatro
 * POSTES de madeira com a ALMOFADA de pano do lado de dentro (uma vermelha, uma azul e duas cruas), e as TRÊS
 * VOLTAS de corda grossa de poste a poste (a de baixo mais para dentro, a de cima mais para fora: vistas do alto,
 * as três se separam, e a sombra de cada uma cai mais longe na lona). Fora das cordas, nos cantos vermelho e azul,
 * o BANQUINHO com a TOALHA e o BALDE com a esponja. O MEIO fica livre: é onde ficam as fichas dos lutadores. Sem
 * luz nem chama.
 *
 * É OBJETO DE CHÃO (`ehMovelDoChao`, como o campinho e o palco de bardo): fica debaixo de todos os outros objetos
 * e das fichas nas duas vistas. Por isso os postes e as cordas, que são altos, não tapam a ficha de um lutador na
 * 3/4: ela é pintada por cima do ringue inteiro, e a corda da frente passa por baixo dela.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado, beirada 0) o tablado é coluna, partido em cinco FAIXAS de norte a sul, todas
 * na mesma altura: a passarela de trás, a faixa das cordas de trás (do norte ao sul da almofada dos postes de
 * trás), o meio, a passarela da frente e o friso da frente. Cada coisa alta tem a base numa divisa de faixas e a
 * vez dela (`b[3]`) logo depois da faixa de cima, antes da de baixo, que tapa o pé dela abaixo das tábuas: as
 * cordas (cada volta é um tampo solto do tamanho de um PINO, sem tinta, na altura dela), os postes (coluna de
 * madeira do chão ao topo), as almofadas, os baldes e os banquinhos. As de trás saem antes da lona do meio; as dos
 * lados e as da frente, depois dela. O corpo de pano de cada almofada é desenhado de pé e GUARDADO debaixo da lona
 * na vista de cima: a almofada de trás fica na frente do poste, a da frente fica atrás dele. As sombras no tablado
 * (dos postes, das cordas, dos banquinhos e dos baldes) são pintadas na textura das tábuas e da lona: a sombra do
 * chão fica debaixo delas.
 *
 * O GIRO: as faixas, a vez e as sombras pintadas são da tela, então o ringue é montado NA TELA para o quarto de
 * volta que a 3/4 pinta (`c.giro`) e devolvido ao referencial do objeto (`cenaNoObjeto`); a 3/4 o gira de volta.
 * O canto vermelho e o azul vão para onde o giro os leva (com o banquinho e o balde), e as manchas, as costuras e
 * o círculo da lona giram com o objeto. Na vista de cima o giro chega 0 (a tela gira a imagem inteira).
 *
 * Materiais: `madeira` (o tablado, a passarela, os postes, o banquinho e o balde) e `lona`. O resto é fixo. O
 * tablado e as cordas acompanham a pegada; os postes, as almofadas, os banquinhos e os baldes têm tamanho fixo.
 */
import { hash, limitar01, passoSuave, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, caixa, capsula, dentroDe, elipse, menos, type Caixa, type Forma } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { materialDaPeca, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- medidas ----------

/** O alto do tablado, em casas. */
const ALTURA_DO_TABLADO = 0.16
/** Acima da lona, em casas: as três voltas de corda (de baixo para cima), o pé e o topo da almofada e o topo do poste. */
const ALTURAS_DAS_CORDAS: readonly number[] = [0.15, 0.29, 0.43]
const PE_DA_ALMOFADA = 0.08
const TOPO_DA_ALMOFADA = 0.5
const TOPO_DO_POSTE = 0.64
/** Acima das tábuas, em casas: o assento do banquinho e a boca do balde. */
const ALTURA_DO_BANQUINHO = 0.27
const ALTURA_DO_BALDE = 0.15

/** Frações da meia pegada: a beira do tablado e a linha dos postes e das cordas. */
const BEIRA = 0.97
const LINHA_DOS_POSTES = 0.76
/** Px do protótipo: o friso da beira e a fresta entre as tábuas. */
const LARGURA_DO_FRISO = 2.5
const FRESTA = 0.45
/**
 * O poste, a tampa abaulada no topo dele e a almofada (a beira da lona fica no raio dela, para fora do poste), em
 * px; e quanto a almofada sai do poste para dentro do ringue, em cada eixo.
 */
const RAIO_DO_POSTE = 2.6
const RAIO_DA_TAMPA = 1.8
const RAIO_DA_ALMOFADA = 4.6
const RECUO_DA_ALMOFADA = 0.6
/** O passo das costuras do acolchoado no corpo da almofada (px). */
const PASSO_DO_ACOLCHOADO = 5.2
/** A corda: o raio e o afastamento entre as voltas, vistas de cima (px). */
const RAIO_DA_CORDA = 1.05
const AFASTAMENTO_DAS_CORDAS = 1.9
/** O passo da torção da corda (px): um cordão a cada 1,25 grossura, como na corda de cânhamo de verdade. */
const PASSO_DA_TORCAO = 2.6

/** O banquinho: o raio do assento, a abertura das pernas da frente, o lado da perna e a folga do assento sobre a base delas (px). */
const RAIO_DO_ASSENTO = 5.2
const ABERTURA_DAS_PERNAS = 3.3
const LADO_DA_PERNA = 1.7
const FOLGA_DO_ASSENTO = 0.5
/** A grossura do assento: a beira escura que aparece embaixo dele, de cima e na 3/4 (px). */
const GROSSURA_DO_ASSENTO = 1.4
/** A toalha dobrada no assento (px; o giro em radianos): ela passa um pouco da beira dos dois lados. */
const TOALHA = { comprimento: 12.6, largura: 3.8, giro: -0.62, dx: 0.5, dy: 0.3, listra: 4.4, meiaListra: 0.5, dobra: 1.15 } as const
/**
 * O balde: o raio, a boca de ferro (fração do raio) e a esponja boiando (px); os dois aros de ferro do costado (a
 * altura de cada um, em fração do alto do balde, e a largura, em px), que só a 3/4 mostra.
 */
const RAIO_DO_BALDE = 4.4
const ARO_DO_BALDE = 0.86
const AROS_DO_COSTADO: readonly number[] = [0.24, 0.76]
const LARGURA_DO_ARO = 0.9
const AGUA_DO_BALDE = 0.72
const ESPONJA = { dx: 0.5, dy: 0.4, meiaX: 1.25, meiaY: 0.9 } as const

/** A lona: o raio do círculo grande e do pequeno (fração da meia lona), a meia largura das tintas e o losango do meio. */
const CIRCULO_GRANDE = 0.34
const CIRCULO_PEQUENO = 0.15
const MEIA_TINTA_GRANDE = 0.95
const MEIA_TINTA_PEQUENA = 0.6
const LOSANGO = 0.62
/** A força da tinta (a gasta some até 60%) e a da mancha de suor e do pó. */
const TINTA = 0.62
const GASTO_DA_TINTA = 0.6
const SUJEIRA_DO_SUOR = 0.3
const SUJEIRA_DO_PO = 0.3
/**
 * Onde o suor mancha: o limiar do ruído longe de tudo (rara) e onde mais se usa (comum); o alcance do meio e o dos
 * cantos dos lutadores (fração da meia lona menor); e de que fração da meia lona para fora começa o pó.
 */
const MANCHA_RARA = 0.24
const MANCHA_COMUM = 0.06
const USO_DO_MEIO = 0.85
const USO_DO_CANTO = 0.6
const PO_DESDE = 0.58
/** As costuras dos panos da lona (o pano tem um terço da meia lona), o vão entre as duas linhas e a meia linha. */
const COSTURAS = 3
const VAO_DA_COSTURA = 0.45
const MEIA_LINHA = 0.16
/** A bainha: a largura dela, a linha costurada e o passo das tachas (px). */
const BAINHA = 1.8
const PASSO_DAS_TACHAS = 6.5
const RAIO_DA_TACHA = 0.42

/**
 * A vez na 3/4 entre as coisas com base na mesma divisa: a faixa, depois as cordas, os baldes e as pernas dos
 * banquinhos (o alto decide entre eles), depois o poste e a almofada (a de trás na frente do poste, a da frente
 * atrás dele). Só somam ao `b[3]`: ninguém se mexe.
 */
const VEZ_DAS_CORDAS = 0.001
/** Os aros do balde: depois do balde e das cordas, antes do poste (nenhum deles fica no x do balde). */
const VEZ_DOS_AROS = 0.002
const VEZ_DO_PRIMEIRO = 0.01
const VEZ_DO_SEGUNDO = 0.02
/** Meia largura do pino (px): só o meio exato da caixa de uma peça cai nele. */
const MEIO_PINO = 0.001
/** Onde cai o meio da caixa de cada volta de corda, ao longo dela (px): um ponto só dela. */
const PINOS_DAS_CORDAS: readonly number[] = [0.13, 0.41, 0.67]

/** A sombra pintada no tablado: a cor, a força de cada coisa e a borda (px; cresce com o alto de quem faz a sombra). */
const COR_DA_SOMBRA: Rgb = [0x1e, 0x18, 0x14]
const FORCA_DA_SOMBRA_DO_POSTE = 0.32
const FORCA_DA_SOMBRA_DA_CORDA = 0.26
const FORCA_DA_SOMBRA_DO_BANCO = 0.3
const BORDA_DA_SOMBRA = 0.5
const BORDA_POR_ALTURA = 0.035

/** O vão debaixo das tábuas (aparece nas frestas) e os tons das tábuas da passarela e do friso. */
const TOM_DO_VAO = 0.32
const TOM_DO_FRISO = 0.84
/** As emendas das tábuas da passarela (fração da meia largura), uma por tábua, desencontradas. */
const EMENDAS: readonly number[] = [-0.34, 0.41, 0.18, -0.52]

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

// ---------- as cores ----------

const VERMELHO: Rgb = [0xa4, 0x4c, 0x44]
const AZUL: Rgb = [0x50, 0x68, 0x94]
const CRU: Rgb = [0xd4, 0xcf, 0xc2]
/** A corda de cânhamo, mais escura que a lona clara (a corda clara do motor sumia nela), e a torção. */
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: [0x9e, 0x86, 0x5c] }
const TORCAO_DA_CORDA: Rgb = [0x78, 0x63, 0x43]
const SUOR: Rgb = [0xae, 0x98, 0x6a]
const PO: Rgb = [0x9c, 0x94, 0x86]
const TINTA_ESCURA: Rgb = [0x8c, 0x4a, 0x3e]
const TINTA_CLARA: Rgb = [0xe4, 0xda, 0xc2]
const TACHA: Rgb = [0x58, 0x56, 0x50]
/** A luz (soma dos canais) acima da qual a lona é clara e leva a tinta escura. */
const LONA_CLARA = 420
const TOALHA_CRUA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0xe2, 0xda, 0xc6] }
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.7)) }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xc7, 0xd2, 0xcf] }
const AMARELO_DA_ESPONJA: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xa6, 0x60] }
const FERRO = materialDaPeca('ferro')

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/** A distância até a origem: `Math.hypot` é bem mais lento, e as texturas a pedem em cada pixel. */
function distancia(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

/** A cobertura de uma linha de meia largura `meia` a `d` px do meio dela, já com a borda de um pixel. */
function naLinha(meia: number, d: number, escala: number): number {
  return limitar01((meia - d) * escala + 0.5)
}

// ---------- o giro ----------

type Quartos = 0 | 1 | 2 | 3

/** Os quartos de volta do giro que a 3/4 pinta (na vista de cima chega 0: a tela gira a imagem). */
function quartosDoGiro(giro: number): Quartos {
  return (((Math.round(giro / 90) % 4) + 4) % 4) as Quartos
}

/** O ponto da tela de volta no referencial do objeto (o contrário do giro da 3/4, `girarCena`). */
function noObjeto(x: number, y: number, q: Quartos): [number, number] {
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : q === 3 ? [-y, x] : [x, y]
}

function caixaNoObjeto(b: Caixa, q: Quartos): Caixa {
  return q === 1 ? [b[1], -b[2], b[3], -b[0]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : q === 3 ? [-b[3], b[0], -b[1], b[2]] : b
}

/** A forma da tela no referencial do objeto: o ponto do objeto é girado para a tela e lido lá. */
function formaNoObjeto(f: Forma, q: Quartos): Forma {
  const b = caixaNoObjeto(f.b, q)
  if (q === 1) return { b, d: (x, y) => f.d(-y, x) }
  if (q === 2) return { b, d: (x, y) => f.d(-x, -y) }
  if (q === 3) return { b, d: (x, y) => f.d(y, -x) }
  return f
}

/**
 * A peça da tela no referencial do objeto: a forma, o deslocamento, o veio e o centro do veio em volta voltam; a
 * textura própria recebe do motor o ponto do objeto e lê o da tela. A luz e a projeção já são da tela.
 */
function pecaNoObjeto(p: Peca, q: Quartos): Peca {
  if (q === 0) return p
  const [dx, dy] = noObjeto(p.dx, p.dy, q)
  const tex = p.tex
  const polar = p.polar
  const doObjeto: Textura | null =
    tex === null
      ? null
      : q === 1
        ? (u, v, x, y, _doObjeto, s, escala) => tex(u, v, -y, x, p, s, escala)
        : q === 2
          ? (u, v, x, y, _doObjeto, s, escala) => tex(u, v, -x, -y, p, s, escala)
          : (u, v, x, y, _doObjeto, s, escala) => tex(u, v, y, -x, p, s, escala)
  return {
    ...p,
    forma: formaNoObjeto(p.forma, q),
    dx,
    dy,
    eixo: p.eixo - q * QUARTO,
    polar: polar === undefined ? undefined : { ...polar, cx: noObjeto(polar.cx, polar.cy, q)[0], cy: noObjeto(polar.cx, polar.cy, q)[1] },
    tex: doObjeto,
  }
}

/** Leva para `cena`, no referencial do objeto, o ringue montado na tela. */
function cenaNoObjeto(tela: Cena, q: Quartos, cena: Cena): void {
  for (const p of tela.partes) cena.partes.push(pecaNoObjeto(p, q))
  for (const s of tela.sombras) cena.sombras.push(q === 0 ? s : { ...s, forma: formaNoObjeto(s.forma, q) })
}

// ---------- a vez na 3/4 ----------

/** A mesma forma com a base (`b[3]`, a vez dela na 3/4) em `base`; o desenho não muda. */
function comBase(f: Forma, base: number): Forma {
  return { b: [f.b[0], f.b[1], f.b[2], base], d: f.d }
}

/**
 * Um PINO: a estrutura da 3/4 do tamanho de um ponto, sem tinta (a beirada 0 do perfil não pinta nada) e sem
 * sombra. Só a peça com o meio da caixa em (x, y) sobe com ele; `base` é a vez dele.
 */
function pino(x: number, y: number, base: number): Forma {
  return {
    b: [x - MEIO_PINO, Math.min(y, base) - MEIO_PINO, x + MEIO_PINO, base],
    d: (px, py) => (Math.abs(px - x) <= MEIO_PINO && Math.abs(py - y) <= MEIO_PINO ? -MEIO_PINO : 1),
  }
}

/**
 * A mesma forma com a caixa de pintura espelhada em volta de (mx, my): o desenho não muda (fora da forma nada
 * pinta), e o meio da caixa, que a 3/4 lê para saber em que estrutura a peça está, cai em (mx, my).
 */
function centrada(f: Forma, mx: number, my: number): Forma {
  const ax = Math.max(Math.abs(f.b[0] - mx), Math.abs(f.b[2] - mx))
  const ay = Math.max(Math.abs(f.b[1] - my), Math.abs(f.b[3] - my))
  return { b: [mx - ax, my - ay, mx + ax, my + ay], d: f.d }
}

// ---------- a geometria, na tela ----------

interface Ringue {
  readonly g: number
  readonly q: Quartos
  /** A beira do tablado, onde o friso começa, a fresta entre as duas tábuas da passarela, a beira da lona e a linha dos postes. */
  readonly xE: number
  readonly yE: number
  readonly xT: number
  readonly yT: number
  readonly xM: number
  readonly yM: number
  readonly xL: number
  readonly yL: number
  readonly xP: number
  readonly yP: number
  /** As seis divisas das cinco faixas, de norte a sul (ver o comentário do arquivo). */
  readonly divisas: readonly number[]
  readonly zTablado: number
  /** O meio do x da passarela dos lados: onde ficam o banquinho e o balde. */
  readonly xDoCanto: number
}

function geometria(c: ContextoDoMovel, q: Quartos): Ringue {
  // Com um quarto de volta, a largura do objeto fica de pé na tela.
  const meiaX = q % 2 === 1 ? c.hh : c.hw
  const meiaY = q % 2 === 1 ? c.hw : c.hh
  const xE = BEIRA * meiaX
  const yE = BEIRA * meiaY
  const xP = LINHA_DOS_POSTES * meiaX
  const yP = LINHA_DOS_POSTES * meiaY
  const xL = xP + RAIO_DA_ALMOFADA
  const yL = yP + RAIO_DA_ALMOFADA
  const xT = xE - LARGURA_DO_FRISO
  const yT = yE - LARGURA_DO_FRISO
  return {
    g: c.g,
    q,
    xE,
    yE,
    xT,
    yT,
    xM: (xL + xT) / 2,
    yM: (yL + yT) / 2,
    xL,
    yL,
    xP,
    yP,
    divisas: [-yE, -yL, -(yP - RAIO_DA_ALMOFADA), yL, yT, yE],
    zTablado: c.g * ALTURA_DO_TABLADO,
    xDoCanto: (xL + xE) / 2,
  }
}

interface Canto {
  readonly sx: number
  readonly sy: number
  readonly cor: Rgb
  /** O canto de um lutador (o vermelho e o azul): tem o banquinho e o balde. */
  readonly doLutador: boolean
}

/** Os quatro cantos na tela: o vermelho é o do nordeste do objeto, o azul o do sudoeste, e o giro os leva. */
function cantosNaTela(q: Quartos): Canto[] {
  const cantos: Canto[] = []
  for (const sy of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const [ox, oy] = noObjeto(sx, sy, q)
      const vermelho = ox > 0 && oy < 0
      const azul = ox < 0 && oy > 0
      cantos.push({ sx, sy, cor: vermelho ? VERMELHO : azul ? AZUL : CRU, doLutador: vermelho || azul })
    }
  }
  return cantos
}

/**
 * O banquinho e o balde de um canto de lutador, na tela. O banquinho, mais alto, fica sempre atrás do balde, para
 * a 3/4 mostrar os dois: atrás, o banquinho fica no quadrado do canto, com a base na beira da passarela de trás, e
 * o balde na passarela do lado, com a base na divisa da faixa das cordas; na frente, o banquinho fica na passarela
 * do lado, com a base na beira da lona, e o balde no quadrado do canto, com a base na divisa do friso. Cada um sai
 * depois da faixa em que está e antes da que tapa o pé dele.
 */
interface CantoDeLutador {
  readonly canto: Canto
  readonly xBanco: number
  readonly baseDoBanco: number
  readonly xBalde: number
  readonly baseDoBalde: number
}

function cantoDeLutador(r: Ringue, canto: Canto): CantoDeLutador {
  const x = canto.sx * r.xDoCanto
  const atras = canto.sy < 0
  return {
    canto,
    xBanco: x,
    baseDoBanco: atras ? r.divisas[1] : r.yL,
    xBalde: x,
    baseDoBalde: atras ? r.divisas[2] : r.yT,
  }
}

function meioDoAssento(base: number): number {
  return base + FOLGA_DO_ASSENTO - RAIO_DO_ASSENTO
}

// ---------- as sombras pintadas no tablado ----------

/** Uma sombra pintada: a cápsula de (ax, ay) até (ax + dx, ay + dy), com a caixa até onde a borda alcança. */
interface SombraPintada {
  readonly ax: number
  readonly ay: number
  readonly dx: number
  readonly dy: number
  readonly l2: number
  readonly r: number
  readonly borda: number
  readonly forca: number
  readonly caixa: Caixa
}

function sombraPintada(ax: number, ay: number, bx: number, by: number, r: number, alto: number, forca: number): SombraPintada {
  const borda = BORDA_DA_SOMBRA + BORDA_POR_ALTURA * alto
  const m = r + 2 * borda
  const dx = bx - ax
  const dy = by - ay
  return { ax, ay, dx, dy, l2: dx * dx + dy * dy || 1e-9, r, borda, forca, caixa: [Math.min(ax, bx) - m, Math.min(ay, by) - m, Math.max(ax, bx) + m, Math.max(ay, by) + m] }
}

/** A sombra de uma coisa de pé, do alto `de` ao alto `ate` acima das tábuas: o pé dela varrido para baixo à direita. */
function sombraDePe(x: number, y: number, r: number, de: number, ate: number, forca: number): SombraPintada {
  return sombraPintada(x + SOMBRA_X * de, y + SOMBRA_Y * de, x + SOMBRA_X * ate, y + SOMBRA_Y * ate, r, ate, forca)
}

/**
 * As sombras pintadas e a meia largura do quadrado do meio em que nenhuma cai: todas nascem na beira, e o meio da
 * lona, que é quase metade dela, não as procura (é o pixel que mais se pinta).
 */
interface SombrasPintadas {
  readonly lista: readonly SombraPintada[]
  readonly livre: number
}

/** A sombra pintada mais forte no ponto (as que se cruzam não somam, como as do chão). */
function sombraNoPonto(sombras: SombrasPintadas, x: number, y: number): number {
  if (Math.abs(x) < sombras.livre && Math.abs(y) < sombras.livre) return 0
  let a = 0
  for (const l of sombras.lista) {
    const b = l.caixa
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue
    const px = x - l.ax
    const py = y - l.ay
    let h = (px * l.dx + py * l.dy) / l.l2
    h = h < 0 ? 0 : h > 1 ? 1 : h
    const qx = px - l.dx * h
    const qy = py - l.dy * h
    const k = limitar01(0.5 - (Math.sqrt(qx * qx + qy * qy) - l.r) / (2 * l.borda))
    const v = l.forca * k * k * (3 - 2 * k)
    if (v > a) a = v
  }
  return a
}

function escurecer(s: Float32Array, a: number): void {
  if (a > 0) misturarEm(s, COR_DA_SOMBRA, a)
}

/** As sombras que os postes, as almofadas, as cordas, os banquinhos e os baldes fazem nas tábuas e na lona. */
function sombrasPintadas(r: Ringue, cantos: readonly Canto[], lutadores: readonly CantoDeLutador[]): SombrasPintadas {
  const { g } = r
  const lista: SombraPintada[] = []
  for (const { sx, sy } of cantos) {
    const cx = sx * r.xP
    const cy = sy * r.yP
    lista.push(sombraDePe(cx, cy, RAIO_DO_POSTE, 0, TOPO_DO_POSTE * g, FORCA_DA_SOMBRA_DO_POSTE))
    lista.push(sombraDePe(cx - sx * RECUO_DA_ALMOFADA, cy - sy * RECUO_DA_ALMOFADA, RAIO_DA_ALMOFADA, PE_DA_ALMOFADA * g, TOPO_DA_ALMOFADA * g, FORCA_DA_SOMBRA_DO_POSTE))
  }
  for (const corda of cordas(r)) {
    const ox = SOMBRA_X * corda.alto
    const oy = SOMBRA_Y * corda.alto
    lista.push(sombraPintada(corda.ax + ox, corda.ay + oy, corda.bx + ox, corda.by + oy, RAIO_DA_CORDA, corda.alto, FORCA_DA_SOMBRA_DA_CORDA))
  }
  for (const l of lutadores) {
    const alto = ALTURA_DO_BANQUINHO * g
    const cy = meioDoAssento(l.baseDoBanco)
    const ox = SOMBRA_X * alto
    const oy = SOMBRA_Y * alto
    lista.push(sombraPintada(l.xBanco + ox, cy + oy, l.xBanco + ox, cy + oy, RAIO_DO_ASSENTO, alto, FORCA_DA_SOMBRA_DO_BANCO))
    lista.push(sombraDePe(l.xBanco, cy, ABERTURA_DAS_PERNAS * 0.5, 0, alto, FORCA_DA_SOMBRA_DO_BANCO * 0.8))
    lista.push(sombraDePe(l.xBalde, l.baseDoBalde - RAIO_DO_BALDE, RAIO_DO_BALDE, 0, ALTURA_DO_BALDE * g, FORCA_DA_SOMBRA_DO_BANCO))
  }
  // Quanto cada caixa fica longe do meio, para fora (em x ou em y); o quadrado livre é o da mais perto.
  const livre = Math.min(...lista.map(({ caixa: b }) => Math.max(b[0], -b[2], b[1], -b[3])))
  return { lista, livre: Math.max(0, livre) }
}

// ---------- as cordas ----------

/** Uma volta de corda na tela: de poste a poste, o alto acima da lona, o pino e a vez. */
interface Corda {
  readonly ax: number
  readonly ay: number
  readonly bx: number
  readonly by: number
  readonly alto: number
  readonly px: number
  readonly py: number
  readonly vez: number
  readonly deitada: boolean
}

/** As doze voltas: três em cada lado, a de baixo mais para dentro. As de trás têm a vez da faixa das cordas de trás. */
function cordas(r: Ringue): Corda[] {
  const lista: Corda[] = []
  const vezDeTras = r.divisas[2] + VEZ_DAS_CORDAS
  const vezDaFrente = r.divisas[3] + VEZ_DAS_CORDAS
  ALTURAS_DAS_CORDAS.forEach((altura, k) => {
    const fora = (k - 1) * AFASTAMENTO_DAS_CORDAS
    const alto = altura * r.g
    const ao = PINOS_DAS_CORDAS[k]
    for (const lado of [-1, 1]) {
      const y = lado * (r.yP + fora)
      lista.push({ ax: -r.xP, ay: y, bx: r.xP, by: y, alto, px: ao, py: y, vez: lado < 0 ? vezDeTras : vezDaFrente, deitada: true })
      const x = lado * (r.xP + fora)
      lista.push({ ax: x, ay: -r.yP, bx: x, by: r.yP, alto, px: x, py: ao, vez: vezDaFrente, deitada: false })
    }
  })
  return lista
}

/**
 * A torção da corda de cânhamo: os cordões em diagonal, cada um claro no lombo e escuro no sulco. Abaixo da escala
 * do detalhe o passo cai em 2 pixels e chuviscaria: fica só o tom médio do sulco.
 */
const texDaCorda: Textura = (u, v, _x, _y, _p, s, escala) => {
  if (escala < ESCALA_DO_DETALHE) {
    misturarEm(s, TORCAO_DA_CORDA, 0.25)
    return
  }
  const onda = Math.sin((u - v * 1.1) * ((2 * Math.PI) / PASSO_DA_TORCAO))
  misturarEm(s, TORCAO_DA_CORDA, 0.6 * limitar01(-onda))
  s[3] += 0.07 * limitar01(onda)
}

function montarCordas(c: ContextoDoMovel, tela: Cena, r: Ringue): void {
  const P = c.peca
  cordas(r).forEach((corda, i) => {
    tela.sombras.push({ forma: pino(corda.px, corda.py, corda.vez), z: r.zTablado + corda.alto, solta: true, forca: 0 })
    const forma = centrada(capsula(corda.ax, corda.ay, corda.bx, corda.by, RAIO_DA_CORDA), corda.px, corda.py)
    tela.partes.push(P(forma, CORDA, { eixo: corda.deitada ? 0 : QUARTO, tabua: 0, bisel: 0.7, contorno: 0.26, textura: texDaCorda, semente: 7300 + i }))
  })
}

// ---------- o tablado, a passarela e a lona ----------

/** As tábuas e o friso com a sombra pintada por cima. */
function texDaTabua(sombras: SombrasPintadas): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    escurecer(s, sombraNoPonto(sombras, x, y))
  }
}

/**
 * A lona: o encardido (borrões de suor amarelados, o pó mais perto das cordas), as costuras dos panos, o círculo
 * pintado já gasto, a bainha com as tachas e a sombra pintada. O encardido, as costuras e o círculo são do objeto
 * (giram com ele); a bainha e a sombra, da tela.
 */
function texDaLona(c: ContextoDoMovel, r: Ringue, sombras: SombrasPintadas): Textura {
  const { q, xL, yL } = r
  // A meia lona no objeto: com um quarto de volta, a da tela está deitada.
  const mx = LINHA_DOS_POSTES * c.hw + RAIO_DA_ALMOFADA
  const my = LINHA_DOS_POSTES * c.hh + RAIO_DA_ALMOFADA
  const menor = Math.min(mx, my)
  const raioGrande = CIRCULO_GRANDE * menor
  const raioPequeno = CIRCULO_PEQUENO * menor
  const losango = LOSANGO * raioPequeno
  const costura = mx / COSTURAS
  const [lr, lg, lb] = c.m.lona.rgb
  const tinta = lr + lg + lb > LONA_CLARA ? TINTA_ESCURA : TINTA_CLARA
  return (u, v, x, y, p, s, escala) => {
    // A trama do linho (a da classe, sem o mosqueado miúdo: o encardido abaixo já mosqueia, e a lona é o pixel que
    // mais se pinta).
    s[3] += ruido(u * 0.05 + p.semente * 5, v * 1.15) * 0.08 + (((Math.floor(u * 1.4) + Math.floor(v * 1.4)) & 1) === 1 ? 0.012 : -0.012)
    const ox = q === 1 ? y : q === 2 ? -x : q === 3 ? -y : x
    const oy = q === 1 ? -x : q === 2 ? -y : q === 3 ? x : y
    // O suor: borrões amarelados, maiores onde se luta (o meio) e onde se descansa (o canto do vermelho e o do
    // azul), com a beira um pouco mais escura, a marca de onde a água secou.
    const raio = distancia(ox, oy)
    const noMeio = limitar01(1 - raio / (USO_DO_MEIO * menor))
    const noCanto = limitar01(1 - Math.min(distancia(ox - mx, oy + my), distancia(ox + mx, oy - my)) / (USO_DO_CANTO * menor))
    const limiar = MANCHA_RARA - (MANCHA_RARA - MANCHA_COMUM) * Math.max(noMeio, noCanto)
    const n = ruido(ox * 0.05 + 13.7, oy * 0.05 + 5.1) + 0.55 * ruido(ox * 0.13 + 3.3, oy * 0.13 + 9.9)
    const mancha = passoSuave(limiar, limiar + 0.22, n)
    misturarEm(s, SUOR, SUJEIRA_DO_SUOR * mancha)
    s[3] -= 0.05 * mancha + 0.05 * (passoSuave(limiar - 0.04, limiar + 0.02, n) - passoSuave(limiar + 0.02, limiar + 0.09, n))
    // O pó, só perto das cordas, onde ninguém pisa.
    const ate = Math.max(Math.abs(ox) / mx, Math.abs(oy) / my)
    if (ate > PO_DESDE) misturarEm(s, PO, SUJEIRA_DO_PO * limitar01(((ate - PO_DESDE) / (1 - PO_DESDE)) * (0.6 + ruido(ox * 0.21 + 7.1, oy * 0.21 + 2.9))))
    // As costuras dos panos: duas linhas de ponto ao comprido do objeto.
    const dc = Math.abs(Math.abs(ox) - costura)
    if (dc < VAO_DA_COSTURA + 1) {
      s[3] -= 0.1 * naLinha(MEIA_LINHA, Math.abs(dc - VAO_DA_COSTURA), escala) + (dc < VAO_DA_COSTURA ? 0.03 : 0)
    }
    // O círculo pintado, gasto: o anel grande, o pequeno e o losango no meio.
    const tinto =
      Math.max(naLinha(MEIA_TINTA_GRANDE, Math.abs(raio - raioGrande), escala), naLinha(MEIA_TINTA_PEQUENA, Math.abs(raio - raioPequeno), escala)) +
      0.7 * limitar01((1 - (Math.abs(ox) + Math.abs(oy)) / losango) * losango * escala)
    if (tinto > 0) {
      const gasto = passoSuave(-0.05, 0.25, ruido(ox * 0.35 + 21.3, oy * 0.35 + 4.7))
      misturarEm(s, tinta, TINTA * limitar01(tinto) * (1 - GASTO_DA_TINTA * gasto))
    }
    // A bainha: a lona dobrada na beira, a linha costurada e as tachas.
    const beira = Math.min(xL - Math.abs(x), yL - Math.abs(y))
    if (beira < BAINHA + 0.5) {
      s[3] -= 0.1 * limitar01(1 - beira / BAINHA) + 0.08 * naLinha(MEIA_LINHA, Math.abs(beira - BAINHA), escala)
      if (escala >= ESCALA_DO_DETALHE) {
        const ao = xL - Math.abs(x) < yL - Math.abs(y) ? y : x
        const f = ao / PASSO_DAS_TACHAS
        const dt = distancia((f - Math.floor(f) - 0.5) * PASSO_DAS_TACHAS, beira - BAINHA / 2)
        if (dt < RAIO_DA_TACHA + 0.3) misturarEm(s, TACHA, 0.8 * naLinha(RAIO_DA_TACHA, dt, escala))
      }
    }
    escurecer(s, sombraNoPonto(sombras, x, y))
  }
}

/**
 * O tablado: as cinco faixas (cada uma com o vão escuro por baixo, que é a maior peça dela e dá a madeira da
 * frente na 3/4), os corpos guardados das almofadas, a lona, as tábuas da passarela, o friso e os pregos. Peça que
 * cairia dentro de um poste, de um banquinho ou de um balde (a 3/4 a subiria com ele) tem a caixa centrada no
 * meio da faixa dela, no eixo do ringue, onde não há mais nada.
 */
function montarTablado(c: ContextoDoMovel, tela: Cena, r: Ringue, sombras: SombrasPintadas, ocupadas: readonly Forma[], guardados: readonly Peca[]): void {
  const { peca: P } = c
  const L = tela.partes
  const mad = c.m.madeira
  const { xE, yE, xT, yT, xM, yM, xL, yL, divisas, zTablado } = r
  const meia = FRESTA / 2
  const naFaixa = (f: Forma, k: number): Forma => {
    const cx = (f.b[0] + f.b[2]) / 2
    const cy = (f.b[1] + f.b[3]) / 2
    const dentro = (x: number, y: number): boolean => ocupadas.some((o) => o.d(x, y) <= 0.3)
    if (!dentro(cx, cy)) return f
    // No mesmo x, se ali estiver livre (a caixa fica estreita); senão no eixo do ringue.
    const meio = (divisas[k] + divisas[k + 1]) / 2
    return centrada(f, dentro(cx, meio) ? 0 : cx, meio)
  }
  const faixaDe = (y0: number, y1: number): number => divisas.findIndex((d, k) => k < divisas.length - 1 && y0 >= d - 1e-6 && y1 <= divisas[k + 1] + 1e-6)
  tela.sombras.push(contato(caixa(-xE, -yE, xE, yE, 1), 0.36))
  for (let k = 0; k < divisas.length - 1; k += 1) {
    const y0 = divisas[k]
    const y1 = divisas[k + 1]
    tela.sombras.push({ forma: caixa(-xE, y0, xE, y1), z: zTablado })
    L.push(P(caixa(-xE + 0.25, y0 + 0.15, xE - 0.25, y1 - 0.15), mad, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_VAO, semente: 7100 + k }))
  }
  // Os corpos das almofadas, de pé, debaixo da lona: só a 3/4 os mostra.
  L.push(...guardados)
  const lona = texDaLona(c, r, sombras)
  L.push(P(caixa(-xL, -yL, xL, divisas[2]), c.m.lona, { tabua: 0, bisel: 0, contorno: 0, textura: lona, semente: 7150 }))
  L.push(P(caixa(-xL, divisas[2], xL, yL), c.m.lona, { tabua: 0, bisel: 0, contorno: 0, textura: lona, semente: 7150 }))
  const tex = texDaTabua(sombras)
  let semente = 7200
  const tabua = (x0: number, y0: number, x1: number, y1: number, eixo: number, tom: number): void => {
    const k = faixaDe(y0, y1)
    L.push(P(naFaixa(caixa(x0, y0, x1, y1, 0.35), k), mad, { eixo, tabua: 0, bisel: 0.7, contorno: 0.2, tom: tom + 0.12 * hash(semente, 3, 7201), textura: tex, semente }))
    semente += 1
  }
  const prego = (x: number, y: number, k: number): void => {
    L.push(P(naFaixa(elipse(x, y, 0.42, 0.42), k), PREGO, { bisel: 0.4, contorno: 0, metal: 0.2 }))
  }
  // A passarela de trás e a da frente: duas tábuas ao comprido, cada uma com uma emenda (e os pregos nela e nas pontas).
  const faixasDeComprido: readonly (readonly [number, number, number])[] = [
    [-yT + meia, -yM - meia, 0],
    [-yM + meia, -yL - meia, 0],
    [yL + meia, yM - meia, 3],
    [yM + meia, yT - meia, 3],
  ]
  faixasDeComprido.forEach(([y0, y1, k], i) => {
    const emenda = EMENDAS[i] * xT
    tabua(-xT + meia, y0, emenda - meia, y1, 0, 0.92)
    tabua(emenda + meia, y0, xT - meia, y1, 0, 0.92)
    for (const x of [-xT + 1.4, emenda - 1.2, emenda + 1.2, xT - 1.4]) prego(x, (y0 + y1) / 2, k)
  })
  // A dos lados: duas tábuas de pé, partidas na divisa da faixa das cordas de trás.
  for (const lado of [-1, 1]) {
    const pedacos: readonly (readonly [number, number])[] = [
      [-yL + meia, divisas[2] - meia],
      [divisas[2] + meia, yL - meia],
    ]
    for (const [a, b] of [
      [xL + meia, xM - meia],
      [xM + meia, xT - meia],
    ] as const) {
      const x0 = lado < 0 ? -b : a
      const x1 = lado < 0 ? -a : b
      for (const [y0, y1] of pedacos) {
        tabua(x0, y0, x1, y1, QUARTO, 0.92)
        const k = faixaDe(y0, y1)
        for (const y of [y0 + 1.3, y1 - 1.3]) prego((x0 + x1) / 2, y, k)
      }
    }
  }
  // O friso: inteiro atrás e na frente, e nos lados partido nas divisas.
  tabua(-xE, -yE, xE, -yT - meia, 0, TOM_DO_FRISO)
  tabua(-xE, yT + meia, xE, yE, 0, TOM_DO_FRISO)
  const pedacosDoFriso: readonly (readonly [number, number])[] = [
    [-yT + meia, -yL - meia],
    [-yL + meia, divisas[2] - meia],
    [divisas[2] + meia, yL - meia],
    [yL + meia, yT - meia],
  ]
  for (const lado of [-1, 1]) {
    for (const [y0, y1] of pedacosDoFriso) tabua(lado < 0 ? -xE : xT + meia, y0, lado < 0 ? -xT - meia : xE, y1, QUARTO, TOM_DO_FRISO)
  }
}

// ---------- os postes e as almofadas ----------

/** O pano da almofada: a costura em volta, no topo. */
function texDoTopoDaAlmofada(cx: number, cy: number): Textura {
  const pano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (pano !== null) pano(u, v, x, y, p, s, escala)
    if (escala < ESCALA_DO_DETALHE) return
    s[3] -= 0.09 * naLinha(0.2, Math.abs(distancia(x - cx, y - cy) - RAIO_DA_ALMOFADA * 0.6), escala)
  }
}

/** O corpo da almofada (só a 3/4 o mostra): as costuras do acolchoado, de través. */
function texDoCorpoDaAlmofada(y0: number): Textura {
  const pano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (pano !== null) pano(u, v, x, y, p, s, escala)
    const f = (y - y0) / PASSO_DO_ACOLCHOADO
    s[3] -= 0.12 * naLinha(0.3, Math.abs(f - Math.round(f)) * PASSO_DO_ACOLCHOADO, escala)
  }
}

/**
 * Os postes e as almofadas. O poste é coluna de madeira do chão ao topo, com a tampa abaulada. A almofada é um
 * tampo solto (pino) com o corpo de pano de pé, guardado debaixo da lona: o de trás desce para o sul a partir do
 * topo da almofada; o da frente sobe para o norte a partir do pé dela (o sul do poste da frente já é a passarela),
 * e o topo dele é outro pino. Devolve os corpos (vão debaixo da lona) e as cimas (vão por cima das cordas).
 */
function montarPostes(c: ContextoDoMovel, tela: Cena, r: Ringue, cantos: readonly Canto[]): { corpos: Peca[]; cimas: Peca[] } {
  const { g, peca: P } = c
  const mad = c.m.madeira
  const corpos: Peca[] = []
  const cimas: Peca[] = []
  const pe = r.zTablado + PE_DA_ALMOFADA * g
  const topo = r.zTablado + TOPO_DA_ALMOFADA * g
  const alto = topo - pe
  cantos.forEach(({ sx, sy, cor }, i) => {
    const cx = sx * r.xP
    const cy = sy * r.yP
    const atras = sy < 0
    const vez = atras ? r.divisas[2] : r.divisas[3]
    const vezDoPoste = vez + (atras ? VEZ_DO_PRIMEIRO : VEZ_DO_SEGUNDO)
    const vezDaAlmofada = vez + (atras ? VEZ_DO_SEGUNDO : VEZ_DO_PRIMEIRO)
    const pano: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: cor }
    const ax = cx - sx * RECUO_DA_ALMOFADA
    const ay = cy - sy * RECUO_DA_ALMOFADA
    const doCorpo = { bisel: RAIO_DA_ALMOFADA * 0.8, contorno: 0.26, tom: 0.9, semente: 7400 + i }
    const doTopo = { bisel: 1.6, ruga: 0.5, contorno: 0.28, textura: texDoTopoDaAlmofada(ax, ay), semente: 7410 + i }
    const topoDaAlmofada = elipse(ax, ay, RAIO_DA_ALMOFADA, RAIO_DA_ALMOFADA)
    if (atras) {
      const meio = ay + alto / 2
      tela.sombras.push({ forma: pino(ax, meio, vezDaAlmofada), z: topo, solta: true, forca: 0 })
      corpos.push(P(capsula(ax, ay, ax, ay + alto, RAIO_DA_ALMOFADA), pano, { ...doCorpo, textura: texDoCorpoDaAlmofada(ay) }))
      cimas.push(P(centrada(topoDaAlmofada, ax, meio), pano, doTopo))
    } else {
      const meio = ay - alto / 2
      tela.sombras.push({ forma: pino(ax, meio, vezDaAlmofada), z: pe, solta: true, forca: 0 })
      corpos.push(P(capsula(ax, ay - alto, ax, ay, RAIO_DA_ALMOFADA), pano, { ...doCorpo, textura: texDoCorpoDaAlmofada(ay - alto) }))
      // O pino do topo fica fora do poste: o poste é mais alto e levaria a peça.
      const fora = ay - RAIO_DA_ALMOFADA + RECUO_DA_ALMOFADA
      tela.sombras.push({ forma: pino(ax, fora, vezDaAlmofada), z: topo, solta: true, forca: 0 })
      cimas.push(P(centrada(topoDaAlmofada, ax, fora), pano, doTopo))
    }
    const poste = elipse(cx, cy, RAIO_DO_POSTE, RAIO_DO_POSTE)
    tela.sombras.push({ forma: comBase(poste, vezDoPoste), z: r.zTablado + TOPO_DO_POSTE * g, forca: 0 })
    cimas.push(P(poste, mad, { tabua: 0, bisel: 1.2, contorno: 0.28, tom: 0.9, semente: 7420 + i }))
    cimas.push(P(elipse(cx - 0.25, cy - 0.25, RAIO_DA_TAMPA, RAIO_DA_TAMPA), mad, { tabua: 0, bisel: RAIO_DA_TAMPA, contorno: 0.2, tom: 1.08, semente: 7430 + i }))
  })
  return { corpos, cimas }
}

/** As formas que a 3/4 sobe: peça do tablado com o meio dentro delas subiria junto. */
function formasOcupadas(r: Ringue, cantos: readonly Canto[], lutadores: readonly CantoDeLutador[]): Forma[] {
  const lista: Forma[] = cantos.map(({ sx, sy }) => elipse(sx * r.xP, sy * r.yP, RAIO_DO_POSTE, RAIO_DO_POSTE))
  for (const l of lutadores) {
    lista.push(elipse(l.xBanco, meioDoAssento(l.baseDoBanco), RAIO_DO_ASSENTO, RAIO_DO_ASSENTO))
    for (const lado of [-1, 1]) lista.push(pernaDoBanco(l.xBanco + lado * ABERTURA_DAS_PERNAS, l.baseDoBanco))
    lista.push(elipse(l.xBalde, l.baseDoBalde - RAIO_DO_BALDE, RAIO_DO_BALDE, RAIO_DO_BALDE))
  }
  return lista
}

// ---------- o banquinho e o balde ----------

function pernaDoBanco(x: number, base: number): Forma {
  return caixa(x - LADO_DA_PERNA / 2, base - LADO_DA_PERNA, x + LADO_DA_PERNA / 2, base)
}

/** A toalha dobrada: as duas listras da cor do canto perto das pontas e a dobra do meio. */
function texDaToalha(cx: number, cy: number, cor: Rgb): Textura {
  const pano = texturaDaClasse('tecido')
  const co = Math.cos(TOALHA.giro)
  const si = Math.sin(TOALHA.giro)
  return (u, v, x, y, p, s, escala) => {
    if (pano !== null) pano(u, v, x, y, p, s, escala)
    const ao = (x - cx) * co + (y - cy) * si
    const atraves = -(x - cx) * si + (y - cy) * co
    misturarEm(s, cor, 0.85 * naLinha(TOALHA.meiaListra, Math.abs(Math.abs(ao) - TOALHA.listra), escala))
    s[3] -= 0.1 * naLinha(0.2, Math.abs(atraves - TOALHA.dobra), escala)
  }
}

/**
 * O banquinho redondo de três pernas, com a toalha dobrada no assento. As pernas da frente sobem do chão até o
 * assento (o pé delas abaixo das tábuas fica tapado pela faixa seguinte); o assento é um tampo solto com a base um
 * nada ao sul da das pernas, então sai depois delas.
 */
function montarBanquinho(c: ContextoDoMovel, tela: Cena, r: Ringue, l: CantoDeLutador, i: number): void {
  const { g, peca: P } = c
  const L = tela.partes
  const mad = c.m.madeira
  const base = l.baseDoBanco
  const cx = l.xBanco
  const zAssento = r.zTablado + ALTURA_DO_BANQUINHO * g
  for (const lado of [-1, 1]) {
    tela.sombras.push({ forma: comBase(pernaDoBanco(cx + lado * ABERTURA_DAS_PERNAS, base), base + VEZ_DAS_CORDAS), z: zAssento - GROSSURA_DO_ASSENTO, forca: 0 })
  }
  const cy = meioDoAssento(base)
  const assento = elipse(cx, cy, RAIO_DO_ASSENTO, RAIO_DO_ASSENTO)
  tela.sombras.push({ forma: assento, z: zAssento, solta: true, forca: 0 })
  L.push(P(assento, mad, { dy: GROSSURA_DO_ASSENTO, tabua: 0, bisel: 0.8, contorno: 0.24, tom: 0.62, semente: 7500 + i }))
  L.push(P(assento, mad, { eixo: 0.4, tabua: 0, bisel: 1.5, contorno: 0.26, tom: 1.04, semente: 7502 + i }))
  const tx = cx + TOALHA.dx
  const ty = cy + TOALHA.dy
  const meia = TOALHA.comprimento / 2
  const co = Math.cos(TOALHA.giro)
  const si = Math.sin(TOALHA.giro)
  L.push(
    P(barra(tx - co * meia, ty - si * meia, tx + co * meia, ty + si * meia, TOALHA.largura), TOALHA_CRUA, {
      bisel: 1.1,
      ruga: 0.6,
      contorno: 0.26,
      textura: texDaToalha(tx, ty, l.canto.cor),
      semente: 7504 + i,
      projeta: { dist: 1.1, forca: 0.32, suave: 0.7 },
    }),
  )
}

/** A água: a boca faz sombra nela do lado da luz. */
function texDaAgua(cx: number, cy: number, raio: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const d = distancia(x - cx + 0.6, y - cy + 0.5) - raio
    s[3] += -0.34 * limitar01(0.5 + d / 0.8) + ruido(x * 0.6, y * 0.6) * 0.06
  }
}

/** O balde de aduelas com a boca de ferro, a água e a esponja boiando. */
function montarBalde(c: ContextoDoMovel, tela: Cena, r: Ringue, l: CantoDeLutador, i: number): void {
  const { g, peca: P } = c
  const L = tela.partes
  const mad = c.m.madeira
  const bx = l.xBalde
  const by = l.baseDoBalde - RAIO_DO_BALDE
  const boca = elipse(bx, by, RAIO_DO_BALDE, RAIO_DO_BALDE)
  tela.sombras.push({ forma: comBase(boca, l.baseDoBalde + VEZ_DAS_CORDAS), z: r.zTablado + ALTURA_DO_BALDE * g, forca: 0 })
  // Os aros do costado, que só a 3/4 mostra: a meia argola do lado de baixo, cada uma num pino na altura dela, ao
  // lado do balde, para dentro do ringue (onde não há mais nada), com a vez logo depois dele. Sem o que a boca, mais
  // alta, cobre na 3/4: senão o aro passaria por cima da água. Na vista de cima a boca tapa os dois.
  const zBoca = r.zTablado + ALTURA_DO_BALDE * g
  const metade = caixa(bx - RAIO_DO_BALDE, by, bx + RAIO_DO_BALDE, by + RAIO_DO_BALDE)
  const rDentro = RAIO_DO_BALDE - LARGURA_DO_ARO
  const px = bx - l.canto.sx * (RAIO_DO_BALDE + 1)
  AROS_DO_COSTADO.forEach((fracao, k) => {
    const z = r.zTablado + fracao * ALTURA_DO_BALDE * g
    const argola = dentroDe(anel(bx, by, RAIO_DO_BALDE, RAIO_DO_BALDE, rDentro, rDentro), metade)
    const aro = menos(argola, elipse(bx, by - (zBoca - z), RAIO_DO_BALDE, RAIO_DO_BALDE))
    tela.sombras.push({ forma: pino(px, by, l.baseDoBalde + VEZ_DOS_AROS), z, solta: true, forca: 0 })
    L.push(P(centrada(aro, px, by), FERRO, { bisel: 0.4, contorno: 0.3, metal: 0.3, tom: 0.85, semente: 7610 + 2 * i + k }))
  })
  const polar = { cx: bx, cy: by, r: RAIO_DO_BALDE }
  const rAro = RAIO_DO_BALDE * ARO_DO_BALDE
  const rAgua = RAIO_DO_BALDE * AGUA_DO_BALDE
  L.push(P(boca, mad, { polar, tabua: 1.3, bisel: 0.9, contorno: 0.28, tom: 0.94, semente: 7600 + i }))
  L.push(P(anel(bx, by, RAIO_DO_BALDE * 0.99, RAIO_DO_BALDE * 0.99, rAro, rAro), FERRO, { bisel: 0.5, contorno: 0.3, metal: 0.3, semente: 7602 + i }))
  L.push(P(elipse(bx, by, rAgua, rAgua), AGUA, { bisel: 0, contorno: 0.15, textura: texDaAgua(bx, by, rAgua), semente: 7604 + i }))
  L.push(P(elipse(bx - 1.2, by + 1.3, 1.3, 0.5), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.2, suave: 0.4 }))
  const ex = bx + ESPONJA.dx
  const ey = by + ESPONJA.dy
  L.push(P(caixa(ex - ESPONJA.meiaX, ey - ESPONJA.meiaY, ex + ESPONJA.meiaX, ey + ESPONJA.meiaY, 0.6), AMARELO_DA_ESPONJA, { bisel: 0.6, ruga: 1.2, contorno: 0.26, semente: 7606 + i, projeta: { dist: 0.6, forca: 0.3, suave: 0.5 } }))
}

// ---------- o ringue ----------

export const montarRingueDeLuta: MontarMovel = (c, cena) => {
  const q = quartosDoGiro(c.giro)
  const r = geometria(c, q)
  const cantos = cantosNaTela(q)
  const lutadores = cantos.filter((k) => k.doLutador).map((k) => cantoDeLutador(r, k))
  const tela: Cena = { partes: [], sombras: [] }
  const sombras = sombrasPintadas(r, cantos, lutadores)
  const { corpos, cimas } = montarPostes(c, tela, r, cantos)
  montarTablado(c, tela, r, sombras, formasOcupadas(r, cantos, lutadores), corpos)
  montarCordas(c, tela, r)
  tela.partes.push(...cimas)
  lutadores.forEach((l, i) => {
    montarBalde(c, tela, r, l, i)
    montarBanquinho(c, tela, r, l, i)
  })
  cenaNoObjeto(tela, q, cena)
}
