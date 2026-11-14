import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * PISO DE BORRACHA (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Base militar): a
 * sala de máquinas e a academia do quartel. Placas pretas de borracha de uma casa, cada uma com 5 x 5 bolinhas de
 * relevo em grade: a borda de cima à esquerda da bolinha pega a luz, a de baixo à direita escurece e ela joga uma
 * sombra curta na placa. A poeira cinza junta na fresta entre as placas, mais grossa num trecho que noutro, e a
 * placa tem marcas largas e foscas de sola.
 *
 * Preto de borracha, nunca preto puro, e sem cor (teto de saturação 0,06): o relevo é que conta. A fresta cai na
 * linha da grade, e a emenda do ladrilho, no meio dela.
 */

const CASAS = 8
/** A borracha: preto de pneu, um nada azulado como borracha nova. */
const BORRACHA: Rgb = rgb('#2d2e30')
/** A poeira cinza da fresta: pó de cimento e de sola, neutro e apagado (mais clara, a fresta virava fio de luz). */
const POEIRA: Rgb = rgb('#575652')
/** O fundo da fresta, onde a poeira não chega. */
const FRESTA: Rgb = rgb('#1c1d1e')

/** Bolinhas por lado da placa e o raio de cada uma, na célula de lado 1 (uns 7 px no ladrilho de 1024). */
const BOLINHAS = 5
const RAIO = 0.28
/** A borda macia da bolinha (na célula), o abaulado da beira, o quanto o topo gasto clareia e a sombra que ela joga. */
const BOLINHA_MACIA = 0.045
const BOLINHA_ABAULADO = 1.3
const BOLINHA_TOPO = 0.08
const BOLINHA_LUZ = 0.7
const SOMBRA = { passo: 0.075, escuro: 0.22 } as const

/** A fresta, em casas a partir da linha: no `fio`, o fundo; no `fim`, a placa. A poeira avança até `poeira`. */
const JUNTA = { fio: 0.006, fim: 0.018, poeira: 0.07 } as const
/** O quanto a poeira cobre a fresta no máximo. */
const POEIRA_FORCA = 0.6

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** A cor do piso de borracha no ponto (u, v) do ladrilho. */
export function texturaPisoDeBorracha(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * CASAS
  const y = vv * CASAS
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy

  // A placa: o tom dela, as marcas foscas de sola e o grão da borracha.
  let c = luz(BORRACHA, (hash(ix, iy, 2601) - 0.5) * 0.06)
  const sola = passoSuave(0.5, 0.8, fbm(uu, vv, 10, 2, 2602) * 0.5 + 0.5) * 0.08
  const grao = (valor(uu * 384, vv * 384, 384, 2603) - 0.5) * 0.04
  c = luz(c, sola + grao + fbm(uu, vv, 4, 2, 2604) * 0.03)

  // A bolinha da célula do ponto (nenhuma passa da célula, nem da placa).
  const qx = fx * BOLINHAS - Math.floor(fx * BOLINHAS) - 0.5
  const qy = fy * BOLINHAS - Math.floor(fy * BOLINHAS) - 0.5
  const d = Math.sqrt(qx * qx + qy * qy)
  const sx = qx - SOMBRA.passo
  const sy = qy - SOMBRA.passo
  const cabeca = passoSuave(RAIO + BOLINHA_MACIA, RAIO - BOLINHA_MACIA, d)
  const sombra = passoSuave(RAIO + BOLINHA_MACIA * 1.5, RAIO - BOLINHA_MACIA, Math.sqrt(sx * sx + sy * sy)) * (1 - cabeca)
  c = luz(c, -SOMBRA.escuro * sombra)
  if (cabeca > 0) {
    // A beira desce para fora: a inclinação aponta para o centro, mais forte perto da borda.
    const inclinacao = BOLINHA_ABAULADO * passoSuave(RAIO * 0.45, RAIO, d)
    const nx = d > 0 ? qx / d : 0
    const ny = d > 0 ? qy / d : 0
    const brilho = luzNaInclinacao(-nx * inclinacao, -ny * inclinacao) - LUZ_NO_PLANO
    c = misturar(c, luz(c, BOLINHA_TOPO + brilho * BOLINHA_LUZ), cabeca)
  }

  // A fresta e a poeira dela: mais grossa num trecho que noutro, ao longo da junta.
  const borda = Math.min(fx, 1 - fx, fy, 1 - fy)
  const acumulo = passoSuave(0.3, 0.8, fbm(uu, vv, 16, 2, 2605) * 0.5 + 0.5)
  const alcance = JUNTA.fim + (JUNTA.poeira - JUNTA.fim) * acumulo
  const poeira = passoSuave(alcance, JUNTA.fio, borda) * (0.45 + 0.55 * acumulo) * POEIRA_FORCA
  c = misturar(c, POEIRA, poeira)
  c = misturar(c, FRESTA, passoSuave(JUNTA.fim, JUNTA.fio, borda) * (1 - poeira) * 0.8)
  return empacotar(c)
}
