import { useEffect, useRef, type RefObject } from 'react'
import type { TipoMobilia } from '../../lib/mobilia/tipos'
import { snapPointForTarget } from '../../pixi/tokenInteraction'
import { useMapStore } from '../../stores/mapStore'
import { porMovelNoPonto } from '../../stores/mobiliaNoPonto'

/** Quanto o ponteiro anda (px de tela) antes de o aperto virar arrasto: abaixo disso é um clique comum. */
const FOLGA_DO_ARRASTO_PX = 5
/** Onde o mapa do editor mora no DOM (o `canvasHostRef` do `App.tsx`). */
const SELETOR_DO_MAPA = '.lb-editor__canvas'
/** O fantasma fica um pouco abaixo e à direita do ponteiro, para não cobrir o ponto onde o móvel cai. */
const FOLGA_DO_FANTASMA_PX = 12

/** O ponto do mapa (px de mundo) sob o ponteiro, pela mesma conta do soltar do Acervo; `null` fora do mapa. */
function pontoNoMapa(clientX: number, clientY: number): { x: number; y: number } | null {
  const host = document.querySelector<HTMLElement>(SELETOR_DO_MAPA)
  const sob = document.elementFromPoint(clientX, clientY)
  if (host === null || sob === null || !host.contains(sob)) return null
  const caixa = host.getBoundingClientRect()
  const { camera } = useMapStore.getState()
  return { x: (clientX - caixa.left - camera.x) / camera.scale, y: (clientY - caixa.top - camera.y) / camera.scale }
}

/** O móvel que o clique no mapa poria agora: o da ferramenta aberta (Objeto ou Construção). */
function tipoEscolhido(): TipoMobilia | null {
  const estado = useMapStore.getState()
  if (estado.activeTool === 'mobilia') return estado.mobiliaTipo
  if (estado.activeTool === 'construcao') return estado.construcaoTipo
  return null
}

/** O mesmo encaixe do clique da ferramenta: a chave de Objeto da grade, invertida pelo Alt. */
function encaixado(ponto: { x: number; y: number }, alt: boolean): { x: number; y: number } {
  const { map, snapTargets } = useMapStore.getState()
  const ligado = alt ? !snapTargets.prop : snapTargets.prop
  return ligado ? snapPointForTarget('prop', map.gridShape, ponto.x, ponto.y, map.grid) : ponto
}

/** O nome do móvel colado no ponteiro durante o arrasto. `textContent`: o rótulo nunca vira HTML. */
function criarFantasma(texto: string): HTMLDivElement {
  const fantasma = document.createElement('div')
  fantasma.textContent = texto
  fantasma.setAttribute('aria-hidden', 'true')
  Object.assign(fantasma.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    zIndex: '1000',
    pointerEvents: 'none',
    padding: '4px 10px',
    borderRadius: '999px',
    border: '1px solid var(--lb-color-brass)',
    background: 'var(--lb-color-stone-raised)',
    color: 'var(--lb-color-parchment)',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
  })
  document.body.appendChild(fantasma)
  return fantasma
}

/**
 * ARRASTAR DA LISTA PARA O MAPA (bug certo 7 do explorador, 26/11/2026): o
 * móvel da lista Objeto (e Construção) vai ao mapa arrastado, com o nome dele
 * colado no ponteiro, como o Acervo de tokens já fazia. O aperto já ESCOLHE o
 * móvel (soltar fora do botão não perde a escolha); soltar no mapa põe ali,
 * pelo mesmo `porMovelNoPonto` do clique (encaixe, giro da sala, camada e um
 * passo do Ctrl+Z); soltar fora do mapa ou Esc só desiste.
 *
 * Os botões são os rádios do `CampoSeg`, achados pelo `data-valor`.
 */
export function useArrastarObjetoParaOMapa(listaRef: RefObject<HTMLElement | null>, escolher: (id: string) => void): void {
  const escolherRef = useRef(escolher)
  useEffect(() => {
    escolherRef.current = escolher
  })

  useEffect(() => {
    const lista = listaRef.current
    if (lista === null) return
    let encerrar: (() => void) | null = null

    const aoApertar = (aperto: PointerEvent) => {
      if (aperto.button !== 0 || !(aperto.target instanceof Element)) return
      const botao = aperto.target.closest<HTMLElement>('[role="radio"][data-valor]')
      const id = botao?.dataset.valor
      if (botao === null || id === undefined) return
      escolherRef.current(id)
      const inicio = { x: aperto.clientX, y: aperto.clientY }
      const rotulo = botao.textContent?.trim() ?? ''
      let fantasma: HTMLDivElement | null = null

      const mover = (evento: PointerEvent) => {
        if (fantasma === null) {
          if (Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y) < FOLGA_DO_ARRASTO_PX) return
          fantasma = criarFantasma(rotulo)
        }
        fantasma.style.transform = `translate(${evento.clientX + FOLGA_DO_FANTASMA_PX}px, ${evento.clientY + FOLGA_DO_FANTASMA_PX}px)`
      }
      const soltar = (evento: PointerEvent) => {
        const arrastou = fantasma !== null
        fim()
        if (!arrastou) return
        const ponto = pontoNoMapa(evento.clientX, evento.clientY)
        const tipo = tipoEscolhido()
        // O Muro de fogo é traçado, não posto num ponto: o arrasto só deixa ele escolhido.
        if (ponto === null || tipo === null || tipo === 'muroDeFogo') return
        porMovelNoPonto(tipo, encaixado(ponto, evento.altKey))
      }
      const aoTeclar = (evento: KeyboardEvent) => {
        if (evento.key === 'Escape' && fantasma !== null) fim()
      }
      const fim = () => {
        fantasma?.remove()
        fantasma = null
        window.removeEventListener('pointermove', mover)
        window.removeEventListener('pointerup', soltar)
        window.removeEventListener('pointercancel', fim)
        window.removeEventListener('keydown', aoTeclar, true)
        encerrar = null
      }
      encerrar?.()
      window.addEventListener('pointermove', mover)
      window.addEventListener('pointerup', soltar)
      window.addEventListener('pointercancel', fim)
      window.addEventListener('keydown', aoTeclar, true)
      encerrar = fim
    }

    lista.addEventListener('pointerdown', aoApertar)
    return () => {
      lista.removeEventListener('pointerdown', aoApertar)
      encerrar?.()
    }
  }, [listaRef])
}
