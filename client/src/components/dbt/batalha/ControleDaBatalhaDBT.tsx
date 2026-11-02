import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import {
  NOME_DA_BATALHA_MAX,
  escolhaInicial,
  gravarAberturaLembrada,
  lerAberturaLembrada,
  nomeParaOFio,
  type ArmazemDaAbertura,
} from '../../../lib/batalha/aberturaLembrada'
import type { LinhaDoFimDBT } from '../../../lib/dbt/batalha/fim'
import { entrantesDaCena } from '../../../lib/dbt/batalha/inicio'
import type { ModoDaBatalha } from '../../../lib/dbt/batalha/tipos'
import { BATTLE_SHORTCUT, isBattleShortcut } from '../../../lib/keymap'
import { batalhaCabeNaGrade } from '../../../pixi/gradeDaBatalha'
import { equipesAtivas, personagensAtivos, useAdventureStore } from '../../../stores/adventureStore'
import { useBatalhaStore } from '../../../stores/batalhaStore'
import { useBatalhaDBTStore, type AberturaDaBatalhaDBT } from '../../../stores/batalhaDBTStore'
import { useLivroDaMesaStore } from '../../../stores/livroDaMesaStore'
import { useMapStore } from '../../../stores/mapStore'
import { AberturaDeBatalhaOverlay, type AberturaPedida } from '../../../transicoes/AberturaDeBatalhaOverlay'
import { assinarAberturasDeBatalha, listarAberturasDeBatalha } from '../../../transicoes/aberturasDeBatalha'
import type { GridShape } from '../../../types/map'
import { Balao } from '../../grimorio/Balao'
import { Acoes, Botao } from '../../grimorio/Botao'
import { CampoSeg, type OpcaoDoSeg } from '../../grimorio/CampoSeg'
import { CampoSel, CampoTexto, type OpcaoDoSel } from '../../grimorio/CampoTexto'
import { Dialogo } from '../../grimorio/Dialogo'
import { FimDaBatalhaDBT } from './FimDaBatalhaDBT'

/**
 * INICIAR / ENCERRAR a batalha DBT (seção 19, `ControleDaBatalhaDBT`): o
 * mesmo lugar e o mesmo Shift+B do One Piece, com as opções do DBT (modo,
 * exaustão, salvaguarda de NPC). Entram as fichas da cena (escondidas e NPC
 * "só cenário" ficam fora; o mestre inclui depois pelo painel). Encerrar
 * abre o fim em duas etapas (tabela da exaustão e confirmação).
 */

export interface ControleDaBatalhaDBTProps {
  /** A cena aberta (`tableSceneKey`). */
  sceneKey: string
  gridShape: GridShape
  /** A aventura aberta, para lembrar a abertura; `null` = mapa solto. */
  aventuraId: string | null
}

const NENHUMA = ''
const SEM_GRADE = 'Sem batalha em mapa triangular: a grade de batalha só existe em quadrado e hex'
const JA_TEM_BATALHA = 'Esta cena já está numa batalha de outro sistema. Encerre aquela antes.'

const MODOS: readonly OpcaoDoSeg<ModoDaBatalha>[] = [
  { valor: 'automatico', rotulo: 'Automático' },
  { valor: 'manual', rotulo: 'Manual' },
]
type SimNao = 'sim' | 'nao'
const SIM_NAO: readonly OpcaoDoSeg<SimNao>[] = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
]

function armazemDoAparelho(): ArmazemDaAbertura | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function ControleDaBatalhaDBT({ sceneKey, gridShape, aventuraId }: ControleDaBatalhaDBTProps) {
  const ligada = useBatalhaDBTStore((state) => Object.hasOwn(state.cenas, sceneKey))
  const algumCaminho = useBatalhaDBTStore((state) => Object.hasOwn(state.cenas, sceneKey) && Object.keys(state.cenas[sceneKey].caminhos).length > 0)
  const exaustao = useBatalhaDBTStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey].opcoes.exaustao : true))
  const anuncio = useBatalhaDBTStore((state) => state.anuncio)
  const aberturas = useSyncExternalStore(assinarAberturasDeBatalha, listarAberturasDeBatalha)
  const [escolhendo, setEscolhendo] = useState(false)
  const [transicao, setTransicao] = useState(NENHUMA)
  const [nome, setNome] = useState('')
  const [modo, setModo] = useState<ModoDaBatalha>('automatico')
  const [comExaustao, setComExaustao] = useState<SimNao>('sim')
  const [salvaguardaDeNpc, setSalvaguardaDeNpc] = useState<SimNao>('nao')
  const [erro, setErro] = useState<string | null>(null)
  const [fim, setFim] = useState<{ chave: number; aberto: boolean; linhas: readonly LinhaDoFimDBT[] } | null>(null)
  const cabe = batalhaCabeNaGrade(gridShape)
  const bloqueado = !cabe && !ligada
  const guardado = armazemDoAparelho()
  // Só o anúncio feito depois de montar toca aqui: remontar o livro não repete a abertura.
  const seqNaMontagem = useRef(useBatalhaDBTStore.getState().anuncio?.seq ?? 0)

  const opcoes = useMemo<OpcaoDoSel<string>[]>(() => [{ valor: NENHUMA, rotulo: 'Nenhuma' }, ...aberturas.map((abertura) => ({ valor: abertura.id, rotulo: abertura.nome }))], [aberturas])

  const abrirEscolha = () => {
    const inicial = escolhaInicial(
      lerAberturaLembrada(guardado, aventuraId),
      listarAberturasDeBatalha().map((abertura) => abertura.id),
    )
    setTransicao(inicial.transicao ?? NENHUMA)
    setNome(inicial.texto)
    setErro(null)
    setEscolhendo(true)
  }

  const abrirFim = () => setFim((antes) => ({ chave: (antes?.chave ?? 0) + 1, aberto: true, linhas: useBatalhaDBTStore.getState().resumoDoFim(sceneKey) }))

  const alternar = () => {
    if (ligada) abrirFim()
    else if (cabe) abrirEscolha()
  }

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    if (!cabe) return
    const abertura: AberturaDaBatalhaDBT = {}
    if (transicao !== NENHUMA) abertura.transicao = transicao
    const texto = nomeParaOFio(nome)
    if (texto !== undefined) abertura.texto = texto
    gravarAberturaLembrada(guardado, aventuraId, { transicao: transicao === NENHUMA ? null : transicao, texto: nome.slice(0, NOME_DA_BATALHA_MAX) })
    const aventura = useAdventureStore.getState()
    const entrantes = entrantesDaCena(useMapStore.getState().map.tokens, personagensAtivos(aventura), equipesAtivas(aventura))
    const ok = useBatalhaDBTStore
      .getState()
      .ligar(sceneKey, abertura, { entrantes, opcoes: { modo, exaustao: comExaustao === 'sim', salvaguardaDeNpc: salvaguardaDeNpc === 'sim' } }, useBatalhaStore.getState().ligada(sceneKey))
    if (!ok) {
      setErro(JA_TEM_BATALHA)
      return
    }
    setEscolhendo(false)
    useLivroDaMesaStore.getState().abrirPagina('batalha')
  }

  // Shift+B de qualquer ponto do editor; com uma janela aberta a tecla é dela.
  const alternarAgora = useRef(alternar)
  alternarAgora.current = alternar
  const ocupado = useRef(false)
  ocupado.current = escolhendo || fim?.aberto === true
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      const alvo = evento.target instanceof HTMLElement ? evento.target : null
      const apertou = isBattleShortcut({
        key: evento.key,
        ctrlKey: evento.ctrlKey,
        metaKey: evento.metaKey,
        shiftKey: evento.shiftKey,
        altKey: evento.altKey,
        targetTagName: alvo?.tagName ?? '',
        targetInputType: alvo instanceof HTMLInputElement ? alvo.type : undefined,
        targetContentEditable: alvo?.isContentEditable ?? false,
      })
      if (!apertou || ocupado.current) return
      evento.preventDefault()
      alternarAgora.current()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  const pedido: AberturaPedida | null =
    anuncio === null || anuncio.seq <= seqNaMontagem.current
      ? null
      : { id: anuncio.seq, ...(anuncio.transicao === undefined ? {} : { transicao: anuncio.transicao }), ...(anuncio.texto === undefined ? {} : { texto: anuncio.texto }) }

  const balao = bloqueado ? SEM_GRADE : ligada ? 'Encerrar: revisar a exaustão de cada ficha e desligar a batalha' : 'Iniciar a batalha Dragon Ball nesta cena'

  return (
    <div className="gr-batalha">
      <Balao texto={balao} atalho={bloqueado ? undefined : BATTLE_SHORTCUT}>
        {(gatilho) => (
          <Botao {...gatilho} largo variante={ligada ? 'perigo' : 'latao'} aria-pressed={ligada} aria-disabled={bloqueado} aria-keyshortcuts={bloqueado ? undefined : BATTLE_SHORTCUT} onClick={alternar}>
            {ligada ? 'Encerrar batalha' : 'Iniciar batalha'}
          </Botao>
        )}
      </Balao>
      {ligada && (
        <Balao texto={algumCaminho ? 'Apaga o caminho andado de todas as fichas desta cena' : 'Nenhuma ficha andou desde o último zerar'}>
          {(gatilho) => (
            <Botao
              {...gatilho}
              largo
              variante="fantasma"
              aria-disabled={!algumCaminho}
              onClick={() => {
                if (algumCaminho) useBatalhaDBTStore.getState().zerarCaminhos(sceneKey)
              }}
            >
              Zerar caminhos
            </Botao>
          )}
        </Balao>
      )}
      <Dialogo aberto={escolhendo} titulo="Iniciar batalha" onFechar={() => setEscolhendo(false)} pequeno descricao="Entram as fichas da cena. A abertura toca no mestre, nos jogadores e na TV.">
        <form className="gr-batalha-dlg" onSubmit={confirmar}>
          <CampoSel rotulo="Abertura" opcoes={opcoes} valor={transicao} onChange={setTransicao} />
          <CampoTexto rotulo="Nome na abertura" valor={nome} onChange={setNome} maxLength={NOME_DA_BATALHA_MAX} placeholder="Sem nome" />
          <CampoSeg rotulo="Modo" opcoes={MODOS} valor={modo} onChange={setModo} />
          <CampoSeg rotulo="Exaustão no fim (8.5.1)" opcoes={SIM_NAO} valor={comExaustao} onChange={setComExaustao} />
          <CampoSeg rotulo="NPC a 0 PV rola salvaguarda" opcoes={SIM_NAO} valor={salvaguardaDeNpc} onChange={setSalvaguardaDeNpc} />
          {erro !== null && (
            <p className="lb-batalha-pagina__vazia" role="alert">
              {erro}
            </p>
          )}
          <Acoes>
            <Botao tipo="submit" variante="primario">
              Iniciar
            </Botao>
            <Botao variante="fantasma" onClick={() => setEscolhendo(false)}>
              Cancelar
            </Botao>
          </Acoes>
        </form>
      </Dialogo>
      {fim !== null && (
        <FimDaBatalhaDBT
          key={fim.chave}
          aberto={fim.aberto}
          linhas={fim.linhas}
          exaustao={exaustao}
          onFechar={() => setFim({ ...fim, aberto: false })}
          onEncerrar={(linhas) => {
            setFim({ ...fim, aberto: false })
            useBatalhaDBTStore.getState().encerrar(sceneKey, linhas)
          }}
        />
      )}
      <AberturaDeBatalhaOverlay abertura={pedido} />
    </div>
  )
}
