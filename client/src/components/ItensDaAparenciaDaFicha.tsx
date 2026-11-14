import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { AURAS, lerAura, type TipoDeAura } from '../lib/auras'
import { ehImagemDaMesa } from '../lib/midia'
import { formasParaMudar } from '../lib/mudarFicha'
import { tokenPhotoRef } from '../lib/tokenPhoto'
import { miniaturaDaAura } from '../pixi/auras/miniatura'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import { mudarFichaDoToken } from '../stores/mudarFichaDoToken'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import type { Token } from '../types/map'
import { ImagemOuIniciais } from './FichaPecas'
import { SubmenuDeMiniaturas, type MiniaturaDoSubmenu } from './SubmenuDeMiniaturas'
import './MenuDaSelecao.css'

/** Qual dos dois submenus está aberto; `focar` = abriu pelo teclado. */
export interface AparenciaAberta {
  qual: 'forma' | 'aura'
  focar: boolean
}

export interface ItensDaAparenciaDaFichaProps {
  tokenId: string
  /** O menu pai manda (um submenu aberto por vez, contando os dele). */
  aberta: AparenciaAberta | null
  onAbrir: (aberta: AparenciaAberta | null) => void
  /** Os dois itens pais, para o menu andar neles com as setas. */
  formaRef: RefObject<HTMLButtonElement | null>
  auraRef: RefObject<HTMLButtonElement | null>
  /** Fecha o menu inteiro (depois de escolher, ou Tab). */
  onClose: () => void
}

const MOTIVO_SEM_FICHA = 'Ligue uma ficha de personagem a este token.'
const MOTIVO_SEM_FORMA = 'A ficha não tem transformação com imagem.'

/** Lado da miniatura da aura, em px do CSS (`.lb-minis__foto`). */
const LADO_DA_MINIATURA = 48
/** Tela densa: o canvas dobra, e não mais (9 miniaturas, não precisa de 3x). */
const DENSIDADE_MAXIMA = 2

/** Caminho do disco → `src`. A ponte do Tauri não existe no navegador: lá, sem foto (as iniciais). */
function fonteDoDisco(caminho: string): string | null {
  try {
    return convertFileSrc(caminho)
  } catch {
    return null
  }
}

/** A imagem BASE do token: a do disco do mestre, a da mesa, ou as iniciais do nome. */
function FotoBase({ token }: { token: Token }) {
  const foto = tokenPhotoRef(token)
  const doDisco = foto !== null && !ehImagemDaMesa(foto) ? fonteDoDisco(foto) : null
  if (doDisco !== null) return <img src={doDisco} alt="" />
  return <ImagemOuIniciais imagem={foto} nome={token.name} />
}

/** A miniatura da aura, copiada do canvas que `miniaturaDaAura` guarda. */
function MiniaturaDaAura({ tipo }: { tipo: TipoDeAura }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const lado = Math.round(LADO_DA_MINIATURA * Math.min(DENSIDADE_MAXIMA, window.devicePixelRatio || 1))
  useEffect(() => {
    const canvas = ref.current
    if (canvas === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    ctx.clearRect(0, 0, lado, lado)
    ctx.drawImage(miniaturaDaAura(tipo, lado), 0, 0)
  }, [tipo, lado])
  return <canvas ref={ref} width={lado} height={lado} />
}

/**
 * MUDAR FICHA e AURA (pedido de 14/11/2026): os dois itens do botão direito
 * no token, com as miniaturas ao lado (`SubmenuDeMiniaturas`). Servem ao menu
 * da seleção (`MenuDaSelecao`, com um token só) e ao menu do token de jogador
 * (`TokenContextMenu`).
 *
 * "Mudar ficha ›": a imagem base e cada transformação com imagem da ficha de
 * personagem ligada. Escolher troca a imagem do token e marca a transformação
 * como Ativa na ficha, sem custo (`mudarFichaDoToken`); a base desmarca.
 * Token sem ficha, ou ficha sem transformação com imagem: desligado, com o
 * porquê embaixo.
 *
 * "Aura ›": as 9 auras e "Sem aura". A escolhida começa ligada; o jogador dono
 * só liga e desliga (menu dele). Um passo do Ctrl+Z cada.
 */
export function ItensDaAparenciaDaFicha({ tokenId, aberta, onAbrir, formaRef, auraRef, onClose }: ItensDaAparenciaDaFichaProps) {
  const token = useMapStore((state) => state.map.tokens.find((t) => t.id === tokenId))
  const personagens = useAdventureStore(personagensAtivos)
  const idDoSistema = useAdventureStore(sistemaAtivo)
  const sistema = useRpgStore((state) => sistemaPorId(state.biblioteca, idDoSistema))
  if (token === undefined) return null

  const personagem = token.characterId === null ? undefined : personagens.find((p) => p.id === token.characterId)
  const formas = personagem === undefined ? [] : formasParaMudar(personagem, sistema)
  const motivoDaForma = personagem === undefined ? MOTIVO_SEM_FICHA : formas.length === 0 ? MOTIVO_SEM_FORMA : null
  // Cartão apagado ou ficha trocada depois: a forma que não existe mais vale como a base.
  const formaAtual = formas.find((forma) => forma.id === token.formaVisivel)?.id ?? null
  const auraAtual = lerAura(token.aura)?.tipo ?? null

  const abrir = (qual: AparenciaAberta['qual'], focar: boolean) => {
    onAbrir(qual === 'forma' && motivoDaForma !== null ? null : { qual, focar })
  }
  const fechar = (qual: AparenciaAberta['qual']) => {
    onAbrir(null)
    const pai = qual === 'forma' ? formaRef : auraRef
    pai.current?.focus()
  }
  /** Seta para a direita, Enter e Espaço abrem o submenu com o foco dentro; o resto fica com o menu pai. */
  const teclaNoPai = (qual: AparenciaAberta['qual']) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    abrir(qual, true)
  }

  const escolherForma = (formaId: string | null) => {
    mudarFichaDoToken(tokenId, formaId)
    onClose()
  }
  const escolherAura = (tipo: TipoDeAura | null) => {
    useMapStore.getState().setTokenAura(tokenId, tipo)
    onClose()
  }

  const opcoesDeForma: MiniaturaDoSubmenu[] = [
    { chave: 'base', nome: 'Normal', marcada: formaAtual === null, miniatura: <FotoBase token={token} />, aoEscolher: () => escolherForma(null) },
    ...formas.map((forma) => ({
      chave: `forma-${forma.id}`,
      nome: forma.nome,
      marcada: formaAtual === forma.id,
      miniatura: <ImagemOuIniciais imagem={forma.imagem} nome={forma.nome} />,
      aoEscolher: () => escolherForma(forma.id),
    })),
  ]
  const opcoesDeAura: MiniaturaDoSubmenu[] = [
    { chave: 'sem', nome: 'Sem aura', marcada: auraAtual === null, miniatura: <span className="lb-minis__semaura" />, aoEscolher: () => escolherAura(null) },
    ...AURAS.map((aura) => ({
      chave: aura.tipo,
      nome: aura.nome,
      marcada: auraAtual === aura.tipo,
      miniatura: <MiniaturaDaAura tipo={aura.tipo} />,
      aoEscolher: () => escolherAura(aura.tipo),
    })),
  ]

  return (
    <>
      <button
        ref={formaRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="lb-portamenu__item lb-menusel__pai"
        aria-haspopup="menu"
        aria-expanded={aberta?.qual === 'forma'}
        aria-disabled={motivoDaForma !== null}
        title={motivoDaForma ?? undefined}
        onPointerEnter={(event) => {
          event.currentTarget.focus()
          if (aberta?.qual !== 'forma') abrir('forma', false)
        }}
        onClick={() => (aberta?.qual === 'forma' ? fechar('forma') : abrir('forma', true))}
        onKeyDown={teclaNoPai('forma')}
      >
        <span>Mudar ficha</span>
        <span className="lb-menusel__seta" aria-hidden="true">
          ›
        </span>
      </button>
      {motivoDaForma !== null && <p className="lb-menusel__motivo">{motivoDaForma}</p>}
      {aberta?.qual === 'forma' && motivoDaForma === null && (
        <SubmenuDeMiniaturas rotulo="Mudar ficha" itens={opcoesDeForma} ancora={formaRef.current} focar={aberta.focar} onFechar={() => fechar('forma')} onSair={onClose} />
      )}
      <button
        ref={auraRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="lb-portamenu__item lb-menusel__pai"
        aria-haspopup="menu"
        aria-expanded={aberta?.qual === 'aura'}
        onPointerEnter={(event) => {
          event.currentTarget.focus()
          if (aberta?.qual !== 'aura') abrir('aura', false)
        }}
        onClick={() => (aberta?.qual === 'aura' ? fechar('aura') : abrir('aura', true))}
        onKeyDown={teclaNoPai('aura')}
      >
        <span>Aura</span>
        <span className="lb-menusel__seta" aria-hidden="true">
          ›
        </span>
      </button>
      {aberta?.qual === 'aura' && (
        <SubmenuDeMiniaturas rotulo="Aura" itens={opcoesDeAura} ancora={auraRef.current} focar={aberta.focar} onFechar={() => fechar('aura')} onSair={onClose} />
      )}
    </>
  )
}
