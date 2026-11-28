/**
 * DRAGÃO (relevo de fábrica): o dragão pousado num rochedo, asas abertas,
 * pescoço em S, cuspindo fogo no alto de uma torre à esquerda; a cauda corre
 * para a direita e termina em ponta de lança. Mapa de altura (ver `comum.ts`).
 */
import {
  DOMO_ALTO,
  DOMO_BAIXO,
  DOMO_CUPULA,
  DOMO_MEIO,
  DOMO_SALIENCIA,
  bossa,
  cheio,
  elipse,
  friso,
  fundo,
  mecha,
  membro,
  naCubica,
  tubo,
  vinco,
} from './comum'

function fundoDistante(): string {
  return [
    cheio('M0,560L70,500L120,526L200,452L262,500L340,470L420,520L520,486L600,520L700,470L790,510L880,462L960,506L1040,480L1120,512L1200,470V720H0Z', 0.27),
    cheio('M560,96C576,74 610,70 632,84C650,64 690,64 706,84C730,78 752,90 748,106L572,112C556,110 552,104 560,96Z', 0.27),
    cheio('M1000,330C1014,312 1044,310 1060,322C1074,308 1104,310 1112,326C1132,324 1146,334 1142,346L1010,350C996,348 994,340 1000,330Z', 0.26),
  ].join('')
}

/** A torre em chamas, à esquerda. */
function torre(): string {
  let pedras = ''
  for (let y = 330; y < 720; y += 34) pedras += `M60,${y}H180`
  for (let y = 330, i = 0; y < 720; y += 34, i++) for (let x = i % 2 === 0 ? 90 : 120; x < 180; x += 60) pedras += `M${x},${y}v34`
  return [
    cheio('M60,720V300H180V720Z', DOMO_MEIO),
    vinco(pedras, 3, 0.2),
    cheio('M52,302V270H74V284H92V270H114V284H130V270H150V284H166V270H188V302Z', 0.64),
    cheio('M108,420V400a12,12 0 0,1 24,0V420Z', 0.3),
    cheio('M108,560V540a12,12 0 0,1 24,0V560Z', 0.3),
    cheio('M98,720V682a22,22 0 0,1 44,0V720Z', 0.3),
    // labaredas no alto da torre
    mecha(84, 272, -14, -70, 30, 14, 0.66),
    mecha(118, 270, 6, -104, 38, -14, 0.72),
    mecha(156, 272, 16, -76, 30, -14, 0.68),
    mecha(100, 272, 10, -50, 18, -8, 0.78),
    mecha(140, 272, -8, -56, 18, 8, 0.78),
  ].join('')
}

/** O jato de fogo da boca até a torre. */
function sopro(): string {
  const p0 = [316, 250] as const
  const p1 = [290, 262] as const
  const p2 = [240, 276] as const
  const p3 = [196, 300] as const
  let linguas = ''
  for (let i = 0; i < 6; i++) {
    const t = 0.1 + i * 0.16
    const [x, y] = naCubica(p0, p1, p2, p3, t)
    const lado = i % 2 === 0 ? 1 : -1
    linguas += mecha(x, y, -34 - i * 4, lado * (10 + i * 3), 18 + i * 3, lado * 10, 0.7)
  }
  return tubo('M316,250C290,262 240,276 196,300', 30, 0.5, 0.7) + linguas
}

function asaDeLa(): string {
  return [
    cheio('M590,345L600,150L520,40Q560,90 610,50Q620,110 680,120Q660,230 660,330Z', 0.34),
    tubo('M590,345L600,150', 14, 0.44, 0.6),
    tubo('M600,150L520,40M600,150L610,50M600,150L680,120', 8, 0.42, 0.56),
  ].join('')
}

function asaDeCa(): string {
  return [
    cheio('M640,340L780,150L850,30Q880,90 960,40Q990,110 1060,110Q1060,180 1120,230Q1000,270 940,320Q880,360 820,385Z', 0.42),
    vinco('M780,150Q840,120 900,64M780,150Q880,140 1000,96M780,150Q900,180 1080,180M780,150Q860,230 1000,270', 4, 0.12),
    friso('M700,300Q760,260 800,240M760,330Q840,300 900,290', 4, 0.12),
    tubo('M640,340C690,270 740,200 780,150', 26, 0.66, 0.92),
    tubo('M780,150L850,30', 12, 0.62, 0.88),
    tubo('M780,150L960,40', 11, 0.62, 0.88),
    tubo('M780,150L1060,110', 10, 0.62, 0.88),
    tubo('M780,150L1120,230', 10, 0.62, 0.88),
    mecha(780, 150, -14, -36, 14, -6, 0.92),
    elipse(780, 150, 14, 13, DOMO_CUPULA),
  ].join('')
}

function cabeca(): string {
  let dentes = ''
  for (const x of [326, 340, 354, 368, 382]) dentes += mecha(x, 221, 0, 12, 7, 0, 0.96, false)
  for (const x of [334, 348, 362, 376]) dentes += mecha(x, 270 - (x - 322) * 0.326, 0, -10, 7, 0, 0.93, false)
  return [
    mecha(410, 168, 56, -64, 18, 8, 0.64),
    cheio('M314,220C344,228 384,232 426,234C396,248 356,262 318,272Z', 0.26),
    dentes,
    cheio('M421,236C396,242 371,250 348,258C334,263 322,268 318,276C334,280 356,276 376,268C398,260 416,250 431,242Z', DOMO_ALTO),
    cheio('M442,196C434,172 412,160 386,162C362,164 340,176 326,190C316,200 310,212 312,220C330,224 352,224 372,226C396,228 420,226 438,218Z', DOMO_CUPULA),
    mecha(330, 186, -4, -20, 12, 4, 0.9),
    mecha(420, 174, 80, -44, 22, 10, 0.86),
    vinco('M450,166l6,12M472,154l5,11', 3, 0.28),
    mecha(436, 226, 40, 8, 16, -6, 0.72),
    mecha(432, 238, 34, 24, 14, -6, 0.68),
    mecha(370, 184, 36, -6, 11, -3, 0.97),
    elipse(386, 193, 7, 5.5, 1),
    vinco('M386,188v10', 2.5, 0.5),
    elipse(320, 204, 4.5, 3, 0.4),
    vinco('M340,212C360,206 380,204 400,208', 2.5, 0.2),
  ].join('')
}

function corpo(): string {
  const corpoD = 'M500,360C540,330 600,320 660,330C720,340 780,370 810,410C835,445 830,490 800,505C760,525 700,525 640,515C580,505 530,480 505,450C490,425 488,385 500,360Z'
  let placas = ''
  for (let i = 0; i < 7; i++) {
    const x = 520 + i * 40
    placas += `M${x},${470 + i * 5}q12,16 6,34`
  }
  let espinhos = ''
  const costas: [number, number, number, number][] = [
    [456, 236, 26, -14],
    [476, 270, 28, -10],
    [500, 306, 28, -14],
    [560, 330, 10, -26],
    [620, 322, 6, -28],
    [690, 330, 10, -26],
    [760, 360, 16, -24],
  ]
  for (const [x, y, dx, dy] of costas) espinhos += mecha(x, y, dx, dy, 18, -4, 0.74)
  return [
    // perna de lá e cauda
    membro(600, 470, 40, 600, 540, 26, -6, 0.5),
    elipse(592, 560, 20, 10, 0.56),
    membro(812, 470, 64, 940, 540, 46, -14, 0.66),
    membro(940, 540, 46, 1060, 590, 32, -10, 0.66),
    membro(1060, 590, 32, 1150, 560, 22, 16, 0.68),
    membro(1150, 560, 22, 1160, 490, 14, 18, 0.7),
    cheio('M1160,494L1136,470L1162,428L1186,472Z', DOMO_CUPULA),
    mecha(900, 516, 12, -26, 14, 4, 0.74),
    mecha(980, 548, 12, -24, 13, 4, 0.74),
    mecha(1060, 572, 6, -22, 12, 4, 0.74),
    espinhos,
    // pescoço em S e corpo escamado
    membro(436, 214, 48, 480, 300, 62, -12, 0.7),
    membro(480, 300, 62, 540, 388, 84, 14, 0.7),
    vinco('M452,262q-14,4 -18,-8M468,296q-16,6 -22,-6M488,330q-16,8 -24,-4M508,362q-16,10 -26,0', 4, 0.2),
    cheio(corpoD, DOMO_ALTO),
    cheio(corpoD, 'url(#rlv-escamas)'),
    vinco(placas, 4, 0.22),
    bossa(745, 470, 62, 56, 0.08),
  ].join('')
}

function patas(): string {
  const garras = (pts: readonly (readonly [number, number, number])[], v: number) => pts.map(([x, y, dx]) => mecha(x, y, dx, 16, 8, -3, v, false)).join('')
  return [
    // dianteira de cá, agarrada ao rochedo
    membro(560, 450, 50, 540, 520, 32, 6, 0.7),
    membro(540, 520, 28, 508, 560, 22, -4, 0.74),
    elipse(500, 566, 22, 12, DOMO_CUPULA),
    garras([[482, 570, -10], [492, 574, -6], [504, 576, -2]], 0.95),
    // traseira de cá
    elipse(745, 470, 62, 56, DOMO_SALIENCIA, -10),
    membro(760, 505, 40, 772, 560, 28, -6, 0.72),
    membro(772, 560, 26, 752, 592, 24, 0, 0.74),
    elipse(744, 598, 26, 11, DOMO_CUPULA),
    garras([[722, 602, -10], [732, 606, -6], [744, 608, -2]], 0.95),
  ].join('')
}

function rochedo(): string {
  return [
    cheio('M380,720L400,640C412,608 440,596 470,594L510,568C560,554 600,560 640,574L700,558C760,550 830,568 862,594L900,640L920,720Z', DOMO_BAIXO),
    vinco('M470,594L500,650L480,720M640,574L620,640L650,720M700,558L730,630M862,594L830,660M560,600L580,680', 4, 0.25),
    friso('M412,612C430,600 450,596 470,594M704,560C740,554 780,556 820,566', 3, 0.2),
  ].join('')
}

export function relevoDragao(): string {
  return fundo(0.2) + fundoDistante() + torre() + asaDeLa() + asaDeCa() + rochedo() + sopro() + corpo() + patas() + cabeca()
}
