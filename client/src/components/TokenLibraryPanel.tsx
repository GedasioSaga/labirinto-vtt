import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { convertFileSrc } from '@tauri-apps/api/core'
import { ehPastaPadrao, type ItemDoAcervoNaTela, type PastaDoAcervo } from '../lib/tokenLibrary'
import { ChevronDownIcon, FolderIcon } from './icons'

export interface TokenLibraryPanelProps {
  itens: readonly ItemDoAcervoNaTela[]
  /** Pastas da estante, na ordem do índice. */
  pastas: readonly PastaDoAcervo[]
  /** Frase de `listarAcervo` quando o acervo não pôde ser lido; `null` = tudo certo. */
  aviso: string | null
  /**
   * Há disco onde gravar as pastas? `false` no app aberto no navegador: lá o
   * acervo nem é oferecido, e um "+ Nova pasta" que só devolve erro seria uma
   * promessa falsa.
   */
  podeOrganizar: boolean
  /** Coloca uma cópia do item no mapa aberto, com o nome e a foto dele. */
  onPlace: (item: ItemDoAcervoNaTela) => void
  /**
   * O item foi ARRASTADO e solto neste ponto da tela (px de janela). Quem
   * monta a tela decide se ali é o mapa: devolve `true` quando pôs a ficha,
   * `false` quando o ponto não aceita (painel, barra) e nada acontece.
   */
  onDropOnMap: (item: ItemDoAcervoNaTela, clientX: number, clientY: number) => boolean
  /** Apaga do disco. O componente só chama depois da confirmação. */
  onDelete: (item: ItemDoAcervoNaTela) => void
  /** Cria a pasta com o nome digitado; vazio vira "Pasta nova" na gravação. */
  onCriarPasta: (nome: string) => void
  /** Põe o token na pasta `pasta`, ou fora de pasta com `null`. */
  onMover: (item: ItemDoAcervoNaTela, pasta: string | null) => void
  onRecolherPasta: (pasta: PastaDoAcervo, recolhida: boolean) => void
  /** Apaga só a pasta; os tokens dela voltam para "Sem pasta". Com tokens dentro, só depois da confirmação. */
  onApagarPasta: (pasta: PastaDoAcervo) => void
}

/** Texto do estado vazio — é o que a pessoa lê antes de salvar o primeiro NPC. */
export const ACERVO_VAZIO = 'Nenhum token no acervo ainda.'

/**
 * Como a estante enche, dito no estado vazio (achado 12 do passeio de
 * 20/09/2026). "Adicionar token" põe a peça no MAPA, sem foto, e o acervo só
 * guarda token COM foto (`guardarNoAcervo` recusa sem ela) — quem adicionava
 * um token esperava vê-lo aqui e só lia "Nenhum token". Cabe numa linha do
 * rail (moldura enxuta, 27/09/2026: o estado vazio é uma faixa de até duas
 * linhas, como o Explorer do VS Code sem pasta). O passo a passo mora na ficha
 * do token, em "Imagem do token": "Escolher imagem..." e "Salvar no acervo",
 * que sem foto responde por que não dá (`SEM_FOTO_PARA_SALVAR`).
 */
export const ACERVO_COMO_ENCHER = 'Salve um token com foto para vê-lo aqui.'

/** Nome do grupo dos tokens que não estão em pasta nenhuma — e do destino que os tira de lá. */
const SEM_PASTA = 'Sem pasta'

/** Cabe na coluna estreita do rail sem reticências na maioria dos nomes. */
const NOME_DE_PASTA_MAX = 40

/**
 * Marca o elemento que aceita um token SOLTO em cima: o valor é o `id` da
 * pasta, ou vazio para "Sem pasta".
 */
const ATRIBUTO_DE_PASTA = 'data-acervo-pasta'

/** Quanto o ponteiro anda (px) antes de o aperto virar arrasto; abaixo disso é clique. */
const LIMIAR_DO_ARRASTO_PX = 6

/**
 * Caminho do disco → referência que o `<img>` carrega.
 *
 * `convertFileSrc` é a ponte de asset do Tauri e não existe no navegador: o
 * painel continua montado lá (com os itens vazios), e um `throw` aqui derrubaria
 * a tela inteira por causa de uma miniatura. Mesmo cuidado de
 * `pixi/tokensRenderer.ts` com `convertFileSrc(undefined)`.
 */
function fonteDaFoto(caminho: string): string | null {
  try {
    return convertFileSrc(caminho)
  } catch {
    return null
  }
}

/** Leva o fantasma ao ponteiro, centrado nele. Estilo direto: sem render do React por quadro. */
function posicionarFantasma(fantasma: HTMLElement, ponto: { x: number; y: number }): void {
  fantasma.style.transform = `translate(${ponto.x}px, ${ponto.y}px) translate(-50%, -50%)`
}

/**
 * A pasta sob o ponteiro, e só se ela for DESTE painel; `null` fora de todas.
 * `elementFromPoint` enxerga através do fantasma porque ele tem
 * `pointer-events: none` (ver `.lb-acervo__fantasma` em `main.css`).
 */
function pastaSobOPonteiro(raiz: HTMLElement | null, x: number, y: number): HTMLElement | null {
  if (raiz === null || typeof document.elementFromPoint !== 'function') return null
  const alvo = document.elementFromPoint(x, y)?.closest<HTMLElement>(`[${ATRIBUTO_DE_PASTA}]`) ?? null
  return alvo !== null && raiz.contains(alvo) ? alvo : null
}

/** O aperto em curso sobre um nome da estante. */
interface ApertoNoItem {
  item: ItemDoAcervoNaTela
  pointerId: number
  inicio: { x: number; y: number }
  /** Passou do limiar: é arrasto, não clique. */
  arrastando: boolean
  /** Esc no meio do arrasto: o soltar seguinte não põe nada. */
  cancelado: boolean
}

/** Qual pergunta em linha está aberta — uma de cada vez, para a coluna estreita não virar um formulário. */
type Pergunta =
  | { tipo: 'apagar-token'; id: string }
  | { tipo: 'mover-token'; id: string }
  | { tipo: 'apagar-pasta'; id: string }
  | null

/**
 * ACERVO DE TOKENS PRONTOS — a estante de NPCs do mestre.
 *
 * Nas palavras do usuário (18/09/2026): "eu queria que eu pudesse salvar Tokens
 * pre prontos, tipos tokens de npcs e afins para colocar para os jogadores".
 * Salvou o goblin uma vez, ele fica em QUALQUER mapa.
 *
 * Fica FORA do gate de `ToolPropertiesSection`: o acervo não é propriedade da
 * ferramenta nem da seleção, e esconder a estante quando nada está selecionado
 * é justamente esconder no momento em que a pessoa vai pegar o NPC.
 *
 * DOIS JEITOS DE PÔR NO MAPA: o clique no nome (e Enter/Espaço, pelo teclado)
 * põe a peça no centro da vista; ARRASTAR o nome até o mapa a põe onde o
 * ponteiro soltar (achado 12 do passeio de 20/09/2026). O arrasto é de
 * ponteiro, não o drag-and-drop do HTML: o alvo é o canvas do Pixi, que não
 * fala `dragover`/`drop`. Durante o gesto só o fantasma se move (estilo
 * direto); a lista não re-renderiza a cada quadro. Soltar fora do mapa ou
 * apertar Esc desiste sem pôr nada.
 *
 * PASTAS (26/09/2026): NPCs, Veículos, Jogadores e as que o mestre criar, como
 * as pastas do diretório de Atores do Foundry VTT. O MESMO arrasto que leva ao
 * mapa, solto sobre uma pasta, guarda o token nela; o botão de pasta na linha
 * faz o mesmo pelo teclado. O realce da pasta sob o ponteiro também é estilo
 * direto (`data-alvo`), pelo mesmo motivo do fantasma.
 *
 * APAGAR PERGUNTA ANTES, e a pergunta mora aqui em vez de num `confirm()` do
 * navegador: diálogo nativo BLOQUEIA o webview do Tauri e já travou sessão de
 * automação neste projeto. O botão de confirmar repete o nome do item — "Apagar
 * Goblin para sempre" — porque é a última chance de ver que se clicou na linha
 * errada.
 */
export function TokenLibraryPanel({
  itens,
  pastas,
  aviso,
  podeOrganizar,
  onPlace,
  onDropOnMap,
  onDelete,
  onCriarPasta,
  onMover,
  onRecolherPasta,
  onApagarPasta,
}: TokenLibraryPanelProps) {
  const [pergunta, setPergunta] = useState<Pergunta>(null)
  /** Texto do campo "Nome da nova pasta"; `null` = campo fechado. */
  const [novaPasta, setNovaPasta] = useState<string | null>(null)
  /** Item sendo arrastado — só liga e desliga o fantasma, duas vezes por gesto. */
  const [arrastado, setArrastado] = useState<ItemDoAcervoNaTela | null>(null)
  const idBase = useId()
  const raizRef = useRef<HTMLElement | null>(null)
  const apertoRef = useRef<ApertoNoItem | null>(null)
  const ultimoPontoRef = useRef({ x: 0, y: 0 })
  const fantasmaRef = useRef<HTMLDivElement | null>(null)
  /** Pasta realçada sob o ponteiro durante o arrasto; `null` = nenhuma. */
  const alvoRef = useRef<HTMLElement | null>(null)
  /** O gesto que acabou foi arrasto: o `click` que o navegador ainda manda não põe a peça de novo no centro. */
  const engolirCliqueRef = useRef(false)
  /** Desliga os ouvintes de janela do gesto em curso; `null` sem gesto. */
  const soltarOuvintesRef = useRef<(() => void) | null>(null)

  // Painel desmontado no meio do arrasto (troca de aba): os ouvintes de janela
  // não podem sobreviver a ele.
  useEffect(() => () => soltarOuvintesRef.current?.(), [])

  const realcarPasta = (alvo: HTMLElement | null) => {
    if (alvo === alvoRef.current) return
    alvoRef.current?.removeAttribute('data-alvo')
    alvo?.setAttribute('data-alvo', 'dentro')
    alvoRef.current = alvo
  }

  const comecarAperto = (event: ReactPointerEvent<HTMLButtonElement>, item: ItemDoAcervoNaTela) => {
    if (event.button !== 0 || !event.isPrimary) return
    soltarOuvintesRef.current?.()
    engolirCliqueRef.current = false
    apertoRef.current = {
      item,
      pointerId: event.pointerId,
      inicio: { x: event.clientX, y: event.clientY },
      arrastando: false,
      cancelado: false,
    }

    const mover = (e: PointerEvent) => {
      const aperto = apertoRef.current
      if (aperto === null || e.pointerId !== aperto.pointerId || aperto.cancelado) return
      ultimoPontoRef.current = { x: e.clientX, y: e.clientY }
      if (!aperto.arrastando) {
        if (Math.hypot(e.clientX - aperto.inicio.x, e.clientY - aperto.inicio.y) < LIMIAR_DO_ARRASTO_PX) return
        aperto.arrastando = true
        setArrastado(aperto.item)
      }
      if (fantasmaRef.current !== null) posicionarFantasma(fantasmaRef.current, ultimoPontoRef.current)
      realcarPasta(pastaSobOPonteiro(raizRef.current, e.clientX, e.clientY))
    }

    const encerrar = (e: PointerEvent, soltou: boolean) => {
      const aperto = apertoRef.current
      if (aperto === null || e.pointerId !== aperto.pointerId) return
      soltarOuvintesRef.current?.()
      apertoRef.current = null
      if (!aperto.arrastando) return
      const pasta = alvoRef.current
      realcarPasta(null)
      setArrastado(null)
      // O `click` (quando há) chega logo depois deste `pointerup`, na mesma
      // volta do laço de eventos; o `setTimeout` libera o próximo clique de
      // verdade — inclusive o Enter do teclado, que não passa por aqui.
      engolirCliqueRef.current = true
      setTimeout(() => {
        engolirCliqueRef.current = false
      }, 0)
      if (!soltou || aperto.cancelado) return
      if (pasta === null) {
        onDropOnMap(aperto.item, e.clientX, e.clientY)
        return
      }
      // Soltar na pasta onde o token já está é desistir, não gravar de novo.
      const destino = pasta.getAttribute(ATRIBUTO_DE_PASTA) || null
      if (destino !== aperto.item.pasta) onMover(aperto.item, destino)
    }
    const aoSoltar = (e: PointerEvent) => encerrar(e, true)
    const aoCancelar = (e: PointerEvent) => encerrar(e, false)

    // Esc desiste do arrasto. Na CAPTURA e parando ali: o mesmo Esc, chegando
    // ao mapa, largaria a seleção e o rascunho — e a pessoa só quis soltar a
    // peça que tinha na mão.
    const aoTeclar = (e: KeyboardEvent) => {
      const aperto = apertoRef.current
      if (e.key !== 'Escape' || aperto === null || !aperto.arrastando || aperto.cancelado) return
      e.preventDefault()
      e.stopImmediatePropagation()
      aperto.cancelado = true
      realcarPasta(null)
      setArrastado(null)
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('pointercancel', aoCancelar)
    window.addEventListener('keydown', aoTeclar, true)
    soltarOuvintesRef.current = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoCancelar)
      window.removeEventListener('keydown', aoTeclar, true)
      soltarOuvintesRef.current = null
    }
  }

  const criarPasta = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (novaPasta === null) return
    onCriarPasta(novaPasta.trim())
    setNovaPasta(null)
  }

  const teclaNoNomeDaPasta = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha o campo sem criar; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    setNovaPasta(null)
  }

  // Vazio, o acervo é uma faixa só: o que falta e como encher. As três pastas
  // padrão (já nascem no disco, todas vazias) esperam o primeiro token —
  // cabeçalhos vazios em pilha brigavam com a frase que ensina. O "+ Nova
  // pasta" fica, e a pasta que o mestre cria traz a estante inteira: é a mesma
  // vista de depois do primeiro token (a pasta dele não pula quando o token
  // chega), e a "NPCs" à mostra explica o "NPCs (2)" de quem digitou esse nome.
  const vazio = itens.length === 0
  const temPastaDoMestre = pastas.some((pasta) => !ehPastaPadrao(pasta))
  const organizado = podeOrganizar && pastas.length > 0 && (!vazio || temPastaDoMestre)
  const soltos = organizado ? itens.filter((item) => item.pasta === null) : itens
  // "Sem pasta" aparece vazio só durante o arrasto de um token que ESTÁ numa
  // pasta: é o lugar de soltá-lo para tirá-lo de lá.
  const mostrarSemPasta = soltos.length > 0 || (arrastado !== null && arrastado.pasta !== null)
  const fotoDoArrastado = arrastado !== null && arrastado.imagemNoDisco ? fonteDaFoto(arrastado.caminho) : null

  const linha = (item: ItemDoAcervoNaTela) => {
    const destinos = [
      ...(item.pasta !== null ? [{ id: null, nome: SEM_PASTA }] : []),
      ...pastas.filter((pasta) => pasta.id !== item.pasta),
    ]
    const movendo = pergunta?.tipo === 'mover-token' && pergunta.id === item.id
    const confirmando = pergunta?.tipo === 'apagar-token' && pergunta.id === item.id
    return (
      <li key={item.id} className={movendo ? 'lb-acervo__item lb-acervo__item--movendo' : 'lb-acervo__item'}>
        {item.imagemNoDisco && fonteDaFoto(item.caminho) !== null ? (
          <img className="lb-acervo__foto" src={fonteDaFoto(item.caminho) ?? ''} alt={`Foto de ${item.nome}`} />
        ) : (
          // Imagem sumida do disco não apaga o item: o nome que a pessoa
          // deu vale mais que o arquivo, e ela ainda pode colocar o token
          // no mapa (sem foto) ou apagar a linha.
          <span className="lb-acervo__foto lb-acervo__foto--vazia" aria-hidden="true" />
        )}
        <button
          type="button"
          className="lb-acervo__nome"
          aria-label={`Colocar ${item.nome} no mapa`}
          title={organizado ? 'Clique para pôr no centro da vista, ou arraste até o mapa ou até uma pasta' : 'Clique para pôr no centro da vista, ou arraste até o mapa'}
          onPointerDown={(event) => comecarAperto(event, item)}
          onClick={() => {
            if (engolirCliqueRef.current) return
            onPlace(item)
          }}
        >
          {item.nome}
        </button>
        {confirmando ? (
          <span className="lb-acervo__confirma">
            <button type="button" className="lb-btn lb-btn--ghost" onClick={() => setPergunta(null)}>
              Manter no acervo
            </button>
            <button
              type="button"
              className="lb-btn lb-btn--danger"
              onClick={() => {
                setPergunta(null)
                onDelete(item)
              }}
            >
              {`Apagar ${item.nome} para sempre`}
            </button>
          </span>
        ) : (
          <>
            {organizado && destinos.length > 0 && (
              <button
                type="button"
                className="lb-acervo__mover"
                aria-label={`Mover ${item.nome} para outra pasta`}
                aria-expanded={movendo}
                title="Mover para outra pasta"
                onClick={() => setPergunta(movendo ? null : { tipo: 'mover-token', id: item.id })}
              >
                <FolderIcon size={14} />
              </button>
            )}
            <button
              type="button"
              className="lb-acervo__apagar"
              aria-label={`Apagar ${item.nome} do acervo`}
              onClick={() => setPergunta({ tipo: 'apagar-token', id: item.id })}
            >
              <span aria-hidden="true">×</span>
            </button>
          </>
        )}
        {movendo && (
          <span className="lb-acervo__destinos" role="group" aria-label={`Mover ${item.nome} para`}>
            {destinos.map((destino) => (
              <button
                key={destino.id ?? ''}
                type="button"
                className="lb-acervo__destino"
                onClick={() => {
                  setPergunta(null)
                  onMover(item, destino.id)
                }}
              >
                {destino.nome}
              </button>
            ))}
            <button type="button" className="lb-btn lb-btn--ghost" onClick={() => setPergunta(null)}>
              Cancelar
            </button>
          </span>
        )}
      </li>
    )
  }

  const grupo = (pasta: PastaDoAcervo) => {
    const dentro = itens.filter((item) => item.pasta === pasta.id)
    const aberta = !pasta.recolhida
    const idDoCorpo = `${idBase}-pasta-${pasta.id}`
    const apagando = pergunta?.tipo === 'apagar-pasta' && pergunta.id === pasta.id
    return (
      <div key={pasta.id} className="lb-acervo__pasta" role="group" aria-label={pasta.nome} {...{ [ATRIBUTO_DE_PASTA]: pasta.id }}>
        <div className="lb-acervo__pasta-topo">
          <button
            type="button"
            className="lb-acervo__pasta-botao"
            aria-expanded={aberta}
            aria-controls={aberta && dentro.length > 0 ? idDoCorpo : undefined}
            aria-label={`${pasta.nome} (${dentro.length})`}
            onClick={() => onRecolherPasta(pasta, aberta)}
          >
            <span className="lb-acervo__chevron" aria-hidden="true">
              <ChevronDownIcon size={14} />
            </span>
            <FolderIcon size={14} />
            {/* Nome longo corta com reticências na coluna estreita; o title devolve o nome inteiro no hover. */}
            <span className="lb-acervo__pasta-nome" title={pasta.nome}>
              {pasta.nome}
            </span>
            <span className="lb-acervo__contagem" aria-hidden="true">
              {dentro.length}
            </span>
          </button>
          {!apagando && (
            <button
              type="button"
              className="lb-acervo__apagar"
              aria-label={`Apagar a pasta ${pasta.nome}`}
              // Pasta vazia sai sem pergunta: não há nada a perder nem a mover.
              onClick={() => (dentro.length === 0 ? onApagarPasta(pasta) : setPergunta({ tipo: 'apagar-pasta', id: pasta.id }))}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        {apagando && (
          <div className="lb-acervo__confirma lb-acervo__confirma--pasta">
            <p className="lb-acervo__vazio">
              {dentro.length === 1
                ? `O token desta pasta volta para “${SEM_PASTA}”.`
                : `Os ${dentro.length} tokens desta pasta voltam para “${SEM_PASTA}”.`}
            </p>
            <button type="button" className="lb-btn lb-btn--ghost" onClick={() => setPergunta(null)}>
              Manter a pasta
            </button>
            <button
              type="button"
              className="lb-btn lb-btn--danger"
              onClick={() => {
                setPergunta(null)
                onApagarPasta(pasta)
              }}
            >
              Apagar a pasta, manter os tokens
            </button>
          </div>
        )}
        {aberta && dentro.length > 0 && (
          <ul id={idDoCorpo} className="lb-acervo lb-acervo--na-pasta">
            {dentro.map(linha)}
          </ul>
        )}
      </div>
    )
  }

  return (
    <section className={vazio ? 'lb-section lb-acervo--vazio' : 'lb-section'} ref={raizRef}>
      <div className="lb-acervo__topo">
        <h2 className="lb-eyebrow">Acervo de tokens</h2>
        {podeOrganizar && novaPasta === null && (
          <button type="button" className="lb-acervo__nova-pasta" onClick={() => setNovaPasta('')}>
            + Nova pasta
          </button>
        )}
      </div>
      {aviso !== null && (
        // `role="status"`: quem usa leitor de tela ouve o aviso sem ter de
        // caçá-lo, e ele não rouba o foco de onde a pessoa está.
        <p className="lb-acervo__aviso" role="status">
          {aviso}
        </p>
      )}
      {novaPasta !== null && (
        <form className="lb-acervo__form" onSubmit={criarPasta}>
          <input
            className="lb-input"
            aria-label="Nome da nova pasta"
            placeholder="Nome da pasta"
            value={novaPasta}
            maxLength={NOME_DE_PASTA_MAX}
            autoFocus
            onChange={(event) => setNovaPasta(event.target.value)}
            onKeyDown={teclaNoNomeDaPasta}
          />
          <div className="lb-acervo__form-acoes">
            <button type="button" className="lb-btn lb-btn--ghost" onClick={() => setNovaPasta(null)}>
              Cancelar
            </button>
            <button type="submit" className="lb-btn">
              Criar
            </button>
          </div>
        </form>
      )}
      {vazio && (
        // Um parágrafo só: a primeira frase diz o que falta, a segunda como
        // encher — cada uma na sua linha do rail.
        <p className="lb-acervo__vazio-estado">
          <span>{ACERVO_VAZIO}</span> <span>{ACERVO_COMO_ENCHER}</span>
        </p>
      )}
      {organizado ? (
        <div className="lb-acervo__pastas">
          {pastas.map(grupo)}
          {mostrarSemPasta && (
            <div className="lb-acervo__pasta lb-acervo__pasta--solta" role="group" aria-label={SEM_PASTA} {...{ [ATRIBUTO_DE_PASTA]: '' }}>
              <p className="lb-acervo__pasta-titulo">{SEM_PASTA}</p>
              {soltos.length > 0 ? (
                <ul className="lb-acervo">{soltos.map(linha)}</ul>
              ) : (
                <p className="lb-acervo__vazio">Solte aqui para tirar o token da pasta.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        itens.length > 0 && <ul className="lb-acervo">{itens.map(linha)}</ul>
      )}
      {arrastado !== null &&
        // Portal no `body`: o rail tem rolagem e recorte, e o fantasma precisa
        // andar por cima do mapa inteiro. `aria-hidden`: é eco visual do gesto,
        // o leitor de tela já tem o botão.
        createPortal(
          <div
            className="lb-acervo__fantasma"
            aria-hidden="true"
            ref={(el) => {
              fantasmaRef.current = el
              if (el !== null) posicionarFantasma(el, ultimoPontoRef.current)
            }}
          >
            {fotoDoArrastado !== null ? (
              <img className="lb-acervo__foto" src={fotoDoArrastado} alt="" />
            ) : (
              <span className="lb-acervo__foto lb-acervo__foto--vazia" />
            )}
            <span>{arrastado.nome}</span>
          </div>,
          document.body,
        )}
    </section>
  )
}
