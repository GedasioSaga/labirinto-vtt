/**
 * O DESENHO DE CADA VERSÃO (I0-a do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): para cada
 * tipo com versão (`lib/mobilia/versoes.ts`), o montador de cada versão que não é a 1ª. A 1ª é sempre o desenho de
 * `MONTADORES` (`../index.ts`), o de hoje. `montarCena` pergunta aqui primeiro.
 *
 * Cada `<tipo>Versoes.ts` é do desenhista (só cria o arquivo; contrato em `docs/design/arte-temas/COMO-DESENHAR.md`).
 * A linha deste registro é do integrador, junto da linha da tabela em `lib/mobilia/versoes.ts`, com os mesmos ids.
 */
import type { TipoMobilia } from '../../../../lib/mobilia/tipos'
import type { MontarMovel } from '../contexto'
import { versoesDoNichoFunerario } from './nichoFunerarioVersoes'
import { versoesDoPiramideEmDegraus } from './piramideEmDegrausVersoes'
import { versoesDoBau } from './bauVersoes'
import { versoesDoCelaComGrade } from './celaComGradeVersoes'
import { versoesDoAlcapao } from './alcapaoVersoes'
import { versoesDoArmadilhaDeEspinhos } from './armadilhaDeEspinhosVersoes'
import { versoesDoGaiolaSuspensa } from './gaiolaSuspensaVersoes'
import { versoesDoPlacaDePressao } from './placaDePressaoVersoes'
import { versoesDoEscadaDeMao } from './escadaDeMaoVersoes'
import { versoesDoCorrentePendurada } from './correntePenduradaVersoes'
import { versoesDoPortaoDeJaula } from './portaoDeJaulaVersoes'
import { versoesDoBraseiro } from './braseiroVersoes'
import { versoesDoTochaDeParede } from './tochaDeParedeVersoes'
import { versoesDoTochaDePe } from './tochaDePeVersoes'
import { versoesDoPilarComBraseiro } from './pilarComBraseiroVersoes'
import { versoesDoGrilhoesDeParede } from './grilhoesDeParedeVersoes'
import { versoesDoEstanteDeLivros } from './estanteDeLivrosVersoes'
import { versoesDoTronoReal } from './tronoRealVersoes'
import { versoesDoTapecariaDeParede } from './tapecariaDeParedeVersoes'
import { versoesDoEstandarteDePe } from './estandarteDePeVersoes'
import { versoesDoLustreDeVelas } from './lustreDeVelasVersoes'
import { versoesDoLareira } from './lareiraVersoes'
import { versoesDoEstatua } from './estatuaVersoes'
import { versoesDoPecaDeXadrez } from './pecaDeXadrezVersoes'
import { versoesDoCarrinhoDeMina } from './carrinhoDeMinaVersoes'
import { versoesDoTrilhoDeMina } from './trilhoDeMinaVersoes'
import { versoesDoEscoraDeMina } from './escoraDeMinaVersoes'
import { versoesDoPilhaDeMinerio } from './pilhaDeMinerioVersoes'
import { versoesDoCano } from './canoVersoes'
import { versoesDoSaidaDeEsgoto } from './saidaDeEsgotoVersoes'
import { versoesDoComporta } from './comportaVersoes'
import { versoesDoBueiro } from './bueiroVersoes'
import { versoesDoRaloDeMasmorra } from './raloDeMasmorraVersoes'
import { versoesDoGradeDeCorredor } from './gradeDeCorredorVersoes'
import { versoesDoPlacaDeLoja } from './placaDeLojaVersoes'
import { versoesDoCarroca } from './carrocaVersoes'
import { versoesDoBarraca } from './barracaVersoes'
import { versoesDoLampiao } from './lampiaoVersoes'
import { versoesDoPoco } from './pocoVersoes'
import { versoesDoFonteDeParede } from './fonteDeParedeVersoes'
import { versoesDoCerca } from './cercaVersoes'
import { versoesDoHorta } from './hortaVersoes'
import { versoesDoBarril } from './barrilVersoes'
import { versoesDoRodaDeCarroca } from './rodaDeCarrocaVersoes'
import { versoesDoBancoDeTronco } from './bancoDeTroncoVersoes'
import { versoesDoCasinhaDeCachorro } from './casinhaDeCachorroVersoes'

/** O montador de cada versão, pelo id gravado em `Prop.mobiliaVersao` (a 1ª versão não entra). */
export type VersoesDesenhadas = Readonly<Record<string, MontarMovel>>

export const VERSOES_DESENHADAS: Readonly<Partial<Record<TipoMobilia, VersoesDesenhadas>>> = {
  nichoFunerario: versoesDoNichoFunerario,
  piramideEmDegraus: versoesDoPiramideEmDegraus,
  // Lote L01 do plano de arte por tema (28/11/2026).
  bau: versoesDoBau,
  celaComGrade: versoesDoCelaComGrade,
  alcapao: versoesDoAlcapao,
  armadilhaDeEspinhos: versoesDoArmadilhaDeEspinhos,
  gaiolaSuspensa: versoesDoGaiolaSuspensa,
  placaDePressao: versoesDoPlacaDePressao,
  escadaDeMao: versoesDoEscadaDeMao,
  correntePendurada: versoesDoCorrentePendurada,
  portaoDeJaula: versoesDoPortaoDeJaula,
  // Lote L02 (a lâmina pendular entra com o animador `oscilar`: `versoesDoLaminaPendular` espera por ele).
  braseiro: versoesDoBraseiro,
  tochaDeParede: versoesDoTochaDeParede,
  tochaDePe: versoesDoTochaDePe,
  pilarComBraseiro: versoesDoPilarComBraseiro,
  grilhoesDeParede: versoesDoGrilhoesDeParede,
  estanteDeLivros: versoesDoEstanteDeLivros,
  // Lote L03.
  tronoReal: versoesDoTronoReal,
  tapecariaDeParede: versoesDoTapecariaDeParede,
  estandarteDePe: versoesDoEstandarteDePe,
  lustreDeVelas: versoesDoLustreDeVelas,
  lareira: versoesDoLareira,
  estatua: versoesDoEstatua,
  pecaDeXadrez: versoesDoPecaDeXadrez,
  // A onda 2: L04 (a mina).
  carrinhoDeMina: versoesDoCarrinhoDeMina,
  trilhoDeMina: versoesDoTrilhoDeMina,
  escoraDeMina: versoesDoEscoraDeMina,
  pilhaDeMinerio: versoesDoPilhaDeMinerio,
  // L05 (o esgoto).
  cano: versoesDoCano,
  saidaDeEsgoto: versoesDoSaidaDeEsgoto,
  comporta: versoesDoComporta,
  bueiro: versoesDoBueiro,
  raloDeMasmorra: versoesDoRaloDeMasmorra,
  gradeDeCorredor: versoesDoGradeDeCorredor,
  // L06 (a cidade medieval).
  placaDeLoja: versoesDoPlacaDeLoja,
  carroca: versoesDoCarroca,
  barraca: versoesDoBarraca,
  lampiao: versoesDoLampiao,
  poco: versoesDoPoco,
  fonteDeParede: versoesDoFonteDeParede,
  // A onda 3: L07 (a vila e a fazenda).
  cerca: versoesDoCerca,
  horta: versoesDoHorta,
  barril: versoesDoBarril,
  rodaDeCarroca: versoesDoRodaDeCarroca,
  bancoDeTronco: versoesDoBancoDeTronco,
  casinhaDeCachorro: versoesDoCasinhaDeCachorro,
}

/** O montador da versão (`undefined` = a 1ª, versão sem desenho ou tipo sem versão: vale o de `MONTADORES`). */
export function montadorDaVersao(tipo: TipoMobilia, versao: string | undefined): MontarMovel | undefined {
  const versoes = VERSOES_DESENHADAS[tipo]
  if (versao === undefined || versoes === undefined || !Object.hasOwn(versoes, versao)) return undefined
  return versoes[versao]
}
