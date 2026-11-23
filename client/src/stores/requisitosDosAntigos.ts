import { isTauri } from '@tauri-apps/api/core'
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import { antigosComProposta, ARQUIVO_DAS_PROPOSTAS, comOsRequisitos, propostasDoArquivo, SEM_ARQUIVO, semOsRequisitos, type AntesDosRequisitos, type DadosDosAntigos, type EscolhaDosRequisitos, type ListaDosAntigos, type PropostasDoArquivo, type RequisitosGravados } from '../lib/batalha/requisitos/antigos'
import { guardarRpgAntesDosRequisitos } from '../lib/pastasDeMapas'
import { useMundoDoLivroStore } from './mundoDoLivroStore'

/**
 * "DAR REQUISITOS AOS ANTIGOS" no disco (fase H, docs/design/habilidades/REQUISITOS.md §11): as
 * fichas da pasta aberta. A lógica é pura (`lib/batalha/requisitos/antigos.ts`); aqui só a ordem, a
 * mesma do "Dar alcance aos antigos":
 *
 *   cópia de antes (`rpg.json.antes-dos-requisitos`, uma vez; sem ela nada se grava) -> fichas
 *   (`mundo.mudar`, a mesma conta de novo sobre o que está no disco)
 *
 * Só o `rpg.json` muda: nenhuma proposta é de entrada do livro nem de item do Acervo. O arquivo da
 * proposta (`requisitos-propostos.json`, na pasta de dados do app) só se lê, nunca se grava daqui.
 * Nada é decidido sozinho: só grava o que o mestre deixou marcado no Confirmar.
 */

const SEM_PASTA = 'Abra uma pasta de fichas: os requisitos propostos são dos cartões das fichas dela.'

/** As fichas de agora. Lança sem pasta aberta (não há onde gravar). */
function dadosDeAgora(): DadosDosAntigos & { pastaId: string } {
  const { aberto, daPasta } = useMundoDoLivroStore.getState()
  if (aberto === null || daPasta === null) throw new Error(SEM_PASTA)
  return { pastaId: aberto.pastaId, personagens: daPasta }
}

export interface PropostasLidas extends PropostasDoArquivo {
  /** Por que não veio proposta nenhuma (sem arquivo, torto); `null` = lido. */
  aviso: string | null
}

/** Lê `requisitos-propostos.json` da pasta de dados do app. Nunca lança: a falha vira aviso e a lista fica vazia. */
export async function lerPropostasDosRequisitos(): Promise<PropostasLidas> {
  if (!isTauri()) return { ...SEM_ARQUIVO, aviso: 'Fora do aplicativo do PC não há proposta para ler.' }
  try {
    const caminho = await join(await appDataDir(), ARQUIVO_DAS_PROPOSTAS)
    if (!(await exists(caminho))) return { ...SEM_ARQUIVO, aviso: `Sem ${ARQUIVO_DAS_PROPOSTAS} na pasta do app: nada a propor.` }
    const valor: unknown = JSON.parse(await readTextFile(caminho))
    return { ...propostasDoArquivo(valor), aviso: null }
  } catch (erro) {
    return { ...SEM_ARQUIVO, aviso: `Não deu para ler ${ARQUIVO_DAS_PROPOSTAS}: ${erro instanceof Error ? erro.message : String(erro)}` }
  }
}

/** O ENSAIO: os cartões com proposta que ainda faltam, sem gravar nada. Lança como `dadosDeAgora`. */
export function ensaiarRequisitosDosAntigos(doArquivo: PropostasDoArquivo = SEM_ARQUIVO): ListaDosAntigos & { dados: DadosDosAntigos } {
  const dados = dadosDeAgora()
  return { ...antigosComProposta(dados, doArquivo), dados }
}

/** Grava o que `mudar` montou: a cópia de antes primeiro; se ela falhar, nada foi gravado. */
async function gravar(dados: DadosDosAntigos & { pastaId: string }, mudar: (sobre: DadosDosAntigos) => RequisitosGravados): Promise<void> {
  await guardarRpgAntesDosRequisitos(dados.pastaId)
  // A mesma conta de novo sobre as fichas do disco (outra janela pode ter salvo no meio).
  await useMundoDoLivroStore.getState().mudar((personagens) => mudar({ pastaId: dados.pastaId, personagens }).personagens)
}

/**
 * O CONFIRMAR: grava cada escolha no seu cartão (só as partes que ele ainda não tem). Devolve o que
 * cada um ganhou, para o Desfazer (vazio = nada gravado). Lança com a frase pronta.
 */
export async function confirmarRequisitosDosAntigos(escolhas: readonly EscolhaDosRequisitos[]): Promise<AntesDosRequisitos[]> {
  const dados = dadosDeAgora()
  const feito = comOsRequisitos(dados, escolhas)
  if (feito.antes.length === 0) return []
  await gravar(dados, (sobre) => comOsRequisitos(sobre, escolhas))
  return feito.antes
}

/** O DESFAZER do Confirmar: cada cartão perde o que ganhou (se o mestre não mexeu depois). Devolve quantos voltaram. Lança com a frase pronta. */
export async function desfazerRequisitosDosAntigos(antes: readonly AntesDosRequisitos[]): Promise<number> {
  const dados = dadosDeAgora()
  const feito = semOsRequisitos(dados, antes)
  if (feito.antes.length === 0) return 0
  await gravar(dados, (sobre) => semOsRequisitos(sobre, antes))
  return feito.antes.length
}
