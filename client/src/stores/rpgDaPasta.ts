import { definirProprio, gravarRpgDaPasta, lerRpgDaPasta, lugarDoMapa, mudarIndiceDasPastas, type IndiceDasPastas, type RpgDaPasta } from '../lib/pastasDeMapas'
import { useAdventureStore } from './adventureStore'
import { useToastStore } from './toastStore'

/**
 * PASTAS DE MAPAS: a ponte entre o disco das pastas (`lib/pastasDeMapas.ts`)
 * e a cópia que o editor usa (`useAdventureStore().pasta`). Toda mudança que
 * a tela faz no disco passa por aqui para o mapa aberto acompanhar — senão a
 * próxima gravação da mesa escreveria por cima a versão de antes.
 */

/**
 * "Configurar só neste mapa" (`true`) e "Usar o da pasta" (`false`) do mapa
 * aberto: grava o modo no índice e só então troca o que o editor usa. Nenhuma
 * lista é apagada nem copiada — os personagens do mapa continuam no
 * `adventure.json` dele, os da pasta no `rpg.json` da pasta. Lança com a razão.
 */
export async function trocarModoDoMapa(proprio: boolean): Promise<void> {
  const pasta = useAdventureStore.getState().pasta
  if (pasta === null) return
  await mudarIndiceDasPastas((indice) => definirProprio(indice, pasta.chave, proprio))
  // Outro mapa pode ter aberto enquanto o disco gravava: o modo era deste.
  if (useAdventureStore.getState().pasta?.chave === pasta.chave) useAdventureStore.getState().definirProprio(proprio)
}

/**
 * Muda o RPG da pasta NO DISCO (a configuração da pasta, no Carregar Mapa) e
 * aplica a mesma mudança à cópia aberta, quando o mapa aberto é dessa pasta.
 * `mudar` recebe o que está no disco: o HP mexido na mesa e ainda não salvo
 * não vai junto — continua pendente na cópia aberta, com a mudança nova.
 * Devolve o RPG gravado. Lança com a razão.
 */
export async function editarRpgDaPasta(pastaId: string, mudar: (rpg: RpgDaPasta) => RpgDaPasta): Promise<RpgDaPasta> {
  const lido = await lerRpgDaPasta(pastaId)
  if (!lido.ok) throw new Error(lido.motivo)
  const novo = mudar(lido.rpg)
  await gravarRpgDaPasta(pastaId, novo)
  useAdventureStore.getState().mudarRpgDaPasta(pastaId, mudar)
  return novo
}

/**
 * Depois de o Carregar Mapa mudar o índice: o mapa aberto acompanha o nome e
 * o modo da pasta dele, ou deixa de herdar se saiu dela (ou ela foi apagada).
 * A cópia da pasta com mudança pendente é gravada ANTES de ser solta.
 * Entrar numa pasta vale da próxima vez que o mapa abrir.
 */
export async function acompanharIndice(indice: IndiceDasPastas): Promise<void> {
  const { pasta, pastaSuja } = useAdventureStore.getState()
  if (pasta === null) return
  const lugar = lugarDoMapa(indice, pasta.chave)
  if ((lugar === null || lugar.pasta.id !== pasta.pastaId) && pastaSuja) await gravarPastaDoMapa()
  useAdventureStore.getState().acertarPasta(lugar === null ? null : { pastaId: lugar.pasta.id, nome: lugar.pasta.nome, proprio: lugar.proprio })
}

/**
 * O "Salvar" do mapa grava também a cópia da pasta. Nunca lança: o mapa já
 * foi gravado, então a falha da pasta vira aviso próprio (e não "não foi
 * possível salvar o mapa"), e a mudança continua pendente para a próxima vez.
 */
export async function gravarPastaDoMapa(): Promise<void> {
  try {
    await useAdventureStore.getState().gravarPasta()
  } catch (erro) {
    useToastStore.getState().push('error', erro instanceof Error ? erro.message : String(erro))
  }
}
