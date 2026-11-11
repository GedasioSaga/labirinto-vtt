/**
 * ALTAR de pedra de cima com volume (11/11/2026, lote 1 dos objetos novos): o
 * bloco de pedra talhada sobre um DEGRAU de lajes, o tampo grosso com a
 * moldura rebaixada, o PANO de altar atravessado no meio (duas listras, dois
 * losangos bordados e a barra, caindo pela frente) e, em cima, dois castiçais
 * de latão com a vela apagada e a tigela com água. Nenhum símbolo de religião
 * de verdade: o bordado é só geometria. A frente é o lado de baixo.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura, pintada do
 * norte para o sul; cada peça sobe com a estrutura mais alta que contém o meio
 * da caixa dela):
 * - o DEGRAU são três estruturas baixas em volta do bloco, os dois braços e
 *   a fileira da frente: inteiro, o meio das lajes cairia debaixo do tampo e
 *   elas subiriam com ele. A fileira da frente, a mais ao sul, é pintada por
 *   último e esconde o pé do bloco, que está em cima dela. Em três, e não num
 *   U só, o altar girado na 3/4 continua certo: o trecho que fica ao norte é
 *   pintado antes do bloco, e os dos lados não encostam nele na tela;
 * - o BLOCO é a coluna, com duas pilastras nos cantos da frente e o rodapé
 *   (colunas mais à frente, sem peça: a frente de cada uma é o relevo);
 * - o TAMPO é um tampo solto, com a beirada da espessura dele
 *   (`ESPESSURA_DO_TAMPO_DO_ALTAR`, que o perfil da 3/4 usa). Ele passa do
 *   bloco na frente e no fundo; dos lados fica rente, para o braço do degrau
 *   nunca ser pintado por cima da beira dele;
 * - o PANO que cai pela frente são dois tampos soltos e finos na beira do
 *   tampo: o de cima com a cor do pano (a dobra é a peça dele) e, um pouco
 *   abaixo e por trás, o da barra (as borlas dos cantos são as peças dele).
 *
 * As medidas do degrau, do pano e dos objetos são em casas: o altar esticado
 * ganha tampo, não um degrau mais largo nem um castiçal maior. Materiais:
 * `pedra` e `pano`; o latão, a cera, a água e a barra do pano são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { BURACO, G, materialDaPeca, type MontarMovel } from './contexto'

/** Altura do degrau, do tampo (do chão ao alto) e do rodapé acima do degrau, em casas. */
const ALTURA_DO_DEGRAU = 0.1
const ALTURA = 0.74
const ALTURA_DO_RODAPE = 0.07
/** A espessura do tampo (px do protótipo): a beirada dele na 3/4. O perfil do altar em `tresQuartos.ts` usa este valor. */
export const ESPESSURA_DO_TAMPO_DO_ALTAR = 0.16 * G
/** O degrau que sobra em volta do bloco, dos lados e na frente, em casas. */
const DEGRAU_DOS_LADOS = 0.12
const DEGRAU_DA_FRENTE = 0.2
/** Quanto o tampo passa do bloco na frente e no fundo, em casas. */
const SOBRA_DO_TAMPO = 0.04
/** A largura de cada pilastra dos cantos da frente e a da moldura rebaixada do tampo, em casas. */
const PILASTRA = 0.11
const MOLDURA = 0.06
/** Quanto a pilastra sai do bloco, em fração da sobra do tampo (o tampo ainda a cobre), e o rodapé, um pouco mais. */
const SALIENCIA_DA_PILASTRA = 0.55
const SALIENCIA_DO_RODAPE = 0.77
/** Quanto a pilastra e o rodapé entram no bloco (px do protótipo): só para não abrir fresta. */
const ENCAIXE = 3
/** Comprimento de uma laje do degrau, em casas: o altar esticado ganha mais lajes. */
const LAJE = 0.5
/** Junta entre as lajes (px do protótipo). */
const JUNTA = 0.9
/** Meia largura do pano, em casas. */
const MEIO_PANO = 0.34
/** Quanto do que a barra do pano cai fica escondido atrás do pano: o resto aparece embaixo dele. */
const BARRA_ESCONDIDA = 0.55
/** Quanto a dobra do pano passa da beira da frente do tampo e quanto a barra fica para trás dela (px do protótipo). */
const DOBRA = 2.2
const RECUO_DA_BARRA = 0.7
/** Raio da borla de cada canto da barra (px do protótipo): a barra passa do pano o tamanho de uma borla de cada lado. */
const BORLA = 0.8
/** Raio do pé do castiçal e da tigela, em casas. */
const CASTICAL = 0.098
const TIGELA = 0.125
/** A sombra do bloco no degrau: quanto da sombra de verdade (a altura do bloco acima do degrau), a borda e a força. */
const QUANTO_DA_SOMBRA_NO_DEGRAU = 0.6
const BORDA_DA_SOMBRA_NO_DEGRAU = 1.6
const FORCA_DA_SOMBRA_NO_DEGRAU = 0.26
/** Para onde a sombra cai por px de altura (os mesmos números do motor). */
const SOMBRA_X = 0.27
const SOMBRA_Y = 0.21

const LATAO = materialDaPeca('latao')
/** A barra, as listras e o bordado do pano: a lã ocre, fixa. */
const BARRA = materialDaPeca('ocre')
/** A cera da vela: creme, sem brilho. */
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd7, 0xbc] }
/** A água da tigela, a mesma do balde do poço, e o reflexo nela. */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.68)) }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xc7, 0xd2, 0xcf] }
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): um cinza quente, de luminância linear
 * 0,056. Com o escuro de sempre (o da nogueira) a beira da pedra cinza, na sombra, saía marrom.
 */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; de cima é sempre 0, quem gira é a imagem pronta): o contrário do `girarPonto` de `tresQuartos.ts`.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/**
 * A pedra do degrau com a sombra do altar (`bloco`, o contorno dele de cima) pintada nela, caída para (dx, dy):
 * o chão do altar é o degrau, e a sombra no chão do motor fica debaixo das lajes.
 */
function texDoDegrau(bloco: Forma, dx: number, dy: number): Textura {
  const daPedra = texturaDaClasse('pedra')
  return (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const k = 0.5 - bloco.d(x - dx, y - dy) / (2 * BORDA_DA_SOMBRA_NO_DEGRAU)
    if (k > 0) s[3] -= FORCA_DA_SOMBRA_NO_DEGRAU * (k < 1 ? k : 1)
  }
}

/**
 * O castiçal de cima: o pires de latão, a cera que escorreu e empoçou nele, a vela apagada (o toco grosso,
 * com a cova derretida no alto) e o pavio preto. `escorre` = para que lado a cera escorreu (-1 ou 1).
 */
function castical(L: Peca[], P: CriarPeca, x: number, y: number, r: number, escorre: number, sem: number): void {
  L.push(P(elipse(x, y, r, r), LATAO, { bisel: r * 0.3, contorno: 0.3, semente: sem, projeta: { dist: 1.5, forca: 0.34 } }))
  L.push(P(elipse(x, y, r * 0.78, r * 0.78), LATAO, { bisel: 0, tom: 0.8, contorno: 0.1, recesso: { k: 1.2, forca: 0.34 }, semente: sem + 1 }))
  L.push(P(elipse(x + escorre * r * 0.3, y + r * 0.26, r * 0.42, r * 0.36), CERA, { bisel: r * 0.14, tom: 0.9, contorno: 0.14, semente: sem + 2 }))
  L.push(P(elipse(x, y, r * 0.52, r * 0.52), CERA, { bisel: r * 0.2, contorno: 0.24, semente: sem + 3, projeta: { dist: 1, forca: 0.3, suave: 0.6 } }))
  L.push(P(elipse(x, y, r * 0.3, r * 0.3), CERA, { bisel: 0, tom: 0.9, contorno: 0, recesso: { k: 0.7, forca: 0.26 }, semente: sem + 4 }))
  L.push(P(elipse(x, y, r * 0.11, r * 0.11), BURACO, { bisel: 0, contorno: 0, semente: sem + 5 }))
}

export const montarAltar: MontarMovel = (c, cena) => {
  const { w, hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const pano = c.m.pano
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const zDegrau = g * ALTURA_DO_DEGRAU
  const zTampo = g * ALTURA
  const zBloco = zTampo - ESPESSURA_DO_TAMPO_DO_ALTAR
  const sobra = g * SOBRA_DO_TAMPO

  // As medidas de cima: o bloco (recuado do degrau) e o tampo (rente a ele dos lados, passando na frente e no fundo).
  const tx = hw - g * DEGRAU_DOS_LADOS
  const ySul = hh - g * DEGRAU_DA_FRENTE
  const yNorte = -hh + sobra + 0.5
  const bloco = caixa(-tx, yNorte, tx, ySul)
  const [ty0, ty1] = [yNorte - sobra, ySul + sobra]
  const tampo = caixa(-tx, ty0, tx, ty1, 1.2)
  const yMeio = (ty0 + ty1) / 2

  // O DEGRAU: os dois braços (do fundo até a beira da frente do tampo) e a fileira da frente, de ponta a ponta.
  // Em cada trecho, o fundo das juntas e as lajes.
  cena.sombras.push(contato(caixa(-hw, -hh, hw, hh, 1), 0.3))
  const alturaDaSombra = (zTampo - zDegrau) * QUANTO_DA_SOMBRA_NO_DEGRAU
  const comSombra = texDoDegrau(tampo, ...desgirado(SOMBRA_X * alturaDaSombra, SOMBRA_Y * alturaDaSombra, c.giro))
  const lajesDaFrente = Math.max(2, Math.round(w / (LAJE * g)))
  const trechos: (readonly [number, number, number, number, number])[] = [
    [-hw, -hh, -tx, ty1, 1],
    [tx, -hh, hw, ty1, 1],
    [-hw, ty1, hw, hh, lajesDaFrente],
  ]
  trechos.forEach(([x0, y0, x1, y1, lajes], t) => {
    const trecho = caixa(x0, y0, x1, y1)
    cena.sombras.push({ forma: trecho, z: zDegrau })
    L.push(P(trecho, pedra, { tabua: 0, bisel: 0.8, tom: 0.6, contorno: 0.26, semente: 800 + t }))
    for (let i = 0; i < lajes; i += 1) {
      const a = x0 + ((x1 - x0) * i) / lajes
      const b = x0 + ((x1 - x0) * (i + 1)) / lajes
      const laje = caixa(a + JUNTA / 2, y0 + JUNTA / 2, b - JUNTA / 2, y1 - JUNTA / 2, 0.8)
      L.push(P(laje, pedra, { tabua: 0, bisel: 1.2, tom: 0.84 + 0.12 * hash(i, t, 801), contorno: 0.24, textura: comSombra, semente: 810 + t * 10 + i }))
    }
  })

  // O BLOCO, as duas pilastras dos cantos da frente e o rodapé: só a sombra de cada um (de cima o tampo os cobre).
  const pilastra = g * PILASTRA
  const ySaliencia = ySul + sobra * SALIENCIA_DA_PILASTRA
  cena.sombras.push(
    { forma: bloco, z: zBloco },
    { forma: caixa(-tx, ySul - ENCAIXE, -tx + pilastra, ySaliencia), z: zBloco },
    { forma: caixa(tx - pilastra, ySul - ENCAIXE, tx, ySaliencia), z: zBloco },
    { forma: caixa(-tx, ySul - ENCAIXE, tx, ySul + sobra * SALIENCIA_DO_RODAPE), z: zDegrau + g * ALTURA_DO_RODAPE },
  )

  // O TAMPO: a laje grossa com a moldura rebaixada e uma trinca perto do canto.
  cena.sombras.push({ forma: tampo, z: zTampo, solta: true, forca: 0.3 })
  L.push(P(tampo, pedra, { tabua: 0, bisel: 1.8, tom: 1.02, contorno: 0.28, semente: 830 }))
  const moldura = g * MOLDURA
  L.push(P(caixa(-tx + moldura, ty0 + moldura, tx - moldura, ty1 - moldura, 0.8), pedra, { tabua: 0, bisel: 0.5, tom: 0.95, contorno: 0.12, recesso: { k: 1.2, forca: 0.24 }, semente: 831 }))
  const trinca: Ponto[] = [[0.99, -0.5], [0.9, -0.36], [0.83, -0.32], [0.74, -0.14]]
  L.push(P(cadeia(trinca.map(([fx, fy]): Ponto => [fx * tx, yMeio + fy * (ty1 - ty0)]), 0.34), pedra, { tabua: 0, bisel: 0, tom: 0.5, contorno: 0, semente: 832 }))

  // O PANO: a faixa do fundo à frente, as duas listras, os dois losangos bordados e a dobra na beira da frente.
  const meioPano = Math.min(g * MEIO_PANO, tx * 0.42)
  const tecido = { tabua: 0, bisel: 0.9, ruga: 1.1, contorno: 0.24 }
  L.push(P(caixa(-meioPano, ty0 + 0.3, meioPano, ty1 + 0.3, 0.6), pano, { ...tecido, semente: 840, projeta: { dist: 0.9, forca: 0.26 } }))
  const listra = meioPano * 0.09
  for (const lado of [-1, 1]) {
    const x = lado * meioPano * 0.8
    L.push(P(caixa(x - listra, ty0 + 0.3, x + listra, ty1 + 0.3), BARRA, { tabua: 0, bisel: 0.3, ruga: 1.1, contorno: 0.1, semente: 841 + lado }))
  }
  const [lx, ly] = [meioPano * 0.2, meioPano * 0.26]
  for (const lado of [-1, 1]) {
    const y = yMeio + lado * (g * TIGELA + ly * 1.5)
    L.push(P(poligono([[0, y - ly], [lx, y], [0, y + ly], [-lx, y]]), BARRA, { tabua: 0, bisel: 0.3, contorno: 0.1, semente: 844 + lado }))
  }
  // A dobra e a barra: os dois tampos soltos por onde o pano cai na 3/4 (a barra mais baixa e, de cima, escondida
  // atrás da dobra; ela passa um pouco dos lados, onde ficam as borlas).
  const dobra = caixa(-meioPano, ty1 - 0.4, meioPano, ty1 + DOBRA, 0.5)
  const [yBarra0, yBarra1] = [ty1 + 0.2, ty1 + DOBRA - RECUO_DA_BARRA]
  const barra = caixa(-meioPano - BORLA * 2, yBarra0, meioPano + BORLA * 2, yBarra1)
  cena.sombras.push(
    { forma: barra, z: zBloco + ESPESSURA_DO_TAMPO_DO_ALTAR * BARRA_ESCONDIDA, solta: true, forca: 0.1 },
    { forma: dobra, z: zTampo, solta: true, forca: 0.1 },
  )
  L.push(P(dobra, pano, { ...tecido, tom: 0.84, semente: 846 }))
  for (const lado of [-1, 1]) L.push(P(elipse(lado * (meioPano + BORLA), (yBarra0 + yBarra1) / 2, BORLA, BORLA * 0.8), BARRA, { tabua: 0, bisel: 0.5, contorno: 0.16, semente: 847 + lado }))

  // Os castiçais, um de cada lado do pano, e a tigela no meio dele.
  const xCastical = (meioPano + tx) / 2
  castical(L, P, -xCastical, yMeio, g * CASTICAL, -1, 850)
  castical(L, P, xCastical, yMeio, g * CASTICAL, 1, 860)
  const rT = g * TIGELA
  L.push(P(elipse(0, yMeio, rT, rT), LATAO, { bisel: rT * 0.3, contorno: 0.3, semente: 870, projeta: { dist: 1.6, forca: 0.34 } }))
  L.push(P(elipse(0, yMeio, rT * 0.74, rT * 0.74), LATAO, { bisel: 0, tom: 0.74, contorno: 0.1, recesso: { k: 1.8, forca: 0.36 }, semente: 871 }))
  L.push(P(elipse(0, yMeio, rT * 0.58, rT * 0.58), AGUA, { bisel: 0, contorno: 0.14, recesso: { k: 1, forca: 0.2 }, semente: 872 }))
  L.push(P(elipse(rT * 0.14, yMeio + rT * 0.2, rT * 0.26, rT * 0.09), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.22, suave: 0.8, semente: 873 }))
}
