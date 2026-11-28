/**
 * FERRAMENTAS DO RELEVO (28/11): cada cena é desenhada como um MAPA DE ALTURA
 * em cinza (preto = o fundo mais baixo, branco = o ponto mais alto). O filtro do
 * metal (`arte.ts`) lê o cinza como altura, acende com luz de cima à esquerda e
 * pinta o metal; aqui só se desenha forma e altura, nunca cor.
 *
 * As cenas moram em coordenadas locais de 1200 x 720 (a `AREA_DO_RELEVO`); o
 * painel as desloca para o lugar.
 */

/** Uma altura (0 a 1) ou uma tinta pronta (`url(#…)` de um degradê de domo). */
export type Tinta = number | string

/** Altura 0..1 em cinza hexadecimal. */
export function alt(v: number): string {
  const n = Math.round(Math.min(1, Math.max(0, v)) * 255)
  const h = n.toString(16).padStart(2, '0')
  return `#${h}${h}${h}`
}

/** Número curto para o SVG (uma casa decimal). */
export const num = (v: number): string => String(Math.round(v * 10) / 10)

/**
 * DOMOS: a forma sobe da borda para o meio. Não são degradês (o primeiro
 * degradê radial custa ~155 ms de compilação de shader no Edge frio): são
 * faixas por erosão — a forma recortada por ela mesma, com traços largos e
 * mais baixos na borda —, que seguem o contorno como um repuxado de verdade.
 */
interface Domo {
  centro: number
  borda: number
}
export const DOMO_ALTO = 'domo:alto'
export const DOMO_MEIO = 'domo:meio'
export const DOMO_BAIXO = 'domo:baixo'
export const DOMO_CUPULA = 'domo:cupula'
/**
 * Músculo sobre um corpo já alto (anca, quadril): a borda nasce na altura do
 * corpo, então sobe sem cavar um sulco em volta (o sulco lia como roda ou disco).
 */
export const DOMO_SALIENCIA = 'domo:saliencia'
const DOMOS: Readonly<Record<string, Domo>> = {
  [DOMO_ALTO]: { centro: 0.95, borda: 0.64 },
  [DOMO_MEIO]: { centro: 0.74, borda: 0.5 },
  [DOMO_BAIXO]: { centro: 0.5, borda: 0.33 },
  [DOMO_CUPULA]: { centro: 1, borda: 0.7 },
  [DOMO_SALIENCIA]: { centro: 1, borda: 0.9 },
}

/** Tinta plana: altura em cinza, o centro de um domo, ou a tinta pronta (padrão). */
const tinta = (v: Tinta): string => (typeof v === 'number' ? alt(v) : DOMOS[v] ? alt(DOMOS[v].centro) : v)

/** As alturas das quatro faixas de um domo, da borda ao centro. */
function faixas(d: Domo): [string, string, string, string] {
  const p = (t: number) => alt(d.borda + (d.centro - d.borda) * t)
  return [p(0), p(0.5), p(0.8), p(1)]
}

let contadorDeDomos = 0
/** Zera a numeração dos domos: o painel chama no começo, para os ids saírem iguais sempre. */
export function reiniciarDomos(): void {
  contadorDeDomos = 0
}

/** Caixa aproximada de um caminho (M L C Q S T H V A Z, absolutos e relativos). */
function caixaDoCaminho(d: string): { x0: number; y0: number; x1: number; y1: number } {
  const partes = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  let x = 0
  let y = 0
  let cmd = 'M'
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const marca = () => {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  const aridade: Record<string, number> = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 }
  let i = 0
  while (i < partes.length) {
    const t = partes[i]
    if (/[a-zA-Z]/.test(t)) {
      cmd = t
      i++
      if (cmd === 'Z' || cmd === 'z') continue
    }
    const n = aridade[cmd.toUpperCase()] ?? 2
    const v = partes.slice(i, i + n).map(Number)
    if (v.length < n || n === 0) break
    i += n
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    if (C === 'H') x = rel ? x + v[0] : v[0]
    else if (C === 'V') y = rel ? y + v[0] : v[0]
    else {
      const nx = v[n - 2]
      const ny = v[n - 1]
      x = rel ? x + nx : nx
      y = rel ? y + ny : ny
    }
    marca()
  }
  return { x0, y0, x1, y1 }
}

/** Domo por erosão num caminho qualquer: recorte nele mesmo e traços da borda para dentro. */
function domoNoCaminho(d: string, domo: Domo): string {
  const n = contadorDeDomos++
  const { x0, y0, x1, y1 } = caixaDoCaminho(d)
  const lado = Math.min(x1 - x0, y1 - y0)
  const w = Math.min(70, Math.max(6, lado * 0.3))
  const [b, m, a, c] = faixas(domo)
  const u = (extra: string) => `<use href="#rlv-p${n}" ${extra}/>`
  return (
    `<defs><path id="rlv-p${n}" d="${d}"/><clipPath id="rlv-k${n}"><use href="#rlv-p${n}"/></clipPath></defs>` +
    `<g clip-path="url(#rlv-k${n})" stroke-linejoin="round">${u(`fill="${c}"`)}${u(`fill="none" stroke="${a}" stroke-width="${num(w * 3.2)}"`)}${u(`fill="none" stroke="${m}" stroke-width="${num(w * 2)}"`)}${u(`fill="none" stroke="${b}" stroke-width="${num(w)}"`)}</g>`
  )
}

/** Os padrões de textura, uma vez por painel. */
export function defsDeAltura(): string {
  return [
    // Escamas: meias-luas escuras em quincunce; vão como `fill` por cima de um corpo.
    `<pattern id="rlv-escamas" patternUnits="userSpaceOnUse" width="22" height="16"><path d="M0,9Q5.5,1 11,9M11,9Q16.5,1 22,9M-5.5,17Q0,9 5.5,17M5.5,17Q11,9 16.5,17M16.5,17Q22,9 27.5,17" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="2"/></pattern>`,
    // Pelo e penas: riscos finos em diagonal.
    `<pattern id="rlv-pelo" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(28)"><path d="M0,4.5H9" stroke="#000" stroke-opacity="0.13" stroke-width="1.6"/></pattern>`,
  ].join('')
}

/** Caminho cheio (com `DOMO_*`, sobe da borda para o meio). */
export function cheio(d: string, v: Tinta, extra = ''): string {
  const domo = typeof v === 'string' ? DOMOS[v] : undefined
  return domo ? domoNoCaminho(d, domo) : `<path d="${d}" fill="${tinta(v)}"${extra}/>`
}

/** Elipse (com `DOMO_*`, quatro elipses empilhadas, da borda ao centro). */
export function elipse(cx: number, cy: number, rx: number, ry: number, v: Tinta, giro = 0): string {
  const g = giro ? ` transform="rotate(${num(giro)} ${num(cx)} ${num(cy)})"` : ''
  const uma = (f: number, t: string) => `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx * f)}" ry="${num(ry * f)}" fill="${t}"${g}/>`
  const domo = typeof v === 'string' ? DOMOS[v] : undefined
  if (!domo) return uma(1, tinta(v))
  const [b, m, a, c] = faixas(domo)
  return uma(1, b) + uma(0.8, m) + uma(0.58, a) + uma(0.34, c)
}

export const circulo = (cx: number, cy: number, r: number, v: Tinta): string => elipse(cx, cy, r, r, v)

/** Traço redondo numa altura. */
export const traco = (d: string, largura: number, v: Tinta): string =>
  `<path d="${d}" fill="none" stroke="${tinta(v)}" stroke-width="${num(largura)}" stroke-linecap="round" stroke-linejoin="round"/>`

/**
 * Tubo: o mesmo traço empilhado do largo-baixo ao fino-alto; depois do filtro
 * vira um cilindro (perna, cauda, mastro, lança, voluta).
 */
export function tubo(d: string, largura: number, baixo: number, alto: number): string {
  const p = (t: number) => baixo + (alto - baixo) * t
  return traco(d, largura, baixo) + traco(d, largura * 0.74, p(0.4)) + traco(d, largura * 0.48, p(0.75)) + traco(d, largura * 0.22, alto)
}

/**
 * Membro afinado: de (x1, y1) com largura `w1` até (x2, y2) com largura `w2`,
 * curvado por `curva` (como na `mecha`), pontas redondas; três andares para o
 * filtro arredondar (coxa, canela, pescoço, cauda que afina).
 */
export function membro(x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, curva: number, v: number): string {
  const comp = Math.hypot(x2 - x1, y2 - y1) || 1
  const px = -(y2 - y1) / comp
  const py = (x2 - x1) / comp
  const cx = (x1 + x2) / 2 + px * curva
  const cy = (y1 + y2) / 2 + py * curva
  const forma = (f: number, t: number): string => {
    const a = (w1 / 2) * f
    const b = (w2 / 2) * f
    const m = ((w1 + w2) / 4) * f
    return `<path d="M${num(x1 + px * a)},${num(y1 + py * a)}Q${num(cx + px * m)},${num(cy + py * m)} ${num(x2 + px * b)},${num(y2 + py * b)}A${num(b)},${num(b)} 0 0,0 ${num(x2 - px * b)},${num(y2 - py * b)}Q${num(cx - px * m)},${num(cy - py * m)} ${num(x1 - px * a)},${num(y1 - py * a)}A${num(a)},${num(a)} 0 0,0 ${num(x1 + px * a)},${num(y1 + py * a)}Z" fill="${alt(t)}"/>`
  }
  return forma(1, v) + forma(0.66, v + 0.07) + forma(0.3, v + 0.13)
}

/** Vinco: escurece (afunda) o que estiver embaixo, na proporção — sulco, pelo, dobra. */
export const vinco = (d: string, largura: number, forca = 0.3): string =>
  `<path d="${d}" fill="none" stroke="#000" stroke-opacity="${forca}" stroke-width="${num(largura)}" stroke-linecap="round" stroke-linejoin="round"/>`

/** Friso: clareia (levanta) o que estiver embaixo — borda, costura, nervura. */
export const friso = (d: string, largura: number, forca = 0.3): string =>
  `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${forca}" stroke-width="${num(largura)}" stroke-linecap="round" stroke-linejoin="round"/>`

/** Mancha que clareia ou escurece uma forma sem mudar o contorno (dobra, músculo). */
export const sombra = (d: string, forca: number): string =>
  `<path d="${d}" fill="${forca > 0 ? '#fff' : '#000'}" fill-opacity="${Math.round(Math.abs(forca) * 100) / 100}"/>`

/** Ponto sobre uma cúbica (para enfileirar mechas ao longo de um contorno). */
export function naCubica(p0: readonly [number, number], p1: readonly [number, number], p2: readonly [number, number], p3: readonly [number, number], t: number): [number, number] {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]
}

/** Tufo de capim: três folhas em leque a partir do chão. */
export function tufo(x: number, y: number, v: number, escala = 1): string {
  const e = escala
  return mecha(x, y, -9 * e, -24 * e, 6 * e, -4 * e, v, false) + mecha(x, y, 1 * e, -30 * e, 6 * e, 2 * e, v + 0.02, false) + mecha(x, y, 10 * e, -22 * e, 6 * e, 4 * e, v, false)
}

/** Bossa: elipse que levanta (forca > 0) ou afunda (< 0) o que estiver embaixo — bochecha, joelho, músculo. */
export const bossa = (cx: number, cy: number, rx: number, ry: number, forca: number, giro = 0): string =>
  `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}" fill="${forca > 0 ? '#fff' : '#000'}" fill-opacity="${Math.round(Math.abs(forca) * 100) / 100}"${giro ? ` transform="rotate(${num(giro)} ${num(cx)} ${num(cy)})"` : ''}/>`

/**
 * Mecha: forma afinada e curva da base (x, y) até a ponta (x + dx, y + dy).
 * Serve para crina, chama, pena, garra, dente, raio, espinho e folha. `curva`
 * empurra o meio para o lado (positivo = sentido horário na tela, isto é, à
 * direita de quem anda da base à ponta). Com altura numérica ganha uma
 * nervura no meio, mais alta.
 */
export function mecha(x: number, y: number, dx: number, dy: number, largura: number, curva: number, v: Tinta, nervura = true): string {
  const comp = Math.hypot(dx, dy) || 1
  const px = -dy / comp
  const py = dx / comp
  const cx = x + dx / 2 + px * curva
  const cy = y + dy / 2 + py * curva
  const forma = (m: number, t: Tinta): string =>
    `<path d="M${num(x + px * m)},${num(y + py * m)}Q${num(cx + px * m * 0.55)},${num(cy + py * m * 0.55)} ${num(x + dx)},${num(y + dy)}Q${num(cx - px * m * 0.55)},${num(cy - py * m * 0.55)} ${num(x - px * m)},${num(y - py * m)}Z" fill="${tinta(t)}"/>`
  let s = forma(largura / 2, v)
  if (nervura && typeof v === 'number') s += forma(largura * 0.2, Math.min(1, v + 0.12))
  return s
}

/** Ponto em coordenadas polares (graus, 0 = para a direita, sentido horário). */
export function polar(cx: number, cy: number, r: number, graus: number): [number, number] {
  const a = (graus * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/** Estrela de `pontas` pontas (polígono), centro (cx, cy). */
export function estrela(cx: number, cy: number, rFora: number, rDentro: number, pontas: number, v: Tinta, giro = -90): string {
  const uma = (f: number, t: string) => {
    const pts: string[] = []
    for (let i = 0; i < pontas * 2; i++) {
      const [x, y] = polar(cx, cy, (i % 2 === 0 ? rFora : rDentro) * f, giro + (i * 180) / pontas)
      pts.push(`${num(x)},${num(y)}`)
    }
    return `<polygon points="${pts.join(' ')}" fill="${t}"/>`
  }
  const domo = typeof v === 'string' ? DOMOS[v] : undefined
  if (!domo) return uma(1, tinta(v))
  const [b, m, , c] = faixas(domo)
  return uma(1, b) + uma(0.68, m) + uma(0.4, c)
}

/** Espiral (para nuvem, onda, voluta): `voltas` voltas a partir do raio `r0` até `r1`. */
export function espiral(cx: number, cy: number, r0: number, r1: number, voltas: number, inicio = 0, horario = true): string {
  const passos = Math.max(8, Math.round(voltas * 16))
  let d = ''
  for (let i = 0; i <= passos; i++) {
    const t = i / passos
    const ang = inicio + (horario ? 1 : -1) * t * voltas * 360
    const [x, y] = polar(cx, cy, r0 + (r1 - r0) * t, ang)
    d += `${i === 0 ? 'M' : 'L'}${num(x)},${num(y)}`
  }
  return d
}

/** O fundo da cena: a chapa rebaixada de borda a borda. */
export const fundo = (v: number): string => `<rect width="1200" height="720" fill="${alt(v)}"/>`
