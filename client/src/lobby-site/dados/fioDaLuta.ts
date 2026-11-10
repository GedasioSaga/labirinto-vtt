import { GRADES_DA_ARENA, type TamanhoDaGrade } from '../../lib/arena/grade'
import type { LinhaParaJogador } from '../../lib/batalha/registro'
import { segmentoValido } from '../../lib/nuvem/caminho'
import { ehRegistro, proprio } from '../../lib/nuvem/json'
import { personagemDoArquivo, type Personagem } from '../../lib/personagem'
import type { FimDaLutaV4, MarcoDaLuta, ModoDaLuta, PapelNaLuta, ParticipanteDaLuta } from '../../lib/treino/luta'
import type {
  ContaNaLuta,
  EsperaDaLuta,
  FimDaEspera,
  LadoComContas,
  LadoNoHistorico,
  LutaAcontecendo,
  LutaNoHistorico,
  MensagemDaLutaDoServidor,
  MotivoDaLutaRecusada,
  TipoDoPedidoDaLuta,
  VagaNaEspera,
} from '../../lib/treino/lutaDoLobby'
import { LADOS_DA_LUTA, type CasaDoTreino, type LadoDaLuta, type VagaDaLuta } from '../../lib/treino/mesaEmMemoria'
import type { LutaDaConta, OlharNaLuta } from '../../lib/treino/vistaDaLuta'
import { lerEstadoParaJogador, MOTIVO_DA_RECUSA_MAX } from '../../net/protocoloDaBatalha'
import type { EstadoParaJogador } from '../../lib/batalha/vistaDoJogador'

/**
 * LEITURA DOS FRAMES DA LUTA (`luta.*`, Arena multijogador F5): o que o DO
 * Campanha manda da luta de N lados (`lib/treino/lutaDoLobby.ts`, F4) é
 * conferido aqui antes de chegar à tela, como os do duelo (`fioDoDuelo.ts`).
 *
 * Ao contrário da base, frame torto da luta NÃO derruba o canal: vira
 * `luta.torta`, que a tela ignora com um aviso. O site novo pede `luta.lista`
 * a cada volta, e um frame que ele não lê voltaria a cada reconexão, sem fim.
 * Pelo mesmo motivo, item torto numa lista sai da lista em vez de recusá-la,
 * e a vista (o HUD) torta deixa a luta sem HUD (`vista` null), como no duelo.
 */

/** A luta como esta conta a recebe, com a vista opcional (torta ou ausente = sem o HUD). */
export type LutaRecebida = Omit<LutaDaConta, 'vista'> & { vista: EstadoParaJogador | null }

/** Os frames da luta como o site os guarda: os do servidor (com a luta recebida) e o torto. */
export type MensagemDaLutaNoSite =
  | Exclude<MensagemDaLutaDoServidor, { t: 'luta.estado' }>
  | { t: 'luta.estado'; luta: LutaRecebida }
  | { t: 'luta.torta' }

const PAPEIS: readonly PapelNaLuta[] = ['jogador', 'juiz', 'arbitro', 'espectador']
const OLHARES: readonly OlharNaLuta[] = ['jogador', 'assistindo', 'arbitro']
const FINS_DA_ESPERA: readonly FimDaEspera[] = ['desistiu', 'expirou', 'recusou', 'semVoce']
const MOTIVOS: readonly MotivoDaLutaRecusada[] = [
  'formato',
  'nao-existe',
  'ocupado',
  'fichas',
  'sistema',
  'papel',
  'lados',
  'cheia',
  'so-criador',
  'ritmo',
  'cota',
  'versao',
  'acabou',
  'naoJoga',
  'seqVelho',
  'naoEDaConta',
  'surpresa',
  'danoAMao',
  'foraDoDuelo',
  'regra',
  'pausada',
  'naoArbitra',
]
const PEDIDOS: readonly (TipoDoPedidoDaLuta | 'luta')[] = [
  'luta',
  'luta.criar',
  'luta.aceitar',
  'luta.recusar',
  'luta.comecar',
  'luta.jogar',
  'luta.arbitrar',
  'luta.sair',
  'luta.assistir',
  'luta.parar',
  'luta.lista',
  'luta.historico',
]
const MOTIVOS_DO_HISTORICO: readonly LutaNoHistorico['motivo'][] = ['vitoria', 'todosCaidos', 'tempo', 'arbitro', 'ausencia', 'desistencia']
const TORTA = { t: 'luta.torta' } as const

function ehInteiro(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function daLista<T>(lista: readonly T[], valor: unknown): T | null {
  return lista.find((item) => item === valor) ?? null
}

function lerLado(valor: unknown): LadoDaLuta | null {
  return daLista(LADOS_DA_LUTA, valor)
}

function lerModo(valor: unknown): ModoDaLuta | null {
  return valor === 'times' || valor === 'todos' ? valor : null
}

/** Lado ou `null` legível; `undefined` = torto. */
function lerLadoOuNulo(valor: unknown): LadoDaLuta | null | undefined {
  if (valor === null) return null
  return lerLado(valor) ?? undefined
}

/** A lista sem os itens tortos (eles saem, a lista fica). Não é lista = `null`. */
function semOsTortos<T>(bruto: unknown, ler: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(bruto)) return null
  return bruto.flatMap((item) => {
    const lido = ler(item)
    return lido === null ? [] : [lido]
  })
}

function lerIds(bruto: unknown): string[] | null {
  if (!Array.isArray(bruto) || !bruto.every(segmentoValido)) return null
  return [...bruto]
}

function lerConta(bruto: unknown): ContaNaLuta | null {
  if (!ehRegistro(bruto)) return null
  const contaId = proprio(bruto, 'contaId')
  const nome = proprio(bruto, 'nome')
  return segmentoValido(contaId) && typeof nome === 'string' ? { contaId, nome } : null
}

function lerVagaNaEspera(bruto: unknown): VagaNaEspera | null {
  const conta = lerConta(bruto)
  if (conta === null || !ehRegistro(bruto)) return null
  const papel = daLista(PAPEIS, proprio(bruto, 'papel'))
  const lado = lerLadoOuNulo(proprio(bruto, 'lado'))
  const aceitou = proprio(bruto, 'aceitou')
  const fichas = lerIds(proprio(bruto, 'fichas'))
  if (papel === null || lado === undefined || typeof aceitou !== 'boolean' || fichas === null) return null
  return { ...conta, papel, lado, aceitou, fichas }
}

function lerLados(bruto: unknown): LadoDaLuta[] | null {
  if (!Array.isArray(bruto)) return null
  const lados = bruto.map(lerLado)
  return lados.every((lado): lado is LadoDaLuta => lado !== null) ? lados : null
}

export function lerEsperaDaLuta(bruto: unknown): EsperaDaLuta | null {
  if (!ehRegistro(bruto)) return null
  const id = proprio(bruto, 'id')
  const criador = lerConta(proprio(bruto, 'criador'))
  const modo = lerModo(proprio(bruto, 'modo'))
  const lados = lerLados(proprio(bruto, 'lados'))
  const contas = semOsTortos(proprio(bruto, 'contas'), lerVagaNaEspera)
  const criadoEm = proprio(bruto, 'criadoEm')
  const venceEm = proprio(bruto, 'venceEm')
  if (!segmentoValido(id) || criador === null || modo === null || lados === null || contas === null || !ehInteiro(criadoEm) || !ehInteiro(venceEm)) return null
  return { id, criador, modo, lados, contas, criadoEm, venceEm }
}

function lerLadoComContas(bruto: unknown): LadoComContas | null {
  if (!ehRegistro(bruto)) return null
  const lado = lerLado(proprio(bruto, 'lado'))
  const contas = semOsTortos(proprio(bruto, 'contas'), lerConta)
  return lado === null || contas === null ? null : { lado, contas }
}

function lerAcontecendo(bruto: unknown): LutaAcontecendo | null {
  if (!ehRegistro(bruto)) return null
  const id = proprio(bruto, 'id')
  const modo = lerModo(proprio(bruto, 'modo'))
  const lados = semOsTortos(proprio(bruto, 'lados'), lerLadoComContas)
  const rodada = proprio(bruto, 'rodada')
  const assistindo = proprio(bruto, 'assistindo')
  const vagas = proprio(bruto, 'vagas')
  const pausada = proprio(bruto, 'pausada')
  if (!segmentoValido(id) || modo === null || lados === null || !ehInteiro(rodada) || !ehInteiro(assistindo) || typeof vagas !== 'number' || !Number.isSafeInteger(vagas)) return null
  return { id, modo, lados, rodada, assistindo, vagas: Math.max(0, vagas), pausada: pausada === true }
}

function lerRegistro(bruto: unknown): LinhaParaJogador[] | null {
  if (!Array.isArray(bruto)) return null
  const linhas: LinhaParaJogador[] = []
  for (const linha of bruto) {
    if (!ehRegistro(linha)) return null
    const id = proprio(linha, 'id')
    const rodada = proprio(linha, 'rodada')
    const autor = proprio(linha, 'autor')
    const texto = proprio(linha, 'texto')
    if (typeof id !== 'string' || !ehInteiro(rodada) || typeof autor !== 'string' || typeof texto !== 'string') return null
    const desfeita = proprio(linha, 'desfeita')
    const por = ehRegistro(desfeita) ? proprio(desfeita, 'por') : undefined
    linhas.push({ id, rodada, autor, texto, podeDesfazer: proprio(linha, 'podeDesfazer') === true, ...(typeof por === 'string' ? { desfeita: { por } } : {}) })
  }
  return linhas
}

function lerLadoNoHistorico(bruto: unknown): LadoNoHistorico | null {
  const lado = lerLadoComContas(bruto)
  if (lado === null || !ehRegistro(bruto)) return null
  const fichas = proprio(bruto, 'fichas')
  return Array.isArray(fichas) && fichas.every((nome) => typeof nome === 'string') ? { ...lado, fichas: [...fichas] } : null
}

function lerDoHistorico(bruto: unknown): LutaNoHistorico | null {
  if (!ehRegistro(bruto)) return null
  const id = proprio(bruto, 'id')
  const fim = proprio(bruto, 'fim')
  const modoBruto = proprio(bruto, 'modo')
  const modo = modoBruto === 'duelo' ? 'duelo' : lerModo(modoBruto)
  const lados = semOsTortos(proprio(bruto, 'lados'), lerLadoNoHistorico)
  const vencedor = lerLadoOuNulo(proprio(bruto, 'vencedor'))
  const motivo = daLista(MOTIVOS_DO_HISTORICO, proprio(bruto, 'motivo'))
  const rodadas = proprio(bruto, 'rodadas')
  const brutoDoRegistro = proprio(bruto, 'registro')
  const registro = brutoDoRegistro === undefined ? undefined : lerRegistro(brutoDoRegistro)
  if (!segmentoValido(id) || !ehInteiro(fim) || modo === null || lados === null || vencedor === undefined || motivo === null || !ehInteiro(rodadas)) return null
  return { id, fim, modo, lados, vencedor, motivo, rodadas, ...(registro === undefined || registro === null ? {} : { registro }) }
}

function lerParticipante(bruto: unknown): ParticipanteDaLuta | null {
  const conta = lerConta(bruto)
  if (conta === null || !ehRegistro(bruto)) return null
  const papel = daLista(PAPEIS, proprio(bruto, 'papel'))
  const lado = lerLadoOuNulo(proprio(bruto, 'lado'))
  const ausenteDesde = proprio(bruto, 'ausenteDesde')
  if (papel === null || lado === undefined || (ausenteDesde !== null && !ehInteiro(ausenteDesde))) return null
  return { ...conta, papel, lado, ausenteDesde, ...(proprio(bruto, 'robo') === true ? { robo: true } : {}) }
}

function lerVaga(bruto: unknown): VagaDaLuta | null {
  if (!ehRegistro(bruto)) return null
  const id = proprio(bruto, 'id')
  const lado = lerLado(proprio(bruto, 'lado'))
  const personagemId = proprio(bruto, 'personagemId')
  const tokenId = proprio(bruto, 'tokenId')
  const origem = proprio(bruto, 'origem')
  const contaId = proprio(bruto, 'contaId')
  if (!segmentoValido(id) || lado === null || !segmentoValido(personagemId) || !segmentoValido(tokenId) || typeof origem !== 'string') return null
  if (contaId !== undefined && !segmentoValido(contaId)) return null
  return {
    id,
    lado,
    personagemId,
    tokenId,
    origem,
    ...(proprio(bruto, 'reage') === 'parado' ? { reage: 'parado' as const } : {}),
    ...(contaId === undefined ? {} : { contaId }),
    ...(proprio(bruto, 'fora') === true ? { fora: true as const } : {}),
  }
}

function lerFim(bruto: unknown): FimDaLutaV4 | null | undefined {
  if (bruto === null) return null
  if (!ehRegistro(bruto)) return undefined
  const tipo = proprio(bruto, 'tipo')
  const vencedor = proprio(bruto, 'vencedor')
  switch (tipo) {
    case 'vitoria': {
      const lado = lerLado(vencedor)
      return lado === null ? undefined : { tipo, vencedor: lado }
    }
    case 'arbitro': {
      const lado = lerLadoOuNulo(vencedor)
      return lado === undefined ? undefined : { tipo, vencedor: lado }
    }
    case 'todosCaidos':
      return { tipo }
    case 'tempo': {
      const teto = proprio(bruto, 'teto')
      return teto === 'rodadas' || teto === 'passos' ? { tipo, teto } : undefined
    }
    default:
      return undefined
  }
}

function lerMarco(bruto: unknown): MarcoDaLuta | null {
  if (!ehRegistro(bruto)) return null
  const seq = proprio(bruto, 'seq')
  const tipo = proprio(bruto, 'tipo')
  const quando = proprio(bruto, 'quando')
  if (!ehInteiro(seq) || !ehInteiro(quando) || (tipo !== 'pausar' && tipo !== 'retomar' && tipo !== 'encerrar')) return null
  return { seq, tipo, quando }
}

/** A casa de cada vaga que tem a sua, dentro da grade da luta (a vaga sem casa fica fora da grade, não derruba a luta). */
function lerPosicoes(bruto: unknown, vagas: readonly VagaDaLuta[], tamanho: TamanhoDaGrade): Record<string, CasaDoTreino> | null {
  if (!ehRegistro(bruto)) return null
  const grade = GRADES_DA_ARENA[tamanho]
  const posicoes: Record<string, CasaDoTreino> = {}
  for (const { tokenId } of vagas) {
    const casa = proprio(bruto, tokenId)
    if (!ehRegistro(casa)) continue
    const col = proprio(casa, 'col')
    const row = proprio(casa, 'row')
    if (ehInteiro(col) && ehInteiro(row) && col < grade.colunas && row < grade.linhas) posicoes[tokenId] = { col, row }
  }
  return posicoes
}

function lerLutadores(bruto: unknown): LutaDaConta['lutadores'] | null {
  if (!ehRegistro(bruto)) return null
  const vagas = semOsTortos(proprio(bruto, 'vagas'), lerVaga)
  const personagens = semOsTortos(proprio(bruto, 'personagens'), (ficha): Personagem | null => personagemDoArquivo(ficha))
  return vagas === null || personagens === null ? null : { vagas, personagens }
}

/** A luta desta conta (`lutaParaAConta`); `null` = fora do formato. */
export function lerLutaRecebida(bruto: unknown): LutaRecebida | null {
  if (!ehRegistro(bruto)) return null
  const versao = proprio(bruto, 'versao')
  const id = proprio(bruto, 'id')
  const modo = lerModo(proprio(bruto, 'modo'))
  const seq = proprio(bruto, 'seq')
  const fim = lerFim(proprio(bruto, 'fim'))
  const participantes = semOsTortos(proprio(bruto, 'participantes'), lerParticipante)
  const lutadores = lerLutadores(proprio(bruto, 'lutadores'))
  const tamanhoBruto = proprio(bruto, 'tamanho')
  const tamanho: TamanhoDaGrade | null = tamanhoBruto === 'pequena' || tamanhoBruto === 'media' ? tamanhoBruto : null
  const posicoes = lutadores === null || tamanho === null ? null : lerPosicoes(proprio(bruto, 'posicoes'), lutadores.vagas, tamanho)
  const turnos = proprio(bruto, 'turnos')
  const regras = proprio(bruto, 'regras')
  const efeitos = proprio(bruto, 'efeitos')
  const registro = lerRegistro(proprio(bruto, 'registro'))
  const olhar = daLista(OLHARES, proprio(bruto, 'olhar'))
  if (!ehInteiro(versao) || !segmentoValido(id) || modo === null || !ehInteiro(seq) || fim === undefined || participantes === null) return null
  if (lutadores === null || tamanho === null || posicoes === null || registro === null || olhar === null) return null
  if (!ehRegistro(turnos) || !Array.isArray(proprio(turnos, 'cartas')) || !ehInteiro(proprio(turnos, 'rodada'))) return null
  if ((regras !== null && !ehRegistro(regras)) || !Array.isArray(efeitos)) return null
  const marcos = semOsTortos(proprio(bruto, 'marcos'), lerMarco)
  return {
    versao,
    id,
    modo,
    seq,
    fim,
    participantes,
    lutadores,
    tamanho,
    posicoes,
    montagem: proprio(bruto, 'montagem') === true,
    // O miolo (cartas, golpes, selos, combate) é do motor do servidor: a tela só lê, nunca manda de volta.
    turnos: turnos as unknown as LutaDaConta['turnos'],
    regras: regras as LutaDaConta['regras'],
    efeitos: efeitos as LutaDaConta['efeitos'],
    registro,
    ...(proprio(bruto, 'pausada') === true ? { pausada: true as const } : {}),
    ...(marcos === null ? {} : { marcos }),
    olhar,
    vista: lerEstadoParaJogador(proprio(bruto, 'vista')),
  }
}

function lerRecusado(bruto: Record<string, unknown>): MensagemDaLutaNoSite {
  const pedido = daLista(PEDIDOS, proprio(bruto, 'pedido')) ?? 'luta'
  const motivo = daLista(MOTIVOS, proprio(bruto, 'motivo')) ?? 'formato'
  const id = proprio(bruto, 'id')
  const tentarDepoisDe = proprio(bruto, 'tentarDepoisDe')
  // O texto da regra (R1) é opcional: torto ou longo demais, fica só o código.
  const texto = proprio(bruto, 'texto')
  return {
    t: 'luta.recusado',
    pedido,
    motivo,
    ...(segmentoValido(id) ? { id } : {}),
    ...(ehInteiro(tentarDepoisDe) ? { tentarDepoisDe } : {}),
    ...(typeof texto === 'string' && texto.length > 0 && texto.length <= MOTIVO_DA_RECUSA_MAX ? { texto } : {}),
  }
}

/** Um frame `luta.*` do servidor. Nunca `null`: o torto vira `luta.torta` (o canal segue). */
export function lerFrameDaLuta(bruto: Record<string, unknown>): MensagemDaLutaNoSite {
  const t = proprio(bruto, 't')
  switch (t) {
    case 'luta.espera': {
      const espera = lerEsperaDaLuta(proprio(bruto, 'espera'))
      return espera === null ? TORTA : { t, espera }
    }
    case 'luta.fechada': {
      const id = proprio(bruto, 'id')
      const motivo = daLista(FINS_DA_ESPERA, proprio(bruto, 'motivo'))
      return segmentoValido(id) && motivo !== null ? { t, id, motivo } : TORTA
    }
    case 'luta.estado': {
      const luta = lerLutaRecebida(proprio(bruto, 'luta'))
      return luta === null ? TORTA : { t, luta }
    }
    case 'luta.lista': {
      const convites = semOsTortos(proprio(bruto, 'convites'), lerEsperaDaLuta)
      const acontecendo = semOsTortos(proprio(bruto, 'acontecendo'), lerAcontecendo)
      return convites === null || acontecendo === null ? TORTA : { t, convites, acontecendo }
    }
    case 'luta.historico': {
      const lista = semOsTortos(proprio(bruto, 'lista'), lerDoHistorico)
      const temMais = proprio(bruto, 'temMais')
      return lista === null ? TORTA : { t, lista, temMais: temMais === true }
    }
    case 'luta.recusado':
      return lerRecusado(bruto)
    default:
      return TORTA
  }
}
