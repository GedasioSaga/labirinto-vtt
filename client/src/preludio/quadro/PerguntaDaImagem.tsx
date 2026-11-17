import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ancestraisDe, compararTitulos, formaDe, formaNova, idNovo, ROTULO_DO_TIPO, semAcento, verbeteNovo } from '../../lib/preparo/enciclopedia'
import { estaNaLixeira } from '../../lib/preparo/lixeira'
import type { Forma, Verbete } from '../../lib/preparo/tipos'
import { urlDaMidia, useRaizDaMidia } from '../midia'
import './perguntaDaImagem.css'

/**
 * A IMAGEM QUE VIRA VERBETE, em dois passos como no Grimório
 * (`dialogoTransformar.tsx`): Espaço numa imagem solta do quadro pergunta
 *
 * 1. em quê: personagem, lugar, item ou facção (1 a 4, ou as setas e Enter);
 * 2. como entra: verbete novo; lugar dentro de outro lugar (o sub-cenário,
 *    com o nome "Pai: …" e as campanhas do lugar de cima); ou forma nova de
 *    um que existe (a versão de noite do lugar, a transformação do
 *    personagem, o item quebrado), que vira a forma ativa: o cartão a mostra.
 *
 * Se a imagem já é o retrato de algum verbete (o Ctrl+Z devolveu a imagem,
 * mas o verbete ficou), o passo 1 oferece pôr o cartão dele, em vez de criar
 * outro igual. Em todos, o cartão fica no lugar da imagem.
 *
 * Teclado: os números escolhem e seguem, Enter segue, Backspace (fora de um
 * campo) ou "Voltar" volta, Esc fecha, e o Tab não sai da caixa. Nada do que
 * se tecla aqui chega aos atalhos do tldraw: o Backspace apagaria a imagem.
 */

export type TipoDaImagem = 'personagem' | 'lugar' | 'item' | 'faccao'

const TIPOS: readonly TipoDaImagem[] = ['personagem', 'lugar', 'item', 'faccao']

/** Como a imagem entra no tipo escolhido: verbete novo, lugar dentro de outro lugar, ou forma nova de um que existe. */
export type JeitoDaImagem = 'novo' | 'dentro' | 'forma'

interface Jeito {
  readonly id: JeitoDaImagem
  readonly rotulo: string
  readonly dica?: string
}

const JEITOS: Readonly<Record<TipoDaImagem, readonly Jeito[]>> = {
  personagem: [
    { id: 'novo', rotulo: 'Personagem novo' },
    { id: 'forma', rotulo: 'Forma ou transformação de…', dica: 'um personagem que já existe' },
  ],
  lugar: [
    { id: 'novo', rotulo: 'Lugar novo' },
    { id: 'dentro', rotulo: 'Dentro de outro lugar', dica: 'sub-cenário' },
    { id: 'forma', rotulo: 'Versão de um lugar', dica: 'ex.: de noite' },
  ],
  item: [
    { id: 'novo', rotulo: 'Item novo' },
    { id: 'forma', rotulo: 'Versão de…', dica: 'um item que já existe' },
  ],
  faccao: [{ id: 'novo', rotulo: 'Facção nova' }],
}

/** Os nomes de um clique para a forma nova. */
const NOMES_PRONTOS: Readonly<Record<TipoDaImagem, readonly string[]>> = {
  personagem: ['Transformação'],
  lugar: ['Noite', 'Dia', 'Destruído'],
  item: ['Quebrado', 'Transformado'],
  faccao: [],
}

const O_TIPO: Readonly<Record<TipoDaImagem, string>> = { personagem: 'o personagem', lugar: 'o lugar', item: 'o item', faccao: 'a facção' }
const NENHUM: Readonly<Record<TipoDaImagem, string>> = { personagem: 'Nenhum personagem', lugar: 'Nenhum lugar', item: 'Nenhum item', faccao: 'Nenhuma facção' }
const NOME_DO_NOVO: Readonly<Record<TipoDaImagem, string>> = { personagem: 'Nome do personagem', lugar: 'Nome do lugar', item: 'Nome do item', faccao: 'Nome da facção' }
const EXEMPLO_DO_NOVO: Readonly<Record<TipoDaImagem, string>> = { personagem: 'Ex.: Kuro, o Ladrão', lugar: 'Ex.: Taverna do Porto', item: 'Ex.: Lâmina de Sal', faccao: 'Ex.: Guarda Real' }
/** O personagem ganha forma; o lugar e o item, versão (como o mestre fala deles). */
const PALAVRA_DA_FORMA: Readonly<Record<TipoDaImagem, 'forma' | 'versão'>> = { personagem: 'forma', lugar: 'versão', item: 'versão', faccao: 'forma' }

/** Quantos verbetes a busca mostra de uma vez: cabe numa janela baixa. */
const ACHADOS_NA_BUSCA = 5

/** O que separa as palavras de um nome ("Reino de Goa: Taverna" tem cinco). */
const ENTRE_PALAVRAS = /[^\p{L}\p{N}]+/u

/** Quão bem um nome (sem acento) casa com o que se digitou: 0 igual, 1 começa, 2 uma palavra começa, 3 só contém; `null` não casa. */
function notaDoNome(nome: string, consulta: string): number | null {
  if (nome === consulta) return 0
  if (nome.startsWith(consulta)) return 1
  if (nome.split(ENTRE_PALAVRAS).some((palavra) => palavra.startsWith(consulta))) return 2
  return nome.includes(consulta) ? 3 : null
}

const PASSO_DA_SETA: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }

/** O vizinho na lista pela tecla (setas dão a volta; Home e End vão às pontas), ou `undefined` se a tecla não anda. */
function vizinho<T>(lista: readonly T[], atual: T, tecla: string): T | undefined {
  if (tecla === 'Home') return lista[0]
  if (tecla === 'End') return lista[lista.length - 1]
  const passo = PASSO_DA_SETA[tecla]
  if (passo === undefined) return undefined
  return lista[(lista.indexOf(atual) + passo + lista.length) % lista.length]
}

// ─── O nome que vem do arquivo ───────────────────────────────────────────────

/** Palavras que o nome do arquivo traz sem dizer nada: o tldraw chama de "tldrawFile" a imagem colada. */
const PALAVRAS_VAZIAS = new Set(['tldrawfile', 'image', 'imagem', 'img', 'blank', 'untitled', 'unnamed', 'sem', 'titulo', 'nome', 'download', 'screenshot', 'captura', 'de', 'tela', 'print', 'foto', 'photo', 'picture', 'pic', 'clipboard', 'pasted', 'whatsapp', 'at', 'as', 'dsc', 'pxl', 'copy', 'copia'])
/** Número, data ou pedaço de hash ("20231012", "a3f9c2e1"). */
const NUMERO_OU_HASH = /^[\da-f]*\d[\da-f]*$/

/** O nome com que o campo começa: o do arquivo, ou vazio quando ele não diz nada ("tldrawFile", "image", "IMG 2024…"). */
export function nomeDaImagem(sugestao: string): string {
  const limpo = sugestao.trim()
  const palavras = semAcento(limpo)
    .split(/[\s().,:;+]+/)
    .filter((palavra) => palavra !== '')
  return palavras.every((palavra) => PALAVRAS_VAZIAS.has(palavra) || NUMERO_OU_HASH.test(palavra)) ? '' : limpo
}

/** Na Lixeira (`Verbete.lixeira`, a data em que foi para lá): fora das escolhas. */
export { estaNaLixeira }

// ─── O que a escolha faz no Prelúdio ─────────────────────────────────────────

export type DestinoDaImagem =
  /** Verbete novo com a imagem de retrato; com `paiId`, um lugar dentro daquele lugar. */
  | { readonly t: 'novo'; readonly tipo: TipoDaImagem; readonly nome: string; readonly paiId?: string }
  /** Forma nova (a versão, a transformação) de um verbete que existe. */
  | { readonly t: 'forma'; readonly verbeteId: string; readonly nome: string }
  /** O cartão do verbete que já tem esta imagem de retrato. */
  | { readonly t: 'cartao'; readonly verbeteId: string; readonly formaId: string }

/** O verbete que já tem esta imagem de retrato, e em qual forma. */
export interface JaRetrato {
  readonly verbete: Verbete
  readonly formaId: string
}

export interface ContextoDaImagem {
  readonly verbetes: ReadonlyMap<string, Verbete>
  readonly soLeitura: ReadonlyMap<string, string>
  /** A campanha do verbete novo solto (a do quadro, ou a do filtro). O lugar de dentro vai nas campanhas do lugar de cima. */
  readonly campanha: string | null
}

export type MudancaDaImagem =
  | { readonly t: 'recusa'; readonly motivo: string }
  | { readonly t: 'criar'; readonly verbete: Verbete; readonly pai: Verbete | null }
  /** A forma nova, para entrar no fim das formas do verbete e virar a ativa. */
  | { readonly t: 'forma'; readonly verbete: Verbete; readonly forma: Forma }
  | { readonly t: 'cartao'; readonly verbete: Verbete; readonly formaId: string }

/** O que a escolha muda nos verbetes, sem gravar nada: quem chama grava e troca a imagem pelo cartão. */
export function mudancaDaImagem(destino: DestinoDaImagem, midia: string, contexto: ContextoDaImagem, gerarId: (prefixo: string) => string = idNovo): MudancaDaImagem {
  if (destino.t === 'novo') {
    let pai: Verbete | null = null
    if (destino.paiId !== undefined) {
      const achado = contexto.verbetes.get(destino.paiId)
      if (achado === undefined || achado.tipo !== 'lugar' || estaNaLixeira(achado)) return { t: 'recusa', motivo: 'O lugar de cima não existe mais (ou está na Lixeira). Escolha outro.' }
      pai = achado
    }
    const campanhas = pai !== null ? pai.campanhas : contexto.campanha === null ? [] : [contexto.campanha]
    const base = verbeteNovo(destino.tipo, destino.nome, pai === null ? { campanhas } : { campanhas, paiId: pai.id }, gerarId)
    return { t: 'criar', pai, verbete: { ...base, formas: base.formas.map((forma, indice) => (indice === 0 ? { ...forma, retrato: midia } : forma)) } }
  }
  const verbete = contexto.verbetes.get(destino.verbeteId)
  if (verbete === undefined || estaNaLixeira(verbete)) return { t: 'recusa', motivo: 'Este verbete não existe mais (ou está na Lixeira).' }
  const aviso = contexto.soLeitura.get(verbete.id)
  if (destino.t === 'cartao') {
    // Pôr o cartão só mexe no verbete quando a forma não é a ativa.
    if (aviso !== undefined && verbete.formaAtivaId !== destino.formaId) return { t: 'recusa', motivo: aviso }
    return { t: 'cartao', verbete, formaId: destino.formaId }
  }
  if (aviso !== undefined) return { t: 'recusa', motivo: aviso }
  // A forma nova nasce com as seções da ativa, vazias (como "+ Forma" na página), e a imagem de retrato.
  const base = formaDe(verbete, null)
  const forma: Forma = { ...(base === undefined ? { id: gerarId('fm'), nome: destino.nome, resumo: '', secoes: [], imagens: [] } : formaNova(base, destino.nome, gerarId)), retrato: midia }
  return { t: 'forma', verbete, forma }
}

// ─── A caixa ─────────────────────────────────────────────────────────────────

export interface PerguntaDaImagemProps {
  /** O nome sugerido (o do arquivo da imagem, sem a extensão). */
  sugestao: string
  /** A imagem (`midia/…`): a miniatura no alto da caixa. */
  imagem?: string | null
  /** Por que a imagem não pode virar verbete agora; `null` = pode. */
  bloqueio: string | null
  /** Os verbetes que podem ser o lugar de cima ou ganhar a forma nova (personagem, lugar, item e facção). */
  candidatos: readonly Verbete[]
  /** Quão longe da imagem está o cartão de cada verbete no quadro: os de perto vêm primeiro na busca. */
  perto?: ReadonlyMap<string, number>
  /** Os verbetes que já usam esta imagem de retrato. */
  jaRetrato: readonly JaRetrato[]
  /** Faz o que o mestre escolheu e troca a imagem pelo cartão; devolve o motivo se não deu. */
  aoCriar: (destino: DestinoDaImagem) => Promise<string | null>
  aoDispensar: () => void
}

type Passo = 'tipo' | 'jeito'
/** De onde o passo entra: só a troca de passo desliza; ao abrir, a caixa inteira já assenta. */
type Sentido = 'abre' | 'frente' | 'tras'
type Foco = 'tipo' | 'jeito' | 'busca' | 'nome' | 'nome-fim'

/** O tipo da última imagem transformada (nesta janela): a próxima pergunta já começa nele. */
let tipoDaUltima: TipoDaImagem = 'personagem'

function ehCampo(alvo: EventTarget): boolean {
  return alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement || (alvo instanceof HTMLElement && alvo.isContentEditable)
}

function Miniatura({ raiz, midia, nome, grande = false }: { raiz: string | null; midia: string | null | undefined; nome: string; grande?: boolean }) {
  const [falhou, setFalhou] = useState(false)
  const endereco = raiz === null || falhou ? null : urlDaMidia(raiz, midia)
  // A imagem do alto só aparece quando abre; a do verbete sem retrato mostra a inicial.
  if (grande && endereco === null) return null
  return (
    <span className={`pr-transformar__mini${grande ? ' pr-transformar__mini--grande' : ''}`} aria-hidden="true">
      {endereco === null ? (nome.trim() || '?').charAt(0).toUpperCase() : <img src={endereco} alt="" draggable={false} onError={() => setFalhou(true)} />}
    </span>
  )
}

export function PerguntaDaImagem({ sugestao, imagem = null, bloqueio, candidatos, perto, jaRetrato, aoCriar, aoDispensar }: PerguntaDaImagemProps) {
  const [passo, setPasso] = useState<Passo>('tipo')
  const [sentido, setSentido] = useState<Sentido>('abre')
  const [tipo, setTipo] = useState<TipoDaImagem>(tipoDaUltima)
  /** O tipo com o foco no passo 1 (as setas andam sem escolher). */
  const [tipoEmFoco, setTipoEmFoco] = useState<TipoDaImagem>(tipoDaUltima)
  const [jeito, setJeito] = useState<JeitoDaImagem>('novo')
  const [busca, setBusca] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [alvoId, setAlvoId] = useState<string | null>(null)
  const [nome, setNome] = useState(() => nomeDaImagem(sugestao))
  /** O "Pai: " posto no começo do nome do lugar de dentro; sai quando o mestre troca de jeito ou de lugar de cima. */
  const [prefixo, setPrefixo] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [foco, setFoco] = useState<{ readonly onde: Foco } | null>({ onde: 'tipo' })
  const raiz = useRaizDaMidia()
  const id = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const campoDoNome = useRef<HTMLInputElement>(null)
  const campoDaBusca = useRef<HTMLInputElement>(null)

  const jeitos = JEITOS[tipo]
  const porId = useMemo(() => new Map(candidatos.map((verbete) => [verbete.id, verbete])), [candidatos])
  const vivos = useMemo(() => candidatos.filter((verbete) => !estaNaLixeira(verbete)), [candidatos])
  const alvo = alvoId === null ? undefined : vivos.find((verbete) => verbete.id === alvoId && verbete.tipo === tipo)
  const haCandidato = vivos.some((verbete) => verbete.tipo === tipo)
  const disponivel = (cada: JeitoDaImagem) => cada === 'novo' || haCandidato

  const achados = useMemo(() => {
    const consulta = semAcento(busca.trim())
    const distancia = (verbete: Verbete) => perto?.get(verbete.id) ?? Number.POSITIVE_INFINITY
    const lista: { readonly verbete: Verbete; readonly nota: number; readonly folga: number }[] = []
    for (const verbete of vivos) {
      if (verbete.tipo !== tipo) continue
      if (consulta === '') {
        lista.push({ verbete, nota: 0, folga: 0 })
        continue
      }
      let melhor: { readonly nota: number; readonly folga: number } | null = null
      for (const nome of [verbete.titulo, ...verbete.apelidos].map(semAcento)) {
        const nota = notaDoNome(nome, consulta)
        const folga = nome.length - consulta.length
        if (nota !== null && (melhor === null || nota < melhor.nota || (nota === melhor.nota && folga < melhor.folga))) melhor = { nota, folga }
      }
      if (melhor !== null) lista.push({ verbete, ...melhor })
    }
    // Digitou algo: o nome que casa melhor vem primeiro ("Reino de Goa" antes de "Reino de Goa: Taverna" para "goa"),
    // porque o que se escreveu diz mais que a posição. Depois, o cartão mais perto da imagem no quadro e a ordem do nome.
    return lista
      .sort((a, b) => a.nota - b.nota || a.folga - b.folga || distancia(a.verbete) - distancia(b.verbete) || compararTitulos(a.verbete.titulo, b.verbete.titulo))
      .slice(0, ACHADOS_NA_BUSCA)
      .map(({ verbete }) => verbete)
  }, [vivos, tipo, busca, perto])
  const indiceAtivo = Math.min(ativo, Math.max(0, achados.length - 1))

  // O foco vai aonde a última escolha mandou, depois que o passo novo já está na tela.
  useLayoutEffect(() => {
    if (foco === null) return
    const dentro = caixa.current
    if (dentro === null) return
    const campo = campoDoNome.current
    if (foco.onde === 'tipo') dentro.querySelector<HTMLElement>('[data-tipo][tabindex="0"]')?.focus()
    else if (foco.onde === 'jeito') dentro.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus()
    else if (foco.onde === 'busca' && campoDaBusca.current !== null) campoDaBusca.current.focus()
    else if (campo !== null) {
      campo.focus()
      if (foco.onde === 'nome') campo.select()
      else campo.setSelectionRange(campo.value.length, campo.value.length)
    }
  }, [foco])

  const ir = (proximo: Passo, onde: Foco) => {
    setSentido(proximo === 'jeito' ? 'frente' : 'tras')
    setPasso(proximo)
    setFoco({ onde })
  }

  const tirarPrefixo = () => {
    if (prefixo === '') return
    setNome((antes) => (antes.startsWith(prefixo) ? antes.slice(prefixo.length) : antes))
    setPrefixo('')
  }

  const porPrefixo = (pai: Verbete) => {
    const novo = `${pai.titulo || 'Sem nome'}: `
    setNome((antes) => novo + (prefixo !== '' && antes.startsWith(prefixo) ? antes.slice(prefixo.length) : antes))
    setPrefixo(novo)
  }

  const escolherTipo = (novo: TipoDaImagem) => {
    if (novo !== tipo) {
      setTipo(novo)
      setJeito('novo')
      setAlvoId(null)
      setBusca('')
      setAtivo(0)
      tirarPrefixo()
    }
    tipoDaUltima = novo
    setTipoEmFoco(novo)
    setErro(null)
    ir('jeito', JEITOS[novo].length > 1 ? 'jeito' : 'nome')
  }

  /** Marca o jeito; com `seguir` (número, Enter, clique), o foco vai ao campo seguinte. */
  const escolherJeito = (novo: JeitoDaImagem, seguir: boolean) => {
    if (!disponivel(novo)) return
    if (novo !== jeito) {
      if (jeito === 'dentro') tirarPrefixo()
      else if (novo === 'dentro' && alvo !== undefined) porPrefixo(alvo)
      setJeito(novo)
      setErro(null)
    }
    if (seguir) setFoco({ onde: novo !== 'novo' && alvo === undefined ? 'busca' : novo === 'dentro' ? 'nome-fim' : 'nome' })
    else setFoco({ onde: 'jeito' })
  }

  const escolherAlvo = (escolhido: Verbete) => {
    setAlvoId(escolhido.id)
    setErro(null)
    if (jeito === 'dentro') porPrefixo(escolhido)
    setFoco({ onde: jeito === 'dentro' ? 'nome-fim' : 'nome' })
  }

  const trocarAlvo = () => {
    if (jeito === 'dentro') tirarPrefixo()
    setAlvoId(null)
    setFoco({ onde: 'busca' })
  }

  const voltar = () => {
    setErro(null)
    setTipoEmFoco(tipo)
    ir('tipo', 'tipo')
  }

  const fazer = async (destino: DestinoDaImagem) => {
    if (criando) return
    setCriando(true)
    setErro(null)
    let motivo: string | null
    try {
      motivo = await aoCriar(destino)
    } catch (falha) {
      motivo = `Não deu: ${falha instanceof Error ? falha.message : String(falha)}.`
    }
    setCriando(false)
    if (motivo !== null) setErro(motivo)
  }

  const limpo = nome.trim()
  const semNome = limpo === '' || (prefixo !== '' && limpo === prefixo.trim())
  const faltaAlvo = jeito !== 'novo' && alvo === undefined
  const falta = faltaAlvo ? (jeito === 'dentro' ? 'Escolha o lugar de cima na busca.' : `Escolha ${O_TIPO[tipo]} na busca.`) : semNome ? 'Escreva o nome.' : null

  const criar = () => {
    // "Criar" sem tudo pronto leva ao que falta, em vez de não fazer nada.
    if (falta !== null) {
      setFoco({ onde: faltaAlvo ? 'busca' : 'nome-fim' })
      return
    }
    if (jeito === 'novo') void fazer({ t: 'novo', tipo, nome: limpo })
    else if (alvo === undefined) return
    else if (jeito === 'dentro') void fazer({ t: 'novo', tipo: 'lugar', nome: limpo, paiId: alvo.id })
    else void fazer({ t: 'forma', verbeteId: alvo.id, nome: limpo })
  }

  const prenderTab = (evento: KeyboardEvent<HTMLDivElement>) => {
    const dentro = caixa.current
    if (dentro === null) return
    const focaveis = Array.from(dentro.querySelectorAll<HTMLElement>('button, input, [tabindex]')).filter((elemento) => elemento.tabIndex >= 0 && !elemento.matches(':disabled') && elemento.getClientRects().length > 0)
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    if (primeiro === undefined || ultimo === undefined) return
    const agora = dentro.ownerDocument.activeElement
    if (evento.shiftKey && agora === primeiro) {
      evento.preventDefault()
      ultimo.focus()
    } else if (!evento.shiftKey && agora === ultimo) {
      evento.preventDefault()
      primeiro.focus()
    }
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    // Os atalhos do tldraw ouvem a página inteira: daqui nada passa (o Backspace apagaria a imagem escolhida).
    evento.stopPropagation()
    if (evento.key === 'Escape') {
      evento.preventDefault()
      aoDispensar()
      return
    }
    if (evento.key === 'Tab') {
      prenderTab(evento)
      return
    }
    if (bloqueio !== null || criando || evento.ctrlKey || evento.metaKey || evento.altKey || ehCampo(evento.target)) return
    if (passo === 'jeito' && evento.key === 'Backspace') {
      evento.preventDefault()
      voltar()
      return
    }
    if (!/^[1-9]$/.test(evento.key)) return
    const numero = Number(evento.key) - 1
    if (passo === 'tipo') {
      const escolhido = TIPOS[numero]
      if (escolhido === undefined) return
      evento.preventDefault()
      escolherTipo(escolhido)
      return
    }
    const escolhido = jeitos[numero]
    if (escolhido === undefined) return
    evento.preventDefault()
    escolherJeito(escolhido.id, true)
  }

  const aoTeclarNosTipos = (evento: KeyboardEvent<HTMLDivElement>) => {
    const proximo = vizinho(TIPOS, tipoEmFoco, evento.key)
    if (proximo === undefined) return
    evento.preventDefault()
    setTipoEmFoco(proximo)
    setFoco({ onde: 'tipo' })
  }

  // As setas só marcam; Enter e Espaço são o clique do botão, que marca e segue.
  const aoTeclarNosJeitos = (evento: KeyboardEvent<HTMLDivElement>) => {
    const abertos = jeitos.filter((cada) => disponivel(cada.id)).map((cada) => cada.id)
    const proximo = vizinho(abertos, jeito, evento.key)
    if (proximo === undefined) return
    evento.preventDefault()
    escolherJeito(proximo, false)
  }

  const aoTeclarNaBusca = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      if (achados.length === 0) return
      evento.preventDefault()
      const passoDaSeta = evento.key === 'ArrowDown' ? 1 : -1
      setAtivo((indiceAtivo + passoDaSeta + achados.length) % achados.length)
    } else if (evento.key === 'Enter') {
      // Enter escolhe o achado marcado (o primeiro, sem mexer nas setas) e não envia o form.
      evento.preventDefault()
      const escolhido = achados[indiceAtivo]
      if (escolhido !== undefined) escolherAlvo(escolhido)
    }
  }

  if (bloqueio !== null) {
    return (
      <div ref={caixa} className="pr-pergunta pr-pergunta--imagem" role="dialog" aria-label="Transformar esta imagem" onKeyDown={aoTeclar}>
        <p className="pr-pergunta__texto">Esta imagem não vira verbete:</p>
        <div className="pr-pergunta__linha">
          <p className="pr-pergunta__bloqueio">{bloqueio}</p>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" autoFocus onClick={aoDispensar}>
            Entendi
          </button>
        </div>
      </div>
    )
  }

  const rotuloDoTipo = ROTULO_DO_TIPO[tipo].um
  const palavra = PALAVRA_DA_FORMA[tipo]
  const nomeDoAlvo = alvo === undefined ? '' : alvo.titulo || 'Sem nome'
  const rotuloDoNome = jeito === 'forma' ? `Nome da ${palavra}` : NOME_DO_NOVO[tipo]
  const idDaLista = `${id}-achados`
  const ondeFica = (verbete: Verbete) =>
    ancestraisDe(verbete, porId)
      .map((pai) => pai.titulo || 'Sem nome')
      .join(' › ')
  const noQuadro = (verbete: Verbete) => perto?.has(verbete.id) === true
  const ondeDoAlvo = alvo === undefined ? '' : ondeFica(alvo)

  const cabeca = (
    <div className="pr-transformar__cabeca">
      <Miniatura raiz={raiz} midia={imagem} nome="" grande />
      <div key={passo} className="pr-transformar__passo" data-sentido={sentido}>
        <p className="pr-transformar__etapa">{passo === 'tipo' ? 'Passo 1 de 2' : 'Passo 2 de 2 · Transformar esta imagem em'}</p>
        <h2 className="pr-transformar__titulo">{passo === 'tipo' ? 'Transformar esta imagem em…' : rotuloDoTipo}</h2>
      </div>
    </div>
  )

  return (
    <div ref={caixa} className="pr-pergunta pr-pergunta--imagem" role="dialog" aria-label="Transformar esta imagem" onKeyDown={aoTeclar}>
      {cabeca}
      {passo === 'tipo' ? (
        <div key="tipo" className="pr-transformar__passo pr-transformar__corpo" data-sentido={sentido}>
          {jaRetrato.map(({ verbete, formaId }) => {
            const forma = verbete.formas.find((cada) => cada.id === formaId)
            const quem = verbete.titulo || 'Sem nome'
            return (
              <div key={`${verbete.id}:${formaId}`} className="pr-pergunta__linha pr-pergunta__ja">
                <p className="pr-pergunta__bloqueio">
                  Esta imagem já é o retrato de <b>{quem}</b>
                  {verbete.formas.length > 1 && forma !== undefined ? ` (forma ${forma.nome || 'sem nome'})` : ''}.
                </p>
                <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={criando} onClick={() => void fazer({ t: 'cartao', verbeteId: verbete.id, formaId })}>
                  Pôr o cartão de {quem}
                </button>
              </div>
            )
          })}
          <div className="pr-transformar__tipos" role="group" aria-label="Transformar esta imagem em" onKeyDown={aoTeclarNosTipos}>
            {TIPOS.map((cada, indice) => (
              <button
                key={cada}
                type="button"
                data-tipo={cada}
                className="pr-transformar__tipo"
                tabIndex={cada === tipoEmFoco ? 0 : -1}
                aria-keyshortcuts={String(indice + 1)}
                onFocus={() => setTipoEmFoco(cada)}
                onClick={() => escolherTipo(cada)}
              >
                <kbd className="gr-kbd" aria-hidden="true">
                  {indice + 1}
                </kbd>
                <span className="pr-transformar__tipo-nome">{ROTULO_DO_TIPO[cada].um}</span>
              </button>
            ))}
          </div>
          <div className="pr-transformar__pe">
            <p className="pr-transformar__nota">Ela vira o retrato, e o cartão fica no lugar dela.</p>
            <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoDispensar}>
              Agora não
            </button>
          </div>
        </div>
      ) : (
        <form
          key="jeito"
          className="pr-transformar__passo pr-transformar__corpo"
          data-sentido={sentido}
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault()
            criar()
          }}
        >
          {jeitos.length > 1 && (
            <div className="pr-transformar__jeitos" role="radiogroup" aria-label={`Como entra ${O_TIPO[tipo]}`} onKeyDown={aoTeclarNosJeitos}>
              {jeitos.map((cada, indice) => {
                const aberto = disponivel(cada.id)
                return (
                  <button
                    key={cada.id}
                    type="button"
                    role="radio"
                    className="pr-transformar__jeito"
                    aria-checked={cada.id === jeito}
                    aria-disabled={!aberto}
                    aria-keyshortcuts={aberto ? String(indice + 1) : undefined}
                    tabIndex={cada.id === jeito ? 0 : -1}
                    onClick={() => escolherJeito(cada.id, true)}
                  >
                    <span className="pr-transformar__bolinha" aria-hidden="true" />
                    <span className="pr-transformar__jeito-nome">{cada.rotulo}</span>
                    <span className="pr-transformar__jeito-dica">{aberto ? cada.dica : `${NENHUM[tipo].toLowerCase()} ainda`}</span>
                    <kbd className="gr-kbd" aria-hidden="true">
                      {indice + 1}
                    </kbd>
                  </button>
                )
              })}
            </div>
          )}

          {jeito !== 'novo' &&
            (alvo === undefined ? (
              <div className="pr-transformar__campo">
                <label className="pr-transformar__rotulo" htmlFor={`${id}-busca`}>
                  Buscar {rotuloDoTipo.toLowerCase()}
                  {jeito === 'dentro' ? ' de cima' : ''}
                </label>
                <input
                  ref={campoDaBusca}
                  id={`${id}-busca`}
                  className="pr-pergunta__campo"
                  role="combobox"
                  aria-expanded={achados.length > 0}
                  aria-controls={idDaLista}
                  aria-autocomplete="list"
                  aria-activedescendant={achados.length > 0 ? `${idDaLista}-${indiceAtivo}` : undefined}
                  placeholder="O nome, ou parte dele"
                  autoComplete="off"
                  spellCheck={false}
                  value={busca}
                  onChange={(evento) => {
                    setBusca(evento.target.value)
                    setAtivo(0)
                  }}
                  onKeyDown={aoTeclarNaBusca}
                />
                {achados.length === 0 ? (
                  <p className="pr-transformar__vazio" role="status">
                    {busca.trim() === '' ? `${NENHUM[tipo]} ainda.` : `${NENHUM[tipo]} com “${busca.trim()}”.`}
                  </p>
                ) : (
                  <ul id={idDaLista} className="pr-transformar__achados" role="listbox" aria-label={`${ROTULO_DO_TIPO[tipo].varios} achados`}>
                    {achados.map((verbete, indice) => {
                      const onde = ondeFica(verbete)
                      return (
                        <li
                          key={verbete.id}
                          id={`${idDaLista}-${indice}`}
                          className="pr-transformar__achado"
                          role="option"
                          aria-selected={indice === indiceAtivo}
                          onMouseDown={(evento) => evento.preventDefault()}
                          onMouseMove={() => {
                            if (indice !== indiceAtivo) setAtivo(indice)
                          }}
                          onClick={() => escolherAlvo(verbete)}
                        >
                          <Miniatura raiz={raiz} midia={formaDe(verbete, null)?.retrato} nome={verbete.titulo} />
                          <span className="pr-transformar__achado-texto">
                            <span className="pr-transformar__achado-nome">{verbete.titulo || 'Sem nome'}</span>
                            {onde !== '' && <span className="pr-transformar__achado-onde">{onde}</span>}
                          </span>
                          {noQuadro(verbete) && <span className="pr-transformar__selo">no quadro</span>}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <div className="pr-transformar__campo">
                <span className="pr-transformar__rotulo">{jeito === 'dentro' ? 'Lugar de cima' : rotuloDoTipo}</span>
                <div className="pr-transformar__escolhido">
                  <Miniatura raiz={raiz} midia={formaDe(alvo, null)?.retrato} nome={alvo.titulo} />
                  <span className="pr-transformar__achado-texto">
                    <span className="pr-transformar__achado-nome">{nomeDoAlvo}</span>
                    {ondeDoAlvo !== '' && <span className="pr-transformar__achado-onde">{ondeDoAlvo}</span>}
                  </span>
                  <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={trocarAlvo}>
                    Trocar
                  </button>
                </div>
                <p className="pr-transformar__efeito">
                  <span aria-hidden="true">↳ </span>
                  {jeito === 'dentro' ? 'Nasce como sub-cenário de ' : palavra === 'forma' ? 'Vira uma forma nova de ' : 'Vira uma versão nova de '}
                  <b>“{nomeDoAlvo}”</b>
                  {jeito === 'dentro' ? ', nas mesmas campanhas.' : ', e o cartão mostra esta imagem.'}
                </p>
              </div>
            ))}

          <div className="pr-transformar__campo">
            <label className="pr-transformar__rotulo" htmlFor={`${id}-nome`}>
              {rotuloDoNome}
            </label>
            <input
              ref={campoDoNome}
              id={`${id}-nome`}
              className="pr-pergunta__campo"
              placeholder={jeito === 'forma' ? `Ex.: ${NOMES_PRONTOS[tipo][0] ?? 'Noite'}` : EXEMPLO_DO_NOVO[tipo]}
              autoComplete="off"
              value={nome}
              maxLength={120}
              onChange={(evento) => setNome(evento.target.value)}
            />
            {jeito === 'forma' && NOMES_PRONTOS[tipo].length > 0 && (
              <div className="pr-transformar__prontos" role="group" aria-label={`Nomes prontos para a ${palavra}`}>
                {NOMES_PRONTOS[tipo].map((pronto) => (
                  <button
                    key={pronto}
                    type="button"
                    className="pr-transformar__pronto"
                    aria-pressed={limpo === pronto}
                    onClick={() => {
                      setNome(pronto)
                      setFoco({ onde: 'nome-fim' })
                    }}
                  >
                    {pronto}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pr-transformar__pe">
            <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={voltar}>
              Voltar
            </button>
            <span className="pr-transformar__espaco" />
            {falta !== null && <span className="pr-transformar__falta">{falta}</span>}
            <button type="submit" className="gr-bt gr-bt--p gr-bt--primario pr-transformar__criar" aria-disabled={falta !== null || criando} aria-busy={criando}>
              {criando ? 'Criando…' : 'Criar'}
            </button>
          </div>
        </form>
      )}
      {erro !== null && (
        <p className="pr-pergunta__erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
