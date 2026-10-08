import { useMemo, useState, type KeyboardEvent } from 'react'
import { filtrarItens } from '../lib/buscaNoLivro'
import { atributosAbreviados, type ItemEscolhivel, type ResumoDoLivro } from '../lib/livroDeRegras'
import { textoSemMarcacao } from '../lib/marcacaoLeve'
import type { AbaDoSistema, SistemaDeRpg } from '../lib/sistemaDeRpg'
import './EscolherDoLivro.css'

/**
 * Como a ficha chega ao livro quando ele NÃO vem junto com o sistema: na tela
 * do jogador o sistema chega sem livro, e o livro vem do mestre sob pedido
 * (`pedirLivro`). O mestre não passa isto — o sistema dele já tem os catálogos.
 */
export interface LivroDaFicha {
  /** Quais abas escolhem do livro, antes de ele chegar. */
  resumo: ResumoDoLivro | null
  estado: 'ausente' | 'chegando' | 'pronto' | 'falhou'
  pedir: () => void
}

export type EstadoDaEscolha = 'pronto' | 'chegando' | 'falhou'

export interface EscolherDoLivroProps {
  aba: AbaDoSistema
  sistema: SistemaDeRpg
  itens: readonly ItemEscolhivel[]
  estado: EstadoDaEscolha
  /** Nomes (minúsculos) dos cartões que a aba já tem: o item igual aparece marcado, e continua escolhível. */
  nomesNaFicha: ReadonlySet<string>
  onTentarDeNovo: () => void
  onEscolher: (item: ItemEscolhivel) => void
  onFechar: () => void
}

/** A primeira linha da descrição, sem marcação: o resumo do item na lista. */
function resumoDoItem(item: ItemEscolhivel): string {
  return textoSemMarcacao(item.descricao).split('\n')[0]
}

/**
 * "ESCOLHER DO LIVRO": a lista filtrável do catálogo da aba, aberta logo
 * abaixo dos botões da aba em edição. Escolher copia o item para um cartão
 * novo (`cartaoDoCatalogo`); Esc fecha só a lista, não a ficha.
 */
export function EscolherDoLivro({ aba, sistema, itens, estado, nomesNaFicha, onTentarDeNovo, onEscolher, onFechar }: EscolherDoLivroProps) {
  const [filtro, setFiltro] = useState('')
  const visiveis = useMemo(() => filtrarItens(itens, filtro), [itens, filtro])
  const nome = aba.nome.toLowerCase()

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onFechar()
  }

  return (
    <div className="lb-escolher" role="group" aria-label={`Escolher ${nome} do livro`} onKeyDown={onKeyDown}>
      <div className="lb-escolher__topo">
        <input
          type="search"
          className="lb-input lb-escolher__filtro"
          aria-label={`Filtrar ${nome} do livro`}
          placeholder={`Filtrar ${nome}…`}
          // Abriu a lista para escolher: o filtro é o primeiro passo.
          autoFocus
          value={filtro}
          onChange={(event) => setFiltro(event.target.value)}
        />
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onFechar}>
          Fechar
        </button>
      </div>
      {estado === 'chegando' ? (
        <p className="lb-escolher__aviso" role="status">
          Trazendo o livro da mesa…
        </p>
      ) : estado === 'falhou' ? (
        <p className="lb-escolher__aviso" role="alert">
          Não deu para trazer o livro da mesa.{' '}
          <button type="button" className="lb-btn lb-btn--compact" onClick={onTentarDeNovo}>
            Tentar de novo
          </button>
        </p>
      ) : visiveis.length === 0 ? (
        <p className="lb-escolher__aviso">{itens.length === 0 ? `O livro não tem ${nome}.` : `Nada em ${aba.nome} com esse filtro.`}</p>
      ) : (
        <ul className="lb-escolher__lista" aria-label={`${aba.nome} do livro`}>
          {visiveis.map((item) => {
            const atributos = 'atributos' in item ? atributosAbreviados(sistema, item.atributos) : ''
            const resumo = resumoDoItem(item)
            const naFicha = nomesNaFicha.has(item.nome.toLocaleLowerCase('pt-BR'))
            return (
              <li key={item.nome}>
                <button type="button" className="lb-escolher__item" onClick={() => onEscolher(item)}>
                  <span className="lb-escolher__nome">
                    {item.nome}
                    {atributos.length > 0 && <span className="lb-escolher__atributos">{atributos}</span>}
                    {naFicha && <span className="lb-escolher__ja">já na ficha</span>}
                  </span>
                  {resumo.length > 0 && <span className="lb-escolher__resumo">{resumo}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
