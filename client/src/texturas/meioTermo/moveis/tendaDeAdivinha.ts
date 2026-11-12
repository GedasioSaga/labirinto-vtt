/**
 * A tenda de adivinha (lote 9 dos objetos novos, 11/11/2026): a tenda redonda
 * de pano escuro, roxo apagado e anil de noite em gomos alternados, bordada de
 * estrelas e luas cor de ocre, com o telhado em cone, o mastro com a flâmula,
 * a sanefa recortada no beiral, as cordas e as estacas nos cantos. A porta fica
 * ao sul: a cortina presa dos dois lados mostra o tapete, que sai para fora, e
 * a ponta de uma mesinha coberta (a bola de cristal é outro objeto).
 *
 * De cima, o cone visto do alto: os gomos em leque em volta do mastro, claros
 * do lado da luz e escuros do outro, e o recorte da porta com as abas dobradas.
 * Na 3/4 a tenda é vista de frente, inteira, montada pelas âncoras do gancho
 * com carne: cada peça é de uma vista só (a de cima some quando a 3/4 a sobe,
 * a de frente só aparece quando a 3/4 a traz de volta ao lugar), e a ordem dos
 * grupos na tela é a de trás para a frente.
 *
 * Girada (só a 3/4 recebe o giro), a tenda é a mesma; a porta foge para um
 * lado ou para o fundo: de lado fica só o tapete saindo, de costas nada.
 */
import type { Rgb } from '../../ruido'
import { caixa, cadeia, capsula, dentroDe, elipse, menos, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, texturaDaClasse, TOM_DA_CORDA, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, LENCOL, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- os materiais (fixos: o pano da adivinha não se escolhe) ----------

/** O pano de fora em dois tons, alternados por gomo: saturação HSV perto de 0,35, escuro e contido. */
const ROXO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x66, 0x57, 0x7e] }
const ANIL: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x4a, 0x50, 0x72] }
/** O bordado das estrelas e das luas e o galão do beiral: ocre velho, o único claro da tenda. */
const OCRE: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xa4, 0x66] }
/** O forro da cortina, que aparece onde ela está dobrada e presa de lado. */
const FORRO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xa6, 0x8c, 0x62] }
/** O escuro de dentro, visto pela porta. */
const DENTRO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x32, 0x46] }
/** O tapete da entrada, vinho velho. */
const TAPETE: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x7c, 0x40, 0x3e] }
/** A toalha da mesinha: veludo ameixa, que some no escuro de dentro sem virar uma lata clara (o linho virava). */
const TOALHA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x6a, 0x46, 0x62] }
const PERNA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x44, 0x34] }
const FLAMULA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x8e, 0x4c, 0x46] }
const LATAO = materialDaPeca('latao')
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
/**
 * O escuro em que o pixel escuro demais é levantado: roxo de noite, com
 * luminância linear perto de 0,05 (acima do piso de 0,045). Com o escuro da
 * nogueira, a sombra do pano roxo puxava para o marrom.
 */
const ESCURO_DO_PANO: Rgb = [0x45, 0x39, 0x5a]

// ---------- as medidas (px do protótipo numa tenda de 2 casas; crescem com a pegada) ----------

/** O tambor (a parede de pano) ocupa esta fração da meia pegada: o canto fica para as cordas e as estacas. */
const TAMBOR = 0.82
/** Quanto o beiral passa da parede. */
const BEIRAL = 2.4
/** A altura da parede, a do telhado acima dela e a ponta do mastro acima do cume, em casas. */
const PAREDE = 0.6
const TELHADO = 1.04
const PONTA_DO_MASTRO = 0.24
/** As estacas, na diagonal, a esta fração da meia pegada. */
const ESTACA = 0.9
const ALTURA_DA_ESTACA = 4.2
const RAIO_DA_ESTACA = 1.15
const RAIO_DA_CORDA = 0.5
/** Os gomos do pano em volta do mastro; o da porta é o primeiro, com a porta no meio dele. */
const GOMOS = 12
const ANGULO_DO_GOMO = (2 * Math.PI) / GOMOS
/** O gomo do telhado mais virado para trás que ainda aparece na 3/4 (o seno do meio dele; o cone esconde o resto). */
const TELHADO_VISTO = -0.85
/** Só o gomo e o pano da parede bem de frente levam bordado (de lado ele viraria um risco). */
const BORDADO_DA_PAREDE = 0.3
const BORDADO_DO_TELHADO = -0.45
/** Onde o bordado do telhado fica, do beiral (0) ao cume (1). */
const ALTURA_DO_BORDADO = 0.4
/** A porta: meia largura (fração do raio do tambor), quanto a ponta dela sobe acima do beiral e a altura da amarra da cortina (fração da parede). */
const LARGURA_DA_PORTA = 0.27
const PONTA_DA_PORTA = 30
const ALTURA_DA_AMARRA = 0.42
/** De cima, a ponta do recorte da porta, em fração do raio do beiral. */
const PONTA_DE_CIMA = 0.6
/** A sanefa: a faixa debaixo do beiral e os bicos recortados dela. */
const FAIXA_DA_SANEFA = 3.2
const BICO_DA_SANEFA = 2.6
const BICOS_DA_SANEFA = 12
const PASSOS_DA_SANEFA = 18
/** Só o bico bem de frente (o seno do ângulo dele) leva borla; a sombra da sanefa desce isto na parede. */
const BICO_DE_FRENTE = 0.25
const SOMBRA_DA_SANEFA = 2.4
/** O tapete da entrada: a meia largura e até onde ele chega, em fração da meia pegada. */
const MEIA_LARGURA_DO_TAPETE = 6.4
const TAPETE_ATE = 0.95
/** A mesinha vista pela porta: o lugar no chão (x em fração da meia porta), o raio, a altura e quanto a toalha cai. */
const MESINHA = { x: 0.6, recuo: 16, raio: 5.6, altura: 9.5, queda: 4.5 }
/** As pernas da mesinha, abaixo da toalha curta: o lugar (fração do raio) e a meia grossura. Sem elas, a toalha boiava no escuro. */
const PERNAS_DA_MESINHA = [-0.62, 0.62] as const
const PERNA_DA_MESINHA = 0.6
/** As cartas abertas na mesinha: o lugar (fração do raio, a partir do meio do tampo) e o giro de cada uma. */
const CARTAS: readonly (readonly [number, number, number])[] = [
  [-0.55, -0.1, -0.35],
  [-0.15, 0.12, 0.1],
]
/** A sombra da tenda no chão: força e borda (as amostras de cada elipse do casco). */
const FORCA_DA_SOMBRA = 0.3
const SUAVE_DA_SOMBRA = 2.6
const AMOSTRAS_DA_SOMBRA = 16
const FORCA_DA_SOMBRA_DA_CORDA = 0.14

/** A luz do pintor (`motor.ts`), de cima à esquerda. */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
/** Quanto a face do cone virada para a luz clareia (e a do outro lado escurece). */
const LADO_DO_CONE = 0.45
/** A parede é de pé: tom de frente, mais claro à esquerda (de onde vem a luz) e mais escuro à direita. */
const TOM_DA_PAREDE = 0.8
const LADO_DA_PAREDE = 0.17
/** Dentro da tenda é sombra: o que se vê pela porta fica neste tom. */
const TOM_DE_DENTRO = 0.68

/** Os quatro cantos (x, y) da pegada, no sentido da tela. */
const CANTOS: readonly Ponto[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

interface Medidas {
  /** Meia pegada na tela (de lado, a largura e o fundo trocam). */
  readonly sx: number
  readonly sy: number
  /** Raio do tambor e do beiral. */
  readonly rx: number
  readonly ry: number
  readonly ex: number
  readonly ey: number
  readonly parede: number
  readonly cume: number
  readonly mastro: number
  /** Escala do detalhe (1 numa tenda de 2 casas). */
  readonly k: number
  /** Inclinação do telhado, do chão. */
  readonly inclinacao: number
}

function medir(sx: number, sy: number): Medidas {
  const k = Math.min(sx, sy) / G
  const rx = sx * TAMBOR
  const ry = sy * TAMBOR
  const ex = rx + BEIRAL * k
  const ey = ry + BEIRAL * k
  const parede = PAREDE * G * k
  const telhado = TELHADO * G * k
  return { sx, sy, rx, ry, ex, ey, parede, cume: parede + telhado, mastro: PONTA_DO_MASTRO * G * k, k, inclinacao: Math.atan2(telhado, Math.min(ex, ey)) }
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

// ---------- a peça de uma vista só e a âncora (as do gancho com carne) ----------

/**
 * A peça só é pintada NO LUGAR em que foi desenhada (`dy` zero). A 3/4 sobe
 * cada peça mexendo no `dy` dela: a da vista de cima (nasce com `dy` zero)
 * some quando sobe, e a de frente (nasce deslocada a altura da âncora) aparece
 * quando a 3/4 a traz de volta. Só vale sem giro.
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

/** Põe uma peça num grupo (a lista vai de trás para a frente). */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaVista) => void

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

/** Abre um grupo com o meio da caixa de pintura no meio de `b`: cada peça do grupo pinta numa janela justa. A base tem de ficar abaixo (ao sul) do meio. */
function grupoJusto(tela: Tela, base: number, b: Caixa): Por {
  return tela.grupo((b[0] + b[2]) / 2, base, (b[1] + b[3]) / 2)
}

// ---------- a luz e as formas do pano ----------

/** O tom da face do telhado virada para `angulo` (no sentido da tela), pela normal do cone: o mesmo de cima e na 3/4. */
function tomDoTelhado(angulo: number, inclinacao: number): number {
  const nl = Math.sin(inclinacao) * (LUZ_X * Math.cos(angulo) + LUZ_Y * Math.sin(angulo)) + LUZ_Z * Math.cos(inclinacao)
  return 1 + LADO_DO_CONE * (nl - LUZ_Z)
}

function tomDaParede(angulo: number): number {
  return TOM_DA_PAREDE - LADO_DA_PAREDE * Math.cos(angulo)
}

/** A textura do pano com a luz do lado: a sanefa é uma peça só que dá a volta na frente, clara à esquerda e escura à direita. */
function panoComLado(m: Medidas): Textura {
  const pano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (pano !== null) pano(u, v, x, y, p, s, escala)
    const f = TOM_DA_PAREDE - LADO_DA_PAREDE * (x / m.ex)
    s[0] *= f
    s[1] *= f
    s[2] *= f
  }
}

/** O miolo da estrela de cinco pontas, em fração do raio. */
const MIOLO_DA_ESTRELA = 0.45

/** A estrela de cinco pontas, de pé, achatada em x por `largura` (o bordado na parede que foge de lado). */
function estrela(cx: number, cy: number, r: number, largura = 1): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const raio = i % 2 === 0 ? r : r * MIOLO_DA_ESTRELA
    pontos.push([cx + Math.cos(a) * raio * largura, cy + Math.sin(a) * raio])
  }
  return poligono(pontos)
}

/** A lua crescente: o disco menos outro, deslocado para cima à direita. */
function lua(cx: number, cy: number, r: number, largura = 1): Forma {
  return menos(elipse(cx, cy, r * largura, r), elipse(cx + r * 0.5 * largura, cy - r * 0.22, r * 0.82 * largura, r * 0.82))
}

/** O bordado do gomo `i`: estrela e lua alternadas (a parede começa pela outra, para não repetir a do telhado logo acima). */
function bordado(i: number, cx: number, cy: number, k: number, largura = 1): Forma {
  return i % 2 === 0 ? estrela(cx, cy, 3.3 * k, largura) : lua(cx, cy, 2.9 * k, largura)
}

const OPCOES_DO_PANO: OpcoesDaVista = { tabua: 0, bisel: 1.3, contorno: 0.24, ruga: 0.35 }
const OPCOES_DO_BORDADO: OpcoesDaVista = { tabua: 0, bisel: 0.45, contorno: 0.16 }
const OPCOES_DA_CORDA: OpcoesDaVista = { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.9 }

/** A estaca do canto (ix, iy) no chão e o ponto do beiral de onde sai a corda dela (no chão, debaixo do beiral). */
function estacaNoChao(m: Medidas, ix: number, iy: number): Ponto {
  return [ix * ESTACA * m.sx, iy * ESTACA * m.sy]
}

function beiralNoCanto(m: Medidas, ix: number, iy: number): Ponto {
  return [ix * m.ex * Math.SQRT1_2, iy * m.ey * Math.SQRT1_2]
}

/**
 * O tapete que sai pela porta, no chão (o mesmo de cima e na 3/4 sem giro):
 * o pano vinho, as duas faixas de ocre, o losango do meio e a franja na ponta.
 */
function tapeteDeFora(por: Por, m: Medidas): void {
  const k = m.k
  const meia = MEIA_LARGURA_DO_TAPETE * k
  const y0 = m.ry - 1
  const y1 = TAPETE_ATE * m.sy
  por(caixa(-meia, y0, meia, y1, 0.6), TAPETE, { tabua: 0, bisel: 0.7, contorno: 0.2, eixo: QUARTO, semente: 700 })
  for (const s of [-1, 1]) por(caixa(s * meia * 0.8 - 0.45 * k, y0, s * meia * 0.8 + 0.45 * k, y1 - 0.8 * k), OCRE, { tabua: 0, bisel: 0.3, contorno: 0.1, tom: 0.85 })
  const cy = y1 - 2.8 * k
  por(poligono([[0, cy - 1.7 * k], [2.4 * k, cy], [0, cy + 1.7 * k], [-2.4 * k, cy]]), OCRE, { ...OPCOES_DO_BORDADO, tom: 0.92 })
  for (let j = -2; j <= 2; j += 1) {
    const x = j * meia * 0.38
    por(capsula(x, y1 - 0.2, x, y1 + 1.4 * k, 0.42 * k), CORDA, { tabua: 0, bisel: 0.3, contorno: 0.15 })
  }
}

// ---------- de cima ----------

function deCima(c: ContextoDoMovel, cena: Cena, m: Medidas): void {
  const P = c.peca
  const k = m.k
  const inicio = Math.PI / 2 - ANGULO_DO_GOMO / 2
  const noBeiral = (a: number, f = 1): Ponto => [m.ex * f * Math.cos(a), m.ey * f * Math.sin(a)]

  // As cordas e as estacas dos cantos, cada canto um grupo (a caixa de pintura fica pequena).
  for (const [ix, iy] of CANTOS) {
    const [px, py] = estacaNoChao(m, ix, iy)
    const [bx, by] = beiralNoCanto(m, ix, iy)
    const por = grupoDeCima(P, cena, (px + bx) / 2, (py + by) / 2)
    por(elipse(px, py, 1.5 * k, 1.5 * k), c.m.madeira, { bisel: 0.8, tabua: 0, contorno: 0.32, tom: 0.92, semente: 60 + ix + 2 * iy })
    por(capsula(bx, by, px, py, RAIO_DA_CORDA * k), CORDA, OPCOES_DA_CORDA)
  }

  // O tapete por baixo do beiral (o telhado o cobre até a beira).
  tapeteDeFora(grupoDeCima(P, cena, 0, (m.ry + TAPETE_ATE * m.sy) / 2), m)

  // O telhado: os gomos em leque, claros do lado da luz, e o galão de ocre no beiral.
  const telhado = grupoDeCima(P, cena, 0, 0)
  for (let i = 0; i < GOMOS; i += 1) {
    const a0 = inicio + i * ANGULO_DO_GOMO
    const meio = a0 + ANGULO_DO_GOMO / 2
    telhado(poligono([[0, 0], noBeiral(a0), noBeiral(meio), noBeiral(a0 + ANGULO_DO_GOMO)]), i % 2 === 0 ? ROXO : ANIL, {
      ...OPCOES_DO_PANO,
      eixo: meio,
      tom: tomDoTelhado(meio, m.inclinacao),
      semente: 300 + i,
    })
  }
  telhado(menos(elipse(0, 0, m.ex + 0.3, m.ey + 0.3), elipse(0, 0, m.ex - 0.9 * k, m.ey - 0.9 * k)), OCRE, { ...OPCOES_DO_BORDADO, tom: 0.9 })

  // O bordado no meio de cada gomo, menos no da porta.
  for (let i = 1; i < GOMOS; i += 1) {
    const meio = inicio + (i + 0.5) * ANGULO_DO_GOMO
    const [x, y] = noBeiral(meio, 0.6)
    grupoDeCima(P, cena, x, y)(bordado(i, x, y, k), OCRE, { ...OPCOES_DO_BORDADO, tom: tomDoTelhado(meio, m.inclinacao) })
  }

  // A porta: o recorte escuro no gomo do sul, o tapete que entra por ele e as abas dobradas, com o forro para cima.
  const dw = LARGURA_DA_PORTA * m.ex
  const ponta = m.ey * PONTA_DE_CIMA
  const vao = poligono([[-dw, m.ey + 0.4], [-dw * 0.7, m.ey - 6 * k], [0, ponta], [dw * 0.7, m.ey - 6 * k], [dw, m.ey + 0.4]])
  const porta = grupoDeCima(P, cena, 0, (ponta + m.ey) / 2)
  porta(vao, DENTRO, { tabua: 0, bisel: 0, contorno: 0.32, recesso: { k: 1.4, forca: 0.35 } })
  porta(dentroDe(caixa(-MEIA_LARGURA_DO_TAPETE * k, ponta + 2 * k, MEIA_LARGURA_DO_TAPETE * k, m.ey + 1), vao), TAPETE, { tabua: 0, bisel: 0.4, contorno: 0.12, eixo: QUARTO, tom: TOM_DE_DENTRO })
  for (const s of [-1, 1]) {
    porta(poligono([[s * dw * 0.98, m.ey + 0.2], [s * (dw + 4.6 * k), m.ey - 2.4 * k], [s * (dw * 0.62 + 1 * k), m.ey - 9 * k]]), FORRO, { ...OPCOES_DO_PANO, tom: s < 0 ? 1 : 0.84 })
    porta(elipse(s * (dw + 2.8 * k), m.ey - 2.6 * k, 1.1 * k, 1.1 * k), OCRE, { ...OPCOES_DO_BORDADO, tom: 0.95 })
  }

  // O alto do mastro: a sombra da flâmula no pano, a flâmula (de pé, vista de cima é uma fita), o colar e a bola de latão.
  const alto = grupoDeCima(P, cena, 0, 0)
  const flamula = (dx: number, dy: number): Forma => poligono([[1.6 * k + dx, -0.9 * k + dy], [9 * k + dx, -0.4 * k + dy], [16 * k + dx, 0.5 * k + dy], [9 * k + dx, 1 * k + dy], [1.6 * k + dx, 0.9 * k + dy]])
  alto(flamula(2.4 * k, 2 * k), DENTRO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.35 })
  alto(flamula(0, 0), FLAMULA, { tabua: 0, bisel: 0.6, contorno: 0.25, eixo: 0 })
  alto(elipse(0, 0, 3.2 * k, 3.2 * k), LATAO, { bisel: 1, contorno: 0.28, tom: 0.85 })
  alto(elipse(-0.3 * k, -0.3 * k, 2 * k, 2 * k), LATAO, { bisel: 1.2, contorno: 0.28, metal: 0.6 })
}

// ---------- na 3/4, de frente ----------

/** A estaca do canto, de pé, e a corda do beiral até a cabeça dela. */
function estacaEmPe(tela: Tela, m: Medidas, mad: MaterialDaPeca, ix: number, iy: number, base: number): void {
  const k = m.k
  const [px, py] = estacaNoChao(m, ix, iy)
  const [bx, by] = beiralNoCanto(m, ix, iy)
  const cabeca = py - ALTURA_DA_ESTACA * k
  const estaca = capsula(px, py, px, cabeca, RAIO_DA_ESTACA * k)
  const corda = capsula(bx, by - m.parede, px, cabeca + 0.8 * k, RAIO_DA_CORDA * k)
  const por = grupoJusto(tela, base, uniao(estaca, corda).b)
  por(estaca, mad, { eixo: QUARTO, tabua: 0, bisel: 0.6, contorno: 0.3, tom: 0.88, semente: 80 + ix + 2 * iy })
  por(corda, CORDA, OPCOES_DA_CORDA)
}

/** De lado, a porta foge para a beira da tela: só o tapete aparece, saindo para o lado no chão. */
function tapeteDeLado(tela: Tela, m: Medidas, lado: number): void {
  const k = m.k
  const meia = MEIA_LARGURA_DO_TAPETE * k
  const x0 = lado * (m.rx - 2)
  const x1 = lado * TAPETE_ATE * m.sx
  const por = tela.grupo((x0 + x1) / 2, 0.5, -0.5)
  por(caixa(Math.min(x0, x1), -meia, Math.max(x0, x1), meia, 0.6), TAPETE, { tabua: 0, bisel: 0.7, contorno: 0.2, semente: 700 })
  for (const s of [-1, 1]) por(caixa(Math.min(x0, x1), s * meia * 0.8 - 0.45 * k, Math.max(x0, x1), s * meia * 0.8 + 0.45 * k), OCRE, { tabua: 0, bisel: 0.3, contorno: 0.1, tom: 0.85 })
}

/** A parede: os panos de frente, cada um uma face lisa (a tenda tem quinas de costura), com o bordado no meio. */
function tambor(tela: Tela, m: Medidas, base: number, inicio: number, comPorta: boolean): void {
  const pe = (a: number): Ponto => [m.rx * Math.cos(a), m.ry * Math.sin(a)]
  const alto = (a: number): Ponto => [m.rx * Math.cos(a), m.ry * Math.sin(a) - m.parede]
  for (let i = 0; i < GOMOS; i += 1) {
    const a0 = inicio + i * ANGULO_DO_GOMO
    const meio = a0 + ANGULO_DO_GOMO / 2
    const a1 = a0 + ANGULO_DO_GOMO
    // O pano de trás fica debaixo do telhado.
    if (Math.sin(meio) < -BORDADO_DA_PAREDE) continue
    const forma = poligono([pe(a0), pe(meio), pe(a1), alto(a1), alto(meio), alto(a0)])
    const por = grupoJusto(tela, base, forma.b)
    por(forma, i % 2 === 0 ? ROXO : ANIL, { ...OPCOES_DO_PANO, eixo: QUARTO, tom: tomDaParede(meio), semente: 400 + i })
    if (Math.sin(meio) > BORDADO_DA_PAREDE && !(comPorta && i === 0)) {
      const [x, y] = pe(meio)
      por(bordado(i + 1, x, y - m.parede * 0.5, m.k, Math.sin(meio)), OCRE, { ...OPCOES_DO_BORDADO, tom: tomDaParede(meio) * 1.1 })
    }
  }
}

/** O telhado: os gomos que se veem, do fundo para a frente, cada um do cume ao beiral, com o bordado. */
function telhado(tela: Tela, m: Medidas, base: number, inicio: number, comPorta: boolean): void {
  const apice: Ponto = [0, -m.cume]
  const beiral = (a: number): Ponto => [m.ex * Math.cos(a), m.ey * Math.sin(a) - m.parede]
  const gomos = Array.from({ length: GOMOS }, (_, i) => ({ i, meio: inicio + (i + 0.5) * ANGULO_DO_GOMO }))
    .filter((g) => Math.sin(g.meio) > TELHADO_VISTO)
    .sort((a, b) => Math.sin(a.meio) - Math.sin(b.meio))
  for (const { i, meio } of gomos) {
    const a0 = meio - ANGULO_DO_GOMO / 2
    const forma = poligono([apice, beiral(a0), beiral(meio), beiral(a0 + ANGULO_DO_GOMO)])
    const por = grupoJusto(tela, base, forma.b)
    const [bx, by] = beiral(meio)
    const tom = tomDoTelhado(meio, m.inclinacao)
    por(forma, i % 2 === 0 ? ROXO : ANIL, { ...OPCOES_DO_PANO, eixo: Math.atan2(apice[1] - by, apice[0] - bx), tom, semente: 500 + i })
    if (Math.sin(meio) > BORDADO_DO_TELHADO && !(comPorta && i === 0)) {
      const x = bx + (apice[0] - bx) * ALTURA_DO_BORDADO
      const y = by + (apice[1] - by) * ALTURA_DO_BORDADO
      por(bordado(i, x, y, m.k, Math.max(0.5, Math.abs(Math.sin(meio)))), OCRE, { ...OPCOES_DO_BORDADO, tom })
    }
  }
}

/**
 * A sanefa: a faixa que pende do beiral na frente, com os bicos recortados e
 * uma borla de ocre na ponta de cada bico, o galão por cima e a sombra que ela
 * faz na parede. De lado a faixa fica de perfil: ali não vai bico nem borla
 * (sairiam como orelhas na beira da tenda).
 */
function sanefa(tela: Tela, m: Medidas, base: number): void {
  const k = m.k
  const faixa = FAIXA_DA_SANEFA * k
  const beiral = (a: number): Ponto => [m.ex * Math.cos(a), m.ey * Math.sin(a) - m.parede]
  const cima: Ponto[] = []
  const baixo: Ponto[] = []
  const sombra: Ponto[] = []
  for (let j = 0; j <= PASSOS_DA_SANEFA; j += 1) {
    const [x, y] = beiral((j / PASSOS_DA_SANEFA) * Math.PI)
    cima.push([x, y - 0.6 * k])
    baixo.push([x, y + faixa])
    sombra.push([x * (m.rx / m.ex), y + faixa + BICO_DA_SANEFA * k + SOMBRA_DA_SANEFA * k])
  }
  let forma: Forma = poligono([...cima, ...[...baixo].reverse()])
  const borlas: Ponto[] = []
  for (let j = 0; j < BICOS_DA_SANEFA; j += 1) {
    const a = ((j + 0.5) / BICOS_DA_SANEFA) * Math.PI
    if (Math.sin(a) < BICO_DE_FRENTE) continue
    const [x, y] = beiral(a)
    const meiaLargura = (Math.PI / BICOS_DA_SANEFA) * m.ex * Math.sin(a) * 0.5
    forma = uniao(forma, elipse(x, y + faixa, meiaLargura, BICO_DA_SANEFA * k))
    borlas.push([x, y + faixa + BICO_DA_SANEFA * k])
  }
  const por = grupoJusto(tela, base, uniao(forma, poligono([...cima, ...[...sombra].reverse()])).b)
  por(poligono([...baixo, ...[...sombra].reverse()]), DENTRO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.32 })
  por(forma, ROXO, { ...OPCOES_DO_PANO, tom: 1.06, textura: panoComLado(m), semente: 620 })
  por(cadeia(cima, 0.55 * k), OCRE, { ...OPCOES_DO_BORDADO, tom: 0.95 })
  for (const [x, y] of borlas) por(elipse(x, y + 0.3 * k, 0.95 * k, 1.2 * k), OCRE, { ...OPCOES_DO_BORDADO, tom: 0.92 })
}

/** A porta aberta (só sem giro): o vão, o tapete e a mesinha lá dentro e a cortina presa dos dois lados. */
function portaAberta(tela: Tela, m: Medidas, base: number): void {
  const k = m.k
  const dw = LARGURA_DA_PORTA * m.rx
  const noChao = (x: number): number => m.ry * Math.sqrt(Math.max(0, 1 - (x / m.rx) ** 2))
  const lado = noChao(dw)
  const ombro = lado - m.parede
  const ponta = ombro - PONTA_DA_PORTA * k
  const arco = (s: number): Ponto[] => [
    [s * dw, ombro],
    [s * dw * 0.86, ombro - 0.3 * PONTA_DA_PORTA * k],
    [s * dw * 0.52, ombro - 0.62 * PONTA_DA_PORTA * k],
  ]
  const vao = poligono([[-dw, lado], [0, m.ry], [dw, lado], ...arco(1), [0, ponta], ...arco(-1).reverse()])
  const amarra = lado - m.parede * ALTURA_DA_AMARRA
  // A beira de cada aba presa, da amarra até a ponta do arco; o que fica entre as duas beiras é o vão que ainda se vê.
  const beiraDe = (s: number): Ponto[] => [
    [s * (dw + 0.8 * k), amarra],
    [s * (dw - 3.4 * k), amarra - 5 * k],
    [s * dw * 0.4, ombro - 1 * k],
    [s * 2.2 * k, ombro - 0.6 * PONTA_DA_PORTA * k],
    [s * 0.6 * k, ponta + 2.5 * k],
  ]
  const aberto = dentroDe(vao, poligono([[-(dw + 0.8 * k), m.ry + 2], ...beiraDe(-1), ...beiraDe(1).reverse(), [dw + 0.8 * k, m.ry + 2]]))
  const por = grupoJusto(tela, base, [-dw - 6 * k, ponta, dw + 6 * k, m.ry + 1])

  // Lá dentro é sombra: o chão escuro, o tapete que entra e a ponta da mesinha coberta.
  por(vao, DENTRO, { tabua: 0, bisel: 0, contorno: 0.32, recesso: { k: 1.8, forca: 0.4 } })
  const meia = MEIA_LARGURA_DO_TAPETE * k
  por(dentroDe(caixa(-meia, m.ry - 26 * k, meia, m.ry + 2), vao), TAPETE, { tabua: 0, bisel: 0.4, contorno: 0.12, eixo: QUARTO, tom: TOM_DE_DENTRO, semente: 710 })
  for (const s of [-1, 1]) por(dentroDe(caixa(s * meia * 0.8 - 0.45 * k, m.ry - 26 * k, s * meia * 0.8 + 0.45 * k, m.ry + 2), vao), OCRE, { tabua: 0, bisel: 0.3, contorno: 0.1, tom: TOM_DE_DENTRO })
  const tx = MESINHA.x * dw
  const ty = m.ry - MESINHA.recuo * k
  const r = MESINHA.raio * k
  const tampo = ty - MESINHA.altura * k
  const barra = tampo + MESINHA.queda * k
  // A mesinha se recorta no vão aberto: a aba da direita esconde a outra metade, e o que aparece é só a ponta dela.
  for (const f of PERNAS_DA_MESINHA) {
    por(dentroDe(capsula(tx + f * r, barra, tx + f * r, ty + 0.3 * k, PERNA_DA_MESINHA * k), aberto), PERNA, { tabua: 0, bisel: 0.4, contorno: 0.3, tom: 0.9 })
  }
  por(dentroDe(uniao(caixa(tx - r, tampo, tx + r, barra), elipse(tx, barra, r, r)), aberto), TOALHA, { tabua: 0, bisel: 0.8, contorno: 0.28, eixo: QUARTO, tom: 0.92, semente: 740 })
  por(dentroDe(menos(elipse(tx, barra, r, r), elipse(tx, barra - 1.1 * k, r, r)), aberto), OCRE, { tabua: 0, bisel: 0.3, contorno: 0.14, tom: 0.8 })
  por(dentroDe(elipse(tx, tampo, r, r), aberto), TOALHA, { tabua: 0, bisel: 1, contorno: 0.28, tom: 1.05, semente: 741 })
  for (const [cx, cy, giro] of CARTAS) {
    const [ux, uy] = [Math.cos(giro), Math.sin(giro)]
    const canto = (a: number, b: number): Ponto => [tx + cx * r + (a * ux - b * uy) * k, tampo + cy * r + (a * uy + b * ux) * k]
    const carta = poligono([canto(-0.8, -1.2), canto(0.8, -1.2), canto(0.8, 1.2), canto(-0.8, 1.2)])
    por(dentroDe(carta, aberto), LENCOL, { tabua: 0, bisel: 0.3, contorno: 0.3, tom: TOM_DE_DENTRO * 1.2 })
  }

  // A cortina, de cada lado: a aba presa em arco (o pano de fora, com o forro de ocre na beira), as dobras que
  // saem da amarra, o pano que cai dela até o chão e a amarra com a borla. O vão fica em arco redondo entre as abas.
  for (const s of [-1, 1]) {
    const tomDeFora = tomDaParede(s < 0 ? Math.PI * 0.6 : Math.PI * 0.4)
    const beira = beiraDe(s)
    por(poligono([[s * (dw + 0.4 * k), amarra], [s * (dw + 3.6 * k), amarra + 1 * k], [s * (dw + 4.4 * k), noChao(dw + 4.4 * k) + 0.4], [s * (dw - 1.6 * k), lado + 0.6], [s * (dw - 0.2 * k), amarra + 2 * k]]), ROXO, { ...OPCOES_DO_PANO, eixo: QUARTO, tom: tomDeFora * 0.92, semente: 720 + s })
    por(capsula(s * (dw + 1.4 * k), amarra + 2 * k, s * (dw + 1.6 * k), lado - 1 * k, 0.35 * k), DENTRO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.35 })
    por(poligono([[s * 0.4 * k, ponta + 0.6 * k], ...arco(s).reverse(), [s * (dw + 0.6 * k), ombro + 4 * k], [s * (dw + 2.4 * k), amarra + 0.6 * k], ...beira]), ROXO, { ...OPCOES_DO_PANO, eixo: QUARTO, tom: tomDeFora, semente: 730 + s })
    for (const [fx, fy] of [[dw * 0.7, ombro - 0.45 * PONTA_DA_PORTA * k], [dw * 0.36, ombro - 0.72 * PONTA_DA_PORTA * k]] as const) {
      por(capsula(s * (dw + 0.6 * k), amarra - 1.5 * k, s * fx, fy, 0.38 * k), DENTRO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.35 })
    }
    por(cadeia(beira, 0.95 * k), FORRO, { ...OPCOES_DO_BORDADO, bisel: 0.6, tom: s < 0 ? 1 : 0.84 })
    por(elipse(s * (dw + 1.6 * k), amarra + 0.4 * k, 1.7 * k, 1.2 * k), OCRE, { ...OPCOES_DO_BORDADO, tom: 0.95 })
    por(capsula(s * (dw + 1.6 * k), amarra + 1.4 * k, s * (dw + 2 * k), amarra + 5 * k, 0.55 * k), OCRE, { ...OPCOES_DO_BORDADO, tom: 0.85 })
  }
}

/** O mastro acima do cume: a vara, o colar de latão onde os gomos se juntam, a flâmula e a bola da ponta. */
function mastro(tela: Tela, m: Medidas, base: number, mad: MaterialDaPeca): void {
  const k = m.k
  const topo = -m.cume - m.mastro
  const por = grupoJusto(tela, base, [-3.5 * k, topo - 4 * k, 16 * k, -m.cume + 3 * k])
  por(capsula(0, -m.cume + 2 * k, 0, topo, 1.05 * k), mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, contorno: 0.3, tom: 0.92, semente: 90 })
  por(poligono([[0.9 * k, topo + 0.4 * k], [7.5 * k, topo + 2 * k], [15 * k, topo + 3.4 * k], [8 * k, topo + 4.6 * k], [0.9 * k, topo + 6 * k]]), FLAMULA, { tabua: 0, bisel: 0.8, contorno: 0.25, tom: 0.92, semente: 92 })
  por(elipse(0, -m.cume + 0.6 * k, 3.2 * k, 1.7 * k), LATAO, { bisel: 1, contorno: 0.28, tom: 0.9 })
  por(elipse(0, topo - 1.4 * k, 2.2 * k, 2.2 * k), LATAO, { bisel: 1.2, contorno: 0.28, metal: 0.6 })
}

function deFrente(c: ContextoDoMovel, tela: Tela, m: Medidas, porta: Ponto): void {
  const mad = c.m.madeira
  const inicio = Math.atan2(porta[1], porta[0]) - ANGULO_DO_GOMO / 2
  const comPorta = porta[1] > 0
  // De trás para a frente da tela: as estacas do fundo, o tapete de lado, a tenda (a parede, o telhado, a sanefa,
  // a porta e o mastro), o tapete da frente e as estacas da frente, que passam por cima da parede.
  for (const [ix, iy] of CANTOS) if (iy < 0) estacaEmPe(tela, m, mad, ix, iy, -ESTACA * m.sy + 2)
  if (porta[0] !== 0) tapeteDeLado(tela, m, porta[0])
  const corpo = m.ry + 2
  tambor(tela, m, corpo, inicio, comPorta)
  telhado(tela, m, corpo, inicio, comPorta)
  sanefa(tela, m, corpo)
  if (comPorta) portaAberta(tela, m, corpo)
  mastro(tela, m, corpo, mad)
  const frente = m.sy + 2
  if (comPorta) tapeteDeFora(tela.grupo(0, frente, (m.ry + TAPETE_ATE * m.sy) / 2), m)
  for (const [ix, iy] of CANTOS) if (iy > 0) estacaEmPe(tela, m, mad, ix, iy, frente)
}

// ---------- a sombra no chão ----------

/** O casco convexo dos pontos (cadeia monótona), no sentido anti-horário. */
function casco(pontos: readonly Ponto[]): Ponto[] {
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cruz = (o: Ponto, a: Ponto, b: Ponto): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const metade = (lista: readonly Ponto[]): Ponto[] => {
    const h: Ponto[] = []
    for (const q of lista) {
      while (h.length >= 2 && cruz(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop()
      h.push(q)
    }
    return h
  }
  const baixo = metade(p)
  const cima = metade([...p].reverse())
  return [...baixo.slice(0, -1), ...cima.slice(0, -1)]
}

/**
 * A sombra, no chão da tela (caída para baixo à direita): o casco do pé, do
 * beiral e do cume deslocados pela altura, o contato do tambor e as cordas.
 * Girada, a sombra entra desgirada, e a volta da 3/4 a põe no lugar.
 */
function sombrasNoChao(cena: Cena, q: number, m: Medidas): void {
  const volta = (4 - q) % 4
  const noChao = (forma: Forma, forca: number, suave: number): void => {
    cena.sombras.push({ forma: girarForma(forma, volta), z: 0, forca, suave })
  }
  const pontos: Ponto[] = []
  for (let i = 0; i < AMOSTRAS_DA_SOMBRA; i += 1) {
    const a = (i / AMOSTRAS_DA_SOMBRA) * 2 * Math.PI
    pontos.push([m.rx * Math.cos(a), m.ry * Math.sin(a)])
    pontos.push([m.ex * Math.cos(a) + SOMBRA_X * m.parede, m.ey * Math.sin(a) + SOMBRA_Y * m.parede])
  }
  pontos.push([SOMBRA_X * (m.cume + m.mastro), SOMBRA_Y * (m.cume + m.mastro)])
  noChao(poligono(casco(pontos)), FORCA_DA_SOMBRA, SUAVE_DA_SOMBRA)
  cena.sombras.push(contato(girarForma(elipse(0, 0, m.rx + 0.6, m.ry + 0.6), volta), 0.34))
  for (const [ix, iy] of CANTOS) {
    const [px, py] = estacaNoChao(m, ix, iy)
    const [bx, by] = beiralNoCanto(m, ix, iy)
    noChao(capsula(px, py, bx + SOMBRA_X * m.parede, by + SOMBRA_Y * m.parede, RAIO_DA_CORDA * m.k), FORCA_DA_SOMBRA_DA_CORDA, 0.8)
    noChao(elipse(px + 0.6 * m.k, py + 0.5 * m.k, 1.6 * m.k, 1.2 * m.k), 0.3, 1)
  }
}

export const montarTendaDeAdivinha: MontarMovel = (c, cena) => {
  const q = quartosDoGiro(c.giro)
  const deLado = q % 2 === 1
  const m = medir(deLado ? c.hh : c.hw, deLado ? c.hw : c.hh)
  cena.corDoPiso = ESCURO_DO_PANO
  sombrasNoChao(cena, q, m)
  // Girada, a cena só serve à 3/4: as peças de cima não entram.
  if (q === 0) deCima(c, cena, m)
  deFrente(c, novaTela(c.peca, cena, q), m, girarPonto(0, 1, q))
}
