/**
 * CARACOL-TELEFONE de cima com volume (lote L07 dos objetos de 14/11/2026, grupo Mar e piratas; pedido do
 * mestre: "caracol com fone nas costas (comum, câmera, dourado)"). Inspirado no caracol que serve de telefone
 * em One Piece, com desenho próprio: um caracol de jardim visto do alto, de cabeça para a direita, com a CASCA
 * em espiral nas costas e, por cima dela, o aparelho.
 *
 * - O CORPO aparece em dois pedaços, a cauda que afina atrás e a cabeça na frente, com os dois TENTÁCULOS dos
 *   olhos abertos em V (o olho é uma bola clara com a pupila olhando para a frente) e as duas anteninhas de
 *   baixo, curtas. A pele é cor de areia, com manchas.
 * - A CASCA é um domo com a ESPIRAL marcada: o sulco escuro e, entre uma volta e outra, a volta que rola (mais
 *   clara no meio, mais escura perto do sulco), em espiral logarítmica que abre para fora, como na casca de
 *   verdade. O ápice fica para trás e para baixo, longe do aparelho, para a espiral continuar à vista.
 * - COMUM: o FONE escuro deitado de través em cima da casca (as duas conchas redondas e o cabo), o FIO em
 *   espiral que desce do fone e some na beira da casca, e o DISCO de discar de marfim com os seis furos.
 * - CÂMERA: no lugar do fone, a CAIXA de couro escuro com a LENTE grande virada para cima (o aro de latão, o
 *   vidro azul-escuro com os anéis e o brilho), o visor e o botão.
 * - DOURADO: o desenho do comum com a casca de ouro (metal, com brilho) e o fone vermelho-escuro de aros
 *   dourados.
 *
 * A 1x sobram a espiral da casca, o V dos olhos e o haltere escuro do fone (ou o círculo da lente): é o que diz
 * "caracol com telefone". O desenho é feito na pegada de partida (0,6 x 0,45 casa) e escala inteiro com o
 * menor lado: esticado, o caracol cresce sem deformar.
 *
 * EM PÉ na 3/4 (como a bigorna e a fruta): a casca é um domo que encosta no corpo, e o perfil derivado a
 * varria num pote alto debaixo do domo (a primeira folha mostrou). Sem material escolhido: tudo é fixo. As
 * variantes são os arquivos `caracolTelefoneCamera.ts` e `caracolTelefoneDourado.ts`, que chamam
 * `montarCaracol`.
 */
import { hash } from '../../ruido'
import { anel, cadeia, caixa, capsula, dentroDe, elipse, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { G, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'

export type VersaoDoCaracol = 'comum' | 'camera' | 'dourado'

// ---------- as medidas (px do protótipo na pegada de partida; x para a frente, y para baixo) ----------

/** A pegada de partida: o desenho tem o tamanho de desenho nela e escala inteiro com o menor lado. */
const LARGURA_DE_PARTIDA = 0.6 * G
const FUNDO_DE_PARTIDA = 0.45 * G
/** As alturas, em casas: o corpo rente, os olhos no alto dos tentáculos e o alto da casca. */
const ALTURA_DO_CORPO = 0.07
const ALTURA_DOS_OLHOS = 0.15
const ALTURA_DA_CASCA = 0.3

/** A casca: o meio e os raios. */
const CASCA_X = -2.4
const CASCA_Y = -0.4
const CASCA_RX = 10
const CASCA_RY = 9.6
/** O domo: o chanfro largo é o que arredonda a casca. */
const BISEL_DA_CASCA = 4.2
/** A espiral: o ápice (atrás e embaixo), o raio no ápice, o quanto ela abre por radiano e até onde vai. */
const APICE_X = -5.8
const APICE_Y = 1
const RAIO_DO_APICE = 0.7
const ABERTURA = 0.172
const RAIO_FINAL = 8.8
const GIRO_DA_ESPIRAL = 2.2
const PASSO_DA_ESPIRAL = 0.2
/** O sulco e a volta que rola entre dois sulcos (luz somada no meio da volta, tirada perto do sulco). */
const SULCO = 0.62
const LUZ_DA_VOLTA = 0.11
const VOLTA = Math.PI * 2

/** A boca na ponta da cabeça: o meio do arco, o raio e a meia abertura (radianos). */
const BOCA_X = 12.1
const BOCA_Y = 0.4
const RAIO_DA_BOCA = 2.6
const ABERTURA_DA_BOCA = 0.8

/** O fone: o meio, o rumo do cabo (quase de pé na tela, tombado para a direita), meio comprimento e as conchas. */
const FONE_X = 1.6
const FONE_Y = -0.4
const RUMO_DO_FONE = Math.PI / 2 - 0.35
const MEIO_FONE = 7.2
const RAIO_DA_CONCHA = 3.1
const MEIO_CABO = 6
const RAIO_DO_CABO = 1.75
/** O fio enrolado: as voltas, a largura da volta e a grossura. */
const VOLTAS_DO_FIO = 7
const LARGURA_DA_VOLTA = 1
const RAIO_DO_FIO = 0.55
/** O disco de discar: o meio, o raio de fora, o de dentro e o raio dos seis furos. */
const DISCO_X = 4.6
const DISCO_Y = -5.2
const RAIO_DO_DISCO = 2.3
const MIOLO_DO_DISCO = 0.85
const RAIO_DOS_FUROS = 1.55
const FUROS = 6

/** As pintas de lodo seco na casca. */
const PINTAS_DE_LODO = 3

/** A sombra que o aparelho faz na casca. */
const SOMBRA_NA_CASCA: Projecao = { dist: 1.3, forca: 0.4, suave: 0.8 }

// ---------- as cores ----------

/** A pele: areia quente, com manchas mais escuras. */
const PELE: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xad, 0x86] }
/** O olho: a bola clara, a pupila escura e o brilho. */
const OLHO: MaterialDaPeca = { classe: 'liso', rgb: [0xe8, 0xe2, 0xd2] }
const PUPILA: MaterialDaPeca = { classe: 'liso', rgb: [0x3c, 0x33, 0x2c] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf4, 0xf0, 0xe6] }
/** A casca comum: caramelo, e a casca dourada, ouro velho (metal: pega o brilho da luz). */
const CASCA_COMUM: MaterialDaPeca = { classe: 'liso', rgb: [0xa3, 0x76, 0x4b] }
const CASCA_DOURADA: MaterialDaPeca = { classe: 'metal', rgb: [0xbe, 0xa2, 0x64] }
/**
 * O fone comum (grafite) e o do dourado (vinho, com os aros de ouro). O vermelho mais vivo da segunda folha
 * (#7c332e, saturação HSV 0,63) punha a saturação p95 do dourado em 0,626, acima do teto de 0,62.
 */
const FONE_COMUM: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x47, 0x44] }
const FONE_VERMELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x3e, 0x38] }
const MARFIM: MaterialDaPeca = { classe: 'liso', rgb: [0xe0, 0xd6, 0xbe] }
const LATAO: MaterialDaPeca = materialDaPeca('latao')
/** A câmera: o couro da caixa, o vidro da lente e o do visor. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x4b, 0x42] }
const LENTE: MaterialDaPeca = { classe: 'liso', rgb: [0x34, 0x45, 0x56] }
const VISOR: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0xaa, 0xb2] }
const BOTAO: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x45, 0x3a] }

interface Versao {
  readonly casca: MaterialDaPeca
  /** O aparelho nas costas: o fone (com a cor dele e o aro das conchas) ou a câmera. */
  readonly fone: MaterialDaPeca | null
  readonly aroDaConcha: MaterialDaPeca | null
  /** Força do brilho da casca (o ouro brilha mais). */
  readonly brilho: number
}

const VERSOES: Readonly<Record<VersaoDoCaracol, Versao>> = {
  comum: { casca: CASCA_COMUM, fone: FONE_COMUM, aroDaConcha: null, brilho: 0.34 },
  camera: { casca: CASCA_COMUM, fone: null, aroDaConcha: null, brilho: 0.34 },
  dourado: { casca: CASCA_DOURADA, fone: FONE_VERMELHO, aroDaConcha: CASCA_DOURADA, brilho: 0.5 },
}

// ---------- texturas ----------

/** A pele: o grão miúdo e as manchas largas, mais escuras. */
const texDaPele: Textura = (_u, _v, x, y, p, s) => {
  const mancha = ruido(x * 0.42 + p.su, y * 0.42 + p.sv)
  s[3] += ruido(x * 1.1 + p.sv, y * 1.1) * 0.05 + (mancha > 0.28 ? -0.09 : 0)
}

/**
 * A casca: cada volta da espiral rola (clara no meio, escura perto do sulco) e tem as estrias de crescimento,
 * de través. A fase de um ponto é quantas voltas ele está do sulco: na espiral logarítmica, o raio de um
 * ponto diz a volta e o ângulo diz onde nela.
 */
function texDaCasca(ax: number, ay: number, k: number, classe: MaterialDaPeca['classe']): Textura {
  const base = texturaDaClasse(classe)
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    const dx = x - ax
    const dy = y - ay
    const rho = Math.hypot(dx, dy) / k
    if (rho < RAIO_DO_APICE) return
    const theta = Math.atan2(dy, dx)
    const fase = (Math.log(rho / RAIO_DO_APICE) / ABERTURA + GIRO_DA_ESPIRAL - theta) / VOLTA
    const f = fase - Math.floor(fase)
    s[3] += -Math.cos(f * VOLTA) * LUZ_DA_VOLTA + Math.sin(theta * 34 + rho * 0.6) * 0.025
  }
}

/** A lente: anéis que alternam claro e escuro do aro para o meio, e o fundo mais escuro. */
function texDaLente(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = Math.hypot(x - cx, y - cy) / r
    s[3] += Math.cos(t * 9) * 0.07 - (1 - t) * 0.12
  }
}

// ---------- as peças ----------

/** Os pontos da espiral logarítmica, do ápice para fora (px já escalados). */
function pontosDaEspiral(ax: number, ay: number, k: number, recua: number): Ponto[] {
  const fim = Math.log(RAIO_FINAL / RAIO_DO_APICE) / ABERTURA
  const pontos: Ponto[] = []
  for (let t = 0; t <= fim; t += PASSO_DA_ESPIRAL) {
    const r = RAIO_DO_APICE * Math.exp(ABERTURA * t) * k * recua
    pontos.push([ax + r * Math.cos(t + GIRO_DA_ESPIRAL), ay + r * Math.sin(t + GIRO_DA_ESPIRAL)])
  }
  return pontos
}

interface Desenho {
  readonly c: ContextoDoMovel
  readonly L: Peca[]
  /** O ponto de desenho (px de partida) no px da pegada. */
  readonly em: (x: number, y: number) => Ponto
  readonly k: number
}

function montarCorpo(d: Desenho, corpo: Forma): void {
  const { c, L, k, em } = d
  const P = c.peca
  L.push(P(corpo, PELE, { bisel: 1.8 * k, contorno: 0.24, textura: texDaPele, semente: 7101 }))
  // A boca, um sorriso na ponta da cabeça: é o que dá cara ao caracol.
  const boca: Ponto[] = []
  for (let a = -ABERTURA_DA_BOCA; a <= ABERTURA_DA_BOCA; a += 0.1) boca.push(em(BOCA_X + Math.cos(a) * RAIO_DA_BOCA, BOCA_Y + Math.sin(a) * RAIO_DA_BOCA))
  L.push(P(cadeia(boca, 0.32 * k), PUPILA, { bisel: 0, contorno: 0, alfa: 0.55, semente: 7104 }))
  // As anteninhas de baixo, curtas, na ponta da cabeça.
  for (const lado of [-1, 1]) {
    L.push(P(capsula(...em(14.6, lado * 1.3 + 0.3), ...em(16.2, lado * 2.2 + 0.3), 0.6 * k), PELE, { bisel: 0.5 * k, contorno: 0.24, tom: 0.92, semente: 7103 }))
  }
}

/** Os tentáculos dos olhos, abertos em V, e os olhos olhando para a frente. */
function montarOlhos(d: Desenho, tentaculos: readonly (readonly [Ponto, Ponto])[]): void {
  const { c, L, k } = d
  const P = c.peca
  for (const [i, [pe, ponta]] of tentaculos.entries()) {
    L.push(P(capsula(...pe, ...ponta, 0.95 * k), PELE, { bisel: 0.8 * k, contorno: 0.26, tom: 0.96, textura: texDaPele, semente: 7110 + i }))
    L.push(P(elipse(...ponta, 1.7 * k, 1.7 * k), OLHO, { bisel: 1 * k, contorno: 0.3, semente: 7112 + i }))
    L.push(P(elipse(ponta[0] + 0.6 * k, ponta[1], 0.85 * k, 0.85 * k), PUPILA, { bisel: 0.3 * k, contorno: 0, semente: 7114 + i }))
    L.push(P(elipse(ponta[0] - 0.5 * k, ponta[1] - 0.55 * k, 0.4 * k, 0.4 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.9 }))
  }
}

function montarCasca(d: Desenho, v: Versao, casca: Forma): void {
  const { c, L, k, em } = d
  const P = c.peca
  const [ax, ay] = em(APICE_X, APICE_Y)
  L.push(P(casca, v.casca, { bisel: BISEL_DA_CASCA * k, contorno: 0.28, tabua: 0, textura: texDaCasca(ax, ay, k, v.casca.classe), projeta: { dist: 1.6 * k, forca: 0.36, suave: 1.2 * k }, semente: 7120 }))
  // O sulco da espiral e, logo dentro dele, a quina da volta que pega a luz; os dois só dentro da casca.
  const dentro = elipse(...em(CASCA_X, CASCA_Y), (CASCA_RX - 1) * k, (CASCA_RY - 1) * k)
  const sulco: MaterialDaPeca = { classe: v.casca.classe, rgb: v.casca.rgb }
  L.push(P(dentroDe(cadeia(pontosDaEspiral(ax, ay, k, 1), 0.6 * k), dentro), sulco, { tabua: 0, bisel: 0.4 * k, contorno: 0, tom: SULCO, semente: 7121 }))
  L.push(P(dentroDe(cadeia(pontosDaEspiral(ax, ay, k, 0.9), 0.35 * k), dentro), sulco, { tabua: 0, bisel: 0, contorno: 0, tom: 1.22, alfa: 0.7, semente: 7122 }))
  // O brilho do domo, para cima à esquerda.
  L.push(P(elipse(...em(CASCA_X - 4, CASCA_Y - 4.2), 3.4 * k, 2.4 * k), BRILHO, { bisel: 0, contorno: 0, alfa: v.brilho, suave: 1.6 * k }))
}

/** O fone deitado em cima da casca, o fio enrolado e o disco de discar. Devolve a forma do fio (o contato no chão). */
function montarFone(d: Desenho, v: Versao, fone: MaterialDaPeca): Forma {
  const { c, L, k, em } = d
  const P = c.peca
  const ex = Math.cos(RUMO_DO_FONE)
  const ey = Math.sin(RUMO_DO_FONE)
  const aoLongo = (s: number, lado = 0): Ponto => em(FONE_X + ex * s - ey * lado, FONE_Y + ey * s + ex * lado)
  const r = RAIO_DA_CONCHA * k

  // O disco de discar, de marfim, com os seis furos e o miolo de latão.
  const [dx, dy] = em(DISCO_X, DISCO_Y)
  L.push(P(elipse(dx, dy, RAIO_DO_DISCO * k, RAIO_DO_DISCO * k), MARFIM, { bisel: 0.8 * k, contorno: 0.3, projeta: SOMBRA_NA_CASCA, semente: 7130 }))
  for (let i = 0; i < FUROS; i += 1) {
    const a = -2.2 + (i * VOLTA * 0.8) / FUROS
    L.push(P(elipse(dx + Math.cos(a) * RAIO_DOS_FUROS * k, dy + Math.sin(a) * RAIO_DOS_FUROS * k, 0.42 * k, 0.42 * k), PUPILA, { bisel: 0, contorno: 0, alfa: 0.85 }))
  }
  L.push(P(elipse(dx, dy, MIOLO_DO_DISCO * k, MIOLO_DO_DISCO * k), LATAO, { bisel: 0.6 * k, contorno: 0.2, semente: 7131 }))

  // O fio: sai da concha de baixo, desce pela beira da casca e fica enrolado no chão, ao lado do caracol.
  const [ix, iy] = aoLongo(MEIO_FONE + 1.4)
  const [mx, my] = em(6.4, 12.6)
  const [fx, fy] = em(-5.6, 11.2)
  const fio: Ponto[] = []
  const passos = VOLTAS_DO_FIO * 6
  for (let i = 0; i <= passos; i += 1) {
    const t = i / passos
    const bx = (1 - t) * (1 - t) * ix + 2 * t * (1 - t) * mx + t * t * fx
    const by = (1 - t) * (1 - t) * iy + 2 * t * (1 - t) * my + t * t * fy
    const tx = 2 * (1 - t) * (mx - ix) + 2 * t * (fx - mx)
    const ty = 2 * (1 - t) * (my - iy) + 2 * t * (fy - my)
    const l = Math.hypot(tx, ty) || 1
    const onda = Math.sin(t * VOLTAS_DO_FIO * VOLTA) * LARGURA_DA_VOLTA * k
    fio.push([bx - (ty / l) * onda, by + (tx / l) * onda])
  }
  const formaDoFio = cadeia(fio, RAIO_DO_FIO * k)
  L.push(P(formaDoFio, fone, { bisel: 0.35 * k, contorno: 0.3, tom: 1.08, projeta: { dist: 0.8 * k, forca: 0.3, suave: 0.5 * k }, semente: 7132 }))

  // O fone: as duas conchas e o cabo numa peça só (um contorno por fora), com a sombra na casca.
  const formaDoFone = uniao(uniao(elipse(...aoLongo(-MEIO_FONE), r, r), elipse(...aoLongo(MEIO_FONE), r, r)), capsula(...aoLongo(-MEIO_CABO), ...aoLongo(MEIO_CABO), RAIO_DO_CABO * k))
  L.push(P(formaDoFone, fone, { bisel: 1.1 * k, contorno: 0.32, projeta: SOMBRA_NA_CASCA, semente: 7133 }))
  // O fundo de cada concha, rebaixado, e o aro (de ouro no dourado).
  for (const s of [-MEIO_FONE, MEIO_FONE]) {
    const [cx, cy] = aoLongo(s)
    if (v.aroDaConcha !== null) L.push(P(anel(cx, cy, r * 0.92, r * 0.92, r * 0.66, r * 0.66), v.aroDaConcha, { bisel: 0.4 * k, contorno: 0.18, semente: 7134 }))
    L.push(P(elipse(cx, cy, r * 0.62, r * 0.62), fone, { bisel: 0.3 * k, contorno: 0, tom: 0.78, recesso: { k: 1.4, forca: 0.3 }, semente: 7135 }))
  }
  // O brilho comprido do cabo, do lado da luz.
  L.push(P(capsula(...aoLongo(-MEIO_CABO + 0.6, -0.8), ...aoLongo(MEIO_CABO - 0.6, -0.8), 0.42 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 0.3 * k }))
  return formaDoFio
}

/** A câmera: a caixa de couro com a lente grande virada para cima, o visor e o botão. */
function montarCamera(d: Desenho): void {
  const { c, L, k, em } = d
  const P = c.peca
  const caixaDaCamera = caixa(...em(-3.8, -5.4), ...em(5.8, 4.6), 1.6 * k)
  L.push(P(caixaDaCamera, COURO, { bisel: 1.2 * k, contorno: 0.3, tabua: 0, projeta: SOMBRA_NA_CASCA, semente: 7140 }))
  // A chapa de latão por cima da caixa, de onde a lente sai.
  L.push(P(caixa(...em(-3.2, -4.8), ...em(5.2, -3), 0.6 * k), LATAO, { bisel: 0.5 * k, contorno: 0.2, semente: 7141 }))
  L.push(P(caixa(...em(-2.7, -4.5), ...em(-0.7, -3.3), 0.3 * k), VISOR, { bisel: 0.3 * k, contorno: 0.24, semente: 7142 }))
  L.push(P(elipse(...em(4.1, -3.9), 0.75 * k, 0.75 * k), BOTAO, { bisel: 0.5 * k, contorno: 0.24, semente: 7143 }))
  const [lx, ly] = em(1, 0.4)
  const rAro = 3.9 * k
  const rVidro = 3 * k
  L.push(P(elipse(lx, ly, rAro, rAro), LATAO, { bisel: 0.9 * k, contorno: 0.3, projeta: { dist: 1 * k, forca: 0.35, suave: 0.6 * k }, semente: 7144 }))
  L.push(P(elipse(lx, ly, rVidro, rVidro), LENTE, { bisel: 0.6 * k, contorno: 0.2, recesso: { k: 1.6, forca: 0.32 }, textura: texDaLente(lx, ly, rVidro), semente: 7145 }))
  // O brilho do vidro: a meia-lua do alto à esquerda e o pontinho do outro lado.
  L.push(P(dentroDe(elipse(lx - 0.9 * k, ly - 0.9 * k, 1.7 * k, 1.3 * k), elipse(lx, ly, rVidro * 0.92, rVidro * 0.92)), BRILHO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.4 * k }))
  L.push(P(elipse(lx + 1.3 * k, ly + 1.4 * k, 0.4 * k, 0.4 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.7 }))
}

/** O caracol de uma versão. Os arquivos das variantes chamam esta função com a versão deles. */
export function montarCaracol(c: ContextoDoMovel, cena: Cena, versao: VersaoDoCaracol): void {
  const v = VERSOES[versao]
  const k = Math.min(c.w / LARGURA_DE_PARTIDA, c.h / FUNDO_DE_PARTIDA)
  const em = (x: number, y: number): Ponto => [x * k, y * k]
  const d: Desenho = { c, L: cena.partes, em, k }

  // O corpo inteiro: o meio debaixo da casca, a cauda que afina, o pescoço e a cabeça.
  const corpo = uniao(
    uniao(elipse(...em(-2.4, 0.8), 12.8 * k, 6.8 * k), capsula(...em(-15.4, 1.2), ...em(-6, 0.9), 2.3 * k)),
    uniao(capsula(...em(4, 0.6), ...em(10, 0.4), 4.2 * k), elipse(...em(10.6, 0.4), 4.9 * k, 4.6 * k)),
  )
  const casca = elipse(...em(CASCA_X, CASCA_Y), CASCA_RX * k, CASCA_RY * k)
  const tentaculos: readonly (readonly [Ponto, Ponto])[] = [
    [em(12.4, -2), em(15, -6.6)],
    [em(12.4, 2.6), em(15.2, 7)],
  ]
  const formaDosTentaculos = uniao(capsula(...tentaculos[0][0], ...tentaculos[0][1], 0.95 * k), capsula(...tentaculos[1][0], ...tentaculos[1][1], 0.95 * k))

  cena.sombras.push(
    contato(corpo, 0.3),
    { forma: corpo, z: c.g * ALTURA_DO_CORPO * k, forca: 0.26 },
    { forma: formaDosTentaculos, z: c.g * ALTURA_DOS_OLHOS * k, forca: 0.22, suave: 0.8 },
    { forma: casca, z: c.g * ALTURA_DA_CASCA * k, forca: 0.3 },
  )

  montarCorpo(d, corpo)
  montarOlhos(d, tentaculos)
  montarCasca(d, v, casca)
  if (v.fone !== null) cena.sombras.push(contato(montarFone(d, v, v.fone), 0.24))
  else montarCamera(d)
  // Três pintas de lodo seco na casca, para ela não sair lisa de fábrica.
  for (let i = 0; i < PINTAS_DE_LODO; i += 1) {
    const [px, py] = em(CASCA_X - 6 + hash(i, 1, 7150) * 5, CASCA_Y + 3 + hash(i, 2, 7150) * 4)
    cena.partes.push(c.peca(elipse(px, py, (0.5 + hash(i, 3, 7150) * 0.4) * k, (0.4 + hash(i, 4, 7150) * 0.3) * k), PUPILA, { bisel: 0, contorno: 0, alfa: 0.18, suave: 0.4 * k }))
  }
}

export const montarCaracolTelefone: MontarMovel = (c, cena) => montarCaracol(c, cena, 'comum')
