import { isTauri } from '@tauri-apps/api/core'
import { converterFicha, type FichaConvertida } from '../lib/batalha/mecanica/conversao/ficha'
import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { arquivoDasFichasDoMapa, discoDoApp, type DiscoDaMigracao } from '../net/nuvem/migracaoDaMochila'
import { useToastStore } from './toastStore'

/**
 * REWORK DO EDITOR DE HABILIDADES, E2 (docs/design/habilidades-rework/PLANO.md D11): a CÓPIA DE
 * SEGURANÇA ao abrir e a conversão na leitura para a tela.
 *
 * A conversão das habilidades antigas NÃO grava ao abrir: roda na leitura (a lista e o editor chamam
 * `fichaConvertida`) e só vai ao disco quando o mestre salva (ou o dono, como proposta). Ao abrir o
 * mapa, só a cópia do arquivo das fichas como era (`rpg.json.antes-habilidades-v2`, ou a do
 * `adventure.json`), UMA vez e nunca regravada, antes de qualquer gravação desta versão (a abertura
 * chama antes da migração da mochila e da conversão dos itens). A do catálogo do livro mora na
 * gravação dele (`gravarCatalogo`, `lib/livros/catalogoNoDisco.ts`).
 */

export const SUFIXO_DA_COPIA_DAS_HABILIDADES_V2 = '.antes-habilidades-v2'

/** Alguma ficha tem cartão (habilidade, forma, perícia...): só então a cópia vale a pena. */
function temCartao(personagens: readonly Personagem[]): boolean {
  return personagens.some((personagem) => Object.values(personagem.abas).some((cartoes) => cartoes.length > 0))
}

/**
 * A cópia do arquivo das fichas do mapa, como está no disco, ao lado dele, UMA vez (a que já existe
 * nunca é regravada). Devolve o caminho da cópia nova; `null` = nada copiado (sem fichas, ilegível ou
 * já copiada). O teste usa um disco falso; o app, `discoDoApp`.
 */
export async function guardarCopiaDasFichasDoMapa(caminhoDoMapa: string, disco: DiscoDaMigracao): Promise<string | null> {
  const alvo = await arquivoDasFichasDoMapa(caminhoDoMapa, disco)
  if (alvo === null || !temCartao(alvo.personagens)) return null
  const copia = `${alvo.arquivo}${SUFIXO_DA_COPIA_DAS_HABILIDADES_V2}`
  if ((await disco.ler(copia)) !== null) return null
  await disco.gravar(copia, alvo.texto)
  return copia
}

/**
 * A cópia na abertura do app (`App.tsx`, antes da migração da mochila e da conversão dos itens).
 * Nunca lança e nunca impede o mapa de abrir: falhou, avisa e o mapa abre como antes. Fora do app,
 * não faz nada.
 */
export async function guardarCopiaDasHabilidadesAoAbrir(caminhoDoMapa: string): Promise<void> {
  if (!isTauri()) return
  try {
    await guardarCopiaDasFichasDoMapa(caminhoDoMapa, discoDoApp)
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para guardar a cópia das fichas de antes das habilidades novas (${erro instanceof Error ? erro.message : String(erro)}). O mapa abre como antes; salve só depois de conferir.`)
  }
}

/** A conversão já feita, por ficha e sistema: a mesma ficha dá sempre o MESMO objeto (a tela não redesenha à toa). */
const convertidas = new WeakMap<Personagem, WeakMap<SistemaDeRpg, FichaConvertida>>()

/**
 * A ficha como a lista e o editor a mostram: as habilidades antigas convertidas (`converterFicha`,
 * pura), com o relatório do que converteu e do que pede "Confira". Lembrada por ficha: chamar de novo
 * com a mesma ficha devolve o mesmo resultado, e a ficha convertida devolve ela mesma.
 */
export function fichaConvertida(personagem: Personagem, sistema: SistemaDeRpg): FichaConvertida {
  const porSistema = convertidas.get(personagem) ?? new WeakMap<SistemaDeRpg, FichaConvertida>()
  convertidas.set(personagem, porSistema)
  const ja = porSistema.get(sistema)
  if (ja !== undefined) return ja
  const feita = converterFicha(personagem, sistema)
  porSistema.set(sistema, feita)
  return feita
}
