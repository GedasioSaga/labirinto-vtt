import { useEffect, useMemo } from 'react'
import { motivoDoConcentrar } from '../../lib/batalha/acoes'
import { ALVO_DA_REACAO, chaveDaVez, partesDoBonus, type PedidoDeAcao, type PedidoDePassiva } from '../../lib/batalha/combate'
import { equipeDe, type Equipe } from '../../lib/batalha/equipes'
import { acoesDaCarta, sugestaoParaNpc } from '../../lib/batalha/golpe'
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
import { DarDanoDialog } from './DarDanoDialog'
import { EfeitosDaBatalha } from './EfeitosDaBatalha'
import { recursosDaCarta } from './dadosDaFaixa'
import { MOTIVO_SEM_PERSONAGEM, armasNaBatalha, economiaEmTexto, golpesDeAtaque, golpesDeHabilidade, type AlvoNaMira } from './dadosDoMenu'
import { EscolhaDeArmas } from './EscolhaDeArmas'
import { consultaDoMestre, useMiraDoMestre } from './miraDoMestre'
import { PainelDaVezDoNpc } from './PainelDaVezDoNpc'
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
  fichas: readonly { id: string; name: string; imageData?: string | null }[]
  personagens: readonly Personagem[]
  equipes: readonly Equipe[] | undefined
  sistema: SistemaDeRpg | null
}

function useMesa(sceneKey: string): Mesa {
  const cena = useBatalhaStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined))
  const fichas = useMapStore((state) => state.map.tokens)
  const personagens = useAdventureStore(personagensAtivos)
  const equipes = useAdventureStore(equipesAtivas)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const sistema = useMemo(() => sistemaPorId(biblioteca, sistemaId) ?? null, [biblioteca, sistemaId])
  return { cena, fichas, personagens, equipes, sistema }
}

function nomeDaFicha(mesa: Mesa, tokenId: string, carta?: CartaDaOrdem): string {
  return mesa.fichas.find((ficha) => ficha.id === tokenId)?.name.trim() || carta?.nome?.trim() || 'Ficha'
}

/** Ficha que o mestre move: sem personagem, ou de personagem NPC. */
function ehDoMestre(personagemId: string | null, personagens: readonly Personagem[]): boolean {
  if (personagemId === null) return true
  return personagens.find((personagem) => personagem.id === personagemId)?.tipo === 'npc'
}

/** Os alvos da mira do mestre: uma por ficha na ordem, do ponto de vista de quem age. */
function alvosDaOrdem(mesa: Mesa, cartas: readonly CartaDaOrdem[], quemAge: CartaDaOrdem): AlvoNaMira[] {
  const caidos = tokensCaidos(cartas, mesa.personagens, mesa.sistema)
  const equipeDeQuem = quemAge.personagemId === null ? null : (equipeDe(quemAge.personagemId, mesa.equipes)?.id ?? null)
  const vistos = new Set<string>()
  const alvos: AlvoNaMira[] = []
  for (const carta of cartas) {
    if (vistos.has(carta.tokenId)) continue
    vistos.add(carta.tokenId)
    const equipeDaCarta = carta.personagemId === null ? null : (equipeDe(carta.personagemId, mesa.equipes) ?? null)
    const equipe = equipeDaCarta?.id ?? null
    const personagem = carta.personagemId === null ? undefined : mesa.personagens.find((candidato) => candidato.id === carta.personagemId)
    const forma = carta.personagemId === null ? undefined : mesa.cena?.turnos?.formas?.[carta.personagemId]
    alvos.push({
      tokenId: carta.tokenId,
      nome: nomeDaFicha(mesa, carta.tokenId, carta),
      lado: carta.tokenId === quemAge.tokenId ? 'eu' : equipe !== null && equipe === equipeDeQuem ? 'aliado' : 'outro',
      caiu: caidos.has(carta.tokenId),
      motivo: carta.personagemId === null ? MOTIVO_SEM_PERSONAGEM : null,
      // A mesma imagem da carta na faixa (`faixaDoMestre`): a forma vence a foto do token, que vence o retrato.
      imagem: aparenciaDaForma(forma, personagem) ?? mesa.fichas.find((ficha) => ficha.id === carta.tokenId)?.imageData ?? personagem?.retrato ?? null,
      cor: equipeDaCarta?.cor ?? null,
    })
  }
  return alvos
}

/** Tipos de habilidade F3: a passiva pedida pelo mestre (qualquer ficha, a qualquer hora). */
function pedirPassiva(sceneKey: string) {
  return (pedido: PedidoDePassiva) => useBatalhaStore.getState().passiva(sceneKey, MESTRE, pedido)
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
  if (itens.length === 0) return null
  return (
    <section className="bt-secao" aria-label="Lembretes das passivas dos NPCs">
      <h3 className="bt-secao__titulo">Passivas dos NPCs</h3>
      <LembretesDaPassiva itens={itens} sistema={mesa.sistema} aplicarLivre onPedir={pedirPassiva(sceneKey)} className="bt-lembretes--npc" />
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

  if (cena === undefined || turnos === undefined) return null

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
        <LembretesDosNpcs sceneKey={sceneKey} mesa={mesa} turnos={turnos} exceto={null} />
        {reacoes}
      </>
    )

  const personagem = carta.personagemId === null ? null : (personagens.find((candidato) => candidato.id === carta.personagemId) ?? null)
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: cena.regras })
  const vez = { cartaId: carta.id, rodada: turnos.rodada }
  const nome = nomeDaFicha(mesa, carta.tokenId, carta)
  const doMestre = ehDoMestre(carta.personagemId, personagens)
  const combate = carta.personagemId === null ? undefined : turnos.combate?.[carta.personagemId]
  const carga = combate?.carga ?? 0
  const { personagemId } = carta
  const zerarCarga = personagemId === null || carga === 0 ? undefined : () => useBatalhaStore.getState().zerarCarga(sceneKey, MESTRE, personagemId)

  if (!doMestre) {
    return (
      <>
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
  const formas = personagem !== null && sistema !== null ? formasNoMenu(personagem, sistema, acoes) : []
  const aparencia = carta.personagemId === null || personagem === null ? null : aparenciaDaForma(turnos.formas?.[carta.personagemId], personagem)
  // Tipos de habilidade F3: as passivas do NPC da vez e os lembretes dele (o mestre aplica o "a cada turno" quando quiser).
  const alvos = alvosDaOrdem(mesa, turnos.cartas, carta)
  const passivas = passivasNaCena(personagem, sistema, turnos, carta.tokenId)
  const lembretes = lembretesNaTela(combate?.lembretes, passivas, alvos)

  return (
    <>
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
          onEncerrar={() => useBatalhaStore.getState().passarVez(sceneKey, MESTRE, vez)}
          onAcoesExtras={() => onDialogo({ tipo: 'extras', cartaId: carta.id })}
          onDarDano={() => onDialogo({ tipo: 'dano', tokenId: null })}
          consulta={consultaDoMestre}
          alvoDoMapa={alvoDoMapa}
          mapa={{ ligado: mirando, onTrocar: (ligado) => useMiraDoMestre.getState().mirar(ligado) }}
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
      const forma = formas?.[carta.personagemId]
      const aparencia = forma === undefined ? null : aparenciaDaForma(forma, personagens.find((candidato) => candidato.id === carta.personagemId))
      if (aparencia !== null) porToken.set(carta.tokenId, aparencia)
    }
    return (tokenId: string) => porToken.get(tokenId) ?? null
  }, [fichas, cartas, formas, personagens])
  const carta = turnos === undefined ? null : cartaDaVez(turnos)
  const vez =
    carta === null || turnos === undefined
      ? null
      : { chave: `${carta.id}:${turnos.rodada}`, nome: fichas.find((ficha) => ficha.id === carta.tokenId)?.name.trim() || carta.nome?.trim() || 'Ficha', minha: false }
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
    const alvos = turnos.cartas
      .filter((carta) => !vistos.has(carta.tokenId) && vistos.add(carta.tokenId))
      .map((carta) => ({ tokenId: carta.tokenId, nome: nomeDaFicha(mesa, carta.tokenId, carta) }))
    return <DarDanoDialog alvos={alvos} alvoInicial={dialogo.tokenId} onConfirmar={(tokenId, valor) => store.darDano(sceneKey, MESTRE, tokenId, valor)} onFechar={onFechar} />
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
