import { imagensEmbutidas } from '../lib/imagensDaFicha'
import type { Personagem } from '../lib/personagem'
import { personagensAtivos, useAdventureStore } from './adventureStore'

/**
 * RETRATO COMO MÍDIA (entrega 4): a imagem embutida (`data:image/...`) da
 * ficha de personagem vira referência de mídia (`midia:<id>`, `lib/midia.ts`).
 *
 * Por quê: o host reenvia a ficha INTEIRA ao jogador a cada mudança dela
 * (`personagens`, `net/hostSession.ts`) — cada −/+ do mestre levava junto o
 * retrato de até 48 mil caracteres e a imagem de cada cartão. Com a
 * referência, a ficha vai sem imagem nenhuma e o jogador busca cada uma UMA
 * vez por URL da sala, com cache.
 *
 * Um caminho só para TODA imagem que chega à aventura: a ficha de antes
 * aberta do disco, o retrato escolhido pelo mestre, o que o jogador mandou
 * (`personagem.imagem`), o importado do projeto-rpg-v2. Cada um grava a
 * embutida como sempre; este observador da aventura a grava no disco de mídia
 * e troca, no lugar, só as cópias IGUAIS que ainda estão lá — o que mudou
 * enquanto gravava não é desfeito.
 *
 * Fora do aplicativo (sem disco) ou com o disco recusando, a embutida fica
 * como estava: a ficha continua certa, só mais pesada, e a mesma imagem não é
 * tentada de novo nesta sessão. A janela da Visão de jogador não passa por
 * aqui: o que ela grava fica na camada de teste, nunca na aventura.
 */

/** Grava a embutida e devolve a referência; `null` = não deu (fica a embutida). */
export type GuardarImagem = (dataUrl: string) => Promise<string | null>

/**
 * Liga o observador e devolve o desligar. `guardar` grava no disco do mestre
 * (`guardarDataUrl`); o teste passa um de mentira.
 */
export function iniciarMidiaDosPersonagens(guardar: GuardarImagem): () => void {
  /** Já tentadas nesta sessão (deram certo ou não): nenhuma volta à fila a cada mudança da aventura. */
  const tentadas = new Set<string>()
  let ligado = true

  const migrar = async (pendentes: readonly string[]): Promise<void> => {
    const trocas = new Map<string, string>()
    for (const dataUrl of pendentes) {
      try {
        const ref = await guardar(dataUrl)
        if (ref !== null) trocas.set(dataUrl, ref)
      } catch {
        // Disco recusou: a embutida fica, e a ficha continua certa.
      }
    }
    if (ligado && trocas.size > 0) useAdventureStore.getState().trocarImagensDosPersonagens(trocas)
  }

  const olhar = (personagens: readonly Personagem[] | undefined): void => {
    if (personagens === undefined) return
    const pendentes = imagensEmbutidas(personagens).filter((dataUrl) => !tentadas.has(dataUrl))
    if (pendentes.length === 0) return
    for (const dataUrl of pendentes) tentadas.add(dataUrl)
    void migrar(pendentes)
  }

  // A lista EM USO: a da pasta de mapas quando o mapa herda dela (`personagensAtivos`).
  olhar(personagensAtivos(useAdventureStore.getState()))
  const parar = useAdventureStore.subscribe((state, previous) => {
    const agora = personagensAtivos(state)
    if (agora !== personagensAtivos(previous)) olhar(agora)
  })
  return () => {
    ligado = false
    parar()
  }
}
