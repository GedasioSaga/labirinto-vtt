import { CATALOGOS_DO_LIVRO, type ChaveDoCatalogo } from './livroDeRegras'
import { novoPersonagem, type CartaoDaFicha, type Personagem } from './personagem'
import {
  CAPITULO_TEXTO_MAX,
  CAPITULO_TITULO_MAX,
  CATALOGO_ITENS_MAX,
  CATALOGO_NOME_MAX,
  CATALOGO_TEXTO_MAX,
  CATALOGOS_TEXTO_TOTAL_MAX,
  COR_PADRAO,
  corValida,
  FORMATO_DO_SISTEMA,
  idValido,
  lerSistemaDeRpg,
  LIVRO_CAPITULOS_MAX,
  LIVRO_TEXTO_TOTAL_MAX,
  rankDoValor,
  rotuloDoRank,
  serializarSistema,
  type AbaDoSistema,
  type AtributoDoSistema,
  type CapituloDoLivro,
  type CatalogosDoSistema,
  type EscolhaDoSistema,
  type FormaDoCampo,
  type RecursoDoSistema,
  type SistemaDeRpg,
  type TabelaDeRank,
  type TomDoRecurso,
} from './sistemaDeRpg'

/**
 * EDITOR DE SISTEMA (entrega 6) — "Eu imagino poder editar tudo". O editor não
 * mexe no `SistemaDeRpg` direto: trabalha num RASCUNHO com o que a tela precisa
 * e o arquivo não tem — a chave de cada linha (o React não perde o foco quando
 * o id muda), se a linha é nova (só então o id pode mudar) e os números como
 * texto (o "4" de "40" é digitação, não erro). Salvar converte o rascunho de
 * volta, RECUSA o que a leitura do arquivo cortaria calada (id repetido, nome
 * vazio, limiar fora de ordem, texto acima do teto) e passa o resultado pela
 * MESMA leitura tolerante do "Importar" (`lerSistemaDeRpg`): o que o editor
 * grava é exatamente o que um arquivo importado daria.
 *
 * O id de cada parte nunca muda depois de salvo: é a chave do valor dentro de
 * cada ficha (`Personagem.atributos[id]`...). É isso que deixa mudar um
 * sistema em uso sem destruir nada — `REGRA_DOS_DADOS`.
 */

export type SecaoDoEditor = 'geral' | 'escolhas' | 'recursos' | 'atributos' | 'abas' | 'catalogos' | 'livro'

export const SECOES_DO_EDITOR: readonly { secao: SecaoDoEditor; rotulo: string }[] = [
  { secao: 'geral', rotulo: 'Geral' },
  { secao: 'escolhas', rotulo: 'Escolhas' },
  { secao: 'recursos', rotulo: 'Recursos' },
  { secao: 'atributos', rotulo: 'Atributos' },
  { secao: 'abas', rotulo: 'Abas' },
  { secao: 'catalogos', rotulo: 'Catálogos' },
  { secao: 'livro', rotulo: 'Livro' },
]

/** O rodapé do editor: o que acontece com as fichas quando o sistema muda. */
export const REGRA_DOS_DADOS =
  'Mudar o sistema não apaga nada das fichas: atributo, recurso, escolha, aba ou campo removido continua guardado em cada personagem — só sai da tela, e volta se você recriar o mesmo id. Renomear só troca o rótulo: o id, que é a chave do valor, não muda depois de salvo.'

/** Uma linha das listas do editor. */
interface Linha {
  /** Só da tela: identifica a linha enquanto o id ainda pode mudar. */
  chave: string
  /** Ainda não foi salva: o id pode mudar (vazio = sai do nome ao salvar). Salva, o id trava. */
  novo: boolean
}

export interface RascunhoDeEscolha extends Linha {
  id: string
  rotulo: string
  /** Uma opção por linha. */
  opcoes: string
}

export interface RascunhoDeRecurso extends Linha {
  id: string
  nome: string
  tom: TomDoRecurso
  atualEMaximo: boolean
}

export interface RascunhoDeAtributo extends Linha {
  id: string
  nome: string
  abreviacao: string
  comRank: boolean
  inicial: string
  /** Os limiares separados por vírgula ou espaço: "40, 90, 150". */
  limiares: string
  /** O valor da prévia "valor 60 → R2": só da tela, não vai ao arquivo. */
  teste: string
}

export interface RascunhoDeCampo extends Linha {
  id: string
  rotulo: string
  forma: FormaDoCampo
}

export interface RascunhoDeAba extends Linha {
  id: string
  nome: string
  item: string
  vazio: string
  campos: RascunhoDeCampo[]
  extras: boolean
  atributos: boolean
  imagem: boolean
  modificadores: boolean
  /** A CHAVE (não o id: a aba nova ainda não tem) da aba dos cartões de dentro; '' = sem. */
  subcartoes: string
  rotuloDosSubcartoes: string
}

/** Item de qualquer catálogo: cada catálogo usa só as partes dele (efeito: vantagens; atributos: perícias). */
export interface RascunhoDeItem {
  chave: string
  nome: string
  descricao: string
  efeito: string
  /** As CHAVES dos atributos da perícia (o atributo novo ainda não tem id). */
  atributos: string[]
}

export type RascunhoDosCatalogos = Record<ChaveDoCatalogo, RascunhoDeItem[]>

export interface RascunhoDeCapitulo extends Linha {
  id: string
  titulo: string
  ordem: string
  texto: string
}

export interface RascunhoDoSistema {
  /** Vazio no sistema novo: sai do nome ao salvar. */
  id: string
  /** Ainda não está na biblioteca (em branco ou cópia). */
  novo: boolean
  nome: string
  versao: string
  descricao: string
  cor: string
  escolhas: RascunhoDeEscolha[]
  recursos: RascunhoDeRecurso[]
  atributos: RascunhoDeAtributo[]
  abas: RascunhoDeAba[]
  catalogos: RascunhoDosCatalogos
  livro: RascunhoDeCapitulo[]
}

export interface ErroDoEditor {
  secao: SecaoDoEditor
  texto: string
}

export type SistemaDoRascunho = { ok: true; sistema: SistemaDeRpg } | { ok: false; erros: ErroDoEditor[] }

let ultimaChave = 0

export function novaChave(): string {
  ultimaChave += 1
  return `k${ultimaChave}`
}

// ───────────────────────────────────────────────────────────────────────────
// Linhas novas
// ───────────────────────────────────────────────────────────────────────────

export function escolhaNova(): RascunhoDeEscolha {
  return { chave: novaChave(), novo: true, id: '', rotulo: '', opcoes: '' }
}

export function recursoNovo(): RascunhoDeRecurso {
  return { chave: novaChave(), novo: true, id: '', nome: '', tom: 'neutro', atualEMaximo: false }
}

export function atributoNovo(): RascunhoDeAtributo {
  return { chave: novaChave(), novo: true, id: '', nome: '', abreviacao: '', comRank: false, inicial: '1', limiares: '', teste: '0' }
}

export function campoNovo(): RascunhoDeCampo {
  return { chave: novaChave(), novo: true, id: '', rotulo: '', forma: 'linha' }
}

export function abaNova(): RascunhoDeAba {
  return { chave: novaChave(), novo: true, id: '', nome: '', item: '', vazio: '', campos: [], extras: false, atributos: false, imagem: false, modificadores: false, subcartoes: '', rotuloDosSubcartoes: '' }
}

export function itemNovo(): RascunhoDeItem {
  return { chave: novaChave(), nome: '', descricao: '', efeito: '', atributos: [] }
}

/** Capítulo novo no fim do sumário. */
export function capituloNovo(livro: readonly RascunhoDeCapitulo[]): RascunhoDeCapitulo {
  const ordens = livro.map((capitulo) => Number(capitulo.ordem)).filter(Number.isFinite)
  const ordem = ordens.length === 0 ? 1 : Math.floor(Math.max(...ordens)) + 1
  return { chave: novaChave(), novo: true, id: '', titulo: '', ordem: String(ordem), texto: '' }
}

function catalogosVazios(): RascunhoDosCatalogos {
  return { pericias: [], vantagens: [], desvantagens: [], racas: [], oficios: [] }
}

// ───────────────────────────────────────────────────────────────────────────
// Sistema → rascunho
// ───────────────────────────────────────────────────────────────────────────

/** O rascunho de um sistema salvo: toda linha já tem id, e ele trava. */
export function rascunhoDoSistema(sistema: SistemaDeRpg): RascunhoDoSistema {
  const atributos = sistema.atributos.map(
    (atributo): RascunhoDeAtributo => ({
      chave: novaChave(),
      novo: false,
      id: atributo.id,
      nome: atributo.nome,
      abreviacao: atributo.abreviacao,
      comRank: atributo.rank !== undefined,
      inicial: String(atributo.rank === undefined ? 1 : atributo.rank.inicial),
      limiares: atributo.rank === undefined ? '' : atributo.rank.limiares.join(', '),
      // O primeiro limiar mostra a virada do primeiro degrau ("valor 40 → R2").
      teste: String(atributo.rank === undefined || atributo.rank.limiares.length === 0 ? 0 : atributo.rank.limiares[0]),
    }),
  )
  const chaveDoAtributo = new Map(atributos.map((atributo) => [atributo.id, atributo.chave]))
  const chavesDasAbas = sistema.abas.map(() => novaChave())
  const chaveDaAba = new Map(sistema.abas.map((aba, i) => [aba.id, chavesDasAbas[i]]))
  const abas = sistema.abas.map(
    (aba, i): RascunhoDeAba => ({
      chave: chavesDasAbas[i],
      novo: false,
      id: aba.id,
      nome: aba.nome,
      item: aba.item,
      vazio: aba.vazio,
      campos: aba.campos.map((campo) => ({ chave: novaChave(), novo: false, id: campo.id, rotulo: campo.rotulo, forma: campo.forma })),
      extras: aba.extras === true,
      atributos: aba.atributos === true,
      imagem: aba.imagem === true,
      modificadores: aba.modificadores === true,
      subcartoes: aba.subcartoes === undefined ? '' : (chaveDaAba.get(aba.subcartoes.aba) ?? ''),
      rotuloDosSubcartoes: aba.subcartoes === undefined ? '' : aba.subcartoes.rotulo,
    }),
  )
  const catalogos = sistema.catalogos
  const item = (nome: string, descricao = '', efeito = '', atributosDoItem: readonly string[] = []): RascunhoDeItem => ({
    chave: novaChave(),
    nome,
    descricao,
    efeito,
    atributos: atributosDoItem.flatMap((id) => {
      const chave = chaveDoAtributo.get(id)
      return chave === undefined ? [] : [chave]
    }),
  })
  return {
    id: sistema.id,
    novo: false,
    nome: sistema.nome,
    versao: sistema.versao,
    descricao: sistema.descricao,
    cor: sistema.cor,
    escolhas: sistema.escolhas.map((escolha) => ({ chave: novaChave(), novo: false, id: escolha.id, rotulo: escolha.rotulo, opcoes: escolha.opcoes.join('\n') })),
    recursos: sistema.recursos.map((recurso) => ({ chave: novaChave(), novo: false, id: recurso.id, nome: recurso.nome, tom: recurso.tom, atualEMaximo: recurso.atualEMaximo === true })),
    atributos,
    abas,
    catalogos:
      catalogos === undefined
        ? catalogosVazios()
        : {
            pericias: catalogos.pericias.map((pericia) => item(pericia.nome, pericia.descricao, '', pericia.atributos)),
            vantagens: catalogos.vantagens.map((traco) => item(traco.nome, traco.descricao, traco.efeito)),
            desvantagens: catalogos.desvantagens.map((traco) => item(traco.nome, traco.descricao, traco.efeito)),
            racas: catalogos.racas.map((opcao) => item(opcao.nome, opcao.descricao)),
            oficios: catalogos.oficios.map((opcao) => item(opcao.nome, opcao.descricao)),
          },
    livro: (sistema.livro ?? []).map((capitulo) => ({ chave: novaChave(), novo: false, id: capitulo.id, titulo: capitulo.titulo, ordem: String(capitulo.ordem), texto: capitulo.texto })),
  }
}

/** "Novo sistema" em branco: um atributo vazio já na tela, porque sistema sem atributo não existe. */
export function rascunhoEmBranco(): RascunhoDoSistema {
  return {
    id: '',
    novo: true,
    nome: '',
    versao: '1',
    descricao: '',
    cor: COR_PADRAO,
    escolhas: [],
    recursos: [],
    atributos: [atributoNovo()],
    abas: [],
    catalogos: catalogosVazios(),
    livro: [],
  }
}

/**
 * "Copiar de…" e o "Editar" do embutido: tudo do outro sistema, com nome e id
 * próprios (o id sai do nome ao salvar). Os ids das partes continuam os do
 * original — a ficha feita no One Piece abre igual na cópia.
 */
export function rascunhoDaCopia(origem: SistemaDeRpg, nome: string): RascunhoDoSistema {
  return { ...rascunhoDoSistema(origem), id: '', novo: true, nome }
}

/** "One Piece (cópia)", ou "(cópia 2)" quando a primeira já existe. */
export function nomeDaCopia(nome: string, nomesExistentes: readonly string[]): string {
  const usados = new Set(nomesExistentes.map((existente) => existente.toLocaleLowerCase('pt-BR')))
  const primeiro = `${nome} (cópia)`
  if (!usados.has(primeiro.toLocaleLowerCase('pt-BR'))) return primeiro
  for (let n = 2; ; n += 1) {
    const candidato = `${nome} (cópia ${n})`
    if (!usados.has(candidato.toLocaleLowerCase('pt-BR'))) return candidato
  }
}

/** O "Duplicar" da grade: a cópia pronta para gravar, com nome e id que ninguém da biblioteca usa. */
export function copiaDoSistema(origem: SistemaDeRpg, biblioteca: readonly SistemaDeRpg[]): SistemaDeRpg {
  const nome = nomeDaCopia(
    origem.nome,
    biblioteca.map((sistema) => sistema.nome),
  )
  return { ...origem, id: idDoNome(nome, new Set(biblioteca.map((sistema) => sistema.id)), 'sistema'), nome }
}

// ───────────────────────────────────────────────────────────────────────────
// Ids
// ───────────────────────────────────────────────────────────────────────────

/** Cabe o sufixo "-999" dentro dos 64 de `idValido`. */
const ID_BASE_MAX = 60

/**
 * Id a partir do nome: "Força Bruta" → "forca-bruta"; repetido ganha "-2".
 * A comparação ignora maiúsculas: o id do sistema vira nome de arquivo, e no
 * Windows "Casa.json" e "casa.json" são o mesmo arquivo.
 */
export function idDoNome(nome: string, ocupados: ReadonlySet<string>, reserva: string): string {
  const usados = new Set([...ocupados].map((id) => id.toLowerCase()))
  const base =
    nome
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .slice(0, ID_BASE_MAX)
      .replace(/-+$/, '') || reserva
  if (!usados.has(base)) return base
  for (let n = 2; ; n += 1) {
    const candidato = `${base}-${n}`
    if (!usados.has(candidato)) return candidato
  }
}

type AcusarErro = (secao: SecaoDoEditor, texto: string) => void

/**
 * Os ids finais da lista: o da linha salva, o digitado na linha nova, ou o que
 * sai do nome quando ela não tem. Acusa id torto e id repetido — a leitura do
 * arquivo jogaria fora a segunda linha calada.
 */
function idsDaLista<T extends Linha & { id: string }>(linhas: readonly T[], nomeDa: (linha: T) => string, reserva: string, secao: SecaoDoEditor, onde: string, acusar: AcusarErro): string[] {
  const digitados = linhas.map((linha) => linha.id.trim()).filter((id) => id.length > 0)
  const ocupados = new Set(digitados)
  const vistos = new Set<string>()
  return linhas.map((linha) => {
    let id = linha.id.trim()
    if (id.length === 0) {
      id = idDoNome(nomeDa(linha), ocupados, reserva)
      ocupados.add(id)
    } else if (!idValido(id)) {
      acusar(secao, `${onde}: o id "${id}" só pode ter letras sem acento, números, - e _ (até 64, começando por letra ou número).`)
    }
    if (vistos.has(id)) acusar(secao, `${onde}: o id "${id}" está repetido.`)
    vistos.add(id)
    return id
  })
}

// ───────────────────────────────────────────────────────────────────────────
// Rank
// ───────────────────────────────────────────────────────────────────────────

export type TabelaDoRascunho = { ok: true; tabela: TabelaDeRank } | { ok: false; erro: string }

/** A tabela de rank digitada: inicial inteiro e limiares que só crescem. */
export function tabelaDoRascunho(inicial: string, limiares: string): TabelaDoRascunho {
  const textoInicial = inicial.trim()
  const valorInicial = Number(textoInicial)
  if (textoInicial.length === 0 || !Number.isInteger(valorInicial)) return { ok: false, erro: 'o rank inicial precisa ser um número inteiro (como 1).' }
  const numeros: number[] = []
  for (const pedaco of limiares.split(/[\s,;]+/).filter((parte) => parte.length > 0)) {
    const limiar = Number(pedaco)
    if (!Number.isFinite(limiar)) return { ok: false, erro: `"${pedaco}" não é um número nos limiares.` }
    if (numeros.length > 0 && limiar <= numeros[numeros.length - 1]) {
      return { ok: false, erro: `os limiares precisam crescer, e ${pedaco} vem depois de ${numeros[numeros.length - 1]}.` }
    }
    numeros.push(limiar)
  }
  return { ok: true, tabela: { inicial: valorInicial, limiares: numeros } }
}

/** A prévia ao lado da tabela: "valor 60 → R2", ou o que falta para dizer. */
export function previaDoRank(atributo: Pick<RascunhoDeAtributo, 'comRank' | 'inicial' | 'limiares' | 'teste'>): string {
  if (!atributo.comRank) return 'sem rank'
  const tabela = tabelaDoRascunho(atributo.inicial, atributo.limiares)
  if (!tabela.ok) return 'corrija a tabela'
  const texto = atributo.teste.trim()
  const rank = texto.length === 0 ? null : rankDoValor(tabela.tabela, Number(texto))
  return rank === null ? 'digite um valor' : `valor ${texto} → ${rotuloDoRank(rank)}`
}

// ───────────────────────────────────────────────────────────────────────────
// Rascunho → sistema (a validação do "Salvar")
// ───────────────────────────────────────────────────────────────────────────

function linhasDoTexto(texto: string): string[] {
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0)
}

function primeiroRepetido(valores: readonly string[], chaveDe: (valor: string) => string = (valor) => valor): string | undefined {
  const vistos = new Set<string>()
  for (const valor of valores) {
    const chave = chaveDe(valor)
    if (vistos.has(chave)) return valor
    vistos.add(chave)
  }
  return undefined
}

const milhar = (n: number): string => n.toLocaleString('pt-BR')

function escolhasDoRascunho(rascunho: RascunhoDoSistema, acusar: AcusarErro): EscolhaDoSistema[] {
  const ids = idsDaLista(rascunho.escolhas, (escolha) => escolha.rotulo, 'escolha', 'escolhas', 'Escolhas', acusar)
  return rascunho.escolhas.map((escolha, i) => {
    const rotulo = escolha.rotulo.trim()
    if (rotulo.length === 0) acusar('escolhas', `A escolha ${i + 1} está sem rótulo.`)
    const opcoes = linhasDoTexto(escolha.opcoes)
    const repetida = primeiroRepetido(opcoes)
    if (repetida !== undefined) acusar('escolhas', `${rotulo || `Escolha ${i + 1}`}: a opção "${repetida}" está repetida.`)
    return { id: ids[i], rotulo, opcoes }
  })
}

function recursosDoRascunho(rascunho: RascunhoDoSistema, acusar: AcusarErro): RecursoDoSistema[] {
  const ids = idsDaLista(rascunho.recursos, (recurso) => recurso.nome, 'recurso', 'recursos', 'Recursos', acusar)
  return rascunho.recursos.map((recurso, i) => {
    const nome = recurso.nome.trim()
    if (nome.length === 0) acusar('recursos', `O recurso ${i + 1} está sem nome.`)
    const saida: RecursoDoSistema = { id: ids[i], nome, tom: recurso.tom }
    if (recurso.atualEMaximo) saida.atualEMaximo = true
    return saida
  })
}

function atributosDoRascunho(rascunho: RascunhoDoSistema, ids: readonly string[], acusar: AcusarErro): AtributoDoSistema[] {
  if (rascunho.atributos.length === 0) acusar('atributos', 'O sistema precisa de pelo menos um atributo.')
  return rascunho.atributos.map((atributo, i) => {
    const nome = atributo.nome.trim()
    const rotulo = nome || `Atributo ${i + 1}`
    if (nome.length === 0) acusar('atributos', `O atributo ${i + 1} está sem nome.`)
    const abreviacao = atributo.abreviacao.trim()
    if (abreviacao.length === 0) acusar('atributos', `${rotulo}: falta a abreviação (o rótulo curto dos chips, como FOR).`)
    const saida: AtributoDoSistema = { id: ids[i], nome, abreviacao }
    if (!atributo.comRank) return saida
    const tabela = tabelaDoRascunho(atributo.inicial, atributo.limiares)
    if (tabela.ok) saida.rank = tabela.tabela
    else acusar('atributos', `${rotulo}: ${tabela.erro}`)
    return saida
  })
}

function abasDoRascunho(rascunho: RascunhoDoSistema, acusar: AcusarErro): AbaDoSistema[] {
  const ids = idsDaLista(rascunho.abas, (aba) => aba.nome, 'aba', 'abas', 'Abas', acusar)
  const pelaChave = new Map(rascunho.abas.map((aba, i) => [aba.chave, { id: ids[i], aba }]))
  return rascunho.abas.map((aba, i) => {
    const nome = aba.nome.trim()
    const rotulo = nome || `Aba ${i + 1}`
    if (nome.length === 0) acusar('abas', `A aba ${i + 1} está sem nome.`)
    const idsDosCampos = idsDaLista(aba.campos, (campo) => campo.rotulo, 'campo', 'abas', rotulo, acusar)
    const campos = aba.campos.map((campo, j) => {
      const rotuloDoCampo = campo.rotulo.trim()
      if (rotuloDoCampo.length === 0) acusar('abas', `${rotulo}: o campo ${j + 1} está sem rótulo.`)
      return { id: idsDosCampos[j], rotulo: rotuloDoCampo, forma: campo.forma }
    })
    const saida: AbaDoSistema = { id: ids[i], nome, item: aba.item.trim() || nome, vazio: aba.vazio.trim() || `Nada em ${nome}.`, campos }
    if (aba.extras) saida.extras = true
    if (aba.atributos) saida.atributos = true
    if (aba.imagem) saida.imagem = true
    if (aba.modificadores) saida.modificadores = true
    if (aba.subcartoes.length === 0) return saida
    const alvo = pelaChave.get(aba.subcartoes)
    if (alvo === undefined) acusar('abas', `${rotulo}: os cartões de dentro apontam para uma aba que não existe mais.`)
    else if (alvo.aba.chave === aba.chave) acusar('abas', `${rotulo}: os cartões de dentro não podem ser da própria aba.`)
    else saida.subcartoes = { aba: alvo.id, rotulo: aba.rotuloDosSubcartoes.trim() || alvo.aba.item.trim() || alvo.aba.nome.trim() || alvo.id }
    return saida
  })
}

/** Nome e textos do item, já cortados no que o catálogo usa, e o custo dele no teto dos catálogos. */
function catalogosDoRascunho(rascunho: RascunhoDoSistema, idsDosAtributos: readonly string[], acusar: AcusarErro): CatalogosDoSistema | undefined {
  const idDoAtributo = new Map(rascunho.atributos.map((atributo, i) => [atributo.chave, idsDosAtributos[i]]))
  let total = 0
  const conferir = (rotulo: string, itens: readonly RascunhoDeItem[], comEfeito: boolean) => {
    if (itens.length > CATALOGO_ITENS_MAX) acusar('catalogos', `${rotulo}: no máximo ${CATALOGO_ITENS_MAX} itens (tem ${itens.length}).`)
    itens.forEach((item, i) => {
      const nome = item.nome.trim()
      const quem = nome || `item ${i + 1}`
      if (nome.length === 0) acusar('catalogos', `${rotulo}: o item ${i + 1} está sem nome.`)
      if (nome.length > CATALOGO_NOME_MAX) acusar('catalogos', `${rotulo}: o nome "${nome.slice(0, 24)}…" passa de ${CATALOGO_NOME_MAX} letras.`)
      const textos = comEfeito ? [item.descricao.trim(), item.efeito.trim()] : [item.descricao.trim()]
      if (textos.some((texto) => texto.length > CATALOGO_TEXTO_MAX)) acusar('catalogos', `${rotulo} · ${quem}: um texto passa de ${milhar(CATALOGO_TEXTO_MAX)} letras.`)
      total += nome.length + textos.reduce((soma, texto) => soma + texto.length, 0)
    })
    const repetido = primeiroRepetido(
      itens.map((item) => item.nome.trim()).filter((nome) => nome.length > 0),
      (nome) => nome.toLocaleLowerCase('pt-BR'),
    )
    // O "Escolher do livro" acha o item pelo nome: dois iguais, e o segundo nunca seria escolhido.
    if (repetido !== undefined) acusar('catalogos', `${rotulo}: "${repetido}" aparece duas vezes.`)
  }
  const { pericias, vantagens, desvantagens, racas, oficios } = rascunho.catalogos
  for (const { chave, rotulo } of CATALOGOS_DO_LIVRO) conferir(rotulo, rascunho.catalogos[chave], chave === 'vantagens' || chave === 'desvantagens')
  if (total > CATALOGOS_TEXTO_TOTAL_MAX) acusar('catalogos', `Os catálogos juntos passam de ${milhar(CATALOGOS_TEXTO_TOTAL_MAX)} letras (têm ${milhar(total)}).`)

  const opcao = (item: RascunhoDeItem) => (item.descricao.trim().length === 0 ? { nome: item.nome.trim() } : { nome: item.nome.trim(), descricao: item.descricao.trim() })
  const traco = (item: RascunhoDeItem) => ({ nome: item.nome.trim(), descricao: item.descricao.trim(), efeito: item.efeito.trim() })
  const catalogos: CatalogosDoSistema = {
    pericias: pericias.map((item) => ({
      nome: item.nome.trim(),
      descricao: item.descricao.trim(),
      // Atributo apagado no editor sai da perícia: não marcaria caixa nenhuma na ficha (a leitura faz o mesmo).
      atributos: [...new Set(item.atributos.flatMap((chave) => idDoAtributo.get(chave) ?? []))],
    })),
    vantagens: vantagens.map(traco),
    desvantagens: desvantagens.map(traco),
    racas: racas.map(opcao),
    oficios: oficios.map(opcao),
  }
  return Object.values(catalogos).every((itens) => itens.length === 0) ? undefined : catalogos
}

function livroDoRascunho(rascunho: RascunhoDoSistema, acusar: AcusarErro): CapituloDoLivro[] {
  if (rascunho.livro.length > LIVRO_CAPITULOS_MAX) acusar('livro', `O livro tem no máximo ${LIVRO_CAPITULOS_MAX} capítulos (tem ${rascunho.livro.length}).`)
  const ids = idsDaLista(rascunho.livro, (capitulo) => capitulo.titulo, 'capitulo', 'livro', 'Livro', acusar)
  let total = 0
  const livro = rascunho.livro.map((capitulo, i) => {
    const titulo = capitulo.titulo.trim()
    const rotulo = titulo || `Capítulo ${i + 1}`
    if (titulo.length === 0) acusar('livro', `O capítulo ${i + 1} está sem título.`)
    if (titulo.length > CAPITULO_TITULO_MAX) acusar('livro', `${rotulo.slice(0, 24)}…: o título passa de ${CAPITULO_TITULO_MAX} letras.`)
    const textoDaOrdem = capitulo.ordem.trim()
    const ordem = Number(textoDaOrdem)
    if (textoDaOrdem.length === 0 || !Number.isFinite(ordem)) acusar('livro', `${rotulo}: a ordem precisa ser um número.`)
    const texto = capitulo.texto.trim()
    if (texto.length > CAPITULO_TEXTO_MAX) acusar('livro', `${rotulo}: o texto passa de ${milhar(CAPITULO_TEXTO_MAX)} letras (tem ${milhar(texto.length)}).`)
    total += texto.length
    return { id: ids[i], titulo, ordem, texto }
  })
  if (total > LIVRO_TEXTO_TOTAL_MAX) acusar('livro', `O livro inteiro passa de ${milhar(LIVRO_TEXTO_TOTAL_MAX)} letras (tem ${milhar(total)}).`)
  return livro
}

/**
 * O "Salvar" do editor: o sistema pronto para a biblioteca, ou TODOS os
 * problemas de uma vez, cada um com a seção onde mora. `idsDaBiblioteca`: os
 * ids que o sistema novo não pode pegar (o dele sai do nome).
 */
export function sistemaDoRascunho(rascunho: RascunhoDoSistema, idsDaBiblioteca: ReadonlySet<string>): SistemaDoRascunho {
  const erros: ErroDoEditor[] = []
  const acusar: AcusarErro = (secao, texto) => {
    erros.push({ secao, texto })
  }
  const nome = rascunho.nome.trim()
  if (nome.length === 0) acusar('geral', 'O sistema precisa de um nome.')
  if (!corValida(rascunho.cor)) acusar('geral', 'A cor da capa precisa ser #rrggbb.')
  const id = rascunho.novo ? idDoNome(nome, idsDaBiblioteca, 'sistema') : rascunho.id
  if (!idValido(id)) acusar('geral', `O id do sistema ("${id}") não serve de nome de arquivo.`)

  const escolhas = escolhasDoRascunho(rascunho, acusar)
  const recursos = recursosDoRascunho(rascunho, acusar)
  const idsDosAtributos = idsDaLista(rascunho.atributos, (atributo) => atributo.nome, 'atributo', 'atributos', 'Atributos', acusar)
  const atributos = atributosDoRascunho(rascunho, idsDosAtributos, acusar)
  const abas = abasDoRascunho(rascunho, acusar)
  const catalogos = catalogosDoRascunho(rascunho, idsDosAtributos, acusar)
  const livro = livroDoRascunho(rascunho, acusar)
  if (erros.length > 0) return { ok: false, erros }

  const sistema: SistemaDeRpg = {
    formato: FORMATO_DO_SISTEMA,
    id,
    nome,
    versao: rascunho.versao.trim() || '1',
    descricao: rascunho.descricao.trim(),
    cor: rascunho.cor,
    escolhas,
    recursos,
    atributos,
    abas,
  }
  if (livro.length > 0) sistema.livro = livro
  if (catalogos !== undefined) sistema.catalogos = catalogos
  // Pelo mesmo caminho do arquivo importado: o que sai daqui é o que a leitura daria.
  const lido = lerSistemaDeRpg(JSON.parse(serializarSistema(sistema)))
  return lido.ok ? { ok: true, sistema: lido.sistema } : { ok: false, erros: [{ secao: 'geral', texto: `O sistema não passaria na leitura do arquivo: ${lido.erro}.` }] }
}

// ───────────────────────────────────────────────────────────────────────────
// Prévia da ficha
// ───────────────────────────────────────────────────────────────────────────

const RECURSO_ATUAL_DE_EXEMPLO = 8
const RECURSO_MAXIMO_DE_EXEMPLO = 10
const ATRIBUTO_SEM_RANK_DE_EXEMPLO = 10

function cartaoDeExemplo(aba: AbaDoSistema): CartaoDaFicha {
  return {
    id: `cart_exemplo_${aba.id}`,
    nome: aba.item,
    campos: Object.fromEntries(aba.campos.map((campo) => [campo.id, campo.forma === 'paragrafo' ? `Texto de ${campo.rotulo.toLocaleLowerCase('pt-BR')}.` : campo.rotulo])),
    extras: [],
    atributos: [],
    imagem: null,
    modificadores: [],
    subcartoes: [],
  }
}

/**
 * O personagem da prévia: a primeira opção de cada escolha, recursos pela
 * metade, cada atributo no primeiro limiar (o chip mostra o rank subindo) e um
 * cartão por aba com o rótulo de cada campo — assim todo pedaço do sistema
 * aparece na ficha de verdade.
 */
export function personagemDeExemplo(sistema: SistemaDeRpg): Personagem {
  const base = novoPersonagem(sistema, 'jogador', 'Personagem de exemplo')
  return {
    ...base,
    id: 'pers_exemplo',
    descricao: 'Assim a ficha fica com este sistema.',
    escolhas: Object.fromEntries(sistema.escolhas.flatMap((escolha): [string, string][] => (escolha.opcoes.length === 0 ? [] : [[escolha.id, escolha.opcoes[0]]]))),
    recursos: Object.fromEntries(sistema.recursos.map((recurso) => [recurso.id, recurso.atualEMaximo === true ? RECURSO_ATUAL_DE_EXEMPLO : RECURSO_MAXIMO_DE_EXEMPLO])),
    maximos: Object.fromEntries(sistema.recursos.filter((recurso) => recurso.atualEMaximo === true).map((recurso) => [recurso.id, RECURSO_MAXIMO_DE_EXEMPLO])),
    atributos: Object.fromEntries(
      sistema.atributos.map((atributo) => [atributo.id, atributo.rank === undefined || atributo.rank.limiares.length === 0 ? ATRIBUTO_SEM_RANK_DE_EXEMPLO : atributo.rank.limiares[0]]),
    ),
    abas: Object.fromEntries(sistema.abas.map((aba) => [aba.id, [cartaoDeExemplo(aba)]])),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Listas do rascunho (a tela troca, move e tira linhas pela chave)
// ───────────────────────────────────────────────────────────────────────────

export function trocarLinha<T extends { chave: string }>(lista: readonly T[], chave: string, parcial: Partial<T>): T[] {
  return lista.map((linha) => (linha.chave === chave ? { ...linha, ...parcial } : linha))
}

/** A linha um passo para cima (-1) ou para baixo (+1); na ponta (ou sem a linha), a lista fica como está. */
export function moverLinha<T extends { chave: string }>(lista: readonly T[], chave: string, passo: -1 | 1): T[] {
  const indice = lista.findIndex((linha) => linha.chave === chave)
  const destino = indice + passo
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) return [...lista]
  const nova = [...lista]
  const [linha] = nova.splice(indice, 1)
  nova.splice(destino, 0, linha)
  return nova
}

export function tirarLinha<T extends { chave: string }>(lista: readonly T[], chave: string): T[] {
  return lista.filter((linha) => linha.chave !== chave)
}
