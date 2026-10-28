/**
 * FOGO de cima, PARADO (objeto Fogo, `docs/design/objeto-fogo/README.md`): o
 * chão queimado que fica embaixo das chamas. A fuligem de borda irregular
 * (`#2a201b` a `#4d3b2f`), pontos de cinza clara, uma brasa no pé de cada
 * língua (as cores da fogueira) e, a partir do Fogaréu, toras carbonizadas.
 * Sem material: "Cor" e "Cor da linha" não mudam o fogo, como na chama da
 * fogueira.
 *
 * As LÍNGUAS, o brilho, as fagulhas e a fumaça não entram na imagem: são a
 * camada animada `pixi/fogosDoMapa.ts`, que lê a mesma disposição
 * (`linguasDoFogo`). A imagem nunca é repintada por causa da animação.
 */
import { linguasDoFogo, type LinguaDoFogo } from '../../../lib/mobilia/fogo'
import { capsula, elipse } from './formas'
import { ruido, type MaterialDaPeca, type Textura } from './motor'
import { CINZA, type MontarMovel } from './contexto'
import { BRASA_QUENTE, BRASA_VIVA } from './fogueira'

type Rgb3 = readonly [number, number, number]

/** A fuligem, do miolo queimado à borda: os tons do README. */
const FULIGEM_ESCURA: Rgb3 = [0x2a, 0x20, 0x1b]
const FULIGEM_CLARA: Rgb3 = [0x4d, 0x3b, 0x2f]
const ALFA_DA_FULIGEM = 0.86
/** Pontos de cinza clara sobre a fuligem. */
const COR_DA_CINZA_CLARA: Rgb3 = [0x9c, 0x94, 0x8b]
/** A tora carbonizada: quase preta, com a luz do motor dando o volume. */
const CARVAO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2e, 0x27] }
/** Raio da brasa no pé de uma língua de 1 casa, em px do protótipo (56 por casa). */
const RAIO_DA_BRASA = 2.6

function misturar(a: Rgb3, b: Rgb3, t: number): [number, number, number] {
  const k = Math.min(1, Math.max(0, t))
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

/** Uma mancha de fuligem centrada em (cx, cy), raios rx e ry: a borda é corroída pelo ruído e some suave. */
function texFuligem(cx: number, cy: number, rx: number, ry: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const q = dx * dx + dy * dy
    // A borda anda para dentro e para fora com o ruído: nada de elipse lisa.
    const limite = 0.62 + ruido(x * 0.16 + 5, y * 0.16) * 0.5 + ruido(x * 0.5, y * 0.5 + 9) * 0.18
    const borda = Math.min(1, Math.max(0, (1 - q) / Math.max(0.05, 1 - limite)))
    const c = misturar(FULIGEM_ESCURA, FULIGEM_CLARA, 0.35 + q * 0.45 + ruido(x * 0.3, y * 0.3) * 0.5)
    s[0] = c[0]
    s[1] = c[1]
    s[2] = c[2]
    s[4] = 1
    s[5] = ALFA_DA_FULIGEM * borda * borda
  }
}

/** Uma brasa redonda: miolo quente, borda vermelha apagada, toda emissão (a da fogueira). */
function texBrasa(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, Math.hypot(x - cx, y - cy) / r)
    const c = misturar(BRASA_QUENTE, BRASA_VIVA, q * q)
    s[0] = c[0]
    s[1] = c[1]
    s[2] = c[2]
    s[4] = 1
  }
}

/** Um ponto de cinza clara, chapado. */
const texCinzaClara: Textura = (_u, _v, _x, _y, _p, s) => {
  s[0] = COR_DA_CINZA_CLARA[0]
  s[1] = COR_DA_CINZA_CLARA[1]
  s[2] = COR_DA_CINZA_CLARA[2]
  s[4] = 1
}

/** O carvão da tora: rachado pelo ruído (o tom varia, a luz do motor dá o volume). */
const texCarvao: Textura = (_u, _v, x, y, _p, s) => {
  s[3] += ruido(x * 0.55, y * 0.55) * 0.22 + ruido(x * 1.7 + 3, y * 1.7) * 0.1
}

/** Toras: nenhuma na Chama, 2 no Fogaréu, 4 no Incêndio. */
function quantasToras(linguas: number): number {
  return linguas >= 8 ? 4 : linguas >= 5 ? 2 : 0
}

export const montarFogo: MontarMovel = (c, cena) => {
  const { w, h, g } = c
  const casasW = w / g
  const casasH = h / g
  const linguas: LinguaDoFogo[] = linguasDoFogo(casasW, casasH)
  const L = cena.partes
  // A mancha grande, um pouco abaixo do meio (onde as bases ficam), e manchas menores nos pés de algumas línguas.
  const cy = h * 0.08
  L.push(c.peca(elipse(0, cy, w * 0.47, h * 0.4), CINZA, { textura: texFuligem(0, cy, w * 0.47, h * 0.4), bisel: 0, contorno: 0, semente: 300 }))
  if (linguas.length >= 5) {
    linguas.forEach((lingua, i) => {
      if (i % 3 !== 1) return
      const mx = lingua.x * g
      const my = lingua.y * g
      const r = g * 0.34
      L.push(c.peca(elipse(mx, my, r, r * 0.8), CINZA, { textura: texFuligem(mx, my, r, r * 0.8), bisel: 0, contorno: 0, semente: 310 + i }))
    })
  }
  // Toras carbonizadas, cruzando o pé das línguas.
  const toras = quantasToras(linguas.length)
  for (let k = 0; k < toras; k += 1) {
    const base = linguas[(k * 3 + 1) % linguas.length]
    const angulo = (k % 2 === 0 ? 0.45 : -0.55) + k * 0.25
    const meio = 0.32 * g
    const ax = base.x * g - Math.cos(angulo) * meio
    const ay = base.y * g - Math.sin(angulo) * meio
    const bx = base.x * g + Math.cos(angulo) * meio
    const by = base.y * g + Math.sin(angulo) * meio
    const raio = 0.075 * g
    L.push(c.peca(capsula(ax, ay, bx, by, raio), CARVAO, { eixo: angulo, textura: texCarvao, bisel: raio, contorno: 0.2, semente: 330 + k }))
  }
  // Pontos de cinza clara, sempre nos mesmos lugares da mancha.
  const pontos = 3 + Math.floor(linguas.length / 2)
  for (let i = 0; i < pontos; i += 1) {
    const a = i * 2.39996 + 1.1
    const r = Math.sqrt((i + 0.5) / pontos)
    const px = Math.cos(a) * r * w * 0.4
    const py = cy + Math.sin(a) * r * h * 0.33
    const raio = 0.9 + 0.5 * ((i * 7) % 3) / 2
    L.push(c.peca(elipse(px, py, raio, raio), CINZA, { textura: texCinzaClara, bisel: 0, contorno: 0, semente: 350 + i }))
  }
  // Uma brasa no pé de cada língua: a camada animada nasce exatamente aqui.
  linguas.forEach((lingua, i) => {
    const bx = lingua.x * g
    const by = lingua.y * g
    const raio = RAIO_DA_BRASA * Math.max(0.6, Math.min(1.6, lingua.altura))
    L.push(c.peca(elipse(bx, by, raio, raio * 0.75), CINZA, { textura: texBrasa(bx, by, raio), bisel: 0, contorno: 0, semente: 380 + i }))
  })
}
