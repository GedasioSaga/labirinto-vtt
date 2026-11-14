/**
 * MESA DE QUEDA DE BRAÇO de cima com volume (L09 dos objetos novos,
 * 14/11/2026, grupo Taverna e festa): a mesa pesada de taverna preparada para
 * a disputa. Em cima, as duas ALMOFADAS DE COTOVELO de couro costurado, uma de
 * cada lado do RISCO do meio (o sulco escavado na madeira que ninguém pode
 * passar), as duas ALMOFADAS DE DERRUBADA nas beiras, onde a mão de quem
 * perde bate, e os dois PINOS DE PEGADA de ferro para a mão livre, um no canto
 * de cada um. No canto, a contagem em giz (quatro riscos e o corte) e a aposta
 * em moedas. Dos dois lados, as BANQUETAS dos dois braços de ferro.
 *
 * A 25% de zoom sobram as duas manchas escuras de couro com o risco claro no
 * meio e os dois pontos de ferro, o que separa esta mesa da de jogo (o
 * quadriculado) e da de banquete (os pratos).
 *
 * A mesa é a de `mesaComPernas.ts` (o tampo de tábuas com a borda clara, a
 * espessura embaixo, as pernas nas quinas e as sombras), montada numa pegada
 * menor no meio; as banquetas são as do balcão de taverna
 * (`montarBanquetaAlta`), mais baixas. NA 3/4 (perfil `{ modo: 'derivado',
 * espessura: 0 }`) a mesa sobe como a mesa, com tudo o que está em cima, e as
 * banquetas como as do balcão. Os pinos de pegada são pintados no tampo, com
 * a sombra deles projetada.
 *
 * As medidas são por casa (`c.g`), como a mesa; a mesa não passa da pegada.
 * Material: `madeira` (a mesa e as banquetas); o couro, o ferro, o giz e as
 * moedas são fixos.
 */
import { type Rgb } from '../../ruido'
import { barra, caixa, elipse, type Forma } from './formas'
import { ruido, texturaDaClasse, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { montarMesaComPernas } from './mesaComPernas'
import { montarBanquetaAlta } from './balcaoDeTaverna'

/** A mesa (casas): a largura e a fundura, no máximo; e o assento das banquetas (altura e raio, casas). */
const MESA = { largura: 1.1, fundura: 0.95 } as const
const BANQUETA = { altura: 0.3, raio: 0.16, folga: 0.08 } as const

/** As almofadas de cotovelo: o meio (casas a partir do centro, ao longo da mesa), as meias medidas (casas) e o canto. */
const COTOVELO = { longe: 0.24, meiaLargura: 0.11, meiaAltura: 0.095, canto: 0.045 } as const
/** As almofadas de derrubada: o meio (casas, para as beiras) e as meias medidas. */
const DERRUBADA = { longe: 0.3, meiaLargura: 0.14, meiaAltura: 0.05, canto: 0.03 } as const
/** O risco do meio: até onde vai (casas) e a meia largura (px). */
const RISCO = { ate: 0.21, meiaLargura: 0.75 } as const
/** Os pinos de pegada (casas): o meio, o raio do pino e o da chapa de ferro debaixo dele. */
const PINO = { x: 0.4, y: 0.3, raio: 0.04, chapa: 0.065 } as const

/** O couro: castanho-escuro (mais claro, sumia na madeira a 25%), a costura clara na beira (a distância da beira, px) e o gasto no meio. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x36, 0x28] }
const COSTURA = { daBeira: 1.3, largura: 0.28, passo: 1.6, luz: 0.2 } as const
const GASTO_DO_COURO = 0.12
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: [0x6e, 0x6c, 0x68] }
const BURACO_DO_RISCO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x2c, 0x22] }
/** O giz: os quatro riscos e o corte (casas, a partir do canto da contagem) e a cor. */
const GIZ: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xde, 0xd2] }
const CONTAGEM = { x: 0.3, y: -0.36, passo: 0.035, altura: 0.08 } as const
/** A aposta: três moedas empilhadas meio de lado (casas) e as cores. */
const APOSTA = { x: -0.34, y: 0.34, raio: 0.04 } as const
const MOEDAS: readonly Rgb[] = [
  [0xb8, 0x98, 0x58],
  [0xa8, 0x6c, 0x4c],
  [0xb8, 0x98, 0x58],
]

/** O couro costurado: a costura clara em tracinhos perto da beira e o miolo gasto (mais claro). */
function texDoCouro(forma: Forma, cx: number, cy: number, meia: number): Textura {
  const liso = texturaDaClasse('liso')
  return (u, v, x, y, p, s, escala) => {
    if (liso !== null) liso(u, v, x, y, p, s, escala)
    const dentro = -forma.d(x, y)
    let luz = ruido(x * 0.9 + p.su, y * 0.9) * 0.05
    if (Math.abs(dentro - COSTURA.daBeira) < COSTURA.largura) {
      const ao = Math.atan2(y - cy, x - cx) * meia
      if (Math.sin(ao / COSTURA.passo * Math.PI) > -0.2) luz += COSTURA.luz
    }
    const r = Math.hypot(x - cx, y - cy) / meia
    luz += GASTO_DO_COURO * Math.max(0, 1 - r)
    s[3] += luz
  }
}

/** Uma almofada de couro costurado, de meio (cx, cy), com a sombra dela projetada no tampo. */
function almofada(c: ContextoDoMovel, L: Peca[], cx: number, cy: number, meiaLargura: number, meiaAltura: number, canto: number, semente: number): void {
  const forma = caixa(cx - meiaLargura, cy - meiaAltura, cx + meiaLargura, cy + meiaAltura, canto)
  L.push(c.peca(forma, COURO, { bisel: Math.min(meiaLargura, meiaAltura) * 0.55, contorno: 0.28, ruga: 0.5, textura: texDoCouro(forma, cx, cy, Math.max(meiaLargura, meiaAltura)), semente, projeta: { dist: 1.3, forca: 0.32, suave: 0.8 } }))
}

export const montarMesaDeQuedaDeBraco: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const L = cena.partes
  const raio = g * BANQUETA.raio
  // A mesa no meio, numa pegada própria: o que sobra dos lados é das banquetas.
  const largura = Math.min(g * MESA.largura, c.w - 2 * (2 * raio + g * BANQUETA.folga))
  const fundura = Math.min(g * MESA.fundura, c.h)
  const daMesa: ContextoDoMovel = { ...c, w: largura, h: fundura, hw: largura / 2, hh: fundura / 2 }

  // As BANQUETAS dos dois lados (antes da mesa na lista: de cima, a mesa nunca fica por baixo delas).
  const xBanqueta = largura / 2 + g * BANQUETA.folga + raio
  montarBanquetaAlta(c, cena, -xBanqueta, 0, raio, g * BANQUETA.altura, 0.5, 9800)
  montarBanquetaAlta(c, cena, xBanqueta, 0, raio, g * BANQUETA.altura, 2.1, 9810)

  montarMesaComPernas(daMesa, cena, false, 9820)

  // O RISCO do meio, escavado: só entre as almofadas de derrubada.
  L.push(P(caixa(-RISCO.meiaLargura, -g * RISCO.ate, RISCO.meiaLargura, g * RISCO.ate, RISCO.meiaLargura), BURACO_DO_RISCO, { bisel: 0, contorno: 0.1, recesso: { k: 0.8, forca: 0.3 }, semente: 9830 }))

  // As ALMOFADAS: as de cotovelo de cada lado do risco e as de derrubada nas beiras.
  for (const lado of [-1, 1]) {
    almofada(c, L, lado * g * COTOVELO.longe, 0, g * COTOVELO.meiaLargura, g * COTOVELO.meiaAltura, g * COTOVELO.canto, 9840 + lado)
    almofada(c, L, 0, lado * g * DERRUBADA.longe, g * DERRUBADA.meiaLargura, g * DERRUBADA.meiaAltura, g * DERRUBADA.canto, 9845 + lado)
  }

  // Os PINOS DE PEGADA: a chapa quadrada de ferro pregada e o pino redondo, com a sombra no tampo.
  for (const lado of [-1, 1]) {
    const [px, py] = [lado * g * PINO.x, lado * g * PINO.y]
    const chapa = g * PINO.chapa
    L.push(P(caixa(px - chapa, py - chapa, px + chapa, py + chapa, chapa * 0.25), FERRO, { bisel: 0.6, contorno: 0.26, tom: 0.85, metal: 0.3, semente: 9850 + lado }))
    L.push(P(elipse(px, py, g * PINO.raio, g * PINO.raio), FERRO, { bisel: g * PINO.raio * 0.85, contorno: 0.28, metal: 0.5, tom: 1.08, semente: 9853 + lado, projeta: { dist: 2.4, forca: 0.36, suave: 1 } }))
  }

  // A contagem em giz no canto: quatro riscos e o corte.
  for (let i = 0; i < 4; i += 1) {
    const x = g * (CONTAGEM.x + i * CONTAGEM.passo)
    L.push(P(barra(x, g * CONTAGEM.y, x + 0.4, g * (CONTAGEM.y + CONTAGEM.altura), 0.7), GIZ, { bisel: 0, contorno: 0, alfa: 0.8, semente: 9860 + i }))
  }
  L.push(P(barra(g * (CONTAGEM.x - 0.02), g * (CONTAGEM.y + CONTAGEM.altura * 0.85), g * (CONTAGEM.x + 4 * CONTAGEM.passo), g * (CONTAGEM.y + CONTAGEM.altura * 0.15), 0.7), GIZ, { bisel: 0, contorno: 0, alfa: 0.8, semente: 9865 }))

  // A aposta: três moedas meio de lado, uma por cima da outra.
  MOEDAS.forEach((cor, i) => {
    const r = g * APOSTA.raio
    L.push(P(elipse(g * APOSTA.x + i * r * 0.55, g * APOSTA.y - i * r * 0.3, r, r), { classe: 'metal', rgb: cor }, { bisel: r * 0.4, contorno: 0.26, metal: 0.55, semente: 9870 + i, projeta: { dist: 0.6, forca: 0.3 } }))
  })
}
