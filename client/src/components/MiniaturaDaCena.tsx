import { useEffect, useRef, useState } from 'react'
import type { MapData } from '../types/map'
import { arteDaCena, arteJaPronta, SceneThumbnail } from './SceneOverview'

/**
 * MINIATURA DO MAPA NA LISTA DE CENAS (lista de cenas, ideia 1). O desenho é o
 * da Visão geral (`SceneThumbnail`), em 40×30, com três cuidados para a lista
 * não pesar:
 * - só desenha a linha que está à vista (um `IntersectionObserver` para todas);
 * - calcula uma arte por vez, no tempo livre do navegador (`requestIdleCallback`),
 *   e para quando o quadro precisa da vez;
 * - guarda a arte de cada mapa em memória (`arteDaCena`): rolar de volta,
 *   recolher a pasta ou desligar e religar não recalcula nada.
 * Cena sem mapa (não abriu, sem área desenhada) fica com o quadro vazio, do
 * mesmo tamanho: a coluna de nomes não pula.
 */

/** Chave do interruptor "Miniaturas" no localStorage: '0' desligadas; o resto (ou nada), ligadas. */
export const CHAVE_MINIATURAS = 'lb-cenas-miniaturas'

/** Ligadas por padrão; só o '0' que o interruptor grava desliga. Lixo guardado = ligadas. */
export function lerMiniaturasLigadas(guardado: string | null): boolean {
  return guardado !== '0'
}

/** O interruptor "Miniaturas" lembrado entre aberturas (localStorage, que pode faltar ou lançar). */
export function useMiniaturasLigadas(): readonly [boolean, (ligadas: boolean) => void] {
  const [ligadas, setLigadas] = useState(() => {
    try {
      return lerMiniaturasLigadas(window.localStorage.getItem(CHAVE_MINIATURAS))
    } catch {
      return true
    }
  })
  const mudar = (proximas: boolean) => {
    setLigadas(proximas)
    try {
      window.localStorage.setItem(CHAVE_MINIATURAS, proximas ? '1' : '0')
    } catch {
      // Sem armazenamento a escolha vale só enquanto o app está aberto.
    }
  }
  return [ligadas, mudar] as const
}

/* ------------------------------------------------------------ à vista */

type Aviso = (visivel: boolean) => void

const avisos = new Map<Element, Aviso>()
let observador: IntersectionObserver | null = null

/** Avisa quando a caixa entra e sai da vista. Sem `IntersectionObserver` (jsdom), tudo está à vista. */
function observar(caixa: Element, aviso: Aviso): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    aviso(true)
    return () => undefined
  }
  observador ??= new IntersectionObserver((entradas) => {
    for (const entrada of entradas) avisos.get(entrada.target)?.(entrada.isIntersecting)
  })
  avisos.set(caixa, aviso)
  observador.observe(caixa)
  return () => {
    avisos.delete(caixa)
    observador?.unobserve(caixa)
  }
}

/* ------------------------------------------------------------- a fila */

/** Abaixo disto de folga no quadro, a fila devolve a vez ao navegador. */
const FOLGA_MINIMA_MS = 4
/** Sem `requestIdleCallback`: quanto a fila trabalha por vez. */
const ORCAMENTO_SEM_OCIOSO_MS = 8
/** O navegador nunca ocioso (rolagem sem parar) não segura a miniatura mais que isto. */
const ESPERA_MAXIMA_MS = 300

const fila = new Map<object, () => void>()
let filaAgendada = false

function agendarFila(): void {
  if (filaAgendada || fila.size === 0) return
  filaAgendada = true
  const rodar = (prazo?: IdleDeadline) => {
    filaAgendada = false
    const inicio = performance.now()
    // Pelo menos uma por vez; as outras só se sobrar quadro.
    for (const [dono, tarefa] of fila) {
      fila.delete(dono)
      tarefa()
      const sobra = prazo !== undefined && !prazo.didTimeout ? prazo.timeRemaining() : ORCAMENTO_SEM_OCIOSO_MS - (performance.now() - inicio)
      if (sobra < FOLGA_MINIMA_MS) break
    }
    agendarFila()
  }
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(rodar, { timeout: ESPERA_MAXIMA_MS })
  else window.setTimeout(() => rodar(), 16)
}

function entrarNaFila(dono: object, tarefa: () => void): void {
  fila.set(dono, tarefa)
  agendarFila()
}

function sairDaFila(dono: object): void {
  fila.delete(dono)
}

/**
 * Mapa que muda enquanto a miniatura já mostra uma versão (ficha andando na
 * cena aberta): a nova espera a cena parar de mudar. Arrastar não recalcula o
 * desenho a cada passo.
 */
const ESPERA_PARA_REDESENHAR_MS = 400

/* ---------------------------------------------------------- a miniatura */

interface Mostrada {
  map: MapData
  piso: number
}

/**
 * A miniatura de uma linha. `map` ausente = a cena ainda não tem mapa para
 * mostrar: o quadro fica vazio. Desenho, não controle: o clique atravessa até
 * o nome, que é a linha inteira (main.css).
 */
export function MiniaturaDaCena({ map, piso }: { map: MapData | undefined; piso: number }) {
  const caixaRef = useRef<HTMLSpanElement>(null)
  const [visivel, setVisivel] = useState(false)
  const [mostrada, setMostrada] = useState<Mostrada | null>(() => (map !== undefined && arteJaPronta(map, piso) ? { map, piso } : null))
  /** A arte chegou depois de a caixa aparecer: entra com um esmaecer curto, e não de estalo. */
  const [chegou, setChegou] = useState(false)

  useEffect(() => {
    const caixa = caixaRef.current
    return caixa === null ? undefined : observar(caixa, setVisivel)
  }, [])

  useEffect(() => {
    if (map === undefined) {
      setMostrada(null)
      return
    }
    if (mostrada !== null && mostrada.map === map && mostrada.piso === piso) return
    if (arteJaPronta(map, piso)) {
      setMostrada({ map, piso })
      return
    }
    if (!visivel) return
    const dono = {}
    const pedir = () =>
      entrarNaFila(dono, () => {
        arteDaCena(map, piso)
        setMostrada({ map, piso })
        if (mostrada === null) setChegou(true)
      })
    const espera = mostrada === null ? null : window.setTimeout(pedir, ESPERA_PARA_REDESENHAR_MS)
    if (espera === null) pedir()
    return () => {
      if (espera !== null) window.clearTimeout(espera)
      sairDaFila(dono)
    }
  }, [map, piso, visivel, mostrada])

  return (
    <span ref={caixaRef} className="lb-cenas__mini" data-chegou={chegou ? 'true' : undefined} aria-hidden="true">
      {mostrada !== null && <SceneThumbnail map={mostrada.map} piso={mostrada.piso} falta={null} semNomes />}
    </span>
  )
}
