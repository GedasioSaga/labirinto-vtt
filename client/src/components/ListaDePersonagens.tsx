import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  apagarPastaDeFichas,
  comPastaNova,
  grupoDaFicha,
  moverFichaParaPasta,
  NOME_DA_PASTA_DE_FICHAS_MAX,
  NOME_DO_GRUPO,
  novoIdDePastaDeFichas,
  organizarFichas,
  pastaDaFicha,
  renomearPastaDeFichas,
  type GrupoDeFichas,
  type LinhaDeFicha,
  type PastaDeFichas,
} from '../lib/pastasDeFichas'
import type { Personagem } from '../lib/personagem'
import { useAbertaGuardada } from './CollapsibleSection'
import { ImagemOuIniciais } from './FichaPecas'
import { ChevronDownIcon, CloseIcon, FolderIcon } from './icons'

/**
 * A lista do painel Personagens, organizada (pedido de 09/11/2026): as
 * PASTAS DO MESTRE primeiro, depois os grupos Jogadores, NPCs e Inimigos,
 * cada um com contador e setinha (abre e fecha como as Fichas do grimório,
 * `gr-ficha__corpo`). Quem arrasta e solta é o `PersonagensSection`: aqui
 * cada pasta e cada grupo só se marcam como LUGAR DE SOLTAR
 * (`data-solta-pasta`: o id da pasta, ou vazio = "fora de pasta").
 */

/** O singular de cada grupo, para a etiqueta discreta da linha que mora numa pasta do mestre. */
const ETIQUETA_DO_GRUPO: Readonly<Record<GrupoDeFichas, string>> = { jogadores: 'Jogador', npcs: 'NPC', inimigos: 'Inimigo' }

const DICA_DO_GRUPO: Readonly<Record<GrupoDeFichas, string>> = {
  jogadores: 'Fichas de jogador.',
  npcs: 'NPCs sem marca de combate, e os "Só no cenário".',
  inimigos: 'NPCs de combate do bestiário (com força), as cópias e os criados na batalha.',
}

export interface ListaDePersonagensProps {
  personagens: readonly Personagem[]
  pastas: readonly PastaDeFichas[]
  busca: string
  /** O arrasto está no ar: nenhuma linha acende no hover. */
  arrastando: boolean
  /** A linha arrasta para o mapa (e para as pastas). */
  arrasta: boolean
  /** Grava a lista de pastas do mestre; ausente = sem pastas (nada a guardar). */
  onSalvarPastas?: (pastas: readonly PastaDeFichas[]) => void
  /** A pasta que acabou de nascer pelo "Nova pasta": entra com o nome em edição. */
  pastaNova: string | null
  onPastaNovaVista: () => void
  onCriarPasta: (comFicha?: string) => void
  onApertar: (event: ReactPointerEvent<HTMLButtonElement>, personagem: Personagem) => void
  engolirClique: () => boolean
  onAbrirFicha: (personagemId: string) => void
  onApagar: (personagemId: string) => void
}

/** Setas para cima e para baixo passam de um cabeçalho ao outro sem abrir nada (convenção do acordeão). */
function andarEntreCabecalhos(event: KeyboardEvent<HTMLButtonElement>): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const lista = event.currentTarget.closest('.lb-rpg__grupos')
  const cabecalhos = Array.from(lista?.querySelectorAll<HTMLButtonElement>('.lb-rpg__grupo-cab') ?? [])
  const aqui = cabecalhos.indexOf(event.currentTarget)
  if (aqui < 0) return
  event.preventDefault()
  const alvo = event.key === 'Home' ? 0 : event.key === 'End' ? cabecalhos.length - 1 : aqui + (event.key === 'ArrowDown' ? 1 : -1)
  cabecalhos[(alvo + cabecalhos.length) % cabecalhos.length]?.focus()
}

interface GrupoQueFechaProps {
  /** Onde o aberto/fechado fica guardado (por máquina, como as outras seções do painel). */
  chave: string
  titulo: ReactNode
  contagem: number
  /** Buscando: tudo o que bate fica à vista, sem mexer no que ficou guardado. */
  forcarAberta: boolean
  soltaPasta: string
  dica?: string
  /** No lugar do botão do cabeçalho (o nome da pasta em edição). */
  cabecalho?: ReactNode
  acoes?: ReactNode
  aviso?: ReactNode
  children: ReactNode
}

function GrupoQueFecha({ chave, titulo, contagem, forcarAberta, soltaPasta, dica, cabecalho, acoes, aviso, children }: GrupoQueFechaProps) {
  const id = useId()
  const [guardada, setGuardada] = useAbertaGuardada(chave, true)
  const aberta = forcarAberta || guardada
  // Pelo teclado (Enter/Espaço, `detail === 0`) abre e fecha seco: movimento só para o clique.
  const [peloTeclado, setPeloTeclado] = useState(false)
  return (
    <section className={aberta ? 'lb-rpg__grupo lb-rpg__grupo--aberto' : 'lb-rpg__grupo'} data-solta-pasta={soltaPasta} data-seco={peloTeclado ? 'sim' : undefined}>
      <div className="lb-rpg__grupo-topo">
        {cabecalho ?? (
          <button
            type="button"
            className="lb-rpg__grupo-cab"
            aria-expanded={aberta}
            aria-controls={id}
            title={dica}
            onClick={(event) => {
              setPeloTeclado(event.detail === 0)
              setGuardada(!aberta)
            }}
            onKeyDown={andarEntreCabecalhos}
          >
            <span className="lb-rpg__grupo-seta" aria-hidden="true">
              <ChevronDownIcon size={14} />
            </span>
            <span className="lb-rpg__grupo-nome">{titulo}</span>
            <span className="lb-rpg__grupo-conta">{contagem}</span>
          </button>
        )}
        {acoes}
      </div>
      {aviso}
      <div className="lb-rpg__grupo-corpo" id={id} inert={!aberta}>
        <div className="lb-rpg__grupo-miolo">{children}</div>
      </div>
    </section>
  )
}

interface MenuDaPastaProps {
  ancora: HTMLElement
  pastas: readonly PastaDeFichas[]
  atual: string | null
  onEscolher: (pastaId: string | null) => void
  onNova: () => void
  onFechar: (devolverFoco: boolean) => void
}

const FOLGA_DO_MENU = 8

/**
 * "Mover para pasta": o caminho sem arrasto (convenção da lista arrastável).
 * No `body`, com posição fixa: o painel recorta o que passa da borda dele.
 * Foco no primeiro item, setas andam, Esc fecha e devolve o foco ao botão.
 */
function MenuDaPasta({ ancora, pastas, atual, onEscolher, onNova, onFechar }: MenuDaPastaProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (menu === null) return
    const caixa = ancora.getBoundingClientRect()
    const largura = menu.offsetWidth
    const altura = menu.offsetHeight
    const left = Math.max(FOLGA_DO_MENU, Math.min(caixa.right - largura, window.innerWidth - largura - FOLGA_DO_MENU))
    const abaixo = caixa.bottom + 4
    const top = abaixo + altura + FOLGA_DO_MENU > window.innerHeight ? Math.max(FOLGA_DO_MENU, caixa.top - altura - 4) : abaixo
    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
    menu.querySelector<HTMLButtonElement>('[role^="menuitem"]')?.focus()
  }, [ancora])

  useEffect(() => {
    const fora = (event: PointerEvent) => {
      if (event.target instanceof Node && (menuRef.current?.contains(event.target) || ancora.contains(event.target))) return
      onFechar(false)
    }
    // O painel rolou: o menu fixo ficaria solto no ar.
    const rolou = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      onFechar(false)
    }
    document.addEventListener('pointerdown', fora)
    window.addEventListener('scroll', rolou, true)
    return () => {
      document.removeEventListener('pointerdown', fora)
      window.removeEventListener('scroll', rolou, true)
    }
  }, [ancora, onFechar])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const itens = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])
    const aqui = itens.findIndex((item) => item === document.activeElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      onFechar(true)
    } else if (event.key === 'Tab') {
      onFechar(false)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const alvo = event.key === 'Home' ? 0 : event.key === 'End' ? itens.length - 1 : aqui + (event.key === 'ArrowDown' ? 1 : -1)
      itens[(alvo + itens.length) % itens.length]?.focus()
    }
  }

  return createPortal(
    <div ref={menuRef} className="lb-panel lb-portamenu lb-rpg__menu-pasta gr-anima" role="menu" aria-label="Mover para pasta" onKeyDown={onKeyDown}>
      {pastas.map((pasta) => (
        <button
          key={pasta.id}
          type="button"
          role="menuitemradio"
          aria-checked={atual === pasta.id}
          tabIndex={-1}
          className="lb-portamenu__item lb-menusel__camada"
          onPointerEnter={(event) => event.currentTarget.focus()}
          onClick={() => onEscolher(pasta.id)}
        >
          <span className="lb-menusel__marca" aria-hidden="true">
            {atual === pasta.id ? '✓' : ''}
          </span>
          <span className="lb-menusel__nome">{pasta.nome}</span>
        </button>
      ))}
      {atual !== null && (
        <button type="button" role="menuitem" tabIndex={-1} className="lb-portamenu__item" onPointerEnter={(event) => event.currentTarget.focus()} onClick={() => onEscolher(null)}>
          Tirar da pasta
        </button>
      )}
      <button type="button" role="menuitem" tabIndex={-1} className="lb-portamenu__item" onPointerEnter={(event) => event.currentTarget.focus()} onClick={onNova}>
        Nova pasta…
      </button>
    </div>,
    document.body,
  )
}

interface LinhaDaFichaProps {
  linha: LinhaDeFicha
  /** A etiqueta discreta (só na pasta do mestre: no grupo, o próprio grupo já diz). */
  etiqueta: string | null
  ehCopia: boolean
  forcarCopias: boolean
  arrasta: boolean
  pastas: readonly PastaDeFichas[] | null
  pastaAtual: string | null
  onMover: (pastaId: string | null) => void
  onCriarPasta: () => void
  onApertar: ListaDePersonagensProps['onApertar']
  engolirClique: () => boolean
  onAbrirFicha: (personagemId: string) => void
  onApagar: (personagemId: string) => void
}

function LinhaDaFicha({ linha, etiqueta, ehCopia, forcarCopias, arrasta, pastas, pastaAtual, onMover, onCriarPasta, onApertar, engolirClique, onAbrirFicha, onApagar }: LinhaDaFichaProps) {
  const { personagem, copias, totalDeCopias } = linha
  const idDasCopias = useId()
  const [copiasAbertas, setCopiasAbertas] = useState(false)
  const [copiasPeloTeclado, setCopiasPeloTeclado] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const botaoDaPastaRef = useRef<HTMLButtonElement | null>(null)
  const removerRef = useRef<HTMLButtonElement | null>(null)
  const nome = personagem.nome || 'Personagem sem nome'
  const mostraCopias = copias.length > 0 && (forcarCopias || copiasAbertas)

  const fecharMenu = (devolverFoco: boolean) => {
    setMenu(null)
    if (devolverFoco) botaoDaPastaRef.current?.focus()
  }

  return (
    <li className={ehCopia ? 'lb-rpg__linha lb-rpg__linha--copia' : 'lb-rpg__linha'} data-apagando={apagando ? 'sim' : undefined} data-seco={copiasPeloTeclado ? 'sim' : undefined}>
      <div className="lb-rpg__linha-topo">
        <button
          type="button"
          className="lb-rpg__abrir"
          title={arrasta ? 'Clique para abrir a ficha. Arraste até o mapa para pôr o token, ou solte em cima de um token para ligar a ficha a ele.' : undefined}
          onPointerDown={(event) => onApertar(event, personagem)}
          // O retrato é um <img>: sem isto o navegador começa o arrasto nativo dele e cancela o nosso.
          onDragStart={(event) => event.preventDefault()}
          onClick={() => {
            if (!engolirClique()) onAbrirFicha(personagem.id)
          }}
        >
          <span className="lb-rpg__retrato">
            <ImagemOuIniciais imagem={personagem.retrato} nome={personagem.nome} />
          </span>
          <span className="lb-rpg__texto">
            {/* O nome inteiro na dica: o que passa de duas linhas termina em reticências. */}
            <span className="lb-rpg__nome" title={nome}>
              {nome}
            </span>
            {etiqueta !== null && <span className="lb-rpg__etiqueta">{etiqueta}</span>}
          </span>
        </button>
        <span className="lb-rpg__acoes">
          {pastas !== null && (
            <button
              ref={botaoDaPastaRef}
              type="button"
              className="lb-rpg__acao"
              aria-label={`Mover ${nome} para uma pasta`}
              title="Mover para pasta"
              aria-haspopup="menu"
              aria-expanded={menu !== null}
              onClick={(event) => setMenu(menu === null ? event.currentTarget : null)}
            >
              <FolderIcon size={14} />
            </button>
          )}
          <button ref={removerRef} type="button" className="lb-rpg__acao lb-rpg__remover" aria-label={`Apagar ${nome}`} title="Apagar personagem" onClick={() => setApagando(true)}>
            <CloseIcon size={14} />
          </button>
        </span>
      </div>
      {totalDeCopias > 0 && (
        // Embaixo do nome, sempre à vista: as ações da linha aparecem por cima do fim dela e não podem cobrir isto.
        <button
          type="button"
          className="lb-rpg__copias"
          aria-expanded={mostraCopias}
          aria-controls={idDasCopias}
          disabled={copias.length === 0}
          title="Cada token com a própria vida. Mudar o modelo muda todas as cópias."
          onClick={(event) => {
            setCopiasPeloTeclado(event.detail === 0)
            setCopiasAbertas(!mostraCopias)
          }}
        >
          <span className="lb-rpg__copias-seta" aria-hidden="true">
            <ChevronDownIcon size={12} />
          </span>
          {totalDeCopias === 1 ? '1 cópia' : `${totalDeCopias} cópias`}
        </button>
      )}
      {menu !== null && pastas !== null && (
        <MenuDaPasta
          ancora={menu}
          pastas={pastas}
          atual={pastaAtual}
          onEscolher={(pastaId) => {
            onMover(pastaId)
            fecharMenu(true)
          }}
          onNova={() => {
            setMenu(null)
            onCriarPasta()
          }}
          onFechar={fecharMenu}
        />
      )}
      {apagando && (
        <div className="lb-rpg__confirma" role="group" aria-label={`Apagar ${nome}?`}>
          <span className="lb-rpg__confirma-texto">
            Apagar {nome}?{totalDeCopias > 0 ? ` As ${totalDeCopias} cópias ficam como fichas soltas.` : ''}
          </span>
          <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => onApagar(personagem.id)}>
            Apagar
          </button>
          <button
            type="button"
            className="lb-btn lb-btn--ghost lb-btn--compact"
            // A decisão acabou de aparecer no lugar do ×: o foco vai nela (o Manter, que não apaga nada).
            autoFocus
            onClick={() => {
              setApagando(false)
              requestAnimationFrame(() => removerRef.current?.focus())
            }}
          >
            Manter
          </button>
        </div>
      )}
      {totalDeCopias > 0 && (
        <div className={mostraCopias ? 'lb-rpg__grupo-corpo lb-rpg__copias-corpo lb-e-aberto' : 'lb-rpg__grupo-corpo lb-rpg__copias-corpo'} id={idDasCopias} inert={!mostraCopias}>
          <div className="lb-rpg__grupo-miolo">
            <ul className="lb-rpg__lista lb-rpg__lista--copias" aria-label={`Cópias de ${nome}`}>
              {copias.map((copia) => (
                <LinhaDaFicha
                  key={copia.id}
                  linha={{ personagem: copia, copias: [], totalDeCopias: 0 }}
                  etiqueta={null}
                  ehCopia
                  forcarCopias={false}
                  arrasta={arrasta}
                  pastas={null}
                  pastaAtual={null}
                  onMover={() => undefined}
                  onCriarPasta={() => undefined}
                  onApertar={onApertar}
                  engolirClique={engolirClique}
                  onAbrirFicha={onAbrirFicha}
                  onApagar={onApagar}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  )
}

interface NomeDaPastaEmEdicaoProps {
  nome: string
  onFim: (nome: string | null) => void
}

/** O nome da pasta no lugar do cabeçalho: Enter grava, Esc desiste, sair do campo grava. */
function NomeDaPastaEmEdicao({ nome, onFim }: NomeDaPastaEmEdicaoProps) {
  const feito = useRef(false)
  const fim = (valor: string | null) => {
    if (feito.current) return
    feito.current = true
    onFim(valor)
  }
  return (
    <input
      className="lb-input lb-rpg__pasta-nome"
      aria-label="Nome da pasta"
      defaultValue={nome}
      maxLength={NOME_DA_PASTA_DE_FICHAS_MAX}
      // O campo acabou de aparecer porque o mestre pediu para dar nome.
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') {
          event.preventDefault()
          fim(event.currentTarget.value)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          fim(null)
        }
      }}
      onBlur={(event) => fim(event.currentTarget.value)}
    />
  )
}

export function ListaDePersonagens(props: ListaDePersonagensProps) {
  const { personagens, pastas, busca, arrastando, arrasta, onSalvarPastas, pastaNova, onPastaNovaVista, onCriarPasta } = props
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [apagandoPasta, setApagandoPasta] = useState<string | null>(null)
  const organizadas = organizarFichas(personagens, pastas, busca)
  const buscando = busca.trim().length > 0
  const editando = pastaNova ?? renomeando

  const salvar = (novas: readonly PastaDeFichas[]) => onSalvarPastas?.(novas)
  const mover = (fichaId: string, pastaId: string | null) => {
    const novas = moverFichaParaPasta(pastas, fichaId, pastaId)
    if (novas !== pastas) salvar(novas)
  }

  const linhas = (lista: readonly LinhaDeFicha[], naPasta: boolean) => (
    <ul className={arrastando ? 'lb-rpg__lista lb-rpg__lista--arrastando' : 'lb-rpg__lista'}>
      {lista.map((linha) => (
        <LinhaDaFicha
          key={linha.personagem.id}
          linha={linha}
          etiqueta={naPasta ? ETIQUETA_DO_GRUPO[grupoDaFicha(linha.personagem)] : null}
          ehCopia={false}
          forcarCopias={buscando}
          arrasta={arrasta}
          pastas={onSalvarPastas === undefined ? null : pastas}
          pastaAtual={pastaDaFicha(pastas, linha.personagem.id)?.id ?? null}
          onMover={(pastaId) => mover(linha.personagem.id, pastaId)}
          onCriarPasta={() => onCriarPasta(linha.personagem.id)}
          onApertar={props.onApertar}
          engolirClique={props.engolirClique}
          onAbrirFicha={props.onAbrirFicha}
          onApagar={props.onApagar}
        />
      ))}
    </ul>
  )

  return (
    <div className="lb-rpg__grupos" aria-label="Personagens da aventura" role="group">
      {organizadas.pastas.map(({ pasta, linhas: daPasta }) => (
        <GrupoQueFecha
          key={pasta.id}
          chave={`personagens-pasta-${pasta.id}`}
          titulo={
            <>
              <FolderIcon size={14} />
              <span className="lb-rpg__grupo-texto">{pasta.nome}</span>
            </>
          }
          contagem={daPasta.length}
          forcarAberta={buscando || editando === pasta.id}
          soltaPasta={pasta.id}
          cabecalho={
            editando === pasta.id ? (
              <NomeDaPastaEmEdicao
                nome={pasta.nome}
                onFim={(nome) => {
                  setRenomeando(null)
                  onPastaNovaVista()
                  if (nome !== null && nome.trim() !== pasta.nome) salvar(renomearPastaDeFichas(pastas, pasta.id, nome))
                }}
              />
            ) : undefined
          }
          acoes={
            editando === pasta.id ? undefined : (
              <span className="lb-rpg__acoes">
                <button type="button" className="lb-rpg__acao lb-rpg__acao--texto" aria-label={`Renomear a pasta ${pasta.nome}`} title="Renomear" onClick={() => setRenomeando(pasta.id)}>
                  Renomear
                </button>
                <button type="button" className="lb-rpg__acao lb-rpg__remover" aria-label={`Apagar a pasta ${pasta.nome}`} title="Apagar a pasta (as fichas ficam)" onClick={() => setApagandoPasta(pasta.id)}>
                  <CloseIcon size={14} />
                </button>
              </span>
            )
          }
          aviso={
            apagandoPasta === pasta.id ? (
              <div className="lb-rpg__confirma" role="group" aria-label={`Apagar a pasta ${pasta.nome}?`}>
                <span className="lb-rpg__confirma-texto">
                  Apagar a pasta {pasta.nome}? {pasta.fichas.length > 0 ? 'As fichas voltam para os grupos; nenhuma é apagada.' : 'Ela está vazia.'}
                </span>
                <button
                  type="button"
                  className="lb-btn lb-btn--danger lb-btn--compact"
                  onClick={() => {
                    setApagandoPasta(null)
                    salvar(apagarPastaDeFichas(pastas, pasta.id))
                  }}
                >
                  Apagar pasta
                </button>
                <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" autoFocus onClick={() => setApagandoPasta(null)}>
                  Manter
                </button>
              </div>
            ) : undefined
          }
        >
          {daPasta.length === 0 ? <p className="lb-rpg__vazio-pasta">Vazia. Arraste fichas para cá, ou use o ícone de pasta de cada linha.</p> : linhas(daPasta, true)}
        </GrupoQueFecha>
      ))}
      {organizadas.grupos.map(({ grupo, linhas: doGrupo }) => (
        <GrupoQueFecha
          key={grupo}
          chave={`personagens-grupo-${grupo}`}
          titulo={NOME_DO_GRUPO[grupo]}
          contagem={doGrupo.length}
          forcarAberta={buscando}
          soltaPasta=""
          dica={DICA_DO_GRUPO[grupo]}
        >
          {linhas(doGrupo, false)}
        </GrupoQueFecha>
      ))}
      {buscando && organizadas.vistas === 0 && (
        <p className="lb-rpg__vazio" role="status">
          Nenhum personagem com “{busca.trim()}”. A busca olha só o nome.
        </p>
      )}
    </div>
  )
}

/** A pasta que o "Nova pasta" cria: o id volta para o campo do nome abrir nela. */
export function pastasComANova(pastas: readonly PastaDeFichas[], comFicha?: string): { pastas: PastaDeFichas[]; id: string } {
  const id = novoIdDePastaDeFichas()
  const nova = comPastaNova(pastas, { id, nome: 'Pasta nova', fichas: [] })
  return { pastas: comFicha === undefined ? nova : [...moverFichaParaPasta(nova, comFicha, id)], id }
}
