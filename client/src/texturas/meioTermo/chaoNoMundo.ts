/**
 * CHÃO SEM REPETIÇÃO do Meio-Termo (fatia MT7, plano
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`, seção 3): a
 * textura do mapa deixa de ser um ladrilho repetido e passa a ser lida POR
 * POSIÇÃO no mundo. Cada pixel do pedaço sai de:
 *
 * 1. o ladrilho de hoje (os mesmos pixels que o `TilingSprite` repete), lido
 *    numa coordenada TORCIDA por ruído sem período (domain warp): a mesma
 *    folha, a mesma copa, mas nunca duas vezes no mesmo lugar;
 * 2. as MANCHAS do protótipo aprovado (`vila-meio-termo/prototipo/meio.js:255-283`):
 *    ruído em 3 escalas (230, 80 e 27 px) que clareia para o realce e
 *    escurece para a sombra, com os números da grama (`#8cbf80` → realce
 *    `#a2cc92`, sombra `#76ac6d`). Só com o interruptor "Manchas do chão" do
 *    mapa ligado (`MapData.manchasDoChao`, que chega em `ChaoDaTextura.manchas`;
 *    pedido de 27/10/2026: as grandes pareciam névoa no chão). Desligado, o
 *    pixel sai sem mancha nenhuma, e a torção e o grão continuam iguais;
 * 3. o GRÃO de papel do protótipo (`meio.js:285-308`): ruído branco em células
 *    de 2 x 2 px do mundo, em luz suave, força 22;
 * 4. a VIDA do chão (`VidaDoChao`, 10/11/2026), nas texturas que a declaram (o
 *    Campo): o tom largo e as moitas, que mudam de um lugar do mapa para outro
 *    e por isso não podem morar no ladrilho. Sempre ligada: não é a chave
 *    "Manchas do chão" (que clareia para o branco e parecia névoa).
 *
 * Tudo é conta inteira (`hash`) e as quatro operações: sem `Math.random`, sem
 * seno; a mesma entrada dá os mesmos bytes em qualquer motor. Puro, sem
 * canvas nem Pixi: o teste mede os bytes que a tela vai mostrar
 * (`pixi/pedacosDoChao.ts` só põe estes bytes numa textura).
 */
import { hash, mod, type Rgb } from '../ruido'
import { ruidoDeValor, ruidoDoMundo } from './ruidoDoMundo'

/** Lado do pedaço em pixels (no nível 0, um pixel do pedaço é um pixel do mundo). */
export const LADO_DO_PEDACO = 256

/** Passo da grade grossa (px do pedaço) onde a torção, as manchas e a vida são calculadas; o pixel interpola entre os pontos. */
const PASSO_DA_GRADE = 8
const PONTOS_DA_GRADE = LADO_DO_PEDACO / PASSO_DA_GRADE + 1
/** O tom e a luz largos da vida são calculados num ponto a cada 4 da grade (`largosDoPedaco`). */
const PASSO_DO_LARGO = 4
const PONTOS_DO_LARGO = (PONTOS_DA_GRADE - 1) / PASSO_DO_LARGO + 1
/** Campos da grade: torção em x, torção em y, manchas e a vida (o ganho do ladrilho e o que soma em R, G e B: `vidaNoPonto`). */
const CAMPOS = 7
const CAMPO_DA_VIDA = 3

/** Torção das texturas naturais, em fração do lado do ladrilho no mundo (medida em `chaoNoMundo.test.ts`). */
export const TORCAO_NATURAL = 0.15
/** As de assentamento em casas (convés, lajotas, calçamento) não torcem: a junta fica reta e na grade. */
export const TORCAO_DO_ASSENTAMENTO = 0

/** As duas escalas da torção, em lados do ladrilho no mundo, e o peso de cada uma. */
const TORCAO_LARGA = { lado: 1, peso: 0.65 }
const TORCAO_FINA = { lado: 0.37, peso: 0.35 }

/** Manchas (só com `ChaoDaTextura.manchas`): o protótipo clareia 18% para o branco e escurece 13% (do realce e da sombra da grama). */
const MANCHA_CLARA = 0.18
const MANCHA_ESCURA = 0.13
const GANHO_DA_MANCHA = 1.5

/** Grão: força do protótipo (22 em 255, em luz suave) e a semente dele. */
const FORCA_DO_GRAO = 22
const SEMENTE_DO_GRAO = 821

/**
 * A VIDA de um chão natural (pedido de 10/11/2026: "melhorar essa textura de
 * grama para não deixar o padrão repetido"). O que muda de um lugar do mapa
 * para outro NÃO pode morar no ladrilho: tudo o que mora nele volta a cada
 * lado dele, e a torção só desloca a marca uns 15% desse lado, então de longe
 * a mesma moita aparecia em fileiras e colunas. O ladrilho fica só com o
 * detalhe miúdo (tufos, lâminas), igual em toda parte, e a vida vem da POSIÇÃO:
 *
 * - `tom`: o campo puxa para um lado da paleta em regiões de dezenas de casas
 *   (o que soma a cada canal no extremo; no outro extremo, subtrai o mesmo);
 * - `luz`: na mesma escala, uma região um nada mais clara ou mais fechada;
 * - `moita` e `broto`: nuvens de uma casa ou duas, o capim mais fechado e
 *   escuro e, do outro lado, o mais novo e claro (o que soma no miolo delas);
 * - `meio` e `ralo`: o detalhe do ladrilho (a diferença dele para a cor `meio`,
 *   os tufos) aparece inteiro nas touceiras e some até a fração `ralo` entre
 *   elas. No ladrilho os tufos são iguais em toda parte; no mapa, crescem em
 *   touceiras que não repetem.
 *
 * Tudo é macio (sem borda) e soma e subtrai em torno da cor do ladrilho: a cor
 * média do chão fica a do ladrilho (teste). As cores são da textura; os
 * tamanhos, daqui, em lados do ladrilho (que tem 3 casas ou mais no mapa).
 */
export interface VidaDoChao {
  readonly tom: Rgb
  /** Fração da luz: 0,02 = a região mais clara fica 2% acima da média. */
  readonly luz: number
  readonly moita: Rgb
  readonly broto: Rgb
  readonly meio: Rgb
  readonly ralo: number
}

/** As escalas do tom (em lados do ladrilho) e o peso de cada uma: a larga manda, as outras só tiram a régua da borda dela. */
const ESCALAS_DO_TOM = [
  { lado: 4.6, peso: 0.6 },
  { lado: 1.7, peso: 0.27 },
  { lado: 0.7, peso: 0.13 },
] as const
const LUZ_LARGA = 3.1
/** O ruído de valor passa pouco tempo nos extremos: com o ganho a região chega à cor cheia, e o corte não a deixa passar dela. */
const GANHO_DO_TOM = 1.6
/** As duas escalas das moitas (lados do ladrilho) e o quanto a torção do ladrilho as entorta (a borda não segue a grade do ruído). */
const ESCALAS_DA_MOITA = [
  { lado: 0.47, peso: 0.62 },
  { lado: 0.21, peso: 0.38 },
] as const
const TORCAO_DA_MOITA = 1.7
/** De onde a onde o ruído vira moita (acima) ou broto (abaixo): a rampa é larga, a nuvem não tem borda. */
const RAMPA_DA_MOITA = { de: 0.08, ate: 0.72 }
/**
 * As touceiras: o ruído das moitas mais uma escala só delas (a touceira cai
 * mais na moita que no broto, sem ser o mesmo desenho), e de onde a onde ele
 * vira touceira cheia.
 */
const TOUCEIRA = { lado: 0.26, pesoDaMoita: 0.55, peso: 0.45, de: -0.22, ate: 0.2 }
/**
 * Uma escala (do tom, da moita ou da touceira) só entra enquanto a célula dela
 * tem pontos bastantes da grade em que é calculada (de `de` a `ate` pontos por
 * célula ela aparece aos poucos): de muito longe a moita miúda viraria ruído
 * de pixel, diferente a cada nível.
 */
const PONTOS_POR_CELULA = { de: 1.3, ate: 2.4 }
/**
 * Sementes dos campos da vida (somadas à do chão). O campo começa na origem do
 * mapa e é medido em lados do ladrilho, então todo mapa pequeno vê o mesmo
 * canto dele: as do tom e da luz foram escolhidas (entre 600) para a média
 * desse canto ficar perto de zero nos tamanhos comuns de mapa, de 20 x 15 a
 * 100 x 100 casas, no Campo verde e no amarelo. A cor média do mapa não puxa
 * para um lado.
 */
const SEMENTE_DO_TOM = 129
const SEMENTE_DA_LUZ = 472
const SEMENTE_DA_MOITA = 50
const SEMENTE_DA_TOUCEIRA = 60
/**
 * O giro de cada escala (cosseno e seno em fração exata, dos triângulos 3-4-5
 * e 7-24-25: sem seno na conta). O ruído de valor tem as marcas alinhadas à
 * grade dele; girada, a grade não fica alinhada às casas do mapa, nem uma
 * escala à outra.
 */
const GIROS = [
  [0.8, 0.6],
  [0.96, -0.28],
  [0.6, -0.8],
  [0.28, 0.96],
] as const

/** Ruído de valor em (x, y) do mundo numa grade de `lado` px, girada pelo giro `g`. */
function ruidoGirado(x: number, y: number, lado: number, g: number, semente: number): number {
  const giro = GIROS[g % GIROS.length]
  return ruidoDeValor((x * giro[0] + y * giro[1]) / lado, (y * giro[0] - x * giro[1]) / lado, semente)
}

/** Um ladrilho em RGBA, quadrado (os do catálogo e os importados têm lado em potência de 2). */
export interface ImagemDoLadrilho {
  readonly lado: number
  readonly pixels: Uint8ClampedArray
}

/** O chão de UMA textura num mapa: o ladrilho dela, o tamanho dele no mundo, a semente, a torção e as manchas. */
export interface ChaoDaTextura {
  readonly ladrilho: ImagemDoLadrilho
  /** Lado do ladrilho no mundo, em px (`drawTexturas.ladoDoLadrilhoNoMundo`). */
  readonly ladoNoMundo: number
  readonly semente: number
  /** Amplitude da torção em fração de `ladoNoMundo`. */
  readonly torcao: number
  /** O interruptor "Manchas do chão" do mapa (`MapData.manchasDoChao`): `false` = sem manchas. */
  readonly manchas: boolean
  /** A vida da textura (`vidaDaTextura`); ausente = o chão é só o ladrilho torcido, como sempre foi. */
  readonly vida?: VidaDoChao
}

/**
 * Um pedaço do mundo: o quadrado (i, j) da grade de lado
 * `LADO_DO_PEDACO * 2^nivel` px. No nível 0 cada pixel do pedaço é um pixel
 * do mundo; no nível k, 2^k (o mapa afastado pede menos pixels).
 */
export interface Pedaco {
  readonly i: number
  readonly j: number
  readonly nivel: number
}

/** Lado do pedaço no mundo, em px. */
export function ladoDoPedacoNoMundo(nivel: number): number {
  return LADO_DO_PEDACO * 2 ** nivel
}

/** A SEMENTE do chão de uma textura: FNV-1a do id (a mesma no app e nos testes; Campo e Terra não dividem manchas). */
export function sementeDoChao(id: string): number {
  let h = 2166136261
  for (let k = 0; k < id.length; k += 1) h = Math.imul(h ^ id.charCodeAt(k), 16777619)
  return (h >>> 0) % 1_000_003
}

/** A torção de uma textura: as assentadas em casas (`casas`) não torcem, as naturais torcem `TORCAO_NATURAL`. */
export function torcaoDaTextura(textura: { readonly casas?: number } | null): number {
  return textura?.casas !== undefined ? TORCAO_DO_ASSENTAMENTO : TORCAO_NATURAL
}

/** A vida de uma textura do catálogo (`DefinicaoDeTextura.vida`); as que não declaram (e as importadas) não têm. */
export function vidaDaTextura(textura: { readonly vida?: VidaDoChao } | null): VidaDoChao | undefined {
  return textura?.vida
}

/** Os níveis de mip de cada ladrilho (média de 2 x 2), feitos sob demanda e guardados com ele. */
const mipsGuardados = new WeakMap<ImagemDoLadrilho, ImagemDoLadrilho[]>()

function metade(img: ImagemDoLadrilho): ImagemDoLadrilho {
  const L = Math.max(1, img.lado >> 1)
  const pixels = new Uint8ClampedArray(L * L * 4)
  const W = img.lado
  const ultimo = W - 1
  for (let y = 0; y < L; y += 1) {
    const y0 = Math.min(ultimo, y * 2) * W
    const y1 = Math.min(ultimo, y * 2 + 1) * W
    for (let x = 0; x < L; x += 1) {
      const x0 = Math.min(ultimo, x * 2)
      const x1 = Math.min(ultimo, x * 2 + 1)
      const a = (y0 + x0) * 4
      const b = (y0 + x1) * 4
      const c = (y1 + x0) * 4
      const d = (y1 + x1) * 4
      const o = (y * L + x) * 4
      for (let k = 0; k < 4; k += 1) pixels[o + k] = (img.pixels[a + k] + img.pixels[b + k] + img.pixels[c + k] + img.pixels[d + k]) / 4
    }
  }
  return { lado: L, pixels }
}

/** O mip `m` do ladrilho (0 = ele mesmo); para no lado 4. */
export function mipDoLadrilho(img: ImagemDoLadrilho, m: number): ImagemDoLadrilho {
  let mips = mipsGuardados.get(img)
  if (mips === undefined) {
    mips = [img]
    mipsGuardados.set(img, mips)
  }
  while (mips.length <= m && mips[mips.length - 1].lado > 4) mips.push(metade(mips[mips.length - 1]))
  return mips[Math.min(m, mips.length - 1)]
}

/** O mip que o pedaço lê: o passo no ladrilho (px do ladrilho por px do pedaço) arredondado para baixo em potência de 2. */
export function mipDoPedaco(chao: ChaoDaTextura, nivel: number): number {
  const passo = (chao.ladrilho.lado / chao.ladoNoMundo) * 2 ** nivel
  return passo < 2 ? 0 : Math.floor(Math.log2(passo))
}

/** A pintura de um pedaço em andamento: os bytes, a grade grossa e a próxima linha. */
export interface PinturaDoPedaco {
  readonly pixels: Uint8ClampedArray
  readonly grade: Float32Array
  linha: number
}

/** O quanto uma escala de `lado` px do mundo aparece numa grade de `passoDaGrade` px (0 a 1). */
function presencaNaGrade(lado: number, passoDaGrade: number): number {
  const t = Math.max(0, Math.min(1, (lado / passoDaGrade - PONTOS_POR_CELULA.de) / (PONTOS_POR_CELULA.ate - PONTOS_POR_CELULA.de)))
  return t * t * (3 - 2 * t)
}

/**
 * A vida do chão num ponto do mundo, já na forma que o pixel usa: a cor final
 * é `ladrilho * ganho + soma`, com o ganho em `saida[o]` e a soma de R, G e B
 * em `saida[o+1..o+3]`. É a conta
 * `(meio + (ladrilho - meio) * touceira + tom + moita) * luz` aberta: o pixel
 * faz uma multiplicação e uma soma por canal. `torX`/`torY` são a torção do
 * ladrilho no ponto (a moita e a touceira são lidas na posição entortada por ela).
 */
function vidaNoPonto(
  chao: ChaoDaTextura,
  vida: VidaDoChao,
  x: number,
  y: number,
  torX: number,
  torY: number,
  tom: number,
  luz: number,
  presencas: readonly number[],
  presencaDaTouceira: number,
  saida: Float32Array,
  o: number,
): void {
  const lado = chao.ladoNoMundo
  const s = chao.semente
  const mx = x + torX * TORCAO_DA_MOITA
  const my = y + torY * TORCAO_DA_MOITA
  let moita = 0
  for (let k = 0; k < ESCALAS_DA_MOITA.length; k += 1) {
    if (presencas[k] <= 0) continue
    const e = ESCALAS_DA_MOITA[k]
    moita += ruidoGirado(mx, my, e.lado * lado, k + 3, s + SEMENTE_DA_MOITA + k) * e.peso * presencas[k]
  }
  const t = Math.max(0, Math.min(1, (Math.abs(moita) - RAMPA_DA_MOITA.de) / (RAMPA_DA_MOITA.ate - RAMPA_DA_MOITA.de)))
  const peso = t * t * (3 - 2 * t)
  const cor = moita > 0 ? vida.moita : vida.broto
  const touceira = moita * TOUCEIRA.pesoDaMoita + ruidoGirado(mx, my, TOUCEIRA.lado * lado, 1, s + SEMENTE_DA_TOUCEIRA) * TOUCEIRA.peso * presencaDaTouceira
  const d = Math.max(0, Math.min(1, (touceira - TOUCEIRA.de) / (TOUCEIRA.ate - TOUCEIRA.de)))
  const detalhe = vida.ralo + (1 - vida.ralo) * d * d * (3 - 2 * d)
  saida[o] = detalhe * luz
  saida[o + 1] = (vida.meio[0] * (1 - detalhe) + tom * vida.tom[0] + peso * cor[0]) * luz
  saida[o + 2] = (vida.meio[1] * (1 - detalhe) + tom * vida.tom[1] + peso * cor[1]) * luz
  saida[o + 3] = (vida.meio[2] * (1 - detalhe) + tom * vida.tom[2] + peso * cor[2]) * luz
}

/**
 * O tom e a luz largos do pedaço (`[tom de -1 a 1, luz em torno de 1]` por
 * ponto). Mudam devagar (a menor escala do tom tem 0,7 lado do ladrilho), então
 * são calculados num ponto a cada `PASSO_DO_LARGO` da grade e a grade
 * interpola: um dezesseis avos das contas de ruído. O ponto da borda é o mesmo
 * do pedaço vizinho (mesma posição no mundo): sem emenda.
 */
function largosDoPedaco(chao: ChaoDaTextura, vida: VidaDoChao, pedaco: Pedaco): Float32Array {
  const largos = new Float32Array(PONTOS_DO_LARGO * PONTOS_DO_LARGO * 2)
  const passo = 2 ** pedaco.nivel
  const entrePontos = PASSO_DA_GRADE * PASSO_DO_LARGO * passo
  const x0 = pedaco.i * LADO_DO_PEDACO * passo
  const y0 = pedaco.j * LADO_DO_PEDACO * passo
  const lado = chao.ladoNoMundo
  const s = chao.semente
  const presencas = ESCALAS_DO_TOM.map((e) => presencaNaGrade(e.lado * lado, entrePontos))
  for (let ly = 0; ly < PONTOS_DO_LARGO; ly += 1) {
    const y = y0 + ly * entrePontos
    for (let lx = 0; lx < PONTOS_DO_LARGO; lx += 1) {
      const x = x0 + lx * entrePontos
      let tom = 0
      for (let k = 0; k < ESCALAS_DO_TOM.length; k += 1) {
        if (presencas[k] <= 0) continue
        const e = ESCALAS_DO_TOM[k]
        tom += ruidoGirado(x, y, e.lado * lado, k, s + SEMENTE_DO_TOM + k) * e.peso * presencas[k]
      }
      const o = (ly * PONTOS_DO_LARGO + lx) * 2
      largos[o] = Math.max(-1, Math.min(1, tom * GANHO_DO_TOM))
      largos[o + 1] = 1 + vida.luz * ruidoGirado(x, y, LUZ_LARGA * lado, 2, s + SEMENTE_DA_LUZ)
    }
  }
  return largos
}

/**
 * Torção, manchas e vida nos pontos da grade grossa do pedaço (33 x 33 pontos,
 * 7 campos). Manchas desligadas ou chão sem vida = campo 0, que não muda a
 * cor: sem vida, os bytes são os de sempre.
 */
function gradeDoPedaco(chao: ChaoDaTextura, pedaco: Pedaco): Float32Array {
  const grade = new Float32Array(PONTOS_DA_GRADE * PONTOS_DA_GRADE * CAMPOS)
  const passo = 2 ** pedaco.nivel
  const x0 = pedaco.i * LADO_DO_PEDACO * passo
  const y0 = pedaco.j * LADO_DO_PEDACO * passo
  const amplitude = chao.torcao * chao.ladoNoMundo
  const larga = TORCAO_LARGA.lado * chao.ladoNoMundo
  const fina = TORCAO_FINA.lado * chao.ladoNoMundo
  const s = chao.semente
  const vida = chao.vida
  const presencas = ESCALAS_DA_MOITA.map((e) => presencaNaGrade(e.lado * chao.ladoNoMundo, PASSO_DA_GRADE * passo))
  const presencaDaTouceira = presencaNaGrade(TOUCEIRA.lado * chao.ladoNoMundo, PASSO_DA_GRADE * passo)
  const largos = vida === undefined ? null : largosDoPedaco(chao, vida, pedaco)
  for (let gy = 0; gy < PONTOS_DA_GRADE; gy += 1) {
    const y = y0 + gy * PASSO_DA_GRADE * passo
    // A linha de cima dos largos e quanto este ponto anda para a de baixo.
    const ly = Math.min(PONTOS_DO_LARGO - 2, Math.floor(gy / PASSO_DO_LARGO))
    const fy = gy / PASSO_DO_LARGO - ly
    for (let gx = 0; gx < PONTOS_DA_GRADE; gx += 1) {
      const x = x0 + gx * PASSO_DA_GRADE * passo
      const o = (gy * PONTOS_DA_GRADE + gx) * CAMPOS
      if (amplitude > 0) {
        grade[o] = amplitude * (ruidoDeValor(x / larga, y / larga, s + 10) * TORCAO_LARGA.peso + ruidoDeValor(x / fina, y / fina, s + 11) * TORCAO_FINA.peso)
        grade[o + 1] = amplitude * (ruidoDeValor(x / larga, y / larga, s + 20) * TORCAO_LARGA.peso + ruidoDeValor(x / fina, y / fina, s + 21) * TORCAO_FINA.peso)
      }
      if (chao.manchas) grade[o + 2] = ruidoDoMundo(x, y, s)
      if (vida !== undefined && largos !== null) {
        const lx = Math.min(PONTOS_DO_LARGO - 2, Math.floor(gx / PASSO_DO_LARGO))
        const fx = gx / PASSO_DO_LARGO - lx
        const a = (ly * PONTOS_DO_LARGO + lx) * 2
        const b = a + PONTOS_DO_LARGO * 2
        const tomDeCima = largos[a] + (largos[a + 2] - largos[a]) * fx
        const luzDeCima = largos[a + 1] + (largos[a + 3] - largos[a + 1]) * fx
        const tom = tomDeCima + (largos[b] + (largos[b + 2] - largos[b]) * fx - tomDeCima) * fy
        const luz = luzDeCima + (largos[b + 1] + (largos[b + 3] - largos[b + 1]) * fx - luzDeCima) * fy
        vidaNoPonto(chao, vida, x, y, grade[o], grade[o + 1], tom, luz, presencas, presencaDaTouceira, grade, o + CAMPO_DA_VIDA)
      }
    }
  }
  return grade
}

export function comecarPedaco(chao: ChaoDaTextura, pedaco: Pedaco): PinturaDoPedaco {
  return { pixels: new Uint8ClampedArray(LADO_DO_PEDACO * LADO_DO_PEDACO * 4), grade: gradeDoPedaco(chao, pedaco), linha: 0 }
}

/**
 * Pinta as linhas da pintura até `ate` (exclusivo). Pintar em pedaços de
 * linhas dá os MESMOS bytes de pintar de uma vez (teste): a fila de fatias de
 * 8 ms (`pedacosDoChao.ts`) para em qualquer linha.
 */
export function pintarLinhas(chao: ChaoDaTextura, pedaco: Pedaco, p: PinturaDoPedaco, ate: number): void {
  const fim = Math.min(LADO_DO_PEDACO, ate)
  if (p.linha >= fim) return
  const passo = 2 ** pedaco.nivel
  const x0 = pedaco.i * LADO_DO_PEDACO * passo
  const y0 = pedaco.j * LADO_DO_PEDACO * passo
  const m = mipDoPedaco(chao, pedaco.nivel)
  const tex = mipDoLadrilho(chao.ladrilho, m)
  const L = tex.lado
  const mascara = L - 1
  const potencia = (L & mascara) === 0
  const fonte = tex.pixels
  // Px do ladrilho (no mip) por px do mundo.
  const escala = tex.lado / chao.ladoNoMundo
  // O grão: no nível 0 uma célula tem 2 x 2 px do mundo; acima, uma célula por pixel do pedaço, mais fraca (a média de várias).
  const celula = pedaco.nivel === 0 ? 2 : 1
  const forcaDoGrao = ((FORCA_DO_GRAO * 2) / 255) / 2 ** Math.max(0, pedaco.nivel - 1)
  const sementeDoGrao = SEMENTE_DO_GRAO + pedaco.nivel * 7
  const gx0 = pedaco.i * LADO_DO_PEDACO
  const gy0 = pedaco.j * LADO_DO_PEDACO
  const G = PONTOS_DA_GRADE
  const linhaDaGrade = new Float32Array(G * CAMPOS)
  const destino = p.pixels
  const grade = p.grade
  const comVida = chao.vida !== undefined
  const comManchas = chao.manchas
  const camposUsados = comVida ? CAMPOS : CAMPO_DA_VIDA
  for (let py = p.linha; py < fim; py += 1) {
    // A grade interpolada na vertical para esta linha.
    const ty = (py + 0.5) / PASSO_DA_GRADE
    const gyA = Math.min(G - 2, Math.floor(ty))
    const fy = ty - gyA
    const acima = gyA * G * CAMPOS
    const abaixo = acima + G * CAMPOS
    for (let ponto = 0; ponto < G * CAMPOS; ponto += CAMPOS) {
      // Sem vida, só os três primeiros campos: as outras texturas não pagam pelos da vida.
      for (let k = ponto; k < ponto + camposUsados; k += 1) {
        const a = grade[acima + k]
        linhaDaGrade[k] = a + (grade[abaixo + k] - a) * fy
      }
    }
    const yMundo = y0 + (py + 0.5) * passo
    const cy = Math.floor((gy0 + py) / celula)
    for (let px = 0; px < LADO_DO_PEDACO; px += 1) {
      const tx = (px + 0.5) / PASSO_DA_GRADE
      const gxA = Math.min(G - 2, Math.floor(tx))
      const fx = tx - gxA
      const oa = gxA * CAMPOS
      const ob = oa + CAMPOS
      const torX = linhaDaGrade[oa] + (linhaDaGrade[ob] - linhaDaGrade[oa]) * fx
      const torY = linhaDaGrade[oa + 1] + (linhaDaGrade[ob + 1] - linhaDaGrade[oa + 1]) * fx
      // O ladrilho, bilinear e dando a volta, na coordenada torcida (centro do texel em 0,5).
      const u = (x0 + (px + 0.5) * passo + torX) * escala - 0.5
      const v = (yMundo + torY) * escala - 0.5
      const iu = Math.floor(u)
      const iv = Math.floor(v)
      const fu = u - iu
      const fv = v - iv
      const ua = potencia ? iu & mascara : mod(iu, L)
      const ub = potencia ? (iu + 1) & mascara : mod(iu + 1, L)
      const va = (potencia ? iv & mascara : mod(iv, L)) * L
      const vb = (potencia ? (iv + 1) & mascara : mod(iv + 1, L)) * L
      const a = (va + ua) * 4
      const b = (va + ub) * 4
      const c = (vb + ua) * 4
      const d = (vb + ub) * 4
      const pa = (1 - fu) * (1 - fv)
      const pb = fu * (1 - fv)
      const pc = (1 - fu) * fv
      const pd = fu * fv
      const grao = (hash(Math.floor((gx0 + px) / celula), cy, sementeDoGrao) - 0.5) * forcaDoGrao
      const o = (py * LADO_DO_PEDACO + px) * 4
      let r = fonte[a] * pa + fonte[b] * pb + fonte[c] * pc + fonte[d] * pd
      let g = fonte[a + 1] * pa + fonte[b + 1] * pb + fonte[c + 1] * pc + fonte[d + 1] * pd
      let az = fonte[a + 2] * pa + fonte[b + 2] * pb + fonte[c + 2] * pc + fonte[d + 2] * pd
      if (comVida) {
        // A vida, interpolada da grade: o ladrilho vezes o ganho (a touceira e a luz) mais a soma (o tom, a moita e o que falta do `meio`).
        const ganho = linhaDaGrade[oa + 3] + (linhaDaGrade[ob + 3] - linhaDaGrade[oa + 3]) * fx
        r = r * ganho + linhaDaGrade[oa + 4] + (linhaDaGrade[ob + 4] - linhaDaGrade[oa + 4]) * fx
        g = g * ganho + linhaDaGrade[oa + 5] + (linhaDaGrade[ob + 5] - linhaDaGrade[oa + 5]) * fx
        az = az * ganho + linhaDaGrade[oa + 6] + (linhaDaGrade[ob + 6] - linhaDaGrade[oa + 6]) * fx
      }
      if (comManchas) {
        // Manchas: claro para o branco, escuro por multiplicação. Desligadas, o campo é 0 e as duas contas seriam
        // identidade (somar 0, multiplicar por 1): pular dá os mesmos bytes e poupa a conta em todo pixel.
        const n = linhaDaGrade[oa + 2] + (linhaDaGrade[ob + 2] - linhaDaGrade[oa + 2]) * fx
        const k = Math.min(1, Math.abs(n) * GANHO_DA_MANCHA)
        const claro = n > 0 ? MANCHA_CLARA * k : 0
        const escuro = n > 0 ? 1 : 1 - MANCHA_ESCURA * k
        r = (r + (255 - r) * claro) * escuro
        g = (g + (255 - g) * claro) * escuro
        az = (az + (255 - az) * claro) * escuro
      }
      // O grão, em luz suave.
      destino[o] = r + (grao * r * (255 - r)) / 255
      destino[o + 1] = g + (grao * g * (255 - g)) / 255
      destino[o + 2] = az + (grao * az * (255 - az)) / 255
      destino[o + 3] = 255
    }
  }
  p.linha = fim
}

/** O pedaço inteiro de uma vez (teste e folha de contato). */
export function pintarPedaco(chao: ChaoDaTextura, pedaco: Pedaco): Uint8ClampedArray {
  const p = comecarPedaco(chao, pedaco)
  pintarLinhas(chao, pedaco, p, LADO_DO_PEDACO)
  return p.pixels
}
