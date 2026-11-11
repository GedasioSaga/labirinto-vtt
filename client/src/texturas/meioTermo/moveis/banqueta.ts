/**
 * BANQUETA de cima com volume (lote 4 dos objetos novos, 11/11/2026): o
 * banquinho redondo de três pés, de ordenha ou de oficina. De cima aparece o
 * ASSENTO, um disco de madeira inteiriça gasto no meio (o miolo polido, mais
 * claro e um pouco fundo), com a espessura dele aparecendo embaixo, e, em
 * volta, o que diz banqueta e não barril nem cadeira: os TRÊS PÉS abrindo
 * para fora por baixo do assento e as pontas das TRAVESSAS que os ligam em
 * triângulo, sumindo debaixo do disco. A 25% de zoom sobram o disco claro e
 * as três pontas escuras em estrela.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura, pintada do
 * norte para o sul; cada peça sobe com a estrutura mais alta que contém o meio
 * da caixa dela) a banqueta fica em pé: o pé da frente reto, os dois de trás
 * abertos, as travessas em triângulo e o assento por cima.
 * - cada PÉ é inclinado, e uma coluna só sobe reta: ele é cortado em FATIAS
 *   finas ao longo do comprimento, cada uma um tampo solto na altura dela. A
 *   forma de todas as fatias é a cápsula inteira (o chanfro e o contorno não
 *   sabem do corte) e quem esconde o resto é a textura; cada fatia pinta um
 *   pouco além do corte, por baixo das vizinhas: de cima isso não aparece (as
 *   fatias pintam a mesma madeira no mesmo lugar) e na 3/4 fecha o degrau
 *   entre uma fatia e a seguinte;
 * - as TRAVESSAS são tampos soltos baixos;
 * - o ASSENTO tem de subir sem levar junto as travessas (o meio delas fica
 *   debaixo dele) e tem de ser pintado por último (ele cobre o alto dos três
 *   pés). Por isso a estrutura dele é só o MIOLO do disco, menor que o
 *   triângulo das travessas, com a caixa do tamanho da pegada (é a caixa que
 *   dá a ordem da pintura). A espessura do disco é a peça de baixo, deslocada,
 *   como a do tampo da mesa, e a sombra dele no chão é pintada à parte.
 * O perfil da 3/4 é o derivado SEM beirada (`espessura: 0`): os pés e as
 * travessas são redondos, e a beirada reta de cada fatia fazia degraus.
 *
 * As medidas saem do menor meio lado da pegada (meia casa de partida); a
 * altura é em casas. Material: `madeira`.
 */
import { barra, capsula, dentroDe, elipse, type Forma } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Textura } from './motor'
import { tomLongeDoChao, type MontarMovel } from './contexto'

/** Altura do assento em casas. */
const ALTURA = 0.32
/** O menor meio lado da banqueta de partida (px do protótipo): as medidas em px valem para ela e escalam com a pegada. */
const MEIO_LADO_DE_PARTIDA = 14

/** O assento: o raio (fração do menor meio lado) e a espessura do disco (px do protótipo na banqueta de partida). */
const RAIO_DO_ASSENTO = 0.46
const ESPESSURA_DO_ASSENTO = 1.9
/** Quanto a espessura do disco aparece à direita, de cima (a regra do tampo da mesa). */
const ESPESSURA_A_DIREITA = 0.4
/**
 * O miolo do assento, a estrutura que o sobe na 3/4 (fração do menor meio
 * lado): menor que a distância do meio de cada travessa ao centro (0,39), para
 * elas não subirem com ele.
 */
const RAIO_DO_MIOLO = 0.24
/** Cada pé: onde encaixa no assento, onde pisa (frações do menor meio lado, a partir do centro) e o raio dele. */
const ENCAIXE_DO_PE = 0.27
const PISADA_DO_PE = 0.845
const RAIO_DO_PE = 0.12
/** As direções dos três pés: um para a frente (o sul) e dois para trás, abertos (o y da tela cresce para baixo). */
const DIRECOES_DOS_PES: readonly number[] = [Math.PI / 2, -Math.PI / 6, (7 * Math.PI) / 6]
/** Em quantas fatias cada pé é cortado para subir inclinado na 3/4: com poucas, a beira do pé de trás sai em dentes. */
const FATIAS_DO_PE = 40
/** Quanto cada fatia pinta além do corte, para cada lado (px do protótipo na banqueta de partida). */
const SOBRA_DA_FATIA = 1.3
/** A travessa: onde encontra cada pé (fração do menor meio lado, a partir do centro: baixo, perto da pisada) e o raio dela. */
const TRAVESSA_NO_PE = 0.78
const RAIO_DA_TRAVESSA = 0.065

/** Os pés e as travessas ficam na sombra do assento: mais escuros que ele. */
const TOM_DO_PE = 0.82
const TOM_DA_TRAVESSA = 0.7
const TOM_DA_ESPESSURA = 0.66
/** Quanto a madeira é afastada da luz do chão padrão: a banqueta é pequena, e a madeira média sumia nele. */
const LONGE_DO_CHAO = 0.08
/** O veio do assento, um pouco torto em relação à pegada (radianos): a tábua não foi cortada no esquadro. */
const VEIO_DO_ASSENTO = 0.4

/** O miolo gasto: até onde vai (fração do raio do assento), a luz que ganha e a sujeira que fica na beira. */
const MIOLO_GASTO = 0.62
const LUZ_DO_GASTO = 0.14
const SUJEIRA_DA_BEIRA = 0.08
/** A cova de tanto sentar: a força da luz do lado de baixo à direita (e da sombra do lado da luz). */
const LUZ_DA_COVA = 0.1

/** A sombra do assento no chão, solta, e o contato de cada pé. */
const FORCA_DA_SOMBRA_DO_ASSENTO = 0.28
const FORCA_DO_CONTATO_DO_PE = 0.34

function limitar01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de
 * volta que a 3/4 pinta (`giro`, em graus; de cima é sempre 0): o contrário
 * do `girarPonto` de `tresQuartos.ts`, como no altar.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** A madeira do pé só dentro da fatia (`de` a `ate`, ao longo da direção do pé): fora dela a peça não pinta. */
function soNaFatia(ux: number, uy: number, de: number, ate: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    const aoLongo = x * ux + y * uy
    if (aoLongo < de || aoLongo >= ate) {
      s[5] = 0
      return
    }
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
  }
}

/**
 * A madeira do assento com o uso por cima: o miolo polido (mais claro, de
 * beira manchada), a sujeira que fica perto da borda e a cova rasa (a luz do
 * lado de baixo à direita, a sombra do lado da luz). `paraASombra` = a direção
 * em que a sombra cai, no desenho.
 */
function texDoAssento(raio: number, paraASombra: readonly [number, number]): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const r = Math.hypot(x, y) / raio
    const beira = MIOLO_GASTO + ruido(x * 0.45 + p.su, y * 0.45) * 0.3
    s[3] += LUZ_DO_GASTO * (1 - limitar01((r - beira + 0.15) / 0.3)) - SUJEIRA_DA_BEIRA * limitar01((r - 0.66) / 0.3)
    if (r > 1e-6 && r < 1) s[3] += LUZ_DA_COVA * ((x * paraASombra[0] + y * paraASombra[1]) / (r * raio)) * 2.6 * r * (1 - r * r)
  }
}

export const montarBanqueta: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const R = Math.min(hw, hh)
  const k = R / MEIO_LADO_DE_PARTIDA
  const tom = tomLongeDoChao(mad, LONGE_DO_CHAO)
  const zAssento = g * ALTURA
  const espessura = ESPESSURA_DO_ASSENTO * k
  /** O alto dos pés, debaixo do disco. */
  const zPe = zAssento - espessura
  const rAssento = RAIO_DO_ASSENTO * R
  const rEncaixe = ENCAIXE_DO_PE * R
  const rPisada = PISADA_DO_PE * R
  const raioDoPe = RAIO_DO_PE * R
  /** A altura do pé a `r` do centro: do chão, na pisada, até o alto, no encaixe. */
  const alturaDoPe = (r: number): number => zPe * limitar01((rPisada - r) / (rPisada - rEncaixe))
  const L = cena.partes

  // A sombra do assento no chão, solta, caída para o lado: não é estrutura (a estrutura dele é só o miolo).
  const [sx, sy] = desgirado(SOMBRA_X * zAssento, SOMBRA_Y * zAssento, c.giro)
  cena.sombras.push({ forma: elipse(sx, sy, rAssento, rAssento), z: 0, suave: 0.8 + 0.09 * zAssento, forca: FORCA_DA_SOMBRA_DO_ASSENTO })

  // As TRAVESSAS, de pé a pé, baixas: por baixo dos pés na lista, que cobrem as pontas delas.
  const rTravessa = TRAVESSA_NO_PE * R
  const zTravessa = alturaDoPe(rTravessa)
  const raioDaTravessa = RAIO_DA_TRAVESSA * R
  DIRECOES_DOS_PES.forEach((a0, i) => {
    const a1 = DIRECOES_DOS_PES[(i + 1) % DIRECOES_DOS_PES.length]
    const [ax, ay] = [Math.cos(a0) * rTravessa, Math.sin(a0) * rTravessa]
    const [bx, by] = [Math.cos(a1) * rTravessa, Math.sin(a1) * rTravessa]
    const travessa = capsula(ax, ay, bx, by, raioDaTravessa)
    cena.sombras.push({ forma: travessa, z: zTravessa, solta: true }, contato(travessa, 0.2))
    L.push(P(travessa, mad, { eixo: Math.atan2(by - ay, bx - ax), tabua: 0, bisel: raioDaTravessa * 0.9, contorno: 0.28, tom: tom * TOM_DA_TRAVESSA, semente: 3200 + i }))
  })

  // Os PÉS, do encaixe debaixo do assento até a pisada, em fatias: a de cima fica na altura do disco, a de baixo no chão.
  const comeco = rEncaixe - raioDoPe
  const passo = (rPisada + raioDoPe - comeco) / FATIAS_DO_PE
  const sobra = SOBRA_DA_FATIA * k
  DIRECOES_DOS_PES.forEach((a, i) => {
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const pe = capsula(ux * rEncaixe, uy * rEncaixe, ux * rPisada, uy * rPisada, raioDoPe)
    const faixa = (de: number, ate: number): Forma => barra(ux * de, uy * de, ux * ate, uy * ate, 2 * raioDoPe + 2)
    cena.sombras.push(contato(elipse(ux * rPisada, uy * rPisada, raioDoPe * 1.1, raioDoPe * 1.1), FORCA_DO_CONTATO_DO_PE))
    for (let j = 0; j < FATIAS_DO_PE; j += 1) {
      const de = comeco + j * passo
      const ate = de + passo
      const z = alturaDoPe((de + ate) / 2)
      // A fatia que pisa não sobe: sem altura não é estrutura, e fica no chão.
      if (z > 0) cena.sombras.push({ forma: dentroDe(pe, faixa(de, ate)), z, solta: true })
      const fatia: Forma = { b: faixa(de - sobra, ate + sobra).b, d: pe.d }
      L.push(P(fatia, mad, { eixo: a, tabua: 0, bisel: raioDoPe * 0.85, contorno: 0.28, tom: tom * TOM_DO_PE, semente: 3210 + i, textura: soNaFatia(ux, uy, de - sobra, ate + sobra) }))
    }
  })

  // O ASSENTO: a estrutura é só o miolo (com a caixa da pegada, para ser a última a pintar), sem sombra própria.
  const miolo = elipse(0, 0, RAIO_DO_MIOLO * R, RAIO_DO_MIOLO * R)
  cena.sombras.push({ forma: { b: [-R, -R, R, R], d: miolo.d }, z: zAssento, solta: true, forca: 0 })
  const assento = elipse(0, 0, rAssento, rAssento)
  const [lx, ly] = desgirado(SOMBRA_X, SOMBRA_Y, c.giro)
  const comprimento = Math.hypot(lx, ly)
  L.push(P(assento, mad, { dx: ESPESSURA_A_DIREITA * k, dy: espessura, eixo: VEIO_DO_ASSENTO, tabua: 0, bisel: 0.7 * k, contorno: 0.24, tom: tom * TOM_DA_ESPESSURA, semente: 3230 }))
  L.push(P(assento, mad, { eixo: VEIO_DO_ASSENTO, tabua: 0, bisel: 1.5 * k, contorno: 0.14, tom, semente: 3231, textura: texDoAssento(rAssento, [lx / comprimento, ly / comprimento]) }))
}
