/**
 * ESTÁTUA DE CAVALO (21/11/2026; o mestre: "Tem como criar uma esatua de
 * cavalo ?", com o print de um jogo de terror, e depois "Só objeto do mapa"):
 * a CABEÇA de cavalo de pedra, de perfil e virada para a esquerda, com o
 * pescoço cortado numa base baixa, a crina esculpida atrás do pescoço, as
 * orelhas em pé e o focinho descendo. Desenho original: só a ideia do busto de
 * cavalo num salão de castelo, nada do jogo. Duas peças: em cima do PEDESTAL
 * quadrado (o soco, o dado com o painel rebaixado e a cornija) e sem ele, a
 * cabeça pousada no chão pela base.
 *
 * A pedra é a do painel (`c.m.pedra`); o TEMPO por cima é fixo: a cabeça puxada
 * para o cinza-esverdeado, com manchas mais escuras de verdete e pintas claras
 * de líquen, e o pedestal com o mesmo verde mais fraco e um pouco de musgo ao pé.
 *
 * Figura em pé, desenhada de frente nas duas vistas, como a armadura de pé
 * (`armadura.ts`): de cima e na 3/4 é a mesma imagem, e a 3/4 só põe a sombra
 * de baixo (`EM_PE` em `tresQuartos.ts`); o quarto de volta deita a figura,
 * como nos outros em pé. O desenho é feito numa casa de 56 px (y cresce para
 * baixo) e sobra um pouco para cima (as orelhas).
 */
import { misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, capsula, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** O lado da casa em que a estátua é desenhada (px do protótipo). */
const CASA = 56

// ---------- o pedestal (px da casa) ----------

/** A linha do chão: o pé da frente do soco. */
const PE_DO_SOCO = 27
/** O soco: a meia largura e o alto da frente; a faixa do tampo dele que aparece na frente do dado. */
const SOCO = { meia: 14, topo: 23.4, faixa: 21.9 }
/** O dado (o bloco do meio) e o painel rebaixado na frente dele. */
const DADO = { meia: 11, topo: 6.6, pe: 22.2 }
const PAINEL = { meia: 7.4, topo: 9.8, pe: 19.4 }
/** A cornija: a frente (do alto ao pé) e o tampo, que vai do fundo até o alto da frente. */
const CORNIJA = { meia: 13, topo: 3.2, pe: 6.9 }
const TAMPO = { fundo: -1.8, meiaDoFundo: 11.2 }
/** A altura do pedestal (px, para a sombra) e o meio da pegada dele no chão. */
const ALTURA_DO_PEDESTAL = PE_DO_SOCO - CORNIJA.topo
const CHAO_DO_PEDESTAL = 24.6
/** Onde a base da cabeça pousa: no meio do tampo do pedestal, ou no chão (e um pouco maior, sem o pedestal). */
const PE_DO_BUSTO_NO_PEDESTAL = 0.9
const PE_DO_BUSTO_NO_CHAO = 19
const ESCALA_DO_BUSTO_NO_CHAO = 1.14

// ---------- a cabeça (px do busto: a base no 0, 0; para cima é negativo; o focinho para a esquerda) ----------

/** A base baixa em que o pescoço é cortado: a frente e o tampo (do fundo à frente). */
const BASE = { meia: 8.4, meiaDoFundo: 7.4, frente: -2.3, fundo: -3.7 }
/** O pescoço, da garganta (frente) à crista (atrás), subindo até a nuca. */
const PESCOCO: readonly Ponto[] = [
  [-4.8, -3], [9.6, -3], [9.5, -7.5], [8.6, -12.5], [6.8, -17.5], [4.2, -21.8], [-1.2, -21], [-4.4, -14.5], [-5.1, -8.5],
]
/** O crânio (a nuca entre as orelhas), a bochecha redonda e o plano da cara até o focinho. */
const CRANIO = { x: 1.2, y: -22.6, rx: 4.8, ry: 4.4 }
const BOCHECHA = { x: -3, y: -13.8, rx: 5.2, ry: 4.8 }
const CARA: readonly Ponto[] = [[-0.2, -27], [-4.2, -25.8], [-16.2, -15.2], [-17.4, -12], [-13.8, -8.6], [-4.6, -10.2]]
const FOCINHO = { x: -15.9, y: -11.3, rx: 3.5, ry: 2.9, giro: -0.75 }
const QUEIXO = { x: -13.6, y: -8.4, rx: 2.4, ry: 1.7 }
/** O vinco do queixo: a beira de baixo da bochecha, onde ela encontra a garganta. */
const VINCO_DO_QUEIXO: readonly Ponto[] = [[-6.2, -9.6], [-2.2, -9], [1.2, -10.2], [2.2, -12.4]]
/** As orelhas, em amêndoa com a ponta fina: a de trás (mais escura, atrás do crânio), a da frente e o fundo dela. */
const ORELHA_DE_TRAS: readonly Ponto[] = [[2.6, -24.4], [2.9, -27.2], [4, -29.6], [5, -30.8], [5.8, -29.3], [6.7, -26.8], [6.9, -24]]
const ORELHA: readonly Ponto[] = [[-1, -25], [-0.9, -28], [0.2, -30.6], [1.1, -32], [2.1, -30.4], [3.2, -27.8], [3.6, -25.3]]
const FUNDO_DA_ORELHA: readonly Ponto[] = [[0.1, -25.8], [0.3, -28.3], [1.1, -30.4], [1.9, -28.3], [2.5, -25.9]]
/** O topete caído na testa entre as orelhas. */
const TOPETE = { x: -2.6, y: -24.2, rx: 2.9, ry: 1.3, giro: -0.4 }
/**
 * A crina: a faixa ao longo da crista, da nuca à base, um pouco para fora do pescoço (o raio dela), e os sulcos
 * de través, que são o que diz "crina esculpida".
 */
const CRISTA: readonly Ponto[] = [[3.8, -23.4], [6.6, -20.2], [8.9, -15.4], [10.2, -10.2], [10.6, -5.2], [10.4, -3]]
const RAIO_DA_CRINA = 2.1
/** Os sulcos de través: o meio de cada um na crista (fração do caminho) e quanto ele desce para a frente. */
const SULCOS_DA_CRINA = [0.12, 0.26, 0.4, 0.54, 0.68, 0.82]
/** O olho (amêndoa escura), a sobrancelha clara em cima, a narina e a boca. */
const OLHO = { x: -5.6, y: -20.2, rx: 1.35, ry: 0.75, giro: -0.6 }
const SOBRANCELHA: readonly [Ponto, Ponto] = [[-7.4, -21.6], [-4.2, -22.1]]
const NARINA = { x: -16.6, y: -12.6, rx: 1.1, ry: 0.55, giro: -0.9 }
const BOCA: readonly [Ponto, Ponto] = [[-17.6, -9.7], [-14.6, -9.3]]
/** O vinco do pescoço, da bochecha até a base (o músculo de baixo da crina). */
const VINCO: readonly [Ponto, Ponto] = [[1.2, -9.4], [3, -4.6]]
/** As alturas da cabeça acima da base (px do busto), para a sombra: o alto do pescoço, a cara e as orelhas. */
const ALTO_DO_PESCOCO = 20
const ALTO_DA_CARA = 17
const ALTO_DAS_ORELHAS = 29

// ---------- o tempo na pedra ----------

/** O cinza-esverdeado para onde a pedra é puxada (a cabeça mais, o pedestal menos) e o verdete das manchas. */
const VERDE_DO_TEMPO: Rgb = [0x6c, 0x7d, 0x68]
const VERDETE: Rgb = [0x4e, 0x5f, 0x50]
const QUANTO_DE_VERDE_NA_CABECA = 0.42
const QUANTO_DE_VERDE_NO_PEDESTAL = 0.16
/** As manchas: o tamanho (px do protótipo por volta do ruído) e a força na cabeça e no pedestal. */
const TAMANHO_DAS_MANCHAS = 6
const MANCHAS_NA_CABECA = 0.5
const MANCHAS_NO_PEDESTAL = 0.28
/** As pintas de líquen: só a partir desta escala (abaixo elas viram chiado) e o limiar do ruído. */
const ESCALA_DO_LIQUEN = 1
const LIMIAR_DO_LIQUEN = 0.34
/** O musgo ao pé do soco: o verde-oliva do Meio-Termo, um pouco puxado para a pedra. */
const TOM_DO_MUSGO: Rgb = rgb(tomDoMeio('musgo', 0.84))
const TUFOS_DE_MUSGO: readonly (readonly [number, number, number, number])[] = [
  [-12.6, 26.2, 2.6, 1.1],
  [-10.4, 26.6, 1.6, 0.8],
  [12.2, 26.4, 2, 0.9],
]
/** O escuro da pedra em que o pixel escuro demais é levantado (sem ele a beira na sombra saía marrom). */
const ESCURO_DA_PEDRA: Rgb = [0x40, 0x47, 0x41]
/** O vão escuro dos detalhes (olho, narina, boca, sulcos), meio transparente sobre a pedra. */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x39, 0x34] }

const DA_PEDRA = texturaDaClasse('pedra')

/** A pedra com o tempo: manchas grandes de verdete (onde a chuva escorre) e pintas claras de líquen. */
function texDoTempo(forca: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
    const n = ruido(x / TAMANHO_DAS_MANCHAS + 13, y / TAMANHO_DAS_MANCHAS) + 0.5 * ruido(x / 2.4 + 7, y / 2.4 + 29)
    const t = Math.min(1, Math.max(0, (n + 0.1) * 2.2)) * forca
    if (t > 0) {
      s[0] += (VERDETE[0] - s[0]) * t
      s[1] += (VERDETE[1] - s[1]) * t
      s[2] += (VERDETE[2] - s[2]) * t
    }
    if (escala < ESCALA_DO_LIQUEN) return
    const l = ruido(x / 1.3 + 51, y / 1.3 + 3)
    if (l > LIMIAR_DO_LIQUEN) s[3] += (l - LIMIAR_DO_LIQUEN) * 0.9
  }
}

const TEX_DA_CABECA = texDoTempo(MANCHAS_NA_CABECA)
const TEX_DO_PEDESTAL = texDoTempo(MANCHAS_NO_PEDESTAL)

type Por = (f: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => void

/** O ponto da crista a `f` (0 a 1) do caminho, da nuca à base, e a direção dela ali. */
function pontoDaCrista(f: number): readonly [Ponto, Ponto] {
  const trechos = CRISTA.slice(1).map((p, i) => Math.hypot(p[0] - CRISTA[i][0], p[1] - CRISTA[i][1]))
  let resta = f * trechos.reduce((s, t) => s + t, 0)
  for (let i = 0; i < trechos.length; i += 1) {
    const [a, b] = [CRISTA[i], CRISTA[i + 1]]
    const [tx, ty] = [(b[0] - a[0]) / trechos[i], (b[1] - a[1]) / trechos[i]]
    if (resta <= trechos[i] || i === trechos.length - 1) return [[a[0] + tx * resta, a[1] + ty * resta], [tx, ty]]
    resta -= trechos[i]
  }
  return [CRISTA[0], [0, 1]]
}

/** A forma do busto (base no 0, 0) levada para o desenho: a base em (ox, oy), `k` vezes maior. */
function noBusto(f: Forma, ox: number, oy: number, k: number): Forma {
  return { b: [ox + f.b[0] * k, oy + f.b[1] * k, ox + f.b[2] * k, oy + f.b[3] * k], d: (x, y) => f.d((x - ox) / k, (y - oy) / k) * k }
}

/** O pedestal: o soco, o dado com o painel rebaixado, a sombra da cornija no dado, a cornija e o tampo. */
function montarPedestal(por: Por, pedra: MaterialDaPeca): void {
  const o = (semente: number, tom: number, bisel = 0.8): OpcoesDaPeca => ({ bisel, tom, contorno: 0.28, textura: TEX_DO_PEDESTAL, semente })
  por(caixa(-SOCO.meia, SOCO.topo, SOCO.meia, PE_DO_SOCO, 0.6), pedra, o(9101, 0.7))
  por(poligono([[-SOCO.meia + 1.4, SOCO.faixa], [SOCO.meia - 1.4, SOCO.faixa], [SOCO.meia, SOCO.topo], [-SOCO.meia, SOCO.topo]]), pedra, o(9102, 0.98, 0.5))
  por(caixa(-DADO.meia, DADO.topo, DADO.meia, DADO.pe), pedra, o(9103, 0.8, 1))
  // O painel rebaixado: mais escuro, com a beira de cima na sombra e a de baixo pegando luz.
  por(caixa(-PAINEL.meia, PAINEL.topo, PAINEL.meia, PAINEL.pe, 0.4), pedra, o(9104, 0.7, 0.6))
  por(capsula(-PAINEL.meia + 0.6, PAINEL.topo + 0.5, PAINEL.meia - 0.6, PAINEL.topo + 0.5, 0.45), VAO, { bisel: 0, contorno: 0, alfa: 0.35, semente: 9105 })
  por(capsula(-PAINEL.meia + 0.6, PAINEL.pe - 0.2, PAINEL.meia - 0.6, PAINEL.pe - 0.2, 0.35), pedra, { bisel: 0, contorno: 0, tom: 1.02, semente: 9106 })
  por(caixa(-DADO.meia, CORNIJA.pe, DADO.meia, CORNIJA.pe + 1.6), VAO, { bisel: 0, contorno: 0, alfa: 0.3, semente: 9107 })
  por(caixa(-CORNIJA.meia, CORNIJA.topo, CORNIJA.meia, CORNIJA.pe, 0.5), pedra, o(9108, 0.88))
  const sulco = (CORNIJA.topo + CORNIJA.pe) / 2 + 0.5
  por(capsula(-CORNIJA.meia + 0.8, sulco, CORNIJA.meia - 0.8, sulco, 0.3), VAO, { bisel: 0, contorno: 0, alfa: 0.35, semente: 9109 })
  por(poligono([[-TAMPO.meiaDoFundo, TAMPO.fundo], [TAMPO.meiaDoFundo, TAMPO.fundo], [CORNIJA.meia, CORNIJA.topo], [-CORNIJA.meia, CORNIJA.topo]]), pedra, o(9110, 1.04, 0.9))
  const musgo: MaterialDaPeca = { classe: 'liso', rgb: misturar(TOM_DO_MUSGO, pedra.rgb, 0.16) }
  TUFOS_DE_MUSGO.forEach(([x, y, rx, ry], i) => por(elipse(x, y, rx, ry), musgo, { bisel: 0.5, contorno: 0.2, tom: 0.9, semente: 9111 + i }))
}

/** A cabeça: a base, a orelha de trás, o pescoço com a crina, a cara, a bochecha e os detalhes. */
function montarCabeca(por: Por, pedra: MaterialDaPeca, ox: number, oy: number, k: number): void {
  const b = (f: Forma): Forma => noBusto(f, ox, oy, k)
  const o = (semente: number, tom: number, bisel: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: bisel * k, tom, contorno: 0.3, textura: TEX_DA_CABECA, semente, ...mais })
  const sombraMiuda = { dist: 0.7 * k, forca: 0.26 }
  const vao = (f: Forma, alfa: number, semente: number): void => por(b(f), VAO, { bisel: 0, contorno: 0, alfa, semente })
  // A base em que o pescoço é cortado: a frente e o tampo.
  por(b(caixa(-BASE.meia, BASE.frente, BASE.meia, 0, 0.4)), pedra, o(9201, 0.74, 0.6))
  por(b(poligono([[-BASE.meiaDoFundo, BASE.fundo], [BASE.meiaDoFundo, BASE.fundo], [BASE.meia, BASE.frente], [-BASE.meia, BASE.frente]])), pedra, o(9202, 1.02, 0.5))
  por(b(poligono(ORELHA_DE_TRAS)), pedra, o(9203, 0.7, 0.8))
  // A crina atrás do pescoço: a faixa e os sulcos de través.
  por(b(cadeia(CRISTA, RAIO_DA_CRINA)), pedra, o(9210, 0.84, 1.2))
  por(b(poligono(PESCOCO)), pedra, o(9204, 0.95, 3))
  SULCOS_DA_CRINA.forEach((f, i) => {
    const [[px, py], [tx, ty]] = pontoDaCrista(f)
    const [nx, ny] = [ty, -tx]
    vao(capsula(px - nx * 1.2, py - ny * 1.2, px + nx * 2 + tx * 1.4, py + ny * 2 + ty * 1.4, 0.3), 0.45, 9220 + i)
  })
  // A cabeça numa peça só (o crânio, a bochecha, o plano da cara, o focinho e o queixo): sem contorno por dentro.
  const cabeca = [
    elipse(BOCHECHA.x, BOCHECHA.y, BOCHECHA.rx, BOCHECHA.ry),
    poligono(CARA),
    elipseGirada(FOCINHO.x, FOCINHO.y, FOCINHO.rx, FOCINHO.ry, FOCINHO.giro),
    elipse(QUEIXO.x, QUEIXO.y, QUEIXO.rx, QUEIXO.ry),
  ].reduce(uniao, elipse(CRANIO.x, CRANIO.y, CRANIO.rx, CRANIO.ry))
  por(b(cabeca), pedra, o(9230, 1, 2))
  // O vinco de baixo da bochecha, onde o queixo encontra a garganta.
  vao(cadeia(VINCO_DO_QUEIXO, 0.35), 0.32, 9235)
  vao(capsula(VINCO[0][0], VINCO[0][1], VINCO[1][0], VINCO[1][1], 0.4), 0.28, 9236)
  por(b(poligono(ORELHA)), pedra, o(9237, 0.98, 0.9, { projeta: sombraMiuda }))
  vao(poligono(FUNDO_DA_ORELHA), 0.4, 9238)
  por(b(elipseGirada(TOPETE.x, TOPETE.y, TOPETE.rx, TOPETE.ry, TOPETE.giro)), pedra, o(9239, 0.86, 0.8, { projeta: sombraMiuda }))
  por(b(capsula(SOBRANCELHA[0][0], SOBRANCELHA[0][1], SOBRANCELHA[1][0], SOBRANCELHA[1][1], 0.55)), pedra, { bisel: 0, contorno: 0, tom: 1.16, textura: TEX_DA_CABECA, semente: 9243 })
  vao(elipseGirada(OLHO.x, OLHO.y, OLHO.rx, OLHO.ry, OLHO.giro), 0.8, 9240)
  vao(elipseGirada(NARINA.x, NARINA.y, NARINA.rx, NARINA.ry, NARINA.giro), 0.75, 9241)
  vao(capsula(BOCA[0][0], BOCA[0][1], BOCA[1][0], BOCA[1][1], 0.35), 0.55, 9242)
}

/** A sombra da cabeça no chão (y do chão `chao`, alturas `z0` px acima dele até a base da cabeça). */
function sombrasDaCabeca(cena: Cena, na: (f: Forma) => Forma, chao: number, z0: number, k: number): void {
  cena.sombras.push({ forma: na(elipse(2.4 * k, chao, 6.6 * k, 2.4 * k)), z: z0 + ALTO_DO_PESCOCO * k, forca: 0.26 })
  cena.sombras.push({ forma: na(elipse(-7 * k, chao, 7 * k, 2.4 * k)), z: z0 + ALTO_DA_CARA * k, solta: true, forca: 0.24 })
  cena.sombras.push({ forma: na(elipse(1.8 * k, chao, 2.8 * k, 1.3 * k)), z: z0 + ALTO_DAS_ORELHAS * k, solta: true, forca: 0.2 })
}

/** O que as duas peças repetem: a escala da pegada, o `por` que já põe a forma no tamanho dela e os materiais. */
function preparar(c: ContextoDoMovel, cena: Cena): { por: Por; na: (f: Forma) => Forma; cabeca: MaterialDaPeca; pedestal: MaterialDaPeca } {
  const e = Math.min(c.w, c.h) / CASA
  const na = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const por: Por = (f, mat, o) => {
    cena.partes.push(c.peca(na(f), mat, o))
  }
  cena.corDoPiso = ESCURO_DA_PEDRA
  const pedra = c.m.pedra
  return {
    por,
    na,
    cabeca: { ...pedra, rgb: misturar(pedra.rgb, VERDE_DO_TEMPO, QUANTO_DE_VERDE_NA_CABECA) },
    pedestal: { ...pedra, rgb: misturar(pedra.rgb, VERDE_DO_TEMPO, QUANTO_DE_VERDE_NO_PEDESTAL) },
  }
}

export const montarEstatuaDeCavalo: MontarMovel = (c, cena) => {
  const { por, na, cabeca, pedestal } = preparar(c, cena)
  const soco = uniao(caixa(-SOCO.meia, SOCO.topo, SOCO.meia, PE_DO_SOCO, 0.6), caixa(-SOCO.meia, SOCO.faixa, SOCO.meia, SOCO.topo))
  cena.sombras.push(contato(na(soco), 0.32))
  cena.sombras.push({ forma: na(caixa(-SOCO.meia, CHAO_DO_PEDESTAL - 3, SOCO.meia, PE_DO_SOCO, 1)), z: ALTURA_DO_PEDESTAL, forca: 0.26 })
  sombrasDaCabeca(cena, na, CHAO_DO_PEDESTAL, ALTURA_DO_PEDESTAL, 1)
  montarPedestal(por, pedestal)
  montarCabeca(por, cabeca, 0, PE_DO_BUSTO_NO_PEDESTAL, 1)
}

export const montarEstatuaDeCavaloSemPedestal: MontarMovel = (c, cena) => {
  const { por, na, cabeca } = preparar(c, cena)
  const k = ESCALA_DO_BUSTO_NO_CHAO
  const base = noBusto(uniao(caixa(-BASE.meia, BASE.frente, BASE.meia, 0, 0.4), caixa(-BASE.meia, BASE.fundo, BASE.meia, BASE.frente)), 0, PE_DO_BUSTO_NO_CHAO, k)
  cena.sombras.push(contato(na(base), 0.34))
  sombrasDaCabeca(cena, na, PE_DO_BUSTO_NO_CHAO - 1.6 * k, 0, k)
  montarCabeca(por, cabeca, 0, PE_DO_BUSTO_NO_CHAO, k)
}
