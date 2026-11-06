import type { Personagem } from '../lib/personagem'
import { definirProprio, gravarRpgDaPasta, lerRpgDaPasta, lugarDoMapa, mudarIndiceDasPastas, naFilaDaPasta, rpgDe, type IndiceDasPastas, type RpgDaPasta } from '../lib/pastasDeMapas'
// Ciclo de import com mochilaPendenteNoApp (que usa `editarRpgDaPasta`): os dois lados só chamam dentro de função, nunca ao carregar o módulo.
import { usarOdaPastaNoMapaAberto } from '../net/nuvem/mochilaPendenteNoApp'
import { origemAgora, prepararEmissao, type Emissao, type OrigemDaMudanca } from '../net/nuvem/emissor'
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
 * `adventure.json` dele, os da pasta no `rpg.json` da pasta. "Usar o da
 * pasta" faz a ficha da pasta vencer os bonecos na hora: antes, o que só eles
 * carregam vira pendente (`usarOdaPastaNoMapaAberto`). Lança com a razão.
 */
export async function trocarModoDoMapa(proprio: boolean): Promise<void> {
  const pasta = useAdventureStore.getState().pasta
  if (pasta === null) return
  const gravar = async (): Promise<void> => {
    await mudarIndiceDasPastas((indice) => definirProprio(indice, pasta.chave, proprio))
    // Outro mapa pode ter aberto enquanto o disco gravava: o modo era deste.
    if (useAdventureStore.getState().pasta?.chave === pasta.chave) useAdventureStore.getState().definirProprio(proprio)
  }
  // Só a pasta convertida (o marcador) é dona da mochila: fora dela o espelho não toca os bonecos.
  if (proprio || !pasta.proprio || pasta.mochilaMigrada === undefined) await gravar()
  else await usarOdaPastaNoMapaAberto(pasta.chave, gravar)
}

/**
 * Muda o RPG da pasta NO DISCO (a configuração da pasta, no Carregar Mapa) e
 * aplica a mesma mudança à cópia aberta, quando o mapa aberto é dessa pasta.
 * `mudar` recebe o que está no disco: o HP mexido na mesa e ainda não salvo
 * não vai junto — continua pendente na cópia aberta, com a mudança nova.
 * Devolve o RPG gravado. Lança com a razão.
 *
 * LOBBY (funil 2 do emissor, §5.1): numa pasta publicada, a mudança vira ops
 * — o Mundo do Livro, a página Itens e o Carregar Mapa passam por aqui mesmo
 * com a pasta fechada. Com a pasta FECHADA, as ops saem do lido e do novo.
 * Com ela ABERTA, saem da cópia aberta antes e depois de `mudarRpgDaPasta`
 * (que não emite): é ela que o Salvar do mapa grava depois, e a mudança da
 * mesa ainda não salva já saiu como op — o `mudar` que troca a ficha inteira
 * a desfaz na cópia, e a nuvem tem de ver isso. A que o Lobby recusaria lança
 * antes de gravar.
 */
export async function editarRpgDaPasta(pastaId: string, mudar: (rpg: RpgDaPasta) => RpgDaPasta): Promise<RpgDaPasta> {
  // Antes do primeiro `await`: quem chamou dentro de `comAutor`/`comBase` perde o contexto depois dele.
  const origem = origemAgora()
  // Ler, mudar, gravar e entregar as ops numa vez só da fila da pasta (§5.6): o gravador leve do Lobby não grava a mudança remota entre a leitura e a gravação para ela sumir por baixo desta.
  return naFilaDaPasta(pastaId, async (vez) => {
    const lido = await lerRpgDaPasta(pastaId)
    if (!lido.ok) throw new Error(lido.motivo)
    const novo = mudar(lido.rpg)
    const previa = previaDaEmissao(pastaId, lido.rpg, novo, mudar, origem)
    if (!previa.ok) throw new Error(previa.motivo)
    await gravarRpgDaPasta(pastaId, novo, vez)
    const antesNaCopia = personagensAbertos(pastaId)
    useAdventureStore.getState().mudarRpgDaPasta(pastaId, mudar)
    const depoisNaCopia = personagensAbertos(pastaId)
    // De novo, sobre a cópia como ficou depois do `await` (a mesa pode ter mudado nele): são estas as ops que saem.
    const emissao =
      antesNaCopia === null || depoisNaCopia === null
        ? prepararEmissao(pastaId, lido.rpg.personagens, novo.personagens, origem)
        : prepararEmissao(pastaId, antesNaCopia, depoisNaCopia, origem)
    if (emissao.ok) emissao.entregar()
    // A prévia passou, mas a mesa mudou a ficha durante a gravação: já está no disco e na cópia, então o aviso diz isso.
    else useToastStore.getState().push('error', `O Lobby não aceita esta mudança (${emissao.problema}). Ela ficou só neste computador.`)
    return novo
  })
}

/** Os personagens da cópia desta pasta aberta no editor; `null` = a pasta não está aberta. */
function personagensAbertos(pastaId: string): readonly Personagem[] | null {
  const { pasta } = useAdventureStore.getState()
  return pasta !== null && pasta.pastaId === pastaId ? pasta.personagens : null
}

/** As ops que `editarRpgDaPasta` vai emitir, conferidas antes de gravar: as da cópia aberta, ou as do disco com a pasta fechada. */
function previaDaEmissao(pastaId: string, lido: RpgDaPasta, novo: RpgDaPasta, mudar: (rpg: RpgDaPasta) => RpgDaPasta, origem: OrigemDaMudanca): Emissao {
  const { pasta } = useAdventureStore.getState()
  if (pasta === null || pasta.pastaId !== pastaId) return prepararEmissao(pastaId, lido.personagens, novo.personagens, origem)
  return prepararEmissao(pastaId, pasta.personagens, mudar(rpgDe(pasta)).personagens, origem)
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
