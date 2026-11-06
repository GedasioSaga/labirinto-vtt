import { segmentoValido } from '../../lib/nuvem/caminho'
import { ehRegistro, proprio } from '../../lib/nuvem/json'
import { personagemDoArquivo, type Personagem } from '../../lib/personagem'
import type { DueloNoFio, FimDoDuelo, JogadorDoDuelo } from '../../lib/treino/duelo'
import type { ContaNoDuelo, ConviteDoDuelo, FimDoConvite, MensagemDoDueloDoServidor, MotivoDoDueloRecusado, TipoDoPedidoDoDuelo } from '../../lib/treino/dueloDoLobby'
import { GRADE_DO_TREINO, type CasaDoTreino, type LadoDoTreino, type VagaDoTreino } from '../../lib/treino/mesaEmMemoria'
import type { DueloRecebido } from '../../lib/treino/vistaDoDuelo'
import { lerEstadoParaJogador } from '../../net/protocoloDaBatalha'

/**
 * LEITURA DOS FRAMES DO DUELO (`duelo.*`, fatia T7): o que o DO Campanha manda
 * do duelo (`lib/treino/dueloDoLobby.ts`) é conferido aqui antes de chegar à
 * tela, como os frames do chat e do mural. A forma de fora (ids, contas,
 * vagas, fichas, a vez e o registro) é conferida; o miolo da batalha vem do
 * motor do próprio servidor (`duelo.ts`) e a tela só o lê. `null` = fora do formato.
 *
 * Fatia M2: cada duelo chega com a VISTA do lado desta conta (o recorte do HUD
 * da Arena), lida inteira pelo mesmo leitor do `batalha.estado` do app
 * (`lerEstadoParaJogador`, tetos e forma campo a campo). Ela é opcional na
 * leitura (`lerDueloDoLado`): faltando ou torta, o duelo entra sem ela.
 */

const MOTIVOS: readonly MotivoDoDueloRecusado[] = [
  'formato',
  'nao-existe',
  'ocupado',
  'fichas',
  'sistema',
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
]
const PEDIDOS: readonly (TipoDoPedidoDoDuelo | 'duelo')[] = ['duelo', 'duelo.convidar', 'duelo.aceitar', 'duelo.recusar', 'duelo.jogar', 'duelo.desistir']
const FINS_DO_CONVITE: readonly FimDoConvite[] = ['recusado', 'desistiu', 'expirou', 'fichas']

function ehInteiro(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function ehLado(valor: unknown): valor is LadoDoTreino {
  return valor === 'a' || valor === 'b'
}

function daLista<T>(lista: readonly T[], valor: unknown): T | null {
  return lista.find((item) => item === valor) ?? null
}

function lerConta(bruto: unknown): ContaNoDuelo | null {
  if (!ehRegistro(bruto)) return null
  const contaId = proprio(bruto, 'contaId')
  const nome = proprio(bruto, 'nome')
  return segmentoValido(contaId) && typeof nome === 'string' ? { contaId, nome } : null
}

function lerIds(bruto: unknown): string[] | null {
  if (!Array.isArray(bruto)) return null
  const ids: string[] = []
  for (const id of bruto) {
    if (!segmentoValido(id)) return null
    ids.push(id)
  }
  return ids
}

function lerConvite(bruto: unknown): ConviteDoDuelo | null {
  if (!ehRegistro(bruto)) return null
  const id = proprio(bruto, 'id')
  const de = lerConta(proprio(bruto, 'de'))
  const para = lerConta(proprio(bruto, 'para'))
  const fichasDe = lerIds(proprio(bruto, 'fichasDe'))
  const criadoEm = proprio(bruto, 'criadoEm')
  const venceEm = proprio(bruto, 'venceEm')
  if (!segmentoValido(id) || de === null || para === null || fichasDe === null || !ehInteiro(criadoEm) || !ehInteiro(venceEm)) return null
  return { id, de, para, fichasDe, criadoEm, venceEm }
}

function lerJogador(bruto: unknown): JogadorDoDuelo | null {
  const conta = lerConta(bruto)
  if (conta === null || !ehRegistro(bruto)) return null
  const ausenteDesde = proprio(bruto, 'ausenteDesde')
  if (ausenteDesde !== null && !ehInteiro(ausenteDesde)) return null
  return { ...conta, ausenteDesde }
}

function lerFim(bruto: unknown): FimDoDuelo | null | undefined {
  if (bruto === null) return null
  if (!ehRegistro(bruto)) return undefined
  const tipo = proprio(bruto, 'tipo')
  const vencedor = proprio(bruto, 'vencedor')
  switch (tipo) {
    case 'vitoria':
      return ehLado(vencedor) ? { tipo, vencedor } : undefined
    case 'desistencia':
      return ehLado(vencedor) ? { tipo, vencedor } : undefined
    case 'ausencia':
      return vencedor === null || ehLado(vencedor) ? { tipo, vencedor } : undefined
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

function lerVaga(bruto: unknown): VagaDoTreino | null {
  if (!ehRegistro(bruto)) return null
  const id = proprio(bruto, 'id')
  const lado = proprio(bruto, 'lado')
  const personagemId = proprio(bruto, 'personagemId')
  const tokenId = proprio(bruto, 'tokenId')
  const origem = proprio(bruto, 'origem')
  if (!segmentoValido(id) || !ehLado(lado) || !segmentoValido(personagemId) || !segmentoValido(tokenId) || typeof origem !== 'string') return null
  return { id, lado, personagemId, tokenId, origem }
}

function lerLutadores(bruto: unknown): DueloNoFio['lutadores'] | null {
  if (!ehRegistro(bruto)) return null
  const vagasBrutas = proprio(bruto, 'vagas')
  const personagensBrutos = proprio(bruto, 'personagens')
  if (!Array.isArray(vagasBrutas) || !Array.isArray(personagensBrutos)) return null
  const vagas: VagaDoTreino[] = []
  for (const vaga of vagasBrutas) {
    const lida = lerVaga(vaga)
    if (lida === null) return null
    vagas.push(lida)
  }
  const personagens: Personagem[] = []
  for (const ficha of personagensBrutos) {
    const lida = personagemDoArquivo(ficha)
    if (lida === null) return null
    personagens.push(lida)
  }
  return { vagas, personagens }
}

/** Uma casa da grade: coluna e linha inteiras dentro de `GRADE_DO_TREINO`. */
function lerCasa(bruto: unknown): CasaDoTreino | null {
  if (!ehRegistro(bruto)) return null
  const col = proprio(bruto, 'col')
  const row = proprio(bruto, 'row')
  if (!ehInteiro(col) || !ehInteiro(row) || col >= GRADE_DO_TREINO.colunas || row >= GRADE_DO_TREINO.linhas) return null
  return { col, row }
}

/** A casa de cada vaga, pelo id do token: toda vaga tem a sua (fora disso, o duelo está fora do formato). */
function lerPosicoes(bruto: unknown, vagas: readonly VagaDoTreino[]): DueloNoFio['posicoes'] | null {
  if (!ehRegistro(bruto)) return null
  const posicoes = new Map<string, CasaDoTreino>()
  for (const { tokenId } of vagas) {
    const casa = lerCasa(proprio(bruto, tokenId))
    if (casa === null) return null
    posicoes.set(tokenId, casa)
  }
  return Object.fromEntries(posicoes)
}

function lerRegistro(bruto: unknown): DueloNoFio['registro'] | null {
  if (!Array.isArray(bruto)) return null
  const linhas: DueloNoFio['registro'][number][] = []
  for (const linha of bruto) {
    if (!ehRegistro(linha)) return null
    const id = proprio(linha, 'id')
    const rodada = proprio(linha, 'rodada')
    const autor = proprio(linha, 'autor')
    const texto = proprio(linha, 'texto')
    if (typeof id !== 'string' || !ehInteiro(rodada) || typeof autor !== 'string' || typeof texto !== 'string') return null
    linhas.push({ id, rodada, autor, texto, podeDesfazer: false })
  }
  return linhas
}

/** O duelo como o servidor o manda (`dueloParaOFio`). */
export function lerDueloNoFio(bruto: unknown): DueloNoFio | null {
  if (!ehRegistro(bruto)) return null
  const versao = proprio(bruto, 'versao')
  const id = proprio(bruto, 'id')
  const seq = proprio(bruto, 'seq')
  const fim = lerFim(proprio(bruto, 'fim'))
  const jogadores = proprio(bruto, 'jogadores')
  const a = ehRegistro(jogadores) ? lerJogador(proprio(jogadores, 'a')) : null
  const b = ehRegistro(jogadores) ? lerJogador(proprio(jogadores, 'b')) : null
  const lutadores = lerLutadores(proprio(bruto, 'lutadores'))
  const posicoes = lutadores === null ? null : lerPosicoes(proprio(bruto, 'posicoes'), lutadores.vagas)
  const turnos = proprio(bruto, 'turnos')
  const regras = proprio(bruto, 'regras')
  const efeitos = proprio(bruto, 'efeitos')
  const registro = lerRegistro(proprio(bruto, 'registro'))
  if (!ehInteiro(versao) || !segmentoValido(id) || !ehInteiro(seq) || fim === undefined || a === null || b === null || lutadores === null || posicoes === null || registro === null) return null
  if (!ehRegistro(turnos) || !Array.isArray(proprio(turnos, 'cartas')) || !ehInteiro(proprio(turnos, 'rodada'))) return null
  if (regras !== null && !ehRegistro(regras)) return null
  if (!Array.isArray(efeitos)) return null
  // O Worker de antes do `montar` não manda a montagem: sem ela, a tela não monta (false).
  const montagem = proprio(bruto, 'montagem') === true
  // O miolo (cartas, golpes, selos, combate) é do motor do servidor: a tela só lê, nunca manda de volta.
  return { versao, id, seq, fim, jogadores: { a, b }, lutadores, posicoes, montagem, turnos: turnos as unknown as DueloNoFio['turnos'], regras: regras as DueloNoFio['regras'], efeitos: efeitos as DueloNoFio['efeitos'], registro }
}

/**
 * O duelo do lado desta conta (`dueloParaOLado`): o fio e a vista dela. A
 * vista é opcional: sem ela (o Worker de antes da M2) ou torta, o duelo entra
 * com `vista` null, sem o HUD da Arena. Recusar o duelo recusaria o
 * `duelo.lista` inteiro, e o frame torto fecha a conexão da campanha
 * (`fonteReal`), que voltaria a receber a mesma lista sem fim.
 */
export function lerDueloDoLado(bruto: unknown): DueloRecebido | null {
  const duelo = lerDueloNoFio(bruto)
  if (duelo === null || !ehRegistro(bruto)) return null
  return { ...duelo, vista: lerEstadoParaJogador(proprio(bruto, 'vista')) }
}

function lerLista<T>(bruto: unknown, ler: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(bruto)) return null
  const lista: T[] = []
  for (const item of bruto) {
    const lido = ler(item)
    if (lido === null) return null
    lista.push(lido)
  }
  return lista
}

/** Um frame `duelo.*` do servidor; `null` = fora do formato. */
export function lerFrameDoDuelo(bruto: Record<string, unknown>): MensagemDoDueloDoServidor | null {
  const t = proprio(bruto, 't')
  switch (t) {
    case 'duelo.convite': {
      const convite = lerConvite(proprio(bruto, 'convite'))
      return convite === null ? null : { t, convite }
    }
    case 'duelo.fechado': {
      const id = proprio(bruto, 'id')
      const motivo = daLista(FINS_DO_CONVITE, proprio(bruto, 'motivo'))
      return segmentoValido(id) && motivo !== null ? { t, id, motivo } : null
    }
    case 'duelo.estado': {
      const duelo = lerDueloDoLado(proprio(bruto, 'duelo'))
      return duelo === null ? null : { t, duelo }
    }
    case 'duelo.lista': {
      const convites = lerLista(proprio(bruto, 'convites'), lerConvite)
      const duelos = lerLista(proprio(bruto, 'duelos'), lerDueloDoLado)
      return convites === null || duelos === null ? null : { t, convites, duelos }
    }
    case 'duelo.recusado': {
      const pedido = daLista(PEDIDOS, proprio(bruto, 'pedido'))
      const motivo = daLista(MOTIVOS, proprio(bruto, 'motivo'))
      const id = proprio(bruto, 'id')
      const tentarDepoisDe = proprio(bruto, 'tentarDepoisDe')
      if (pedido === null || motivo === null) return null
      if (id !== undefined && !segmentoValido(id)) return null
      if (tentarDepoisDe !== undefined && !ehInteiro(tentarDepoisDe)) return null
      return { t, pedido, motivo, ...(id === undefined ? {} : { id }), ...(tentarDepoisDe === undefined ? {} : { tentarDepoisDe }) }
    }
    default:
      return null
  }
}
