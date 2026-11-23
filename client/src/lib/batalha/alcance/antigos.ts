import type { EfeitoDoItem } from '../../../types/map'
import type { ItemDoCatalogo as ItemDoAcervo } from '../../acervoDeItens'
import type { ItemDoCatalogo } from '../../livros/catalogo'
import type { PastaDeItens } from '../../pastasDosItens'
import { cartoesDaAba, type AlcanceGuardado, type CartaoDaFicha, type MecanicaGuardada, type Personagem } from '../../personagem'
import { alcanceDaMecanica, alcanceDoCartao, formaDoAlcanceGuardada } from '../alcanceDoCartao'
import { ABA_DAS_ARMAS, ABA_DAS_TECNICAS, ehArmaDaMochila } from '../leituraDaFicha'
import { pecasDoCartao } from '../mecanica/leitura'
import type { MecanicaV1 } from '../mecanica/modelo'
import { guardarMecanica } from '../mecanica/modelos'
import { efeitoDoModeloDeItem, mecanicaDoModeloDeItem, modeloSugeridoParaOItem, MODELOS_DE_ITEM, type IdDoModeloDeItem } from '../mecanica/modelosDeItem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import type { FormaDoAlcance } from './forma'

/**
 * OS ANTIGOS SEM ALCANCE (fase G, docs/design/habilidades/ALCANCE.md §9; pedido do dono de
 * 22/11: "Eu preencho e você confere"). A habilidade e a arma de antes do alcance não acendem
 * casa nenhuma. O Claude propõe um alcance para cada uma pelo texto (`alcances-propostos.json`,
 * fora do repo), o mestre confere a lista e só o Confirmar grava.
 *
 * Aqui a parte pura: QUEM está sem alcance (pelo único leitor, `alcanceDoCartao`), ONDE o
 * alcance se grava (a ordem do §3.2) e a gravação de volta (o Desfazer). A ordem das gravações
 * no disco e as cópias de antes ficam em `stores/alcanceDosAntigos.ts`.
 *
 * - A mecânica montada recebe o alcance no alvo dela (`alvo.alcance`, o anel em `alcanceMinimo`);
 *   a forma dela não muda (quem é atingido continua o mesmo).
 * - O cartão só de texto e a entrada do livro sem mecânica recebem o campo `alcance` (qualquer forma).
 * - A arma da ficha ligada a uma entrada do livro não entra: a entrada é a fonte (ela recebe, e as
 *   cópias seguem pelo caminho de sempre, `fichasComARegraDaArma`).
 * - A mecânica que este app não lê (torta, de app mais novo) não entra: vai para `naoLidos`.
 * - O ITEM do Acervo (pedido do dono, 23/11: "Coloque isso para itens quanto para habilidades"):
 *   o alcance dele mora no "O que ele faz" (`efeito.mecanica.alvo`), sem campo à parte. O item que
 *   já tem efeito já tem alcance pelo modelo dele. O que não tem entra com o modelo proposto (o do
 *   arquivo, senão o do "Sugerir efeito", `modeloSugeridoParaOItem`) e o alcance desse modelo;
 *   o Confirmar grava o efeito inteiro. Sem modelo parecido, o item não entra. O item da categoria
 *   Arma com entrada de arma no livro também não: o que ele faz é a regra de arma do livro
 *   (ItemDoCatalogoDialog), e um efeito de item nele seria uma 2a verdade, escondida na janela.
 * - O item da categoria Arma SEM entrada de arma no livro (decisão do dono, 23/11, a Granada:
 *   "Virar Consumível"): entra só quando o arquivo da proposta dá um modelo a ele (nunca pelo
 *   "Sugerir efeito": a Garrucha não vira poção por uma palavra do nome). O Confirmar o passa a
 *   Consumível junto com o efeito (a batalha deixa de lê-lo como arma, `ehArmaDaMochila`), e as
 *   vagas das mochilas que são cópia dele também; ele muda da pasta da categoria velha para a da
 *   nova, quando mora numa e a outra existe. O Desfazer devolve a categoria, a pasta e as vagas.
 *
 * Puro: sem store, sem rede, sem disco.
 */

/** O arquivo da proposta, na pasta de dados do app (nunca no repo: o texto é da campanha). */
export const ARQUIVO_DAS_PROPOSTAS = 'alcances-propostos.json'

/** Até quantas letras do texto a lista mostra e a proposta guarda. */
export const TRECHO_MAX = 320

export type GrupoDoAntigo = 'arma' | 'habilidade' | 'item'

/**
 * Onde o alcance se grava:
 * - `campo`: o campo `alcance` (qualquer forma);
 * - `alvo`: a mecânica de 1 ou vários alvos (alvo até N, ou o anel de N a M);
 * - `centro`: a mecânica da área longe (só até onde vai o centro; a explosão fica).
 */
export type OndeOAlcanceVai = 'campo' | 'alvo' | 'centro'

export interface AntigoSemAlcance {
  /** `livro:<sistema>:<entrada>`, `ficha:<pasta>:<personagem>:<cartão>` ou `acervo:<item>`: a mesma da proposta. */
  chave: string
  lugar: 'livro' | 'ficha' | 'acervo'
  grupo: GrupoDoAntigo
  nome: string
  /** A descrição e os campos, numa linha, até `TRECHO_MAX`. */
  texto: string
  onde: OndeOAlcanceVai
  /** Dá dano (a cor da prévia: azul com dano, verde sem): a mecânica com dano, ou o campo Dano escrito. */
  daDano: boolean
  /** Só na ficha. */
  personagemId?: string
  personagemNome?: string
  /** Só no item do Acervo: o modelo do "O que ele faz" proposto (a lista deixa trocar). */
  modelo?: IdDoModeloDeItem
  /** Só no item da categoria Arma sem entrada de arma no livro: a categoria (e a pasta) que ele ganha no Confirmar. */
  virar?: ViradaDaCategoria
}

/** O item que era Arma e vira Consumível: de que categoria, para qual, e a pasta nova. */
export interface ViradaDaCategoria {
  de: string
  para: string
  /** A pasta do Acervo da categoria nova, quando ele mora na pasta da categoria velha; ausente = a pasta fica. */
  pasta?: string
}

/** A categoria que o item da categoria Arma sem regra no livro ganha (a do dono, 23/11: "Virar Consumível"). */
export const CATEGORIA_DO_ITEM_QUE_ERA_ARMA = 'Consumível'

/** Quem não deu para ler (a mecânica torta ou de app mais novo): o editor dela diz o que fazer. */
export interface AntigoNaoLido {
  chave: string
  nome: string
  personagemNome?: string
}

export interface DadosDosAntigos {
  /** O livro aberto: as chaves do catálogo e as contas dos modelos de item (o atributo da força). */
  sistema: SistemaDeRpg
  catalogo: readonly ItemDoCatalogo[]
  /** Os itens do Acervo (vazio = o Acervo não foi lido: nenhum item entra nem se grava). */
  acervo: readonly ItemDoAcervo[]
  /** As pastas do Acervo: o item que vira Consumível muda da pasta Arma para a Consumível. */
  pastasDoAcervo: readonly PastaDeItens[]
  pastaId: string | null
  personagens: readonly Personagem[]
}

export interface ListaDosAntigos {
  antigos: AntigoSemAlcance[]
  naoLidos: AntigoNaoLido[]
}

/** O mesmo que se lê ou se grava num cartão e numa entrada do livro. */
type ComAlcance = Pick<CartaoDaFicha, 'id' | 'mecanica' | 'alcance'>

const GRUPO_DA_ENTRADA: Readonly<Partial<Record<ItemDoCatalogo['tipo'], GrupoDoAntigo>>> = { arma: 'arma', habilidade: 'habilidade' }
const GRUPO_DA_ABA: readonly (readonly [string, GrupoDoAntigo])[] = [
  [ABA_DAS_TECNICAS, 'habilidade'],
  [ABA_DAS_ARMAS, 'arma'],
]

export function chaveDoLivro(sistemaId: string, entradaId: string): string {
  return `livro:${sistemaId}:${entradaId}`
}

export function chaveDoAcervo(itemId: string): string {
  return `acervo:${itemId}`
}

export function chaveDaFicha(pastaId: string, personagemId: string, cartaoId: string): string {
  return `ficha:${pastaId}:${personagemId}:${cartaoId}`
}

/** A descrição primeiro, depois os outros campos (`efeito: ...`), numa linha. */
function textoDe(descricao: string, campos: Readonly<Record<string, string>>): string {
  const outros = Object.entries(campos)
    .filter(([chave, valor]) => chave !== 'descricao' && valor.trim() !== '')
    .map(([chave, valor]) => `${chave}: ${valor.trim()}`)
  const junto = [descricao.trim(), ...outros].filter((parte) => parte !== '').join(' | ').replace(/\s+/g, ' ')
  return junto.length > TRECHO_MAX ? `${junto.slice(0, TRECHO_MAX - 1)}…` : junto
}

/** Se dá dano, para a cor da prévia: a arma sempre; a mecânica pela peça do dano; o texto pelo campo Dano ("0" e "-" não contam). */
function daDano(x: ComAlcance & { campos: Readonly<Record<string, string>> }, grupo: GrupoDoAntigo): boolean {
  if (grupo === 'arma') return true
  const pecas = x.mecanica === undefined ? null : pecasDoCartao(x)
  if (pecas !== null) return pecas.dano !== undefined
  const dano = (x.campos.dano ?? '').trim()
  return dano !== '' && dano !== '0' && dano !== '-'
}

/** Onde o alcance deste vai; `null` = já tem alcance; `'naoLido'` = a mecânica não se lê. */
function ondeVai(x: ComAlcance): OndeOAlcanceVai | 'naoLido' | null {
  if (alcanceDoCartao(x) !== null) return null
  if (x.mecanica === undefined) return 'campo'
  const pecas = pecasDoCartao(x)
  return pecas === null ? 'naoLido' : ondeDaMecanica(pecas)
}

/** A mecânica de 1 ou vários alvos guarda o alcance no alvo; a área longe, no centro. */
function ondeDaMecanica(pecas: MecanicaV1): OndeOAlcanceVai {
  const { forma } = pecas.alvo
  return forma.tipo === 'um' || forma.tipo === 'varios' ? 'alvo' : 'centro'
}

/** A coisa do Acervo tem entrada de arma no livro (a regra dela é a entrada). */
function temArmaNoLivro(itemId: string, catalogo: readonly ItemDoCatalogo[]): boolean {
  return catalogo.some((entrada) => entrada.tipo === 'arma' && entrada.acervoId === itemId)
}

/** A arma da ficha que segue uma entrada do livro (pela coisa do Acervo): quem recebe é a entrada. */
function armaQueSegueOLivro(cartao: CartaoDaFicha, catalogo: readonly ItemDoCatalogo[]): boolean {
  return cartao.itemId !== undefined && temArmaNoLivro(cartao.itemId, catalogo)
}

// ─── O item do Acervo ───────────────────────────────────────────────────────

/** Sem arquivo de proposta: o item segue só o "Sugerir efeito". */
export const SEM_ARQUIVO: PropostasDoArquivo = { propostas: new Map(), semModelo: new Set() }

/** O modelo proposto para o item: o do arquivo (o Claude leu o texto), senão o do "Sugerir efeito"; `null` = nenhum serve. */
export function modeloPropostoParaOItem(item: Pick<ItemDoAcervo, 'id' | 'nome' | 'descricao'>, doArquivo: PropostasDoArquivo): IdDoModeloDeItem | null {
  const chave = chaveDoAcervo(item.id)
  if (doArquivo.semModelo.has(chave)) return null
  // A linha do arquivo é opcional (o item novo depois do arquivo não está nele): sem ela, o "Sugerir efeito".
  return doArquivo.propostas.get(chave)?.modelo ?? modeloSugeridoParaOItem(item.nome, item.descricao)
}

/** O mesmo nome de pasta ou categoria, sem diferença de caixa nem de espaço nas pontas. */
function mesmoNome(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')
}

/**
 * O item da categoria Arma que vira Consumível; `null` = não vira (não é Arma, ou tem entrada de
 * arma no livro: a regra é a entrada). A pasta só muda se ele mora na pasta da categoria velha e
 * a da nova existe (a pasta que o mestre criou à mão fica).
 */
export function viradaDoItem(item: Pick<ItemDoAcervo, 'id' | 'categoria' | 'pasta'>, dados: Pick<DadosDosAntigos, 'catalogo' | 'pastasDoAcervo'>): ViradaDaCategoria | null {
  if (!ehArmaDaMochila(item) || temArmaNoLivro(item.id, dados.catalogo)) return null
  const para = CATEGORIA_DO_ITEM_QUE_ERA_ARMA
  const atual = item.pasta === undefined ? undefined : dados.pastasDoAcervo.find((pasta) => pasta.id === item.pasta)
  const nova = atual === undefined || !mesmoNome(atual.nome, item.categoria) ? undefined : dados.pastasDoAcervo.find((pasta) => mesmoNome(pasta.nome, para))
  return nova === undefined ? { de: item.categoria, para } : { de: item.categoria, para, pasta: nova.id }
}

/**
 * Como o item do Acervo entra na lista: o modelo e, no da categoria Arma, a virada; `null` = fica
 * fora (já tem efeito, é arma do livro, ou nenhum modelo serve). A Arma só entra pelo modelo do
 * arquivo, nunca pelo "Sugerir efeito".
 */
function comoOItemEntra(item: ItemDoAcervo, dados: DadosDosAntigos, doArquivo: PropostasDoArquivo): { modelo: IdDoModeloDeItem; virar?: ViradaDaCategoria } | null {
  if (item.efeito !== undefined) return null
  if (!ehArmaDaMochila(item)) {
    const modelo = modeloPropostoParaOItem(item, doArquivo)
    return modelo === null ? null : { modelo }
  }
  const virar = viradaDoItem(item, dados)
  // A linha do arquivo é opcional: a arma sem ela fica fora (só o Claude, lendo o texto, a propõe como item).
  const modelo = doArquivo.propostas.get(chaveDoAcervo(item.id))?.modelo
  return virar === null || modelo === undefined ? null : { modelo, virar }
}

/** A forma do alcance que o modelo traz de fábrica; `null` = o modelo não diz até onde vai. */
export function formaDoModelo(modelo: IdDoModeloDeItem, sistema: SistemaDeRpg): FormaDoAlcance | null {
  return alcanceDaMecanica(mecanicaDoModeloDeItem(modelo, sistema))
}

/** Se o modelo dá dano (a cor da prévia: azul com dano, verde sem). */
export function modeloDaDano(modelo: IdDoModeloDeItem, sistema: SistemaDeRpg): boolean {
  return mecanicaDoModeloDeItem(modelo, sistema).dano !== undefined
}

/** Onde o alcance do modelo vai (a nota da linha). */
export function ondeNoModelo(modelo: IdDoModeloDeItem, sistema: SistemaDeRpg): OndeOAlcanceVai {
  return ondeDaMecanica(mecanicaDoModeloDeItem(modelo, sistema))
}

/** As formas são planas (tipo e números): a mesma = as mesmas chaves com os mesmos valores, em qualquer ordem. */
function mesmaForma(a: FormaDoAlcance, b: FormaDoAlcance): boolean {
  const plana = (forma: FormaDoAlcance): string => JSON.stringify(Object.entries(forma).sort(([x], [y]) => x.localeCompare(y)))
  return plana(a) === plana(b)
}

/** As peças do modelo com o alcance da forma; `null` = não cabe. A forma igual à de fábrica não mexe nas peças. */
function mecanicaDoItemCom(modelo: IdDoModeloDeItem, forma: FormaDoAlcance, sistema: SistemaDeRpg): MecanicaV1 | null {
  const mecanica = mecanicaDoModeloDeItem(modelo, sistema)
  const daFabrica = alcanceDaMecanica(mecanica)
  if (daFabrica !== null && mesmaForma(daFabrica, forma)) return mecanica
  const alvo = alvoComAlcance(mecanica, forma)
  return alvo === null ? null : { ...mecanica, alvo }
}

/** A forma como ela fica no efeito do modelo (só o número muda, como na mecânica montada); `null` = não cabe. */
export function formaQueCabeNoItem(modelo: IdDoModeloDeItem, forma: FormaDoAlcance, sistema: SistemaDeRpg): FormaDoAlcance | null {
  const mecanica = mecanicaDoItemCom(modelo, forma, sistema)
  return mecanica === null ? null : alcanceDaMecanica(mecanica)
}

/** O "O que ele faz" do modelo com o alcance escolhido; `undefined` = não cabe. */
function efeitoComAlcance(modelo: IdDoModeloDeItem, forma: FormaDoAlcance, sistema: SistemaDeRpg): EfeitoDoItem | undefined {
  const mecanica = mecanicaDoItemCom(modelo, forma, sistema)
  return mecanica === null ? undefined : efeitoDoModeloDeItem(modelo, sistema, mecanica)
}

/**
 * As propostas que a lista mostra: as do arquivo, mais a do item que o arquivo não cobre (o modelo
 * do "Sugerir efeito" com o alcance de fábrica dele). O item é sempre certeza baixa: o efeito
 * inteiro é palpite pelo texto.
 */
export function propostasDaLista(antigos: readonly AntigoSemAlcance[], doArquivo: PropostasDoArquivo, sistema: SistemaDeRpg): Map<string, PropostaDeAlcance> {
  const todas = new Map(doArquivo.propostas)
  for (const antigo of antigos) {
    if (antigo.modelo === undefined) continue
    const doArquivoMesmo = todas.get(antigo.chave)
    if (doArquivoMesmo !== undefined && doArquivoMesmo.modelo === antigo.modelo) {
      todas.set(antigo.chave, { ...doArquivoMesmo, certeza: 'baixa' })
      continue
    }
    const forma = formaDoModelo(antigo.modelo, sistema)
    if (forma === null) todas.delete(antigo.chave)
    else todas.set(antigo.chave, { chave: antigo.chave, nome: antigo.nome, forma, certeza: 'baixa', trecho: '', modelo: antigo.modelo })
  }
  return todas
}

/**
 * Todas as habilidades e armas sem alcance (as do livro aberto e as das fichas da pasta aberta) e
 * os itens do Acervo sem "O que ele faz" que têm um modelo proposto.
 */
export function antigosSemAlcance(dados: DadosDosAntigos, doArquivo: PropostasDoArquivo = SEM_ARQUIVO): ListaDosAntigos {
  const antigos: AntigoSemAlcance[] = []
  const naoLidos: AntigoNaoLido[] = []
  for (const entrada of dados.catalogo) {
    const grupo = GRUPO_DA_ENTRADA[entrada.tipo]
    if (grupo === undefined) continue
    const onde = ondeVai(entrada)
    if (onde === null) continue
    const chave = chaveDoLivro(dados.sistema.id, entrada.id)
    if (onde === 'naoLido') naoLidos.push({ chave, nome: entrada.nome })
    else antigos.push({ chave, lugar: 'livro', grupo, nome: entrada.nome, texto: textoDe(entrada.texto, entrada.campos), onde, daDano: daDano(entrada, grupo) })
  }
  for (const item of dados.acervo) {
    const entra = comoOItemEntra(item, dados, doArquivo)
    if (entra === null) continue
    const { modelo, virar } = entra
    const { sistema } = dados
    const antigo: AntigoSemAlcance = { chave: chaveDoAcervo(item.id), lugar: 'acervo', grupo: 'item', nome: item.nome, texto: textoDe(item.descricao, {}), onde: ondeNoModelo(modelo, sistema), daDano: modeloDaDano(modelo, sistema), modelo }
    antigos.push(virar === undefined ? antigo : { ...antigo, virar })
  }
  if (dados.pastaId === null) return { antigos, naoLidos }
  for (const personagem of dados.personagens) {
    for (const [aba, grupo] of GRUPO_DA_ABA) {
      for (const cartao of cartoesDaAba(personagem, aba)) {
        if (grupo === 'arma' && armaQueSegueOLivro(cartao, dados.catalogo)) continue
        const onde = ondeVai(cartao)
        if (onde === null) continue
        const chave = chaveDaFicha(dados.pastaId, personagem.id, cartao.id)
        if (onde === 'naoLido') naoLidos.push({ chave, nome: cartao.nome, personagemNome: personagem.nome })
        else antigos.push({ chave, lugar: 'ficha', grupo, nome: cartao.nome, texto: textoDe(cartao.campos.descricao ?? '', cartao.campos), onde, daDano: daDano(cartao, grupo), personagemId: personagem.id, personagemNome: personagem.nome })
      }
    }
  }
  return { antigos, naoLidos }
}

// ─── A forma que cabe em cada lugar ─────────────────────────────────────────

/** Até onde a forma vai (o número que o alvo e o centro da área longe guardam); `null` = só em quem usa. */
function ateDe(forma: FormaDoAlcance): number | null {
  switch (forma.tipo) {
    case 'si':
      return null
    case 'frente':
      return forma.lado
    default:
      return forma.ate
  }
}

/** O alvo da mecânica com o alcance da forma (o anel só no alvo escolhido). */
function alvoComAlcance(pecas: MecanicaV1, forma: FormaDoAlcance): MecanicaV1['alvo'] | null {
  const ate = ateDe(forma)
  if (ate === null) return null
  const { alcance: _alcance, alcanceMinimo: _minimo, ...alvo } = pecas.alvo
  const comAnel = forma.tipo === 'alvo' && forma.de !== undefined && (alvo.forma.tipo === 'um' || alvo.forma.tipo === 'varios')
  return comAnel && forma.tipo === 'alvo' ? { ...alvo, alcance: ate, alcanceMinimo: forma.de } : { ...alvo, alcance: ate }
}

/**
 * A forma como ela vai ficar de verdade naquele lugar: o campo aceita qualquer uma; a mecânica
 * montada só o número (a forma dela não muda), e o anel só no alvo escolhido. `null` = não cabe
 * (só em quem usa numa mecânica que escolhe alvo).
 */
export function formaQueCabe(x: ComAlcance, forma: FormaDoAlcance): FormaDoAlcance | null {
  if (x.mecanica === undefined) return forma
  const pecas = pecasDoCartao(x)
  if (pecas === null) return null
  const alvo = alvoComAlcance(pecas, forma)
  return alvo === null ? null : alcanceDaMecanica({ alvo })
}

/** A forma que cabe naquele antigo, procurado pela chave nos dados de agora (o item, no efeito do `modelo`). */
export function formaQueCabeNoAntigo(dados: DadosDosAntigos, chave: string, forma: FormaDoAlcance, modelo?: IdDoModeloDeItem): FormaDoAlcance | null {
  if (chave.startsWith(chaveDoAcervo(''))) return modelo === undefined ? null : formaQueCabeNoItem(modelo, forma, dados.sistema)
  const achado = acharPelaChave(dados, chave)
  return achado === null ? null : formaQueCabe(achado, forma)
}

function acharPelaChave(dados: DadosDosAntigos, chave: string): ComAlcance | null {
  for (const entrada of dados.catalogo) if (chaveDoLivro(dados.sistema.id, entrada.id) === chave) return entrada
  if (dados.pastaId === null) return null
  for (const personagem of dados.personagens) {
    for (const [aba] of GRUPO_DA_ABA) {
      for (const cartao of cartoesDaAba(personagem, aba)) if (chaveDaFicha(dados.pastaId, personagem.id, cartao.id) === chave) return cartao
    }
  }
  return null
}

// ─── Gravar e desfazer ──────────────────────────────────────────────────────

export interface EscolhaDoAlcance {
  chave: string
  forma: FormaDoAlcance
  /** Só no item do Acervo: o modelo do "O que ele faz" que ele ganha (sem ele o item não muda). */
  modelo?: IdDoModeloDeItem
}

/** O que o cartão ou a entrada tinha antes: o Desfazer põe de volta exatamente isto. */
export interface AntesDoAlcance {
  chave: string
  alcance: AlcanceGuardado | undefined
  mecanica: MecanicaGuardada | undefined
  /** Só no item do Acervo: o "O que ele faz" de antes (ausente = não tinha; o Confirmar só dá a quem não tinha). */
  efeito?: EfeitoDoItem
  /** Só no item que virou Consumível: a categoria, a pasta e as vagas de antes. */
  virada?: ViradaDeAntes
}

/** O que o item que era Arma tinha antes de virar Consumível. */
export interface ViradaDeAntes {
  categoria: string
  /** A pasta de antes, só quando o Confirmar a mudou. */
  pasta?: string
  /** As vagas das mochilas (da pasta aberta) que eram cópia dele como arma, com a categoria de antes. */
  copias: CategoriaDaVagaDeAntes[]
}

export interface CategoriaDaVagaDeAntes {
  personagemId: string
  vagaId: string
  categoria: string
}

export interface AlcancesGravados {
  catalogo: ItemDoCatalogo[]
  personagens: Personagem[]
  /** Os itens do Acervo (mudou = outro objeto: as cópias nas mochilas seguem pelo `itensNaFonte`). */
  acervo: ItemDoAcervo[]
  /** As que mudaram de verdade (a chave sumida ou que já tem alcance não conta). */
  antes: AntesDoAlcance[]
  /** As entradas de arma do livro que mudaram (as cópias ligadas seguem). */
  armasDoLivro: string[]
}

/** O cartão ou a entrada com o alcance no lugar certo; `null` = nada a gravar (já tem, ou não cabe). */
function comAlcance<T extends ComAlcance>(x: T, forma: FormaDoAlcance): T | null {
  const onde = ondeVai(x)
  if (onde === null || onde === 'naoLido') return null
  if (onde === 'campo') {
    const guardada: AlcanceGuardado = { ...forma }
    return formaDoAlcanceGuardada(guardada) === null ? null : { ...x, alcance: guardada }
  }
  const pecas = pecasDoCartao(x)
  const alvo = pecas === null ? null : alvoComAlcance(pecas, forma)
  return pecas === null || alvo === null ? null : { ...x, mecanica: guardarMecanica({ ...pecas, alvo }) }
}

function antesDe(chave: string, x: ComAlcance): AntesDoAlcance {
  return { chave, alcance: x.alcance, mecanica: x.mecanica }
}

/**
 * O cartão com o `alcance` e a `mecanica` de antes (ausente volta a ser ausente), cada chave no
 * lugar em que estava: o Confirmar só pôs o `alcance` no fim ou trocou a `mecanica` no lugar dela,
 * e o disco volta a sair na mesma ordem de antes.
 */
function comOQueEra<T extends ComAlcance>(x: T, era: AntesDoAlcance): T {
  const entradas = Object.entries(x).flatMap(([chave, valor]): [string, unknown][] => {
    if (chave === 'alcance') return era.alcance === undefined ? [] : [[chave, era.alcance]]
    if (chave === 'mecanica') return era.mecanica === undefined ? [] : [[chave, era.mecanica]]
    return [[chave, valor]]
  })
  if (era.mecanica !== undefined && !('mecanica' in x)) entradas.push(['mecanica', era.mecanica])
  if (era.alcance !== undefined && !('alcance' in x)) entradas.push(['alcance', era.alcance])
  return Object.fromEntries(entradas) as T // as mesmas chaves de T, só o valor de `alcance` e `mecanica` trocado (as duas opcionais em T)
}

type Mudanca = <T extends ComAlcance>(chave: string, x: T) => T | null

/** Passa `mudar` em toda entrada do livro e todo cartão de habilidade e de arma das fichas. */
function emTodos(dados: DadosDosAntigos, mudar: Mudanca): { catalogo: ItemDoCatalogo[]; personagens: Personagem[]; mudaram: string[] } {
  const mudaram: string[] = []
  const catalogo = dados.catalogo.map((entrada) => {
    const nova = mudar(chaveDoLivro(dados.sistema.id, entrada.id), entrada)
    if (nova === null) return entrada
    mudaram.push(chaveDoLivro(dados.sistema.id, entrada.id))
    return nova
  })
  const { pastaId } = dados
  if (pastaId === null) return { catalogo, personagens: [...dados.personagens], mudaram }
  const personagens = dados.personagens.map((personagem) => {
    let abas = personagem.abas
    for (const [aba] of GRUPO_DA_ABA) {
      const cartoes = cartoesDaAba(personagem, aba)
      let trocou = false
      const novos = cartoes.map((cartao) => {
        const chave = chaveDaFicha(pastaId, personagem.id, cartao.id)
        const novo = mudar(chave, cartao)
        if (novo === null) return cartao
        trocou = true
        mudaram.push(chave)
        return novo
      })
      if (trocou) abas = { ...abas, [aba]: novos }
    }
    return abas === personagem.abas ? personagem : { ...personagem, abas }
  })
  return { catalogo, personagens, mudaram }
}

/** GRAVAR: cada escolha no lugar certo. Só muda quem ainda está sem alcance. Puro. */
export function comOsAlcances(dados: DadosDosAntigos, escolhas: readonly EscolhaDoAlcance[]): AlcancesGravados {
  const porChave = new Map(escolhas.map((escolha) => [escolha.chave, escolha]))
  const antes: AntesDoAlcance[] = []
  const feito = emTodos(dados, (chave, x) => {
    const escolha = porChave.get(chave)
    const novo = escolha === undefined ? null : comAlcance(x, escolha.forma)
    if (novo !== null) antes.push(antesDe(chave, x))
    return novo
  })
  let { personagens } = feito
  const acervo = dados.acervo.map((item) => {
    const chave = chaveDoAcervo(item.id)
    const escolha = porChave.get(chave)
    // Só quem ainda não tem "O que ele faz": o efeito que o mestre montou nunca é trocado daqui.
    if (item.efeito !== undefined || escolha?.modelo === undefined) return item
    const virar = ehArmaDaMochila(item) ? viradaDoItem(item, dados) : undefined
    if (virar === null) return item
    const efeito = efeitoComAlcance(escolha.modelo, escolha.forma, dados.sistema)
    if (efeito === undefined) return item
    if (virar === undefined) {
      antes.push({ chave, alcance: undefined, mecanica: undefined })
      return { ...item, efeito }
    }
    const nasFichas = fichasComACategoria(personagens, item.id, virar.para)
    personagens = nasFichas.personagens
    const virada: ViradaDeAntes = virar.pasta === undefined || item.pasta === undefined ? { categoria: item.categoria, copias: nasFichas.copias } : { categoria: item.categoria, pasta: item.pasta, copias: nasFichas.copias }
    antes.push({ chave, alcance: undefined, mecanica: undefined, virada })
    // A categoria e a pasta trocam no lugar delas (a ordem das chaves no disco fica); o efeito vai no fim.
    return { ...item, categoria: virar.para, ...(virar.pasta === undefined ? {} : { pasta: virar.pasta }), efeito }
  })
  const armasDoLivro = dados.catalogo.filter((entrada, indice) => entrada.tipo === 'arma' && feito.catalogo[indice] !== entrada).map((entrada) => entrada.id)
  return { catalogo: feito.catalogo, personagens, acervo, antes, armasDoLivro }
}

/**
 * As vagas das mochilas que são cópia do item (mesmo `itemId`) e que a batalha lê como arma passam
 * à categoria nova, com o que cada uma era. O efeito chega a elas pelo caminho de sempre
 * (`itensNaFonte`, ao gravar o Acervo); a categoria não, por isso vem aqui.
 */
function fichasComACategoria(personagens: readonly Personagem[], itemId: string, para: string): { personagens: Personagem[]; copias: CategoriaDaVagaDeAntes[] } {
  const copias: CategoriaDaVagaDeAntes[] = []
  const novas = personagens.map((personagem) => {
    const { mochila } = personagem
    if (mochila === undefined) return personagem
    const nova = mochila.map((vaga) => {
      if (vaga.itemId !== itemId || vaga.categoria === undefined || !ehArmaDaMochila(vaga)) return vaga
      copias.push({ personagemId: personagem.id, vagaId: vaga.id, categoria: vaga.categoria })
      return { ...vaga, categoria: para }
    })
    return nova.every((vaga, indice) => vaga === mochila[indice]) ? personagem : { ...personagem, mochila: nova }
  })
  return { personagens: novas, copias }
}

/** As vagas listadas com a categoria de antes (a vaga sumida não volta; a que já está igual fica a mesma). */
function fichasComACategoriaDeAntes(personagens: readonly Personagem[], copias: readonly CategoriaDaVagaDeAntes[]): Personagem[] {
  if (copias.length === 0) return [...personagens]
  return personagens.map((personagem) => {
    const { mochila } = personagem
    if (mochila === undefined) return personagem
    const daFicha = new Map(copias.filter((copia) => copia.personagemId === personagem.id).map((copia) => [copia.vagaId, copia.categoria]))
    const nova = mochila.map((vaga) => {
      const era = daFicha.get(vaga.id)
      return era === undefined || vaga.categoria === era ? vaga : { ...vaga, categoria: era }
    })
    return nova.every((vaga, indice) => vaga === mochila[indice]) ? personagem : { ...personagem, mochila: nova }
  })
}

/** O item com o "O que ele faz" de antes: ausente tira o campo; presente volta no lugar dele. */
function itemComOEfeitoDeAntes(item: ItemDoAcervo, efeito: EfeitoDoItem | undefined): ItemDoAcervo {
  if (efeito !== undefined) return { ...item, efeito }
  const { efeito: _depois, ...semEfeito } = item
  return semEfeito
}

/** DESFAZER: o `alcance` e a `mecanica` de antes, só nos que o Confirmar mudou. Puro. */
export function semOsAlcances(dados: DadosDosAntigos, antes: readonly AntesDoAlcance[]): AlcancesGravados {
  const porChave = new Map(antes.map((era) => [era.chave, era]))
  const desfeitos: AntesDoAlcance[] = []
  const feito = emTodos(dados, (chave, x) => {
    const era = porChave.get(chave)
    if (era === undefined) return null
    desfeitos.push(antesDe(chave, x))
    return comOQueEra(x, era)
  })
  let { personagens } = feito
  const acervo = dados.acervo.map((item) => {
    const era = porChave.get(chaveDoAcervo(item.id))
    if (era === undefined) return item
    desfeitos.push({ chave: era.chave, alcance: undefined, mecanica: undefined, ...(item.efeito === undefined ? {} : { efeito: item.efeito }) })
    const semEfeito = itemComOEfeitoDeAntes(item, era.efeito)
    if (era.virada === undefined) return semEfeito
    personagens = fichasComACategoriaDeAntes(personagens, era.virada.copias)
    // No lugar delas: o disco volta a sair na mesma ordem de chaves de antes.
    return { ...semEfeito, categoria: era.virada.categoria, ...(era.virada.pasta === undefined ? {} : { pasta: era.virada.pasta }) }
  })
  const armasDoLivro = dados.catalogo.filter((entrada, indice) => entrada.tipo === 'arma' && feito.catalogo[indice] !== entrada).map((entrada) => entrada.id)
  return { catalogo: feito.catalogo, personagens, acervo, antes: desfeitos, armasDoLivro }
}

// ─── O arquivo da proposta ──────────────────────────────────────────────────

export type CertezaDaProposta = 'alta' | 'baixa'

export interface PropostaDeAlcance {
  chave: string
  nome: string
  forma: FormaDoAlcance
  certeza: CertezaDaProposta
  /** O pedaço do texto que justifica a forma. */
  trecho: string
  /** Só no item do Acervo: o modelo do "O que ele faz" (a forma é o alcance dele). */
  modelo?: IdDoModeloDeItem
}

/** O que o arquivo diz: as propostas pela chave, e os itens que o Claude leu e nenhum modelo serve. */
export interface PropostasDoArquivo {
  propostas: ReadonlyMap<string, PropostaDeAlcance>
  /** As chaves `acervo:` com `"modelo": null`: o item fica fora da lista (fruta, peça de puzzle, munição). */
  semModelo: ReadonlySet<string>
}

/** O id de um dos 25 modelos de item; outro valor = `undefined`. */
function modeloLido(valor: unknown): IdDoModeloDeItem | undefined {
  return MODELOS_DE_ITEM.find((modelo) => modelo.id === valor)?.id
}

function ehRegistro(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function propostaLida(valor: unknown): PropostaDeAlcance | null {
  if (!ehRegistro(valor) || typeof valor.chave !== 'string' || typeof valor.nome !== 'string') return null
  const forma = formaDoAlcanceGuardada(valor.forma)
  if (forma === null) return null
  const certeza: CertezaDaProposta = valor.certeza === 'alta' ? 'alta' : 'baixa'
  const trecho = typeof valor.trecho === 'string' ? valor.trecho.slice(0, TRECHO_MAX) : ''
  const modelo = modeloLido(valor.modelo)
  return modelo === undefined ? { chave: valor.chave, nome: valor.nome, forma, certeza, trecho } : { chave: valor.chave, nome: valor.nome, forma, certeza, trecho, modelo }
}

/**
 * A proposta lida do arquivo (`{ formato: 1, propostas: [...] }`), pela chave. Tolerante: a linha
 * torta (forma que este app não lê, chave sem texto) é ignorada, e o antigo dela fica sem proposta.
 * A linha do item leva `modelo` e `forma`; `"modelo": null` = nenhum modelo serve.
 */
export function propostasDoArquivo(valor: unknown): PropostasDoArquivo {
  const propostas = new Map<string, PropostaDeAlcance>()
  const semModelo = new Set<string>()
  if (!ehRegistro(valor) || !Array.isArray(valor.propostas)) return { propostas, semModelo }
  for (const bruta of valor.propostas) {
    if (ehRegistro(bruta) && bruta.modelo === null && typeof bruta.chave === 'string' && bruta.chave.startsWith(chaveDoAcervo(''))) {
      semModelo.add(bruta.chave)
      continue
    }
    const lida = propostaLida(bruta)
    if (lida !== null && !propostas.has(lida.chave)) propostas.set(lida.chave, lida)
  }
  return { propostas, semModelo }
}
