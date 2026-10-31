import { isTauri } from '@tauri-apps/api/core'
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { ABA_DAS_ARMAS, armasDe, limiteDeArmas } from '../../lib/batalha/leituraDaFicha'
import { ehVariacao, entraNaBatalha, variacoesDe } from '../../lib/livros/combate'
import {
  abaDeDestino,
  buscarNoCatalogo,
  camposDoTipo,
  chaveDoNomeDaEntrada,
  DADOS_DO_TIPO,
  ehDoLivro,
  podeReceber,
  porNaFicha,
  tirarDaFicha,
  TIPOS_DE_ENTRADA,
  type EntradaParaFicha,
  type ItemDoCatalogo,
  type ResultadoDePorNaFicha,
  type TipoDeEntrada,
  type TipoDoCatalogo,
} from '../../lib/livros/catalogo'
import { cartoesDaAba, type CartaoDaFicha, type Personagem } from '../../lib/personagem'
import type { AbaDoSistema, CampoDoCartao, SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useCatalogoStore } from '../../stores/catalogoStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { useToastStore } from '../../stores/toastStore'
import { escolhasDaFicha, formatarNumero, primeiroNome, Retrato, trocarFicha } from './comum'
import { EntradaDoCatalogoDialog, type ModoDaEntrada } from './EntradaDoCatalogoDialog'
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
 */

/** Cartões na tela por vez: um catálogo de 2000 entradas não vira 2000 cartões de uma vez. */
const PASSO_DA_LISTA = 120
/** Quanto tempo a entrada recém-criada fica com o contorno de latão. */
const DESTAQUE_MS = 1600
/** Quantos cartões de cada seção a ficha que recebe mostra (os últimos: é onde o novo entra). */
const ULTIMOS_NA_SECAO = 5

type Filtro = TipoDeEntrada | 'todos'
/** O que o "Pôr em" faz com a entrada e a ficha escolhida. */
type EstadoDoPor = 'pode' | 'jaTem' | 'semAba' | 'semFicha'

const NADA_NO_TIPO: Readonly<Record<TipoDoCatalogo, string>> = {
  arma: 'Nenhuma arma no catálogo ainda.',
  habilidade: 'Nenhuma habilidade no catálogo ainda.',
  item: 'Nenhum item no catálogo ainda.',
}
const NOVA_DO_TIPO: Readonly<Record<TipoDoCatalogo, string>> = { arma: 'Nova arma', habilidade: 'Nova habilidade', item: 'Novo item' }

/** A ficha escolhida em "Ficha que recebe" sobrevive à troca de marcador (estado da sessão, nada em disco). */
let fichaEscolhidaAntes: string | null = null

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

function ehDoCatalogo(tipo: TipoDeEntrada): tipo is TipoDoCatalogo {
  return DADOS_DO_TIPO[tipo].origem === 'catalogo'
}

interface GrupoQueRecebe {
  rotulo: string
  fichas: Personagem[]
}

/** Quem pode receber: jogadores, NPCs de combate (modelos e únicos) e os de cenário. A variação herda do modelo e fica fora. */
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

function fraseDaRecusa(motivo: 'semAba' | 'jaTem' | 'variacao', ficha: Personagem, entrada: EntradaParaFicha): string {
  if (motivo === 'jaTem') return `${ficha.nome} já tem ${entrada.nome}.`
  if (motivo === 'semAba') return `A ficha deste sistema não tem a aba ${DADOS_DO_TIPO[entrada.tipo].nome}.`
  return `${ficha.nome} é variação: ponha no modelo para dar a todas.`
}

/** "Sabre entrou em Armas de Aira. Agora são 2 armas: na batalha Aira escolhe 1." */
function fraseDoPor(entrada: EntradaParaFicha, ficha: Personagem, aba: AbaDoSistema, variacoes: number, resultado: Extract<ResultadoDePorNaFicha, { ok: true }>): string {
  const nas = variacoes === 0 ? '' : variacoes === 1 ? ' e na variação' : ` e nas ${variacoes} variações`
  let frase = `${entrada.nome} entrou em ${aba.nome} de ${ficha.nome}${nas}.`
  const limite = limiteDeArmas(resultado.personagem)
  if (resultado.passaDoLimiteDeArmas && limite !== null) {
    frase += ` Agora são ${armasDe(resultado.personagem).length} armas: na batalha ${primeiroNome(ficha.nome)} escolhe ${limite}.`
  }
  return frase
}

/** O Desfazer do "Pôr": tira o cartão pelo id, nas duas cópias (disco e editor). */
function desfazerPor(fichaId: string, abaId: string, cartaoId: string): void {
  useMundoDoLivroStore
    .getState()
    .mudar((lista) => trocarFicha(lista, fichaId, (atual) => tirarDaFicha(atual, abaId, cartaoId)))
    .then(
      () => useToastStore.getState().push('info', 'Desfeito.'),
      (erro: unknown) => useToastStore.getState().push('error', `Não deu para desfazer: ${mensagemDoErro(erro)}`),
    )
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
}

export function PaginaItens({ personagens, sistema }: PaginaItensProps) {
  const catalogoAberto = useCatalogoStore((state) => state.sistemaId)
  const itens = useCatalogoStore((state) => state.itens)
  const doLivro = useCatalogoStore((state) => state.doLivro)
  const aviso = useCatalogoStore((state) => state.aviso)
  const podeGravar = useCatalogoStore((state) => state.podeGravar)
  const doSistema = catalogoAberto === sistema.id
  const noAplicativo = isTauri()
  // A leitura do disco nunca lança: sem aviso e sem permissão de gravar, no aplicativo, é porque ainda está lendo.
  const lendo = !doSistema || (noAplicativo && !podeGravar && aviso === null)

  const buscaId = useId()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [mostrar, setMostrar] = useState(PASSO_DA_LISTA)
  const [fichaId, setFichaId] = useState<string | null>(fichaEscolhidaAntes)
  const [dialogo, setDialogo] = useState<ModoDaEntrada | null>(null)
  const [juntando, setJuntando] = useState(false)
  const [arrastando, setArrastando] = useState<EntradaParaFicha | null>(null)
  const [sobre, setSobre] = useState(false)
  /** Cartões postos nesta visita (`ficha:cartão`): a seção da ficha os mostra em latão. */
  const [novos, setNovos] = useState<ReadonlySet<string>>(() => new Set())
  const [destacado, setDestacado] = useState<string | null>(null)
  const arrastandoRef = useRef<EntradaParaFicha | null>(null)
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

  const entradas = useMemo<EntradaParaFicha[]>(() => (doSistema ? [...itens, ...doLivro] : []), [doSistema, itens, doLivro])
  // Armas, Habilidades e Itens sempre (o mestre cria); os do livro só quando o livro traz alguma.
  const filtros = useMemo<Filtro[]>(() => ['todos', ...TIPOS_DE_ENTRADA.filter((tipo) => ehDoCatalogo(tipo) || entradas.some((entrada) => entrada.tipo === tipo))], [entradas])
  const filtroAtivo: Filtro = filtros.includes(filtro) ? filtro : 'todos'
  const lista = useMemo(() => buscarNoCatalogo(entradas, busca, filtroAtivo), [entradas, busca, filtroAtivo])

  const abaPorTipo = useMemo(() => new Map(TIPOS_DE_ENTRADA.map((tipo) => [tipo, abaDeDestino(sistema, tipo)] as const)), [sistema])
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
  /** Os nomes que a ficha já tem em cada aba de destino (sem acento, sem caixa): o "Já está em" sem passar pela regra a cada cartão. */
  const nomesNaFicha = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    if (destino !== undefined) for (const aba of secoes) mapa.set(aba.id, new Set(cartoesDaAba(destino, aba.id).map((cartao) => chaveDoNomeDaEntrada(cartao.nome))))
    return mapa
  }, [destino, secoes])

  const estadoDoPor = (entrada: EntradaParaFicha): EstadoDoPor => {
    if (destino === undefined) return 'semFicha'
    const aba = abaPorTipo.get(entrada.tipo)
    if (aba === undefined) return 'semAba'
    return nomesNaFicha.get(aba.id)?.has(chaveDoNomeDaEntrada(entrada.nome)) === true ? 'jaTem' : 'pode'
  }

  const escolherFicha = (id: string) => {
    fichaEscolhidaAntes = id
    setFichaId(id)
  }

  const por = async (entrada: EntradaParaFicha) => {
    const ficha = destino
    if (ficha === undefined) return
    const toasts = useToastStore.getState()
    const resultado = porNaFicha(ficha, entrada, sistema)
    if (!resultado.ok) {
      toasts.push('info', fraseDaRecusa(resultado.motivo, ficha, entrada))
      return
    }
    const aba = abaPorTipo.get(entrada.tipo)
    const cartao = cartoesDaAba(resultado.personagem, resultado.abaId).find((atual) => atual.id === resultado.cartaoId)
    const chave = `${ficha.id}:${entrada.id}`
    if (aba === undefined || cartao === undefined || pondo.current.has(chave)) return
    pondo.current.add(chave)
    const { abaId } = resultado
    try {
      await useMundoDoLivroStore.getState().mudar((lista) => trocarFicha(lista, ficha.id, (atual) => comCartao(atual, abaId, cartao)))
    } catch (erro) {
      toasts.push('error', `Não deu para pôr ${entrada.nome} em ${ficha.nome}: ${mensagemDoErro(erro)}`)
      return
    } finally {
      pondo.current.delete(chave)
    }
    setNovos((atuais) => new Set(atuais).add(`${ficha.id}:${cartao.id}`))
    toasts.push('info', fraseDoPor(entrada, ficha, aba, variacoesDe(ficha.id, personagens).length, resultado), undefined, {
      actions: [{ label: 'Desfazer', run: () => desfazerPor(ficha.id, abaId, cartao.id) }],
    })
  }

  // ---- arrastar o cartão para a ficha ----
  const comecarArrasto = (event: DragEvent<HTMLElement>, entrada: EntradaParaFicha) => {
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
  const trocarFiltro = (novo: Filtro) => {
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
  const tipoSugerido: TipoDoCatalogo = filtroAtivo !== 'todos' && ehDoCatalogo(filtroAtivo) ? filtroAtivo : 'arma'

  const aoSalvar = (item: ItemDoCatalogo, nova: boolean) => {
    useToastStore.getState().push('info', nova ? `${item.nome} entrou no catálogo.` : `${item.nome} foi guardado no catálogo.`)
    if (buscarNoCatalogo([item], busca, filtroAtivo).length === 0) {
      setBusca('')
      setFiltro(item.tipo)
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
      const n = await useCatalogoStore.getState().juntarDasFichas(personagens)
      if (n > 0) toasts.push('info', `${formatarNumero(n)} ${n === 1 ? 'entrada nova veio' : 'entradas novas vieram'} das fichas da pasta.`)
      else if (personagens.length === 0) toasts.push('info', 'A pasta ainda não tem fichas: nada para juntar.')
      else toasts.push('info', 'Nada novo: o catálogo já tem as armas, habilidades e itens das fichas desta pasta.')
    } catch (erro) {
      toasts.push('error', `Não deu para juntar das fichas: ${mensagemDoErro(erro)}`)
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
          {visiveis.map((entrada, indice) => (
            <CartaoDaEntrada
              key={entrada.id}
              entrada={entrada}
              linhas={linhasDaEntrada(entrada, camposPorTipo.get(entrada.tipo) ?? [], nomesDosAtributos)}
              estado={estadoDoPor(entrada)}
              destino={destino}
              podeGravar={podeGravar}
              arrastando={arrastando?.id === entrada.id}
              destacado={destacado === entrada.id}
              onPor={() => void por(entrada)}
              onEditar={(item) => setDialogo({ tipo: 'editar', item })}
              onApagar={(item) => void apagar(item, indice)}
              onArrastar={comecarArrasto}
              onSoltar={terminarArrasto}
            />
          ))}
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
          Nada com “{busca.trim()}”{filtroAtivo === 'todos' ? '' : ` em ${DADOS_DO_TIPO[filtroAtivo].nome}`}. Tente pelo efeito (cura, escudo) ou pelo tipo (arma).
        </p>
        <button type="button" className="mu-bt mu-bt--p" onClick={limparTudo}>
          Limpar a busca
        </button>
      </div>
    )
  } else {
    const tipo = filtroAtivo !== 'todos' && ehDoCatalogo(filtroAtivo) ? filtroAtivo : null
    corpo = (
      <div className="mu-vazio">
        <p>
          {tipo !== null
            ? NADA_NO_TIPO[tipo]
            : 'O catálogo deste livro está vazio. Junte as armas, habilidades e itens que as fichas da pasta já têm, ou crie uma entrada.'}
        </p>
        {podeGravar && (
          <div className="mu-pg-acoes">
            <button type="button" className="mu-bt mu-bt--p" disabled={juntando} onClick={() => void juntar()}>
              {juntando ? 'Juntando…' : 'Juntar das fichas da pasta'}
            </button>
            <button type="button" className="mu-bt mu-bt--p" onClick={() => setDialogo({ tipo: 'nova', tipoDaEntrada: tipo ?? 'arma' })}>
              <IconeDoMundo nome="mais" />
              {tipo !== null ? NOVA_DO_TIPO[tipo] : 'Nova entrada'}
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
          <h2 className="mu-pg-titulo">Itens, armas e habilidades</h2>
          <p className="mu-pg-sub">
            O catálogo do livro. Arraste para a ficha ao lado, ou use “Pôr em”. Perícias, vantagens e desvantagens vêm do livro; armas, habilidades e itens você cria ou junta das
            fichas.
          </p>
        </div>
        <div className="mu-pg-acoes">
          <button type="button" className="mu-bt" disabled={!podeGravar || juntando} onClick={() => void juntar()}>
            {juntando ? 'Juntando…' : 'Juntar das fichas da pasta'}
          </button>
          <button type="button" className="mu-bt mu-bt--primario" disabled={!podeGravar} onClick={() => setDialogo({ tipo: 'nova', tipoDaEntrada: tipoSugerido })}>
            <IconeDoMundo nome="mais" />
            Nova entrada
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
                Buscar no catálogo
              </label>
              <input
                ref={buscaRef}
                id={buscaId}
                className="mu-entrada"
                type="search"
                value={busca}
                placeholder="Buscar por nome ou efeito (ex.: cura, escudo)"
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
              {filtros.map((chave) => (
                <button key={chave} type="button" className="mu-chip mu-chip--sem-ret" aria-pressed={filtroAtivo === chave} onClick={() => trocarFiltro(chave)}>
                  {chave === 'todos' ? 'Tudo' : DADOS_DO_TIPO[chave].nome}
                </button>
              ))}
            </div>
          </div>
          <p className="mu-it-sr" role="status">
            {anuncio}
          </p>
          {corpo}
        </div>

        <PainelDoDestino
          grupos={grupos}
          destino={destino}
          personagens={personagens}
          sistema={sistema}
          secoes={secoes}
          abaDoArrasto={arrastando === null ? null : (abaPorTipo.get(arrastando.tipo)?.id ?? null)}
          recusa={destino !== undefined && arrastando !== null && estadoDoArrasto !== 'pode' ? recusaDoArrasto(estadoDoArrasto, destino, arrastando) : null}
          sobre={sobre && estadoDoArrasto === 'pode'}
          novos={novos}
          onEscolher={escolherFicha}
          onPassar={passarNoDestino}
          onSair={sairDoDestino}
          onSoltar={soltarNoDestino}
        />
      </div>

      {dialogo !== null && <EntradaDoCatalogoDialog modo={dialogo} sistema={sistema} onClose={() => setDialogo(null)} onSalvou={aoSalvar} />}
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
  linhas: readonly LinhaDoCampo[]
  estado: EstadoDoPor
  destino: Personagem | undefined
  podeGravar: boolean
  arrastando: boolean
  destacado: boolean
  onPor: () => void
  onEditar: (item: ItemDoCatalogo) => void
  onApagar: (item: ItemDoCatalogo) => void
  onArrastar: (event: DragEvent<HTMLElement>, entrada: EntradaParaFicha) => void
  onSoltar: () => void
}

function CartaoDaEntrada({ entrada, linhas, estado, destino, podeGravar, arrastando, destacado, onPor, onEditar, onApagar, onArrastar, onSoltar }: CartaoDaEntradaProps) {
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
          <h3 className="mu-item__nome">{entrada.nome}</h3>
          <span className={doMestre === null ? 'mu-etiqueta mu-etiqueta--livro' : 'mu-etiqueta mu-etiqueta--catalogo'}>{doMestre === null ? 'Do livro' : 'Do catálogo'}</span>
        </div>
        <p className="mu-item__txt" title={entrada.texto.length > 0 ? entrada.texto : undefined}>
          {entrada.texto.length === 0 ? dados.um : `${dados.um} · ${entrada.texto}`}
        </p>
        {linhas.length > 0 && (
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

interface PainelDoDestinoProps {
  grupos: readonly GrupoQueRecebe[]
  destino: Personagem | undefined
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
  secoes: readonly AbaDoSistema[]
  /** A aba que recebe o cartão arrastado (a seção que acende); `null` sem arrasto. */
  abaDoArrasto: string | null
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

function PainelDoDestino({ grupos, destino, personagens, sistema, secoes, abaDoArrasto, recusa, sobre, novos, onEscolher, onPassar, onSair, onSoltar }: PainelDoDestinoProps) {
  const seletorId = useId()
  const classes = ['mu-cartao', 'mu-destino']
  if (abaDoArrasto !== null && recusa === null) classes.push('mu-destino--ativo')
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
