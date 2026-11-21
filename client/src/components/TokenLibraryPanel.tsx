import {
  startTransition,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { convertFileSrc } from '@tauri-apps/api/core'
import { isEditableTarget } from '../lib/keymap'
import { normalizeForSearch } from '../lib/mapObjects'
import { ehPastaPadrao, resumoDosExtras, type ItemDoAcervoNaTela, type PastaDoAcervo } from '../lib/tokenLibrary'
import { fichasNasPastas, fichasSemPecaNaEstante, ID_DA_PASTA_NPCS, nomeDaFicha, pastaDaFichaNoAcervo, type LugaresDasFichas } from '../lib/fichasNoAcervo'
import type { LinhaDeFicha } from '../lib/pastasDeFichas'
import type { Personagem } from '../lib/personagem'
import { BotaoMais } from './BotaoMais'
import { ChevronDownIcon, CloseIcon, FolderIcon, MoveIntoIcon, SearchIcon } from './icons'
import { LinhaDaFichaNoAcervo, MenuDeAcoes, SeloTemFicha, type AcoesDaFicha, type ContagemNoMapa, type DestinoDaFicha, type ItemDoMenu } from './LinhaDaFichaNoAcervo'
import { IconeDoLivro } from './livro/icones'
import { useArrastoDaLinha, type ArrastoDaLinha } from './useArrastoDaLinha'
import './TokenLibraryPanel.css'

/**
 * NPCs NO ACERVO (21/11/2026): as fichas de NPC da aventura aberta, que o
 * acervo MOSTRA ao lado dos tokens do app (`lib/fichasNoAcervo.ts`). Ausente =
 * mapa sem aventura ou sem sistema: o acervo é só o dos tokens, como antes.
 */
export interface FichasDoAcervo {
  personagens: readonly Personagem[]
  lugares: LugaresDasFichas
  contagem: ContagemNoMapa
  acoes: AcoesDaFicha
  arrasto: Pick<ArrastoDaLinha, 'casaNaTela' | 'tokenNaTela' | 'onSoltarNoMapa'>
  /** "+ NPC"; ausente = o sistema da aventura não está neste computador. */
  onNovoNpc?: () => void
  /** O aviso de uma vez só da migração; `null` = nada. */
  avisoDaMigracao: string | null
  onEntendi: () => void
  /** Cresce a cada "Mostrar no Acervo": abre e destaca a pasta NPCs. */
  pedidosDeMostrar: number
  /** O sistema da aventura: a ficha guardada numa peça só serve aqui se for dele. */
  sistemaId: string
  /** A ficha que a peça do acervo tem nesta aventura (decisão 9, ou o "Criar ficha"); `null` = nenhuma. */
  fichaDaPeca: (pecaId: string) => Personagem | null
  /** Clique na peça: abre a ficha dela; `false` = não tem ficha que sirva aqui (o painel oferece "Criar ficha"). */
  abrirFichaDaPeca: (item: ItemDoAcervoNaTela) => boolean
  /** "Criar ficha" da peça sem ficha; ausente = o sistema da aventura não está neste computador. */
  criarFichaDaPeca?: (item: ItemDoAcervoNaTela) => void
}

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
  /** Apaga só a pasta; o que está nela sobe um nível. Com conteúdo, só depois da confirmação. */
  onApagarPasta: (pasta: PastaDoAcervo) => void
  /** "Nova subpasta" no cabeçalho de uma pasta de cima. Ausente = sem o botão. */
  onCriarSubpasta?: (nome: string, dentroDe: string) => void
  fichas?: FichasDoAcervo
}

/** Uma linha da pasta: token do app ou ficha de NPC, misturados em ordem de nome (decisão 11). */
type EntradaDaPasta = { tipo: 'token'; item: ItemDoAcervoNaTela } | { tipo: 'ficha'; linha: LinhaDeFicha }

const PORTUGUES = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function nomeDaEntrada(entrada: EntradaDaPasta): string {
  return entrada.tipo === 'token' ? entrada.item.nome : nomeDaFicha(entrada.linha.personagem)
}

const NOVA_SUBPASTA = 'Subpasta nova'
/** A ficha arrastada acende a pasta como o token arrastado (`.lb-acervo__pasta[data-alvo='dentro']`). */
const MARCA_DA_PASTA_DO_ACERVO = { atributo: 'data-alvo', valor: 'dentro' }
const PISCA_MS = 1200

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

/** Nome acessível do campo de busca; a lupa e o placeholder dizem o resto a quem enxerga. */
const BUSCAR_TOKEN = 'Buscar token'

/**
 * As palavras da busca, sem acento e em minúsculas: "polvora" acha a
 * "Pólvora" e "cav neg" acha o "Cavaleiro Negro". Lista vazia = sem busca.
 */
function palavrasDaBusca(busca: string): string[] {
  return normalizeForSearch(busca)
    .split(/\s+/)
    .filter((palavra) => palavra !== '')
}

/** O nome tem todas as palavras, cada uma em qualquer ponto dele? */
function nomeCasa(nome: string, palavras: readonly string[]): boolean {
  const alvo = normalizeForSearch(nome)
  return palavras.every((palavra) => alvo.includes(palavra))
}

/**
 * A tecla leva à busca? Ctrl+F (Cmd+F) de qualquer ponto do painel; "/" só
 * fora de campo de texto, onde ele é texto (o nome da pasta nova). Nenhum dos
 * dois é atalho do mapa (`resolveShortcut`, lib/keymap.ts), e o painel só os
 * ouve com o foco dentro dele.
 */
function ehAtalhoDaBusca(event: ReactKeyboardEvent<HTMLElement>): boolean {
  if (event.altKey) return false
  if (event.ctrlKey || event.metaKey) return !event.shiftKey && event.key.toLowerCase() === 'f'
  if (event.key !== '/') return false
  const alvo = event.target
  if (!(alvo instanceof HTMLElement)) return true
  return !isEditableTarget(alvo.tagName, alvo instanceof HTMLInputElement ? alvo.type : undefined, alvo.isContentEditable)
}

/** Pastas que o mestre fechou durante uma busca, e o termo em que fechou. */
interface FechadasNaBusca {
  termo: string
  ids: ReadonlySet<string>
}

const NENHUMA_FECHADA: FechadasNaBusca = { termo: '', ids: new Set() }

interface CampoDeBuscaProps {
  /** O painel põe o cursor aqui pelo Ctrl+F e pelo "/". */
  campoRef: RefObject<HTMLInputElement | null>
  /** O texto mudou. Chega numa transição: a lista se refaz cedendo a vez, e a tecla não espera por ela. */
  onMudar: (texto: string) => void
  /** Seta para baixo: o foco desce para o primeiro achado; `false` quando não há nenhum. */
  onDescer: () => boolean
}

/**
 * O campo da busca, dono do próprio texto. Separado do painel por medida
 * (18/11/2026, 300 tokens, servidor de desenvolvimento): com o texto no
 * painel, cada tecla refazia a estante inteira antes de a letra aparecer, 182
 * ms numa tarefa só. Aqui a tecla refaz só o campo, e a lista vem depois, numa
 * transição que o React fatia.
 */
function CampoDeBusca({ campoRef, onMudar, onDescer }: CampoDeBuscaProps) {
  const [texto, setTexto] = useState('')

  const mudar = (novo: string) => {
    setTexto(novo)
    startTransition(() => onMudar(novo))
  }

  const limpar = () => {
    mudar('')
    // O × sai da tela junto com o texto: o foco fica no campo, não cai no body.
    campoRef.current?.focus()
  }

  const tecla = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      // Não chega ao mapa (lá o Esc larga a seleção). O primeiro apaga a
      // busca; o segundo, com o campo vazio, sai dele (o de Objetos do mapa).
      event.preventDefault()
      event.stopPropagation()
      if (texto !== '') mudar('')
      else event.currentTarget.blur()
      return
    }
    if (event.key === 'ArrowDown' && onDescer()) event.preventDefault()
  }

  return (
    <div className="lb-objetos__campo lb-acervo__campo">
      <span className="lb-objetos__lupa" aria-hidden="true">
        <SearchIcon size={14} />
      </span>
      <input
        ref={campoRef}
        type="search"
        className="lb-input lb-objetos__busca"
        aria-label={BUSCAR_TOKEN}
        aria-keyshortcuts="Control+F /"
        placeholder="Buscar pelo nome"
        title="Buscar pelo nome (Ctrl+F ou /, com o foco no acervo)"
        value={texto}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => mudar(event.target.value)}
        onKeyDown={tecla}
      />
      {texto !== '' && (
        <button type="button" className="lb-iconbtn lb-iconbtn--sm lb-objetos__limpar" aria-label="Limpar busca" title="Limpar busca (Esc)" onClick={limpar}>
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  )
}

const rotuloMover = (item: ItemDoAcervoNaTela) => `Mover ${item.nome} para outra pasta`
const rotuloApagar = (item: ItemDoAcervoNaTela) => `Apagar ${item.nome} do acervo`
const rotuloApagarPasta = (pasta: PastaDoAcervo) => `Apagar a pasta ${pasta.nome}`
const rotuloNovaSubpasta = (nomeDaMae: string) => `Nova subpasta em ${nomeDaMae}`
/** O nome acessível do nome da peça quando o clique é da ficha (com aventura e sistema). */
const rotuloDoNomeComFicha = (item: ItemDoAcervoNaTela, temFicha: boolean) => (temFicha ? `Abrir a ficha de ${item.nome}` : `Criar ficha para ${item.nome}`)

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
 * `pointer-events: none` (ver `.lb-acervo__fantasma` em TokenLibraryPanel.css).
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
  /** O clique na peça sem ficha: "Criar ficha" ou desistir, na própria linha. */
  | { tipo: 'criar-ficha'; id: string }
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
 * "+ PASTA" NA LINHA DO TÍTULO (pedido painel-acervo). O "+ Token" também
 * morou aqui, mas com uma ficha aberta o Acervo fica a 1500 px do topo da
 * coluna: ele foi para o cabeçalho do painel, o mesmo lugar com e sem
 * seleção (`PropertiesPanel`).
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
 * aberto — menu Mover, pergunta de apagar, campo de pasta — de
 * onde o foco estiver, e o foco volta a quem abriu. O clique deixa o foco no
 * Mover (irmão do menu, fora dele), então o Esc é tratado na LINHA, que
 * recebe a tecla dos dois. E não passa adiante: no mapa ele largaria a
 * seleção. A pergunta de apagar abre com o foco no lado seguro ("Manter…"),
 * porque o Apagar que a abriu sai da tela junto.
 *
 * BUSCA (pedido de 17/11/2026: "É bom ter um botão de pesquisa", com a pasta
 * NPCs em 29 tokens). Filtra pelo nome enquanto digita, sem ligar para acento
 * nem maiúscula; a pasta com achado abre (só na tela: o `recolhida` gravado
 * não muda) e a sem achado sai da vista. A linha de baixo diz quantos achou,
 * ou "Nada com …". O × e o Esc limpam; Ctrl+F ou "/", com o foco no painel,
 * levam ao campo. O arrasto e o "+" da linha achada são os mesmos de sempre.
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
  onCriarSubpasta,
  fichas,
}: TokenLibraryPanelProps) {
  const [pergunta, setPergunta] = useState<Pergunta>(null)
  /** A subpasta sendo criada: a pasta mãe e o nome digitado; `null` = campo fechado. */
  const [novaSubpasta, setNovaSubpasta] = useState<{ mae: string; nome: string } | null>(null)
  /** O "⋯" aberto numa linha de token do app (com aventura e sistema); `null` = nenhum. */
  const [menuDoToken, setMenuDoToken] = useState<{ id: string; ancora: HTMLElement; pelaTecla: boolean } | null>(null)
  /** Texto do campo "Nome da nova pasta"; `null` = campo fechado. */
  const [novaPasta, setNovaPasta] = useState<string | null>(null)
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
  /**
   * A busca que a LISTA segue; vazio = a estante inteira. O texto do campo
   * mora em `CampoDeBusca` e chega aqui numa transição.
   */
  const [busca, setBusca] = useState('')
  /**
   * A busca abre toda pasta com achado; esta é a exceção, a pasta que o mestre
   * fechou com ESTE termo. Mudou o termo, a busca volta a abrir tudo que acha.
   */
  const [fechadasNaBusca, setFechadasNaBusca] = useState<FechadasNaBusca>(NENHUMA_FECHADA)
  const buscaRef = useRef<HTMLInputElement | null>(null)

  // Painel desmontado no meio do arrasto (troca de aba): os ouvintes de janela
  // não podem sobreviver a ele.
  useEffect(() => () => soltarOuvintesRef.current?.(), [])

  /** A pasta em que a ficha (modelo) aparece agora; a cópia anda com o modelo e não vai sozinha para pasta nenhuma. */
  const pastaDaFicha = (personagem: Personagem): string | null => pastaDaFichaNoAcervo(fichas?.lugares[personagem.id], pastas)
  const ehCopiaDoAcervo = (personagem: Personagem): boolean => {
    const modeloId = personagem.combate?.modeloId
    return modeloId !== undefined && modeloId !== personagem.id && (fichas?.personagens.some((outro) => outro.id === modeloId) ?? false)
  }
  // A FICHA ARRASTADA: o gesto comum da coluna dos jogadores. Pasta deste painel aceita o modelo (não a cópia),
  // e soltar na pasta onde ele já está é desistir; fora de pasta, é o mapa (casa ou token).
  const arrastoDaFicha = useArrastoDaLinha({
    ...fichas?.arrasto,
    pastaSob: (x, y, personagem) => {
      if (!podeOrganizar || ehCopiaDoAcervo(personagem)) return null
      const el = pastaSobOPonteiro(raizRef.current, x, y)
      if (el === null) return null
      const pastaId = el.getAttribute(ATRIBUTO_DE_PASTA) || null
      return pastaId === pastaDaFicha(personagem) ? null : { el, pastaId }
    },
    onMoverParaPasta: fichas?.acoes.mover,
    marcaDaPasta: MARCA_DA_PASTA_DO_ACERVO,
  })

  // "MOSTRAR NO ACERVO" (coluna dos jogadores): a pasta NPCs abre, rola até a vista, recebe o foco e pisca uma vez.
  const pedidosDeMostrar = fichas?.pedidosDeMostrar ?? 0
  const pedidosVistosRef = useRef(pedidosDeMostrar)
  // Por ref: o efeito roda só quando chega um pedido novo, e não a cada render (o `onRecolherPasta` muda de identidade a cada um).
  const paraMostrarRef = useRef({ pastas, onRecolherPasta })
  paraMostrarRef.current = { pastas, onRecolherPasta }
  useEffect(() => {
    if (pedidosDeMostrar === pedidosVistosRef.current) return
    pedidosVistosRef.current = pedidosDeMostrar
    const npcs = paraMostrarRef.current.pastas.find((pasta) => pasta.id === ID_DA_PASTA_NPCS)
    if (npcs === undefined) return
    if (npcs.recolhida) paraMostrarRef.current.onRecolherPasta(npcs, false)
    const quadro = requestAnimationFrame(() => {
      const grupoNpcs = raizRef.current?.querySelector<HTMLElement>(`[${ATRIBUTO_DE_PASTA}="${ID_DA_PASTA_NPCS}"]`)
      const topo = grupoNpcs?.querySelector<HTMLElement>('.lb-acervo__pasta-topo')
      if (topo === undefined || topo === null) return
      const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      topo.scrollIntoView?.({ block: 'nearest', behavior: reduz ? 'auto' : 'smooth' })
      topo.querySelector<HTMLElement>('.lb-acervo__pasta-botao')?.focus({ preventScroll: true })
      topo.setAttribute('data-pisca', '')
      window.setTimeout(() => topo.removeAttribute('data-pisca'), PISCA_MS)
    })
    return () => cancelAnimationFrame(quadro)
  }, [pedidosDeMostrar])

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

  const abrirNovaPasta = () => setNovaPasta('')

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
    if (pergunta.tipo !== 'mover-token' && pergunta.tipo !== 'apagar-token' && pergunta.tipo !== 'criar-ficha') return
    if (pergunta.id !== item.id) return
    event.preventDefault()
    event.stopPropagation()
    focarDepois(event.currentTarget, pergunta.tipo === 'mover-token' ? rotuloMover(item) : pergunta.tipo === 'apagar-token' ? rotuloApagar(item) : rotuloDoNomeComFicha(item, false))
    setPergunta(null)
  }

  /** A peça tem ficha que serve nesta aventura: a dela aqui, ou a guardada nela, do mesmo sistema. */
  const pecaTemFicha = (item: ItemDoAcervoNaTela): boolean =>
    fichas !== undefined && (fichas.fichaDaPeca(item.id) !== null || (item.ficha !== undefined && item.ficha.sistemaId === fichas.sistemaId))

  /** CLIQUE NO NOME (com aventura e sistema): abre a ficha; sem ficha, a pergunta "Criar ficha" na linha. */
  const clicarNaPeca = (item: ItemDoAcervoNaTela) => {
    if (fichas === undefined) {
      onPlace(item)
      return
    }
    if (fichas.abrirFichaDaPeca(item)) return
    setPergunta({ tipo: 'criar-ficha', id: item.id })
  }

  /** O "⋯" da peça: abrir ou criar a ficha, e pôr no centro (o Mover e o × continuam na linha, como antes). */
  const itensDoMenuDaPeca = (item: ItemDoAcervoNaTela): ItemDoMenu[] => {
    const fechar = () => setMenuDoToken(null)
    const temFicha = pecaTemFicha(item)
    const criar = fichas?.criarFichaDaPeca
    return [
      ...(temFicha
        ? [{ tipo: 'acao', rotulo: 'Abrir ficha', atalho: 'Enter', acao: () => (fechar(), clicarNaPeca(item)) } satisfies ItemDoMenu]
        : criar !== undefined
          ? [{ tipo: 'acao', rotulo: 'Criar ficha', acao: () => (fechar(), criar(item)) } satisfies ItemDoMenu]
          : []),
      { tipo: 'acao', rotulo: 'Pôr no centro do mapa', acao: () => (fechar(), onPlace(item)) },
    ]
  }

  /** Põe o cursor na busca com o texto selecionado: digitar substitui, a seta mantém. */
  const focarBusca = () => {
    const campo = buscaRef.current
    if (campo === null) return
    campo.focus()
    campo.select()
  }

  const teclaNoPainel = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (buscaRef.current === null || !ehAtalhoDaBusca(event)) return
    // O Ctrl+F não abre a busca da página, e o "/" não vira texto em lugar nenhum.
    event.preventDefault()
    event.stopPropagation()
    focarBusca()
  }

  /** A seta da busca desce para o primeiro achado; dali o Enter põe no mapa. */
  const descerParaOPrimeiro = (): boolean => {
    const primeiro = raizRef.current === null ? null : raizRef.current.querySelector<HTMLButtonElement>('.lb-acervo__nome')
    if (primeiro === null) return false
    primeiro.focus()
    return true
  }

  // Sem o disco lido não há onde gravar a pasta (`criarPastaNoAcervo` recusa em
  // `exigirLeitura`): um recarregar que falha com o campo aberto o fecha junto.
  // Ajustado no render (e não num efeito) para não piscar um quadro com o campo
  // órfão.
  if (!podeOrganizar && novaPasta !== null) setNovaPasta(null)

  // Vazio, o acervo é uma faixa só: o que falta e como encher. As três pastas
  // padrão (já nascem no disco, todas vazias) esperam o primeiro token —
  // cabeçalhos vazios em pilha brigavam com a frase que ensina. O "+ Pasta"
  // fica, e a pasta que o mestre cria traz a estante inteira: é a mesma
  // vista de depois do primeiro token (a pasta dele não pula quando o token
  // chega), e a "NPCs" à mostra explica o "NPCs (2)" de quem digitou esse nome.
  const palavras = palavrasDaBusca(busca)
  const buscando = palavras.length > 0
  /** Chave de `fechadasNaBusca`: o termo como a busca o entende. */
  const termo = palavras.join(' ')
  // As fichas por pasta: as que a busca deixa ver, e (buscando) todas, para contar a pasta inteira.
  const pastasDasFichas = podeOrganizar ? pastas : []
  // A ficha que nasceu de uma peça da estante não ganha linha própria: a linha da peça a abre e leva o selo.
  const fichasDasLinhas = fichas === undefined ? [] : fichasSemPecaNaEstante(fichas.personagens, fichas.lugares, new Set(itens.map((item) => item.id)))
  const fichasVistas = fichas === undefined ? null : fichasNasPastas(fichasDasLinhas, fichas.lugares, pastasDasFichas, (nome) => !buscando || nomeCasa(nome, palavras))
  const todasAsFichas = fichas === undefined ? null : buscando ? fichasNasPastas(fichasDasLinhas, fichas.lugares, pastasDasFichas, () => true) : fichasVistas
  const totalDeFichas = fichasVistas?.total ?? 0
  const vazio = itens.length === 0 && totalDeFichas === 0
  const temPastaDoMestre = pastas.some((pasta) => !ehPastaPadrao(pasta))
  const organizado = podeOrganizar && pastas.length > 0 && (!vazio || temPastaDoMestre)
  // Estante vazia não tem busca (o campo sai e leva o texto junto); a que
  // esvaziou com texto no campo volta, no próximo token, sem um filtro que
  // ninguém está vendo.
  if (vazio && busca !== '') setBusca('')
  const visiveis = buscando ? itens.filter((item) => nomeCasa(item.nome, palavras)) : itens
  const vistos = visiveis.length + (fichasVistas?.vistas ?? 0)
  const nadaAchado = buscando && vistos === 0
  const total = itens.length + totalDeFichas
  const resultado = !buscando
    ? ''
    : nadaAchado
      ? fichas === undefined
        ? `Nada com “${busca.trim()}”.`
        : `Nada com “${busca.trim()}”. A busca olha o nome dos tokens, das fichas e das cópias.`
      : fichas === undefined
        ? `${vistos} de ${total} ${total === 1 ? 'token' : 'tokens'}`
        : `${vistos} de ${total}`
  const soltos = organizado ? visiveis.filter((item) => item.pasta === null) : visiveis
  const fichasSoltas = fichasVistas?.porPasta.get(null) ?? []
  const fichaArrastada = arrastoDaFicha.arrastado
  // "Sem pasta" aparece vazio só durante o arrasto de um token (ou de uma ficha)
  // que ESTÁ numa pasta: é o lugar de soltá-lo para tirá-lo de lá.
  const mostrarSemPasta =
    soltos.length > 0 ||
    fichasSoltas.length > 0 ||
    (arrastado !== null && arrastado.pasta !== null) ||
    (fichaArrastada !== null && !ehCopiaDoAcervo(fichaArrastada) && pastaDaFicha(fichaArrastada) !== null)
  const fotoDoArrastado = arrastado !== null && arrastado.imagemNoDisco ? fonteDaFoto(arrastado.caminho) : null

  /** Os destinos do "Mover para" da ficha: cada pasta de cima com as subpastas dela logo abaixo, e Sem pasta. */
  const destinosDaFicha: DestinoDaFicha[] = organizado
    ? [
        ...pastas
          .filter((pasta) => pasta.dentroDe === undefined)
          .flatMap((pasta) => [
            { id: pasta.id, nome: pasta.nome, sub: false },
            ...pastas.filter((sub) => sub.dentroDe === pasta.id).map((sub) => ({ id: sub.id, nome: sub.nome, sub: true })),
          ]),
        { id: null, nome: SEM_PASTA, sub: false },
      ]
    : []

  /** Os tokens e as fichas de uma pasta (`null` = Sem pasta), misturados em ordem de nome; sem fichas, a ordem do índice, como antes. */
  const entradasDa = (tokens: readonly ItemDoAcervoNaTela[], linhasDeFicha: readonly LinhaDeFicha[]): EntradaDaPasta[] => {
    const entradas: EntradaDaPasta[] = [...tokens.map((item): EntradaDaPasta => ({ tipo: 'token', item })), ...linhasDeFicha.map((linha): EntradaDaPasta => ({ tipo: 'ficha', linha }))]
    return fichas === undefined ? entradas : entradas.sort((a, b) => PORTUGUES.compare(nomeDaEntrada(a), nomeDaEntrada(b)))
  }

  const linhaDaFicha = (linha: LinhaDeFicha) =>
    fichas === undefined ? null : (
      <LinhaDaFichaNoAcervo
        key={linha.personagem.id}
        linha={linha}
        contagem={fichas.contagem}
        forcarCopias={buscando}
        pastaAtual={pastaDaFicha(linha.personagem)}
        destinos={destinosDaFicha}
        podePor={fichas.arrasto.onSoltarNoMapa !== undefined}
        onApertar={arrastoDaFicha.comecar}
        engolirClique={arrastoDaFicha.engolirClique}
        acoes={fichas.acoes}
      />
    )

  const entrada = (item: EntradaDaPasta) => (item.tipo === 'token' ? linha(item.item) : linhaDaFicha(item.linha))

  const linha = (item: ItemDoAcervoNaTela) => {
    const destinos = [
      ...(item.pasta !== null ? [{ id: null, nome: SEM_PASTA }] : []),
      ...pastas.filter((pasta) => pasta.id !== item.pasta),
    ]
    const movendo = pergunta?.tipo === 'mover-token' && pergunta.id === item.id
    const confirmando = pergunta?.tipo === 'apagar-token' && pergunta.id === item.id
    const criandoFicha = pergunta?.tipo === 'criar-ficha' && pergunta.id === item.id
    // O que a peça leva além da foto ("ficha · 3 itens · luz"): a linha de
    // baixo diz, antes do clique, que o goblin vem com a ficha e a mochila.
    const leva = resumoDosExtras(item)
    const comFichas = fichas !== undefined
    const temFicha = pecaTemFicha(item)
    // Com aventura e sistema (pedido de 21/11/2026), o clique é da FICHA; pôr no mapa fica no "+" e no arrasto.
    const rotuloDoNome = comFichas ? rotuloDoNomeComFicha(item, temFicha) : leva === '' ? `Colocar ${item.nome} no mapa` : `Colocar ${item.nome} no mapa, com ${leva.split(' · ').join(', ')}`
    const dicaDoNome = comFichas
      ? `${leva === '' ? '' : `Leva ${leva}. `}${temFicha ? 'Clique para abrir a ficha' : 'Clique para criar a ficha'}; o + põe no centro da vista, ou arraste até o mapa${organizado ? ' ou até uma pasta' : ''}. Shift+F10: mais ações.`
      : `${leva === '' ? '' : `Leva ${leva}. `}${organizado ? 'Clique para pôr no centro da vista, ou arraste até o mapa ou até uma pasta' : 'Clique para pôr no centro da vista, ou arraste até o mapa'}`
    const menuAberto = menuDoToken !== null && menuDoToken.id === item.id
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
          className={leva === '' && !temFicha ? 'lb-acervo__nome' : 'lb-acervo__nome lb-acervo__nome--leva'}
          aria-label={rotuloDoNome}
          aria-keyshortcuts={comFichas ? 'Shift+F10' : undefined}
          title={dicaDoNome}
          onPointerDown={(event) => comecarAperto(event, item)}
          onKeyDown={(event) => {
            // Shift+F10 e a tecla de menu abrem o "⋯" da linha (o mesmo das fichas).
            if (!comFichas || !((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu')) return
            const mais = event.currentTarget.closest('li')?.querySelector<HTMLElement>('.lb-acervo__mais-do-token') ?? null
            if (mais === null) return
            event.preventDefault()
            event.stopPropagation()
            setMenuDoToken({ id: item.id, ancora: mais, pelaTecla: true })
          }}
          onClick={() => {
            if (engolirCliqueRef.current) return
            clicarNaPeca(item)
          }}
        >
          {leva === '' && !temFicha ? (
            item.nome
          ) : (
            <>
              <span className="lb-acervo__nome-linha">
                <span className="lb-acervo__nome-texto">{item.nome}</span>
                {temFicha && <SeloTemFicha />}
              </span>
              {leva !== '' && <span className="lb-acervo__leva">{leva}</span>}
            </>
          )}
        </button>
        {criandoFicha && (
          <span className="lb-acervo__confirma" role="group" aria-label={`${item.nome} não tem ficha`}>
            <span className="lb-acervo__vazio">
              {fichas?.criarFichaDaPeca !== undefined ? `${item.nome} não tem ficha nesta aventura.` : `${item.nome} não tem ficha, e o sistema desta aventura não está neste computador.`}
            </span>
            <button
              type="button"
              className="lb-btn lb-btn--ghost"
              onClick={(event) => {
                focarDepois(event.currentTarget.closest('li'), rotuloDoNomeComFicha(item, false))
                setPergunta(null)
              }}
            >
              Cancelar
            </button>
            {fichas?.criarFichaDaPeca !== undefined && (
              <button
                type="button"
                className="lb-btn"
                autoFocus
                onClick={() => {
                  setPergunta(null)
                  fichas.criarFichaDaPeca?.(item)
                }}
              >
                Criar ficha
              </button>
            )}
          </span>
        )}
        {menuAberto && menuDoToken !== null && (
          <MenuDeAcoes
            ancora={menuDoToken.ancora}
            pelaTecla={menuDoToken.pelaTecla}
            nome={item.nome}
            itens={itensDoMenuDaPeca(item)}
            onFechar={(devolverFoco) => {
              const ancora = menuDoToken.ancora
              setMenuDoToken(null)
              if (devolverFoco) ancora.focus()
            }}
          />
        )}
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
        ) : criandoFicha ? null : (
          // As ações da linha, juntas para aparecerem juntas (ver
          // `.lb-acervo__acoes`). A seta que entra é a mesma do "Mover para…"
          // de Cenas: o ícone de pasta repetido em cada linha parecia mais
          // uma pasta.
          <span className="lb-acervo__acoes">
            {comFichas && (
              // O "⋯" das fichas também na peça: abrir ou criar a ficha, pôr no centro.
              <button
                type="button"
                className="lb-acervo__mover lb-acervo__mais-do-token"
                aria-label={`Mais ações de ${item.nome}`}
                title="Mais ações"
                aria-haspopup="menu"
                aria-expanded={menuAberto}
                onClick={(event) => setMenuDoToken(menuAberto ? null : { id: item.id, ancora: event.currentTarget, pelaTecla: false })}
              >
                <span aria-hidden="true">⋯</span>
              </button>
            )}
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
        {!confirmando && (
          // O "+" do protótipo, sempre à vista: pôr no centro da vista. Fora do
          // Tab, como o "Mandar ficha" de Objetos do mapa: pelo teclado, o nome
          // é a parada (Enter põe no centro; com aventura, abre a ficha, e o
          // "Pôr no centro" mora no "⋯").
          <button
            type="button"
            className="lb-acervo__por"
            aria-label={`Pôr ${item.nome} no centro do mapa`}
            title="Pôr no centro da vista"
            tabIndex={-1}
            onClick={() => onPlace(item)}
          >
            <IconeDoLivro nome="mais" />
          </button>
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

  /** Fecha ou reabre a pasta só na busca deste termo; o `recolhida` gravado fica como estava. */
  const alternarNaBusca = (pasta: PastaDoAcervo) => {
    setFechadasNaBusca((antes) => {
      const ids = new Set(antes.termo === termo ? antes.ids : [])
      if (ids.has(pasta.id)) ids.delete(pasta.id)
      else ids.add(pasta.id)
      return { termo, ids }
    })
  }

  /** As subpastas de uma pasta de cima, na ordem do índice (um nível só). */
  const subpastasDe = (pasta: PastaDoAcervo): PastaDoAcervo[] => (pasta.dentroDe === undefined ? pastas.filter((sub) => sub.dentroDe === pasta.id) : [])

  /** Tudo o que a pasta guarda, com as subpastas: tokens e fichas (modelos). É o que decide "vazia" e a pergunta de apagar. */
  const conteudoDe = (pasta: PastaDoAcervo): number =>
    itens.filter((item) => item.pasta === pasta.id).length + (todasAsFichas?.porPasta.get(pasta.id)?.length ?? 0) + subpastasDe(pasta).reduce((soma, sub) => soma + conteudoDe(sub), 0)

  /** O que a pasta mostra (com a busca, só os achados), com as subpastas. */
  const vistosEm = (pasta: PastaDoAcervo): number =>
    visiveis.filter((item) => item.pasta === pasta.id).length + (fichasVistas?.porPasta.get(pasta.id)?.length ?? 0) + subpastasDe(pasta).reduce((soma, sub) => soma + vistosEm(sub), 0)

  const criarSubpasta = (mae: string, nome: string) => {
    setNovaSubpasta(null)
    focarDepois(raizRef.current?.querySelector(`[${ATRIBUTO_DE_PASTA}="${CSS.escape(mae)}"]`) ?? null, rotuloNovaSubpasta(pastas.find((pasta) => pasta.id === mae)?.nome ?? ''))
    onCriarSubpasta?.(nome.trim() || NOVA_SUBPASTA, mae)
  }

  const grupo = (pasta: PastaDoAcervo) => {
    const subpastas = subpastasDe(pasta)
    const ehSub = pasta.dentroDe !== undefined
    /** O que a linha mostra: os achados, na busca; senão, a pasta toda. */
    const tokensVistos = visiveis.filter((item) => item.pasta === pasta.id)
    const entradas = entradasDa(tokensVistos, fichasVistas?.porPasta.get(pasta.id) ?? [])
    const vistosAqui = vistosEm(pasta)
    // Na busca, pasta sem achado sai da vista (inclusive a vazia).
    if (buscando && vistosAqui === 0) return null
    const criandoSub = novaSubpasta !== null && novaSubpasta.mae === pasta.id
    // `vazia` e a pergunta de apagar contam a pasta INTEIRA: com a busca, a
    // pasta de 5 tokens e 1 achado não pode sair sem pergunta.
    const conteudo = conteudoDe(pasta)
    const vazia = conteudo === 0 && subpastas.length === 0
    const fechadaNaBusca = fechadasNaBusca.termo === termo && fechadasNaBusca.ids.has(pasta.id)
    const aberta = criandoSub || (buscando ? !fechadaNaBusca : !pasta.recolhida)
    const idDoCorpo = `${idBase}-pasta-${pasta.id}`
    const apagando = pergunta?.tipo === 'apagar-pasta' && pergunta.id === pasta.id
    const mae = ehSub ? pastas.find((outra) => outra.id === pasta.dentroDe) : undefined
    const destinoDoApagar = mae?.nome ?? SEM_PASTA
    const classe = ehSub ? 'lb-acervo__pasta lb-acervo__pasta--sub' : 'lb-acervo__pasta'
    return (
      <div
        key={pasta.id}
        className={classe}
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
          {vazia && !criandoSub ? (
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
              aria-label={`${pasta.nome} (${vistosAqui})`}
              onClick={() => (buscando ? alternarNaBusca(pasta) : onRecolherPasta(pasta, aberta))}
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
              {/* Decisão 4: subpasta tem um nível só, então o botão mora só nas pastas de cima. */}
              {!ehSub && onCriarSubpasta !== undefined && podeOrganizar && (
                <button
                  type="button"
                  className="lb-acervo__mover"
                  aria-label={rotuloNovaSubpasta(pasta.nome)}
                  title="Nova subpasta"
                  onClick={() => setNovaSubpasta({ mae: pasta.id, nome: NOVA_SUBPASTA })}
                >
                  <IconeDoLivro nome="mais" />
                </button>
              )}
              <button
                type="button"
                className="lb-acervo__apagar"
                aria-label={rotuloApagarPasta(pasta)}
                title={vazia ? 'Apagar a pasta' : 'Apagar a pasta (o que está nela fica)'}
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
            {vistosAqui}
          </span>
        </div>
        {apagando && (
          <div className="lb-acervo__confirma lb-acervo__confirma--pasta">
            <p className="lb-acervo__vazio">
              {fichas === undefined && subpastas.length === 0
                ? conteudo === 1
                  ? `O token desta pasta volta para “${destinoDoApagar}”.`
                  : `Os ${conteudo} tokens desta pasta voltam para “${destinoDoApagar}”.`
                : `O que está nela vai para “${destinoDoApagar}”${subpastas.length === 0 ? '' : subpastas.length === 1 ? '; a subpasta vira pasta de cima' : `; as ${subpastas.length} subpastas viram pastas de cima`}. Nenhuma ficha nem token é apagado.`}
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
              {fichas === undefined ? 'Apagar a pasta, manter os tokens' : 'Apagar a pasta, manter o que está nela'}
            </button>
          </div>
        )}
        {aberta && (!vazia || criandoSub) && (
          <div id={idDoCorpo} className="lb-acervo__corpo lb-acervo--na-pasta">
            {criandoSub && (
              <input
                className="lb-input lb-acervo__subpasta-nova"
                aria-label={`Nome da nova subpasta em ${pasta.nome}`}
                value={novaSubpasta.nome}
                maxLength={NOME_DE_PASTA_MAX}
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setNovaSubpasta({ mae: pasta.id, nome: event.target.value })}
                onBlur={() => setNovaSubpasta(null)}
                onKeyDown={(event) => {
                  // Enter cria; Esc desiste. Nenhum dos dois chega ao mapa.
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    criarSubpasta(pasta.id, novaSubpasta.nome)
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    focarDepois(event.currentTarget.closest('.lb-acervo__pasta'), rotuloNovaSubpasta(pasta.nome))
                    setNovaSubpasta(null)
                  }
                }}
              />
            )}
            {subpastas.map(grupo)}
            {entradas.length > 0 && <ul className="lb-acervo">{entradas.map(entrada)}</ul>}
          </div>
        )}
      </div>
    )
  }

  const mostrarNovaPasta = podeOrganizar && novaPasta === null

  // Durante o arrasto o ponteiro passa por cima de todas as linhas: a marca na
  // seção apaga o pairar delas, e só a pasta de destino acende (`data-alvo`).
  const classeDaSecao = ['lb-section', 'lb-acervo-painel', vazio && 'lb-acervo--vazio', (arrastado !== null || fichaArrastada !== null) && 'lb-acervo--arrastando']
    .filter(Boolean)
    .join(' ')

  return (
    <section className={classeDaSecao} ref={raizRef} onKeyDown={teclaNoPainel}>
      <div className="lb-acervo__topo">
        <h2 className="lb-eyebrow">Acervo de tokens</h2>
        {/* Só o "+ Pasta": o "+ Token" mora no cabeçalho do painel, à vista
            com e sem seleção (aqui, no pé da coluna, ficava a 1500 px do topo
            com uma ficha aberta). */}
        {(mostrarNovaPasta || fichas?.onNovoNpc !== undefined) && (
          <div className="lb-acervo__acoes-topo">
            {/* Decisão 14: a ficha nova nasce em NPCs e abre para dar o nome. */}
            {fichas?.onNovoNpc !== undefined && <BotaoMais nome="NPC novo" texto="NPC" dica="Ficha nova de NPC nesta aventura, na pasta NPCs" onClick={fichas.onNovoNpc} />}
            {mostrarNovaPasta && <BotaoMais nome={NOVA_PASTA} texto="Pasta" onClick={abrirNovaPasta} />}
          </div>
        )}
      </div>
      {!vazio && (
        <div className="lb-acervo__busca" role="search">
          <CampoDeBusca campoRef={buscaRef} onMudar={setBusca} onDescer={descerParaOPrimeiro} />
          {/* Sempre montado (vazio some pelo CSS): o leitor de tela só anuncia
              a contagem de um `status` que já estava na página. */}
          <p className="lb-acervo__resultado" role="status">
            {resultado}
          </p>
        </div>
      )}
      {fichas !== undefined && fichas.avisoDaMigracao !== null && (
        // MIGRAÇÃO (decisão 3): o aviso de uma vez só; o Entendi o tira e devolve o foco à busca.
        <div className="lb-acervo__migracao" role="status">
          <p>{fichas.avisoDaMigracao}</p>
          <button
            type="button"
            className="lb-btn"
            onClick={() => {
              fichas.onEntendi()
              focarBusca()
            }}
          >
            Entendi
          </button>
        </div>
      )}
      {aviso !== null && (
        // `role="status"`: quem usa leitor de tela ouve o aviso sem ter de
        // caçá-lo, e ele não rouba o foco de onde a pessoa está.
        <p className="lb-acervo__aviso" role="status">
          {aviso}
        </p>
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
      {nadaAchado ? null : organizado ? (
        <div className="lb-acervo__pastas">
          {pastas.filter((pasta) => pasta.dentroDe === undefined).map(grupo)}
          {mostrarSemPasta && (
            <div className="lb-acervo__pasta lb-acervo__pasta--solta" role="group" aria-label={SEM_PASTA} {...{ [ATRIBUTO_DE_PASTA]: '' }}>
              <p className="lb-acervo__pasta-titulo">
                {SEM_PASTA}
                <span className="lb-acervo__contagem" aria-hidden="true">
                  {soltos.length + fichasSoltas.length}
                </span>
              </p>
              {soltos.length > 0 || fichasSoltas.length > 0 ? (
                <ul className="lb-acervo">{entradasDa(soltos, fichasSoltas).map(entrada)}</ul>
              ) : (
                <p className="lb-acervo__vazio">{fichaArrastada !== null ? 'Solte aqui para tirar a ficha da pasta.' : 'Solte aqui para tirar o token da pasta.'}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        vistos > 0 && <ul className="lb-acervo">{entradasDa(visiveis, fichasSoltas).map(entrada)}</ul>
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
