import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { GRADES_DA_ARENA } from '../../../lib/arena/grade'
import { CENA_DA_ARENA } from '../../../lib/arena/tipos'
import type { ResolverDeImagem } from '../../../lib/midia'
import type { Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { vidasDaCena } from '../../../lib/vidaDaFicha'
import type { FotosDaForma, SelosNasFichas } from '../../../pixi/tokenPhotoSprite'
import type { CenaDBT } from '../../../stores/batalhaDBTStore'
import { batalhaDaArenaDBT, ID_DO_TOKEN_DO_JUDGE, useArenaDBTStore, type SessaoDaArenaDBT } from '../../../stores/arenaDBTStore'
import { useMundoDoLivroStore, usePersonagensDoMundo } from '../../../stores/mundoDoLivroStore'
import { useToastStore } from '../../../stores/toastStore'
import type { Token } from '../../../types/map'
import { PalcoDaArena } from '../../arena/PalcoDaArena'
import { useImagemDaMesa } from '../../ImagemDaMesa'
import { IconeDoMundo } from '../../livros/icones'
import { fichasProntasDoLivro, useProntosDaArenaDBT } from './npcsProntosDaArena'
import { PainelDaArenaDBT } from './PainelDaArenaDBT'
import '../ficha/fichaDBT.css'
import '../batalha/batalhaDBT.css'
import './arenaDBT.css'

/**
 * A LUTA DA ARENA DRAGON BALL em tela cheia, por cima do mundo do livro:
 *
 * - a barra do alto: "Arena de testes", a rodada, Desfazer (Ctrl+Z),
 *   Recomeçar, Voltar à montagem e Sair da arena;
 * - à esquerda o palco (`PalcoDaArena`, o Pixi genérico da arena): arrastar
 *   ficha, boneco ou o Judge anda na grade; clicar numa ficha com "Escolher
 *   no palco" ligado a marca como alvo;
 * - à direita o painel do mestre (`PainelDaArenaDBT`), com o registro.
 *
 * Toda ação vai à `batalhaDaArenaDBT` com o autor mestre; a arena só grava
 * nas cópias. Nenhuma tecla daqui vaza para o mundo nem para o editor atrás
 * (o Esc do mundo fecharia o livro; o Ctrl+Z do editor desfaria o mapa).
 */

export interface TelaDaArenaDBTProps {
  sistema: SistemaDeRpg
}

const SEM_FICHAS: readonly Personagem[] = []
const SEM_SELOS: SelosNasFichas = new Map()
const SEM_FOTOS: FotosDaForma = new Map()
/** A cor do disco do Judge no palco (neutra: ele não é de lado nenhum). */
const COR_DO_JUDGE = '#8a7f6a'

/** O palco não precisa achar fichas na tela: a mira daqui é pelo clique. */
function semConsulta(): void {}

function emCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  return alvo.isContentEditable || alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT'
}

/** O retrato de cada cópia sem foto embutida no token (o de mídia, `midia:`, da pasta), pelo resolvedor da mesa. */
function fotosDoPalco(tokens: readonly Token[], copias: readonly Personagem[], resolver: ResolverDeImagem): FotosDaForma {
  const fotos = new Map<string, string>()
  for (const token of tokens) {
    if ((token.imageData ?? null) !== null || token.characterId === null) continue
    const src = resolver(copias.find((copia) => copia.id === token.characterId)?.retrato)
    if (src !== null) fotos.set(token.id, src)
  }
  return fotos.size === 0 ? SEM_FOTOS : fotos
}

function desfazerNaArena(): void {
  if (!useArenaDBTStore.getState().desfazer()) useToastStore.getState().push('info', 'Nada para desfazer na arena.')
}

function recomecar(fichas: readonly Personagem[]): void {
  const toasts = useToastStore.getState()
  if (useArenaDBTStore.getState().recomecar(fichas)) toasts.push('info', 'Recomeçado: cópias novas, cheias, nas posições do início.')
  else toasts.push('error', 'Não deu para recomeçar: falta alguém num dos lados. Volte à montagem e escolha de novo.')
}

interface LutaProps {
  sessao: SessaoDaArenaDBT
  cena: CenaDBT
  sistema: SistemaDeRpg
}

function Luta({ sessao, cena, sistema }: LutaProps) {
  const resolver = useImagemDaMesa()
  const [mirando, setMirando] = useState(false)
  const [alvo, setAlvo] = useState<{ tokenId: string; seq: number } | null>(null)

  const grade = GRADES_DA_ARENA[sessao.montagem.grade]
  const judge = cena.judge ?? null
  const tokens = useMemo<Token[]>(
    () =>
      judge === null
        ? sessao.tokens
        : [...sessao.tokens, { id: ID_DO_TOKEN_DO_JUDGE, characterId: null, name: 'Judge', x: judge.x, y: judge.y, size: 1, image: null, imageData: null, color: COR_DO_JUDGE }],
    [sessao.tokens, judge],
  )
  const vidas = useMemo(() => vidasDaCena(sessao.tokens, sessao.copias, sistema), [sessao.tokens, sessao.copias, sistema])
  const fotos = useMemo(() => fotosDoPalco(sessao.tokens, sessao.copias, resolver), [sessao.tokens, sessao.copias, resolver])
  const vezTokenId = cena.ordem.vez
  const tokenDaVez = vezTokenId === null ? undefined : sessao.tokens.find((token) => token.id === vezTokenId)
  const judgeAlvo = tokenDaVez === undefined ? null : { x: tokenDaVez.x, y: tokenDaVez.y }
  const mira = useMemo(() => ({ ligada: mirando, onLigar: setMirando, alvo }), [mirando, alvo])

  return (
    <>
      <div className="dba-palco" data-mirando={mirando ? 'sim' : undefined}>
        <PalcoDaArena
          tokens={tokens}
          grade={grade}
          vezTokenId={vezTokenId}
          vidas={vidas}
          selos={SEM_SELOS}
          fotoDaForma={fotos}
          judge={judge}
          judgeAlvo={judgeAlvo}
          gestoDoJudge={sessao.gesto > 0 ? sessao.gesto : null}
          bonecoTokenId={judge === null ? null : ID_DO_TOKEN_DO_JUDGE}
          onMover={(tokenId, x, y) => {
            useArenaDBTStore.getState().moverFicha(tokenId, x, y)
          }}
          onTocarFicha={(tokenId) => {
            if (tokenId !== ID_DO_TOKEN_DO_JUDGE) setAlvo((antes) => ({ tokenId, seq: (antes?.seq ?? 0) + 1 }))
          }}
          onConsulta={semConsulta}
        />
        <p className="dba-palco__dica">Arraste fichas, bonecos e o Judge. Roda do mouse aproxima; duplo clique no vazio enquadra.</p>
      </div>
      <aside className="dba-lateral" aria-label="Painel do mestre">
        <PainelDaArenaDBT sessao={sessao} cena={cena} sistema={sistema} mira={mira} />
      </aside>
    </>
  )
}

interface AcoesDaBarraProps {
  sessao: SessaoDaArenaDBT
  cena: CenaDBT
  /** As fichas reais de agora (o Recomeçar copia de novo). */
  fichas: readonly Personagem[]
}

/** A rodada, a grade e as saídas, na barra do alto. */
function AcoesDaBarra({ sessao, cena, fichas }: AcoesDaBarraProps) {
  const grade = GRADES_DA_ARENA[sessao.montagem.grade]
  return (
    <div className="dba-barra__acoes">
      <span className="dba-barra__rodada">{cena.fase === 'iniciativa' ? 'Iniciativa' : `Rodada ${cena.ordem.rodada}`}</span>
      <span className="dba-barra__grade">
        {grade.colunas} × {grade.linhas}
      </span>
      <button type="button" className="dbf-btn dbf-btn--sm" aria-keyshortcuts="Control+Z" title="Volta a última coisa feita na arena (Ctrl+Z)" onClick={desfazerNaArena}>
        Desfazer
      </button>
      <button type="button" className="dbf-btn dbf-btn--sm" title="Cópias novas e cheias, posições do início" onClick={() => recomecar(fichas)}>
        Recomeçar
      </button>
      <button type="button" className="dbf-btn dbf-btn--sm" onClick={() => useArenaDBTStore.getState().voltarAMontagem()}>
        Voltar à montagem
      </button>
      <button
        type="button"
        className="dbf-btn dbf-btn--sm dbf-btn--ghost"
        onClick={() => {
          useArenaDBTStore.getState().sair()
          useMundoDoLivroStore.getState().trocarAba('jogadores')
        }}
      >
        Sair da arena
      </button>
    </div>
  )
}

export function TelaDaArenaDBT({ sistema }: TelaDaArenaDBTProps) {
  const sessao = useArenaDBTStore((state) => state.sessao)
  const cena = batalhaDaArenaDBT((state) => (Object.hasOwn(state.cenas, CENA_DA_ARENA) ? state.cenas[CENA_DA_ARENA] : undefined))
  const fichasReais = usePersonagensDoMundo()
  // O Recomeçar copia de novo também os NPCs prontos do livro que estão na montagem.
  const prontos = useProntosDaArenaDBT((state) => (sessao === null ? SEM_FICHAS : fichasProntasDoLivro(state, sessao.sistemaId)))
  const fichas = useMemo(() => [...(fichasReais ?? SEM_FICHAS), ...prontos], [fichasReais, prontos])
  const raiz = useRef<HTMLElement>(null)
  const tituloId = useId()

  // Ao abrir, o foco entra na arena (o título); ao fechar, volta para quem a abriu, se ainda estiver na tela.
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    raiz.current?.querySelector<HTMLElement>('.dba-barra__tit')?.focus()
    return () => {
      if (antes !== null && antes.isConnected && !antes.matches(':disabled')) antes.focus()
    }
  }, [])

  // O botão clicado some (Usar, Aplicar, Não reagir) e o foco cai no <body>: a tecla não passa
  // pela seção, e o Ctrl+Z do editor (App) desfaria o mapa de verdade atrás da arena, em silêncio.
  // Enquanto a luta está aberta, a tecla sem dono é da arena.
  const lutando = sessao !== null && sessao.fase === 'lutando'
  useEffect(() => {
    if (!lutando) return
    const semDono = (evento: WindowEventMap['keydown']) => {
      if (evento.target !== document.body && evento.target !== document.documentElement) return
      evento.stopPropagation()
      const z = evento.key === 'z' || evento.key === 'Z'
      if (!z || !(evento.ctrlKey || evento.metaKey) || evento.shiftKey || evento.altKey) return
      evento.preventDefault()
      desfazerNaArena()
    }
    window.addEventListener('keydown', semDono, true)
    return () => window.removeEventListener('keydown', semDono, true)
  }, [lutando])

  if (sessao === null || sessao.fase !== 'lutando') return null

  const teclas = (evento: KeyboardEvent<HTMLElement>) => {
    // Nenhuma tecla daqui vale como atalho do mundo nem do editor atrás.
    evento.stopPropagation()
    const z = evento.key === 'z' || evento.key === 'Z'
    if (!z || !(evento.ctrlKey || evento.metaKey) || evento.shiftKey || evento.altKey || evento.defaultPrevented || emCampoDeTexto(evento.target)) return
    evento.preventDefault()
    desfazerNaArena()
  }

  return createPortal(
    <section ref={raiz} className="dba-tela" aria-labelledby={tituloId} onKeyDown={teclas}>
      <header className="dbf dba-barra">
        <span className="dba-barra__med" aria-hidden="true">
          <IconeDoMundo nome="boneco" />
        </span>
        <div className="dba-barra__txt">
          <h1 className="dba-barra__tit" id={tituloId} tabIndex={-1}>
            Arena de testes
          </h1>
          <p className="dba-barra__sub">
            <IconeDoMundo nome="copia" />
            <span>Dragon Ball · cópias: nada mexe nas fichas de verdade</span>
          </p>
        </div>
        {cena !== undefined && <AcoesDaBarra sessao={sessao} cena={cena} fichas={fichas} />}
      </header>
      {cena === undefined ? (
        <p className="dba-ligando" aria-busy="true">
          Ligando a batalha da arena…
        </p>
      ) : (
        <Luta sessao={sessao} cena={cena} sistema={sistema} />
      )}
    </section>,
    document.body,
  )
}
