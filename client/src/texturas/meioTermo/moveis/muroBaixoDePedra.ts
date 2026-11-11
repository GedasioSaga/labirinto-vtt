/**
 * MURO BAIXO DE PEDRA de cima com volume (11/11/2026, lote 7 dos objetos
 * novos): um TRECHO de muro de pedra seca, da altura da cintura, que o mestre
 * estica e emenda para cercar um quintal. De cima aparecem a CAPA de lajes
 * (grandes, tortas, uma ou outra partida em duas, com a junta escura entre
 * elas), a BEIRA de pedras miúdas do corpo, que sobra dos dois lados da capa,
 * o musgo nas juntas e ao pé, o líquen nas lajes e as pedras caídas ao pé.
 *
 * É construído, e é isso que o separa dos escombros (blocos tombados, cada um
 * num ângulo) e das rochas (tortas, sem aresta reta): reto, de pontas cortadas
 * a prumo, com fiadas. O desenho se REPARTE pelo comprimento, como a cerca
 * reparte os mourões: o trecho esticado ganha mais lajes e mais pedras, nunca
 * pedras esticadas. As pontas acabam rentes à pegada, numa junta: dois trechos
 * encostados emendam como duas lajes vizinhas. O muro corre pelo lado MAIOR
 * da pegada (tudo é montado no referencial dele, `u` ao comprido e `v` de
 * través, e trocado de eixo no trecho em pé).
 *
 * Na 3/4 o muro sobe, e o desenho é montado para o que `tresQuartos.ts` faz
 * com as sombras (cada sombra com altura é uma estrutura; as estruturas são
 * pintadas pela base da caixa, do norte para o sul, e na mesma base a mais
 * baixa antes; cada peça sobe com a estrutura mais alta que contém o meio da
 * caixa dela):
 * - o MIOLO é uma coluna, um pouco recuada do contorno: é pintada antes das
 *   pedras da face e aparece, escura, nas juntas entre elas (a peça maior dela
 *   é o miolo escuro da beira, que lhe dá a cor);
 * - cada pedra da FACE que fica embaixo na tela é um tampo solto, raso e sem
 *   peça, como as fiadas da fachada do mausoléu: a beirada dele é a face da
 *   pedra, com a junta desencontrada de fiada em fiada e o alto de cada uma um
 *   pouco abaixo da régua (pedra seca não tem fiada certa). A espessura é
 *   `ESPESSURA_DA_FIADA_DO_MURO`, que o perfil da 3/4 usa. Com o muro de lado
 *   a lado na tela a face é a comprida (a de `v` positivo, ou a outra depois
 *   de meia volta); com ele de topo (o trecho em pé, ou o deitado com um quarto
 *   de volta), é a da ponta. Por isso o desenho lê `c.giro`;
 * - a CAPA é um tampo por laje, uma fiada acima do corpo, com a caixa
 *   declarada até a borda do corpo (`naCapa`): mais estreita que ele, seria
 *   pintada antes das pedras da face, e elas por cima dela. De topo é um
 *   tampo só, até a ponta;
 * - as pedras da beira e o miolo escuro têm o meio da caixa FORA da capa e
 *   dentro do miolo, que é mais alto que qualquer pedra da face: sobem até o
 *   alto do corpo, nem mais (a capa) nem menos (a pedra da face);
 * - a pedra caída é uma coluna baixa; a do lado da frente tem a base além da
 *   do muro, e é pintada por cima da face dele.
 *
 * Material: `pedra`. O musgo e o líquen são fixos.
 */
import { hash, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, dentroDe, elipse, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type Peca } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'

/** A altura de uma fiada, em casas e em px do protótipo. O perfil do muro em `tresQuartos.ts` usa o valor em px. */
const FIADA_EM_CASAS = 0.105
export const ESPESSURA_DA_FIADA_DO_MURO = FIADA_EM_CASAS * G
/** As fiadas do corpo; a capa é mais uma por cima (0,525 casa ao todo: a altura da cintura). */
const FIADAS = 4
/** Meia fundura do corpo e da capa, em fração da fundura da pegada: a capa é mais estreita, e a beira do corpo sobra dos dois lados. */
const MEIO_CORPO = 0.39
const MEIA_CAPA = 0.25
/** O comprimento de uma pedra da face, de uma laje da capa e de uma pedra da beira, em casas: é o que reparte o trecho. */
const PEDRA_DA_FACE = 0.2
const LAJE = 0.4
const PEDRA_DA_BEIRA = 0.15
/** Quanto cada junta sai do lugar, em fração do passo: nenhuma pedra é igual à vizinha (na beira, de meia pedra a pedra e meia). */
const TORTO_DA_FACE = 0.5
const TORTO_DAS_LAJES = 0.3
const TORTO_DA_BEIRA = 0.7
/** A pedra mais curta que uma ponta de fiada aceita, em fração do passo: menor que isto, a junta não entra. */
const PONTA_MINIMA = 0.3
/** Quanto o alto de cada pedra da face fica abaixo da régua da fiada (px do protótipo): o mínimo e o que se sorteia a mais. */
const DESNIVEL_MINIMO = 0.1
const DESNIVEL = 1.9
/**
 * A pedra da face: quanto ela entra no muro (px do protótipo), a meia junta com a vizinha e o canto
 * arredondado. O encaixe não encolhe no muro fino: com menos de ~2 px a pedra não tem miolo (a distância por
 * dentro dela não passa do chanfro da frente, 0,8 px), e a face inteira saía riscada de través. Entrar debaixo
 * da beira e da capa não faz mal: as peças de lá sobem com o miolo e com a capa, que são mais altos.
 */
const ENCAIXE = 2.2
const MEIA_JUNTA_DA_FACE = 0.3
const CANTO = 1.1
/** Quanto o miolo recua do contorno do corpo (px do protótipo): a base dele fica ao norte da das pedras da face. */
const RECUO_DO_MIOLO = 0.6
/** A borda da sombra de quem não faz sombra (as pedras da face: a do miolo já cobre a delas): a mínima, para o motor varrer pouco. */
const BORDA_SEM_SOMBRA = 0.5
/** A laje: meia junta de cada lado, quanto a junta inclina de uma beira à outra e quanto cada vértice sai do lugar (px do protótipo). */
const MEIA_JUNTA = 0.42
const INCLINACAO_DA_JUNTA = 1.3
const TORTO_DA_LAJE = 0.4
/** Quanto a laje passa da capa para fora, de cada lado (px do protótipo): de um pouco para dentro a um pouco para fora. */
const SOBRA_DA_LAJE = 0.1
const SOBRA_DA_LAJE_VARIA = 0.7
/**
 * Quantas lajes em cada dez são partidas em duas ao comprido (nunca duas vizinhas: lado a lado liam como uma
 * escada), a partir de que meia capa (px), e a meia junta entre as duas.
 */
const LAJES_PARTIDAS = 0.34
const CAPA_QUE_PARTE = 4
const MEIA_JUNTA_DA_PARTIDA = 0.28
/**
 * A beira: quanto ela entra debaixo da capa e o dente da borda (px do protótipo, e o teto de cada um em fração
 * da largura da beira: no muro fino o meio da caixa de cada pedra continua fora da capa), a folga na borda do
 * corpo e a junta.
 */
const SOB_A_CAPA = 1.2
const SOB_A_CAPA_NO_MAXIMO = 0.35
const DENTE_DA_BEIRA = 1.1
const DENTE_DA_BEIRA_NO_MAXIMO = 0.28
const FOLGA_DA_BEIRA = 0.3
const JUNTA_DA_BEIRA = 0.3
/** O tom do miolo escuro, que aparece nas juntas, e o das beiras: a do lado da luz (o norte, ou o oeste no trecho em pé) e a outra. */
const TOM_DO_MIOLO = 0.46
const TOM_DA_BEIRA_NA_LUZ = 1
const TOM_DA_BEIRA_NA_SOMBRA = 0.9
/** A sombra da capa na beira do corpo: para onde cai (px do protótipo) e a força. */
const SOMBRA_DA_CAPA = { dist: 1.3, forca: 0.28 } as const
/** Quantas lajes inteiras em cada dez têm uma rachadura, e quantas das duas manchas de líquen de cada laje aparecem. */
const LAJES_RACHADAS = 0.45
const LIQUEN_NAS_LAJES = 0.55
const TOM_DA_RACHADURA = 0.42
/** O líquen: um cinza-esverdeado claro, meio transparente, de borda desfeita. */
const LIQUEN: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0xc6, 0xa6] }
/** O musgo: o verde-oliva do Meio-Termo puxado para a pedra, como o das rochas. */
const TOM_DO_MUSGO: Rgb = rgb(tomDoMeio('musgo', 0.84))
const QUANTO_DE_PEDRA_NO_MUSGO = 0.16
/** Um tufo de musgo é um punhado de bolinhas: quantas por px² de mancha e o raio delas (px do protótipo). */
const BOLINHAS_POR_AREA = 0.3
const RAIO_DA_BOLINHA = 1.25
/** Quantas juntas da capa em cada dez têm musgo, e um tufo ao pé a cada tantas casas de muro. */
const JUNTAS_COM_MUSGO = 0.7
const TUFO_AO_PE = 0.36
/** Uma pedra caída a cada casa de muro; a altura dela, em casas, e os vértices do contorno. */
const ALTURA_DA_PEDRA_CAIDA = 0.05
const VERTICES_DA_PEDRA_CAIDA = 6
/** Quantas das pedras caídas, depois da primeira, ficam do lado da frente. */
const CAIDAS_NA_FRENTE = 0.6
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): um cinza quente, de luminância linear
 * 0,056. Com o escuro de sempre (o da nogueira) a beira da pedra cinza, na sombra, saía marrom.
 */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/**
 * O referencial do muro: `u` ao comprido, `v` de través (negativo = o lado da
 * luz). No trecho em pé os eixos trocam (u vira y), e o lado da luz continua
 * o da luz: o norte vira o oeste.
 */
interface Referencial {
  ret(u0: number, v0: number, u1: number, v1: number, raio?: number): Forma
  pol(pontos: readonly Ponto[]): Forma
  oval(u: number, v: number, ru: number, rv: number): Forma
  fio(pontos: readonly Ponto[], raio: number): Forma
  veio(angulo: number): number
  caixaDe(u0: number, v0: number, u1: number, v1: number): Caixa
}

function referencial(aoComprido: boolean): Referencial {
  if (aoComprido) {
    return {
      ret: (u0, v0, u1, v1, raio = 0) => caixa(u0, v0, u1, v1, raio),
      pol: (pontos) => poligono(pontos),
      oval: (u, v, ru, rv) => elipse(u, v, ru, rv),
      fio: (pontos, raio) => cadeia(pontos, raio),
      veio: (angulo) => angulo,
      caixaDe: (u0, v0, u1, v1) => [u0, v0, u1, v1],
    }
  }
  const trocado = ([u, v]: Ponto): Ponto => [v, u]
  return {
    ret: (u0, v0, u1, v1, raio = 0) => caixa(v0, u0, v1, u1, raio),
    pol: (pontos) => poligono(pontos.map(trocado)),
    oval: (u, v, ru, rv) => elipse(v, u, rv, ru),
    fio: (pontos, raio) => cadeia(pontos.map(trocado), raio),
    veio: (angulo) => QUARTO - angulo,
    caixaDe: (u0, v0, u1, v1) => [v0, u0, v1, u1],
  }
}

/**
 * O trecho de `de` a `ate` em `n` pedaços, com cada junta um pouco fora do
 * lugar. `desencontrada` = as juntas caem no meio dos pedaços da fiada de
 * baixo (uma pedra a mais, com meia pedra em cada ponta).
 */
function emPedacos(de: number, ate: number, n: number, desencontrada: boolean, torto: number, sem: number): [number, number][] {
  const passo = (ate - de) / n
  const juntas = [de]
  for (let i = 0; ; i += 1) {
    const junta = de + passo * (i + (desencontrada ? 0.5 : 1)) + (hash(i, sem, 171) - 0.5) * passo * torto
    if (junta >= ate - passo * PONTA_MINIMA) break
    juntas.push(junta)
  }
  juntas.push(ate)
  return juntas.slice(1).map((junta, i) => [juntas[i], junta])
}

/**
 * Um tufo de musgo: um punhado de bolinhas sorteadas dentro da mancha de meio (u, v) e raios (ru, rv), em px
 * do protótipo, cada uma com o seu tom.
 */
function tufoDeMusgo(P: CriarPeca, R: Referencial, L: Peca[], u: number, v: number, ru: number, rv: number, pedra: MaterialDaPeca, sem: number): void {
  const cor: MaterialDaPeca = { classe: 'folha', rgb: misturar(TOM_DO_MUSGO, pedra.rgb, QUANTO_DE_PEDRA_NO_MUSGO) }
  const bolinhas = Math.max(3, Math.round(Math.PI * ru * rv * BOLINHAS_POR_AREA))
  for (let i = 0; i < bolinhas; i += 1) {
    // Mais bolinhas perto do meio da mancha (a raiz do sorteio as espalharia por igual).
    const longe = hash(i, sem, 181)
    const t = hash(i, sem, 182) * 2 * Math.PI
    const r = RAIO_DA_BOLINHA * (0.7 + 0.6 * hash(i, sem, 183))
    L.push(P(R.oval(u + Math.cos(t) * ru * longe, v + Math.sin(t) * rv * longe, r, r * 0.86), cor, { bisel: r * 0.7, contorno: 0.26, tom: 0.82 + 0.3 * hash(i, sem, 184), semente: sem * 31 + i }))
  }
}

export const montarMuroBaixoDePedra: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const aoComprido = c.w >= c.h
  const R = referencial(aoComprido)
  const comprimento = aoComprido ? c.w : c.h
  const fundura = aoComprido ? c.h : c.w
  const mc = comprimento / 2
  const mf = fundura / 2
  const corpo = fundura * MEIO_CORPO
  const capa = fundura * MEIA_CAPA
  const beira = corpo - capa
  const fiada = g * FIADA_EM_CASAS
  const zDoCorpo = FIADAS * fiada
  const zDaCapa = zDoCorpo + fiada
  const pedra = c.m.pedra
  const escuro: MaterialDaPeca = { ...pedra, rgb: [pedra.rgb[0] * TOM_DO_MIOLO, pedra.rgb[1] * TOM_DO_MIOLO, pedra.rgb[2] * TOM_DO_MIOLO] }
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  // O sorteio muda com o tamanho do trecho (como na sebe): dois trechos de tamanhos diferentes não repetem as
  // mesmas lajes. Dois do mesmo tamanho saem iguais: a imagem é uma só, guardada pela chave do desenho.
  const sorteio = Math.round(c.w + 7 * c.h)

  const lajes = emPedacos(-mc, mc, Math.max(1, Math.round(comprimento / (g * LAJE))), false, TORTO_DAS_LAJES, 21 + sorteio)

  // ---------- as estruturas: o que sobe na 3/4 e a sombra no chão ----------
  cena.sombras.push(
    { forma: R.ret(-mc + RECUO_DO_MIOLO, -corpo + RECUO_DO_MIOLO, mc - RECUO_DO_MIOLO, corpo - RECUO_DO_MIOLO), z: zDoCorpo },
    contato(R.ret(-mc, -corpo, mc, corpo, CANTO), 0.3),
  )
  // Uma pedra da face de baixo na tela: o tampo raso, sem sombra, com o alto abaixo da régua da fiada dela
  // (sempre abaixo: a da última fiada nunca empata com o miolo, que é quem leva as peças da beira).
  const pedraDaFace = (forma: Forma, k: number, i: number): void => {
    cena.sombras.push({ forma, z: k * fiada - DESNIVEL_MINIMO - hash(i, k, 173 + sorteio) * DESNIVEL, solta: true, forca: 0, suave: BORDA_SEM_SOMBRA })
  }
  // O muro corre de lado a lado na tela? O trecho deitado sem quarto de volta, ou o em pé com um.
  const deFrente = aoComprido !== (c.giro === 90 || c.giro === 270)
  if (deFrente) {
    // A face comprida que fica embaixo na tela: a de v positivo, ou a outra depois de meia volta.
    const outraFace = c.giro === 180 || c.giro === 270
    const pedras = Math.max(1, Math.round(comprimento / (g * PEDRA_DA_FACE)))
    for (let k = 1; k <= FIADAS; k += 1) {
      emPedacos(-mc, mc, pedras, k % 2 === 0, TORTO_DA_FACE, 30 + k + sorteio).forEach(([u0, u1], i) => {
        const de = u0 + MEIA_JUNTA_DA_FACE
        const ate = u1 - MEIA_JUNTA_DA_FACE
        pedraDaFace(outraFace ? R.ret(de, -corpo, ate, -corpo + ENCAIXE, CANTO) : R.ret(de, corpo - ENCAIXE, ate, corpo, CANTO), k, i)
      })
    }
    // Cada laje com a caixa declarada até a borda do corpo: a mesma base das pedras da face, e mais alta que elas.
    const naCapa = (u0: number, u1: number): Forma => ({ b: R.caixaDe(u0, -corpo, u1, corpo), d: R.ret(u0, -capa, u1, capa, CANTO).d })
    for (const [u0, u1] of lajes) cena.sombras.push({ forma: naCapa(u0, u1), z: zDaCapa, solta: true })
  } else {
    // A ponta que fica embaixo na tela: a de u positivo, ou a outra (o deitado com três quartos de volta, o em pé com meia).
    const outraPonta = aoComprido ? c.giro === 270 : c.giro === 180
    const pedras = Math.max(1, Math.round((2 * corpo) / (g * PEDRA_DA_FACE)))
    for (let k = 1; k <= FIADAS; k += 1) {
      emPedacos(-corpo, corpo, pedras, k % 2 === 0, TORTO_DA_FACE, 50 + k + sorteio).forEach(([v0, v1], i) => {
        const de = v0 + MEIA_JUNTA_DA_FACE
        const ate = v1 - MEIA_JUNTA_DA_FACE
        pedraDaFace(outraPonta ? R.ret(-mc, de, -mc + ENCAIXE, ate, CANTO) : R.ret(mc - ENCAIXE, de, mc, ate, CANTO), k, i)
      })
    }
    cena.sombras.push({ forma: R.ret(-mc, -capa, mc, capa, CANTO), z: zDaCapa, solta: true })
  }

  // ---------- o musgo ao pé do muro, no chão ----------
  const tufos = Math.max(2, Math.round(comprimento / (g * TUFO_AO_PE)))
  for (let i = 0; i < tufos; i += 1) {
    const lado = hash(i, 1, 174 + sorteio) < 0.6 ? 1 : -1
    const u = -mc + ((i + 0.2 + 0.6 * hash(i, 2, 174 + sorteio)) / tufos) * comprimento
    tufoDeMusgo(P, R, L, u, lado * (corpo + (mf - corpo) * 0.4), g * (0.05 + 0.06 * hash(i, 3, 174 + sorteio)), (mf - corpo) * 0.36, pedra, 9000 + i)
  }

  // ---------- a beira do corpo: o miolo escuro e as pedras miúdas, dos dois lados da capa ----------
  const pedrasDaBeira = Math.max(2, Math.round(comprimento / (g * PEDRA_DA_BEIRA)))
  const dentro = capa - Math.min(SOB_A_CAPA, beira * SOB_A_CAPA_NO_MAXIMO)
  const dente = Math.min(DENTE_DA_BEIRA, beira * DENTE_DA_BEIRA_NO_MAXIMO)
  for (const lado of [-1, 1]) {
    const naLuz = lado < 0
    const faixa = (u0: number, u1: number, fora: number, raio: number): Forma => (naLuz ? R.ret(u0, -fora, u1, -dentro, raio) : R.ret(u0, dentro, u1, fora, raio))
    // O miolo em pedaços do tamanho das lajes: nenhum deles é a maior peça do muro (a que dá a cor das pedras da face).
    lajes.forEach(([u0, u1], i) => {
      L.push(P(faixa(u0, u1, corpo - FOLGA_DA_BEIRA, 0), escuro, { tabua: 0, bisel: 0, contorno: 0, semente: 9100 + i * 2 + (naLuz ? 0 : 1) }))
    })
    emPedacos(-mc, mc, pedrasDaBeira, false, TORTO_DA_BEIRA, 40 + lado + sorteio).forEach(([u0, u1], i) => {
      const fora = corpo - hash(i, lado + 2, 175 + sorteio) * dente
      L.push(P(faixa(u0 + JUNTA_DA_BEIRA, u1 - JUNTA_DA_BEIRA, fora, 1.4), pedra, {
        eixo: R.veio(hash(i, lado + 4, 175 + sorteio) * Math.PI),
        tabua: 0,
        bisel: 1.4,
        contorno: 0.3,
        tom: (naLuz ? TOM_DA_BEIRA_NA_LUZ : TOM_DA_BEIRA_NA_SOMBRA) + 0.18 * (hash(i, lado + 6, 175 + sorteio) - 0.5),
        semente: 9150 + i * 2 + (naLuz ? 0 : 1),
      }))
    })
  }

  // ---------- a capa: o miolo escuro debaixo de cada laje, a laje (inteira ou partida), a rachadura e o líquen ----------
  const musgo: Peca[] = []
  // A junta `j` (a do começo da laje j) inclina de uma beira à outra; as das pontas do trecho ficam a prumo, para emendar.
  const inclinacao = (j: number): number => (j === 0 || j === lajes.length ? 0 : (hash(j, 5, 176 + sorteio) - 0.5) * 2 * INCLINACAO_DA_JUNTA)
  const sorteadaParaPartir = (j: number): boolean => hash(j, 15, 176 + sorteio) < LAJES_PARTIDAS
  lajes.forEach(([u0, u1], i) => {
    const torto = (k: number, quanto: number): number => (hash(i, k, 176 + sorteio) - 0.5) * 2 * quanto
    const norte = -capa - SOBRA_DA_LAJE - torto(1, SOBRA_DA_LAJE_VARIA)
    const sul = capa + SOBRA_DA_LAJE + torto(2, SOBRA_DA_LAJE_VARIA)
    // As beiras de oeste e de leste da laje na altura `v`: a junta inclinada, menos a meia junta.
    const oeste = (v: number): number => u0 + MEIA_JUNTA + (inclinacao(i) * v) / capa
    const leste = (v: number): number => u1 - MEIA_JUNTA + (inclinacao(i + 1) * v) / capa
    // A beira comprida na altura `v`, de oeste a leste, com dois vértices tortos no meio.
    const aoLongo = (v: number, k: number): Ponto[] => {
      const a = oeste(v)
      const b = leste(v)
      return [
        [a, v],
        [a + (b - a) * (0.33 + torto(k, 0.08)), v + torto(k + 1, TORTO_DA_LAJE)],
        [a + (b - a) * (0.67 + torto(k + 2, 0.08)), v + torto(k + 3, TORTO_DA_LAJE)],
        [b, v],
      ]
    }
    const partida = capa >= CAPA_QUE_PARTE && sorteadaParaPartir(i) && !(i > 0 && sorteadaParaPartir(i - 1))
    const corte = torto(16, capa * 0.3)
    const pedacos = partida
      ? [
          R.pol([...aoLongo(norte, 20), ...aoLongo(corte - MEIA_JUNTA_DA_PARTIDA, 24).reverse()]),
          R.pol([...aoLongo(corte + MEIA_JUNTA_DA_PARTIDA, 28), ...aoLongo(sul, 32).reverse()]),
        ]
      : [R.pol([...aoLongo(norte, 20), ...aoLongo(sul, 32).reverse()])]
    L.push(P(R.ret(u0, -capa, u1, capa), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_MIOLO, semente: 9200 + i }))
    pedacos.forEach((laje, n) => {
      L.push(P(laje, pedra, { eixo: R.veio(torto(40 + n, 0.3)), tabua: 0, bisel: 1.5, contorno: 0.26, tom: 0.99 + torto(42 + n, 0.1), semente: 9300 + i * 2 + n, projeta: SOMBRA_DA_CAPA }))
    })
    const meio = (u0 + u1) / 2
    if (!partida && hash(i, 50, 176 + sorteio) < LAJES_RACHADAS) {
      // A rachadura atravessa a laje de uma beira à outra, em três lances.
      const u = meio + torto(51, (u1 - u0) * 0.22)
      const lance = (sul - norte) / 3
      const rachadura = R.fio([[u, norte], [u + torto(52, 1.4), norte + lance], [u + torto(53, 1.4), norte + lance * 2], [u + torto(54, 1.2), sul]], 0.32)
      L.push(P(dentroDe(rachadura, pedacos[0]), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DA_RACHADURA, semente: 9400 + i }))
    }
    for (let k = 0; k < 2; k += 1) {
      if (hash(i, 60 + k, 176 + sorteio) > LIQUEN_NAS_LAJES) continue
      const r = 1.4 + hash(i, 62 + k, 176 + sorteio) * 1.4
      const mancha = R.oval(meio + torto(64 + k, (u1 - u0) * 0.3), (k === 0 ? norte : sul) * (0.3 + 0.3 * hash(i, 66 + k, 176 + sorteio)), r * 1.25, r)
      L.push(P(dentroDe(mancha, pedacos[k % pedacos.length]), LIQUEN, { bisel: 0, contorno: 0, alfa: 0.42, suave: 0.7, semente: 9500 + i * 2 + k }))
    }
    // O musgo na junta com a laje anterior, numa das beiras: cai um pouco por cima da beira do corpo.
    if (i > 0 && hash(i, 70, 176 + sorteio) < JUNTAS_COM_MUSGO) {
      const lado = hash(i, 71, 176 + sorteio) < 0.5 ? -1 : 1
      // O tufo não chega à borda do corpo: uma bolinha com o meio fora do miolo, numa pedra da face, seria a
      // única peça dela, e a face dessa pedra sairia verde.
      tufoDeMusgo(P, R, musgo, u0, lado * capa * 0.8, 2.8, Math.min(2.2, beira * 0.5), pedra, 9600 + i)
    }
  })
  L.push(...musgo)

  // ---------- as pedras caídas ao pé: a primeira na frente, as outras de um lado ou do outro ----------
  const caidas = Math.max(1, Math.round(comprimento / g))
  for (let i = 0; i < caidas; i += 1) {
    const lado = i === 0 || hash(i, 1, 177 + sorteio) < CAIDAS_NA_FRENTE ? 1 : -1
    const u = -mc + ((i + 0.25 + 0.5 * hash(i, 2, 177 + sorteio)) / caidas) * comprimento
    const rv = (mf - corpo) * 0.86
    const ru = rv * (1.6 + 0.5 * hash(i, 3, 177 + sorteio))
    const v = lado * (corpo + rv * 0.6)
    const ang = (hash(i, 4, 177 + sorteio) - 0.5) * 1.2
    const co = Math.cos(ang)
    const si = Math.sin(ang)
    // O contorno torto da pedra, em volta do meio dela: comprida, de quinas desiguais (certinha, lia como porca de parafuso).
    const contorno: Ponto[] = []
    for (let k = 0; k < VERTICES_DA_PEDRA_CAIDA; k += 1) {
      const t = ((k + 0.6 * hash(k, i, 179 + sorteio)) / VERTICES_DA_PEDRA_CAIDA) * 2 * Math.PI
      const q = 0.74 + 0.4 * hash(k, i, 178 + sorteio)
      const x = Math.cos(t) * ru * q
      const y = Math.sin(t) * rv * q
      contorno.push([u + x * co - y * si, v + x * si + y * co])
    }
    const caida = R.pol(contorno)
    cena.sombras.push({ forma: caida, z: g * ALTURA_DA_PEDRA_CAIDA }, contato(caida, 0.28))
    L.push(P(caida, pedra, { eixo: R.veio(ang), tabua: 0, bisel: rv * 0.55, contorno: 0.3, tom: 0.9 + 0.1 * hash(i, 5, 177 + sorteio), semente: 9700 + i }))
    // Uma lasca ao lado dela, no chão.
    const lasca = R.oval(u + ru * (hash(i, 6, 177 + sorteio) < 0.5 ? -1.35 : 1.35), lado * (corpo + (mf - corpo) * 0.62), rv * 0.42, rv * 0.3)
    cena.sombras.push(contato(lasca, 0.26))
    L.push(P(lasca, pedra, { tabua: 0, bisel: rv * 0.25, contorno: 0.3, tom: 0.92, semente: 9750 + i }))
  }
}
