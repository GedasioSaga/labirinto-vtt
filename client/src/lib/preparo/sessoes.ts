import { compararTitulos, ordemDe } from './enciclopedia'
import { alvoDaForma, alvoDaSecao, alvoDoVerbete, paraDe, type ParaQuem } from './revelado'
import { ARQUIVO_DO_TEMPO, LIGA_CENA, LIGA_FICHA, PECAS_DO_TEXTO } from './tipos'
import type { Acontecimento, AlvoDaRevelacao, DadosDaSessao, Evento, Forma, LigaCena, LigaFicha, ParaRevelar, Revelacao, Tempo, TextoRico, Verbete } from './tipos'

/**
 * AS SESSÕES (plano §1, F4), sem tela: a ordem, o "Revelar hoje", o "O que
 * aconteceu" que vira evento da linha do tempo e os links do roteiro para a
 * mesa (cena, pino e ficha). Funções puras: a tela e o Livro do mestre usam as
 * mesmas.
 */

// ─── Ordem ───────────────────────────────────────────────────────────────────

const SEM_DADOS: DadosDaSessao = Object.freeze({ revelarHoje: [], aconteceu: [] }) as DadosDaSessao

export function dadosDaSessao(sessao: Verbete): DadosDaSessao {
  return sessao.sessao ?? SEM_DADOS
}

/** As sessões da primeira à última: a ordem gravada, senão o nome ("Sessão 2" antes de "Sessão 10"). `campanhaId` nulo = de todas. */
export function sessoesEmOrdem(verbetes: Iterable<Verbete>, campanhaId: string | null): Verbete[] {
  const sessoes: Verbete[] = []
  for (const verbete of verbetes) if (verbete.tipo === 'sessao' && (campanhaId === null || verbete.campanhas.includes(campanhaId))) sessoes.push(verbete)
  return sessoes.sort((a, b) => (ordemDe(a) ?? Infinity) - (ordemDe(b) ?? Infinity) || compararTitulos(a.titulo, b.titulo))
}

/** "Sessão 4" quando já há 3: o nome da próxima. */
export function nomeDaProximaSessao(sessoes: readonly Verbete[]): string {
  return `Sessão ${sessoes.length + 1}`
}

/** As páginas de dentro da sessão, na ordem (o roteiro que veio do Grimório mora nelas). */
export function paginasDaSessao(sessao: Verbete, verbetes: ReadonlyMap<string, Verbete>): Verbete[] {
  const paginas: Verbete[] = []
  for (const verbete of verbetes.values()) if (verbete.paiId === sessao.id && verbete.tipo === 'pagina') paginas.push(verbete)
  return paginas.sort((a, b) => (ordemDe(a) ?? Infinity) - (ordemDe(b) ?? Infinity) || compararTitulos(a.titulo, b.titulo))
}

// ─── Revelar hoje ────────────────────────────────────────────────────────────

/** A forma que o Revelar usa: a escolhida no item, senão a ativa. */
export function formaParaRevelar(verbete: Verbete, item: Pick<ParaRevelar, 'formaId'>): Forma | undefined {
  return verbete.formas.find((forma) => forma.id === item.formaId) ?? verbete.formas.find((forma) => forma.id === verbete.formaAtivaId) ?? verbete.formas[0]
}

/** O que o Revelar de um item muda de uma vez: o verbete, a forma e as seções comuns dela. Seção de segredo nunca. */
export function alvosParaRevelar(verbete: Verbete, item: Pick<ParaRevelar, 'formaId'>): AlvoDaRevelacao[] {
  const forma = formaParaRevelar(verbete, item)
  const alvos = [alvoDoVerbete(verbete.id)]
  if (forma === undefined) return alvos
  alvos.push(alvoDaForma(verbete.id, forma.id))
  for (const secao of forma.secoes) if (!secao.segredo) alvos.push(alvoDaSecao(verbete.id, forma.id, secao.id))
  return alvos
}

export type SituacaoDoItem =
  /** Nada do item chega ao jogador. */
  | { readonly t: 'oculto' }
  /** O verbete e tudo o que o item revela, para `para` (o do verbete). */
  | { readonly t: 'revelado'; readonly para: ParaQuem }
  /** O verbete foi revelado, mas a forma ou alguma seção comum ainda não. */
  | { readonly t: 'parte'; readonly para: ParaQuem }

export function situacaoDoItem(verbete: Verbete, item: Pick<ParaRevelar, 'formaId'>, porAlvo: ReadonlyMap<string, Revelacao>): SituacaoDoItem {
  const [doVerbete, ...partes] = alvosParaRevelar(verbete, item)
  const para = doVerbete === undefined ? null : paraDe(porAlvo, doVerbete)
  if (para === null) return { t: 'oculto' }
  return partes.every((alvo) => paraDe(porAlvo, alvo) !== null) ? { t: 'revelado', para } : { t: 'parte', para }
}

/** Põe um verbete no fim da lista (ele já estando, nada muda). */
export function comParaRevelar(dados: DadosDaSessao, verbeteId: string): DadosDaSessao {
  if (dados.revelarHoje.some((item) => item.verbeteId === verbeteId)) return dados
  return { ...dados, revelarHoje: [...dados.revelarHoje, { verbeteId, para: 'todos' }] }
}

// ─── O que aconteceu ─────────────────────────────────────────────────────────

/**
 * O evento que a linha "O que aconteceu" vira, com o mesmo id dela. A linha do
 * tempo (F7) ainda não existe: o evento nasce sem data (era vazia, ano 0) e
 * com o nome da sessão no rótulo, para a F7 pôr na era certa depois.
 */
export function eventoDoAcontecimento(acontecimento: Acontecimento, sessao: Verbete): Evento {
  return { id: acontecimento.id, titulo: acontecimento.texto.trim(), quando: { era: '', ano: 0, rotulo: sessao.titulo.trim() || 'Sessão sem nome' }, verbetes: [], resumo: '', segredo: false, sessaoId: sessao.id }
}

export function tempoVazio(): Tempo {
  return { formato: ARQUIVO_DO_TEMPO.formato, eras: [], faixas: [], eventos: [] }
}

/** O tempo com o evento (o de mesmo id é trocado, no mesmo lugar). */
export function comEvento(tempo: Tempo, evento: Evento): Tempo {
  const existe = tempo.eventos.some((outro) => outro.id === evento.id)
  return { ...tempo, eventos: existe ? tempo.eventos.map((outro) => (outro.id === evento.id ? evento : outro)) : [...tempo.eventos, evento] }
}

export function semEvento(tempo: Tempo, eventoId: string): Tempo {
  return tempo.eventos.some((evento) => evento.id === eventoId) ? { ...tempo, eventos: tempo.eventos.filter((evento) => evento.id !== eventoId) } : tempo
}

// ─── Links para a mesa ───────────────────────────────────────────────────────

/**
 * Para onde aponta um link do roteiro (o nó `ligacaoMesa`): a cena ou o pino de
 * um mapa (`sceneId` vazio = mapa sem cenas), ou a ficha de uma pasta. Sempre
 * por id: o que sumiu aparece como "não existe mais", nunca como erro.
 */
export type AlvoNaMesa = ({ readonly tipo: 'cena' } & LigaCena) | ({ readonly tipo: 'ficha' } & LigaFicha)

/** Lê o `attrs.alvo` de um nó; o que não é cena nem ficha vira `null`. */
export function alvoDaMesa(bruto: unknown): AlvoNaMesa | null {
  const cena = LIGA_CENA.ler(bruto, 'alvo')
  if (cena.ok) {
    const { chave, sceneId, pinoId } = cena.valor
    return pinoId === undefined || pinoId === '' ? { tipo: 'cena', chave, sceneId } : { tipo: 'cena', chave, sceneId, pinoId }
  }
  const ficha = LIGA_FICHA.ler(bruto, 'alvo')
  return ficha.ok ? { tipo: 'ficha', pastaId: ficha.valor.pastaId, personagemId: ficha.valor.personagemId } : null
}

/** O que vai para `attrs.alvo`: só os campos da cena ou da ficha. */
export function alvoParaGravar(alvo: AlvoNaMesa): LigaCena | LigaFicha {
  if (alvo.tipo === 'ficha') return { pastaId: alvo.pastaId, personagemId: alvo.personagemId }
  return alvo.pinoId === undefined ? { chave: alvo.chave, sceneId: alvo.sceneId } : { chave: alvo.chave, sceneId: alvo.sceneId, pinoId: alvo.pinoId }
}

/** Os links para a mesa de um texto, em ordem, sem repetir. */
export function ligacoesDaMesa(texto: TextoRico | null | undefined): AlvoNaMesa[] {
  const achados = new Map<string, AlvoNaMesa>()
  const andar = (no: unknown): void => {
    if (typeof no !== 'object' || no === null) return
    const registro = no as { type?: unknown; attrs?: { alvo?: unknown }; content?: unknown }
    if (registro.type === PECAS_DO_TEXTO.ligacaoMesa) {
      const alvo = alvoDaMesa(registro.attrs?.alvo)
      if (alvo !== null) achados.set(JSON.stringify(alvoParaGravar(alvo)), alvo)
      return
    }
    if (Array.isArray(registro.content)) for (const filho of registro.content) andar(filho)
  }
  andar(texto)
  return [...achados.values()]
}
