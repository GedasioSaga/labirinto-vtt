import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { MOTIVO_JA_CONCENTROU, type AcoesDaVez } from '../../lib/batalha/acoes'
import type { AcaoDaTecnica, PedidoDeAcao } from '../../lib/batalha/combate'
import type { OpcaoDaInvocacao } from '../../lib/batalha/invocacao'
import type { MotivoDaOpcao } from './dadosDaInvocacao'
import type { FormaNoMenu } from '../../lib/batalha/transformacao'
import { CHAVE_DA_MAO_NUA, pipsDaVez, textoDaCarga, type AlvoNaMira, type GolpeNaTela } from './dadosDoMenu'
import { tocarSomDoCombate } from '../../lib/sons/sonsDoCombate'
import { BotaoDoSomDoCombate } from './ChavesDoCombate'
import { ListaDeFormas, nomeDaForma } from './ListaDeFormas'
import { CabecaDaVez, ListaDeTecnicas, Tira, andarComSetas, focoSegueOMouse, podeTomarOFoco, semRolarDeLado, type EvoluirNaTela } from './ListaDeTecnicas'
import { MiraDaInvocacao } from './MiraDaInvocacao'
import { MiraDoGolpe, pedidoDoGolpe, type ConsultaDaFicha, type EscolhaDaMira } from './MiraDoGolpe'
import { ListaDePassivasDoMenu, type PassivasNoMenu } from './PassivasDaBatalha'
import './batalha.css'
import './combate.css'

/**
 * O MENU DA VEZ do JOGADOR (o `.menu--principal` do protótipo aprovado):
 * tiras Atacar, Habilidades, Transformação (F3: acende quando a ficha tem
 * forma e abre a `ListaDeFormas`), Passivas (tipos de habilidade F3: só com
 * passiva na ficha; abre a `ListaDePassivasDoMenu`, Ativar/Desligar sem gastar ação), Concentrar ("Carga 1 · próximo golpe ×1,5") e Encerrar vez; a cabeça com o
 * nome e a economia ("Simples 1 · Bônus 0 · Mov 2/4", Mov vermelho quando
 * passa). Atacar e Habilidades abrem a lista; o golpe escolhido abre a mira.
 *
 * Fora da vez, só com um contra-ataque guardado (Q6): Atacar, Habilidade ou
 * Mover, sem gastar a vez.
 *
 * Teclado (só com o foco dentro do menu): setas andam, Enter ou seta para a
 * direita abrem, Esc volta. Recolhe num botão "Ações" para o mapa ficar livre
 * (o jogador anda arrastando a ficha).
 */

export interface ContraNoMenu {
  golpeId: string
  /** "contra Vera": de qual golpe veio (há como guardar mais de um). */
  rotulo: string
}

/**
 * Invocação F3: o que o menu precisa para a técnica de Tipo Invocação (a
 * mira da invocação e o "esperando o mestre"). Ausente = a mesa não invoca
 * (a Arena): a técnica fica apagada.
 */
export interface InvocarNoMenu {
  /** As opções e a imagem da técnica; `null` = não é invocação. */
  leitura: (cartaoId: string) => { opcoes: readonly OpcaoDaInvocacao[]; imagem: string | null } | null
  contar: (cartaoId: string, opcao: OpcaoDaInvocacao) => number
  motivo: (cartaoId: string) => MotivoDaOpcao
  onInvocar: (cartaoId: string, opcao: string, custo: number | null, acao: AcaoDaTecnica | null) => boolean
  /** Os invocados dele que esperam o mestre pôr no mapa. */
  esperando: readonly { id: string; nome: string }[]
}

/** A técnica de Tipo Invocação numa mesa sem o Invocar, ou fora da vez. */
const SEM_INVOCAR = 'Invocação: não vale nesta mesa'
const INVOCAR_SO_NA_VEZ = 'Invocação: só na sua vez'

/** "1 Lobo", "2 Lobos e 1 Ultra Lobo": quem espera o mestre, contado por nome. */
export function textoDaEspera(esperando: readonly { nome: string }[]): string {
  const contagem = new Map<string, number>()
  for (const item of esperando) contagem.set(item.nome, (contagem.get(item.nome) ?? 0) + 1)
  const partes = [...contagem].map(([nome, quantos]) => `${quantos} ${nome}`)
  return partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

/** C6: "O mestre está decidindo os números de Sulong" (com duas: "de Sulong e Forma Híbrida"). */
export function textoDoMestreDecidindo(formas: readonly { nome: string }[]): string {
  const nomes = [...new Set(formas.map((forma) => forma.nome.trim() || 'a forma'))]
  const lista = nomes.length <= 1 ? (nomes[0] ?? 'a forma') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
  return `O mestre está decidindo os números de ${lista}`
}

export interface MenuDaVezProps {
  quem: string
  /** `null` = fora da vez (só o contra-ataque). */
  acoes: AcoesDaVez | null
  carga: number
  /** Por que o Concentrar está apagado; `null` = pode. */
  motivoDoConcentrar: string | null
  armas: readonly GolpeNaTela[]
  habilidades: readonly GolpeNaTela[]
  alvos: readonly AlvoNaMira[]
  /** "Escolher armas" (limite da ficha). `pendente` = ainda não escolheu. Ausente = sem limite. */
  escolhaDeArmas?: { pendente: boolean; onAbrir: () => void }
  /** Q6: os contra-ataques guardados. Fora da vez, o menu só oferece eles; com mais de um, ele escolhe qual. */
  contras?: readonly ContraNoMenu[]
  /** Os golpes lidos fora da vez (a ação da vez não conta no contra-ataque). Ausente = os mesmos. */
  golpesDoContra?: { armas: readonly GolpeNaTela[]; habilidades: readonly GolpeNaTela[] }
  /** O pedido saiu? (`false` = sem conexão ou recusado na hora.) */
  onAgir: (pedido: PedidoDeAcao) => boolean
  /** Pedido de 09/11 (item 5): a frase da recusa para quem não é jogador (o mestre na vez do NPC). Ausente = a do jogador. */
  avisoDaRecusa?: string
  /** Conserto de 09/11: o MOTIVO da recusa do pedido, dito pela regra (o mestre na vez do NPC); `null` = a regra não recusa (cai no `avisoDaRecusa`). */
  motivoDaRecusa?: (pedido: PedidoDeAcao) => string | null
  /** Conserto de 09/11: o menu é do mestre: a mira diz o lado de cada alvo e a ajuda no outro lado pede um toque a mais. */
  doMestre?: boolean
  /** Achado 6: o golpe (a chave) e o alvo que o app sugere para a vez do NPC. */
  sugestao?: { chave: string | null; alvoTokenId: string | null }
  /** "Zerar" a concentração (o botão ao lado da tira Concentrar, só com carga). Não devolve a ação gasta. Ausente = sem o botão. */
  onZerarCarga?: () => boolean
  /** Ausente fora da vez. */
  onEncerrar?: () => boolean
  /** S4: a ficha clicada no mapa enquanto mira. */
  alvoDoMapa?: { tokenId: string; seq: number } | null
  /** S4: liga e desliga o "clicar na ficha escolhe o alvo". */
  onMirando?: (mirando: boolean) => void
  consulta?: ConsultaDaFicha | null
  /** Esperando o host responder um pedido: as tiras ficam paradas. */
  esperando?: boolean
  /** Construtor C6: as formas dele que esperam o mestre decidir os números ("o mestre está decidindo"). */
  formasEsperando?: readonly { id: string; nome: string }[]
  /** F3: as formas da ficha (`formasNoMenu`). Vazio ou ausente = a tira Transformação apagada. */
  formas?: readonly FormaNoMenu[]
  /** F3: de quem é a ficha (lembra "trocar a imagem" no aparelho). */
  personagemId?: string | null
  /** Tipos de habilidade F3: as passivas da ficha que age. Ausente ou sem itens = sem a tira Passivas. */
  passivas?: PassivasNoMenu
  /** Tipos de habilidade F4: o Evoluir na leitura das Habilidades (a técnica que ainda evolui). Ausente = sem o botão. */
  evoluir?: EvoluirNaTela
  /** Invocação F3: a mira da invocação. Ausente = a técnica de Tipo Invocação fica apagada. */
  invocacao?: InvocarNoMenu
  /** Conserto das fichas F1 (S4): Atordoado ou Paralisado (o motivo); só o Encerrar vez fica aceso. Ausente ou `null` = livre. */
  travado?: string | null
}

type Tela =
  | { tipo: 'menu' }
  | { tipo: 'lista'; de: 'atacar' | 'habilidade' }
  | { tipo: 'mira'; golpe: GolpeNaTela; de: 'atacar' | 'habilidade' }
  | { tipo: 'invocacao'; golpe: GolpeNaTela }
  | { tipo: 'formas' }
  | { tipo: 'passivas' }

const SEM_MOTIVO = null

/**
 * D2: a última tira escolhida por ficha (a próxima vez dela pousa ali, e a
 * lista pousa na última técnica). Vive enquanto o app está aberto.
 */
const ultimaEscolhaDaFicha = new Map<string, string>()

/** D2: a tecla de cada ação, fixa (a mão aprende: 1 ataca, 5 encerra, em toda ficha). */
const TECLA_DA_TIRA: Readonly<Record<string, number>> = {
  atacar: 1,
  habilidades: 2,
  transformacao: 3,
  concentrar: 4,
  encerrar: 5,
  passivas: 6,
  'contra-atacar': 1,
  'contra-habilidade': 2,
  'contra-mover': 3,
  'contra-voltar': 4,
}

const sobraDe = (contagem: { usadas: number; total: number }) => Math.max(0, contagem.total - contagem.usadas)

/** D2: sem Simples, sem Bônus e sem o ataque extra da forma, só resta encerrar (o andar é arrastando a ficha). */
function semAcaoNoMenu(acoes: AcoesDaVez | null): boolean {
  if (acoes === null) return false
  const extra = acoes.ataqueExtra
  return sobraDe(acoes.simples) === 0 && sobraDe(acoes.bonus) === 0 && !(extra !== undefined && extra.liberado && extra.usadas < extra.total)
}

const SEM_CONTRAS: readonly ContraNoMenu[] = []
const SEM_FORMAS: readonly FormaNoMenu[] = []
const SEM_TRANSFORMACAO = 'Nenhuma transformação na ficha'

export function MenuDaVez(props: MenuDaVezProps) {
  const { quem, acoes, carga, motivoDoConcentrar, alvos, escolhaDeArmas, contras = SEM_CONTRAS, golpesDoContra, onAgir, onZerarCarga, onEncerrar, alvoDoMapa, onMirando, consulta, esperando, formas = SEM_FORMAS, personagemId = null, passivas, evoluir, invocacao, travado = null, formasEsperando } = props
  const [tela, setTela] = useState<Tela>({ tipo: 'menu' })
  const [contraId, setContraId] = useState<string | null>(null)
  const foraDaVez = props.acoes === null
  // C2: zerar na mesma vez do Concentrar desfaz o Concentrar (a ação volta); depois, a ação gasta não volta.
  const efeitoDoZerar = motivoDoConcentrar === MOTIVO_JA_CONCENTROU ? 'desfaz o Concentrar desta vez' : 'a ação gasta não volta'
  // Fora da vez com um só guardado, ele já é o escolhido; com mais de um, ele escolhe.
  const contra = contras.find((candidato) => candidato.golpeId === contraId) ?? (foraDaVez && contras.length === 1 ? contras[0] : undefined)
  const modoContra = contra !== undefined
  const armas = modoContra && golpesDoContra !== undefined ? golpesDoContra.armas : props.armas
  // Invocação F3: sem o Invocar (Arena) ou no contra-ataque, a técnica de Tipo Invocação fica apagada.
  const habilidadesDaFicha = modoContra && golpesDoContra !== undefined ? golpesDoContra.habilidades : props.habilidades
  const motivoSemInvocar = invocacao === undefined ? SEM_INVOCAR : modoContra || foraDaVez ? INVOCAR_SO_NA_VEZ : null
  const habilidades = motivoSemInvocar === null ? habilidadesDaFicha : habilidadesDaFicha.map((golpe) => (golpe.invocacao === true ? { ...golpe, motivo: motivoSemInvocar } : golpe))
  const [recolhido, setRecolhido] = useState(false)
  const [porTeclado, setPorTeclado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const tiras = useRef<(HTMLButtonElement | null)[]>([])
  const botaoRecolhido = useRef<HTMLButtonElement>(null)
  const [atual, setAtual] = useState(0)
  /** D2: o foco está no menu? A dica das teclas só aparece quando elas funcionam de fato. */
  const [comFoco, setComFoco] = useState(false)
  /** D2: onde o menu pousa ao (re)aparecer: lido no render das tiras, usado no efeito logo depois. */
  const pouso = useRef(0)
  const fichaDaMemoria = personagemId ?? quem
  const semAcao = travado !== null || semAcaoNoMenu(acoes)
  const lembrar = (chave: string) => {
    if (chave !== 'encerrar' && chave !== 'contra-voltar') ultimaEscolhaDaFicha.set(fichaDaMemoria, chave)
  }

  // A mira liga o "clicar na ficha escolhe o alvo" (S4); sair dela desliga.
  const mirando = tela.tipo === 'mira' && !recolhido
  useEffect(() => {
    onMirando?.(mirando)
  }, [mirando, onMirando])
  useEffect(() => () => onMirando?.(false), [onMirando])

  const pips = acoes === null ? null : pipsDaVez(acoes)
  const textoCarga = textoDaCarga(carga)

  /** Pede a ação; `true` = saiu, um texto = não saiu, e por quê (o motivo da regra, quando quem monta sabe dizer). */
  const pedir = (pedido: PedidoDeAcao): true | string => {
    // F3: Ativar e Desfazer a forma nunca são contra-ataque.
    const semContra = pedido.tipo === 'concentrar' || pedido.tipo === 'transformar' || pedido.tipo === 'destransformar'
    const comContra: PedidoDeAcao = contra !== undefined && !semContra ? { ...pedido, contraDe: contra.golpeId } : pedido
    if (onAgir(comContra)) {
      if (contra !== undefined) setContraId(null)
      return true
    }
    // A recusa não muda a cena: o motivo lido agora é o do pedido que acabou de voltar.
    return props.motivoDaRecusa?.(comContra) ?? props.avisoDaRecusa ?? 'Não saiu: sem conexão com o mestre, ou a vez já passou.'
  }

  const agir = (pedido: PedidoDeAcao): boolean => {
    const saiu = pedir(pedido)
    setAviso(saiu === true ? null : saiu)
    return saiu === true
  }

  /** O golpe da mira: o motivo da recusa volta para ela, que o mostra junto do Lançar. */
  const lancar = (golpe: GolpeNaTela, escolha: EscolhaDaMira): true | string => {
    const saiu = pedir(pedidoDoGolpe(golpe, escolha))
    if (saiu === true) {
      setAviso(null)
      setTela({ tipo: 'menu' })
    }
    return saiu
  }

  const abrir = (proxima: Tela, teclado: boolean) => {
    setPorTeclado(teclado)
    setAviso(null)
    setTela(proxima)
  }

  // D2: ao nascer o menu, ao voltar da lista ou da mira, ao reabrir e quando a última ação acaba, o foco pousa
  // na tira lembrada (sem ação restante, no "Encerrar vez"). Antes da pintura: a tira acesa já nasce certa.
  useLayoutEffect(() => {
    if (tela.tipo !== 'menu' || recolhido) return
    const indice = pouso.current
    setAtual(indice)
    if (podeTomarOFoco()) tiras.current[indice]?.focus({ preventScroll: true })
    // A tela que abre junto com o menu (a Arena foca o próprio título num efeito que roda depois deste): um quadro
    // depois, se o foco caiu fora do menu e fora de um controle (o corpo, um título com tabIndex -1), ele volta à tira.
    const quadro = requestAnimationFrame(() => {
      const ativo = document.activeElement
      const semControle = !(ativo instanceof HTMLElement) || ativo === document.body || ativo.tabIndex < 0
      const foraDoMenu = !(ativo instanceof HTMLElement) || ativo.closest('.bt-vez') === null
      if (semControle && foraDoMenu && podeTomarOFoco()) tiras.current[pouso.current]?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(quadro)
  }, [tela.tipo, recolhido, semAcao, contraId])

  if (recolhido) {
    return (
      <button
        ref={botaoRecolhido}
        type="button"
        className="bt-vez-recolhido"
        aria-label={`Abrir as ações de ${quem}`}
        onClick={() => {
          setRecolhido(false)
          setPorTeclado(false)
        }}
      >
        Ações <small>{pips === null ? 'contra-ataque' : pips.map((pip) => pip.texto).join(' · ')}</small>
      </button>
    )
  }

  if (tela.tipo === 'lista') {
    const golpes = tela.de === 'atacar' ? armas : habilidades
    return (
      <ListaDeTecnicas
        titulo={tela.de === 'atacar' ? 'Atacar' : 'Habilidades'}
        pips={pips}
        carga={carga}
        golpes={golpes}
        instantaneo={porTeclado}
        armas={tela.de === 'atacar' ? escolhaDeArmas : undefined}
        vazio={tela.de === 'atacar' ? 'Nenhuma arma levada para esta batalha.' : 'Nenhuma habilidade na ficha (nem nas transformações ligadas).'}
        evoluir={tela.de === 'habilidade' ? evoluir : undefined}
        sugerida={props.sugestao?.chave ?? null}
        memoria={`${fichaDaMemoria}:${tela.de}`}
        onVoltar={() => abrir({ tipo: 'menu' }, true)}
        onEscolher={(golpe, teclado) => abrir(golpe.invocacao === true && tela.de === 'habilidade' ? { tipo: 'invocacao', golpe } : { tipo: 'mira', golpe, de: tela.de }, teclado)}
      />
    )
  }

  if (tela.tipo === 'formas') {
    return (
      <ListaDeFormas
        pips={pips}
        carga={carga}
        formas={formas}
        acoes={acoes}
        personagemId={personagemId}
        instantaneo={porTeclado}
        esperando={esperando}
        onAgir={agir}
        onFeito={() => setTela({ tipo: 'menu' })}
        onVoltar={() => abrir({ tipo: 'menu' }, true)}
      />
    )
  }

  if (tela.tipo === 'passivas' && passivas !== undefined) {
    return (
      <ListaDePassivasDoMenu
        pips={pips}
        carga={carga}
        passivas={passivas}
        alvos={alvos}
        instantaneo={porTeclado}
        esperando={esperando}
        onVoltar={() => abrir({ tipo: 'menu' }, true)}
      />
    )
  }

  if (tela.tipo === 'invocacao' && invocacao !== undefined && tela.golpe.cartaoId !== null) {
    const { cartaoId } = tela.golpe
    const leitura = invocacao.leitura(cartaoId)
    if (leitura !== null)
      return (
        <div className="bt-vez bt-vez--lista" data-instantaneo="sim">
          <CabecaDaVez quem={quem} pips={pips} carga={carga} />
          <MiraDaInvocacao
            key={tela.golpe.chave}
            golpe={tela.golpe}
            opcoes={leitura.opcoes}
            imagem={leitura.imagem}
            contar={(opcao) => invocacao.contar(cartaoId, opcao)}
            motivo={invocacao.motivo(cartaoId)}
            quemPede="jogador"
            onVoltar={() => abrir({ tipo: 'lista', de: 'habilidade' }, true)}
            onInvocar={(opcao, custo, acao) => {
              const saiu = invocacao.onInvocar(cartaoId, opcao, custo, acao)
              if (saiu) setTela({ tipo: 'menu' })
              return saiu
            }}
          />
        </div>
      )
  }

  if (tela.tipo === 'mira') {
    return (
      <div className="bt-vez bt-vez--lista" data-instantaneo="sim">
        <CabecaDaVez quem={quem} pips={pips} carga={carga} />
        <MiraDoGolpe
          key={tela.golpe.chave}
          golpe={tela.golpe}
          carga={carga}
          alvos={alvos}
          alvoDoMapa={alvoDoMapa}
          consulta={consulta}
          contra={modoContra}
          // A sugestão do NPC: o alvo dela só vale no golpe sugerido; nos outros, a regra de sempre.
          alvoInicial={props.sugestao !== undefined && props.sugestao.chave === tela.golpe.chave ? (props.sugestao.alvoTokenId ?? undefined) : undefined}
          confirmaOutroLado={props.doMestre === true}
          // D2/D8: o foco entra na mira sempre (o Enter lança, o Esc volta), não só quando abriu pelo teclado.
          focoAoAbrir={podeTomarOFoco()}
          onVoltar={() => abrir({ tipo: 'lista', de: tela.de }, true)}
          onLancar={(escolha) => lancar(tela.golpe, escolha)}
        />
      </div>
    )
  }

  type ItemDoMenu = {
    chave: string
    nome: string
    lado?: string | null
    detalhe?: string | null
    motivo?: string | null
    forma?: boolean
    passiva?: boolean
    executar: (teclado: boolean) => void
    /** O botão "Zerar" ao lado da tira (só a Concentrar, com carga). Fica de fora das setas: alcança pelo Tab. */
    zerar?: () => void
  }
  const itens: ItemDoMenu[] = []
  if (contra !== undefined) {
    const de = contra.rotulo
    itens.push({ chave: 'contra-atacar', nome: 'Atacar', detalhe: `Contra-ataque ${de}: sem gastar a vez`, executar: (t) => abrir({ tipo: 'lista', de: 'atacar' }, t) })
    itens.push({ chave: 'contra-habilidade', nome: 'Habilidade', detalhe: `Contra-ataque ${de}: sem gastar a vez`, executar: (t) => abrir({ tipo: 'lista', de: 'habilidade' }, t) })
    itens.push({
      chave: 'contra-mover',
      nome: 'Mover',
      detalhe: 'Gasta o contra-ataque em se mover: depois arraste a ficha no mapa',
      executar: () => {
        agir({ tipo: 'mover', contraDe: contra.golpeId })
      },
    })
    if (!foraDaVez || contras.length > 1)
      itens.push({ chave: 'contra-voltar', nome: 'Guardar para depois', detalhe: foraDaVez ? 'Volta à escolha do contra-ataque' : 'Volta às ações da vez', executar: () => setContraId(null) })
  } else if (foraDaVez) {
    contras.forEach((candidato) =>
      itens.push({ chave: `contra:${candidato.golpeId}`, nome: 'Contra-ataque', lado: null, detalhe: `${candidato.rotulo}: uma ação fora da vez`, executar: () => setContraId(candidato.golpeId) }),
    )
  } else {
    if (contras.length > 0)
      contras.forEach((candidato) =>
        itens.push({ chave: `contra:${candidato.golpeId}`, nome: 'Contra-ataque', detalhe: `Guardado (${candidato.rotulo}): usa sem gastar a vez`, executar: () => setContraId(candidato.golpeId) }),
      )
    // Pedido de 09/11 (item 3): a Mão nua está sempre na lista e não conta como arma.
    const quantasArmas = armas.filter((golpe) => golpe.chave !== CHAVE_DA_MAO_NUA).length
    itens.push({ chave: 'atacar', nome: 'Atacar', lado: quantasArmas > 0 ? `${quantasArmas} ${quantasArmas === 1 ? 'arma' : 'armas'}` : null, executar: (t) => abrir({ tipo: 'lista', de: 'atacar' }, t) })
    itens.push({ chave: 'habilidades', nome: 'Habilidades', lado: habilidades.length > 0 ? String(habilidades.length) : null, executar: (t) => abrir({ tipo: 'lista', de: 'habilidade' }, t) })
    const ligada = formas.find((forma) => forma.ligada)
    itens.push({
      chave: 'transformacao',
      nome: 'Transformação',
      forma: true,
      lado: ligada !== undefined ? 'ATIVA' : formas.length > 0 ? String(formas.length) : null,
      detalhe: ligada !== undefined ? `Em ${nomeDaForma(ligada)} · desfazer é ação livre` : formas.length === 1 ? nomeDaForma(formas[0] as FormaNoMenu) : null,
      motivo: formas.length === 0 ? SEM_TRANSFORMACAO : SEM_MOTIVO,
      executar: (t) => abrir({ tipo: 'formas' }, t),
    })
    // Tipos de habilidade F3: só com passiva na ficha (quem não tem não ganha uma tira apagada a mais).
    const itensPassivos = passivas?.itens ?? []
    if (itensPassivos.length > 0) {
      const ativas = itensPassivos.filter((passiva) => passiva.estado === 'ativa')
      const prontas = itensPassivos.filter((passiva) => passiva.estado === 'pronta')
      itens.push({
        chave: 'passivas',
        nome: 'Passivas',
        passiva: true,
        lado: ativas.length > 0 ? `${ativas.length} ATIVA${ativas.length === 1 ? '' : 'S'}` : String(itensPassivos.length),
        detalhe:
          ativas.length > 0
            ? `${ativas.map((passiva) => passiva.nome).join(', ')} · desligar não gasta ação`
            : prontas.length > 0
              ? `${prontas.map((passiva) => passiva.nome).join(', ')} pronta${prontas.length === 1 ? '' : 's'} · ativar não gasta ação`
              : 'Ativar e desligar não gastam ação',
        executar: (t) => abrir({ tipo: 'passivas' }, t),
      })
    }
    itens.push({
      chave: 'concentrar',
      nome: 'Concentrar',
      lado: textoCarga === null ? null : `Carga ${carga}`,
      detalhe: carga === 0 ? 'Gasta a Simples: o próximo golpe sai ×1,5' : textoCarga,
      motivo: motivoDoConcentrar ?? SEM_MOTIVO,
      executar: () => agir({ tipo: 'concentrar' }),
      // Vale mesmo com o Concentrar apagado ("Já concentrou nesta vez"): zerar não gasta ação.
      zerar:
        onZerarCarga === undefined || carga <= 0
          ? undefined
          : () => setAviso(onZerarCarga() ? null : 'Não zerou: sem conexão com o mestre.'),
    })
    if (onEncerrar !== undefined)
      itens.push({
        chave: 'encerrar',
        nome: 'Encerrar vez',
        detalhe: 'Passa a vez para a próxima carta',
        executar: () => {
          const saiu = onEncerrar()
          setAviso(saiu ? null : 'Não saiu: sem conexão com o mestre.')
        },
      })
  }
  // Conserto das fichas F1 (S4): travado, tudo apaga com o motivo, menos o Encerrar vez.
  if (travado !== null) itens.forEach((item, indice) => {
    if (item.chave !== 'encerrar') itens[indice] = { ...item, motivo: travado, zerar: undefined }
  })
  tiras.current.length = itens.length
  // D2: a tecla de cada tira (fixa por ação; fora da vez, os contra-ataques guardados em ordem).
  const teclaDe = (item: ItemDoMenu, indice: number): number | undefined =>
    TECLA_DA_TIRA[item.chave] ?? (foraDaVez && contra === undefined && indice < 9 ? indice + 1 : undefined)
  // D2: onde pousar. Sem ação restante, no Encerrar vez; senão na última escolhida desta ficha; senão na primeira acesa.
  const livre = (indice: number) => itens[indice] !== undefined && !itens[indice]?.motivo
  const indiceEncerrar = itens.findIndex((item) => item.chave === 'encerrar')
  const lembrada = ultimaEscolhaDaFicha.get(fichaDaMemoria)
  const indiceLembrado = itens.findIndex((item) => item.chave === lembrada)
  const primeiraAcesa = itens.findIndex((_, indice) => livre(indice))
  pouso.current = semAcao && indiceEncerrar >= 0 ? indiceEncerrar : indiceLembrado >= 0 && livre(indiceLembrado) ? indiceLembrado : Math.max(0, primeiraAcesa)

  const escolherItem = (item: ItemDoMenu, teclado: boolean) => {
    if (esperando || item.motivo) return
    lembrar(item.chave)
    tocarSomDoCombate('confirmar')
    item.executar(teclado)
  }

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (andarComSetas(evento, tiras.current, atual)) return
    if (evento.key === 'ArrowRight') {
      const item = itens[atual]
      if (item !== undefined && !item.motivo) {
        evento.preventDefault()
        escolherItem(item, true)
      }
      return
    }
    // 1 a 6: a ação direto. A tira apagada só recebe o foco (o motivo dela fica à vista).
    if (/^[1-9]$/.test(evento.key) && !evento.altKey && !evento.ctrlKey && !evento.metaKey) {
      const indice = itens.findIndex((item, i) => teclaDe(item, i) === Number(evento.key))
      const item = itens[indice]
      if (item === undefined) return
      evento.preventDefault()
      evento.stopPropagation()
      setAtual(indice)
      tiras.current[indice]?.focus({ preventScroll: true })
      escolherItem(item, true)
      return
    }
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      setRecolhido(true)
      window.requestAnimationFrame(() => botaoRecolhido.current?.focus())
    }
  }

  const focoSaiu = (evento: FocusEvent<HTMLDivElement>) => {
    if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setComFoco(false)
  }

  return (
    <div
      className="bt-vez"
      data-instantaneo={porTeclado ? 'sim' : 'nao'}
      onKeyDown={teclar}
      onFocus={() => setComFoco(true)}
      onBlur={focoSaiu}
      aria-busy={esperando ? true : undefined}
    >
      <CabecaDaVez quem={modoContra || foraDaVez ? `${quem} · contra-ataque` : quem} pips={pips} carga={carga} />
      {formasEsperando !== undefined && formasEsperando.length > 0 && (
        <p className="bt-vez__espera" role="status">
          <span className="bt-vez__espera-ponto" aria-hidden="true" />
          {textoDoMestreDecidindo(formasEsperando)}
        </p>
      )}
      {invocacao !== undefined && invocacao.esperando.length > 0 && (
        <p className="bt-vez__espera" role="status">
          <span className="bt-vez__espera-ponto" aria-hidden="true" />
          Esperando o mestre pôr no mapa: {textoDaEspera(invocacao.esperando)}
        </p>
      )}
      <ul className="bt-vez__tiras" aria-label={modoContra || foraDaVez ? 'Contra-ataque' : `Ações de ${quem}`} onScroll={semRolarDeLado}>
        {itens.map((item, indice) => (
          <li key={item.chave} className={item.zerar === undefined ? undefined : 'bt-vez__com-zerar'}>
            <Tira
              indice={indice}
              chave={item.chave}
              nome={item.nome}
              lado={item.lado}
              detalhe={item.detalhe}
              motivo={item.motivo}
              forma={item.forma}
              passiva={item.passiva}
              tecla={teclaDe(item, indice)}
              esta={atual === indice}
              onFoco={() => setAtual(indice)}
              // O mouse acende a tira (o mesmo papel e os 14 px da escolhida); com o foco no menu, o foco vai junto (um cursor só).
              onApontar={() => {
                setAtual(indice)
                focoSegueOMouse(tiras.current[indice])
              }}
              onEscolher={(teclado) => escolherItem(item, teclado)}
              refDaTira={(elemento) => {
                tiras.current[indice] = elemento
              }}
            />
            {item.zerar !== undefined && (
              <button
                type="button"
                className="bt-zerar"
                aria-label={`Zerar a concentração de ${quem} (carga ${carga} para 0; ${efeitoDoZerar})`}
                title={`Volta a carga a 0 (${efeitoDoZerar})`}
                disabled={esperando}
                onClick={item.zerar}
              >
                Zerar
              </button>
            )}
          </li>
        ))}
      </ul>
      {aviso !== null && (
        <p className="bt-vez__aviso" role="alert">
          {aviso}
        </p>
      )}
      {/* D2: as teclas só são ditas quando funcionam (o foco no menu); sem o foco, só o que vale com o mouse. */}
      <p className="bt-vez__dica">
        {comFoco && (
          <>
            <kbd>↑</kbd> <kbd>↓</kbd> escolhe · <kbd>Enter</kbd> abre · <kbd>1</kbd>–<kbd>5</kbd> direto · <kbd>Esc</kbd> recolhe ·{' '}
          </>
        )}
        arraste a ficha para andar
      </p>
      <div className="bt-vez__rodape">
        <button type="button" className="bt-botao bt-botao--p" onClick={() => setRecolhido(true)}>
          Recolher
        </button>
        <BotaoDoSomDoCombate />
      </div>
    </div>
  )
}
