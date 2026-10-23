/**
 * POÇO de cima com volume (peça nova da MT4), portado do poço do protótipo da
 * vila (função `poco`): a boca de água escura (a borda de pedra faz sombra do
 * lado da luz), um reflexo fraco, a borda de doze pedras em anel com folga
 * entre elas, os dois esteios e o sarilho de madeira com a corda enrolada, e
 * o balde em cima da borda. A vila desenhava com raio 26 e o sarilho de 63 de
 * ponta a ponta; aqui tudo escala para a pegada (1,5 x 1,5 casa). Materiais:
 * `pedras` e `madeira`; a água, a corda e os aros do balde são fixos.
 */
import { anel, caixa, elipse, type Caixa, type Forma } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** A água do fundo: o azul-petróleo do Meio-Termo bem escuro, mas acima do piso de luz (não vira preto levantado). */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.62)) }
const AGUA_DO_BALDE: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.9)) }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xc7, 0xd2, 0xcf] }
const PEDRAS_NA_BORDA = 12
/**
 * Tom mínimo de cada pedra da borda: o topo dela pega a luz de cima. Com 0,9
 * (o da vila) a borda de ardósia ficava só 0,117 mais clara que a água; a
 * borda precisa ler bem mais clara que a boca escura.
 */
const TOM_DAS_PEDRAS = 0.98
/** Raio da borda e da água na vila; o sarilho e o balde seguem a mesma escala. */
const R_DA_VILA = 26
const r_DA_VILA = 17

/** Setor de anel (uma pedra da borda), com `folga` entre as pedras. */
function setor(r0: number, r1: number, a0: number, da: number, folga: number): Forma {
  const am = a0 + da / 2
  const meio = da / 2
  const rm = (r0 + r1) / 2
  const meiaEspessura = (r1 - r0) / 2
  const xs: number[] = []
  const ys: number[] = []
  for (const a of [a0, a0 + da, am]) {
    for (const r of [r0, r1]) {
      xs.push(Math.cos(a) * r)
      ys.push(Math.sin(a) * r)
    }
  }
  const b: Caixa = [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1]
  return {
    b,
    d(x, y) {
      const rr = Math.hypot(x, y)
      let a = Math.atan2(y, x) - am
      a -= 2 * Math.PI * Math.round(a / (2 * Math.PI))
      return Math.max(Math.abs(rr - rm) - meiaEspessura, (Math.abs(a) - meio) * rr + folga / 2)
    },
  }
}

/** 0..1 fixo por pedra: o tom de cada uma. */
function tomDaPedra(i: number): number {
  const s = Math.sin(i * 12.9898 + 77.233) * 43758.5453
  return s - Math.floor(s)
}

export const montarPoco: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / 32.5
  const R = R_DA_VILA * k
  const r = r_DA_VILA * k
  /** A borda de pedra faz sombra na água do lado da luz (cima à esquerda). */
  const texAgua: Textura = (_u, _v, x, y, _p, s) => {
    const d = Math.hypot(x + 4.2 * k, y + 3.4 * k) - r
    s[3] += -0.45 * Math.max(0, Math.min(1, 0.5 + d / (3 * k))) + ruido(x * 0.3, y * 0.3) * 0.08
  }
  cena.sombras.push({ forma: elipse(0, 0, R, R), z: 7 * k }, contato(elipse(0, 0, R, R), 0.32))
  const L = cena.partes
  L.push(P(elipse(0, 0, r + 0.6 * k, r + 0.6 * k), AGUA, { bisel: 0, contorno: 0, textura: texAgua, semente: 300 }))
  L.push(P(elipse(4.5 * k, 6 * k, 5.5 * k, 1.8 * k), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.16, suave: 1.8 * k }))
  for (let i = 0; i < PEDRAS_NA_BORDA; i += 1) {
    const a0 = (i / PEDRAS_NA_BORDA) * 2 * Math.PI + 0.13
    L.push(P(setor(r, R, a0, (2 * Math.PI) / PEDRAS_NA_BORDA, 0.9 * k), c.m.pedras, { tabua: 0, bisel: 3.2 * k, tom: TOM_DAS_PEDRAS + 0.14 * tomDaPedra(i), contorno: 0.26, semente: 301 + i }))
  }
  const mad = c.m.madeira
  for (const lado of [-1, 1]) L.push(P(caixa(lado * 29 * k - 3.4 * k, -5.6 * k, lado * 29 * k + 3.4 * k, 1.4 * k, 1), mad, { bisel: 1.5 * k, tabua: 0, tom: 0.82, semente: 320 + lado }))
  L.push(P(caixa(-31.5 * k, -4.2 * k, 31.5 * k, -0.2 * k, 0.8), mad, { bisel: 1.3 * k, tabua: 0, eixo: 0, semente: 330, projeta: { dist: 3 * k, forca: 0.32 } }))
  L.push(P(elipse(0, -2.2 * k, 3.6 * k, 3.6 * k), materialDaPeca('corda'), { bisel: 3 * k, semente: 331 }))
  // O balde em cima da borda, embaixo à direita: madeira, aro de ferro e água.
  const bx = 17.5 * k
  const by = 15.5 * k
  L.push(P(elipse(bx, by, 5.2 * k, 5.2 * k), mad, { bisel: 2.2 * k, tabua: 2.4 * k, semente: 340, projeta: { dist: 1.5 * k, forca: 0.3 } }))
  L.push(P(anel(bx, by, 5.3 * k, 5.3 * k, 4.4 * k, 4.4 * k), materialDaPeca('ferro'), { bisel: 0.6 * k, semente: 341 }))
  L.push(P(elipse(bx, by, 3.6 * k, 3.6 * k), AGUA_DO_BALDE, { bisel: 0, contorno: 0.2, tom: 1.05 }))
}
