/**
 * GUINCHO DE CORRENTE (lote L03 de 24/11/2026, Tortura e fogo; desenho
 * ORIGINAL, só a ideia do guincho de parede dos mapas de referência): o
 * sarilho chumbado na parede da masmorra. Uma TÁBUA de montagem aparafusada e,
 * na frente dela, o TAMBOR: um cilindro deitado e escuro, entre dois mancais
 * de ferro, com as VOLTAS DA CORRENTE enroladas nele. É a forma que manda. Na
 * ponta direita do eixo, pequena, a CATRACA de oito dentes grossos com a
 * LINGUETA que a trava, e a MANIVELA de punho de madeira escura.
 *
 * Do tambor descem TRÊS correntes, cada uma do seu jeito: uma ESTICADA até a
 * argola chumbada no chão, uma FROUXA, que cai em barriga e acaba numa algema
 * aberta largada no chão, e uma que desce e se ENROLA num monte. Nada de leque
 * simétrico.
 *
 * Revisão do diretor de arte (24/11/2026): a roda dentada grande, com raios em
 * estrela e cubo, lia como o ícone de configurações; virou a catraca pequena
 * de lado, sem raios. A bola da manivela saiu.
 *
 * Os elos se leem como elos (um deitado, o seguinte em pé: `elosAoLongo` da
 * corrente). O ferro é velho: ferrugem em manchas, brilho só nas pontas dos
 * dentes, onde a lingueta roça.
 *
 * Figura de parede, desenhada de frente nas duas vistas, como o quadro de
 * avisos (`EM_PE` em `tresQuartos.ts`). A argola, a algema e o monte têm cada
 * um a sua sombra de contato: o perfil do tipo deve trazer
 * `forcaDaSombraDeBaixo: 0.1`, para a elipse única que a 3/4 põe debaixo de
 * tudo quase sumir (zero não pode: a régua de `tresQuartos.test.ts` pede que o
 * objeto em pé ganhe sombra na 3/4). Desenho em px de uma pegada de 1,5 x 1,5
 * casa (84 x 84, y cresce para baixo: a parede em cima, o chão embaixo).
 *
 * A 25% de zoom sobram a barra escura do tambor na tábua e as três correntes
 * desiguais caindo dela: é o que diz "guincho de corrente", e não engrenagem,
 * relógio ou corrente largada. Materiais: `metal` e `madeira`.
 */
import { hash, limitar01, passoSuave, type Rgb } from '../../ruido'
import { anel, barra, cadeia, caixa, capsula, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { elosAoLongo, texDoElo } from './corrente'

/** A pegada em que o desenho foi medido (px do protótipo): 1,5 x 1,5 casa. */
const LADO = 1.5 * G

/** A tábua de montagem na parede. */
const TABUA = { x0: -24, y0: -38, x1: 18, y1: -5 }
/** O tambor: cilindro deitado de 60% da largura da tábua. O meio, o meio comprimento e o raio. */
const TAMBOR = { x: -4.5, y: -21.5, meio: 12.6, raio: 6.2 }
/** Os flanges do tambor (o disco de ferro de cada ponta, visto de quina) e os mancais que o seguram. */
const FLANGE = { meia: 0.9, sobra: 1.5 }
const MANCAL = { meia: 1.7, sobra: 3.2 }
/**
 * As voltas da corrente no tambor, apertadas uma na outra, numa camada só: de onde a onde vão (x), o passo de uma
 * volta, o quanto a camada passa do tambor em cima e embaixo, o comprimento do elo e o quanto as voltas entortam
 * (px de x por px de y: a hélice).
 */
const VOLTAS = { de: -16.6, ate: 3.2, passo: 2.75, sobra: 0.9, elo: 3.4, torta: 0.2 }
/** A catraca, na ponta direita do eixo: o meio, o raio da ponta e do pé dos dentes e quantos dentes. */
const CATRACA = { x: 14.4, y: -21.5, ponta: 5.5, pe: 3.7, dentes: 8 }
/** A lingueta: o pino dela (na tábua) e a ponta que trava no dente. */
const LINGUETA: readonly Ponto[] = [[8.6, -33.4], [11.2, -34.6], [15.8, -27.6], [13.8, -26.2]]
const PINO_DA_LINGUETA: Ponto = [10, -33.4]
/** A manivela: do eixo até o punho, e o punho de madeira (o comprimento e o raio). */
const MANIVELA: Ponto = [22.6, -11.4]
const PUNHO = { comprimento: 6.4, raio: 1.75 }
const PASSO_DA_CORRENTE = 4.2
/** A corrente ESTICADA: de onde sai do tambor até a argola chumbada no chão. */
const ESTICADA: readonly [Ponto, Ponto] = [[-13.4, -15.2], [-29, 31]]
const ARGOLA = { fora: 3, dentro: 1.7 }
/** A corrente FROUXA: cai em barriga, encosta no chão e acaba na algema aberta. `noChao` = a partir de qual ponto ela está deitada. */
const FROUXA: readonly Ponto[] = [[-0.4, -15.2], [2.6, 2], [6, 17.5], [13, 26.4], [21.6, 27.8]]
const FROUXA_NO_CHAO = 3
const ALGEMA = { x: 27.4, y: 28.4, raio: 4.3, arame: 1.5, boca: 0.5, meiaBoca: 0.6 }
/** A corrente ENROLADA: desce do tambor e acaba num monte de voltas no chão. O meio do monte e os raios da espiral. */
const DESCIDA_DA_ENROLADA: readonly Ponto[] = [[-7.2, -15.2], [-8.2, 4], [-7, 20.6]]
const MONTE = { x: -7.4, y: 28.6, raio: 7.6, miolo: 2.6, voltas: 1.9, achata: 0.72 }

const TOM_DO_REBITE = 1.32
const BRILHO_DO_FERRO = 0.32
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
const FERRUGEM: Rgb = [0x7c, 0x58, 0x42]
/** O ferro escuro da catraca (perto de #4e4a46 no ferro) e o brilho que só as pontas dos dentes têm. */
const TOM_DA_CATRACA = 0.72
const BRILHO_NAS_PONTAS = 0.5
/** O tambor: a madeira escurecida e a luz de cilindro deitado (o claro no alto, o escuro embaixo). */
const TOM_DO_TAMBOR = 0.62
const LUZ_DO_CILINDRO = { claro: 0.16, escuro: 0.42 }
const TOM_DO_PUNHO = 0.56

const DO_METAL = texturaDaClasse('metal')
const DA_MADEIRA = texturaDaClasse('madeira')

/** O ferro velho: o metal e a ferrugem em manchas (`quanto` de 0 a 1). */
function texFerroVelho(quanto: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    const t = limitar01((ruido(x * 0.42 + p.su, y * 0.42 + p.sv) + 0.08) * 1.9) * quanto
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
  }
}

/** A luz de um cilindro deitado de meio `cy` e raio `r`: o claro um pouco acima do meio, o escuro crescendo para baixo. */
function luzDoCilindro(y: number, cy: number, r: number): number {
  const t = (y - cy) / r
  return LUZ_DO_CILINDRO.claro - (LUZ_DO_CILINDRO.claro + LUZ_DO_CILINDRO.escuro) * passoSuave(-0.45, 1, t) - 0.12 * passoSuave(-0.45, -1, t)
}

/** O tambor: o veio da madeira ao comprido e a luz de cilindro deitado. */
function texDoTambor(cy: number, r: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DA_MADEIRA !== null) DA_MADEIRA(u, v, x, y, p, s, escala)
    s[3] += luzDoCilindro(y, cy, r)
  }
}

/** O ferro escuro da catraca: a ferrugem e o brilho só nas pontas dos dentes, onde a lingueta roça. */
function texDaCatraca(cx: number, cy: number, pe: number, ponta: number): Textura {
  const velho = texFerroVelho(0.35)
  return (u, v, x, y, p, s, escala) => {
    velho(u, v, x, y, p, s, escala)
    s[3] += BRILHO_NAS_PONTAS * passoSuave(pe + (ponta - pe) * 0.35, ponta, Math.hypot(x - cx, y - cy))
  }
}

/**
 * A corrente ENROLADA no tambor, numa textura só: as voltas apertadas uma na outra, um nada tortas (a corrente sobe em
 * hélice), com o vão escuro entre duas voltas; em cada volta, os elos alternados (o deitado, largo e furado no meio; o
 * em pé, só o fio do arame), desencontrados de uma volta para a outra; e a luz do cilindro por cima de tudo.
 * `x0` = onde a primeira volta começa; `passo` e `elo` em px.
 */
function texDasVoltas(x0: number, cy: number, r: number, passo: number, elo: number): Textura {
  const velho = texFerroVelho(0.3)
  return (u, v, x, y, p, s, escala) => {
    velho(u, v, x, y, p, s, escala)
    const a = (x - x0 + (y - cy) * VOLTAS.torta) / passo
    const volta = Math.floor(a)
    const f = a - volta
    const q = (y - cy) / elo + (volta % 2 === 0 ? 0 : 0.5)
    const noElo = q - Math.floor(q)
    const doMeio = Math.abs(f - 0.56)
    let luz = luzDoCilindro(y, cy, r) * 1.15
    if (f < 0.14) luz -= 0.42
    else if (noElo < 0.56) {
      // O elo deitado: o oval largo, com o furo escuro no meio.
      if (doMeio < 0.13 && Math.abs(noElo - 0.28) < 0.15) luz -= 0.34
      else luz += 0.05
    } else if (doMeio > 0.17) luz -= 0.3
    s[3] += luz
  }
}

/** A catraca: oito dentes grossos em serra (a frente do dente a prumo, as costas em rampa) em volta do meio. */
function catraca(cx: number, cy: number): Forma {
  const pontos: Ponto[] = []
  const passo = (Math.PI * 2) / CATRACA.dentes
  for (let i = 0; i < CATRACA.dentes; i += 1) {
    const a = i * passo
    for (const [f, r] of [[0, CATRACA.pe], [0.06, CATRACA.ponta], [0.42, CATRACA.ponta], [0.86, CATRACA.pe]] as const) {
      pontos.push([cx + Math.cos(a + f * passo) * r, cy + Math.sin(a + f * passo) * r])
    }
  }
  return poligono(pontos)
}

/** A espiral do monte de corrente: de fora para o miolo, achatada (o chão visto um pouco de frente). */
function espiral(): Ponto[] {
  const pontos: Ponto[] = []
  const n = 22
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    const a = -Math.PI * 0.62 + t * MONTE.voltas * Math.PI * 2
    const r = MONTE.raio + (MONTE.miolo - MONTE.raio) * t
    pontos.push([MONTE.x + Math.cos(a) * r, MONTE.y + Math.sin(a) * r * MONTE.achata])
  }
  return pontos
}

export const montarGuinchoDeCorrente: MontarMovel = (c, cena) => {
  const e = Math.min(c.w, c.h) / LADO
  const na = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const por = (f: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    cena.partes.push(c.peca(na(f), mat, { ...o, bisel: (o.bisel ?? 1) * e }))
  }
  const ferro = c.m.metal
  const madeira = c.m.madeira
  const doFerro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 0.8, contorno: 0.3, metal: BRILHO_DO_FERRO, textura: texFerroVelho(0.5), semente, ...mais })
  const sombraMiuda = { dist: 0.9 * e, forca: 0.3 }
  cena.corDoPiso = ESCURO_DO_FERRO
  /** Os elos de uma corrente pelo caminho (px do desenho). */
  const corrente = (caminho: readonly Ponto[], passo: number, comecaDeitado: boolean, semente: number): void => {
    elosAoLongo(caminho.map(([x, y]): Ponto => [x * e, y * e]), passo * e, comecaDeitado).forEach((elo, j) => {
      const tom = 0.98 + 0.14 * hash(semente, j, 24840)
      cena.partes.push(c.peca(elo.forma, ferro, {
        tabua: 0,
        bisel: (elo.deitado ? 0.55 : 0.6) * e,
        contorno: 0.3,
        tom,
        metal: 0.4,
        textura: texDoElo(elo, 0.45),
        semente: semente + j,
        projeta: elo.deitado ? undefined : { dist: 0.6 * e, forca: 0.24 },
      }))
    })
  }

  // ---------- as sombras: a tábua um nada descolada da parede, a corrente esticada no ar e, no chão, cada coisa com a sua ----------
  const tabua = caixa(TABUA.x0, TABUA.y0, TABUA.x1, TABUA.y1, 1.4)
  cena.sombras.push({ forma: na(tabua), z: 6 * e, solta: true, suave: 1.5 * e, forca: 0.28 })
  const [[ex, ey], [ax, ay]] = ESTICADA
  cena.sombras.push({ forma: na(capsula(ex + (ax - ex) * 0.24, TABUA.y1 + 1, ax, ay, 1.3)), z: 3 * e, solta: true, suave: 1.3 * e, forca: 0.22 })
  cena.sombras.push(contato(na(caixa(ax - 3.8, ay + 0.4, ax + 3.8, ay + 4.4, 1)), 0.32))
  // A frouxa: o trecho pendurado faz sombra solta; o trecho deitado e a algema, sombra de contato.
  cena.sombras.push({ forma: na(cadeia(FROUXA.slice(1, FROUXA_NO_CHAO + 1), 1.2)), z: 2.4 * e, solta: true, suave: 1.3 * e, forca: 0.2 })
  cena.sombras.push(contato(na(cadeia(FROUXA.slice(FROUXA_NO_CHAO), 1.5)), 0.3))
  cena.sombras.push(contato(na(elipse(ALGEMA.x, ALGEMA.y + 0.6, ALGEMA.raio + 0.4, ALGEMA.raio * 0.8)), 0.32))
  cena.sombras.push({ forma: na(cadeia(DESCIDA_DA_ENROLADA.slice(1), 1.2)), z: 2.4 * e, solta: true, suave: 1.3 * e, forca: 0.2 })
  cena.sombras.push(contato(na(elipse(MONTE.x, MONTE.y + 0.8, MONTE.raio + 1.6, (MONTE.raio + 1.2) * MONTE.achata)), 0.34))

  // ---------- a tábua de montagem e os parafusos ----------
  por(tabua, madeira, { tabua: 8.5, bisel: 1.3, contorno: 0.3, tom: 0.8, semente: 24801 })
  for (const x of [TABUA.x0 + 3.4, TABUA.x1 - 3.4]) {
    for (const y of [TABUA.y0 + 3.4, TABUA.y1 - 3.4]) {
      por(elipse(x, y, 1.4, 1.4), ferro, doFerro(24802 + x + y * 3, { bisel: 1.1, tom: 1.06, textura: undefined, projeta: sombraMiuda }))
    }
  }

  // ---------- no chão: a argola chumbada da corrente esticada ----------
  por(caixa(ax - 3.6, ay + 1, ax + 3.6, ay + 4.2, 0.9), ferro, doFerro(24820, { tom: 0.9, textura: texFerroVelho(0.7) }))
  for (const lado of [-1, 1]) por(elipse(ax + lado * 2.4, ay + 2.6, 0.7, 0.7), ferro, doFerro(24824 + lado, { bisel: 0.6, tom: TOM_DO_REBITE, contorno: 0.2, textura: undefined }))
  por(anel(ax, ay - 0.4, ARGOLA.fora, ARGOLA.fora, ARGOLA.dentro, ARGOLA.dentro), ferro, doFerro(24832, { bisel: 0.65, metal: 0.42, projeta: sombraMiuda }))

  // ---------- o monte de corrente enrolada no chão (a espiral, de fora para o miolo) e a descida até ele ----------
  corrente(espiral(), PASSO_DA_CORRENTE, true, 24860)
  corrente(DESCIDA_DA_ENROLADA, PASSO_DA_CORRENTE, false, 24900)

  // ---------- a corrente frouxa, em barriga, e a algema aberta na ponta ----------
  const aro = anel(ALGEMA.x, ALGEMA.y, ALGEMA.raio, ALGEMA.raio * 0.86, ALGEMA.raio - ALGEMA.arame, ALGEMA.raio * 0.86 - ALGEMA.arame)
  const longe = ALGEMA.raio * 2.2
  const cunha = poligono([
    [ALGEMA.x, ALGEMA.y],
    [ALGEMA.x + Math.cos(ALGEMA.boca - ALGEMA.meiaBoca) * longe, ALGEMA.y + Math.sin(ALGEMA.boca - ALGEMA.meiaBoca) * longe],
    [ALGEMA.x + Math.cos(ALGEMA.boca + ALGEMA.meiaBoca) * longe, ALGEMA.y + Math.sin(ALGEMA.boca + ALGEMA.meiaBoca) * longe],
  ])
  por(menos(aro, cunha), ferro, doFerro(24930, { bisel: 0.8, tom: 1, metal: 0.4, textura: texFerroVelho(0.4), projeta: sombraMiuda }))
  // A orelha da algema, onde a corrente prende.
  por(elipse(ALGEMA.x - ALGEMA.raio + 0.3, ALGEMA.y - 0.3, 1.6, 1.5), ferro, doFerro(24931, { bisel: 1.1, tom: 1.12, textura: texFerroVelho(0.3), projeta: sombraMiuda }))
  corrente(FROUXA, PASSO_DA_CORRENTE, true, 24940)

  // ---------- a corrente esticada, do tambor à argola do chão ----------
  corrente([[ex, ey], [ax, ay - ARGOLA.fora + 0.6]], PASSO_DA_CORRENTE, true, 24980)

  // ---------- os mancais, o tambor (o cilindro deitado, com os flanges) e as voltas da corrente enroladas nele ----------
  const [t0, t1] = [TAMBOR.x - TAMBOR.meio, TAMBOR.x + TAMBOR.meio]
  for (const [i, x] of [t0 - FLANGE.meia * 2 - MANCAL.meia, t1 + FLANGE.meia * 2 + MANCAL.meia].entries()) {
    por(caixa(x - MANCAL.meia, TAMBOR.y - TAMBOR.raio - MANCAL.sobra, x + MANCAL.meia, TAMBOR.y + TAMBOR.raio + MANCAL.sobra, 0.8), ferro, doFerro(24810 + i, { tom: 0.84, textura: texFerroVelho(0.8), projeta: { dist: 1.6 * e, forca: 0.34 } }))
    for (const lado of [-1, 1]) por(elipse(x, TAMBOR.y + lado * (TAMBOR.raio + MANCAL.sobra - 1.6), 0.8, 0.8), ferro, doFerro(24812 + i * 2 + lado, { bisel: 0.7, tom: TOM_DO_REBITE, contorno: 0.2, textura: undefined }))
  }
  por(caixa(t0, TAMBOR.y - TAMBOR.raio, t1, TAMBOR.y + TAMBOR.raio, 1.2), madeira, { tabua: 0, bisel: 1, contorno: 0.32, tom: TOM_DO_TAMBOR, textura: texDoTambor(TAMBOR.y * e, TAMBOR.raio * e), semente: 24900, projeta: { dist: 2.6 * e, forca: 0.38, suave: 1.4 * e } })
  for (const [i, x] of [t0 - FLANGE.meia, t1 + FLANGE.meia].entries()) {
    por(caixa(x - FLANGE.meia, TAMBOR.y - TAMBOR.raio - FLANGE.sobra, x + FLANGE.meia, TAMBOR.y + TAMBOR.raio + FLANGE.sobra, 0.7), ferro, doFerro(24816 + i, { bisel: 0.7, tom: 1.02, textura: texFerroVelho(0.45), projeta: sombraMiuda }))
  }
  // A corrente enrolada: uma camada só por cima do tambor (um nada mais gorda que ele), com as voltas e os elos na textura.
  const enrolada = caixa(VOLTAS.de, TAMBOR.y - TAMBOR.raio - VOLTAS.sobra, VOLTAS.ate, TAMBOR.y + TAMBOR.raio + VOLTAS.sobra, 1.5)
  por(enrolada, ferro, doFerro(25000, { bisel: 1.1, contorno: 0.34, tom: 0.98, metal: 0.26, textura: texDasVoltas(VOLTAS.de * e, TAMBOR.y * e, (TAMBOR.raio + VOLTAS.sobra) * e, VOLTAS.passo * e, VOLTAS.elo * e), projeta: { dist: 1 * e, forca: 0.32 } }))

  // ---------- a catraca pequena na ponta do eixo, a lingueta que a trava e a manivela de punho de madeira escura ----------
  por(catraca(CATRACA.x, CATRACA.y), ferro, doFerro(25060, { bisel: 0.9, tom: TOM_DA_CATRACA, metal: 0.12, textura: texDaCatraca(CATRACA.x * e, CATRACA.y * e, CATRACA.pe * e, CATRACA.ponta * e), projeta: { dist: 1.6 * e, forca: 0.36, suave: 1.1 * e } }))
  por(elipse(CATRACA.x, CATRACA.y, 2, 2), ferro, doFerro(25061, { bisel: 1.3, tom: 0.98, metal: 0.36, textura: undefined, projeta: sombraMiuda }))
  por(poligono(LINGUETA), ferro, doFerro(25062, { bisel: 0.8, tom: 0.96, textura: texFerroVelho(0.3), projeta: sombraMiuda }))
  por(elipse(PINO_DA_LINGUETA[0], PINO_DA_LINGUETA[1], 1.2, 1.2), ferro, doFerro(25063, { bisel: 1, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2, textura: undefined }))
  por(barra(CATRACA.x, CATRACA.y, MANIVELA[0], MANIVELA[1], 2.3), ferro, doFerro(25064, { bisel: 0.9, tom: 0.92, textura: texFerroVelho(0.3), projeta: { dist: 1.4 * e, forca: 0.32 } }))
  por(elipse(CATRACA.x, CATRACA.y, 1.2, 1.2), ferro, doFerro(25065, { bisel: 1, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2, textura: undefined }))
  // O punho: um cabo curto de madeira escura, atravessado na ponta da manivela (nada de bola).
  const rumo = Math.atan2(MANIVELA[1] - CATRACA.y, MANIVELA[0] - CATRACA.x) + Math.PI / 2
  const [px, py] = [Math.cos(rumo) * PUNHO.comprimento * 0.5, Math.sin(rumo) * PUNHO.comprimento * 0.5]
  por(capsula(MANIVELA[0] - px * 0.5, MANIVELA[1] - py * 0.5, MANIVELA[0] + px * 1.5, MANIVELA[1] + py * 1.5, PUNHO.raio), madeira, { tabua: 0, eixo: rumo, bisel: PUNHO.raio * 0.9, contorno: 0.32, tom: TOM_DO_PUNHO, semente: 25066, projeta: { dist: 1.4 * e, forca: 0.32 } })
  por(elipse(MANIVELA[0], MANIVELA[1], 1.1, 1.1), ferro, doFerro(25067, { bisel: 0.9, tom: 1.1, contorno: 0.2, textura: undefined }))
}
