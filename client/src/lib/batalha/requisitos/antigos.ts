import type { CartaoDaFicha, Personagem } from '../../personagem'
import { chaveDaFicha } from '../alcance/antigos'
import { acumuladorGuardado, marcasGuardadas, requisitosGuardados } from './guardados'
import { lerAcumulador, lerRequisitos } from './ler'

/**
 * OS ANTIGOS SEM REQUISITOS (fase H, docs/design/habilidades/REQUISITOS.md §11; decisão do dono de
 * 23/11: "Eu monto e você confere"). Os cartões de antes dizem o requisito só no texto e nos extras
 * ("Nível de Polaridade: 2", "Condições do Evolution", "Gasta 10 SP por turno"). O Claude lê cada
 * cartão e propõe o bloco (`requisitos-propostos.json`, fora do repo); o mestre confere a lista e só
 * o Confirmar grava. O texto e os extras ficam onde estão: o bloco é a regra, o texto continua para ler.
 *
 * Uma proposta põe até três coisas num cartão de ficha: o bloco `requisitos`, as `marcas` ("Fogo") e
 * a definição do `acumulador` (a Polaridade do Vagn). Cada uma só entra se o cartão ainda não a tem:
 * o que o mestre já montou no editor nunca é trocado daqui. Só fichas: nenhuma proposta de agora é de
 * entrada do livro ou de item do Acervo (o `rpg.json` é o único arquivo que muda).
 *
 * Aqui a parte pura: QUEM falta, a gravação e a volta (o Desfazer). A ordem no disco e a cópia de
 * antes ficam em `stores/requisitosDosAntigos.ts`. Puro: sem store, sem rede, sem disco.
 */

/** O arquivo da proposta, na pasta de dados do app (nunca no repo: o texto é da campanha). */
export const ARQUIVO_DAS_PROPOSTAS = 'requisitos-propostos.json'

/** Até quantas letras do texto a lista mostra e a proposta guarda. */
export const TRECHO_MAX = 320

export type CertezaDaProposta = 'alta' | 'baixa'

/** As três coisas que uma proposta grava num cartão, na ordem em que entram no disco. */
export type ParteDaProposta = 'requisitos' | 'marcas' | 'acumulador'
export const PARTES_DA_PROPOSTA: readonly ParteDaProposta[] = ['requisitos', 'marcas', 'acumulador']

/** O que se grava (ou se tinha) num cartão: as três chaves opcionais do `CartaoDaFicha`. */
export type ConteudoDosRequisitos = Pick<CartaoDaFicha, ParteDaProposta>

export interface PropostaDeRequisitos extends ConteudoDosRequisitos {
  /** `ficha:<pasta>:<personagem>:<cartão>`: a mesma chave do "Dar alcance aos antigos". */
  chave: string
  nome: string
  certeza: CertezaDaProposta
  /** O pedaço do texto que justifica a proposta. */
  trecho: string
  /** O porquê em uma frase, quando a leitura não é óbvia ("o Overload já limita a 1 por batalha"). */
  nota?: string
}

/** O cartão que o Claude leu e para o qual não propôs bloco: a lista mostra o porquê (já vale por outro caminho, ou não cabe). */
export interface LidoSemBloco {
  chave: string
  nome: string
  personagemNome?: string
  porque: string
}

export interface PropostasDoArquivo {
  propostas: ReadonlyMap<string, PropostaDeRequisitos>
  semBloco: readonly LidoSemBloco[]
}

export const SEM_ARQUIVO: PropostasDoArquivo = { propostas: new Map(), semBloco: [] }

export interface DadosDosAntigos {
  /** A pasta aberta (`null` = nenhuma: nada a propor nem a gravar). */
  pastaId: string | null
  personagens: readonly Personagem[]
}

/** Um cartão com proposta que ainda falta gravar (no todo ou em parte). */
export interface AntigoComProposta {
  chave: string
  personagemId: string
  personagemNome: string
  cartaoId: string
  nome: string
  /** A aba de onde o cartão vem (a de cima, para o subcartão): a forma mostra "Para ligar". */
  aba: string
  /** A descrição, os campos e os extras, numa linha, até `TRECHO_MAX`. */
  texto: string
  proposta: PropostaDeRequisitos
  /** As partes da proposta que o cartão ainda não tem (as outras ficam como estão). */
  faltam: readonly ParteDaProposta[]
}

export interface ListaDosAntigos {
  antigos: AntigoComProposta[]
  /** As propostas cujo cartão já tem tudo (gravado antes, ou montado no editor). */
  jaFeitos: number
  /** As propostas cujo cartão sumiu da ficha (apagado depois da leitura). */
  semCartao: { chave: string; nome: string }[]
  /** Lidos sem bloco, só os da pasta aberta. */
  semBloco: LidoSemBloco[]
}

function ehRegistro(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** A descrição primeiro, depois os outros campos e os extras (`nome: valor`), numa linha. */
function textoDoCartao(cartao: CartaoDaFicha): string {
  const campos = Object.entries(cartao.campos)
    .filter(([chave, valor]) => chave !== 'descricao' && valor.trim() !== '')
    .map(([chave, valor]) => `${chave}: ${valor.trim()}`)
  const extras = cartao.extras.filter((extra) => extra.valor.trim() !== '').map((extra) => `${extra.nome.trim()}: ${extra.valor.trim()}`)
  const junto = [(cartao.campos.descricao ?? '').trim(), ...campos, ...extras]
    .filter((parte) => parte !== '')
    .join(' | ')
    .replace(/\s+/g, ' ')
  return junto.length > TRECHO_MAX ? `${junto.slice(0, TRECHO_MAX - 1)}…` : junto
}

/** Cada cartão da ficha (abas e subcartões, a fundo), com a aba de cima. */
function cadaCartao(personagem: Personagem, ver: (cartao: CartaoDaFicha, aba: string) => void): void {
  const descer = (cartao: CartaoDaFicha, aba: string): void => {
    ver(cartao, aba)
    for (const sub of cartao.subcartoes) descer(sub, aba)
  }
  for (const [aba, cartoes] of Object.entries(personagem.abas)) for (const cartao of cartoes) descer(cartao, aba)
}

/** A ficha com cada cartão passado por `mudar` (`null` = fica igual). Nada mudou = a MESMA ficha (e as mesmas listas). */
function comOsCartoes(personagem: Personagem, mudar: (cartao: CartaoDaFicha) => CartaoDaFicha | null): Personagem {
  const naLista = (cartoes: readonly CartaoDaFicha[]): readonly CartaoDaFicha[] => {
    let trocou = false
    const novos = cartoes.map((cartao) => {
      const subcartoes = cartao.subcartoes.length === 0 ? cartao.subcartoes : naLista(cartao.subcartoes)
      const base = subcartoes === cartao.subcartoes ? cartao : { ...cartao, subcartoes: [...subcartoes] }
      const novo = mudar(base) ?? base
      if (novo !== cartao) trocou = true
      return novo
    })
    return trocou ? novos : cartoes
  }
  let abas = personagem.abas
  for (const [aba, cartoes] of Object.entries(personagem.abas)) {
    const novos = naLista(cartoes)
    if (novos !== cartoes) abas = { ...abas, [aba]: [...novos] }
  }
  return abas === personagem.abas ? personagem : { ...personagem, abas }
}

/** O cartão `cartaoId` da ficha (em qualquer aba ou subcartão); `null` = não está nela. */
export function cartaoDaFicha(personagem: Personagem, cartaoId: string): CartaoDaFicha | null {
  let achado: CartaoDaFicha | null = null
  cadaCartao(personagem, (cartao) => {
    if (achado === null && cartao.id === cartaoId) achado = cartao
  })
  return achado
}

/** A ficha com o cartão `cartaoId` trocado por `novo` (a lista da tela edita uma cópia em memória). */
export function fichaComOCartao(personagem: Personagem, cartaoId: string, novo: CartaoDaFicha): Personagem {
  return comOsCartoes(personagem, (cartao) => (cartao.id === cartaoId ? novo : null))
}

/** O cartão como fica com a proposta: as partes que faltam postas no fim (em memória, para a lista mostrar e editar). */
export function cartaoComAProposta(cartao: CartaoDaFicha, antigo: Pick<AntigoComProposta, 'proposta' | 'faltam'>): CartaoDaFicha {
  return { ...cartao, ...soAsPartes(antigo.proposta, antigo.faltam) }
}

/** As partes que a proposta traz e o cartão ainda não tem. */
function partesQueFaltam(cartao: CartaoDaFicha, conteudo: ConteudoDosRequisitos): ParteDaProposta[] {
  return PARTES_DA_PROPOSTA.filter((parte) => conteudo[parte] !== undefined && cartao[parte] === undefined)
}

/**
 * Os cartões das fichas da pasta aberta que têm proposta e ainda não têm o que ela grava. A proposta
 * de outra pasta (ou de livro e Acervo) não entra: não há o que gravar nela daqui.
 */
export function antigosComProposta(dados: DadosDosAntigos, doArquivo: PropostasDoArquivo): ListaDosAntigos {
  const { pastaId } = dados
  const vazia: ListaDosAntigos = { antigos: [], jaFeitos: 0, semCartao: [], semBloco: [] }
  if (pastaId === null) return vazia
  const prefixo = `ficha:${pastaId}:`
  const antigos: AntigoComProposta[] = []
  const achadas = new Set<string>()
  let jaFeitos = 0
  for (const personagem of dados.personagens) {
    cadaCartao(personagem, (cartao, aba) => {
      const chave = chaveDaFicha(pastaId, personagem.id, cartao.id)
      const proposta = doArquivo.propostas.get(chave)
      if (proposta === undefined || achadas.has(chave)) return
      achadas.add(chave)
      const faltam = partesQueFaltam(cartao, proposta)
      if (faltam.length === 0) {
        jaFeitos += 1
        return
      }
      antigos.push({ chave, personagemId: personagem.id, personagemNome: personagem.nome, cartaoId: cartao.id, nome: cartao.nome, aba, texto: textoDoCartao(cartao), proposta, faltam })
    })
  }
  const semCartao = [...doArquivo.propostas.values()].filter((proposta) => proposta.chave.startsWith(prefixo) && !achadas.has(proposta.chave)).map((proposta) => ({ chave: proposta.chave, nome: proposta.nome }))
  const semBloco = doArquivo.semBloco.filter((lido) => lido.chave.startsWith(prefixo))
  return { antigos, jaFeitos, semCartao, semBloco }
}

// ─── Gravar e desfazer ──────────────────────────────────────────────────────

/** O que o Confirmar grava num cartão: as partes aceitas (talvez mudadas na lista). */
export interface EscolhaDosRequisitos extends ConteudoDosRequisitos {
  chave: string
}

/** O que cada cartão tinha antes e o que o Confirmar pôs: o Desfazer só volta o que ainda é o que ele pôs. */
export interface AntesDosRequisitos {
  chave: string
  /** As partes que o Confirmar gravou (cada uma estava ausente antes). */
  gravadas: readonly ParteDaProposta[]
  /** O valor gravado de cada parte, para o Desfazer saber se o mestre mexeu depois. */
  gravado: ConteudoDosRequisitos
}

export interface RequisitosGravados {
  personagens: Personagem[]
  /** Os cartões que mudaram de verdade (o sumido, ou o que já tinha tudo, não conta). */
  antes: AntesDosRequisitos[]
}

/** Só o JSON (ordem das chaves inclusive): o valor gravado e o de agora são o mesmo. */
function mesmoValor(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** O conteúdo pronto para o disco, pelos mesmos leitores do cartão: o que não vale sai (a parte fica fora). */
export function conteudoGuardado(conteudo: { requisitos?: unknown; marcas?: unknown; acumulador?: unknown }): ConteudoDosRequisitos {
  const requisitos = conteudo.requisitos === undefined ? undefined : requisitosGuardados(conteudo.requisitos)
  const marcas = conteudo.marcas === undefined ? undefined : marcasGuardadas(conteudo.marcas)
  const acumulador = conteudo.acumulador === undefined ? undefined : acumuladorGuardado(conteudo.acumulador)
  // O bloco e o acumulador só entram se este app os lê inteiros (torto ou de app mais novo não se grava daqui).
  const lido = requisitos === undefined ? null : lerRequisitos(requisitos)
  const acumuladorLido = acumulador === undefined ? null : lerAcumulador(acumulador)
  const conteudoBom: ConteudoDosRequisitos = {}
  if (requisitos !== undefined && lido !== null && lido.bloco !== null && !lido.deAppNovo) conteudoBom.requisitos = requisitos
  if (marcas !== undefined) conteudoBom.marcas = marcas
  if (acumulador !== undefined && acumuladorLido !== null && acumuladorLido.acumulador !== null && !acumuladorLido.deAppNovo) conteudoBom.acumulador = acumulador
  return conteudoBom
}

/** Só as `partes` do conteúdo, na ordem de `PARTES_DA_PROPOSTA` (a ordem em que entram no fim do cartão). */
function soAsPartes(conteudo: ConteudoDosRequisitos, partes: readonly ParteDaProposta[]): ConteudoDosRequisitos {
  const so: ConteudoDosRequisitos = {}
  if (partes.includes('requisitos') && conteudo.requisitos !== undefined) so.requisitos = conteudo.requisitos
  if (partes.includes('marcas') && conteudo.marcas !== undefined) so.marcas = conteudo.marcas
  if (partes.includes('acumulador') && conteudo.acumulador !== undefined) so.acumulador = conteudo.acumulador
  return so
}

/** O cartão sem as `partes` (as outras chaves ficam na ordem em que estavam: o disco volta a sair igual). */
function semAsPartes(cartao: CartaoDaFicha, partes: readonly ParteDaProposta[]): CartaoDaFicha {
  const sem: CartaoDaFicha = { ...cartao }
  for (const parte of partes) delete sem[parte]
  return sem
}

/** GRAVAR: cada escolha no seu cartão, só nas partes que ele ainda não tem (no fim do cartão). Puro. */
export function comOsRequisitos(dados: DadosDosAntigos, escolhas: readonly EscolhaDosRequisitos[]): RequisitosGravados {
  const { pastaId } = dados
  if (pastaId === null) return { personagens: [...dados.personagens], antes: [] }
  const porChave = new Map(escolhas.map((escolha) => [escolha.chave, escolha]))
  const antes: AntesDosRequisitos[] = []
  const personagens = dados.personagens.map((personagem) =>
    comOsCartoes(personagem, (cartao) => {
      const chave = chaveDaFicha(pastaId, personagem.id, cartao.id)
      const escolha = porChave.get(chave)
      if (escolha === undefined || antes.some((era) => era.chave === chave)) return null
      const conteudo = conteudoGuardado(escolha)
      const gravadas = partesQueFaltam(cartao, conteudo)
      if (gravadas.length === 0) return null
      const gravado = soAsPartes(conteudo, gravadas)
      antes.push({ chave, gravadas, gravado })
      return { ...cartao, ...gravado }
    }),
  )
  return { personagens, antes }
}

/** DESFAZER: tira de cada cartão as partes que o Confirmar pôs, se ainda são as que ele pôs (a ordem das outras chaves fica). Puro. */
export function semOsRequisitos(dados: DadosDosAntigos, antes: readonly AntesDosRequisitos[]): RequisitosGravados {
  const { pastaId } = dados
  if (pastaId === null) return { personagens: [...dados.personagens], antes: [] }
  const porChave = new Map(antes.map((era) => [era.chave, era]))
  const desfeitos: AntesDosRequisitos[] = []
  const personagens = dados.personagens.map((personagem) =>
    comOsCartoes(personagem, (cartao) => {
      const chave = chaveDaFicha(pastaId, personagem.id, cartao.id)
      const era = porChave.get(chave)
      if (era === undefined) return null
      const tirar = era.gravadas.filter((parte) => cartao[parte] !== undefined && mesmoValor(cartao[parte], era.gravado[parte]))
      if (tirar.length === 0) return null
      desfeitos.push({ chave, gravadas: tirar, gravado: soAsPartes(cartao, tirar) })
      return semAsPartes(cartao, tirar)
    }),
  )
  return { personagens, antes: desfeitos }
}

// ─── O arquivo da proposta ──────────────────────────────────────────────────

function propostaLida(valor: unknown): PropostaDeRequisitos | null {
  if (!ehRegistro(valor) || typeof valor.chave !== 'string' || typeof valor.nome !== 'string') return null
  const conteudo = conteudoGuardado(valor)
  if (PARTES_DA_PROPOSTA.every((parte) => conteudo[parte] === undefined)) return null
  const certeza: CertezaDaProposta = valor.certeza === 'alta' ? 'alta' : 'baixa'
  const trecho = typeof valor.trecho === 'string' ? valor.trecho.slice(0, TRECHO_MAX) : ''
  const nota = typeof valor.nota === 'string' && valor.nota.trim() !== '' ? valor.nota.trim().slice(0, TRECHO_MAX) : undefined
  return { chave: valor.chave, nome: valor.nome, certeza, trecho, ...(nota === undefined ? {} : { nota }), ...conteudo }
}

function lidoSemBloco(valor: unknown): LidoSemBloco | null {
  if (!ehRegistro(valor) || typeof valor.chave !== 'string' || typeof valor.nome !== 'string' || typeof valor.porque !== 'string') return null
  const pessoa = typeof valor.personagemNome === 'string' ? { personagemNome: valor.personagemNome } : {}
  return { chave: valor.chave, nome: valor.nome, porque: valor.porque.slice(0, TRECHO_MAX), ...pessoa }
}

/**
 * A proposta lida do arquivo (`{ formato: 1, propostas: [...], semBloco: [...] }`), pela chave.
 * Tolerante: a linha torta (sem chave, bloco que este app não lê inteiro) é ignorada; numa linha boa,
 * a parte torta sai e as outras ficam.
 */
export function propostasDoArquivo(valor: unknown): PropostasDoArquivo {
  const propostas = new Map<string, PropostaDeRequisitos>()
  const semBloco: LidoSemBloco[] = []
  if (!ehRegistro(valor)) return { propostas, semBloco }
  if (Array.isArray(valor.propostas)) {
    for (const bruta of valor.propostas) {
      const lida = propostaLida(bruta)
      if (lida !== null && !propostas.has(lida.chave)) propostas.set(lida.chave, lida)
    }
  }
  if (Array.isArray(valor.semBloco)) {
    for (const bruto of valor.semBloco) {
      const lido = lidoSemBloco(bruto)
      if (lido !== null) semBloco.push(lido)
    }
  }
  return { propostas, semBloco }
}
