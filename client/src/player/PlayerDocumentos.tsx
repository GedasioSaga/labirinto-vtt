import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { IconeDoPapel } from '../components/documentos/IconeDoPapel'
import { useImagemDaMesa } from '../components/ImagemDaMesa'
import { IconeDaLente, Papel, type PapelProps } from '../documentos/Papel'
import { embaralhar, sementeDoTexto, sorteio } from '../documentos/resolver'
import type { BlocoNoFio, DocumentoNaFicha } from '../documentos/tipos'
import { metaDaLinha, type RetanguloNaTela } from './documentosDoJogador'
import { abrirGaveta, abrirLeitura, fecharLeitura } from './movimentoDosDocumentos'
import type { DocumentoAberto } from './playerConnection'
import { movimentoReduzido } from './puzzle/movimento'
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

// ------------------------------------------------------------------ a decifração (fase D5)

/*
 * O trecho que ele lê com o item vira o claro da esquerda para a direita, só
 * na PRIMEIRA leitura dele neste aparelho (o protótipo dos extras aprovado,
 * `decifrarTrecho`): atrás da beirada o claro, na frente o cifrado, e na
 * beirada 3 letras trocando. Anda por quadro escrevendo o `textContent` do
 * trecho, sem passar pelo React (nada da leitura renderiza de novo). Com
 * movimento reduzido o claro já aparece, sem a troca de letras.
 */
const DECIFRAR_MS_POR_LETRA = 13
const DECIFRAR_MIN_MS = 520
const DECIFRAR_MAX_MS = 980
/** Depois que o papel abriu (o mesmo tempo do protótipo); cada trecho seguinte da página começa 140 ms depois. */
const DECIFRAR_ESPERA_MS = 260
const DECIFRAR_ESCALONADO_MS = 140
const LETRAS_NA_BEIRADA = 3
const LETRAS_DA_BEIRADA = 'abcdefghijlmnopqrstuvxzçãéó'
/** Os trechos que ele já viu decifrar (`docId:trechoId`), só neste aparelho; os mais velhos saem depois do teto. */
const CHAVE_DOS_DECIFRADOS = 'labirinto.documentos.decifrados'
const DECIFRADOS_MAX = 2000

/** Uma curva `cubic-bezier` avaliada por quadro (o `curva` do protótipo). */
function curvaBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const ponto = (t: number, p1: number, p2: number): number => 3 * p1 * t * (1 - t) * (1 - t) + 3 * p2 * t * t * (1 - t) + t * t * t
  return (x) => {
    let baixo = 0
    let alto = 1
    let t = x
    for (let i = 0; i < 24; i++) {
      const v = ponto(t, x1, x2)
      if (Math.abs(v - x) < 1e-4) break
      if (v < x) baixo = t
      else alto = t
      t = (baixo + alto) / 2
    }
    return ponto(t, y1, y2)
  }
}
/** O ease-in-out forte: o que anda NA tela (o mesmo do voo até "Documentos"). */
const NA_TELA = curvaBezier(0.77, 0, 0.175, 1)

function lerDecifrados(): string[] {
  try {
    const cru = window.localStorage.getItem(CHAVE_DOS_DECIFRADOS)
    const lista: unknown = cru === null ? [] : JSON.parse(cru)
    return Array.isArray(lista) ? lista.filter((chave): chave is string => typeof chave === 'string') : []
  } catch {
    // Guardado estragado ou armazenamento bloqueado: decifra de novo, que é o mal menor.
    return []
  }
}

function marcarDecifrados(chaves: readonly string[]): void {
  const antes = lerDecifrados()
  const novas = chaves.filter((chave) => !antes.includes(chave))
  if (novas.length === 0) return
  try {
    window.localStorage.setItem(CHAVE_DOS_DECIFRADOS, JSON.stringify([...antes, ...novas].slice(-DECIFRADOS_MAX)))
  } catch {
    // Sem espaço ou bloqueado: ele vê a decifração de novo na próxima leitura.
  }
}

/** Anda a decifração de UM trecho; devolve o "parar" (o trecho fica como estiver). */
function decifrarTrecho(span: HTMLElement, antes: string, claro: string, aoTerminar: () => void): () => void {
  const letras = [...claro]
  const deAntes = [...antes]
  const total = letras.length
  const duracao = Math.min(DECIFRAR_MAX_MS, Math.max(DECIFRAR_MIN_MS, total * DECIFRAR_MS_POR_LETRA))
  const beirada = sorteio(sementeDoTexto(claro) ^ 0x9e37)
  // Quando o claro é mais comprido que o cifrado, o que falta à direita sai destas letras (nunca do claro).
  const reserva = [...embaralhar(claro, sementeDoTexto(antes))]
  const inicio = performance.now()
  let quadro = 0
  const passo = (agora: number) => {
    if (!span.isConnected) return
    const p = Math.min(1, Math.max(0, (agora - inicio) / duracao))
    if (p >= 1) {
      span.textContent = claro
      aoTerminar()
      return
    }
    const e = NA_TELA(p)
    const frente = Math.round(e * (total + LETRAS_NA_BEIRADA))
    const lidas = Math.max(0, frente - LETRAS_NA_BEIRADA)
    const alvo = Math.round(deAntes.length + (total - deAntes.length) * e)
    const partes = letras.slice(0, lidas)
    for (let i = lidas; i < Math.min(total, frente); i++) {
      const letra = letras[i]
      partes.push(/\s/.test(letra) ? letra : LETRAS_DA_BEIRADA[Math.floor(beirada() * LETRAS_DA_BEIRADA.length)])
    }
    for (let i = partes.length; i < alvo; i++) partes.push(deAntes[i] ?? reserva[i] ?? '')
    span.textContent = partes.join('')
    quadro = requestAnimationFrame(passo)
  }
  quadro = requestAnimationFrame(passo)
  return () => cancelAnimationFrame(quadro)
}

type BlocoLido = Extract<BlocoNoFio, { lido: true }>

function ehLido(bloco: BlocoNoFio): bloco is BlocoLido {
  return bloco.t === 'protegido' && bloco.lido
}

/**
 * Decifra os trechos que ele lê com o item na página que está à vista e que
 * ele ainda não viu decifrar. Chamado antes do desenho (o trecho começa como
 * ele o via sem o item); devolve o "desfazer", que deixa tudo no claro.
 */
function decifrarAPagina(rolo: HTMLElement, estado: HTMLElement | null, docId: string, blocos: readonly BlocoNoFio[]): () => void {
  const vistos = new Set(lerDecifrados())
  const porId = new Map<string, BlocoLido>()
  for (const bloco of blocos) if (ehLido(bloco) && !vistos.has(`${docId}:${bloco.id}`)) porId.set(bloco.id, bloco)
  if (porId.size === 0) return () => undefined
  if (movimentoReduzido()) {
    marcarDecifrados([...porId.keys()].map((id) => `${docId}:${id}`))
    return () => undefined
  }
  const relogios: ReturnType<typeof setTimeout>[] = []
  const paradas: (() => void)[] = []
  const tocados: { span: HTMLElement; claro: string }[] = []
  const etiquetas: Element[] = []
  let andando = 0
  const terminou = () => {
    andando -= 1
    if (andando === 0) estado?.classList.remove('is-oculto')
  }
  ;[...porId.values()].forEach((bloco, ordem) => {
    // O id do trecho tem a forma `[a-z0-9]{1,16}` (o resolver só manda esse): cabe no seletor sem escapar.
    const spans = [...rolo.querySelectorAll<HTMLElement>(`.trecho--lido[data-trecho="${bloco.id}"]`)]
    const tags = [...rolo.querySelectorAll(`.trecho__com[data-com="${bloco.id}"]`)]
    if (spans.length === 0) return
    for (const span of spans) {
      span.textContent = bloco.antes
      span.classList.add('is-decifrando')
      span.setAttribute('aria-hidden', 'true')
      tocados.push({ span, claro: bloco.texto })
      andando += 1
    }
    for (const tag of tags) tag.classList.add('is-oculto')
    etiquetas.push(...tags)
    relogios.push(
      setTimeout(() => {
        let faltam = spans.length
        for (const span of spans) {
          paradas.push(
            decifrarTrecho(span, bloco.antes, bloco.texto, () => {
              span.classList.remove('is-decifrando')
              span.removeAttribute('aria-hidden')
              faltam -= 1
              if (faltam === 0) {
                for (const tag of tags) tag.classList.remove('is-oculto')
                marcarDecifrados([`${docId}:${bloco.id}`])
              }
              terminou()
            }),
          )
        }
      }, DECIFRAR_ESPERA_MS + ordem * DECIFRAR_ESCALONADO_MS),
    )
  })
  if (andando > 0) estado?.classList.add('is-oculto')
  return () => {
    for (const relogio of relogios) clearTimeout(relogio)
    for (const parar of paradas) parar()
    for (const { span, claro } of tocados) {
      span.textContent = claro
      span.classList.remove('is-decifrando')
      span.removeAttribute('aria-hidden')
    }
    for (const tag of etiquetas) tag.classList.remove('is-oculto')
    estado?.classList.remove('is-oculto')
  }
}

/** A linha do pé sobre os trechos da página: lidos com o item, ou quantos ele não consegue ler. */
function EstadoDaLeitura({
  blocos,
  estadoRef,
  nomeDoItem,
}: {
  blocos: readonly BlocoNoFio[]
  estadoRef: RefObject<HTMLSpanElement | null>
  nomeDoItem: PapelProps['nomeDoItem']
}) {
  let lidos = 0
  let fechados = 0
  let lidoCom: string | null = null
  for (const bloco of blocos) {
    if (bloco.t !== 'protegido' || bloco.tipo !== 'cifra') continue
    if (bloco.lido) {
      lidos += 1
      lidoCom = bloco.com
    } else fechados += 1
  }
  if (lidos > 0) {
    const nome = lidos === 1 && lidoCom !== null ? (nomeDoItem?.(lidoCom) ?? null) : null
    return (
      <span ref={estadoRef} className="pp-leitura__estado pp-leitura__estado--lido">
        <IconeDaLente />
        {lidos === 1 ? `Lido com ${nome ?? 'um item que você carrega'}` : 'Lidos com o que você carrega'}
      </span>
    )
  }
  if (fechados === 0) return null
  return (
    <span ref={estadoRef} className="pp-leitura__estado">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {fechados === 1 ? 'Um trecho que você não consegue ler' : `${fechados} trechos que você não consegue ler`}
    </span>
  )
}

// ------------------------------------------------------------------ a leitura

export interface LeituraDoDocumentoProps {
  aberto: DocumentoAberto
  /** De onde o papel sai ao abrir (o papel tocado no mapa, a pílula); `null` = cresce no lugar. */
  de: RetanguloNaTela | null
  /** Aberta pelo teclado: sem animação na entrada. */
  instant: boolean
  /** O nome do item que leu um trecho (da mochila das fichas dele). Ausente, ou `null`: "um item que você carrega". */
  nomeDoItem?: PapelProps['nomeDoItem']
  /** Fechou. `rolo` = onde o papel estava (o voo até "Documentos" sai dele); `byKeyboard` = Esc ou Enter (sem voo). */
  onClose: (rolo: RetanguloNaTela | null, byKeyboard: boolean) => void
}

/**
 * O papel aberto, por cima do mapa: as setas (e ←/→) trocam a página, Esc e o
 * véu fecham, o Tab fica aqui dentro e o foco volta a quem abriu. Remonta a
 * cada leitura (`key` = `aberto.id`): a página volta para a primeira.
 */
export function LeituraDoDocumento({ aberto, de, instant, nomeDoItem, onClose }: LeituraDoDocumentoProps) {
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
  const estadoRef = useRef<HTMLSpanElement>(null)
  const documento = aberto.documento
  const total = documento.paginas.length
  const blocosDaPagina = documento.paginas[pagina]?.blocos ?? []
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

  // A decifração da página à vista, antes do desenho: o trecho aparece como ele o via sem o item e anda até o claro.
  // Também aberta pelo teclado: é o conteúdo, não a entrada da tela. Trocar de página ou fechar desfaz o que faltava.
  useLayoutEffect(() => {
    const rolo = roloRef.current
    if (rolo === null) return
    return decifrarAPagina(rolo, estadoRef.current, documento.docId, documento.paginas[pagina]?.blocos ?? [])
    // A leitura remonta a cada documento novo (`key`): só a página muda aqui dentro.
  }, [pagina])

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
          <Papel documento={documento} pagina={pagina} resolver={resolver} idDoTitulo={idDoTitulo} nomeDoItem={nomeDoItem} />
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
          <EstadoDaLeitura blocos={blocosDaPagina} estadoRef={estadoRef} nomeDoItem={nomeDoItem} />
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
