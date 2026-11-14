/**
 * PRATO DE CARNE NO OSSO de cima com volume (lote L08 dos objetos de 14/11/2026, grupo Mar e piratas; pedido do
 * mestre: "prato de carne no osso"). O banquete do pirata, com desenho próprio: uma TRAVESSA oval de estanho com
 * DUAS PEÇAS de carne assada, cada uma atravessada por um OSSO que sai pelas duas pontas e acaba nos dois nós
 * redondos. A carne é gorda e lustrosa (a crosta tostada com as partes queimadas e o brilho da gordura), e onde o
 * osso sai a carne mostra o corte mais claro. Em volta, duas folhas de verdura e três batatas assadas.
 *
 * A 25% de zoom sobram as duas bolas marrons com o risco claro de osso e os nós nas pontas, no disco cinza da
 * travessa: é o que diz "carne no osso" e não "pão" nem "assado" (o assado dos pratos não tem osso). O estanho
 * frio separa a carne quente da travessa, e o osso de marfim lê nos dois.
 *
 * É mesa posta, como os pratos: o mestre põe a travessa POR CIMA da mesa ou do balcão. Por isso só há sombra de
 * contato, e a 3/4 sobe o desenho inteiro a altura do tampo, a sombra junto (o perfil dos pratos em
 * `tresQuartos.ts`). A travessa enche a pegada (0,8 x 0,6 casa de partida); a carne, as folhas e as batatas ficam
 * em frações dela e o que é redondo sai do menor lado. Sem material: tudo é fixo.
 */
import { capsula, elipse, elipseGirada, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type CriarPeca, type MaterialDaPeca, type Projecao, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** A pegada de partida (px do protótipo): o desenho é medido nela. */
const LARGURA_DE_PARTIDA = 0.8 * G
const FUNDO_DE_PARTIDA = 0.6 * G

/** A travessa: os raios em fração da meia pegada, a aba e o fundo (o fundo afunda um pouco). */
const RAIO_DA_TRAVESSA_X = 0.97
const RAIO_DA_TRAVESSA_Y = 0.95
const FUNDO_DA_TRAVESSA = 0.8

/** Cada peça de carne: o meio e os raios (px na pegada de partida), o ângulo e o quanto o osso passa da carne. */
interface PecaDeCarne {
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
  readonly ang: number
  readonly sobra: number
  readonly semente: number
}

/** A de trás (menor, no canto de cima à direita) e a da frente, grande, atravessada por cima dela. */
const CARNES: readonly PecaDeCarne[] = [
  { x: 8.4, y: -5.2, rx: 7.2, ry: 5.2, ang: 0.42, sobra: 3.8, semente: 8110 },
  { x: -2, y: 2.4, rx: 10.4, ry: 7.4, ang: -0.32, sobra: 4.8, semente: 8130 },
]
/** O osso: o raio da haste e o dos dois nós da ponta, e o quanto cada nó fica para o lado (px de partida). */
const RAIO_DO_OSSO = 1.3
const RAIO_DO_NO = 1.8
const LADO_DO_NO = 1.3

/** As folhas de verdura (o meio, o ângulo) e as batatas (o meio, o raio), em px de partida. */
const FOLHAS: readonly (readonly [number, number, number])[] = [
  [-13.2, -6.4, -0.6],
  [15.4, 6.6, 0.5],
]
const BATATAS: readonly (readonly [number, number, number])[] = [
  [1.6, 11.2, 2.3],
  [6.6, 10.2, 2],
  [-14.6, 3.6, 1.9],
]

/** O estanho da travessa (metal fosco, frio), a carne, o corte, o osso, a verdura e a batata. */
const ESTANHO: MaterialDaPeca = { classe: 'metal', rgb: [0xa4, 0xa2, 0x9a] }
const CARNE: MaterialDaPeca = { classe: 'liso', rgb: [0x90, 0x5a, 0x40] }
const CORTE: MaterialDaPeca = { classe: 'liso', rgb: [0xbe, 0x92, 0x76] }
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xda, 0xc2] }
const VERDURA: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x8a, 0x4a] }
const NERVURA: MaterialDaPeca = { classe: 'liso', rgb: [0xa2, 0xb6, 0x74] }
const BATATA: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0x96, 0x66] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf6, 0xee, 0xde] }

/** O brilho do estanho (fosco: menos que o metal padrão). */
const METAL_DO_ESTANHO = 0.28
/** A sombra que a carne e o osso fazem na travessa. */
const SOMBRA_DA_CARNE: Projecao = { dist: 1.5, forca: 0.36, suave: 0.9 }
const SOMBRA_DO_OSSO: Projecao = { dist: 0.9, forca: 0.3, suave: 0.6 }

/** O tostado: a partir de quanto o ruído vira queimado (escuro) e de quanto vira gordura (clara). */
const LIMIAR_DO_QUEIMADO = 0.16
const LIMIAR_DA_GORDURA = 0.22
const TOM_DO_QUEIMADO: readonly [number, number, number] = [0x52, 0x2e, 0x20]

/** A crosta da carne: o grão, as partes queimadas (manchas escuras) e as gotas de gordura que brilham. */
const texDaCarne: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.45 + p.su, y * 0.45 + p.sv) * 0.1 + ruido(x * 1.3 + p.sv, y * 1.3) * 0.05
  const queimado = ruido(x * 0.22 + p.sv, y * 0.22 + p.su)
  if (queimado > LIMIAR_DO_QUEIMADO) {
    const t = Math.min(1, (queimado - LIMIAR_DO_QUEIMADO) / 0.18) * 0.6
    s[0] += (TOM_DO_QUEIMADO[0] - s[0]) * t
    s[1] += (TOM_DO_QUEIMADO[1] - s[1]) * t
    s[2] += (TOM_DO_QUEIMADO[2] - s[2]) * t
  }
  if (ruido(x * 0.8 + p.su * 2, y * 0.8) > LIMIAR_DA_GORDURA) s[3] += 0.12
}

/** O osso: liso, com um grão bem fraco. */
const texDoOsso: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.6 + p.su, y * 0.6 + p.sv) * 0.05
}

/** O ponto (dx, dy) do referencial da carne (x ao longo do osso) no desenho. */
function noDesenho(cx: number, cy: number, ang: number, dx: number, dy: number): Ponto {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return [cx + dx * co - dy * si, cy + dx * si + dy * co]
}

/** A ponta do osso: os dois nós lado a lado, na ponta `lado` (1 a da frente, -1 a de trás). */
function ponta(cx: number, cy: number, ang: number, meio: number, lado: 1 | -1, k: number): Forma {
  const [ax, ay] = noDesenho(cx, cy, ang, lado * meio, -LADO_DO_NO * k)
  const [bx, by] = noDesenho(cx, cy, ang, lado * meio, LADO_DO_NO * k)
  return uniao(elipse(ax, ay, RAIO_DO_NO * k, RAIO_DO_NO * k), elipse(bx, by, RAIO_DO_NO * k, RAIO_DO_NO * k))
}

/** Uma peça de carne: o osso por baixo (só as pontas aparecem), a carne, o corte onde o osso sai, o brilho e os nós. */
function porCarne(P: CriarPeca, cena: Cena, c: PecaDeCarne, em: (x: number, y: number) => Ponto, k: number): void {
  const [cx, cy] = em(c.x, c.y)
  const rx = c.rx * k
  const ry = c.ry * k
  const meio = rx + c.sobra * k
  const [ax, ay] = noDesenho(cx, cy, c.ang, -meio, 0)
  const [bx, by] = noDesenho(cx, cy, c.ang, meio, 0)
  const haste = capsula(ax, ay, bx, by, RAIO_DO_OSSO * k)
  const nos = uniao(ponta(cx, cy, c.ang, meio, 1, k), ponta(cx, cy, c.ang, meio, -1, k))
  const osso = uniao(haste, nos)
  cena.partes.push(P(osso, OSSO, { bisel: RAIO_DO_OSSO * k * 0.9, contorno: 0.3, textura: texDoOsso, projeta: SOMBRA_DO_OSSO, semente: c.semente }))
  // A carne: a elipse grande e um lombo menor, um pouco fora do meio, para não sair um ovo perfeito.
  const [lx, ly] = noDesenho(cx, cy, c.ang, rx * 0.22, -ry * 0.3)
  const carne = uniao(elipseGirada(cx, cy, rx, ry, c.ang), elipseGirada(lx, ly, rx * 0.7, ry * 0.78, c.ang + 0.2))
  cena.partes.push(P(carne, CARNE, { bisel: ry * 0.62, contorno: 0.3, textura: texDaCarne, projeta: SOMBRA_DA_CARNE, semente: c.semente + 1 }))
  // Onde o osso sai, a carne mostra o corte, mais claro, em volta da haste.
  for (const lado of [-1, 1] as const) {
    const [qx, qy] = noDesenho(cx, cy, c.ang, lado * rx * 0.86, 0)
    cena.partes.push(P(elipseGirada(qx, qy, 1.3 * k, 2.6 * k, c.ang), CORTE, { bisel: 0.8 * k, contorno: 0.16, tom: 0.98, semente: c.semente + 2 + (lado + 1) }))
    const [ox, oy] = noDesenho(cx, cy, c.ang, lado * rx * 0.92, 0)
    cena.partes.push(P(capsula(ox, oy, ...noDesenho(cx, cy, c.ang, lado * (rx * 0.92 + 1.4 * k), 0), RAIO_DO_OSSO * k), OSSO, { bisel: RAIO_DO_OSSO * k * 0.9, contorno: 0.24, textura: texDoOsso, semente: c.semente + 5 }))
  }
  // O brilho da gordura, comprido ao longo da carne, para cima à esquerda, e uma gota menor do outro lado.
  const [hx, hy] = noDesenho(cx, cy, c.ang, -rx * 0.18, -ry * 0.42)
  cena.partes.push(P(elipseGirada(hx, hy, rx * 0.46, ry * 0.16, c.ang), BRILHO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 1.1 * k, semente: c.semente + 6 }))
  const [gx, gy] = noDesenho(cx, cy, c.ang, rx * 0.36, ry * 0.3)
  cena.partes.push(P(elipse(gx, gy, 0.9 * k, 0.6 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.28, suave: 0.5 * k, semente: c.semente + 7 }))
  // Os nós por cima da carne: o osso sai inteiro e a ponta fica à vista.
  cena.partes.push(P(nos, OSSO, { bisel: RAIO_DO_NO * k * 0.8, contorno: 0.3, textura: texDoOsso, projeta: SOMBRA_DO_OSSO, semente: c.semente + 8 }))
}

export const montarPratoDeCarne: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const sx = c.w / LARGURA_DE_PARTIDA
  const sy = c.h / FUNDO_DE_PARTIDA
  const k = Math.min(sx, sy)
  const em = (x: number, y: number): Ponto => [x * sx, y * sy]
  const L = cena.partes

  // A travessa: o contato no tampo, a aba com o friso e o fundo afundado.
  const rx = hw * RAIO_DA_TRAVESSA_X
  const ry = hh * RAIO_DA_TRAVESSA_Y
  const travessa = elipse(0, 0, rx, ry)
  cena.sombras.push(contato(travessa, 0.32))
  L.push(P(travessa, ESTANHO, { bisel: 2.2 * k, contorno: 0.28, metal: METAL_DO_ESTANHO, semente: 8101 }))
  L.push(P(elipse(0, 0, rx * FUNDO_DA_TRAVESSA, ry * FUNDO_DA_TRAVESSA), ESTANHO, { bisel: 1.2 * k, tom: 0.93, contorno: 0.14, metal: METAL_DO_ESTANHO, recesso: { k: 1.6 * k, forca: 0.24 }, semente: 8102 }))

  // As folhas por baixo de tudo, saindo de debaixo da carne.
  FOLHAS.forEach(([x, y, ang], i) => {
    const [fx, fy] = em(x, y)
    for (const [d, a] of [[-0.5, -0.5], [0.5, 0.45]] as const) {
      const [px, py] = [fx + Math.cos(ang + a) * d * 3 * k, fy + Math.sin(ang + a) * d * 3 * k]
      L.push(P(elipseGirada(px, py, 4.2 * k, 2.1 * k, ang + a), VERDURA, { bisel: 0.9 * k, contorno: 0.28, tom: 0.94 + 0.12 * (i % 2), projeta: { dist: 0.8 * k, forca: 0.28 }, semente: 8150 + i * 2 + (d > 0 ? 1 : 0) }))
      L.push(P(capsula(px - Math.cos(ang + a) * 3.2 * k, py - Math.sin(ang + a) * 3.2 * k, px + Math.cos(ang + a) * 3 * k, py + Math.sin(ang + a) * 3 * k, 0.3 * k), NERVURA, { bisel: 0, contorno: 0, alfa: 0.75, semente: 8160 + i }))
    }
  })
  // As batatas assadas, com um ponto tostado.
  BATATAS.forEach(([x, y, r], i) => {
    const [bx, by] = em(x, y)
    L.push(P(elipseGirada(bx, by, r * 1.15 * k, r * k, i * 1.1), BATATA, { bisel: r * 0.6 * k, contorno: 0.28, textura: texDaCarne, projeta: { dist: 0.9 * k, forca: 0.3 }, semente: 8170 + i }))
  })

  CARNES.forEach((carne) => porCarne(P, cena, carne, em, k))
}
