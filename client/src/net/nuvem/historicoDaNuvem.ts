import { JANELA_DO_REGISTRO_MS, NOME_DO_MESTRE, nomeDoJogadorNoHistorico, registrar, valorDaParte } from '../../lib/ajusteDaFicha'
import { aplicarOp } from '../../lib/nuvem/aplicar'
import { alvoDoCaminho, type MapaNumerico } from '../../lib/nuvem/caminho'
import { ehCopiaDeTreino } from '../../lib/nuvem/projecao'
import { CONTA_DO_MESTRE, type OpGravada } from '../../lib/nuvem/tipos'
import type { ParteDoAjuste, Personagem, RegistroDaFicha } from '../../lib/personagem'
import type { BaseDaNuvem } from './acertoDasFichas'
import { vaiAoLobby } from './emissor'

/**
 * O HISTÓRICO DO APP PARA AS OPS DA NUVEM (docs/planos/lobby-jogadores-2026-11-05.md
 * §4.1, Si9). O `historico` da ficha não sobe ao Lobby (o log do servidor o
 * substitui), mas a op NUMÉRICA que chega de outro lugar (o site, o app de
 * outro computador) ganha uma linha nele com o nome do autor, como o ajuste
 * feito no app. Puro: quem aplica é o sincronizador, fora do Ctrl+Z e sem
 * reemitir (o `historico` fica fora das `diferencas`).
 */

/** Uma linha nova e a ficha dela. */
export interface LinhaDaNuvem {
  fichaId: string
  registro: RegistroDaFicha
}

/** O nome do número na hora (o do sistema da pasta); sem nome conhecido, a chave. */
export type RotuloDoNumero = (ficha: Personagem, parte: ParteDoAjuste, chave: string) => string

const PARTE_DO_MAPA: Readonly<Record<MapaNumerico, ParteDoAjuste>> = {
  recursos: 'recurso',
  maximos: 'maximo',
  modificadoresDosRecursos: 'modRecurso',
  atributos: 'atributo',
  modificadoresDosAtributos: 'modAtributo',
}

/** O número que a op muda, como o histórico o chama; `null` = a op não é numérica. */
function parteDoNumero(caminho: readonly string[]): { parte: ParteDoAjuste; chave: string } | null {
  const alvo = alvoDoCaminho(caminho)
  return alvo === null || alvo.regra !== 'numero' ? null : { parte: PARTE_DO_MAPA[alvo.mapa], chave: alvo.chave }
}

/** Quem a linha diz que mexeu: "Mestre", como no ajuste do app, ou o nome da conta. */
function quemNoHistorico(op: OpGravada): string {
  return op.autorContaId === CONTA_DO_MESTRE ? NOME_DO_MESTRE : nomeDoJogadorNoHistorico(op.autorNome)
}

/**
 * As linhas das ops confirmadas `novas` (as que andaram a `base`, em ordem de
 * rev), refeitas sobre a base de ANTES delas: o de → para é o que o servidor
 * gravou. Fica de fora a op deste app (`clienteId`): a mudança feita aqui (do
 * mestre ou da mesa LAN) já tem a linha dela. E a cópia de treino, que nunca
 * entra nas fichas do app.
 */
export function linhasDasOpsDaNuvem(base: BaseDaNuvem, novas: readonly OpGravada[], clienteId: string, rotulo: RotuloDoNumero): LinhaDaNuvem[] {
  const fichas = new Map(base.fichas)
  const linhas: LinhaDaNuvem[] = []
  for (const op of novas) {
    const antes = fichas.get(op.fichaId) ?? null
    const aplicada = aplicarOp(antes, op)
    if (!aplicada.ok) continue
    const depois = aplicada.doc
    if (depois === null) fichas.delete(op.fichaId)
    else fichas.set(op.fichaId, depois)
    const numero = parteDoNumero(op.caminho)
    if (numero === null || antes === null || depois === null || op.clienteId === clienteId || ehCopiaDeTreino(op.fichaId)) continue
    const { parte, chave } = numero
    const de = valorDaParte(antes, parte, chave)
    const para = valorDaParte(depois, parte, chave)
    if (de === para) continue
    linhas.push({ fichaId: op.fichaId, registro: { quem: quemNoHistorico(op), parte, chave, rotulo: rotulo(antes, parte, chave), de, para, quando: op.quando } })
  }
  return linhas
}

/**
 * A linha já entrou no histórico: há uma do mesmo autor, no mesmo número, da
 * mesma hora ou de até uma janela depois — ela mesma, ou outra que `registrar`
 * juntou com ela. O gravador leve pode passar de novo pela linha, e o
 * `rpg.json` salvo pelo editor já a pode ter. Raro e aceito: a mudança do
 * mesmo autor no mesmo número feita no app logo depois (com o relógio daqui)
 * esconde a linha da op do site que ainda não tinha chegado.
 */
function jaEntrou(historico: readonly RegistroDaFicha[], novo: RegistroDaFicha): boolean {
  return historico.some((registro) => {
    const depois = registro.quando - novo.quando
    return registro.quem === novo.quem && registro.parte === novo.parte && registro.chave === novo.chave && depois >= 0 && depois < JANELA_DO_REGISTRO_MS
  })
}

/**
 * As linhas nas fichas do Lobby que o app tem, pelo mesmo `registrar` do
 * ajuste: dez cliques no "−" do site viram uma linha só. Idempotente. A
 * conferência de "já entrou" olha o histórico de ANTES desta leva: duas ops do
 * mesmo lote têm a mesma hora do servidor e se juntam. `null` = nenhuma ficha mudou.
 */
export function fichasComAsLinhas(personagens: readonly Personagem[], linhas: readonly LinhaDaNuvem[]): Personagem[] | null {
  if (linhas.length === 0) return null
  let mudou = false
  const novas = personagens.map((ficha) => {
    if (!vaiAoLobby(ficha)) return ficha
    let historico = ficha.historico
    for (const linha of linhas) {
      if (linha.fichaId !== ficha.id || jaEntrou(ficha.historico, linha.registro)) continue
      historico = registrar(historico, linha.registro)
    }
    if (historico === ficha.historico) return ficha
    mudou = true
    return { ...ficha, historico }
  })
  return mudou ? novas : null
}
