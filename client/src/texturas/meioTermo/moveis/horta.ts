/**
 * HORTA de cima com volume (lote 7 dos objetos novos, 11/11/2026): o canteiro
 * de horta de quintal. A TERRA ESCURA revolvida em LEIRAS (o lombo de cada
 * fileira, com a encosta de cima na luz e o sulco escuro entre uma e outra),
 * cercada por TÁBUAS BAIXAS presas em quatro estacas de canto. Em cada leira,
 * uma cultura: os REPOLHOS (a cabeça clara no meio das folhas de fora), as
 * CENOURAS (só a rama, com um nada do ombro laranja na terra), as ALFACES (a
 * roseta crespa, verde-clara) e a leira recém-plantada, com as mudas e a pá
 * de mão largada. No fim da leira dos repolhos, o PÉ DE TOMATE amarrado na
 * estaca, com os tomates. Ao lado do canteiro, no chão, o REGADOR de zinco.
 *
 * As leiras, os pés e as estacas têm medida própria: a horta esticada ganha
 * mais leiras e mais pés por leira, nunca um repolho esticado.
 *
 * É baixa, quase rente ao chão. Na 3/4 (`tresQuartos.ts`; o perfil tem de ser
 * `{ modo: 'derivado', espessura: 0 }`): as tábuas, as estacas de canto, a
 * estaca do tomateiro e o corpo do regador são colunas (sobem pela sombra, com
 * a frente varrida); a cabeça de cada repolho, a rama de cada cenoura, os três
 * andares do tomateiro e o bico do regador sobem cada um preso a um PINO (um
 * tampo solto minúsculo, sem sombra, escondido debaixo da peça). A 3/4 lê o
 * meio da caixa de cada peça para saber com quem ela sobe, então essas peças
 * levam a caixa centrada no pino (`comMeioEm`), e as que ficam no chão no
 * mesmo lugar (o ombro da cenoura), a caixa crescida para o lado
 * (`foraDoPino`). A terra, as alfaces, as mudas e a pá ficam no chão.
 *
 * A sombra do motor fica por baixo de todas as peças: em cima da terra ela
 * não aparece. Por isso a sombra comprida da estaca do tomateiro e a da
 * folhagem são PINTADAS na terra (peças escuras meio transparentes), e as
 * tábuas escurecem a terra pelo `recesso` dela.
 *
 * Lê `c.giro` (o quarto de volta que a 3/4 pinta, e que só chega nela): o que
 * depende da luz ou de quem olha fica no lugar NA TELA com a horta girada (a
 * encosta clara das leiras, as sombras pintadas, o ombro da cenoura à frente
 * da rama e os pinos do tomateiro à frente da estaca).
 *
 * Material: `madeira` (as tábuas e as estacas). A terra, as plantas, o zinco
 * do regador e a pá são fixos.
 */
import { hash, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, capsula, dentroDe, elipseGirada, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type CriarPeca, type MaterialDaPeca, type Peca, type Sombra, type Textura } from './motor'
import type { MontarMovel } from './contexto'

const VOLTA = Math.PI * 2

// ---------- formas e caixas ----------

/** Círculo com a distância exata (a horta tem mais de cem, e a conta da elipse custa mais). */
function circulo(cx: number, cy: number, r: number): Forma {
  return {
    b: [cx - r, cy - r, cx + r, cy + r],
    d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r,
  }
}

/** A mesma forma com outra caixa de pintura (tem de conter a forma inteira). */
function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/**
 * A forma com a caixa crescida até o meio dela cair em (cx, cy). A 3/4 lê o
 * meio da caixa para saber com que estrutura a peça sobe: assim a folha da
 * ponta sobe com o pino do pé dela.
 */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - f.b[0], f.b[2] - cx)
  const my = Math.max(cy - f.b[1], f.b[3] - cy)
  return naCaixa(f, [cx - mx, cy - my, cx + mx, cy + my])
}

/** O raio do pino (px do protótipo): cabe debaixo da menor folha. */
const RAIO_DO_PINO = 0.5
/**
 * Quanto a caixa da peça que fica no chão cresce para um lado: o meio dela sai
 * de cima do pino (anda metade disto), em qualquer giro, e não chega ao pino do
 * pé vizinho nem à tábua.
 */
const FOLGA_DO_PINO = 6

/** A peça que NÃO sobe com o pino que está no meio dela: a caixa cresce para a esquerda. */
function foraDoPino(f: Forma): Forma {
  return naCaixa(f, [f.b[0] - FOLGA_DO_PINO, f.b[1], f.b[2], f.b[3]])
}

/** O pino: só diz à 3/4 a altura de quem tem o meio da caixa nele. Sem sombra no chão. */
function pino(x: number, y: number, z: number): Sombra {
  return { forma: circulo(x, y, RAIO_DO_PINO), z, solta: true, forca: 0, suave: 0.1 }
}

/** O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`c.giro`), como no biombo. */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** O que cada parte da horta precisa para pôr peças na cena. */
interface Obra {
  readonly L: Peca[]
  readonly sombras: Sombra[]
  readonly P: CriarPeca
  readonly g: number
  readonly giro: number
}

/** A sombra pintada em cima da terra (o motor só põe sombra no chão, por baixo das peças). */
const COR_DA_SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [14, 11, 8] }

// ---------- a terra e as tábuas ----------

/** A faixa do regador, à direita do canteiro, e a folga em volta do canteiro, em casas. */
const FAIXA_DO_REGADOR = 0.3
const FOLGA_DA_PEGADA = 0.01
/** As tábuas (a espessura e a altura) e as estacas de canto (o lado e a altura), em casas. */
const TABUA = { espessura: 0.058, altura: 0.13 } as const
const ESTACA_DE_CANTO = { lado: 0.086, altura: 0.19 } as const
/** Uma leira a cada tanto, em casas, e o mínimo de leiras. */
const PASSO_DAS_LEIRAS = 0.34
const LEIRAS_MINIMAS = 2

/** A terra revolvida: a lenha do Meio-Termo, escura mas acima do piso de luz no fundo do sulco. */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('lenha', 0.9)) }
/** A luz da encosta da leira e o escuro do sulco. */
const LUZ_DA_LEIRA = 0.14
const ESCURO_DO_SULCO = 0.17
/** O quanto a linha da leira entorta (px do protótipo): leira aberta na enxada, não na régua. */
const TORTO_DA_LEIRA = 2

/** De onde vem a luz do motor, no chão (cima à esquerda, na tela): a encosta da leira virada para lá clareia. */
const LUZ_NO_CHAO = { x: -0.62, y: -0.48 } as const

/**
 * A terra em leiras ao comprido: o lombo de cada uma com a encosta virada
 * para a luz clara e a outra na sombra, o sulco escuro entre duas, os torrões
 * e uns grãos soltos. Com a horta girada na 3/4 (`giro`), a encosta clara é a
 * que olha para a luz NA TELA.
 */
function texDaTerraEmLeiras(alto: number, leira: number, giro: number): Textura {
  // Quanto da luz vem do lado de cima da leira, no desenho: 1 sem giro, -1 com meia volta.
  const deCima = desgirado(LUZ_NO_CHAO.x, LUZ_NO_CHAO.y, giro)[1] / LUZ_NO_CHAO.y
  return (_u, _v, x, y, _p, s) => {
    const noLombo = (y + ruido(x * 0.045 + 17, y * 0.02 + 3) * TORTO_DA_LEIRA - alto) / leira
    const volta = (noLombo - Math.floor(noLombo) - 0.5) * VOLTA
    const sulco = (1 - Math.cos(volta)) / 2
    let luz = -Math.sin(volta) * LUZ_DA_LEIRA * deCima - ESCURO_DO_SULCO * sulco * sulco * sulco * sulco
    luz += ruido(x * 0.26 + 41, y * 0.4 + 7) * 0.15 + ruido(x * 0.8 + 5, y * 0.8 + 13) * 0.07
    const grao = hash(Math.floor(x * 0.9), Math.floor(y * 0.9), 57)
    if (grao > 0.94) luz -= 0.09
    else if (grao < 0.05) luz += 0.08
    s[3] += luz
  }
}

/** Topo de madeira cortada: anéis em volta do meio (a estaca de canto e a do tomateiro). */
function texDoTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const longe = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.2
    s[3] += Math.sin(longe * 4.2) * 0.04 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.05
  }
}

interface Retangulo {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** As quatro tábuas, deitadas de canto, e as quatro estacas que as seguram: cada uma é uma coluna baixa. */
function cercar(o: Obra, madeira: MaterialDaPeca, { x0, y0, x1, y1 }: Retangulo): void {
  const { L, P, sombras, g } = o
  const lado = g * ESTACA_DE_CANTO.lado
  const grossa = g * TABUA.espessura
  const recuo = (lado - grossa) / 2
  // A tábua entra um pouco na estaca: a emenda fica debaixo dela.
  const entra = lado - 0.4
  const tabuas: readonly (readonly [Forma, number])[] = [
    [caixa(x0 + entra, y0 + recuo, x1 - entra, y0 + recuo + grossa, 0.4), 0],
    [caixa(x0 + entra, y1 - recuo - grossa, x1 - entra, y1 - recuo, 0.4), 0],
    [caixa(x0 + recuo, y0 + entra, x0 + recuo + grossa, y1 - entra, 0.4), Math.PI / 2],
    [caixa(x1 - recuo - grossa, y0 + entra, x1 - recuo, y1 - entra, 0.4), Math.PI / 2],
  ]
  for (const [i, [tabua, eixo]] of tabuas.entries()) {
    sombras.push({ forma: tabua, z: g * TABUA.altura }, contato(tabua, 0.26))
    L.push(P(tabua, madeira, { eixo, tabua: 0, bisel: 0.9, contorno: 0.26, semente: 7510 + i }))
  }
  for (const [i, [ex, ey]] of ([[x0, y0], [x1 - lado, y0], [x0, y1 - lado], [x1 - lado, y1 - lado]] as const).entries()) {
    const estaca = caixa(ex, ey, ex + lado, ey + lado, 0.7)
    sombras.push({ forma: estaca, z: g * ESTACA_DE_CANTO.altura }, contato(estaca, 0.28))
    L.push(P(estaca, madeira, { tabua: 0, bisel: 0.9, contorno: 0.3, tom: 0.9, textura: texDoTopo(ex + lado / 2, ey + lado / 2), semente: 7520 + i }))
  }
}

// ---------- as plantas ----------

/** Folha: luz manchada, sem listra. */
const texDeFolha: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.5 + p.su, y * 0.5 + p.sv) * 0.1 + ruido(x * 1.3 + 7, y * 1.3) * 0.04
}

/** A meia largura da nervura do meio da folha do repolho (px do protótipo) e a luz dela. */
const NERVURA = { meia: 0.45, luz: 0.1 } as const

/** Folha de repolho: a nervura clara do pé para a ponta (o pé da planta está em (cx, cy), a folha aponta para `a`). */
function texDaFolhaDeRepolho(cx: number, cy: number, a: number): Textura {
  const co = Math.cos(a)
  const si = Math.sin(a)
  return (_u, _v, x, y, p, s) => {
    const atraves = Math.abs(-(x - cx) * si + (y - cy) * co)
    s[3] += ruido(x * 0.5 + p.su, y * 0.5 + p.sv) * 0.08 + (atraves < NERVURA.meia ? NERVURA.luz * (1 - atraves / NERVURA.meia) : 0)
  }
}

/** O repolho: o verde azulado das folhas de fora e o claro da cabeça (saturação HSV até 0,3). */
const FOLHA_DO_REPOLHO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#628a6c') }
const CABECA_DO_REPOLHO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#a6c295') }
/** O raio (com as folhas de fora) e quanto a cabeça sobe na 3/4, em casas; um pé a cada tanto. */
const REPOLHO = { raio: 0.118, altura: 0.09, passo: 0.3 } as const
const FOLHAS_DO_REPOLHO = 6
const TONS_DAS_FOLHAS: readonly number[] = [0.95, 1.04, 0.9, 1, 0.93, 1.06]
/** A sombra de uma folha (ou da cabeça) na terra e nas folhas de baixo. */
const SOMBRA_DA_FOLHA = { dist: 1.2, forca: 0.24, suave: 0.9 } as const

function plantarRepolho(o: Obra, x: number, y: number, sem: number): void {
  const { L, P, sombras, g } = o
  const R = g * REPOLHO.raio
  const fase = hash(sem, 1, 61) * VOLTA
  for (let k = 0; k < FOLHAS_DO_REPOLHO; k += 1) {
    const a = fase + (k / FOLHAS_DO_REPOLHO) * VOLTA
    const folha = elipseGirada(x + Math.cos(a) * R * 0.52, y + Math.sin(a) * R * 0.52, R * 0.5, R * 0.6, a)
    L.push(P(folha, FOLHA_DO_REPOLHO, { bisel: 1.1, contorno: 0.24, tom: TONS_DAS_FOLHAS[k % TONS_DAS_FOLHAS.length], textura: texDaFolhaDeRepolho(x, y, a), semente: sem + k, projeta: SOMBRA_DA_FOLHA }))
  }
  // A cabeça: a bola e duas folhas enroladas por cima, cada uma mais clara. Sobe com o pino.
  sombras.push(pino(x, y, g * REPOLHO.altura))
  L.push(P(comMeioEm(circulo(x, y, R * 0.62), x, y), CABECA_DO_REPOLHO, { bisel: R * 0.5, contorno: 0.24, textura: texDeFolha, semente: sem + 10, projeta: SOMBRA_DA_FOLHA }))
  L.push(P(comMeioEm(circulo(x - R * 0.1, y - R * 0.08, R * 0.43), x, y), CABECA_DO_REPOLHO, { bisel: 1.3, contorno: 0.2, tom: 1.05, textura: texDeFolha, semente: sem + 11 }))
  L.push(P(comMeioEm(circulo(x + R * 0.07, y + R * 0.05, R * 0.24), x, y), CABECA_DO_REPOLHO, { bisel: 0.9, contorno: 0.2, tom: 1.1, semente: sem + 12 }))
}

/** A alface: verde-claro, mais clara para o miolo. */
const ALFACE: MaterialDaPeca = { classe: 'liso', rgb: rgb('#8fb262') }
const ALFACE_RAIO = 0.1
const PASSO_DA_ALFACE = 0.25
/** As duas rodas de folhas: quantas, a distância do meio, os dois raios (fração do raio do pé) e o tom. */
const RODAS_DA_ALFACE: readonly { readonly folhas: number; readonly longe: number; readonly comprida: number; readonly larga: number; readonly tom: number }[] = [
  { folhas: 8, longe: 0.56, comprida: 0.44, larga: 0.4, tom: 0.94 },
  { folhas: 5, longe: 0.27, comprida: 0.36, larga: 0.3, tom: 1.1 },
]

function plantarAlface(o: Obra, x: number, y: number, sem: number): void {
  const { L, P, g } = o
  const R = g * ALFACE_RAIO
  for (const [j, roda] of RODAS_DA_ALFACE.entries()) {
    const fase = hash(sem, j, 62) * VOLTA
    for (let k = 0; k < roda.folhas; k += 1) {
      const a = fase + (k / roda.folhas) * VOLTA
      const folha = elipseGirada(x + Math.cos(a) * R * roda.longe, y + Math.sin(a) * R * roda.longe, R * roda.comprida, R * roda.larga, a)
      L.push(P(folha, ALFACE, { bisel: 1, contorno: 0.22, tom: roda.tom + (k % 2 ? 0.07 : 0), textura: texDeFolha, semente: sem + j * 10 + k, projeta: j === 0 ? SOMBRA_DA_FOLHA : undefined }))
    }
  }
  L.push(P(circulo(x, y, R * 0.2), ALFACE, { bisel: 0.6, contorno: 0.14, tom: 1.24, semente: sem + 30 }))
}

/** A cenoura: a rama (verde vivo, contido) e o ombro, no laranja da jardineira. */
const RAMA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#5c8a4c') }
const OMBRO_DA_CENOURA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#c98a5e') }
/** O raio da rama e quanto ela sobe na 3/4, em casas; um pé a cada tanto. */
const CENOURA = { raio: 0.072, altura: 0.08, passo: 0.16 } as const
const FOLHAS_DA_RAMA = 9
const TONS_DA_RAMA: readonly number[] = [0.9, 1.06, 0.98, 1.14]
/** O ombro (px do protótipo): o raio e quanto fica à frente do pé (de cima, só a beira dele aparece debaixo da rama). */
const OMBRO = { raio: 1.05, desce: 0.9 } as const
/** A sombra da rama, pintada na terra (fração do raio da rama). */
const SOMBRA_DA_RAMA = { dx: 0.3, dy: 0.25, raio: 0.8, alfa: 0.22, suave: 1 } as const

function plantarCenoura(o: Obra, x: number, y: number, sem: number): void {
  const { L, P, sombras, g, giro } = o
  const R = g * CENOURA.raio
  const s = SOMBRA_DA_RAMA
  // A sombra cai para baixo à direita e o ombro fica à frente do pé NA TELA, com a horta girada ou não.
  const [sx, sy] = desgirado(R * s.dx, R * s.dy, giro)
  const [ox, oy] = desgirado(0, OMBRO.desce, giro)
  L.push(P(foraDoPino(circulo(x + sx, y + sy, R * s.raio)), COR_DA_SOMBRA, { bisel: 0, contorno: 0, alfa: s.alfa, suave: s.suave }))
  L.push(P(foraDoPino(circulo(x + ox, y + oy, OMBRO.raio)), OMBRO_DA_CENOURA, { bisel: 0.8, contorno: 0.24, semente: sem + 20 }))
  sombras.push(pino(x, y, g * CENOURA.altura))
  const fase = hash(sem, 2, 63) * VOLTA
  for (let k = 0; k < FOLHAS_DA_RAMA; k += 1) {
    // De quatro em quatro: as folhas vizinhas não ficam uma em cima da outra na ordem da roda.
    const i = (k * 4) % FOLHAS_DA_RAMA
    const a = fase + (i / FOLHAS_DA_RAMA) * VOLTA + (hash(i, sem, 64) - 0.5) * 0.35
    const meia = (R * (0.8 + 0.4 * hash(i, sem, 65))) / 2
    const folha = elipseGirada(x + Math.cos(a) * meia, y + Math.sin(a) * meia, meia, R * 0.2, a)
    L.push(P(comMeioEm(folha, x, y), RAMA, { bisel: 0.4, contorno: 0.18, tom: TONS_DA_RAMA[k % TONS_DA_RAMA.length], semente: sem + k }))
  }
}

/** A muda: duas folhinhas abertas, verde-claro, uma a cada tanto (casas). */
const MUDA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#9cc070') }
const PASSO_DAS_MUDAS = 0.2
const FOLHA_DA_MUDA = { longe: 1.3, comprida: 1.6, larga: 0.9, abre: 0.55 } as const

function plantarMuda(o: Obra, x: number, y: number, sem: number): void {
  const { L, P } = o
  const f = FOLHA_DA_MUDA
  const torta = (hash(sem, 3, 66) - 0.5) * 1.2
  for (const lado of [-1, 1]) {
    const a = torta + (lado > 0 ? f.abre : Math.PI - f.abre)
    const folha = elipseGirada(x + Math.cos(a) * f.longe, y + Math.sin(a) * f.longe, f.comprida, f.larga, a)
    L.push(P(folha, MUDA, { bisel: 0.5, contorno: 0.2, tom: lado > 0 ? 1 : 0.92, semente: sem + lado, projeta: { dist: 0.6, forca: 0.2, suave: 0.6 } }))
  }
}

// ---------- o pé de tomate ----------

/** O tomateiro: a folha, o tomate maduro (vermelho contido, saturação HSV 0,57) e o verde. */
const FOLHA_DO_TOMATEIRO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#5a8556') }
const TOMATE: MaterialDaPeca = { classe: 'liso', rgb: rgb('#bd6352') }
const TOMATE_VERDE: MaterialDaPeca = { classe: 'liso', rgb: rgb('#a8b56a') }
/** A estaca (o raio e a altura) e o raio do tomate, em casas. */
const ESTACA_DO_TOMATEIRO = { raio: 0.021, altura: 0.84 } as const
const RAIO_DO_TOMATE = 0.029
/** Os três andares de folhas, de baixo para cima: a altura e o raio (casas), as folhas, os tomates e o lugar do pino (px do protótipo, na tela). */
const ANDARES_DO_TOMATEIRO: readonly { readonly altura: number; readonly raio: number; readonly folhas: number; readonly tomates: number; readonly pinoX: number }[] = [
  { altura: 0.2, raio: 0.14, folhas: 7, tomates: 3, pinoX: -1.9 },
  { altura: 0.42, raio: 0.115, folhas: 6, tomates: 2, pinoX: 1.9 },
  { altura: 0.63, raio: 0.085, folhas: 5, tomates: 1, pinoX: 0 },
]
/**
 * Os pinos dos três andares ficam na mesma linha, logo à frente da estaca (px
 * do protótipo, na tela): a 3/4 pinta as estruturas do norte para o sul e,
 * na mesma linha, a mais baixa antes; assim cada andar cobre o de baixo.
 */
const PINO_A_FRENTE = 1.9
/** A sombra da folhagem, pintada na terra (fração do raio do andar de baixo), e a da estaca (o raio em px do protótipo). */
const SOMBRA_DO_TOMATEIRO = { dx: 0.36, dy: 0.28, raio: 0.95, alfa: 0.2, suave: 2 } as const
const SOMBRA_DA_ESTACA = { raio: 0.8, alfa: 0.24, suave: 1.3 } as const

function plantarTomateiro(o: Obra, madeira: MaterialDaPeca, x: number, y: number, sem: number): void {
  const { L, P, sombras, g, giro } = o
  const zEstaca = g * ESTACA_DO_TOMATEIRO.altura
  const rEstaca = g * ESTACA_DO_TOMATEIRO.raio
  const estaca = circulo(x, y, rEstaca)
  sombras.push({ forma: estaca, z: zEstaca, suave: 1.5, forca: 0.2 })
  const baixo = g * ANDARES_DO_TOMATEIRO[0].raio
  const s = SOMBRA_DO_TOMATEIRO
  const [sx, sy] = desgirado(SOMBRA_X, SOMBRA_Y, giro)
  const [fx, fy] = desgirado(baixo * s.dx, baixo * s.dy, giro)
  // A sombra da folhagem e a da estaca ficam na terra, sem pino: caem para baixo à direita na tela.
  L.push(P(circulo(x + fx, y + fy, baixo * s.raio), COR_DA_SOMBRA, { bisel: 0, contorno: 0, alfa: s.alfa, suave: s.suave }))
  L.push(P(capsula(x, y, x + sx * zEstaca, y + sy * zEstaca, SOMBRA_DA_ESTACA.raio), COR_DA_SOMBRA, { bisel: 0, contorno: 0, alfa: SOMBRA_DA_ESTACA.alfa, suave: SOMBRA_DA_ESTACA.suave }))
  for (const [j, andar] of ANDARES_DO_TOMATEIRO.entries()) {
    const r = g * andar.raio
    const [px, py] = desgirado(andar.pinoX, PINO_A_FRENTE, giro)
    const pinoX = x + px
    const pinoY = y + py
    sombras.push(pino(pinoX, pinoY, g * andar.altura))
    // A primeira folha aponta para o pino e o esconde.
    const fase = Math.atan2(py, px)
    for (let k = 0; k < andar.folhas; k += 1) {
      const a = fase + (k / andar.folhas) * VOLTA
      const folha = elipseGirada(x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52, r * 0.5, r * 0.25, a)
      L.push(P(comMeioEm(folha, pinoX, pinoY), FOLHA_DO_TOMATEIRO, { bisel: 0.7, contorno: 0.2, tom: 0.9 + 0.08 * j + (k % 2 ? 0.06 : 0), textura: texDeFolha, semente: sem + j * 20 + k, projeta: k % 2 === 0 ? SOMBRA_DA_FOLHA : undefined }))
    }
    for (let k = 0; k < andar.tomates; k += 1) {
      // Entre duas folhas, onde o cacho aparece.
      const a = fase + ((k * 2 + 1.5) / andar.folhas) * VOLTA
      const tomate = circulo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, g * RAIO_DO_TOMATE)
      const verde = j === ANDARES_DO_TOMATEIRO.length - 1
      L.push(P(comMeioEm(tomate, pinoX, pinoY), verde ? TOMATE_VERDE : TOMATE, { bisel: g * RAIO_DO_TOMATE * 0.9, contorno: 0.26, semente: sem + j * 20 + 10 + k, projeta: { dist: 0.7, forca: 0.24, suave: 0.6 } }))
    }
  }
  L.push(P(estaca, madeira, { tabua: 0, bisel: 0.6, contorno: 0.3, tom: 1.05, textura: texDoTopo(x, y), semente: sem + 90 }))
}

// ---------- a pá de mão e o regador ----------

/** O ferro da pá e o zinco do regador (o ferro do Meio-Termo, mais claro; o zinco puxa para o azul). */
const FERRO_DA_PA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.25)) }
const ZINCO: MaterialDaPeca = { classe: 'metal', rgb: rgb('#8e989c') }
/**
 * A água dentro do regador: a do poço e do balde (#40707e) puxada para o cinza
 * do zinco. Com a cor do poço, a água na sombra da tampa e da alça era
 * levantada até o piso de luz (que mistura no marrom da nogueira) e parava em
 * 0,0430 de luminância, rente ao limite do portão (0,043); esta para em 0,0438.
 */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#587c86') }
const SOMBRA_NA_AGUA = { k: 1.8, forca: 0.34 } as const
/** A pá (px do protótipo): o comprimento da lâmina e do cabo, as meias larguras e o quanto ela está torta. */
const PA = { lamina: 5.4, meiaLamina: 1.75, cabo: 5.6, raioDoCabo: 0.85, giro: -0.4 } as const

/** A pá de mão largada na terra, com a ponta da lâmina em (x, y). */
function largarPa(o: Obra, cabo: MaterialDaPeca, x: number, y: number): void {
  const { L, P } = o
  const co = Math.cos(PA.giro)
  const si = Math.sin(PA.giro)
  const em = (ao: number, lado: number): Ponto => [x + ao * co - lado * si, y + ao * si + lado * co]
  const lamina = poligono([em(0, 0), em(PA.lamina * 0.45, -PA.meiaLamina), em(PA.lamina, -PA.meiaLamina * 0.85), em(PA.lamina, PA.meiaLamina * 0.85), em(PA.lamina * 0.45, PA.meiaLamina)])
  L.push(P(lamina, FERRO_DA_PA, { bisel: 0.7, contorno: 0.28, semente: 7590, projeta: { dist: 0.7, forca: 0.26, suave: 0.6 } }))
  const [ax, ay] = em(PA.lamina - 0.4, 0)
  const [bx, by] = em(PA.lamina + PA.cabo, 0)
  L.push(P(capsula(ax, ay, bx, by, PA.raioDoCabo), cabo, { eixo: PA.giro, tabua: 0, bisel: PA.raioDoCabo, contorno: 0.28, tom: 1.08, semente: 7591, projeta: { dist: 0.7, forca: 0.26, suave: 0.6 } }))
}

/** O regador, em casas: o raio e a altura do corpo, o comprimento do bico e a altura a que ele sobe na 3/4. */
const REGADOR = { raio: 0.112, altura: 0.26, bico: 0.2, alturaDoBico: 0.2 } as const
/** O bico, o crivo na ponta dele e a alça (px do protótipo). */
const BICO = { raio: 1.15, entra: 1.4, torto: -0.22 } as const
const CRIVO = { raio: 2.3, furo: 0.32, roda: 1.15 } as const
const ALCA = { raio: 0.9, de: -0.8, passa: 2.6 } as const

/** O regador de zinco no chão, com o meio do corpo em (x, y) e o bico para o fundo. */
function porRegador(o: Obra, x: number, y: number): void {
  const { L, P, sombras, g } = o
  const R = g * REGADOR.raio
  const corpo = circulo(x, y, R)
  // O bico: sai do corpo para o fundo, um pouco torto, com o crivo na ponta. Sobe menos que o corpo, preso ao pino do meio dele.
  const co = Math.sin(BICO.torto)
  const si = -Math.cos(BICO.torto)
  const [ax, ay] = [x + co * (R - BICO.entra), y + si * (R - BICO.entra)]
  const [bx, by] = [x + co * (R + g * REGADOR.bico), y + si * (R + g * REGADOR.bico)]
  const [mx, my] = [(ax + bx) / 2, (ay + by) / 2]
  sombras.push(pino(mx, my, g * REGADOR.alturaDoBico))
  const bico = capsula(ax, ay, bx, by, BICO.raio)
  sombras.push(contato(bico, 0.2))
  L.push(P(comMeioEm(bico, mx, my), ZINCO, { eixo: Math.atan2(si, co), bisel: BICO.raio, contorno: 0.28, tom: 0.96, semente: 7570 }))
  const [cx, cy] = [bx + co * CRIVO.raio * 0.5, by + si * CRIVO.raio * 0.5]
  L.push(P(comMeioEm(circulo(cx, cy, CRIVO.raio), mx, my), ZINCO, { bisel: 0.8, contorno: 0.28, semente: 7571, projeta: { dist: 1, forca: 0.2, suave: 0.8 } }))
  for (let k = 0; k < 5; k += 1) {
    const a = (k / 5) * VOLTA
    L.push(P(comMeioEm(circulo(cx + Math.cos(a) * CRIVO.roda, cy + Math.sin(a) * CRIVO.roda, CRIVO.furo), mx, my), ZINCO, { bisel: 0, contorno: 0, tom: 0.5, metal: 0 }))
  }

  // O corpo: a coluna de zinco, a água dentro, a meia tampa do lado do bico e a alça por cima.
  sombras.push({ forma: corpo, z: g * REGADOR.altura }, contato(corpo, 0.28))
  L.push(P(corpo, ZINCO, { bisel: 1.3, contorno: 0.28, semente: 7572 }))
  L.push(P(circulo(x, y, R - 1.4), AGUA, { bisel: 0, contorno: 0, recesso: SOMBRA_NA_AGUA, semente: 7573 }))
  const meiaTampa: Forma = { b: [x - R, y - R, x + R, y - 0.6], d: (_px, py) => py - (y - 0.6) }
  L.push(P(dentroDe(circulo(x, y, R - 0.7), meiaTampa), ZINCO, { bisel: 0.7, contorno: 0.22, tom: 1.05, semente: 7574, projeta: { dist: 0.9, forca: 0.3, suave: 0.6 } }))
  const alca = capsula(x, y + ALCA.de, x, y + R + ALCA.passa, ALCA.raio)
  L.push(P(alca, ZINCO, { eixo: Math.PI / 2, bisel: ALCA.raio, contorno: 0.3, tom: 0.9, semente: 7575, projeta: { dist: 1.3, forca: 0.3, suave: 0.7 } }))
}

// ---------- a horta ----------

type Cultura = 'repolho' | 'cenoura' | 'alface' | 'mudas'
/** A cultura de cada leira, do fundo para a frente (repete, na horta esticada). */
const CULTURAS: readonly Cultura[] = ['repolho', 'cenoura', 'alface', 'mudas']
const PASSO_DA_CULTURA: Readonly<Record<Cultura, number>> = { repolho: REPOLHO.passo, cenoura: CENOURA.passo, alface: PASSO_DA_ALFACE, mudas: PASSO_DAS_MUDAS }
/** Quantas mudas a pá de mão ocupa, no fim da leira delas. */
const MUDAS_DA_PA = 2

/** Os lugares dos pés ao longo da leira, repartidos por igual. */
function lugaresNaLeira(x0: number, x1: number, passo: number): number[] {
  const n = Math.max(1, Math.floor((x1 - x0) / passo))
  const sobra = (x1 - x0 - (n - 1) * passo) / 2
  return Array.from({ length: n }, (_v, i) => x0 + sobra + i * passo)
}

export const montarHorta: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const L = cena.partes
  const o: Obra = { L, sombras: cena.sombras, P, g, giro: c.giro }
  const madeira = c.m.madeira
  const folga = g * FOLGA_DA_PEGADA
  const canteiro: Retangulo = { x0: -hw + folga, y0: -hh + folga, x1: hw - g * FAIXA_DO_REGADOR, y1: hh - folga }
  const borda = (g * (ESTACA_DE_CANTO.lado + TABUA.espessura)) / 2
  const terra: Retangulo = { x0: canteiro.x0 + borda, y0: canteiro.y0 + borda, x1: canteiro.x1 - borda, y1: canteiro.y1 - borda }
  const leiras = Math.max(LEIRAS_MINIMAS, Math.round((terra.y1 - terra.y0) / (g * PASSO_DAS_LEIRAS)))
  const leira = (terra.y1 - terra.y0) / leiras

  // A terra entra um pouco debaixo das tábuas. A caixa dela cresce para o fundo: o meio não cai no pino de nenhum pé.
  const chao = caixa(terra.x0 - 0.5, terra.y0 - 0.5, terra.x1 + 0.5, terra.y1 + 0.5, 0.6)
  L.push(P(naCaixa(chao, [chao.b[0], chao.b[1] - leira / 2, chao.b[2], chao.b[3]]), TERRA, { bisel: 0, contorno: 0.1, recesso: { k: 2.2, forca: 0.3 }, textura: texDaTerraEmLeiras(terra.y0, leira, c.giro), semente: 7500 }))

  // O pé de tomate fica no fim da primeira leira de repolhos, no lugar do último pé.
  const plantios: (() => void)[] = []
  for (let i = 0; i < leiras; i += 1) {
    const cultura = CULTURAS[i % CULTURAS.length]
    const y = terra.y0 + (i + 0.5) * leira
    const lugares = lugaresNaLeira(terra.x0, terra.x1, g * PASSO_DA_CULTURA[cultura])
    for (const [j, x] of lugares.entries()) {
      const sem = 7600 + i * 400 + j * 30
      if (cultura === 'repolho') {
        if (i === 0 && j === lugares.length - 1) plantios.push(() => plantarTomateiro(o, madeira, x, y, 7700))
        else plantarRepolho(o, x, y, sem)
      } else if (cultura === 'cenoura') plantarCenoura(o, x, y, sem)
      else if (cultura === 'alface') plantarAlface(o, x, y, sem)
      else if (j < lugares.length - MUDAS_DA_PA) plantarMuda(o, x, y, sem)
      else if (j === lugares.length - MUDAS_DA_PA) largarPa(o, madeira, x - g * PASSO_DAS_MUDAS * 0.3, y + 0.6)
    }
  }
  cercar(o, madeira, canteiro)
  // O tomateiro por último: é o mais alto, e a folhagem dele passa por cima da tábua do canto.
  for (const plantar of plantios) plantar()
  porRegador(o, hw - (g * FAIXA_DO_REGADOR) / 2, hh * 0.42)
}
