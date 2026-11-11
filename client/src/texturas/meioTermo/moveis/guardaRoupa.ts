/**
 * GUARDA-ROUPA de cima com volume (lote 2 dos objetos novos, 11/11/2026): o
 * armário alto de quarto, encostado na parede. De cima aparece o TAMPO com a
 * moldura da cornija em volta (dois degraus e as tábuas afundadas no meio) e,
 * na frente, o alto das PORTAS: a cornija de frente, a travessa de cima de
 * cada folha, o começo da almofada e, na beira, os PUXADORES de metal.
 *
 * NA 3/4 A FRENTE MOSTRA AS PORTAS INTEIRAS: cada folha com as duas almofadas
 * (a moldura afundada e o painel em relevo), as dobradiças do lado de fora, o
 * espelho da fechadura debaixo do puxador, a sombra da cornija por cima e o
 * rodapé embaixo. A frente que a 3/4 varre sozinha é madeira lisa; aqui ela é
 * desenhada de frente, UMA VEZ, e FATIADA: cada faixa fica guardada debaixo do
 * tampo na vista de cima (onde nada dela aparece) e tem a sua FRESTA, um tampo
 * no ar de um quarto de px colado na frente da pegada, na altura da faixa. A
 * regra da 3/4 (`tresQuartos.ts`: cada peça sobe a altura da estrutura que
 * contém o meio dela) põe cada faixa no lugar. É a ideia da estante de livros
 * (`estanteDeLivros.ts`), mas lá cada prateleira é um desenho fechado; uma
 * porta atravessa as faixas, então o corte não pode aparecer: a forma de cada
 * cópia é a peça inteira (o chanfro e o contorno não sabem do corte) e quem
 * esconde o que está fora da faixa é a textura (`naFaixa`).
 *
 * A faixa de cima é a que se vê nas duas vistas. O PUXADOR também: é uma peça
 * só, com a fresta dela, que de cima fica na beira da frente e na 3/4 sobe
 * para o meio da porta.
 *
 * O número de folhas sai da largura (uma a cada 0,75 casa: duas no tamanho de
 * partida) e o de faixas, da profundidade. A 25% de zoom sobram o retângulo de
 * madeira com a moldura, o risco entre as portas e os dois pontos de metal.
 * Materiais: `madeira` e `puxadores`.
 */
import { caixa, capsula, elipse, uniao, type Forma } from './formas'
import { contato, texturaDaClasse, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { BURACO, QUARTO, type MontarMovel } from './contexto'

/** Altura do guarda-roupa em casas (a sombra; na 3/4, a frente). */
const ALTURA = 1.7
/**
 * Onde a frente desenhada começa, em casas a partir do chão. Abaixo disso fica
 * a frente lisa que a 3/4 varre (a base do rodapé): a 3/4 dá a cada fresta uma
 * beirada de 0,06 casa para baixo, e a da faixa de baixo tem de cair aí dentro.
 */
const PE_DA_FRENTE = 0.07
/** O rodapé (a base lisa e a moldura dela) e a cornija, vistos de frente, em casas. */
const RODAPE = 0.11
const CORNIJA = 0.11
/** A faixa de cima (a que aparece na vista de cima), em casas, e o máximo dela em fração da profundidade. */
const FAIXA_DE_CIMA = 0.32
const PARTE_DA_FAIXA_DE_CIMA = 0.56
/** Uma folha a cada tanto de largura, em casas. */
const LARGURA_DA_FOLHA = 0.75

// ---------- a frente em faixas ----------

/** A fresta de cada faixa (px do protótipo) e as cantoneiras que fecham as frestas dos dois lados, como na estante. */
const FRESTA = 0.25
const CANTONEIRA = 0.5
/** A faixa guardada fica a esta distância do fundo da pegada, no mínimo, e as frestas cabem nesta sobra da frente. */
const FOLGA_DO_GUARDADO = 2.5
const SOBRA_DAS_FRESTAS = 2.5
/** Por mais rasa que o mestre deixe a pegada, a faixa não fica menor que isto (px do protótipo). */
const FAIXA_MINIMA = 8
/** Quanto uma faixa passa por cima da vizinha (px do protótipo): sem isso sobraria um fio da frente lisa entre as duas. */
const EMENDA = 0.2
/**
 * Até onde a forma de uma cópia continua valendo depois do corte (px do
 * protótipo): mais que o alcance do recesso da almofada e do passo do chanfro,
 * que leem a distância ali perto. Dali para fora a cópia não existe.
 */
const FOLGA_DO_CORTE = 3
const FORA_DA_FAIXA = 1e3

/** Uma faixa da frente: as alturas que ela cobre (px do protótipo a partir do chão) e onde fica guardada. */
interface Faixa {
  readonly pe: number
  readonly topo: number
  /** O y da vista de cima em que o pé da faixa fica: o começo da fresta dela. */
  readonly base: number
  /** A altura da fresta (o quanto a faixa sobe na 3/4). */
  readonly z: number
}

/** A peça da frente não projeta sombra nem tem deslocamento: a cópia de uma faixa escureceria a da outra. */
type OpcoesDaFrente = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'ruga' | 'curvaY'>

/** Uma peça desenhada DE FRENTE: x como na pegada, y = 0 no chão e negativo para cima. */
interface PecaDaFrente {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaFrente
}

/**
 * A cópia da peça da frente que cabe à faixa, ou nada se a peça não passa por
 * ela. A forma é a peça inteira, descida para o lugar guardado (o veio, o
 * chanfro e o recesso saem iguais em todas as cópias), com a caixa de pintura
 * espelhada em volta do meio da fresta: é o meio da caixa que a 3/4 lê para
 * saber em que estrutura a peça está. A textura esconde o que passa da faixa e
 * devolve ao material as coordenadas da frente, para o veio não quebrar no corte.
 */
function naFaixa(P: CriarPeca, peca: PecaDaFrente, fx: Faixa): Peca | null {
  const f = peca.forma
  const desce = fx.base + fx.pe
  const visivel0 = Math.max(fx.base - (fx.topo - fx.pe), f.b[1] + desce) - EMENDA
  const visivel1 = Math.min(fx.base, f.b[3] + desce) + EMENDA
  if (visivel1 - visivel0 <= 2 * EMENDA) return null
  const corte0 = visivel0 - FOLGA_DO_CORTE
  const corte1 = visivel1 + FOLGA_DO_CORTE
  const meio = fx.base + FRESTA / 2
  const forma: Forma = {
    b: [f.b[0], corte0, f.b[2], 2 * meio - corte0],
    d: (x, y) => (y < corte0 || y > corte1 ? FORA_DA_FAIXA : f.d(x, y - desce)),
  }
  const eixo = peca.o.eixo ?? 0
  const du = -desce * Math.sin(eixo)
  const dv = -desce * Math.cos(eixo)
  const doMaterial = peca.o.textura ?? texturaDaClasse(peca.mat.classe)
  const textura: Textura = (u, v, x, y, p, s, escala) => {
    if (y < visivel0 || y > visivel1) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u + du, v + dv, x, y - desce, p, s, escala)
  }
  return P(forma, peca.mat, { ...peca.o, textura })
}

/** As faixas da frente, de baixo para cima (a última é a de cima), e onde o corpo acaba e as frestas começam. */
function fatiar(H: number, pe: number, deCima: number, h: number, hh: number): { faixas: Faixa[]; frente: number } {
  const maxima = Math.max(FAIXA_MINIMA, h - FOLGA_DO_GUARDADO - SOBRA_DAS_FRESTAS)
  const guardadas = Math.max(1, Math.ceil((H - deCima - pe) / maxima))
  const passo = (H - deCima - pe) / guardadas
  // Uma fresta por faixa e, na beira, a dos puxadores.
  const frente = hh - (guardadas + 2) * FRESTA
  const faixas: Faixa[] = []
  for (let k = 0; k < guardadas; k += 1) {
    // A de baixo fica na fresta da frente: a 3/4 pinta do fundo para a frente, e cada faixa cobre a beirada da de cima.
    const base = frente + (guardadas - k) * FRESTA
    faixas.push({ pe: pe + k * passo, topo: pe + (k + 1) * passo, base, z: pe + k * passo + (base - frente) })
  }
  faixas.push({ pe: H - deCima, topo: H, base: frente, z: H - deCima })
  return { faixas, frente }
}

// ---------- o desenho da frente ----------

/** A lateral do corpo que sobra de cada lado das portas, o vão entre duas folhas e a folga da folha em cima e embaixo (px do protótipo). */
const LATERAL = 2.6
const VAO_ENTRE_FOLHAS = 0.9
const FOLGA_DA_FOLHA = 0.8
/** O quadro da folha: os montantes e a travessa de cima e do meio, e a de baixo, mais alta. */
const QUADRO = 4.2
const TRAVESSA_DE_BAIXO = 5.2
/** A almofada de cima fica com esta parte da altura; o painel em relevo recua isto da moldura (px do protótipo). */
const PARTE_DA_ALMOFADA_DE_CIMA = 0.62
const RECUO_DO_PAINEL = 2.6
/** A madeira vista de frente: o corpo por trás das folhas, o fundo da almofada e o painel em relevo, que pega a luz. */
const TOM_DO_CORPO = 0.84
const TOM_DA_MOLDURA = 0.8
const TOM_DO_PAINEL = 1.05
const TOM_DO_VAO = 0.52
/** A sombra que a cornija faz no alto das portas: o escuro quente da nogueira, meio transparente. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }
const ALTO_DA_SOMBRA_DA_CORNIJA = 2.6
/** O puxador: o raio do botão e a altura dele na folha, em fração da altura dela. */
const RAIO_DO_PUXADOR = 1.6
const ALTURA_DO_PUXADOR = 0.47
/**
 * A dobradiça: o meio comprimento e o raio do canudo, e a distância dela à
 * ponta da folha (abaixo da faixa de cima: a vista de cima mostraria meia dobradiça).
 */
const MEIA_DOBRADICA = 1.7
const RAIO_DA_DOBRADICA = 0.75
const DOBRADICA_DA_PONTA = 14

/** O que o desenho da frente devolve além das peças: onde ficam os puxadores (x e altura). */
interface Frente {
  readonly pecas: PecaDaFrente[]
  readonly puxadores: readonly number[]
  readonly alturaDoPuxador: number
}

/** A frente inteira, de frente: o corpo, o rodapé, as folhas com as almofadas e as ferragens, e a cornija por cima. */
function desenharFrente(hw: number, w: number, g: number, mad: MaterialDaPeca, pux: MaterialDaPeca): Frente {
  const H = g * ALTURA
  const pe = g * PE_DA_FRENTE
  const rodape = g * RODAPE
  const cornija = g * CORNIJA
  const pecas: PecaDaFrente[] = []
  const por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFrente): void => {
    pecas.push({ forma, mat, o })
  }
  const madeiraDePe = (tom: number, semente: number, bisel: number): OpcoesDaFrente => ({ eixo: QUARTO, tabua: 0, bisel, tom, semente })

  // O corpo por trás de tudo (as laterais e o que aparece nas folgas) e a moldura do rodapé.
  por(caixa(-hw, -H, hw, -pe, 0.6), mad, madeiraDePe(TOM_DO_CORPO, 710, 0.9))
  por(caixa(-hw, -rodape, hw, -pe + 0.3, 0.5), mad, { tabua: 0, bisel: 0.9, tom: 0.98, semente: 711 })

  const folhas = Math.max(1, Math.round(w / (g * LARGURA_DA_FOLHA)))
  const larguraDaFolha = (w - 2 * LATERAL - (folhas - 1) * VAO_ENTRE_FOLHAS) / folhas
  const pePorta = rodape + FOLGA_DA_FOLHA
  const topoPorta = H - cornija - FOLGA_DA_FOLHA
  const alturaDoPuxador = pePorta + (topoPorta - pePorta) * ALTURA_DO_PUXADOR
  const puxadores: number[] = []
  // As almofadas: a de baixo, entre a travessa de baixo e a do meio; a de cima, dali até a travessa de cima.
  const dentro = topoPorta - QUADRO - (pePorta + TRAVESSA_DE_BAIXO) - QUADRO
  const meioDeBaixo = pePorta + TRAVESSA_DE_BAIXO + dentro * (1 - PARTE_DA_ALMOFADA_DE_CIMA)
  const almofadas: readonly (readonly [number, number])[] = [
    [pePorta + TRAVESSA_DE_BAIXO, meioDeBaixo],
    [meioDeBaixo + QUADRO, topoPorta - QUADRO],
  ]
  for (let i = 0; i < folhas; i += 1) {
    const x0 = -hw + LATERAL + i * (larguraDaFolha + VAO_ENTRE_FOLHAS)
    const x1 = x0 + larguraDaFolha
    // O vão escuro entre esta folha e a seguinte.
    if (i < folhas - 1) por(caixa(x1 - 0.2, -topoPorta, x1 + VAO_ENTRE_FOLHAS + 0.2, -pePorta), mad, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_VAO, semente: 712 })
    por(caixa(x0, -topoPorta, x1, -pePorta, 0.9), mad, madeiraDePe(1, 720 + i * 10, 1.1))
    almofadas.forEach(([a0, a1], k) => {
      por(caixa(x0 + QUADRO, -a1, x1 - QUADRO, -a0, 0.5), mad, { ...madeiraDePe(TOM_DA_MOLDURA, 721 + i * 10 + k, 0.3), recesso: { k: 2.4, forca: 0.36 }, contorno: 0.12 })
      por(caixa(x0 + QUADRO + RECUO_DO_PAINEL, -a1 + RECUO_DO_PAINEL, x1 - QUADRO - RECUO_DO_PAINEL, -a0 - RECUO_DO_PAINEL, 0.6), mad, { ...madeiraDePe(TOM_DO_PAINEL, 724 + i * 10 + k, 2.1), contorno: 0.14 })
    })
    // As folhas abrem em pares: a par tem o puxador à direita e as dobradiças à esquerda; a ímpar, ao contrário.
    const puxadorADireita = i % 2 === 0
    const xPuxador = puxadorADireita ? x1 - QUADRO / 2 : x0 + QUADRO / 2
    const xDobradica = puxadorADireita ? x0 : x1
    for (const a of [pePorta + DOBRADICA_DA_PONTA, topoPorta - DOBRADICA_DA_PONTA]) {
      por(capsula(xDobradica, -a - MEIA_DOBRADICA, xDobradica, -a + MEIA_DOBRADICA, RAIO_DA_DOBRADICA), pux, { bisel: 0.7, contorno: 0.22, tom: 0.9, semente: 727 + i * 10 })
    }
    // O espelho da fechadura, debaixo do botão do puxador, com o buraco da chave.
    por(caixa(xPuxador - 1.15, -alturaDoPuxador - 2.4, xPuxador + 1.15, -alturaDoPuxador + 4.4, 1.1), pux, { bisel: 0.6, contorno: 0.2, tom: 0.86, semente: 728 + i * 10 })
    por(capsula(xPuxador, -alturaDoPuxador + 2.3, xPuxador, -alturaDoPuxador + 3.4, 0.38), BURACO, { bisel: 0, contorno: 0 })
    puxadores.push(xPuxador)
  }

  // A cornija de frente: a gola recuada, o friso que avança por cima dela e a sombra que os dois fazem nas folhas.
  por(caixa(-hw + 1.2, -H + cornija - ALTO_DA_SOMBRA_DA_CORNIJA * 0.2, hw - 1.2, -H + cornija + ALTO_DA_SOMBRA_DA_CORNIJA), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.6 })
  por(caixa(-hw + 0.9, -H + cornija * 0.42, hw - 0.9, -H + cornija, 0.4), mad, { tabua: 0, bisel: 0.7, tom: 0.88, semente: 713 })
  por(caixa(-hw, -H, hw, -H + cornija * 0.5, 0.7), mad, { tabua: 0, bisel: 1.3, tom: 1.03, semente: 714 })
  return { pecas, puxadores, alturaDoPuxador }
}

// ---------- o tampo ----------

/** A moldura da cornija vista de cima: o degrau de dentro e as tábuas afundadas do tampo recuam isto da beira (px do protótipo). */
const DEGRAU_DA_CORNIJA = 2
const BEIRA_DO_TAMPO = 3.8

export const montarGuardaRoupa: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = c.m.madeira
  const pux = c.m.puxadores
  const H = g * ALTURA
  const deCima = Math.min(g * FAIXA_DE_CIMA, h * PARTE_DA_FAIXA_DE_CIMA)
  const { faixas, frente } = fatiar(H, g * PE_DA_FRENTE, deCima, h, hh)
  const desenho = desenharFrente(hw, w, g, mad, pux)

  // O corpo dá a sombra e a frente lisa; as cantoneiras fecham as frestas dos dois lados.
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1), z: H }, contato(caixa(-hw, -hh, hw, hh, 1)))
  for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
  // A fresta de cada faixa não faz sombra no chão: só diz à 3/4 a altura da faixa.
  for (const fx of faixas) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
  // A fresta dos puxadores, na beira da frente: um ponto debaixo de cada botão.
  const yDoPuxador = hh - FRESTA / 2
  const pontos = desenho.puxadores.map((x) => caixa(x - 0.15, hh - FRESTA, x + 0.15, hh))
  cena.sombras.push({ forma: pontos.reduce(uniao), z: desenho.alturaDoPuxador + (yDoPuxador - frente), solta: true, forca: 0 })

  const L = cena.partes
  const pintarFaixa = (fx: Faixa): void => {
    for (const peca of desenho.pecas) {
      const copia = naFaixa(P, peca, fx)
      if (copia !== null) L.push(copia)
    }
  }
  // As faixas guardadas primeiro, escondidas pelo tampo; depois o tampo e, na frente dele, a faixa de cima.
  faixas.slice(0, -1).forEach(pintarFaixa)
  L.push(P(caixa(-hw, -hh, hw, hh, 1.2), mad, { tabua: 0, bisel: 1.7, semente: 700 }))
  L.push(P(caixa(-hw + DEGRAU_DA_CORNIJA, -hh + DEGRAU_DA_CORNIJA, hw - DEGRAU_DA_CORNIJA, hh - DEGRAU_DA_CORNIJA, 0.8), mad, { tabua: 0, bisel: 0.9, tom: 0.92, semente: 701 }))
  L.push(P(caixa(-hw + BEIRA_DO_TAMPO, -hh + BEIRA_DO_TAMPO, hw - BEIRA_DO_TAMPO, hh - BEIRA_DO_TAMPO, 0.5), mad, { tabua: 7.5, bisel: 0.4, tom: 0.9, recesso: { k: 1.6, forca: 0.22 }, semente: 702 }))
  pintarFaixa(faixas[faixas.length - 1])
  for (const x of desenho.puxadores) {
    L.push(P(elipse(x, yDoPuxador, RAIO_DO_PUXADOR, RAIO_DO_PUXADOR), pux, { bisel: 1.5, contorno: 0.14, semente: 730, projeta: { dist: 1, forca: 0.3 } }))
  }
}
