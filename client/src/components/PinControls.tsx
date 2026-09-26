import { useEffect, useState } from 'react'
import type { PinItem, PinKind } from '../types/map'
import { ITEM_NAME_MAX_LENGTH, cleanItemName } from '../lib/items'
import type { LeverDoorOption } from '../lib/lever'
import type { PinAttachOption } from '../lib/pinAttach'
import { PIN_GLYPH, PIN_KIND_LABELS, PIN_KIND_ORDER, PIN_LER_DE_PERTO_MAX, PIN_LER_DE_PERTO_MIN, PIN_NOME_MAX_LENGTH, isPinReadDistance } from '../lib/pins'
import { GatherControls, type GatherControlsProps } from './GatherControls'
import { PinColecaoControls, type PinColecaoControlsProps } from './PinColecaoControls'
import { PinIconControls, type PinIconControlsProps } from './PinIconControls'
import { PinLockControls, type PinLockControlsProps } from './PinLockControls'
import { PinLojaControls, type PinLojaControlsProps } from './PinLojaControls'
import { PinLeverArt, PinTravelArt } from './PinSymbolArt'
import { PinCabinControls, type PinCabinControlsProps } from './PinCabinControls'
import { PinTravelControls, type PinTravelControlsProps } from './PinTravelControls'
import { Toggle } from './Toggle'

export interface PinControlsProps {
  kind: PinKind
  onKindChange: (kind: PinKind) => void
  /** `null` = nenhum pino selecionado: só o tipo do próximo aparece. */
  description: string | null
  onDescriptionChange: (description: string) => void
  /**
   * "Nome (só mestre)" do pino aberto: o rótulo ao lado dele no editor e na
   * lista "Pinos". Vazio = sem nome. Ausente `onNomeChange` = sem o campo.
   */
  nome?: string
  onNomeChange?: (nome: string) => void
  /**
   * `Pin.notaDoMestre` — "só eu leio", nunca sai para o jogador. `null` ou
   * ausente com `description` presente = pino sem nota. Sem
   * `onNotaDoMestreChange` o campo não aparece (mesmo molde de `RoomControls`).
   */
  notaDoMestre?: string | null
  onNotaDoMestreChange?: (notaDoMestre: string) => void
  /** Pino travado não se move no arrasto — continua clicável para destravar aqui. */
  locked: boolean
  onLockedChange: (locked: boolean) => void
  /** "Marco: todos veem": o pino chega a todo jogador, mesmo na névoa. */
  marco: boolean
  onMarcoChange: (marco: boolean) => void
  /** "Ler só de perto": casas até onde a ficha precisa chegar; `null` = lê de qualquer lugar. */
  lerDePerto: number | null
  onLerDePertoChange: (casas: number | null) => void
  image: string | null
  onChooseImage: () => void
  onClearImage: () => void
  onDelete: () => void
  /**
   * Pino de VIAGEM aberto no painel: para onde ele leva e como mudar isso.
   * `null` = não há pino de viagem aberto. `pinId` só reinicia a escolha de
   * "Leva a…" quando o painel passa a mostrar outro pino.
   */
  travel?: (PinTravelControlsProps & { pinId: string }) | null
  /**
   * "Reunir o grupo aqui", de QUALQUER tipo de pino aberto no painel. `null` =
   * sem sala (fora do app não há jogador para reunir). `pinId` fecha a lista
   * quando o painel passa a mostrar outro pino.
   */
  gather?: (GatherControlsProps & { pinId: string }) | null
  /**
   * ITEM PEGÁVEL do pino aberto ("!"/"?"): `value` `null` = pino que só se lê.
   * `onChange(null)` desliga. `null` no prop = sem pino aberto, ou pino de viagem.
   */
  item?: { value: PinItem | null; onChange: (item: PinItem | null) => void } | null
  /**
   * PRESO À FICHA do pino de viagem aberto: `value` é o id da ficha que ele
   * acompanha (`null` = parado); `options`, as fichas desta cena.
   * `onChange(null)` solta. `null` no prop = sem pino aberto, ou pino "!"/"?".
   */
  attachment?: { value: string | null; options: readonly PinAttachOption[]; onChange: (tokenId: string | null) => void } | null
  /**
   * ALAVANCA aberta no painel: `value` é o id da porta ligada (`null` = solta);
   * `options`, as portas desta cena. `onPull` aciona dali (o mestre testa ou
   * opera na mesa); `pullBlocked` é o porquê de não dar (porta trancada), ou
   * `null`. `null` no prop = sem pino aberto, ou pino de outro tipo.
   */
  lever?: {
    value: string | null
    options: readonly LeverDoorOption[]
    onChange: (wallId: string | null) => void
    onPull: () => void
    pullBlocked: string | null
  } | null
  /**
   * O ícone do marcador, no MESMO bloco do tipo e logo abaixo dele: os dois
   * dizem o que aparece na cabeça do pino. `null` = não se aplica (pino de
   * viagem, que desenha a passagem).
   */
  iconChoice: PinIconControlsProps | null
  /**
   * FECHADURA COM SEGREDO do pino aberto no painel (qualquer tipo). `null` =
   * nenhum pino aberto: não há fechadura para editar.
   */
  lock?: PinLockControlsProps | null
  /**
   * COLEÇÃO DE PISTAS do pino aberto no painel (qualquer tipo). `null` =
   * nenhum pino aberto: não há peça para editar.
   */
  colecao?: PinColecaoControlsProps | null
  /**
   * LOJA COM PREÇOS do pino aberto ("!"/"?"). `null` = nenhum pino aberto.
   * `pinId` reinicia os campos ao trocar de pino.
   */
  loja?: (PinLojaControlsProps & { pinId: string }) | null
  /**
   * CABINE CONTÍNUA do pino aberto: a próxima parada ("!"/"?") ou o par em
   * outra cena (viagem), e o apito. `null` = sem pino aberto, ou chegada oculta.
   */
  cabin?: PinCabinControlsProps | null
}

/** Id fixo: só existe um pino aberto no painel por vez (o mesmo molde de `lb-pin-description`). */
const PRESO_ID = 'lb-pin-attach'
const PORTA_ID = 'lb-pin-lever-door'

/**
 * "Abre a porta": a lista nativa das portas desta cena, no molde de "Preso à
 * ficha". Porta apagada depois de ligada não vira opção fantasma: a lista
 * mostra "Nenhuma", que é o que a alavanca faz — nada.
 */
function PinLeverControls({ value, options, onChange, onPull, pullBlocked }: NonNullable<PinControlsProps['lever']>) {
  const atual = value !== null && options.some((o) => o.id === value) ? value : ''
  const semPorta = options.length === 0
  const efeito = `${PORTA_ID}-efeito`
  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={PORTA_ID}>
        Abre a porta
      </label>
      <select
        id={PORTA_ID}
        className="lb-input"
        value={atual}
        disabled={semPorta}
        aria-describedby={efeito}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">Nenhuma</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span id={efeito} className="lb-label">
        {semPorta
          ? 'Ponha uma porta no mapa para ligar a alavanca.'
          : 'Puxar a alavanca abre ou fecha esta porta, mesmo em outra sala.'}
      </span>
      {atual !== '' && (
        <>
          <button type="button" className="lb-btn lb-btn--block" disabled={pullBlocked !== null} onClick={onPull}>
            Acionar agora
          </button>
          {pullBlocked !== null && <span className="lb-label">{pullBlocked}</span>}
        </>
      )}
    </div>
  )
}

/**
 * "Preso à ficha": a lista nativa (setas, Enter, Esc e a letra inicial já vêm
 * do navegador). A ficha que saiu da cena não vira opção fantasma: a lista
 * mostra "Nenhuma", que é o que o pino faz — fica parado.
 */
function PinAttachControls({ value, options, onChange }: NonNullable<PinControlsProps['attachment']>) {
  const atual = value !== null && options.some((o) => o.id === value) ? value : ''
  const semFicha = options.length === 0
  const efeito = `${PRESO_ID}-efeito`
  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={PRESO_ID}>
        Preso à ficha
      </label>
      <select
        id={PRESO_ID}
        className="lb-input"
        value={atual}
        disabled={semFicha}
        aria-describedby={efeito}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">Nenhuma (fica parado)</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span id={efeito} className="lb-label">
        {semFicha
          ? 'Ponha uma ficha no mapa para prender o pino nela.'
          : 'O pino anda junto quando a ficha anda: navio, carroça, elevador.'}
      </span>
    </div>
  )
}

/** Nome que o item ganha ao ligar o interruptor: o mestre troca logo abaixo. */
export const NEW_ITEM_NAME = 'Item'

/**
 * "Item pegável": o interruptor diz se o jogador pode pegar; ligado, aparecem
 * o nome que vai para a mochila e se ele pega sem pedir ao mestre. O nome só
 * vale ao sair do campo (ou Enter): cada letra não vira um passo do desfazer.
 */
function PinItemControls({ value, onChange }: { value: PinItem | null; onChange: (item: PinItem | null) => void }) {
  const [draft, setDraft] = useState(value?.nome ?? '')
  const nome = value?.nome ?? ''
  useEffect(() => setDraft(nome), [nome])
  const commit = () => {
    if (value === null) return
    const limpo = cleanItemName(draft)
    // Nome apagado volta ao que era: item sem nome não é pegável, e sumiria calado.
    if (limpo === '' || limpo === value.nome) {
      setDraft(value.nome)
      return
    }
    onChange({ ...value, nome: limpo })
  }
  return (
    <>
      <Toggle label="Item pegável" checked={value !== null} onChange={(on) => onChange(on ? { nome: NEW_ITEM_NAME } : null)} />
      {value !== null && (
        <>
          <input
            className="lb-input"
            type="text"
            aria-label="Nome do item"
            value={draft}
            maxLength={ITEM_NAME_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
            }}
          />
          <Toggle
            label="Pega sem pedir ao mestre"
            checked={value.livre === true}
            onChange={(livre) => onChange(livre ? { nome: value.nome, livre: true } : { nome: value.nome })}
          />
        </>
      )}
    </>
  )
}

/** A pastilha de cada tipo: a mesma cabeça que o pino tem no mapa. */
function KindMark({ kind }: { kind: PinKind }) {
  if (kind === 'viagem') {
    return (
      <span className="lb-pin-glyph lb-pin-glyph--viagem" aria-hidden="true">
        <PinTravelArt size={14} />
      </span>
    )
  }
  if (kind === 'alavanca') {
    return (
      <span className="lb-pin-glyph" aria-hidden="true">
        <PinLeverArt size={14} />
      </span>
    )
  }
  return (
    <span className="lb-pin-glyph" aria-hidden="true">
      {PIN_GLYPH[kind]}
    </span>
  )
}

/**
 * Painel do ponto de interesse. Dois estados, um componente só:
 *
 * - com a ferramenta Pino na mão e nada selecionado, aparece só o TIPO — é a
 *   preferência do próximo pino, do mesmo jeito que `DoorKindControls` mostra
 *   o tipo da próxima porta;
 * - com um pino selecionado, aparecem também a descrição, a imagem e o botão
 *   de excluir, porque aí existe um pino concreto para editar — e, no pino de
 *   viagem, o destino dele logo abaixo do tipo, que é o que ele tem de próprio.
 *
 * O título é "Ponto de interesse", não "Pino": o botão da barra já se chama
 * "Pino" e dois rótulos idênticos na mesma tela confundem quem lê por leitor
 * de tela (e o `getByRole` dos specs). O de viagem é "Pino de viagem", que não
 * repete o botão.
 *
 * O tipo vem em LINHAS, não em colunas: com a viagem são três opções, e três
 * colunas na largura do rail dariam 60 px a cada rótulo — "Interrogação" mede 68.
 */
export function PinControls({
  kind,
  onKindChange,
  description,
  onDescriptionChange,
  nome = '',
  onNomeChange,
  notaDoMestre = null,
  onNotaDoMestreChange,
  locked,
  onLockedChange,
  marco,
  onMarcoChange,
  lerDePerto,
  onLerDePertoChange,
  image,
  onChooseImage,
  onClearImage,
  onDelete,
  travel = null,
  gather = null,
  item = null,
  attachment = null,
  lever = null,
  iconChoice,
  lock = null,
  colecao = null,
  loja = null,
  cabin = null,
}: PinControlsProps) {
  const viagem = kind === 'viagem'
  const alavanca = kind === 'alavanca'
  // As cenas onde mora um par que perde a volta se este pino sumir (uma por
  // saída ligada; a encruzilhada pode ter várias).
  const cenasDosPares = (travel?.exits ?? []).flatMap((exit) => (exit.travel.status === 'ligado' ? [exit.travel.sceneName] : []))
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">{viagem ? 'Pino de viagem' : alavanca ? 'Alavanca' : 'Ponto de interesse'}</h2>
      <div className="lb-seg lb-seg--rows" role="radiogroup" aria-label="Tipo do pino">
        {PIN_KIND_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            className="lb-seg__option"
            onClick={() => onKindChange(option)}
          >
            <KindMark kind={option} />
            {PIN_KIND_LABELS[option]}
          </button>
        ))}
      </div>
      {/* Logo abaixo do tipo e ANTES da descrição: o último botão do bloco
          continua "Excluir", longe de quem só queria trocar o ícone. */}
      {!viagem && iconChoice !== null && <PinIconControls {...iconChoice} glyph={PIN_GLYPH[kind]} />}
      {viagem && description === null && (
        <span className="lb-label">Crave o pino; no painel dele você escolhe para onde ele leva.</span>
      )}
      {alavanca && description === null && (
        <span className="lb-label">Crave a alavanca; no painel dela você escolhe a porta que ela abre.</span>
      )}
      {travel !== null && <PinTravelControlsFor travel={travel} />}
      {/* A porta ligada é o que a alavanca tem de próprio: logo abaixo do tipo, como o destino da viagem. */}
      {alavanca && description !== null && lever !== null && <PinLeverControls {...lever} />}
      {description !== null && (
        <>
          {/* Antes da descrição: é o que o MESTRE lê (sete "?" iguais no mapa
              do crime); a descrição, logo abaixo, é o que o jogador lê. */}
          {onNomeChange !== undefined && (
            <div className="lb-field">
              <label className="lb-label" htmlFor="lb-pin-nome">
                Nome (só mestre)
              </label>
              <input
                id="lb-pin-nome"
                className="lb-input"
                value={nome}
                maxLength={PIN_NOME_MAX_LENGTH}
                aria-describedby="lb-pin-nome-hint"
                onChange={(event) => onNomeChange(event.target.value)}
              />
              <span id="lb-pin-nome-hint" className="lb-label">
                Os jogadores não veem o nome; eles leem a descrição.
              </span>
            </div>
          )}
          {/* Dois textos, lado a lado: o que vai para o cartão do jogador e o
              lembrete que fica aqui. O primeiro rótulo segue começando por
              "Descrição" (é o nome que a mesa já conhece); o da nota não repete
              a palavra, para os dois nunca se confundirem. */}
          <div className="lb-field">
            <label className="lb-label" htmlFor="lb-pin-description">
              Descrição · o jogador lê
            </label>
            <textarea
              id="lb-pin-description"
              className="lb-input lb-textarea"
              rows={4}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>
          {onNotaDoMestreChange !== undefined && (
            <div className="lb-field">
              <label className="lb-label" htmlFor="lb-pin-nota-do-mestre">
                Nota do mestre · só eu leio
              </label>
              <textarea
                id="lb-pin-nota-do-mestre"
                className="lb-input lb-textarea"
                rows={3}
                value={notaDoMestre ?? ''}
                aria-describedby="lb-pin-nota-do-mestre-dica"
                onChange={(event) => onNotaDoMestreChange(event.target.value)}
              />
              <p className="lb-field__hint" id="lb-pin-nota-do-mestre-dica">
                Nunca vai para a tela dos jogadores, nem quando o pino é revelado.
              </p>
            </div>
          )}
          {/* Mesmo rótulo de `ItemTransformControls` ("Travado"), porque é a
              mesma promessa: o item fica onde está quando alguém esbarra nele
              arrastando. O pino não usa aquele componente porque não tem
              rotação nem "oculto no editor" separado do resto do painel. */}
          <Toggle label="Travado" checked={locked} onChange={onLockedChange} />
          {viagem && attachment !== null && <PinAttachControls {...attachment} />}
          {!viagem && !alavanca && item !== null && <PinItemControls value={item.value} onChange={item.onChange} />}
          {/* Quem lê o pino, e de onde. */}
          <PinReachControls
            marco={marco}
            onMarcoChange={onMarcoChange}
            lerDePerto={lerDePerto}
            onLerDePertoChange={onLerDePertoChange}
          />
          {/* O que o pino É para o jogador (tranca), antes da ação de mesa. */}
          {lock !== null && <PinLockControls {...lock} />}
          {/* Também é o que o pino É para o jogador: uma peça de coleção. */}
          {colecao !== null && <PinColecaoControls {...colecao} />}
          {/* Também é o que o pino É para o jogador: a banca que ele vê no cartão. */}
          {!viagem && !alavanca && loja !== null && <PinLojaControlsFor loja={loja} />}
          {cabin !== null && <PinCabinControls {...cabin} />}
          {/* Ação de MESA, não de edição do pino: fica logo depois do que o
              pino é, antes da imagem e do excluir. */}
          {gather !== null && <GatherControlsFor gather={gather} />}
          {/* Só o nome do arquivo, nunca o caminho inteiro: o cartão do jogador
              recebe a imagem embutida, e mostrar a pasta do mestre aqui só
              enche a coluna. Data URL não tem nome, então diz o que é. */}
          {image !== null && <span className="lb-label">Imagem escolhida</span>}
          <button type="button" className="lb-btn lb-btn--block" onClick={onChooseImage}>
            {image === null ? 'Escolher imagem...' : 'Trocar imagem...'}
          </button>
          {image !== null && (
            <button type="button" className="lb-btn lb-btn--ghost" onClick={onClearImage}>
              Remover imagem
            </button>
          )}
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={onDelete}>
            {viagem ? 'Excluir pino de viagem' : alavanca ? 'Excluir alavanca' : 'Excluir ponto de interesse'}
          </button>
          {/* O efeito que não se vê daqui: o par mora em outra cena. */}
          {cenasDosPares.length > 0 && (
            <span className="lb-label">
              {cenasDosPares.length === 1
                ? `Excluir deixa o pino de ${cenasDosPares[0]} sem destino.`
                : `Excluir desliga os pinos de ${cenasDosPares.join(', ')}.`}
            </span>
          )}
        </>
      )}
    </section>
  )
}

type PinReachControlsProps = Pick<PinControlsProps, 'marco' | 'onMarcoChange' | 'lerDePerto' | 'onLerDePertoChange'>

/**
 * "Marco: todos veem" e "Ler só de perto: N casas". O campo de casas guarda um
 * RASCUNHO enquanto o mestre digita: apagar o "2" para escrever "3" passa por
 * um campo vazio, e o pino não pode perder o "só de perto" nesse meio. Só
 * número inteiro na faixa chega ao pino; o rascunho some ao sair do campo.
 */
function PinReachControls({ marco, onMarcoChange, lerDePerto, onLerDePertoChange }: PinReachControlsProps) {
  const [rascunho, setRascunho] = useState<string | null>(null)
  return (
    <>
      <Toggle label="Marco: todos veem" checked={marco} onChange={onMarcoChange} describedBy="lb-pin-marco-hint" />
      <span id="lb-pin-marco-hint" className="lb-label">
        Aparece para todos os jogadores, mesmo na névoa. O que está em volta continua escondido.
      </span>
      <Toggle
        label="Ler só de perto"
        checked={lerDePerto !== null}
        onChange={(checked) => onLerDePertoChange(checked ? PIN_LER_DE_PERTO_MIN : null)}
        describedBy="lb-pin-perto-hint"
      />
      {lerDePerto !== null && (
        <div className="lb-field">
          <label className="lb-label" htmlFor="lb-pin-ler-de-perto">
            Casas
          </label>
          <input
            id="lb-pin-ler-de-perto"
            className="lb-input"
            type="number"
            min={PIN_LER_DE_PERTO_MIN}
            max={PIN_LER_DE_PERTO_MAX}
            step={1}
            value={rascunho ?? String(lerDePerto)}
            aria-describedby="lb-pin-perto-hint"
            onChange={(event) => {
              const texto = event.target.value
              setRascunho(texto)
              const casas = Number(texto)
              if (texto.trim() !== '' && isPinReadDistance(casas)) onLerDePertoChange(casas)
            }}
            onBlur={() => setRascunho(null)}
          />
        </div>
      )}
      <span id="lb-pin-perto-hint" className="lb-label">
        {lerDePerto === null
          ? 'Longe, o jogador vê o pino e lê "Chegue mais perto para ler".'
          : `Só quem estiver a ${lerDePerto} ${lerDePerto === 1 ? 'casa' : 'casas'} e enxergando o pino lê o texto e vê a imagem.`}
      </span>
    </>
  )
}

/** A chave é o pino: abrir OUTRO pino no painel começa com "Leva a…" fechado. */
function PinTravelControlsFor({ travel }: { travel: PinTravelControlsProps & { pinId: string } }) {
  const { pinId, ...props } = travel
  return <PinTravelControls key={pinId} {...props} />
}

/** A chave é o pino: os campos de uma banca não seguem abertos na de outro pino. */
function PinLojaControlsFor({ loja }: { loja: PinLojaControlsProps & { pinId: string } }) {
  const { pinId, ...props } = loja
  return <PinLojaControls key={pinId} {...props} />
}

/** A chave é o pino: a lista de reunião aberta num pino não reaparece aberta em outro. */
function GatherControlsFor({ gather }: { gather: GatherControlsProps & { pinId: string } }) {
  const { pinId, ...props } = gather
  return <GatherControls key={pinId} {...props} />
}
