import type { CartaoDaFicha, Personagem } from '../../personagem'
import { numeroDaFicha } from '../../personagem'
import type { SeloDoGolpe, SeloPedido } from '../combate'
import type { FormaDaArea } from '../area'
import type { LeituraDaAcao, LeituraDoCusto, LeituraDoTempo } from '../leituraDaFicha'
import type { LimpezaAMao, MecanicaAMao, ReacaoAMao, SaidaDaReacaoAMao } from '../mecanicasAMao'
import type { ReacaoDoTipo } from '../tiposDaHabilidade'
import { lerMecanicaParaOMotor } from './golpe'
import { avisoDaMecanica, centroDaArea, testeRolado, VIDA_DO_PORCENTO, type Custo, type FormaDoAlvo, type MecanicaLida, type MecanicaV1, type Numero, type NumeroSimples, type Porcento, type ReacaoDaMecanica } from './modelo'
import { cdDoTeste, disputaDoTeste } from './teste'

/**
 * A TRADUÇÃO DAS PEÇAS (construtor de mecânicas, fatia C1; seção 2 do plano):
 * as peças do cartão viram as MESMAS leituras que o texto dá (custo, ação,
 * tempo, Overload) e a MESMA linha que a tabela à mão da F2 dá
 * (`MecanicaAMao`). Assim o resto do motor (menu, mira, golpe, store, duelo)
 * não percebe a diferença: quem procura a mecânica passa o cartão
 * (`mecanicaDoCartao`) e recebe a linha das peças no lugar da da tabela.
 *
 * Tudo ou nada: cartão com o campo `mecanica` nunca cai na tabela nem no
 * texto. Peça torta ou versão futura = cartão à mão (custo e dano digitados,
 * ação perguntada) com o aviso no lembrete da mira.
 *
 * Puro: sem store, sem rede.
 */

/** A leitura de cada objeto de mecânica, uma vez só (o cartão é imutável: editar troca o objeto). */
const lidas = new WeakMap<object, MecanicaLida>()

/**
 * As peças do cartão para o MOTOR, lidas e conferidas: com o tipo do golpe já montado em peças
 * (`lerMecanicaParaOMotor`, fase ED1). Quem edita e grava lê a escolha por `lerMecanica`.
 */
export function mecanicaLidaDoCartao(cartao: Pick<CartaoDaFicha, 'mecanica'>): MecanicaLida {
  const guardada = cartao.mecanica
  if (guardada === undefined) return { tipo: 'nenhuma' }
  const memoria = lidas.get(guardada)
  if (memoria !== undefined) return memoria
  const lida = lerMecanicaParaOMotor(guardada)
  lidas.set(guardada, lida)
  return lida
}

/** O cartão é montado por peças (mesmo torto ou de app mais novo): o texto não vale mais. */
export function cartaoMontado(cartao: Pick<CartaoDaFicha, 'mecanica'>): boolean {
  return cartao.mecanica !== undefined
}

/** As peças válidas do cartão, para o motor (o tipo do golpe já em peças: nunca grave isto); `null` = sem campo, torto ou futuro. */
export function pecasDoCartao(cartao: Pick<CartaoDaFicha, 'mecanica'>): MecanicaV1 | null {
  const lida = mecanicaLidaDoCartao(cartao)
  return lida.tipo === 'pecas' ? lida.mecanica : null
}

/**
 * O texto de um número simples na gramática de `lerDano` (o fixo vira "30").
 * Fase 5 (B10): a base pela vida do alvo vira a frase que a fórmula de sempre
 * lê ("25% da vida máxima do alvo"), e segue pelo caminho da vida do alvo
 * (`comDanoPelaVida`), alvo a alvo.
 */
export function formulaDoNumero(numero: NumeroSimples | Porcento): string {
  if ('porcento' in numero) return `${numero.porcento}% da vida ${VIDA_DO_PORCENTO[numero.de] ?? 'atual'} do alvo`
  return 'fixo' in numero ? String(numero.fixo) : numero.formula
}

/** A fórmula do dano do cartão montado ("" = sem dano, torto ou futuro); `null` = cartão de texto (vale o campo Dano). */
export function formulaDoDanoDasPecas(cartao: Pick<CartaoDaFicha, 'mecanica'>): string | null {
  if (!cartaoMontado(cartao)) return null
  const dano = pecasDoCartao(cartao)?.dano
  return dano === undefined ? '' : formulaDoNumero(dano.base)
}

/** O número na carga 0 (o de sempre). */
function semCarga(numero: Numero): NumeroSimples {
  return 'porCarga' in numero ? numero.porCarga[0] : numero
}

/** O número do custo na ficha de quem usa, para baixo; `null` = a fórmula não fecha (vira pergunta). */
function valorDoCusto(custo: Custo, personagem: Personagem, lerFormula: (formula: string) => number | null): number | null {
  const { quanto } = custo
  if ('fixo' in quanto) return quanto.fixo
  if ('formula' in quanto) {
    const valor = lerFormula(quanto.formula)
    return valor === null ? null : Math.max(0, Math.floor(valor))
  }
  // O máximo que a ficha não tem não vira 0 de custo: vira pergunta (como `custoPeloMaximo` da F2).
  const maximo: number | undefined = personagem.maximos[custo.recurso]
  const base = quanto.de === 'maximo' ? maximo : numeroDaFicha(personagem.recursos, custo.recurso)
  return base === undefined ? null : Math.max(0, Math.floor((base * quanto.porcento) / 100))
}

/**
 * O custo que bloqueia, como o texto o daria: o "ao usar" (ou, sem ele, o
 * "por vez", com `porTurno`). O "depois" não bloqueia: vai na linha
 * (`custoEmHp`) e cobra ao lançar.
 */
export function custoDasPecas(mecanica: MecanicaV1, personagem: Personagem, lerFormula: (formula: string) => number | null): LeituraDoCusto {
  const aoUsar = mecanica.custos.find((custo) => custo.quando === 'aoUsar')
  const custo = aoUsar ?? mecanica.custos.find((custo) => custo.quando === 'porTurno')
  if (custo === undefined) return { tipo: 'nada' }
  const valor = valorDoCusto(custo, personagem, lerFormula)
  if (valor === null) return { tipo: 'pergunta', recurso: custo.recurso, sugestao: null, texto: 'A fórmula do custo não fecha com esta ficha' }
  return { tipo: 'valor', recurso: custo.recurso, valor, porTurno: custo.quando === 'porTurno' }
}

/** A ação como `lerAcao` daria; `perguntar` = `null` (a mira pergunta, como na transformação). */
export function acaoDasPecas(mecanica: MecanicaV1): LeituraDaAcao {
  const acao = mecanica.acao === 'perguntar' ? null : mecanica.acao
  // Fase 4: "no lugar da reação" (ou os dois) aparece também na caixa REAÇÃO.
  return { acao, overload: mecanica.limite.overload === true, transformacao: false, tambemReacao: usoDeReacao(mecanica) }
}

/** Fase 4: a técnica entra na caixa REAÇÃO (só nela, ou também na vez). */
export function usoDeReacao(mecanica: Pick<MecanicaV1, 'uso'>): boolean {
  return mecanica.uso === 'reacao' || mecanica.uso === 'ativaOuReacao'
}

/** O nome do botão de cada defesa montada, como a caixa REAÇÃO o mostra. */
function rotuloDaDefesa(defesa: Exclude<ReacaoDaMecanica['defesa'], { tipo: 'rola' }>): string {
  if (defesa.tipo === 'anula') return 'Anula o golpe'
  return defesa.tipo === 'fica' ? `Fica com ${defesa.porcento}%` : 'Toma o golpe'
}

/**
 * Fase 4: a reação montada vira a MESMA linha da tabela à mão que a Armadura
 * Humana e o Giro da Lança usam (`ReacaoAMao`): uma saída com a parte do dano
 * que fica, o que volta em quem atacou e a cura, ou a rolagem própria. Assim a
 * caixa REAÇÃO, o host e o Desfazer não mudam.
 */
export function reacaoNaTabela(reacao: ReacaoDaMecanica): ReacaoAMao {
  const { defesa } = reacao
  const lida: ReacaoAMao = {}
  if (defesa.tipo === 'rola') {
    lida.rolagem = { atributos: defesa.atributos, anulaCom: defesa.anulaCom }
  } else {
    const saida: SaidaDaReacaoAMao =
      defesa.tipo === 'anula'
        ? { saida: 'esquiva', rotulo: rotuloDaDefesa(defesa), noAlvo: 'esquiva', fator: 0 }
        : defesa.tipo === 'fica'
          ? { saida: 'metade', rotulo: rotuloDaDefesa(defesa), noAlvo: 'metade', fator: defesa.porcento / 100 }
          : { saida: 'cheio', rotulo: rotuloDaDefesa(defesa), noAlvo: 'cheio', fator: 1 }
    if (reacao.devolve !== undefined) saida.devolveDividido = reacao.devolve.divididoPor
    if (reacao.curaDoQueChegava !== undefined) saida.curaDoQueChega = reacao.curaDoQueChegava
    lida.saidas = [saida]
  }
  if (reacao.valeContra?.includes('overload') === true) lida.contraOverload = true
  if (reacao.valeContra?.includes('surpresa') === true) lida.contraSurpresa = true
  if (reacao.soOMestre === true) lida.soOMestre = MOTIVO_SO_O_MESTRE_NA_REACAO
  return lida
}

/** O motivo da reação montada marcada "só o mestre" (o jogador vê o botão apagado e pede a ele). */
export const MOTIVO_SO_O_MESTRE_NA_REACAO = 'Só o mestre usa esta reação: peça a ele'

/** Fase 4: o selo que a reação montada põe em quem atacou; `null` = nenhum. */
export function seloNoAtacanteDasPecas(mecanica: MecanicaV1): SeloPedido | null {
  const selo = mecanica.efeitos.find((efeito) => efeito.tipo === 'selo' && efeito.em === 'atacante')
  if (selo === undefined || selo.tipo !== 'selo') return null
  return { nome: selo.nome, turnos: typeof selo.duracao === 'number' ? selo.duracao : null }
}

/** O Tempo como `lerTempo` daria. */
export function tempoDasPecas(mecanica: MecanicaV1): LeituraDoTempo {
  const { recarga, usosPorBatalha, overload } = mecanica.limite
  if (recarga !== undefined) return { tipo: 'recarga', turnos: recarga }
  if (usosPorBatalha !== undefined) return { tipo: 'usos', vezes: usosPorBatalha }
  return overload === true ? { tipo: 'overload' } : { tipo: 'livre' }
}

/**
 * Quem reage: "não erra" ou o golpe em si ou nos aliados (ajuda não se
 * esquiva, como o Buff) = ninguém; com selo ou sem dano = reage sempre
 * (esquivou, o efeito não pega); o resto, só com dano.
 */
export function reacaoDasPecas(mecanica: MecanicaV1): ReacaoDoTipo {
  // Construtor C4: com teste de resistência ou disputa, a defesa é o teste rolado ao usar (o alvo não reage com o d20 de sempre).
  if (mecanica.teste.tipo === 'naoErra' || testeRolado(mecanica.teste) || mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si') return 'nunca'
  const temSelo = mecanica.efeitos.some((efeito) => efeito.tipo === 'selo')
  return temSelo || mecanica.dano === undefined ? 'sempre' : 'comDano'
}

/** Os multiplicadores do golpe montado, na ordem de `danoQueChega` (os extras na ordem da lista). */
export interface MultiplicadoresDasPecas {
  surpresa: boolean
  extras: readonly number[]
}

export function multiplicadoresDasPecas(mecanica: MecanicaV1): MultiplicadoresDasPecas {
  const mult = mecanica.dano?.multiplicadores
  return { surpresa: mult?.surpresa !== false, extras: (mult?.extra ?? []).map((extra) => extra.vezes) }
}

/** O dano divide entre os marcados (com o teto de alvos); `null` = cada um toma o golpe inteiro. */
export function divisaoDasPecas(mecanica: MecanicaV1): number | null {
  const { forma } = mecanica.alvo
  return forma.tipo === 'varios' && forma.dividirDano === true ? forma.max : null
}

/** A forma do alvo como a área de hoje (`area.ts`) a desenha; `null` = alvo marcado à mão. */
function areaDaForma(forma: FormaDoAlvo): FormaDaArea | null {
  switch (forma.tipo) {
    case 'linha':
      return { tipo: 'linha', alcance: forma.casas }
    case 'raio':
      return { tipo: 'raio', casas: forma.casas }
    case 'quadrado':
      // Em volta de quem usa, lado ímpar (a leitura confere): 3x3 = raio 1, 5x5 = raio 2.
      return forma.centro === 'frente' ? { tipo: 'frente', lado: forma.lado } : { tipo: 'raio', casas: (forma.lado - 1) / 2 }
    case 'um':
    case 'varios':
      return null
    // Fase C do alcance (ALCANCE.md §5): a cruz e o leque marcam pela grade como as outras áreas de quem usa.
    case 'cruz':
      return { tipo: 'cruz', casas: forma.casas }
    case 'leque':
      return { tipo: 'leque', casas: forma.casas }
  }
}

/**
 * B21 (fase 5): a técnica montada muda com a Concentração guardada? Só o
 * dano que multiplica com ela, a cura por carga e a CD por carga. A que não
 * muda não gasta a carga (`gastaACarga`).
 */
export function pecasUsamACarga(mecanica: MecanicaV1): boolean {
  if (mecanica.dano?.multiplicadores.concentracao === true) return true
  if (mecanica.efeitos.some((efeito) => efeito.tipo === 'cura' && 'porCarga' in efeito.quanto)) return true
  return mecanica.teste.tipo === 'resistencia' && 'porCarga' in mecanica.teste.cd
}

/** A cura e a limpeza das peças como a da Revigorar (`LimpezaAMao`); `null` = nenhuma das duas. */
function limpezaDasPecas(mecanica: MecanicaV1): LimpezaAMao | null {
  const [cura, outra] = mecanica.efeitos.filter((efeito): efeito is Extract<MecanicaV1['efeitos'][number], { tipo: 'cura' }> => efeito.tipo === 'cura' && efeito.em === undefined)
  const tirar = mecanica.efeitos.find((efeito): efeito is Extract<MecanicaV1['efeitos'][number], { tipo: 'tirarSelos' }> => efeito.tipo === 'tirarSelos')
  const tira = tirar !== undefined
  if (cura === undefined && !tira) return null
  // Só tirar selos: a limpeza da F2 sempre cura; "0" não mexe na ficha. Fase 7: a parte do máximo do alvo vai à parte (a store lê o alvo).
  const limpeza: LimpezaAMao = { cura: cura === undefined || 'porcento' in cura.quanto ? '0' : formulaDoNumero(semCarga(cura.quanto)) }
  if (cura !== undefined && 'porcento' in cura.quanto) limpeza.porcentoDoMaximo = cura.quanto.porcento
  // Fase 7 (o Elixir): a segunda cura no mesmo alvo, de outro recurso.
  if (outra !== undefined) limpeza.tambem = 'porcento' in outra.quanto ? { recurso: outra.recurso, formula: '0', porcentoDoMaximo: outra.quanto.porcento } : { recurso: outra.recurso, formula: formulaDoNumero(semCarga(outra.quanto)) }
  if (cura !== undefined && 'porCarga' in cura.quanto) {
    const [, um, dois, tres] = cura.quanto.porCarga
    limpeza.porCarga = { 1: formulaDoNumero(um), 2: formulaDoNumero(dois), 3: formulaDoNumero(tres) }
  }
  if (!tira) limpeza.soCura = true
  // Fase 5: recuperar SP ou dar Escudo; tirar pelo nome, as positivas ou todas.
  if (cura !== undefined && cura.recurso !== 'hp') limpeza.recurso = cura.recurso
  if (tirar !== undefined && tirar.quais !== 'negativos') limpeza.tira = tirar.quais
  return limpeza
}

/**
 * O selo que o golpe põe no acerto; `null` = nenhum. Construtor C5: a regra
 * do selo vem do nome (`condicoes.ts`), e a peça leva o que o nome não diz: o
 * "tira X por vez" (o `porVez` que o lembrete Aplicar usa) e o "até o próximo
 * golpe" (sem turnos: sai quando outro golpe chega nele).
 */
export function seloDasPecas(mecanica: MecanicaV1): SeloDoGolpe | null {
  return selosDasPecas(mecanica).noAlvo[0] ?? null
}

type SeloDaPeca = Extract<MecanicaV1['efeitos'][number], { tipo: 'selo' }>

/**
 * Um selo da peça como o golpe o guarda. Fase 5: os números ("Força +20"; a
 * fórmula é lida na ficha de quem usa, e sem `valorNaFicha` o número da
 * fórmula fica de fora), a regra, a regeneração e o dreno de SP por vez.
 */
function seloDaPeca(selo: SeloDaPeca, valorNaFicha?: (formula: string) => number | null): SeloDoGolpe {
  const lido: SeloDoGolpe = { nome: selo.nome, turnos: typeof selo.duracao === 'number' ? selo.duracao : null }
  if (selo.natureza !== undefined) lido.natureza = selo.natureza
  const porTurno = selo.porTurno
  // O HP tirado por vez é o de sempre (o lembrete "Aplicar"); o SP tirado é o dreno do fim da vez; o "dá" é a regeneração.
  if (porTurno !== undefined && porTurno.sinal !== 'da' && porTurno.recurso === 'hp') lido.porVez = porTurno.quanto.fixo
  if (selo.duracao === 'proximoGolpe') lido.saiNoProximoGolpe = true
  const mods = (selo.mods ?? []).flatMap((mod) => {
    const valor = 'fixo' in mod.delta ? mod.delta.fixo : (valorNaFicha?.(mod.delta.formula) ?? null)
    const delta = valor === null ? 0 : Math.trunc(valor)
    return delta === 0 ? [] : [{ alvo: mod.alvo, delta }]
  })
  if (mods.length > 0) lido.mods = mods
  if (selo.regra !== undefined) {
    const regra: NonNullable<SeloDoGolpe['regra']> = {}
    if (selo.regra.danoRecebido !== undefined) regra.danoRecebido = selo.regra.danoRecebido
    if (selo.regra.curaRecebida !== undefined) regra.curaRecebida = selo.regra.curaRecebida
    // Fase ED4: o Congelado do tipo do golpe (a reação de quem o tem rola com desvantagem).
    if (selo.regra.reageComDesvantagem === true) regra.reageComDesvantagem = true
    lido.regra = regra
  }
  if (porTurno?.sinal === 'da') lido.regenera = { recurso: porTurno.recurso, quanto: porTurno.quanto.fixo }
  else if (porTurno?.recurso === 'sp') lido.drenaSp = { quanto: porTurno.quanto.fixo, paraQuemUsa: porTurno.paraQuemUsa ?? 0 }
  // Fase C do alcance: o selo que muda o alcance de quem o tem segue para a carta (o host lê na hora do golpe).
  if (selo.alcance !== undefined) lido.alcance = selo.alcance
  // Fase ED4: o teste do selo ("com teste"): o alvo acertado rola antes de o selo entrar (`stores/batalha/selos.ts`).
  if (selo.pega !== undefined) lido.pega = { atributoId: selo.pega.atributo, cd: cdDoTeste(selo.pega.cd) }
  return lido
}

/**
 * Fase 5: os selos do golpe da vez (até 3 no alvo e 1 em quem usa). O selo
 * em quem atacou é da reação (`seloNoAtacanteDasPecas`), nunca do golpe da vez.
 */
export function selosDasPecas(mecanica: MecanicaV1, valorNaFicha?: (formula: string) => number | null): { noAlvo: SeloDoGolpe[]; emQuemUsa: SeloDoGolpe | null } {
  const selos = mecanica.efeitos.filter((efeito): efeito is SeloDaPeca => efeito.tipo === 'selo')
  const emQuemUsa = selos.find((selo) => selo.em === 'quemUsa')
  return { noAlvo: selos.filter((selo) => selo.em === undefined).map((selo) => seloDaPeca(selo, valorNaFicha)), emQuemUsa: emQuemUsa === undefined ? null : seloDaPeca(emQuemUsa, valorNaFicha) }
}

/** Fase 5: a recusa do alvo sem o selo que a técnica pede (`alvo.exigeSelo`). */
export function motivoDoSeloExigido(nome: string): string {
  return `Só vale em quem tem ${nome}`
}

/** Os lembretes à mão, juntos (a mira mostra um texto só). */
function lembretesDasPecas(mecanica: MecanicaV1): string | null {
  const textos = mecanica.efeitos.flatMap((efeito) => (efeito.tipo === 'aMao' ? [efeito.texto] : []))
  return textos.length === 0 ? null : textos.join(' · ')
}

/**
 * A linha da tabela à mão que as peças dão. Só os campos que as peças
 * preenchem; o resto fica ausente (= "não tem", como na técnica sem linha).
 */
export function linhaDasPecas(nome: string, mecanica: MecanicaV1): MecanicaAMao {
  const linha: MecanicaAMao = { nome }
  if (mecanica.acao !== 'perguntar') linha.acao = mecanica.acao
  if (mecanica.limite.usosPorBatalha !== undefined) linha.usosPorBatalha = mecanica.limite.usosPorBatalha
  if (mecanica.teste.tipo === 'naoErra') linha.semReacao = true
  // Construtor C4: o teste vira a disputa da F2, rolada ao usar; o alvo não reage (a defesa é o teste).
  const disputa = disputaDoTeste(mecanica.teste)
  if (disputa !== null) {
    linha.disputa = disputa
    linha.semReacao = true
  }
  for (const custo of mecanica.custos) {
    if (custo.quando === 'aoUsar' && 'porcento' in custo.quanto && custo.quanto.de === 'maximo') linha.custoDoMaximo = { recurso: custo.recurso, porcento: custo.quanto.porcento }
    // A técnica mantida: o "por vez" é sempre fixo (a leitura confere).
    if (custo.quando === 'porTurno' && 'fixo' in custo.quanto) linha.mantida = { custoPorVez: { recurso: custo.recurso, valor: custo.quanto.fixo } }
    // O "depois" em HP fixo é o "Técnica Incompleta" da Sai Dai Rin: cobra ao lançar, sem bloquear.
    if (custo.quando === 'depois' && custo.recurso === 'hp' && 'fixo' in custo.quanto) linha.custoEmHp = custo.quanto.fixo
  }
  const { dano } = mecanica
  if (dano !== undefined) {
    linha.dano = formulaDoNumero(dano.base)
    // Fase 5 (B13): a perfuração parcial deixa o golpe perfurante, com só aquela parte direto no HP.
    linha.perfurante = dano.perfurante === true || dano.perfuracao !== undefined
    if (dano.perfuracao !== undefined) linha.perfuracao = dano.perfuracao
    // Fase 5 (B17): o 2º golpe das peças pela mesma porta do da tabela (o Rapid Dash).
    if (dano.segundoGolpe !== undefined) linha.segundoGolpe = { fracao: dano.segundoGolpe.fracao, perfurante: dano.segundoGolpe.perfurante }
    if (!dano.multiplicadores.concentracao) linha.semConcentracao = true
  } else {
    linha.perfurante = false
  }
  const { forma, quem } = mecanica.alvo
  const area = areaDaForma(forma)
  // Construtor C3: "a escolher" e "todos" marcam todos na área (quem usa desmarca); "aliados" só os do lado dele.
  if (area !== null) linha.area = { forma: area, quem: quem === 'inimigos' || quem === 'aliados' ? quem : 'todos' }
  // Fase 6: a área longe (em volta de um ponto ou de uma ficha), o alcance e o reviver.
  const centro = centroDaArea(forma)
  if (linha.area !== undefined && centro !== null) linha.area.centro = centro
  if (mecanica.alvo.alcance !== undefined) linha.alcance = mecanica.alvo.alcance
  const reviver = mecanica.efeitos.find((efeito) => efeito.tipo === 'reviver')
  if (reviver !== undefined && reviver.tipo === 'reviver') linha.reviver = 'porcento' in reviver.volta ? { porcento: reviver.volta.porcento } : { formula: formulaDoNumero(reviver.volta) }
  if (forma.tipo === 'varios' && forma.dividirDano === true) linha.divide = { teto: forma.max }
  else if (forma.tipo === 'varios') linha.tetoDeAlvosComDano = forma.max
  else if (forma.tipo === 'um') linha.tetoDeAlvosComDano = 1
  const { noAlvo, emQuemUsa } = selosDasPecas(mecanica)
  const [selo, ...selosAMais] = noAlvo
  if (selo !== undefined) linha.selo = selo
  // Fase 5: os outros selos do golpe e o de quem usa (o golpe os relê com a ficha, para a fórmula dos números: `golpe.ts`).
  if (selosAMais.length > 0) linha.selosAMais = selosAMais
  if (emQuemUsa !== null) linha.seloEmQuemUsa = emQuemUsa
  if (mecanica.alvo.exigeSelo !== undefined) linha.soContraOSelo = { nome: mecanica.alvo.exigeSelo, motivo: motivoDoSeloExigido(mecanica.alvo.exigeSelo) }
  // Fase 5: a cura em quem usa, o roubo de vida e o item da mochila (a Medicina das peças).
  const curaEmQuemUsa = mecanica.efeitos.find((efeito) => efeito.tipo === 'cura' && efeito.em === 'quemUsa')
  // A parte do máximo em quem usa é recusada na leitura (`lerMecanica`): aqui só chega número ou fórmula.
  if (curaEmQuemUsa !== undefined && curaEmQuemUsa.tipo === 'cura' && !('porcento' in curaEmQuemUsa.quanto)) linha.curaEmQuemUsa = { recurso: curaEmQuemUsa.recurso, formula: formulaDoNumero(semCarga(curaEmQuemUsa.quanto)) }
  const dreno = mecanica.efeitos.find((efeito) => efeito.tipo === 'dreno')
  if (dreno !== undefined && dreno.tipo === 'dreno') linha.curaDoDano = dreno.porcentoDoDano
  const item = mecanica.custoEmItem
  if (item !== undefined) {
    linha.gastaItem = item.nome
    if (item.quantos !== 1) linha.gastaItemQuantos = item.quantos
    if (item.itemId !== undefined) linha.gastaItemId = item.itemId
  }
  const limpa = limpezaDasPecas(mecanica)
  if (limpa !== null) linha.limpa = limpa
  const lembrete = lembretesDasPecas(mecanica)
  if (lembrete !== null) linha.lembreteNaMira = lembrete
  if (mecanica.reacao !== undefined) linha.reacao = reacaoNaTabela(mecanica.reacao)
  return linha
}

/** As linhas já traduzidas, pela mesma chave da leitura. */
const linhas = new WeakMap<object, MecanicaAMao>()

/**
 * A linha do cartão montado: a das peças, ou (torto, futuro) a linha vazia
 * com o aviso na mira. `null` = o cartão não é montado (vale a tabela).
 */
export function linhaDoCartaoMontado(cartao: Pick<CartaoDaFicha, 'mecanica'> & { nome?: string }): MecanicaAMao | null {
  const guardada = cartao.mecanica
  if (guardada === undefined) return null
  const memoria = linhas.get(guardada)
  if (memoria !== undefined) return memoria
  const lida = mecanicaLidaDoCartao(cartao)
  const nome = cartao.nome?.trim() || 'Técnica montada'
  const linha: MecanicaAMao = lida.tipo === 'pecas' ? linhaDasPecas(nome, lida.mecanica) : { nome, lembreteNaMira: avisoDaMecanica(lida.tipo === 'nenhuma' ? { tipo: 'invalida', motivo: 'vazia' } : lida) }
  linhas.set(guardada, linha)
  return linha
}

/** O aviso do cartão montado que o app não executa; `null` = peças válidas ou cartão de texto. */
export function avisoDoCartaoMontado(cartao: Pick<CartaoDaFicha, 'mecanica'>): string | null {
  const lida = mecanicaLidaDoCartao(cartao)
  return lida.tipo === 'invalida' || lida.tipo === 'futura' ? avisoDaMecanica(lida) : null
}
