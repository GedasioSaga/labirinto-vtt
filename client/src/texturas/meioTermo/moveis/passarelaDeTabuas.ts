/**
 * PASSARELA DE TÁBUAS de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; a construção de chão, versão
 * pobre do deck de madeira, `deckDeMadeira.ts`). Tábuas SOLTAS jogadas em cima da lama para ligar uma porta à outra: duas
 * FIADAS ao comprido, cada uma de tábuas de comprimentos e larguras desencontrados, tortas de verdade e fora de linha,
 * umas com fresta na emenda (uma emenda bem aberta), outras deitadas por cima da vizinha, e uma tábua solta ATRAVESSADA
 * em diagonal por cima das duas fiadas. Por baixo, os DORMENTES largos de madeira molhada, escuros, quase escondidos. A
 * madeira é pardo-acinzentada e velha, com o veio à vista, as pontas e a beira de baixo escuras de umidade, os pregos
 * onde a tábua cruza o dormente, respingos curtos de lama nas pontas e nas beiras e uma tábua rachada aqui e ali; numa
 * passarela larga (três fiadas ou mais), a do meio perde uma tábua.
 *
 * A 25% de zoom sobram as tábuas claras e tortas com os vãos escuros entre elas e a diagonal por cima: caminho de tábua
 * largado no barro (o deck é o tablado fechado com moldura e pilares).
 *
 * Objeto de chão: o token anda em cima e não barra. Na 3/4 (DERIVADO) fica rente, como o deck sem os pilares: nenhuma
 * sombra com altura, só o contato. Esticada ao comprido, a passarela ganha mais tábuas e mais dormentes (nada estica);
 * mais larga, mais fiadas (uma a cada `LARGURA_DA_FIADA` casa, de 1 a 6). Material: `madeira` (sempre gasta para o
 * pardo de tábua velha do cortiço; o carvalho de partida dá o pardo-acinzentado quente, ~#8d785f).
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, dentroDe, elipse, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, PREGO, QUARTO, type MontarMovel } from './contexto'
import { girar } from './grilhoesDeParede'
import { ESCURO_DO_CORTICO, madeiraGasta } from './catreDesarrumado'

/** Uma fiada a cada tanto de casa, e a largura cheia da tábua em parte do passo da fiada (o resto é o vão). */
const LARGURA_DA_FIADA = 0.5
const TABUA_NA_FIADA = 0.78
/** Cada tábua tem de 60% a 100% da largura cheia, gira até este tanto (radianos) e sai da linha até este tanto (px). */
const LARGURA_DA_TABUA: readonly [number, number] = [0.6, 1]
const GIRO_DA_TABUA = 0.08
const DESVIO_DA_TABUA = 2
/** Um dormente a cada tanto de casa, e a meia largura dele (px da pegada de partida). */
const PASSO_DO_DORMENTE = 1.05
const MEIA_LARGURA_DO_DORMENTE = 3.2
/** O dormente para antes da beira (px): quase todo debaixo das tábuas, só a ponta aparece. */
const PONTA_DO_DORMENTE = 6.5
/** O comprimento de uma tábua (casas): do mais curto ao mais comprido. */
const TABUA_CURTA = 0.7
const TABUA_COMPRIDA = 1.5
/** A sobra mínima no fim da fiada (casas): menos que isto, a tábua de antes vai até o fim. */
const SOBRA_MINIMA = 0.35
/** A emenda bem aberta (px), na primeira junta da última fiada. */
const VAO_GRANDE = 4.8
/** A tábua solta atravessada: onde fica (fração do comprimento), o comprimento (casas), a largura e o giro. */
const LUGAR_DA_DEITADA = 0.62
const COMPRIMENTO_DA_DEITADA = 0.85
const LARGURA_DA_DEITADA = 0.62
const GIRO_DA_DEITADA = -0.3
/** Quanto a madeira escolhida vai para o pardo gasto do cortiço, e o escuro da umidade nas pontas e nos dormentes. */
const GASTO_DA_MADEIRA = 0.6
const MOLHADO: Rgb = [0x2e, 0x26, 0x1e]
const UMIDADE_DAS_PONTAS = 0.45
const UMIDADE_DO_DORMENTE = 0.55
/** O comprimento da mancha úmida em cada ponta da tábua (px). */
const PONTA_MOLHADA = 4.5
/** A lama dos respingos e a racha. */
const LAMA: MaterialDaPeca = { classe: 'liso', rgb: [0x4b, 0x3d, 0x2e] }
const RACHA: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x2a, 0x22] }

export const montarPassarelaDeTabuas: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = madeiraGasta(c.m.madeira, GASTO_DA_MADEIRA)
  const molhada: MaterialDaPeca = { ...mad, rgb: misturar(mad.rgb, MOLHADO, UMIDADE_DAS_PONTAS) }
  const madeiraDoDormente: MaterialDaPeca = { ...mad, rgb: misturar(mad.rgb, MOLHADO, UMIDADE_DO_DORMENTE) }
  const L = cena.partes
  const k = Math.min(h / G, w / (3 * G))
  cena.corDoPiso = ESCURO_DO_CORTICO
  const fiadas = Math.max(1, Math.min(6, Math.round(h / (LARGURA_DA_FIADA * g))))
  const passo = h / fiadas
  const largura = passo * TABUA_NA_FIADA

  // Um RESPINGO curto de lama: a gota e uma respingada menor ao lado.
  const respingo = (x: number, y: number, tamanho: number, sem: number): void => {
    const r = (0.9 + 0.8 * hash(sem, 1, 8960)) * k * tamanho
    const a = hash(sem, 2, 8960) * Math.PI * 2
    L.push(P(girar(elipse(x, y, r * 1.4, r * 0.8), x, y, a), LAMA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.62, suave: 0.5 * k, semente: sem }))
    L.push(P(elipse(x + Math.cos(a) * r * 2, y + Math.sin(a) * r * 1.4, r * 0.45, r * 0.4), LAMA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.55, suave: 0.3 * k, semente: sem + 1 }))
  }

  // Os DORMENTES de través, por baixo de tudo: largos, de madeira molhada e escura, quase escondidos, com respingos
  // nas pontas.
  const nD = Math.max(2, Math.round(w / (PASSO_DO_DORMENTE * g)) + 1)
  const dormentes = Array.from({ length: nD }, (_, j) => -hw + 6 * k + ((w - 12 * k) * j) / (nD - 1) + (hash(j, 1, 8900) - 0.5) * 4 * k)
  dormentes.forEach((x, j) => {
    const m = MEIA_LARGURA_DO_DORMENTE * k
    const ponta = hh - PONTA_DO_DORMENTE * k
    const dormente = girar(caixa(x - m, -ponta, x + m, ponta, 1.2 * k), x, 0, (hash(j, 2, 8900) - 0.5) * 0.1)
    cena.sombras.push(contato(dormente, 0.3))
    L.push(P(dormente, madeiraDoDormente, { eixo: QUARTO, tabua: 0, bisel: 1.2 * k, tom: 0.86, contorno: 0.14, semente: 8901 + j }))
    for (const lado of [-1, 1]) respingo(x + (hash(j, lado, 8902) - 0.5) * 3 * k, lado * (ponta - 0.8 * k), 1, 8903 + j * 4 + lado + 1)
  })

  // Uma TÁBUA solta: o corpo torto, o veio, as pontas e a beira de baixo molhadas, os respingos nas pontas e na beira,
  // a racha às vezes e os pregos onde ela cruza um dormente.
  const tabua = (x: number, xb: number, yc: number, lw: number, ang: number, sem: number, projeta: number): void => {
    const [y0, y1] = [yc - lw / 2, yc + lw / 2]
    const mx = (x + xb) / 2
    const co = Math.cos(ang)
    const si = Math.sin(ang)
    const naTabua = (px: number, py: number): Ponto => [mx + (px - mx) * co - (py - yc) * si, yc + (px - mx) * si + (py - yc) * co]
    const torta = (forma: Forma): Forma => girar(forma, mx, yc, ang)
    const corpo = torta(caixa(x, y0, xb, y1, 0.7 * k))
    cena.sombras.push(contato(corpo, 0.3))
    L.push(P(corpo, mad, { eixo: ang, tabua: 0, bisel: 1 * k, tom: 0.88 + 0.2 * hash(sem, 1, 8915), contorno: 0.26, semente: sem, projeta: { dist: projeta * k, forca: 0.32, suave: 0.6 * k } }))
    // O VEIO à vista: dois fios escuros e ondulados ao comprido.
    for (const [v, fase] of [[-0.22, 0], [0.26, 2.1]] as const) {
      const fio = Array.from({ length: 7 }, (_, j): Ponto => {
        const t = j / 6
        return naTabua(x + 3 * k + (xb - x - 6 * k) * t, yc + v * lw + Math.sin(t * 5 + fase + hash(sem, 2, 8940) * 6) * 0.7 * k)
      })
      L.push(P(cadeia(fio, 0.22 * k), mad, { tabua: 0, bisel: 0, contorno: 0, tom: 0.64, alfa: 0.36, semente: sem + 1 }))
    }
    // As pontas e a beira de baixo escuras de umidade, mansas para dentro.
    for (const [a, b] of [[x - 1, x + PONTA_MOLHADA * k], [xb - PONTA_MOLHADA * k, xb + 1]] as const) {
      L.push(P(dentroDe(torta(caixa(a, y0 - 1, b, y1 + 1)), corpo), molhada, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.6, suave: 1.4 * k, semente: sem + 2 }))
    }
    L.push(P(torta(caixa(x + 0.6, y1 - 1.8 * k, xb - 0.6, y1 - 0.2, 0.4 * k)), molhada, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.48, suave: 0.9 * k, semente: sem + 3 }))
    // Respingos: um logo além de uma das pontas e um na beira de baixo, perto da outra ponta.
    const ponta = hash(sem, 4, 8916) > 0.5
    respingo(...naTabua(ponta ? x - 1 * k : xb + 1 * k, yc + (hash(sem, 5, 8917) - 0.5) * lw * 0.6), 1, sem * 3)
    respingo(...naTabua(ponta ? xb - 7 * k : x + 7 * k, y1 + 0.6 * k), 0.75, sem * 3 + 7)
    // A racha numa tábua aqui e ali.
    if (hash(sem, 6, 8919) > 0.82) {
      const [ra, rb] = [naTabua(x + (xb - x) * 0.22, yc - lw * 0.12), naTabua(x + (xb - x) * 0.58, yc - lw * 0.05)]
      L.push(P(capsula(ra[0], ra[1], rb[0], rb[1], 0.3 * k), RACHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, semente: sem + 4 }))
    }
    for (const xd of dormentes) {
      if (xd < x + 2 * k || xd > xb - 2 * k) continue
      for (const v of [-0.28, 0.28]) {
        const [px, py] = naTabua(xd, yc + v * lw)
        L.push(P(elipse(px, py, 0.6, 0.6), PREGO, { bisel: 0.5, contorno: 0, metal: 0.25, semente: sem + 5 }))
      }
    }
  }

  // As FIADAS, cada uma andando da beira da esquerda até a da direita. Primeiro o corte de cada fiada (de onde a onde
  // vai cada tábua); numa passarela de três fiadas ou mais, a do meio perde uma tábua do meio.
  for (let f = 0; f < fiadas; f += 1) {
    const yc = -hh + passo * (f + 0.5)
    const cortes: Array<readonly [number, number]> = []
    let x = -hw + 0.6 + hash(f, 0, 8910) * 2 * k
    for (let i = 0; x < hw - 4 * k; i += 1) {
      let xb = Math.min(hw - 0.6, x + (TABUA_CURTA + (TABUA_COMPRIDA - TABUA_CURTA) * hash(f, i, 8911)) * g)
      if (hw - 0.6 - xb < SOBRA_MINIMA * g) xb = hw - 0.6
      cortes.push([x, xb])
      // A emenda: ou a próxima deita por cima desta (sobra um palmo), ou fica uma fresta; uma é bem aberta. A que chegou
      // ao fim fecha a fiada (sem isto, numa passarela estreita a sobreposição voltava para trás do fim para sempre).
      if (xb >= hw - 0.6) break
      const junta = hash(f, i, 8930)
      const aberta = f === fiadas - 1 && i === 0
      x = aberta ? xb + VAO_GRANDE * k : junta > 0.72 ? xb - 2.4 * k : xb + (0.8 + 2 * junta) * k
    }
    const falta = fiadas >= 3 && f === Math.floor(fiadas / 2) && cortes.length >= 3 ? 1 + Math.floor(hash(f, 9, 8910) * (cortes.length - 2)) : -1
    cortes.forEach(([xa, xb], i) => {
      if (i === falta) return
      const ang = (hash(f, i, 8912) - 0.5) * 2 * GIRO_DA_TABUA
      const lw = largura * (LARGURA_DA_TABUA[0] + (LARGURA_DA_TABUA[1] - LARGURA_DA_TABUA[0]) * hash(f, i, 8914))
      // Fora de linha até `DESVIO_DA_TABUA` px, mas sem sair da pegada (a tábua torta ocupa mais alto que larga).
      const alcance = (lw / 2) * Math.cos(ang) + ((xb - xa) / 2) * Math.abs(Math.sin(ang))
      const desvio = (hash(f, i, 8913) - 0.5) * 2 * DESVIO_DA_TABUA * k
      const dy = Math.max(-hh + 0.5 + alcance - yc, Math.min(hh - 0.5 - alcance - yc, desvio))
      tabua(xa, xb, yc + dy, lw, ang, 8920 + f * 40 + i, 0.8)
    })
  }

  // A TÁBUA DEITADA atravessada por cima das duas fiadas, mais alta que as outras (a sombra dela cai mais longe).
  const comprimento = COMPRIMENTO_DA_DEITADA * g
  const xd = -hw + w * LUGAR_DA_DEITADA
  tabua(xd - comprimento / 2, xd + comprimento / 2, 0, largura * LARGURA_DA_DEITADA, GIRO_DA_DEITADA, 8990, 1.6)
}
