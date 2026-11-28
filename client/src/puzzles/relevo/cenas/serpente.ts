/**
 * SERPENTE MARINHA (relevo de fábrica): a serpente sai do mar em duas corcovas,
 * a cauda de barbatana à esquerda e o pescoço subindo à direita até a cabeça de
 * boca aberta, crista em leque, sobre um barquinho à vela; lua cheia e nuvens no
 * céu, ondas na frente. Mapa de altura (ver `comum.ts`).
 */
import { DOMO_ALTO, DOMO_BAIXO, DOMO_CUPULA, DOMO_MEIO, bossa, cheio, circulo, elipse, espiral, friso, fundo, mecha, membro, naCubica, num, tubo, vinco } from './comum'

type Ponto = readonly [number, number]

/** Espinhos ao longo de uma corcova (cúbica), apontando para fora da curva. */
function espinhosNaCurva(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, n: number, tamanho: number): string {
  let s = ''
  for (let i = 0; i < n; i++) {
    const t = 0.16 + (i * 0.68) / (n - 1)
    const [x, y] = naCubica(p0, p1, p2, p3, t)
    const [xa, ya] = naCubica(p0, p1, p2, p3, t + 0.01)
    const comp = Math.hypot(xa - x, ya - y) || 1
    const nx = (ya - y) / comp
    const ny = -(xa - x) / comp
    s += mecha(x + nx * 22, y + ny * 22, nx * tamanho - (xa - x) / comp * 8, ny * tamanho - (ya - y) / comp * 8, 16, 4, 0.8)
  }
  return s
}

/**
 * Escamas ao longo de um tubo (cúbica): meias-luas em fileiras, viradas para a
 * cabeça. Desenhadas como traço comum (padrão como cor de traço custaria uma
 * compilação de shader só para esta cena).
 */
function escamasNoTubo(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, largura: number): string {
  let d = ''
  const passos = 26
  for (let i = 1; i < passos; i++) {
    const t = i / passos
    const [x, y] = naCubica(p0, p1, p2, p3, t)
    const [xa, ya] = naCubica(p0, p1, p2, p3, t + 0.004)
    const comp = Math.hypot(xa - x, ya - y) || 1
    const tx = (xa - x) / comp
    const ty = (ya - y) / comp
    for (const f of i % 2 === 0 ? [-0.3, 0, 0.3] : [-0.15, 0.15]) {
      const cx = x - ty * largura * f
      const cy = y + tx * largura * f
      const r = largura * 0.12
      d += `M${num(cx - ty * r)},${num(cy + tx * r)}Q${num(cx + tx * r * 1.4)},${num(cy + ty * r * 1.4)} ${num(cx + ty * r)},${num(cy - tx * r)}`
    }
  }
  return vinco(d, 2.2, 0.3)
}

function ceu(): string {
  return [
    circulo(140, 118, 70, DOMO_MEIO),
    bossa(120, 100, 16, 14, -0.14),
    bossa(166, 142, 12, 10, -0.14),
    bossa(152, 92, 8, 8, -0.12),
    bossa(104, 146, 10, 8, -0.12),
    cheio('M330,96C350,64 400,56 430,74C454,48 508,50 524,76C556,70 586,88 580,110L344,118C326,114 322,104 330,96Z', DOMO_BAIXO),
    cheio('M560,170C576,146 612,140 636,156C656,134 700,136 714,158C740,154 760,168 754,186L572,192C556,190 552,180 560,170Z', DOMO_BAIXO),
    vinco(`${espiral(476, 84, 3, 18, 1.4, 0)}${espiral(660, 164, 3, 16, 1.4, 0)}`, 3.5, 0.25),
  ].join('')
}

function marDeTras(): string {
  return [
    cheio('M0,500C100,490 200,510 300,500C400,490 500,512 600,502C700,492 800,510 900,500C1000,490 1100,508 1200,498V720H0Z', 0.3),
    vinco('M40,540C120,530 200,550 280,540M420,556C520,546 620,562 720,552M860,540C940,532 1040,548 1140,540', 4, 0.18),
  ].join('')
}

function barco(): string {
  return [
    cheio('M1092,320L1036,452L1090,458Z', DOMO_MEIO),
    cheio('M1100,306L1172,450L1100,456Z', DOMO_MEIO),
    tubo('M1096,478V296', 8, 0.62, 0.86),
    mecha(1096, 298, -28, -6, 9, 4, 0.8),
    cheio('M1020,468C1050,484 1130,484 1172,464L1162,498C1130,512 1060,512 1032,498Z', DOMO_ALTO),
    friso('M1024,472C1060,486 1126,486 1168,468', 3, 0.35),
    vinco('M1036,488C1070,498 1126,498 1158,486', 3, 0.25),
  ].join('')
}

function serpente(): string {
  const corcovaA = 'M570,532C590,352 770,352 790,532'
  const corcovaB = 'M252,532C270,404 412,404 430,532'
  const pescoco = 'M866,560C874,430 884,330 902,272C918,224 938,184 972,160'
  let dentes = ''
  for (const x of [1078, 1062, 1046, 1030]) dentes += mecha(x, 161, 0, 14, 7, 0, 0.96, false)
  for (const x of [1070, 1054, 1038]) dentes += mecha(x, 208 - (1090 - x) * 0.3, 0, -12, 7, 0, 0.93, false)
  return [
    // cauda de barbatana
    membro(196, 534, 40, 142, 452, 26, 10, 0.66),
    mecha(142, 456, -66, -80, 48, 12, 0.74),
    mecha(142, 456, -88, -12, 40, -12, 0.72),
    vinco('M128,436L92,392M120,444L80,410M128,452L72,440M126,460L74,466', 3, 0.22),
    // corcovas escamadas, com espinhos
    tubo(corcovaB, 52, 0.6, 0.88),
    escamasNoTubo([252, 532], [270, 404], [412, 404], [430, 532], 52),
    espinhosNaCurva([252, 532], [270, 404], [412, 404], [430, 532], 5, 26),
    tubo(corcovaA, 64, 0.6, 0.9),
    escamasNoTubo([570, 532], [590, 352], [770, 352], [790, 532], 64),
    espinhosNaCurva([570, 532], [590, 352], [770, 352], [790, 532], 6, 30),
    // pescoço e crista
    cheio('M962,140L900,60L940,96L940,40L970,92L990,52L996,112Z', 0.5),
    tubo('M970,142L902,62M974,140L942,42M980,138L990,54', 8, 0.62, 0.86),
    tubo(pescoco, 74, 0.6, 0.9),
    escamasNoTubo([866, 560], [874, 430], [884, 330], [902, 272], 74),
    escamasNoTubo([902, 272], [918, 224], [938, 184], [972, 160], 66),
    vinco('M874,520q22,4 30,-6M878,470q22,6 30,-4M884,420q22,6 30,-2M890,370q20,8 30,0M900,320q20,8 28,2', 4, 0.2),
    // cabeça de boca aberta, virada para o barco
    cheio('M1092,160C1062,168 1024,172 984,174C1014,188 1054,200 1090,212Z', 0.26),
    dentes,
    cheio('M988,176C1012,182 1037,190 1060,198C1074,203 1086,208 1090,216C1074,220 1052,216 1032,208C1010,200 992,190 980,184Z', DOMO_ALTO),
    cheio('M950,150C956,124 978,110 1004,108C1030,106 1056,118 1074,132C1086,142 1096,152 1094,160C1076,164 1054,164 1032,166C1008,168 984,168 962,162Z', DOMO_CUPULA),
    mecha(996, 122, 36, -8, 11, 3, 0.97),
    elipse(1012, 132, 8, 6, 1),
    vinco('M1003,132a9,7 0 1,0 18,0a9,7 0 1,0 -18,0', 2.5, 0.4),
    vinco('M1012,127v10', 2.5, 0.5),
    elipse(1084, 142, 4, 3, 0.42),
    mecha(1090, 172, 32, 30, 8, -8, 0.74),
    mecha(1084, 178, 16, 46, 8, -10, 0.7),
  ].join('')
}

function marDaFrente(): string {
  let cristas = ''
  for (let x = -40; x < 1200; x += 190) {
    cristas += cheio(`M${x},720C${x + 36},670 ${x + 100},640 ${x + 156},650C${x + 128},656 ${x + 120},674 ${x + 138},684C${x + 156},692 ${x + 174},680 ${x + 180},670L${x + 194},720Z`, DOMO_ALTO)
    cristas += mecha(x + 156, 652, 24, 8, 10, -6, 0.9)
  }
  let respingos = ''
  for (const [x, y, dx, dy] of [
    [246, 530, -18, -24],
    [436, 530, 18, -24],
    [564, 530, -20, -28],
    [796, 530, 20, -28],
    [836, 540, -22, -30],
    [902, 540, 24, -26],
  ] as const)
    respingos += mecha(x, y, dx, dy, 12, 6, 0.84)
  return [
    cheio('M0,540C80,526 160,548 240,536C320,524 420,550 500,538C600,524 700,552 800,540C900,528 1000,550 1200,532V720H0Z', DOMO_BAIXO),
    respingos,
    circulo(240, 500, 4, 0.84),
    circulo(450, 502, 5, 0.84),
    circulo(820, 506, 4, 0.84),
    circulo(920, 510, 5, 0.84),
    cristas,
  ].join('')
}

export function relevoSerpente(): string {
  return fundo(0.2) + ceu() + marDeTras() + barco() + serpente() + marDaFrente()
}
