import type { Json } from '../../lib/nuvem/json'
import { CONTA_DO_MESTRE, type MembroProjetado, type MotivoNegado, type Op, type OpGravada } from '../../lib/nuvem/tipos'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'

/**
 * OS TEXTOS DAS TELAS do site do Lobby (fatia S3), puros: o nome de cada
 * campo do caminho, a frase do histórico ("Rafa (mestre) mudou HP de 34 para
 * 30"), o motivo de uma recusa em português e as horas relativas. As telas só
 * montam; quem decide o que dizer é este arquivo.
 */

const MINUTO_MS = 60_000
const DIA_MS = 24 * 60 * MINUTO_MS
/** Texto longo no histórico e no aviso: cortado aqui, com reticências. */
const TEXTO_CURTO_MAX = 40

const NOME_DO_MAPA: Readonly<Record<string, string>> = {
  maximos: 'Máximo de',
  modificadoresDosRecursos: 'Modificador do máximo de',
  modificadoresDosAtributos: 'Modificador de',
}

export function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`
}

export function iniciais(nome: string): string {
  const partes = nome.split(/\s+/).filter((parte) => parte !== '')
  return partes
    .slice(0, 2)
    .map((parte) => parte[0] ?? '')
    .join('')
    .toUpperCase()
}

/** Um dos cinco tons do protótipo, estável por id (a mesma pessoa tem sempre a mesma cor). */
export function tomDe(id: string): number {
  let soma = 0
  for (let i = 0; i < id.length; i += 1) soma = (soma * 31 + id.charCodeAt(i)) % 9973
  return soma % 5
}

function horaEMinuto(t: number): string {
  return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function inicioDoDia(t: number): number {
  const dia = new Date(t)
  dia.setHours(0, 0, 0, 0)
  return dia.getTime()
}

/** "agora", "há 6 min", "hoje às 21:40", "ontem às 22:05", "24/10 às 20:15". */
export function quandoRelativo(t: number, agora: number): string {
  const segundos = Math.round((agora - t) / 1000)
  if (segundos < 45) return 'agora'
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `há ${minutos} min`
  const hoje = inicioDoDia(agora)
  if (t >= hoje) return `hoje às ${horaEMinuto(t)}`
  if (t >= hoje - DIA_MS) return `ontem às ${horaEMinuto(t)}`
  const data = new Date(t)
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')} às ${horaEMinuto(t)}`
}

/** O título do grupo de dias do histórico: "Hoje", "Ontem", "sexta-feira, 24 de outubro". */
export function nomeDoDia(t: number, agora: number): string {
  const hoje = inicioDoDia(agora)
  if (t >= hoje) return 'Hoje'
  if (t >= hoje - DIA_MS) return 'Ontem'
  const texto = new Date(t).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * "Mestre Ana. " no alto da mesa. O nome que já começa com a palavra "Mestre"
 * vai sozinho: "Mestre. " e "Mestre Gedásio. ", nunca "Mestre Mestre. ".
 */
export function apresentacaoDoMestre(nome: string): string {
  const limpo = nome.trim()
  return /^mestre(\s|$)/i.test(limpo) ? `${limpo}. ` : `Mestre ${limpo}. `
}

export function horaExata(t: number): string {
  return new Date(t).toLocaleString('pt-BR')
}

/** Um valor da op como a tela mostra: número com milhar, texto entre aspas e curto, item pelo nome. */
export function valorEmTexto(valor: Json | undefined): string {
  if (valor === undefined || valor === null) return 'vazio'
  if (typeof valor === 'number') return valor.toLocaleString('pt-BR')
  if (typeof valor === 'boolean') return valor ? 'ligado' : 'desligado'
  if (typeof valor === 'string') return `“${valor.length > TEXTO_CURTO_MAX ? `${valor.slice(0, TEXTO_CURTO_MAX)}…` : valor}”`
  if (Array.isArray(valor)) return plural(valor.length, 'item', 'itens')
  const nome = valor.nome
  return typeof nome === 'string' ? nome : 'um bloco'
}

function cartaoDe(doc: Personagem | undefined, aba: string, cartaoId: string): { nome: string } | undefined {
  return doc?.abas[aba]?.find((cartao) => cartao.id === cartaoId)
}

function nomeDoItem(doc: Personagem | undefined, vagaId: string, valor: Json | undefined, antes: Json | undefined): string {
  const naMochila = doc?.mochila?.find((item) => item.id === vagaId)
  if (naMochila !== undefined) return naMochila.nome
  for (const candidato of [valor, antes]) {
    if (candidato !== null && typeof candidato === 'object' && !Array.isArray(candidato) && typeof candidato.nome === 'string') return candidato.nome
  }
  return 'um item'
}

/**
 * O nome do campo que o caminho muda, para a frase: "HP", "Força", "Poção de
 * maré", "Descrição de Corte de Maré". `doc` é a ficha como a tela tem agora
 * (o item ou o cartão pode já ter saído: aí o nome vem do valor da op).
 */
export function rotuloDoCaminho(sistema: SistemaDeRpg, doc: Personagem | undefined, caminho: readonly string[], valor?: Json, antes?: Json): string {
  const [topo, a, b, c, d] = caminho
  switch (topo) {
    case undefined:
      return 'a ficha inteira'
    case 'nome':
      return 'Nome'
    case 'descricao':
      return 'Descrição'
    case 'retrato':
      return 'Retrato'
    case 'moedas':
      return 'Moedas'
    case 'etiquetas':
      return a === undefined ? 'Etiquetas' : `Etiqueta ${a}`
    case 'escolhas':
      return sistema.escolhas.find((escolha) => escolha.id === a)?.rotulo ?? 'Escolha'
    case 'recursos':
      return sistema.recursos.find((recurso) => recurso.id === a)?.nome ?? 'Recurso'
    case 'atributos':
      return sistema.atributos.find((atributo) => atributo.id === a)?.nome ?? 'Atributo'
    case 'maximos':
    case 'modificadoresDosRecursos':
      return `${NOME_DO_MAPA[topo]} ${sistema.recursos.find((recurso) => recurso.id === a)?.nome ?? 'recurso'}`
    case 'modificadoresDosAtributos':
      return `${NOME_DO_MAPA[topo]} ${sistema.atributos.find((atributo) => atributo.id === a)?.nome ?? 'atributo'}`
    case 'cartoesAtivos': {
      const ligado = Object.keys(doc?.abas ?? {}).flatMap((aba) => (a === undefined ? [] : [cartaoDe(doc, aba, a)]))
      return ligado.find((cartao) => cartao !== undefined)?.nome ?? 'Transformação'
    }
    case 'mochila':
      return a === undefined ? 'Mochila' : nomeDoItem(doc, a, valor, antes)
    case 'abas': {
      const nomeDaAba = sistema.abas.find((aba) => aba.id === a)?.nome ?? 'Aba'
      if (b === undefined || b === '#ordem') return nomeDaAba
      const cartao = a === undefined ? undefined : cartaoDe(doc, a, b)
      const nomeDoCartao = cartao?.nome ?? nomeDoItem(undefined, b, valor, antes)
      if (c === undefined) return nomeDoCartao
      if (c === 'campos') {
        const campo = sistema.abas.find((aba) => aba.id === a)?.campos.find((candidato) => candidato.id === d)
        return `${campo?.rotulo ?? 'Campo'} de ${nomeDoCartao}`
      }
      return c === 'nome' ? `Nome de ${nomeDoCartao}` : nomeDoCartao
    }
    default:
      return 'Campo do mestre'
  }
}

/** "Rafa (mestre)", "Você", "Caio". */
export function nomeDoAutor(op: Pick<OpGravada, 'autorContaId' | 'autorNome'>, eu: MembroProjetado | null): string {
  if (eu !== null && op.autorContaId === eu.contaId) return 'Você'
  return op.autorContaId === CONTA_DO_MESTRE ? `${op.autorNome} (mestre)` : op.autorNome
}

/** O que a frase do histórico diz, em partes (a tela põe o negrito). */
export interface FraseDaOp {
  quem: string
  /** "mudou", "pôs", "tirou", "somou", "desfez a mudança em"... */
  verbo: string
  /** O campo, o item ou a ficha. */
  alvo: string
  /** "de 34 para 30", "(3)" — vazio quando não cabe. */
  resto: string
  /** Aumento na mochila ou nas moedas: o mestre revisa (12.3). */
  aumento: boolean
}

export function fraseDaOp(op: OpGravada, rotulo: string, eu: MembroProjetado | null, desfeitaPeloAlvo: boolean): FraseDaOp {
  const quem = op.atestadoPeloApp ? `${nomeDoAutor(op, eu)}, na mesa` : nomeDoAutor(op, eu)
  if (op.desfaz !== undefined) return { quem, verbo: desfeitaPeloAlvo ? 'refez a mudança em' : 'desfez a mudança em', alvo: rotulo, resto: '', aumento: false }
  const naMochila = op.caminho[0] === 'mochila'
  switch (op.acao) {
    case 'definir':
      return { quem, verbo: 'mudou', alvo: rotulo, resto: `de ${valorEmTexto(op.antes)} para ${valorEmTexto(op.valor)}`, aumento: false }
    case 'somar': {
      const delta = op.delta ?? 0
      if (op.caminho[0] === 'moedas') return { quem, verbo: delta >= 0 ? 'somou' : 'tirou', alvo: 'moedas', resto: Math.abs(delta).toLocaleString('pt-BR'), aumento: delta > 0 }
      return { quem, verbo: delta >= 0 ? 'pôs' : 'tirou', alvo: rotulo, resto: Math.abs(delta).toLocaleString('pt-BR'), aumento: naMochila && delta > 0 }
    }
    case 'criar':
      return { quem, verbo: naMochila ? 'pôs na mochila' : 'criou', alvo: rotulo, resto: '', aumento: naMochila }
    case 'apagar':
      return { quem, verbo: naMochila ? 'tirou da mochila' : 'apagou', alvo: rotulo, resto: '', aumento: false }
    case 'ordenar':
      return { quem, verbo: 'reordenou', alvo: rotulo, resto: '', aumento: false }
  }
}

/** "de 34 → 30" ao lado da hora, só para número. */
export function deParaDaOp(op: OpGravada): string | null {
  if (op.acao === 'definir' && typeof op.antes === 'number' && typeof op.valor === 'number') return `${valorEmTexto(op.antes)} → ${valorEmTexto(op.valor)}`
  if (op.acao === 'somar' && typeof op.antes === 'number') return `${valorEmTexto(op.antes)} → ${valorEmTexto(op.antes + (op.delta ?? 0))}`
  return null
}

const MOTIVO_EM_TEXTO: Readonly<Record<MotivoNegado, string>> = {
  'fora-do-esquema': 'o valor não cabe neste campo',
  'sem-permissao': 'você não pode mudar esta ficha',
  'acima-do-teto': 'o valor passou do limite',
  midia: 'a imagem não foi aceita',
  'doc-grande': 'a ficha ficou grande demais',
  'base-invalida': 'a ficha que você via ficou velha',
  versao: 'o site está numa versão antiga (recarregue a página)',
  'alvo-inexistente': 'o que você mudou não existe mais',
  'nada-a-desfazer': 'não há mais nada a desfazer',
}

export function motivoEmTexto(motivo: MotivoNegado): string {
  return MOTIVO_EM_TEXTO[motivo]
}

/** O valor que a minha op punha no campo, para "Usar a minha (25)": soma mostra o "+1". */
export function valorDaMinha(op: Op): string {
  if (op.acao === 'somar') {
    const delta = op.delta ?? 0
    return `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('pt-BR')}`
  }
  if (op.acao === 'apagar') return 'tirar'
  return valorEmTexto(op.valor)
}
