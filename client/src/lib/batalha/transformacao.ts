import { aplicarAjustes, atributoComposto, cartoesQueLigam, maximoComposto, temMaximo, type Ajuste } from '../ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { MOTIVO_DO_OVERLOAD_USADO, motivoDaAcao, motivoDoCustoAcimaDoMaximo, type AcoesDaVez, type MovimentoDaForma } from './acoes'
import { NUMEROS_DA_FORMA_MAX, type AcaoDaForma, type CombateDoPersonagem, type FormaNaBatalha, type NumeroDaForma } from './combate'
import { normalizar } from './formula'
import { CAMPO_DA_ACAO, CAMPO_DO_CUSTO, ehOverload, lerAcao, lerCusto } from './leituraDaFicha'
import { partesEmOrdem, sobeDeParte, usosContamOAdicional } from './mecanicasAMao'

/**
 * TRANSFORMAÇÃO NA BATALHA, F3 fatia T (seção 3.2 de
 * docs/planos/batalha-one-piece-f3-plano.md; decisão 16 e respostas Q1 a Q3):
 * a tira Transformação do menu da vez. Ativar liga o cartão, gasta a ação do
 * campo Ação (vazio = Completa) e o ATUAL de cada recurso com atual e máximo
 * ganha a diferença do máximo (Q1: HP e SP). Desfazer a forma é ação livre.
 * Ligar pela FICHA no meio da batalha continua manual (Q2). Conserto das
 * fichas F1 (troca a Q3): ao encerrar, TODAS as formas ligadas desligam
 * sozinhas (`desfazerFormasNoFim`).
 *
 * Puro: sem store, sem rede.
 */

/**
 * R2 (lote de 01/11): o campo Grupo. Formas do MESMO grupo se trocam (ligar
 * a Parte 2 desliga a Parte 1 e fica só com os modificadores da 2); grupos
 * diferentes, ou sem grupo, acumulam como antes.
 */
export const CAMPO_DO_GRUPO = 'grupo'
/**
 * R6 (lote de 01/11, os modos Lunarianos Ignição e Resiliente): os campos da
 * forma que mexem na batalha enquanto ela está ligada. Texto livre, lido com
 * folga: "Dano recebido" = "-20%"; "Deslocamento" = "+2" e/ou "máx 6";
 * "Ataques extras" = "1" (por rodada, ao usar Atacar); "Usos por batalha" =
 * "2". A Ação "Livre" liga e desliga sem gastar ação.
 */
export const CAMPO_DO_DANO_RECEBIDO = 'danoRecebido'
export const CAMPO_DO_DESLOCAMENTO = 'deslocamento'
export const CAMPO_DOS_ATAQUES_EXTRAS = 'ataquesExtras'
export const CAMPO_DOS_USOS = 'usos'
/** Teto do que o texto pode pedir (texto torto não vira 1000 ataques). */
const NUMERO_DO_CAMPO_MAX = 99

/** O primeiro inteiro do campo, de 1 ao teto; ausente ou torto, `null`. */
function inteiroDoCampo(cartao: Pick<CartaoDaFicha, 'campos'>, campo: string): number | null {
  const achado = /\d+/.exec(cartao.campos[campo] ?? '')
  const numero = achado === null ? Number.NaN : Number.parseInt(achado[0], 10)
  return Number.isInteger(numero) && numero >= 1 && numero <= NUMERO_DO_CAMPO_MAX ? numero : null
}

/** R6: a forma liga e desliga sem gastar ação (Ação "Livre"). */
export function formaLivre(cartao: Pick<CartaoDaFicha, 'campos'>): boolean {
  return normalizar(cartao.campos[CAMPO_DA_ACAO] ?? '').trim().startsWith('livre')
}

/**
 * R6: quantas vezes a forma liga numa batalha; `null` = sem limite. F2
 * (fatia D, Ignição): na forma da tabela os Usos são dos ataques adicionais
 * (`adicionaisPorBatalha`), e ela liga quantas vezes quiser.
 */
export function usosDaForma(cartao: Pick<CartaoDaFicha, 'id' | 'campos'>): number | null {
  return usosContamOAdicional(cartao.id) ? null : inteiroDoCampo(cartao, CAMPO_DOS_USOS)
}

/** F2 (fatia D, Ignição): os ataques adicionais que a forma dá na batalha INTEIRA (trocar de forma não renova); `null` = sem teto na batalha. */
export function adicionaisPorBatalha(cartao: Pick<CartaoDaFicha, 'id' | 'campos'>): number | null {
  return usosContamOAdicional(cartao.id) ? inteiroDoCampo(cartao, CAMPO_DOS_USOS) : null
}

/**
 * R6: a forma de "Usos por batalha" que já ligou todas as vezes, com a frase;
 * `null` = ainda pode (ou não tem limite). `usados` = `combate.usos` do
 * personagem. O host recusa com a mesma frase (`golpe.ts`); a tela apaga o Ativar.
 */
export function motivoDosUsosDaForma(cartao: Pick<CartaoDaFicha, 'id' | 'campos'>, usados: Readonly<Record<string, number>> | undefined): string | null {
  const usos = usosDaForma(cartao)
  return usos !== null && (usados?.[cartao.id] ?? 0) >= usos ? `Já usou as ${usos} vezes desta batalha` : null
}

export interface EfeitosDasFormas {
  /** Quanto do dano recebido sai (20 = -20%), de 0 a 100. */
  reducaoDoDano: number
  /** O nome da forma dessa redução ("Resiliente"), para o registro; `null` = nenhuma reduz. */
  formaDaReducao: string | null
  /** Casas a mais de deslocamento (a maior vale, não somam); `null` = nenhuma. */
  deslocamentoAMais: number | null
  /** Teto do deslocamento da vez inteira (o menor vale); `null` = sem teto. */
  deslocamentoMax: number | null
  /** Ataques a mais por rodada ao usar Atacar (o maior vale). */
  ataquesExtras: number
  /** F2 (fatia D, Ignição): a forma ligada que conta os adicionais na batalha (os usados ficam em `combate.usos[cartaoId]`); `null` = sem teto. */
  adicionaisNaBatalha: { cartaoId: string; teto: number } | null
}

/** R6: o que as formas ligadas do personagem fazem na batalha agora. Nenhuma: tudo zerado. */
export function efeitosDasFormasLigadas(personagem: Personagem, sistema: SistemaDeRpg): EfeitosDasFormas {
  const efeitos: EfeitosDasFormas = { reducaoDoDano: 0, formaDaReducao: null, deslocamentoAMais: null, deslocamentoMax: null, ataquesExtras: 0, adicionaisNaBatalha: null }
  for (const cartao of cartoesQueLigam(personagem, sistema)) {
    if (!personagem.cartoesAtivos.includes(cartao.id)) continue
    const porcento = reducaoDaForma(cartao) ?? 0
    if (porcento > efeitos.reducaoDoDano) {
      efeitos.reducaoDoDano = porcento
      efeitos.formaDaReducao = cartao.nome.trim() || 'forma'
    }
    const { aMais, max } = deslocamentoDaForma(cartao)
    if (aMais !== null) efeitos.deslocamentoAMais = Math.max(efeitos.deslocamentoAMais ?? 0, aMais)
    if (max !== null) efeitos.deslocamentoMax = Math.min(efeitos.deslocamentoMax ?? NUMERO_DO_CAMPO_MAX, max)
    efeitos.ataquesExtras = Math.max(efeitos.ataquesExtras, ataquesExtrasDaForma(cartao) ?? 0)
    const teto = adicionaisPorBatalha(cartao)
    if (teto !== null && efeitos.adicionaisNaBatalha === null) efeitos.adicionaisNaBatalha = { cartaoId: cartao.id, teto }
  }
  return efeitos
}

/** R6: o Dano recebido de UMA forma ("-20%" = 20), no teto de 100; `null` = a ficha não diz. */
export function reducaoDaForma(cartao: Pick<CartaoDaFicha, 'campos'>): number | null {
  const reducao = /-\s*(\d+)\s*%/.exec(cartao.campos[CAMPO_DO_DANO_RECEBIDO] ?? '')
  return reducao === null ? null : Math.min(100, Number.parseInt(reducao[1] ?? '0', 10))
}

/** R6: o campo Deslocamento de UMA forma ("+2", "máx 6"), no teto do campo; cada parte `null` = a ficha não diz. */
export function deslocamentoDaForma(cartao: Pick<CartaoDaFicha, 'campos'>): { aMais: number | null; max: number | null } {
  const deslocamento = normalizar(cartao.campos[CAMPO_DO_DESLOCAMENTO] ?? '')
  const aMais = /\+\s*(\d+)/.exec(deslocamento)
  const teto = /max\w*\s*(\d+)/.exec(deslocamento)
  return {
    aMais: aMais === null ? null : Math.min(NUMERO_DO_CAMPO_MAX, Number.parseInt(aMais[1] ?? '0', 10)),
    max: teto === null ? null : Math.min(NUMERO_DO_CAMPO_MAX, Number.parseInt(teto[1] ?? '0', 10)),
  }
}

/** R6: os ataques a mais por rodada ao usar Atacar de UMA forma (Ignição: 1); `null` = a ficha não diz. */
export function ataquesExtrasDaForma(cartao: Pick<CartaoDaFicha, 'campos'>): number | null {
  return inteiroDoCampo(cartao, CAMPO_DOS_ATAQUES_EXTRAS)
}

/** R6: o dano que chega com a redução das formas (Resiliente: -20%), arredondado. */
export function danoComAReducao(dano: number, reducaoDoDano: number): number {
  return reducaoDoDano <= 0 ? dano : Math.max(0, Math.round((dano * (100 - reducaoDoDano)) / 100))
}

/**
 * R6: o que as formas ligadas mudam na vez de quem age (`acoesDaVez`): o
 * deslocamento e o ataque adicional, com os já feitos na `rodada`. O mesmo
 * no mestre (`acoesDaCarta`) e no recorte do jogador.
 */
export function formaNaVez(personagem: Personagem, sistema: SistemaDeRpg, combate: (Pick<CombateDoPersonagem, 'ataquesExtras'> & Partial<Pick<CombateDoPersonagem, 'usos'>>) | undefined, rodada: number): MovimentoDaForma {
  const efeitos = efeitosDasFormasLigadas(personagem, sistema)
  const vez: MovimentoDaForma = { aMais: efeitos.deslocamentoAMais, max: efeitos.deslocamentoMax }
  if (efeitos.ataquesExtras <= 0) return vez
  const usados = combate?.ataquesExtras?.rodada === rodada ? combate.ataquesExtras.usados : 0
  // F2 (fatia D, Ignição): o que sobra dos adicionais da batalha limita os da rodada (os 2 acabaram = nenhum, mesmo trocando de forma).
  const teto = efeitos.adicionaisNaBatalha
  const restam = teto === null ? efeitos.ataquesExtras : Math.max(0, teto.teto - (combate?.usos?.[teto.cartaoId] ?? 0))
  const total = Math.min(efeitos.ataquesExtras, usados + restam)
  if (total > 0) vez.ataquesExtras = { total, usados }
  return vez
}

/**
 * R6: o combate depois do ataque adicional da forma: +1 nesta `rodada` (outra
 * rodada recomeça do 1). F2 (fatia D): `formaDoTeto` = a forma que conta os
 * adicionais da batalha (Ignição): +1 nos usos dela.
 */
export function comAtaqueExtra(combate: CombateDoPersonagem, rodada: number, formaDoTeto?: string): CombateDoPersonagem {
  const usados = combate.ataquesExtras?.rodada === rodada ? combate.ataquesExtras.usados : 0
  const depois: CombateDoPersonagem = { ...combate, ataquesExtras: { rodada, usados: usados + 1 } }
  return formaDoTeto === undefined ? depois : { ...depois, usos: { ...depois.usos, [formaDoTeto]: (depois.usos[formaDoTeto] ?? 0) + 1 } }
}
/** C6 (lote de 01/11): o que é preciso para transformar ("Vida abaixo de 50%"). Só mostra: o app não confere. */
export const CAMPO_DO_REQUISITO = 'requisito'

/** O grupo como a ficha o escreve, aparado; vazio ou "-" = sem grupo (`null`). */
export function grupoDaForma(cartao: Pick<CartaoDaFicha, 'campos'>): string | null {
  const texto = (cartao.campos[CAMPO_DO_GRUPO] ?? '').trim()
  return texto.length === 0 || texto === '-' ? null : texto
}

/** O requisito como a ficha o escreve, aparado; vazio ou "-" = nenhum (`null`). */
export function requisitoDaForma(cartao: Pick<CartaoDaFicha, 'campos'>): string | null {
  const texto = (cartao.campos[CAMPO_DO_REQUISITO] ?? '').trim()
  return texto.length === 0 || texto === '-' ? null : texto
}

/** As formas LIGADAS do mesmo grupo de `cartao` (sem ele): as que Ativar desliga. Sem grupo = nenhuma. Grupo comparado sem caixa nem acento. */
export function formasQueTroca(personagem: Personagem, sistema: SistemaDeRpg, cartao: CartaoDaFicha): CartaoDaFicha[] {
  const grupo = grupoDaForma(cartao)
  if (grupo === null) return []
  const chave = normalizar(grupo)
  return cartoesQueLigam(personagem, sistema).filter((outra) => {
    if (outra.id === cartao.id || !personagem.cartoesAtivos.includes(outra.id)) return false
    const dela = grupoDaForma(outra)
    return dela !== null && normalizar(dela) === chave
  })
}

export interface FormaNoMenu {
  cartao: CartaoDaFicha
  ligada: boolean
  /** R2: o grupo da forma ("Lunariano"); `null` = sem grupo (acumula com tudo). */
  grupo: string | null
  /** R2: os nomes das formas ligadas do mesmo grupo que Ativar desliga ("troca com Forma Híbrida Parte 1"). */
  troca: string[]
  /** C6: o que é preciso para transformar, como a ficha escreve; `null` = a ficha não diz. */
  requisito: string | null
  /** O campo Ação; vazio ou ilegível = "completa". */
  acaoDaFicha: AcaoDaForma
  imagem: string | null
  /** A prévia do que muda (modificadores, máximos, atual). Vazia na forma já ligada. */
  numeros: NumeroDaForma[]
  /** Nomes dos subcartões (entram nas Habilidades quando ligada: já é a F2). */
  tecnicas: string[]
  /** Apagada com a ação DA FICHA e por quê; `null` = pode. O seletor relê com `motivoDaForma`. */
  motivo: string | null
  /** R6: os "Usos por batalha" acabaram (`motivoDosUsosDaForma`); ausente ou `null` = ainda pode. Vale também na forma Livre. */
  motivoDosUsos?: string | null
}

/**
 * A ação que o campo Ação da forma diz: Simples, Bônus, Livre ("Livre" liga
 * sem gastar); o resto (vazio, ilegível) = Completa. S4: na mesa quem se
 * transforma escolhe na hora (a tela não marca nada); isto é só o que a ficha
 * diz, para o duelo do Lobby (onde o cliente não escolhe) e para a dica.
 */
export function acaoDaForma(cartao: CartaoDaFicha): AcaoDaForma {
  if (formaLivre(cartao)) return 'livre'
  const { acao } = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  return acao === 'simples' || acao === 'bonus' ? acao : 'completa'
}

/** O cartão de forma (aba que liga) pelo id; `null` = não é forma desta ficha. */
export function formaDaFicha(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string): CartaoDaFicha | null {
  return cartoesQueLigam(personagem, sistema).find((cartao) => cartao.id === cartaoId) ?? null
}

/**
 * Por que Ativar está apagado com a ação ESCOLHIDA na tela, ou `null`.
 * Forma ligada: nada a ativar (Desfazer é ação livre, sempre pode). `acoes`
 * null = sem a conta da vez (o mestre fora da vez): não apaga.
 */
export function motivoDaForma(forma: Pick<FormaNoMenu, 'ligada'>, acao: AcaoDaForma, acoes: AcoesDaVez | null): string | null {
  if (forma.ligada) return null
  return acoes === null ? null : motivoDaAcao(acoes, acao)
}

/**
 * Conserto das fichas F1 (resposta do Jimboy, valendo para forma): o Custo da
 * forma acima do MÁXIMO do recurso a deixa bloqueada com o motivo ("Precisa
 * de 200 SP (o máximo é 120)"). `null` = cabe, ou a forma não tem custo.
 */
export function motivoDoCustoDaForma(cartao: Pick<CartaoDaFicha, 'campos'>, personagem: Personagem, sistema: SistemaDeRpg): string | null {
  return motivoDoCustoAcimaDoMaximo(lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem), personagem, sistema)
}

/**
 * As formas da ficha para a tira Transformação, com a prévia de cada uma
 * desligada. `combate` = o do personagem nesta batalha: os "Usos por
 * batalha" e o Overload já usado (1 por batalha) apagam o Ativar, com a
 * mesma frase que o host usa ao recusar (`podeAgir`).
 */
export function formasNoMenu(personagem: Personagem, sistema: SistemaDeRpg, acoes: AcoesDaVez | null, combate?: Pick<CombateDoPersonagem, 'usos' | 'overload'>): FormaNoMenu[] {
  return cartoesQueLigam(personagem, sistema).map((cartao) => {
    const ligada = personagem.cartoesAtivos.includes(cartao.id)
    const motivoDosUsos = ligada ? null : motivoDosUsosDaForma(cartao, combate?.usos)
    // F2 (fatia E): a Forma Híbrida liga em ordem (a mesma frase que o host usa ao recusar).
    const motivoDaFicha = ligada ? null : ehOverload(cartao) && combate?.overload === true ? MOTIVO_DO_OVERLOAD_USADO : (motivoDaOrdemDasPartes(personagem, sistema, cartao) ?? motivoDoCustoDaForma(cartao, personagem, sistema))
    const acaoDaFicha = acaoDaForma(cartao)
    // A prévia é a própria ativação feita no ar (o histórico e o relógio não importam aqui).
    const previa = ligada ? null : ativarForma(personagem, sistema, cartao.id, '', 0)
    return {
      cartao,
      ligada,
      grupo: grupoDaForma(cartao),
      troca: ligada ? [] : formasQueTroca(personagem, sistema, cartao).map((outra) => outra.nome),
      requisito: requisitoDaForma(cartao),
      acaoDaFicha,
      imagem: cartao.imagem,
      numeros: previa?.numeros ?? [],
      tecnicas: cartao.subcartoes.map((subcartao) => subcartao.nome),
      motivo: motivoDosUsos ?? motivoDaFicha ?? motivoDaForma({ ligada }, acaoDaFicha, acoes),
      motivoDosUsos,
    }
  })
}

/** As chaves que os modificadores dos cartões mexem, separadas: atributos e recursos de atual e máximo. */
function chavesDoCartao(cartoes: readonly CartaoDaFicha[], sistema: SistemaDeRpg): { atributos: string[]; recursos: string[] } {
  const chaves = [...new Set(cartoes.flatMap((cartao) => cartao.modificadores.map((mod) => mod.atributo)))]
  return {
    atributos: sistema.atributos.filter((atributo) => chaves.includes(atributo.id)).map((atributo) => atributo.id),
    recursos: sistema.recursos.filter((recurso) => chaves.includes(recurso.id) && temMaximo(sistema, recurso.id)).map((recurso) => recurso.id),
  }
}

/** "FOR 160 → 220", "HP máx 1.200 → 1.800", "HP 900 → 1.500": o que mudou de `antes` para `depois`, na ordem atributos, depois cada recurso (máximo e atual). */
function numerosDaForma(antes: Personagem, depois: Personagem, sistema: SistemaDeRpg, cartoes: readonly CartaoDaFicha[]): NumeroDaForma[] {
  const { atributos, recursos } = chavesDoCartao(cartoes, sistema)
  const numeros: NumeroDaForma[] = []
  for (const atributo of sistema.atributos) {
    if (!atributos.includes(atributo.id)) continue
    const de = atributoComposto(antes, atributo.id).total
    const para = atributoComposto(depois, atributo.id).total
    if (de !== para) numeros.push({ rotulo: atributo.abreviacao || atributo.nome, de, para })
  }
  for (const recurso of sistema.recursos) {
    if (!recursos.includes(recurso.id)) continue
    const maximoDe = maximoComposto(antes, recurso.id).total
    const maximoPara = maximoComposto(depois, recurso.id).total
    if (maximoDe !== maximoPara) numeros.push({ rotulo: `${recurso.nome} máx`, de: maximoDe, para: maximoPara })
    const atualDe = numeroDaFicha(antes.recursos, recurso.id)
    const atualPara = numeroDaFicha(depois.recursos, recurso.id)
    if (atualDe !== atualPara) numeros.push({ rotulo: recurso.nome, de: atualDe, para: atualPara })
  }
  return numeros.slice(0, NUMEROS_DA_FORMA_MAX)
}

/**
 * Ativar: liga o cartão e, para cada recurso de atual e máximo que a forma
 * AUMENTA, soma a diferença do máximo ao atual (Q1: HP e SP; o
 * `aplicarAjuste` limita no máximo novo). Máximo que cai (a troca para uma
 * Parte menor): o atual perde a diferença (bug 9, `atualSeguindoOMaximo`). R2: antes, desliga as formas ligadas do mesmo grupo
 * (`formasQueTroca`): fica só com os modificadores da nova, e a diferença do
 * máximo conta desde antes da troca. Tudo pelo `aplicarAjustes`, com o
 * histórico da ficha em nome de `quem`. `null` = não ativou (não é forma da
 * ficha, ou já está ligada). `desligadas` = os cartões que a troca desligou.
 */
export function ativarForma(
  personagem: Personagem,
  sistema: SistemaDeRpg,
  cartaoId: string,
  quem: string,
  quando: number,
): { personagem: Personagem; numeros: NumeroDaForma[]; desligadas: CartaoDaFicha[] } | null {
  const cartao = formaDaFicha(personagem, sistema, cartaoId)
  if (cartao === null || personagem.cartoesAtivos.includes(cartaoId)) return null
  const desligadas = formasQueTroca(personagem, sistema, cartao)
  const { recursos } = chavesDoCartao([cartao, ...desligadas], sistema)
  const maximosAntes = new Map(recursos.map((recurso) => [recurso, maximoComposto(personagem, recurso).total]))
  const trocas: Ajuste[] = [...desligadas.map((outra): Ajuste => ({ parte: 'cartao', chave: outra.id, valor: 0 })), { parte: 'cartao', chave: cartaoId, valor: 1 }]
  const ligado = aplicarAjustes(personagem, sistema, trocas, quem, quando)
  if (!ligado.cartoesAtivos.includes(cartaoId)) return null
  const depois = atualSeguindoOMaximo(personagem, ligado, sistema, maximosAntes, quem, quando)
  return { personagem: depois, numeros: numerosDaForma(personagem, depois, sistema, [cartao, ...desligadas]), desligadas }
}

/**
 * Bug 9 (P4 do grilling: "desfazer a forma tira o HP/SP que ela deu"): o
 * atual de cada recurso de `maximosAntes` anda o que o máximo andou, a partir
 * do atual de ANTES da troca: o máximo que subiu soma, o que desceu tira (no
 * 0; o `aplicarAjuste` limita no máximo novo). Assim ativar e desfazer (ou
 * trocar de Parte e voltar) não curam de graça. Nada a mudar = `depois`.
 */
function atualSeguindoOMaximo(antes: Personagem, depois: Personagem, sistema: SistemaDeRpg, maximosAntes: ReadonlyMap<string, number>, quem: string, quando: number): Personagem {
  const ajustes = [...maximosAntes].flatMap(([recurso, maximoAntes]): Ajuste[] => {
    const diferenca = maximoComposto(depois, recurso).total - maximoAntes
    return diferenca === 0 ? [] : [{ parte: 'recurso', chave: recurso, valor: Math.max(0, numeroDaFicha(antes.recursos, recurso) + diferenca) }]
  })
  return ajustes.length === 0 ? depois : aplicarAjustes(depois, sistema, ajustes, quem, quando)
}

/**
 * "Desfazer a forma" (ação livre): desliga o cartão e, bug 9, o atual perde o
 * que a forma deu no máximo (300/700 → ativa 600/1.000 → desfaz 300/700).
 * `null` = não estava ligada.
 */
export function desfazerForma(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string, quem: string, quando: number): Personagem | null {
  if (!personagem.cartoesAtivos.includes(cartaoId)) return null
  const cartao = formaDaFicha(personagem, sistema, cartaoId)
  const { recursos } = chavesDoCartao(cartao === null ? [] : [cartao], sistema)
  const maximosAntes = new Map(recursos.map((recurso) => [recurso, maximoComposto(personagem, recurso).total]))
  const desligado = aplicarAjustes(personagem, sistema, [{ parte: 'cartao', chave: cartaoId, valor: 0 }], quem, quando)
  if (desligado.cartoesAtivos.includes(cartaoId)) return null
  return atualSeguindoOMaximo(personagem, desligado, sistema, maximosAntes, quem, quando)
}

/**
 * Conserto das fichas F1 (resposta do Vagn, "formas no fim da batalha
 * desligam sozinhas, todas, de todo personagem"): cada forma ligada desliga
 * como no Desfazer (o atual perde o que ela deu, bug 9). Nenhuma ligada =
 * `null` (nada a gravar).
 */
export function desfazerFormasNoFim(personagem: Personagem, sistema: SistemaDeRpg, quem: string, quando: number): Personagem | null {
  const ligadas = cartoesQueLigam(personagem, sistema).filter((cartao) => personagem.cartoesAtivos.includes(cartao.id))
  let atual = personagem
  for (const cartao of ligadas) atual = desfazerForma(atual, sistema, cartao.id, quem, quando) ?? atual
  return atual === personagem ? null : atual
}

/** A imagem da forma para o token e o retrato: só enquanto o cartão segue ligado (R5: desligou pela ficha, a imagem volta sozinha). */
export function aparenciaDaForma(forma: FormaNaBatalha | undefined, personagem: Personagem | undefined): string | null {
  if (forma === undefined || personagem === undefined || !personagem.cartoesAtivos.includes(forma.cartaoId)) return null
  return forma.imagem
}

/**
 * P6 (resposta da Ryoko, "sem SP, a forma desce uma Parte"): a forma do
 * MESMO grupo que vem antes na ficha (Parte 2 → Parte 1). A primeira do
 * grupo, ou forma sem grupo = `null` (volta para a base).
 */
export function parteAnterior(personagem: Personagem, sistema: SistemaDeRpg, cartao: CartaoDaFicha): CartaoDaFicha | null {
  const grupo = grupoDaForma(cartao)
  if (grupo === null) return null
  const chave = normalizar(grupo)
  const formas = cartoesQueLigam(personagem, sistema)
  const indice = formas.findIndex((outra) => outra.id === cartao.id)
  for (let i = indice - 1; i >= 0; i -= 1) {
    const outra = formas[i]
    const dela = outra === undefined ? null : grupoDaForma(outra)
    if (outra !== undefined && dela !== null && normalizar(dela) === chave) return outra
  }
  return null
}

/** F2 (fatia E): as formas do MESMO grupo de `cartao`, na ordem da ficha (ele junto). Sem grupo: só ele. */
function formasDoGrupo(personagem: Personagem, sistema: SistemaDeRpg, cartao: CartaoDaFicha): CartaoDaFicha[] {
  const grupo = grupoDaForma(cartao)
  if (grupo === null) return [cartao]
  const chave = normalizar(grupo)
  return cartoesQueLigam(personagem, sistema).filter((outra) => {
    const dela = grupoDaForma(outra)
    return dela !== null && normalizar(dela) === chave
  })
}

/**
 * F2 (fatia E, resposta da Ryoko: "Partes em ordem 1 → 2 → 3, uma por vez"):
 * a Parte do grupo que pode ligar agora: a seguinte à ligada (a mais alta
 * ligada), ou a primeira sem nenhuma ligada. `null` = a última já está ligada.
 */
function parteQueLiga(personagem: Personagem, sistema: SistemaDeRpg, cartao: CartaoDaFicha): CartaoDaFicha | null {
  const grupo = formasDoGrupo(personagem, sistema, cartao)
  const ligada = grupo.reduce((maior, forma, indice) => (personagem.cartoesAtivos.includes(forma.id) ? indice : maior), -1)
  return grupo[ligada + 1] ?? null
}

/**
 * F2 (fatia E): por que Ativar esta forma fura a ordem das Partes, ou `null`.
 * Só vale nas formas da tabela com `partesEmOrdem` (a Forma Híbrida); as
 * outras trocam no grupo como sempre.
 */
export function motivoDaOrdemDasPartes(personagem: Personagem, sistema: SistemaDeRpg, cartao: CartaoDaFicha): string | null {
  if (!partesEmOrdem(cartao.id)) return null
  const seguinte = parteQueLiga(personagem, sistema, cartao)
  if (seguinte?.id === cartao.id) return null
  return seguinte === null ? 'Já está na última Parte' : `Uma Parte por vez: a próxima é ${seguinte.nome.trim() || 'a Parte seguinte'}`
}

/**
 * F2 (fatia E, Fúria do Dragão): a Parte que a técnica liga (a seguinte à
 * forma de onde ela vem), ou o motivo de não subir. `null` = a técnica não
 * sobe de Parte.
 */
export function subidaDeParte(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string): { para: CartaoDaFicha } | { motivo: string } | null {
  if (!sobeDeParte(cartaoId)) return null
  const dona = cartoesQueLigam(personagem, sistema).find((forma) => forma.subcartoes.some((subcartao) => subcartao.id === cartaoId))
  if (dona === undefined || !personagem.cartoesAtivos.includes(dona.id)) return { motivo: 'A forma desta técnica não está ligada' }
  const grupo = formasDoGrupo(personagem, sistema, dona)
  const seguinte = grupo[grupo.findIndex((forma) => forma.id === dona.id) + 1]
  return seguinte === undefined ? { motivo: 'Já está na última Parte' } : { para: seguinte }
}

/**
 * P6: a forma desce uma Parte: desliga (o atual perde o que ela deu, bug 9) e
 * liga a Parte anterior do grupo (`parteAnterior`), se houver. `anterior` =
 * o cartão que ligou; `null` = voltou para a base. `null` no todo = a forma
 * não estava ligada.
 */
export function descerUmaParte(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string, quem: string, quando: number): { personagem: Personagem; anterior: CartaoDaFicha | null } | null {
  const cartao = formaDaFicha(personagem, sistema, cartaoId)
  if (cartao === null) return null
  const semEla = desfazerForma(personagem, sistema, cartaoId, quem, quando)
  if (semEla === null) return null
  const anterior = parteAnterior(personagem, sistema, cartao)
  const ligada = anterior === null ? null : ativarForma(semEla, sistema, anterior.id, quem, quando)
  return ligada === null ? { personagem: semEla, anterior: null } : { personagem: ligada.personagem, anterior }
}

/**
 * Conserto das fichas F1 (resposta do Vagn): no Encerrar TODAS as formas
 * desligam (`desfazerFormasNoFim`). As linhas "Bruno saiu de Punho Negro (fim
 * da batalha)", uma por personagem com forma ligada, lidas ANTES de desligar,
 * para a tela do Encerrar avisar.
 */
export function formasQueDesligamNoFim(personagemIds: Iterable<string>, personagens: readonly Personagem[], sistema: SistemaDeRpg | null): string[] {
  if (sistema === null) return []
  const linhas: string[] = []
  for (const personagemId of new Set(personagemIds)) {
    const personagem = personagens.find((candidato) => candidato.id === personagemId)
    if (personagem === undefined) continue
    const nomes = cartoesQueLigam(personagem, sistema)
      .filter((cartao) => personagem.cartoesAtivos.includes(cartao.id))
      .map((cartao) => cartao.nome.trim() || 'a forma')
    if (nomes.length > 0) linhas.push(`${personagem.nome.trim() || 'A ficha'} saiu de ${nomes.join(', ')} (fim da batalha)`)
  }
  return linhas
}

/** O nome da forma ativada pelo menu, enquanto o cartão segue ligado (a carta mostra "PUNHO NEGRO"). */
export function nomeDaFormaLigada(forma: FormaNaBatalha | undefined, personagem: Personagem | undefined): string | null {
  if (forma === undefined || personagem === undefined || !personagem.cartoesAtivos.includes(forma.cartaoId)) return null
  for (const cartoes of Object.values(personagem.abas)) {
    const cartao = cartoes.find((candidato) => candidato.id === forma.cartaoId)
    if (cartao !== undefined) return cartao.nome
  }
  return null
}
