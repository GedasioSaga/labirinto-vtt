import { normalizarParaBusca } from '../buscaNoLivro'
import { ABA_DAS_ARMAS, armasDosCartoes, limiteDeArmas } from '../batalha/leituraDaFicha'
import { alcanceDoArquivo, cartoesDaAba, mecanicaDoArquivo, novoCartao, type AlcanceGuardado, type CartaoDaFicha, type MecanicaGuardada, type Personagem, type RequisitosGuardados } from '../personagem'
import { marcasGuardadas, requisitosGuardados } from '../batalha/requisitos/guardados'
import { abaDoSistema, type AbaDoSistema, type CampoDoCartao, type SistemaDeRpg } from '../sistemaDeRpg'
import { lerMecanica } from '../batalha/mecanica/modelo'
import { pecasDo } from '../batalha/mecanica/pecas'

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
  /**
   * COISA x REGRA (Fase 5 da melhoria geral, tmp/auditoria-ferramentas-2026-11-15/
   * 2-dados-que-nao-conversam.md §5.3): o item do Acervo do app (`item_<uuid>`)
   * de que esta entrada é a REGRA. Só arma e item (habilidade não tem coisa).
   * O "Pôr em" da arma ligada cria o cartão com o mesmo `itemId` e põe a coisa
   * na mochila; o do item ligado dá a coisa inteira (foto, pilha). Ausente =
   * entrada solta, como antes.
   */
  acervoId?: string
  /**
   * B04 (docs/design/habilidades/ANALISE.md; Fase 1 do SISTEMA.md): as peças
   * da técnica ou da arma montada, guardadas como vieram (opacas, como no
   * cartão: quem lê é `lerMecanica`). "Juntar das fichas" a traz e "Pôr em" a
   * leva ao cartão novo. Só arma e habilidade (o item ganha o efeito na fase 7).
   * Ausente = a entrada vale pelo texto, como antes.
   */
  mecanica?: MecanicaGuardada
  /**
   * ALCANCE (fase B, docs/design/habilidades/ALCANCE.md §3.3): a forma do alcance
   * da arma ou da habilidade que não é montada, guardada como no cartão (opaca;
   * quem lê é `alcanceDoCartao`). "Pôr em" a leva ao cartão novo e a arma ligada
   * a copia como a `mecanica` (`regraDaArma.ts`). Ausente = sem alcance próprio.
   */
  alcance?: AlcanceGuardado
  /**
   * REQUISITOS (fase A, docs/design/habilidades/REQUISITOS.md §3.2): o bloco da habilidade ou da
   * arma, guardado como no cartão (opaco; quem lê é `lerRequisitos`). "Trazer" e "Juntar" o levam
   * ao cartão (fase B2). Ausente = sem requisito.
   */
  requisitos?: RequisitosGuardados
  /**
   * MARCAS (fase B2 dos requisitos, resposta do dono de 23/11 ao G2): as da habilidade ou da arma
   * ("Fogo"), como no cartão. "Pôr em" as leva ao cartão novo e "Juntar das fichas" as traz.
   * Ausente = sem marca.
   */
  marcas?: string[]
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
/**
 * Valor de um campo (Dano, Ação...): é uma linha da ficha. Fase ED4: era 200 e cortava no meio o Efeito
 * que o app gera para a arma montada (o do Boomerang); agora o mesmo teto da Descrição. O app de antes
 * ainda corta em 200 ao ler e, se salvar o catálogo, grava cortado (app, site e Worker saem juntos).
 */
export const ENTRADA_CAMPO_MAX = ENTRADA_TEXTO_MAX
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
export function itemLimpo(item: { id: unknown; tipo: unknown; nome: unknown; texto: unknown; campos: unknown; balas?: unknown; acervoId?: unknown; mecanica?: unknown; alcance?: unknown; requisitos?: unknown; marcas?: unknown }): ItemDoCatalogo | null {
  if (typeof item.id !== 'string' || !ID_DE_ENTRADA.test(item.id) || !ehTipoDoCatalogo(item.tipo) || typeof item.nome !== 'string') return null
  const nome = cortar(item.nome.trim(), ENTRADA_NOME_MAX).trim()
  if (nome.length === 0) return null
  const texto = typeof item.texto === 'string' ? cortar(item.texto.trim(), ENTRADA_TEXTO_MAX).trim() : ''
  const limpo: ItemDoCatalogo = { id: item.id, tipo: item.tipo, nome, texto, campos: camposLimpos(item.campos) }
  // Só a arma leva balas; lista que não é lista conta como "não diz".
  if (item.tipo === 'arma' && Array.isArray(item.balas)) limpo.balas = balasLimpas(item.balas)
  // Fase 5: a ligação com a coisa do Acervo; habilidade não tem coisa, id torto sai.
  if (item.tipo !== 'habilidade' && typeof item.acervoId === 'string' && ID_DE_ENTRADA.test(item.acervoId)) limpo.acervoId = item.acervoId
  // B04: a mecânica pelo mesmo leitor (e teto) do cartão da ficha; o item ainda não tem mecânica.
  if (item.tipo !== 'item') Object.assign(limpo, mecanicaDoArquivo(item.mecanica))
  // Fase B do alcance: a forma do alcance pelo mesmo leitor do cartão, nos mesmos tipos da mecânica.
  if (item.tipo !== 'item') Object.assign(limpo, alcanceDoArquivo(item.alcance))
  // Fase B2 dos requisitos: o bloco e as marcas como vieram, nos mesmos tipos (o item os tem no Acervo).
  if (item.tipo !== 'item') Object.assign(limpo, requisitosEMarcas(item.requisitos, item.marcas))
  return limpo
}

/** Fase B2 dos requisitos: o bloco e as marcas pelos leitores do cartão (`lib/batalha/requisitos/guardados.ts`); o que não vale sai. */
function requisitosEMarcas(requisitos: unknown, marcas: unknown): Pick<ItemDoCatalogo, 'requisitos' | 'marcas'> {
  const bloco = requisitosGuardados(requisitos)
  const lidas = marcasGuardadas(marcas)
  return { ...(bloco === undefined ? {} : { requisitos: bloco }), ...(lidas === undefined ? {} : { marcas: lidas }) }
}

/**
 * A entrada do catálogo ligada à coisa `acervoId` do Acervo (a primeira, se
 * houver mais de uma). `undefined` = nenhuma regra neste livro para a coisa.
 */
export function regraDaCoisa(catalogo: readonly ItemDoCatalogo[], acervoId: string): ItemDoCatalogo | undefined {
  return catalogo.find((entrada) => entrada.acervoId === acervoId)
}

/**
 * "LIGAR PELO NOME": cada arma e item do catálogo ainda sem ligação ganha a
 * coisa do Acervo de mesmo nome (sem acento, sem caixa: a chave do catálogo).
 * Coisa que já é de outra entrada não liga de novo. Devolve o catálogo novo e
 * quantas ligou; nada a ligar = a MESMA lista.
 */
export function ligarPeloNome(catalogo: readonly ItemDoCatalogo[], acervo: readonly { id: string; nome: string }[]): { itens: ItemDoCatalogo[]; ligadas: number } {
  const usadas = new Set(catalogo.flatMap((entrada) => (entrada.acervoId === undefined ? [] : [entrada.acervoId])))
  const porNome = new Map<string, string>()
  for (const coisa of acervo) {
    const chave = chaveDoNomeDaEntrada(coisa.nome)
    if (!porNome.has(chave)) porNome.set(chave, coisa.id)
  }
  let ligadas = 0
  const itens = catalogo.map((entrada) => {
    if (entrada.tipo === 'habilidade' || entrada.acervoId !== undefined) return entrada
    const acervoId = porNome.get(chaveDoNomeDaEntrada(entrada.nome))
    if (acervoId === undefined || usadas.has(acervoId) || !ID_DE_ENTRADA.test(acervoId)) return entrada
    usadas.add(acervoId)
    ligadas += 1
    return { ...entrada, acervoId }
  })
  return ligadas === 0 ? { itens: [...catalogo], ligadas } : { itens, ligadas }
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
    const item = itemLimpo({ id: bruto.id, tipo: bruto.tipo, nome: bruto.nome, texto: bruto.texto, campos: bruto.campos, balas: bruto.balas, acervoId: bruto.acervoId, mecanica: bruto.mecanica, alcance: bruto.alcance, requisitos: bruto.requisitos, marcas: bruto.marcas })
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

/** A aba das formas da ficha (rework das habilidades, D5): a habilidade com a peça Transformação mora nela. */
export const ABA_DAS_TRANSFORMACOES = 'transformacoes'

/** A mecânica traz a peça Transformação (versão 5)? Mecânica torta, futura ou sem peças: não. */
export function ehMecanicaDeForma(mecanica: MecanicaGuardada | undefined): boolean {
  const lida = lerMecanica(mecanica)
  return lida.tipo === 'pecas' && pecasDo(lida.mecanica.pecas, 'transformacao').length > 0
}

/**
 * A aba que recebe ESTA entrada (rework das habilidades, D5): a habilidade com a peça Transformação vai
 * para a aba das formas, quando o sistema a tem; o resto segue `abaDeDestino` pelo tipo.
 */
export function abaDaEntrada(sistema: SistemaDeRpg, entrada: EntradaParaFicha): AbaDoSistema | undefined {
  if (!ehDoLivro(entrada) && entrada.tipo === 'habilidade' && ehMecanicaDeForma(entrada.mecanica)) {
    const formas = abaDoSistema(sistema, ABA_DAS_TRANSFORMACOES)
    if (formas !== undefined) return formas
  }
  return abaDeDestino(sistema, entrada.tipo)
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

export function cartaoDaEntrada(entrada: EntradaParaFicha, aba: AbaDoSistema, sistema: SistemaDeRpg): CartaoDaFicha {
  const campos: Record<string, string> = {}
  for (const campo of aba.campos) {
    const valor: string | undefined = campo.id === CAMPO_DA_DESCRICAO ? entrada.texto : entrada.campos[campo.id]
    if (valor !== undefined && valor.trim().length > 0) campos[campo.id] = valor
  }
  const idsDosAtributos = new Set(sistema.atributos.map((atributo) => atributo.id))
  const atributos = aba.atributos === true && ehDoLivro(entrada) ? entrada.atributos.filter((id) => idsDosAtributos.has(id)) : []
  // Fase 5: a arma ligada a uma coisa do Acervo leva o id dela; é por ele que a Garrucha da mochila acha esta regra.
  const itemId = !ehDoLivro(entrada) && entrada.tipo === 'arma' ? entrada.acervoId : undefined
  // B04: a mecânica da entrada vai junto, em cópia (o cartão novo não divide o objeto com o catálogo).
  const mecanica = ehDoLivro(entrada) ? {} : mecanicaDoArquivo(entrada.mecanica)
  // Fase B do alcance: a forma do alcance também, em cópia.
  const alcance = ehDoLivro(entrada) ? {} : alcanceDoArquivo(entrada.alcance)
  // Fase B2 dos requisitos: o bloco e as marcas também, em cópia.
  const requisitos = ehDoLivro(entrada) ? {} : requisitosEMarcas(entrada.requisitos, entrada.marcas)
  return { ...novoCartao(entrada.nome), campos, atributos, subcartoes: balasDaEntrada(entrada, aba, sistema), ...(itemId === undefined ? {} : { itemId }), ...mecanica, ...alcance, ...requisitos }
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
  const aba = abaDaEntrada(sistema, entrada)
  if (aba === undefined) return { ok: false, motivo: 'semAba' }
  const atuais = cartoesDaAba(personagem, aba.id)
  const chave = chaveDoNomeDaEntrada(entrada.nome)
  if (atuais.some((cartao) => chaveDoNomeDaEntrada(cartao.nome) === chave)) return { ok: false, motivo: 'jaTem' }
  const cartao = cartaoDaEntrada(entrada, aba, sistema)
  const proximo: Personagem = { ...personagem, abas: { ...personagem.abas, [aba.id]: [...atuais, cartao] } }
  const limite = aba.id === ABA_DAS_ARMAS ? limiteDeArmas(proximo) : null
  return { ok: true, personagem: proximo, abaId: aba.id, cartaoId: cartao.id, passaDoLimiteDeArmas: limite !== null && armasDosCartoes(proximo).length > limite }
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
  const item = itemLimpo({ id: novoIdDeEntrada(), tipo, nome: cartao.nome, texto: cartao.campos[CAMPO_DA_DESCRICAO] ?? '', campos: cartao.campos, balas, mecanica: cartao.mecanica, alcance: cartao.alcance, requisitos: cartao.requisitos, marcas: cartao.marcas })
  if (item === null || chaveDoNomeDaEntrada(item.nome) === chaveDoNomeDaEntrada(DADOS_DO_TIPO[tipo].um)) return null
  return item
}

/**
 * "GUARDAR TAMBÉM NO CATÁLOGO DO LIVRO" (rework das habilidades, D14): a habilidade da ficha como
 * entrada de habilidade. A de mesmo nome já no catálogo é trocada (o mesmo id); sem ela, nasce uma.
 * `null` = sem nome, ou com o nome de fábrica. O catálogo não guarda acumulador, imagem, modificadores
 * nem subcartões (MAPA §1.2): a peça Transformação vai, porque mora na `mecanica`.
 */
export function entradaDaHabilidade(cartao: CartaoDaFicha, catalogo: readonly ItemDoCatalogo[]): ItemDoCatalogo | null {
  const nova = itemDoCartao(cartao, 'habilidade')
  if (nova === null) return null
  const chave = chaveDoNomeDaEntrada(nova.nome)
  const mesma = catalogo.find((item) => item.tipo === 'habilidade' && chaveDoNomeDaEntrada(item.nome) === chave)
  return mesma === undefined ? nova : { ...nova, id: mesma.id }
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
 * B04, "JUNTAR DAS FICHAS" DE NOVO (SISTEMA.md §10): as entradas do catálogo
 * SEM mecânica ganham a do cartão montado de mesmo tipo e nome numa ficha da
 * pasta (o primeiro achado). Entrada que já tem mecânica não muda. Devolve o
 * catálogo novo e quantas ganharam; nenhuma = a MESMA lista.
 */
export function mecanicasDasFichas(personagens: readonly Personagem[], catalogo: readonly ItemDoCatalogo[]): { itens: ItemDoCatalogo[]; ganharam: number } {
  const chaveDe = (tipo: TipoDoCatalogo, nome: string): string => `${tipo}:${chaveDoNomeDaEntrada(nome)}`
  const montadas = new Map<string, MecanicaGuardada>()
  for (const personagem of personagens) {
    for (const tipo of ['arma', 'habilidade'] as const) {
      for (const cartao of cartoesDaAba(personagem, DADOS_DO_TIPO[tipo].aba)) {
        const chave = chaveDe(tipo, cartao.nome)
        if (cartao.mecanica !== undefined && !montadas.has(chave)) montadas.set(chave, cartao.mecanica)
      }
    }
  }
  let ganharam = 0
  const itens = catalogo.map((entrada) => {
    if (entrada.tipo === 'item' || entrada.mecanica !== undefined) return entrada
    const achada = montadas.get(chaveDe(entrada.tipo, entrada.nome))
    const { mecanica } = mecanicaDoArquivo(achada)
    if (mecanica === undefined) return entrada
    ganharam += 1
    return { ...entrada, mecanica }
  })
  return ganharam === 0 ? { itens: [...catalogo], ganharam } : { itens, ganharam }
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
