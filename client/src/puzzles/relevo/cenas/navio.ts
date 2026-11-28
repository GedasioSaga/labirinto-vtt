/**
 * NAVIO NA TEMPESTADE (relevo de fábrica): um galeão de três mastros adernado
 * no mar bravo, velas cheias; à esquerda uma onda que quebra, no alto nuvens em
 * espiral e um raio, à direita um farol no rochedo. Mapa de altura (ver
 * `comum.ts`).
 */
import { DOMO_ALTO, DOMO_BAIXO, DOMO_CUPULA, DOMO_MEIO, cheio, circulo, espiral, friso, fundo, mecha, traco, tubo, vinco } from './comum'

function ceu(): string {
  let chuva = ''
  for (let i = 0; i < 16; i++) {
    const x = 1060 + ((i * 47) % 150)
    const y = 120 + ((i * 83) % 240)
    chuva += `M${x},${y}l-14,40`
  }
  return [
    // nuvem em espiral no canto e a faixa de nuvens
    cheio('M0,0H330V96C300,132 240,150 186,136C140,168 64,166 0,140Z', DOMO_MEIO),
    vinco(espiral(160, 66, 6, 62, 2.2, 200), 5, 0.3),
    cheio('M300,0H1200V64C1150,94 1080,100 1040,80C990,108 920,104 880,76C820,100 760,96 720,70C660,94 590,88 560,64C520,88 440,84 400,60C360,78 320,74 300,64Z', DOMO_BAIXO),
    vinco(`${espiral(460, 36, 4, 24, 1.5, 0)}${espiral(780, 46, 4, 26, 1.5, 0)}${espiral(1120, 40, 4, 26, 1.5, 0)}`, 4, 0.25),
    // o raio
    cheio('M1010,0L980,70L1006,66L968,150L1000,140L952,236L1018,128L990,134L1030,58L1004,62L1034,0Z', DOMO_CUPULA),
    vinco(chuva, 2.5, 0.22),
  ].join('')
}

function farol(): string {
  return [
    cheio('M1050,288L930,256L936,302Z', 0.3),
    cheio('M1094,288L1200,262L1200,304Z', 0.3),
    cheio('M944,560C960,520 990,500 1030,500L1090,488C1140,492 1180,512 1200,530V600H944Z', DOMO_BAIXO),
    vinco('M1000,512L990,560M1120,494L1132,560', 4, 0.25),
    cheio('M1036,500L1050,316L1094,316L1108,500Z', DOMO_MEIO),
    vinco('M1040,452H1104M1044,404H1100M1047,356H1097', 5, 0.22),
    cheio('M1032,318H1112V304H1032Z', 0.72),
    cheio('M1050,304V272H1094V304Z', 0.66),
    vinco('M1062,276v24M1072,276v24M1082,276v24', 2.5, 0.3),
    cheio('M1044,274Q1072,234 1100,274Z', DOMO_CUPULA),
    circulo(1072, 236, 5, 0.9),
    cheio('M1062,500V474a10,10 0 0,1 20,0V500Z', 0.36),
  ].join('')
}

/** Vela enfunada: topo reto na verga, barriga para a frente (esquerda) e para baixo. */
function vela(x1: number, x2: number, y1: number, y2: number): string {
  const d = `M${x1},${y1}H${x2}C${x2 - 8},${(y1 * 2 + y2) / 3} ${x2 - 14},${(y1 + 2 * y2) / 3} ${x2 - 22},${y2}Q${(x1 + x2) / 2 - 10},${y2 + 18} ${x1 - 24},${y2}C${x1 - 32},${(y1 + 2 * y2) / 3} ${x1 - 24},${(y1 * 2 + y2) / 3} ${x1},${y1}Z`
  const passo = (x2 - x1) / 4
  let costuras = ''
  for (let i = 1; i < 4; i++) costuras += `M${x1 + passo * i},${y1 + 4}q-8,${(y2 - y1) / 2} -14,${y2 - y1 - 6}`
  return cheio(d, DOMO_ALTO) + vinco(costuras, 2.5, 0.16) + vinco(`M${x1 + 6},${y1 + 10}H${x2 - 6}`, 2, 0.14)
}

function galeao(): string {
  let portinholas = ''
  for (let x = 470; x <= 770; x += 50) portinholas += `M${x},${452 - (x - 470) * 0.05}h13v11h-13z`
  return [
    '<g transform="rotate(-5 620 470)">',
    // gurupés, mastros e cordame
    tubo('M392,396L262,318', 10, 0.62, 0.88),
    traco('M480,112L392,396M620,64L392,410M620,64L872,330M760,140L884,330M266,320L480,112', 2, 0.62),
    tubo('M480,430V112', 12, 0.64, 0.9),
    tubo('M620,430V64', 14, 0.64, 0.9),
    tubo('M760,410V140', 12, 0.64, 0.9),
    // bujarrona e velas
    cheio('M276,326L474,142L440,388Z', DOMO_MEIO),
    vela(418, 542, 150, 240),
    vela(404, 556, 252, 372),
    vela(558, 682, 96, 186),
    vela(538, 702, 196, 290),
    vela(530, 710, 300, 400),
    vela(708, 812, 170, 262),
    vela(698, 822, 272, 380),
    tubo('M412,150H548M398,252H562M552,96H688M532,196H708M524,300H716M702,170H818M692,272H828', 8, 0.62, 0.88),
    // flâmulas ao vento
    mecha(480, 112, -72, 6, 14, -10, 0.78),
    mecha(620, 64, -98, 4, 16, -12, 0.8),
    mecha(760, 140, -64, 8, 12, -8, 0.76),
    // casco, castelos, tábuas e portinholas
    cheio('M378,418C430,428 520,432 600,430C680,428 760,420 846,404L884,394C890,430 868,486 818,516C730,546 580,550 480,536C432,528 404,496 392,466C384,448 380,432 378,418Z', DOMO_ALTO),
    cheio('M780,412L784,336L872,326L892,342L884,398Z', DOMO_ALTO),
    cheio('M386,424L392,388L462,392L466,428Z', DOMO_ALTO),
    cheio('M800,352h14v16h-14zM826,350h14v16h-14zM852,347h14v16h-14z', 0.34),
    friso('M392,420C500,430 700,428 846,406M784,338L872,328', 4, 0.4),
    vinco('M392,456C500,470 700,466 872,436M402,486C520,500 700,496 856,468M424,512C540,526 700,520 826,500', 3, 0.26),
    cheio(portinholas, 0.36),
    mecha(384, 420, -32, -20, 16, 8, 0.88),
    '</g>',
  ].join('')
}

function mar(): string {
  let cristas = ''
  for (let x = -60; x < 1200; x += 210) {
    cristas += cheio(`M${x},720C${x + 40},664 ${x + 110},632 ${x + 172},642C${x + 142},648 ${x + 132},668 ${x + 152},678C${x + 172},686 ${x + 192},672 ${x + 198},662L${x + 214},720Z`, DOMO_ALTO)
    cristas += mecha(x + 172, 644, 26, 8, 10, -6, 0.9) + mecha(x + 160, 640, 22, -6, 9, -6, 0.88)
  }
  let espuma = ''
  for (const [x, y, dx, dy] of [
    [334, 334, 34, 18],
    [318, 320, 32, 6],
    [300, 308, 30, -4],
    [280, 298, 26, -12],
    [258, 290, 22, -16],
  ] as const)
    espuma += mecha(x, y, dx, dy, 13, -8, 0.9)
  let gotas = ''
  for (const [x, y, r] of [
    [372, 300, 6],
    [392, 286, 4],
    [356, 286, 4],
    [880, 520, 5],
    [904, 504, 4],
    [360, 520, 5],
  ] as const)
    gotas += circulo(x, y, r, 0.86)
  return [
    // vagas atrás do navio
    cheio('M240,600C300,560 380,540 460,548C560,560 640,530 740,528C840,526 900,556 980,560C1060,564 1120,540 1200,536V720H240Z', DOMO_MEIO),
    vinco('M300,590C400,570 500,580 600,570M700,560C800,556 900,580 1000,584', 4, 0.2),
  ].join('') + galeao() + [
    // a onda que quebra, à esquerda
    cheio('M0,720V470C30,380 100,300 200,282C270,270 330,292 350,340C330,320 300,312 278,322C255,334 258,362 280,372C300,380 318,370 322,356C330,392 300,432 270,462C232,500 214,560 230,620L246,720Z', DOMO_ALTO),
    vinco('M20,520C60,440 120,380 200,350M30,600C70,520 130,460 210,430M60,690C90,600 150,540 222,510', 4, 0.22),
    espuma,
    gotas,
    cristas,
  ].join('')
}

export function relevoNavio(): string {
  return fundo(0.2) + ceu() + farol() + mar()
}
