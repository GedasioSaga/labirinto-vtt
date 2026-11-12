/**
 * TRONCO DE PRISIONEIRO de cima com volume (lote 14 dos objetos novos,
 * 11/11/2026, grupo Sala de tortura; o mestre pediu "uns equipamentos de
 * tortura"): o tronco de pé, VAZIO, entre dois MOURÕES quadrados sobre a BASE
 * em H (os dois PÉS atravessados e a SOLEIRA entre eles), escorados pelas
 * MÃOS-FRANCESAS. Entre os mourões, duas PRANCHAS grossas com os três
 * MEIOS-FUROS (o grande do pescoço no meio e os dois pequenos dos pulsos), a
 * beira deles lisa e mais clara de gasta: a de baixo presa; a de cima ERGUIDA,
 * aberta na DOBRADIÇA de ferro do mourão da esquerda, com os meios-furos dela
 * virados para baixo. Do outro lado, o FERROLHO pendurado da cinta da prancha
 * de cima e o CADEADO aberto pendurado no GRAMPO da prancha de baixo.
 *
 * DE CIMA aparecem os pés atravessados, o topo dos mourões com os anéis do
 * corte, a beira da prancha erguida (clara, virada para a luz, com as duas
 * cintas de ferro e a ponta de topo mais escura), o nó da dobradiça e o
 * cadeado na frente. A sombra comprida, com a prancha erguida e os furos
 * vazados, diz que a peça é alta.
 *
 * NA 3/4 o desenho todo é feito na TELA da 3/4 (a técnica da dama de ferro e
 * da mesa de corte: cada peça presa a uma âncora ao sul da pegada, pintada na
 * ordem em que foi posta). Cada parte é um PRISMA: um perfil de pé no plano do
 * comprimento, com a grossura dele. Do perfil saem a face que olha para o sul
 * e, varrida para cima pela grossura, a beira de cima: assim aparecem a beira
 * da prancha de baixo e o fundo dos meios-furos dela, o topo da de cima
 * erguida e a ponta dela, e os meios-furos da de cima (virados para baixo)
 * ficam vazados. As partes vão de trás para a frente: a que fica toda atrás
 * (ou toda embaixo) da outra vem antes.
 *
 * GIRADO (`c.giro`), a cena só serve à 3/4: de costas, o mesmo desenho
 * espelhado, sem o ferro da frente (fica atrás das pranchas; as cintas que as
 * abraçam continuam); de lado, cada prisma vira uma faixa (a beira de cima)
 * com a ponta virada para quem olha, e o cadeado aparece ao lado das pranchas.
 *
 * A 25% de zoom sobram, de cima, a régua de madeira entre os dois quadrados
 * dos mourões e a sombra comprida; na 3/4, o quadro de madeira com a prancha
 * de cima erguida em diagonal e os furos escuros. Materiais: `madeira` e
 * `ferragens`. As medidas valem na pegada de 1,5 x 0,5 casa: os mourões
 * acompanham a largura da pegada e o resto escala com o lado que mandar.
 */
import { rgb, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, elipse, menos, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo, na pegada de partida) ----------

/** A pegada de partida, em casas: as medidas escalam com ela (o lado que der a menor escala manda). */
const LARGURA_DE_PARTIDA = 1.5
const FUNDO_DE_PARTIDA = 0.5

/** Os mourões: o recuo da face de fora até a beira da pegada, o lado (quadrado) e o alto. */
const RECUO_DO_MOURAO = 5.5
const LADO_DO_MOURAO = 7
const ALTO_DO_MOURAO = 66
/** Os pés atravessados debaixo dos mourões: a sobra de cada lado do mourão, o meio fundo e o alto. */
const SOBRA_DO_PE = 1
const MEIO_FUNDO_DO_PE = 11
const ALTO_DO_PE = 4.5
/** A soleira entre os pés: o meio fundo e o alto. */
const MEIO_FUNDO_DA_SOLEIRA = 2.5
const ALTO_DA_SOLEIRA = 4
/** As mãos-francesas: as alturas em que encostam no mourão, as distâncias da face dele em que pousam na soleira e a meia grossura. */
const MAO_NO_MOURAO = [16, 21] as const
const MAO_NA_SOLEIRA = [11, 15] as const
const MEIA_GROSSURA_DA_MAO = 2

/** As pranchas: a meia grossura, a altura de cada uma e a linha dos furos (o alto da de baixo). */
const MEIA_GROSSURA = 2.5
const ALTURA_DA_PRANCHA = 10
const LINHA_DOS_FUROS = 50
/** Os três meios-furos: os dois dos pulsos e o grande do pescoço no meio (o x do meio e o raio). */
const FUROS = [
  { x: -15, r: 3 },
  { x: 0, r: 5.5 },
  { x: 15, r: 3 },
] as const
/** O quanto a prancha de cima está erguida na dobradiça (rad). */
const ABERTURA = 0.35

/** As cintas de ferro que abraçam a prancha de cima: a da dobradiça (contada da quina) e a do ferrolho (contada da ponta solta), a largura e a sobra. */
const CINTA_DA_DOBRADICA = 2.5
const CINTA_DO_FERROLHO = 11
const LARGURA_DA_CINTA = 4
const SOBRA_DA_CINTA = 0.4
/** A folha da dobradiça na face do mourão (o comprimento, a altura e a grossura) e o nó dela, na quina da prancha. */
const FOLHA = { comprimento: 5.6, altura: 4, grossura: 0.6 } as const
const RAIO_DO_NO = 1.9
/** O ferrolho pendurado da cinta: o comprimento, a meia largura, a grossura e o olhal (de onde a onde, contado do pé, e o raio). */
const FERROLHO = { comprimento: 9, meia: 1.1, grossura: 0.8, olhal: [1.4, 2.6], raioDoOlhal: 0.5 } as const
/** O grampo na prancha de baixo, debaixo do ferrolho: o quanto fica abaixo da linha dos furos, a meia largura, a meia altura e o quanto sai da face. */
const GRAMPO = { abaixo: 2, meia: 0.9, meiaAltura: 0.8, sai: 3.3 } as const
/**
 * O cadeado aberto no grampo: a meia largura e o alto do corpo, a distância do
 * grampo ao alto do corpo, a grossura (de y0 a y1), o raio do arco, a folga da
 * haste solta (a que saiu do corpo) e a grossura da haste.
 */
const CADEADO = { meia: 2.5, alto: 6.5, abaixo: 5, y0: 3.9, y1: 6.3, arco: 1.7, folga: 2.4, haste: 0.55 } as const
const PONTOS_DO_ARCO = 8
const RAIO_DO_REBITE = 0.8

// ---------- os tons ----------

const TOM_DA_FACE = 0.86
const TOM_DA_SOLEIRA = 0.8
const TOM_DO_TOPO = 1.08
const TOM_DO_MOURAO = 0.8
/** A face dos pés é madeira de topo, na sombra da base. */
const TOM_DO_PE = 0.74
const TOM_DA_PRANCHA_DE_CIMA = 0.9
/** De cima: a beira da prancha erguida (virada para a luz) e a ponta dela, de topo e virada para o outro lado. */
const TOM_DA_BEIRA_ERGUIDA = 1.14
const TOM_DA_PONTA_ERGUIDA = 0.8
const TOM_DO_FERRO = 0.9
const TOM_DA_FACE_DO_FERRO = 0.86
const TOM_DO_TOPO_DO_FERRO = 1.1
const TOM_DO_REBITE = 1.3
const TOM_DO_CADEADO = 1.06
const TOM_DA_HASTE = 1.16
/** O gasto em volta dos furos: a largura da beira lisa (px do protótipo), a luz e o quanto o veio some. */
const BEIRA_GASTA = 2.4
const LUZ_DO_GASTO = 0.13
const ALISADO = 0.6

const RISCO: MaterialDaPeca = { classe: 'liso', rgb: [0x24, 0x22, 0x21] }
const FERRUGEM: Rgb = rgb('#8c5b45')
const FERRUGEM_CHEIA = 0.66
const FERRUGEM_DO_FERRO = -0.12
const BRILHO_DO_FERRO = 0.28

// ---------- as sombras ----------

const AMOSTRAS_DA_SOMBRA = 10
const FATIAS_DA_GROSSURA = 5
/** A distância medida no perfil é maior que a do chão (a altura encolhe na sombra): encolhida, a beira da sombra não sai dura. */
const ENCOLHE_DA_SOMBRA = 0.5
/** Uma parte da sombra só é medida se o ponto não estiver mais longe da caixa dela que isto além da menor distância já achada. */
const MARGEM_DA_SOMBRA = 2
const SOMBRA_DO_VULTO = { suave: 2.4, forca: 0.26 } as const
const CONTATO_DA_BASE = 0.34

// ---------- âncoras, pinos e o giro (os da dama de ferro e da mesa de corte) ----------

const RAIO_DO_PONTO = 1e-6
const LONGE = 1e3
const BORDA_DO_PONTO = 0.05
/** Cada âncora fica isto mais ao sul que a anterior: a 3/4 pinta as peças na ordem em que foram postas. */
const PASSO_DA_ORDEM = 1e-3
const ALEM_DA_PEGADA = 0.5
/** O pino das peças da vista de cima: qualquer altura acima do chão as tira do lugar, e elas somem na 3/4. */
const ALTURA_DO_PINO = 1

// ---------- o desenho dos prismas ----------

const RAIO_DA_QUINA = 0.5
/** O passo (px) das cópias que varrem o perfil para cima (a beira de cima das partes que não são caixa). */
const PASSO_DA_VARRIDA = 0.3
/** A ponta de lado menor que isto (px) não é desenhada. */
const PONTA_MINIMA = 0.3
/** A folga das comparações de ordem e de sobreposição. */
const FOLGA = 1e-6
const LADOS = [-1, 1] as const

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela, como o `girarPonto` de `tresQuartos.ts`. */
function girarPonto(x: number, y: number, q: number): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

function girarCaixa(b: Caixa, q: number): Caixa {
  return q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : q === 3 ? [b[1], -b[2], b[3], -b[0]] : b
}

/** A forma girada `q` quartos de volta, como o `girarForma` de `tresQuartos.ts`. */
function girarForma(f: Forma, q: number): Forma {
  if (q === 0) return f
  const volta = 4 - q
  return {
    b: girarCaixa(f.b, q),
    d: (x, y) => {
      const [mx, my] = girarPonto(x, y, volta)
      return f.d(mx, my)
    },
  }
}

function ponto(x: number, y: number): Forma {
  return { b: [x, y, x, y], d: (px, py) => (Math.abs(px - x) < RAIO_DO_PONTO && Math.abs(py - y) < RAIO_DO_PONTO ? -1 : LONGE) }
}

function meioDa(f: Forma): Ponto {
  return [(f.b[0] + f.b[2]) / 2, (f.b[1] + f.b[3]) / 2]
}

/** A mesma forma com a caixa de pintura centrada em (cx, cy): o desenho não muda, mas a 3/4 a acha no pino. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

/** A peça só é pintada NO LUGAR em que foi desenhada (`dy` zero): some quando a 3/4 a sobe, aparece quando a traz de volta. */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

type OpcoesDaTela = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaTela) => void

/**
 * A TELA da 3/4 (a da dama de ferro): quem desenha nela escreve em
 * coordenadas da tela, com a pegada já girada, de trás para a frente. Cada
 * peça ganha a âncora dela ao sul da pegada, na ordem em que foi posta, e
 * nasce descida a altura da âncora: a 3/4 a sobe de volta e a pinta depois de
 * tudo. Sem giro ela só pinta no lugar (some na vista de cima); girada, a cena
 * só serve à 3/4 e a peça sai desgirada (a forma, o deslocamento, o veio e o
 * ponto que a textura lê), para a volta da 3/4 a pôr como foi desenhada.
 */
function novaTela(c: ContextoDoMovel, cena: Cena, q: number): Por {
  const volta = (4 - q) % 4
  const chao = (q % 2 === 0 ? c.hh : c.hw) + ALEM_DA_PEGADA
  let postas = 0
  return (forma, mat, o = {}) => {
    const [mx, my] = meioDa(forma)
    const base = chao + postas * PASSO_DA_ORDEM
    postas += 1
    const z = base - my
    cena.sombras.push({ forma: girarForma(ponto(mx, base), volta), z, solta: true, forca: 0, suave: BORDA_DO_PONTO })
    if (q === 0) {
      cena.partes.push(c.peca(forma, mat, { ...o, dy: z, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
      return
    }
    const [dx, dy] = girarPonto(0, z, volta)
    const textura = o.textura
    cena.partes.push(
      c.peca(girarForma(forma, volta), mat, {
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
}

/** As peças da vista de cima (só sem giro): pintam no lugar e sobem todas num pino no meio da pegada, sumindo na 3/4. */
function novaVistaDeCima(c: ContextoDoMovel, cena: Cena): Por {
  cena.sombras.push({ forma: ponto(0, 0), z: ALTURA_DO_PINO, solta: true, forca: 0, suave: BORDA_DO_PONTO })
  return (forma, mat, o = {}) => {
    cena.partes.push(c.peca(presa(forma, 0, 0), mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
  }
}

// ---------- texturas ----------

/** O ferro velho das ferragens: manchas de ferrugem (`quanto` de -0,3, quase limpo, a 0,3) e o grão do metal (o do potro). */
function texFerroVelho(quanto: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const mancha = ruido(x * 0.2 + p.su, y * 0.2 + p.sv) * 1.4 + ruido(x * 0.8 + p.sv, y * 0.8 + p.su) * 0.7
    const q = (mancha + quanto - 0.3) / 0.4
    const t = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
    s[3] += ruido(x * 0.16 + p.su, y * 0.16) * 0.1 + ruido(x * 0.7, y * 0.7 + p.sv) * 0.04 - t * 0.05
  }
}

/** Os anéis do corte da madeira de topo, em volta de (cx, cy): faixas finas, um pouco tortas (os da bigorna). */
function texAneis(cx: number, cy: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const d = Math.hypot(x - cx, y - cy) + ruido(x * 0.25, y * 0.25) * 0.8
    s[3] += Math.sin(d * 1.6) * 0.06 + ruido(x * 0.7, y * 0.7) * 0.04
  }
}

/** Um meio-furo na tela: o meio, o raio e a largura da beira gasta. */
interface FuroNaTela {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly beira: number
}

/** A madeira da prancha, lisa e mais clara na beira dos furos, onde o pescoço e os pulsos gastaram. */
function texDoGasto(base: Textura | null, furos: readonly FuroNaTela[]): Textura {
  return (u, v, x, y, p, s, escala) => {
    const antes = s[3]
    if (base !== null) base(u, v, x, y, p, s, escala)
    let gasto = 0
    for (const f of furos) gasto = Math.max(gasto, 1 - Math.abs(Math.hypot(x - f.x, y - f.y) - f.r) / f.beira)
    if (gasto <= 0) return
    const g = gasto * gasto
    s[3] = antes + (s[3] - antes) * (1 - ALISADO * g) + g * (LUZ_DO_GASTO + ruido(x * 0.3 + p.su, y * 0.3) * 0.02)
  }
}

function escurecido(m: MaterialDaPeca, t: number): MaterialDaPeca {
  return { ...m, rgb: [m.rgb[0] * t, m.rgb[1] * t, m.rgb[2] * t] }
}

/** As opções do ferro velho, com a ferrugem de cada peça sorteada pela semente. */
function doFerro(semente: number, tom = 1): OpcoesDaTela {
  return { tabua: 0, metal: BRILHO_DO_FERRO, tom, textura: texFerroVelho(FERRUGEM_DO_FERRO + 0.08 * Math.sin(semente * 1.7)), semente }
}

// ---------- o prisma ----------

/** Para onde corre o veio: ao comprido (`u`, o x da planta), de través (`y`), em pé (`z`) ou num ângulo da tela vista de frente (rad). */
type Veio = 'u' | 'y' | 'z' | number

/** Um meio-furo no perfil: o meio (u, e), o raio e a largura da beira gasta. */
interface Furo {
  readonly u: number
  readonly e: number
  readonly r: number
  readonly beira: number
}

/**
 * Uma parte do tronco: um PERFIL de pé no plano do comprimento, em (u, e), u o
 * x da planta sem giro e e = -z (a altura para cima, negativa, como na tela),
 * com a GROSSURA de y0 a y1 no y da planta. `cantos` é o contorno do perfil
 * (na ordem, para achar a ponta de lado); `reto` diz que o perfil é a caixa
 * dele (a beira de cima sai exata, sem varrer).
 */
interface Prisma {
  readonly perfil: Forma
  readonly cantos: readonly Ponto[]
  readonly reto: boolean
  readonly y0: number
  readonly y1: number
  readonly mat: MaterialDaPeca
  readonly veio: Veio
  /** As opções da face e as da beira de cima; o veio sai da vista. */
  readonly face: OpcoesDaTela
  readonly topo: OpcoesDaTela
  readonly furos: readonly Furo[]
  /** O perfil é o polígono convexo dos cantos: a beira de cima é o fecho dele com a cópia subida (exata, sem dentes). */
  readonly convexo: boolean
}

/** Uma peça: o prisma, se é ferro da face da frente (de costas fica atrás das pranchas e não é desenhada) e o miúdo pintado na face, só de frente. */
interface Parte {
  readonly prisma: Prisma
  readonly naFrente: boolean
  readonly miudos?: (por: Por) => void
}

/** Uma parte com as que vão presas nela, desenhadas logo depois dela. */
interface Elemento {
  readonly parte: Parte
  readonly presas: readonly Parte[]
}

type Opcoes = readonly [OpcoesDaTela, OpcoesDaTela]

function deMadeira(face: number, topo: number, semente: number): Opcoes {
  return [
    { tabua: 0, bisel: 0.8, tom: face, contorno: 0.28, semente },
    { tabua: 0, bisel: 0.6, tom: topo, contorno: 0.24, semente: semente + 1 },
  ]
}

function deFerro(semente: number, tom = 1): Opcoes {
  return [
    { bisel: 0.6, contorno: 0.3, ...doFerro(semente, tom * TOM_DA_FACE_DO_FERRO) },
    { bisel: 0.5, contorno: 0.26, ...doFerro(semente + 1, tom * TOM_DO_TOPO_DO_FERRO) },
  ]
}

/** O prisma de perfil retangular, de z0 a z1 e de u0 a u1. */
function reto(u0: number, z0: number, u1: number, z1: number, y0: number, y1: number, mat: MaterialDaPeca, veio: Veio, [face, topo]: Opcoes): Prisma {
  return {
    perfil: caixa(u0, -z1, u1, -z0, RAIO_DA_QUINA),
    cantos: [[u0, -z0], [u1, -z0], [u1, -z1], [u0, -z1]],
    reto: true,
    y0,
    y1,
    mat,
    veio,
    face,
    topo,
    furos: [],
    convexo: true,
  }
}

/** O prisma de perfil poligonal (os cantos, na ordem, de um polígono convexo), com os meios-furos tirados. */
function deContorno(cantos: readonly Ponto[], furos: readonly Furo[], y0: number, y1: number, mat: MaterialDaPeca, veio: Veio, [face, topo]: Opcoes): Prisma {
  let perfil = poligono(cantos)
  for (const f of furos) perfil = menos(perfil, elipse(f.u, f.e, f.r, f.r))
  return { perfil, cantos, reto: false, y0, y1, mat, veio, face, topo, furos, convexo: furos.length === 0 }
}

/** O prisma de uma forma qualquer: os cantos são os da caixa dela. */
function deForma(perfil: Forma, y0: number, y1: number, mat: MaterialDaPeca, [face, topo]: Opcoes): Prisma {
  const [u0, e0, u1, e1] = perfil.b
  return { perfil, cantos: [[u0, e1], [u1, e1], [u1, e0], [u0, e0]], reto: false, y0, y1, mat, veio: 'u', face, topo, furos: [], convexo: false }
}

/** O fecho convexo dos pontos (a cadeia monótona). */
function fechoConvexo(pontos: readonly Ponto[]): Ponto[] {
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cruz = (o: Ponto, a: Ponto, b: Ponto): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const metade = (lista: readonly Ponto[]): Ponto[] => {
    const h: Ponto[] = []
    for (const pt of lista) {
      while (h.length >= 2 && cruz(h[h.length - 2], h[h.length - 1], pt) <= 0) h.pop()
      h.push(pt)
    }
    return h.slice(0, -1)
  }
  return [...metade(p), ...metade([...p].reverse())]
}

/** A forma do perfil na tela de frente: X = s·u, Y = yFrente + e (de costas, s = -1). */
function naTela(f: Forma, s: number, yFrente: number): Forma {
  const [u0, e0, u1, e1] = f.b
  return {
    b: s > 0 ? [u0, e0 + yFrente, u1, e1 + yFrente] : [-u1, e0 + yFrente, -u0, e1 + yFrente],
    d: (x, y) => f.d(s * x, y - yFrente),
  }
}

/** A forma varrida para cima `t` px: o que a beira de cima, o fundo dos furos abertos para cima e a ponta inclinada mostram. */
function varridaPraCima(f: Forma, t: number): Forma {
  const n = Math.max(1, Math.ceil(t / PASSO_DA_VARRIDA))
  return {
    b: [f.b[0], f.b[1] - t, f.b[2], f.b[3]],
    d: (x, y) => {
      let menor = LONGE
      for (let i = 0; i <= n; i += 1) menor = Math.min(menor, f.d(x, y + (t * i) / n))
      return menor
    },
  }
}

type Superficie = 'face' | 'topo' | 'faixa' | 'ponta'

/**
 * O veio da superfície na vista, como ângulo da tela; `null` = madeira de topo
 * (os anéis). De frente (q par) a face é o plano do comprimento e o topo é o
 * de cima; de lado (q ímpar) a faixa é o de cima, correndo para o fundo, e a
 * ponta é o corte virado para quem olha.
 */
function veioNaVista(veio: Veio, sup: Superficie, q: number): number | null {
  if (q % 2 === 0) {
    if (typeof veio === 'number') return q === 0 ? veio : -veio
    if (sup === 'face') return veio === 'u' ? 0 : veio === 'z' ? QUARTO : null
    return veio === 'u' ? 0 : veio === 'y' ? QUARTO : null
  }
  if (sup === 'faixa') return veio === 'y' ? 0 : veio === 'z' ? null : QUARTO
  return veio === 'y' ? 0 : veio === 'z' ? QUARTO : null
}

/** As opções da superfície: o veio da vista, ou os anéis em volta de `centro` na madeira de topo (o ferro guarda a textura dele). */
function naSuperficie(pr: Prisma, o: OpcoesDaTela, sup: Superficie, q: number, centro: Ponto): OpcoesDaTela {
  const eixo = veioNaVista(pr.veio, sup, q)
  if (eixo !== null) return { ...o, eixo }
  if (o.textura !== undefined) return o
  return { ...o, textura: texAneis(centro[0], centro[1]) }
}

/** O prisma de frente (q 0) ou de costas (q 2): a beira de cima varrida e a face por cima dela, com o gasto dos furos. */
function desenharDeFrente(pr: Prisma, q: number, por: Por): void {
  const s = q === 0 ? 1 : -1
  const yFrente = q === 0 ? pr.y1 : -pr.y0
  const t = pr.y1 - pr.y0
  const vista = naTela(pr.perfil, s, yFrente)
  const [x0, y0, x1, y1] = vista.b
  const face = pr.reto ? caixa(x0, y0, x1, y1, RAIO_DA_QUINA) : vista
  let topo: Forma
  if (pr.reto) topo = caixa(x0, y0 - t, x1, y1, RAIO_DA_QUINA)
  else if (pr.convexo) {
    const pts: Ponto[] = []
    for (const [u, e] of pr.cantos) pts.push([s * u, yFrente + e], [s * u, yFrente + e - t])
    topo = poligono(fechoConvexo(pts))
  } else topo = varridaPraCima(vista, t)
  const meioX = (x0 + x1) / 2
  por(topo, pr.mat, naSuperficie(pr, pr.topo, 'topo', q, [meioX, y0 - t / 2]))
  const opcoes =
    pr.furos.length === 0
      ? pr.face
      : { ...pr.face, textura: texDoGasto(texturaDaClasse(pr.mat.classe), pr.furos.map((f) => ({ x: s * f.u, y: yFrente + f.e, r: f.r, beira: f.beira }))) }
  por(face, pr.mat, naSuperficie(pr, opcoes, 'face', q, [meioX, (y0 + y1) / 2]))
}

/** O prisma de lado (q 1 ou 3): a faixa da beira de cima, correndo para o fundo, e a ponta virada para quem olha. */
function desenharDeLado(pr: Prisma, q: number, por: Por): void {
  const s = q === 1 ? 1 : -1
  const xa = q === 1 ? -pr.y1 : pr.y0
  const xb = q === 1 ? -pr.y0 : pr.y1
  const ws = pr.cantos.map(([u, e]) => s * u + e)
  const yA = Math.min(...ws)
  const yB = Math.max(...ws)
  // A ponta: a beira do perfil mais perto de quem olha (o canto mais perto e o vizinho mais perto dele).
  const n = pr.cantos.length
  let i = 0
  for (let w = 1; w < n; w += 1) if (s * pr.cantos[w][0] > s * pr.cantos[i][0]) i = w
  const antes = (i + n - 1) % n
  const depois = (i + 1) % n
  const j = s * pr.cantos[antes][0] > s * pr.cantos[depois][0] ? antes : depois
  const p0 = Math.min(ws[i], ws[j])
  const p1 = Math.max(ws[i], ws[j])
  const meioX = (xa + xb) / 2
  por(caixa(xa, yA, xb, yB, RAIO_DA_QUINA), pr.mat, naSuperficie(pr, pr.topo, 'faixa', q, [meioX, (yA + p0) / 2]))
  if (p1 - p0 > PONTA_MINIMA) por(caixa(xa, p0, xb, p1, RAIO_DA_QUINA), pr.mat, naSuperficie(pr, pr.face, 'ponta', q, [meioX, (p0 + p1) / 2]))
}

// ---------- as medidas do desenho ----------

interface Medidas {
  readonly k: number
  readonly mad: MaterialDaPeca
  readonly ferro: MaterialDaPeca
  /** A face de dentro dos mourões (as pontas das pranchas) e a de fora. */
  readonly vao: number
  readonly fora: number
  /** A meia grossura das pranchas, a altura de cada uma e a linha dos furos (o alto da de baixo). */
  readonly g: number
  readonly h: number
  readonly linha: number
  readonly comprimento: number
  /** O ponto da prancha de cima erguida: `a` ao longo dela a partir da quina da dobradiça, `b` para baixo a partir da beira de cima, em (u, e). */
  readonly erguida: (a: number, b: number) => Ponto
  /** Onde começam as duas cintas, contado da quina da dobradiça. */
  readonly cintas: readonly [number, number]
  /** O x do ferrolho fechado, do grampo e do cadeado (um debaixo do outro). */
  readonly xFecho: number
}

function medir(c: ContextoDoMovel): Medidas {
  const k = Math.min(c.w / (LARGURA_DE_PARTIDA * G), c.h / (FUNDO_DE_PARTIDA * G))
  const fora = c.hw - RECUO_DO_MOURAO * k
  const vao = fora - LADO_DO_MOURAO * k
  const h = ALTURA_DA_PRANCHA * k
  const linha = LINHA_DOS_FUROS * k
  const comprimento = 2 * vao
  // A dobradiça fica na quina de cima da prancha de cima, junto do mourão: erguida, a ponta solta sobe.
  const zDobradica = linha + h
  const co = Math.cos(ABERTURA)
  const si = Math.sin(ABERTURA)
  const erguida = (a: number, b: number): Ponto => [-vao + a * co + b * si, -(zDobradica + a * si - b * co)]
  const cintaDoFerrolho = comprimento - CINTA_DO_FERROLHO * k
  return {
    k,
    mad: c.m.madeira,
    ferro: escurecido(c.m.ferragens, TOM_DO_FERRO),
    vao,
    fora,
    g: MEIA_GROSSURA * k,
    h,
    linha,
    comprimento,
    erguida,
    cintas: [CINTA_DA_DOBRADICA * k, cintaDoFerrolho],
    xFecho: -vao + cintaDoFerrolho + (LARGURA_DA_CINTA * k) / 2,
  }
}

/** O rebite (ou a cabeça do parafuso): a cabeça clara e redonda, na tela. */
function rebite(m: Medidas, x: number, y: number, por: Por, semente: number): void {
  const r = RAIO_DO_REBITE * m.k
  por(elipse(x, y, r, r), m.ferro, { bisel: 0.6, contorno: 0.2, ...doFerro(semente, TOM_DO_REBITE) })
}

function so(prisma: Prisma, presas: readonly Parte[] = [], miudos?: (por: Por) => void): Elemento {
  return { parte: { prisma, naFrente: false, miudos }, presas }
}

/** A folha da dobradiça na face do mourão da esquerda, com dois rebites. */
function folhaDaDobradica(m: Medidas, yFace: number): Parte {
  const { k, vao, linha, h } = m
  const z0 = linha + h - FOLHA.altura * k * 0.65
  const z1 = z0 + FOLHA.altura * k
  const u0 = -vao - FOLHA.comprimento * k
  const y1 = yFace + FOLHA.grossura * k
  return {
    prisma: reto(u0, z0, -vao, z1, yFace, y1, m.ferro, 'u', deFerro(80)),
    naFrente: true,
    miudos: (por) => {
      for (const f of [0.25, 0.68]) rebite(m, u0 + (-vao - u0) * f, y1 - (z0 + z1) / 2, por, 82)
    },
  }
}

/** A cinta de ferro que abraça a prancha de cima, de `a0` ao longo dela, com os rebites nas alturas dadas. */
function cinta(m: Medidas, a0: number, rebites: readonly number[], semente: number): Parte {
  const { k, g, h, erguida } = m
  const a1 = a0 + LARGURA_DA_CINTA * k
  const sobra = SOBRA_DA_CINTA * k
  const y1 = g + sobra
  return {
    prisma: deContorno([erguida(a0, -sobra), erguida(a1, -sobra), erguida(a1, h + sobra), erguida(a0, h + sobra)], [], -y1, y1, m.ferro, 'u', deFerro(semente)),
    naFrente: false,
    miudos: (por) => {
      for (const b of rebites) {
        const [u, e] = erguida((a0 + a1) / 2, b * h)
        rebite(m, u, y1 + e, por, semente + 2)
      }
    },
  }
}

/** O nó da dobradiça, na quina de cima da prancha erguida. */
function noDaDobradica(m: Medidas): Parte {
  const { k, g } = m
  const [u, e] = m.erguida(0, 0)
  const r = RAIO_DO_NO * k
  return { prisma: deForma(elipse(u, e, r, r), g - 0.3 * k, g + 1.9 * k, m.ferro, deFerro(66, 1.1)), naFrente: true }
}

/** O ferrolho pendurado da cinta da ponta solta, a prumo, com o olhal embaixo. */
function ferrolho(m: Medidas): Parte {
  const { k, g, h } = m
  const [u, e] = m.erguida(m.cintas[1] + (LARGURA_DA_CINTA * k) / 2, h / 2)
  const comprimento = FERROLHO.comprimento * k
  const corpo = capsula(u, e, u, e + comprimento, FERROLHO.meia * k)
  const olhal = capsula(u, e + comprimento - FERROLHO.olhal[1] * k, u, e + comprimento - FERROLHO.olhal[0] * k, FERROLHO.raioDoOlhal * k)
  const y0 = g + SOBRA_DA_CINTA * k
  const y1 = y0 + FERROLHO.grossura * k
  return {
    prisma: deForma(menos(corpo, olhal), y0, y1, m.ferro, deFerro(68, 1.04)),
    naFrente: true,
    miudos: (por) => rebite(m, u, y1 + e, por, 69),
  }
}

/** O grampo na face da prancha de baixo, debaixo do ferrolho. */
function grampo(m: Medidas): Parte {
  const { k, g } = m
  const z = m.linha - GRAMPO.abaixo * k
  const x = m.xFecho
  return {
    prisma: reto(x - GRAMPO.meia * k, z - GRAMPO.meiaAltura * k, x + GRAMPO.meia * k, z + GRAMPO.meiaAltura * k, g, g + GRAMPO.sai * k, m.ferro, 'u', deFerro(84, 1.04)),
    naFrente: true,
  }
}

/** O cadeado pendurado no grampo: o corpo e, de frente, a haste aberta (uma perna fora do corpo) e o buraco da chave. */
function cadeado(m: Medidas): Parte {
  const { k } = m
  const x = m.xFecho
  const zGrampo = m.linha - GRAMPO.abaixo * k
  const z1 = zGrampo - CADEADO.abaixo * k
  const z0 = z1 - CADEADO.alto * k
  const y0 = CADEADO.y0 * k
  const y1 = CADEADO.y1 * k
  const meia = CADEADO.meia * k
  return {
    prisma: reto(x - meia, z0, x + meia, z1, y0, y1, m.ferro, 'u', deFerro(86, TOM_DO_CADEADO)),
    naFrente: true,
    miudos: (por) => {
      const yHaste = (y0 + y1) / 2
      const arco = CADEADO.arco * k
      const zArco = zGrampo - 0.8 * arco
      const pts: Ponto[] = [[x - arco, yHaste - z1 - 0.2 * k], [x - arco, yHaste - zArco]]
      for (let i = 1; i < PONTOS_DO_ARCO; i += 1) {
        const a = Math.PI - (Math.PI * i) / PONTOS_DO_ARCO
        pts.push([x + arco * Math.cos(a), yHaste - zArco - arco * Math.sin(a)])
      }
      pts.push([x + arco, yHaste - zArco], [x + arco, yHaste - z1 - CADEADO.folga * k])
      por(cadeia(pts, CADEADO.haste * k), m.ferro, { bisel: 0.5, contorno: 0.26, ...doFerro(88, TOM_DA_HASTE) })
      const yChave = y1 - (z1 - CADEADO.alto * k * 0.38)
      por(uniao(elipse(x, yChave, 0.6 * k, 0.6 * k), capsula(x, yChave, x, yChave + 1.3 * k, 0.3 * k)), RISCO, { bisel: 0, contorno: 0, alfa: 0.9 })
    },
  }
}

/** As partes do tronco, cada uma com as presas nela. */
function partesDo(m: Medidas): Elemento[] {
  const { k, mad, vao, fora, g, h, linha, erguida, comprimento } = m
  const els: Elemento[] = []
  const zPe = ALTO_DO_PE * k
  const zSoleira = ALTO_DA_SOLEIRA * k
  const sobra = SOBRA_DO_PE * k
  const meioLado = (LADO_DO_MOURAO * k) / 2

  // A base em H: os dois pés atravessados (a face é madeira de topo) e a soleira entre eles.
  for (const lado of LADOS) {
    const [u0, u1] = lado < 0 ? [-fora - sobra, -vao + sobra] : [vao - sobra, fora + sobra]
    els.push(so(reto(u0, 0, u1, zPe, -MEIO_FUNDO_DO_PE * k, MEIO_FUNDO_DO_PE * k, mad, 'y', deMadeira(TOM_DO_PE, TOM_DO_TOPO, 10 + lado))))
  }
  els.push(so(reto(-vao + sobra, 0, vao - sobra, zSoleira, -MEIO_FUNDO_DA_SOLEIRA * k, MEIO_FUNDO_DA_SOLEIRA * k, mad, 'u', deMadeira(TOM_DA_SOLEIRA, TOM_DO_TOPO, 14))))

  // As mãos-francesas, do mourão até a soleira, com o veio ao comprido delas.
  for (const lado of LADOS) {
    const [zb, zc] = MAO_NO_MOURAO
    const [da, db] = MAO_NA_SOLEIRA
    const cantos: Ponto[] = [[lado * vao, -zb * k], [lado * (vao - da * k), -zSoleira], [lado * (vao - db * k), -zSoleira], [lado * vao, -zc * k]]
    const veio = Math.atan2(((zb + zc) / 2) * k - zSoleira, -lado * ((da + db) / 2) * k)
    els.push(so(deContorno(cantos, [], -MEIA_GROSSURA_DA_MAO * k, MEIA_GROSSURA_DA_MAO * k, mad, veio, deMadeira(TOM_DA_FACE, TOM_DO_TOPO, 16 + lado))))
  }

  // Os mourões, com as cabeças dos parafusos que prendem a prancha de baixo; no da esquerda, a folha da dobradiça.
  for (const lado of LADOS) {
    const [u0, u1] = lado < 0 ? [-fora, -vao] : [vao, fora]
    const meio = (u0 + u1) / 2
    const parafusos = (por: Por): void => {
      for (const f of [0.3, 0.7]) rebite(m, meio, meioLado - (linha - h * f), por, 20 + lado)
    }
    const presas = lado < 0 ? [folhaDaDobradica(m, meioLado)] : []
    els.push(so(reto(u0, zPe, u1, ALTO_DO_MOURAO * k, -meioLado, meioLado, mad, 'z', deMadeira(TOM_DO_MOURAO, TOM_DO_TOPO, 30 + lado)), presas, parafusos))
  }

  // A prancha de baixo, presa, com os meios-furos abertos para cima; o grampo e o cadeado na face dela.
  const beira = BEIRA_GASTA * k
  const furosDeBaixo: Furo[] = FUROS.map((f) => ({ u: f.x * k, e: -linha, r: f.r * k, beira }))
  const deBaixo: Ponto[] = [[-vao, -linha + h], [vao, -linha + h], [vao, -linha], [-vao, -linha]]
  els.push(so(deContorno(deBaixo, furosDeBaixo, -g, g, mad, 'u', deMadeira(TOM_DA_FACE, TOM_DO_TOPO, 40)), [grampo(m), cadeado(m)]))

  // A prancha de cima, erguida na dobradiça, com os meios-furos virados para baixo; as cintas, o nó e o ferrolho nela.
  const furosDeCima: Furo[] = FUROS.map((f) => {
    const [u, e] = erguida(f.x * k + vao, h)
    return { u, e, r: f.r * k, beira }
  })
  const deCima: Ponto[] = [erguida(0, 0), erguida(comprimento, 0), erguida(comprimento, h), erguida(0, h)]
  els.push(
    so(deContorno(deCima, furosDeCima, -g, g, mad, -ABERTURA, deMadeira(TOM_DA_PRANCHA_DE_CIMA, TOM_DO_TOPO, 50)), [
      cinta(m, m.cintas[0], [0.24, 0.76], 60),
      noDaDobradica(m),
      cinta(m, m.cintas[1], [0.2], 64),
      ferrolho(m),
    ]),
  )
  return els
}

// ---------- a ordem de trás para a frente ----------

/** O prisma na vista: o fundo (o y da tela da planta girada), as alturas, a caixa que ocupa na tela e a chave de desempate. */
interface NaVista {
  readonly el: Elemento
  readonly fundo: readonly [number, number]
  readonly alto: readonly [number, number]
  readonly tela: Caixa
  readonly chave: number
}

function caixaNaTela(pr: Prisma, q: number): Caixa {
  const [u0, e0, u1, e1] = pr.perfil.b
  const a = girarPonto(u0, pr.y0, q)
  const b = girarPonto(u1, pr.y1, q)
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]) + e0, Math.max(a[0], b[0]), Math.max(a[1], b[1]) + e1]
}

function naVista(el: Elemento, q: number): NaVista {
  const pr = el.parte.prisma
  const [u0, e0, u1, e1] = pr.perfil.b
  const a = girarPonto(u0, pr.y0, q)
  const b = girarPonto(u1, pr.y1, q)
  let tela = caixaNaTela(pr, q)
  for (const p of el.presas) {
    const c = caixaNaTela(p.prisma, q)
    tela = [Math.min(tela[0], c[0]), Math.min(tela[1], c[1]), Math.max(tela[2], c[2]), Math.max(tela[3], c[3])]
  }
  let su = 0
  let se = 0
  for (const [u, e] of pr.cantos) {
    su += u
    se += e
  }
  const n = pr.cantos.length
  return {
    el,
    fundo: [Math.min(a[1], b[1]), Math.max(a[1], b[1])],
    alto: [-e1, -e0],
    tela,
    chave: girarPonto(su / n, (pr.y0 + pr.y1) / 2, q)[1] - se / n,
  }
}

function sobrepoe(a: Caixa, b: Caixa): boolean {
  return a[0] < b[2] - FOLGA && b[0] < a[2] - FOLGA && a[1] < b[3] - FOLGA && b[1] < a[3] - FOLGA
}

/**
 * `a` tem de vir antes de `b`: as duas se cobrem na tela e `a` fica toda
 * atrás de `b` (a 3/4 olha do sul e de cima), ou, lado a lado no fundo, toda
 * embaixo dela; se nada disso decide, a que tem o meio mais longe vem antes.
 */
function vemAntes(a: NaVista, b: NaVista): boolean {
  if (!sobrepoe(a.tela, b.tela)) return false
  if (a.fundo[1] <= b.fundo[0] + FOLGA) return true
  if (b.fundo[1] <= a.fundo[0] + FOLGA) return false
  if (a.alto[1] <= b.alto[0] + FOLGA) return true
  if (b.alto[1] <= a.alto[0] + FOLGA) return false
  return a.chave < b.chave
}

/** As partes na ordem de pintar: sai primeiro a que nenhuma outra precisa cobrir, a mais longe entre as livres. */
function emOrdem(els: readonly Elemento[], q: number): Elemento[] {
  const resta = els.map((el) => naVista(el, q))
  const feitos: Elemento[] = []
  while (resta.length > 0) {
    let escolhido = -1
    for (let i = 0; i < resta.length; i += 1) {
      const livre = resta.every((o, j) => j === i || !vemAntes(o, resta[i]))
      if (livre && (escolhido < 0 || resta[i].chave < resta[escolhido].chave)) escolhido = i
    }
    if (escolhido < 0) {
      // Um ciclo (não acontece neste desenho): sai o de meio mais longe.
      escolhido = 0
      for (let i = 1; i < resta.length; i += 1) if (resta[i].chave < resta[escolhido].chave) escolhido = i
    }
    feitos.push(resta[escolhido].el)
    resta.splice(escolhido, 1)
  }
  return feitos
}

function montarNaTela(els: readonly Elemento[], q: number, por: Por): void {
  for (const el of emOrdem(els, q)) {
    for (const p of [el.parte, ...el.presas]) {
      if (q === 2 && p.naFrente) continue
      if (q % 2 === 0) desenharDeFrente(p.prisma, q, por)
      else desenharDeLado(p.prisma, q, por)
      if (q === 0 && p.miudos !== undefined) p.miudos(por)
    }
  }
}

// ---------- as sombras ----------

/** A forma `f` de cima arrastada na direção da luz `luz` (px por px de altura), de z0 a z1: a sombra de uma coisa de pé. */
function varrida(f: Forma, z0: number, z1: number, luz: Ponto): Forma {
  const [lx, ly] = luz
  const zs = Array.from({ length: AMOSTRAS_DA_SOMBRA + 1 }, (_, i) => z0 + ((z1 - z0) * i) / AMOSTRAS_DA_SOMBRA)
  return {
    b: [f.b[0] + Math.min(lx * z0, lx * z1), f.b[1] + Math.min(ly * z0, ly * z1), f.b[2] + Math.max(lx * z0, lx * z1), f.b[3] + Math.max(ly * z0, ly * z1)],
    d: (x, y) => {
      let menor = LONGE
      for (const z of zs) menor = Math.min(menor, f.d(x - lx * z, y - ly * z))
      return menor
    },
  }
}

/**
 * A sombra no chão de um prisma de perfil vazado (as pranchas com os furos, a
 * prancha erguida, as mãos-francesas): cada ponto do chão volta pela luz até o
 * plano do perfil, em algumas fatias da grossura. Os furos ficam vazados na
 * sombra.
 */
function sombraDoPerfil(pr: Prisma, luz: Ponto): Forma {
  const [lx, ly] = luz
  const [u0, e0, u1, e1] = pr.perfil.b
  const zBaixo = -e1
  const zAlto = -e0
  const ys = Array.from({ length: FATIAS_DA_GROSSURA + 1 }, (_, i) => pr.y0 + ((pr.y1 - pr.y0) * i) / FATIAS_DA_GROSSURA)
  return {
    b: [
      u0 + Math.min(lx * zBaixo, lx * zAlto),
      pr.y0 + Math.min(ly * zBaixo, ly * zAlto),
      u1 + Math.max(lx * zBaixo, lx * zAlto),
      pr.y1 + Math.max(ly * zBaixo, ly * zAlto),
    ],
    d: (x, y) => {
      let menor = LONGE
      for (const y0 of ys) {
        const z = (y - y0) / ly
        menor = Math.min(menor, pr.perfil.d(x - lx * z, -z))
      }
      return menor * ENCOLHE_DA_SOMBRA
    },
  }
}

/** A união das sombras, sem medir a parte cuja caixa já está longe demais. */
function juntas(formas: readonly Forma[]): Forma {
  let b0 = Infinity
  let b1 = Infinity
  let b2 = -Infinity
  let b3 = -Infinity
  for (const f of formas) {
    b0 = Math.min(b0, f.b[0])
    b1 = Math.min(b1, f.b[1])
    b2 = Math.max(b2, f.b[2])
    b3 = Math.max(b3, f.b[3])
  }
  return {
    b: [b0, b1, b2, b3],
    d: (x, y) => {
      let menor = LONGE
      for (const f of formas) {
        const fora = Math.max(f.b[0] - x, x - f.b[2], f.b[1] - y, y - f.b[3])
        if (fora > menor + MARGEM_DA_SOMBRA) continue
        menor = Math.min(menor, f.d(x, y))
      }
      return menor
    },
  }
}

/** As sombras no chão, na planta sem giro (a volta da 3/4 as gira com o resto): a luz vem desgirada. */
function montarSombras(els: readonly Elemento[], q: number, cena: Cena): void {
  const luz = girarPonto(SOMBRA_X, SOMBRA_Y, (4 - q) % 4)
  const partes: Forma[] = []
  for (const { parte } of els) {
    const pr = parte.prisma
    const [u0, e0, u1, e1] = pr.perfil.b
    const pegada = caixa(u0, pr.y0, u1, pr.y1, RAIO_DA_QUINA)
    partes.push(pr.reto ? varrida(pegada, -e1, -e0, luz) : sombraDoPerfil(pr, luz))
    if (-e1 <= FOLGA) cena.sombras.push(contato(pegada, CONTATO_DA_BASE))
  }
  cena.sombras.push({ forma: juntas(partes), z: 0, ...SOMBRA_DO_VULTO })
}

// ---------- a vista de cima ----------

function montarDeCima(m: Medidas, c: ContextoDoMovel, cena: Cena): void {
  const por = novaVistaDeCima(c, cena)
  const { k, mad, ferro, vao, fora, g, h, erguida, comprimento } = m
  const sobra = SOBRA_DO_PE * k
  const meioDoPe = MEIO_FUNDO_DO_PE * k
  const meioLado = (LADO_DO_MOURAO * k) / 2
  // Os pés atravessados, com o veio de través; o topo dos mourões com os anéis do corte.
  for (const lado of LADOS) {
    const [u0, u1] = lado < 0 ? [-fora - sobra, -vao + sobra] : [vao - sobra, fora + sobra]
    por(caixa(u0, -meioDoPe, u1, meioDoPe, RAIO_DA_QUINA), mad, { tabua: 0, eixo: QUARTO, bisel: 0.9, tom: TOM_DO_TOPO, contorno: 0.28, semente: 100 + lado })
  }
  for (const lado of LADOS) {
    const [u0, u1] = lado < 0 ? [-fora, -vao] : [vao, fora]
    por(caixa(u0, -meioLado, u1, meioLado, RAIO_DA_QUINA), mad, { tabua: 0, bisel: 1, tom: TOM_DO_TOPO, contorno: 0.32, textura: texAneis((u0 + u1) / 2, 0), semente: 104 + lado })
  }
  // A prancha de cima erguida tapa a de baixo: a beira de cima, virada para a luz, e a ponta de topo.
  const fimDaBeira = erguida(comprimento, 0)[0]
  const fimDaPonta = erguida(comprimento, h)[0]
  por(caixa(-vao, -g, fimDaBeira, g, RAIO_DA_QUINA), mad, { tabua: 0, eixo: 0, bisel: 0.7, tom: TOM_DA_BEIRA_ERGUIDA, contorno: 0.3, semente: 110 })
  por(caixa(fimDaBeira, -g, fimDaPonta, g, RAIO_DA_QUINA), mad, {
    tabua: 0,
    bisel: 0.5,
    tom: TOM_DA_PONTA_ERGUIDA,
    contorno: 0.3,
    textura: texAneis((fimDaBeira + fimDaPonta) / 2, 0),
    semente: 111,
  })
  // As cintas de ferro sobre a beira, a folha e o nó da dobradiça, o ferrolho, o grampo e o cadeado com a haste aberta.
  const sobraDaCinta = SOBRA_DA_CINTA * k
  for (const [i, a0] of m.cintas.entries()) {
    const x0 = erguida(a0, 0)[0]
    const x1 = erguida(a0 + LARGURA_DA_CINTA * k, 0)[0]
    por(caixa(x0, -g - sobraDaCinta, x1, g + sobraDaCinta, 0.3 * k), ferro, { bisel: 0.6, contorno: 0.3, ...doFerro(112 + i * 2, TOM_DO_TOPO_DO_FERRO) })
  }
  por(caixa(-vao - FOLHA.comprimento * k, meioLado, -vao, meioLado + FOLHA.grossura * k, 0.2 * k), ferro, { bisel: 0.3, contorno: 0.2, ...doFerro(116) })
  const raioDoNo = RAIO_DO_NO * k
  por(caixa(-vao - raioDoNo, g - 0.3 * k, -vao + raioDoNo, g + 1.9 * k, 0.6 * k), ferro, { bisel: 0.6, contorno: 0.3, ...doFerro(117, TOM_DO_TOPO_DO_FERRO) })
  const xFerrolho = erguida(m.cintas[1] + (LARGURA_DA_CINTA * k) / 2, h / 2)[0]
  const yFerrolho = g + sobraDaCinta
  por(caixa(xFerrolho - FERROLHO.meia * k, yFerrolho, xFerrolho + FERROLHO.meia * k, yFerrolho + FERROLHO.grossura * k, 0.2 * k), ferro, { bisel: 0.3, contorno: 0.2, ...doFerro(118) })
  const x = m.xFecho
  por(caixa(x - GRAMPO.meia * k, g, x + GRAMPO.meia * k, g + GRAMPO.sai * k, 0.3 * k), ferro, { bisel: 0.4, contorno: 0.24, ...doFerro(119) })
  const meiaDoCadeado = CADEADO.meia * k
  por(caixa(x - meiaDoCadeado, CADEADO.y0 * k, x + meiaDoCadeado, CADEADO.y1 * k, 0.8 * k), ferro, { bisel: 0.7, contorno: 0.3, ...doFerro(120, TOM_DO_CADEADO * TOM_DO_TOPO_DO_FERRO) })
  const yHaste = ((CADEADO.y0 + CADEADO.y1) / 2) * k
  const arco = CADEADO.arco * k
  por(capsula(x - arco, yHaste, x + arco, yHaste, CADEADO.haste * k), ferro, { bisel: 0.4, contorno: 0.22, ...doFerro(121, TOM_DA_HASTE) })
}

export const montarTroncoDePrisioneiro: MontarMovel = (c, cena) => {
  const m = medir(c)
  const q = quartosDoGiro(c.giro)
  const els = partesDo(m)
  montarSombras(els, q, cena)
  if (q === 0) montarDeCima(m, c, cena)
  montarNaTela(els, q, novaTela(c, cena, q))
}
