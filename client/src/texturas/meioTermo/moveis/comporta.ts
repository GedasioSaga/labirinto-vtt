/**
 * COMPORTA de cima com volume (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema
 * Esgotos): a porta de tábuas que represa o canal. Nas duas pontas, os PILARES de pedra lavrada, cada um com a ranhura
 * forrada de ferro onde a folha corre; entre eles, a FOLHA de tábuas grossas de pé (de cima, as pontas das tábuas, a
 * cantoneira de ferro na beira de montante e as duas cintas); por cima, o PÓRTICO de ferro de pilar a pilar, rebitado,
 * com a CAIXA de engrenagem no meio e o VOLANTE de quatro raios, de tinta vermelha gasta (a do volante do cano), e a
 * ponta da HASTE rosqueada no cubo. O canal corre de cima para baixo (giro 0): a montante fica em cima.
 *
 * As VERSÕES (`versoes/comportaVersoes.ts`): FECHADA (`montarComporta`, a 1ª): a folha baixada, a água parada a
 * montante, com a beira clara encostada na folha e o lixo e a espuma suja juntados contra ela; a jusante, o chão
 * úmido e dois fios de água vazando por baixo; a haste quase toda dentro da caixa (sombra curta). ABERTA
 * (`montarComportaAberta`): a folha suspensa (a sombra dela cai longe), a haste alta saindo do volante (a sombra
 * comprida dela no chão diz "erguida"), a água a montante correndo para o vão e, a jusante, a ESPUMA batida da água que
 * passa por baixo, abrindo em leque até a beira.
 *
 * O que é alto (o pórtico, a caixa, o volante, a folha suspensa) deita a sombra PINTADA, como o tubo da saída de
 * esgoto: sombra solta virava coluna cheia na 3/4. Pegada de partida 2 x 1 casas (um canal de casa e meia); o que é
 * comprido sai da largura, o que é redondo sai do menor lado. Materiais: `madeira` (a folha, padrão carvalho), `metal`
 * (o pórtico, a caixa, o volante, a haste, a cantoneira e as cintas, padrão ferro) e `pedra` (os pilares, padrão
 * granito). A água, a espuma, o lixo, a umidade e a tinta são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, barra, caixa, capsula, dentroDe, elipse, elipseGirada, uniao, type Forma } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { FORCA_NO_METAL, SOMBRA_PINTADA, texDoDomo } from './cano'

// ---------- as medidas (px do protótipo, salvo onde diz) ----------

/** O pilar: a largura (fração da largura da pegada) e o meio comprimento (fração da altura). */
const LARGURA_DO_PILAR = 0.13
const MEIO_PILAR = 0.42
/** A ranhura no pilar: a meia largura e a fundura. */
const MEIA_RANHURA = 4.6
const FUNDURA_DA_RANHURA = 3
/** A folha: a meia grossura, quanto entra em cada ranhura e a largura das tábuas. */
const MEIA_FOLHA = 4
const FOLHA_NA_RANHURA = 2.4
const TABUA = 6.5
/** O pórtico (meia largura), a caixa (meias medidas) e o volante (raio do aro, largura do aro, raio do cubo). */
const MEIO_PORTICO = 1.7
const CAIXA = { x: 7, y: 5.6 } as const
const VOLANTE = { raio: 0.17, aro: 1.5, cubo: 1.9, braco: 0.75 } as const
/** As alturas (px): o pilar e o pórtico, a folha baixada e a suspensa, a ponta da haste fechada e aberta. */
const ALTURA_DO_PILAR = 0.95 * G
const ALTURA_DA_FOLHA_BAIXADA = 0.3 * G
const ALTURA_DA_FOLHA_ERGUIDA = 0.85 * G
const HASTE_FECHADA = 0.12 * G
const HASTE_ABERTA = 0.72 * G

// ---------- os materiais fixos ----------

const RANHURA: MaterialDaPeca = { classe: 'liso', rgb: [0x26, 0x25, 0x24] }
const TINTA_DO_VOLANTE: MaterialDaPeca = { classe: 'metal', rgb: [0x7a, 0x41, 0x35] }
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x45, 0x3f] }
const BEIRA_DE_LUZ: MaterialDaPeca = { classe: 'liso', rgb: [0x7e, 0x86, 0x76] }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0xa4, 0x9b] }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xb0, 0xb2, 0xa6] }
const ESPUMA_SUJA: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x78, 0x62] }
const UMIDO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2b, 0x27] }
const LIMO: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x5a, 0x34] }
const LIXO: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x4c, 0x36] }
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x56, 0x3d] }
/** O escuro em que o pixel escuro demais é levantado: cinza-verde de esgoto. */
const ESCURO_DO_ESGOTO: Rgb = [0x3a, 0x3e, 0x3a]

// ---------- a régua ----------

interface Medidas {
  /** Onde o pilar começa por dentro (x) e o meio comprimento dele (y). */
  readonly xPilar: number
  readonly yPilar: number
  readonly raio: number
}

function medidas(c: ContextoDoMovel): Medidas {
  return { xPilar: c.hw - LARGURA_DO_PILAR * c.w, yPilar: MEIO_PILAR * c.h, raio: VOLANTE.raio * Math.min(c.w, c.h) }
}

/** A forma com as sombras pintadas de quem está a `z` px do chão. */
function sombraPintada(c: ContextoDoMovel, cena: Cena, forma: Forma, z: number, alfa: number, semente: number): void {
  cena.partes.push(c.peca(forma, SOMBRA_PINTADA, { dx: SOMBRA_X * z, dy: SOMBRA_Y * z, bisel: 0, contorno: 0, alfa, suave: 1.3, semente }))
}

// ---------- a água de cada lado ----------

/** A união de uma lista de formas (a lista nunca vem vazia). */
function juntas(formas: readonly Forma[]): Forma {
  const [primeira, ...resto] = formas
  return resto.reduce((soma, f) => uniao(soma, f), primeira)
}

/** As bolhas de espuma: o corpo sujo e um ponto de luz no alto à esquerda de cada uma. */
function bolhasDeEspuma(c: ContextoDoMovel, cena: Cena, bolhas: readonly (readonly [number, number, number])[], vao: Forma, alfa: number, semente: number): void {
  const P = c.peca
  const corpo = juntas(bolhas.map(([x, y, r]) => elipse(x, y, r * 1.15, r)))
  const luz = juntas(bolhas.map(([x, y, r]) => elipse(x - r * 0.38, y - r * 0.38, r * 0.42, r * 0.36)))
  cena.partes.push(P(dentroDe(corpo, vao), ESPUMA_SUJA, { bisel: 0, contorno: 0, alfa, suave: 0.35, semente }))
  cena.partes.push(P(dentroDe(luz, vao), ESPUMA, { bisel: 0, contorno: 0, alfa: alfa * 0.8, suave: 0.2, semente: semente + 1 }))
}

/**
 * FECHADA: nada de retângulo cheio de água (a água do canal é a do chão do mapa; aqui só o que a comporta faz nela). A
 * montante, a água represada mais funda e escura rente à folha, a linha d'água clara, a espuma suja juntada em bolos
 * (dois nos cantos, um no meio) e dois ciscos; a jusante, só o úmido rente à folha e os dois fios do vazamento.
 */
function aguaRepresada(c: ContextoDoMovel, cena: Cena, M: Medidas): void {
  const { hh, peca: P } = c
  const L = cena.partes
  const x = M.xPilar
  const beira = -MEIA_FOLHA
  const vao = caixa(-x, -hh - 2, x, hh + 2)
  L.push(P(caixa(-x, beira - 12, x, beira, 3), AGUA, { bisel: 0, contorno: 0, alfa: 0.2, suave: 3, semente: 14001 }))
  L.push(P(caixa(-x, beira - 5.5, x, beira, 1.5), AGUA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.6, semente: 14002 }))
  L.push(P(elipseGirada(-x * 0.32, beira - 7.5, x * 0.2, 0.5, -0.04), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.2, suave: 0.8, semente: 14003 }))
  L.push(P(caixa(-x + 0.6, beira - 1.3, x - 0.6, beira - 0.45, 0.4), BEIRA_DE_LUZ, { bisel: 0, contorno: 0, alfa: 0.42, suave: 0.4, semente: 14004 }))
  const bolhas: [number, number, number][] = []
  const bolos = [[-x + 3.2, 7, 4.5], [x * 0.16, 4, 3], [x - 3.6, 6, 4]] as const
  bolos.forEach(([meio, quantas, espalha], k) => {
    for (let i = 0; i < quantas; i += 1) {
      const n = k * 16 + i
      const bx = meio + (hash(n, 1, 14005) - 0.5) * 2 * espalha
      const perto = 1 - Math.abs(bx - meio) / (espalha + 1)
      bolhas.push([bx, beira - 1.4 - hash(n, 2, 14005) * 2.6 * perto, 0.5 + hash(n, 3, 14005) * 0.65])
    }
  })
  bolhasDeEspuma(c, cena, bolhas, vao, 0.75, 14006)
  L.push(P(capsula(-x * 0.5, beira - 3.4, -x * 0.27, beira - 2.5, 0.55), LIXO, { bisel: 0.4, contorno: 0.3, semente: 14008 }))
  L.push(P(elipseGirada(x * 0.44, beira - 3.2, 1.8, 1, 0.4), LIXO, { bisel: 0.5, contorno: 0.3, tom: 1.15, semente: 14009 }))
  // A jusante: o úmido rente à folha e os dois fios do vazamento, cada um acabando numa pocinha.
  L.push(P(caixa(-x, MEIA_FOLHA + 0.5, x, MEIA_FOLHA + 8, 2), UMIDO, { bisel: 0, contorno: 0, alfa: 0.24, suave: 2.4, semente: 14010 }))
  for (const [k, fx] of [[0, -0.42], [1, 0.3]] as const) {
    const px = fx * x
    const fim = MEIA_FOLHA + 7 + hash(k, 1, 14011) * 5
    const fio = capsula(px, MEIA_FOLHA + 0.4, px + 0.9, fim, 0.6)
    L.push(P(elipse(px + 0.9, fim + 0.5, 1.7, 0.95), AGUA, { bisel: 0, contorno: 0, alfa: 0.42, suave: 0.8, semente: 14012 + k }))
    L.push(P(fio, AGUA, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.4, semente: 14014 + k }))
    L.push(P(dentroDe(capsula(px - 0.15, MEIA_FOLHA + 1, px + 0.45, MEIA_FOLHA + 5, 0.22), fio), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.45, semente: 14016 + k }))
  }
}

/**
 * ABERTA: a montante, a água puxada para o vão (mais escura rente a ele) e brilhos curtos convergindo para ele; a
 * jusante, a faixa de bolhas batidas colada à folha e os rastros de espuma que afinam e somem rio abaixo, cada um no seu
 * rumo e no seu comprimento (nada de listra).
 */
function aguaCorrendo(c: ContextoDoMovel, cena: Cena, M: Medidas): void {
  const { hh, peca: P } = c
  const L = cena.partes
  const x = M.xPilar
  const beira = -MEIA_FOLHA
  const vao = caixa(-x, -hh - 2, x, hh + 2)
  L.push(P(caixa(-x, beira - 12, x, beira + 1, 3), AGUA, { bisel: 0, contorno: 0, alfa: 0.2, suave: 3, semente: 14101 }))
  L.push(P(caixa(-x, beira - 5, x, beira + 1, 1.5), AGUA, { bisel: 0, contorno: 0, alfa: 0.26, suave: 1.6, semente: 14102 }))
  for (let i = 0; i < 6; i += 1) {
    const px = (-0.78 + i * 0.31 + (hash(i, 1, 14103) - 0.5) * 0.1) * x
    const py = beira - 2.6 - hash(i, 2, 14103) * 7
    const comprimento = 1.3 + hash(i, 3, 14103) * 1.4
    L.push(P(elipseGirada(px, py, comprimento, 0.4, Math.PI / 2 + (px / x) * 0.4), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.5, semente: 14104 + i }))
  }
  // A jusante: a água baixa, a faixa de bolhas e os rastros.
  L.push(P(caixa(-x, MEIA_FOLHA, x, MEIA_FOLHA + 14, 3), AGUA, { bisel: 0, contorno: 0, alfa: 0.26, suave: 3, semente: 14110 }))
  const banda: [number, number, number][] = []
  for (let i = 0; i < 34; i += 1) {
    banda.push([-x + 1 + hash(i, 1, 14111) * (2 * x - 2), MEIA_FOLHA + 0.6 + hash(i, 2, 14111) * 2.6, 0.55 + hash(i, 3, 14111) * 0.7])
  }
  bolhasDeEspuma(c, cena, banda, vao, 0.72, 14112)
  for (let t = 0; t < 5; t += 1) {
    const x0 = (-0.74 + t * 0.37 + (hash(t, 1, 14120) - 0.5) * 0.16) * x
    const gotas = 4 + Math.floor(hash(t, 2, 14120) * 3)
    const deriva = (hash(t, 3, 14120) - 0.5) * 0.4 + (x0 / x) * 0.22
    for (let k = 0; k < gotas; k += 1) {
      const f = k / gotas
      const n = t * 8 + k
      const by = MEIA_FOLHA + 4.2 + k * 2.6 + (hash(n, 4, 14120) - 0.5) * 1
      const bx = x0 + deriva * k * 2.6 + (hash(n, 5, 14120) - 0.5) * 1.1
      const r = (1.05 - f * 0.55) * (0.85 + hash(n, 6, 14120) * 0.3)
      L.push(P(dentroDe(elipse(bx, by, r, r * 1.4), vao), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.5 * (1 - f), suave: 0.5, semente: 14121 + n }))
    }
  }
}

// ---------- a estrutura: pilares, folha, pórtico, caixa, volante e haste ----------

function montarEstrutura(c: ContextoDoMovel, cena: Cena, M: Medidas, alturaDaFolha: number, haste: number, folhaSuspensa: boolean): void {
  const { hw, peca: P } = c
  const L = cena.partes
  const pedra = c.m.pedra
  const madeira = c.m.madeira
  const ferro = c.m.metal

  // Os pilares e a ranhura forrada de ferro de cada um.
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? -hw : M.xPilar
    const x1 = lado < 0 ? -M.xPilar : hw
    const pilar = caixa(x0, -M.yPilar, x1, M.yPilar, 1.2)
    cena.sombras.push({ forma: pilar, z: ALTURA_DO_PILAR, forca: 0.3 }, contato(pilar, 0.34))
    // Dois blocos de pedra, a junta no meio, deslocada: o de baixo por cima do de cima, e o contorno dele é a junta
    // (nada de fundo escuro embaixo do pilar: na vista 3/4 a cara do pilar sai do que está embaixo dele).
    const juntaY = (hash(lado, 1, 14201) - 0.5) * M.yPilar * 0.5
    L.push(P(caixa(x0, -M.yPilar, x1, juntaY + 1.2, 1.2), pedra, { tabua: 0, bisel: 1.5, tom: 0.95 + hash(lado, 2, 14201) * 0.1, contorno: 0.28, semente: 14203 + lado }))
    L.push(P(caixa(x0, juntaY - 0.3, x1, M.yPilar, 1.2), pedra, { tabua: 0, bisel: 1.5, tom: 0.9 + hash(lado, 3, 14201) * 0.1, contorno: 0.34, semente: 14205 + lado }))
    L.push(P(caixa(x0 + 1, juntaY - 0.75, x1 - 1, juntaY - 0.15, 0.3), RANHURA, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.3, semente: 14202 }))
    const xr = lado < 0 ? -M.xPilar : M.xPilar
    const ranhura = caixa(Math.min(xr, xr - lado * FUNDURA_DA_RANHURA), -MEIA_RANHURA, Math.max(xr, xr - lado * FUNDURA_DA_RANHURA), MEIA_RANHURA)
    L.push(P(caixa(Math.min(xr, xr - lado * (FUNDURA_DA_RANHURA + 1)), -MEIA_RANHURA - 1, Math.max(xr, xr - lado * (FUNDURA_DA_RANHURA + 1)), MEIA_RANHURA + 1, 0.5), ferro, { tabua: 0, bisel: 0.5, tom: 0.85, contorno: 0.3, metal: 0.3, semente: 14207 }))
    L.push(P(ranhura, RANHURA, { bisel: 0, contorno: 0, alfa: 0.92, semente: 14208 }))
    // O limo rente ao pé do pilar, do lado da água.
    L.push(P(dentroDe(caixa(xr - lado * 2.4, -M.yPilar, xr, M.yPilar), pilar), LIMO, { bisel: 0, contorno: 0, alfa: 0.38, suave: 0.9, semente: 14209 }))
  }

  // A folha: as pontas das tábuas de pé, a cantoneira de montante e as duas cintas.
  const xf = M.xPilar + FOLHA_NA_RANHURA
  const folha = caixa(-xf, -MEIA_FOLHA, xf, MEIA_FOLHA, 0.6)
  if (folhaSuspensa) sombraPintada(c, cena, folha, alturaDaFolha, 0.32, 14210)
  else cena.sombras.push({ forma: folha, z: alturaDaFolha, forca: 0.28 }, contato(folha, 0.3))
  L.push(P(folha, madeira, { eixo: QUARTO, tabua: TABUA, bisel: 0.9, tom: 0.96, contorno: 0.3, semente: 14211, projeta: { dist: 1, forca: 0.3 } }))
  L.push(P(caixa(-xf, -MEIA_FOLHA, xf, -MEIA_FOLHA + 1.3, 0.3), ferro, { tabua: 0, bisel: 0.4, tom: 0.92, contorno: 0.3, metal: 0.35, semente: 14212 }))
  for (const fx of [-0.55, 0.55]) {
    const x = fx * M.xPilar
    L.push(P(caixa(x - 1.3, -MEIA_FOLHA - 0.3, x + 1.3, MEIA_FOLHA + 0.3, 0.4), ferro, { tabua: 0, bisel: 0.5, tom: 0.88, contorno: 0.32, metal: 0.3, semente: 14213, projeta: { dist: 0.6, forca: 0.3 } }))
    L.push(P(dentroDe(capsula(x + 0.6, MEIA_FOLHA - 1.4, x + 0.9, MEIA_FOLHA + 2.6, 0.5), caixa(x - 1.3, -MEIA_FOLHA, x + 1.3, MEIA_FOLHA + 3)), FERRUGEM, { bisel: 0, contorno: 0, alfa: 0.4, suave: 0.4, semente: 14214 }))
  }

  // O pórtico de pilar a pilar, a caixa da engrenagem, o volante e a ponta da haste: tudo alto, sombra pintada.
  const portico = caixa(-hw + 1.5, -MEIO_PORTICO, hw - 1.5, MEIO_PORTICO, 0.5)
  const caixaDaEngrenagem = caixa(-CAIXA.x, -CAIXA.y, CAIXA.x, CAIXA.y, 1.4)
  const rv = M.raio
  const aro = anel(0, 0, rv, rv, rv - VOLANTE.aro, rv - VOLANTE.aro)
  const bracos = [0, 1, 2, 3].map((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    return barra(0, 0, Math.cos(a) * (rv - 0.5), Math.sin(a) * (rv - 0.5), VOLANTE.braco * 2)
  })
  const roda = bracos.reduce((soma, b) => uniao(soma, b), aro)
  sombraPintada(c, cena, uniao(portico, caixaDaEngrenagem), ALTURA_DO_PILAR, 0.3, 14220)
  sombraPintada(c, cena, roda, ALTURA_DO_PILAR + 5, 0.28, 14221)
  // A sombra da haste: do cubo até a ponta, comprida quando a folha está erguida.
  const topo = ALTURA_DO_PILAR + 5 + haste
  L.push(P(capsula(SOMBRA_X * (ALTURA_DO_PILAR + 5), SOMBRA_Y * (ALTURA_DO_PILAR + 5), SOMBRA_X * topo, SOMBRA_Y * topo, 0.8), SOMBRA_PINTADA, { bisel: 0, contorno: 0, alfa: 0.34, suave: 0.6, semente: 14222 }))

  L.push(P(portico, ferro, { tabua: 0, bisel: 0.6, tom: 0.9, contorno: 0.32, metal: 0.35, semente: 14223, projeta: { dist: 1.4, forca: 0.36, suave: 0.8 } }))
  for (const lado of [-1, 1]) {
    for (const dx of [3.2, 7]) {
      L.push(P(elipse(lado * (hw - dx), 0, 0.7, 0.7), ferro, { bisel: 0.45, tom: 1.22, contorno: 0.34, metal: 0.5, semente: 14224 }))
    }
  }
  L.push(P(caixaDaEngrenagem, ferro, { tabua: 0, bisel: 1, tom: 0.84, contorno: 0.32, metal: 0.3, textura: texDoDomo(0, 0, CAIXA.x * 1.25, CAIXA.y * 1.25, FORCA_NO_METAL * 0.6, 0, 'metal'), semente: 14225, projeta: { dist: 1.6, forca: 0.38, suave: 0.8 } }))
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    L.push(P(elipse(sx * (CAIXA.x - 1.3), sy * (CAIXA.y - 1.3), 0.7, 0.7), ferro, { bisel: 0.45, tom: 1.22, contorno: 0.34, metal: 0.5, semente: 14226 }))
  }
  for (const b of bracos) L.push(P(b, ferro, { tabua: 0, bisel: 0.45, tom: 0.92, contorno: 0.32, metal: 0.4, semente: 14227, projeta: { dist: 1.8, forca: 0.34, suave: 0.8 } }))
  L.push(P(aro, TINTA_DO_VOLANTE, { tabua: 0, bisel: 0.7, tom: 1, contorno: 0.34, metal: 0.25, semente: 14228, projeta: { dist: 1.8, forca: 0.36, suave: 0.8 } }))
  for (let i = 0; i < 3; i += 1) {
    const a = 0.9 + i * 2.2 + hash(i, 1, 14229) * 0.4
    L.push(P(dentroDe(elipseGirada(Math.cos(a) * (rv - 0.75), Math.sin(a) * (rv - 0.75), 1.3, 0.75, a + Math.PI / 2), aro), ferro, { bisel: 0, contorno: 0.1, tom: 0.9, metal: 0.3, alfa: 0.85, semente: 14230 + i }))
  }
  const rc = VOLANTE.cubo
  L.push(P(elipse(0, 0, rc, rc), ferro, { tabua: 0, bisel: rc, tom: 1, contorno: 0.34, metal: 0.4, textura: texDoDomo(0, 0, rc, rc, FORCA_NO_METAL, 50, 'metal'), semente: 14233, projeta: { dist: 1, forca: 0.35 } }))
  // A ponta da haste rosqueada: o furo escuro com o fio claro em volta.
  L.push(P(elipse(0, 0, 0.9, 0.9), ferro, { bisel: 0.5, tom: 1.3, contorno: 0.36, metal: 0.6, semente: 14234 }))
}

/** FECHADA (a 1ª): a folha baixada, a água represada a montante. */
export const montarComporta: MontarMovel = (c, cena) => {
  const M = medidas(c)
  cena.corDoPiso = ESCURO_DO_ESGOTO
  aguaRepresada(c, cena, M)
  montarEstrutura(c, cena, M, ALTURA_DA_FOLHA_BAIXADA, HASTE_FECHADA, false)
}

/** ABERTA: a folha suspensa, a haste alta e a espuma da água que passa por baixo. */
export const montarComportaAberta: MontarMovel = (c, cena) => {
  const M = medidas(c)
  cena.corDoPiso = ESCURO_DO_ESGOTO
  aguaCorrendo(c, cena, M)
  montarEstrutura(c, cena, M, ALTURA_DA_FOLHA_ERGUIDA, HASTE_ABERTA, true)
}
