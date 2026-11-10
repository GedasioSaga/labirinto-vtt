import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motivoDoConcentrar } from '../../lib/batalha/acoes'
import { ALVO_DA_REACAO, chaveDaVez, partesDoBonus, type PedidoDeAcao } from '../../lib/batalha/combate'
import { motivoDoEvoluirNaFicha } from '../../lib/batalha/escolhaEEvolucao'
import { armasDe } from '../../lib/batalha/leituraDaFicha'
import { custosDasFormasNaTela } from '../../lib/batalha/custoPorTurno'
import { saidasTiradas, travaDosSelos } from '../../lib/batalha/condicoes'
import { avisoDasReducoes, reducoesDoDano } from '../../lib/batalha/reducaoDoDano'
import { reacoesDoJogador, reacoesParaOAlvo, reacoesPorPerto } from '../../lib/batalha/reacaoComTecnica'
import type { VezEsperada } from '../../lib/batalha/ponte'
import { bonusDaBatalha, bonusDaReacao, type SeloQueSoma } from '../../lib/batalha/selos'
import { formasNoMenu } from '../../lib/batalha/transformacao'
import { formasComODecidirDoMestre } from '../../lib/batalha/mecanica/formaDoMestre'
import { ATACANTE_FORA_DA_VISTA, selosParaOBonus, type CartaParaJogador, type EfeitoParaJogador, type EstadoParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { BotaoDeReacao } from './BotaoDeReacao'
import { CaixaDeReacao, type BonusDaReacaoNaTela, type ReacaoNaCaixa } from './CaixaDeReacao'
import { alvosDoRecorte, alvosNaOrdemDaMira, armaPadraoNaBatalha, combateDoJogador, golpesDeAtaque, golpesDeHabilidade } from './dadosDoMenu'
import { EfeitosDaBatalha, type PalcoDosEfeitos } from './EfeitosDaBatalha'
import { invocacaoDaFicha, motivoNoJogador, pedidoDeInvocacao } from './dadosDaInvocacao'
import { EscolhaDeArmas } from './EscolhaDeArmas'
import type { EvoluirNaTela } from './ListaDeTecnicas'
import { MenuDaVez, textoDaEspera, textoDoMestreDecidindo, type ContraNoMenu, type InvocarNoMenu } from './MenuDaVez'
import type { ConsultaDaFicha } from './MiraDoGolpe'
import { LembretesDaMarca, marcaNaTela, type MarcaNaTela } from './LembretesDaMarca'
import { LembretesDaPassiva, lembretesNaTela, passivasNoRecorte, type LembreteNaTela } from './PassivasDaBatalha'
import type { ConexaoDaBatalha } from './pedidosDaVez'
import './batalha.css'
import './combate.css'

/**
 * A BATALHA DO JOGADOR sobre o mapa (S3): os efeitos (com a faixa da vez e o
 * tremor), o menu da vez (e o contra-ataque guardado, fora da vez), o botão
 * REAÇÃO sempre à vista, a caixa REAÇÃO (abre sozinha quando chega golpe
 * novo) e a escolha de armas no começo (limite da ficha e ainda não
 * escolheu). Tudo lê o recorte do host (`batalhaEstado`, `batalhaEfeitos`) e
 * pede pela conexão; o resultado volta no próximo estado.
 *
 * Enquanto o corte do golpe ou a faixa da vez passam (o palco dos efeitos), o
 * menu, o véu e a caixa somem e voltam depois; na SUA VEZ o menu novo só entra
 * quando a faixa sai.
 *
 * Tipos de habilidade F3: os lembretes das passivas dele numa faixa pequena
 * no alto da coluna do menu, logo abaixo da faixa da ordem; o menu desce a
 * altura deles (nada da vez fica por baixo; o botão REAÇÃO segue embaixo), e
 * a tira Passivas no menu da vez.
 */

// U4: o contrato dos pedidos mora com a função que os monta (`pedidosDaVez.ts`); sai daqui também para quem já importava.
export type { ConexaoDaBatalha }

export interface FichaDoJogador {
  id: string
  name: string
  imageData?: string | null
  /** C4: a posição no mapa (px do mundo), para a ordem dos alvos por distância. */
  x?: number
  y?: number
  /** Construtor C3: casas por lado e rotação do token, para a área montada marcar pela grade. */
  size?: number
  rotation?: number
}

export interface BatalhaDoJogadorProps {
  estado: EstadoParaJogador
  efeitos: readonly EfeitoParaJogador[] | undefined
  /** Os personagens dele (`state.personagens`). */
  meus: readonly Personagem[] | undefined
  /**
   * Conserto das fichas F2b (bug 8): os personagens que o host manda com os
   * aliados (`batalha.aliados`). Na vez da ficha emprestada (ou do NPC que ele
   * controla), o personagem dela vem aqui, e o menu da vez é o dela inteiro.
   * Ausente = só `meus`.
   */
  aliados?: readonly Personagem[]
  fichas: readonly FichaDoJogador[]
  sistema: SistemaDeRpg | null
  conexao: ConexaoDaBatalha
  /** S4: a posição da ficha na tela (estável). */
  consulta: ConsultaDaFicha
  /** S4: a ficha tocada enquanto mira. */
  alvoDoMapa: { tokenId: string; seq: number } | null
  onMirando: (mirando: boolean) => void
  onTremor: () => void
  /**
   * A faixa da troca de vez: "suaVez" (o jogador, padrão) ou "vezDe" ("Vez de
   * Lia"), para a Arena de testes, onde o mestre joga por todas as fichas e
   * toda vez seria "SUA VEZ". Com "vezDe" o menu novo entra sob a faixa (fica
   * escondido pelo palco) em vez de esperar ela sair.
   */
  textoDaVez?: 'suaVez' | 'vezDe'
  /** C4: o lado da casa do mapa (px), para a ordem dos alvos. Ausente = a conta em px (a Arena). */
  tamanhoDaCasa?: number
  /**
   * Conserto das fichas F1 (bug 1): a última recusa da mesa ("A mesa não
   * aceitou: a vez já passou."), por alguns segundos. `id` novo = mostra de
   * novo. Ausente = sem aviso (a Arena e o Lobby, que não passam).
   */
  recusa?: { id: number; texto: string }
  /**
   * U2 (plano de 10/11): o MOTIVO da regra para o pedido que `conexao.agir`
   * recusou na hora (a Arena e o treino, onde a regra roda aqui mesmo; na LAN
   * a resposta do host chega depois, em `recusa`). `null` = a regra não recusa
   * (cai no `avisoDaRecusa`). Ausente = a frase de sempre do menu.
   */
  motivoDaRecusa?: (vez: VezEsperada | null, pedido: PedidoDeAcao) => string | null
  /** U2: a frase da recusa quando a regra não diz o motivo. Ausente = a do jogador ("sem conexão com o mestre..."). */
  avisoDaRecusa?: string
}

/** Conserto das fichas F1 (bug 1): quanto o aviso da recusa fica na tela. */
const RECUSA_NA_TELA_MS = 4_500

/** O aviso da recusa: a região "status" fica sempre montada (o leitor de tela anuncia o texto novo); o texto sai sozinho. */
function AvisoDaRecusa({ recusa }: { recusa: { id: number; texto: string } | undefined }) {
  const [sumiu, setSumiu] = useState<number | null>(null)
  const id = recusa?.id
  useEffect(() => {
    if (id === undefined) return
    const prazo = setTimeout(() => setSumiu(id), RECUSA_NA_TELA_MS)
    return () => clearTimeout(prazo)
  }, [id])
  const naTela = recusa !== undefined && sumiu !== recusa.id
  return (
    <div className="pp-batalha-recusa-lugar" role="status" aria-live="polite">
      {naTela && (
        <p key={recusa.id} className="pp-batalha-recusa">
          {recusa.texto}
        </p>
      )}
    </div>
  )
}

/** A classe que o PlayerView dá à `FaixaDoJogador` (player/main.tsx). */
const CLASSE_DA_FAIXA = 'pp-batalha-faixa'
/** O vão entre os lembretes das passivas e o menu da vez, embaixo deles. */
const VAO_DOS_LEMBRETES = 10
const SEM_EFEITOS: readonly EfeitoParaJogador[] = []
const NINGUEM: readonly Personagem[] = []

/** Tipos de habilidade F2: o "+3 na reação" dos selos de quem reage, como a caixa o mostra; nenhum = ausente. */
function bonusDaReacaoDe(selos: readonly SeloQueSoma[], tokenId: string): BonusDaReacaoNaTela | undefined {
  const bonus = bonusDaBatalha(selos, tokenId)
  const partes = partesDoBonus(bonus, ALVO_DA_REACAO)
  return partes.length === 0 ? undefined : { total: bonusDaReacao(bonus), partes }
}

export function BatalhaDoJogador({ estado, efeitos = SEM_EFEITOS, meus = NINGUEM, aliados = NINGUEM, fichas, sistema, conexao, consulta, alvoDoMapa, onMirando, onTremor, textoDaVez = 'suaVez', tamanhoDaCasa, recusa, motivoDaRecusa, avisoDaRecusa }: BatalhaDoJogadorProps) {
  const [caixaAberta, setCaixaAberta] = useState(false)
  const [livre, setLivre] = useState(false)
  const [armasDe_, setArmasDe] = useState<string | null>(null)
  const [palco, setPalco] = useState<PalcoDosEfeitos>(null)
  const dispensadas = useRef(new Set<string>())

  const nomeDe = useMemo(() => {
    const porToken = new Map<string, string>()
    for (const ficha of fichas) porToken.set(ficha.id, ficha.name.trim())
    for (const carta of estado.cartas) if (carta.nome.trim() !== '') porToken.set(carta.tokenId, carta.nome.trim())
    return (tokenId: string) => porToken.get(tokenId) || 'Ficha'
  }, [fichas, estado.cartas])
  // F3: a imagem da forma (o host manda só a de cartão ligado) vence a foto no corte e na transformação.
  const aparencias = estado.aparencias
  const imagemDe = useMemo(() => {
    const porToken = new Map(fichas.map((ficha) => [ficha.id, ficha.imageData ?? null] as const))
    // C8 (lote de 01/11): token sem foto usa o retrato da ficha que ele tem (a dele e, na Arena, todas) ou o que o host manda dos colegas.
    const retratos = new Map<string, string>(Object.entries(estado.retratos ?? {}))
    for (const carta of estado.cartas) {
      const retrato = carta.personagemId === undefined ? null : (meus.find((candidato) => candidato.id === carta.personagemId)?.retrato ?? null)
      if (retrato) retratos.set(carta.tokenId, retrato)
    }
    const daForma = (tokenId: string) => (aparencias !== undefined && Object.hasOwn(aparencias, tokenId) ? aparencias[tokenId] : undefined)
    return (tokenId: string) => daForma(tokenId) ?? (porToken.get(tokenId) || retratos.get(tokenId)) ?? null
  }, [fichas, aparencias, estado.cartas, estado.retratos, meus])

  // ---- a vez e o contra-ataque
  const vez = estado.vez
  const cartaDaVez = vez === null ? undefined : estado.cartas.find((carta) => carta.id === vez)
  const contras = estado.contras ?? []
  const tokenQueAge = estado.minhaVez ? cartaDaVez?.tokenId : contras[0]?.tokenId
  const cartaQueAge = tokenQueAge === undefined ? undefined : (estado.minhaVez ? cartaDaVez : estado.cartas.find((carta) => carta.tokenId === tokenQueAge && carta.lado === 'eu'))
  const personagemId = cartaQueAge?.personagemId
  // F2b (bug 8): a carta da vez é "eu" (a tela dele); fora dos personagens dele, é a emprestada ou o NPC que ele controla (vem com os aliados).
  const personagem = personagemId === undefined ? null : (meus.find((candidato) => candidato.id === personagemId) ?? aliados.find((candidato) => candidato.id === personagemId) ?? null)
  const meuCombate = personagemId === undefined ? undefined : estado.meus?.find((combate) => combate.personagemId === personagemId)
  const chave = estado.minhaVez && vez !== null ? chaveDaVez(estado.rodada, vez) : null
  const combate = useMemo(() => combateDoJogador(meuCombate, chave), [meuCombate, chave])
  const acoes = estado.minhaVez ? (estado.acoes ?? null) : null
  const { zerarCarga } = conexao
  // Tipos de habilidade F2: os selos do recorte (a carta extra repete os do token: conta uma vez), na forma que `bonusDaBatalha` lê.
  const selosQueSomam = useMemo(() => selosParaOBonus(estado.cartas), [estado.cartas])

  // U1: as fichas inteiras que quem olha tem (as dele e as dos aliados; na Arena, todas as cópias): daqui sai a vida de cada alvo.
  const fichasInteiras = useMemo(() => [...meus, ...aliados], [meus, aliados])
  // U1: os alvos da mira e o oponente da passiva, do ponto de vista de quem age, pela mesma montagem do mestre no mapa
  // (`alvosDoRecorte`): o lado na luta, a vida quando quem olha a tem, o ferido e o caído.
  const alvosPara = useCallback(
    (quemAge: CartaParaJogador | null) => alvosDoRecorte({ cartas: estado.cartas, quemAge, personagens: fichasInteiras, sistema, nomeDe, imagemDe }),
    [estado.cartas, fichasInteiras, sistema, nomeDe, imagemDe],
  )
  // D4: a vida de cada ficha, para o impacto do tamanho do golpe e a queda. Só a que quem olha PODE ver (a mesma da
  // mira: a dele, a do aliado, a que o host pôs na carta); ficha sem vida no recorte = `null` (o tremor do meio, sem tombo).
  const vidaDe = useCallback((tokenId: string) => alvosPara(null).find((alvo) => alvo.tokenId === tokenId)?.vida ?? null, [alvosPara])

  const menu = useMemo(() => {
    if (cartaQueAge === undefined) return null
    // Construtor C8: a arma padrão da ficha entra no "Dano da arma" das técnicas (sem padrão, a 1ª levada).
    const arma = armaPadraoNaBatalha(personagem, combate)
    const bonus = bonusDaBatalha(selosQueSomam, cartaQueAge.tokenId)
    const habilidades = (comAcoes: typeof acoes) => (personagem !== null && sistema !== null ? golpesDeHabilidade(personagem, sistema, combate, comAcoes, arma, bonus) : [])
    const selosDoDono = estado.cartas.find((carta) => carta.tokenId === cartaQueAge.tokenId)?.selos?.length ?? 0
    return {
      armas: golpesDeAtaque(personagem, sistema, combate, acoes, bonus),
      habilidades: habilidades(acoes),
      contra: { armas: golpesDeAtaque(personagem, sistema, combate, null, bonus), habilidades: habilidades(null) },
      // C4: inimigos do mais perto ao mais longe, aliados depois, ele por último.
      alvos: alvosNaOrdemDaMira(alvosPara(cartaQueAge), fichas, cartaQueAge.tokenId, tamanhoDaCasa),
      // F3: a tira Transformação (com a prévia dos números da ficha dele).
      // C6: a forma em que o mestre decide os números não mostra prévia, e a que já espera o mestre fica apagada.
      formas: personagem !== null && sistema !== null ? formasComODecidirDoMestre(formasNoMenu(personagem, sistema, acoes, combate), meuCombate?.formasEsperando) : [],
      // Tipos de habilidade F3: a tira Passivas (as ligadas vêm do recorte, `passivasAtivas`).
      passivas: passivasNoRecorte(personagem, sistema, estado.rodada, meuCombate, selosDoDono),
    }
  }, [cartaQueAge, personagem, sistema, combate, acoes, estado.cartas, estado.rodada, meuCombate, alvosPara, selosQueSomam, fichas, tamanhoDaCasa])

  const contrasNoMenu = useMemo<ContraNoMenu[]>(
    () =>
      contras.map((contra) => ({
        golpeId: contra.golpeId,
        rotulo: contra.atacanteTokenId === null ? 'contra alguém fora da vista' : `contra ${nomeDe(contra.atacanteTokenId)}`,
      })),
    [contras, nomeDe],
  )

  // ---- os lembretes das passivas (Tipos de habilidade F3): os de todas as fichas dele, com o nome quando ele tem mais de uma
  const comPassiva = conexao.passiva !== undefined
  const lembretes = useMemo<LembreteNaTela[]>(() => {
    if (!comPassiva) return []
    const varios = (estado.meus?.length ?? 0) > 1
    const itens: LembreteNaTela[] = []
    for (const meu of estado.meus ?? []) {
      const primeiro = meu.lembretes?.[0]
      if (primeiro === undefined) continue
      const dele = meus.find((candidato) => candidato.id === meu.personagemId)
      const selosDoDono = estado.cartas.find((carta) => carta.tokenId === primeiro.tokenId)?.selos?.length ?? 0
      const passivas = passivasNoRecorte(dele, sistema, estado.rodada, meu, selosDoDono)
      // U1: os alvos do lembrete do ponto de vista do DONO da passiva (na Arena, cada lado vê o outro como o outro lado).
      const cartaDoDono = estado.cartas.find((carta) => carta.tokenId === primeiro.tokenId && carta.bando === undefined) ?? null
      itens.push(...lembretesNaTela(meu.lembretes, passivas, alvosPara(cartaDoDono), varios ? nomeDe(primeiro.tokenId) : undefined, custosDasFormasNaTela(dele, sistema)))
    }
    return itens
  }, [comPassiva, estado.meus, estado.rodada, estado.cartas, meus, sistema, alvosPara, nomeDe])
  // ---- R1 (lote de 01/11): os lembretes da marca, de todas as fichas dele (o nome quando ele tem mais de uma).
  const pedirMarca = conexao.marcar
  const marcas = useMemo<MarcaNaTela[]>(() => {
    if (pedirMarca === undefined) return []
    const varios = (estado.meus?.length ?? 0) > 1
    const itens: MarcaNaTela[] = []
    for (const meu of estado.meus ?? []) {
      const dele = meus.find((candidato) => candidato.id === meu.personagemId)
      for (const lembrete of meu.marcas ?? []) {
        const item = marcaNaTela(lembrete, dele, sistema, nomeDe, bonusDaBatalha(selosQueSomam, lembrete.tokenId), varios ? nomeDe(lembrete.tokenId) : undefined)
        if (item !== null) itens.push(item)
      }
    }
    return itens
  }, [pedirMarca, estado.meus, meus, sistema, nomeDe, selosQueSomam])
  // Na Arena o mestre opera tudo ("Vez de Lia"): aplica o "a cada turno" quando quiser, como na aba Batalha.
  const operaComoMestre = textoDaVez === 'vezDe'

  // ---- Tipos de habilidade F4: o Evoluir na leitura das Habilidades. O jogador, só na vez dele (o contra-ataque guardado é
  // fora dela); na Arena o mestre opera e evolui sempre. A regra da ficha é a do host (`motivoDoEvoluirNaFicha`); ele confere de novo
  // e a recusa traz o motivo (a Melodia que a CAÇA pede só o host vê).
  const pedirEvolucao = conexao.evoluir
  const evoluir: EvoluirNaTela | undefined =
    pedirEvolucao === undefined || cartaQueAge === undefined || personagem === null || sistema === null
      ? undefined
      : {
          motivo: (cartaoId, custo) => (!operaComoMestre && !estado.minhaVez ? 'Evoluir só na sua vez' : motivoDoEvoluirNaFicha(personagem, sistema, meuCombate?.evoluidas, { cartaoId, custo })),
          onEvoluir: (cartaoId, custo) => pedirEvolucao({ tipo: 'evoluir', tokenId: cartaQueAge.tokenId, cartaoId, custo }),
        }

  // ---- Invocação F3: a mira da invocação (as opções da ficha dele, o máximo pelo recorte) e o "esperando o mestre".
  const pedirInvocacao = conexao.invocar
  const minhasInvocacoes = meuCombate?.invocacoes
  const golpesDoMenu = menu?.habilidades
  const invocacao = useMemo<InvocarNoMenu | undefined>(() => {
    if (pedirInvocacao === undefined || cartaQueAge === undefined) return undefined
    const contar = (cartaoId: string, opcao: string) => (minhasInvocacoes ?? []).filter((item) => item.cartaoId === cartaoId && item.opcao === opcao).length
    return {
      leitura: (cartaoId) => invocacaoDaFicha(personagem, sistema, cartaoId),
      contar: (cartaoId, opcao) => contar(cartaoId, opcao.chave),
      motivo: (cartaoId) => {
        const daTecnica = golpesDoMenu?.find((golpe) => golpe.cartaoId === cartaoId)?.motivo ?? null
        // Decisão 10: o Ultra desta técnica já posto (o recorte diz a opção dos dele) recusa os comuns.
        const ultras = new Set((invocacaoDaFicha(personagem, sistema, cartaoId)?.opcoes ?? []).filter((opcao) => opcao.ultra).map((opcao) => opcao.chave))
        const ultraEmCampo = (minhasInvocacoes ?? []).some((item) => item.posto && item.cartaoId === cartaoId && ultras.has(item.opcao))
        return (opcao) => motivoNoJogador(opcao, contar(cartaoId, opcao.chave), ultraEmCampo, combate?.carga ?? 0, daTecnica)
      },
      onInvocar: (cartaoId, opcao, custo, acao) => pedirInvocacao(pedidoDeInvocacao(cartaQueAge.tokenId, cartaoId, opcao, custo, acao)),
      esperando: (minhasInvocacoes ?? []).filter((item) => !item.posto),
    }
  }, [pedirInvocacao, cartaQueAge, minhasInvocacoes, personagem, sistema, golpesDoMenu, combate])
  // Fora da vez (e com mais de uma ficha), a espera de todas as fichas dele fica na coluna dos lembretes.
  const esperandoOMestre = useMemo(() => (estado.meus ?? []).flatMap((meu) => (meu.invocacoes ?? []).filter((item) => !item.posto)), [estado.meus])
  // Construtor C6: as formas dele esperando o mestre decidir os números ("o mestre está decidindo").
  const formasEsperando = useMemo(() => (estado.meus ?? []).flatMap((meu) => meu.formasEsperando ?? []), [estado.meus])

  // ---- a reação
  const reacoes = useMemo<ReacaoNaCaixa[]>(() => {
    const variasFichas = new Set((estado.reacoes ?? []).map((reacao) => reacao.tokenId)).size > 1
    return (estado.reacoes ?? []).map((reacao) => {
      const item: ReacaoNaCaixa = { golpeId: reacao.golpeId, tokenId: reacao.tokenId, atacante: reacao.atacante === ATACANTE_FORA_DA_VISTA ? 'Alguém fora da sua vista' : reacao.atacante, nome: reacao.nome, dano: reacao.dano }
      // F2 (fatia B, o "perto" do Aplauso): a ficha dele rebate no lugar do alvo, só com a técnica que rebate.
      const por = reacao.por
      if (por !== undefined) {
        item.alvo = nomeDe(reacao.tokenId)
        item.por = { tokenId: por, nome: nomeDe(por) }
        if (reacao.overload === true) item.overload = true
        const personagemDoPor = estado.cartas.find((carta) => carta.tokenId === por && carta.lado === 'eu')?.personagemId
        const quemRebate = personagemDoPor === undefined ? undefined : meus.find((candidato) => candidato.id === personagemDoPor)
        if (quemRebate !== undefined && sistema !== null) {
          item.tecnicas = reacoesPorPerto({ podeReagir: true, rolagem: reacao.rolagem }, quemRebate, sistema, combateDoJogador(estado.meus?.find((meu) => meu.personagemId === quemRebate.id), null))
        }
        return item
      }
      if (variasFichas) item.alvo = nomeDe(reacao.tokenId)
      if (reacao.perfurante) item.perfurante = true
      if (reacao.perfurante && reacao.perfuracao !== undefined) item.perfuracao = reacao.perfuracao
      if (reacao.overload === true) item.overload = true
      if (reacao.surpresa === true) item.surpresa = true
      if (reacao.rolagem !== undefined) item.rolagem = reacao.rolagem
      const bonus = bonusDaReacaoDe(selosQueSomam, reacao.tokenId)
      if (bonus !== undefined) item.bonus = bonus
      // F2 (fatia A): Aéreo tira a Esquiva e o Contra-ataque dos botões.
      const semSaidas = saidasTiradas(selosQueSomam.filter((selo) => selo.tokenId === reacao.tokenId))
      if (semSaidas.length > 0) item.semSaidas = semSaidas
      // Tipos de habilidade F1: as técnicas de reação da ficha dele que reage (o recorte só traz alvo que reage).
      const personagemDoAlvo = estado.cartas.find((carta) => carta.tokenId === reacao.tokenId && carta.lado === 'eu')?.personagemId
      const dele = personagemDoAlvo === undefined ? undefined : meus.find((candidato) => candidato.id === personagemDoAlvo)
      if (dele !== undefined && sistema !== null) {
        const combateDele = combateDoJogador(estado.meus?.find((meu) => meu.personagemId === dele.id), null)
        // F2 (revisão da fatia E): contra Surpresa só a técnica que vale contra ela; a que o mestre confirma vem apagada com o motivo.
        item.tecnicas = reacoesDoJogador(reacoesParaOAlvo({ podeReagir: true, rolagem: reacao.rolagem }, dele, sistema, combateDele, reacao.overload === true, reacao.surpresa === true))
        // Conserto das fichas F1 (S4): Resiliente, Determinação (HP abaixo da metade): o aviso do que sai do dano.
        const reducao = avisoDasReducoes(reducoesDoDano(dele, sistema))
        if (reducao !== '') item.reducao = reducao
      }
      return item
    })
  }, [estado.reacoes, estado.cartas, estado.meus, meus, sistema, nomeDe, selosQueSomam])

  // Golpe novo esperando: a caixa abre sozinha (uma vez por golpe).
  const vistosGolpes = useRef(new Set<string>())
  useEffect(() => {
    let novo = false
    for (const reacao of reacoes) {
      const chaveDoGolpe = `${reacao.golpeId}:${reacao.tokenId}`
      if (!vistosGolpes.current.has(chaveDoGolpe)) {
        vistosGolpes.current.add(chaveDoGolpe)
        novo = true
      }
    }
    if (novo) {
      setLivre(false)
      setCaixaAberta(true)
    }
    if (reacoes.length === 0 && !livre) setCaixaAberta(false)
  }, [reacoes, livre])

  const minhaFicha = estado.cartas.find((carta) => carta.lado === 'eu' && carta.caiu !== true) ?? estado.cartas.find((carta) => carta.lado === 'eu')
  const bonusDaLivre = minhaFicha === undefined ? undefined : bonusDaReacaoDe(selosQueSomam, minhaFicha.tokenId)
  const reacoesNaCaixa: ReacaoNaCaixa[] =
    reacoes.length > 0
      ? reacoes
      : livre && minhaFicha !== undefined
        ? [{ golpeId: null, tokenId: minhaFicha.tokenId, atacante: '', nome: '', dano: null, ...(bonusDaLivre === undefined ? {} : { bonus: bonusDaLivre }) }]
        : []

  // ---- as armas: no começo, com limite e sem escolha, a janela abre (uma vez; Cancelar não reabre)
  const semEscolha = (estado.meus ?? []).find((meu) => meu.limiteDeArmas !== null && meu.armas === null && !dispensadas.current.has(meu.personagemId))
  useEffect(() => {
    if (semEscolha !== undefined && armasDe_ === null) setArmasDe(semEscolha.personagemId)
  }, [semEscolha, armasDe_])
  const personagemDasArmas = armasDe_ === null ? null : (meus.find((candidato) => candidato.id === armasDe_) ?? null)
  const combateDasArmas = armasDe_ === null ? undefined : estado.meus?.find((meu) => meu.personagemId === armasDe_)

  // Na SUA VEZ o menu novo espera a faixa sair (tocando ou ainda na fila); nos outros palcos ele só some e volta.
  /** A vez que vai com o pedido: o contra-ataque é fora da vez (`null`); o resto, a carta e a rodada de agora. */
  const vezDoPedido = (pedido: PedidoDeAcao): VezEsperada | null => (pedido.tipo !== 'concentrar' && pedido.contraDe !== undefined ? null : vez === null ? null : { cartaId: vez, rodada: estado.rodada })
  const mostrarMenu = cartaQueAge !== undefined && menu !== null && (estado.minhaVez || contras.length > 0) && palco !== 'suaVez'
  const noPalco = palco === null ? undefined : 'sim'

  // O menu mora à esquerda, centrado na altura, mas começa abaixo da faixa da
  // ordem (`.pp-batalha-faixa`, montada pelo PlayerView): a altura dela muda com
  // as cartas, então é medida e vai para `--pp-faixa-alto` no lugar do menu.
  // Os lembretes das passivas usam a mesma medida: moram logo abaixo da faixa.
  const lugarDoMenu = useRef<HTMLDivElement>(null)
  const lugarDosLembretes = useRef<HTMLDivElement>(null)
  const comEspera = esperandoOMestre.length > 0 && conexao.invocar !== undefined
  const comFormaEsperando = formasEsperando.length > 0
  const comLembretes = lembretes.length > 0 || marcas.length > 0 || ((comEspera || comFormaEsperando) && !mostrarMenu)
  useLayoutEffect(() => {
    const menuNaTela = lugarDoMenu.current
    const avisos = lugarDosLembretes.current
    const faixa = document.querySelector<HTMLElement>(`.${CLASSE_DA_FAIXA}`)
    if ((menuNaTela === null && avisos === null) || faixa === null) return
    const medir = () => {
      const alto = `${faixa.offsetHeight}px`
      menuNaTela?.style.setProperty('--pp-faixa-alto', alto)
      avisos?.style.setProperty('--pp-faixa-alto', alto)
      // Com lembrete, o menu começa abaixo dele (e do vão): nenhum botão da vez fica por baixo.
      menuNaTela?.style.setProperty('--pp-lembretes-alto', avisos === null ? '0px' : `${avisos.offsetHeight + VAO_DOS_LEMBRETES}px`)
    }
    medir()
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    observador?.observe(faixa)
    if (avisos !== null) observador?.observe(avisos)
    return () => observador?.disconnect()
  }, [mostrarMenu, comLembretes])

  return (
    <>
      <EfeitosDaBatalha
        className="pp-batalha-efeitos"
        efeitos={efeitos}
        consulta={consulta}
        nomeDe={nomeDe}
        imagemDe={imagemDe}
        vez={
          vez === null || cartaDaVez === undefined
            ? null
            : {
                chave: `${vez}:${estado.rodada}`,
                nome: cartaDaVez.nome.trim() || nomeDe(cartaDaVez.tokenId),
                minha: estado.minhaVez && textoDaVez === 'suaVez',
                // D3: quem joga a vez. Toda vez que quem olha joga é do mesmo dono (na Arena, onde a faixa diz "Vez de Lia", o
                // mestre joga por todos): a seguinte toca a faixa curta. A vez dos outros fica sem dono: o recorte não diz quem a joga.
                dono: estado.minhaVez ? 'eu' : null,
                ...(cartaDaVez.bando === undefined ? { tokenId: cartaDaVez.tokenId } : {}),
              }
        }
        onTremor={onTremor}
        onPalco={setPalco}
        vidaDe={vidaDe}
      />
      {mostrarMenu && <div className="pp-batalha-veu" aria-hidden="true" data-palco={noPalco} />}
      {mostrarMenu && (
        <div ref={lugarDoMenu} className="pp-batalha-menu" data-palco={noPalco}>
          <MenuDaVez
            key={estado.minhaVez ? `${vez}:${estado.rodada}` : 'contra'}
            formasEsperando={formasEsperando}
            quem={cartaQueAge.nome.trim() || 'Você'}
            acoes={acoes}
            carga={combate?.carga ?? 0}
            motivoDoConcentrar={acoes === null ? 'Fora da vez' : motivoDoConcentrar(combate, acoes, chave ?? '')}
            armas={menu.armas}
            habilidades={menu.habilidades}
            golpesDoContra={menu.contra}
            alvos={menu.alvos}
            contras={contrasNoMenu}
            escolhaDeArmas={
              personagemId === undefined || meuCombate === undefined || meuCombate.limiteDeArmas === null
                ? undefined
                : { pendente: meuCombate.armas === null, onAbrir: () => setArmasDe(personagemId) }
            }
            onAgir={(pedido) => conexao.agir(vezDoPedido(pedido), pedido)}
            // U2: o motivo da regra para o pedido recusado na hora, lido com a mesma vez do pedido.
            motivoDaRecusa={motivoDaRecusa === undefined ? undefined : (pedido) => motivoDaRecusa(vezDoPedido(pedido), pedido)}
            avisoDaRecusa={avisoDaRecusa}
            onZerarCarga={zerarCarga === undefined || personagemId === undefined ? undefined : () => zerarCarga(personagemId)}
            onEncerrar={estado.minhaVez && vez !== null ? () => conexao.passarVez(vez, estado.rodada) : undefined}
            alvoDoMapa={alvoDoMapa}
            onMirando={onMirando}
            consulta={consulta}
            // U1: na Arena quem opera é o mestre: a mira diz o lado de cada alvo ("quem usa", "outro lado") e a ajuda
            // no outro lado pede um toque a mais, como na vez do NPC no mapa.
            doMestre={operaComoMestre}
            formas={menu.formas}
            personagemId={personagemId ?? null}
            passivas={conexao.passiva === undefined || menu.passivas.length === 0 ? undefined : { itens: menu.passivas, tokenId: cartaQueAge.tokenId, sistema, onPedir: conexao.passiva }}
            evoluir={evoluir}
            invocacao={invocacao}
            travado={travaDosSelos(estado.cartas.find((carta) => carta.tokenId === cartaQueAge.tokenId)?.selos)}
          />
        </div>
      )}
      {comLembretes && (conexao.passiva !== undefined || comEspera || comFormaEsperando || marcas.length > 0) && (
        <div ref={lugarDosLembretes} className="pp-batalha-lembretes" data-palco={noPalco}>
          {comFormaEsperando && !mostrarMenu && (
            <p className="bt-vez__espera" role="status">
              <span className="bt-vez__espera-ponto" aria-hidden="true" />
              {textoDoMestreDecidindo(formasEsperando)}
            </p>
          )}
          {comEspera && !mostrarMenu && (
            <p className="bt-vez__espera" role="status">
              <span className="bt-vez__espera-ponto" aria-hidden="true" />
              Esperando o mestre pôr no mapa: {textoDaEspera(esperandoOMestre)}
            </p>
          )}
          {marcas.length > 0 && pedirMarca !== undefined && <LembretesDaMarca itens={marcas} onResponder={pedirMarca} />}
          {lembretes.length > 0 && conexao.passiva !== undefined && <LembretesDaPassiva itens={lembretes} sistema={sistema} aplicarLivre={operaComoMestre} onPedir={conexao.passiva} />}
        </div>
      )}
      <div className="pp-batalha-reacao-botao">
        <BotaoDeReacao
          esperando={reacoes.length}
          aberta={caixaAberta}
          onAbrir={() => {
            if (caixaAberta) {
              setCaixaAberta(false)
              setLivre(false)
              return
            }
            setLivre(reacoes.length === 0)
            setCaixaAberta(true)
          }}
        />
      </div>
      {caixaAberta && reacoesNaCaixa.length > 0 && (
        <div className="pp-batalha-reacao" data-palco={noPalco}>
          <CaixaDeReacao
            reacoes={reacoesNaCaixa}
            onPedir={(pedido) => {
              const saiu = conexao.reagir(pedido)
              // A reação livre vira efeito sobre a ficha: a caixa sai.
              if (saiu && pedido.tipo === 'rolar' && pedido.golpeId === null) {
                setLivre(false)
                setCaixaAberta(false)
              }
              return saiu
            }}
            onFechar={() => {
              setCaixaAberta(false)
              setLivre(false)
            }}
          />
        </div>
      )}
      {personagemDasArmas !== null && combateDasArmas !== undefined && armasDe_ !== null && (
        <EscolhaDeArmas
          quem={personagemDasArmas.nome}
          armas={armasDe(personagemDasArmas).map((arma) => ({ id: arma.id, nome: arma.nome.trim() || 'Arma sem nome', detalhe: arma.campos.dano ? `Dano ${arma.campos.dano}` : undefined }))}
          limite={combateDasArmas.limiteDeArmas}
          escolhidas={combateDasArmas.armas}
          onConfirmar={(armas) => conexao.escolherArmas(armasDe_, armas)}
          onFechar={() => {
            dispensadas.current.add(armasDe_)
            setArmasDe(null)
          }}
        />
      )}
      <AvisoDaRecusa recusa={recusa} />

    </>
  )
}
