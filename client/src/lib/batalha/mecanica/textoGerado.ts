import { NOME_DO_TEXTO_DE_ANTES, type CampoExtra, type CartaoDaFicha, type MecanicaGuardada, type Modificador } from '../../personagem'
import { abaDoSistema, type SistemaDeRpg } from '../../sistemaDeRpg'
import { quemUsaDeTreino } from '../ensaio/ensaioDoItem'
import { CAMPO_DO_DANO } from '../formula'
import { ABA_DAS_ARMAS, ABA_DAS_TECNICAS, CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_EFEITO, CAMPO_DO_TEMPO } from '../leituraDaFicha'
import { CAMPO_DO_TIPO, rotuloDoTipo, tipoDoTexto, type TipoDaHabilidade } from '../tiposDaHabilidade'
import { categoriaDaMecanica, nomeDaAcao, tipoDasPecas } from './categoria'
import { ADJETIVO_DO_TIPO } from './golpe'
import { formulaDoNumero } from './leitura'
import { lerMecanica, type AcaoDaMecanica, type Efeito, type MecanicaV1, type TipoComRegra, type TipoDoGolpe } from './modelo'
import { atributoNoMotor, type PecaTransformacao } from './pecas'
import { ehAjudaNaFrase, fraseDoAlvo, fraseDoCusto, fraseDoEfeito, fraseDoLimite, fraseDoTeste, frasesDaReacao, frasesDoDano, frasesDoGolpe, frasesDasPecas, frasesDosOutrosCustos, quantoCusta, resumoDaMecanica, type FichaDaPrevia } from './resumo'

/**
 * O TEXTO GERADO (fase ED2 do editor novo; EDITOR.md §3.4). Regra do dono: "não posso ter nada
 * que um lugar diz uma coisa e em outro diz outra". Na técnica montada, Ação, Tipo, Efeito, Custo,
 * Tempo e Dano são escritos pelo app a partir das peças, num ponto só (`cartaoComTextoGerado`),
 * no vocabulário que os leitores de texto de hoje entendem (`lerAcao`, `lerCusto`, `lerTempo`,
 * `lerDano`, `lerTipo`): o app de antes, o site do Lobby, o cartão lido e a lista do catálogo leem
 * o mesmo que o motor executa. Na arma, só o Efeito (como já era, ARMAS-FONTE-UNICA).
 *
 * O cartão só de texto nunca é tocado. Os campos só mudam quando a mecânica muda (abrir a ficha
 * não regrava nada; a proposta do dono não conta). O texto escrito à mão antes vai uma vez para o
 * extra "Texto de antes", e "Desmontar" o devolve (§3.5).
 *
 * Puro: sem store, sem rede.
 */

// ─── A frase do papel ──────────────────────────────────────────────────────

/** A parte da mecânica que o pedaço da frase descreve (no editor, a linha que o muda). */
export type ParteDoPapel = 'acao' | 'golpe' | 'alcance' | 'dano' | 'acerto' | 'efeitos' | 'custo' | 'pecas'

/** A tinta do pedaço no papel (as do protótipo aprovado). */
export type CorDoPedaco = 'dano' | 'cura' | 'selo' | 'custo'

export interface PedacoDoPapel {
  texto: string
  /** Ausente = só ligação (": ", ". "), sem parte. */
  linha?: ParteDoPapel
  cor?: CorDoPedaco
}

const COR_DO_EFEITO: Readonly<Record<Efeito['tipo'], CorDoPedaco | null>> = {
  selo: 'selo',
  tirarSelos: 'selo',
  cura: 'cura',
  dreno: 'cura',
  reviver: 'cura',
  aMao: null,
}

function semPonto(frase: string): string {
  return frase.trim().replace(/\.$/, '')
}

function comMinuscula(frase: string): string {
  return frase.charAt(0).toLocaleLowerCase('pt-BR') + frase.slice(1)
}

/** Uma frase do resumo vira pedaço, com a parte e a tinta; frase vazia não entra. */
function pedaco(texto: string, linha: ParteDoPapel, cor: CorDoPedaco | null = null): PedacoDoPapel[] {
  const limpo = semPonto(texto)
  if (limpo === '') return []
  return [cor === null ? { texto: limpo, linha } : { texto: limpo, linha, cor }]
}

/** Os pedaços depois do nome da ação, sem as ligações. */
function pedacosDoCorpo(mecanica: MecanicaV1, ficha: FichaDaPrevia): PedacoDoPapel[] {
  const daVez = mecanica.uso !== 'reacao' && mecanica.uso !== 'passiva'
  const exige = mecanica.alvo.exigeSelo === undefined ? '' : ` Só vale em quem tem ${mecanica.alvo.exigeSelo}.`
  const corpo: PedacoDoPapel[] = []
  if (daVez) {
    const ajuda = ehAjudaNaFrase(mecanica)
    // "Apoio: 1 aliado." (o "Pega" sobra depois do nome); o ataque continua "acerta 1 inimigo".
    const alvo = ajuda ? fraseDoAlvo(mecanica).replace(/^Pega /, '') : fraseDoAlvo(mecanica)
    corpo.push(...pedaco(`${alvo}${exige}`, 'alcance'))
    // Apoio sem dano não diz "Não dá dano": a frase do resumo já some na ajuda.
    corpo.push(...pedaco(frasesDoDano(mecanica, ficha).join(' '), 'dano', mecanica.dano === undefined ? null : 'dano'))
    // A ajuda pega sempre: "Ajuda não se esquiva" só confundia (o bloco Acerto do editor ainda diz).
    if (!ajuda) corpo.push(...pedaco(fraseDoTeste(mecanica, ficha), 'acerto'))
    // ED1: o tipo do golpe (como bate, o que causa), lido da escolha guardada.
    for (const frase of frasesDoGolpe(mecanica, ficha)) corpo.push(...pedaco(frase, 'golpe', 'selo'))
  }
  const reacao = frasesDaReacao(mecanica, ficha)
  reacao.forEach((frase, indice) => corpo.push(...pedaco(frase, 'acerto', indice > 0 && frase.startsWith('Devolve') ? 'dano' : null)))
  const efeitos = mecanica.efeitos.filter((efeito) => daVez || efeito.tipo === 'aMao' || (efeito.tipo === 'selo' && efeito.em === 'atacante'))
  for (const efeito of efeitos) corpo.push(...pedaco(fraseDoEfeito(efeito, mecanica, ficha), 'efeitos', COR_DO_EFEITO[efeito.tipo]))
  // Versão 5 (PLANO.md decisão 2): as peças novas se escrevem sozinhas, na ordem do cartão.
  for (const frase of frasesDasPecas(mecanica, ficha)) corpo.push(...pedaco(frase, 'pecas'))
  const item = mecanica.custoEmItem
  const custo = [fraseDoCusto(mecanica, ficha), ...frasesDosOutrosCustos(mecanica, ficha), item === undefined ? '' : `Cada uso gasta ${item.quantos} ${item.nome} da mochila.`, fraseDoLimite(mecanica) ?? '']
  for (const frase of custo) corpo.push(...pedaco(frase, 'custo', 'custo'))
  // Overload: a trava aparece no fim, mas é a Ação que a muda.
  if (categoriaDaMecanica(mecanica) === 'overload') corpo.push({ texto: 'Gasta a vez inteira', linha: 'acao' })
  return corpo
}

/** Os adjetivos do golpe que vão no nome ("Ataque Completo de fogo"), na ordem: como bate, depois o que causa. */
function adjetivosDoGolpe(mecanica: MecanicaV1): string[] {
  const { golpe } = mecanica
  if (golpe === undefined) return []
  const tipos: TipoComRegra<TipoDoGolpe>[] = [...(golpe.bate === undefined ? [] : [golpe.bate]), ...(golpe.causa ?? [])]
  return tipos.map((escolha) => (escolha.tipo === 'outro' ? `de ${escolha.regra.nome}` : ADJETIVO_DO_TIPO[escolha.tipo]))
}

/** O nome que abre a frase do papel ("Apoio", "Ataque Completo de fogo"). */
function nomeNoPapel(mecanica: MecanicaV1): string {
  const adjetivos = adjetivosDoGolpe(mecanica)
  return adjetivos.length === 0 ? nomeDaAcao(mecanica) : `${nomeDaAcao(mecanica)} ${adjetivos.join(' e ')}`
}

/** A frase do papel em pedaços: "Ataque Completo: acerta 1 inimigo… . Dano: … . Custa 35 SP." */
export function pedacosDoPapel(mecanica: MecanicaV1, ficha: FichaDaPrevia): PedacoDoPapel[] {
  const corpo = pedacosDoCorpo(mecanica, ficha)
  // Com tipo, o nome leva ao Golpe (protótipo): é ele que dá o "de fogo".
  const frase: PedacoDoPapel[] = [{ texto: nomeNoPapel(mecanica), linha: adjetivosDoGolpe(mecanica).length === 0 ? 'acao' : 'golpe' }]
  corpo.forEach((parte, indice) => {
    frase.push({ texto: indice === 0 ? ': ' : '. ' })
    frase.push(indice === 0 ? { ...parte, texto: comMinuscula(parte.texto) } : parte)
  })
  frase.push({ texto: '.' })
  return frase
}

/** A frase do papel numa linha (o campo Efeito da técnica, com a ficha `soNomes`). */
export function fraseDoPapel(mecanica: MecanicaV1, ficha: FichaDaPrevia): string {
  return pedacosDoPapel(mecanica, ficha)
    .map((parte) => parte.texto)
    .join('')
}

// ─── Os campos de texto da técnica ─────────────────────────────────────────

/** Os campos que o app escreve na técnica montada, na ordem da aba Habilidades. */
export const CAMPOS_GERADOS = [CAMPO_DA_ACAO, CAMPO_DO_TIPO, CAMPO_DO_EFEITO, CAMPO_DO_CUSTO, CAMPO_DO_TEMPO, CAMPO_DO_DANO] as const

export type CampoGerado = (typeof CAMPOS_GERADOS)[number]

export type TextoDoCartao = Readonly<Record<CampoGerado, string>>

/** A ação como `lerAcao` lê ("Ação Simples"); "Na hora" não é nenhuma ação dele (= a mira pergunta, como `acaoDasPecas`). */
const ACAO_NO_TEXTO: Readonly<Record<AcaoDaMecanica, string>> = {
  simples: 'Ação Simples',
  bonus: 'Ação Bônus',
  completa: 'Ação Completa',
  livre: 'Ação Livre',
  perguntar: 'Na hora (quem usa escolhe)',
}

/**
 * "Reação" sozinha (só no lugar da reação: `lerAcao` dá livre e só reação; a ação da vez não vale);
 * "Reação/Ação Simples" (também na vez); "Ação Completa | OVERLOAD". A Overload gasta a Completa
 * de todo jeito (`acaoComOverload`), então "Na hora | OVERLOAD" dá a mesma ação que as peças.
 */
function acaoNoTexto(mecanica: MecanicaV1): string {
  // Versão 5 (D6 e D7): a passiva não tem ação; o "Ligar e manter" liga com a ação dele e diz que fica ligado.
  if (mecanica.uso === 'passiva') return 'Passiva'
  if (mecanica.uso === 'manter') return `${ACAO_NO_TEXTO[mecanica.acao]} (liga e mantém)`
  const acao = mecanica.uso === 'reacao' ? 'Reação' : `${mecanica.uso === 'ativaOuReacao' ? 'Reação/' : ''}${ACAO_NO_TEXTO[mecanica.acao]}`
  return mecanica.limite.overload === true ? `${acao} | OVERLOAD` : acao
}

/** O custo que bloqueia, como `custoDasPecas`: o "ao usar" ou, sem ele, o "por vez" ("15 SP (por turno)"); sem os dois, vazio (= nada). */
function custoNoTexto(mecanica: MecanicaV1): string {
  const aoUsar = mecanica.custos.find((custo) => custo.quando === 'aoUsar')
  const custo = aoUsar ?? mecanica.custos.find((custo) => custo.quando === 'porTurno')
  if (custo === undefined) return ''
  return custo.quando === 'porTurno' ? `${quantoCusta(custo)} (por turno)` : quantoCusta(custo)
}

/** O Tempo como `tempoDasPecas`: a recarga ("2", como as fichas escrevem), os usos ("1 vez por batalha"), a Overload; sem nada, vazio (= livre). */
function tempoNoTexto(mecanica: MecanicaV1): string {
  const { recarga, usosPorBatalha, overload } = mecanica.limite
  if (recarga !== undefined) return String(recarga)
  if (usosPorBatalha !== undefined) return `${usosPorBatalha} ${usosPorBatalha === 1 ? 'vez' : 'vezes'} por batalha`
  return overload === true ? 'OVERLOAD' : ''
}

/** "-" sem dano (`lerDano` dá "sem dano"); com dano, a fórmula da peça, a mesma que o motor lê (`formulaDoNumero`). */
function danoNoTexto(mecanica: MecanicaV1): string {
  return mecanica.dano === undefined ? '-' : formulaDoNumero(mecanica.dano.base)
}

/** Os campos de texto que as peças dizem. O Efeito é a frase do papel sem a conta da ficha (a conta mudaria com a ficha). */
export function textoDoCartao(mecanica: MecanicaV1, sistema: SistemaDeRpg): TextoDoCartao {
  return {
    [CAMPO_DA_ACAO]: acaoNoTexto(mecanica),
    [CAMPO_DO_TIPO]: rotuloDoTipo(tipoDasPecas(mecanica)),
    [CAMPO_DO_EFEITO]: fraseDoPapel(mecanica, { personagem: quemUsaDeTreino(sistema), sistema, soNomes: true }),
    [CAMPO_DO_CUSTO]: custoNoTexto(mecanica),
    [CAMPO_DO_TEMPO]: tempoNoTexto(mecanica),
    [CAMPO_DO_DANO]: danoNoTexto(mecanica),
  }
}

/** Os campos gerados que a aba Habilidades deste sistema tem (o que a aba não tem, o app não escreve). */
export function camposGeradosDaAba(sistema: SistemaDeRpg): CampoGerado[] {
  const ids = new Set((abaDoSistema(sistema, ABA_DAS_TECNICAS)?.campos ?? []).map((campo) => campo.id))
  return CAMPOS_GERADOS.filter((id) => ids.has(id))
}

/** Os Tipos que as peças não dizem (Passiva, Evolução, Escolha, Invocação): o escrito fica, senão a técnica deixaria de evoluir ou de invocar. */
const TIPOS_FORA_DAS_PECAS: ReadonlySet<TipoDaHabilidade> = new Set<TipoDaHabilidade>(['passiva', 'evolucao', 'escolha', 'invocacao'])

/** O valor que o app escreve em cada campo gerado da aba, para estes campos de agora. */
function valoresGerados(campos: Readonly<Record<string, string>>, mecanica: MecanicaV1, sistema: SistemaDeRpg, antes?: MecanicaV1): Partial<Record<CampoGerado, string>> {
  const texto = textoDoCartao(mecanica, sistema)
  const tipoEscrito = tipoDoTexto(campos[CAMPO_DO_TIPO] ?? '')
  // Versão 5 (D6): o "Passiva" que as peças de antes escreveram (`uso: 'passiva'`) não fica quando a categoria muda.
  const passivaDasPecas = tipoEscrito === 'passiva' && antes?.uso === 'passiva'
  const ficaOTipo = tipoEscrito !== null && TIPOS_FORA_DAS_PECAS.has(tipoEscrito) && !passivaDasPecas
  const valores: Partial<Record<CampoGerado, string>> = {}
  for (const id of camposGeradosDaAba(sistema)) valores[id] = id === CAMPO_DO_TIPO && ficaOTipo ? (campos[id] ?? '') : texto[id]
  return valores
}

// ─── A arma: só o Efeito (ARMAS-FONTE-UNICA, movido de lib/livros/fraseDaArma.ts) ───

/** O que a arma sem mecânica faz: a mesma frase do editor fechado. */
export const ARMA_SO_COM_O_DANO = 'Sem mecânica, o Atacar usa só o dano da arma.'

/** "O que ela faz" numa frase: a mesma nos 3 lugares (o boneco de treino dá os números, como no Testar). */
export function fraseDoQueElaFaz(mecanica: MecanicaGuardada | undefined, sistema: SistemaDeRpg): string {
  const lida = lerMecanica(mecanica)
  if (lida.tipo === 'nenhuma') return ARMA_SO_COM_O_DANO
  if (lida.tipo !== 'pecas') return 'Montada num app mais novo: atualize o app para ver.'
  return resumoDaMecanica(lida.mecanica, { personagem: quemUsaDeTreino(sistema), sistema }).join(' ')
}

/** A aba Armas deste sistema tem o campo Efeito? Sem ele, não há texto a seguir. */
export function armaTemCampoDeEfeito(sistema: SistemaDeRpg): boolean {
  return abaDoSistema(sistema, ABA_DAS_ARMAS)?.campos.some((campo) => campo.id === CAMPO_DO_EFEITO) === true
}

/**
 * O texto do Efeito da arma depois de a mecânica mudar de `antes` para `depois`. Com mecânica, é a
 * frase nova, sempre: o texto à mão sai. Mecânica tirada: a frase automática sai (ela diria o que
 * não existe mais); o texto à mão de antes da mecânica fica.
 */
export function efeitoQueSegueAMecanica(texto: string, antes: MecanicaGuardada | undefined, depois: MecanicaGuardada | undefined, sistema: SistemaDeRpg): string {
  if (lerMecanica(depois).tipo === 'pecas') return fraseDoQueElaFaz(depois, sistema)
  const atual = texto.trim()
  const eraAFrase = atual === '' || (lerMecanica(antes).tipo === 'pecas' && atual === fraseDoQueElaFaz(antes, sistema))
  return eraAFrase ? '' : texto
}

// ─── O ponto único ─────────────────────────────────────────────────────────

/** De que aba é o cartão: a técnica ganha os 6 campos; a arma, só o Efeito. */
export type CartaoComTexto = 'tecnica' | 'arma'

/**
 * Os campos para gravar com o que a mecânica diz (a entrada do catálogo, que não tem "antes"). Arma:
 * com peças, o Efeito é a frase. Técnica: com peças, os campos gerados. Sem peças, os campos ficam.
 */
export function camposComTextoGerado(campos: Readonly<Record<string, string>>, mecanica: MecanicaGuardada | undefined, sistema: SistemaDeRpg, qual: CartaoComTexto): Record<string, string> {
  const lida = lerMecanica(mecanica)
  if (lida.tipo !== 'pecas') return { ...campos }
  if (qual === 'arma') return armaTemCampoDeEfeito(sistema) ? { ...campos, [CAMPO_DO_EFEITO]: fraseDoQueElaFaz(mecanica, sistema) } : { ...campos }
  return { ...campos, ...valoresGerados(campos, lida.mecanica, sistema) }
}

/** A arma com o Efeito que segue a mecânica nova (o de `cartaoComOEfeitoDaMecanica`, igual). */
function armaComOEfeito(antes: CartaoDaFicha, depois: CartaoDaFicha, sistema: SistemaDeRpg): CartaoDaFicha {
  if (!armaTemCampoDeEfeito(sistema)) return depois
  const atual = depois.campos[CAMPO_DO_EFEITO] ?? ''
  const texto = efeitoQueSegueAMecanica(atual, antes.mecanica, depois.mecanica, sistema)
  return texto === atual ? depois : { ...depois, campos: { ...depois.campos, [CAMPO_DO_EFEITO]: texto } }
}

/**
 * A técnica com os campos que a mecânica nova diz. Torta ou de app mais novo: o texto fica (não há
 * o que dizer). Mecânica tirada: volta o "Texto de antes" (o Desmontar e o Ctrl+Z).
 */
function tecnicaComTexto(antes: CartaoDaFicha, depois: CartaoDaFicha, sistema: SistemaDeRpg): CartaoDaFicha {
  const lida = lerMecanica(depois.mecanica)
  if (lida.tipo === 'nenhuma') return comOTextoDeAntesDeVolta(depois, sistema)
  if (lida.tipo !== 'pecas') return depois
  const lidaAntes = lerMecanica(antes.mecanica)
  const valores = valoresGerados(depois.campos, lida.mecanica, sistema, lidaAntes.tipo === 'pecas' ? lidaAntes.mecanica : undefined)
  const ids = camposGeradosDaAba(sistema)
  const comMods = comOsModsDaForma(depois, lida.mecanica)
  if (ids.every((id) => comMods.campos[id] === valores[id])) return comMods
  const comAntes = comOTextoDeAntes(antes, comMods, ids, valores, sistema)
  return { ...comAntes, campos: { ...comAntes.campos, ...valores } }
}

/**
 * D5: os atributos da peça Transformação ("Muda: Agilidade +20") são os `modificadores` do cartão, que a
 * forma ligada aplica (e que o app de antes, o site e a Arena já leem). Gravados aqui, no ponto único,
 * para a peça e o cartão nunca dizerem números diferentes. Sem a peça, os modificadores ficam como estão.
 */
function comOsModsDaForma(cartao: CartaoDaFicha, mecanica: MecanicaV1): CartaoDaFicha {
  const mods = modificadoresDaPecaDaForma(mecanica)
  if (mods === null) return cartao
  const iguais = mods.length === cartao.modificadores.length && mods.every((mod, indice) => cartao.modificadores[indice]?.atributo === mod.atributo && cartao.modificadores[indice]?.delta === mod.delta)
  return iguais ? cartao : { ...cartao, modificadores: mods }
}

/** Os `modificadores` que a peça Transformação dá ao cartão (a Velocidade é a Agilidade); `null` = a mecânica não tem a peça. */
export function modificadoresDaPecaDaForma(mecanica: MecanicaV1): Modificador[] | null {
  let forma: PecaTransformacao | undefined
  for (const peca of mecanica.pecas ?? []) if (peca.tipo === 'transformacao') forma = peca
  return forma === undefined ? null : forma.mods.map((mod) => ({ atributo: atributoNoMotor(mod.atributo), delta: mod.valor }))
}

/**
 * O PONTO ÚNICO que escreve os campos de texto (EDITOR.md §3.4): roda quando o mestre muda a
 * mecânica (no editor, ao aceitar a proposta do dono). Só a `mecanica` conta: a proposta do dono
 * não mexe nos campos, e o cartão só de texto (sem mecânica antes e depois) volta igual.
 */
export function cartaoComTextoGerado(antes: CartaoDaFicha, depois: CartaoDaFicha, sistema: SistemaDeRpg, qual: CartaoComTexto): CartaoDaFicha {
  if (depois.mecanica === antes.mecanica) return depois
  return qual === 'arma' ? armaComOEfeito(antes, depois, sistema) : tecnicaComTexto(antes, depois, sistema)
}

// ─── Texto de antes, Montar e Desmontar (EDITOR.md §3.5) ────────────────────

/** O extra que guarda, uma vez, o texto que o mestre escreveu antes de o app escrever (mora em `personagem.ts`, que as vistas do cartão leem). */
export { NOME_DO_TEXTO_DE_ANTES }

/** Como cada campo aparece no extra ("Ação: Ação Simples"); os nomes são fixos, para a volta ler sempre igual. */
const ROTULO_NO_TEXTO_DE_ANTES: Readonly<Record<CampoGerado, string>> = {
  [CAMPO_DA_ACAO]: 'Ação',
  [CAMPO_DO_TIPO]: 'Tipo',
  [CAMPO_DO_EFEITO]: 'Efeito',
  [CAMPO_DO_CUSTO]: 'Custo',
  [CAMPO_DO_TEMPO]: 'Tempo',
  [CAMPO_DO_DANO]: 'Dano',
}

/** O cartão de texto que não tinha nenhum dos campos: a volta apaga os que o app escreveu. */
const NENHUM_TEXTO = '(nenhum texto)'

/** Uma linha por campo: a quebra de linha e a barra viram "\n" e "\\" (a volta desfaz, igual ao que era). */
function escaparNaLinha(valor: string): string {
  return valor.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
}

function desescaparDaLinha(valor: string): string {
  return valor.replace(/\\([\\nr])/g, (_trecho, letra: string) => (letra === 'n' ? '\n' : letra === 'r' ? '\r' : '\\'))
}

/** O valor do extra: os campos gerados que o cartão tem, um por linha, na ordem da aba. */
function textoDeAntesEmLinhas(campos: Readonly<Record<string, string>>, ids: readonly CampoGerado[]): string {
  const linhas = ids.flatMap((id) => {
    const valor = campos[id]
    return valor === undefined ? [] : [`${ROTULO_NO_TEXTO_DE_ANTES[id]}: ${escaparNaLinha(valor)}`]
  })
  return linhas.length === 0 ? NENHUM_TEXTO : linhas.join('\n')
}

/** Os campos guardados no extra, pelo id; `null` = o texto não é o que o app escreveu (mexido à mão): a volta não arrisca. */
export function camposDoTextoDeAntes(valor: string): Map<string, string> | null {
  const guardados = new Map<string, string>()
  if (valor === NENHUM_TEXTO) return guardados
  for (const linha of valor.split('\n')) {
    const id = CAMPOS_GERADOS.find((campo) => linha.startsWith(`${ROTULO_NO_TEXTO_DE_ANTES[campo]}:`))
    if (id === undefined || guardados.has(id)) return null
    guardados.set(id, desescaparDaLinha(linha.slice(ROTULO_NO_TEXTO_DE_ANTES[id].length + 1).replace(/^ /, '')))
  }
  return guardados
}

function indiceDoTextoDeAntes(extras: readonly CampoExtra[]): number {
  return extras.findIndex((extra) => extra.nome === NOME_DO_TEXTO_DE_ANTES)
}

/**
 * O "Texto de antes", uma vez só. Ao montar o cartão de texto, sempre (a volta sabe o que havia,
 * até nada). No cartão já montado, na primeira edição, só se o texto dele foi escrito à mão (não é o
 * que o app escreve agora nem o que escreveria pela mecânica de antes).
 */
function comOTextoDeAntes(antes: CartaoDaFicha, depois: CartaoDaFicha, ids: readonly CampoGerado[], valores: Partial<Record<CampoGerado, string>>, sistema: SistemaDeRpg): CartaoDaFicha {
  if (indiceDoTextoDeAntes(depois.extras) >= 0) return depois
  if (antes.mecanica !== undefined) {
    const lidaAntes = lerMecanica(antes.mecanica)
    const deAntes = lidaAntes.tipo === 'pecas' ? valoresGerados(depois.campos, lidaAntes.mecanica, sistema) : {}
    // O Efeito que o app escreveu com as palavras de uma versão anterior (a frase do papel começa igual, "Apoio: ") não é texto à mão.
    const comeco = lidaAntes.tipo === 'pecas' ? `${nomeNoPapel(lidaAntes.mecanica)}: ` : null
    const aMao = ids.some((id) => {
      const atual = depois.campos[id]
      if (atual === undefined || atual === valores[id] || atual === deAntes[id]) return false
      return !(id === CAMPO_DO_EFEITO && comeco !== null && atual.startsWith(comeco))
    })
    if (!aMao) return depois
  }
  return { ...depois, extras: [...depois.extras, { nome: NOME_DO_TEXTO_DE_ANTES, valor: textoDeAntesEmLinhas(depois.campos, ids) }] }
}

/** Os campos do "Texto de antes" de volta, no lugar onde estavam; o extra sai. Sem ele (ou mexido à mão), os campos ficam. */
function comOTextoDeAntesDeVolta(cartao: CartaoDaFicha, sistema: SistemaDeRpg): CartaoDaFicha {
  const indice = indiceDoTextoDeAntes(cartao.extras)
  const extra = cartao.extras[indice]
  const guardados = extra === undefined ? null : camposDoTextoDeAntes(extra.valor)
  if (guardados === null) return cartao
  const ids: ReadonlySet<string> = new Set(camposGeradosDaAba(sistema))
  const campos: Record<string, string> = {}
  for (const [id, valor] of Object.entries(cartao.campos)) {
    const guardado = guardados.get(id)
    if (!ids.has(id)) campos[id] = valor
    else if (guardado !== undefined) campos[id] = guardado
  }
  for (const [id, valor] of guardados) if (ids.has(id) && !(id in campos)) campos[id] = valor
  return { ...cartao, campos, extras: cartao.extras.filter((_extra, i) => i !== indice) }
}

/** Montar (§3.5): o cartão de texto ganha a mecânica; o texto de antes vai para o extra e os campos passam a ser gerados. */
export function montarCartao(cartao: CartaoDaFicha, mecanica: MecanicaGuardada, sistema: SistemaDeRpg): CartaoDaFicha {
  return cartaoComTextoGerado(cartao, { ...cartao, mecanica }, sistema, 'tecnica')
}

/** Desmontar (§3.5, só o mestre): a mecânica sai e os campos do "Texto de antes" voltam. A proposta do dono fica. */
export function desmontarCartao(cartao: CartaoDaFicha, sistema: SistemaDeRpg): CartaoDaFicha {
  const { mecanica: _fora, ...semMecanica } = cartao
  return cartaoComTextoGerado(cartao, semMecanica, sistema, 'tecnica')
}
