import { FEATURES, type FeatureFlags } from '../../features'
import { LUGARES, lerDoPreparo, lerIndiceDoPreparo, lerVerbete, listarNoPreparo, pastaDoPreparo, type DocumentoLido } from '../disco'
import { ARQUIVO_DAS_LIGACOES, ARQUIVO_DOS_VINDOS, ARQUIVO_DO_QUADRO, type IndiceDoPreparo, type Ligacoes, type VindosDoGrimorio } from '../tipos'
import { hashDoTexto } from './cofre'
import { midiasNoPreludio } from './copiarArquivos'
import type { ApagadosNoPreludio, NoPreludio, QuadroComId } from './reimportar'

/**
 * O PRELÚDIO COMO ESTÁ AGORA (plano §4, passo 7): o que a simulação compara com
 * o Grimório na reimportação, e o que o "Aplicar" confere de novo antes de gravar.
 *
 * - Lê o índice, as ligações, todos os verbetes e quadros e o registro do que
 *   veio do Grimório (`importacoes/vindos-do-grimorio.json`).
 * - "Apagado no Prelúdio" = uma importação aplicada gravou e não está mais lá.
 * - Arquivo que esta versão não abre para editar (formato mais novo, danificado
 *   sem cópia, nome diferente do id) trava a importação: ela poderia gravar por
 *   cima de algo que não entende.
 * - A `impressao` resume tudo o que foi lido: o "Aplicar" lê de novo e recusa
 *   se o Prelúdio mudou desde a simulação.
 * - Lista também as imagens de `midia/`, que ficam fora da `impressao`: imagem a
 *   mais ou a menos não invalida o plano (o "Aplicar" só copia a que falta), mas
 *   muda o espaço, e o "Aplicar" conta de novo na hora.
 */

export interface FotoDoPreludio {
  readonly noPreludio: NoPreludio
  /** Nada no Prelúdio nem registro de importação: a simulação roda como primeira importação. */
  readonly vazio: boolean
  /** O registro das importações anteriores; `null` = nenhuma aplicada ainda. */
  readonly vindos: VindosDoGrimorio | null
  /**
   * `preparo.json` e `ligacoes.json` inteiros, como estão (`null` = ainda não
   * existem). O "Aplicar" troca só a lista: o resto do arquivo (chave que esta
   * versão não conhece, em `extras`, ou campo que outra fatia acrescentar) volta igual.
   */
  readonly indice: IndiceDoPreparo | null
  readonly ligacoes: Ligacoes | null
  /** As imagens que já estão em `midia/` (`midia/<sha256>.<ext>`): não são copiadas de novo, então não contam no espaço. */
  readonly midias: ReadonlySet<string>
  readonly impressao: string
}

export type LeituraDoPreludio = { readonly ok: true; readonly foto: FotoDoPreludio } | { readonly ok: false; readonly problemas: readonly string[] }

function motivoDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** O valor de um arquivo lido; o que não abre para editar vira problema. */
function valorOuProblema<T>(documento: DocumentoLido<T>, problemas: string[]): T | null {
  switch (documento.estado) {
    case 'novo':
      return null
    case 'ok':
      return documento.valor
    case 'somenteLeitura':
    case 'falhou':
      problemas.push(documento.aviso)
      return null
  }
}

function apagadosDe(vindos: VindosDoGrimorio | null, presentes: Readonly<Record<keyof ApagadosNoPreludio, ReadonlySet<string>>>): ApagadosNoPreludio {
  if (vindos === null) return {}
  return {
    verbetes: vindos.verbetes.filter((id) => !presentes.verbetes.has(id)),
    quadros: vindos.quadros.filter((id) => !presentes.quadros.has(id)),
    ligacoes: vindos.ligacoes.filter((id) => !presentes.ligacoes.has(id)),
    campanhas: vindos.campanhas.filter((id) => !presentes.campanhas.has(id)),
  }
}

async function lerTudo(flags: Readonly<FeatureFlags>): Promise<LeituraDoPreludio> {
  const problemas: string[] = []
  const indice = valorOuProblema(await lerIndiceDoPreparo(flags), problemas)
  const ligacoes = valorOuProblema(await lerDoPreparo(ARQUIVO_DAS_LIGACOES, LUGARES.ligacoes(), flags), problemas)
  const vindos = valorOuProblema(await lerDoPreparo(ARQUIVO_DOS_VINDOS, LUGARES.vindosDoGrimorio(), flags), problemas)
  const idsDeVerbetes = await listarNoPreparo('verbetes', flags)
  const verbetes = (await Promise.all(idsDeVerbetes.map(async (id) => ({ id, verbete: valorOuProblema(await lerVerbete(id, flags), problemas) })))).flatMap(({ id, verbete }) => {
    if (verbete === null) return []
    if (verbete.id === id) return [verbete]
    problemas.push(`O arquivo preparo/verbetes/${id}.json guarda o verbete "${verbete.id}": o nome do arquivo e o id dele têm de ser iguais.`)
    return []
  })
  const idsDeQuadros = await listarNoPreparo('quadros', flags)
  const quadros: QuadroComId[] = (
    await Promise.all(idsDeQuadros.map(async (id) => ({ id, quadro: valorOuProblema(await lerDoPreparo(ARQUIVO_DO_QUADRO, LUGARES.quadro(id), flags), problemas) })))
  ).flatMap(({ id, quadro }) => (quadro === null ? [] : [{ id, quadro }]))
  if (problemas.length > 0) return { ok: false, problemas }

  const campanhas = indice?.campanhas ?? []
  const listaDeLigacoes = ligacoes?.ligacoes ?? []
  const apagados = apagadosDe(vindos, {
    verbetes: new Set(verbetes.map((verbete) => verbete.id)),
    quadros: new Set(quadros.map((quadro) => quadro.id)),
    ligacoes: new Set(listaDeLigacoes.map((ligacao) => ligacao.id)),
    campanhas: new Set(campanhas.map((campanha) => campanha.id)),
  })
  const noPreludio: NoPreludio = { verbetes, quadros, ligacoes: listaDeLigacoes, campanhas, apagados }
  const vazio = vindos === null && verbetes.length === 0 && quadros.length === 0 && listaDeLigacoes.length === 0 && campanhas.length === 0
  const midias = await midiasNoPreludio(await pastaDoPreparo(flags))
  // Os mesmos arquivos lidos de novo dão o mesmo texto: cada molde monta o objeto na ordem dele.
  const impressao = await hashDoTexto(JSON.stringify({ indice, ligacoes, vindos, verbetes, quadros }))
  return { ok: true, foto: { noPreludio, vazio, vindos, indice, ligacoes, midias, impressao } }
}

/** Lê o Prelúdio inteiro para a importação. Nunca lança: o que deu errado vem em `problemas`. */
export async function lerPreludio(flags: Readonly<FeatureFlags> = FEATURES): Promise<LeituraDoPreludio> {
  try {
    return await lerTudo(flags)
  } catch (erro) {
    return { ok: false, problemas: [`Não deu para ler o Prelúdio: ${motivoDe(erro)}.`] }
  }
}
