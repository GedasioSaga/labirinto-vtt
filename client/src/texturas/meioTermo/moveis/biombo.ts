/**
 * BIOMBO de cima com volume (lote 4 dos objetos novos, 11/11/2026): o biombo
 * de quarto, de folhas de pano em moldura de madeira, aberto em ziguezague.
 * Ele é fino e alto. De cima é a linha em ziguezague das MOLDURAS (as duas
 * réguas da travessa de cima de cada folha, com o fio do pano preso entre
 * elas), as PINHAS dos montantes nas duas pontas de cada folha, a DOBRADIÇA
 * de latão em cada dobra e, no chão, a SOMBRA comprida de cada folha, também
 * em ziguezague: é ela que diz, de cima, que aquilo é alto.
 *
 * NA 3/4 CADA FOLHA APARECE DE FRENTE, inclinada como está no chão: os dois
 * montantes, a almofada de madeira embaixo, as travessas, o pano e, bordadas
 * nele, duas ONDAS. A 3/4 (`tresQuartos.ts`) só sabe varrer uma forma do chão
 * até a altura dela, numa cor só, e cada peça sobe com a estrutura mais alta
 * que contém o meio da caixa dela; então a folha é montada de varreduras, cada
 * uma na sua RAIA, uma faixa ao comprido da folha (as raias são das
 * estruturas, que de cima não pintam nada; as peças ficam debaixo da moldura):
 * - o PANO é a coluna da raia de trás do meio; a peça dela é o forro, um risco
 *   de pano escondido debaixo do fio (é da peça que a 3/4 tira a cor da
 *   frente);
 * - a ALMOFADA de madeira é uma coluna baixa na raia da frente, e a travessa
 *   do meio e a de cima, tampos no ar na mesma raia (a de cima leva a régua
 *   da moldura e, na frente, o fio de pano, que sobem com ela). A raia de
 *   trás é o espelho: com o biombo girado, é ela que fica virada para quem
 *   olha, e a almofada e a travessa do meio vão para ela (o `giro` diz qual
 *   lado de cada folha está à vista). A almofada e a travessa do meio não têm
 *   peça: a 3/4 dá a elas o material da maior peça do desenho, que é uma
 *   régua da moldura;
 * - cada ONDA é uma fileira de pontos de bordado, cada ponto um tampo no ar na
 *   altura dele. A peça de cada ponto é um risco escondido debaixo do fio de
 *   pano, na fresta entre a raia do pano e a da madeira, onde nenhuma
 *   estrutura mais alta a leva embora.
 * Quem está mais ao sul é pintado depois: a raia da frente cobre o pano. O
 * ponto do bordado é curto e pode ficar ao norte da ponta do pano; por isso a
 * caixa da estrutura dele é esticada até passar da beira da folha que fica
 * embaixo na tela (`ateABeira`, que lê o `giro`): é a caixa que dá a ordem da
 * pintura. Os montantes são colunas redondas (o veio fica de pé).
 *
 * As raias do pano e da madeira têm 2,4 px: a frente varrida só é lisa a mais
 * de 0,85 px da beira da forma (até ali valem o chanfro e o contorno), e a
 * varredura anda de 0,4 em 0,4 px; a raia fina saía riscada. O ponto do
 * bordado é mais estreito de propósito: sai abaulado, como linha grossa.
 *
 * A sombra no chão é pintada à parte, em três faixas cada vez mais borradas
 * (a varredura do motor, de 20 amostras, deixava a linha fina em degraus).
 *
 * As folhas saem da largura (uma a cada meia casa: quatro no tamanho de
 * partida). Materiais: `madeira` e `pano`; o latão e a linha do bordado são
 * fixos (a linha sai do pano: azulada no pano claro, crua no escuro).
 */
import { misturar, type Rgb } from '../../ruido'
import { dentroDe, elipse, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Sombra } from './motor'
import { G, materialDaPeca, type MontarMovel } from './contexto'

/** Altura das folhas em casas (o alto da moldura), e quanto os montantes passam delas. */
const ALTURA = 1.2
const SOBRA_DO_MONTANTE = 0.022
/** O pano acaba abaixo do alto da moldura (px do protótipo): o alto dele não cobre a régua de trás, pintada antes. */
const PANO_ABAIXO_DA_MOLDURA = 1.5
/**
 * A beirada dos tampos soltos na 3/4 (px do protótipo): com a largura da raia,
 * dá a altura das travessas e a do ponto do bordado. O perfil do biombo em
 * `tresQuartos.ts` usa este valor.
 */
export const ESPESSURA_DAS_TRAVESSAS_DO_BIOMBO = 0.02 * G
/** A almofada de madeira de baixo, em casas (do chão ao alto dela), e quanto a travessa do meio passa dela (px do protótipo). */
const ALTURA_DA_ALMOFADA = 0.34
const TRAVESSA_DO_MEIO = 2.2
/** As duas ondas bordadas: a altura do meio de cada uma, em casas (a segunda é a de cima), a amplitude e o comprimento de onda (px do protótipo). */
const ALTURAS_DAS_ONDAS: readonly number[] = [0.7, 0.83]
const AMPLITUDE_DA_ONDA = 1.6
const COMPRIMENTO_DA_ONDA = 16
/** O comprimento de um ponto do bordado ao longo da folha e a folga do bordado até o montante (px do protótipo). */
const PONTO_DO_BORDADO = 2.5
const FOLGA_DO_BORDADO = 1.6

/** Uma folha a cada tanto de largura, em casas, e os limites. */
const LARGURA_DA_FOLHA = 0.5
const FOLHAS_MINIMAS = 3
const FOLHAS_MAXIMAS = 6
/** O raio do montante e o da pinha (px do protótipo). */
const RAIO_DO_MONTANTE = 1.45
const RAIO_DA_PINHA = 1.95
/** Quanto o meio de cada montante fica para dentro da dobra, ao longo da folha: sobra o lugar da dobradiça. */
const RECUO_DO_MONTANTE = RAIO_DO_MONTANTE + 0.6
/** A margem da pegada: a pinha da ponta não passa dela. */
const MARGEM = RAIO_DA_PINHA + 0.25

/** Uma raia: de onde até onde vai, em px do protótipo a partir do meio da folha (positivo = para a frente, o sul). */
type Raia = readonly [number, number]
/** A moldura vista de cima: as duas réguas (a de trás é o espelho da da frente), com o fio de pano entre elas. */
const REGUA_DA_FRENTE: Raia = [0.35, 1.6]
const FIO_DE_PANO: Raia = [-0.35, 0.35]
/**
 * O fio sobe com a travessa de cima da frente (pintada depois do pano): a
 * caixa dele cresce para a frente até o meio dela cair na raia da madeira, a
 * esta distância do meio da folha (px do protótipo).
 */
const MEIO_DA_CAIXA_DO_FIO = 0.8
/** Quanto cada ponta do fio de pano fica para dentro do meio do montante, debaixo da pinha (px do protótipo). */
const FIO_SOB_A_PINHA = 1.5
/** O forro: o risco de pano debaixo do fio, dentro da raia do pano, e quanto ele é mais curto que o fio em cada ponta. */
const FORRO: Raia = [-0.34, -0.22]
const FORRO_MAIS_CURTO = 0.5
/** O pano, logo atrás do meio. */
const RAIA_DO_PANO: Raia = [-2.6, -0.15]
/** A madeira (a almofada e as duas travessas), na frente; atrás é o espelho dela. O meio de cada régua da moldura cai aqui. */
const RAIA_DA_MADEIRA: Raia = [0.5, 2.9]
/**
 * As duas ondas: a raia da estrutura de cada uma e o risco da peça dela, na
 * fresta entre o pano e a madeira (de -0,15 a 0,5). O risco da onda de baixo
 * fica fora da raia da de cima, que é mais alta e o levaria.
 */
const RAIAS_DAS_ONDAS: readonly Raia[] = [[-0.15, 1.35], [0.1, 1.6]]
const RISCOS_DAS_ONDAS: readonly Raia[] = [[-0.12, 0.08], [0.14, 0.34]]
/** Quanto a caixa das raias cresce (px do protótipo): com o canto da caixa fora da forma, a 3/4 põe o veio da frente de pé. */
const FOLGA_DA_RAIA = 3
/** A caixa do ponto do bordado passa da beira da folha por esta folga, para ele ser pintado depois de todas as raias dela. */
const FOLGA_DO_BORDADO_NA_ORDEM = 8
/** A partir desta distância da caixa justa, `comCaixa` devolve a distância à caixa em vez da distância à forma. */
const LONGE_DA_FORMA = 3
/**
 * Os números de `comCaixa` (px do protótipo). `MIOLO` passa do chanfro (0,8) e
 * do contorno (0,85) da frente varrida; `FUNDO` passa do fundo em que a
 * varredura para (-4); com `SALTO`, quem está a mais de `PERTO_DA_BEIRA` lê
 * mais de 4 px, a distância em que a varredura ainda anda a passos largos.
 */
const MIOLO = 0.9
const FUNDO = -4.5
const PERTO_DA_BEIRA = 1.2
const SALTO = 3.5

/** A dobradiça: duas, uma em cada altura (fração da altura da folha), lado a lado na dobra (px do protótipo). */
const ALTURAS_DAS_DOBRADICAS: readonly number[] = [0.27, 0.76]
const MEIA_DOBRADICA: readonly [number, number] = [0.4, 0.62]
const DOBRADICA_DO_MEIO = 0.44
const DOBRADICA_PARA_FORA = 0.2
const LATAO = materialDaPeca('latao')

/** A linha do bordado: o anil no pano claro, a lã crua no escuro, misturados com o próprio pano (o padrão é discreto). */
const ANIL: Rgb = [0x4a, 0x5f, 0x80]
const LINHA_CRUA: Rgb = [0xd8, 0xcc, 0xae]
const QUANTO_DE_LINHA = 0.55
/** A soma dos três canais a partir da qual o pano é claro. */
const PANO_CLARO = 420

/** A sombra de cada folha no chão: três faixas da sombra inteira (de onde até onde, e o borrão de cada uma) e a força. */
const FAIXAS_DA_SOMBRA: readonly (readonly [number, number, number])[] = [
  [0, 0.34, 1.3],
  [0.22, 0.68, 2.8],
  [0.5, 1, 4.6],
]
const FORCA_DA_SOMBRA = 0.22
/** O borrão das sombras que só dizem a altura à 3/4 (força zero): pequeno, para a imagem não crescer à toa. */
const BORRAO_DAS_ESTRUTURAS = 0.1

/** O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta, como no altar. */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

function crescida(b: Caixa, folga: number): Caixa {
  return [b[0] - folga, b[1] - folga, b[2] + folga, b[3] + folga]
}

/**
 * A caixa `b` esticada até a beira de `ate` que fica EMBAIXO NA TELA depois do
 * quarto de volta que a 3/4 pinta (`giro`, em graus): é a beira que dá a ordem
 * da pintura (`girarCaixa` em `tresQuartos.ts`: a beira sul da caixa girada é
 * a leste, a norte ou a oeste da de antes). Esticar só para esse lado, e não a
 * caixa inteira, deixa a janela de pintura de cada ponto do bordado pequena.
 */
function ateABeira(b: Caixa, ate: Caixa, giro: number): Caixa {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  if (quartos === 1) return [b[0], b[1], ate[2], b[3]]
  if (quartos === 2) return [b[0], ate[1], b[2], b[3]]
  if (quartos === 3) return [ate[0], b[1], b[2], b[3]]
  return [b[0], b[1], b[2], ate[3]]
}

/**
 * Régua reta de `largura` px entre dois pontos (pontas retas), como a `barra`
 * de `formas.ts`, mas pela conta direta do retângulo girado: o biombo tem mais
 * de cem delas, cada uma varrida pela 3/4, e a do polígono custava cinco vezes mais.
 */
function regua(a: Ponto, b: Ponto, largura: number): Forma {
  const cx = (a[0] + b[0]) / 2
  const cy = (a[1] + b[1]) / 2
  const comprimento = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const ux = (b[0] - a[0]) / comprimento
  const uy = (b[1] - a[1]) / comprimento
  const meioC = comprimento / 2
  const meiaL = largura / 2
  const ex = Math.abs(ux) * meioC + Math.abs(uy) * meiaL
  const ey = Math.abs(uy) * meioC + Math.abs(ux) * meiaL
  return {
    b: [cx - ex, cy - ey, cx + ex, cy + ey],
    d(x, y) {
      const px = x - cx
      const py = y - cy
      const qx = Math.abs(px * ux + py * uy) - meioC
      const qy = Math.abs(py * ux - px * uy) - meiaL
      const ox = qx > 0 ? qx : 0
      const oy = qy > 0 ? qy : 0
      const dentro = qx > qy ? qx : qy
      return Math.sqrt(ox * ox + oy * oy) + (dentro < 0 ? dentro : 0)
    },
  }
}

/**
 * A forma de uma ESTRUTURA do biombo (de cima ela não pinta nada), com a caixa
 * `b` e a distância arrumada para a varredura da 3/4 (`varrer`), que anda a
 * forma de 0,4 em 0,4 px sempre que está a menos de 4 px dela: com mais de cem
 * estruturas finas e inclinadas, cada pixel da frente dava uns 30 passos.
 * - A caixa: a 3/4 lê a da estrutura para a ordem da pintura (a beira sul) e
 *   para o sentido do veio. Longe da caixa justa a distância devolvida é a da
 *   caixa, que nunca passa da de verdade e custa quase nada.
 * - Fora da forma, a mais de `PERTO_DA_BEIRA`, a distância ganha `SALTO`: a
 *   varredura chega à beira em dois ou três passos, sem nunca passar dela (as
 *   formas são convexas: depois de se afastar, o caminho não volta).
 * - Dentro, a mais de `MIOLO` da beira, a distância é `FUNDO`: a varredura
 *   para ali. Até `MIOLO` valem o chanfro e o contorno da frente, que leem a
 *   distância de verdade; mais fundo a frente é lisa de qualquer jeito.
 */
function comCaixa(forma: Forma, b: Caixa = forma.b): Forma {
  const [x0, y0, x1, y1] = forma.b
  return {
    b,
    d(x, y) {
      const fx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0
      const fy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0
      const fora = Math.sqrt(fx * fx + fy * fy)
      if (fora > LONGE_DA_FORMA) return fora + SALTO
      const d = forma.d(x, y)
      return d <= -MIOLO ? FUNDO : d > PERTO_DA_BEIRA ? d + SALTO : d
    },
  }
}

/** A linha do bordado para este pano. */
function linhaDoBordado(pano: MaterialDaPeca): MaterialDaPeca {
  const claro = pano.rgb[0] + pano.rgb[1] + pano.rgb[2] > PANO_CLARO
  return { classe: 'tecido', fio: 'linho', rgb: misturar(pano.rgb, claro ? ANIL : LINHA_CRUA, QUANTO_DE_LINHA) }
}

export const montarBiombo: MontarMovel = (c, cena) => {
  const { hw, hh, w, g, peca: P } = c
  const mad = c.m.madeira
  const pano = c.m.pano
  const linha = linhaDoBordado(pano)
  const L = cena.partes
  const H = g * ALTURA
  const beirada = ESPESSURA_DAS_TRAVESSAS_DO_BIOMBO
  const zAlmofada = g * ALTURA_DA_ALMOFADA
  /** Só a altura, para a 3/4: sem sombra no chão. */
  const estrutura = (forma: Forma, z: number, solta: boolean): Sombra => ({ forma, z, solta, forca: 0, suave: BORRAO_DAS_ESTRUTURAS })
  const [sombraX, sombraY] = desgirado(SOMBRA_X * H, SOMBRA_Y * H, c.giro)
  /** O biombo vai ser pintado de lado na 3/4 (um ou três quartos de volta): o prumo da tela é o y do desenho. */
  const deLado = Math.round(c.giro / 90) % 2 !== 0
  /** Para onde, no desenho, fica o "para baixo" da tela (de onde se olha a 3/4) depois do quarto de volta. */
  const [paraBaixoX, paraBaixoY] = desgirado(0, 1, c.giro)

  // As dobras do ziguezague, da esquerda para a direita: a primeira no fundo, a seguinte na frente.
  const folhas = Math.max(FOLHAS_MINIMAS, Math.min(FOLHAS_MAXIMAS, Math.round(w / (g * LARGURA_DA_FOLHA))))
  const dobras: Ponto[] = []
  for (let j = 0; j <= folhas; j += 1) dobras.push([-hw + MARGEM + ((w - 2 * MARGEM) * j) / folhas, (j % 2 === 0 ? -1 : 1) * (hh - MARGEM)])

  const molduras: (() => void)[] = []
  for (let i = 0; i < folhas; i += 1) {
    const [x0, y0] = dobras[i]
    const [x1, y1] = dobras[i + 1]
    const comprimento = Math.hypot(x1 - x0, y1 - y0)
    const tx = (x1 - x0) / comprimento
    const ty = (y1 - y0) / comprimento
    /** O ponto da folha a `s` px da dobra de partida e a `v` px do meio dela, para a frente. */
    const naFolha = (s: number, v: number): Ponto => [x0 + tx * s - ty * v, y0 + ty * s + tx * v]
    const eixo = Math.atan2(ty, tx)
    const caixaDaFolha: Caixa = [x0, Math.min(y0, y1), x1, Math.max(y0, y1)]

    // A sombra da folha no chão e o contato no pé.
    for (const [de, ate, borrao] of FAIXAS_DA_SOMBRA) {
      const faixa = poligono([[x0 + sombraX * de, y0 + sombraY * de], [x1 + sombraX * de, y1 + sombraY * de], [x1 + sombraX * ate, y1 + sombraY * ate], [x0 + sombraX * ate, y0 + sombraY * ate]])
      cena.sombras.push({ forma: faixa, z: 0, suave: borrao, forca: FORCA_DA_SOMBRA })
    }
    cena.sombras.push(contato(regua(dobras[i], dobras[i + 1], 2 * REGUA_DA_FRENTE[1]), 0.3))

    // Os MONTANTES, um em cada ponta, com a pinha em cima.
    const pontas = [naFolha(RECUO_DO_MONTANTE, 0), naFolha(comprimento - RECUO_DO_MONTANTE, 0)]
    for (const [px, py] of pontas) cena.sombras.push(estrutura(comCaixa(elipse(px, py, RAIO_DO_MONTANTE, RAIO_DO_MONTANTE)), H + g * SOBRA_DO_MONTANTE, false))

    // O pano e as raias vão de um montante ao outro, sem entrar na frente deles (nem de frente nem com o biombo girado).
    const s0 = RECUO_DO_MONTANTE + RAIO_DO_MONTANTE / Math.min(Math.abs(tx), Math.abs(ty))
    const s1 = comprimento - s0
    /**
     * Quanto andar ao longo da folha, por px de raia, para o ponto da raia ficar no mesmo prumo DA TELA que o do
     * meio da folha. Com o biombo de lado (um quarto de volta), o prumo da tela é o y do desenho, e não o x.
     */
    const corridaPorPx = deLado ? -tx / ty : ty / tx
    /**
     * O risco da raia de `de` a `ate`, corrido ao longo da folha para ficar, na tela, debaixo do mesmo trecho que
     * o meio da folha, com as pontas no esquadro dela: o ponto do bordado e a peça escondida dele.
     */
    const risco = ([v0, v1]: Raia, de: number, ate: number): Forma => {
      const v = (v0 + v1) / 2
      const corrida = v * corridaPorPx
      return regua(naFolha(de + corrida, v), naFolha(ate + corrida, v), Math.abs(v1 - v0))
    }
    /**
     * O trecho da raia que fica, na tela, debaixo do trecho `de` a `ate` do meio da folha, cortado A PRUMO nas duas
     * pontas: todas as raias da folha acabam na mesma vertical da tela, a do montante (com a ponta cortada no
     * esquadro da folha, cada raia acabava num lugar e a beira varrida saía em dentes). E é pelo outro eixo, o que
     * o corte não iguala, que a 3/4 põe as raias em ordem.
     */
    const naRaia = ([v0, v1]: Raia, de: number, ate: number): Forma => {
      const largura = Math.abs(v1 - v0)
      const sobra = largura * Math.abs(corridaPorPx)
      const inteira = risco([v0, v1], de - sobra, ate + sobra)
      const eixoDoCorte = deLado ? 1 : 0
      const [pa, pb] = [naFolha(de, 0)[eixoDoCorte], naFolha(ate, 0)[eixoDoCorte]]
      const [ca, cb] = pa < pb ? [pa, pb] : [pb, pa]
      const entre = (p: number): number => (ca - p > p - cb ? ca - p : p - cb)
      const corte: Forma = deLado ? { b: [inteira.b[0], ca, inteira.b[2], cb], d: (_x, y) => entre(y) } : { b: [ca, inteira.b[1], cb, inteira.b[3]], d: (x) => entre(x) }
      return dentroDe(inteira, corte)
    }
    const naOrdem = (forma: Forma): Forma => comCaixa(forma, crescida(forma.b, FOLGA_DA_RAIA))

    // O PANO: a coluna de trás do meio. Com a caixa justa (o veio do pano não tem lado, e a caixa menor é um quinto
    // a menos de pintura na estrutura mais cara da folha): as raias da madeira, de caixa crescida, vêm depois dele.
    cena.sombras.push(estrutura(comCaixa(naRaia(RAIA_DO_PANO, s0, s1)), H - PANO_ABAIXO_DA_MOLDURA, false))

    // A ALMOFADA e as TRAVESSAS, na frente e atrás (a de trás é o espelho). Do lado da folha que fica de costas para
    // quem olha, a almofada e a travessa do meio nunca aparecem (o pano as cobre) e custam um quinto do tempo de
    // pintura: ali fica só a travessa de cima, que é quem sobe a régua da moldura.
    for (const lado of [1, -1]) {
      const madeira = naOrdem(naRaia([lado * RAIA_DA_MADEIRA[0], lado * RAIA_DA_MADEIRA[1]], s0, s1))
      const aVista = lado * (tx * paraBaixoY - ty * paraBaixoX) > 0
      if (aVista) cena.sombras.push(estrutura(madeira, zAlmofada, false), estrutura(madeira, zAlmofada + TRAVESSA_DO_MEIO, true))
      cena.sombras.push(estrutura(madeira, H, true))
    }

    // As ONDAS bordadas: ponto a ponto, cada um na altura que a onda tem ali. A fase segue de folha em folha.
    const pontos = Math.max(1, Math.round((s1 - s0 - 2 * FOLGA_DO_BORDADO) / PONTO_DO_BORDADO))
    const ponto = (s1 - s0 - 2 * FOLGA_DO_BORDADO) / pontos
    for (const [k, altura] of ALTURAS_DAS_ONDAS.entries()) {
      for (let p = 0; p < pontos; p += 1) {
        const de = s0 + FOLGA_DO_BORDADO + p * ponto
        const fase = ((i * comprimento + de + ponto / 2) / COMPRIMENTO_DA_ONDA) * 2 * Math.PI
        // O ponto é cortado no esquadro da folha, e não a prumo: de frente sai em losango, como ponto de linha grossa.
        const losango = risco(RAIAS_DAS_ONDAS[k], de, de + ponto)
        const bordado = comCaixa(losango, ateABeira(losango.b, crescida(caixaDaFolha, FOLGA_DO_BORDADO_NA_ORDEM), c.giro))
        cena.sombras.push(estrutura(bordado, g * altura + AMPLITUDE_DA_ONDA * Math.sin(fase) + beirada / 2, true))
        L.push(P(risco(RISCOS_DAS_ONDAS[k], de, de + ponto), linha, { eixo, bisel: 0, contorno: 0, semente: 3360 + k }))
      }
    }

    // A MOLDURA vista de cima: o fio de pano, as duas réguas e as duas pinhas. Tudo depois dos riscos do bordado de
    // todas as folhas, que ficam escondidos debaixo do fio.
    molduras.push(() => {
      const aoComprido = (raia: Raia, recuo: number): Forma => regua(naFolha(recuo, (raia[0] + raia[1]) / 2), naFolha(comprimento - recuo, (raia[0] + raia[1]) / 2), raia[1] - raia[0])
      // O forro e, por cima dele, o fio. O fio acaba debaixo das pinhas, mais curto que as réguas: a maior peça do
      // desenho tem de ser uma régua (é dela que a 3/4 tira a madeira da almofada e da travessa do meio).
      const recuoDoFio = RECUO_DO_MONTANTE + FIO_SOB_A_PINHA
      L.push(P(aoComprido(FORRO, recuoDoFio + FORRO_MAIS_CURTO), pano, { eixo, bisel: 0, contorno: 0, tom: 0.92, semente: 3375 + i }))
      const fio = aoComprido(FIO_DE_PANO, recuoDoFio)
      const [paraAFrenteX, paraAFrenteY] = [-ty * 2 * MEIO_DA_CAIXA_DO_FIO, tx * 2 * MEIO_DA_CAIXA_DO_FIO]
      const caixaDoFio: Caixa = [Math.min(fio.b[0], fio.b[0] + paraAFrenteX), Math.min(fio.b[1], fio.b[1] + paraAFrenteY), Math.max(fio.b[2], fio.b[2] + paraAFrenteX), Math.max(fio.b[3], fio.b[3] + paraAFrenteY)]
      L.push(P(comCaixa(fio, caixaDoFio), pano, { eixo, bisel: 0, contorno: 0.12, tom: 0.92, semente: 3376 + i }))
      for (const lado of [-1, 1]) {
        const raiaDaRegua: Raia = lado < 0 ? [-REGUA_DA_FRENTE[1], -REGUA_DA_FRENTE[0]] : REGUA_DA_FRENTE
        L.push(P(aoComprido(raiaDaRegua, RECUO_DO_MONTANTE), mad, { eixo, tabua: 0, bisel: 0.9, contorno: 0.26, semente: 3370 + i * 2 + lado }))
      }
      for (const [j, [px, py]] of pontas.entries()) {
        L.push(P(elipse(px, py, RAIO_DA_PINHA, RAIO_DA_PINHA), mad, { tabua: 0, bisel: RAIO_DA_PINHA * 0.9, contorno: 0.28, tom: 1.06, semente: 3380 + i * 2 + j, projeta: { dist: 0.8, forca: 0.24, suave: 0.6 } }))
      }
    })
  }
  for (const moldura of molduras) moldura()

  // As DOBRADIÇAS de latão, do lado de fora de cada dobra: duas, lado a lado de cima, uma em cada altura na 3/4.
  for (let j = 1; j < folhas; j += 1) {
    const [x, y] = dobras[j]
    const fora = y > 0 ? DOBRADICA_PARA_FORA : -DOBRADICA_PARA_FORA
    for (const [k, altura] of ALTURAS_DAS_DOBRADICAS.entries()) {
      const dobradica = elipse(x + (k === 0 ? -DOBRADICA_DO_MEIO : DOBRADICA_DO_MEIO), y + fora, MEIA_DOBRADICA[0], MEIA_DOBRADICA[1])
      cena.sombras.push(estrutura(dobradica, H * altura, true))
      L.push(P(dobradica, LATAO, { bisel: 0.4, contorno: 0.24, semente: 3390 + j }))
    }
  }
}
