/**
 * A TENDA de acampamento (lote 17 dos objetos novos, 12/11/2026): a barraca
 * de lona de viajante, de caçador ou de soldado, para o acampamento na mata,
 * o posto de guarda ou o cerco. Não é a tenda de adivinha (redonda, de pano
 * escuro, enfeitada) nem o toldo listrado (pano esticado no ar): é a tenda de
 * campanha de duas águas, de lona grossa (`lona`, linho cru de partida),
 * encardida na barra e remendada. A cumeeira fica no meio, em cima de dois
 * mastros (`madeira`) cujas pontas passam dela nas duas pontas da tenda; as
 * duas águas descem até o chão, presas na bainha por estaquinhas, com a
 * barriga do pano entre os mastros e as pregas que saem da ponta deles. A
 * entrada fica na ponta do sul: as duas abas abertas e amarradas para os
 * lados, o escuro de dentro e a ponta da esteira de palha, com a manta de lã
 * dobrada em cima, saindo pela porta. Cordas esticadas vão da ponta de cada
 * mastro (duas, em V) e das beiras das águas (uma a cada passo) até estacas
 * cravadas no chão em volta, cada uma com a sombra dela. Um remendo costurado
 * na água do oeste e manchas de chuva nas duas. Sem gente e sem fogueira.
 *
 * DE CIMA a água do oeste, virada para a luz, fica clara e a do leste fica na
 * sombra, como num telhado de duas águas; o que diz que é tenda são as cordas
 * com as estacas em volta e, na ponta da frente, o recorte escuro da porta (a
 * convenção da tenda de adivinha), com a ponta do mastro na beira, a trouxa
 * de cada aba dos dois lados do recorte e a esteira saindo.
 *
 * NA 3/4 a tenda é desenhada na tela, montada pelas âncoras da tenda de
 * adivinha (as do gancho com carne): cada peça é de uma vista só. Sem giro, a
 * frente em triângulo com a porta aberta como uma cortina presa dos dois lados
 * (o escuro de dentro com a esteira, o mastro de pé no vão, a trouxa de cada
 * aba amarrada e as pregas que a amarra puxa) e, atrás dela, as duas águas
 * subindo até a ponta do mastro do fundo. De costas, a empena de trás, fechada
 * pela costura atada. De lado (um quarto de volta), a água que fica de frente
 * para quem olha, com a cumeeira cedendo um nada no meio do vão, a ponta dos
 * mastros nas duas pontas e, na ponta da porta, as trouxas e a esteira no
 * chão. Lê `c.giro` (o giro
 * só chega na 3/4): a luz das águas, a da empena e as sombras ficam no lugar
 * na tela; o remendo e as manchas vão com a lona para onde o giro a leva.
 *
 * ESTICADA para o comprido, a lona fica mais comprida e o corte da tenda não
 * muda (a largura e a altura saem da largura da pegada): repetem-se os panos
 * costurados, as cordas dos lados, as estaquinhas da bainha e, passado um vão
 * de mais de 2,2 casas, entra um mastro no meio. A porta não estica.
 */
import type { Rgb } from '../../ruido'
import { anel, caixa, cadeia, capsula, dentroDe, elipse, menos, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, TOM_DA_CORDA, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- os materiais fixos (a lona e a madeira, o mestre escolhe) ----------

const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
/** O chão de dentro, na sombra da lona, visto pela porta: terra escura e quente. */
const DENTRO: MaterialDaPeca = { classe: 'liso', rgb: [0x3d, 0x32, 0x27] }
/** A esteira de palha que sai pela porta e a manta de lã parda dobrada nela. */
const ESTEIRA: MaterialDaPeca = materialDaPeca('palha')
const MANTA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x80, 0x57, 0x42] }
/** A sombra pintada: a da corda na lona e a do mastro em volta da ponta dele. */
const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [14, 11, 8] }
/** O remendo é de outro pano, mais amarelado (de um saco de grão): a cor da lona levada esta parte do caminho até ele. */
const PANO_DO_REMENDO: Rgb = [0xb8, 0x98, 0x62]
const PARTE_DO_PANO_DO_REMENDO = 0.45
/** O tom do remendo, sobre o da água em que foi costurado: nem mais claro (vira papel) nem mais escuro (vira buraco). */
const TOM_DO_REMENDO = 1
/** A terra que encarde a barra da lona. */
const COR_DA_TERRA: Rgb = [0x6a, 0x55, 0x40]

// ---------- as medidas (px do protótipo numa tenda de 2 casas de largura; crescem com a largura) ----------

/** Da beira da lona à beira da pegada: dos lados (as cordas das beiras) e nas pontas (as cordas dos mastros). */
const FOLGA_DOS_LADOS = 17
const FOLGA_DAS_PONTAS = 20
/** A lona nunca fica mais curta que esta fração do comprimento da pegada (a pegada curta e larga). */
const COMPRIMENTO_MINIMO = 0.45
/** A altura da cumeeira, em casas; quanto a ponta do mastro passa dela e o raio do mastro (px). */
const ALTURA_DA_CUMEEIRA = 1.1
const PONTA_DO_MASTRO = 6.5
const RAIO_DO_MASTRO = 1.3
/** Esticada, a tenda ganha um mastro no meio a cada vão deste comprimento (px). */
const VAO_ENTRE_MASTROS = 125
/** Sem vara de cumeeira, a lona cede no meio de cada vão esta fração dele (só se nota de lado); a curva é desenhada com estes pontos por vão. */
const CEDE_DA_CUMEEIRA = 0.025
const PONTOS_POR_VAO = 10
/** A fita da cumeeira (o raio) e quanto a água de baixo passa dela (fica debaixo da outra, sem chanfro na emenda). */
const RAIO_DA_CUMEEIRA = 1.25
const PASSA_DA_CUMEEIRA = 0.6
/** As estacas: o recuo da beira da pegada, o raio, a altura fora do chão e o quanto deitam para fora (px). */
const RECUO_DA_ESTACA = 3.5
const RAIO_DA_ESTACA = 1.35
const ALTURA_DA_ESTACA = 4.6
const DEITADA = 1.2
const RAIO_DA_CORDA = 0.5
/** As cordas dos mastros: a meia abertura do V no chão (fração da meia largura) e a amarra, abaixo da ponta (px). */
const ABERTURA_DO_V = 0.75
const AMARRA_NO_MASTRO = 2.2
/** As cordas das beiras: o passo entre elas, a altura da amarra na lona (fração da altura) e quanto as das pontas abrem (px). */
const PASSO_DAS_CORDAS = 33
const ALTURA_DA_AMARRA = 0.2
const ABERTURA_DAS_CORDAS = 7
/** A bainha: o passo das estaquinhas, o quanto ficam fora da beira, o raio e a barriga da beira entre duas delas (px). */
const PASSO_DA_BAINHA = 11.5
const FORA_DA_BAINHA = 2.2
const RAIO_DA_ESTAQUINHA = 0.75
const ALTURA_DA_ESTAQUINHA = 1.7
const BARRIGA_DA_BEIRA = 0.5
/** A largura de cada pano de lona costurado (px). */
const PANO = 24
/**
 * A porta, como uma cortina presa dos lados: a altura da amarra de cada aba
 * (fração da altura), o quanto ela fica para dentro da beira da empena nessa
 * altura (fração da meia largura da empena ali), a meia largura do vão no chão
 * (fração da meia largura) e o alto do vão (fração da altura).
 */
const PORTA = { amarra: 0.36, puxada: 0.62, pe: 0.3, alto: 0.94 } as const
/** A porta vista de cima: o fundo do recorte escuro (px). */
const FUNDO_DA_PORTA = 12
/**
 * A trouxa de cada aba: o pano juntado na amarra, da beira do vão à beira da
 * empena, com a corda por cima (px): o quanto ela entra no vão e o quanto fica
 * longe da beira da empena, a meia altura do bojo e o quanto sai da empena.
 */
const TROUXA = { entra: 0.6, folga: 0.8, meiaAltura: 2.3, sai: 1.3 } as const
/** O passo das dobras de pé da trouxa (radianos por px). */
const PASSO_DAS_DOBRAS = 1.15
/** As pregas que a amarra puxa na aba: quantas meias-voltas no leque, o alcance (fração da altura) e a luz. */
const PREGAS_DA_ABA = { voltas: 12, alcance: 0.6, luz: 0.12 } as const
/** A esteira e a manta: a meia largura, até onde vão lá dentro e quanto saem pela porta (px); a manta vai torta. */
const MEDIDAS_DA_ESTEIRA = { meia: 6.5, dentro: 18, fora: 10 } as const
const MEDIDAS_DA_MANTA = { meia: 4.6, dentro: 7, fora: 3.2, desvio: 1.2, giro: 0.12 } as const
/** A costura da porta de trás, fechada: as alturas das atadeiras (fração da altura). */
const ATADEIRAS = [0.16, 0.36, 0.56, 0.76] as const
/** Na 3/4, quanto a base comum das âncoras fica além da pegada (px): todas as peças sobem na ordem em que entram. */
const BASE_DA_ORDEM = 8

/** Os dois lados da tenda (-1 oeste, 1 leste) e as duas pontas (-1 a de trás, 1 a da porta). */
const LADOS = [-1, 1] as const
const PONTAS = [-1, 1] as const

// ---------- a luz ----------

/** A luz do pintor (`motor.ts`), de cima à esquerda. */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
/** Quanto a água virada para a luz clareia (e a do outro lado escurece): menos que a conta do motor, como o cone da adivinha. */
const LADO_DA_AGUA = 0.36
/** A empena é de pé e fica de frente para quem olha: o tom e o quanto clareia à esquerda, de onde vem a luz. */
const TOM_DA_EMPENA = 0.82
const LADO_DA_EMPENA = 0.12
/** O que se vê lá dentro, pela porta, fica neste tom, e escurece isto até o fundo da esteira. */
const TOM_DE_DENTRO = 0.6
const ESCURO_DO_FUNDO = 0.3

// ---------- a lona: o encardido, as costuras, a barriga e as pregas ----------

/** A barra encardida: a faixa junto do chão (px) e o quanto ela escurece e puxa para a terra. */
const BARRA_SUJA = 10
const SUJEIRA = 0.17
/** A bainha da beira: a largura dela (px). */
const BAINHA = 1.9
/** As pregas da ponta de cada mastro e de cada amarra: quantas meias-voltas no leque, o alcance (px) e a luz. */
const PREGAS_DO_MASTRO = { voltas: 9, alcance: 30, luz: 0.075 } as const
const PREGAS_DA_AMARRA = { voltas: 7, alcance: 8.5, luz: 0.06 } as const
/** A barriga do pano entre dois mastros: quanto a luz muda no meio da água. */
const BARRIGA = 0.07
/** A costura entre dois panos: a meia largura do risco e o escuro dele; a aba do pano de cima (largura, px) e a luz dela. */
const COSTURA = { meia: 0.55, escuro: 0.12, aba: 1.6, claro: 0.035 } as const
/** A mancha de chuva: o escuro de dentro, o da linha da água seca na beira e a largura dela (fração do raio). */
const MANCHA = { dentro: 0.045, beira: 0.09, largura: 0.1 } as const
/** O quadrado de reforço de cada amarra (meio lado, px) e o escuro dele. */
const REFORCO = { meio: 1.5, escuro: 0.06 } as const
/** Abaixo desta escala (pixels da imagem por px do protótipo), o risco miúdo das costuras some: no tamanho de mesa virava ruído. */
const ESCALA_DO_DETALHE = 1.5
/** O pesponto do remendo: o recuo da beira (px, de través e ao longo), a meia largura do risco e o passo dos pontos. */
const PESPONTO = { recuoX: 0.65, recuoY: 1.2, meia: 0.28, passo: 1.9 } as const

// ---------- a sombra no chão ----------

const FORCA_DA_SOMBRA = 0.3
const SUAVE_DA_SOMBRA = 2.4
const FORCA_DA_SOMBRA_DA_CORDA = 0.15
const FORCA_DO_CONTATO = 0.32

// ---------- as medidas de uma tenda ----------

interface Mancha {
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
  readonly semente: number
}

interface Remendo {
  readonly x: number
  readonly y: number
  /** A meia largura (de través) e o meio comprimento (ao longo da cumeeira), no chão, vistos de cima. */
  readonly mx: number
  readonly my: number
  readonly giro: number
}

interface Tenda {
  /** Escala do detalhe (1 numa tenda de 2 casas de largura). */
  readonly k: number
  /** Meia pegada. */
  readonly sx: number
  readonly sy: number
  /** Meia largura da lona no chão (a beira), meio comprimento e altura da cumeeira. */
  readonly E: number
  readonly L: number
  readonly H: number
  readonly ponta: number
  /** O y de cada mastro, de trás para a frente (o primeiro e o último são os das pontas). */
  readonly mastros: readonly number[]
  /** O quanto a cumeeira cede no meio de cada vão e os y em que ela é desenhada, de trás para a frente. */
  readonly cede: number
  readonly cumeeira: readonly number[]
  /** O y de cada corda das beiras. */
  readonly laterais: readonly number[]
  /** O y de cada costura entre dois panos. */
  readonly costuras: readonly number[]
  /** O y de cada estaquinha da bainha. */
  readonly bainha: readonly number[]
  readonly manchas: readonly Mancha[]
  readonly remendo: Remendo
}

/** `n` + 1 pontos de `de` a `ate`, as pontas inclusive. */
function repartir(de: number, ate: number, n: number): number[] {
  return Array.from({ length: n + 1 }, (_, i) => de + ((ate - de) * i) / n)
}

function medir(c: ContextoDoMovel): Tenda {
  const k = c.hw / G
  const E = c.hw - FOLGA_DOS_LADOS * k
  const L = Math.max(c.hh - FOLGA_DAS_PONTAS * k, c.hh * COMPRIMENTO_MINIMO)
  const vaos = Math.max(1, Math.ceil((2 * L) / (VAO_ENTRE_MASTROS * k)))
  const cordas = Math.max(2, Math.round((2 * L) / (PASSO_DAS_CORDAS * k)))
  const panos = Math.max(2, Math.round((2 * L) / (PANO * k)))
  const estaquinhas = Math.max(4, Math.round((2 * L) / (PASSO_DA_BAINHA * k)))
  return {
    k,
    sx: c.hw,
    sy: c.hh,
    E,
    L,
    H: ALTURA_DA_CUMEEIRA * G * k,
    ponta: PONTA_DO_MASTRO * k,
    mastros: repartir(-L, L, vaos),
    cede: (CEDE_DA_CUMEEIRA * 2 * L) / vaos,
    cumeeira: repartir(-L, L, vaos * PONTOS_POR_VAO),
    laterais: Array.from({ length: cordas }, (_, i) => -L + ((i + 0.5) * 2 * L) / cordas),
    costuras: repartir(-L, L, panos).slice(1, -1),
    bainha: repartir(-L, L, estaquinhas),
    manchas: [
      { x: -0.47 * E, y: -0.4 * L, rx: 8.5 * k, ry: 7 * k, semente: 11 },
      { x: 0.52 * E, y: 0.32 * L, rx: 6.2 * k, ry: 5.2 * k, semente: 23 },
    ],
    remendo: { x: -0.5 * E, y: 0.2 * L, mx: 4.4 * k, my: 7 * k, giro: 0.1 },
  }
}

/** A altura da lona acima do chão no x dado (zero na beira). */
function alturaDaLona(t: Tenda, x: number): number {
  return t.H * (1 - Math.min(1, Math.abs(x) / t.E))
}

/** A amarra da corda da beira na lona, (x, y, z) do objeto. */
function amarraDoLado(t: Tenda, lado: number, y: number): [number, number, number] {
  return [lado * t.E * (1 - ALTURA_DA_AMARRA), y, t.H * ALTURA_DA_AMARRA]
}

/** A estaca da corda da beira: as das pontas da tenda abrem um pouco para fora. */
function estacaDoLado(t: Tenda, lado: number, y: number): Ponto {
  return [lado * (t.sx - RECUO_DA_ESTACA * t.k), y + (ABERTURA_DAS_CORDAS * t.k * y) / t.L]
}

/** A amarra das cordas do mastro da ponta, (x, y, z) do objeto. */
function amarraDoMastro(t: Tenda, ponta: number): [number, number, number] {
  return [0, ponta * t.L, t.H + t.ponta - AMARRA_NO_MASTRO * t.k]
}

/** A estaca de uma perna do V da ponta. */
function estacaDaPonta(t: Tenda, ponta: number, lado: number): Ponto {
  return [lado * ABERTURA_DO_V * t.E, ponta * (t.sy - RECUO_DA_ESTACA * t.k)]
}

/**
 * O contorno de uma água em (x, y, z) do objeto: a cumeeira de trás, a beira
 * presa pelas estaquinhas (puxada nelas, com a barriga entre duas) e a
 * cumeeira da frente. `passa` = quanto ela passa da cumeeira, para o outro lado.
 */
function contornoDaAgua(t: Tenda, lado: number, passa: number): [number, number, number][] {
  const barriga = BARRIGA_DA_BEIRA * t.k
  const pontos: [number, number, number][] = []
  t.bainha.forEach((y, i) => {
    pontos.push([lado * (t.E + barriga), y, 0])
    if (i < t.bainha.length - 1) pontos.push([lado * (t.E - barriga), (y + t.bainha[i + 1]) / 2, 0])
  })
  // A cumeeira, da frente para trás, cedendo um nada no meio de cada vão entre dois mastros.
  for (const y of [...t.cumeeira].reverse()) pontos.push([-lado * passa, y, alturaDaCumeeira(t, y)])
  return pontos
}

/** A altura da cumeeira no y dado: a do mastro, menos o quanto a lona cede no vão. */
function alturaDaCumeeira(t: Tenda, y: number): number {
  return t.H - t.cede * barrigaNoVao(t, y)
}

/** Os quatro cantos do remendo, em (x, y, z) do objeto (ele fica deitado na água do oeste). */
function cantosDoRemendo(t: Tenda): [number, number, number][] {
  const r = t.remendo
  const c = Math.cos(r.giro)
  const s = Math.sin(r.giro)
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]): [number, number, number] => {
    const x = r.x + a * r.mx * c - b * r.my * s
    return [x, r.y + a * r.mx * s + b * r.my * c, alturaDaLona(t, x)]
  })
}

// ---------- o giro ----------

/** Os quartos de volta do giro do objeto (0 a 3). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela, como o `girarPonto` de `tresQuartos.ts`. */
function girarPonto(x: number, y: number, q: number): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** A forma girada `q` quartos de volta, como o `girarForma` de `tresQuartos.ts`. */
function girarForma(f: Forma, q: number): Forma {
  if (q === 0) return f
  const b = f.b
  const girada: Caixa = q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [b[1], -b[2], b[3], -b[0]]
  const volta = 4 - q
  return {
    b: girada,
    d: (x, y) => {
      const [mx, my] = girarPonto(x, y, volta)
      return f.d(mx, my)
    },
  }
}

/** O ponto (x, y, z) do objeto na tela da 3/4, com o objeto girado `q` quartos de volta: o chão gira, a altura sobe. */
function naTela(q: number, x: number, y: number, z: number): Ponto {
  const [tx, ty] = girarPonto(x, y, q)
  return [tx, ty - z]
}

/** O tom da água do lado `lado` com o objeto girado `q`: pela normal dela e a luz na tela, o mesmo de cima e na 3/4. */
function tomDaAgua(t: Tenda, lado: number, q: number): number {
  const inclinacao = Math.atan2(t.H, t.E)
  const [nx, ny] = girarPonto(lado * Math.sin(inclinacao), 0, q)
  const nl = nx * LUZ_X + ny * LUZ_Y + Math.cos(inclinacao) * LUZ_Z
  return 1 + LADO_DA_AGUA * (nl - LUZ_Z)
}

// ---------- a peça de uma vista só e a âncora (as da tenda de adivinha e do gancho com carne) ----------

/**
 * A peça só é pintada NO LUGAR em que foi desenhada (`dy` zero). A 3/4 sobe
 * cada peça mexendo no `dy` dela: a da vista de cima (nasce com `dy` zero)
 * some quando sobe, e a de frente (nasce deslocada a altura da âncora) aparece
 * quando a 3/4 a traz de volta.
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

/** A mesma forma com a caixa de pintura centrada em (cx, cy): é o meio da caixa que a 3/4 lê para saber em que âncora a peça está. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

/** A âncora só contém o próprio ponto, com esta folga de conta; fora dele está longe de tudo, e nada dela é pintado. */
const RAIO_DA_ANCORA = 1e-6
const FORA_DA_ANCORA = 1e3
const BORDA_DA_ANCORA = 0.05
/** Cada grupo aberto fica isto mais ao sul que o anterior: na mesma base, a 3/4 os pinta na ordem em que foram abertos. */
const PASSO_DA_ORDEM = 1e-3
/** O que só aparece de cima sobe quase nada na 3/4: o bastante para sair do lugar e sumir. */
const QUASE_NADA = 0.02

/** A âncora de um grupo no ponto (x, y) do chão da pegada já girada; `q` = os quartos de volta que a 3/4 ainda vai dar na cena. */
function ancorar(cena: Cena, q: number, x: number, y: number, z: number): void {
  const ponto: Forma = {
    b: [x, y, x, y],
    d: (px, py) => (Math.abs(px - x) < RAIO_DA_ANCORA && Math.abs(py - y) < RAIO_DA_ANCORA ? -1 : FORA_DA_ANCORA),
  }
  cena.sombras.push({ forma: girarForma(ponto, (4 - q) % 4), z, solta: true, forca: 0, suave: BORDA_DA_ANCORA })
}

/** A peça de uma vista só não tem deslocamento nem sombra própria (a sombra dela cairia na outra vista). */
type OpcoesDaVista = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>

/** Põe uma peça num grupo (a lista vai de baixo para cima). */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaVista) => void

/** Um grupo de peças que sobem juntas, com a caixa de pintura justa em volta de `b`. */
type Grupo = (b: Caixa) => Por

/** Um grupo que só aparece na vista de cima, em volta de (x, y): sobe quase nada na 3/4 e some. */
function grupoDeCima(P: CriarPeca, cena: Cena, x: number, y: number): Por {
  ancorar(cena, 0, x, y, QUASE_NADA)
  return (forma, mat, o = {}) => {
    cena.partes.push(P(presa(forma, x, y), mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
  }
}

/** A tela da 3/4: quem desenha nela escreve em coordenadas da tela, com a pegada já girada. */
interface Tela {
  /** Abre um grupo de peças que sobem juntas: (x, base) dá a ordem do grupo; `meio` = o y da tela em volta do qual ficam as caixas, acima da base. */
  grupo(x: number, base: number, meio: number): Por
}

function novaTela(P: CriarPeca, cena: Cena, q: number): Tela {
  const volta = (4 - q) % 4
  let abertos = 0
  return {
    grupo(x, base, meio) {
      const chao = base + abertos * PASSO_DA_ORDEM
      abertos += 1
      const z = chao - meio
      ancorar(cena, q, x, chao, z)
      const [dx, dy] = girarPonto(0, z, volta)
      return (forma, mat, o = {}) => {
        const noMeio = presa(forma, x, meio)
        if (q === 0) {
          cena.partes.push(P(noMeio, mat, { ...o, dy: z, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
          return
        }
        // Girada, a cena só serve à 3/4: a peça sai desgirada (a forma, o veio e o ponto que a textura lê) e a volta da 3/4 a põe como foi desenhada.
        const textura = o.textura
        cena.partes.push(
          P(girarForma(noMeio, volta), mat, {
            ...o,
            dx,
            dy,
            eixo: (o.eixo ?? 0) - q * QUARTO,
            textura:
              textura === undefined
                ? undefined
                : (u, v, tx, ty, p, s, escala) => {
                    const [sx, sy] = girarPonto(tx, ty, q)
                    textura(u, v, sx, sy, p, s, escala)
                  },
          }),
        )
      }
    },
  }
}

// ---------- as texturas ----------

/** O ponto da lona debaixo do ponto pintado: escreve em `saida` o x e o y do chão debaixo dele. */
type Superficie = (x: number, y: number, saida: Float64Array) => void

const DE_CIMA: Superficie = (x, y, s) => {
  s[0] = x
  s[1] = y
}

/** As águas pintadas na tela da 3/4 girada `q`: do ponto da tela de volta ao chão debaixo da lona. */
function aguasNaTela(t: Tenda, q: number): Superficie {
  // De lado, a água de frente desce da cumeeira (y = -H na tela) à beira (y = E): um passo na tela anda isto no chão.
  const deLado = 1 + t.H / t.E
  if (q === 0) {
    return (x, y, s) => {
      s[0] = x
      s[1] = y + alturaDaLona(t, x)
    }
  }
  if (q === 2) {
    return (x, y, s) => {
      s[0] = -x
      s[1] = -(y + alturaDaLona(t, x))
    }
  }
  if (q === 1) {
    return (x, y, s) => {
      s[0] = (y + t.H) / deLado
      s[1] = -x
    }
  }
  return (x, y, s) => {
    s[0] = -(y + t.H) / deLado
    s[1] = x
  }
}

const NA_LONA = new Float64Array(2)

/** A barriga no vão entre dois mastros, no y dado: 0 junto de um mastro, 1 no meio do vão. */
function barrigaNoVao(t: Tenda, y: number): number {
  const m = t.mastros
  for (let i = 1; i < m.length; i += 1) {
    if (y <= m[i]) return Math.max(0, Math.sin((Math.PI * (y - m[i - 1])) / (m[i] - m[i - 1])))
  }
  return 0
}

/** Puxa a cor para a terra (a barra suja), de 0 a 1. */
function encardir(s: Float32Array, quanto: number): void {
  const f = quanto > 0.45 ? 0.45 : quanto
  s[0] += (COR_DA_TERRA[0] - s[0]) * f
  s[1] += (COR_DA_TERRA[1] - s[1]) * f
  s[2] += (COR_DA_TERRA[2] - s[2]) * f
}

/** A barra suja de terra junto do chão: `ateOChao` em px; devolve o escuro, e puxa a cor para a terra. */
function barraSuja(t: Tenda, ateOChao: number, x: number, y: number, s: Float32Array): number {
  const faixa = BARRA_SUJA * t.k
  if (ateOChao >= faixa) return 0
  const f = 1 - Math.max(0, ateOChao) / faixa
  const sujo = SUJEIRA * f * f * (0.7 + ruido(x * 0.45 + 13, y * 0.45) * 0.9)
  encardir(s, sujo * 1.4)
  return sujo
}

/**
 * A lona das águas: o tecido, as manchas largas de encardido, as costuras
 * entre os panos, a barriga do pano entre os mastros, as pregas que saem da
 * ponta de cada mastro e de cada amarra, o reforço das amarras, as manchas de
 * chuva e, junto do chão, a bainha e a barra suja. `clara` = a água na luz (a
 * barriga a escurece; na outra, clareia). `sup` leva o ponto pintado à lona.
 */
function texDaLona(t: Tenda, sup: Superficie, clara: boolean): Textura {
  const pano = texturaDaClasse('tecido')
  const barriga = clara ? -BARRIGA : BARRIGA * 0.6
  const alcanceDoMastro = PREGAS_DO_MASTRO.alcance * t.k
  const alcanceDaAmarra = PREGAS_DA_AMARRA.alcance * t.k
  const reforco = REFORCO.meio * t.k
  const amarra = t.E * (1 - ALTURA_DA_AMARRA)
  const bainha = BAINHA * t.k
  return (u, v, x, y, p, s, escala) => {
    if (pano !== null) pano(u, v, x, y, p, s, escala)
    sup(x, y, NA_LONA)
    const xo = NA_LONA[0]
    const yo = NA_LONA[1]
    const ax = Math.min(Math.abs(xo), t.E)
    const fino = escala >= ESCALA_DO_DETALHE
    let luz = ruido(xo * 0.05 + 31, yo * 0.05) * 0.08 + ruido(xo * 0.21 + 5, yo * 0.21) * 0.025
    // As costuras entre os panos: o risco e, logo ao lado, a aba do pano de cima, que pega luz.
    for (const yc of t.costuras) {
      const d = yo - yc
      if (d > -COSTURA.meia && d < COSTURA.meia) luz -= COSTURA.escuro * (1 - Math.abs(d) / COSTURA.meia)
      else if (d > 0 && d < COSTURA.aba * t.k) luz += COSTURA.claro
    }
    // A barriga entre os mastros, mais funda no meio da água.
    luz += barriga * barrigaNoVao(t, yo) * Math.sin((Math.PI * ax) / t.E)
    // As pregas que saem da ponta de cada mastro, abertas em leque água abaixo.
    for (const ym of t.mastros) {
      const dy = yo - ym
      const r2 = ax * ax + dy * dy
      if (r2 >= alcanceDoMastro * alcanceDoMastro) continue
      const perto = 1 - Math.sqrt(r2) / alcanceDoMastro
      luz += Math.sin(Math.atan2(dy, ax) * PREGAS_DO_MASTRO.voltas + ruido(ax * 0.08 + ym, dy * 0.08) * 2.6) * PREGAS_DO_MASTRO.luz * perto * Math.sqrt(perto)
    }
    // A amarra de cada corda da beira: o reforço costurado e as pregas puxadas em volta dele.
    const dx = ax - amarra
    if (Math.abs(dx) < alcanceDaAmarra) {
      for (const yl of t.laterais) {
        const dy = yo - yl
        if (Math.abs(dy) >= alcanceDaAmarra) continue
        if (Math.abs(dy) < reforco && Math.abs(dx) < reforco) luz -= REFORCO.escuro
        const r = Math.sqrt(dx * dx + dy * dy)
        if (r >= alcanceDaAmarra) continue
        luz += Math.sin(Math.atan2(dy, dx) * PREGAS_DA_AMARRA.voltas + yl) * PREGAS_DA_AMARRA.luz * (1 - r / alcanceDaAmarra)
      }
    }
    // As manchas de chuva: mais escuras por dentro, com a linha da água seca na beira.
    for (const m of t.manchas) {
      const mx = (xo - m.x) / m.rx
      const my = (yo - m.y) / m.ry
      const q2 = mx * mx + my * my
      if (q2 > 2.6) continue
      const r = Math.sqrt(q2) + ruido(xo * 0.32 + m.semente, yo * 0.32) * 0.45
      if (r < 1) luz -= MANCHA.dentro * (0.5 + 0.5 * r)
      const beira = Math.abs(r - 1)
      if (beira < MANCHA.largura) luz -= MANCHA.beira * (1 - beira / MANCHA.largura)
    }
    // Junto do chão: a bainha dobrada, a costura dela e a barra suja de terra.
    const ateOChao = t.E - ax
    if (ateOChao < bainha) {
      luz += 0.03
      if (fino && Math.abs(ateOChao - bainha * 0.6) < 0.3) luz -= 0.1
    }
    luz -= barraSuja(t, ateOChao, xo, yo, s)
    s[3] += luz
  }
}

/**
 * O remendo: a lona mais velha com o fio de través, a beira dobrada que pega
 * luz e o pesponto em volta. `sup` leva o ponto pintado à lona; o remendo é
 * medido no chão, visto de cima (de través ele fica encurtado pela água).
 */
function texDoRemendo(t: Tenda, sup: Superficie): Textura {
  const pano = texturaDaClasse('tecido')
  const r = t.remendo
  const c = Math.cos(r.giro)
  const sn = Math.sin(r.giro)
  const k = t.k
  return (u, v, x, y, p, s, escala) => {
    if (pano !== null) pano(v, u, x, y, p, s, escala)
    sup(x, y, NA_LONA)
    const dx = NA_LONA[0] - r.x
    const dy = NA_LONA[1] - r.y
    const lx = dx * c + dy * sn
    const ly = -dx * sn + dy * c
    const bx = r.mx - Math.abs(lx)
    const by = r.my - Math.abs(ly)
    let luz = ruido(lx * 0.4 + 3, ly * 0.4) * 0.05
    if (bx < 0.45 * k || by < 0.8 * k) luz += 0.045
    if (escala >= ESCALA_DO_DETALHE) {
      const meia = PESPONTO.meia * k
      const deTraves = Math.abs(bx - PESPONTO.recuoX * k) < meia * 0.6 && by > PESPONTO.recuoY * k - meia
      const aoLongo = Math.abs(by - PESPONTO.recuoY * k) < meia && bx > PESPONTO.recuoX * k - meia
      const passo = PESPONTO.passo * k
      if (deTraves && Math.sin((ly * Math.PI * 2) / passo) > 0) luz -= 0.17
      if (aoLongo && Math.sin((lx * Math.PI * 2) / (passo * 0.55)) > 0) luz -= 0.17
    }
    s[3] += luz
  }
}

/** O pano juntado na trouxa de cada aba: as dobras de pé, apertadas pela amarra. */
function texDasDobras(k: number): Textura {
  const pano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (pano !== null) pano(u, v, x, y, p, s, escala)
    s[3] += Math.sin((x * PASSO_DAS_DOBRAS) / k + ruido(x * 0.12, y * 0.25) * 3.2) * 0.08 + ruido(x * 0.3 + 4, y * 0.3) * 0.03
  }
}

/**
 * A empena, de pé e de frente na 3/4: o tecido com a luz do lado (mais clara
 * à esquerda), as pregas que descem da ponta do mastro e as que saem de cada
 * amarra das abas, e a barra suja. (x, y) da tela; `chao` = o y do pé dela.
 */
function texDaEmpena(t: Tenda, chao: number, amarras: readonly Ponto[]): Textura {
  const pano = texturaDaClasse('tecido')
  const alcance = PREGAS_DO_MASTRO.alcance * t.k * 1.3
  const alcanceDaAmarra = PREGAS_DA_ABA.alcance * t.H
  return (u, v, x, y, p, s, escala) => {
    if (pano !== null) pano(u, v, x, y, p, s, escala)
    const f = TOM_DA_EMPENA - LADO_DA_EMPENA * (x / t.E)
    s[0] *= f
    s[1] *= f
    s[2] *= f
    const z = chao - y
    let luz = ruido(x * 0.05 + 77, z * 0.05) * 0.08 + ruido(x * 0.21 + 9, z * 0.21) * 0.025
    // As pregas que descem da ponta do mastro, em leque.
    const dz = t.H - z
    const r2 = x * x + dz * dz
    if (r2 < alcance * alcance) {
      const perto = 1 - Math.sqrt(r2) / alcance
      luz += Math.sin(Math.atan2(x, dz) * 11 + ruido(x * 0.1, z * 0.1) * 2.4) * 0.07 * perto
    }
    // As pregas puxadas de cada amarra das abas: em cima, esticadas até o alto do vão; embaixo, abertas até o chão.
    for (const [ax, az] of amarras) {
      const ddx = x - ax
      const ddz = z - az
      const r = Math.sqrt(ddx * ddx + ddz * ddz)
      if (r >= alcanceDaAmarra) continue
      const perto = 1 - r / alcanceDaAmarra
      luz += Math.sin(Math.atan2(ddz, ddx) * PREGAS_DA_ABA.voltas + ruido(ddx * 0.1 + ax, ddz * 0.1) * 2) * PREGAS_DA_ABA.luz * perto * perto
    }
    luz -= barraSuja(t, z, x, z, s)
    s[3] += luz
  }
}

/** O escuro de dentro, pela porta: quanto mais fundo (mais longe de `chao`, até `fundo` px), mais escuro. */
function texDeDentro(chao: number, fundo: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const f = Math.min(1, Math.max(0, (chao - y) / fundo))
    s[3] += 0.12 * (1 - f) * (1 - f) - 0.1 * f + ruido(x * 0.3, y * 0.3) * 0.05
  }
}

/** O que fica no chão lá dentro (a esteira e a manta): a textura do material, mais escura quanto mais fundo (mais longe de `chao`, até `fundo` px). */
function texLaDentro(mat: MaterialDaPeca, chao: number, fundo: number): Textura {
  const base = texturaDaClasse(mat.classe)
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    s[3] -= ESCURO_DO_FUNDO * Math.min(1, Math.max(0, (chao - y) / fundo))
  }
}

/** Topo de madeira cortada: anéis em volta do centro (a estaca e a ponta do mastro vistas de cima, como o mourão). */
function texDoTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const longe = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.2
    s[3] += Math.sin(longe * 4.2) * 0.04 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.06
  }
}

/** O pano do remendo: a lona do mestre puxada para o pano amarelado do remendo. */
function panoDoRemendo(lona: MaterialDaPeca): MaterialDaPeca {
  const mistura = (i: number): number => lona.rgb[i] + (PANO_DO_REMENDO[i] - lona.rgb[i]) * PARTE_DO_PANO_DO_REMENDO
  return { classe: 'tecido', fio: 'linho', rgb: [mistura(0), mistura(1), mistura(2)] }
}

const OPCOES_DA_LONA: OpcoesDaVista = { tabua: 0, bisel: 1.3, contorno: 0.24, ruga: 0.4 }
const OPCOES_DO_REMENDO: OpcoesDaVista = { tabua: 0, bisel: 0.45, contorno: 0.1, ruga: 0.3 }
const OPCOES_DA_CORDA: OpcoesDaVista = { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.92 }
const OPCOES_DA_SOMBRA: OpcoesDaVista = { tabua: 0, bisel: 0, contorno: 0 }

// ---------- a esteira (a mesma de cima e na 3/4: fica no chão) ----------

/** A manta dobrada, torta, atravessando a soleira: a forma no chão da tela girada `q` (0 de cima). */
function mantaNoChao(t: Tenda, q: number): Forma {
  const k = t.k
  const m = MEDIDAS_DA_MANTA
  const y0 = t.L - m.dentro * k
  const y1 = t.L + m.fora * k
  const meiaY = (y1 - y0) / 2
  const c = Math.cos(m.giro)
  const s = Math.sin(m.giro)
  const cantos = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]): Ponto => {
    const dx = a * m.meia * k
    const dy = b * meiaY
    return girarPonto(m.desvio * k + dx * c - dy * s, (y0 + y1) / 2 + dx * s + dy * c, q)
  })
  return poligono(cantos)
}

/**
 * A esteira que sai pela porta, com a manta dobrada em cima, no chão; `q` = o
 * giro da tela (0 de cima). `soFora` = só o que fica fora da tenda (sem giro,
 * na 3/4: o resto só se vê pelo vão da porta).
 */
function esteiraDeFora(grupo: Grupo, t: Tenda, q: number, soFora = false): void {
  const k = t.k
  const me = MEDIDAS_DA_ESTEIRA.meia * k
  const y0 = t.L - 1 * k
  const y1 = t.L + MEDIDAS_DA_ESTEIRA.fora * k
  const noChao = (x0: number, ya: number, x1: number, yb: number, raio: number): Forma => {
    const [ax, ay] = girarPonto(x0, ya, q)
    const [bx, by] = girarPonto(x1, yb, q)
    return caixa(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), raio)
  }
  const esteira = noChao(-me, y0, me, y1, 0.8 * k)
  const por = grupo(esteira.b)
  const eixo = q * QUARTO
  por(esteira, ESTEIRA, { tabua: 0, bisel: 0.7, contorno: 0.24, eixo, semente: 801 })
  // A beira trançada da ponta da esteira e a manta dobrada, que sai um pouco menos.
  por(noChao(-me, y1 - 1.3 * k, me, y1, 0.6 * k), ESTEIRA, { tabua: 0, bisel: 0.5, contorno: 0.2, tom: 0.84, eixo: eixo + QUARTO, semente: 802 })
  const manta = mantaNoChao(t, q)
  por(soFora ? dentroDe(manta, caixa(-3 * me, y0, 3 * me, y1 + 3 * me)) : manta, MANTA, { tabua: 0, bisel: 1.3, contorno: 0.26, ruga: 0.5, eixo: eixo + QUARTO + MEDIDAS_DA_MANTA.giro, semente: 803 })
}

// ---------- de cima ----------

function deCima(c: ContextoDoMovel, cena: Cena, t: Tenda): void {
  const P = c.peca
  const lona = c.m.lona
  const mad = c.m.madeira
  const k = t.k
  const cima = (x: number, y: number): Por => grupoDeCima(P, cena, x, y)
  const justo: Grupo = (b) => cima((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)

  // As estaquinhas da bainha, cada uma com a laçada que sai da beira (a lona as cobre até a beira).
  for (const lado of LADOS) {
    for (const y of t.bainha) {
      const xe = lado * (t.E + FORA_DA_BAINHA * k)
      const por = cima(xe, y)
      por(capsula(lado * (t.E - 0.6 * k), y, xe, y, 0.32 * k), CORDA, { tabua: 0, bisel: 0.3, contorno: 0.2 })
      por(elipse(xe, y, RAIO_DA_ESTAQUINHA * k, RAIO_DA_ESTAQUINHA * k), mad, { tabua: 0, bisel: 0.5, contorno: 0.32, tom: 0.85, textura: texDoTopo(xe, y), semente: 870 })
    }
  }

  // A esteira saindo pela porta.
  esteiraDeFora(justo, t, 0)

  // As águas (a do oeste passa da cumeeira e fica debaixo da do leste), o remendo e a fita da cumeeira, até a porta.
  const corpo = cima(0, 0)
  const aguas = new Map<number, Forma>()
  for (const lado of LADOS) {
    const agua = poligono(contornoDaAgua(t, lado, lado < 0 ? PASSA_DA_CUMEEIRA * k : 0).map(([x, y]): Ponto => [x, y]))
    aguas.set(lado, agua)
    const tom = tomDaAgua(t, lado, 0)
    corpo(agua, lona, { ...OPCOES_DA_LONA, eixo: QUARTO, tom, textura: texDaLona(t, DE_CIMA, tom > 1), semente: 600 + lado })
  }
  corpo(poligono(cantosDoRemendo(t).map(([x, y]): Ponto => [x, y])), panoDoRemendo(lona), { ...OPCOES_DO_REMENDO, tom: tomDaAgua(t, -1, 0) * TOM_DO_REMENDO, textura: texDoRemendo(t, DE_CIMA), semente: 640 })
  const fundo = FUNDO_DA_PORTA * k
  corpo(capsula(0, -t.L + 0.5 * k, 0, t.L - fundo, RAIO_DA_CUMEEIRA * k), lona, { tabua: 0, bisel: RAIO_DA_CUMEEIRA * k, contorno: 0.24, eixo: QUARTO, tom: 0.98, semente: 610 })

  portaDeCima(cima(0, t.L - fundo / 2), t, lona)

  // As cordas das beiras, da amarra na lona até a estaca, com a sombra delas na lona.
  for (const lado of LADOS) {
    const agua = aguas.get(lado)
    for (const y of t.laterais) {
      const [ax, ay] = amarraDoLado(t, lado, y)
      const [ex, ey] = estacaDoLado(t, lado, y)
      const por = cima((ax + ex) / 2, (ay + ey) / 2)
      if (agua !== undefined) por(dentroDe(capsula(ax + 0.9 * k, ay + 0.7 * k, ex + 0.9 * k, ey + 0.7 * k, RAIO_DA_CORDA * k * 1.4), agua), ESCURO, { ...OPCOES_DA_SOMBRA, alfa: 0.24 })
      estacaDeCima(por, ex, ey, ax, ay, k, mad)
    }
  }

  // As cordas dos mastros, em V até as estacas das pontas, e a corda da cumeeira por cima do vão da porta.
  for (const ponta of PONTAS) {
    for (const lado of LADOS) {
      const [ex, ey] = estacaDaPonta(t, ponta, lado)
      estacaDeCima(cima(ex / 2, (ponta * t.L + ey) / 2), ex, ey, 0, ponta * t.L, k, mad)
    }
  }
  cima(0, t.L - fundo / 2)(capsula(0, t.L - fundo, 0, t.L, RAIO_DA_CORDA * k * 1.1), CORDA, { ...OPCOES_DA_CORDA, eixo: QUARTO })

  // A ponta de cada mastro: a sombra dela na lona, a volta das cordas (nos das pontas) e o topo cortado.
  t.mastros.forEach((ym, i) => {
    const por = cima(0, ym)
    por(elipse(0.7 * k, ym + 0.6 * k, 2.4 * k, 2.4 * k), ESCURO, { ...OPCOES_DA_SOMBRA, alfa: 0.3 })
    if (i === 0 || i === t.mastros.length - 1) por(anel(0, ym, 2.6 * k, 2.6 * k, 1.5 * k, 1.5 * k), CORDA, OPCOES_DA_CORDA)
    por(elipse(0, ym, 1.9 * k, 1.9 * k), mad, { tabua: 0, bisel: 0.9, contorno: 0.3, tom: 0.95, textura: texDoTopo(0, ym), semente: 840 + i })
  })
}

/** A estaca vista de cima, com a corda que chega de (ax, ay) e a laçada em volta do topo. */
function estacaDeCima(por: Por, ex: number, ey: number, ax: number, ay: number, k: number, mad: MaterialDaPeca): void {
  const r = RAIO_DA_ESTACA * k
  por(elipse(ex, ey, r, r), mad, { tabua: 0, bisel: 0.8, contorno: 0.3, tom: 0.9, textura: texDoTopo(ex, ey), semente: 860 })
  por(capsula(ax, ay, ex, ey, RAIO_DA_CORDA * k), CORDA, { ...OPCOES_DA_CORDA, eixo: Math.atan2(ey - ay, ex - ax) })
  por(anel(ex, ey, r + 0.6 * k, r + 0.6 * k, r - 0.15 * k, r - 0.15 * k), CORDA, { ...OPCOES_DA_CORDA, tom: 0.86 })
}

/** A esteira e a manta lá dentro, vistas pelo recorte de cima ou pelo vão da porta (`janela`): na sombra, mais escuras no fundo. */
function esteiraLaDentro(por: Por, t: Tenda, janela: Forma): void {
  const k = t.k
  const me = MEDIDAS_DA_ESTEIRA.meia * k
  const fundo = MEDIDAS_DA_ESTEIRA.dentro * k
  por(dentroDe(caixa(-me, t.L - fundo, me, t.L + 1), janela), ESTEIRA, { tabua: 0, bisel: 0.5, contorno: 0.18, tom: TOM_DE_DENTRO, textura: texLaDentro(ESTEIRA, t.L, fundo), semente: 804 })
  por(dentroDe(mantaNoChao(t, 0), janela), MANTA, { tabua: 0, bisel: 1, contorno: 0.22, eixo: QUARTO + MEDIDAS_DA_MANTA.giro, tom: TOM_DE_DENTRO, textura: texLaDentro(MANTA, t.L, fundo), semente: 805 })
}

/** A amarra de cada aba na empena da porta: o x do lado de dentro (o lado de fora é o mesmo, com o sinal trocado) e a altura. */
function amarraDaAba(t: Tenda): Ponto {
  return [PORTA.puxada * t.E * (1 - PORTA.amarra), PORTA.amarra * t.H]
}

type Ponto3 = readonly [number, number, number]

/**
 * A trouxa de cada aba (`s` -1 a do oeste, 1 a do leste): as duas pontas do
 * eixo dela, (x, y, z) do objeto, da beira do vão até perto da beira da
 * empena, na altura da amarra e saindo da empena.
 */
function trouxaDaAba(t: Tenda, s: number): readonly [Ponto3, Ponto3] {
  const k = t.k
  const [xt, zt] = amarraDaAba(t)
  const beira = t.E * (1 - PORTA.amarra)
  const y = t.L + TROUXA.sai * k
  return [
    [s * (xt - TROUXA.entra * k), y, zt],
    [s * (beira - TROUXA.folga * k), y, zt],
  ]
}

/**
 * A porta vista de cima: o recorte escuro na ponta da frente, com a esteira e
 * a manta lá dentro e o avesso das abas na beira do recorte; nos dois cantos
 * do recorte, o alto da trouxa de cada aba, com o nó da amarra e a ponta solta.
 */
function portaDeCima(por: Por, t: Tenda, lona: MaterialDaPeca): void {
  const k = t.k
  const L = t.L
  const dn = PORTA.pe * t.E
  const fundo = FUNDO_DA_PORTA * k
  const beira = (s: number): Ponto[] => [
    [s * dn, L + 0.8 * k],
    [s * dn * 0.66, L - fundo * 0.4],
    [s * dn * 0.3, L - fundo * 0.82],
  ]
  const recorte = poligono([...beira(-1), [0, L - fundo], ...beira(1).reverse()])
  por(recorte, DENTRO, { tabua: 0, bisel: 0, contorno: 0.3, recesso: { k: 1.6, forca: 0.4 }, textura: texDeDentro(L + 0.8 * k, fundo) })
  esteiraLaDentro(por, t, recorte)
  for (const s of LADOS) {
    por(cadeia([...beira(s), [0, L - fundo]], 0.75 * k), lona, { tabua: 0, bisel: 0.6, contorno: 0.2, tom: s < 0 ? 1.05 : 0.8, semente: 806 })
    // A trouxa vista de cima: o pano juntado na beira da frente, ao lado do recorte, com a corda na frente dela e o nó do lado de fora.
    const [[xi, yt], [xo]] = trouxaDaAba(t, s)
    const sai = TROUXA.sai * k
    por(capsula(xi, yt, xo, yt, sai), lona, { tabua: 0, bisel: 1.2 * k, contorno: 0.26, ruga: 0.5, tom: s < 0 ? 1.02 : 0.86, textura: texDasDobras(k), semente: 820 + s })
    por(capsula(xi, yt + 0.75 * sai, xo, yt + 0.75 * sai, 0.5 * k), CORDA, OPCOES_DA_CORDA)
    const no: Ponto = [xo + s * 0.5 * k, yt + 0.7 * sai]
    por(elipse(no[0], no[1], 0.9 * k, 0.9 * k), CORDA, OPCOES_DA_CORDA)
    por(capsula(no[0], no[1], no[0] + s * 1.1 * k, no[1] + 2.6 * k, 0.42 * k), CORDA, { ...OPCOES_DA_CORDA, tom: 0.85 })
  }
}

// ---------- na 3/4, de frente ----------

/** A estaca de pé na tela, do pé até o topo, e a corda que chega de `a` até o nó, logo abaixo do topo. */
function estacaComCorda(por: Por, a: Ponto, pe: Ponto, k: number, mad: MaterialDaPeca): void {
  const sentido = Math.abs(pe[0] - a[0]) < 2 * k ? 0 : Math.sign(pe[0] - a[0])
  const topo: Ponto = [pe[0] + sentido * DEITADA * k, pe[1] - ALTURA_DA_ESTACA * k]
  const no: Ponto = [pe[0] + sentido * DEITADA * k * 0.8, pe[1] - ALTURA_DA_ESTACA * k * 0.75]
  por(capsula(pe[0], pe[1], topo[0], topo[1], RAIO_DA_ESTACA * k * 0.85), mad, { eixo: QUARTO, tabua: 0, bisel: 0.6, contorno: 0.3, tom: 0.88, semente: 862 })
  por(capsula(a[0], a[1], no[0], no[1], RAIO_DA_CORDA * k), CORDA, { ...OPCOES_DA_CORDA, eixo: Math.atan2(no[1] - a[1], no[0] - a[0]) })
  por(elipse(no[0], no[1], 1.15 * k, 0.75 * k), CORDA, { ...OPCOES_DA_CORDA, tom: 0.86 })
}

/** A caixa em volta de pontos da tela, com folga. */
function caixaDe(pontos: readonly Ponto[], folga: number): Caixa {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pontos) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return [x0 - folga, y0 - folga, x1 + folga, y1 + folga]
}

/** Uma corda (da amarra `a3`, no objeto, até a estaca no chão `e`) com a estaca, e a sombra dela na água, quando passa por cima dela. */
function cordaNaTela(grupo: Grupo, t: Tenda, q: number, a3: readonly [number, number, number], e: Ponto, mad: MaterialDaPeca, agua?: Forma): void {
  const k = t.k
  const a = naTela(q, a3[0], a3[1], a3[2])
  const pe = naTela(q, e[0], e[1], 0)
  const por = grupo(caixaDe([a, pe, [pe[0], pe[1] - ALTURA_DA_ESTACA * k]], 3 * k))
  if (agua !== undefined) {
    por(dentroDe(capsula(a[0] + 0.9 * k, a[1] + 0.8 * k, pe[0] + 0.9 * k, pe[1] - 2.6 * k, RAIO_DA_CORDA * k * 1.4), agua), ESCURO, { ...OPCOES_DA_SOMBRA, alfa: 0.22 })
  }
  estacaComCorda(por, a, pe, k, mad)
}

/** Uma estaquinha da bainha de pé, com a laçada que sai da beira da lona. */
function estaquinhaNaTela(grupo: Grupo, t: Tenda, q: number, lado: number, y: number, mad: MaterialDaPeca): void {
  const k = t.k
  const xe = lado * (t.E + FORA_DA_BAINHA * k)
  const pe = naTela(q, xe, y, 0)
  const topo = naTela(q, xe, y, ALTURA_DA_ESTAQUINHA * k)
  const beira = naTela(q, lado * (t.E - 0.2 * k), y, 0.6 * k)
  const por = grupo(caixaDe([pe, topo, beira], 1.2 * k))
  por(capsula(pe[0], pe[1], topo[0], topo[1], RAIO_DA_ESTAQUINHA * k * 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 0.4, contorno: 0.3, tom: 0.85, semente: 872 })
  por(capsula(beira[0], beira[1], topo[0], topo[1] + 0.6 * k, 0.3 * k), CORDA, { tabua: 0, bisel: 0.3, contorno: 0.2 })
}

/** A ponta do mastro acima da cumeeira, de `desde` (altura) até a ponta: a vara, o topo arredondado e, nos das pontas, a volta das cordas. */
function pontaDoMastro(grupo: Grupo, t: Tenda, q: number, ym: number, daPonta: boolean, desde: number, mad: MaterialDaPeca): void {
  const k = t.k
  const pe = naTela(q, 0, ym, desde)
  const topo = naTela(q, 0, ym, t.H + t.ponta)
  const por = grupo(caixaDe([pe, topo], 3 * k))
  por(capsula(pe[0], pe[1], topo[0], topo[1], RAIO_DO_MASTRO * k), mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, contorno: 0.3, tom: 0.92, semente: 850 })
  por(elipse(topo[0], topo[1] - 0.2 * k, 1.5 * k, 1.25 * k), mad, { tabua: 0, bisel: 0.9, contorno: 0.3, tom: 1.04, semente: 851 })
  if (daPonta) {
    const [cx, cy] = naTela(q, 0, ym, t.H + t.ponta - AMARRA_NO_MASTRO * k)
    por(elipse(cx, cy, 1.9 * k, 0.85 * k), CORDA, OPCOES_DA_CORDA)
  }
}

/** Uma água na tela (com o tom pela luz na tela) e a forma dela, para as sombras das cordas. */
function aguaNaTela(grupo: Grupo, t: Tenda, q: number, lado: number, passa: number, lona: MaterialDaPeca): Forma {
  const forma = poligono(contornoDaAgua(t, lado, passa).map(([x, y, z]) => naTela(q, x, y, z)))
  const tom = tomDaAgua(t, lado, q)
  grupo(forma.b)(forma, lona, { ...OPCOES_DA_LONA, eixo: QUARTO, tom, textura: texDaLona(t, aguasNaTela(t, q), tom > 1), semente: 600 + lado })
  return forma
}

/**
 * As trouxas das duas abas: o pano juntado na amarra, da beira do vão à beira
 * da empena, com a corda passando na frente dele, o nó do lado de fora e a
 * ponta solta. De frente, a trouxa fica deitada; de lado, de pé, saindo da
 * ponta da tenda.
 */
function trouxasDasAbas(grupo: Grupo, t: Tenda, q: number, lona: MaterialDaPeca): void {
  const k = t.k
  const r = TROUXA.meiaAltura * k
  const naFrente = 2 * TROUXA.sai * k
  for (const s of LADOS) {
    const [dentro, fora] = trouxaDaAba(t, s)
    const a = naTela(q, dentro[0], dentro[1], dentro[2])
    const b = naTela(q, fora[0], fora[1], fora[2])
    const por = grupo(caixaDe([a, b], r + 5 * k))
    const naLuz = q % 2 === 1 ? 0.82 : b[0] < a[0] ? 0.92 : 0.76
    por(capsula(a[0], a[1], b[0], b[1], r), lona, { tabua: 0, bisel: 1.5 * k, contorno: 0.24, ruga: 0.5, tom: naLuz, textura: texDasDobras(k), semente: 630 + s })
    // A corda na frente da trouxa, de ponta a ponta, e o nó na ponta de fora, preso na beira da empena.
    const ca = naTela(q, dentro[0] - s * 0.4 * k, t.L + naFrente, dentro[2])
    const cb = naTela(q, fora[0], t.L + naFrente, fora[2])
    por(capsula(ca[0], ca[1], cb[0], cb[1], 0.55 * k), CORDA, OPCOES_DA_CORDA)
    const no = naTela(q, fora[0] + s * 0.6 * k, t.L + naFrente, fora[2])
    por(elipse(no[0], no[1], 0.95 * k, 0.95 * k), CORDA, OPCOES_DA_CORDA)
    const solta = naTela(q, fora[0] + s * 1.3 * k, t.L + naFrente, fora[2] - 4.6 * k)
    por(capsula(no[0], no[1] + 0.5 * k, solta[0], solta[1], 0.42 * k), CORDA, { ...OPCOES_DA_CORDA, tom: 0.85 })
  }
}

/**
 * O vão da porta na empena, em (x, z), de baixo à esquerda: o pano solto da
 * aba, embaixo da amarra, abre para o meio até o chão (o vão é mais largo na
 * amarra que no chão); em cima, a beira da aba puxada da amarra até o alto.
 */
function vaoDaPorta(t: Tenda): Ponto[] {
  const [xt, zt] = amarraDaAba(t)
  const xb = PORTA.pe * t.E
  const zd = PORTA.alto * t.H
  const lado = (s: number): Ponto[] => [
    ...[0, 0.3, 0.55, 0.78, 0.92].map((f): Ponto => [s * (xb + (xt - xb) * f * f), zt * f]),
    [s * xt, zt],
    ...[0.2, 0.4, 0.6, 0.8, 0.93].map((a): Ponto => [s * xt * (1 - a) * (1 + 0.35 * a), zt + (zd - zt) * a]),
  ]
  return [...lado(-1), [0, zd], ...lado(1).reverse()]
}

/**
 * A empena da porta, sem giro: lá dentro o chão escuro com a esteira e a
 * manta, o mastro de pé no vão; a lona com o vão aberto como uma cortina
 * presa dos dois lados, as pregas puxadas das amarras e o avesso das abas na
 * beira do vão.
 */
function empenaComPorta(grupo: Grupo, t: Tenda, lona: MaterialDaPeca, mad: MaterialDaPeca): void {
  const k = t.k
  const chao = t.L
  const naEmpena = ([x, z]: Ponto): Ponto => [x, chao - z]
  const contorno = vaoDaPorta(t)
  const vao = poligono(contorno.map(naEmpena))
  const [xt, zt] = amarraDaAba(t)

  // Lá dentro: o chão na sombra, a esteira e a manta que entram, e o mastro de pé no vão, até a ponta.
  const dentro = grupo(caixaDe([naEmpena([-xt, 0]), naEmpena([xt, t.H + t.ponta])], 3 * k))
  dentro(vao, DENTRO, { tabua: 0, bisel: 0, contorno: 0.3, recesso: { k: 2, forca: 0.45 }, textura: texDeDentro(chao, PORTA.alto * t.H) })
  esteiraLaDentro(dentro, t, vao)
  const topo = naEmpena([0, t.H + t.ponta])
  dentro(capsula(0, chao, topo[0], topo[1], RAIO_DO_MASTRO * k), mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, contorno: 0.3, tom: 0.9, semente: 852 })
  dentro(elipse(topo[0], topo[1] - 0.2 * k, 1.5 * k, 1.25 * k), mad, { tabua: 0, bisel: 0.9, contorno: 0.3, tom: 1.04, semente: 853 })
  const amarra = naEmpena([0, t.H + t.ponta - AMARRA_NO_MASTRO * k])
  dentro(elipse(amarra[0], amarra[1], 1.9 * k, 0.85 * k), CORDA, OPCOES_DA_CORDA)

  // A empena com o vão aberto, as pregas puxadas das amarras e o avesso das abas na beira do vão (de cada lado, do pé ao alto).
  const empena = poligono([naEmpena([-t.E, 0]), naEmpena([0, t.H]), naEmpena([t.E, 0])])
  const pano = grupo(empena.b)
  const amarras = LADOS.map((s): Ponto => {
    const [dentroDaTrouxa, foraDaTrouxa] = trouxaDaAba(t, s)
    return [(dentroDaTrouxa[0] + foraDaTrouxa[0]) / 2, zt]
  })
  pano(menos(empena, vao), lona, { ...OPCOES_DA_LONA, textura: texDaEmpena(t, chao, amarras), semente: 620 })
  const metade = Math.floor(contorno.length / 2)
  const beiras = [contorno.slice(0, metade + 1), contorno.slice(metade)]
  beiras.forEach((beira, i) => pano(cadeia(beira.map(naEmpena), 0.6 * k), lona, { tabua: 0, bisel: 0.5, contorno: 0.16, tom: i === 0 ? 0.97 : 0.84, semente: 621 }))
}

/** A empena de trás, de costas: a lona fechada, com a costura do meio atada em quatro pontos. */
function empenaFechada(grupo: Grupo, t: Tenda, lona: MaterialDaPeca): void {
  const k = t.k
  const chao = t.L
  const empena = poligono([
    [-t.E, chao],
    [0, chao - t.H],
    [t.E, chao],
  ])
  const por = grupo(empena.b)
  por(empena, lona, { ...OPCOES_DA_LONA, textura: texDaEmpena(t, chao, []), semente: 622 })
  por(capsula(0, chao - 0.4 * k, 0, chao - t.H + 2.5 * k, 0.45 * k), lona, { tabua: 0, bisel: 0.3, contorno: 0.3, tom: 0.5, semente: 623 })
  for (const f of ATADEIRAS) {
    const y = chao - f * t.H
    por(capsula(-1.7 * k, y + 0.3 * k, 1.7 * k, y - 0.3 * k, 0.42 * k), CORDA, OPCOES_DA_CORDA)
  }
}

function deFrente(c: ContextoDoMovel, cena: Cena, t: Tenda, q: number): void {
  const k = t.k
  const lona = c.m.lona
  const mad = c.m.madeira
  const tela = novaTela(c.peca, cena, q)
  // Uma base só, abaixo de tudo: as peças sobem na ordem em que entram, de trás para a frente.
  const base = Math.max(t.sx, t.sy) + BASE_DA_ORDEM * k
  const grupo: Grupo = (b) => tela.grupo((b[0] + b[2]) / 2, base, (b[1] + b[3]) / 2)
  const deLado = q % 2 === 1
  /** A ponta que fica de frente para quem olha (sem giro, a da porta; de costas, a de trás). */
  const perto = girarPonto(0, 1, q)[1] > 0 ? 1 : -1
  const aguaAVista = (lado: number): boolean => !deLado || girarPonto(lado, 0, q)[1] > 0
  const lados = LADOS.filter(aguaAVista)
  const mastroDaPorta = t.mastros.length - 1

  // Atrás da tenda: na ponta de longe, as cordas do V, as estacas e a ponta do mastro (de costas, a porta fica atrás
  // da lona, com as trouxas e a esteira). De lado, a esteira que sai pela porta, no chão.
  if (!deLado) {
    const longe = -perto
    for (const lado of LADOS) cordaNaTela(grupo, t, q, amarraDoMastro(t, longe), estacaDaPonta(t, longe, lado), mad)
    pontaDoMastro(grupo, t, q, longe * t.L, true, t.H - 1.5 * k, mad)
  } else esteiraDeFora(grupo, t, q)

  // As estaquinhas da bainha, as águas, o remendo e a fita da cumeeira.
  for (const lado of lados) for (const y of t.bainha) estaquinhaNaTela(grupo, t, q, lado, y, mad)
  const aguas = new Map<number, Forma>()
  lados.forEach((lado, i) => aguas.set(lado, aguaNaTela(grupo, t, q, lado, i === 0 && lados.length > 1 ? PASSA_DA_CUMEEIRA * k : 0, lona)))
  if (aguaAVista(-1)) {
    const remendo = poligono(cantosDoRemendo(t).map(([x, y, z]) => naTela(q, x, y, z)))
    grupo(remendo.b)(remendo, panoDoRemendo(lona), { ...OPCOES_DO_REMENDO, tom: tomDaAgua(t, -1, q) * TOM_DO_REMENDO, textura: texDoRemendo(t, aguasNaTela(t, q)), semente: 640 })
  }
  const cumeeira = cadeia(
    t.cumeeira.map((y) => naTela(q, 0, y, alturaDaCumeeira(t, y))),
    RAIO_DA_CUMEEIRA * k,
  )
  grupo(cumeeira.b)(cumeeira, lona, { tabua: 0, bisel: RAIO_DA_CUMEEIRA * k, contorno: 0.24, eixo: deLado ? 0 : QUARTO, tom: 0.98, semente: 610 })

  // As pontas dos mastros por cima da cumeeira: de lado, todas; sem giro e de costas, as do meio.
  t.mastros.forEach((ym, i) => {
    const daPonta = i === 0 || i === mastroDaPorta
    if (!deLado && daPonta) return
    pontaDoMastro(grupo, t, q, ym, daPonta, t.H + 0.3 * k, mad)
  })

  // As cordas das beiras à vista, com as estacas e a sombra delas na lona.
  for (const lado of lados) for (const y of t.laterais) cordaNaTela(grupo, t, q, amarraDoLado(t, lado, y), estacaDoLado(t, lado, y), mad, aguas.get(lado))

  if (deLado) {
    // De lado: as trouxas das abas na ponta da porta e as cordas dos mastros das duas pontas.
    trouxasDasAbas(grupo, t, q, lona)
    for (const ponta of PONTAS) for (const lado of LADOS) cordaNaTela(grupo, t, q, amarraDoMastro(t, ponta), estacaDaPonta(t, ponta, lado), mad)
    return
  }
  // A empena de perto: sem giro, a da porta aberta, as trouxas das abas e a esteira que sai; de costas, a de trás, fechada.
  if (perto === 1) {
    empenaComPorta(grupo, t, lona, mad)
    trouxasDasAbas(grupo, t, q, lona)
    esteiraDeFora(grupo, t, q, true)
  } else {
    empenaFechada(grupo, t, lona)
    pontaDoMastro(grupo, t, q, -t.L, true, t.H - 1 * k, mad)
  }
  for (const lado of LADOS) cordaNaTela(grupo, t, q, amarraDoMastro(t, perto), estacaDaPonta(t, perto, lado), mad)
}

// ---------- a sombra no chão ----------

/** O casco convexo dos pontos (cadeia monótona), no sentido anti-horário. */
function casco(pontos: readonly Ponto[]): Ponto[] {
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cruz = (o: Ponto, a: Ponto, b: Ponto): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const metade = (lista: readonly Ponto[]): Ponto[] => {
    const h: Ponto[] = []
    for (const ponto of lista) {
      while (h.length >= 2 && cruz(h[h.length - 2], h[h.length - 1], ponto) <= 0) h.pop()
      h.push(ponto)
    }
    return h
  }
  const baixo = metade(p)
  const cima = metade([...p].reverse())
  return [...baixo.slice(0, -1), ...cima.slice(0, -1)]
}

/**
 * A sombra no chão da tela, caída para baixo à direita: o casco da base e das
 * pontas dos mastros deslocadas pela altura, o contato da lona, e a de cada
 * corda e de cada estaca. Girada, a sombra entra desgirada e a volta da 3/4 a
 * põe no lugar; o contato não depende da luz e entra no chão do objeto.
 */
function sombrasNoChao(cena: Cena, q: number, t: Tenda): void {
  const k = t.k
  const volta = (4 - q) % 4
  const caido = (x: number, y: number, z: number): Ponto => {
    const [tx, ty] = girarPonto(x, y, q)
    return [tx + SOMBRA_X * z, ty + SOMBRA_Y * z]
  }
  const noChao = (forma: Forma, forca: number, suave: number): void => {
    cena.sombras.push({ forma: girarForma(forma, volta), z: 0, forca, suave })
  }
  const pontos: Ponto[] = [caido(-t.E, -t.L, 0), caido(t.E, -t.L, 0), caido(-t.E, t.L, 0), caido(t.E, t.L, 0)]
  for (const ym of t.mastros) pontos.push(caido(0, ym, t.H + t.ponta))
  noChao(poligono(casco(pontos)), FORCA_DA_SOMBRA, SUAVE_DA_SOMBRA)
  cena.sombras.push(contato(caixa(-t.E - 0.5 * k, -t.L, t.E + 0.5 * k, t.L, 1 * k), FORCA_DO_CONTATO))
  const corda = (a: readonly [number, number, number], e: Ponto): void => {
    const [ex, ey] = girarPonto(e[0], e[1], q)
    const [cx, cy] = caido(a[0], a[1], a[2])
    noChao(capsula(ex, ey, cx, cy, RAIO_DA_CORDA * k), FORCA_DA_SOMBRA_DA_CORDA, 0.7)
    const [tx, ty] = caido(e[0], e[1], ALTURA_DA_ESTACA * k)
    noChao(capsula(ex, ey, tx, ty, RAIO_DA_ESTACA * k * 0.8), 0.28, 0.6)
    cena.sombras.push(contato(elipse(e[0], e[1], RAIO_DA_ESTACA * k, RAIO_DA_ESTACA * k), 0.3))
  }
  for (const lado of LADOS) for (const y of t.laterais) corda(amarraDoLado(t, lado, y), estacaDoLado(t, lado, y))
  for (const ponta of PONTAS) for (const lado of LADOS) corda(amarraDoMastro(t, ponta), estacaDaPonta(t, ponta, lado))
}

export const montarTenda: MontarMovel = (c, cena) => {
  const q = quartosDoGiro(c.giro)
  const t = medir(c)
  sombrasNoChao(cena, q, t)
  // Girada, a cena só serve à 3/4: as peças de cima não entram.
  if (q === 0) deCima(c, cena, t)
  deFrente(c, cena, t, q)
}
