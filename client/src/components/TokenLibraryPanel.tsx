import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { convertFileSrc } from '@tauri-apps/api/core'
import { ehPastaPadrao, type ItemDoAcervoNaTela, type PastaDoAcervo } from '../lib/tokenLibrary'
import { BotaoMais } from './BotaoMais'
import { ChevronDownIcon, CloseIcon, FolderIcon, MoveIntoIcon } from './icons'
import { ADICIONAR_TOKEN, ADICIONAR_TOKEN_DICA, NovoTokenForm, type NovoTokenProps } from './NovoTokenForm'
import './TokenLibraryPanel.css'

export interface TokenLibraryPanelProps {
  itens: readonly ItemDoAcervoNaTela[]
  /** Pastas da estante, na ordem do índice. */
  pastas: readonly PastaDoAcervo[]
  /** Frase de `listarAcervo` quando o acervo não pôde ser lido; `null` = tudo certo. */
  aviso: string | null
  /**
   * Há disco onde gravar as pastas? `false` no app aberto no navegador: lá o
   * acervo nem é oferecido, e um "+ Pasta" que só devolve erro seria uma
   * promessa falsa.
   */
  podeOrganizar: boolean
  /**
   * O "+ Token" na linha do título. Quem monta só passa quando ALGO está
   * selecionado: sem seleção o mesmo botão mora na faixa do topo
   * (`NadaSelecionado`), e só pode haver um na página (ver `ADICIONAR_TOKEN`).
   * Ausente com o campo aberto (a seleção acabou), o campo fecha.
   */
  novoToken?: NovoTokenProps
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

/** Nome acessível do "+ Pasta" (era o texto do antigo "+ Nova pasta"). */
const NOVA_PASTA = 'Nova pasta'

/** O lado seguro das perguntas de apagar: é onde o foco cai quando elas abrem. */
const MANTER_NO_ACERVO = 'Manter no acervo'
const MANTER_A_PASTA = 'Manter a pasta'

const rotuloMover = (item: ItemDoAcervoNaTela) => `Mover ${item.nome} para outra pasta`
const rotuloApagar = (item: ItemDoAcervoNaTela) => `Apagar ${item.nome} do acervo`
const rotuloApagarPasta = (pasta: PastaDoAcervo) => `Apagar a pasta ${pasta.nome}`

/** O botão de `dentro` cujo nome acessível (o `aria-label`, senão o texto) é `nome`. */
function botaoPorNome(dentro: Element, nome: string): HTMLButtonElement | null {
  for (const botao of dentro.querySelectorAll<HTMLButtonElement>('button')) {
    if ((botao.getAttribute('aria-label') ?? botao.textContent?.trim()) === nome) return botao
  }
  return null
}

/** Onde o foco vai depois do próximo commit: o botão chamado `nome` dentro de `dentro`. */
interface FocoDepois {
  dentro: Element | null
  nome: string
}

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
 *
 * "+ TOKEN" E "+ PASTA" NA LINHA DO TÍTULO (pedido painel-acervo, fatia 2):
 * criar e guardar token no mesmo lugar, como no diretório de Atores do
 * Foundry. Um campo de cada vez abaixo do título.
 *
 * LINHAS, NÃO CARTÕES (fatia 4): "cada linha é um cartão com borda, as pastas
 * são faixas cheias e o mover e o × ficam sempre à vista" (pedido de
 * 01/10/2026). Agora é uma árvore como o painel de camadas do Figma: o Mover
 * e o Apagar moram em `.lb-acervo__acoes` e só aparecem com o ponteiro na
 * linha, com o foco nela ou com o menu aberto (sempre, em tela sem pairar);
 * a contagem da pasta fica na ponta da linha, depois do × dela. Pasta vazia
 * não tem seta nem alterna: seta que não abre nada é controle morto. O
 * desenho mora em TokenLibraryPanel.css.
 *
 * ESC NO GESTO DE VERDADE (convenção "Menu de ações"): o Esc fecha o que está
 * aberto — menu Mover, pergunta de apagar, campo de pasta ou de token — de
 * onde o foco estiver, e o foco volta a quem abriu. O clique deixa o foco no
 * Mover (irmão do menu, fora dele), então o Esc é tratado na LINHA, que
 * recebe a tecla dos dois. E não passa adiante: no mapa ele largaria a
 * seleção. A pergunta de apagar abre com o foco no lado seguro ("Manter…"),
 * porque o Apagar que a abriu sai da tela junto.
 */
export function TokenLibraryPanel({
  itens,
  pastas,
  aviso,
  podeOrganizar,
  novoToken,
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
  /** O campo "Nome do novo token" do "+ Token" está aberto. */
  const [novoTokenAberto, setNovoTokenAberto] = useState(false)
  /**
   * O botão que recebe o foco no commit seguinte. Não dá para focar no próprio
   * clique: o botão de destino (o Apagar que volta, o "Manter…" que nasce)
   * ainda não está no DOM nesse momento.
   */
  const focoDepoisRef = useRef<FocoDepois | null>(null)
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

  // Depois de CADA commit (sem dependências): é só ler uma ref quando nada
  // está pendente. Antes da pintura, para o anel de foco não piscar no body.
  useLayoutEffect(() => {
    const pendente = focoDepoisRef.current
    if (pendente === null) return
    focoDepoisRef.current = null
    if (pendente.dentro === null || !pendente.dentro.isConnected) return
    botaoPorNome(pendente.dentro, pendente.nome)?.focus()
  })

  const focarDepois = (dentro: Element | null, nome: string) => {
    focoDepoisRef.current = { dentro, nome }
  }

  // O campo de pasta abre no pé da coluna: o foco automático traz só o campo,
  // e o Cancelar e o Criar ficavam cortados. Uma vez por abertura, sem animação.
  const formPastaRef = useRef<HTMLFormElement>(null)
  const campoPastaAberto = novaPasta !== null
  useLayoutEffect(() => {
    if (campoPastaAberto) formPastaRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [campoPastaAberto])

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

  // Um campo de cada vez abaixo do título: abrir um fecha o outro.
  const abrirNovaPasta = () => {
    setNovoTokenAberto(false)
    setNovaPasta('')
  }

  const abrirNovoToken = () => {
    setNovaPasta(null)
    setNovoTokenAberto(true)
  }

  /** Fecha o campo de pasta (criou ou desistiu) e devolve o foco ao "+ Pasta". */
  const fecharNovaPasta = () => {
    focarDepois(raizRef.current, NOVA_PASTA)
    setNovaPasta(null)
  }

  const criarPasta = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (novaPasta === null) return
    onCriarPasta(novaPasta.trim())
    fecharNovaPasta()
  }

  // No formulário inteiro, e não só no campo: depois de um Tab o foco está no
  // Cancelar ou no Criar, e o Esc desiste de onde estiver. Não pode chegar ao
  // canvas (Esc lá troca a ferramenta).
  const teclaNoFormDaPasta = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    fecharNovaPasta()
  }

  // Esc numa linha de token fecha o menu Mover ou a pergunta de apagar DELA e
  // devolve o foco ao botão que abriu. A linha recebe a tecla tanto do Mover
  // (que fica com o foco depois do clique) quanto dos botões de dentro.
  const teclaNaLinha = (event: ReactKeyboardEvent<HTMLLIElement>, item: ItemDoAcervoNaTela) => {
    if (event.key !== 'Escape' || pergunta === null) return
    if (pergunta.tipo !== 'mover-token' && pergunta.tipo !== 'apagar-token') return
    if (pergunta.id !== item.id) return
    event.preventDefault()
    event.stopPropagation()
    focarDepois(event.currentTarget, pergunta.tipo === 'mover-token' ? rotuloMover(item) : rotuloApagar(item))
    setPergunta(null)
  }

  // Sem o disco lido não há onde gravar a pasta (`criarPastaNoAcervo` recusa em
  // `exigirLeitura`): um recarregar que falha com o campo aberto o fecha junto.
  // Ajustado no render (e não num efeito) para não piscar um quadro com o campo
  // órfão.
  if (!podeOrganizar && novaPasta !== null) setNovaPasta(null)
  // O mesmo para o campo do token: sem `novoToken` (a seleção acabou, e o
  // "+ Token" foi para a faixa do topo), o campo fecha em vez de ficar órfão —
  // e sem dois "Nome do novo token" na página.
  if (novoToken === undefined && novoTokenAberto) setNovoTokenAberto(false)

  // Vazio, o acervo é uma faixa só: o que falta e como encher. As três pastas
  // padrão (já nascem no disco, todas vazias) esperam o primeiro token —
  // cabeçalhos vazios em pilha brigavam com a frase que ensina. O "+ Pasta"
  // fica, e a pasta que o mestre cria traz a estante inteira: é a mesma
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
      <li
        key={item.id}
        className={movendo ? 'lb-acervo__item lb-acervo__item--movendo' : 'lb-acervo__item'}
        onKeyDown={(event) => teclaNaLinha(event, item)}
      >
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
            <button
              type="button"
              className="lb-btn lb-btn--ghost"
              onClick={(event) => {
                focarDepois(event.currentTarget.closest('li'), rotuloApagar(item))
                setPergunta(null)
              }}
            >
              {MANTER_NO_ACERVO}
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
          // As ações da linha, juntas para aparecerem juntas (ver
          // `.lb-acervo__acoes`). A seta que entra é a mesma do "Mover para…"
          // de Cenas: o ícone de pasta repetido em cada linha parecia mais
          // uma pasta.
          <span className="lb-acervo__acoes">
            {organizado && destinos.length > 0 && (
              <button
                type="button"
                className="lb-acervo__mover"
                aria-label={rotuloMover(item)}
                aria-expanded={movendo}
                title="Mover para outra pasta"
                onClick={() => setPergunta(movendo ? null : { tipo: 'mover-token', id: item.id })}
              >
                <MoveIntoIcon size={14} />
              </button>
            )}
            <button
              type="button"
              className="lb-acervo__apagar"
              aria-label={rotuloApagar(item)}
              title="Apagar do acervo"
              onClick={(event) => {
                // O Apagar sai da tela quando a pergunta abre: o foco vai para o lado seguro.
                focarDepois(event.currentTarget.closest('li'), MANTER_NO_ACERVO)
                setPergunta({ tipo: 'apagar-token', id: item.id })
              }}
            >
              <CloseIcon size={14} />
            </button>
          </span>
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
            <button
              type="button"
              className="lb-btn lb-btn--ghost"
              onClick={(event) => {
                focarDepois(event.currentTarget.closest('li'), rotuloMover(item))
                setPergunta(null)
              }}
            >
              Cancelar
            </button>
          </span>
        )}
      </li>
    )
  }

  const grupo = (pasta: PastaDoAcervo) => {
    const dentro = itens.filter((item) => item.pasta === pasta.id)
    const vazia = dentro.length === 0
    const aberta = !pasta.recolhida
    const idDoCorpo = `${idBase}-pasta-${pasta.id}`
    const apagando = pergunta?.tipo === 'apagar-pasta' && pergunta.id === pasta.id
    return (
      <div
        key={pasta.id}
        className="lb-acervo__pasta"
        role="group"
        aria-label={pasta.nome}
        {...{ [ATRIBUTO_DE_PASTA]: pasta.id }}
        onKeyDown={(event) => {
          // Esc na pergunta de apagar a pasta: desiste e o foco volta ao "×" da pasta.
          if (event.key !== 'Escape' || !apagando) return
          event.preventDefault()
          event.stopPropagation()
          focarDepois(event.currentTarget, rotuloApagarPasta(pasta))
          setPergunta(null)
        }}
      >
        <div className="lb-acervo__pasta-topo">
          {vazia ? (
            // Pasta vazia não alterna: uma seta ali prometeria abrir o que não
            // existe (catálogo, "Árvore de itens"). O recuo guarda o lugar da
            // seta para o ícone e o nome ficarem na vertical dos das outras.
            // Continua alvo do soltar (o `data-acervo-pasta` é do grupo).
            <div className="lb-acervo__pasta-botao" data-vazia="">
              <span className="lb-acervo__recuo" aria-hidden="true" />
              <FolderIcon size={14} />
              <span className="lb-acervo__pasta-nome" title={pasta.nome}>
                {pasta.nome}
              </span>
              <span className="lb-sr-only"> vazia</span>
            </div>
          ) : (
            <button
              type="button"
              className="lb-acervo__pasta-botao"
              aria-expanded={aberta}
              aria-controls={aberta ? idDoCorpo : undefined}
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
            </button>
          )}
          {!apagando && (
            <span className="lb-acervo__acoes">
              <button
                type="button"
                className="lb-acervo__apagar"
                aria-label={rotuloApagarPasta(pasta)}
                title={vazia ? 'Apagar a pasta' : 'Apagar a pasta (os tokens ficam)'}
                onClick={(event) => {
                  // Pasta vazia sai sem pergunta: não há nada a perder nem a mover.
                  if (vazia) {
                    onApagarPasta(pasta)
                    return
                  }
                  focarDepois(event.currentTarget.closest('.lb-acervo__pasta'), MANTER_A_PASTA)
                  setPergunta({ tipo: 'apagar-pasta', id: pasta.id })
                }}
              >
                <CloseIcon size={14} />
              </button>
            </span>
          )}
          {/* Na ponta da linha, depois do × (que só aparece sob o ponteiro):
              em repouso as contagens de todas as pastas e a de "Sem pasta"
              ficam numa coluna só, rente à borda. Fora do botão, mas o alvo
              dele cobre a linha inteira (TokenLibraryPanel.css), e o nome
              acessível dele já diz quantos tokens há. */}
          <span className="lb-acervo__contagem" aria-hidden="true">
            {dentro.length}
          </span>
        </div>
        {apagando && (
          <div className="lb-acervo__confirma lb-acervo__confirma--pasta">
            <p className="lb-acervo__vazio">
              {dentro.length === 1
                ? `O token desta pasta volta para “${SEM_PASTA}”.`
                : `Os ${dentro.length} tokens desta pasta voltam para “${SEM_PASTA}”.`}
            </p>
            <button
              type="button"
              className="lb-btn lb-btn--ghost"
              onClick={(event) => {
                focarDepois(event.currentTarget.closest('.lb-acervo__pasta'), rotuloApagarPasta(pasta))
                setPergunta(null)
              }}
            >
              {MANTER_A_PASTA}
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
        {aberta && !vazia && (
          <ul id={idDoCorpo} className="lb-acervo lb-acervo--na-pasta">
            {dentro.map(linha)}
          </ul>
        )}
      </div>
    )
  }

  const mostrarNovoToken = novoToken !== undefined && !novoTokenAberto
  const mostrarNovaPasta = podeOrganizar && novaPasta === null

  // Durante o arrasto o ponteiro passa por cima de todas as linhas: a marca na
  // seção apaga o pairar delas, e só a pasta de destino acende (`data-alvo`).
  const classeDaSecao = ['lb-section', 'lb-acervo-painel', vazio && 'lb-acervo--vazio', arrastado !== null && 'lb-acervo--arrastando']
    .filter(Boolean)
    .join(' ')

  return (
    <section className={classeDaSecao} ref={raizRef}>
      <div className="lb-acervo__topo">
        <h2 className="lb-eyebrow">Acervo de tokens</h2>
        {(mostrarNovoToken || mostrarNovaPasta) && (
          <div className="lb-acervo__acoes-topo">
            {mostrarNovoToken && <BotaoMais nome={ADICIONAR_TOKEN} texto="Token" dica={ADICIONAR_TOKEN_DICA} onClick={abrirNovoToken} />}
            {mostrarNovaPasta && <BotaoMais nome={NOVA_PASTA} texto="Pasta" onClick={abrirNovaPasta} />}
          </div>
        )}
      </div>
      {aviso !== null && (
        // `role="status"`: quem usa leitor de tela ouve o aviso sem ter de
        // caçá-lo, e ele não rouba o foco de onde a pessoa está.
        <p className="lb-acervo__aviso" role="status">
          {aviso}
        </p>
      )}
      {novoToken !== undefined && novoTokenAberto && (
        <NovoTokenForm
          defaultTokenName={novoToken.defaultTokenName}
          onConfirm={(nome) => {
            // O foco não volta ao "+ Token": quem monta a tela leva a coluna ao
            // topo, onde a ficha do token novo nasce selecionada.
            setNovoTokenAberto(false)
            novoToken.onAddToken(nome)
          }}
          onCancel={() => {
            focarDepois(raizRef.current, ADICIONAR_TOKEN)
            setNovoTokenAberto(false)
          }}
        />
      )}
      {novaPasta !== null && (
        <form className="lb-acervo__form" ref={formPastaRef} onSubmit={criarPasta} onKeyDown={teclaNoFormDaPasta}>
          <input
            className="lb-input"
            aria-label="Nome da nova pasta"
            placeholder="Nome da pasta"
            value={novaPasta}
            maxLength={NOME_DE_PASTA_MAX}
            autoFocus
            onChange={(event) => setNovaPasta(event.target.value)}
          />
          <div className="lb-acervo__form-acoes">
            <button type="button" className="lb-btn lb-btn--ghost" onClick={fecharNovaPasta}>
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
              <p className="lb-acervo__pasta-titulo">
                {SEM_PASTA}
                <span className="lb-acervo__contagem" aria-hidden="true">
                  {soltos.length}
                </span>
              </p>
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
