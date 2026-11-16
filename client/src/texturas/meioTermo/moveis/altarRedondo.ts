/**
 * ALTAR REDONDO (lote L2 das referências, 16/11/2026: versão original, só a ideia do objeto; o altar de sempre é o
 * retangular de `altar.ts`). O tambor de pedra sobre o DEGRAU redondo de lajes, com a moldura do pé, o FRISO
 * entalhado no meio (doze painéis rebaixados, um anel e uma ponta de flecha alternados: geometria, nenhum símbolo
 * de religião de verdade) e a cornija que passa um pouco do tambor. Em cima, a laje com o anel gravado e os entalhes
 * em volta; no meio, o CACHO DE CRISTAIS VERDES que brilham (a luz deles pinta a pedra em volta), e na beira cinco
 * VELAS acesas, cada uma com a poça de cera.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): o degrau, as molduras e o tambor são discos em fatias,
 * e a 3/4 mostra a frente redonda com o friso entalhado de verdade (a textura de cada fatia desenha o painel naquela
 * altura); os cristais são prismas de seis faces que afinam até a ponta, inclinados, e as velas, colunas de cera com
 * a chama no alto. A luz das faces vem da normal levada para a tela (`luzDaNormal`), nos quatro giros.
 *
 * As medidas saem do menor meio lado (o altar esticado continua redondo). Perfil da 3/4:
 * `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`; o verde dos cristais, a cera e a chama são fixos.
 * Nenhuma luz de verdade no mapa: o brilho é pintado (o integrador pode ligar uma luz verde fraca, como o lustre).
 */
import { hash } from '../../ruido'
import { elipse, poligono, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, sombraDoCilindro, type Fatiador } from './pilhaDeFatias'
import { acesa, CERA, CHAMA, disco, ESCURO_DA_PEDRA, lisa, luzDaNormal } from './apoioDasReferencias'

/** Os raios, em fração do menor meio lado: o degrau, a moldura do pé, o tambor e a cornija. */
const RAIO_DO_DEGRAU = 0.98
const RAIO_DO_PE = 0.82
const RAIO_DO_TAMBOR = 0.75
const RAIO_DA_CORNIJA = 0.86
/** As alturas (casas): o alto do degrau, da moldura do pé, do tambor, da cornija e da laje de cima. */
const Z = { degrau: 0.09, pe: 0.16, tambor: 0.62, cornija: 0.69, laje: 0.75 } as const
/** O friso: de onde a onde ele vai no tambor (fração da altura do tambor) e quantos painéis dão a volta. */
const FRISO = { de: 0.22, ate: 0.78, paineis: 12 } as const
/** O passo das fatias (px do protótipo) e o das peças pequenas (velas, cristais). */
const PASSO = 0.8
const PASSO_FINO = 0.5
/** As lajes do degrau. */
const LAJES = 8
/** Os cristais: o verde frio e claro (a ponta acende mais) e o brilho pintado na laje. */
const VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0x6f, 0xc4, 0x92] }
const BRILHO_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0x9b, 0xe0, 0xb4] }
/** Cada cristal: ângulo e distância do meio (fração do raio do cacho), raio, altura (px) e inclinação (px por px). */
const CRISTAIS: readonly (readonly [number, number, number, number, number, number])[] = [
  [0, 0, 3.1, 17, 0.05, -0.08],
  [2.2, 0.62, 2.4, 12, 0.22, 0.12],
  [4.1, 0.7, 2.2, 10.5, -0.2, 0.14],
  [5.6, 0.55, 1.9, 8.5, 0.12, -0.24],
  [1.0, 0.75, 1.6, 7, 0.26, -0.05],
]
/** As velas: quantas, a altura de cada uma (px), o raio e a chama. */
const VELAS = [11, 8, 9.5, 7, 10] as const
const RAIO_DA_VELA = 2
const CHAMA_ALTA = 3.4

/** O ângulo do ponto (x, y) do objeto em volta do meio. */
function angulo(x: number, y: number): number {
  return Math.atan2(y, x)
}

export const montarAltarRedondo: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f: Fatiador = novoFatiador(P, cena, c.giro)
  const q = f.q
  const daPedra = texturaDaClasse(pedra.classe)
  const R = Math.min(hw, hh)
  cena.corDoPiso = ESCURO_DA_PEDRA
  const [zDegrau, zPe, zTambor, zCornija, zLaje] = [g * Z.degrau, g * Z.pe, g * Z.tambor, g * Z.cornija, g * Z.laje]
  const rTambor = R * RAIO_DO_TAMBOR
  const rCornija = R * RAIO_DA_CORNIJA

  const comPedra = (luz: (x: number, y: number) => number): Textura => (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    s[3] += luz(x, y)
  }
  const doLado = (nz: number) => comPedra((x, y) => {
    const a = angulo(x, y)
    return luzDaNormal(Math.cos(a), Math.sin(a), nz, q)
  })

  // O DEGRAU: as lajes em volta (as juntas de raio a raio) e a beira.
  const rDegrau = R * RAIO_DO_DEGRAU
  for (const z of alturas(0, zDegrau, 1.2)) {
    const topo = z >= zDegrau - 1e-6
    const juntas = comPedra((x, y) => {
      const a = angulo(x, y) + 0.2
      const junta = Math.abs(Math.sin((a * LAJES) / 2))
      const laje = Math.floor(((a + Math.PI) / (2 * Math.PI)) * LAJES)
      return (junta < 0.05 ? -0.3 : 0) + 0.06 * (hash(laje, 1, 5601) - 0.5) + (Math.hypot(x, y) > rDegrau - 1.4 ? -0.06 : 0)
    })
    f.fatia(0, z, disco(0, 0, rDegrau), pedra, topo ? { tabua: 0, bisel: 1.2, tom: 0.86, contorno: 0.26, textura: juntas, semente: 5602 } : lisa(0.8, doLado(0), 5603))
  }

  // A MOLDURA DO PÉ: o anel bojudo que leva do degrau ao tambor.
  for (const z of alturas(zDegrau, zPe, PASSO)) {
    const t = (z - zDegrau) / (zPe - zDegrau)
    const r = rTambor + (R * RAIO_DO_PE - rTambor) * Math.cos(t * Math.PI * 0.5)
    f.fatia(0, z, disco(0, 0, r), pedra, lisa(0.94, doLado(0.6 - t), 5610))
  }

  // O TAMBOR com o FRISO: cada fatia desenha o painel do friso na altura dela (o rebaixo, o anel ou a flecha).
  const de = zPe + (zTambor - zPe) * FRISO.de
  const ate = zPe + (zTambor - zPe) * FRISO.ate
  const meioDoFriso = (de + ate) / 2
  const altoDoFriso = (ate - de) / 2
  const passoDoPainel = (2 * Math.PI) / FRISO.paineis
  for (const z of alturas(zPe, zTambor, PASSO)) {
    const noFriso = z >= de && z <= ate
    const friso = comPedra((x, y) => {
      const a = angulo(x, y)
      let luz = luzDaNormal(Math.cos(a), Math.sin(a), 0, q)
      // Os frisos finos de cima e de baixo do painel.
      if (Math.abs(z - de) < 0.9 || Math.abs(z - ate) < 0.9) return luz - 0.16
      if (!noFriso) return luz
      const k = Math.floor((a + Math.PI) / passoDoPainel)
      const local = (a + Math.PI) / passoDoPainel - k - 0.5
      const u = local * passoDoPainel * rTambor
      const v = z - meioDoFriso
      const meiaLarg = passoDoPainel * rTambor * 0.36
      // Fora do painel: a pedra lisa entre os rebaixos.
      if (Math.abs(u) > meiaLarg || Math.abs(v) > altoDoFriso - 1.4) return luz + 0.03
      luz -= 0.14
      if (k % 2 === 0) {
        // O anel em relevo.
        const rr = Math.hypot(u, v)
        if (Math.abs(rr - altoDoFriso * 0.5) < 0.9) luz += 0.26
      } else if (Math.abs(u) < (altoDoFriso - 1.4 - v) * 0.55 && v > -altoDoFriso * 0.55) {
        // A ponta de flecha para cima.
        luz += 0.22
      }
      return luz
    })
    f.fatia(0, z, disco(0, 0, rTambor), pedra, lisa(0.92, friso, 5620))
  }

  // A CORNIJA: o bojo que passa do tambor e a laje de cima, com o anel gravado e os entalhes.
  for (const z of alturas(zTambor, zCornija, PASSO)) {
    const t = (z - zTambor) / (zCornija - zTambor)
    const r = rTambor + (rCornija - rTambor) * Math.sin(t * Math.PI * 0.5)
    f.fatia(0, z, disco(0, 0, r), pedra, lisa(0.96, doLado(-0.4 + t), 5630))
  }
  const rCacho = R * 0.18
  const tampo = comPedra((x, y) => {
    const rr = Math.hypot(x, y)
    const a = angulo(x, y)
    let luz = 0
    if (Math.abs(rr - rCornija * 0.74) < 0.9) luz -= 0.26
    if (rr > rCornija * 0.74 + 0.9 && rr < rCornija * 0.86 && Math.abs(Math.sin(a * 12)) < 0.12) luz -= 0.2
    // A luz verde dos cristais na pedra em volta deles.
    luz += 0.22 * Math.exp(-((rr / (rCacho * 2.4)) ** 2))
    return luz + 0.05 * ruido(x * 0.4, y * 0.4)
  })
  for (const z of alturas(zCornija, zLaje, PASSO)) {
    const topo = z >= zLaje - 1e-6
    f.fatia(0, z, disco(0, 0, rCornija), pedra, topo ? { tabua: 0, bisel: 1.5, tom: 1.02, contorno: 0.28, textura: tampo, semente: 5640 } : lisa(0.9, doLado(0), 5641))
  }

  // O brilho verde na laje, debaixo dos cristais (o halo da luz deles).
  f.fatia(1, zLaje + 0.05, elipse(0, 0, rCacho * 1.9, rCacho * 1.9), BRILHO_VERDE, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.34, suave: rCacho * 1.2, textura: acesa(0.6), semente: 5650 })

  // Os CRISTAIS: prismas de seis faces, inclinados, que afinam até a ponta; a ponta acende.
  CRISTAIS.forEach(([a, d, rc, alto, ix, iy], i) => {
    const [bx, by] = [Math.cos(a) * d * rCacho, Math.sin(a) * d * rCacho]
    for (const h of alturas(0, alto, PASSO_FINO)) {
      const t = h / alto
      const r = t < 0.68 ? rc : rc * (1 - (t - 0.68) / 0.32)
      if (r < 0.25) continue
      const [cx, cy] = [bx + ix * h, by + iy * h]
      const pontos: Ponto[] = []
      for (let k = 0; k < 6; k += 1) pontos.push([cx + Math.cos((k * Math.PI) / 3 + i) * r, cy + Math.sin((k * Math.PI) / 3 + i) * r])
      const faces: Textura = (_u, _v, x, y, _p, s) => {
        const fa = Math.round((angulo(x - cx, y - cy) - i) / (Math.PI / 3)) * (Math.PI / 3) + i
        s[3] += luzDaNormal(Math.cos(fa), Math.sin(fa), t > 0.68 ? 0.8 : 0, q) * 1.6
        s[4] = 0.28 + 0.4 * t
      }
      f.fatia(2, zLaje + h, poligono(pontos), VERDE, { tabua: 0, bisel: t > 0.9 ? 0.4 : 0, contorno: t > 0.9 ? 0.2 : 0, tom: 0.92 + 0.12 * t, textura: faces, semente: 5660 + i })
    }
  })

  // As VELAS na beira da laje, com a poça de cera, o corpo e a chama.
  VELAS.forEach((alto, i) => {
    const a = -Math.PI / 2 + ((i + 0.5) / VELAS.length) * 2 * Math.PI + 0.3
    const rv = rCornija * 0.6
    const [vx, vy] = [Math.cos(a) * rv, Math.sin(a) * rv]
    f.fatia(1, zLaje + 0.1, elipse(vx + 0.6, vy + 0.4, RAIO_DA_VELA * 1.9, RAIO_DA_VELA * 1.6), CERA, { tabua: 0, bisel: 0.6, contorno: 0.16, tom: 0.92, semente: 5670 + i })
    const corpo: Textura = (_u, _v, x, y, _p, s) => {
      const b = angulo(x - vx, y - vy)
      s[3] += luzDaNormal(Math.cos(b), Math.sin(b), 0, q)
    }
    for (const h of alturas(0, alto, PASSO_FINO)) {
      const topo = h >= alto - 1e-6
      f.fatia(2, zLaje + h, disco(vx, vy, RAIO_DA_VELA - (topo ? 0.2 : 0)), CERA, topo ? { tabua: 0, bisel: 0.6, contorno: 0.2, tom: 1, semente: 5680 + i } : lisa(0.94, corpo, 5690 + i))
    }
    for (const h of alturas(0.3, CHAMA_ALTA, PASSO_FINO)) {
      const t = h / CHAMA_ALTA
      const r = 0.95 * Math.sin(Math.PI * Math.min(1, t * 1.25)) + 0.15
      f.fatia(3, zLaje + alto + h, elipse(vx, vy, r, r), CHAMA, { tabua: 0, bisel: 0, contorno: 0, tom: 1 - 0.1 * t, textura: acesa(0.92), semente: 5700 + i })
    }
  })
  f.fechar()

  // A sombra comprida do tambor, a do degrau e o contato.
  cena.sombras.push(sombraDoCilindro(0, 0, rCornija * 0.96, zLaje, q, 0.24, 2), contato(disco(0, 0, rDegrau), 0.32))
}
