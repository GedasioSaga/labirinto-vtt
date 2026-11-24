/**
 * ESTRADO EM MEIA-LUA (lote L05 de 24/11/2026, item 50: construção, do fundo da nave da cripta do mapa 8; desenho
 * próprio, só a ideia do objeto). Três DEGRAUS semicirculares de pedra clara, encostados na parede pelo lado reto (o
 * lado de cima da pegada): o anel de baixo, o do meio e o patamar de cima, cada um mais alto. Os dois anéis são de
 * blocos em leque, com as juntas escuras; o patamar é de quatro lajes em cunha com a faixa de pedra embutida perto da
 * beira. Cada degrau faz sombra no de baixo, as beiras têm lascas e o musgo junta nos cantos da parede. Não barra.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura, pintada do norte para o sul; cada peça sobe com a
 * estrutura mais alta que contém o meio da caixa dela) cada degrau é uma coluna da altura dele, pintada antes do
 * degrau de baixo (que cobre o pé dela, como no degrau de verdade). Os anéis vão em duas metades, a da esquerda e a da
 * direita no desenho: girado um quarto de volta, o anel fica deitado na tela e, inteiro, seria pintado depois do
 * degrau de cima e cobriria a beira dele. O meio da caixa de cada bloco é posto no próprio bloco (`comMeioEm`): a
 * caixa de um setor de anel tem o meio no vão de dentro, no degrau de cima.
 * Material: `pedra`; o musgo é fixo.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, dentroDe, elipse, menos, poligono, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** Os raios dos degraus, em fração do raio de fora, e a altura de cada degrau (casas). */
const RAIO_DO_MEIO = 0.71
const RAIO_DE_CIMA = 0.43
const ALTURA_DO_DEGRAU = 0.1
/** Os blocos de cada anel (par: uma junta cai no meio) e as lajes do patamar. */
const BLOCOS_DE_BAIXO = 10
const BLOCOS_DO_MEIO = 8
const LAJES_DE_CIMA = 4
/** A junta entre os blocos (px) e a faixa embutida do patamar (px a partir da beira e largura). */
const JUNTA = 0.9
const FAIXA = 4.4
const LARGURA_DA_FAIXA = 1.5
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/**
 * A sombra que cada degrau faz no de baixo. Mais comprida e mais forte que a da altura de verdade (1,5 px a 0,32): de
 * cima, com ela fraca, os três degraus liam como um piso plano em leque. O tom sobe de degrau em degrau pelo mesmo
 * motivo: o de cima, mais perto da luz, é o mais claro.
 */
const SOMBRA_DO_DEGRAU = { dist: 2.3, forca: 0.42 }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** A mesma forma com a caixa esticada até o meio dela cair em (cx, cy): muda só a estrutura da 3/4 em que ela sobe. */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const [x0, y0, x1, y1] = f.b
  const rx = Math.max(cx - x0, x1 - cx)
  const ry = Math.max(cy - y0, y1 - cy)
  return { b: [cx - rx, cy - ry, cx + rx, cy + ry], d: f.d }
}

export const montarEstradoEmMeiaLua: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  // O centro da meia-lua fica no meio do lado da parede.
  const oy = -hh
  const r1 = Math.min(hw, 2 * hh) - 0.5
  const r2 = r1 * RAIO_DO_MEIO
  const r3 = r1 * RAIO_DE_CIMA
  const meiaLua = (r: number): Forma => dentroDe(elipse(0, oy, r, r), caixa(-r - 1, oy, r + 1, oy + r + 1))
  const anelEntre = (dentro: number, fora: number): Forma => menos(meiaLua(fora), elipse(0, oy, dentro, dentro))
  /** O setor entre os ângulos (0 = para a direita, pi/2 = para baixo), com uma folga de junta de cada lado. */
  const setor = (a0: number, a1: number, r: number): Forma => {
    const folga = JUNTA / 2 / r
    const pontos = [a0 + folga, (a0 + a1) / 2, a1 - folga].map((a): readonly [number, number] => [Math.cos(a) * r * 1.6, oy + Math.sin(a) * r * 1.6])
    return poligono([[0, oy], ...pontos])
  }
  const noSetor = (a: number, r: number): readonly [number, number] => [Math.cos(a) * r, oy + Math.sin(a) * r]

  cena.sombras.push(contato(meiaLua(r1), 0.32))

  // O MUSGO no chão, no pé da curva, dos dois lados (fica embaixo de tudo).
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9 }
  L.push(P(elipse(...noSetor(Math.PI * 0.82, r1 + 1.6), 3.4, 2.2), MUSGO, { ...musgo, semente: 5090 }))
  L.push(P(elipse(...noSetor(Math.PI * 0.2, r1 + 1.4), 2.6, 1.8), MUSGO, { ...musgo, alfa: 0.45, semente: 5091 }))

  // Os dois ANÉIS: as metades (estruturas), o fundo escuro das juntas de cada metade e os blocos em leque.
  const aneis = [
    { dentro: r2, fora: r1, z: g * ALTURA_DO_DEGRAU, blocos: BLOCOS_DE_BAIXO, tom: 0.86, projeta: undefined, semente: 5000 },
    { dentro: r3, fora: r2, z: g * ALTURA_DO_DEGRAU * 2, blocos: BLOCOS_DO_MEIO, tom: 0.97, projeta: SOMBRA_DO_DEGRAU, semente: 5030 },
  ]
  for (const a of aneis) {
    const anel = anelEntre(a.dentro, a.fora)
    const rMeio = (a.dentro + a.fora) / 2
    for (const lado of [-1, 1]) {
      const metade = dentroDe(anel, lado < 0 ? caixa(-a.fora - 1, oy, 0, oy + a.fora + 1) : caixa(0, oy, a.fora + 1, oy + a.fora + 1))
      cena.sombras.push({ forma: metade, z: a.z })
      L.push(P(comMeioEm(metade, ...noSetor(lado < 0 ? Math.PI * 0.75 : Math.PI * 0.25, rMeio)), pedra, { tabua: 0, bisel: 0.6, tom: 0.6, contorno: 0.3, semente: a.semente }))
    }
    for (let k = 0; k < a.blocos; k += 1) {
      const a0 = (k / a.blocos) * Math.PI
      const a1 = ((k + 1) / a.blocos) * Math.PI
      const bloco = dentroDe(anel, setor(a0, a1, a.fora))
      L.push(P(comMeioEm(bloco, ...noSetor((a0 + a1) / 2, rMeio)), pedra, { tabua: 0, bisel: 1.1, tom: a.tom + 0.08 * hash(k, a.blocos, 5010), contorno: 0.24, projeta: a.projeta, semente: a.semente + 1 + k }))
    }
  }

  // As LASCAS da beira do anel de baixo.
  for (const [a, r] of [[0.32, 2.4], [1.9, 2], [2.62, 2.8]] as const) {
    const [lx, ly] = noSetor(a, r1)
    L.push(P(dentroDe(anelEntre(r2, r1), elipse(lx, ly, r * 1.3, r)), pedra, { tabua: 0, bisel: 0.6, tom: 0.7, contorno: 0.2, recesso: { k: 0.8, forca: 0.3 }, semente: 5020 }))
  }

  // O PATAMAR de cima: a estrutura, as quatro lajes em cunha e a faixa embutida perto da beira.
  const patamar = meiaLua(r3)
  cena.sombras.push({ forma: patamar, z: g * ALTURA_DO_DEGRAU * 3 })
  L.push(P(comMeioEm(patamar, ...noSetor(Math.PI / 2, r3 * 0.5)), pedra, { tabua: 0, bisel: 0.6, tom: 0.6, contorno: 0.3, semente: 5060 }))
  for (let k = 0; k < LAJES_DE_CIMA; k += 1) {
    const a0 = (k / LAJES_DE_CIMA) * Math.PI
    const a1 = ((k + 1) / LAJES_DE_CIMA) * Math.PI
    const laje = dentroDe(patamar, setor(a0, a1, r3))
    L.push(P(comMeioEm(laje, ...noSetor((a0 + a1) / 2, r3 * 0.6)), pedra, { tabua: 0, bisel: 1.2, tom: 1.08 + 0.06 * hash(k, 4, 5061), contorno: 0.24, projeta: SOMBRA_DO_DEGRAU, semente: 5062 + k }))
  }
  const faixa = dentroDe(anelEntre(r3 - FAIXA - LARGURA_DA_FAIXA, r3 - FAIXA), caixa(-r3, oy + 0.6, r3, oy + r3))
  L.push(P(comMeioEm(faixa, ...noSetor(Math.PI / 2, r3 - FAIXA - LARGURA_DA_FAIXA / 2)), pedra, { tabua: 0, bisel: 0.3, tom: 0.7, contorno: 0.16, semente: 5070 }))
  L.push(P(comMeioEm(elipse(r3 * 0.62, oy + 3, 3.4, 2.2), ...noSetor(0.3, r3 * 0.5)), MUSGO, { ...musgo, alfa: 0.4, semente: 5071 }))
}
