import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { isRightColumnShortcut, RIGHT_COLUMN_SHORTCUT } from '../../lib/keymap'
import { useLivroDaMesaStore, type PaginaDaMesa } from '../../stores/livroDaMesaStore'
import { unreadLabel, type ChatUnread } from '../MasterChatPanel'
import { Balao } from '../grimorio/Balao'
import { Botao } from '../grimorio/Botao'
import { Marcadores, type PaginaDoMarcador } from '../grimorio/Marcador'
import { classes } from '../grimorio/comum'
import { entrarFolha } from './LivroDoMestre'
import { PaginaSons } from './PaginaSons'
import type { PausaDosNpcs } from './TopoDaSala'
import { IconeDoLivro, type NomeDoIcone } from './icones'
import '../grimorio/grimorio.css'
import './livro.css'

const CHAVE_ABERTO = 'lb-coldir:aberta'
/** A altura das Cenas do divisor que saiu (as Cenas viraram página): a chave sai do aparelho. */
const CHAVE_APOSENTADA_ALTURA_DAS_CENAS = 'lb-coldir:cenas'

/** Abaixo desta largura de janela, sem escolha lembrada, o livro fica recolhido mesmo com a sala aberta: os dois livros comeriam o mapa. */
export const LIVRO_DA_MESA_ESTREITO_PX = 1024
/**
 * Abaixo desta largura, sem escolha lembrada e com a sala fechada, o livro fica
 * recolhido (decisão 7 do PLANO.md): sem sala o Grupo, o Chat e a Mesa não têm
 * o que mostrar, e a página aberta tiraria mais 262 px do mapa a 1280.
 */
export const LIVRO_DA_MESA_SALA_FECHADA_PX = 1366

function armazem(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** A escolha que o mestre fez (seta da lombada, Shift+J, um marcador): `null` = nunca escolheu, vale a janela. */
function lerEscolha(): boolean | null {
  try {
    const guardado = armazem()?.getItem(CHAVE_ABERTO)
    if (guardado === '1') return true
    if (guardado === '0') return false
  } catch {
    // Storage bloqueado: vale a largura da janela.
  }
  return null
}

/** As três faixas de janela em que a regra sem escolha muda; entre dois limites o livro não muda. */
type FaixaDaJanela = 'estreita' | 'media' | 'larga'

function faixaDaJanela(largura: number): FaixaDaJanela {
  if (largura >= LIVRO_DA_MESA_SALA_FECHADA_PX) return 'larga'
  return largura >= LIVRO_DA_MESA_ESTREITO_PX ? 'media' : 'estreita'
}

function abertoNaFaixa(faixa: FaixaDaJanela, salaAberta: boolean): boolean {
  return faixa === 'larga' || (salaAberta && faixa === 'media')
}

/** Sem escolha lembrada: aberto na janela larga, ou na média com a sala aberta. */
export function abertoPelaJanela(largura: number, salaAberta: boolean): boolean {
  return abertoNaFaixa(faixaDaJanela(largura), salaAberta)
}

try {
  armazem()?.removeItem(CHAVE_APOSENTADA_ALTURA_DAS_CENAS)
} catch {
  // Storage bloqueado: a chave fica lá, sem efeito nenhum.
}

/**
 * Página à vista ou recolhida na lombada, lembrado entre as sessões (a mesma
 * escolha da coluna da direita de antes). O dono é o App: o chat e o resto da
 * tela leem. Enquanto o mestre não escolhe, o livro segue a janela e a sala
 * (`abertoPelaJanela`), também ao redimensionar; a escolha lembrada vence.
 */
export function useLivroDaMesaAberto(salaAberta: boolean): [boolean, (aberto: boolean) => void] {
  const [escolha, setEscolha] = useState(lerEscolha)
  // Só a faixa vai para o estado: arrastando a borda da janela, a mesma faixa
  // descarta a atualização e o App (dono do hook) só renderiza ao cruzar 1024 ou 1366.
  const [faixa, setFaixa] = useState(() => faixaDaJanela(window.innerWidth))
  useEffect(() => {
    if (escolha !== null) return
    const aoRedimensionar = () => setFaixa(faixaDaJanela(window.innerWidth))
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [escolha])
  const mudar = useCallback((proximo: boolean) => {
    setEscolha(proximo)
    try {
      armazem()?.setItem(CHAVE_ABERTO, proximo ? '1' : '0')
    } catch {
      // Sem armazenamento a escolha vale só nesta sessão.
    }
  }, [])
  return [escolha ?? abertoNaFaixa(faixa, salaAberta), mudar]
}

export interface LivroDaMesaProps {
  /** Página à vista (`false` = recolhida na lombada). */
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  /**
   * O topo da Sala (`TopoDaSala`). Ausente = sem sala possível (navegador puro):
   * o livro fica só com a página Cenas.
   */
  topo?: ReactNode
  grupo?: ReactNode
  chat?: ReactNode
  mesa?: ReactNode
  cenas: ReactNode
  /** Quem pede algo no Grupo (passagem, ficha longe, personagem): o contador do marcador Grupo. */
  pedidos: number
  /** O que o chat ainda não leu: o contador do marcador Chat. */
  naoLidas: ChatUnread
  /** Recebe o que o livro tapa do mapa: o livro aberto, ou só a lombada quando a página está recolhida. */
  obstaculoRef?: RefObject<HTMLElement | null>
}

const PAGINAS: readonly { id: PaginaDaMesa; rotulo: string; icone: NomeDoIcone }[] = [
  { id: 'grupo', rotulo: 'Grupo', icone: 'grupo' },
  { id: 'chat', rotulo: 'Chat', icone: 'chat' },
  { id: 'cenas', rotulo: 'Cenas', icone: 'cenas' },
  { id: 'mesa', rotulo: 'Mesa', icone: 'mesa' },
  { id: 'sons', rotulo: 'Sons', icone: 'som' },
]

/** As páginas que existem sem sala: as Cenas e os Sons (o som local não depende de sala). */
const PAGINAS_SEM_SALA: ReadonlySet<PaginaDaMesa> = new Set(['cenas', 'sons'])

/** Uma página do livro da mesa: todas ficam montadas (o rascunho do chat e o filtro das Cenas sobrevivem) e só a aberta fica à vista. */
function FolhaDaMesa({ pagina, aberta, id, cheia = false, children }: { pagina: PaginaDaMesa; aberta: boolean; id?: string; cheia?: boolean; children: ReactNode }) {
  return (
    <div className={classes('gr-folha', cheia && 'gr-folha--cheia')} data-pagina={pagina} id={id} hidden={!aberta}>
      {cheia ? children : <div className="gr-folha__rolo lb-scroll">{children}</div>}
    </div>
  )
}

/**
 * O LIVRO DA MESA (fatia 4 do design consolidado), o espelho do livro do
 * mestre na borda direita: lombada com Grupo, Chat, Cenas e Mesa (contadores
 * de pedidos e de não lidas), a fita, o recolher (também Shift+J) e o topo da
 * Sala fixo acima das páginas. Substitui a coluna da direita (abas Jogo e Chat
 * e o divisor "Altura das Cenas"). As páginas trazem os componentes de sempre.
 */
export function LivroDaMesa({ aberto, onAbertoChange, topo, grupo, chat, mesa, cenas, pedidos, naoLidas, obstaculoRef }: LivroDaMesaProps) {
  const paginaGuardada = useLivroDaMesaStore((state) => state.pagina)
  const trocaAnimada = useLivroDaMesaStore((state) => state.trocaAnimada)
  const comSala = topo !== undefined
  // Sem sala possível só existem as Cenas e os Sons.
  const pagina: PaginaDaMesa = comSala || PAGINAS_SEM_SALA.has(paginaGuardada) ? paginaGuardada : 'cenas'
  const recolhido = !aberto
  const corpoId = useId()
  const livro = useRef<HTMLElement>(null)
  const lombada = useRef<HTMLDivElement>(null)
  const recolher = useRef<HTMLButtonElement>(null)
  const corpo = useRef<HTMLDivElement>(null)
  // Trocar de página com o ponteiro anima a fita e a folha nova; pelo teclado, troca na hora.
  const peloPonteiro = useRef(false)
  // Recolher e abrir pelo teclado (Shift+J, Enter num marcador) também é na hora: movimento depois de uma tecla parece atraso.
  const [recolheuPeloTeclado, setRecolheuPeloTeclado] = useState(false)

  useLayoutEffect(() => {
    if (obstaculoRef !== undefined) obstaculoRef.current = recolhido ? lombada.current : livro.current
  }, [obstaculoRef, recolhido])

  useLayoutEffect(() => {
    if (!useLivroDaMesaStore.getState().trocaAnimada) return
    entrarFolha(corpo.current?.querySelector<HTMLElement>(`[data-pagina="${pagina}"]`) ?? null)
  }, [pagina])

  // Shift+J de qualquer ponto do editor, menos num campo de texto. Recolher com o
  // foco dentro da página (que fica `inert`) leva o foco ao botão da lombada.
  const abertoAgora = useRef(aberto)
  abertoAgora.current = aberto
  const mudarAberto = useRef(onAbertoChange)
  mudarAberto.current = onAbertoChange
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      const alvo = evento.target instanceof HTMLElement ? evento.target : null
      const apertou = isRightColumnShortcut({
        key: evento.key,
        ctrlKey: evento.ctrlKey,
        metaKey: evento.metaKey,
        shiftKey: evento.shiftKey,
        altKey: evento.altKey,
        targetTagName: alvo?.tagName ?? '',
        targetInputType: alvo instanceof HTMLInputElement ? alvo.type : undefined,
        targetContentEditable: alvo?.isContentEditable ?? false,
      })
      if (!apertou) return
      evento.preventDefault()
      const focoNaPagina = alvo !== null && livro.current?.querySelector('.gr-pagina-trilho')?.contains(alvo) === true
      if (abertoAgora.current && focoNaPagina) recolher.current?.focus()
      setRecolheuPeloTeclado(true)
      mudarAberto.current(!abertoAgora.current)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  const trocarPagina = (destino: PaginaDaMesa) => {
    if (recolhido) {
      setRecolheuPeloTeclado(!peloPonteiro.current)
      onAbertoChange(true)
    }
    if (destino !== useLivroDaMesaStore.getState().pagina) useLivroDaMesaStore.getState().abrirPagina(destino, peloPonteiro.current)
  }

  // Memorizado: o App renderiza a cada mudança do mapa, e um array novo faria a fita reler o layout em todo quadro.
  const marcadores = useMemo<PaginaDoMarcador<PaginaDaMesa>[]>(
    () =>
      PAGINAS.filter((p) => comSala || PAGINAS_SEM_SALA.has(p.id)).map((p) => {
        const icone = <IconeDoLivro nome={p.icone} />
        if (p.id === 'grupo') return { id: p.id, rotulo: p.rotulo, icone, conta: pedidos, rotuloDaConta: pedidos === 1 ? '1 pedido' : `${pedidos} pedidos` }
        if (p.id === 'chat' && naoLidas.count > 0) {
          return { id: p.id, rotulo: p.rotulo, icone, conta: naoLidas.mention ? `@${naoLidas.count}` : naoLidas.count, rotuloDaConta: unreadLabel(naoLidas.count, naoLidas.mention) }
        }
        return { id: p.id, rotulo: p.rotulo, icone }
      }),
    [comSala, pedidos, naoLidas.count, naoLidas.mention],
  )

  const rotuloDoRecolher = recolhido ? 'Abrir a página' : 'Recolher a página'

  return (
    <aside
      className={classes('gr-livro gr-livro--dir', recolhido && 'gr-e-recolhido')}
      aria-label="Livro da mesa"
      ref={livro}
      data-troca={recolheuPeloTeclado ? 'teclado' : undefined}
    >
      <div className="gr-lombada" ref={lombada}>
        <span className="gr-lombada__selo" aria-hidden="true">
          <IconeDoLivro nome="mesa" />
        </span>
        <div
          className="gr-lombada__marcadores"
          onPointerDownCapture={() => {
            peloPonteiro.current = true
          }}
          onKeyDownCapture={() => {
            peloPonteiro.current = false
          }}
        >
          <Marcadores rotulo="Páginas do livro da mesa" paginas={marcadores} atual={pagina} onTrocar={trocarPagina} controla={corpoId} recolhido={recolhido} animar={trocaAnimada} />
        </div>
        <div className="gr-lombada__pe">
          <Balao texto={rotuloDoRecolher} atalho={RIGHT_COLUMN_SHORTCUT}>
            {(gatilho) => (
              <button
                type="button"
                className="gr-lombada__recolher"
                aria-expanded={!recolhido}
                aria-label={rotuloDoRecolher}
                aria-keyshortcuts={RIGHT_COLUMN_SHORTCUT}
                {...gatilho}
                ref={(no) => {
                  gatilho.ref(no)
                  recolher.current = no
                }}
                onClick={(evento) => {
                  // `detail` 0 é Enter ou Espaço: pelo teclado a página troca parada.
                  setRecolheuPeloTeclado(evento.detail === 0)
                  onAbertoChange(recolhido)
                }}
              >
                <IconeDoLivro nome="recolherDir" />
              </button>
            )}
          </Balao>
        </div>
      </div>
      <div className="gr-pagina-trilho" inert={recolhido}>
        {/* Os ids de antes (aba Jogo e aba Chat): as jornadas acham a sala e a conversa por eles. */}
        <div className="gr-pagina" id={comSala ? 'lb-rail-panel-room' : undefined}>
          {comSala && <div className="gr-pagina__topo">{topo}</div>}
          <div ref={corpo} className="gr-pagina__corpo" id={corpoId} role="tabpanel" aria-label="Página aberta">
            {comSala && (
              <>
                <FolhaDaMesa pagina="grupo" aberta={pagina === 'grupo'}>
                  {grupo}
                </FolhaDaMesa>
                <FolhaDaMesa pagina="chat" aberta={pagina === 'chat'} id="lb-rail-panel-chat" cheia>
                  {chat}
                </FolhaDaMesa>
              </>
            )}
            <FolhaDaMesa pagina="cenas" aberta={pagina === 'cenas'}>
              {/* `div` com papel de região, e não `section`: as jornadas acham seções pela tag. */}
              <div className="lb-cenas-pagina" role="region" aria-label="Cenas">
                {cenas}
              </div>
            </FolhaDaMesa>
            {comSala && (
              <FolhaDaMesa pagina="mesa" aberta={pagina === 'mesa'}>
                {mesa}
              </FolhaDaMesa>
            )}
            {/* Sempre montada, com e sem sala: liga a biblioteca à aventura e ouve as teclas 1 a 9 com qualquer página à vista. */}
            <FolhaDaMesa pagina="sons" aberta={pagina === 'sons'}>
              <PaginaSons />
            </FolhaDaMesa>
          </div>
        </div>
      </div>
    </aside>
  )
}

/**
 * A faixa do alto da página Grupo quando há NPC andando sozinho: "Pausar NPCs"
 * congela rotina e patrulha para o mestre narrar (também no "Mais da sala" e
 * pelo atalho). Recolhido o livro, o botão volta para a barra de cima.
 */
export function AvisoDosNpcs({ pausados, onAlternar, atalho }: PausaDosNpcs & { atalho: string }) {
  return (
    <div className="gr-aviso-npc">
      <IconeDoLivro nome="rota" />
      <span>{pausados ? 'NPCs parados' : 'NPCs andando sozinhos'}</span>
      <Botao
        tamanho="p"
        className="gr-empurra"
        aria-pressed={pausados}
        aria-keyshortcuts={atalho}
        title={`${pausados ? 'Retomar' : 'Pausar'} os NPCs que andam sozinhos (${atalho})`}
        onClick={onAlternar}
      >
        {pausados ? 'Retomar NPCs' : 'Pausar NPCs'}
      </Botao>
    </div>
  )
}
