/**
 * CAVALEIRO CONTRA A FERA (relevo de fábrica): à esquerda o cavaleiro em galope,
 * lança baixa; à direita a fera de juba e chifres, empinada, garra levantada
 * contra a ponta da lança. Ao fundo, um castelo no morro. Mapa de altura (ver
 * `comum.ts`).
 */
import {
  DOMO_ALTO,
  DOMO_BAIXO,
  DOMO_CUPULA,
  DOMO_MEIO,
  DOMO_SALIENCIA,
  bossa,
  cheio,
  circulo,
  elipse,
  friso,
  fundo,
  mecha,
  membro,
  naCubica,
  polar,
  traco,
  tubo,
  tufo,
  vinco,
} from './comum'

function ceuECastelo(): string {
  return [
    cheio('M330,70C350,50 390,48 410,60C430,42 470,44 485,62C510,58 530,70 528,84L340,90C326,88 322,78 330,70Z', 0.28),
    cheio('M640,92C655,70 690,66 712,78C730,58 770,58 786,76C812,70 836,82 832,98L652,104C636,102 632,98 640,92Z', 0.28),
    cheio('M900,52C916,36 946,34 964,46C980,32 1010,34 1020,50L910,58C900,58 896,56 900,52Z', 0.27),
    traco('M706,150q8,-9 16,0q8,-9 16,0', 3.2, 0.42),
    traco('M752,128q6,-7 12,0q6,-7 12,0', 2.8, 0.4),
    traco('M676,124q5,-6 10,0q5,-6 10,0', 2.6, 0.38),
    // morro: três degraus que o filtro funde, sumindo no fundo embaixo
    cheio('M0,262C70,196 140,182 210,194C255,202 292,228 318,266L336,380L0,380Z', 0.23),
    cheio('M0,266C70,200 140,186 210,198C255,206 290,232 314,270L326,340L0,340Z', 0.27),
    cheio('M0,270C70,204 140,190 210,202C255,210 288,236 310,274L316,300L0,300Z', 0.32),
    cheio('M54,146L71,104L88,146Z', 0.46),
    cheio('M58,214V142H84V214Z', 0.43),
    cheio('M88,207V122H96V112H104V122H112V112H120V122H128V112H136V122H142V207Z', 0.45),
    cheio('M142,150L158,116L174,150Z', 0.46),
    cheio('M146,214V148H170V214Z', 0.43),
    cheio('M106,207V192a9,9 0 0,1 18,0V207Z', 0.33),
    vinco('M68,170v10M158,172v10M100,142v10M130,142v10', 3, 0.5),
    traco('M115,112V80', 2.5, 0.48),
    cheio('M115,80L140,87L115,94Z', 0.48),
  ].join('')
}

function chao(): string {
  return [
    cheio('M0,672C150,660 300,682 450,672C600,662 750,680 900,670C1050,662 1150,676 1200,672V720H0Z', 0.33),
    elipse(790, 690, 48, 24, DOMO_BAIXO),
    elipse(236, 697, 40, 20, DOMO_BAIXO),
    elipse(600, 700, 26, 13, DOMO_BAIXO),
    vinco('M770,684q14,8 30,2M222,694q12,6 24,0', 3, 0.3),
    tufo(80, 676, 0.42),
    tufo(410, 680, 0.42),
    tufo(690, 676, 0.42),
    tufo(910, 674, 0.42),
  ].join('')
}

/** O cavalo em galope voador, virado para a direita. */
function cavalo(): string {
  const c0 = [510, 360] as const
  const c1 = [540, 330] as const
  const c2 = [575, 280] as const
  const c3 = [615, 245] as const
  let crina = ''
  for (let i = 0; i < 6; i++) {
    const [x, y] = naCubica(c0, c1, c2, c3, 0.08 + i * 0.16)
    crina += mecha(x + 5, y + 8, -50 + i * 3, -20 - i * 3, 30, 14, 0.8)
  }
  return [
    // cauda ao vento
    mecha(276, 390, -120, 30, 40, -30, 0.72),
    mecha(272, 396, -150, 92, 34, -36, 0.68),
    mecha(270, 386, -110, -6, 26, -16, 0.76),
    // pernas do lado de lá
    membro(530, 480, 40, 575, 548, 24, -4, 0.48),
    membro(575, 548, 20, 548, 606, 15, 0, 0.5),
    elipse(548, 618, 12, 9, 0.58, -20),
    membro(372, 485, 42, 336, 556, 24, 4, 0.48),
    membro(336, 556, 20, 308, 628, 15, 0, 0.5),
    elipse(306, 638, 12, 9, 0.58),
    cheio('M610,246C606,230 610,216 616,206C622,220 624,234 622,246Z', 0.62),
    // corpo e pescoço
    cheio('M272,382C290,365 320,360 345,364C390,372 425,380 455,377C480,375 498,370 510,360C540,330 575,280 615,245L650,310C630,350 605,390 590,430C585,460 575,485 552,500C510,515 460,518 420,515C380,512 345,508 320,500C290,488 268,462 262,435C258,415 262,395 272,382Z', DOMO_ALTO),
    bossa(548, 440, 40, 52, 0.1),
    vinco('M562,412C578,440 578,470 562,496', 4, 0.2),
    vinco('M420,512C450,500 500,500 530,506', 3, 0.14),
    crina,
    // cabeça
    cheio('M612,242C625,226 648,226 668,240C695,258 722,286 740,308C750,320 748,334 734,338C722,341 710,336 700,332C688,330 676,332 664,328C645,322 632,310 624,292C618,278 612,262 612,242Z', DOMO_ALTO),
    bossa(650, 294, 26, 22, 0.14),
    cheio('M622,244C620,226 626,210 634,198C640,214 642,228 638,244Z', 0.84),
    elipse(664, 262, 7, 5, 0.98),
    vinco('M655,262a9,7 0 1,0 18,0a9,7 0 1,0 -18,0', 2.5, 0.35),
    elipse(733, 318, 6, 4, 0.42, 30),
    vinco('M738,333C728,332 718,330 708,328', 3, 0.35),
    friso('M626,252C636,244 648,242 656,244M640,248C652,270 664,292 676,314M700,284C708,300 712,318 710,336', 5, 0.4),
    traco('M706,332a6,6 0 1,0 12,0a6,6 0 1,0 -12,0', 3, 0.92),
    // pernas do lado de cá: coxa, jarrete, canela, boleto, casco
    elipse(318, 455, 62, 56, DOMO_SALIENCIA, -20),
    membro(300, 470, 54, 238, 535, 28, 6, 0.68),
    membro(238, 535, 22, 192, 592, 16, -2, 0.7),
    membro(192, 592, 15, 180, 612, 13, 0, 0.7),
    elipse(238, 535, 14, 13, 0.84),
    elipse(192, 592, 10, 9, 0.86),
    elipse(176, 620, 13, 10, DOMO_CUPULA, 60),
    membro(560, 465, 48, 612, 532, 26, -4, 0.68),
    membro(612, 532, 22, 670, 560, 16, 3, 0.7),
    membro(670, 560, 16, 694, 574, 14, 0, 0.7),
    elipse(612, 532, 15, 13, 0.84),
    elipse(670, 560, 10, 9, 0.86),
    elipse(700, 580, 13, 10, DOMO_CUPULA, 25),
  ].join('')
}

/** A fera de juba e chifres, empinada, virada para a esquerda. */
function fera(): string {
  // juba: mechas em leque em volta do pescoço, de trás da cabeça até o ombro
  let juba = ''
  for (let i = 0; i < 12; i++) {
    const ang = -100 + i * 21
    const [x, y] = polar(1012, 262, 60, ang)
    const [dx, dy] = polar(0, 0, 66, ang + 22)
    juba += mecha(x, y, dx, dy, 42, -16, 0.72)
  }
  let mechasDeCima = ''
  for (let i = 0; i < 7; i++) {
    const [x, y] = polar(1012, 262, 34, -60 + i * 26)
    const [dx, dy] = polar(0, 0, 50, -36 + i * 26)
    mechasDeCima += mecha(x, y, dx, dy, 30, -12, 0.8)
  }
  let dentes = ''
  for (const x of [890, 904, 918, 932, 946]) dentes += mecha(x, 217, 0, 12, 7, 0, 0.96, false)
  for (const x of [898, 912, 926, 940]) dentes += mecha(x, 266 - (x - 886) * 0.326, 0, -10, 7, 0, 0.93, false)
  const garras = (pts: readonly (readonly [number, number])[], v: number) => pts.map(([x, y]) => mecha(x, y, -8, 18, 8, -4, v, false)).join('')
  return [
    // pata de trás de lá, cauda, chifre de lá
    membro(1030, 540, 36, 1035, 610, 26, 6, 0.48),
    membro(1035, 610, 22, 1010, 652, 20, 0, 0.5),
    elipse(995, 665, 26, 10, 0.58),
    tubo('M1118,470C1160,450 1182,400 1172,350C1164,310 1140,290 1146,255', 20, 0.6, 0.86),
    mecha(1146, 258, -4, -46, 30, 8, 0.8),
    mecha(1146, 260, 22, -34, 22, -6, 0.76),
    mecha(1144, 262, -26, -30, 20, 6, 0.76),
    mecha(975, 164, 60, -80, 22, -20, 0.62),
    // garra de lá, embaixo da lança
    membro(975, 410, 48, 925, 440, 34, -6, 0.5),
    membro(925, 440, 30, 890, 450, 24, 0, 0.52),
    elipse(882, 452, 17, 13, 0.6),
    garras([[872, 458], [880, 462], [888, 463]], 0.64),
    // corpo de peito largo e anca forte
    cheio('M948,330C958,292 1000,272 1042,284C1084,298 1112,350 1122,410C1132,470 1120,520 1090,540C1060,560 1020,552 1000,530C985,512 978,490 968,470C950,440 938,410 936,380C934,360 940,342 948,330Z', DOMO_ALTO),
    cheio('M948,330C958,292 1000,272 1042,284C1084,298 1112,350 1122,410C1132,470 1120,520 1090,540C1060,560 1020,552 1000,530C985,512 978,490 968,470C950,440 938,410 936,380C934,360 940,342 948,330Z', 'url(#rlv-pelo)'),
    vinco('M990,440C1010,470 1030,500 1060,520', 4, 0.16),
    elipse(1085, 495, 58, 64, DOMO_SALIENCIA, -15),
    // juba farta
    juba,
    cheio('M960,190C1000,170 1060,180 1080,220C1100,260 1090,320 1060,350C1020,370 975,350 955,320C940,290 940,230 960,190Z', DOMO_MEIO),
    cheio('M960,190C1000,170 1060,180 1080,220C1100,260 1090,320 1060,350C1020,370 975,350 955,320C940,290 940,230 960,190Z', 'url(#rlv-pelo)'),
    mechasDeCima,
    // cabeça de boca aberta, um pouco maior que o desenho base
    '<g transform="translate(950 215) scale(1.15) translate(-950 -215)">',
    cheio('M878,216C908,224 948,228 990,230C960,244 920,258 882,268Z', 0.26),
    dentes,
    cheio('M985,232C960,238 935,246 912,254C898,259 886,264 882,272C898,276 920,272 940,264C962,256 980,246 995,238Z', DOMO_ALTO),
    cheio('M1010,190C1002,166 980,154 954,156C930,158 906,170 890,186C880,196 874,208 876,216C894,220 916,220 936,222C960,224 985,222 1005,214Z', DOMO_CUPULA),
    mecha(1000, 180, 30, -12, 16, -6, 0.76),
    mecha(985, 170, 100, -50, 28, -26, 0.86),
    vinco('M1018,148l8,16M1040,138l7,14M1062,130l5,12', 3, 0.28),
    mecha(934, 180, 36, -6, 11, -3, 0.97),
    elipse(950, 189, 6, 5, 1),
    vinco('M942,189a8,6.5 0 1,0 16,0a8,6.5 0 1,0 -16,0', 2.5, 0.4),
    elipse(884, 200, 4, 3, 0.4),
    vinco('M900,208C920,200 940,198 960,204', 2.5, 0.2),
    '</g>',
    // pata de cá, levantada contra a lança
    membro(992, 360, 58, 930, 342, 40, 6, 0.7),
    membro(930, 342, 36, 880, 352, 28, -4, 0.74),
    elipse(872, 356, 20, 16, DOMO_CUPULA),
    garras([[860, 364], [870, 368], [880, 370]], 0.95),
    // pata de trás de cá
    membro(1095, 545, 40, 1112, 610, 28, -6, 0.7),
    membro(1112, 610, 26, 1085, 650, 22, 0, 0.72),
    elipse(1068, 660, 32, 13, DOMO_CUPULA),
    mecha(1042, 662, -14, 6, 8, 0, 0.95, false),
    mecha(1046, 668, -14, 4, 8, 0, 0.95, false),
  ].join('')
}

/** O cavaleiro, a sela, a lança e o escudo. */
function cavaleiro(): string {
  return [
    // manta e sela
    cheio('M398,378C450,386 505,384 545,372C552,400 552,430 545,458C530,470 512,476 495,468C480,478 462,480 446,470C430,478 414,476 404,466C398,440 396,410 398,378Z', DOMO_ALTO),
    friso('M404,456C420,466 432,466 446,460C462,470 478,468 494,458C512,466 528,462 540,450', 4, 0.45),
    vinco('M404,446C420,456 432,456 446,450C462,460 478,458 494,448C512,456 528,452 540,440', 3, 0.3),
    cheio('M425,372C440,355 470,352 492,356C500,344 510,340 518,344C522,356 515,370 505,378C480,386 450,386 425,380Z', DOMO_CUPULA),
    traco('M712,332C660,345 590,335 525,330', 4, 0.86),
    // lança (passa atrás do escudo), copo, ponta e flâmula
    tubo('M395,262L890,402', 14, 0.72, 0.95),
    cheio('M532,281L566,305L566,315L532,321Z', DOMO_CUPULA),
    elipse(532, 301, 5, 20, 0.9),
    mecha(886, 401, 60, 17, 18, 0, 0.9),
    cheio('M826,384C800,360 770,366 742,350L760,368L734,378C764,388 794,388 822,394Z', DOMO_MEIO),
    vinco('M792,374C780,380 770,381 760,380', 3, 0.3),
    // perna, tronco, plumas, elmo, escudo e mão
    membro(465, 365, 34, 515, 410, 28, -4, 0.74),
    membro(515, 410, 24, 506, 468, 20, 2, 0.76),
    circulo(515, 410, 13, DOMO_CUPULA),
    traco('M494,462C494,486 524,486 524,470', 4, 0.82),
    mecha(500, 472, 36, 6, 15, 3, 0.88),
    cheio('M445,365C440,330 448,298 468,280C482,268 505,268 518,280C530,295 528,330 512,366Z', DOMO_ALTO),
    mecha(500, 212, -76, -12, 24, 18, 0.8),
    mecha(496, 218, -80, 22, 20, 12, 0.74),
    cheio('M478,244C476,220 488,206 505,206C522,206 532,220 532,242L532,266C522,274 490,274 480,266Z', DOMO_CUPULA),
    vinco('M496,236H532', 4, 0.5),
    vinco('M516,250h0M524,250h0M516,258h0M524,258h0', 3.5, 0.45),
    friso('M531,218V266', 3, 0.4),
    elipse(494, 286, 24, 18, DOMO_CUPULA, -20),
    cheio('M438,292C462,286 488,286 510,292C512,330 502,360 474,382C446,362 436,330 438,292Z', DOMO_ALTO),
    vinco('M446,298C464,293 484,293 502,298C503,330 495,352 474,370C453,352 445,330 446,298Z', 3, 0.3),
    friso('M452,350L474,318L496,350', 9, 0.5),
    elipse(528, 300, 13, 11, DOMO_CUPULA),
  ].join('')
}

export function relevoCavaleiro(): string {
  return fundo(0.2) + ceuECastelo() + chao() + cavalo() + fera() + cavaleiro()
}
