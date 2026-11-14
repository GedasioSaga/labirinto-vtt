/**
 * CARTAZ DE PROCURADO (lote L07 dos objetos de 14/11/2026, grupo Mar e piratas; pedido do mestre: "cartaz de
 * procurado: silhueta, valor da recompensa, VIVO OU MORTO"). EM PÉ, de frente, como a lápide e o quadro de
 * avisos: visto do alto o cartaz seria um risco. Um POSTE de madeira fincado no chão, com a TRAVESSA no alto e o
 * cartaz pregado nela pelos dois cantos de cima, solto embaixo.
 *
 * O cartaz é papel velho, mais escuro nas beiras, com as manchas e os vincos de ter ficado dobrado; o canto de
 * baixo à direita rasgou, o de baixo à esquerda dobrou para a frente (o avesso, mais claro, com a sombra no
 * papel). Impresso em tinta parda: PROCURADO em letra grande no alto, o fio de baixo do título, o RETRATO num
 * quadro (a silhueta escura de um pirata de chapéu de três bicos, sem rosto), VIVO OU MORTO em letra pequena e,
 * embaixo, a RECOMPENSA: a moeda e o valor. As letras são de uma fonte de quadradinhos desenhada aqui (3 x 5,
 * o M com 5 de largura): perto se lê tudo; a 1x sobram a faixa escura do título, o quadro com a silhueta e as
 * linhas de baixo, que é como se reconhece um cartaz de procurado de longe.
 *
 * Diferente do quadro de avisos (`quadroDeAvisos.ts`: dois pés, moldura, fundo de tábuas e três papéis
 * pequenos): aqui é um poste só e um cartaz grande. O desenho é feito na pegada de partida (0,6 x 0,8 casa) e
 * escala inteiro com o menor lado; passa da pegada para cima 0,16 casa (a ponta do poste). Material: `madeira`
 * (o poste e a travessa); o papel, a tinta, o capim e os pregos são fixos.
 */
import { capsula, caixa, dentroDe, elipse, menos, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, PREGO, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** A pegada de partida, px do protótipo: o desenho tem o tamanho de desenho nela. */
const LARGURA_DE_PARTIDA = 0.6 * G
const FUNDO_DE_PARTIDA = 0.8 * G
/** As alturas, em casas, para as sombras no chão: o alto do poste e o meio do cartaz. */
const ALTURA_DO_POSTE = 0.95
const ALTURA_DO_CARTAZ = 0.6

// O desenho, em px de partida (0 no meio da pegada, y para baixo; o chão em `CHAO`).
const CHAO = 21.4
const POSTE = 2
const ALTO_DO_POSTE = -29.4
const PONTA_DO_POSTE = -31.4
const TRAVESSA: Caixa = [-16.6, -28.2, 16.6, -23.6]
/** O papel: as beiras e o rasgo do canto de baixo à direita. */
const PAPEL_X0 = -15
const PAPEL_X1 = 15
const PAPEL_Y0 = -26
const PAPEL_Y1 = 13
const RASGO: readonly Ponto[] = [[PAPEL_X1, 8.2], [13.6, 9.4], [14.2, 10.2], [12.6, 11.2], [12.9, 12.2], [11.2, PAPEL_Y1]]
/** A dobra do canto de baixo à esquerda: onde a dobra corta a beira de baixo e a da esquerda. */
const DOBRA_ESQUERDA: Ponto = [PAPEL_X0, 10.4]
const DOBRA_BAIXO: Ponto = [-12.4, PAPEL_Y1]
/** Os pregos dos dois cantos de cima, na travessa. */
const PREGOS: readonly Ponto[] = [[-13.2, -24.8], [13.2, -24.8]]

/** As linhas de texto: o meio em x, o alto, o lado da célula (px) e a folga entre letras (em células). */
const TITULO = { texto: 'PROCURADO', x: 0, topo: -22.4, celula: 0.8, folga: 0.5 }
const VIVO_OU_MORTO = { texto: 'VIVO OU MORTO', x: 0, topo: 3.4, celula: 0.52, folga: 0.5 }
const VALOR = { texto: '500.000', x: 2.2, topo: 7.6, celula: 0.78, folga: 0.5 }
/** O fio debaixo do título e o quadro do retrato (beira de fora, grossura do quadro). */
const FIO_DO_TITULO = -17.6
const QUADRO: Caixa = [-11, -16.4, 11, 1.8]
const GROSSURA_DO_QUADRO = 0.75
/** A moeda da recompensa, antes do valor. */
const MOEDA: Ponto = [-8.8, 9.55]
const RAIO_DA_MOEDA = 1.85

/** O papel envelhecido, o avesso da dobra, a tinta, o fundo do retrato e a silhueta. */
const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xcd, 0xa8] }
const AVESSO: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xdb, 0xbf] }
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x3c, 0x30] }
const FUNDO_DO_RETRATO: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xb4, 0x96] }
const SILHUETA: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x45, 0x37] }
const MOEDA_DE_LATAO: MaterialDaPeca = materialDaPeca('latao')
/** O capim do pé (o da lápide). */
const CAPIM: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x76, 0x4c] }

// ---------- a fonte de quadradinhos ----------

/** Cada letra: as linhas de cima para baixo, 1 = célula pintada. */
const LETRAS: Readonly<Record<string, readonly string[]>> = {
  P: ['111', '101', '111', '100', '100'],
  R: ['110', '101', '110', '101', '101'],
  O: ['111', '101', '101', '101', '111'],
  C: ['111', '100', '100', '100', '111'],
  U: ['101', '101', '101', '101', '111'],
  A: ['010', '101', '111', '101', '101'],
  D: ['110', '101', '101', '101', '110'],
  V: ['101', '101', '101', '101', '010'],
  I: ['111', '010', '010', '010', '111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  T: ['111', '010', '010', '010', '010'],
  '0': ['111', '101', '101', '101', '111'],
  '5': ['111', '100', '111', '001', '111'],
  '.': ['0', '0', '0', '0', '1'],
  ' ': ['0', '0', '0', '0', '0'],
}

/** Muitas caixas numa forma só: a distância é a da caixa mais perto (uma conta por caixa, sem `uniao` aninhada). */
function caixas(lista: readonly Caixa[]): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const b of lista) {
    x0 = Math.min(x0, b[0])
    y0 = Math.min(y0, b[1])
    x1 = Math.max(x1, b[2])
    y1 = Math.max(y1, b[3])
  }
  const formas = lista.map((b) => caixa(b[0], b[1], b[2], b[3]))
  return {
    b: [x0, y0, x1, y1],
    d(x, y) {
      let menor = Infinity
      for (const f of formas) {
        const d = f.d(x, y)
        if (d < menor) menor = d
      }
      return menor
    },
  }
}

/** A linha de texto centrada em `x`, já em px da pegada (`k` = escala): cada corrida de células vira uma caixa. */
function linhaDeTexto(t: { texto: string; x: number; topo: number; celula: number; folga: number }, k: number): Forma {
  const letras = [...t.texto].map((ch) => LETRAS[ch] ?? LETRAS[' '])
  const largura = letras.reduce((soma, l) => soma + l[0].length, 0) + t.folga * (letras.length - 1)
  const cel = t.celula * k
  let x = t.x * k - (largura * cel) / 2
  const lista: Caixa[] = []
  for (const linhas of letras) {
    linhas.forEach((linha, j) => {
      let i = 0
      while (i < linha.length) {
        if (linha[i] !== '1') {
          i += 1
          continue
        }
        const inicio = i
        while (i < linha.length && linha[i] === '1') i += 1
        lista.push([x + inicio * cel, t.topo * k + j * cel, x + i * cel, t.topo * k + (j + 1) * cel])
      }
    })
    x += (linhas[0].length + t.folga) * cel
  }
  return caixas(lista)
}

// ---------- texturas ----------

/** O papel: as manchas largas, o grão, a beira escurecida e os dois vincos (de pé e de través) da dobra. */
function texDoPapel(papel: Forma, k: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const t = -papel.d(x, y) / k
    s[3] += ruido(x * 0.14 + p.su, y * 0.14 + p.sv) * 0.09 + ruido(x * 1.2, y * 1.2) * 0.03
    if (t < 2.6) s[3] -= 0.13 * (1 - Math.max(0, t) / 2.6)
    const vinco = Math.min(Math.abs(x / k), Math.abs(y / k + 6.5))
    if (vinco < 0.5) s[3] -= 0.07 * (1 - vinco / 0.5)
    else if (vinco < 1.1) s[3] += 0.03
  }
}

/** A tinta: impressa em papel velho, falha um pouco. */
const texDaTinta: Textura = (_u, _v, x, y, p, s) => {
  const falha = ruido(x * 0.8 + p.su, y * 0.8 + p.sv)
  s[3] += falha > 0.38 ? 0.12 : 0
}

/** Um tufo de capim de `largura` x `alto` px com o pé em (x, y). */
function tufo(x: number, y: number, largura: number, alto: number, inclina: number): Forma {
  const m = largura / 2
  return poligono([
    [x - m, y + 0.8],
    [x - m * 0.85 + inclina, y - alto * 0.7],
    [x - m * 0.35, y - alto * 0.2],
    [x + inclina * 0.6, y - alto],
    [x + m * 0.3, y - alto * 0.25],
    [x + m * 0.9 + inclina, y - alto * 0.62],
    [x + m, y + 0.8],
  ])
}

export const montarCartazDeProcurado: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.w / LARGURA_DE_PARTIDA, c.h / FUNDO_DE_PARTIDA)
  const em = ([x, y]: Ponto): Ponto => [x * k, y * k]
  const cx = (b: Caixa, raio = 0): Forma => caixa(b[0] * k, b[1] * k, b[2] * k, b[3] * k, raio * k)
  const mad = c.m.madeira
  const L = cena.partes

  // As sombras: o poste alto, fino, e o cartaz, solto no ar; o contato do pé.
  cena.sombras.push(
    { forma: cx([-POSTE, CHAO - 1.2, POSTE, CHAO], 0.6), z: c.g * ALTURA_DO_POSTE * k, forca: 0.28 },
    { forma: cx([PAPEL_X0, CHAO - 1.6, PAPEL_X1, CHAO - 0.4], 0.6), z: c.g * ALTURA_DO_CARTAZ * k, solta: true, forca: 0.2 },
    contato(cx([-POSTE - 0.6, CHAO - 1, POSTE + 0.6, CHAO + 0.8], 1), 0.32),
  )

  // O poste com a ponta em pirâmide e a travessa do alto.
  L.push(P(cx([-POSTE, ALTO_DO_POSTE, POSTE, CHAO], 0.5), mad, { tabua: 0, eixo: QUARTO, bisel: 0.9 * k, contorno: 0.26, tom: 0.92, semente: 7301 }))
  L.push(P(poligono([em([-POSTE - 0.3, ALTO_DO_POSTE + 0.4]), em([0, PONTA_DO_POSTE]), em([POSTE + 0.3, ALTO_DO_POSTE + 0.4])]), mad, { tabua: 0, eixo: QUARTO, bisel: 0.7 * k, contorno: 0.26, tom: 1.08, semente: 7302 }))
  L.push(P(cx(TRAVESSA, 0.6), mad, { tabua: 0, bisel: 0.9 * k, contorno: 0.26, semente: 7303 }))

  // O papel: o rasgo à direita e a dobra à esquerda tiram os cantos de baixo.
  const contornoDoPapel: Ponto[] = [[PAPEL_X0, PAPEL_Y0], [PAPEL_X1, PAPEL_Y0], ...RASGO, DOBRA_BAIXO, DOBRA_ESQUERDA]
  const papel = poligono(contornoDoPapel.map(em))
  L.push(P(papel, PAPEL, { bisel: 0.5 * k, contorno: 0.16, tabua: 0, textura: texDoPapel(papel, k), projeta: { dist: 1.2 * k, forca: 0.34, suave: 0.9 * k }, semente: 7304 }))

  // O título, o fio, o quadro do retrato com a silhueta, VIVO OU MORTO e a recompensa.
  const tinta = { bisel: 0, contorno: 0, textura: texDaTinta, semente: 7305 }
  L.push(P(linhaDeTexto(TITULO, k), TINTA, tinta))
  L.push(P(cx([-12.4, FIO_DO_TITULO - 0.2, 12.4, FIO_DO_TITULO + 0.2]), TINTA, { ...tinta, alfa: 0.8 }))
  const quadro = cx(QUADRO)
  const g = GROSSURA_DO_QUADRO
  const dentro = cx([QUADRO[0] + g, QUADRO[1] + g, QUADRO[2] - g, QUADRO[3] - g])
  L.push(P(dentro, FUNDO_DO_RETRATO, { bisel: 0, contorno: 0, textura: texDaTinta, semente: 7306 }))
  const chapeu = poligono(
    ([[-7.6, -11.8], [-5.5, -10.6], [-3, -10], [0, -9.8], [3, -10], [5.5, -10.6], [7.6, -11.8], [6.2, -12.8], [4.2, -14.4], [1.8, -15.3], [0, -15.5], [-1.8, -15.3], [-4.2, -14.4], [-6.2, -12.8]] as const).map(em),
  )
  const cabeca = elipse(...em([0, -7]), 3.4 * k, 3.7 * k)
  const ombros = elipse(...em([0, 2.4]), 9.6 * k, 7 * k)
  const pescoco = cx([-1.6, -4.4, 1.6, -2.6])
  L.push(P(dentroDe(uniao(uniao(chapeu, cabeca), uniao(pescoco, ombros)), dentro), SILHUETA, { bisel: 0, contorno: 0, textura: texDaTinta, semente: 7307 }))
  L.push(P(menos(quadro, dentro), TINTA, tinta))
  L.push(P(linhaDeTexto(VIVO_OU_MORTO, k), TINTA, tinta))
  const [mx, my] = em(MOEDA)
  L.push(P(elipse(mx, my, RAIO_DA_MOEDA * k, RAIO_DA_MOEDA * k), MOEDA_DE_LATAO, { bisel: 0.6 * k, contorno: 0.3, alfa: 0.9, semente: 7308 }))
  L.push(P(capsula(mx, my - 0.9 * k, mx, my + 0.9 * k, 0.32 * k), TINTA, { ...tinta, alfa: 0.7 }))
  L.push(P(linhaDeTexto(VALOR, k), TINTA, tinta))

  // A dobra do canto: o avesso do papel, refletido pela linha da dobra, com a sombra no papel.
  const [ax, ay] = DOBRA_ESQUERDA
  const [bx, by] = DOBRA_BAIXO
  L.push(P(poligono([em([ax, ay]), em([bx, by]), em([bx, ay])]), AVESSO, { bisel: 0.4 * k, contorno: 0.2, projeta: { dist: 0.9 * k, forca: 0.4, suave: 0.6 * k }, semente: 7309 }))

  // Os pregos na travessa e o capim no pé do poste.
  for (const prego of PREGOS) L.push(P(elipse(...em(prego), 0.8 * k, 0.8 * k), PREGO, { bisel: 0.6 * k, contorno: 0.2, metal: 0.3 }))
  const capim = { bisel: 0.8 * k, contorno: 0.2 }
  L.push(P(tufo(-POSTE * k - 0.6 * k, (CHAO + 0.5) * k, 4.2 * k, 4.2 * k, -0.5 * k), CAPIM, { ...capim, tom: 0.92, semente: 7310 }))
  L.push(P(tufo(POSTE * k + 0.8 * k, (CHAO + 0.8) * k, 3.6 * k, 3.4 * k, 0.6 * k), CAPIM, { ...capim, tom: 1.04, semente: 7311 }))
}
