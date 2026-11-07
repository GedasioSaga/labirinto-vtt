import { idDaRef } from '../../lib/midia'
import { ehRegistro, proprio, type Json } from '../../lib/nuvem/json'
import type { Op } from '../../lib/nuvem/tipos'
import type { Personagem } from '../../lib/personagem'
import { ErroDaPonte, falhaDoStatus, lerErroDaR1, type FalhaDaNuvem, type PonteDaNuvem } from './ponte'
import { midiasDaFicha } from './publicar'

/**
 * AS IMAGENS QUE AS FICHAS CITAM, NO LOBBY (plano §6.6, W3): a ficha sobe com
 * `midia:<sha256>.<ext>` e o arquivo sobe à parte, pelo `nuvem_enviar_midia`
 * da R1 (a R1 lê da cópia da pasta ou da mídia da mesa e confere tamanho, tipo
 * e hash; o PUT é idempotente). Sem o arquivo no servidor, o site mostra as
 * iniciais no lugar do retrato.
 *
 * Dois caminhos usam isto:
 *  - o PUBLICAR (`components/nuvem/ponteDoLobby.ts`): depois das fichas, cada
 *    imagem distinta das fichas que estão no servidor, inclusive as que voltam
 *    `ja-publicada` (publicar de novo é como se manda o que faltou);
 *  - o SINCRONIZADOR (`ponteComMidia`, ligado em `nuvemNoApp.ts`): a op que
 *    leva uma `midia:` nova só vai depois do arquivo.
 *
 * A imagem que falha nunca derruba as fichas: o publicar lista quais não
 * subiram e por quê; o sincronizador espera quando a falha é de rede ou de
 * token (tentar de novo resolve) e segue sem a imagem quando repetir não
 * resolve (arquivo sumido, grande demais, danificado), com um aviso.
 */

/** Sobe uma imagem pelo id; rejeita com o erro cru da R1 (`{ codigo, mensagem, status, detalhe }`) ou o texto do Tauri. */
export type EnviarMidia = (midiaId: string) => Promise<unknown>

/**
 * Por que a imagem não subiu, com o `motivo` pronto para a tela.
 * `passageira` = rede, token ou servidor fora do ar: tentar depois resolve, e
 * `falha` diz ao laço o que fazer. `definitiva` = repetir não resolve.
 */
export type FalhaDaMidia = { t: 'definitiva'; motivo: string } | { t: 'passageira'; motivo: string; falha: FalhaDaNuvem }

const SUMIU = 'o arquivo da imagem não está mais neste computador'
const GRANDE_DEMAIS = 'a imagem passa de 2 MB, o máximo do Lobby'
const DANIFICADA = 'o arquivo da imagem está danificado ou não é webp, png, jpg nem gif'
const CAMPANHA_CHEIA = 'as imagens desta campanha já somam 300 MB, o máximo do Lobby'
const SEM_PONTE = 'este app ainda não sabe mandar imagens ao Lobby (atualize o Labirinto)'
const SEM_REDE = 'sem internet agora; publique de novo mais tarde'
const SEM_TOKEN = 'o token do app não está valendo; confira a Conta na nuvem'
const SERVIDOR_FORA = 'o servidor do Lobby não respondeu agora; publique de novo mais tarde'
const CAMPANHA_SUMIU = 'o Lobby não achou esta campanha para a sua conta'

/** O que o servidor diz no `erro` do corpo (lobby/nuvem/src/midia.ts), em português simples. */
const MOTIVO_DO_SERVIDOR: Readonly<Record<string, string>> = {
  'midia-grande': GRANDE_DEMAIS,
  'campanha-cheia': CAMPANHA_CHEIA,
  'tipo-errado': DANIFICADA,
  'hash-errado': DANIFICADA,
}

function definitiva(motivo: string): FalhaDaMidia {
  return { t: 'definitiva', motivo }
}

/** O erro do `nuvem_enviar_midia` lido: o que houve e se tentar de novo resolve. */
export function lerFalhaDaMidia(erro: unknown): FalhaDaMidia {
  // O Tauri responde em texto quando o comando não existe neste binário.
  if (typeof erro === 'string' && /not found|unknown command|not allowed/i.test(erro)) return definitiva(SEM_PONTE)
  // Erro do próprio JavaScript (não da R1): a mensagem dele, que o lerErroDaR1 trocaria por uma genérica.
  if (erro instanceof Error) return definitiva(erro.message)
  const codigo = ehRegistro(erro) ? proprio(erro, 'codigo') : undefined
  const mensagem = ehRegistro(erro) ? proprio(erro, 'mensagem') : undefined
  // Os dois erros do disco da R1 (`ler_imagem_para_enviar`): o lerErroDaR1 os juntaria em `interno`.
  if (codigo === 'midia_ausente') return definitiva(SUMIU)
  if (codigo === 'midia_invalida') return definitiva(typeof mensagem === 'string' && /passa de/i.test(mensagem) ? GRANDE_DEMAIS : DANIFICADA)
  const lido = lerErroDaR1(erro)
  if (lido instanceof ErroDaPonte) {
    if (lido.codigo === 'rede') return { t: 'passageira', motivo: SEM_REDE, falha: { t: 'sem-rede', detalhe: lido.message } }
    if (lido.codigo === 'sem-credencial') return { t: 'passageira', motivo: SEM_TOKEN, falha: { t: 'sem-credencial', detalhe: lido.message } }
    return definitiva(lido.message)
  }
  const doServidor = ehRegistro(lido.corpo) ? proprio(lido.corpo, 'erro') : undefined
  if (typeof doServidor === 'string' && Object.hasOwn(MOTIVO_DO_SERVIDOR, doServidor)) return definitiva(MOTIVO_DO_SERVIDOR[doServidor])
  const falha = falhaDoStatus(lido)
  switch (falha.t) {
    case 'sem-rede':
      return { t: 'passageira', motivo: SERVIDOR_FORA, falha }
    case 'nao-existe':
      return { t: 'passageira', motivo: CAMPANHA_SUMIU, falha }
    case 'versao':
    case 'sem-credencial':
      return { t: 'passageira', motivo: falha.detalhe, falha }
    case 'erro':
      return definitiva(`o Lobby recusou a imagem (${falha.detalhe})`)
  }
}

// ── O publicar: cada imagem distinta, poucas de uma vez ─────────────────────

export interface ImagemQueNaoSubiu {
  midiaId: string
  /** As fichas que usam a imagem, na ordem em que vieram. */
  fichas: string[]
  motivo: string
}

export interface EnvioDasImagens {
  total: number
  enviadas: number
  falhas: ImagemQueNaoSubiu[]
}

export interface ProgressoDasImagens {
  feitas: number
  total: number
}

/** Cada imagem distinta das fichas (retrato, cartões em qualquer nível, itens da mochila), com o nome de quem a usa. */
export function imagensDasFichas(fichas: readonly Personagem[]): Map<string, string[]> {
  const porImagem = new Map<string, string[]>()
  for (const ficha of fichas) {
    for (const midiaId of midiasDaFicha(ficha)) {
      const nomes = porImagem.get(midiaId) ?? []
      if (!nomes.includes(ficha.nome)) nomes.push(ficha.nome)
      porImagem.set(midiaId, nomes)
    }
  }
  return porImagem
}

/** Quantas sobem ao mesmo tempo: cada uma tem até 2 MB, e a tela continua respondendo. */
const IMAGENS_DE_UMA_VEZ = 3

/**
 * Sobe cada imagem, `IMAGENS_DE_UMA_VEZ` por vez. A que falha entra em
 * `falhas` (na ordem das imagens) e não para as outras. Nunca rejeita.
 */
export async function enviarImagens(
  porImagem: ReadonlyMap<string, readonly string[]>,
  enviar: EnviarMidia,
  aoProgresso?: (progresso: ProgressoDasImagens) => void,
): Promise<EnvioDasImagens> {
  const ids = [...porImagem.keys()]
  const total = ids.length
  const motivos = new Map<string, string>()
  let proxima = 0
  let feitas = 0
  aoProgresso?.({ feitas, total })
  const trabalhar = async (): Promise<void> => {
    while (proxima < total) {
      const midiaId = ids[proxima]
      proxima += 1
      try {
        await enviar(midiaId)
      } catch (erro) {
        motivos.set(midiaId, lerFalhaDaMidia(erro).motivo)
      }
      feitas += 1
      aoProgresso?.({ feitas, total })
    }
  }
  await Promise.all(Array.from({ length: Math.min(IMAGENS_DE_UMA_VEZ, total) }, trabalhar))
  const falhas = ids.flatMap((midiaId): ImagemQueNaoSubiu[] => {
    const motivo = motivos.get(midiaId)
    return motivo === undefined ? [] : [{ midiaId, fichas: [...(porImagem.get(midiaId) ?? [])], motivo }]
  })
  return { total, enviadas: total - falhas.length, falhas }
}

// ── O sincronizador: a imagem antes da op que a cita ────────────────────────

/** As imagens que um valor cita, em qualquer profundidade (o retrato, o cartão com subcartões, a ficha inteira do `criar`). */
function juntarImagensDoValor(valor: Json | undefined, ids: Set<string>): void {
  if (typeof valor === 'string') {
    // Só a referência de IMAGEM na forma exata; a de áudio e o texto solto ficam de fora.
    const id = idDaRef(valor)
    if (id !== null) ids.add(id)
    return
  }
  if (valor === null || valor === undefined || typeof valor !== 'object') return
  for (const dentro of Array.isArray(valor) ? valor : Object.values(valor)) juntarImagensDoValor(dentro, ids)
}

/** As imagens distintas que as ops do lote põem na ficha. */
export function imagensDoLote(lote: readonly Op[]): string[] {
  const ids = new Set<string>()
  for (const op of lote) juntarImagensDoValor(op.valor, ids)
  return [...ids]
}

export interface ImagensDoSincronizador {
  enviar: EnviarMidia
  /** A imagem que repetir não faz subir: as ops seguem sem ela. */
  aoDesistir: (midiaId: string, motivo: string) => void
}

/**
 * A ponte do sincronizador com as imagens na frente: antes de mandar um lote,
 * sobe cada imagem nova que ele cita (uma vez por app aberto; o PUT do mesmo
 * id é idempotente). Falha passageira = o lote espera inteiro, como se o
 * envio dele tivesse falhado (a mesma rede, o mesmo token), e o site nunca
 * recebe a referência antes do arquivo. Falha definitiva = avisa e manda o
 * lote: travar a fila por uma foto pararia todas as mudanças da campanha.
 */
export function ponteComMidia(ponte: PonteDaNuvem, imagens: ImagensDoSincronizador): PonteDaNuvem {
  const resolvidas = new Set<string>()
  return {
    async enviarOps(campanhaId, clienteId, lote) {
      for (const midiaId of imagensDoLote(lote)) {
        if (resolvidas.has(midiaId)) continue
        try {
          await imagens.enviar(midiaId)
        } catch (erro) {
          const falha = lerFalhaDaMidia(erro)
          if (falha.t === 'passageira') return falha.falha
          imagens.aoDesistir(midiaId, falha.motivo)
        }
        resolvidas.add(midiaId)
      }
      return ponte.enviarOps(campanhaId, clienteId, lote)
    },
    desde(campanhaId, rev, limite) {
      return ponte.desde(campanhaId, rev, limite)
    },
  }
}
