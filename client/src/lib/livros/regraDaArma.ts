import { ABA_DAS_ARMAS } from '../batalha/leituraDaFicha'
import { requisitosGuardados } from '../batalha/requisitos/guardados'
import { alcanceDoArquivo, cartoesDaAba, mecanicaDoArquivo, novoCartao, type AlcanceGuardado, type CartaoDaFicha, type MecanicaGuardada, type Personagem, type RequisitosGuardados } from '../personagem'
import { abaDoSistema, type AbaDoSistema, type SistemaDeRpg } from '../sistemaDeRpg'
import { chaveDoNomeDaEntrada, podeReceber, type BalaDoCatalogo, type ItemDoCatalogo } from './catalogo'

/**
 * A ARMA NUMA FONTE SÓ (docs/design/habilidades/ARMAS-FONTE-UNICA.md §2 a §4):
 * a entrada de arma do catálogo do livro é a fonte de TUDO o que a arma faz —
 * os campos da aba Armas (a Descrição é o `texto` da entrada), as balas e a
 * `mecanica` (e o `alcance` da arma não montada, fase B do alcance, que anda
 * junto com ela; e o bloco de `requisitos`, fase B2 dos requisitos, pelo mesmo caminho do alcance).
 * O cartão da ficha ligado a ela (`itemId` = `acervoId`) é
 * CÓPIA: só a fonte escreve nele (`comARegraDaArma`).
 *
 * O que é da ficha e nunca é sobrescrito: o `id` do cartão (os usos da batalha
 * são por ele), `armaPadrao`, `municaoPeloNome`, `oculta`/`revelaAoUsar`,
 * `mecanicaProposta`, a imagem, o nome, e nas balas o `id` e a ligação de cada
 * subcartão (casado pelo nome).
 *
 * O "Juntar as armas" (§4) saiu na limpeza dos itens refeitos (E7): o Atacar lê
 * a arma equipada da mochila, e os cartões já foram para ela na conversão.
 *
 * Puro: sem store, sem disco, sem rede.
 */

const CAMPO_DA_DESCRICAO = 'descricao'

/**
 * Frases que a fonte dizia enquanto o app não executava a arma com usos; com a
 * mecânica montada elas mentem (o Boomerang: "à mão até o app ter efeito de
 * arma com usos"; o `scripts/conserto-fichas-f0.cjs` já queria tirar esta).
 */
const TRECHOS_VELHOS_DA_ARMA: readonly string[] = [' (à mão até o app ter efeito de arma com usos)']

/** O que a arma faz, na forma que se compara e se copia. */
export interface RegraDaArma {
  /** Os campos da aba Armas, aparados, sem os vazios (a Descrição pela chave `descricao`). */
  campos: Record<string, string>
  /** As balas; `undefined` = a fonte não diz (não entra na comparação nem na cópia). */
  balas?: BalaDoCatalogo[]
  mecanica?: MecanicaGuardada
  /** Fase B do alcance: a forma do alcance da arma não montada (a montada a diz na `mecanica`). Anda junto com ela. */
  alcance?: AlcanceGuardado
  /** Fase B2 dos requisitos: o bloco da arma; anda junto com a mecânica e o alcance (cópia travada, só a fonte escreve). */
  requisitos?: RequisitosGuardados
}

function abaDasArmas(sistema: SistemaDeRpg): AbaDoSistema | undefined {
  return abaDoSistema(sistema, ABA_DAS_ARMAS)
}

/** O molde das balas da aba Armas (a aba dos subcartões); `undefined` = o sistema não tem balas. */
function moldeDasBalas(sistema: SistemaDeRpg): AbaDoSistema | undefined {
  const aba = abaDasArmas(sistema)
  return aba?.subcartoes === undefined ? undefined : abaDoSistema(sistema, aba.subcartoes.aba)
}

function semTrechoVelho(valor: string): string {
  return TRECHOS_VELHOS_DA_ARMA.reduce((texto, trecho) => texto.split(trecho).join(''), valor)
}

/** Só os campos que o molde tem, aparados e sem o trecho velho; vazio sai. `valor` diz de onde vem cada um. */
function camposDoMolde(molde: AbaDoSistema | undefined, valor: (campoId: string) => string | undefined): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const campo of molde?.campos ?? []) {
    const limpo = semTrechoVelho(valor(campo.id) ?? '').trim()
    if (limpo.length > 0) campos[campo.id] = limpo
  }
  return campos
}

/** A regra que a entrada do catálogo diz. */
export function regraDaEntrada(entrada: ItemDoCatalogo, sistema: SistemaDeRpg): RegraDaArma {
  const molde = moldeDasBalas(sistema)
  const campos = camposDoMolde(abaDasArmas(sistema), (id) => (id === CAMPO_DA_DESCRICAO ? entrada.texto : entrada.campos[id]))
  const balas = molde === undefined || entrada.balas === undefined ? undefined : entrada.balas.map((bala) => ({ nome: bala.nome.trim(), campos: camposDoMolde(molde, (id) => bala.campos[id]) }))
  return { campos, ...(balas === undefined ? {} : { balas }), ...mecanicaDoArquivo(entrada.mecanica), ...alcanceDoArquivo(entrada.alcance), ...requisitosDaRegra(entrada.requisitos) }
}

/** A regra que o cartão da ficha diz (as balas são os subcartões). */
export function regraDoCartao(cartao: CartaoDaFicha, sistema: SistemaDeRpg): RegraDaArma {
  const molde = moldeDasBalas(sistema)
  const campos = camposDoMolde(abaDasArmas(sistema), (id) => cartao.campos[id])
  const balas = molde === undefined ? undefined : cartao.subcartoes.map((sub) => ({ nome: sub.nome.trim(), campos: camposDoMolde(molde, (id) => sub.campos[id]) }))
  return { campos, ...(balas === undefined ? {} : { balas }), ...mecanicaDoArquivo(cartao.mecanica), ...alcanceDoArquivo(cartao.alcance), ...requisitosDaRegra(cartao.requisitos) }
}

/** Fase B2 dos requisitos: o bloco pelo leitor do cartão (cópia; o que não vale sai). */
function requisitosDaRegra(valor: unknown): Pick<RegraDaArma, 'requisitos'> {
  const requisitos = requisitosGuardados(valor)
  return requisitos === undefined ? {} : { requisitos }
}

/** JSON com as chaves em ordem: a mesma regra dá o mesmo texto, venha de onde vier. */
function jsonEstavel(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonEstavel).join(',')}]`
  if (valor !== null && typeof valor === 'object') {
    const pares = Object.entries(valor)
      .filter(([, dentro]) => dentro !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${pares.map(([chave, dentro]) => `${JSON.stringify(chave)}:${jsonEstavel(dentro)}`).join(',')}}`
  }
  return JSON.stringify(valor) ?? 'null'
}

/** A cópia diz o mesmo que a fonte? As balas só contam quando a fonte as diz. */
export function mesmaRegra(fonte: RegraDaArma, copia: RegraDaArma): boolean {
  if (jsonEstavel(fonte.campos) !== jsonEstavel(copia.campos) || jsonEstavel(fonte.mecanica) !== jsonEstavel(copia.mecanica) || jsonEstavel(fonte.alcance) !== jsonEstavel(copia.alcance)) return false
  if (jsonEstavel(fonte.requisitos) !== jsonEstavel(copia.requisitos)) return false
  return fonte.balas === undefined || jsonEstavel(fonte.balas) === jsonEstavel(copia.balas ?? [])
}

/** Os campos do cartão com os da regra: os de fora do molde ficam, na ordem de antes; os da regra trocam ou entram. */
function camposComARegra(atuais: Readonly<Record<string, string>>, daRegra: Readonly<Record<string, string>>, molde: AbaDoSistema | undefined): Record<string, string> {
  const doMolde = new Set((molde?.campos ?? []).map((campo) => campo.id))
  const campos: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(atuais)) {
    if (!doMolde.has(chave)) campos[chave] = valor
    else if (daRegra[chave] !== undefined) campos[chave] = daRegra[chave]
  }
  for (const [chave, valor] of Object.entries(daRegra)) if (!(chave in campos)) campos[chave] = valor
  return campos
}

/** As balas da regra nos subcartões: o subcartão de mesmo nome fica (id, ligação, imagem) e só troca os campos; o que a regra não tem sai. */
function balasComARegra(atuais: readonly CartaoDaFicha[], balas: readonly BalaDoCatalogo[], molde: AbaDoSistema | undefined): CartaoDaFicha[] {
  const usados = new Set<CartaoDaFicha>()
  return balas.map((bala) => {
    const chave = chaveDoNomeDaEntrada(bala.nome)
    const atual = atuais.find((sub) => !usados.has(sub) && chaveDoNomeDaEntrada(sub.nome) === chave)
    if (atual === undefined) return { ...novoCartao(bala.nome), campos: { ...bala.campos } }
    usados.add(atual)
    return { ...atual, campos: camposComARegra(atual.campos, bala.campos, molde) }
  })
}

/**
 * O cartão com o que a entrada diz (e ligado a ela, se a entrada tem coisa no
 * Acervo). Nunca monta cartão novo: id, nome, imagem e as marcas da ficha
 * ficam. Nada a mudar = o MESMO cartão.
 */
export function comARegraDaArma(cartao: CartaoDaFicha, entrada: ItemDoCatalogo, sistema: SistemaDeRpg): CartaoDaFicha {
  const regra = regraDaEntrada(entrada, sistema)
  // Espalhar o cartão primeiro mantém cada chave onde estava: a cópia igual sai igual, byte a byte.
  const comTudo: CartaoDaFicha = {
    ...cartao,
    campos: camposComARegra(cartao.campos, regra.campos, abaDasArmas(sistema)),
    subcartoes: regra.balas === undefined ? cartao.subcartoes : balasComARegra(cartao.subcartoes, regra.balas, moldeDasBalas(sistema)),
    ...(regra.mecanica === undefined ? {} : { mecanica: regra.mecanica }),
    ...(regra.alcance === undefined ? {} : { alcance: regra.alcance }),
    ...(regra.requisitos === undefined ? {} : { requisitos: regra.requisitos }),
    ...(entrada.acervoId === undefined ? {} : { itemId: entrada.acervoId }),
  }
  // A fonte sem mecânica (ou sem alcance, ou sem requisitos) tira a da cópia: só a fonte escreve nela. As outras chaves ficam onde estavam.
  const { mecanica: _semFonte, ...semMecanica } = comTudo
  const comMecanica = regra.mecanica === undefined ? semMecanica : comTudo
  const { alcance: _semAlcance, ...semAlcance } = comMecanica
  const comAlcance = regra.alcance === undefined ? semAlcance : comMecanica
  const { requisitos: _semRequisitos, ...semRequisitos } = comAlcance
  const novo = regra.requisitos === undefined ? semRequisitos : comAlcance
  return jsonEstavel(novo) === jsonEstavel(cartao) ? cartao : novo
}

/** A entrada com o que o cartão diz (o mestre escolheu a versão da ficha, ou o caso 3). A ligação e o id da entrada ficam. */
export function entradaComARegraDoCartao(entrada: ItemDoCatalogo, cartao: CartaoDaFicha, sistema: SistemaDeRpg): ItemDoCatalogo {
  const regra = regraDoCartao(cartao, sistema)
  const { [CAMPO_DA_DESCRICAO]: descricao, ...campos } = regra.campos
  const { mecanica: _antes, alcance: _alcanceAntes, requisitos: _requisitosAntes, balas: _balas, ...base } = entrada
  return {
    ...base,
    texto: descricao ?? '',
    campos,
    ...(regra.balas === undefined || regra.balas.length === 0 ? {} : { balas: regra.balas }),
    ...(regra.mecanica === undefined ? {} : { mecanica: regra.mecanica }),
    ...(regra.alcance === undefined ? {} : { alcance: regra.alcance }),
    ...(regra.requisitos === undefined ? {} : { requisitos: regra.requisitos }),
  }
}

/** O que o cartão diz da arma, sem a mecânica, o alcance nem os requisitos (o "O que ela faz" vem de quem edita). */
function regraDoCartaoSemMecanica(cartao: CartaoDaFicha, sistema: SistemaDeRpg): RegraDaArma {
  const { mecanica: _daEdicao, alcance: _alcanceDaEdicao, requisitos: _requisitosDaEdicao, ...regra } = regraDoCartao(cartao, sistema)
  return regra
}

/**
 * A ENTRADA QUE NASCE para a coisa do Acervo sem regra neste livro (a entrada
 * foi apagada, ou nunca houve): os campos, a Descrição e as balas vêm do
 * cartão ligado das fichas. Sem isso a entrada nasce vazia e a cópia, que só
 * guarda o que a fonte diz, perde dano, descrição e categoria calada.
 * Cartões ligados que dizem coisas diferentes = 'conflito' (quem escolhe é o
 * "Juntar as armas"). Nenhum cartão ligado = a `nova` como veio. Puro.
 */
export function entradaNovaDaCoisa(nova: ItemDoCatalogo, personagens: readonly Personagem[] | null, sistema: SistemaDeRpg): ItemDoCatalogo | 'conflito' {
  const ligados = nova.acervoId === undefined ? [] : (personagens ?? []).flatMap((personagem) => cartoesDaAba(personagem, ABA_DAS_ARMAS)).filter((cartao) => cartao.itemId === nova.acervoId)
  if (ligados.length === 0) return nova
  const primeiro = ligados[0]
  const doPrimeiro = regraDoCartaoSemMecanica(primeiro, sistema)
  if (ligados.some((cartao) => !mesmaRegra(doPrimeiro, regraDoCartaoSemMecanica(cartao, sistema)))) return 'conflito'
  return entradaComARegraDoCartao(nova, primeiro, sistema)
}

/** A entrada sem a frase velha (só a arma montada: sem mecânica, a frase ainda é verdade). Nada a tirar = a MESMA entrada. */
export function entradaSemTrechoVelho(entrada: ItemDoCatalogo): ItemDoCatalogo {
  if (entrada.tipo !== 'arma' || entrada.mecanica === undefined) return entrada
  const campos = Object.fromEntries(Object.entries(entrada.campos).map(([chave, valor]) => [chave, semTrechoVelho(valor).trim()]))
  const texto = semTrechoVelho(entrada.texto).trim()
  const nova = { ...entrada, texto, campos }
  return JSON.stringify(nova) === JSON.stringify(entrada) ? entrada : nova
}

/**
 * Propagar ao SALVAR a fonte (§2): cada cartão de arma ligado à entrada
 * (`itemId` = `acervoId`) recebe o que ela diz. Entrada sem coisa não tem
 * cópia. Nada a mudar = a MESMA lista.
 */
export function fichasComARegraDaArma(personagens: readonly Personagem[], entrada: ItemDoCatalogo, sistema: SistemaDeRpg): Personagem[] {
  const acervoId = entrada.tipo === 'arma' ? entrada.acervoId : undefined
  if (acervoId === undefined) return [...personagens]
  return personagens.map((personagem) => {
    // A variação herda a ficha do modelo (`sincronizarVariacoes`): quem recebe é o modelo.
    if (!podeReceber(personagem)) return personagem
    const armas = cartoesDaAba(personagem, ABA_DAS_ARMAS)
    const novas = armas.map((cartao) => (cartao.itemId === acervoId ? comARegraDaArma(cartao, entrada, sistema) : cartao))
    return novas.every((cartao, indice) => cartao === armas[indice]) ? personagem : { ...personagem, abas: { ...personagem.abas, [ABA_DAS_ARMAS]: novas } }
  })
}
