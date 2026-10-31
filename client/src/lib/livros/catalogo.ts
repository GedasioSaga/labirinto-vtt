import { normalizarParaBusca } from '../buscaNoLivro'
import { ABA_DAS_ARMAS, armasDe, limiteDeArmas } from '../batalha/leituraDaFicha'
import { cartoesDaAba, novoCartao, type CartaoDaFicha, type Personagem } from '../personagem'
import { abaDoSistema, type AbaDoSistema, type CampoDoCartao, type SistemaDeRpg } from '../sistemaDeRpg'

/**
 * CATÁLOGO DO LIVRO (M3 do mundo do livro de regras, docs/planos/livros-de-regras-plano.md,
 * seção M3): armas, habilidades e itens que o mestre junta uma vez e põe em
 * qualquer ficha, mais as perícias, vantagens e desvantagens que já vêm nos
 * capítulos do livro (`catalogoDoLivro.ts`). Puro: sem store, sem disco, sem rede.
 *
 *   <appData>/livros/<sistemaId>/catalogo.json   { formato: 1, itens: ItemDoCatalogo[] }
 *
 * Por SISTEMA, não por campanha: o mesmo livro vale em toda pasta que o usa.
 * Começa vazio (decisão D7): o "Juntar das fichas da pasta" o enche com o que
 * as fichas já têm.
 */

/** O que o mestre cria no catálogo (vai para o disco). */
export type TipoDoCatalogo = 'arma' | 'habilidade' | 'item'
/** O que sai dos capítulos do livro (só leitura, selo "Do livro"). */
export type TipoDoLivro = 'pericia' | 'vantagem' | 'desvantagem'
export type TipoDeEntrada = TipoDoCatalogo | TipoDoLivro

export const TIPOS_DO_CATALOGO: readonly TipoDoCatalogo[] = ['arma', 'habilidade', 'item']
export const TIPOS_DO_LIVRO: readonly TipoDoLivro[] = ['pericia', 'vantagem', 'desvantagem']
/** A ordem dos filtros da página (depois do "Tudo"). */
export const TIPOS_DE_ENTRADA: readonly TipoDeEntrada[] = [...TIPOS_DO_CATALOGO, ...TIPOS_DO_LIVRO]

export interface DadosDoTipo {
  /** O filtro e a seção: "Armas". */
  nome: string
  /** Uma entrada: "Arma" (a linha do cartão e o placeholder da ficha). */
  um: string
  /** A aba da ficha que recebe (destino fixo, decisão do plano). */
  aba: string
  /** O selo do cartão: "Do catálogo" ou "Do livro". */
  origem: 'catalogo' | 'livro'
}

export const DADOS_DO_TIPO: Readonly<Record<TipoDeEntrada, DadosDoTipo>> = {
  arma: { nome: 'Armas', um: 'Arma', aba: ABA_DAS_ARMAS, origem: 'catalogo' },
  habilidade: { nome: 'Habilidades', um: 'Habilidade', aba: 'habilidades', origem: 'catalogo' },
  item: { nome: 'Itens', um: 'Item', aba: 'itens', origem: 'catalogo' },
  pericia: { nome: 'Perícias', um: 'Perícia', aba: 'pericias', origem: 'livro' },
  vantagem: { nome: 'Vantagens', um: 'Vantagem', aba: 'vantagens', origem: 'livro' },
  desvantagem: { nome: 'Desvantagens', um: 'Desvantagem', aba: 'desvantagens', origem: 'livro' },
}

/** Uma entrada do catálogo, como o disco a guarda. */
export interface ItemDoCatalogo {
  id: string
  tipo: TipoDoCatalogo
  /** No máximo `ENTRADA_NOME_MAX`, nunca vazio. */
  nome: string
  /** Vira a Descrição do cartão. No máximo `ENTRADA_TEXTO_MAX`. */
  texto: string
  /**
   * Valor de cada campo da aba de destino, pela chave do campo da ficha
   * (`dano`, `acao`, `custo`, `tempo`, `efeito`, `quantidade`, `modificador`).
   * Campo vazio não é guardado.
   */
  campos: Record<string, string>
  /**
   * Só na arma: os tipos de bala (os subcartões "Tipos de bala" da ficha),
   * na ordem. Ausente = a entrada não diz (catálogo antigo, ou a janela que
   * ainda não edita balas): quem grava mantém as que já estavam.
   */
  balas?: BalaDoCatalogo[]
}

/** Um tipo de bala da arma do catálogo: nome e os campos da aba das balas (`dano`, `efeito`, `quantidade`). */
export interface BalaDoCatalogo {
  nome: string
  campos: Record<string, string>
}

/** Uma perícia, vantagem ou desvantagem lida do livro do sistema. Nunca gravada. */
export interface EntradaDoLivro {
  /** Estável entre leituras: `livro-<tipo>-<nome sem acento>`. */
  id: string
  tipo: TipoDoLivro
  nome: string
  texto: string
  /** `efeito` na vantagem e na desvantagem, quando o livro traz. */
  campos: Record<string, string>
  /** Ids de atributos do sistema (só a perícia; vazio quando o livro não diz ou o nome não casa). */
  atributos: string[]
}

export type EntradaParaFicha = ItemDoCatalogo | EntradaDoLivro

export const FORMATO_DO_CATALOGO = 1
export const CATALOGO_MAX = 2000
export const ENTRADA_NOME_MAX = 80
export const ENTRADA_TEXTO_MAX = 600
/** Valor de um campo (Dano, Ação...): é uma linha da ficha. */
export const ENTRADA_CAMPO_MAX = 200
const CAMPOS_POR_ENTRADA_MAX = 16
/** Tipos de bala de uma arma do catálogo. */
export const BALAS_POR_ENTRADA_MAX = 16
/** Chave de campo que o arquivo pode trazer: a mesma forma dos ids da ficha. */
const CHAVE_DE_CAMPO = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/
const ID_DE_ENTRADA = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/
const CAMPO_DA_DESCRICAO = 'descricao'
export const CATALOGO_CHEIO = `O catálogo chegou a ${CATALOGO_MAX} entradas. Apague alguma antes de criar outra.`

export function ehDoLivro(entrada: EntradaParaFicha): entrada is EntradaDoLivro {
  return DADOS_DO_TIPO[entrada.tipo].origem === 'livro'
}

export function novoIdDeEntrada(): string {
  return `cat_${crypto.randomUUID()}`
}

/** Corta em `max` unidades UTF-16 sem partir um par substituto. */
function cortar(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

/** Nome comparável: sem acento, sem caixa, espaços juntos. "Faca" e "faca " são o mesmo. */
export function chaveDoNomeDaEntrada(nome: string): string {
  return normalizarParaBusca(nome)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function ehTipoDoCatalogo(value: unknown): value is TipoDoCatalogo {
  return value === 'arma' || value === 'habilidade' || value === 'item'
}

/** Os campos limpos: chave na forma da ficha, sem a descrição (é o `texto`), valor aparado e cortado, vazio sai. */
function camposLimpos(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const campos: Record<string, string> = {}
  let quantos = 0
  for (const [chave, bruto] of Object.entries(value)) {
    if (quantos === CAMPOS_POR_ENTRADA_MAX) break
    if (chave === CAMPO_DA_DESCRICAO || !CHAVE_DE_CAMPO.test(chave) || typeof bruto !== 'string') continue
    const valor = cortar(bruto.trim(), ENTRADA_CAMPO_MAX).trim()
    if (valor.length === 0) continue
    campos[chave] = valor
    quantos += 1
  }
  return campos
}

/**
 * A entrada como o disco a guardaria: nome e texto aparados e cortados,
 * campos limpos. `null` = sem nome (não entra). Funil único da leitura do
 * arquivo e do "Salvar" da janela de entrada.
 */
export function itemLimpo(item: { id: unknown; tipo: unknown; nome: unknown; texto: unknown; campos: unknown; balas?: unknown }): ItemDoCatalogo | null {
  if (typeof item.id !== 'string' || !ID_DE_ENTRADA.test(item.id) || !ehTipoDoCatalogo(item.tipo) || typeof item.nome !== 'string') return null
  const nome = cortar(item.nome.trim(), ENTRADA_NOME_MAX).trim()
  if (nome.length === 0) return null
  const texto = typeof item.texto === 'string' ? cortar(item.texto.trim(), ENTRADA_TEXTO_MAX).trim() : ''
  const limpo: ItemDoCatalogo = { id: item.id, tipo: item.tipo, nome, texto, campos: camposLimpos(item.campos) }
  // Só a arma leva balas; lista que não é lista conta como "não diz".
  if (item.tipo === 'arma' && Array.isArray(item.balas)) limpo.balas = balasLimpas(item.balas)
  return limpo
}

/** As balas limpas: nome aparado e cortado (sem nome sai), campos como os da entrada, teto `BALAS_POR_ENTRADA_MAX`. */
function balasLimpas(brutas: readonly unknown[]): BalaDoCatalogo[] {
  const balas: BalaDoCatalogo[] = []
  for (const bruta of brutas) {
    if (balas.length === BALAS_POR_ENTRADA_MAX) break
    if (!isRecord(bruta) || typeof bruta.nome !== 'string') continue
    const nome = cortar(bruta.nome.trim(), ENTRADA_NOME_MAX).trim()
    if (nome.length > 0) balas.push({ nome, campos: camposLimpos(bruta.campos) })
  }
  return balas
}

/** O catálogo do disco, tolerante: entrada torta sai, id repetido fica o primeiro, teto `CATALOGO_MAX`. */
export function catalogoDoArquivo(value: unknown): ItemDoCatalogo[] {
  const brutos = isRecord(value) && Array.isArray(value.itens) ? value.itens : []
  const ids = new Set<string>()
  const itens: ItemDoCatalogo[] = []
  for (const bruto of brutos) {
    if (itens.length === CATALOGO_MAX) break
    if (!isRecord(bruto)) continue
    const item = itemLimpo({ id: bruto.id, tipo: bruto.tipo, nome: bruto.nome, texto: bruto.texto, campos: bruto.campos, balas: bruto.balas })
    if (item === null || ids.has(item.id)) continue
    ids.add(item.id)
    itens.push(item)
  }
  return itens
}

export function serializarCatalogo(itens: readonly ItemDoCatalogo[]): string {
  return `${JSON.stringify({ formato: FORMATO_DO_CATALOGO, itens }, null, 2)}\n`
}

/** A aba da ficha que recebe o tipo. `undefined` = o sistema não tem essa aba (o "Pôr" não se oferece). */
export function abaDeDestino(sistema: SistemaDeRpg, tipo: TipoDeEntrada): AbaDoSistema | undefined {
  return abaDoSistema(sistema, DADOS_DO_TIPO[tipo].aba)
}

/** Os campos que a janela de entrada mostra para o tipo: os da aba de destino, sem a Descrição (é o `texto`). */
export function camposDoTipo(sistema: SistemaDeRpg, tipo: TipoDeEntrada): CampoDoCartao[] {
  return (abaDeDestino(sistema, tipo)?.campos ?? []).filter((campo) => campo.id !== CAMPO_DA_DESCRICAO)
}

/**
 * A ficha pode receber do catálogo? Jogador, modelo e NPC único sim; a
 * variação não, porque herda a ficha do modelo (`sincronizarVariacoes`
 * apagaria o que fosse posto nela).
 */
export function podeReceber(personagem: Personagem): boolean {
  return !(personagem.tipo === 'npc' && personagem.combate?.modeloId !== undefined)
}

export type ResultadoDePorNaFicha =
  | {
      ok: true
      personagem: Personagem
      abaId: string
      /** O cartão novo: o Desfazer o tira por aqui (`tirarDaFicha`). */
      cartaoId: string
      /** A aba Armas passou do "Armas por batalha": a tela avisa "na batalha ela escolhe N". */
      passaDoLimiteDeArmas: boolean
    }
  | { ok: false; motivo: 'semAba' | 'jaTem' | 'variacao' }

function cartaoDaEntrada(entrada: EntradaParaFicha, aba: AbaDoSistema, sistema: SistemaDeRpg): CartaoDaFicha {
  const campos: Record<string, string> = {}
  for (const campo of aba.campos) {
    const valor: string | undefined = campo.id === CAMPO_DA_DESCRICAO ? entrada.texto : entrada.campos[campo.id]
    if (valor !== undefined && valor.trim().length > 0) campos[campo.id] = valor
  }
  const idsDosAtributos = new Set(sistema.atributos.map((atributo) => atributo.id))
  const atributos = aba.atributos === true && ehDoLivro(entrada) ? entrada.atributos.filter((id) => idsDosAtributos.has(id)) : []
  return { ...novoCartao(entrada.nome), campos, atributos, subcartoes: balasDaEntrada(entrada, aba, sistema) }
}

/** As balas da arma do catálogo como subcartões da aba de destino; o campo que a aba das balas não tem fica de fora. */
function balasDaEntrada(entrada: EntradaParaFicha, aba: AbaDoSistema, sistema: SistemaDeRpg): CartaoDaFicha[] {
  if (ehDoLivro(entrada) || entrada.balas === undefined || aba.subcartoes === undefined) return []
  const molde = abaDoSistema(sistema, aba.subcartoes.aba)
  if (molde === undefined) return []
  return entrada.balas.map((bala) => {
    const campos: Record<string, string> = {}
    for (const campo of molde.campos) {
      const valor = bala.campos[campo.id]
      if (valor !== undefined && valor.trim().length > 0) campos[campo.id] = valor
    }
    return { ...novoCartao(bala.nome), campos }
  })
}

/**
 * PÔR NA FICHA: um cartão novo (`novoCartao`) no fim da aba de destino, com
 * nome, Descrição e os campos que a aba tem copiados da entrada (campo que a
 * aba não tem fica de fora). Não põe de novo o que a aba já tem com o mesmo
 * nome, nem em variação.
 */
export function porNaFicha(personagem: Personagem, entrada: EntradaParaFicha, sistema: SistemaDeRpg): ResultadoDePorNaFicha {
  if (!podeReceber(personagem)) return { ok: false, motivo: 'variacao' }
  const aba = abaDeDestino(sistema, entrada.tipo)
  if (aba === undefined) return { ok: false, motivo: 'semAba' }
  const atuais = cartoesDaAba(personagem, aba.id)
  const chave = chaveDoNomeDaEntrada(entrada.nome)
  if (atuais.some((cartao) => chaveDoNomeDaEntrada(cartao.nome) === chave)) return { ok: false, motivo: 'jaTem' }
  const cartao = cartaoDaEntrada(entrada, aba, sistema)
  const proximo: Personagem = { ...personagem, abas: { ...personagem.abas, [aba.id]: [...atuais, cartao] } }
  const limite = aba.id === ABA_DAS_ARMAS ? limiteDeArmas(proximo) : null
  return { ok: true, personagem: proximo, abaId: aba.id, cartaoId: cartao.id, passaDoLimiteDeArmas: limite !== null && armasDe(proximo).length > limite }
}

/** O Desfazer do "Pôr": tira o cartão pelo id. Cartão que já não está lá devolve a MESMA ficha. */
export function tirarDaFicha(personagem: Personagem, abaId: string, cartaoId: string): Personagem {
  const atuais = cartoesDaAba(personagem, abaId)
  if (!atuais.some((cartao) => cartao.id === cartaoId)) return personagem
  return { ...personagem, abas: { ...personagem.abas, [abaId]: atuais.filter((cartao) => cartao.id !== cartaoId) } }
}

/** O cartão da ficha como entrada do catálogo. `null` = sem nome, ou com o nome de fábrica ("Arma"). */
function itemDoCartao(cartao: CartaoDaFicha, tipo: TipoDoCatalogo): ItemDoCatalogo | null {
  const balas = tipo === 'arma' && cartao.subcartoes.length > 0 ? cartao.subcartoes.map((sub) => ({ nome: sub.nome, campos: sub.campos })) : undefined
  const item = itemLimpo({ id: novoIdDeEntrada(), tipo, nome: cartao.nome, texto: cartao.campos[CAMPO_DA_DESCRICAO] ?? '', campos: cartao.campos, balas })
  if (item === null || chaveDoNomeDaEntrada(item.nome) === chaveDoNomeDaEntrada(DADOS_DO_TIPO[tipo].um)) return null
  return item
}

/**
 * "JUNTAR DAS FICHAS DA PASTA": as armas, habilidades e itens que as fichas
 * já têm, como entradas NOVAS do catálogo. Sem repetir nome dentro do mesmo
 * tipo (nem com o que o catálogo já tem, nem entre as fichas: fica a primeira).
 * Devolve só as novas, sem passar do `CATALOGO_MAX` somado ao catálogo.
 */
export function juntarDasFichas(personagens: readonly Personagem[], catalogo: readonly ItemDoCatalogo[] = []): ItemDoCatalogo[] {
  const chaveDe = (tipo: TipoDoCatalogo, nome: string): string => `${tipo}:${chaveDoNomeDaEntrada(nome)}`
  const vistos = new Set(catalogo.map((item) => chaveDe(item.tipo, item.nome)))
  const novos: ItemDoCatalogo[] = []
  for (const personagem of personagens) {
    for (const tipo of TIPOS_DO_CATALOGO) {
      for (const cartao of cartoesDaAba(personagem, DADOS_DO_TIPO[tipo].aba)) {
        if (catalogo.length + novos.length >= CATALOGO_MAX) return novos
        const item = itemDoCartao(cartao, tipo)
        if (item === null) continue
        const chave = chaveDe(tipo, item.nome)
        if (vistos.has(chave)) continue
        vistos.add(chave)
        novos.push(item)
      }
    }
  }
  return novos
}

/**
 * A BUSCA da página: sem acento e sem caixa, por nome, texto, valores dos
 * campos e o nome do tipo ("arma"). Cada palavra da busca precisa aparecer
 * (em qualquer ordem). Busca vazia = todas do filtro. Mantém a ordem recebida.
 */
export function buscarNoCatalogo<T extends EntradaParaFicha>(entradas: readonly T[], busca: string, filtro: TipoDeEntrada | 'todos'): T[] {
  const palavras = normalizarParaBusca(busca)
    .split(' ')
    .filter((palavra) => palavra.length > 0)
  return entradas.filter((entrada) => {
    if (filtro !== 'todos' && entrada.tipo !== filtro) return false
    if (palavras.length === 0) return true
    const balas = ehDoLivro(entrada) ? [] : (entrada.balas ?? []).flatMap((bala) => [bala.nome, ...Object.values(bala.campos)])
    const alvo = normalizarParaBusca([entrada.nome, entrada.texto, ...Object.values(entrada.campos), ...balas, DADOS_DO_TIPO[entrada.tipo].um].join(' '))
    return palavras.every((palavra) => alvo.includes(palavra))
  })
}
