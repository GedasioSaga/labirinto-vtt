/**
 * ARMADILHA DE ESPINHOS de cima com volume (lote 13 dos objetos novos,
 * 11/11/2026, grupo Templo e masmorra): a armadilha de masmorra ARMADA. Uma
 * LAJE de pedra escura cheia de FUROS em grade, presa numa MOLDURA de pedra
 * talhada; de cada furo sai um ESPINHO de ferro pontudo, uns mais altos, uns
 * tortos, com ferrugem no pé e brilho na ponta. Entre a moldura e a laje, a
 * FRESTA do alçapão; na soleira da entrada, a PLACA DE PRESSÃO que dispara a
 * armadilha. Sem corpo, sem ossos e sem sangue.
 *
 * Vista de cima, cada espinho é o ferro forjado de seção quadrada visto do
 * alto, uma pirâmide de quatro faces: a face virada para a luz clara, a do
 * outro lado escura, a ferrugem na beira do pé, a ponta brilhante no bico, e
 * a SOMBRA curta deitada para baixo à direita, que é o que diz que os espinhos
 * sobem. A sombra do motor fica por baixo de todas as
 * peças (na laje ela não apareceria): a de cada espinho é PINTADA na laje,
 * uma cunha escura do pé até onde cai a sombra da ponta, mais comprida no
 * espinho mais alto.
 *
 * O desenho se REPARTE pelo tamanho: um espinho a cada `PASSO_DOS_ESPINHOS`
 * casa, nos dois sentidos, e um bloco de moldura a cada `BLOCO_DA_MOLDURA`;
 * esticada para cobrir um corredor, a laje ganha mais espinhos, nunca espinhos
 * maiores. A soleira fica numa ponta do lado maior (embaixo, se a laje é
 * quadrada ou em pé; à esquerda, se deitada): é a entrada do corredor.
 *
 * Na 3/4 (`tresQuartos.ts`; o perfil tem de ser `{ modo: 'derivado',
 * espessura: 0 }`, o da horta) cada espinho fica em pé como um CONE de perfil:
 * um tampo solto em triângulo, com a base no pé e o bico para cima NA TELA (o
 * desenho lê `c.giro`, a conta da cerca de ferro), tão alto quanto o espinho e
 * inclinado no torto. Sem beirada, o tampo é pintado inteiro, só subido meio
 * px. Em cima dele, o LADO CLARO (o terço virado para a luz, num ferro mais
 * claro), a LUVA de ferrugem no pé e o BRILHO, uma lasca de ferro polido no
 * lado claro perto do bico: outros três tampos soltos. Nenhum faz sombra (a do
 * espinho é a pintada). Cada um ganha o material de um pino sem tinta, com o
 * meio da caixa dentro dele (`comMeioEm`); todas as peças de cima (o cone, a
 * ponta, o furo, a mancha e a sombra pintada) levam o meio da caixa num ponto
 * fora de todo espinho e ficam no chão, onde o triângulo as cobre.
 *
 * É objeto de chão (as fichas passam por cima dela), mas com altura, como a
 * horta. Lê `c.giro` também para deixar NA TELA a luz do cone, o reflexo da
 * ponta e a sombra pintada.
 *
 * Materiais: `pedra` (a moldura, a laje e a placa) e `metal` (os espinhos). A
 * ferrugem, o escuro dos furos e a sombra pintada são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { anel, caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'

const VOLTA = Math.PI * 2

// ---------- medidas (casas, ou px do protótipo quando diz) ----------

/** Um espinho a cada tanto de casa, nos dois sentidos: é o que reparte a laje esticada. */
const PASSO_DOS_ESPINHOS = 0.165
/** A largura da moldura e a da soleira da entrada, onde fica a placa de pressão (casas). */
const MOLDURA = 0.085
const SOLEIRA = 0.23
/** Um bloco de moldura a cada tanto de casa, e a junta entre dois blocos (px). */
const BLOCO_DA_MOLDURA = 0.5
const JUNTA = 0.8
/** A soleira é sempre três blocos: a placa fica no do meio. */
const BLOCOS_DA_SOLEIRA = 3
/** A fresta do alçapão, entre a moldura e a laje que desce (px). */
const FRESTA = 1
/** O lado da placa de pressão (fração do bloco da soleira) e a fresta em volta dela (px). */
const PLACA_NA_SOLEIRA = 0.6
const FRESTA_DA_PLACA = 0.8
/** O sulco redondo no meio da placa: o raio (fração do lado) e a largura (px). */
const SULCO_DA_PLACA = 0.27
const LARGURA_DO_SULCO = 0.55
/** O furo, e o pé do espinho: o raio do cone visto do alto, que é a meia base do triângulo da 3/4 (px). */
const RAIO_DO_FURO = 2.8
const MEIA_BASE = 1.9
/** A ponta brilhante (raio, px), e o reflexo nela: o raio e quanto ele anda para a luz (px). */
const RAIO_DA_PONTA = 0.45
const RAIO_DO_REFLEXO = 0.26
const RECUO_DO_REFLEXO = 0.2
/** O espinho quebrado rente, no furo vazio (raio, px). */
const RAIO_DO_TOCO = 1.1
/** A altura do espinho, do meio do pé ao bico, sorteada entre as duas (casas). */
const ALTURA_MINIMA = 0.22
const ALTURA_MAXIMA = 0.34
/** Quantos espinhos saem tortos e quanto o bico anda para o lado (px); os retos ainda saem um nada fora do prumo. */
const TORTOS = 0.3
const TORTO = 1.4
const FORA_DO_PRUMO = 0.2
/** Quantos furos ficam vazios (o espinho quebrou rente): a grade de furos aparece também onde falta espinho. */
const VAZIOS = 0.08
/** Quantos furos têm a mancha de ferrugem em volta, e o tamanho dela (raio, px). */
const MANCHADOS = 0.5
const RAIO_DA_MANCHA = 3.8

// ---------- o cone de perfil, na 3/4 ----------

/** A base do triângulo fica um nada abaixo do meio do pé (px): o cone de cima aparece embaixo dela, como o pé redondo. */
const BASE_ABAIXO = 1
/** A divisa do lado claro, em fração da meia base, do meio para o lado da luz. */
const DIVISA_DA_LUZ = 0.3
/** A luva de ferrugem: a altura (px), o quanto ela sobra do cone de cada lado, quanto desce da base e o dente da beira de cima (px). */
const ALTURA_DA_LUVA = 2.1
const SOBRA_DA_LUVA = 0.2
const LUVA_ABAIXO = 0.3
const DENTE_DA_LUVA = 1
/** O brilho da ponta: a lasca do lado claro perto do bico (fração do cone, a partir do bico). */
const LASCA_DO_BRILHO = 0.3
/**
 * Quanto cada tampo sobe na 3/4 (px): quase nada, o bastante para a ordem. A
 * mais alta que contém o meio da caixa de um pino é a dele: o brilho acima da
 * luva, ela acima do lado claro, e ele acima do corpo.
 */
const SOBE_O_CORPO = 0.5
const SOBE_O_CLARO = 0.6
const SOBE_A_LUVA = 0.7
const SOBE_O_BRILHO = 0.8
/** O pino de cada tampo, sem tinta (raio, px), e as alturas em que se procura o meio da caixa dele (fração do cone acima da luva). */
const RAIO_DO_PINO = 0.3
const ALTURAS_DO_PINO: readonly number[] = [0.35, 0.5, 0.25, 0.62, 0.45, 0.15, 0.8, 0.95]
/** As alturas do meio da caixa do pino do brilho (fração da lasca, a partir do bico). */
const ALTURAS_NO_BRILHO: readonly number[] = [0.5, 0.65, 0.8, 0.35]

// ---------- onde fica o meio da caixa das peças do chão ----------

/** A que distância do pé (px) se procura o ponto livre das peças do chão de cada furo. */
const LONGE_DO_PE = 3.6
/** Quantas direções se tentam em volta, e a folga do ponto até a beira de cada espinho (px). */
const DIRECOES = 12
const FOLGA = 0.06
/** Onde se procura, ao longo de um bloco da moldura, um ponto fora de todo espinho (fração do bloco). */
const AO_LONGO_DO_BLOCO: readonly number[] = [0.5, 0.25, 0.75, 0.1, 0.9]

// ---------- cor, luz e tom ----------

/** A ferrugem do pé e das manchas na laje: o marrom-alaranjado baixo da cerca de ferro. */
const FERRUGEM: Rgb = rgb('#8c5b45')
/** O material do pé enferrujado: a luva da 3/4, o toco e o cone (de cima a textura pinta o ferro e a ferrugem). */
const PE: MaterialDaPeca = { classe: 'metal', rgb: FERRUGEM }
/** O escuro dos furos e das frestas: cinza quase preto, frio (o buraco de nogueira saía marrom na pedra cinza). */
const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x38, 0x36, 0x34] }
/** A sombra pintada de cada espinho na laje, e o alfa dela no miolo. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x16, 0x14, 0x12] }
const ALFA_DA_SOMBRA = 0.5
/** A meia largura da sombra pintada no pé, em fração da meia base. */
const SOMBRA_NO_PE = 0.7
/** O brilho da ponta na 3/4: ferro polido, quase branco (a frente da 3/4 ainda o multiplica por 0,74). */
const BRILHO: MaterialDaPeca = { classe: 'metal', rgb: [0xf0, 0xf2, 0xf5] }
/** A mancha de ferrugem em volta do furo: a ferrugem, meio transparente. */
const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: FERRUGEM }
const ALFA_DA_MANCHA = 0.3
/** O reflexo da ponta: quase branco, frio. */
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xec, 0xee, 0xf0] }
/** O piso de luz da pedra cinza (o do altar): com o escuro de sempre, o da nogueira, os furos saíam marrons. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]
/** Os tons da pedra: a moldura, o fundo das juntas, a laje que desce (mais escura: é o chão do alçapão) e a placa gasta, mais clara. */
const TOM_DA_MOLDURA = 1
const TOM_DAS_JUNTAS = 0.52
const TOM_DA_LAJE = 0.82
const TOM_DA_PLACA = 1.1
/**
 * Os tons do ferro: o cone de cima, a ponta afiada, e o corpo e o lado claro
 * do cone de perfil (a 3/4 ainda multiplica a frente por 0,74: o corpo fica no
 * escuro e o lado claro, um pouco acima do tom do ferro).
 */
const TOM_DO_FERRO = 1.3
const TOM_DA_PONTA = 1.3
const TOM_DO_CORPO = 1
const TOM_DO_LADO_CLARO = 1.7
/** O brilho do metal: pouco no cone e no toco (ferro velho), muito na ponta. */
const BRILHO_DO_CONE = 0.2
const BRILHO_DA_PONTA = 0.9
/** De onde vem a luz no chão (a de `motor.ts`: de cima, à esquerda), para a encosta do cone. */
const LUZ_X = -0.79
const LUZ_Y = -0.61
/** Quanto a face da pirâmide virada para a luz clareia, e quanto a do outro lado escurece. */
const LUZ_DA_FACE_CLARA = 0.45
const LUZ_DA_FACE_ESCURA = 0.22
/** A ferrugem do cone de cima: a partir de que fração do raio ela começa e em quanto ela fecha. */
const INICIO_DA_FERRUGEM = 0.7
const LARGURA_DA_FERRUGEM = 0.25

/** Círculo com a distância exata (a armadilha tem centenas, e a conta da elipse custa mais): o da horta. */
function circulo(cx: number, cy: number, r: number): Forma {
  return { b: [cx - r, cy - r, cx + r, cy + r], d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r }
}

/**
 * A mesma forma com a caixa de pintura centrada em (mx, my): o desenho não
 * muda (fora da forma nada pinta), mas o meio da caixa, que é o que a 3/4 lê
 * para saber com que estrutura a peça sobe, cai onde se quer (o da cerca de ferro).
 */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; de cima é sempre 0, quem gira é a imagem pronta): a conta do altar e da cerca de ferro.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

function suave01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
}

/**
 * O espinho visto do alto: o ferro forjado de seção quadrada, uma pirâmide de quatro faces com o pé em
 * (px, py) e o bico em (bx, by). As arestas saem do bico nos quatro rumos da tela (com um quarto de volta os
 * rumos continuam os mesmos), e cada face pega a luz pela direção dela ((lx, ly): de onde vem a luz, no
 * referencial do desenho): a de cima à esquerda clareia muito, a de baixo à direita escurece (sem chegar no
 * escuro do furo, onde sumiria), as outras duas ficam no meio. A aresta tem meio px de rampa na saída. A
 * ferrugem sobe da beira do pé em manchas e o ferro fica limpo perto do bico.
 */
function texDoCone(px: number, py: number, bx: number, by: number, ferro: Rgb, lx: number, ly: number): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    const fx = Math.max(-1, Math.min(1, (x - bx) * escala * 2))
    const fy = Math.max(-1, Math.min(1, (y - by) * escala * 2))
    const face = (fx * lx + fy * ly) * Math.SQRT1_2
    const fora = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py)) / MEIA_BASE
    const q = suave01((fora - INICIO_DA_FERRUGEM + ruido(x * 1.3 + p.su, y * 1.3 + p.sv) * 0.5) / LARGURA_DA_FERRUGEM)
    s[0] = ferro[0] + (FERRUGEM[0] - ferro[0]) * q
    s[1] = ferro[1] + (FERRUGEM[1] - ferro[1]) * q
    s[2] = ferro[2] + (FERRUGEM[2] - ferro[2]) * q
    s[3] += face * (face > 0 ? LUZ_DA_FACE_CLARA : LUZ_DA_FACE_ESCURA) + ruido(x * 0.8 + p.sv, y * 0.8 + p.su) * 0.05
  }
}

/** A cunha da sombra pintada: do pé (meia largura `r0`) até onde cai a sombra da ponta (meia largura `r1`). */
function cunha(ax: number, ay: number, bx: number, by: number, r0: number, r1: number): Forma {
  const dx = bx - ax
  const dy = by - ay
  const l = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = -dy / l
  const ny = dx / l
  return poligono([
    [ax + nx * r0, ay + ny * r0],
    [bx + nx * r1, by + ny * r1],
    [bx - nx * r1, by - ny * r1],
    [ax - nx * r0, ay - ny * r0],
  ])
}

/**
 * O referencial da laje: `u` ao comprido (a soleira na ponta de `u` alto), `v` de través. Em pé ou quadrada a
 * soleira fica embaixo (u desce); deitada, à esquerda (u anda para a esquerda).
 */
interface Referencial {
  em(u: number, v: number): Ponto
  ret(u0: number, v0: number, u1: number, v1: number, raio?: number): Forma
}

function referencial(emPe: boolean): Referencial {
  const em = (u: number, v: number): Ponto => (emPe ? [v, u] : [-u, v])
  return {
    em,
    ret(u0, v0, u1, v1, raio = 0) {
      const [ax, ay] = em(u0, v0)
      const [bx, by] = em(u1, v1)
      return caixa(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), raio)
    },
  }
}

/** Um tampo do cone de perfil (o corpo, o lado claro ou a luva), com o material e onde fica o meio da caixa do pino dele. */
interface Tampo {
  readonly forma: Forma
  readonly sobe: number
  readonly mat: MaterialDaPeca
  /** Os pontos, do melhor ao pior, em que o meio da caixa do pino cai dentro deste tampo e fora dos de cima dele. */
  readonly meios: readonly Ponto[]
}

interface Espinho {
  /** O pé (o meio do furo) e o bico visto do alto, px do protótipo. */
  readonly px: number
  readonly py: number
  readonly bx: number
  readonly by: number
  /** Do meio do pé ao bico, px do protótipo. */
  readonly altura: number
  /** O corpo, o lado claro e a luva; vazio no furo vazio (o espinho quebrou rente). */
  readonly tampos: readonly Tampo[]
  readonly k: number
}

export const montarArmadilhaDeEspinhos: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const emPe = c.h >= c.w
  const R = referencial(emPe)
  const mc = (emPe ? c.h : c.w) / 2
  const mv = (emPe ? c.w : c.h) / 2
  const moldura = Math.min(g * MOLDURA, mv * 0.25)
  const soleira = Math.min(g * SOLEIRA, mc * 0.45)
  const pedra = c.m.pedra
  const metal = c.m.metal
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  // O sorteio muda com o tamanho (como na cerca de ferro): lajes de tamanhos diferentes não repetem os tortos.
  const sorteio = Math.round(c.w + 7 * c.h)

  // As direções fixas NA TELA, no referencial do desenho: o "para cima" e o "para a direita" (o cone de perfil),
  // a luz, a sombra e o reflexo.
  const [nx, ny] = desgirado(0, -1, c.giro)
  const [tx, ty] = desgirado(1, 0, c.giro)
  const [lx, ly] = desgirado(LUZ_X, LUZ_Y, c.giro)
  const [sx, sy] = desgirado(SOMBRA_X, SOMBRA_Y, c.giro)
  const [rx, ry] = desgirado(-RECUO_DO_REFLEXO, -RECUO_DO_REFLEXO, c.giro)
  /** O ponto `cima` px para cima e `lado` px para a direita NA TELA, a partir de (x, y). */
  const naTela = (x: number, y: number, cima: number, lado: number): Ponto => [x + nx * cima + tx * lado, y + ny * cima + ty * lado]
  const tingido = (base: MaterialDaPeca, tom: number): MaterialDaPeca => ({ ...base, rgb: [base.rgb[0] * tom, base.rgb[1] * tom, base.rgb[2] * tom] })
  const corpoDeFerro = tingido(metal, TOM_DO_CORPO)
  const ladoClaro = tingido(metal, TOM_DO_LADO_CLARO)

  // O alçapão (entre a moldura e a soleira) e a laje que desce, uma fresta para dentro dele.
  const [u0, u1, v0, v1] = [-mc + moldura, mc - soleira, -mv + moldura, mv - moldura]
  const [lu0, lu1, lv0, lv1] = [u0 + FRESTA, u1 - FRESTA, v0 + FRESTA, v1 - FRESTA]

  // ---------- os espinhos: a grade, a altura, o torto e o cone de perfil da 3/4 ----------
  const passo = g * PASSO_DOS_ESPINHOS
  const nu = Math.max(1, Math.round((lu1 - lu0) / passo))
  const nv = Math.max(1, Math.round((lv1 - lv0) / passo))
  const espinhos: Espinho[] = []
  for (let i = 0; i < nu; i += 1) {
    for (let j = 0; j < nv; j += 1) {
      const [px, py] = R.em(lu0 + ((i + 0.5) * (lu1 - lu0)) / nu, lv0 + ((j + 0.5) * (lv1 - lv0)) / nv)
      const k = i * 64 + j
      if (hash(i, j, 231 + sorteio) < VAZIOS) {
        espinhos.push({ px, py, bx: px, by: py, altura: 0, tampos: [], k })
        continue
      }
      // O torto pende para um lado NA TELA (é o que a 3/4 mostra); de cima, o bico sai do meio para esse lado.
      const torto = hash(i, j, 233 + sorteio) < TORTOS
      const lado = (hash(i, j, 235 + sorteio) < 0.5 ? -1 : 1) * (torto ? TORTO * (0.65 + 0.35 * hash(i, j, 234 + sorteio)) : FORA_DO_PRUMO)
      const altura = g * (ALTURA_MINIMA + (ALTURA_MAXIMA - ALTURA_MINIMA) * hash(i, j, 232 + sorteio))
      const [bx, by] = naTela(px, py, 0, lado)
      // O triângulo: a base um nada abaixo do pé, o bico `altura` acima do meio do pé, pendendo `lado`.
      const alto = altura + BASE_ABAIXO
      const meioDaBase = naTela(px, py, -BASE_ABAIXO, 0)
      const noEixo = (h: number, fracao: number): Ponto => naTela(meioDaBase[0], meioDaBase[1], h, (lado * h) / alto + MEIA_BASE * (1 - h / alto) * fracao)
      const bico = noEixo(alto, 0)
      const corpo = poligono([bico, noEixo(0, 1), noEixo(0, -1)])
      const claro = poligono([bico, noEixo(0, -DIVISA_DA_LUZ), noEixo(0, -1)])
      const meiaLuva = (h: number): number => 1 + SOBRA_DA_LUVA / (MEIA_BASE * (1 - h / alto))
      const dente = (hash(i, j, 237 + sorteio) - 0.5) * DENTE_DA_LUVA
      const luva = poligono([
        noEixo(-LUVA_ABAIXO, -1 - SOBRA_DA_LUVA / MEIA_BASE),
        noEixo(-LUVA_ABAIXO, 1 + SOBRA_DA_LUVA / MEIA_BASE),
        noEixo(ALTURA_DA_LUVA, meiaLuva(ALTURA_DA_LUVA)),
        noEixo(ALTURA_DA_LUVA + dente, 0),
        noEixo(ALTURA_DA_LUVA, -meiaLuva(ALTURA_DA_LUVA)),
      ])
      // A lasca do brilho, no lado claro perto do bico. A caixa dela desce até a da luva: a 3/4 pinta as
      // estruturas pela beira de baixo da caixa, e o brilho tem de sair depois do corpo, que o cobriria.
      const inicioDaLasca = alto * (1 - LASCA_DO_BRILHO)
      const lasca = poligono([bico, noEixo(inicioDaLasca, -1), noEixo(inicioDaLasca, -DIVISA_DA_LUZ)])
      const lb = lasca.b
      const ub = luva.b
      const brilho: Forma = { b: [Math.min(lb[0], ub[0]), Math.min(lb[1], ub[1]), Math.max(lb[2], ub[2]), Math.max(lb[3], ub[3])], d: lasca.d }
      // O pino de cada tampo: o corpo no lado escuro, o claro no lado da luz, os dois acima da luva; a luva no
      // meio dela; o brilho no meio da lasca.
      const acimaDaLuva = (fracao: number): Ponto[] => ALTURAS_DO_PINO.map((f) => noEixo(ALTURA_DA_LUVA + 1 + (alto - ALTURA_DA_LUVA - 1) * f * 0.6, fracao))
      const tampos: Tampo[] = [
        { forma: corpo, sobe: SOBE_O_CORPO, mat: corpoDeFerro, meios: acimaDaLuva(0.5) },
        { forma: claro, sobe: SOBE_O_CLARO, mat: ladoClaro, meios: acimaDaLuva(-0.68) },
        { forma: luva, sobe: SOBE_A_LUVA, mat: PE, meios: [noEixo(ALTURA_DA_LUVA * 0.45, 0), noEixo(ALTURA_DA_LUVA * 0.3, 0.4), noEixo(ALTURA_DA_LUVA * 0.3, -0.4)] },
        { forma: brilho, sobe: SOBE_O_BRILHO, mat: BRILHO, meios: ALTURAS_NO_BRILHO.map((f) => noEixo(alto * (1 - LASCA_DO_BRILHO * f), -0.65)) },
      ]
      espinhos.push({ px, py, bx, by, altura, tampos, k })
    }
  }
  // Cada tampo ganha um pino sem tinta com o meio da caixa dentro dele e fora de todo outro tão alto ou mais: é
  // o que dá o material à frente dele na 3/4. O tampo sem lugar para o pino fica de fora (sem pino, a frente
  // sairia no material da laje). Os tampos não fazem sombra no chão (forca 0): a do espinho é a pintada.
  const todos = espinhos.flatMap((e) => e.tampos)
  const tampos: Tampo[] = []
  for (const e of espinhos) {
    e.tampos.forEach((t, n) => {
      const meio = t.meios.find(([x, y]) => t.forma.d(x, y) < -FOLGA && todos.every((o) => o === t || o.forma.d(x, y) > FOLGA || o.sobe < t.sobe))
      if (meio === undefined) return
      tampos.push(t)
      cena.sombras.push({ forma: t.forma, z: t.sobe, solta: true, forca: 0 })
      L.push(P(comMeioEm(circulo(e.px, e.py, RAIO_DO_PINO), meio[0], meio[1]), t.mat, { tabua: 0, bisel: 0, contorno: 0, alfa: 0, semente: 1400 + e.k * 4 + n }))
    })
  }
  const livre = (x: number, y: number): boolean => tampos.every((t) => t.forma.d(x, y) > FOLGA)

  // ---------- o chão da armadilha: o contato, o fundo das juntas, o escuro do alçapão e a laje ----------
  // As três peças grandes levam o meio da caixa num canto da moldura fora de todo espinho: ficam no chão na 3/4.
  const cantos: Ponto[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => R.em(a * (mc - moldura / 2), b * (mv - moldura / 2)))
  const [cantoX, cantoY] = cantos.find(([x, y]) => livre(x, y)) ?? cantos[0]
  const noCanto = (f: Forma): Forma => comMeioEm(f, cantoX, cantoY)
  const tudo = R.ret(-mc, -mv, mc, mv, 1.2)
  cena.sombras.push(contato(tudo, 0.24))
  L.push(P(noCanto(tudo), pedra, { tabua: 0, bisel: 0.8, tom: TOM_DAS_JUNTAS, contorno: 0.3, semente: 700 }))
  L.push(P(noCanto(R.ret(u0 - JUNTA / 2, v0 - JUNTA / 2, u1 + JUNTA / 2, v1 + JUNTA / 2, 0.6)), ESCURO, { bisel: 0, contorno: 0, semente: 701 }))
  L.push(P(noCanto(R.ret(lu0, lv0, lu1, lv1, 0.8)), pedra, { tabua: 0, bisel: 0.9, tom: TOM_DA_LAJE, contorno: 0.2, recesso: { k: 1.4, forca: 0.26 }, semente: 702 }))

  // ---------- cada furo: a mancha, o furo, a sombra pintada, os pinos, o cone, a ponta e o reflexo ----------
  const ferro: Rgb = [metal.rgb[0] * TOM_DO_FERRO, metal.rgb[1] * TOM_DO_FERRO, metal.rgb[2] * TOM_DO_FERRO]
  for (const e of espinhos) {
    const { px, py, bx, by, k } = e
    // O ponto livre do furo: perto do pé e fora de todo espinho; as peças do chão levam o meio da caixa nele.
    let livreDoFuro: Ponto = [cantoX, cantoY]
    for (let d = 0; d < DIRECOES; d += 1) {
      const a = ((d + 0.5) * VOLTA) / DIRECOES
      const ponto: Ponto = [px + Math.cos(a) * LONGE_DO_PE, py + Math.sin(a) * LONGE_DO_PE]
      if (livre(ponto[0], ponto[1])) {
        livreDoFuro = ponto
        break
      }
    }
    const noChao = (f: Forma): Forma => comMeioEm(f, livreDoFuro[0], livreDoFuro[1])
    if (hash(k, 1, 236 + sorteio) < MANCHADOS) {
      const mancha = elipse(px + (hash(k, 2, 236) - 0.5), py + (hash(k, 3, 236) - 0.5), RAIO_DA_MANCHA * (0.85 + 0.3 * hash(k, 4, 236)), RAIO_DA_MANCHA * 0.85)
      L.push(P(noChao(mancha), MANCHA, { bisel: 0, contorno: 0, alfa: ALFA_DA_MANCHA, suave: 1.3, semente: 1000 + k }))
    }
    L.push(P(noChao(circulo(px, py, RAIO_DO_FURO)), ESCURO, { bisel: 0.5, contorno: 0.24, recesso: { k: 1.1, forca: 0.3 }, semente: 1100 + k }))
    if (e.tampos.length === 0) {
      // O toco do espinho quebrado: rente, fica no chão.
      L.push(P(noChao(circulo(px, py, RAIO_DO_TOCO)), PE, { tabua: 0, bisel: RAIO_DO_TOCO * 0.8, contorno: 0.24, metal: BRILHO_DO_CONE, semente: 1200 + k }))
      continue
    }
    // A sombra da ponta cai `altura` px para baixo à direita NA TELA.
    L.push(P(noChao(cunha(px, py, bx + sx * e.altura, by + sy * e.altura, MEIA_BASE * SOMBRA_NO_PE, 0.3)), SOMBRA, { bisel: 0, contorno: 0, alfa: ALFA_DA_SOMBRA, suave: 0.7, semente: 1300 + k }))
    // O cone visto do alto, a ponta afiada e o reflexo nela: no chão (na 3/4 o cone de perfil os cobre).
    L.push(P(noChao(circulo(px, py, MEIA_BASE)), PE, { tabua: 0, bisel: 0.4, contorno: 0.24, metal: BRILHO_DO_CONE, textura: texDoCone(px, py, bx, by, ferro, lx, ly), semente: 1500 + k }))
    L.push(P(noChao(circulo(bx, by, RAIO_DA_PONTA)), metal, { tabua: 0, bisel: RAIO_DA_PONTA, tom: TOM_DA_PONTA, contorno: 0.16, metal: BRILHO_DA_PONTA, semente: 1600 + k }))
    L.push(P(noChao(circulo(bx + rx, by + ry, RAIO_DO_REFLEXO)), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.85, suave: 0.25, semente: 1700 + k }))
  }

  // ---------- a moldura: os dois trilhos ao comprido, a trave do fundo entre eles e a soleira em três blocos ----------
  const blocos = (a0: number, a1: number, b0: number, b1: number, porU: boolean, n: number, sem: number): void => {
    for (let i = 0; i < n; i += 1) {
      const [ua, ub] = porU ? [a0 + ((a1 - a0) * i) / n, a0 + ((a1 - a0) * (i + 1)) / n] : [a0, a1]
      const [va, vb] = porU ? [b0, b1] : [b0 + ((b1 - b0) * i) / n, b0 + ((b1 - b0) * (i + 1)) / n]
      const bloco = R.ret(ua + JUNTA / 2, va + JUNTA / 2, ub - JUNTA / 2, vb - JUNTA / 2, 0.7)
      // O bico dos espinhos da fileira do fundo passa por cima da trave: o meio da caixa do bloco fica fora dele.
      const meio = AO_LONGO_DO_BLOCO.map((f) => R.em(porU ? ua + (ub - ua) * f : (ua + ub) / 2, porU ? (va + vb) / 2 : va + (vb - va) * f)).find(([x, y]) => livre(x, y))
      const tom = TOM_DA_MOLDURA * (0.93 + 0.12 * hash(i, sem, 240 + sorteio))
      L.push(P(meio === undefined ? bloco : comMeioEm(bloco, meio[0], meio[1]), pedra, { tabua: 0, bisel: 1.3, tom, contorno: 0.26, semente: sem + i }))
    }
  }
  const porComprimento = (a: number, b: number): number => Math.max(1, Math.round((b - a) / (g * BLOCO_DA_MOLDURA)))
  blocos(-mc, u1, -mv, v0, true, porComprimento(-mc, u1), 710)
  blocos(-mc, u1, v1, mv, true, porComprimento(-mc, u1), 730)
  blocos(-mc, u0, v0, v1, false, porComprimento(v0, v1), 750)
  blocos(u1, mc, -mv, mv, false, BLOCOS_DA_SOLEIRA, 770)

  // ---------- a placa de pressão no bloco do meio da soleira: a fresta, a placa gasta e o sulco ----------
  const lado = Math.min(soleira, (2 * mv) / BLOCOS_DA_SOLEIRA) * PLACA_NA_SOLEIRA
  const cu = (u1 + mc) / 2
  const m = lado / 2
  L.push(P(R.ret(cu - m - FRESTA_DA_PLACA, -m - FRESTA_DA_PLACA, cu + m + FRESTA_DA_PLACA, m + FRESTA_DA_PLACA, 0.9), ESCURO, { bisel: 0, contorno: 0.2, semente: 790 }))
  L.push(P(R.ret(cu - m, -m, cu + m, m, 0.6), pedra, { tabua: 0, bisel: 0.9, tom: TOM_DA_PLACA, contorno: 0.24, recesso: { k: 0.9, forca: 0.22 }, semente: 791 }))
  const [mx, my] = R.em(cu, 0)
  const rSulco = lado * SULCO_DA_PLACA
  L.push(P(anel(mx, my, rSulco, rSulco, rSulco - LARGURA_DO_SULCO, rSulco - LARGURA_DO_SULCO), ESCURO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 792 }))
}
