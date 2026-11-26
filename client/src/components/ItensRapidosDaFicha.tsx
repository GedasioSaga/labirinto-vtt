import type { KeyboardEvent, RefObject } from 'react'
import { fichasComVidaDosTokens } from '../lib/vidaPeloMenu'
import { recursoDeVida } from '../lib/vidaDaFicha'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { cenasComOPersonagem } from '../stores/batalha/cena'
import { useBatalhaStore } from '../stores/batalhaStore'
import { useMapStore } from '../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { mudarVidaDosTokens, type SentidoDaVida } from '../stores/vidaPeloMenu'
import { SubmenuDaVida } from './SubmenuDaVida'
import './MenuDaSelecao.css'

/** Qual painel está aberto; `focar` = abriu pelo teclado. */
export interface RapidoAberto {
  qual: 'vida'
  focar: boolean
}

export interface ItensRapidosDaFichaProps {
  /** Os tokens que o item mexe (a seleção inteira, ou o token do clique). */
  tokenIds: readonly string[]
  /** O menu pai manda (um submenu aberto por vez, contando os dele). */
  aberto: RapidoAberto | null
  onAbrir: (aberto: RapidoAberto | null) => void
  /** Os itens pais, para o menu andar neles com as setas. */
  vidaRef: RefObject<HTMLButtonElement | null>
  /** Fecha o menu inteiro (depois de aplicar). */
  onClose: () => void
}

export const MOTIVO_SEM_FICHA_LIGADA = 'Ligue uma ficha primeiro.'
const MOTIVO_SEM_VIDA_NO_SISTEMA = 'O sistema de RPG desta aventura não tem vida com máximo.'
const MOTIVO_FICHA_SEM_VIDA = 'A ficha não tem vida com máximo.'

/**
 * NPC NO BOTÃO DIREITO (pedido de 25/11/2026: "tirar dano e dar vida aos NPCs
 * sem entrar na ficha… porque eu to criando várias cópias do mesmo NPC"), no
 * TOPO do menu, o mais usado: "Vida ›" (o número de agora e o painel de Tirar
 * e Dar, `SubmenuDaVida`), para todas as fichas selecionadas. Serve ao menu
 * da seleção (`MenuDaSelecao`) e ao do token de jogador (`TokenContextMenu`):
 * vale para NPC e para ficha de jogador.
 */
export function ItensRapidosDaFicha({ tokenIds, aberto, onAbrir, vidaRef, onClose }: ItensRapidosDaFichaProps) {
  const tokens = useMapStore((state) => state.map.tokens)
  const personagens = useAdventureStore(personagensAtivos)
  const idDoSistema = useAdventureStore(sistemaAtivo)
  const sistema = useRpgStore((state) => sistemaPorId(state.biblioteca, idDoSistema))
  const batalhas = useBatalhaStore((state) => state.cenas)

  const recurso = recursoDeVida(sistema ?? null)
  const ligados = tokenIds.filter((id) => tokens.some((token) => token.id === id && token.characterId !== null))
  const fichas = recurso === null ? [] : fichasComVidaDosTokens(tokenIds, tokens, personagens, recurso)
  const [uma] = fichas
  const motivoDaVida = ligados.length === 0 ? MOTIVO_SEM_FICHA_LIGADA : recurso === null ? MOTIVO_SEM_VIDA_NO_SISTEMA : fichas.length === 0 ? MOTIVO_FICHA_SEM_VIDA : null
  const naBatalha = fichas.some((ficha) => cenasComOPersonagem(batalhas, ficha.personagemId).length > 0)

  const abrirVida = (focar: boolean) => onAbrir(motivoDaVida === null ? { qual: 'vida', focar } : null)
  const fecharVida = () => {
    onAbrir(null)
    vidaRef.current?.focus()
  }
  /** Seta para a direita, Enter e Espaço abrem o painel com o foco dentro; o resto fica com o menu pai. */
  const teclaNaVida = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    abrirVida(true)
  }
  const aplicar = (sentido: SentidoDaVida, quanto: number) => {
    mudarVidaDosTokens(tokenIds, sentido, quanto)
    onClose()
  }

  return (
    <>
      <button
        ref={vidaRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="lb-portamenu__item lb-menusel__pai"
        aria-haspopup="dialog"
        aria-expanded={aberto?.qual === 'vida'}
        aria-disabled={motivoDaVida !== null}
        title={motivoDaVida ?? undefined}
        onPointerEnter={(event) => {
          event.currentTarget.focus()
          if (aberto?.qual !== 'vida') abrirVida(false)
        }}
        onClick={() => (aberto?.qual === 'vida' ? fecharVida() : abrirVida(true))}
        onKeyDown={teclaNaVida}
      >
        <span className="lb-menusel__rotulo">
          <span>Vida</span>
          {fichas.length === 1 && uma !== undefined && (
            <span className="lb-menusel__estado lb-menusel__numero">
              {uma.atual}/{uma.maximo}
            </span>
          )}
          {fichas.length > 1 && <span className="lb-menusel__estado">{fichas.length} fichas</span>}
        </span>
        <span className="lb-menusel__seta" aria-hidden="true">
          ›
        </span>
      </button>
      {aberto?.qual === 'vida' && motivoDaVida === null && recurso !== null && (
        <SubmenuDaVida fichas={fichas} nomeDoRecurso={recurso.nome} naBatalha={naBatalha} ancora={vidaRef.current} onAplicar={aplicar} onFechar={fecharVida} />
      )}
    </>
  )
}
