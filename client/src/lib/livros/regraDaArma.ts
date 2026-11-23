import { ABA_DAS_ARMAS } from '../batalha/leituraDaFicha'
import { descreverAlcance } from '../batalha/alcance/forma'
import { formaDoAlcanceGuardada } from '../batalha/alcanceDoCartao'
import { alcanceDoArquivo, cartoesDaAba, mecanicaDoArquivo, novoCartao, type AlcanceGuardado, type CartaoDaFicha, type MecanicaGuardada, type Personagem } from '../personagem'
import { abaDoSistema, type AbaDoSistema, type SistemaDeRpg } from '../sistemaDeRpg'
import { chaveDoNomeDaEntrada, podeReceber, type BalaDoCatalogo, type ItemDoCatalogo } from './catalogo'

/**
 * A ARMA NUMA FONTE SÓ (docs/design/habilidades/ARMAS-FONTE-UNICA.md §2 a §4):
 * a entrada de arma do catálogo do livro é a fonte de TUDO o que a arma faz —
 * os campos da aba Armas (a Descrição é o `texto` da entrada), as balas e a
 * `mecanica` (e o `alcance` da arma não montada, fase B do alcance, que anda
 * junto com ela). O cartão da ficha ligado a ela (`itemId` = `acervoId`) é
 * CÓPIA: só a fonte escreve nele (`comARegraDaArma`).
 *
 * O que é da ficha e nunca é sobrescrito: o `id` do cartão (os usos da batalha
 * são por ele), `armaPadrao`, `municaoPeloNome`, `oculta`/`revelaAoUsar`,
 * `mecanicaProposta`, a imagem, o nome, e nas balas o `id` e a ligação de cada
 * subcartão (casado pelo nome).
 *
 * Aqui também o "Juntar as armas" (§4): parear cartões e entradas, classificar
 * cada par (iguais, livro vai à ficha, ficha vai ao livro, conflito) e aplicar
 * só o que é certo ou o que o mestre escolheu. Conflito nunca é decidido aqui.
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
  return { campos, ...(balas === undefined ? {} : { balas }), ...mecanicaDoArquivo(entrada.mecanica), ...alcanceDoArquivo(entrada.alcance) }
}

/** A regra que o cartão da ficha diz (as balas são os subcartões). */
export function regraDoCartao(cartao: CartaoDaFicha, sistema: SistemaDeRpg): RegraDaArma {
  const molde = moldeDasBalas(sistema)
  const campos = camposDoMolde(abaDasArmas(sistema), (id) => cartao.campos[id])
  const balas = molde === undefined ? undefined : cartao.subcartoes.map((sub) => ({ nome: sub.nome.trim(), campos: camposDoMolde(molde, (id) => sub.campos[id]) }))
  return { campos, ...(balas === undefined ? {} : { balas }), ...mecanicaDoArquivo(cartao.mecanica), ...alcanceDoArquivo(cartao.alcance) }
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
    ...(entrada.acervoId === undefined ? {} : { itemId: entrada.acervoId }),
  }
  // A fonte sem mecânica (ou sem alcance) tira a da cópia: só a fonte escreve nela. As outras chaves ficam onde estavam.
  const { mecanica: _semFonte, ...semMecanica } = comTudo
  const comMecanica = regra.mecanica === undefined ? semMecanica : comTudo
  const { alcance: _semAlcance, ...semAlcance } = comMecanica
  const novo = regra.alcance === undefined ? semAlcance : comMecanica
  return jsonEstavel(novo) === jsonEstavel(cartao) ? cartao : novo
}

/** A entrada com o que o cartão diz (o mestre escolheu a versão da ficha, ou o caso 3). A ligação e o id da entrada ficam. */
export function entradaComARegraDoCartao(entrada: ItemDoCatalogo, cartao: CartaoDaFicha, sistema: SistemaDeRpg): ItemDoCatalogo {
  const regra = regraDoCartao(cartao, sistema)
  const { [CAMPO_DA_DESCRICAO]: descricao, ...campos } = regra.campos
  const { mecanica: _antes, alcance: _alcanceAntes, balas: _balas, ...base } = entrada
  return { ...base, texto: descricao ?? '', campos, ...(regra.balas === undefined || regra.balas.length === 0 ? {} : { balas: regra.balas }), ...(regra.mecanica === undefined ? {} : { mecanica: regra.mecanica }), ...(regra.alcance === undefined ? {} : { alcance: regra.alcance }) }
}

/** O que o cartão diz da arma, sem a mecânica nem o alcance (o "O que ela faz" vem de quem edita). */
function regraDoCartaoSemMecanica(cartao: CartaoDaFicha, sistema: SistemaDeRpg): RegraDaArma {
  const { mecanica: _daEdicao, alcance: _alcanceDaEdicao, ...regra } = regraDoCartao(cartao, sistema)
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

// ─── O "Juntar as armas" (§4) ───────────────────────────────────────────────

/** Como o cartão achou a entrada: (a) pelo `itemId`, (b) pela vaga da mochila com a coisa da entrada e o mesmo nome, (c) pelo nome (uma entrada só). */
export type ComoPareou = 'itemId' | 'mochila' | 'nome'

export interface CartaoPareado {
  personagemId: string
  personagemNome: string
  cartaoId: string
  cartaoNome: string
  como: ComoPareou
}

/** Uma versão do que a arma faz, para o mestre escolher: a do livro ou a de uma (ou mais) fichas iguais entre si. */
export interface VersaoDaArma {
  /** `livro`, ou `<personagemId>/<cartaoId>` do primeiro cartão desta versão. */
  id: string
  /** "Livro", "Ficha do Vincent G." */
  rotulo: string
  /** Os campos e a mecânica em frase curta. */
  resumo: string
  /** Os cartões que dizem esta versão (vazio na do livro). */
  cartoes: CartaoPareado[]
}

export type CasoDaArma =
  /** Caso 1: cartões e entrada iguais. Liga; entrada sem coisa ganha a coisa. */
  | 'iguais'
  /** Caso 2: entrada montada, cartões sem mecânica e o resto igual. A entrada vai aos cartões. */
  | 'livroVaiAFicha'
  /** Caso 3: um cartão só, montado, e a entrada sem mecânica com o resto igual. O cartão vai à entrada. */
  | 'fichaVaiAoLivro'
  /** Cartões já ligados (pelo `itemId`) que divergiram: a fonte ganha (app velho ou Lobby mexeram na cópia). */
  | 'fonteGanha'
  /** Casos 4 e 5: duas ou mais versões (texto diferente também conta). Só com a escolha do mestre. */
  | 'conflito'

export interface ArmaNoEnsaio {
  caso: CasoDaArma
  entradaId: string
  nome: string
  cartoes: CartaoPareado[]
  /** A entrada não tem coisa no Acervo: ligar cria (ou acha) uma. */
  precisaDeCoisa: boolean
  /** Só no conflito: a do livro primeiro, depois as das fichas. */
  versoes: VersaoDaArma[]
}

export interface EnsaioDasArmas {
  /** Só as entradas que têm cartões pareados; as já iguais e ligadas não aparecem (nada a fazer). */
  armas: ArmaNoEnsaio[]
  /** Caso 6: duas entradas de arma com o mesmo nome; o cartão desse nome não liga sozinho. */
  nomeRepetido: { nome: string; entradaIds: string[]; cartoes: CartaoPareado[] }[]
  /** Caso 7: a entrada aponta para coisa que o Acervo não tem mais (só com o Acervo informado). */
  coisaApagada: { entradaId: string; nome: string; acervoId: string }[]
  /** Entradas montadas que ainda dizem a frase velha (sai ao confirmar). */
  textoVelho: string[]
  /** Mesmo nome em 2 fichas ou mais, sem entrada: não junta sozinho (podem ser armas diferentes). */
  soNasFichas: { nome: string; cartoes: CartaoPareado[] }[]
}

export type EscolhaDaArma =
  /** A versão que vale (`VersaoDaArma.id`). */
  | { entradaId: string; vale: string }
  /** Os cartões do conflito ficam "Só nesta ficha" (o ligado pelo `itemId` perde a ligação). */
  | { entradaId: string; separar: true }
  /** Caso 7: recria a coisa com o mesmo id. */
  | { entradaId: string; recriarCoisa: true }

export interface EntradaDoJuntar {
  catalogo: readonly ItemDoCatalogo[]
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
  /** As coisas do Acervo (para achar a de mesmo nome e ver a apagada). `undefined` = não confere. */
  acervo?: readonly { id: string; nome: string }[]
}

function armasDoCatalogo(catalogo: readonly ItemDoCatalogo[]): ItemDoCatalogo[] {
  return catalogo.filter((entrada) => entrada.tipo === 'arma')
}

/** Os pares cartão x entrada (a, b, c), o nome repetido e o que só existe nas fichas. */
function parear(catalogo: readonly ItemDoCatalogo[], personagens: readonly Personagem[]): { pares: Map<string, CartaoPareado[]>; nomeRepetido: EnsaioDasArmas['nomeRepetido']; soNasFichas: EnsaioDasArmas['soNasFichas'] } {
  const armas = armasDoCatalogo(catalogo)
  const porNome = new Map<string, ItemDoCatalogo[]>()
  for (const entrada of armas) porNome.set(chaveDoNomeDaEntrada(entrada.nome), [...(porNome.get(chaveDoNomeDaEntrada(entrada.nome)) ?? []), entrada])
  const pares = new Map<string, CartaoPareado[]>()
  const repetidos = new Map<string, CartaoPareado[]>()
  const soltos = new Map<string, CartaoPareado[]>()
  const juntar = (mapa: Map<string, CartaoPareado[]>, chave: string, par: CartaoPareado): void => void mapa.set(chave, [...(mapa.get(chave) ?? []), par])
  for (const personagem of personagens) {
    // A variação herda a ficha do modelo (`sincronizarVariacoes`): quem decide é o modelo.
    if (!podeReceber(personagem)) continue
    for (const cartao of cartoesDaAba(personagem, ABA_DAS_ARMAS)) {
      const par = (como: ComoPareou): CartaoPareado => ({ personagemId: personagem.id, personagemNome: personagem.nome, cartaoId: cartao.id, cartaoNome: cartao.nome, como })
      if (cartao.itemId !== undefined) {
        // (a) Ligado a uma coisa: só a entrada dessa coisa é a regra dele (a de mesmo nome pode ser outra arma).
        const ligada = armas.find((entrada) => entrada.acervoId === cartao.itemId)
        if (ligada !== undefined) juntar(pares, ligada.id, par('itemId'))
        continue
      }
      const chave = chaveDoNomeDaEntrada(cartao.nome)
      const mesmas = porNome.get(chave) ?? []
      // (b) O Vincent: a mochila tem o Boomerang com a coisa da entrada e o cartão tem o nome dela.
      const pelaMochila = mesmas.find((entrada) => entrada.acervoId !== undefined && (personagem.mochila ?? []).some((vaga) => vaga.itemId === entrada.acervoId))
      if (pelaMochila !== undefined) juntar(pares, pelaMochila.id, par('mochila'))
      else if (mesmas.length === 1) juntar(pares, mesmas[0].id, par('nome'))
      else if (mesmas.length > 1) juntar(repetidos, chave, par('nome'))
      else juntar(soltos, chave, par('nome'))
    }
  }
  const nomeRepetido = [...repetidos].map(([chave, cartoes]) => ({ nome: cartoes[0].cartaoNome, entradaIds: (porNome.get(chave) ?? []).map((entrada) => entrada.id), cartoes }))
  const soNasFichas = [...soltos.values()].filter((cartoes) => new Set(cartoes.map((par) => par.personagemId)).size > 1).map((cartoes) => ({ nome: cartoes[0].cartaoNome, cartoes }))
  return { pares, nomeRepetido, soNasFichas }
}

function cartaoDoPar(personagens: readonly Personagem[], par: CartaoPareado): CartaoDaFicha | undefined {
  const personagem = personagens.find((atual) => atual.id === par.personagemId)
  return personagem === undefined ? undefined : cartoesDaAba(personagem, ABA_DAS_ARMAS).find((cartao) => cartao.id === par.cartaoId)
}

/** A regra em frase curta, para a lista lado a lado do conflito. */
export function resumoDaRegra(regra: RegraDaArma, sistema: SistemaDeRpg): string {
  const rotulos = new Map((abaDasArmas(sistema)?.campos ?? []).map((campo) => [campo.id, campo.rotulo]))
  const partes = Object.entries(regra.campos).map(([chave, valor]) => `${rotulos.get(chave) ?? chave}: ${valor}`)
  if (regra.balas !== undefined && regra.balas.length > 0) partes.push(`Balas: ${regra.balas.map((bala) => bala.nome).join(', ')}`)
  partes.push(regra.mecanica === undefined ? 'O que ela faz: só o texto' : 'O que ela faz: montada')
  if (regra.alcance !== undefined) {
    const forma = formaDoAlcanceGuardada(regra.alcance)
    partes.push(`Alcance: ${forma === null ? 'que este app não lê' : descreverAlcance(forma)}`)
  }
  return partes.join(' · ')
}

/** Caso de cada entrada com cartões; `null` = já ligada e igual (nada a fazer). */
function casoDaArma(entrada: ItemDoCatalogo, pares: readonly CartaoPareado[], regras: readonly RegraDaArma[], sistema: SistemaDeRpg): CasoDaArma | null {
  const fonte = regraDaEntrada(entrada, sistema)
  const todosIguais = regras.every((regra) => mesmaRegra(fonte, regra))
  const todosLigados = pares.every((par) => par.como === 'itemId')
  if (todosIguais) return todosLigados && entrada.acervoId !== undefined ? null : 'iguais'
  // "O que ela faz" = a mecânica e (fase B do alcance) o alcance: os dois casos certos olham os dois juntos.
  const semMecanica = (regra: RegraDaArma): RegraDaArma => ({ campos: regra.campos, ...(regra.balas === undefined ? {} : { balas: regra.balas }) })
  const faz = (regra: RegraDaArma): boolean => regra.mecanica !== undefined || regra.alcance !== undefined
  const fonteSemMecanica = semMecanica(fonte)
  const restoIgual = regras.every((regra) => mesmaRegra(fonteSemMecanica, semMecanica(regra)))
  if (restoIgual && faz(fonte) && regras.every((regra) => !faz(regra))) return 'livroVaiAFicha'
  if (restoIgual && !faz(fonte) && regras.length === 1 && faz(regras[0])) return 'fichaVaiAoLivro'
  return todosLigados ? 'fonteGanha' : 'conflito'
}

/** As versões do conflito: a do livro e uma por regra diferente entre os cartões. */
function versoesDaArma(entrada: ItemDoCatalogo, pares: readonly CartaoPareado[], regras: readonly RegraDaArma[], sistema: SistemaDeRpg): VersaoDaArma[] {
  const fonte = regraDaEntrada(entrada, sistema)
  const versoes: (VersaoDaArma & { regra: RegraDaArma })[] = [{ id: 'livro', rotulo: 'Livro', resumo: resumoDaRegra(fonte, sistema), cartoes: [], regra: fonte }]
  pares.forEach((par, indice) => {
    const regra = regras[indice]
    const igual = versoes.find((versao) => versao.id !== 'livro' && mesmaRegra(versao.regra, regra))
    if (igual !== undefined) igual.cartoes.push(par)
    else versoes.push({ id: `${par.personagemId}/${par.cartaoId}`, rotulo: `Ficha do ${par.personagemNome}`, resumo: resumoDaRegra(regra, sistema), cartoes: [par], regra })
  })
  return versoes.map(({ regra: _regra, ...versao }) => versao)
}

/** O ENSAIO do "Juntar as armas": a lista do que mudaria, sem mudar nada. */
export function ensaiarArmas({ catalogo, personagens, sistema, acervo }: EntradaDoJuntar): EnsaioDasArmas {
  const { pares, nomeRepetido, soNasFichas } = parear(catalogo, personagens)
  const armas: ArmaNoEnsaio[] = []
  for (const entrada of armasDoCatalogo(catalogo)) {
    const doPar = pares.get(entrada.id) ?? []
    const comCartao = doPar.flatMap((par) => {
      const cartao = cartaoDoPar(personagens, par)
      return cartao === undefined ? [] : [{ par, regra: regraDoCartao(cartao, sistema) }]
    })
    if (comCartao.length === 0) continue
    const regras = comCartao.map((item) => item.regra)
    const cartoes = comCartao.map((item) => item.par)
    const caso = casoDaArma(entrada, cartoes, regras, sistema)
    if (caso === null) continue
    armas.push({ caso, entradaId: entrada.id, nome: entrada.nome, cartoes, precisaDeCoisa: entrada.acervoId === undefined, versoes: caso === 'conflito' ? versoesDaArma(entrada, cartoes, regras, sistema) : [] })
  }
  const idsDoAcervo = acervo === undefined ? null : new Set(acervo.map((coisa) => coisa.id))
  const coisaApagada = armasDoCatalogo(catalogo).flatMap((entrada) =>
    idsDoAcervo === null || entrada.acervoId === undefined || idsDoAcervo.has(entrada.acervoId) ? [] : [{ entradaId: entrada.id, nome: entrada.nome, acervoId: entrada.acervoId }],
  )
  const textoVelho = armasDoCatalogo(catalogo)
    .filter((entrada) => entradaSemTrechoVelho(entrada) !== entrada)
    .map((entrada) => entrada.id)
  return { armas, nomeRepetido, coisaApagada, textoVelho, soNasFichas }
}

export interface ArmasJuntadas {
  catalogo: ItemDoCatalogo[]
  personagens: Personagem[]
  /** As coisas que o Acervo precisa ganhar (categoria Arma), com o id que as entradas já apontam. */
  coisasNovas: { id: string; nome: string }[]
  /** Entradas, cartões e coisas que mudaram; 0 = nada a gravar (a 2ª rodada). */
  mudancas: number
}

export interface OpcoesDoJuntar {
  escolhas?: readonly EscolhaDaArma[]
  /** Pode ligar entrada sem coisa (achar a de mesmo nome ou criar)? O conserto ao abrir não cria nada no Acervo. */
  criarCoisas: boolean
  /** O id da coisa nova (o Acervo usa `item_<uuid>`). */
  novoIdDeCoisa: () => string
}

/** A coisa para a entrada sem ligação: a vaga de mesmo nome na mochila de quem tem o cartão, a coisa de mesmo nome no Acervo, ou uma nova. */
function coisaParaAEntrada(entrada: ItemDoCatalogo, cartoes: readonly CartaoPareado[], dados: EntradaDoJuntar, usadas: Set<string>, novoId: () => string): { id: string; nova: boolean } {
  const chave = chaveDoNomeDaEntrada(entrada.nome)
  const livre = (id: string | undefined): id is string => id !== undefined && !usadas.has(id)
  const daMochila = cartoes
    .flatMap((par) => dados.personagens.find((personagem) => personagem.id === par.personagemId)?.mochila ?? [])
    .find((vaga) => chaveDoNomeDaEntrada(vaga.nome) === chave && livre(vaga.itemId))?.itemId
  const doAcervo = (dados.acervo ?? []).find((coisa) => chaveDoNomeDaEntrada(coisa.nome) === chave && livre(coisa.id))?.id
  const achada = daMochila ?? doAcervo
  return achada === undefined ? { id: novoId(), nova: true } : { id: achada, nova: false }
}

/** A fonte que vale para esta arma do ensaio; `null` = espera o mestre (conflito sem escolha, ou "Separar"). */
function fonteEscolhida(arma: ArmaNoEnsaio, entrada: ItemDoCatalogo, dados: EntradaDoJuntar, escolha: EscolhaDaArma | undefined): ItemDoCatalogo | null {
  if (arma.caso === 'fichaVaiAoLivro') {
    const cartao = cartaoDoPar(dados.personagens, arma.cartoes[0])
    return cartao === undefined ? null : { ...entrada, mecanica: mecanicaDoArquivo(cartao.mecanica).mecanica, alcance: alcanceDoArquivo(cartao.alcance).alcance }
  }
  if (arma.caso !== 'conflito') return entrada
  if (escolha === undefined || !('vale' in escolha)) return null
  if (escolha.vale === 'livro') return entrada
  const versao = arma.versoes.find((atual) => atual.id === escolha.vale)
  const cartao = versao === undefined || versao.cartoes.length === 0 ? undefined : cartaoDoPar(dados.personagens, versao.cartoes[0])
  return cartao === undefined ? null : entradaComARegraDoCartao(entrada, cartao, dados.sistema)
}

/** Troca os cartões dos pares na lista de fichas (a ficha sem mudança fica a MESMA). */
function comOsCartoes(personagens: readonly Personagem[], pares: readonly CartaoPareado[], trocar: (cartao: CartaoDaFicha) => CartaoDaFicha): Personagem[] {
  return personagens.map((personagem) => {
    const ids = new Set(pares.filter((par) => par.personagemId === personagem.id).map((par) => par.cartaoId))
    const armas = cartoesDaAba(personagem, ABA_DAS_ARMAS)
    if (ids.size === 0 || armas.length === 0) return personagem
    const novas = armas.map((cartao) => (ids.has(cartao.id) ? trocar(cartao) : cartao))
    return novas.every((cartao, indice) => cartao === armas[indice]) ? personagem : { ...personagem, abas: { ...personagem.abas, [ABA_DAS_ARMAS]: novas } }
  })
}

const contarMudancas = (antes: readonly unknown[], depois: readonly unknown[]): number => depois.filter((item, indice) => item !== antes[indice]).length

/**
 * APLICA o ensaio: o certo (casos 1 a 3, a fonte que ganha) e o que o mestre
 * escolheu. Conflito sem escolha fica como está. A frase velha sai da fonte.
 * Roda de novo sobre o resultado = 0 mudanças.
 */
export function juntarAsArmas(dados: EntradaDoJuntar, ensaio: EnsaioDasArmas, opcoes: OpcoesDoJuntar): ArmasJuntadas {
  const escolhaDe = (entradaId: string): EscolhaDaArma | undefined => (opcoes.escolhas ?? []).find((escolha) => escolha.entradaId === entradaId)
  const usadas = new Set(dados.catalogo.flatMap((entrada) => (entrada.acervoId === undefined ? [] : [entrada.acervoId])))
  const coisasNovas: { id: string; nome: string }[] = []
  let personagens: Personagem[] = [...dados.personagens]
  const catalogo = dados.catalogo.map((original) => {
    let entrada = entradaSemTrechoVelho(original)
    const escolha = escolhaDe(original.id)
    const apagada = ensaio.coisaApagada.find((item) => item.entradaId === original.id)
    if (apagada !== undefined && escolha !== undefined && 'recriarCoisa' in escolha) coisasNovas.push({ id: apagada.acervoId, nome: original.nome })
    const arma = ensaio.armas.find((item) => item.entradaId === original.id)
    if (arma === undefined) return entrada
    if (arma.caso === 'conflito' && escolha !== undefined && 'separar' in escolha) {
      personagens = comOsCartoes(personagens, arma.cartoes.filter((par) => par.como === 'itemId'), ({ itemId: _ligacao, ...solto }) => solto)
      return entrada
    }
    const fonte = fonteEscolhida(arma, entrada, { ...dados, personagens }, escolha)
    if (fonte === null) return entrada
    if (fonte.acervoId === undefined) {
      if (!opcoes.criarCoisas) return entrada
      const coisa = coisaParaAEntrada(fonte, arma.cartoes, { ...dados, personagens }, usadas, opcoes.novoIdDeCoisa)
      usadas.add(coisa.id)
      if (coisa.nova) coisasNovas.push({ id: coisa.id, nome: fonte.nome })
      entrada = entradaSemTrechoVelho({ ...fonte, acervoId: coisa.id })
    } else entrada = entradaSemTrechoVelho(fonte)
    const fonteFinal = entrada
    personagens = comOsCartoes(personagens, arma.cartoes, (cartao) => comARegraDaArma(cartao, fonteFinal, dados.sistema))
    return jsonEstavel(entrada) === jsonEstavel(original) ? original : entrada
  })
  const mudancas = contarMudancas(dados.catalogo, catalogo) + contarMudancas(dados.personagens, personagens) + coisasNovas.length
  return { catalogo, personagens, coisasNovas, mudancas }
}

/**
 * Propagar ao SALVAR a fonte (§2): cada cartão de arma ligado à entrada
 * (`itemId` = `acervoId`) recebe o que ela diz. Entrada sem coisa não tem
 * cópia. Nada a mudar = a MESMA lista.
 */
export function fichasComARegraDaArma(personagens: readonly Personagem[], entrada: ItemDoCatalogo, sistema: SistemaDeRpg): Personagem[] {
  const pares = entrada.tipo !== 'arma' || entrada.acervoId === undefined ? [] : parear([entrada], personagens).pares.get(entrada.id) ?? []
  const ligados = pares.filter((par) => par.como === 'itemId')
  return ligados.length === 0 ? [...personagens] : comOsCartoes(personagens, ligados, (cartao) => comARegraDaArma(cartao, entrada, sistema))
}
