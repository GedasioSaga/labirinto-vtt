/**
 * VERSÕES DENTRO DO OBJETO (I0-a do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): o mesmo
 * tipo com outra FORMA ou outro ESTADO (aberto, alagado, quebrado, com neve, a cor da chama), escolhido no painel do
 * objeto clicado ("Versão"). Um campo só no mapa, `Prop.mobiliaVersao`, para todo tipo desta tabela: tipo novo com
 * versões entra numa linha aqui e num arquivo de desenho (`texturas/meioTermo/moveis/versoes/<tipo>Versoes.ts`),
 * sem os 9 pontos de código por tipo da cova e da ponte.
 *
 * Regras (as mesmas de `mobiliaForma`):
 *
 * - a 1ª opção é a de partida, o desenho de hoje: o mapa não a grava (ausente = a 1ª);
 * - versão que o tipo não conhece (texto torto, versão futura, a de outro tipo) some na leitura e na travessia;
 * - trocar a versão não mexe na pegada (o mestre pode ter esticado), então toda versão tem a pegada do tipo.
 *
 * Sem import de Pixi nem de `types/map.ts`: só a lista de tipos (`tipos.ts`, que não importa nada), sem ciclo.
 */
import type { TipoMobilia } from './tipos'

export interface OpcaoDeVersao {
  /** O que o mapa grava (e a chave do desenho em `moveis/versoes/<tipo>Versoes.ts`). */
  readonly id: string
  /** O nome no botão do painel. */
  readonly nome: string
  /** A versão apaga a luz do objeto (o lustre apagado ou caído); ausente = a luz do tipo, como sempre. */
  readonly semLuz?: true
}

/** As cores da chama do L02 (o id é a cor de `corDaChama.ts`; a 1ª, a laranja de sempre). */
const CORES_DO_FOGO: VersoesDoMovel['opcoes'] = [
  { id: 'laranja', nome: 'Laranja' }, { id: 'azul', nome: 'Azul' }, { id: 'verde', nome: 'Verde' }, { id: 'roxa', nome: 'Roxa' },
]

/** Os brasões do L03, depois do de sempre (a flor de lis da tapeçaria, a asna do estandarte). */
function brasoesDepoisDe(deSempre: OpcaoDeVersao): VersoesDoMovel['opcoes'] {
  return [deSempre, { id: 'leao', nome: 'Leão' }, { id: 'dragao', nome: 'Dragão' }, { id: 'aguia', nome: 'Águia' }, { id: 'torre', nome: 'Torre' }]
}

export interface VersoesDoMovel {
  /** O nome do campo no painel. */
  readonly rotulo: string
  /** A ordem do painel; a 1ª é a de partida (o desenho de hoje, sem campo no mapa). */
  readonly opcoes: readonly [OpcaoDeVersao, OpcaoDeVersao, ...OpcaoDeVersao[]]
}

/**
 * Os tipos com versão, e as versões de cada um. O desenho de cada versão que não é a 1ª mora em
 * `VERSOES_DESENHADAS` (`texturas/meioTermo/moveis/versoes/index.ts`), com o mesmo id.
 */
export const VERSOES_DO_MOVEL: Readonly<Partial<Record<TipoMobilia, VersoesDoMovel>>> = {
  // O lóculo da cripta (L05 de 24/11/2026): a laje inteira ou partida, com os ossos à vista. Desenhado desde 24/11,
  // sem botão até o I0-a.
  nichoFunerario: { rotulo: 'Versão', opcoes: [{ id: 'fechado', nome: 'Fechado' }, { id: 'aberto', nome: 'Aberto' }] },
  // O templo da selva (L08 de 24/11/2026): os degraus secos ou cada um virando tanque raso.
  piramideEmDegraus: { rotulo: 'Versão', opcoes: [{ id: 'seca', nome: 'Seca' }, { id: 'alagada', nome: 'Alagada' }] },
  // Lote L01 do plano de arte por tema (28/11/2026): baús, celas e armadilhas da masmorra e da prisão.
  bau: { rotulo: 'Versão', opcoes: [{ id: 'fechado', nome: 'Fechado' }, { id: 'comTesouro', nome: 'Aberto com tesouro' }, { id: 'vazio', nome: 'Aberto vazio' }] },
  celaComGrade: { rotulo: 'Versão', opcoes: [{ id: 'fechada', nome: 'Fechada' }, { id: 'aberta', nome: 'Aberta' }, { id: 'arrombada', nome: 'Arrombada' }] },
  alcapao: { rotulo: 'Versão', opcoes: [{ id: 'fechado', nome: 'Fechado' }, { id: 'aberto', nome: 'Aberto' }] },
  armadilhaDeEspinhos: { rotulo: 'Versão', opcoes: [{ id: 'armada', nome: 'Armada' }, { id: 'recolhida', nome: 'Recolhida' }] },
  gaiolaSuspensa: { rotulo: 'Versão', opcoes: [{ id: 'fechada', nome: 'Fechada' }, { id: 'abertaVazia', nome: 'Aberta vazia' }, { id: 'comOssos', nome: 'Com ossos' }] },
  placaDePressao: { rotulo: 'Versão', opcoes: [{ id: 'quadrada', nome: 'Quadrada' }, { id: 'losango', nome: 'Losango' }, { id: 'afundada', nome: 'Afundada' }] },
  escadaDeMao: { rotulo: 'Versão', opcoes: [{ id: 'encostada', nome: 'Encostada' }, { id: 'deitada', nome: 'Deitada' }] },
  correntePendurada: { rotulo: 'Versão', opcoes: [{ id: 'comGancho', nome: 'Com gancho' }, { id: 'comGrilhao', nome: 'Com grilhão' }] },
  portaoDeJaula: { rotulo: 'Versão', opcoes: [{ id: 'fechado', nome: 'Fechado' }, { id: 'aberto', nome: 'Aberto' }] },
  // Lote L02: a cor da chama (o id 'azul', 'verde' ou 'roxa' pinta a chama, a fagulha e a luz: `corDaChama.ts`), os
  // grilhões com esqueleto e a estante revirada ou vazia. A lâmina pendular entra com o animador `oscilar` (I0-e):
  // sem ele a versão "Balançando" seria só a viga, sem a lâmina.
  braseiro: { rotulo: 'Chama', opcoes: CORES_DO_FOGO },
  tochaDeParede: { rotulo: 'Chama', opcoes: CORES_DO_FOGO },
  tochaDePe: { rotulo: 'Chama', opcoes: CORES_DO_FOGO },
  pilarComBraseiro: { rotulo: 'Chama', opcoes: CORES_DO_FOGO },
  grilhoesDeParede: { rotulo: 'Versão', opcoes: [{ id: 'vazios', nome: 'Vazios' }, { id: 'comEsqueleto', nome: 'Com esqueleto' }] },
  estanteDeLivros: { rotulo: 'Versão', opcoes: [{ id: 'cheia', nome: 'Cheia' }, { id: 'revirada', nome: 'Revirada' }, { id: 'vaziaComTeias', nome: 'Vazia com teias' }] },
  // Lote L03: o castelo e o xadrez. A tapeçaria e o estandarte dividem os brasões (heráldica original).
  tronoReal: { rotulo: 'Versão', opcoes: [{ id: 'real', nome: 'Real' }, { id: 'gelo', nome: 'De gelo' }, { id: 'obsidiana', nome: 'De obsidiana' }, { id: 'ossos', nome: 'De ossos' }] },
  tapecariaDeParede: { rotulo: 'Brasão', opcoes: brasoesDepoisDe({ id: 'florDeLis', nome: 'Flor de lis' }) },
  estandarteDePe: { rotulo: 'Brasão', opcoes: brasoesDepoisDe({ id: 'asna', nome: 'Asna' }) },
  lustreDeVelas: { rotulo: 'Versão', opcoes: [{ id: 'aceso', nome: 'Aceso' }, { id: 'apagado', nome: 'Apagado', semLuz: true }, { id: 'caido', nome: 'Caído', semLuz: true }] },
  lareira: { rotulo: 'Versão', opcoes: [{ id: 'simples', nome: 'Simples' }, { id: 'salao', nome: 'De salão' }] },
  estatua: { rotulo: 'Figura', opcoes: [{ id: 'heroi', nome: 'Herói' }, { id: 'cavaleiro', nome: 'Cavaleiro' }, { id: 'rei', nome: 'Rei' }, { id: 'dama', nome: 'Dama' }] },
  pecaDeXadrez: {
    rotulo: 'Peça',
    opcoes: [
      { id: 'peao', nome: 'Peão' }, { id: 'torre', nome: 'Torre' }, { id: 'cavalo', nome: 'Cavalo' }, { id: 'bispo', nome: 'Bispo' },
      { id: 'rainha', nome: 'Rainha' }, { id: 'rei', nome: 'Rei' }, { id: 'tombada', nome: 'Tombada' },
    ],
  },
  // A onda 2 (28/11/2026). Lote L04: a mina. O trilho reto é o que estica; a curva e o batente são pedaços da linha.
  carrinhoDeMina: { rotulo: 'Versão', opcoes: [{ id: 'vazio', nome: 'Vazio' }, { id: 'comMinerio', nome: 'Com minério' }, { id: 'comOuro', nome: 'Com ouro' }] },
  trilhoDeMina: { rotulo: 'Versão', opcoes: [{ id: 'reto', nome: 'Reto' }, { id: 'curva', nome: 'Curva' }, { id: 'batente', nome: 'Batente' }] },
  escoraDeMina: { rotulo: 'Versão', opcoes: [{ id: 'inteira', nome: 'Inteira' }, { id: 'quebrada', nome: 'Quebrada' }] },
  pilhaDeMinerio: { rotulo: 'Minério', opcoes: [{ id: 'ferro', nome: 'Ferro' }, { id: 'ouro', nome: 'Ouro' }, { id: 'cristal', nome: 'Cristal' }] },
  // Lote L05: o esgoto. A saída Escorrendo tem o fio de água do animador (`pixi/fioDeAgua.ts`).
  cano: { rotulo: 'Versão', opcoes: [{ id: 'reto', nome: 'Reto' }, { id: 'cotovelo', nome: 'Cotovelo' }, { id: 'juncaoEmT', nome: 'Junção em T' }, { id: 'comValvula', nome: 'Com válvula' }] },
  saidaDeEsgoto: { rotulo: 'Versão', opcoes: [{ id: 'seca', nome: 'Seca' }, { id: 'escorrendo', nome: 'Escorrendo' }] },
  comporta: { rotulo: 'Versão', opcoes: [{ id: 'fechada', nome: 'Fechada' }, { id: 'aberta', nome: 'Aberta' }] },
  bueiro: { rotulo: 'Versão', opcoes: [{ id: 'fechado', nome: 'Fechado' }, { id: 'aberto', nome: 'Aberto' }] },
  raloDeMasmorra: { rotulo: 'Versão', opcoes: [{ id: 'seco', nome: 'Seco' }, { id: 'transbordando', nome: 'Transbordando' }] },
  gradeDeCorredor: { rotulo: 'Versão', opcoes: [{ id: 'inteira', nome: 'Inteira' }, { id: 'arrombada', nome: 'Arrombada' }] },
  // Lote L06: a cidade medieval. A placa de hoje é a da caneca (a taverna); a Correndo da fonte tem o fio de água.
  placaDeLoja: {
    rotulo: 'Ofício',
    opcoes: [
      { id: 'caneca', nome: 'Caneca' }, { id: 'ferreiro', nome: 'Ferreiro' }, { id: 'alquimista', nome: 'Alquimista' },
      { id: 'padaria', nome: 'Padaria' }, { id: 'armaduras', nome: 'Armaduras' }, { id: 'estalagem', nome: 'Estalagem' },
    ],
  },
  carroca: { rotulo: 'Versão', opcoes: [{ id: 'vazia', nome: 'Vazia' }, { id: 'comFeno', nome: 'Com feno' }, { id: 'comBarris', nome: 'Com barris' }, { id: 'coberta', nome: 'Coberta' }] },
  barraca: { rotulo: 'Versão', opcoes: [{ id: 'simples', nome: 'Simples' }, { id: 'tecidos', nome: 'Tecidos' }, { id: 'ceramica', nome: 'Cerâmica' }, { id: 'peixe', nome: 'Peixe' }] },
  lampiao: { rotulo: 'Versão', opcoes: [{ id: 'dePe', nome: 'De pé' }, { id: 'posteDeRua', nome: 'Poste de rua' }, { id: 'posteAGas', nome: 'Poste a gás' }] },
  poco: { rotulo: 'Versão', opcoes: [{ id: 'simples', nome: 'Simples' }, { id: 'comTelhado', nome: 'Com telhado' }, { id: 'comManivela', nome: 'Com manivela' }] },
  fonteDeParede: { rotulo: 'Versão', opcoes: [{ id: 'correndo', nome: 'Correndo' }, { id: 'seca', nome: 'Seca' }] },
  // A onda 3 (28/11/2026). Lote L07: a vila e a fazenda. As quatro cercas seguem a curva e o esticar.
  cerca: { rotulo: 'Versão', opcoes: [{ id: 'tabuas', nome: 'Tábuas' }, { id: 'estacas', nome: 'Estacas' }, { id: 'vime', nome: 'Vime' }, { id: 'comNeve', nome: 'Tábuas com neve' }] },
  horta: { rotulo: 'Versão', opcoes: [{ id: 'legumes', nome: 'Legumes' }, { id: 'aboboras', nome: 'Abóboras' }, { id: 'repolhos', nome: 'Repolhos' }] },
  barril: { rotulo: 'Versão', opcoes: [{ id: 'fechado', nome: 'Fechado' }, { id: 'aberto', nome: 'Aberto com água' }, { id: 'tombado', nome: 'Tombado' }] },
  rodaDeCarroca: { rotulo: 'Versão', opcoes: [{ id: 'encostada', nome: 'Encostada' }, { id: 'deitada', nome: 'Deitada' }] },
  bancoDeTronco: { rotulo: 'Versão', opcoes: [{ id: 'tronco', nome: 'Tronco' }, { id: 'tabuaSobreTocos', nome: 'Tábua sobre tocos' }] },
  casinhaDeCachorro: { rotulo: 'Versão', opcoes: [{ id: 'vazia', nome: 'Vazia' }, { id: 'comTigela', nome: 'Com tigela' }] },
  // Lote L08: a neve. O iglu em ruína não tem a lamparina acesa na porta.
  muroBaixoDePedra: { rotulo: 'Versão', opcoes: [{ id: 'semNeve', nome: 'Sem neve' }, { id: 'comNeve', nome: 'Com neve' }] },
  bancoDePraca: { rotulo: 'Versão', opcoes: [{ id: 'semNeve', nome: 'Sem neve' }, { id: 'comNeve', nome: 'Com neve' }] },
  bonecoDeNeve: { rotulo: 'Versão', opcoes: [{ id: 'classico', nome: 'Clássico' }, { id: 'derretendo', nome: 'Derretendo' }] },
  iglu: { rotulo: 'Versão', opcoes: [{ id: 'inteiro', nome: 'Inteiro' }, { id: 'emRuina', nome: 'Em ruína', semLuz: true }] },
  treno: { rotulo: 'Versão', opcoes: [{ id: 'deCarga', nome: 'De carga' }, { id: 'pequeno', nome: 'Pequeno' }] },
  // Lote L09: a lava e o inferno. O portal apagado e o respiradouro adormecido não acendem; o caldeirão só acende no
  // Verde borbulhando (a luz verde é a da chama colorida, `corDaChama.ts`: o id da versão é a cor).
  portalMagico: { rotulo: 'Versão', opcoes: [{ id: 'infernal', nome: 'Infernal' }, { id: 'arcano', nome: 'Arcano' }, { id: 'gelo', nome: 'Gelo' }, { id: 'apagado', nome: 'Apagado', semLuz: true }] },
  respiradouroVulcanico: { rotulo: 'Versão', opcoes: [{ id: 'ativo', nome: 'Ativo' }, { id: 'adormecido', nome: 'Adormecido', semLuz: true }] },
  estacaComCranio: { rotulo: 'Versão', opcoes: [{ id: 'uma', nome: 'Uma' }, { id: 'tres', nome: 'Três' }] },
  caldeirao: { rotulo: 'Versão', opcoes: [{ id: 'caldo', nome: 'Caldo' }, { id: 'verde', nome: 'Verde borbulhando' }] },
}

/** A versão apaga a luz do objeto (o lustre apagado e o caído): `lib/luzDoFogo.ts` não a acende. */
export function versaoSemLuz(tipo: TipoMobilia | undefined, valor: unknown): boolean {
  const versao = normalizarVersaoDoMovel(tipo, valor)
  return versao !== undefined && versoesDoMovel(tipo)?.opcoes.find((opcao) => opcao.id === versao)?.semLuz === true
}

/** As versões do tipo (`undefined` = o tipo não tem versão, e o painel não mostra o campo). */
export function versoesDoMovel(tipo: TipoMobilia | undefined): VersoesDoMovel | undefined {
  return tipo === undefined ? undefined : VERSOES_DO_MOVEL[tipo]
}

/** A versão gravada que o tipo aceita: só um id da tabela que não seja o 1º. O resto (o 1º, texto torto, outro tipo) vira `undefined`. */
export function normalizarVersaoDoMovel(tipo: TipoMobilia | undefined, valor: unknown): string | undefined {
  const versoes = versoesDoMovel(tipo)
  if (versoes === undefined || typeof valor !== 'string' || valor === versoes.opcoes[0].id) return undefined
  return versoes.opcoes.some((opcao) => opcao.id === valor) ? valor : undefined
}

/** A versão que vale (a gravada ou a 1ª); `undefined` só no tipo sem versão. */
export function versaoEmVigor(tipo: TipoMobilia | undefined, valor: unknown): string | undefined {
  const versoes = versoesDoMovel(tipo)
  if (versoes === undefined) return undefined
  return normalizarVersaoDoMovel(tipo, valor) ?? versoes.opcoes[0].id
}
