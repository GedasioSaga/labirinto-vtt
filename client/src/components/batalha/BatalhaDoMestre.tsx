import { useEffect, useMemo } from 'react'
import { motivoDoConcentrar } from '../../lib/batalha/acoes'
import { ALVO_DA_REACAO, chaveDaVez, partesDoBonus, type FormaPendente, type PedidoDeAcao } from '../../lib/batalha/combate'
import { equipeDe } from '../../lib/batalha/equipes'
import { motivoDoEvoluir } from '../../lib/batalha/escolhaEEvolucao'
import { acoesDaCarta, sugestaoParaNpc } from '../../lib/batalha/golpe'
import { motivoDaInvocacao, quantosNoCampo } from '../../lib/batalha/invocacao'
import { armasDe, limiteDeArmas } from '../../lib/batalha/leituraDaFicha'
import { custosDasFormasNaTela } from '../../lib/batalha/custoPorTurno'
import { lembreteDoSelo, saidasTiradas, travaDoToken } from '../../lib/batalha/condicoes'
import { chavesDoDono, saidasTiradasDoDono, soOMestreReage } from '../../lib/batalha/mecanicasAMao'
import { avisoDasReducoes, reducoesDoDano } from '../../lib/batalha/reducaoDoDano'
import { reacoesParaOAlvo, reacoesPorPerto } from '../../lib/batalha/reacaoComTecnica'
import { alvosDeMod, bonusDaBatalha, bonusDaReacao, selosDoToken, textoDoSelo, textoDoSeloComMods, textoDosMods } from '../../lib/batalha/selos'
import { aparenciaDaForma, formasNoMenu } from '../../lib/batalha/transformacao'
import { formasComODecidirDoMestre } from '../../lib/batalha/mecanica/formaDoMestre'
import { cartaDaVez, tokensCaidos, type CartaDaOrdem, type TurnosDaCena } from '../../lib/batalha/turnos'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { vidasDaCena } from '../../lib/vidaDaFicha'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../../stores/adventureStore'
import { efeitosDaCena, useBatalhaStore, type BatalhaDaCena } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { AcoesExtrasDialog } from './AcoesExtrasDialog'
import { AjustarDialog } from './AjustarDialog'
import { DarDanoDialog } from './DarDanoDialog'
import { EfeitosDaBatalha } from './EfeitosDaBatalha'
import { usePassarVezDoMestre } from './passarVezDoMestre'
import { recursosDaCarta } from './dadosDaFaixa'
import { invocacaoDaFicha, pedidoDeInvocacao } from './dadosDaInvocacao'
import { RECUSA_SEM_MOTIVO, armaPadraoNaBatalha, economiaEmTexto, golpesDeAtaque, golpesDeHabilidade } from './dadosDoMenu'
import { EscolhaDeArmas } from './EscolhaDeArmas'
import { InvocacoesPendentes, PainelDoBando, type PendenciaNaTela } from './InvocacoesDoMestre'
import { FormasPendentes } from './FormasDoMestre'
import { alvosDaOrdem, alvosDoDarDano, nomeDaFicha, pendenciasDeInvocacaoNaTela, vezDoBandoNaTela, type MesaDoMestre } from './mesaDoMestre'
import { MenuDaVez, type InvocarNoMenu } from './MenuDaVez'
import { nomesNumerados } from './nomesNumerados'
import { pedidosDaVez, type PedidosDaVez } from './pedidosDaVez'
import './vezNoCentro.css'
import { consultaDoMestre, useMiraDoMestre } from './miraDoMestre'
import { PainelDaVezDoNpc } from './PainelDaVezDoNpc'
import { LembretesDaMarca, marcaNaTela, type MarcaNaTela } from './LembretesDaMarca'
import { LembretesDaPassiva, PassivasDaFicha, lembreteDaRegraNaTela, lembretesNaTela, passivasNaCena, type LembreteNaTela } from './PassivasDaBatalha'
import { ReacoesPendentes, type PendenteNaTela } from './ReacoesPendentes'
import { SeloDialog } from './SeloDialog'

/**
 * A BATALHA DO MESTRE na aba Batalha (S2): lê a cena na store e liga o painel
 * da vez (o do NPC, ou "Vez de Lia" com as Ações extras e o Dar dano), as
 * reações pendentes e os diálogos do mestre (dar dano, ações extras, armas
 * desta batalha, F3: pôr, editar e tirar selo), que o menu da carta da faixa
 * também abre. Toda ação vai direto à `batalhaStore` (o host avisa os
 * jogadores). Tipos de habilidade F3: os lembretes e a lista Passivas do NPC
 * da vez moram no painel dele; os lembretes dos OUTROS NPCs (o gatilho bate
 * fora da vez deles: rodada, dano) ficam numa seção curta acima das reações.
 * Os das fichas dos jogadores são dos jogadores (a tela deles pergunta).
 */

const MESTRE = { tipo: 'mestre' } as const

/** O que o mestre abriu pelo menu da carta ou pelo painel. `seloId` null = pôr um selo novo. */
export type DialogoDoMestre =
  | { tipo: 'dano'; tokenId: string | null }
  | { tipo: 'extras'; cartaId: string }
  | { tipo: 'armas'; personagemId: string }
  | { tipo: 'selo'; tokenId: string; seloId: string | null }
  /** R4 (lote de 01/11): o "Ajustar..." da carta. */
  | { tipo: 'ajustar'; tokenId: string; personagemId: string }

/** F3: os selos da ficha da vez, em botões (editar ou tirar), e "Pôr selo…". F2 dos tipos: a cor da natureza e os mods ("FOR +20"). */
function SelosDaVez({ turnos, tokenId, nome, sistema, onDialogo }: { turnos: TurnosDaCena; tokenId: string; nome: string; sistema: SistemaDeRpg | null; onDialogo: (dialogo: DialogoDoMestre) => void }) {
  const selos = selosDoToken(turnos.selos, tokenId)
  return (
    <div className="bt-selos-da-vez" role="group" aria-label={`Selos de ${nome}`}>
      {selos.map((selo) => {
        const mods = textoDosMods(selo.mods, sistema)
        // F2 (fatia A): o selo que só lembra o mestre (Ferido por prata) diz o quê no título e para o leitor de tela.
        const lembrete = lembreteDoSelo(selo.nome)
        return (
          <button
            key={selo.id}
            type="button"
            className="bt-selo bt-selo--botao"
            data-natureza={selo.natureza === 'condicao' ? undefined : selo.natureza}
            title={lembrete === null ? undefined : `${selo.nome}: ${lembrete}`}
            aria-label={`${textoDoSeloComMods(selo, sistema)}${lembrete === null ? '' : ` (${lembrete})`}: editar ou tirar`}
            onClick={() => onDialogo({ tipo: 'selo', tokenId, seloId: selo.id })}
          >
            {textoDoSelo(selo)}
            {mods !== '' && <span className="bt-selo__mods">{mods}</span>}
          </button>
        )
      })}
      <button type="button" className="bt-botao bt-botao--p" onClick={() => onDialogo({ tipo: 'selo', tokenId, seloId: null })}>
        Pôr selo…
      </button>
    </div>
  )
}

/** C6: nenhuma forma esperando o mestre (a mesma lista vazia, para a fila não refazer a cada quadro). */
const SEM_FORMAS_PENDENTES: readonly FormaPendente[] = []

/** A mesa do mapa: a leitura comum (`MesaDoMestre`, a mesma da Arena) com a cena inteira da store. */
interface Mesa extends MesaDoMestre {
  cena: BatalhaDaCena | undefined
}

function useMesa(sceneKey: string): Mesa {
  const cena = useBatalhaStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined))
  const fichas = useMapStore((state) => state.map.tokens)
  const tamanhoDaCasa = useMapStore((state) => state.map.grid)
  const personagens = useAdventureStore(personagensAtivos)
  const equipes = useAdventureStore(equipesAtivas)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const sistema = useMemo(() => sistemaPorId(biblioteca, sistemaId) ?? null, [biblioteca, sistemaId])
  const rotulos = useMemo(() => nomesNumerados(fichas.map((ficha) => ({ id: ficha.id, nome: ficha.name }))), [fichas])
  return { cena, fichas, tamanhoDaCasa, personagens, equipes, sistema, rotulos }
}

/** Ficha que o mestre move: sem personagem, ou de personagem NPC. */
function ehDoMestre(personagemId: string | null, personagens: readonly Personagem[]): boolean {
  if (personagemId === null) return true
  return personagens.find((personagem) => personagem.id === personagemId)?.tipo === 'npc'
}

/**
 * U4: os pedidos do mestre nesta cena saem da função única (`pedidosDaVez`),
 * a mesma da Arena, com nenhum desligado (o mapa tem onde pôr o invocado). A
 * ordem das cartas e o Passar a vez com a vez assentada (`usePassarVezDoMestre`)
 * seguem onde estavam.
 */
function usePedidosDoMestre(sceneKey: string): PedidosDaVez {
  return useMemo(() => pedidosDaVez(useBatalhaStore, sceneKey, MESTRE), [sceneKey])
}

/** Invocação F3: o Invocar do NPC da vez, com a regra da store (`motivoDaInvocacao`). */
function invocarDoNpc(invocar: NonNullable<PedidosDaVez['invocar']>, personagem: Personagem, sistema: SistemaDeRpg | null, turnos: TurnosDaCena, carta: CartaDaOrdem, acoes: ReturnType<typeof acoesDaCarta>): InvocarNoMenu {
  return {
    leitura: (cartaoId) => {
      const lida = invocacaoDaFicha(personagem, sistema, cartaoId)
      return lida === null ? null : { opcoes: lida.opcoes, imagem: lida.imagem }
    },
    contar: (cartaoId, opcao) => quantosNoCampo(turnos, personagem.id, cartaoId, opcao.chave),
    motivo: (cartaoId) => (opcao, custo, acao) => motivoDaInvocacao({ personagem, sistema, turnos, acoes }, pedidoDeInvocacao(carta.tokenId, cartaoId, opcao.chave, custo, acao)),
    onInvocar: (cartaoId, opcao, custo, acao) => invocar(pedidoDeInvocacao(carta.tokenId, cartaoId, opcao, custo, acao)),
    esperando: [],
  }
}

/** S4: com a trava (Atordoado, Paralisado), cada golpe apaga com o motivo dela; `null` = a lista como veio. */
function comATrava<T extends { motivo: string | null }>(lista: T[], trava: string | null): T[] {
  return trava === null ? lista : lista.map((item) => ({ ...item, motivo: trava }))
}

/**
 * Pedido de 09/11/2026 (item 5): os golpes e as formas da vez do NPC, lidos
 * num lugar só, para a aba Batalha e o menu do centro (`VezDoNpcNoCentro`)
 * mostrarem o mesmo.
 */
function golpesDaVezDoNpc(mesa: Mesa, turnos: TurnosDaCena, carta: CartaDaOrdem, personagem: Personagem | null, acoes: ReturnType<typeof acoesDaCarta>) {
  const { sistema } = mesa
  const combate = carta.personagemId === null ? undefined : turnos.combate?.[carta.personagemId]
  // Construtor C8: a arma padrão da ficha entra no "Dano da arma" das técnicas (sem padrão, a 1ª levada).
  const arma = armaPadraoNaBatalha(personagem, combate)
  // Tipos de habilidade F2: os selos do NPC somam na conta (a mesma `bonusDaBatalha` do jogador e da caixa).
  const bonus = bonusDaBatalha(turnos.selos, carta.tokenId)
  // Conserto das fichas F1 (S4): Atordoado ou Paralisado só passa a vez; tudo apaga com o motivo, menos o Encerrar.
  const trava = travaDoToken(turnos.selos, carta.tokenId)
  const habilidades = comATrava(personagem !== null && sistema !== null ? golpesDeHabilidade(personagem, sistema, combate, acoes, arma, bonus) : [], trava)
  const armas = comATrava(golpesDeAtaque(personagem, sistema, combate, acoes, bonus), trava)
  // F3: as formas do NPC (a tira Transformação). C6: a forma em que o mestre decide os números não mostra prévia; a que já espera fica apagada.
  const esperando = (turnos.formasPendentes ?? []).filter((pendente) => pendente.personagemId === personagem?.id)
  const formas = (personagem !== null && sistema !== null ? formasComODecidirDoMestre(formasNoMenu(personagem, sistema, acoes, combate), esperando) : []).map((forma) => (trava === null ? forma : { ...forma, motivo: trava, motivoDosUsos: trava }))
  return { trava, habilidades, armas, formas }
}

/** O "clicar na ficha escolhe o alvo" do menu do centro. Fora do componente: o efeito do `MenuDaVez` depende da identidade dela. */
function mirarNoMapaDoMestre(mirando: boolean): void {
  useMiraDoMestre.getState().mirar(mirando)
}

/** A sugestão do app para a vez do NPC, na forma que o menu e o painel leem: a chave do golpe e o alvo. */
function sugestaoNaTela(sugestao: ReturnType<typeof sugestaoParaNpc> | null): { chave: string | null; alvoTokenId: string | null } {
  if (sugestao === null) return { chave: null, alvoTokenId: null }
  return { chave: sugestao.cartaoId !== null ? `tecnica:${sugestao.cartaoId}` : sugestao.armaId !== null ? `arma:${sugestao.armaId}` : null, alvoTokenId: sugestao.alvoTokenId }
}

/**
 * Pedido de 09/11/2026 (item 5): a vez do NPC no MENU DO CENTRO, o mesmo do
 * jogador (`MenuDaVez`: as tiras, a lista de técnicas, a mira, teclado e
 * mouse), sobre o mapa do mestre (`App.tsx`, junto do `EfeitosDoMestre`). A
 * aba Batalha fica com o que é só do mestre: ordem, selos, lembretes, Dar
 * dano, Ações extras, Encerrar. A vez do bando (os invocados) segue na aba.
 */
export function VezDoNpcNoCentro({ sceneKey }: { sceneKey: string }) {
  const mesa = useMesa(sceneKey)
  const pedidos = usePedidosDoMestre(sceneKey)
  const alvoDoMapa = useMiraDoMestre((state) => state.alvo)
  const { cena, personagens, sistema, equipes } = mesa
  const turnos = cena?.turnos
  const passarAVez = usePassarVezDoMestre(sceneKey, turnos)
  const carta = turnos === undefined ? null : cartaDaVez(turnos)
  if (cena === undefined || turnos === undefined || carta === null || carta.bando !== undefined || !ehDoMestre(carta.personagemId, personagens)) return null

  const { personagemId, tokenId } = carta
  const personagem = personagemId === null ? null : (personagens.find((candidato) => candidato.id === personagemId) ?? null)
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: cena.regras })
  const combate = personagemId === null ? undefined : turnos.combate?.[personagemId]
  const carga = combate?.carga ?? 0
  const vez = { cartaId: carta.id, rodada: turnos.rodada }
  const { trava, habilidades, armas, formas } = golpesDaVezDoNpc(mesa, turnos, carta, personagem, acoes)
  const passivas = passivasNaCena(personagem, sistema, turnos, tokenId)
  // Achado 6: a sugestão do app chega ao menu do centro (a marca na tira e o alvo já marcado na mira).
  const sugestao = personagem === null ? null : sugestaoParaNpc(personagem, cena, { personagens, sistema, equipes, caidos: tokensCaidos(turnos.cartas, personagens, sistema) })
  return (
    <div className="bt-centro-do-mestre" data-limite-da-leitura>
      <MenuDaVez
        key={`${carta.id}:${turnos.rodada}`}
        quem={nomeDaFicha(mesa, tokenId, carta)}
        acoes={acoes}
        carga={carga}
        motivoDoConcentrar={trava ?? motivoDoConcentrar(combate, acoes, chaveDaVez(turnos.rodada, carta.id))}
        armas={armas}
        habilidades={habilidades}
        alvos={alvosDaOrdem(mesa, turnos.cartas, carta)}
        avisoDaRecusa={RECUSA_SEM_MOTIVO}
        // Conserto de 09/11 (a Bolha): toda recusa da regra chega ao mestre com o motivo dela.
        motivoDaRecusa={(pedido) => pedidos.motivoDoAgir(vez, pedido)}
        doMestre
        sugestao={sugestaoNaTela(sugestao)}
        onAgir={(pedido) => pedidos.agir(vez, pedido)}
        onZerarCarga={personagemId === null || carga === 0 ? undefined : () => pedidos.zerarCarga(personagemId)}
        onEncerrar={passarAVez}
        alvoDoMapa={alvoDoMapa}
        onMirando={mirarNoMapaDoMestre}
        consulta={consultaDoMestre}
        formas={formas}
        personagemId={personagemId}
        passivas={passivas.length === 0 ? undefined : { itens: passivas, tokenId, sistema, onPedir: pedidos.passiva }}
        evoluir={{
          // Tipos de habilidade F4: o mestre evolui sempre (fora da vez também); a regra é a da store.
          motivo: (cartaoId, custo) => motivoDoEvoluir({ personagem, sistema, turnos, soNaVez: false }, { tipo: 'evoluir', tokenId, cartaoId, custo }),
          onEvoluir: (cartaoId, custo) => pedidos.evoluir({ tipo: 'evoluir', tokenId, cartaoId, custo }),
        }}
        invocacao={personagem === null || pedidos.invocar === undefined ? undefined : invocarDoNpc(pedidos.invocar, personagem, sistema, turnos, carta, acoes)}
        travado={trava}
      />
    </div>
  )
}

/** Tipos de habilidade F3: os lembretes dos NPCs fora do `exceto` (o da vez, que os vê no painel), com o nome de cada um. */
function LembretesDosNpcs({ pedidos, mesa, turnos, exceto }: { pedidos: PedidosDaVez; mesa: Mesa; turnos: TurnosDaCena; exceto: string | null }) {
  const itens: LembreteNaTela[] = []
  for (const [personagemId, combate] of Object.entries(turnos.combate ?? {})) {
    if (personagemId === exceto || (combate.lembretes ?? []).length === 0) continue
    const personagem = mesa.personagens.find((candidato) => candidato.id === personagemId)
    const carta = turnos.cartas.find((candidata) => candidata.personagemId === personagemId)
    if (personagem === undefined || carta === undefined) continue
    // Conserto das fichas F1 (S4): o Sangramento do jogador quem aplica é o mestre (o jogador só vê o aviso).
    if (personagem.tipo !== 'npc') {
      for (const lembrete of combate.lembretes ?? []) {
        const daRegra = lembreteDaRegraNaTela(lembrete, nomeDaFicha(mesa, lembrete.tokenId), turnos.selos)
        if (daRegra?.regra === 'sangramento') itens.push(daRegra)
      }
      continue
    }
    const passivas = passivasNaCena(personagem, mesa.sistema, turnos, carta.tokenId)
    itens.push(...lembretesNaTela(combate.lembretes, passivas, alvosDaOrdem(mesa, turnos.cartas, carta), nomeDaFicha(mesa, carta.tokenId, carta), custosDasFormasNaTela(personagem, mesa.sistema)))
  }
  // R1 (lote de 01/11): a marca de atirador NPC. F2 (fatia E, resposta do Vincent): também a do jogador, que o mestre
  // pode responder por ele (quando o jogador não está); o jogador segue respondendo na tela dele.
  const marcas: MarcaNaTela[] = []
  for (const lembrete of turnos.lembretesDaMarca ?? []) {
    const personagem = mesa.personagens.find((candidato) => candidato.id === lembrete.personagemId)
    if (personagem === undefined) continue
    const item = marcaNaTela(lembrete, personagem, mesa.sistema, (tokenId) => nomeDaFicha(mesa, tokenId), bonusDaBatalha(turnos.selos, lembrete.tokenId), nomeDaFicha(mesa, lembrete.tokenId))
    if (item !== null) marcas.push(item)
  }
  if (itens.length === 0 && marcas.length === 0) return null
  return (
    <section className="bt-secao" aria-label="Lembretes das passivas dos NPCs e das marcas">
      <h3 className="bt-secao__titulo">Passivas dos NPCs e marcas</h3>
      {marcas.length > 0 && <LembretesDaMarca itens={marcas} onResponder={pedidos.marcar} className="bt-lembretes--npc" />}
      {itens.length > 0 && <LembretesDaPassiva itens={itens} sistema={mesa.sistema} aplicarLivre onPedir={pedidos.passiva} className="bt-lembretes--npc" />}
    </section>
  )
}

/** O painel da vez e as reações pendentes, no alto da aba Batalha. */
export function BatalhaDoMestre({ sceneKey, onDialogo }: { sceneKey: string; onDialogo: (dialogo: DialogoDoMestre) => void }) {
  const mesa = useMesa(sceneKey)
  const pedidos = usePedidosDoMestre(sceneKey)
  const { cena, personagens, sistema, equipes } = mesa
  const mirando = useMiraDoMestre((state) => state.mirando)
  const alvoDoMapa = useMiraDoMestre((state) => state.alvo)
  const turnos = cena?.turnos
  const carta = turnos === undefined ? null : cartaDaVez(turnos)
  const chave = carta === null || turnos === undefined ? null : `${carta.id}:${turnos.rodada}`
  // Conserto das fichas F1 (bug 7): a vez mostrada e o clique que só vale com a vez já assentada (o duplo clique não pula ninguém).
  const passarAVez = usePassarVezDoMestre(sceneKey, turnos)

  // A mira no mapa desliga quando a vez anda ou a página sai.
  useEffect(() => {
    useMiraDoMestre.getState().mirar(false)
  }, [chave])
  useEffect(() => () => useMiraDoMestre.getState().mirar(false), [])

  const pendentes = useMemo<PendenteNaTela[]>(() => {
    if (turnos === undefined) return []
    const itens: PendenteNaTela[] = []
    for (const golpe of turnos.golpes ?? []) {
      for (const alvo of golpe.alvos) {
        if (alvo.danoFinal !== undefined || !alvo.podeReagir) continue
        const item: PendenteNaTela = {
          golpeId: golpe.id,
          tokenId: alvo.tokenId,
          alvo: nomeDaFicha(mesa, alvo.tokenId),
          atacante: nomeDaFicha(mesa, golpe.atacanteTokenId),
          nome: golpe.nome,
          dano: alvo.dano,
          perfurante: golpe.perfurante,
          doMestre: ehDoMestre(alvo.personagemId, personagens),
        }
        if (golpe.perfuracao !== undefined) item.perfuracao = golpe.perfuracao
        if (golpe.overload) item.overload = true
        if (golpe.surpresa) item.surpresa = true
        // Tipos de habilidade F2: o "+3 na reação" dos selos de quem reage começa no modificador (NPC e "Rolar por Lia").
        const bonus = bonusDaBatalha(turnos.selos, alvo.tokenId)
        const partes = partesDoBonus(bonus, ALVO_DA_REACAO)
        if (partes.length > 0) item.bonus = { total: bonusDaReacao(bonus), partes }
        // F2 (fatia A): Aéreo tira a Esquiva e o Contra-ataque dos botões.
        // F2 (fatia E, Orgulho dos Ogros): o ogro (menos a Ryoko) só Defende ou Recebe.
        const deQuemReage = alvo.personagemId === null ? undefined : personagens.find((candidato) => candidato.id === alvo.personagemId)
        const daRaca = deQuemReage === undefined ? [] : saidasTiradasDoDono(chavesDoDono(deQuemReage))
        const semSaidas = [...new Set([...saidasTiradas(selosDoToken(turnos.selos, alvo.tokenId)), ...daRaca])]
        if (semSaidas.length > 0) item.semSaidas = semSaidas
        if (alvo.rolagem !== undefined) item.rolagem = alvo.rolagem
        // Tipos de habilidade F1: o NPC reage também com técnica (a caixa do mestre, por NPC).
        const doNpc = item.doMestre && alvo.personagemId !== null ? personagens.find((candidato) => candidato.id === alvo.personagemId) : undefined
        if (doNpc !== undefined && sistema !== null) item.tecnicas = reacoesParaOAlvo(alvo, doNpc, sistema, turnos.combate?.[doNpc.id], golpe.overload, golpe.surpresa)
        // F2 (revisão da fatia E, Recuperação de forças): na ficha de jogador, a técnica que só o mestre usa (ele confirma na mesa).
        const doJogador = !item.doMestre && alvo.personagemId !== null ? personagens.find((candidato) => candidato.id === alvo.personagemId) : undefined
        const soDoMestre = doJogador === undefined || sistema === null ? [] : reacoesParaOAlvo(alvo, doJogador, sistema, turnos.combate?.[doJogador.id], golpe.overload, golpe.surpresa).filter((reacao) => soOMestreReage(reacao.cartao.id) !== null)
        if (soDoMestre.length > 0) item.tecnicas = soDoMestre
        // Conserto das fichas F1 (S4): Resiliente e Determinação de quem reage, no aviso da caixa.
        const doAlvo = alvo.personagemId === null ? undefined : personagens.find((candidato) => candidato.id === alvo.personagemId)
        const reducao = doAlvo === undefined || sistema === null ? '' : avisoDasReducoes(reducoesDoDano(doAlvo, sistema))
        if (reducao !== '') item.reducao = reducao
        // F2 (fatia B, o "perto" do Aplauso): quem pode rebater no lugar dele. Ficha de jogador: a pergunta vai a ele (o mestre vê o nome); NPC: na caixa do mestre.
        const dePerto = (alvo.porPerto ?? []).flatMap((tokenId) => {
          const personagemId = turnos.cartas.find((carta) => carta.tokenId === tokenId)?.personagemId ?? null
          const personagem = personagemId === null ? undefined : personagens.find((candidato) => candidato.id === personagemId)
          return personagem === undefined ? [] : [{ tokenId, personagem }]
        })
        const deJogador = dePerto.filter(({ personagem }) => !ehDoMestre(personagem.id, personagens))
        if (deJogador.length > 0) item.quemRebate = deJogador.map(({ tokenId }) => nomeDaFicha(mesa, tokenId)).join(', ')
        itens.push(item)
        for (const { tokenId, personagem } of dePerto) {
          if (sistema === null || !ehDoMestre(personagem.id, personagens)) continue
          const tecnicas = reacoesPorPerto(alvo, personagem, sistema, turnos.combate?.[personagem.id])
          itens.push({ golpeId: golpe.id, tokenId: alvo.tokenId, alvo: item.alvo, atacante: item.atacante, nome: golpe.nome, dano: alvo.dano, perfurante: golpe.perfurante, overload: true, doMestre: true, por: { tokenId, nome: nomeDaFicha(mesa, tokenId) }, tecnicas })
        }
      }
    }
    return itens
    // `mesa` muda junto com as fichas e os personagens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnos, mesa.fichas, personagens, sistema])

  // Invocação F3: as pendências que esperam o mestre pôr no mapa ("Ryoko invocou 1 Lobo").
  const pendenciasDeInvocacao = useMemo<PendenciaNaTela[]>(
    () => (turnos === undefined ? [] : pendenciasDeInvocacaoNaTela(mesa, turnos)),
    // `mesa` muda junto com as fichas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [turnos, mesa.fichas],
  )

  if (cena === undefined || turnos === undefined) return null

  // Construtor C6: as formas em que o mestre decide os números ficam no alto, junto das invocações (e a janela abre sozinha).
  const invocacoes = (
    <>
      <FormasPendentes
        itens={turnos.formasPendentes ?? SEM_FORMAS_PENDENTES}
        personagens={mesa.personagens}
        sistema={mesa.sistema}
        turnos={turnos}
        registro={cena.registro}
        nomeDoToken={(tokenId) => nomeDaFicha(mesa, tokenId)}
        onDecidir={pedidos.decidirForma}
        onRecusar={pedidos.cancelarForma}
      />
      <InvocacoesPendentes sceneKey={sceneKey} itens={pendenciasDeInvocacao} onCancelar={pedidos.cancelarInvocacao} />
    </>
  )
  const reacoes = <ReacoesPendentes itens={pendentes} onPedir={pedidos.reagir} onTrocarPerfurante={pedidos.trocarPerfurante} />
  if (carta === null)
    return (
      <>
        {invocacoes}
        <LembretesDosNpcs pedidos={pedidos} mesa={mesa} turnos={turnos} exceto={null} />
        {reacoes}
      </>
    )

  const vez = { cartaId: carta.id, rodada: turnos.rodada }
  const encerrar = passarAVez

  // Invocação F3: a vez do bando. Os invocados são do mestre; cada um ataca e anda o dele.
  if (carta.bando !== undefined) {
    const doBando = vezDoBandoNaTela(mesa, turnos, carta, carta.bando.donoTokenId)
    return (
      <>
        {invocacoes}
        <section className="bt-secao" aria-label={`Vez de ${doBando.nome}`}>
          <PainelDoBando
            key={chave}
            nome={doBando.nome}
            cor={doBando.cor}
            membros={doBando.membros}
            onAgir={(tokenId, pedido) => pedidos.agirComInvocado(vez, tokenId, pedido)}
            onEncerrar={encerrar}
            onDarDano={() => onDialogo({ tipo: 'dano', tokenId: null })}
            consulta={consultaDoMestre}
            alvoDoMapa={alvoDoMapa}
            mapa={{ ligado: mirando, onTrocar: (ligado) => useMiraDoMestre.getState().mirar(ligado) }}
          />
        </section>
        <LembretesDosNpcs pedidos={pedidos} mesa={mesa} turnos={turnos} exceto={null} />
        {reacoes}
      </>
    )
  }

  const personagem = carta.personagemId === null ? null : (personagens.find((candidato) => candidato.id === carta.personagemId) ?? null)
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: cena.regras })
  const nome = nomeDaFicha(mesa, carta.tokenId, carta)
  const doMestre = ehDoMestre(carta.personagemId, personagens)
  const combate = carta.personagemId === null ? undefined : turnos.combate?.[carta.personagemId]
  const carga = combate?.carga ?? 0
  const { personagemId } = carta
  const zerarCarga = personagemId === null || carga === 0 ? undefined : () => pedidos.zerarCarga(personagemId)

  if (!doMestre) {
    return (
      <>
        {invocacoes}
        <section className="bt-secao" aria-label="A vez">
          <h3 className="bt-secao__titulo">Vez de {nome}</h3>
          <p className="bt-npc__perfil">{economiaEmTexto(acoes)}</p>
          <div className="bt-pendente__acoes">
            <button type="button" className="bt-botao" onClick={() => onDialogo({ tipo: 'extras', cartaId: carta.id })}>
              Ações extras
            </button>
            <button type="button" className="bt-botao" onClick={() => onDialogo({ tipo: 'dano', tokenId: null })}>
              Dar dano
            </button>
            {zerarCarga !== undefined && (
              <button type="button" className="bt-botao" title="Volta a 0; a ação gasta não volta" onClick={zerarCarga}>
                Zerar concentração ({carga})
              </button>
            )}
          </div>
          <SelosDaVez turnos={turnos} tokenId={carta.tokenId} nome={nome} sistema={sistema} onDialogo={onDialogo} />
        </section>
        <LembretesDosNpcs pedidos={pedidos} mesa={mesa} turnos={turnos} exceto={null} />
        {reacoes}
      </>
    )
  }

  const { trava, habilidades, armas, formas } = golpesDaVezDoNpc(mesa, turnos, carta, personagem, acoes)
  const caidos = tokensCaidos(turnos.cartas, personagens, sistema)
  const sugestao = personagem === null ? null : sugestaoParaNpc(personagem, cena, { personagens, sistema, equipes, caidos })
  const equipe = carta.personagemId === null ? null : equipeDe(carta.personagemId, equipes)
  const agir = (pedido: PedidoDeAcao) => pedidos.agir(vez, pedido)
  // F3: a imagem da forma ligada vence a foto.
  const aparencia = carta.personagemId === null || personagem === null ? null : aparenciaDaForma(turnos.formas?.[carta.personagemId], personagem)
  // Tipos de habilidade F3: as passivas do NPC da vez e os lembretes dele (o mestre aplica o "a cada turno" quando quiser).
  const alvos = alvosDaOrdem(mesa, turnos.cartas, carta)
  const passivas = passivasNaCena(personagem, sistema, turnos, carta.tokenId)
  const lembretes = lembretesNaTela(combate?.lembretes, passivas, alvos, undefined, custosDasFormasNaTela(personagem, sistema))

  return (
    <>
      {invocacoes}
      <section className="bt-secao" aria-label={`Vez de ${nome}`}>
        <PainelDaVezDoNpc
          key={chave}
          nome={nome}
          imagem={aparencia ?? mesa.fichas.find((ficha) => ficha.id === carta.tokenId)?.imageData ?? personagem?.retrato ?? null}
          formas={formas}
          personagemId={carta.personagemId}
          acoesNoCentro
          selos={<SelosDaVez turnos={turnos} tokenId={carta.tokenId} nome={nome} sistema={sistema} onDialogo={onDialogo} />}
          lembretes={lembretes.length === 0 ? undefined : <LembretesDaPassiva itens={lembretes} sistema={sistema} aplicarLivre onPedir={pedidos.passiva} className="bt-lembretes--npc" />}
          passivas={passivas.length === 0 ? undefined : <PassivasDaFicha passivas={passivas} tokenId={carta.tokenId} alvos={alvos} sistema={sistema} aplicarLivre onPedir={pedidos.passiva} />}
          cor={equipe?.cor ?? null}
          descricao={[personagem === null ? 'Sem ficha ligada' : 'NPC', equipe?.nome].filter(Boolean).join(' · ')}
          recursos={personagem === null ? [] : recursosDaCarta(personagem, sistema)}
          acoes={acoes}
          carga={carga}
          motivoDoConcentrar={trava ?? motivoDoConcentrar(combate, acoes, chaveDaVez(turnos.rodada, carta.id))}
          armas={armas}
          habilidades={habilidades}
          alvos={alvos}
          sugestao={sugestaoNaTela(sugestao)}
          onExecutar={agir}
          onConcentrar={() => agir({ tipo: 'concentrar' })}
          onZerarCarga={zerarCarga}
          onEncerrar={encerrar}
          onAcoesExtras={() => onDialogo({ tipo: 'extras', cartaId: carta.id })}
          onDarDano={() => onDialogo({ tipo: 'dano', tokenId: null })}
          consulta={consultaDoMestre}
          alvoDoMapa={alvoDoMapa}
          mapa={{ ligado: mirando, onTrocar: (ligado) => useMiraDoMestre.getState().mirar(ligado) }}
          evoluir={{
            // Tipos de habilidade F4: o mestre evolui sempre (fora da vez também); a regra é a da store.
            motivo: (cartaoId, custo) => motivoDoEvoluir({ personagem, sistema, turnos, soNaVez: false }, { tipo: 'evoluir', tokenId: carta.tokenId, cartaoId, custo }),
            onEvoluir: (cartaoId, custo) => pedidos.evoluir({ tipo: 'evoluir', tokenId: carta.tokenId, cartaoId, custo }),
          }}
          invocacao={personagem === null || pedidos.invocar === undefined ? undefined : invocarDoNpc(pedidos.invocar, personagem, sistema, turnos, carta, acoes)}
        />
      </section>
      <LembretesDosNpcs pedidos={pedidos} mesa={mesa} turnos={turnos} exceto={carta.personagemId} />
      {reacoes}
    </>
  )
}

/**
 * S5: os efeitos da cena sobre o mapa do mestre (`App.tsx`, dentro do
 * invólucro do canvas). Lê `efeitosDaCena`; o tremor fica com quem monta. A
 * troca de vez toca a faixa "Vez de Vera" (o mestre nunca vê SUA VEZ).
 */
export function EfeitosDoMestre({ sceneKey, onTremor }: { sceneKey: string; onTremor: () => void }) {
  const efeitos = useBatalhaStore((state) => efeitosDaCena(state, sceneKey))
  const turnos = useBatalhaStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey]?.turnos : undefined))
  const fichas = useMapStore((state) => state.map.tokens)
  const personagens = useAdventureStore(personagensAtivos)
  const nomeDe = useMemo(() => {
    const porToken = new Map(fichas.map((ficha) => [ficha.id, ficha.name.trim()] as const))
    return (tokenId: string) => porToken.get(tokenId) || 'Ficha'
  }, [fichas])
  // F3: a imagem da forma ligada vence a foto no corte do golpe.
  const formas = turnos?.formas
  const cartas = turnos?.cartas
  const imagemDe = useMemo(() => {
    const porToken = new Map<string, string | null>(fichas.map((ficha) => [ficha.id, ficha.imageData ?? null] as const))
    for (const carta of cartas ?? []) {
      if (carta.personagemId === null) continue
      const personagem = personagens.find((candidato) => candidato.id === carta.personagemId)
      const forma = formas?.[carta.personagemId]
      const aparencia = forma === undefined ? null : aparenciaDaForma(forma, personagem)
      if (aparencia !== null) porToken.set(carta.tokenId, aparencia)
      // C8 (lote de 01/11): token sem foto usa o retrato da ficha no corte e na faixa, como a carta da ordem.
      else if (!porToken.get(carta.tokenId) && personagem?.retrato) porToken.set(carta.tokenId, personagem.retrato)
    }
    return (tokenId: string) => porToken.get(tokenId) ?? null
  }, [fichas, cartas, formas, personagens])
  // D4: a vida de cada ficha (o mestre vê todas), para o impacto do tamanho do golpe e a queda.
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const vidaDe = useMemo(() => {
    const vidas = vidasDaCena(fichas, personagens, sistemaPorId(biblioteca, sistemaId) ?? null)
    return (tokenId: string) => vidas.get(tokenId) ?? null
  }, [fichas, personagens, biblioteca, sistemaId])
  const carta = turnos === undefined ? null : cartaDaVez(turnos)
  const vez =
    carta === null || turnos === undefined
      ? null
      : {
          chave: `${carta.id}:${turnos.rodada}`,
          nome: fichas.find((ficha) => ficha.id === carta.tokenId)?.name.trim() || carta.nome?.trim() || 'Ficha',
          minha: false,
          // D3: quem joga a vez. Os NPCs, as fichas sem personagem e o bando são do mestre (duas vezes seguidas dele tocam a
          // faixa curta). A ficha de jogador fica sem dono: qual jogador a controla só a sessão do host sabe, não esta tela.
          dono: ehDoMestre(carta.personagemId, personagens) ? 'mestre' : null,
          ...(carta.bando === undefined ? { tokenId: carta.tokenId } : {}),
        }
  // D7: `cameraSegue` fica ausente de propósito: ausente = a chave guardada neste computador (`BotaoDaCameraDaBatalha`), lida na hora.
  return <EfeitosDaBatalha efeitos={efeitos} consulta={consultaDoMestre} nomeDe={nomeDe} imagemDe={imagemDe} vez={vez} onTremor={onTremor} vidaDe={vidaDe} />
}

/** Os diálogos do mestre (menu da carta e painel da vez). */
export function DialogoDoMestreNaCena({ sceneKey, dialogo, onFechar }: { sceneKey: string; dialogo: DialogoDoMestre; onFechar: () => void }) {
  const mesa = useMesa(sceneKey)
  const pedidos = usePedidosDoMestre(sceneKey)
  const turnos = mesa.cena?.turnos
  if (turnos === undefined) return null

  if (dialogo.tipo === 'dano') {
    // A carta do bando vira os invocados dela, e a janela aberta por ela começa no primeiro (`alvosDoDarDano`, o mesmo da Arena).
    const { alvos, inicial } = alvosDoDarDano(mesa, turnos, dialogo.tokenId)
    return <DarDanoDialog alvos={alvos} alvoInicial={inicial} onConfirmar={pedidos.darDano} onFechar={onFechar} />
  }
  if (dialogo.tipo === 'selo') {
    const { tokenId, seloId } = dialogo
    const selo = seloId === null ? null : (selosDoToken(turnos.selos, tokenId).find((candidato) => candidato.id === seloId) ?? null)
    // O selo saiu (desfeito, acabou) com a janela aberta: ela fecha.
    if (seloId !== null && selo === null) return null
    return (
      <SeloDialog
        quem={nomeDaFicha(mesa, tokenId)}
        selo={selo === null ? null : { nome: selo.nome, turnos: selo.turnos, ...(selo.mods === undefined ? {} : { mods: selo.mods }) }}
        alvosDeMod={alvosDeMod(mesa.sistema)}
        corFixa={selo?.cartaoId === undefined ? undefined : (selo.natureza ?? 'condicao')}
        onConfirmar={(pedido) => (seloId === null ? pedidos.porSelo(tokenId, pedido) : pedidos.editarSelo(seloId, pedido))}
        onTirar={seloId === null ? undefined : () => pedidos.tirarSelo(seloId)}
        onFechar={onFechar}
      />
    )
  }
  if (dialogo.tipo === 'ajustar') {
    const personagem = mesa.personagens.find((candidato) => candidato.id === dialogo.personagemId)
    if (personagem === undefined || mesa.sistema === null) return null
    return (
      <AjustarDialog
        quem={nomeDaFicha(mesa, dialogo.tokenId)}
        tokenId={dialogo.tokenId}
        personagem={personagem}
        sistema={mesa.sistema}
        onConfirmar={pedidos.ajustar}
        onFechar={onFechar}
      />
    )
  }
  if (dialogo.tipo === 'extras') {
    const carta = turnos.cartas.find((candidata) => candidata.id === dialogo.cartaId)
    if (carta === undefined) return null
    return (
      <AcoesExtrasDialog
        quem={nomeDaFicha(mesa, carta.tokenId, carta)}
        inicial={turnos.extras[carta.id] ?? null}
        onConfirmar={(extras) => pedidos.darAcoesExtras(carta.id, extras)}
        onFechar={onFechar}
      />
    )
  }
  const personagem = mesa.personagens.find((candidato) => candidato.id === dialogo.personagemId)
  if (personagem === undefined) return null
  return (
    <EscolhaDeArmas
      quem={personagem.nome}
      armas={armasDe(personagem).map((arma) => ({ id: arma.id, nome: arma.nome.trim() || 'Arma sem nome', detalhe: arma.campos.dano ? `Dano ${arma.campos.dano}` : undefined }))}
      limite={limiteDeArmas(personagem)}
      escolhidas={turnos.combate?.[personagem.id]?.armas ?? null}
      onConfirmar={(armas) => pedidos.escolherArmas(personagem.id, armas)}
      onFechar={onFechar}
    />
  )
}
