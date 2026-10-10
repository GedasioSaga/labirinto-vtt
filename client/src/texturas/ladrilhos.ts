/**
 * LADRILHO de uma textura: os pixels (RGBA) do quadrado que se repete no mapa,
 * tirados da função de cor (`DefinicaoDeTextura.cor`). Puro, sem canvas: o
 * teste mede o ladrilho de verdade, e a tela (`pixi/drawTexturas.ts`) só põe
 * estes bytes numa textura.
 *
 * Lado em potência de 2: a placa de vídeo repete e reduz (mipmap) o ladrilho
 * sozinha, sem emenda nem cintilação quando o mapa é afastado.
 */

/** Lado do ladrilho no mapa. 256 px dão a copa e o grão com folga no zoom de continente, e saem rápido. */
export const LADO_DO_LADRILHO = 256

/** Lado da miniatura do painel (o dobro do tamanho na tela, para a tela densa). */
export const LADO_DA_MINIATURA = 96

/** Quanto o gerador roda de uma vez antes de dar a vez ao navegador (metade de um quadro a 60 Hz). */
export const FATIA_DO_LADRILHO_MS = 8

export type CorDaTextura = (u: number, v: number) => number

/**
 * Pinta as linhas [linha0, linha1) do ladrilho em `dados`. `amostras` por
 * lado (1 ou 2): a miniatura tira a média de 2×2 por pixel para a borda da
 * copa não serrilhar no tamanho pequeno. Cor estranha (não número) vira preto.
 */
function pintarLinhas(cor: CorDaTextura, lado: number, amostras: number, dados: Uint8ClampedArray, linha0: number, linha1: number): void {
  const passo = 1 / (lado * amostras)
  const n = amostras * amostras
  for (let y = linha0; y < linha1; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < amostras; sy += 1) {
        for (let sx = 0; sx < amostras; sx += 1) {
          const c = cor((x * amostras + sx + 0.5) * passo, (y * amostras + sy + 0.5) * passo)
          const k = Number.isFinite(c) ? c : 0
          r += (k >> 16) & 255
          g += (k >> 8) & 255
          b += k & 255
        }
      }
      const i = (y * lado + x) * 4
      dados[i] = r / n
      dados[i + 1] = g / n
      dados[i + 2] = b / n
      dados[i + 3] = 255
    }
  }
}

/** O ladrilho inteiro de uma vez (teste e miniatura). */
export function pixelsDoLadrilho(cor: CorDaTextura, lado: number, amostras = 1): Uint8ClampedArray {
  const dados = new Uint8ClampedArray(lado * lado * 4)
  pintarLinhas(cor, lado, amostras, dados, 0, lado)
  return dados
}

function ceder(): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, 0))
}

/**
 * O ladrilho em fatias de `fatiaMs`, dando a vez ao navegador entre elas: a
 * floresta custa dezenas de ms, e nenhuma tarefa trava a tela. `null` =
 * cancelado no meio (cena trocada, palco desmontado) ou a cor de fora lançou.
 */
export async function pixelsEmFatias(
  cor: CorDaTextura,
  lado: number,
  cancelado: () => boolean,
  fatiaMs = FATIA_DO_LADRILHO_MS,
  amostras = 1,
): Promise<Uint8ClampedArray | null> {
  const dados = new Uint8ClampedArray(lado * lado * 4)
  let linha = 0
  while (linha < lado) {
    const inicio = performance.now()
    try {
      // Ao menos uma linha por fatia: com fatia curtíssima o ladrilho ainda anda.
      do {
        pintarLinhas(cor, lado, amostras, dados, linha, linha + 1)
        linha += 1
      } while (linha < lado && performance.now() - inicio < fatiaMs)
    } catch {
      // A cor de uma textura de fora quebrou: ela fica de fora, as outras seguem.
      return null
    }
    if (linha < lado) {
      await ceder()
      if (cancelado()) return null
    }
  }
  return dados
}
