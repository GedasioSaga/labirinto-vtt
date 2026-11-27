import type { CartaoDaFicha } from '../../../personagem'
import { CUSTO_MAX, type SeloDoGolpe, type SeloPedido } from '../../combate'
import type { LeituraDoDano } from '../../formula'
import { CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_EFEITO, CAMPO_DO_TEMPO, lerAcao, lerCusto, lerTempo, type LeituraDoCusto, type LeituraDoTempo } from '../../leituraDaFicha'
import { danoDaTecnica, leituraDaTecnica } from '../../leituraDaTecnica'
import { lerMarca } from '../../marca'
import { lerDuracao } from '../../selos'
import { lerTipo, modoDaReacao, seloDaReacao, seloSugeridoDaTecnica, type TipoDaHabilidade } from '../../tiposDaHabilidade'
import { modeloDoTexto } from '../doTexto'
import type { Custo, Efeito, Limite, MecanicaV2, ReacaoDaMecanica } from '../modelo'
import { mecanicaDoModelo, mecanicaDoModeloNoCartao, problemaDaMecanica, type IdDoModelo } from '../modelos'
import type { FichaDaPrevia } from '../resumo'
import { montarCartao } from '../textoGerado'
import { guardarConvertida, type ContextoDaConversao, type OpcoesDaConversao, type ResultadoDoCartao } from './comum'

/**
 * CONVERSÃO DA TÉCNICA DE TEXTO (E2, D11): o "Montar a partir do texto" de hoje (`modeloDoTexto` +
 * `mecanicaDoModeloNoCartao`), com o que o modelo inventaria trocado pelo que o texto diz: o custo
 * vazio é sem custo, o Tempo vazio não tem recarga, o Dano "-" não tem dano, a Ação vazia é
 * "perguntar", e os efeitos são só a cura e o selo que o texto sugere (nunca o "Fortalecido" de
 * fábrica). Depois, a prova: a batalha lê o cartão montado com a MESMA ação, Overload, custo, Tempo,
 * Tipo e dano que lia o texto; senão, o cartão fica no texto (o editor pode pedir mesmo assim, com um
 * "Confira" por diferença). O texto de antes vai para o extra "Texto de antes" (`montarCartao`), e as
 * frases do Efeito que nenhuma peça leu viram "Confira".
 *
 * Fica no texto, de propósito: a passiva (outra conversão), a Evolução e a Escolha (as opções moram
 * nos extras e seguem pelo texto), a Invocação (a peça ainda não diz o que o texto diz), a técnica
 * de marca (a marca de antes dura até ser usada, e a peça Marca conta turnos) e a reação que o texto
 * não diz se anula ou fica com metade.
 */

/** Os Tipos que esta conversão não monta, com o porquê. */
const FICA_NO_TEXTO: Partial<Readonly<Record<TipoDaHabilidade, string>>> = {
  passiva: 'passiva: segue pela conversão da passiva',
  evolucao: 'Evolução: as opções moram nos extras e seguem pelo texto',
  escolha: 'Escolha: as opções moram nos extras e seguem pelo texto',
  invocacao: 'Invocação: as criaturas seguem pelo texto (monte a peça Invocação quando quiser)',
}

/** A cura escrita no Efeito ("Cura Espírito*3 de HP"), a mesma frase que o Montar lê (`modelos.ts`). */
const CURA_NO_TEXTO = /\bcurar?\s+(.+?)\s+(?:de\s+)?(?:hp|vida|pv)\b/i

function noTexto(porque: string): ResultadoDoCartao {
  return { tipo: 'noTexto', porque }
}

/** A reação sozinha: o modelo pela saída que o texto diz. Contra-ataque, rolar e "escolher" não têm peça igual. */
function modeloDaReacao(cartao: CartaoDaFicha): IdDoModelo | null {
  const modo = modoDaReacao(cartao)
  return modo === 'esquiva' ? 'esquivaPerfeita' : modo === 'metade' ? 'bloqueio' : null
}

/** A defesa da "Reação/Ação X": a saída que o texto diz; `null` = o texto não diz uma que a peça tenha. */
function defesaDoTexto(cartao: CartaoDaFicha): ReacaoDaMecanica['defesa'] | null {
  const modo = modoDaReacao(cartao)
  if (modo === 'esquiva') return { tipo: 'anula' }
  return modo === 'metade' ? { tipo: 'fica', porcento: 50 } : null
}

/** O custo escrito, quando é número; `null` = conta ou pergunta (fica o que o Montar leu, e a prova decide). */
export function custosDoTexto(lido: LeituraDoCusto): readonly Custo[] | null {
  if (lido.tipo === 'nada') return []
  if (lido.tipo !== 'valor') return null
  if (lido.valor === 0) return []
  return lido.valor <= CUSTO_MAX ? [{ recurso: lido.recurso, quanto: { fixo: lido.valor }, quando: lido.porTurno ? 'porTurno' : 'aoUsar' }] : null
}

/** O Tempo vazio: sem a recarga e os usos que o modelo traria. */
function limiteDoTexto(limite: Limite, tempo: LeituraDoTempo): Limite {
  if (tempo.tipo !== 'livre') return limite
  const { recarga: _recarga, usosPorBatalha: _usos, ...resto } = limite
  return resto
}

/** A Ação vazia: quem usa escolhe na hora (o texto de hoje pergunta, `golpe.ts`); a escrita fica a que o Montar leu. */
function acaoDoTexto(base: MecanicaV2, cartao: CartaoDaFicha): MecanicaV2['acao'] {
  const lida = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  if (lida.soReacao === true) return base.acao
  return lida.acao === null ? 'perguntar' : base.acao
}

/** O selo sugerido como peça de Efeito: o nome, os turnos (sem número = até tirar), a cor e os números. */
function efeitoDoSelo(selo: SeloPedido, natureza: 'buff' | 'debuff' | undefined, em: 'atacante' | undefined): Efeito {
  const mods = (selo.mods ?? []).map((mod) => ({ alvo: mod.alvo, delta: { fixo: mod.delta } }))
  return {
    tipo: 'selo',
    nome: selo.nome,
    duracao: selo.turnos ?? 'ateTirar',
    ...(natureza === undefined ? {} : { natureza }),
    ...(em === undefined ? {} : { em }),
    ...(mods.length === 0 ? {} : { mods }),
  }
}

function naturezaDoSelo(selo: SeloDoGolpe): 'buff' | 'debuff' | undefined {
  return selo.natureza === 'buff' || selo.natureza === 'debuff' ? selo.natureza : undefined
}

/**
 * Os efeitos que o texto diz: a cura que o Montar leu do Efeito (a do modelo, sem quantia escrita,
 * sai) e o selo que a mira de hoje sugere para esta técnica (na reação, o de quem atacou).
 */
function efeitosDoTexto(base: MecanicaV2, modelo: IdDoModelo, cartao: CartaoDaFicha, ctx: ContextoDaConversao, reacao: boolean): readonly Efeito[] {
  const deFabrica = mecanicaDoModelo(modelo, ctx.sistema).efeitos
  const curas = base.efeitos.filter((efeito, indice) => efeito.tipo === 'cura' && JSON.stringify(efeito) !== JSON.stringify(deFabrica[indice]))
  if (reacao) {
    const marca = seloDaReacao(cartao)
    return marca === null ? [] : [efeitoDoSelo(marca, 'debuff', 'atacante')]
  }
  const selo = seloSugeridoDaTecnica(cartao, ctx.sistema)
  return selo === null ? curas : [...curas, efeitoDoSelo(selo, naturezaDoSelo(selo), undefined)]
}

/** O modelo montado no cartão, com o que o modelo inventaria trocado pelo que o texto diz; `null` = a defesa dupla que a peça não tem. */
function comOQueOTextoDiz(base: MecanicaV2, modelo: IdDoModelo, cartao: CartaoDaFicha, ctx: ContextoDaConversao, reacao: boolean): MecanicaV2 | null {
  const custos = custosDoTexto(lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', ctx.personagem))
  const tempo = lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? '')
  const semDano = danoDaTecnica(cartao, { personagem: ctx.personagem, sistema: ctx.sistema, arma: null }).tipo === 'semDano'
  const { dano: _dano, ...semODano } = base
  const comODano: MecanicaV2 = semDano ? semODano : base
  const mecanica: MecanicaV2 = {
    ...comODano,
    acao: acaoDoTexto(base, cartao),
    limite: limiteDoTexto(base.limite, tempo),
    efeitos: efeitosDoTexto(base, modelo, cartao, ctx, reacao),
    ...(custos === null ? {} : { custos }),
  }
  if (mecanica.uso !== 'ativaOuReacao') return mecanica
  const defesa = defesaDoTexto(cartao)
  return defesa === null ? null : { ...mecanica, reacao: { ...(mecanica.reacao ?? {}), defesa } }
}

// ─── A prova: a batalha lê o mesmo ──────────────────────────────────────────

interface Diferenca {
  campo: string
  confira: string
}

function chaveDoCusto(lido: LeituraDoCusto): string {
  if (lido.tipo === 'nada' || (lido.tipo === 'valor' && lido.valor === 0)) return 'nada'
  if (lido.tipo === 'valor') return `${lido.recurso}:${lido.valor}:${lido.porTurno ? 'porTurno' : 'aoUsar'}`
  // A pergunta com a conta que fecha cobra o mesmo que a peça com a fórmula.
  return lido.sugestao === null ? `pergunta:${lido.recurso}` : `${lido.recurso}:${lido.sugestao}:aoUsar`
}

/** Na Overload, o Tempo vazio e o "OVERLOAD" dizem o mesmo: 1 por batalha. */
function chaveDoTempo(lido: LeituraDoTempo, overload: boolean): string {
  if (overload && (lido.tipo === 'overload' || lido.tipo === 'livre')) return 'overload'
  switch (lido.tipo) {
    case 'recarga':
      return `recarga:${lido.turnos}`
    case 'usos':
      return `usos:${lido.vezes}`
    case 'texto':
      return `texto:${lido.texto}`
    case 'livre':
    case 'overload':
      return lido.tipo
  }
}

function chaveDoDano(lido: LeituraDoDano): string {
  return lido.tipo === 'valor' ? `valor:${lido.valor}` : lido.tipo
}

function escritoNoCampo(cartao: CartaoDaFicha, campo: string): string {
  return (cartao.campos[campo] ?? '').trim() || '(vazio)'
}

/** O que a batalha leria diferente no cartão montado (ação, Overload, custo, Tempo, Tipo, dano). Vazio = o mesmo. */
function diferencasNaBatalha(antes: CartaoDaFicha, depois: CartaoDaFicha, ctx: ContextoDaConversao): Diferenca[] {
  const leitura = { personagem: ctx.personagem, sistema: ctx.sistema }
  const a = leituraDaTecnica(antes, leitura)
  const d = leituraDaTecnica(depois, leitura)
  const diferencas: Diferenca[] = []
  if (a.acaoDaFicha.acao !== d.acaoDaFicha.acao || a.overload !== d.overload) diferencas.push({ campo: 'Ação', confira: `Ação de antes: ${escritoNoCampo(antes, CAMPO_DA_ACAO)}` })
  if (chaveDoCusto(a.custo) !== chaveDoCusto(d.custo)) diferencas.push({ campo: 'Custo', confira: `Custo de antes: ${escritoNoCampo(antes, CAMPO_DO_CUSTO)}` })
  if (chaveDoTempo(a.tempo, a.overload) !== chaveDoTempo(d.tempo, d.overload)) diferencas.push({ campo: 'Tempo', confira: `Tempo de antes: ${escritoNoCampo(antes, CAMPO_DO_TEMPO)}` })
  if (a.tipo.tipo !== d.tipo.tipo || a.tipo.tambemReacao !== d.tipo.tambemReacao) diferencas.push({ campo: 'Tipo', confira: `Tipo de antes: ${escritoNoCampo(antes, 'tipo')}` })
  const formula = { personagem: ctx.personagem, sistema: ctx.sistema, arma: null }
  if (chaveDoDano(danoDaTecnica(antes, formula)) !== chaveDoDano(danoDaTecnica(depois, formula))) diferencas.push({ campo: 'Dano', confira: `Dano de antes: ${escritoNoCampo(antes, 'dano')}` })
  return diferencas
}

/** As frases do Efeito que nenhuma peça leu (o selo "por N turnos" e a cura escrita foram lidos). */
function frasesNaoLidas(cartao: CartaoDaFicha, mecanica: MecanicaV2): string[] {
  const efeito = (cartao.campos[CAMPO_DO_EFEITO] ?? '').trim()
  if (efeito === '' || efeito === '-') return []
  const selos = mecanica.efeitos.flatMap((peca) => (peca.tipo === 'selo' ? [peca] : []))
  const curou = mecanica.efeitos.some((peca) => peca.tipo === 'cura')
  return efeito
    .split(/[.;!?\n]+/)
    .map((frase) => frase.trim())
    .filter((frase) => frase.length > 0)
    .filter((frase) => {
      const duracao = lerDuracao(frase, cartao.nome)
      if (duracao !== null && selos.some((selo) => selo.nome === duracao.nome && selo.duracao === duracao.turnos)) return false
      return !(curou && CURA_NO_TEXTO.test(frase))
    })
}

/**
 * A técnica de texto (aba Habilidades, ou subcartão da forma) montada pelo que o texto diz. Quem chama
 * já pulou o cartão montado, o da tabela à mão, o golpe à mão e a proposta do dono (`ficha.ts`).
 */
export function converterTecnica(cartao: CartaoDaFicha, ctx: ContextoDaConversao, opcoes: OpcoesDaConversao = {}): ResultadoDoCartao {
  const { tipo } = lerTipo(cartao)
  const porTipo = FICA_NO_TEXTO[tipo]
  if (porTipo !== undefined) return noTexto(porTipo)
  const acao = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  if (acao.transformacao) return noTexto('a Ação diz Transformação: a forma segue pelo texto')
  const reacao = tipo === 'reacao' || acao.soReacao === true
  if (!reacao && lerMarca(cartao, ctx.sistema) !== null) return noTexto('marca de antes: dura até ser usada, e a peça Marca conta turnos (monte a peça quando quiser)')
  const modelo = reacao ? modeloDaReacao(cartao) : modeloDoTexto(cartao)
  if (modelo === null) return noTexto(reacao ? 'reação: o texto não diz se anula ou fica com metade' : 'o texto não pede um modelo')
  const ficha: FichaDaPrevia = { personagem: ctx.personagem, sistema: ctx.sistema }
  const mecanica = comOQueOTextoDiz(mecanicaDoModeloNoCartao(modelo, ficha, cartao), modelo, cartao, ctx, reacao)
  if (mecanica === null) return noTexto('Reação/Ação: o texto não diz se a reação anula ou fica com metade')
  const problema = problemaDaMecanica(mecanica, ficha)
  if (problema !== null) return noTexto(`as peças lidas do texto não fecham (${problema})`)
  const guardada = guardarConvertida(mecanica)
  if (guardada === null) return noTexto('as peças lidas do texto não se gravam')
  const montado = montarCartao(cartao, guardada, ctx.sistema)
  const diferencas = diferencasNaBatalha(cartao, montado, ctx)
  if (diferencas.length > 0 && opcoes.mesmoComDiferenca !== true) return noTexto(`a batalha leria diferente: ${diferencas.map((diferenca) => diferenca.campo).join(', ')}`)
  return { tipo: 'convertido', cartao: montado, deQue: reacao ? 'reacao' : 'tecnica', confira: [...diferencas.map((diferenca) => diferenca.confira), ...frasesNaoLidas(cartao, mecanica)] }
}
