/**
 * PIA MODERNA de cima com volume (refeita em 15/11/2026, pedido do mestre: "faz
 * um rework da pia também, [...] faz uma moderna"). Até então era a cuba de
 * pedra cavada num tampo de tábuas, com o balde de água ao lado (28/10/2026).
 * Agora é a pia de cozinha de hoje, par da geladeira de inox: a BANCADA de
 * pedra polida, a CUBA funda de aço escovado embutida por baixo dela, o
 * ESCORREDOR de frisos cavados na pedra ao lado da cuba, a RODABANCA (a faixa de
 * pedra encostada na parede) e a TORNEIRA gourmet de bica alta e curva, com a
 * alavanca do lado do escorredor. A frente é o lado de baixo.
 *
 * DE CIMA aparecem a bancada clara, a cuba (as paredes de aço na sombra do
 * canto de cima à esquerda, o fundo escovado e o ralo com a cestinha), os frisos
 * do escorredor e, atrás da cuba, a base da torneira com a bica apontando para o
 * meio da cuba e a sombra dela no aço. A 25% de zoom sobram o retângulo claro e,
 * nele, o retângulo cinza da cuba: é o que diz "pia". A sombra no chão é a do
 * armário, na altura do balcão (0,62 casa, e não 0,8 como a de pedra): posta ao
 * lado do balcão, a bancada corre na mesma linha na vista 3/4.
 *
 * NA 3/4 A FRENTE É O ARMÁRIO DE BAIXO, desenhado de frente e guardado em faixas
 * debaixo da bancada como a frente do balcão (`guardaRoupa.ts`): a beira da
 * bancada com o fio de luz do polido e a sombra que ela faz, as portas lisas de
 * madeira (uma a cada meia casa, abrindo do meio) com os puxadores retos de inox
 * junto da fresta, como os da geladeira, e o rodapé escuro recuado. GIRADA, a
 * face que fica embaixo na tela é desenhada do mesmo jeito (`guardarFaceGirada`):
 * de lado, a lateral do armário com a beira das portas na quina da frente e o
 * recorte do rodapé; de costas, o fundo acabado de ilha, em dois painéis.
 *
 * A TORNEIRA FICA EM PÉ NA 3/4: a bica alta é a peça que mais diz "moderna". A
 * 3/4 só sobe cada peça da vista de cima (`tresQuartos.ts`), então ela tem duas
 * versões, cada uma presa a uma ÂNCORA (um tampo solto de um ponto só, sem
 * sombra, que não pinta nada; a ideia do gancho com carne):
 * - a de CIMA (a base, a bica e a alavanca vistas do alto) fica na âncora da
 *   base, na altura da bancada e mais ao norte que o corpo: na 3/4 a bancada é
 *   pintada por cima e a esconde;
 * - a de PÉ (a canopla, o tubo da bica em arco e a alavanca, projetados como a
 *   3/4 os vê) é montada NA TELA, já com o giro, e fica guardada debaixo da
 *   bancada na vista de cima (nasce deslocada para baixo a altura da âncora
 *   dela); a âncora fica na beira de baixo da pegada na tela, para a 3/4 a
 *   pintar por último, em cima da bancada. Girada, a bica aponta para onde o
 *   giro a leva: de lado aparece o arco inteiro.
 *
 * Materiais: `pedra` (a bancada, polida: o grão e as manchas da pedra pela
 * metade) e `madeira` (o armário). A cuba, a torneira, os puxadores e o rodapé
 * são de inox fixo, o mesmo aço da geladeira (`geladeira.ts`). O mapa antigo
 * abre com a pedra e a madeira que já tinha, agora na bancada e no armário.
 */
import { cadeia, caixa, capsula, elipse, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { CANTONEIRA, FRESTA, SOMBRA_DA_MADEIRA, fatiar, guardarFaceGirada, naFaixa, type OpcoesDaFrente, type PecaDaFrente } from './guardaRoupa'
import { ESCURO, ESCURO_DO_INOX, INOX, texEscovado } from './geladeira'
import { comMeioEm, quartosDeVolta } from './varalDeBandeirinhas'
import { desgirarCena } from './pipaDeitada'

/** Altura da bancada em casas: a do balcão (`balcao.ts`), para os dois correrem na mesma linha. */
const ALTURA = 0.62

// ---------- a bancada, de cima ----------

/**
 * A pedra polida: o tom da bancada e quanto sobra do grão e das manchas da pedra bruta. Clara, para a cuba de aço
 * (que fica na sombra dela mesma) se destacar até a 25% de zoom.
 */
const TOM_DA_BANCADA = 1.14
const POLIDO = 0.45
/** A rodabanca: a faixa de pedra encostada na parede, no fundo (px do protótipo). */
const RODABANCA = 2.4
/** Entre a rodabanca e a cuba fica a base da torneira; na frente da cuba, a beira de pedra (px). */
const ZONA_DA_TORNEIRA = 5.6
const BEIRA_DA_FRENTE = 4.6
/**
 * A pedra à esquerda da cuba (px), a parte da largura que a cuba ocupa e a cuba mais larga e mais funda, em casas:
 * na pia esticada a cuba para no tamanho de uma cuba de verdade e o resto é bancada.
 */
const MARGEM_DA_CUBA = 4.2
const PARTE_DA_CUBA = 0.52
const CUBA_MAXIMA = 0.6
const CUBA_MAIS_FUNDA = 0.42
/** O canto da cuba e a parede de aço entre a boca e o fundo (px). */
const RAIO_DA_CUBA = 2.6
const PAREDE_DA_CUBA = 1.8
/** O ralo no meio da cuba: o aro, o furo e o pino da cestinha (px). */
const RALO = { aro: 2.4, furo: 1.35, pino: 0.5 } as const
/**
 * O escorredor cavado na pedra: a folga da cuba, o comprimento máximo (casas) e o mínimo para caber, a margem dos
 * frisos dentro do rebaixo, o friso e o passo entre dois (px).
 */
const ESCORREDOR = { folga: 2.6, comprimento: 0.34, minimo: 6, margem: 1.6, raio: 0.4, passo: 3.4 } as const
/** O rebaixo raso do escorredor (um degrau mais escuro que a bancada) e os frisos dentro dele. */
const TOM_DO_REBAIXO = 0.95
const TOM_DO_FRISO = 0.78

/**
 * O inox da cuba: a boca e as paredes, na sombra, e o fundo escovado, um degrau mais escuro que a bancada (com o tom
 * da geladeira a cuba sumia na pedra clara a 25% de zoom: os dois ficavam com a mesma luz).
 */
const TOM_DA_BOCA = 0.6
const TOM_DO_FUNDO = 0.78

/**
 * A pedra polida: a textura da pedra escolhida com o grão e as manchas pela metade (a bancada lixada não tem a
 * aspereza da pedra da lápide ou do pilar). O lugar continua sendo a pedra do mapa: o granito, o arenito, a ardósia.
 */
const texDaPedra = texturaDaClasse('pedra')
const texPolida: Textura = (u, v, x, y, p, s, escala) => {
  if (texDaPedra === null) return
  const luz = s[3]
  texDaPedra(u, v, x, y, p, s, escala)
  s[3] = luz + (s[3] - luz) * POLIDO
  s[6] *= POLIDO
}

// ---------- a torneira ----------

/**
 * A torneira gourmet, em px do protótipo: a canopla (raio e altura), a subida reta do tubo até o arco, o raio do
 * arco, onde ele acaba (radianos abaixo do horizontal: a bica vira para baixo), o tubo, o bico e a alavanca (onde
 * sai do tubo, o comprimento, quanto sobe e o raio). A bica alcança `arco * (1 + cos(fim))` à frente da base.
 */
const TORNEIRA = {
  canopla: 2,
  alturaDaCanopla: 1,
  subida: 11,
  arco: 4,
  fim: 0.85,
  tubo: 0.8,
  bico: 1.05,
  alavanca: { altura: 3, comprimento: 3.2, sobe: 1.4, raio: 0.5 },
  passos: 12,
} as const
/** A base fica isto à esquerda da beira direita da cuba (px): a alavanca fica do lado do escorredor. */
const RECUO_DA_TORNEIRA = 4.6
/** A alavanca de cima aponta para o escorredor, um pouco para trás. */
const RUMO_DA_ALAVANCA: readonly [number, number] = [0.95, -0.31]
/** O cromo da torneira e dos puxadores: o do puxador da geladeira. */
const TOM_DO_CROMO = 1.14
const BRILHO_DO_CROMO = 0.7
/** A pegada na tela tem de sobrar isto em volta da torneira guardada (px): ela fica toda debaixo da bancada. */
const FOLGA_DA_GUARDADA = 2
/** A âncora da torneira em pé passa isto da beira de baixo da pegada na tela: a 3/4 a pinta por último. */
const DEPOIS_DA_BEIRA = 0.05

/** A âncora: um tampo solto de um ponto só, sem sombra. `sul` = o y em que a caixa dela acaba (a ordem da 3/4). */
function ancora(x: number, y: number, z: number, sul = y): { forma: Forma; z: number; solta: true; forca: 0; suave: number } {
  const forma: Forma = { b: [x, y, x, sul], d: (px, py) => (Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6 ? -1 : 1e3) }
  return { forma, z, solta: true, forca: 0, suave: 0.05 }
}

/** O ponto do objeto na tela depois de `q` quartos de volta (a conta da 3/4, `girarPonto` de `tresQuartos.ts`). */
function naTela(x: number, y: number, q: number): [number, number] {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** Onde fica a torneira (de cima, no referencial do objeto): a base, o rumo da bica (unitário) e o da alavanca. */
interface LugarDaTorneira {
  readonly x: number
  readonly y: number
  readonly bica: readonly [number, number]
  readonly alavanca: readonly [number, number]
}

/** O cromo da torneira, com o chanfro do tubo. */
function cromo(bisel: number, tom = TOM_DO_CROMO): OpcoesDaPeca {
  return { tabua: 0, bisel, tom, contorno: 0.24, metal: BRILHO_DO_CROMO, textura: texEscovado, semente: 660 }
}

/** A torneira vista de CIMA, presa à âncora da base (na 3/4 a bancada a cobre). */
function torneiraDeCima(P: CriarPeca, cena: Cena, t: LugarDaTorneira, H: number): void {
  cena.sombras.push(ancora(t.x, t.y, H))
  const presa = (f: Forma): Forma => comMeioEm(f, t.x, t.y)
  const alcance = 2 * TORNEIRA.arco
  const bico = TORNEIRA.arco * (1 + Math.cos(TORNEIRA.fim))
  const [bx, by] = t.bica
  const [ax, ay] = t.alavanca
  const L = cena.partes
  L.push(P(presa(elipse(t.x, t.y, TORNEIRA.canopla, TORNEIRA.canopla)), INOX, { ...cromo(1, 1.04), projeta: { dist: 0.9, forca: 0.3 } }))
  const c = TORNEIRA.alavanca.comprimento
  L.push(P(presa(capsula(t.x, t.y, t.x + ax * c, t.y + ay * c, TORNEIRA.alavanca.raio + 0.1)), INOX, { ...cromo(0.5), projeta: { dist: 1.4, forca: 0.26 } }))
  L.push(P(presa(capsula(t.x, t.y, t.x + bx * alcance, t.y + by * alcance, TORNEIRA.tubo + 0.1)), INOX, { ...cromo(0.8, 1.18), projeta: { dist: 3.4, forca: 0.26, suave: 1.3 } }))
  const nx = t.x + bx * bico
  const ny = t.y + by * bico
  L.push(P(presa(elipse(nx, ny, TORNEIRA.bico + 0.15, TORNEIRA.bico + 0.15)), INOX, cromo(0.9, 1.02)))
  L.push(P(presa(elipse(nx, ny, 0.55, 0.55)), ESCURO, { tabua: 0, bisel: 0.3, tom: 1.3, contorno: 0.1, semente: 661 }))
}

/**
 * A torneira EM PÉ, como a 3/4 a vê, montada na tela (`q` quartos de volta já dados) e guardada debaixo da bancada.
 * `hx` e `hy` = a meia pegada na tela. Na tela a 3/4 leva o ponto (x, y) na altura z a (x, y - z); aqui cada ponto
 * nasce descido a altura `Z` da âncora, que a 3/4 tira de volta.
 */
function torneiraEmPe(P: CriarPeca, cena: Cena, t: LugarDaTorneira, H: number, q: number, hx: number, hy: number): void {
  const [xs, ys] = naTela(t.x, t.y, q)
  const [dx, dy] = naTela(t.bica[0], t.bica[1], q)
  const [ex, ey] = naTela(t.alavanca[0], t.alavanca[1], q)
  const projetar = (h: number, z: number): Ponto => [xs + h * dx, ys + h * dy - z]
  // O tubo: a subida reta, da canopla ao começo do arco, e o arco até o bico virado para baixo.
  const zArco = H + TORNEIRA.subida
  const tubo: Ponto[] = [[xs, ys - H - TORNEIRA.alturaDaCanopla], [xs, ys - zArco]]
  for (let k = 1; k <= TORNEIRA.passos; k += 1) {
    const a = Math.PI - ((Math.PI + TORNEIRA.fim) * k) / TORNEIRA.passos
    tubo.push(projetar(TORNEIRA.arco * (1 + Math.cos(a)), zArco + TORNEIRA.arco * Math.sin(a)))
  }
  const bico = tubo[tubo.length - 1]
  const al = TORNEIRA.alavanca
  const raizDaAlavanca: Ponto = [xs, ys - H - al.altura]
  const pontaDaAlavanca: Ponto = [xs + al.comprimento * ex, ys + al.comprimento * ey - H - al.altura - al.sobe]

  // A altura da âncora: a torneira guardada fica no meio da pegada na tela, longe das beiras. Nunca abaixo da
  // bancada: o ponto da âncora fica dentro do corpo, e a 3/4 sobe a peça com a estrutura MAIS ALTA que contém o meio
  // dela (no empate, a menor: a âncora não tem área). De costas, centrada, ela ficava abaixo e subia com o corpo.
  const ys0 = Math.min(...tubo.map((p) => p[1]), pontaDaAlavanca[1]) - TORNEIRA.tubo
  const ys1 = ys - H + TORNEIRA.canopla
  const Z = Math.max(H, -(ys0 + ys1) / 2)
  const xs0 = Math.min(xs - TORNEIRA.canopla, ...tubo.map((p) => p[0] - TORNEIRA.bico), pontaDaAlavanca[0] - al.raio)
  const xs1 = Math.max(xs + TORNEIRA.canopla, ...tubo.map((p) => p[0] + TORNEIRA.bico), pontaDaAlavanca[0] + al.raio)
  // Pegada pequena demais para guardar a torneira em pé: fica só a de cima (na 3/4, debaixo da bancada).
  if (ys0 + Z < -hy + FOLGA_DA_GUARDADA || ys1 + Z > hy - FOLGA_DA_GUARDADA || xs0 < -hx + FOLGA_DA_GUARDADA || xs1 > hx - FOLGA_DA_GUARDADA) return

  const tela: Cena = { partes: [], sombras: [] }
  const mx = xs
  const my = ys - H + Z
  tela.sombras.push(ancora(mx, my, Z, hy + DEPOIS_DA_BEIRA))
  const guardada = (p: Ponto): Ponto => [p[0], p[1] + Z]
  const presa = (f: Forma): Forma => comMeioEm(f, mx, my)
  const por = (f: Forma, o: OpcoesDaPeca): void => {
    tela.partes.push(P(presa(f), INOX, o))
  }
  const [cx, cy] = guardada([xs, ys - H])
  por(capsula(cx, cy - TORNEIRA.alturaDaCanopla, cx, cy, TORNEIRA.canopla), { ...cromo(0.9, 0.96), projeta: { dist: 0.8, forca: 0.28 } })
  por(elipse(cx, cy - TORNEIRA.alturaDaCanopla, TORNEIRA.canopla, TORNEIRA.canopla), cromo(0.9, 1.1))
  const alavanca = (): void => {
    const [ra, rb] = [guardada(raizDaAlavanca), guardada(pontaDaAlavanca)]
    por(capsula(ra[0], ra[1], rb[0], rb[1], al.raio), { ...cromo(al.raio * 0.9), projeta: { dist: 1.2, forca: 0.25 } })
  }
  // A alavanca que aponta para trás fica atrás do tubo; a que vem para a frente, na frente dele.
  if (ey <= 0) alavanca()
  por(cadeia(tubo.map(guardada), TORNEIRA.tubo), { ...cromo(TORNEIRA.tubo * 0.9), eixo: QUARTO, projeta: { dist: 1.6, forca: 0.3, suave: 1 } })
  const [bx, by] = guardada(bico)
  por(elipse(bx, by, TORNEIRA.bico, TORNEIRA.bico), cromo(TORNEIRA.bico * 0.9, 1.02))
  if (ey > 0) alavanca()

  if (q === 0) {
    cena.partes.push(...tela.partes)
    cena.sombras.push(...tela.sombras)
  } else {
    desgirarCena(tela, q, cena)
  }
}

// ---------- o armário, desenhado de frente ----------

/** A beira da bancada vista de frente, o fio de luz do polido, a sombra dela nas portas e o rodapé recuado (px). */
const BEIRA_DA_BANCADA = 3.2
const FIO_DE_LUZ = 0.6
const ALTO_DA_SOMBRA = 2.2
const RODAPE = 3.9
/** A lateral do armário que sobra de cada lado das portas, a fresta entre duas portas e a folga em cima e embaixo (px). */
const LATERAL = 0.9
const VAO = 0.9
const FOLGA_DE_CIMA = 0.6
const FOLGA_DE_BAIXO = 0.5
/** Uma porta a cada tanto de largura, em casas. */
const LARGURA_DA_PORTA = 0.5
/** O puxador reto, de pé junto da fresta: a distância da beira da porta, a folga do alto, o comprimento e o raio (px). */
const PUXADOR = { afastamento: 2.4, doAlto: 2.2, comprimento: 7.2, raio: 0.62 } as const
/** A madeira de frente: o corpo que aparece nas frestas, as portas lisas, a lateral e o fundo acabado. */
const TOM_DO_CORPO = 0.74
const TOM_DA_PORTA = 1
const TOM_DA_LATERAL = 0.86
const TOM_DO_FUNDO_DE_ILHA = 0.84
/** A beira da bancada de frente e o fio de luz dela. */
const TOM_DA_BEIRA = 0.96
const TOM_DO_FIO = 1.3

/** A madeira de pé (veio de cima a baixo, sem tábuas: a porta lisa). */
function madeiraDePe(tom: number, semente: number, bisel: number): OpcoesDaFrente {
  return { eixo: QUARTO, tabua: 0, bisel, tom, contorno: 0.2, semente }
}

/** A caixa entre dois x quaisquer (a quina pode ficar à esquerda ou à direita). */
function entre(xa: number, xb: number, y0: number, y1: number, raio: number): Forma {
  return caixa(Math.min(xa, xb), y0, Math.max(xa, xb), y1, raio)
}

/** O que corre no alto das três faces: a sombra da bancada no armário e, por cima, a beira de pedra com o fio de luz. */
function beiraDaBancada(pedra: MaterialDaPeca, xa: number, xb: number, H: number): PecaDaFrente[] {
  const alto = -H + BEIRA_DA_BANCADA
  return [
    { forma: caixa(xa + 0.5, alto - 0.3, xb - 0.5, alto + ALTO_DA_SOMBRA, 0), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.2, semente: 690 } },
    { forma: caixa(xa, -H, xb, alto, 0.5), mat: pedra, o: { eixo: 0, tabua: 0, bisel: 0.7, tom: TOM_DA_BEIRA, contorno: 0.18, textura: texPolida, semente: 691 } },
    { forma: caixa(xa + 0.6, -H + 0.3, xb - 0.6, -H + 0.3 + FIO_DE_LUZ, 0.3), mat: pedra, o: { eixo: 0, tabua: 0, bisel: 0.2, tom: TOM_DO_FIO, contorno: 0, alfa: 0.75, textura: texPolida, semente: 692 } },
  ]
}

/** O puxador reto de inox na porta: a sombra dele, os dois pés e a barra. `x` = o meio da barra; `topo` = o alto (y < 0). */
function puxador(x: number, topo: number): PecaDaFrente[] {
  const { comprimento, raio } = PUXADOR
  const pe = topo + comprimento
  const pecas: PecaDaFrente[] = [
    { forma: capsula(x + 1, topo + 1, x + 1, pe + 1, raio + 0.25), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1, semente: 693 } },
  ]
  for (const y of [topo + 0.9, pe - 0.9]) {
    pecas.push({ forma: caixa(x - 1, y - 0.7, x + 1, y + 0.7, 0.4), mat: INOX, o: { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.22, metal: 0.4, semente: 694 } })
  }
  pecas.push({ forma: capsula(x, topo, x, pe, raio), mat: INOX, o: { eixo: QUARTO, tabua: 0, bisel: raio * 0.9, tom: TOM_DO_CROMO, contorno: 0.24, metal: BRILHO_DO_CROMO, semente: 695 } })
  return pecas
}

/**
 * A FRENTE, de frente (x de `xa` a `xb`, y = 0 no chão e negativo para cima): o corpo que aparece nas frestas, o
 * rodapé escuro recuado, as portas lisas com os puxadores junto da fresta do meio e a beira da bancada por cima.
 */
function desenharFrente(c: ContextoDoMovel, H: number, xa: number, xb: number): PecaDaFrente[] {
  const mad = c.m.madeira
  const pecas: PecaDaFrente[] = [
    { forma: caixa(xa, -H, xb, 0, 0.5), mat: mad, o: madeiraDePe(TOM_DO_CORPO, 670, 0.9) },
    { forma: caixa(xa + LATERAL, -RODAPE, xb - LATERAL, 0, 0.3), mat: ESCURO, o: { tabua: 0, bisel: 0.4, contorno: 0.1, recesso: { k: 1.2, forca: 0.3 }, semente: 671 } },
  ]
  const largura = xb - xa
  const portas = Math.max(1, Math.round(largura / (c.g * LARGURA_DA_PORTA)))
  const larguraDaPorta = (largura - 2 * LATERAL - (portas - 1) * VAO) / portas
  const topo = H - BEIRA_DA_BANCADA - FOLGA_DE_CIMA
  const pe = RODAPE + FOLGA_DE_BAIXO
  for (let i = 0; i < portas; i += 1) {
    const x0 = xa + LATERAL + i * (larguraDaPorta + VAO)
    const x1 = x0 + larguraDaPorta
    pecas.push({ forma: caixa(x0, -topo, x1, -pe, 0.6), mat: mad, o: madeiraDePe(TOM_DA_PORTA, 672 + i, 0.9) })
    // As portas abrem em pares, do meio: a par tem o puxador à direita; a ímpar, à esquerda (a sozinha, à direita).
    const xPuxador = i % 2 === 0 ? x1 - PUXADOR.afastamento : x0 + PUXADOR.afastamento
    pecas.push(...puxador(xPuxador, -topo + PUXADOR.doAlto))
  }
  pecas.push(...beiraDaBancada(c.m.pedra, xa, xb, H))
  return pecas
}

/** A espessura das portas vista de lado, na quina da frente, a junta escura e o recorte do rodapé (px). */
const PORTA_DE_LADO = 1.4
const JUNTA = 0.4
const RECORTE_DO_RODAPE = 2.2

/**
 * A LATERAL, de frente (x na tela): a chapa de madeira do armário, a beira das portas na quina da frente (`quina` =
 * -1 à esquerda na tela, 1 à direita) com a junta escura, o recorte escuro do rodapé no pé da quina e a beira da
 * bancada por cima.
 */
function desenharLateral(c: ContextoDoMovel, H: number, hx: number, quina: -1 | 1): PecaDaFrente[] {
  const mad = c.m.madeira
  const xq = quina * hx
  const xPorta = xq - quina * PORTA_DE_LADO
  const topo = H - BEIRA_DA_BANCADA - FOLGA_DE_CIMA
  const pe = RODAPE + FOLGA_DE_BAIXO
  return [
    { forma: caixa(-hx, -H, hx, 0, 0.5), mat: mad, o: madeiraDePe(TOM_DA_LATERAL, 680, 0.9) },
    { forma: entre(xPorta, xPorta - quina * JUNTA, -topo, -pe, 0), mat: ESCURO, o: { tabua: 0, bisel: 0, contorno: 0, semente: 681 } },
    { forma: entre(xq, xPorta, -topo, -pe, 0.4), mat: mad, o: madeiraDePe(TOM_DA_PORTA, 682, 0.5) },
    { forma: entre(xq, xq - quina * RECORTE_DO_RODAPE, -RODAPE, 0, 0.3), mat: ESCURO, o: { tabua: 0, bisel: 0.3, contorno: 0.1, recesso: { k: 1, forca: 0.3 }, semente: 683 } },
    ...beiraDaBancada(c.m.pedra, -hx, hx, H),
  ]
}

/** As COSTAS, de frente: o fundo acabado de ilha (os painéis lisos com a junta entre eles), o pé e a beira da bancada. */
function desenharCostas(c: ContextoDoMovel, H: number, hx: number): PecaDaFrente[] {
  const mad = c.m.madeira
  const pecas: PecaDaFrente[] = [{ forma: caixa(-hx, -H, hx, 0, 0.5), mat: mad, o: madeiraDePe(TOM_DO_CORPO, 685, 0.9) }]
  const paineis = Math.max(1, Math.round((2 * hx) / c.g))
  const largura = (2 * hx - 2 * LATERAL - (paineis - 1) * VAO) / paineis
  const topo = H - BEIRA_DA_BANCADA - FOLGA_DE_CIMA
  for (let i = 0; i < paineis; i += 1) {
    const x0 = -hx + LATERAL + i * (largura + VAO)
    pecas.push({ forma: caixa(x0, -topo, x0 + largura, -0.6, 0.5), mat: mad, o: madeiraDePe(TOM_DO_FUNDO_DE_ILHA, 686 + i, 0.8) })
  }
  pecas.push({ forma: caixa(-hx + 0.4, -0.9, hx - 0.4, 0, 0.2), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.35, suave: 0.6, semente: 688 } })
  pecas.push(...beiraDaBancada(c.m.pedra, -hx, hx, H))
  return pecas
}

/** A frente guardada debaixo da bancada (sem giro): o corpo até as frestas, as cantoneiras, as frestas e as cópias. */
function guardarAFrente(c: ContextoDoMovel, cena: Cena, H: number): void {
  const { hw, hh, h } = c
  const { faixas, frente } = fatiar(H, 0, 0, h, hh)
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1.2), z: H })
  for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
  for (const fx of faixas) {
    if (fx.topo > fx.pe) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
  }
  const desenho = desenharFrente(c, H, -hw, hw)
  for (const fx of faixas) {
    for (const peca of desenho) {
      const copia = naFaixa(c.peca, peca, fx)
      if (copia !== null) cena.partes.push(copia)
    }
  }
}

// ---------- a pia ----------

export const montarPia: MontarMovel = (c, cena) => {
  const { hw, hh, w, g, peca: P } = c
  const pedra = c.m.pedra
  const H = g * ALTURA
  const quartos = quartosDeVolta(c.giro)
  // O pixel escuro demais é levantado no escuro do inox (com o padrão, a nogueira, a beira da cuba na sombra da
  // torneira e o rodapé saíam marrons).
  cena.corDoPiso = ESCURO_DO_INOX

  // O armário: a frente (sem giro) ou a face que o giro põe embaixo na tela, guardadas debaixo da bancada.
  if (quartos === 0) guardarAFrente(c, cena, H)
  else if (quartos % 2 === 1) guardarFaceGirada(P, cena, quartos, H, { xa: -hh, xb: hh, y0: -hw, y1: hw, raio: 1.2 }, desenharLateral(c, H, hh, quartos === 1 ? -1 : 1))
  else guardarFaceGirada(P, cena, quartos, H, { xa: -hw, xb: hw, y0: -hh, y1: hh, raio: 1.2 }, desenharCostas(c, H, hw))
  cena.sombras.push(contato(caixa(-hw, -hh, hw, hh, 1.2)))

  // A cuba: encostada à esquerda, entre a zona da torneira e a beira da frente.
  const x0 = -hw + MARGEM_DA_CUBA
  const x1 = Math.min(x0 + Math.min(PARTE_DA_CUBA * w, CUBA_MAXIMA * g), hw - MARGEM_DA_CUBA)
  const y0 = -hh + RODABANCA + ZONA_DA_TORNEIRA
  const y1 = Math.max(y0 + 2 * RAIO_DA_CUBA + 2, Math.min(hh - BEIRA_DA_FRENTE, y0 + CUBA_MAIS_FUNDA * g))
  const xm = (x0 + x1) / 2
  const ym = (y0 + y1) / 2
  const bica: [number, number] = [xm - (x1 - RECUO_DA_TORNEIRA), ym - (-hh + RODABANCA + ZONA_DA_TORNEIRA / 2)]
  const tamanho = Math.hypot(bica[0], bica[1]) || 1
  const torneira: LugarDaTorneira = {
    x: x1 - RECUO_DA_TORNEIRA,
    y: -hh + RODABANCA + ZONA_DA_TORNEIRA / 2,
    bica: [bica[0] / tamanho, bica[1] / tamanho],
    alavanca: RUMO_DA_ALAVANCA,
  }

  // A torneira em pé vem antes da bancada na lista: de cima ela fica escondida debaixo da pedra.
  const [hx, hy] = quartos % 2 === 1 ? [hh, hw] : [hw, hh]
  torneiraEmPe(P, cena, torneira, H, quartos, hx, hy)

  const L = cena.partes
  // A bancada e a rodabanca, com a sombra dela na pedra.
  L.push(P(caixa(-hw, -hh, hw, hh, 1.2), pedra, { tabua: 0, bisel: 1.5, tom: TOM_DA_BANCADA, contorno: 0.24, textura: texPolida, semente: 641 }))
  L.push(P(caixa(-hw + 0.3, -hh, hw - 0.3, -hh + RODABANCA, 0.5), pedra, { tabua: 0, bisel: 0.7, tom: TOM_DA_BANCADA * 0.97, contorno: 0.2, textura: texPolida, semente: 642, projeta: { dist: 1.1, forca: 0.24 } }))

  // A cuba de inox: a boca com as paredes na sombra, o fundo escovado e o ralo com a cestinha.
  L.push(P(caixa(x0, y0, x1, y1, RAIO_DA_CUBA), INOX, { tabua: 0, bisel: 0.5, tom: TOM_DA_BOCA, contorno: 0.34, metal: 0.15, recesso: { k: 2.6, forca: 0.42 }, textura: texEscovado, semente: 643 }))
  const p = PAREDE_DA_CUBA
  L.push(P(caixa(x0 + p, y0 + p, x1 - p, y1 - p, Math.max(0.5, RAIO_DA_CUBA - p * 0.6)), INOX, { tabua: 0, bisel: 1.2, tom: TOM_DO_FUNDO, contorno: 0.05, metal: 0.25, recesso: { k: 1, forca: 0.18 }, textura: texEscovado, semente: 644 }))
  L.push(P(elipse(xm, ym, RALO.aro, RALO.aro), INOX, { tabua: 0, bisel: 0.8, tom: 1, contorno: 0.26, metal: 0.5, textura: texEscovado, semente: 645 }))
  L.push(P(elipse(xm, ym, RALO.furo, RALO.furo), ESCURO, { tabua: 0, bisel: 0.3, contorno: 0.1, recesso: { k: 0.8, forca: 0.4 }, semente: 646 }))
  L.push(P(elipse(xm, ym, RALO.pino, RALO.pino), INOX, { tabua: 0, bisel: 0.4, tom: 1.1, contorno: 0.2, metal: 0.5, semente: 647 }))

  // O escorredor: o rebaixo raso na pedra, ao lado da cuba, com os frisos deitados que correm para ela.
  const ex0 = x1 + ESCORREDOR.folga
  const ex1 = Math.min(hw - MARGEM_DA_CUBA, ex0 + ESCORREDOR.comprimento * g)
  if (ex1 - ex0 >= ESCORREDOR.minimo) {
    L.push(P(caixa(ex0, y0, ex1, y1, 1.6), pedra, { tabua: 0, bisel: 0.9, tom: TOM_DA_BANCADA * TOM_DO_REBAIXO, contorno: 0.14, recesso: { k: 1.1, forca: 0.22 }, textura: texPolida, semente: 649 }))
    const m = ESCORREDOR.margem
    const fy0 = y0 + m + 1
    const fy1 = y1 - m - 1
    const frisos = Math.max(2, Math.floor((fy1 - fy0) / ESCORREDOR.passo) + 1)
    for (let i = 0; i < frisos; i += 1) {
      const y = fy0 + ((fy1 - fy0) * i) / (frisos - 1)
      L.push(P(capsula(ex0 + m, y, ex1 - m, y, ESCORREDOR.raio), pedra, { tabua: 0, bisel: 0.3, tom: TOM_DA_BANCADA * TOM_DO_FRISO, contorno: 0.1, recesso: { k: 0.6, forca: 0.3 }, textura: texPolida, semente: 650 + i }))
    }
  }

  // A torneira de cima, por cima da cuba e da pedra.
  torneiraDeCima(P, cena, torneira, H)
}
