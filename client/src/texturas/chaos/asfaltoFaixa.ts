import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * ASFALTO COM FAIXA (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Base militar):
 * a pista da base. Asfalto grafite de grão fino (a brita miúda mais clara aparecendo no piche, um ou outro furinho
 * escuro), manchas largas do sol e do óleo, remendos retangulares de canto gasto, um pouco mais escuros e mais
 * lisos, com a borda selada de piche, e UMA faixa tracejada amarela por ladrilho: tinta velha, desbotada e
 * falhada, o piche aparecendo onde ela gastou.
 *
 * A faixa corre deitada, centrada na linha da grade da quarta casa (separa duas pistas de quatro casas); quatro
 * traços por ladrilho, então ela continua sem emenda de um ladrilho para o outro. O amarelo é pouco e apagado:
 * ocupa perto de 1% do ladrilho. O remendo é quase do tom do piche: de longe ele é só uma mancha mais lisa, não
 * um buraco.
 */

const CASAS = 8
/** O piche: grafite um nada frio, nem preto nem cinza de concreto. */
const ASFALTO: Rgb = rgb('#46474a')
/** A brita clara que o pneu deixou à mostra: cinza de pedra moída, um nada mais quente que o piche. */
const BRITA: Rgb = rgb('#6c6b67')
/** O furinho fundo do piche, onde a brita soltou. */
const FURO: Rgb = rgb('#2e2f31')
/** O remendo: piche mais novo, só um pouco mais escuro, e o selante de piche puro na borda dele. */
const REMENDO: Rgb = rgb('#424346')
const SELANTE: Rgb = rgb('#323335')
/** A tinta da faixa: amarelo de pista desbotado pelo sol, puxado para o creme (nada de amarelo de placa). */
const TINTA: Rgb = rgb('#a8925c')

/**
 * A brita e os furinhos: o período do ruído de gradiente (uns 4 px no ladrilho de 1024) e o quanto cada um cobre
 * o piche onde aparece. De gradiente, e não de valor: cortado no limiar, o de valor fazia quadradinhos.
 */
const BRITA_ESCALA = 256
const BRITA_FORCA = 0.4
const FURO_ESCALA = 224
const FURO_FORCA = 0.36
/** O grão miúdo do piche (abaixo de 600 por ladrilho: não vira chuvisco). */
const GRAO_ESCALA = 480
const GRAO = 0.03

/** Remendos: um por quadrado de 2 x 2 casas no máximo, a chance de cada quadrado ter um e as medidas (casas). */
const REMENDO_CELULA = 2
const REMENDO_CHANCE = 0.2
const REMENDO_LADO = { min: 0.55, max: 1.45 } as const
/** A margem que o remendo guarda da beira do quadrado dele (nenhum passa para o vizinho) e o raio do canto gasto. */
const REMENDO_MARGEM = 0.22
const REMENDO_CANTO = 0.09
/**
 * A borda do remendo: a meia largura do selante, a passagem macia (casas) e o quanto o selante cobre. Fraco de
 * propósito: com o contorno forte, o remendo virava uma caixa desenhada no chão.
 */
const REMENDO_SELANTE = { largura: 0.025, macio: 0.016, cobre: 0.3 } as const
/** O quanto a borda do remendo serpenteia (casas) e a escala do ruído que a torce. */
const TORCAO = 0.035
const TORCAO_ESCALA = 16
/** Distância (casas) que vale "longe de qualquer remendo". */
const SEM_REMENDO = 1

/**
 * A faixa: onde ela corre (em casas, de cima), a meia largura, o passo do tracejado e o comprimento do traço, a
 * borda macia (uns 2 px) e o quanto a tinta cobre no máximo (velha, nunca opaca).
 */
const FAIXA = { centro: 4, meia: 0.09, passo: 2, traco: 1.2, macio: 0.014, cobre: 0.88 } as const
/**
 * O gasto da faixa: onde a falha larga começa e acaba (no ruído de 0 a 1) e o a mais de um traço mais gasto. Na
 * primeira medida a falha comia quase todo o traço e a faixa não se lia no tamanho de mesa: agora some uns 25%.
 */
const FALHA = { de: 0.5, ate: 0.8, aMais: 0.15 } as const

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/**
 * A distância assinada (casas, negativa dentro) do ponto (x, y) à borda do remendo do quadrado dele: retângulo de
 * canto gasto e borda torcida; `SEM_REMENDO` quando o quadrado não tem remendo.
 */
function bordaDoRemendo(x: number, y: number, uu: number, vv: number): number {
  const cx = Math.floor(x / REMENDO_CELULA)
  const cy = Math.floor(y / REMENDO_CELULA)
  if (hash(cx, cy, 2410) >= REMENDO_CHANCE) return SEM_REMENDO
  const util = REMENDO_CELULA - 2 * REMENDO_MARGEM
  const largura = Math.min(util, REMENDO_LADO.min + (REMENDO_LADO.max - REMENDO_LADO.min) * hash(cx, cy, 2411))
  const altura = Math.min(util, REMENDO_LADO.min + (REMENDO_LADO.max - REMENDO_LADO.min) * hash(cx, cy, 2412))
  const x0 = cx * REMENDO_CELULA + REMENDO_MARGEM + (util - largura) * hash(cx, cy, 2413)
  const y0 = cy * REMENDO_CELULA + REMENDO_MARGEM + (util - altura) * hash(cx, cy, 2414)
  const qx = Math.abs(x - (x0 + largura / 2)) - (largura / 2 - REMENDO_CANTO)
  const qy = Math.abs(y - (y0 + altura / 2)) - (altura / 2 - REMENDO_CANTO)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - REMENDO_CANTO + fbm(uu, vv, TORCAO_ESCALA, 2, 2415) * TORCAO
}

/** A cobertura da tinta (0 a 1) no ponto (x, y) casas: o traço da vez, a borda que treme e o gasto. */
function tinta(x: number, y: number, uu: number, vv: number, brita: number, furo: number): number {
  const fora = Math.abs(y - FAIXA.centro)
  if (fora > FAIXA.meia + FAIXA.macio * 3) return 0
  const traco = Math.floor(x / FAIXA.passo)
  const ao = x - traco * FAIXA.passo - (FAIXA.passo - FAIXA.traco) / 2
  const ponta = Math.min(ao, FAIXA.traco - ao)
  if (ponta < -FAIXA.macio * 3) return 0
  const tremor = fbm(uu, vv, 64, 2, 2420) * 0.012
  const lado = passoSuave(FAIXA.meia + FAIXA.macio, FAIXA.meia - FAIXA.macio, fora + tremor)
  const pontas = passoSuave(-FAIXA.macio, FAIXA.macio, ponta + tremor)
  // O gasto: falhas largas onde o pneu passa (um traço mais gasto que o outro) e a tinta que soltou da brita.
  const aMais = hash(traco, 0, 2421) * FALHA.aMais
  const falha = passoSuave(FALHA.de - aMais, FALHA.ate - aMais, fbm(uu, vv, 20, 3, 2422) * 0.5 + 0.5)
  const solta = passoSuave(0.55, 0.85, valor(uu * 160, vv * 160, 160, 2423))
  return lado * pontas * (1 - falha) * (1 - solta * 0.4) * (1 - furo * 0.6) * (1 - brita * 0.25) * FAIXA.cobre
}

/** A cor do asfalto com faixa no ponto (u, v) do ladrilho. */
export function texturaAsfaltoFaixa(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * CASAS
  const y = vv * CASAS
  const borda = bordaDoRemendo(x, y, uu, vv)
  const dentro = passoSuave(REMENDO_SELANTE.macio, -REMENDO_SELANTE.macio, borda)
  const selo = passoSuave(REMENDO_SELANTE.largura + REMENDO_SELANTE.macio, REMENDO_SELANTE.largura - REMENDO_SELANTE.macio, Math.abs(borda))
  // O piche e a brita: no remendo a brita quase não aparece (o piche é novo e cobre a pedra).
  const brita = passoSuave(0.38, 0.7, fbm(uu, vv, BRITA_ESCALA, 1, 2401)) * (1 - dentro * 0.75)
  const furo = passoSuave(-0.42, -0.7, fbm(uu, vv, FURO_ESCALA, 1, 2402)) * (1 - dentro * 0.6)
  let c = misturar(ASFALTO, REMENDO, dentro)
  c = misturar(c, BRITA, brita * BRITA_FORCA)
  c = misturar(c, FURO, furo * FURO_FORCA)
  c = misturar(c, SELANTE, selo * REMENDO_SELANTE.cobre)
  // As manchas largas: o sol que desbota (claro) e o óleo que escurece, e o grão miúdo.
  const sol = fbm(uu, vv, 4, 3, 2403) * 0.045
  const oleo = passoSuave(0.55, 0.9, fbm(uu, vv, 10, 2, 2404) * 0.5 + 0.5) * 0.055
  const grao = (valor(uu * GRAO_ESCALA, vv * GRAO_ESCALA, GRAO_ESCALA, 2405) - 0.5) * GRAO
  c = luz(c, sol - oleo + grao)
  // A faixa por cima (a margem do remendo o deixa sempre longe dela).
  const cobre = tinta(x, y, uu, vv, brita, furo)
  if (cobre > 0) c = misturar(c, luz(TINTA, grao * 1.5 + sol * 0.5), cobre)
  return empacotar(c)
}
