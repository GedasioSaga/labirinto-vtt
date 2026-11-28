import type { Personagem } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import type { SaidaDaReacao } from '../combate'
import { pedidoDaMarca, textoDoPedidoDaMarca } from '../comoMarca'
import { PORCENTO_QUE_ANULA, textoDaExcecao, textoDoLimiteDoAnula, type RegraDoAnula } from '../anulaODano'
import { comportamentoDoSelo } from '../condicoes'
import { legadoDaFadiga } from '../../condicoes/legado'
import { cdDaExpressao } from '../disputa'
import { lerDano, normalizar } from '../formula'
import { ADJETIVO_DO_TIPO, ATRIBUTO_DO_ENFRAQUECER, fraseDoEmpurrao, NOME_DO_TIPO } from './golpe'
import { formulaDoNumero } from './leitura'
import { atributoNoMotor, NOME_DA_FADIGA, nomeDoAtributoDaPeca, type CondicaoDaPeca, type EfeitoDoGatilho, type PecaDaMecanica, type PecaDiminui, type PecaTransformacao, type QuandoOGatilhoDispara, type RespostaDaPeca } from './pecas'
import { TESTE_DO_TIPO_DE_PARTIDA, type CdDoTeste, type Custo, type DuracaoDoSelo, type Efeito, type MecanicaV1, type Numero, type NumeroDaCd, type NumeroSimples, type QuemOAlvoPega, type QuemRolaNoTeste, type TipoComRegra, type TipoDoGolpe } from './modelo'

/**
 * O RESUMO EM FRASES da técnica montada (construtor de mecânicas, fatia C2;
 * seção 3 do plano): o que o mestre lê embaixo do editor e o que o jogador vê
 * no cartão, sem jargão ("Custa 30 SP e gasta a Ação Simples. Acerta 1
 * inimigo, que reage normal."). As frases saem das MESMAS peças que o motor
 * executa: nada aqui decide regra, só descreve.
 *
 * Puro: sem store, sem rede.
 */

/** A ficha para a prévia do número ("= 80 com a ficha de hoje"); ausente = só a fórmula. */
export interface FichaDaPrevia {
  personagem: Personagem
  sistema: SistemaDeRpg
  /**
   * Fase ED2: só os nomes do sistema (atributos), sem a prévia do número. É o texto que vai a um
   * campo do cartão (`textoGerado.ts`): a conta de hoje mudaria com a ficha e o campo diria outra
   * coisa que o golpe. Ausente = com a prévia.
   */
  soNomes?: true
}

const RECURSO: Readonly<Record<'sp' | 'hp', string>> = { sp: 'SP', hp: 'HP' }

const ACAO: Readonly<Record<Exclude<MecanicaV1['acao'], 'perguntar'>, string>> = {
  simples: 'a Ação Simples',
  bonus: 'a Ação Bônus',
  completa: 'a Ação Completa',
  livre: 'uma Ação Livre',
}

/** "1,5": o número com a vírgula da ficha. */
export function numeroComVirgula(valor: number): string {
  return String(valor).replace('.', ',')
}

/** Uma palavra da fórmula (letras com acento, depois letras, dígitos e "_"). */
const PALAVRA_DA_FORMULA = /\p{L}[\p{L}\d_]*/gu

/**
 * A fórmula como se lê numa frase: o atributo pelo nome que o sistema usa (com acento, "Espirito" →
 * "Espírito") e "×" no lugar de "*" ("Espirito*3" → "Espírito × 3"). Só a leitura muda: a conta
 * guardada e os campos que o app escreve (`textoGerado.ts`, lidos de volta pelo `lerDano`) ficam
 * como estão.
 */
export function formulaNaFrase(formula: string, ficha?: FichaDaPrevia): string {
  const nomes = new Map<string, string>()
  for (const atributo of ficha?.sistema.atributos ?? []) {
    const nome = atributo.nome.trim()
    if (nome === '') continue
    nomes.set(normalizar(nome), nome)
    nomes.set(normalizar(atributo.id), nome)
  }
  const comNomes = formula.trim().replace(PALAVRA_DA_FORMULA, (palavra) => nomes.get(normalizar(palavra)) ?? palavra)
  return comNomes.replace(/\s*\*\s*/g, ' × ')
}

function numeroSimples(numero: NumeroSimples, ficha?: FichaDaPrevia): string {
  return 'fixo' in numero ? String(numero.fixo) : formulaNaFrase(numero.formula, ficha)
}

/** "100" ou "100 (com Concentração: 150 / 200 / 350)". */
function numeroDaPeca(numero: Numero, ficha?: FichaDaPrevia): string {
  if (!('porCarga' in numero)) return numeroSimples(numero, ficha)
  const [zero, um, dois, tres] = numero.porCarga
  return `${numeroSimples(zero, ficha)} (com Concentração: ${numeroSimples(um, ficha)} / ${numeroSimples(dois, ficha)} / ${numeroSimples(tres, ficha)})`
}

/** "30 SP", "10% do HP máximo", "Força de SP". Fase ED2: é também o campo Custo que o app escreve (`textoGerado.ts`). */
export function quantoCusta(custo: Custo): string {
  const recurso = RECURSO[custo.recurso]
  const { quanto } = custo
  if ('porcento' in quanto) return `${quanto.porcento}% do ${recurso} ${quanto.de === 'maximo' ? 'máximo' : 'atual'}`
  if ('fixo' in quanto) return `${quanto.fixo} ${recurso}`
  return `${quanto.formula.trim() || '?'} de ${recurso}`
}

/** O custo numa frase: o mesmo `quantoCusta`, com a fórmula do jeito que se lê ("Força × 2 de SP"). */
function custoNaFrase(custo: Custo, ficha?: FichaDaPrevia): string {
  const { quanto } = custo
  if (!('formula' in quanto)) return quantoCusta(custo)
  return `${formulaNaFrase(quanto.formula, ficha) || '?'} de ${RECURSO[custo.recurso]}`
}

/** Bloco 1 e 2 juntos: "Custa 30 SP e gasta a Ação Simples." */
export function fraseDoCustoEDaAcao(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string {
  const aoUsar = mecanica.custos.find((custo) => custo.quando === 'aoUsar')
  const custa = aoUsar === undefined ? 'Não custa nada' : `Custa ${custoNaFrase(aoUsar, ficha)}`
  return mecanica.acao === 'perguntar' ? `${custa}, e quem usa escolhe a ação na hora.` : `${custa} e gasta ${ACAO[mecanica.acao]}.`
}

/** Só o bloco 1 (o custo ao usar): "Custa 30 SP." (o de cada vez e o de depois têm frase própria). */
export function fraseDoCusto(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string {
  const aoUsar = mecanica.custos.find((custo) => custo.quando === 'aoUsar')
  return aoUsar === undefined ? 'Não custa nada.' : `Custa ${custoNaFrase(aoUsar, ficha)}.`
}

/** Os custos de fora do "ao usar": o da técnica mantida e o de depois. */
export function frasesDosOutrosCustos(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string[] {
  const frases: string[] = []
  const porTurno = mecanica.custos.find((custo) => custo.quando === 'porTurno')
  if (porTurno !== undefined) frases.push(`Enquanto mantida, custa ${custoNaFrase(porTurno, ficha)} a cada vez (o mestre aplica ou pula).`)
  const depois = mecanica.custos.find((custo) => custo.quando === 'depois')
  if (depois !== undefined) frases.push(`Depois de usar, perde ${custoNaFrase(depois, ficha)}.`)
  return frases
}

/** O alvo no singular e no plural ("inimigo", "inimigos"). */
const QUEM: Readonly<Record<Exclude<QuemOAlvoPega, 'si'>, readonly [string, string]>> = {
  inimigos: ['inimigo', 'inimigos'],
  aliados: ['aliado', 'aliados'],
  todos: ['alvo (aliado ou inimigo)', 'alvos, aliados e inimigos'],
  escolha: ['alvo à escolha', 'alvos à escolha'],
}

/** Bloco 3: "Acerta todos os inimigos num quadrado 3x3 à frente." */
export function fraseDoAlvo(mecanica: MecanicaV1): string {
  const frase = fraseDaForma(mecanica)
  // Fase 6: o alcance (o alvo escolhido ou o centro da área longe). Fase B do alcance: o anel diz "de N a M".
  const { alcance, alcanceMinimo } = mecanica.alvo
  if (alcance === undefined) return frase
  if (alcanceMinimo !== undefined) return `${frase.slice(0, -1)}, de ${alcanceMinimo} a ${alcance} casas, nunca colado.`
  return `${frase.slice(0, -1)}, com alcance de ${alcance} ${alcance === 1 ? 'casa' : 'casas'}.`
}

function fraseDaForma(mecanica: MecanicaV1): string {
  const { quem, forma } = mecanica.alvo
  const ajuda = quem === 'aliados' || quem === 'si'
  const verbo = ajuda ? 'Pega' : 'Acerta'
  if (quem === 'si') return 'Pega em quem usa.'
  const [um, varios] = QUEM[quem]
  switch (forma.tipo) {
    case 'um':
      // Fase 6 (H14): o reviver só pega quem caiu.
      if (mecanica.alvo.estado === 'caido') return `${verbo} 1 ${um} caído (0 de vida).`
      return `${verbo} 1 ${um}.`
    case 'varios':
      return `${verbo} até ${forma.max} ${varios}${forma.dividirDano === true ? ', e o dano se divide entre eles' : ''}.`
    case 'linha':
      return `${verbo} todos os ${varios} numa linha reta de ${forma.casas} ${forma.casas === 1 ? 'casa' : 'casas'}.`
    case 'quadrado':
      return `${verbo} todos os ${varios} num quadrado ${forma.lado}x${forma.lado} ${forma.centro === 'frente' ? 'à frente' : forma.centro === 'ponto' ? 'em volta de um ponto escolhido' : 'em volta de quem usa'}.`
    case 'raio':
      return `${verbo} todos os ${varios} a até ${forma.casas} ${forma.casas === 1 ? 'casa' : 'casas'} ${forma.centro === 'ponto' ? 'de um ponto escolhido (a casa dele entra)' : forma.centro === 'alvo' ? 'de uma ficha escolhida (ela entra)' : 'de quem usa'}.`
    // Fase B do alcance: as frases do protótipo ("Cruz de 3 casas", "Leque de 3 casas à frente").
    case 'cruz':
      return `${verbo} todos os ${varios} numa cruz de ${forma.casas} ${forma.casas === 1 ? 'casa' : 'casas'} em volta de quem usa.`
    case 'leque':
      return `${verbo} todos os ${varios} num leque de ${forma.casas} ${forma.casas === 1 ? 'casa' : 'casas'} à frente.`
  }
}

/** O nome do atributo no sistema da ficha ("Resistência"); sem a ficha, o id guardado. */
export function nomeDoAtributo(atributoId: string, ficha?: FichaDaPrevia): string {
  const achado = ficha?.sistema.atributos.find((atributo) => atributo.id === atributoId)
  return achado === undefined || achado.nome.trim() === '' ? atributoId : achado.nome.trim()
}

/** "Resistência com desvantagem". */
function quemRolaNaFrase(quem: QuemRolaNoTeste, ficha?: FichaDaPrevia): string {
  const vantagem = quem.vantagem === undefined ? '' : ` com ${quem.vantagem}`
  return `${nomeDoAtributo(quem.atributo, ficha)}${vantagem}`
}

/** A prévia da CD por fórmula: "= 14 com a ficha de hoje"; `null` = sem ficha. */
export function previaDaCd(formula: string, ficha?: FichaDaPrevia): string | null {
  if (ficha === undefined || ficha.soNomes === true || formula.trim() === '') return null
  const valor = cdDaExpressao(formula, { personagem: ficha.personagem }, ficha.sistema)
  return valor === null ? 'a fórmula não fecha com esta ficha' : `= ${valor} com a ficha de hoje`
}

function numeroDaCdNaFrase(numero: NumeroDaCd, ficha?: FichaDaPrevia): string {
  return numero === 'automatico' ? 'pega sem teste' : numeroSimples(numero, ficha) || '?'
}

/** "CD 12", "CD 12 + mod(Carisma) (= 14 com a ficha de hoje)", "CD 11 (com Concentração: 14 / 17 / pega sem teste)". */
export function textoDaCd(cd: CdDoTeste, ficha?: FichaDaPrevia): string {
  if ('porCarga' in cd) {
    const [zero, um, dois, tres] = cd.porCarga
    return `CD ${numeroSimples(zero, ficha) || '?'} (com Concentração: ${[um, dois, tres].map((numero) => numeroDaCdNaFrase(numero, ficha)).join(' / ')})`
  }
  const previa = 'formula' in cd ? previaDaCd(cd.formula, ficha) : null
  return `CD ${numeroSimples(cd, ficha) || '?'}${previa === null ? '' : ` (${previa})`}`
}

/** A ajuda (aliado, em si) não tem "como acerta": pega sempre, e a frase da técnica não diz o óbvio. */
export function ehAjudaNaFrase(mecanica: MecanicaV1): boolean {
  return mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si'
}

/** Bloco 4: como acerta. Ajuda (aliado, em si) não se esquiva (o bloco do editor diz; a frase da técnica não repete). */
export function fraseDoTeste(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string {
  const { quem } = mecanica.alvo
  if (quem === 'aliados' || quem === 'si') return 'Ajuda não se esquiva: pega sem teste.'
  const { teste } = mecanica
  switch (teste.tipo) {
    case 'reacao':
      return 'O alvo reage normal (o d20 de sempre).'
    case 'naoErra':
      return 'Não erra: o alvo não reage.'
    case 'resistencia': {
      const devolve = teste.sePassar === 'devolveCusto' ? ' Se todos passarem, a técnica não gasta: o custo e o uso voltam.' : ''
      // Fase 5 (B16): "metade se passar".
      const sePassar = teste.sePassar === 'metade' ? 'Se passar, toma metade do dano (sem o selo).' : 'Se passar, nada acontece.'
      return `O alvo não reage: testa ${quemRolaNaFrase(teste.alvo, ficha)} (d20 + mod) contra ${textoDaCd(teste.cd, ficha)}. ${sePassar}${devolve}`
    }
    case 'disputa':
      return `O alvo não reage: disputa de d20 + ${quemRolaNaFrase(teste.usuario, ficha)} de quem usa contra d20 + ${quemRolaNaFrase(teste.alvo, ficha)} do alvo. Empate fica com o alvo; se o alvo vencer, nada acontece.`
  }
}

/** O começo da frase do selo: depende de como o golpe pega ("Se acertar", "Se o alvo falhar"). */
function quandoOSeloPega(mecanica: MecanicaV1): string {
  switch (mecanica.teste.tipo) {
    case 'resistencia':
      return 'Se o alvo falhar'
    case 'disputa':
      return 'Se vencer a disputa'
    case 'reacao':
    case 'naoErra':
      return 'Se acertar'
  }
}

/** A prévia do número com a ficha: "= 80 com a ficha de hoje", "+ a arma escolhida na hora"; `null` = sem prévia. */
export function previaDoDano(formula: string, ficha: FichaDaPrevia | undefined): string | null {
  if (ficha === undefined || ficha.soNomes === true || formula.trim() === '') return null
  const lido = lerDano(formula, { personagem: ficha.personagem, sistema: ficha.sistema, arma: null, vidaDoAlvo: null })
  switch (lido.tipo) {
    case 'valor':
      return `= ${lido.valor} com a ficha de hoje`
    case 'precisaArma':
      return 'soma a arma escolhida na hora'
    case 'precisaAlvo':
      return 'sai da vida do alvo, na hora'
    case 'semDano':
    case 'naoEntende':
      return null
  }
}

/** Bloco 5: "Dano: Força + 20 (= 80 com a ficha de hoje). Perfurante." */
export function frasesDoDano(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string[] {
  const { dano } = mecanica
  const { quem } = mecanica.alvo
  if (dano === undefined) return quem === 'aliados' || quem === 'si' ? [] : ['Não dá dano.']
  // Fase 5 (B10): a base pela vida do alvo é a frase que a fórmula lê ("25% da vida máxima do alvo").
  const formula = 'porcento' in dano.base ? formulaDoNumero(dano.base) : 'fixo' in dano.base ? String(dano.base.fixo) : dano.base.formula.trim()
  const previa = previaDoDano(formula, ficha)
  // A prévia lê a fórmula guardada; a frase a mostra do jeito que se lê ("Espírito × 3").
  const frases = [`Dano: ${formulaNaFrase(formula, ficha) || '(vazio)'}${previa === null ? '' : ` (${previa})`}${dano.perfuracao !== undefined ? `, perfurante ${dano.perfuracao}% (o resto passa pelo Escudo)` : dano.perfurante === true ? ', perfurante' : ''}.`]
  // Fase 5 (B17): o 2º golpe.
  if (dano.segundoGolpe !== undefined) frases.push(`Depois, um 2º golpe nos mesmos alvos com ${Math.round(dano.segundoGolpe.fracao * 100)}% do dano${dano.segundoGolpe.perfurante ? ', perfurante' : ''}, com outra reação.`)
  const { concentracao, surpresa, extra = [] } = dano.multiplicadores
  const sem = [concentracao ? null : 'a Concentração', surpresa ? null : 'a Surpresa'].filter((item): item is string => item !== null)
  if (sem.length > 0) frases.push(`Não multiplica com ${sem.join(' nem com ')}.`)
  for (const mult of extra) frases.push(`× ${numeroComVirgula(mult.vezes)} (${mult.nome}).`)
  // Construtor C8: o Siegfried escolhe a arma na hora, e a padrão já vem marcada.
  if (dano.arma === 'perguntar') frases.push('Pergunta qual arma na hora (a padrão vem marcada).')
  return frases
}

/** "3 vezes dele": a duração da condição, contada na vez de quem a tem. */
function vezesDele(vezes: number): string {
  return `${vezes} ${vezes === 1 ? 'vez' : 'vezes'} dele`
}

/** Fase ED1: a regra de cada tipo do golpe, nas frases do protótipo aprovado (editor/prototipo.html). */
function regraDoTipoEmFrase(escolha: TipoComRegra<TipoDoGolpe>, ficha?: FichaDaPrevia): string {
  switch (escolha.tipo) {
    case 'impacto':
      return `Atordoado por ${vezesDele(escolha.regra.vezes)}: perde a vez e não reage.`
    case 'cortante':
      return `Sangrando por ${vezesDele(escolha.regra.vezes)}: tira ${escolha.regra.porVez} de HP no começo de cada vez, direto (sem o Escudo).`
    case 'perfurante':
      return escolha.regra.porcento >= 100 ? 'Todo o dano vai direto no HP: o Escudo não segura nada.' : `${escolha.regra.porcento}% do dano vai direto no HP; o resto bate no Escudo antes.`
    case 'queimadura':
      return `Queimando por ${vezesDele(escolha.regra.vezes)}: tira ${escolha.regra.porVez} de HP no começo de cada vez. Acertar de novo renova a conta.`
    case 'veneno':
      return `Envenenado por ${vezesDele(escolha.regra.vezes)}: ${escolha.regra.porVez > 0 ? `tira ${escolha.regra.porVez} de HP por vez e ` : ''}a cura que ele recebe cai pela metade.`
    case 'congelamento':
      return `Congelado por ${vezesDele(escolha.regra.vezes)}: reage com desvantagem e alcança ${escolha.regra.casas} ${escolha.regra.casas === 1 ? 'casa' : 'casas'} a menos.`
    case 'choque':
      return `Eletrizado por ${vezesDele(escolha.regra.vezes)}: perde ${escolha.regra.porVez} de SP no fim de cada vez.`
    case 'cegueira':
      return `Cego por ${vezesDele(escolha.regra.vezes)}: a ${nomeDoAtributo('percepcao', ficha)} fica em 0.`
    case 'enfraquecer': {
      const { forca, dano, vezes } = escolha.regra
      const partes = [...(forca > 0 ? [`${nomeDoAtributo(ATRIBUTO_DO_ENFRAQUECER, ficha)} −${forca}`] : []), ...(dano > 0 ? [`Dano −${dano}`] : [])]
      return `Enfraquecido por ${vezesDele(vezes)}${partes.length === 0 ? '' : `: ${partes.join(' e ')}`}.`
    }
    case 'outro':
      return `${escolha.regra.nome} por ${vezesDele(escolha.regra.vezes)}${escolha.regra.porVez > 0 ? `: tira ${escolha.regra.porVez} de HP por vez` : ''}.`
  }
}

/** O "acertar" do "sempre que acertar", pelo jeito que a técnica pega. */
function quandoATecnicaPega(mecanica: MecanicaV1): string {
  switch (mecanica.teste.tipo) {
    case 'resistencia':
      return 'o alvo falhar no teste da técnica'
    case 'disputa':
      return 'vencer a disputa'
    case 'reacao':
    case 'naoErra':
      return 'acertar'
  }
}

/** Fase ED1: um tipo do golpe em frase: o nome, quando pega e a regra ("Veneno, sempre que acertar. Envenenado por 3 vezes dele: ..."). */
function fraseDoTipo(escolha: TipoComRegra<TipoDoGolpe>, mecanica: MecanicaV1, ficha?: FichaDaPrevia): string {
  const nome = NOME_DO_TIPO[escolha.tipo]
  if (escolha.tipo === 'perfurante') return `${nome}. ${regraDoTipoEmFrase(escolha, ficha)}`
  // O empurrão do Impacto é lembrete ao mestre e vale em todo modo, como no protótipo.
  const empurra = escolha.tipo === 'impacto' && escolha.regra.casas > 0 ? ` ${fraseDoEmpurrao(escolha.regra.casas)}` : ''
  const { regra } = escolha
  if (regra.quando === 'soTipo') return `${nome}, só o tipo: só marca o golpe como ${escolha.tipo === 'outro' ? `de ${escolha.regra.nome}` : ADJETIVO_DO_TIPO[escolha.tipo]}.${empurra}`
  const teste = regra.teste ?? TESTE_DO_TIPO_DE_PARTIDA
  const quando = regra.quando === 'teste' ? `com teste: se ${quandoATecnicaPega(mecanica)}, o alvo testa ${nomeDoAtributo(teste.atributo, ficha)} (d20 + mod) contra ${textoDaCd(teste.cd, ficha)} e, se falhar, pega` : `sempre que ${quandoATecnicaPega(mecanica)}`
  return `${nome}, ${quando}. ${regraDoTipoEmFrase(escolha, ficha)}${empurra}`
}

/** Fase ED1: o tipo do golpe em frases, um por linha (como bate, depois o que causa); sem tipo = nenhuma. */
export function frasesDoGolpe(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string[] {
  const { golpe } = mecanica
  if (golpe === undefined) return []
  const tipos: TipoComRegra<TipoDoGolpe>[] = [...(golpe.bate === undefined ? [] : [golpe.bate]), ...(golpe.causa ?? [])]
  return tipos.map((escolha) => fraseDoTipo(escolha, mecanica, ficha))
}

/** Construtor C5: o número conta na vez de quem tem o selo (a regra do sistema), e a frase diz de quem. */
function duracaoDoSelo(duracao: DuracaoDoSelo, ajuda: boolean): string {
  if (duracao === 'ateTirar') return 'até tirarem'
  if (duracao === 'proximoGolpe') return 'até o próximo golpe que tomar'
  return `por ${duracao} ${duracao === 1 ? 'vez' : 'vezes'} ${ajuda ? 'de quem recebe' : 'do alvo'}`
}

/** Fase 5: o que o número do selo muda: o atributo pelo nome da ficha, o dano ou a reação. */
function nomeDoAlvoDoMod(alvo: string, ficha?: FichaDaPrevia): string {
  if (alvo === 'dano') return 'Dano'
  if (alvo === 'reacao') return 'Reação'
  return nomeDoAtributo(alvo, ficha)
}

/** As saídas da reação em verbo, para "não pode esquivar nem contra-atacar". */
const SAIDA_EM_VERBO: Readonly<Record<SaidaDaReacao, string>> = {
  critico: 'acertar crítico',
  cheio: 'receber',
  metade: 'defender',
  esquiva: 'esquivar',
  contra: 'contra-atacar',
  naoReagiu: 'não reagir',
  passou: 'passar',
  semReacao: 'ficar sem reação',
}

/**
 * Construtor C5: o que o selo FAZ, em frases curtas, pela regra do nome
 * (`condicoes.ts`) e pelo "tira X por vez" da peça. Vazio = selo sem regra
 * própria (o app só mostra o selo na carta).
 */
export function frasesDoSelo(selo: Pick<Extract<Efeito, { tipo: 'selo' }>, 'nome' | 'porTurno' | 'mods' | 'regra'>, ficha?: FichaDaPrevia): string[] {
  const regra = comportamentoDoSelo(selo.nome)
  const frases: string[] = []
  // Fase 5: os números do selo ("Força +20") e a regra própria (dano e cura recebidos).
  for (const mod of selo.mods ?? []) frases.push(`${nomeDoAlvoDoMod(mod.alvo, ficha)} ${'fixo' in mod.delta ? (mod.delta.fixo < 0 ? `${mod.delta.fixo}` : `+${mod.delta.fixo}`) : `+ (${formulaNaFrase(mod.delta.formula, ficha)})`}`)
  const recebido = selo.regra?.danoRecebido
  if (recebido !== undefined && recebido !== 0) frases.push(recebido < 0 ? `toma ${-recebido}% a menos de dano` : `toma ${recebido}% a mais de dano`)
  // CURA REDUZIDA (25/11/2026): sem a regra no selo, vale o corte da condição pelo nome (−50).
  const curaRecebida = selo.regra?.curaRecebida ?? regra?.curaRecebida
  if (curaRecebida !== undefined && curaRecebida !== 0) frases.push(curaRecebida < 0 ? `recebe ${-curaRecebida}% a menos de cura` : `recebe ${curaRecebida}% a mais de cura`)
  if (regra?.trava === true) frases.push('na vez dele só passa a vez, e não reage')
  if (regra?.tiraSaidas !== undefined && regra.tiraSaidas.length > 0) frases.push(`não pode ${regra.tiraSaidas.map((saida) => SAIDA_EM_VERBO[saida]).join(' nem ')}`)
  if (regra?.zera !== undefined) frases.push(`${nomeDoAtributo(regra.zera, ficha)} fica em 0`)
  if (regra?.reageComDesvantagem === true) frases.push('reage com desvantagem')
  if (regra?.esquivaComDesvantagem === true) frases.push('esquiva com desvantagem')
  if (regra?.curaDoDano !== undefined) frases.push(`recupera em vida ${regra.curaDoDano}% do dano que causa`)
  const { porTurno } = selo
  if (porTurno?.sinal === 'da') frases.push(`ganha ${porTurno.quanto.fixo} de ${porTurno.recurso === 'hp' ? 'HP' : 'SP'} no fim de cada vez dele`)
  else if (porTurno?.recurso === 'sp') frases.push(`perde ${porTurno.quanto.fixo} de SP no fim de cada vez dele${(porTurno.paraQuemUsa ?? 0) > 0 ? `, e quem usou ganha ${porTurno.paraQuemUsa ?? 0}` : ''}`)
  const porVez = porTurno?.recurso === 'sp' || porTurno?.sinal === 'da' ? undefined : (porTurno?.quanto.fixo ?? regra?.porVez)
  if (porVez !== undefined) frases.push(`perde ${porVez} de HP no começo de cada vez dele, direto, quando o mestre clica Aplicar`)
  if (regra?.renova === true) frases.push('acertar de novo renova a duração')
  if (regra?.lembrete !== undefined) frases.push(`o app só lembra: ${regra.lembrete}`)
  return frases
}

/** Bloco 6: uma frase por efeito. */
export function fraseDoEfeito(efeito: Efeito, mecanica: MecanicaV1, ficha?: FichaDaPrevia): string {
  const ajuda = mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si'
  switch (efeito.tipo) {
    case 'selo': {
      // Fase 4: o selo da reação vai em quem atacou, nunca no alvo da técnica.
      const noAtacante = efeito.em === 'atacante'
      // Fase 5: o selo em quem usa (a postura) pega ao usar, sem depender do acerto.
      const emQuemUsa = efeito.em === 'quemUsa'
      const comeco = noAtacante ? `Ao reagir, marca quem atacou: ${efeito.nome}` : emQuemUsa ? `Quem usa ganha ${efeito.nome}` : ajuda ? `Dá ${efeito.nome}` : `${quandoOSeloPega(mecanica)}: ${efeito.nome}`
      const regra = frasesDoSelo(efeito, ficha)
      const duracao = emQuemUsa ? (typeof efeito.duracao === 'number' ? `por ${efeito.duracao} ${efeito.duracao === 1 ? 'vez' : 'vezes'} dele` : duracaoDoSelo(efeito.duracao, true)) : duracaoDoSelo(efeito.duracao, ajuda && !noAtacante)
      return `${comeco} ${duracao}${regra.length === 0 ? '' : ` (${regra.join('; ')})`}.`
    }
    case 'cura': {
      // Fase 7 (itens): a parte do máximo do alvo ("Cura 50% do HP máximo"); 100% enche.
      if ('porcento' in efeito.quanto) {
        const sigla = efeito.recurso === 'sp' ? 'SP' : 'HP'
        return efeito.quanto.porcento >= 100 ? `Enche o ${sigla} (100% do máximo).` : `${efeito.recurso === 'sp' ? 'Recupera' : 'Cura'} ${efeito.quanto.porcento}% do ${sigla} máximo.`
      }
      // Fase 5: o SP (o Tônico), o Escudo (a Barreira) e a cura em quem usa.
      const quanto = numeroDaPeca(efeito.quanto, ficha)
      const frase = efeito.recurso === 'escudo' ? `Dá ${quanto} de Escudo` : efeito.recurso === 'sp' ? `Recupera ${quanto} de SP` : `Cura ${quanto} de HP`
      return `${frase}${efeito.em === 'quemUsa' ? ' em quem usa' : ''}.`
    }
    case 'tirarSelos': {
      const { quais } = efeito
      if (quais === 'negativos') return 'Tira os selos negativos.'
      if (quais === 'positivos') return 'Tira os selos positivos.'
      if (quais === 'todos') return 'Tira todos os selos (negativos e positivos).'
      return `Tira ${quais.nomes.join(', ')} (só ${quais.nomes.length === 1 ? 'essa condição' : 'essas condições'}).`
    }
    case 'dreno':
      return `Quem usa recupera ${efeito.porcentoDoDano}% do dano que causar, em HP.`
    case 'reviver':
      // Fase 6 (H14): o caído volta e joga de novo na próxima vez dele (a ordem lê a vida de agora).
      return 'porcento' in efeito.volta ? `Quem caiu levanta com ${efeito.volta.porcento}% do HP máximo dele e joga de novo na próxima vez.` : `Quem caiu levanta com ${numeroDaPeca(efeito.volta, ficha)} de HP e joga de novo na próxima vez.`
    case 'aMao':
      return `À mão (o app lembra o mestre): ${efeito.texto.trim()}`
  }
}

/** Bloco 7: recarga, usos e Overload; `null` = sem limite. */
export function fraseDoLimite(mecanica: MecanicaV1): string | null {
  const { recarga, usosPorBatalha, overload } = mecanica.limite
  const partes: string[] = []
  if (recarga !== undefined) partes.push(`Espera ${recarga} ${recarga === 1 ? 'rodada' : 'rodadas'} para usar de novo.`)
  if (usosPorBatalha !== undefined) partes.push(`Até ${usosPorBatalha} ${usosPorBatalha === 1 ? 'uso' : 'usos'} por batalha.`)
  if (overload === true) partes.push('Overload: 1 por batalha.')
  return partes.length === 0 ? null : partes.join(' ')
}

/** Quantas peças o app não executa (só lembra o mestre). Fase ED1: o empurrão do Impacto é uma delas. */
export function pecasAMao(mecanica: MecanicaV1): number {
  const bate = mecanica.golpe?.bate
  const empurra = bate?.tipo === 'impacto' && bate.regra.casas > 0 ? 1 : 0
  return mecanica.efeitos.filter((efeito) => efeito.tipo === 'aMao').length + empurra
}

/** A etiqueta do resumo: "O app faz tudo" ou "1 peça à mão". */
export function etiquetaDaMecanica(mecanica: MecanicaV1): string {
  const quantas = pecasAMao(mecanica)
  if (quantas === 0) return 'O app faz tudo'
  return quantas === 1 ? '1 peça à mão' : `${quantas} peças à mão`
}

// ─── Versão 5: as frases das peças novas (o `frasePeca` do protótipo, sem o HTML) ───

/** O nome do atributo na frase: o do sistema da ficha, senão o da peça. */
function nomeDoAtributoNaFrase(id: string, ficha?: FichaDaPrevia): string {
  return ficha?.sistema.atributos.find((atributo) => atributo.id === id)?.nome ?? nomeDoAtributoDaPeca(id)
}

function comSinal(valor: number): string {
  return valor > 0 ? `+${valor}` : String(valor)
}

function turnosNaFrase(turnos: number): string {
  return `${turnos} ${turnos === 1 ? 'turno' : 'turnos'}`
}

function primeiraMaiuscula(texto: string): string {
  return `${texto.charAt(0).toLocaleUpperCase('pt-BR')}${texto.slice(1)}`
}

function condicaoNaFrase(condicao: CondicaoDaPeca): string {
  return `${condicao.nome} por ${turnosNaFrase(condicao.turnos)}`
}

const QUANDO_O_GATILHO: Readonly<Record<QuandoOGatilhoDispara, (n: number) => string>> = {
  inicio: () => 'no início da batalha',
  comeco: () => 'no começo de cada vez do dono',
  rodada: (n) => `na rodada ${n}`,
  vidaAbaixo: (n) => `quando a vida do dono cair abaixo de ${n}%`,
  aoReceber: () => 'quando o dono recebe dano',
  aoAcertar: () => 'quando o dono acerta um golpe',
  aoCair: () => 'quando o dono cai a 0 de vida',
  aoSerAtingido: () => 'quando o dono é atingido, antes do dano',
}

/** O "Anula o dano": "não toma o dano (toma 0), a não ser que o golpe tenha Haki, até 1 vez por rodada; para anular, paga 20 SP ou passa num teste de Agilidade CD 12". */
function fraseDoAnula(regra: RegraDoAnula, ficha?: FichaDaPrevia): string {
  const pede = textoDoPedidoDaMarca(pedidoDaMarca(regra.paga, regra.teste, regra.como), `paga ${regra.paga} SP`, `passa num teste de ${nomeDoAtributoNaFrase(regra.teste, ficha)} CD ${regra.cd}`)
  const partes = [textoDaExcecao(regra.exceto), textoDoLimiteDoAnula(regra)].filter((parte) => parte !== '')
  return `não toma o dano (toma 0)${partes.length === 0 ? '' : `, ${partes.join(', ')}`}${pede === '' ? '' : `; para anular, ${pede}`}`
}

function fraseDoEfeitoDoGatilho(efeito: EfeitoDoGatilho, ficha?: FichaDaPrevia): string {
  switch (efeito.tipo) {
    case 'atributo':
      return `${comSinal(efeito.valor)} de ${nomeDoAtributoNaFrase(efeito.atributo, ficha)} por ${turnosNaFrase(efeito.turnos)}`
    case 'recuperar':
      return `recupera ${efeito.valor} de ${efeito.recurso === 'hp' ? 'vida' : 'SP'} por turno${efeito.turnos > 1 ? ` durante ${turnosNaFrase(efeito.turnos)}` : ''}`
    case 'escudo':
      return `ganha ${efeito.valor} de Escudo`
    case 'condSi':
      return `fica ${condicaoNaFrase(efeito.condicao)}`
    case 'condAlvo':
      return `o alvo fica ${condicaoNaFrase(efeito.condicao)}`
    case 'aviso':
      return `avisa o mestre ("${efeito.texto}")`
    case 'anula':
      return fraseDoAnula(efeito, ficha)
  }
}

function fraseDaResposta(resposta: RespostaDaPeca): string {
  const muda = [
    resposta.bate === undefined ? '' : `bate como ${NOME_DO_TIPO[resposta.bate]}`,
    resposta.dano === 0 ? '' : `${comSinal(resposta.dano)} de dano`,
    resposta.condicao === undefined ? '' : `deixa ${condicaoNaFrase(resposta.condicao)}`,
    resposta.perfuracao === 0 ? '' : `${resposta.perfuracao}% passa do Escudo`,
  ].filter((parte) => parte !== '')
  return `${resposta.nome} ${muda.length === 0 ? 'não muda nada' : muda.join(', ')}`
}

function fraseDaTransformacao(peca: PecaTransformacao, mecanica: MecanicaV1, ficha?: FichaDaPrevia): string {
  const usos = mecanica.limite.usosPorBatalha
  const abre = mecanica.limite.overload === true ? 'Overload de transformação, 1 por batalha; ligar não erra e ninguém desvia. ' : usos === undefined ? '' : `Liga até ${usos} ${usos === 1 ? 'vez' : 'vezes'} por batalha. `
  const partes = [
    peca.dura === 0 ? 'fica até desligar' : `dura ${turnosNaFrase(peca.dura)}`,
    peca.acoes === 0 ? '' : `ataca ${peca.acoes + 1} vezes em cada vez`,
    peca.mods.map((mod) => `${comSinal(mod.valor)} de ${nomeDoAtributoNaFrase(mod.atributo, ficha)}`).join(', '),
    peca.danoRecebido === 0 ? '' : `leva ${Math.abs(peca.danoRecebido)}% ${peca.danoRecebido < 0 ? 'menos' : 'mais'} de dano`,
    peca.deslocamento === 0 ? '' : `anda ${comSinal(peca.deslocamento)} casas${peca.deslocamentoMax > 0 ? ` (no máximo ${peca.deslocamentoMax})` : ''}`,
    mecanica.limite.overload === true && peca.naoErra ? 'os golpes também não erram' : '',
    peca.grupo.trim() === '' ? '' : `troca com as formas do grupo ${peca.grupo.trim()}`,
    peca.marca ? 'cada ataque deixa uma marca; o próximo golpe na marca dá o dobro e ela some' : '',
  ].filter((parte) => parte !== '')
  // Rework das condições (E7): com os números da Fadiga de fábrica, a frase diz só o nome e os turnos (a regra é da condição); os números próprios de antes continuam escritos.
  const fadigaPropria = peca.fadigaMods.length > 0 && legadoDaFadiga(peca) !== null
  const fadiga = peca.fadiga ? ` Quando acaba: ${NOME_DA_FADIGA} por ${turnosNaFrase(peca.fadigaTurnos)}${fadigaPropria ? ` (${peca.fadigaMods.map((mod) => `${comSinal(mod.valor)} de ${nomeDoAtributoNaFrase(mod.atributo, ficha)}`).join(', ')})` : ''}.` : ''
  return `${abre}${primeiraMaiuscula(partes.join('; '))}.${fadiga}`
}

function fraseDoDiminui(peca: PecaDiminui, ficha?: FichaDaPrevia): string {
  const unidade = peca.modo === 'porcento' ? '%' : ''
  const q = `${peca.valor}${unidade} de ${nomeDoAtributoNaFrase(atributoNoMotor(peca.atributo), ficha)}`
  const teto = peca.teto ? `, até no máximo ${peca.tetoValor}${unidade}` : ''
  const ritmo =
    peca.ritmo === 'umaVez'
      ? `perde ${q} de uma vez, por ${turnosNaFrase(peca.dura)}`
      : peca.ritmo === 'cadaTurno'
        ? `perde ${q} a cada turno, somando${teto}`
        : `começa a perder do ${peca.depoisDe + 1}º turno em diante: ${q} ${peca.depoisVezes === 'cada' ? `a cada turno, somando${teto}` : 'uma vez só'}`
  const volta = peca.volta === 'batalha' ? 'Volta ao normal no fim da batalha.' : peca.volta === 'curar' ? 'Volta ao normal quando tirarem a condição.' : peca.ritmo === 'umaVez' ? 'Depois volta ao normal.' : `Volta ao normal ${turnosNaFrase(peca.voltaEm)} depois do golpe.`
  return `Ao acertar, o alvo ${ritmo}. ${volta} No alvo aparece como ${peca.nome}.`
}

function fraseDaPeca(peca: PecaDaMecanica, mecanica: MecanicaV1, ficha?: FichaDaPrevia): string {
  switch (peca.tipo) {
    case 'pergunta':
      return peca.perguntas.map((pergunta) => `Antes de bater, a batalha pergunta "${pergunta.texto}": ${pergunta.respostas.map(fraseDaResposta).join('; ')}.`).join(' ') + (peca.npc === 'primeira' ? ' Para NPC vale a primeira resposta.' : ' Para NPC, o mestre responde.')
    case 'imbuir': {
      if (peca.elementos.length === 0) return 'Imbuir sem elemento: não pergunta nada.'
      const elementos = peca.elementos.map((elemento) => `${elemento.nome} (${[`${comSinal(elemento.dano)} de dano`, elemento.condicao === undefined ? '' : condicaoNaFrase(elemento.condicao), elemento.desvantagem ? 'o alvo reage com desvantagem' : '', `${elemento.sp} SP`].filter((parte) => parte !== '').join(', ')})`)
      return `Enquanto ligada, a cada golpe do dono a batalha pergunta "Imbuir?": ${elementos.join('; ')}. Ou "Não", que não gasta nada.`
    }
    case 'gatilho': {
      const vezes = peca.vezes === 'umaPorBatalha' ? ' (uma vez por batalha)' : ''
      const fica = peca.ficaCom === undefined ? '' : `, em vez de cair fica com ${peca.ficaCom} de vida`
      const pergunta = peca.pergunta ? ' Pergunta antes de disparar.' : ''
      return `Sozinha, sem gastar ação: ${QUANDO_O_GATILHO[peca.quando](peca.n)}${vezes}${fica}, ${peca.efeitos.map((efeito) => fraseDoEfeitoDoGatilho(efeito, ficha)).join(' e ')}.${pergunta}`
    }
    case 'raca': {
      const partes = [
        peca.corta ? (peca.cortaPorcento >= PORCENTO_QUE_ANULA ? 'o dono não toma dano (corta 100%)' : `corta ${peca.cortaPorcento}% de todo dano que o dono recebe`) : '',
        peca.soma ? `soma +${peca.somaValor} no dano dos golpes ${peca.somaEm === 'fisico' ? 'físicos' : 'corpo a corpo'}` : '',
        peca.naoDesvia ? (peca.naoDesviaQuem === 'dono' ? 'o dono não pode desviar' : 'quem o dono acerta não pode desviar') : '',
      ].filter((parte) => parte !== '')
      return partes.length === 0 ? 'Passiva de raça vazia: ligue pelo menos uma das três.' : `Sempre ligada, sem botão: ${partes.join('; ')}.`
    }
    case 'transformacao':
      return fraseDaTransformacao(peca, mecanica, ficha)
    case 'status': {
      const onde = peca.quem === 'si' ? 'No dono' : peca.quem === 'aliado' ? 'Num aliado' : 'Em todos os aliados'
      const itens = peca.itens.map((item) => {
        const quanto = item.modo === 'fixo' ? comSinal(item.valor) : `${comSinal(item.porcento)}% da ${nomeDoAtributoNaFrase(item.de, ficha)}`
        const tempo = item.dura === 'turnos' ? `por ${turnosNaFrase(item.turnos)}` : item.dura === 'batalha' ? 'até o fim da batalha' : 'para sempre (grava na ficha)'
        return `${nomeDoAtributoNaFrase(atributoNoMotor(item.atributo), ficha)} ${quanto} ${tempo}`
      })
      return `${onde}, ao usar: ${itens.join('; ')}.`
    }
    case 'diminui':
      return fraseDoDiminui(peca, ficha)
    case 'marca': {
      // Pedido de 27/11/2026: "paga e testa", "paga ou testa", só um dos dois (`pedidoDaMarca`).
      const pede = textoDoPedidoDaMarca(pedidoDaMarca(peca.paga, peca.teste, peca.como), `paga ${peca.paga} SP`, `testa ${nomeDoAtributoNaFrase(peca.teste, ficha)}`)
      const abre = peca.quando === 'aoAcertar' ? 'Ao acertar' : peca.quando === 'tiro' ? 'Ao acertar à distância' : `Ao acertar, a batalha pergunta "Marcar?"${pede === '' ? '' : ` (${pede})`} e`
      return `${abre} deixa ${peca.nome} no alvo (até ${turnosNaFrase(peca.turnos)}); o próximo golpe ${peca.quem === 'dono' ? 'do dono' : 'de qualquer um do grupo'} nela dá ${peca.vezes}× o dano${peca.some ? ' e a marca some' : ''}.`
    }
    case 'invocacao':
      return `Chama ${peca.nome}: ${peca.vida} de vida, ${peca.dano} de dano, ocupa ${peca.casas} ${peca.casas === 1 ? 'bloco' : 'blocos'}; no máximo ${peca.max} ao mesmo tempo${peca.ultra ? `, Ultra com carga ${peca.carga}` : ''}.`
    case 'devolve': {
      const soma = peca.soma === '' ? '' : ` + ${nomeDoAtributoNaFrase(peca.soma, ficha)}`
      return `${peca.escolha ? 'Na reação, o jogador escolhe: defender o golpe ou devolver' : 'Na reação, defende e devolve'} o dano recebido ÷ ${peca.divide}${soma} em quem bateu.`
    }
  }
}

/** Versão 5 (PLANO.md decisão 2): as frases das peças novas, na ordem do cartão (o cartão se escreve sozinho). */
export function frasesDasPecas(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string[] {
  return (mecanica.pecas ?? []).map((peca) => fraseDaPeca(peca, mecanica, ficha))
}

/** O resumo inteiro, na ordem dos blocos do editor. */
export function resumoDaMecanica(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string[] {
  const limite = fraseDoLimite(mecanica)
  // Versão 5 (D6): a passiva não tem alvo, dano nem teste da vez.
  const daVez = mecanica.uso !== 'reacao' && mecanica.uso !== 'passiva'
  // Fase 5: "Só vale em quem tem Redoma" (`alvo.exigeSelo`) e o item da mochila.
  const exige = mecanica.alvo.exigeSelo === undefined ? '' : ` Só vale em quem tem ${mecanica.alvo.exigeSelo}.`
  const item = mecanica.custoEmItem
  const doItem = item === undefined ? [] : [`Cada uso gasta ${item.quantos} ${item.nome} da mochila.`]
  // A ajuda não diz "como acerta": pega sempre (`ehAjudaNaFrase`).
  const alvoETeste = ehAjudaNaFrase(mecanica) ? `${fraseDoAlvo(mecanica)}${exige}` : `${fraseDoAlvo(mecanica)}${exige} ${fraseDoTeste(mecanica, ficha)}`
  // Fase 4: só no lugar da reação, a ação, o alvo e o dano da vez não valem; o custo vale nos dois usos.
  return [
    daVez ? fraseDoCustoEDaAcao(mecanica, ficha) : fraseDoCusto(mecanica, ficha),
    ...frasesDosOutrosCustos(mecanica, ficha),
    ...doItem,
    ...(daVez ? [alvoETeste, ...frasesDoDano(mecanica, ficha), ...frasesDoGolpe(mecanica, ficha)] : []),
    ...frasesDaReacao(mecanica, ficha),
    ...mecanica.efeitos.filter((efeito) => daVez || (efeito.tipo === 'selo' && efeito.em === 'atacante')).map((efeito) => fraseDoEfeito(efeito, mecanica, ficha)),
    ...frasesDasPecas(mecanica, ficha),
    ...(limite === null ? [] : [limite]),
  ]
}

/** Fase 4: o que a técnica faz no lugar da reação, em frases (o golpe que chega, o que volta, a cura). */
export function frasesDaReacao(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string[] {
  const { reacao } = mecanica
  if (reacao === undefined) return []
  const { defesa } = reacao
  const quando = mecanica.uso === 'ativaOuReacao' ? 'Também no lugar da reação, antes do d20' : 'No lugar da reação, antes do d20 (não gasta a ação da vez)'
  const faz =
    defesa.tipo === 'anula'
      ? 'anula o golpe'
      : defesa.tipo === 'fica'
        ? `toma só ${defesa.porcento}% do dano`
        : defesa.tipo === 'rola'
          ? `rola d20 + o maior modificador entre ${defesa.atributos.map((id) => ficha?.sistema.atributos.find((atributo) => atributo.id === id)?.nome ?? id).join(', ')}; ${defesa.anulaCom} ou mais anula, abaixo toma inteiro`
          : 'toma o golpe inteiro'
  const frases = [`${quando}: ${faz}.`]
  if (reacao.devolve !== undefined) frases.push(reacao.devolve.divididoPor === 1 ? 'Devolve o dano que ficou em quem atacou, sem reação dele.' : `Devolve o dano que ficou, dividido por ${reacao.devolve.divididoPor}, em quem atacou, sem reação dele.`)
  if (reacao.curaDoQueChegava !== undefined) frases.push(`${reacao.curaDoQueChegava}% do dano que chegava vira vida.`)
  const contra = reacao.valeContra ?? []
  frases.push(contra.length === 0 ? 'Vale contra golpe comum (não contra Overload nem Surpresa).' : `Vale também contra ${contra.map((tipo) => (tipo === 'overload' ? 'Overload' : 'Surpresa')).join(' e ')}.`)
  if (reacao.soOMestre === true) frases.push('Só o mestre usa (o jogador pede a ele).')
  return frases
}
