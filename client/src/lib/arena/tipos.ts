import type { ConsultaDaFicha } from '../../components/batalha/MiraDoGolpe'
import type { FotosDaForma, SelosNasFichas } from '../../pixi/tokenPhotoSprite'
import type { Token } from '../../types/map'
import type { JudgeNaCena } from '../batalha/judge'
import type { Personagem } from '../personagem'
import type { VidasDaCena } from '../vidaDaFicha'

/**
 * ARENA DE TESTES DE BATALHA — o contrato (fase 0 de
 * docs/planos/batalha-arena-de-testes-plano.md, seção 4.3, com as decisões
 * do fim do plano). O mestre monta dois lados com CÓPIAS das fichas da pasta
 * (ou um lado contra o Judge-boneco) e joga a batalha inteira controlando
 * todos. Nada grava nas fichas de verdade; nada vai a disco nem à rede.
 *
 * As costuras, com os nomes fixos:
 * - Lógica e sessão (`stores/arenaStore.ts`): `useArenaStore` (estado
 *   `ArenaState`), `mesaDaArena` (a `MesaDaBatalha` das cópias) e
 *   `batalhaDaArena = criarBatalhaStore(mesaDaArena)`, a store de batalha da
 *   arena, sempre na cena `CENA_DA_ARENA`. Puros em `lib/arena/`: `copias.ts`,
 *   `boneco.ts` (`fichaDoBoneco`), `placar.ts` (`placarDoBoneco` → `ContaDoPlacar`),
 *   `montagem.ts`, `reacaoDoBoneco.ts`, `estadoDaArena.ts` (`vistaParaJogador`).
 * - Palco (`components/arena/PalcoDaArena.tsx`): `PalcoDaArena`, só por
 *   `PalcoDaArenaProps`, sem store.
 * - Telas (`components/arena/`): `PaginaArena` (a montagem, marcador "arena"
 *   do mundo do livro), `TelaDaArena` (a camada cheia da luta),
 *   `PlacarDoBoneco`, `AjustesDoBoneco`.
 *
 * Só tipos e constantes: sem store, sem Pixi.
 */

/** A chave da única cena da `batalhaDaArena`. */
export const CENA_DA_ARENA = 'arena'

/** Px do mundo por casa da grade da arena (o `gridSize` do desenho das fichas). */
export const CASA_DA_ARENA = 64

/** Colunas x linhas da grade da arena. */
export interface GradeDaArena {
  readonly colunas: number
  readonly linhas: number
}

export const GRADE_PEQUENA: GradeDaArena = { colunas: 12, linhas: 8 }
export const GRADE_MEDIA: GradeDaArena = { colunas: 16, linhas: 10 }

export type TamanhoDaGrade = 'pequena' | 'media'

export const GRADES_DA_ARENA: Readonly<Record<TamanhoDaGrade, GradeDaArena>> = { pequena: GRADE_PEQUENA, media: GRADE_MEDIA }

/** A vida do boneco com "HP ∞": um número que nenhum golpe zera; a tela mostra "∞". */
export const VIDA_INFINITA = 1_000_000

/** Fichas num lado (contando as repetidas); o boneco fica fora da conta. */
export const FICHAS_POR_LADO_MAX = 6
/** O mesmo NPC repetido no mesmo lado ("Marinheiro 2"). */
export const VEZES_MAX = 6

/** Prefixo do id da cópia (`arena_<uuid>`): a cópia nunca colide com a ficha real nem com outra cópia (Bruno contra Bruno). */
export const PREFIXO_DA_COPIA = 'arena_'
/** Prefixo do id do token gerado (`arena_tok_<n>`). */
export const PREFIXO_DO_TOKEN = 'arena_tok_'

export type LadoDaArena = 'a' | 'b'

/** "lados": Lado A contra Lado B, o Judge de árbitro. "boneco": só o Lado A, contra o Judge-boneco. */
export type ModoDaArena = 'lados' | 'boneco'

/** As duas equipes virtuais da mesa da arena (o boneco entra na do Lado B). Cor no formato de `Equipe.cor`. */
export const EQUIPE_DO_LADO: Readonly<Record<LadoDaArena, { readonly id: string; readonly nome: string; readonly cor: string }>> = {
  a: { id: 'arena-a', nome: 'Lado A', cor: '#4a78c2' },
  b: { id: 'arena-b', nome: 'Lado B', cor: '#c2524a' },
}

/** Uma ficha real escolhida na montagem. */
export interface EscolhaNaMontagem {
  /** O id da ficha REAL (a cópia nasce no `lutar`). */
  personagemId: string
  lado: LadoDaArena
  /** Quantas cópias dela no lado: 1..`VEZES_MAX`. */
  vezes: number
}

/** Como o boneco reage ao golpe: rola o d20 com o modificador e escolhe sozinho a melhor defesa, ou não reage. */
export type ReacaoDoBoneco = 'd20' | 'parado'

/** O que o mestre ajusta no boneco (na montagem e na luta). */
export interface AjustesDoBoneco {
  /** HP ∞ (`VIDA_INFINITA`); desligado vale `hp`. */
  infinito: boolean
  hp: number
  escudo: number
  /** Modificador da reação: -`MODIFICADOR_DA_REACAO_MAX`..+`MODIFICADOR_DA_REACAO_MAX` (`lib/batalha/combate.ts`). */
  modificador: number
  reage: ReacaoDoBoneco
}

export const BONECO_PADRAO: AjustesDoBoneco = { infinito: true, hp: 100, escudo: 0, modificador: 0, reage: 'd20' }

export interface MontagemDaArena {
  modo: ModoDaArena
  /** No modo "boneco" as escolhas do Lado B ficam guardadas, mas não entram na luta. */
  escolhas: EscolhaNaMontagem[]
  grade: TamanhoDaGrade
  boneco: AjustesDoBoneco
}

/** O boneco na luta: a ficha e o token dele, com os ajustes de agora. */
export interface BonecoDaArena extends AjustesDoBoneco {
  tokenId: string
  /** O id da ficha do boneco (`fichaDoBoneco`), na lista de cópias. */
  personagemId: string
}

/** Um golpe que acertou o boneco, como o placar mostra. */
export interface GolpeNoPlacar {
  /** A linha do registro do golpe (uma linha = um golpe). */
  linhaId: string
  rodada: number
  /** O nome de quem bateu. */
  atacante: string
  /** O nome do golpe. */
  golpe: string
  /** Quanto desceu do Escudo. */
  escudo: number
  /** Quanto desceu do HP. */
  hp: number
  /** `escudo + hp`. */
  total: number
}

/** O placar do modo boneco. */
export interface ContaDoPlacar {
  golpes: readonly GolpeNoPlacar[]
  total: number
  /** As rodadas que a média divide: as completas (as em que errou inclusive) e a atual só depois que um golpe dela entrou (`placar.ts`). */
  rodadas: number
  /** Decisão 2: `total` dividido por `rodadas` (0 rodadas = 0). */
  mediaPorRodada: number
}

/** A sessão da arena: só na memória, some ao sair. */
export interface SessaoDaArena {
  fase: 'montando' | 'lutando'
  montagem: MontagemDaArena
  /** O livro (sistema) aberto no mundo. */
  sistemaId: string
  /** As cópias na luta (id `PREFIXO_DA_COPIA` + uuid, nome igual ou com sufixo, histórico zerado), com a do boneco. Vazio na montagem. */
  copias: Personagem[]
  /** Cópia → ficha real (só para mostrar). */
  origemDe: Record<string, string>
  /** As fichas no palco, geradas: id `PREFIXO_DO_TOKEN` + n, `characterId` = a cópia, x/y no centro da casa. */
  tokens: Token[]
  ladoDe: Record<string, LadoDaArena | 'boneco'>
  /** `null` = modo "lados", ou montando. */
  boneco: BonecoDaArena | null
  /** Golpes cujas linhas já saíram do registro (`REGISTRO_MAX`): o placar continua contando. */
  placarCongelado: GolpeNoPlacar[]
}

/** O estado da `useArenaStore`. */
export interface EstadoDaArena {
  /** `null` = arena fechada. */
  sessao: SessaoDaArena | null
}

export interface AcoesDaArena {
  /** Abre a montagem do livro `sistemaId`. A sessão do mesmo livro continua como estava; outro livro = sessão nova (montagem vazia, `BONECO_PADRAO`). */
  abrir: (sistemaId: string) => void
  /**
   * "+ A" / "+ B" e o repetir (x2, x3): a ficha real no `lado`, com `vezes`
   * cópias (padrão 1; já estava no lado = troca as vezes). Respeita
   * `VEZES_MAX` e `FICHAS_POR_LADO_MAX`. Só na montagem.
   */
  escolher: (personagemId: string, lado: LadoDaArena, vezes?: number) => void
  /** Tira a ficha do lado (todas as cópias). Só na montagem. */
  tirar: (personagemId: string, lado: LadoDaArena) => void
  /** A chave "Contra o Judge-boneco". Só na montagem. */
  trocarModo: (modo: ModoDaArena) => void
  /** Grade Pequena ou Média. Só na montagem. */
  trocarGrade: (grade: TamanhoDaGrade) => void
  /**
   * "Começar o teste": copia as escolhidas de `fichas` (as reais de AGORA,
   * `usePersonagensDoMundo`), gera a grade e os tokens, cria o boneco no modo
   * "boneco" e liga a `batalhaDaArena`. `false` = montagem incompleta (1 de
   * cada lado, ou 1 contra o boneco) ou livro sem sistema no computador.
   */
  lutar: (fichas: readonly Personagem[]) => boolean
  /** Soltou a ficha em (x, y), já no centro da casa (px do mundo): anda e soma os blocos na batalha da arena. `false` = ficha desconhecida ou a mesma casa. */
  moverFicha: (tokenId: string, x: number, y: number) => boolean
  /** Ajusta o boneco: na montagem, guarda; na luta, troca a cópia dele direto (sem linha no registro). */
  ajustarBoneco: (ajuste: Partial<AjustesDoBoneco>) => void
  /** Recomeçar (sem confirmação, decisão 6): copia de novo de `fichas`, mesma montagem, posições iniciais, placar zerado, batalha religada. */
  recomecar: (fichas: readonly Personagem[]) => boolean
  /** Desliga a batalha da arena e volta à montagem (as escolhas ficam). */
  voltarAMontagem: () => void
  /** Desliga a batalha e esquece a sessão inteira (`sessao` = `null`). */
  sair: () => void
}

export type ArenaState = EstadoDaArena & AcoesDaArena

/** O palco da arena: só props, sem store (`components/arena/PalcoDaArena.tsx`). */
export interface PalcoDaArenaProps {
  /** As fichas da sessão, com x/y no centro da casa. */
  tokens: readonly Token[]
  grade: GradeDaArena
  /** A ficha da vez (anel e pulso); `null` = nenhuma. */
  vezTokenId: string | null
  vidas: VidasDaCena
  selos: SelosNasFichas
  fotoDaForma: FotosDaForma
  /** Onde o Judge está (árbitro no modo "lados"; no modo "boneco", o lugar da ficha do boneco); `null` = sem Judge. */
  judge: JudgeNaCena | null
  /** Para onde o Judge vira: o centro da ficha da vez; `null` = fica olhando para onde estava. */
  judgeAlvo: { x: number; y: number } | null
  /** `ultimoGestoDoJudge` dos efeitos da cena da arena: `seq` maior ergue a carta (`JudgeDoMapa.lerFila`). */
  gestoDoJudge: number | null
  /**
   * Modo "boneco": a ficha do boneco. O Judge é o corpo dela: tocar nele =
   * `onTocarFicha(bonecoTokenId)` e a consulta dela devolve o corpo do Judge.
   * `null` = modo "lados".
   */
  bonecoTokenId: string | null
  /** Soltou a ficha: (x, y) já encaixado no centro da casa, px do mundo. */
  onMover: (tokenId: string, x: number, y: number) => void
  /** Clique (ou toque) na ficha: vira o `alvoDoMapa` da mira. */
  onTocarFicha: (tokenId: string) => void
  /** O palco publica como achar a ficha na tela (a mira usa); `null` ao desmontar. */
  onConsulta: (consulta: ConsultaDaFicha | null) => void
}
