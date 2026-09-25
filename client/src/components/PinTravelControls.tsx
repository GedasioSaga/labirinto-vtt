import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { PinTravel, TravelPinOption, TravelSceneOption } from '../lib/pinTravel'
import { EXIT_EXTRA_MAX_COUNT, EXIT_LABEL_MAX_LENGTH, isArrivalOnly, travelExitsOf, travelPlaceName, travelSceneLabel } from '../lib/pinTravel'
import { PIN_BLOCK_REASON_LABELS, PIN_BLOCK_REASON_NONE_LABEL, PIN_BLOCK_REASON_ORDER, PIN_PASSAGE_LABELS, PIN_PASSAGE_ORDER, passageOf } from '../lib/pins'
import { SCENE_FILTER_MIN, sceneSearchSummary, sceneSearchWords, searchScenes } from '../lib/sceneSearch'
import type { PinBlockReason, PinPassage } from '../types/map'
import { ChevronDownIcon } from './icons'
import { DoorKeyField } from './WallDoorControls'
import { SceneChoice, SceneSearchField } from './SceneSearch'

/** Uma saída do pino, como o painel a mostra. */
export interface PinTravelExitView {
  id: string
  /** O nome que o mestre deu ("Porta da cripta"); vazio = sem nome. */
  rotulo: string
  /** Para onde ela leva agora. */
  travel: PinTravel
}

export interface PinTravelControlsProps {
  /**
   * As saídas do pino aberto no painel, a principal primeiro. Pino sem
   * ligação tem uma só, "Sem destino". Com MAIS de uma é uma encruzilhada, e
   * cada saída ganha o seu bloco com "Nome da saída".
   */
  exits: readonly PinTravelExitView[]
  /** Para onde ele pode levar: "Esta cena" (o atalho, marcada com `here`) e as outras cenas da aventura. */
  scenes: readonly TravelSceneOption[]
  /** Pinos de viagem de uma cena, para ligar a um que já está lá. */
  pinsIn: (sceneId: string) => readonly TravelPinOption[]
  /** Cria o pino de chegada (no centro de `sceneId`, ou ao lado deste pino no atalho) e liga a saída `exitId` (`null` = uma saída nova). */
  onLinkNew: (sceneId: string, exitId: string | null) => void
  onLinkExisting: (sceneId: string, pinId: string, exitId: string | null) => void
  /**
   * "+ Cena nova…": cria a cena `nome` com o pino de chegada no centro e liga
   * a saída `exitId` (`null` = uma saída nova) — sem trocar a cena aberta. Sem
   * ele, a escolha só oferece as cenas que já existem.
   */
  onCreateScene?: (nome: string, exitId: string | null) => void
  onUnlink: (exitId: string) => void
  /** Grava o nome da saída (ao sair do campo). */
  onRename: (exitId: string, rotulo: string) => void
  /** Leva a visão do mestre pela saída — o mesmo que o clique com Selecionar faz pela principal. */
  onGo: (exitId: string) => void
  /** Como o jogador passa por ESTE pino (o par tem o seu). Vale para todas as saídas. */
  passage: PinPassage
  onPassageChange: (passage: PinPassage) => void
  /** CHAVE ABRE PORTA: o "Abre com" do pino trancado ("" = sem chave). */
  keyName?: string
  /**
   * Grava o "Abre com" ("" tira), ao sair do campo ou no Enter. Sem ele, o
   * campo não aparece; com ele, só aparece com a passagem "Trancada".
   */
  onKeyChange?: (nome: string) => void
  /**
   * Só vale com "Trancada": o jogador pode "Pedir ao mestre" (ligada, o
   * padrão) ou a passagem é muda (desligada) — nenhum pedido chega.
   * Ausente = ligada. Sem `onAcceptsAttemptsChange`, o botão não aparece.
   */
  acceptsAttempts?: boolean
  onAcceptsAttemptsChange?: (on: boolean) => void
  /** Por que a passagem está trancada; `undefined` = "Trancada" (a chave). Só aparece no modo trancada. */
  motivo: PinBlockReason | undefined
  onMotivoChange: (motivo: PinBlockReason | undefined) => void
  /** MÃO ÚNICA da saída `exitId`: marca (ou desmarca) o par dela como chegada oculta. */
  onOneWayChange: (exitId: string, on: boolean) => void
  /**
   * TRANCAR OS DOIS LADOS: `true` tranca este pino e o par de cada saída
   * ligada; `false` devolve todos a "Pede ao mestre". Qual dos dois o botão
   * oferece, o painel decide lendo este pino e os pares.
   */
  onBothSidesChange: (trancar: boolean) => void
  /**
   * ESTE pino é a chegada oculta de uma mão única: o painel diz "Só chegada"
   * e não oferece "Leva a…", passagem nem saída nova — ele não leva a lugar
   * nenhum. Quem desfaz é o "Mão única" do pino de origem.
   */
  arrivalOnly: boolean
}

/**
 * Onde está a escolha de "Leva a…": fechada, escolhendo a cena, ou escolhendo
 * o pino de lá. `saida` é a saída que a escolha liga; `null` = "+ Outra saída".
 */
type Escolha =
  | { passo: 'cena'; saida: string | null }
  | { passo: 'pino'; sceneId: string; saida: string | null }
  | { passo: 'nova'; saida: string | null }
  | null

/** Ids fixos: só existe um pino aberto no painel por vez (o mesmo molde de `lb-pin-description`). */
const STATUS_ID = 'lb-pin-travel-status'
const SELETOR_ID = 'lb-pin-travel-picker'
const CENAS_ID = 'lb-pin-travel-scenes'
const CENAS_LISTA_ID = 'lb-pin-travel-scene-list'
const PINOS_ID = 'lb-pin-travel-pins'
const PASSAGEM_ID = 'lb-pin-travel-passage'
const MOTIVO_ID = 'lb-pin-travel-reason'
const NOME_ID = 'lb-pin-travel-exit-name'
const MAO_UNICA_ID = 'lb-pin-travel-one-way'
const BUSCA_ID = 'lb-pin-travel-search'
const NOVA_ID = 'lb-pin-travel-new-scene'
const NOVA_DICA_ID = 'lb-pin-travel-new-scene-hint'
const NOVA_ERRO_ID = 'lb-pin-travel-new-scene-error'

/** O mesmo teto do nome no "+ Nova cena" de Cenas. */
const NOME_DA_CENA_MAX = 80
const DOIS_LADOS_ID = 'lb-pin-travel-both-sides'

/** A chave do gatilho que abriu a escolha: o id da saída, ou esta para "+ Outra saída". */
const GATILHO_NOVA = '+nova'

/** O que cada modo faz, dito ao mestre logo abaixo da escolha. */
const EFEITO_DA_PASSAGEM: Record<PinPassage, string> = {
  pede: 'O jogador pede e você decide se ele passa.',
  livre: 'O jogador passa sozinho; você só lê que ele chegou.',
  trancada: 'Ninguém passa por aqui, e nenhum pedido chega a você.',
}

/** Trancada que aceita tentativas: o jogador ainda pode pedir. */
const EFEITO_TRANCADA_COM_PEDIDO = 'Ninguém passa sozinho; o jogador pode pedir e você decide.'

const TENTATIVAS_ID = 'lb-pin-travel-attempts'

/** Foco depois do render: quem o recebe pode ter acabado de nascer (ou de trocar de pino). */
function focarDepois(achar: () => HTMLElement | null | undefined): void {
  requestAnimationFrame(() => achar()?.focus())
}

function detalhe(travel: PinTravel, temCena: boolean, algumaAbre: boolean, podeCriar: boolean, algumaCarregando: boolean): string {
  if (travel.status === 'indisponivel') {
    return travel.loading === true ? 'A cena ainda está sendo lida do disco.' : 'A cena não abriu: o arquivo dela não foi encontrado.'
  }
  if (travel.status === 'ligado') {
    const descricao = travel.partner.description.trim()
    return descricao === '' ? 'até um pino sem descrição' : `até “${descricao}”`
  }
  if (!temCena) return podeCriar ? 'Nenhuma outra cena ainda: crie uma nova em “Leva a…”.' : 'Crie outra cena em Cenas para ter para onde levar.'
  if (!algumaAbre) {
    if (podeCriar) return 'As outras cenas não abriram; crie uma nova em “Leva a…”.'
    return algumaCarregando ? 'As outras cenas ainda estão sendo lidas do disco.' : 'As outras cenas não abriram.'
  }
  return 'Escolha a cena e o pino de chegada.'
}

/** "Leva a Cripta" ou "Sem destino": o título de uma saída. */
function TituloDoDestino({ travel }: { travel: PinTravel }) {
  if (travel.status === 'sem-destino') return <span className="lb-travel__title">Sem destino</span>
  return (
    <span className="lb-travel__title">
      Leva a <strong className="lb-travel__scene">{travel.status === 'ligado' ? travelPlaceName(travel) : travel.sceneName}</strong>
    </span>
  )
}

/**
 * Destino do PINO DE VIAGEM, dentro do painel do pino (a mesma `section`).
 *
 * Primeiro o que é, em texto: "Leva a Cripta" com o pino par embaixo, ou
 * "Sem destino". Depois o que dá para fazer. "Leva a…" abre a escolha em dois
 * passos, no próprio painel: a cena, e lá o pino de chegada — criar um novo,
 * que nasce no centro da cena, ou ligar a um pino de viagem que já está lá.
 *
 * ENCRUZILHADA: ligado, o pino oferece "+ Outra saída", que abre a mesma
 * escolha para uma saída NOVA. Com duas ou mais, cada saída vira um bloco com
 * o destino, o campo "Nome da saída" (o que o jogador lê no botão dele) e as
 * ações dela; o pino de uma saída continua com a cara de sempre.
 *
 * A régua à esquerda do bloco diz o estado sem depender de ler: latão quando
 * a passagem leva a algum lugar, apagada quando não — a mesma troca que o
 * ícone faz no mapa.
 *
 * Teclado: Esc fecha a escolha e devolve o foco a quem a abriu; as setas andam
 * entre as opções; depois de ligar, desligar ou atravessar, o foco vai para a
 * frase do destino, que é o que mudou (e o leitor de tela a lê: `aria-live`).
 *
 * BUSCA: com muitas cenas (`SCENE_FILTER_MIN`), a escolha abre com o foco num
 * campo de busca; cada cena mostra o caminho em cinza embaixo do nome. Enter
 * no campo vai direto para a chegada da primeira achada que abre; a seta desce
 * do campo para as achadas; Esc com texto só limpa a busca.
 */
export function PinTravelControls({
  exits,
  scenes,
  pinsIn,
  onLinkNew,
  onLinkExisting,
  onCreateScene,
  onUnlink,
  onRename,
  onGo,
  passage,
  onPassageChange,
  keyName = '',
  onKeyChange,
  acceptsAttempts = true,
  onAcceptsAttemptsChange,
  motivo,
  onMotivoChange,
  onOneWayChange,
  onBothSidesChange,
  arrivalOnly,
}: PinTravelControlsProps) {
  const [escolha, setEscolha] = useState<Escolha>(null)
  const [busca, setBusca] = useState('')
  /** "+ Cena nova…": o nome digitado, e se o mestre tentou criar com ele vazio. */
  const [nomeNovo, setNomeNovo] = useState('')
  const [nomeVazio, setNomeVazio] = useState(false)
  const buscaRef = useRef<HTMLInputElement | null>(null)
  /** Quem abriu a escolha: é para ele que o foco volta ao fechar. */
  const gatilhoRef = useRef<HTMLButtonElement | null>(null)
  const seletorRef = useRef<HTMLDivElement | null>(null)
  /** A cena escolhida no passo 1: "Voltar" devolve o foco a ela, e não ao topo da lista. */
  const cenaEscolhidaRef = useRef<string | null>(null)

  const temCena = scenes.length > 0
  const algumaAbre = scenes.some((scene) => scene.available)
  const algumaCarregando = scenes.some((scene) => scene.loading === true)
  const podeCriar = onCreateScene !== undefined
  /** A escolha abre se há cena que abre, ou se dá para criar uma ali mesmo. */
  const escolhaAbre = algumaAbre || podeCriar
  const aberta = escolha !== null
  const encruzilhada = exits.length > 1
  const principal = exits[0]
  const mostraBusca = scenes.length >= SCENE_FILTER_MIN
  const buscando = mostraBusca && sceneSearchWords(busca).length > 0
  const achadas = buscando ? searchScenes(scenes, busca) : scenes
  /** A cena que o Enter do campo escolhe: a primeira achada que abriu. Só com busca digitada. */
  const alvoDoEnter = buscando ? achadas.find((scene) => scene.available) : undefined
  const algumaLigada = exits.some((exit) => exit.travel.status === 'ligado')
  // A régua do poço: acesa se alguma saída leva a algum lugar.
  const estado = algumaLigada ? 'ligado' : (principal?.travel.status ?? 'sem-destino')

  const opcoes = () => Array.from(seletorRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
  const frase = () => document.getElementById(STATUS_ID)

  const abrir = (saida: string | null, gatilho: HTMLButtonElement) => {
    gatilhoRef.current = gatilho
    setEscolha({ passo: 'cena', saida })
    setBusca('')
    // Com busca, o foco nasce nela: digitar já filtra. Sem ela, na primeira cena.
    focarDepois(() => buscaRef.current ?? opcoes()[0])
  }
  const fechar = () => {
    setEscolha(null)
    focarDepois(() => gatilhoRef.current)
  }
  const escolherCena = (sceneId: string) => {
    if (escolha === null) return
    cenaEscolhidaRef.current = sceneId
    setEscolha({ passo: 'pino', sceneId, saida: escolha.saida })
    focarDepois(() => opcoes()[0])
  }
  const voltar = () => {
    if (escolha === null) return
    setEscolha({ passo: 'cena', saida: escolha.saida })
    const cena = cenaEscolhidaRef.current
    focarDepois(
      () => (cena === null ? null : seletorRef.current?.querySelector<HTMLButtonElement>(`[data-cena="${CSS.escape(cena)}"]`)) ?? buscaRef.current ?? opcoes()[0],
    )
  }
  /** "+ Cena nova…": o nome já vem com o que se buscou (a busca que não achou é o nome da cena que falta). */
  const abrirNova = () => {
    if (escolha === null) return
    setNomeNovo(busca.trim())
    setNomeVazio(false)
    setEscolha({ passo: 'nova', saida: escolha.saida })
    focarDepois(() => document.getElementById(NOVA_ID))
  }
  const voltarDaNova = () => {
    if (escolha === null) return
    setEscolha({ passo: 'cena', saida: escolha.saida })
    focarDepois(() => seletorRef.current?.querySelector<HTMLButtonElement>('[data-cena-nova]'))
  }
  const mudarNomeNovo = (nome: string) => {
    setNomeNovo(nome)
    // O erro some assim que o nome fica válido; não aparece a cada tecla.
    if (nomeVazio && nome.trim() !== '') setNomeVazio(false)
  }
  const criarCena = () => {
    if (escolha === null || onCreateScene === undefined) return
    const nome = nomeNovo.trim()
    if (nome === '') {
      setNomeVazio(true)
      document.getElementById(NOVA_ID)?.focus()
      return
    }
    concluir(() => onCreateScene(nome, escolha.saida))
  }
  const aoTeclarNaBusca = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (alvoDoEnter !== undefined) escolherCena(alvoDoEnter.id)
  }
  /** Depois de mudar a ligação, o foco vai para o que mudou: a frase do destino. */
  const concluir = (acao: () => void) => {
    acao()
    setEscolha(null)
    focarDepois(frase)
  }

  const aoTeclar = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!aberta) return
    // Esc e setas param aqui: no window, Esc largaria o pino inteiro e a seta
    // moveria o que estiver selecionado no mapa.
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      // O primeiro Esc só limpa a busca; com ela vazia, o Esc fecha a escolha.
      if (escolha.passo === 'cena' && busca !== '') {
        setBusca('')
        buscaRef.current?.focus()
      } else fechar()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    // No nome da cena nova as setas são do campo de texto, não da lista.
    if (escolha.passo === 'nova') return
    const botoes = opcoes()
    if (botoes.length === 0) return
    event.preventDefault()
    event.stopPropagation()
    // `activeElement` é um Element; `indexOf` só precisa da identidade, e um
    // Element que não é botão devolve -1, que já é o caso "nenhum focado".
    const atual = botoes.findIndex((botao) => botao === document.activeElement)
    const passo = event.key === 'ArrowDown' ? 1 : -1
    const proximo = atual === -1 ? (passo === 1 ? 0 : botoes.length - 1) : (atual + passo + botoes.length) % botoes.length
    botoes[proximo]?.focus()
  }

  /** O botão que abre a escolha para a saída `saida` (`null` = uma nova). */
  const gatilho = (saida: string | null, rotulo: string, className: string) => {
    const chave = saida ?? GATILHO_NOVA
    const minha = escolha !== null && (escolha.saida ?? GATILHO_NOVA) === chave
    return (
      <button
        type="button"
        className={className}
        aria-expanded={minha}
        aria-controls={minha ? SELETOR_ID : undefined}
        disabled={!escolhaAbre}
        onClick={(event: MouseEvent<HTMLButtonElement>) => (minha ? fechar() : abrir(saida, event.currentTarget))}
      >
        {rotulo}
        {/* A mesma divisa das seções recolhíveis (CollapsibleSection): de lado
            fechada, para baixo aberta. Decorativa: o estado é o `aria-expanded`. */}
        <span className="lb-travel__chevron">
          <ChevronDownIcon size={14} />
        </span>
      </button>
    )
  }

  // Antes de todo o resto: a chegada oculta não tem destino para escolher.
  // Os hooks acima rodam igual (a ordem deles não pode mudar entre renders).
  if (arrivalOnly) return <SoChegada origem={principal?.travel ?? null} />

  return (
    <div className={`lb-travel lb-travel--${estado}`} role="group" aria-label="Destino da viagem" onKeyDown={aoTeclar}>
      {!encruzilhada && principal !== undefined && (
        <>
          <p id={STATUS_ID} className="lb-travel__status" tabIndex={-1} aria-live="polite">
            <TituloDoDestino travel={principal.travel} />
            <span className="lb-travel__detail">{detalhe(principal.travel, temCena, algumaAbre, podeCriar, algumaCarregando)}</span>
          </p>
          {principal.travel.status === 'ligado' && (
            <button type="button" className="lb-btn lb-btn--block" onClick={() => concluir(() => onGo(principal.id))}>
              Ir para {travelPlaceName(principal.travel)}
            </button>
          )}
          {principal.travel.status === 'sem-destino' ? (
            gatilho(principal.id, 'Leva a…', 'lb-btn lb-btn--block')
          ) : (
            <div className="lb-travel__row">
              {gatilho(principal.id, 'Trocar destino', 'lb-btn lb-btn--ghost')}
              <button type="button" className="lb-btn lb-btn--ghost" onClick={() => concluir(() => onUnlink(principal.id))}>
                Desligar
              </button>
            </div>
          )}
          {principal.travel.status === 'ligado' && (
            <MaoUnica id={`${MAO_UNICA_ID}-0`} travel={principal.travel} onChange={(on) => onOneWayChange(principal.id, on)} />
          )}
          {principal.travel.status === 'ligado' && !aberta && <p className="lb-travel__hint">No mapa, um clique no pino com Selecionar também leva.</p>}
        </>
      )}

      {encruzilhada && (
        <>
          <p id={STATUS_ID} className="lb-travel__status" tabIndex={-1} aria-live="polite">
            <span className="lb-travel__title">{exits.length} saídas</span>
            <span className="lb-travel__detail">O jogador escolhe pelo nome de cada uma; o nome da cena ele não vê.</span>
          </p>
          <ul className="lb-travel__exits">
            {exits.map((exit, index) => (
              <li key={exit.id} className={`lb-travel__exit lb-travel__exit--${exit.travel.status}`}>
                <p className="lb-travel__status">
                  <TituloDoDestino travel={exit.travel} />
                  <span className="lb-travel__detail">{detalhe(exit.travel, temCena, algumaAbre, podeCriar, algumaCarregando)}</span>
                </p>
                <NomeDaSaida
                  key={`${exit.id}:${exit.rotulo}`}
                  id={`${NOME_ID}-${index}`}
                  rotulo={exit.rotulo}
                  placeholder={`Saída ${index + 1}`}
                  onCommit={(rotulo) => onRename(exit.id, rotulo)}
                />
                <div className="lb-travel__row">
                  {exit.travel.status === 'ligado' && (
                    <button
                      type="button"
                      className="lb-btn lb-btn--ghost"
                      aria-label={`Ir para ${travelPlaceName(exit.travel)}`}
                      onClick={() => concluir(() => onGo(exit.id))}
                    >
                      Ir
                    </button>
                  )}
                  {gatilho(exit.id, 'Trocar destino', 'lb-btn lb-btn--ghost')}
                  <button type="button" className="lb-btn lb-btn--ghost" onClick={() => concluir(() => onUnlink(exit.id))}>
                    Desligar
                  </button>
                </div>
                {exit.travel.status === 'ligado' && (
                  <MaoUnica id={`${MAO_UNICA_ID}-${index}`} travel={exit.travel} onChange={(on) => onOneWayChange(exit.id, on)} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* "+ Outra saída" só depois da primeira ligação: antes dela, o
          "Leva a…" de sempre já é a primeira saída. No teto de saídas
          (`EXIT_EXTRA_MAX_COUNT` extras + a principal) o botão some. */}
      {algumaLigada && exits.length <= EXIT_EXTRA_MAX_COUNT && gatilho(null, '+ Outra saída', 'lb-btn lb-btn--ghost lb-btn--block')}

      {/* Como o JOGADOR passa: numa mesa espalhada por várias cenas, aprovar
          cada passagem vira gargalo do mestre. Vale só para este pino — a
          volta tem o modo dela, no pino par — e para todas as saídas dele.
          Mesmo segmented em linhas do "Tipo do pino": "Pede ao mestre" não
          cabe em um terço do poço. */}
      <span className="lb-label" id={PASSAGEM_ID}>
        Passagem
      </span>
      <div className="lb-seg lb-seg--rows" role="radiogroup" aria-labelledby={PASSAGEM_ID}>
        {PIN_PASSAGE_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={passage === option}
            className="lb-seg__option"
            onClick={() => onPassageChange(option)}
          >
            {PIN_PASSAGE_LABELS[option]}
          </button>
        ))}
      </div>
      {passage === 'trancada' && onAcceptsAttemptsChange !== undefined && (
        // O mesmo botão de alternar da "Mão única" (`aria-pressed`), logo
        // abaixo do modo que ele qualifica.
        <button
          type="button"
          className="lb-btn lb-btn--ghost lb-btn--block"
          aria-pressed={acceptsAttempts}
          aria-describedby={TENTATIVAS_ID}
          onClick={() => onAcceptsAttemptsChange(!acceptsAttempts)}
        >
          Aceita tentativas
        </button>
      )}
      <p id={passage === 'trancada' ? TENTATIVAS_ID : undefined} className="lb-travel__hint">
        {passage === 'trancada' && acceptsAttempts ? EFEITO_TRANCADA_COM_PEDIDO : EFEITO_DA_PASSAGEM[passage]}
      </p>
      {/* CHAVE ABRE PORTA: quem carrega o item passa sem pedir, e você lê o aviso. */}
      {passage === 'trancada' && onKeyChange !== undefined && (
        <DoorKeyField value={keyName} onChange={onKeyChange} placeholder="Nome do item (vazio: sem chave)" />
      )}

      {/* "Cortar a corda": o modo acima vale só para este pino, e trancar a
          volta pedia abrir a outra cena no meio da perseguição. */}
      <DoisLados passage={passage} exits={exits} onChange={onBothSidesChange} />

      {/* MOTIVO DO BLOQUEIO: só com a passagem trancada. O jogador lê a
          escolha no cartão ("Desabou") no lugar do "Está trancada"; nos
          outros modos o motivo fica guardado e volta se o mestre trancar de novo. */}
      {passage === 'trancada' && (
        <>
          <span className="lb-label" id={MOTIVO_ID}>
            Por que está fechada
          </span>
          <div className="lb-seg lb-seg--rows" role="radiogroup" aria-labelledby={MOTIVO_ID}>
            {[undefined, ...PIN_BLOCK_REASON_ORDER].map((option) => (
              <button
                key={option ?? 'trancada'}
                type="button"
                role="radio"
                aria-checked={motivo === option}
                className="lb-seg__option"
                onClick={() => onMotivoChange(option)}
              >
                {option === undefined ? PIN_BLOCK_REASON_NONE_LABEL : PIN_BLOCK_REASON_LABELS[option]}
              </button>
            ))}
          </div>
        </>
      )}

      {escolha !== null && (
        <div id={SELETOR_ID} ref={seletorRef} className="lb-travel__picker">
          {escolha.passo === 'cena' ? (
            <>
              <p className="lb-label" id={CENAS_ID}>
                {escolha.saida === null ? 'A outra saída leva a qual cena?' : 'Para qual cena?'}
              </p>
              {mostraBusca && (
                <>
                  <SceneSearchField
                    id={BUSCA_ID}
                    label="Buscar cena"
                    value={busca}
                    inputRef={buscaRef}
                    controls={CENAS_LISTA_ID}
                    onChange={setBusca}
                    onKeyDown={aoTeclarNaBusca}
                  />
                  <p className="lb-cenas__resumo" role="status">
                    {buscando ? sceneSearchSummary(achadas.length, busca) : ''}
                  </p>
                </>
              )}
              <ul id={CENAS_LISTA_ID} className="lb-travel__options" aria-labelledby={CENAS_ID}>
                {achadas.map((scene) => (
                  <li key={scene.id} className="lb-travel__option">
                    <SceneChoice
                      name={scene.name}
                      trail={scene.trail}
                      dataCena={scene.id}
                      disabled={!scene.available}
                      enterTarget={scene.id === alvoDoEnter?.id}
                      onChoose={() => escolherCena(scene.id)}
                    />
                    {!scene.available && <span className="lb-travel__note">{scene.loading === true ? 'carregando…' : 'não abriu'}</span>}
                  </li>
                ))}
              </ul>
              {/* A cena que ainda não existe nasce aqui mesmo, sem ir a Cenas. */}
              {podeCriar && (
                <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" data-cena-nova="" onClick={abrirNova}>
                  + Cena nova…
                </button>
              )}
              <div className="lb-travel__row lb-travel__row--end">
                <button type="button" className="lb-btn lb-btn--ghost" onClick={fechar}>
                  Cancelar
                </button>
              </div>
            </>
          ) : escolha.passo === 'nova' ? (
            <PassoDaCenaNova
              nome={nomeNovo}
              vazio={nomeVazio}
              onChange={mudarNomeNovo}
              onCreate={criarCena}
              onBack={voltarDaNova}
              onCancel={fechar}
            />
          ) : (
            <PassoDoPino
              sceneName={sceneLabelOf(scenes, escolha.sceneId)}
              here={scenes.some((scene) => scene.id === escolha.sceneId && scene.here === true)}
              pins={pinsIn(escolha.sceneId)}
              onCreate={() => concluir(() => onLinkNew(escolha.sceneId, escolha.saida))}
              onPick={(pinId) => concluir(() => onLinkExisting(escolha.sceneId, pinId, escolha.saida))}
              onBack={voltar}
              onCancel={fechar}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** O nome com caminho da cena `sceneId`, para o título do passo da chegada; vazio se ela saiu da lista. */
function sceneLabelOf(scenes: readonly TravelSceneOption[], sceneId: string): string {
  const scene = scenes.find((candidate) => candidate.id === sceneId)
  return scene === undefined ? '' : travelSceneLabel(scene)
}

type Ligada = Extract<PinTravel, { status: 'ligado' }>

interface MaoUnicaProps {
  id: string
  travel: Ligada
  onChange: (on: boolean) => void
}

/**
 * "Mão única" de UMA saída ligada: botão de alternar (`aria-pressed`), e não
 * o `Toggle` da casa — o checkbox dele é um input de 1 px sem ponteiro, e o
 * alvo do clique precisa ser o próprio controle. O estado mora no PAR (a
 * marca de chegada oculta), então o botão lê o par e nunca guarda cópia.
 *
 * Par que é encruzilhada não pode virar chegada oculta: esconder o pino dele
 * esconderia do jogador também as outras saídas. O botão fica desabilitado,
 * com o motivo dito embaixo.
 */
function MaoUnica({ id, travel, onChange }: MaoUnicaProps) {
  const marcada = isArrivalOnly(travel.partner)
  const parComSaidas = !marcada && travelExitsOf(travel.partner).length > 1
  const efeito = `${id}-efeito`
  return (
    <>
      <button
        type="button"
        className="lb-btn lb-btn--ghost lb-btn--block"
        aria-pressed={marcada}
        aria-describedby={efeito}
        disabled={parComSaidas}
        onClick={() => onChange(!marcada)}
      >
        Mão única
      </button>
      <p id={efeito} className="lb-travel__hint">
        {parComSaidas
          ? `O pino de chegada em ${travelPlaceName(travel)} tem outras saídas: não dá para escondê-lo.`
          : marcada
            ? `Não volta: o jogador chega em ${travelPlaceName(travel)} e não vê o pino de chegada.`
            : 'Marque para a passagem não voltar (alçapão, teleporte).'}
      </p>
    </>
  )
}

interface DoisLadosProps {
  passage: PinPassage
  exits: readonly PinTravelExitView[]
  onChange: (trancar: boolean) => void
}

/**
 * "Trancar os dois lados" / "Destrancar os dois lados": um toque neste pino
 * e no par de cada saída ligada. Destrancar só é oferecido quando TODOS os
 * lados já estão trancados; com qualquer um aberto, o toque tranca o que
 * falta. Sem saída ligada não há outro lado, e o botão não aparece.
 */
function DoisLados({ passage, exits, onChange }: DoisLadosProps) {
  const ligadas = exits.flatMap((exit) => (exit.travel.status === 'ligado' ? [exit.travel] : []))
  if (ligadas.length === 0) return null
  const trancados = passage === 'trancada' && ligadas.every((travel) => passageOf(travel.partner) === 'trancada')
  const cenas = [...new Set(ligadas.map((travel) => travel.sceneName))].join(', ')
  const deLa = ligadas.length === 1 ? `o de ${cenas}` : `os de ${cenas}`
  return (
    <>
      <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" aria-describedby={DOIS_LADOS_ID} onClick={() => onChange(!trancados)}>
        {trancados ? 'Destrancar os dois lados' : 'Trancar os dois lados'}
      </button>
      <p id={DOIS_LADOS_ID} className="lb-travel__hint">
        {trancados ? `Este pino e ${deLa} voltam a pedir a você.` : `Tranca este pino e ${deLa} de uma vez.`}
      </p>
    </>
  )
}

/**
 * O painel da CHEGADA OCULTA: o que ela é e de onde vem, sem nada para
 * escolher. Desfazer é pelo pino de origem — é lá que a mão única mora para
 * o mestre, que marcou pensando na passagem, não na chegada.
 */
function SoChegada({ origem }: { origem: PinTravel | null }) {
  const deOnde = origem !== null && origem.status === 'ligado' ? travelPlaceName(origem) : null
  return (
    <div className="lb-travel lb-travel--chegada" role="group" aria-label="Destino da viagem">
      <p id={STATUS_ID} className="lb-travel__status" tabIndex={-1} aria-live="polite">
        <span className="lb-travel__title">Só chegada</span>
        <span className="lb-travel__detail">
          {deOnde === null ? 'Mão única: não leva de volta.' : `Mão única vinda de ${deOnde}: não leva de volta.`}
        </span>
      </p>
      <p className="lb-travel__hint">O jogador não vê este pino. Para desfazer, desmarque “Mão única” no pino de origem.</p>
    </div>
  )
}

interface NomeDaSaidaProps {
  id: string
  rotulo: string
  placeholder: string
  onCommit: (rotulo: string) => void
}

/**
 * "Nome da saída": o que o jogador lê no botão da saída. Grava ao SAIR do
 * campo (Tab, clique fora) ou no Enter — gravar a cada tecla empilharia uma
 * entrada de desfazer por letra. Esc devolve o nome gravado sem mexer em nada
 * e não deixa o Esc chegar ao mapa (que largaria o pino inteiro).
 * A `key` de quem usa inclui o nome gravado: o desfazer que troca o nome
 * troca o campo junto.
 */
function NomeDaSaida({ id, rotulo, placeholder, onCommit }: NomeDaSaidaProps) {
  const [rascunho, setRascunho] = useState(rotulo)
  const gravar = () => {
    if (rascunho.trim() !== rotulo) onCommit(rascunho)
  }
  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={id}>
        Nome da saída
      </label>
      <input
        id={id}
        type="text"
        className="lb-input"
        value={rascunho}
        placeholder={placeholder}
        maxLength={EXIT_LABEL_MAX_LENGTH}
        onChange={(event) => setRascunho(event.target.value)}
        onBlur={gravar}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setRascunho(rotulo)
          }
        }}
      />
    </div>
  )
}

interface PassoDaCenaNovaProps {
  nome: string
  /** O mestre tentou criar com o nome vazio: o campo diz o que falta. */
  vazio: boolean
  onChange: (nome: string) => void
  onCreate: () => void
  onBack: () => void
  onCancel: () => void
}

/**
 * "+ Cena nova…" do "Leva a…": o nome da cena que ainda não existe. Enter ou
 * "Criar e ligar" cria a cena com o pino de chegada no centro e liga — o
 * mestre continua na cena onde está. Esc fecha a escolha (quem trata é o
 * grupo, como nos outros passos); as setas ficam com o campo.
 */
function PassoDaCenaNova({ nome, vazio, onChange, onCreate, onBack, onCancel }: PassoDaCenaNovaProps) {
  return (
    <>
      <div className="lb-field">
        <label className="lb-label" htmlFor={NOVA_ID}>
          Nome da cena nova
        </label>
        <input
          id={NOVA_ID}
          type="text"
          className="lb-input"
          value={nome}
          maxLength={NOME_DA_CENA_MAX}
          placeholder="Casa do ferreiro"
          aria-invalid={vazio ? true : undefined}
          aria-describedby={vazio ? NOVA_ERRO_ID : NOVA_DICA_ID}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            onCreate()
          }}
        />
      </div>
      {vazio ? (
        <p id={NOVA_ERRO_ID} className="lb-travel__error" role="alert">
          Dê um nome à cena.
        </p>
      ) : (
        <p id={NOVA_DICA_ID} className="lb-travel__hint">
          Nasce vazia, com o pino de chegada no centro, já ligado de volta. Você continua aqui.
        </p>
      )}
      <div className="lb-travel__row lb-travel__row--end">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onBack}>
          Voltar
        </button>
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="lb-btn" onClick={onCreate}>
          Criar e ligar
        </button>
      </div>
    </>
  )
}

interface PassoDoPinoProps {
  sceneName: string
  /** "Esta cena" (atalho): a chegada nasce ao lado do pino, não no centro. */
  here: boolean
  pins: readonly TravelPinOption[]
  onCreate: () => void
  onPick: (pinId: string) => void
  onBack: () => void
  onCancel: () => void
}

/**
 * Passo 2 do "Leva a…": onde o pino chega na cena escolhida. Criar a chegada
 * vem primeiro — é o caminho da primeira ligação —, e os pinos de viagem que
 * já estão lá vêm depois; o que já leva a outro lugar aparece desabilitado,
 * com o motivo, em vez de sumir.
 */
function PassoDoPino({ sceneName, here, pins, onCreate, onPick, onBack, onCancel }: PassoDoPinoProps) {
  return (
    <>
      <p className="lb-label">{here ? 'Chegada em outro ponto desta cena' : `Chegada em ${sceneName}`}</p>
      <button type="button" className="lb-btn lb-btn--block" onClick={onCreate}>
        Criar pino de chegada
      </button>
      <p className="lb-travel__hint">
        {here ? 'Nasce ao lado deste pino, já ligado de volta; arraste até o outro ponto.' : 'Nasce no centro da cena, já ligado de volta; depois é só arrastar.'}
      </p>
      {pins.length > 0 && (
        <>
          <p className="lb-label" id={PINOS_ID}>
            {here ? 'Ou um pino de viagem que já está aqui' : 'Ou um pino de viagem que já está lá'}
          </p>
          <ul className="lb-travel__options" aria-labelledby={PINOS_ID}>
            {pins.map((pin) => (
              <li key={pin.id} className="lb-travel__option">
                <button type="button" className="lb-btn lb-travel__choice" disabled={pin.note !== null} onClick={() => onPick(pin.id)}>
                  {pin.label}
                </button>
                {pin.note !== null && <span className="lb-travel__note">{pin.note}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="lb-travel__row lb-travel__row--end">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onBack}>
          Voltar
        </button>
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </>
  )
}
