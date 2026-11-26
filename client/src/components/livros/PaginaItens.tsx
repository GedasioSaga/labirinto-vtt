import { isTauri } from '@tauri-apps/api/core'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { itemParaDar, novoItemDoCatalogo, type ItemDoCatalogo as ItemDoAcervo } from '../../lib/acervoDeItens'
import { escolherImagemDoItem, imagemDoItemDoBlob } from '../../lib/imagemDoItem'
import { armasDe, limiteDeArmas } from '../../lib/batalha/leituraDaFicha'
import { ITEM_QUANTIDADE_MAX, quantidadeDe } from '../../lib/items'
import { ehDoAcervo, entradaDoAcervo } from '../../lib/livros/acervoNoLivro'
import { entraNaBatalha, variacoesDe } from '../../lib/livros/combate'
import {
  abaDeDestino,
  buscarNoCatalogo,
  cartaoDaEntrada,
  chaveDoNomeDaEntrada,
  DADOS_DO_TIPO,
  ehDoLivro,
  podeReceber,
  regraDaCoisa,
  tirarDaFicha,
  type EntradaParaFicha,
  type ItemDoCatalogo,
  type TipoDoCatalogo,
} from '../../lib/livros/catalogo'
import { pecasDaEntrada, TIPOS_DA_PAGINA, TOPO_DA_PAGINA, type EntradaDaBiblioteca, type PaginaDaBiblioteca } from '../../lib/livros/paginasDaBiblioteca'
import { donosDasEntradas, GRUPOS_DA_PAGINA, GRUPOS_DE_ARMA, grupoNaBiblioteca, semARegraRepetida, imagemDaEntrada, ORDENS_DA_BIBLIOTECA, ordenarNaBiblioteca, vagaDaEntrada, type GrupoDaBiblioteca, type GrupoDeFichas, type OrdemDaBiblioteca } from '../../lib/livros/gruposDaBiblioteca'
import { dadosDaLinha, type DadosDaLinha } from '../../lib/livros/linhaDaBiblioteca'
import type { FerramentaDaBiblioteca } from '../../lib/livros/pendenciasDasFerramentas'
import { desfazerPosto, porCoisaNaFicha, porEntradaNaFicha, type PostoNaFicha, type ResultadoDoPor } from '../../lib/livros/coisaERegra'
import { darNaFicha, type FichaQueRecebeu } from '../../lib/mochila/darNaFicha'
import { cartoesDaAba, novoCartao, novoPersonagem, type CartaoDaFicha, type Personagem } from '../../lib/personagem'
import type { AbaDoSistema, SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { quemUsaDeTreino } from '../../lib/batalha/ensaio/ensaioDoItem'
import { linhaDoTexto } from '../batalha/editor/PapelDoCartao'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'
import { useCatalogoStore } from '../../stores/catalogoStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { useToastStore } from '../../stores/toastStore'
import { itensPorCategoria } from '../AcervoDeItensPanel'
import { itemCasaNaBusca, palavrasDaBusca, textosDeBusca } from '../BuscaDoAcervoDeItens'
import { ItemDoCatalogoDialog } from '../ItemDoCatalogoDialog'
import { rotuloDoTipoDoItem } from '../../lib/itens/editorDoItem'
import { precoEmBerries } from '../../lib/loja'
import { avisarComDesfazer, formatarNumero, primeiroNome, trocarFicha } from './comum'
import { PainelDeEnsaio } from '../ensaio/PainelDeEnsaio'
import { ensaiarCopias, type EscolhaDaCopia } from '../../lib/mochila/efeitoNasCopias'
import { decidirCopias } from '../../stores/itensNaFonte'
import type { EfeitoDoItem } from '../../types/map'
import { EntradaDoCatalogoDialog, type ModoDaEntrada } from './EntradaDoCatalogoDialog'
import { DarAlcanceAosAntigos } from './DarAlcanceAosAntigos'
import { DarRequisitosAosAntigos } from './DarRequisitosAosAntigos'
import { JuntarAsArmas } from './JuntarAsArmas'
import { ColunaDasFichas, type AlvoDoArrasto, type OndeNaBiblioteca } from './biblioteca/ColunaDasFichas'
import { LadoDaEscolhida, type EstadoParaDar } from './biblioteca/LadoDaEscolhida'
import { ListaAgrupada, type GrupoNaLista } from './biblioteca/ListaDaBiblioteca'
import { MenuDeFerramentas } from './biblioteca/MenuDeFerramentas'
import { IconeDoMundo } from './icones'
import './itens.css'
import './biblioteca/biblioteca.css'

/**
 * HABILIDADES E ITENS, A BIBLIOTECA ORGANIZADA (protótipo aprovado em 23/11,
 * docs/design/biblioteca/). Três colunas: à esquerda a coluna Fichas (filtro
 * "quem tem" e alvo do arrasto), no meio a lista agrupada por UM eixo (o que
 * a coisa é), à direita o cartão de papel da escolhida com "Dar a…",
 * "Testar", "Editar", "Quem tem" e "Apagar do livro". Os cinco botões de
 * manutenção viraram o menu "Ferramentas", com o que falta em cada um.
 *
 * O modelo de dados não muda: o catálogo (`catalogoStore`) continua a fonte
 * única das regras, o Acervo (`acervoDeItensStore`) o dono das coisas, e a
 * gravação na ficha passa pelo funil único do mundo (`mundo.mudar`). Dar usa a
 * porta única de sempre (`porEntradaNaFicha`, `porCoisaNaFicha`).
 */

/** A entrada recém-criada e a ficha que acabou de receber ficam com o latão por este tempo. */
const DESTAQUE_MS = 1600
/** Linhas no primeiro quadro (uma tela de 1080 px); o resto entra nos quadros seguintes (a lista longa nunca vira tarefa longa ao abrir). */
const LINHAS_NO_PRIMEIRO_QUADRO = 14
const LINHAS_POR_QUADRO = 30

const NADA_NA_PAGINA: Readonly<Record<PaginaDaBiblioteca, { titulo: string; frase: string }>> = {
  itens: { titulo: 'O livro desta pasta ainda não tem itens', frase: 'Junte o que as fichas da pasta já têm, crie um item, ou ponha coisas no Acervo.' },
  habilidades: { titulo: 'O livro desta pasta ainda não tem habilidades', frase: 'Traga as que já estão nas fichas dos jogadores, ou crie a primeira do zero.' },
}
const NOVA_DO_TIPO: Readonly<Record<TipoDoCatalogo, string>> = { arma: 'Nova arma', habilidade: 'Nova habilidade', item: 'Novo item' }
const NOME_DA_PAGINA: Readonly<Record<PaginaDaBiblioteca, { um: string; varios: string; todas: string }>> = {
  habilidades: { um: 'habilidade', varios: 'habilidades', todas: 'Todas' },
  itens: { um: 'item', varios: 'itens', todas: 'Todos' },
}

/** A última ficha que recebeu pelo "Dar a…" sobrevive à troca de marcador: dar várias coisas à mesma pessoa é D e Enter (estado da sessão, nada em disco). */
let ultimaFichaAntes: string | null = null
/** A escolhida de cada página também (voltar a Habilidades volta à mesma linha). */
const escolhidaAntes: Record<PaginaDaBiblioteca, string | null> = { habilidades: null, itens: null }

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** Quem pode receber: jogadores, NPCs de combate (modelos e únicos) e os de cenário; as variações herdam do modelo. */
function gruposQueRecebem(personagens: readonly Personagem[]): GrupoDeFichas[] {
  const npcs = personagens.filter((personagem) => personagem.tipo === 'npc' && podeReceber(personagem))
  return [
    { rotulo: 'Jogadores', fichas: personagens.filter((personagem) => personagem.tipo === 'jogador') },
    { rotulo: 'NPCs de combate', fichas: npcs.filter(entraNaBatalha) },
    { rotulo: 'Só no cenário', fichas: npcs.filter((personagem) => !entraNaBatalha(personagem)) },
  ].filter((grupo) => grupo.fichas.length > 0)
}

/** "Recruta da Marinha (modelo de 3 variações)": dar ao modelo dá a todas. */
function rotuloDaFicha(personagem: Personagem, personagens: readonly Personagem[]): string {
  if (personagem.tipo !== 'npc') return personagem.nome
  const n = variacoesDe(personagem.id, personagens).length
  return n === 0 ? personagem.nome : `${personagem.nome} (modelo de ${n} ${n === 1 ? 'variação' : 'variações'})`
}

/**
 * O cartão no fim da aba, se ela ainda não tem um com o mesmo nome. A MESMA
 * mudança vale para o disco e para a cópia aberta do editor
 * (`editarRpgDaPasta` a aplica duas vezes), então o cartão chega pronto, com
 * id fixo: as duas cópias ficam com o mesmo cartão e o Desfazer acha nas duas.
 */
function comCartao(personagem: Personagem, abaId: string, cartao: CartaoDaFicha): Personagem {
  const atuais = cartoesDaAba(personagem, abaId)
  const chave = chaveDoNomeDaEntrada(cartao.nome)
  if (atuais.some((atual) => atual.id === cartao.id || chaveDoNomeDaEntrada(atual.nome) === chave)) return personagem
  return { ...personagem, abas: { ...personagem.abas, [abaId]: [...atuais, cartao] } }
}

function fraseDaRecusa(motivo: 'semAba' | 'jaTem' | 'variacao', ficha: Personagem, entrada: EntradaDaBiblioteca): string {
  if (motivo === 'jaTem') return `${ficha.nome} já tem ${entrada.nome}.`
  if (motivo === 'semAba') return `A ficha deste sistema não tem a aba ${DADOS_DO_TIPO[entrada.tipo].nome}.`
  return `${ficha.nome} é variação: ponha no modelo para dar a todas.`
}

/** "Sabre entrou em Armas de Aira. Agora são 2 armas: na batalha Aira escolhe 1." */
function fraseDoPor(entrada: EntradaDaBiblioteca, ficha: Personagem, aba: AbaDoSistema, variacoes: number, resultado: Extract<ResultadoDoPor, { ok: true }>): string {
  const nas = variacoes === 0 ? '' : variacoes === 1 ? ' e na variação' : ` e nas ${variacoes} variações`
  let frase = `${entrada.nome} entrou em ${aba.nome} de ${ficha.nome}${nas}.`
  const limite = limiteDeArmas(resultado.personagem)
  if (resultado.passaDoLimiteDeArmas && limite !== null) {
    frase += ` Agora são ${armasDe(resultado.personagem).length} armas: na batalha ${primeiroNome(ficha.nome)} escolhe ${limite}.`
  }
  return frase
}

/**
 * "Garrucha entrou na mochila de Aira.", "40 Bala de Prata entraram na mochila
 * de Aira." ou, na pilha, "Mais 40 Bala de Prata na mochila de Aira: agora são
 * 52." Pedido maior que o que coube (a pilha para no teto) diz quantos couberam.
 */
function fraseDoPorNaMochila(nome: string, ficha: Personagem, recebido: FichaQueRecebeu, pedidos: number): string {
  const vaga = (recebido.personagem.mochila ?? []).find((item) => item.id === recebido.vagaId)
  const total = vaga === undefined ? recebido.entraram : quantidadeDe(vaga)
  const noTeto = recebido.entraram < pedidos ? ` Só couberam ${formatarNumero(recebido.entraram)} dos ${formatarNumero(pedidos)}: a pilha vai até ${formatarNumero(ITEM_QUANTIDADE_MAX)}.` : ''
  if (total > recebido.entraram) return `Mais ${formatarNumero(recebido.entraram)} ${nome} na mochila de ${ficha.nome}: agora são ${formatarNumero(total)}.${noTeto}`
  if (recebido.entraram > 1) return `${formatarNumero(recebido.entraram)} ${nome} entraram na mochila de ${ficha.nome}.${noTeto}`
  return `${nome} entrou na mochila de ${ficha.nome}.`
}

/** Grava pelo funil do mundo e conta o resultado do Desfazer num aviso. */
function mudarComAviso(mudanca: (lista: Personagem[]) => Personagem[]): void {
  useMundoDoLivroStore
    .getState()
    .mudar(mudanca)
    .then(
      () => useToastStore.getState().push('info', 'Desfeito.'),
      (erro: unknown) => useToastStore.getState().push('error', `Não deu para desfazer: ${mensagemDoErro(erro)}`),
    )
}

type VagaDaMochila = NonNullable<Personagem['mochila']>[number]

/** O que "Tirar da ficha" tirou: o cartão (com a aba) e as vagas da mochila, para o Desfazer pôr de volta. */
interface Tirado {
  cartao: { abaId: string; cartao: CartaoDaFicha } | null
  vagas: VagaDaMochila[]
}

/**
 * F6 (itens numa fonte só, ARMAS-FONTE-UNICA §9): a cópia que já segue o Acervo
 * segue sozinha (ao salvar a coisa e ao abrir a pasta). Aqui só o conflito, que
 * nunca é decidido sem o mestre: a vaga dada antes de o item ter este efeito, ou
 * a que tem um efeito que o item não tem mais. A lista vem antes de gravar.
 */
function ConferirCopias({ acervo, personagens }: { acervo: Extract<EntradaDaBiblioteca, { acervo: unknown }>['acervo']; personagens: readonly Personagem[] }) {
  const [conferindo, setConferindo] = useState(false)
  const [feito, setFeito] = useState<string | null>(null)
  const conflitos = useMemo(() => ensaiarCopias(personagens, [acervo]).filter((copia) => copia.caso !== 'segue'), [personagens, acervo])
  if (conflitos.length === 0) return feito === null ? null : <p className="mu-item__efeito" role="status">{feito}</p>
  const porFicha = new Map<string, number>()
  for (const copia of conflitos) porFicha.set(copia.personagemNome, (porFicha.get(copia.personagemNome) ?? 0) + 1)
  const quem = [...porFicha].map(([nome, vagas]) => (vagas > 1 ? `${nome} (${vagas} vagas)` : nome)).join(', ')
  const frase = acervo.efeito === undefined ? `Têm um efeito que este item não tem mais: ${quem}.` : `Dadas antes de o item ter este efeito: ${quem}.`
  const decidir = async (escolha: EscolhaDaCopia) => {
    setConferindo(false)
    try {
      const vagas = await decidirCopias(acervo, escolha)
      if (escolha === 'acervo') setFeito(`${vagas} ${vagas === 1 ? 'cópia segue' : 'cópias seguem'} o Acervo.`)
      else setFeito(`${vagas} ${vagas === 1 ? 'vaga separada: não é mais cópia' : 'vagas separadas: não são mais cópias'} deste item.`)
    } catch (erro) {
      setFeito(`Não deu para gravar: ${mensagemDoErro(erro)}`)
    }
  }
  if (!conferindo) {
    return (
      <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => setConferindo(true)}>
        Conferir as cópias diferentes ({conflitos.length})
      </button>
    )
  }
  return (
    <div className="mu-item__copias" role="group" aria-label="Conferir as cópias diferentes do Acervo">
      <p className="mu-item__efeito">{frase}</p>
      <span className="mu-item__acoes">
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => setConferindo(false)}>
          Depois
        </button>
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" title="A vaga fica como está e deixa de ser cópia deste item" onClick={() => void decidir('separar')}>
          Separar
        </button>
        <button type="button" className="mu-bt mu-bt--p" onClick={() => void decidir('acervo')}>
          Seguir o Acervo
        </button>
      </span>
    </div>
  )
}

/** Tecla vinda de um campo de texto (a busca, uma janela): os atalhos de letra não valem ali. */
function deCampo(alvo: EventTarget | null): boolean {
  return alvo instanceof HTMLElement && (alvo.isContentEditable || alvo.closest('input, textarea, select') !== null)
}

/** Uma janela por cima (a do editor, a do Acervo) ou a ficha aberta: a página não responde às teclas. */
function comJanelaPorCima(): boolean {
  return useMundoDoLivroStore.getState().fichaAberta !== null || document.querySelector('.mu-modal-fundo, dialog[open]') !== null
}

export interface PaginaItensProps {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
  /** A mesma página serve as duas, Itens (armas, itens e o Acervo) e Habilidades (as técnicas e o que vem do livro). */
  pagina: PaginaDaBiblioteca
}

export function PaginaItens({ personagens, sistema, pagina }: PaginaItensProps) {
  const catalogoAberto = useCatalogoStore((state) => state.sistemaId)
  const itens = useCatalogoStore((state) => state.itens)
  const doLivro = useCatalogoStore((state) => state.doLivro)
  const aviso = useCatalogoStore((state) => state.aviso)
  const podeGravar = useCatalogoStore((state) => state.podeGravar)
  const doAcervo = useAcervoDeItensStore((state) => state.itens)
  const categoriasDoAcervo = useAcervoDeItensStore((state) => state.categorias)
  const pastasDoAcervo = useAcervoDeItensStore((state) => state.pastas)
  const doSistema = catalogoAberto === sistema.id
  const noAplicativo = isTauri()
  // A leitura do disco nunca lança: sem aviso e sem permissão de gravar, no aplicativo, é porque ainda está lendo.
  const lendo = !doSistema || (noAplicativo && !podeGravar && aviso === null)
  const nomes = NOME_DA_PAGINA[pagina]

  const buscaId = useId()
  const quemId = useId()
  const ordemId = useId()
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState<GrupoDaBiblioteca | 'todos'>('todos')
  const [onde, setOnde] = useState<OndeNaBiblioteca>('todas')
  const [ordem, setOrdem] = useState<OrdemDaBiblioteca>('livro')
  const [escolhidaId, setEscolhidaId] = useState<string | null>(escolhidaAntes[pagina])
  const [fechados, setFechados] = useState<ReadonlySet<GrupoDaBiblioteca>>(() => new Set())
  const [limite, setLimite] = useState(LINHAS_NO_PRIMEIRO_QUADRO)
  const [ferramenta, setFerramenta] = useState<Exclude<FerramentaDaBiblioteca, 'juntar' | 'ligar'> | null>(null)
  const [dialogo, setDialogo] = useState<ModoDaEntrada | null>(null)
  /** A coisa do Acervo aberta na janela do Acervo (o id; o item vem do store, para a janela ver o que foi salvo). */
  const [acervoAberto, setAcervoAberto] = useState<string | null>(null)
  const itemDoAcervoAberto = acervoAberto === null ? undefined : doAcervo.find((item) => item.id === acervoAberto)
  /** Itens refeitos (E2): o "Novo item" da página Itens cria a coisa no Acervo, pelo editor do item (não mais uma entrada solta do livro). */
  const [itemNovo, setItemNovo] = useState<ItemDoAcervo | null>(null)
  const acervoPodeGravar = useAcervoDeItensStore((state) => state.podeGravar)
  const [juntando, setJuntando] = useState(false)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [sobre, setSobre] = useState<{ fichaId: string; alvo: AlvoDoArrasto } | null>(null)
  const [recebeu, setRecebeu] = useState<string | null>(null)
  const [novos, setNovos] = useState<ReadonlySet<string>>(() => new Set())
  const [darAberto, setDarAberto] = useState<false | 'clique' | 'tecla'>(false)
  const [confirmandoApagar, setConfirmandoApagar] = useState(false)
  /** O Testar aberto (o cartão feito da entrada uma vez, para o id não mudar a cada render). */
  const [ensaio, setEnsaio] = useState<{ entradaId: string; cartao: CartaoDaFicha; quemUsa: Personagem; item?: Pick<EfeitoDoItem, 'gasta' | 'onde'> & { quantos: number } } | null>(null)
  const fecharEnsaio = useCallback(() => setEnsaio(null), [])
  const arrastandoRef = useRef<EntradaDaBiblioteca | null>(null)
  /** Dar em andamento (`ficha:entrada`): o clique duplo não grava duas vezes. */
  const pondo = useRef(new Set<string>())
  /** O Desfazer do último dar, tirar ou apagar: o Ctrl+Z o roda (o aviso tem o mesmo Desfazer). */
  const ultimoDesfazer = useRef<(() => void) | null>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const ferramentaRef = useRef<HTMLDivElement>(null)

  // O mundo abre o catálogo do sistema ao abrir; aqui só garante (abrir direto neste marcador, ou outro sistema).
  useEffect(() => {
    if (useCatalogoStore.getState().sistemaId !== sistema.id) void useCatalogoStore.getState().abrir(sistema)
  }, [sistema])

  /** Guarda um Desfazer para o aviso e para o Ctrl+Z (um por vez: o da última mudança). */
  const avisar = useCallback((texto: string, desfazer: () => void) => {
    const uma = () => {
      if (ultimoDesfazer.current === uma) ultimoDesfazer.current = null
      desfazer()
    }
    ultimoDesfazer.current = uma
    avisarComDesfazer(texto, uma)
  }, [])

  // "/" leva à busca; Ctrl+Z desfaz o último dar, tirar ou apagar; F8 leva o foco ao aviso. Na captura: o mundo para a propagação das teclas dele.
  useEffect(() => {
    const aoTeclar = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || deCampo(event.target) || comJanelaPorCima()) return
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const campo = buscaRef.current
        if (campo === null) return
        event.preventDefault()
        event.stopPropagation()
        campo.focus()
        campo.select()
      } else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z') {
        const desfazer = ultimoDesfazer.current
        if (desfazer === null) return
        event.preventDefault()
        event.stopPropagation()
        desfazer()
      } else if (event.key === 'F8') {
        const noAviso = document.querySelector<HTMLElement>('.lb-toaststack button')
        if (noAviso === null) return
        event.preventDefault()
        noAviso.focus()
      }
    }
    window.addEventListener('keydown', aoTeclar, true)
    return () => window.removeEventListener('keydown', aoTeclar, true)
  }, [])

  // O latão da linha nova e da ficha que recebeu some sozinho.
  useEffect(() => {
    if (novos.size === 0 && recebeu === null) return
    const relogio = window.setTimeout(() => {
      setNovos(new Set())
      setRecebeu(null)
    }, DESTAQUE_MS)
    return () => window.clearTimeout(relogio)
  }, [novos, recebeu])

  // ---- o que a página lista ----
  const tiposDaPagina = TIPOS_DA_PAGINA[pagina]
  const categoriaPorCoisa = useMemo(() => new Map(doAcervo.map((coisa) => [coisa.id, coisa] as const)), [doAcervo])
  const entradas = useMemo<EntradaParaFicha[]>(() => (doSistema ? [...itens, ...doLivro].filter((entrada) => tiposDaPagina.includes(entrada.tipo)) : []), [doSistema, itens, doLivro, tiposDaPagina])
  // Na ordem das categorias do Acervo, como o painel do mestre as mostra. Só a página Itens lista o Acervo.
  const entradasDoAcervo = useMemo(() => (pagina === 'itens' ? itensPorCategoria(doAcervo, categoriasDoAcervo).flatMap((grupoDoAcervo) => grupoDoAcervo.itens.map(entradaDoAcervo)) : []), [pagina, doAcervo, categoriasDoAcervo])
  /** "Como no livro": as do mestre, as do Acervo e, no fim, as do livro de regras do sistema. */
  // Itens refeitos (E2): a entrada ligada a uma coisa do Acervo é a mesma coisa; só a do Acervo aparece (a Granada não se repete).
  const idsDoAcervo = useMemo(() => new Set(doAcervo.map((coisa) => coisa.id)), [doAcervo])
  const todas = useMemo<EntradaDaBiblioteca[]>(
    () => [...semARegraRepetida(entradas.filter((entrada) => !ehDoLivro(entrada)), idsDoAcervo), ...entradasDoAcervo, ...entradas.filter(ehDoLivro)],
    [entradas, entradasDoAcervo, idsDoAcervo],
  )
  const grupoPorId = useMemo(() => new Map(todas.map((entrada) => [entrada.id, grupoNaBiblioteca(entrada, categoriaPorCoisa)] as const)), [todas, categoriaPorCoisa])
  const gruposDeFichas = useMemo(() => gruposQueRecebem(personagens), [personagens])
  const fichas = useMemo(() => gruposDeFichas.flatMap((grupoDeFichas) => grupoDeFichas.fichas), [gruposDeFichas])
  /*
   * As linhas são `memo`: dar, juntar ou salvar uma entrada muda o catálogo
   * inteiro (lista nova), mas só a linha mexida pode re-renderizar. Por isso os
   * donos e os dados de cada linha mantêm o MESMO objeto quando não mudaram
   * (senão as 171 linhas se refazem a cada gravação, uma tarefa longa).
   */
  const donosAntes = useRef(new Map<string, Personagem[]>())
  const donos = useMemo(() => {
    const novos = donosDasEntradas(todas, fichas, sistema)
    for (const [id, quem] of novos) {
      const antes = donosAntes.current.get(id)
      if (antes !== undefined && antes.length === quem.length && antes.every((ficha, indice) => ficha === quem[indice])) novos.set(id, antes)
    }
    donosAntes.current = novos
    return novos
  }, [todas, fichas, sistema])
  const donosDe = useCallback((entrada: EntradaDaBiblioteca): readonly Personagem[] => donos.get(entrada.id) ?? [], [donos])
  // A imagem de cada linha, a mesma da ficha (`imagemDaEntrada`); texto igual = a linha `memo` não se refaz.
  const imagens = useMemo(() => new Map(todas.map((entrada) => [entrada.id, imagemDaEntrada(entrada, donos.get(entrada.id) ?? [], sistema, categoriaPorCoisa)] as const)), [todas, donos, sistema, categoriaPorCoisa])
  const imagemDe = useCallback((entrada: EntradaDaBiblioteca): string | null => imagens.get(entrada.id) ?? null, [imagens])
  const fichaDaPrevia = useMemo(() => ({ personagem: quemUsaDeTreino(sistema), sistema, soNomes: true as const }), [sistema])
  const nomesDosAtributos = useMemo(() => new Map(sistema.atributos.map((atributo) => [atributo.id, atributo.nome])), [sistema])
  /** Os dados da linha por entrada (o objeto da entrada é a chave: entrada salva = objeto novo = conta de novo). */
  const dadosGuardados = useMemo(() => new WeakMap<EntradaDaBiblioteca, { grupo: GrupoDaBiblioteca; dados: DadosDaLinha }>(), [fichaDaPrevia, nomesDosAtributos])
  const dadosPorId = useMemo(() => {
    const mapa = new Map<string, DadosDaLinha>()
    for (const entrada of todas) {
      const grupo = grupoPorId.get(entrada.id) ?? 'outro'
      const guardado = dadosGuardados.get(entrada)
      if (guardado !== undefined && guardado.grupo === grupo) {
        mapa.set(entrada.id, guardado.dados)
        continue
      }
      const dados = dadosDaLinha(entrada, grupo, fichaDaPrevia, sistema, nomesDosAtributos)
      dadosGuardados.set(entrada, { grupo, dados })
      mapa.set(entrada.id, dados)
    }
    return mapa
  }, [todas, grupoPorId, dadosGuardados, fichaDaPrevia, sistema, nomesDosAtributos])
  const dadosDe = useCallback((entrada: EntradaDaBiblioteca): DadosDaLinha => dadosPorId.get(entrada.id) ?? { icone: 'caixa', frase: '', fraseDoTexto: true, fichas: [], alcance: null }, [dadosPorId])

  // A busca única do Acervo (nome, categoria, descrição e pasta), a mesma do painel, da mochila e da loja.
  const textosDoAcervo = useMemo(() => textosDeBusca(doAcervo, pastasDoAcervo), [doAcervo, pastasDoAcervo])
  const passaOnde = useCallback(
    (entrada: EntradaDaBiblioteca) => {
      const quem = donos.get(entrada.id) ?? []
      if (onde === 'todas') return true
      if (onde === 'fichas') return quem.length > 0
      if (onde === 'livro') return quem.length === 0
      return quem.some((ficha) => ficha.id === onde)
    },
    [donos, onde],
  )
  /** O que a busca e a coluna Fichas deixam: os chips contam daqui. */
  const base = useMemo<EntradaDaBiblioteca[]>(() => {
    const achadas = new Set(buscarNoCatalogo(entradas, busca, 'todos').map((entrada) => entrada.id))
    const palavras = palavrasDaBusca(busca)
    for (const entrada of entradasDoAcervo) if (itemCasaNaBusca(textosDoAcervo.get(entrada.id), palavras, `${entrada.tipo} acervo`)) achadas.add(entrada.id)
    return todas.filter((entrada) => achadas.has(entrada.id) && passaOnde(entrada))
  }, [entradas, entradasDoAcervo, textosDoAcervo, busca, todas, passaOnde])
  const gruposDaPagina = GRUPOS_DA_PAGINA[pagina]
  const grupoAtivo = grupo === 'todos' || gruposDaPagina.some((dados) => dados.id === grupo) ? grupo : 'todos'
  const gruposNaLista = useMemo<GrupoNaLista[]>(() => {
    const lista = grupoAtivo === 'todos' ? base : base.filter((entrada) => grupoPorId.get(entrada.id) === grupoAtivo)
    const ordenadas = ordenarNaBiblioteca(lista, ordem, (entrada) => donos.get(entrada.id)?.length ?? 0)
    return gruposDaPagina.map((dados) => ({ dados, entradas: ordenadas.filter((entrada) => grupoPorId.get(entrada.id) === dados.id) })).filter((daLista) => daLista.entradas.length > 0)
  }, [base, grupoAtivo, ordem, donos, gruposDaPagina, grupoPorId])
  const naLista = gruposNaLista.reduce((soma, daLista) => soma + daLista.entradas.length, 0)
  const escolhida = todas.find((entrada) => entrada.id === escolhidaId) ?? gruposNaLista[0]?.entradas[0]

  // A lista longa entra aos poucos, um quadro por vez.
  useEffect(() => {
    if (limite >= naLista) return
    const quadro = requestAnimationFrame(() => setLimite((atual) => atual + LINHAS_POR_QUADRO))
    return () => cancelAnimationFrame(quadro)
  }, [limite, naLista])

  const contagemDaColuna = useMemo(() => {
    let emFichas = 0
    for (const entrada of todas) if ((donos.get(entrada.id)?.length ?? 0) > 0) emFichas += 1
    const porFicha = new Map<string, number>()
    for (const quem of donos.values()) for (const ficha of quem) porFicha.set(ficha.id, (porFicha.get(ficha.id) ?? 0) + 1)
    return { todas: todas.length, fichas: emFichas, livro: todas.length - emFichas, porFicha }
  }, [todas, donos])

  // ---- escolher, filtrar ----
  const escolher = useCallback((entrada: EntradaDaBiblioteca) => {
    escolhidaAntes[pagina] = entrada.id
    setEscolhidaId(entrada.id)
    setDarAberto(false)
    setConfirmandoApagar(false)
  }, [pagina])
  const recomecarLista = () => setLimite(LINHAS_NO_PRIMEIRO_QUADRO)
  const escreverBusca = (valor: string) => {
    setBusca(valor)
    recomecarLista()
  }
  const trocarGrupo = (novo: GrupoDaBiblioteca | 'todos') => {
    setGrupo(novo)
    recomecarLista()
  }
  const trocarOnde = (novo: OndeNaBiblioteca) => {
    setOnde((atual) => (atual === novo && novo !== 'todas' ? 'todas' : novo))
    recomecarLista()
  }
  const limparTudo = () => {
    setBusca('')
    setGrupo('todos')
    setOnde('todas')
    recomecarLista()
    buscaRef.current?.focus()
  }
  const dobrar = (id: GrupoDaBiblioteca) =>
    setFechados((atuais) => {
      const proximos = new Set(atuais)
      if (proximos.has(id)) proximos.delete(id)
      else proximos.add(id)
      return proximos
    })

  /** Leva o foco (e a escolha) para a linha `id` da lista, sem rolar animado. */
  const focarLinha = (id: string) => {
    const linha = listaRef.current?.querySelector<HTMLElement>(`[data-entrada="${CSS.escape(id)}"]`)
    linha?.focus()
    linha?.scrollIntoView({ block: 'nearest' })
  }

  const teclarNaBusca = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && busca !== '') {
      // Esc limpa primeiro; com a busca vazia, o Esc segue para o mundo (que fecha).
      event.preventDefault()
      escreverBusca('')
    } else if (event.key === 'ArrowDown') {
      const linhas = listaRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
      const alvo = linhas === undefined ? undefined : ([...linhas].find((linha) => linha.dataset.entrada === escolhida?.id) ?? linhas[0])
      if (alvo === undefined) return
      event.preventDefault()
      alvo.focus()
      const id = alvo.dataset.entrada
      const entrada = id === undefined ? undefined : todas.find((atual) => atual.id === id)
      if (entrada !== undefined) escolher(entrada)
    }
  }

  // ---- dar ----
  const abaDe = (entrada: EntradaDaBiblioteca): AbaDoSistema | undefined => (ehDoAcervo(entrada) ? undefined : abaDeDestino(sistema, entrada.tipo))
  const vaiParaAMochila = (entrada: EntradaDaBiblioteca) => ehDoAcervo(entrada) || entrada.tipo === 'item'

  const estadoParaDar = (entrada: EntradaDaBiblioteca, ficha: Personagem): EstadoParaDar & { motivo: 'pode' | 'jaTem' | 'semAba' } => {
    // A coisa e o item vão para a mochila e empilham: sempre cabe mais um (a mochila cheia é recusada ao dar).
    if (vaiParaAMochila(entrada)) return { pode: true, frase: 'na mochila', motivo: 'pode' }
    const aba = abaDe(entrada)
    if (aba === undefined) return { pode: false, frase: `sem a aba ${DADOS_DO_TIPO[entrada.tipo].nome}`, motivo: 'semAba' }
    const chave = chaveDoNomeDaEntrada(entrada.nome)
    if (cartoesDaAba(ficha, aba.id).some((cartao) => chaveDoNomeDaEntrada(cartao.nome) === chave)) return { pode: false, frase: 'já tem', motivo: 'jaTem' }
    return { pode: true, frase: `na aba ${aba.nome}`, motivo: 'pode' }
  }

  /** A coisa do Acervo ligada à entrada do catálogo (`acervoId`), pronta para dar; `undefined` = solta, ou a coisa saiu do Acervo. */
  const coisaLigada = (entrada: EntradaParaFicha) => {
    if (ehDoLivro(entrada) || entrada.acervoId === undefined) return undefined
    const coisa = doAcervo.find((item) => item.id === entrada.acervoId)
    return coisa === undefined ? undefined : itemParaDar(coisa, doAcervo)
  }

  /**
   * "DAR", A PORTA ÚNICA (lib/livros/coisaERegra.ts): a coisa do Acervo vai
   * para a MOCHILA (e, se o livro tem a arma ligada a ela, o cartão da regra
   * também); a arma vira cartão (com o `itemId`) e a coisa ligada entra na
   * mochila; o resto vira cartão. O resultado é calculado UMA vez sobre a
   * ficha de agora e aplicado igual no disco e na cópia do editor.
   * `quantidade` (o "Quantos" do menu) vale só para a coisa que empilha: entra
   * de uma vez na mesma vaga, com um aviso e um Desfazer só; a que não empilha
   * vai uma (a regra da pilha é a de `darNaFicha`).
   */
  const dar = async (entrada: EntradaDaBiblioteca, ficha: Personagem, quantidade = 1) => {
    const toasts = useToastStore.getState()
    const vagaNova = crypto.randomUUID()
    const resultado = ehDoAcervo(entrada)
      ? porCoisaNaFicha(ficha, itemParaDar(entrada.acervo, doAcervo), regraDaCoisa(itens, entrada.id), sistema, vagaNova)
      : porEntradaNaFicha(ficha, entrada, sistema, coisaLigada(entrada), vagaNova)
    if (!resultado.ok) {
      toasts.push('info', resultado.motivo === 'cheia' ? `${ficha.nome} já carrega o máximo de ${entrada.nome}.` : fraseDaRecusa(resultado.motivo, ficha, entrada))
      return
    }
    const posto = resultado.cartao
    const cartao = posto === null ? undefined : cartoesDaAba(resultado.personagem, posto.abaId).find((atual) => atual.id === posto.cartaoId)
    const coisa = resultado.coisa
    const chave = `${ficha.id}:${entrada.id}`
    // A trava do clique duplo vale para o cartão (dois cliques seriam o mesmo cartão); a coisa sozinha empilha.
    if (cartao !== undefined && pondo.current.has(chave)) return
    if (cartao !== undefined) pondo.current.add(chave)
    // Objeto, não `let`: o TypeScript não vê a atribuição feita dentro da mudança e trataria o valor como sempre nulo.
    const doDisco: { recebido: FichaQueRecebeu | null; achou: boolean } = { recebido: null, achou: false }
    try {
      await useMundoDoLivroStore.getState().mudar((lista) =>
        trocarFicha(lista, ficha.id, (atual) => {
          doDisco.achou = true
          const comOCartao = posto === null || cartao === undefined ? atual : comCartao(atual, posto.abaId, cartao)
          if (coisa === null) return comOCartao
          const deu = darNaFicha(comOCartao, coisa, quantidade, vagaNova)
          if (deu === null) return comOCartao
          doDisco.recebido ??= deu
          return deu.personagem
        }),
      )
    } catch (erro) {
      toasts.push('error', `Não deu para dar ${entrada.nome} a ${ficha.nome}: ${mensagemDoErro(erro)}`)
      return
    } finally {
      pondo.current.delete(chave)
    }
    if (!doDisco.achou) {
      toasts.push('error', `Não deu para dar ${entrada.nome}: a ficha de ${ficha.nome} não está mais nesta pasta.`)
      return
    }
    ultimaFichaAntes = ficha.id
    setRecebeu(ficha.id)
    const recebido = doDisco.recebido
    const desfazer: PostoNaFicha = { cartao: posto, vaga: recebido === null ? null : { vagaId: recebido.vagaId, entraram: recebido.entraram } }
    const aba = abaDe(entrada)
    const frases = [
      ...(cartao !== undefined && aba !== undefined ? [fraseDoPor(entrada, ficha, aba, variacoesDe(ficha.id, personagens).length, resultado)] : []),
      ...(recebido !== null ? [fraseDoPorNaMochila(coisa?.nome ?? entrada.nome, ficha, recebido, coisa?.empilhavel === true ? quantidade : 1)] : []),
    ]
    avisar(frases.join(' '), () => mudarComAviso((lista) => trocarFicha(lista, ficha.id, (atual) => desfazerPosto(atual, desfazer))))
  }

  const darPeloMenu = (entrada: EntradaDaBiblioteca, ficha: Personagem, quantidade: number) => {
    setDarAberto(false)
    void dar(entrada, ficha, quantidade)
  }

  /** A coisa que a escolhida põe na mochila empilha? Só então o "Dar a…" pergunta quantos (a arma do catálogo e o item solto vão um por vez). */
  const empilhaAoDar = (entrada: EntradaDaBiblioteca): boolean => {
    if (ehDoAcervo(entrada)) return entrada.acervo.empilhavel
    if (ehDoLivro(entrada) || entrada.tipo !== 'item') return false
    return coisaLigada(entrada)?.empilhavel === true
  }

  /**
   * "TIRAR DA FICHA" (o "Quem tem" do papel): sai o cartão de mesmo nome da
   * aba de destino e as vagas da coisa ligada na mochila. O Desfazer põe de
   * volta o mesmo cartão e as mesmas vagas.
   */
  const tirar = async (entrada: EntradaDaBiblioteca, ficha: Personagem) => {
    const aba = abaDe(entrada)
    const chave = chaveDoNomeDaEntrada(entrada.nome)
    const tirado: Tirado = { cartao: null, vagas: [] }
    let primeira = true
    try {
      await useMundoDoLivroStore.getState().mudar((lista) =>
        trocarFicha(lista, ficha.id, (atual) => {
          let depois = atual
          const cartao = aba === undefined ? undefined : cartoesDaAba(atual, aba.id).find((atualDaAba) => chaveDoNomeDaEntrada(atualDaAba.nome) === chave)
          if (aba !== undefined && cartao !== undefined) depois = tirarDaFicha(depois, aba.id, cartao.id)
          const vagas = (atual.mochila ?? []).filter((vaga) => vagaDaEntrada(entrada, vaga))
          if (vagas.length > 0) depois = { ...depois, mochila: (depois.mochila ?? []).filter((vaga) => !vagaDaEntrada(entrada, vaga)) }
          // A mudança roda no disco e na cópia do editor: o Desfazer guarda o que saiu do disco (a primeira).
          if (primeira) {
            primeira = false
            tirado.cartao = aba !== undefined && cartao !== undefined ? { abaId: aba.id, cartao } : null
            tirado.vagas = vagas
          }
          return depois
        }),
      )
    } catch (erro) {
      useToastStore.getState().push('error', `Não deu para tirar ${entrada.nome} de ${ficha.nome}: ${mensagemDoErro(erro)}`)
      return
    }
    if (tirado.cartao === null && tirado.vagas.length === 0) {
      useToastStore.getState().push('info', `${ficha.nome} não tem mais ${entrada.nome}.`)
      return
    }
    avisar(`${entrada.nome} saiu da ficha de ${ficha.nome}.`, () =>
      mudarComAviso((lista) =>
        trocarFicha(lista, ficha.id, (atual) => {
          const comOCartao = tirado.cartao === null ? atual : comCartao(atual, tirado.cartao.abaId, tirado.cartao.cartao)
          const ids = new Set((comOCartao.mochila ?? []).map((vaga) => vaga.id))
          const voltam = tirado.vagas.filter((vaga) => !ids.has(vaga.id))
          return voltam.length === 0 ? comOCartao : { ...comOCartao, mochila: [...(comOCartao.mochila ?? []), ...voltam] }
        }),
      ),
    )
  }

  // ---- arrastar a linha até um nome da coluna Fichas ----
  const comecarArrasto = useCallback((event: DragEvent<HTMLElement>, entrada: EntradaDaBiblioteca) => {
    event.dataTransfer.setData('text/plain', entrada.nome)
    event.dataTransfer.effectAllowed = 'copy'
    arrastandoRef.current = entrada
    // Mudar a linha no mesmo quadro do dragstart pode cancelar o arrasto no Chromium: a marca entra no quadro seguinte.
    requestAnimationFrame(() => {
      if (arrastandoRef.current === entrada) setArrastandoId(entrada.id)
    })
  }, [])
  const terminarArrasto = useCallback(() => {
    arrastandoRef.current = null
    setArrastandoId(null)
    setSobre(null)
  }, [])
  const passarNaFicha = (event: DragEvent<HTMLElement>, ficha: Personagem) => {
    const entrada = arrastandoRef.current
    if (entrada === null) return
    const estado = estadoParaDar(entrada, ficha)
    if (estado.pode) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    } else {
      event.dataTransfer.dropEffect = 'none'
    }
    // Só muda o estado ao entrar noutra ficha: o dragover dispara a cada poucos ms.
    if (sobre?.fichaId === ficha.id) return
    const quem = primeiroNome(ficha.nome)
    const frase = estado.pode ? `Soltar: dar a ${quem}` : estado.motivo === 'jaTem' ? `${quem} já tem` : `${quem}: ${estado.frase}`
    setSobre({ fichaId: ficha.id, alvo: { pode: estado.pode, frase } })
  }
  const sairDaFicha = (event: DragEvent<HTMLElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
    setSobre(null)
  }
  const soltarNaFicha = (event: DragEvent<HTMLElement>, ficha: Personagem) => {
    const entrada = arrastandoRef.current
    if (entrada === null) return
    event.preventDefault()
    terminarArrasto()
    if (estadoParaDar(entrada, ficha).pode) void dar(entrada, ficha)
  }

  // ---- o catálogo: criar, editar, apagar, juntar, ligar ----
  const tipoSugerido: TipoDoCatalogo = pagina === 'habilidades' ? 'habilidade' : grupoAtivo !== 'todos' && GRUPOS_DE_ARMA.has(grupoAtivo) ? 'arma' : 'item'
  /** O "Novo": na página Itens, o item nasce no Acervo (o editor pede o tipo); nas Habilidades, a entrada do livro. */
  const criarNovo = () => {
    if (pagina === 'itens') setItemNovo(novoItemDoCatalogo())
    else setDialogo({ tipo: 'nova', tipoDaEntrada: tipoSugerido })
  }
  const podeCriar = pagina === 'itens' ? acervoPodeGravar : podeGravar

  const aoSalvar = (item: ItemDoCatalogo, nova: boolean) => {
    const naOutraPagina = !tiposDaPagina.includes(item.tipo)
    const outra = TOPO_DA_PAGINA[pagina === 'itens' ? 'habilidades' : 'itens'].titulo
    const ondeEsta = naOutraPagina ? ` Está na página ${outra}.` : ''
    useToastStore.getState().push('info', nova ? `${item.nome} entrou no catálogo.${ondeEsta}` : `${item.nome} foi guardado no catálogo.${ondeEsta}`)
    if (naOutraPagina) return
    if (buscarNoCatalogo([item], busca, 'todos').length === 0) setBusca('')
    setGrupo('todos')
    setOnde('todas')
    escolhidaAntes[pagina] = item.id
    setEscolhidaId(item.id)
    setNovos(new Set([item.id]))
    requestAnimationFrame(() => focarLinha(item.id))
  }

  const apagar = async (item: ItemDoCatalogo) => {
    const toasts = useToastStore.getState()
    const ordemNaTela = gruposNaLista.flatMap((daLista) => daLista.entradas)
    const indice = ordemNaTela.findIndex((entrada) => entrada.id === item.id)
    const proxima = ordemNaTela[indice + 1] ?? ordemNaTela[indice - 1]
    try {
      await useCatalogoStore.getState().apagarEntrada(item.id)
    } catch (erro) {
      toasts.push('error', `Não deu para apagar ${item.nome}: ${mensagemDoErro(erro)}`)
      return
    }
    setConfirmandoApagar(false)
    // O foco vai à linha que ocupou o lugar (ou à de antes, ou à busca).
    if (proxima !== undefined) {
      escolhidaAntes[pagina] = proxima.id
      setEscolhidaId(proxima.id)
      requestAnimationFrame(() => focarLinha(proxima.id))
    } else {
      requestAnimationFrame(() => buscaRef.current?.focus())
    }
    avisar(`${item.nome} saiu do livro.`, () => {
      useCatalogoStore
        .getState()
        .salvarEntrada(item)
        .then(
          () => useToastStore.getState().push('info', `${item.nome} voltou ao livro.`),
          (erro: unknown) => useToastStore.getState().push('error', `Não deu para desfazer: ${mensagemDoErro(erro)}`),
        )
    })
  }

  const juntar = async () => {
    if (juntando) return
    setJuntando(true)
    const toasts = useToastStore.getState()
    try {
      const { novas: n, comMecanica } = await useCatalogoStore.getState().juntarDasFichas(personagens)
      const frases = [
        ...(n > 0 ? [`${formatarNumero(n)} ${n === 1 ? 'entrada nova veio' : 'entradas novas vieram'} das fichas da pasta.`] : []),
        ...(comMecanica > 0 ? [`${formatarNumero(comMecanica)} ${comMecanica === 1 ? 'entrada ganhou' : 'entradas ganharam'} a mecânica montada na ficha.`] : []),
      ]
      if (frases.length > 0) toasts.push('info', frases.join(' '))
      else if (personagens.length === 0) toasts.push('info', 'A pasta ainda não tem fichas: nada para juntar.')
      else toasts.push('info', 'Nada novo: o catálogo já tem as armas, habilidades e itens das fichas desta pasta.')
    } catch (erro) {
      toasts.push('error', `Não deu para juntar das fichas: ${mensagemDoErro(erro)}`)
    } finally {
      setJuntando(false)
    }
  }

  /** "Ligar pelo nome": a Garrucha do livro passa a apontar para a Garrucha do Acervo (foto, pilha; a regra fica no livro). */
  const ligar = async () => {
    if (juntando) return
    setJuntando(true)
    const toasts = useToastStore.getState()
    try {
      const n = await useCatalogoStore.getState().ligarPeloNome(doAcervo)
      toasts.push('info', n > 0 ? `${formatarNumero(n)} ${n === 1 ? 'entrada ligada' : 'entradas ligadas'} à coisa do Acervo de mesmo nome.` : 'Nada a ligar: nenhuma arma ou item solto do livro tem o nome de uma coisa do Acervo.')
    } catch (erro) {
      toasts.push('error', `Não deu para ligar ao Acervo: ${mensagemDoErro(erro)}`)
    } finally {
      setJuntando(false)
    }
  }

  const abrirFerramenta = (qual: FerramentaDaBiblioteca) => {
    if (qual === 'juntar') void juntar()
    else if (qual === 'ligar') void ligar()
    else {
      // O menu fecha neste quadro; a lista da ferramenta (até 136 linhas com a forma desenhada) monta no seguinte, noutra tarefa.
      requestAnimationFrame(() =>
        window.setTimeout(() => {
          setFerramenta(qual)
          requestAnimationFrame(() => ferramentaRef.current?.scrollIntoView({ block: 'nearest' }))
        }, 0),
      )
    }
  }

  // ---- testar, editar ----
  /** Quem usa no teste: a ficha escolhida na coluna, senão a primeira que tem, a última que recebeu, a primeira da pasta, ou uma ficha em branco. */
  const quemTesta = (entrada: EntradaDaBiblioteca): Personagem => {
    const porId = (id: string | null) => (id === null ? undefined : fichas.find((ficha) => ficha.id === id))
    return porId(onde) ?? donosDe(entrada)[0] ?? porId(ultimaFichaAntes) ?? fichas[0] ?? novoPersonagem(sistema, 'npc', 'Cópia de teste')
  }

  const motivoDoTeste = (entrada: EntradaDaBiblioteca): string | null => {
    // Itens refeitos (E2): o teste do item no boneco usa a batalha nova (E6c); até lá fica desligado.
    if (ehDoAcervo(entrada) || entrada.tipo === 'item' || entrada.tipo === 'arma') return 'O teste no boneco chega com a batalha.'
    if (ehDoLivro(entrada)) return 'Perícias, vantagens e desvantagens viram vantagem ou desvantagem em testes: não há o que testar no boneco.'
    if (entrada.tipo !== 'habilidade') return 'O teste no boneco é das habilidades e do efeito dos itens do Acervo; a arma se testa pelo Atacar, na Arena de testes.'
    if (grupoPorId.get(entrada.id) === 'passiva') return 'Passiva ainda não tem peças: o app lê a descrição. Não dá para testar.'
    if (abaDe(entrada) === undefined) return 'Este sistema não tem aba de habilidades para o teste.'
    return null
  }

  const testar = (entrada: EntradaDaBiblioteca) => {
    if (motivoDoTeste(entrada) !== null) return
    if (ensaio?.entradaId === entrada.id) {
      setEnsaio(null)
      return
    }
    const quemUsa = quemTesta(entrada)
    if (ehDoAcervo(entrada)) {
      const efeito = entrada.acervo.efeito
      if (efeito === undefined) return
      setEnsaio({
        entradaId: entrada.id,
        cartao: { ...novoCartao(entrada.acervo.nome), id: `ensaio-${entrada.id}`, mecanica: efeito.mecanica },
        quemUsa,
        item: { gasta: efeito.gasta, onde: efeito.onde, quantos: 1 },
      })
      return
    }
    const aba = abaDe(entrada)
    if (aba === undefined) return
    setEnsaio({ entradaId: entrada.id, cartao: cartaoDaEntrada(entrada, aba, sistema), quemUsa })
  }

  const motivoDoEditar = (entrada: EntradaDaBiblioteca): string | null => {
    if (!podeGravar) return 'Parado até o livro ser lido.'
    return !ehDoAcervo(entrada) && ehDoLivro(entrada) ? 'Vem do livro de regras do sistema: não se edita aqui.' : null
  }
  const editar = (entrada: EntradaDaBiblioteca) => {
    if (motivoDoEditar(entrada) !== null) return
    // O teste aberto fecha: ele mostraria a versão de antes, e o Esc dele (na janela) roubaria o Esc da janela de edição.
    setEnsaio(null)
    if (ehDoAcervo(entrada)) setAcervoAberto(entrada.acervo.id)
    else if (!ehDoLivro(entrada)) setDialogo({ tipo: 'editar', item: entrada })
  }

  // ---- as teclas da escolhida: D dá, T testa, E edita; setas, Home e End andam na lista ----
  const teclarNaPagina = (event: KeyboardEvent<HTMLDivElement>) => {
    if (escolhida === undefined || event.ctrlKey || event.metaKey || event.altKey || deCampo(event.target) || comJanelaPorCima()) return
    const tecla = event.key.toLowerCase()
    if (tecla === 'd' && podeGravar) {
      event.preventDefault()
      setDarAberto('tecla')
    } else if (tecla === 't') {
      event.preventDefault()
      testar(escolhida)
    } else if (tecla === 'e') {
      event.preventDefault()
      editar(escolhida)
    }
  }
  const teclarNaLista = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const linhas = [...(listaRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
    if (linhas.length === 0) return
    const atual = linhas.findIndex((linha) => linha === document.activeElement)
    let proxima: number
    if (event.key === 'Home') proxima = 0
    else if (event.key === 'End') proxima = linhas.length - 1
    else proxima = Math.min(linhas.length - 1, Math.max(0, atual + (event.key === 'ArrowDown' ? 1 : -1)))
    event.preventDefault()
    const alvo = linhas[proxima]
    const id = alvo?.dataset.entrada
    const entrada = id === undefined ? undefined : todas.find((atualDaLista) => atualDaLista.id === id)
    if (alvo === undefined || entrada === undefined) return
    escolher(entrada)
    alvo.focus()
  }

  /** "Nas mochilas": quantos de cada ficha (as balas no pente contam à parte) e o total. */
  const quantosNasMochilas = (itemId: string, quem: readonly Personagem[]) => {
    const porFicha = new Map<string, { n: number; pente: number }>()
    let total = 0
    for (const ficha of quem) {
      let n = 0
      let pente = 0
      for (const vaga of ficha.mochila ?? []) {
        if (vaga.itemId === itemId) n += quantidadeDe(vaga)
        if (vaga.pente?.balaId === itemId) pente += vaga.pente.n
      }
      porFicha.set(ficha.id, { n, pente })
      total += n + pente
    }
    return { total, porFicha }
  }
  /** O mestre conferiu um aviso "Confira": ele sai do item (o Acervo grava). */
  const conferir = async (coisa: ItemDoAcervo, indice: number) => {
    const resto = (coisa.confira ?? []).filter((_, i) => i !== indice)
    const { confira: _antes, ...sem } = coisa
    try {
      await useAcervoDeItensStore.getState().salvarItem(resto.length === 0 ? sem : { ...sem, confira: resto })
    } catch (erro) {
      useToastStore.getState().push('error', `Não deu para guardar: ${mensagemDoErro(erro)}`)
    }
  }

  // ---- a coluna da direita ----
  let lado
  if (lendo) {
    lado = (
      <div aria-busy="true">
        <div className="mu-bib-esq" style={{ height: 220 }} />
        <div className="mu-bib-esq" style={{ height: 38, marginTop: 14 }} />
      </div>
    )
  } else if (escolhida === undefined) {
    lado = (
      <div className="mu-bib-lado__vazio">
        <p>Escolha {pagina === 'itens' ? 'um item' : 'uma habilidade'} na lista para ver o cartão, testar e dar a uma ficha.</p>
      </div>
    )
  } else {
    const entrada = escolhida
    const aba = abaDe(entrada)
    const dados = dadosDe(entrada)
    const pecas = pecasDaEntrada(entrada)
    let cartao: CartaoDaFicha
    let linhaCurta: string
    let selo: { texto: string; cor: 'over' | 'acervo' } | null = null
    if (ehDoAcervo(entrada)) {
      const { acervo } = entrada
      cartao = { ...novoCartao(acervo.nome), id: `bib-${acervo.id}`, campos: { descricao: acervo.descricao } }
      linhaCurta = [acervo.tipo === undefined ? (acervo.categoria === '' ? 'Item' : acervo.categoria) : rotuloDoTipoDoItem(acervo.tipo), ...(acervo.preco === null ? [] : [precoEmBerries(acervo.preco)]), ...(acervo.empilhavel ? ['empilhável'] : [])].join(' · ')
      selo = { texto: 'Do Acervo', cor: 'acervo' }
    } else {
      cartao = aba === undefined ? { ...novoCartao(entrada.nome), campos: { descricao: entrada.texto } } : cartaoDaEntrada(entrada, aba, sistema)
      if (ehDoLivro(entrada)) {
        const atributos = entrada.atributos.map((id) => nomesDosAtributos.get(id) ?? id)
        linhaCurta = entrada.tipo === 'pericia' ? `Perícia${atributos.length > 0 ? ` de ${atributos.join(', ')}` : ''}` : DADOS_DO_TIPO[entrada.tipo].um
      } else {
        linhaCurta = linhaDoTexto(cartao)
      }
      if (pecas?.limite.overload === true) selo = { texto: 'Overload', cor: 'over' }
    }
    const coisaDaRegra = !ehDoAcervo(entrada) && !ehDoLivro(entrada) && entrada.acervoId !== undefined ? doAcervo.find((coisa) => coisa.id === entrada.acervoId) : undefined
    const teste =
      ensaio !== null && ensaio.entradaId === entrada.id ? (
        <PainelDeEnsaio key={ensaio.entradaId} cartao={ensaio.cartao} quemUsa={ensaio.quemUsa} sistema={sistema} onFechar={fecharEnsaio} embutido {...(ensaio.item === undefined ? {} : { item: ensaio.item })} />
      ) : null
    const extra = ehDoAcervo(entrada) ? (
      <ConferirCopias acervo={entrada.acervo} personagens={personagens} />
    ) : coisaDaRegra !== undefined ? (
      <p className="mu-bib-dica">Ligada a {coisaDaRegra.nome} do Acervo: a foto e a pilha vêm de lá.</p>
    ) : null
    lado = (
      <LadoDaEscolhida
        key={entrada.id}
        cartao={cartao}
        pecas={pecas}
        frase={dados.frase}
        linhaCurta={linhaCurta}
        selo={selo}
        ficha={fichaDaPrevia}
        sistema={sistema}
        alcance={dados.alcance}
        donos={donosDe(entrada)}
        ondeEntra={vaiParaAMochila(entrada) ? 'na mochila' : `na aba ${aba?.nome ?? DADOS_DO_TIPO[entrada.tipo].nome}`}
        ondeMora={ehDoAcervo(entrada) ? 'Mora no Acervo do app; o livro só mostra.' : ehDoLivro(entrada) ? 'Vem do livro de regras do sistema.' : 'Mora no catálogo deste livro.'}
        podeGravar={podeGravar}
        motivoDoTeste={motivoDoTeste(entrada)}
        motivoDoEditar={motivoDoEditar(entrada)}
        rotuloDoApagar={!ehDoAcervo(entrada) && !ehDoLivro(entrada) ? 'Apagar do livro' : null}
        teste={teste}
        extra={extra}
        gruposParaDar={gruposDeFichas}
        ultimaFicha={ultimaFichaAntes}
        estadoParaDar={(ficha) => estadoParaDar(entrada, ficha)}
        darAberto={darAberto}
        darComQuantidade={empilhaAoDar(entrada)}
        confirmandoApagar={confirmandoApagar}
        onAbrirDar={(abrir) => setDarAberto(abrir ? 'clique' : false)}
        onDar={(ficha, quantidade) => darPeloMenu(entrada, ficha, quantidade)}
        onTestar={() => testar(entrada)}
        onEditar={() => editar(entrada)}
        onTirar={(ficha) => void tirar(entrada, ficha)}
        onPedirApagar={setConfirmandoApagar}
        onApagar={() => {
          if (!ehDoAcervo(entrada) && !ehDoLivro(entrada)) void apagar(entrada)
        }}
        onDarAlcance={podeGravar ? () => abrirFerramenta('alcance') : null}
        {...(ehDoAcervo(entrada) ? { quantos: quantosNasMochilas(entrada.acervo.id, donosDe(entrada)) } : {})}
        {...(ehDoAcervo(entrada) && (entrada.acervo.confira?.length ?? 0) > 0 && acervoPodeGravar ? { confira: { lista: entrada.acervo.confira ?? [], onConferido: (indice: number) => void conferir(entrada.acervo, indice) } } : {})}
      />
    )
  }

  // ---- a lista do meio ----
  const buscando = busca.trim().length > 0
  const fichaDoFiltro = fichas.find((ficha) => ficha.id === onde)
  const nomeDoGrupo = grupoAtivo === 'todos' ? null : (gruposDaPagina.find((dados) => dados.id === grupoAtivo)?.nome ?? null)
  const verTodas = (
    <button type="button" className="mu-bt" onClick={limparTudo}>
      Ver {nomes.todas.toLowerCase()} {nomes.todas === 'Todas' ? 'as' : 'os'} {nomes.varios}
    </button>
  )
  let corpo
  if (lendo) {
    corpo = (
      <div aria-busy="true">
        <p className="mu-it-sr">Lendo o livro…</p>
        {Array.from({ length: 9 }, (_, indice) => (
          <div key={indice} className="mu-bib-esq" />
        ))}
      </div>
    )
  } else if (todas.length === 0) {
    corpo = (
      <div className="mu-bib-vazio">
        <h3>{NADA_NA_PAGINA[pagina].titulo}</h3>
        <p>{NADA_NA_PAGINA[pagina].frase}</p>
        {podeGravar && (
          <div className="mu-bib-vazio__acoes">
            <button type="button" className="mu-bt" disabled={juntando} onClick={() => void juntar()}>
              {juntando ? 'Juntando…' : 'Juntar das fichas da pasta'}
            </button>
            <button type="button" className="mu-bt mu-bt--primario" disabled={!podeCriar} onClick={criarNovo}>
              <IconeDoMundo nome="mais" />
              {NOVA_DO_TIPO[tipoSugerido]}
            </button>
          </div>
        )}
      </div>
    )
  } else if (naLista === 0) {
    let titulo: string
    let frase: string
    if (buscando) {
      const ondeBusca = [nomeDoGrupo === null ? null : `em ${nomeDoGrupo}`, fichaDoFiltro === undefined ? null : `de ${fichaDoFiltro.nome}`].filter((parte) => parte !== null).join(' ')
      titulo = `Nada com “${busca.trim()}”${ondeBusca === '' ? '' : ` ${ondeBusca}`}`
      frase = `Tente pelo efeito (cura, escudo, sangra) ou pelo tipo (${pagina === 'itens' ? 'arma, munição' : 'fogo, reação'}).`
    } else if (fichaDoFiltro !== undefined) {
      titulo = `${fichaDoFiltro.nome} não tem ${nomeDoGrupo === null ? nomes.varios : nomeDoGrupo.toLowerCase()} ainda`
      frase = `Arraste uma linha até o nome na coluna Fichas, ou escolha ${pagina === 'itens' ? 'um item' : 'uma habilidade'} e use “Dar a…”.`
    } else if (onde === 'livro') {
      titulo = 'Tudo já está em alguma ficha'
      frase = `Nenhum${pagina === 'itens' ? '' : 'a'} ${nomes.um}${nomeDoGrupo === null ? '' : ` de ${nomeDoGrupo}`} ficou só no livro.`
    } else {
      titulo = `Nada em ${nomeDoGrupo ?? nomes.varios} ainda`
      frase = `Crie com “${NOVA_DO_TIPO[tipoSugerido]}”.`
    }
    corpo = (
      <div className="mu-bib-vazio">
        <h3>{titulo}</h3>
        <p>{frase}</p>
        <div className="mu-bib-vazio__acoes">
          {buscando && (
            <button type="button" className="mu-bt" onClick={() => escreverBusca('')}>
              Limpar a busca
            </button>
          )}
          {verTodas}
        </div>
      </div>
    )
  } else {
    corpo = (
      <ListaAgrupada
        rotulo={TOPO_DA_PAGINA[pagina].titulo}
        grupos={gruposNaLista}
        fechados={fechados}
        buscando={buscando}
        limite={limite}
        dadosDe={dadosDe}
        donosDe={donosDe}
        imagemDe={imagemDe}
        ehDoAcervo={ehDoAcervo}
        escolhidaId={escolhida?.id ?? null}
        arrastavel={podeGravar && fichas.length > 0}
        arrastadaId={arrastandoId}
        novos={novos}
        listaRef={listaRef}
        onDobrar={dobrar}
        onEscolher={escolher}
        onArrastar={comecarArrasto}
        onFimDoArrasto={terminarArrasto}
        onTeclar={teclarNaLista}
      />
    )
  }
  const anuncio = buscando || grupoAtivo !== 'todos' || onde !== 'todas' ? `${formatarNumero(naLista)} ${naLista === 1 ? nomes.um : nomes.varios} na lista.` : ''

  // Os chips contam o que a busca e a coluna Fichas deixam.
  const porGrupo = new Map<GrupoDaBiblioteca, number>()
  for (const entrada of base) {
    const deQual = grupoPorId.get(entrada.id)
    if (deQual !== undefined) porGrupo.set(deQual, (porGrupo.get(deQual) ?? 0) + 1)
  }
  let separouOLivro = false

  return (
    <div className="mu-pg mu-pg--bib">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">{TOPO_DA_PAGINA[pagina].titulo}</h2>
          <p className="mu-pg-sub">{TOPO_DA_PAGINA[pagina].frase}</p>
        </div>
        <div className="mu-pg-acoes">
          <MenuDeFerramentas pagina={pagina} sistema={sistema} podeGravar={podeGravar} ocupado={juntando} onEscolher={abrirFerramenta} />
          <button type="button" className="mu-bt mu-bt--primario" disabled={!podeCriar} onClick={criarNovo}>
            <IconeDoMundo nome="mais" />
            {NOVA_DO_TIPO[tipoSugerido]}
          </button>
        </div>
      </header>

      {!podeGravar &&
        (lendo ? (
          <p className="mu-pg-nota mu-it-estado" aria-live="polite">
            Lendo o catálogo do livro…
          </p>
        ) : aviso !== null ? (
          <div className="mu-it-aviso" role="alert">
            <IconeDoMundo nome="alerta" />
            <span>{aviso} Criar, editar e dar ficam parados para não apagar o que está no disco.</span>
            <button type="button" className="mu-bt mu-bt--p" onClick={() => void useCatalogoStore.getState().recarregar()}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <p className="mu-pg-nota mu-it-estado">Fora do aplicativo do PC o catálogo não é gravado: criar, editar e dar ficam desligados.</p>
        ))}

      {/* A ferramenta aberta pelo menu: a lista de propostas de sempre, com Confirmar e Desfazer. */}
      {ferramenta !== null && podeGravar && (
        <div ref={ferramentaRef}>
          {ferramenta === 'armas' && <JuntarAsArmas sistema={sistema} onFechar={() => setFerramenta(null)} />}
          {ferramenta === 'alcance' && <DarAlcanceAosAntigos sistema={sistema} onFechar={() => setFerramenta(null)} />}
          {ferramenta === 'requisitos' && <DarRequisitosAosAntigos sistema={sistema} onFechar={() => setFerramenta(null)} />}
        </div>
      )}

      <div className="mu-bib" onKeyDown={teclarNaPagina}>
        <div className="mu-bib__grade">
          <ColunaDasFichas
            grupos={gruposDeFichas}
            onde={onde}
            contagem={contagemDaColuna}
            quantasDaFicha={(ficha) => contagemDaColuna.porFicha.get(ficha.id) ?? 0}
            arrastando={arrastandoId !== null}
            sobre={sobre}
            recebeu={recebeu}
            onOnde={trocarOnde}
            onPassar={passarNaFicha}
            onSair={sairDaFicha}
            onSoltar={soltarNaFicha}
          />

          <section className="mu-bib-col" aria-label={TOPO_DA_PAGINA[pagina].titulo}>
            <div className="mu-bib-barra">
              <div className="mu-bib-barra__l1">
                <div className="mu-busca">
                  <IconeDoMundo nome="busca" />
                  <label className="mu-it-sr" htmlFor={buscaId}>
                    Buscar {nomes.varios}
                  </label>
                  <input
                    ref={buscaRef}
                    id={buscaId}
                    className="mu-entrada"
                    type="search"
                    value={busca}
                    placeholder={pagina === 'itens' ? 'Buscar nome ou efeito (cura, chave)' : 'Buscar nome, efeito ou tipo (sangra, fogo)'}
                    autoComplete="off"
                    spellCheck={false}
                    aria-keyshortcuts="/"
                    disabled={lendo}
                    onChange={(event) => escreverBusca(event.target.value)}
                    onKeyDown={teclarNaBusca}
                  />
                  {busca === '' ? (
                    <kbd className="mu-kbd" aria-hidden="true">
                      /
                    </kbd>
                  ) : (
                    <button
                      type="button"
                      className="mu-bt mu-bt--ic mu-bt--p mu-busca__limpar"
                      aria-label="Limpar a busca"
                      onClick={() => {
                        escreverBusca('')
                        buscaRef.current?.focus()
                      }}
                    >
                      <IconeDoMundo nome="x" />
                    </button>
                  )}
                </div>
                <label className="mu-bib-ordem mu-bib-quem-select" htmlFor={quemId}>
                  Quem tem
                  <select className="mu-entrada" id={quemId} value={onde} onChange={(event) => trocarOnde(event.target.value)}>
                    <option value="todas">Todas</option>
                    <option value="fichas">Em alguma ficha</option>
                    <option value="livro">Só no livro</option>
                    {fichas.map((ficha) => (
                      <option key={ficha.id} value={ficha.id}>
                        {rotuloDaFicha(ficha, personagens)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mu-bib-ordem" htmlFor={ordemId}>
                  Ordem
                  <select
                    className="mu-entrada"
                    id={ordemId}
                    value={ordem}
                    onChange={(event) => {
                      const nova = ORDENS_DA_BIBLIOTECA.find((opcao) => opcao.ordem === event.target.value)
                      if (nova === undefined) return
                      setOrdem(nova.ordem)
                      recomecarLista()
                    }}
                  >
                    {ORDENS_DA_BIBLIOTECA.map((opcao) => (
                      <option key={opcao.ordem} value={opcao.ordem}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!lendo && todas.length > 0 && (
                <div className="mu-bib-chips" role="group" aria-label="Mostrar só um grupo">
                  <button type="button" className="mu-chip mu-chip--sem-ret" aria-pressed={grupoAtivo === 'todos'} onClick={() => trocarGrupo('todos')}>
                    {nomes.todas} <small className="mu-chip__n">{formatarNumero(base.length)}</small>
                  </button>
                  {gruposDaPagina.map((dados) => {
                    const n = porGrupo.get(dados.id) ?? 0
                    const separador = dados.doLivro && !separouOLivro
                    if (separador) separouOLivro = true
                    return (
                      <span key={dados.id} style={{ display: 'contents' }}>
                        {separador && <span className="mu-bib-chips__sep" aria-hidden="true" />}
                        <button type="button" className="mu-chip mu-chip--sem-ret" aria-pressed={grupoAtivo === dados.id} data-zero={n === 0 ? '' : undefined} onClick={() => trocarGrupo(grupoAtivo === dados.id ? 'todos' : dados.id)}>
                          {dados.nome} <small className="mu-chip__n">{formatarNumero(n)}</small>
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <p className="mu-it-sr" role="status">
              {anuncio}
            </p>
            {corpo}
          </section>

          <aside className="mu-bib-lado" aria-label="A escolhida">
            {lado}
          </aside>
        </div>
      </div>

      {dialogo !== null && <EntradaDoCatalogoDialog modo={dialogo} sistema={sistema} onClose={() => setDialogo(null)} onSalvou={aoSalvar} />}
      {/* O editor do item (itens-rework E2), o mesmo do painel do Acervo; o Acervo continua o dono do item. */}
      {itemNovo !== null && (
        <ItemDoCatalogoDialog
          key={itemNovo.id}
          item={itemNovo}
          novo
          categorias={categoriasDoAcervo}
          alvos={[]}
          onSalvar={async (item) => {
            await useAcervoDeItensStore.getState().salvarItem(item)
            setGrupo('todos')
            setOnde('todas')
            setBusca('')
            escolhidaAntes[pagina] = item.id
            setEscolhidaId(item.id)
            setNovos(new Set([item.id]))
            requestAnimationFrame(() => focarLinha(item.id))
          }}
          onApagar={async () => undefined}
          onClose={() => setItemNovo(null)}
          imagemDoBlob={imagemDoItemDoBlob}
          escolherImagem={escolherImagemDoItem}
        />
      )}
      {itemDoAcervoAberto !== undefined && (
        <ItemDoCatalogoDialog
          key={itemDoAcervoAberto.id}
          item={itemDoAcervoAberto}
          novo={false}
          categorias={categoriasDoAcervo}
          alvos={[]}
          onSalvar={(item) => useAcervoDeItensStore.getState().salvarItem(item)}
          onApagar={() => useAcervoDeItensStore.getState().apagarItem(itemDoAcervoAberto.id)}
          onClose={() => setAcervoAberto(null)}
          imagemDoBlob={imagemDoItemDoBlob}
          escolherImagem={escolherImagemDoItem}
        />
      )}
    </div>
  )
}
