import { isTauri } from '@tauri-apps/api/core'
import { ARQUIVO_DAS_CONDICOES } from '../lib/condicoesNoDisco'
import { montadaDaAntiga } from '../lib/condicoes/montadaDaAntiga'
import { fichaTocaEmCondicao } from '../lib/condicoes/usos'
import type { CondicaoPropria } from '../types/map'
import { arquivoDasFichasDoMapa, discoDoApp, type DiscoDaMigracao } from '../net/nuvem/migracaoDaMochila'
import { useToastStore } from './toastStore'

/**
 * REWORK DAS CONDIÇÕES, E2 (docs/design/condicoes-rework/PLANO.md §7 risco 2, molde
 * `stores/conversaoDasHabilidades.ts`): a CÓPIA DE SEGURANÇA e a conversão na leitura.
 *
 * A condição de antes NÃO é regravada ao abrir: as peças dela saem da `regra`, do `n` e do `gatilho`
 * na leitura (`montadaDaAntiga`, pura e idempotente; aqui lembrada por condição) e só vão ao disco
 * quando o mestre salva. O que se grava ao abrir é só a cópia, UMA vez, nunca regravada, ao lado de cada
 * arquivo, antes da 1ª gravação desta versão (`.antes-condicoes-v2`):
 *  - o arquivo das fichas (`rpg.json`, ou o `adventure.json`), ao abrir o mapa (`App.tsx`), quando
 *    alguma ficha tem condição posta ou cartão e item que põem ou citam condição;
 *  - a lista das criadas (`<pasta>/condicoes.json`), antes da 1ª gravação dela nesta pasta
 *    (`stores/condicoesPropriasStore.ts`); sem a cópia, a lista não grava;
 *  - o catálogo do livro, na gravação dele (`gravarCatalogo`, `lib/livros/catalogoNoDisco.ts`).
 * Com a cópia, o app de antes (que recusa ler a versão 2 da lista e apagaria campo novo das fichas ao
 * regravar) tem para onde voltar.
 */

export const SUFIXO_DA_COPIA_DAS_CONDICOES_V2 = '.antes-condicoes-v2'

/** O pedaço do disco que a cópia usa (o teste passa um falso; o app, `discoDoApp`). */
export type DiscoDaCopia = Pick<DiscoDaMigracao, 'ler' | 'gravar' | 'juntar'>

/** Grava a cópia de `arquivo` (cujo texto é `texto`) ao lado dele, só se ela ainda não existe. Devolve o caminho da cópia nova; `null` = já havia. */
async function copiarUmaVez(arquivo: string, texto: string, disco: DiscoDaCopia): Promise<string | null> {
  const copia = `${arquivo}${SUFIXO_DA_COPIA_DAS_CONDICOES_V2}`
  if ((await disco.ler(copia)) !== null) return null
  await disco.gravar(copia, texto)
  return copia
}

/**
 * A cópia do arquivo das fichas do mapa, como está no disco, UMA vez, quando alguma ficha toca em
 * condição (`fichaTocaEmCondicao`). Devolve o caminho da cópia nova; `null` = nada copiado (sem fichas,
 * nenhuma com condição, ilegível ou já copiada).
 */
export async function guardarCopiaDasFichasParaAsCondicoes(caminhoDoMapa: string, disco: DiscoDaMigracao): Promise<string | null> {
  const alvo = await arquivoDasFichasDoMapa(caminhoDoMapa, disco)
  if (alvo === null || !alvo.personagens.some(fichaTocaEmCondicao)) return null
  return copiarUmaVez(alvo.arquivo, alvo.texto, disco)
}

/**
 * A cópia na abertura do mapa (`App.tsx`, ao lado da cópia das habilidades, antes da migração da mochila
 * e da conversão dos itens). Nunca lança e nunca impede o mapa de abrir: falhou, avisa e o mapa abre como
 * antes. Fora do app, não faz nada.
 */
export async function guardarCopiaDasCondicoesAoAbrir(caminhoDoMapa: string): Promise<void> {
  if (!isTauri()) return
  try {
    await guardarCopiaDasFichasParaAsCondicoes(caminhoDoMapa, discoDoApp)
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para guardar a cópia das fichas de antes das condições novas (${erro instanceof Error ? erro.message : String(erro)}). O mapa abre como antes; salve só depois de conferir.`)
  }
}

/**
 * A cópia da lista das criadas da pasta (`<pasta>/condicoes.json`), como está, UMA vez. Sem arquivo, não
 * há o que copiar. Lança quando o disco recusa: quem grava a lista não grava sem a cópia.
 */
export async function guardarCopiaDaListaDeCondicoes(pasta: string, disco: DiscoDaCopia = discoDoApp): Promise<string | null> {
  const arquivo = await disco.juntar(pasta, ARQUIVO_DAS_CONDICOES)
  const texto = await disco.ler(arquivo)
  return texto === null ? null : copiarUmaVez(arquivo, texto, disco)
}

/** A conversão já feita, por condição: a mesma condição dá sempre o MESMO objeto (a tela não redesenha à toa). */
const convertidas = new WeakMap<CondicaoPropria, CondicaoPropria>()

/**
 * A criada como a lista e o editor a mostram: com as peças (a de antes ganha as da `regra`, do `n` e do
 * `gatilho`, `montadaDaAntiga`). Lembrada por condição: a mesma condição devolve o mesmo resultado, e a
 * convertida (ou a que já tinha peças) devolve ela mesma. Nada grava.
 */
export function condicaoConvertida(propria: CondicaoPropria): CondicaoPropria {
  const ja = convertidas.get(propria)
  if (ja !== undefined) return ja
  const feita = montadaDaAntiga(propria)
  convertidas.set(propria, feita)
  if (feita !== propria) convertidas.set(feita, feita)
  return feita
}

/** As listas já convertidas: a mesma lista dá sempre a MESMA lista convertida (e a sem nada de antes volta ela mesma). */
const listasConvertidas = new WeakMap<readonly CondicaoPropria[], readonly CondicaoPropria[]>()

/** A lista das criadas com as peças, para a tela (`condicaoConvertida` em cada uma). */
export function listaConvertida(lista: readonly CondicaoPropria[]): readonly CondicaoPropria[] {
  const ja = listasConvertidas.get(lista)
  if (ja !== undefined) return ja
  const feita = lista.map(condicaoConvertida)
  const mesma = feita.every((condicao, indice) => condicao === lista[indice]) ? lista : feita
  listasConvertidas.set(lista, mesma)
  if (mesma !== lista) listasConvertidas.set(mesma, mesma)
  return mesma
}
