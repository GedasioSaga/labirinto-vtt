/**
 * CUTSCENE EM VÍDEO (14/11/2026): o elo entre a página Cutscenes do livro e a
 * sala aberta, no molde de `ponteDosSons.ts`. A ponte do mestre
 * (`hostBridge.ts`) se registra ao abrir a sala e tira o registro ao fechar; a
 * página só fala com a rede de agora (`null` = sem sala, nada a tocar).
 *
 * MODO TREINO (18/11/2026, pedido do mestre): a ponte de teste da Visão de
 * jogador se registra no lugar `teste`. Com o teste aberto, o teste ganha,
 * mesmo com a sala aberta ao lado (a regra da dança, `dancaNoPainel.ts`): o
 * "Tocar para todos" vai só à janela de teste. Fechar o teste devolve a
 * página à sala.
 */

/** O que a página manda tocar: o vídeo da mídia da mesa e o título que a tela mostra. */
export interface CutsceneParaTocar {
  cutsceneId: string
  video: string
  titulo: string
}

export type ResultadoDoTocar = 'ok' | 'sem-jogador' | 'ja-tocando' | 'invalida'

/** `sala` = a mesa de verdade; `teste` = a janela da Visão de jogador (não conta como exibida). */
export type LugarDaCutscene = 'sala' | 'teste'

export interface RedeDaCutscene {
  /** Abre a exibição: todas as telas (jogadores e TV) baixam o vídeo; toca quando a última ficar pronta. */
  tocar(cutscene: CutsceneParaTocar): ResultadoDoTocar
  /** "Tocar agora": larga com quem já baixou; quem ainda baixa assiste do início quando terminar. */
  tocarAgora(): void
  /** "Parar para todos": o vídeo some de todas as telas. */
  parar(): void
}

const redesRegistradas: Record<LugarDaCutscene, RedeDaCutscene | null> = { sala: null, teste: null }
const ouvintes = new Set<() => void>()

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte()
}

/** A ponte do mestre se registra ao abrir a sala; a função devolvida tira o registro (só se ainda for o dela). */
export function registrarRedeDaCutscene(rede: RedeDaCutscene, lugar: LugarDaCutscene = 'sala'): () => void {
  redesRegistradas[lugar] = rede
  avisar()
  return () => {
    if (redesRegistradas[lugar] !== rede) return
    redesRegistradas[lugar] = null
    avisar()
  }
}

/** A rede para onde o "Tocar para todos" vai agora: a do teste, se aberto; senão a da sala. */
export function redeDaCutscene(): RedeDaCutscene | null {
  return redesRegistradas.teste ?? redesRegistradas.sala
}

/** Onde o "Tocar para todos" toca agora; `null` = nem teste nem sala. */
export function lugarDaRedeDaCutscene(): LugarDaCutscene | null {
  if (redesRegistradas.teste !== null) return 'teste'
  return redesRegistradas.sala !== null ? 'sala' : null
}

/** A rede de um lugar só: o painel de cada exibição para a exibição dele, mesmo com o outro lugar à frente. */
export function redeDaCutsceneEm(lugar: LugarDaCutscene): RedeDaCutscene | null {
  return redesRegistradas[lugar]
}

/** Avisa quando a sala (ou o teste) abre ou fecha. */
export function assinarRedeDaCutscene(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}
