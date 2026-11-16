import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react'
import { useEditor, useValue, type TLShapeId } from 'tldraw'
import type { Verbete } from '../../lib/preparo/tipos'
import { urlDaMidia } from '../midia'
import { copiarImagem } from './atalhosDoQuadro'
import { verbeteDoCartao } from './cartaoSemTldraw'
import { focarItem, itemEmFoco, ouvirItemEmFoco } from './itemEmFoco'
import type { LadoDaFaixa } from './partesDoCartao'

/**
 * A FAIXA DE ITENS DO LUGAR (Grimório, `FaixaItensCenario.tsx`): o acervo da
 * forma ativa, grudado no cartão. Clique escolhe o item (o Ctrl+C copia a
 * imagem dele); duplo clique abre o verbete do item; o botão de copiar copia a
 * imagem na hora. Pôr e tirar item continua sendo coisa da página do lugar.
 */

/** Quanto tempo o "Copiado" fica no item depois do clique. */
const AVISO_DA_COPIA_MS = 1500

/** Dentro do cartão o tldraw captura o ponteiro: sem isto, o clique arrasta o cartão ou o abre. */
const pararNoCartao = (evento: PointerEvent) => evento.stopPropagation()

const COPIAR = (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <rect x="7" y="7" width="9" height="9" rx="1.5" />
    <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" />
  </svg>
)

export interface ItemDaFaixa {
  readonly itemId: string
  readonly qtd: number
  readonly verbete: Verbete
}

/** Os itens do acervo que ainda existem no Prelúdio (o apagado some da faixa). */
export function itensVivos(acervo: readonly { readonly itemId: string; readonly qtd: number }[] | undefined, verbetes: ReadonlyMap<string, Verbete>): ItemDaFaixa[] {
  const vivos: ItemDaFaixa[] = []
  for (const entrada of acervo ?? []) {
    const verbete = verbeteDoCartao(verbetes, entrada.itemId)
    if (verbete !== undefined) vivos.push({ itemId: entrada.itemId, qtd: entrada.qtd, verbete })
  }
  return vivos
}

/** "Lâmina · 3× · resumo", sem as partes vazias. */
function rotuloDoItem(item: ItemDaFaixa): string {
  const forma = item.verbete.formas.find((cada) => cada.id === item.verbete.formaAtivaId) ?? item.verbete.formas[0]
  return [item.verbete.titulo || 'Sem nome', item.qtd > 1 ? `${item.qtd}×` : '', forma?.resumo.trim() ?? ''].filter(Boolean).join(' · ')
}

interface FaixaProps {
  readonly shapeId: TLShapeId
  readonly itens: readonly ItemDaFaixa[]
  readonly lado: Exclude<LadoDaFaixa, 'oculta'>
  readonly raiz: string | null
  readonly aoAbrir: (verbete: Verbete) => void
}

export function FaixaDeItens({ shapeId, itens, lado, raiz, aoAbrir }: FaixaProps) {
  const editor = useEditor()
  const foco = useSyncExternalStore(ouvirItemEmFoco, itemEmFoco)
  const [copia, setCopia] = useState<{ readonly itemId: string; readonly ok: boolean } | null>(null)
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null)
  const faixa = useRef<HTMLDivElement>(null)
  const escolhido = foco?.formaId === shapeId ? foco.itemId : null
  const cartaoSelecionado = useValue('cartão da faixa selecionado', () => editor.getSelectedShapeIds().includes(shapeId), [editor, shapeId])
  const naFaixa = escolhido !== null && itens.some((item) => item.itemId === escolhido)

  // O foco só vale com o cartão selecionado e o item ainda na faixa: senão um Ctrl+C mais tarde copiaria um item esquecido.
  useEffect(() => {
    if (escolhido !== null && (!cartaoSelecionado || !naFaixa)) focarItem(null)
  }, [cartaoSelecionado, escolhido, naFaixa])

  // A faixa deitada rola para o lado, mas a roda comum só manda deltaY: sem converter, os itens além da largura ficam fora de alcance.
  useEffect(() => {
    const elemento = faixa.current
    if (elemento === null || (lado !== 'baixo' && lado !== 'cima')) return
    const aoRolar = (evento: WheelEvent) => {
      if (evento.deltaX === 0) elemento.scrollLeft += evento.deltaY
    }
    elemento.addEventListener('wheel', aoRolar, { passive: true })
    return () => elemento.removeEventListener('wheel', aoRolar)
  }, [lado])

  // Faixa escondida ou cartão apagado: o foco não sobrevive a quem o mostrava.
  useEffect(
    () => () => {
      if (relogio.current !== null) clearTimeout(relogio.current)
      if (itemEmFoco()?.formaId === shapeId) focarItem(null)
    },
    [shapeId],
  )

  const avisarCopia = (itemId: string, ok: boolean) => {
    if (relogio.current !== null) clearTimeout(relogio.current)
    setCopia({ itemId, ok })
    relogio.current = setTimeout(() => setCopia(null), AVISO_DA_COPIA_MS)
  }

  return (
    // O ponteiro para na faixa inteira: arrastar a barra de rolagem não arrasta o cartão.
    <div ref={faixa} className={`pr-faixa pr-faixa--${lado}`} onPointerDown={pararNoCartao}>
      {itens.length === 0 ? (
        <p className="pr-faixa__vazia">Sem itens no acervo</p>
      ) : (
        itens.map((item) => {
          const forma = item.verbete.formas.find((cada) => cada.id === item.verbete.formaAtivaId) ?? item.verbete.formas[0]
          const imagem = raiz === null ? null : urlDaMidia(raiz, forma?.retrato)
          const nome = item.verbete.titulo || 'Sem nome'
          const aviso = copia?.itemId === item.itemId ? copia : null
          return (
            <div key={item.itemId} className={`pr-faixa__item${escolhido === item.itemId ? ' pr-faixa__item--foco' : ''}`} title={rotuloDoItem(item)}>
              <button
                type="button"
                className="pr-faixa__arte"
                aria-label={`${nome}${item.qtd > 1 ? `, ${item.qtd} unidades` : ''} (duplo clique abre o verbete)`}
                aria-pressed={escolhido === item.itemId}
                onClick={() => {
                  editor.select(shapeId)
                  focarItem({ formaId: shapeId, itemId: item.itemId })
                }}
                onDoubleClick={() => aoAbrir(item.verbete)}
              >
                {imagem === null ? <span className="pr-faixa__inicial">{nome.charAt(0).toUpperCase()}</span> : <img src={imagem} alt="" draggable={false} />}
                {item.qtd > 1 && (
                  <span className="pr-faixa__qtd" aria-hidden="true">
                    {item.qtd}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="pr-faixa__copiar"
                disabled={imagem === null}
                aria-label={`Copiar a imagem de ${nome}`}
                title={imagem === null ? 'Item sem imagem' : 'Copiar a imagem'}
                onClick={() => {
                  if (imagem === null) return
                  copiarImagem(imagem).then(
                    () => avisarCopia(item.itemId, true),
                    () => avisarCopia(item.itemId, false),
                  )
                }}
              >
                {COPIAR}
              </button>
              {aviso !== null && (
                <span className={`pr-faixa__aviso${aviso.ok ? '' : ' pr-faixa__aviso--falhou'}`} role="status">
                  {aviso.ok ? 'Copiado' : 'Falhou'}
                </span>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
