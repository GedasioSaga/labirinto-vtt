import { HISTORICO_MAX, numeroDaFicha, type CartaoDaFicha, type ParteDoAjuste, type Personagem, type RegistroDaFicha } from './personagem'
import type { SistemaDeRpg } from './sistemaDeRpg'

/**
 * AJUSTE RÁPIDO DA FICHA — o − e o + do HP, o "-50" de dano, a Força que
 * sobe de nível, a transformação que liga: muda NA HORA, sem Editar/Salvar,
 * e fica no "Histórico" da ficha.
 *
 * As contas são as mesmas nas três pontas: o mestre (`adventureStore`), a
 * ficha otimista do jogador (o que ele vê antes de a mesa confirmar) e o host
 * (o pedido do jogador aceito). Por isso o host não confia no número que
 * chega: passa de novo por `aplicarAjuste`, que limita cada parte.
 *
 * Regras (decisões de 08/10/2026):
 *  - o ATUAL do HP/SP fica entre 0 e o máximo de verdade: o dano para no 0
 *    (o personagem caiu; o excesso não é guardado) e a cura para no máximo
 *    (vida extra é o Escudo); o máximo que cai puxa o atual junto;
 *  - máximo base, base de atributo e recurso de um número só (Escudo) não
 *    ficam negativos; modificador pode (é penalidade);
 *  - o total de um atributo (e o máximo de um recurso) é base + modificador
 *    + os cartões LIGADOS que mexem nele; vários ligados SOMAM — a regra que
 *    a pessoa prevê sem ler manual, e o mestre desliga o que não acumula;
 *  - o rank sai do total (`valorDoRank`).
 *
 * Puro: nada de store, nada de rede, nada de relógio (quem chama dá o `quando`).
 */

/** Teto de qualquer número da ficha: sobra para toda mesa e nunca vira notação científica na tela. */
export const NUMERO_DA_FICHA_MAX = 1_000_000

/**
 * Um ajuste: o valor NOVO de uma parte, e não "−1". Absoluto, para o jogador
 * poder juntar dez cliques num pedido só (vale o último) e para o mesmo
 * pedido, repetido, não descontar duas vezes. `cartao`: 1 liga, 0 desliga.
 */
export interface Ajuste {
  parte: ParteDoAjuste
  chave: string
  valor: number
}

/** Um cartão ligado que soma num número: "+10 Forma Híbrida". */
export interface ParcelaDoCartao {
  nome: string
  delta: number
}

/** Um número da ficha aberto em partes: base + modificador + cartões ligados = total. */
export interface ValorComposto {
  base: number
  modificador: number
  cartoes: ParcelaDoCartao[]
  total: number
}

type CampoNumerico = 'recursos' | 'maximos' | 'modificadoresDosRecursos' | 'atributos' | 'modificadoresDosAtributos'

const CAMPOS_NUMERICOS: readonly CampoNumerico[] = ['recursos', 'maximos', 'modificadoresDosRecursos', 'atributos', 'modificadoresDosAtributos']

const limitar = (valor: number, min: number, max: number): number => Math.min(max, Math.max(min, valor))

/** Os cartões de primeiro nível da ficha, em todas as abas (a transformação; a técnica dentro dela não liga sozinha). */
function cartoesDaFicha(personagem: Personagem): CartaoDaFicha[] {
  return Object.values(personagem.abas).flat()
}

/** Os cartões que PODEM ligar: os das abas com modificadores (as transformações do One Piece). */
export function cartoesQueLigam(personagem: Personagem, sistema: SistemaDeRpg): CartaoDaFicha[] {
  return sistema.abas.filter((aba) => aba.modificadores === true).flatMap((aba) => personagem.abas[aba.id] ?? [])
}

/**
 * O que os cartões ligados somam numa chave — atributo, ou recurso de atual
 * e máximo (o modificador "HP +100" da transformação mexe no máximo). Cartão
 * ligado que não existe mais (apagado na edição) não soma nada.
 */
export function parcelasDosCartoes(personagem: Personagem, chave: string): ParcelaDoCartao[] {
  if (personagem.cartoesAtivos.length === 0) return []
  const ligados = new Set(personagem.cartoesAtivos)
  return cartoesDaFicha(personagem)
    .filter((cartao) => ligados.has(cartao.id))
    .flatMap((cartao) => {
      const delta = cartao.modificadores.filter((mod) => mod.atributo === chave).reduce((soma, mod) => soma + mod.delta, 0)
      return delta === 0 ? [] : [{ nome: cartao.nome, delta }]
    })
}

function composto(base: number, modificador: number, cartoes: ParcelaDoCartao[]): ValorComposto {
  return { base, modificador, cartoes, total: base + modificador + cartoes.reduce((soma, parcela) => soma + parcela.delta, 0) }
}

export function atributoComposto(personagem: Personagem, atributoId: string): ValorComposto {
  return composto(numeroDaFicha(personagem.atributos, atributoId), numeroDaFicha(personagem.modificadoresDosAtributos, atributoId), parcelasDosCartoes(personagem, atributoId))
}

/** O número que vai na tabela de rank: o TOTAL do atributo (decisão do usuário, 08/10/2026). Trocar a regra é mexer só aqui. */
export function valorDoRank(personagem: Personagem, atributoId: string): number {
  return atributoComposto(personagem, atributoId).total
}

/** O máximo base gravado; na ficha de antes (um número só), o próprio atual. */
export function maximoBase(personagem: Personagem, recursoId: string): number {
  return personagem.maximos[recursoId] ?? numeroDaFicha(personagem.recursos, recursoId)
}

/** O máximo de verdade (base + modificador + cartões), nunca abaixo de 0. */
export function maximoComposto(personagem: Personagem, recursoId: string): ValorComposto {
  const valor = composto(maximoBase(personagem, recursoId), numeroDaFicha(personagem.modificadoresDosRecursos, recursoId), parcelasDosCartoes(personagem, recursoId))
  return { ...valor, total: Math.max(0, valor.total) }
}

/** O recurso tem atual e máximo neste sistema? Chave que o sistema não conhece: não. */
export function temMaximo(sistema: SistemaDeRpg, recursoId: string): boolean {
  return sistema.recursos.some((recurso) => recurso.id === recursoId && recurso.atualEMaximo === true)
}

function trocar(personagem: Personagem, campo: CampoNumerico, chave: string, valor: number): Personagem {
  if (personagem[campo][chave] === valor) return personagem
  const copia: Personagem = { ...personagem }
  copia[campo] = { ...personagem[campo], [chave]: valor }
  return copia
}

/** Grava o máximo que hoje é só "o atual de antes": mudar o atual depois não pode arrastar o máximo junto. */
function comMaximoGravado(personagem: Personagem, recursoId: string): Personagem {
  return personagem.maximos[recursoId] === undefined ? trocar(personagem, 'maximos', recursoId, maximoBase(personagem, recursoId)) : personagem
}

/** O atual que passou do máximo (o máximo caiu, a transformação desligou) desce até ele. */
function atualAteOMaximo(personagem: Personagem, recursoId: string): Personagem {
  const maximo = maximoComposto(personagem, recursoId).total
  return numeroDaFicha(personagem.recursos, recursoId) <= maximo ? personagem : trocar(personagem, 'recursos', recursoId, maximo)
}

/** Os recursos de atual e máximo que os modificadores do cartão mexem. */
function recursosDoCartao(sistema: SistemaDeRpg, cartao: CartaoDaFicha): string[] {
  return [...new Set(cartao.modificadores.map((mod) => mod.atributo).filter((chave) => temMaximo(sistema, chave)))]
}

function ligarCartao(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string, ligar: boolean): Personagem {
  if (personagem.cartoesAtivos.includes(cartaoId) === ligar) return personagem
  const cartao = cartoesQueLigam(personagem, sistema).find((candidato) => candidato.id === cartaoId)
  // Desligar o que não existe mais só limpa a lista; ligar exige o cartão numa aba de transformações.
  if (cartao === undefined && ligar) return personagem
  const recursos = cartao === undefined ? [] : recursosDoCartao(sistema, cartao)
  const gravado = recursos.reduce(comMaximoGravado, personagem)
  const cartoesAtivos = ligar ? [...gravado.cartoesAtivos, cartaoId] : gravado.cartoesAtivos.filter((id) => id !== cartaoId)
  return recursos.reduce(atualAteOMaximo, { ...gravado, cartoesAtivos })
}

/**
 * Um ajuste, já dentro das regras (ver o topo). Chave que o sistema não
 * conhece, parte que o recurso não tem (o máximo do Escudo) e número que não
 * é número são ignorados: devolve o MESMO personagem, e quem chama sabe que
 * nada mudou.
 */
export function aplicarAjuste(personagem: Personagem, sistema: SistemaDeRpg, ajuste: Ajuste): Personagem {
  const { parte, chave } = ajuste
  if (!Number.isFinite(ajuste.valor)) return personagem
  const valor = Math.trunc(ajuste.valor)
  const recurso = sistema.recursos.some((candidato) => candidato.id === chave)
  const atributo = sistema.atributos.some((candidato) => candidato.id === chave)
  switch (parte) {
    case 'recurso': {
      if (!recurso) return personagem
      if (!temMaximo(sistema, chave)) return trocar(personagem, 'recursos', chave, limitar(valor, 0, NUMERO_DA_FICHA_MAX))
      const gravado = comMaximoGravado(personagem, chave)
      const novo = trocar(gravado, 'recursos', chave, limitar(valor, 0, maximoComposto(gravado, chave).total))
      return novo === gravado ? personagem : novo
    }
    case 'maximo':
      if (!temMaximo(sistema, chave)) return personagem
      return atualAteOMaximo(trocar(personagem, 'maximos', chave, limitar(valor, 0, NUMERO_DA_FICHA_MAX)), chave)
    case 'modRecurso': {
      if (!temMaximo(sistema, chave)) return personagem
      const gravado = comMaximoGravado(personagem, chave)
      const novo = atualAteOMaximo(trocar(gravado, 'modificadoresDosRecursos', chave, limitar(valor, -NUMERO_DA_FICHA_MAX, NUMERO_DA_FICHA_MAX)), chave)
      return novo === gravado ? personagem : novo
    }
    case 'atributo':
      return atributo ? trocar(personagem, 'atributos', chave, limitar(valor, 0, NUMERO_DA_FICHA_MAX)) : personagem
    case 'modAtributo':
      return atributo ? trocar(personagem, 'modificadoresDosAtributos', chave, limitar(valor, -NUMERO_DA_FICHA_MAX, NUMERO_DA_FICHA_MAX)) : personagem
    case 'cartao':
      return valor === 0 || valor === 1 ? ligarCartao(personagem, sistema, chave, valor === 1) : personagem
  }
}

/**
 * A troca CRUA de um número, para a edição (Editar/Salvar): sem as regras do
 * ajuste, porque o campo passa por valores do meio enquanto a pessoa digita
 * ("8" antes de "800" no máximo puxaria o atual para 8). Só o teto. Aqui o
 * máximo NÃO é gravado antes de o atual mudar: sem máximo gravado, a ficha é
 * de um número só, e digitar o atual é digitar os dois (600 vira 600/600) —
 * gravar o "atual de antes" a cada tecla deixaria 600/6. O máximo passa a
 * valer por si quando alguém o digita.
 */
export function trocarNumero(personagem: Personagem, parte: Exclude<ParteDoAjuste, 'cartao'>, chave: string, valor: number): Personagem {
  const dentro = limitar(Math.trunc(valor), -NUMERO_DA_FICHA_MAX, NUMERO_DA_FICHA_MAX)
  switch (parte) {
    case 'recurso':
      return trocar(personagem, 'recursos', chave, dentro)
    case 'maximo':
      return trocar(personagem, 'maximos', chave, Math.max(0, dentro))
    case 'modRecurso':
      return trocar(personagem, 'modificadoresDosRecursos', chave, dentro)
    case 'atributo':
      return trocar(personagem, 'atributos', chave, dentro)
    case 'modAtributo':
      return trocar(personagem, 'modificadoresDosAtributos', chave, dentro)
  }
}

/** O valor de uma parte como a ficha o mostra: o máximo da ficha de antes é o atual; o cartão é 1 (ligado) ou 0. */
export function valorDaParte(personagem: Personagem, parte: ParteDoAjuste, chave: string): number {
  switch (parte) {
    case 'recurso':
      return numeroDaFicha(personagem.recursos, chave)
    case 'maximo':
      return maximoBase(personagem, chave)
    case 'modRecurso':
      return numeroDaFicha(personagem.modificadoresDosRecursos, chave)
    case 'atributo':
      return numeroDaFicha(personagem.atributos, chave)
    case 'modAtributo':
      return numeroDaFicha(personagem.modificadoresDosAtributos, chave)
    case 'cartao':
      return personagem.cartoesAtivos.includes(chave) ? 1 : 0
  }
}

/** O nome da parte agora: o do recurso, do atributo ou do cartão; sem nome conhecido, a chave. */
export function rotuloDaParte(sistema: SistemaDeRpg, personagem: Personagem, parte: ParteDoAjuste, chave: string): string {
  if (parte === 'cartao') return cartoesDaFicha(personagem).find((cartao) => cartao.id === chave)?.nome ?? chave
  const itens: readonly { id: string; nome: string }[] = parte === 'atributo' || parte === 'modAtributo' ? sistema.atributos : sistema.recursos
  return itens.find((item) => item.id === chave)?.nome ?? chave
}

/** As partes que um ajuste pode mudar: a dele e, quando mexe no máximo, o atual que o máximo empurra. */
function partesMexidas(sistema: SistemaDeRpg, personagem: Personagem, ajuste: Ajuste): { parte: ParteDoAjuste; chave: string }[] {
  const propria = { parte: ajuste.parte, chave: ajuste.chave }
  if (ajuste.parte === 'maximo' || ajuste.parte === 'modRecurso') return [propria, { parte: 'recurso', chave: ajuste.chave }]
  if (ajuste.parte !== 'cartao') return [propria]
  const cartao = cartoesDaFicha(personagem).find((candidato) => candidato.id === ajuste.chave)
  const recursos = cartao === undefined ? [] : recursosDoCartao(sistema, cartao)
  return [propria, ...recursos.map((chave): { parte: ParteDoAjuste; chave: string } => ({ parte: 'recurso', chave }))]
}

/**
 * Ajustes do mesmo campo, pela mesma pessoa, com menos que isto entre um e
 * outro, viram UMA linha: dez cliques no "−" são "HP 600 → 590", e não dez.
 */
export const JANELA_DO_REGISTRO_MS = 5_000

/**
 * Mais uma linha no histórico, juntando com a anterior do MESMO campo quando
 * é da mesma pessoa e ainda dentro da janela (a linha juntada vai para o
 * fim, com o "de" de quando começou). Se outra pessoa mexeu no campo no meio,
 * a linha dela fica e a nova começa do valor que ela deixou. Ida e volta
 * (−1 e +1) não deixa linha. No máximo `HISTORICO_MAX`: as mais velhas saem.
 */
export function registrar(historico: readonly RegistroDaFicha[], novo: RegistroDaFicha): RegistroDaFicha[] {
  let indice = -1
  for (let i = historico.length - 1; i >= 0; i -= 1) {
    if (historico[i].parte === novo.parte && historico[i].chave === novo.chave) {
      indice = i
      break
    }
  }
  const anterior = indice === -1 ? undefined : historico[indice]
  const passou = anterior === undefined ? Infinity : novo.quando - anterior.quando
  if (anterior === undefined || anterior.quem !== novo.quem || passou < 0 || passou >= JANELA_DO_REGISTRO_MS) return [...historico, novo].slice(-HISTORICO_MAX)
  const semAnterior = [...historico.slice(0, indice), ...historico.slice(indice + 1)]
  if (anterior.de === novo.para) return semAnterior
  return [...semAnterior, { ...novo, de: anterior.de }].slice(-HISTORICO_MAX)
}

/**
 * Os ajustes em ordem, cada um pelas regras, e cada valor que MUDOU de
 * verdade no histórico em nome de `quem` (o atual que o máximo empurrou
 * também). Nada mudou = o MESMO personagem.
 */
export function aplicarAjustes(personagem: Personagem, sistema: SistemaDeRpg, ajustes: readonly Ajuste[], quem: string, quando: number): Personagem {
  let atual = personagem
  let historico = personagem.historico
  for (const ajuste of ajustes) {
    const depois = aplicarAjuste(atual, sistema, ajuste)
    if (depois === atual) continue
    for (const { parte, chave } of partesMexidas(sistema, atual, ajuste)) {
      const de = valorDaParte(atual, parte, chave)
      const para = valorDaParte(depois, parte, chave)
      if (de !== para) historico = registrar(historico, { quem, parte, chave, rotulo: rotuloDaParte(sistema, atual, parte, chave), de, para, quando })
    }
    atual = depois
  }
  return atual === personagem ? personagem : { ...atual, historico }
}

/** Os ajustes por cima da ficha, sem histórico: a ficha otimista do jogador enquanto a mesa não confirma. */
export function comAjustes(personagem: Personagem, sistema: SistemaDeRpg, ajustes: readonly Ajuste[]): Personagem {
  return ajustes.reduce((atual, ajuste) => aplicarAjuste(atual, sistema, ajuste), personagem)
}

/**
 * O que a pessoa digitou no campo do ajuste, como o valor NOVO:
 *  - "-50" tira 50 (dano) e "+30" soma 30 (cura): sinal na frente é conta;
 *  - "450", sem sinal, é o valor exato (como no Foundry);
 *  - qualquer outra coisa (vazio, "abc", "5-", "1e3", "2.5") = `null`, nada muda.
 * O "−" tipográfico, que teclado de celular às vezes dá, vale como "-".
 */
export function interpretarAjuste(texto: string, atual: number): number | null {
  const casado = /^([+\-−]?)\s*(\d{1,9})$/.exec(texto.trim())
  if (casado === null) return null
  const numero = Number(casado[2])
  if (casado[1] === '+') return atual + numero
  if (casado[1] === '') return numero
  return atual - numero
}

/**
 * O valor exato, com sinal opcional ("+5", "-3", "7"): o campo do
 * MODIFICADOR, onde o sinal é do número e não conta — "+3" no modificador
 * +5 quer dizer +3, e não +8. Torto = `null`.
 */
export function interpretarValor(texto: string): number | null {
  const casado = /^([+\-−]?)\s*(\d{1,9})$/.exec(texto.trim())
  if (casado === null) return null
  const numero = Number(casado[2])
  return casado[1] === '' || casado[1] === '+' ? numero : -numero
}

/** "+5", "-3", "+0": o modificador sempre com sinal, para não se confundir com a base. */
export function comSinal(valor: number): string {
  return valor < 0 ? String(valor) : `+${valor}`
}

/** A conta do total, para quem pede o detalhe: "75 = 60 base +5 mod +10 Forma Híbrida". */
export function textoDaConta(valor: ValorComposto): string {
  const parcelas = [`${valor.base} base`]
  if (valor.modificador !== 0) parcelas.push(`${comSinal(valor.modificador)} mod`)
  for (const cartao of valor.cartoes) parcelas.push(`${comSinal(cartao.delta)} ${cartao.nome}`)
  return `${valor.total} = ${parcelas.join(' ')}`
}

/** Quem o histórico diz que mexeu, quando foi o mestre. */
export const NOME_DO_MESTRE = 'Mestre'

/** O jogador que se chama "Mestre" na mesa não assina como o mestre no histórico. */
export function nomeDoJogadorNoHistorico(nome: string): string {
  return nome.trim().toLocaleLowerCase('pt-BR') === NOME_DO_MESTRE.toLocaleLowerCase('pt-BR') ? `${nome} (jogador)` : nome
}

/** Uma linha do histórico em português: "HP 600 → 590", "Força mod. +5 → +6", "ativou Forma Híbrida". */
export function descreverRegistro(registro: RegistroDaFicha): string {
  const { rotulo, de, para } = registro
  switch (registro.parte) {
    case 'recurso':
    case 'atributo':
      return `${rotulo} ${de} → ${para}`
    case 'maximo':
      return `${rotulo} máx. ${de} → ${para}`
    case 'modRecurso':
      return `${rotulo} máx. mod. ${comSinal(de)} → ${comSinal(para)}`
    case 'modAtributo':
      return `${rotulo} mod. ${comSinal(de)} → ${comSinal(para)}`
    case 'cartao':
      return para === 1 ? `ativou ${rotulo}` : `desativou ${rotulo}`
  }
}

/** O que `quem` mudou nesta ficha na última janela, já juntado: as linhas do aviso do mestre. */
export function linhasDoAviso(historico: readonly RegistroDaFicha[], quem: string): string[] {
  const dele = historico.filter((registro) => registro.quem === quem)
  const ultimo = dele.at(-1)
  if (ultimo === undefined) return []
  return dele.filter((registro) => ultimo.quando - registro.quando < JANELA_DO_REGISTRO_MS).map(descreverRegistro)
}

/** As chaves do rascunho cujo valor não é o da base. */
function chavesMudadas(base: Record<string, number>, rascunho: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(rascunho).filter(([chave, valor]) => base[chave] !== valor))
}

/**
 * O "Salvar" do MESTRE sobre a ficha de AGORA: número que ele não tocou na
 * edição fica como está agora (o jogador tomou dano enquanto o mestre
 * escrevia a descrição), e o histórico e os cartões ligados não voltam no
 * tempo — a edição não mexe neles. O resto é o rascunho.
 */
export function salvarSobreOAtual(base: Personagem, rascunho: Personagem, atual: Personagem): Personagem {
  const salvo: Personagem = { ...rascunho, cartoesAtivos: atual.cartoesAtivos, historico: atual.historico }
  // CONTAS DOS JOGADORES: o dono muda na tela das contas, não na ficha — vale o de agora.
  if (atual.dono === undefined) delete salvo.dono
  else salvo.dono = atual.dono
  for (const campo of CAMPOS_NUMERICOS) salvo[campo] = { ...atual[campo], ...chavesMudadas(base[campo], rascunho[campo]) }
  return salvo
}
