/**
 * CENTRO DE MESA (lote L2 das referências, 16/11/2026, das parciais: versão original, só a ideia). A bandeja oval de
 * metal com a beira levantada; no meio, a fruteira de pé alto cheia (maçãs, peras, dois cachos de uva e as folhas),
 * e nas duas pontas um castiçal torneado com a vela acesa. Vai em cima da mesa comprida do banquete, da sala de
 * jantar ou da taverna boa.
 *
 * Mora no tampo da mesa, como os pratos: posto no mapa, fica em cima da mesa que já está lá. As duas vistas saem da
 * PILHA DE FATIAS (`pilhaDeFatias.ts`) com todas as alturas contadas a partir do tampo (`ALTURA_DA_MESA_DO_CENTRO`):
 * na 3/4 as frutas são bolas de verdade (a luz de cada uma sai da normal da esfera) e os castiçais sobem. Perfil da
 * 3/4: `{ modo: 'derivado', espessura: 0, alturaSolta: ALTURA_DA_MESA_POSTA, sombrasSobem: true }` (a sombra cai no
 * tampo, não no chão debaixo da mesa). Material: `metal` (a bandeja, a fruteira e os castiçais); frutas, folhas, cera
 * e chama são fixas.
 */
import { hash } from '../../ruido'
import { anel, elipse, elipseGirada } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { alturas, novoFatiador, type Fatiador } from './pilhaDeFatias'
import { acesa, CERA, CHAMA, disco, lisa, luzDaNormal } from './apoioDasReferencias'

/**
 * A altura do tampo da mesa em que o centro fica, em casas: a mesma de `ALTURA_DA_MESA_POSTA` (`tresQuartos.ts`; não
 * importada de lá para não fechar um ciclo quando o perfil importar daqui).
 */
export const ALTURA_DA_MESA_DO_CENTRO = 0.56 * G

/**
 * As frutas e as folhas, fixas: maçã, pera, uva e o verde da folha. Contidas de propósito: com a maçã vermelha viva
 * (#a33b2f) a saturação p95 do objeto passava do teto de 0,62 da folha.
 */
const MACA: MaterialDaPeca = { classe: 'liso', rgb: [0x96, 0x4e, 0x45] }
const PERA: MaterialDaPeca = { classe: 'liso', rgb: [0xb0, 0xa6, 0x66] }
const UVA: MaterialDaPeca = { classe: 'liso', rgb: [0x5b, 0x3a, 0x5f] }
const FOLHA: MaterialDaPeca = { classe: 'folha', rgb: [0x55, 0x6b, 0x3a] }
/** As frutas na fruteira (x, y em fração do raio dela; raio em px; qual): as de baixo primeiro. */
const FRUTAS: readonly (readonly [number, number, number, MaterialDaPeca])[] = [
  [-0.42, -0.2, 3.1, MACA],
  [0.38, -0.28, 3, PERA],
  [0.05, 0.42, 3.2, MACA],
  [-0.3, 0.38, 2.8, PERA],
  [0.45, 0.3, 2.9, MACA],
  [0, -0.05, 3.3, MACA],
]
/** Os cachos de uva: o meio (fração do raio da fruteira) e o lado para onde o cacho cai. */
const CACHOS: readonly (readonly [number, number, number])[] = [
  [-0.75, 0.1, Math.PI],
  [0.72, -0.05, 0],
]
const BAGO = 1.25
/** O castiçal: a distância do meio (fração do meio lado), a altura do fuste (px) e a da vela. */
const CASTICAL = { lugar: 0.66, fuste: 11, vela: 10, chama: 3.2 } as const

export const montarCentroDeMesa: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const metal = c.m.metal
  const f: Fatiador = novoFatiador(P, cena, c.giro)
  const q = f.q
  const M = ALTURA_DA_MESA_DO_CENTRO
  const [rx, ry] = [hw * 0.94, hh * 0.84]

  /** A luz do metal torneado: a normal de lado (em volta do eixo em cx, cy), um pouco para cima. */
  const torneado = (cx: number, cy: number, nz: number): Textura => (_u, _v, x, y, _p, s) => {
    const a = Math.atan2(y - cy, x - cx)
    s[3] += luzDaNormal(Math.cos(a), Math.sin(a), nz, q) * 1.5
  }

  // A BANDEJA: o fundo e a beira levantada (o anel, com o friso claro em cima).
  for (const z of alturas(M, M + 1, 1)) f.fatia(0, z, elipse(0, 0, rx, ry), metal, z >= M + 1 - 1e-6 ? { tabua: 0, bisel: 0.6, tom: 0.9, contorno: 0.2, semente: 6001 } : lisa(0.84, torneado(0, 0, 0), 6000))
  for (const z of alturas(M + 1, M + 2.2, 0.6)) {
    const topo = z >= M + 2.2 - 1e-6
    f.fatia(0, z, anel(0, 0, rx, ry, rx - 1.6, ry - 1.6), metal, topo ? { tabua: 0, bisel: 0.7, tom: 1.08, contorno: 0.22, semente: 6002 } : lisa(0.9, torneado(0, 0, 0), 6003))
  }

  // A FRUTEIRA de pé: o pé, a haste e a taça que abre até a boca.
  const rTaca = Math.min(ry * 0.92, 8.5)
  const perfilDaTaca = (h: number): number => (h < 1.2 ? 3.4 : h < 3.6 ? 1.5 + 0.3 * Math.sin(h * 2.2) : 2 + (rTaca - 2) * Math.sin(Math.min(1, (h - 3.6) / 3.4) * Math.PI * 0.5))
  const bocaDaTaca = 7
  for (const h of alturas(0, bocaDaTaca, 0.5)) {
    const topo = h >= bocaDaTaca - 1e-6
    const r = perfilDaTaca(h)
    f.fatia(1, M + 2.2 + h, topo ? anel(0, 0, r, r, r - 0.9, r - 0.9) : disco(0, 0, r), metal, topo ? { tabua: 0, bisel: 0.5, tom: 1.1, contorno: 0.22, semente: 6010 } : lisa(0.92, torneado(0, 0, h > 3.6 ? -0.5 : 0), 6011))
  }
  const zFruta = M + 2.2 + bocaDaTaca - 2.2

  // As FOLHAS saindo da boca da fruteira.
  for (let k = 0; k < 5; k += 1) {
    const a = k * 1.3 + 0.4
    const [lx, ly] = [Math.cos(a) * rTaca * 0.92, Math.sin(a) * rTaca * 0.92]
    f.fatia(2, zFruta + 1.4, elipseGirada(lx, ly, 3.2, 1.3, a), FOLHA, { tabua: 0, bisel: 0.6, tom: 0.9 + 0.12 * hash(k, 1, 6020), contorno: 0.22, semente: 6021 + k })
  }

  /** Uma bola em fatias, com a luz da esfera: a beira (o maior corte) leva o contorno da silhueta. */
  const bola = (camada: number, cx: number, cy: number, cz: number, r: number, mat: MaterialDaPeca, semente: number, passo: number) => {
    const esfera: Textura = (_u, _v, x, y, _p, s) => {
      const [dx, dy] = [(x - cx) / r, (y - cy) / r]
      const nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy))
      s[3] += luzDaNormal(dx, dy, nz, q) * 1.8
      // O brilho pequeno da casca, do lado da luz.
      const [sx, sy] = [dx + 0.38, dy + 0.38]
      if (sx * sx + sy * sy < 0.05) s[3] += 0.14
    }
    const cortes = alturas(cz - r * 0.75, cz + r * 0.92, passo)
    const maior = cortes.reduce((m, z) => (Math.abs(z - cz) < Math.abs(m - cz) ? z : m), cortes[0])
    for (const z of cortes) {
      const rr = Math.sqrt(Math.max(0, r * r - (z - cz) * (z - cz)))
      if (rr < 0.35) continue
      f.fatia(camada, z, disco(cx, cy, rr), mat, z === maior ? { tabua: 0, bisel: 0, contorno: 0.18, tom: 1, textura: esfera, semente } : lisa(1, esfera, semente))
    }
  }
  FRUTAS.forEach(([fx, fy, r, mat], i) => bola(2, fx * rTaca, fy * rTaca, zFruta + r * (i === FRUTAS.length - 1 ? 1.5 : 0.9), r, mat, 6030 + i, 0.6))
  CACHOS.forEach(([fx, fy, lado], j) => {
    for (let k = 0; k < 7; k += 1) {
      // O cacho cai pela beira: cada bago mais para fora e mais baixo.
      const fila = Math.floor(k / 2)
      const [bx, by] = [fx * rTaca + Math.cos(lado) * fila * 1.7, fy * rTaca + (k % 2 === 0 ? -1 : 1) * 1.1 + Math.sin(lado) * fila]
      bola(2, bx, by, zFruta + 2.4 - fila * 1.1, BAGO, UVA, 6040 + j * 10 + k, 0.5)
    }
  })

  // Os CASTIÇAIS nas pontas: o pé redondo, o fuste com os anéis, o copinho, a vela e a chama.
  for (const lado of [-1, 1]) {
    const [cx, cy] = [lado * hw * CASTICAL.lugar, 0]
    const perfilDoFuste = (h: number): number => (h < 1.2 ? 3.2 - h * 0.8 : h > CASTICAL.fuste - 1.2 ? 2.3 : 0.95 + 0.55 * Math.abs(Math.sin(h * 0.75)))
    for (const h of alturas(0, CASTICAL.fuste, 0.5)) {
      const topo = h >= CASTICAL.fuste - 1e-6
      f.fatia(1, M + 2.2 + h, disco(cx, cy, perfilDoFuste(h)), metal, topo ? { tabua: 0, bisel: 0.5, tom: 1.1, contorno: 0.22, semente: 6050 } : lisa(0.94, torneado(cx, cy, 0), 6051))
    }
    const zVela = M + 2.2 + CASTICAL.fuste
    for (const h of alturas(0, CASTICAL.vela, 0.5)) {
      const topo = h >= CASTICAL.vela - 1e-6
      f.fatia(3, zVela + h, disco(cx, cy, 1.25), CERA, topo ? { tabua: 0, bisel: 0.4, tom: 1, contorno: 0.2, semente: 6060 } : lisa(0.95, torneado(cx, cy, 0), 6061))
    }
    for (const h of alturas(0.3, CASTICAL.chama, 0.4)) {
      const t = h / CASTICAL.chama
      const r = 0.85 * Math.sin(Math.PI * Math.min(1, t * 1.25)) + 0.15
      f.fatia(4, zVela + CASTICAL.vela + h, elipse(cx, cy, r, r), CHAMA, { tabua: 0, bisel: 0, contorno: 0, tom: 1 - 0.1 * t, textura: acesa(0.92), semente: 6070 })
    }
  }
  f.fechar()

  // A sombra da bandeja e a da fruteira no tampo (o perfil sobe as duas até ele).
  cena.sombras.push(contato(elipse(0, 0, rx, ry), 0.26), contato(elipse(1.5, 1.2, rTaca * 1.1, rTaca * 0.9), 0.2))
}
