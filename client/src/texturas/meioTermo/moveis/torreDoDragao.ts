/**
 * TORRE DO DRAGÃO (pedido do mestre de 16/11/2026, leva E2 item 11, grupo Castelo): a torre redonda de pedra com
 * um DRAGÃO de bronze agarrado no alto. Desenho próprio da casa (a referência foi um print de jogo, não copiado).
 *
 * A torre é a mesma `torreDePedra` (fiadas, porta, seteiras, terraço, ameias), menor (`ESCALA_DA_TORRE` da caixa)
 * e sem o mastro: sobra a beira da caixa para as ASAS abertas e para a CAUDA, que passa por cima do parapeito de
 * trás e desce enrolada por fora da parede, do lado direito, até a ponta em lança perto da frente. O dragão fica de
 * frente para quem olha (a frente é o lado da porta): as patas da frente agarram o parapeito, o pescoço sobe e a
 * CABEÇA passa da beira, por cima da porta, com os chifres para trás e os olhos acesos. Espinhos no lombo.
 *
 * O bronze tem ESCAMAS (meias-luas desencontradas) e a PÁTINA verde nas dobras, em manchas; a membrana das asas é
 * o mesmo metal mais escuro, com os ossos claros por cima. Material do dragão no lugar `dragao` (latão de partida;
 * dá para trocar por ferro ou por pedra, e o dragão vira estátua de pedra). A torre usa `pedra` e `madeira`.
 *
 * NA 3/4 (derivado, tampo com a espessura da fiada da torre): cada parte do dragão é um tampo (o tronco, uma pilha
 * de cinco), todos com a caixa esticada até além da frente da torre, para sair depois dela, na ordem: a cauda (da
 * raiz à ponta, descendo), as patas de trás, o tronco, as asas, as patas da frente, o pescoço e a cabeça.
 *
 * PEGADA SÓLIDA: o círculo da parede, `RAIO_SOLIDO_DA_TORRE_DO_DRAGAO` do menor meio lado. As asas e a cauda ficam
 * no alto ou encostadas na parede e não barram.
 */
import { hash, misturar, passoSuave } from '../../ruido'
import { comMeioEm, esticadaParaAFrente } from './apoioDasConstrucoes'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'
import { capsula, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { ruido, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { desenharTorreDePedra, ESPESSURA_DA_FIADA_DA_TORRE, RAIO_SOLIDO_DA_TORRE } from './torreDePedra'

/** A torre ocupa esta fração da caixa (o resto é das asas e da cauda). */
const ESCALA_DA_TORRE = 0.74
/** O raio da parede em fração do menor meio lado da caixa: a pegada sólida. */
export const RAIO_SOLIDO_DA_TORRE_DO_DRAGAO = RAIO_SOLIDO_DA_TORRE * ESCALA_DA_TORRE
/** A altura do terraço da torre em lados dela (a mesma conta da `torreDePedra`). */
const ALTURA_DO_TERRACO_EM_LADOS = 0.767

/** A pátina do bronze (o verde das estátuas) e o escuro da membrana das asas. */
const VERDE_DA_PATINA: [number, number, number] = [0x6c, 0x8c, 0x78]
const ESCURO_DA_ASA: [number, number, number] = [0x3a, 0x30, 0x28]
const OLHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf0, 0xb8, 0x3c] }
const NARINA: MaterialDaPeca = { classe: 'liso', rgb: [0x22, 0x1c, 0x18] }
/** O lado de uma escama (px do protótipo). */
const ESCAMA = 0.075 * G
/** Quanto de pátina no máximo, e a régua das manchas. */
const PATINA = 0.55
const MANCHA_DA_PATINA = 0.085

/** A asa direita (x > 0) em fração do menor meio lado: o ombro, o pulso e a ponta, e as pontas dos dedos. */
const OMBRO: Ponto = [0.15, 0.06]
const PULSO: Ponto = [0.55, -0.16]
const PONTA_DA_ASA: Ponto = [0.97, -0.26]
const DEDOS: readonly Ponto[] = [[0.93, 0.06], [0.79, 0.27], [0.61, 0.36], [0.4, 0.33]]
/** As cavas da beira de trás da asa, entre um dedo e o outro (o recorte de morcego). */
const CAVAS: readonly Ponto[] = [[0.86, 0.1], [0.69, 0.25], [0.5, 0.27], [0.3, 0.22]]

/** A cauda: sai do tronco para trás, passa pelo parapeito e dá a volta por fora da parede (raio, ângulos em graus). */
const RAIO_DA_CAUDA = 0.68
const CAUDA_DE = -90
const CAUDA_ATE = 38
const GOMOS_DA_CAUDA = 12

/**
 * As ESCAMAS e a PÁTINA: meias-luas desencontradas (a de baixo encaixa entre duas de cima), com a beira escura, e o
 * verde da pátina em manchas que se juntam nas dobras (onde a escama é mais funda).
 */
const texDoDragao: Textura = (_u, _v, x, y, _p, s) => {
  const alto = ESCAMA * 0.72
  const fila = Math.floor(y / alto)
  const par = ((fila % 2) + 2) % 2
  const xx = x / ESCAMA + par * 0.5
  const fx = xx - Math.floor(xx) - 0.5
  const fy = y / alto - fila - 0.2
  const d = Math.sqrt(fx * fx + fy * fy * 0.8)
  s[3] += 0.09 * (0.42 - d) - (d > 0.47 ? 0.1 : 0)
  const mancha = ruido(x * MANCHA_DA_PATINA + 11, y * MANCHA_DA_PATINA + 5) + 0.35 * ruido(x * 0.3, y * 0.3 + 17)
  const verde = PATINA * passoSuave(0.05, 0.55, mancha + (d > 0.4 ? 0.25 : 0))
  s[0] += (VERDE_DA_PATINA[0] - s[0]) * verde
  s[1] += (VERDE_DA_PATINA[1] - s[1]) * verde
  s[2] += (VERDE_DA_PATINA[2] - s[2]) * verde
}

/** O ponto espelhado para a asa, a pata ou o chifre do lado esquerdo. */
function espelho([x, y]: Ponto, lado: 1 | -1): Ponto {
  return [x * lado, y]
}

/** A membrana da asa de um lado: do ombro ao pulso, à ponta e de volta pela beira recortada. */
function membrana(lado: 1 | -1, B: number): Forma {
  const beira: Ponto[] = [OMBRO, PULSO, PONTA_DA_ASA]
  DEDOS.forEach((dedo, i) => beira.push(dedo, CAVAS[i]))
  beira.push([0.17, 0.2])
  return poligono(beira.map((p) => espelho(p, lado)).map(([x, y]): Ponto => [x * B, y * B]))
}

/** O ponto da cauda no meio-gomo `t` (0 a raiz, 1 a ponta), em fração do menor meio lado. */
function pontoDaCauda(t: number): Ponto {
  // O primeiro quinto sai reto do tronco para trás até o parapeito; o resto dá a volta por fora, no raio da cauda.
  if (t < 0.2) {
    const k = t / 0.2
    return [0, -0.2 - (RAIO_DA_CAUDA - 0.2) * k]
  }
  const k = (t - 0.2) / 0.8
  const a = ((CAUDA_DE + (CAUDA_ATE - CAUDA_DE) * k) * Math.PI) / 180
  return [Math.cos(a) * RAIO_DA_CAUDA, Math.sin(a) * RAIO_DA_CAUDA]
}

export const montarTorreDoDragao: MontarMovel = (c, cena) => {
  // ---------- a torre, menor e sem o mastro ----------
  const pequena: ContextoDoMovel = { ...c, w: c.w * ESCALA_DA_TORRE, h: c.h * ESCALA_DA_TORRE, hw: c.hw * ESCALA_DA_TORRE, hh: c.hh * ESCALA_DA_TORRE }
  desenharTorreDePedra(pequena, cena, false)

  const P = c.peca
  const L = cena.partes
  const S = cena.sombras
  const B = Math.min(c.hw, c.hh)
  const e = ESPESSURA_DA_FIADA_DA_TORRE
  const zTerraco = ALTURA_DO_TERRACO_EM_LADOS * 2 * B * ESCALA_DA_TORRE
  const zAmeias = zTerraco + 3 * e
  const f = (v: number): number => v * B
  const pt = ([x, y]: Ponto): Ponto => [x * B, y * B]
  const bronze = c.m.dragao
  const metal = bronze.classe === 'metal' ? 0.3 : 0
  const membranaDaAsa: MaterialDaPeca = { ...bronze, rgb: misturar(bronze.rgb, ESCURO_DA_ASA, 0.38) }
  const doDragao = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: 2, contorno: 0.3, metal, textura: texDoDragao, semente, ...mais })

  // Cada tampo do dragão sai na 3/4 depois da torre inteira (a caixa vai além da frente dela), na ordem da lista.
  // O tronco, as patas de trás e a cauda do fundo ficam ATRÁS das ameias da frente: saem depois do terraço e das ameias do fundo
  // (que vão até 0,93 do raio da torre) e antes das da frente (0,96); por cima delas, a parede do tronco tapava
  // uns 3 px do alto das ameias da frente.
  const raioDaTorre = Math.min(pequena.hw, pequena.hh)
  let ordem = 0
  const tampo = (forma: Forma, z: number, forca = 0, atrasDasAmeias = false): void => {
    ordem += 1
    const ate = atrasDasAmeias ? raioDaTorre * (0.94 + 0.0005 * ordem) : B * (0.8 + 0.004 * ordem)
    S.push({ forma: esticadaParaAFrente(forma, ate, c.giro), z, solta: true, forca })
  }

  // ---------- a cauda: da raiz (por cima do parapeito de trás) à ponta, descendo por fora da parede ----------
  const zDaRaiz = zAmeias + e
  const zDaPonta = zTerraco * 0.32
  for (let i = 0; i < GOMOS_DA_CAUDA; i += 1) {
    const [t0, t1] = [i / GOMOS_DA_CAUDA, (i + 1) / GOMOS_DA_CAUDA]
    const [a, b] = [pt(pontoDaCauda(t0)), pt(pontoDaCauda(t1))]
    const raio = f(0.07 - 0.04 * t1)
    const gomo = capsula(a[0], a[1], b[0], b[1], raio)
    // Desce só depois do parapeito: até lá a cauda está deitada nele.
    const z = t1 <= 0.25 ? zDaRaiz : zDaRaiz + (zDaPonta - zDaRaiz) * ((t1 - 0.25) / 0.75)
    const meio: Ponto = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    // Os gomos do fundo (a raiz no parapeito e a volta por trás) saem com o tronco, antes dele: depois, tapavam o lombo.
    tampo(gomo, z, 0.24, meio[1] < 0)
    L.push(P(comMeioEm(gomo, meio[0], meio[1]), bronze, doDragao(18100 + i, { tom: 0.92 + 0.04 * hash(i, 2, 1810), bisel: raio * 0.8 })))
  }
  // A ponta em lança, deitada na direção da volta.
  const [px, py] = pontoDaCauda(1)
  const a = (CAUDA_ATE * Math.PI) / 180
  const [tx, ty] = [-Math.sin(a), Math.cos(a)]
  const [nx, ny] = [Math.cos(a), Math.sin(a)]
  const lanca = poligono(
    ([[0, -0.01], [0.07, 0.05], [0.12, 0], [0.07, -0.05]] as const).map(([u, v]): Ponto => pt([px + tx * u + nx * v, py + ty * u + ny * v])),
  )
  tampo(lanca, zDaPonta, 0.24)
  L.push(P(comMeioEm(lanca, f(px + tx * 0.06), f(py + ty * 0.06)), bronze, doDragao(18120, { tom: 1.02, bisel: 1.5 })))

  // ---------- as patas de trás, no terraço ----------
  for (const lado of [1, -1] as const) {
    const [ax, ay] = pt(espelho([0.12, -0.08], lado))
    const [bx, by] = pt(espelho([0.26, -0.22], lado))
    const coxa = uniao(capsula(ax, ay, bx, by, f(0.065)), elipse(bx, by + f(0.03), f(0.06), f(0.045)))
    tampo(coxa, zTerraco + 2 * e, 0, true)
    L.push(P(comMeioEm(coxa, (ax + bx) / 2, (ay + by) / 2), bronze, doDragao(18130 + lado, { tom: 0.86 })))
  }

  // ---------- o tronco: uma pilha de cinco tampos, o de cima com a sombra ----------
  const tronco = elipse(0, f(0.02), f(0.19), f(0.3))
  for (let k = 1; k <= 5; k += 1) tampo(tronco, zTerraco + k * e, k === 5 ? 0.3 : 0, true)

  // ---------- as asas abertas, um pouco abaixo do alto do tronco ----------
  const zDaAsa = zTerraco + 4 * e
  for (const lado of [1, -1] as const) {
    const asa = membrana(lado, B)
    tampo(asa, zDaAsa, 0.28)
    const [mx, my] = pt(espelho([0.6, 0.05], lado))
    L.push(P(comMeioEm(asa, mx, my), membranaDaAsa, doDragao(18140 + lado, { tom: 0.84, bisel: 1.2, contorno: 0.34 })))
    // Os ossos: o braço (grosso) até o pulso, e do pulso um dedo até a ponta e um até cada ponta da beira.
    const ossos: (readonly [Ponto, Ponto, number])[] = [[OMBRO, PULSO, 0.035], [PULSO, PONTA_DA_ASA, 0.022], ...DEDOS.map((d): readonly [Ponto, Ponto, number] => [PULSO, d, 0.016])]
    ossos.forEach(([de, ate, r], i) => {
      const [ax, ay] = pt(espelho(de, lado))
      const [bx, by] = pt(espelho(ate, lado))
      // O meio de cada osso é o da membrana: o braço e o dedo da ponta correm na beira da asa, e o meio deles cairia
      // fora dela, no chão da 3/4 (viravam varetas soltas no meio da parede).
      L.push(P(comMeioEm(capsula(ax, ay, bx, by, f(r)), mx, my), bronze, doDragao(18150 + i * 2 + (lado > 0 ? 0 : 1), { tom: 1.06, bisel: f(r) })))
    })
  }

  // O tronco (por cima das raízes das asas) e os espinhos do lombo, da nuca à raiz da cauda.
  L.push(P(tronco, bronze, doDragao(18160, { tom: 0.98, bisel: f(0.08) })))
  for (let i = 0; i < 6; i += 1) {
    const y = f(0.2 - i * 0.085)
    const r = f(0.035 - 0.003 * i)
    const espinho = poligono([[-r * 0.7, y + r * 0.6], [0, y - r * 1.3], [r * 0.7, y + r * 0.6]])
    L.push(P(comMeioEm(espinho, 0, y), bronze, doDragao(18170 + i, { tom: 1.12, bisel: r * 0.5, contorno: 0.36 })))
  }

  // ---------- as patas da frente, agarradas no parapeito, com as garras por cima ----------
  for (const lado of [1, -1] as const) {
    const [ax, ay] = pt(espelho([0.12, 0.16], lado))
    const [bx, by] = pt(espelho([0.2, 0.47], lado))
    const braco = capsula(ax, ay, bx, by, f(0.055))
    tampo(braco, zAmeias + e)
    L.push(P(comMeioEm(braco, (ax + bx) / 2, (ay + by) / 2), bronze, doDragao(18180 + lado, { tom: 0.94 })))
    for (let g = -1; g <= 1; g += 1) {
      const [gx, gy] = [bx + f(0.03) * g, by + f(0.06)]
      L.push(P(elipseGirada(gx, gy, f(0.014), f(0.03), 0.25 * g), bronze, { bisel: f(0.012), contorno: 0.36, tom: 1.18, metal, semente: 18185 + g + lado * 3 }))
    }
  }

  // ---------- o pescoço, em dois gomos que sobem, e a cabeça por cima da porta ----------
  const pescoco: readonly (readonly [Ponto, Ponto, number])[] = [
    [[0, 0.22], [0, 0.42], zTerraco + 6 * e],
    [[0, 0.42], [0, 0.6], zTerraco + 7 * e],
  ]
  pescoco.forEach(([de, ate, z], i) => {
    const gomo = capsula(f(de[0]), f(de[1]), f(ate[0]), f(ate[1]), f(0.08 - 0.008 * i))
    tampo(gomo, z)
    L.push(P(comMeioEm(gomo, 0, f((de[1] + ate[1]) / 2)), bronze, doDragao(18190 + i, { tom: 0.96 + 0.04 * i })))
  })
  const cranio = elipse(0, f(0.67), f(0.1), f(0.12))
  const focinho = capsula(0, f(0.7), 0, f(0.86), f(0.062))
  const chifres = [1, -1].map((lado) => poligono(([[0.035, 0.6], [0.085, 0.63], [0.15, 0.44]] as const).map(([x, y]): Ponto => [f(x) * lado, f(y)])))
  const cabeca = uniao(uniao(cranio, focinho), uniao(chifres[0], chifres[1]))
  tampo(cabeca, zTerraco + 8 * e, 0.3)
  L.push(P(comMeioEm(cranio, 0, f(0.68)), bronze, doDragao(18200, { tom: 1.0, bisel: f(0.06) })))
  L.push(P(comMeioEm(focinho, 0, f(0.78)), bronze, doDragao(18201, { tom: 1.06, bisel: f(0.045) })))
  chifres.forEach((chifre, i) => {
    L.push(P(comMeioEm(chifre, f(0.09) * (i === 0 ? 1 : -1), f(0.56)), bronze, { bisel: f(0.015), contorno: 0.36, tom: 1.2, metal, semente: 18202 + i }))
  })
  for (const lado of [1, -1] as const) {
    L.push(P(elipse(f(0.05) * lado, f(0.665), f(0.022), f(0.014)), OLHO, { bisel: f(0.01), contorno: 0.4, tom: 1.05, semente: 18205 + lado }))
    L.push(P(elipse(f(0.022) * lado, f(0.85), f(0.01), f(0.008)), NARINA, { bisel: 0, contorno: 0, semente: 18208 + lado }))
  }
}
