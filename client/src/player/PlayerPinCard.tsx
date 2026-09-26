import { useEffect, useRef, useState } from 'react'
import type { LojaItem, Pin, PinExitLabel, PinPassage, Stair, StairDirection } from '../types/map'
import {
  PIN_BLOCK_REASON_LABELS,
  PIN_GLYPH,
  PIN_ICON_LABELS,
  blockReasonOf,
  isPinIcon,
  isPlayerSafePinImage,
  passageOf,
} from '../lib/pins'
import { itemOfPin } from '../lib/items'
import { lojaParaJogador, textoDoEstoque } from '../lib/loja'
import { compraNoticeText } from './compraNotice'
import type { CompraNotice } from './playerConnection'
import { stairTravelLabel } from '../lib/stairTravel'
import { PinLeverArt, PinSymbolArt, PinTravelArt } from '../components/PinSymbolArt'
import { unreadExitLabels } from '../lib/pinTravel'
import type { LockAnswerPhase } from './playerConnection'
import { PlayerLockPad } from './PlayerLockPad'
import { PASS_CHECK_TEXT } from './travelNotice'
import type { PinTravelChoice } from '../lib/pinTravelers'

const NO_TRAVELERS: readonly PinTravelChoice[] = []

/**
 * O que o cartão lê do pino: o pino do mapa, ou o cartão que o mestre mostrou
 * ("Mostrar agora a…", `PinCard`), que chega SEM posição. A posição é
 * opcional aqui de propósito: o cartão nunca usa onde o pino está.
 */
type PinDoCartao = Omit<Pin, 'x' | 'y'> & Partial<Pick<Pin, 'x' | 'y'>>

interface PlayerPinCardProps {
  pin: PinDoCartao
  onClose: () => void
  /**
   * Pino de viagem: manda o pedido de passagem ao mestre (já confirmado aqui).
   * Ausente = o cartão não oferece passar, só lê. `exitId` é a saída escolhida
   * numa encruzilhada; no pino de uma saída ele não vem. `tokenIds` são as
   * fichas marcadas no "Quem passa?"; sem a escolha (uma ficha só), não vem.
   */
  onRequestTravel?: (exitId?: string, tokenIds?: string[]) => void
  /**
   * ESCOLHER FICHAS NO PINO: as fichas do jogador que podem passar por este
   * pino (`lib/pinTravelers.ts`), a da frente primeiro. Com duas ou mais, a
   * pergunta de confirmar ganha "Quem passa?", com todas marcadas.
   */
  travelers?: readonly PinTravelChoice[]
  /** Já há um pedido esperando o mestre: não dá para pedir de novo. */
  travelWaiting?: boolean
  /** ITEM PEGÁVEL: "Pegar" o item do pino. Ausente = o cartão não oferece pegar. */
  onTakeItem?: () => void
  /** Já há um "Pegar" esperando o mestre: o botão fica desligado. */
  takeWaiting?: boolean
  /**
   * CABINE DE TRANSPORTE: "Chamar a cabine" pela parada sem ela. `true` = o
   * chamado saiu (a conexão estava de pé). Ausente = o cartão não oferece chamar.
   */
  onChamarCabine?: () => boolean
  /** ALAVANCA: "Puxar a alavanca". Ausente = o cartão só lê. Só vale no pino do tipo alavanca. */
  onPullLever?: () => void
  /**
   * LOJA COM PREÇOS: manda o "Quero" da mercadoria `itemId` ao mestre. O
   * cartão fica aberto (quem compra continua olhando a banca). Ausente = a
   * lista aparece, mas sem "Quero".
   */
  onBuy?: (itemId: string) => void
  /** O último "Quero" NESTA banca e onde ele está; ausente = nenhum. */
  compra?: CompraNotice
  /**
   * As escadas do recorte. OBRIGATÓRIO: quando o pino é a passagem de uma
   * ESCADA que leva a outro andar (`Pin.escadaId`), o cartão acha a escada
   * aqui e vira "Subir"/"Descer" — sem imagem, sem descrição de ponto de
   * interesse e, como todo cartão, sem o nome do andar. Ser obrigatório é o
   * que impede quem abre o cartão de esquecer a escada.
   */
  stairs: readonly Stair[]
  /**
   * LEITURA DA PISTA: o cartão abriu com o texto à mostra. Sai uma vez por
   * pino aberto — pacote novo do mesmo pino não repete — e nunca com o pino
   * "só de perto" visto de longe: sai quando o texto chega.
   */
  onRead?: (pinId: string) => void
  /**
   * FECHADURA COM SEGREDO: manda a tentativa ao host. Ausente = o cartão não
   * oferece tentar (a fechadura aparece, mas sem "Tentar").
   */
  onTryLock?: (tentativa: string) => void
  /** A resposta do host à última tentativa NESTE pino; ausente = nenhuma. */
  lockPhase?: LockAnswerPhase
  /** Passagem trancada: o jogador já pediu "Me avise quando der" por este pino. */
  watching?: boolean
  /**
   * Liga (`true`) ou desliga o aviso de quando a passagem trancada abrir.
   * Ausente = o cartão trancado só lê, sem botão.
   */
  onWatch?: (on: boolean) => void
  /**
   * Nenhuma ficha do jogador encosta no pino (`tokenReachesPin`, a regra do
   * host). O cartão abre para leitura, mas a passagem fica apagada com
   * "Chegue mais perto para passar" até a ficha chegar.
   */
  longe?: boolean
}

const TEXTO_LONGE = 'Chegue mais perto para passar'

/** Nome da cabeça do pino para quem não vê o desenho: o que ela mostra no mapa. */
function nomeDaCabeca(pin: PinDoCartao): string {
  if (pin.kind === 'viagem') return 'passagem'
  if (pin.kind === 'alavanca') return 'alavanca'
  if (isPinIcon(pin.icon)) return PIN_ICON_LABELS[pin.icon].toLocaleLowerCase('pt-BR')
  return pin.kind === 'interrogacao' ? 'interrogação' : 'exclamação'
}

/** O que o cartão diz de cada resposta do host. */
const TEXTO_DA_FECHADURA: Record<Exclude<LockAnswerPhase, 'sending'>, string> = {
  wrong: 'Não abre.',
  too_soon: 'Espere um instante antes de tentar de novo.',
  open: 'Abriu.',
}

/** O que o cartão diz da passagem fechada, depois do motivo (ou do "Está trancada"). */
const FECHADA_SEM_PASSAR = 'Não dá para passar por aqui agora.'
/** A trancada que aceita tentativas: quem abre é o mestre. */
const SO_O_MESTRE_ABRE = 'Só o mestre pode abrir.'

/** Etiqueta da passagem cujo par é a chegada oculta (mão única). */
const ETIQUETA_SO_IDA = 'Só ida'
/** O que a pergunta de confirmação acrescenta numa passagem só de ida. */
const AVISO_SO_IDA = 'Não dá para voltar por este caminho.'

/**
 * A CABEÇA DO PINO, igual à do mapa (`pixi/drawPins.ts`): a passagem no pino de
 * viagem (nunca o símbolo escolhido), o símbolo que o mestre escolheu, ou o
 * "!"/"?" de sempre. Liga o que se lê ao que acabou de ser tocado — e, no
 * cartão sem foto, é ela a imagem do cartão. Tem nome para o leitor de tela:
 * o símbolo diz algo ("baú", "armadilha") que o rótulo do cartão não diz.
 */
export function CabecaDoPino({ pin }: { pin: PinDoCartao }) {
  const viagem = pin.kind === 'viagem'
  // A alavanca, como a passagem, desenha o próprio símbolo, nunca o escolhido.
  const alavanca = pin.kind === 'alavanca'
  const simbolo = !viagem && !alavanca && isPinIcon(pin.icon) ? pin.icon : null
  return (
    <span
      className={viagem ? 'pp-pincard__glyph pp-pincard__glyph--viagem' : 'pp-pincard__glyph'}
      role="img"
      aria-label={`Símbolo do pino: ${nomeDaCabeca(pin)}`}
    >
      {viagem ? <PinTravelArt size={16} /> : alavanca ? <PinLeverArt size={16} /> : simbolo !== null ? <PinSymbolArt icon={simbolo} size={16} /> : PIN_GLYPH[pin.kind]}
    </span>
  )
}

/** O que o cartão diz em cada passo da passagem, por modo do pino. */
interface TextosDaPassagem {
  botao: string
  esperando: string
  pergunta: string
  confirmar: string
}

const TEXTOS_PEDE: TextosDaPassagem = {
  botao: 'Pedir para passar',
  esperando: 'Pedido enviado ao mestre',
  pergunta: 'Pedir ao mestre para passar por aqui?',
  confirmar: 'Pedir',
}

/** Trancada que aceita tentativas: não é "passar", é pedir que o mestre abra. */
const TEXTOS_TRANCADA: TextosDaPassagem = {
  botao: 'Pedir ao mestre',
  esperando: 'Pedido enviado ao mestre',
  pergunta: 'Pedir ao mestre para abrir a passagem?',
  confirmar: 'Pedir',
}

/** Livre: ninguém é interrompido, então o cartão não fala em mestre. */
const TEXTOS_LIVRE: TextosDaPassagem = {
  botao: 'Passar',
  esperando: 'Passando…',
  pergunta: 'Passar por aqui?',
  confirmar: 'Passar',
}

/**
 * Passe (crachá, catraca): o cartão não sabe se o jogador tem o passe — o que
 * abre a catraca nunca chega aqui (`lib/fogFilter.ts`). Então ele tenta, e diz
 * de antemão o que acontece sem o passe: o pedido vai ao mestre.
 */
const TEXTOS_PASSE: TextosDaPassagem = {
  botao: 'Passar',
  esperando: PASS_CHECK_TEXT,
  pergunta: 'Passar por aqui? Sem o passe, o pedido vai ao mestre.',
  confirmar: 'Passar',
}

/** Os textos do modo do pino; trancada não oferece botão, e cai nos do pedido. */
function textosDaPassagem(passagem: PinPassage): TextosDaPassagem {
  if (passagem === 'livre') return TEXTOS_LIVRE
  if (passagem === 'passe') return TEXTOS_PASSE
  return TEXTOS_PEDE
}

/**
 * CHAVE ABRE PORTA: o pino trancado que a chave da mochila abre. O cartão diz
 * o nome do item que o jogador já carrega — nunca o que o pino pede — e passa
 * sem falar em mestre, como o livre. Na ESCADA trancada a pergunta fala o
 * sentido ("Usar Chave e subir?"), e nunca o nome do andar.
 */
function textosDaChave(chave: string, direction: StairDirection | undefined): TextosDaPassagem {
  const destino = direction === undefined ? 'passar por aqui' : stairTravelLabel(direction).toLowerCase()
  return {
    botao: `Usar ${chave}`,
    esperando: 'Passando…',
    pergunta: `Usar ${chave} e ${destino}?`,
    confirmar: 'Usar',
  }
}

/**
 * Escada: o cartão fala o sentido ("Subir", "Descer") em vez de "passar por
 * aqui". Livre e passe continuam "Passar" no botão — é o mesmo gesto da porta.
 */
function textosDaEscada(direction: StairDirection, passagem: PinPassage): TextosDaPassagem {
  const verbo = stairTravelLabel(direction)
  const minusculo = verbo.toLowerCase()
  if (passagem === 'livre') return { ...TEXTOS_LIVRE, pergunta: `${verbo} por aqui?` }
  if (passagem === 'passe') return { ...TEXTOS_PASSE, pergunta: `${verbo} por aqui? Sem o passe, o pedido vai ao mestre.` }
  return { ...TEXTOS_PEDE, botao: `Pedir para ${minusculo}`, pergunta: `Pedir ao mestre para ${minusculo}?` }
}

/**
 * O cartão do ponto de interesse, do jeito que o usuário descreveu: "abrir a
 * imagem de um cenário ou um item e embaixo a descrição".
 *
 * Imagem EM CIMA, texto EMBAIXO — nesta ordem no DOM, sem `order` de flex ou
 * posicionamento que desmanche a ordem de leitura: quem enxerga e quem ouve
 * recebem a mesma sequência.
 *
 * SEM IMAGEM, CARTÃO COMPACTO (simulação de 7 jogadores, cenário vila*): a
 * área de 190 px reservada para a foto que o mestre não pôs abria como um
 * retângulo escuro, lido como imagem quebrada, e empurrava o texto para baixo.
 * Sem foto, o cartão é só a cabeça do pino, o texto e os botões — a cabeça
 * sobe para o lugar da imagem (`player.css`, `.pp-pincard--compacto`).
 *
 * Fecha por Escape, pelo botão e por tocar fora. O "fora" é ouvido na janela,
 * na fase de captura, e não por um fundo que cobre a tela: o véu continua
 * pintado, mas não tapa o mapa — o jogador que lê "Está trancada" continua
 * vendo onde está. O toque de fechar que cai no mapa para ali, antes do canvas:
 * fechar o cartão não arrasta o mapa nem abre outro pino.
 */
export function PlayerPinCard({
  pin,
  onClose,
  onRequestTravel,
  travelWaiting = false,
  onTakeItem,
  takeWaiting = false,
  onChamarCabine,
  onPullLever,
  onBuy,
  compra,
  stairs,
  onRead,
  onTryLock,
  lockPhase,
  watching = false,
  onWatch,
  longe = false,
  travelers = NO_TRAVELERS,
}: PlayerPinCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  /**
   * CABINE DE TRANSPORTE: o chamado saiu deste cartão. Some o botão (um toque,
   * um chamado) até o recorte dizer "chamada"; se a parada deixar de dizer
   * "longe" (a cabine chegou, foi chamada), volta a valer só o recorte.
   */
  const [chamou, setChamou] = useState(false)
  const cabineDoPino = pin.kind === 'viagem' ? pin.cabine : undefined
  useEffect(() => {
    if (cabineDoPino !== 'longe') setChamou(false)
  }, [cabineDoPino])
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const askRef = useRef<HTMLButtonElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  /**
   * Pergunta "Pedir ao mestre…?" na tela, no lugar do botão de pedir. Numa
   * encruzilhada guarda a saída escolhida; `saida: null` = o pino de uma saída.
   */
  const [confirming, setConfirming] = useState<{ saida: PinExitLabel | null } | null>(null)
  /** A última saída escolhida: cancelar a pergunta devolve o foco ao botão DELA. */
  const [ultimaSaida, setUltimaSaida] = useState<string | null>(null)
  /** Para onde o foco volta depois de abrir ou fechar a pergunta; `null` = não mexe. */
  const [focusTarget, setFocusTarget] = useState<'confirm' | 'cancel' | 'ask' | null>(null)
  /**
   * ESCOLHER FICHAS NO PINO: as fichas DESMARCADAS no "Quem passa?". Guardar
   * as de fora, e não as de dentro, deixa marcada a ficha que chega perto do
   * pino com a pergunta aberta — ela é do grupo que passaria.
   */
  const [deFora, setDeFora] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    // Quem chegou pelo teclado segue com o foco: abrir a pergunta o leva ao
    // "Pedir"; cancelar o devolve ao botão que a abriu. Passagem SÓ DE IDA não
    // tem desfazer, então a pergunta começa no botão seguro, o "Cancelar":
    // um Enter a mais não derruba o jogador num lugar de onde não volta.
    if (focusTarget === 'confirm') confirmRef.current?.focus()
    if (focusTarget === 'cancel') cancelRef.current?.focus()
    if (focusTarget === 'ask') askRef.current?.focus()
  }, [focusTarget, confirming])

  useEffect(() => {
    // Foco no botão de fechar: quem chegou aqui pelo teclado tem para onde ir,
    // e Escape funciona mesmo sem o foco estar dentro do cartão.
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const alvo = event.target
      if (alvo instanceof Node && cardRef.current?.contains(alvo)) return
      onClose()
      // No mapa, o toque só fecha. Nos painéis ao lado, ele segue para o
      // controle tocado: quem aperta "Centralizar" com o cartão aberto quer
      // as duas coisas.
      if (alvo instanceof HTMLCanvasElement) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [onClose])

  const descricao = pin.description.trim()
  // Pino "só de perto" com a ficha longe: o host não mandou texto nem imagem
  // (`lib/fogFilter.ts`). O cartão diz o que fazer, em vez de fingir que o
  // mestre não escreveu nada. Chegando perto, o próximo pacote traz o texto e
  // este cartão, se estiver aberto, troca sozinho. (Não é a prop `longe`: essa
  // apaga só a passagem; esta esconde o texto do pino "só de perto".)
  const longeParaLer = pin.longe === true

  // O último pino que este cartão já contou como lido: o pacote seguinte do
  // mesmo pino (a cada passo de alguém) não pode virar leitura de novo.
  const lidoRef = useRef<string | null>(null)
  useEffect(() => {
    if (longeParaLer || lidoRef.current === pin.id) return
    lidoRef.current = pin.id
    onRead?.(pin.id)
  }, [pin.id, longeParaLer, onRead])
  // Só data URL vira foto: se um caminho de disco escapasse até aqui, o
  // `<img>` tentaria abrir o computador do mestre pelo navegador do jogador.
  const foto = isPlayerSafePinImage(pin.image) ? pin.image : null
  const textoDoCartao = longeParaLer
    ? 'Chegue mais perto para ler.'
    : descricao === ''
      ? 'O mestre ainda não escreveu nada sobre este ponto.'
      : descricao
  const altDaImagem =
    foto !== null
      ? 'Imagem deixada pelo mestre neste ponto de interesse'
      : longeParaLer
        ? 'Chegue mais perto para ver a imagem'
        : 'Este ponto de interesse ainda não tem imagem'
  // Pino de viagem: o cartão é o de sempre (imagem e descrição do mestre), com
  // a passagem no lugar do glifo — a mesma cabeça que o jogador vê no mapa.
  // O nome da cena de destino nunca chega aqui (`lib/fogFilter.ts`).
  const viagem = pin.kind === 'viagem'
  // ALAVANCA: qual porta ela move nunca chega aqui (`lib/fogFilter.ts`); o
  // cartão só oferece puxar, e o que mudou o jogador vê no mapa.
  const alavanca = pin.kind === 'alavanca'
  // O símbolo que o mestre escolheu (baú, armadilha…) é o que o jogador vê no
  // mapa: o cartão repete o mesmo desenho e o nome dele, em vez do "!" do
  // tipo. Nome desconhecido (versão futura) cai no glifo, como no mapa.
  const icone = !viagem && !alavanca && isPinIcon(pin.icon) ? pin.icon : null
  const nome = viagem
    ? 'Passagem'
    : alavanca
      ? 'Alavanca'
      : icone !== null
        ? `Ponto de interesse — ${PIN_ICON_LABELS[icone]}`
        : `Ponto de interesse ${PIN_GLYPH[pin.kind]}`
  // O modo vem no recorte (o destino, não). Trancada MUDA não oferece botão
  // nenhum: um "Pedir" que o host sempre recusa só ensinaria o jogador a
  // insistir. Trancada que aceita tentativas oferece "Pedir ao mestre".
  const passagem = passageOf(pin)
  // FECHADURA COM SEGREDO: vem no recorte só enquanto está fechada (forma e,
  // nos volantes, casas; a resposta mora no host). Fechada, a passagem também não abre: o
  // cartão oferece a combinação no lugar do "Pedir para passar".
  const fechadura = pin.fechadura
  const trancadaComSegredo = viagem && fechadura !== undefined
  const trancada = viagem && passagem === 'trancada' && !trancadaComSegredo
  // CABINE DE TRANSPORTE: só se passa com a cabine AQUI (e livre) — longe,
  // chamada ou ocupada, o host recusaria. A frase não diz onde a cabine está
  // nem quem está nela: o recorte nem sabe. Longe, oferece chamá-la. Fechada
  // com segredo também não chama: primeiro a combinação.
  const cabine = cabineDoPino
  const semCabine = cabine !== undefined && cabine !== 'aqui'
  const podeChamar = !trancada && !trancadaComSegredo && cabine === 'longe' && !chamou && onChamarCabine !== undefined
  // CHAVE ABRE PORTA: o host só manda `chave` a quem encosta no pino com o
  // item. O mapa chega da rede sem conferência campo a campo: só texto vale.
  const chave = trancada && typeof pin.chave === 'string' && pin.chave !== '' ? pin.chave : null
  const muda = trancada && pin.mudo === true
  // MARCO visto de longe (`soMarco`): o jogador enxerga o Templo, mas nunca
  // esteve lá — o host recusa a passagem, então o cartão nem oferece.
  const naoChegou = viagem && !trancada && !trancadaComSegredo && pin.soMarco === true
  // Muda só abre com a chave; a que aceita tentativas vira pedido ao mestre.
  // Com segredo, só a combinação abre. Cabine longe, chamada ou ocupada também
  // bloqueia, como a trancada.
  const podePedir =
    viagem &&
    !trancadaComSegredo &&
    (!muda || chave !== null) &&
    !naoChegou &&
    !semCabine &&
    onRequestTravel !== undefined
  // Escada: o sentido vem da escada do recorte (`lib/fogFilter.ts` só manda o pino junto com ela).
  const stairDirection: StairDirection | undefined =
    viagem && pin.escadaId !== undefined ? stairs.find((s) => s.id === pin.escadaId)?.direction : undefined
  const escada = stairDirection !== undefined ? stairTravelLabel(stairDirection) : null
  // A chave vence o modo: escada trancada com a chave na mochila também vira
  // "Usar <chave>" — o host deixa passar (`hostSession`), então o cartão não
  // pode esconder o gesto. Sem chave, a trancada que aceita tentativas pede ao
  // mestre para abrir (escada ou não).
  const textos =
    chave !== null
      ? textosDaChave(chave, stairDirection)
      : trancada
        ? TEXTOS_TRANCADA
        : stairDirection !== undefined
          ? textosDaEscada(stairDirection, passagem)
          : textosDaPassagem(passagem)
  // O PORQUÊ da passagem fechada ("Desabou"). Valor desconhecido (host de
  // versão futura) cai no "Está trancada" de sempre, sem mostrar o cru.
  const motivo = blockReasonOf(pin)
  // ENCRUZILHADA: com mais de uma saída, um botão por saída, pelo rótulo que o
  // mestre escreveu — o destino e o nome da cena nunca chegam aqui. Com uma
  // saída só (ou sem o campo), o cartão é o de sempre. Longe de uma placa "só
  // de perto", o recorte já manda "Saída N"; o cartão repete a regra para que
  // nenhum nome escrito na placa apareça ao lado de "Chegue mais perto".
  const recebidas = viagem ? (pin.escolhas ?? []) : []
  const escolhas = longeParaLer ? unreadExitLabels(recebidas) : recebidas
  const encruzilhada = escolhas.length > 1
  // ITEM PEGÁVEL: o nome vem no recorte, numa cópia limpa (`lib/fogFilter.ts`).
  const item = itemOfPin(pin)
  // SÓ IDA: o par é a chegada oculta. No pino de uma saída vem em `semVolta`;
  // numa encruzilhada, por saída (`soIda`). O destino continua sem aparecer.
  const semVolta = viagem && !encruzilhada && pin.semVolta === true
  const saidaSoIda = (saida: PinExitLabel | null): boolean => (saida === null ? semVolta : saida.soIda === true)
  // LOJA COM PREÇOS: relida aqui — o mapa da rede não é conferido campo a
  // campo, e mercadoria torta não pode quebrar o cartão. `null` = sem banca.
  const mercadorias = lojaParaJogador(pin)
  // ESCOLHER FICHAS NO PINO: só com duas ou mais há o que escolher.
  const escolheFichas = travelers.length > 1
  const marcadas = travelers.filter((f) => !deFora.has(f.id)).map((f) => f.id)
  const alternarFicha = (id: string) => {
    setDeFora((antes) => {
      const depois = new Set(antes)
      if (!depois.delete(id)) depois.add(id)
      return depois
    })
  }
  const perguntar = (saida: PinExitLabel | null) => {
    // Cada pergunta começa com o grupo inteiro marcado.
    setDeFora(new Set())
    setConfirming({ saida })
    if (saida !== null) setUltimaSaida(saida.id)
    setFocusTarget(saidaSoIda(saida) ? 'cancel' : 'confirm')
  }
  const perguntaBase =
    confirming === null || confirming.saida === null
      ? textos.pergunta
      : chave !== null
        ? `Usar ${chave} e passar por ${confirming.saida.rotulo}?`
        : passagem === 'livre' || passagem === 'passe'
          ? `Passar por ${confirming.saida.rotulo}?`
          : `Pedir ao mestre para passar por ${confirming.saida.rotulo}?`
  const pergunta = confirming !== null && saidaSoIda(confirming.saida) ? `${perguntaBase} ${AVISO_SO_IDA}` : perguntaBase

  return (
    <div className="pp-pincard__backdrop">
      <div
        ref={cardRef}
        className={foto === null ? 'pp-pincard pp-pincard--compacto' : 'pp-pincard'}
        role="dialog"
        aria-modal="true"
        aria-label={escada ?? nome}
      >
        {escada === null && foto !== null && <img className="pp-pincard__image" src={foto} alt={altDaImagem} />}
        <div className="pp-pincard__body">
          <CabecaDoPino pin={pin} />
          {/* Escada: só o sentido. O pino dela não tem texto do mestre, e "o
              mestre ainda não escreveu nada" leria como ponto de interesse vazio.
              Pino "só de perto" visto de longe: "Chegue mais perto para ler". */}
          <p className="pp-pincard__text">{escada ?? textoDoCartao}</p>
        </div>
        {mercadorias !== null && <PlayerLoja mercadorias={mercadorias} onBuy={onBuy} compra={compra} />}
        {item !== null && (
          // Pegar não pede confirmação: no modo "pede" o mestre ainda decide, e
          // no livre o item só troca do chão para a mochila — "Dar a…" desfaz.
          <div className="pp-pincard__item">
            <p className="pp-pincard__question">{item.nome}</p>
            {onTakeItem !== undefined && (
              <button type="button" className="pp-pincard__travel" disabled={takeWaiting} onClick={onTakeItem}>
                {takeWaiting ? 'Pedido enviado ao mestre' : 'Pegar'}
              </button>
            )}
          </div>
        )}
        {alavanca && onPullLever !== undefined && (
          // Sem confirmação, como o "Pegar": puxar de novo desfaz, e a porta
          // que o jogador enxerga mostra na hora o que mudou.
          <button type="button" className="pp-pincard__travel" onClick={onPullLever}>
            Puxar a alavanca
          </button>
        )}
        {semVolta && <span className="pp-pincard__oneway pp-pincard__oneway--card">{ETIQUETA_SO_IDA}</span>}
        {trancada && chave === null && (
          // Muda: "Não dá para passar"; a que aceita tentativas: "Só o mestre
          // pode abrir". Com motivo ("Desabou"), ele vem no lugar do "Está trancada".
          <p className="pp-pincard__locked">
            {motivo === null ? (
              `Está trancada. ${muda ? FECHADA_SEM_PASSAR : SO_O_MESTRE_ABRE}`
            ) : (
              <>
                <strong className="pp-pincard__reason">{PIN_BLOCK_REASON_LABELS[motivo]}.</strong>{' '}
                {muda ? FECHADA_SEM_PASSAR : SO_O_MESTRE_ABRE}
              </>
            )}
          </p>
        )}
        {trancada && chave === null && onWatch !== undefined && (
          // Botão de alternar: o rótulo fica o mesmo e o estado mora no
          // `aria-pressed` (e na frase logo abaixo, para quem enxerga).
          <>
            <button
              type="button"
              className="pp-pincard__watch"
              aria-pressed={watching}
              onClick={() => onWatch(!watching)}
            >
              Me avise quando der
            </button>
            {watching && <p className="pp-pincard__watch-hint">Você recebe um aviso quando abrir.</p>}
          </>
        )}
        {naoChegou && <p className="pp-pincard__locked">Dá para ver daqui, mas para passar é preciso chegar até lá.</p>}
        {trancadaComSegredo && <p className="pp-pincard__locked">Trancada com segredo. Acerte a combinação para passar.</p>}
        {fechadura !== undefined && (
          // A chave é o pino, a forma e (nos volantes) as casas: outro cadeado começa zerado.
          <PlayerLockPad key={`${pin.id}|${fechadura.forma}|${fechadura.forma === 'volantes' ? fechadura.casas : ''}`} pinId={pin.id} lock={fechadura} sending={lockPhase === 'sending'} onTry={onTryLock} />
        )}
        {lockPhase !== undefined && lockPhase !== 'sending' && (
          // Fora da fechadura: o "Abriu." fica depois que o snapshot novo tira a fechadura do pino.
          <p className={lockPhase === 'open' ? 'pp-lock__status pp-lock__status--open' : 'pp-lock__status'} role="status">
            {TEXTO_DA_FECHADURA[lockPhase]}
          </p>
        )}
        {!trancada && cabine === 'longe' && (
          <p className="pp-pincard__locked" role="status">
            {chamou ? 'A cabine não está aqui. Você chamou a cabine.' : 'A cabine não está aqui. Não dá para passar agora.'}
          </p>
        )}
        {!trancada && cabine === 'chamada' && <p className="pp-pincard__locked">A cabine foi chamada para cá. Espere ela chegar.</p>}
        {!trancada && cabine === 'ocupada' && <p className="pp-pincard__locked">A cabine está aqui, mas alguém já embarcou. Espere ela voltar.</p>}
        {/* A mesma moldura de estado: diz onde a cabine está, sem convidar toque. */}
        {!trancada && cabine === 'aqui' && <p className="pp-pincard__locked">A cabine está aqui.</p>}
        {podeChamar && (
          <button
            type="button"
            className="pp-pincard__travel"
            onClick={() => {
              if (onChamarCabine === undefined || !onChamarCabine()) return
              setChamou(true)
              // O botão some: o foco não pode cair no nada — vai ao "Fechar".
              closeRef.current?.focus()
            }}
          >
            Chamar a cabine
          </button>
        )}
        {podePedir && confirming === null && !encruzilhada && (
          <button
            ref={askRef}
            type="button"
            className="pp-pincard__travel"
            disabled={travelWaiting || longe}
            onClick={() => perguntar(null)}
          >
            {travelWaiting ? textos.esperando : longe ? TEXTO_LONGE : textos.botao}
          </button>
        )}
        {/* Encruzilhada ou pergunta aberta: o botão não tem onde dizer, então a moldura de estado diz. */}
        {podePedir && longe && !travelWaiting && (encruzilhada || confirming !== null) && (
          <p className="pp-pincard__locked">{TEXTO_LONGE}</p>
        )}
        {podePedir && confirming === null && encruzilhada && (
          // Uma saída por botão, na ordem do mestre. Esperando o mestre, todas
          // ficam desligadas: um pedido por vez, como no cartão simples.
          <>
            {/* A mesma moldura de estado do "Está trancada": diz o que aconteceu, sem convidar toque. */}
            {travelWaiting && <p className="pp-pincard__locked">{textos.esperando}</p>}
            <ul className="pp-pincard__exits" aria-label="Saídas">
              {escolhas.map((saida, index) => (
                <li key={saida.id}>
                  <button
                    ref={saida.id === ultimaSaida || (ultimaSaida === null && index === 0) ? askRef : undefined}
                    type="button"
                    className="pp-pincard__travel"
                    disabled={travelWaiting || longe}
                    onClick={() => perguntar(saida)}
                  >
                    {saida.rotulo}
                    {saida.soIda === true && (
                      <>
                        {' '}
                        <span className="pp-pincard__oneway">{ETIQUETA_SO_IDA}</span>
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {podePedir && confirming !== null && (
          // Confirmação antes de mandar: no modo "pede" o pedido interrompe o
          // mestre, e no livre o jogador troca de cena — nos dois, um toque
          // sem querer não pode virar a ação.
          <div className="pp-pincard__confirm" role="group" aria-labelledby={`pp-travel-ask-${pin.id}`}>
            <p id={`pp-travel-ask-${pin.id}`} className="pp-pincard__question">
              {pergunta}
            </p>
            {escolheFichas && (
              // Uma caixa por ficha, todas marcadas: é quem passaria sem escolher.
              <fieldset className="pp-pincard__travelers">
                <legend>Quem passa?</legend>
                {travelers.map((ficha) => (
                  <label key={ficha.id} className="pp-pincard__traveler">
                    <input type="checkbox" checked={!deFora.has(ficha.id)} onChange={() => alternarFicha(ficha.id)} />
                    <span>{ficha.name}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <div className="pp-pincard__choices">
              <button
                ref={confirmRef}
                type="button"
                className="pp-pincard__travel"
                // Longe do pino ou ninguém marcado: o pedido não sai.
                disabled={longe || (escolheFichas && marcadas.length === 0)}
                onClick={() => {
                  const saida = confirming.saida
                  if (escolheFichas && marcadas.length === 0) return
                  setConfirming(null)
                  // Sem escolha, o pedido sai com os mesmos argumentos de antes.
                  if (!escolheFichas) {
                    if (saida === null) onRequestTravel()
                    else onRequestTravel(saida.id)
                    return
                  }
                  onRequestTravel(saida?.id, marcadas)
                }}
              >
                {textos.confirmar}
              </button>
              <button
                ref={cancelRef}
                type="button"
                className="pp-pincard__close pp-pincard__close--inline"
                onClick={() => {
                  setConfirming(null)
                  setFocusTarget('ask')
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        <button ref={closeRef} type="button" className="pp-pincard__close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}

interface PlayerLojaProps {
  mercadorias: readonly LojaItem[]
  onBuy?: (itemId: string) => void
  compra?: CompraNotice
}

/**
 * LOJA COM PREÇOS: a banca no cartão. Uma linha por mercadoria — nome, preço,
 * estoque ("Acabou" quando não há) e "Quero". O "Quero" diz no nome acessível
 * QUAL mercadoria ("Quero Xarope de tosse"): uma lista de botões iguais não
 * diria nada a quem navega por leitor de tela. Com um pedido esperando o
 * mestre, nenhum "Quero" liga: um pedido por vez, como o host exige.
 */
function PlayerLoja({ mercadorias, onBuy, compra }: PlayerLojaProps) {
  const esperando = compra?.phase === 'sent'
  return (
    <section className="pp-loja" aria-labelledby="pp-loja-titulo">
      <h3 id="pp-loja-titulo" className="pp-loja__titulo">
        Mercadorias
      </h3>
      <ul className="pp-loja__lista" aria-label="Mercadorias">
        {mercadorias.map((mercadoria) => {
          const estoque = textoDoEstoque(mercadoria)
          return (
            <li key={mercadoria.id} className="pp-loja__item">
              <span className="pp-loja__nome">{mercadoria.nome}</span>
              {mercadoria.preco.trim() !== '' && <span className="pp-loja__preco">{mercadoria.preco}</span>}
              {estoque !== null && (
                <span className={mercadoria.estoque === 0 ? 'pp-loja__estoque pp-loja__estoque--acabou' : 'pp-loja__estoque'}>{estoque}</span>
              )}
              {onBuy !== undefined && (
                <button
                  type="button"
                  className="pp-loja__quero"
                  aria-label={`Quero ${mercadoria.nome}`}
                  disabled={esperando || mercadoria.estoque === 0}
                  onClick={() => onBuy(mercadoria.id)}
                >
                  Quero
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {compra !== undefined && (
        <p className={compra.phase === 'sold' ? 'pp-loja__status pp-loja__status--ok' : 'pp-loja__status'} role="status">
          {compraNoticeText(compra)}
        </p>
      )}
    </section>
  )
}
