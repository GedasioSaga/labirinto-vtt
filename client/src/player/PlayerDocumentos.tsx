import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { IconeDoPapel } from '../components/documentos/IconeDoPapel'
import { useImagemDaMesa } from '../components/ImagemDaMesa'
import { Papel } from '../documentos/Papel'
import type { DocumentoNaFicha } from '../documentos/tipos'
import { documentoNoPapel, metaDaLinha, type RetanguloNaTela } from './documentosDoJogador'
import { abrirGaveta, abrirLeitura, fecharLeitura } from './movimentoDosDocumentos'
import type { DocumentoAberto } from './playerConnection'
import './PlayerDocumentos.css'

/**
 * DOCUMENTOS NA TELA DO JOGADOR (plano dos puzzles, §2.4; fase D3; protótipo
 * aprovado `docs/design/puzzles/prototipo-v2.html`, aba "Documento no mapa"):
 *
 *  - `BotaoLerPapel`: a pílula "Ler “Título”" nas ações do lugar, com a ficha
 *    dele encostada num papel (a tecla E faz o mesmo);
 *  - `GavetaDeDocumentos`: a lista para reler, aberta pelo "Documentos" da
 *    barra (tecla D);
 *  - `LeituraDoDocumento`: o papel aberto, uma página por vez.
 *
 * O texto chega montado pelo host para ELE (os trechos protegidos já
 * resolvidos); aqui só se desenha, sempre como texto do React, nunca HTML.
 */

/** O que dá para focar dentro da leitura (o Tab dá a volta só aqui dentro). */
const FOCAVEIS = 'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
/** A gaveta fica a esta distância do botão "Documentos" e da borda da janela. */
const FOLGA_DA_GAVETA_PX = 8

function retanguloDe(el: Element | null): RetanguloNaTela | null {
  if (el === null) return null
  const { left, top, width, height } = el.getBoundingClientRect()
  return width > 0 && height > 0 ? { left, top, width, height } : null
}

// ------------------------------------------------------------------ a pílula do lugar

export interface BotaoLerPapelProps {
  titulo: string
  /** `byKeyboard` = Enter/Espaço (a leitura abre sem animação); `de` = o retângulo da pílula (a leitura sai dela). */
  onLer: (byKeyboard: boolean, de: RetanguloNaTela | null) => void
}

/** "Ler “Bilhete na parede” E": a ficha dele encostou num papel do recorte. */
export function BotaoLerPapel({ titulo, onLer }: BotaoLerPapelProps) {
  const nome = titulo.trim() === '' ? 'Sem título' : titulo
  return (
    <button
      type="button"
      className="pp-ler-papel"
      aria-keyshortcuts="E"
      onClick={(event) => onLer(event.detail === 0, retanguloDe(event.currentTarget))}
    >
      <span className="pp-ler-papel__texto">Ler “{nome}”</span>
      <kbd className="pp-ler-papel__tecla" aria-hidden="true">
        E
      </kbd>
    </button>
  )
}

// ------------------------------------------------------------------ a gaveta (a lista para reler)

export interface GavetaDeDocumentosProps {
  linhas: readonly DocumentoNaFicha[]
  /** Aberta pelo teclado (D, ou Enter no botão): entra sem animação. */
  instant: boolean
  /** Um documento da lista: o host manda o texto de novo (o de agora, com os itens de agora). */
  onLer: (docId: string, byKeyboard: boolean) => void
  /** `devolverFoco` = o foco volta ao botão "Documentos" (Esc). */
  onClose: (devolverFoco: boolean) => void
}

/** O botão "Documentos" da barra (`PlayerPanel`): a âncora da gaveta e o alvo do voo. */
export function botaoDosDocumentos(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.pp-docs-btn')
}

export function GavetaDeDocumentos({ linhas, instant, onLer, onClose }: GavetaDeDocumentosProps) {
  const idDoTitulo = useId()
  const gavetaRef = useRef<HTMLDivElement>(null)
  const [posicao, setPosicao] = useState<{ left: number; top: number } | null>(null)

  // Debaixo do botão "Documentos", sem passar da borda direita da janela.
  const posicionar = useCallback(() => {
    const botao = retanguloDe(botaoDosDocumentos())
    const gaveta = gavetaRef.current
    if (botao === null || gaveta === null) return
    const largura = gaveta.offsetWidth
    const left = Math.max(FOLGA_DA_GAVETA_PX, Math.min(botao.left, window.innerWidth - largura - FOLGA_DA_GAVETA_PX))
    setPosicao({ left, top: botao.top + botao.height + FOLGA_DA_GAVETA_PX })
  }, [])

  useLayoutEffect(() => {
    posicionar()
    window.addEventListener('resize', posicionar)
    return () => window.removeEventListener('resize', posicionar)
  }, [posicionar])

  // Entra uma vez, ao abrir; o foco vai ao primeiro documento (ou à gaveta, vazia).
  useEffect(() => {
    const gaveta = gavetaRef.current
    if (gaveta === null) return
    if (!instant) abrirGaveta(gaveta)
    const primeiro = gaveta.querySelector<HTMLElement>('button')
    ;(primeiro ?? gaveta).focus({ preventScroll: true })
    // Só ao abrir: a lista que muda (um "novo" que sai) não rouba o foco de novo.
  }, [])

  // Esc fecha (e devolve o foco ao botão); o toque fora dela também. Com a leitura aberta por cima, o Esc é dela.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[aria-modal="true"]') !== null) return
      event.preventDefault()
      onClose(true)
    }
    const onPointer = (event: PointerEvent) => {
      const alvo = event.target
      if (!(alvo instanceof Node) || document.querySelector('[aria-modal="true"]') !== null) return
      if (gavetaRef.current?.contains(alvo) === true || botaoDosDocumentos()?.contains(alvo) === true) return
      onClose(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [onClose])

  const total = linhas.length
  return (
    <div
      ref={gavetaRef}
      className="pp-docs-gaveta"
      role="dialog"
      aria-labelledby={idDoTitulo}
      tabIndex={-1}
      style={posicao === null ? { visibility: 'hidden' } : { left: posicao.left, top: posicao.top }}
    >
      <div className="pp-docs-gaveta__cab">
        <h2 id={idDoTitulo}>Documentos</h2>
        {total > 0 && <span>{total === 1 ? '1 guardado' : `${total} guardados`}</span>}
      </div>
      <div className="pp-docs-gaveta__corpo">
        {total === 0 ? (
          <p className="pp-docs-gaveta__vazio">Nenhum documento ainda. Os papéis que você lê no mapa ficam guardados aqui para ler de novo.</p>
        ) : (
          <ol className="pp-docs-lista">
            {linhas.map((linha) => (
              <li key={linha.docId}>
                <button
                  type="button"
                  className={`pp-docs-lista__item${linha.novo === true ? ' is-novo' : ''}`}
                  onClick={(event) => onLer(linha.docId, event.detail === 0)}
                >
                  <span className="pp-docs-lista__papel">
                    <IconeDoPapel papel={linha.papel} />
                  </span>
                  <span className="pp-docs-lista__titulo">
                    {linha.titulo.trim() === '' ? 'Sem título' : linha.titulo}
                    {linha.novo === true && <span className="pp-sr-only"> (novo)</span>}
                  </span>
                  <span className="pp-docs-lista__meta">{metaDaLinha(linha)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ a leitura

export interface LeituraDoDocumentoProps {
  aberto: DocumentoAberto
  /** De onde o papel sai ao abrir (o papel tocado no mapa, a pílula); `null` = cresce no lugar. */
  de: RetanguloNaTela | null
  /** Aberta pelo teclado: sem animação na entrada. */
  instant: boolean
  /** Fechou. `rolo` = onde o papel estava (o voo até "Documentos" sai dele); `byKeyboard` = Esc ou Enter (sem voo). */
  onClose: (rolo: RetanguloNaTela | null, byKeyboard: boolean) => void
}

/**
 * O papel aberto, por cima do mapa: as setas (e ←/→) trocam a página, Esc e o
 * véu fecham, o Tab fica aqui dentro e o foco volta a quem abriu. Remonta a
 * cada leitura (`key` = `aberto.id`): a página volta para a primeira.
 */
export function LeituraDoDocumento({ aberto, de, instant, onClose }: LeituraDoDocumentoProps) {
  const resolver = useImagemDaMesa()
  const idDoTitulo = useId()
  const [pagina, setPagina] = useState(0)
  const raizRef = useRef<HTMLDivElement>(null)
  const veuRef = useRef<HTMLDivElement>(null)
  const caixaRef = useRef<HTMLDivElement>(null)
  const roloRef = useRef<HTMLDivElement>(null)
  const anteriorRef = useRef<HTMLButtonElement>(null)
  const proximaRef = useRef<HTMLButtonElement>(null)
  const fecharRef = useRef<HTMLButtonElement>(null)
  const fechando = useRef(false)
  const focoPendente = useRef<'anterior' | 'proxima' | null>(null)
  const papel = documentoNoPapel(aberto.documento)
  const total = papel.paginas.length
  const doMapa = aberto.noMapaId !== undefined

  // Quem estava com o foco antes de abrir: ele volta para lá ao fechar (a pílula, a linha da lista).
  useLayoutEffect(() => {
    const volta = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!instant) abrirLeitura(veuRef.current, roloRef.current, de)
    fecharRef.current?.focus({ preventScroll: true })
    return () => {
      if (volta !== null && volta.isConnected) volta.focus({ preventScroll: true })
    }
    // Só ao abrir: `de` e `instant` são do momento em que a leitura chegou.
  }, [])

  const fechar = useCallback(
    (byKeyboard: boolean) => {
      if (fechando.current) return
      fechando.current = true
      const rolo = retanguloDe(roloRef.current)
      if (byKeyboard) {
        onClose(rolo, true)
        return
      }
      fecharLeitura(caixaRef.current, () => onClose(rolo, false))
    },
    [onClose],
  )

  const trocarPagina = useCallback(
    (passo: -1 | 1) => {
      const nova = Math.min(Math.max(0, pagina + passo), total - 1)
      if (nova === pagina) return
      setPagina(nova)
      roloRef.current?.scrollTo({ top: 0 })
      // O botão que chegou na ponta fica desligado: o foco passa para o outro, sem cair no fundo da
      // página. Depois do desenho (`focoPendente`): agora o outro ainda está desligado e não aceita foco.
      const noFim = (passo === 1 && nova === total - 1) || (passo === -1 && nova === 0)
      const focado = document.activeElement
      if (noFim && (focado === anteriorRef.current || focado === proximaRef.current)) focoPendente.current = passo === 1 ? 'anterior' : 'proxima'
    },
    [pagina, total],
  )

  useEffect(() => {
    const alvo = focoPendente.current
    if (alvo === null) return
    focoPendente.current = null
    ;(alvo === 'anterior' ? anteriorRef.current : proximaRef.current)?.focus({ preventScroll: true })
  }, [pagina])

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      fechar(true)
      return
    }
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.altKey && !event.ctrlKey && !event.metaKey && total > 1) {
      event.preventDefault()
      event.stopPropagation()
      trocarPagina(event.key === 'ArrowLeft' ? -1 : 1)
      return
    }
    if (event.key !== 'Tab') return
    const focaveis = raizRef.current === null ? [] : [...raizRef.current.querySelectorAll<HTMLElement>(FOCAVEIS)]
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    if (primeiro === undefined || ultimo === undefined) return
    const dentro = focaveis.some((el) => el === document.activeElement)
    if (event.shiftKey && (document.activeElement === primeiro || !dentro)) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && (document.activeElement === ultimo || !dentro)) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  return (
    <div ref={raizRef} className="pp-leitura" role="dialog" aria-modal="true" aria-labelledby={idDoTitulo} onKeyDown={onKeyDown}>
      <div ref={veuRef} className="pp-leitura__veu" aria-hidden="true" onClick={() => fechar(false)} />
      <div ref={caixaRef} className="pp-leitura__caixa">
        {/* Rola pelo teclado também (as setas para cima e para baixo): o papel comprido não esconde o fim. */}
        <div ref={roloRef} className="pp-leitura__rolo" tabIndex={0} aria-label="Texto do documento">
          <Papel documento={papel} pagina={pagina} resolver={resolver} idDoTitulo={idDoTitulo} />
        </div>
        <div className="pp-leitura__pe">
          {total > 1 && (
            <>
              <button ref={anteriorRef} type="button" className="pp-button" disabled={pagina === 0} onClick={() => trocarPagina(-1)}>
                ‹ Anterior
              </button>
              <span className="pp-leitura__pag" aria-live="polite">
                Página {pagina + 1} de {total}
              </span>
              <button ref={proximaRef} type="button" className="pp-button" disabled={pagina === total - 1} onClick={() => trocarPagina(1)}>
                Próxima ›
              </button>
            </>
          )}
          {doMapa && aberto.guardado === 'agora' && <span className="pp-leitura__guardado">Guardado em Documentos</span>}
          {doMapa && aberto.guardado === 'antes' && <span className="pp-leitura__guardado pp-leitura__guardado--antes">Já está nos seus Documentos</span>}
          <button ref={fecharRef} type="button" className="pp-button pp-leitura__fechar" onClick={(event) => fechar(event.detail === 0)}>
            Fechar{' '}
            <kbd className="pp-leitura__tecla" aria-hidden="true">
              Esc
            </kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
