/**
 * VELA NO PIRES de cima com volume (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; objeto novo). A luz de
 * quem mora no cortiço: um TOCO de vela quase no fim, aceso, grudado com a própria cera num PIRES de lata amassado.
 * O pires tem a beira virada (o aro claro em volta), o fundo afundado, uma ALÇA de argola de um lado para levar a
 * vela pela casa e dois pontos de ferrugem; no fundo, a POÇA de cera que escorreu e endureceu, com uma língua até a
 * beira. O toco é torto no alto, com o beiço de cera de um lado, a cova derretida, o pavio queimado, a CHAMA em gota
 * (só emissão, sem animação) e um halo pequeno e quente.
 *
 * A chama aponta para cima NA TELA (o desenho lê `c.giro`, a conta do candelabro). A LUZ é do integrador: curta e
 * quente, a sugestão está no registro do lote. A 25% de zoom sobram o disco claro de lata, o ponto creme e a chama.
 *
 * Na 3/4 (DERIVADO) o pires é uma coluna de um fio e o toco, uma coluna de cera com a chama no alto. Vai em cima da
 * mesa. Material: `metal` (o pires; sugestão: inox, que lê como lata; o latão faz uma palmatória). A cera é fixa.
 * Medidas do menor meio lado (0,5 x 0,5 casa de partida).
 */
import type { Rgb } from '../../ruido'
import { elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, type MontarMovel } from './contexto'
import { CERA } from './apoioDasReferencias'
import { anelExato, bolha, comMeioEm } from './fossoDeArena'

/** A altura do toco e a do pires (casas). */
const ALTURA_DO_TOCO = 0.13
const ALTURA_DO_PIRES = 0.03
/** A ferrugem do pires. */
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x5c, 0x44] }
/** A cera do corpo, que só a 3/4 pinta: a frente varrida tem 0,74 da luz do material (a conta do candelabro). */
const CERA_DO_CORPO: MaterialDaPeca = { classe: 'liso', rgb: [CERA.rgb[0] * 1.2, CERA.rgb[1] * 1.2, CERA.rgb[2] * 1.2] }
/** A chama: quase branca no pé, amarela no meio, laranja contido na ponta (a do candelabro). */
const PE_DA_CHAMA: Rgb = [0xff, 0xf4, 0xcf]
const MEIO_DA_CHAMA: Rgb = [0xf6, 0xd0, 0x7e]
const PONTA_DA_CHAMA: Rgb = [0xe4, 0x9a, 0x52]
const CHAMA: MaterialDaPeca = { classe: 'liso', rgb: PE_DA_CHAMA }
/** A gota da chama: ao longo dela (de -1, o pé, a 1, a ponta), a meia largura em fração da maior. O lado direito. */
const GOTA: readonly (readonly [number, number])[] = [[-1, 0.35], [-0.7, 0.8], [-0.3, 1], [0.15, 0.85], [0.6, 0.45], [1, 0]]
/** O halo: a cor do brilho do lampião e o alfa no meio. */
const COR_DO_HALO: Rgb = [226, 170, 96]
const ALFA_DO_HALO = 0.36

/** O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta. */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

function texHalo(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = Math.min(1, ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r))
    s[0] = COR_DO_HALO[0]
    s[1] = COR_DO_HALO[1]
    s[2] = COR_DO_HALO[2]
    s[4] = 1
    s[5] = ALFA_DO_HALO * (1 - t) * (1 - t)
  }
}

/** A chama: do pé (px, py), quase branco, pelo amarelo, até o laranja da ponta, `comprimento` px adiante; só emissão. */
function texChama(px: number, py: number, ux: number, uy: number, comprimento: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = Math.max(0, Math.min(1, ((x - px) * ux + (y - py) * uy) / comprimento)) * 2
    const [de, para, k] = t >= 1 ? [MEIO_DA_CHAMA, PONTA_DA_CHAMA, t - 1] : [PE_DA_CHAMA, MEIO_DA_CHAMA, t]
    s[0] = de[0] + (para[0] - de[0]) * k
    s[1] = de[1] + (para[1] - de[1]) * k
    s[2] = de[2] + (para[2] - de[2]) * k
    s[4] = 1
  }
}

function gotaDaChama(cx: number, cy: number, ux: number, uy: number, comprida: number, larga: number): Forma {
  const em = (ao: number, de: number): Ponto => [cx + ao * comprida * ux - de * larga * uy, cy + ao * comprida * uy + de * larga * ux]
  return poligono([...GOTA.map(([ao, de]) => em(ao, de)), ...GOTA.slice(0, -1).reverse().map(([ao, de]) => em(ao, -de))])
}

/** O alto do toco: a volta torta e, para o lado `escorre`, o beiço de cera que transbordou. */
function altoDoToco(x: number, y: number, r: number, escorre: number): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < 18; i += 1) {
    const t = (i / 18) * 2 * Math.PI
    const perto = Math.cos(t - escorre)
    const beico = perto > 0.75 ? ((perto - 0.75) / 0.25) * 0.34 : 0
    pontos.push([x + Math.cos(t) * r * (1 + 0.06 * Math.sin(3 * t + 1.3) + beico), y + Math.sin(t) * r * (1 + 0.06 * Math.sin(3 * t + 1.3) + beico)])
  }
  return poligono(pontos)
}

export const montarVelaNoPires: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const metal = c.m.metal
  const L = cena.partes
  const k = Math.min(hw, hh) / 14
  const rPires = 11.4 * k
  const [vx, vy, rToco] = [-0.7 * k, 0.5 * k, 3.5 * k]
  const escorre = 0.55

  // A ALÇA de argola, à direita, um pouco para baixo (a caixa fora do pires: fica no chão na 3/4).
  const alca = anelExato(rPires + 1.3 * k, 2.2 * k, 1.5 * k, 2.9 * k)
  cena.sombras.push(contato(alca, 0.26))
  L.push(P(alca, metal, { tabua: 0, bisel: 0.9 * k, tom: 0.94, contorno: 0.28, semente: 7001 }))

  // O PIRES: a beira virada, o fundo afundado e a ferrugem.
  const pires = elipse(0, 0, rPires, rPires)
  cena.sombras.push({ forma: pires, z: g * ALTURA_DO_PIRES, forca: 0.26 }, contato(pires, 0.3))
  // O meio da caixa das peças do pires fica fora do toco: na 3/4 elas sobem com o pires, não com a vela.
  const [fx, fy] = [7 * k, -5.5 * k]
  L.push(P(comMeioEm(pires, fx, fy), metal, { tabua: 0, bisel: 1.5 * k, tom: 1.04, contorno: 0.28, semente: 7002 }))
  L.push(P(comMeioEm(elipse(0, 0, rPires - 2 * k, rPires - 2 * k), fx, fy), metal, { tabua: 0, bisel: 0, tom: 0.86, contorno: 0.1, recesso: { k: 1.4 * k, forca: 0.3 }, metal: 0.2, semente: 7003 }))
  for (const [i, [a, longe, raio]] of ([[2.5, 0.84, 0.9], [4.4, 0.66, 0.6]] as const).entries()) {
    L.push(P(bolha(Math.cos(a) * rPires * longe, Math.sin(a) * rPires * longe, raio * k * 1.3, raio * k, 7010 + i, 0.25, a), FERRUGEM, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.45, suave: 0.5 * k, semente: 7011 + i }))
  }

  // A POÇA de cera endurecida no fundo, com a língua que escorreu até a beira.
  const lingua = bolha(vx + Math.cos(escorre) * 5 * k, vy + Math.sin(escorre) * 5 * k, 3.4 * k, 1.9 * k, 7020, 0.2, escorre)
  const poca = uniao(bolha(vx, vy, 5.6 * k, 5 * k, 7021, 0.16), lingua)
  L.push(P(comMeioEm(poca, fx - 0.5 * k, fy + 0.5 * k), CERA, { tabua: 0, bisel: 0.8 * k, tom: 0.93, contorno: 0.22, semente: 7022, projeta: { dist: 0.5 * k, forca: 0.2 } }))

  // O TOCO: o alto torto com o beiço, a cova derretida e o pavio queimado.
  const base = elipse(vx, vy, rToco, rToco)
  // A caixa da sombra do toco desce até a frente do pires: na 3/4 a vela é pintada depois dele, por cima.
  cena.sombras.push({ forma: { b: [base.b[0], base.b[1], base.b[2], pires.b[3] + 0.5], d: base.d }, z: g * ALTURA_DO_TOCO, forca: 0.3 }, contato(base, 0.3))
  L.push(P(altoDoToco(vx, vy, rToco, escorre), CERA, { tabua: 0, bisel: rToco * 0.45, contorno: 0.24, semente: 7030, projeta: { dist: 1.6 * k, forca: 0.3, suave: 1 * k } }))
  L.push(P(elipse(vx - Math.cos(escorre) * rToco * 0.12, vy - Math.sin(escorre) * rToco * 0.12, rToco * 0.58, rToco * 0.58), CERA, { tabua: 0, bisel: 0, tom: 0.9, contorno: 0, recesso: { k: 0.5 * k, forca: 0.24 }, semente: 7031 }))
  L.push(P(elipse(vx, vy, rToco * 0.19, rToco * 0.19), BURACO, { tabua: 0, bisel: 0, contorno: 0, semente: 7032 }))

  // O HALO e a CHAMA ficam acima do pavio, mas a caixa de cada um é centrada no toco: sobem com o alto dele.
  const [ux, uy] = desgirado(0, -1, c.giro)
  const comprida = 0.66 * rToco + 0.5 * k
  const larga = 0.4 * rToco + 0.15 * k
  const rHalo = 2.5 * rToco + 1.2 * k
  const [cx, cy] = [vx + ux * 0.75 * comprida, vy + uy * 0.75 * comprida]
  L.push(P(comMeioEm(elipse(cx, cy, rHalo, rHalo), vx, vy), CERA_DO_CORPO, { tabua: 0, bisel: 0, contorno: 0, textura: texHalo(cx, cy, rHalo), semente: 7041 }))
  L.push(P(comMeioEm(gotaDaChama(cx, cy, ux, uy, comprida, larga), vx, vy), CHAMA, { tabua: 0, bisel: 0, contorno: 0, suave: 0.6, textura: texChama(cx - ux * comprida, cy - uy * comprida, ux, uy, 2 * comprida), semente: 7042 }))
}
