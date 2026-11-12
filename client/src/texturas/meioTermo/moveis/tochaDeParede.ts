/**
 * TOCHA DE PAREDE de cima com volume (lote 17 dos objetos novos, 12/11/2026,
 * grupo Templo e masmorra): a tocha de corredor de masmorra, presa na parede.
 * A PAREDE é a beira de cima da pegada (giro 0): ali fica a CHAPA de ferro,
 * de onde sai o BRAÇO forjado (torcido) até a ARGOLA, que segura o CABO de
 * madeira inclinado para fora; na ponta, a CABEÇA de pano com óleo, com a
 * brasa no miolo. Na beira da parede, a mancha de FULIGEM; no chão, na frente,
 * um brilho quente bem discreto (a luz de verdade é a do integrador).
 *
 * Feita para ir às dezenas ao longo de um corredor, girada para cada parede:
 * miúda, sem sombra no chão (ela é a luz) e lida pela cabeça escura com o
 * miolo quente na ponta de um braço curto. Não é alavanca (o cabo comprido
 * com o castão) nem chave (a argola com o palhetão).
 *
 * ACESA (variante 0) e APAGADA (variante 1), como o braseiro e a tocha de pé:
 * a chama é a camada animada do fogo de casa; a imagem parada só tem a brasa e
 * o brilho. Apagada: o pano queimado quase preto, sem brasa e sem brilho no
 * chão; a fuligem da parede fica.
 *
 * NA 3/4 a tocha sobe POUCO (`tresQuartos.ts`; todo tampo tem a beirada
 * `ESPESSURA_DA_TOCHA_DE_PAREDE`, que é a espessura do perfil): a parede do
 * app é uma linha sem altura, e a chapa continua na linha dela (decisão 27 do
 * mestre, 12/11/2026; o fator é `SUBIDA_DA_TOCHA_DE_PAREDE`). A ordem é a de
 * uma tocha em pé no meio da parede:
 * - a CHAPA é um tampo; o braço e a argola sobem com ela (a caixa de cada um
 *   é centrada na chapa) e ficam no alto dela;
 * - o CABO são dois tampos: o pé (com a peça de madeira dele) e o trecho de
 *   cima, que de cima some debaixo da cabeça e não tem peça; a cara dele sai
 *   da maior peça da cena, o brilho do chão, que por isso é de madeira;
 * - a CABEÇA é o tampo mais alto; a FULIGEM sobe com ela (a caixa é centrada
 *   na cabeça) e fica, na parede, logo acima da chama.
 * As alturas são em lados (o menor lado da pegada). Materiais: `metal` (a
 * chapa, o braço e a argola) e `madeira` (o cabo).
 */
import { SUBIDA_DA_TOCHA_DE_PAREDE, TOCHA_DE_PAREDE } from '../../../lib/mobilia/fogoDeCasa'
import { limitar01, type Rgb } from '../../ruido'
import { anel, caixa, capsula, elipse, type Forma } from './formas'
import { texturaDaClasse, type Textura } from './motor'
import { CINZA, G, type MontarMovel } from './contexto'
import { FOGO_PARADO, texBrasa, texHalo } from './fogoDeCasa'
import { PANO_COM_OLEO, PANO_QUEIMADO, texPanoDaTocha } from './tochaDePe'

/**
 * A beirada de cada tampo da tocha (px do protótipo): a cara da chapa, o cabo
 * e o rolo da cabeça. O perfil da tocha de parede usa este valor como espessura.
 * Encolhe com as alturas (`SUBIDA_DA_TOCHA_DE_PAREDE`): cada tampo continua
 * tampo, sem virar coluna até o chão (com sombra de contato debaixo da cabeça).
 */
export const ESPESSURA_DA_TOCHA_DE_PAREDE = 0.12 * G * SUBIDA_DA_TOCHA_DE_PAREDE

/**
 * As medidas de cima, em fração do menor meio lado; o `y` conta da parede (a beira de cima da pegada). Onde
 * fica a argola, quanto a cabeça passa dela e a altura da cabeça moram em `TOCHA_DE_PAREDE`
 * (`lib/mobilia/fogoDeCasa.ts`), com a conta de onde a chama animada nasce (`fogoDaTochaDeParede`).
 */
const MEIA_LARGURA_DA_CHAPA = 0.28
const GROSSURA_DA_CHAPA = TOCHA_DE_PAREDE.grossuraDaChapa
const RAIO_DO_BRACO = 0.085
const ARGOLA_EM = TOCHA_DE_PAREDE.argolaEm
const ARGOLA_DE_FORA = 0.24
const ARGOLA_DE_DENTRO = 0.14
const RAIO_DO_CABO = 0.12
/** O cabo, em fração do menor meio lado a partir da argola: o pé (de, até) e o trecho de cima. */
const PE_DO_CABO: readonly [number, number] = [-0.2, 0.02]
const ALTO_DO_CABO: readonly [number, number] = [0.1, 0.22]
const CABECA_ALEM_DA_ARGOLA = TOCHA_DE_PAREDE.cabecaAlemDaArgola
/** A cabeça inclinada para fora: de cima, um oval mais comprido para longe da parede. */
const RAIO_DA_CABECA = 0.32
const ALONGADO_DA_CABECA = 1.25
const RAIO_DA_BRASA = 0.15
/** O brilho no chão: o meio (além da cabeça), os raios e o alfa no meio. Bem discreto. */
const BRILHO_NO_CHAO_ALEM = 0.55
const BRILHO_NO_CHAO: readonly [number, number] = [0.9, 0.7]
const ALFA_DO_BRILHO_NO_CHAO = 0.13
const ALFA_DO_BRILHO = 0.42
/** A fuligem na beira da parede: a meia largura, a meia fundura e o alfa no meio. */
const FULIGEM_LARGA = 0.62
const FULIGEM_FUNDA = 0.26
const ALFA_DA_FULIGEM = 0.6
const COR_DA_FULIGEM: Rgb = [0x24, 0x20, 0x1d]

/**
 * Alturas em lados (0,4 casa na pegada de partida): o alto da chapa, do pé do cabo, do cabo e da cabeça. As do
 * desenho em pé vezes `SUBIDA_DA_TOCHA_DE_PAREDE`: na 3/4 a chapa fica na linha da parede (decisão 27 do mestre).
 * De cima elas não pintam nada (as sombras são só a altura, força 0).
 */
const ALTURA_DA_CHAPA = TOCHA_DE_PAREDE.alturaDaChapa * SUBIDA_DA_TOCHA_DE_PAREDE
const ALTURA_DO_PE_DO_CABO = 1 * SUBIDA_DA_TOCHA_DE_PAREDE
const ALTURA_DO_CABO = 1.3 * SUBIDA_DA_TOCHA_DE_PAREDE
const ALTURA_DA_CABECA = TOCHA_DE_PAREDE.alturaDaCabeca * SUBIDA_DA_TOCHA_DE_PAREDE

/** O giro (graus, `ContextoDoMovel.giro`) da tocha presa na parede de baixo: a chapa fica embaixo na tela. */
const GIRO_DA_PAREDE_DE_BAIXO = 180

const TOM_DA_CHAPA = 0.92
const TOM_DO_BRACO = 1.04
const BRILHO_DO_FERRO = 0.3
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** Apagada: os flocos de cinza na cabeça (x, y e raio em fração do raio da cabeça). */
const FLOCOS_DE_CINZA: readonly (readonly [number, number, number])[] = [
  [-0.28, -0.18, 0.22],
  [0.24, 0.14, 0.18],
]

const DO_METAL = texturaDaClasse('metal')

/** A mesma forma com a caixa centrada em (mx, my): o desenho não muda, mas a peça sobe com o que está ali. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** O ferro torcido do braço: a textura do metal com as voltas da torção em diagonal. */
const texTorcido: Textura = (u, v, x, y, p, s, escala) => {
  if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
  s[3] += 0.13 * Math.sin((x + y) * 2.3)
}

/** A fuligem: o quase-preto quente, com alfa que cai do meio (cx, cy) até os raios. */
function texFuligem(cx: number, cy: number, rx: number, ry: number, alfa: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = limitar01(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
    s[0] = COR_DA_FULIGEM[0]
    s[1] = COR_DA_FULIGEM[1]
    s[2] = COR_DA_FULIGEM[2]
    s[3] = 1
    s[5] = alfa * (1 - q) * (1 - q)
  }
}

export const montarTochaDeParede: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const lado = 2 * R
  const ferro = c.m.metal
  const madeira = c.m.madeira
  const acesa = c.variante !== 1
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const parede = -c.hh
  const yArgola = parede + ARGOLA_EM * R
  const yCabeca = yArgola + CABECA_ALEM_DA_ARGOLA * R
  const rCabeca = RAIO_DA_CABECA * R
  const solta = (forma: Forma, alto: number) => ({ forma, z: alto * lado, solta: true, forca: 0 })

  // ---------- no chão: o brilho quente (apagada, invisível; é a maior peça, e de madeira, pela cara do cabo) ----------
  const by = yCabeca + BRILHO_NO_CHAO_ALEM * R
  const [brx, bry] = [BRILHO_NO_CHAO[0] * R, Math.min(BRILHO_NO_CHAO[1] * R, c.hh - by)]
  L.push(P(elipse(0, by, brx, bry), madeira, { bisel: 0, contorno: 0, alfa: acesa ? 1 : 0, textura: texHalo(0, by, brx, bry, ALFA_DO_BRILHO_NO_CHAO), semente: 17600 }))

  // ---------- a chapa na parede, com o braço torcido e a argola por cima ----------
  const chapa = caixa(-MEIA_LARGURA_DA_CHAPA * R, parede, MEIA_LARGURA_DA_CHAPA * R, parede + GROSSURA_DA_CHAPA * R, 0.5)
  const naChapa: readonly [number, number] = [MEIA_LARGURA_DA_CHAPA * R * 0.6, parede + GROSSURA_DA_CHAPA * R * 0.5]
  const [fy, fry] = [parede + FULIGEM_FUNDA * R, FULIGEM_FUNDA * R]
  // A fuligem vai primeiro: de cima, a chapa a cobre e ela aparece em volta.
  const fuligem = elipse(0, fy, FULIGEM_LARGA * R, fry)
  // É a maior peça da cabeça: o material dela é o da cara do rolo de pano na 3/4.
  L.push(P(comMeioEm(fuligem, 0, yCabeca), acesa ? PANO_COM_OLEO : PANO_QUEIMADO, { bisel: 0, contorno: 0, textura: texFuligem(0, fy, FULIGEM_LARGA * R, fry, ALFA_DA_FULIGEM), semente: 17601 }))
  // Na parede de BAIXO (giro 180: a parede fica embaixo na tela) a chapa subida deixava uma fresta até a linha (a
  // subida menos a beirada, ~1,5 px de mundo; caça 12/11, P31). Lá ela sobe como COLUNA: o tampo fica na mesma
  // altura das outras três paredes e a frente desce até a linha. De cima nada muda (força 0); nas outras paredes,
  // a chapa continua tampo solto.
  cena.sombras.push(c.giro === GIRO_DA_PAREDE_DE_BAIXO ? { forma: chapa, z: ALTURA_DA_CHAPA * lado, forca: 0 } : solta(chapa, ALTURA_DA_CHAPA))
  L.push(P(chapa, ferro, { tabua: 0, bisel: 0.6, tom: TOM_DA_CHAPA, metal: BRILHO_DO_FERRO, contorno: 0.3, semente: 17605 }))
  const braco = capsula(0, parede + GROSSURA_DA_CHAPA * R * 0.5, 0, yArgola - ARGOLA_DE_DENTRO * R, RAIO_DO_BRACO * R)
  const doFerro = (semente: number, textura?: Textura) => ({ tabua: 0, bisel: 0.8, tom: TOM_DO_BRACO, metal: BRILHO_DO_FERRO, contorno: 0.28, textura, projeta: { dist: 0.8, forca: 0.3 }, semente })
  L.push(P(comMeioEm(braco, naChapa[0], naChapa[1]), ferro, doFerro(17606, texTorcido)))

  // ---------- o cabo de madeira passando pela argola ----------
  const trecho = ([de, ate]: readonly [number, number]): Forma => capsula(0, yArgola + de * R, 0, yArgola + ate * R, RAIO_DO_CABO * R)
  cena.sombras.push(solta(trecho(PE_DO_CABO), ALTURA_DO_PE_DO_CABO), solta(trecho(ALTO_DO_CABO), ALTURA_DO_CABO))
  L.push(P(trecho(PE_DO_CABO), madeira, { tabua: 0, bisel: RAIO_DO_CABO * R, contorno: 0.3, projeta: { dist: 0.8, forca: 0.3 }, semente: 17607 }))
  const argola = anel(0, yArgola, ARGOLA_DE_FORA * R, ARGOLA_DE_FORA * R, ARGOLA_DE_DENTRO * R, ARGOLA_DE_DENTRO * R)
  L.push(P(comMeioEm(argola, naChapa[0], naChapa[1]), ferro, doFerro(17608)))

  // ---------- a cabeça: o rolo de pano, com a brasa e o brilho (acesa) ou a cinza (apagada) ----------
  const cabeca = elipse(0, yCabeca, rCabeca, rCabeca * ALONGADO_DA_CABECA)
  cena.sombras.push(solta(cabeca, ALTURA_DA_CABECA))
  L.push(P(cabeca, acesa ? PANO_COM_OLEO : PANO_QUEIMADO, { tabua: 0, bisel: rCabeca * 0.8, contorno: 0.28, textura: texPanoDaTocha(0, yCabeca, rCabeca, acesa ? 0.34 : 0.2), semente: 17610 }))
  if (acesa) {
    const rBrasa = RAIO_DA_BRASA * R
    L.push(P(elipse(0, yCabeca, rBrasa, rBrasa), FOGO_PARADO, { bisel: 0, contorno: 0, suave: 0.4, textura: texBrasa(0, yCabeca, rBrasa), semente: 17611 }))
    L.push(P(elipse(0, yCabeca, rCabeca * 0.96, rCabeca * 0.96), FOGO_PARADO, { bisel: 0, contorno: 0, textura: texHalo(0, yCabeca, rCabeca * 0.96, rCabeca * 0.96, ALFA_DO_BRILHO), semente: 17612 }))
  } else {
    FLOCOS_DE_CINZA.forEach(([x, y, f], i) => {
      L.push(P(elipse(x * rCabeca, yCabeca + y * rCabeca, f * rCabeca, f * rCabeca * 0.8), CINZA, { tabua: 0, bisel: 0, tom: 1.25, contorno: 0, alfa: 0.75, suave: 0.4, semente: 17613 + i }))
    })
  }
}
