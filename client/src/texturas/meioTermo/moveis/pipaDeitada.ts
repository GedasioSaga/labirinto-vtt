/**
 * A PIPA DEITADA (lote 6 dos objetos novos, 11/11/2026): o que os barris
 * deitados (`barrisDeitados.ts`) e o tonel de adega (`tonelDeAdega.ts`) têm em
 * comum. Não é um objeto do catálogo: é o ajudante dos dois, como
 * `fogoDeCasa.ts` é o da lareira e da fornalha.
 *
 * O PROBLEMA. Uma pipa deitada é um cilindro bojudo. De cima aparece o DORSO
 * (as aduelas ao comprido, espremidas para os lados, e os aros atravessados);
 * na 3/4 aparece o TAMPO redondo de frente, com o dorso por trás dele em arco.
 * A regra da 3/4 (`tresQuartos.ts`) só sabe SUBIR peças: cada sombra com
 * altura é uma estrutura, e cada peça sobe a altura da estrutura que contém o
 * meio da caixa dela. Subir o dorso inteiro dá uma tábua chapada no ar.
 *
 * A SAÍDA é a do guarda-roupa (`guardaRoupa.ts`), levada um passo adiante. A
 * pipa como ela aparece na 3/4 é desenhada à parte, já no lugar da tela (o
 * QUADRO), e guardada, em fatias, debaixo do dorso da vista de cima, onde nada
 * dela aparece. Cada fatia fica PENDURADA num PINO: uma estrutura do tamanho
 * de um ponto, que só diz à 3/4 a altura da fatia. Na 3/4 as fatias sobem para
 * o lugar e o dorso da vista de cima sobe até a altura do eixo, onde fica
 * inteiro atrás do quadro (o contorno da pipa vista de cima é exatamente a
 * linha dos lados dela na 3/4). São três fatias: a calota da ponta de longe, o
 * corpo entre as duas linhas do eixo (guardado no mesmo lugar do dorso de
 * cima) e a metade de baixo do tampo de perto.
 *
 * O perfil da 3/4 de quem usa isto tem de ser `{ modo: 'derivado', espessura:
 * 0 }`: com a beirada padrão dos tampos soltos, cada pino ganharia um fio de
 * madeira para baixo.
 *
 * GIRO. Na 3/4 o quarto de volta do objeto é pintado na cena (`c.giro`), e o
 * desenho só é chamado girado para essa vista. Quem usa isto monta a cena
 * girada direto NA TELA (o tampo de trás para cá, ou a pipa de lado) e a
 * devolve ao referencial do objeto com `desgirarCena`; o motor a gira de volta.
 *
 * A LUZ do bojo é pintada na textura (a normal do cilindro contra a luz do
 * motor), como a cúpula do forno de pão: o chanfro do motor só arredonda a
 * beira.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, dentroDe, elipse, uniao, type Caixa, type Forma } from './formas'
import { bordaDaSombra, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Sombra, type Textura } from './motor'
import { QUARTO } from './contexto'

// ---------- as medidas da pipa ----------

/** Um aro: onde fica ao longo da pipa (0 = uma ponta, 1 = a outra) e a largura (px do protótipo). */
export interface Aro {
  readonly em: number
  readonly largura: number
}

/** As medidas de uma pipa (px do protótipo), sem dizer onde ela está. */
export interface Pipa {
  readonly comprimento: number
  /** O raio no bojo (o meio) e nas pontas (menor que o do bojo). */
  readonly raio: number
  readonly raioDaPonta: number
  /** A altura do eixo acima do chão: a do berço mais o raio. */
  readonly eixo: number
  /** Aduelas na meia volta de cima. */
  readonly aduelas: number
  readonly aros: readonly Aro[]
  readonly madeira: MaterialDaPeca
  readonly ferro: MaterialDaPeca
  readonly semente: number
}

/** Quanto o raio cai do bojo para a ponta: o perfil é um arco de elipse (1 - k t², t de -1 a 1). */
function quedaDoRaio(p: Pipa): number {
  return 1 - (p.raioDaPonta / p.raio) ** 2
}

/** O raio da pipa a `ao` px da ponta. */
export function raioEm(p: Pipa, ao: number): number {
  const t = Math.min(1, Math.max(-1, (2 * ao) / p.comprimento - 1))
  return p.raio * Math.sqrt(1 - quedaDoRaio(p) * t * t)
}

/** Quanto o raio muda por px ao longo da pipa (negativo do meio para a ponta de lá). */
function decliveEm(p: Pipa, ao: number): number {
  const t = Math.min(1, Math.max(-1, (2 * ao) / p.comprimento - 1))
  const k = quedaDoRaio(p)
  return ((-k * t) / Math.sqrt(1 - k * t * t)) * ((2 * p.raio) / p.comprimento)
}

// ---------- a textura do bojo ----------

/** De onde vem a luz do motor (`motor.ts`) e o meio-caminho entre ela e o olho, onde o ferro brilha. */
const LUZ: readonly [number, number, number] = [-0.62, -0.48, 0.62]
const BRILHO: readonly [number, number, number] = [-0.344, -0.267, 0.9]
/**
 * A luz do bojo numa vista: `forca` = quanto o tom muda com a inclinação
 * contra a luz; `beira` = quanto a beira escurece dos dois lados, mesmo do
 * lado da luz (cresce com o quanto a superfície está deitada, até
 * `DEITADO_MAXIMO`).
 */
interface LuzDoBojo {
  readonly forca: number
  readonly beira: number
}
/**
 * Com o eixo de pé na tela (de cima e na 3/4 de frente) só a beira fica de
 * lado: com a força do chanfro do motor (0,9) o lado da sombra virava uma faixa
 * quase preta; com 0,4 fica perto do tom da frente da 3/4 (0,74). A beira é o
 * que arredonda a pipa vista de cima (só com a luz, o lado claro lia como tábua).
 */
const LUZ_DE_PE: LuzDoBojo = { forca: 0.4, beira: 0.2 }
/**
 * De lado na 3/4 metade do que se vê é a frente e a barriga, viradas para cá
 * e para baixo: com a luz de pé elas caíam abaixo do piso de luz e eram
 * levantadas para o escuro da nogueira, uma faixa vermelha chapada. Com esta,
 * a frente fica em ~0,70 do tom e a barriga em ~0,60.
 */
const LUZ_DE_LADO: LuzDoBojo = { forca: 0.2, beira: 0.08 }
const DEITADO_MAXIMO = 1.2
/**
 * A sombra do bojo vale inteira até `SOMBRA_FIRME` e daí vai parando, sem
 * passar de `SOMBRA_MAXIMA`: mais que isso a beira do lado da sombra caía
 * abaixo do piso de luz e era levantada para o escuro da nogueira, uma faixa
 * vermelha na beira de uma pipa de carvalho.
 */
const SOMBRA_FIRME = 0.25
const SOMBRA_MAXIMA = 0.42
/** A fresta entre duas aduelas e a sombra que o aro faz na madeira ao lado dele (px do protótipo). */
const FRESTA_DA_ADUELA = 0.7
const SOMBRA_DO_ARO = 0.9
/** A beira do aro é esfumada nesta largura (px do protótipo): a 1x o corte seco serrilha. */
const BEIRA_DO_ARO = 0.5
const RAIZ_DE_2 = Math.SQRT2

/**
 * Pinta um ponto do bojo: a aduela (o tom dela, o veio ao comprido e a fresta
 * com a vizinha), o aro de ferro se o ponto está debaixo de um, e a luz do
 * cilindro. `volta` = a posição em volta da pipa, em aduelas (0 de um lado, o
 * número de aduelas do outro); `ao` = px a partir da ponta; (nx, ny, nz) = a
 * normal da superfície na tela.
 */
function pintarBojo(pipa: Pipa, volta: number, ao: number, nx: number, ny: number, nz: number, daVista: LuzDoBojo, p: Peca, s: Float32Array): void {
  const larguraDaAduela = (Math.PI * pipa.raio) / pipa.aduelas
  const j = Math.floor(volta)
  const naAduela = volta - j
  const hj = hash(j, p.semente, 811)
  const v = volta * larguraDaAduela
  let luz = (hj - 0.5) * 0.13
  // O veio corre ao comprido da aduela, sem emenda de topo (a aduela é uma tábua só, de ponta a ponta).
  luz += Math.sin((v + ruido(ao * 0.03 + hj * 97, j * 3.7 + 11) * 9) * 3.3) * 0.024
  luz += ruido(ao * 0.018 + hj * 31, v * 0.22 + j * 9) * 0.09 + ruido(ao * 0.35 + 5, v * 2.4) * 0.04
  const ateAFresta = Math.min(naAduela, 1 - naAduela) * larguraDaAduela
  if (ateAFresta < FRESTA_DA_ADUELA) luz -= 0.28 * (1 - ateAFresta / FRESTA_DA_ADUELA) ** 2
  let ferro = 0
  for (const aro of pipa.aros) {
    const meio = aro.em * pipa.comprimento
    const dentro = aro.largura / 2 - Math.abs(ao - meio)
    if (dentro > -BEIRA_DO_ARO / 2) ferro = Math.max(ferro, Math.min(1, 0.5 + dentro / BEIRA_DO_ARO))
    else if (-dentro < SOMBRA_DO_ARO) luz -= 0.16 * (1 + dentro / SOMBRA_DO_ARO)
  }
  const comprimentoDaNormal = Math.hypot(nx, ny, nz)
  if (ferro > 0) {
    const noOlho = (nx * BRILHO[0] + ny * BRILHO[1] + nz * BRILHO[2]) / comprimentoDaNormal
    const luzDoFerro = ruido(ao * 0.5 + 3, v * 0.16 + p.semente) * 0.1 + (noOlho > 0 ? noOlho ** 14 * 0.3 : 0)
    const ferroRgb: Rgb = pipa.ferro.rgb
    s[0] += (ferroRgb[0] - s[0]) * ferro
    s[1] += (ferroRgb[1] - s[1]) * ferro
    s[2] += (ferroRgb[2] - s[2]) * ferro
    luz += (luzDoFerro - luz) * ferro
  }
  const naLuz = (nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2]) / comprimentoDaNormal
  const deitado = Math.min(DEITADO_MAXIMO, 1 - nz / comprimentoDaNormal)
  const sombra = daVista.forca * (naLuz - LUZ[2]) - daVista.beira * deitado * Math.sqrt(deitado)
  const resto = SOMBRA_MAXIMA - SOMBRA_FIRME
  s[3] += luz + (sombra > -SOMBRA_FIRME ? sombra : -SOMBRA_FIRME - resto * (1 - Math.exp((sombra + SOMBRA_FIRME) / resto)))
}

/** O ângulo em volta da pipa (0 no alto, positivo para o lado de x maior) virado em aduelas. */
function voltaDo(pipa: Pipa, seno: number): number {
  return ((Math.asin(seno) + QUARTO) / Math.PI) * pipa.aduelas
}

/** O dorso visto de cima: o eixo ao longo de y, da ponta `yN` para o sul, em volta de x = `cx`. */
export function texDoDorsoDeCima(pipa: Pipa, cx: number, yN: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const ao = y - yN
    const seno = Math.min(1, Math.max(-1, (x - cx) / raioEm(pipa, ao)))
    pintarBojo(pipa, voltaDo(pipa, seno), ao, seno, -decliveEm(pipa, ao), Math.sqrt(1 - seno * seno), LUZ_DE_PE, p, s)
  }
}

/** Voltas da conta que acha de que ponto da pipa vem o pixel da 3/4 (o raio depende do ponto, e o ponto, do raio). */
const VOLTAS_DA_CONTA = 3

/**
 * O dorso na 3/4, com o eixo de pé na tela: `yN` = a ponta de longe NO CHÃO.
 * O ponto da pipa a `ao` px da ponta e no ângulo θ aparece em x = cx + R sen θ
 * e y = yN + ao - eixo - R cos θ: cada aro vira um arco, e a ponta de longe,
 * uma calota.
 */
export function texDoDorsoDeFrente(pipa: Pipa, cx: number, yN: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const dx = x - cx
    let raio = pipa.raio
    let ao = 0
    for (let i = 0; i < VOLTAS_DA_CONTA; i += 1) {
      const quadrado = raio * raio - dx * dx
      ao = Math.min(pipa.comprimento, Math.max(0, y + pipa.eixo + (quadrado > 0 ? Math.sqrt(quadrado) : 0) - yN))
      raio = raioEm(pipa, ao)
    }
    const seno = Math.min(1, Math.max(-1, dx / raio))
    pintarBojo(pipa, voltaDo(pipa, seno), ao, seno, -decliveEm(pipa, ao), Math.sqrt(1 - seno * seno), LUZ_DE_PE, p, s)
  }
}

/**
 * O bojo na 3/4, com a pipa de lado: o eixo deitado na tela, da ponta `xO`
 * para leste, na altura `yEixo` da tela. De lado aparecem três quartos da
 * volta, do alto de trás (45° para lá do topo) até a barriga (45° para cá do
 * lado): o ponto no ângulo θ fica a raiz de 2 x R x sen(θ - 45°) do eixo.
 */
export function texDoBojoDeLado(pipa: Pipa, xO: number, yEixo: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const ao = x - xO
    const seno = Math.min(1, Math.max(-1, (y - yEixo) / (RAIZ_DE_2 * raioEm(pipa, ao))))
    const angulo = Math.asin(seno) + QUARTO / 2
    pintarBojo(pipa, ((angulo + QUARTO) / Math.PI) * pipa.aduelas, ao, -decliveEm(pipa, ao), Math.sin(angulo), Math.cos(angulo), LUZ_DE_LADO, p, s)
  }
}

// ---------- as formas ----------

/** A forma `f` levada (dx, dy) para o lado. */
export function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** O contorno da pipa vista de cima, com o eixo ao longo de y: bojuda no meio, cortada reta nas duas pontas. */
export function contornoDeCima(pipa: Pipa, cx: number, yN: number): Forma {
  const meia = pipa.comprimento / 2
  return dentroDe(elipse(cx, yN + meia, pipa.raio, meia / Math.sqrt(quedaDoRaio(pipa))), caixa(cx - pipa.raio, yN, cx + pipa.raio, yN + pipa.comprimento))
}

/** A silhueta do dorso na 3/4 de frente: o contorno de cima subido até o eixo, mais a calota da ponta de longe. */
export function dorsoDeFrente(pipa: Pipa, cx: number, yN: number): Forma {
  return uniao(deslocada(contornoDeCima(pipa, cx, yN), 0, -pipa.eixo), elipse(cx, yN - pipa.eixo, pipa.raioDaPonta, pipa.raioDaPonta))
}

/** A silhueta do bojo na 3/4 de lado: o contorno de cima deitado, raiz de 2 vezes mais alto. */
export function bojoDeLado(pipa: Pipa, xO: number, yEixo: number): Forma {
  const meia = pipa.comprimento / 2
  const alto = RAIZ_DE_2 * pipa.raio
  return dentroDe(elipse(xO + meia, yEixo, meia / Math.sqrt(quedaDoRaio(pipa)), alto), caixa(xO, yEixo - alto, xO + pipa.comprimento, yEixo + alto))
}

// ---------- o quadro pendurado ----------

/**
 * O pino: uma estrutura do tamanho de um ponto em (x, y), na altura `z`. Tudo
 * o que tem o meio da caixa nele sobe `z` na 3/4. `ordem` = o y que a 3/4 usa
 * para saber quem pinta antes (do norte para o sul): o pino entra na fila como
 * se estivesse lá.
 */
export interface Pino {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly ordem: number
}

const MEIO_PINO = 0.15
const ALTO_DO_PINO = 0.25
/** A borda da sombra do pino (px do protótipo): ela não pinta nada, e com a borda da altura a imagem cresceria à toa. */
const BORDA_DO_PINO = 0.1

/**
 * Põe o pino na cena. A estrutura é a sombra solta sem força (não escurece o
 * chão). A caixa dela não fica em volta do ponto, e sim na `ordem`: a 3/4 lê
 * a caixa para a fila e para saber onde pintar a beirada (que assim não é
 * pintada: fora da caixa a forma não pinta), e lê a distância para saber que
 * peça está no pino.
 */
export function pregar(cena: Cena, pino: Pino): void {
  const ponto = caixa(pino.x - MEIO_PINO, pino.y - MEIO_PINO, pino.x + MEIO_PINO, pino.y + MEIO_PINO)
  const b: Caixa = [pino.x - MEIO_PINO, pino.ordem - ALTO_DO_PINO, pino.x + MEIO_PINO, pino.ordem]
  cena.sombras.push({ forma: { b, d: ponto.d }, z: pino.z, solta: true, forca: 0, suave: BORDA_DO_PINO })
}

/** A forma `f` com a caixa de pintura aberta por igual em volta do pino: o meio da caixa cai nele. */
export function noPino(f: Forma, pino: Pino): Forma {
  const mx = Math.max(Math.abs(f.b[0] - pino.x), Math.abs(f.b[2] - pino.x))
  const my = Math.max(Math.abs(f.b[1] - pino.y), Math.abs(f.b[3] - pino.y))
  return { b: [pino.x - mx, pino.y - my, pino.x + mx, pino.y + my], d: f.d }
}

/**
 * As opções de uma peça do quadro. Ela não projeta sombra nem tem
 * deslocamento: a cópia guardada escureceria o que está debaixo dela na vista
 * de cima.
 */
export type OpcoesDoQuadro = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'arco' | 'curvaY' | 'ruga'>

/** Uma peça do quadro: desenhada no lugar em que aparece NA TELA, na 3/4. */
export interface PecaDoQuadro {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDoQuadro
}

/** Quanto uma fatia passa por cima da vizinha (px do protótipo): sem isso sobraria um fio entre as duas. */
const EMENDA = 0.2
/** Até onde a forma de uma cópia continua valendo depois do corte: mais que o alcance do recesso e do chanfro. */
const FOLGA_DO_CORTE = 3
const FORA_DA_FATIA = 1e3

/**
 * Pendura uma peça do quadro no pino: a cópia dela, descida `pino.z` para o
 * lugar guardado (a 3/4 a sobe de volta), com a caixa aberta em volta do pino.
 * `faixa` = os y da tela que a cópia mostra; a textura esconde o resto e
 * devolve ao material as coordenadas da tela, para o veio não quebrar no corte.
 */
export function pendurar(P: CriarPeca, L: Peca[], peca: PecaDoQuadro, pino: Pino, faixa: readonly [number, number] = [-Infinity, Infinity]): void {
  const f = peca.forma
  const z = pino.z
  const visivel0 = Math.max(faixa[0], f.b[1]) - EMENDA
  const visivel1 = Math.min(faixa[1], f.b[3]) + EMENDA
  if (visivel1 - visivel0 <= 2 * EMENDA) return
  const corte0 = visivel0 - FOLGA_DO_CORTE
  const corte1 = visivel1 + FOLGA_DO_CORTE
  const guardada: Forma = {
    b: [f.b[0], visivel0 + z, f.b[2], visivel1 + z],
    d: (x, y) => (y - z < corte0 || y - z > corte1 ? FORA_DA_FATIA : f.d(x, y - z)),
  }
  const polar = peca.o.polar
  const eixo = peca.o.eixo ?? 0
  // O veio em volta de um centro desce junto com a cópia; o veio reto é corrigido na textura.
  const du = polar === undefined ? -z * Math.sin(eixo) : 0
  const dv = polar === undefined ? -z * Math.cos(eixo) : 0
  const doMaterial = peca.o.textura ?? texturaDaClasse(peca.mat.classe)
  const textura: Textura = (u, v, x, y, p, s, escala) => {
    const naTela = y - z
    if (naTela < visivel0 || naTela > visivel1) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u + du, v + dv, x, naTela, p, s, escala)
  }
  L.push(P(noPino(guardada, pino), peca.mat, { ...peca.o, polar: polar === undefined ? undefined : { ...polar, cy: polar.cy + z }, textura }))
}

/**
 * A sombra no chão de uma coisa que está NO AR, na altura `z`, sem virar
 * estrutura da 3/4: a mesma conta da sombra solta do motor (a forma afastada
 * pelo passo da sombra, com a borda e a força da altura), mas com altura zero.
 */
export function sombraNoAr(forma: Forma, z: number, forca = Math.max(0.16, 0.34 - 0.0022 * z)): Sombra {
  return { forma: deslocada(forma, SOMBRA_X * z, SOMBRA_Y * z), z: 0, suave: bordaDaSombra({ z }), forca }
}

/**
 * A altura do pino de um quadro que já está desenhado no lugar da tela (a
 * cena girada, que só existe para a 3/4): a estrutura precisa de alguma
 * altura, e este nada não se vê.
 */
const ALTURA_DO_QUADRO_NO_LUGAR = 0.02

/** O pino de um quadro que não precisa ser guardado: em (x, y), pintado na `ordem`. */
export function pinoNoLugar(x: number, y: number, ordem: number): Pino {
  return { x, y, z: ALTURA_DO_QUADRO_NO_LUGAR, ordem }
}

// ---------- a pipa com o eixo de pé na tela ----------

/** Onde o pino da calota e o do meio tampo ficam dentro da fatia guardada, em fração do raio da ponta. */
const FUNDO_DO_PINO_NA_FATIA = 0.7
/** A fatia do meio tampo e a calota ficam guardadas a esta distância da ponta do dorso (px do protótipo). */
const RECUO_DA_FATIA = 1
/** O dorso de cima sobe um nada menos que o eixo: fica atrás do quadro, e o pino dele entra na fila antes. */
const FOLGA_DO_DORSO = 0.3

/**
 * A pipa com o eixo de pé na tela, da ponta de longe `yN` (no chão) para o
 * sul, em volta de x = `cx`: a sombra no chão, o quadro da 3/4 guardado em
 * três fatias e, por cima, o dorso da vista de cima. `tampo` = as peças do
 * tampo de perto e do que mais vai no quadro (o batoque no alto), desenhadas
 * no lugar da tela; `deCima` = o que vai em cima do dorso na vista de cima.
 */
export function montarPipaDePe(P: CriarPeca, cena: Cena, pipa: Pipa, cx: number, yN: number, tampo: readonly PecaDoQuadro[], deCima: readonly PecaDoQuadro[]): void {
  const yS = yN + pipa.comprimento
  const meio = (yN + yS) / 2
  const longe = yN - pipa.eixo
  const perto = yS - pipa.eixo
  const ponta = pipa.raioDaPonta
  const contorno = contornoDeCima(pipa, cx, yN)
  cena.sombras.push(sombraNoAr(contorno, pipa.eixo))

  const dorso: PecaDoQuadro = {
    forma: dorsoDeFrente(pipa, cx, yN),
    mat: pipa.madeira,
    o: { bisel: 0.9, contorno: 0.26, textura: texDoDorsoDeFrente(pipa, cx, yN), semente: pipa.semente },
  }
  const noFundo = FUNDO_DO_PINO_NA_FATIA * ponta
  const fatias: readonly { readonly faixa: readonly [number, number]; readonly pino: Pino }[] = [
    // A calota da ponta de longe, guardada logo depois da ponta de trás do dorso.
    { faixa: [-Infinity, longe], pino: { x: cx, y: yN + RECUO_DA_FATIA + noFundo, z: pipa.eixo + ponta + RECUO_DA_FATIA, ordem: yN + RECUO_DA_FATIA + noFundo } },
    // O corpo, entre as duas linhas do eixo: guardado no mesmo lugar do dorso de cima.
    { faixa: [longe, perto], pino: { x: cx, y: meio + 2 * FOLGA_DO_DORSO, z: pipa.eixo, ordem: yS - 2 * FOLGA_DO_DORSO } },
    // A metade de baixo do tampo de perto, guardada logo antes da ponta da frente do dorso.
    { faixa: [perto, Infinity], pino: { x: cx, y: yS - RECUO_DA_FATIA - noFundo, z: pipa.eixo - ponta - RECUO_DA_FATIA, ordem: yS - FOLGA_DO_DORSO } },
  ]
  for (const fatia of fatias) {
    pregar(cena, fatia.pino)
    for (const peca of [dorso, ...tampo]) pendurar(P, cena.partes, peca, fatia.pino, fatia.faixa)
  }

  const pinoDoDorso: Pino = { x: cx, y: meio, z: pipa.eixo - FOLGA_DO_DORSO, ordem: yS - 3 * FOLGA_DO_DORSO }
  pregar(cena, pinoDoDorso)
  cena.partes.push(P(noPino(contorno, pinoDoDorso), pipa.madeira, { bisel: 0.9, contorno: 0.26, textura: texDoDorsoDeCima(pipa, cx, yN), semente: pipa.semente }))
  for (const peca of deCima) cena.partes.push(P(noPino(peca.forma, pinoDoDorso), peca.mat, peca.o))
}

// ---------- o giro ----------

type Quartos = 1 | 2 | 3

/** Os quartos de volta do giro que a 3/4 pinta (0 fora dela). */
export function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto da tela de volta no referencial do objeto (o contrário do giro que a 3/4 pinta). */
function desgirarPonto(x: number, y: number, q: Quartos): [number, number] {
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : [-y, x]
}

function desgirarCaixa(b: Caixa, q: Quartos): Caixa {
  return q === 1 ? [b[1], -b[2], b[3], -b[0]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [-b[3], b[0], -b[1], b[2]]
}

/** A forma da tela no referencial do objeto: o ponto do objeto é girado para a tela e lido lá. */
function desgirarForma(f: Forma, q: Quartos): Forma {
  const b = desgirarCaixa(f.b, q)
  if (q === 1) return { b, d: (x, y) => f.d(-y, x) }
  if (q === 2) return { b, d: (x, y) => f.d(-x, -y) }
  return { b, d: (x, y) => f.d(y, -x) }
}

/**
 * A peça da tela no referencial do objeto: a forma, o deslocamento, o veio e
 * o centro do veio em volta voltam; a textura própria recebe do motor o ponto
 * do objeto e lê o da tela, com a peça de antes. A luz, o recesso e a projeção
 * já são da tela. Vale para as peças sem `arco` nem `curvaY` (as daqui).
 */
function desgirarPeca(p: Peca, q: Quartos): Peca {
  const [dx, dy] = desgirarPonto(p.dx, p.dy, q)
  const tex = p.tex
  const polar = p.polar
  const naTela: Textura | null =
    tex === null
      ? null
      : q === 1
        ? (u, v, x, y, _doObjeto, s, escala) => tex(u, v, -y, x, p, s, escala)
        : q === 2
          ? (u, v, x, y, _doObjeto, s, escala) => tex(u, v, -x, -y, p, s, escala)
          : (u, v, x, y, _doObjeto, s, escala) => tex(u, v, y, -x, p, s, escala)
  return {
    ...p,
    forma: desgirarForma(p.forma, q),
    dx,
    dy,
    eixo: p.eixo - q * QUARTO,
    polar: polar === undefined ? undefined : { ...polar, cx: desgirarPonto(polar.cx, polar.cy, q)[0], cy: desgirarPonto(polar.cx, polar.cy, q)[1] },
    tex: naTela,
  }
}

/**
 * Leva para `cena`, no referencial do objeto, a cena montada NA TELA para o
 * objeto girado `quartos` quartos de volta (1, 2 ou 3): a 3/4 a gira de volta
 * (`girarCena`) e ela aparece como foi montada.
 */
export function desgirarCena(tela: Cena, quartos: number, cena: Cena): void {
  const q = quartos as Quartos
  for (const p of tela.partes) cena.partes.push(desgirarPeca(p, q))
  for (const s of tela.sombras) cena.sombras.push({ ...s, forma: desgirarForma(s.forma, q) })
  if (tela.corDoPiso !== undefined) cena.corDoPiso = tela.corDoPiso
}
