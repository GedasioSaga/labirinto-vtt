import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
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
import { formasQueDesligamNoFim } from '../../lib/batalha/transformacao'
import { combatentesIniciais, type Desempate } from '../../lib/batalha/turnos'
import type { LadoDoNpc } from '../../lib/batalha/equipes'
import type { EscolhaDaBatalha } from '../../lib/livros/combate'
import { useToastStore } from '../../stores/toastStore'
import { QuemEntraNaBatalha } from './QuemEntraNaBatalha'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from '../../stores/adventureStore'
import { useBatalhaStore, type AberturaDaBatalha } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { useRegrasDoCampoStore } from '../../stores/regrasDoCampoStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { useEscolhaNoMapa } from '../batalha/escolhaNoMapa'
import { EscolhaDaRegra, confirmarRascunho, type RascunhoDaRegra } from '../batalha/EscolhaDaRegra'
import { lerQuemPodeEntrar, prepararQuemEntra, rotulosDoMapa, type ListaDeQuemEntra } from '../batalha/fichasDeQuemEntra'
import { motivoParaNaoGuardar } from '../batalha/PainelDoMestre'
import { useLivroDaMesaStore } from '../../stores/livroDaMesaStore'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { assinarAberturasDeBatalha, listarAberturasDeBatalha } from '../../transicoes/aberturasDeBatalha'
import { AberturaDeBatalhaOverlay, type AberturaPedida } from '../../transicoes/AberturaDeBatalhaOverlay'
import { pretenderAbertura } from '../../transicoes/intencao'
import { batalhaCabeNaGrade } from '../../pixi/gradeDaBatalha'
import type { GridShape } from '../../types/map'
import { Balao } from '../grimorio/Balao'
import { Botao } from '../grimorio/Botao'
import { CampoSel, CampoTexto, type OpcaoDoSel } from '../grimorio/CampoTexto'
import './livro.css'

/**
 * MODO BATALHA (fatia B5 de docs/planos/modo-batalha-2026-10-24.md): o
 * "Iniciar batalha" / "Encerrar batalha" do livro da mesa, no alto da página
 * Batalha, e o Shift+B de qualquer ponto do editor (menos num campo de texto).
 * Iniciar abre, no próprio livro (sem janela por cima do mapa), a escolha da
 * abertura (as do pacote, ou "Nenhuma"), do nome (começa em "Royals"; apagado
 * = abertura sem nome), lembrados por aventura, e a LISTA DE QUEM ENTRA,
 * sempre à vista (conserto de 09/11/2026, achado 3): todos com ficha de
 * combate marcados, ou só quem o mestre selecionou no mapa. Confirmar liga a
 * batalha na cena (`batalhaStore.ligar`), o App manda `batalha.iniciada` aos
 * jogadores e à TV, e a abertura toca aqui também. Encerrar desliga. Mapa
 * triangular não tem batalha (decisão 7): o botão fica desligado e o balão
 * diz o motivo.
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

/** O "Iniciar batalha" aberto. `chave` muda a cada vez: a lista nasce com as marcas novas. */
interface CaixaDoIniciar {
  chave: number
  lista: ListaDeQuemEntra
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
  const [transicao, setTransicao] = useState(NENHUMA)
  const [nome, setNome] = useState(NOME_PADRAO_DA_BATALHA)
  const [desempate, setDesempate] = useState<Desempate>('d20')
  const [regra, setRegra] = useState<RascunhoDaRegra>(SEM_REGRA)
  const [caixa, setCaixa] = useState<CaixaDoIniciar | null>(null)
  // Com a lista aberta, passar o mouse num nome acende a ficha e clicar numa ficha no mapa marca ou desmarca. Fechou, o clique guardado some (achado 1).
  const noMapa = useEscolhaNoMapa(caixa !== null && caixa.lista.candidatos.length > 0)
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
    // Lida AGORA, antes de a lista tomar a seleção do mapa: as fichas que o mestre selecionou já vêm marcadas (com os jogadores).
    const lista = lerQuemPodeEntrar()
    // A lista mora na página Batalha do livro (sem janela por cima do mapa); o livro vai até ela.
    useLivroDaMesaStore.getState().abrirPagina('batalha')
    setCaixa((antes) => ({ chave: (antes?.chave ?? 0) + 1, lista }))
  }

  /**
   * Conserto das fichas F1 (resposta do Vagn, troca a Q3): o Encerrar desliga
   * TODAS as formas de quem estava na batalha. Lido antes de desligar: um
   * aviso por personagem ("Alexei saiu de Caçada (fim da batalha)").
   */
  const encerrar = () => {
    const batalha = useBatalhaStore.getState()
    const cena = Object.hasOwn(batalha.cenas, sceneKey) ? batalha.cenas[sceneKey] : undefined
    const aventura = useAdventureStore.getState()
    const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(aventura)) ?? null
    const ids = cena === undefined ? [] : [...cena.turnos.cartas.flatMap((carta) => (carta.personagemId === null ? [] : [carta.personagemId])), ...Object.keys(cena.turnos.combate ?? {})]
    const sairam = formasQueDesligamNoFim(ids, personagensAtivos(aventura), sistema)
    batalha.desligar(sceneKey)
    for (const linha of sairam) useToastStore.getState().push('info', linha)
  }

  const alternar = () => {
    if (ligada) encerrar()
    // Com a escolha aberta, o botão a fecha (como o Cancelar).
    else if (caixa !== null) setCaixa(null)
    else if (cabe) abrirEscolha()
  }

  /**
   * Liga a batalha. BATALHA F1: entra toda ficha da cena aberta com personagem
   * (e não escondida), pela Agilidade; com `incluir` (a caixa "Quem entra na
   * batalha?"), só os tokens marcados. A regra do campo só é confirmada aqui
   * (ela pode gravar na biblioteca): cancelar a caixa não guarda nada.
   */
  const ligarBatalha = (abertura: AberturaDaBatalha, incluir?: ReadonlySet<string>) => {
    const aventura = useAdventureStore.getState()
    const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(aventura)) ?? null
    const regras = confirmarRascunho(regra, regrasDaBiblioteca, useRegrasDoCampoStore.getState())
    // Achado 4 (09/11): o nome numerado ("Urso 2") vai na carta, e dela para o registro.
    const rotulos = rotulosDoMapa()
    const tokens = useMapStore.getState().map.tokens.map((token) => ({ ...token, name: rotulos.get(token.id) ?? token.name }))
    const combatentes = combatentesIniciais(tokens, personagensAtivos(aventura), sistema, incluir)
    useBatalhaStore.getState().ligar(sceneKey, abertura, { combatentes, regras, desempate })
    // BATALHA F2 (5.1): iniciar (pelo botão ou pelo Shift+B) leva o livro à página Batalha; encerrar deixa onde está.
    useLivroDaMesaStore.getState().abrirPagina('batalha')
  }

  /**
   * "Iniciar com N": guarda a abertura escolhida, cria as fichas de quem entra
   * sem ficha (mínima ou variação do modelo; ficam nos NPCs de combate, decisão
   * D3), põe cada NPC no lado escolhido e inicia só com os marcados. Cena sem
   * ninguém para marcar (ou aventura sem sistema): o Iniciar de sempre.
   */
  const confirmarQuemEntra = (escolhas: EscolhaDaBatalha[], lados: ReadonlyMap<string, LadoDoNpc>) => {
    if (caixa === null || !cabe) return
    const abertura: AberturaDaBatalha = {}
    if (transicao !== NENHUMA) abertura.transicao = transicao
    const texto = nomeParaOFio(nome)
    if (texto !== undefined) abertura.texto = texto
    gravarAberturaLembrada(guardado, aventuraId, { transicao: transicao === NENHUMA ? null : transicao, texto: nome.slice(0, NOME_DA_BATALHA_MAX) })
    setCaixa(null)
    // Cena sem ninguém na lista: o Iniciar de sempre (a batalha liga sem cartas).
    if (caixa.lista.candidatos.length === 0) {
      ligarBatalha(abertura)
      return
    }
    const entram = prepararQuemEntra(escolhas, lados)
    if (entram !== null) ligarBatalha(abertura, new Set(entram.map((token) => token.id)))
  }

  // Com o "Iniciar batalha" aberto e uma abertura escolhida, as telas dos jogadores já preparam
  // essa cutscene antes de o mestre confirmar. Fechou ou trocou para "Nenhuma": desfaz o aviso.
  useEffect(() => {
    pretenderAbertura(caixa !== null && transicao !== NENHUMA ? transicao : null)
  }, [caixa, transicao])
  useEffect(() => () => pretenderAbertura(null), [])

  // Shift+B de qualquer ponto do editor; com a escolha aberta a tecla é dela (o Esc fecha).
  const alternarAgora = useRef(alternar)
  alternarAgora.current = alternar
  const escolhendoAgora = useRef(false)
  escolhendoAgora.current = caixa !== null
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
      {caixa !== null && (
        <QuemEntraNaBatalha
          key={caixa.chave}
          aberto
          titulo="Iniciar batalha"
          classeDoForm="gr-batalha-dlg"
          rotuloSemNinguem="Iniciar"
          antes={
            <>
              <CampoSel rotulo="Abertura" opcoes={opcoes} valor={transicao} onChange={setTransicao} />
              {/* Vazio = a abertura toca sem nome; o placeholder diz isso (o "Royals" é só o valor inicial). */}
              <CampoTexto rotulo="Nome na abertura" valor={nome} onChange={setNome} maxLength={NOME_DA_BATALHA_MAX} placeholder="Sem nome" />
              <p className="gr-nota">A abertura toca no mestre, nos jogadores e na TV.</p>
              <CampoSeg rotulo="Empate na Agilidade" opcoes={OPCOES_DO_DESEMPATE} valor={desempate} onChange={setDesempate} />
              <EscolhaDaRegra biblioteca={regrasDaBiblioteca} valor={regra} onChange={setRegra} naoGuarda={naoGuarda} />
            </>
          }
          candidatos={caixa.lista.candidatos}
          jogadoresSemFicha={caixa.lista.jogadoresSemFicha}
          modelos={caixa.lista.modelos}
          personagens={caixa.lista.personagens}
          rotulos={caixa.lista.rotulos}
          marcadosDePartida={caixa.lista.marcadosDePartida}
          avisoDaSelecao={caixa.lista.avisoDaSelecao}
          ladoDe={caixa.lista.ladoDe}
          onDestacar={noMapa.destacar}
          cliqueNoMapa={noMapa.clique}
          onConfirmar={confirmarQuemEntra}
          onCancelar={() => setCaixa(null)}
        />
      )}
      <AberturaDeBatalhaOverlay abertura={pedido} />
    </div>
  )
}
