import { fichasDaCena } from '../lib/dbt/batalha/leitura'
import { turnoNoM } from '../lib/dbt/batalha/ordem'
import type { AcaoDoMestreDBT, AutorDBT, ComandoDBT, CombatenteDBT, LinhaDBT, OpcaoDeAcao } from '../lib/dbt/batalha/tipos'
import { linhasDoMestre } from '../lib/dbt/batalha/vista'
import {
  avisosDoMestre,
  candidatosDoAlvo,
  cartasDaBatalha,
  linhaParaDesfazer,
  nomeDoCombatente,
  nomeDoLado,
  opcoesDaVez,
  opcoesDoMestre,
  quemResponde,
  tituloDaPendencia,
  type CartaDBT,
  type Fichas,
} from '../components/dbt/batalha/dadosDaBatalhaDBT'
import { itensDaCartaDoMestreDBT } from '../components/dbt/batalha/FaixaDoMestreDBT'
import { ladosDaBatalhaDBT } from '../components/dbt/batalha/OrdemDoMestreDBT'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { useBatalhaDBTStore, type CenaDBT } from '../stores/batalhaDBTStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { escolherItemDaCarta, itensNoEspelho } from './menuDaCartaNoEspelho'
import type { AlvoNoEspelho, CartaNoEspelho, EspelhoDaBatalha, GolpeNoEspelho, LinhaNoEspelho, PedidoDaMesa, PendenteNoEspelho, RecursoNoEspelho, RespostaDaMesa, VezNoEspelho } from './tipos'

/**
 * A MESA DA BATALHA no Dragon Ball: o espelho lido pelas mesmas funções do
 * painel do mestre (`cartasDaBatalha`, `opcoesDaVez`, `candidatosDoAlvo`,
 * `tituloDaPendencia`, `linhasDoMestre`) e os pedidos aplicados pelo
 * `comando` da `batalhaDBTStore`, como o mestre: o motor confere tudo e
 * devolve o motivo da recusa.
 */

const MESTRE: AutorDBT = { tipo: 'mestre' }
const LINHAS_NA_MESA = 60

const recusa = (motivo: string): RespostaDaMesa => ({ ok: false, motivo })
const OK: RespostaDaMesa = { ok: true, motivo: null }

/** Quando cada pendência começou a esperar (o motor não guarda a hora): visto pela primeira vez aqui. */
const vistaEm = new Map<string, number>()

function lerCena(sceneKey: string): CenaDBT | undefined {
  const cenas = useBatalhaDBTStore.getState().cenas
  return Object.hasOwn(cenas, sceneKey) ? cenas[sceneKey] : undefined
}

function fichasDe(cena: CenaDBT): Fichas {
  const aventura = useAdventureStore.getState()
  const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(aventura)) ?? null
  return fichasDaCena(personagensAtivos(aventura), sistema, Object.values(cena.combatentes))
}

/**
 * O menu da carta do mestre (o mesmo da faixa DBT: `itensDaCartaDoMestreDBT`) para estas cartas. `mestre`
 * é quem leva a ação ao motor: no espelho ninguém escolhe; no pedido, ele guarda a recusa.
 */
function menuDaCartaDBT(sceneKey: string, cena: CenaDBT, cartas: readonly CartaDBT[], mestre: (acao: AcaoDoMestreDBT) => boolean) {
  const personagemDe = (id: string) => (Object.hasOwn(cena.combatentes, id) ? cena.combatentes[id].personagemId : null)
  const combate = cena.fase === 'combate'
  const contexto = { cartas, combate, vez: combate ? (cena.ordem.vez ?? null) : null, personagemDe, mestre, lados: ladosDaBatalhaDBT(equipesAtivas(useAdventureStore.getState())) }
  return (carta: CartaDBT) => itensDaCartaDoMestreDBT(sceneKey, carta, personagemDe(carta.id), contexto)
}

function recursosDe(carta: CartaDBT | undefined): RecursoNoEspelho[] {
  if (carta === undefined) return []
  const lista: RecursoNoEspelho[] = []
  if (carta.pv !== null) lista.push({ rotulo: 'PV', atual: carta.pv.atual, maximo: carta.pv.max, tom: 'vida' })
  if (carta.pk !== null) lista.push({ rotulo: 'Ki', atual: carta.pk.atual, maximo: carta.pk.max, tom: 'energia' })
  return lista
}

const NOME_DA_SITUACAO = { 'de-pe': null, salvaguarda: 'Salvaguarda', inconsciente: 'Inconsciente', morto: 'Morto' } as const

function marcasDe(carta: CartaDBT): string[] {
  const marcas: string[] = []
  if (carta.transformacao !== null) marcas.push(carta.transformacao)
  const situacao = NOME_DA_SITUACAO[carta.situacao]
  if (situacao !== null) marcas.push(situacao)
  for (const condicao of carta.condicoes) marcas.push(condicao.nome)
  if (carta.voo > 0) marcas.push(`Voo ${carta.voo}`)
  if (carta.agarradoPor !== null) marcas.push(`Agarrado por ${carta.agarradoPor}`)
  if (carta.perdeTurno !== null) marcas.push(carta.perdeTurno)
  if (carta.manual) marcas.push('Sem ficha')
  return marcas
}

/** A chave da vez: rodada, combatente e quantos turnos ele já jogou (o mesmo combatente na rodada seguinte é outra vez). */
function chaveDe(cena: CenaDBT, vez: CombatenteDBT): string {
  return `${cena.ordem.rodada}:${vez.id}:${vez.turnosJogados}`
}

function vezDe(cena: CenaDBT): CombatenteDBT | null {
  const id = cena.ordem.vez
  return id !== null && Object.hasOwn(cena.combatentes, id) ? cena.combatentes[id] : null
}

function golpeNoEspelho(cena: CenaDBT, vez: CombatenteDBT, opcao: OpcaoDeAcao): GolpeNoEspelho {
  const custo = opcao.gratis ? 'grátis' : opcao.ki > 0 ? `${opcao.ki} Ki` : ''
  return {
    chave: opcao.chave,
    nome: opcao.rotulo,
    detalhe: [custo, opcao.alvo === 'nenhum' ? 'sem alvo' : opcao.alvosMax > 1 ? `até ${opcao.alvosMax} alvos` : null].filter((parte): parte is string => typeof parte === 'string' && parte !== '').join(' · '),
    motivo: opcao.bloqueio,
    noMapa: null,
    alvo: opcao.alvo === 'nenhum' ? 'nenhum' : opcao.alvosMax > 1 ? 'varios' : 'um',
    alvosMax: opcao.alvo === 'nenhum' ? 0 : opcao.alvosMax,
    alvosPermitidos: opcao.alvo === 'nenhum' ? [] : candidatosDoAlvo(cena, vez.id, opcao.alvo).map((candidato) => candidato.id),
    // O dano do Dragon Ball sai do dado e da ficha no motor: não há Dano base para ajustar daqui.
    dano: null,
    perfurante: false,
    ajustavel: false,
  }
}

/** As linhas que contam o que a vez fez; as de ordem e de ficha ficam só no registro. */
const LINHAS_DA_VEZ: ReadonlySet<LinhaDBT['tipo']> = new Set<LinhaDBT['tipo']>(['acao', 'tecnica', 'reacao', 'dano', 'cura', 'condicao', 'teste', 'transformacao', 'choque', 'morte'])
const FEITOS_NA_VEZ = 3

/** Quando a vez começou e o que ela já fez: as linhas depois da última "Vez" de pé (o registro vem da mais velha à mais nova). */
function oQueAVezFez(registro: readonly LinhaDBT[]): { desde: number | null; feitos: string[] } {
  let inicio = -1
  for (let indice = registro.length - 1; indice >= 0; indice -= 1) {
    const linha = registro[indice]
    if (linha !== undefined && linha.tipo === 'vez' && linha.desfeita === undefined) {
      inicio = indice
      break
    }
  }
  const desde = inicio >= 0 ? (registro[inicio]?.quando ?? null) : null
  const feitos = registro
    .slice(inicio + 1)
    .filter((linha) => linha.desfeita === undefined && LINHAS_DA_VEZ.has(linha.tipo))
    .map((linha) => linha.texto)
    .reverse()
    .slice(0, FEITOS_NA_VEZ)
  return { desde, feitos }
}

function vezNoEspelho(cena: CenaDBT, fichas: Fichas, cartas: readonly CartaDBT[], vez: CombatenteDBT): VezNoEspelho {
  const daVez = opcoesDaVez(cena, fichas)
  const opcoes = daVez !== null && daVez.id === vez.id ? daVez.opcoes : []
  const alvos: AlvoNoEspelho[] = Object.values(cena.combatentes).map((combatente) => {
    const carta = cartas.find((candidata) => candidata.id === combatente.id)
    const detalhe = carta === undefined || carta.manual ? 'sem ficha' : `CA ${carta.ca ?? 0}, EP ${carta.ep ?? 0}${carta.pv === null ? '' : `, PV ${carta.pv.atual}`}`
    return {
      id: combatente.id,
      nome: combatente.nome,
      lado: combatente.id === vez.id ? 'eu' : combatente.lado === vez.lado ? 'aliado' : 'outro',
      caiu: combatente.morte.situacao !== 'de-pe',
      motivo: null,
      detalhe,
    }
  })
  const pendente = cena.pendencias.length > 0
  return {
    chave: chaveDe(cena, vez),
    quem: vez.nome,
    npc: vez.npc,
    descricao: `${vez.npc ? 'NPC' : 'Jogador'} · lado ${nomeDoLado(vez.lado)}`,
    recursos: recursosDe(cartas.find((carta) => carta.id === vez.id)),
    golpes: opcoes.map((opcao) => golpeNoEspelho(cena, vez, opcao)),
    alvos,
    sugestao: { golpe: null, alvo: null },
    aviso: pendente ? 'Há um pedido esperando: as ações voltam quando ele for resolvido.' : vez.npc ? null : `${vez.nome} joga na tela própria; você pode agir por ele daqui.`,
    posicao: Math.max(0, cartas.findIndex((carta) => carta.id === vez.id)) + 1,
    ...oQueAVezFez(cena.registro),
    pips: [],
    menuDoMapa: false,
  }
}

function pendentesDe(cena: CenaDBT, fichas: Fichas): PendenteNoEspelho[] {
  const agora = Date.now()
  const ids = new Set(cena.pendencias.map((pendencia) => pendencia.id))
  for (const id of [...vistaEm.keys()]) if (!ids.has(id)) vistaEm.delete(id)
  return cena.pendencias.map((pendencia, indice) => {
    if (!vistaEm.has(pendencia.id)) vistaEm.set(pendencia.id, agora)
    const quemId = quemResponde(pendencia)
    const quem = quemId === null ? null : Object.hasOwn(cena.combatentes, quemId) ? cena.combatentes[quemId] : null
    const doMestre = quem === null || quem.npc
    const ativa = indice === 0
    const todas = ativa && pendencia.tipo !== 'declaracao' ? opcoesDoMestre(cena, fichas, pendencia) : []
    const daqui = todas.filter((opcao) => opcao.pede === null)
    return {
      id: pendencia.id,
      titulo: tituloDaPendencia(cena, pendencia),
      quem: quem === null ? 'Você' : quem.npc ? `${quem.nome} (NPC)` : `${nomeDoCombatente(cena, quem.id)} (jogador)`,
      doMestre,
      desde: vistaEm.get(pendencia.id) ?? null,
      ativa,
      respostas: daqui.map((opcao) => ({ chave: opcao.chave, rotulo: opcao.gratis || opcao.ki === 0 ? opcao.rotulo : `${opcao.rotulo} (${opcao.ki} Ki)`, bloqueio: opcao.bloqueio })),
      nota: !ativa ? 'Na fila: espera a de cima.' : pendencia.tipo === 'declaracao' ? 'Declarar a forma: no painel da batalha do livro.' : daqui.length < todas.length ? 'Respostas com aposta ou atributo: no painel da batalha do livro.' : null,
      golpe: null,
    }
  })
}

/** O espelho da batalha Dragon Ball da cena; `null` = a cena não está nela. */
export function espelhoDBT(sceneKey: string): EspelhoDaBatalha | null {
  const cena = lerCena(sceneKey)
  if (cena === undefined) return null
  const fichas = fichasDe(cena)
  const cartas = cartasDaBatalha(cena, fichas)
  const vez = vezDe(cena)
  const indiceDaVez = cartas.findIndex((carta) => carta.vez)
  const menuDe = menuDaCartaDBT(sceneKey, cena, cartas, () => false)
  const ordem: CartaNoEspelho[] = cartas.map((carta, indice) => ({
    id: carta.id,
    nome: carta.nome,
    npc: carta.npc,
    cor: null,
    lado: nomeDoLado(carta.lado),
    iniciativa: carta.iniciativa,
    recursos: recursosDe(carta),
    caiu: carta.situacao !== 'de-pe',
    vez: carta.vez,
    proxima: false,
    marcas: marcasDe(carta),
    posicao: indice + 1,
    agiu: cena.fase === 'combate' && indiceDaVez >= 0 && indice < indiceDaVez,
    menu: itensNoEspelho(menuDe(carta)),
  }))
  const linhas = linhasDoMestre(cena.registro)
  const registro: LinhaNoEspelho[] = linhas.slice(0, LINHAS_NA_MESA).map((linha) => ({ id: linha.id, rodada: linha.rodada, autor: linha.autor, texto: linha.texto, desfeita: linha.desfeitaPor !== null, podeDesfazer: linha.podeDesfazer }))
  const ultima = linhaParaDesfazer(cena.registro)
  const combate = cena.fase === 'combate'
  return {
    sistema: 'dbt',
    sceneKey,
    fase: cena.fase,
    rodada: cena.ordem.rodada,
    turno: combate ? turnoNoM(cena) : null,
    vez: combate && vez !== null ? vezNoEspelho(cena, fichas, cartas, vez) : null,
    ordem,
    pendentes: pendentesDe(cena, fichas),
    registro,
    desfazer: ultima === null ? null : { linhaId: ultima.id, texto: ultima.texto },
    podePassar: combate && vez !== null,
    avisoDoEncerrar: cena.opcoes.exaustao
      ? 'Encerrar aplica a exaustão do fim pela tabela padrão de cada ficha. Para revisar a tabela antes, encerre pelo livro.'
      : 'Encerrar desliga a batalha desta cena. As fichas ficam como estão.',
    avisos: avisosDoMestre(cena, fichas).map((aviso) => aviso.texto),
    contra: null,
    temCaminhos: Object.keys(cena.caminhos).length > 0,
    podeOrdenar: false,
    menuDoMapaAberto: false,
    chaves: null,
    deixados: [],
  }
}

function comando(sceneKey: string, cmd: ComandoDBT): RespostaDaMesa {
  const resposta = useBatalhaDBTStore.getState().comando(sceneKey, MESTRE, cmd)
  return resposta.ok ? OK : recusa(resposta.motivo ?? 'O motor recusou.')
}

/** Aplica um pedido da mesa na batalha Dragon Ball da cena. */
export function aplicarPedidoDBT(pedido: PedidoDaMesa): RespostaDaMesa {
  const { sceneKey } = pedido
  const cena = lerCena(sceneKey)
  if (cena === undefined) return recusa('A batalha desta cena já acabou.')
  const vez = vezDe(cena)
  switch (pedido.acao) {
    case 'passar':
      if (vez === null || chaveDe(cena, vez) !== pedido.vez) return recusa('A vez já mudou: confira a ordem.')
      return comando(sceneKey, { tipo: 'passar', vez: { combatenteId: vez.id, rodada: cena.ordem.rodada, turno: vez.turnosJogados } })
    case 'darVez':
      return comando(sceneKey, { tipo: 'mestre', acao: { tipo: 'darAVez', combatenteId: pedido.cartaId } })
    case 'itemDaCarta': {
      const cartas = cartasDaBatalha(cena, fichasDe(cena))
      const carta = cartas.find((candidata) => candidata.id === pedido.cartaId)
      if (carta === undefined) return recusa('Esta carta não está mais na batalha.')
      let recusou: string | null = null
      const mestre = (acao: AcaoDoMestreDBT) => {
        const resposta = comando(sceneKey, { tipo: 'mestre', acao })
        recusou = resposta.motivo
        return resposta.ok
      }
      return escolherItemDaCarta(menuDaCartaDBT(sceneKey, cena, cartas, mestre)(carta), pedido.item, () => recusou)
    }
    case 'agir':
      if (vez === null || chaveDe(cena, vez) !== pedido.vez) return recusa('A vez já mudou: confira a ordem.')
      return comando(sceneKey, { tipo: 'agir', combatenteId: vez.id, vez: { rodada: cena.ordem.rodada, turno: vez.turnosJogados }, opcao: pedido.golpe, alvos: [...new Set(pedido.alvos)] })
    case 'responder':
      return comando(sceneKey, { tipo: 'responder', pendenciaId: pedido.pendente, combatenteId: null, opcao: pedido.resposta })
    case 'desfazer':
      return useBatalhaDBTStore.getState().desfazer(sceneKey, pedido.linhaId, MESTRE) ? OK : recusa('Só a última linha de pé se desfaz: desfaça as de cima primeiro.')
    case 'iniciativa':
      return comando(sceneKey, pedido.passo === 'rolar' ? { tipo: 'rolarIniciativa' } : { tipo: 'comecar' })
    case 'contra':
    case 'abrirMao':
      return recusa('No Dragon Ball a ação a mais do erro crítico chega como pedido: responda nele.')
    case 'ordenar':
      return recusa('No Dragon Ball a ordem sai da iniciativa rolada.')
    case 'zerarCaminhos':
      useBatalhaDBTStore.getState().zerarCaminhos(sceneKey)
      return OK
    case 'menuDoMapa':
      return recusa('No Dragon Ball a vez inteira mora aqui e no painel do livro.')
    case 'chave':
      return recusa('No Dragon Ball não há câmera que segue a vez nem som do combate.')
    case 'seguir':
      // A fila do Dragon Ball só trava na mesa: o "Seguir sem esperar" fica nela, sem nada a guardar aqui.
      return OK
    case 'abrirLivro':
      return recusa('O livro abre pela janela principal.')
    case 'encerrar': {
      const loja = useBatalhaDBTStore.getState()
      loja.encerrar(sceneKey, cena.opcoes.exaustao ? loja.resumoDoFim(sceneKey) : null)
      return OK
    }
  }
}
