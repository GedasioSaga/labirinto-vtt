/**
 * SOL E LUA (relevo de fábrica): à esquerda o sol de rosto sereno com raios
 * retos e ondulados; à direita a lua crescente de perfil, olhos fechados,
 * virada para o sol; estrelas espalhadas e nuvens de volutas embaixo. Mapa de
 * altura (ver `comum.ts`).
 */
import { DOMO_ALTO, DOMO_CUPULA, DOMO_MEIO, alt, bossa, cheio, circulo, espiral, estrela, friso, fundo, mecha, membro, num, polar, vinco } from './comum'

const SOL = [300, 360] as const

function sol(): string {
  const [cx, cy] = SOL
  let raios = ''
  for (let i = 0; i < 16; i++) {
    const a = i * 22.5 - 90 + 11.25
    if (i % 2 === 0) {
      const [x1, y1] = polar(cx, cy, 146, a - 7)
      const [x2, y2] = polar(cx, cy, 266, a)
      const [x3, y3] = polar(cx, cy, 146, a + 7)
      raios += `<polygon points="${num(x1)},${num(y1)} ${num(x2)},${num(y2)} ${num(x3)},${num(y3)}" fill="${alt(0.74)}"/>`
      const [xm, ym] = polar(cx, cy, 150, a)
      raios += `<path d="M${num(xm)},${num(ym)}L${num(x2)},${num(y2)}" stroke="#fff" stroke-opacity="0.18" stroke-width="4"/>`
    } else {
      const [x, y] = polar(cx, cy, 140, a)
      const [dx, dy] = polar(0, 0, 100, a)
      raios += mecha(x, y, dx, dy, 34, 18, 0.66)
    }
  }
  return [
    raios,
    circulo(cx, cy, 150, 0.56),
    friso(`M${cx - 140},${cy}a140,140 0 1,0 280,0a140,140 0 1,0 -280,0`, 6, 0.3),
    circulo(cx, cy, 128, DOMO_CUPULA),
    // rosto sereno
    mecha(236, 322, 52, -4, 12, -6, 0.95),
    mecha(364, 322, -52, -4, 12, 6, 0.95),
    cheio('M232,346Q258,330 284,346Q258,356 232,346Z', 0.98),
    cheio('M316,346Q342,330 368,346Q342,356 316,346Z', 0.98),
    vinco('M230,346Q258,326 286,346Q258,358 230,346ZM314,346Q342,326 370,346Q342,358 314,346Z', 2.5, 0.35),
    circulo(258, 344, 6, 0.7),
    circulo(342, 344, 6, 0.7),
    membro(300, 340, 14, 300, 394, 24, 0, 0.9),
    vinco('M290,398q10,6 20,0', 3, 0.35),
    bossa(242, 394, 30, 24, 0.1),
    bossa(358, 394, 30, 24, 0.1),
    cheio('M262,424Q300,450 338,424Q300,436 262,424Z', 0.92),
    vinco('M262,424Q300,444 338,424', 3, 0.4),
    bossa(300, 458, 30, 14, 0.08),
  ].join('')
}

function lua(): string {
  return [
    cheio('M780,150A196,196 0 1,1 780,530C840,512 876,470 884,428C874,418 864,412 858,408C864,402 865,394 857,388L838,366C853,354 863,342 863,326C863,298 856,256 836,222C818,190 800,166 780,150Z', DOMO_ALTO),
    bossa(910, 372, 32, 28, 0.12),
    bossa(940, 260, 40, 50, 0.06),
    mecha(872, 284, 46, -8, 11, -4, 0.95),
    cheio('M874,302Q892,292 910,302Q892,309 874,302Z', 0.98),
    vinco('M874,302Q892,312 910,302M880,308l-4,7M890,310l-2,8M900,309l0,8', 2.5, 0.4),
    vinco('M858,408C870,414 878,420 884,428', 3, 0.3),
    friso('M820,170A176,176 0 0,1 820,510', 4, 0.18),
  ].join('')
}

function estrelasENuvens(): string {
  let pontos = ''
  for (const [x, y] of [
    [700, 200],
    [760, 80],
    [1040, 470],
    [470, 620],
    [980, 650],
    [560, 60],
    [1160, 300],
  ] as const)
    pontos += circulo(x, y, 4.5, 0.8)
  const nuvem = 'M380,640C380,596 430,576 468,596C484,556 548,548 574,584C600,560 660,566 668,604C704,598 734,624 724,652C744,670 732,700 700,700L400,700C368,696 360,664 380,640Z'
  const nuvem2 = 'M40,650C40,620 76,604 104,618C118,592 166,588 184,614C206,600 246,610 248,636C272,640 282,664 266,682L60,686C36,684 30,664 40,650Z'
  return [
    estrela(620, 110, 40, 14, 8, DOMO_CUPULA),
    estrela(1120, 100, 30, 11, 8, DOMO_CUPULA),
    estrela(1110, 610, 34, 12, 8, DOMO_CUPULA),
    estrela(650, 470, 24, 9, 8, DOMO_CUPULA),
    estrela(560, 250, 18, 7, 8, 0.8),
    pontos,
    cheio(nuvem, DOMO_MEIO),
    vinco(`${espiral(470, 622, 3, 24, 1.5, 0)}${espiral(560, 600, 3, 22, 1.5, 0)}${espiral(650, 628, 3, 20, 1.5, 0)}`, 4, 0.26),
    cheio(nuvem2, DOMO_MEIO),
    vinco(`${espiral(110, 640, 3, 20, 1.5, 0)}${espiral(190, 640, 3, 18, 1.5, 0)}`, 4, 0.26),
  ].join('')
}

export function relevoSolELua(): string {
  return fundo(0.2) + sol() + lua() + estrelasENuvens()
}
