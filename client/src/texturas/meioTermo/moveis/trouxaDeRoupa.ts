/**
 * TROUXA DE ROUPA de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; objeto novo, que junta a "pilha de
 * roupas"). A TROUXA é um pano grande com as quatro pontas juntadas em cima e amarradas: o saco redondo e mole, as
 * PREGAS que correm da beira até o NÓ, e as duas ORELHAS do nó em pé, pegando a luz. Por baixo do pano escapa roupa: a
 * MANGA azul desbotada caída no chão, com o punho, e a aba de um pano XADREZ vinho. Ao lado, a PILHA de roupa dobrada:
 * a camisa clara, com a gola e os botões, e a calça escura por cima, com um remendo no joelho.
 *
 * A 25% de zoom sobram o bolo claro com o nó no meio e as pontas coloridas saindo dele, e o retângulo da roupa dobrada
 * ao lado: trouxa de quem mora de favor (o saco de grão é liso, de estopa, sem roupa nem nó).
 *
 * NA 3/4 fica como de cima (perfil EM_PE, com a sombra de baixo): derivada, a trouxa virava um tambor de beira reta,
 * e pano mole não tem beira reta. As sombras da trouxa e da pilha, cada uma na altura dela, dão a sombra comprida de
 * cima. Material: `pano` (o pano da trouxa: um dos tecidos; o linho cru de partida). As roupas são fixas, em cores
 * apagadas. Medidas do menor lado (1 x 0,8 casa de partida).
 */
import { cadeia, caixa, capsula, dentroDe, elipse, poligono, uniao, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'
import { girar } from './grilhoesDeParede'
import { arco, prega, voltaMole } from './catreDesarrumado'

/** Alturas (casas): a trouxa e a pilha dobrada. */
const ALTURA_DA_TROUXA = 0.3
const ALTURA_DA_PILHA = 0.12
/** As roupas, em cores apagadas: a manga azul, o xadrez vinho, a meia cinza, a camisa clara e a calça escura. */
const MANGA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x60, 0x6d, 0x7c] }
const XADREZ: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x8a, 0x54, 0x4e] }
const CAMISA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xb0, 0x98, 0x6c] }
const CALCA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x52, 0x5b, 0x69] }
const REMENDO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x7c, 0x6e, 0x58] }
const BOTAO: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xcc, 0xb4] }

export const montarTrouxaDeRoupa: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const pano = c.m.pano
  const L = cena.partes
  const k = Math.min(w / G, h / (0.8 * G))

  // A TROUXA à esquerda e a PILHA dobrada à direita, um pouco mais para a frente.
  const [bx, by, rx, ry] = [-6.5 * k, -0.6 * k, 14.6 * k, 13 * k]
  const trouxa = poligono(voltaMole(bx, by, rx, ry, 1.3))
  const naBeira = (ang: number, f = 0.92): Ponto => [bx + Math.cos(ang) * rx * f, by + Math.sin(ang) * ry * f]
  const [pcx, pcy] = [15.6 * k, 6.4 * k]
  const camisa = girar(caixa(pcx - 10 * k, pcy - 7.4 * k, pcx + 10 * k, pcy + 7.4 * k, 1.6 * k), pcx, pcy, 0.07)
  const calca = girar(caixa(pcx - 7.4 * k, pcy - 3.2 * k, pcx + 8.6 * k, pcy + 6.2 * k, 1.4 * k), pcx, pcy, -0.12)
  cena.sombras.push(
    { forma: uniao(camisa, calca), z: g * ALTURA_DA_PILHA, forca: 0.26 },
    contato(uniao(camisa, calca), 0.3),
    { forma: trouxa, z: g * ALTURA_DA_TROUXA, forca: 0.3 },
    contato(trouxa, 0.34),
  )

  // A PILHA: a camisa clara dobrada (a dobra do meio, a gola e os botões) e a calça escura por cima, com o remendo.
  L.push(P(camisa, CAMISA, { tabua: 0, bisel: 1.6 * k, ruga: 1, contorno: 0.24, semente: 8801, projeta: { dist: 1 * k, forca: 0.3 } }))
  prega(P, L, CAMISA, arco([pcx - 9 * k, pcy + 2.6 * k], [pcx, pcy + 3.4 * k], [pcx + 9 * k, pcy + 3 * k]), 0.9 * k, 0.9, 8802)
  for (const lado of [-1, 1]) L.push(P(capsula(pcx + lado * 3.4 * k, pcy - 6.6 * k, pcx + lado * 0.5 * k, pcy - 3.4 * k, 0.9 * k), CAMISA, { tabua: 0, bisel: 0.7 * k, tom: 1.08, contorno: 0.26, semente: 8803 }))
  for (const f of [0, 1, 2]) L.push(P(elipse(pcx + 0.4 * k, pcy - 1.6 * k + f * 3 * k, 0.55 * k, 0.55 * k), BOTAO, { tabua: 0, bisel: 0.3 * k, contorno: 0.24, semente: 8804 }))
  L.push(P(calca, CALCA, { tabua: 0, bisel: 1.4 * k, ruga: 1, contorno: 0.26, semente: 8805, projeta: { dist: 1.1 * k, forca: 0.32, suave: 0.8 * k } }))
  prega(P, L, CALCA, arco([pcx - 6.6 * k, pcy + 1.6 * k], [pcx + 0.6 * k, pcy + 2 * k], [pcx + 7.6 * k, pcy + 1.2 * k]), 0.8 * k, 0.8, 8806)
  L.push(P(girar(caixa(pcx + 2.6 * k, pcy + 2.6 * k, pcx + 6.2 * k, pcy + 5.4 * k, 0.5 * k), pcx + 4.4 * k, pcy + 4 * k, 0.2), REMENDO, { tabua: 0, bisel: 0.5 * k, contorno: 0.26, semente: 8807 }))

  // A ROUPA que escapa por baixo do pano (a raiz fica debaixo da trouxa): a manga caída no chão, com o punho, e a aba
  // de um pano xadrez, deitada e de bainha mole. Nada em pé nem pontudo: perna e bico de bicho estão fora.
  // A manga sai para baixo e deita dobrada para a direita (mole, não reta como cabo), com o punho na ponta e os vincos
  // da dobra atravessados.
  const raizDaManga = naBeira(1.25, 0.8)
  const pontaDaManga: Ponto = [raizDaManga[0] + 7.4 * k, raizDaManga[1] + 7.6 * k]
  const eixoDaManga = arco(raizDaManga, [raizDaManga[0] + 0.6 * k, raizDaManga[1] + 7.2 * k], pontaDaManga)
  const manga = cadeia(eixoDaManga, 2.6 * k)
  cena.sombras.push(contato(manga, 0.26))
  L.push(P(manga, MANGA, { tabua: 0, bisel: 1.8 * k, ruga: 1.2, contorno: 0.26, semente: 8810, projeta: { dist: 1 * k, forca: 0.3 } }))
  const rumo = (i: number): readonly [number, number, number, number] => {
    const [a, b] = [eixoDaManga[Math.max(0, i - 1)], eixoDaManga[Math.min(eixoDaManga.length - 1, i + 1)]]
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const [ux, uy] = [(b[0] - a[0]) / n, (b[1] - a[1]) / n]
    return [ux, uy, -uy, ux]
  }
  const [ux, uy, nx, ny] = rumo(eixoDaManga.length - 1)
  const [cx, cy] = [pontaDaManga[0] - ux * 1.3 * k, pontaDaManga[1] - uy * 1.3 * k]
  L.push(P(capsula(cx + nx * 2.4 * k, cy + ny * 2.4 * k, cx - nx * 2.4 * k, cy - ny * 2.4 * k, 1.25 * k), MANGA, { tabua: 0, bisel: 0.9 * k, tom: 0.74, contorno: 0.26, semente: 8811 }))
  for (const i of [3, 5]) {
    const [px, py] = eixoDaManga[i]
    const [vx, vy, wx, wy] = rumo(i)
    prega(P, L, MANGA, arco([px + wx * 2 * k, py + wy * 2 * k], [px + vx * 0.9 * k, py + vy * 0.9 * k], [px - wx * 2 * k, py - wy * 2 * k]), 0.6 * k, 0.8, 8812 + i)
  }

  const [ax, ay] = [bx - rx * 0.84, by + 4.2 * k]
  const aba = poligono([
    [ax + 2 * k, ay - 4 * k], [ax - 4.6 * k, ay - 3.8 * k], [ax - 7.2 * k, ay - 1.6 * k], [ax - 7.6 * k, ay + 1.4 * k],
    [ax - 5.6 * k, ay + 3.6 * k], [ax - 2.4 * k, ay + 4.4 * k], [ax + 2 * k, ay + 3.8 * k],
  ])
  cena.sombras.push(contato(aba, 0.24))
  L.push(P(aba, XADREZ, { tabua: 0, bisel: 1.5 * k, ruga: 1, contorno: 0.26, semente: 8820, projeta: { dist: 0.9 * k, forca: 0.3 } }))
  for (const fio of [capsula(ax - 2.6 * k, ay - 5 * k, ax - 2.2 * k, ay + 5 * k, 0.5 * k), capsula(ax - 5.4 * k, ay - 5 * k, ax - 5 * k, ay + 5 * k, 0.5 * k), capsula(ax - 9 * k, ay + 0.2 * k, ax + 2 * k, ay - 0.2 * k, 0.45 * k)]) {
    L.push(P(dentroDe(fio, aba), XADREZ, { tabua: 0, bisel: 0, contorno: 0, tom: 0.64, alfa: 0.55, semente: 8821 }))
  }
  prega(P, L, XADREZ, arco([ax - 6.6 * k, ay + 2.2 * k], [ax - 3.6 * k, ay + 1 * k], [ax - 0.6 * k, ay + 2.6 * k]), 0.7 * k, 0.8, 8823)

  // A TROUXA: o saco mole, as pregas da beira até o nó, o nó e as duas orelhas em pé.
  const [kx, ky] = [bx + 0.6 * k, by - 2.6 * k]
  L.push(P(trouxa, pano, { tabua: 0, bisel: 5.2 * k, ruga: 1.6, contorno: 0.24, semente: 8840, projeta: { dist: 1.6 * k, forca: 0.34, suave: 1.2 * k } }))
  const angulos = [0.15, 0.95, 1.75, 2.45, 3.1, 3.85, 4.6, 5.35]
  angulos.forEach((ang, i) => {
    const a = naBeira(ang, 0.9)
    const b: Ponto = [kx + Math.cos(ang) * 3.6 * k, ky + Math.sin(ang) * 3.1 * k]
    const lado = i % 2 === 0 ? 1 : -1
    const m: Ponto = [(a[0] + b[0]) / 2 - Math.sin(ang) * lado * 1.8 * k, (a[1] + b[1]) / 2 + Math.cos(ang) * lado * 1.8 * k]
    prega(P, L, pano, arco(a, m, b), 1.4 * k, 0.95, 8841 + i * 2)
  })
  L.push(P(elipse(kx, ky, 3.4 * k, 2.9 * k), pano, { tabua: 0, bisel: 2.2 * k, ruga: 1.4, tom: 1.06, contorno: 0.26, semente: 8860, projeta: { dist: 1.2 * k, forca: 0.34, suave: 0.9 * k } }))
  for (const [ang, comprimento] of [[-2.25, 8.4], [-0.75, 7.2]] as const) {
    const [dx, dy] = [Math.cos(ang), Math.sin(ang)]
    const [nx, ny] = [-dy, dx]
    const base: Ponto = [kx + dx * 2 * k, ky + dy * 2 * k]
    const ponta: Ponto = [kx + dx * comprimento * k, ky + dy * comprimento * k]
    const orelha = poligono([
      [base[0] + nx * 2.2 * k, base[1] + ny * 2.2 * k],
      [(base[0] + ponta[0]) / 2 + nx * 2.4 * k, (base[1] + ponta[1]) / 2 + ny * 2.4 * k],
      ponta,
      [(base[0] + ponta[0]) / 2 - nx * 1.9 * k, (base[1] + ponta[1]) / 2 - ny * 1.9 * k],
      [base[0] - nx * 2 * k, base[1] - ny * 2 * k],
    ])
    L.push(P(orelha, pano, { tabua: 0, bisel: 1.4 * k, ruga: 1.2, tom: 1.12, contorno: 0.26, semente: 8862 + Math.round(comprimento), projeta: { dist: 1.4 * k, forca: 0.34, suave: 0.9 * k } }))
  }
}
