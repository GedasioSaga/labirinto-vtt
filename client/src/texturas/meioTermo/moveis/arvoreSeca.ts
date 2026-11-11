/**
 * ÁRVORE SECA (lote 8 dos objetos novos, 11/11/2026) de cima com volume: a
 * árvore morta do cemitério, sem uma folha. De cima ela é a COPA de galhos nus
 * em estrela irregular: seis galhos grossos saem do alto do tronco para todos
 * os lados, e cada um se abre em forquilhas e gravetos, cada vez mais finos e
 * tortos, até a borda; um deles está QUEBRADO (mais curto, com a ponta lascada
 * na madeira clara de dentro). No meio, o NÓ do alto do tronco, torcido (os
 * sulcos em espiral), com o OCO podre de onde caiu a ponta da árvore. No chão,
 * as RAÍZES expostas e a SOMBRA dos galhos, longe do pé pela altura da árvore.
 * Num dos galhos grossos, um CORVO pousado de través.
 *
 * É a árvore morta dos carimbos (`carimbos/embutidos.ts`: os raios, as
 * forquilhas, o galho quebrado, a madeira desbotada) com o volume do
 * Meio-Termo: chanfro, casca fendida, contorno e sombra.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura, e cada
 * peça sobe com a estrutura mais alta que contém o meio da caixa dela):
 * - o TRONCO é uma coluna redonda um pouco mais baixa que a copa: a frente
 *   dele sobe do chão até debaixo do nó, na casca da maior peça (os
 *   gravetos), com as fendas de pé;
 * - a COPA é um tampo solto na altura da árvore cuja forma é a dos próprios
 *   galhos: a beirada de cada galho é a espessura dele, e a sombra no chão é a
 *   dos galhos. O meio da caixa de cada peça da copa entra nela por uma ÂNCORA,
 *   um ponto sem área que não pinta nada: assim nenhuma peça da copa fica no
 *   chão;
 * - as RAÍZES ficam no chão: o meio da caixa de cada uma cai fora do tronco e
 *   fora dos galhos (a raiz que cairia debaixo de um galho gira até sair).
 *
 * As medidas saem do menor lado da pegada (2 x 2 casas de partida): a árvore
 * esticada continua redonda. Material: `madeira` (a árvore inteira, pintada
 * como casca fendida; a lasca do galho quebrado é a madeira lisa, mais clara).
 * O corvo e o oco são fixos. O piso de luz é um cinza-escuro frio
 * (`cena.corDoPiso`), como no espantalho: com o escuro da nogueira o corvo saía
 * marrom.
 */
import { hash, type Rgb } from '../../ruido'
import { elipse, elipseGirada, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type ClasseDaPeca, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'

const VOLTA = Math.PI * 2
const QUARTO_DE_VOLTA = Math.PI / 2

/** A altura da árvore (o alto da copa), em casas, e quanto o tronco fica abaixo dela (some debaixo do nó). */
const ALTURA_DA_ARVORE = 1.45
const FOLGA_DO_TRONCO = 0.05

// A planta, em frações do menor meio lado da pegada.
/** Até onde vai a copa (o graveto mais longe) e o raio do tronco e do nó. */
const RAIO_DA_COPA = 0.97
const RAIO_DO_TRONCO = 0.16
const RAIO_DO_NO = 0.2
/** O galho grosso: quantos, o comprimento até a primeira forquilha e a meia largura no nó. */
const GALHOS = 6
const COMPRIMENTO_DO_GALHO = 0.44
const GROSSURA_DO_GALHO = 0.1
/** Quanto cada nível encolhe o comprimento do seguinte (a forquilha), e o último nível (os gravetos da borda). */
const ENCOLHE: readonly number[] = [0.62, 0.58, 0.55]
const ULTIMO_NIVEL = 3
/** Quanto o galho afina até a forquilha, a meia largura mínima da ponta do graveto (px) e o quanto cada lance vira (radianos). */
const AFINA = 0.58
const PONTA_DO_GRAVETO = 0.24
const TORTO_DO_GALHO = 0.44
/** Os níveis que vão na peça grossa (os outros, na peça fina, de chanfro miúdo). */
const NIVEIS_GROSSOS = 1
/** O galho quebrado (o terceiro): que fração do comprimento sobrou e quanto da grossura tem a ponta. */
const QUEBRADO = 2
const SOBRA_DO_QUEBRADO = 0.82
const PONTA_DO_QUEBRADO = 0.8

/**
 * As raízes: de onde saem e até onde vai cada uma (frações do menor meio lado; as duas compridas
 * passam da copa e aparecem de cima), a grossura na saída e na ponta.
 */
const SAIDA_DA_RAIZ = 0.12
const ALCANCE_DAS_RAIZES: readonly number[] = [0.62, 0.86, 0.55, 0.8, 0.6]
const GROSSURA_DA_RAIZ = 0.09
const FIM_DA_RAIZ = 0.014
/** Os giros que a raiz tenta, nesta ordem, até o meio dela sair de debaixo dos galhos (radianos). */
const GIROS_DA_RAIZ: readonly number[] = [0, 0.16, -0.16, 0.32, -0.32, 0.48, -0.48, 0.64, -0.64]

/** A sombra da copa no chão: a borda (a dos galhos finos ainda se lê) e a força. */
const BORDA_DA_SOMBRA_DA_COPA = 2.2
const FORCA_DA_SOMBRA_DA_COPA = 0.26

/** Os sulcos do nó: quantos na volta e quanto cada um torce por px de raio (a espiral do tronco torcido). */
const SULCOS_DO_NO = 5
const TORCAO_DO_NO = 0.05
const LARGURA_DO_SULCO = 0.1
const FUNDO_DO_SULCO = 0.12

/** O oco podre no alto do tronco, e a lasca da ponta quebrada (a madeira lisa, quanto mais clara). */
const MIOLO_PODRE: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x44, 0x3e] }
const TOM_DA_LASCA = 1.28
/** O corvo: quase preto e neutro, a asa com um brilho frio das penas, o bico cor de chifre. */
const CORVO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x3a, 0x3d] }
const ASA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x4a, 0x4f] }
const BICO: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x58, 0x50] }
const BRILHO_DO_OLHO: MaterialDaPeca = { classe: 'liso', rgb: [0xd9, 0xd4, 0xc4] }
/** O escuro em que o pixel escuro demais é levantado: frio, para o corvo e a madeira cinza não saírem marrons. */
const ESCURO_DO_CORVO: Rgb = [0x42, 0x42, 0x48]
/** O corvo é desenhado para a árvore de 2 x 2 casas (meio lado de 56 px), neste tamanho, e escala com ela. */
const MEIO_LADO_DO_CORVO = 56
const TAMANHO_DO_CORVO = 1.35
/** O galho em que o corvo pousa (o grosso que aponta mais perto deste rumo, em radianos de tela) e onde nele (do fim do último lance para trás). */
const RUMO_DO_CORVO = 2.4
const POUSO_NO_ULTIMO_LANCE = 0.35

/** O lado da célula da grade da união (px do protótipo). */
const LADO_DA_CELULA = 2.5
/**
 * Fundo o bastante e longe o bastante: achada uma forma em que o ponto está
 * mais fundo que isto, a união para de procurar; e o ponto que está mais longe
 * que isto de tudo leva só este piso da distância (o que a garante), sem
 * procurar a forma mais perto. Nenhum leitor passa disto: o maior chanfro da
 * árvore é o da raiz (3 px), a beirada da 3/4 para em 4 px, a sombra mais
 * larga some a 2,4 px da forma, e a varredura da 3/4 só anda mais devagar com
 * um piso.
 */
const FUNDO_BASTANTE = 5
const LONGE_BASTANTE = 4.5

/** Um galho: a linha do meio, a meia largura em cada ponto, o nível (0 = grosso) e o galho grosso de onde saiu. */
interface Galho {
  readonly pontos: Ponto[]
  readonly raios: readonly number[]
  readonly nivel: number
  readonly ramo: number
}

/**
 * Cápsula de pontas desiguais (o cone de pontas redondas, a de Inigo Quilez):
 * raio `ra` em (ax, ay) e `rb` em (bx, by). A distância é exata, então a união
 * de muitas continua boa para o chanfro, a sombra e a frente varrida.
 */
function conico(ax: number, ay: number, ra: number, bx: number, by: number, rb: number): Forma {
  const caixa: Caixa = [Math.min(ax - ra, bx - rb), Math.min(ay - ra, by - rb), Math.max(ax + ra, bx + rb), Math.max(ay + ra, by + rb)]
  const dx = bx - ax
  const dy = by - ay
  const h = Math.hypot(dx, dy)
  // Uma ponta dentro da outra: fica a roda maior.
  if (h <= Math.abs(ra - rb) + 1e-6) {
    const [cx, cy, r] = ra >= rb ? [ax, ay, ra] : [bx, by, rb]
    return { b: caixa, d: (x, y) => Math.hypot(x - cx, y - cy) - r }
  }
  const ux = dx / h
  const uy = dy / h
  const b = (ra - rb) / h
  const a = Math.sqrt(1 - b * b)
  return {
    b: caixa,
    d(x, y) {
      const px = x - ax
      const py = y - ay
      const aoLongo = px * ux + py * uy
      const atraves = Math.abs(px * uy - py * ux)
      const k = a * aoLongo - b * atraves
      if (k < 0) return Math.sqrt(atraves * atraves + aoLongo * aoLongo) - ra
      if (k > a * h) return Math.sqrt(atraves * atraves + (aoLongo - h) * (aoLongo - h)) - rb
      return atraves * a + aoLongo * b - ra
    },
  }
}

/** As formas de uma célula da grade, da mais perto para a mais longe, e o quadrado da distância de cada caixa à célula. */
interface Celula {
  readonly formas: Int32Array
  readonly longe: Float64Array
}

/**
 * A união de muitas formas (a copa tem uns quatrocentos lances), rápida: cada
 * forma entra, de uma vez, nas células da grade a até `LONGE_BASTANTE` px da
 * caixa dela. Para um ponto, só as formas da célula dele contam, da mais perto
 * para a mais longe: a forma cuja caixa já está mais longe que a melhor
 * distância achada nem é lida, a leitura para quando a célula inteira já está
 * mais longe que ela (as que vêm depois estão ainda mais) ou quando o ponto já
 * está fundo o bastante. A forma que ficou fora da célula está a mais de
 * `LONGE_BASTANTE` de todo ponto dela: então a distância achada, se passa
 * disto, vira o piso (e o ponto fora da grade leva o piso direto). A ordem da
 * célula se acerta na primeira vez que ela é lida.
 */
function feixe(formas: readonly Forma[]): Forma {
  const n = formas.length
  const caixas = new Float64Array(n * 4)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  formas.forEach((f, i) => {
    caixas.set(f.b, i * 4)
    x0 = Math.min(x0, f.b[0])
    y0 = Math.min(y0, f.b[1])
    x1 = Math.max(x1, f.b[2])
    y1 = Math.max(y1, f.b[3])
  })
  const L = LADO_DA_CELULA
  const M = LONGE_BASTANTE
  const gx = x0 - M
  const gy = y0 - M
  const colunas = Math.max(1, Math.ceil((x1 - x0 + 2 * M) / L))
  const linhas = Math.max(1, Math.ceil((y1 - y0 + 2 * M) / L))
  // Cada forma nas células que a caixa dela, alargada de `M`, cobre.
  const listas: number[][] = Array.from({ length: colunas * linhas }, () => [])
  for (let i = 0; i < n; i += 1) {
    const o = i * 4
    const c0 = Math.max(0, Math.floor((caixas[o] - M - gx) / L))
    const c1 = Math.min(colunas - 1, Math.floor((caixas[o + 2] + M - gx) / L))
    const l0 = Math.max(0, Math.floor((caixas[o + 1] - M - gy) / L))
    const l1 = Math.min(linhas - 1, Math.floor((caixas[o + 3] + M - gy) / L))
    for (let cj = l0; cj <= l1; cj += 1) for (let ci = c0; ci <= c1; ci += 1) listas[cj * colunas + ci].push(i)
  }
  const grade = new Array<Celula | undefined>(colunas * linhas)
  const daCelula = (ci: number, cj: number): Celula => {
    const cx0 = gx + ci * L
    const cy0 = gy + cj * L
    const achadas = listas[cj * colunas + ci].map((i): [number, number] => {
      const o = i * 4
      const fx = Math.max(0, caixas[o] - cx0 - L, cx0 - caixas[o + 2])
      const fy = Math.max(0, caixas[o + 1] - cy0 - L, cy0 - caixas[o + 3])
      return [i, fx * fx + fy * fy]
    })
    achadas.sort((a, b) => a[1] - b[1] || a[0] - b[0])
    return { formas: Int32Array.from(achadas, ([i]) => i), longe: Float64Array.from(achadas, ([, d2]) => d2) }
  }
  const menorEntre = (x: number, y: number, c: Celula): number => {
    let menor = Infinity
    for (let k = 0; k < c.formas.length; k += 1) {
      if (menor > 0 ? c.longe[k] >= menor * menor : c.longe[k] > 0) break
      const o = c.formas[k] * 4
      const fx = x < caixas[o] ? caixas[o] - x : x > caixas[o + 2] ? x - caixas[o + 2] : 0
      const fy = y < caixas[o + 1] ? caixas[o + 1] - y : y > caixas[o + 3] ? y - caixas[o + 3] : 0
      const fora = fx * fx + fy * fy
      if (fora > 0 && (menor <= 0 || fora >= menor * menor)) continue
      const d = formas[c.formas[k]].d(x, y)
      if (d < menor) {
        menor = d
        if (menor <= -FUNDO_BASTANTE) return menor
      }
    }
    return menor < M ? menor : M
  }
  return {
    b: [x0, y0, x1, y1],
    d(x, y) {
      const ci = Math.floor((x - gx) / L)
      const cj = Math.floor((y - gy) / L)
      if (ci < 0 || cj < 0 || ci >= colunas || cj >= linhas) return M
      const k = cj * colunas + ci
      let celula = grade[k]
      if (celula === undefined) {
        celula = daCelula(ci, cj)
        grade[k] = celula
      }
      return menorEntre(x, y, celula)
    },
  }
}

/**
 * ÂNCORA: o ponto (x0, y0), e só ele, fica "dentro" (distância 0); o resto
 * está infinitamente longe. Na forma da copa ela põe o meio da caixa de uma
 * peça dentro da copa (a conta de `tresQuartos.ts`) sem pintar nada. O meio é
 * a mesma conta de lá, `(b[0] + b[2]) / 2`, e o quarto de volta só troca sinal
 * e lugar de número: a igualdade vale também na peça girada.
 */
function ancora(x0: number, y0: number): Forma {
  return { b: [x0, y0, x0, y0], d: (x, y) => (x === x0 && y === y0 ? 0 : Infinity) }
}

function ancoraDa(f: Forma): Forma {
  return ancora((f.b[0] + f.b[2]) / 2, (f.b[1] + f.b[3]) / 2)
}

/** Os lances do galho, um cone de pontas redondas entre cada dois pontos. */
function lancesDo(galho: Galho): Forma[] {
  const lances: Forma[] = []
  for (let i = 1; i < galho.pontos.length; i += 1) {
    const [ax, ay] = galho.pontos[i - 1]
    const [bx, by] = galho.pontos[i]
    lances.push(conico(ax, ay, galho.raios[i - 1], bx, by, galho.raios[i]))
  }
  return lances
}

/**
 * Um galho de `de` no `rumo`, que vira um pouco a cada lance e afina de
 * `grosso`; até o último nível ele se abre na ponta em dois e solta um ramo do
 * lado, de perto do meio (o desenho da árvore morta dos carimbos).
 */
function crescer(lista: Galho[], de: Ponto, rumo: number, comprimento: number, grosso: number, nivel: number, ramo: number, k: number): void {
  const ultimo = nivel === ULTIMO_NIVEL
  const fino = ultimo ? Math.max(PONTA_DO_GRAVETO, grosso * 0.34) : grosso * AFINA
  const lances = nivel < 2 ? 3 : 2
  const pontos: Ponto[] = [de]
  const raios: number[] = [grosso]
  let [x, y] = de
  let r = rumo
  for (let i = 1; i <= lances; i += 1) {
    r += (hash(k, i, 401) - 0.5) * TORTO_DO_GALHO
    x += (Math.cos(r) * comprimento) / lances
    y += (Math.sin(r) * comprimento) / lances
    pontos.push([x, y])
    raios.push(grosso + ((fino - grosso) * i) / lances)
  }
  lista.push({ pontos, raios, nivel, ramo })
  if (ultimo) return
  // O ramo do lado: no galho grosso sai mais longe do nó (perto do tronco os galhos ficam nus e o chão aparece entre eles).
  if (nivel < 2 || hash(k, 1, 402) < 0.6) {
    const lado = hash(k, 2, 403) < 0.5 ? 1 : -1
    const de = nivel === 0 ? 2 : 1
    crescer(lista, pontos[de], rumo + lado * (0.55 + 0.35 * hash(k, 3, 404)), comprimento * 0.58 * (0.9 + 0.2 * hash(k, 4, 405)), raios[de] * 0.66, nivel + 1, ramo, k * 7 + 11)
  }
  const abre = 0.28 + 0.2 * hash(k, 5, 406)
  const proximo = comprimento * ENCOLHE[nivel]
  crescer(lista, [x, y], r - abre, proximo * (0.9 + 0.2 * hash(k, 6, 407)), fino, nivel + 1, ramo, k * 7 + 23)
  crescer(lista, [x, y], r + abre, proximo * (0.9 + 0.2 * hash(k, 7, 408)), fino, nivel + 1, ramo, k * 7 + 37)
}

/** Os rumos dos galhos grossos: em roda, cada um com um desvio sorteado (sempre o mesmo). */
function rumosDosGalhos(): number[] {
  return Array.from({ length: GALHOS }, (_v, i) => (i * VOLTA) / GALHOS + 0.35 + (hash(i, 1, 409) - 0.5) * 0.42)
}

/** A ponta do galho quebrado: onde fica, a meia largura e o rumo do último lance. */
interface Quebra {
  readonly ponto: Ponto
  readonly raio: number
  readonly rumo: number
}

/** A copa inteira, no tamanho certo: os galhos, e a ponta do galho quebrado. */
function montarCopa(R: number, rumos: readonly number[]): { galhos: Galho[]; quebra: Quebra } {
  const galhos: Galho[] = []
  const grosso = GROSSURA_DO_GALHO * R
  let quebra: Quebra = { ponto: [0, 0], raio: 0, rumo: 0 }
  rumos.forEach((rumo, i) => {
    const comprimento = COMPRIMENTO_DO_GALHO * R * (0.9 + 0.2 * hash(i, 2, 410))
    if (i !== QUEBRADO) {
      crescer(galhos, [0, 0], rumo, comprimento, grosso, 0, i, 190 + i * 13)
      return
    }
    // O quebrado: dois lances tortos, um ramo do lado e a ponta rombuda (a lasca vem por cima).
    const curto = comprimento * SOBRA_DO_QUEBRADO
    const fino = grosso * PONTA_DO_QUEBRADO
    const meio: Ponto = [Math.cos(rumo + 0.08) * curto * 0.5, Math.sin(rumo + 0.08) * curto * 0.5]
    const ponta: Ponto = [meio[0] + Math.cos(rumo - 0.06) * curto * 0.5, meio[1] + Math.sin(rumo - 0.06) * curto * 0.5]
    galhos.push({ pontos: [[0, 0], meio, ponta], raios: [grosso, (grosso + fino) / 2, fino], nivel: 0, ramo: i })
    crescer(galhos, meio, rumo + 0.75, comprimento * 0.55, grosso * 0.5, 2, i, 220 + i * 13)
    quebra = { ponto: ponta, raio: fino, rumo: rumo - 0.06 }
  })
  // A copa encosta na borda da pegada: os pontos (não as larguras) vão para o raio certo.
  let longe = 0
  for (const g of galhos) g.pontos.forEach(([x, y], k) => (longe = Math.max(longe, Math.hypot(x, y) + g.raios[k])))
  const fator = (RAIO_DA_COPA * R) / longe
  for (const g of galhos) g.pontos.forEach(([x, y], k) => (g.pontos[k] = [x * fator, y * fator]))
  quebra = { ...quebra, ponto: [quebra.ponto[0] * fator, quebra.ponto[1] * fator] }
  return { galhos, quebra }
}

/** A lasca da ponta quebrada: dentes compridos e curtos para a frente, como madeira que partiu. */
function pontaLascada(q: Quebra): Forma {
  const fx = Math.cos(q.rumo)
  const fy = Math.sin(q.rumo)
  const em = (frente: number, lado: number): Ponto => [q.ponto[0] + (fx * frente - fy * lado) * q.raio, q.ponto[1] + (fy * frente + fx * lado) * q.raio]
  return poligono([em(-0.55, -0.92), em(0.95, -0.66), em(0.32, -0.28), em(1.55, 0.04), em(0.48, 0.36), em(1.1, 0.78), em(-0.55, 0.92)])
}

/** O raio do contorno do nó no rumo `teta`: torto, e inchado onde sai cada galho grosso. */
function raioDoNo(teta: number, Rn: number, rumos: readonly number[]): number {
  let inchaco = 0
  for (const rumo of rumos) {
    let d = teta - rumo
    d -= Math.round(d / VOLTA) * VOLTA
    inchaco += 0.15 * Math.exp(-(d * d) / 0.1)
  }
  return Rn * (1 + 0.06 * Math.cos(3 * teta + 1) + 0.04 * Math.cos(5 * teta - 2) + inchaco)
}

/** O nó do alto do tronco: a casca com os sulcos em espiral (o tronco torcido) e o escuro que afunda para o meio. */
function texDoNo(Rn: number, classe: ClasseDaPeca): Textura {
  const base = texturaDaClasse(classe)
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    const r = Math.hypot(x, y)
    const fase = (Math.atan2(y, x) / VOLTA) * SULCOS_DO_NO + r * TORCAO_DO_NO
    const f = Math.abs(fase - Math.floor(fase) - 0.5)
    if (f < LARGURA_DO_SULCO) s[3] -= FUNDO_DO_SULCO * (1 - f / LARGURA_DO_SULCO)
    s[3] -= 0.1 * Math.max(0, 1 - r / Rn)
  }
}

/** O oco podre no alto do tronco, de onde caiu a ponta: torto e um pouco fora do meio. */
function oco(Rn: number): Forma {
  const LADOS = 9
  const pontos: Ponto[] = Array.from({ length: LADOS }, (_v, i): Ponto => {
    const teta = (i / LADOS) * VOLTA + 0.3
    const r = Rn * (0.34 + 0.12 * hash(i, 5, 416))
    return [Rn * 0.12 + Math.cos(teta) * r, -Rn * 0.08 + Math.sin(teta) * r * 0.86]
  })
  return poligono(pontos)
}

/** O corvo pousado de través no galho (de cima: o rabo de um lado, a cabeça e o bico do outro), em px do corvo. */
function montarCorvo(onde: Ponto, rumo: number, escala: number): { pecas: [Forma, MaterialDaPeca, number, number][]; silhueta: Forma[] } {
  const co = Math.cos(rumo)
  const si = Math.sin(rumo)
  const em = (lx: number, ly: number): Ponto => [onde[0] + (lx * co - ly * si) * escala, onde[1] + (lx * si + ly * co) * escala]
  const oval = (lx: number, ly: number, rx: number, ry: number, ang = 0): Forma => {
    const [x, y] = em(lx, ly)
    return elipseGirada(x, y, rx * escala, ry * escala, rumo + ang)
  }
  // O rabo em leque (abre para trás, com o entalhe no meio), o corpo, as asas fechadas uma por cima da outra
  // nas costas (as pontas passam por cima do rabo), a cabeça e o bico grosso.
  const rabo = poligono([em(-2.2, -1.2), em(-6.6, -2), em(-8.9, -2.5), em(-9.3, -1.2), em(-8.7, 0), em(-9.3, 1.2), em(-8.9, 2.5), em(-6.6, 2), em(-2.2, 1.2)])
  const corpo = oval(0, 0, 3.9, 2.6)
  const asaDeBaixo = poligono([em(1.8, 1.9), em(-1.5, 2.3), em(-5.6, 1.4), em(-7.4, 0.2), em(-4.2, -0.3), em(0.6, 0.2)])
  const asaDeCima = poligono([em(2, -1.9), em(-1.4, -2.3), em(-5.4, -1.4), em(-7.6, 0.6), em(-4.4, 0.9), em(0.4, 0.3)])
  const cabeca = oval(4, 0, 1.9, 1.75)
  const bico = poligono([em(5.3, -0.9), em(8.3, -0.05), em(5.3, 0.9)])
  const pecas: [Forma, MaterialDaPeca, number, number][] = [
    [rabo, CORVO, 0.6, 0.92],
    [corpo, CORVO, 2, 1],
    [asaDeBaixo, ASA, 0.9, 0.88],
    [asaDeCima, ASA, 0.9, 1],
    [cabeca, CORVO, 1.3, 1.06],
    [bico, BICO, 0.45, 1],
    [oval(4.6, -1.05, 0.3, 0.3), BRILHO_DO_OLHO, 0, 0.9],
  ]
  return { pecas, silhueta: [rabo, corpo, asaDeBaixo, asaDeCima, cabeca, bico] }
}

/** Onde o corvo pousa: no último lance do galho grosso que aponta mais perto de `RUMO_DO_CORVO` (nunca o quebrado), de través nele. */
function pousoDoCorvo(galhos: readonly Galho[], rumos: readonly number[]): { onde: Ponto; rumo: number } {
  const longeDoRumo = (rumo: number): number => {
    let d = rumo - RUMO_DO_CORVO
    d -= Math.round(d / VOLTA) * VOLTA
    return Math.abs(d)
  }
  // Começa no galho depois do quebrado, que nunca é ele.
  let pouso = (QUEBRADO + 1) % GALHOS
  rumos.forEach((rumo, i) => {
    if (i !== QUEBRADO && longeDoRumo(rumo) < longeDoRumo(rumos[pouso])) pouso = i
  })
  const galho = galhos.find((g) => g.ramo === pouso && g.nivel === 0)
  if (galho === undefined) return { onde: [0, 0], rumo: 0 }
  const fim = galho.pontos[galho.pontos.length - 1]
  const antes = galho.pontos[galho.pontos.length - 2]
  const t = 1 - POUSO_NO_ULTIMO_LANCE
  return { onde: [antes[0] + (fim[0] - antes[0]) * t, antes[1] + (fim[1] - antes[1]) * t], rumo: Math.atan2(fim[1] - antes[1], fim[0] - antes[0]) }
}

/** A raiz no rumo `rumo`, até `alcance`: a linha do meio, torta, afinando até sumir no chão. */
function raiz(R: number, rumo: number, alcance: number, k: number): Galho {
  const pontos: Ponto[] = []
  const raios: number[] = []
  const LANCES = 4
  let r = rumo
  for (let i = 0; i <= LANCES; i += 1) {
    const s = i / LANCES
    if (i > 0) r += (hash(k, i, 413) - 0.5) * 0.55
    const longe = R * (SAIDA_DA_RAIZ + (alcance - SAIDA_DA_RAIZ) * s)
    pontos.push([Math.cos(r) * longe, Math.sin(r) * longe])
    raios.push(R * (GROSSURA_DA_RAIZ + (FIM_DA_RAIZ - GROSSURA_DA_RAIZ) * Math.pow(s, 0.7)))
  }
  return { pontos, raios, nivel: 0, ramo: -1 }
}

/** As raízes entre os galhos grossos, cada uma girando até o meio da caixa sair do tronco e da copa (senão subiria com ela na 3/4). */
function raizesNoChao(R: number, rumos: readonly number[], copa: Forma, tronco: Forma): Forma[] {
  const raizes: Forma[] = []
  for (let i = 0; i < ALCANCE_DAS_RAIZES.length; i += 1) {
    const base = rumos[i] + ((rumos[(i + 1) % GALHOS] - rumos[i] + VOLTA) % VOLTA) / 2
    for (const giro of GIROS_DA_RAIZ) {
      const forma = feixe(lancesDo(raiz(R, base + giro, ALCANCE_DAS_RAIZES[i], 500 + i)))
      const meioX = (forma.b[0] + forma.b[2]) / 2
      const meioY = (forma.b[1] + forma.b[3]) / 2
      if (copa.d(meioX, meioY) > 0 && tronco.d(meioX, meioY) > 0) {
        raizes.push(forma)
        break
      }
    }
  }
  return raizes
}

export const montarArvoreSeca: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const R = Math.min(c.hw, c.hh)
  const madeira = c.m.madeira
  const casca: MaterialDaPeca = { ...madeira, classe: 'casca', casca: 'fendida' }
  const L = cena.partes
  const H = g * ALTURA_DA_ARVORE
  const Rn = RAIO_DO_NO * R
  const polar = { cx: 0, cy: 0, r: R }
  cena.corDoPiso = ESCURO_DO_CORVO

  // A copa: os gravetos numa peça, os galhos grossos noutra, a lasca, o nó com o oco e o corvo.
  const rumos = rumosDosGalhos()
  const { galhos, quebra } = montarCopa(R, rumos)
  const grossos = feixe(galhos.filter((gg) => gg.nivel <= NIVEIS_GROSSOS).flatMap(lancesDo))
  const finos = feixe(galhos.filter((gg) => gg.nivel > NIVEIS_GROSSOS).flatMap(lancesDo))
  const lasca = pontaLascada(quebra)
  const no: Forma = { b: [-Rn * 1.4, -Rn * 1.4, Rn * 1.4, Rn * 1.4], d: (x, y) => Math.hypot(x, y) - raioDoNo(Math.atan2(y, x), Rn, rumos) }
  const buraco = oco(Rn)
  const pouso = pousoDoCorvo(galhos, rumos)
  const corvo = montarCorvo(pouso.onde, pouso.rumo - QUARTO_DE_VOLTA, (R / MEIO_LADO_DO_CORVO) * TAMANHO_DO_CORVO)
  const pecasDaCopa = [finos, grossos, lasca, no, buraco, ...corvo.pecas.map(([f]) => f)]
  // O nó vem primeiro: no meio da copa ele já dá o fundo bastante, e a união para ali.
  const copa = feixe([no, lasca, ...corvo.silhueta, ...galhos.flatMap(lancesDo), ...pecasDaCopa.map(ancoraDa)])
  const tronco = elipse(0, 0, RAIO_DO_TRONCO * R, RAIO_DO_TRONCO * R)
  const raizes = raizesNoChao(R, rumos, copa, tronco)

  // As sombras: o tronco arrastado até debaixo do nó, a copa solta na altura da árvore, e cada raiz rente.
  cena.sombras.push({ forma: tronco, z: H - g * FOLGA_DO_TRONCO }, contato(tronco, 0.32))
  cena.sombras.push({ forma: copa, z: H, solta: true, suave: BORDA_DA_SOMBRA_DA_COPA, forca: FORCA_DA_SOMBRA_DA_COPA })
  raizes.forEach((forma) => cena.sombras.push(contato(forma, 0.3), { forma, z: 0, suave: 2.4, forca: 0.18 }))

  // As raízes no chão, com a casca ao comprido delas; os gravetos por baixo e os galhos grossos por cima, com a casca saindo do nó.
  raizes.forEach((forma, k) => {
    L.push(P(forma, casca, { polar, bisel: R * GROSSURA_DA_RAIZ * 0.6, contorno: 0.28, tom: 0.84 + 0.1 * hash(k, 5, 415), semente: 3000 + k }))
  })
  L.push(P(finos, casca, { polar, bisel: 0.8, contorno: 0.3, tom: 0.97, semente: 3100 }))
  L.push(P(grossos, casca, { polar, bisel: R * GROSSURA_DO_GALHO * 0.42, contorno: 0.3, semente: 3200, projeta: { dist: 1.2, forca: 0.22 } }))
  L.push(P(lasca, madeira, { eixo: quebra.rumo, tabua: 0, bisel: quebra.raio * 0.3, contorno: 0.3, tom: TOM_DA_LASCA, semente: 3250 }))
  // O nó torcido e o oco podre do alto, de beira funda.
  L.push(P(no, casca, { polar: { cx: 0, cy: 0, r: Rn }, bisel: Rn * 0.55, contorno: 0.3, tom: 0.92, textura: texDoNo(Rn, casca.classe), semente: 3300, projeta: { dist: 1.4, forca: 0.26 } }))
  L.push(P(buraco, MIOLO_PODRE, { bisel: 0.8, contorno: 0.26, recesso: { k: 1.4, forca: 0.36 }, semente: 3302 }))
  // O corpo e o rabo do corvo fazem sombra no galho de baixo.
  for (const [forma, mat, bisel, tom] of corvo.pecas) {
    L.push(P(forma, mat, { bisel, tom, contorno: 0.3, semente: 3320, ...(mat === CORVO ? { projeta: { dist: 0.9, forca: 0.24 } } : {}) }))
  }
}
