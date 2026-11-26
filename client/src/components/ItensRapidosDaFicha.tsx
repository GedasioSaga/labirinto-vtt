import { useRef, type KeyboardEvent, type RefObject } from 'react'
import { alvosParaPerto } from '../lib/enviarParaPerto'
import { pisoDe } from '../lib/pisos'
import { fichasComVidaDosTokens } from '../lib/vidaPeloMenu'
import { recursoDeVida } from '../lib/vidaDaFicha'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { cenasComOPersonagem } from '../stores/batalha/cena'
import { useBatalhaStore } from '../stores/batalhaStore'
import { enviarParaPerto } from '../stores/enviarParaPerto'
import { useMapStore } from '../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { mudarVidaDosTokens, type SentidoDaVida } from '../stores/vidaPeloMenu'
import { nomesNumerados } from './batalha/nomesNumerados'
import { SubmenuDaVida } from './SubmenuDaVida'
import { SubmenuDeCondicoes } from './SubmenuDeCondicoes'
import { condicoesDe } from '../lib/condicoes/naFicha'
import { SubmenuPertoDe } from './SubmenuPertoDe'
import './MenuDaSelecao.css'

/** Qual submenu está aberto; `focar` = abriu pelo teclado. */
export interface RapidoAberto {
  qual: 'vida' | 'perto' | 'condicoes'
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
  abrirRef: RefObject<HTMLButtonElement | null>
  pertoRef: RefObject<HTMLButtonElement | null>
  /** O item "Condições ›" (itens refeitos, E4b). Ausente = o menu pai não anda nele com as setas (ele continua no menu). */
  condicoesRef?: RefObject<HTMLButtonElement | null>
  /** O ponteiro chegou num item sem submenu: o menu pai fecha os submenus abertos (os dele também). */
  onPassar: () => void
  /** Fecha o menu inteiro (depois de aplicar). */
  onClose: () => void
}

export const MOTIVO_SEM_FICHA_LIGADA = 'Ligue uma ficha primeiro.'
const MOTIVO_FICHA_FORA_DA_LISTA = 'A ficha ligada não está mais na lista de Personagens.'
const MOTIVO_SEM_OUTRO_TOKEN = 'Não há outro token neste mapa.'
const MOTIVO_SEM_VIDA_NO_SISTEMA = 'O sistema de RPG desta aventura não tem vida com máximo.'
const MOTIVO_FICHA_SEM_VIDA = 'A ficha não tem vida com máximo.'

/**
 * NPC NO BOTÃO DIREITO (pedido de 25/11/2026: "tirar dano e dar vida aos NPCs
 * sem entrar na ficha… porque eu to criando várias cópias do mesmo NPC"), no
 * TOPO do menu, o mais usado: "Vida ›" (o número de agora e o painel de Tirar
 * e Dar, `SubmenuDaVida`), para todas as fichas selecionadas; e "Abrir ficha",
 * a mesma janela da ficha que o mestre abre pelos Personagens (com várias
 * fichas na seleção, a do primeiro token; o nome vai no item); e "Enviar para
 * perto de ›" (`SubmenuPertoDe`): os jogadores e depois os NPCs do mapa, e a
 * seleção vai para as casas livres em volta do escolhido, no piso dele
 * (`stores/enviarParaPerto.ts`), num passo do Ctrl+Z. Serve ao menu
 * da seleção (`MenuDaSelecao`) e ao do token de jogador (`TokenContextMenu`):
 * vale para NPC e para ficha de jogador.
 */
export function ItensRapidosDaFicha({ tokenIds, aberto, onAbrir, vidaRef, abrirRef, pertoRef, condicoesRef, onPassar, onClose }: ItensRapidosDaFichaProps) {
  const refPropria = useRef<HTMLButtonElement | null>(null)
  const condRef = condicoesRef ?? refPropria
  const tokens = useMapStore((state) => state.map.tokens)
  const pisoAtivo = useMapStore((state) => state.pisoAtivo)
  // O piso ao lado do nome só importa quando há ficha fora do térreo (ou o editor está em outro piso).
  const comPisos = pisoAtivo !== 0 || tokens.some((token) => pisoDe(token) !== 0)
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
  // "Abrir ficha": a do primeiro token da seleção com ficha da lista.
  const idsLigados = [...new Set(ligados.flatMap((id) => tokens.find((token) => token.id === id)?.characterId ?? []))]
  const daLista = idsLigados.flatMap((id) => personagens.find((personagem) => personagem.id === id) ?? [])
  const [paraAbrir] = daLista
  const motivoDeAbrir = ligados.length === 0 ? MOTIVO_SEM_FICHA_LIGADA : paraAbrir === undefined ? MOTIVO_FICHA_FORA_DA_LISTA : null
  const abrirFicha = () => {
    if (paraAbrir === undefined) return
    useRpgStore.getState().abrirFicha(paraAbrir.id)
    onClose()
  }
  /** Enter e Espaço abrem a ficha; a seta para a direita não abre nada (o item não tem submenu). */
  const teclaNoAbrir = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    if (event.key !== 'ArrowRight') abrirFicha()
  }

  // "Enviar para perto de ›": os outros tokens do mapa, cópias do mesmo nome numeradas como na batalha.
  const alvos = alvosParaPerto(
    tokens,
    personagens,
    nomesNumerados(tokens.map((token) => ({ id: token.id, nome: token.name }))),
    tokenIds,
  )
  const motivoDoPerto = alvos.length === 0 ? MOTIVO_SEM_OUTRO_TOKEN : null
  const abrirPerto = (focar: boolean) => (motivoDoPerto === null ? onAbrir({ qual: 'perto', focar }) : onPassar())
  const fecharPerto = () => {
    onAbrir(null)
    pertoRef.current?.focus()
  }
  const teclaNoPerto = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    abrirPerto(true)
  }
  const mandarParaPerto = (alvoId: string) => {
    enviarParaPerto(tokenIds, alvoId)
    onClose()
  }

  // "Condições ›" (itens refeitos, E4b): as fichas ligadas da lista, cada uma uma vez (no NPC, a cópia de cada token).
  const motivoDasCondicoes = ligados.length === 0 ? MOTIVO_SEM_FICHA_LIGADA : daLista.length === 0 ? MOTIVO_FICHA_FORA_DA_LISTA : null
  const quantasCondicoes = daLista.reduce((soma, ficha) => soma + condicoesDe(ficha).length, 0)
  const abrirCondicoes = (focar: boolean) => (motivoDasCondicoes === null ? onAbrir({ qual: 'condicoes', focar }) : onPassar())
  const fecharCondicoes = () => {
    onAbrir(null)
    condRef.current?.focus()
  }
  const teclaNasCondicoes = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    abrirCondicoes(true)
  }

  // Desligada, a "Vida" não abre nada: só fecha o submenu que estava aberto.
  const abrirVida = (focar: boolean) => (motivoDaVida === null ? onAbrir({ qual: 'vida', focar }) : onPassar())
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
      <button
        ref={condRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="lb-portamenu__item lb-menusel__pai"
        aria-haspopup="dialog"
        aria-expanded={aberto?.qual === 'condicoes'}
        aria-disabled={motivoDasCondicoes !== null}
        title={motivoDasCondicoes ?? undefined}
        onPointerEnter={(event) => {
          event.currentTarget.focus()
          if (aberto?.qual !== 'condicoes') abrirCondicoes(false)
        }}
        onClick={() => (aberto?.qual === 'condicoes' ? fecharCondicoes() : abrirCondicoes(true))}
        onKeyDown={teclaNasCondicoes}
      >
        <span className="lb-menusel__rotulo">
          <span>Condições</span>
          {quantasCondicoes > 0 && <span className="lb-menusel__estado lb-menusel__numero">{quantasCondicoes}</span>}
        </span>
        <span className="lb-menusel__seta" aria-hidden="true">
          ›
        </span>
      </button>
      {aberto?.qual === 'condicoes' && motivoDasCondicoes === null && <SubmenuDeCondicoes fichas={daLista} ancora={condRef.current} onFechar={fecharCondicoes} onPos={onClose} />}
      <button
        ref={abrirRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="lb-portamenu__item lb-menusel__pai"
        aria-disabled={motivoDeAbrir !== null}
        title={motivoDeAbrir ?? undefined}
        onPointerEnter={(event) => {
          event.currentTarget.focus()
          onPassar()
        }}
        onClick={abrirFicha}
        onKeyDown={teclaNoAbrir}
      >
        <span className="lb-menusel__nome">{daLista.length > 1 && paraAbrir !== undefined ? `Abrir ficha de ${paraAbrir.nome.trim() || 'Personagem sem nome'}` : 'Abrir ficha'}</span>
      </button>
      <button
        ref={pertoRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="lb-portamenu__item lb-menusel__pai"
        aria-haspopup="menu"
        aria-expanded={aberto?.qual === 'perto'}
        aria-disabled={motivoDoPerto !== null}
        title={motivoDoPerto ?? undefined}
        onPointerEnter={(event) => {
          event.currentTarget.focus()
          if (aberto?.qual !== 'perto') abrirPerto(false)
        }}
        onClick={() => (aberto?.qual === 'perto' ? fecharPerto() : abrirPerto(true))}
        onKeyDown={teclaNoPerto}
      >
        <span>Enviar para perto de</span>
        <span className="lb-menusel__seta" aria-hidden="true">
          ›
        </span>
      </button>
      {aberto?.qual === 'perto' && motivoDoPerto === null && (
        <SubmenuPertoDe alvos={alvos} pisoAtivo={pisoAtivo} comPisos={comPisos} ancora={pertoRef.current} onEscolher={mandarParaPerto} onFechar={fecharPerto} onSair={onClose} />
      )}
    </>
  )
}
