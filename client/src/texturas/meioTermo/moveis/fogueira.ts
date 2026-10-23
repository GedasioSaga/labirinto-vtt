/**
 * FOGUEIRA de cima com volume, PARADA (`objetos.js:1426-1492` sem a chama): a
 * roda de 8 pedras deitadas, o leito de cinza com brasa no meio, a lenha em X
 * queimada no centro e a brasa por cima do cruzamento. De Lado: as 4 pedras em
 * domo na frente, a lenha em X e a brasa (`FOGUEIRA_DE_LADO` de
 * `lib/mobilia.ts`). Materiais: `pedras` e `lenha`.
 *
 * A CHAMA não entra na imagem: ela é animada numa camada à parte, por cima
 * (`pixi/chamasDasFogueiras.ts`, que nasce de `chamaDaFogueira`), e não muda.
 * De lado, o alto do objeto fica vazio (só a sombra no chão) para ela subir.
 */
import { hash } from '../../ruido'
import { capsula, elipse, elipseGirada, uniao, type Forma } from './formas'
import { ruido, texturaDaClasse, type Cena, type Peca, type Textura } from './motor'
import { CINZA, QUARTO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'

type Rgb3 = readonly [number, number, number]

/**
 * A brasa, do carvão ao laranja do miolo, contida (regra 5 do estilo: pastel,
 * nunca neon): saturação HSV ≤ 0,60 em todo tom, para a fogueira passar no teto
 * de 0,62 do p95 como os outros móveis (no protótipo, com a brasa crua e a
 * chama, ela dava 0,70). Quem dá o fogo vivo é a chama animada por cima.
 */
const BRASA_CARVAO: Rgb3 = [58, 46, 38]
const BRASA_VIVA: Rgb3 = [150, 82, 62]
const BRASA_QUENTE: Rgb3 = [196, 130, 82]

function misturar(a: Rgb3, b: Rgb3, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Cor da brasa por "calor" de 0 a 1: carvão, vermelho apagado e laranja só no miolo. */
function corDaBrasa(q: number): [number, number, number] {
  return q < 0.5 ? misturar(BRASA_CARVAO, BRASA_VIVA, q * 2) : misturar(BRASA_VIVA, BRASA_QUENTE, (q - 0.5) * 2)
}

/** Puxa a cor do ponto para `c` em `t` e acende `emissao`. */
function acender(s: Float32Array, c: readonly number[], t: number, emissao: number): void {
  s[0] += (c[0] - s[0]) * t
  s[1] += (c[1] - s[1]) * t
  s[2] += (c[2] - s[2]) * t
  s[4] = emissao
}

/** Lenha: a casca, queimada perto do centro do fogo (`cx`, `cy`, raio `r`), com brasa parada no mais quente. */
function texLenha(cx: number, cy: number, r: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    texturaDaClasse(p.mat.classe)?.(u, v, x, y, p, s, escala)
    const d = Math.hypot(x - cx, y - cy)
    if (d >= r) return
    const k = 1 - d / r
    s[3] -= 0.5 * k
    const n = ruido(x * 0.8 + 5, y * 0.8) + k * 0.5 - 0.42
    if (n <= 0) return
    const q = Math.min(1, n / 0.35)
    acender(s, corDaBrasa(q * 0.85), Math.min(1, n / 0.12), Math.min(1, n / 0.12) * (0.3 + 0.6 * q))
  }
}

/** Leito de cinza com brasa parada: mais brasa no meio (centro `cx`, `cy`, raio `r`), carvão em volta. */
function texBrasas(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x - cx, y - cy) / r
    const n = ruido(x * 0.3 + 11, y * 0.3) + ruido(x * 0.85 + 3, y * 0.85 + 7) * 0.5
    s[3] += ruido(x * 0.12, y * 0.12) * 0.16 + n * 0.08 + (rr - 0.5) * 0.06
    const calor = (1 - rr) * 1.1 + n * 0.8 - 0.68
    if (calor <= 0) return
    const q = Math.min(1, calor / 0.55)
    const t = Math.min(1, calor / 0.18)
    acender(s, corDaBrasa(q), t, t * (0.25 + 0.65 * q))
  }
}

/** Uma tora de lenha de `a` a `b`, de raio `raio`, queimada perto do fogo. */
function tora(c: ContextoDoMovel, a: readonly [number, number], b: readonly [number, number], raio: number, fogo: readonly [number, number, number], k: number): Peca {
  return c.peca(capsula(a[0], a[1], b[0], b[1], raio), c.m.lenha, {
    eixo: Math.atan2(b[1] - a[1], b[0] - a[0]),
    textura: texLenha(fogo[0], fogo[1], fogo[2]),
    bisel: raio,
    contorno: 0.2,
    semente: 220 + k,
    projeta: k > 0 ? { dist: 1.2, forca: 0.35 } : undefined,
  })
}

const VOLTA = Math.PI * 2
/** Pedras da roda vista de cima. */
const PEDRAS_NA_RODA = 8
/** Raio da roda (o centro das pedras) em fração da pegada. */
const RAIO_DA_RODA = 0.81
/** Altura das pedras (a sombra), em px do protótipo. */
const ALTURA_DAS_PEDRAS = 7

function montarFogueiraDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hh, w, h } = c
  const nA = (f: number): number => -hh + f * h
  const picos = [0.81, 0.79, 0.82, 0.8]
  const pedras: Forma[] = picos.map((pico, i) => {
    const cx = (-0.375 + 0.25 * i) * w
    const topo = nA(pico)
    return elipse(cx, (topo + hh) / 2 + 0.6, 0.155 * w, (hh - topo) / 2 + 0.6)
  })
  sombraDeLado(cena, pedras.reduce(uniao), ALTURA_DAS_PEDRAS)
  const L = cena.partes
  const raio = 0.035 * w * 1.3
  const fogo = [0, nA(0.675), 0.2 * w] as const
  for (const [k, sx] of [[0, 1], [1, -1]]) L.push(tora(c, [-sx * 0.26 * w, nA(0.79)], [sx * 0.26 * w, nA(0.56)], raio, fogo, k))
  L.push(c.peca(elipse(0, nA(0.735), 6.5, 2.6), CINZA, { textura: texBrasas(0, nA(0.735), 6), bisel: 0, contorno: 0, suave: 0.8, semente: 250 }))
  pedras.forEach((forma, i) => L.push(c.peca(forma, c.m.pedras, { bisel: Math.min(0.155 * w, 6) * 0.9, contorno: 0.2, semente: 260 + i })))
}

export const montarFogueira: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarFogueiraDeLado(c, cena)
    return
  }
  const { hw, hh } = c
  const R = Math.min(hw, hh)
  const pedras: { forma: Forma; menor: number }[] = []
  for (let i = 0; i < PEDRAS_NA_RODA; i += 1) {
    // Um pouco desiguais, sempre do mesmo jeito (o sorteio não usa a semente: a roda não pula entre fogueiras).
    const a = ((i + 0.5) / PEDRAS_NA_RODA) * VOLTA + (hash(i, 3, 901) - 0.5) * 0.18
    const tang = 0.33 * R * (0.9 + 0.2 * hash(i, 4, 901))
    const rad = 0.21 * R * (0.9 + 0.2 * hash(i, 5, 901))
    const forma = elipseGirada(Math.cos(a) * hw * RAIO_DA_RODA, Math.sin(a) * hh * RAIO_DA_RODA, tang, rad, a + QUARTO)
    pedras.push({ forma, menor: Math.min(tang, rad) })
    cena.sombras.push({ forma, z: ALTURA_DAS_PEDRAS, forca: 0.3 })
  }
  const L = cena.partes
  L.push(c.peca(elipse(0, 0, hw * 0.76, hh * 0.76), CINZA, { textura: texBrasas(0, 0, R * 0.76), bisel: 0, contorno: 0, semente: 210 }))
  const comprimento = 0.56 * 2 * R
  const raio = 0.058 * 2 * R
  const fogo = [0, 0, R * 0.42] as const
  for (const [k, graus] of [[0, 35], [1, -35]]) {
    const ang = (graus * Math.PI) / 180
    const ax = (-Math.cos(ang) * comprimento) / 2
    const ay = (-Math.sin(ang) * comprimento) / 2
    L.push(tora(c, [ax, ay], [-ax, -ay], raio, fogo, k))
  }
  L.push(c.peca(elipse(0, 0, 3.4, 2.7), CINZA, { dy: -raio * 0.6, textura: texBrasas(0, 0, 2.2), bisel: 0, contorno: 0, suave: 0.8, semente: 230 }))
  pedras.forEach(({ forma, menor }, i) => L.push(c.peca(forma, c.m.pedras, { bisel: menor * 0.92, contorno: 0.2, semente: 200 + i })))
}
