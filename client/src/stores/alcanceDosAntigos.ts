import { isTauri } from '@tauri-apps/api/core'
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import { guardarAcervoAntesDoAlcance } from '../lib/acervoDeItens'
import { ARQUIVO_DAS_PROPOSTAS, antigosSemAlcance, comOsAlcances, propostasDoArquivo, SEM_ARQUIVO, semOsAlcances, type AlcancesGravados, type AntesDoAlcance, type DadosDosAntigos, type EscolhaDoAlcance, type ListaDosAntigos, type PropostasDoArquivo } from '../lib/batalha/alcance/antigos'
import type { ItemDoCatalogo } from '../lib/livros/catalogo'
import { guardarCatalogoAntesDoAlcance } from '../lib/livros/catalogoNoDisco'
import { fichasComARegraDaArma } from '../lib/livros/regraDaArma'
import { fichaComOEfeitoDoItem } from '../lib/mochila/efeitoNasCopias'
import { guardarRpgAntesDoAlcance } from '../lib/pastasDeMapas'
import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { useAcervoDeItensStore } from './acervoDeItensStore'
import { useCatalogoStore } from './catalogoStore'
import { useMundoDoLivroStore } from './mundoDoLivroStore'

/**
 * "DAR ALCANCE AOS ANTIGOS" no disco (fase G, docs/design/habilidades/ALCANCE.md §9): o
 * catálogo do livro aberto e as fichas da pasta aberta. A lógica é pura
 * (`lib/batalha/alcance/antigos.ts`); aqui só a ordem, a mesma do "Juntar as armas":
 *
 *   cópias de antes (`.antes-do-alcance` do catálogo, do `rpg.json` e do `itens.json`, uma vez;
 *   sem elas nada se grava) -> catálogo -> fichas (`mundo.mudar`, com as cópias das armas ligadas
 *   seguindo o livro, e a categoria das vagas do item que era Arma e vira Consumível) -> Acervo
 *   (o "O que ele faz" dos itens; o efeito das cópias nas mochilas segue pelo caminho de sempre,
 *   `itensNaFonte.ts`)
 *
 * O arquivo da proposta (`alcances-propostos.json`, na pasta de dados do app) só se lê, nunca
 * se grava daqui. Nada é decidido sozinho: só grava o que o mestre deixou marcado no Confirmar.
 */

const SEM_CATALOGO = 'O catálogo deste livro não foi lido do disco; nada foi gravado.'

/** O catálogo e as fichas de agora. Lança se o catálogo não foi lido (gravar seria por cima do que não se viu); sem pasta aberta, só o livro. */
function dadosDeAgora(sistema: SistemaDeRpg): DadosDosAntigos {
  const catalogo = useCatalogoStore.getState()
  if (catalogo.sistemaId !== sistema.id || !catalogo.podeGravar) throw new Error(SEM_CATALOGO)
  const { aberto, daPasta } = useMundoDoLivroStore.getState()
  const comPasta = aberto !== null && daPasta !== null
  // O Acervo que não foi lido do disco não entra: gravar seria por cima do que não se viu.
  const acervo = useAcervoDeItensStore.getState()
  return {
    sistema,
    catalogo: catalogo.itens,
    acervo: acervo.podeGravar ? acervo.itens : [],
    pastasDoAcervo: acervo.podeGravar ? acervo.pastas : [],
    pastaId: comPasta ? aberto.pastaId : null,
    personagens: comPasta ? daPasta : [],
  }
}

export interface PropostasLidas extends PropostasDoArquivo {
  /** Por que não veio proposta nenhuma (sem arquivo, torto); `null` = lido. */
  aviso: string | null
}

/** Lê `alcances-propostos.json` da pasta de dados do app. Nunca lança: a falha vira aviso e a lista segue sem propostas. */
export async function lerPropostasDoAlcance(): Promise<PropostasLidas> {
  if (!isTauri()) return { ...SEM_ARQUIVO, aviso: 'Fora do aplicativo do PC não há proposta para ler.' }
  try {
    const caminho = await join(await appDataDir(), ARQUIVO_DAS_PROPOSTAS)
    if (!(await exists(caminho))) return { ...SEM_ARQUIVO, aviso: `Sem ${ARQUIVO_DAS_PROPOSTAS} na pasta do app: cada linha começa sem proposta.` }
    const valor: unknown = JSON.parse(await readTextFile(caminho))
    return { ...propostasDoArquivo(valor), aviso: null }
  } catch (erro) {
    return { ...SEM_ARQUIVO, aviso: `Não deu para ler ${ARQUIVO_DAS_PROPOSTAS}: ${erro instanceof Error ? erro.message : String(erro)}` }
  }
}

/** O ENSAIO: quem está sem alcance agora, sem gravar nada (o item, pelo modelo do arquivo ou do "Sugerir efeito"). Lança como `dadosDeAgora`. */
export function ensaiarAlcanceDosAntigos(sistema: SistemaDeRpg, doArquivo: PropostasDoArquivo = SEM_ARQUIVO): ListaDosAntigos & { dados: DadosDosAntigos } {
  const dados = dadosDeAgora(sistema)
  return { ...antigosSemAlcance(dados, doArquivo), dados }
}

/** As cópias ligadas das armas do livro que mudaram passam a dizer o que a entrada diz. */
function comAsCopiasDasArmas(personagens: Personagem[], catalogo: readonly ItemDoCatalogo[], armas: readonly string[], sistema: SistemaDeRpg): Personagem[] {
  const entradas = catalogo.filter((entrada) => armas.includes(entrada.id))
  return entradas.reduce((atuais, entrada) => fichasComARegraDaArma(atuais, entrada, sistema), personagens)
}

/** Grava o que `mudar` montou: as cópias de antes primeiro, todas; se uma falhar, nada foi gravado. */
async function gravar(sistema: SistemaDeRpg, dados: DadosDosAntigos, feito: AlcancesGravados, mudar: (sobre: DadosDosAntigos) => AlcancesGravados): Promise<void> {
  const livroMuda = feito.catalogo.some((entrada, indice) => entrada !== dados.catalogo[indice])
  const fichas = comAsCopiasDasArmas(feito.personagens, feito.catalogo, feito.armasDoLivro, sistema)
  const fichasMudam = dados.pastaId !== null && fichas.some((personagem, indice) => personagem !== dados.personagens[indice])
  const itensQueMudam = feito.acervo.filter((item, indice) => item !== dados.acervo[indice])
  // A vaga da mochila dada de um item que muda segue o Acervo logo depois: a cópia de antes do rpg.json vem antes dela.
  const copiasMudam = dados.pastaId !== null && dados.personagens.some((personagem) => itensQueMudam.some((item) => fichaComOEfeitoDoItem(personagem, item) !== personagem))
  if (livroMuda) await guardarCatalogoAntesDoAlcance(sistema.id)
  if ((fichasMudam || copiasMudam) && dados.pastaId !== null) await guardarRpgAntesDoAlcance(dados.pastaId)
  if (itensQueMudam.length > 0) await guardarAcervoAntesDoAlcance()
  if (livroMuda) await useCatalogoStore.getState().gravarAlcances(feito.catalogo)
  if (fichasMudam) {
    // A mesma conta de novo sobre as fichas do disco (outra janela pode ter salvo no meio).
    await useMundoDoLivroStore.getState().mudar((personagens) => {
      const sobreODisco = mudar({ ...dados, catalogo: feito.catalogo, personagens })
      return comAsCopiasDasArmas(sobreODisco.personagens, feito.catalogo, feito.armasDoLivro, sistema)
    })
  }
  // Por último: a gravação do Acervo leva as cópias das mochilas (itensNaFonte), já com as fichas acima no disco.
  if (itensQueMudam.length > 0) await useAcervoDeItensStore.getState().trocarItens(itensQueMudam)
}

/**
 * O CONFIRMAR: grava cada escolha no lugar certo (a mecânica montada no alvo dela; o resto no
 * campo `alcance`). Devolve o que cada um tinha antes, para o Desfazer (vazio = nada gravado).
 * Lança com a frase pronta.
 */
export async function confirmarAlcanceDosAntigos(sistema: SistemaDeRpg, escolhas: readonly EscolhaDoAlcance[]): Promise<AntesDoAlcance[]> {
  const dados = dadosDeAgora(sistema)
  const feito = comOsAlcances(dados, escolhas)
  if (feito.antes.length === 0) return []
  await gravar(sistema, dados, feito, (sobre) => comOsAlcances(sobre, escolhas))
  return feito.antes
}

/** O DESFAZER do Confirmar: cada um volta ao que era. Devolve quantos voltaram. Lança com a frase pronta. */
export async function desfazerAlcanceDosAntigos(sistema: SistemaDeRpg, antes: readonly AntesDoAlcance[]): Promise<number> {
  const dados = dadosDeAgora(sistema)
  const feito = semOsAlcances(dados, antes)
  if (feito.antes.length === 0) return 0
  await gravar(sistema, dados, feito, (sobre) => semOsAlcances(sobre, antes))
  return feito.antes.length
}
