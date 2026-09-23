import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { ItemDoAcervoNaTela } from '../lib/tokenLibrary'

export interface TokenLibraryPanelProps {
  itens: readonly ItemDoAcervoNaTela[]
  /** Frase de `listarAcervo` quando o acervo não pôde ser lido; `null` = tudo certo. */
  aviso: string | null
  /** Coloca uma cópia do item no mapa aberto, com o nome e a foto dele. */
  onPlace: (item: ItemDoAcervoNaTela) => void
  /**
   * O item foi ARRASTADO e solto neste ponto da tela (px de janela). Quem
   * monta a tela decide se ali é o mapa: devolve `true` quando pôs a ficha,
   * `false` quando o ponto não aceita (painel, barra) e nada acontece.
   */
  onDropOnMap: (item: ItemDoAcervoNaTela, clientX: number, clientY: number) => boolean
  /** Apaga do disco. O componente só chama depois da confirmação. */
  onDelete: (item: ItemDoAcervoNaTela) => void
}

/** Texto do estado vazio — é o que a pessoa lê antes de salvar o primeiro NPC. */
export const ACERVO_VAZIO = 'Nenhum token no acervo ainda.'

/**
 * Como a estante enche, dito no estado vazio (achado 12 do passeio de
 * 20/09/2026). "Adicionar token" põe a peça no MAPA, sem foto, e o acervo só
 * guarda token COM foto (`guardarNoAcervo` recusa sem ela) — quem adicionava
 * um token esperava vê-lo aqui e só lia "Nenhum token". A frase nomeia os
 * botões pelo rótulo que eles têm na tela.
 */
export const ACERVO_COMO_ENCHER =
  'O acervo guarda tokens com foto: selecione um token no mapa, escolha uma imagem para ele e clique em “Salvar no acervo”.'

/** Quanto o ponteiro anda (px) antes de o aperto virar arrasto; abaixo disso é clique. */
const LIMIAR_DO_ARRASTO_PX = 6

/**
 * Caminho do disco → referência que o `<img>` carrega.
 *
 * `convertFileSrc` é a ponte de asset do Tauri e não existe no navegador: o
 * painel continua montado lá (com os itens vazios), e um `throw` aqui derrubaria
 * a tela inteira por causa de uma miniatura. Mesmo cuidado de
 * `pixi/tokensRenderer.ts` com `convertFileSrc(undefined)`.
 */
function fonteDaFoto(caminho: string): string | null {
  try {
    return convertFileSrc(caminho)
  } catch {
    return null
  }
}

/** Leva o fantasma ao ponteiro, centrado nele. Estilo direto: sem render do React por quadro. */
function posicionarFantasma(fantasma: HTMLElement, ponto: { x: number; y: number }): void {
  fantasma.style.transform = `translate(${ponto.x}px, ${ponto.y}px) translate(-50%, -50%)`
}

/** O aperto em curso sobre um nome da estante. */
interface ApertoNoItem {
  item: ItemDoAcervoNaTela
  pointerId: number
  inicio: { x: number; y: number }
  /** Passou do limiar: é arrasto, não clique. */
  arrastando: boolean
  /** Esc no meio do arrasto: o soltar seguinte não põe nada. */
  cancelado: boolean
}

/**
 * ACERVO DE TOKENS PRONTOS — a estante de NPCs do mestre.
 *
 * Nas palavras do usuário (18/09/2026): "eu queria que eu pudesse salvar Tokens
 * pre prontos, tipos tokens de npcs e afins para colocar para os jogadores".
 * Salvou o goblin uma vez, ele fica em QUALQUER mapa.
 *
 * Fica FORA do gate de `ToolPropertiesSection`: o acervo não é propriedade da
 * ferramenta nem da seleção, e esconder a estante quando nada está selecionado
 * é justamente esconder no momento em que a pessoa vai pegar o NPC.
 *
 * DOIS JEITOS DE PÔR NO MAPA: o clique no nome (e Enter/Espaço, pelo teclado)
 * põe a peça no centro da vista; ARRASTAR o nome até o mapa a põe onde o
 * ponteiro soltar (achado 12 do passeio de 20/09/2026). O arrasto é de
 * ponteiro, não o drag-and-drop do HTML: o alvo é o canvas do Pixi, que não
 * fala `dragover`/`drop`. Durante o gesto só o fantasma se move (estilo
 * direto); a lista não re-renderiza a cada quadro. Soltar fora do mapa ou
 * apertar Esc desiste sem pôr nada.
 *
 * APAGAR PERGUNTA ANTES, e a pergunta mora aqui em vez de num `confirm()` do
 * navegador: diálogo nativo BLOQUEIA o webview do Tauri e já travou sessão de
 * automação neste projeto. O botão de confirmar repete o nome do item — "Apagar
 * Goblin para sempre" — porque é a última chance de ver que se clicou na linha
 * errada.
 */
export function TokenLibraryPanel({ itens, aviso, onPlace, onDropOnMap, onDelete }: TokenLibraryPanelProps) {
  /** `id` do item cuja pergunta "apagar mesmo?" está aberta; `null` = nenhuma. */
  const [confirmando, setConfirmando] = useState<string | null>(null)
  /** Item sendo arrastado — só liga e desliga o fantasma, duas vezes por gesto. */
  const [arrastado, setArrastado] = useState<ItemDoAcervoNaTela | null>(null)
  const apertoRef = useRef<ApertoNoItem | null>(null)
  const ultimoPontoRef = useRef({ x: 0, y: 0 })
  const fantasmaRef = useRef<HTMLDivElement | null>(null)
  /** O gesto que acabou foi arrasto: o `click` que o navegador ainda manda não põe a peça de novo no centro. */
  const engolirCliqueRef = useRef(false)
  /** Desliga os ouvintes de janela do gesto em curso; `null` sem gesto. */
  const soltarOuvintesRef = useRef<(() => void) | null>(null)

  // Painel desmontado no meio do arrasto (troca de aba): os ouvintes de janela
  // não podem sobreviver a ele.
  useEffect(() => () => soltarOuvintesRef.current?.(), [])

  const comecarAperto = (event: ReactPointerEvent<HTMLButtonElement>, item: ItemDoAcervoNaTela) => {
    if (event.button !== 0 || !event.isPrimary) return
    soltarOuvintesRef.current?.()
    engolirCliqueRef.current = false
    apertoRef.current = {
      item,
      pointerId: event.pointerId,
      inicio: { x: event.clientX, y: event.clientY },
      arrastando: false,
      cancelado: false,
    }

    const mover = (e: PointerEvent) => {
      const aperto = apertoRef.current
      if (aperto === null || e.pointerId !== aperto.pointerId || aperto.cancelado) return
      ultimoPontoRef.current = { x: e.clientX, y: e.clientY }
      if (!aperto.arrastando) {
        if (Math.hypot(e.clientX - aperto.inicio.x, e.clientY - aperto.inicio.y) < LIMIAR_DO_ARRASTO_PX) return
        aperto.arrastando = true
        setArrastado(aperto.item)
      }
      if (fantasmaRef.current !== null) posicionarFantasma(fantasmaRef.current, ultimoPontoRef.current)
    }

    const encerrar = (e: PointerEvent, soltou: boolean) => {
      const aperto = apertoRef.current
      if (aperto === null || e.pointerId !== aperto.pointerId) return
      soltarOuvintesRef.current?.()
      apertoRef.current = null
      if (!aperto.arrastando) return
      setArrastado(null)
      // O `click` (quando há) chega logo depois deste `pointerup`, na mesma
      // volta do laço de eventos; o `setTimeout` libera o próximo clique de
      // verdade — inclusive o Enter do teclado, que não passa por aqui.
      engolirCliqueRef.current = true
      setTimeout(() => {
        engolirCliqueRef.current = false
      }, 0)
      if (soltou && !aperto.cancelado) onDropOnMap(aperto.item, e.clientX, e.clientY)
    }
    const aoSoltar = (e: PointerEvent) => encerrar(e, true)
    const aoCancelar = (e: PointerEvent) => encerrar(e, false)

    // Esc desiste do arrasto. Na CAPTURA e parando ali: o mesmo Esc, chegando
    // ao mapa, largaria a seleção e o rascunho — e a pessoa só quis soltar a
    // peça que tinha na mão.
    const aoTeclar = (e: KeyboardEvent) => {
      const aperto = apertoRef.current
      if (e.key !== 'Escape' || aperto === null || !aperto.arrastando || aperto.cancelado) return
      e.preventDefault()
      e.stopImmediatePropagation()
      aperto.cancelado = true
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

  const fotoDoArrastado = arrastado !== null && arrastado.imagemNoDisco ? fonteDaFoto(arrastado.caminho) : null

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Acervo de tokens</h2>
      {aviso !== null && (
        // `role="status"`: quem usa leitor de tela ouve o aviso sem ter de
        // caçá-lo, e ele não rouba o foco de onde a pessoa está.
        <p className="lb-acervo__aviso" role="status">
          {aviso}
        </p>
      )}
      {itens.length === 0 ? (
        <>
          <p className="lb-acervo__vazio">{ACERVO_VAZIO}</p>
          <p className="lb-acervo__vazio">{ACERVO_COMO_ENCHER}</p>
        </>
      ) : (
        <ul className="lb-acervo">
          {itens.map((item) => (
            <li key={item.id} className="lb-acervo__item">
              {item.imagemNoDisco && fonteDaFoto(item.caminho) !== null ? (
                <img className="lb-acervo__foto" src={fonteDaFoto(item.caminho) ?? ''} alt={`Foto de ${item.nome}`} />
              ) : (
                // Imagem sumida do disco não apaga o item: o nome que a pessoa
                // deu vale mais que o arquivo, e ela ainda pode colocar o token
                // no mapa (sem foto) ou apagar a linha.
                <span className="lb-acervo__foto lb-acervo__foto--vazia" aria-hidden="true" />
              )}
              <button
                type="button"
                className="lb-acervo__nome"
                aria-label={`Colocar ${item.nome} no mapa`}
                title="Clique para pôr no centro da vista, ou arraste até o mapa"
                onPointerDown={(event) => comecarAperto(event, item)}
                onClick={() => {
                  if (engolirCliqueRef.current) return
                  onPlace(item)
                }}
              >
                {item.nome}
              </button>
              {confirmando === item.id ? (
                <span className="lb-acervo__confirma">
                  <button type="button" className="lb-btn lb-btn--ghost" onClick={() => setConfirmando(null)}>
                    Manter no acervo
                  </button>
                  <button
                    type="button"
                    className="lb-btn lb-btn--danger"
                    onClick={() => {
                      setConfirmando(null)
                      onDelete(item)
                    }}
                  >
                    {`Apagar ${item.nome} para sempre`}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="lb-acervo__apagar"
                  aria-label={`Apagar ${item.nome} do acervo`}
                  onClick={() => setConfirmando(item.id)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {arrastado !== null &&
        // Portal no `body`: o rail tem rolagem e recorte, e o fantasma precisa
        // andar por cima do mapa inteiro. `aria-hidden`: é eco visual do gesto,
        // o leitor de tela já tem o botão.
        createPortal(
          <div
            className="lb-acervo__fantasma"
            aria-hidden="true"
            ref={(el) => {
              fantasmaRef.current = el
              if (el !== null) posicionarFantasma(el, ultimoPontoRef.current)
            }}
          >
            {fotoDoArrastado !== null ? (
              <img className="lb-acervo__foto" src={fotoDoArrastado} alt="" />
            ) : (
              <span className="lb-acervo__foto lb-acervo__foto--vazia" />
            )}
            <span>{arrastado.nome}</span>
          </div>,
          document.body,
        )}
    </section>
  )
}
