import { useId, useMemo, useRef, useState } from 'react'
import type { ItemDoCatalogo } from '../lib/acervoDeItens'
import { quemUsaDeTreino } from '../lib/batalha/ensaio/ensaioDoItem'
import { MODELOS_DE_ITEM, efeitoDoModeloDeItem, modeloSugeridoParaOItem } from '../lib/batalha/mecanica/modelosDeItem'
import { requisitosGuardados } from '../lib/batalha/requisitos/guardados'
import { resumoDoEfeitoDoItem } from '../lib/batalha/mecanica/resumoDoItem'
import { descricaoDizOEfeito } from '../lib/descricaoDoEfeito'
import { pecasDoEfeito } from '../lib/leituraDoItem'
import { novoCartao, type CartaoDaFicha } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import type { EfeitoDoItem, RequisitosNaVaga } from '../types/map'
import { HabilidadeNaFicha } from './batalha/editor/HabilidadeNaFicha'
import type { GastoDoItem } from './batalha/editor/linhas/LinhaDoGasto'
import type { ModeloNoEditor } from './batalha/editor/modelosDoEditor'

/**
 * "O QUE ELE FAZ" na janela do item do Acervo (Fase 7 de
 * docs/design/habilidades/SISTEMA.md §5.1): o editor da habilidade no modo
 * item (ED7: os 25 modelos de item, Alcance, Efeitos, Gasto e Requisitos), a
 * frase que a vaga mostra e o Testar no boneco. "Sugerir efeito" monta o
 * modelo mais parecido com o nome e a descrição; nada muda até o mestre
 * clicar. O Acervo é a fonte: as vagas da mochila seguem o efeito e os
 * requisitos ao salvar (`stores/itensNaFonte.ts`).
 */

/** O id do cartão de mentira que leva as peças ao editor (nunca vai a ficha nenhuma). */
const ID_DO_CARTAO_DO_EFEITO = 'efeito-do-item'
/** "Quem usa" de treino no Testar (a ficha do boneco, de pé). */
const QUEM_USA_TREINO = ''

/** O item com o efeito; `undefined` tira o campo (ausente = item sem efeito). */
export function comEfeito(item: ItemDoCatalogo, efeito: EfeitoDoItem | undefined): ItemDoCatalogo {
  const { efeito: _antes, ...semEfeito } = item
  return efeito === undefined ? semEfeito : { ...semEfeito, efeito }
}

/** ED7: o item com os requisitos para usar; `undefined` tira o campo (ausente = sem bloco). */
export function comRequisitosDoItem(item: ItemDoCatalogo, requisitos: RequisitosNaVaga | undefined): ItemDoCatalogo {
  const { requisitos: _antes, ...semRequisitos } = item
  return requisitos === undefined ? semRequisitos : { ...semRequisitos, requisitos }
}

interface EfeitoDoItemCamposProps {
  item: ItemDoCatalogo
  onMudar: (efeito: EfeitoDoItem | undefined) => void
  /** ED7: os requisitos para usar o item (fase F); `undefined` = sem bloco. Andam com o efeito até a vaga. */
  onRequisitos: (requisitos: RequisitosNaVaga | undefined) => void
  /**
   * Regra do dono (um lugar não diz uma coisa e outro outra): o modelo escolhido sobre a descrição que dizia um
   * efeito com número ('Cura 50 HP') troca a descrição pela frase do modelo. Sem a prop, a descrição fica.
   */
  onTrocarDescricao?: (descricao: string) => void
}

export function EfeitoDoItemCampos({ item, onMudar, onRequisitos, onTrocarDescricao }: EfeitoDoItemCamposProps) {
  const idBase = useId()
  const idDoSistema = useAdventureStore(sistemaAtivo)
  const sistema = useRpgStore((state) => sistemaPorId(state.biblioteca, idDoSistema)) ?? SISTEMA_ONE_PIECE
  const fichas = useAdventureStore(personagensAtivos)
  const [quemUsaId, setQuemUsaId] = useState(QUEM_USA_TREINO)
  const treino = useMemo(() => quemUsaDeTreino(sistema), [sistema])
  const quemUsa = fichas.find((ficha) => ficha.id === quemUsaId) ?? treino
  const { efeito } = item
  const gasto = useMemo(() => ({ gasta: efeito?.gasta ?? 'um', onde: efeito?.onde ?? 'sempre' }), [efeito?.gasta, efeito?.onde])
  // O editor trabalha sobre um cartão: as peças do item entram e saem por ele, com o nome do item no Testar.
  const cartao = useMemo<CartaoDaFicha>(
    () => ({ ...novoCartao(item.nome.trim() || 'Item'), id: ID_DO_CARTAO_DO_EFEITO, ...(efeito === undefined ? {} : { mecanica: efeito.mecanica }), ...(item.requisitos === undefined ? {} : { requisitos: item.requisitos }) }),
    [item.nome, efeito, item.requisitos],
  )
  const sugerido = efeito === undefined ? modeloSugeridoParaOItem(item.nome, item.descricao) : null
  const nomeDoSugerido = sugerido === null ? null : (MODELOS_DE_ITEM.find((modelo) => modelo.id === sugerido)?.nome ?? null)
  /** O "onde vale" do modelo recém-escolhido (a granada, só na batalha), para a gravação que vem logo depois. */
  const ondeDoModelo = useRef<EfeitoDoItem['onde'] | null>(null)
  /** A descrição que dizia um efeito virou a frase do modelo (o aviso embaixo, para o mestre ver o que mudou). */
  const [trocouDescricao, setTrocouDescricao] = useState(false)
  /** O efeito vindo de um modelo: a descrição velha que dizia um efeito vira a frase dele. */
  const doModelo = (novo: EfeitoDoItem) => {
    onMudar(novo)
    if (onTrocarDescricao === undefined || !descricaoDizOEfeito(item.descricao)) return
    onTrocarDescricao(resumoDoEfeitoDoItem(novo, sistema))
    setTrocouDescricao(true)
  }

  const aoMudarCartao = (novo: CartaoDaFicha) => {
    if (novo.requisitos !== cartao.requisitos) onRequisitos(requisitosGuardados(novo.requisitos))
    // Só os requisitos mudaram (a mesma mecânica): o efeito fica como está.
    if (novo.mecanica === cartao.mecanica) return
    if (novo.mecanica === undefined) {
      onMudar(undefined)
      return
    }
    const pecas = pecasDoEfeito(novo.mecanica)
    const veioDoModelo = ondeDoModelo.current !== null
    const onde = ondeDoModelo.current ?? gasto.onde
    ondeDoModelo.current = null
    // Peças acima do teto não entram: o item fica com o efeito de antes.
    if (pecas === null) return
    const efeitoNovo: EfeitoDoItem = { mecanica: pecas, gasta: gasto.gasta, onde }
    if (veioDoModelo) doModelo(efeitoNovo)
    else onMudar(efeitoNovo)
  }
  const aoEscolherModelo = (modelo: ModeloNoEditor) => {
    ondeDoModelo.current = modelo.onde ?? null
  }
  const gastoNoEditor = efeito === undefined ? undefined : { gasto, onChange: (novo: GastoDoItem) => onMudar({ ...efeito, ...novo }) }

  return (
    <fieldset className="lb-item-janela__efeito">
      <legend className="lb-label">O que ele faz</legend>
      {sugerido !== null && nomeDoSugerido !== null && (
        <p className="lb-item-janela__sugestao">
          <span>Parece um item de {nomeDoSugerido}.</span>{' '}
          <button
            type="button"
            className="lb-btn lb-btn--compact"
            onClick={() => {
              const novo = efeitoDoModeloDeItem(sugerido, sistema)
              if (novo !== undefined) doModelo(novo)
            }}
          >
            Sugerir efeito ({nomeDoSugerido})
          </button>
        </p>
      )}
      <HabilidadeNaFicha
        key={item.id}
        cartao={cartao}
        ficha={{ personagem: quemUsa, sistema }}
        quemEdita="mestre"
        tecnicas={[]}
        podeOcultar={false}
        onChange={aoMudarCartao}
        doQue="item"
        foraDaFicha
        trilha="vale no Acervo; as cópias na mochila seguem ao salvar"
        {...(gastoNoEditor === undefined ? {} : { gastoDoItem: gastoNoEditor })}
        onModelo={aoEscolherModelo}
      />
      {efeito !== undefined && (
        <>
          <p className="lb-item-janela__frase">
            <span className="lb-label">Na mochila aparece</span> {resumoDoEfeitoDoItem(efeito, sistema)}
          </p>
          {trocouDescricao && (
            <p className="lb-field__hint" role="status">
              A descrição dizia outro efeito: virou esta frase.
            </p>
          )}
        </>
      )}
      {fichas.length > 0 && (
        <label className="lb-field" htmlFor={`${idBase}-quem`}>
          <span className="lb-label">Quem usa no Testar</span>
          <select id={`${idBase}-quem`} className="lb-input" value={quemUsaId} onChange={(event) => setQuemUsaId(event.target.value)}>
            <option value={QUEM_USA_TREINO}>Boneco de treino</option>
            {fichas.map((ficha) => (
              <option key={ficha.id} value={ficha.id}>
                {ficha.nome}
              </option>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  )
}
