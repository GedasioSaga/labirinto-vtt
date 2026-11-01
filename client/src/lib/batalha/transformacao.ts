import { aplicarAjustes, atributoComposto, cartoesQueLigam, maximoComposto, temMaximo, type Ajuste } from '../ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { motivoDaAcao, type AcoesDaVez, type MovimentoDaForma } from './acoes'
import { NUMEROS_DA_FORMA_MAX, type AcaoDaForma, type CombateDoPersonagem, type FormaNaBatalha, type NumeroDaForma } from './combate'
import { normalizar } from './formula'
import { CAMPO_DA_ACAO, lerAcao } from './leituraDaFicha'

/**
 * TRANSFORMAÇÃO NA BATALHA, F3 fatia T (seção 3.2 de
 * docs/planos/batalha-one-piece-f3-plano.md; decisão 16 e respostas Q1 a Q3):
 * a tira Transformação do menu da vez. Ativar liga o cartão, gasta a ação do
 * campo Ação (vazio = Completa) e o ATUAL de cada recurso com atual e máximo
 * ganha a diferença do máximo (Q1: HP e SP). Desfazer a forma é ação livre.
 * Ligar pela FICHA no meio da batalha continua manual (Q2); ao encerrar, a
 * forma segue ligada e só a imagem volta (Q3).
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

/** R6: quantas vezes a forma liga numa batalha; `null` = sem limite. */
export function usosDaForma(cartao: Pick<CartaoDaFicha, 'campos'>): number | null {
  return inteiroDoCampo(cartao, CAMPO_DOS_USOS)
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
}

/** R6: o que as formas ligadas do personagem fazem na batalha agora. Nenhuma: tudo zerado. */
export function efeitosDasFormasLigadas(personagem: Personagem, sistema: SistemaDeRpg): EfeitosDasFormas {
  const efeitos: EfeitosDasFormas = { reducaoDoDano: 0, formaDaReducao: null, deslocamentoAMais: null, deslocamentoMax: null, ataquesExtras: 0 }
  for (const cartao of cartoesQueLigam(personagem, sistema)) {
    if (!personagem.cartoesAtivos.includes(cartao.id)) continue
    const reducao = /-\s*(\d+)\s*%/.exec(cartao.campos[CAMPO_DO_DANO_RECEBIDO] ?? '')
    const porcento = reducao === null ? 0 : Math.min(100, Number.parseInt(reducao[1] ?? '0', 10))
    if (porcento > efeitos.reducaoDoDano) {
      efeitos.reducaoDoDano = porcento
      efeitos.formaDaReducao = cartao.nome.trim() || 'forma'
    }
    const { aMais, max } = deslocamentoDaForma(cartao)
    if (aMais !== null) efeitos.deslocamentoAMais = Math.max(efeitos.deslocamentoAMais ?? 0, aMais)
    if (max !== null) efeitos.deslocamentoMax = Math.min(efeitos.deslocamentoMax ?? NUMERO_DO_CAMPO_MAX, max)
    efeitos.ataquesExtras = Math.max(efeitos.ataquesExtras, ataquesExtrasDaForma(cartao) ?? 0)
  }
  return efeitos
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
export function formaNaVez(personagem: Personagem, sistema: SistemaDeRpg, combate: Pick<CombateDoPersonagem, 'ataquesExtras'> | undefined, rodada: number): MovimentoDaForma {
  const efeitos = efeitosDasFormasLigadas(personagem, sistema)
  const vez: MovimentoDaForma = { aMais: efeitos.deslocamentoAMais, max: efeitos.deslocamentoMax }
  if (efeitos.ataquesExtras > 0) vez.ataquesExtras = { total: efeitos.ataquesExtras, usados: combate?.ataquesExtras?.rodada === rodada ? combate.ataquesExtras.usados : 0 }
  return vez
}

/** R6: o combate depois do ataque adicional da forma: +1 nesta `rodada` (outra rodada recomeça do 1). */
export function comAtaqueExtra(combate: CombateDoPersonagem, rodada: number): CombateDoPersonagem {
  const usados = combate.ataquesExtras?.rodada === rodada ? combate.ataquesExtras.usados : 0
  return { ...combate, ataquesExtras: { rodada, usados: usados + 1 } }
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

/** A ação que Ativar a forma gasta, pelo campo Ação: Simples, Completa ou Bônus; o resto (vazio, Livre, ilegível) = Completa. */
export function acaoDaForma(cartao: CartaoDaFicha): AcaoDaForma {
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

/** As formas da ficha para a tira Transformação, com a prévia de cada uma desligada. */
export function formasNoMenu(personagem: Personagem, sistema: SistemaDeRpg, acoes: AcoesDaVez | null, usados?: Readonly<Record<string, number>>): FormaNoMenu[] {
  return cartoesQueLigam(personagem, sistema).map((cartao) => {
    const ligada = personagem.cartoesAtivos.includes(cartao.id)
    const motivoDosUsos = ligada ? null : motivoDosUsosDaForma(cartao, usados)
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
      motivo: motivoDosUsos ?? motivoDaForma({ ligada }, acaoDaFicha, acoes),
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
 * `aplicarAjuste` limita no máximo novo). Máximo que cai: o corte do ligar já
 * resolve. R2: antes, desliga as formas ligadas do mesmo grupo
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
  const ganhos = recursos.flatMap((recurso) => {
    const diferenca = maximoComposto(ligado, recurso).total - (maximosAntes.get(recurso) ?? 0)
    return diferenca > 0 ? [{ parte: 'recurso' as const, chave: recurso, valor: numeroDaFicha(ligado.recursos, recurso) + diferenca }] : []
  })
  const depois = ganhos.length === 0 ? ligado : aplicarAjustes(ligado, sistema, ganhos, quem, quando)
  return { personagem: depois, numeros: numerosDaForma(personagem, depois, sistema, [cartao, ...desligadas]), desligadas }
}

/** "Desfazer a forma" (ação livre): desliga o cartão; o corte do máximo já resolve o atual. `null` = não estava ligada. */
export function desfazerForma(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string, quem: string, quando: number): Personagem | null {
  if (!personagem.cartoesAtivos.includes(cartaoId)) return null
  const depois = aplicarAjustes(personagem, sistema, [{ parte: 'cartao', chave: cartaoId, valor: 0 }], quem, quando)
  return depois.cartoesAtivos.includes(cartaoId) ? null : depois
}

/** A imagem da forma para o token e o retrato: só enquanto o cartão segue ligado (R5: desligou pela ficha, a imagem volta sozinha). */
export function aparenciaDaForma(forma: FormaNaBatalha | undefined, personagem: Personagem | undefined): string | null {
  if (forma === undefined || personagem === undefined || !personagem.cartoesAtivos.includes(forma.cartaoId)) return null
  return forma.imagem
}

/**
 * Q3, no Encerrar: a forma ativada pelo menu CONTINUA ligada (a ficha manda;
 * só a imagem volta, porque `formas` some com a batalha). As linhas "Bruno
 * segue em Punho Negro", uma por personagem cuja forma segue ligada, para a
 * tela do Encerrar mostrar (o registro some junto com a batalha).
 */
export function formasQueSeguem(formas: Readonly<Record<string, FormaNaBatalha>> | undefined, personagens: readonly Personagem[]): string[] {
  if (formas === undefined) return []
  const linhas: string[] = []
  for (const [personagemId, forma] of Object.entries(formas)) {
    const personagem = personagens.find((candidato) => candidato.id === personagemId)
    const nome = nomeDaFormaLigada(forma, personagem)
    if (personagem !== undefined && nome !== null) linhas.push(`${personagem.nome} segue em ${nome}`)
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
