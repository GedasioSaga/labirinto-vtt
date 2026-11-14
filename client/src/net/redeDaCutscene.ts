/**
 * CUTSCENE EM VÍDEO (14/11/2026): o elo entre a página Cutscenes do livro e a
 * sala aberta, no molde de `ponteDosSons.ts`. A ponte do mestre
 * (`hostBridge.ts`) se registra ao abrir a sala e tira o registro ao fechar; a
 * página só fala com a rede de agora (`null` = sem sala, nada a tocar).
 */

/** O que a página manda tocar: o vídeo da mídia da mesa e o título que a tela mostra. */
export interface CutsceneParaTocar {
  cutsceneId: string
  video: string
  titulo: string
}

export type ResultadoDoTocar = 'ok' | 'sem-jogador' | 'ja-tocando' | 'invalida'

export interface RedeDaCutscene {
  /** Abre a exibição: todas as telas (jogadores e TV) baixam o vídeo; toca quando a última ficar pronta. */
  tocar(cutscene: CutsceneParaTocar): ResultadoDoTocar
  /** "Tocar agora": larga com quem já baixou; quem ainda baixa assiste do início quando terminar. */
  tocarAgora(): void
  /** "Parar para todos": o vídeo some de todas as telas. */
  parar(): void
}

let redeRegistrada: RedeDaCutscene | null = null
const ouvintes = new Set<() => void>()

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte()
}

/** A ponte do mestre se registra ao abrir a sala; a função devolvida tira o registro (só se ainda for o dela). */
export function registrarRedeDaCutscene(rede: RedeDaCutscene): () => void {
  redeRegistrada = rede
  avisar()
  return () => {
    if (redeRegistrada !== rede) return
    redeRegistrada = null
    avisar()
  }
}

export function redeDaCutscene(): RedeDaCutscene | null {
  return redeRegistrada
}

/** Avisa quando a sala abre ou fecha. */
export function assinarRedeDaCutscene(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}
