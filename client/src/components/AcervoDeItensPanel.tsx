import { useEffect, useId, useState, type FormEvent } from 'react'
import { categoriaLimpa, novoItemDoCatalogo, type ItemDoCatalogo } from '../lib/acervoDeItens'
import { escolherImagemDoItem, imagemDoItemDoBlob } from '../lib/imagemDoItem'
import type { AlvoDoAcervo } from '../lib/party'
import { useAcervoDeItensStore } from '../stores/acervoDeItensStore'
import { BotaoMais } from './BotaoMais'
import { ImagemOuIniciais } from './FichaPecas'
import { ItemDoCatalogoDialog } from './ItemDoCatalogoDialog'
import './AcervoDeItensPanel.css'

/**
 * ACERVO DE ITENS (entrega 4) — a categoria "Itens" logo abaixo dos tokens no
 * acervo do mestre. Do APP, como os tokens: o mesmo item serve a todas as
 * aventuras. Uma grade por categoria; tocar um item abre a janela dele
 * (editar e "Dar a…"). "+ Item" cria; "Categorias" edita a lista que o campo
 * de categoria sugere.
 */

export interface AcervoDeItensPanelProps {
  /** Quem pode receber: tokens ligados a personagem (e os de jogador ainda sem ficha), nas cenas carregadas. */
  alvos: readonly AlvoDoAcervo[]
  /** Dá o item; `false` = não deu (o token saiu da cena). */
  onDar: (item: ItemDoCatalogo, alvo: AlvoDoAcervo, quantidade: number) => boolean
  /** Erro de gravação que a tela não mostra no lugar (o toast do app). */
  onErro?: (mensagem: string) => void
}

export const ITENS_VAZIO = 'Nenhum item no acervo ainda.'
export const ITENS_COMO_ENCHER = 'Crie um item para dar aos personagens.'
export const ITENS_SO_NO_APP = 'O acervo de itens mora no aplicativo instalado.'
const SEM_CATEGORIA = 'Sem categoria'

/** Os itens por categoria, na ordem da lista do acervo; categoria fora da lista vem depois, e sem categoria por último. */
export function itensPorCategoria(itens: readonly ItemDoCatalogo[], categorias: readonly string[]): { categoria: string; itens: ItemDoCatalogo[] }[] {
  const grupos = new Map<string, ItemDoCatalogo[]>()
  for (const item of itens) {
    const chave = item.categoria === '' ? SEM_CATEGORIA : item.categoria
    grupos.set(chave, [...(grupos.get(chave) ?? []), item])
  }
  const ordem = [...categorias.filter((categoria) => grupos.has(categoria)), ...[...grupos.keys()].filter((chave) => chave !== SEM_CATEGORIA && !categorias.includes(chave))]
  if (grupos.has(SEM_CATEGORIA)) ordem.push(SEM_CATEGORIA)
  return ordem.map((categoria) => ({ categoria, itens: grupos.get(categoria) ?? [] }))
}

export function AcervoDeItensPanel({ alvos, onDar, onErro }: AcervoDeItensPanelProps) {
  const tituloId = useId()
  const itens = useAcervoDeItensStore((state) => state.itens)
  const categorias = useAcervoDeItensStore((state) => state.categorias)
  const aviso = useAcervoDeItensStore((state) => state.aviso)
  const podeGravar = useAcervoDeItensStore((state) => state.podeGravar)
  /** O item aberto: o id de um gravado, ou o novo ainda fora do acervo. */
  const [aberto, setAberto] = useState<{ id: string } | { novo: ItemDoCatalogo } | null>(null)
  const [editandoCategorias, setEditandoCategorias] = useState(false)

  useEffect(() => {
    void useAcervoDeItensStore.getState().recarregar()
  }, [])

  const itemAberto = aberto === null ? undefined : 'novo' in aberto ? aberto.novo : itens.find((item) => item.id === aberto.id)
  const grupos = itensPorCategoria(itens, categorias)

  return (
    <section className="lb-section lb-itens" aria-labelledby={tituloId}>
      <div className="lb-acervo__topo">
        <h2 id={tituloId} className="lb-eyebrow">
          Itens
        </h2>
        {podeGravar && (
          <div className="lb-acervo__acoes-topo">
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-expanded={editandoCategorias} onClick={() => setEditandoCategorias(!editandoCategorias)}>
              Categorias
            </button>
            <BotaoMais nome="Novo item" texto="Item" dica="Cadastra um item no acervo do app" onClick={() => setAberto({ novo: novoItemDoCatalogo() })} />
          </div>
        )}
      </div>
      {aviso !== null && (
        <p className="lb-acervo__aviso" role="status">
          {aviso}
        </p>
      )}
      {editandoCategorias && podeGravar && <EditorDeCategorias categorias={categorias} onErro={onErro} />}
      {itens.length === 0 ? (
        <p className="lb-acervo__vazio-estado">
          <span>{ITENS_VAZIO}</span> <span>{podeGravar ? ITENS_COMO_ENCHER : ITENS_SO_NO_APP}</span>
        </p>
      ) : (
        <div className="lb-itens__grupos">
          {grupos.map((grupo) => (
            <div key={grupo.categoria} className="lb-itens__grupo" role="group" aria-label={grupo.categoria}>
              <p className="lb-itens__categoria">
                {grupo.categoria}
                <span className="lb-acervo__contagem" aria-hidden="true">
                  {grupo.itens.length}
                </span>
              </p>
              <ul className="lb-itens__grade">
                {grupo.itens.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="lb-itens__item" aria-label={`Abrir ${item.nome}`} title={item.nome} onClick={() => setAberto({ id: item.id })}>
                      <span className="lb-itens__foto">
                        <ImagemOuIniciais imagem={item.imagem} nome={item.nome} />
                      </span>
                      <span className="lb-itens__nome">{item.nome}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {itemAberto !== undefined && aberto !== null && (
        <ItemDoCatalogoDialog
          key={itemAberto.id}
          item={itemAberto}
          novo={'novo' in aberto}
          categorias={categorias}
          alvos={alvos}
          onSalvar={(item) => useAcervoDeItensStore.getState().salvarItem(item)}
          onApagar={() => useAcervoDeItensStore.getState().apagarItem(itemAberto.id)}
          onDar={(alvo, quantidade) => onDar(itemAberto, alvo, quantidade)}
          onClose={() => setAberto(null)}
          imagemDoBlob={imagemDoItemDoBlob}
          escolherImagem={escolherImagemDoItem}
        />
      )}
    </section>
  )
}

/** A lista editável de categorias: tirar (×) e acrescentar. O item que usa uma categoria tirada continua com ela. */
function EditorDeCategorias({ categorias, onErro }: { categorias: readonly string[]; onErro?: (mensagem: string) => void }) {
  const [nova, setNova] = useState('')
  const gravar = (lista: readonly string[]) => {
    useAcervoDeItensStore
      .getState()
      .definirCategorias(lista)
      .catch((erro: unknown) => onErro?.(erro instanceof Error ? erro.message : String(erro)))
  }
  const acrescentar = (event: FormEvent) => {
    event.preventDefault()
    const limpa = categoriaLimpa(nova)
    if (limpa === '') return
    gravar([...categorias, limpa])
    setNova('')
  }
  return (
    <div className="lb-itens__categorias">
      <ul className="lb-itens__chips" aria-label="Categorias do acervo">
        {categorias.map((categoria) => (
          <li key={categoria} className="lb-itens__chip">
            {categoria}
            <button type="button" className="lb-itens__tirar" aria-label={`Tirar a categoria ${categoria}`} onClick={() => gravar(categorias.filter((outra) => outra !== categoria))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <form className="lb-itens__nova" onSubmit={acrescentar}>
        <input className="lb-input" aria-label="Nova categoria" placeholder="Nova categoria" value={nova} onChange={(event) => setNova(event.target.value)} />
        <button type="submit" className="lb-btn lb-btn--compact">
          Acrescentar
        </button>
      </form>
    </div>
  )
}
