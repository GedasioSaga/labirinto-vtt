/**
 * ALVO DE ARCO E FLECHA (lote 2 dos objetos novos, 11/11/2026), EM PÉ, de
 * frente como o boneco de treino, a lápide e o quadro de avisos: visto de
 * cima o disco seria um risco e ninguém diria o que é. O CAVALETE de três pés:
 * os dois da frente abertos em A, amarrados com corda no alto, a travessa que
 * segura o disco e o pé de trás, mais escuro, fugindo por baixo dele. O DISCO
 * de palha trançada (a corda de palha enrolada em caracol e costurada, com a
 * grossura aparecendo por cima) tem os anéis pintados em tons contidos, do
 * miolo para fora: ouro velho, tijolo, azul, carvão e cal, e a beira de palha
 * crua; a tinta é gasta, a palha aparece por baixo. As três FLECHAS cravadas
 * saem da frente do disco para quem olha, cada uma com a sombra no disco, as
 * penas de uma cor e a ponta de trás escura.
 *
 * O desenho é feito numa casa de 56 px e escala com o menor lado da pegada;
 * como o boneco, passa da pegada para cima (o alto do cavalete, 0,13 casa). A
 * sombra no chão é a do alvo em pé: a de cada pé, do chão até onde cai a
 * sombra do alto do cavalete, e a do disco, deitada. A 25% de zoom sobram a
 * roda com os anéis e o A dos pés. A palha, a tinta, a corda e as flechas são
 * fixas. Material: `madeira` (o cavalete).
 */
import { hash, type Rgb } from '../../ruido'
import { barra, capsula, dentroDe, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, type MontarMovel } from './contexto'

/** O lado da casa em que o alvo é desenhado (px do protótipo). */
const CASA = 56

// O cavalete, em x e y da casa (0 no meio, para baixo cresce).
/** O alto, onde os pés se encontram, e o chão dos dois pés da frente. */
const ALTO = -35.5
const CHAO = 23.5
/** O quanto cada pé da frente abre para o lado, e onde o pé de trás pisa (mais para cima na tela: está atrás). */
const ABERTURA = 22.5
const PE_DE_TRAS: Ponto = [4.5, 18.5]
/** De onde o pé de trás sai, já escondido atrás do disco. */
const SAIDA_DO_PE_DE_TRAS: Ponto = [1, ALTO + 6]
/** Onde cai, no chão, a sombra do alto do cavalete: a sombra de cada pé vai do pé até aqui. */
const SOMBRA_DO_ALTO: Ponto = [13.5, CHAO + 4.5]
/** A largura dos pés e da travessa. */
const LARGURA_DO_PE = 3.3
const LARGURA_DA_TRAVESSA = 2.5

// O disco.
/** O meio e o raio do disco; visto um pouco de cima ele achata e mostra a grossura (o disco de trás, mais alto). */
const MEIO_DO_DISCO = -7.5
const RAIO = 20.5
const ACHATADO = 0.975
const GROSSURA = 2.4
/** A travessa fica logo abaixo do disco, que apoia nela. */
const TRAVESSA = MEIO_DO_DISCO + RAIO * ACHATADO + LARGURA_DA_TRAVESSA / 2 + 0.3

/** A palha do disco: o amarelo-palha contido do boneco de treino e do feno. */
const PALHA: MaterialDaPeca = { classe: 'palha', rgb: [0xc4, 0xa7, 0x69] }
/** A tinta dos anéis, do miolo para fora, todos baixos (saturação até 0,5). */
const OURO: Rgb = [0xcd, 0xad, 0x66]
const TIJOLO: Rgb = [0xa5, 0x5c, 0x50]
const AZUL: Rgb = [0x58, 0x76, 0x96]
const CARVAO: Rgb = [0x4c, 0x49, 0x46]
const CAL: Rgb = [0xe0, 0xd8, 0xc4]
/** Onde cada anel acaba, em fração do raio; dali para fora, a palha crua. */
const ANEIS: readonly (readonly [number, Rgb])[] = [
  [0.2, OURO],
  [0.4, TIJOLO],
  [0.6, AZUL],
  [0.79, CARVAO],
  [0.93, CAL],
]
/** Quanto da cor é tinta onde ela está inteira e quanto ela perde onde gastou. */
const TINTA_INTEIRA = 0.9
const TINTA_GASTA = 0.26
/** A corda de palha enrolada: a largura de uma volta e o passo dos pontos da costura (px da casa). */
const VOLTA = 1.9
const PONTO_DA_COSTURA = 2.7
/** O quanto o ponto da costura deita de um lado ao outro da volta, em pontos. */
const INCLINACAO_DO_PONTO = 0.55
/** Abaixo desta escala (pixels da imagem por px do protótipo) a volta cai em menos de 3 pixels: a trança fica com menos contraste. */
const ESCALA_DA_TRANCA_INTEIRA = 1.5
const CONTRASTE_DA_TRANCA_MIUDA = 0.35

function limitar01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/**
 * A palha trançada do disco de meio (cx, cy) e raio `raio` (px da cena): as
 * voltas da corda de palha, cada uma redonda, com os pontos da costura e uma
 * luz por trecho. `pintado`: os anéis de tinta gasta por cima.
 */
function texDoDisco(cx: number, cy: number, raio: number, e: number, pintado: boolean): Textura {
  const larguraDaVolta = VOLTA * e
  return (_u, _v, x, y, p, s, escala) => {
    const dx = x - cx
    const dy = (y - cy) / ACHATADO
    const dist = Math.sqrt(dx * dx + dy * dy)
    const ang = Math.atan2(dy, dx)
    const volta = dist / larguraDaVolta
    const k = Math.floor(volta)
    // O ponto da costura anda pelo arco da volta, deitado como a torção da corda; cada volta começa num lugar.
    const ponto = (ang * (k + 0.5) * VOLTA) / PONTO_DA_COSTURA + (volta - k) * INCLINACAO_DO_PONTO + hash(k, 3, 921) * 7
    const j = Math.floor(ponto)
    let luz = (Math.sin((volta - k) * Math.PI) - 0.64) * 0.2 + (hash(k, j, 922) - 0.5) * 0.07
    if (ponto - j < 0.2) luz -= 0.07
    s[3] += (escala < ESCALA_DA_TRANCA_INTEIRA ? luz * CONTRASTE_DA_TRANCA_MIUDA : luz) + ruido(x * 0.09 + p.su, y * 0.09) * 0.06
    if (!pintado) return
    // A beira de cada anel treme um pouco: foi pintada à mão.
    const r = dist / raio + ruido(ang * 2.4 + 5, dist * 0.21) * 0.014
    const anel = ANEIS.find(([fim]) => r < fim)
    if (anel === undefined) return
    const tinta = anel[1]
    const quanto = TINTA_INTEIRA - TINTA_GASTA * limitar01(ruido(x * 0.42 + p.su, y * 0.42 + p.sv) * 2.4 - 0.1)
    s[0] += (tinta[0] - s[0]) * quanto
    s[1] += (tinta[1] - s[1]) * quanto
    s[2] += (tinta[2] - s[2]) * quanto
  }
}

/** A corda da amarra do alto: sisal escuro com a torção em diagonal (a do boneco de treino). */
const SISAL: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x70, 0x4a] }
const TORCAO_DO_SISAL: Rgb = [0x6e, 0x58, 0x3a]
const texDoSisal: Textura = (u, v, _x, _y, _p, s) => {
  const t = limitar01((Math.sin((u * 0.8 + v * 1.4) * 1.1) - 0.2) / 0.8)
  s[0] += (TORCAO_DO_SISAL[0] - s[0]) * t
  s[1] += (TORCAO_DO_SISAL[1] - s[1]) * t
  s[2] += (TORCAO_DO_SISAL[2] - s[2]) * t
}

/** A haste da flecha (freixo claro) e as três cores de pena; o furo e a ponta de trás são o escuro de `BURACO`. */
const HASTE: MaterialDaPeca = { classe: 'liso', rgb: [0xcf, 0xb3, 0x86] }
const PENA_VINHO: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x4a, 0x4a] }
const PENA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xdc, 0xca] }
const PENA_AZUL: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x78, 0x92] }
/** O raio da haste, o comprimento das penas, o quanto elas abrem para o lado e a distância delas à ponta de trás (px da casa). */
const RAIO_DA_HASTE = 0.55
const COMPRIMENTO_DA_PENA = 4.2
const ABERTURA_DA_PENA = 2.1
const DEPOIS_DA_PENA = 0.9
/**
 * A sombra da flecha no disco: sai do furo para baixo à direita, este tanto
 * por px de haste que se vê. A haste vem para quem olha e a sombra foge para o
 * lado: são as duas juntas que dizem que a flecha está cravada, e não deitada.
 */
const SOMBRA_DA_FLECHA: Ponto = [0.58, 0.44]
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }

/** Uma flecha cravada: onde entrou no disco (x, y da casa), para onde a haste vem (radianos; 1,57 = para baixo) e o comprimento que se vê. */
interface Flecha {
  readonly x: number
  readonly y: number
  readonly ang: number
  readonly comp: number
  readonly pena: MaterialDaPeca
}
/** Uma perto do miolo, uma no azul e uma quase fora: quem atirou ainda está treinando. */
const FLECHAS: readonly Flecha[] = [
  { x: -3.2, y: -10.6, ang: 1.36, comp: 10, pena: PENA_VINHO },
  { x: 9.4, y: -3.6, ang: 1.74, comp: 9, pena: PENA_CLARA },
  { x: -12.4, y: 1.6, ang: 1.5, comp: 8.6, pena: PENA_AZUL },
]

export const montarAlvoDeArcoEFlecha: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const mad = c.m.madeira
  const e = Math.min(c.w, c.h) / CASA
  /** A forma desenhada na casa de 56 px, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const L = cena.partes
  /** O x do pé da frente (lado -1 ou 1) na altura `y`. */
  const xDoPe = (lado: number, y: number): number => (lado * ABERTURA * (y - ALTO)) / (CHAO - ALTO)

  // A sombra do alvo em pé: a de cada pé vai do chão até onde cai a sombra do alto do cavalete; a do disco, deitada.
  const pes: readonly Ponto[] = [[-ABERTURA, CHAO], [ABERTURA, CHAO], PE_DE_TRAS]
  for (const [x, y] of pes) {
    cena.sombras.push({ forma: naPegada(capsula(x, y, SOMBRA_DO_ALTO[0], SOMBRA_DO_ALTO[1], 1.2)), z: 0, suave: 1.6, forca: 0.2 })
    cena.sombras.push(contato(naPegada(elipse(x, y + 0.4, 2.6, 1.3)), 0.3))
  }
  cena.sombras.push({ forma: naPegada(elipseGirada(9, CHAO + 2.6, RAIO * 0.92, 4.6, 0.2)), z: 0, suave: 2.4, forca: 0.24 })

  // O pé de trás, na sombra, e os dois da frente, do alto até o chão.
  const eixoDeTras = Math.atan2(PE_DE_TRAS[1] - SAIDA_DO_PE_DE_TRAS[1], PE_DE_TRAS[0] - SAIDA_DO_PE_DE_TRAS[0])
  L.push(P(naPegada(barra(...SAIDA_DO_PE_DE_TRAS, ...PE_DE_TRAS, LARGURA_DO_PE * 0.86)), mad, { eixo: eixoDeTras, tabua: 0, bisel: 1, tom: 0.7, semente: 940 }))
  for (const lado of [-1, 1]) {
    const eixo = Math.atan2(CHAO - ALTO, lado * ABERTURA)
    L.push(P(naPegada(barra(lado * 0.9, ALTO, lado * ABERTURA, CHAO + 0.8, LARGURA_DO_PE)), mad, { eixo, tabua: 0, bisel: 1.2, tom: lado < 0 ? 1.02 : 0.94, semente: 942 + lado }))
  }
  // A amarra do alto: três voltas de corda por cima dos dois pés.
  for (let k = 0; k < 3; k += 1) {
    const y = ALTO + 2.4 + k * 1.5
    const meio = Math.abs(xDoPe(1, y)) + LARGURA_DO_PE * 0.62
    L.push(P(naPegada(capsula(-meio, y, meio, y - 0.3, 0.85)), SISAL, { eixo: 0, bisel: 0.7, contorno: 0.18, textura: texDoSisal, semente: 945 + k }))
  }
  // A travessa, que passa um pouco dos pés, com um prego de madeira em cada cruzamento.
  const meiaTravessa = Math.abs(xDoPe(1, TRAVESSA)) + 2.6
  L.push(P(naPegada(barra(-meiaTravessa, TRAVESSA, meiaTravessa, TRAVESSA, LARGURA_DA_TRAVESSA)), mad, { tabua: 0, bisel: 1, tom: 0.9, semente: 948, projeta: { dist: 0.9, forca: 0.26 } }))
  for (const lado of [-1, 1]) L.push(P(naPegada(elipse(xDoPe(lado, TRAVESSA), TRAVESSA, 0.75, 0.75)), mad, { tabua: 0, bisel: 0.6, tom: 0.6, contorno: 0.1, semente: 949 }))

  // O disco: a grossura por trás (a palha crua, mais escura) e a frente pintada.
  const ry = RAIO * ACHATADO
  L.push(P(naPegada(elipse(0, MEIO_DO_DISCO - GROSSURA, RAIO, ry)), PALHA, { bisel: 1.2, tom: 0.72, contorno: 0.28, textura: texDoDisco(0, (MEIO_DO_DISCO - GROSSURA) * e, RAIO * e, e, false), semente: 950 }))
  L.push(P(naPegada(elipse(0, MEIO_DO_DISCO, RAIO, ry)), PALHA, { bisel: 1.5, contorno: 0.26, textura: texDoDisco(0, MEIO_DO_DISCO * e, RAIO * e, e, true), semente: 951, projeta: { dist: 1.4, forca: 0.26 } }))

  // As flechas: a sombra no disco, o furo, a haste, as duas penas que se veem e a ponta de trás.
  const frente = elipse(0, MEIO_DO_DISCO, RAIO - 0.6, ry - 0.6)
  for (const f of FLECHAS) {
    const co = Math.cos(f.ang)
    const si = Math.sin(f.ang)
    /** O ponto a `t` px do furo ao longo da haste e `n` px para o lado. */
    const em = (t: number, n: number): Ponto => [f.x + co * t - si * n, f.y + si * t + co * n]
    const [fimX, fimY] = em(f.comp, 0)
    const sombra = capsula(f.x, f.y, f.x + SOMBRA_DA_FLECHA[0] * f.comp, f.y + SOMBRA_DA_FLECHA[1] * f.comp, 0.6)
    L.push(P(naPegada(dentroDe(sombra, frente)), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.38, suave: 0.9 }))
    L.push(P(naPegada(elipse(f.x, f.y, 1, 0.8)), BURACO, { bisel: 0, contorno: 0, alfa: 0.7 }))
    L.push(P(naPegada(capsula(f.x, f.y, fimX, fimY, RAIO_DA_HASTE)), HASTE, { bisel: 0.5, contorno: 0.24 }))
    const pena0 = f.comp - DEPOIS_DA_PENA - COMPRIMENTO_DA_PENA
    const pena1 = f.comp - DEPOIS_DA_PENA
    for (const lado of [-1, 1]) {
      const forma = poligono([em(pena0, 0), em(pena0 + 1.6, lado * ABERTURA_DA_PENA), em(pena1 + 0.5, lado * ABERTURA_DA_PENA), em(pena1, 0)])
      L.push(P(naPegada(forma), f.pena, { bisel: 0.4, contorno: 0.24, tom: lado < 0 ? 1.04 : 0.9 }))
    }
    L.push(P(naPegada(capsula(...em(pena0, 0), fimX, fimY, RAIO_DA_HASTE * 0.8)), HASTE, { bisel: 0.4, contorno: 0.16, tom: 0.92 }))
    L.push(P(naPegada(elipse(fimX, fimY, 0.75, 0.75)), BURACO, { bisel: 0.5, contorno: 0 }))
  }
}
