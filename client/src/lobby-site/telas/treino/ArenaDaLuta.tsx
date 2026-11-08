import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type AnimationEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BatalhaDoJogador, type ConexaoDaBatalha } from '../../../components/batalha/BatalhaDoJogador'
import { linhasDoJogador } from '../../../components/batalha/dadosDaFaixa'
import { tremer } from '../../../components/batalha/EfeitosDaBatalha'
import { FaixaDaOrdem } from '../../../components/batalha/FaixaDaOrdem'
import type { ConsultaDaFicha } from '../../../components/batalha/MiraDoGolpe'
import type { CasaDaArena, GradeDaArena as MedidaDaGrade } from '../../../lib/arena/grade'
import type { PedidoDeAcao } from '../../../lib/batalha/combate'
import type { EstadoParaJogador } from '../../../lib/batalha/vistaDoJogador'
import type { LadoDaLuta, VagaDaLuta } from '../../../lib/treino/mesaEmMemoria'
import { useDoSite, useSistemaDoLobby } from '../contexto'
import { Icone, type NomeDoIcone } from '../Icone'
import { bonecosDoDuelo } from './grade/bonecosDoDuelo'
import { GradeDaArena, type RespostaDoAndar } from './grade/GradeDaArena'
import { copiasDoLado, faixaDaArena, fichasDaLuta, type FioDaArena } from './hudDaLuta'
import '../../../components/arena/arena.css'
import './arenaDaLuta.css'

/**
 * A LUTA NA CARA DA ARENA (fatia H): o treino e o duelo do site em tela
 * cheia, com o HUD da Arena de testes do app. A barra escura no alto (o nome,
 * a Rodada e as ações de quem chama), a faixa da ordem no alto ao centro
 * (`FaixaDaOrdem`: cartas com HP, SP e Escudo, Rodada / Turno / Passar a vez,
 * Regras do campo e Registro), a grade 12 x 8 no meio (`GradeDaArena`, G2), o
 * menu da vez à esquerda e o REAÇÃO embaixo (`BatalhaDoJogador`).
 *
 * A tela só desenha e pede: as jogadas vão por `jogadas` (no treino, o motor
 * no navegador; no duelo, o servidor) e andar vai por `onAndar`. O que o HUD
 * do app pede e a luta do site não tem fica de fora com o motivo dito: a
 * troca de armas e a reação livre recusam com um recado; invocar, as
 * passivas, a marca e o Evoluir nem aparecem (sem a prop, o HUD os apaga).
 * O "Mover" do contra-ataque vira o próximo passo da ficha na grade.
 */

/** As jogadas que a luta aceita (o resto da `ConexaoDaBatalha` a Arena do site responde sozinha). */
export type JogadasDaLuta = Pick<ConexaoDaBatalha, 'agir' | 'reagir' | 'passarVez'>

export interface ArenaDaLutaProps {
  titulo: string
  icone: NomeDoIcone
  fio: FioDaArena
  /** O recorte do lado de quem joga (`vistaParaJogador`); `null` = sem o HUD (o duelo de um servidor antigo). */
  vista: EstadoParaJogador | null
  /** `null` = quem olha não tem lado (assiste ou arbitra a luta de N lados). */
  meuLado: LadoDaLuta | null
  /** As fichas que o menu da vez joga; ausente = o lado inteiro (`meuLado`). No time da luta de N lados, só as da conta. */
  ehMinha?: (vaga: VagaDaLuta) => boolean
  /** A grade da luta; ausente = a pequena (12 x 8) do treino e do duelo. */
  grade?: MedidaDaGrade
  /** `null` = só olhar (a luta acabou). */
  jogadas: JogadasDaLuta | null
  /** Quem a grade deixa pegar; a ficha com o "Mover" do contra-ataque entra sozinha. */
  podeAndar: (vaga: VagaDaLuta, emPe: boolean) => boolean
  onAndar: (tokenId: string, casa: CasaDaArena, contraDe: string | undefined) => RespostaDoAndar
  trilhas?: Readonly<Record<string, readonly CasaDaArena[]>>
  /** O que vem depois da Rodada na barra (a semente, contra quem). */
  detalhes?: ReactNode
  /** O aviso forte da barra (o colega que caiu da conexão). */
  aviso?: ReactNode
  acoes: ReactNode
  /** O que acontece agora, numa linha ("o robô está jogando…"); `null` = nada. */
  estado: string | null
  /** A última recusa; `n` muda a cada uma (a mesma é lida de novo). */
  recusa: { texto: string; n: number } | null
  onEsquecerRecusa: () => void
  /** O resumo do fim, sobre a grade; `null` = a luta segue. */
  fim: ReactNode | null
  /** O que mais fica por cima da Arena (a confirmação de desistir). */
  sobre?: ReactNode
  /** Quem olha arbitra a luta de N lados: as fichas chegam todas como "eu", mas a faixa diz de quem é a vez. */
  arbitra?: boolean
  /** O Desfazer do Registro; ausente = o registro não mostra Desfazer (no treino e no duelo ninguém desfaz). */
  onDesfazer?: (linhaId: string) => void
  /** As linhas com o Desfazer pedido e sem resposta ainda. */
  desfazendo?: ReadonlySet<string>
}

const MOTIVO_DAS_ARMAS = 'No treino e no duelo a luta usa as armas da ficha: a troca é só na mesa, com o mestre.'
const MOTIVO_DA_REACAO_LIVRE = 'A reação livre é só na mesa, com o mestre. Aqui a defesa é a do golpe que chega.'
/** A faixa pede a função; sem `onDesfazer` as linhas chegam sem o Desfazer, então esta nunca é chamada. */
const SEM_DESFAZER = () => {}

/**
 * "Armas por batalha" é escolha da mesa (o mestre confirma). No site a luta
 * usa todas as armas da ficha (`armasNaBatalha` com `armas` null): sem o
 * limite na vista, o HUD não abre sozinho a janela que aqui nunca confirmaria
 * nem marca o ATACAR como pendente.
 */
function semEscolhaDeArmas(vista: EstadoParaJogador): EstadoParaJogador {
  const { meus } = vista
  if (meus === undefined || meus.every((meu) => meu.limiteDeArmas === null)) return vista
  return { ...vista, meus: meus.map((meu) => (meu.limiteDeArmas === null ? meu : { ...meu, limiteDeArmas: null })) }
}

/**
 * A entrada animada acontece uma vez: as abas do treino ficam montadas e só
 * escondidas, e o navegador repete a animação de tudo ao mostrar a aba de
 * novo. Depois da primeira, a animação sai do elemento.
 */
export function assentarAnimacao(evento: AnimationEvent<HTMLElement>): void {
  evento.currentTarget.style.animation = 'none'
}

/** Abriu: o foco vai ao título, a página atrás fica inerte e não rola; fechou, tudo volta e o foco também. */
function useTelaCheia(titulo: { current: HTMLElement | null }) {
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const pagina = document.getElementById('root')
    const rolagem = document.documentElement.style.overflow
    pagina?.setAttribute('inert', '')
    document.documentElement.style.overflow = 'hidden'
    titulo.current?.focus()
    return () => {
      pagina?.removeAttribute('inert')
      document.documentElement.style.overflow = rolagem
      if (antes !== null && antes.isConnected && !antes.matches(':disabled')) antes.focus()
    }
  }, [titulo])
}

export function ArenaDaLuta({ titulo, icone, fio, vista, meuLado, ehMinha, grade, jogadas, podeAndar, onAndar, trilhas, detalhes, aviso, acoes, estado, recusa, onEsquecerRecusa, fim, sobre, arbitra = false, onDesfazer, desfazendo }: ArenaDaLutaProps) {
  const demo = useDoSite((site) => site.demo)
  const sistema = useSistemaDoLobby()
  const idDoTitulo = useId()
  const raiz = useRef<HTMLElement>(null)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const palco = useRef<HTMLDivElement>(null)
  const consultaAtual = useRef<ConsultaDaFicha | null>(null)
  const [mirando, setMirando] = useState(false)
  const [alvoDoMapa, setAlvoDoMapa] = useState<{ tokenId: string; seq: number } | null>(null)
  const [contraDoPasso, setContraDoPasso] = useState<{ golpeId: string; tokenId: string } | null>(null)
  const [recado, setRecado] = useState<{ texto: string; n: number } | null>(null)
  useTelaCheia(tituloRef)

  const acabou = fio.fim !== null
  const fichas = useMemo(() => fichasDaLuta(fio, demo), [fio, demo])
  const meus = useMemo(() => copiasDoLado(fio, ehMinha ?? ((vaga) => vaga.lado === meuLado)), [fio, meuLado, ehMinha])
  const nomeDe = (tokenId: string) => fichas.find((ficha) => ficha.id === tokenId)?.name ?? 'A ficha'
  // O "Mover" do contra-ataque vale enquanto o contra existir (gasto ao andar, ou a vez virou): depois some sozinho.
  const contraValido = contraDoPasso !== null && !acabou && (fio.turnos.contras ?? []).some((contra) => contra.golpeId === contraDoPasso.golpeId) ? contraDoPasso : null

  const avisar = useCallback((texto: string) => setRecado((antes) => ({ texto, n: (antes?.n ?? 0) + 1 })), [])

  const conexao = useMemo<ConexaoDaBatalha | null>(() => {
    if (jogadas === null) return null
    const moverPeloContra = (pedido: Extract<PedidoDeAcao, { tipo: 'mover' }>): boolean => {
      const contra = (fio.turnos.contras ?? []).find((candidato) => candidato.golpeId === pedido.contraDe)
      if (contra === undefined) return false
      setContraDoPasso({ golpeId: contra.golpeId, tokenId: contra.tokenId })
      avisar(`Arraste ${fichas.find((ficha) => ficha.id === contra.tokenId)?.name ?? 'a ficha'} (ou use as setas): o contra-ataque vira o passo.`)
      return true
    }
    return {
      agir: (vez, pedido) => (pedido.tipo === 'mover' ? moverPeloContra(pedido) : jogadas.agir(vez, pedido)),
      reagir: (pedido) => {
        if (pedido.tipo === 'rolar' && pedido.golpeId === null) {
          avisar(MOTIVO_DA_REACAO_LIVRE)
          return false
        }
        return jogadas.reagir(pedido)
      },
      passarVez: jogadas.passarVez,
      escolherArmas: () => {
        avisar(MOTIVO_DAS_ARMAS)
        return false
      },
    }
  }, [jogadas, fio.turnos.contras, fichas, avisar])

  const podeAndarAqui = (vaga: VagaDaLuta, emPe: boolean) => podeAndar(vaga, emPe) || (emPe && contraValido?.tokenId === vaga.tokenId)
  const bonecos = bonecosDoDuelo(fio, demo, podeAndarAqui, sistema)

  function andar(tokenId: string, casa: CasaDaArena): RespostaDoAndar {
    const contraDe = contraValido?.tokenId === tokenId ? contraValido.golpeId : undefined
    if (contraDe !== undefined) setRecado(null)
    return onAndar(tokenId, casa, contraDe)
  }

  const vistaDoHud = useMemo(() => (vista === null ? null : semEscolhaDeArmas(vista)), [vista])
  const dados = useMemo(() => (vista === null ? null : faixaDaArena({ vista, fio, fichas, meus, sistema, arbitra })), [vista, fichas, meus, fio, sistema, arbitra])
  // Sem quem desfaça, a linha perde o Desfazer: um botão que não faz nada é pior que nenhum.
  const desfaz = onDesfazer !== undefined
  const registro = useMemo(() => {
    const linhas = linhasDoJogador(vista?.registro ?? fio.registro)
    return desfaz ? linhas : linhas.map((linha) => (linha.podeDesfazer ? { ...linha, podeDesfazer: false } : linha))
  }, [vista, fio.registro, desfaz])
  const consulta = useCallback<ConsultaDaFicha>((tokenId) => consultaAtual.current?.(tokenId) ?? null, [])
  const vezDaVista = vista?.vez ?? null
  const passarVez = vista !== null && vista.minhaVez && vezDaVista !== null && conexao !== null && !acabou ? () => conexao.passarVez(vezDaVista, vista.rodada) : undefined

  // A grade fica abaixo da faixa da ordem: a altura dela muda com as cartas, então é medida. Acabada a
  // luta, a medida fica: a faixa perde o "Passar a vez" e encolhe, e a grade não pode pular sob o resumo.
  const acabouAgora = useRef(acabou)
  acabouAgora.current = acabou
  useLayoutEffect(() => {
    const faixa = raiz.current?.querySelector<HTMLElement>('.pp-batalha-faixa')
    const lugar = palco.current
    if (faixa === null || faixa === undefined || lugar === null) return
    const medir = () => {
      if (acabouAgora.current && lugar.style.getPropertyValue('--lo-ar-faixa') !== '') return
      lugar.style.setProperty('--lo-ar-faixa', `${faixa.offsetHeight}px`)
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(faixa)
    return () => observador.disconnect()
  }, [dados !== null])

  // O menu da vez fica fixo à esquerda, por cima do palco (arena.css .pp-batalha-menu): a grade começa
  // depois da borda direita dele, medida como a faixa. Só a tela de entrada do menu conta (a lista das
  // técnicas é mais larga e passa por cima um instante); a medida fica quando o menu sai, então a grade
  // não pula a cada vez. Antes da primeira vez vale a mesma régua no CSS (arenaDaLuta.css).
  useLayoutEffect(() => {
    const tela = raiz.current
    const lugar = palco.current
    if (tela === null || lugar === null) return
    let medido: HTMLElement | null = null
    const medir = () => {
      if (medido === null || !medido.isConnected || medido.classList.contains('bt-vez--lista')) return
      // offsetLeft/offsetWidth ignoram o transform da entrada do menu: a borda é a de onde ele assenta.
      const direita = (medido.parentElement?.offsetLeft ?? 0) + medido.offsetLeft + medido.offsetWidth
      if (direita > 0) lugar.style.setProperty('--lo-ar-menu', `${direita}px`)
    }
    const tamanho = new ResizeObserver(medir)
    const procurar = () => {
      const menu = tela.querySelector<HTMLElement>(':scope > .pp-batalha-menu > .bt-vez')
      if (menu === null || menu === medido) return
      if (medido !== null) tamanho.unobserve(medido)
      medido = menu
      tamanho.observe(menu)
    }
    const filhos = new MutationObserver(procurar)
    filhos.observe(tela, { childList: true, subtree: true })
    procurar()
    return () => {
      filhos.disconnect()
      tamanho.disconnect()
    }
  }, [])

  // A recusa nova tira o recado velho do caminho (a mais nova é a que vale).
  useEffect(() => {
    if (recusa !== null) setRecado(null)
  }, [recusa])

  const recadoAgora = recusa ?? recado
  const fecharRecado = () => (recusa !== null ? onEsquecerRecusa() : setRecado(null))

  return createPortal(
    <section
      ref={raiz}
      className="ar-tela lo-ar"
      data-acabou={acabou ? '' : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idDoTitulo}
      // As teclas da luta não chegam às telas do site atrás (o portal sobe pela árvore do React).
      onKeyDown={(evento) => evento.stopPropagation()}
    >
      <header className="ar-barra">
        <span className="ar-barra__med" aria-hidden="true">
          <Icone nome={icone} />
        </span>
        <div className="ar-barra__txt">
          <h2 ref={tituloRef} className="ar-barra__tit" id={idDoTitulo} tabIndex={-1}>
            {titulo}
          </h2>
          <p className="ar-barra__sub">
            <span className="ar-barra__rodada">Rodada {fio.turnos.rodada}</span>
            {detalhes}
          </p>
        </div>
        {aviso}
        <div className="ar-barra__acoes">{acoes}</div>
      </header>

      <div ref={palco} className="ar-palco lo-ar-palco" data-mirando={mirando ? 'sim' : undefined}>
        <GradeDaArena
          bonecos={bonecos}
          grade={grade}
          trilhas={trilhas}
          caber="tudo"
          mirando={mirando}
          onAndar={andar}
          onTocar={(tokenId) => setAlvoDoMapa((antes) => ({ tokenId, seq: (antes?.seq ?? 0) + 1 }))}
          onConsulta={(nova) => {
            consultaAtual.current = nova
          }}
          rotulo="Grade da luta"
        />
      </div>

      {dados !== null && (
        <FaixaDaOrdem papel="jogador" className="pp-batalha-faixa" dados={dados} regras={fio.regras} registro={registro} onDesfazer={onDesfazer ?? SEM_DESFAZER} pendentes={desfazendo} onPassarVez={passarVez} />
      )}

      {vistaDoHud !== null && conexao !== null && !acabou && (
        <BatalhaDoJogador
          estado={vistaDoHud}
          efeitos={fio.efeitos}
          meus={meus}
          fichas={fichas}
          sistema={sistema}
          conexao={conexao}
          consulta={consulta}
          alvoDoMapa={alvoDoMapa}
          onMirando={setMirando}
          onTremor={() => tremer(palco.current)}
        />
      )}

      <div className="lo-ar-recados">
        {vista === null && <p className="lo-ar-recado">Este duelo chegou sem a vista da Arena (servidor antigo): só a grade e o estado.</p>}
        {estado !== null && !acabou && (
          <p className="lo-ar-recado lo-ar-recado--estado" role="status">
            {estado}
          </p>
        )}
        {recadoAgora !== null && (
          <p key={`${recusa === null ? 'r' : 'x'}${recadoAgora.n}`} className="lo-ar-recado" data-tom={recusa === null ? undefined : 'brasa'} role="alert">
            <span>{recadoAgora.texto}</span>
            <button type="button" className="lo-ar-recado__ok" onClick={fecharRecado}>
              Ok
            </button>
          </p>
        )}
        {contraValido !== null && recadoAgora === null && <p className="lo-ar-recado">O contra-ataque de {nomeDe(contraValido.tokenId)} espera o passo na grade.</p>}
      </div>

      {fim !== null && (
        <>
          <div className="lo-ar-veu" aria-hidden="true" />
          <div className="lo-ar-fim" role="status">
            {fim}
          </div>
        </>
      )}
      {sobre}
    </section>,
    document.body,
  )
}
