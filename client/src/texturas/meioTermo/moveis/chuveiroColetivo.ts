/**
 * CHUVEIRO COLETIVO de cima com volume (lote L10 de 24/11/2026, presídio moderno; objeto novo): uma BAIA aberta do
 * vestiário, encostada na parede do fundo (a beira de cima). As duas MURETAS azulejadas dos lados, com o capeamento
 * claro em cima, vão até um pouco mais da metade da fundura; o piso de azulejo miúdo verde-acinzentado cai para o
 * RALO redondo de grelha, com a mancha molhada em volta e umas gotas brilhando. Na parede, o CANO aparente de cromo
 * sobe do chão até o braço curto e a DUCHA redonda; ao lado do cano, a VÁLVULA de apertar (a de presídio, que corta a
 * água sozinha), e do outro lado a saboneteira de inox com o sabão. Várias lado a lado fazem o vestiário: as
 * muretas encostam umas nas outras.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`, beirada padrão): as muretas e o cano são colunas; a válvula, a saboneteira, o
 * braço e a ducha são tampos soltos na altura de cada um (a beirada faz a lateral da caixa da válvula e o aro da
 * ducha). O piso e o ralo ficam no chão. A válvula fica ao lado do cano, e não na frente dele, para o braço da ducha
 * (mais alto) não levar as peças dela para cima. Nada lê o giro.
 *
 * Sem material escolhido: o azulejo, o cromo, o inox e o sabão são fixos.
 */
import { anel, caixa, capsula, dentroDe, elipse } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm } from './andaimeDaTresQuartos'
import { BRILHO_DO_CROMO, CROMO, ESCURO, PISO_DO_BANHEIRO, REFLEXO } from './apoioDoBanheiroModerno'
import { INOX, texEscovado } from './geladeira'

/**
 * A grossura das peças soltas (px do protótipo): o perfil da 3/4 em `tresQuartos.ts` usa este valor. Fina, para o
 * braço da ducha e a saboneteira não ganharem uma aba grossa embaixo.
 */
export const ESPESSURA_DAS_PECAS_DO_CHUVEIRO_COLETIVO = 0.03 * G

/** Alturas em casas: as muretas (1,8 m), o cano e a ducha (2 m), a válvula e a saboneteira. */
const ALTURA_DA_MURETA = 1.2
const ALTURA_DO_CANO = 1.35
const ALTURA_DA_VALVULA = 0.78
const ALTURA_DA_SABONETEIRA = 0.86
/** A mureta: a grossura (px) e até onde vai (fração da meia fundura, a partir do meio). */
const GROSSURA_DA_MURETA = 4.2
const FIM_DA_MURETA = 0.3
/** O azulejo do piso: o lado da peça e a meia grossura do rejunte (px). */
const LADO_DO_AZULEJO = 4
const MEIO_REJUNTE = 0.2
/** O cano (raio, distância da parede), o braço, a ducha, a válvula e a saboneteira (px). */
const CANO = { raio: 1.1, daParede: 1.6 } as const
const BRACO = { raio: 0.85, comprido: 6.8 } as const
const DUCHA = { raio: 3.6, depois: 1.8 } as const
const VALVULA = { x0: 3.4, x1: 9.4, y0: 2.4, y1: 5.4 } as const
const SABONETEIRA = { x0: -11, x1: -4, y0: 0.6, y1: 4 } as const
/** O ralo: o raio do aro e o da grelha, e onde fica (fração da meia fundura). */
const RALO = { aro: 3.8, grelha: 3, lugar: 0.18 } as const

/** O azulejo do piso (verde-acinzentado claro), o da mureta (branco quente) e o rejunte; o sabão. */
const AZULEJO: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xbc, 0xb2] }
const AZULEJO_DA_MURETA: MaterialDaPeca = { classe: 'liso', rgb: [0xcc, 0xca, 0xc0] }
const MOLHADO: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x60, 0x5c] }
const SABAO: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xc6, 0xa4] }

/** O azulejo miúdo: o rejunte escuro na grade e cada peça com o seu tom (o esmalte nunca sai igual). */
const texAzulejo: Textura = (_u, _v, x, y, p, s, escala) => {
  const gx = (x + 1000) / LADO_DO_AZULEJO
  const gy = (y + 1000) / LADO_DO_AZULEJO
  const i = Math.floor(gx)
  const j = Math.floor(gy)
  const fx = gx - i
  const fy = gy - j
  const borda = Math.min(fx, 1 - fx, fy, 1 - fy) * LADO_DO_AZULEJO
  const rejunte = Math.max(0, Math.min(1, (MEIO_REJUNTE + 0.5 / escala - borda) * escala))
  s[3] += ruido(i * 3.7 + p.semente, j * 5.3) * 0.05 + (0.5 - fy) * 0.025 - rejunte * 0.22
}

export const montarChuveiroColetivo: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_BANHEIRO
  const yFimDaMureta = hh * FIM_DA_MURETA
  const muretas = [-1, 1].map((lado) => (lado < 0 ? caixa(-hw, -hh, -hw + GROSSURA_DA_MURETA, yFimDaMureta, 1.4) : caixa(hw - GROSSURA_DA_MURETA, -hh, hw, yFimDaMureta, 1.4)))
  const yCano = -hh + CANO.daParede
  const cano = elipse(0, yCano, CANO.raio, CANO.raio)
  const yFimDoBraco = yCano + BRACO.comprido
  const braco = capsula(0, yCano, 0, yFimDoBraco, BRACO.raio)
  const yDucha = yFimDoBraco + DUCHA.depois
  const ducha = elipse(0, yDucha, DUCHA.raio, DUCHA.raio)
  const valvula = caixa(VALVULA.x0, -hh + VALVULA.y0, VALVULA.x1, -hh + VALVULA.y1, 0.8)
  const saboneteira = caixa(SABONETEIRA.x0, -hh + SABONETEIRA.y0, SABONETEIRA.x1, -hh + SABONETEIRA.y1, 0.6)
  const zCano = g * ALTURA_DO_CANO

  for (const m of muretas) cena.sombras.push({ forma: m, z: g * ALTURA_DA_MURETA, forca: 0.22 }, contato(m, 0.3))
  cena.sombras.push(
    { forma: cano, z: zCano, forca: 0.2 },
    { forma: braco, z: zCano, solta: true, forca: 0.18 },
    { forma: ducha, z: zCano - 0.8, solta: true, forca: 0.22 },
    { forma: valvula, z: g * ALTURA_DA_VALVULA, solta: true, forca: 0.2 },
    { forma: saboneteira, z: g * ALTURA_DA_SABONETEIRA, solta: true, forca: 0.18 },
  )

  const L = cena.partes
  const liso = { tabua: 0, bisel: 0, contorno: 0 }
  const cromo = { tabua: 0, metal: BRILHO_DO_CROMO }

  // O PISO de azulejo miúdo, a mancha molhada que desce para o ralo e as gotas brilhando.
  L.push(P(caixa(-hw, -hh, hw, hh, 0.6), AZULEJO, { tabua: 0, bisel: 0.5, contorno: 0.2, textura: texAzulejo, semente: 9960 }))
  const yRalo = hh * RALO.lugar
  L.push(P(elipse(0, yRalo - 4, hw * 0.5, hh * 0.46), MOLHADO, { ...liso, alfa: 0.13, suave: 5, semente: 9961 }))
  L.push(P(elipse(-1.5, yDucha + 4, DUCHA.raio * 1.6, DUCHA.raio * 1.2), MOLHADO, { ...liso, alfa: 0.1, suave: 2.4, semente: 9962 }))
  const gotas: readonly (readonly [number, number, number])[] = [[-6.5, -4, 0.7], [4.8, -8.5, 0.55], [7.6, 1.2, 0.6], [-3.4, 10.6, 0.5], [2.2, -1.5, 0.45], [-8.8, 4.4, 0.5]]
  gotas.forEach(([x, y, r], i) => L.push(P(elipse(x, y, r, r * 0.8), REFLEXO, { ...liso, alfa: 0.42, suave: 0.3, semente: 9963 + i })))
  L.push(P(capsula(-5, yRalo + 6, 3, yRalo + 7.2, 0.7), REFLEXO, { ...liso, alfa: 0.16, suave: 0.8, semente: 9970 }))

  // O RALO redondo: o aro de cromo, o fundo escuro e as barras da grelha.
  L.push(P(elipse(0, yRalo, RALO.aro, RALO.aro), CROMO, { ...cromo, bisel: 1, contorno: 0.3, semente: 9971 }))
  const fundo = elipse(0, yRalo, RALO.grelha, RALO.grelha)
  L.push(P(fundo, ESCURO, { tabua: 0, bisel: 0.3, contorno: 0.16, recesso: { k: 1, forca: 0.3 }, semente: 9972 }))
  for (let k = -1; k <= 1; k += 1) {
    L.push(P(dentroDe(caixa(-RALO.grelha, yRalo + k * 1.5 - 0.42, RALO.grelha, yRalo + k * 1.5 + 0.42), fundo), CROMO, { ...cromo, bisel: 0.3, contorno: 0.2, tom: 0.95, semente: 9973 }))
  }

  // As MURETAS: o azulejo da face e, em cima, o capeamento arredondado com a quina clara.
  muretas.forEach((m, i) => {
    L.push(P(m, AZULEJO_DA_MURETA, { tabua: 0, bisel: 1.2, contorno: 0.26, semente: 9980 + i, projeta: { dist: 1.6, forca: 0.24, suave: 1.6 } }))
    const x = (m.b[0] + m.b[2]) / 2
    L.push(P(capsula(x - 0.2, -hh + 1.2, x - 0.2, yFimDaMureta - 1.4, 0.45), REFLEXO, { ...liso, alfa: 0.35, suave: 0.4, semente: 9982 + i }))
  })

  // A SABONETEIRA de inox com o sabão.
  L.push(P(saboneteira, INOX, { tabua: 0, metal: 0.38, textura: texEscovado, bisel: 0.6, contorno: 0.28, semente: 9985, projeta: { dist: 0.9, forca: 0.26 } }))
  L.push(P(elipse((SABONETEIRA.x0 + SABONETEIRA.x1) / 2, -hh + 2.4, 2.4, 1.25), SABAO, { tabua: 0, bisel: 1, contorno: 0.24, semente: 9986, projeta: { dist: 0.5, forca: 0.22 } }))

  // O CANO aparente com a canopla na parede, a VÁLVULA de apertar ao lado (ligada ao cano por um toco) e, por
  // cima de tudo, o BRAÇO e a DUCHA redonda (o domo de cromo, que de cima é o que aparece).
  L.push(P(elipse(0, yCano, CANO.raio + 0.9, CANO.raio + 0.6), CROMO, { ...cromo, bisel: 0.5, contorno: 0.26, tom: 0.9, semente: 9990 }))
  L.push(P(cano, CROMO, { ...cromo, bisel: CANO.raio, contorno: 0.3, semente: 9991 }))
  // O toco sobe com a válvula: o meio da caixa dele vai para dentro dela.
  L.push(P(comMeioEm(caixa(CANO.raio - 0.2, -hh + 3.4, VALVULA.x0 + 0.4, -hh + 4.4, 0.4), VALVULA.x0 + 1, -hh + 3.9), CROMO, { ...cromo, bisel: 0.4, contorno: 0.26, semente: 9992 }))
  L.push(P(valvula, INOX, { tabua: 0, metal: 0.38, textura: texEscovado, bisel: 0.7, contorno: 0.28, semente: 9993, projeta: { dist: 1, forca: 0.28 } }))
  const xBotao = (VALVULA.x0 + VALVULA.x1) / 2
  const yBotao = -hh + (VALVULA.y0 + VALVULA.y1) / 2 + 0.2
  L.push(P(elipse(xBotao, yBotao, 1.7, 1.4), ESCURO, { ...liso, alfa: 0.4, suave: 0.4, semente: 9994 }))
  L.push(P(elipse(xBotao, yBotao, 1.35, 1.1), CROMO, { ...cromo, bisel: 1, contorno: 0.28, tom: 1.05, semente: 9995 }))
  L.push(P(braco, CROMO, { ...cromo, bisel: BRACO.raio, contorno: 0.3, semente: 9996, projeta: { dist: 0.9, forca: 0.24 } }))
  L.push(P(ducha, CROMO, { ...cromo, bisel: DUCHA.raio * 0.8, contorno: 0.3, semente: 9997, projeta: { dist: 1.4, forca: 0.3, suave: 1 } }))
  L.push(P(anel(0, yDucha, DUCHA.raio - 0.4, DUCHA.raio - 0.4, DUCHA.raio - 1.2, DUCHA.raio - 1.2), CROMO, { ...cromo, bisel: 0.4, contorno: 0, tom: 0.88, semente: 9998 }))
  L.push(P(elipse(-1.1, yDucha - 1.1, 1, 0.8), REFLEXO, { ...liso, alfa: 0.55, suave: 0.5, semente: 9999 }))
}
