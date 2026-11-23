import type { CartaoDaFicha, Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { CombateDoPersonagem } from '../../lib/batalha/combate'
import { acumuladoresDoPersonagem, nivelDoAcumulador } from '../../lib/batalha/acumuladorNaBatalha'
import { contadorDoPersonagem } from '../../lib/batalha/contador'
import { partesEmOrdem } from '../../lib/batalha/mecanicasAMao'
import { NOME_DO_TIPO } from '../../lib/batalha/mecanica/golpe'
import { lerMecanica, type TipoDoGolpe } from '../../lib/batalha/mecanica/modelo'
import type { PerguntaNaHora, RespostasDoPedido } from '../../lib/batalha/perguntaNaHora'
import { avaliarDoCartao } from '../../lib/batalha/requisitos/avaliar'
import type { ContextoDosRequisitos } from '../../lib/batalha/requisitos/contexto'
import { lerRequisitos } from '../../lib/batalha/requisitos/ler'
import { blocoDoCartao } from '../../lib/batalha/requisitos/partes'
import { motivoDoPortao, portaoDosRequisitos, respostasDosRequisitos } from '../../lib/batalha/requisitos/portao'
import { grupoDaForma, type FormaNoMenu } from '../../lib/batalha/transformacao'
import { somaDaTecnica } from './acumulador/acumuladoresDaFicha'

/**
 * REQUISITOS G (docs/design/habilidades/REQUISITOS.md §10 e EDITOR.md §6): o que o MENU da vez mostra dos
 * requisitos, lido do motor sem mexer nele. Puro: sem store, sem rede, sem React.
 *
 * - os medidores do topo ("POLARIDADE 1/3"), um por acumulador da ficha que age;
 * - as Partes da forma ("Forma Híbrida · Parte 2", em segmentos);
 * - o ícone do tipo do golpe (ED1) e o selo "+1 Polaridade" da técnica que soma;
 * - as perguntas dos requisitos na hora de usar (a caixa "Cumpriu?" e o "Um destes");
 * - o cinza das técnicas de reação, pelo mesmo portão do host.
 */

/** Um medidor no topo do menu. */
export interface MedidorNaTela {
  id: string
  nome: string
  nivel: number
  maximo: number
}

function chaveDoNome(nome: string): string {
  return nome.trim().toLocaleLowerCase('pt-BR')
}

/**
 * Os acumuladores da ficha que age, com o nível desta batalha. O contador antigo (a Polaridade de texto,
 * `contador.ts`) entra com o nível que quem monta sabe ler (`nivelDoContador`); o bloco novo com o mesmo
 * nome vence. Sem nenhum = lista vazia.
 */
export function medidoresDaFicha(personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined, nivelDoContador: (cartaoId: string) => number): MedidorNaTela[] {
  const medidores: MedidorNaTela[] = acumuladoresDoPersonagem(personagem).map((acumulador) => ({
    id: acumulador.id,
    nome: acumulador.nome.trim() || 'Acumulador',
    nivel: Math.min(acumulador.maximo, nivelDoAcumulador(combate, acumulador.id)),
    maximo: acumulador.maximo,
  }))
  const antigo = contadorDoPersonagem(personagem, sistema)
  const maximo = antigo === null ? 0 : antigo.leitura.danoPorNivel.length
  if (antigo !== null && maximo > 0 && !medidores.some((medidor) => chaveDoNome(medidor.nome) === chaveDoNome(antigo.leitura.nome)))
    medidores.push({ id: antigo.cartao.id, nome: antigo.leitura.nome.trim() || 'Contador', nivel: Math.min(maximo, nivelDoContador(antigo.cartao.id)), maximo })
  return medidores.filter((medidor) => medidor.maximo > 0)
}

/** A forma em Partes como o topo do menu mostra: "Forma Híbrida · Parte 2" (0 = fora dela). */
export interface PartesNaTela {
  grupo: string
  parte: number
  total: number
}

/** A forma liga uma Parte por vez (o bloco `forma.partesEmOrdem`, ou a tabela à mão da Forma Híbrida). */
function ligaEmOrdem(cartao: CartaoDaFicha): boolean {
  const bloco = blocoDoCartao(cartao)
  return bloco !== null ? bloco.forma?.partesEmOrdem === true : partesEmOrdem(cartao.id)
}

/**
 * As Partes da forma da ficha: o grupo de formas (o campo Grupo) com duas ou mais, ligadas uma por vez. A
 * Parte é a ligada mais alta, na ordem da ficha. Mais de um grupo: o que está ligado vence. Nenhum = `null`.
 */
export function partesDaFicha(formas: readonly FormaNoMenu[]): PartesNaTela | null {
  const grupos = new Map<string, { nome: string; formas: FormaNoMenu[] }>()
  for (const forma of formas) {
    const grupo = grupoDaForma(forma.cartao)
    if (grupo === null) continue
    const chave = chaveDoNome(grupo)
    const achado = grupos.get(chave) ?? { nome: grupo.trim(), formas: [] }
    achado.formas.push(forma)
    grupos.set(chave, achado)
  }
  const emPartes = [...grupos.values()].filter((grupo) => grupo.formas.length >= 2 && grupo.formas.some((forma) => ligaEmOrdem(forma.cartao)))
  const escolhido = emPartes.find((grupo) => grupo.formas.some((forma) => forma.ligada)) ?? emPartes[0]
  if (escolhido === undefined) return null
  const parte = escolhido.formas.reduce((maior, forma, indice) => (forma.ligada ? indice + 1 : maior), 0)
  return { grupo: escolhido.nome, parte, total: escolhido.formas.length }
}

/** Um tipo do golpe na tira (ED1): o ícone e o nome. */
export interface TipoNaTira {
  tipo: TipoDoGolpe
  nome: string
}

/** Os tipos do golpe montado (como bate e o que causa), na ordem da escolha. Sem golpe = lista vazia. */
export function tiposDoGolpe(cartao: Pick<CartaoDaFicha, 'mecanica'>): TipoNaTira[] {
  const lida = lerMecanica(cartao.mecanica)
  if (lida.tipo !== 'pecas' || lida.mecanica.golpe === undefined) return []
  const { bate, causa = [] } = lida.mecanica.golpe
  const tipos: TipoNaTira[] = bate === undefined ? [] : [{ tipo: bate.tipo, nome: NOME_DO_TIPO[bate.tipo] }]
  for (const escolha of causa) tipos.push({ tipo: escolha.tipo, nome: escolha.tipo === 'outro' ? escolha.regra.nome.trim() || NOME_DO_TIPO.outro : NOME_DO_TIPO[escolha.tipo] })
  return tipos
}

/** "+1 Polaridade": o que a técnica soma nos acumuladores da ficha ao ser usada. */
export interface SomaNaTira {
  nome: string
  quanto: number
}

export function somasDaTecnica(personagem: Pick<Personagem, 'abas'>, cartao: Pick<CartaoDaFicha, 'id' | 'nome'>): SomaNaTira[] {
  return acumuladoresDoPersonagem(personagem).flatMap((acumulador) => {
    const quanto = somaDaTecnica(acumulador, { id: cartao.id, nome: cartao.nome })
    return quanto === null || quanto === 0 ? [] : [{ nome: acumulador.nome.trim() || 'Acumulador', quanto }]
  })
}

/**
 * As perguntas dos requisitos na hora de usar (a caixa "Cumpriu?", o "Um destes"), com as respostas já
 * dadas: a opção escolhida pode trazer outra pergunta (a caixa dela). O bloco que falta ou não pergunta =
 * lista vazia.
 */
export function perguntasDosRequisitos(requisitos: unknown, para: 'usar' | 'evoluir', ctx: ContextoDosRequisitos, respostas: RespostasDoPedido = {}): readonly PerguntaNaHora[] {
  if (requisitos === undefined) return []
  const doReq = respostasDosRequisitos(respostas)
  const avaliacao = avaliarDoCartao(lerRequisitos(requisitos), para, ctx, doReq === undefined ? {} : { respostas: doReq })
  if (avaliacao === null || avaliacao.veredito === 'falta') return []
  return avaliacao.perguntasNaHora
}

/** O leitor das perguntas que a mira e o Evoluir chamam; `undefined` = o cartão não pergunta nada. */
export function leitorDasPerguntas(requisitos: unknown, para: 'usar' | 'evoluir', ctx: ContextoDosRequisitos | undefined): ((respostas: RespostasDoPedido) => readonly PerguntaNaHora[]) | undefined {
  if (requisitos === undefined || ctx === undefined) return undefined
  if (perguntasDosRequisitos(requisitos, para, ctx).length === 0) return undefined
  return (respostas) => perguntasDosRequisitos(requisitos, para, ctx, respostas)
}

/** Uma técnica de reação como a caixa a mostra (o que este arquivo lê dela). */
interface ReacaoNaCaixa {
  cartao: CartaoDaFicha
  motivo: string | null
}

/**
 * REQUISITOS G (o que a D deixou de fora): a técnica de reação cujo requisito não vale fica cinza com o
 * motivo, pelo MESMO portão do host na reação (`naReacao`; sem respostas e sem forçar: o que pergunta,
 * espera alguém ou rola não dá na reação). `ctx` ausente = a lista como veio.
 */
export function reacoesComOsRequisitos<T extends ReacaoNaCaixa>(reacoes: readonly T[], ctx: ContextoDosRequisitos | undefined): T[] {
  if (ctx === undefined) return [...reacoes]
  const naReacao: ContextoDosRequisitos = { ...ctx, naReacao: true }
  return reacoes.map((reacao) => {
    if (reacao.motivo !== null || reacao.cartao.requisitos === undefined) return reacao
    const motivo = motivoDoPortao(portaoDosRequisitos(reacao.cartao.requisitos, 'usar', naReacao, {}, false))
    return motivo === null ? reacao : { ...reacao, motivo }
  })
}
