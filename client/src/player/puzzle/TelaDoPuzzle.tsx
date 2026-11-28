/**
 * A TELA DO JOGADOR NO PUZZLE (plano `docs/design/puzzles/PLANO.md` §4, P8;
 * protótipo aprovado `prototipo-v2.html`, lado do jogador: o quadro de perto,
 * a gaveta da mochila, pôr arrastando ou tocando, tirar, sair e o cartão do
 * desfecho com Texto ou Cena).
 *
 * Recebe a vista (o recorte do host) e os acontecimentos, e devolve as ações
 * por props: não sabe de rede nem de motor. A tela não adivinha o que serve: o
 * jogador vê o que o recorte mostra, e o "não encaixa" vem do host, como recusa.
 *
 * O movimento sai da diferença entre a vista de antes e a de agora (a peça que
 * assenta, a que volta voando para a mochila) e dos acontecimentos (tremer,
 * clarão, pedestal, o cartão). Nada se move durante o arrasto a não ser o
 * fantasma e o alvo sob ele (`arrastoDaPeca.ts`).
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AcoesDaCombinacao, TecladoDoControle } from '../../puzzles/ControlesDaCombinacao'
import { QuadroDoPuzzle } from '../../puzzles/QuadroDoPuzzle'
import { tocarSomDoRelevo } from '../../puzzles/relevo/somDoRelevo'
import { TEXTO_DA_RECUSA } from '../../puzzles/tipos'
import type { AcaoNoPuzzle, EncaixeNaVista, MotivoDaRecusa, VistaDoPuzzle } from '../../puzzles/tipos'
import { IconeDoJogador } from '../IconeDoJogador'
import { useArrastoDaPeca, type AlvoNoQuadro } from './arrastoDaPeca'
import { CartaoDoDesfecho } from './CartaoDoDesfecho'
import { inicialDoNome, MochilaDoPuzzle, vagasEmOrdem } from './MochilaDoPuzzle'
import { assentar, brilhar, movimentoReduzido, pedestalDeEstalo, piscar, sacudir, tremer, voarAte } from './movimento'
import {
  avisoDoErro,
  BANDEJA_VAZIA,
  ENCAIXE_VAZIO,
  estadoDoPuzzle,
  FAIXA_DO_TESTE,
  NOTA_DAS_PECAS_DO_TESTE,
  textoDaDevolucao,
  textoDoErro,
  TITULO_DAS_PECAS_DO_TESTE,
  TITULO_SEM_NOME,
  type AvisoDoPuzzle,
} from './textos'
import type { AcontecimentoNoPuzzle, DesfechoNaTela, PvNaTela, TesteNaTela } from './tipos'
import './telaDoPuzzle.css'

export interface PropsDaTelaDoPuzzle {
  vista: VistaDoPuzzle
  /** O nome de quem joga: a peça que ele mesmo pôs não leva o "posto por". */
  eu: string
  /** Os PV dele; ausente ou `null` = sem a barra (token sem ficha). */
  pv?: PvNaTela | null
  acontecimentos: readonly AcontecimentoNoPuzzle[]
  /** `rev` é o da vista em que ele agiu: o host recusa a tela velha (`velho`). */
  onAgir: (acao: AcaoNoPuzzle, rev: number) => void
  onSair: () => void
  /** A dica está num documento que ele já leu: o botão "Ler" (`peloTeclado`: o papel abre sem animação). Ausente = sem o botão. */
  onLerDica?: (peloTeclado: boolean) => void
  /** Outra janela está por cima (o documento da dica aberto): a tela não ouve o teclado, que passa a ser dela. */
  porBaixo?: boolean
  /** Onde a tela entra (o portal). Ausente = o `body`. */
  raiz?: Element
  /** O "Testar como jogador" do editor (P9): a faixa TESTE, as peças do teste e o cartão sem entrega. `onSair` volta ao editor. */
  teste?: TesteNaTela
}

/** O tempo da saída (o fade da tela inteira). */
const SAIDA_MS = 140
/** O aviso fica isto e some sozinho (o `Torrada` do app). */
const AVISO_MS = 2600
/** O cartão com Texto vem quase junto; com movimento reduzido, quase já (os do v1). */
const CARTAO_TEXTO_MS = 260
const CARTAO_REDUZIDO_MS = 160
/** Cena com imagem própria: só o brilho dos encaixes (520 ms) e o texto (decisão 2 do plano). */
const CARTAO_CENA_SEM_ARTE_MS = 640
const CASCATA_DO_BRILHO_MS = 60
/** O painel em relevo completo ressoa depois do estalo da última placa, e não por cima dele. */
const ATRASO_DO_SOM_COMPLETO_MS = 180
/** A agulha do mostrador anda até a soma antes do pedestal responder (v1), e volta ao pedido depois. */
const SUSPENSE_DA_TROCA_MS = 400
const VOLTA_DA_AGULHA_MS = 380

type AlvoTocado = { tipo: 'encaixe'; id: string } | { tipo: 'bandeja' } | { tipo: 'pedestal' } | { tipo: 'controle' }

/** O aviso da mochila num puzzle de combinação sem troca de peso (v2). */
const NOTA_DA_COMBINACAO = 'Este puzzle não usa peças: é uma combinação.'

export function TelaDoPuzzle({ raiz, ...props }: PropsDaTelaDoPuzzle) {
  return createPortal(<Tela {...props} />, raiz ?? document.body)
}

function seletorDaVaga(vagaId: string): string {
  return `[data-vaga="${CSS.escape(vagaId)}"]`
}

function seletorDoEncaixe(encaixeId: string): string {
  return `[data-enc="${CSS.escape(encaixeId)}"]`
}

/** O motivo que a própria tela já sabe (o encaixe ocupado por outro, o resolvido); `null` = só o host decide. */
function motivoNaTela(vista: VistaDoPuzzle, alvo: AlvoNoQuadro, eu: string): MotivoDaRecusa | null {
  if (vista.versaoNova === true) return 'versao_nova'
  if (vista.resolvido) return 'resolvido'
  if (alvo.tipo === 'bandeja') {
    if (vista.troca === null) return 'mudou'
    return vista.troca.feita ? 'troca_feita' : null
  }
  const encaixe = vista.encaixes.find((e) => e.id === alvo.id)
  if (encaixe === undefined) return 'mudou'
  if (encaixe.jeito === 'metades') return (encaixe.metadesPostas ?? 0) >= 2 ? 'ocupado' : null
  // A peça dele mesmo pode ser trocada (o motor devolve a de antes); a de outra pessoa só sai pelo "tirar".
  return encaixe.posta !== null && encaixe.posta.por !== eu ? 'ocupado' : null
}

function Tela({ vista, eu, pv = null, acontecimentos, onAgir, onSair, onLerDica, porBaixo = false, teste }: Omit<PropsDaTelaDoPuzzle, 'raiz'>) {
  const ehTeste = teste !== undefined
  const idDoTitulo = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const quadro = useRef<HTMLDivElement>(null)
  const mochila = useRef<HTMLDivElement>(null)
  const botaoSair = useRef<HTMLButtonElement>(null)
  // No teste não há "Sair": a faixa tem "Recomeçar o teste" e "Voltar ao editor" (v2).
  const botaoRecomecar = useRef<HTMLButtonElement>(null)

  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [levantada, setLevantada] = useState<string | null>(null)
  const [novas, setNovas] = useState<ReadonlySet<string>>(() => new Set())
  const [aviso, setAviso] = useState<(AvisoDoPuzzle & { vez: number; visivel: boolean }) | null>(null)
  const [agulha, setAgulha] = useState<number | undefined>(undefined)
  const [desfechoPendente, setDesfechoPendente] = useState<DesfechoNaTela | null>(null)
  const [portaAbriu, setPortaAbriu] = useState(false)
  const [cartao, setCartao] = useState<DesfechoNaTela | null>(null)
  const [saindo, setSaindo] = useState(false)

  // O que a tela pediu e ainda espera ver na vista ou num acontecimento.
  const ultimoAlvo = useRef<AlvoTocado | null>(null)
  const ultimaEnviada = useRef<string | null>(null)
  const pedidoDeTirar = useRef<{ encaixe: EncaixeNaVista } | null>(null)
  const origemDoVoo = useRef<DOMRect | null>(null)
  const trocandoDesde = useRef<number | null>(null)
  const vistaAnterior = useRef(vista)
  const vagasConhecidas = useRef(new Set(vista.mochila.map((vaga) => vaga.vagaId)))
  const ultimoAcontecimento = useRef(acontecimentos.at(-1)?.id ?? 0)
  const timers = useRef(new Set<number>())
  // As setas numa roda ou num ponteiro: a tela segura o teclado inteiro e entrega estas ao controle.
  const tecladoDoControle = useRef<TecladoDoControle | null>(null)

  const depois = useCallback((ms: number, fazer: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fazer()
    }, ms)
    timers.current.add(id)
  }, [])
  useEffect(() => {
    const pendentes = timers.current
    return () => {
      for (const id of pendentes) window.clearTimeout(id)
    }
  }, [])

  const avisar = useCallback((novo: AvisoDoPuzzle) => setAviso((antes) => ({ ...novo, vez: (antes?.vez ?? 0) + 1, visivel: true })), [])
  // Some sozinho; o texto fica até o fade acabar, e um aviso novo recomeça a conta.
  const vezDoAviso = aviso?.vez
  useEffect(() => {
    if (vezDoAviso === undefined) return
    const id = window.setTimeout(() => setAviso((atual) => (atual === null ? null : { ...atual, visivel: false })), AVISO_MS)
    return () => window.clearTimeout(id)
  }, [vezDoAviso])

  const vagas = useMemo(() => vagasEmOrdem(vista.mochila), [vista.mochila])
  // A vaga escolhida que saiu da mochila (pôs a última, o host devolveu outra) não fica na mão.
  const naMao = escolhida !== null && vista.mochila.some((vaga) => vaga.vagaId === escolhida) ? escolhida : null
  const pecaNoAr = levantada ?? naMao
  const alvos = useMemo(() => {
    if (pecaNoAr === null) return undefined
    return new Set(vista.encaixes.filter((e) => motivoNaTela(vista, { tipo: 'encaixe', id: e.id }, eu) === null).map((e) => e.id))
  }, [pecaNoAr, vista, eu])
  const bandejaEhAlvo = pecaNoAr !== null && motivoNaTela(vista, { tipo: 'bandeja' }, eu) === null

  const elDoQuadro = useCallback((seletor: string) => quadro.current?.querySelector<HTMLElement>(seletor) ?? null, [])

  const agir = useCallback(
    (acao: AcaoNoPuzzle, alvo: AlvoTocado) => {
      ultimoAlvo.current = alvo
      onAgir(acao, vista.rev)
    },
    [onAgir, vista.rev],
  )

  const porNoAlvo = useCallback(
    (vagaId: string, alvo: AlvoNoQuadro) => {
      ultimaEnviada.current = vagaId
      setEscolhida(null)
      if (alvo.tipo === 'bandeja') agir({ tipo: 'porNaBandeja', vagaId }, alvo)
      else agir({ tipo: 'por', encaixeId: alvo.id, vagaId }, alvo)
    },
    [agir],
  )

  const recusarNaTela = useCallback(
    (texto: string, el: Element | null) => {
      tremer(el)
      avisar({ texto, tom: 'perigo' })
    },
    [avisar],
  )

  const arrasto = useArrastoDaPeca({
    quadro,
    raiz,
    podeSoltar: (alvo) => motivoNaTela(vista, alvo, eu) === null,
    aoLevantar: (vagaId) => {
      setEscolhida(null)
      setLevantada(vagaId)
    },
    aoSoltar: porNoAlvo,
    aoRecusar: (alvo, el) => recusarNaTela(TEXTO_DA_RECUSA[motivoNaTela(vista, alvo, eu) ?? 'nao_encaixa'], el),
    aoTerminar: () => setLevantada(null),
  })

  // ---------------------------------------------------------------- tocar

  const escolher = useCallback(
    (vagaId: string, peloTeclado: boolean) => {
      if (arrasto.acabouDeSoltar()) return
      const vai = naMao === vagaId ? null : vagaId
      setEscolhida(vai)
      setNovas((antes) => {
        if (!antes.has(vagaId)) return antes
        const sem = new Set(antes)
        sem.delete(vagaId)
        return sem
      })
      // Pelo teclado, o foco segue para o primeiro encaixe que aceita (v2).
      if (vai !== null && peloTeclado) {
        const primeiro = vista.encaixes.find((e) => motivoNaTela(vista, { tipo: 'encaixe', id: e.id }, eu) === null)
        if (primeiro !== undefined) elDoQuadro(seletorDoEncaixe(primeiro.id))?.focus()
      }
    },
    [arrasto, naMao, vista, eu, elDoQuadro],
  )

  const tocarEncaixe = useCallback(
    (encaixeId: string, botao: HTMLButtonElement) => {
      const encaixe = vista.encaixes.find((e) => e.id === encaixeId)
      if (encaixe === undefined) return
      if (vista.versaoNova === true || vista.resolvido) {
        avisar({ texto: TEXTO_DA_RECUSA[vista.resolvido ? 'resolvido' : 'versao_nova'], tom: 'neutro' })
        return
      }
      if (naMao !== null) {
        const motivo = motivoNaTela(vista, { tipo: 'encaixe', id: encaixeId }, eu)
        if (motivo !== null) recusarNaTela(TEXTO_DA_RECUSA[motivo], botao)
        else porNoAlvo(naMao, { tipo: 'encaixe', id: encaixeId })
        return
      }
      if (encaixe.posta === null) {
        avisar({ texto: ENCAIXE_VAZIO, tom: 'neutro' })
        return
      }
      // Tocar numa peça posta a devolve a quem a pôs, mesmo que seja de outra pessoa.
      pedidoDeTirar.current = { encaixe }
      origemDoVoo.current = botao.getBoundingClientRect()
      agir({ tipo: 'tirar', encaixeId }, { tipo: 'encaixe', id: encaixeId })
    },
    [vista, naMao, eu, avisar, recusarNaTela, porNoAlvo, agir],
  )

  const tocarBandeja = useCallback(
    (botao: HTMLButtonElement) => {
      const troca = vista.troca
      if (troca === null) return
      if (naMao !== null) {
        const motivo = motivoNaTela(vista, { tipo: 'bandeja' }, eu)
        if (motivo !== null) recusarNaTela(TEXTO_DA_RECUSA[motivo], botao)
        else porNoAlvo(naMao, { tipo: 'bandeja' })
        return
      }
      if (troca.feita || vista.resolvido) {
        avisar({ texto: TEXTO_DA_RECUSA.troca_feita, tom: 'neutro' })
        return
      }
      if (troca.naBandeja.length === 0) {
        avisar({ texto: BANDEJA_VAZIA, tom: 'neutro' })
        return
      }
      origemDoVoo.current = botao.getBoundingClientRect()
      agir({ tipo: 'tirarDaBandeja' }, { tipo: 'bandeja' })
    },
    [vista, naMao, eu, avisar, recusarNaTela, porNoAlvo, agir],
  )

  // ---------------------------------------------------------------- a combinação: cada gesto é um pedido; o valor que vale volta na vista

  const acoesDaCombinacao = useMemo(
    (): AcoesDaCombinacao => ({
      onGirar: (roda, passo) => agir({ tipo: 'girar', roda, passo }, { tipo: 'controle' }),
      onPonteiro: (minutos) => agir({ tipo: 'ponteiro', minutos }, { tipo: 'controle' }),
      onApertar: (botao) => agir({ tipo: 'apertar', botao }, { tipo: 'controle' }),
      onTentar: () => agir({ tipo: 'tentar' }, { tipo: 'controle' }),
    }),
    [agir],
  )

  const trocar = useCallback(() => {
    const troca = vista.troca
    if (troca === null || troca.feita || trocandoDesde.current !== null) return
    // A agulha anda até o que a bandeja pesa; o pedestal responde depois (o suspense do v1).
    setAgulha(troca.naBandeja.reduce((soma, pedra) => soma + pedra.peso, 0))
    trocandoDesde.current = performance.now()
    origemDoVoo.current = elDoQuadro('[data-pedestal]')?.getBoundingClientRect() ?? null
    agir({ tipo: 'trocar' }, { tipo: 'pedestal' })
  }, [vista.troca, elDoQuadro, agir])

  /** Quanto falta do suspense da troca; fora da troca, nada. */
  const restoDoSuspense = useCallback(() => {
    const desde = trocandoDesde.current
    trocandoDesde.current = null
    if (desde === null || movimentoReduzido()) return 0
    return Math.max(0, SUSPENSE_DA_TROCA_MS - (performance.now() - desde))
  }, [])

  const voltarAgulha = useCallback(() => depois(VOLTA_DA_AGULHA_MS, () => setAgulha(undefined)), [depois])

  // ---------------------------------------------------------------- a vista mudou: o que entrou assenta, o que voltou voa

  useLayoutEffect(() => {
    const antes = vistaAnterior.current
    vistaAnterior.current = vista
    if (antes === vista) return
    // O mestre zerou o progresso: a próxima resolução espera a porta de novo.
    if (antes.resolvido && !vista.resolvido) setPortaAbriu(false)
    const encaixesAntes = new Map(antes.encaixes.map((e) => [e.id, e]))
    for (const encaixe of vista.encaixes) {
      const era = encaixesAntes.get(encaixe.id)
      const entrou = era !== undefined && ((era.posta === null && encaixe.posta !== null) || (encaixe.metadesPostas ?? 0) > (era.metadesPostas ?? 0))
      if (entrou) {
        assentar(elDoQuadro(seletorDoEncaixe(encaixe.id)))
        // O painel em relevo: a placa de metal assenta com o som dela.
        if (encaixe.placa !== undefined) tocarSomDoRelevo('encaixe')
      }
    }

    const pedido = pedidoDeTirar.current
    if (pedido !== null && vista.encaixes.find((e) => e.id === pedido.encaixe.id)?.posta === null) {
      pedidoDeTirar.current = null
      const posta = pedido.encaixe.posta
      if (posta !== null) {
        const texto = pedido.encaixe.jeito === 'metades' && pedido.encaixe.metadesPostas === 2 ? 'As metades voltaram para quem as pôs.' : textoDaDevolucao(posta.nome, posta.por, eu, ehTeste)
        avisar({ texto, tom: 'neutro' })
      }
    }
    const naBandejaAntes = antes.troca?.naBandeja ?? []
    const naBandejaAgora = vista.troca?.naBandeja ?? []
    const saiuDaBandeja = naBandejaAgora.length < naBandejaAntes.length ? naBandejaAntes.at(-1) : undefined
    if (saiuDaBandeja !== undefined && !(vista.troca?.feita ?? false)) avisar({ texto: `${saiuDaBandeja.nome} saiu da bandeja.`, tom: 'neutro' })

    // A vaga nova (ou a pilha que cresceu) voa de onde a peça estava; sem origem conhecida, ganha o ponto de "novo".
    const quantasAntes = new Map(antes.mochila.map((vaga) => [vaga.vagaId, vaga.quantidade]))
    const chegaram = vista.mochila.filter((vaga) => (quantasAntes.get(vaga.vagaId) ?? 0) < vaga.quantidade)
    const origem = origemDoVoo.current
    origemDoVoo.current = null
    if (chegaram.length === 0) return
    if (origem !== null) {
      for (const vaga of chegaram) voarAte(mochila.current?.querySelector(seletorDaVaga(vaga.vagaId)) ?? null, origem)
    }
    // "Novo" é só o que ele nunca teve nesta tela: a peça que voltou do encaixe ou da bandeja não ganha o ponto.
    const daqui = chegaram.filter((vaga) => !vagasConhecidas.current.has(vaga.vagaId)).map((vaga) => vaga.vagaId)
    for (const vaga of vista.mochila) vagasConhecidas.current.add(vaga.vagaId)
    if (daqui.length > 0) setNovas((atuais) => new Set([...atuais, ...daqui]))
  }, [vista, eu, ehTeste, avisar, elDoQuadro])

  // ---------------------------------------------------------------- os acontecimentos, cada um uma vez

  useLayoutEffect(() => {
    for (const acontecimento of acontecimentos) {
      if (acontecimento.id <= ultimoAcontecimento.current) continue
      ultimoAcontecimento.current = acontecimento.id
      switch (acontecimento.tipo) {
        case 'recusado': {
          const alvo = ultimoAlvo.current
          const el = alvo === null ? null : elDoAlvo(alvo, elDoQuadro)
          recusarNaTela(acontecimento.texto, el)
          if (vista.visual.tipo === 'relevo' && alvo?.tipo === 'encaixe') tocarSomDoRelevo('nao')
          // A peça recusada continua na mão, como no v2.
          const enviada = ultimaEnviada.current
          if (enviada !== null && vista.mochila.some((vaga) => vaga.vagaId === enviada)) setEscolhida(enviada)
          ultimaEnviada.current = null
          pedidoDeTirar.current = null
          origemDoVoo.current = null
          if (trocandoDesde.current !== null) {
            trocandoDesde.current = null
            setAgulha(undefined)
          }
          break
        }
        case 'errou': {
          const { em, castigo } = acontecimento
          const soma = vista.troca?.naBandeja.reduce((total, pedra) => total + pedra.peso, 0) ?? 0
          const pedido = vista.troca?.pesoPedido ?? 0
          ultimaEnviada.current = null
          origemDoVoo.current = null
          depois(restoDoSuspense(), () => {
            avisar(avisoDoErro(textoDoErro(em, soma, pedido), castigo, ehTeste))
            if (em === 'peso') {
              pedestalDeEstalo(elDoQuadro('[data-pedestal]'), soma < pedido)
              voltarAgulha()
            }
            // A combinação errada: o controle diz "não" de lado, como o encaixe recusado.
            if (em === 'combinacao' || em === 'hora' || em === 'sequencia') tremer(elDoQuadro('[data-controle]'))
            if (castigo === null) return
            piscar(elDoQuadro('.qpz__flash'), castigo.tipo)
            if (castigo.tipo !== 'barulho') sacudir(quadro.current)
          })
          break
        }
        case 'juntou':
          brilhar(elDoQuadro(seletorDoEncaixe(acontecimento.encaixeId)))
          avisar({ texto: 'As duas metades se juntaram.', tom: 'latao' })
          break
        case 'trocou': {
          const { nome } = acontecimento
          depois(restoDoSuspense(), () => {
            avisar({ texto: `O pedestal nem se mexe. ${nome} está ${ehTeste ? 'nas peças do teste' : 'na sua mochila'}.`, tom: 'latao' })
            voltarAgulha()
          })
          break
        }
        case 'resolvido':
          setEscolhida(null)
          setDesfechoPendente(acontecimento.desfecho)
          // O painel completo ressoa logo depois do som da última placa.
          if (vista.visual.tipo === 'relevo') window.setTimeout(() => tocarSomDoRelevo('completo'), ATRASO_DO_SOM_COMPLETO_MS)
          break
      }
    }
  }, [acontecimentos, vista, ehTeste, avisar, recusarNaTela, elDoQuadro, depois, restoDoSuspense, voltarAgulha])

  // ---------------------------------------------------------------- o cartão do desfecho: Texto logo, Cena depois da arte

  const comArte = vista.visual.tipo === 'modelo'
  useEffect(() => {
    if (desfechoPendente === null || !vista.resolvido) return
    const mostrar = () => {
      setCartao(desfechoPendente)
      setDesfechoPendente(null)
    }
    if (movimentoReduzido()) {
      const id = window.setTimeout(mostrar, CARTAO_REDUZIDO_MS)
      return () => window.clearTimeout(id)
    }
    if (desfechoPendente.modo === 'texto') {
      const id = window.setTimeout(mostrar, CARTAO_TEXTO_MS)
      return () => window.clearTimeout(id)
    }
    // Cena com a arte do modelo: o cartão espera a porta (o `onAbriu` do quadro).
    if (comArte) {
      if (portaAbriu) mostrar()
      return
    }
    // Cena com imagem própria: os encaixes brilham em cascata, e depois vem o texto.
    Array.from(quadro.current?.querySelectorAll('.qpz-encaixe') ?? []).forEach((el, i) => brilhar(el, i * CASCATA_DO_BRILHO_MS))
    const id = window.setTimeout(mostrar, CARTAO_CENA_SEM_ARTE_MS)
    return () => window.clearTimeout(id)
  }, [desfechoPendente, vista.resolvido, comArte, portaAbriu])

  const fecharCartao = useCallback(() => {
    setCartao(null)
    ;(botaoSair.current ?? botaoRecomecar.current)?.focus({ preventScroll: true })
  }, [])

  // ---------------------------------------------------------------- sair e o teclado

  /** Pelo Esc sai na hora (ação de teclado não anima); pelo botão, com o fade curto. */
  const sair = useCallback(
    (peloTeclado: boolean) => {
      if (saindo) return
      arrasto.cancelar()
      if (peloTeclado) {
        onSair()
        return
      }
      setSaindo(true)
      depois(SAIDA_MS, onSair)
    },
    [saindo, arrasto, onSair, depois],
  )

  useEffect(() => {
    // O documento da dica aberto por cima: o teclado é dele (o Esc fecha o papel, não o puzzle; as setas viram a página).
    if (porBaixo) return
    const desceu = (e: KeyboardEvent) => {
      // Tela modal: o mapa atrás não ouve as teclas (as setas mexeriam a ficha).
      e.stopPropagation()
      if (tecladoDoControle.current?.(e) === true) return
      if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]') !== null) return
      e.preventDefault()
      if (arrasto.cancelar()) return
      if (cartao !== null) fecharCartao()
      else if (naMao !== null) setEscolhida(null)
      else sair(true)
    }
    window.addEventListener('keydown', desceu, true)
    return () => window.removeEventListener('keydown', desceu, true)
  }, [arrasto, cartao, fecharCartao, naMao, sair, porBaixo])

  // Ao entrar, o foco vai à primeira peça (ou ao Sair, com a mochila vazia), como no v2.
  useEffect(() => {
    const primeira = mochila.current?.querySelector<HTMLElement>('.tpz-item') ?? botaoSair.current ?? botaoRecomecar.current
    primeira?.focus({ preventScroll: true })
  }, [])

  // No teste, o aviso de entrada (encaixe sem peça certa: assim ninguém resolve), como o `aviso` do v2 ao testar.
  const avisoDoTeste = teste?.aviso ?? null
  useEffect(() => {
    if (avisoDoTeste !== null) avisar({ texto: avisoDoTeste, tom: 'perigo' })
  }, [avisoDoTeste, avisar])

  // ---------------------------------------------------------------- a tela

  const titulo = vista.titulo.trim() !== '' ? vista.titulo : TITULO_SEM_NOME
  const estado = estadoDoPuzzle(vista, ehTeste)
  return (
    <div ref={raiz} className={ehTeste ? 'tpz tpz--teste' : 'tpz'} data-saindo={saindo || undefined} role="dialog" aria-modal="true" aria-labelledby={idDoTitulo}>
      {teste !== undefined && (
        <div className="tpz-faixa" role="note">
          <b>Teste</b>
          <span>{FAIXA_DO_TESTE}</span>
          <button ref={botaoRecomecar} type="button" className="tpz-bt tpz-bt--p" onClick={teste.onRecomecar}>
            Recomeçar o teste
          </button>
          <button type="button" className="tpz-bt tpz-bt--p" onClick={(evento) => sair(evento.detail === 0)}>
            Voltar ao editor <kbd>Esc</kbd>
          </button>
        </div>
      )}
      <section className="tpz__cena">
        <header className="tpz__cab">
          {!ehTeste && (
            <button ref={botaoSair} type="button" className="tpz-bt tpz-bt--fantasma" onClick={(evento) => sair(evento.detail === 0)}>
              <IconeDoJogador nome="sair" />
              Sair <kbd>Esc</kbd>
            </button>
          )}
          <h1 id={idDoTitulo} className="tpz__titulo">
            {titulo}
          </h1>
          {!ehTeste && (
            <span className="tpz-chip">
              <span className="tpz-chip__av" aria-hidden="true">
                {inicialDoNome(eu)}
              </span>
              {eu} (você)
            </span>
          )}
        </header>
        <div className="tpz__palco">
          <div className="tpz__moldura">
            <QuadroDoPuzzle
              ref={quadro}
              visual={vista.visual}
              encaixes={vista.encaixes}
              troca={vista.troca}
              resolvido={vista.resolvido}
              eu={eu}
              alvos={alvos}
              bandejaEhAlvo={bandejaEhAlvo}
              agulha={agulha}
              onTocarEncaixe={tocarEncaixe}
              onTocarBandeja={tocarBandeja}
              onTrocar={trocar}
              onAbriu={() => setPortaAbriu(true)}
              combinacao={vista.combinacao}
              acoesDaCombinacao={vista.versaoNova === true ? undefined : acoesDaCombinacao}
              tecladoDoControle={tecladoDoControle}
              rotulo={titulo}
            >
              {cartao !== null && <CartaoDoDesfecho titulo={titulo} desfecho={cartao} eu={eu} onContinuar={fecharCartao} teste={teste} onVoltar={() => sair(false)} />}
            </QuadroDoPuzzle>
          </div>
        </div>
        <footer className="tpz__pe">
          <p className="tpz__estado" aria-live="polite">
            {estado.destaque !== '' && <b>{estado.destaque}</b>}
            {estado.resto}
          </p>
          <Dica dica={vista.dica} onLer={onLerDica} />
        </footer>
      </section>
      <div ref={mochila} className="tpz__gaveta">
        <MochilaDoPuzzle
          vagas={vagas}
          escolhida={naMao}
          novas={novas}
          pv={ehTeste ? null : pv}
          titulo={ehTeste ? TITULO_DAS_PECAS_DO_TESTE : undefined}
          nota={vista.combinacao !== undefined && vista.troca === null ? NOTA_DA_COMBINACAO : ehTeste ? NOTA_DAS_PECAS_DO_TESTE : undefined}
          onEscolher={escolher}
          onApertar={arrasto.aoApertar}
        />
      </div>
      <p className="tpz-aviso" role="status" aria-live="polite" data-tom={aviso?.tom} data-visivel={aviso?.visivel || undefined}>
        {aviso?.texto}
      </p>
    </div>
  )
}

/** O elemento que diz "não" quando o host recusa o pedido feito nele. */
function elDoAlvo(alvo: AlvoTocado, elDoQuadro: (seletor: string) => HTMLElement | null): HTMLElement | null {
  switch (alvo.tipo) {
    case 'encaixe':
      return elDoQuadro(seletorDoEncaixe(alvo.id))
    case 'bandeja':
      return elDoQuadro('[data-alvo="bandeja"]')
    case 'pedestal':
      return elDoQuadro('[data-pedestal]')
    case 'controle':
      return elDoQuadro('[data-controle]')
  }
}

function Dica({ dica, onLer }: { dica: VistaDoPuzzle['dica']; onLer: ((peloTeclado: boolean) => void) | undefined }) {
  if (dica === null) return null
  if (dica.tipo === 'texto') {
    return (
      <p className="tpz__dica">
        <em>Dica:</em> {dica.texto}
      </p>
    )
  }
  if (!dica.podeLer) {
    return (
      <p className="tpz__dica">
        <em>Dica:</em> está num documento que você ainda não leu.
      </p>
    )
  }
  return (
    <p className="tpz__dica">
      <em>Dica:</em> está no documento “{dica.titulo}”
      {onLer !== undefined && (
        // `detail` 0: o clique veio do Enter ou do Espaço (o papel abre na hora, sem animação).
        <button type="button" className="tpz-bt tpz-bt--latao tpz-bt--p" onClick={(evento) => onLer(evento.detail === 0)}>
          Ler
        </button>
      )}
    </p>
  )
}
