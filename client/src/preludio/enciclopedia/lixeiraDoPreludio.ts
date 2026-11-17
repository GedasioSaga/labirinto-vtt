import { apagarVerbeteDoDisco } from '../../lib/preparo/disco'
import { ROTULO_DO_TIPO } from '../../lib/preparo/enciclopedia'
import { planoDeApagarDeVez, planoDeMandarParaALixeira, planoDeRestaurar, type PlanoDaLixeira, type RecusaDaLixeira } from '../../lib/preparo/lixeira'
import type { Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'

/**
 * A LIXEIRA DOS VERBETES NA LOJA DO PRELÚDIO (17/11): Excluir, Restaurar (o
 * Desfazer é um Restaurar) e "Apagar de vez". As regras moram em
 * `lib/preparo/lixeira.ts`; aqui o plano é feito com a loja de agora e vai para
 * ela pelo `mudarVerbete` de sempre (salvar automático, aviso à outra janela).
 */

export interface FeitoNaLixeira {
  /** A frase do aviso: o que aconteceu, ou por que não aconteceu. */
  readonly texto: string
  /** Os ids que entraram na Lixeira (ou saíram dela). Vazio = nada mudou. */
  readonly ids: readonly string[]
}

const TRAVADO = 'O Prelúdio está gravando uma importação ou uma cópia restaurada. Tente de novo quando terminar.'

function nomeDe(verbete: Verbete): string {
  return verbete.titulo || 'Sem nome'
}

function fraseDaRecusa(verbete: Verbete, motivo: RecusaDaLixeira): string {
  if (motivo === 'so-leitura') return `${nomeDe(verbete)} abre só para leitura e fica como está.`
  return `${ROTULO_DO_TIPO[verbete.tipo].um} não vai para a Lixeira: ${nomeDe(verbete)} fica como está.`
}

/** "Castelo", "3 lugares", "3 verbetes" (tipos misturados). */
function quem(alvos: readonly Verbete[]): string {
  const um = alvos[0]
  if (alvos.length === 1 && um !== undefined) return nomeDe(um)
  const tipo = um !== undefined && alvos.every((outro) => outro.tipo === um.tipo) ? ROTULO_DO_TIPO[um.tipo].varios.toLowerCase() : 'verbetes'
  return `${alvos.length} ${tipo}`
}

function aplicar(plano: PlanoDaLixeira): void {
  const { mudarVerbete } = usePreludio.getState()
  for (const [id, novo] of plano.mudancas) mudarVerbete(id, () => novo)
}

/** Os lugares que mudam de lugar de cima por causa do plano (os de dentro de quem entrou ou saiu). */
function deDentro(plano: PlanoDaLixeira): number {
  return plano.mudancas.size - plano.alvos.length
}

/** EXCLUIR: manda os verbetes para a Lixeira. O que estava dentro de um lugar excluído sobe um nível. */
export function mandarParaALixeira(ids: readonly string[]): FeitoNaLixeira {
  const estado = usePreludio.getState()
  if (estado.travado) return { texto: TRAVADO, ids: [] }
  const plano = planoDeMandarParaALixeira(ids, estado.verbetes, new Date().toISOString(), estado.soLeitura)
  const recusa = plano.recusados[0]
  const sobra = recusa === undefined ? '' : ` ${fraseDaRecusa(recusa[0], recusa[1])}`
  if (plano.alvos.length === 0) return { texto: sobra.trim() || 'Nada para excluir.', ids: [] }
  aplicar(plano)
  const subiram = deDentro(plano)
  const dosDeDentro = subiram === 0 ? '' : subiram === 1 ? ' O lugar de dentro subiu um nível.' : ` Os ${subiram} lugares de dentro subiram um nível.`
  return { texto: `${quem(plano.alvos)} ${plano.alvos.length === 1 ? 'foi' : 'foram'} para a Lixeira.${dosDeDentro}${sobra}`, ids: plano.alvos.map((verbete) => verbete.id) }
}

/** RESTAURAR (e o Desfazer do Excluir): os verbetes saem da Lixeira e o que tinha saído de dentro deles volta. */
export function restaurarDaLixeira(ids: readonly string[]): FeitoNaLixeira {
  const estado = usePreludio.getState()
  if (estado.travado) return { texto: TRAVADO, ids: [] }
  const plano = planoDeRestaurar(ids, estado.verbetes, estado.soLeitura)
  const recusa = plano.recusados[0]
  if (plano.alvos.length === 0) return { texto: recusa === undefined ? 'Nada para restaurar.' : fraseDaRecusa(recusa[0], recusa[1]), ids: [] }
  aplicar(plano)
  const voltaram = deDentro(plano)
  const dosDeDentro = voltaram === 0 ? '' : voltaram === 1 ? ' O lugar que tinha saído de dentro voltou.' : ` Os ${voltaram} lugares que tinham saído de dentro voltaram.`
  return { texto: `${quem(plano.alvos)} ${plano.alvos.length === 1 ? 'voltou' : 'voltaram'} da Lixeira.${dosDeDentro}`, ids: plano.alvos.map((verbete) => verbete.id) }
}

/**
 * APAGAR DE VEZ um verbete que está na Lixeira: o arquivo dele sai do disco e
 * não há Desfazer. Devolve o motivo quando não apagou (`null` = apagado).
 *
 * A ordem importa: primeiro termina o que ainda ia para o disco (a própria ida
 * para a Lixeira grava 800 ms depois; uma gravação atrasada traria o arquivo de
 * volta), depois o arquivo sai, e só então o verbete sai da memória e os outros
 * deixam de apontar para ele. Se o disco recusar, nada muda na tela.
 */
export async function apagarDeVez(id: string): Promise<string | null> {
  const antes = usePreludio.getState()
  if (antes.carga.t !== 'pronta') return 'O Prelúdio ainda está abrindo.'
  if (antes.travado) return TRAVADO
  const verbete = antes.verbetes.get(id)
  if (verbete === undefined) return null
  const soLeitura = antes.soLeitura.get(id)
  if (soLeitura !== undefined) return soLeitura
  if (planoDeApagarDeVez(id, antes.verbetes, antes.soLeitura) === null) return `${nomeDe(verbete)} não está na Lixeira: só se apaga de vez o que está lá.`
  if (!(await antes.salvarPendentes())) return 'Uma mudança do Prelúdio ainda não foi para o disco. Use "Tentar de novo" no rodapé e apague depois.'
  try {
    await apagarVerbeteDoDisco(id)
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro)
  }
  // A loja de agora: enquanto o disco trabalhava, a outra janela pode ter mudado algo.
  const agora = usePreludio.getState()
  const mudancas = planoDeApagarDeVez(id, agora.verbetes, agora.soLeitura) ?? new Map<string, Verbete>()
  for (const [outroId, novo] of mudancas) agora.mudarVerbete(outroId, () => novo)
  const { verbetes, versao } = usePreludio.getState()
  const semEle = new Map(verbetes)
  semEle.delete(id)
  usePreludio.setState({ verbetes: semEle, versao: versao + 1 })
  return null
}
