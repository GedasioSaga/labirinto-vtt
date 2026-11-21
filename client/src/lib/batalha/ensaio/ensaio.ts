import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from '../../../stores/batalhaFabrica'
import { NOME_DO_BONECO, fichaDoBoneco } from '../../arena/boneco'
import { passoDoBoneco } from '../../arena/reacaoDoBoneco'
import type { AjustesDoBoneco } from '../../arena/tipos'
import { cartoesDaAba, type CartaoDaFicha, type Personagem } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { aplicarSangramentos } from '../../treino/duelo'
import { criarMesaEmMemoria, montarLutadores, type EscolhaDaVaga, type LadoDoTreino, type MesaEmMemoria } from '../../treino/mesaEmMemoria'
import { danoNoTeto, seloDaMira } from '../../treino/robo'
import { criarSorteio } from '../../treino/sorteio'
import { recursoDeVida, vidaDoPersonagem } from '../../vidaDaFicha'
import { tecnicasNoMenu } from '../acoes'
import type { PedidoDeAcao, PedidoDeAlvo } from '../combate'
import { ABA_DAS_TECNICAS } from '../leituraDaFicha'
import { danoDaTecnicaComAVida } from '../leituraDaTecnica'
import { pecasDoCartao } from '../mecanica/leitura'
import { combatentesIniciais, type AutorDaAcao } from '../turnos'

/**
 * TESTAR (Fase 3 de docs/design/habilidades/SISTEMA.md §6; decisão M1 do
 * mestre: "Boneco de Treino e uma miniaba para ver o que ta acontecendo tipo
 * um preview"). Um golpe só, num Boneco de treino, pelo MESMO motor da
 * batalha (a store da fábrica sobre uma mesa em memória, como a Arena e o
 * treino do site). Nada é calculado aqui: os passos são as linhas que o motor
 * escreveu no registro e o antes e depois que ele deixou nas cópias. Não toca
 * no mapa nem nas fichas de verdade (decisão C12: peça própria, não um modo
 * da Arena).
 */

const CENA_DO_ENSAIO = 'ensaio'
const AUTOR_DO_ENSAIO: AutorDaAcao = { tipo: 'mestre' }
/** Quantos bonecos a técnica em área pega (decisão 6 das notas do protótipo). */
const BONECOS_NA_AREA = 3
/** O boneco de fábrica: vida que aguenta o golpe e mostra o número, sem Escudo, reagindo com o d20. */
const BONECO_PADRAO: AjustesDoBoneco = { infinito: false, hp: 500, escudo: 0, modificador: 0, reage: 'd20' }
/** O boneco ferido da cura: metade da vida, para a cura aparecer inteira. */
const PARTE_DO_FERIDO = 0.5
/** Teto de vezes passadas até chegar a vez de quem usa (a ordem tem no máximo 1 + `BONECOS_NA_AREA` cartas). */
const VEZES_ATE_QUEM_USA = 8
/** Teto de reações do boneco por golpe (uma por boneco, mais o segundo golpe). */
const REACOES_MAX = 8

export interface PedidoDeEnsaio {
  /** O cartão como está na tela (o rascunho, ainda sem salvar). */
  cartao: CartaoDaFicha
  /** A ficha de quem usa, como está na tela; o cartão entra (ou troca) nela, numa cópia. */
  quemUsa: Personagem
  sistema: SistemaDeRpg
  /** A semente dos d20 sorteados: a mesma semente dá o mesmo dado ("Testar de novo" troca). */
  semente: number
  /** O d20 fixo do boneco ("e se ele tirar 15?"); ausente = sorteado pela semente. */
  d20Fixo?: number
  /** "Testar com tudo cheio": a cópia de quem usa com SP, HP e cada recurso no máximo (o conserto do "SP insuficiente"). */
  recursosCheios?: boolean
}

export type TipoDoPasso = 'arrumou' | 'recusa' | 'registro' | 'recurso' | 'depois'

export interface PassoDoEnsaio {
  tipo: TipoDoPasso
  titulo: string
  texto: string
}

export interface BarraDoEnsaio {
  nome: string
  antes: number
  depois: number
  maximo: number
}

export interface ResultadoDoEnsaio {
  passos: PassoDoEnsaio[]
  /** A vida do boneco (ou de quem usa, na técnica em si), do antes ao depois. */
  barras: BarraDoEnsaio[]
  /** "Passar 1 vez do alvo": o que acontece no começo da próxima vez dele (sangramento, a condição contando). `null` = recusou antes do golpe. */
  passarUmaVez: (() => PassoDoEnsaio[]) | null
}

/** Como o boneco se arruma sozinho para mostrar o efeito (decisão 6 das notas do protótipo). */
interface Arrumacao {
  lado: LadoDoTreino
  quantos: number
  ferido: boolean
  emSi: boolean
  frase: string
}

function arrumacaoDoBoneco(cartao: CartaoDaFicha): Arrumacao {
  const pecas = pecasDoCartao(cartao)
  const quem = pecas?.alvo.quem
  const area = pecas !== null && pecas.alvo.forma.tipo !== 'um'
  const cura = pecas?.efeitos.some((efeito) => efeito.tipo === 'cura') === true
  const ajuda = quem === 'aliados' || quem === 'si'
  const quantos = area ? BONECOS_NA_AREA : 1
  const partes = [
    ajuda ? 'do lado de quem usa' : null,
    cura ? 'ferido, com metade da vida, para a cura aparecer' : null,
    area ? `${quantos} bonecos, todos dentro da área` : null,
    quem === 'si' ? 'a técnica é em quem usa' : null,
  ].filter((parte): parte is string => parte !== null)
  const frase = partes.length === 0 ? 'Boneco de treino de 500 de vida, sem Escudo, reagindo com o d20.' : `Boneco arrumado: ${partes.join('; ')}.`
  return { lado: ajuda ? 'a' : 'b', quantos, ferido: cura, emSi: quem === 'si', frase }
}

/** A ficha de quem usa com o cartão do rascunho: troca o de mesmo id, ou entra na aba Habilidades. */
function comOCartao(personagem: Personagem, cartao: CartaoDaFicha): Personagem {
  for (const [abaId, cartoes] of Object.entries(personagem.abas)) {
    if (cartoes.some((atual) => atual.id === cartao.id)) return { ...personagem, abas: { ...personagem.abas, [abaId]: cartoes.map((atual) => (atual.id === cartao.id ? cartao : atual)) } }
  }
  return { ...personagem, abas: { ...personagem.abas, [ABA_DAS_TECNICAS]: [...cartoesDaAba(personagem, ABA_DAS_TECNICAS), cartao] } }
}

/** Cada recurso do sistema que tem máximo na ficha vai ao máximo (o que não tem fica como está). */
function comRecursosCheios(personagem: Personagem, sistema: SistemaDeRpg): Personagem {
  const recursos = { ...personagem.recursos }
  for (const recurso of sistema.recursos) {
    const lido = vidaDoPersonagem(personagem, recurso)
    if (lido !== null) recursos[recurso.id] = lido.maximo
  }
  return { ...personagem, recursos }
}

function cenaDe(loja: LojaDaBatalha): BatalhaDaCena {
  const cena = loja.getState().cenas[CENA_DO_ENSAIO]
  if (cena === undefined) throw new RangeError('a mesa do ensaio não está ligada')
  return cena
}

/** HP, SP e Escudo de cada um, como a mesa guarda agora. */
function fotoDosRecursos(mesa: MesaEmMemoria): Map<string, Record<string, number>> {
  return new Map(mesa.personagens().map((personagem) => [personagem.id, { ...personagem.recursos }]))
}

/** As linhas de recurso que mudaram ("Judge: HP 500 → 461"), pela ordem dos recursos do sistema. */
function passosDosRecursos(mesa: MesaEmMemoria, sistema: SistemaDeRpg, antes: Map<string, Record<string, number>>): PassoDoEnsaio[] {
  const passos: PassoDoEnsaio[] = []
  for (const personagem of mesa.personagens()) {
    const de = antes.get(personagem.id) ?? {}
    const mudou = sistema.recursos.flatMap((recurso) => {
      const a = de[recurso.id] ?? 0
      const b = personagem.recursos[recurso.id] ?? 0
      return a === b ? [] : [`${recurso.nome} ${a} → ${b}`]
    })
    if (mudou.length > 0) passos.push({ tipo: 'recurso', titulo: personagem.nome, texto: mudou.join(', ') })
  }
  return passos
}

/** As linhas que o motor escreveu desde `desde` (o registro da batalha, palavra por palavra). */
function passosDoRegistro(loja: LojaDaBatalha, desde: number, titulo: string): PassoDoEnsaio[] {
  return cenaDe(loja)
    .registro.slice(desde)
    .map((linha) => ({ tipo: 'registro' as const, titulo, texto: linha.texto }))
}

/**
 * Roda o cartão uma vez no boneco. Nunca lança por causa da ficha: o que o
 * motor recusa vira o passo "Não saiu" com o motivo dele.
 */
export function ensaiar(pedido: PedidoDeEnsaio): ResultadoDoEnsaio {
  const { cartao, sistema } = pedido
  const arrumacao = arrumacaoDoBoneco(cartao)
  const sorteio = criarSorteio(pedido.semente)
  const vida = recursoDeVida(sistema)
  const bonecos: Personagem[] = Array.from({ length: arrumacao.quantos }, (_, i) => {
    const ficha = fichaDoBoneco(sistema, BONECO_PADRAO, `ensaio-boneco-${i + 1}`)
    const nome = arrumacao.quantos === 1 ? `${NOME_DO_BONECO} (boneco de treino)` : `${NOME_DO_BONECO} ${i + 1}`
    if (!arrumacao.ferido || vida === null) return { ...ficha, nome }
    return { ...ficha, nome, recursos: { ...ficha.recursos, [vida.id]: Math.round(BONECO_PADRAO.hp * PARTE_DO_FERIDO) } }
  })
  const copia: Personagem = { ...comOCartao(pedido.quemUsa, cartao), id: 'ensaio-quem-usa' }
  const quemUsa = pedido.recursosCheios === true ? comRecursosCheios(copia, sistema) : copia
  // A mesa pede os dois lados: na ajuda os bonecos ficam com quem usa, e um boneco adversário (fora do alvo) fecha o outro lado.
  const adversario: Personagem[] = arrumacao.lado === 'a' ? [{ ...fichaDoBoneco(sistema, BONECO_PADRAO, 'ensaio-boneco-adversario'), nome: `${NOME_DO_BONECO} (adversário)` }] : []
  const escolhas: EscolhaDaVaga[] = [
    { ficha: quemUsa, lado: 'a' },
    ...bonecos.map((ficha) => ({ ficha, lado: arrumacao.lado })),
    ...adversario.map((ficha) => ({ ficha, lado: 'b' as const })),
  ]
  const arrumou: PassoDoEnsaio = { tipo: 'arrumou', titulo: 'Boneco', texto: arrumacao.frase }
  const montagem = montarLutadores(escolhas)
  if (!montagem.ok) return { passos: [arrumou, { tipo: 'recusa', titulo: 'Não saiu', texto: `A mesa do teste não montou (${montagem.motivo}).` }], barras: [], passarUmaVez: null }

  const mesa = criarMesaEmMemoria(sistema, montagem.lutadores)
  // O d20 fixo vale só enquanto o boneco reage; a ordem da vez e o resto do motor seguem a semente.
  let naReacao = false
  const rolarD20 = (): number => (naReacao && pedido.d20Fixo !== undefined ? pedido.d20Fixo : sorteio.d20())
  const loja = criarBatalhaStore(mesa, { rolarD20, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA_DO_ENSAIO, {}, { combatentes, regras: null, desempate: 'd20' })

  const vagaDeQuemUsa = mesa.vagas().find((vaga) => vaga.lado === 'a' && !vaga.personagemId.startsWith('ensaio-boneco'))
  // Os bonecos que o golpe pega: todos menos quem usa e o adversário que só fecha o outro lado.
  const vagasDosBonecos = mesa.vagas().filter((vaga) => vaga !== vagaDeQuemUsa && !vaga.personagemId.startsWith('ensaio-boneco-adversario'))
  if (vagaDeQuemUsa === undefined) return { passos: [arrumou, { tipo: 'recusa', titulo: 'Não saiu', texto: 'A cópia de quem usa não entrou na mesa do teste.' }], barras: [], passarUmaVez: null }

  // Os outros passam até a vez de quem usa (o teste é o golpe, não a ordem).
  for (let i = 0; i < VEZES_ATE_QUEM_USA; i += 1) {
    const turnos = cenaDe(loja).turnos
    const carta = turnos.cartas.find((atual) => atual.id === turnos.vez)
    if (carta === undefined || carta.tokenId === vagaDeQuemUsa.tokenId) break
    loja.getState().passarVez(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, { cartaId: carta.id, rodada: turnos.rodada })
  }

  const turnos = cenaDe(loja).turnos
  const naMesa = mesa.personagens().find((personagem) => personagem.id === vagaDeQuemUsa.personagemId)
  const tecnica = naMesa === undefined ? undefined : tecnicasNoMenu(naMesa, sistema, turnos.combate?.[naMesa.id], null, null).find((atual) => atual.cartao.id === cartao.id)
  if (naMesa === undefined || tecnica === undefined) {
    return { passos: [arrumou, { tipo: 'recusa', titulo: 'Não saiu', texto: 'A técnica não aparece no menu da vez (passiva, invocação ou aba que a batalha não lê).' }], barras: [], passarUmaVez: null }
  }
  // O motivo é o mesmo que o menu da vez mostra (SP insuficiente, recarga, passiva).
  if (tecnica.motivo !== null) return { passos: [arrumou, { tipo: 'recusa', titulo: 'Não saiu', texto: tecnica.motivo }], barras: [], passarUmaVez: null }
  if (turnos.vez === null) return { passos: [arrumou, { tipo: 'recusa', titulo: 'Não saiu', texto: 'A mesa do teste não chegou à vez de quem usa.' }], barras: [], passarUmaVez: null }

  const alvosTokens = arrumacao.emSi ? [vagaDeQuemUsa.tokenId] : vagasDosBonecos.map((vaga) => vaga.tokenId)
  const alvos: PedidoDeAlvo[] = alvosTokens.map((tokenId) => {
    const alvo = mesa.personagens().find((personagem) => mesa.vagas().some((vaga) => vaga.tokenId === tokenId && vaga.personagemId === personagem.id))
    const vidaDoAlvo = alvo === undefined || vida === null ? null : vidaDoPersonagem(alvo, vida)
    const lido = tecnica.dano.tipo === 'precisaAlvo' && vidaDoAlvo !== null ? danoDaTecnicaComAVida(tecnica.cartao, { personagem: naMesa, sistema, arma: null }, vidaDoAlvo) : tecnica.dano
    return { tokenId, dano: lido.tipo === 'valor' ? danoNoTeto(lido.valor) : null }
  })
  const selo = seloDaMira(tecnica.cartao, sistema)
  const golpe: PedidoDeAcao = {
    tipo: 'habilidade',
    cartaoId: cartao.id,
    armaId: null,
    alvos,
    surpresa: false,
    perfurante: tecnica.perfurante,
    custo: null,
    acao: tecnica.acao === 'passiva' ? null : tecnica.acao,
    ...(selo === null ? {} : { selo }),
  }

  const antes = fotoDosRecursos(mesa)
  const vidaAntes = new Map(mesa.personagens().map((personagem) => [personagem.id, vida === null ? null : vidaDoPersonagem(personagem, vida)]))
  const desde = cenaDe(loja).registro.length
  const esperado = { cartaId: turnos.vez, rodada: turnos.rodada }
  if (!loja.getState().agir(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, esperado, golpe)) {
    return { passos: [arrumou, { tipo: 'recusa', titulo: 'Não saiu', texto: 'A batalha recusou o golpe (ação, alvo ou custo que a mira pediria à mão).' }], barras: [], passarUmaVez: null }
  }

  // O boneco reage como na Arena: o d20 (o fixo, se o mestre pediu) mais o modificador dele.
  for (let i = 0; i < REACOES_MAX; i += 1) {
    const agora = cenaDe(loja).turnos
    const passo = vagasDosBonecos.map((vaga) => passoDoBoneco(agora, vaga.tokenId, 'd20', BONECO_PADRAO.modificador, new Set())).find((achado) => achado?.tipo === 'reagir')
    if (passo === undefined || passo === null || passo.tipo !== 'reagir') break
    naReacao = true
    const aceita = loja.getState().reagir(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, passo.pedido)
    naReacao = false
    if (!aceita) break
  }

  const passos: PassoDoEnsaio[] = [arrumou, ...passosDoRegistro(loja, desde, 'Na batalha'), ...passosDosRecursos(mesa, sistema, antes)]
  const tempo = tecnica.tempo
  if (tempo.tipo === 'recarga') passos.push({ tipo: 'depois', titulo: 'Depois', texto: `Recarga de ${tempo.turnos} ${tempo.turnos === 1 ? 'vez' : 'vezes'}.` })
  else if (tempo.tipo === 'usos') passos.push({ tipo: 'depois', titulo: 'Depois', texto: `${tempo.vezes} ${tempo.vezes === 1 ? 'uso' : 'usos'} por batalha.` })

  const barras: BarraDoEnsaio[] =
    vida === null
      ? []
      : mesa
          .personagens()
          .filter((personagem) => alvosTokens.some((tokenId) => mesa.vagas().some((vaga) => vaga.tokenId === tokenId && vaga.personagemId === personagem.id)))
          .flatMap((personagem) => {
            const agora = vidaDoPersonagem(personagem, vida)
            const antesDoGolpe = vidaAntes.get(personagem.id)
            // Ficha sem vida no sistema (máximo 0): não há barra para mostrar.
            if (agora === null || antesDoGolpe === undefined || antesDoGolpe === null) return []
            return [{ nome: personagem.nome, antes: antesDoGolpe.atual, depois: agora.atual, maximo: agora.maximo }]
          })

  /** A vez de quem usa acaba e começa a do primeiro boneco: o sangramento é aplicado, a condição conta. */
  const passarUmaVez = (): PassoDoEnsaio[] => {
    const fotoAntes = fotoDosRecursos(mesa)
    const inicio = cenaDe(loja).registro.length
    const vez = cenaDe(loja).turnos
    if (vez.vez !== null) loja.getState().passarVez(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, { cartaId: vez.vez, rodada: vez.rodada })
    aplicarSangramentos(loja, CENA_DO_ENSAIO)
    const depois = [...passosDoRegistro(loja, inicio, 'Na vez do alvo'), ...passosDosRecursos(mesa, sistema, fotoAntes)]
    return depois.length > 0 ? depois : [{ tipo: 'registro', titulo: 'Na vez do alvo', texto: 'Nada acontece no começo da vez dele.' }]
  }
  return { passos, barras, passarUmaVez }
}
