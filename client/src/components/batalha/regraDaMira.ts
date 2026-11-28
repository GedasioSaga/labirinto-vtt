import { DIRECOES, type Direcao } from '../../lib/batalha/area'
import { alcanceComCondicoes, type AlcanceComCondicoes, type GrupoDoAlcance, type SeloQueMudaOAlcance } from '../../lib/batalha/alcance/condicoes'
import { usaDirecao } from '../../lib/batalha/alcance/forma'
import { ALVOS_MAX } from '../../lib/batalha/combate'
import type { AreaAMao } from '../../lib/batalha/mecanicasAMao'
import { alvosNaAreaPelaGrade, areaComFrente, direcaoDaAreaAoAbrir, golpeDeAjuda, miraComGrade, quemSaiDoAlcanceNaMira, type AlvoNaMira, type EscolhaNoAlcance, type GolpeNaTela } from './dadosDoMenu'

/**
 * A REGRA DA MIRA, uma só para o menu da vez (`MiraDoGolpe`) e para a Mesa da batalha
 * (`batalhaJanela/espelhoOP.ts`). Conserto de 25/11/2026 do levantamento das mecânicas duplicadas
 * (item 16): a Mesa mirava com a frente do token, sem marcar quem está na área e sem o "usar mesmo
 * assim?" do fora do alcance. Aqui moram a forma com as condições de quem usa, a área montada que marca
 * sozinha pela grade, o lado ao abrir, o lado que vai no pedido e quem sai das casas acesas ao mandar.
 */

/** Fase E do alcance: de onde vem o golpe, para as condições que valem só em armas, habilidades ou itens (a mesma regra do host). */
export function grupoDoGolpe(golpe: GolpeNaTela): GrupoDoAlcance {
  if (golpe.vagaId !== undefined) return 'itens'
  return golpe.tipo === 'atacar' ? 'armas' : 'habilidades'
}

/** Fase E do alcance: a forma que vale agora, com as condições de quem usa (Ofuscado, Mira Firme): a mesma conta do host. `null` = sem alcance definido. */
export function alcanceDaMira(golpe: GolpeNaTela, condicoes: readonly SeloQueMudaOAlcance[] | undefined): AlcanceComCondicoes | null {
  return golpe.formaDoAlcance === undefined ? null : alcanceComCondicoes(golpe.formaDoAlcance, grupoDoGolpe(golpe), condicoes ?? [])
}

/** A forma com as condições de quem age (a ficha da mira que tem a grade). */
function alcanceDosAlvos(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): AlcanceComCondicoes | null {
  return alcanceDaMira(golpe, alvos.find((alvo) => alvo.naGrade !== undefined)?.naGrade?.condicoes)
}

/** Construtor C3: a área da técnica montada marca sozinha (tem a grade); `null` = a regra de sempre. */
export function areaDaGrade(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): AreaAMao | null {
  return golpe.areaPelaGrade === true && golpe.area !== undefined && miraComGrade(alvos) ? golpe.area : null
}

/** Fase E: a forma olha para um lado (linha, quadrado à frente, leque): as setas e o mouse no mapa viram. */
export function formaOlhaParaUmLado(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): boolean {
  const area = areaDaGrade(golpe, alvos)
  if (area !== null) return areaComFrente(area)
  const alcance = alcanceDosAlvos(golpe, alvos)
  return alcance !== null && usaDirecao(alcance.forma) && miraComGrade(alvos)
}

/**
 * Fase C do alcance: a área pela grade manda o lado escolhido (o host vira a mesma área). Fase E: a forma
 * que olha sem área montada também manda (o host confere as casas do lado que o chão mostrou). `false` = o
 * pedido vai sem lado.
 */
export function mandaOLado(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): boolean {
  return areaDaGrade(golpe, alvos) !== null || formaOlhaParaUmLado(golpe, alvos)
}

/** Construtor C3: a área montada aponta para a frente de quem age (ou o lado que pega mais); sem área, a frente (ou para cima). */
export function direcaoAoAbrirAMira(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): Direcao {
  const area = areaDaGrade(golpe, alvos)
  return area === null ? (alvos.find((alvo) => alvo.naGrade !== undefined)?.naGrade?.frente ?? 'norte') : direcaoDaAreaAoAbrir(area, alvos)
}

/**
 * Construtor C3: quem a área montada pega virada para `direcao`, com as condições de quem usa (virar e
 * andar remarcam por esta conta; o que quem usa mudou à mão sai junto: é outra mira). `null` = o golpe
 * sem área pela grade.
 */
export function marcasDaAreaVirada(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[], direcao: Direcao): string[] | null {
  const area = areaDaGrade(golpe, alvos)
  if (area === null) return null
  const alcance = alcanceDosAlvos(golpe, alvos)
  // A forma com as condições só quando elas mudam o número (sem mudança, a área conta pela forma dela).
  const comCondicoes = alcance?.muda === true ? alcance.forma : undefined
  return alvosNaAreaPelaGrade(area, alvos, direcao, comCondicoes, golpeDeAjuda(golpe)).slice(0, ALVOS_MAX)
}

/** Fase E do alcance: o que sai das casas acesas ao mandar (`'centro'`, o primeiro marcado fora, ou `null`), com as condições de quem usa, como o host. */
export function quemSaiAoMandar(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[], escolha: EscolhaNoAlcance): string | 'centro' | null {
  return quemSaiDoAlcanceNaMira({ formaDoAlcance: alcanceDosAlvos(golpe, alvos)?.forma }, alvos, escolha)
}

/**
 * Conserto de 27/11/2026 (a Rosa Fúnebre no site do Lobby, sessão ao vivo): sem o chão (a grade da luta do site não
 * acende as casas nem vira a forma com o mouse; a mira chega sem `mapa`), a forma que olha para um lado vira sozinha
 * para o lado em que todos os marcados cabem, a começar do escolhido. Antes a linha ficava para o norte (o token do
 * site não tem frente) e o inimigo a 2 casas a leste, em linha reta, caía no "Fora do alcance". `null` = vale o lado
 * escolhido (com chão, a área pela grade, ou nenhum lado em que todos caibam).
 */
export function ladoQueCabeSemChao(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[], escolha: EscolhaNoAlcance & { direcao: Direcao }): Direcao | null {
  const grade = alvos.find((alvo) => alvo.naGrade !== undefined)?.naGrade
  if (grade === undefined || grade.mapa !== undefined || areaDaGrade(golpe, alvos) !== null || !formaOlhaParaUmLado(golpe, alvos)) return null
  const lados = [escolha.direcao, ...DIRECOES.filter((lado) => lado !== escolha.direcao)]
  return lados.find((lado) => quemSaiAoMandar(golpe, alvos, { ...escolha, direcao: lado }) === null) ?? null
}

/** Fase E do alcance: o porquê da confirmação: quem ficou fora das casas acesas, ou a recusa do host. */
export function textoDoForaDoAlcance(quem: string | null, alvos: readonly AlvoNaMira[]): string {
  const registro = 'As casas só mostram o alcance: o golpe sai, e o registro anota "(fora do alcance)".'
  if (quem === 'centro') return `O centro da área está fora das casas acesas. ${registro}`
  const nome = quem === null ? undefined : alvos.find((alvo) => alvo.tokenId === quem)?.nome
  if (nome !== undefined) return `${nome} está fora das casas acesas. ${registro}`
  return `O mestre conta o alcance com uma parede ou condição que esta tela não mostra. ${registro}`
}
