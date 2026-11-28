/**
 * PORTÃO DE JAULA (L01 do plano de arte por tema, 28/11/2026, tema Prisão; fila de 24/11): o portão de grade que
 * fecha a boca de uma jaula ou de um corredor de celas. Na beira de cima da pegada (giro 0), a SOLEIRA de pedra; nas
 * pontas dela os dois POSTES de ferro quadrado com a bola em cima; entre eles a FOLHA: as barras redondas (as da cela
 * com grade, só que mais juntas), os dois montantes mais grossos, o TRILHO de cima, a TRAVESSA do meio, as duas
 * DOBRADIÇAS no poste da esquerda e a caixa da FECHADURA na ponta solta, do lado de dentro da pegada. Duas versões no
 * mesmo tipo (`versoes/portaoDeJaulaVersoes.ts`):
 * - FECHADO (a 1ª, `montarPortaoDeJaula`): a folha na linha dos postes;
 * - ABERTO (`montarPortaoDeJaulaAberto`): a folha girou nas dobradiças para dentro da pegada (para baixo na tela) e
 *   ficou quase de cutelo; a soleira e os postes não mudam, e o vão entre os postes fica livre.
 *
 * De cima, como na cela: os postes, o trilho, a travessa logo abaixo dele e, no chão, a SOMBRA pintada de cada barra
 * deitada para baixo à direita (é ela que mostra a grade em pé). Na 3/4 (perfil derivado, como a cela) as barras e os
 * postes são colunas; o trilho, a travessa, as bolas e as dobradiças são tampos soltos, cada um num pino da altura
 * dele (a travessa e o trilho ocupam o mesmo lugar visto de cima); a frente da fechadura é desenhada na tela e só a
 * 3/4 a vê. Pegada de partida 1 x 1 casa; as medidas saem do menor lado (preso entre 0,8 e 1,5). Material: `grade` (o
 * ferro) e `piso` (a soleira), os da cela com grade.
 */
import { barra, caixa, capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type Textura } from './motor'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'
import { comMeioEm } from './varalDeBandeirinhas'

const ESCALA_MINIMA = 0.8
const ESCALA_MAXIMA = 1.5
/** A grade (a da cela com grade): a altura em casas, o espaço entre barras (casas), o raio da barra e o meio trilho (px). */
const ALTURA_DA_GRADE = 1.15
const ESPACO_DAS_BARRAS = 0.13
const RAIO_DA_BARRA = 0.95
const MEIO_TRILHO = 1.4
/** A folga entre o poste e o montante da folha (px de partida). */
const FOLGA = 1.6
/** Os postes (px de partida): a meia grossura, quanto passam da grade, o raio da bola e a distância da beira de lado. */
const POSTE = { meio: 1.7, aMais: 3, bola: 1.9, daBeira: 3.4 } as const
/** A soleira (px de partida): a meia fundura e a distância da linha do portão até a beira de cima. */
const SOLEIRA = { meia: 3.2, daBeira: 4.2 } as const
/** As dobradiças e a travessa do meio, em frações da altura da grade. */
const DOBRADICAS: readonly number[] = [0.18, 0.78]
const TRAVESSA = 0.42
/** A fechadura (px de partida): o comprimento ao longo da folha, a altura, quanto sai dela e o recuo da ponta. */
const FECHADURA = { comprido: 4.6, alta: 5.4, sai: 1.7, recuo: 2.2 } as const
/** O quanto a folha aberta girou (para dentro da pegada). */
const ABERTURA = (84 * Math.PI) / 180
/** Os tons do ferro (os da cela com grade) e o escuro da frente varrida da 3/4. */
const TOM_DO_POSTE = 1.04
const TOM_DO_TRILHO = 0.96
const TOM_DA_FRENTE = 0.74
const BRILHO_DO_FERRO = 0.32
const SOMBRA_DA_BARRA = { suave: 1.1, forca: 0.3 } as const
const SOMBRA_DO_TRILHO = { suave: 2, forca: 0.24, solta: true } as const
/** A sombra pintada no piso (a da cela) e o escuro do buraco da chave. */
const SOMBRA_NO_PISO: MaterialDaPeca = { classe: 'liso', rgb: [0x1d, 0x1b, 0x19] }
const ALFA_DA_SOMBRA_NO_PISO = 0.3
const BURACO_DA_CHAVE: MaterialDaPeca = { classe: 'liso', rgb: [0x1a, 0x17, 0x15] }

interface Medidas {
  readonly k: number
  /** A linha do portão (y) e o meio de cada poste (x). */
  readonly Y: number
  readonly xp: number
  /** O eixo das dobradiças (o montante da esquerda) e o comprimento da folha. */
  readonly hx: number
  readonly comprido: number
  readonly altura: number
  readonly espaco: number
  readonly rb: number
  readonly mt: number
}

function medidas(c: ContextoDoMovel): Medidas {
  const k = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, Math.min(c.w, c.h) / G))
  const xp = c.hw - POSTE.daBeira * k
  const hx = -xp + (POSTE.meio + FOLGA) * k
  return {
    k,
    Y: -c.hh + SOLEIRA.daBeira * k,
    xp,
    hx,
    comprido: -2 * hx,
    altura: ALTURA_DA_GRADE * G * k,
    espaco: ESPACO_DAS_BARRAS * G * k,
    rb: Math.max(0.6, RAIO_DA_BARRA * k),
    mt: MEIO_TRILHO * k,
  }
}

/** A peça só na vista de cima (`dy` zero) ou só na 3/4 (a peça subiu). */
function soNaVista(textura: Textura | null, deCima: boolean): Textura {
  return (u, v, x, y, p, s, escala) => {
    if ((p.dy === 0) !== deCima) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** Um pino (um ponto sem tamanho nem tinta) que sobe na 3/4, até `z`, a peça com o meio da caixa nele. */
function pino(cena: Cena, x: number, y: number, z: number): void {
  cena.sombras.push({ forma: elipse(x, y, 0.1, 0.1), z, solta: true, forca: 0 })
}

function sombraNoPiso(P: CriarPeca, cena: Cena, forma: Forma, semente: number, suave = 1.1): void {
  cena.partes.push(P(forma, SOMBRA_NO_PISO, { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DA_SOMBRA_NO_PISO, suave, semente }))
}

/** A soleira de pedra e os dois postes com a bola em cima (não mudam entre as versões). */
function soleiraEPostes(c: ContextoDoMovel, cena: Cena, m: Medidas): void {
  const P = c.peca
  const L = cena.partes
  const { k, Y, xp } = m
  const pm = POSTE.meio * k
  const zPoste = m.altura + POSTE.aMais * k
  const soleira = caixa(-xp - 3 * k, Y - SOLEIRA.meia * k, xp + 3 * k, Y + SOLEIRA.meia * k, 1.2 * k)
  cena.sombras.push(contato(soleira, 0.22))
  L.push(P(soleira, c.m.piso, { eixo: 0, tabua: 0, bisel: 1.1 * k, tom: 0.9, contorno: 0.24, semente: 15000 }))
  for (const lado of [-1, 1]) {
    const x = lado * xp
    sombraNoPiso(P, cena, capsula(x, Y, x + SOMBRA_X * zPoste, Y + SOMBRA_Y * zPoste, pm * 1.15), 15001 + lado, 1.3)
    const poste = caixa(x - pm, Y - pm, x + pm, Y + pm, 0.5 * k)
    cena.sombras.push({ forma: poste, z: zPoste, ...SOMBRA_DA_BARRA })
    L.push(P(poste, c.m.grade, { tabua: 0, bisel: 0.9 * k, tom: TOM_DO_POSTE, metal: BRILHO_DO_FERRO, contorno: 0.28, semente: 15004 + lado }))
    // A bola de cima: um tampo solto preso a um pino logo abaixo do poste (no meio do poste ela subiria com ele).
    const r = POSTE.bola * k
    pino(cena, x, Y + pm + 1.2 * k, zPoste + r * 0.9)
    L.push(P(comMeioEm(elipse(x, Y, r, r), x, Y + pm + 1.2 * k), c.m.grade, { tabua: 0, bisel: r, tom: 1.08, metal: 0.42, contorno: 0.26, semente: 15008 + lado }))
  }
}

/** A folha: as barras, os montantes, a travessa, o trilho, as dobradiças e a fechadura, girada `angulo` no eixo. */
function folha(c: ContextoDoMovel, cena: Cena, m: Medidas, angulo: number): void {
  const P = c.peca
  const ferro = c.m.grade
  const L = cena.partes
  const { k } = m
  const [ux, uy] = [Math.cos(angulo), Math.sin(angulo)]
  // (nx, ny): o lado de dentro da pegada (para baixo na tela com a folha fechada).
  const [nx, ny] = [-uy, ux]
  const ponto = (t: number, fora = 0): Ponto => [m.hx + ux * t + nx * fora, m.Y + uy * t + ny * fora]
  const n = Math.max(2, Math.round(m.comprido / m.espaco))
  const barras: Ponto[] = Array.from({ length: n - 1 }, (_, i) => ponto((m.comprido * (i + 1)) / n))
  const montantes: Ponto[] = [ponto(0), ponto(m.comprido)]
  const [sx, sy] = [SOMBRA_X * m.altura, SOMBRA_Y * m.altura]
  // A sombra da folha no chão: cada barra e o trilho, deitados para baixo à direita.
  barras.concat(montantes).forEach(([x, y], i) => sombraNoPiso(P, cena, capsula(x, y, x + sx, y + sy, m.rb * 1.1), 15020 + i))
  const [ax, ay] = ponto(0)
  const [bx, by] = ponto(m.comprido)
  sombraNoPiso(P, cena, barra(ax + sx, ay + sy, bx + sx, by + sy, 2 * m.mt), 15040, 2)
  barras.forEach(([x, y], i) => {
    const forma = elipse(x, y, m.rb, m.rb)
    cena.sombras.push({ forma, z: m.altura, ...SOMBRA_DA_BARRA })
    L.push(P(forma, ferro, { tabua: 0, bisel: m.rb, tom: TOM_DO_POSTE, metal: BRILHO_DO_FERRO, contorno: 0.24, semente: 15050 + i }))
  })
  montantes.forEach(([x, y], i) => {
    const r = m.rb * 1.3
    const forma = elipse(x, y, r, r)
    cena.sombras.push({ forma, z: m.altura, ...SOMBRA_DA_BARRA })
    L.push(P(forma, ferro, { tabua: 0, bisel: r, tom: TOM_DO_POSTE, metal: BRILHO_DO_FERRO, contorno: 0.26, semente: 15070 + i }))
  })
  // A TRAVESSA do meio ocupa, vista de cima, o lugar do trilho: um pino só dela, fora do trilho, a sobe até a altura.
  const trilho = barra(ax, ay, bx, by, 2 * m.mt)
  const [tx, ty] = ponto(m.comprido / n / 2, m.mt + 1.4 * k)
  pino(cena, tx, ty, m.altura * TRAVESSA)
  cena.sombras.push({ forma: barra(ax, ay, bx, by, 1.6 * m.mt), z: m.altura * TRAVESSA, ...SOMBRA_DO_TRILHO })
  L.push(P(comMeioEm(barra(ax, ay, bx, by, 1.6 * m.mt), tx, ty), ferro, { tabua: 0, bisel: m.mt * 0.8, tom: TOM_DO_TRILHO, metal: BRILHO_DO_FERRO, contorno: 0.3, semente: 15080 }))
  // O TRILHO de cima, com a caixa de pintura num vão entre duas barras.
  cena.sombras.push({ forma: trilho, z: m.altura, ...SOMBRA_DO_TRILHO })
  const [vx, vy] = ponto(m.comprido / n / 2)
  L.push(P(comMeioEm(trilho, vx, vy), ferro, { tabua: 0, bisel: m.mt * 0.9, tom: TOM_DO_TRILHO, metal: BRILHO_DO_FERRO, contorno: 0.3, semente: 15081 }))
  dobradicas(c, cena, m, ponto, [ux, uy])
  fechadura(c, cena, m, ponto)
}

/** As dobradiças no poste da esquerda: o nó e a folha dela correndo pelo montante, cada par num pino da altura dele. */
function dobradicas(c: ContextoDoMovel, cena: Cena, m: Medidas, ponto: (t: number, fora?: number) => Ponto, [ux, uy]: Ponto): void {
  const P = c.peca
  const { k } = m
  DOBRADICAS.forEach((fz, i) => {
    const [px, py] = ponto((1.6 + 0.6 * i) * k, m.mt + 2.6 * k)
    pino(cena, px, py, m.altura * fz)
    const folhaDaDobradica = barra(m.hx - ux * 0.4 * k, m.Y - uy * 0.4 * k, m.hx + ux * 6.5 * k, m.Y + uy * 6.5 * k, 1.1 * k)
    const no = elipse(m.hx - (FOLGA * 0.5 + 0.4) * k, m.Y, 1.4 * k, 1.4 * k)
    cena.partes.push(P(comMeioEm(folhaDaDobradica, px, py), c.m.grade, { tabua: 0, bisel: 0.45 * k, tom: 0.94, metal: BRILHO_DO_FERRO, contorno: 0.28, semente: 15090 + i * 2 }))
    cena.partes.push(P(comMeioEm(no, px, py), c.m.grade, { tabua: 0, bisel: 1.1 * k, tom: 1.16, metal: 0.45, contorno: 0.28, semente: 15091 + i * 2 }))
  })
}

/**
 * A caixa da fechadura na ponta solta, do lado de dentro: o tampo dela (as duas vistas) e a frente com o buraco da
 * chave, desenhada na tela (só a 3/4), cada um num pino da altura dele.
 */
function fechadura(c: ContextoDoMovel, cena: Cena, m: Medidas, ponto: (t: number, fora?: number) => Ponto): void {
  const P = c.peca
  const { k } = m
  const t0 = m.comprido - (FECHADURA.recuo + FECHADURA.comprido) * k
  const t1 = m.comprido - FECHADURA.recuo * k
  const dentro = m.mt * 0.6
  const fora = dentro + FECHADURA.sai * k
  const tampo: Ponto[] = [ponto(t0, dentro), ponto(t1, dentro), ponto(t1, fora), ponto(t0, fora)]
  const xs = tampo.map(([x]) => x)
  const ys = tampo.map(([, y]) => y)
  const [x0, x1, yFrente] = [Math.min(...xs), Math.max(...xs), Math.max(...ys)]
  const zMeio = m.altura * TRAVESSA
  const meiaAlta = (FECHADURA.alta * k) / 2
  // O tampo, no alto da caixa; o pino fica logo à frente dela, fora da folha.
  const [p1x, p1y] = [(x0 + x1) / 2, yFrente + 0.9 * k]
  pino(cena, p1x, p1y, zMeio + meiaAlta)
  cena.partes.push(P(comMeioEm(poligono(tampo), p1x, p1y), c.m.grade, { tabua: 0, bisel: 0.5 * k, tom: 1.06, metal: 0.36, contorno: 0.3, semente: 15100 }))
  // A frente, em pé na tela: de `zMeio - meiaAlta` a `zMeio + meiaAlta`, na beira da frente do tampo.
  const [p2x, p2y] = [p1x + 0.5, p1y]
  pino(cena, p2x, p2y, zMeio)
  const so3q = (forma: Forma, mat: MaterialDaPeca, semente: number, tom: number, bisel: number): void => {
    cena.partes.push(P(comMeioEm(forma, p2x, p2y), mat, { tabua: 0, bisel, tom, metal: 0.3, contorno: 0.3, textura: soNaVista(texturaDaClasse(mat.classe), false), semente }))
  }
  so3q(caixa(x0, yFrente - meiaAlta, x1, yFrente + meiaAlta, 0.4 * k), c.m.grade, 15101, TOM_DA_FRENTE, 0.5 * k)
  const xm = (x0 + x1) / 2
  so3q(elipse(xm, yFrente - 0.6 * k, 0.55 * k, 0.55 * k), BURACO_DA_CHAVE, 15102, 1, 0)
  so3q(caixa(xm - 0.25 * k, yFrente - 0.4 * k, xm + 0.25 * k, yFrente + 0.9 * k), BURACO_DA_CHAVE, 15103, 1, 0)
}

export const montarPortaoDeJaula: MontarMovel = (c, cena) => {
  const m = medidas(c)
  soleiraEPostes(c, cena, m)
  folha(c, cena, m, 0)
}

export const montarPortaoDeJaulaAberto: MontarMovel = (c, cena) => {
  const m = medidas(c)
  soleiraEPostes(c, cena, m)
  folha(c, cena, m, ABERTURA)
}
