import { empacotar, fbm, hash, luz, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * CONCRETO (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Base militar): o pátio
 * de quartel e o chão de bunker. Placas de concreto cinza-claro de 2 x 2 casas; entre elas, a junta de dilatação
 * cortada a serra (um sulco estreito e escuro, a beira de cima e a da esquerda de cada placa pegando a luz). Na
 * placa, os poros miúdos do concreto, o alisado da desempenadeira, manchas largas de umidade (mais fortes perto
 * das juntas, por onde a água sobe) e, numa ou noutra placa, uma fissura fina que serpenteia.
 *
 * Contido de propósito (teto de saturação 0,06): o cinza mal puxa para o quente, cada placa varia só uns poucos
 * por cento de luz e a umidade escurece sem mudar de cor. A junta cai na linha da grade a cada duas casas, e a
 * emenda do ladrilho (8 casas) cai no meio de uma junta.
 */

const CASAS = 8
/** O lado da placa em casas e quantas placas cabem no lado do ladrilho. */
const PLACA = 2
const PLACAS = CASAS / PLACA
/** A junta de dilatação, em casas a partir da linha: no `fio`, o fundo do sulco; no `fim`, a placa inteira. */
const JUNTA = { fio: 0.012, fim: 0.034 } as const
/** O quanto o fundo do sulco escurece a placa (é sombra, não tinta: o tom fica). */
const JUNTA_ESCURO = 0.36
/** A beira quebrada pelo corte, em casas: a de cima e a da esquerda pegam a luz, as outras duas caem na sombra. */
const BEIRA = { largura: 0.075, fio: 0.032, luz: 0.045, sombra: 0.055 } as const

/**
 * Os tons das placas: cinza-claro de cimento, um nada quente (o vermelho passa o azul por 5 ou 6 níveis), cada
 * placa de uma betonada um pouco diferente. Nada de branco: o mais claro fica em 0xa3.
 */
const TONS: readonly Rgb[] = [rgb('#a19f9a'), rgb('#9d9b96'), rgb('#a3a19b'), rgb('#9e9c98'), rgb('#a09e99'), rgb('#9c9a95')]

/** Umidade: o quanto escurece no máximo e o quanto ela sobe a mais perto da junta, em casas. */
const UMIDADE = { escuro: 0.07, perto: 0.3 } as const
/**
 * Poros redondos em dois tamanhos, no máximo um por célula de grade: células por lado do ladrilho, a chance de a
 * célula ter um, o raio e a borda macia (em células) e o quanto ele escurece. O centro foge do meio da célula só
 * `PORO_FOLGA`, e folga + raio + borda ficam abaixo de meia célula: o poro nunca passa da própria célula, e basta
 * olhar a célula do ponto. (O ruído cortado no limiar fazia tracinhos e minhocas, não furinhos.)
 */
interface Poros {
  readonly celulas: number
  readonly chance: number
  readonly raioMin: number
  readonly raioMax: number
  readonly macio: number
  readonly escuro: number
}
const POROS_MIUDOS: Poros = { celulas: 112, chance: 0.4, raioMin: 0.12, raioMax: 0.22, macio: 0.08, escuro: 0.12 }
const POROS_GRAUDOS: Poros = { celulas: 40, chance: 0.14, raioMin: 0.07, raioMax: 0.12, macio: 0.03, escuro: 0.16 }
const PORO_FOLGA = 0.2
/** O grão do cimento: período de 512 (menos de 600 por ladrilho, para não virar chuvisco) e a força dele. */
const GRAO_ESCALA = 512
const GRAO = 0.024

/**
 * A fissura: a chance de uma placa ter uma, o comprimento (metade, em casas), a meia largura do traço e a borda
 * macia dele (somadas dão uns 3 px no ladrilho: fina, mas não risca de 1 px), o quanto ela escurece e o quanto
 * serpenteia para os lados.
 */
const FISSURA = { chance: 0.3, meioMin: 0.45, meioMax: 0.85, meia: 0.004, macio: 0.011, escuro: 0.2, curva: 0.2, tremor: 0.05 } as const

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** O quanto o poro da célula do ponto escurece ali (0 fora dele). */
function poro(uu: number, vv: number, p: Poros, semente: number): number {
  const x = uu * p.celulas
  const y = vv * p.celulas
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  if (hash(ix, iy, semente) >= p.chance) return 0
  const dx = x - ix - 0.5 - (hash(ix, iy, semente + 1) - 0.5) * 2 * PORO_FOLGA
  const dy = y - iy - 0.5 - (hash(ix, iy, semente + 2) - 0.5) * 2 * PORO_FOLGA
  const r = p.raioMin + (p.raioMax - p.raioMin) * hash(ix, iy, semente + 3)
  return passoSuave(r + p.macio, r - p.macio, Math.sqrt(dx * dx + dy * dy)) * p.escuro
}

/**
 * A força (0 a 1) da fissura da placa no ponto (lx, ly), em casas dentro dela. O traço segue um rumo sorteado
 * (vetor normalizado, sem seno: a mesma conta em qualquer aparelho), serpenteia por um ruído ao longo dele, afina
 * nas pontas e some antes da junta: a fissura fica inteira dentro da placa.
 */
function fissura(lx: number, ly: number, placa: number): number {
  if (hash(placa, 0, 2310) >= FISSURA.chance) return 0
  const meio = FISSURA.meioMin + (FISSURA.meioMax - FISSURA.meioMin) * hash(placa, 1, 2310)
  const px = lx - (0.6 + 0.8 * hash(placa, 2, 2310))
  const py = ly - (0.6 + 0.8 * hash(placa, 3, 2310))
  if (Math.abs(px) > meio + FISSURA.curva || Math.abs(py) > meio + FISSURA.curva) return 0
  let dx = hash(placa, 4, 2310) * 2 - 1
  let dy = hash(placa, 5, 2310) * 2 - 1
  const n = Math.sqrt(dx * dx + dy * dy) || 1
  dx /= n
  dy /= n
  const ao = px * dx + py * dy
  if (Math.abs(ao) >= meio) return 0
  // A curva larga e o tremor miúdo, ruído ao longo do traço (uma linha de ruído por placa).
  const desvio = (valor(ao * 3 + 8, placa, 64, 2311) - 0.5) * 2 * FISSURA.curva + (valor(ao * 12 + 8, placa, 64, 2312) - 0.5) * 2 * FISSURA.tremor
  const fora = Math.abs(py * dx - px * dy - desvio)
  const ponta = passoSuave(meio, meio * 0.55, Math.abs(ao))
  const borda = Math.min(lx, PLACA - lx, ly, PLACA - ly)
  return passoSuave(FISSURA.meia + FISSURA.macio, FISSURA.meia, fora) * ponta * passoSuave(0.04, 0.14, borda)
}

/** A cor do concreto no ponto (u, v) do ladrilho. */
export function texturaConcreto(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * CASAS
  const y = vv * CASAS
  const ix = Math.floor(x / PLACA)
  const iy = Math.floor(y / PLACA)
  const lx = x - ix * PLACA
  const ly = y - iy * PLACA
  const placa = iy * PLACAS + ix
  const claro = Math.min(lx, ly)
  const escuro = Math.min(PLACA - lx, PLACA - ly)
  const borda = Math.min(claro, escuro)

  let c = TONS[Math.floor(hash(ix, iy, 2301) * TONS.length) % TONS.length]
  // A umidade: manchas largas onde o ruído passa do meio, e a mesma mancha subindo mais perto da junta.
  const molhado = fbm(uu, vv, 5, 3, 2302) * 0.5 + 0.5
  const umido = Math.max(passoSuave(0.5, 0.9, molhado), passoSuave(0.4, 0.8, molhado) * passoSuave(UMIDADE.perto, 0.03, borda) * 0.8)
  const alisado = fbm(uu, vv, 12, 2, 2303) * 0.022
  const poros = Math.max(poro(uu, vv, POROS_MIUDOS, 2330), poro(uu, vv, POROS_GRAUDOS, 2340))
  const grao = (valor(uu * GRAO_ESCALA, vv * GRAO_ESCALA, GRAO_ESCALA, 2305) - 0.5) * GRAO
  c = luz(c, (hash(ix, iy, 2306) - 0.5) * 0.04 + alisado + grao - umido * UMIDADE.escuro - poros)
  c = luz(c, -FISSURA.escuro * fissura(lx, ly, placa))

  // A beira quebrada e o sulco da junta. No fundo do sulco a beira não conta: os dois lados da linha ficam iguais
  // e a emenda do ladrilho, que cai ali, some.
  const sulco = passoSuave(JUNTA.fim, JUNTA.fio, borda)
  const beira = passoSuave(BEIRA.largura, BEIRA.fio, claro) * BEIRA.luz - passoSuave(BEIRA.largura, BEIRA.fio, escuro) * BEIRA.sombra
  c = luz(c, beira * (1 - sulco) - JUNTA_ESCURO * sulco)
  return empacotar(c)
}
