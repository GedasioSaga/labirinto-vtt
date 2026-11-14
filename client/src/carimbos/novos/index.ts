import type { DefinicaoDeCarimbo, Rgb } from '../embutidos'
import { carimbo as cerejeira, paleta as paletaDaCerejeira } from './cerejeira'
import { carimbo as bambuzal, paleta as paletaDoBambuzal } from './bambuzal'
import { carimbo as cogumeloGigante, paleta as paletaDoCogumeloGigante } from './cogumeloGigante'
import { carimbo as mangue, paleta as paletaDoMangue } from './mangue'
import { carimbo as carvalho, paleta as paletaDoCarvalho } from './carvalho'
import { carimbo as arvoreDeOutono, paleta as paletaDaArvoreDeOutono } from './arvoreDeOutono'
import { carimbo as salgueiro, paleta as paletaDoSalgueiro } from './salgueiro'
import { carimbo as betula, paleta as paletaDaBetula } from './betula'
import { carimbo as macieira, paleta as paletaDaMacieira } from './macieira'
import { carimbo as ipeAmarelo, paleta as paletaDoIpeAmarelo } from './ipeAmarelo'
import { carimbo as ipeRoxo, paleta as paletaDoIpeRoxo } from './ipeRoxo'
import { carimbo as araucaria, paleta as paletaDaAraucaria } from './araucaria'
import { carimbo as bananeira, paleta as paletaDaBananeira } from './bananeira'
import { carimbo as samambaia, paleta as paletaDaSamambaia } from './samambaia'
import { carimbo as capimAlto, paleta as paletaDoCapimAlto } from './capimAlto'
import { carimbo as floresDoCampo, paleta as paletaDasFloresDoCampo } from './floresDoCampo'
import { carimbo as arbustoComFrutinhas, paleta as paletaDoArbustoComFrutinhas } from './arbustoComFrutinhas'
import { carimbo as folhasSecas, paleta as paletaDasFolhasSecas } from './folhasSecas'
import { carimbo as galhosCaidos, paleta as paletaDosGalhosCaidos } from './galhosCaidos'
import { carimbo as seixos, paleta as paletaDosSeixos } from './seixos'
import { carimbo as lama, paleta as paletaDaLama } from './lama'
import { carimbo as musgo, paleta as paletaDoMusgo } from './musgo'
import { carimbo as vitoriaRegia, paleta as paletaDaVitoriaRegia } from './vitoriaRegia'
import { carimbo as conchas, paleta as paletaDasConchas } from './conchas'
import { carimbo as algas, paleta as paletaDasAlgas } from './algas'
import { carimbo as coral, paleta as paletaDoCoral } from './coral'
import { carimbo as cacto, paleta as paletaDoCacto } from './cacto'
import { carimbo as cactoRedondo, paleta as paletaDoCactoRedondo } from './cactoRedondo'
import { carimbo as arbustoQueRola, paleta as paletaDoArbustoQueRola } from './arbustoQueRola'
import { carimbo as cranioDeBoi, paleta as paletaDoCranioDeBoi } from './cranioDeBoi'
import { carimbo as monteDeNeve, paleta as paletaDoMonteDeNeve } from './monteDeNeve'
import { carimbo as arvoreCongelada, paleta as paletaDaArvoreCongelada } from './arvoreCongelada'
import { carimbo as blocoDeGelo, paleta as paletaDoBlocoDeGelo } from './blocoDeGelo'
import { carimbo as cristais, paleta as paletaDosCristais } from './cristais'
import { carimbo as estalagmite, paleta as paletaDaEstalagmite } from './estalagmite'
import { carimbo as cogumelosQueBrilham, paleta as paletaDosCogumelosQueBrilham } from './cogumelosQueBrilham'
import { carimbo as rochedoComMusgo, paleta as paletaDoRochedoComMusgo } from './rochedoComMusgo'
import { carimbo as rochaVulcanica, brilho as brilhoDaRochaVulcanica, paleta as paletaDaRochaVulcanica } from './rochaVulcanica'

/**
 * OS CARIMBOS NOVOS de 14/11/2026 (itens 111 a 152 da lista do mestre,
 * `tmp/objetos-2026-11-14/LISTA.md`; o 126 Girassóis não entra, já é do
 * pacote): um arquivo por carimbo nesta pasta, desenhado pelo desenhista do
 * lote, e registrado AQUI pelo integrador. Moram fora de `embutidos.ts`
 * porque importam `css`/`misturar` de lá: registrar lá seria import circular.
 *
 * O catálogo (`catalogo.ts`) põe estes depois dos 12 de hoje, na ordem da
 * lista, e todos contam como biblioteca: o pacote não pode repetir o id.
 * As regras do desenho são as de `embutidos.ts` (o quadro, a luz de cima à
 * esquerda, as cores contidas, a sombra que o app faz pelo `sombra`).
 *
 * Por lote:
 * - C1: cerejeira, bambuzal, cogumelo gigante, mangue, carvalho grande e
 *   árvore de outono (o 115 e o 116 vieram do C2 da tabela);
 * - C2: salgueiro-chorão, bétula, macieira, os dois ipês (o desenho dividido
 *   em `_ipe.ts`, que não é carimbo), araucária, bananeira e samambaia;
 * - C3: capim alto, flores do campo, arbusto com frutinhas, folhas secas e
 *   galhos caídos (o 128 e o 129 vieram do C4 da tabela);
 * - C4: seixos de rio, lama, musgo, vitória-régia, conchas e estrela-do-mar,
 *   algas na areia e coral;
 * - C5: cacto, cacto redondo, arbusto seco que rola, crânio de boi, monte de
 *   neve, árvore congelada e bloco de gelo;
 * - C6: cristais, estalagmite, cogumelos que brilham, rochedo com musgo e
 *   rocha vulcânica (a rocha facetada dos três dividida em `_rochaFacetada.ts`,
 *   que não é carimbo, como o `_ipe.ts`).
 *
 * Dois do C6 fazem mais que o desenho: os cogumelos que brilham e a rocha
 * vulcânica ILUMINAM em volta (a tabela `LUZ_DOS_CARIMBOS` de
 * `lib/luzDoFogo.ts`, por id), e a rocha tem a BRASA QUE PULSA: o `brilho`, a
 * parte que acende, no mesmo quadro do desenho, somada por cima dele no palco
 * (`pixi/brilhoDosCarimbos.ts`).
 */

export const CARIMBOS_NOVOS: readonly DefinicaoDeCarimbo[] = [
  cerejeira,
  bambuzal,
  cogumeloGigante,
  mangue,
  carvalho,
  arvoreDeOutono,
  salgueiro,
  betula,
  macieira,
  ipeAmarelo,
  ipeRoxo,
  araucaria,
  bananeira,
  samambaia,
  capimAlto,
  floresDoCampo,
  arbustoComFrutinhas,
  folhasSecas,
  galhosCaidos,
  seixos,
  lama,
  musgo,
  vitoriaRegia,
  conchas,
  algas,
  coral,
  cacto,
  cactoRedondo,
  arbustoQueRola,
  cranioDeBoi,
  monteDeNeve,
  arvoreCongelada,
  blocoDeGelo,
  cristais,
  estalagmite,
  cogumelosQueBrilham,
  rochedoComMusgo,
  // O desenhista exporta o brilho à parte (o pedido da folha o lê do módulo); o catálogo o leva na definição.
  { ...rochaVulcanica, brilho: brilhoDaRochaVulcanica },
]

/** Todas as cores chapadas dos novos, para o teste de "não estoura" (`embutidos.test.ts`). */
export const PALETA_DOS_NOVOS: readonly Rgb[] = [
  ...paletaDaCerejeira,
  ...paletaDoBambuzal,
  ...paletaDoCogumeloGigante,
  ...paletaDoMangue,
  ...paletaDoCarvalho,
  ...paletaDaArvoreDeOutono,
  ...paletaDoSalgueiro,
  ...paletaDaBetula,
  ...paletaDaMacieira,
  ...paletaDoIpeAmarelo,
  ...paletaDoIpeRoxo,
  ...paletaDaAraucaria,
  ...paletaDaBananeira,
  ...paletaDaSamambaia,
  ...paletaDoCapimAlto,
  ...paletaDasFloresDoCampo,
  ...paletaDoArbustoComFrutinhas,
  ...paletaDasFolhasSecas,
  ...paletaDosGalhosCaidos,
  ...paletaDosSeixos,
  ...paletaDaLama,
  ...paletaDoMusgo,
  ...paletaDaVitoriaRegia,
  ...paletaDasConchas,
  ...paletaDasAlgas,
  ...paletaDoCoral,
  ...paletaDoCacto,
  ...paletaDoCactoRedondo,
  ...paletaDoArbustoQueRola,
  ...paletaDoCranioDeBoi,
  ...paletaDoMonteDeNeve,
  ...paletaDaArvoreCongelada,
  ...paletaDoBlocoDeGelo,
  ...paletaDosCristais,
  ...paletaDaEstalagmite,
  ...paletaDosCogumelosQueBrilham,
  ...paletaDoRochedoComMusgo,
  // Só as cores chapadas do corpo: as da brasa (o `brilho`) ficam fora, como pede o briefing do desenhista.
  ...paletaDaRochaVulcanica,
]
