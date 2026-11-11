/**
 * BONECO DE TREINO (lote 1 dos objetos novos, 11/11/2026), EM PÉ, de frente
 * como a lápide e o quadro de avisos: visto de cima ele seria uma cruz com uma
 * bola no meio, e ninguém diria o que é. No chão, a BASE EM CRUZ de duas
 * vigas, com as duas mãos-francesas que seguram o POSTE; no alto do poste, a
 * TRAVESSA dos braços, amarrada com corda perto das pontas; em volta dele, o
 * CORPO de palha em feixe, apertado por duas voltas dobradas de corda e pelo X
 * da amarração no peito, com a franja de palha saindo por baixo; por cima, a
 * CABEÇA de saco de pano, mais larga em cima que no pescoço, com a costura, o
 * remendo e o nó. As MARCAS DE GOLPE são os cortes no corpo e na cabeça (o
 * talho escuro, a beira clara e a palha escapando embaixo) e os dois entalhes
 * no braço.
 *
 * O desenho é feito numa casa de 56 px e escala com o menor lado da pegada;
 * como a lápide, ele passa da pegada para cima (a cabeça, até 0,2 casa). A
 * sombra no chão é a do boneco em pé: o poste arrastado e, soltas, a travessa,
 * o corpo e a cabeça, cada um na sua altura. A 25% de zoom sobra o T do poste
 * e dos braços com o corpo claro e a cabeça. A palha, a corda e o pano são
 * fixos. Material: `madeira` (o poste, a travessa e a base).
 */
import { hash, type Rgb } from '../../ruido'
import { barra, caixa, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { LENCOL, QUARTO, type MontarMovel } from './contexto'

/** O lado da casa em que o boneco é desenhado (px do protótipo). */
const CASA = 56

// As alturas do desenho, em y da casa (0 no meio, para baixo cresce).
/** O pé do poste, no meio da base em cruz. */
const CHAO = 19
/** O meio da travessa dos braços. */
const OMBRO = -16.5
/** A barra de baixo do corpo de palha. */
const CINTURA = 5
/** O nó do saco no pescoço e o meio da cabeça. */
const PESCOCO = -23.4
const CABECA = -30.6

/** A base: meio comprimento de cada viga, o quanto ela sobe ou desce de uma ponta à outra (a cruz vista de frente é achatada), a largura e a espessura. */
const MEIA_VIGA = 19
const QUEDA_DA_VIGA = 5
const LARGURA_DA_VIGA = 4.6
const ESPESSURA_DA_VIGA = 1.8
/** Meia largura do poste e da travessa, e o meio comprimento da travessa. */
const MEIO_POSTE = 2.4
const MEIA_TRAVESSA = 2.2
const MEIO_BRACO = 24
/** As duas amarras do corpo (y da casa), o vão entre as duas voltas de cada uma e o quanto a palha afunda junto delas. */
const CORDAS_DO_CORPO: readonly number[] = [-10.4, 0.6]
const ENTRE_AS_VOLTAS = 0.75
const AFUNDADO_DA_CORDA = 2.2
/** O raio de uma volta de corda (px da casa): pouco mais de 1 pixel a 1x. */
const RAIO_DA_CORDA = 0.66

/** A palha do corpo: o amarelo-palha contido do feno, com o fio seco e o verde (`feno.ts`). */
const TOM_DA_PALHA: Rgb = [0xc4, 0xa7, 0x69]
const FIO_SECO: Rgb = [0xd2, 0xbb, 0x84]
const FIO_VERDE: Rgb = [0xa8, 0x9a, 0x5c]
const PALHA: MaterialDaPeca = { classe: 'palha', rgb: TOM_DA_PALHA }
/** O fio solto é fino demais para a trama da palha: a mesma cor, lisa. */
const FIO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DA_PALHA }
/** A corda: sisal mais escuro que a palha (a corda clara da cerca sumiria nela), com a torção em diagonal. */
const SISAL: MaterialDaPeca = { classe: 'liso', rgb: [0x96, 0x7a, 0x50] }
const TORCAO_DO_SISAL: Rgb = [0x66, 0x50, 0x34]
/** O talho de um golpe (o escuro de dentro da palha e do pano) e a beira dele, que pega a luz. */
const TALHO: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x4a, 0x30] }
const BEIRA_DO_TALHO: MaterialDaPeca = { classe: 'liso', rgb: FIO_SECO }
/** O saco é o lençol da casa um tom abaixo: aniagem, não linho lavado (na lajota clara o lençol puro sumia). */
const TOM_DO_SACO = 0.92
/** A linha da costura do saco: o pano, mais escuro. */
const LINHA_DA_COSTURA: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x7a, 0x62] }

/** Largura de um fio de palha (px do protótipo) e a fração dos pedaços que é vão escuro entre os fios. */
const LARGURA_DO_FIO = 1.7
const VAO_DA_PALHA = 0.3
/** Abaixo desta escala (pixels da imagem por px do protótipo) o fio fica com menos contraste, como no feno. */
const ESCALA_DO_FIO_INTEIRO = 1.5
const CONTRASTE_DO_FIO_MIUDO = 0.45

/**
 * A palha do corpo: fios DE PÉ, em pedaços de 6 a 13 px, um pouco tortos, cada
 * um com a sua luz; a palha afunda junto de cada amarra (`cordas`, em y da cena).
 */
function texDaPalha(cordas: readonly number[], afundado: number, semente: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const torto = x + ruido(y * 0.13 + semente, x * 0.21) * 2.4
    const j = Math.floor(torto / LARGURA_DO_FIO)
    const atraves = torto / LARGURA_DO_FIO - j
    const comprimento = 6 + hash(j, semente, 941) * 7
    const ao = y / comprimento + hash(j, semente, 942)
    const k = Math.floor(ao)
    const h = hash(j, k, semente)
    const fio = h < VAO_DA_PALHA ? -0.1 : -0.04 + ((h - VAO_DA_PALHA) / (1 - VAO_DA_PALHA)) * 0.22 * Math.sin(atraves * Math.PI) * Math.sqrt(Math.sin((ao - k) * Math.PI))
    const contraste = escala < ESCALA_DO_FIO_INTEIRO ? CONTRASTE_DO_FIO_MIUDO : 1
    let luz = fio * contraste + ruido(x * 0.07 + 3, y * 0.07) * 0.07
    for (const corda of cordas) {
      const perto = Math.abs(y - corda)
      if (perto < afundado) luz -= 0.16 * (1 - perto / afundado)
    }
    s[3] += luz
    const cor = h > 0.88 ? FIO_SECO : h > VAO_DA_PALHA && h < 0.42 ? FIO_VERDE : null
    if (cor === null) return
    const t = 0.4 * contraste
    s[0] += (cor[0] - s[0]) * t
    s[1] += (cor[1] - s[1]) * t
    s[2] += (cor[2] - s[2]) * t
  }
}

/** A corda torcida: faixas em diagonal da cor da torção, ao longo do veio da peça. */
const texDoSisal: Textura = (u, v, _x, _y, _p, s) => {
  const t = Math.max(0, Math.min(1, (Math.sin((u * 1.1 + v * 1.6) * 1.2) - 0.1) / 0.9))
  s[0] += (TORCAO_DO_SISAL[0] - s[0]) * t
  s[1] += (TORCAO_DO_SISAL[1] - s[1]) * t
  s[2] += (TORCAO_DO_SISAL[2] - s[2]) * t
}

/** O contorno do corpo, do ombro à cintura: mais largo no peito, afinando para baixo. */
const CORPO: readonly Ponto[] = [
  [-9.4, OMBRO - 3.2],
  [9.4, OMBRO - 3.2],
  [10.6, OMBRO + 3.5],
  [9.6, CINTURA - 8],
  [8.2, CINTURA],
  [-8.2, CINTURA],
  [-9.6, CINTURA - 8],
  [-10.6, OMBRO + 3.5],
]
/** Meia largura do corpo na altura de cada amarra (a corda dá a volta por fora da palha). */
const MEIO_CORPO_NAS_CORDAS: readonly number[] = [10.5, 9.1]

/** Os fios de palha soltos: de onde saem (x, y da casa), o ângulo (radianos) e o comprimento. A franja da cintura e os tufos do ombro. */
const FIOS_SOLTOS: readonly (readonly [number, number, number, number])[] = [
  [-7.2, CINTURA - 0.6, 1.75, 4.2],
  [-5.1, CINTURA - 0.6, 1.5, 3.4],
  [-3.4, CINTURA - 0.6, 1.72, 4.6],
  [3.2, CINTURA - 0.6, 1.42, 4.4],
  [5.0, CINTURA - 0.6, 1.62, 3.2],
  [7.0, CINTURA - 0.6, 1.36, 4.0],
  [-8.6, OMBRO - 2.6, -2.2, 3.4],
  [-6.4, OMBRO - 2.8, -1.8, 2.8],
  [8.4, OMBRO - 2.6, -0.9, 3.2],
  [6.0, OMBRO - 2.8, -1.3, 2.6],
]

/** Um golpe: o talho de cima (ax, ay) até embaixo (bx, by), em px da casa. */
type Golpe = readonly [number, number, number, number]
/** Os dois golpes no corpo, entre as amarras, e o da cabeça, no lado direito do saco. */
const GOLPES_NO_CORPO: readonly Golpe[] = [
  [-7.4, -8.2, -2.0, -2.4],
  [7.0, -7.8, 3.4, -3.0],
]
const GOLPE_NA_CABECA: Golpe = [2.6, -35.2, 4.9, -30.2]
/** O quanto a beira clara fica acima do talho e o ângulo e o comprimento dos dois fios que escapam embaixo dele. */
const BEIRA_ACIMA_DO_TALHO = 0.75
const FIOS_DO_GOLPE: readonly (readonly [number, number])[] = [
  [1.95, 2.3],
  [1.3, 1.7],
]
/** Os entalhes no braço direito: o x de cada um (px da casa). */
const ENTALHES: readonly number[] = [11.8, 15.4]
/** As duas voltas da amarração perto da ponta de cada braço: o x de cada uma (px da casa). */
const VOLTAS_DO_BRACO: readonly number[] = [18.6, 20.2]
/** A costura do saco: o x de cima e o de baixo (um pouco torta) e os pontos, em fração do comprimento. */
const COSTURA: readonly [number, number] = [-0.9, 0.4]
const PONTOS_DA_COSTURA: readonly number[] = [0.2, 0.4, 0.6, 0.8]

const SEM_BORDA: OpcoesDaPeca = { bisel: 0, contorno: 0 }

/** Retângulo girado `ang` radianos em volta do meio (cx, cy), de meias medidas `mx` e `my`. */
function girado(cx: number, cy: number, mx: number, my: number, ang: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const canto = (x: number, y: number): Ponto => [cx + x * co - y * si, cy + x * si + y * co]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

export const montarBonecoDeTreino: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const mad = c.m.madeira
  const e = Math.min(c.w, c.h) / CASA
  /** A forma desenhada na casa de 56 px, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const L = cena.partes
  const corda = (forma: Forma, eixo: number, semente: number): Peca => P(naPegada(forma), SISAL, { eixo, bisel: 0.6, contorno: 0.2, textura: texDoSisal, semente })
  const fioSolto = (ax: number, ay: number, ang: number, comp: number, i: number): Peca =>
    P(naPegada(capsula(ax, ay, ax + Math.cos(ang) * comp, ay + Math.sin(ang) * comp, 0.45)), FIO, { bisel: 0.3, tom: 0.84 + 0.2 * hash(i, 5, 951), contorno: 0.14, semente: 960 + i })
  /** O talho escuro, a beira dele que pega a luz (em cima) e os dois fios de palha que escapam pela ponta de baixo. */
  const golpe = ([ax, ay, bx, by]: Golpe, k: number): void => {
    const comp = Math.hypot(bx - ax, by - ay)
    // A normal do talho que aponta para cima (de onde vem a luz).
    const sinal = bx > ax ? 1 : -1
    const nx = (sinal * (by - ay)) / comp
    const ny = (-sinal * (bx - ax)) / comp
    const [ox, oy] = [nx * BEIRA_ACIMA_DO_TALHO, ny * BEIRA_ACIMA_DO_TALHO]
    L.push(P(naPegada(capsula(ax + ox, ay + oy, bx + ox, by + oy, 0.34)), BEIRA_DO_TALHO, { ...SEM_BORDA, semente: 968 + k }))
    L.push(P(naPegada(capsula(ax, ay, bx, by, 0.44)), TALHO, { ...SEM_BORDA, semente: 972 + k }))
    FIOS_DO_GOLPE.forEach(([ang, fio], i) => L.push(fioSolto(bx, by - 0.3, ang, fio, 20 + k * 2 + i)))
  }

  // A sombra do boneco em pé: o poste arrastado do chão ao ombro e, soltos, a travessa, o corpo e a cabeça.
  const zOmbro = (CHAO - OMBRO) * e
  cena.sombras.push({ forma: naPegada(caixa(-MEIO_POSTE, CHAO - 1.2, MEIO_POSTE, CHAO + 0.8)), z: zOmbro, forca: 0.3 })
  cena.sombras.push({ forma: naPegada(caixa(-MEIO_BRACO, CHAO - 1.1, MEIO_BRACO, CHAO + 1.1, 1)), z: zOmbro, solta: true, forca: 0.26 })
  for (const f of [0.45, 0.63, 0.82]) cena.sombras.push({ forma: naPegada(elipse(0, CHAO, 9.4, 2.4)), z: zOmbro * f, solta: true, forca: 0.28 })
  cena.sombras.push({ forma: naPegada(elipse(0, CHAO, 6, 2.2)), z: (CHAO - CABECA) * e, solta: true, forca: 0.26 })

  // A base em cruz: cada viga com a face da frente (mais escura, a espessura) e a de cima.
  for (const [k, sobe] of [1, -1].entries()) {
    const viga = (dy: number): Forma => naPegada(barra(-MEIA_VIGA, CHAO + dy - sobe * QUEDA_DA_VIGA, MEIA_VIGA, CHAO + dy + sobe * QUEDA_DA_VIGA, LARGURA_DA_VIGA))
    const eixo = Math.atan2(sobe * QUEDA_DA_VIGA, MEIA_VIGA)
    cena.sombras.push(contato(viga(ESPESSURA_DA_VIGA), 0.28))
    L.push(P(viga(ESPESSURA_DA_VIGA), mad, { eixo, tabua: 0, bisel: 0.8, tom: 0.7, semente: 900 + k }))
    L.push(P(viga(0), mad, { eixo, tabua: 0, bisel: 1, tom: 1.02 - 0.06 * k, semente: 902 + k }))
  }
  // As mãos-francesas: da viga até o poste, uma de cada lado.
  for (const lado of [-1, 1]) {
    const ang = Math.atan2(-11.4, -lado * 8.2)
    L.push(P(naPegada(barra(lado * 10, CHAO - 2.6, lado * 1.8, CHAO - 14, 2.6)), mad, { eixo: ang, tabua: 0, bisel: 0.9, tom: 0.84, semente: 905 + lado }))
  }
  // O poste, do chão até dentro do saco da cabeça.
  L.push(P(naPegada(caixa(-MEIO_POSTE, PESCOCO - 3, MEIO_POSTE, CHAO + 1.2, 0.9)), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 908, projeta: { dist: 1, forca: 0.26 } }))

  // A travessa dos braços, por trás do corpo: os dois entalhes no braço direito e a amarração perto de cada ponta.
  L.push(P(naPegada(caixa(-MEIO_BRACO, OMBRO - MEIA_TRAVESSA, MEIO_BRACO, OMBRO + MEIA_TRAVESSA, 1.1)), mad, { tabua: 0, bisel: 1.4, semente: 910 }))
  for (const [i, x] of ENTALHES.entries()) {
    L.push(P(naPegada(poligono([[x - 1, OMBRO - MEIA_TRAVESSA - 0.2], [x + 1, OMBRO - MEIA_TRAVESSA - 0.2], [x + 0.2, OMBRO - 0.2]])), mad, { ...SEM_BORDA, tabua: 0, tom: 0.5, semente: 912 + i }))
  }
  for (const lado of [-1, 1]) {
    for (const [i, x] of VOLTAS_DO_BRACO.entries()) {
      L.push(corda(capsula(lado * x, OMBRO - MEIA_TRAVESSA - 0.3, lado * x, OMBRO + MEIA_TRAVESSA + 0.3, RAIO_DA_CORDA), QUARTO, 915 + lado * 2 + i))
    }
  }

  // O corpo de palha: os fios soltos por baixo (a palha os cobre na raiz), o feixe, os golpes e as amarras.
  FIOS_SOLTOS.forEach(([x, y, ang, comp], i) => L.push(fioSolto(x, y, ang, comp, i)))
  const cordas = CORDAS_DO_CORPO.map((y) => y * e)
  L.push(P(naPegada(poligono(CORPO)), PALHA, { bisel: 3.2, contorno: 0.24, textura: texDaPalha(cordas, AFUNDADO_DA_CORDA * e, 930), semente: 930, projeta: { dist: 1.2, forca: 0.24 } }))
  GOLPES_NO_CORPO.forEach(golpe)
  CORDAS_DO_CORPO.forEach((y, i) => {
    const meio = MEIO_CORPO_NAS_CORDAS[i] + 0.4
    for (const volta of [-1, 1]) L.push(corda(capsula(-meio, y + volta * ENTRE_AS_VOLTAS, meio, y + volta * ENTRE_AS_VOLTAS, RAIO_DA_CORDA), 0, 935 + i * 2 + volta))
  })
  // O X da amarração da travessa, no peito.
  for (const lado of [-1, 1]) L.push(corda(capsula(-lado * 3.6, OMBRO - 2.4, lado * 3.6, OMBRO + 2.6, RAIO_DA_CORDA + 0.1), Math.atan2(5, lado * 7.2), 941 + lado))

  // A cabeça de saco: a saia do saco abaixo do nó, o saco (largo em cima, estreito no pescoço), a costura com
  // os pontos, o remendo, o golpe e o nó.
  const saia: readonly Ponto[] = [[-3.4, PESCOCO - 0.4], [3.4, PESCOCO - 0.4], [5.6, PESCOCO + 3.8], [2.2, PESCOCO + 2.8], [0, PESCOCO + 4.2], [-2.4, PESCOCO + 3], [-5.6, PESCOCO + 3.8]]
  L.push(P(naPegada(poligono(saia)), LENCOL, { bisel: 0.8, tom: 0.88, contorno: 0.24, semente: 944 }))
  const saco = uniao(elipse(0, CABECA - 1, 6.7, 6.5), elipse(0, CABECA + 3, 5, 4.4))
  L.push(P(naPegada(saco), LENCOL, { bisel: 4.6, ruga: 1, tom: TOM_DO_SACO, contorno: 0.26, semente: 945 }))
  const [xCima, xBaixo] = COSTURA
  const [yCima, yBaixo] = [CABECA - 6.6, CABECA + 6.2]
  L.push(P(naPegada(capsula(xCima, yCima, xBaixo, yBaixo, 0.3)), LINHA_DA_COSTURA, { ...SEM_BORDA, semente: 946 }))
  for (const t of PONTOS_DA_COSTURA) {
    const [x, y] = [xCima + (xBaixo - xCima) * t, yCima + (yBaixo - yCima) * t]
    L.push(P(naPegada(capsula(x - 1.1, y - 0.25, x + 1.1, y + 0.25, 0.28)), LINHA_DA_COSTURA, { ...SEM_BORDA, semente: 947 }))
  }
  L.push(P(naPegada(girado(-3.3, CABECA + 2.6, 1.7, 1.9, 0.25)), LENCOL, { bisel: 0.4, tom: 0.84, contorno: 0.3, semente: 948 }))
  golpe(GOLPE_NA_CABECA, GOLPES_NO_CORPO.length)
  L.push(corda(capsula(-3.9, PESCOCO, 3.9, PESCOCO, 1), 0, 949))
}
