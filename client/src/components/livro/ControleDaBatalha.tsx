import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { BATTLE_SHORTCUT, isBattleShortcut } from '../../lib/keymap'
import {
  NOME_DA_BATALHA_MAX,
  NOME_PADRAO_DA_BATALHA,
  escolhaInicial,
  gravarAberturaLembrada,
  lerAberturaLembrada,
  nomeParaOFio,
  type ArmazemDaAbertura,
} from '../../lib/batalha/aberturaLembrada'
import { combatentesIniciais, type Desempate } from '../../lib/batalha/turnos'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from '../../stores/adventureStore'
import { useBatalhaStore, type AberturaDaBatalha } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { useRegrasDoCampoStore } from '../../stores/regrasDoCampoStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { EscolhaDaRegra, confirmarRascunho, type RascunhoDaRegra } from '../batalha/EscolhaDaRegra'
import { motivoParaNaoGuardar } from '../batalha/PainelDoMestre'
import { useLivroDaMesaStore } from '../../stores/livroDaMesaStore'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { assinarAberturasDeBatalha, listarAberturasDeBatalha } from '../../transicoes/aberturasDeBatalha'
import { AberturaDeBatalhaOverlay, type AberturaPedida } from '../../transicoes/AberturaDeBatalhaOverlay'
import { batalhaCabeNaGrade } from '../../pixi/gradeDaBatalha'
import type { GridShape } from '../../types/map'
import { Balao } from '../grimorio/Balao'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoSel, CampoTexto, type OpcaoDoSel } from '../grimorio/CampoTexto'
import { Dialogo } from '../grimorio/Dialogo'
import './livro.css'

/**
 * MODO BATALHA (fatia B5 de docs/planos/modo-batalha-2026-10-24.md): o
 * "Iniciar batalha" / "Encerrar batalha" do livro da mesa, no alto da página
 * Cenas, e o Shift+B de qualquer ponto do editor (menos num campo de texto).
 * Iniciar abre a escolha da abertura (as do pacote, ou "Nenhuma") e do nome
 * (começa em "Royals"; apagado = abertura sem nome), lembrados por aventura; confirmar liga a batalha na cena
 * (`batalhaStore.ligar`), o App manda `batalha.iniciada` aos jogadores e à TV,
 * e a abertura toca aqui também. Encerrar desliga. Mapa triangular não tem
 * batalha (decisão 7): o botão fica desligado e o balão diz o motivo.
 */

/** O valor de "Nenhuma" na lista; nenhum id de abertura é vazio (o registro exige id). */
const NENHUMA = ''

/** BATALHA F1 (decisão 2): o empate de Agilidade, escolhido ao iniciar e trocado depois no painel. */
const OPCOES_DO_DESEMPATE: readonly OpcaoDoSeg<Desempate>[] = [
  { valor: 'd20', rotulo: '1d20' },
  { valor: 'manual', rotulo: 'Eu decido' },
]
const SEM_REGRA: RascunhoDaRegra = { modo: 'nenhuma' }

export const MOTIVO_SEM_BATALHA_TRIANGULAR = 'Sem batalha em mapa triangular: a grade de batalha só existe em quadrado e hex'

function armazemDoAparelho(): ArmazemDaAbertura | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export interface ControleDaBatalhaProps {
  /** A cena aberta (`tableSceneKey`: o id da cena na aventura, ou o id do mapa solto). */
  sceneKey: string
  gridShape: GridShape
  /** A aventura aberta, para lembrar a escolha; `null` = mapa solto. */
  aventuraId: string | null
  /** Só para o teste: onde a escolha fica guardada. Ausente = o `localStorage` deste aparelho. */
  armazem?: ArmazemDaAbertura | null
}

export function ControleDaBatalha({ sceneKey, gridShape, aventuraId, armazem }: ControleDaBatalhaProps) {
  const ligada = useBatalhaStore((state) => Object.hasOwn(state.cenas, sceneKey))
  // B6 (decisão 3): só o mestre zera os caminhos; sem caminho andado não há o que zerar.
  const algumCaminho = useBatalhaStore((state) => {
    const cena = Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined
    return cena !== undefined && Object.keys(cena.caminhos).length > 0
  })
  const anuncio = useBatalhaStore((state) => state.anuncio)
  const aberturas = useSyncExternalStore(assinarAberturasDeBatalha, listarAberturasDeBatalha)
  const [escolhendo, setEscolhendo] = useState(false)
  const [transicao, setTransicao] = useState(NENHUMA)
  const [nome, setNome] = useState(NOME_PADRAO_DA_BATALHA)
  const [desempate, setDesempate] = useState<Desempate>('d20')
  const [regra, setRegra] = useState<RascunhoDaRegra>(SEM_REGRA)
  const regrasDaBiblioteca = useRegrasDoCampoStore((state) => state.regras)
  const naoGuarda = useRegrasDoCampoStore((state) => motivoParaNaoGuardar(state.carregando, state.podeGravar))
  const cabe = batalhaCabeNaGrade(gridShape)
  // Encerrar sempre vale (o mapa pode ter virado triangular com a batalha ligada); só iniciar fica desligado.
  const bloqueado = !cabe && !ligada
  const guardado = armazem === undefined ? armazemDoAparelho() : armazem
  // Só o anúncio feito depois de montar toca aqui: remontar o livro não repete a abertura de antes.
  const seqNaMontagem = useRef(useBatalhaStore.getState().anuncio?.seq ?? 0)

  const opcoes = useMemo<OpcaoDoSel<string>[]>(
    () => [{ valor: NENHUMA, rotulo: 'Nenhuma' }, ...aberturas.map((abertura) => ({ valor: abertura.id, rotulo: abertura.nome }))],
    [aberturas],
  )

  const abrirEscolha = () => {
    const inicial = escolhaInicial(
      lerAberturaLembrada(guardado, aventuraId),
      listarAberturasDeBatalha().map((abertura) => abertura.id),
    )
    setTransicao(inicial.transicao ?? NENHUMA)
    setNome(inicial.texto)
    setRegra(SEM_REGRA)
    // A biblioteca global de regras do campo (lida uma vez; as chamadas seguintes devolvem a mesma promessa).
    void useRegrasDoCampoStore.getState().carregar()
    setEscolhendo(true)
  }

  const alternar = () => {
    if (ligada) useBatalhaStore.getState().desligar(sceneKey)
    else if (cabe) abrirEscolha()
  }

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    if (!cabe) return
    const abertura: AberturaDaBatalha = {}
    if (transicao !== NENHUMA) abertura.transicao = transicao
    const texto = nomeParaOFio(nome)
    if (texto !== undefined) abertura.texto = texto
    gravarAberturaLembrada(guardado, aventuraId, { transicao: transicao === NENHUMA ? null : transicao, texto: nome.slice(0, NOME_DA_BATALHA_MAX) })
    setEscolhendo(false)
    // BATALHA F1: entra toda ficha da cena aberta com personagem (e não escondida), pela Agilidade.
    const aventura = useAdventureStore.getState()
    const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(aventura)) ?? null
    const regras = confirmarRascunho(regra, regrasDaBiblioteca, useRegrasDoCampoStore.getState())
    const combatentes = combatentesIniciais(useMapStore.getState().map.tokens, personagensAtivos(aventura), sistema)
    useBatalhaStore.getState().ligar(sceneKey, abertura, { combatentes, regras, desempate })
    // BATALHA F2 (5.1): iniciar (pelo botão ou pelo Shift+B) leva o livro à página Batalha; encerrar deixa onde está.
    useLivroDaMesaStore.getState().abrirPagina('batalha')
  }

  // Shift+B de qualquer ponto do editor; com a escolha aberta a tecla é dela (o Esc fecha).
  const alternarAgora = useRef(alternar)
  alternarAgora.current = alternar
  const escolhendoAgora = useRef(escolhendo)
  escolhendoAgora.current = escolhendo
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
      if (!apertou || escolhendoAgora.current) return
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

  const rotulo = ligada ? 'Encerrar batalha' : 'Iniciar batalha'
  const balao = bloqueado ? MOTIVO_SEM_BATALHA_TRIANGULAR : ligada ? 'Encerrar a batalha nesta cena: a grade some e o caminho andado zera' : 'Iniciar a batalha nesta cena: escolher a abertura e ligar a grade'

  return (
    <div className="gr-batalha">
      <Balao texto={balao} atalho={bloqueado ? undefined : BATTLE_SHORTCUT}>
        {(gatilho) => (
          <Botao
            {...gatilho}
            largo
            variante={ligada ? 'perigo' : 'latao'}
            aria-pressed={ligada}
            aria-disabled={bloqueado}
            aria-keyshortcuts={bloqueado ? undefined : BATTLE_SHORTCUT}
            onClick={alternar}
          >
            {rotulo}
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
                if (algumCaminho) useBatalhaStore.getState().zerarCaminhos(sceneKey)
              }}
            >
              Zerar caminhos
            </Botao>
          )}
        </Balao>
      )}
      <Dialogo aberto={escolhendo} titulo="Iniciar batalha" onFechar={() => setEscolhendo(false)} pequeno descricao="A abertura toca no mestre, nos jogadores e na TV.">
        <form className="gr-batalha-dlg" onSubmit={confirmar}>
          <CampoSel rotulo="Abertura" opcoes={opcoes} valor={transicao} onChange={setTransicao} />
          {/* Vazio = a abertura toca sem nome; o placeholder diz isso (o "Royals" é só o valor inicial). */}
          <CampoTexto rotulo="Nome na abertura" valor={nome} onChange={setNome} maxLength={NOME_DA_BATALHA_MAX} placeholder="Sem nome" />
          <CampoSeg rotulo="Empate na Agilidade" opcoes={OPCOES_DO_DESEMPATE} valor={desempate} onChange={setDesempate} />
          <EscolhaDaRegra biblioteca={regrasDaBiblioteca} valor={regra} onChange={setRegra} naoGuarda={naoGuarda} />
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
      <AberturaDeBatalhaOverlay abertura={pedido} />
    </div>
  )
}
