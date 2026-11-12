/**
 * MESA DE INSTRUMENTOS DE TORTURA de cima com volume (lote 14 dos objetos novos, 11/11/2026; pedido do mestre:
 * "coloca uns equipamentos de tortura tambem"): a mesa estreita de madeira escura do carrasco. De cima aparece
 * o TAMPO de pranchas, gasto e marcado nas beiras, e, desenrolado sobre ele, o PANO DE COURO com o pesponto na
 * beira e a ponta ainda ENROLADA à direita, com as duas tiras de amarrar soltas. Em cima do couro, ARRUMADOS EM
 * FILA e limpos: a TENAZ, o ALICATE de bico comprido, dois FERROS DE MARCAR de cabo de madeira (um com o anel e
 * a cruz, outro com a pata de três dedos), a MÁSCARA DE FERRO (a peça maior, no meio: o rosto de chapa com as
 * fendas dos olhos, a grade da boca, os rebites e as tiras de ferro abertas para os lados) e, em duas filas
 * curtas, o FUNIL deitado e o MOLHO DE CHAVES, o ROLO DE CORDA e a AMPULHETA deitada. Sem gente e sem sangue.
 *
 * O que a separa da bancada do ferreiro (`bancadaDeFerramentas.ts`): lá as ferramentas estão largadas de
 * qualquer jeito na madeira clara, com a morsa e o queimado; aqui tudo está em fila sobre o couro escuro, como
 * um estojo, e a máscara de ferro no meio diz o que é.
 *
 * NA 3/4 é a mesa de sempre: o tampo sobe com o couro e tudo o que está em cima dele, as quatro pernas vão do
 * chão até ele (`tresQuartos.ts` deriva tudo pelas sombras; nada aqui lê o giro). Material: `madeira` (a
 * nogueira, de partida: a madeira escura do pedido); o couro, o ferro, os cabos, a corda e o vidro são fixos.
 * As coisas em cima do tampo têm o tamanho do menor lado (1,5 x 0,8 casa de partida) e os lugares são frações
 * da pegada: a mesa esticada ganha tampo, não instrumentos maiores.
 */
import { hash, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, cadeia, caixa, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { BURACO, G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- os materiais fixos ----------

/** O ferro dos instrumentos, limpo e escuro, e o mais claro do funil e das chaves (folha de flandres, ferro polido). */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.96)) }
const FERRO_CLARO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.2)) }
/** O couro do pano: marrom curtido; o avesso (na ponta enrolada) é a camurça, mais clara e fosca. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x86, 0x5a, 0x3c] }
const AVESSO_DO_COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x9e, 0x7a, 0x5a] }
/** A linha do pesponto, crua. */
const LINHA: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0xb8, 0x92] }
/** Os cabos dos ferros de marcar: madeira clara, para ler em cima do couro escuro. */
const CABO: MaterialDaPeca = materialDaPeca('pinho')
/** A corda do rolo (a mesma do potro e do poço). */
const CORDA: MaterialDaPeca = materialDaPeca('corda')
/** O vidro da ampulheta (cinza-esverdeado claro, meio transparente) e a areia dentro dele. */
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xd2, 0xd8, 0xd2] }
const AREIA: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xa8, 0x6e] }
/** O brilho do vidro e do fio do ferro polido. */
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xee, 0xec, 0xe4] }
/** As marcas do uso nas beiras do tampo: o escuro do óleo e da fuligem. */
const MARCA: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x2c, 0x22] }

// ---------- as medidas ----------

/** A pegada de partida, em px do protótipo: os instrumentos têm o tamanho de desenho nela. */
const LARGURA_DE_PARTIDA = 1.5 * G
const FUNDO_DE_PARTIDA = 0.8 * G
/** A altura do tampo, em casas: mesa de trabalho, um pouco mais alta que a de jantar. */
const ALTURA_DO_TAMPO = 0.54
/** A beirada padrão que a 3/4 dá ao tampo solto (`ESPESSURA_DO_TAMPO` de `tresQuartos.ts`): a perna para debaixo dela. */
const BEIRADA_DO_TAMPO = 0.06 * G
/** O tampo: a sobra até a beira da pegada, a quina e quantas pranchas ao comprido. */
const FOLGA_DO_TAMPO = 0.6
const QUINA_DO_TAMPO = 1.2
const PRANCHAS = 3
/** As pernas: o lado, o recuo da beira do tampo e a quina (chanfrada: a 3/4 lê a perna redonda e corre o veio de pé). */
const PERNA = 5.6
const RECUO_DA_PERNA = 2
const QUINA_DA_PERNA = 0.32

/** O pano de couro: as sobras do tampo à esquerda, à direita (onde fica o rolo), em cima e embaixo (px de partida). */
const COURO_ESQUERDA = 4.4
const COURO_DIREITA = 9.5
const COURO_FUNDO = 3.4
/** O pesponto: a distância da beira, o passo e o comprimento de cada ponto. */
const PESPONTO_DA_BEIRA = 1.5
const PASSO_DO_PESPONTO = 2.2
const PONTO_DO_PESPONTO = 0.55
/** O rolo da ponta: o raio, quanto passa do pano em cima e embaixo, e onde ele fica (da beira direita do tampo). */
const RAIO_DO_ROLO = 4
const SOBRA_DO_ROLO = 1
const ROLO_DA_BEIRA = 6.2
/** A sombra que cada instrumento faz no couro. */
const SOMBRA_DO_INSTRUMENTO: Projecao = { dist: 1.1, forca: 0.36, suave: 0.8 }
/** As marcas nas beiras do tampo: quantas. */
const MARCAS = 9

/** Onde fica cada instrumento: x em fração da meia largura, a ponta de cima em fração do meio fundo. */
const TENAZ = { x: -0.774, y: -0.74 }
const ALICATE = { x: -0.619, y: -0.74 }
const FERRO_1 = { x: -0.476, y: -0.76 }
const FERRO_2 = { x: -0.345, y: -0.76 }
const MASCARA = { x: -0.048, y: 0.06 }
const FUNIL = { x: 0.298, y: -0.76 }
const CHAVES = { x: 0.298, y: 0.24 }
const ROLO_DE_CORDA = { x: 0.56, y: -0.42 }
const AMPULHETA = { x: 0.56, y: 0.1 }

/** Leva os pontos de um instrumento desenhado de pé (x de través, y para baixo a partir da ponta de cima) ao lugar no couro. */
function noLugar(x0: number, y0: number, k: number): (p: Ponto) => Ponto {
  return ([x, y]) => [x0 + x * k, y0 + y * k]
}

// ---------- as texturas ----------

/** O veio das pranchas com as beiras gastas e as manchas largas do uso, sem listra. */
function texDoTampo(forma: Forma): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const t = -forma.d(x, y)
    if (t < 1.6) s[3] += 0.1 * (1 - (t > 0 ? t : 0) / 1.6)
    s[3] += ruido(x * 0.08 + p.su, y * 0.1 + p.sv) * 0.12 - 0.02
  }
}

/** O couro: o grão miúdo, as dobras largas de ter ficado enrolado e a beira mais escura do manuseio. */
function texDoCouro(forma: Forma): Textura {
  return (_u, _v, x, y, p, s) => {
    const t = -forma.d(x, y)
    s[3] += ruido(x * 1.3 + p.su, y * 1.3 + p.sv) * 0.07 + ruido(x * 0.16 + p.sv, y * 0.05) * 0.1 - (t < 2.2 ? 0.1 * (1 - (t > 0 ? t : 0) / 2.2) : 0)
  }
}

/** O pesponto: pontos de linha ao longo da beira (a beira de cima e a de baixo correm em x, as dos lados em y). */
function texDoPesponto(x0: number, y0: number, x1: number, y1: number, k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const nasLaterais = Math.min(x - x0, x1 - x) < Math.min(y - y0, y1 - y)
    const ao = (nasLaterais ? y : x) / (PASSO_DO_PESPONTO * k)
    s[5] = ao - Math.floor(ao) < PONTO_DO_PESPONTO ? 1 : 0
  }
}

/** A areia da ampulheta: o grão fino. */
const texDaAreia: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 1.8 + p.su, y * 1.8) * 0.1
}

// ---------- a mesa ----------

interface Mesa {
  readonly c: ContextoDoMovel
  readonly L: Peca[]
  /** O tamanho dos instrumentos: 1 na mesa de 1,5 x 0,8 casa. */
  readonly k: number
}

function montarTampo(m: Mesa, tampo: Forma): void {
  const { c, L, k } = m
  const P = c.peca
  const mad = c.m.madeira
  const [x0, y0, x1, y1] = tampo.b
  // A grossura da prancha aparecendo embaixo e à direita, e o tampo de pranchas ao comprido.
  L.push(P(tampo, mad, { dx: 0.4 * k, dy: 1.2 * k, tabua: 0, bisel: 0.7, contorno: 0.2, tom: 0.6, semente: 5101 }))
  L.push(P(tampo, mad, { tabua: (y1 - y0) / PRANCHAS, bisel: 1.4, contorno: 0.12, tom: 1.02, textura: texDoTampo(tampo), semente: 5102 }))
  // As marcas do uso nas beiras que o couro não cobre: o óleo, a fuligem e os talhos.
  for (let i = 0; i < MARCAS; i += 1) {
    const naEsquerda = i % 3 === 0
    const cx = naEsquerda ? x0 + (1 + hash(i, 1, 5110) * 2.4) * k : x0 + (x1 - x0) * (0.08 + hash(i, 2, 5110) * 0.84)
    const cy = naEsquerda ? y0 + (y1 - y0) * (0.15 + hash(i, 3, 5110) * 0.7) : hash(i, 4, 5110) > 0.5 ? y0 + 1.4 * k : y1 - 1.4 * k
    const talho = i % 2 === 0
    const ang = (hash(i, 5, 5110) - 0.5) * 1.6
    const meio = (1.4 + hash(i, 6, 5110) * 2.2) * k
    const forma = talho ? capsula(cx - Math.cos(ang) * meio, cy - Math.sin(ang) * meio, cx + Math.cos(ang) * meio, cy + Math.sin(ang) * meio, 0.25 * k) : elipse(cx, cy, meio, meio * 0.6)
    L.push(P(forma, MARCA, { bisel: 0, contorno: 0, alfa: talho ? 0.42 : 0.2, suave: talho ? 0.3 : 1.4, semente: 5111 + i }))
  }
}

/** O pano de couro desenrolado, o pesponto, a ponta enrolada e as tiras soltas. Devolve a caixa do pano. */
function montarCouro(m: Mesa, tampo: Forma): readonly [number, number, number, number] {
  const { c, L, k } = m
  const P = c.peca
  const [tx0, ty0, tx1, ty1] = tampo.b
  const x0 = tx0 + COURO_ESQUERDA * k
  const x1 = tx1 - COURO_DIREITA * k
  const y0 = ty0 + COURO_FUNDO * k
  const y1 = ty1 - COURO_FUNDO * k
  const pano = caixa(x0, y0, x1 + RAIO_DO_ROLO * k, y1, 0.8 * k)
  L.push(P(pano, COURO, { bisel: 0.7, contorno: 0.16, textura: texDoCouro(pano), semente: 5120, projeta: { dist: 0.6, forca: 0.22, suave: 0.6 } }))
  const b = PESPONTO_DA_BEIRA * k
  const costura = menos(caixa(x0 + b - 0.3 * k, y0 + b - 0.3 * k, x1 + RAIO_DO_ROLO * k + 1, y1 - b + 0.3 * k, 0.5 * k), caixa(x0 + b + 0.3 * k, y0 + b + 0.3 * k, x1 + RAIO_DO_ROLO * k + 2, y1 - b - 0.3 * k))
  L.push(P(costura, LINHA, { bisel: 0, contorno: 0, alfa: 0.75, textura: texDoPesponto(x0 + b, y0 + b, x1 + 1e3, y1 - b, k), semente: 5121 }))
  // A ponta enrolada: um rolo de couro de pé no fim do pano, mostrando o avesso; as tiras de amarrar saem dele.
  const rx = tx1 - ROLO_DA_BEIRA * k
  const raio = RAIO_DO_ROLO * k
  L.push(P(capsula(rx, y0 - SOBRA_DO_ROLO * k + raio, rx, y1 + SOBRA_DO_ROLO * k - raio, raio), AVESSO_DO_COURO, { bisel: raio * 0.9, contorno: 0.2, eixo: QUARTO, semente: 5122, projeta: { dist: 1.4, forca: 0.3, suave: 1 } }))
  L.push(P(capsula(rx - raio * 0.45, y0, rx - raio * 0.45, y1, 0.45 * k), COURO, { bisel: 0.4 * k, contorno: 0.2, tom: 0.82, semente: 5123 }))
  for (const [lado, i] of [[-1, 0], [1, 1]] as const) {
    const ya = (lado < 0 ? y0 + (y1 - y0) * 0.32 : y0 + (y1 - y0) * 0.66)
    const tira: Ponto[] = [[rx + raio * 0.6, ya], [rx + raio + 1.4 * k, ya + lado * 1.2 * k], [rx + raio + 2.4 * k, ya + lado * 3.4 * k], [rx + raio + 1.6 * k, ya + lado * 5.6 * k]]
    L.push(P(cadeia(tira, 0.5 * k), COURO, { bisel: 0.45 * k, contorno: 0.22, tom: 0.9, semente: 5124 + i, projeta: { dist: 0.6, forca: 0.26, suave: 0.6 } }))
  }
  return [x0, y0, x1, y1]
}

// ---------- os instrumentos (desenhados de pé: y para baixo a partir da ponta de cima, em px de partida) ----------

/** A tenaz: as duas hastes cruzadas no rebite, a boca curva em cima e os cabos abrindo embaixo. */
function montarTenaz(m: Mesa, x0: number, y0: number): void {
  const { c, L, k } = m
  const P = c.peca
  const em = noLugar(x0, y0, k)
  const haste = (lado: number): Ponto[] => ([[-1.4 * lado, 0], [-2.2 * lado, 2.8], [0, 8.4], [1.6 * lado, 20], [2.6 * lado, 31]] as Ponto[]).map(em)
  L.push(P(cadeia(haste(1), 0.85 * k), FERRO, { bisel: 0.8 * k, contorno: 0.3, metal: 0.32, semente: 5130, projeta: SOMBRA_DO_INSTRUMENTO }))
  L.push(P(cadeia(haste(-1), 0.85 * k), FERRO, { bisel: 0.8 * k, tom: 1.1, contorno: 0.3, metal: 0.32, semente: 5131, projeta: SOMBRA_DO_INSTRUMENTO }))
  const [rx, ry] = em([0, 8.4])
  L.push(P(elipse(rx, ry, 1.4 * k, 1.4 * k), FERRO, { bisel: 1.1 * k, tom: 1.2, contorno: 0.3, metal: 0.5, semente: 5132 }))
}

/** O alicate de bico comprido: o bico reto e serrilhado, o olho do eixo e os cabos curvos com a ponta virada. */
function montarAlicate(m: Mesa, x0: number, y0: number): void {
  const { c, L, k } = m
  const P = c.peca
  const em = noLugar(x0, y0, k)
  for (const [lado, i] of [[-1, 0], [1, 1]] as const) {
    const bico = poligono(([[0, 0], [0.9 * lado, 0.4], [1.5 * lado, 10.5], [0.1 * lado, 10.5]] as Ponto[]).map(em))
    L.push(P(bico, FERRO, { bisel: 0.6 * k, tom: 1 + 0.1 * i, contorno: 0.3, metal: 0.36, semente: 5140 + i, projeta: SOMBRA_DO_INSTRUMENTO }))
    const cabo = ([[0.8 * lado, 12], [2.2 * lado, 18], [2.6 * lado, 26], [1.6 * lado, 30.5], [2.4 * lado, 31.5]] as Ponto[]).map(em)
    L.push(P(cadeia(cabo, 0.8 * k), FERRO, { bisel: 0.75 * k, tom: 1 + 0.1 * i, contorno: 0.3, metal: 0.32, semente: 5142 + i, projeta: SOMBRA_DO_INSTRUMENTO }))
  }
  // O serrilhado do bico: riscos claros de través.
  for (let j = 0; j < 4; j += 1) {
    const [ax, ay] = em([-0.9, 2.4 + j * 2])
    const [bx, by] = em([0.9, 2.4 + j * 2])
    L.push(P(capsula(ax, ay, bx, by, 0.18 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.35, semente: 5145 + j }))
  }
  const [ox, oy] = em([0, 11.3])
  L.push(P(elipse(ox, oy, 2 * k, 1.7 * k), FERRO, { bisel: 1.2 * k, tom: 1.12, contorno: 0.3, metal: 0.45, semente: 5150 }))
  L.push(P(elipse(ox, oy, 0.6 * k, 0.6 * k), FERRO, { bisel: 0.5 * k, tom: 1.35, contorno: 0.2, metal: 0.5, semente: 5151 }))
}

/** O ferro de marcar: a marca de ferro em cima, a vara, a virola e o cabo torneado embaixo. */
function montarFerroDeMarcar(m: Mesa, x0: number, y0: number, marca: 'cruz' | 'pata', semente: number): void {
  const { c, L, k } = m
  const P = c.peca
  const em = noLugar(x0, y0, k)
  const [vx0, vy0] = em([0, 5])
  const [vx1, vy1] = em([0, 21.5])
  L.push(P(capsula(vx0, vy0, vx1, vy1, 0.65 * k), FERRO, { bisel: 0.6 * k, contorno: 0.3, metal: 0.34, semente, projeta: SOMBRA_DO_INSTRUMENTO }))
  if (marca === 'cruz') {
    const [mx, my] = em([0, 2.6])
    L.push(P(anel(mx, my, 2.7 * k, 2.7 * k, 1.8 * k, 1.8 * k), FERRO, { bisel: 0.6 * k, contorno: 0.3, metal: 0.36, semente: semente + 1, projeta: SOMBRA_DO_INSTRUMENTO }))
    L.push(P(uniao(capsula(mx - 2 * k, my, mx + 2 * k, my, 0.42 * k), capsula(mx, my - 2 * k, mx, my + 2 * k, 0.42 * k)), FERRO, { bisel: 0.4 * k, tom: 1.1, contorno: 0.3, metal: 0.36, semente: semente + 2 }))
  } else {
    const pe: Ponto = em([0, 5])
    for (const [dx, i] of [[-2.6, 0], [0, 1], [2.6, 2]] as const) {
      L.push(P(cadeia([pe, em([dx * 0.4, 2.8]), em([dx, 0.2])], 0.48 * k), FERRO, { bisel: 0.45 * k, tom: 1.05, contorno: 0.3, metal: 0.36, semente: semente + 1 + i, projeta: SOMBRA_DO_INSTRUMENTO }))
    }
  }
  // A virola de ferro e o cabo de madeira torneado, com o anel do meio.
  const [cx0, cy0] = em([0, 22])
  const [cx1, cy1] = em([0, 31])
  L.push(P(capsula(cx0, cy0, cx1, cy1, 1.45 * k), CABO, { eixo: QUARTO, tabua: 0, bisel: 1.2 * k, contorno: 0.28, semente: semente + 5, projeta: SOMBRA_DO_INSTRUMENTO }))
  L.push(P(caixa(cx0 - 1.15 * k, cy0 - 0.9 * k, cx0 + 1.15 * k, cy0 + 0.8 * k, 0.3 * k), FERRO, { bisel: 0.5 * k, tom: 1.15, contorno: 0.26, metal: 0.4, semente: semente + 6 }))
  const [ax, ay] = em([0, 26.5])
  L.push(P(caixa(ax - 1.55 * k, ay - 0.45 * k, ax + 1.55 * k, ay + 0.45 * k, 0.3 * k), CABO, { tabua: 0, bisel: 0.4 * k, tom: 0.78, contorno: 0.2, semente: semente + 7 }))
}

/** O rebite da máscara: a cabeça redonda que pega a luz. */
function rebite(m: Mesa, x: number, y: number, r: number, semente: number): void {
  m.L.push(m.c.peca(elipse(x, y, r, r), FERRO, { bisel: r * 0.8, tom: 1.28, contorno: 0.24, metal: 0.5, semente }))
}

/**
 * A máscara de ferro, de rosto para cima: o espelho do rosto abaulado, a testa reforçada, as fendas dos olhos
 * (o couro aparece escuro por elas), o nariz, a grade da boca, os rebites da beira e as tiras de ferro abertas
 * para os lados, com a dobradiça e os furos da fivela. (x0, y0) é o meio do rosto.
 */
function montarMascara(m: Mesa, x0: number, y0: number): void {
  const { c, L, k } = m
  const P = c.peca
  const em = noLugar(x0, y0, k)
  // As tiras de ferro abertas, por baixo do rosto: uma de cada lado, caída ao longo da face (a dobradiça na
  // têmpora e os furos da fivela na ponta), e a de cima, que passa por cima da cabeça. Para cima, as duas
  // viravam chifres.
  for (const [lado, i] of [[-1, 0], [1, 1]] as const) {
    const tira: Ponto[] = [em([5.6 * lado, -3.2]), em([8.4 * lado, -2.4]), em([9.4 * lado, 1.6])]
    L.push(P(cadeia(tira, 0.95 * k), FERRO, { bisel: 0.7 * k, tom: 0.95, contorno: 0.3, metal: 0.3, semente: 5160 + i, projeta: SOMBRA_DO_INSTRUMENTO }))
    rebite(m, ...em([6.2 * lado, -3.1]), 0.6 * k, 5162)
    for (const f of [-0.6, 0.8]) L.push(P(elipse(...em([(9 + f * 0.25) * lado, f]), 0.36 * k, 0.36 * k), BURACO, { bisel: 0.2, contorno: 0, semente: 5163 + i }))
  }
  const [tx0, ty0] = em([0, -8.5])
  const [tx1, ty1] = em([0, -13.2])
  L.push(P(capsula(tx0, ty0, tx1, ty1, 0.95 * k), FERRO, { bisel: 0.7 * k, tom: 0.95, contorno: 0.3, metal: 0.3, semente: 5164, projeta: SOMBRA_DO_INSTRUMENTO }))
  // O rosto: a testa larga e o queixo estreito, abaulados.
  const rosto = uniao(elipse(...em([0, -2.2]), 6.6 * k, 7.4 * k), elipse(...em([0, 3.2]), 4.9 * k, 6.4 * k))
  L.push(P(rosto, FERRO, { bisel: 3.4 * k, contorno: 0.3, metal: 0.36, semente: 5165, projeta: { dist: 1.6, forca: 0.4, suave: 1 } }))
  // A testa reforçada: a cinta de través com os rebites.
  const [bx0, by0] = em([-5.6, -5.2])
  const [bx1, by1] = em([5.6, -5.2])
  L.push(P(capsula(bx0, by0, bx1, by1, 1.05 * k), FERRO, { bisel: 0.8 * k, tom: 1.12, contorno: 0.28, metal: 0.36, semente: 5166, projeta: { dist: 0.6, forca: 0.3, suave: 0.6 } }))
  for (const f of [-4.2, 0, 4.2]) rebite(m, ...em([f, -5.2]), 0.55 * k, 5167)
  // Os olhos: fendas em amêndoa, com o couro escuro por baixo e a beira de cima na sombra.
  for (const lado of [-1, 1]) {
    const [ox, oy] = em([2.7 * lado, -2.2])
    const olho = poligono(([[-1.9, 0], [-0.6, -0.65], [0.9, -0.5], [1.9, 0.1], [0.6, 0.55], [-0.9, 0.45]] as Ponto[]).map(([x, y]): Ponto => [ox + x * lado * k, oy + y * k]))
    L.push(P(olho, BURACO, { bisel: 0, contorno: 0, recesso: { k: 0.7, forca: 0.4 }, semente: 5168 }))
  }
  // O nariz: a quilha de chapa dobrada, com os dois furos de respirar embaixo.
  const [nx0, ny0] = em([0, -1.4])
  const [nx1, ny1] = em([0, 2.6])
  L.push(P(capsula(nx0, ny0, nx1, ny1, 1.05 * k), FERRO, { bisel: 0.9 * k, tom: 1.16, contorno: 0.24, metal: 0.42, semente: 5169 }))
  for (const lado of [-1, 1]) L.push(P(elipse(...em([0.75 * lado, 3.5]), 0.32 * k, 0.32 * k), BURACO, { bisel: 0, contorno: 0 }))
  // A grade da boca: a fenda escura e as três barras de pé por cima.
  const [gx, gy] = em([0, 6.4])
  L.push(P(caixa(gx - 2.6 * k, gy - 0.85 * k, gx + 2.6 * k, gy + 0.85 * k, 0.5 * k), BURACO, { bisel: 0, contorno: 0, recesso: { k: 0.6, forca: 0.4 }, semente: 5170 }))
  for (const f of [-1.5, 0, 1.5]) {
    const [ax, ay] = em([f, 5.2])
    const [bx, by] = em([f, 7.6])
    L.push(P(capsula(ax, ay, bx, by, 0.36 * k), FERRO, { bisel: 0.3 * k, tom: 1.15, contorno: 0.24, metal: 0.4, semente: 5171 }))
  }
  // Os rebites da beira do queixo e o fio de luz no alto da testa polida.
  for (const [f, g] of [[-4.1, 3.4], [4.1, 3.4], [-2.6, 7.9], [2.6, 7.9]] as const) rebite(m, ...em([f, g]), 0.5 * k, 5172)
  L.push(P(capsula(...em([-3.8, -7.2]), ...em([-1.4, -8.1]), 0.42 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.45, suave: 0.5, semente: 5173 }))
}

/** O funil deitado, de boca para cima na mesa: a boca larga (o escuro de dentro), o cone e o bico. */
function montarFunil(m: Mesa, x0: number, y0: number): void {
  const { c, L, k } = m
  const P = c.peca
  const em = noLugar(x0, y0, k)
  const cone = poligono(([[-4.6, 1.2], [4.6, 1.2], [1.1, 9], [-1.1, 9]] as Ponto[]).map(em))
  const [sx0, sy0] = em([0, 8.4])
  const [sx1, sy1] = em([0, 13])
  L.push(P(capsula(sx0, sy0, sx1, sy1, 0.9 * k), FERRO_CLARO, { bisel: 0.8 * k, contorno: 0.28, metal: 0.42, semente: 5180, projeta: SOMBRA_DO_INSTRUMENTO }))
  L.push(P(cone, FERRO_CLARO, { bisel: 2.2 * k, contorno: 0.28, metal: 0.42, semente: 5181, projeta: SOMBRA_DO_INSTRUMENTO }))
  const [bx, by] = em([0, 1.2])
  L.push(P(anel(bx, by, 4.9 * k, 1.9 * k, 4 * k, 1.1 * k), FERRO_CLARO, { bisel: 0.5 * k, tom: 1.12, contorno: 0.26, metal: 0.45, semente: 5182 }))
  L.push(P(elipse(bx, by, 4 * k, 1.1 * k), BURACO, { bisel: 0, contorno: 0, recesso: { k: 0.7, forca: 0.45 }, semente: 5183 }))
}

/** O molho de chaves: a argola e três chaves em leque, cada uma com o olho, a haste e o palhetão de dentes. */
function montarChaves(m: Mesa, x0: number, y0: number): void {
  const { c, L, k } = m
  const P = c.peca
  const [ax, ay] = [x0, y0 + 2.6 * k]
  ;[-0.5, 0.05, 0.6].forEach((giro, i) => {
    const dir: Ponto = [Math.sin(giro), Math.cos(giro)]
    const ponto = (t: number, lado: number): Ponto => [ax + dir[0] * t * k + dir[1] * lado * k, ay + dir[1] * t * k - dir[0] * lado * k]
    const mat = i === 1 ? FERRO_CLARO : FERRO
    L.push(P(capsula(...ponto(3.6, 0), ...ponto(10.2, 0), 0.5 * k), mat, { bisel: 0.45 * k, contorno: 0.3, metal: 0.4, semente: 5190 + i, projeta: SOMBRA_DO_INSTRUMENTO }))
    L.push(P(poligono([ponto(8, 0.3), ponto(10.4, 0.3), ponto(10.4, 2.1), ponto(9.6, 2.1), ponto(9.6, 1.3), ponto(8.8, 1.3), ponto(8.8, 2.1), ponto(8, 2.1)]), mat, { bisel: 0.35 * k, contorno: 0.3, metal: 0.4, semente: 5193 + i, projeta: SOMBRA_DO_INSTRUMENTO }))
    const [ox, oy] = ponto(2.6, 0)
    L.push(P(anel(ox, oy, 1.55 * k, 1.55 * k, 0.75 * k, 0.75 * k), mat, { bisel: 0.4 * k, contorno: 0.3, metal: 0.4, semente: 5196 + i, projeta: SOMBRA_DO_INSTRUMENTO }))
  })
  L.push(P(anel(ax, ay, 3.1 * k, 3.1 * k, 2.3 * k, 2.3 * k), FERRO, { bisel: 0.5 * k, tom: 1.1, contorno: 0.3, metal: 0.45, semente: 5199, projeta: SOMBRA_DO_INSTRUMENTO }))
}

/** O rolo de corda: a espiral de três voltas e meia e a ponta presa por baixo. */
function montarRoloDeCorda(m: Mesa, x0: number, y0: number): void {
  const { c, L, k } = m
  const P = c.peca
  const pontos: Ponto[] = []
  const voltas = 3.4
  const passos = 70
  for (let i = 0; i <= passos; i += 1) {
    const t = i / passos
    const a = t * voltas * Math.PI * 2 + 0.6
    const r = (1.1 + t * 4.1) * k
    pontos.push([x0 + Math.cos(a) * r, y0 + Math.sin(a) * r])
  }
  L.push(P(cadeia(pontos, 0.78 * k), CORDA, { bisel: 0.7 * k, contorno: 0.24, semente: 5200, projeta: { dist: 1.2, forca: 0.36, suave: 0.9 } }))
  const [ex, ey] = pontos[pontos.length - 1]
  L.push(P(cadeia([[ex, ey], [ex + 1.6 * k, ey + 2 * k], [ex + 1.2 * k, ey + 4.4 * k]], 0.72 * k), CORDA, { bisel: 0.65 * k, contorno: 0.24, semente: 5201, projeta: SOMBRA_DO_INSTRUMENTO }))
}

/** A ampulheta deitada: os dois tampos de madeira, as colunas, o vidro em oito e a areia quase toda embaixo. */
function montarAmpulheta(m: Mesa, x0: number, y0: number): void {
  const { c, L, k } = m
  const P = c.peca
  const em = noLugar(x0, y0, k)
  for (const lado of [-1, 1]) {
    const [ax, ay] = em([3.6 * lado, 1.4])
    const [bx, by] = em([3.6 * lado, 11.6])
    L.push(P(capsula(ax, ay, bx, by, 0.55 * k), CABO, { eixo: QUARTO, tabua: 0, bisel: 0.5 * k, tom: 0.86, contorno: 0.26, semente: 5210, projeta: SOMBRA_DO_INSTRUMENTO }))
  }
  const vidro = uniao(uniao(elipse(...em([0, 4]), 2.9 * k, 2.9 * k), elipse(...em([0, 9]), 2.9 * k, 2.9 * k)), capsula(...em([0, 4]), ...em([0, 9]), 0.7 * k))
  L.push(P(vidro, VIDRO, { bisel: 1.6 * k, contorno: 0.2, alfa: 0.62, semente: 5211, projeta: { dist: 0.8, forca: 0.2, suave: 0.8 } }))
  L.push(P(uniao(elipse(...em([0, 9.4]), 2.3 * k, 2.2 * k), elipse(...em([0, 4.6]), 1.1 * k, 0.6 * k)), AREIA, { bisel: 0.8 * k, contorno: 0.12, alfa: 0.92, textura: texDaAreia, semente: 5212 }))
  L.push(P(capsula(...em([-1.4, 2.6]), ...em([-1.6, 4.8]), 0.38 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.4 }))
  for (const y of [0.7, 12.3]) {
    const [cx, cy] = em([0, y])
    L.push(P(caixa(cx - 4.6 * k, cy - 0.85 * k, cx + 4.6 * k, cy + 0.85 * k, 0.5 * k), CABO, { tabua: 0, bisel: 0.6 * k, contorno: 0.28, semente: 5213, projeta: SOMBRA_DO_INSTRUMENTO }))
  }
}

export const montarMesaDeInstrumentos: MontarMovel = (c, cena) => {
  const { hw, hh, g } = c
  const k = Math.min(c.w / LARGURA_DE_PARTIDA, c.h / FUNDO_DE_PARTIDA)
  const m: Mesa = { c, L: cena.partes, k }
  const zTampo = g * ALTURA_DO_TAMPO
  const tampo = caixa(-hw + FOLGA_DO_TAMPO, -hh + FOLGA_DO_TAMPO, hw - FOLGA_DO_TAMPO, hh - FOLGA_DO_TAMPO, QUINA_DO_TAMPO * k)

  // A sombra de baixo (pesada, em volta do tampo), a do tampo (solta, mais clara) e a de cada perna.
  const lado = PERNA * k
  const alem = 1.3 * k
  cena.sombras.push(
    { forma: caixa(tampo.b[0] - alem, tampo.b[1] - alem, tampo.b[2] + alem, tampo.b[3] + alem, QUINA_DO_TAMPO * k + alem), z: 0, suave: alem, forca: 0.36 },
    { forma: tampo, z: zTampo, solta: true, suave: 1.8, forca: 0.24 },
  )
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = sx < 0 ? tampo.b[0] + RECUO_DA_PERNA * k : tampo.b[2] - RECUO_DA_PERNA * k - lado
      const y = sy < 0 ? tampo.b[1] + RECUO_DA_PERNA * k : tampo.b[3] - RECUO_DA_PERNA * k - lado
      const perna = caixa(x, y, x + lado, y + lado, QUINA_DA_PERNA * lado)
      cena.sombras.push({ forma: perna, z: zTampo - BEIRADA_DO_TAMPO, suave: 0.9, forca: 0.3 }, contato(perna, 0.34))
    }
  }

  montarTampo(m, tampo)
  montarCouro(m, tampo)
  const naFila = (o: { readonly x: number; readonly y: number }): [number, number] => [o.x * hw, o.y * hh]
  montarTenaz(m, ...naFila(TENAZ))
  montarAlicate(m, ...naFila(ALICATE))
  montarFerroDeMarcar(m, ...naFila(FERRO_1), 'cruz', 5220)
  montarFerroDeMarcar(m, ...naFila(FERRO_2), 'pata', 5230)
  montarFunil(m, ...naFila(FUNIL))
  montarChaves(m, ...naFila(CHAVES))
  montarRoloDeCorda(m, ...naFila(ROLO_DE_CORDA))
  montarAmpulheta(m, ...naFila(AMPULHETA))
  montarMascara(m, ...naFila(MASCARA))
}
