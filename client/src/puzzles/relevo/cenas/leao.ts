/**
 * LEÃO COROADO (relevo de fábrica): um leão passante virado para a esquerda,
 * pata dianteira erguida, juba farta, coroa de cinco pontas, língua de fora e
 * cauda erguida com tufo; fundo em losangos rasos, duas estrelas, chão com
 * flores. Mapa de altura (ver `comum.ts`).
 */
import { DOMO_ALTO, DOMO_CUPULA, DOMO_MEIO, DOMO_SALIENCIA, bossa, cheio, circulo, elipse, espiral, estrela, friso, fundo, mecha, membro, polar, tubo, tufo, vinco } from './comum'

const LOSANGOS =
  '<defs><pattern id="rlv-losango" patternUnits="userSpaceOnUse" width="64" height="64" patternTransform="rotate(45)"><path d="M0,0H64V64" fill="none" stroke="#fff" stroke-opacity="0.06" stroke-width="3"/><circle cx="32" cy="32" r="3.5" fill="#fff" fill-opacity="0.08"/></pattern></defs>'

function fundoEChao(): string {
  let flores = ''
  for (const [x, y] of [
    [120, 690],
    [360, 696],
    [700, 694],
    [1100, 690],
  ] as const) {
    for (let i = 0; i < 5; i++) {
      const [px, py] = polar(x, y, 7, i * 72 - 90)
      flores += circulo(px, py, 5, 0.52)
    }
    flores += circulo(x, y, 4, 0.6)
  }
  return [
    LOSANGOS,
    '<rect width="1200" height="720" fill="url(#rlv-losango)"/>',
    estrela(124, 112, 46, 18, 6, DOMO_CUPULA),
    estrela(770, 120, 34, 14, 6, DOMO_CUPULA),
    cheio('M0,670C200,660 400,676 600,668C800,660 1000,674 1200,666V720H0Z', 0.34),
    flores,
    tufo(240, 676, 0.44),
    tufo(500, 672, 0.44),
    tufo(1020, 672, 0.44),
  ].join('')
}

function juba(): string {
  let mechas = ''
  // camada de fora: em leque atrás da cabeça (do alto, por trás, até o peito),
  // nunca na frente da cara
  for (let i = 0; i < 11; i++) {
    const ang = 222 + i * 22
    const [x, y] = polar(372, 290, 128, ang)
    const [dx, dy] = polar(0, 0, 72, ang + 22)
    mechas += mecha(x, y, dx, dy, 46, -16, 0.66)
  }
  // camada de dentro
  for (let i = 0; i < 9; i++) {
    const ang = 232 + i * 25
    const [x, y] = polar(372, 290, 88, ang)
    const [dx, dy] = polar(0, 0, 66, ang + 26)
    mechas += mecha(x, y, dx, dy, 40, -14, 0.76)
  }
  let cachos = ''
  for (const [cx, cy] of [
    [470, 200],
    [520, 300],
    [490, 400],
    [420, 160],
    [420, 450],
  ] as const)
    cachos += vinco(espiral(cx, cy, 3, 18, 1.5, 0), 3.5, 0.22)
  const base = 'M262,200C290,128 380,104 452,124C524,146 580,196 596,270C612,340 596,410 566,456C536,498 482,508 440,486C402,466 384,430 376,392C336,392 290,370 270,326C254,288 250,236 262,200Z'
  return mechas + cheio(base, DOMO_MEIO) + cheio(base, 'url(#rlv-pelo)') + cachos
}

function cara(): string {
  return [
    elipse(362, 226, 16, 20, DOMO_CUPULA, -20),
    cheio('M346,216C316,210 286,222 268,245C256,262 242,275 234,290C230,300 234,312 244,316C256,320 268,318 278,322C286,330 291,345 306,350C326,356 351,350 366,335C381,318 386,290 381,262C378,240 366,222 346,216Z', DOMO_CUPULA),
    bossa(258, 300, 26, 20, 0.12),
    bossa(336, 312, 30, 26, 0.08),
    mecha(286, 250, 40, -4, 12, 4, 0.97),
    cheio('M290,264Q304,254 318,264Q304,272 290,264Z', 0.98),
    vinco('M288,264Q304,250 320,264Q304,274 288,264Z', 2.5, 0.35),
    circulo(306, 263, 3.5, 0.7),
    elipse(240, 292, 8, 6, 0.5),
    vinco('M244,316C256,322 268,322 280,324M300,300C310,320 312,336 306,348', 3, 0.35),
    mecha(256, 322, -26, 16, 11, 6, 0.92),
    vinco('M262,304h0M272,300h0M270,310h0M282,306h0', 4, 0.3),
  ].join('')
}

function coroa(): string {
  let pontas = ''
  for (const x of [316, 346, 375, 404, 434]) pontas += cheio(`M${x - 13},142L${x},98L${x + 13},142Z`, 0.86) + circulo(x, 94, 7.5, DOMO_CUPULA)
  return [
    '<g transform="rotate(-8 375 140)">',
    pontas,
    cheio('M312,140H438L432,168H318Z', DOMO_CUPULA),
    friso('M314,142H436M318,166H432', 3, 0.35),
    circulo(345, 154, 5, 1),
    circulo(375, 154, 6.5, 1),
    circulo(405, 154, 5, 1),
    '</g>',
  ].join('')
}

function corpo(): string {
  const corpoD = 'M522,330C582,300 700,290 800,300C880,308 950,320 990,360C1020,390 1020,440 1000,470C980,500 940,510 900,505L620,505C570,500 535,470 525,430C518,400 515,360 522,330Z'
  const garras = (pts: readonly (readonly [number, number])[], dx: number, dy: number) => pts.map(([x, y]) => mecha(x, y, dx, dy, 9, -4, 0.96, false)).join('')
  return [
    // cauda erguida com tufo
    tubo('M1000,360C1062,338 1092,280 1086,220C1080,170 1052,140 1040,122', 18, 0.62, 0.88),
    mecha(1040, 126, -20, -46, 30, 10, 0.82),
    mecha(1042, 124, 8, -50, 26, -8, 0.8),
    mecha(1036, 128, -44, -24, 22, 10, 0.76),
    // patas de lá
    membro(626, 462, 56, 616, 600, 40, 6, 0.48),
    membro(616, 600, 36, 606, 646, 34, 0, 0.5),
    elipse(596, 656, 36, 16, 0.56),
    membro(866, 470, 56, 852, 590, 38, -6, 0.48),
    membro(852, 590, 34, 838, 646, 32, 0, 0.5),
    elipse(826, 660, 34, 15, 0.56),
    // corpo
    cheio(corpoD, DOMO_ALTO),
    bossa(940, 420, 70, 72, 0.1),
    vinco('M700,330C690,380 690,430 700,480M740,326C732,380 732,430 742,486M640,500C720,510 820,510 900,500', 3, 0.12),
    // traseira de cá
    elipse(925, 430, 74, 80, DOMO_SALIENCIA, 12),
    membro(942, 486, 52, 962, 600, 36, -8, 0.7),
    membro(962, 600, 34, 950, 648, 34, 0, 0.72),
    elipse(940, 658, 38, 17, DOMO_CUPULA),
    garras([[910, 664], [920, 668], [930, 670]], -10, 6),
  ].join('')
}

function pataErguida(): string {
  return [
    membro(566, 420, 64, 506, 500, 44, -10, 0.72),
    membro(506, 500, 42, 448, 506, 36, 8, 0.74),
    elipse(434, 502, 28, 22, DOMO_CUPULA, -10),
    mecha(412, 510, -8, 18, 9, -4, 0.96, false),
    mecha(422, 516, -6, 18, 9, -4, 0.96, false),
    mecha(434, 520, -4, 18, 9, -4, 0.96, false),
  ].join('')
}

export function relevoLeao(): string {
  // o leão vai 30 para a direita: o olho fica inteiro na placa 5 e o focinho na 4
  return fundo(0.2) + fundoEChao() + `<g transform="translate(30 0)">${corpo()}${juba()}${pataErguida()}${cara()}${coroa()}</g>`
}
