import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { categoriaLimpa, idDoItemDaPeca, itemDaPecaDesenhada, novoItemDoCatalogo, pastaDaPecaDePuzzle, type ItemDoCatalogo, type PastaDeItens } from '../lib/acervoDeItens'
import { escolherImagemDoItem, imagemDoItemDoBlob } from '../lib/imagemDoItem'
import { focoDeixaDesfazerGlobal } from '../lib/keymap'
import type { AlvoDoAcervo } from '../lib/party'
import {
  comAbertas,
  comRecolhida,
  contasComAsDeDentro,
  FRASE_DA_RECUSA,
  lugarDoItemNovo,
  NOME_DA_PASTA_MAX,
  nomeDaPastaLimpo,
  novoIdDePasta,
  pastaDoItem,
  pastaMovida,
  PASTAS_MAX,
  pastasAcimaDe,
  pastasPorPai,
  recusaParaMoverAPasta,
  semAPasta,
} from '../lib/pastasDosItens'
import { IDS_DAS_PECAS_DESENHADAS, urlDaPeca } from '../puzzles/arte/pecas'
import { guardarPecaDesenhada } from '../puzzles/arte/rasterizar'
import { PECAS_DESENHADAS } from '../puzzles/padroes'
import { CATEGORIA_DA_PECA_DE_PUZZLE, type IdDaPecaDesenhada } from '../puzzles/tipos'
import { useAcervoDeItensStore } from '../stores/acervoDeItensStore'
import { useToastStore } from '../stores/toastStore'
import { ATRIBUTO_DO_ALVO, TOPO, useArrastoDoAcervoDeItens, type Arrastado, type Avaliacao } from './arrastoDoAcervoDeItens'
import { BotaoMais } from './BotaoMais'
import { lerListaDeIds } from '../lib/cenasFixadas'
import { CampoDeBusca, ehAtalhoDaBusca, itemCasaNaBusca, palavrasDaBusca, textosDeBusca } from './BuscaDoAcervoDeItens'
import { ImagemOuIniciais } from './FichaPecas'
import { ChevronDownIcon, CloseIcon, FolderIcon, ReticenciasIcon } from './icons'
import { ItemDoCatalogoDialog } from './ItemDoCatalogoDialog'
import { IconeDoLivro } from './livro/icones'
import './AcervoDeItensPanel.css'
import './TokenLibraryPanel.css'

/**
 * ACERVO DE ITENS (entrega 4) — a seção "Itens" logo abaixo dos tokens no
 * acervo do mestre. Do APP, como os tokens: o mesmo item serve a todas as
 * aventuras. Tocar um item abre a janela dele (editar e "Dar a…"); "+ Item"
 * cria.
 *
 * PASTAS (pedido de 18/11/2026: "organizar melhor em categorias e
 * subcategorias"; resposta: "Pastas como no Prelúdio"). As categorias de
 * antes viraram as pastas de cima (`lib/pastasDosItens.ts`); pasta dentro de
 * pasta em quantos níveis quiser. Arrastar o item ou a pasta para dentro de
 * outra, ou para "Sem pasta" / o topo; o laço é recusado. Cada pasta fecha e
 * abre, conta os itens de dentro (com os das subpastas) e tem o "⋯": Nova
 * pasta dentro, Novo item aqui, Renomear, Tirar de <mãe>, Apagar. Toda
 * mudança avisa com Desfazer, e o Ctrl+Z com o foco no painel desfaz a última.
 *
 * BUSCA ("Nos dois acervos"): a mesma do acervo de tokens — sem acento nem
 * maiúscula, palavras em qualquer ponto do nome; a pasta com achado abre só
 * na tela, a sem achado sai da vista; "N de M itens" ou "Nada com …".
 *
 * PEÇAS DE PUZZLE (plano dos puzzles, §1.4): o "+ Peça" abre a vitrine das 13
 * peças desenhadas. Tocar numa grava o desenho em PNG na mídia e cria o item,
 * na pasta "Peça de puzzle"; a que já está no acervo leva o selo e abre o item
 * (para "Dar a…"), sem criar outro.
 */

export interface AcervoDeItensPanelProps {
  /** Quem pode receber: tokens ligados a personagem (e os de jogador ainda sem ficha), nas cenas carregadas. */
  alvos: readonly AlvoDoAcervo[]
  /** Dá o item; `false` = não deu (o token saiu da cena). */
  onDar: (item: ItemDoCatalogo, alvo: AlvoDoAcervo, quantidade: number) => boolean
  /** Erro de gravação que a tela não mostra no lugar (o toast do app). */
  onErro?: (mensagem: string) => void
  /**
   * ITEM NO MAPA (entrega 5): o item foi ARRASTADO e solto neste ponto da tela
   * (px de janela). `comoPino` = o Alt estava apertado ao soltar: desde
   * 18/11/2026 a ESTRELA no chão em vez da imagem (o nome do parâmetro é
   * antigo; `formaAoSoltar` decide). Quem monta a tela decide se ali é o mapa e
   * devolve `true` quando pôs. Ausente = o item não vai ao mapa.
   */
  onSoltarNoMapa?: (item: ItemDoCatalogo, clientX: number, clientY: number, comoPino: boolean) => boolean
  /** O "+" do cartão: o item no chão, no centro da vista, como o soltar sem Alt. Ausente = sem "+". */
  onPorNoCentro?: (item: ItemDoCatalogo) => void
}

/** O que a linha de ajuda diz: o gesto e o modificador, que de outro jeito ninguém descobre. */
export const DICA_DO_ARRASTO = 'Arraste um item até o mapa para pô-lo no chão; com Alt, vira estrela brilhando.'
export const DICA_DAS_PASTAS = 'Arraste itens e pastas para dentro de outra pasta.'

export const ITENS_VAZIO = 'Nenhum item no acervo ainda.'
export const ITENS_COMO_ENCHER = 'Crie um item para dar aos personagens.'
export const ITENS_SO_NO_APP = 'O acervo de itens mora no aplicativo instalado.'
const SEM_CATEGORIA = 'Sem categoria'
const SEM_PASTA = 'Sem pasta'

/** Os itens por categoria, na ordem da lista do acervo; categoria fora da lista vem depois, e sem categoria por último (a página Itens do livro ainda ordena assim). */
export function itensPorCategoria(itens: readonly ItemDoCatalogo[], categorias: readonly string[]): { categoria: string; itens: ItemDoCatalogo[] }[] {
  const grupos = new Map<string, ItemDoCatalogo[]>()
  for (const item of itens) {
    const chave = item.categoria === '' ? SEM_CATEGORIA : item.categoria
    grupos.set(chave, [...(grupos.get(chave) ?? []), item])
  }
  const ordem = [...categorias.filter((categoria) => grupos.has(categoria)), ...[...grupos.keys()].filter((chave) => chave !== SEM_CATEGORIA && !categorias.includes(chave))]
  if (grupos.has(SEM_CATEGORIA)) ordem.push(SEM_CATEGORIA)
  return ordem.map((categoria) => ({ categoria, itens: grupos.get(categoria) ?? [] }))
}

/** O que soltar ali faz: pode (acende), já está (nada) ou não cabe (o porquê). */
export function avaliarOSoltar(pastas: readonly PastaDeItens[], quem: Arrastado, destino: string | null): Avaliacao {
  const nome = destino === null ? null : (pastas.find((pasta) => pasta.id === destino)?.nome ?? 'a pasta')
  if (quem.tipo === 'item') {
    const ondeMora = pastaDoItem(quem.item, new Set(pastas.map((pasta) => pasta.id)))
    if (ondeMora === destino) return { t: 'ja-esta', texto: nome === null ? 'Já está sem pasta' : `Já está em ${nome}` }
    return { t: 'pode', texto: nome === null ? 'Tirar da pasta' : `Soltar em ${nome}` }
  }
  const recusa = recusaParaMoverAPasta(pastas, quem.pasta.id, destino)
  if (recusa === null) return { t: 'pode', texto: nome === null ? 'Levar para o topo' : `Soltar em ${nome}` }
  // Em cima dela mesma (o começo de todo arrasto) não é "não cabe": só não muda nada.
  if (recusa === 'ela-mesma') return { t: 'ja-esta', texto: '' }
  if (recusa === 'ja-esta') return { t: 'ja-esta', texto: nome === null ? 'Já está no topo' : `Já está em ${nome}` }
  return { t: 'recusa', texto: FRASE_DA_RECUSA[recusa] }
}

/**
 * O DESFAZER DE UMA MUDANÇA SÓ (18/11/2026, análise Fable: o Desfazer
 * devolvia a árvore inteira de antes e apagava a pasta criada depois por
 * outro caminho, como a pasta nova do item novo). Volta só o que ESTA
 * mudança mexeu, sobre a árvore de agora: a pasta que ela criou sai (o que
 * caiu nela depois sobe um nível, como no Apagar); a que ela apagou volta (a
 * mãe que não existe mais vira o topo); o nome e a mãe que ela trocou voltam,
 * se ninguém trocou de novo e não fizer laço; o item que ela levou volta, se
 * ainda está onde ela o pôs. Abrir e fechar ficam como o mestre deixou.
 */
export function desfazerSoAMudanca(
  antes: readonly PastaDeItens[],
  depois: readonly PastaDeItens[],
  agora: readonly PastaDeItens[],
  itensAgora: readonly Pick<ItemDoCatalogo, 'id' | 'pasta'>[],
  levados: ReadonlyMap<string, string | undefined> | undefined,
  ondeMoravam: ReadonlyMap<string, string | undefined>,
): { pastas: PastaDeItens[]; ondeMoram: Map<string, string | undefined> } {
  const porIdAntes = new Map(antes.map((pasta) => [pasta.id, pasta]))
  const porIdDepois = new Map(depois.map((pasta) => [pasta.id, pasta]))
  let pastas = [...agora]
  const existe = (id: string | undefined) => id !== undefined && pastas.some((pasta) => pasta.id === id)
  // A que a mudança apagou volta, no topo se a mãe dela também sumiu.
  for (const apagada of antes) {
    if (porIdDepois.has(apagada.id) || existe(apagada.id)) continue
    const { paiId, ...semMae } = apagada
    pastas.push(paiId !== undefined && existe(paiId) ? apagada : semMae)
  }
  // O nome e a mãe que ela trocou voltam, se continuam como ela deixou.
  for (const depoisDela of depois) {
    const antesDela = porIdAntes.get(depoisDela.id)
    if (antesDela === undefined) continue
    if (antesDela.nome !== depoisDela.nome) {
      pastas = pastas.map((pasta) => (pasta.id === depoisDela.id && pasta.nome === depoisDela.nome ? { ...pasta, nome: antesDela.nome } : pasta))
    }
    const maeMudou = antesDela.paiId !== depoisDela.paiId
    const atual = pastas.find((pasta) => pasta.id === depoisDela.id)
    if (!maeMudou || atual === undefined || atual.paiId !== depoisDela.paiId) continue
    const destino = antesDela.paiId !== undefined && existe(antesDela.paiId) ? antesDela.paiId : null
    if (recusaParaMoverAPasta(pastas, atual.id, destino) === null) pastas = pastaMovida(pastas, atual.id, destino)
  }
  // O item que ela levou volta, se ainda está onde ela o pôs.
  const ondeMoram = new Map<string, string | undefined>()
  const pastaDeAgora = new Map(itensAgora.map((item) => [item.id, item.pasta]))
  for (const [id, destino] of levados ?? []) {
    if (!pastaDeAgora.has(id) || pastaDeAgora.get(id) !== destino) continue
    const deAntes = ondeMoravam.get(id)
    ondeMoram.set(id, existe(deAntes) ? deAntes : undefined)
  }
  // A que ela criou sai por último: o que caiu nela depois (item ou pasta) sobe um nível.
  for (const criada of depois) {
    if (porIdAntes.has(criada.id) || !existe(criada.id)) continue
    const itensJa = itensAgora.map((item) => (ondeMoram.has(item.id) ? { id: item.id, pasta: ondeMoram.get(item.id) } : item))
    const sem = semAPasta(pastas, itensJa, criada.id)
    pastas = sem.pastas
    for (const [id, pasta] of sem.ondeMoram) ondeMoram.set(id, pasta)
  }
  return { pastas, ondeMoram }
}

/** A ordem dos itens dentro de cada pasta. `guardada` = a do cadastro, a de sempre. */
export type OrdemDoAcervo = 'guardada' | 'nome' | 'preco' | 'categoria'

const ORDENS: readonly OrdemDoAcervo[] = ['guardada', 'nome', 'preco', 'categoria']

const ROTULO_DA_ORDEM: Readonly<Record<OrdemDoAcervo, string>> = {
  guardada: 'Como cadastrei',
  nome: 'Nome (A–Z)',
  preco: 'Preço (menor primeiro)',
  categoria: 'Categoria',
}

const ORDEM_DOS_NOMES = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

/** Os itens na ordem pedida; empate fica na ordem do cadastro. Sem preço vai para o fim. */
export function itensNaOrdem<T extends Pick<ItemDoCatalogo, 'nome' | 'preco' | 'categoria'>>(itens: readonly T[], ordem: OrdemDoAcervo): T[] {
  if (ordem === 'guardada') return [...itens]
  const comparar = (a: T, b: T): number => {
    if (ordem === 'preco') {
      if (a.preco === b.preco) return ORDEM_DOS_NOMES.compare(a.nome, b.nome)
      if (a.preco === null) return 1
      if (b.preco === null) return -1
      return a.preco - b.preco
    }
    if (ordem === 'categoria') {
      const porCategoria = a.categoria === b.categoria ? 0 : a.categoria === '' ? 1 : b.categoria === '' ? -1 : ORDEM_DOS_NOMES.compare(a.categoria, b.categoria)
      if (porCategoria !== 0) return porCategoria
    }
    return ORDEM_DOS_NOMES.compare(a.nome, b.nome)
  }
  return [...itens].sort(comparar)
}

/** Quantos itens a fileira "Recentes" mostra. */
export const RECENTES_DO_ACERVO_MAX = 8
const CHAVE_DOS_RECENTES = 'labirinto.acervoDeItens.recentes'
const CHAVE_DA_ORDEM = 'labirinto.acervoDeItens.ordem'

/** Conveniência deste computador (localStorage): sem ele (janela privada, prévia), a fileira só não aparece. */
function lerDoNavegador(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave)
  } catch {
    return null
  }
}

function gravarNoNavegador(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(chave, valor)
  } catch {
    // Sem armazenamento: a ordem e os recentes valem só nesta visita.
  }
}

function ehOrdem(valor: string | null): valor is OrdemDoAcervo {
  return valor === 'guardada' || valor === 'nome' || valor === 'preco' || valor === 'categoria'
}

/** O item usado agora vai para a frente dos recentes, sem repetir, no teto. */
export function comORecente(recentes: readonly string[], id: string): string[] {
  return [id, ...recentes.filter((outro) => outro !== id)].slice(0, RECENTES_DO_ACERVO_MAX)
}

/** Pastas que o mestre fechou durante uma busca, e o termo em que fechou. */
interface FechadasNaBusca {
  termo: string
  ids: ReadonlySet<string>
}

const NENHUMA_FECHADA: FechadasNaBusca = { termo: '', ids: new Set() }

/** O campo de nome aberto: a pasta nova (dentro de `paiId`, ou em cima) ou o nome novo de uma pasta. */
type Formulario = { readonly tipo: 'nova'; readonly paiId: string | null } | { readonly tipo: 'renomear'; readonly id: string }

function ehCtrlZ(event: ReactKeyboardEvent<HTMLElement>): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z'
}

export function AcervoDeItensPanel({ alvos, onDar, onErro, onSoltarNoMapa, onPorNoCentro }: AcervoDeItensPanelProps) {
  const tituloId = useId()
  const idBase = useId()
  const raizRef = useRef<HTMLElement | null>(null)
  const buscaRef = useRef<HTMLInputElement | null>(null)
  const itens = useAcervoDeItensStore((state) => state.itens)
  const categorias = useAcervoDeItensStore((state) => state.categorias)
  const pastas = useAcervoDeItensStore((state) => state.pastas)
  const aviso = useAcervoDeItensStore((state) => state.aviso)
  const podeGravar = useAcervoDeItensStore((state) => state.podeGravar)
  /** O item aberto: o id de um gravado, ou o novo ainda fora do acervo. */
  const [aberto, setAberto] = useState<{ id: string } | { novo: ItemDoCatalogo } | null>(null)
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  /** A pasta com o "⋯" aberto. */
  const [menu, setMenu] = useState<string | null>(null)
  /** A busca que a LISTA segue; vazio = o acervo inteiro. O texto do campo mora em `CampoDeBusca` e chega aqui numa transição. */
  const [busca, setBusca] = useState('')
  const [fechadasNaBusca, setFechadasNaBusca] = useState<FechadasNaBusca>(NENHUMA_FECHADA)
  /** O Desfazer da última mudança das pastas: vale uma vez, pelo aviso ou pelo Ctrl+Z. */
  const desfazerRef = useRef<{ desfazer: () => void } | null>(null)
  /** ORDENAR (18/11/2026): a ordem dos itens em cada pasta; lembrada neste computador. */
  const [ordem, setOrdem] = useState<OrdemDoAcervo>(() => {
    const guardada = lerDoNavegador(CHAVE_DA_ORDEM)
    return ehOrdem(guardada) ? guardada : 'guardada'
  })
  /** RECENTES (18/11/2026): os itens dados, postos no mapa ou salvos por último, deste computador. */
  const [recentes, setRecentes] = useState<string[]>(() => lerListaDeIds(lerDoNavegador(CHAVE_DOS_RECENTES)).slice(0, RECENTES_DO_ACERVO_MAX))
  /** PEÇAS DE PUZZLE: a vitrine das peças desenhadas aberta. */
  const [pecasAbertas, setPecasAbertas] = useState(false)
  /** A peça sendo desenhada e gravada agora: o segundo toque no meio não grava de novo. */
  const pondoRef = useRef<IdDaPecaDesenhada | null>(null)
  const [pondo, setPondo] = useState<IdDaPecaDesenhada | null>(null)
  const botaoDasPecasRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    void useAcervoDeItensStore.getState().recarregar()
  }, [])

  const trocarOrdem = (nova: OrdemDoAcervo) => {
    setOrdem(nova)
    gravarNoNavegador(CHAVE_DA_ORDEM, nova)
  }

  const usou = (id: string) => {
    setRecentes((antes) => {
      const proximos = comORecente(antes, id)
      gravarNoNavegador(CHAVE_DOS_RECENTES, JSON.stringify(proximos))
      return proximos
    })
  }

  const avisarErro = (erro: unknown) => onErro?.(erro instanceof Error ? erro.message : String(erro))
  const porId = new Map(pastas.map((pasta) => [pasta.id, pasta]))
  const ids = new Set(porId.keys())
  const nomeDaPasta = (id: string) => porId.get(id)?.nome ?? 'a pasta'

  /** Põe o foco na linha da pasta (ou no "⋯" dela) depois do próximo desenho; sem a pasta, no "+ Pasta". */
  const focarPasta = (id: string | null, onde: 'linha' | 'menu' = 'linha') => {
    requestAnimationFrame(() => {
      const raiz = raizRef.current
      if (raiz === null) return
      const topo = id === null ? null : raiz.querySelector<HTMLElement>(`[data-pasta-id="${id}"] > .lb-acervo__pasta-topo`)
      const linha = topo === null || onde === 'menu' ? null : topo.querySelector<HTMLElement>('button.lb-acervo__pasta-botao')
      const alvo = topo === null ? raiz.querySelector<HTMLElement>('.lb-acervo__acoes-topo button') : (linha ?? topo.querySelector<HTMLElement>('.lb-acervo__mover'))
      alvo?.focus()
    })
  }

  /**
   * Toda mudança da árvore passa por aqui: grava, avisa com Desfazer e guarda
   * o Desfazer para o Ctrl+Z. O Desfazer volta só o que esta mudança mexeu
   * (`desfazerSoAMudanca`), sobre a árvore de agora: a pasta criada depois por
   * outro caminho fica, e o abrir e fechar ficam como o mestre deixou.
   */
  const mudar = (texto: string, proximas: readonly PastaDeItens[], ondeMoram?: ReadonlyMap<string, string | undefined>) => {
    const loja = useAcervoDeItensStore.getState()
    const pastasAntes = loja.pastas
    const ondeMoravam = new Map(loja.itens.map((item) => [item.id, item.pasta]))
    loja.organizar(proximas, ondeMoram).then(() => {
      let idDoAviso = ''
      const umaVez = () => {
        if (desfazerRef.current?.desfazer !== umaVez) return
        desfazerRef.current = null
        useToastStore.getState().dismiss(idDoAviso)
        const agora = useAcervoDeItensStore.getState()
        const volta = desfazerSoAMudanca(pastasAntes, proximas, agora.pastas, agora.itens, ondeMoram, ondeMoravam)
        agora.organizar(volta.pastas, volta.ondeMoram).catch(avisarErro)
      }
      desfazerRef.current = { desfazer: umaVez }
      idDoAviso = useToastStore.getState().push('info', texto, undefined, { actions: [{ label: 'Desfazer', run: umaVez }] })
    }, avisarErro)
  }

  /** Abrir e fechar não tem Desfazer: é só vista (mas fica gravado, como no acervo de tokens). */
  const recolher = (id: string, recolhida: boolean) => {
    const loja = useAcervoDeItensStore.getState()
    loja.organizar(comRecolhida(loja.pastas, id, recolhida)).catch(avisarErro)
  }

  const soltarNaPasta = (quem: Arrastado, destino: string | null) => {
    const atuais = useAcervoDeItensStore.getState().pastas
    // A pasta que recebeu abre (e as de cima dela): o que caiu ali fica à vista.
    const abertas = (lista: PastaDeItens[]) => (destino === null ? lista : comAbertas(lista, destino))
    if (quem.tipo === 'item') {
      const texto = destino === null ? `“${quem.item.nome}” saiu da pasta.` : `“${quem.item.nome}” foi para ${nomeDaPasta(destino)}.`
      mudar(texto, abertas([...atuais]), new Map([[quem.item.id, destino ?? undefined]]))
      return
    }
    const texto = destino === null ? `Pasta ${quem.pasta.nome} foi para o topo.` : `Pasta ${quem.pasta.nome} foi para dentro de ${nomeDaPasta(destino)}.`
    mudar(texto, abertas(pastaMovida(atuais, quem.pasta.id, destino)))
  }

  // O item posto no mapa entra nos recentes.
  const soltarNoMapa =
    onSoltarNoMapa === undefined
      ? undefined
      : (item: ItemDoCatalogo, clientX: number, clientY: number, comoPino: boolean) => {
          const pos = onSoltarNoMapa(item, clientX, clientY, comoPino)
          if (pos) usou(item.id)
          return pos
        }

  const arrasto = useArrastoDoAcervoDeItens({
    raiz: raizRef,
    podeOrganizar: podeGravar,
    soltarNoMapa,
    avaliar: (quem, destino) => avaliarOSoltar(pastas, quem, destino),
    soltarNaPasta,
    abrirAoParar: (id) => recolher(id, false),
  })

  const abrirFormulario = (qual: Formulario) => {
    setMenu(null)
    setFormulario(qual)
  }

  const fecharFormulario = (foco: string | null) => {
    setFormulario(null)
    focarPasta(foco)
  }

  const criarPasta = (nome: string, paiId: string | null) => {
    const loja = useAcervoDeItensStore.getState()
    if (loja.pastas.length >= PASTAS_MAX) {
      onErro?.(`O acervo de itens já tem ${PASTAS_MAX} pastas, o máximo.`)
      return
    }
    const nova: PastaDeItens = paiId === null ? { id: novoIdDePasta(), nome } : { id: novoIdDePasta(), nome, paiId }
    const proximas = paiId === null ? [...loja.pastas, nova] : comAbertas([...loja.pastas, nova], paiId)
    setFormulario(null)
    mudar(paiId === null ? `Pasta ${nome} criada.` : `Pasta ${nome} criada dentro de ${nomeDaPasta(paiId)}.`, proximas)
    focarPasta(nova.id)
  }

  const renomear = (id: string, nome: string) => {
    const antigo = nomeDaPasta(id)
    setFormulario(null)
    focarPasta(id)
    if (nome === antigo) return
    const loja = useAcervoDeItensStore.getState()
    mudar(`Pasta ${antigo} agora se chama ${nome}.`, loja.pastas.map((pasta) => (pasta.id === id ? { ...pasta, nome } : pasta)))
  }

  /** Um nível para cima: sai da mãe e vai para a pasta da mãe (ou para o topo). */
  const tirarDaMae = (pasta: PastaDeItens) => {
    const loja = useAcervoDeItensStore.getState()
    const acima = pastasAcimaDe(loja.pastas, pasta.id)
    const mae = acima.at(-1)
    if (mae === undefined) return
    setMenu(null)
    mudar(`Pasta ${pasta.nome} saiu de ${mae.nome}.`, pastaMovida(loja.pastas, pasta.id, acima.at(-2)?.id ?? null))
    focarPasta(pasta.id)
  }

  /** Sem pergunta: o que estava dentro sobe um nível, nada se perde, e o aviso tem Desfazer. */
  const apagarPasta = (pasta: PastaDeItens) => {
    const loja = useAcervoDeItensStore.getState()
    const mae = pastasAcimaDe(loja.pastas, pasta.id).at(-1)
    const { pastas: restantes, ondeMoram } = semAPasta(loja.pastas, loja.itens, pasta.id)
    const quantos = ondeMoram.size
    const para = mae === undefined ? SEM_PASTA : mae.nome
    const texto = quantos === 0 ? `Pasta ${pasta.nome} apagada.` : `Pasta ${pasta.nome} apagada; ${quantos === 1 ? 'o item foi' : `os ${quantos} itens foram`} para ${para}.`
    setMenu(null)
    mudar(texto, restantes, ondeMoram)
    focarPasta(mae?.id ?? null)
  }

  /** O item novo já nasce na pasta, com a categoria da pasta de cima dela (a mochila mostra a categoria). */
  const novoItemAqui = (pasta: PastaDeItens) => {
    const deCima = pastasAcimaDe(pastas, pasta.id).at(0) ?? pasta
    setMenu(null)
    setAberto({ novo: { ...novoItemDoCatalogo(categoriaLimpa(deCima.nome)), pasta: pasta.id } })
  }

  const salvarDoDialogo = async (item: ItemDoCatalogo, novo: boolean): Promise<void> => {
    const loja = useAcervoDeItensStore.getState()
    if (!novo) await loja.salvarItem(item)
    else {
      const lugar = lugarDoItemNovo(loja.pastas, item)
      await loja.salvarItem(lugar.item, lugar.pastas)
    }
    usou(item.id)
  }

  /** Abre a vitrine com o foco na primeira peça; fecha com o foco de volta no "+ Peça". */
  const alternarPecas = (abrir: boolean) => {
    setPecasAbertas(abrir)
    requestAnimationFrame(() => {
      if (!abrir) botaoDasPecasRef.current?.focus()
      else raizRef.current?.querySelector<HTMLButtonElement>('.lb-itens__peca')?.focus()
    })
  }

  /**
   * A peça desenhada vira item: o PNG vai para a mídia, o item para a pasta das
   * peças (que abre, para o item ficar à vista), e o aviso tem o "Abrir". A que
   * já está no acervo só abre o item.
   */
  const porPecaNoAcervo = async (peca: IdDaPecaDesenhada) => {
    const jaNoAcervo = useAcervoDeItensStore.getState().itens.find((item) => item.id === idDoItemDaPeca(peca))
    if (jaNoAcervo !== undefined) {
      setAberto({ id: jaNoAcervo.id })
      return
    }
    if (pondoRef.current !== null) return
    pondoRef.current = peca
    setPondo(peca)
    try {
      const imagem = await guardarPecaDesenhada(peca)
      const loja = useAcervoDeItensStore.getState()
      const lugar = itemDaPecaDesenhada(peca, imagem, loja.pastas)
      const pasta = lugar.item.pasta
      await loja.salvarItem(lugar.item, pasta === undefined ? lugar.pastas : comAbertas(lugar.pastas, pasta))
      usou(lugar.item.id)
      const onde = pasta === undefined ? SEM_PASTA : (lugar.pastas.find((outra) => outra.id === pasta)?.nome ?? CATEGORIA_DA_PECA_DE_PUZZLE)
      useToastStore.getState().push('info', `“${lugar.item.nome}” entrou no acervo, em ${onde}.`, undefined, { actions: [{ label: 'Abrir', run: () => setAberto({ id: lugar.item.id }) }] })
    } catch (erro) {
      avisarErro(erro)
    } finally {
      pondoRef.current = null
      setPondo(null)
    }
  }

  /** Põe o cursor na busca com o texto selecionado: digitar substitui, a seta mantém. */
  const focarBusca = () => {
    const campo = buscaRef.current
    if (campo === null) return
    campo.focus()
    campo.select()
  }

  const teclaNoPainel = (event: ReactKeyboardEvent<HTMLElement>) => {
    // A janela do item mora num portal: a tecla dela sobe até aqui pelo React, mas não é do painel.
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return
    if (buscaRef.current !== null && ehAtalhoDaBusca(event)) {
      // O Ctrl+F não abre a busca da página, e o "/" não vira texto em lugar nenhum.
      event.preventDefault()
      event.stopPropagation()
      focarBusca()
      return
    }
    const desfazer = desfazerRef.current
    if (desfazer === null || !ehCtrlZ(event)) return
    // Num campo de texto o Ctrl+Z é do campo; fora dele, e só com algo a desfazer aqui, não chega ao mapa.
    const alvo = event.target
    if (alvo instanceof HTMLElement && !focoDeixaDesfazerGlobal(alvo.tagName, alvo instanceof HTMLInputElement ? alvo.type : undefined, alvo.isContentEditable)) return
    event.preventDefault()
    event.stopPropagation()
    desfazer.desfazer()
  }

  /** A seta da busca desce para o primeiro achado. */
  const descerParaOPrimeiro = (): boolean => {
    const primeiro = raizRef.current === null ? null : raizRef.current.querySelector<HTMLButtonElement>('.lb-itens__item')
    if (primeiro === null) return false
    primeiro.focus()
    return true
  }

  // A busca única do Acervo: nome, categoria, descrição e o caminho da pasta (montado uma vez por mudança do acervo).
  const textos = useMemo(() => textosDeBusca(itens, pastas), [itens, pastas])
  // Acervo sem item não tem busca (o campo sai e leva o texto junto).
  const vazio = itens.length === 0
  if (vazio && busca !== '') setBusca('')
  const palavras = palavrasDaBusca(busca)
  const buscando = palavras.length > 0
  /** Chave de `fechadasNaBusca`: o termo como a busca o entende. */
  const termo = palavras.join(' ')
  const visiveis = itensNaOrdem(buscando ? itens.filter((item) => itemCasaNaBusca(textos.get(item.id), palavras)) : itens, ordem)
  const existentes = new Map(itens.map((item) => [item.id, item]))
  const usadosPorUltimo = buscando ? [] : recentes.flatMap((id) => existentes.get(id) ?? [])
  const nadaAchado = buscando && visiveis.length === 0
  const resultado = !buscando ? '' : nadaAchado ? `Nada com “${busca.trim()}”.` : `${visiveis.length} de ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}`
  const porPai = pastasPorPai(pastas)
  const itensPorPasta = new Map<string | null, ItemDoCatalogo[]>()
  for (const item of visiveis) {
    const onde = pastaDoItem(item, ids)
    const lista = itensPorPasta.get(onde)
    if (lista === undefined) itensPorPasta.set(onde, [item])
    else lista.push(item)
  }
  /** Os itens mostrados em cada pasta, com os das de dentro: na busca, os achados. */
  const contas = contasComAsDeDentro(
    pastas,
    visiveis.map((item) => pastaDoItem(item, ids)),
  )

  /** Fecha ou reabre a pasta só na busca deste termo; o `recolhida` gravado fica como estava. */
  const alternarNaBusca = (id: string) => {
    setFechadasNaBusca((antes) => {
      const fechadas = new Set(antes.termo === termo ? antes.ids : [])
      if (fechadas.has(id)) fechadas.delete(id)
      else fechadas.add(id)
      return { termo, ids: fechadas }
    })
  }

  const cartao = (item: ItemDoCatalogo) => (
    <li key={item.id} className="lb-itens__celula">
      <button
        type="button"
        className="lb-itens__item"
        aria-label={`Abrir ${item.nome}`}
        title={item.nome}
        onPointerDown={(event) => arrasto.comecar(event, { tipo: 'item', item })}
        // A foto do item é <img>: sem isto o navegador arrasta a imagem
        // dele, solta um `pointercancel` e o nosso arrasto morre no caminho.
        onDragStart={(event) => event.preventDefault()}
        onClick={() => {
          // Acabou de soltar no mapa ou numa pasta: o clique do mesmo gesto não abre a janela.
          if (arrasto.engolirClique()) return
          setAberto({ id: item.id })
        }}
      >
        <span className="lb-itens__foto">
          <ImagemOuIniciais imagem={item.imagem} nome={item.nome} />
        </span>
        <span className="lb-itens__nome">{item.nome}</span>
      </button>
      {onPorNoCentro !== undefined && (
        // No Tab, ao contrário do "+" do token: o cartão abre a janela, e sem este botão o teclado não põe o item no mapa.
        <button type="button" className="lb-itens__por" aria-label={`Pôr ${item.nome} no centro do mapa`} title="Pôr no centro da vista"
          onClick={() => {
            onPorNoCentro(item)
            usou(item.id)
          }}
        >
          <IconeDoLivro nome="mais" />
        </button>
      )}
    </li>
  )

  const formularioDaPasta = (paiId: string | null) =>
    formulario?.tipo === 'nova' && formulario.paiId === paiId && podeGravar ? (
      <FormDaPasta
        inicial=""
        rotulo={paiId === null ? 'Nome da nova pasta' : `Nome da nova pasta dentro de ${nomeDaPasta(paiId)}`}
        acao="Criar"
        onPronto={(nome) => criarPasta(nome, paiId)}
        onCancelar={() => fecharFormulario(paiId)}
      />
    ) : null

  const vitrineDasPecas = () => {
    const idDoTitulo = `${idBase}-pecas`
    const pastaDasPecas = pastaDaPecaDePuzzle(pastas)
    const idsNoAcervo = new Set(itens.map((item) => item.id))
    return (
      <div
        className="lb-itens__pecas"
        role="group"
        aria-labelledby={idDoTitulo}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          // Fecha a vitrine e volta ao "+ Peça"; não chega ao mapa.
          event.preventDefault()
          event.stopPropagation()
          alternarPecas(false)
        }}
      >
        <div className="lb-itens__pecas-topo">
          <p id={idDoTitulo} className="lb-acervo__pasta-titulo">
            Peças de puzzle desenhadas
          </p>
          <button type="button" className="lb-acervo__mover" aria-label="Fechar as peças desenhadas" title="Fechar (Esc)" onClick={() => alternarPecas(false)}>
            <CloseIcon size={14} />
          </button>
        </div>
        <p className="lb-label lb-itens__dica">Toque numa peça para pô-la no acervo, na pasta {pastaDasPecas?.nome ?? CATEGORIA_DA_PECA_DE_PUZZLE}.</p>
        <ul className="lb-itens__grade">
          {IDS_DAS_PECAS_DESENHADAS.map((peca) => {
            const { nome } = PECAS_DESENHADAS[peca]
            const noAcervo = idsNoAcervo.has(idDoItemDaPeca(peca))
            return (
              <li key={peca} className="lb-itens__celula">
                <button
                  type="button"
                  className="lb-itens__item lb-itens__peca"
                  aria-label={noAcervo ? `Abrir ${nome}, já no acervo` : `Pôr ${nome} no acervo`}
                  title={noAcervo ? `${nome}: já está no acervo` : nome}
                  aria-busy={pondo === peca}
                  data-no-acervo={noAcervo ? '' : undefined}
                  onClick={() => void porPecaNoAcervo(peca)}
                >
                  <span className="lb-itens__foto">
                    <img src={urlDaPeca(peca)} alt="" draggable={false} />
                  </span>
                  <span className="lb-itens__nome">{nome}</span>
                  {noAcervo && (
                    <span className="lb-itens__peca-selo" aria-hidden="true">
                      <svg viewBox="0 0 12 12" width="10" height="10" focusable="false">
                        <path d="M2.5 6.2 5 8.6l4.5-5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const menuDaPasta = (pasta: PastaDeItens) => {
    const mae = pastasAcimaDe(pastas, pasta.id).at(-1)
    return (
      <div
        className="lb-itens__menu"
        role="group"
        aria-label={`Ações da pasta ${pasta.nome}`}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          // Fecha o menu e volta ao "⋯"; não chega ao mapa (lá o Esc larga a seleção).
          event.preventDefault()
          event.stopPropagation()
          setMenu(null)
          focarPasta(pasta.id, 'menu')
        }}
      >
        <button type="button" className="lb-itens__menu-acao" autoFocus onClick={() => abrirFormulario({ tipo: 'nova', paiId: pasta.id })}>
          Nova pasta dentro
        </button>
        <button type="button" className="lb-itens__menu-acao" onClick={() => novoItemAqui(pasta)}>
          Novo item aqui
        </button>
        <button type="button" className="lb-itens__menu-acao" onClick={() => abrirFormulario({ tipo: 'renomear', id: pasta.id })}>
          Renomear
        </button>
        {mae !== undefined && (
          <button type="button" className="lb-itens__menu-acao" onClick={() => tirarDaMae(pasta)}>
            Tirar de {mae.nome}
          </button>
        )}
        <button type="button" className="lb-itens__menu-acao lb-itens__menu-acao--perigo" onClick={() => apagarPasta(pasta)}>
          Apagar pasta
        </button>
      </div>
    )
  }

  const grupo = (pasta: PastaDeItens, caminhoDaMae: string): ReactNode => {
    const conta = contas.get(pasta.id) ?? 0
    // Na busca, pasta sem achado (nela ou nas de dentro) sai da vista.
    if (buscando && conta === 0) return null
    const filhas = porPai.get(pasta.id) ?? []
    const dentro = itensPorPasta.get(pasta.id) ?? []
    const temConteudo = filhas.length > 0 || dentro.length > 0
    const fechadaNaBusca = fechadasNaBusca.termo === termo && fechadasNaBusca.ids.has(pasta.id)
    const aberta = buscando ? !fechadaNaBusca : pasta.recolhida !== true
    const idDoCorpo = `${idBase}-pasta-${pasta.id}`
    const caminho = caminhoDaMae === '' ? pasta.nome : `${caminhoDaMae} › ${pasta.nome}`
    const renomeando = formulario?.tipo === 'renomear' && formulario.id === pasta.id
    const comecarArrasto = (event: ReactPointerEvent<HTMLElement>) => arrasto.comecar(event, { tipo: 'pasta', pasta })
    return (
      <div key={pasta.id} className="lb-acervo__pasta lb-itens__pasta" role="group" aria-label={pasta.nome} data-pasta-id={pasta.id} {...{ [ATRIBUTO_DO_ALVO]: pasta.id }}>
        <div className="lb-acervo__pasta-topo">
          {temConteudo ? (
            <button
              type="button"
              className="lb-acervo__pasta-botao"
              aria-expanded={aberta}
              aria-controls={aberta ? idDoCorpo : undefined}
              aria-label={`${pasta.nome} (${conta})`}
              title={caminho}
              onPointerDown={comecarArrasto}
              onClick={() => {
                // Acabou de soltar a pasta: o clique do mesmo gesto não a fecha.
                if (arrasto.engolirClique()) return
                if (buscando) alternarNaBusca(pasta.id)
                else recolher(pasta.id, aberta)
              }}
            >
              <span className="lb-acervo__chevron" aria-hidden="true">
                <ChevronDownIcon size={14} />
              </span>
              <FolderIcon size={14} />
              <span className="lb-acervo__pasta-nome">{pasta.nome}</span>
            </button>
          ) : (
            // Pasta vazia não alterna (uma seta prometeria abrir o que não existe), mas arrasta e recebe.
            <div className="lb-acervo__pasta-botao" data-vazia="" title={caminho} onPointerDown={comecarArrasto}>
              <span className="lb-acervo__recuo" aria-hidden="true" />
              <FolderIcon size={14} />
              <span className="lb-acervo__pasta-nome">{pasta.nome}</span>
              <span className="lb-sr-only"> vazia</span>
            </div>
          )}
          {podeGravar && (
            <span className="lb-acervo__acoes">
              <button
                type="button"
                className="lb-acervo__mover"
                aria-label={`Ações da pasta ${pasta.nome}`}
                aria-expanded={menu === pasta.id}
                title="Nova pasta dentro, novo item, renomear, apagar"
                onClick={() => setMenu(menu === pasta.id ? null : pasta.id)}
              >
                <ReticenciasIcon size={14} />
              </button>
            </span>
          )}
          <span className="lb-acervo__contagem" aria-hidden="true">
            {conta}
          </span>
        </div>
        {menu === pasta.id && podeGravar && menuDaPasta(pasta)}
        {renomeando && (
          <FormDaPasta inicial={pasta.nome} rotulo={`Novo nome da pasta ${pasta.nome}`} acao="Renomear" onPronto={(nome) => renomear(pasta.id, nome)} onCancelar={() => fecharFormulario(pasta.id)} />
        )}
        {formularioDaPasta(pasta.id)}
        {aberta && temConteudo && (
          <div id={idDoCorpo} className="lb-itens__dentro">
            {filhas.map((filha) => grupo(filha, caminho))}
            {dentro.length > 0 && <ul className="lb-itens__grade">{dentro.map(cartao)}</ul>}
          </div>
        )}
      </div>
    )
  }

  const arrastado = arrasto.arrastado
  const soltos = itensPorPasta.get(null) ?? []
  // "Sem pasta" aparece vazio só durante o arrasto de quem ESTÁ numa pasta: é o lugar de soltá-lo para tirá-lo de lá.
  const arrastandoDeDentro = arrastado !== null && (arrastado.tipo === 'item' ? pastaDoItem(arrastado.item, ids) !== null : pastasAcimaDe(pastas, arrastado.pasta.id).length > 0)
  const mostrarSemPasta = soltos.length > 0 || arrastandoDeDentro
  const rotuloDoTopo = arrastado?.tipo === 'pasta' && soltos.length === 0 ? 'Topo' : SEM_PASTA
  const dica = [onSoltarNoMapa !== undefined ? DICA_DO_ARRASTO : '', podeGravar ? DICA_DAS_PASTAS : ''].filter((frase) => frase !== '').join(' ')
  const itemAberto = aberto === null ? undefined : 'novo' in aberto ? aberto.novo : itens.find((item) => item.id === aberto.id)
  const classeDaSecao = ['lb-section', 'lb-itens', arrastado !== null && 'lb-itens--arrastando'].filter(Boolean).join(' ')

  return (
    <section className={classeDaSecao} aria-labelledby={tituloId} ref={raizRef} onKeyDown={teclaNoPainel}>
      <div className="lb-acervo__topo">
        <h2 id={tituloId} className="lb-eyebrow">
          Itens
        </h2>
        {podeGravar && (
          <div className="lb-acervo__acoes-topo">
            <BotaoMais nome="Nova pasta" texto="Pasta" dica="Cria uma pasta no acervo de itens" onClick={() => abrirFormulario({ tipo: 'nova', paiId: null })} />
            <BotaoMais nome="Novo item" texto="Item" dica="Cadastra um item no acervo do app" onClick={() => setAberto({ novo: novoItemDoCatalogo() })} />
            <BotaoMais ref={botaoDasPecasRef} nome="Nova peça de puzzle" texto="Peça" dica="Põe no acervo uma das peças de puzzle desenhadas" onClick={() => alternarPecas(!pecasAbertas)} />
          </div>
        )}
      </div>
      {pecasAbertas && podeGravar && vitrineDasPecas()}
      {!vazio && (
        <div className="lb-acervo__busca" role="search">
          <CampoDeBusca campoRef={buscaRef} onMudar={setBusca} onDescer={descerParaOPrimeiro} />
          {/* Sempre montado (vazio some pelo CSS): o leitor de tela só anuncia a contagem de um `status` que já estava na página. */}
          <p className="lb-acervo__resultado" role="status">
            {resultado}
          </p>
        </div>
      )}
      {!vazio && (
        <label className="lb-itens__ordem">
          <span className="lb-label">Ordenar</span>
          <select className="lb-input" value={ordem} onChange={(event) => trocarOrdem(ehOrdem(event.target.value) ? event.target.value : 'guardada')}>
            {ORDENS.map((qual) => (
              <option key={qual} value={qual}>
                {ROTULO_DA_ORDEM[qual]}
              </option>
            ))}
          </select>
        </label>
      )}
      {usadosPorUltimo.length > 0 && (
        <div className="lb-acervo__pasta lb-itens__pasta lb-itens__recentes" role="group" aria-label="Recentes">
          <p className="lb-acervo__pasta-titulo">
            Recentes
            <span className="lb-acervo__contagem" aria-hidden="true">
              {usadosPorUltimo.length}
            </span>
          </p>
          <ul className="lb-itens__grade">{usadosPorUltimo.map(cartao)}</ul>
        </div>
      )}
      {aviso !== null && (
        <p className="lb-acervo__aviso" role="status">
          {aviso}
        </p>
      )}
      {formularioDaPasta(null)}
      {vazio && pastas.length === 0 ? (
        <p className="lb-acervo__vazio-estado">
          <span>{ITENS_VAZIO}</span> <span>{podeGravar ? ITENS_COMO_ENCHER : ITENS_SO_NO_APP}</span>
        </p>
      ) : nadaAchado ? null : (
        <div className="lb-itens__grupos">
          {dica !== '' && <p className="lb-label lb-itens__dica">{dica}</p>}
          {(porPai.get(null) ?? []).map((pasta) => grupo(pasta, ''))}
          {mostrarSemPasta && (
            <div className="lb-acervo__pasta lb-acervo__pasta--solta lb-itens__pasta lb-itens__solta" role="group" aria-label={rotuloDoTopo} {...{ [ATRIBUTO_DO_ALVO]: TOPO }}>
              {pastas.length > 0 && (
                <p className="lb-acervo__pasta-titulo">
                  {rotuloDoTopo}
                  <span className="lb-acervo__contagem" aria-hidden="true">
                    {soltos.length}
                  </span>
                </p>
              )}
              {soltos.length > 0 ? (
                <ul className="lb-itens__grade">{soltos.map(cartao)}</ul>
              ) : (
                <p className="lb-acervo__vazio">{arrastado?.tipo === 'pasta' ? 'Solte aqui para levar a pasta para o topo.' : 'Solte aqui para tirar o item da pasta.'}</p>
              )}
            </div>
          )}
        </div>
      )}
      {itemAberto !== undefined && aberto !== null && (
        <ItemDoCatalogoDialog
          key={itemAberto.id}
          item={itemAberto}
          novo={'novo' in aberto}
          categorias={categorias}
          alvos={alvos}
          onSalvar={(item) => salvarDoDialogo(item, 'novo' in aberto)}
          onApagar={() => useAcervoDeItensStore.getState().apagarItem(itemAberto.id)}
          onDar={(alvo, quantidade) => {
            const deu = onDar(itemAberto, alvo, quantidade)
            if (deu) usou(itemAberto.id)
            return deu
          }}
          onClose={() => setAberto(null)}
          imagemDoBlob={imagemDoItemDoBlob}
          escolherImagem={escolherImagemDoItem}
        />
      )}
      {arrasto.fantasma}
    </section>
  )
}

interface FormDaPastaProps {
  inicial: string
  /** O nome acessível do campo ("Nome da nova pasta dentro de Balas"). */
  rotulo: string
  /** O texto do botão que confirma. */
  acao: string
  onPronto: (nome: string) => void
  onCancelar: () => void
}

/** O nome da pasta, no lugar onde ela vai morar: Enter confirma, Esc ou nome vazio desistem. */
function FormDaPasta({ inicial, rotulo, acao, onPronto, onCancelar }: FormDaPastaProps) {
  const [nome, setNome] = useState(inicial)
  const enviar = (event: FormEvent) => {
    event.preventDefault()
    const limpo = nomeDaPastaLimpo(nome)
    if (limpo === '') onCancelar()
    else onPronto(limpo)
  }
  return (
    <form
      className="lb-acervo__form lb-itens__form-pasta"
      onSubmit={enviar}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Desiste do nome; não chega ao mapa.
        event.preventDefault()
        event.stopPropagation()
        onCancelar()
      }}
    >
      <input
        className="lb-input"
        aria-label={rotulo}
        placeholder="Nome da pasta"
        value={nome}
        maxLength={NOME_DA_PASTA_MAX}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setNome(event.target.value)}
      />
      <div className="lb-acervo__form-acoes">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn">
          {acao}
        </button>
      </div>
    </form>
  )
}
