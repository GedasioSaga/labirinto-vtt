import { useId, useMemo, useRef, useState } from 'react'
import type { ItemDoCatalogo } from '../lib/acervoDeItens'
import { quemUsaDeTreino } from '../lib/batalha/ensaio/ensaioDoItem'
import { guardarMecanica } from '../lib/batalha/mecanica/modelos'
import { MODELOS_DE_ITEM, mecanicaDoModeloDeItem, modeloSugeridoParaOItem, ondeDoModeloDeItem, type IdDoModeloDeItem } from '../lib/batalha/mecanica/modelosDeItem'
import { resumoDoEfeitoDoItem } from '../lib/batalha/mecanica/resumoDoItem'
import { pecasDoEfeito } from '../lib/leituraDoItem'
import { novoCartao, type CartaoDaFicha } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import type { EfeitoDoItem } from '../types/map'
import { MecanicaDaTecnica } from './batalha/MecanicaDaTecnica'

/**
 * "O QUE ELE FAZ" na janela do item do Acervo (Fase 7 de
 * docs/design/habilidades/SISTEMA.md §5.1): o mesmo editor da técnica (os 3
 * degraus, com os 25 modelos de item), quanto gasta, onde vale, a frase que a
 * vaga mostra e o Testar no boneco. "Sugerir efeito" monta o modelo mais
 * parecido com o nome e a descrição; nada muda até o mestre clicar.
 */

const GASTOS: readonly { valor: EfeitoDoItem['gasta']; nome: string }[] = [
  { valor: 'um', nome: 'Gasta 1 por uso' },
  { valor: 'nada', nome: 'Não acaba (amuleto)' },
]

const ONDES: readonly { valor: EfeitoDoItem['onde']; nome: string }[] = [
  { valor: 'sempre', nome: 'Na batalha e fora' },
  { valor: 'soNaBatalha', nome: 'Só na batalha' },
  { valor: 'soFora', nome: 'Só fora da batalha' },
]

/** O id do cartão de mentira que leva as peças ao editor (nunca vai a ficha nenhuma). */
const ID_DO_CARTAO_DO_EFEITO = 'efeito-do-item'
/** "Quem usa" de treino no Testar (a ficha do boneco, de pé). */
const QUEM_USA_TREINO = ''

/** O item com o efeito; `undefined` tira o campo (ausente = item sem efeito). */
export function comEfeito(item: ItemDoCatalogo, efeito: EfeitoDoItem | undefined): ItemDoCatalogo {
  const { efeito: _antes, ...semEfeito } = item
  return efeito === undefined ? semEfeito : { ...semEfeito, efeito }
}

function efeitoDoModelo(id: IdDoModeloDeItem, sistema: Parameters<typeof mecanicaDoModeloDeItem>[1]): EfeitoDoItem | undefined {
  const pecas = pecasDoEfeito(guardarMecanica(mecanicaDoModeloDeItem(id, sistema)))
  return pecas === null ? undefined : { mecanica: pecas, gasta: 'um', onde: ondeDoModeloDeItem(id) }
}

export function EfeitoDoItemCampos({ item, onMudar }: { item: ItemDoCatalogo; onMudar: (efeito: EfeitoDoItem | undefined) => void }) {
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
  const cartao = useMemo<CartaoDaFicha>(() => ({ ...novoCartao(item.nome.trim() || 'Item'), id: ID_DO_CARTAO_DO_EFEITO, ...(efeito === undefined ? {} : { mecanica: efeito.mecanica }) }), [item.nome, efeito])
  const sugerido = efeito === undefined ? modeloSugeridoParaOItem(item.nome, item.descricao) : null
  const nomeDoSugerido = sugerido === null ? null : (MODELOS_DE_ITEM.find((modelo) => modelo.id === sugerido)?.nome ?? null)
  /** O "onde vale" do modelo recém-escolhido (a granada, só na batalha), para a gravação que vem logo depois. */
  const ondeDoModelo = useRef<EfeitoDoItem['onde'] | null>(null)

  const aoMudarCartao = (novo: CartaoDaFicha) => {
    if (novo.mecanica === undefined) {
      onMudar(undefined)
      return
    }
    const pecas = pecasDoEfeito(novo.mecanica)
    const onde = ondeDoModelo.current ?? gasto.onde
    ondeDoModelo.current = null
    // Peças acima do teto não entram: o item fica com o efeito de antes.
    if (pecas !== null) onMudar({ mecanica: pecas, gasta: gasto.gasta, onde })
  }
  const aoEscolherModelo = (id: string) => {
    const modelo = MODELOS_DE_ITEM.find((candidato) => candidato.id === id)
    ondeDoModelo.current = modelo === undefined ? null : ondeDoModeloDeItem(modelo.id)
  }

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
              const novo = efeitoDoModelo(sugerido, sistema)
              if (novo !== undefined) onMudar(novo)
            }}
          >
            Sugerir efeito ({nomeDoSugerido})
          </button>
        </p>
      )}
      <MecanicaDaTecnica key={item.id} cartao={cartao} ficha={{ personagem: quemUsa, sistema }} quemEdita="mestre" tecnicas={[]} onChange={aoMudarCartao} doQue="item" gastoDoItem={gasto} onModelo={aoEscolherModelo} />
      {efeito !== undefined && (
        <>
          <div className="lb-item-janela__linha">
            <label className="lb-field" htmlFor={`${idBase}-gasta`}>
              <span className="lb-label">Quanto gasta</span>
              <select id={`${idBase}-gasta`} className="lb-input" value={efeito.gasta} onChange={(event) => onMudar({ ...efeito, gasta: GASTOS.find((opcao) => opcao.valor === event.target.value)?.valor ?? efeito.gasta })}>
                {GASTOS.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="lb-field" htmlFor={`${idBase}-onde`}>
              <span className="lb-label">Onde vale</span>
              <select id={`${idBase}-onde`} className="lb-input" value={efeito.onde} onChange={(event) => onMudar({ ...efeito, onde: ONDES.find((opcao) => opcao.valor === event.target.value)?.valor ?? efeito.onde })}>
                {ONDES.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="lb-item-janela__frase">
            <span className="lb-label">Na mochila aparece</span> {resumoDoEfeitoDoItem(efeito, sistema)}
          </p>
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
