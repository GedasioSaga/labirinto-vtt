/**
 * As VERSÕES da armadilha de espinhos (L01 do plano de arte por tema, 28/11/2026): a 1ª, Armada (a de hoje, os
 * espinhos de pé), é o desenho de `MONTADORES`; a RECOLHIDA é a mesma laje com os espinhos descidos. Sobram os FUROS,
 * cada um com a ponta do espinho lá no fundo: um pingo de ferro no escuro, com um brilho miúdo do lado da luz.
 *
 * A moldura, a soleira com a placa de pressão, a laje, as juntas e as manchas de ferrugem são as de hoje, peça por
 * peça: a cena sai do próprio desenho base (`montarArmadilhaDeEspinhos`) e daqui só se tiram os espinhos (as peças de
 * ferro do cone, da ponta e do toco, a sombra pintada, o reflexo, os pinos sem tinta e os tampos soltos da 3/4). Na 3/4
 * a laje fica rente, como o alçapão. Lugares de material: os da armadilha (`pedra` e `metal`).
 */
import type { VersoesDesenhadas } from '.'
import type { Rgb } from '../../../ruido'
import { montarArmadilhaDeEspinhos } from '../armadilhaDeEspinhos'
import type { MontarMovel } from '../contexto'
import { elipse } from '../formas'
import type { Cena, MaterialDaPeca, Peca } from '../motor'

/** Os tons fixos do espinho no desenho base (`armadilhaDeEspinhos.ts`): a sombra pintada na laje e o reflexo da ponta. */
const SOMBRA_PINTADA: Rgb = [0x16, 0x14, 0x12]
const REFLEXO_DA_PONTA: Rgb = [0xec, 0xee, 0xf0]
/** O furo do desenho base: o raio (px do protótipo) e o recesso, que só ele tem com esta força. */
const RAIO_DO_FURO = 2.8
const RECESSO_DO_FURO = 1.1
/** A ponta lá embaixo: o ferro no escuro e o brilho, os dois um pouco para baixo à direita (onde a luz alcança o fundo). */
const PONTA_NO_FUNDO: MaterialDaPeca = { classe: 'metal', rgb: [0x5c, 0x59, 0x56] }
const BRILHO_NO_FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xb6, 0xb8] }
const PONTA = { dx: 0.45, dy: 0.5, raio: 0.95, brilho: 0.34 } as const

function mesmoTom(a: Rgb, b: Rgb): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

/** A peça é do espinho em pé (e sai da Recolhida)? Os pinos não têm tinta; o cone, a ponta e o toco são de ferro. */
function ehDoEspinho(p: Peca): boolean {
  return p.alfa === 0 || p.mat.classe === 'metal' || mesmoTom(p.mat.rgb, SOMBRA_PINTADA) || mesmoTom(p.mat.rgb, REFLEXO_DA_PONTA)
}

/**
 * O meio do furo. A caixa da peça foi andada (`comMeioEm` do desenho base), mas a distância não: num círculo,
 * (d + r)² é o quadrado da distância ao meio, e três pontos dão o meio.
 */
function meioDoFuro(p: Peca): readonly [number, number] {
  const s0 = (p.forma.d(0, 0) + RAIO_DO_FURO) ** 2
  const s1 = (p.forma.d(10, 0) + RAIO_DO_FURO) ** 2
  const s2 = (p.forma.d(0, 10) + RAIO_DO_FURO) ** 2
  return [(s0 - s1 + 100) / 20, (s0 - s2 + 100) / 20]
}

const montarArmadilhaRecolhida: MontarMovel = (c, cena) => {
  const base: Cena = { partes: [], sombras: [] }
  montarArmadilhaDeEspinhos(c, base)
  if (base.corDoPiso !== undefined) cena.corDoPiso = base.corDoPiso
  cena.sombras.push(...base.sombras.filter((s) => s.solta !== true))
  for (const p of base.partes) {
    if (ehDoEspinho(p)) continue
    cena.partes.push(p)
    if (p.recesso?.k !== RECESSO_DO_FURO) continue
    const [x, y] = meioDoFuro(p)
    cena.partes.push(c.peca(elipse(x + PONTA.dx, y + PONTA.dy, PONTA.raio, PONTA.raio), PONTA_NO_FUNDO, { tabua: 0, bisel: 0.6, tom: 0.9, contorno: 0.2, alfa: 0.92, semente: 2900 }))
    cena.partes.push(c.peca(elipse(x + PONTA.dx - 0.3, y + PONTA.dy - 0.3, PONTA.brilho, PONTA.brilho), BRILHO_NO_FUNDO, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.3, semente: 2901 }))
  }
}

export const versoesDoArmadilhaDeEspinhos: VersoesDesenhadas = {
  recolhida: montarArmadilhaRecolhida,
}
