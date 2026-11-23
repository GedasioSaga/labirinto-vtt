import { cartaoPorId } from '../habilidadeOculta'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import {
  AJUSTE_NEUTRO,
  ajustarLutadores,
  escudoDe,
  faixaDoDano,
  hpMaximo,
  LUTAS_DA_CONFERENCIA,
  LUTAS_POR_TENTATIVA,
  medianaSuave,
  NOME_DO_BOTAO,
  quantil,
  wilson,
  type AjusteDaFicha,
  type AvisoDoAchar,
  type AvisoDoBalanceador,
  type BalancoDaSerie,
  type BotaoDoAjuste,
  type MetaDoAchar,
  type PropostaDoAchar,
  type TecnicaNoBalanco,
  type TentativaDoAchar,
  type TurnoNoHistograma,
  type VagaNoBalanco,
} from './balanceadorComum'
import { sementeDaLuta } from './cemLutas'
import { lutaAutomatica, lutaContada } from './lutaAutomatica'
import type { LadoDoTreino, LutadoresDoTreino } from './mesaEmMemoria'

/**
 * O MOTOR DO BALANCEADOR (docs/design/balanceamento/NOTAS.md), no worker:
 * "Testar" roda N lutas do robô de verdade (`lutaContada`) e soma o que cada
 * vaga fez; "Achar os números" procura o ajuste do inimigo em lotes de
 * sementes fixas (o que muda de uma tentativa para outra é o número, não o
 * dado) e confere com lutas de sementes novas. Puro e síncrono, como
 * `cemLutas.ts`.
 */

/** Tentativas por botão: a primeira volta e as voltas seguintes, quando há duas metas. */
const TENTATIVAS_NA_PRIMEIRA = 7
const TENTATIVAS_DEPOIS = 4
const CICLOS_DAS_DUAS_METAS = 3
/** Os botões multiplicam entre estes limites (o Escudo soma até 20 vezes a vida do alvo). */
const DOMINIO_DO_HP: [number, number] = [0.1, 25]
const DOMINIO_DOS_ATRIBUTOS: [number, number] = [0.2, 6]
const ESCUDO_MINIMO_DO_TETO = 200
const ESCUDO_EM_VIDAS = 20
/** Quanto perto da meta basta: 0,3 turno ou 2,5 pontos de vitória. */
const TOLERANCIA_DOS_TURNOS = 0.3
const TOLERANCIA_DA_VITORIA = 0.025
/** Técnicas na lista "mais usadas". */
const TECNICAS_NA_LISTA = 8
/** Mistura a semente da conferência para não repetir as lutas da busca. */
const MISTURA_DA_CONFERENCIA = 0x5bd1e995

const NOME_DO_USO: Readonly<Record<string, string>> = {
  atacar: 'Atacar',
  item: 'Item',
  concentrar: 'Concentrar',
  transformar: 'Transformar',
  destransformar: 'Destransformar',
}

export interface PedidoDoBalanco {
  sistema: SistemaDeRpg | null
  lutadores: LutadoresDoTreino
  semente: number
  n: number
}

export interface PedidoDoAchar {
  sistema: SistemaDeRpg | null
  lutadores: LutadoresDoTreino
  semente: number
  /** As fichas de origem que o ajuste muda (todas as cópias delas). */
  alvos: readonly string[]
  meta: MetaDoAchar
  botoes: Readonly<Record<BotaoDoAjuste, boolean>>
}

interface SomaDaVaga {
  danoCausado: number
  danoSofrido: number
  cura: number
  spGasto: number
  caiu: number
  caiuSoma: number
  primeiro: number
  semSp: number
  semSpSoma: number
  usos: Map<string, number>
}

function nomeDoUso(lutadores: LutadoresDoTreino, personagemId: string, uso: string): string {
  const fixo = NOME_DO_USO[uso]
  if (fixo !== undefined) return fixo
  const copia = lutadores.personagens.find((personagem) => personagem.id === personagemId)
  return (copia === undefined ? null : cartaoPorId(copia, uso)?.nome) ?? 'Técnica'
}

/** As N lutas da semente com os contadores somados: o "Testar". */
export function rodarBalanco(pedido: PedidoDoBalanco, aviso?: AvisoDoBalanceador): BalancoDaSerie {
  const { lutadores, sistema, n } = pedido
  const somas = new Map<string, SomaDaVaga>()
  const vitorias = { a: 0, b: 0, empate: 0 }
  let noTeto = 0
  const rodadas: number[] = []
  const porTurno = new Map<number, TurnoNoHistograma>()
  const dePe = { a: 0, b: 0 }
  const lutas: { semente: number; rodada: number; vencedor: LadoDoTreino | null }[] = []
  for (const vaga of lutadores.vagas) somas.set(vaga.id, { danoCausado: 0, danoSofrido: 0, cura: 0, spGasto: 0, caiu: 0, caiuSoma: 0, primeiro: 0, semSp: 0, semSpSoma: 0, usos: new Map() })

  for (let indice = 0; indice < n; indice += 1) {
    const semente = sementeDaLuta(pedido.semente, indice)
    const { resumo, contadores, primeiraACair } = lutaContada({ sistema, lutadores, semente })
    const { fim, rodada } = resumo
    const vencedor = fim.tipo === 'vitoria' ? fim.vencedor : null
    if (vencedor !== null) vitorias[vencedor] += 1
    else vitorias.empate += 1
    if (fim.tipo === 'tempo') noTeto += 1
    rodadas.push(rodada)
    lutas.push({ semente, rodada, vencedor })
    const turno = porTurno.get(rodada) ?? { turno: rodada, a: 0, b: 0, empate: 0 }
    turno[vencedor ?? 'empate'] += 1
    porTurno.set(rodada, turno)
    for (const lutador of resumo.lutadores) if (lutador.vida !== null && lutador.vida.atual > 0) dePe[lutador.lado] += 1
    for (const contador of contadores) {
      const soma = somas.get(contador.vaga)
      if (soma === undefined) continue // vaga que nasceu na luta (invocado): fora do balanço por ficha
      soma.danoCausado += contador.danoCausado
      soma.danoSofrido += contador.danoSofrido
      soma.cura += contador.cura
      soma.spGasto += contador.spGasto
      if (contador.caiuNaRodada !== null) {
        soma.caiu += 1
        soma.caiuSoma += contador.caiuNaRodada
      }
      if (contador.semSpNaRodada !== null) {
        soma.semSp += 1
        soma.semSpSoma += contador.semSpNaRodada
      }
      for (const [uso, vezes] of Object.entries(contador.usos)) soma.usos.set(uso, (soma.usos.get(uso) ?? 0) + vezes)
    }
    if (primeiraACair !== null) {
      const soma = somas.get(primeiraACair)
      if (soma !== undefined) soma.primeiro += 1
    }
    aviso?.(indice + 1, n, 'Lutando')
  }

  const ordenadas = [...rodadas].sort((x, y) => x - y)
  const mediana = medianaSuave(ordenadas)
  const porId = new Map(lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  const tecnicas: TecnicaNoBalanco[] = []
  const vagas: VagaNoBalanco[] = lutadores.vagas.map((vaga) => {
    const soma = somas.get(vaga.id) ?? { danoCausado: 0, danoSofrido: 0, cura: 0, spGasto: 0, caiu: 0, caiuSoma: 0, primeiro: 0, semSp: 0, semSpSoma: 0, usos: new Map<string, number>() }
    const copia = porId.get(vaga.personagemId)
    const nome = copia?.nome ?? vaga.id
    let maisUsada: VagaNoBalanco['maisUsada'] = null
    for (const [uso, vezes] of soma.usos) {
      const item = { nome: nomeDoUso(lutadores, vaga.personagemId, uso), vezes: vezes / n }
      tecnicas.push({ ...item, lado: vaga.lado, quem: nome })
      if (maisUsada === null || item.vezes > maisUsada.vezes) maisUsada = item
    }
    const sp = sistema?.recursos.find((recurso) => recurso.tom === 'energia' && recurso.atualEMaximo === true)
    return {
      vaga: vaga.id,
      lado: vaga.lado,
      origem: vaga.origem,
      nome,
      hpMaximo: copia === undefined ? 0 : (hpMaximo(copia, sistema) ?? 0),
      spMaximo: copia === undefined || sp === undefined ? 0 : (copia.maximos[sp.id] ?? copia.recursos[sp.id] ?? 0),
      danoCausado: soma.danoCausado / n,
      danoSofrido: soma.danoSofrido / n,
      cura: soma.cura / n,
      spGasto: soma.spGasto / n,
      caiu: soma.caiu / n,
      caiuNaRodada: soma.caiu === 0 ? 0 : soma.caiuSoma / soma.caiu,
      primeiro: soma.primeiro / n,
      semSp: soma.semSp / n,
      semSpNaRodada: soma.semSp === 0 ? 0 : soma.semSpSoma / soma.semSp,
      maisUsada,
    }
  })
  tecnicas.sort((x, y) => y.vezes - x.vezes)

  const turnoMaximo = ordenadas.length === 0 ? 0 : ordenadas[ordenadas.length - 1]
  const histograma: TurnoNoHistograma[] = []
  for (let turno = 1; turno <= turnoMaximo; turno += 1) histograma.push(porTurno.get(turno) ?? { turno, a: 0, b: 0, empate: 0 })

  // A luta típica: a do turno da mediana com o vencedor mais comum, refeita com o registro.
  const comum: LadoDoTreino = vitorias.a >= vitorias.b ? 'a' : 'b'
  const alvo = Math.round(mediana)
  const escolhida =
    lutas.find((luta) => luta.rodada === alvo && luta.vencedor === comum) ??
    lutas.reduce<(typeof lutas)[number] | null>((melhor, luta) => (melhor === null || Math.abs(luta.rodada - mediana) < Math.abs(melhor.rodada - mediana) ? luta : melhor), null)
  const tipica = escolhida === null ? null : { ...escolhida, registro: lutaAutomatica({ sistema, lutadores, semente: escolhida.semente }).registro }

  return {
    n,
    semente: pedido.semente,
    vitorias,
    noTeto,
    mediana,
    media: rodadas.reduce((soma, rodada) => soma + rodada, 0) / Math.max(1, n),
    q25: quantil(ordenadas, 0.25),
    q75: quantil(ordenadas, 0.75),
    p10: quantil(ordenadas, 0.1),
    p90: quantil(ordenadas, 0.9),
    histograma,
    dePe: { a: dePe.a / Math.max(1, n), b: dePe.b / Math.max(1, n) },
    vagas,
    tecnicas: tecnicas.slice(0, TECNICAS_NA_LISTA),
    tipica,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// "Achar os números"
// ───────────────────────────────────────────────────────────────────────────

interface Medida {
  mediana: number
  q25: number
  q75: number
  vitoria: number
  n: number
}

interface Contexto {
  pedido: PedidoDoAchar
  alvos: ReadonlySet<string>
  tentativas: TentativaDoAchar[]
  escudoMaximo: number
  vidaDoAlvo: number
  faixaDoDano: [number, number]
  feitas: number
  total: number
  aviso: AvisoDoBalanceador | undefined
  fase: string
}

function medir(ctx: Contexto, ajuste: AjusteDaFicha, n: number, semente: number): Medida {
  const { sistema } = ctx.pedido
  const lutadores = ajustarLutadores(ctx.pedido.lutadores, ctx.alvos, ajuste, sistema)
  const rodadas: number[] = []
  let vitorias = 0
  for (let indice = 0; indice < n; indice += 1) {
    const resumo = lutaAutomatica({ sistema, lutadores, semente: sementeDaLuta(semente, indice) })
    rodadas.push(resumo.rodada)
    if (resumo.fim.tipo === 'vitoria' && resumo.fim.vencedor === 'a') vitorias += 1
    ctx.feitas += 1
    ctx.total = Math.max(ctx.total, ctx.feitas + 1)
    ctx.aviso?.(ctx.feitas, ctx.total, ctx.fase)
  }
  rodadas.sort((x, y) => x - y)
  return { mediana: medianaSuave(rodadas), q25: quantil(rodadas, 0.25), q75: quantil(rodadas, 0.75), vitoria: vitorias / Math.max(1, n), n }
}

function virgula(valor: number, casas = 2): string {
  return valor.toFixed(casas).replace('.', ',')
}

function textoDaTentativa(numero: number, botao: BotaoDoAjuste, ajuste: AjusteDaFicha, meta: 'turnos' | 'vitoria', medida: Medida): string {
  const quanto = botao === 'escudo' ? `+${Math.round(ajuste.escudo)}` : `×${virgula(ajuste[botao])}`
  const deu = meta === 'turnos' ? `${virgula(medida.mediana, 1)} turnos` : `${Math.round(medida.vitoria * 100)}% de vitória dos aliados`
  return `Tentativa ${numero}: ${NOME_DO_BOTAO[botao]} ${quanto} dá ${deu}`
}

interface Ponto {
  u: number
  ajuste: AjusteDaFicha
  /** Sinal da distância à meta: negativo = falta subir o botão. */
  g: number
}

interface Achado {
  ajuste: AjusteDaFicha
  ok: boolean
  limite: boolean
}

function dominio(ctx: Contexto, botao: BotaoDoAjuste): [number, number] {
  if (botao === 'hp') return DOMINIO_DO_HP
  if (botao === 'escudo') return [0, ctx.escudoMaximo]
  if (botao === 'dano') return ctx.faixaDoDano
  return DOMINIO_DOS_ATRIBUTOS
}

/**
 * O valor de UM botão que leva a métrica à meta: chute proporcional (HP ×
 * meta ÷ turnos de agora), depois falsa posição dentro do intervalo cercado e,
 * fora dele, a secante com passo limitado. Porte do `procurar` do protótipo.
 */
function procurar(ctx: Contexto, botao: BotaoDoAjuste, meta: 'turnos' | 'vitoria', alvo: number, base: AjusteDaFicha, tentativasMax: number): Achado {
  const log = botao !== 'escudo'
  const [minimo, maximo] = dominio(ctx, botao)
  if (maximo <= minimo) return { ajuste: base, ok: false, limite: true }
  const paraU = (valor: number): number => (log ? Math.log(valor) : valor)
  const deU = (u: number): number => (log ? Math.exp(u) : u)
  const uMin = paraU(minimo)
  const uMax = paraU(maximo)
  const prender = (u: number): number => Math.min(uMax, Math.max(uMin, u))
  // Mais HP, Escudo, Dano ou Atributos no inimigo = luta mais longa, e vitória dos aliados menor.
  const sinal = meta === 'turnos' ? 1 : -1
  const tolerancia = meta === 'turnos' ? TOLERANCIA_DOS_TURNOS : TOLERANCIA_DA_VITORIA
  const metrica = (medida: Medida): number => (meta === 'turnos' ? medida.mediana : medida.vitoria)

  const avaliar = (u: number): Ponto & { medida: Medida } => {
    const ajuste = { ...base, [botao]: deU(u) }
    const medida = medir(ctx, ajuste, LUTAS_POR_TENTATIVA, ctx.pedido.semente)
    ctx.tentativas.push({ botao, meta, ajuste, valor: metrica(medida) })
    ctx.fase = textoDaTentativa(ctx.tentativas.length, botao, ajuste, meta, medida)
    ctx.aviso?.(ctx.feitas, ctx.total, ctx.fase)
    return { u, ajuste, g: sinal * (metrica(medida) - alvo), medida }
  }

  // Num objeto, e não em `let`: o `anotar` muda os três, e o tsc não vê mudança feita dentro de função (estreitaria para `null`).
  const cerca: { baixo: Ponto | null; alto: Ponto | null; melhor: Ponto | null } = { baixo: null, alto: null, melhor: null }
  const anotar = (ponto: Ponto): void => {
    if (ponto.g < 0) {
      if (cerca.baixo === null || ponto.u > cerca.baixo.u) cerca.baixo = ponto
    } else if (cerca.alto === null || ponto.u < cerca.alto.u) cerca.alto = ponto
    if (cerca.melhor === null || Math.abs(ponto.g) < Math.abs(cerca.melhor.g)) cerca.melhor = ponto
  }

  let atual = avaliar(prender(paraU(base[botao] === 0 && log ? 1 : base[botao])))
  anotar(atual)
  const resposta = (ok: boolean, limite: boolean): Achado => ({ ajuste: (cerca.melhor ?? atual).ajuste, ok, limite })
  if (Math.abs(atual.g) <= tolerancia) return resposta(true, false)
  let proximo: number
  if (meta === 'turnos' && botao === 'hp') proximo = paraU((base.hp * alvo) / Math.max(1, atual.medida.mediana))
  else if (meta === 'turnos' && botao === 'escudo') proximo = base.escudo + ctx.vidaDoAlvo * (alvo / Math.max(1, atual.medida.mediana) - 1)
  else proximo = atual.u + (atual.g < 0 ? 1 : -1) * (log ? Math.log(1.8) : ctx.vidaDoAlvo * 0.6)

  for (let k = 1; k < tentativasMax; k += 1) {
    const cercado: [Ponto, Ponto] | null = cerca.baixo !== null && cerca.alto !== null ? [cerca.baixo, cerca.alto] : null
    if (cercado !== null) {
      const [lo, hi] = cercado
      const t = lo.g / (lo.g - hi.g)
      const margem = 0.12 * (hi.u - lo.u)
      proximo = Math.min(hi.u - margem, Math.max(lo.u + margem, lo.u + t * (hi.u - lo.u)))
    }
    proximo = prender(proximo)
    if (Math.abs(proximo - atual.u) < (log ? 0.004 : 5)) {
      const naBorda = (atual.g < 0 && atual.u >= uMax - 1e-9) || (atual.g > 0 && atual.u <= uMin + 1e-9)
      if (naBorda) return resposta(false, true)
      break
    }
    const anterior = atual
    atual = avaliar(proximo)
    anotar(atual)
    if (Math.abs(atual.g) <= tolerancia) return resposta(true, false)
    if (cercado === null) {
      const passo = atual.u - anterior.u
      const inclinacao = passo === 0 ? 0 : (atual.g - anterior.g) / passo
      let chute = inclinacao > 0 ? atual.u - atual.g / inclinacao : atual.u + 2 * passo
      if (atual.g < 0) chute = Math.max(chute, atual.u + Math.abs(passo) * 0.5)
      else chute = Math.min(chute, atual.u - Math.abs(passo) * 0.5)
      const teto = Math.abs(passo) * 3 + (log ? 0.1 : 50)
      proximo = Math.min(atual.u + teto, Math.max(atual.u - teto, chute))
    }
  }
  const final: Ponto = cerca.melhor ?? atual
  return { ajuste: final.ajuste, ok: Math.abs(final.g) <= tolerancia * 2.5, limite: false }
}

/** O ajuste arredondado como vai para a ficha: HP com 3 casas, Escudo de 10 em 10, dano e atributos de 0,05 em 0,05. */
function arredondar(ajuste: AjusteDaFicha): AjusteDaFicha {
  return {
    hp: Math.round(ajuste.hp * 1000) / 1000,
    escudo: Math.round(ajuste.escudo / 10) * 10,
    dano: Math.round(ajuste.dano * 20) / 20,
    atributos: Math.round(ajuste.atributos * 20) / 20,
  }
}

/** "Achar os números": o ajuste do(s) alvo(s) que leva a luta à meta, com a conferência em lutas novas. */
export function acharNumeros(pedido: PedidoDoAchar, aviso?: AvisoDoBalanceador): PropostaDoAchar {
  const alvos = new Set(pedido.alvos)
  const fichasDoAlvo = pedido.lutadores.personagens.filter((personagem) => pedido.lutadores.vagas.some((vaga) => vaga.personagemId === personagem.id && alvos.has(vaga.origem)))
  const vidaDoAlvo = fichasDoAlvo.reduce((soma, personagem) => soma + (hpMaximo(personagem, pedido.sistema) ?? 0) + escudoDe(personagem, pedido.sistema), 0)
  const primeira = fichasDoAlvo[0]
  const { turnos, vitoria } = pedido.meta
  const pool: BotaoDoAjuste | null = pedido.botoes.hp ? 'hp' : pedido.botoes.escudo ? 'escudo' : null
  const ameaca: BotaoDoAjuste | null = pedido.botoes.dano ? 'dano' : pedido.botoes.atributos ? 'atributos' : null
  const previstas = turnos !== null && vitoria !== null && pool !== null && ameaca !== null ? 20 : TENTATIVAS_NA_PRIMEIRA + 1
  const ctx: Contexto = {
    pedido,
    alvos,
    tentativas: [],
    escudoMaximo: Math.max(ESCUDO_MINIMO_DO_TETO, vidaDoAlvo * ESCUDO_EM_VIDAS),
    vidaDoAlvo,
    faixaDoDano: primeira === undefined ? [1, 1] : faixaDoDano(primeira),
    feitas: 0,
    total: LUTAS_POR_TENTATIVA * previstas + LUTAS_DA_CONFERENCIA,
    aviso,
    fase: 'Medindo a luta de agora',
  }
  const hojeMedida = medir(ctx, AJUSTE_NEUTRO, LUTAS_POR_TENTATIVA, pedido.semente)
  let ajuste: AjusteDaFicha = { ...AJUSTE_NEUTRO }
  const avisos: AvisoDoAchar[] = []
  let duracao: Achado | null = null
  let vence: (Achado & { botao: BotaoDoAjuste }) | null = null
  if (turnos !== null && vitoria !== null && pool !== null && ameaca !== null) {
    for (let ciclo = 0; ciclo < CICLOS_DAS_DUAS_METAS; ciclo += 1) {
      const tentativas = ciclo === 0 ? TENTATIVAS_NA_PRIMEIRA : TENTATIVAS_DEPOIS
      duracao = procurar(ctx, pool, 'turnos', turnos, ajuste, tentativas)
      ajuste = duracao.ajuste
      vence = { ...procurar(ctx, ameaca, 'vitoria', vitoria, ajuste, tentativas), botao: ameaca }
      ajuste = vence.ajuste
      ctx.fase = 'Conferindo as duas metas juntas'
      const confere = medir(ctx, ajuste, LUTAS_POR_TENTATIVA, pedido.semente)
      if (Math.abs(confere.mediana - turnos) <= 0.5 && Math.abs(confere.vitoria - vitoria) <= 0.04) break
    }
  } else if (turnos !== null && pool !== null) {
    duracao = procurar(ctx, pool, 'turnos', turnos, ajuste, TENTATIVAS_NA_PRIMEIRA + 1)
    ajuste = duracao.ajuste
    if (vitoria !== null) avisos.push({ tipo: 'semAmeaca' })
  } else if (vitoria !== null) {
    const primeiro = pool ?? ameaca
    if (primeiro !== null) {
      vence = { ...procurar(ctx, primeiro, 'vitoria', vitoria, ajuste, TENTATIVAS_NA_PRIMEIRA + 1), botao: primeiro }
      ajuste = vence.ajuste
      if (!vence.ok && pool !== null && ameaca !== null) {
        vence = { ...procurar(ctx, ameaca, 'vitoria', vitoria, ajuste, TENTATIVAS_NA_PRIMEIRA + 1), botao: ameaca }
        ajuste = vence.ajuste
      }
    }
  }
  if (duracao !== null && duracao.limite && pool !== null) avisos.push({ tipo: 'limiteTurnos', botao: pool })
  if (vence !== null && vence.limite) avisos.push({ tipo: 'limiteVitoria', botao: vence.botao })

  const final = arredondar(ajuste)
  ctx.fase = `Conferindo com ${LUTAS_DA_CONFERENCIA} lutas novas`
  const sementeNova = sementeDaLuta(pedido.semente ^ MISTURA_DA_CONFERENCIA, 0)
  const conferida = medir(ctx, final, LUTAS_DA_CONFERENCIA, sementeNova)
  const [vitoriaMin, vitoriaMax] = wilson(conferida.vitoria, conferida.n)
  return {
    ajuste: final,
    tentativas: ctx.tentativas,
    hoje: { mediana: hojeMedida.mediana, vitoria: hojeMedida.vitoria },
    conferencia: { ...conferida, vitoriaMin, vitoriaMax },
    avisos,
  }
}
