import { useCallback, useMemo } from 'react'
import { quemUsaDeTreino } from '../lib/batalha/ensaio/ensaioDoItem'
import { ABA_DAS_ARMAS } from '../lib/batalha/leituraDaFicha'
import { lerMecanica } from '../lib/batalha/mecanica/modelo'
import { resumoDaMecanica } from '../lib/batalha/mecanica/resumo'
import type { ItemDoCatalogo } from '../lib/livros/catalogo'
import { cartoesDaAba, novoCartao, type CartaoDaFicha, type MecanicaGuardada, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { useCatalogoStore } from '../stores/catalogoStore'
import { usePersonagensDoMundo } from '../stores/mundoDoLivroStore'
import type { FonteDaArma } from './fonteDaArma'
import { MecanicaDaTecnica } from './batalha/MecanicaDaTecnica'
import './AcervoDeItensPanel.css'

/**
 * "O QUE ELA FAZ" da arma, o MESMO editor nos 3 lugares (docs/design/habilidades/
 * ARMAS-FONTE-UNICA.md §6): o lápis do catálogo, a coisa de categoria Arma do
 * Acervo e (pela mesma frase) o cartão da ficha. Edita a `mecanica` da ENTRADA
 * do catálogo, que é a fonte: quem grava é a janela, por `gravarRegraDaArma`,
 * que reescreve na hora toda cópia ligada.
 */

/** O id do cartão de mentira que leva a mecânica da entrada ao editor (nunca vai a ficha nenhuma). */
const ID_DO_CARTAO_DA_REGRA = 'regra-da-arma'
/** O que a arma sem mecânica faz: a mesma frase do editor fechado. */
export const ARMA_SO_COM_O_DANO = 'Sem mecânica, o Atacar usa só o dano da arma.'

/** "O que ela faz" numa frase: a mesma nos 3 lugares (o boneco de treino dá os números, como no Testar). */
export function fraseDoQueElaFaz(mecanica: MecanicaGuardada | undefined, sistema: SistemaDeRpg): string {
  const lida = lerMecanica(mecanica)
  if (lida.tipo === 'nenhuma') return ARMA_SO_COM_O_DANO
  if (lida.tipo !== 'pecas') return 'Montada num app mais novo: atualize o app para ver.'
  return resumoDaMecanica(lida.mecanica, { personagem: quemUsaDeTreino(sistema), sistema }).join(' ')
}

/** Quantas fichas da pasta têm cartão de arma ligado à coisa `acervoId` (as cópias que o Salvar reescreve). */
export function fichasComAArma(personagens: readonly Personagem[] | null, acervoId: string | undefined): number {
  if (acervoId === undefined || personagens === null) return 0
  return personagens.filter((personagem) => cartoesDaAba(personagem, ABA_DAS_ARMAS).some((cartao) => cartao.itemId === acervoId)).length
}

/** A frase de onde a regra vale, com o número de fichas da pasta aberta. */
export function fraseDeOndeVale(quantas: number, ligada: boolean): string {
  if (!ligada) return 'Vale no livro. Sem coisa no Acervo, nenhuma ficha está ligada a ela ainda.'
  return `Vale em todo lugar: livro, Acervo e ${quantas} ${quantas === 1 ? 'ficha' : 'fichas'}.`
}

/** A fonte de cada cartão de arma pelo `itemId`, do livro aberto neste sistema (o valor do `FonteDaArmaContexto`). */
export function useFonteDasArmas(sistema: SistemaDeRpg | undefined): (itemId: string | undefined) => FonteDaArma {
  const livroAberto = useCatalogoStore((state) => sistema !== undefined && state.podeGravar && state.sistemaId === sistema.id)
  const itens = useCatalogoStore((state) => state.itens)
  const fichas = usePersonagensDoMundo()
  return useCallback(
    (itemId: string | undefined): FonteDaArma => {
      if (itemId === undefined) return { tipo: 'soNestaFicha' }
      if (!livroAberto) return { tipo: 'semLivro' }
      const entrada = itens.find((item) => item.tipo === 'arma' && item.acervoId === itemId)
      return entrada === undefined ? { tipo: 'soNestaFicha' } : { tipo: 'livro', entrada, fichas: fichasComAArma(fichas, itemId) }
    },
    [livroAberto, itens, fichas],
  )
}

export interface EfeitoDaArmaCamposProps {
  /** A entrada como ela ficaria ao salvar (o rascunho da janela). */
  entrada: Pick<ItemDoCatalogo, 'nome' | 'campos' | 'acervoId' | 'mecanica'>
  sistema: SistemaDeRpg
  /** A mecânica nova; `undefined` = tirar (a arma volta a só o dano). */
  onMudar: (mecanica: MecanicaGuardada | undefined) => void
  /** Uma frase a mais embaixo (a coisa sem regra neste livro: salvar cria a entrada). */
  nota?: string
}

export function EfeitoDaArmaCampos({ entrada, sistema, onMudar, nota }: EfeitoDaArmaCamposProps) {
  const fichas = usePersonagensDoMundo()
  const quantas = fichasComAArma(fichas, entrada.acervoId)
  const treino = useMemo(() => quemUsaDeTreino(sistema), [sistema])
  // O editor trabalha sobre um cartão: a mecânica da entrada entra e sai por ele, com os campos dela (o Dano e a fórmula do Atacar).
  const cartao = useMemo<CartaoDaFicha>(
    () => ({ ...novoCartao(entrada.nome.trim() || 'Arma'), id: ID_DO_CARTAO_DA_REGRA, campos: { ...entrada.campos }, ...(entrada.mecanica === undefined ? {} : { mecanica: entrada.mecanica }) }),
    [entrada.nome, entrada.campos, entrada.mecanica],
  )
  return (
    <fieldset className="lb-item-janela__efeito">
      <legend className="lb-label">O que ela faz</legend>
      <p className="lb-item-janela__frase">{fraseDeOndeVale(quantas, entrada.acervoId !== undefined)}</p>
      <MecanicaDaTecnica cartao={cartao} ficha={{ personagem: treino, sistema }} quemEdita="mestre" tecnicas={[]} onChange={(novo) => onMudar(novo.mecanica)} doQue="arma" />
      {nota !== undefined && <p className="lb-field__hint">{nota}</p>}
    </fieldset>
  )
}
