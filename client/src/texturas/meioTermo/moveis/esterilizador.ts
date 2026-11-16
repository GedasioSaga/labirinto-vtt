/**
 * ESTERILIZADOR REDONDO (autoclave) de cima com volume (lote L1 de 16/11/2026, necrotério e laboratório; versão
 * ORIGINAL, só a ideia do objeto das referências): o tambor de pé de NÍQUEL polido, em três pés curtos de ferro, com
 * a TAMPA presa por oito PARAFUSOS DE BORBOLETA de latão em volta da beira. Em cima da tampa ficam o MANÔMETRO de
 * mostrador branco (o ponteiro preto e o aro de latão), a VÁLVULA de segurança com o peso na alavanca e o cano de
 * vapor; dos dois lados do tambor, as ALÇAS de baquelite preta.
 *
 * A 25% de zoom sobram o disco claro de metal com o anel de pontos dourados e o mostrador branco: é o que diz
 * "autoclave" e não "panela".
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): o tambor é um tampo solto alto, e a beirada dele
 * (`ESPESSURA_DO_TAMBOR_DO_ESTERILIZADOR`, o perfil) é o costado de níquel, até um palmo do chão; debaixo aparecem os
 * três pés (colunas curtas, fora do tambor). As alças, por fora do tambor, sobem com ele (`comMeioEm`). Nada lê o
 * giro.
 *
 * Sem material escolhido: o níquel, o latão, a baquelite e o esmalte do mostrador são fixos.
 */
import { cadeia, caixa, capsula, elipse, uniao } from './formas'
import { contato } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm } from './varalDeBandeirinhas'
import { BORRACHA, ESCURO, ESMALTE, FERRO_VELHO, LATAO, NIQUEL, BRILHO_DO_NIQUEL, PISO_DO_NECROTERIO, texEsmalte } from './apoioDoNecroterio'

/** O alto da tampa e o costado do tambor (a beirada da 3/4), em casas: o tambor fica um palmo acima do chão. */
const ALTURA = 0.66
export const ESPESSURA_DO_TAMBOR_DO_ESTERILIZADOR = 0.52 * G

/** As medidas em frações do menor meio lado: o tambor, a tampa, o anel dos parafusos e os pés. */
const RAIO_DO_TAMBOR = 0.8
const RAIO_DA_TAMPA = 0.7
const ANEL_DOS_PARAFUSOS = 0.77
const PARAFUSOS = 8
const RAIO_DO_PE = 0.92
const PES = [90, 210, 330] as const
/** O manômetro (o meio e o raio), a válvula e o cano de vapor, em frações do menor meio lado. */
const MANOMETRO = { x: 0.22, y: -0.18, r: 0.25 } as const
const VALVULA = { x: -0.28, y: 0.12 } as const
const CANO = { x: -0.12, y: -0.36 } as const
/** O ponteiro do manômetro: o ângulo (radianos, a partir de "nove horas") e o comprimento em fração do raio. */
const PONTEIRO = { angulo: 2.2, comprimento: 0.78 } as const

export const montarEsterilizador: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_NECROTERIO
  const m = Math.min(hw, hh)
  const z = g * ALTURA
  const R = m * RAIO_DO_TAMBOR
  const tambor = elipse(0, 0, R, R)

  // As sombras: o tambor solto no alto (o costado é a beirada), o contato embaixo e os três pés.
  cena.sombras.push({ forma: tambor, z, solta: true, suave: 1.6, forca: 0.26 }, { forma: elipse(0, 0, R * 1.04, R * 1.04), z: 0, suave: 1.6, forca: 0.3 })
  const L = cena.partes
  for (const graus of PES) {
    const a = (graus * Math.PI) / 180
    const [px, py] = [Math.cos(a) * m * RAIO_DO_PE, Math.sin(a) * m * RAIO_DO_PE]
    const pe = elipse(px, py, m * 0.09, m * 0.09)
    cena.sombras.push({ forma: pe, z: z - ESPESSURA_DO_TAMBOR_DO_ESTERILIZADOR + 0.6, suave: 0.8, forca: 0.26 }, contato(pe, 0.32))
    L.push(P(capsula(px * 0.82, py * 0.82, px, py, m * 0.07), FERRO_VELHO, { tabua: 0, bisel: 0.6, contorno: 0.28, semente: 7501 }))
    L.push(P(pe, FERRO_VELHO, { tabua: 0, bisel: 0.7, tom: 0.9, contorno: 0.28, semente: 7502 }))
  }

  // As alças de baquelite dos dois lados (por fora do tambor: sobem com ele na 3/4).
  for (const sx of [-1, 1]) {
    const x = sx * (R + m * 0.06)
    const alca = cadeia([[sx * R * 0.92, -m * 0.2], [x + sx * m * 0.05, -m * 0.16], [x + sx * m * 0.05, m * 0.16], [sx * R * 0.92, m * 0.2]], m * 0.05)
    L.push(P(comMeioEm(alca, sx * R * 0.6, 0), BORRACHA, { tabua: 0, bisel: m * 0.04, tom: 1.15, contorno: 0.3, semente: 7503, projeta: { dist: 0.8, forca: 0.26 } }))
  }

  // O tambor e a beira dele; a tampa um nada abaulada, a junta escura entre as duas.
  L.push(P(tambor, NIQUEL, { tabua: 0, bisel: 2.2, contorno: 0.28, metal: BRILHO_DO_NIQUEL, semente: 7510 }))
  L.push(P(elipse(0, 0, m * (RAIO_DA_TAMPA + 0.03), m * (RAIO_DA_TAMPA + 0.03)), ESCURO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.55, suave: 0.5, semente: 7511 }))
  L.push(P(elipse(0, 0, m * RAIO_DA_TAMPA, m * RAIO_DA_TAMPA), NIQUEL, { tabua: 0, bisel: m * 0.3, tom: 1.04, contorno: 0.2, metal: BRILHO_DO_NIQUEL, semente: 7512 }))

  // Os parafusos de borboleta em volta da beira: o braço que abraça a junta e a borboleta de latão.
  for (let i = 0; i < PARAFUSOS; i += 1) {
    const a = (i / PARAFUSOS) * Math.PI * 2 + Math.PI / PARAFUSOS
    const [cx, cy] = [Math.cos(a), Math.sin(a)]
    const r = m * ANEL_DOS_PARAFUSOS
    L.push(P(capsula(cx * m * (RAIO_DA_TAMPA - 0.06), cy * m * (RAIO_DA_TAMPA - 0.06), cx * m * (RAIO_DO_TAMBOR - 0.01), cy * m * (RAIO_DO_TAMBOR - 0.01), m * 0.045), FERRO_VELHO, { tabua: 0, bisel: 0.4, tom: 1.2, contorno: 0.24, semente: 7520 + i }))
    const asa = m * 0.075
    const borboleta = uniao(elipse(cx * r - cy * asa, cy * r + cx * asa, asa * 0.8, asa * 0.8), elipse(cx * r + cy * asa, cy * r - cx * asa, asa * 0.8, asa * 0.8))
    L.push(P(uniao(borboleta, elipse(cx * r, cy * r, asa * 0.6, asa * 0.6)), LATAO, { tabua: 0, bisel: 0.6, tom: 1.08, contorno: 0.28, metal: 0.55, semente: 7530 + i, projeta: { dist: 0.6, forca: 0.26 } }))
  }

  // O cano de vapor: a base e o bocal com o furo.
  const [vx, vy] = [m * CANO.x, m * CANO.y]
  L.push(P(elipse(vx, vy, m * 0.08, m * 0.08), NIQUEL, { tabua: 0, bisel: 0.7, tom: 0.95, contorno: 0.28, metal: BRILHO_DO_NIQUEL, semente: 7540, projeta: { dist: 0.7, forca: 0.26 } }))
  L.push(P(elipse(vx, vy, m * 0.035, m * 0.035), ESCURO, { tabua: 0, bisel: 0, contorno: 0.1, recesso: { k: 0.6, forca: 0.4 }, semente: 7541 }))

  // A válvula de segurança: o corpo de latão, a alavanca e o peso na ponta.
  const [sx0, sy0] = [m * VALVULA.x, m * VALVULA.y]
  L.push(P(elipse(sx0, sy0, m * 0.085, m * 0.085), LATAO, { tabua: 0, bisel: 0.8, contorno: 0.28, metal: 0.55, semente: 7542, projeta: { dist: 0.8, forca: 0.28 } }))
  L.push(P(capsula(sx0, sy0, sx0 - m * 0.04, sy0 + m * 0.3, m * 0.03), FERRO_VELHO, { tabua: 0, bisel: 0.3, tom: 1.2, contorno: 0.24, semente: 7543, projeta: { dist: 0.7, forca: 0.26 } }))
  L.push(P(elipse(sx0 - m * 0.04, sy0 + m * 0.3, m * 0.06, m * 0.06), FERRO_VELHO, { tabua: 0, bisel: 0.6, contorno: 0.28, semente: 7544, projeta: { dist: 0.8, forca: 0.28 } }))

  // O manômetro: o pé, o aro de latão, o mostrador de esmalte com as marcas, o ponteiro e o vidro.
  const [gx, gy, gr] = [m * MANOMETRO.x, m * MANOMETRO.y, m * MANOMETRO.r]
  L.push(P(elipse(gx, gy, gr, gr), LATAO, { tabua: 0, bisel: gr * 0.25, contorno: 0.3, metal: 0.55, semente: 7550, projeta: { dist: 1.1, forca: 0.3 } }))
  L.push(P(elipse(gx, gy, gr * 0.8, gr * 0.8), ESMALTE, { tabua: 0, bisel: 0.3, contorno: 0.16, textura: texEsmalte, semente: 7551, recesso: { k: 0.8, forca: 0.22 } }))
  for (let k = 0; k <= 6; k += 1) {
    const a = Math.PI * 0.75 + (k / 6) * Math.PI * 1.5
    L.push(P(capsula(gx + Math.cos(a) * gr * 0.6, gy + Math.sin(a) * gr * 0.6, gx + Math.cos(a) * gr * 0.72, gy + Math.sin(a) * gr * 0.72, gr * 0.035), ESCURO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.8, semente: 7552 }))
  }
  const a = Math.PI + PONTEIRO.angulo
  L.push(P(capsula(gx, gy, gx + Math.cos(a) * gr * PONTEIRO.comprimento * 0.8, gy + Math.sin(a) * gr * PONTEIRO.comprimento * 0.8, gr * 0.05), ESCURO, { tabua: 0, bisel: 0, contorno: 0.1, semente: 7554, projeta: { dist: 0.3, forca: 0.2 } }))
  L.push(P(elipse(gx, gy, gr * 0.1, gr * 0.1), ESCURO, { tabua: 0, bisel: 0.2, contorno: 0.1, semente: 7555 }))
  L.push(P(elipse(gx - gr * 0.25, gy - gr * 0.28, gr * 0.3, gr * 0.16), ESMALTE, { tabua: 0, bisel: 0, contorno: 0, tom: 1.1, alfa: 0.35, suave: 0.6, semente: 7556 }))

  // O puxador do meio da tampa: a roseta e o botão.
  L.push(P(caixa(-m * 0.1, m * 0.24, m * 0.1, m * 0.42, m * 0.06), BORRACHA, { tabua: 0, bisel: 0.7, tom: 1.15, contorno: 0.28, semente: 7560, projeta: { dist: 0.8, forca: 0.28 } }))
}
