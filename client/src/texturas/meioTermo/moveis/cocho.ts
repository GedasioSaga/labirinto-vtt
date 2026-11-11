/**
 * COCHO de cima com volume (lote 3 dos objetos novos, 11/11/2026), o bebedouro
 * dos animais da fazenda: um TRONCO deitado, aplainado em cima e ESCAVADO a
 * enxó, cheio de água, sobre dois pés (dois barrotes atravessados por baixo).
 * De cima aparecem a casca nas duas beiras compridas, o topo lavrado (a madeira
 * clara do cerne, com as facetas do enxó e uma racha em cada ponta), a parede
 * de dentro na sombra e a ÁGUA: a sombra da borda do lado da luz, a beira rasa
 * mais clara, as marolas, os anéis de um pingo, o reflexo e uns fios de palha
 * boiando. Dos lados saem as pontas dos dois pés. No chão, a palha que os
 * animais largaram, a terra molhada e a poça com os respingos.
 *
 * Na 3/4 (`tresQuartos.ts`): o cocho é um tampo solto na altura da borda, com
 * a beirada da altura do corpo (`ESPESSURA_DO_COCHO`, que o perfil usa): a
 * frente dele é a casca do tronco. Cada pé são DOIS tocos, o do fundo e o da
 * frente (colunas baixas): inteiro, o pé acabaria mais ao sul que o cocho e
 * seria pintado por cima dele. A palha e a terra molhada ficam no chão; a
 * palha do fundo não passa das pontas do tronco, para ficar atrás dele.
 *
 * A 25% de zoom sobram a casca escura em volta, o aro claro do topo e a faixa
 * azul da água: é o que diz "bebedouro" e não "tronco" nem "jardineira".
 * Material: `lenha` (a casca, como nos troncos; o cerne sai dela). A água, a
 * palha e o molhado são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, capsula, elipse, elipseGirada, uniao, type Forma, type Ponto } from './formas'
import { contato, luminanciaLinear, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Altura dos pés (o lado de baixo do tronco) e do corpo do tronco acima deles, em casas. */
const ALTURA_DO_PE = 0.2
const CORPO = 0.32
const ALTURA = ALTURA_DO_PE + CORPO
/** A altura do corpo do cocho (px do protótipo): a beirada dele na 3/4. O perfil do cocho em `tresQuartos.ts` usa este valor. */
export const ESPESSURA_DO_COCHO = CORPO * G

/** O tronco: meio comprimento e meia largura, em frações da meia pegada. */
const MEIO_COMPRIMENTO = 0.965
const MEIA_LARGURA = 0.74
/** A casca que sobra à vista de cada lado do topo aplainado, a parede dos lados e a das pontas (mais grossa), em casas. */
const CASCA_A_VISTA = 0.045
const PAREDE = 0.055
const PAREDE_DA_PONTA = 0.13
/** A parede não passa desta parte da meia largura: o cocho estreito ainda tem água. */
const PAREDE_MAXIMA = 0.26
/** Quanto a água fica abaixo da borda, visto de cima (px do protótipo): a tira de parede molhada em volta dela. */
const BORDA_ACIMA_DA_AGUA = 1.1
/** O quanto a beira do tronco, a do topo e a da cova saem da régua (px do protótipo): lavrado a machado, não serrado. */
const TORTO_DA_CASCA = 0.6
const TORTO_DO_TOPO = 0.45
const TORTO_DA_COVA = 0.4

/** Os pés: onde ficam (fração da meia largura da pegada), a meia largura do barrote (casas) e até onde saem (fração da meia altura). */
const LUGAR_DO_PE = 0.6
const MEIO_PE = 0.07
const PONTA_DO_PE = 0.97
/** Quanto o toco do pé entra debaixo do tronco (px do protótipo): só para não abrir fresta. */
const ENCAIXE_DO_PE = 0.8

/** O cerne de cada madeira (os mesmos tons do corte dos troncos), claro e quente, contido. */
const CERNE_DO_CARVALHO: Rgb = [0xb0, 0x8a, 0x5e]
const CERNE_DO_PINHO: Rgb = [0xbf, 0x9b, 0x69]
const CERNE_DA_BETULA: Rgb = [0xc6, 0xb2, 0x8b]
/** A casca do pinho é a mais clara das duas fendidas: a luz dela separa do carvalho. */
const VERMELHO_DA_CASCA_DO_PINHO = 115

/** A água: o azul-petróleo do Meio-Termo, mais claro que a do balde (o cocho é raso e largo, a luz chega ao fundo). */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.82)) }
/** A água rasa junto da parede (a madeira molhada aparece por baixo) e o reflexo do céu. */
const AGUA_RASA: Rgb = [0x6f, 0x91, 0x8c]
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xcf, 0xd9, 0xd5] }
/** A palha largada no chão e boiando: o amarelo-palha contido do feno. */
const PALHA: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0xa7, 0x69] }
/** A terra molhada (um escuro quente, meio transparente: escurece a terra e a lajota) e a poça rasa. */
const MOLHADO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2d, 0x25] }
const POCA: MaterialDaPeca = { classe: 'liso', rgb: [0x58, 0x7e, 0x86] }

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5
const CONTRASTE_DO_DETALHE_MIUDO = 0.3

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** O cerne que combina com a casca escolhida: a bétula pela textura, o pinho pela luz da casca. */
function cerneDa(casca: MaterialDaPeca): Rgb {
  if (casca.casca === 'betula') return CERNE_DA_BETULA
  return casca.rgb[0] >= VERMELHO_DA_CASCA_DO_PINHO ? CERNE_DO_PINHO : CERNE_DO_CARVALHO
}

/** A luminância linear do escuro em que o pixel escuro demais é levantado: a do escuro padrão do motor (a nogueira). */
const LUZ_DO_ESCURO = 0.062
const PASSO_DO_ESCURO = 0.02

/**
 * O escuro da PRÓPRIA casca: o tom dela descido até a luz do escuro padrão. A frente do tronco, na 3/4, cai
 * abaixo do piso de luz e é levantada para o escuro da cena; com o padrão (a nogueira) ela saía riscada de
 * vermelho-queimado.
 */
function escuroDa(casca: MaterialDaPeca): Rgb {
  const escuro = (f: number): Rgb => [Math.round(casca.rgb[0] * f), Math.round(casca.rgb[1] * f), Math.round(casca.rgb[2] * f)]
  let f = 1
  while (f > PASSO_DO_ESCURO && luminanciaLinear(...escuro(f)) > LUZ_DO_ESCURO) f -= PASSO_DO_ESCURO
  return escuro(f)
}

/** A forma com a beira torta pelo ruído, até `quanto` px para dentro ou para fora. */
function torta(f: Forma, quanto: number, sem: number): Forma {
  return {
    b: [f.b[0] - quanto, f.b[1] - quanto, f.b[2] + quanto, f.b[3] + quanto],
    d: (x, y) => f.d(x, y) + quanto * 2 * ruido(x * 0.13 + sem, y * 0.13 + sem * 0.7),
  }
}

/** A forma encolhida `quanto` px por igual (a água dentro da cova). */
function encolhida(f: Forma, quanto: number): Forma {
  return { b: f.b, d: (x, y) => f.d(x, y) + quanto }
}

// ---------- a madeira lavrada ----------

/** O comprimento de um golpe do enxó e a largura da faixa que ele tira (px do protótipo), e a luz de cada faceta. */
const GOLPE = 6.5
const FAIXA_DO_GOLPE = 3.2
const LUZ_DA_FACETA = 0.09

const daMadeira = texturaDaClasse('madeira')

/** O topo lavrado: o veio do cerne e, por cima, as facetas do enxó (cada golpe tirou uma lasca e deixou um plano). */
const texLavrado: Textura = (u, v, x, y, p, s, escala) => {
  if (daMadeira !== null) daMadeira(u, v, x, y, p, s, escala)
  const faixa = Math.floor(y / FAIXA_DO_GOLPE)
  const golpe = Math.floor((x + hash(faixa, 3, 571) * GOLPE + ruido(y * 0.3 + p.sv, x * 0.05) * 3) / GOLPE)
  s[3] += (hash(golpe, faixa, 572) - 0.5) * LUZ_DA_FACETA * (escala < ESCALA_DO_DETALHE ? CONTRASTE_DO_DETALHE_MIUDO : 1)
}

// ---------- a água ----------

/** Para o lado da luz, no chão (os mesmos números do motor): a parede desse lado faz sombra na água. */
const PARA_A_LUZ_X = -0.79
const PARA_A_LUZ_Y = -0.61
/** O comprimento da sombra da borda na água e o borrão dela (px do protótipo), e quanto ela escurece. */
const SOMBRA_DA_BORDA = 2.6
const BORRAO_DA_SOMBRA = 1.6
const FORCA_DA_SOMBRA = 0.3
/** Até onde, a partir da parede, a água é rasa (px do protótipo), e quanto da cor rasa entra nela. */
const RASO = 4.2
const COR_DO_RASO = 0.5
/** Os anéis do pingo: o passo deles (radianos por px) e a luz. */
const PASSO_DOS_ANEIS = 1.9
const LUZ_DOS_ANEIS = 0.06

/** Um pingo na água: onde caiu e até onde os anéis dele chegam (px do protótipo). */
interface Pingo {
  readonly x: number
  readonly y: number
  readonly alcance: number
}

/**
 * A água do cocho: a sombra da parede do lado da luz, a beira rasa (mais clara e mais verde: a madeira
 * molhada por baixo), as marolas ao comprido e os anéis em volta de cada pingo.
 */
function texDaAgua(cova: Forma, pingos: readonly Pingo[], sem: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const naSombra = limitar(0.5 + cova.d(x + PARA_A_LUZ_X * SOMBRA_DA_BORDA, y + PARA_A_LUZ_Y * SOMBRA_DA_BORDA) / BORRAO_DA_SOMBRA, 0, 1)
    const rasa = limitar(1 + cova.d(x, y) / RASO, 0, 1)
    const t = rasa * rasa * COR_DO_RASO
    s[0] += (AGUA_RASA[0] - s[0]) * t
    s[1] += (AGUA_RASA[1] - s[1]) * t
    s[2] += (AGUA_RASA[2] - s[2]) * t
    s[3] += ruido(x * 0.07 + sem, y * 0.5) * 0.07 + ruido(x * 0.3, y * 0.9 + sem) * 0.03 - FORCA_DA_SOMBRA * naSombra
    const miudo = escala < ESCALA_DO_DETALHE ? CONTRASTE_DO_DETALHE_MIUDO : 1
    for (const pingo of pingos) {
      const longe = Math.hypot(x - pingo.x, y - pingo.y)
      if (longe < pingo.alcance) s[3] += Math.sin(longe * PASSO_DOS_ANEIS) * LUZ_DOS_ANEIS * (1 - longe / pingo.alcance) * miudo
    }
  }
}

/** Onde os pingos caíram na água: [ao comprido, de través] em frações da cova, e o alcance dos anéis (px): um grande e um resto de outro. */
const PINGOS: readonly (readonly [number, number, number])[] = [
  [0.36, -0.1, 9.5],
  [-0.6, 0.34, 4],
]
/** Os riscos do reflexo na água: [ao comprido, de través, meio comprimento] em frações da cova, e a meia largura em px. */
const REFLEXOS: readonly (readonly [number, number, number, number])[] = [
  [-0.16, 0.34, 0.3, 0.8],
  [0.66, 0.44, 0.1, 0.6],
  [-0.56, -0.26, 0.09, 0.55],
]
/** Os fios de palha boiando: [ao comprido, de través] em frações da cova, o ângulo e o meio comprimento (px). */
const PALHA_BOIANDO: readonly (readonly [number, number, number, number])[] = [
  [-0.74, -0.34, 0.5, 2.2],
  [-0.1, -0.5, -0.2, 1.8],
  [0.78, 0.2, 2.4, 2],
  [0.2, 0.52, 0.1, 1.6],
]

// ---------- no chão em volta ----------

/**
 * Os tufos de palha largada, cada um um feixe de fios quase paralelos: [x em fração do meio comprimento do
 * tronco, lado (-1 = fundo, 1 = frente), quantos fios, o ângulo do feixe].
 */
const TUFOS_DE_PALHA: readonly (readonly [number, number, number, number])[] = [
  [-0.8, -1, 8, 0.16],
  [-0.2, -1, 11, -0.12],
  [0.34, -1, 7, 0.2],
  [0.82, -1, 7, -0.18],
  [-0.84, 1, 7, -0.14],
  [-0.3, 1, 8, 0.1],
]
/** O quanto os fios de um tufo se espalham ao comprido (px do protótipo), o quanto cada um sai do ângulo do feixe e as medidas do fio. */
const ESPALHADO = 5
const DESALINHADO = 0.5
const MEIO_FIO = 2.6
const RAIO_DO_FIO = 0.4
/** A terra molhada na frente, do lado direito: o meio (fração da meia largura), a meia largura dela (fração) e a meia altura (px). */
const MANCHA_MOLHADA = { x: 0.24, meia: 0.3, alta: 3.4 } as const
/** A poça, no meio da mancha: os dois lóbulos dela, [x em fração da meia largura, meia largura em fração, meia altura em px]. */
const LOBULOS_DA_POCA: readonly (readonly [number, number, number])[] = [
  [0.2, 0.12, 1.7],
  [0.32, 0.08, 1.3],
]
/** Os respingos em volta da poça: [x em fração da meia largura, y em fração da margem da frente, raio em px]. */
const RESPINGOS: readonly (readonly [number, number, number])[] = [
  [0.0, 0.34, 0.7],
  [0.06, 0.86, 0.55],
  [0.46, 0.3, 0.6],
  [0.5, 0.8, 0.8],
  [-0.08, 0.66, 0.5],
]

/** A palha largada junto do cocho, na margem entre ele e a beira da pegada, e a terra molhada com a poça. */
function montarChao(c: ContextoDoMovel, cena: Cena, meioComprimento: number, meiaLargura: number): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  // A margem em que o chão aparece: da beira do tronco (com a folga do torto dele) até a beira da pegada.
  const y0 = meiaLargura + TORTO_DA_CASCA + 0.5
  const y1 = hh - 0.4
  if (y1 <= y0) return
  const meio = (y0 + y1) / 2
  const mancha = elipse(hw * MANCHA_MOLHADA.x, meio + 0.4, hw * MANCHA_MOLHADA.meia, MANCHA_MOLHADA.alta)
  L.push(P(mancha, MOLHADO, { bisel: 0, contorno: 0, alfa: 0.26, suave: 2.2, semente: 5200 }))
  const poca = LOBULOS_DA_POCA.map(([fx, meia, alta], i): Forma => elipse(hw * fx, meio + (i === 0 ? 0 : 0.5), hw * meia, alta)).reduce(uniao)
  L.push(P(poca, POCA, { bisel: 0, contorno: 0.2, alfa: 0.72, suave: 0.7, semente: 5201 }))
  L.push(P(elipse(hw * (LOBULOS_DA_POCA[0][0] - 0.02), meio - 0.3, hw * LOBULOS_DA_POCA[0][1] * 0.5, 0.4), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.5, semente: 5202 }))
  RESPINGOS.forEach(([fx, fy, raio], i) => {
    L.push(P(elipse(hw * fx, y0 + (y1 - y0) * fy, raio * 1.3, raio), POCA, { bisel: 0, contorno: 0, alfa: 0.6, suave: 0.4, semente: 5210 + i }))
  })
  TUFOS_DE_PALHA.forEach(([fx, lado, fios, feixe], k) => {
    // A palha do fundo não passa das pontas do tronco: na 3/4 ela fica atrás dele, e não solta no ar ao lado.
    const xMaximo = lado < 0 ? meioComprimento - 1.5 : hw - 0.6
    for (let i = 0; i < fios; i += 1) {
      const sem = k * 16 + i
      const x = meioComprimento * fx + (hash(sem, 1, 581) - 0.5) * 2 * ESPALHADO
      const y = y0 + (0.15 + 0.7 * hash(sem, 2, 581)) * (y1 - y0)
      const ang = feixe + (hash(sem, 3, 581) - 0.5) * DESALINHADO
      const meioFio = MEIO_FIO * (0.5 + hash(sem, 4, 581))
      const dx = Math.cos(ang) * meioFio
      const folga = Math.min(y - y0, y1 - y)
      const dy = limitar(Math.sin(ang) * meioFio, -folga, folga)
      const fio = capsula(limitar(x - dx, -xMaximo, xMaximo), lado * (y - dy), limitar(x + dx, -xMaximo, xMaximo), lado * (y + dy), RAIO_DO_FIO)
      L.push(P(fio, PALHA, { bisel: 0.3, tom: 0.82 + 0.3 * hash(sem, 5, 581), contorno: 0.14, semente: 5220 + sem }))
    }
  })
}

export const montarCocho: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const casca = c.m.lenha
  const cerne: MaterialDaPeca = { classe: 'madeira', rgb: cerneDa(casca) }
  const L = cena.partes
  const a = hw * MEIO_COMPRIMENTO
  const b = hh * MEIA_LARGURA
  cena.corDoPiso = escuroDa(casca)

  montarChao(c, cena, a, b)

  // OS PÉS: de cada barrote só as duas pontas aparecem (o meio fica debaixo do tronco), cada uma um toco.
  const meioPe = g * MEIO_PE
  const zPe = g * ALTURA_DO_PE
  for (const lado of [-1, 1]) {
    for (const ponta of [-1, 1]) {
      const x = lado * hw * LUGAR_DO_PE
      const y0 = ponta < 0 ? -hh * PONTA_DO_PE : b - ENCAIXE_DO_PE
      const y1 = ponta < 0 ? -b + ENCAIXE_DO_PE : hh * PONTA_DO_PE
      if (y1 - y0 < 1) continue
      const toco = caixa(x - meioPe, y0, x + meioPe, y1, 0.9)
      cena.sombras.push({ forma: toco, z: zPe }, contato(toco, 0.3))
      L.push(P(toco, cerne, { eixo: QUARTO, tabua: 0, bisel: 1.1, tom: ponta < 0 ? 0.86 : 0.78, contorno: 0.26, semente: 5300 + lado * 2 + ponta }))
    }
  }

  // O TRONCO: a casca nas beiras compridas, o topo aplainado e lavrado, com uma racha em cada ponta.
  const tronco = torta(caixa(-a, -b, a, b, Math.min(3.6, b * 0.3)), TORTO_DA_CASCA, 11)
  cena.sombras.push({ forma: tronco, z: g * ALTURA, solta: true, forca: 0.3 }, contato(tronco, 0.2))
  L.push(P(tronco, casca, { eixo: 0, bisel: Math.min(3.4, b * 0.3), tom: 0.92, contorno: 0.26, semente: 5310 }))
  const meioTopo = b - Math.min(g * CASCA_A_VISTA, b * 0.2)
  const topo = torta(caixa(-a + 0.5, -meioTopo, a - 0.5, meioTopo, 1.8), TORTO_DO_TOPO, 23)
  L.push(P(topo, cerne, { eixo: 0, tabua: 0, bisel: 0.9, tom: 1.02, contorno: 0.22, textura: texLavrado, semente: 5311 }))

  // A COVA: a parede de dentro, na sombra da borda do lado da luz.
  const parede = Math.min(g * PAREDE, meioTopo * PAREDE_MAXIMA)
  const meiaCova = meioTopo - parede
  const meioComprimentoDaCova = a - Math.min(g * PAREDE_DA_PONTA, a * 0.2)
  const cova = torta(caixa(-meioComprimentoDaCova, -meiaCova, meioComprimentoDaCova, meiaCova, meiaCova * 0.72), TORTO_DA_COVA, 37)
  for (const ponta of [-1, 1]) {
    // A racha da ponta: do topo de fora até perto da cova, ao longo do veio.
    const x0 = ponta * (a - 0.6)
    const x1 = ponta * (meioComprimentoDaCova + 0.8)
    const y = meioTopo * (ponta < 0 ? 0.22 : -0.3)
    const racha: Ponto[] = [[x0, y], [(x0 * 2 + x1) / 3, y + 0.45], [(x0 + x1 * 2) / 3, y - 0.2], [x1, y + 0.3]]
    L.push(P(cadeia(racha, 0.32), cerne, { tabua: 0, bisel: 0, tom: 0.5, contorno: 0, semente: 5312 + ponta }))
  }
  L.push(P(cova, cerne, { eixo: 0, tabua: 0, bisel: 0, tom: 0.62, contorno: 0.2, recesso: { k: 2.4, forca: 0.4 }, semente: 5320 }))

  // A ÁGUA, um pouco abaixo da borda, com o reflexo e a palha boiando.
  const agua = encolhida(cova, BORDA_ACIMA_DA_AGUA)
  const naCova = (fx: number, fy: number): Ponto => [fx * meioComprimentoDaCova, fy * meiaCova]
  const pingos = PINGOS.map(([fx, fy, alcance]): Pingo => {
    const [x, y] = naCova(fx, fy)
    return { x, y, alcance }
  })
  L.push(P(agua, AGUA, { bisel: 0, contorno: 0.16, textura: texDaAgua(cova, pingos, 5321), semente: 5321 }))
  REFLEXOS.forEach(([fx, fy, meio, alta], i) => {
    const [x, y] = naCova(fx, fy)
    L.push(P(elipse(x, y, meio * meioComprimentoDaCova, alta), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.28, suave: 0.9, semente: 5330 + i }))
  })
  PALHA_BOIANDO.forEach(([fx, fy, ang, meio], i) => {
    const [x, y] = naCova(fx, fy)
    L.push(P(elipseGirada(x, y, meio, RAIO_DO_FIO, ang), PALHA, { bisel: 0.3, tom: 0.96, contorno: 0.2, semente: 5340 + i }))
  })
}
