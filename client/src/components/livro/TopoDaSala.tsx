import { useId, useRef, useState, type ReactNode, type Ref } from 'react'
import { estaCalado, useSomStore } from '../../stores/somStore'
import { useToastStore } from '../../stores/toastStore'
import { ControleDeSom, TITULO_DO_SOM } from '../ControleDeSom'
import { EscolherFichaDeTeste, type AberturaDaEscolha } from '../EscolherFichaDeTeste'
import { FirewallHint, LASER_HINT, OpenRoom, TunnelSection, VisaoDeJogadorBotao, qrDataUrl, type RoomPanelProps } from '../RoomPanel'
import { Acoes, Botao } from '../grimorio/Botao'
import { Balao, type PropsDoGatilho } from '../grimorio/Balao'
import { Dialogo } from '../grimorio/Dialogo'
import { MenuItem, MenuSeparador, Pop } from '../grimorio/Pop'
import { classes } from '../grimorio/comum'
import { IconeDoLivro } from './icones'

/** "Pausar NPCs" do menu "Mais da sala": só existe com alguém andando sozinho. */
export interface PausaDosNpcs {
  pausados: boolean
  onAlternar: () => void
}

export type TopoDaSalaProps = Pick<
  RoomPanelProps,
  'room' | 'players' | 'savedTableNames' | 'onStart' | 'onStop' | 'tunnel' | 'onStartTunnel' | 'onStopTunnel' | 'laserOn' | 'onToggleLaser' | 'visaoDeJogador'
> & {
  /** Há NPC andando sozinho: o "Mais da sala" pausa e retoma. Ausente = sem o item. */
  npcs?: PausaDosNpcs
}

/** O que o "Fechar a sala?" avisa: quem sai da mesa. O mapa e as fichas nunca saem. */
export function avisoDeFecharASala(conectados: number): string {
  const quem =
    conectados === 0
      ? 'Ninguém está conectado agora.'
      : conectados === 1
        ? 'O jogador conectado sai da mesa.'
        : `Os ${conectados} jogadores conectados saem da mesa.`
  return `${quem} O mapa e as fichas ficam como estão.`
}

/** Junta a ref do balão com a de quem precisa do botão (o pop se ancora nele). */
function juntarRefs(gatilho: PropsDoGatilho, ref: Ref<HTMLButtonElement>): Omit<PropsDoGatilho, 'ref'> & { ref: (no: HTMLButtonElement | null) => void } {
  return {
    ...gatilho,
    ref: (no) => {
      gatilho.ref(no)
      if (typeof ref === 'function') ref(no)
      else if (ref) ref.current = no
    },
  }
}

/**
 * A placa de metal com o código, que copia ao clicar. Nasce com o reflexo que
 * corre uma vez (a sala acabou de abrir: momento raro, 1x por sessão); com
 * movimento reduzido o reflexo não aparece.
 */
function PlacaDoCodigo({ codigo }: { codigo: string }) {
  const [brilhar, setBrilhar] = useState(true)
  const copiar = () => {
    const avisos = useToastStore.getState()
    const naoDeu = () => avisos.push('error', `Não deu para copiar. O código da sala é ${codigo}.`)
    // Fora de contexto seguro o navegador não dá a área de transferência.
    if (navigator.clipboard === undefined) {
      naoDeu()
      return
    }
    navigator.clipboard.writeText(codigo).then(() => avisos.push('info', `Código ${codigo} copiado.`), naoDeu)
  }
  return (
    <Balao texto="Copiar o código">
      {(gatilho) => (
        <button
          type="button"
          className={classes('gr-placa-codigo', brilhar && 'gr-brilha')}
          aria-label={`Código da sala ${codigo}. Clique para copiar`}
          {...gatilho}
          onClick={copiar}
          onAnimationEnd={() => setBrilhar(false)}
        >
          {codigo}
          <IconeDoLivro nome="copiar" />
        </button>
      )}
    </Balao>
  )
}

/** Botão do topo com o pop que ele abre (Som, Convidar, Rede): o gatilho alterna e recebe o foco de volta. */
function BotaoComPop({
  rotulo,
  icone,
  texto,
  fantasma,
  estado,
  lado,
  children,
}: {
  rotulo: string
  icone: ReactNode
  texto: string
  fantasma?: boolean
  /** O estado que o ícone mostra ("mudo"), também para quem lê a tela por código. */
  estado?: string
  lado: 'baixo' | 'esq'
  children: ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const gatilho = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Botao
        ref={gatilho}
        tamanho="p"
        variante={fantasma ? 'fantasma' : undefined}
        data-estado={estado}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => setAberto((agora) => !agora)}
      >
        {icone}
        {texto}
      </Botao>
      <Pop aberto={aberto} gatilho={gatilho} onFechar={() => setAberto(false)} lado={lado} tipo="dialogo" rotulo={rotulo} titulo={rotulo}>
        {children}
      </Pop>
    </>
  )
}

/** Sala aberta: o código, o "Mais da sala" (Visão de jogador, Pausar NPCs, Fechar sala), Laser, Som e Convidar. */
function SalaAberta({ room, players, onStop, tunnel, onStartTunnel, onStopTunnel, laserOn = false, onToggleLaser, visaoDeJogador, npcs }: TopoDaSalaProps & { room: NonNullable<TopoDaSalaProps['room']> }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [escolha, setEscolha] = useState<{ ancora: HTMLElement; abertura: AberturaDaEscolha } | null>(null)
  const gatilhoDoMenu = useRef<HTMLButtonElement>(null)
  const continuar = useRef<HTMLButtonElement>(null)
  const escolhaId = useId()
  const calado = useSomStore((estado) => estaCalado(estado))
  // A janela de teste abriu (pela lista ou por outro caminho): a lista não vale mais.
  if (visaoDeJogador?.aberta === true && escolha !== null) setEscolha(null)

  const verComoJogador = () => {
    if (visaoDeJogador === undefined) return
    if (visaoDeJogador.aberta) {
      visaoDeJogador.onMostrar()
      return
    }
    const ancora = gatilhoDoMenu.current
    if (ancora !== null) setEscolha({ ancora, abertura: 'ponteiro' })
  }

  return (
    <>
      <div className="gr-linha">
        <h2 className="gr-sala-titulo">Sala</h2>
        <PlacaDoCodigo codigo={room.code} />
        <Balao texto="Mais da sala">
          {(gatilho) => (
            <Botao
              soIcone
              className="gr-empurra"
              aria-label="Mais da sala"
              aria-haspopup="menu"
              aria-expanded={menuAberto}
              {...juntarRefs(gatilho, gatilhoDoMenu)}
              onClick={() => setMenuAberto((agora) => !agora)}
            >
              <IconeDoLivro nome="reticencias" />
            </Botao>
          )}
        </Balao>
      </div>
      <div className="gr-linha">
        {onToggleLaser !== undefined && (
          <Botao tamanho="p" aria-pressed={laserOn} title={LASER_HINT} onClick={onToggleLaser}>
            <IconeDoLivro nome="laser" />
            Laser
          </Botao>
        )}
        <BotaoComPop rotulo={TITULO_DO_SOM} texto="Som" estado={calado ? 'mudo' : 'ligado'} icone={<IconeDoLivro nome={calado ? 'somMudo' : 'som'} />} lado="esq">
          <ControleDeSom variante="ficha" />
        </BotaoComPop>
        <BotaoComPop rotulo="Convidar jogadores" texto="Convidar" icone={<IconeDoLivro nome="convidar" />} lado="esq">
          {tunnel.kind !== 'ready' && <img className="lb-room__qr" src={qrDataUrl(room.qrSvg)} alt="QR da sala" />}
          <TunnelSection tunnel={tunnel} onStartTunnel={onStartTunnel} onStopTunnel={onStopTunnel} />
          <div className="gr-campo">
            <span className="gr-campo__rot">Endereços na rede local</span>
            <ul className="lb-room__urls">
              {room.urls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
          </div>
          <FirewallHint />
        </BotaoComPop>
      </div>
      <Pop aberto={menuAberto} gatilho={gatilhoDoMenu} onFechar={() => setMenuAberto(false)} rotulo="Mais da sala">
        {visaoDeJogador !== undefined && (
          <MenuItem icone={<IconeDoLivro nome="olho" />} onClick={verComoJogador}>
            Visão de jogador…
          </MenuItem>
        )}
        {npcs !== undefined && (
          <MenuItem icone={<IconeDoLivro nome="pausa" />} onClick={npcs.onAlternar}>
            {npcs.pausados ? 'Retomar os NPCs' : 'Pausar todos os NPCs'}
          </MenuItem>
        )}
        <MenuSeparador />
        <MenuItem perigo icone={<IconeDoLivro nome="dispensar" />} onClick={() => setConfirmando(true)}>
          Fechar sala…
        </MenuItem>
      </Pop>
      {visaoDeJogador !== undefined && escolha !== null && !visaoDeJogador.aberta && (
        <EscolherFichaDeTeste
          id={escolhaId}
          fichas={visaoDeJogador.fichas}
          fichaSelecionadaId={visaoDeJogador.fichaSelecionadaId}
          ancora={escolha.ancora}
          abertura={escolha.abertura}
          acaoDoEnter="abrir"
          onEscolher={(tokenId) => visaoDeJogador.onAbrir(tokenId)}
          onFechar={() => setEscolha(null)}
        />
      )}
      {/* Fechar a sala tira todo mundo da mesa: pergunta antes, com o foco no "Continuar jogando". */}
      <Dialogo aberto={confirmando} titulo="Fechar a sala?" onFechar={() => setConfirmando(false)} pequeno alerta focoInicial={continuar}>
        <p className="lb-room__fechar-aviso">{avisoDeFecharASala(players.filter((player) => player.connected).length)}</p>
        <Acoes>
          <Botao
            variante="perigo"
            onClick={() => {
              setConfirmando(false)
              onStop()
            }}
          >
            Fechar sala
          </Botao>
          <Botao ref={continuar} variante="fantasma" onClick={() => setConfirmando(false)}>
            Continuar jogando
          </Botao>
        </Acoes>
      </Dialogo>
    </>
  )
}

/**
 * O TOPO DA SALA no livro da mesa (fatia 4 do design consolidado): fixo
 * acima das páginas, nos dois estados. Fechada: "Abrir sala" (com o "Retomar a
 * mesa?" de sempre), Visão de jogador e Rede. Aberta: o código para copiar, o
 * "Mais da sala", Laser, Som e Convidar.
 */
export function TopoDaSala(props: TopoDaSalaProps) {
  const { room } = props
  if (room !== null) return <SalaAberta {...props} room={room} />
  return (
    <>
      <div className="gr-linha gr-linha--entre">
        <h2 className="gr-sala-titulo">Sala</h2>
        <span className="gr-sala-estado">
          <span className="gr-ponto-off" aria-hidden="true" />
          Fechada
        </span>
      </div>
      <OpenRoom savedTableNames={props.savedTableNames} onStart={props.onStart} />
      <div className="gr-linha gr-linha--entre gr-linha--quebra">
        {props.visaoDeJogador !== undefined && <VisaoDeJogadorBotao visao={props.visaoDeJogador} variante="topo" />}
        <BotaoComPop rotulo="Rede local" texto="Rede" fantasma icone={<IconeDoLivro nome="ajuda" />} lado="baixo">
          <FirewallHint />
        </BotaoComPop>
      </div>
    </>
  )
}
