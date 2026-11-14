import { useEffect, useRef, type KeyboardEvent } from 'react'
import { nomeDaAura, type AuraDaFicha } from '../lib/auras'

/** Distância, em px de tela, entre o ponto do toque e o canto do menu: ele abre ao lado do dedo, não por cima da ficha. */
const AFASTAMENTO_PX = 16
/** Tamanho do menu (o mesmo do CSS `.pp-pointmenu`, com um item só), para virar de lado perto da borda. */
const LARGURA_PX = 192
const ALTURA_PX = 54
const MARGEM_DA_BORDA_PX = 8

/** Abre à direita/abaixo do ponto; sem espaço, vira para o outro lado; sem espaço dos dois, prende na margem. */
function inicioDoMenu(ponto: number, tamanho: number, janela: number): number {
  const depois = ponto + AFASTAMENTO_PX
  if (depois + tamanho <= janela - MARGEM_DA_BORDA_PX) return depois
  return Math.max(MARGEM_DA_BORDA_PX, ponto - AFASTAMENTO_PX - tamanho)
}

interface MenuDaFichaDoJogadorProps {
  /** Onde o jogador clicou (botão direito) ou segurou, em px da janela. */
  screenX: number
  screenY: number
  /** A aura que o mestre deu à ficha dele, como está agora. */
  aura: AuraDaFicha
  /** Liga (`true`) ou desliga a aura. Quem monta envia ao mestre e fecha o menu. */
  onAura: (ligada: boolean) => void
  onClose: () => void
}

/**
 * AURA DA FICHA (pedido de 14/11/2026): o menu do botão direito, ou do toque
 * longo, na PRÓPRIA ficha do jogador. Um item só, "Aura: ligada / desligada":
 * qual aura é, quem escolhe é o mestre; o jogador liga e desliga. Só abre em
 * ficha que tem aura.
 *
 * Mesmo molde do menu do ponto (`PointActionMenu`, e as classes dele): o foco
 * entra no item, Escape fecha, e tocar fora fecha.
 */
export function MenuDaFichaDoJogador({ screenX, screenY, aura, onAura, onClose }: MenuDaFichaDoJogadorProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')?.focus()
  }, [])

  // `pointerdown`, como nos menus do mestre: fecha antes de o toque acertar o que está por baixo.
  useEffect(() => {
    const fora = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [onClose])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' && event.key !== 'Tab') return
    if (event.key === 'Escape') event.preventDefault()
    onClose()
  }

  const left = inicioDoMenu(screenX, LARGURA_PX, window.innerWidth)
  const top = inicioDoMenu(screenY, ALTURA_PX, window.innerHeight)

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Minha ficha"
      className="pp-pointmenu"
      style={{ left: `${left}px`, top: `${top}px`, transformOrigin: `${screenX - left}px ${screenY - top}px` }}
      onKeyDown={onKeyDown}
      // O menu do navegador não abre por cima deste.
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" role="menuitemcheckbox" aria-checked={aura.ligada} title={nomeDaAura(aura.tipo)} className="pp-pointmenu__item" onClick={() => onAura(!aura.ligada)}>
        {aura.ligada ? 'Aura: ligada' : 'Aura: desligada'}
      </button>
    </div>
  )
}
