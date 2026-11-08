import { ehRegistro } from '../molde'
import { ARQUIVO_DO_VERBETE, type Verbete } from '../tipos'
import { compararCaminhos, hashDoTexto } from './cofre'

/**
 * A REGRA DA REIMPORTAÇÃO (decisão do mestre, 08/11; plano §4 passo 7 e
 * "Depois do conselho"):
 * - o que o mestre EDITOU no Prelúdio fica como está, e entra na lista
 *   ("mudou no Grimório também", quando o Grimório também mudou);
 * - o resto é atualizado com o que veio do Grimório;
 * - nada de juntar versões: o verbete inteiro fica ou é trocado;
 * - nada some do Prelúdio porque sumiu do Grimório: vai para "sumiu lá".
 *
 * "Editado" = o verbete de hoje não bate com o hash guardado na importação
 * (`origem.grimorio.hash`). O hash cobre o conteúdo inteiro do verbete como vai
 * para o disco, menos `origem` (onde mora o próprio hash) e `formato`.
 */

/** Chaves em ordem fixa, para o mesmo conteúdo dar o mesmo texto. */
function canonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonico)
  if (!ehRegistro(valor)) return valor
  const chaves = Object.keys(valor).sort(compararCaminhos)
  return Object.fromEntries(chaves.filter((chave) => valor[chave] !== undefined).map((chave) => [chave, canonico(valor[chave])]))
}

export async function hashDoVerbete(verbete: Verbete): Promise<string> {
  const noDisco = ARQUIVO_DO_VERBETE.molde.gravar(verbete)
  const conteudo: Record<string, unknown> = ehRegistro(noDisco) ? { ...noDisco } : {}
  delete conteudo.origem
  delete conteudo.formato
  return hashDoTexto(JSON.stringify(canonico(conteudo)))
}

/** Grava no verbete importado o hash dele mesmo: a marca de "não mexido desde a importação". */
export async function comHashDaImportacao(verbete: Verbete): Promise<Verbete> {
  const grimorio = verbete.origem?.grimorio
  if (grimorio === undefined) return verbete
  const hash = await hashDoVerbete(verbete)
  return { ...verbete, origem: { ...verbete.origem, grimorio: { ...grimorio, hash } } }
}

export interface EditadoNoPreludio {
  readonly id: string
  readonly titulo: string
  /** O Grimório também mudou desde a última importação: o mestre decide à mão. */
  readonly mudouNoGrimorioTambem: boolean
}

export interface PlanoDeReimportacao {
  /** Não existem no Prelúdio: entram. */
  readonly novos: readonly string[]
  /** Ninguém mexeu no Prelúdio e o Grimório mudou: são trocados inteiros. */
  readonly atualizar: readonly string[]
  /** Iguais dos dois lados: nada a fazer. */
  readonly iguais: readonly string[]
  /** Editados no Prelúdio: ficam como estão. */
  readonly editadosNoPreludio: readonly EditadoNoPreludio[]
  /** Vieram do Grimório e não estão mais lá: ficam no Prelúdio. */
  readonly sumiuLa: readonly { id: string; titulo: string }[]
}

/**
 * Compara o que já está no Prelúdio com a importação nova. Os `novos` devem
 * vir de `comHashDaImportacao`. Verbete criado no próprio Prelúdio (sem
 * `origem.grimorio`) não entra em lista nenhuma: a importação não o toca.
 */
export async function planejarReimportacao(existentes: readonly Verbete[], novos: readonly Verbete[]): Promise<PlanoDeReimportacao> {
  const doGrimorio = new Map(existentes.filter((verbete) => verbete.origem?.grimorio !== undefined).map((verbete) => [verbete.id, verbete]))
  const entram: string[] = []
  const atualizar: string[] = []
  const iguais: string[] = []
  const editadosNoPreludio: EditadoNoPreludio[] = []
  const vistos = new Set<string>()
  for (const novo of novos) {
    vistos.add(novo.id)
    const atual = doGrimorio.get(novo.id)
    if (atual === undefined) {
      entram.push(novo.id)
      continue
    }
    const guardado = atual.origem?.grimorio?.hash
    const hashNovo = novo.origem?.grimorio?.hash ?? (await hashDoVerbete(novo))
    // Sem hash guardado não dá para provar que ninguém mexeu: fica, como se editado.
    const editado = guardado === undefined || (await hashDoVerbete(atual)) !== guardado
    if (editado) editadosNoPreludio.push({ id: atual.id, titulo: atual.titulo, mudouNoGrimorioTambem: hashNovo !== guardado })
    else if (hashNovo !== guardado) atualizar.push(novo.id)
    else iguais.push(novo.id)
  }
  const sumiuLa = [...doGrimorio.values()].filter((atual) => !vistos.has(atual.id)).map((atual) => ({ id: atual.id, titulo: atual.titulo }))
  return { novos: entram, atualizar, iguais, editadosNoPreludio, sumiuLa }
}
