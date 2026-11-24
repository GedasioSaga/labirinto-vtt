/**
 * CHUVEIRO COLETIVO de cima com volume (lote L10 de 24/11/2026, presídio moderno; objeto novo): uma BAIA aberta do
 * vestiário, encostada na parede do fundo (a beira de cima). As duas MURETAS azulejadas dos lados (1,35 m, grossas),
 * com a tampa de cima mais escura, vão até um pouco mais da metade da fundura; o piso de azulejo miúdo
 * verde-acinzentado CAI PARA O RALO (as quatro águas, dos cantos ao ralo, cada uma com a sua luz, e o fundo mais escuro
 * em volta dele), com a mancha molhada em gota descendo da ducha até o ralo e umas gotas brilhando. Na parede, o CANO
 * aparente de cromo sai da parede no alto da VÁLVULA de apertar (a de presídio, que corta a água sozinha; o trecho de
 * baixo é embutido) e sobe até o braço curto e a DUCHA redonda; do outro lado, a saboneteira de inox com o sabão.
 * Várias lado a lado fazem o vestiário: as muretas encostam umas nas outras.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`, beirada padrão): as muretas são colunas; a válvula, a saboneteira, o braço e
 * a ducha são tampos soltos na altura de cada um (a beirada faz a lateral da caixa da válvula e o aro da ducha); o
 * alto do cano e a canopla sobem com o braço. O piso e o ralo ficam no chão. A válvula fica ao lado do cano, e não na
 * frente dele, para o braço da ducha (mais alto) não levar as peças dela para cima. Só a 3/4 vê (`soNaTresQuartos`,
 * sem giro) o trecho aparente do cano, da canopla no alto da válvula até o braço, e a face da frente de cada mureta,
 * de azulejo com o rejunte à vista, com a quina da tampa escura em cima. Com giro elas somem: fica a frente varrida
 * das muretas e o cano só no alto. Nada lê o giro.
 *
 * Sem material escolhido: o azulejo, o cromo, o inox e o sabão são fixos.
 */
import { anel, caixa, capsula, dentroDe, elipse, poligono, type Forma } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm } from './andaimeDaTresQuartos'
import { BRILHO_DO_CROMO, CROMO, ESCURO, PISO_DO_BANHEIRO, REFLEXO, soNaTresQuartos, type PecaDaTela } from './apoioDoBanheiroModerno'
import { INOX, texEscovado } from './geladeira'

/**
 * A grossura das peças soltas (px do protótipo): o perfil da 3/4 em `tresQuartos.ts` usa este valor. Fina, para o
 * braço da ducha e a saboneteira não ganharem uma aba grossa embaixo.
 */
export const ESPESSURA_DAS_PECAS_DO_CHUVEIRO_COLETIVO = 0.03 * G

/** Alturas em casas: as muretas (1,35 m), o cano e a ducha (2 m), a válvula e a saboneteira. */
const ALTURA_DA_MURETA = 0.9
const ALTURA_DO_CANO = 1.35
const ALTURA_DA_VALVULA = 0.78
const ALTURA_DA_SABONETEIRA = 0.86
/** A mureta: a grossura (px) e até onde vai (fração da meia fundura, a partir do meio). */
const GROSSURA_DA_MURETA = 5.5
const FIM_DA_MURETA = 0.3
/** O azulejo do piso: o lado da peça e a meia grossura do rejunte (px). */
const LADO_DO_AZULEJO = 4
const MEIO_REJUNTE = 0.2
/** O azulejo da face da mureta, na 3/4: duas peças na grossura dela e a meia grossura do rejunte, bem à vista (px). */
const AZULEJO_DA_FACE = { lado: GROSSURA_DA_MURETA / 2, rejunte: 0.28, forca: 0.3 } as const
/**
 * O caimento do piso para o ralo: a luz de cada água (a de trás e a da esquerda descem para longe da luz e ficam mais
 * escuras), o escuro em volta do ralo e o raio dele (px).
 */
const AGUAS_DO_PISO = { tras: -0.05, frente: 0.035, esquerda: -0.035, direita: 0.03 } as const
const FUNDO_DO_RALO = { luz: -0.09, raio: 9 } as const
/** A mancha molhada em gota: a ponta debaixo da ducha, a barriga em volta do ralo; a meia largura e a transparência. */
const GOTA_MOLHADA = { largura: 9.4, alfa: 0.25, pontos: 36 } as const
/** O trecho aparente do cano começa este tanto (px) abaixo do alto da válvula, numa canopla. */
const CANO_ABAIXO_DA_VALVULA = 1.5
/** O cano (raio, distância da parede), o braço, a ducha, a válvula e a saboneteira (px). */
const CANO = { raio: 1.1, daParede: 1.6 } as const
const BRACO = { raio: 0.85, comprido: 6.8 } as const
const DUCHA = { raio: 3.6, depois: 1.8 } as const
const VALVULA = { x0: 3.4, x1: 9.4, y0: 2.4, y1: 5.4 } as const
const SABONETEIRA = { x0: -11, x1: -4, y0: 0.6, y1: 4 } as const
/** O ralo: o raio do aro e o da grelha, e onde fica (fração da meia fundura). */
const RALO = { aro: 3.8, grelha: 3, lugar: 0.18 } as const

/** O azulejo do piso (verde-acinzentado claro), o da mureta (branco quente), a tampa da mureta (granitina cinza, mais escura) e o rejunte; o sabão. */
const AZULEJO: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xbc, 0xb2] }
const AZULEJO_DA_MURETA: MaterialDaPeca = { classe: 'liso', rgb: [0xcc, 0xca, 0xc0] }
const TAMPA_DA_MURETA: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x9a, 0x94] }
const MOLHADO: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x60, 0x5c] }
const SABAO: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xc6, 0xa4] }

/** O azulejo em grade de `lado` px a partir de (x0, y0): o rejunte escuro e cada peça com o seu tom (o esmalte nunca sai igual). */
function azulejoEmGrade(lado: number, meioRejunte: number, x0: number, y0: number, forca: number): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    const gx = (x - x0 + 1000) / lado
    const gy = (y - y0 + 1000) / lado
    const i = Math.floor(gx)
    const j = Math.floor(gy)
    const fx = gx - i
    const fy = gy - j
    const borda = Math.min(fx, 1 - fx, fy, 1 - fy) * lado
    const rejunte = Math.max(0, Math.min(1, (meioRejunte + 0.5 / escala - borda) * escala))
    s[3] += ruido(i * 3.7 + p.semente, j * 5.3) * 0.05 + (0.5 - fy) * 0.025 - rejunte * forca
  }
}

/** O azulejo miúdo do piso. */
const texAzulejo = azulejoEmGrade(LADO_DO_AZULEJO, MEIO_REJUNTE, 0, 0, 0.22)

/**
 * O piso que CAI PARA O RALO em (xr, yr): as quatro águas, triângulos dos cantos ao ralo, cada uma com a sua luz (a
 * luz vem do alto à esquerda), e o fundo mais escuro em volta do ralo.
 */
function texturaDoPiso(xr: number, yr: number, hw: number, hh: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    texAzulejo(u, v, x, y, p, s, escala)
    const deLado = Math.abs(x - xr) / hw
    const deFrente = y < yr ? (yr - y) / (yr + hh) : (y - yr) / (hh - yr)
    if (deFrente > deLado) s[3] += y < yr ? AGUAS_DO_PISO.tras : AGUAS_DO_PISO.frente
    else s[3] += x < xr ? AGUAS_DO_PISO.esquerda : AGUAS_DO_PISO.direita
    const perto = 1 - Math.hypot(x - xr, y - yr) / FUNDO_DO_RALO.raio
    if (perto > 0) s[3] += FUNDO_DO_RALO.luz * perto * perto
  }
}

/** A gota de (x, ponta) até a barriga em `fundo`: fina na ponta, redonda embaixo. */
function gota(x: number, ponta: number, fundo: number, largura: number): Forma {
  const meio = (ponta + fundo) / 2
  const comprido = (fundo - ponta) / 2
  return poligono(Array.from({ length: GOTA_MOLHADA.pontos }, (_, k) => {
    const a = (k / GOTA_MOLHADA.pontos) * Math.PI * 2
    return [x + largura * Math.sin(a) * Math.sin(a / 2), meio - comprido * Math.cos(a)] as const
  }))
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
  // O cano não é coluna: o trecho de baixo é embutido na parede. O alto dele sobe com o braço.
  cena.sombras.push(
    { forma: braco, z: zCano, solta: true, forca: 0.18 },
    { forma: ducha, z: zCano - 0.8, solta: true, forca: 0.22 },
    { forma: valvula, z: g * ALTURA_DA_VALVULA, solta: true, forca: 0.2 },
    { forma: saboneteira, z: g * ALTURA_DA_SABONETEIRA, solta: true, forca: 0.18 },
  )

  const L = cena.partes
  const liso = { tabua: 0, bisel: 0, contorno: 0 }
  const cromo = { tabua: 0, metal: BRILHO_DO_CROMO }

  // O PISO de azulejo miúdo caindo para o ralo, a mancha molhada em gota (da ducha ao ralo) e as gotas brilhando.
  const yRalo = hh * RALO.lugar
  L.push(P(caixa(-hw, -hh, hw, hh, 0.6), AZULEJO, { tabua: 0, bisel: 0.5, contorno: 0.2, textura: texturaDoPiso(0, yRalo, hw, hh), semente: 9960 }))
  L.push(P(gota(-0.6, yDucha + DUCHA.raio * 0.8, yRalo + RALO.aro + 2.6, GOTA_MOLHADA.largura), MOLHADO, { ...liso, alfa: GOTA_MOLHADA.alfa, suave: 1.2, semente: 9961 }))
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

  // As MURETAS de cima: a tampa de granitina, mais escura que o azulejo, com a quina chanfrada e um brilho fraco.
  muretas.forEach((m, i) => {
    L.push(P(m, TAMPA_DA_MURETA, { tabua: 0, bisel: 1.2, contorno: 0.26, semente: 9980 + i, projeta: { dist: 1.6, forca: 0.24, suave: 1.6 } }))
    const x = (m.b[0] + m.b[2]) / 2
    L.push(P(capsula(x - 0.6, -hh + 1.4, x - 0.6, yFimDaMureta - 1.6, 0.35), REFLEXO, { ...liso, alfa: 0.14, suave: 0.5, semente: 9982 + i }))
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

  // Só a 3/4 (o chão de cada linha em y, para cima negativo). O trecho aparente do CANO: sai da parede numa canopla
  // no alto da válvula e sobe até o braço (a âncora, na parede, vem antes da válvula, do braço e da ducha).
  const baseDoCano = yCano - (g * ALTURA_DA_VALVULA - CANO_ABAIXO_DA_VALVULA)
  soNaTresQuartos(P, cena, CANO.raio + 0.5, yCano + 0.3, [
    { forma: capsula(0, yCano - zCano + 0.6, 0, baseDoCano, CANO.raio), mat: CROMO, o: { ...cromo, bisel: CANO.raio, contorno: 0.3, semente: 9900 } },
    { forma: caixa(-CANO.raio - 0.9, baseDoCano - 0.7, CANO.raio + 0.9, baseDoCano + 0.7, 0.6), mat: CROMO, o: { ...cromo, bisel: 0.5, contorno: 0.3, tom: 0.9, semente: 9901 } },
  ])
  // A face da frente de cada MURETA: o azulejo com o rejunte à vista, a quina da tampa escura em cima e o pé
  // escurecido no chão (a âncora fica logo na frente das muretas, depois delas na ordem).
  const zMureta = g * ALTURA_DA_MURETA
  const topoDaFace = yFimDaMureta - zMureta
  const faces: PecaDaTela[] = []
  muretas.forEach((m, i) => {
    const [x0, x1] = [m.b[0], m.b[2]]
    const azulejo = azulejoEmGrade(AZULEJO_DA_FACE.lado, AZULEJO_DA_FACE.rejunte, x0, yFimDaMureta, AZULEJO_DA_FACE.forca)
    faces.push({ forma: caixa(x0 + 0.1, topoDaFace + 0.6, x1 - 0.1, yFimDaMureta - 0.1, 0.4), mat: AZULEJO_DA_MURETA, o: { tabua: 0, bisel: 0.4, tom: 0.9, contorno: 0.22, textura: azulejo, semente: 9902 + i } })
    faces.push({ forma: caixa(x0, topoDaFace - 0.3, x1, topoDaFace + 1.6, 0.4), mat: TAMPA_DA_MURETA, o: { tabua: 0, bisel: 0.4, tom: 0.82, contorno: 0.26, semente: 9904 + i } })
    faces.push({ forma: caixa(x0 + 0.1, yFimDaMureta - 1.1, x1 - 0.1, yFimDaMureta - 0.1, 0.2), mat: ESCURO, o: { ...liso, alfa: 0.2, suave: 0.5, semente: 9906 } })
  })
  soNaTresQuartos(P, cena, 0, yFimDaMureta + 0.3, faces)
}
