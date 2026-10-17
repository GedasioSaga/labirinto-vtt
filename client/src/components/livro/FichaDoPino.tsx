import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { PinItem, PinKind, PinLock } from '../../types/map'
import { movimentoInfo, type CenarioDoPino } from '../../cenario/catalogo'
import { CenarioSection } from '../../cenario/CenarioSection'
import { useEstilosDeCenario, type EstiloDeCenario } from '../../cenario/estilosDeCenario'
import { novaMercadoria } from '../../lib/loja'
import { PIN_GLYPH, PIN_KIND_LABELS, PIN_KIND_ORDER, PIN_NOME_MAX_LENGTH } from '../../lib/pins'
import { useToastStore } from '../../stores/toastStore'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { CampoTexto } from '../grimorio/CampoTexto'
import { Essencial } from '../grimorio/Cartoes'
import { Ficha, Fichas } from '../grimorio/Ficha'
import { Nota } from '../grimorio/Nota'
import { MenuItem, MenuRotulo, Pop } from '../grimorio/Pop'
import { movimentoReduzido } from '../grimorio/comum'
import { MinigameControls } from '../MinigameControls'
import { PinCabinControls } from '../PinCabinControls'
import { PinColecaoControls } from '../PinColecaoControls'
import {
  GatherControlsFor,
  NEW_ITEM_NAME,
  PinAttachControls,
  PinItemControls,
  PinLeverControls,
  PinReachControls,
  ShowPinNowControlsFor,
  type PinControlsProps,
} from '../PinControls'
import { PinIconControls, type PinIconControlsProps } from '../PinIconControls'
import { PinImageDrop } from '../PinImageDrop'
import { PinLockControls } from '../PinLockControls'
import { PinLojaControls, idAleatorio } from '../PinLojaControls'
import { PinTravelControls } from '../PinTravelControls'
import { PlayerSecretControls, type PlayerSecretControlsProps } from '../PlayerSecretControls'
import { Toggle } from '../Toggle'
import { ICONE_DO_PINO, TITULO_DO_PINO } from './CabecaDaSelecao'
import { FichaLembrada, type FichaLembradaProps } from './FichaLembrada'
import { IconeDoLivro, type NomeDoIcone } from './icones'
import './fichaDoPino.css'

/*
 * FICHA DO PINO (fatia 12 do design consolidado, docs/design/consolidado/PLANO.md):
 * abaixo da cabeça (a medalha com o ícone do tipo, o nome do local e o
 * Excluir), o bloco essencial — Tipo, Nome do local, Descrição, o destino da
 * viagem, a porta da alavanca ou o desafio do minigame, Quem vê e o alcance —,
 * os RECURSOS ligados, cada um numa ficha que termina em "Tirar do pino", o
 * "+ Adicionar ao pino" com os que sobram, e as fichas recolhidas Mais da
 * viagem, Aparência e Na mesa. Os controles e os handlers são os de antes:
 * muda o lugar e o visual.
 *
 * Um recurso está na ficha quando o dado do pino diz que ele está ligado (o
 * item, a fechadura, a peça, a loja, o cenário, a parada da cabine): nada novo
 * no arquivo, e o mapa antigo abre igual. A ordem é a do menu. O cenário e a
 * cabine ligam e desligam por dentro ("Não" e "Nenhuma"), então os dois também
 * ficam enquanto a ficha estiver aberta depois de entrar pelo menu ou de
 * aparecerem ligados; só o "Tirar do pino" os tira.
 */

/** Chave da escolha lembrada de cada ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-pino-'

export interface FichaDoPinoProps extends Omit<PinControlsProps, 'description' | 'iconChoice' | 'onDelete'> {
  /** O pino aberto: os valores dos recursos tirados ficam guardados por ele. */
  pinId: string
  description: string
  /** O ícone do marcador ("!"/"?"); `null` nos tipos que desenham o próprio símbolo. */
  iconChoice: PinIconControlsProps | null
  /** "Oculto para jogadores" e, com a sala aberta, "Quem vê"; `null` = sem o bloco. */
  quemVe: PlayerSecretControlsProps | null
  /** Pino de viagem numa aventura: "Depende do estado" e a cabine (elevador, cesto) com a fila. */
  estadoDoPino?: ReactNode
}

type Recurso = 'cenario' | 'item' | 'fechadura' | 'colecao' | 'loja' | 'cabine'

interface DefDoRecurso {
  id: Recurso
  rotulo: string
  icone: NomeDoIcone
  descricao: string
}

/** Os recursos, na ordem do menu e da ficha (a do protótipo). */
const RECURSOS: readonly DefDoRecurso[] = [
  { id: 'cenario', rotulo: 'Animação do cenário', icone: 'filme', descricao: 'A imagem do local entra na moldura e o texto se escreve.' },
  { id: 'item', rotulo: 'Item pegável', icone: 'joia', descricao: 'O jogador leva um item deste lugar.' },
  { id: 'fechadura', rotulo: 'Fechadura com segredo', icone: 'chave', descricao: 'Só abre com a combinação certa.' },
  { id: 'colecao', rotulo: 'Peça de coleção', icone: 'peca', descricao: 'Uma parte de algo que se junta.' },
  { id: 'loja', rotulo: 'Loja com preços', icone: 'loja', descricao: 'Mercadorias que o jogador compra.' },
  { id: 'cabine', rotulo: 'Cabine contínua', icone: 'cabine', descricao: 'Leva o grupo a outra cena sem parar.' },
]

/** Os que ligam por dentro: entrar pelo menu não muda o pino, só abre a ficha. */
const LIGA_POR_DENTRO: ReadonlySet<Recurso> = new Set<Recurso>(['cenario', 'cabine'])

type ValorDaColecao = NonNullable<NonNullable<PinControlsProps['colecao']>['colecao']>
type ValorDaLoja = NonNullable<NonNullable<PinControlsProps['loja']>['loja']>

/** O último valor de cada recurso tirado de um pino. */
interface Guardados {
  cenario?: CenarioDoPino
  item?: PinItem
  fechadura?: PinLock
  colecao?: ValorDaColecao
  loja?: ValorDaLoja
  cabine?: string
}

/**
 * Os valores dos recursos tirados, por pino, só nesta sessão: o "Desfazer" do
 * aviso e o recurso que volta pelo menu trazem o que o mestre tinha escrito.
 */
const guardadosPorPino = new Map<string, Guardados>()

function guardadosDe(pinId: string): Guardados {
  const atuais = guardadosPorPino.get(pinId)
  if (atuais !== undefined) return atuais
  const novos: Guardados = {}
  guardadosPorPino.set(pinId, novos)
  return novos
}

/** Desliga, guarda o valor de agora e devolve quem religa com ele (`null`: não havia valor). */
function desligarGuardando<T>(valor: T | null | undefined, guardar: (valor: T) => void, desligar: () => void, ligar: (valor: T) => void): (() => void) | null {
  desligar()
  if (valor === null || valor === undefined) return null
  guardar(valor)
  return () => ligar(valor)
}

interface Interruptor {
  ligado: boolean
  /** Liga com o valor guardado ou, sem ele, com o padrão do interruptor de antes. */
  ligar: () => void
  /** Desliga e devolve o "Desfazer". */
  desligar: () => (() => void) | null
}

/** Como cada recurso liga e desliga, a partir das props de antes; `null` = não vale para este pino. */
function interruptorDo(id: Recurso, props: FichaDoPinoProps, guardados: Guardados): Interruptor | null {
  const simples = props.kind === 'exclamacao' || props.kind === 'interrogacao'
  switch (id) {
    case 'cenario': {
      const cenario = props.cenario
      if (cenario === undefined) return null
      return {
        ligado: cenario.valor !== undefined,
        ligar: () => {
          if (guardados.cenario !== undefined) cenario.onChange(guardados.cenario)
        },
        desligar: () => desligarGuardando(cenario.valor, (valor) => (guardados.cenario = valor), () => cenario.onChange(undefined), cenario.onChange),
      }
    }
    case 'item': {
      const item = props.item
      if (!simples || item === null || item === undefined) return null
      return {
        ligado: item.value !== null,
        ligar: () => item.onChange(guardados.item ?? { nome: NEW_ITEM_NAME }),
        desligar: () => desligarGuardando(item.value, (valor) => (guardados.item = valor), () => item.onChange(null), item.onChange),
      }
    }
    case 'fechadura': {
      const lock = props.lock
      if (lock === null || lock === undefined) return null
      return {
        ligado: lock.lock !== null,
        ligar: () => lock.onChange(guardados.fechadura ?? { resposta: '', forma: 'teclado' }),
        desligar: () => desligarGuardando(lock.lock, (valor) => (guardados.fechadura = valor), () => lock.onChange(undefined), lock.onChange),
      }
    }
    case 'colecao': {
      const colecao = props.colecao
      if (colecao === null || colecao === undefined) return null
      return {
        ligado: colecao.colecao !== null,
        ligar: () => colecao.onChange(guardados.colecao ?? { nome: '', parte: 1, total: 2 }),
        desligar: () => desligarGuardando(colecao.colecao, (valor) => (guardados.colecao = valor), () => colecao.onChange(undefined), colecao.onChange),
      }
    }
    case 'loja': {
      const loja = props.loja
      if (!simples || loja === null || loja === undefined) return null
      const novoId = loja.novoId ?? idAleatorio
      return {
        ligado: loja.loja !== null,
        ligar: () => loja.onChange(guardados.loja ?? [novaMercadoria(novoId())]),
        desligar: () => desligarGuardando(loja.loja, (valor) => (guardados.loja = valor), () => loja.onChange(undefined), loja.onChange),
      }
    }
    case 'cabine': {
      const cabin = props.cabin
      if (cabin === null || cabin === undefined) return null
      return {
        ligado: cabin.target !== null,
        ligar: () => {
          if (guardados.cabine !== undefined) cabin.onChange(guardados.cabine)
        },
        desligar: () => desligarGuardando(cabin.target, (valor) => (guardados.cabine = valor), () => cabin.onChange(null), cabin.onChange),
      }
    }
  }
}

/** O que a ficha fechada diz do recurso, numa palavra (o protótipo); sem resumo, nada. */
function resumoDo(id: Recurso, props: FichaDoPinoProps, estilos: readonly EstiloDeCenario[]): string | undefined {
  switch (id) {
    case 'item': {
      const nome = props.item?.value?.nome.trim() ?? ''
      return nome === '' ? 'Sem nome' : nome
    }
    case 'fechadura': {
      const resposta = props.lock?.lock?.resposta.trim() ?? ''
      return resposta === '' ? 'Sem combinação' : `Segredo ${resposta}`
    }
    case 'colecao': {
      const peca = props.colecao?.colecao
      return peca === null || peca === undefined ? undefined : `${peca.parte} de ${peca.total}`
    }
    case 'loja': {
      const quantas = props.loja?.loja?.length ?? 0
      return quantas === 1 ? '1 mercadoria' : `${quantas} mercadorias`
    }
    case 'cenario': {
      // O nome da câmera, ou do estilo do pacote, como no protótipo; ainda sem "quando" não há resumo.
      const cenario = props.cenario?.valor
      if (cenario === undefined) return undefined
      return estilos.find((e) => e.id === cenario.estilo)?.nome ?? movimentoInfo(cenario.movimento).nome
    }
    case 'cabine':
      return undefined
  }
}

/** As props de antes sem o `pinId`, que ali só servia de `key` (a ficha inteira já remonta com outro pino). */
function semPinId<T extends { pinId: string }>(props: T): Omit<T, 'pinId'> {
  const { pinId: _pinId, ...resto } = props
  return resto
}

/** Os controles de cada recurso, sem o interruptor de ligar: na ficha, desligar é o "Tirar do pino". */
function ConteudoDoRecurso({ id, props }: { id: Recurso; props: FichaDoPinoProps }) {
  switch (id) {
    case 'cenario':
      return props.cenario === undefined ? null : (
        <CenarioSection cenario={props.cenario.valor} imagem={props.image} nome={props.nome ?? ''} descricao={props.description} onChange={props.cenario.onChange} />
      )
    case 'item':
      return props.item ? <PinItemControls value={props.item.value} onChange={props.item.onChange} onTrocarForma={props.item.onTrocarForma} embutido /> : null
    case 'fechadura':
      return props.lock ? <PinLockControls {...props.lock} embutido /> : null
    case 'colecao':
      return props.colecao ? <PinColecaoControls {...props.colecao} embutido /> : null
    case 'loja':
      return props.loja ? <PinLojaControls {...semPinId(props.loja)} embutido /> : null
    case 'cabine':
      return props.cabin ? <PinCabinControls {...props.cabin} /> : null
  }
}

/*
 * O Tipo como no protótipo: "!" e "?" só de ícone (o nome vai no balão e no
 * leitor de tela), Viagem e Alavanca em texto. O minigame, que o protótipo não
 * tem, fica de ícone para os cinco caberem numa linha. Os ícones são os da
 * medalha da cabeça.
 */
const TIPO_SO_DE_ICONE: ReadonlySet<PinKind> = new Set<PinKind>(['exclamacao', 'interrogacao', 'minigame'])

const OPCOES_DO_TIPO: readonly OpcaoDoSeg<PinKind>[] = PIN_KIND_ORDER.map((kind) => {
  const soIcone = TIPO_SO_DE_ICONE.has(kind)
  return {
    valor: kind,
    rotulo: PIN_KIND_LABELS[kind],
    icone: soIcone ? <IconeDoLivro nome={ICONE_DO_PINO[kind]} /> : undefined,
    soIcone,
  }
})

export function FichaDoPino(props: FichaDoPinoProps) {
  const tituloId = useId()
  return (
    <section className="lb-ficha-do-pino" aria-labelledby={tituloId}>
      {/* O título de antes, o primeiro da ficha: as jornadas acham o painel por
          ele. A cabeça já mostra o tipo, então ele fica para o leitor de tela. */}
      <h2 id={tituloId} className="gr-sr">
        {TITULO_DO_PINO[props.kind]}
      </h2>
      <EssencialDoPino {...props} />
      <RecursosDoPino {...props} />
      <FichasDoPino {...props} />
    </section>
  )
}

function EssencialDoPino({
  kind,
  onKindChange,
  description,
  onDescriptionChange,
  nome = '',
  onNomeChange,
  travel = null,
  lever = null,
  desafio = null,
  quemVe,
  marco,
  onMarcoChange,
  lerDePerto,
  onLerDePertoChange,
}: FichaDoPinoProps) {
  // As cenas onde mora um par que perde a volta se este pino sumir: o Excluir agora mora na cabeça.
  const cenasDosPares = (travel?.exits ?? []).flatMap((exit) => (exit.travel.status === 'ligado' ? [exit.travel.sceneName] : []))
  return (
    <Essencial>
      <CampoSeg
        rotulo="Tipo"
        nomeAcessivel="Tipo do pino"
        opcoes={OPCOES_DO_TIPO}
        valor={kind}
        onChange={(novo) => {
          if (novo !== kind) onKindChange(novo)
        }}
      />
      {onNomeChange !== undefined && (
        <CampoTexto id="lb-pin-nome" rotulo="Nome do local" valor={nome} maxLength={PIN_NOME_MAX_LENGTH} onChange={onNomeChange} />
      )}
      {/* Também na viagem e na alavanca, ao contrário do protótipo: o cartão
          do jogador mostra a descrição nos dois (PlayerPinCard, `pp-pincard__text`). */}
      <CampoTexto
        id="lb-pin-description"
        rotulo="Descrição · o jogador lê"
        placeholder="O que aparece no cartão do local"
        valor={description}
        onChange={onDescriptionChange}
        multilinha
      />
      {travel !== null && <PinTravelControls {...semPinId(travel)} parte="essencial" />}
      {kind === 'alavanca' && lever !== null && <PinLeverControls {...lever} />}
      {/* O rascunho e a prévia de música não passam de um desafio a outro. */}
      {kind === 'minigame' && desafio !== null && <MinigameControls key={desafio.pinId} {...desafio} />}
      {quemVe !== null && <PlayerSecretControls {...quemVe} embutido />}
      {/* Também na alavanca, ao contrário do protótipo: o Marco a mantém no
          mapa do jogador sob a névoa e o "só de perto" esconde o texto do
          cartão dela (lib/fogFilter.ts, `recalledList` e `canReadPin`). */}
      <PinReachControls marco={marco} onMarcoChange={onMarcoChange} lerDePerto={lerDePerto} onLerDePertoChange={onLerDePertoChange} />
      {cenasDosPares.length > 0 && (
        <Nota>
          {cenasDosPares.length === 1 ? `Excluir deixa o pino de ${cenasDosPares[0]} sem destino.` : `Excluir desliga os pinos de ${cenasDosPares.join(', ')}.`}
        </Nota>
      )}
    </Essencial>
  )
}

/** Para onde o foco vai depois de pôr ou tirar um recurso. */
interface FocoPendente {
  alvo: Recurso | 'mais'
  suave: boolean
}

function RecursosDoPino(props: FichaDoPinoProps) {
  const baseId = useId()
  const maisRef = useRef<HTMLButtonElement | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  // Os que entraram pelo menu com a ficha aberta: nascem abertos.
  const estilos = useEstilosDeCenario()
  const [entraram, setEntraram] = useState<ReadonlySet<Recurso>>(() => new Set())
  const [novo, setNovo] = useState<Recurso | null>(null)
  const [foco, setFoco] = useState<FocoPendente | null>(null)
  const guardados = guardadosDe(props.pinId)
  const valem = RECURSOS.flatMap((def) => {
    const interruptor = interruptorDo(def.id, props, guardados)
    return interruptor === null ? [] : [{ def, interruptor }]
  })
  /*
   * Os que ligam por dentro e foram vistos ligados com a ficha aberta: o "Não"
   * do cenário e o "Nenhuma" da cabine desligam por dentro, e a ficha sumiria
   * debaixo do foco, sem guardar o valor nem oferecer o Desfazer. Ficam até o
   * "Tirar do pino", que guarda e avisa.
   */
  const ligadosPorDentro = valem.filter(({ def, interruptor }) => LIGA_POR_DENTRO.has(def.id) && interruptor.ligado).map(({ def }) => def.id)
  const [ficam, setFicam] = useState<ReadonlySet<Recurso>>(() => new Set(ligadosPorDentro))
  // Ligado depois de abrir (o Desfazer, outro mestre): entra no conjunto já neste render.
  if (ligadosPorDentro.some((id) => !ficam.has(id))) setFicam(new Set([...ficam, ...ligadosPorDentro]))
  const naFicha = valem.filter(({ def, interruptor }) => interruptor.ligado || (LIGA_POR_DENTRO.has(def.id) && (entraram.has(def.id) || ficam.has(def.id))))
  const sobram = valem.filter((recurso) => !naFicha.includes(recurso))

  useEffect(() => {
    if (foco === null) return
    setFoco(null)
    const alvo = foco.alvo === 'mais' ? maisRef.current : document.getElementById(`${baseId}-${foco.alvo}`)
    if (alvo === null) return
    alvo.focus({ preventScroll: true })
    // O jsdom dos testes não tem `scrollIntoView`.
    if (typeof alvo.scrollIntoView === 'function') alvo.scrollIntoView({ block: 'nearest', behavior: foco.suave ? 'smooth' : 'auto' })
  }, [foco, baseId])

  const adicionar = (def: DefDoRecurso, interruptor: Interruptor, peloMouse: boolean) => {
    interruptor.ligar()
    setEntraram((antes) => new Set(antes).add(def.id))
    // Pelo teclado, ou com movimento reduzido, o recurso aparece na hora, sem subir.
    const suave = peloMouse && !movimentoReduzido()
    setNovo(suave ? def.id : null)
    setFoco({ alvo: def.id, suave })
  }

  const tirar = (def: DefDoRecurso, interruptor: Interruptor) => {
    const desfazer = interruptor.desligar()
    const semEle = (antes: ReadonlySet<Recurso>) => {
      const depois = new Set(antes)
      depois.delete(def.id)
      return depois
    }
    setEntraram(semEle)
    setFicam(semEle)
    setFoco({ alvo: 'mais', suave: false })
    useToastStore
      .getState()
      .push('info', `"${def.rotulo}" saiu do pino.`, undefined, desfazer === null ? undefined : { actions: [{ label: 'Desfazer', run: desfazer }] })
  }

  return (
    <>
      {naFicha.length > 0 && (
        <div className="lb-recursos">
          <Fichas>
            {naFicha.map(({ def, interruptor }) => (
              <Ficha
                key={def.id}
                titulo={def.rotulo}
                icone={<IconeDoLivro nome={def.icone} />}
                resumo={resumoDo(def.id, props, estilos)}
                abertaInicial={entraram.has(def.id)}
                nova={novo === def.id}
                idDoCabecalho={`${baseId}-${def.id}`}
              >
                <ConteudoDoRecurso id={def.id} props={props} />
                <div className="lb-rec__pe">
                  <Botao variante="fantasma" tamanho="p" onClick={() => tirar(def, interruptor)}>
                    <IconeDoLivro nome="x" />
                    Tirar do pino
                  </Botao>
                </div>
              </Ficha>
            ))}
          </Fichas>
        </div>
      )}
      {sobram.length > 0 && (
        <Botao
          tamanho="p"
          className="lb-rec-mais"
          ref={maisRef}
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto((aberto) => !aberto)}
        >
          <IconeDoLivro nome="mais" />
          Adicionar ao pino
        </Botao>
      )}
      <Pop aberto={menuAberto && sobram.length > 0} gatilho={maisRef} onFechar={() => setMenuAberto(false)} rotulo="Adicionar ao pino">
        <MenuRotulo>Adicionar ao pino</MenuRotulo>
        {sobram.map(({ def, interruptor }) => (
          <MenuItem key={def.id} icone={<IconeDoLivro nome={def.icone} />} detalhe={def.descricao} onClick={(evento) => adicionar(def, interruptor, evento.detail > 0)}>
            {def.rotulo}
          </MenuItem>
        ))}
      </Pop>
    </>
  )
}

/** Ficha do pino com a escolha lembrada: todas nascem fechadas, como no protótipo. */
function FichaDoPinoLembrada(props: Omit<FichaLembradaProps, 'prefixo' | 'padrao'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} padrao={false} {...props} />
}

function FichasDoPino({
  kind,
  travel = null,
  attachment = null,
  estadoDoPino,
  iconChoice,
  semHaste = false,
  onSemHasteChange,
  locked,
  onLockedChange,
  image,
  onChooseImage,
  onImageBlob,
  onClearImage,
  gather = null,
  showNow = null,
}: FichaDoPinoProps) {
  const viagem = kind === 'viagem'
  return (
    <Fichas>
      {viagem && (
        <FichaDoPinoLembrada id="mais-da-viagem" titulo="Mais da viagem" icone="viagem">
          {travel !== null && <PinTravelControls {...semPinId(travel)} parte="mais" />}
          {attachment !== null && <PinAttachControls {...attachment} />}
          {estadoDoPino}
        </FichaDoPinoLembrada>
      )}
      <FichaDoPinoLembrada id="aparencia" titulo="Aparência" icone="olho" resumo={locked ? 'Travado' : undefined}>
        {!viagem && iconChoice !== null && <PinIconControls {...iconChoice} glyph={PIN_GLYPH[kind]} />}
        {onSemHasteChange !== undefined && (
          <>
            <Toggle label="Só o círculo, sem haste" checked={semHaste} onChange={onSemHasteChange} describedBy="lb-pin-sem-haste-hint" />
            <span id="lb-pin-sem-haste-hint" className="lb-label">
              Os jogadores também veem o pino assim.
            </span>
          </>
        )}
        <Toggle label="Travado" checked={locked} onChange={onLockedChange} />
        {/* Só o nome do que é, nunca o caminho do arquivo: o cartão do jogador recebe a imagem embutida. */}
        {image !== null && <span className="lb-label">Imagem escolhida</span>}
        {onImageBlob !== undefined && <PinImageDrop onImage={onImageBlob} />}
        <Acoes>
          <Botao tamanho="p" onClick={onChooseImage}>
            <IconeDoLivro nome="imagem" />
            {image === null ? 'Escolher imagem...' : 'Trocar imagem...'}
          </Botao>
          {image !== null && (
            <Botao variante="fantasma" tamanho="p" onClick={onClearImage}>
              Remover imagem
            </Botao>
          )}
        </Acoes>
      </FichaDoPinoLembrada>
      {(gather !== null || showNow !== null) && (
        <FichaDoPinoLembrada id="na-mesa" titulo="Na mesa" icone="grupo">
          {gather !== null && <GatherControlsFor gather={gather} />}
          {showNow !== null && <ShowPinNowControlsFor showNow={showNow} />}
        </FichaDoPinoLembrada>
      )}
    </Fichas>
  )
}
