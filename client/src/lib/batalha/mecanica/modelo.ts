import { NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX, DANO_MAX, CUSTO_MAX, type VantagemDoDado } from '../combate'

/**
 * AS PEÇAS DA TÉCNICA MONTADA (construtor de mecânicas, fatia C1; seção 1 de
 * docs/planos/construtor-de-mecanicas-2026-11-08.md). O dado mora no próprio
 * cartão (`CartaoDaFicha.mecanica`), versionado como a ficha DBT: `versao` e
 * um leitor que recusa versão futura. Sem o campo, o cartão abre e joga igual
 * a hoje (as 11 fichas não migram: seguem a mecânica à mão da F2).
 *
 * Tudo ou nada por cartão: com peças, Custo, Dano e Efeito em texto viram só
 * descrição. Peça torta = "mecânica inválida" (o cartão vira à mão); versão
 * maior que a do app = "atualize o app". Nos dois casos NÃO volta para o
 * texto, que pode estar velho.
 *
 * Esta fatia aceita só as peças que o motor já executa. As fatias seguintes
 * (área num ponto livre e alcance, C6 perguntas)
 * acrescentam variantes opcionais; até lá, um cartão com elas é recusado
 * aqui, e não executado pela metade.
 *
 * Puro: sem store, sem rede.
 */

/**
 * A versão mais nova que este app LÊ (Fase 2 de docs/design/habilidades/SISTEMA.md:
 * a versão 2 é a 1 com mais peças; a 1 continua lida como sempre).
 */
export const VERSAO_DA_MECANICA = 2

/** As versões que este app lê. A peça lida guarda a versão com que veio. */
export type VersaoDaMecanica = 1 | 2

/**
 * A versão que este app GRAVA numa mecânica nova (modelos, arma montada).
 * Continua 1 enquanto nenhuma peça da 2 roda: assim a mecânica que o mestre
 * monta agora abre no app de antes e no site do Lobby. A fase que abrir uma
 * peça só da 2 grava 2 nas mecânicas que a usarem (`migrarV1ParaV2`).
 */
export const VERSAO_GRAVADA = 1

/** Teto de uma fórmula ("(Força + Espírito) * 1,5 + 100"), na gramática de `lerDano`. */
export const FORMULA_MAX = 200
/** Teto de efeitos por técnica. */
export const EFEITOS_MAX = 8
/** Teto de custos (um por momento: ao usar, por vez, depois). */
export const CUSTOS_MAX = 3
/** Teto dos multiplicadores extras (furtivo, ponto vital, marca). */
export const EXTRAS_MAX = 4
/** Teto de um multiplicador extra (×10). */
export const VEZES_MAX = 10
/** Teto do texto de um lembrete à mão. */
export const TEXTO_A_MAO_MAX = 200
/** Teto da recarga e dos usos por batalha. */
export const LIMITE_MAX = 20
/** Teto de alvos, de casas e do lado do quadrado. */
export const CASAS_MAX = 20
/** Teto da CD fixa (construtor C4). */
export const CD_MAX = 99
/** Teto do id de atributo num teste (construtor C4). */
export const ATRIBUTO_MAX = 64

/** Um número da peça: fixo ou fórmula da ficha de quem usa. */
export type NumeroSimples = { fixo: number } | { formula: string }
/** Um número que muda com a Concentração guardada (carga 0, 1, 2 e 3). */
export type Numero = NumeroSimples | { porCarga: readonly [NumeroSimples, NumeroSimples, NumeroSimples, NumeroSimples] }

/** Quanto custa: `aoUsar` bloqueia sem o recurso; `porTurno` = técnica mantida (lembrete "Aplicar / pular"), só fixo; `depois` cobra sem bloquear, só HP fixo. */
export interface Custo {
  recurso: 'sp' | 'hp'
  quanto: NumeroSimples | { porcento: number; de: 'maximo' | 'atual' }
  quando: 'aoUsar' | 'porTurno' | 'depois'
}

/** A ação que a técnica gasta; `perguntar` = quem usa escolhe na hora (a mira pergunta). */
export type AcaoDaMecanica = 'simples' | 'bonus' | 'completa' | 'livre' | 'perguntar'

/** `overload`: herda as regras da F1 (1 por batalha, gasta a Completa, só outra Overload defende). */
export interface Limite {
  recarga?: number
  usosPorBatalha?: number
  overload?: true
}

/** O desenho do alvo. `quadrado` com `centro: 'si'` = em volta de quem usa (lado ímpar: 3x3 = raio 1). */
export type FormaDoAlvo =
  | { tipo: 'um' }
  | { tipo: 'varios'; max: number; dividirDano?: true }
  | { tipo: 'linha'; casas: number }
  | { tipo: 'quadrado'; lado: number; centro: 'si' | 'frente' }
  | { tipo: 'raio'; casas: number }

export type QuemOAlvoPega = 'inimigos' | 'aliados' | 'todos' | 'si' | 'escolha'

export interface AlvoDaMecanica {
  quem: QuemOAlvoPega
  forma: FormaDoAlvo
}

/** Um número da CD que muda com a Concentração; `automatico` = naquela carga pega sem teste. */
export type NumeroDaCd = NumeroSimples | 'automatico'

/**
 * A CD do teste (construtor C4): um número, uma fórmula na ficha de quem usa
 * ("12 + mod(Carisma)"), ou pela Concentração guardada (carga 0 a 3; na carga
 * 0 sempre há teste).
 */
export type CdDoTeste = NumeroSimples | { porCarga: readonly [NumeroSimples, NumeroDaCd, NumeroDaCd, NumeroDaCd] }

/** Quem rola num teste: o atributo (id do sistema) e, se houver, a vantagem (2 d20, fica o maior) ou a desvantagem (fica o menor). */
export interface QuemRolaNoTeste {
  atributo: string
  vantagem?: VantagemDoDado
}

/**
 * Como acerta. `reacao`: o alvo reage com o d20 de sempre. `naoErra`: sem
 * reação. Construtor C4, os dois testes que o app rola ao usar, no lugar da
 * reação: `resistencia` (o alvo rola d20 + mod do atributo contra a CD;
 * passou = nada, ou nada e a técnica não gasta) e `disputa` (d20 + mod de
 * quem usa contra d20 + mod do alvo; o empate fica com o alvo).
 */
export type Teste =
  | { tipo: 'reacao' }
  | { tipo: 'naoErra' }
  | { tipo: 'resistencia'; alvo: QuemRolaNoTeste; cd: CdDoTeste; sePassar: 'nada' | 'devolveCusto' }
  | { tipo: 'disputa'; usuario: QuemRolaNoTeste; alvo: QuemRolaNoTeste }

/** A fórmula do dano soma a arma (a padrão, ou a que a mira pergunta). */
export function danoUsaArma(dano: Pick<DanoDaMecanica, 'arma'> | undefined): boolean {
  return dano?.arma === 'padrao' || dano?.arma === 'perguntar'
}

/** O teste é rolado pelo app ao usar (resistência ou disputa)? */
export function testeRolado(teste: Teste): teste is Extract<Teste, { tipo: 'resistencia' | 'disputa' }> {
  return teste.tipo === 'resistencia' || teste.tipo === 'disputa'
}

/** Um multiplicador a mais, na ordem da lista, depois da Concentração e da Surpresa. */
export interface MultiplicadorExtra {
  nome: string
  vezes: number
}

export interface DanoDaMecanica {
  base: NumeroSimples
  /**
   * `padrao` = a arma padrão da ficha entra no "Dano da arma" (na arma montada, ela mesma);
   * `perguntar` (construtor C8, o Siegfried) = a mira pergunta qual das armas levadas, já
   * marcada a padrão; ausente ou `nenhuma` = sem arma.
   */
  arma?: 'nenhuma' | 'padrao' | 'perguntar'
  perfurante?: boolean
  multiplicadores: { concentracao: boolean; surpresa: boolean; extra?: readonly MultiplicadorExtra[] }
}

/**
 * Por quanto tempo o selo fica (construtor C5). O número conta na vez de quem
 * tem o selo, como a regra do sistema (`contarSelos`): desce 1 no fim de cada
 * vez dele, e a vez em que nasceu não conta (1 = até o fim da próxima vez
 * dele). `ateTirar` = até o mestre tirar; `proximoGolpe` = sai quando o
 * próximo golpe chega em quem o tem (a redoma da Orquídea).
 */
export type DuracaoDoSelo = number | 'ateTirar' | 'proximoGolpe'

/**
 * O que o selo tira no começo de cada vez de quem o tem (construtor C5:
 * Sangrando, Queimando N, um veneno de NPC). Sempre pelo lembrete "Aplicar /
 * pular" do mestre. Por enquanto só HP em número fixo, direto (sem o Escudo):
 * é o que o lembrete do sangramento aplica. A forma completa do plano
 * (`recurso` SP, fórmula, pelo Escudo) entra sem mudar a peça.
 */
export interface PorTurnoDoSelo {
  recurso: 'hp'
  quanto: { fixo: number }
  direto: true
}

export type Efeito =
  /**
   * O comportamento do selo vem do NOME, pela tabela de `condicoes.ts` (a
   * mesma da F2): Atordoado trava a vez, Aéreo tira a esquiva e o contra, Cego
   * zera a Percepção, Queimando renova. Assim a regra chega também ao jogador,
   * que só recebe o nome. Nome fora da tabela = selo sem regra própria.
   */
  | { tipo: 'selo'; nome: string; duracao: DuracaoDoSelo; natureza?: 'buff' | 'debuff'; porTurno?: PorTurnoDoSelo }
  | { tipo: 'cura'; recurso: 'hp'; quanto: Numero; emQuem: 'alvo' }
  | { tipo: 'tirarSelos'; quais: 'negativos' }
  /** Porta de escape: o app não executa nada, só lembra o mestre. */
  | { tipo: 'aMao'; texto: string }

/**
 * As peças lidas (versão 1 ou 2). A 2 é um SUPERCONJUNTO da 1 (decisão C2):
 * toda peça da 1 vale na 2 com o mesmo sentido, e as peças novas entram aqui
 * uma fase por vez, quando o motor passa a executá-las (`PECAS_QUE_AINDA_NAO_RODAM`).
 */
export interface MecanicaV2 {
  versao: VersaoDaMecanica
  acao: AcaoDaMecanica
  custos: readonly Custo[]
  limite: Limite
  alvo: AlvoDaMecanica
  teste: Teste
  dano?: DanoDaMecanica
  efeitos: readonly Efeito[]
}

/** O nome da fatia C1, mantido para quem já o usa: são as mesmas peças lidas (`MecanicaV2`). */
export type MecanicaV1 = MecanicaV2

/**
 * A 1 vira 2: só a versão muda, o resto é igual (a 2 é superconjunto). Pura
 * e total. Quem grava chama quando a mecânica ganha uma peça só da 2.
 */
export function migrarV1ParaV2(mecanica: MecanicaV2): MecanicaV2 {
  return mecanica.versao === 2 ? mecanica : { ...mecanica, versao: 2 }
}

// ─── Versão 2: as peças novas, ainda sem motor ──────────────────────────────
// Os tipos da seção 2 do SISTEMA.md que as fases 4 a 8 abrem. Até a fase de
// cada uma, a leitura RECUSA a peça com "este app ainda não executa ..." (o
// cartão vira à mão, nunca roda pela metade). Quem abrir uma peça põe o campo
// na interface de cima, lê na `lerMecanica` e tira a linha da tabela de baixo.

/** Parte da vida ou do SP de alguém: "25% do HP máximo do alvo" (fase 5). */
export interface Porcento {
  porcento: number
  de: 'hpMaximo' | 'hpAtual' | 'hpQueFalta' | 'spMaximo'
  deQuem: 'alvo' | 'quemUsa'
}
/** COMO entra em jogo (fase 4). Ausente = 'ativa' (toda mecânica da versão 1). */
export type UsoDaMecanica = 'ativa' | 'reacao' | 'ativaOuReacao'
/** Gastar coisa da mochila além do SP e do HP (fase 5). */
export interface CustoEmItem {
  nome: string
  itemId?: string
  quantos: number
}
/** Em quem o efeito cai; 'atacante' só na reação (fases 4 e 5). Ausente = 'alvo'. */
export type EmQuem = 'alvo' | 'quemUsa' | 'atacante'
/** O que o selo faz além do nome (fase 5). */
export interface RegraDoSelo {
  trava?: true
  tiraSaidas?: readonly ('esquiva' | 'contra')[]
  reageComDesvantagem?: true
  danoRecebido?: number
  curaRecebida?: number
}
/** A técnica usada NO LUGAR da reação (decisão M2, fase 4). */
export interface ReacaoDaMecanica {
  defesa: { tipo: 'anula' } | { tipo: 'fica'; porcento: number } | { tipo: 'rola'; atributos: readonly string[]; anulaCom: number } | { tipo: 'nenhuma' }
  devolve?: { divididoPor: number } | { formula: string; somaOQueChegou?: true }
  curaDoQueChegava?: number
  valeContra?: readonly ('overload' | 'surpresa')[]
  soOMestre?: true
}

/**
 * As peças da versão 2 que a leitura conhece e ainda recusa, por lugar: a
 * chave e a frase que completa "este app ainda não executa ...". Chave de
 * fora desta tabela segue "que este app não conhece", como na versão 1.
 */
export const PECAS_QUE_AINDA_NAO_RODAM: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'mecânica': { uso: 'técnica no lugar da reação', reacao: 'técnica no lugar da reação', custoEmItem: 'custo em item da mochila' },
  limite: { porRodada: 'limite por rodada' },
  alvo: { alcance: 'alcance do alvo', estado: 'alvo caído (reviver)', exigeSelo: 'só contra quem tem um selo' },
  forma: { centro: 'área em volta de um alvo ou de um ponto' },
  dano: { perfuracao: 'perfuração parcial', segundoGolpe: 'segundo golpe' },
  selo: { em: 'selo em quem usa ou em quem atacou', mods: 'selo com número (Força +20)', regra: 'regra própria do selo', seJaTem: 'renovar o selo' },
  cura: { em: 'cura em quem usa' },
}

/** Os efeitos da versão 2 que ainda não rodam, pelo tipo. */
const EFEITOS_QUE_AINDA_NAO_RODAM: Readonly<Record<string, string>> = { reviver: 'reviver', dreno: 'dreno de vida', mover: 'empurrar e puxar' }

/** O que a leitura do campo `mecanica` dá. */
export type MecanicaLida =
  /** O cartão não tem o campo: segue pelo texto (as fichas de hoje). */
  | { tipo: 'nenhuma' }
  | { tipo: 'pecas'; mecanica: MecanicaV2 }
  /** Peça torta: o cartão vira à mão. `motivo` em português simples. */
  | { tipo: 'invalida'; motivo: string }
  /** Feita num app mais novo: o cartão vira à mão até atualizar. */
  | { tipo: 'futura'; versao: number }

/** O aviso do cartão com mecânica que este app não executa. */
export function avisoDaMecanica(lida: Extract<MecanicaLida, { tipo: 'invalida' | 'futura' }>): string {
  return lida.tipo === 'futura' ? 'Mecânica feita num app mais novo: atualize o app. Por enquanto, à mão.' : `Mecânica inválida (${lida.motivo}): à mão.`
}

// ─── Leitura ────────────────────────────────────────────────────────────────

/** A peça torta: sai da leitura com o motivo (nunca escapa de `lerMecanica`). */
class PecaTorta extends Error {}

function torta(motivo: string): never {
  throw new PecaTorta(motivo)
}

function registro(valor: unknown, onde: string): Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) torta(`${onde} não é uma peça`)
  return { ...valor }
}

/**
 * Só as chaves conhecidas: chave de fatia futura não roda pela metade. A peça
 * da versão 2 que ainda não roda (`PECAS_QUE_AINDA_NAO_RODAM`, pelo `lugar`) diz isso.
 */
function soChaves(peca: Record<string, unknown>, permitidas: readonly string[], onde: string, lugar?: string): void {
  const sobra = Object.keys(peca).find((chave) => !permitidas.includes(chave))
  if (sobra === undefined) return
  const nova = lugar === undefined ? undefined : PECAS_QUE_AINDA_NAO_RODAM[lugar]?.[sobra]
  if (nova !== undefined) aindaNaoRoda(nova)
  torta(`${onde} tem "${sobra}", que este app não conhece`)
}

/** A peça da versão 2 que a leitura conhece e o motor ainda não executa: o cartão vira à mão com o porquê. */
function aindaNaoRoda(oQue: string): never {
  torta(`este app ainda não executa ${oQue}`)
}

/** "25% do HP" (`Porcento`, fase 5) num lugar que ainda só aceita número ou fórmula. */
function semPorcento(valor: unknown): void {
  if (typeof valor === 'object' && valor !== null && 'porcento' in valor) aindaNaoRoda('parte da vida (%) como número')
}

function umDe<T extends string>(valor: unknown, opcoes: readonly T[], onde: string): T {
  const achada = opcoes.find((opcao) => opcao === valor)
  if (achada === undefined) torta(`${onde} fora da lista`)
  return achada
}

function inteiro(valor: unknown, minimo: number, maximo: number, onde: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < minimo || valor > maximo) torta(`${onde} precisa ser inteiro de ${minimo} a ${maximo}`)
  return valor
}

function texto(valor: unknown, maximo: number, onde: string): string {
  if (typeof valor !== 'string' || valor.trim().length === 0 || valor.length > maximo || /[\r\n]/.test(valor)) torta(`${onde} precisa ter de 1 a ${maximo} letras, numa linha`)
  return valor
}

function lista(valor: unknown, maximo: number, onde: string): unknown[] {
  if (!Array.isArray(valor)) torta(`${onde} não é uma lista`)
  if (valor.length > maximo) torta(`${onde} passa de ${maximo}`)
  return valor
}

function numeroSimples(valor: unknown, maximo: number, onde: string): NumeroSimples {
  const peca = registro(valor, onde)
  if ('fixo' in peca) {
    soChaves(peca, ['fixo'], onde)
    return { fixo: inteiro(peca.fixo, 0, maximo, onde) }
  }
  soChaves(peca, ['formula'], onde)
  return { formula: texto(peca.formula, FORMULA_MAX, `${onde} (fórmula)`) }
}

function numero(valor: unknown, maximo: number, onde: string): Numero {
  const peca = registro(valor, onde)
  if (!('porCarga' in peca)) return numeroSimples(peca, maximo, onde)
  soChaves(peca, ['porCarga'], onde)
  const cargas = lista(peca.porCarga, 4, `${onde} por carga`).map((item, carga) => numeroSimples(item, maximo, `${onde} na carga ${carga}`))
  const [zero, um, dois, tres] = cargas
  if (zero === undefined || um === undefined || dois === undefined || tres === undefined) torta(`${onde} por carga precisa de 4 números (carga 0 a 3)`)
  return { porCarga: [zero, um, dois, tres] }
}

function quantoDoCusto(valor: unknown, onde: string): Custo['quanto'] {
  const quanto = registro(valor, `${onde} (quanto)`)
  if (!('porcento' in quanto)) return numeroSimples(quanto, CUSTO_MAX, onde)
  soChaves(quanto, ['porcento', 'de'], onde)
  return { porcento: inteiro(quanto.porcento, 1, 100, `${onde} (porcentagem)`), de: umDe(quanto.de, ['maximo', 'atual'] as const, `${onde} (de quê)`) }
}

function custo(valor: unknown, indice: number): Custo {
  const onde = `custo ${indice + 1}`
  const peca = registro(valor, onde)
  soChaves(peca, ['recurso', 'quanto', 'quando'], onde)
  const lido = quantoDoCusto(peca.quanto, onde)
  const quando = umDe(peca.quando, ['aoUsar', 'porTurno', 'depois'] as const, `${onde} (quando)`)
  // A técnica mantida cobra o mesmo número a cada vez (`MantidaAMao.custoPorVez`): só o fixo cabe nela.
  if (quando === 'porTurno' && !('fixo' in lido)) torta(`${onde}: o custo por vez precisa ser um número fixo`)
  const recurso = umDe(peca.recurso, ['sp', 'hp'] as const, `${onde} (recurso)`)
  // O "depois" cobra pelo `custoEmHp` da linha (Sai Dai Rin): só HP fixo. Outro "depois" seria lido e nunca cobrado.
  if (quando === 'depois' && (recurso !== 'hp' || !('fixo' in lido))) torta(`${onde}: o custo depois de usar, por enquanto, só aceita HP em número fixo`)
  return { recurso, quanto: lido, quando }
}

function limite(valor: unknown): Limite {
  const peca = registro(valor ?? {}, 'limite')
  soChaves(peca, ['recarga', 'usosPorBatalha', 'overload'], 'limite', 'limite')
  const lido: Limite = {}
  if (peca.recarga !== undefined) lido.recarga = inteiro(peca.recarga, 1, LIMITE_MAX, 'recarga')
  if (peca.usosPorBatalha !== undefined) lido.usosPorBatalha = inteiro(peca.usosPorBatalha, 1, LIMITE_MAX, 'usos por batalha')
  // O motor guarda um Tempo só por técnica (`LeituraDoTempo`).
  if (lido.recarga !== undefined && lido.usosPorBatalha !== undefined) torta('recarga e usos por batalha juntos')
  if (peca.overload !== undefined) {
    if (peca.overload !== true) torta('overload só aceita "sim"')
    lido.overload = true
  }
  return lido
}

function forma(valor: unknown): FormaDoAlvo {
  const peca = registro(valor, 'forma do alvo')
  const tipo = umDe(peca.tipo, ['um', 'varios', 'linha', 'quadrado', 'raio'] as const, 'forma do alvo')
  switch (tipo) {
    case 'um':
      soChaves(peca, ['tipo'], 'alvo')
      return { tipo }
    case 'varios': {
      soChaves(peca, ['tipo', 'max', 'dividirDano'], 'alvo')
      const lida: FormaDoAlvo = { tipo, max: inteiro(peca.max, 2, CASAS_MAX, 'máximo de alvos') }
      if (peca.dividirDano === true) lida.dividirDano = true
      else if (peca.dividirDano !== undefined) torta('dividir o dano só aceita "sim"')
      return lida
    }
    case 'linha':
    case 'raio':
      soChaves(peca, ['tipo', 'casas'], 'alvo', 'forma')
      return { tipo, casas: inteiro(peca.casas, 1, CASAS_MAX, 'casas') }
    case 'quadrado': {
      soChaves(peca, ['tipo', 'lado', 'centro'], 'alvo')
      if (peca.centro === 'ponto') aindaNaoRoda('área em volta de um ponto')
      const lado = inteiro(peca.lado, 1, CASAS_MAX, 'lado do quadrado')
      const centro = umDe(peca.centro, ['si', 'frente'] as const, 'centro do quadrado')
      if (centro === 'si' && lado % 2 === 0) torta('o quadrado em volta de quem usa precisa de lado ímpar (3x3, 5x5)')
      return { tipo, lado, centro }
    }
  }
}

function alvo(valor: unknown): AlvoDaMecanica {
  const peca = registro(valor, 'alvo')
  soChaves(peca, ['quem', 'forma'], 'alvo', 'alvo')
  const quem = umDe(peca.quem, ['inimigos', 'aliados', 'todos', 'si', 'escolha'] as const, 'quem o alvo pega')
  const lida = forma(peca.forma)
  // Construtor C3: a área marca os inimigos, os aliados (a cura em área) ou todos; "em si" não tem área.
  if (quem === 'si' && lida.tipo !== 'um') torta('"em si" é um alvo só')
  return { quem, forma: lida }
}

function quemRola(valor: unknown, onde: string): QuemRolaNoTeste {
  const peca = registro(valor, onde)
  soChaves(peca, ['atributo', 'vantagem'], onde)
  const lido: QuemRolaNoTeste = { atributo: texto(peca.atributo, ATRIBUTO_MAX, `${onde} (atributo)`) }
  if (peca.vantagem !== undefined) lido.vantagem = umDe(peca.vantagem, ['vantagem', 'desvantagem'] as const, `${onde} (vantagem)`)
  return lido
}

function numeroDaCd(valor: unknown, onde: string): NumeroDaCd {
  return valor === 'automatico' ? valor : numeroSimples(valor, CD_MAX, onde)
}

function cd(valor: unknown): CdDoTeste {
  const peca = registro(valor, 'CD')
  if (!('porCarga' in peca)) return numeroSimples(peca, CD_MAX, 'CD')
  soChaves(peca, ['porCarga'], 'CD')
  const [zero, um, dois, tres] = lista(peca.porCarga, 4, 'CD por carga')
  if (zero === undefined || um === undefined || dois === undefined || tres === undefined) torta('a CD por carga precisa de 4 números (carga 0 a 3)')
  // Sem carga, sempre há teste: o "pega sem teste" só vale com a Concentração guardada.
  return { porCarga: [numeroSimples(zero, CD_MAX, 'CD sem carga'), numeroDaCd(um, 'CD na carga 1'), numeroDaCd(dois, 'CD na carga 2'), numeroDaCd(tres, 'CD na carga 3')] }
}

function teste(valor: unknown): Teste {
  const peca = registro(valor ?? { tipo: 'reacao' }, 'teste')
  const tipo = umDe(peca.tipo, ['reacao', 'naoErra', 'resistencia', 'disputa'] as const, 'teste')
  switch (tipo) {
    case 'reacao':
    case 'naoErra':
      soChaves(peca, ['tipo'], 'teste')
      return { tipo }
    case 'resistencia':
      soChaves(peca, ['tipo', 'alvo', 'cd', 'sePassar'], 'teste')
      if (peca.sePassar === 'metade') aindaNaoRoda('metade do dano para quem passa no teste')
      return { tipo, alvo: quemRola(peca.alvo, 'quem testa'), cd: cd(peca.cd), sePassar: umDe(peca.sePassar ?? 'nada', ['nada', 'devolveCusto'] as const, 'se o alvo passar') }
    case 'disputa':
      soChaves(peca, ['tipo', 'usuario', 'alvo'], 'teste')
      return { tipo, usuario: quemRola(peca.usuario, 'quem usa na disputa'), alvo: quemRola(peca.alvo, 'o alvo na disputa') }
  }
}

/**
 * As regras do teste rolado com o resto da mecânica: ajuda não testa, e a CD
 * pela Concentração pede a carga, que o dano sem Concentração não gasta.
 */
function conferirTeste(mecanica: Pick<MecanicaV2, 'teste' | 'alvo' | 'dano'>): void {
  const { teste: lido } = mecanica
  if (!testeRolado(lido)) return
  if (mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si') torta('teste e disputa não valem em aliado nem em quem usa')
  if (lido.tipo === 'resistencia' && 'porCarga' in lido.cd && mecanica.dano !== undefined && !mecanica.dano.multiplicadores.concentracao) {
    torta('a CD pela Concentração precisa do dano que multiplica com a Concentração')
  }
}

function multiplicador(valor: unknown, indice: number): MultiplicadorExtra {
  const onde = `multiplicador ${indice + 1}`
  const peca = registro(valor, onde)
  soChaves(peca, ['nome', 'vezes'], onde)
  const vezes = peca.vezes
  if (typeof vezes !== 'number' || !Number.isFinite(vezes) || vezes <= 0 || vezes > VEZES_MAX) torta(`${onde}: vezes de 0 a ${VEZES_MAX}`)
  return { nome: texto(peca.nome, NOME_DO_SELO_MAX, `${onde} (nome)`), vezes }
}

function dano(valor: unknown): DanoDaMecanica {
  const peca = registro(valor, 'dano')
  soChaves(peca, ['base', 'arma', 'perfurante', 'multiplicadores'], 'dano', 'dano')
  semPorcento(peca.base)
  const mult = registro(peca.multiplicadores ?? {}, 'multiplicadores')
  soChaves(mult, ['concentracao', 'surpresa', 'extra'], 'multiplicadores')
  const lido: DanoDaMecanica = {
    base: numeroSimples(peca.base, DANO_MAX, 'dano base'),
    multiplicadores: { concentracao: mult.concentracao !== false, surpresa: mult.surpresa !== false },
  }
  if (mult.extra !== undefined) lido.multiplicadores.extra = lista(mult.extra, EXTRAS_MAX, 'multiplicadores extras').map(multiplicador)
  if (peca.arma !== undefined) lido.arma = umDe(peca.arma, ['nenhuma', 'padrao', 'perguntar'] as const, 'arma')
  if (peca.perfurante !== undefined) {
    if (typeof peca.perfurante !== 'boolean') torta('perfurante só aceita sim ou não')
    lido.perfurante = peca.perfurante
  }
  return lido
}

/** Construtor C5: o "tira X por vez" do selo. Só HP fixo e direto: é o que o lembrete "Aplicar" do mestre executa. */
function porTurnoDoSelo(valor: unknown, onde: string): PorTurnoDoSelo {
  const peca = registro(valor, `${onde} (por vez)`)
  soChaves(peca, ['recurso', 'quanto', 'direto'], `${onde} (por vez)`)
  if (peca.recurso !== 'hp' || peca.direto !== true) torta(`${onde}: o selo que tira por vez, por enquanto, só tira HP direto (sem o Escudo)`)
  const quanto = registro(peca.quanto, `${onde} (quanto tira por vez)`)
  if (!('fixo' in quanto)) torta(`${onde}: o quanto tira por vez precisa ser um número fixo`)
  soChaves(quanto, ['fixo'], `${onde} (quanto tira por vez)`)
  return { recurso: 'hp', quanto: { fixo: inteiro(quanto.fixo, 1, DANO_MAX, `${onde} (quanto tira por vez)`) }, direto: true }
}

function efeito(valor: unknown, indice: number): Efeito {
  const onde = `efeito ${indice + 1}`
  const peca = registro(valor, onde)
  const novo = typeof peca.tipo === 'string' && Object.hasOwn(EFEITOS_QUE_AINDA_NAO_RODAM, peca.tipo) ? EFEITOS_QUE_AINDA_NAO_RODAM[peca.tipo] : undefined
  if (novo !== undefined) aindaNaoRoda(novo)
  const tipo = umDe(peca.tipo, ['selo', 'cura', 'tirarSelos', 'aMao'] as const, onde)
  switch (tipo) {
    case 'selo': {
      soChaves(peca, ['tipo', 'nome', 'duracao', 'natureza', 'porTurno'], onde, 'selo')
      const duracao = peca.duracao === 'ateTirar' || peca.duracao === 'proximoGolpe' ? peca.duracao : inteiro(peca.duracao, 1, TURNOS_DO_SELO_MAX, `${onde} (duração)`)
      const lido: Efeito = { tipo, nome: texto(peca.nome, NOME_DO_SELO_MAX, `${onde} (nome do selo)`), duracao }
      if (peca.natureza !== undefined) lido.natureza = umDe(peca.natureza, ['buff', 'debuff'] as const, `${onde} (natureza)`)
      if (peca.porTurno !== undefined) lido.porTurno = porTurnoDoSelo(peca.porTurno, onde)
      return lido
    }
    case 'cura':
      soChaves(peca, ['tipo', 'recurso', 'quanto', 'emQuem'], onde, 'cura')
      if (peca.recurso === 'sp' || peca.recurso === 'escudo') aindaNaoRoda(peca.recurso === 'sp' ? 'recuperar SP' : 'dar Escudo')
      semPorcento(peca.quanto)
      return { tipo, recurso: umDe(peca.recurso, ['hp'] as const, `${onde} (recurso)`), quanto: numero(peca.quanto, DANO_MAX, `${onde} (quanto)`), emQuem: umDe(peca.emQuem, ['alvo'] as const, `${onde} (em quem)`) }
    case 'tirarSelos':
      soChaves(peca, ['tipo', 'quais'], onde)
      if (peca.quais !== undefined && peca.quais !== 'negativos') aindaNaoRoda('tirar condição pelo nome, ou as positivas')
      return { tipo, quais: umDe(peca.quais, ['negativos'] as const, `${onde} (quais)`) }
    case 'aMao':
      soChaves(peca, ['tipo', 'texto'], onde)
      return { tipo, texto: texto(peca.texto, TEXTO_A_MAO_MAX, `${onde} (texto)`) }
  }
}

/** Um de cada: selo, cura e tirar selos (a fatia C5 abre mais de um selo). */
function conferirEfeitos(efeitos: readonly Efeito[], quem: QuemOAlvoPega): void {
  for (const tipo of ['selo', 'cura', 'tirarSelos'] as const) {
    if (efeitos.filter((item) => item.tipo === tipo).length > 1) torta(`mais de um efeito "${tipo}"`)
  }
  // A cura e a limpeza de hoje (`LimpezaAMao`) valem em quem usa ou num aliado.
  const limpa = efeitos.some((item) => item.tipo === 'cura' || item.tipo === 'tirarSelos')
  if (limpa && quem !== 'aliados' && quem !== 'si') torta('cura e tirar selos só pegam em quem usa ou num aliado')
}

function mecanicaLida(peca: Record<string, unknown>, versao: VersaoDaMecanica): MecanicaV2 {
  soChaves(peca, ['versao', 'acao', 'custos', 'limite', 'alvo', 'teste', 'dano', 'efeitos'], 'mecânica', 'mecânica')
  const custos = lista(peca.custos ?? [], CUSTOS_MAX, 'custos').map(custo)
  for (const quando of ['aoUsar', 'porTurno', 'depois'] as const) {
    if (custos.filter((item) => item.quando === quando).length > 1) torta('dois custos no mesmo momento')
  }
  const lidoAlvo = alvo(peca.alvo)
  const efeitos = lista(peca.efeitos ?? [], EFEITOS_MAX, 'efeitos').map(efeito)
  conferirEfeitos(efeitos, lidoAlvo.quem)
  const mecanica: MecanicaV2 = {
    versao,
    acao: umDe(peca.acao, ['simples', 'bonus', 'completa', 'livre', 'perguntar'] as const, 'ação'),
    custos,
    limite: limite(peca.limite),
    alvo: lidoAlvo,
    teste: teste(peca.teste),
    efeitos,
  }
  if (peca.dano !== undefined) mecanica.dano = dano(peca.dano)
  conferirTeste(mecanica)
  return mecanica
}

/**
 * Lê o campo `mecanica` do cartão. Nunca lança. Ausente = `nenhuma` (segue o
 * texto); versão maior que `VERSAO_DA_MECANICA` = `futura`; qualquer peça
 * torta, chave desconhecida ou teto passado = `invalida` com o motivo.
 */
export function lerMecanica(valor: unknown): MecanicaLida {
  if (valor === undefined) return { tipo: 'nenhuma' }
  try {
    const peca = registro(valor, 'mecânica')
    const versao = inteiro(peca.versao, 1, Number.MAX_SAFE_INTEGER, 'versão')
    if (versao > VERSAO_DA_MECANICA) return { tipo: 'futura', versao }
    // A 1 e a 2 pelo mesmo leitor (a 2 é superconjunto); a peça guarda a versão com que veio.
    return { tipo: 'pecas', mecanica: mecanicaLida(peca, versao === 1 ? 1 : 2) }
  } catch (erro) {
    if (erro instanceof PecaTorta) return { tipo: 'invalida', motivo: erro.message }
    throw erro
  }
}
