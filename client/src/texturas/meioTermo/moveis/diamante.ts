/**
 * DIAMANTE de cima com volume (lote 17 dos objetos novos, 12/11/2026, grupo Tesouro; pedido do mestre: "coloque
 * Ouro, Diamente, Joias, Moedas de ouro como objeto única e em poças"): a peça ÚNICA, uma pedra só.
 *
 * Um brilhante grande caído no chão, tombado para cima e para a luz (uma oval deitada, com a mesa fora do meio):
 * de cima se vê a mesa octogonal com as setas claras e escuras e o reflexo da culeta no meio, e a coroa em volta (as
 * estrelas claras, as pipas, a cinta escura e clara), com a aresta fina entre as facetas (`pedraLapidada.ts`). Um fio de
 * arco-íris muito discreto na pipa do lado da sombra, uma estrelinha de brilho no canto da mesa do lado da luz e um
 * ponto do outro lado. No chão, a sombra da pedra para baixo à direita e, na ponta dela, a LUZ QUE ATRAVESSOU a
 * pedra: um crescente claro, quente no meio e com a franja de cores apagadas. É o que diz "pedra transparente".
 *
 * Na 3/4 a coroa sobe a altura da cinta (um tampo solto sem sombra; perfil `{ modo: 'derivado', espessura: 0 }`,
 * o da bola de cristal) e mostra embaixo a PONTA: o pavilhão, um leque de facetas da cinta até a culeta encostada no
 * chão, com a cinta clara entre a coroa e ele. O pavilhão fica no chão o tempo todo, inteiro debaixo da coroa: de
 * cima ela o cobre e é a subida dela que o descobre. Assim o giro não o perde (a peça "só da 3/4" da bola de cristal
 * some na 3/4 girada). Com o giro, o tombo, a luz das facetas, o brilho, as sombras e o lado da ponta ficam no lugar
 * NA TELA (`desgirado`).
 *
 * Tamanho de partida 0,5 x 0,5 casa (a 0,4 a pedra ficava com 18 px na mesa e as facetas viravam pontos): a pedra
 * enche a pegada. Esticada, a pedra segue o menor lado e continua do mesmo jeito. Sem material a escolher. Escreve
 * `cena.corDoPiso` (`ESCURO_DA_PEDRA`, um cinza azulado): o motor levanta o pixel escuro demais para essa cor, e
 * com a cor de nogueira de sempre a aresta escura da pedra branca ficava marrom.
 */
import { misturar, type Rgb } from '../../ruido'
import { cadeia, elipse, poligono, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { arrastada, cintaDaPedra, corDoArcoIris, corDoTom, desgirado, DIAMANTE, ESCURO_DA_PEDRA, estrelinha, luzNoDesenho, mesaDaPedra, pedraLapidada, rumoDaLuz, type PoseDaPedra } from './pedraLapidada'

// ---------- as medidas (frações do menor meio lado, ou do raio da pedra quando diz) ----------

/** O raio da cinta e o quanto a pedra fica para o lado da luz (a sombra cabe do outro). */
const RAIO = 0.8
const PARA_A_LUZ = 0.06
/**
 * O tombo da mesa (radianos) e para onde ela fica virada NA TELA: para cima, puxado para a luz. Tombada assim a
 * pedra é uma oval deitada, mais larga que alta, com a mesa fora do meio: de cima é uma pedra caída, e não um
 * botão; na 3/4, a coroa larga com a ponta curta embaixo é o desenho de pedra lapidada (redonda, com a ponta, ela
 * virava um alfinete de mapa).
 */
const TOMBO = 0.7
const RUMO_NA_TELA = -2
/** A fresta entre as facetas (px): fina, só a aresta; grossa, a pedra virava uma bola de discoteca. */
const FRESTA = 0.13
/** A altura da cinta na 3/4 e a da sombra no chão, em raios da pedra. */
const ALTURA_DA_CINTA = 0.55
const ALTURA_DA_SOMBRA = 0.8
/** O pavilhão na 3/4: só a cinta bem ao sul entra no leque (a de lado, subida, sairia da coroa de cima). */
const SUL_DO_LEQUE = 0.34
/** Onde a culeta encosta no chão, NA TELA, em raios a partir do meio: um pouco para o lado da sombra. */
const CULETA_PARA_O_LADO = 0.2
const CULETA_PARA_BAIXO = 0.6
/** O tom das facetas do pavilhão (alternadas), o quanto o lado da luz clareia e a faceta do reflexo. */
const TONS_DO_PAVILHAO: readonly number[] = [0.1, 0.42]
const LADO_DO_PAVILHAO = 0.16
const REFLEXO_DO_PAVILHAO = 0.72
const FACETA_DO_REFLEXO = 2
/** A cinta vista na 3/4: a grossura (px) e o tom (fosca e clara). */
const GROSSURA_DA_CINTA = 0.5
const TOM_DA_CINTA = 0.86
/** A estrelinha no canto da mesa do lado da luz e o ponto do outro lado: onde (frações da mesa e do raio) e o braço (raios). */
const CANTO_DO_BRILHO = 0.82 * 0.56
const BRACO_DO_BRILHO = 0.4
const LADO_DO_PONTO = 0.74
const BRACO_DO_PONTO = 0.16

/** A luz que atravessou a pedra no chão: o meio (raios, na direção da sombra), as meias medidas (ao longo e de través) e o alfa. */
const LUZ_NO_CHAO_A = 0.98
const LUZ_NO_CHAO_AO_LONGO = 0.24
const LUZ_NO_CHAO_DE_TRAVES = 0.42
const ALFA_DA_LUZ_NO_CHAO = 0.55
/** O meio da luz no chão, quente, e de que raio para fora entra a franja de cores (e com que força). */
const MEIO_DA_LUZ: Rgb = [255, 246, 222]
const INICIO_DA_FRANJA = 0.4
const FORCA_DA_FRANJA = 0.75

const SEMENTE = 9100

/** O crescente de luz no chão: a elipse ao longo de (ux, uy), quente no meio, com a franja de cores de través, em emissão. */
function texDaLuzNoChao(cx: number, cy: number, ux: number, uy: number, aoLongo: number, deTraves: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const a = ((x - cx) * ux + (y - cy) * uy) / aoLongo
    const b = (-(x - cx) * uy + (y - cy) * ux) / deTraves
    const q = a * a + b * b
    if (q >= 1) {
      s[5] = 0
      return
    }
    const r = Math.sqrt(q)
    const cor = r > INICIO_DA_FRANJA ? misturar(MEIO_DA_LUZ, corDoArcoIris((b + 1) / 2), ((r - INICIO_DA_FRANJA) / (1 - INICIO_DA_FRANJA)) * FORCA_DA_FRANJA) : MEIO_DA_LUZ
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 1
    s[5] = ALFA_DA_LUZ_NO_CHAO * (1 - q)
  }
}

export const montarDiamante: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const R = Math.min(c.hw, c.hh)
  const raio = RAIO * R
  const luz = luzNoDesenho(c.giro)
  const [lx, ly] = rumoDaLuz(luz)
  const [rx, ry] = desgirado(Math.cos(RUMO_NA_TELA), Math.sin(RUMO_NA_TELA), c.giro)
  const pose: PoseDaPedra = { x: lx * PARA_A_LUZ * R, y: ly * PARA_A_LUZ * R, raio, tombo: TOMBO, rumo: Math.atan2(ry, rx) }
  const meio: Ponto = [pose.x, pose.y]
  cena.corDoPiso = ESCURO_DA_PEDRA
  // A tela no referencial do desenho: para onde fica "baixo" e "direita" depois do quarto de volta da 3/4.
  const [bx, by] = desgirado(0, 1, c.giro)
  const [dx, dy] = desgirado(1, 0, c.giro)
  const zCinta = ALTURA_DA_CINTA * raio
  const cinta = cintaDaPedra(pose)
  const contorno = poligono(cinta)

  // As sombras: o contato, a sombra arrastada para baixo à direita NA TELA e a coroa como tampo solto sem sombra.
  const [ox, oy] = desgirado(SOMBRA_X * ALTURA_DA_SOMBRA * raio, SOMBRA_Y * ALTURA_DA_SOMBRA * raio, c.giro)
  cena.sombras.push(
    contato(contorno, 0.32),
    { forma: arrastada(contorno, ox, oy), z: 0, suave: 1.4, forca: 0.3 },
    { forma: elipse(pose.x, pose.y, 0.4, 0.4), z: zCinta, solta: true, forca: 0 },
  )

  // A LUZ QUE ATRAVESSOU a pedra, na ponta da sombra (fica no chão; a pedra cobre a parte de dentro).
  const ls = Math.hypot(SOMBRA_X, SOMBRA_Y)
  const [ux, uy] = desgirado(SOMBRA_X / ls, SOMBRA_Y / ls, c.giro)
  const [lcx, lcy] = [pose.x + ux * LUZ_NO_CHAO_A * raio, pose.y + uy * LUZ_NO_CHAO_A * raio]
  const rLuz = LUZ_NO_CHAO_DE_TRAVES * raio
  const vidro: MaterialDaPeca = { classe: 'liso', rgb: MEIO_DA_LUZ }
  L.push(P(elipse(lcx, lcy, rLuz, rLuz), vidro, { bisel: 0, contorno: 0, textura: texDaLuzNoChao(lcx, lcy, ux, uy, LUZ_NO_CHAO_AO_LONGO * raio, rLuz), semente: SEMENTE }))

  // O PAVILHÃO, no chão debaixo da coroa: a cinta do sul subida a altura dela, e o leque até a culeta no chão.
  const naTela = (p: Ponto): [number, number] => [(p[0] - pose.x) * dx + (p[1] - pose.y) * dy, (p[0] - pose.x) * bx + (p[1] - pose.y) * by]
  const sul = cinta
    .filter((p) => naTela(p)[1] > SUL_DO_LEQUE * raio)
    .sort((p, q) => naTela(p)[0] - naTela(q)[0])
    .map(([x, y]): Ponto => [x - bx * zCinta, y - by * zCinta])
  const culeta: Ponto = [pose.x + (dx * CULETA_PARA_O_LADO + bx * CULETA_PARA_BAIXO) * raio, pose.y + (dy * CULETA_PARA_O_LADO + by * CULETA_PARA_BAIXO) * raio]
  const escuro: Rgb = [DIAMANTE.escuro[0] * 0.88, DIAMANTE.escuro[1] * 0.88, DIAMANTE.escuro[2] * 0.88]
  L.push(P(poligono([...sul, culeta]), { classe: 'liso', rgb: escuro }, { bisel: 0, contorno: 0.34, semente: SEMENTE + 1 }))
  for (let i = 0; i + 1 < sul.length; i += 1) {
    const [ax, ay] = sul[i]
    const [qx, qy] = sul[i + 1]
    const lado = naTela([(ax + qx) / 2, (ay + qy) / 2])[0] / raio
    const tom = i === FACETA_DO_REFLEXO ? REFLEXO_DO_PAVILHAO : TONS_DO_PAVILHAO[i % 2] - LADO_DO_PAVILHAO * lado
    const faceta = poligono([sul[i], sul[i + 1], culeta])
    L.push(P({ b: faceta.b, d: (x, y) => faceta.d(x, y) + FRESTA }, { classe: 'liso', rgb: corDoTom(DIAMANTE, tom) }, { bisel: 0, contorno: 0, semente: SEMENTE + 2 + i }))
  }
  L.push(P(cadeia(sul, GROSSURA_DA_CINTA), { classe: 'liso', rgb: corDoTom(DIAMANTE, TOM_DA_CINTA) }, { bisel: 0, contorno: 0.2, semente: SEMENTE + 30 }))

  // A COROA, que sobe na 3/4 (o meio de cada peça vai para o meio da pedra, dentro do tampo).
  pedraLapidada(L, P, pose, { paleta: DIAMANTE, detalhe: 'inteira', luz, semente: SEMENTE + 40, arcoIris: true, fresta: FRESTA, meio })

  // O BRILHO: a estrelinha no canto da mesa do lado da luz e o ponto do outro lado da coroa.
  const [mx, my] = mesaDaPedra(pose)
  estrelinha(L, P, mx + lx * CANTO_DO_BRILHO * raio, my + ly * CANTO_DO_BRILHO * raio, BRACO_DO_BRILHO * raio, SEMENTE + 120, meio)
  estrelinha(L, P, pose.x - lx * LADO_DO_PONTO * raio, pose.y - ly * LADO_DO_PONTO * raio, BRACO_DO_PONTO * raio, SEMENTE + 124, meio)
}
