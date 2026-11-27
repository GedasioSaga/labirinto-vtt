import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { categoriaDaMecanica } from '../../../lib/batalha/mecanica/categoria'
import { converterCartao } from '../../../lib/batalha/mecanica/conversao/ficha'
import type { RelatorioDoCartao } from '../../../lib/batalha/mecanica/conversao/comum'
import { avisoDaMecanica, lerMecanica, type MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import { guardarMecanica } from '../../../lib/batalha/mecanica/modelos'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { cartaoComTextoGerado } from '../../../lib/batalha/mecanica/textoGerado'
import { ABA_DAS_TECNICAS } from '../../../lib/batalha/leituraDaFicha'
import { leituraDaTecnica } from '../../../lib/batalha/leituraDaTecnica'
import { temLinhaNaTabela } from '../../../lib/batalha/mecanicasAMao'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { ACOES } from '../blocos/BlocosDoComeco'
import { BlocoSemCaixa, Escolha } from '../blocos/controles'
import { OcultaNoCartao } from '../HabilidadeOculta'
import { ColunaDoPapel } from './ColunaDoPapel'
import { ComecarDeUmModelo } from './ComecarDeUmModelo'
import type { IdDaLinha } from './fraseDoPapel'
import { cartaoComAMecanica, cartaoDaTela, mecanicaQueAbre, problemaNoEditor, TAMANHO_DA_MECANICA_MAX, tamanhoDaMecanica, type DoQueNoEditor, type QuemEditaNoEditor } from './gravarNoCartao'
import { ancoraDaLinha, Linha } from './Linha'
import { LinhaDaAcao, semGolpeNaTela } from './linhas/LinhaDaAcao'
import { LinhaDaEvolucao } from './linhas/LinhaDaEvolucao'
import { LinhaDoAcerto } from './linhas/LinhaDoAcerto'
import { LinhaDoAlcance } from './linhas/LinhaDoAlcance'
import { LinhaDoCusto } from './linhas/LinhaDoCusto'
import { LinhaDoDano } from './linhas/LinhaDoDano'
import { LinhaDoGasto, type GastoDoItem } from './linhas/LinhaDoGasto'
import { LinhaDoGolpe } from './linhas/LinhaDoGolpe'
import { LinhaDosCampos } from './linhas/LinhaDosCampos'
import { LinhaDosEfeitos } from './linhas/LinhaDosEfeitos'
import { LinhaDosRequisitos } from './linhas/LinhaDosRequisitos'
import type { ModeloNoEditor } from './modelosDoEditor'
import type { MudarNoEditor } from './mudarNoEditor'
import { PecasDaHabilidade } from './PecasDaHabilidade'
import { fontesDaFicha, listasDaFicha } from './requisitosDoCartao'
import { TopoDaHabilidade } from './TopoDaHabilidade'
import './editor.css'

/** Quantos passos o Ctrl+Z guarda. */
const PILHA_MAX = 50
/** Mudanças seguidas dentro desta janela (digitar a fórmula, as setas num número) viram um passo só do Ctrl+Z. */
const JUNTAR_MS = 800
/** Quanto o aviso fica embaixo antes de sumir sozinho. */
const AVISO_MS = 6000
/** A saída do aviso (mais rápida que a entrada, 200 ms no CSS). */
const SAIDA_DO_AVISO_MS = 150

/** Um passo do Ctrl+Z: o cartão inteiro (requisitos, extras, a conversão de antes voltam iguais) e o rascunho. */
interface Passo {
  cartao: CartaoDaFicha
  rascunho: MecanicaV1 | null
}

interface Aviso {
  texto: string
  comDesfazer: boolean
  /** Descendo para sair: some no fim da saída. */
  saindo: boolean
  /** Muda a cada aviso: o mesmo texto duas vezes entra de novo. */
  vez: number
}

/** O Atacar com a arma não pergunta a ação (`motivoDaArmaNasPecas`): ela gasta uma ação certa. */
const ACOES_DA_ARMA = ACOES.filter((acao) => acao.valor !== 'perguntar')

/** ED7: as palavras que mudam em cada coisa que o editor monta; o resto da tela é a mesma. */
interface TextosDoEditor {
  titulo: string
  /** Sem mecânica: o que vale e como começar. */
  semNada: string
  /** O botão que tira a mecânica (só na arma e no item: a técnica não volta ao texto, D14). */
  tirar: string
  tirou: string
  semRequisito: string
}

const TEXTOS: Readonly<Record<Exclude<DoQueNoEditor, 'tecnica'>, TextosDoEditor>> = {
  arma: {
    titulo: 'Editor da arma',
    semNada: 'Sem mecânica, o Atacar com esta arma usa só o dano dela. Com um modelo, o Atacar segue as peças: o dano (ou nenhum), o efeito e os usos por batalha.',
    tirar: 'Tirar a mecânica',
    tirou: 'A mecânica saiu: o Atacar volta a usar só o dano da arma.',
    semRequisito: 'Sem requisito: o Atacar com ela vale sempre.',
  },
  item: {
    titulo: 'Editor do item',
    semNada: 'Sem efeito, o item é só descrição (o mestre narra). Com um modelo, usar o item segue as peças, sem custo de SP: o custo é o próprio item.',
    tirar: 'Tirar o efeito',
    tirou: 'O efeito saiu: o item volta a ser só descrição.',
    semRequisito: 'Sem requisito: o item se usa sempre que estiver na mochila.',
  },
}

/** O Ctrl+Z dentro de um campo de texto é o do próprio campo (desfaz a letra), não o do editor. */
function digitando(alvo: EventTarget): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  if (alvo.isContentEditable || alvo instanceof HTMLTextAreaElement) return true
  return alvo instanceof HTMLInputElement && !['radio', 'checkbox', 'button', 'submit', 'range', 'color'].includes(alvo.type)
}

/**
 * O que o editor faz assim que abre: `modelo` = abre o "Começar de um modelo"; `nome` = a habilidade
 * que acabou de nascer em branco, com o foco no Nome para já escrever. `montar` ficou pelo contrato de
 * quem já chama (rework D14): a técnica de antes já abre convertida (D11), então é o mesmo que só abrir.
 */
export type AoAbrirOEditor = 'montar' | 'modelo' | 'nome'

/** O que o editor abre: o cartão (convertido na leitura, D11) e, se a conversão não montou, o porquê. */
interface AberturaDoEditor {
  cartao: CartaoDaFicha
  ficouNoTexto: string | null
}

/**
 * D11: a técnica de antes (sem mecânica) abre já convertida, com os "Confira" na Descrição; o mestre
 * olhando o cartão aceita a conversão mesmo quando a batalha leria um número diferente (cada diferença
 * vira um "Confira"). O cartão com linha na tabela à mão nunca é montado pela conversão (a regra à mão
 * continua valendo). Nada grava aqui: o cartão convertido só vai à ficha pelo `onChange`, e ao disco
 * quando a ficha salva.
 */
function aberturaDoEditor(cartao: CartaoDaFicha, quemEdita: QuemEditaNoEditor, ficha: FichaDaPrevia, aba: string): AberturaDoEditor {
  if (mecanicaQueAbre(cartao, quemEdita) !== null || lerMecanica(cartao.mecanica).tipo !== 'nenhuma') return { cartao, ficouNoTexto: null }
  if (temLinhaNaTabela(cartao.id)) return { cartao, ficouNoTexto: 'ela tem regra escrita à mão no app, que continua valendo' }
  const convertido = converterCartao(cartao, aba, { personagem: ficha.personagem, sistema: ficha.sistema }, { mesmoComDiferenca: true })
  const ficou = convertido.relatorio.find((linha) => linha.cartaoId === cartao.id && linha.resultado === 'noTexto')
  return { cartao: convertido.cartao, ficouNoTexto: ficou === undefined ? null : (ficou.porque ?? 'o leitor não entendeu o texto') }
}

export interface EditorDaHabilidadeProps {
  cartao: CartaoDaFicha
  ficha: FichaDaPrevia
  /** O mestre grava a `mecanica`; o dono, a `mecanicaProposta`. */
  quemEdita: QuemEditaNoEditor
  /** Cada mudança completa vai na hora para o cartão em edição; quem grava em disco é o Salvar da ficha. */
  onChange: (cartao: CartaoDaFicha) => void
  onFechar: () => void
  /** As técnicas da ficha (com esta): o "Evolui para" e os requisitos que apontam outra técnica. */
  tecnicas: readonly CartaoDaFicha[]
  /** O app do mestre esconde cartões dos jogadores (o site, não: lá o segredo subiria ao Lobby). */
  podeOcultar: boolean
  /** ED7: o que o editor monta; ausente = a técnica. */
  doQue?: DoQueNoEditor
  /** ED7: fora da ficha (o livro, o Acervo): sem Evolução e Campos extras, que só o cartão da ficha guarda. */
  foraDaFicha?: boolean
  /** ED7: a frase do cabeçalho no lugar de "entra no cartão; o Salvar da ficha grava" (o livro diz onde a regra vale). */
  trilha?: string
  /** Só no item: quanto e onde gasta; a mudança vai direto ao efeito do item (fica fora do Ctrl+Z, como os campos da janela). */
  gastoDoItem?: { gasto: GastoDoItem; onChange: (gasto: GastoDoItem) => void }
  /** Só no item: o modelo escolhido, antes da mudança das peças (a janela acerta o "onde vale" dele). */
  onModelo?: (modelo: ModeloNoEditor) => void
  /** O que faz assim que abre; ausente = só abre. */
  aoAbrir?: AoAbrirOEditor
  /** Rework D14: a aba do cartão (a conversão de leitura lê a forma pela aba que liga); ausente = Habilidades. */
  abaDoCartao?: string
  /** Rework D14: o relatório da conversão da ficha (o porquê de a habilidade de antes ter ficado no texto). */
  relatorio?: readonly RelatorioDoCartao[]
  /** Rework D14: com ele, o Salvar oferece "Guardar também no catálogo do livro" e o chama com o cartão. */
  guardarNoCatalogo?: (cartao: CartaoDaFicha) => void
  /** Rework D8: a peça grava a ligação no requisito de outro cartão da ficha (a técnica da forma, a que o acumulador libera). */
  aoMudarOutroCartao?: (cartao: CartaoDaFicha) => void
}

/**
 * O EDITOR DA HABILIDADE (EDITOR.md §5; protótipo aprovado `editor/prototipo.html`, direção C): uma
 * linha por pergunta à esquerda e, à direita, o papel com a frase (cada pedaço leva à sua linha), o
 * mapa do alcance e o Testar no boneco, vivos. Abre por cima da ficha, numa janela do sistema
 * (`<dialog>`): Esc fecha, Ctrl+Z desfaz fora dos campos de texto.
 *
 * ED5: é o editor das técnicas na ficha. O mestre grava a `mecanica` e os campos de texto saem dela
 * (`cartaoComTextoGerado`, o ponto único); o dono grava a `mecanicaProposta`. Requisitos, evolução,
 * esconder e campos extras gravam no cartão, fora da mecânica.
 */
export function EditorDaHabilidade({ cartao, ficha, quemEdita, onChange, onFechar, tecnicas, podeOcultar, doQue = 'tecnica', foraDaFicha = false, trilha, gastoDoItem, onModelo, aoAbrir, abaDoCartao, relatorio, guardarNoCatalogo, aoMudarOutroCartao }: EditorDaHabilidadeProps) {
  const naTecnica = doQue === 'tecnica'
  const textos = doQue === 'tecnica' ? null : TEXTOS[doQue]
  const prefixo = useId()
  const tituloId = useId()
  const tambemId = useId()
  const janela = useRef<HTMLDialogElement>(null)
  const campoDoNome = useRef<HTMLInputElement>(null)
  // O "ao abrir" roda uma vez só (o StrictMode do React roda os efeitos duas vezes; a ref fica).
  const jaAbriu = useRef(false)
  // D11: a técnica de antes abre convertida (lida uma vez, ao abrir; a arma e o item abrem como estão).
  const [abertura] = useState<AberturaDoEditor>(() => (naTecnica ? aberturaDoEditor(cartao, quemEdita, ficha, abaDoCartao ?? ABA_DAS_TECNICAS) : { cartao, ficouNoTexto: null }))
  const [rascunho, setRascunho] = useState<MecanicaV1 | null>(() => mecanicaQueAbre(abertura.cartao, quemEdita))
  const [tambemNoCatalogo, setTambemNoCatalogo] = useState(false)
  const [pilha, setPilha] = useState<readonly Passo[]>([])
  const ultimoPasso = useRef(0)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [escolhendoModelo, setEscolhendoModelo] = useState(false)
  const [brilho, setBrilho] = useState<{ linha: IdDaLinha; vez: number } | null>(null)
  // A ficha chega montada a cada render da janela de trás; fixa, o papel e o Testar só refazem quando ela muda de verdade.
  const fichaFixa = useMemo<FichaDaPrevia>(() => ({ personagem: ficha.personagem, sistema: ficha.sistema }), [ficha.personagem, ficha.sistema])

  // O papel, o mapa e o Testar seguem um passo atrás da digitação (EDITOR.md §5, "Fluidez").
  const naTela = useMemo(() => cartaoDaTela(cartao, rascunho, fichaFixa, doQue), [cartao, rascunho, fichaFixa, doQue])
  const telaAdiada = useDeferredValue(naTela)
  const mecanicaAdiada = useDeferredValue(rascunho)

  useEffect(() => {
    const aberta = janela.current
    if (aberta === null) return
    const quemAbriu = document.activeElement instanceof HTMLElement ? document.activeElement : null
    aberta.showModal()
    return () => {
      aberta.close()
      quemAbriu?.focus()
    }
  }, [])

  useEffect(() => {
    if (aviso === null) return
    const relogio = window.setTimeout(() => setAviso(aviso.saindo ? null : { ...aviso, saindo: true }), aviso.saindo ? SAIDA_DO_AVISO_MS : AVISO_MS)
    return () => window.clearTimeout(relogio)
  }, [aviso])

  const avisar = (texto: string, comDesfazer: boolean) => setAviso({ texto, comDesfazer, saindo: false, vez: performance.now() })

  /** O passo de agora vai para a pilha: `novo` sempre; `junta` só depois de uma pausa (digitar vira um passo só). */
  const guardarPasso = (passo: 'novo' | 'junta') => {
    const agora = performance.now()
    if (passo === 'novo' || agora - ultimoPasso.current > JUNTAR_MS) setPilha((antes) => [...antes.slice(-(PILHA_MAX - 1)), { cartao, rascunho }])
    ultimoPasso.current = passo === 'novo' ? 0 : agora
  }

  /**
   * O cartão com a mecânica do rascunho; `null` = não muda (peça pela metade fica só aqui). O mestre
   * leva junto os campos de texto que a mecânica diz (EDITOR.md §3.4).
   */
  const cartaoComRascunho = (nova: MecanicaV1 | null): CartaoDaFicha | null => {
    const proximo = cartaoComAMecanica(cartao, nova, quemEdita, fichaFixa, doQue)
    return proximo === null ? null : comTextoGerado(proximo)
  }

  /** O mestre leva os campos de texto que a mecânica diz: os da técnica, o Efeito da arma; o item não tem campo de texto. */
  const comTextoGerado = (proximo: CartaoDaFicha): CartaoDaFicha => {
    if (quemEdita !== 'mestre' || doQue === 'item') return proximo
    return cartaoComTextoGerado(cartao, proximo, fichaFixa.sistema, doQue === 'arma' ? 'arma' : 'tecnica')
  }

  /** `novo`: um passo próprio no Ctrl+Z (modelo, categoria que tira peças); `junta`: cola no passo de agora há pouco. */
  const mudar = (nova: MecanicaV1 | null, passo: 'novo' | 'junta', textoDoAviso?: string) => {
    guardarPasso(passo)
    setRascunho(nova)
    const proximo = cartaoComRascunho(nova)
    if (proximo !== null) onChange(proximo)
    if (textoDoAviso !== undefined) avisar(textoDoAviso, true)
  }
  const mudarNaLinha: MudarNoEditor = (nova, textoDoAviso) => mudar(nova, textoDoAviso === undefined ? 'junta' : 'novo', textoDoAviso)
  /** O que muda fora da mecânica (nome, requisitos, evolução, extras): digitar junta num passo só. */
  const mudarCartao = (proximo: CartaoDaFicha) => {
    guardarPasso('junta')
    onChange(proximo)
  }

  const desfazer = () => {
    const anterior = pilha.at(-1)
    if (anterior === undefined) {
      avisar('Nada para desfazer.', false)
      return
    }
    setPilha((antes) => antes.slice(0, -1))
    ultimoPasso.current = 0
    setRascunho(anterior.rascunho)
    onChange(anterior.cartao)
    avisar(anterior.rascunho === null && rascunho !== null && naTecnica ? 'Desfeito: a habilidade voltou ao texto de antes.' : 'Desfeito.', false)
  }

  const aplicarModelo = (modelo: ModeloNoEditor) => {
    setEscolhendoModelo(false)
    onModelo?.(modelo)
    const preencheu = !naTecnica ? 'confira cada linha. Os requisitos ficaram.' : modelo.familia === undefined ? 'preencheu Ação, Alcance, Dano, Acerto, Efeitos e Custo. Nome, descrição e requisitos ficaram.' : 'trouxe a Ação, as peças e o custo do exemplo. Nome, descrição e requisitos ficaram.'
    mudar(modelo.montar(fichaFixa, cartao), 'novo', `Modelo ${modelo.nome}: ${preencheu}`)
  }

  /** O Salvar da técnica: cada mudança completa já foi ao cartão; aqui vai também ao catálogo, se marcado, e o editor fecha. */
  const salvar = () => {
    if (problema !== null) {
      avisar(`Ainda não salva: ${problema}.`, false)
      return
    }
    if (tambemNoCatalogo && guardarNoCatalogo !== undefined) guardarNoCatalogo(cartao)
    onFechar()
  }
  /** ED7: a arma e o item não têm texto de antes; tirar é voltar ao dano da arma (ou ao item só de descrição). */
  const tirar = () => {
    if (textos !== null) mudar(null, 'novo', textos.tirou)
  }

  /** O que muda fora da mecânica com um passo próprio no Ctrl+Z e o aviso (Conferida, o medidor que sai). */
  const mudarCartaoComAviso = (proximo: CartaoDaFicha, aviso?: string) => {
    guardarPasso(aviso === undefined ? 'junta' : 'novo')
    onChange(proximo)
    if (aviso !== undefined) avisar(aviso, true)
  }

  /** O mestre decide a proposta do dono: aceita = vira a mecânica, com o texto gerado; recusa = a proposta sai. */
  const decidirProposta = (aceitar: boolean) => {
    const { mecanicaProposta: _fora, ...semProposta } = cartao
    const proposta = lerMecanica(cartao.mecanicaProposta)
    guardarPasso('novo')
    if (!aceitar || proposta.tipo !== 'pecas') {
      onChange(semProposta)
      return
    }
    setRascunho(proposta.mecanica)
    onChange(comTextoGerado({ ...semProposta, mecanica: guardarMecanica(proposta.mecanica) }))
    avisar('Proposta aceita: vale depois que você salvar a ficha.', true)
  }

  useEffect(() => {
    // Depois do showModal (o efeito de cima): o "Começar de um modelo" é outra janela, e precisa abrir por cima desta.
    if (jaAbriu.current) return
    jaAbriu.current = true
    // D11: o mestre leva a conversão ao cartão (a ficha grava quando ele salvar); o Ctrl+Z volta ao texto de antes.
    if (quemEdita === 'mestre' && abertura.cartao !== cartao) {
      setPilha([{ cartao, rascunho: null }])
      onChange(abertura.cartao)
      avisar('Convertida do texto de antes: confira as linhas e peças. O texto de antes ficou guardado.', true)
    }
    if (aoAbrir === 'modelo') setEscolhendoModelo(true)
    else if (aoAbrir !== 'nome') return
    else {
      campoDoNome.current?.focus()
      campoDoNome.current?.select()
    }
    // Só ao abrir: o que a ação lê é o cartão de quando o editor abriu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** O pedaço da frase leva à linha dele: rola até ela, acende o brilho e põe o foco no primeiro controle. */
  const irPara = useCallback(
    (linha: IdDaLinha, porTeclado: boolean) => {
      const alvo = document.getElementById(ancoraDaLinha(prefixo, linha))
      if (alvo === null) return
      // Pelo teclado (Enter no pedaço) a rolagem é na hora, como com movimento reduzido.
      const reduzido = porTeclado || window.matchMedia('(prefers-reduced-motion: reduce)').matches
      alvo.scrollIntoView({ block: 'start', behavior: reduzido ? 'auto' : 'smooth' })
      setBrilho((antes) => ({ linha, vez: (antes === null ? 0 : antes.vez) + 1 }))
      const primeiro = alvo.querySelector('input:checked:not(:disabled)') ?? alvo.querySelector('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]')
      if (primeiro instanceof HTMLElement) primeiro.focus({ preventScroll: true })
    },
    [prefixo],
  )

  const aoTeclar = (evento: KeyboardEvent<HTMLDialogElement>) => {
    // As teclas do editor não sobem para a janela da ficha atrás dele (o Esc e o Tab dela).
    evento.stopPropagation()
    if (escolhendoModelo) return
    const comCtrl = (evento.ctrlKey || evento.metaKey) && !evento.shiftKey && !evento.altKey
    // Ctrl+S salva a técnica de qualquer lugar do editor (também de dentro de um campo: não conflita com escrever).
    if (comCtrl && naTecnica && evento.key.toLowerCase() === 's') {
      evento.preventDefault()
      salvar()
      return
    }
    const ctrlZ = comCtrl && evento.key.toLowerCase() === 'z'
    if (!ctrlZ || digitando(evento.target)) return
    evento.preventDefault()
    desfazer()
  }

  const fontes = useMemo(() => fontesDaFicha(fichaFixa.personagem, fichaFixa.sistema, tecnicas, cartao.id), [fichaFixa, tecnicas, cartao.id])
  const listas = useMemo(() => listasDaFicha(fichaFixa.personagem), [fichaFixa.personagem])
  const custoEmSp = useMemo(() => {
    const custo = leituraDaTecnica(telaAdiada, fichaFixa).custo
    return custo.tipo === 'valor' && custo.recurso === 'sp' ? custo.valor : 0
  }, [telaAdiada, fichaFixa])

  const proposta = quemEdita === 'mestre' && cartao.mecanicaProposta !== undefined ? lerMecanica(cartao.mecanicaProposta) : null
  const lida = lerMecanica(quemEdita === 'dono' && cartao.mecanicaProposta !== undefined ? cartao.mecanicaProposta : cartao.mecanica)
  const futura = lida.tipo === 'futura'
  const categoria = rascunho === null ? null : categoriaDaMecanica(rascunho)
  const ataque = categoria === 'simples' || categoria === 'completo' || categoria === 'overload'
  const naVez = rascunho !== null && rascunho.uso !== 'reacao'
  const problema = rascunho === null ? null : problemaNoEditor(rascunho, fichaFixa, doQue)
  // Rework (D6, D7, decisão 9): a passiva, o "Ligar e manter" e a forma Overload não batem: sem Golpe, Alcance, Dano nem Acerto.
  const semGolpe = naTecnica && rascunho !== null && semGolpeNaTela(rascunho)
  // O Golpe é do ataque: a técnica de ataque e a arma (que sempre ataca); o item não tem tipo de golpe.
  const comGolpe = doQue === 'arma' || (naTecnica && ataque && !semGolpe)
  // D12: o tamanho da mecânica na tela (o editor não grava acima do teto).
  const tamanho = mecanicaAdiada === null ? null : tamanhoDaMecanica(mecanicaAdiada)
  const ficouNoTexto = rascunho !== null ? null : (abertura.ficouNoTexto ?? relatorio?.find((linha) => linha.cartaoId === cartao.id && linha.resultado === 'noTexto')?.porque ?? null)
  // O item paga com ele mesmo: a linha Custo só aparece se as peças já têm custo ou limite (para dar para tirar).
  const comCusto = doQue !== 'item' || (rascunho !== null && (rascunho.custos.length > 0 || Object.keys(rascunho.limite).length > 0))
  const daFicha = naTecnica && !foraDaFicha
  const brilhoDe = (linha: IdDaLinha) => (brilho !== null && brilho.linha === linha ? brilho.vez : 0)
  const abrirModelos = () => setEscolhendoModelo(true)

  return createPortal(
    <dialog
      ref={janela}
      className="lb-ed"
      // O papel explícito: as janelas do app reconhecem uma camada por cima pelo [role="dialog"] (o Esc da ficha atrás não dispara).
      role="dialog"
      aria-labelledby={tituloId}
      onKeyDown={aoTeclar}
      onCancel={(evento) => {
        evento.preventDefault()
        onFechar()
      }}
    >
      <header className="lb-ed__cab">
        <h2 className="lb-ed__tit" id={tituloId}>
          {textos === null ? 'Editor da habilidade' : textos.titulo}
        </h2>
        <span className="lb-ed__trilha">
          {naTecnica ? ficha.personagem.nome : cartao.nome.trim() || 'Sem nome'} · {trilha ?? (quemEdita === 'dono' ? 'vai ao mestre quando você salvar a ficha' : 'entra no cartão; o Salvar da ficha grava')}
        </span>
        <div className="lb-ed__cab-acoes">
          <button type="button" className="lb-ed__bt lb-ed__bt--latao" disabled={futura} onClick={abrirModelos}>
            <svg className="lb-ed__ic" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <path d="M11.5 9v5M9 11.5h5" />
            </svg>
            Começar de um modelo
          </button>
          {quemEdita === 'mestre' && cartao.mecanica !== undefined && textos !== null && (
            <button type="button" className="lb-ed__bt lb-ed__bt--fantasma" onClick={tirar}>
              {textos.tirar}
            </button>
          )}
          <button type="button" className="lb-ed__bt lb-ed__bt--fantasma" disabled={pilha.length === 0} aria-keyshortcuts="Control+Z" title="Ctrl+Z" onClick={desfazer}>
            Desfazer
          </button>
          {naTecnica ? (
            <>
              <button type="button" className="lb-ed__bt lb-ed__bt--fantasma" title="Fecha com a última versão completa (o Salvar da ficha grava)" onClick={onFechar}>
                Fechar
              </button>
              {guardarNoCatalogo !== undefined && !foraDaFicha && (
                <label className="lb-ed__tambem" htmlFor={tambemId}>
                  <input id={tambemId} type="checkbox" checked={tambemNoCatalogo} onChange={(evento) => setTambemNoCatalogo(evento.target.checked)} />
                  Guardar também no catálogo do livro
                </label>
              )}
              <button type="button" className="lb-ed__bt lb-ed__bt--primario" aria-keyshortcuts="Control+S" disabled={problema !== null} title={problema === null ? 'Ctrl+S' : `Ainda não salva: ${problema}`} onClick={salvar}>
                {foraDaFicha ? 'Salvar no catálogo' : 'Salvar na ficha'} <kbd className="lb-ed__kbd">Ctrl S</kbd>
              </button>
            </>
          ) : (
            <button type="button" className="lb-ed__bt lb-ed__bt--primario" onClick={onFechar}>
              Voltar à ficha
            </button>
          )}
        </div>
      </header>

      <div className="lb-ed__corpo">
        <div className="lb-ed__editor">
          {naTecnica && (
            <TopoDaHabilidade cartao={cartao} onChange={mudarCartaoComAviso} campoDoNome={campoDoNome} comImagem={!foraDaFicha} sugestoesDeMarca={listas.marcas} ficouNoTexto={ficouNoTexto} />
          )}

          {proposta !== null && (
            <div className="lb-ed__proposta" role="group" aria-label="Proposta do dono da ficha">
              <p>
                {proposta.tipo === 'pecas' ? 'O dono da ficha propôs uma mecânica para esta técnica. Ela só vale depois que você aceitar e salvar a ficha.' : `O dono da ficha propôs uma mecânica que não se lê aqui${proposta.tipo === 'nenhuma' ? '' : `: ${avisoDaMecanica(proposta)}`}`}
              </p>
              <div className="lb-ed__linha-acoes">
                <button type="button" className="lb-ed__bt lb-ed__bt--primario lb-ed__bt--p" disabled={proposta.tipo !== 'pecas'} onClick={() => decidirProposta(true)}>
                  Aceitar a proposta
                </button>
                <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p" onClick={() => decidirProposta(false)}>
                  Recusar
                </button>
              </div>
            </div>
          )}

          {(lida.tipo === 'futura' || lida.tipo === 'invalida') && (
            <p className="lb-ed__alerta" role="note">
              {avisoDaMecanica(lida)}
              {lida.tipo === 'invalida' && ' Um modelo troca a mecânica que não se lê.'}
            </p>
          )}

          <BlocoSemCaixa.Provider value={true}>
            {rascunho === null && textos !== null ? (
              <Linha prefixo={prefixo} linha="acao" nome="O que faz" dica="ainda sem peças" brilho={brilhoDe('acao')}>
                <p className="lb-ed__vazio">{textos.semNada}</p>
                {!futura && (
                  <div className="lb-ed__linha-acoes">
                    <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--p" onClick={abrirModelos}>
                      Começar de um modelo
                    </button>
                  </div>
                )}
              </Linha>
            ) : rascunho === null ? (
              // D14: a técnica que a conversão não montou (ou a de regra escrita à mão no app) começa de um modelo.
              <Linha prefixo={prefixo} linha="acao" nome="O que faz" dica="ainda sem peças" brilho={brilhoDe('acao')}>
                <p className="lb-ed__vazio">Ainda sem peças: a batalha lê o texto de antes (a Ação, o Custo e o Dano escritos no cartão). Comece de um modelo e ajuste; o texto de antes fica guardado em Campos extras.</p>
                {!futura && (
                  <div className="lb-ed__linha-acoes">
                    <button type="button" className="lb-ed__bt lb-ed__bt--primario lb-ed__bt--p" onClick={abrirModelos}>
                      Começar de um modelo
                    </button>
                  </div>
                )}
              </Linha>
            ) : (
              <>
                <Linha prefixo={prefixo} linha="acao" nome="Ação" dica={naTecnica ? 'o que é e o que gasta' : doQue === 'arma' ? 'que ação o Atacar gasta' : 'que ação usar gasta'} brilho={brilhoDe('acao')}>
                  {naTecnica ? (
                    <LinhaDaAcao mecanica={rascunho} onChange={mudarNaLinha} />
                  ) : (
                    <Escolha legenda="A ação" opcoes={doQue === 'arma' ? ACOES_DA_ARMA : ACOES} valor={rascunho.acao} onChange={(acao) => mudarNaLinha({ ...rascunho, acao })} />
                  )}
                </Linha>
                {comGolpe && (
                  <Linha prefixo={prefixo} linha="golpe" nome="Golpe" dica="que tipo de golpe é" brilho={brilhoDe('golpe')}>
                    <LinhaDoGolpe mecanica={rascunho} ficha={fichaFixa} onChange={mudarNaLinha} />
                  </Linha>
                )}
                {naVez && !semGolpe && (
                  <Linha prefixo={prefixo} linha="alcance" nome="Alcance" dica={categoria === 'apoio' ? 'em quem ajuda' : 'onde pega'} brilho={brilhoDe('alcance')}>
                    <LinhaDoAlcance mecanica={rascunho} naArma={doQue === 'arma'} onChange={mudarNaLinha} />
                  </Linha>
                )}
                {((naVez && categoria !== 'apoio' && !semGolpe) || rascunho.dano !== undefined) && (
                  <Linha prefixo={prefixo} linha="dano" nome="Dano" dica="quanto tira" brilho={brilhoDe('dano')}>
                    <LinhaDoDano mecanica={rascunho} cartao={cartao} ficha={fichaFixa} naArma={doQue === 'arma'} onChange={mudarNaLinha} />
                  </Linha>
                )}
                {!semGolpe && (
                  <Linha prefixo={prefixo} linha="acerto" nome={rascunho.uso === 'reacao' ? 'Defesa' : 'Acerto'} dica={rascunho.uso === 'reacao' ? 'o que faz no lugar da reação' : 'como o golpe pega'} brilho={brilhoDe('acerto')}>
                    <LinhaDoAcerto mecanica={rascunho} ficha={fichaFixa} onChange={mudarNaLinha} />
                  </Linha>
                )}
                {naTecnica && (
                  <Linha prefixo={prefixo} linha="pecas" nome="Mecânicas" dica="peças que mudam a regra" brilho={brilhoDe('pecas')}>
                    <PecasDaHabilidade
                      mecanica={rascunho}
                      cartao={cartao}
                      personagem={fichaFixa.personagem}
                      sistema={fichaFixa.sistema}
                      onMudar={mudarNaLinha}
                      onMudarCartao={mudarCartaoComAviso}
                      {...(aoMudarOutroCartao === undefined || foraDaFicha ? {} : { onMudarOutroCartao: aoMudarOutroCartao })}
                      prefixo={prefixo}
                    />
                  </Linha>
                )}
                {(!semGolpe || rascunho.efeitos.length > 0) && (
                  <Linha prefixo={prefixo} linha="efeitos" nome="Efeitos" dica={categoria === 'apoio' ? 'o que faz no aliado' : 'o que mais faz'} brilho={brilhoDe('efeitos')}>
                    <LinhaDosEfeitos mecanica={rascunho} cartao={cartao} ficha={fichaFixa} comAcumulador={naTecnica} onChange={mudarNaLinha} />
                  </Linha>
                )}
                {comCusto && (
                  <Linha prefixo={prefixo} linha="custo" nome={doQue === 'arma' ? 'Custo e usos' : 'Custo'} dica={doQue === 'arma' ? 'o que gasta e quantas vezes por batalha' : doQue === 'item' ? 'o que gasta além do item' : 'o que gasta e quando volta'} brilho={brilhoDe('custo')}>
                    <LinhaDoCusto mecanica={rascunho} onChange={mudarNaLinha} />
                  </Linha>
                )}
              </>
            )}
            {gastoDoItem !== undefined && rascunho !== null && (
              <Linha prefixo={prefixo} linha="gasto" nome="Gasto" dica="quanto gasta e onde vale" brilho={brilhoDe('gasto')}>
                <LinhaDoGasto gasto={gastoDoItem.gasto} onChange={gastoDoItem.onChange} />
              </Linha>
            )}
            <Linha prefixo={prefixo} linha="requisitos" nome="Requisitos" dica="o que precisa para usar" brilho={brilhoDe('requisitos')}>
              <LinhaDosRequisitos cartao={cartao} personagem={fichaFixa.personagem} fontes={fontes} listas={listas} custoEmSp={custoEmSp} onChange={mudarCartao} comMarcas={doQue !== 'item' && !naTecnica} {...(textos === null ? {} : { vazio: textos.semRequisito })} />
            </Linha>
            {daFicha && (
              <Linha prefixo={prefixo} linha="evolucao" nome="Evolução" dica="vira outra versão" brilho={brilhoDe('evolucao')}>
                <LinhaDaEvolucao cartao={cartao} tecnicas={tecnicas} personagem={fichaFixa.personagem} fontes={fontes} listas={listas} custoEmSp={custoEmSp} onChange={mudarCartao} />
              </Linha>
            )}
            {daFicha && podeOcultar && (
              <Linha prefixo={prefixo} linha="jogadores" nome="Jogadores" dica="o que eles veem" brilho={brilhoDe('jogadores')}>
                <OcultaNoCartao cartao={cartao} onChange={mudarCartao} />
              </Linha>
            )}
            {daFicha && (
              <Linha prefixo={prefixo} linha="campos" nome="Campos extras" dica="anotações do cartão" brilho={brilhoDe('campos')}>
                <LinhaDosCampos cartao={cartao} onChange={mudarCartao} />
              </Linha>
            )}
          </BlocoSemCaixa.Provider>
        </div>

        <aside className="lb-ed__ver" aria-label="Como fica, alcance e teste">
          {problema !== null && (
            <p className="lb-ed__problema" role="status">
              {quemEdita === 'dono' ? 'Ainda não vai ao mestre' : 'Ainda não vale na batalha'}: {problema}. Até completar, a ficha guarda a última versão completa.
            </p>
          )}
          <ColunaDoPapel cartao={telaAdiada} mecanica={mecanicaAdiada} ficha={fichaFixa} prefixo={prefixo} onIr={irPara} doQue={doQue} {...(gastoDoItem === undefined ? {} : { gastoDoItem: gastoDoItem.gasto })} />
          {naTecnica && tamanho !== null && (
            <p className="lb-ed__tamanho" data-passou={tamanho > TAMANHO_DA_MECANICA_MAX ? '' : undefined}>
              Tamanho da mecânica: {tamanho.toLocaleString('pt-BR')} de {TAMANHO_DA_MECANICA_MAX.toLocaleString('pt-BR')} letras
            </p>
          )}
        </aside>
      </div>

      <div className="lb-ed__avisos" role="status" aria-live="polite">
        {aviso !== null && (
          <div key={aviso.vez} className="lb-ed__aviso" data-saindo={aviso.saindo ? '' : undefined}>
            <span>{aviso.texto}</span>
            {aviso.comDesfazer && (
              <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--p" onClick={desfazer}>
                Desfazer
              </button>
            )}
          </div>
        )}
      </div>

      {escolhendoModelo && <ComecarDeUmModelo ficha={fichaFixa} doQue={doQue} onEscolher={aplicarModelo} onFechar={() => setEscolhendoModelo(false)} />}
    </dialog>,
    document.body,
  )
}
