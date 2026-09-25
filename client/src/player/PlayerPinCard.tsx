import { useEffect, useRef, useState } from 'react'
import type { LojaItem, Pin, PinExitLabel, Stair, StairDirection } from '../types/map'
import { PIN_GLYPH, PIN_ICON_LABELS, isPinIcon, isPlayerSafePinImage, passageOf } from '../lib/pins'
import { itemOfPin } from '../lib/items'
import { lojaParaJogador, textoDoEstoque } from '../lib/loja'
import { compraNoticeText } from './compraNotice'
import type { CompraNotice } from './playerConnection'
import { stairTravelLabel } from '../lib/stairTravel'
import { PinLeverArt, PinSymbolArt, PinTravelArt } from '../components/PinSymbolArt'
import type { PinTravelChoice } from '../lib/pinTravelers'

const NO_TRAVELERS: readonly PinTravelChoice[] = []

interface PlayerPinCardProps {
  pin: Pin
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
}

/** Nome da cabeça do pino para quem não vê o desenho: o que ela mostra no mapa. */
function nomeDaCabeca(pin: Pin): string {
  if (pin.kind === 'viagem') return 'passagem'
  if (pin.kind === 'alavanca') return 'alavanca'
  if (isPinIcon(pin.icon)) return PIN_ICON_LABELS[pin.icon].toLocaleLowerCase('pt-BR')
  return pin.kind === 'interrogacao' ? 'interrogação' : 'exclamação'
}

/**
 * A CABEÇA DO PINO, igual à do mapa (`pixi/drawPins.ts`): a passagem no pino de
 * viagem (nunca o símbolo escolhido), o símbolo que o mestre escolheu, ou o
 * "!"/"?" de sempre. Liga o que se lê ao que acabou de ser tocado — e, no
 * cartão sem foto, é ela a imagem do cartão. Tem nome para o leitor de tela:
 * o símbolo diz algo ("baú", "armadilha") que o rótulo do cartão não diz.
 */
export function CabecaDoPino({ pin }: { pin: Pin }) {
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
 * aqui". Livre continua "Passar" no botão — é o mesmo gesto da porta livre.
 */
function textosDaEscada(direction: StairDirection, livre: boolean): TextosDaPassagem {
  const verbo = stairTravelLabel(direction)
  const minusculo = verbo.toLowerCase()
  if (livre) return { ...TEXTOS_LIVRE, pergunta: `${verbo} por aqui?` }
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
  /**
   * Pergunta "Pedir ao mestre…?" na tela, no lugar do botão de pedir. Numa
   * encruzilhada guarda a saída escolhida; `saida: null` = o pino de uma saída.
   */
  const [confirming, setConfirming] = useState<{ saida: PinExitLabel | null } | null>(null)
  /** A última saída escolhida: cancelar a pergunta devolve o foco ao botão DELA. */
  const [ultimaSaida, setUltimaSaida] = useState<string | null>(null)
  /** Para onde o foco volta depois de abrir ou fechar a pergunta; `null` = não mexe. */
  const [focusTarget, setFocusTarget] = useState<'confirm' | 'ask' | null>(null)
  /**
   * ESCOLHER FICHAS NO PINO: as fichas DESMARCADAS no "Quem passa?". Guardar
   * as de fora, e não as de dentro, deixa marcada a ficha que chega perto do
   * pino com a pergunta aberta — ela é do grupo que passaria.
   */
  const [deFora, setDeFora] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    // Quem chegou pelo teclado segue com o foco: abrir a pergunta o leva ao
    // "Pedir"; cancelar o devolve ao botão que a abriu.
    if (focusTarget === 'confirm') confirmRef.current?.focus()
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
  // Só data URL vira foto: se um caminho de disco escapasse até aqui, o
  // `<img>` tentaria abrir o computador do mestre pelo navegador do jogador.
  const foto = isPlayerSafePinImage(pin.image) ? pin.image : null
  // Pino de viagem: o cartão é o de sempre (imagem e descrição do mestre), com
  // a passagem no lugar do glifo — a mesma cabeça que o jogador vê no mapa.
  // O nome da cena de destino nunca chega aqui (`lib/fogFilter.ts`).
  const viagem = pin.kind === 'viagem'
  // ALAVANCA: qual porta ela move nunca chega aqui (`lib/fogFilter.ts`); o
  // cartão só oferece puxar, e o que mudou o jogador vê no mapa.
  const alavanca = pin.kind === 'alavanca'
  // O modo vem no recorte (o destino, não). Trancada MUDA não oferece botão
  // nenhum: um "Pedir" que o host sempre recusa só ensinaria o jogador a
  // insistir. Trancada que aceita tentativas oferece "Pedir ao mestre".
  const passagem = passageOf(pin)
  const trancada = viagem && passagem === 'trancada'
  // CABINE DE TRANSPORTE: só se passa com a cabine AQUI (e livre) — longe,
  // chamada ou ocupada, o host recusaria. A frase não diz onde a cabine está
  // nem quem está nela: o recorte nem sabe. Longe, oferece chamá-la.
  const cabine = cabineDoPino
  const semCabine = cabine !== undefined && cabine !== 'aqui'
  const podeChamar = !trancada && cabine === 'longe' && !chamou && onChamarCabine !== undefined
  // CHAVE ABRE PORTA: o host só manda `chave` a quem encosta no pino com o
  // item. O mapa chega da rede sem conferência campo a campo: só texto vale.
  const chave = trancada && typeof pin.chave === 'string' && pin.chave !== '' ? pin.chave : null
  const muda = trancada && pin.mudo === true
  // Muda só abre com a chave; a que aceita tentativas vira pedido ao mestre.
  // Cabine longe, chamada ou ocupada também bloqueia, como a trancada.
  const podePedir = viagem && (!muda || chave !== null) && !semCabine && onRequestTravel !== undefined
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
          ? textosDaEscada(stairDirection, passagem === 'livre')
          : passagem === 'livre'
            ? TEXTOS_LIVRE
            : TEXTOS_PEDE
  // ENCRUZILHADA: com mais de uma saída, um botão por saída, pelo rótulo que o
  // mestre escreveu — o destino e o nome da cena nunca chegam aqui. Com uma
  // saída só (ou sem o campo), o cartão é o de sempre.
  const escolhas = viagem ? (pin.escolhas ?? []) : []
  const encruzilhada = escolhas.length > 1
  // ITEM PEGÁVEL: o nome vem no recorte, numa cópia limpa (`lib/fogFilter.ts`).
  const item = itemOfPin(pin)
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
    setFocusTarget('confirm')
  }
  const pergunta =
    confirming === null || confirming.saida === null
      ? textos.pergunta
      : chave !== null
        ? `Usar ${chave} e passar por ${confirming.saida.rotulo}?`
        : passagem === 'livre'
          ? `Passar por ${confirming.saida.rotulo}?`
          : `Pedir ao mestre para passar por ${confirming.saida.rotulo}?`

  return (
    <div className="pp-pincard__backdrop">
      <div
        ref={cardRef}
        className={foto === null ? 'pp-pincard pp-pincard--compacto' : 'pp-pincard'}
        role="dialog"
        aria-modal="true"
        aria-label={escada ?? (viagem ? 'Passagem' : alavanca ? 'Alavanca' : `Ponto de interesse ${PIN_GLYPH[pin.kind]}`)}
      >
        {escada === null && foto !== null && <img className="pp-pincard__image" src={foto} alt="Imagem deixada pelo mestre neste ponto de interesse" />}
        <div className="pp-pincard__body">
          <CabecaDoPino pin={pin} />
          {/* Escada: só o sentido. O pino dela não tem texto do mestre, e "o
              mestre ainda não escreveu nada" leria como ponto de interesse vazio. */}
          <p className="pp-pincard__text">
            {escada ?? (descricao === '' ? 'O mestre ainda não escreveu nada sobre este ponto.' : descricao)}
          </p>
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
        {muda && chave === null && <p className="pp-pincard__locked">Está trancada. Não dá para passar por aqui agora.</p>}
        {trancada && !muda && chave === null && <p className="pp-pincard__locked">Está trancada. Só o mestre pode abrir.</p>}
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
            disabled={travelWaiting}
            onClick={() => perguntar(null)}
          >
            {travelWaiting ? textos.esperando : textos.botao}
          </button>
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
                    disabled={travelWaiting}
                    onClick={() => perguntar(saida)}
                  >
                    {saida.rotulo}
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
                // Ninguém marcado, ninguém passa: o pedido não sai.
                disabled={escolheFichas && marcadas.length === 0}
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
