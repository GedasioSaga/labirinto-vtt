import { isTauri } from '@tauri-apps/api/core'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { itemParaDar } from '../../lib/acervoDeItens'
import { escolherImagemDoItem, imagemDoItemDoBlob } from '../../lib/imagemDoItem'
import { ABA_DAS_ARMAS, armasDe, limiteDeArmas } from '../../lib/batalha/leituraDaFicha'
import { quantidadeDe } from '../../lib/items'
import { ehDoAcervo, entradaDoAcervo, type EntradaDoAcervo } from '../../lib/livros/acervoNoLivro'
import { ehVariacao, entraNaBatalha, variacoesDe } from '../../lib/livros/combate'
import {
  abaDeDestino,
  buscarNoCatalogo,
  camposDoTipo,
  cartaoDaEntrada,
  chaveDoNomeDaEntrada,
  DADOS_DO_TIPO,
  ehDoLivro,
  podeReceber,
  regraDaCoisa,
  TIPOS_DE_ENTRADA,
  type EntradaParaFicha,
  type ItemDoCatalogo,
  type TipoDoCatalogo,
} from '../../lib/livros/catalogo'
import { FILTROS_DA_PAGINA, passaNoFiltro, pecasDaEntrada, TIPOS_DA_PAGINA, TOPO_DA_PAGINA, type FiltroDaPagina, type PaginaDaBiblioteca } from '../../lib/livros/paginasDaBiblioteca'
import { resumoDaMecanica } from '../../lib/batalha/mecanica/resumo'
import { desfazerPosto, porCoisaNaFicha, porEntradaNaFicha, type PostoNaFicha, type ResultadoDoPor } from '../../lib/livros/coisaERegra'
import { darNaFicha, quantosNaFicha, type FichaQueRecebeu } from '../../lib/mochila/darNaFicha'
import { cartoesDaAba, novoCartao, novoPersonagem, type CartaoDaFicha, type Personagem } from '../../lib/personagem'
import type { AbaDoSistema, CampoDoCartao, SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'
import { useCatalogoStore } from '../../stores/catalogoStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { useToastStore } from '../../stores/toastStore'
import { itensPorCategoria } from '../AcervoDeItensPanel'
import { itemCasaNaBusca, palavrasDaBusca, textosDeBusca } from '../BuscaDoAcervoDeItens'
import { ImagemOuIniciais } from '../FichaPecas'
import { ItemDoCatalogoDialog } from '../ItemDoCatalogoDialog'
import { precoEmBerries } from '../InventarioDaFicha'
import { escolhasDaFicha, formatarNumero, primeiroNome, Retrato, trocarFicha } from './comum'
import { PainelDeEnsaio } from '../ensaio/PainelDeEnsaio'
import { quemUsaDeTreino } from '../../lib/batalha/ensaio/ensaioDoItem'
import { resumoDoEfeitoDoItem } from '../../lib/batalha/mecanica/resumoDoItem'
import { copiasParaAtualizar, fichaComOEfeitoDoItem } from '../../lib/mochila/efeitoNasCopias'
import type { EfeitoDoItem } from '../../types/map'
import { EntradaDoCatalogoDialog, type ModoDaEntrada } from './EntradaDoCatalogoDialog'
import { JuntarAsArmas } from './JuntarAsArmas'
import { IconeDoMundo } from './icones'
import './itens.css'

/**
 * ITENS, ARMAS E HABILIDADES (M3, docs/planos/livros-de-regras-plano.md,
 * seção M3): o catálogo do livro com busca ("/" leva até ela) e filtros por
 * tipo; à direita, a "Ficha que recebe". Arrastar o cartão para a ficha ou
 * "Pôr em <nome>" (o caminho do teclado, e o principal) põe um cartão novo na
 * aba de destino, com Desfazer no aviso. Porte fiel da aba Itens do protótipo
 * aprovado (docs/design/livros-de-regras/).
 *
 * O catálogo (armas, habilidades e itens do mestre, mais as perícias,
 * vantagens e desvantagens do livro) é do `catalogoStore`; as regras de pôr e
 * tirar são de lib/livros/catalogo.ts; a gravação na ficha passa pelo funil
 * único do mundo (`mundo.mudar`).
 *
 * O ACERVO NA PÁGINA (Fase 1 da melhoria geral, lib/livros/acervoNoLivro.ts):
 * as coisas do Acervo do app aparecem aqui também, com o selo "Do acervo",
 * lidas do `acervoDeItensStore` (o Acervo continua o dono; nada é copiado
 * para o catálogo). "Pôr em" e o arrasto de uma delas dão na MOCHILA da ficha
 * (`darNaFicha`, a mesma regra de pilha do "Dar a…"), e a ficha que recebe
 * mostra a mochila.
 */

/** Cartões na tela por vez: um catálogo de 2000 entradas não vira 2000 cartões de uma vez. */
const PASSO_DA_LISTA = 120
/** Quanto tempo a entrada recém-criada fica com o contorno de latão. */
const DESTAQUE_MS = 1600
/** Quantos cartões de cada seção a ficha que recebe mostra (os últimos: é onde o novo entra). */
const ULTIMOS_NA_SECAO = 5
/** Quantas vagas da mochila a ficha que recebe mostra (as últimas: é onde a coisa nova entra). */
const ULTIMAS_DA_MOCHILA = 8
/**
 * O nome do cartão mostra no máximo 2 linhas (o resto vira reticências). Até
 * este tamanho ele sempre cabe nas 2 linhas, mesmo no cartão mais estreito;
 * acima, o nome inteiro vai também na dica do mouse.
 */
const NOME_QUE_SEMPRE_CABE = 24

/** A dica do nome do cartão: só quando o nome pode ter sido cortado nas 2 linhas. */
function tituloDoNome(nome: string): string | undefined {
  return nome.length > NOME_QUE_SEMPRE_CABE ? nome : undefined
}

/** O que a página lista: uma entrada do catálogo ou do livro (vira cartão numa aba) ou uma coisa do Acervo (vai para a mochila). */
type EntradaDaPagina = EntradaParaFicha | EntradaDoAcervo

/** O que o "Pôr em" faz com a entrada e a ficha escolhida. */
type EstadoDoPor = 'pode' | 'jaTem' | 'semAba' | 'semFicha'

const NADA_NA_PAGINA: Readonly<Record<PaginaDaBiblioteca, string>> = {
  itens: 'Nenhum item nem arma ainda. Junte o que as fichas da pasta já têm, crie um item, ou ponha coisas no Acervo.',
  habilidades: 'Nenhuma habilidade no catálogo ainda. Junte as que as fichas da pasta já têm, ou crie uma.',
}
const NOVA_DO_TIPO: Readonly<Record<TipoDoCatalogo, string>> = { arma: 'Nova arma', habilidade: 'Nova habilidade', item: 'Novo item' }
/** Quantas frases do resumo da mecânica o cartão mostra (as outras ficam para o editor e o Testar). */
const FRASES_DO_RESUMO = 3

/** A ficha escolhida em "Ficha que recebe" sobrevive à troca de marcador (estado da sessão, nada em disco). */
let fichaEscolhidaAntes: string | null = null

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** O resumo das peças da entrada montada (as primeiras frases); `null` = sem mecânica válida (vale o texto). */
function resumoDaEntrada(entrada: EntradaParaFicha): string[] | null {
  const pecas = pecasDaEntrada(entrada)
  if (pecas === null) return null
  // ARMAS-FONTE-UNICA §6: a arma mostra o "O que ela faz" inteiro, como o lápis, o Acervo e a ficha (cortado, sumiam o selo e os usos).
  return entrada.tipo === 'arma' ? resumoDaMecanica(pecas) : resumoDaMecanica(pecas).slice(0, FRASES_DO_RESUMO)
}

interface GrupoQueRecebe {
  rotulo: string
  fichas: Personagem[]
}

/** Quem pode receber: jogadores, NPCs de combate (modelos e únicos), os de cenário e, só na mochila, as variações (o cartão elas herdam do modelo). */
function gruposQueRecebem(personagens: readonly Personagem[]): GrupoQueRecebe[] {
  const npcs = personagens.filter((personagem) => personagem.tipo === 'npc' && podeReceber(personagem))
  return [
    { rotulo: 'Jogadores', fichas: personagens.filter((personagem) => personagem.tipo === 'jogador') },
    { rotulo: 'NPCs de combate', fichas: npcs.filter(entraNaBatalha) },
    { rotulo: 'Só no cenário', fichas: npcs.filter((personagem) => !entraNaBatalha(personagem)) },
  ].filter((grupo) => grupo.fichas.length > 0)
}

/** "Recruta da Marinha (modelo de 3 variações)": pôr no modelo dá para todas, e o seletor diz isso. */
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

function fraseDaRecusa(motivo: 'semAba' | 'jaTem' | 'variacao', ficha: Personagem, entrada: EntradaDaPagina): string {
  if (motivo === 'jaTem') return `${ficha.nome} já tem ${entrada.nome}.`
  if (motivo === 'semAba') return `A ficha deste sistema não tem a aba ${DADOS_DO_TIPO[entrada.tipo].nome}.`
  return `${ficha.nome} é variação: ponha no modelo para dar a todas.`
}

/** "Sabre entrou em Armas de Aira. Agora são 2 armas: na batalha Aira escolhe 1." */
function fraseDoPor(entrada: EntradaDaPagina, ficha: Personagem, aba: AbaDoSistema, variacoes: number, resultado: Extract<ResultadoDoPor, { ok: true }>): string {
  const nas = variacoes === 0 ? '' : variacoes === 1 ? ' e na variação' : ` e nas ${variacoes} variações`
  let frase = `${entrada.nome} entrou em ${aba.nome} de ${ficha.nome}${nas}.`
  const limite = limiteDeArmas(resultado.personagem)
  if (resultado.passaDoLimiteDeArmas && limite !== null) {
    frase += ` Agora são ${armasDe(resultado.personagem).length} armas: na batalha ${primeiroNome(ficha.nome)} escolhe ${limite}.`
  }
  return frase
}

/** O Desfazer do "Pôr": tira o cartão pelo id e o que entrou na vaga, nas duas cópias (disco e editor). */
function desfazerPor(fichaId: string, posto: PostoNaFicha): void {
  useMundoDoLivroStore
    .getState()
    .mudar((lista) => trocarFicha(lista, fichaId, (atual) => desfazerPosto(atual, posto)))
    .then(
      () => useToastStore.getState().push('info', 'Desfeito.'),
      (erro: unknown) => useToastStore.getState().push('error', `Não deu para desfazer: ${mensagemDoErro(erro)}`),
    )
}

/** "Garrucha entrou na mochila de Aira." ou, na pilha, "Mais 1 Poção na mochila de Aira: agora são 2." */
function fraseDoPorNaMochila(nome: string, ficha: Personagem, recebido: FichaQueRecebeu): string {
  const vaga = (recebido.personagem.mochila ?? []).find((item) => item.id === recebido.vagaId)
  const total = vaga === undefined ? recebido.entraram : quantidadeDe(vaga)
  if (total > recebido.entraram) return `Mais ${formatarNumero(recebido.entraram)} ${nome} na mochila de ${ficha.nome}: agora são ${formatarNumero(total)}.`
  return `${nome} entrou na mochila de ${ficha.nome}.`
}

interface LinhaDoCampo {
  rotulo: string
  valor: string
}

/** Os campos do cartão do catálogo, na ordem da aba de destino ("Dano 35", "Ação Ação Simples"); a perícia mostra os atributos. */
function linhasDaEntrada(entrada: EntradaParaFicha, campos: readonly CampoDoCartao[], atributos: ReadonlyMap<string, string>): LinhaDoCampo[] {
  const conhecidos = new Set(campos.map((campo) => campo.id))
  const linhas: LinhaDoCampo[] = campos.flatMap((campo) => {
    const valor = entrada.campos[campo.id]
    return valor === undefined ? [] : [{ rotulo: campo.rotulo, valor }]
  })
  for (const [chave, valor] of Object.entries(entrada.campos)) if (!conhecidos.has(chave)) linhas.push({ rotulo: chave, valor })
  if (ehDoLivro(entrada) && entrada.atributos.length > 0) {
    const nomes = entrada.atributos.map((id) => atributos.get(id) ?? id)
    linhas.push({ rotulo: nomes.length === 1 ? 'Atributo' : 'Atributos', valor: nomes.join(', ') })
  }
  return linhas
}

export interface PaginaItensProps {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
  /**
   * Fase 1 (docs/design/habilidades/SISTEMA.md §7): a mesma página serve as
   * duas, Itens (armas, itens e o Acervo) e Habilidades (as técnicas e o que
   * vem do livro), cada uma com a frase do topo e os filtros dela.
   */
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

  const buscaId = useId()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroDaPagina>('todos')
  const [mostrar, setMostrar] = useState(PASSO_DA_LISTA)
  const [fichaId, setFichaId] = useState<string | null>(fichaEscolhidaAntes)
  const [dialogo, setDialogo] = useState<ModoDaEntrada | null>(null)
  /** A coisa do Acervo aberta na janela do Acervo (o id; o item vem do store, para a janela ver o que foi salvo). */
  const [acervoAberto, setAcervoAberto] = useState<string | null>(null)
  const itemDoAcervoAberto = acervoAberto === null ? undefined : doAcervo.find((item) => item.id === acervoAberto)
  const [juntando, setJuntando] = useState(false)
  /** ARMAS-FONTE-UNICA §4: o ensaio do "Juntar as armas" aberto embaixo do topo. */
  const [juntandoArmas, setJuntandoArmas] = useState(false)
  const [arrastando, setArrastando] = useState<EntradaDaPagina | null>(null)
  const [sobre, setSobre] = useState(false)
  /** Cartões e vagas da mochila postos nesta visita (`ficha:cartão`, `ficha:vaga`): a seção da ficha os mostra em latão. */
  const [novos, setNovos] = useState<ReadonlySet<string>>(() => new Set())
  const [destacado, setDestacado] = useState<string | null>(null)
  /** Fase 3: o Testar aberto (o cartão feito da entrada uma vez, para o id não mudar a cada render). */
  // Fase 7: o Testar do item do Acervo usa o mesmo painel, com o gasto no fim (`item`).
  const [ensaio, setEnsaio] = useState<{ cartao: CartaoDaFicha; quemUsa: Personagem; item?: Pick<EfeitoDoItem, 'gasta' | 'onde'> & { quantos: number } } | null>(null)
  const fecharEnsaio = useCallback(() => setEnsaio(null), [])
  const arrastandoRef = useRef<EntradaDaPagina | null>(null)
  /** Pôr em andamento (`ficha:entrada`): o clique duplo não grava duas vezes. */
  const pondo = useRef(new Set<string>())
  const buscaRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)

  // O mundo abre o catálogo do sistema ao abrir; aqui só garante (abrir direto neste marcador, ou outro sistema).
  useEffect(() => {
    if (useCatalogoStore.getState().sistemaId !== sistema.id) void useCatalogoStore.getState().abrir(sistema)
  }, [sistema])

  // "/" leva à busca de qualquer lugar do mundo, menos de dentro de um campo ou com uma janela por cima.
  // Na captura: o mundo para a propagação das teclas dele (o editor atrás não as recebe).
  useEffect(() => {
    const aoTeclar = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return
      const alvo = event.target
      if (alvo instanceof HTMLElement && (alvo.isContentEditable || alvo.closest('input, textarea, select') !== null)) return
      if (useMundoDoLivroStore.getState().fichaAberta !== null || document.querySelector('.mu-modal-fundo') !== null) return
      const campo = buscaRef.current
      if (campo === null) return
      event.preventDefault()
      event.stopPropagation()
      campo.focus()
      campo.select()
    }
    window.addEventListener('keydown', aoTeclar, true)
    return () => window.removeEventListener('keydown', aoTeclar, true)
  }, [])

  // A entrada recém-criada aparece na tela (sem rolar animado: veio de um Enter ou de um clique) e o contorno some sozinho.
  useEffect(() => {
    if (destacado === null) return
    listaRef.current?.querySelector<HTMLElement>(`[data-entrada="${CSS.escape(destacado)}"]`)?.scrollIntoView({ block: 'nearest' })
    const relogio = window.setTimeout(() => setDestacado(null), DESTAQUE_MS)
    return () => window.clearTimeout(relogio)
  }, [destacado])

  const tiposDaPagina = TIPOS_DA_PAGINA[pagina]
  const entradas = useMemo<EntradaParaFicha[]>(
    () => (doSistema ? [...itens, ...doLivro].filter((entrada) => tiposDaPagina.includes(entrada.tipo)) : []),
    [doSistema, itens, doLivro, tiposDaPagina],
  )
  /** A categoria de cada coisa do Acervo, para os filtros de Itens (a entrada ligada cai na categoria da coisa). */
  const categoriaPorCoisa = useMemo(() => new Map(doAcervo.map((coisa) => [coisa.id, coisa] as const)), [doAcervo])
  // Na ordem das categorias do Acervo, como o painel do mestre as mostra. Só a página Itens lista o Acervo.
  const entradasDoAcervo = useMemo(
    () => (pagina === 'itens' ? itensPorCategoria(doAcervo, categoriasDoAcervo).flatMap((grupo) => grupo.itens.map(entradaDoAcervo)) : []),
    [pagina, doAcervo, categoriasDoAcervo],
  )
  // A busca única do Acervo (nome, categoria, descrição e pasta), a mesma do painel, da mochila e da loja.
  const textosDoAcervo = useMemo(() => textosDeBusca(doAcervo, pastasDoAcervo), [doAcervo, pastasDoAcervo])
  /** Tudo o que a busca acha, antes do filtro: o número de cada filtro conta daqui. */
  const achadasNaBusca = useMemo<EntradaDaPagina[]>(() => {
    const achadas = buscarNoCatalogo(entradas, busca, 'todos')
    const palavras = palavrasDaBusca(busca)
    // O nome do tipo ("arma", "item") e "acervo" também acham, como na busca do catálogo.
    const doAcervoAchadas = entradasDoAcervo.filter((entrada) => itemCasaNaBusca(textosDoAcervo.get(entrada.id), palavras, `${entrada.tipo} acervo`))
    // As coisas do Acervo depois das entradas do mestre e antes das do livro (perícias, vantagens, desvantagens).
    return [...achadas.filter((entrada) => !ehDoLivro(entrada)), ...doAcervoAchadas, ...achadas.filter(ehDoLivro)]
  }, [entradas, entradasDoAcervo, textosDoAcervo, busca])
  /** Os filtros da página com o número de cada; o que não tem nenhuma entrada sai (menos o Tudo e o aberto). */
  const filtros = useMemo(() => {
    const todas = [...entradas, ...entradasDoAcervo]
    return FILTROS_DA_PAGINA[pagina]
      .map((opcao) => ({ ...opcao, n: todas.filter((entrada) => passaNoFiltro(pagina, entrada, opcao.filtro, categoriaPorCoisa)).length }))
      .filter((opcao) => opcao.filtro === 'todos' || opcao.filtro === filtro || opcao.n > 0)
  }, [pagina, entradas, entradasDoAcervo, categoriaPorCoisa, filtro])
  const filtroAtivo: FiltroDaPagina = filtros.some((opcao) => opcao.filtro === filtro) ? filtro : 'todos'
  const rotuloDoFiltro = FILTROS_DA_PAGINA[pagina].find((opcao) => opcao.filtro === filtroAtivo)?.rotulo ?? ''
  const lista = useMemo(
    () => achadasNaBusca.filter((entrada) => passaNoFiltro(pagina, entrada, filtroAtivo, categoriaPorCoisa)),
    [achadasNaBusca, pagina, filtroAtivo, categoriaPorCoisa],
  )

  const abaPorTipo = useMemo(() => new Map(tiposDaPagina.map((tipo) => [tipo, abaDeDestino(sistema, tipo)] as const)), [sistema, tiposDaPagina])
  const camposPorTipo = useMemo(() => new Map(TIPOS_DE_ENTRADA.map((tipo) => [tipo, camposDoTipo(sistema, tipo)] as const)), [sistema])
  const nomesDosAtributos = useMemo(() => new Map(sistema.atributos.map((atributo) => [atributo.id, atributo.nome])), [sistema])
  /** As abas que a ficha que recebe mostra, na ordem dos filtros, uma vez cada. */
  const secoes = useMemo(() => {
    const vistas = new Set<string>()
    const abas: AbaDoSistema[] = []
    for (const aba of abaPorTipo.values()) {
      if (aba === undefined || vistas.has(aba.id)) continue
      vistas.add(aba.id)
      abas.push(aba)
    }
    return abas
  }, [abaPorTipo])

  const grupos = useMemo(() => gruposQueRecebem(personagens), [personagens])
  const destino = grupos.flatMap((grupo) => grupo.fichas).find((personagem) => personagem.id === fichaId) ?? grupos[0]?.fichas[0]

  /** Fase 3: quem usa é a ficha escolhida ao lado (numa cópia); sem ficha na pasta, uma ficha em branco do sistema. */
  const testar = (entrada: EntradaParaFicha) => {
    const aba = abaDeDestino(sistema, entrada.tipo)
    if (aba === undefined) {
      useToastStore.getState().push('info', 'Este sistema não tem aba de habilidades para o teste.')
      return
    }
    setEnsaio({ cartao: cartaoDaEntrada(entrada, aba, sistema), quemUsa: destino ?? novoPersonagem(sistema, 'npc', 'Cópia de teste') })
  }
  /** Os nomes que a ficha já tem em cada aba de destino (sem acento, sem caixa): o "Já está em" sem passar pela regra a cada cartão. */
  const nomesNaFicha = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    if (destino !== undefined) for (const aba of secoes) mapa.set(aba.id, new Set(cartoesDaAba(destino, aba.id).map((cartao) => chaveDoNomeDaEntrada(cartao.nome))))
    return mapa
  }, [destino, secoes])

  const estadoDoPor = (entrada: EntradaDaPagina): EstadoDoPor => {
    if (destino === undefined) return 'semFicha'
    // A coisa do Acervo vai para a mochila, que toda ficha tem; ter uma não impede de levar outra (como o "Dar a…").
    if (ehDoAcervo(entrada)) return 'pode'
    const aba = abaPorTipo.get(entrada.tipo)
    if (aba === undefined) return 'semAba'
    return nomesNaFicha.get(aba.id)?.has(chaveDoNomeDaEntrada(entrada.nome)) === true ? 'jaTem' : 'pode'
  }

  const escolherFicha = (id: string) => {
    fichaEscolhidaAntes = id
    setFichaId(id)
  }

  /**
   * "Pôr em" de uma coisa do Acervo: entra na MOCHILA da ficha (`darNaFicha`).
   * A mudança roda no disco e depois na cópia do editor (`editarRpgDaPasta`);
   * a vaga nova tem id fixo para as duas, e o aviso conta o que o disco (a
   * primeira) recebeu. Sem trava de clique duplo: dois cliques são duas
   * Poções, em fila no funil do mundo.
   */
  /**
   * "PÔR EM", A PORTA ÚNICA (Fase 5, lib/livros/coisaERegra.ts): a coisa do
   * Acervo vai para a MOCHILA (e, se o livro tem a arma ligada a ela, o cartão
   * da regra também); o item do catálogo vai para a mochila (inteiro, se
   * ligado a uma coisa); a arma vira cartão (com o `itemId`) e a coisa ligada
   * entra na mochila; o resto vira cartão, como antes.
   *
   * O resultado é calculado UMA vez sobre a ficha de agora e aplicado igual no
   * disco e na cópia do editor (`editarRpgDaPasta` roda a mudança duas vezes):
   * o cartão chega pronto, com id fixo, e a vaga nova tem id fixo.
   */
  const por = async (entrada: EntradaDaPagina) => {
    const ficha = destino
    if (ficha === undefined) return
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
    // A trava do clique duplo vale para o cartão (dois cliques seriam o mesmo cartão); a coisa sozinha empilha, como o "Dar a…".
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
          const deu = darNaFicha(comOCartao, coisa, 1, vagaNova)
          if (deu === null) return comOCartao
          doDisco.recebido ??= deu
          return deu.personagem
        }),
      )
    } catch (erro) {
      toasts.push('error', `Não deu para pôr ${entrada.nome} em ${ficha.nome}: ${mensagemDoErro(erro)}`)
      return
    } finally {
      pondo.current.delete(chave)
    }
    if (!doDisco.achou) {
      toasts.push('error', `Não deu para pôr ${entrada.nome}: a ficha de ${ficha.nome} não está mais nesta pasta.`)
      return
    }
    const recebido = doDisco.recebido
    const desfazer: PostoNaFicha = { cartao: posto, vaga: recebido === null ? null : { vagaId: recebido.vagaId, entraram: recebido.entraram } }
    setNovos((atuais) => {
      const proximos = new Set(atuais)
      if (cartao !== undefined) proximos.add(`${ficha.id}:${cartao.id}`)
      if (recebido !== null) proximos.add(`${ficha.id}:${recebido.vagaId}`)
      return proximos
    })
    const aba = abaPorTipo.get(entrada.tipo)
    const frases = [
      ...(cartao !== undefined && aba !== undefined ? [fraseDoPor(entrada, ficha, aba, variacoesDe(ficha.id, personagens).length, resultado)] : []),
      ...(recebido !== null ? [fraseDoPorNaMochila(coisa?.nome ?? entrada.nome, ficha, recebido)] : []),
    ]
    toasts.push('info', frases.join(' '), undefined, {
      actions: [{ label: 'Desfazer', run: () => desfazerPor(ficha.id, desfazer) }],
    })
  }

  /** A coisa do Acervo ligada à entrada do catálogo (`acervoId`), pronta para dar; `undefined` = solta, ou a coisa saiu do Acervo. */
  const coisaLigada = (entrada: EntradaParaFicha) => {
    if (ehDoLivro(entrada) || entrada.acervoId === undefined) return undefined
    const coisa = doAcervo.find((item) => item.id === entrada.acervoId)
    return coisa === undefined ? undefined : itemParaDar(coisa, doAcervo)
  }

  // ---- arrastar o cartão para a ficha ----
  const comecarArrasto = (event: DragEvent<HTMLElement>, entrada: EntradaDaPagina) => {
    event.dataTransfer.setData('text/plain', entrada.nome)
    event.dataTransfer.effectAllowed = 'copy'
    arrastandoRef.current = entrada
    // Mudar o cartão no mesmo quadro do dragstart pode cancelar o arrasto no Chromium: a marca entra no quadro seguinte.
    requestAnimationFrame(() => {
      if (arrastandoRef.current === entrada) setArrastando(entrada)
    })
  }
  const terminarArrasto = () => {
    arrastandoRef.current = null
    setArrastando(null)
    setSobre(false)
  }
  const passarNoDestino = (event: DragEvent<HTMLElement>) => {
    const entrada = arrastandoRef.current
    if (entrada === null) return
    if (estadoDoPor(entrada) === 'pode') {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    } else {
      event.dataTransfer.dropEffect = 'none'
    }
    if (!sobre) setSobre(true)
  }
  const sairDoDestino = (event: DragEvent<HTMLElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
    setSobre(false)
  }
  const soltarNoDestino = (event: DragEvent<HTMLElement>) => {
    const entrada = arrastandoRef.current
    if (entrada === null) return
    event.preventDefault()
    terminarArrasto()
    if (estadoDoPor(entrada) === 'pode') void por(entrada)
  }

  // ---- busca e filtros ----
  const escreverBusca = (valor: string) => {
    setBusca(valor)
    setMostrar(PASSO_DA_LISTA)
  }
  const trocarFiltro = (novo: FiltroDaPagina) => {
    setFiltro(novo)
    setMostrar(PASSO_DA_LISTA)
  }
  const limparTudo = () => {
    escreverBusca('')
    trocarFiltro('todos')
    buscaRef.current?.focus()
  }
  const teclarNaBusca = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && busca !== '') {
      // Esc limpa primeiro; com a busca vazia, o Esc segue para o mundo (que fecha).
      event.preventDefault()
      escreverBusca('')
    } else if (event.key === 'ArrowDown') {
      const primeiro = listaRef.current?.querySelector<HTMLElement>('button')
      if (primeiro === null || primeiro === undefined) return
      event.preventDefault()
      primeiro.focus()
    }
  }

  // ---- o catálogo: criar, editar, apagar, juntar ----
  const tipoSugerido: TipoDoCatalogo = pagina === 'habilidades' ? 'habilidade' : filtroAtivo === 'armas' ? 'arma' : 'item'

  const aoSalvar = (item: ItemDoCatalogo, nova: boolean) => {
    const naOutraPagina = !tiposDaPagina.includes(item.tipo)
    const outra = TOPO_DA_PAGINA[pagina === 'itens' ? 'habilidades' : 'itens'].titulo
    const onde = naOutraPagina ? ` Está na página ${outra}.` : ''
    useToastStore.getState().push('info', nova ? `${item.nome} entrou no catálogo.${onde}` : `${item.nome} foi guardado no catálogo.${onde}`)
    if (naOutraPagina) return
    if (buscarNoCatalogo([item], busca, 'todos').length === 0 || !passaNoFiltro(pagina, item, filtroAtivo, categoriaPorCoisa)) {
      setBusca('')
      setFiltro('todos')
    }
    setMostrar((atual) => Math.max(atual, itens.length + 1))
    setDestacado(item.id)
  }

  /** Depois de apagar, o foco vai ao cartão que ocupou o lugar (ou ao de antes, ou à busca). */
  const focarCartao = (indice: number) => {
    const cartoes = listaRef.current?.querySelectorAll<HTMLElement>(':scope > li') ?? []
    const alvo = cartoes[Math.min(indice, cartoes.length - 1)]?.querySelector<HTMLElement>('button')
    if (alvo !== null && alvo !== undefined) alvo.focus()
    else buscaRef.current?.focus()
  }

  const apagar = async (item: ItemDoCatalogo, indice: number) => {
    const toasts = useToastStore.getState()
    try {
      await useCatalogoStore.getState().apagarEntrada(item.id)
    } catch (erro) {
      toasts.push('error', `Não deu para apagar ${item.nome}: ${mensagemDoErro(erro)}`)
      return
    }
    requestAnimationFrame(() => focarCartao(indice))
    toasts.push('info', `${item.nome} saiu do catálogo.`, undefined, {
      actions: [
        {
          label: 'Desfazer',
          run: () => {
            useCatalogoStore
              .getState()
              .salvarEntrada(item)
              .then(
                () => useToastStore.getState().push('info', `${item.nome} voltou ao catálogo.`),
                (erro: unknown) => useToastStore.getState().push('error', `Não deu para desfazer: ${mensagemDoErro(erro)}`),
              )
          },
        },
      ],
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

  /** Fase 5, "Ligar pelo nome": a Garrucha do livro passa a apontar para a Garrucha do Acervo (foto, pilha; a regra fica no livro). */
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

  const buscando = busca.trim().length > 0
  const anuncio = buscando || filtroAtivo !== 'todos' ? `${formatarNumero(lista.length)} ${lista.length === 1 ? 'entrada' : 'entradas'}` : ''
  const visiveis = lista.slice(0, mostrar)
  const estadoDoArrasto = arrastando === null ? null : estadoDoPor(arrastando)

  let corpo
  if (lista.length > 0) {
    corpo = (
      <>
        <ul className="mu-cat-lista" ref={listaRef} aria-label={`Catálogo, ${formatarNumero(lista.length)} ${lista.length === 1 ? 'entrada' : 'entradas'}`}>
          {visiveis.map((entrada, indice) =>
            ehDoAcervo(entrada) ? (
              <CartaoDoAcervo
                key={entrada.id}
                entrada={entrada}
                destino={destino}
                naFicha={destino === undefined ? 0 : quantosNaFicha(destino, entrada.id)}
                arrastando={arrastando?.id === entrada.id}
                onPor={() => void por(entrada)}
                onArrastar={comecarArrasto}
                onSoltar={terminarArrasto}
                sistema={sistema}
                personagens={personagens}
                onEditar={() => setAcervoAberto(entrada.acervo.id)}
                onTestar={(efeito) =>
                  setEnsaio({
                    cartao: { ...novoCartao(entrada.acervo.nome), id: `ensaio-${entrada.id}`, mecanica: efeito.mecanica },
                    quemUsa: destino ?? quemUsaDeTreino(sistema),
                    item: { gasta: efeito.gasta, onde: efeito.onde, quantos: Math.max(1, destino === undefined ? 1 : quantosNaFicha(destino, entrada.id)) },
                  })
                }
              />
            ) : (
              <CartaoDaEntrada
                key={entrada.id}
                entrada={entrada}
                coisa={ehDoLivro(entrada) || entrada.acervoId === undefined ? undefined : doAcervo.find((item) => item.id === entrada.acervoId)}
                linhas={linhasDaEntrada(entrada, camposPorTipo.get(entrada.tipo) ?? [], nomesDosAtributos)}
                resumo={resumoDaEntrada(entrada)}
                estado={estadoDoPor(entrada)}
                destino={destino}
                podeGravar={podeGravar}
                arrastando={arrastando?.id === entrada.id}
                destacado={destacado === entrada.id}
                onPor={() => void por(entrada)}
                onTestar={entrada.tipo === 'habilidade' ? () => testar(entrada) : null}
                onEditar={(item) => setDialogo({ tipo: 'editar', item })}
                onApagar={(item) => void apagar(item, indice)}
                onArrastar={comecarArrasto}
                onSoltar={terminarArrasto}
              />
            ),
          )}
        </ul>
        {lista.length > visiveis.length && (
          <div className="mu-cat-mais">
            <button type="button" className="mu-bt" onClick={() => setMostrar((atual) => atual + PASSO_DA_LISTA)}>
              Mostrar mais {formatarNumero(Math.min(PASSO_DA_LISTA, lista.length - visiveis.length))}
            </button>
            <span className="mu-pg-nota">
              {formatarNumero(visiveis.length)} de {formatarNumero(lista.length)}
            </span>
          </div>
        )}
      </>
    )
  } else if (lendo) {
    corpo = (
      <div className="mu-vazio" aria-busy="true">
        <p>Lendo o catálogo do livro…</p>
      </div>
    )
  } else if (buscando) {
    corpo = (
      <div className="mu-vazio">
        <p>
          Nada com “{busca.trim()}”{filtroAtivo === 'todos' ? '' : ` em ${rotuloDoFiltro}`}. Tente pelo efeito (cura, escudo) ou pelo tipo ({pagina === 'itens' ? 'arma' : 'reação'}).
        </p>
        <button type="button" className="mu-bt mu-bt--p" onClick={limparTudo}>
          Limpar a busca
        </button>
      </div>
    )
  } else {
    corpo = (
      <div className="mu-vazio">
        <p>{filtroAtivo !== 'todos' ? `Nada em ${rotuloDoFiltro} ainda.` : NADA_NA_PAGINA[pagina]}</p>
        {podeGravar && (
          <div className="mu-pg-acoes">
            <button type="button" className="mu-bt mu-bt--p" disabled={juntando} onClick={() => void juntar()}>
              {juntando ? 'Juntando…' : 'Juntar das fichas da pasta'}
            </button>
            <button type="button" className="mu-bt mu-bt--p" onClick={() => setDialogo({ tipo: 'nova', tipoDaEntrada: tipoSugerido })}>
              <IconeDoMundo nome="mais" />
              {NOVA_DO_TIPO[tipoSugerido]}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mu-pg">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">{TOPO_DA_PAGINA[pagina].titulo}</h2>
          <p className="mu-pg-sub">{TOPO_DA_PAGINA[pagina].frase}</p>
        </div>
        <div className="mu-pg-acoes">
          <button type="button" className="mu-bt" disabled={!podeGravar || juntando} onClick={() => void juntar()}>
            {juntando ? 'Juntando…' : 'Juntar das fichas da pasta'}
          </button>
          {pagina === 'itens' && (
            <button type="button" className="mu-bt" disabled={!podeGravar || juntando || doAcervo.length === 0} onClick={() => void ligar()} title="Liga cada arma e item do livro à coisa do Acervo de mesmo nome">
              Ligar ao Acervo pelo nome
            </button>
          )}
          {pagina === 'itens' && (
            <button type="button" className="mu-bt" aria-expanded={juntandoArmas} disabled={!podeGravar || juntando} onClick={() => setJuntandoArmas((antes) => !antes)} title="Faz cada arma dizer o mesmo no livro, no Acervo e nas fichas; mostra a lista antes de gravar">
              Juntar as armas
            </button>
          )}
          <button type="button" className="mu-bt mu-bt--primario" disabled={!podeGravar} onClick={() => setDialogo({ tipo: 'nova', tipoDaEntrada: tipoSugerido })}>
            <IconeDoMundo nome="mais" />
            {NOVA_DO_TIPO[tipoSugerido]}
          </button>
        </div>
      </header>

      {juntandoArmas && podeGravar && <JuntarAsArmas sistema={sistema} onFechar={() => setJuntandoArmas(false)} />}

      {!podeGravar &&
        (lendo ? (
          <p className="mu-pg-nota mu-it-estado" aria-live="polite">
            Lendo o catálogo do livro…
          </p>
        ) : aviso !== null ? (
          <div className="mu-it-aviso" role="alert">
            <IconeDoMundo nome="alerta" />
            <span>{aviso} Criar, editar e juntar ficam parados para não apagar o que está no disco.</span>
            <button type="button" className="mu-bt mu-bt--p" onClick={() => void useCatalogoStore.getState().recarregar()}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <p className="mu-pg-nota mu-it-estado">Fora do aplicativo do PC o catálogo não é gravado: criar, editar e juntar ficam desligados.</p>
        ))}

      <div className="mu-cat">
        <div className="mu-cat-col">
          <div className="mu-cat-busca">
            <div className="mu-busca">
              <IconeDoMundo nome="busca" />
              <label className="mu-it-sr" htmlFor={buscaId}>
                Buscar {pagina === 'itens' ? 'itens' : 'habilidades'}
              </label>
              <input
                ref={buscaRef}
                id={buscaId}
                className="mu-entrada"
                type="search"
                value={busca}
                placeholder={pagina === 'itens' ? 'Buscar por nome ou efeito (ex.: cura, veneno)' : 'Buscar por nome ou efeito (ex.: sangra, reação)'}
                autoComplete="off"
                spellCheck={false}
                aria-keyshortcuts="/"
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
            <div className="mu-chips" role="group" aria-label="Tipo">
              {filtros.map((opcao) => (
                <button key={opcao.filtro} type="button" className="mu-chip mu-chip--sem-ret" aria-pressed={filtroAtivo === opcao.filtro} onClick={() => trocarFiltro(opcao.filtro)}>
                  {opcao.rotulo} <small className="mu-chip__n">{formatarNumero(opcao.n)}</small>
                </button>
              ))}
            </div>
          </div>
          <p className="mu-it-sr" role="status">
            {anuncio}
          </p>
          {corpo}
        </div>

        {ensaio !== null ? (
          <PainelDeEnsaio cartao={ensaio.cartao} quemUsa={ensaio.quemUsa} sistema={sistema} onFechar={fecharEnsaio} {...(ensaio.item === undefined ? {} : { item: ensaio.item })} />
        ) : (
        <PainelDoDestino
          grupos={grupos}
          destino={destino}
          personagens={personagens}
          sistema={sistema}
          secoes={secoes}
          comMochila={pagina === 'itens'}
          abaDoArrasto={arrastando === null || ehDoAcervo(arrastando) ? null : (abaPorTipo.get(arrastando.tipo)?.id ?? null)}
          mochilaDoArrasto={arrastando !== null && ehDoAcervo(arrastando)}
          recusa={
            destino !== undefined && arrastando !== null && !ehDoAcervo(arrastando) && estadoDoArrasto !== 'pode' ? recusaDoArrasto(estadoDoArrasto, destino, arrastando) : null
          }
          sobre={sobre && estadoDoArrasto === 'pode'}
          novos={novos}
          onEscolher={escolherFicha}
          onPassar={passarNoDestino}
          onSair={sairDoDestino}
          onSoltar={soltarNoDestino}
        />
        )}
      </div>

      {dialogo !== null && <EntradaDoCatalogoDialog modo={dialogo} sistema={sistema} onClose={() => setDialogo(null)} onSalvou={aoSalvar} />}
      {/* A mesma janela do Acervo (nome, foto, "O que ele faz"); o Acervo continua o dono do item. */}
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

/** O que o painel diz enquanto o cartão arrastado não pode entrar na ficha escolhida. */
function recusaDoArrasto(estado: EstadoDoPor | null, ficha: Personagem, entrada: EntradaParaFicha): string | null {
  if (estado === 'jaTem') return fraseDaRecusa('jaTem', ficha, entrada)
  if (estado === 'semAba') return fraseDaRecusa('semAba', ficha, entrada)
  return null
}

interface CartaoDaEntradaProps {
  entrada: EntradaParaFicha
  /** A coisa do Acervo ligada (`acervoId`); ausente = entrada solta, ou a coisa saiu do Acervo. */
  coisa: { nome: string; imagem: string | null } | undefined
  linhas: readonly LinhaDoCampo[]
  /** B04: as primeiras frases da mecânica montada que a entrada guarda; `null` = vale o texto. */
  resumo: readonly string[] | null
  estado: EstadoDoPor
  destino: Personagem | undefined
  podeGravar: boolean
  arrastando: boolean
  destacado: boolean
  onPor: () => void
  /** Fase 3: roda a habilidade no Boneco de treino; `null` = este tipo não se testa (o item entra na Fase 7). */
  onTestar: (() => void) | null
  onEditar: (item: ItemDoCatalogo) => void
  onApagar: (item: ItemDoCatalogo) => void
  onArrastar: (event: DragEvent<HTMLElement>, entrada: EntradaParaFicha) => void
  onSoltar: () => void
}

function CartaoDaEntrada({ entrada, coisa, linhas, resumo, estado, destino, podeGravar, arrastando, destacado, onPor, onTestar, onEditar, onApagar, onArrastar, onSoltar }: CartaoDaEntradaProps) {
  const dados = DADOS_DO_TIPO[entrada.tipo]
  /** A entrada do mestre (editável); `null` = a do livro, só leitura. */
  const doMestre: ItemDoCatalogo | null = ehDoLivro(entrada) ? null : entrada
  const quem = destino === undefined ? '' : primeiroNome(destino.nome)
  const classes = ['mu-cartao', 'mu-item']
  if (arrastando) classes.push('mu-item--arrastando')
  if (destacado) classes.push('mu-item--destacado')

  let acaoDoPor = null
  if (estado === 'pode' && destino !== undefined) {
    acaoDoPor = (
      <button type="button" className="mu-bt mu-bt--p" aria-label={`Pôr ${entrada.nome} em ${destino.nome}`} onClick={onPor}>
        Pôr em {quem}
      </button>
    )
  } else if (estado === 'jaTem' && destino !== undefined) {
    // Fica focável (aria-disabled, não disabled): o foco não cai no corpo da página quando o "Pôr" acaba de virar isto.
    acaoDoPor = (
      <button
        type="button"
        className="mu-bt mu-bt--p mu-item__ja"
        aria-disabled="true"
        aria-label={`${destino.nome} já tem ${entrada.nome}`}
        onClick={() => useToastStore.getState().push('info', `${destino.nome} já tem ${entrada.nome}.`)}
      >
        <IconeDoMundo nome="ok" />
        Já está em {quem}
      </button>
    )
  } else if (estado === 'semAba') {
    acaoDoPor = <span className="mu-item__sem">A ficha não tem a aba {dados.nome}</span>
  }

  return (
    <li>
      <article
        className={classes.join(' ')}
        data-entrada={entrada.id}
        draggable={estado !== 'semFicha'}
        aria-label={`${dados.um}: ${entrada.nome}`}
        onDragStart={(event) => onArrastar(event, entrada)}
        onDragEnd={onSoltar}
      >
        <div className="mu-item__cab">
          {/* Fase 5: a regra ligada a uma coisa do Acervo mostra a foto dela (a coisa é a dona da foto). */}
          {coisa !== undefined && (
            <span className="mu-item__foto" aria-hidden="true">
              <ImagemOuIniciais imagem={coisa.imagem} nome={coisa.nome} />
            </span>
          )}
          <div className="mu-item__titulo">
            <h3 className="mu-item__nome" title={tituloDoNome(entrada.nome)}>
              {entrada.nome}
            </h3>
            <p className="mu-item__tipo">{dados.um}</p>
          </div>
        </div>
        <ul className="mu-item__selos" aria-label="Selos">
          <li className={doMestre === null ? 'mu-item__selo mu-item__selo--livro' : 'mu-item__selo mu-item__selo--catalogo'}>{doMestre === null ? 'Do livro' : 'Do catálogo'}</li>
          {coisa !== undefined && (
            <li className="mu-item__selo mu-item__selo--acervo" title={`Ligada à coisa ${coisa.nome} do Acervo`}>
              Ligada ao acervo
            </li>
          )}
          {doMestre?.mecanica !== undefined && (
            <li className="mu-item__selo mu-item__selo--montada" title={resumo === null ? 'A mecânica guardada não abre neste app: vale à mão' : 'O app faz a conta pelas peças montadas'}>
              {resumo === null ? 'Mecânica à mão' : 'Montada'}
            </li>
          )}
        </ul>
        {entrada.texto.length > 0 && (
          <p className="mu-item__txt" title={entrada.texto}>
            {entrada.texto}
          </p>
        )}
        {/* ARMAS-FONTE-UNICA §6: na arma é o "O que ela faz" (o mesmo do lápis, do Acervo e da ficha). */}
        {entrada.tipo === 'arma' && resumo !== null && resumo.length > 0 && <p className="mu-item__faz">O que ela faz</p>}
        {resumo !== null && resumo.length > 0 && (
          <ul className="mu-item__efeito" aria-label={entrada.tipo === 'arma' ? 'O que ela faz' : 'O que faz'}>
            {resumo.map((frase) => (
              <li key={frase}>{frase}</li>
            ))}
          </ul>
        )}
        {resumo === null && linhas.length > 0 && (
          <p className="mu-item__campos">
            {linhas.map((linha) => (
              <span key={linha.rotulo}>
                {linha.rotulo} <b>{linha.valor}</b>
              </span>
            ))}
          </p>
        )}
        <div className="mu-item__pe">
          {estado !== 'semFicha' && (
            <span className="mu-item__alca" title="Arraste para a ficha" aria-hidden="true">
              <IconeDoMundo nome="alca" />
            </span>
          )}
          <span className="mu-item__acoes">
            {onTestar !== null && (
              <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label={`Testar ${entrada.nome} no boneco`} title="Testar no boneco" onClick={onTestar}>
                <IconeDoMundo nome="testar" />
              </button>
            )}
            {doMestre !== null && podeGravar && (
              <>
                <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label={`Editar ${doMestre.nome}`} title="Editar" onClick={() => onEditar(doMestre)}>
                  <IconeDoMundo nome="nota" />
                </button>
                <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label={`Apagar ${doMestre.nome} do catálogo`} title="Apagar do catálogo" onClick={() => onApagar(doMestre)}>
                  <IconeDoMundo nome="lixo" />
                </button>
              </>
            )}
            {acaoDoPor}
          </span>
        </div>
      </article>
    </li>
  )
}

interface CartaoDoAcervoProps {
  entrada: EntradaDoAcervo
  destino: Personagem | undefined
  /** Quantos desta coisa a ficha escolhida já carrega na mochila (0 = nenhum). */
  naFicha: number
  arrastando: boolean
  onPor: () => void
  onArrastar: (event: DragEvent<HTMLElement>, entrada: EntradaDoAcervo) => void
  onSoltar: () => void
  /** Fase 7: o sistema da página, para a frase do efeito com o nome do atributo. */
  sistema: SistemaDeRpg
  /** Fase 7: o Testar do efeito do item, no painel da página. */
  onTestar: (efeito: EfeitoDoItem) => void
  /** Fase 7: as fichas do mundo, para o "Atualizar as cópias nas mochilas". */
  personagens: readonly Personagem[]
  /** Abre a janela do Acervo deste item (editar, "O que ele faz", apagar). */
  onEditar: () => void
}

/**
 * Fase 7 (SISTEMA.md, migração das mochilas): leva o efeito de agora às vagas
 * já dadas com o mesmo item. A lista de quem muda vem antes do Atualizar.
 */
function AtualizarCopias({ acervo, personagens }: { acervo: CartaoDoAcervoProps['entrada']['acervo']; personagens: readonly Personagem[] }) {
  const [conferindo, setConferindo] = useState(false)
  const [feito, setFeito] = useState<string | null>(null)
  const copias = useMemo(() => copiasParaAtualizar(personagens, acervo), [personagens, acervo])
  if (copias.length === 0) return feito === null ? null : <p className="mu-item__efeito" role="status">{feito}</p>
  const vagas = copias.reduce((soma, copia) => soma + copia.vagas, 0)
  const atualizar = async () => {
    setConferindo(false)
    try {
      await useMundoDoLivroStore.getState().mudar((lista) => lista.map((ficha) => fichaComOEfeitoDoItem(ficha, acervo)))
      setFeito(`${vagas} ${vagas === 1 ? 'cópia atualizada' : 'cópias atualizadas'}.`)
    } catch (erro) {
      setFeito(`Não deu para atualizar: ${erro instanceof Error ? erro.message : String(erro)}`)
    }
  }
  if (!conferindo) {
    return (
      <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => setConferindo(true)}>
        Atualizar as cópias nas mochilas ({vagas})
      </button>
    )
  }
  return (
    <div className="mu-item__copias" role="group" aria-label="Conferir as cópias que mudam">
      <p className="mu-item__efeito">Ganham o efeito de agora: {copias.map((copia) => (copia.vagas > 1 ? `${copia.nome} (${copia.vagas} vagas)` : copia.nome)).join(', ')}.</p>
      <span className="mu-item__acoes">
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => setConferindo(false)}>
          Cancelar
        </button>
        <button type="button" className="mu-bt mu-bt--p" onClick={() => void atualizar()}>
          Atualizar
        </button>
      </span>
    </div>
  )
}

/** A coisa do Acervo: foto, nome, categoria, preço e pilha. O "Editar" abre a janela do Acervo; o "Pôr em" põe na mochila. */
function CartaoDoAcervo({ entrada, destino, naFicha, arrastando, onPor, onArrastar, onSoltar, sistema, onTestar, personagens, onEditar }: CartaoDoAcervoProps) {
  const { acervo } = entrada
  const { efeito } = acervo
  const quem = destino === undefined ? '' : primeiroNome(destino.nome)
  const categoria = acervo.categoria === '' ? 'Item' : acervo.categoria
  const descricao = acervo.descricao.trim()
  const classes = ['mu-cartao', 'mu-item']
  if (arrastando) classes.push('mu-item--arrastando')

  return (
    <li>
      <article
        className={classes.join(' ')}
        data-entrada={entrada.id}
        draggable={destino !== undefined}
        aria-label={`Item do acervo: ${acervo.nome}`}
        onDragStart={(event) => onArrastar(event, entrada)}
        onDragEnd={onSoltar}
      >
        <div className="mu-item__cab">
          <span className="mu-item__foto" aria-hidden="true">
            <ImagemOuIniciais imagem={acervo.imagem} nome={acervo.nome} />
          </span>
          <div className="mu-item__titulo">
            <h3 className="mu-item__nome" title={tituloDoNome(acervo.nome)}>
              {acervo.nome}
            </h3>
            <p className="mu-item__tipo">{categoria}</p>
          </div>
        </div>
        <ul className="mu-item__selos" aria-label="Selos">
          <li className="mu-item__selo mu-item__selo--acervo">Do acervo</li>
        </ul>
        {descricao.length > 0 && (
          <p className="mu-item__txt" title={descricao}>
            {descricao}
          </p>
        )}
        {/* Fase 7: o que o item faz, na mesma frase que a vaga da mochila mostra. */}
        {efeito !== undefined && <p className="mu-item__efeito">{resumoDoEfeitoDoItem(efeito, sistema)}</p>}
        <AtualizarCopias acervo={acervo} personagens={personagens} />
        {(acervo.preco !== null || acervo.empilhavel || naFicha > 0) && (
          <p className="mu-item__campos">
            {acervo.preco !== null && (
              <span>
                Preço <b>{precoEmBerries(acervo.preco)}</b>
              </span>
            )}
            {acervo.empilhavel && <span>Empilhável</span>}
            {naFicha > 0 && (
              <span>
                Com {quem} <b>×{formatarNumero(naFicha)}</b>
              </span>
            )}
          </p>
        )}
        <div className="mu-item__pe">
          {destino !== undefined && (
            <span className="mu-item__alca" title="Arraste para a ficha" aria-hidden="true">
              <IconeDoMundo nome="alca" />
            </span>
          )}
          <span className="mu-item__acoes">
            <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label={`Editar ${acervo.nome}`} title="Editar" onClick={onEditar}>
              <IconeDoMundo nome="nota" />
            </button>
            {efeito !== undefined && (
              <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" aria-label={`Testar ${acervo.nome} no boneco`} onClick={() => onTestar(efeito)}>
                Testar
              </button>
            )}
            {destino !== undefined && (
              <button type="button" className="mu-bt mu-bt--p" aria-label={`Pôr ${acervo.nome} na mochila de ${destino.nome}`} onClick={onPor}>
                Pôr em {quem}
              </button>
            )}
          </span>
        </div>
      </article>
    </li>
  )
}

interface PainelDoDestinoProps {
  grupos: readonly GrupoQueRecebe[]
  destino: Personagem | undefined
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
  secoes: readonly AbaDoSistema[]
  /** A página Itens mostra a mochila (é para onde a coisa do Acervo vai); a Habilidades não. */
  comMochila: boolean
  /** A aba que recebe o cartão arrastado (a seção que acende); `null` sem arrasto. */
  abaDoArrasto: string | null
  /** O arrastado é uma coisa do Acervo: quem acende é a Mochila. */
  mochilaDoArrasto: boolean
  /** O cartão arrastado não entra nesta ficha: a frase do porquê. */
  recusa: string | null
  /** O arrasto está em cima do painel e pode soltar: a seção fica cheia de latão. */
  sobre: boolean
  novos: ReadonlySet<string>
  onEscolher: (personagemId: string) => void
  onPassar: (event: DragEvent<HTMLElement>) => void
  onSair: (event: DragEvent<HTMLElement>) => void
  onSoltar: (event: DragEvent<HTMLElement>) => void
}

function PainelDoDestino({ grupos, destino, personagens, sistema, secoes, comMochila, abaDoArrasto, mochilaDoArrasto, recusa, sobre, novos, onEscolher, onPassar, onSair, onSoltar }: PainelDoDestinoProps) {
  const seletorId = useId()
  const classes = ['mu-cartao', 'mu-destino']
  if ((abaDoArrasto !== null || mochilaDoArrasto) && recusa === null) classes.push('mu-destino--ativo')
  if (sobre) classes.push('mu-destino--sobre')

  if (destino === undefined) {
    return (
      <aside className={classes.join(' ')} aria-label="Ficha que recebe">
        <h3 className="mu-destino__tit">Ficha que recebe</h3>
        <p className="mu-destino__vazio">Nenhuma ficha nesta pasta ainda. Crie um jogador ou um NPC para pôr armas, habilidades e itens nele.</p>
        <div className="mu-pg-acoes">
          <button type="button" className="mu-bt mu-bt--p" onClick={() => useMundoDoLivroStore.getState().trocarAba('jogadores')}>
            Ir para Jogadores
          </button>
          <button type="button" className="mu-bt mu-bt--p" onClick={() => useMundoDoLivroStore.getState().trocarAba('npcs')}>
            Ir para NPCs de combate
          </button>
        </div>
      </aside>
    )
  }

  const quem = primeiroNome(destino.nome)
  const temVariacao = personagens.some(ehVariacao)

  return (
    <aside className={classes.join(' ')} aria-label="Ficha que recebe" onDragEnter={onPassar} onDragOver={onPassar} onDragLeave={onSair} onDrop={onSoltar}>
      <div className="mu-campo">
        <label htmlFor={seletorId}>Ficha que recebe</label>
        <select className="mu-seletor" id={seletorId} value={destino.id} onChange={(event) => onEscolher(event.target.value)}>
          {grupos.map((grupo) => (
            <optgroup key={grupo.rotulo} label={grupo.rotulo}>
              {grupo.fichas.map((personagem) => (
                <option key={personagem.id} value={personagem.id}>
                  {rotuloDaFicha(personagem, personagens)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="mu-destino__quem">
        <Retrato imagem={destino.retrato} nome={destino.nome} tamanho="p" />
        <span className="mu-destino__quem-txt">
          <span className="mu-destino__nome">{destino.nome}</span>
          <span className="mu-destino__sub">{escolhasDaFicha(destino, sistema) || (destino.tipo === 'jogador' ? 'Jogador' : 'NPC')}</span>
        </span>
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => useMundoDoLivroStore.getState().abrirFicha(destino.id)}>
          Abrir a ficha
        </button>
      </div>
      {recusa !== null && (
        <p className="mu-destino__recusa" role="status">
          {recusa}
        </p>
      )}
      <div className="mu-destino__secoes">
        {comMochila && <MochilaDaFicha ficha={destino} quem={quem} aceita={mochilaDoArrasto} novos={novos} />}
        {secoes.map((aba) => {
          const cartoes = cartoesDaAba(destino, aba.id)
          const ultimos = cartoes.slice(-ULTIMOS_NA_SECAO)
          const antes = cartoes.length - ultimos.length
          const limite = aba.id === ABA_DAS_ARMAS ? limiteDeArmas(destino) : null
          return (
            <div key={aba.id} className="mu-destino__secao" data-aceita={abaDoArrasto === aba.id ? 'sim' : undefined}>
              <h4>
                <span>{aba.nome}</span>
                <small>{limite !== null ? `leva ${limite} por batalha` : formatarNumero(cartoes.length)}</small>
              </h4>
              {cartoes.length === 0 ? (
                <p className="mu-destino__vazio">{aba.vazio}</p>
              ) : (
                <ul>
                  {antes > 0 && <li className="mu-destino__mais">Mais {formatarNumero(antes)} na ficha</li>}
                  {ultimos.map((cartao) => (
                    <li key={cartao.id} className={novos.has(`${destino.id}:${cartao.id}`) ? 'mu-destino__novo' : undefined}>
                      <span>{cartao.nome}</span>
                      {aba.id === ABA_DAS_ARMAS && (cartao.campos.dano ?? '').trim() !== '' && <span className="mu-destino__dano">{cartao.campos.dano}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mu-destino__solta">
                Solte para pôr em {aba.nome} de {quem}
              </p>
            </div>
          )
        })}
      </div>
      {temVariacao && <p className="mu-pg-nota">Variações de NPC herdam do modelo: escolha o modelo para dar a todas.</p>}
    </aside>
  )
}

interface MochilaDaFichaProps {
  ficha: Personagem
  quem: string
  /** Uma coisa do Acervo está sendo arrastada: a seção acende e convida a soltar. */
  aceita: boolean
  novos: ReadonlySet<string>
}

/**
 * A MOCHILA da ficha que recebe: o que a ficha carrega (a dona é a ficha, o
 * boneco no mapa só a mostra), com ou sem boneco. As últimas vagas, com a
 * foto e a quantidade; a vaga que acabou de receber fica em latão.
 */
function MochilaDaFicha({ ficha, quem, aceita, novos }: MochilaDaFichaProps) {
  const vagas = ficha.mochila ?? []
  const ultimas = vagas.slice(-ULTIMAS_DA_MOCHILA)
  const antes = vagas.length - ultimas.length
  const total = vagas.reduce((soma, item) => soma + quantidadeDe(item), 0)
  return (
    <div className="mu-destino__secao mu-destino__mochila" data-aceita={aceita ? 'sim' : undefined}>
      <h4>
        <span>Mochila</span>
        <small>{formatarNumero(total)}</small>
      </h4>
      {vagas.length === 0 ? (
        <p className="mu-destino__vazio">Nada na mochila. Ponha um item do acervo.</p>
      ) : (
        <ul>
          {antes > 0 && <li className="mu-destino__mais">Mais {formatarNumero(antes)} na mochila</li>}
          {ultimas.map((item) => {
            const quantidade = quantidadeDe(item)
            return (
              <li key={item.id} className={novos.has(`${ficha.id}:${item.id}`) ? 'mu-destino__novo' : undefined}>
                <span className="mu-destino__foto" aria-hidden="true">
                  <ImagemOuIniciais imagem={item.imagem} nome={item.nome} />
                </span>
                <span className="mu-destino__vaga">{item.nome}</span>
                {quantidade > 1 && <span className="mu-destino__qtd">×{formatarNumero(quantidade)}</span>}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mu-destino__solta">Solte para pôr na mochila de {quem}</p>
    </div>
  )
}
