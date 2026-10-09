import { useEffect, useId, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { categoriaLimpa, novoItemDoCatalogo, type ItemDoCatalogo } from '../lib/acervoDeItens'
import { escolherImagemDoItem, imagemDoItemDoBlob } from '../lib/imagemDoItem'
import type { AlvoDoAcervo } from '../lib/party'
import { useAcervoDeItensStore } from '../stores/acervoDeItensStore'
import { BotaoMais } from './BotaoMais'
import { ImagemOuIniciais } from './FichaPecas'
import { ItemDoCatalogoDialog } from './ItemDoCatalogoDialog'
import './AcervoDeItensPanel.css'
import './TokenLibraryPanel.css'

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
  /**
   * ITEM NO MAPA (entrega 5): o item foi ARRASTADO e solto neste ponto da tela
   * (px de janela). `comoPino` = o Alt estava apertado ao soltar: pino de item
   * em vez da imagem no chão. Quem monta a tela decide se ali é o mapa e
   * devolve `true` quando pôs. Ausente = o item não se arrasta.
   */
  onSoltarNoMapa?: (item: ItemDoCatalogo, clientX: number, clientY: number, comoPino: boolean) => boolean
}

/** Quanto o ponteiro anda antes de o aperto virar arrasto (o mesmo do acervo de tokens). */
const LIMIAR_DO_ARRASTO_PX = 6

/** O que a linha de ajuda diz: o gesto e o modificador, que de outro jeito ninguém descobre. */
export const DICA_DO_ARRASTO = 'Arraste um item até o mapa para pô-lo no chão; com Alt, vira pino.'

/** Leva o fantasma ao ponteiro, centrado nele. Estilo direto: sem render do React por quadro. */
function posicionarFantasma(fantasma: HTMLElement, ponto: { x: number; y: number }): void {
  fantasma.style.transform = `translate(${ponto.x}px, ${ponto.y}px) translate(-50%, -50%)`
}

/**
 * O arrasto de um item da grade até o mapa, no molde do acervo de tokens
 * (`TokenLibraryPanel`): de ponteiro, não o drag-and-drop do HTML — o alvo é o
 * canvas do Pixi, que não fala `dragover`/`drop`. Durante o gesto só o
 * fantasma se move (estilo direto) e a grade não re-renderiza; Esc ou soltar
 * fora do mapa desiste sem pôr nada. O clique que o navegador manda depois do
 * arrasto é engolido: soltar não abre a janela do item.
 */
function useArrastoAoMapa(onSoltar: AcervoDeItensPanelProps['onSoltarNoMapa']) {
  const [arrastado, setArrastado] = useState<ItemDoCatalogo | null>(null)
  const fantasmaRef = useRef<HTMLDivElement | null>(null)
  const pontoRef = useRef({ x: 0, y: 0 })
  const engolirCliqueRef = useRef(false)
  const soltarOuvintesRef = useRef<(() => void) | null>(null)

  // Painel desmontado no meio do arrasto: os ouvintes de janela não podem sobreviver a ele.
  useEffect(() => () => soltarOuvintesRef.current?.(), [])

  const comecar = (event: ReactPointerEvent<HTMLButtonElement>, item: ItemDoCatalogo) => {
    if (onSoltar === undefined || event.button !== 0 || !event.isPrimary) return
    soltarOuvintesRef.current?.()
    engolirCliqueRef.current = false
    const pointerId = event.pointerId
    const inicio = { x: event.clientX, y: event.clientY }
    let arrastando = false
    let cancelado = false

    const mover = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || cancelado) return
      pontoRef.current = { x: e.clientX, y: e.clientY }
      if (!arrastando) {
        if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < LIMIAR_DO_ARRASTO_PX) return
        arrastando = true
        setArrastado(item)
      }
      if (fantasmaRef.current !== null) posicionarFantasma(fantasmaRef.current, pontoRef.current)
    }
    const encerrar = (e: PointerEvent, soltou: boolean) => {
      if (e.pointerId !== pointerId) return
      soltarOuvintesRef.current?.()
      if (!arrastando) return
      setArrastado(null)
      // O `click` chega logo depois deste `pointerup`; o `setTimeout` libera o próximo clique de verdade.
      engolirCliqueRef.current = true
      setTimeout(() => {
        engolirCliqueRef.current = false
      }, 0)
      if (soltou && !cancelado) onSoltar(item, e.clientX, e.clientY, e.altKey)
    }
    const aoSoltar = (e: PointerEvent) => encerrar(e, true)
    const aoCancelar = (e: PointerEvent) => encerrar(e, false)
    // Esc desiste, na CAPTURA e parando ali: no mapa ele largaria a seleção.
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !arrastando || cancelado) return
      e.preventDefault()
      e.stopImmediatePropagation()
      cancelado = true
      setArrastado(null)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('pointercancel', aoCancelar)
    window.addEventListener('keydown', aoTeclar, true)
    soltarOuvintesRef.current = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoCancelar)
      window.removeEventListener('keydown', aoTeclar, true)
      soltarOuvintesRef.current = null
    }
  }

  const fantasma =
    arrastado === null
      ? null
      : createPortal(
          <div
            className="lb-acervo__fantasma"
            aria-hidden="true"
            ref={(el) => {
              fantasmaRef.current = el
              if (el !== null) posicionarFantasma(el, pontoRef.current)
            }}
          >
            <span className="lb-itens__foto lb-itens__fantasma-foto">
              <ImagemOuIniciais imagem={arrastado.imagem} nome={arrastado.nome} />
            </span>
            <span>{arrastado.nome}</span>
          </div>,
          document.body,
        )

  return { comecar, fantasma, engolirClique: () => engolirCliqueRef.current }
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

export function AcervoDeItensPanel({ alvos, onDar, onErro, onSoltarNoMapa }: AcervoDeItensPanelProps) {
  const tituloId = useId()
  const arrasto = useArrastoAoMapa(onSoltarNoMapa)
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
          {onSoltarNoMapa !== undefined && <p className="lb-label lb-itens__dica">{DICA_DO_ARRASTO}</p>}
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
                    <button
                      type="button"
                      className="lb-itens__item"
                      aria-label={`Abrir ${item.nome}`}
                      title={item.nome}
                      onPointerDown={(event) => arrasto.comecar(event, item)}
                      // A foto do item é <img>: sem isto o navegador arrasta a imagem
                      // dele, solta um `pointercancel` e o nosso arrasto morre no caminho.
                      onDragStart={(event) => event.preventDefault()}
                      onClick={() => {
                        // Acabou de soltar no mapa: o clique do mesmo gesto não abre a janela.
                        if (arrasto.engolirClique()) return
                        setAberto({ id: item.id })
                      }}
                    >
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
      {arrasto.fantasma}
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
