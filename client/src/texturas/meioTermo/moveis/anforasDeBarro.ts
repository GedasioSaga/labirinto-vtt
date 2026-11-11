/**
 * ÂNFORAS DE BARRO de cima com volume (lote 6 dos objetos novos, 11/11/2026),
 * para a adega, o porão do navio e o mercado. Três ânforas EM PÉ, de tamanhos
 * diferentes, uma encostada na outra, e uma quarta TOMBADA na frente delas.
 *
 * A ânfora em pé, vista do alto, é o BOJO redondo (o chanfro de esfera), com
 * a FAIXA PINTADA de engobe creme em volta dele (de perto, o zigue-zague de
 * óxido escuro dentro da faixa), as duas ASAS que saem do pescoço e pousam no
 * ombro, o beiço da boca e a tampa: a ROLHA de cortiça ou o PANO AMARRADO com
 * duas voltas de corda. A tombada mostra o perfil que diz "ânfora" e não
 * "vaso": o botão do pé, o bojo, o pescoço fino com uma asa de cada lado, a
 * boca aberta e escura, e a rolha dela caída no chão.
 *
 * NA 3/4 AS TRÊS FICAM DE PÉ, sem virar cilindro. `tresQuartos.ts` sobe cada
 * peça com a estrutura mais alta que contém o meio da caixa dela; aqui as
 * estruturas são PINOS (um ponto sem tamanho, sem sombra e sem tinta), três
 * por ânfora, um nada afastados um do outro para cada peça cair no seu:
 * - o do CORPO DE BAIXO sobe o que fica guardado debaixo do bojo na vista de
 *   cima, onde nada dele aparece: o corpo que afina até o pé. O pé cai no meio
 *   da roda do bojo, que é onde a ânfora pisa no chão;
 * - o do BOJO o sobe para cima desse corpo: o disco de esfera é a barriga
 *   vista de frente;
 * - o da BOCA (as asas, o beiço, a tampa) sobe mais, para o alto da barriga.
 * A tombada não tem pino: fica no chão, como está. O que depende da tela (o
 * lado para onde o corpo de baixo desce, a sombra pintada no chão, a ordem dos
 * pinos, a luz do lombo da tombada) lê o quarto de volta que a 3/4 pinta
 * (`c.giro`). O perfil da 3/4 é o derivado de sempre.
 *
 * A 25% de zoom sobram as três rodas de barro com o anel creme e o ponto claro
 * da tampa, e o vulto deitado com o pescoço fino. O barro, o engobe, a rolha,
 * o pano e a corda são fixos (como o pano e o grão dos sacos): cor contida. As
 * medidas saem do menor lado da pegada (1 x 1 casa de partida) e as posições,
 * de frações dela.
 */
import { hash, limitar01, type Rgb } from '../../ruido'
import { anel, cadeia, capsula, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'

/** O desenho foi medido numa casa (28 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIA_CASA = G / 2

/**
 * O barro cozido: terracota clara e pouco viva (saturação HSV ~0,45), mais clara e mais rosada que o barro do
 * vaso de planta, para as duas peças não se confundirem lado a lado.
 */
const BARRO: MaterialDaPeca = { classe: 'liso', rgb: [0xbe, 0x88, 0x68] }
/**
 * O escuro em que o pixel escuro demais é levantado: o tom escuro do próprio barro. Com o piso padrão (a
 * nogueira) o lado da sombra de cada bojo saía de outra cor.
 */
const ESCURO_DO_BARRO: Rgb = [0x60, 0x3e, 0x30]
/** A faixa pintada: engobe creme, e o óxido escuro do zigue-zague. */
const TOM_DO_ENGOBE: Rgb = [0xe0, 0xce, 0xaa]
const TOM_DO_MOTIVO: Rgb = [0x74, 0x48, 0x38]
/** Quanto do engobe cobre o barro, e quanto do óxido cobre o engobe. */
const ENGOBE_NO_BARRO = 0.92
const OXIDO_NO_ENGOBE = 0.82
/** A rolha de cortiça, com os poros mais escuros. */
const ROLHA: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xa6, 0x78] }
/** O pano cru da tampa amarrada e a corda dela (sisal escuro, para riscar o pano claro). */
const PANO: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xd0, 0xb4] }
const CORDA: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x72, 0x4e] }
const TORCAO_DA_CORDA: Rgb = [0x66, 0x52, 0x38]
/** O fundo da boca aberta da tombada: quase preto; o piso de luz o levanta para o escuro do barro. */
const FUNDO_DA_BOCA: MaterialDaPeca = { classe: 'liso', rgb: [0x34, 0x24, 0x1e] }

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

/** De onde vem a luz (a do motor: de cima à esquerda, 52° acima do chão). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * O deslocamento no desenho que cai em (x, y) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; 0 fora dela): a luz, a sombra e o lado de baixo ficam onde estão.
 */
function desgirada(x: number, y: number, giro: number): Ponto {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/**
 * A mesma forma com a caixa de pintura espelhada em volta de (mx, my). O desenho não muda (fora da forma nada
 * pinta); o meio da caixa, que é o que a 3/4 lê para saber em que estrutura a peça está, cai no pino.
 */
function centrada(f: Forma, mx: number, my: number): Forma {
  const ax = Math.max(Math.abs(f.b[0] - mx), Math.abs(f.b[2] - mx))
  const ay = Math.max(Math.abs(f.b[1] - my), Math.abs(f.b[3] - my))
  return { b: [mx - ax, my - ay, mx + ax, my + ay], d: (x, y) => f.d(x, y) }
}

/** A forma `f` andada (dx, dy): a sombra pintada no chão, para baixo à direita. */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** Meia largura do pino (px do protótipo): só o meio exato da caixa de uma peça cai nele. */
const MEIO_PINO = 0.001

/**
 * Um PINO: a estrutura da 3/4 sem tamanho nem tinta. Só o ponto (x, y) está dentro dele, então só a peça cuja
 * caixa de pintura tem o meio ali sobe com ele, e a beirada que a 3/4 daria a um tampo no ar não pinta nada.
 */
function pino(x: number, y: number): Forma {
  return {
    b: [x - MEIO_PINO, y - MEIO_PINO, x + MEIO_PINO, y + MEIO_PINO],
    d: (px, py) => (Math.abs(px - x) <= MEIO_PINO && Math.abs(py - y) <= MEIO_PINO ? -MEIO_PINO : 1),
  }
}

// ---------- o barro e a faixa ----------

/** Os riscos do torno: quantas voltas por px do protótipo. */
const RISCOS_DO_TORNO = 2.3

/**
 * O barro cozido no ponto: as manchas largas da queima, o grão miúdo e, de perto, os riscos do torno (`volta`
 * = a distância ao eixo da ânfora em pé, ou o comprimento ao longo da tombada, em px).
 */
function barro(s: Float32Array, x: number, y: number, volta: number, sem: number, escala: number): void {
  s[3] += ruido(x * 0.13 + sem, y * 0.13) * 0.12 + ruido(x * 0.6 + 9, y * 0.6 + sem) * 0.035
  if (escala >= ESCALA_DO_DETALHE) s[3] += Math.sin(volta * RISCOS_DO_TORNO) * 0.01
}

/** O barro de uma peça sem faixa (a asa, o beiço, o corpo de baixo). */
function texDoBarro(sem: number): Textura {
  return (u, _v, x, y, _p, s, escala) => barro(s, x, y, u, sem, escala)
}

/** A beira macia da faixa e do risco do zigue-zague (px do protótipo), e a meia grossura do risco (fração da faixa). */
const BEIRA_DA_FAIXA = 0.45
const MEIO_RISCO = 0.12
/** O zigue-zague vai e volta entre estas duas alturas da faixa (0 e 1 nas beiras dela). */
const ZIGUE_DE = 0.22
const ZIGUE_ATE = 0.78
/** O comprimento de um dente do zigue-zague, em px do protótipo. */
const PASSO_DO_DENTE = 4.6

/**
 * A faixa pintada no ponto. `atraves` = onde o ponto está na largura da faixa (0 e 1 nas beiras), `largura` = a
 * largura dela em px, `dente` = quantos dentes do zigue-zague já passaram, `risco` = quanto do zigue-zague
 * aparece ali (some na beira do vulto da tombada, onde a faixa dobra para baixo). No tamanho de mesa o
 * zigue-zague tem menos de 1 pixel e vira chuvisco: fica só o creme.
 */
function faixa(s: Float32Array, atraves: number, largura: number, dente: number, risco: number, escala: number): void {
  const cobre = limitar01((Math.min(atraves, 1 - atraves) * largura) / BEIRA_DA_FAIXA + 0.5)
  if (cobre <= 0) return
  const engobe = cobre * ENGOBE_NO_BARRO
  s[0] += (TOM_DO_ENGOBE[0] - s[0]) * engobe
  s[1] += (TOM_DO_ENGOBE[1] - s[1]) * engobe
  s[2] += (TOM_DO_ENGOBE[2] - s[2]) * engobe
  if (escala < ESCALA_DO_DETALHE) return
  const f = dente - Math.floor(dente)
  const alvo = ZIGUE_DE + (ZIGUE_ATE - ZIGUE_DE) * Math.abs(2 * f - 1)
  const oxido = limitar01(((MEIO_RISCO - Math.abs(atraves - alvo)) * largura) / BEIRA_DA_FAIXA + 0.5) * cobre * risco * OXIDO_NO_ENGOBE
  s[0] += (TOM_DO_MOTIVO[0] - s[0]) * oxido
  s[1] += (TOM_DO_MOTIVO[1] - s[1]) * oxido
  s[2] += (TOM_DO_MOTIVO[2] - s[2]) * oxido
}

// ---------- a ânfora em pé ----------

type Tampa = 'rolha' | 'pano'

interface AnforaEmPe {
  /** O meio do bojo, em frações da meia pegada. */
  readonly x: number
  readonly y: number
  /** O raio do bojo, em fração do menor meio lado. */
  readonly raio: number
  readonly tampa: Tampa
  /** Para onde aponta uma das asas (radianos); a outra fica do lado oposto. */
  readonly asas: number
  readonly tom: number
}

/** As três em pé, do fundo para a frente: a grande, a média encostada nela e a pequena encostada na média. */
const EM_PE: readonly AnforaEmPe[] = [
  { x: -0.44, y: -0.42, raio: 0.5, tampa: 'pano', asas: 0.62, tom: 1 },
  { x: 0.47, y: -0.52, raio: 0.4, tampa: 'rolha', asas: -0.5, tom: 0.93 },
  { x: 0.66, y: 0.13, raio: 0.3, tampa: 'rolha', asas: 1.2, tom: 1.06 },
]

/** O chanfro do bojo, em fração do raio dele: quase o raio inteiro, a roda vira esfera. */
const CHANFRO_DO_BOJO = 0.92
/** A faixa pintada em volta do bojo: de onde a onde vai, em fração do raio. */
const FAIXA_DE = 0.57
const FAIXA_ATE = 0.83
/** A asa, em frações do raio do bojo: sai do pescoço, pousa no ombro, e a meia grossura dela. */
const ASA_DE = 0.2
const ASA_ATE = 0.56
const RAIO_DA_ASA = 0.105
/** O beiço da boca (por fora e por dentro) e a rolha, em frações do raio do bojo. */
const BEICO_POR_FORA = 0.36
const BEICO_POR_DENTRO = 0.21
const RAIO_DA_ROLHA = 0.24
/** O pano amarrado: a saia que sobra depois da corda, a corda (por fora e por dentro) e o pano esticado sobre a boca. */
const SAIA_DO_PANO = 0.5
const ONDA_DA_SAIA = 0.03
const PREGAS_DA_SAIA = 7
const CORDA_POR_FORA = 0.39
const CORDA_POR_DENTRO = 0.31
const PANO_NA_BOCA = 0.32
/** Pontos do contorno da saia do pano. */
const PONTOS_DA_SAIA = 36

/**
 * As alturas na 3/4, em raios do bojo: quanto sobe o corpo de baixo (o pé dele cai no meio da roda), o bojo e
 * a boca. Com o bojo mais alto que isto o corpo de baixo, que tem de caber debaixo dele na vista de cima,
 * deixava de encostar na barriga.
 */
const SUBIDA_DO_CORPO = 0.83
const SUBIDA_DO_BOJO = SUBIDA_DO_CORPO + 0.7
const SUBIDA_DA_BOCA = SUBIDA_DO_BOJO + 0.85
/**
 * O corpo de baixo, guardado debaixo do bojo: [meia largura, descida], em raios do bojo, do ombro ao pé. Todos
 * os pontos ficam a menos de 0,86 raio do meio: de cima, o bojo cobre tudo. Na 3/4 ele sai de trás da barriga
 * já na largura dela e afina até o pé: o vulto é o de um ovo de ponta para baixo, sem degrau.
 */
const CORPO_DE_BAIXO: readonly Ponto[] = [
  [0.66, -0.36],
  [0.79, -0.12],
  [0.68, 0.14],
  [0.52, 0.42],
  [0.36, 0.64],
  [0.23, 0.79],
  [0.2, 0.83],
]
/** O pé: a rodela em que a ânfora pisa, um pouco mais larga que o fim do corpo (descida, meia largura e meia altura, em raios). */
const PE = { descida: 0.79, rx: 0.27, ry: 0.07 } as const
/** O corpo de baixo fica na sombra da barriga: menos luz que o bojo, e a sombra dela por cima. */
const TOM_DO_CORPO_DE_BAIXO = 0.76
/** A roda de sombra do bojo no chão, em raios dele. */
const SOMBRA_DO_BOJO = 0.94
/** O afastamento entre os três pinos de uma ânfora, em px da casa de partida. */
const RECUO_DOS_PINOS = 0.4

/** O barro do bojo visto do alto: as manchas, os riscos do torno em roda e a faixa pintada. */
function texDoBojo(cx: number, cy: number, r: number, sem: number): Textura {
  const dentes = Math.max(6, Math.round((Math.PI * (FAIXA_DE + FAIXA_ATE) * r) / PASSO_DO_DENTE))
  return (_u, _v, x, y, _p, s, escala) => {
    const dx = x - cx
    const dy = y - cy
    const longe = Math.hypot(dx, dy)
    barro(s, x, y, longe, sem, escala)
    const atraves = (longe / r - FAIXA_DE) / (FAIXA_ATE - FAIXA_DE)
    if (atraves <= -0.5 || atraves >= 1.5) return
    faixa(s, atraves, (FAIXA_ATE - FAIXA_DE) * r, (Math.atan2(dy, dx) / (Math.PI * 2)) * dentes, 1, escala)
  }
}

/** A prega do pano: o fundo dela escurece (ao quadrado: um risco, não uma faixa) e o lombo clareia um pouco. */
function prega(onda: number, fundo: number, lombo: number): number {
  return onda > 0 ? -fundo * onda * onda : -lombo * onda
}

/** O pano da tampa visto do alto: as pregas que saem da boca em roda. */
function texDoPano(cx: number, cy: number, sem: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = x - cx
    const dy = y - cy
    s[3] += ruido(x * 0.3 + sem, y * 0.3) * 0.05 + prega(Math.sin(Math.atan2(dy, dx) * PREGAS_DA_SAIA + ruido(dx * 0.3 + sem, dy * 0.3) * 1.8), 0.2, 0.05)
  }
}

/** A corda torcida em roda: faixas em diagonal da cor da torção. */
function texDaCorda(cx: number, cy: number, voltas: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = x - cx
    const dy = y - cy
    const t = limitar((Math.sin(Math.atan2(dy, dx) * voltas + Math.hypot(dx, dy) * 2.2) - 0.1) / 0.9, 0, 1)
    s[0] += (TORCAO_DA_CORDA[0] - s[0]) * t
    s[1] += (TORCAO_DA_CORDA[1] - s[1]) * t
    s[2] += (TORCAO_DA_CORDA[2] - s[2]) * t
  }
}

/** A cortiça: o grão e, de perto, os poros escuros. */
const texDaRolha: Textura = (_u, _v, x, y, _p, s, escala) => {
  s[3] += ruido(x * 0.9 + 3, y * 0.9) * 0.08
  if (escala >= ESCALA_DO_DETALHE && hash(Math.floor(x * 1.6), Math.floor(y * 1.6), 4177) > 0.84) s[3] -= 0.16
}

/** O que a ânfora em pé põe na cena: o que fica guardado debaixo dos bojos e o que se vê de cima. */
interface PecasDaAnfora {
  readonly guardadas: Peca[]
  readonly deCima: Peca[]
}

function montarAnforaEmPe(c: ContextoDoMovel, cena: Cena, anfora: AnforaEmPe, k: number): PecasDaAnfora {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const escala = R / MEIA_CASA
  const r = anfora.raio * R
  const cx = anfora.x * c.hw
  const cy = anfora.y * c.hh
  const sem = 4100 + k * 20
  /** O ponto do desenho que fica (lx, ly) px para a direita e para baixo do meio do bojo NA TELA. */
  const naTela = (lx: number, ly: number): Ponto => {
    const [dx, dy] = desgirada(lx, ly, c.giro)
    return [cx + dx, cy + dy]
  }
  // Os três pinos, do fundo para a frente na tela: a 3/4 pinta nessa ordem, e o bojo cobre o corpo de baixo.
  const recuo = RECUO_DOS_PINOS * escala
  const [bx, by] = naTela(0, -recuo)
  const [mx, my] = naTela(0, recuo)
  const umPino = (x: number, y: number, z: number): void => {
    cena.sombras.push({ forma: pino(x, y), z, solta: true, forca: 0 })
  }
  umPino(bx, by, SUBIDA_DO_CORPO * r)
  umPino(cx, cy, SUBIDA_DO_BOJO * r)
  umPino(mx, my, SUBIDA_DA_BOCA * r)

  // A sombra no chão é pintada: a do motor, com altura, viraria uma coluna de barro na 3/4. A roda do bojo cai
  // para baixo à direita e liga-se ao pé por um funil (de cima o funil fica debaixo do bojo; na 3/4 é o que
  // prende a sombra à ânfora); o pé tem o contato dele, que é onde ela pisa.
  const [sx, sy] = desgirada(SOMBRA_X * SUBIDA_DO_BOJO * r, SOMBRA_Y * SUBIDA_DO_BOJO * r, c.giro)
  const longe = Math.hypot(sx, sy)
  const [nx, ny] = [(-sy / longe) * r, (sx / longe) * r]
  const funil = poligono([
    [cx + nx * PE.rx, cy + ny * PE.rx],
    [cx + sx + nx * SOMBRA_DO_BOJO, cy + sy + ny * SOMBRA_DO_BOJO],
    [cx + sx - nx * SOMBRA_DO_BOJO, cy + sy - ny * SOMBRA_DO_BOJO],
    [cx - nx * PE.rx, cy - ny * PE.rx],
  ])
  cena.sombras.push(
    { forma: uniao(elipse(cx + sx, cy + sy, r * SOMBRA_DO_BOJO, r * SOMBRA_DO_BOJO), funil), z: 0, suave: 1 + r * 0.12, forca: 0.27 },
    contato(elipse(cx, cy, r, r), 0.12),
    contato(elipse(cx, cy, PE.rx * r, PE.rx * r), 0.3),
  )

  // O corpo de baixo e o pé, guardados debaixo do bojo: descem do meio para baixo NA TELA.
  const guardadas: Peca[] = []
  const guardar = (forma: Forma, o: OpcoesDaPeca): void => {
    guardadas.push(P(centrada(forma, bx, by), BARRO, o))
  }
  const direita = CORPO_DE_BAIXO.map(([q, t]) => naTela(q * r, t * r))
  const esquerda = [...CORPO_DE_BAIXO].reverse().map(([q, t]) => naTela(-q * r, t * r))
  guardar(poligono([...direita, ...esquerda]), { bisel: r * 0.45, tom: anfora.tom * TOM_DO_CORPO_DE_BAIXO, contorno: 0.3, textura: texDoBarro(sem), semente: sem })
  const [px, py] = naTela(0, PE.descida * r)
  const [ex, ey] = desgirada(1, 0, c.giro)
  guardar(elipseGirada(px, py, PE.rx * r, PE.ry * r, Math.atan2(ey, ex)), { bisel: PE.ry * r, tom: anfora.tom * 0.72, contorno: 0.3, semente: sem + 1 })

  // O bojo: uma roda só, com o chanfro de esfera e a faixa pintada. A sombra dele cai no corpo de baixo.
  const deCima: Peca[] = []
  deCima.push(P(elipse(cx, cy, r, r), BARRO, { bisel: r * CHANFRO_DO_BOJO, tom: anfora.tom, contorno: 0.3, textura: texDoBojo(cx, cy, r, sem), semente: sem + 2, projeta: { dist: r * 0.26, forca: 0.3, suave: 1 + r * 0.08 } }))

  // A boca: tudo o que sobe junto, pelo pino dela (um nada para a frente do meio do bojo).
  const naBoca = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    deCima.push(P(centrada(forma, mx, my), mat, o))
  }
  const grossura = RAIO_DA_ASA * r
  for (const lado of [0, Math.PI]) {
    const co = Math.cos(anfora.asas + lado)
    const si = Math.sin(anfora.asas + lado)
    const asa = capsula(mx + co * ASA_DE * r, my + si * ASA_DE * r, mx + co * ASA_ATE * r, my + si * ASA_ATE * r, grossura)
    naBoca(asa, BARRO, { eixo: anfora.asas, bisel: grossura * 0.9, tom: anfora.tom * 1.04, contorno: 0.3, textura: texDoBarro(sem + 3), semente: sem + 3, projeta: { dist: r * 0.13, forca: 0.36, suave: 0.9 } })
  }
  if (anfora.tampa === 'rolha') {
    naBoca(anel(mx, my, BEICO_POR_FORA * r, BEICO_POR_FORA * r, BEICO_POR_DENTRO * r, BEICO_POR_DENTRO * r), BARRO, { bisel: r * 0.07, tom: anfora.tom * 1.08, contorno: 0.3, textura: texDoBarro(sem + 4), semente: sem + 4, projeta: { dist: r * 0.1, forca: 0.32 } })
    naBoca(elipse(mx, my, RAIO_DA_ROLHA * r, RAIO_DA_ROLHA * r), ROLHA, { bisel: r * 0.09, contorno: 0.26, textura: texDaRolha, semente: sem + 5 })
    return { guardadas, deCima }
  }
  // O pano amarrado: a saia ondulada, as duas voltas de corda, o pano esticado sobre a boca, o nó e as pontas.
  const saia: Ponto[] = []
  for (let i = 0; i < PONTOS_DA_SAIA; i += 1) {
    const t = (i / PONTOS_DA_SAIA) * Math.PI * 2
    // Duas ondas de passo diferente: a saia de um pano amarrado não é uma flor de pétalas iguais.
    const raio = r * (SAIA_DO_PANO + ONDA_DA_SAIA * (Math.sin(t * PREGAS_DA_SAIA + sem) + 0.6 * Math.sin(t * 3 + sem * 2)))
    saia.push([mx + Math.cos(t) * raio, my + Math.sin(t) * raio])
  }
  naBoca(poligono(saia), PANO, { bisel: r * 0.09, tom: 0.93, contorno: 0.26, ruga: 0.7, textura: texDoPano(mx, my, sem), semente: sem + 6, projeta: { dist: r * 0.1, forca: 0.32 } })
  naBoca(anel(mx, my, CORDA_POR_FORA * r, CORDA_POR_FORA * r, CORDA_POR_DENTRO * r, CORDA_POR_DENTRO * r), CORDA, { bisel: r * 0.04, contorno: 0.18, textura: texDaCorda(mx, my, 16), semente: sem + 7, projeta: { dist: r * 0.05, forca: 0.26 } })
  naBoca(elipse(mx, my, PANO_NA_BOCA * r, PANO_NA_BOCA * r), PANO, { bisel: r * 0.26, tom: 1.03, contorno: 0.12, ruga: 0.5, textura: texDoPano(mx, my, sem + 8), semente: sem + 8 })
  const no = anfora.asas + 1.9
  const meioDaCorda = ((CORDA_POR_FORA + CORDA_POR_DENTRO) / 2) * r
  const xDoNo = mx + Math.cos(no) * meioDaCorda
  const yDoNo = my + Math.sin(no) * meioDaCorda
  for (const abre of [-0.5, 0.45]) {
    const ponta = no + abre
    naBoca(capsula(xDoNo, yDoNo, xDoNo + Math.cos(ponta) * r * 0.2, yDoNo + Math.sin(ponta) * r * 0.2, r * 0.028), CORDA, { bisel: r * 0.028, tom: 0.94, contorno: 0.16, semente: sem + 9 })
  }
  naBoca(elipse(xDoNo, yDoNo, r * 0.058, r * 0.058), CORDA, { bisel: r * 0.058, tom: 1.08, contorno: 0.16, semente: sem + 10 })
  return { guardadas, deCima }
}

// ---------- a ânfora tombada ----------

/**
 * A tombada: o meio (frações da meia pegada), para onde aponta a boca (radianos), o meio comprimento e o raio do
 * bojo (frações do menor meio lado).
 */
const TOMBADA = { x: -0.12, y: 0.6, ang: -0.06, meioComprimento: 0.8, raio: 0.33, tom: 0.97 } as const
/**
 * O perfil de meia ânfora, do pé à boca: [ao longo, meia largura], em meios comprimentos e raios do bojo. O
 * botão do pé, o bojo que engorda devagar, o ombro que cai depressa, o pescoço fino e o beiço que abre.
 */
const PERFIL: readonly Ponto[] = [
  [-1, 0.08],
  [-0.96, 0.15],
  [-0.9, 0.16],
  [-0.85, 0.12],
  [-0.76, 0.26],
  [-0.62, 0.52],
  [-0.46, 0.78],
  [-0.3, 0.94],
  [-0.14, 1],
  [0.02, 0.97],
  [0.16, 0.86],
  [0.28, 0.66],
  [0.37, 0.44],
  [0.44, 0.3],
  [0.54, 0.24],
  [0.84, 0.23],
  [0.91, 0.29],
  [0.96, 0.37],
  [1, 0.37],
]
/** A asa de um lado do pescoço: sai debaixo do beiço, abre em arco e pousa no ombro. */
const ASA_DA_TOMBADA: readonly Ponto[] = [
  [0.8, 0.24],
  [0.77, 0.52],
  [0.68, 0.74],
  [0.55, 0.84],
  [0.42, 0.84],
  [0.32, 0.74],
  [0.27, 0.6],
]
/** A meia grossura da asa, em raios do bojo. */
const GROSSURA_DA_ASA_TOMBADA = 0.12
/** A faixa pintada em volta do bojo da tombada: de onde a onde vai, em meios comprimentos. */
const FAIXA_DA_TOMBADA_DE = -0.25
const FAIXA_DA_TOMBADA_ATE = -0.03
/** O zigue-zague some perto da beira do vulto: inteiro a partir de um sexto da meia largura para dentro. */
const SUMICO_DO_RISCO = 6
/** Quanto a luz muda do lombo às beiras da tombada (ela é redonda de través: o chanfro do motor não chega ao meio). */
const FORCA_DO_LOMBO = 0.78
/** A altura do lombo, em raios do bojo: quanto a sombra pintada cai para baixo à direita. */
const ALTURA_DO_LOMBO = 1.3
/** A boca aberta, vista de viés: a cara do beiço e o fundo escuro, em raios do bojo (ao longo e de través). */
const CARA_DO_BEICO = { ao: 0.24, tr: 0.37 } as const
const FUNDO = { ao: 0.14, tr: 0.24 } as const
/** A rolha caída: onde está (frações da meia pegada), as meias medidas (px da casa de partida) e o giro. */
const ROLHA_CAIDA = { x: 0.85, y: 0.84, comprimento: 2.5, largura: 1.7, giro: 0.6 } as const

/** A meia largura da tombada (em raios do bojo) em `t` (meios comprimentos), entre os pontos do perfil. */
function meiaLarguraEm(t: number): number {
  const ultimo = PERFIL.length - 1
  if (t <= PERFIL[0][0]) return PERFIL[0][1]
  for (let i = 1; i <= ultimo; i += 1) {
    const [t1, q1] = PERFIL[i]
    if (t > t1) continue
    const [t0, q0] = PERFIL[i - 1]
    return q0 + ((q1 - q0) * (t - t0)) / (t1 - t0)
  }
  return PERFIL[ultimo][1]
}

function montarAnforaTombada(c: ContextoDoMovel, cena: Cena): void {
  const P = c.peca
  const L = cena.partes
  const R = Math.min(c.hw, c.hh)
  const escala = R / MEIA_CASA
  const cx = TOMBADA.x * c.hw
  const cy = TOMBADA.y * c.hh
  const co = Math.cos(TOMBADA.ang)
  const si = Math.sin(TOMBADA.ang)
  const a = TOMBADA.meioComprimento * R
  const b = TOMBADA.raio * R
  const sem = 4180
  /** Da ânfora (x ao longo dela, y de través, em px) para a pegada. */
  const noMapa = (lx: number, ly: number): Ponto => [cx + lx * co - ly * si, cy + lx * si + ly * co]
  const corpo = poligono([...PERFIL.map(([t, q]) => noMapa(t * a, -q * b)), ...[...PERFIL].reverse().map(([t, q]) => noMapa(t * a, q * b))])
  // A sombra pintada no chão, para baixo à direita NA TELA, e o contato (a tombada não tem altura para a 3/4: fica onde está).
  const [sx, sy] = desgirada(SOMBRA_X * ALTURA_DO_LOMBO * b, SOMBRA_Y * ALTURA_DO_LOMBO * b, c.giro)
  cena.sombras.push({ forma: deslocada(corpo, sx, sy), z: 0, suave: 1.7 * escala, forca: 0.27 }, contato(corpo, 0.3))

  // As duas asas por baixo do corpo: as pontas delas somem debaixo do pescoço e do ombro.
  const grossura = GROSSURA_DA_ASA_TOMBADA * b
  for (const lado of [-1, 1]) {
    const asa = cadeia(ASA_DA_TOMBADA.map(([t, q]) => noMapa(t * a, lado * q * b)), grossura)
    cena.sombras.push({ forma: deslocada(asa, sx * 0.5, sy * 0.5), z: 0, suave: 1.2 * escala, forca: 0.22 }, contato(asa, 0.24))
    L.push(P(asa, BARRO, { eixo: TOMBADA.ang, bisel: grossura, tom: TOMBADA.tom * 0.98, contorno: 0.3, textura: texDoBarro(sem + 1), semente: sem + 1 + (lado + 1) / 2 }))
  }

  // O corpo: redondo de través (a luz do lombo vai na textura), com os riscos do torno e a faixa pintada.
  const [luzX, luzY] = desgirada(LUZ_X, LUZ_Y, c.giro)
  const paraALuz = -luzX * si + luzY * co
  const larguraDaFaixa = (FAIXA_DA_TOMBADA_ATE - FAIXA_DA_TOMBADA_DE) * a
  const dentes = Math.max(3, Math.round((Math.PI * b) / PASSO_DO_DENTE))
  const texDoCorpo: Textura = (_u, _v, x, y, _p, s, pixels) => {
    const lx = (x - cx) * co + (y - cy) * si
    const ly = -(x - cx) * si + (y - cy) * co
    const t = lx / a
    const q = limitar(ly / (meiaLarguraEm(t) * b), -1, 1)
    s[3] += FORCA_DO_LOMBO * (paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    barro(s, x, y, lx, sem, pixels)
    const atraves = (t - FAIXA_DA_TOMBADA_DE) / (FAIXA_DA_TOMBADA_ATE - FAIXA_DA_TOMBADA_DE)
    if (atraves <= -0.5 || atraves >= 1.5) return
    faixa(s, atraves, larguraDaFaixa, (Math.asin(q) / Math.PI) * dentes, limitar01((1 - Math.abs(q)) * SUMICO_DO_RISCO), pixels)
  }
  L.push(P(corpo, BARRO, { eixo: TOMBADA.ang, bisel: 0.9 * escala, tom: TOMBADA.tom, contorno: 0.3, textura: texDoCorpo, semente: sem + 3 }))

  // A boca aberta, de viés: a cara do beiço e o fundo escuro.
  const [ox, oy] = noMapa(a, 0)
  L.push(P(elipseGirada(ox, oy, CARA_DO_BEICO.ao * b, CARA_DO_BEICO.tr * b, TOMBADA.ang), BARRO, { bisel: 0.6 * escala, tom: TOMBADA.tom * 1.1, contorno: 0.3, textura: texDoBarro(sem + 4), semente: sem + 4 }))
  L.push(P(elipseGirada(ox, oy, FUNDO.ao * b, FUNDO.tr * b, TOMBADA.ang), FUNDO_DA_BOCA, { bisel: 0, contorno: 0, recesso: { k: 0.8 * escala, forca: 0.3 }, semente: sem + 5 }))

  // A rolha dela, caída no chão ao lado da boca.
  const rolha = elipseGirada(ROLHA_CAIDA.x * c.hw, ROLHA_CAIDA.y * c.hh, ROLHA_CAIDA.comprimento * escala, ROLHA_CAIDA.largura * escala, ROLHA_CAIDA.giro)
  cena.sombras.push(contato(rolha, 0.26))
  L.push(P(rolha, ROLHA, { bisel: ROLHA_CAIDA.largura * escala * 0.8, contorno: 0.28, textura: texDaRolha, semente: sem + 6 }))
}

export const montarAnforasDeBarro: MontarMovel = (c, cena) => {
  cena.corDoPiso = ESCURO_DO_BARRO
  const emPe = EM_PE.map((anfora, k) => montarAnforaEmPe(c, cena, anfora, k))
  // De baixo para cima: o que fica guardado debaixo dos bojos, a tombada no chão e as três em pé, do fundo para a frente.
  for (const anfora of emPe) cena.partes.push(...anfora.guardadas)
  montarAnforaTombada(c, cena)
  for (const anfora of emPe) cena.partes.push(...anfora.deCima)
}
