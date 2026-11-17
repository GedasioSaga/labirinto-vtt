import { useEffect, useId, useMemo, useState } from 'react'
import { fichaMinima } from '../../lib/livros/combate'
import { PERSONAGEM_NOME_MAX } from '../../net/protocoloDoPersonagem'
import { campanhaComPastaDoVerbete, campanhaParaLigar, descricaoDoNpc, imagemDaForma } from '../../lib/preparo/doVerbeteParaOMapa'
import { fichaDeMesmoNome } from '../../lib/preparo/fichaDoVerbete'
import type { TipoDePersonagem } from '../../lib/personagem'
import type { Forma, LigaFicha, Verbete } from '../../lib/preparo/tipos'
import { LigarCampanhaAPasta } from '../campanhas/LigarCampanhaAPasta'
import { usePreludio } from '../estado/preludio'
import { anotarFicha, useTiposDasFichasLigadas } from '../enciclopedia/tiposDasFichas'
import { lerPastaParaNpc, retratoDaMidia, VirarNpc } from '../enciclopedia/VirarNpc'
import { cancelarPorVerbete, gravarFichaNaPasta, porVerbeteNoMapa, useMesaNaJanela } from './mesaNaJanela'
import type { ComoVaiAoMapa } from './protocolo'

/**
 * "PÔR NO MAPA" POR TIPO (E3 de 16/11/2026, tela 4 do protótipo aprovado):
 * cada tipo de verbete vai para o mapa de um jeito. Personagem vira TOKEN com
 * a ficha ligada (de NPC ou de jogador, a do próprio jogador); Item vira item do Acervo com pino de item que o jogador
 * pega; Lugar vira "!" com a imagem, que o jogador vê com a descrição sendo
 * datilografada. Personagem sem ficha pergunta antes: "Ficha mínima e pôr"
 * (o padrão, um clique), "Fazer a ficha antes" ou "Só o token, sem ficha".
 * O "Pôr no mapa" de cada seção (o "!" e o "?" de sempre) continua igual.
 */

const COMO_DO_TIPO: Partial<Record<Verbete['tipo'], ComoVaiAoMapa>> = { personagem: 'token', item: 'item', lugar: 'lugar' }

/** O que o verbete vira no mapa, dito como o protótipo. */
function oQueVai(como: ComoVaiAoMapa, ficha: TipoDePersonagem | null, temImagem: boolean): string {
  if (como === 'token') return ficha === null ? 'Ainda sem ficha. O token precisa de uma.' : ficha === 'jogador' ? 'Põe o token com a ficha do jogador.' : 'Põe o token com a ficha de NPC.'
  if (como === 'item') return 'Cria o item no Acervo (ou usa o de mesmo nome) e põe um pino de item que o jogador pega.'
  return temImagem ? 'Põe um ! com a imagem. O jogador vê a imagem e a descrição sendo datilografada.' : 'Põe um ! com a descrição. O verbete não tem imagem: o jogador lê só o texto.'
}

function useEscCancelaOVerbete(ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cancelarPorVerbete()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [ativo])
}

export function PorOVerbeteNoMapa({ verbete, forma }: { verbete: Verbete; forma: Forma }) {
  const ligada = useMesaNaJanela((estado) => estado.ligada)
  const viva = useMesaNaJanela((estado) => estado.viva)
  const pondo = useMesaNaJanela((estado) => estado.pondoVerbete)
  const aviso = useMesaNaJanela((estado) => estado.avisoDoVerbete)
  const posto = useMesaNaJanela((estado) => estado.postoVerbete)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const ativa = usePreludio((estado) => estado.campanhaId)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const mudarVerbete = usePreludio((estado) => estado.mudarVerbete)
  const [escolhendo, setEscolhendo] = useState(false)
  const [virando, setVirando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null)
  const tituloId = useId()
  const escolhasId = useId()
  const como = COMO_DO_TIPO[verbete.tipo]
  const minha = pondo !== null && pondo.fonte.verbeteId === verbete.id
  const tipos = useTiposDasFichasLigadas(useMemo(() => [verbete], [verbete]))
  useEscCancelaOVerbete(minha)
  if (!ligada || como === undefined) return null

  const ficha: LigaFicha | null = verbete.liga?.fichas[0] ?? null
  // O token vai com a primeira ficha ligada: o texto fala dela (a que a loja ainda não leu conta como NPC, o texto de antes).
  const tipoDaFicha = ficha === null ? null : (tipos.get(ficha.pastaId)?.get(ficha.personagemId) ?? 'npc')
  const campanha = campanhaComPastaDoVerbete(verbete, campanhas, ativa)
  const paraLigar = campanha === null ? campanhaParaLigar(verbete, campanhas, ativa) : null
  const fonte = { verbeteId: verbete.id, formaId: forma.id }
  const naMesa = posto !== null && posto.verbeteId === verbete.id

  const pedir = (ligacao: LigaFicha | null) => {
    setEscolhendo(false)
    setAvisoLocal(null)
    void porVerbeteNoMapa(fonte, como, ligacao)
  }

  /** "Ficha mínima e pôr": a ficha mínima do sistema da campanha (ou a de mesmo nome que já está na pasta, de NPC ou de jogador), ligada, e o token na mão. */
  const minimaEPor = async () => {
    if (campanha === null) return
    setPreparando(true)
    setAvisoLocal(null)
    const pasta = await lerPastaParaNpc(campanha.pastaId)
    if (pasta.t === 'falhou') {
      setPreparando(false)
      setAvisoLocal(pasta.motivo)
      return
    }
    const nome = verbete.titulo.trim().slice(0, PERSONAGEM_NOME_MAX) || 'NPC sem nome'
    const mesmoNome = fichaDeMesmoNome(pasta.personagens, nome)
    let ligacao: LigaFicha
    if (mesmoNome !== null) {
      ligacao = { pastaId: campanha.pastaId, personagemId: mesmoNome.id }
      anotarFicha(campanha.pastaId, mesmoNome)
    }
    else {
      const nova = { ...fichaMinima(pasta.sistema, nome), descricao: descricaoDoNpc(verbete, forma, verbetes), retrato: await retratoDaMidia(imagemDaForma(forma)) }
      const motivo = await gravarFichaNaPasta(campanha.pastaId, nova)
      if (motivo !== null) {
        setPreparando(false)
        setAvisoLocal(`A ficha mínima não foi gravada: ${motivo}`)
        return
      }
      ligacao = { pastaId: campanha.pastaId, personagemId: nova.id }
      anotarFicha(campanha.pastaId, nova)
    }
    const ja = ligacao
    mudarVerbete(verbete.id, (atual) => ({ ...atual, liga: { fichas: [...(atual.liga?.fichas ?? []), ja], cenas: [...(atual.liga?.cenas ?? [])] } }))
    setPreparando(false)
    pedir(ligacao)
  }

  const aoPor = () => {
    if (como === 'token' && ficha === null) setEscolhendo((antes) => !antes)
    else pedir(ficha)
  }

  const avisoMostrado = avisoLocal ?? (pondo === null ? aviso : null)
  return (
    <section className="pr-trilho__bloco" aria-labelledby={tituloId}>
      <h3 id={tituloId} className="pr-trilho__titulo">
        Pôr no mapa
      </h3>
      <p className="pr-quieto">{oQueVai(como, tipoDaFicha, imagemDaForma(forma) !== null)}</p>
      <div className="pr-por" onPointerDown={(evento) => evento.stopPropagation()}>
        <button
          type="button"
          className={naMesa ? 'gr-bt gr-bt--fantasma gr-bt--p' : 'gr-bt gr-bt--latao gr-bt--p'}
          aria-expanded={como === 'token' && ficha === null ? escolhendo : undefined}
          aria-controls={como === 'token' && ficha === null ? escolhasId : undefined}
          aria-pressed={minha ? true : undefined}
          disabled={!viva || preparando}
          title={viva ? undefined : 'A janela do mapa não está respondendo.'}
          onClick={aoPor}
        >
          {preparando ? 'Fazendo a ficha…' : naMesa ? 'Pôr de novo' : 'Pôr no mapa'}
        </button>
        {naMesa && (
          <span className="pr-chip pr-por__chip" role="status">
            <span aria-hidden="true">✓</span> Na mesa
          </span>
        )}
        {escolhendo && (
          <div id={escolhasId} className="pr-por__escolhas" role="group" aria-label={`Como pôr ${verbete.titulo || 'este personagem'}`}>
            <button type="button" className="gr-bt gr-bt--primario gr-bt--p" disabled={campanha === null} onClick={() => void minimaEPor()}>
              Ficha mínima e pôr
            </button>
            <button type="button" className="gr-bt gr-bt--p" disabled={campanha === null} onClick={() => setVirando(true)}>
              Fazer a ficha antes
            </button>
            <button type="button" className="gr-bt gr-bt--fantasma gr-bt--p" onClick={() => pedir(null)}>
              Só o token, sem ficha
            </button>
            {campanha === null &&
              (paraLigar === null ? (
                <span className="pr-por__motivo">Sem campanha com pasta de mapas, não há onde guardar a ficha.</span>
              ) : (
                <LigarCampanhaAPasta campanha={paraLigar} aoLigar={() => undefined} />
              ))}
          </div>
        )}
        {minha && (
          <div className="pr-por__espera" role="status">
            <span>{pondo.andamento === 'pedindo' ? 'Preparando na janela do mapa…' : 'Clique no mapa, na janela principal, onde ele fica. Esc cancela.'}</span>
            <button type="button" className="gr-bt gr-bt--fantasma gr-bt--p" onClick={cancelarPorVerbete}>
              Cancelar
            </button>
          </div>
        )}
        {avisoMostrado !== null && (
          <p className="pr-aviso pr-por__aviso" role="alert">
            {avisoMostrado}
          </p>
        )}
      </div>
      {virando && campanha !== null && (
        <VirarNpc
          verbete={verbete}
          forma={forma}
          pastaId={campanha.pastaId}
          aoFechar={() => setVirando(false)}
          aoFeito={(ligacao) => {
            setVirando(false)
            pedir(ligacao)
          }}
        />
      )}
    </section>
  )
}
