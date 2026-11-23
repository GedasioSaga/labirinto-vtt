import { useCallback, useMemo } from 'react'
import { quemUsaDeTreino } from '../lib/batalha/ensaio/ensaioDoItem'
import { ABA_DAS_ARMAS, CAMPO_DO_EFEITO } from '../lib/batalha/leituraDaFicha'
import type { ItemDoCatalogo } from '../lib/livros/catalogo'
import { cartoesDaAba, novoCartao, type CartaoDaFicha, type MecanicaGuardada, type Personagem, type RequisitosGuardados } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { useCatalogoStore } from '../stores/catalogoStore'
import { usePersonagensDoMundo } from '../stores/mundoDoLivroStore'
import type { FonteDaArma } from './fonteDaArma'
import { HabilidadeNaFicha } from './batalha/editor/HabilidadeNaFicha'
import './AcervoDeItensPanel.css'

/**
 * "O QUE ELA FAZ" da arma, o MESMO editor nos 3 lugares (docs/design/habilidades/
 * ARMAS-FONTE-UNICA.md §6): o lápis do catálogo, a coisa de categoria Arma do
 * Acervo e o cartão da ficha. Edita a `mecanica` e os `requisitos` da ENTRADA
 * do catálogo, que é a fonte: quem grava é a janela, por `gravarRegraDaArma`,
 * que reescreve na hora toda cópia ligada. ED7: o editor é o novo
 * (`EditorDaHabilidade` no modo arma), com as marcas da entrada.
 */

/** O id do cartão de mentira que leva a mecânica da entrada ao editor (nunca vai a ficha nenhuma). */
const ID_DO_CARTAO_DA_REGRA = 'regra-da-arma'
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

/** O que o editor mudou na regra da arma: o que vai à entrada no Salvar da janela. */
export interface RegraDaArmaNoEditor {
  /** `undefined` = sem mecânica (a arma volta a só o dano). */
  mecanica: MecanicaGuardada | undefined
  /** O texto novo do campo Efeito quando ele segue a mecânica; `undefined` = o texto fica. */
  efeito?: string
  requisitos: RequisitosGuardados | undefined
  marcas: string[] | undefined
}

export interface EfeitoDaArmaCamposProps {
  /** A entrada como ela ficaria ao salvar (o rascunho da janela). */
  entrada: Pick<ItemDoCatalogo, 'nome' | 'campos' | 'acervoId' | 'mecanica' | 'requisitos' | 'marcas'>
  sistema: SistemaDeRpg
  onMudar: (regra: RegraDaArmaNoEditor) => void
  /** Uma frase a mais embaixo (a coisa sem regra neste livro: salvar cria a entrada). */
  nota?: string
}

export function EfeitoDaArmaCampos({ entrada, sistema, onMudar, nota }: EfeitoDaArmaCamposProps) {
  const fichas = usePersonagensDoMundo()
  const quantas = fichasComAArma(fichas, entrada.acervoId)
  const treino = useMemo(() => quemUsaDeTreino(sistema), [sistema])
  const ondeVale = fraseDeOndeVale(quantas, entrada.acervoId !== undefined)
  // O editor trabalha sobre um cartão: a regra da entrada entra e sai por ele, com os campos dela (o Dano e a fórmula do Atacar).
  const cartao = useMemo<CartaoDaFicha>(
    () => ({
      ...novoCartao(entrada.nome.trim() || 'Arma'),
      id: ID_DO_CARTAO_DA_REGRA,
      campos: { ...entrada.campos },
      ...(entrada.mecanica === undefined ? {} : { mecanica: entrada.mecanica }),
      ...(entrada.requisitos === undefined ? {} : { requisitos: entrada.requisitos }),
      ...(entrada.marcas === undefined ? {} : { marcas: entrada.marcas }),
    }),
    [entrada.nome, entrada.campos, entrada.mecanica, entrada.requisitos, entrada.marcas],
  )
  // Com mecânica, o Efeito em texto é a frase do resumo (regra do dono: um lugar não diz outra coisa); quem escreve é o editor, pelo ponto único do texto gerado.
  const aoMudar = (novo: CartaoDaFicha) => {
    const efeito = novo.campos[CAMPO_DO_EFEITO]
    const mudouOEfeito = efeito !== undefined && efeito !== entrada.campos[CAMPO_DO_EFEITO]
    onMudar({ mecanica: novo.mecanica, ...(mudouOEfeito ? { efeito } : {}), requisitos: novo.requisitos, marcas: novo.marcas })
  }
  return (
    <fieldset className="lb-item-janela__efeito">
      <legend className="lb-label">O que ela faz</legend>
      <p className="lb-item-janela__frase">{ondeVale}</p>
      <HabilidadeNaFicha cartao={cartao} ficha={{ personagem: treino, sistema }} quemEdita="mestre" tecnicas={[]} podeOcultar={false} onChange={aoMudar} doQue="arma" foraDaFicha trilha={ondeVale} />
      {nota !== undefined && <p className="lb-field__hint">{nota}</p>}
    </fieldset>
  )
}
