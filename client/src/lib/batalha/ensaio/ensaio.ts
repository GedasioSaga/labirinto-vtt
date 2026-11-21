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
import type { PedidoDeAcao, PedidoDeAlvo, PedidoDeReacao, SaidaDaReacao, SaidaDaTecnica, SeloPedido } from '../combate'
import type { QuaisSelosTira } from '../debuffs'
import { normalizar } from '../formula'
import { ABA_DAS_TECNICAS, armasDe, recursoDoCusto, type LeituraDoTempo } from '../leituraDaFicha'
import { armaPadraoEntre } from '../mecanica/arma'
import { danoDaTecnicaComAVida } from '../leituraDaTecnica'
import { pecasDoCartao } from '../mecanica/leitura'
import { mecanicaDoCartao } from '../mecanicasAMao'
import { reacoesParaOAlvo, type ReacaoComTecnica } from '../reacaoComTecnica'
import { selosDoToken, textoDoSeloComMods } from '../selos'
import { lerTipo } from '../tiposDaHabilidade'
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
/** Fase 5 (B13): o Escudo do boneco quando a técnica perfura em parte (o aceite: 100 de dano contra 80 de Escudo). */
const ESCUDO_PARA_A_PERFURACAO = 80
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
  /** Fase 4: a técnica que também reage é testada NA REAÇÃO (o boneco bate, ela defende); a só de reação vai sempre por ela. */
  naReacao?: boolean
}

export type TipoDoPasso = 'arrumou' | 'recusa' | 'formula' | 'reacao' | 'registro' | 'recurso' | 'depois'

/** O conserto de um clique de uma recusa (decisão 8 das notas do protótipo); ausente = a recusa é a regra, sem conserto. */
export type ConsertoDoEnsaio = 'encherRecursos'

export interface PassoDoEnsaio {
  tipo: TipoDoPasso
  titulo: string
  texto: string
  /** O d20 que o motor rolou neste passo (a miniaba mostra o dado). */
  dado?: number
  conserto?: ConsertoDoEnsaio
}

/** Como a saída da reação do boneco se lê no passo "Reação". */
const SAIDA_NO_PASSO: Readonly<Record<SaidaDaReacao, string>> = {
  critico: 'crítico (o 1 natural: toma 1,5 vez)',
  cheio: 'toma inteiro',
  metade: 'defende (metade)',
  esquiva: 'esquiva (nada)',
  contra: 'contra-ataca',
  naoReagiu: 'não reage',
  passou: 'passa (toma inteiro)',
  semReacao: 'sem reação',
}

/** A recusa que o "Testar com SP e HP cheios" conserta: falta de recurso na cópia (a frase de `motivoDaTecnica`). */
function recusa(texto: string): PassoDoEnsaio {
  const passo: PassoDoEnsaio = { tipo: 'recusa', titulo: 'Não saiu', texto }
  if (/ insuficiente: custa /.test(texto)) passo.conserto = 'encherRecursos'
  return passo
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
  /** O selo que a técnica pede no alvo (a redoma da Florescer): o boneco já começa com ele; `null` = nenhum. */
  seloPedido: string | null
  /** Fase 5: os selos com que o boneco começa para a limpeza mostrar o que tira e o que deixa ("Tira Envenenado" deixa o Sangrando). */
  selosParaTirar: readonly SeloPedido[]
  /** Fase 5: a cura de SP (o Tônico) pede o SP pela metade, senão não mostra nada. */
  spPelaMetade: boolean
  /** Fase 5 (B13): o Escudo com que o boneco começa (a perfuração parcial só aparece com Escudo); 0 = sem. */
  escudo: number
  frase: string
}

/** Fase 5: o Buff que o boneco leva para a limpeza das positivas mostrar o que tira. */
const BUFF_DO_BONECO: SeloPedido = { nome: 'Fortalecido', turnos: 3, mods: [{ alvo: 'forca', delta: 10 }] }
/** Fase 5: a condição que o antídoto deixa (ela não está na lista dele). */
const CONDICAO_QUE_FICA: SeloPedido = { nome: 'Sangrando', turnos: 3 }

/** Fase 5: os selos que o boneco leva para a limpeza da montada (pelo nome, as positivas ou todas); a de sempre (os negativos) não muda. */
function selosParaALimpeza(tira: QuaisSelosTira | undefined): SeloPedido[] {
  if (tira === undefined) return []
  if (tira === 'positivos' || tira === 'todos') return [BUFF_DO_BONECO, CONDICAO_QUE_FICA]
  const nomes = tira.nomes.map((nome): SeloPedido => ({ nome, turnos: 3 }))
  const ficaDeFora = tira.nomes.some((nome) => normalizar(nome).trim() === normalizar(CONDICAO_QUE_FICA.nome).trim()) ? { nome: 'Atordoado', turnos: 1 } : CONDICAO_QUE_FICA
  return [...nomes, ficaDeFora]
}

function arrumacaoDoBoneco(cartao: CartaoDaFicha): Arrumacao {
  const pecas = pecasDoCartao(cartao)
  // A linha que o motor lê: a das peças, ou a da tabela à mão (a cura da Revigorar e da Medicina mora nela).
  const linha = mecanicaDoCartao(cartao)
  const quem = pecas?.alvo.quem
  const forma = pecas?.alvo.forma
  const area = forma !== undefined && forma.tipo !== 'um'
  // Fase 5: a regeneração por vez também pede o boneco ferido (cheio, ela não mostra nada).
  const regenera = (pecas?.efeitos ?? []).some((efeito) => efeito.tipo === 'selo' && efeito.porTurno?.sinal === 'da' && efeito.porTurno.recurso === 'hp')
  const cura = (linha?.limpa !== undefined && linha.limpa.cura !== '0') || regenera
  // Cura e limpeza só valem em quem usa ou num aliado (`motivoDoAlvoDasPecas`): o boneco fica do lado de quem usa.
  const ajuda = quem === 'aliados' || quem === 'si' || (pecas === null && linha?.limpa !== undefined)
  // "Vários" tem teto de alvos (a Bolha do Tree: 2): nenhum boneco a mais que o teto.
  const quantos = forma === undefined || !area ? 1 : forma.tipo === 'varios' ? Math.min(BONECOS_NA_AREA, forma.max) : BONECOS_NA_AREA
  const seloPedido = linha?.soContraOSelo?.nome ?? null
  const selosParaTirar = selosParaALimpeza(linha?.limpa?.tira)
  const spPelaMetade = linha?.limpa?.recurso === 'sp'
  const escudo = linha?.perfuracao !== undefined && !ajuda ? ESCUDO_PARA_A_PERFURACAO : 0
  const partes = [
    ajuda ? 'do lado de quem usa' : null,
    cura && !spPelaMetade ? 'ferido, com metade da vida, para a cura aparecer' : null,
    spPelaMetade ? 'com metade do SP, para a recuperação aparecer' : null,
    escudo > 0 ? `com ${escudo} de Escudo, para a perfuração aparecer` : null,
    area ? `${quantos} bonecos, todos dentro da área` : null,
    quem === 'si' ? 'a técnica é em quem usa' : null,
    seloPedido === null ? null : `já com ${seloPedido}, que a técnica pede`,
    selosParaTirar.length === 0 ? null : `já com ${selosParaTirar.map((selo) => selo.nome).join(', ')}, para ver o que sai e o que fica`,
  ].filter((parte): parte is string => parte !== null)
  const frase = partes.length === 0 ? 'Boneco de treino de 500 de vida, sem Escudo, reagindo com o d20.' : `Boneco arrumado: ${partes.join('; ')}.`
  return { lado: ajuda ? 'a' : 'b', quantos, ferido: cura && !spPelaMetade, emSi: quem === 'si', seloPedido, selosParaTirar, spPelaMetade, escudo, frase }
}

/** A ficha de quem usa com o cartão do rascunho: troca o de mesmo id, ou entra na aba Habilidades. */
function comOCartao(personagem: Personagem, cartao: CartaoDaFicha): Personagem {
  for (const [abaId, cartoes] of Object.entries(personagem.abas)) {
    if (cartoes.some((atual) => atual.id === cartao.id)) return { ...personagem, abas: { ...personagem.abas, [abaId]: cartoes.map((atual) => (atual.id === cartao.id ? cartao : atual)) } }
  }
  return { ...personagem, abas: { ...personagem.abas, [ABA_DAS_TECNICAS]: [...cartoesDaAba(personagem, ABA_DAS_TECNICAS), cartao] } }
}

/** Fase 5: o SP pela metade do máximo (a ficha sem máximo de SP fica como está). */
function comMetadeDoSp(personagem: Personagem, sistema: SistemaDeRpg): Personagem {
  const sp = recursoDoCusto(sistema, 'sp')
  const lido = sp === null ? null : vidaDoPersonagem(personagem, sp)
  if (sp === null || lido === null) return personagem
  return { ...personagem, recursos: { ...personagem.recursos, [sp.id]: Math.floor(lido.maximo * PARTE_DO_FERIDO) } }
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


type VagaDoEnsaio = ReturnType<MesaEmMemoria['vagas']>[number]

/** A mesa do teste montada e ligada, na vez de quem usa. */
interface MesaDoEnsaio {
  mesa: MesaEmMemoria
  loja: LojaDaBatalha
  vagaDeQuemUsa: VagaDoEnsaio
  /** Os bonecos que o golpe pega (o adversário que só fecha o outro lado fica fora). */
  vagasDosBonecos: VagaDoEnsaio[]
  /** Liga o d20 fixo do mestre: vale só enquanto o boneco reage. */
  naReacao: (sim: boolean) => void
  /** O último d20 rolado enquanto `naReacao` (o da técnica que rola, no teste da reação); `null` = nenhum. */
  dadoDaReacao: () => number | null
}

/** Pela origem: a mesa em memória troca os ids das cópias (`treino_a1`), a origem guarda o da ficha. */
const ORIGEM_DE_QUEM_USA = 'ensaio-quem-usa'
const ORIGEM_DO_ADVERSARIO = 'ensaio-boneco-adversario'

/** Monta as cópias, liga a batalha e passa as vezes até a de quem usa; uma frase = não montou. */
function montarMesa(pedido: PedidoDeEnsaio, arrumacao: Arrumacao, vezDe: 'quemUsa' | 'boneco' = 'quemUsa'): MesaDoEnsaio | string {
  const { cartao, sistema } = pedido
  const sorteio = criarSorteio(pedido.semente)
  const vida = recursoDeVida(sistema)
  const bonecos: Personagem[] = Array.from({ length: arrumacao.quantos }, (_, i) => {
    const ficha = fichaDoBoneco(sistema, arrumacao.escudo > 0 ? { ...BONECO_PADRAO, escudo: arrumacao.escudo } : BONECO_PADRAO, `ensaio-boneco-${i + 1}`)
    const nome = arrumacao.quantos === 1 ? `${NOME_DO_BONECO} (boneco de treino)` : `${NOME_DO_BONECO} ${i + 1}`
    if (arrumacao.spPelaMetade) return comMetadeDoSp({ ...ficha, nome }, sistema)
    if (!arrumacao.ferido || vida === null) return { ...ficha, nome }
    return { ...ficha, nome, recursos: { ...ficha.recursos, [vida.id]: Math.round(BONECO_PADRAO.hp * PARTE_DO_FERIDO) } }
  })
  const copia: Personagem = { ...comOCartao(pedido.quemUsa, cartao), id: ORIGEM_DE_QUEM_USA }
  const cheia = pedido.recursosCheios === true ? comRecursosCheios(copia, sistema) : copia
  const quemUsa = arrumacao.spPelaMetade && arrumacao.emSi ? comMetadeDoSp(cheia, sistema) : cheia
  // A mesa pede os dois lados: na ajuda os bonecos ficam com quem usa, e um boneco adversário (fora do alvo) fecha o outro lado.
  const adversario: Personagem[] = arrumacao.lado === 'a' ? [{ ...fichaDoBoneco(sistema, BONECO_PADRAO, ORIGEM_DO_ADVERSARIO), nome: `${NOME_DO_BONECO} (adversário)` }] : []
  const escolhas: EscolhaDaVaga[] = [
    { ficha: quemUsa, lado: 'a' },
    ...bonecos.map((ficha) => ({ ficha, lado: arrumacao.lado })),
    ...adversario.map((ficha) => ({ ficha, lado: 'b' as const })),
  ]
  const montagem = montarLutadores(escolhas)
  if (!montagem.ok) return `A mesa do teste não montou (${montagem.motivo}).`

  const mesa = criarMesaEmMemoria(sistema, montagem.lutadores)
  let reagindo = false
  let dadoDaReacao: number | null = null
  const rolarD20 = (): number => {
    const dado = reagindo && pedido.d20Fixo !== undefined ? pedido.d20Fixo : sorteio.d20()
    if (reagindo) dadoDaReacao = dado
    return dado
  }
  const loja = criarBatalhaStore(mesa, { rolarD20, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA_DO_ENSAIO, {}, { combatentes, regras: null, desempate: 'd20' })

  const vagaDeQuemUsa = mesa.vagas().find((vaga) => vaga.origem === ORIGEM_DE_QUEM_USA)
  if (vagaDeQuemUsa === undefined) return 'A cópia de quem usa não entrou na mesa do teste.'
  const vagasDosBonecos = mesa.vagas().filter((vaga) => vaga !== vagaDeQuemUsa && vaga.origem !== ORIGEM_DO_ADVERSARIO)
  // A Florescer só vale em quem está na redoma: o boneco começa com o selo que a técnica pede.
  if (arrumacao.seloPedido !== null) for (const vaga of vagasDosBonecos) loja.getState().porSelo(CENA_DO_ENSAIO, vaga.tokenId, { nome: arrumacao.seloPedido, turnos: null })
  for (const selo of arrumacao.selosParaTirar) for (const vaga of vagasDosBonecos) loja.getState().porSelo(CENA_DO_ENSAIO, vaga.tokenId, selo)

  // Os outros passam até a vez de quem age (o teste é o golpe, não a ordem): quem usa, ou o boneco que bate no teste da reação.
  const quemAge = vezDe === 'quemUsa' ? vagaDeQuemUsa.tokenId : vagasDosBonecos[0]?.tokenId
  for (let i = 0; i < VEZES_ATE_QUEM_USA; i += 1) {
    const turnos = cenaDe(loja).turnos
    const carta = turnos.cartas.find((atual) => atual.id === turnos.vez)
    if (carta === undefined || carta.tokenId === quemAge) break
    loja.getState().passarVez(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, { cartaId: carta.id, rodada: turnos.rodada })
  }
  return { mesa, loja, vagaDeQuemUsa, vagasDosBonecos, naReacao: (sim) => (reagindo = sim), dadoDaReacao: () => dadoDaReacao }
}

/** O nome da ficha sentada na vaga. */
function nomeNaVaga(mesa: MesaEmMemoria, vaga: VagaDoEnsaio): string {
  return mesa.personagens().find((personagem) => personagem.id === vaga.personagemId)?.nome ?? NOME_DO_BONECO
}

/**
 * O boneco reage como na Arena (o d20, o fixo se o mestre pediu, mais o
 * modificador dele) e cada dado vira o passo "Reação": o que o motor rolou e a
 * saída que o boneco escolheu.
 */
function bonecosReagem(montada: MesaDoEnsaio): PassoDoEnsaio[] {
  const { mesa, loja, vagasDosBonecos } = montada
  const passos: PassoDoEnsaio[] = []
  for (let i = 0; i < REACOES_MAX; i += 1) {
    const agora = cenaDe(loja).turnos
    const achado = vagasDosBonecos
      .map((vaga) => ({ vaga, passo: passoDoBoneco(agora, vaga.tokenId, 'd20', BONECO_PADRAO.modificador, new Set()) }))
      .find((candidato) => candidato.passo?.tipo === 'reagir')
    if (achado === undefined || achado.passo === null || achado.passo.tipo !== 'reagir') break
    const { pedido } = achado.passo
    const nome = nomeNaVaga(mesa, achado.vaga)
    if (pedido.tipo === 'escolher') {
      const rolagem = (agora.golpes ?? []).find((golpe) => golpe.id === pedido.golpeId)?.alvos.find((alvo) => alvo.tokenId === pedido.tokenId)?.rolagem
      if (rolagem !== undefined) {
        const sinal = rolagem.modificador < 0 ? '-' : '+'
        passos.push({ tipo: 'reacao', titulo: 'Reação', texto: `${nome}: d20 ${rolagem.d20} ${sinal} ${Math.abs(rolagem.modificador)} = ${rolagem.total}, ${SAIDA_NO_PASSO[pedido.saida]}`, dado: rolagem.d20 })
      }
    } else if (pedido.tipo === 'naoReagir') {
      passos.push({ tipo: 'reacao', titulo: 'Reação', texto: `${nome} não rola: contra Overload e Surpresa só uma técnica defende.` })
    }
    montada.naReacao(true)
    const aceita = loja.getState().reagir(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, pedido)
    montada.naReacao(false)
    if (!aceita) break
  }
  return passos
}

/** A vida de cada alvo, do antes ao depois (ficha sem vida no sistema não tem barra). */
function barrasDosAlvos(mesa: MesaEmMemoria, sistema: SistemaDeRpg, alvosTokens: readonly string[], vidaAntes: ReadonlyMap<string, { atual: number } | null>): BarraDoEnsaio[] {
  const vida = recursoDeVida(sistema)
  if (vida === null) return []
  return mesa
    .personagens()
    .filter((personagem) => alvosTokens.some((tokenId) => mesa.vagas().some((vaga) => vaga.tokenId === tokenId && vaga.personagemId === personagem.id)))
    .flatMap((personagem) => {
      const agora = vidaDoPersonagem(personagem, vida)
      const antesDoGolpe = vidaAntes.get(personagem.id)
      if (agora === null || antesDoGolpe === undefined || antesDoGolpe === null) return []
      return [{ nome: personagem.nome, antes: antesDoGolpe.atual, depois: agora.atual, maximo: agora.maximo }]
    })
}

/**
 * Fase 5: os selos que o golpe pôs, com os números ("Fortalecido 2 (FOR +20)":
 * o +20 entra na conta do próximo golpe de quem o tem). Lido da mesa depois
 * do golpe, como o motor deixou.
 */
function passosDosSelosNovos(montada: MesaDoEnsaio, sistema: SistemaDeRpg, antes: ReadonlySet<string>): PassoDoEnsaio[] {
  const { mesa, loja } = montada
  return (cenaDe(loja).turnos.selos ?? [])
    .filter((selo) => !antes.has(selo.id))
    .map((selo) => {
      const vaga = mesa.vagas().find((candidata) => candidata.tokenId === selo.tokenId)
      const nome = vaga === undefined ? NOME_DO_BONECO : nomeNaVaga(mesa, vaga)
      const conta = (selo.mods ?? []).length > 0 ? ': os números entram na conta do próximo golpe dele' : ''
      return { tipo: 'registro', titulo: 'Selo', texto: `${nome} fica ${textoDoSeloComMods(selo, sistema)}${conta}.` }
    })
}

/** "Passar 1 vez do alvo": a vez atual acaba e começa a seguinte; o sangramento é aplicado, a condição conta. */
function passarUmaVezNa(montada: MesaDoEnsaio, sistema: SistemaDeRpg): () => PassoDoEnsaio[] {
  const { mesa, loja } = montada
  return () => {
    const fotoAntes = fotoDosRecursos(mesa)
    const inicio = cenaDe(loja).registro.length
    const vez = cenaDe(loja).turnos
    if (vez.vez !== null) loja.getState().passarVez(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, { cartaId: vez.vez, rodada: vez.rodada })
    aplicarSangramentos(loja, CENA_DO_ENSAIO)
    const depois = [...passosDoRegistro(loja, inicio, 'Na vez do alvo'), ...passosDosRecursos(mesa, sistema, fotoAntes)]
    return depois.length > 0 ? depois : [{ tipo: 'registro', titulo: 'Na vez do alvo', texto: 'Nada acontece no começo da vez dele.' }]
  }
}

/** O Tempo da técnica como o passo "Depois" o diz; `null` = livre. */
function passoDoTempo(tempo: LeituraDoTempo): PassoDoEnsaio | null {
  if (tempo.tipo === 'recarga') return { tipo: 'depois', titulo: 'Depois', texto: `Recarga de ${tempo.turnos} ${tempo.turnos === 1 ? 'vez' : 'vezes'}.` }
  if (tempo.tipo === 'usos') return { tipo: 'depois', titulo: 'Depois', texto: `${tempo.vezes} ${tempo.vezes === 1 ? 'uso' : 'usos'} por batalha.` }
  return null
}

/** O dano do golpe do boneco no teste da reação: número redondo, para a parte que fica aparecer (50% = 50). */
const DANO_DO_BONECO = 100

/** Fase 4: o teste vai pela reação. Só no lugar da reação = sempre; os dois = quando o painel pede "Na reação". */
export function ensaioNaReacao(pedido: Pick<PedidoDeEnsaio, 'cartao' | 'naReacao'>): boolean {
  const tipo = lerTipo(pedido.cartao)
  return tipo.tipo === 'reacao' || (tipo.tambemReacao && pedido.naReacao === true)
}

/** O nome da saída como o passo a diz: o rótulo da tabela (Fica com 50%) ou o de sempre. */
function saidaNoPasso(reacao: ReacaoComTecnica, saida: SaidaDaTecnica): string {
  const daTabela = reacao.daTabela?.[saida]
  if (daTabela !== undefined) return daTabela.rotulo
  return saida === 'rolar' ? 'rola o d20' : SAIDA_NO_PASSO[saida]
}

/**
 * Fase 4 (o teste da reação, decisão M1): o boneco bate em quem usa com
 * `DANO_DO_BONECO` e quem usa reage com a técnica ANTES do d20, pelo mesmo
 * `reagir` do host. O motivo de não poder (SP, recarga, Atordoado, só o
 * mestre) é o mesmo que a caixa REAÇÃO mostra apagado.
 */
function ensaiarAReacao(pedido: PedidoDeEnsaio): ResultadoDoEnsaio {
  const { cartao, sistema } = pedido
  const arrumou: PassoDoEnsaio = { tipo: 'arrumou', titulo: 'Boneco', texto: `O boneco de treino bate em quem usa com ${DANO_DO_BONECO} de dano; a técnica entra no lugar da reação, antes do d20.` }
  const naoSaiu = (texto: string): ResultadoDoEnsaio => ({ passos: [arrumou, recusa(texto)], barras: [], passarUmaVez: null })
  const montada = montarMesa(pedido, { lado: 'b', quantos: 1, ferido: false, emSi: false, seloPedido: null, selosParaTirar: [], spPelaMetade: false, escudo: 0, frase: arrumou.texto }, 'boneco')
  if (typeof montada === 'string') return naoSaiu(montada)
  const { mesa, loja, vagaDeQuemUsa, vagasDosBonecos } = montada
  const boneco = vagasDosBonecos[0]
  if (boneco === undefined) return naoSaiu('O boneco não entrou na mesa do teste.')
  const vida = recursoDeVida(sistema)
  const vidaAntes = new Map(mesa.personagens().map((personagem) => [personagem.id, vida === null ? null : vidaDoPersonagem(personagem, vida)]))
  const antes = fotoDosRecursos(mesa)
  const turnos = cenaDe(loja).turnos
  if (turnos.vez === null) return naoSaiu('A mesa do teste não chegou à vez do boneco.')
  const ataque: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: vagaDeQuemUsa.tokenId, dano: DANO_DO_BONECO }], surpresa: false, perfurante: false }
  const esperado = { cartaId: turnos.vez, rodada: turnos.rodada }
  const motivoDoAtaque = loja.getState().motivoDoAgir(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, esperado, ataque)
  if (motivoDoAtaque !== null) return naoSaiu(motivoDoAtaque)
  const desde = cenaDe(loja).registro.length
  if (!loja.getState().agir(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, esperado, ataque)) return naoSaiu('A batalha recusou o golpe do boneco.')

  const agora = cenaDe(loja).turnos
  const golpe = (agora.golpes ?? []).at(-1)
  const alvo = golpe?.alvos.find((candidato) => candidato.tokenId === vagaDeQuemUsa.tokenId)
  const naMesa = mesa.personagens().find((personagem) => personagem.id === vagaDeQuemUsa.personagemId)
  if (golpe === undefined || alvo === undefined || naMesa === undefined) return naoSaiu('O golpe do boneco não chegou em quem usa.')
  // A caixa REAÇÃO de quem leva o golpe: a mesma lista, com o motivo de cada técnica apagada.
  const reacao = reacoesParaOAlvo(alvo, naMesa, sistema, agora.combate?.[naMesa.id], golpe.overload, golpe.surpresa).find((candidata) => candidata.cartao.id === cartao.id)
  if (reacao === undefined) return naoSaiu('A técnica não aparece na caixa REAÇÃO (o tipo dela não é de reação).')
  if (reacao.motivo !== null) return naoSaiu(reacao.motivo)
  const saida = reacao.sugerida ?? reacao.saidas[0]
  if (saida === undefined) return naoSaiu('A técnica não tem saída na reação.')
  const selosAntes = selosDoToken(cenaDe(loja).turnos.selos, boneco.tokenId)
  const pedidoDaReacao: PedidoDeReacao = { tipo: 'tecnica', golpeId: golpe.id, tokenId: alvo.tokenId, cartaoId: cartao.id, saida, custo: null, ...(reacao.seloNoAtacante === null ? {} : { seloNoAtacante: reacao.seloNoAtacante }) }
  montada.naReacao(true)
  const aceita = loja.getState().reagir(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, pedidoDaReacao)
  montada.naReacao(false)
  if (!aceita) return naoSaiu('A batalha recusou a reação.')
  const nome = nomeNaVaga(mesa, vagaDeQuemUsa)
  // O golpe resolvido sai da lista: o dado vem do que a mesa rolou durante a reação.
  const dado = montada.dadoDaReacao()
  const tabela = reacao.rolagemDaTabela
  const passoDaReacao: PassoDoEnsaio =
    saida === 'rolar' && dado !== null
      ? { tipo: 'reacao', titulo: 'Reação', texto: `${nome} reage com ${reacao.nome}: rola o d20 (${dado})${tabela === undefined ? '' : ` + ${tabela.modificador} = ${dado + tabela.modificador}, anula com ${tabela.anulaCom} ou mais`}.`, dado }
      : { tipo: 'reacao', titulo: 'Reação', texto: `${nome} reage com ${reacao.nome}: ${saidaNoPasso(reacao, saida)}, antes do d20.` }
  const selosNovos = selosDoToken(cenaDe(loja).turnos.selos, boneco.tokenId).filter((selo) => !selosAntes.some((antes) => antes.id === selo.id))
  const passoDoSelo: PassoDoEnsaio[] = selosNovos.map((selo) => ({ tipo: 'registro', titulo: 'Em quem atacou', texto: `${nomeNaVaga(mesa, boneco)} fica ${selo.nome}${selo.turnos === null ? ' até tirar' : ` por ${selo.turnos} ${selo.turnos === 1 ? 'vez' : 'vezes'}`}.` }))
  const passos: PassoDoEnsaio[] = [arrumou, passoDaReacao, ...passosDoRegistro(loja, desde, 'Na batalha'), ...passoDoSelo, ...passosDosRecursos(mesa, sistema, antes)]
  const depois = passoDoTempo(reacao.tempo)
  if (depois !== null) passos.push(depois)
  return { passos, barras: barrasDosAlvos(mesa, sistema, [vagaDeQuemUsa.tokenId, boneco.tokenId], vidaAntes), passarUmaVez: null }
}

/**
 * Roda o cartão uma vez no boneco. Nunca lança por causa da ficha: o que o
 * motor recusa vira o passo "Não saiu" com o motivo dele.
 */
export function ensaiar(pedido: PedidoDeEnsaio): ResultadoDoEnsaio {
  const { cartao, sistema } = pedido
  if (ensaioNaReacao(pedido)) return ensaiarAReacao(pedido)
  const arrumacao = arrumacaoDoBoneco(cartao)
  const arrumou: PassoDoEnsaio = { tipo: 'arrumou', titulo: 'Boneco', texto: arrumacao.frase }
  const naoSaiu = (texto: string): ResultadoDoEnsaio => ({ passos: [arrumou, recusa(texto)], barras: [], passarUmaVez: null })
  const montada = montarMesa(pedido, arrumacao)
  if (typeof montada === 'string') return naoSaiu(montada)
  const { mesa, loja, vagaDeQuemUsa, vagasDosBonecos } = montada
  const vida = recursoDeVida(sistema)

  const turnos = cenaDe(loja).turnos
  const naMesa = mesa.personagens().find((personagem) => personagem.id === vagaDeQuemUsa.personagemId)
  const noMenu = (arma: CartaoDaFicha | null) => (naMesa === undefined ? undefined : tecnicasNoMenu(naMesa, sistema, turnos.combate?.[naMesa.id], null, arma).find((atual) => atual.cartao.id === cartao.id))
  const semArma = noMenu(null)
  // A fórmula com "Dano da Arma": a mira marca a arma padrão; o teste faz o mesmo.
  const arma = semArma?.dano.tipo === 'precisaArma' && naMesa !== undefined ? armaPadraoEntre(armasDe(naMesa)) : null
  const tecnica = arma === null ? semArma : noMenu(arma)
  if (naMesa === undefined || tecnica === undefined) return naoSaiu('A técnica não aparece no menu da vez (passiva, invocação ou aba que a batalha não lê).')
  // O motivo é o mesmo que o menu da vez mostra (SP insuficiente, recarga, passiva).
  if (tecnica.motivo !== null) return naoSaiu(tecnica.motivo)
  if (turnos.vez === null) return naoSaiu('A mesa do teste não chegou à vez de quem usa.')

  const alvosTokens = arrumacao.emSi ? [vagaDeQuemUsa.tokenId] : vagasDosBonecos.map((vaga) => vaga.tokenId)
  const lidos = alvosTokens.map((tokenId) => {
    const alvo = mesa.personagens().find((personagem) => mesa.vagas().some((vaga) => vaga.tokenId === tokenId && vaga.personagemId === personagem.id))
    const vidaDoAlvo = alvo === undefined || vida === null ? null : vidaDoPersonagem(alvo, vida)
    return { tokenId, lido: tecnica.dano.tipo === 'precisaAlvo' && vidaDoAlvo !== null ? danoDaTecnicaComAVida(tecnica.cartao, { personagem: naMesa, sistema, arma }, vidaDoAlvo) : tecnica.dano }
  })
  const alvos: PedidoDeAlvo[] = lidos.map(({ tokenId, lido }) => ({ tokenId, dano: lido.tipo === 'valor' ? danoNoTeto(lido.valor) : null }))
  const selo = seloDaMira(tecnica.cartao, sistema)
  const golpe: PedidoDeAcao = {
    tipo: 'habilidade',
    cartaoId: cartao.id,
    armaId: arma === null ? null : arma.id,
    alvos,
    surpresa: false,
    perfurante: tecnica.perfurante,
    custo: null,
    acao: tecnica.acao === 'passiva' ? null : tecnica.acao,
    ...(selo === null ? {} : { selo }),
  }

  // Fase 5: o teste confere o efeito, não a ação da vez: a técnica de Ação Bônus ganha a bônus, como o mestre daria.
  const deuBonus = tecnica.acao === 'bonus' && loja.getState().darAcoesExtras(CENA_DO_ENSAIO, turnos.vez, { simples: 0, bonus: 1, mov: 0, duracao: 'rodada', rodada: turnos.rodada })
  const passoDoBonus: PassoDoEnsaio[] = deuBonus ? [{ tipo: 'arrumou', titulo: 'Ação', texto: 'Ação bônus dada para o teste (na batalha, o mestre é quem dá).' }] : []
  const antes = fotoDosRecursos(mesa)
  const vidaAntes = new Map(mesa.personagens().map((personagem) => [personagem.id, vida === null ? null : vidaDoPersonagem(personagem, vida)]))
  const selosAntes = new Set((turnos.selos ?? []).map((selo) => selo.id))
  const desde = cenaDe(loja).registro.length
  const esperado = { cartaId: turnos.vez, rodada: turnos.rodada }
  // O motivo é o mesmo que o host daria ao golpe (`podeAgir`), palavra por palavra.
  const motivoDoMotor = loja.getState().motivoDoAgir(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, esperado, golpe)
  if (motivoDoMotor !== null) return naoSaiu(motivoDoMotor)
  if (!loja.getState().agir(CENA_DO_ENSAIO, AUTOR_DO_ENSAIO, esperado, golpe)) return naoSaiu('A batalha recusou o golpe.')

  // A fórmula com os números da ficha, como o menu da vez a leu (o mesmo número que foi ao golpe).
  const primeiro = lidos[0]?.lido
  const formula: PassoDoEnsaio[] = primeiro !== undefined && (primeiro.tipo === 'valor' || primeiro.tipo === 'precisaArma') ? [{ tipo: 'formula', titulo: 'Fórmula', texto: primeiro.tipo === 'valor' ? primeiro.conta : `${primeiro.conta} (falta a arma)` }] : []
  const reacoes = bonecosReagem(montada)
  const passos: PassoDoEnsaio[] = [arrumou, ...passoDoBonus, ...formula, ...reacoes, ...passosDoRegistro(loja, desde, 'Na batalha').filter((passo) => !/ ganhou ações extras/.test(passo.texto)), ...passosDosSelosNovos(montada, sistema, selosAntes), ...passosDosRecursos(mesa, sistema, antes)]
  const depois = passoDoTempo(tecnica.tempo)
  if (depois !== null) passos.push(depois)
  return { passos, barras: barrasDosAlvos(mesa, sistema, alvosTokens, vidaAntes), passarUmaVez: passarUmaVezNa(montada, sistema) }
}
