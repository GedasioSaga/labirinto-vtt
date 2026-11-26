import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { MapData } from '../types/map'
import { assinarMiniaturas, esquecerPedido, miniaturaDaCena, pedirMiniatura } from '../stores/miniaturasDasCenas'
import { DungeonMapIcon } from './icons'

/**
 * MINIATURA DO MAPA NA LISTA DE CENAS (lista de cenas, ideia 1; refeita em
 * 25/11/2026: "sem textura e focam lá longe"). A imagem é a do canvas do
 * editor — chão pintado, carimbos, paredes, objetos e salas, como o "Exportar
 * imagem" —, enquadrada no pedaço que tem conteúdo (`lib/miniaturaDaCena.ts`),
 * e guardada (`stores/miniaturasDasCenas.ts`). A lista só pede a das linhas à
 * vista (um `IntersectionObserver` para todas), e a fila pinta uma por vez, no
 * tempo livre. Cena vazia: o ícone de mapa. Cena sem mapa (não abriu): o
 * quadro vazio, do mesmo tamanho — a coluna de nomes não pula.
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

/* ---------------------------------------------------------- a miniatura */

/**
 * A miniatura nova da cena `chave`, pedida só enquanto a caixa (`caixaRef`)
 * está à vista. Serve à linha da lista de Cenas e ao cartão da Visão geral: a
 * mesma imagem, a mesma fila. `map` ausente = nada a pedir (a caixa fica com o
 * que já estiver pronto). `nasceuSemImagem`: a caixa apareceu antes da imagem.
 */
export function useMiniaturaDaCena(chave: string, map: MapData | undefined, aberta: boolean) {
  const caixaRef = useRef<HTMLSpanElement>(null)
  const [visivel, setVisivel] = useState(false)
  const pronta = useSyncExternalStore(assinarMiniaturas, () => miniaturaDaCena(chave))
  /** A imagem chegou depois de a caixa aparecer: entra com um esmaecer curto, e não de estalo. A que já estava pronta, não. */
  const [nasceuSemImagem] = useState(() => pronta === undefined)

  useEffect(() => {
    const caixa = caixaRef.current
    return caixa === null ? undefined : observar(caixa, setVisivel)
  }, [])

  useEffect(() => {
    if (map === undefined || !visivel) return
    pedirMiniatura(chave, map, aberta)
    return () => esquecerPedido(chave)
  }, [chave, map, aberta, visivel])

  return { caixaRef, pronta, nasceuSemImagem }
}

/**
 * A miniatura de uma linha. `chave`: o id da cena na lista ('' no mapa solto).
 * `map` ausente = a cena ainda não tem mapa para mostrar: o quadro fica vazio.
 * `aberta`: a cena do editor, cuja imagem só é refeita ao salvar. Desenho, não
 * controle: o clique atravessa até o nome, que é a linha inteira (main.css).
 */
export function MiniaturaDaCena({ chave, map, aberta }: { chave: string; map: MapData | undefined; aberta: boolean }) {
  const { caixaRef, pronta, nasceuSemImagem } = useMiniaturaDaCena(chave, map, aberta)

  return (
    <span ref={caixaRef} className="lb-cenas__mini" data-chegou={nasceuSemImagem && pronta !== undefined ? 'true' : undefined} aria-hidden="true">
      {pronta !== undefined &&
        (pronta.url === null ? (
          <span className="lb-cenas__mini-vazia">
            <DungeonMapIcon size={16} />
          </span>
        ) : (
          <img src={pronta.url} alt="" draggable={false} decoding="async" />
        ))}
    </span>
  )
}
