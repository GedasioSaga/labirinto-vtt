/**
 * TROUXA DE ROUPA de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; objeto novo, que junta a "pilha de
 * roupas"). A TROUXA é um pano grande, encardido de uso, com as quatro pontas juntadas e amarradas: o saco mole,
 * assentado no chão (achata embaixo com o peso), as QUATRO PREGAS grandes que descem do nó para a beira, uma de cada ponta
 * juntada, e o NÓ fora do meio, com as duas ORELHAS deitadas e caídas para os lados. Por baixo do pano escapa roupa: a
 * MANGA azul desbotada caída no chão, com o punho, e a aba de um pano XADREZ vinho. Ao lado, a PILHA de roupa dobrada,
 * de quinas moles: duas beiradas de pano dobrado aparecendo embaixo, a camisa clara com a gola e os botões e a calça
 * escura por cima, um nada fora do esquadro, com um remendo no joelho.
 *
 * A 25% de zoom sobram o bolo claro com o nó de lado e as pregas grandes saindo dele, as pontas coloridas no chão e a
 * pilha de beiradas moles ao lado: trouxa de quem mora de favor (o saco de grão é liso, de estopa, sem roupa nem nó).
 *
 * NA 3/4 fica como de cima (perfil EM_PE, com a sombra de baixo): derivada, a trouxa virava um tambor de beira reta,
 * e pano mole não tem beira reta. O fundo da trouxa e o da pilha assentam na mesma linha (`BASE`) e nada escapa abaixo
 * dela, então a sombra de baixo cai rente aos dois. As sombras da trouxa e da pilha, cada uma na altura dela, dão a
 * sombra comprida de cima. Material: `pano` (o pano da trouxa: um dos tecidos, sempre encardido como o lençol do catre; o
 * linho cru de partida). As roupas são fixas, em cores apagadas. Medidas do menor lado (1 x 0,8 casa de partida).
 */
import { misturar } from '../../ruido'
import { cadeia, caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'
import { girar } from './grilhoesDeParede'
import { arco, ENCARDIDO, ESCURO_DO_CORTICO, prega, vale, voltaMole } from './catreDesarrumado'

/** Alturas (casas): a trouxa e a pilha dobrada. */
const ALTURA_DA_TROUXA = 0.3
const ALTURA_DA_PILHA = 0.12
/** O pano da trouxa encardido como o lençol do catre. */
const ENCARDIDO_DO_PANO = 0.3
/** A linha em que a trouxa e a pilha assentam (px da pegada de partida, a partir do meio). */
const BASE = 12.5
/** O saco assentado: abaixo desta parte do raio a volta achata, e achata este tanto (o peso do pano no chão). */
const COMECO_DO_ACHATADO = 0.72
const ACHATADO = 0.4
/** As quatro pontas juntadas no nó: os rumos (radianos, a partir do nó) das quatro pregas grandes. */
const PREGAS_GRANDES: readonly number[] = [-0.62, 0.9, 2.44, 3.96]
/** As duas orelhas do nó: o rumo, o comprimento (px) e quanto a ponta cai (px). */
const ORELHAS: readonly (readonly [number, number, number])[] = [
  [Math.PI - 0.22, 8.2, 4.6],
  [0.22, 6.6, 3.6],
]
/** Pontos ao longo de cada orelha. */
const PASSOS_DA_ORELHA = 8
/** As roupas, em cores apagadas: a manga azul, o xadrez vinho, a camisa clara, a calça escura e as dobradas de baixo. */
const MANGA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x60, 0x6d, 0x7c] }
const XADREZ: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x8a, 0x54, 0x4e] }
const CAMISA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xb0, 0x98, 0x6c] }
const CALCA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x56, 0x5c, 0x66] }
const CINZA_DOBRADO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x77, 0x72, 0x68] }
const PARDO_DOBRADO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x8e, 0x7c, 0x62] }
const REMENDO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x7c, 0x6e, 0x58] }
const BOTAO: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xcc, 0xb4] }

/** Os pontos ao lado do eixo `pontos`, a `largura(t)` dele (t de 0 a 1), de um lado (`lado` 1) ou do outro (-1). */
function aoLado(pontos: readonly Ponto[], largura: (t: number) => number, lado: 1 | -1): Ponto[] {
  return pontos.map(([x, y], i): Ponto => {
    const [ax, ay] = pontos[Math.max(0, i - 1)]
    const [bx, by] = pontos[Math.min(pontos.length - 1, i + 1)]
    const l = Math.hypot(bx - ax, by - ay) || 1
    const r = largura(i / (pontos.length - 1)) * lado
    return [x - ((by - ay) / l) * r, y + ((bx - ax) / l) * r]
  })
}

export const montarTrouxaDeRoupa: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const pano: MaterialDaPeca = { ...c.m.pano, rgb: misturar(c.m.pano.rgb, ENCARDIDO, ENCARDIDO_DO_PANO) }
  const L = cena.partes
  const k = Math.min(w / G, h / (0.8 * G))
  const base = BASE * k
  cena.corDoPiso = ESCURO_DO_CORTICO

  // A TROUXA à esquerda, assentada na linha da base: a volta mole achata embaixo.
  const [bx, rx, ry] = [-6 * k, 15 * k, 13 * k]
  const yAchata = ry * COMECO_DO_ACHATADO
  const achata = (y: number): number => (y > yAchata ? yAchata + (y - yAchata) * ACHATADO : y)
  const crua = voltaMole(0, 0, rx, ry, 1.3).map(([x, y]): Ponto => [x, achata(y)])
  const by = base - Math.max(...crua.map((p) => p[1]))
  const trouxa = poligono(crua.map(([x, y]): Ponto => [bx + x, by + y]))
  const naBeira = (ang: number, f: number): Ponto => [bx + Math.cos(ang) * rx * f, by + achata(Math.sin(ang) * ry * f)]

  // A PILHA à direita, de quinas moles, assentada na mesma linha: duas dobradas embaixo, a camisa e a calça por cima.
  const [pcx, pcy] = [16.4 * k, base - 10.4 * k]
  const roupa = (dx: number, dy: number, mx: number, my: number, giro: number): Forma =>
    girar(caixa(pcx + dx - mx, pcy + dy - my, pcx + dx + mx, pcy + dy + my, 3.2 * k), pcx + dx, pcy + dy, giro)
  const dobradas: readonly (readonly [Forma, MaterialDaPeca])[] = [
    [roupa(-0.7 * k, 3 * k, 9.4 * k, 7.4 * k, -0.03), PARDO_DOBRADO],
    [roupa(0.9 * k, 1.6 * k, 9.9 * k, 7.4 * k, 0.04), CINZA_DOBRADO],
  ]
  const camisa = roupa(0, 0, 10 * k, 7.4 * k, 0.07)
  const calca = roupa(2.6 * k, 2.2 * k, 7.8 * k, 4.6 * k, -0.1)
  const pilha = uniao(uniao(dobradas[0][0], dobradas[1][0]), camisa)
  cena.sombras.push(
    { forma: pilha, z: g * ALTURA_DA_PILHA, forca: 0.26 },
    contato(pilha, 0.32),
    { forma: trouxa, z: g * ALTURA_DA_TROUXA, forca: 0.3 },
    contato(trouxa, 0.36),
  )

  // A PILHA: as beiradas das dobradas de baixo (o desencontro das camadas), a camisa (a dobra do meio, a gola e os
  // botões) e a calça por cima, fora do esquadro da camisa, com o remendo no joelho.
  dobradas.forEach(([forma, mat], i) => {
    L.push(P(forma, mat, { tabua: 0, bisel: 1.6 * k, ruga: 1, contorno: 0.26, semente: 8800 + i, projeta: { dist: 0.8 * k, forca: 0.28 } }))
  })
  L.push(P(camisa, CAMISA, { tabua: 0, bisel: 2 * k, ruga: 1, contorno: 0.24, semente: 8802, projeta: { dist: 1 * k, forca: 0.3 } }))
  prega(P, L, CAMISA, arco([pcx - 9 * k, pcy + 2.6 * k], [pcx, pcy + 3.4 * k], [pcx + 9 * k, pcy + 3 * k]), 0.9 * k, 0.9, 8803)
  for (const lado of [-1, 1]) {
    L.push(P(capsula(pcx + lado * 3.4 * k, pcy - 6.4 * k, pcx + lado * 0.5 * k, pcy - 3.4 * k, 0.9 * k), CAMISA, { tabua: 0, bisel: 0.7 * k, tom: 1.08, contorno: 0.26, semente: 8804 }))
  }
  for (const f of [0, 1]) L.push(P(elipse(pcx + 0.4 * k, pcy - 1.6 * k + f * 2.6 * k, 0.55 * k, 0.55 * k), BOTAO, { tabua: 0, bisel: 0.3 * k, contorno: 0.24, semente: 8805 }))
  L.push(P(calca, CALCA, { tabua: 0, bisel: 1.8 * k, ruga: 1, contorno: 0.26, semente: 8806, projeta: { dist: 1.1 * k, forca: 0.32, suave: 0.8 * k } }))
  prega(P, L, CALCA, arco([pcx - 4.4 * k, pcy + 2.4 * k], [pcx + 2.8 * k, pcy + 3 * k], [pcx + 9.6 * k, pcy + 1.8 * k]), 0.8 * k, 0.8, 8807)
  L.push(P(girar(caixa(pcx + 4.8 * k, pcy + 3.2 * k, pcx + 8 * k, pcy + 5.8 * k, 0.6 * k), pcx + 6.4 * k, pcy + 4.5 * k, 0.2), REMENDO, { tabua: 0, bisel: 0.5 * k, contorno: 0.26, semente: 8808 }))

  // A ROUPA que escapa por baixo do pano (a raiz fica debaixo da trouxa), deitada no chão e sem passar da base: a manga
  // sai pela frente à esquerda, mole, com o punho na ponta e os vincos atravessados; a aba do xadrez sai atrás.
  const raizDaManga = naBeira(2.3, 0.78)
  const pontaDaManga: Ponto = [raizDaManga[0] - 9.4 * k, base - 3.6 * k]
  const eixoDaManga = arco(raizDaManga, [raizDaManga[0] - 4.6 * k, base - 2.9 * k], pontaDaManga)
  const manga = cadeia(eixoDaManga, 2.4 * k)
  cena.sombras.push(contato(manga, 0.26))
  L.push(P(manga, MANGA, { tabua: 0, bisel: 1.7 * k, ruga: 1.2, contorno: 0.26, semente: 8810, projeta: { dist: 1 * k, forca: 0.3 } }))
  const rumo = (i: number): readonly [number, number, number, number] => {
    const [a, b] = [eixoDaManga[Math.max(0, i - 1)], eixoDaManga[Math.min(eixoDaManga.length - 1, i + 1)]]
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const [ux, uy] = [(b[0] - a[0]) / n, (b[1] - a[1]) / n]
    return [ux, uy, -uy, ux]
  }
  const [ux, uy, nx, ny] = rumo(eixoDaManga.length - 1)
  const [cx, cy] = [pontaDaManga[0] - ux * 1.2 * k, pontaDaManga[1] - uy * 1.2 * k]
  L.push(P(capsula(cx + nx * 2.1 * k, cy + ny * 2.1 * k, cx - nx * 2.1 * k, cy - ny * 2.1 * k, 1.15 * k), MANGA, { tabua: 0, bisel: 0.9 * k, tom: 0.74, contorno: 0.26, semente: 8811 }))
  for (const i of [3, 5]) {
    const [px, py] = eixoDaManga[i]
    const [vx, vy, wx, wy] = rumo(i)
    prega(P, L, MANGA, arco([px + wx * 1.9 * k, py + wy * 1.9 * k], [px + vx * 0.9 * k, py + vy * 0.9 * k], [px - wx * 1.9 * k, py - wy * 1.9 * k]), 0.6 * k, 0.8, 8812 + i)
  }

  const [ax, ay] = naBeira(3.55, 0.86)
  const aba = poligono([
    [ax + 3 * k, ay - 3.6 * k], [ax - 3.8 * k, ay - 4.4 * k], [ax - 6.4 * k, ay - 2 * k], [ax - 6.6 * k, ay + 1.2 * k],
    [ax - 4.4 * k, ay + 3.2 * k], [ax - 0.8 * k, ay + 3.4 * k], [ax + 3 * k, ay + 2.6 * k],
  ])
  cena.sombras.push(contato(aba, 0.24))
  L.push(P(aba, XADREZ, { tabua: 0, bisel: 1.5 * k, ruga: 1, contorno: 0.26, semente: 8820, projeta: { dist: 0.9 * k, forca: 0.3 } }))
  for (const fio of [capsula(ax - 1.8 * k, ay - 5 * k, ax - 1.4 * k, ay + 5 * k, 0.5 * k), capsula(ax - 4.6 * k, ay - 5 * k, ax - 4.2 * k, ay + 5 * k, 0.5 * k), capsula(ax - 8 * k, ay + 0.2 * k, ax + 3 * k, ay - 0.2 * k, 0.45 * k)]) {
    L.push(P(dentroDe(fio, aba), XADREZ, { tabua: 0, bisel: 0, contorno: 0, tom: 0.64, alfa: 0.55, semente: 8821 }))
  }

  // A TROUXA: o saco mole, o lado de baixo à direita na sombra e o lado de cima à esquerda na luz (o volume dos gomos).
  L.push(P(trouxa, pano, { tabua: 0, bisel: 5.2 * k, ruga: 1.6, contorno: 0.24, semente: 8840, projeta: { dist: 1.6 * k, forca: 0.34, suave: 1.2 * k } }))
  L.push(P(dentroDe(elipse(bx + 4.5 * k, by + 5 * k, rx * 0.78, ry * 0.62), trouxa), pano, { tabua: 0, bisel: 0, contorno: 0, tom: 0.78, alfa: 0.5, suave: 5 * k, semente: 8841 }))
  L.push(P(elipse(bx - 5.4 * k, by - 4.4 * k, 6.4 * k, 4.6 * k), pano, { tabua: 0, bisel: 0, contorno: 0, tom: 1.1, alfa: 0.34, suave: 3.6 * k, semente: 8842 }))

  // O NÓ fora do meio (para cima e para a direita) e as QUATRO PREGAS grandes, uma de cada ponta juntada, que descem
  // dele até perto da beira, torcendo todas para o mesmo lado.
  const [kx, ky] = [bx + 4.2 * k, by - 5 * k]
  const ateABeira = (ang: number): Ponto => {
    for (let t = 4 * k; t < 40 * k; t += 0.5 * k) {
      const p: Ponto = [kx + Math.cos(ang) * t, ky + Math.sin(ang) * t]
      if (trouxa.d(p[0], p[1]) > -1.8 * k) return p
    }
    return [kx, ky]
  }
  PREGAS_GRANDES.forEach((ang, i) => {
    const a: Ponto = [kx + Math.cos(ang) * 3.4 * k, ky + Math.sin(ang) * 2.9 * k]
    const b = ateABeira(ang)
    const torce = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.16
    const m: Ponto = [(a[0] + b[0]) / 2 - Math.sin(ang) * torce, (a[1] + b[1]) / 2 + Math.cos(ang) * torce]
    prega(P, L, pano, arco(a, m, b), 2.2 * k, 1, 8850 + i * 2)
    vale(P, L, pano, arco(a, m, b), 1.1 * k, 1, 8858 + i)
  })

  // As ORELHAS do nó: as duas pontas que sobraram da amarração, deitadas no saco e caídas para os lados, largas na raiz
  // e de ponta mole, com o vinco no meio.
  ORELHAS.forEach(([ang, comprimento, cai], i) => {
    const a: Ponto = [kx + Math.cos(ang) * 1.6 * k, ky + Math.sin(ang) * 1.4 * k]
    const b: Ponto = [kx + Math.cos(ang) * comprimento * k, ky + Math.sin(ang) * comprimento * k + cai * k]
    const eixo = arco(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.6 * k], b)
    const largura = (t: number): number => k * (1.6 + 0.9 * t - 1.7 * t * t)
    const orelha = poligono([...aoLado(eixo, largura, 1), ...aoLado(eixo, largura, -1).reverse()])
    L.push(P(orelha, pano, { tabua: 0, bisel: 0.9 * k, ruga: 1, tom: 0.97, contorno: 0.24, semente: 8860 + i, projeta: { dist: 0.8 * k, forca: 0.32, suave: 0.6 * k } }))
    vale(P, L, pano, eixo.slice(1, PASSOS_DA_ORELHA), 0.6 * k, 0.8, 8864 + i)
  })
  const no = girar(elipse(kx, ky, 3.3 * k, 2.6 * k), kx, ky, 0.5)
  L.push(P(no, pano, { tabua: 0, bisel: 2 * k, ruga: 1.6, tom: 0.98, contorno: 0.26, semente: 8868, projeta: { dist: 1.1 * k, forca: 0.34, suave: 0.9 * k } }))
  L.push(P(cadeia(arco([kx - 1.8 * k, ky + 0.6 * k], [kx, ky - 0.6 * k], [kx + 1.9 * k, ky + 0.3 * k]), 0.4 * k), pano, { tabua: 0, bisel: 0, contorno: 0, tom: 0.62, alfa: 0.6, semente: 8869 }))
}
