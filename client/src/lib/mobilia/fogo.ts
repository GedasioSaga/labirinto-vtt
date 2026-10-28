/**
 * OBJETO FOGO (pedido do mestre de 27/10/2026, `docs/design/objeto-fogo/README.md`):
 * fogo solto, para pôr em cima de qualquer coisa que está pegando fogo. A
 * parte PARADA (o chão queimado, as brasas e as toras carbonizadas) é a imagem
 * do móvel, pintada uma vez (`texturas/meioTermo/moveis/fogo.ts`); a parte que
 * MEXE (as línguas, o brilho, as fagulhas e a fumaça) é a camada animada
 * `pixi/fogosDoMapa.ts`. As duas leem a MESMA disposição de línguas daqui, então
 * cada brasa pintada fica no pé de uma língua animada.
 *
 * Decisões do mestre: a chama é a da fogueira de hoje (várias línguas,
 * `pixi/chamasDasFogueiras.ts`); três tamanhos no painel (Chama, Fogaréu e
 * Incêndio); a pegada é o tamanho do objeto, como nos outros móveis: esticar
 * dá mais línguas, não línguas maiores.
 *
 * Sem import nenhum de Pixi nem de `types/map.ts`: função pura, testável.
 */

/** Os três tamanhos de partida do painel. */
export type TamanhoDoFogo = 'chama' | 'fogareu' | 'incendio'

export const TAMANHOS_DO_FOGO: readonly TamanhoDoFogo[] = ['chama', 'fogareu', 'incendio']

export const ROTULO_DO_TAMANHO_DO_FOGO: Readonly<Record<TamanhoDoFogo, string>> = {
  chama: 'Chama',
  fogareu: 'Fogaréu',
  incendio: 'Incêndio',
}

/** A pegada de cada tamanho, em casas (largura x altura, sem giro). */
export const CASAS_DO_TAMANHO_DO_FOGO: Readonly<Record<TamanhoDoFogo, { readonly largura: number; readonly altura: number }>> = {
  chama: { largura: 1, altura: 1 },
  fogareu: { largura: 2, altura: 2 },
  incendio: { largura: 4, altura: 3 },
}

/** Folga, em casas, para a pegada ainda contar como um dos três tamanhos (arredondamento do arrasto). */
const FOLGA_DO_TAMANHO = 0.02

/** O tamanho do painel que esta pegada é, na grade `grade`; `null` = esticado à mão (nenhum dos três). */
export function tamanhoDoFogo(largura: number, altura: number, grade: number): TamanhoDoFogo | null {
  if (!(grade > 0) || !Number.isFinite(largura) || !Number.isFinite(altura)) return null
  const w = largura / grade
  const h = altura / grade
  for (const tamanho of TAMANHOS_DO_FOGO) {
    const casas = CASAS_DO_TAMANHO_DO_FOGO[tamanho]
    if (Math.abs(w - casas.largura) <= FOLGA_DO_TAMANHO && Math.abs(h - casas.altura) <= FOLGA_DO_TAMANHO) return tamanho
  }
  return null
}

/**
 * Px de mundo por casa que a disposição supõe: a mesma grade de referência da
 * imagem dos móveis (`GRADE_DE_REFERENCIA` de `texturas/meioTermo/moveis`), para
 * a brasa pintada e a língua animada caírem no mesmo ponto em qualquer grade.
 */
export const CASA_DO_FOGO_PX = 50

/** Teto de línguas por fogo: um incêndio esticado sobre a vila inteira não vira milhares de nós. */
export const MAXIMO_DE_LINGUAS = 24

/**
 * Quantas línguas tem um fogo de `casasW` x `casasH` casas: 3 na Chama (1 casa),
 * 5 no Fogaréu (2 x 2) e 11 no Incêndio (4 x 3), os números do protótipo; no
 * meio e acima, cresce com a área, até `MAXIMO_DE_LINGUAS`.
 */
export function numeroDeLinguas(casasW: number, casasH: number): number {
  if (!(casasW > 0) || !(casasH > 0) || !Number.isFinite(casasW * casasH)) return 0
  return Math.max(1, Math.min(MAXIMO_DE_LINGUAS, Math.round(2 + 0.75 * casasW * casasH)))
}

/** Uma língua: a base em casas (centro do fogo na origem, y para baixo) e a altura em repouso, em casas. */
export interface LinguaDoFogo {
  readonly x: number
  readonly y: number
  readonly altura: number
}

/** Ângulo dourado: a espiral de girassol espalha as bases sem fileira nem buraco. */
const ANGULO_DOURADO = Math.PI * (3 - Math.sqrt(5))
/** A língua mais alta, em casas, num fogo de lado menor 1 (0,92 casa na Chama, 1,45 no Fogaréu, 1,9 no Incêndio). */
const ALTURA_DA_LINGUA_DE_UMA_CASA = 0.92
const EXPOENTE_DA_ALTURA = 0.66
/** Até onde as bases vão, em fração da pegada: o brilho e a fuligem passam um pouco da última língua. */
const ALCANCE_X = 0.36
const ALCANCE_Y = 0.3
/** As bases ficam um pouco abaixo do centro: o corpo das chamas em pé cai no meio da pegada. */
const DESCIDA_DA_BASE = 0.08

/** Sorteio fixo em [0, 1): a disposição não usa o id, então a imagem parada (dividida entre fogos iguais) casa com ela. */
function sorteio(i: number, n: number): number {
  const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
  return v - Math.floor(v)
}

/** A língua mais alta de um fogo de `casasW` x `casasH` casas, em casas. */
export function alturaMaximaDaLingua(casasW: number, casasH: number): number {
  return ALTURA_DA_LINGUA_DE_UMA_CASA * Math.pow(Math.max(0, Math.min(casasW, casasH)), EXPOENTE_DA_ALTURA)
}

/**
 * As línguas de um fogo de `casasW` x `casasH` casas, de TRÁS para a FRENTE
 * (base mais alta na tela primeiro: a da frente cobre a de trás). As do meio
 * são as mais altas. Sempre as mesmas para a mesma pegada.
 */
export function linguasDoFogo(casasW: number, casasH: number): LinguaDoFogo[] {
  const n = numeroDeLinguas(casasW, casasH)
  const maxima = alturaMaximaDaLingua(casasW, casasH)
  const linguas: LinguaDoFogo[] = []
  for (let i = 0; i < n; i += 1) {
    const r = Math.sqrt((i + 0.5) / n)
    const a = i * ANGULO_DOURADO + 0.6
    linguas.push({
      x: Math.cos(a) * r * casasW * ALCANCE_X,
      y: Math.sin(a) * r * casasH * ALCANCE_Y + casasH * DESCIDA_DA_BASE,
      altura: maxima * (1 - 0.42 * r * r) * (0.88 + 0.24 * sorteio(i, n)),
    })
  }
  return linguas.sort((a, b) => a.y - b.y)
}

/** Os índices das `quantas` línguas mais altas, da mais alta para a mais baixa. */
export function linguasMaisAltas(linguas: readonly LinguaDoFogo[], quantas: number): number[] {
  return linguas
    .map((lingua, i) => ({ altura: lingua.altura, i }))
    .sort((a, b) => b.altura - a.altura)
    .slice(0, Math.max(0, quantas))
    .map((o) => o.i)
}

/** Quantas línguas soltam fagulhas (3 por língua): 1 na Chama, 2 no Fogaréu, 3 no Incêndio. */
export function linguasComFagulha(numero: number): number {
  return Math.min(3, Math.ceil(numero / 4))
}

/** Quantos fios de fumaça: 1, e 2 a partir do Incêndio. */
export function fiosDeFumaca(numero: number): number {
  return numero >= 8 ? 2 : numero > 0 ? 1 : 0
}

/** O disco do brilho no chão, em casas: raios e centro (um pouco abaixo do meio, como as bases). */
export function brilhoDoFogo(casasW: number, casasH: number): { rx: number; ry: number; cy: number } {
  return { rx: 0.62 * casasW + 0.45, ry: 0.62 * casasH + 0.35, cy: casasH * DESCIDA_DA_BASE }
}
