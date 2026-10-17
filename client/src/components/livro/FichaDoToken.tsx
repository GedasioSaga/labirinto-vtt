import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Token } from '../../types/map'
import type { TokenCarryWiring } from '../../lib/party'
import { isEditableTarget } from '../../lib/keymap'
import { pisoDe } from '../../lib/pisos'
import { readTokenPatrol } from '../../lib/npcPatrol'
import { readTokenWatch, WATCH_DIRECTIONS } from '../../lib/npcWatch'
import { TOKEN_CONDITION_LABELS, tokenConditionsOf } from '../../lib/tokenConditions'
import { selectedTokenColor } from '../../lib/tokenColor'
import { tokenPhotoRef } from '../../lib/tokenPhoto'
import { tokenPublicNameMode } from '../../lib/tokenPublicName'
import { selectedTokenSize, TOKEN_SIZE_OPTIONS } from '../../lib/tokenSize'
import { vehicleOf } from '../../lib/vehicle'
import { useLivroDoMestreStore } from '../../stores/livroDoMestreStore'
import { Cartao, Cartoes, SubFicha } from '../grimorio/Cartoes'
import { Fichas } from '../grimorio/Ficha'
import { ItemTransformControls, type ItemTransformControlsProps } from '../ItemTransformControls'
import { PisoControls } from '../PisoControls'
import type { PisosWiring } from '../PropertiesPanel'
import { TokenCarryControls, LEVAR_JUNTO_SEM_FICHA, type TokenCarryControlsProps } from '../TokenCarryControls'
import { TokenColorControls, type TokenColorControlsProps } from '../TokenColorControls'
import { TokenConditionControls, type TokenConditionControlsProps } from '../TokenConditionControls'
import { TokenImageControls, type TokenImageControlsProps } from '../TokenImageControls'
import { TokenLightsControls, type TokenLightsControlsProps } from '../TokenLightsControls'
import { TokenNameControls, type TokenNameControlsProps } from '../TokenNameControls'
import { TOKEN_NPC_HINT, type TokenNpcControlsProps } from '../TokenNpcControls'
import { patrolSummary, TokenPatrolControls, type TokenPatrolControlsProps } from '../TokenPatrolControls'
import { TokenPersonagemControls, type TokenPersonagemControlsProps } from '../TokenPersonagemControls'
import { PLAYER_CHARACTER_HINT, type TokenPlayerCharacterControlsProps } from '../TokenPlayerCharacterControls'
import { TokenSceneCarryControls } from '../TokenSceneCarryControls'
import { TokenSeenBy, type TokenSeenByProps } from '../TokenSeenBy'
import { TokenSizeControls, type TokenSizeControlsProps } from '../TokenSizeControls'
import { TokenVehicleControls, type TokenVehicleControlsProps } from '../TokenVehicleControls'
import { TokenWatchControls, type TokenWatchControlsProps } from '../TokenWatchControls'
import { FichaLembrada, type FichaLembradaProps } from './FichaLembrada'
import { IconeDoLivro, type NomeDoIcone } from './icones'
import './fichaDoToken.css'

/*
 * FICHA DO TOKEN (fatia 9 do design consolidado, docs/design/consolidado/PLANO.md):
 * abaixo da cabeça, o tipo de ficha; depois as fichas recolhíveis Nome,
 * Condições, No mapa e Levar para outra cena; por último os cartões de
 * Comportamento, cada um abrindo a sua sub-ficha com "voltar". Os controles e
 * os handlers são os de antes: muda o lugar e o visual. A seção Vida saiu
 * (D: a vida passa a vir da ficha do sistema na fatia 10).
 */

export interface FichaDoTokenProps {
  token: Token
  /** "Trava e visibilidade" e o Avançado (o grupo `itemTransform` do painel). */
  comTrava: boolean
  tokenName: Omit<TokenNameControlsProps, 'name' | 'publicName'>
  tokenImage: Omit<TokenImageControlsProps, 'image'>
  tokenColor: Omit<TokenColorControlsProps, 'color'>
  tokenSize: Omit<TokenSizeControlsProps, 'size'>
  tokenNpc: Omit<TokenNpcControlsProps, 'npc'>
  tokenPlayerCharacter: Omit<TokenPlayerCharacterControlsProps, 'playerCharacter'>
  tokenPersonagem?: Omit<TokenPersonagemControlsProps, 'characterId'>
  tokenCondition: Omit<TokenConditionControlsProps, 'conditions'>
  tokenTransform: Omit<ItemTransformControlsProps, 'title' | 'rotation' | 'locked' | 'congelado' | 'hidden' | 'secret'>
  tokenWatch: Omit<TokenWatchControlsProps, 'watch'>
  tokenPatrol: Omit<TokenPatrolControlsProps, 'patrol'>
  tokenCarry: Omit<TokenCarryControlsProps, 'tokenId'>
  tokenVehicle?: Omit<TokenVehicleControlsProps, 'vehicle'>
  tokenLights: TokenLightsControlsProps
  tokenSeenBy?: Omit<TokenSeenByProps, 'tokenId'>
  tokenSceneCarry?: TokenCarryWiring
  rotinaDaFicha?: ReactNode
  pisos?: PisosWiring
}

/** Chave da escolha lembrada de cada ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-token-'

/** Ficha do token com a escolha lembrada (Nome e Condições nascem abertas, como no protótipo). */
function FichaDoTokenLembrada(props: Omit<FichaLembradaProps, 'prefixo'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} {...props} />
}

interface TipoDeFichaProps {
  npc: boolean
  jogador: boolean
  onNpc: (npc: boolean) => void
  onJogador: (jogador: boolean) => void
}

/**
 * "Tipo de ficha" com a cara do seg do protótipo. No app as duas marcas são
 * independentes (uma ficha pode não ter nenhuma), então cada lado é uma caixa
 * de marcar, e não um rádio: o mesmo dado e os mesmos handlers de antes. A
 * frase de cada uma vai como descrição (leitor de tela) e no balão nativo.
 */
function TipoDeFicha({ npc, jogador, onNpc, onJogador }: TipoDeFichaProps) {
  const dicaNpc = useId()
  const dicaJogador = useId()
  return (
    <div className="lb-tipo-de-ficha">
      <div className="gr-seg" role="group" aria-label="Tipo de ficha">
        <label className="gr-seg__op lb-tipo-de-ficha__op" title={TOKEN_NPC_HINT}>
          <input type="checkbox" className="lb-sr-only" checked={npc} onChange={(evento) => onNpc(evento.target.checked)} aria-describedby={dicaNpc} />
          <span>Ficha de NPC</span>
        </label>
        <label className="gr-seg__op lb-tipo-de-ficha__op" title={PLAYER_CHARACTER_HINT}>
          <input
            type="checkbox"
            className="lb-sr-only"
            checked={jogador}
            onChange={(evento) => onJogador(evento.target.checked)}
            aria-describedby={dicaJogador}
          />
          <span>Ficha de jogador</span>
        </label>
      </div>
      <p className="lb-sr-only" id={dicaNpc}>
        {TOKEN_NPC_HINT}
      </p>
      <p className="lb-sr-only" id={dicaJogador}>
        {PLAYER_CHARACTER_HINT}
      </p>
    </div>
  )
}

/** Um cartão de Comportamento e o que a sub-ficha dele mostra. */
interface CartaoDoToken {
  id: string
  rotulo: string
  icone: NomeDoIcone
  resumo: string
  ligado: boolean
  /** Presente, o cartão fica apagado e diz por quê (nada a mostrar na sub-ficha). */
  desligado?: string
  corpo: ReactNode
}

const plural = (n: number, um: string, varios: string): string => (n === 1 ? `1 ${um}` : `${n} ${varios}`)

function resumoDaVigia(token: Token): { ligado: boolean; resumo: string } {
  const vigia = readTokenWatch(token.vigia)
  if (vigia === null) return { ligado: false, resumo: 'Desligada' }
  const direcao = WATCH_DIRECTIONS.find((opcao) => opcao.value === vigia.direcao)
  return { ligado: true, resumo: direcao === undefined ? 'Ligada' : `Olha ${direcao.label.toLowerCase()}` }
}

function resumoDoLevarJunto(carry: FichaDoTokenProps['tokenCarry']): string {
  if (carry.carrier !== null) return `Vai com ${carry.carrier.name}`
  if (carry.carried.length === 1) return `Leva ${carry.carried[0].name}`
  if (carry.carried.length > 1) return `Leva ${carry.carried.length} fichas`
  return 'Sozinha'
}

function resumoDasLuzes(luzes: TokenLightsControlsProps['lights']): string {
  if (luzes.length > 1) return plural(luzes.length, 'luz', 'luzes')
  return luzes[0]?.attached === true ? 'Presa, vai junto' : 'Solta, embaixo'
}

/** Os cartões na ordem do protótipo; os que dependem de uma ligação do App só entram com ela. */
function cartoesDoToken(props: FichaDoTokenProps): CartaoDoToken[] {
  const { token } = props
  const cartoes: CartaoDoToken[] = []
  if (props.tokenPersonagem !== undefined) {
    const ligado = props.tokenPersonagem.personagens.find((personagem) => personagem.id === token.characterId)
    cartoes.push({
      id: 'personagem',
      rotulo: 'Personagem',
      icone: 'ficha',
      resumo: ligado?.nome ?? (token.characterId !== null ? 'Personagem apagado' : 'Sem personagem'),
      ligado: ligado !== undefined,
      corpo: <TokenPersonagemControls characterId={token.characterId} {...props.tokenPersonagem} />,
    })
  }
  const vigia = resumoDaVigia(token)
  cartoes.push({
    id: 'vigia',
    rotulo: 'Vigia',
    icone: 'olho',
    ...vigia,
    corpo: <TokenWatchControls watch={readTokenWatch(token.vigia)} {...props.tokenWatch} />,
  })
  const rota = readTokenPatrol(token.patrulha)
  cartoes.push({
    id: 'patrulha',
    rotulo: 'Patrulha',
    icone: 'rota',
    resumo: rota === null ? 'Sem rota' : patrolSummary(rota),
    ligado: rota !== null,
    corpo: <TokenPatrolControls patrol={rota} {...props.tokenPatrol} embutido />,
  })
  const carry = props.tokenCarry
  const semNinguem = carry.carrier === null && carry.carried.length === 0 && carry.candidates.length === 0
  cartoes.push({
    id: 'junto',
    rotulo: 'Levar junto',
    icone: 'elo',
    resumo: resumoDoLevarJunto(carry),
    ligado: carry.carrier !== null || carry.carried.length > 0,
    desligado: semNinguem ? LEVAR_JUNTO_SEM_FICHA : undefined,
    corpo: <TokenCarryControls tokenId={token.id} {...carry} />,
  })
  if (props.tokenVehicle !== undefined) {
    const veiculo = vehicleOf(token)
    cartoes.push({
      id: 'veiculo',
      rotulo: 'Veículo',
      icone: 'carroca',
      resumo: veiculo === null ? 'Não é veículo' : plural(veiculo.lugares, 'lugar', 'lugares'),
      ligado: veiculo !== null,
      corpo: <TokenVehicleControls vehicle={veiculo} {...props.tokenVehicle} />,
    })
  }
  if (props.rotinaDaFicha !== undefined) {
    cartoes.push({
      id: 'rotina',
      rotulo: 'Rotina',
      icone: 'relogio',
      resumo: token.rotina === undefined ? 'Sem rotina' : 'Pelo estado do mundo',
      ligado: token.rotina !== undefined,
      corpo: props.rotinaDaFicha,
    })
  }
  const luzes = props.tokenLights.lights
  cartoes.push({
    id: 'luzes',
    rotulo: 'Luzes',
    icone: 'lampiao',
    resumo: luzes.length === 0 ? 'Nenhuma' : resumoDasLuzes(luzes),
    ligado: luzes.length > 0,
    desligado: luzes.length === 0 ? 'Nenhuma luz na ficha' : undefined,
    corpo: <TokenLightsControls {...props.tokenLights} />,
  })
  const pisos = props.pisos
  if (pisos !== undefined) {
    const piso = pisoDe(token)
    cartoes.push({
      id: 'piso',
      rotulo: 'Piso',
      icone: 'cenas',
      resumo: piso === 0 ? 'Térreo' : `Piso ${piso}`,
      ligado: piso !== 0,
      corpo: <PisoControls piso={piso} onPisoChange={(novo) => pisos.onTokenPisoChange(token.id, novo)} />,
    })
  }
  return cartoes
}

function resumoDoNome(token: Token): string {
  const modo = tokenPublicNameMode(token.publicName)
  if (modo === 'none') return 'Sem nome'
  if (modo === 'other') return typeof token.publicName === 'string' && token.publicName.trim() !== '' ? token.publicName : 'Outro'
  return 'O mesmo'
}

/** Fora dos três tamanhos da grade (redimensionada à mão, 1,37 quadrado): "Outro tamanho", como o seg sem nada marcado. */
function resumoDoTamanho(token: Token): string {
  const tamanho = selectedTokenSize(token)
  return TOKEN_SIZE_OPTIONS.find((opcao) => opcao.value === tamanho)?.label ?? 'Outro tamanho'
}

/**
 * Esc dentro da sub-ficha volta à ficha do item (o protótipo faz igual), em
 * vez de largar a seleção: ouvido na captura, antes do mapa. Campo de texto,
 * menu e diálogo abertos ficam com o Esc deles.
 */
function useEscVolta(voltar: (() => void) | null): void {
  // O último `voltar` sem reinscrever o ouvinte a cada render.
  const ultimo = useRef(voltar)
  useLayoutEffect(() => {
    ultimo.current = voltar
  })
  const ativo = voltar !== null
  useEffect(() => {
    if (!ativo) return
    const teclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape' || evento.defaultPrevented) return
      const alvo = evento.target
      if (alvo instanceof HTMLElement) {
        const tipo = alvo instanceof HTMLInputElement ? alvo.type : undefined
        if (isEditableTarget(alvo.tagName, tipo, alvo.isContentEditable)) return
        if (alvo.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]') !== null) return
      }
      evento.preventDefault()
      evento.stopPropagation()
      ultimo.current?.()
    }
    window.addEventListener('keydown', teclar, true)
    return () => window.removeEventListener('keydown', teclar, true)
  }, [ativo])
}

export function FichaDoToken(props: FichaDoTokenProps) {
  const { token } = props
  const subFicha = useLivroDoMestreStore((state) => state.subFicha)
  /** O cartão de onde a pessoa voltou: o foco volta para ele. */
  const [focarCartao, setFocarCartao] = useState<string | null>(null)
  /** A sub-ficha foi aberta pelo teclado: entra parada. */
  const [peloTeclado, setPeloTeclado] = useState(false)
  const cartoes = cartoesDoToken(props)
  const idAberto = subFicha !== null && subFicha.item === token.id ? subFicha.cartao : null
  const aberto = cartoes.find((cartao) => cartao.id === idAberto && cartao.desligado === undefined)
  const nome = token.name.trim() === '' ? 'Token' : token.name.trim()

  const voltar = (cartao: string) => {
    setFocarCartao(cartao)
    useLivroDoMestreStore.getState().fecharSubFicha()
  }
  useEscVolta(aberto === undefined ? null : () => voltar(aberto.id))
  // O cartão aberto deixou de valer (as luzes zeraram ao arrastar o token, um
  // Ctrl+Z): a sub-ficha fecha DE VERDADE, para o painel voltar com a cabeça e
  // os controles do item, e uma luz que apareça depois não a reabre sozinha.
  const cartaoSumiu = idAberto !== null && aberto === undefined
  useEffect(() => {
    if (cartaoSumiu) useLivroDoMestreStore.getState().fecharSubFicha()
  }, [cartaoSumiu])

  if (aberto !== undefined) {
    return (
      <div className="lb-ficha-do-token">
        <SubFicha
          voltarPara={nome}
          onVoltar={() => voltar(aberto.id)}
          icone={<IconeDoLivro nome={aberto.icone} />}
          titulo={aberto.rotulo}
          tipo={`Comportamento de ${nome}`}
          instantanea={peloTeclado}
        >
          {aberto.corpo}
        </SubFicha>
      </div>
    )
  }

  const condicoes = tokenConditionsOf(token)
  const levar = props.tokenSceneCarry
  const transformacao: ItemTransformControlsProps = {
    title: 'Trava e visibilidade',
    rotation: token.rotation ?? 0,
    locked: token.locked === true,
    congelado: token.congelado === true,
    hidden: token.hidden === true,
    secret: token.secret === true,
    ...props.tokenTransform,
    rarosNoAvancado: true,
  }
  return (
    <div className="lb-ficha-do-token">
      <TipoDeFicha
        npc={token.npc === true}
        jogador={token.playerCharacter === true}
        onNpc={props.tokenNpc.onNpcChange}
        onJogador={props.tokenPlayerCharacter.onPlayerCharacterChange}
      />
      {/* Primeiro depois do tipo: é a pergunta que o mestre faz em voz alta no meio da cena. */}
      {props.tokenSeenBy !== undefined && <TokenSeenBy tokenId={token.id} {...props.tokenSeenBy} />}
      <Fichas>
        <FichaDoTokenLembrada id="nome" titulo="Nome" icone="ficha" padrao resumo={resumoDoNome(token)}>
          {/* `key` pela ficha: o "Outro nome" digitado e não confirmado não passa para a ficha seguinte. */}
          <TokenNameControls key={token.id} name={token.name} publicName={token.publicName} {...props.tokenName} semTitulo />
        </FichaDoTokenLembrada>
        <FichaDoTokenLembrada
          id="condicoes"
          titulo="Condições"
          icone="estrela"
          padrao
          resumo={condicoes.length === 0 ? 'Nenhuma' : condicoes.map((condicao) => TOKEN_CONDITION_LABELS[condicao]).join(', ')}
        >
          <TokenConditionControls conditions={condicoes} {...props.tokenCondition} embutido />
        </FichaDoTokenLembrada>
        <FichaDoTokenLembrada id="no-mapa" titulo="No mapa" icone="cena" padrao={false} resumo={resumoDoTamanho(token)}>
          {props.comTrava && <ItemTransformControls key={`trava-${token.id}`} {...transformacao} parte="trava" />}
          <TokenSizeControls size={selectedTokenSize(token)} {...props.tokenSize} />
          <TokenColorControls color={selectedTokenColor(token)} {...props.tokenColor} />
          {/* `tokenPhotoRef`: a foto escolhida pelo JOGADOR vive em `imageData`; sem isto o painel ofereceria "Escolher imagem..." num token que já tem foto. */}
          <TokenImageControls image={tokenPhotoRef(token)} {...props.tokenImage} />
          {/* O Avançado fecha "No mapa", como no protótipo. `key`: outra ficha selecionada o faz nascer de novo (aberto se ELA estiver girada ou oculta no editor). */}
          {props.comTrava && <ItemTransformControls key={`avancado-${token.id}`} {...transformacao} parte="avancado" />}
        </FichaDoTokenLembrada>
        {levar !== undefined && levar.destinations.length > 0 && (
          <FichaDoTokenLembrada id="levar" titulo="Levar para outra cena" icone="seta" padrao={false}>
            {/* `key`: outra ficha selecionada recomeça do primeiro destino, sem a escolha da anterior. */}
            <TokenSceneCarryControls
              key={`levar-${token.id}`}
              tokenName={token.name}
              destinations={levar.destinations}
              owned={levar.ownedTokenIds.has(token.id)}
              onCarry={(sceneId, pinId) => levar.onCarry(token.id, sceneId, pinId)}
              direto
            />
          </FichaDoTokenLembrada>
        )}
      </Fichas>
      <Cartoes titulo="Comportamento">
        {cartoes.map((cartao) => (
          <Cartao
            key={cartao.id}
            icone={<IconeDoLivro nome={cartao.icone} />}
            rotulo={cartao.rotulo}
            resumo={cartao.resumo}
            ligado={cartao.ligado}
            desligado={cartao.desligado}
            focar={focarCartao === cartao.id}
            onAbrir={(teclado) => {
              setPeloTeclado(teclado)
              setFocarCartao(null)
              useLivroDoMestreStore.getState().abrirSubFicha(token.id, cartao.id)
            }}
          />
        ))}
      </Cartoes>
    </div>
  )
}
