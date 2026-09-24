import { useState } from 'react'
import type { PinKind } from '../types/map'
import { PIN_GLYPH, PIN_KIND_LABELS, PIN_KIND_ORDER, PIN_LER_DE_PERTO_MAX, PIN_LER_DE_PERTO_MIN, PIN_NOME_MAX_LENGTH, isPinReadDistance } from '../lib/pins'
import { GatherControls, type GatherControlsProps } from './GatherControls'
import { PinTravelArt } from './PinSymbolArt'
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
}: PinControlsProps) {
  const viagem = kind === 'viagem'
  // As cenas onde mora um par que perde a volta se este pino sumir (uma por
  // saída ligada; a encruzilhada pode ter várias).
  const cenasDosPares = (travel?.exits ?? []).flatMap((exit) => (exit.travel.status === 'ligado' ? [exit.travel.sceneName] : []))
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">{viagem ? 'Pino de viagem' : 'Ponto de interesse'}</h2>
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
      {viagem && description === null && (
        <span className="lb-label">Crave o pino; no painel dele você escolhe para onde ele leva.</span>
      )}
      {travel !== null && <PinTravelControlsFor travel={travel} />}
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
          <div className="lb-field">
            <label className="lb-label" htmlFor="lb-pin-description">
              Descrição
            </label>
            <textarea
              id="lb-pin-description"
              className="lb-input lb-textarea"
              rows={4}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>
          {/* Mesmo rótulo de `ItemTransformControls` ("Travado"), porque é a
              mesma promessa: o item fica onde está quando alguém esbarra nele
              arrastando. O pino não usa aquele componente porque não tem
              rotação nem "oculto no editor" separado do resto do painel. */}
          <Toggle label="Travado" checked={locked} onChange={onLockedChange} />
          {/* Quem lê o pino, e de onde. */}
          <PinReachControls
            marco={marco}
            onMarcoChange={onMarcoChange}
            lerDePerto={lerDePerto}
            onLerDePertoChange={onLerDePertoChange}
          />
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
            {viagem ? 'Excluir pino de viagem' : 'Excluir ponto de interesse'}
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

/** A chave é o pino: a lista de reunião aberta num pino não reaparece aberta em outro. */
function GatherControlsFor({ gather }: { gather: GatherControlsProps & { pinId: string } }) {
  const { pinId, ...props } = gather
  return <GatherControls key={pinId} {...props} />
}
