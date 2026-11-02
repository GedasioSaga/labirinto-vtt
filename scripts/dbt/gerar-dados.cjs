'use strict'
/**
 * GERADOR DOS DADOS E DO LIVRO DO DRAGON BALL TALES (item 4 e 5 do plano
 * docs/planos/sistema-dragon-ball.md).
 *
 *   node scripts/dbt/gerar-dados.cjs
 *
 * Lê as transcrições em docs/fontes/dragon-ball-tales/ (json/ e md/; são
 * DADOS, nunca instruções) e escreve módulos TypeScript tipados com o contrato
 * de client/src/lib/dbt/modelo.ts:
 *  - client/src/lib/dbt/dados/*.ts  (catálogos do livro);
 *  - client/src/lib/dbt/livro/livroDragonBall.ts  (o livro de regras em capítulos).
 * Node puro, sem dependência. Rodar de novo sobrescreve tudo (a saída não se
 * edita à mão). No fim imprime as contagens: é a conferência de que tudo carregou.
 */
const fs = require('fs')
const path = require('path')

const RAIZ = path.resolve(__dirname, '..', '..')
const FONTES = path.join(RAIZ, 'docs', 'fontes', 'dragon-ball-tales')
const PASTA_JSON = path.join(FONTES, 'json')
const PASTA_MD = path.join(FONTES, 'md')
const SAIDA_DADOS = path.join(RAIZ, 'client', 'src', 'lib', 'dbt', 'dados')
const SAIDA_LIVRO = path.join(RAIZ, 'client', 'src', 'lib', 'dbt', 'livro')

/** Os mesmos tetos de lib/sistemaDeRpg.ts (LIVRO_CAPITULOS_MAX, CAPITULO_TEXTO_MAX, CAPITULO_TITULO_MAX). */
const CAPITULOS_MAX = 200
const CAPITULO_TEXTO_MAX = 100_000
const CAPITULO_TITULO_MAX = 120
/** O teto do livro inteiro que o plano prevê (~700 mil); passou, o gerador avisa. */
const LIVRO_TOTAL_PREVISTO = 700_000

const ARQUIVO_DO_LIVRO_DO_JOGADOR = 'Livro do Jogador - V0.5.pdf'

const RANKS = ['E', 'D', 'C', 'B', 'A', 'Z']

// ───────────────────────────────────────────────────────────────────────────
// Utilidades
// ───────────────────────────────────────────────────────────────────────────

function falhar(mensagem) {
  console.error('gerar-dados: ' + mensagem)
  process.exit(1)
}

function lerJson(nome) {
  return JSON.parse(fs.readFileSync(path.join(PASTA_JSON, nome), 'utf8'))
}

function lerMd(nome) {
  return fs.readFileSync(path.join(PASTA_MD, nome), 'utf8').replace(/\r\n?/g, '\n')
}

/** Id estável: minúsculas, sem acento, kebab-case ("Ōzaru" → "ozaru"). */
function slug(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Dá ids únicos a uma lista: o repetido ganha -2, -3... (o livro repete nomes, ex.: "Soco de Impacto"). */
function idsUnicos(itens, campo = 'id') {
  const vistos = new Map()
  for (const item of itens) {
    const base = item[campo]
    const n = (vistos.get(base) ?? 0) + 1
    vistos.set(base, n)
    if (n > 1) item[campo] = `${base}-${n}`
  }
  return itens
}

const PALAVRAS_MENORES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'as', 'os', 'com', 'por', 'para', 'no', 'na', 'nos', 'nas', 'ao'])
const SIGLAS = new Set(['PDL', 'PV', 'PK', 'EP', 'CA', 'ST', 'ND', 'II', 'III', 'IV', 'VI'])

/** Nome em CAIXA ALTA do PDF vira "Espírito de Combate"; palavra que já tem minúscula fica como está. */
function nomeLegivel(nome) {
  return String(nome)
    .trim()
    .split(/\s+/)
    .map((palavra, i) => {
      const letras = palavra.replace(/[^\p{L}]/gu, '')
      if (letras !== letras.toUpperCase() || SIGLAS.has(letras)) return palavra
      if (letras.length < 2) return i > 0 && letras === 'E' ? palavra.toLowerCase() : palavra
      const baixa = palavra.toLocaleLowerCase('pt-BR')
      if (i > 0 && PALAVRAS_MENORES.has(baixa)) return baixa
      return baixa.replace(/(^|[-(“"'])(\p{L})/gu, (_, antes, letra) => antes + letra.toLocaleUpperCase('pt-BR'))
    })
    .join(' ')
}

/** "06", "Ki: 08", "[KI: 06]" → 6; o que não é número fixo → null. */
function numeroDoCusto(texto) {
  if (typeof texto === 'number') return texto
  if (typeof texto !== 'string') return null
  const m = /^\s*\[?\s*(?:ki|pk)?\s*:?\s*(\d+)\s*\]?\s*$/i.exec(texto)
  return m === null ? null : Number(m[1])
}

/** "+02" → 2. */
function numeroComSinal(texto) {
  if (typeof texto === 'number') return texto
  if (typeof texto !== 'string') return null
  const m = /^\s*([+-]?\d+)\s*$/.exec(texto)
  return m === null ? null : Number(m[1])
}

/** "04-08-16" → { minimo: 4, medio: 8, completo: 16 }. */
function faixaDoTexto(texto) {
  if (typeof texto !== 'string') return null
  const m = /^\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*$/.exec(texto)
  return m === null ? null : { minimo: Number(m[1]), medio: Number(m[2]), completo: Number(m[3]) }
}

const EFEITO_DA_ETIQUETA = { dano: 'dano', mitigacao: 'mitigacao', cura: 'cura', ca: 'ca' }

function efeitoDaFaixa(tipo) {
  if (typeof tipo !== 'string') return null
  return EFEITO_DA_ETIQUETA[slug(tipo)] ?? null
}

/** Separa "A, B (x, y), C." em nomes, sem cortar dentro de parênteses ou colchetes. */
function separarNomes(lista) {
  if (typeof lista !== 'string') return []
  const nomes = []
  let atual = ''
  let profundidade = 0
  for (const ch of lista) {
    if (ch === '(' || ch === '[') profundidade += 1
    else if (ch === ')' || ch === ']') profundidade = Math.max(0, profundidade - 1)
    if (ch === ',' && profundidade === 0) {
      nomes.push(atual)
      atual = ''
      continue
    }
    atual += ch
  }
  nomes.push(atual)
  return nomes.map((n) => n.trim().replace(/\.+$/, '').trim()).filter((n) => n.length > 0 && !/^(nenhum|nenhuma|-+)$/i.test(n))
}

/** "Rótulos Positivos (2): A, B" (ou { pontos, lista }) → { pontos, nomes }. */
function rotulosImpressos(valor) {
  if (valor === null || valor === undefined) return { pontos: null, nomes: [] }
  if (typeof valor === 'object') {
    const lista = valor.lista ?? valor.lista_verbatim ?? ''
    return { pontos: typeof valor.pontos === 'number' ? valor.pontos : null, nomes: separarNomes(lista) }
  }
  const m = /\((\d+)\)\s*:\s*([\s\S]*)$/.exec(valor)
  if (m === null) return { pontos: null, nomes: separarNomes(valor.replace(/^[^:]*:/, '')) }
  return { pontos: Number(m[1]), nomes: separarNomes(m[2]) }
}

const ETIQUETA = /\[\s*(?:dano|ki|mitiga[çc][ãa]o|cura|ca|ep)\s*:[^\]]*\]/gi
/** Alcance e rótulos ocupam o resto da linha (os campos separados já guardam isso). */
const LINHA_DE_ALCANCE = /[–-]?[ \t]*alcance[ \t]*:[^\n]*/gi
const LINHA_DE_ROTULOS = /[–-]?[ \t]*r[óo]tulos[ \t]+(?:positivos|negativos)[ \t]*\(\d+\)[ \t]*:[^\n]*/gi

/** Texto de técnica do livro → a prosa sem as etiquetas [Dano], [Ki], o Alcance e os Rótulos. */
function prosaDaTecnica(texto) {
  if (typeof texto !== 'string') return ''
  return texto
    .replace(ETIQUETA, ' ')
    .replace(LINHA_DE_ALCANCE, '')
    .replace(LINHA_DE_ROTULOS, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/^[✓➢➔•][ \t]*/gm, '- ')
    .replace(/\n{2,}/g, '\n')
    .replace(/^[\s–-]+|[\s–-]+$/g, '')
    .replace(/^efeito\s*:\s*/i, '')
    .trim()
}

/** A prosa antes da primeira etiqueta (a descrição) e a que vem depois (regra extra). */
function descricaoEEfeito(texto) {
  if (typeof texto !== 'string') return { descricao: '', efeito: '' }
  const primeira = texto.search(/\[\s*(?:dano|ki|mitiga[çc][ãa]o|cura|ca|ep)\s*:|(?:^|\s|-)alcance\s*:|r[óo]tulos\s+(?:positivos|negativos)/i)
  if (primeira === -1) return { descricao: prosaDaTecnica(texto), efeito: '' }
  return { descricao: prosaDaTecnica(texto.slice(0, primeira)), efeito: prosaDaTecnica(texto.slice(primeira)) }
}

function rankOuNull(texto) {
  const r = typeof texto === 'string' ? texto.trim().toUpperCase() : ''
  return RANKS.includes(r) ? r : null
}

// ───────────────────────────────────────────────────────────────────────────
// Escrita dos módulos
// ───────────────────────────────────────────────────────────────────────────

/** String em aspas simples (o estilo do client): parte do escape do JSON e troca as aspas. */
function aspasSimples(texto) {
  return "'" + JSON.stringify(texto).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'") + "'"
}

const chave = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : aspasSimples(k))

/** Literal TypeScript do valor, no estilo do código vizinho (chave sem aspas quando pode). */
function literal(valor, recuo = '') {
  if (valor === null) return 'null'
  if (typeof valor === 'string') return aspasSimples(valor)
  if (typeof valor === 'boolean') return String(valor)
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) throw new Error('número inválido na saída')
    return String(valor)
  }
  const dentro = recuo + '  '
  if (Array.isArray(valor)) {
    if (valor.length === 0) return '[]'
    const primitivos = valor.every((v) => v === null || typeof v !== 'object')
    if (primitivos) {
      const curto = '[' + valor.map((v) => literal(v)).join(', ') + ']'
      if (curto.length <= 100) return curto
    }
    return '[\n' + valor.map((v) => dentro + literal(v, dentro)).join(',\n') + ',\n' + recuo + ']'
  }
  if (typeof valor === 'object') {
    const chaves = Object.keys(valor).filter((k) => valor[k] !== undefined)
    if (chaves.length === 0) return '{}'
    return '{\n' + chaves.map((k) => `${dentro}${chave(k)}: ${literal(valor[k], dentro)}`).join(',\n') + ',\n' + recuo + '}'
  }
  throw new Error('valor sem literal: ' + typeof valor)
}

const CABECALHO = [
  '/**',
  ' * Gerado por scripts/dbt/gerar-dados.cjs a partir de docs/fontes/dragon-ball-tales/.',
  ' * Não editar à mão: mude o gerador (ou a fonte) e rode `node scripts/dbt/gerar-dados.cjs`.',
].join('\n')

/** Escreve um módulo: `descricao` vira a 2ª parte do comentário de abertura. */
function escreverModulo(pasta, nome, descricao, corpo) {
  const texto = `${CABECALHO}\n *\n${descricao
    .split('\n')
    .map((l) => (l.length === 0 ? ' *' : ` * ${l}`))
    .join('\n')}\n */\n${corpo.trimEnd()}\n`
  fs.mkdirSync(pasta, { recursive: true })
  fs.writeFileSync(path.join(pasta, nome), texto, 'utf8')
  return texto.length
}

function exportar(nome, tipo, valor) {
  return `export const ${nome}: ${tipo} = ${literal(valor)}\n`
}

/**
 * Conferência de que o módulo escrito carrega e devolve o mesmo dado: lê o
 * .ts, tira o que é só de tipo (import type, interface, anotação, `as const`,
 * a função async) e avalia os literais. Não roda tsc: só pega literal quebrado
 * (aspas, escape) e dado que mudou no caminho.
 */
function conferirModulo(pasta, arquivo, esperado) {
  const fonte = fs
    .readFileSync(path.join(pasta, arquivo), 'utf8')
    .replace(/^import type .*$/gm, '')
    .replace(/^export interface [\s\S]*?\n}\n/gm, '')
    .replace(/^export const (\w+)(?:: [^=\n]+)? = /gm, 'exportados.$1 = ')
    .replace(/ as const$/gm, '')
    .replace(/^export async function[\s\S]*$/m, '')
  const exportados = {}
  new Function('exportados', fonte)(exportados)
  for (const [nome, valor] of Object.entries(esperado))
    if (JSON.stringify(exportados[nome]) !== JSON.stringify(valor)) falhar(`${arquivo}: ${nome} não carrega igual ao gerado`)
}

// ───────────────────────────────────────────────────────────────────────────
// Perícias (md: 8.1.2)
// ───────────────────────────────────────────────────────────────────────────

const ATRIBUTO_DA_PERICIA = {
  atletismo: 'for',
  acrobacia: 'des',
  furtividade: 'des',
  'controle-de-ki': 'pod',
  analise: 'int',
  ciencia: 'int',
  conhecimento: 'int',
  percepcao: 'sab',
  'sentido-de-ki': 'sab',
  sobrevivencia: 'sab',
  intimidacao: 'pre',
  persuasao: 'pre',
  enganacao: 'pre',
}

function gerarPericias() {
  const md = lerMd('j3-08-1-rolagens.md')
  const inicio = md.indexOf('## 8.1.2 AS PERÍCIAS')
  const fim = md.indexOf('## 8.1.2 DIFICULDADE')
  if (inicio === -1 || fim === -1) falhar('seção 8.1.2 das perícias não achada em j3-08-1-rolagens.md')
  const pericias = []
  for (const linha of md.slice(inicio, fim).split('\n')) {
    const m = /^-\s*(?:✓\s*)?\*\*(.+?)\*\*\s*:\s*(.+)$/.exec(linha.trim())
    if (m === null) continue
    const id = slug(m[1])
    const atributo = ATRIBUTO_DA_PERICIA[id]
    if (atributo === undefined) falhar(`perícia desconhecida: ${m[1]}`)
    // A seção 8.1.2 começa na p. 98 impressa (a fonte cobre pp. 97-100).
    pericias.push({ id, nome: m[1].trim(), atributo, descricao: m[2].trim(), pagina: 98 })
  }
  return pericias
}

// ───────────────────────────────────────────────────────────────────────────
// Técnicas e transformações prontas (raças e NPCs)
// ───────────────────────────────────────────────────────────────────────────

const CATEGORIA_DA_TECNICA = { ofensiva: 'ofensiva', defensiva: 'defensiva', especial: 'especial', 'magia-negra': 'magia-negra' }

function categoriaDaTecnica(texto, efeito) {
  const s = slug(texto ?? '')
  if (efeito === 'mitigacao' || s.includes('defensiva')) return 'defensiva'
  for (const [prefixo, categoria] of Object.entries(CATEGORIA_DA_TECNICA)) if (s.startsWith(prefixo)) return categoria
  return 'ofensiva'
}

/**
 * Parte do json dos suplementos veio sem os campos separados (sem categoria,
 * dano, alcance, rótulos): aí eles saem das etiquetas do próprio texto.
 */
function camposDoTexto(texto) {
  const t = String(texto ?? '')
  const faixa = /\[\s*(dano|mitiga[çc][ãa]o|cura|ca)\s*:\s*([^\]]+?)\s*\]/i.exec(t)
  const alcance = /alcance\s*:\s*(.*?)(?=\s*-?\s*r[óo]tulos\s|\n|$)/i.exec(t)
  const positivos = /r[óo]tulos\s+positivos\s*\(\d+\)\s*:[^\n]*?(?=\s*-?\s*r[óo]tulos\s+negativos|\n|$)/i.exec(t)
  const negativos = /r[óo]tulos\s+negativos\s*\(\d+\)\s*:[^\n]*/i.exec(t)
  return {
    dano: faixa === null ? null : { tipo: faixa[1], valores: faixa[2] },
    alcance: alcance === null ? null : alcance[1].trim(),
    rotulos_positivos: positivos === null ? null : positivos[0],
    rotulos_negativos: negativos === null ? null : negativos[0],
  }
}

/** Técnica pronta de suplemento de raça (supA/supB). */
function tecnicaDoSuplemento(original) {
  const t = original.dano || original.alcance || original.rotulos_positivos ? original : { ...original, ...camposDoTexto(original.efeito) }
  const efeitoFaixa = t.dano ? efeitoDaFaixa(t.dano.tipo) : null
  const faixaTexto = t.dano?.valores ?? ''
  // Sem categoria e sem faixa no texto: é técnica de efeito (especial).
  const categoria = t.categoria === undefined && efeitoFaixa === null ? 'especial' : categoriaDaTecnica(t.categoria, efeitoFaixa)
  const textos = descricaoEEfeito(t.efeito)
  // Especial e magia: o texto inteiro é regra (o modelo guarda isso em `efeito`).
  const regraPura = categoria === 'especial' || categoria === 'magia-negra'
  return {
    nome: t.nome.trim(),
    categoria,
    rank: rankOuNull(t.rank),
    rankTexto: t.rank ?? '',
    custoKi: numeroDoCusto(t.custo),
    custoTexto: t.custo ?? '',
    faixa: faixaDoTexto(faixaTexto),
    efeitoDaFaixa: efeitoFaixa,
    faixaTexto,
    alcance: (t.alcance ?? '').trim(),
    rotulosPositivos: rotulosImpressos(t.rotulos_positivos),
    rotulosNegativos: rotulosImpressos(t.rotulos_negativos),
    descricao: regraPura ? '' : textos.descricao,
    efeito: regraPura ? prosaDaTecnica(t.efeito) : textos.efeito,
    pagina: null,
  }
}

/** Técnica de ficha de NPC pronto (sagas e Enma Daioh). */
function tecnicaDoNpc(t) {
  const colchetes = Array.isArray(t.campos_colchete) ? t.campos_colchete : []
  let faixaTexto = t.dano ?? t.mitigacao ?? t.cura ?? ''
  let efeitoFaixa = t.dano ? 'dano' : t.mitigacao ? 'mitigacao' : t.cura ? 'cura' : null
  if (efeitoFaixa === null) {
    const ca = colchetes.find(([nome]) => slug(nome) === 'ca')
    if (ca !== undefined) {
      faixaTexto = ca[1]
      efeitoFaixa = 'ca'
    }
  }
  const categoria = categoriaDaTecnica(t.tipo, efeitoFaixa)
  const textoCompleto = t.texto_verbatim ?? t.efeito ?? ''
  const descricao = (t.descricao ?? '').trim()
  // O efeito é o que sobra do texto completo depois da descrição e das etiquetas.
  let efeito = typeof t.efeito === 'string' && t.texto_verbatim ? prosaDaTecnica(t.efeito) : descricaoEEfeito(textoCompleto).efeito
  if (efeito.length === 0 && categoria !== 'ofensiva') {
    const prosa = prosaDaTecnica(textoCompleto.replace(/^\[[^\]]*\]\s*:\s*/, ''))
    if (prosa !== descricao) efeito = prosa.startsWith(descricao) ? prosa.slice(descricao.length).trim() : prosa
  }
  return {
    nome: t.nome.trim(),
    categoria,
    rank: rankOuNull(t.rank),
    rankTexto: t.rank ?? '',
    custoKi: numeroDoCusto(t.custo),
    custoTexto: (t.custo ?? '').replace(/^\s*ki\s*:\s*/i, ''),
    faixa: faixaDoTexto(faixaTexto),
    efeitoDaFaixa: efeitoFaixa,
    faixaTexto,
    alcance: (t.alcance ?? '').trim(),
    rotulosPositivos: rotulosImpressos(t.rotulos_positivos),
    rotulosNegativos: rotulosImpressos(t.rotulos_negativos),
    descricao,
    efeito,
    pagina: typeof t.pagina === 'number' ? t.pagina : null,
  }
}

/** "Super Saiyajin – Estágio 2" → { estagio: 2, estagioTexto: "Estágio 2" }. */
function estagioDoNome(texto) {
  const m = /Est[áa]gio\s+(\d+|Especial)/i.exec(texto ?? '')
  if (m === null) return { estagio: null, estagioTexto: '' }
  return { estagio: /^\d+$/.test(m[1]) ? Number(m[1]) : null, estagioTexto: m[0] }
}

function semEtiquetas(texto) {
  return String(texto ?? '')
    .replace(ETIQUETA, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function paragrafos(texto) {
  return semEtiquetas(texto)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

/** Transformação da raça do livro básico (j1-racas). */
function transformacaoDoBasico(t, pagina) {
  return {
    id: slug(t.nome),
    nome: t.nome,
    ...estagioDoNome(t.nome),
    ep: typeof t.ep_bonus === 'number' ? t.ep_bonus : null,
    custoKi: typeof t.custo_ki === 'number' ? t.custo_ki : numeroDoCusto(t.custo),
    custoTexto: t.custo ?? '',
    requisito: t.requisito ?? '',
    duracao: '',
    efeitos: Array.isArray(t.efeitos) ? t.efeitos.slice() : paragrafos(t.efeitos),
    pagina,
  }
}

/** Transformação de suplemento: o custo pode trazer "[EP: +02] [KI: 06]" ou texto livre. */
function transformacaoDoSuplemento(t) {
  const custo = t.custo ?? ''
  const ep = /\[\s*EP\s*:\s*([+-]?\d+)\s*\]/i.exec(custo)
  const ki = /\[\s*KI\s*:\s*(\d+)\s*\]/i.exec(custo)
  return {
    id: slug(t.nome),
    nome: t.nome,
    ...estagioDoNome(t.nome),
    ep: ep === null ? null : Number(ep[1]),
    custoKi: ki === null ? numeroDoCusto(custo) : Number(ki[1]),
    custoTexto: custo,
    requisito: t.requisito ?? '',
    duracao: t.duracao ?? '',
    efeitos: paragrafos(t.efeitos),
    pagina: null,
  }
}

/** Transformação de ficha de NPC pronto. */
function transformacaoDoNpc(t) {
  const estagioTexto = (t.estagio ?? '').trim()
  const m = /(\d+)/.exec(estagioTexto)
  const custo = t.custo_ki ?? t.custo ?? ''
  return {
    id: slug(t.nome),
    nome: t.nome,
    estagio: m === null ? null : Number(m[1]),
    estagioTexto,
    ep: numeroComSinal(t.ep ?? t.ep_bonus),
    custoKi: numeroDoCusto(custo),
    custoTexto: String(custo).replace(/^\s*ki\s*:\s*/i, ''),
    requisito: '',
    duracao: '',
    efeitos: paragrafos(t.efeitos ?? t.descricao ?? t.texto_verbatim),
    pagina: typeof t.pagina === 'number' ? t.pagina : null,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Raças
// ───────────────────────────────────────────────────────────────────────────

/** Nome de uso das 7 raças do livro básico (o PDF imprime o plural em caixa alta). */
const NOME_DA_RACA_DO_BASICO = {
  androide: 'Androide',
  freeza_clan: 'Freeza Clan',
  majin: 'Majin',
  namekuseijin: 'Namekuseijin',
  saiyajin: 'Saiyajin',
  glind: 'Glind',
  terraqueo: 'Terráqueo',
}

/**
 * Traço do json. O livro tem traço sem nome (um ✓ solto, ex.: a herança da
 * característica especial do Saiyajin Híbrido): ganha o nome que o descreve.
 */
function tracoDoJson(t) {
  return { nome: t.nome ?? 'Herança da Característica Especial', efeito: t.efeito ?? '', requisito: t.requisito ?? null }
}

function racasDoBasico() {
  const fonte = lerJson('j1-racas.json').itens
  return fonte.map((r) => {
    const nome = NOME_DA_RACA_DO_BASICO[r.id]
    if (nome === undefined) falhar(`raça do básico sem nome de uso: ${r.id}`)
    const variantes = idsUnicos(
      r.variantes.map((v) => ({
        id: slug(nomeLegivel(v.nome)),
        nome: nomeLegivel(v.nome),
        descricao: v.descricao ?? '',
        tracos: v.tracos.map(tracoDoJson),
      })),
    )
    return {
      id: slug(r.id),
      nome,
      fonte: 'basico',
      arquivo: ARQUIVO_DO_LIVRO_DO_JOGADOR,
      tipo: 'raca',
      vidaPor10k: r.vida_extra_por_10000_pdl,
      descricao: r.descricao,
      variantes,
      tracos: [],
      caracteristicasEspeciais: r.caracteristicas_especiais.map((c) => ({ nome: nomeLegivel(c.nome), efeito: c.texto, requisito: null })),
      transformacoes: idsUnicos(r.transformacoes.map((t) => transformacaoDoBasico(t, r.pagina))),
      tecnicas: [],
      talentos: [],
      outros: [],
      pagina: r.pagina,
    }
  })
}

const TIPO_DE_RACA_DO_SUPLEMENTO = { raca: 'raca', variante: 'variante', subraca: 'subraca', clan: 'clan', tecnicas: 'pacote-de-tecnicas' }

/** "Androide (Androide Absorvente)" → "androide"; raça que não é do básico (Demônio) → undefined. */
function racaBaseDoTexto(texto) {
  if (typeof texto !== 'string') return undefined
  const s = slug(texto)
  for (const id of ['androide', 'freeza-clan', 'majin', 'namekuseijin', 'saiyajin', 'glind', 'terraqueo']) if (s.startsWith(id)) return id
  return undefined
}

function vidaDoSuplemento(valor) {
  if (typeof valor === 'number') return valor
  if (typeof valor !== 'string') return null
  const m = /\+\s*(\d+)/.exec(valor)
  return m === null ? null : Number(m[1])
}

const TITULO_DO_OUTRO = {
  nota: 'Nota',
  recurso: 'Recurso',
  recursos_novos: 'Recursos novos',
  subtipos_por_cor: 'Subtipos por cor',
  tabela_sentimento_motriz: 'Sentimento motriz por atributo',
  personagem_inspiracao: 'Inspiração',
  talento_gratuito: 'Talento gratuito',
}

/** Notas que só descrevem a transcrição (não são regra) ficam de fora. */
const NOTA_SO_DE_TRANSCRICAO = /(foram colocadas em|Suplemento só de técnicas|Sem traços raciais|no original\.?$)/i

function outrosDoSuplemento(outros) {
  const lista = []
  for (const [k, v] of Object.entries(outros ?? {})) {
    if (k === 'md' || k === 'vida_por_10000_pdl' || v === null) continue
    const titulo = TITULO_DO_OUTRO[k]
    if (titulo === undefined) falhar(`campo "outros.${k}" de suplemento sem título`)
    if (k === 'nota' && NOTA_SO_DE_TRANSCRICAO.test(v)) continue
    let texto
    if (Array.isArray(v)) texto = v.join('\n')
    else if (typeof v === 'object')
      texto = Object.entries(v)
        .map(([a, b]) => `${a}: ${b}`)
        .join('\n')
    else texto = String(v)
    lista.push({ titulo, texto })
  }
  return lista
}

/** "RUPTURA PREMATURA (Passiva)" → nome "Ruptura Prematura", tipo passiva. */
function talentoDoSuplemento(t) {
  const m = /^(.*?)\s*\((Passiva|Ativa|Passiva\/Ativa|Ativa\/Passiva)\)\s*$/i.exec(t.nome)
  const nome = nomeLegivel(m === null ? t.nome : m[1])
  const tipoTexto = m === null ? '' : m[2]
  return { id: slug(nome), nome, tipo: tipoDoTalento(tipoTexto), tipoTexto, requisito: t.requisito ?? null, efeito: t.efeito, pagina: null, fonte: 'suplemento' }
}

function racasDosSuplementos() {
  const fonte = [...lerJson('supA-racas.json'), ...lerJson('supB-racas.json')]
  return fonte.map((r) => {
    const tipo = TIPO_DE_RACA_DO_SUPLEMENTO[r.tipo]
    if (tipo === undefined) falhar(`tipo de raça desconhecido em ${r.id}: ${r.tipo}`)
    return {
      id: slug(r.id),
      nome: r.nome,
      fonte: 'suplemento',
      arquivo: r.arquivo,
      tipo,
      racaBase: racaBaseDoTexto(r.raca_base),
      vidaPor10k: vidaDoSuplemento(r.outros?.vida_por_10000_pdl),
      descricao: r.descricao_curta ?? '',
      variantes: [],
      tracos: r.tracos.map(tracoDoJson),
      caracteristicasEspeciais: [],
      transformacoes: idsUnicos(r.transformacoes.map(transformacaoDoSuplemento)),
      tecnicas: r.tecnicas.map(tecnicaDoSuplemento),
      talentos: idsUnicos(r.talentos.map(talentoDoSuplemento)),
      outros: outrosDoSuplemento(r.outros),
      pagina: null,
    }
  })
}

/** O md em seções: { titulo, corpo } por título (#, ##, ###...). */
function secoesDoMd(md) {
  const secoes = []
  let atual = { titulo: '', corpo: [] }
  for (const linha of md.split('\n')) {
    const m = /^#{1,6}\s+(.*)$/.exec(linha)
    if (m !== null) {
      secoes.push(atual)
      atual = { titulo: m[1].trim(), corpo: [] }
    } else atual.corpo.push(linha)
  }
  secoes.push(atual)
  return secoes.map((s) => ({ titulo: s.titulo, corpo: s.corpo.join('\n').trim() }))
}

function secao(secoes, padrao, arquivo) {
  const achada = secoes.find((s) => padrao.test(s.titulo))
  if (achada === undefined) falhar(`seção ${padrao} não achada em ${arquivo}`)
  return achada
}

/** Itens "- Nome: efeito" (com ou sem ➢ e negrito) de um corpo de seção. */
function itensNomeados(corpo) {
  const itens = []
  for (const linha of corpo.split('\n')) {
    const m = /^-\s*(?:[✓➢➔•]\s*)?(?:\*\*)?([^:*]{2,80}?)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.+)$/.exec(linha.trim())
    if (m !== null) itens.push({ nome: m[1].trim(), efeito: m[2].trim() })
  }
  return itens
}

/** Parágrafos que não são item de lista. */
function textoCorrido(corpo) {
  return corpo
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith('-') && !p.startsWith('>'))
    .join('\n\n')
}

/** Corpo inteiro como texto de regra (itens viram linhas "- ..."). */
function textoDaRegra(corpo) {
  return corpo
    .split('\n')
    .map((l) => l.replace(/^-\s*[✓➢➔•]\s*/, '- ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Raças das regras das sagas e do Enma Daioh: só existem em md, sem json. */
function racasDasSagas() {
  const racas = []

  {
    const arquivo = 'saga-saiyajins-regras.md'
    const s = secoesDoMd(lerMd(arquivo))
    const abertura = secao(s, /^3\.0 OS SAIBAMANS/, arquivo)
    const variacao = secao(s, /^3\.0\.1 SAIBAMANS/, arquivo)
    racas.push({
      id: 'saibaman-saga-saiyajin',
      nome: 'Saibaman (Saga Saiyajin)',
      fonte: 'suplemento',
      arquivo: 'Saga Saiyajins.pdf',
      tipo: 'raca',
      // "A cada 10.000 PDL base, um Saibaman adiciona +08 extras na sua vida."
      vidaPor10k: 8,
      descricao: textoCorrido(abertura.corpo),
      variantes: [],
      tracos: itensNomeados(variacao.corpo).map((t) => ({ ...t, requisito: null })),
      caracteristicasEspeciais: s
        .filter((x) => /CARACTER[ÍI]STICA ESPECIAL/i.test(x.titulo))
        .map((x) => ({ nome: nomeLegivel(x.titulo.replace(/^.*ESPECIAL:\s*/i, '')), efeito: textoDaRegra(x.corpo), requisito: null })),
      transformacoes: [],
      tecnicas: [],
      talentos: [],
      outros: [],
      pagina: null,
    })
  }

  {
    const arquivo = 'saga-broly-regras.md'
    const s = secoesDoMd(lerMd(arquivo))
    const lendario = secao(s, /^1\.0\.1/, arquivo)
    const rotulos = secao(s, /R[ÓO]TULOS LEND[ÁA]RIOS/i, arquivo)
    const lss = secao(s, /O LEND[ÁA]RIO SUPER SAIYAJIN/i, arquivo)
    const estagios = itensNomeados(lss.corpo).map((t) => {
      const ep = /\[\s*EP\s*:\s*([+-]?\d+)\s*\]/i.exec(t.efeito)
      const ki = /\[\s*KI\s*:\s*(\d+)\s*\]/i.exec(t.efeito)
      return {
        id: slug(t.nome),
        nome: t.nome,
        ...estagioDoNome(t.nome),
        ep: ep === null ? null : Number(ep[1]),
        custoKi: ki === null ? null : Number(ki[1]),
        custoTexto: ki === null ? '' : ki[0],
        requisito: 'Saiyajin Lendário',
        duracao: '',
        efeitos: [semEtiquetas(t.efeito)],
        pagina: null,
      }
    })
    racas.push({
      id: 'saiyajin-lendario',
      nome: 'Saiyajin Lendário',
      fonte: 'suplemento',
      arquivo: 'Broly.pdf',
      tipo: 'variante',
      racaBase: 'saiyajin',
      // A variante não repete a vida extra: vale a do Saiyajin.
      vidaPor10k: null,
      descricao: textoCorrido(lendario.corpo),
      variantes: [],
      tracos: itensNomeados(lendario.corpo).map((t) => ({ ...t, requisito: null })),
      caracteristicasEspeciais: [{ nome: 'O Lendário Super Saiyajin', efeito: textoCorrido(lss.corpo).replace(/\n\n[^\n]*:\s*$/, ''), requisito: null }],
      transformacoes: estagios,
      tecnicas: [],
      talentos: [],
      outros: [{ titulo: 'Rótulos Lendários', texto: textoDaRegra(rotulos.corpo) }],
      pagina: null,
    })
  }

  {
    const arquivo = 'saga-super-heroes-regras.md'
    const s = secoesDoMd(lerMd(arquivo))
    // O título do capítulo também cita "Androides Gamma": casa só o da seção 1.0.1.
    const gamma = secao(s, /^1\.0\.1 — ANDROIDES GAMMA/i, arquivo)
    const arma = secao(s, /ARMA ASSINATURA/i, arquivo)
    racas.push({
      id: 'androide-gamma',
      nome: 'Androide Gamma',
      fonte: 'suplemento',
      arquivo: 'Saga Super Hero.pdf',
      tipo: 'variante',
      racaBase: 'androide',
      // "A cada 10.000 PDL base, um Androide adiciona +10 extra na sua vida."
      vidaPor10k: 10,
      descricao: textoCorrido(gamma.corpo),
      variantes: [],
      tracos: itensNomeados(gamma.corpo).map((t) => ({ ...t, requisito: null })),
      caracteristicasEspeciais: [{ nome: 'Arma Assinatura', efeito: textoDaRegra(arma.corpo), requisito: null }],
      transformacoes: [],
      tecnicas: [],
      talentos: [],
      outros: [],
      pagina: null,
    })
  }

  {
    const arquivo = 'nar-enma-02-raca-bonus-cla-garunpo.md'
    const s = secoesDoMd(lerMd(arquivo))
    const genese = secao(s, /^1\.0 A G[ÊE]NESE/i, arquivo)
    const variacao = secao(s, /^4\.0\.1 CL[ÃA] GARUNPO/i, arquivo)
    const pacto = secao(s, /PACTO DO DRAG[ÃA]O SOMBRIO/i, arquivo)
    const marcos = s
      .filter((x) => /^\[Pacto Sombrio/i.test(x.titulo))
      .map((x) => {
        const pdl = /([\d.,]+)\s*PDL/i.exec(x.titulo)
        return { nome: x.titulo.replace(/^\[|\]$/g, ''), efeito: textoDaRegra(x.corpo), requisito: pdl === null ? null : `${pdl[1].replace(',', '.')} PDL` }
      })
    racas.push({
      id: 'cla-garunpo',
      nome: 'Clã Garunpo',
      fonte: 'suplemento',
      arquivo: 'Enma Daioh - 2025.pdf',
      tipo: 'variante',
      racaBase: 'namekuseijin',
      // "A cada 10.000 PDL base, um Namekuseijin adiciona +10 extra na sua vida."
      vidaPor10k: 10,
      descricao: genese.corpo.split(/\n{2,}/)[0].trim(),
      variantes: [],
      tracos: itensNomeados(variacao.corpo).map((t) => ({ ...t, requisito: null })),
      caracteristicasEspeciais: [{ nome: 'Pacto do Dragão Sombrio', efeito: textoCorrido(pacto.corpo), requisito: null }, ...marcos],
      transformacoes: [],
      tecnicas: [],
      talentos: [],
      outros: [],
      // Capítulo II do Enma Daioh, p. 34-39 impressas.
      pagina: 34,
    })
  }

  return racas
}

function gerarRacas() {
  const racas = [...racasDoBasico(), ...racasDosSuplementos(), ...racasDasSagas()]
  const ids = new Set()
  for (const r of racas) {
    if (ids.has(r.id)) falhar(`id de raça repetido: ${r.id}`)
    ids.add(r.id)
    if (r.racaBase !== undefined && !ids.has(r.racaBase) && !racas.some((x) => x.id === r.racaBase)) falhar(`raça base desconhecida em ${r.id}: ${r.racaBase}`)
  }
  return racas
}

// ───────────────────────────────────────────────────────────────────────────
// Talentos, movimentos, rótulos, ranks
// ───────────────────────────────────────────────────────────────────────────

function tipoDoTalento(texto) {
  const s = slug(texto ?? '')
  if (s === 'passiva') return 'passiva'
  if (s === 'ativa') return 'ativa'
  if (s === 'passiva-ativa' || s === 'ativa-passiva') return 'passiva-ativa'
  return null
}

function gerarTalentos() {
  return lerJson('j1-talentos.json').itens.map((t) => ({
    id: t.id,
    nome: nomeLegivel(t.nome),
    tipo: tipoDoTalento(t.tipo),
    tipoTexto: t.tipo ?? '',
    requisito: t.requisitos ?? null,
    efeito: t.efeito,
    pagina: t.pagina ?? null,
    fonte: 'basico',
  }))
}

const COMBINA_COM = { tecnicas_ofensivas_fisicas: 'fisico', tecnicas_ofensivas_ki: 'ki' }

function gerarMovimentos() {
  return lerJson('j1-movimentos_marciais.json').itens.map((m) => ({
    id: m.id,
    nome: nomeLegivel(m.nome),
    combinaCom: m.combinavel_com === null ? null : (COMBINA_COM[m.combinavel_com] ?? falhar(`combinavel_com desconhecido: ${m.combinavel_com}`)),
    custoKi: typeof m.custo_ki === 'number' ? m.custo_ki : numeroDoCusto(m.custo_ki),
    custoTexto: m.custo_ki_texto ?? '',
    requisito: m.requisitos ?? null,
    testes: m.testes ?? [],
    efeito: m.efeito,
    pagina: m.pagina ?? null,
  }))
}

function custoDoRotulo(cp) {
  switch (cp.tipo) {
    case 'fixo':
      return { tipo: 'fixo', pontos: cp.min }
    case 'faixa':
      return { tipo: 'faixa', minimo: cp.min, maximo: cp.max }
    case 'variavel':
      return { tipo: 'variavel', minimo: null }
    case 'variavel_com_minimo':
      return { tipo: 'variavel', minimo: cp.min }
    case 'consome_todos_positivos_base':
      return { tipo: 'consome-tudo' }
    case 'igual_ao_efeito_negativo':
      return { tipo: 'igual-ao-efeito-negativo' }
    default:
      return falhar(`custo de rótulo desconhecido: ${cp.tipo}`)
  }
}

const CAMPOS_DE_KI = { inicial: 'inicial', por_ponto_extra: 'porPontoExtra', por_rotulo: 'porRotulo', por_ponto_negativo: 'porPontoNegativo', multiplicador: 'multiplicador' }

function modificadorDeKi(mk) {
  if (mk === null || mk === undefined) return null
  const saida = { inicial: null, porPontoExtra: null, porRotulo: null, porPontoNegativo: null, multiplicador: null, outros: {}, nota: null }
  for (const [k, v] of Object.entries(mk)) {
    if (k === 'nota') saida.nota = v
    else if (CAMPOS_DE_KI[k] !== undefined) saida[CAMPOS_DE_KI[k]] = typeof v === 'number' ? v : null
    else if (v !== null) saida.outros[k] = v
  }
  return saida
}

function alcanceDoRotulo(al) {
  if (al === null || al === undefined) return null
  const medidasM = {}
  for (const [k, v] of Object.entries(al)) if (typeof v === 'number' && k !== 'inicial_m' && k !== 'por_ponto_extra_m') medidasM[k] = v
  return { forma: al.forma, inicialM: al.inicial_m ?? null, porPontoExtraM: al.por_ponto_extra_m ?? null, medidasM }
}

function gerarRotulos() {
  const fonte = lerJson('j2-rotulos.json')
  const rotulos = fonte.rotulos.map((r) => {
    const custo = custoDoRotulo(r.custo_pontos)
    return {
      id: slug(r.nome),
      nome: r.nome,
      categoria: r.categoria,
      custo,
      custoTexto: r.custo,
      modificadorDeKi: modificadorDeKi(r.modificador_ki),
      variavel: custo.tipo === 'variavel' || custo.tipo === 'faixa' || custo.tipo === 'igual-ao-efeito-negativo',
      acumula: r.acumula ?? null,
      alcance: alcanceDoRotulo(r.alcance),
      restricoes: r.restricoes ?? [],
      efeito: r.efeito,
      pagina: r.pagina,
    }
  })
  return idsUnicos(rotulos)
}

function gerarRanks() {
  return lerJson('j2-ranks_de_tecnica.json').ranks.map((r) => ({
    rank: r.rank,
    nome: r.nome,
    pdl: r.pdl,
    danoMin: r.dano_base_min,
    danoMax: r.dano_base_max,
    kiMin: r.custo_ki_min,
    kiMax: r.custo_ki_max,
    pontosDeRotuloBase: r.rotulos_positivos_base,
    pontosDeRotuloMax: r.rotulos_total_maximo,
    slots: r.slots_st,
    kiMinimoDaEspecial: r.tecnica_especial_ki_minimo,
    pagina: r.pagina,
  }))
}

function gerarTransformacoes() {
  const fonte = lerJson('j2-transformacoes.json').exemplo_super_saiyajin
  return fonte.estagios.map((e) => ({
    id: `super-saiyajin-estagio-${e.estagio}`,
    nome: `Super Saiyajin – Estágio ${e.estagio}`,
    estagio: e.estagio,
    estagioTexto: `Estágio ${e.estagio}`,
    ep: numeroComSinal(e.ep),
    custoKi: e.ki,
    custoTexto: `[KI: ${String(e.ki).padStart(2, '0')}]`,
    requisito: e.estagio === 1 ? fonte.conceito_base : `Super Saiyajin – Estágio ${e.estagio - 1}`,
    duracao: '',
    efeitos: [e.texto],
    pagina: e.pagina,
  }))
}

// ───────────────────────────────────────────────────────────────────────────
// Itens, condições, ações, estágios, tabelas
// ───────────────────────────────────────────────────────────────────────────

const ORIGEM_DA_TABELA = { '8.2 exemplos de carga': 'Exemplo de carga (8.2)', '8.3 sugestões': 'Sugestão de item (8.3)' }

function gerarItens() {
  const fonte = lerJson('j3-itens.json')
  const itens = fonte.itens.map((i) => ({
    id: slug(i.nome),
    nome: i.nome,
    tipo: i.tipo ?? null,
    carga: i.carga,
    efeito: i.efeito ?? '',
    bonusCA: 0,
    kiPorTurno: 0,
    observacoes: [ORIGEM_DA_TABELA[i.tabela] ?? i.tabela, i.nota].filter(Boolean).join(' · '),
    pagina: i.pagina,
  }))
  for (const a of fonte.armaduras.lista)
    itens.push({
      id: slug(a.nome),
      nome: a.nome,
      tipo: a.tipo ?? 'Armadura',
      carga: a.carga,
      efeito: a.efeito ?? '',
      bonusCA: a.bonus_ca,
      kiPorTurno: a.penalidade_ki_por_turno,
      observacoes: [a.penalidade && a.penalidade !== 'Nenhuma' ? `Penalidade: ${a.penalidade}` : '', a.observacoes].filter(Boolean).join(' · '),
      pagina: fonte.armaduras.pagina,
    })
  return { itens: idsUnicos(itens), carga: fonte.regra_de_carga }
}

/** Quando cada condição acaba (9.7, p. 120-123): lido do texto e conferido à mão. */
const EXPIRACAO_DA_CONDICAO = {
  atordoado: { expira: 'fim-da-rodada', atributos: [] },
  desnorteado: { expira: 'teste', atributos: ['sab', 'con'] },
  quebrado: { expira: 'fim-do-combate', atributos: [] },
  enraizado: { expira: 'teste', atributos: ['des'] },
  envenenado: { expira: 'teste', atributos: ['con'] },
  sangrando: { expira: 'evento', atributos: [] },
  silenciado: { expira: 'fim-do-proximo-turno', atributos: [] },
  sobrecarregado: { expira: 'evento', atributos: [] },
  'quebra-de-guarda': { expira: 'fim-do-proximo-turno', atributos: [] },
  caido: { expira: 'evento', atributos: [] },
  desequilibrado: { expira: 'fim-do-proximo-turno', atributos: [] },
  exposto: { expira: 'inicio-do-proximo-turno', atributos: [] },
  paralisado: { expira: 'fim-do-proximo-turno', atributos: [] },
  intimidado: { expira: 'teste', atributos: ['sab'] },
  cego: { expira: 'fim-do-proximo-turno', atributos: [] },
  'lacuna-mental': { expira: 'contagem', atributos: [], turnos: 2 },
  instavel: { expira: 'teste', atributos: ['int', 'pod'] },
  'confusao-mental': { expira: 'teste', atributos: ['sab'] },
  'controle-mental': { expira: 'evento', atributos: [] },
  'alucinacao-sensorial': { expira: 'fim-do-proximo-turno', atributos: [] },
}

function gerarCondicoes() {
  return lerJson('j3-condicoes.json').condicoes.map((c) => {
    const id = slug(c.nome)
    const regra = EXPIRACAO_DA_CONDICAO[id]
    if (regra === undefined) falhar(`condição sem expiração conferida: ${c.nome}`)
    return {
      id,
      nome: c.nome,
      valor: c.valor ?? null,
      efeito: c.efeito,
      duracao: c.duracao ?? '',
      expira: regra.expira,
      atributosDoTeste: regra.atributos,
      turnos: regra.turnos ?? null,
      comoRemover: c.como_remover ?? null,
      pagina: c.pagina,
    }
  })
}

function momentoDaAcao(tipo) {
  const s = slug(tipo)
  if (s.startsWith('automatica')) return 'automatica'
  if (s.startsWith('situacao')) return 'situacao'
  if (s.startsWith('reacao') || s.startsWith('turno-de-reacao')) return 'reacao'
  if (s.includes('livre') || s.includes('gratuita')) return 'livre'
  return 'acao'
}

function gerarAcoes() {
  return idsUnicos(
    lerJson('j3-acoes_de_combate.json').acoes.map((a) => {
      const fixo = /^\s*(\d+)(?:\s*Ki)?\s*$/i.exec(a.custo)
      return {
        id: slug(a.nome),
        nome: a.nome,
        tipoDeAcao: a.tipo_de_acao,
        momento: momentoDaAcao(a.tipo_de_acao),
        custo: a.custo,
        custoKi: fixo === null ? null : Number(fixo[1]),
        efeito: a.efeito,
        pagina: a.pagina,
      }
    }),
  )
}

const IDS_DOS_ESTAGIOS = ['erro', 'minimo', 'medio', 'completo']

function gerarEstagios() {
  const fonte = lerJson('j3-estagios_de_dano.json').estagios
  if (fonte.length !== IDS_DOS_ESTAGIOS.length) falhar('j3-estagios_de_dano.json não tem os 4 estágios')
  return fonte.map((e, i) => ({
    id: IDS_DOS_ESTAGIOS[i],
    nome: e.nome,
    // O livro diz "margem <= 0" para o erro: sem piso, teto 0.
    margemMin: e.margem_min,
    margemMax: e.margem_max,
    fracao: e.fracao_dano,
    efeito: e.efeitos,
  }))
}

/** "2 a 4" → { de: 2, ate: 4 }; "1" → { de: 1, ate: 1 }; "5 +" → { de: 5, ate: null }. */
function intervaloDoTexto(texto) {
  const t = String(texto).trim()
  let m = /^(-?\d+)\s*a\s*(-?\d+)$/.exec(t)
  if (m !== null) return { de: Number(m[1]), ate: Number(m[2]) }
  m = /^(-?\d+)\s*\+$/.exec(t)
  if (m !== null) return { de: Number(m[1]), ate: null }
  m = /^(-?\d+)$/.exec(t)
  if (m !== null) return { de: Number(m[1]), ate: Number(m[1]) }
  return falhar(`intervalo ilegível na tabela de EP: "${texto}"`)
}

function gerarTabelas() {
  const ep = lerJson('j1-escala_de_poder.json')
  const base = ep.base_sem_diferenca
  const semDiferenca = {
    difEp: 0,
    minimo: intervaloDoTexto(base.minimo),
    medio: intervaloDoTexto(base.medio),
    completo: intervaloDoTexto(base.completo),
    texto: { minimo: base.minimo, medio: base.medio, completo: base.completo },
  }
  const linhas = ep.tabela_intervalos.linhas.map((l) => ({
    difEp: l.dif_ep,
    minimo: intervaloDoTexto(l.minimo),
    medio: intervaloDoTexto(l.medio),
    completo: intervaloDoTexto(l.completo),
    texto: { minimo: l.minimo, medio: l.medio, completo: l.completo },
  }))

  const nd = lerJson('nar-nd-vida-por-golpe.json')
  const categoria = { Comum: 'comum', Elite: 'elite', Chefão: 'chefao' }
  const vidaPorGolpe = {}
  for (const [nome, linha] of Object.entries(nd.vida_por_golpe)) {
    if (categoria[nome] === undefined) falhar(`categoria de NPC desconhecida: ${nome}`)
    vidaPorGolpe[categoria[nome]] = linha
  }

  const pnj = lerJson('nar-atributos-pnj.json').categorias
  const atributosDePnj = {}
  for (const [nome, c] of Object.entries(pnj)) {
    atributosDePnj[categoria[nome]] = {
      teto: c.teto,
      segundoAtributoMax: c.segundo_atributo_max ?? null,
      demaisMin: c.demais_min ?? null,
      demaisMax: c.demais_max ?? null,
      excedente: c.excedente ? { acimaDe: c.excedente.acima_de, reduzirPorPonto: c.excedente.reduzir_de_outro_atributo_por_ponto } : null,
      texto: c.texto_verbatim,
    }
  }

  const escala = lerJson('nar-escala-poder.json')
  const ameaca = escala.ameaca_por_diferenca_de_escala.faixas.map((f) => ({ diferenca: f.diferenca, dificuldade: f.dificuldade, texto: f.texto_verbatim }))
  const epInicial = escala.escala_inicial_de_campanha.faixas.map((f) => ({ ep: f.ep, uso: f.uso }))
  return { semDiferenca, linhas, vidaPorGolpe, atributosDePnj, ameaca, epInicial }
}

// ───────────────────────────────────────────────────────────────────────────
// NPCs prontos
// ───────────────────────────────────────────────────────────────────────────

const ATRIBUTO_DO_NPC = { FOR: 'for', DES: 'des', CON: 'con', INT: 'int', SAB: 'sab', POD: 'pod', PRE: 'pre' }
const CATEGORIA_DO_NPC = { comum: 'comum', elite: 'elite', chefao: 'chefao' }

function atributosDoNpc(fonte, nome) {
  const saida = {}
  for (const [sigla, id] of Object.entries(ATRIBUTO_DO_NPC)) {
    const v = fonte?.[sigla]
    const valor = typeof v === 'number' ? v : v?.valor
    if (typeof valor !== 'number') falhar(`NPC ${nome} sem ${sigla}`)
    saida[id] = valor
  }
  return saida
}

/** "9,0m" → 9. */
function metros(texto) {
  const m = /(\d+(?:[.,]\d+)?)/.exec(String(texto ?? ''))
  return m === null ? 9 : Number(m[1].replace(',', '.'))
}

function textoDoBatimento(b) {
  if (typeof b === 'string') return `- ${b}`
  if (b && typeof b === 'object') return `- ${Object.values(b).filter((v) => typeof v === 'string' || typeof v === 'number').join(': ')}`
  return ''
}

function npcBase(n, colecao, extras) {
  const categoria = CATEGORIA_DO_NPC[slug(n.categoria)]
  if (categoria === undefined) falhar(`categoria desconhecida no NPC ${n.nome}: ${n.categoria}`)
  const rank = rankOuNull(n.rank)
  if (rank === null) falhar(`rank desconhecido no NPC ${n.nome}: ${n.rank}`)
  if ((n.talentos ?? []).length > 0 || (n.pericias ?? []).length > 0) falhar(`NPC ${n.nome} tem talentos/perícias: o modelo não tem onde guardar`)
  return {
    id: `${colecao}/${slug(n.nome)}`,
    nome: n.nome,
    colecao,
    categoria,
    rank,
    atributos: atributosDoNpc(n.atributos, n.nome),
    pk: n.PK,
    ca: n.CA,
    vel: metros(n.VEL),
    ep: n.EP,
    tecnicas: n.tecnicas.map(tecnicaDoNpc),
    transformacoes: idsUnicos(n.transformacoes.map(transformacaoDoNpc)),
    ...extras,
  }
}

const COLECAO_DA_SAGA = { saiyajins: 'saiyajins', freeza: 'freeza', 'super-heroes': 'super-heroes', 'zero-humanos': 'zero-humanos', broly: 'broly' }

function npcsDasSagas() {
  const arquivos = ['saga-npcs-saiyajins.json', 'saga-npcs-freeza.json', 'saga-npcs-broly.json', 'saga-npcs-super-heroes.json', 'saga-npcs-zero-humanos.json']
  const npcs = []
  for (const arquivo of arquivos) {
    const fonte = lerJson(arquivo)
    const colecao = COLECAO_DA_SAGA[fonte.saga_chave]
    if (colecao === undefined) falhar(`saga desconhecida em ${arquivo}: ${fonte.saga_chave}`)
    if (fonte.npcs.length !== fonte.total_npcs) falhar(`${arquivo}: total_npcs não bate com a lista`)
    for (const n of fonte.npcs) {
      const outros = n.outros ?? []
      const historia = outros
        .filter((o) => /cabecalho|introducao/i.test(slug(o.secao)))
        .map((o) => o.texto)
        .join('\n\n')
      const notas = [
        ...outros.filter((o) => !/cabecalho|introducao/i.test(slug(o.secao))).map((o) => `${o.secao}: ${o.texto}`),
        ...(fonte.avisos_extracao ?? []).filter((a) => a.includes(n.nome.split(',')[0])),
      ]
      npcs.push(
        npcBase(n, colecao, {
          // Broly vem do filme, não de uma saga do livro (o modelo pede null).
          saga: colecao === 'broly' ? null : n.saga,
          fonte: n.arquivo ?? fonte.fonte,
          criador: null,
          passivas: (n.passivas_ativas ?? []).map((p) => ({ nome: p.nome, tipo: p.tipo, texto: p.texto, pagina: p.pagina ?? null })),
          historia,
          notas,
          pagina: n.pagina_impressa ?? n.pagina ?? null,
        }),
      )
    }
  }
  return npcs
}

function npcsDoEnma() {
  return lerJson('nar-npcs-enma.json').map((n) =>
    npcBase(n, 'enma', {
      saga: null,
      fonte: 'Enma Daioh - 2025.pdf',
      criador: n.criador ?? null,
      passivas: (n.passivas_e_ativas_unicas ?? []).map((p) => ({
        nome: p.nome,
        tipo: p.tipo,
        texto: [p.texto_intro_verbatim, p.texto_verbatim, (p.batimentos ?? []).map(textoDoBatimento).join('\n')].filter((t) => typeof t === 'string' && t.trim().length > 0).join('\n\n'),
        pagina: p.pagina ?? null,
      })),
      historia: n.background_verbatim ?? '',
      notas: n.outros ?? [],
      pagina: n.pagina?.inicio ?? null,
    }),
  )
}

function gerarNpcs() {
  const npcs = [...npcsDasSagas(), ...npcsDoEnma()]
  const ids = new Set()
  for (const n of npcs) {
    if (ids.has(n.id)) falhar(`id de NPC repetido: ${n.id}`)
    ids.add(n.id)
  }
  // Ordem dos campos como no modelo (NpcProntoDBT).
  return npcs.map((n) => ({
    id: n.id,
    nome: n.nome,
    colecao: n.colecao,
    saga: n.saga,
    fonte: n.fonte,
    criador: n.criador,
    categoria: n.categoria,
    rank: n.rank,
    atributos: n.atributos,
    pk: n.pk,
    ca: n.ca,
    vel: n.vel,
    ep: n.ep,
    tecnicas: n.tecnicas,
    transformacoes: n.transformacoes,
    passivas: n.passivas,
    historia: n.historia,
    notas: n.notas,
    pagina: n.pagina,
  }))
}

// ───────────────────────────────────────────────────────────────────────────
// Livro
// ───────────────────────────────────────────────────────────────────────────

/**
 * Notas do transcritor que viram uma linha "*Nota:*" no livro: só as que
 * avisam contradição ou ambiguidade de regra (as outras saem). Chave =
 * arquivo; `casa` testa o texto da nota.
 */
const NOTAS_QUE_FICAM = {
  'j1-15-movimentos-marciais.md': [{ casa: /símbolo/, nota: 'o ∗ depois do nome marca o movimento que pode ir junto de uma técnica ofensiva: *(∗ físico)* com técnica física, *(∗ Ki)* com técnica de Ki.' }],
  'j2-61-rotulos-base.md': [{ casa: /^Fonte/, nota: 'o número entre parênteses depois do nome é o custo em Pontos de Rótulo.' }],
  'j2-62-rotulos-de-tipo-de-dano.md': [
    { casa: /^Fonte/, nota: 'o número entre parênteses depois do nome é o custo em Pontos de Rótulo.' },
    { casa: /Dano Espiritual/, nota: 'no original, o texto de [Dano Espiritual] repete o de [Dano de Drenagem].' },
  ],
  'j2-63-rotulos-de-ki.md': [{ casa: /^Fonte/, nota: 'o número entre parênteses depois do nome é o custo em Pontos de Rótulo; "(?)" consome todos os pontos positivos base do rank.' }],
  'j2-64-rotulos-genericos.md': [{ casa: /^Fonte/, nota: 'o número entre parênteses depois do nome é o custo em Pontos de Rótulo; "(?)" consome todos os pontos positivos base do rank.' }],
  'j2-65-rotulos-negativos.md': [{ casa: /^Fonte/, nota: 'o número entre parênteses depois do nome é quanto o rótulo negativo devolve em Pontos de Rótulo.' }],
  'j2-67-exemplo-de-criacao-de-tecnica.md': [
    {
      casa: /inconsist/,
      nota: 'os números do exemplo não batem entre si no original: o 4º passo soma +4 de Ki pelo Alcance Engolfante (a definição em 6.1 diz +3) e chega a Ki 12, mas a ficha final diz [KI: 11]; o 5º passo dá dano mínimo 11 e a ficha diz 12.',
    },
  ],
  'j2-70-criacao-de-transformacoes.md': [{ casa: /Estágio 1\/2\/3/, nota: 'o exemplo usa EP +2/+3/+4 e Ki 6/9/12; a regra logo abaixo diz EP = número do estágio e Ki = 3 × estágio. As duas versões estão no original.' }],
  'j3-08-3-itens.md': [
    { casa: /Radar/, nota: 'o Radar das Esferas do Dragão ocupa 2 slots na tabela de 8.2 e 1 nesta; os dois valores são do original.' },
    { casa: /Armadura de batalha completa/, nota: 'a tabela de 8.2 dá 3 slots à "Armadura de batalha completa"; esta dá 2, 4 ou 6 conforme o tipo.' },
  ],
  'j3-08-4-estagios-de-dano.md': [{ casa: /CA 18/, nota: 'pela regra, um resultado igual à CA também erra (o exemplo só cita o 17).' }],
  'j3-08-6-slots-de-tecnicas.md': [
    {
      casa: /inconsist/,
      nota: 'o exemplo não bate com a fórmula: com Sabedoria 14 a fórmula dá 35 ST e o exemplo calcula 22; a soma das técnicas ativas também diverge. As seções 3.0.6 e 3.0.11 dão +2 ST a cada 10.000 PDL (a mesma taxa).',
    },
  ],
  'j3-08-7-poder-de-luta.md': [{ casa: /Escala de Poder 0/, nota: 'aplicada ao pé da letra, a fórmula dá 0 com Escala de Poder 0; o texto diz que, com EP 0, o personagem tem só o valor base.' }],
  'j3-09-3-turno-de-reacao.md': [{ casa: /ST/, nota: 'esta seção fala em gastar ST nas reações; 8.5, 9.2 e o Choque de Poder (9.5.6) falam em gastar Ki. Provável troca de sigla no original (ST não se gasta por uso).' }],
  'j3-09-5-acoes-especiais.md': [
    { casa: /voo alto/, nota: 'o exemplo (solo → voo alto = 2 Ki) contradiz "2 pontos de Ki por nível alterado" (seriam 4 Ki).' },
    { casa: /três sucessos/, nota: 'o parágrafo fala em acumular três sucessos ou três fracassos; os marcadores tratam uma rolagem só como decisiva. As duas leituras estão no original.' },
  ],
  'supB-hera-seijins.md': [{ casa: /proporção 1:3/, nota: 'a frase da proporção 1:3 está incompleta no original; subentende-se +3 de dano por PK extra gasto.' }],
  'supB-makyans.md': [{ casa: /Estrela Makyo/, nota: 'na tabela da Estrela Makyo, a faixa 02~30 acumula os bônus extras das faixas 31~90.' }],
  'supB-moroans.md': [{ casa: /O Majin só absorve/, nota: 'em "Escala de Poder Assimilada" o original diz "O Majin só absorve..." (texto copiado da Absorção Majin); leia "O Moroan".' }],
  'supB-namekuseijin-mutante.md': [{ casa: /Grande e Imenso/, nota: 'o texto diz "entre o Grande e Imenso", mas a tabela vai até "Final" (60 m): ambíguo no original.' }],
  'supB-purrlians-legado-da-destruicao.md': [{ casa: /Furioso/, nota: 'o suplemento não traz a regra de vida extra a cada 10.000 PDL, e o efeito "Furioso" termina truncado no original.' }],
  'supB-tribo-glass.md': [{ casa: /Refração de Luz/, nota: '"Refração de Luz" não diz a medida do gasto de PK (provavelmente a EP do inimigo mais poderoso): ambíguo no original.' }],
}

/** Bloco de citação que é metadado da transcrição (não texto do livro). */
const METADADO = /^(\*\*)?(fonte|narrativa omitida|notas? d[eo] transcri|notas? do transcritor|observa[çc][ãa]o( do transcritor)?\s*:)/i

/** Linha solta (fora de citação) que é metadado: fonte, nota de transcrição, marca de página "*(p. impressa 98)*". */
const LINHA_DE_METADADO = /^(fonte\s*:|nota de transcri[çc][ãa]o\s*:|\*?\(p\.\s*impressa\s*\d+\)\*?$)/i

/** Marcadores do PDF no começo do item ("- ✓ ", "- ➢ ") viram item normal. */
const MARCADOR = /^(\s*)(?:-\s*)?[✓➢➔•→]\s+/

function notaQueFica(arquivo, bloco) {
  const regra = (NOTAS_QUE_FICAM[arquivo] ?? []).find((n) => n.casa.test(bloco))
  return regra === undefined ? null : `*Nota:* ${regra.nota}`
}

/** O md da transcrição → texto do capítulo na marcação leve do app. */
function limparMarkdown(md, arquivo) {
  const linhas = md.replace(/<!--[\s\S]*?-->/g, '').split('\n')
  const saida = []
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    if (/^\s*>/.test(linha)) {
      const bloco = []
      while (i < linhas.length && /^\s*>/.test(linhas[i])) bloco.push(linhas[i++].replace(/^\s*>\s?/, ''))
      i -= 1
      const texto = bloco.join('\n')
      if (METADADO.test(texto.trim())) {
        const nota = notaQueFica(arquivo, texto.trim())
        if (nota !== null) saida.push(nota)
        continue
      }
      for (const l of bloco) saida.push('> ' + tratarLinha(l))
      continue
    }
    if (LINHA_DE_METADADO.test(linha.trim())) {
      const nota = notaQueFica(arquivo, linha.trim())
      if (nota !== null) saida.push(nota)
      continue
    }
    saida.push(tratarLinha(linha))
  }
  return saida
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Quantos * sozinhos (fora de "**") a linha tem: ímpar = algum é símbolo do livro, não marcação. */
function asteriscosSoltos(linha) {
  return linha.replace(/^\s*[-*•+]\s+/, '').replace(/\*\*/g, '').split('*').length - 1
}

/** Uma linha: marcador do PDF, asterisco escapado, itálico com _ e o resumo de lore do transcritor. */
function tratarLinha(original) {
  let linha = original
  // "Símbolo (*)" e "Atribuída*" na tabela são o símbolo do livro: viram ∗ para não abrir itálico.
  if (asteriscosSoltos(linha) % 2 === 1) linha = linha.replace(/\(\*\)/g, '(∗)').replace(/(\p{L})\*(?=\s*\|)/gu, '$1∗')
  return (
    linha
      .replace(MARCADOR, '$1- ')
      // `\*` é o símbolo do livro, não marcação: vira ∗ para não abrir itálico.
      .replace(/\\\*/g, '∗')
      // A marcação leve não tem itálico com _: vira *.
      .replace(/(^|[\s(])_([^_\n]+?)_(?=[\s.,;:)]|$)/g, '$1*$2*')
      .replace(/\[lore resumido\]\s*(?:—\s*)?/g, '*Resumo da história:* ')
      // Check do PDF dentro de célula de tabela.
      .replace(/(\|\s*)[✓➢➔•]\s*/g, '$1')
      // Marcador no meio da linha ("Desvantagem: ➢ Caso...") abre um item de lista.
      .replace(/\s+[✓➢➔]\s+/g, '\n- ')
      // "(sic: o PDF diz ...)" do transcritor: fica a observação, sem falar de PDF.
      .replace(/\s*\*\(sic\)\*/g, '')
      .replace(/\*\(sic:\s*/g, '*(no original: ')
      .replace(/\bo PDF\b/g, 'o livro')
  )
}

/**
 * Os suplementos do lote A fecham com "## Notas de transcrição": a seção sai e
 * só ficam, em linhas "*Nota:*", as que avisam contradição ou ambiguidade de regra.
 */
const NOTAS_NO_FIM = {
  'supA-brench-seijin.md': ['o texto diz "gratuitamente, ao gastar ... PK\'s extras": chama de gratuito mas cobra PK igual ao custo do rótulo (entende-se: sem gastar o orçamento de rótulos).'],
  'supA-demonio-xenoverse.md': [
    'várias magias cobram "PK\'s" extras além dos Pontos de Magia Negra; o original não diz se é Ki comum ou Magia Negra (a regra geral diz "jamais Pontos de Ki comuns").',
    'em "Presença Definitiva", "Escala de Poder inferior à do alvo" provavelmente quer dizer "à do usuário".',
  ],
  'supA-freeza-clan-armadurado.md': ['"Soco Armadurado Preciso Potencializado - B" tem dano e Ki menores que a versão C no original.'],
  'supA-garotas-magicas.md': ['o texto diz "de forma permanente" e logo depois "Não sendo permanente": os PK\'s ficam enquanto a população mantiver o sentimento.'],
  'supA-hit-clan.md': ['Time Realese e Tide of Times acumulam o "Tempo Perdido" cada um por si; o original não diz se o total é compartilhado.'],
  'supA-majin-do-coracao-puro.md': [
    '"Palmar Crítico – Z" diz "a queima-roupa ... encosta no alvo", mas o alcance listado é "Alvo Único em 9,0m".',
    'em "Feixe de Transfiguração", as faixas de diferença de EP são ambíguas no original.',
  ],
  'supA-namek-guerreiro.md': ['os rótulos negativos dos ranks Z listam 3 itens sob "(6)" e incluem "Posicionamento Crítico", de custo maior.'],
}

function semNotasDeTranscricao(texto, arquivo) {
  if (!/^## Notas de transcrição/m.test(texto)) return texto
  const notas = (NOTAS_NO_FIM[arquivo] ?? []).map((n) => `*Nota:* ${n}`)
  return [semSecao(texto, /^## Notas de transcrição/), ...notas].join('\n\n')
}

/** Tira a seção que começa no título `padrao` (até o próximo título de nível igual ou maior). */
function semSecao(texto, padrao) {
  const linhas = texto.split('\n')
  const inicio = linhas.findIndex((l) => padrao.test(l))
  if (inicio === -1) falhar(`seção ${padrao} não achada para remover`)
  const nivel = /^#+/.exec(linhas[inicio])[0].length
  let fim = inicio + 1
  while (fim < linhas.length) {
    const m = /^(#+)\s/.exec(linhas[fim])
    if (m !== null && m[1].length <= nivel) break
    fim += 1
  }
  return [...linhas.slice(0, inicio), ...linhas.slice(fim)].join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function corpoDaSecao(texto, padrao) {
  const linhas = texto.split('\n')
  const inicio = linhas.findIndex((l) => padrao.test(l))
  if (inicio === -1) falhar(`seção ${padrao} não achada`)
  const nivel = /^#+/.exec(linhas[inicio])[0].length
  let fim = inicio + 1
  while (fim < linhas.length) {
    const m = /^(#+)\s/.exec(linhas[fim])
    if (m !== null && m[1].length <= nivel) break
    fim += 1
  }
  return linhas
    .slice(inicio + 1, fim)
    .join('\n')
    .trim()
}

const TITULOS = {
  'j1-01-introducao.md': 'Jogador · 1.0 Introdução',
  'j1-02-atributos.md': 'Jogador · 2.0 Atributos',
  'j1-03-atributos-secundarios.md': 'Jogador · 2.2 Atributos secundários',
  'j1-04-escala-de-poder.md': 'Jogador · 2.3 Escala de Poder',
  'j1-05-criacao-do-personagem.md': 'Jogador · 3.0 Criação do personagem',
  'j1-06-racas.md': 'Jogador · 4.0 As raças',
  'j1-07-androides.md': 'Jogador · 4.1 Androides',
  'j1-08-freeza-clan.md': 'Jogador · 4.2 Freeza Clan',
  'j1-09-majin.md': 'Jogador · 4.3 Majin',
  'j1-10-namekuseijin.md': 'Jogador · 4.4 Namekuseijins',
  'j1-11-saiyajin.md': 'Jogador · 4.5 Saiyajins',
  'j1-12-glinds.md': 'Jogador · 4.6 Glinds',
  'j1-13-terraqueos.md': 'Jogador · 4.7 Terráqueos',
  'j1-14-talentos-e-movimentos-marciais.md': 'Jogador · 5.0 Talentos e movimentos marciais',
  'j1-15-movimentos-marciais.md': 'Jogador · 5.1 Movimentos marciais',
  'j1-16-talentos.md': 'Jogador · 5.2 Talentos',
  'j2-60-criacao-de-tecnicas.md': 'Jogador · 6.0 Criação de técnicas',
  'j2-61-rotulos-base.md': 'Jogador · 6.1 Rótulos base',
  'j2-62-rotulos-de-tipo-de-dano.md': 'Jogador · 6.2 Rótulos de tipo de dano',
  'j2-63-rotulos-de-ki.md': 'Jogador · 6.3 Rótulos de Ki',
  'j2-64-rotulos-genericos.md': 'Jogador · 6.4 Rótulos genéricos',
  'j2-65-rotulos-negativos.md': 'Jogador · 6.5 Rótulos negativos',
  'j2-66-guia-de-criacao-de-tecnicas.md': 'Jogador · 6.6 Guia de criação de técnicas',
  'j2-67-exemplo-de-criacao-de-tecnica.md': 'Jogador · 6.7 Exemplo de criação de técnica',
  'j2-68-criacao-de-tecnicas-especiais.md': 'Jogador · 6.8 Técnicas especiais',
  'j2-69-desenvolvendo-uma-tecnica-especial.md': 'Jogador · 6.9 Desenvolvendo uma técnica especial',
  'j2-70-criacao-de-transformacoes.md': 'Jogador · 7.0 Criação de transformações',
  'j3-08-0-regras-gerais.md': 'Jogador · 8.0 Regras gerais',
  'j3-08-1-rolagens.md': 'Jogador · 8.1 Rolagens e perícias',
  'j3-08-2-carga-de-itens.md': 'Jogador · 8.2 Carga de itens',
  'j3-08-3-itens.md': 'Jogador · 8.3 Itens',
  'j3-08-4-estagios-de-dano.md': 'Jogador · 8.4 Estágios de dano',
  'j3-08-5-uso-de-ki.md': 'Jogador · 8.5 Uso de Ki',
  'j3-08-6-slots-de-tecnicas.md': 'Jogador · 8.6 Slots de técnicas',
  'j3-08-7-poder-de-luta.md': 'Jogador · 8.7 Poder de Luta',
  'j3-08-8-destruicao-planetaria.md': 'Jogador · 8.8 Destruição planetária',
  'j3-09-0-regras-de-combate.md': 'Jogador · 9.0 Regras de combate',
  'j3-09-1-iniciativa.md': 'Jogador · 9.1 Iniciativa',
  'j3-09-2-turno-de-acao.md': 'Jogador · 9.2 Turno de ação',
  'j3-09-3-turno-de-reacao.md': 'Jogador · 9.3 Turno de reação',
  'j3-09-4-critico.md': 'Jogador · 9.4 Acerto e erro crítico',
  'j3-09-5-acoes-especiais.md': 'Jogador · 9.5 Ações especiais de combate',
  'j3-09-7-condicoes-negativas.md': 'Jogador · 9.7 Condições negativas',
  'j3-10-registros-de-atualizacoes.md': 'Jogador · Registro de atualizações',
  'j3-apendice-ficha.md': 'Jogador · Apêndice: ficha modelo',
  'nar-00-aviso-creditos-sumario.md': 'Narrador · Créditos e sumário',
  'nar-01-introducao.md': 'Narrador · 1.0 Introdução',
  'nar-02-montando-a-sua-aventura.md': 'Narrador · 2.0 Montando a sua aventura',
  'nar-03-balanceamento.md': 'Narrador · 3.0 Balanceamento',
  'nar-04-criacao-de-pnjs.md': 'Narrador · 4.0 Criação de PnJs',
  'nar-05-criacao-de-itens.md': 'Narrador · 5.0 Criação de itens',
  'nar-06-combate.md': 'Narrador · 6.0 Combate',
  'saga-saiyajins-regras.md': 'Saga Saiyajin · Raça bônus: Saibamans',
  'saga-broly-regras.md': 'Broly · Variante de raça: Saiyajin Lendário',
  'saga-super-heroes-regras.md': 'Saga Super Hero · Raça bônus: Androides Gamma',
  'nar-enma-00-creditos-aviso.md': 'Enma Daioh · Créditos e aviso',
  'nar-enma-02-raca-bonus-cla-garunpo.md': 'Enma Daioh · Raça bônus: Clã Garunpo',
}

/** Ordem do livro dentro de cada parte (os arquivos dos suplementos vão por nome). */
const ORDEM_DAS_SAGAS = ['saga-saiyajins-regras.md', 'saga-broly-regras.md', 'saga-super-heroes-regras.md', 'nar-enma-00-creditos-aviso.md', 'nar-enma-02-raca-bonus-cla-garunpo.md']

function capituloDeAbertura(narrador) {
  const aviso = corpoDaSecao(narrador, /^## AVISO LEGAL/)
  const creditos = corpoDaSecao(narrador, /^## CRÉDITOS/)
  return [
    '# Dragon Ball - Tales',
    '',
    'O **Dragon Ball - Tales** é um sistema de RPG de mesa gratuito, feito por fãs e sem fins lucrativos, criado por **VLiscius** e **FNishiguchi** (Projeto RR). Este livro reúne a transcrição do Livro do Jogador V0.5, do Livro do Narrador V0.1, dos suplementos de raça, das regras das sagas e do suplemento Enma Daioh 2025.',
    '',
    'O material é distribuído sob a licença **Creative Commons Atribuição-Uso Não-Comercial-Compartilhamento pela mesma licença 2.5 Brasil (CC BY-NC-SA 2.5 BR)**: pode ser copiado, distribuído e adaptado, desde que se dê o crédito ao projeto original, sem uso comercial, e que as obras derivadas usem a mesma licença.',
    '',
    '*Nota:* a transcrição mantém a grafia do original. Onde o livro se contradiz, há uma linha de nota curta no capítulo.',
    '',
    '## Aviso legal',
    '',
    aviso,
    '',
    '## Créditos',
    '',
    creditos,
    '',
    'Suplementos de raça: desenvolvimento VLiscius e FNishiguchi; diagramação, edição e revisão VLiscius e FNishiguchi. Enma Daioh 2025: VLiscius, com as fichas feitas pelos jogadores do concurso "Livro do Enma-Daioh".',
  ].join('\n')
}

/** Corta um capítulo grande em partes nos títulos "## " (nunca no meio de um bloco). */
function partir(capitulo) {
  if (capitulo.texto.length <= CAPITULO_TEXTO_MAX) return [capitulo]
  const pedacos = capitulo.texto.split(/\n(?=## )/)
  const partes = []
  let atual = ''
  for (const p of pedacos) {
    if (p.length > CAPITULO_TEXTO_MAX) falhar(`seção grande demais para um capítulo em ${capitulo.id}`)
    if (atual.length > 0 && atual.length + 1 + p.length > CAPITULO_TEXTO_MAX) {
      partes.push(atual)
      atual = p
    } else atual = atual.length === 0 ? p : `${atual}\n${p}`
  }
  if (atual.length > 0) partes.push(atual)
  return partes.map((texto, i) => ({
    id: i === 0 ? capitulo.id : `${capitulo.id}-parte-${i + 1}`,
    titulo: i === 0 ? capitulo.titulo : `${capitulo.titulo} (parte ${i + 1})`,
    texto,
  }))
}

function gerarLivro() {
  const arquivos = fs.readdirSync(PASTA_MD).filter((f) => f.endsWith('.md'))
  const jogador = arquivos.filter((f) => /^j[123]-/.test(f)).sort()
  const narrador = arquivos.filter((f) => /^nar-\d/.test(f)).sort()
  const suplementos = arquivos.filter((f) => /^sup[AB]-/.test(f))
  const sagas = ORDEM_DAS_SAGAS
  const conhecidos = new Set([...jogador, ...narrador, ...suplementos, ...sagas])
  for (const f of arquivos) if (!conhecidos.has(f)) falhar(`md sem lugar no livro: ${f}`)

  const capitulos = []
  const mdDoNarrador = lerMd('nar-00-aviso-creditos-sumario.md')
  capitulos.push({ id: 'dbt-aviso-legal', titulo: 'Aviso legal e créditos', texto: capituloDeAbertura(mdDoNarrador) })

  const doArquivo = (arquivo, titulo, ajustar = (t) => t) => {
    if (titulo === undefined) falhar(`md sem título: ${arquivo}`)
    capitulos.push({ id: `dbt-${slug(arquivo.replace(/\.md$/, ''))}`, titulo, texto: ajustar(limparMarkdown(lerMd(arquivo), arquivo)) })
  }
  for (const f of jogador) doArquivo(f, TITULOS[f])
  for (const f of narrador)
    doArquivo(f, TITULOS[f], (t) => (f === 'nar-00-aviso-creditos-sumario.md' ? semSecao(t, /^## AVISO LEGAL/) : t))
  const tituloDoSuplemento = (f) => `Suplemento: ${/^#\s+(.*)$/m.exec(lerMd(f))?.[1]?.trim() ?? falhar(`suplemento sem título: ${f}`)}`
  for (const f of suplementos.sort((a, b) => tituloDoSuplemento(a).localeCompare(tituloDoSuplemento(b), 'pt-BR')))
    doArquivo(f, tituloDoSuplemento(f), (t) => semNotasDeTranscricao(t, f))
  // O fim do md do Enma aponta para o json das fichas: é nota de transcrição, sai.
  for (const f of sagas) doArquivo(f, TITULOS[f], (t) => (f === 'nar-enma-00-creditos-aviso.md' ? semSecao(t, /^## Capítulo I — Fichas de PnJ/) : t))

  const livro = capitulos.flatMap(partir).map((c, i) => ({ id: c.id, titulo: c.titulo.slice(0, CAPITULO_TITULO_MAX), ordem: i + 1, texto: c.texto }))
  if (livro.length > CAPITULOS_MAX) falhar(`livro com ${livro.length} capítulos (teto ${CAPITULOS_MAX})`)
  const ids = new Set(livro.map((c) => c.id))
  if (ids.size !== livro.length) falhar('id de capítulo repetido')
  return livro
}

// ───────────────────────────────────────────────────────────────────────────
// Principal
// ───────────────────────────────────────────────────────────────────────────

function principal() {
  const pericias = gerarPericias()
  const racas = gerarRacas()
  const talentos = gerarTalentos()
  const movimentos = gerarMovimentos()
  const rotulos = gerarRotulos()
  const ranks = gerarRanks()
  const transformacoes = gerarTransformacoes()
  const { itens, carga } = gerarItens()
  const condicoes = gerarCondicoes()
  const acoes = gerarAcoes()
  const estagios = gerarEstagios()
  const tabelas = gerarTabelas()
  const npcs = gerarNpcs()
  const livro = gerarLivro()

  const importar = (...tipos) => `import type { ${tipos.join(', ')} } from '../modelo'\n\n`

  escreverModulo(SAIDA_DADOS, 'pericias.ts', 'As 13 perícias (8.1.2, p. 98), na ordem do livro.', importar('PericiaDBT') + exportar('PERICIAS', 'PericiaDBT[]', pericias))

  escreverModulo(
    SAIDA_DADOS,
    'racas.ts',
    'Raças: as 7 do livro básico (cap. 4), as dos suplementos de raça (supA/supB) e as raças\nbônus das regras das sagas e do Enma Daioh. Pacote de técnicas também é entrada daqui\n(`tipo: \'pacote-de-tecnicas\'`, com `racaBase`).',
    importar('RacaDBT') + exportar('RACAS', 'RacaDBT[]', racas),
  )

  escreverModulo(SAIDA_DADOS, 'talentos.ts', 'Os talentos do livro básico (5.2, p. 48-55). Talentos raciais ficam na raça.', importar('TalentoDBT') + exportar('TALENTOS', 'TalentoDBT[]', talentos))

  escreverModulo(
    SAIDA_DADOS,
    'movimentosMarciais.ts',
    'Os movimentos marciais (5.1, p. 38-48). `combinaCom` vem da cor do * no PDF (vermelho = físico, azul = Ki).',
    importar('MovimentoMarcialDBT') + exportar('MOVIMENTOS_MARCIAIS', 'MovimentoMarcialDBT[]', movimentos),
  )

  escreverModulo(SAIDA_DADOS, 'rotulos.ts', 'Os rótulos de técnica (cap. 6.1 a 6.5, p. 61-83). Id = slug do nome (o livro não tem id).', importar('RotuloDBT') + exportar('ROTULOS', 'RotuloDBT[]', rotulos))

  escreverModulo(SAIDA_DADOS, 'ranks.ts', 'A tabela de ranks de técnica (6.0.2, p. 58; ST da p. 109; Ki mínimo da especial p. 88-89).', importar('RankDeTecnica') + exportar('RANKS_DE_TECNICA', 'RankDeTecnica[]', ranks))

  escreverModulo(
    SAIDA_DADOS,
    'transformacoes.ts',
    'Transformações do capítulo 7 (p. 92-95): a regra geral e o exemplo do Super Saiyajin.\nO exemplo impresso usa EP +2/+3/+4 e Ki 6/9/12, fora da regra EP = estágio e Ki = 3 × estágio:\naqui vale o impresso. As transformações de cada raça ficam em racas.ts.',
    importar('TransformacaoDBT') +
      `/** Regra geral (7.1.1-7.1.2, p. 93): EP bônus = estágio; Ki para ativar = 3 × estágio. */\nexport const REGRA_DE_TRANSFORMACAO = { epPorEstagio: 1, kiPorEstagio: 3, pagina: 93 } as const\n\n` +
      exportar('TRANSFORMACOES_DE_EXEMPLO', 'TransformacaoDBT[]', transformacoes),
  )

  escreverModulo(
    SAIDA_DADOS,
    'itens.ts',
    'Itens e armaduras (8.2-8.3, p. 100-103). O livro não dá preço.',
    importar('ItemDBT') +
      `/** Slots de carga = ${carga.slots_base} + (modificador de Força × ${carga.slots_por_mod_forca}) (8.2, p. ${carga.pagina}). */\nexport const REGRA_DE_CARGA = { slotsBase: ${carga.slots_base}, slotsPorModificadorDeForca: ${carga.slots_por_mod_forca}, pagina: ${carga.pagina} } as const\n\n` +
      exportar('ITENS', 'ItemDBT[]', itens),
  )

  escreverModulo(
    SAIDA_DADOS,
    'condicoes.ts',
    'As condições negativas (9.7, p. 120-123). `expira` e `atributosDoTeste` foram lidos do texto\nde cada condição e conferidos à mão no gerador.',
    importar('CondicaoDBT') + exportar('CONDICOES', 'CondicaoDBT[]', condicoes),
  )

  escreverModulo(SAIDA_DADOS, 'acoesDeCombate.ts', 'As ações de combate (9.1-9.5, p. 113-120).', importar('AcaoDeCombateDBT') + exportar('ACOES_DE_COMBATE', 'AcaoDeCombateDBT[]', acoes))

  escreverModulo(
    SAIDA_DADOS,
    'estagiosDeDano.ts',
    'Os estágios de dano pela margem acerto − CA, sem diferença de EP (8.4, p. 103-104).',
    importar('EstagioDeDanoDBT') + exportar('ESTAGIOS_DE_DANO', 'EstagioDeDanoDBT[]', estagios),
  )

  const tiposDasTabelas = [
    `import type { CategoriaDeNpcDBT, TabelaVidaPorGolpe } from '../modelo'`,
    '',
    '/** Faixa de margem (resultado do ataque − CA); `ate` null = sem teto. */',
    'export interface IntervaloDeMargemDBT {',
    '  de: number',
    '  ate: number | null',
    '}',
    '',
    '/** Uma linha da tabela de estágios por diferença de EP (2.3.3, p. 10-11). */',
    'export interface LinhaDaEscalaDePoderDBT {',
    '  /** Como impresso no livro: negativo (-1 a -10) = EP a favor do atacante. */',
    '  difEp: number',
    '  minimo: IntervaloDeMargemDBT',
    '  medio: IntervaloDeMargemDBT',
    '  completo: IntervaloDeMargemDBT',
    '  /** As células como impressas ("2 a 4", "5 +"). */',
    '  texto: { minimo: string; medio: string; completo: string }',
    '}',
    '',
    '/** Distribuição de atributos de PNJ por categoria (Livro do Narrador 4.0.4): boa prática, não regra rígida. */',
    'export interface AtributosDePnjDBT {',
    '  teto: number',
    '  segundoAtributoMax: number | null',
    '  demaisMin: number | null',
    '  demaisMax: number | null',
    '  /** Passar do teto: cada ponto acima tira `reduzirPorPonto` de outro atributo. */',
    '  excedente: { acimaDe: number; reduzirPorPonto: number } | null',
    '  texto: string[]',
    '}',
    '',
    '/** Ameaça do encontro pela diferença EP do PNJ − EP dos jogadores (Livro do Narrador 4.0.3, p. 18). */',
    'export interface AmeacaPorDiferencaDeEpDBT {',
    '  diferenca: string',
    '  dificuldade: string',
    '  texto: string',
    '}',
    '',
  ].join('\n')

  escreverModulo(
    SAIDA_DADOS,
    'tabelas.ts',
    'Tabelas do livro: estágios de dano por diferença de EP (Livro do Jogador 2.2.4 e 2.3.3),\nvida por golpe do NPC (Livro do Narrador 4.0.2), atributos de PNJ (4.0.4) e escala de poder\ndo encontro e da campanha (4.0.3 e 2.2.1).\nA linha -1 encurta o mínimo para 1 ponto e da linha -5 em diante o padrão muda: é o impresso.',
    tiposDasTabelas +
      '\n' +
      '/** Sem diferença de EP (2.2.4): mínimo 1-2, médio 3-5, completo 6+. */\n' +
      exportar('ESCALA_DE_PODER_SEM_DIFERENCA', 'LinhaDaEscalaDePoderDBT', tabelas.semDiferenca) +
      '\n' +
      exportar('TABELA_DA_ESCALA_DE_PODER', 'LinhaDaEscalaDePoderDBT[]', tabelas.linhas) +
      '\n' +
      '/** PV do NPC = ND × VIDA_POR_GOLPE[categoria][rank] (Livro do Narrador 4.0.2, p. 17-18). */\n' +
      exportar('VIDA_POR_GOLPE', 'TabelaVidaPorGolpe', tabelas.vidaPorGolpe) +
      '\n' +
      exportar('ATRIBUTOS_DE_PNJ', 'Record<CategoriaDeNpcDBT, AtributosDePnjDBT>', tabelas.atributosDePnj) +
      '\n' +
      exportar('AMEACA_POR_DIFERENCA_DE_EP', 'AmeacaPorDiferencaDeEpDBT[]', tabelas.ameaca) +
      '\n' +
      '/** EP inicial sugerida da campanha (Livro do Narrador 2.2.1). */\n' +
      exportar('EP_INICIAL_DE_CAMPANHA', '{ ep: string; uso: string }[]', tabelas.epInicial),
  )

  const indice = npcs.map((n) => ({ id: n.id, nome: n.nome, colecao: n.colecao, saga: n.saga, categoria: n.categoria, rank: n.rank, ep: n.ep }))
  escreverModulo(
    SAIDA_DADOS,
    'npcsProntosDados.ts',
    'As fichas completas dos NPCs prontos (sagas e Enma Daioh). Módulo grande: importe por\n`carregarNpcsProntos()` (npcsProntos.ts), que o carrega sob demanda.',
    importar('NpcProntoDBT') + exportar('NPCS_PRONTOS', 'NpcProntoDBT[]', npcs),
  )
  escreverModulo(
    SAIDA_DADOS,
    'npcsProntos.ts',
    'NPCs prontos: um índice leve (para listar sem carregar as fichas) e o carregador das fichas,\nque fica num módulo separado (npcsProntosDados.ts) porque é grande.',
    importar('CategoriaDeNpcDBT', 'ColecaoDeNpcProntoDBT', 'NpcProntoDBT', 'RankDBT') +
      [
        '/** O que a lista de NPCs prontos mostra antes de abrir uma ficha. */',
        'export interface ResumoDeNpcProntoDBT {',
        '  id: string',
        '  nome: string',
        '  colecao: ColecaoDeNpcProntoDBT',
        '  saga: string | null',
        '  categoria: CategoriaDeNpcDBT',
        '  rank: RankDBT',
        '  ep: number',
        '}',
        '',
        exportar('INDICE_DOS_NPCS_PRONTOS', 'ResumoDeNpcProntoDBT[]', indice),
        '/** As fichas completas; o import dinâmico deixa o módulo grande fora do pacote inicial. */',
        'export async function carregarNpcsProntos(): Promise<NpcProntoDBT[]> {',
        "  const { NPCS_PRONTOS } = await import('./npcsProntosDados')",
        '  return NPCS_PRONTOS',
        '}',
        '',
      ].join('\n'),
  )

  escreverModulo(
    SAIDA_LIVRO,
    'livroDragonBall.ts',
    'O livro de regras do Dragon Ball Tales, na ordem: aviso legal e créditos, Livro do Jogador\n(cap. I a VI e apêndice da ficha), Livro do Narrador, suplementos de raça e regras das sagas\ne do Enma Daioh. Texto na marcação leve (lib/marcacaoLeve.ts), com tabelas GFM.\nSem as linhas de metadado da transcrição; nota do transcritor só fica quando avisa\ncontradição de regra (linha "*Nota:*").',
    `import type { CapituloDoLivro } from '../../sistemaDeRpg'\n\n` + exportar('LIVRO_DRAGON_BALL', 'CapituloDoLivro[]', livro),
  )

  // Conferência 1: cada módulo escrito carrega e devolve o mesmo dado.
  const conferencias = [
    [SAIDA_DADOS, 'pericias.ts', { PERICIAS: pericias }],
    [SAIDA_DADOS, 'racas.ts', { RACAS: racas }],
    [SAIDA_DADOS, 'talentos.ts', { TALENTOS: talentos }],
    [SAIDA_DADOS, 'movimentosMarciais.ts', { MOVIMENTOS_MARCIAIS: movimentos }],
    [SAIDA_DADOS, 'rotulos.ts', { ROTULOS: rotulos }],
    [SAIDA_DADOS, 'ranks.ts', { RANKS_DE_TECNICA: ranks }],
    [SAIDA_DADOS, 'transformacoes.ts', { TRANSFORMACOES_DE_EXEMPLO: transformacoes }],
    [SAIDA_DADOS, 'itens.ts', { ITENS: itens }],
    [SAIDA_DADOS, 'condicoes.ts', { CONDICOES: condicoes }],
    [SAIDA_DADOS, 'acoesDeCombate.ts', { ACOES_DE_COMBATE: acoes }],
    [SAIDA_DADOS, 'estagiosDeDano.ts', { ESTAGIOS_DE_DANO: estagios }],
    [SAIDA_DADOS, 'tabelas.ts', { TABELA_DA_ESCALA_DE_PODER: tabelas.linhas, VIDA_POR_GOLPE: tabelas.vidaPorGolpe, ATRIBUTOS_DE_PNJ: tabelas.atributosDePnj }],
    [SAIDA_DADOS, 'npcsProntosDados.ts', { NPCS_PRONTOS: npcs }],
    [SAIDA_DADOS, 'npcsProntos.ts', { INDICE_DOS_NPCS_PRONTOS: indice }],
    [SAIDA_LIVRO, 'livroDragonBall.ts', { LIVRO_DRAGON_BALL: livro }],
  ]
  for (const [pasta, arquivo, esperado] of conferencias) conferirModulo(pasta, arquivo, esperado)

  // Conferência 2: contagens do que foi escrito.
  const totalDoLivro = livro.reduce((s, c) => s + c.texto.length, 0)
  const maiorCapitulo = livro.reduce((m, c) => (c.texto.length > m.texto.length ? c : m), livro[0])
  const resumo = [
    `perícias            ${pericias.length}`,
    `raças               ${racas.length} (básico ${racas.filter((r) => r.fonte === 'basico').length}, suplemento ${racas.filter((r) => r.fonte === 'suplemento').length})`,
    `talentos            ${talentos.length}`,
    `movimentos marciais ${movimentos.length}`,
    `rótulos             ${rotulos.length}`,
    `ranks               ${ranks.length}`,
    `transformações ex.  ${transformacoes.length}`,
    `itens               ${itens.length}`,
    `condições           ${condicoes.length}`,
    `ações de combate    ${acoes.length}`,
    `estágios de dano    ${estagios.length}`,
    `linhas da tabela EP ${tabelas.linhas.length}`,
    `NPCs prontos        ${npcs.length} (${Object.entries(npcs.reduce((m, n) => ({ ...m, [n.colecao]: (m[n.colecao] ?? 0) + 1 }), {}))
      .map(([c, q]) => `${c} ${q}`)
      .join(', ')})`,
    `técnicas (raças)    ${racas.reduce((s, r) => s + r.tecnicas.length, 0)}`,
    `técnicas (NPCs)     ${npcs.reduce((s, n) => s + n.tecnicas.length, 0)}`,
    `livro               ${livro.length} capítulos, ${totalDoLivro} caracteres (maior: ${maiorCapitulo.id}, ${maiorCapitulo.texto.length})`,
  ]
  console.log(resumo.join('\n'))
  if (totalDoLivro > LIVRO_TOTAL_PREVISTO) console.warn(`AVISO: o livro passa de ${LIVRO_TOTAL_PREVISTO} caracteres; o teto de lib/sistemaDeRpg.ts precisa caber isso.`)
}

principal()
