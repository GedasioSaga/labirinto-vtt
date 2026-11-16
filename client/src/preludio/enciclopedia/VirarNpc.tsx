import { useEffect, useId, useState } from 'react'
import { Dialogo } from '../../components/grimorio/Dialogo'
import { FichaDoSistema } from '../../components/dbt/registroDeFichas'
import { escolherImagemDaFicha } from '../../lib/arquivosDaFicha'
import { chaveDoNome } from '../../lib/contasDosJogadores'
import { fichaPeloComeco, modelosDeNpc, type ComecoDaFicha } from '../../lib/livros/combate'
import { lerIndiceDasPastas, lerRpgDaPasta } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'
import { descricaoDoNpc, imagemDaForma } from '../../lib/preparo/doVerbeteParaOMapa'
import type { Forma, LigaFicha, Verbete } from '../../lib/preparo/tipos'
import { recursoDeVida } from '../../lib/vidaDaFicha'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { buildTokenPhotoData } from '../../lib/tokenPhoto'
import { PERSONAGEM_NOME_MAX } from '../../net/protocoloDoPersonagem'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { usePreludio } from '../estado/preludio'
import { gravarFichaNaPasta } from '../janela/mesaNaJanela'
import { prepararMidia, urlDaMidia } from '../midia'
import './virarNpc.css'

/**
 * "VIRAR NPC" (E3 de 16/11/2026, tela 3 do protótipo aprovado): o verbete de
 * Personagem abre a ficha do sistema da campanha já com nome, retrato e
 * descrição (Resumo e Aparência; o Segredo nunca). O começo (ficha mínima,
 * modelo do bestiário, em branco) refaz status e técnicas; nome, retrato e
 * descrição ficam. Salvar grava a ficha na pasta de mapas da campanha (pela
 * mesa, `gravarFichaNaPasta`) e liga o verbete a ela (`LIGA_FICHA`).
 */

type Comeco = 'minima' | 'modelo' | 'branco'

type Carga = { readonly t: 'lendo' } | PastaParaNpc

export interface VirarNpcProps {
  verbete: Verbete
  forma: Forma
  pastaId: string
  aoFechar: () => void
  /** Gravou e ligou: a ficha nova, para quem abriu (o "Ficha mínima e pôr" segue para o mapa). */
  aoFeito: (ligacao: LigaFicha, ficha: Personagem) => void
}

export type PastaParaNpc =
  | { readonly t: 'pronta'; readonly nomeDaPasta: string; readonly sistema: SistemaDeRpg; readonly personagens: readonly Personagem[] }
  | { readonly t: 'falhou'; readonly motivo: string }

/** A pasta da campanha, o sistema dela e as fichas que já tem (os modelos e os nomes que não podem repetir). */
export async function lerPastaParaNpc(pastaId: string): Promise<PastaParaNpc> {
  const [{ indice }, lido] = await Promise.all([lerIndiceDasPastas(), lerRpgDaPasta(pastaId), useRpgStore.getState().carregarBiblioteca()])
  const nomeDaPasta = indice.pastas.find((pasta) => pasta.id === pastaId)?.nome ?? 'a pasta da campanha'
  if (!lido.ok) return { t: 'falhou', motivo: `Não deu para ler as fichas de ${nomeDaPasta}: ${lido.motivo}` }
  const sistemaId = lido.rpg.sistemaDeRpg
  const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaId)
  if (sistema === undefined) {
    return {
      t: 'falhou',
      motivo:
        sistemaId === undefined
          ? `A pasta ${nomeDaPasta} ainda não tem sistema de RPG. Escolha um na pasta, em Carregar mapa, e volte aqui.`
          : `O sistema da pasta ${nomeDaPasta} (${sistemaId}) não está na biblioteca deste computador.`,
    }
  }
  return { t: 'pronta', nomeDaPasta, sistema, personagens: lido.rpg.personagens }
}

function useCargaDaPasta(pastaId: string): Carga {
  const [carga, setCarga] = useState<Carga>({ t: 'lendo' })
  useEffect(() => {
    let vivo = true
    void lerPastaParaNpc(pastaId).then((lida) => {
      if (vivo) setCarga(lida)
    })
    return () => {
      vivo = false
    }
  }, [pastaId])
  return carga
}

/** Uma imagem do Prelúdio como foto embutida da ficha e do token (`buildTokenPhotoData`); `null` = sem imagem ou não deu. */
export async function retratoDaMidia(midia: string | null): Promise<string | null> {
  const raiz = await prepararMidia()
  const url = raiz === null ? null : urlDaMidia(raiz, midia)
  if (url === null) return null
  try {
    const resposta = await fetch(url)
    return resposta.ok ? await buildTokenPhotoData(await resposta.blob()) : null
  } catch {
    // Sem a foto o NPC nasce com as iniciais; o mestre troca na ficha.
    return null
  }
}

/** O retrato do verbete, lido do disco depois de a janela abrir; `null` enquanto lê. */
function useRetratoDoVerbete(midia: string | null): string | null {
  const [retrato, setRetrato] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    void retratoDaMidia(midia).then((foto) => {
      if (vivo) setRetrato(foto)
    })
    return () => {
      vivo = false
    }
  }, [midia])
  return retrato
}

/** A frase do começo "Ficha mínima" no sistema desta pasta: diz o que ele tem e o que não tem. */
function notaDaMinima(sistema: SistemaDeRpg): string {
  const vida = recursoDeVida(sistema)
  return vida === null ? 'Neste sistema não há vida: entra o Golpe de 80, onde couber.' : `${vida.nome} 300 e um Golpe de 80. Pronto para lutar.`
}

export function VirarNpc({ verbete, forma, pastaId, aoFechar, aoFeito }: VirarNpcProps) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const mudarVerbete = usePreludio((estado) => estado.mudarVerbete)
  const carga = useCargaDaPasta(pastaId)
  const retratoDoVerbete = useRetratoDoVerbete(imagemDaForma(forma))
  const [comeco, setComeco] = useState<Comeco>('minima')
  const [modeloId, setModeloId] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Personagem | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const tituloDaFichaId = useId()
  const grupoId = useId()

  const sistema = carga.t === 'pronta' ? carga.sistema : null
  const modelos = carga.t === 'pronta' ? modelosDeNpc([...carga.personagens]) : []
  const modelo = modelos.find((um) => um.id === modeloId) ?? modelos[0]
  const temSegredo = forma.secoes.some((secao) => secao.segredo)

  // O começo (e o sistema, quando chega) refaz a ficha; nome, retrato e descrição seguem os do rascunho.
  useEffect(() => {
    if (sistema === null) return
    const de: ComecoDaFicha = comeco === 'modelo' && modelo !== undefined ? { tipo: 'modelo', modelo } : comeco === 'branco' ? { tipo: 'branco' } : { tipo: 'minima' }
    setRascunho((antes) => {
      const nome = antes?.nome ?? (verbete.titulo.trim().slice(0, PERSONAGEM_NOME_MAX) || 'NPC sem nome')
      const nova = fichaPeloComeco(de, sistema, nome)
      return { ...nova, descricao: antes?.descricao ?? descricaoDoNpc(verbete, forma, verbetes), retrato: antes?.retrato ?? nova.retrato }
    })
    // `verbetes` e `forma` só servem à primeira descrição: mudar o texto do verbete com a ficha aberta não apaga o que o mestre escreveu.
  }, [sistema, comeco, modelo?.id])

  // O retrato do verbete chega depois (lido do disco): entra se o mestre ainda não escolheu outro.
  useEffect(() => {
    if (retratoDoVerbete === null) return
    setRascunho((antes) => (antes === null || antes.retrato !== null ? antes : { ...antes, retrato: retratoDoVerbete }))
  }, [retratoDoVerbete, rascunho?.id])

  const salvar = async () => {
    if (rascunho === null || carga.t !== 'pronta' || gravando) return
    const nome = rascunho.nome.trim()
    if (nome === '') {
      setErro('Dê um nome ao NPC.')
      return
    }
    if (carga.personagens.some((um) => chaveDoNome(um.nome) === chaveDoNome(nome))) {
      setErro(`Já existe “${nome}” em ${carga.nomeDaPasta}. Use outro nome.`)
      return
    }
    setErro(null)
    setGravando(true)
    const ficha: Personagem = { ...rascunho, nome, tipo: 'npc' }
    const motivo = await gravarFichaNaPasta(pastaId, ficha)
    setGravando(false)
    if (motivo !== null) {
      setErro(`A ficha não foi gravada: ${motivo}`)
      return
    }
    const ligacao: LigaFicha = { pastaId, personagemId: ficha.id }
    mudarVerbete(verbete.id, (atual) => ({ ...atual, liga: { fichas: [...(atual.liga?.fichas ?? []), ligacao], cenas: [...(atual.liga?.cenas ?? [])] } }))
    aoFeito(ligacao, ficha)
  }

  const titulo = `Virar NPC: ${verbete.titulo || 'sem nome'}`
  return (
    <Dialogo aberto titulo={titulo} onFechar={aoFechar} classe="pr-virar" descricao={sistema === null ? undefined : <SistemaDaFicha sistema={sistema} pasta={carga.t === 'pronta' ? carga.nomeDaPasta : ''} />}>
      {carga.t === 'lendo' ? (
        <p className="pr-quieto">Lendo a pasta da campanha…</p>
      ) : carga.t === 'falhou' ? (
        <p className="pr-aviso" role="alert">
          {carga.motivo}
        </p>
      ) : (
        <div className="pr-virar__corpo" data-gr-foco>
          <h3 className="pr-virar__h" id={grupoId}>
            Começar de <small>Trocar o começo refaz status e técnicas; nome, retrato e descrição ficam.</small>
          </h3>
          <div className="pr-virar__comeco" role="radiogroup" aria-labelledby={grupoId}>
            <label className="pr-virar__op">
              <input type="radio" name="pr-virar-comeco" value="minima" checked={comeco === 'minima'} onChange={() => setComeco('minima')} />
              <b>Ficha mínima de combate</b>
              <span>{notaDaMinima(carga.sistema)}</span>
              <span className="pr-virar__selo">Padrão</span>
            </label>
            <label className={modelos.length === 0 ? 'pr-virar__op pr-virar__op--indisp' : 'pr-virar__op'}>
              <input type="radio" name="pr-virar-comeco" value="modelo" checked={comeco === 'modelo'} disabled={modelos.length === 0} onChange={() => setComeco('modelo')} />
              <b>Modelo do livro</b>
              {modelos.length === 0 ? (
                <span>O bestiário de {carga.nomeDaPasta} ainda não tem modelos de NPC.</span>
              ) : (
                <>
                  <span>Um modelo do bestiário do {carga.sistema.nome}.</span>
                  <select
                    className="pr-campo__entrada"
                    aria-label="Modelo do livro"
                    value={modelo?.id ?? ''}
                    onChange={(evento) => {
                      setModeloId(evento.target.value)
                      setComeco('modelo')
                    }}
                  >
                    {modelos.map((um) => (
                      <option key={um.id} value={um.id}>
                        {um.nome}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </label>
            <label className="pr-virar__op">
              <input type="radio" name="pr-virar-comeco" value="branco" checked={comeco === 'branco'} onChange={() => setComeco('branco')} />
              <b>Em branco</b>
              <span>Só nome, retrato e descrição. Você preenche o resto.</span>
            </label>
          </div>
          <p className="pr-virar__veio">
            Nome, retrato e descrição vieram do verbete (Resumo e Aparência).{temSegredo ? ' A seção Segredo ficou de fora.' : ''}
          </p>
          {rascunho !== null && (
            <div className="pr-virar__ficha">
              <FichaDoSistema personagem={rascunho} sistema={carga.sistema} editando onChange={setRascunho} escolherImagem={escolherImagemDaFicha} tituloId={tituloDaFichaId} tipoEditavel={false} />
            </div>
          )}
          <footer className="pr-virar__pe">
            <p>
              Vai para <b>{carga.nomeDaPasta}</b> ({carga.sistema.nome}). O verbete fica ligado à ficha.
            </p>
            {erro !== null && (
              <p className="pr-virar__erro" role="alert">
                {erro}
              </p>
            )}
            <button type="button" className="gr-bt gr-bt--fantasma" onClick={aoFechar}>
              Cancelar
            </button>
            <button type="button" className="gr-bt gr-bt--primario" disabled={rascunho === null || gravando} onClick={() => void salvar()}>
              {gravando ? 'Gravando…' : 'Salvar a ficha'}
            </button>
          </footer>
        </div>
      )}
    </Dialogo>
  )
}

function SistemaDaFicha({ sistema, pasta }: { sistema: SistemaDeRpg; pasta: string }) {
  return (
    <>
      Ficha do <b>{sistema.nome}</b>, que vem da pasta de mapas <b>{pasta}</b> da campanha.
    </>
  )
}
