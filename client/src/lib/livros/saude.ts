import { CAMPO_DO_DANO, lerDano, normalizar, type ContextoDaFormula } from '../batalha/formula'
import {
  ABA_DAS_TECNICAS,
  CAMPO_DA_ACAO,
  CAMPO_DO_CUSTO,
  CAMPO_DO_TEMPO,
  armasDe,
  lerAcao,
  lerCusto,
  lerTempo,
  recursoDoCusto,
  type LeituraDaAcao,
} from '../batalha/leituraDaFicha'
import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { ehVariacao } from './combate'

/**
 * SAÚDE DA FICHA do mundo do livro de regras (M2,
 * docs/planos/livros-de-regras-plano.md, seção M2): o quanto da ficha a
 * batalha automática consegue ler. Não há leitor novo: é um mapeamento puro
 * dos leitores da F2 (`lerCusto`, `lerAcao`, `lerTempo` em
 * lib/batalha/leituraDaFicha.ts e `lerDano` em lib/batalha/formula.ts) para
 * Lido / Lê na hora / Não lê / À mão. Puro: sem store, sem disco, sem rede.
 */

/** Os 4 medidores, na ordem da tela. */
export type CampoDaSaude = 'custo' | 'dano' | 'acao' | 'tempo'
export const CAMPOS_DA_SAUDE: readonly CampoDaSaude[] = ['custo', 'dano', 'acao', 'tempo']
export const ROTULO_DO_CAMPO: Readonly<Record<CampoDaSaude, string>> = { custo: 'Custo', dano: 'Dano', acao: 'Ação', tempo: 'Tempo' }
/** O campo do cartão (`CartaoDaFicha.campos`) de cada medidor: o que o "Corrigir" grava (`corrigirCampo`). */
export const CAMPO_DO_CARTAO: Readonly<Record<CampoDaSaude, string>> = { custo: CAMPO_DO_CUSTO, dano: CAMPO_DO_DANO, acao: CAMPO_DA_ACAO, tempo: CAMPO_DO_TEMPO }

/**
 * Como um campo foi lido:
 *  - `lido`: a batalha usa o número sozinha;
 *  - `naHora`: lê na batalha com o que só existe lá (arma escolhida, vida do
 *    alvo, custo em % que a pessoa confirma);
 *  - `naoLe`: a batalha pergunta ou ignora — é o que a Saúde lista;
 *  - `aMao`: golpe marcado À mão (`CartaoDaFicha.aMao`): cinza, fora da
 *    porcentagem (decisão 6).
 * Campo vazio (custo "nada", dano "-" de suporte) não é estado: fica fora.
 */
export type EstadoDaLeitura = 'lido' | 'naHora' | 'naoLe' | 'aMao'

export const ROTULO_DO_ESTADO: Readonly<Record<EstadoDaLeitura, string>> = { lido: 'Lido', naHora: 'Lê na hora', naoLe: 'Não lê', aMao: 'À mão' }

/** A leitura de UM campo de um cartão. */
export interface LeituraDoCampo {
  estado: EstadoDaLeitura
  /** O que o app entendeu ("35 SP", "Ação Bônus", a conta do dano) ou vazio quando não lê. */
  leitura: string
  /** A frase do porquê ("Dado (2d6) não entra na conta: o app não rola por você."); vazia quando é Lido. */
  motivo: string
}

/** O Dano lido de um cartão, com o número quando há (o Comparar e o encontro usam o MESMO mapeamento). */
export interface DanoDoCartao extends LeituraDoCampo {
  /** Com a força; Lê na hora com arma usa a primeira arma da ficha. `null` = não há número. */
  valor: number | null
}

/** Uma linha da lista da Saúde: um campo de um cartão que não é Lido. */
export interface AchadoDaSaude {
  personagemId: string
  /** O cartão (técnica, ou técnica dentro de transformação). */
  cartaoId: string
  nomeDoCartao: string
  /** Vem de transformação: o nome da forma. */
  forma?: string
  campo: CampoDaSaude
  /** O texto da ficha, como está. */
  texto: string
  leitura: LeituraDoCampo
}

export interface ContagemDaSaude {
  lido: number
  naHora: number
  naoLe: number
  aMao: number
}

export interface SaudeDasFichas {
  contagem: Readonly<Record<CampoDaSaude, ContagemDaSaude>>
  /** 0 a 100, inteiro (`porcentagemDaSaude`). */
  porcentagem: Readonly<Record<CampoDaSaude, number>>
  /** O que a tela lista: `naHora` e `naoLe`, na ordem das fichas, dos cartões e dos medidores. */
  achados: AchadoDaSaude[]
}

/** "2d6", "d20", "1D8": o dado que a conta não rola. */
const DADO_NO_TEXTO = /(\d*) ?d(\d+)\b/
/** O mesmo teto de `FORMULA_MAX` (lib/batalha/formula.ts): mais que isto é descrição, não conta. */
const DANO_COMPRIDO = 200

const NOME_DA_ACAO: Readonly<Record<NonNullable<LeituraDaAcao['acao']>, string>> = {
  simples: 'Ação Simples',
  completa: 'Ação Completa',
  bonus: 'Ação Bônus',
  livre: 'Ação Livre',
  passiva: 'Passiva',
}

function vazio(texto: string): boolean {
  const normal = normalizar(texto)
  return normal.length === 0 || normal === '-'
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

function nomeDoRecurso(sistema: SistemaDeRpg, recurso: 'sp' | 'hp'): string {
  return recursoDoCusto(sistema, recurso)?.nome ?? recurso.toUpperCase()
}

function lerCampoDoCusto(texto: string, personagem: Personagem, sistema: SistemaDeRpg): LeituraDoCampo | null {
  const custo = lerCusto(texto, personagem)
  if (custo.tipo === 'nada') return null
  const recurso = nomeDoRecurso(sistema, custo.recurso)
  if (custo.tipo === 'valor') return { estado: 'lido', leitura: `${custo.valor} ${recurso}${custo.porTurno ? ' por turno' : ''}`, motivo: '' }
  if (custo.sugestao !== null) {
    return { estado: 'naHora', leitura: `${custo.sugestao} ${recurso} agora`, motivo: 'É porcentagem: o app sugere o valor na hora e você confirma.' }
  }
  return { estado: 'naoLe', leitura: '', motivo: 'O app vai perguntar o custo toda vez que a técnica for usada.' }
}

function lerCampoDaAcao(texto: string): LeituraDoCampo | null {
  if (vazio(texto)) return null
  const acao = lerAcao(texto)
  if (acao.acao === null) {
    return { estado: 'naoLe', leitura: '', motivo: 'Tipo de ação desconhecido. O app entende Simples, Bônus, Completa, Livre, Reação, OVERLOAD, Transformação e Passiva.' }
  }
  const partes = [NOME_DA_ACAO[acao.acao]]
  if (acao.tambemReacao) partes.push('Reação')
  if (acao.overload) partes.push('OVERLOAD')
  if (acao.transformacao) partes.push('Transformação')
  return { estado: 'lido', leitura: partes.join(' + '), motivo: '' }
}

function lerCampoDoTempo(texto: string): LeituraDoCampo | null {
  if (vazio(texto)) return null
  const tempo = lerTempo(texto)
  switch (tempo.tipo) {
    case 'livre':
      return { estado: 'lido', leitura: 'Sem recarga', motivo: '' }
    case 'recarga':
      return { estado: 'lido', leitura: `Recarga de ${plural(tempo.turnos, 'turno', 'turnos')}`, motivo: '' }
    case 'usos':
      return { estado: 'lido', leitura: `${plural(tempo.vezes, 'vez', 'vezes')} por combate`, motivo: '' }
    case 'overload':
      return { estado: 'lido', leitura: 'OVERLOAD', motivo: '' }
    case 'texto':
      return { estado: 'naoLe', leitura: '', motivo: 'Fica como texto: o app não conta a recarga sozinho. Ele entende "3 turnos", "2 vezes por combate" e OVERLOAD.' }
  }
}

function motivoDoNaoEntende(texto: string): string {
  const normal = normalizar(texto)
  const dado = DADO_NO_TEXTO.exec(normal)
  // Os dois grupos sempre casam quando o regex casa (o 1º pode ser vazio: "d20").
  if (dado !== null) return `Dado (${dado[1]}d${dado[2]}) não entra na conta: o app não rola por você.`
  if (normal.length > DANO_COMPRIDO) return 'Texto comprido demais para ser conta: parece descrição.'
  return 'O app não entende esta conta. Ele lê números, atributos (Força, FOR), "Dano da arma" e "% da vida do alvo".'
}

/**
 * O Dano do cartão pelos funis da batalha (`lerDano`, já com a força). Valor
 * = Lido; "Dano da arma" = Lê na hora (o número sai com a PRIMEIRA arma da
 * ficha, como no detalhe do NPC; sem arma, sem número); "% da vida do alvo" =
 * Lê na hora sem número; o resto com texto = Não lê, salvo `aMao` (À mão,
 * mesmo com o texto ainda lá: o "Deixar à mão" do dado não apaga o "2d6").
 * `null` = fora: "-" (suporte) ou vazio sem `aMao`.
 */
export function lerDanoDoCartao(texto: string, cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg): DanoDoCartao | null {
  const ctx: ContextoDaFormula = { personagem, sistema, arma: null, vidaDoAlvo: null }
  const lido = lerDano(texto, ctx)
  switch (lido.tipo) {
    case 'semDano':
      return null
    case 'valor':
      return { estado: 'lido', leitura: lido.conta, motivo: lido.aviso ?? '', valor: lido.valor }
    case 'precisaArma': {
      const arma = armasDe(personagem)[0]
      if (arma === undefined) return { estado: 'naHora', leitura: lido.conta, motivo: 'Pede o "Dano da arma" e a ficha não tem arma na aba Armas.', valor: null }
      const comArma = lerDano(texto, { ...ctx, arma })
      const motivo = 'Usa a arma escolhida na hora do golpe.'
      return comArma.tipo === 'valor'
        ? { estado: 'naHora', leitura: `${comArma.conta} (com ${arma.nome})`, motivo: comArma.aviso === undefined ? motivo : `${motivo} ${comArma.aviso}`, valor: comArma.valor }
        : { estado: 'naHora', leitura: lido.conta, motivo, valor: null }
    }
    case 'precisaAlvo':
      return { estado: 'naHora', leitura: '% da vida do alvo', motivo: 'Lê só quando quem usa vê a vida do alvo: o mestre vê; o jogador, contra NPC, digita o número.', valor: null }
    case 'naoEntende':
      if (cartao.aMao === true) return { estado: 'aMao', leitura: '', motivo: 'À mão de propósito: na batalha você digita o número.', valor: null }
      if (texto.trim().length === 0) return null
      return { estado: 'naoLe', leitura: '', motivo: motivoDoNaoEntende(texto), valor: null }
  }
}

/**
 * A releitura ao vivo do "Corrigir": o campo com o texto que está sendo
 * digitado. `null` = vazio (fica fora da conta). Custo: nada = `null`, valor
 * = Lido, pergunta com sugestão = Lê na hora, sem sugestão = Não lê. Ação:
 * ação nula com texto = Não lê. Tempo: texto = Não lê. Dano: ver
 * `lerDanoDoCartao`.
 */
export function lerCampo(campo: CampoDaSaude, texto: string, cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg): LeituraDoCampo | null {
  switch (campo) {
    case 'custo':
      return lerCampoDoCusto(texto, personagem, sistema)
    case 'acao':
      return lerCampoDaAcao(texto)
    case 'tempo':
      return lerCampoDoTempo(texto)
    case 'dano': {
      const dano = lerDanoDoCartao(texto, cartao, personagem, sistema)
      return dano === null ? null : { estado: dano.estado, leitura: dano.leitura, motivo: dano.motivo }
    }
  }
}

/** (Lido + Lê na hora) / (Lido + Lê na hora + Não lê), inteiro de 0 a 100; À mão fica fora; nada contado = 100. */
export function porcentagemDaSaude(contagem: ContagemDaSaude): number {
  const lidos = contagem.lido + contagem.naHora
  const total = lidos + contagem.naoLe
  return total === 0 ? 100 : Math.round((lidos * 100) / total)
}

/** Uma técnica da ficha para a Saúde e, se vem de transformação, a forma. */
interface TecnicaDaSaude {
  cartao: CartaoDaFicha
  forma?: string
}

/** As técnicas da FICHA: Habilidades e as de dentro de todas as transformações, ligadas ou não. */
function tecnicasDaFicha(personagem: Personagem, sistema: SistemaDeRpg): TecnicaDaSaude[] {
  const tecnicas: TecnicaDaSaude[] = (personagem.abas[ABA_DAS_TECNICAS] ?? []).map((cartao) => ({ cartao }))
  for (const aba of sistema.abas) {
    if (aba.subcartoes?.aba !== ABA_DAS_TECNICAS) continue
    for (const forma of personagem.abas[aba.id] ?? []) {
      for (const cartao of forma.subcartoes) tecnicas.push({ cartao, forma: forma.nome })
    }
  }
  return tecnicas
}

/**
 * Lê a saúde de todas as fichas. Variação não conta (herda do modelo:
 * corrigir no modelo propaga; `ehVariacao`, lib/livros/combate.ts). Lê as
 * técnicas de Habilidades e as de dentro de TODAS as transformações (ligadas
 * ou não: a saúde é da ficha, não do momento).
 */
export function lerSaude(personagens: readonly Personagem[], sistema: SistemaDeRpg): SaudeDasFichas {
  const zero = (): ContagemDaSaude => ({ lido: 0, naHora: 0, naoLe: 0, aMao: 0 })
  const contagem: Record<CampoDaSaude, ContagemDaSaude> = { custo: zero(), dano: zero(), acao: zero(), tempo: zero() }
  const achados: AchadoDaSaude[] = []
  for (const personagem of personagens) {
    if (ehVariacao(personagem)) continue
    for (const { cartao, forma } of tecnicasDaFicha(personagem, sistema)) {
      for (const campo of CAMPOS_DA_SAUDE) {
        const texto = cartao.campos[CAMPO_DO_CARTAO[campo]] ?? ''
        const leitura = lerCampo(campo, texto, cartao, personagem, sistema)
        if (leitura === null) continue
        contagem[campo][leitura.estado] += 1
        if (leitura.estado !== 'naHora' && leitura.estado !== 'naoLe') continue
        const achado: AchadoDaSaude = { personagemId: personagem.id, cartaoId: cartao.id, nomeDoCartao: cartao.nome, campo, texto, leitura }
        if (forma !== undefined) achado.forma = forma
        achados.push(achado)
      }
    }
  }
  return {
    contagem,
    porcentagem: {
      custo: porcentagemDaSaude(contagem.custo),
      dano: porcentagemDaSaude(contagem.dano),
      acao: porcentagemDaSaude(contagem.acao),
      tempo: porcentagemDaSaude(contagem.tempo),
    },
    achados,
  }
}

/** Troca o cartão `cartaoId` na lista (ou dentro de um cartão dela). A MESMA lista quando nada mudou. */
function mudarNaLista(cartoes: CartaoDaFicha[], cartaoId: string, mudar: (cartao: CartaoDaFicha) => CartaoDaFicha): CartaoDaFicha[] {
  let mudou = false
  const nova = cartoes.map((cartao) => {
    const trocado = cartao.id === cartaoId ? mudar(cartao) : cartao
    const subcartoes = mudarNaLista(trocado.subcartoes, cartaoId, mudar)
    const final = subcartoes === trocado.subcartoes ? trocado : { ...trocado, subcartoes }
    if (final !== cartao) mudou = true
    return final
  })
  return mudou ? nova : cartoes
}

/**
 * O personagem com o cartão `cartaoId` trocado por `mudar` (procura também
 * dentro das transformações, em todas as abas). Cartão que não existe, ou
 * `mudar` que devolve o mesmo cartão: a MESMA referência. Funil das escritas
 * da Saúde (Corrigir, Deixar à mão, sugestões).
 */
export function mudarCartao(personagem: Personagem, cartaoId: string, mudar: (cartao: CartaoDaFicha) => CartaoDaFicha): Personagem {
  let mudou = false
  const abas: Record<string, CartaoDaFicha[]> = {}
  for (const [abaId, cartoes] of Object.entries(personagem.abas)) {
    const nova = mudarNaLista(cartoes, cartaoId, mudar)
    if (nova !== cartoes) mudou = true
    abas[abaId] = nova
  }
  return mudou ? { ...personagem, abas } : personagem
}

/** "Corrigir": o campo do cartão com o texto novo. Texto igual: a mesma referência. */
export function corrigirCampo(personagem: Personagem, cartaoId: string, campoId: string, texto: string): Personagem {
  return mudarCartao(personagem, cartaoId, (cartao) => (cartao.campos[campoId] === texto ? cartao : { ...cartao, campos: { ...cartao.campos, [campoId]: texto } }))
}

/** "Deixar à mão" (`sim`) ou desfazer: liga ou tira `aMao` do cartão. */
export function deixarAMao(personagem: Personagem, cartaoId: string, sim: boolean): Personagem {
  return mudarCartao(personagem, cartaoId, (cartao) => {
    if (sim) return cartao.aMao === true ? cartao : { ...cartao, aMao: true }
    if (cartao.aMao === undefined) return cartao
    const { aMao: _marca, ...semMarca } = cartao
    return semMarca
  })
}
