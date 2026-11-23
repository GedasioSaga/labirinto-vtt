import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { categoriaDaMecanica, tipoNaBatalha } from '../../../lib/batalha/mecanica/categoria'
import { modeloDoTexto } from '../../../lib/batalha/mecanica/doTexto'
import { avisoDaMecanica, lerMecanica, type MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import { guardarMecanica, MODELOS_PRONTOS, mecanicaDoModeloNoCartao } from '../../../lib/batalha/mecanica/modelos'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { camposGeradosDaAba, cartaoComTextoGerado, desmontarCartao } from '../../../lib/batalha/mecanica/textoGerado'
import { ABA_DAS_TECNICAS } from '../../../lib/batalha/leituraDaFicha'
import { leituraDaTecnica } from '../../../lib/batalha/leituraDaTecnica'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { abaDoSistema } from '../../../lib/sistemaDeRpg'
import { ACOES } from '../blocos/BlocosDoComeco'
import { BlocoSemCaixa, Escolha } from '../blocos/controles'
import { OcultaNoCartao } from '../HabilidadeOculta'
import { ColunaDoPapel } from './ColunaDoPapel'
import { ComecarDeUmModelo } from './ComecarDeUmModelo'
import type { IdDaLinha } from './fraseDoPapel'
import { cartaoComAMecanica, cartaoDaTela, mecanicaQueAbre, problemaNoEditor, type DoQueNoEditor, type QuemEditaNoEditor } from './gravarNoCartao'
import { ancoraDaLinha, Linha } from './Linha'
import { LinhaDaAcao } from './linhas/LinhaDaAcao'
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
import { fontesDaFicha, listasDaFicha } from './requisitosDoCartao'
import './editor.css'

/** Quantos passos o Ctrl+Z guarda. */
const PILHA_MAX = 50
/** Mudanças seguidas dentro desta janela (digitar a fórmula, as setas num número) viram um passo só do Ctrl+Z. */
const JUNTAR_MS = 800
/** Quanto o aviso fica embaixo antes de sumir sozinho. */
const AVISO_MS = 6000
/** A saída do aviso (mais rápida que a entrada, 200 ms no CSS). */
const SAIDA_DO_AVISO_MS = 150

/** Um passo do Ctrl+Z: o cartão inteiro (requisitos, extras, Montar e Desmontar voltam iguais) e o rascunho. */
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
  /** O botão que tira a mecânica (a técnica tem o Desmontar, com o texto de antes). */
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
 * O que o editor faz assim que abre: `montar` = o "Montar no editor" do cartão de texto (o mesmo
 * "Montar a partir do texto", com o Ctrl+Z); `modelo` = abre o "Começar de um modelo"; `nome` = a
 * habilidade que acabou de nascer em branco, com o foco no Nome para já escrever.
 */
export type AoAbrirOEditor = 'montar' | 'modelo' | 'nome'

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
export function EditorDaHabilidade({ cartao, ficha, quemEdita, onChange, onFechar, tecnicas, podeOcultar, doQue = 'tecnica', foraDaFicha = false, trilha, gastoDoItem, onModelo, aoAbrir }: EditorDaHabilidadeProps) {
  const naTecnica = doQue === 'tecnica'
  const textos = doQue === 'tecnica' ? null : TEXTOS[doQue]
  const prefixo = useId()
  const tituloId = useId()
  const nomeId = useId()
  const descricaoId = useId()
  const janela = useRef<HTMLDialogElement>(null)
  const campoDoNome = useRef<HTMLInputElement>(null)
  // O "ao abrir" roda uma vez só (o StrictMode do React roda os efeitos duas vezes; a ref fica).
  const jaAbriu = useRef(false)
  const [rascunho, setRascunho] = useState<MecanicaV1 | null>(() => mecanicaQueAbre(cartao, quemEdita))
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
    avisar(anterior.rascunho === null && rascunho !== null && naTecnica ? 'Desfeito: a técnica voltou a ser só texto.' : 'Desfeito.', false)
  }

  const aplicarModelo = (modelo: ModeloNoEditor) => {
    setEscolhendoModelo(false)
    onModelo?.(modelo)
    const preencheu = naTecnica ? 'preencheu Ação, Alcance, Dano, Acerto, Efeitos e Custo. Nome, descrição e requisitos ficaram.' : 'confira cada linha. Os requisitos ficaram.'
    mudar(modelo.montar(fichaFixa, cartao), 'novo', `Modelo ${modelo.nome}: ${preencheu}`)
  }
  /** ED7: a arma e o item não têm texto de antes; tirar é voltar ao dano da arma (ou ao item só de descrição). */
  const tirar = () => {
    if (textos !== null) mudar(null, 'novo', textos.tirou)
  }

  /** Montar a partir do texto (EDITOR.md §3.5): o modelo que o texto pede, com o custo, a ação e o dano escritos. */
  const montarDoTexto = () => {
    const id = modeloDoTexto(cartao)
    if (id === null) {
      avisar('Técnica passiva: fica no texto. A batalha não usa passiva; o mestre aplica o que ela faz.', false)
      return
    }
    const nome = MODELOS_PRONTOS.find((modelo) => modelo.id === id)?.nome ?? id
    const guardado = quemEdita === 'mestre' ? ' O texto de antes ficou guardado e volta no Desmontar.' : ''
    mudar(mecanicaDoModeloNoCartao(id, fichaFixa, cartao), 'novo', `Montada como ${nome}: confira cada linha.${guardado}`)
  }

  /** Desmontar (§3.5, só o mestre): a mecânica sai e o texto de antes volta aos campos. A proposta do dono fica. */
  const desmontar = () => {
    guardarPasso('novo')
    setRascunho(null)
    onChange(desmontarCartao(cartao, fichaFixa.sistema))
    avisar('Desmontada: a técnica voltou a ser só texto, com o texto de antes.', true)
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
    if (aoAbrir === undefined || jaAbriu.current) return
    jaAbriu.current = true
    if (aoAbrir === 'modelo') setEscolhendoModelo(true)
    else if (aoAbrir === 'montar') montarDoTexto()
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
    const ctrlZ = (evento.ctrlKey || evento.metaKey) && !evento.shiftKey && !evento.altKey && evento.key.toLowerCase() === 'z'
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
  const camposDeTexto = useMemo(() => {
    const ids: ReadonlySet<string> = new Set(camposGeradosDaAba(fichaFixa.sistema))
    return (abaDoSistema(fichaFixa.sistema, ABA_DAS_TECNICAS)?.campos ?? []).filter((campo) => ids.has(campo.id))
  }, [fichaFixa.sistema])

  const proposta = quemEdita === 'mestre' && cartao.mecanicaProposta !== undefined ? lerMecanica(cartao.mecanicaProposta) : null
  const lida = lerMecanica(quemEdita === 'dono' && cartao.mecanicaProposta !== undefined ? cartao.mecanicaProposta : cartao.mecanica)
  const futura = lida.tipo === 'futura'
  const categoria = rascunho === null ? null : categoriaDaMecanica(rascunho)
  const ataque = categoria === 'simples' || categoria === 'completo' || categoria === 'overload'
  const naVez = rascunho !== null && rascunho.uso !== 'reacao'
  const problema = rascunho === null ? null : problemaNoEditor(rascunho, fichaFixa, doQue)
  // O Golpe é do ataque: a técnica de ataque e a arma (que sempre ataca); o item não tem tipo de golpe.
  const comGolpe = doQue === 'arma' || (naTecnica && ataque)
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
          {quemEdita === 'mestre' && cartao.mecanica !== undefined && naTecnica && (
            <button type="button" className="lb-ed__bt lb-ed__bt--fantasma" title="A mecânica sai e o texto de antes volta aos campos" onClick={desmontar}>
              Desmontar
            </button>
          )}
          {quemEdita === 'mestre' && cartao.mecanica !== undefined && textos !== null && (
            <button type="button" className="lb-ed__bt lb-ed__bt--fantasma" onClick={tirar}>
              {textos.tirar}
            </button>
          )}
          <button type="button" className="lb-ed__bt lb-ed__bt--fantasma" disabled={pilha.length === 0} aria-keyshortcuts="Control+Z" title="Ctrl+Z" onClick={desfazer}>
            Desfazer
          </button>
          <button type="button" className="lb-ed__bt lb-ed__bt--primario" onClick={onFechar}>
            Voltar à ficha
          </button>
        </div>
      </header>

      <div className="lb-ed__corpo">
        <div className="lb-ed__editor">
          {naTecnica && (
            <div className="lb-ed__topo">
              <div className="lb-ed__campo">
                <label htmlFor={nomeId}>Nome</label>
                <input ref={campoDoNome} id={nomeId} className="lb-ed__entrada lb-ed__entrada--nome" value={cartao.nome} placeholder="Nome da habilidade" onChange={(evento) => mudarCartao({ ...cartao, nome: evento.target.value })} />
              </div>
              <div className="lb-ed__campo lb-ed__campo--tipo">
                <span className="lb-ed__rot">Tipo na batalha</span>
                <span className="lb-ed__etq" title="Sai das escolhas abaixo; não é mais um campo à parte">
                  {rascunho === null ? 'pelo texto' : tipoNaBatalha(rascunho)}
                </span>
              </div>
              <div className="lb-ed__campo lb-ed__campo--desc">
                <label htmlFor={descricaoId}>
                  Descrição <span className="lb-ed__dica">como o golpe é, com suas palavras (só para ler; o app não lê)</span>
                </label>
                <textarea id={descricaoId} className="lb-ed__entrada" rows={2} value={cartao.campos.descricao ?? ''} placeholder="Ex.: uma flecha de fogo que corta o céu" onChange={(evento) => mudarCartao({ ...cartao, campos: { ...cartao.campos, descricao: evento.target.value } })} />
              </div>
            </div>
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
              <>
                <Linha prefixo={prefixo} linha="acao" nome="Montar" dica="a técnica ainda é só texto" brilho={brilhoDe('acao')}>
                  <p className="lb-ed__vazio">Esta técnica é só texto: a batalha lê a Ação, o Custo e o Dano escritos no cartão. Monte as peças a partir do que está escrito, ou comece de um modelo. O texto de agora fica guardado; o Desmontar o põe de volta.</p>
                  {!futura && (
                    <div className="lb-ed__linha-acoes">
                      <button type="button" className="lb-ed__bt lb-ed__bt--primario lb-ed__bt--p" onClick={montarDoTexto}>
                        Montar a partir do texto
                      </button>
                      <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--p" onClick={abrirModelos}>
                        Começar de um modelo
                      </button>
                    </div>
                  )}
                </Linha>
                {camposDeTexto.length > 0 && (
                  <Linha prefixo={prefixo} linha="textos" nome="Texto" dica="o que a batalha lê, escrito" brilho={brilhoDe('textos')}>
                    <div className="lb-ed__textos-editaveis">
                      {camposDeTexto.map((campo) => (
                        <label key={campo.id} className="lb-ed__campo">
                          <span>{campo.rotulo}</span>
                          {campo.forma === 'paragrafo' ? (
                            <textarea className="lb-ed__entrada" rows={2} value={cartao.campos[campo.id] ?? ''} onChange={(evento) => mudarCartao({ ...cartao, campos: { ...cartao.campos, [campo.id]: evento.target.value } })} />
                          ) : (
                            <input className="lb-ed__entrada" value={cartao.campos[campo.id] ?? ''} onChange={(evento) => mudarCartao({ ...cartao, campos: { ...cartao.campos, [campo.id]: evento.target.value } })} />
                          )}
                        </label>
                      ))}
                    </div>
                  </Linha>
                )}
              </>
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
                {naVez && (
                  <Linha prefixo={prefixo} linha="alcance" nome="Alcance" dica={categoria === 'apoio' ? 'em quem ajuda' : 'onde pega'} brilho={brilhoDe('alcance')}>
                    <LinhaDoAlcance mecanica={rascunho} naArma={doQue === 'arma'} onChange={mudarNaLinha} />
                  </Linha>
                )}
                {((naVez && categoria !== 'apoio') || rascunho.dano !== undefined) && (
                  <Linha prefixo={prefixo} linha="dano" nome="Dano" dica="quanto tira" brilho={brilhoDe('dano')}>
                    <LinhaDoDano mecanica={rascunho} cartao={cartao} ficha={fichaFixa} naArma={doQue === 'arma'} onChange={mudarNaLinha} />
                  </Linha>
                )}
                <Linha prefixo={prefixo} linha="acerto" nome={rascunho.uso === 'reacao' ? 'Defesa' : 'Acerto'} dica={rascunho.uso === 'reacao' ? 'o que faz no lugar da reação' : 'como o golpe pega'} brilho={brilhoDe('acerto')}>
                  <LinhaDoAcerto mecanica={rascunho} ficha={fichaFixa} onChange={mudarNaLinha} />
                </Linha>
                <Linha prefixo={prefixo} linha="efeitos" nome="Efeitos" dica={categoria === 'apoio' ? 'o que faz no aliado' : 'o que mais faz'} brilho={brilhoDe('efeitos')}>
                  <LinhaDosEfeitos mecanica={rascunho} cartao={cartao} ficha={fichaFixa} comAcumulador={naTecnica} onChange={mudarNaLinha} />
                </Linha>
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
              <LinhaDosRequisitos cartao={cartao} personagem={fichaFixa.personagem} fontes={fontes} listas={listas} custoEmSp={custoEmSp} onChange={mudarCartao} comMarcas={doQue !== 'item'} {...(textos === null ? {} : { vazio: textos.semRequisito })} />
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
