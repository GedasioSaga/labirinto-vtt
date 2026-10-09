import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { quantidadeDe } from '../lib/items'
import type { CarriedItem } from '../types/map'
import { ImagemOuIniciais } from './FichaPecas'
import './InventarioDaFicha.css'

/**
 * INVENTÁRIO DO PERSONAGEM, na ficha (entrega 4): a mochila do token ligado
 * ao personagem — UMA coisa só, a mesma que o "Pegar", o "Dar a…", a loja e a
 * troca já mexem. Grade de imagens com o selo da quantidade; tocar uma vaga
 * abre o item grande, com a descrição e as ações que a tela de quem olha
 * oferece (o mestre tira e larga no chão; o jogador dá a um colega).
 *
 * O detalhe abre NO LUGAR, logo abaixo da grade, e não numa janela por cima:
 * a ficha já é uma janela, e o Esc dentro do detalhe fecha só o detalhe.
 */

export interface InventarioDaFichaProps {
  itens: readonly CarriedItem[]
  /** As ações do item aberto; `fechar` volta à grade (o item saiu da mochila). Ausente = só lê. */
  acoes?: (item: CarriedItem, fechar: () => void) => ReactNode
  /** O que a grade vazia diz; o padrão serve ao mestre e ao jogador. */
  vazio?: string
}

const VAZIO_PADRAO = 'Nada no inventário.'

/** "120 berries" com o separador de milhar do Brasil. */
export function precoEmBerries(preco: number): string {
  return `${preco.toLocaleString('pt-BR')} ${preco === 1 ? 'berry' : 'berries'}`
}

/** O nome que o leitor de tela ouve na vaga: "Poção, 3". */
function rotuloDaVaga(item: CarriedItem): string {
  const quantidade = quantidadeDe(item)
  return quantidade > 1 ? `${item.nome}, ${quantidade}` : item.nome
}

export function InventarioDaFicha({ itens, acoes, vazio = VAZIO_PADRAO }: InventarioDaFichaProps) {
  const tituloId = useId()
  const [abertoId, setAbertoId] = useState<string | null>(null)
  // O item pode sair da mochila com o detalhe aberto (o mestre tirou, o jogador deu): a grade volta sozinha.
  const aberto = abertoId === null ? undefined : itens.find((item) => item.id === abertoId)
  const total = itens.reduce((soma, item) => soma + quantidadeDe(item), 0)
  const fechar = () => setAbertoId(null)

  const teclaNoDetalhe = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    // Só o detalhe: sem isto o mesmo Esc fecharia a ficha inteira.
    event.stopPropagation()
    fechar()
  }

  return (
    <section className="lb-inv" aria-labelledby={tituloId}>
      <h3 id={tituloId} className="lb-inv__titulo">
        Inventário{' '}
        <span className="lb-inv__conta" aria-label={`${total} ${total === 1 ? 'item' : 'itens'}`}>
          {total}
        </span>
      </h3>
      {itens.length === 0 ? (
        <p className="lb-inv__vazio">{vazio}</p>
      ) : (
        <ul className="lb-inv__grade">
          {itens.map((item) => {
            const quantidade = quantidadeDe(item)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="lb-inv__vaga"
                  aria-label={rotuloDaVaga(item)}
                  aria-pressed={item.id === abertoId}
                  title={item.nome}
                  onClick={() => setAbertoId((atual) => (atual === item.id ? null : item.id))}
                >
                  <span className="lb-inv__imagem">
                    <ImagemOuIniciais imagem={item.imagem} nome={item.nome} />
                  </span>
                  {quantidade > 1 && (
                    <span className="lb-inv__qtd" aria-hidden="true">
                      ×{quantidade}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {aberto !== undefined && (
        <div className="lb-inv__detalhe" role="region" aria-label={`Item: ${aberto.nome}`} onKeyDown={teclaNoDetalhe}>
          <div className="lb-inv__grande">
            <ImagemOuIniciais imagem={aberto.imagem} nome={aberto.nome} alt={aberto.nome} />
          </div>
          <div className="lb-inv__texto">
            <p className="lb-inv__nome">
              {aberto.nome}
              {quantidadeDe(aberto) > 1 && <span className="lb-inv__nome-qtd"> ×{quantidadeDe(aberto)}</span>}
            </p>
            {(aberto.categoria !== undefined || aberto.preco !== undefined) && (
              <p className="lb-inv__meta">
                {aberto.categoria !== undefined && <span className="lb-ficha__chip">{aberto.categoria}</span>}
                {aberto.preco !== undefined && <span className="lb-inv__preco">{precoEmBerries(aberto.preco)}</span>}
              </p>
            )}
            {aberto.descricao !== undefined && <p className="lb-inv__descricao">{aberto.descricao}</p>}
            <div className="lb-inv__acoes">
              {acoes?.(aberto, fechar)}
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={fechar}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
