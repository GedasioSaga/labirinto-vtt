import { useEffect, useMemo } from 'react'
import { motivoDoConcentrar } from '../../lib/batalha/acoes'
import { ALVO_DA_REACAO, chaveDaVez, partesDoBonus, type InvocadoNaBatalha, type PedidoDeAcao, type PedidoDePassiva } from '../../lib/batalha/combate'
import { equipeDe, type Equipe } from '../../lib/batalha/equipes'
import { motivoDoEvoluir } from '../../lib/batalha/escolhaEEvolucao'
import { acoesDaCarta, sugestaoParaNpc } from '../../lib/batalha/golpe'
import { acoesDoInvocado, comunsQueSaem, membrosDoBando, motivoDaInvocacao, quantosNoCampo } from '../../lib/batalha/invocacao'
import { armasDe, limiteDeArmas } from '../../lib/batalha/leituraDaFicha'
import { reacoesParaOAlvo } from '../../lib/batalha/reacaoComTecnica'
import { alvosDeMod, bonusDaBatalha, bonusDaReacao, selosDoToken, textoDoSelo, textoDoSeloComMods, textoDosMods } from '../../lib/batalha/selos'
import { aparenciaDaForma, formasNoMenu } from '../../lib/batalha/transformacao'
import { cartaDaVez, tokensCaidos, type CartaDaOrdem, type TurnosDaCena } from '../../lib/batalha/turnos'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../../stores/adventureStore'
import { efeitosDaCena, useBatalhaStore, type BatalhaDaCena } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { AcoesExtrasDialog } from './AcoesExtrasDialog'
import { AjustarDialog } from './AjustarDialog'
import { DarDanoDialog } from './DarDanoDialog'
import { EfeitosDaBatalha } from './EfeitosDaBatalha'
import { recursosDaCarta } from './dadosDaFaixa'
import { invocacaoDaFicha, nomeDoBando, pedidoDeInvocacao } from './dadosDaInvocacao'
import { MOTIVO_SEM_PERSONAGEM, alvosNaOrdemDaMira, armasNaBatalha, economiaEmTexto, golpesDeAtaque, golpesDeHabilidade, type AlvoNaMira } from './dadosDoMenu'
import { EscolhaDeArmas } from './EscolhaDeArmas'
import { InvocacoesPendentes, PainelDoBando, type MembroNaVez, type PendenciaNaTela } from './InvocacoesDoMestre'
import type { InvocarNoMenu } from './MenuDaVez'
import { consultaDoMestre, useMiraDoMestre } from './miraDoMestre'
import { PainelDaVezDoNpc } from './PainelDaVezDoNpc'
import { LembretesDaMarca, marcaNaTela, type MarcaNaTela } from './LembretesDaMarca'
import { LembretesDaPassiva, PassivasDaFicha, lembretesNaTela, passivasNaCena, type LembreteNaTela } from './PassivasDaBatalha'
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
        return (
          <button
            key={selo.id}
            type="button"
            className="bt-selo bt-selo--botao"
            data-natureza={selo.natureza === 'condicao' ? undefined : selo.natureza}
            aria-label={`${textoDoSeloComMods(selo, sistema)}: editar ou tirar`}
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

interface Mesa {
  cena: BatalhaDaCena | undefined
  fichas: readonly { id: string; name: string; imageData?: string | null; x?: number; y?: number }[]
  /** C4: o lado da casa (px), para a ordem dos alvos por distância. */
  tamanhoDaCasa?: number
  personagens: readonly Personagem[]
  equipes: readonly Equipe[] | undefined
  sistema: SistemaDeRpg | null
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
  return { cena, fichas, tamanhoDaCasa, personagens, equipes, sistema }
}

function nomeDaFicha(mesa: Mesa, tokenId: string, carta?: CartaDaOrdem): string {
  return mesa.fichas.find((ficha) => ficha.id === tokenId)?.name.trim() || carta?.nome?.trim() || 'Ficha'
}

/** Ficha que o mestre move: sem personagem, ou de personagem NPC. */
function ehDoMestre(personagemId: string | null, personagens: readonly Personagem[]): boolean {
  if (personagemId === null) return true
  return personagens.find((personagem) => personagem.id === personagemId)?.tipo === 'npc'
}

const SEM_INVOCADOS: readonly InvocadoNaBatalha[] = []

/** O personagem que dá a equipe: o invocado conta como o dono (a ficha temporária dele não tem equipe). */
function personagemDaEquipe(mesa: Mesa, personagemId: string | null): string | null {
  if (personagemId === null) return null
  return (mesa.cena?.turnos?.invocados ?? SEM_INVOCADOS).find((invocado) => invocado.personagemId === personagemId)?.donoPersonagemId ?? personagemId
}

/**
 * O lado de um personagem na mira do mestre: a equipe dele. Sem equipe
 * cadastrada, o lado implícito de `aliadosDe` (todo jogador é aliado de todo
 * jogador) e os NPCs do outro; sem isso, tudo era "outro" e o aliado do lobo
 * ou do NPC da vez vinha no meio dos inimigos.
 */
function ladoDoPersonagem(mesa: Mesa, personagemId: string | null): string | null {
  const daEquipe = personagemDaEquipe(mesa, personagemId)
  if (daEquipe === null) return null
  if (mesa.equipes !== undefined && mesa.equipes.length > 0) return equipeDe(daEquipe, mesa.equipes)?.id ?? null
  const tipo = mesa.personagens.find((personagem) => personagem.id === daEquipe)?.tipo
  return tipo === undefined ? null : `tipo:${tipo}`
}

/** O HP de um invocado (a ficha temporária dele); sem ficha ou sem vida, `null`. */
function vidaDoInvocado(mesa: Mesa, invocado: InvocadoNaBatalha): { atual: number; maximo: number } | null {
  const personagem = mesa.personagens.find((candidato) => candidato.id === invocado.personagemId)
  const vida = personagem === undefined ? undefined : recursosDaCarta(personagem, mesa.sistema).find((recurso) => recurso.tom === 'vida')
  return vida === undefined ? null : { atual: vida.atual, maximo: vida.maximo }
}

/** Os alvos da mira do mestre: uma por ficha na ordem, do ponto de vista de quem age. A carta do bando vira os invocados dela. */
function alvosDaOrdem(mesa: Mesa, cartas: readonly CartaDaOrdem[], quemAge: CartaDaOrdem): AlvoNaMira[] {
  const caidos = tokensCaidos(cartas, mesa.personagens, mesa.sistema)
  const ladoDeQuem = ladoDoPersonagem(mesa, quemAge.personagemId)
  const invocados = mesa.cena?.turnos?.invocados ?? SEM_INVOCADOS
  const vistos = new Set<string>()
  const alvos: AlvoNaMira[] = []
  for (const carta of cartas) {
    if (carta.bando !== undefined) {
      // Invocação: o invocado não tem carta; é alvo como qualquer ficha, da equipe do dono.
      for (const invocado of membrosDoBando({ invocados }, carta)) {
        if (vistos.has(invocado.tokenId)) continue
        vistos.add(invocado.tokenId)
        const equipeDoDono = equipeDe(invocado.donoPersonagemId, mesa.equipes)
        const vida = vidaDoInvocado(mesa, invocado)
        const ficha = mesa.fichas.find((candidata) => candidata.id === invocado.tokenId)
        alvos.push({
          tokenId: invocado.tokenId,
          nome: ficha?.name.trim() || invocado.nome,
          lado: invocado.tokenId === quemAge.tokenId ? 'eu' : ladoDeQuem !== null && ladoDoPersonagem(mesa, invocado.donoPersonagemId) === ladoDeQuem ? 'aliado' : 'outro',
          caiu: vida !== null && vida.atual <= 0,
          motivo: null,
          imagem: ficha?.imageData ?? null,
          cor: equipeDoDono?.cor ?? null,
        })
      }
      continue
    }
    if (vistos.has(carta.tokenId)) continue
    vistos.add(carta.tokenId)
    const equipeDaCarta = carta.personagemId === null ? null : (equipeDe(carta.personagemId, mesa.equipes) ?? null)
    const personagem = carta.personagemId === null ? undefined : mesa.personagens.find((candidato) => candidato.id === carta.personagemId)
    const forma = carta.personagemId === null ? undefined : mesa.cena?.turnos?.formas?.[carta.personagemId]
    alvos.push({
      tokenId: carta.tokenId,
      nome: nomeDaFicha(mesa, carta.tokenId, carta),
      lado: carta.tokenId === quemAge.tokenId ? 'eu' : ladoDeQuem !== null && ladoDoPersonagem(mesa, carta.personagemId) === ladoDeQuem ? 'aliado' : 'outro',
      caiu: caidos.has(carta.tokenId),
      motivo: carta.personagemId === null ? MOTIVO_SEM_PERSONAGEM : null,
      // A mesma imagem da carta na faixa (`faixaDoMestre`): a forma vence a foto do token, que vence o retrato.
      imagem: aparenciaDaForma(forma, personagem) ?? mesa.fichas.find((ficha) => ficha.id === carta.tokenId)?.imageData ?? personagem?.retrato ?? null,
      cor: equipeDaCarta?.cor ?? null,
    })
  }
  return alvosNaOrdemDaMira(alvos, mesa.fichas, quemAge.tokenId, mesa.tamanhoDaCasa)
}

/** Tipos de habilidade F3: a passiva pedida pelo mestre (qualquer ficha, a qualquer hora). */
function pedirPassiva(sceneKey: string) {
  return (pedido: PedidoDePassiva) => useBatalhaStore.getState().passiva(sceneKey, MESTRE, pedido)
}

/**
 * Invocação F3: um invocado na vez do bando, com a economia dele e os golpes
 * da ficha temporária (o "Golpe" com o dano dele; sem técnica, o Atacar).
 */
function membroNaVez(mesa: Mesa, turnos: TurnosDaCena, bando: CartaDaOrdem, invocado: InvocadoNaBatalha): MembroNaVez {
  const personagem = mesa.personagens.find((candidato) => candidato.id === invocado.personagemId) ?? null
  const acoes = acoesDoInvocado(turnos, bando.id, invocado)
  const combate = turnos.combate?.[invocado.personagemId]
  const bonus = bonusDaBatalha(turnos.selos, invocado.tokenId)
  const habilidades = personagem !== null && mesa.sistema !== null ? golpesDeHabilidade(personagem, mesa.sistema, combate, acoes, null, bonus) : []
  const ficha = mesa.fichas.find((candidata) => candidata.id === invocado.tokenId)
  const quemAge: CartaDaOrdem = { id: bando.id, tokenId: invocado.tokenId, personagemId: invocado.personagemId, nome: invocado.nome }
  return {
    tokenId: invocado.tokenId,
    nome: ficha?.name.trim() || invocado.nome,
    imagem: ficha?.imageData ?? null,
    vida: vidaDoInvocado(mesa, invocado),
    acoes,
    golpes: habilidades.length > 0 ? habilidades : golpesDeAtaque(personagem, mesa.sistema, combate, acoes, bonus),
    alvos: alvosDaOrdem(mesa, turnos.cartas, quemAge),
  }
}

/** Invocação F3: o Invocar do NPC da vez, com a regra da store (`motivoDaInvocacao`). */
function invocarDoNpc(sceneKey: string, personagem: Personagem, sistema: SistemaDeRpg | null, turnos: TurnosDaCena, carta: CartaDaOrdem, acoes: ReturnType<typeof acoesDaCarta>): InvocarNoMenu {
  return {
    leitura: (cartaoId) => {
      const lida = invocacaoDaFicha(personagem, sistema, cartaoId)
      return lida === null ? null : { opcoes: lida.opcoes, imagem: lida.imagem }
    },
    contar: (cartaoId, opcao) => quantosNoCampo(turnos, personagem.id, cartaoId, opcao.chave),
    motivo: (cartaoId) => (opcao, custo, acao) => motivoDaInvocacao({ personagem, sistema, turnos, acoes }, pedidoDeInvocacao(carta.tokenId, cartaoId, opcao.chave, custo, acao)),
    onInvocar: (cartaoId, opcao, custo, acao) => useBatalhaStore.getState().invocar(sceneKey, MESTRE, pedidoDeInvocacao(carta.tokenId, cartaoId, opcao, custo, acao)),
    esperando: [],
  }
}

/** Tipos de habilidade F3: os lembretes dos NPCs fora do `exceto` (o da vez, que os vê no painel), com o nome de cada um. */
function LembretesDosNpcs({ sceneKey, mesa, turnos, exceto }: { sceneKey: string; mesa: Mesa; turnos: TurnosDaCena; exceto: string | null }) {
  const itens: LembreteNaTela[] = []
  for (const [personagemId, combate] of Object.entries(turnos.combate ?? {})) {
    if (personagemId === exceto || (combate.lembretes ?? []).length === 0) continue
    const personagem = mesa.personagens.find((candidato) => candidato.id === personagemId)
    const carta = turnos.cartas.find((candidata) => candidata.personagemId === personagemId)
    if (personagem?.tipo !== 'npc' || carta === undefined) continue
    const passivas = passivasNaCena(personagem, mesa.sistema, turnos, carta.tokenId)
    itens.push(...lembretesNaTela(combate.lembretes, passivas, alvosDaOrdem(mesa, turnos.cartas, carta), nomeDaFicha(mesa, carta.tokenId, carta)))
  }
  // R1 (lote de 01/11): a marca de atirador NPC (a do jogador, ele responde na tela dele).
  const marcas: MarcaNaTela[] = []
  for (const lembrete of turnos.lembretesDaMarca ?? []) {
    const personagem = mesa.personagens.find((candidato) => candidato.id === lembrete.personagemId)
    if (personagem?.tipo !== 'npc') continue
    const item = marcaNaTela(lembrete, personagem, mesa.sistema, (tokenId) => nomeDaFicha(mesa, tokenId), bonusDaBatalha(turnos.selos, lembrete.tokenId), nomeDaFicha(mesa, lembrete.tokenId))
    if (item !== null) marcas.push(item)
  }
  if (itens.length === 0 && marcas.length === 0) return null
  return (
    <section className="bt-secao" aria-label="Lembretes das passivas dos NPCs">
      <h3 className="bt-secao__titulo">Passivas dos NPCs</h3>
      {marcas.length > 0 && <LembretesDaMarca itens={marcas} onResponder={(pedido) => useBatalhaStore.getState().marcar(sceneKey, MESTRE, pedido)} className="bt-lembretes--npc" />}
      {itens.length > 0 && <LembretesDaPassiva itens={itens} sistema={mesa.sistema} aplicarLivre onPedir={pedirPassiva(sceneKey)} className="bt-lembretes--npc" />}
    </section>
  )
}

/** O painel da vez e as reações pendentes, no alto da aba Batalha. */
export function BatalhaDoMestre({ sceneKey, onDialogo }: { sceneKey: string; onDialogo: (dialogo: DialogoDoMestre) => void }) {
  const mesa = useMesa(sceneKey)
  const { cena, personagens, sistema, equipes } = mesa
  const mirando = useMiraDoMestre((state) => state.mirando)
  const alvoDoMapa = useMiraDoMestre((state) => state.alvo)
  const turnos = cena?.turnos
  const carta = turnos === undefined ? null : cartaDaVez(turnos)
  const chave = carta === null || turnos === undefined ? null : `${carta.id}:${turnos.rodada}`

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
        // Tipos de habilidade F2: o "+3 na reação" dos selos de quem reage começa no modificador (NPC e "Rolar por Lia").
        const bonus = bonusDaBatalha(turnos.selos, alvo.tokenId)
        const partes = partesDoBonus(bonus, ALVO_DA_REACAO)
        if (partes.length > 0) item.bonus = { total: bonusDaReacao(bonus), partes }
        if (alvo.rolagem !== undefined) item.rolagem = alvo.rolagem
        // Tipos de habilidade F1: o NPC reage também com técnica (a caixa do mestre, por NPC).
        const doNpc = item.doMestre && alvo.personagemId !== null ? personagens.find((candidato) => candidato.id === alvo.personagemId) : undefined
        if (doNpc !== undefined && sistema !== null) item.tecnicas = reacoesParaOAlvo(alvo, doNpc, sistema, turnos.combate?.[doNpc.id])
        itens.push(item)
      }
    }
    return itens
    // `mesa` muda junto com as fichas e os personagens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnos, mesa.fichas, personagens, sistema])

  // Invocação F3: as pendências que esperam o mestre pôr no mapa ("Ryoko invocou 1 Lobo").
  const pendenciasDeInvocacao = useMemo<PendenciaNaTela[]>(() => {
    if (turnos === undefined) return []
    return (turnos.invocacoes ?? []).map((pendente) => {
      const saem = comunsQueSaem(turnos, pendente)
      return {
        id: pendente.id,
        dono: nomeDaFicha(mesa, pendente.donoTokenId),
        nome: pendente.nome,
        rotulo: pendente.rotulo,
        ultra: pendente.ultra,
        numeros: pendente.numeros,
        sugeridos: pendente.sugeridos,
        imagem: pendente.imagem,
        saem: saem.length,
        nomeDosQueSaem: saem[0]?.nome ?? null,
      }
    })
    // `mesa` muda junto com as fichas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnos, mesa.fichas])

  if (cena === undefined || turnos === undefined) return null

  const invocacoes = <InvocacoesPendentes sceneKey={sceneKey} itens={pendenciasDeInvocacao} onCancelar={(invocacaoId) => useBatalhaStore.getState().cancelarInvocacao(sceneKey, invocacaoId)} />
  const reacoes = (
    <ReacoesPendentes
      itens={pendentes}
      onPedir={(pedido) => useBatalhaStore.getState().reagir(sceneKey, MESTRE, pedido)}
      onTrocarPerfurante={(golpeId, perfurante, perfuracao) => useBatalhaStore.getState().trocarPerfurante(sceneKey, golpeId, perfurante, perfuracao)}
    />
  )
  if (carta === null)
    return (
      <>
        {invocacoes}
        <LembretesDosNpcs sceneKey={sceneKey} mesa={mesa} turnos={turnos} exceto={null} />
        {reacoes}
      </>
    )

  const vez = { cartaId: carta.id, rodada: turnos.rodada }
  const encerrar = () => useBatalhaStore.getState().passarVez(sceneKey, MESTRE, vez)

  // Invocação F3: a vez do bando. Os invocados são do mestre; cada um ataca e anda o dele.
  if (carta.bando !== undefined) {
    const { donoTokenId } = carta.bando
    const cartaDoDono = turnos.cartas.find((candidata) => candidata.tokenId === donoTokenId && candidata.bando === undefined)
    const equipeDoDono = cartaDoDono === undefined || cartaDoDono.personagemId === null ? null : equipeDe(cartaDoDono.personagemId, equipes)
    const membros = membrosDoBando(turnos, carta)
    const nomeDaCarta = nomeDoBando(membros, nomeDaFicha(mesa, donoTokenId, cartaDoDono), carta.nome ?? 'Bando')
    return (
      <>
        {invocacoes}
        <section className="bt-secao" aria-label={`Vez de ${nomeDaCarta}`}>
          <PainelDoBando
            key={chave}
            nome={nomeDaCarta}
            cor={equipeDoDono?.cor ?? null}
            membros={membros.map((invocado) => membroNaVez(mesa, turnos, carta, invocado))}
            onAgir={(tokenId, pedido) => useBatalhaStore.getState().agirComInvocado(sceneKey, vez, tokenId, pedido)}
            onEncerrar={encerrar}
            onDarDano={() => onDialogo({ tipo: 'dano', tokenId: null })}
            consulta={consultaDoMestre}
            alvoDoMapa={alvoDoMapa}
            mapa={{ ligado: mirando, onTrocar: (ligado) => useMiraDoMestre.getState().mirar(ligado) }}
          />
        </section>
        <LembretesDosNpcs sceneKey={sceneKey} mesa={mesa} turnos={turnos} exceto={null} />
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
  const zerarCarga = personagemId === null || carga === 0 ? undefined : () => useBatalhaStore.getState().zerarCarga(sceneKey, MESTRE, personagemId)

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
        <LembretesDosNpcs sceneKey={sceneKey} mesa={mesa} turnos={turnos} exceto={null} />
        {reacoes}
      </>
    )
  }

  const arma = armasNaBatalha(personagem, combate)[0] ?? null
  // Tipos de habilidade F2: os selos do NPC somam na conta (a mesma `bonusDaBatalha` do jogador e da caixa).
  const bonus = bonusDaBatalha(turnos.selos, carta.tokenId)
  const habilidades = personagem !== null && sistema !== null ? golpesDeHabilidade(personagem, sistema, combate, acoes, arma, bonus) : []
  const armas = golpesDeAtaque(personagem, sistema, combate, acoes, bonus)
  const caidos = tokensCaidos(turnos.cartas, personagens, sistema)
  const sugestao = personagem === null ? null : sugestaoParaNpc(personagem, cena, { personagens, sistema, equipes, caidos })
  const equipe = carta.personagemId === null ? null : equipeDe(carta.personagemId, equipes)
  const agir = (pedido: PedidoDeAcao) => useBatalhaStore.getState().agir(sceneKey, MESTRE, vez, pedido)
  // F3: as formas do NPC (a tira Transformação do painel) e a imagem da forma ligada, que vence a foto.
  const formas = personagem !== null && sistema !== null ? formasNoMenu(personagem, sistema, acoes, combate?.usos) : []
  const aparencia = carta.personagemId === null || personagem === null ? null : aparenciaDaForma(turnos.formas?.[carta.personagemId], personagem)
  // Tipos de habilidade F3: as passivas do NPC da vez e os lembretes dele (o mestre aplica o "a cada turno" quando quiser).
  const alvos = alvosDaOrdem(mesa, turnos.cartas, carta)
  const passivas = passivasNaCena(personagem, sistema, turnos, carta.tokenId)
  const lembretes = lembretesNaTela(combate?.lembretes, passivas, alvos)

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
          selos={<SelosDaVez turnos={turnos} tokenId={carta.tokenId} nome={nome} sistema={sistema} onDialogo={onDialogo} />}
          lembretes={lembretes.length === 0 ? undefined : <LembretesDaPassiva itens={lembretes} sistema={sistema} aplicarLivre onPedir={pedirPassiva(sceneKey)} className="bt-lembretes--npc" />}
          passivas={
            passivas.length === 0 ? undefined : <PassivasDaFicha passivas={passivas} tokenId={carta.tokenId} alvos={alvos} sistema={sistema} aplicarLivre onPedir={pedirPassiva(sceneKey)} />
          }
          cor={equipe?.cor ?? null}
          descricao={[personagem === null ? 'Sem ficha ligada' : 'NPC', equipe?.nome].filter(Boolean).join(' · ')}
          recursos={personagem === null ? [] : recursosDaCarta(personagem, sistema)}
          acoes={acoes}
          carga={carga}
          motivoDoConcentrar={motivoDoConcentrar(combate, acoes, chaveDaVez(turnos.rodada, carta.id))}
          armas={armas}
          habilidades={habilidades}
          alvos={alvos}
          sugestao={{
            chave: sugestao === null ? null : sugestao.cartaoId !== null ? `tecnica:${sugestao.cartaoId}` : sugestao.armaId !== null ? `arma:${sugestao.armaId}` : null,
            alvoTokenId: sugestao?.alvoTokenId ?? null,
          }}
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
            onEvoluir: (cartaoId, custo) => useBatalhaStore.getState().evoluir(sceneKey, MESTRE, { tipo: 'evoluir', tokenId: carta.tokenId, cartaoId, custo }),
          }}
          invocacao={personagem === null ? undefined : invocarDoNpc(sceneKey, personagem, sistema, turnos, carta, acoes)}
        />
      </section>
      <LembretesDosNpcs sceneKey={sceneKey} mesa={mesa} turnos={turnos} exceto={carta.personagemId} />
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
  const carta = turnos === undefined ? null : cartaDaVez(turnos)
  const vez =
    carta === null || turnos === undefined
      ? null
      : { chave: `${carta.id}:${turnos.rodada}`, nome: fichas.find((ficha) => ficha.id === carta.tokenId)?.name.trim() || carta.nome?.trim() || 'Ficha', minha: false, ...(carta.bando === undefined ? { tokenId: carta.tokenId } : {}) }
  return <EfeitosDaBatalha efeitos={efeitos} consulta={consultaDoMestre} nomeDe={nomeDe} imagemDe={imagemDe} vez={vez} onTremor={onTremor} />
}

/** Os diálogos do mestre (menu da carta e painel da vez). */
export function DialogoDoMestreNaCena({ sceneKey, dialogo, onFechar }: { sceneKey: string; dialogo: DialogoDoMestre; onFechar: () => void }) {
  const mesa = useMesa(sceneKey)
  const turnos = mesa.cena?.turnos
  if (turnos === undefined) return null
  const store = useBatalhaStore.getState()

  if (dialogo.tipo === 'dano') {
    const vistos = new Set<string>()
    const invocados = turnos.invocados ?? SEM_INVOCADOS
    // A carta do bando não é ficha (a store recusa): o dano vai em cada invocado dele, pelo nome do token.
    const doBando = (carta: CartaDaOrdem) => membrosDoBando({ invocados }, carta).map((invocado) => ({ tokenId: invocado.tokenId, nome: mesa.fichas.find((ficha) => ficha.id === invocado.tokenId)?.name.trim() || invocado.nome }))
    const alvos = turnos.cartas
      .flatMap((carta) => (carta.bando === undefined ? [{ tokenId: carta.tokenId, nome: nomeDaFicha(mesa, carta.tokenId, carta) }] : doBando(carta)))
      .filter((alvo) => !vistos.has(alvo.tokenId) && vistos.add(alvo.tokenId))
    // Aberto pela carta do bando: começa no primeiro invocado dele.
    const cartaDoBando = turnos.cartas.find((carta) => carta.bando !== undefined && carta.tokenId === dialogo.tokenId)
    const inicial = cartaDoBando === undefined ? dialogo.tokenId : (doBando(cartaDoBando)[0]?.tokenId ?? null)
    return <DarDanoDialog alvos={alvos} alvoInicial={inicial} onConfirmar={(tokenId, valor) => store.darDano(sceneKey, MESTRE, tokenId, valor)} onFechar={onFechar} />
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
        onConfirmar={(pedido) => (seloId === null ? store.porSelo(sceneKey, tokenId, pedido) : store.editarSelo(sceneKey, seloId, pedido))}
        onTirar={seloId === null ? undefined : () => store.tirarSelo(sceneKey, seloId)}
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
        onConfirmar={(pedido) => store.ajustar(sceneKey, MESTRE, pedido)}
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
        onConfirmar={(extras) => store.darAcoesExtras(sceneKey, carta.id, extras)}
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
      onConfirmar={(armas) => store.escolherArmas(sceneKey, MESTRE, personagem.id, armas)}
      onFechar={onFechar}
    />
  )
}
