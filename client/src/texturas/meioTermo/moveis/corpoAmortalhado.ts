/**
 * CORPO AMORTALHADO de cima com volume (lote L03 de 24/11/2026, Tortura e
 * fogo; desenho ORIGINAL, só a ideia do "corpo enrolado", da "mortalha", do
 * "corpo sob lençol" e do "fardo embrulhado" dos mapas de referência): um
 * VULTO comprido deitado no chão, enrolado em faixas de PANO CRU e amarrado
 * com CORDAS de cânhamo escuro. Sem rosto, sem mão, sem mancha de sangue: quem
 * conta é o volume (a cabeça redonda numa ponta, o pescoço, os ombros subindo
 * numa rampa só, o corpo afinando até os tornozelos e os dois pés levantando o
 * pano em dois calombos, a ponta arredondada) e as cinco voltas de corda que
 * o apertam. A ponta da corda dos tornozelos fica largada no chão (o fardo foi
 * arrastado até ali).
 *
 * O pano é enrolado em faixas de través, e cada faixa guarda as LISTRAS
 * APAGADAS do tecido de colchão de onde foi rasgada: dois fios azul-acinzentados
 * que somem em manchas (regra do estilo: sem listra gritante). A sujeira é
 * terra, nunca vinho. A corda é ESCURA de propósito: são as voltas dela, lidas
 * a 25%, que separam "corpo amarrado" de "saco".
 *
 * A 25% de zoom sobram o vulto claro e comprido, com a bola da cabeça numa
 * ponta e os ombros logo depois, e os riscos escuros da corda de través: é o
 * que diz "corpo embrulhado", e não saco, tapete enrolado, tora ou sarcófago.
 *
 * NA 3/4 é derivado (`tresQuartos.ts`), com dois PINOS (pontos sem sombra,
 * como a bacia do Braseiro): o do LOMBO sobe o vulto visto de cima; o do
 * FLANCO sobe menos o mesmo contorno, escuro (o pano na sombra), e a parte de
 * baixo dele aparece redonda debaixo do lombo, com as cordas dando a volta.
 * Uma coluna dava uma faixa reta e clara até o chão, e o vulto parecia deitado
 * numa laje. A ponta da corda fica no chão. Nada lê o giro. Sem material
 * escolhido: o pano e a corda são fixos. Os lugares saem de frações da pegada
 * (1,7 x 0,55 casa de partida, a cabeça à esquerda) e as medidas miúdas, do
 * menor lado.
 */
import { limitar01, type Rgb } from '../../ruido'
import { cadeia, capsula, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'
import { comMeioEm, deslocada, pino, solta } from './andaimeDaTresQuartos'

/** A pegada de partida, em casas: as medidas miúdas (px do protótipo) valem nela. */
const COMPRIMENTO_DE_PARTIDA = 1.7
const LARGURA_DE_PARTIDA = 0.55
/**
 * A altura do lombo (o alto do vulto deitado), em casas do menor lado, e a do flanco (o contorno escuro que fica por
 * baixo), em fração dela: o que sobra entre os dois é a faixa de pano na sombra que a 3/4 mostra.
 */
const ALTURA = 0.24
const ALTURA_DO_FLANCO = 0.3

/** Onde o vulto fica na pegada (frações da meia pegada): o meio dele e o meio comprimento. Sobra a ponta da corda à direita. */
const MEIO_DO_VULTO = -0.06
const MEIO_COMPRIMENTO = 0.9

/**
 * O PERFIL do vulto: a meia largura (fração da meia pegada) ao longo do
 * comprimento, de -1 (o alto da cabeça) a 1 (a sola dos pés). Entre dois
 * pontos a largura anda suave, parada em cada ponto: por isso só entram os
 * altos e os baixos (a cabeça, o pescoço, o ombro, os tornozelos, os pés). O
 * ombro sobe numa rampa só desde o pescoço e o corpo afina numa curva só até
 * os tornozelos: com pontos no meio do caminho o ombro saía em degrau e o
 * vulto lia como sarcófago.
 */
const PERFIL: readonly Ponto[] = [
  [-1, 0.16],
  [-0.965, 0.32],
  [-0.89, 0.44],
  [-0.78, 0.38],
  [-0.5, 0.78],
  [0.72, 0.42],
  [0.9, 0.45],
  [0.93, 0.44],
  [0.985, 0.3],
  [1, 0.14],
]
/** Quantos pontos tem cada lado do contorno. */
const PONTOS_DO_CONTORNO = 56

/** As voltas de corda: onde (de -1 a 1 no vulto), quanto a corda entorta (px) e se leva o nó. */
const VOLTAS: readonly { readonly t: number; readonly torta: number; readonly no?: true }[] = [
  { t: -0.75, torta: -0.5 },
  { t: -0.4, torta: 0.8, no: true },
  { t: -0.02, torta: -0.6 },
  { t: 0.4, torta: 0.7 },
  { t: 0.74, torta: -0.4 },
]
/** O raio da corda (px de partida) e quanto ela aperta o pano (a largura do vulto cai isto debaixo dela). */
const RAIO_DA_CORDA = 1.15
const APERTO = 0.06
const LARGURA_DO_APERTO = 0.045

/**
 * Os calombos por cima do pano: onde (x de -1 a 1 no vulto, y em fração da meia largura), os raios (fração do meio
 * comprimento e da meia largura), o giro (rad), o tom e a borda (px de partida). A cabeça; os dois antebraços
 * cruzados no peito (dois calombos compridos e sobrepostos, de borda bem macia: um só lia como disco duro); as coxas;
 * e os dois pés, um de cada lado.
 */
const CALOMBOS: readonly { readonly t: number; readonly y: number; readonly rx: number; readonly ry: number; readonly giro: number; readonly tom: number; readonly borda: number }[] = [
  { t: -0.88, y: -0.05, rx: 0.095, ry: 0.33, giro: 0, tom: 1.06, borda: 2 },
  { t: -0.42, y: -0.08, rx: 0.07, ry: 0.42, giro: 0.4, tom: 1.02, borda: 3.2 },
  { t: -0.35, y: 0.04, rx: 0.07, ry: 0.42, giro: -0.4, tom: 1.02, borda: 3.2 },
  { t: 0.12, y: -0.05, rx: 0.2, ry: 0.36, giro: 0, tom: 1.015, borda: 3 },
  { t: 0.9, y: -0.2, rx: 0.042, ry: 0.15, giro: 0.15, tom: 1.05, borda: 1.6 },
  { t: 0.895, y: 0.17, rx: 0.042, ry: 0.15, giro: -0.15, tom: 1.045, borda: 1.6 },
]

/** O pano cru: linho grosso sem alvejar, com a trama do linho; e o tom dele no flanco, na sombra do próprio corpo. */
const PANO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xbd, 0xae, 0x92] }
const TOM_DO_FLANCO = 0.52
/** O flanco é um fio mais gordo que o vulto (px de partida): visto de cima, é ele que faz o contorno escuro do pano. */
const SOBRA_DO_FLANCO = 0.55
/** O escuro em que o pixel escuro demais é levantado: o pano na sombra (o piso padrão, a nogueira, contornava o pano de castanho vivo). */
const ESCURO_DO_PANO: Rgb = [0x52, 0x49, 0x3c]
/** O fio das listras apagadas (o azul-acinzentado do tecido de colchão) e a terra da sujeira. */
const FIO_DA_LISTRA: Rgb = [0x76, 0x80, 0x8a]
const TERRA: Rgb = [0x8c, 0x79, 0x60]
/** As faixas do pano: a largura (px de partida), o quanto inclinam de través e a sombra da beira de cada uma. */
const LARGURA_DA_FAIXA = 7.4
const INCLINACAO_DAS_FAIXAS = 0.34
const SOMBRA_DA_BEIRA = 0.17
/** As listras: onde ficam dentro da faixa (frações), a meia largura e o quanto tingem no ponto mais vivo. */
const LISTRAS: readonly number[] = [0.5, 0.68]
const MEIA_LISTRA = 0.055
const FORCA_DA_LISTRA = 0.42
/** A sujeira: o quanto a terra tinge nas manchas. */
const FORCA_DA_TERRA = 0.34

/** A corda de cânhamo escuro (o bege de antes sumia no pano), a torção dela e o tom. */
const CANHAMO: MaterialDaPeca = { classe: 'liso', rgb: [0x7e, 0x68, 0x48] }
const TORCAO_DO_CANHAMO: Rgb = [0x5a, 0x48, 0x30]
const TOM_DA_CORDA = 0.85

const DO_TECIDO = texturaDaClasse('tecido')

function suave(t: number): number {
  const x = limitar01(t)
  return x * x * (3 - 2 * x)
}

/** A meia largura do perfil em `t` (fração da meia pegada), com o aperto de cada volta de corda. */
function larguraEm(t: number): number {
  let i = 1
  while (i < PERFIL.length - 1 && PERFIL[i][0] < t) i += 1
  const [t0, w0] = PERFIL[i - 1]
  const [t1, w1] = PERFIL[i]
  let w = w0 + (w1 - w0) * suave((t - t0) / (t1 - t0))
  for (const volta of VOLTAS) {
    const d = Math.abs(t - volta.t) / LARGURA_DO_APERTO
    if (d < 1) w *= 1 - APERTO * (1 - d * d)
  }
  return w
}

/** A curva de três pontos (Bézier de segundo grau) em `n` trechos: a corda largada não faz quina. */
function curva(a: Ponto, b: Ponto, c: Ponto, n: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    const u = 1 - t
    pontos.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]])
  }
  return pontos
}

/**
 * O pano enrolado: a trama do linho, a beira de cada faixa (a de cima faz
 * sombra na de baixo), o tom de cada faixa, as duas listras apagadas e a terra.
 * Tudo pelo lugar no desenho (x, y), para o vulto e os calombos emendarem.
 */
function texDaMortalha(k: number): Textura {
  const co = Math.cos(INCLINACAO_DAS_FAIXAS)
  const si = Math.sin(INCLINACAO_DAS_FAIXAS)
  const largura = LARGURA_DA_FAIXA * k
  return (u, v, x, y, p, s, escala) => {
    if (DO_TECIDO !== null) DO_TECIDO(u, v, x, y, p, s, escala)
    // A beira da faixa ondula um pouco: pano rasgado à mão, não fita.
    const a = (x * co + y * si + ruido(x * 0.06 + 3, y * 0.11 + 11) * 2.2 * k) / largura
    const faixa = Math.floor(a)
    const f = a - faixa
    s[3] += (ruido(faixa * 7.3 + 0.5, 1.5) - 0.05) * 0.1
    if (f < 0.16) s[3] -= SOMBRA_DA_BEIRA * (1 - f / 0.16)
    else if (f < 0.34) s[3] += 0.03
    // As listras somem em manchas: o tecido é velho.
    const apagada = limitar01(0.6 + ruido(x * 0.05 + faixa * 3.1, y * 0.05 + 17) * 2.6)
    for (const centro of LISTRAS) {
      const d = Math.abs(f - centro) / MEIA_LISTRA
      if (d >= 1) continue
      const t = (1 - d * d) * FORCA_DA_LISTRA * apagada
      s[0] += (FIO_DA_LISTRA[0] - s[0]) * t
      s[1] += (FIO_DA_LISTRA[1] - s[1]) * t
      s[2] += (FIO_DA_LISTRA[2] - s[2]) * t
    }
    const mancha = limitar01((ruido(x * 0.085 + 41, y * 0.085 + 5) - 0.12) * 2.6) * FORCA_DA_TERRA
    s[0] += (TERRA[0] - s[0]) * mancha
    s[1] += (TERRA[1] - s[1]) * mancha
    s[2] += (TERRA[2] - s[2]) * mancha
  }
}

/** O cânhamo: a torção em faixas de través, num castanho mais escuro do próprio tom. */
const texCanhamo: Textura = (u, v, _x, _y, _p, s) => {
  const t = limitar01((Math.sin((u * 0.75 + v * 1.25) * 0.95) - 0.3) / 0.7)
  s[0] += (TORCAO_DO_CANHAMO[0] - s[0]) * t
  s[1] += (TORCAO_DO_CANHAMO[1] - s[1]) * t
  s[2] += (TORCAO_DO_CANHAMO[2] - s[2]) * t
  s[3] += ruido(u * 0.6, v * 0.6) * 0.04 + 0.05
}

export const montarCorpoAmortalhado: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw / ((COMPRIMENTO_DE_PARTIDA * G) / 2), hh / ((LARGURA_DE_PARTIDA * G) / 2))
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_PANO
  const xDe = (t: number): number => (MEIO_DO_VULTO + t * MEIO_COMPRIMENTO) * hw
  const tex = texDaMortalha(k)
  const daCorda = (semente: number, raio: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: raio, contorno: 0.3, tom: TOM_DA_CORDA, textura: texCanhamo, semente, ...mais })

  // ---------- o vulto: o contorno pelo perfil, um lado e o outro de volta ----------
  const deCima: Ponto[] = []
  const deBaixo: Ponto[] = []
  for (let i = 0; i <= PONTOS_DO_CONTORNO; i += 1) {
    const t = -1 + (2 * i) / PONTOS_DO_CONTORNO
    const w = larguraEm(t) * hh
    deCima.push([xDe(t), -w])
    deBaixo.push([xDe(t), w])
  }
  const vulto: Forma = poligono([...deCima, ...deBaixo.reverse()])
  const altura = 2 * Math.min(hw, hh) * ALTURA
  const alturaDoFlanco = altura * ALTURA_DO_FLANCO

  // ---------- as sombras: o contato, a do vulto baixo (o contorno e ele mesmo andado até a altura) e os dois pinos da 3/4 ----------
  const pinoDoFlanco: Ponto = [xDe(0), 0]
  const pinoDoLombo: Ponto = [xDe(0) + 1.2 * k, 0]
  cena.sombras.push(
    contato(vulto, 0.34),
    { forma: uniao(vulto, deslocada(vulto, SOMBRA_X * altura, SOMBRA_Y * altura)), z: 0, suave: bordaDaSombra({ z: altura }), forca: 0.3 },
    solta(pino(pinoDoFlanco[0], pinoDoFlanco[1]), alturaDoFlanco),
    solta(pino(pinoDoLombo[0], pinoDoLombo[1]), altura),
  )
  const noFlanco = (p: Peca): Peca => ({ ...p, forma: comMeioEm(p.forma, pinoDoFlanco[0], pinoDoFlanco[1]) })
  const noLombo = (p: Peca): Peca => ({ ...p, forma: comMeioEm(p.forma, pinoDoLombo[0], pinoDoLombo[1]) })

  // ---------- no chão: a ponta da corda dos tornozelos, largada numa volta mole ----------
  const sai: Ponto = [xDe(0.74), larguraEm(0.74) * hh * 0.6]
  const rabicho = cadeia(
    [...curva(sai, [xDe(0.8), hh * 1.02], [xDe(0.97), hh * 0.8], 6), ...curva([xDe(0.97), hh * 0.8], [xDe(1.12), hh * 0.6], [xDe(1.08), hh * 0.1], 6).slice(1)],
    RAIO_DA_CORDA * k * 0.9,
  )
  cena.sombras.push(contato(rabicho, 0.26))
  L.push(P(rabicho, CANHAMO, daCorda(24101, RAIO_DA_CORDA * k * 0.9, { tom: TOM_DA_CORDA * 1.06 })))

  // ---------- o flanco: o mesmo contorno, com o pano na sombra, escondido debaixo do vulto de cima; na 3/4, o lado do corpo, com as cordas dando a volta ----------
  const pano = { tabua: 0, ruga: 0.4, textura: tex }
  const sobra = SOBRA_DO_FLANCO * k
  const flanco: Forma = { b: [vulto.b[0] - sobra, vulto.b[1] - sobra, vulto.b[2] + sobra, vulto.b[3] + sobra], d: (x, y) => vulto.d(x, y) - sobra }
  L.push(noFlanco(P(flanco, PANO, { ...pano, bisel: hh * 0.5, contorno: 0.3, tom: TOM_DO_FLANCO, semente: 24105 })))
  const faixaDoFlanco = altura - alturaDoFlanco
  for (const [i, volta] of VOLTAS.entries()) {
    const x = xDe(volta.t)
    const w = larguraEm(volta.t) * hh
    L.push(noFlanco(P(capsula(x + volta.torta * k, w - faixaDoFlanco - 1.5 * k, x + volta.torta * k * 1.3, w + 0.2 * k, RAIO_DA_CORDA * k), CANHAMO, daCorda(24106 + i, RAIO_DA_CORDA * k, { eixo: QUARTO, tom: TOM_DA_CORDA * 0.78 }))))
  }

  // ---------- o pano: o vulto e os calombos (a cabeça, os antebraços cruzados no peito, as coxas e os dois pés) ----------
  // O contorno do vulto de cima é leve: quem escurece a beira é o flanco, por baixo. Na 3/4 o lombo rola para o flanco sem risco no meio.
  L.push(noLombo(P(vulto, PANO, { ...pano, bisel: hh * 0.4, contorno: 0.1, semente: 24110 })))
  CALOMBOS.forEach((calombo, i) => {
    const forma = elipseGirada(xDe(calombo.t), calombo.y * hh, calombo.rx * MEIO_COMPRIMENTO * hw, calombo.ry * hh, calombo.giro)
    L.push(noLombo(P(forma, PANO, { ...pano, bisel: calombo.ry * hh * 0.9, tom: calombo.tom, contorno: 0, suave: calombo.borda * k, semente: 24111 + i })))
  })
  // O vinco entre as pernas, raso: as duas juntas debaixo do mesmo pano.
  L.push(noLombo(P(capsula(xDe(0.3), hh * 0.03, xDe(0.84), hh * 0.02, 0.7 * k), PANO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, alfa: 0.26, suave: 1.6 * k, semente: 24119 })))

  // ---------- as cordas: cada volta de través, apertando o pano, e o nó com as duas pontas ----------
  VOLTAS.forEach((volta, i) => {
    const x = xDe(volta.t)
    const w = larguraEm(volta.t) * hh + 0.4 * k
    const corda = capsula(x - volta.torta * k, -w, x + volta.torta * k, w, RAIO_DA_CORDA * k)
    L.push(noLombo(P(corda, CANHAMO, daCorda(24120 + i, RAIO_DA_CORDA * k, { eixo: QUARTO, projeta: { dist: 1.1 * k, forca: 0.34 } }))))
    if (volta.no !== true) return
    const no: Ponto = [x, -hh * 0.1]
    const pontas: readonly (readonly Ponto[])[] = [
      curva(no, [no[0] - 2.6 * k, no[1] + 0.6 * k], [no[0] - 3.4 * k, no[1] + 3.6 * k], 4),
      curva(no, [no[0] + 2.8 * k, no[1] + 1 * k], [no[0] + 2.4 * k, no[1] + 4.4 * k], 4),
    ]
    pontas.forEach((caminho, j) => {
      L.push(noLombo(P(cadeia(caminho, RAIO_DA_CORDA * k * 0.75), CANHAMO, daCorda(24130 + j, RAIO_DA_CORDA * k * 0.75, { tom: TOM_DA_CORDA * 1.08, projeta: { dist: 0.8 * k, forca: 0.26 } }))))
    })
    L.push(noLombo(P(elipse(no[0], no[1], 1.7 * k, 1.5 * k), CANHAMO, daCorda(24135, 1.4 * k, { contorno: 0.32, tom: TOM_DA_CORDA * 1.14, projeta: { dist: 0.9 * k, forca: 0.28 } }))))
  })
}
