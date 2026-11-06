import { isTauri } from '@tauri-apps/api/core'
import { useEffect, useId, useState } from 'react'
import { idDaCopiaDeTreino } from '../../lib/nuvem/projecao'
import { lerRpgDaPasta, type RpgDaPasta } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'
import { comInimigoLiberado, estaLiberado } from '../../net/nuvem/publicar'
import { useAdventureStore } from '../../stores/adventureStore'
import { useContasStore } from '../../stores/contasStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { editarRpgDaPasta } from '../../stores/rpgDaPasta'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { enviarInimigosDoTreino, type FichaNaPublicacao } from './ponteDoLobby'
import { usePastaPublicada } from './usePastaPublicada'
import './lobby.css'

/**
 * INIMIGO LIBERADO PARA O TREINO (docs/planos/lobby-jogadores-2026-11-05.md
 * §8.2, T8), na ficha do NPC: o mestre libera ou tira o NPC do treino dos
 * jogadores no site. A escolha mora na lista `treino.inimigosLiberados` do
 * `rpg.json` da pasta (a ficha não muda); com a pasta no Lobby, a cópia sobe
 * na hora pela projeção do treino (sem anotação, dono, combate e mochila).
 *
 * Só aparece para NPC de uma pasta de mapas: aventura solta e mapa
 * "Configurar só neste mapa" não vão ao Lobby.
 */

type Envio = { t: 'parado' } | { t: 'indo' } | { t: 'feito'; texto: string } | { t: 'falhou'; texto: string }

/** A pasta de onde a ficha veio: a do mapa aberto (se ele herda dela) ou a do mundo do livro aberto. */
function usePastaDoNpc(npcId: string): string | null {
  const daMesa = useAdventureStore((state) =>
    state.pasta !== null && !state.pasta.proprio && state.pasta.personagens.some((personagem) => personagem.id === npcId) ? state.pasta.pastaId : null,
  )
  const doMundo = useMundoDoLivroStore((state) => state.aberto?.pastaId ?? null)
  return daMesa ?? doMundo
}

/** A frase do envio: quantas cópias o Lobby tem agora e o que ficou de fora, com o motivo. */
function textoDoEnvio(npc: Personagem, liberado: boolean, inimigos: readonly FichaNaPublicacao[], falharamImagens: number): string {
  const fora = inimigos.filter((inimigo) => inimigo.situacao === 'recusada' || inimigo.situacao === 'adiada')
  const desta = fora.find((inimigo) => inimigo.fichaId === idDaCopiaDeTreino(npc.id))
  if (liberado && desta !== undefined) return `${npc.nome} não entrou no treino: ${desta.motivo ?? 'recusado pelo servidor'}.`
  const base = liberado ? `${npc.nome} está no treino do Lobby.` : `${npc.nome} saiu do treino do Lobby.`
  const outros = fora.filter((inimigo) => inimigo !== desta).length
  const avisoDosOutros = outros > 0 ? ` ${outros === 1 ? 'Outro inimigo liberado não entrou' : `${outros} outros inimigos liberados não entraram`}; abra a ficha dele para ver o porquê.` : ''
  const avisoDasImagens = falharamImagens > 0 ? ` ${falharamImagens === 1 ? 'Uma imagem não subiu' : `${falharamImagens} imagens não subiram`}: no site ela fica em branco.` : ''
  return `${base}${avisoDosOutros}${avisoDasImagens}`
}

export interface InimigoDoTreinoProps {
  npc: Personagem
}

export function InimigoDoTreino({ npc }: InimigoDoTreinoProps) {
  const pastaId = usePastaDoNpc(npc.id)
  // Pasta de mapas só existe no app instalado (fora dele não há `rpg.json` para ler).
  if (pastaId === null || !isTauri()) return null
  // `key`: trocar de pasta zera a leitura e o envio da anterior.
  return <InimigoDaPasta key={pastaId} npc={npc} pastaId={pastaId} />
}

function InimigoDaPasta({ npc, pastaId }: { npc: Personagem; pastaId: string }) {
  const id = useId()
  const [rpg, setRpg] = useState<RpgDaPasta | null>(null)
  const [erroDeLeitura, setErroDeLeitura] = useState<string | null>(null)
  const [envio, setEnvio] = useState<Envio>({ t: 'parado' })
  const { publicada } = usePastaPublicada(pastaId)

  useEffect(() => {
    let vivo = true
    lerRpgDaPasta(pastaId).then(
      (lido) => {
        if (!vivo) return
        if (lido.ok) setRpg(lido.rpg)
        else setErroDeLeitura(lido.motivo)
      },
      (erro: unknown) => {
        if (vivo) setErroDeLeitura(erro instanceof Error ? erro.message : String(erro))
      },
    )
    return () => {
      vivo = false
    }
  }, [pastaId])

  // A ficha pode não ser desta pasta (NPC de aventura solta com o mundo de outra pasta aberto): sem botão.
  if (erroDeLeitura !== null) {
    return (
      <p className="lby-erro lby-treino__erro" role="alert">
        Não deu para ler a lista do treino desta pasta: {erroDeLeitura}
      </p>
    )
  }
  if (rpg === null || !rpg.personagens.some((personagem) => personagem.id === npc.id)) return null

  const liberado = estaLiberado(rpg, npc.id)
  const ocupado = envio.t === 'indo'

  /** Manda a lista inteira ao Lobby (cria, troca e tira cópias). `null` = a pasta não está no Lobby. */
  const mandar = async (atual: RpgDaPasta, liberadoAgora: boolean): Promise<string | null> => {
    await useContasStore.getState().carregar()
    const contas = useContasStore.getState()
    // O publicar troca a lista de jogadores do servidor pela que vai: sem as contas lidas, ela iria vazia.
    if (!contas.podeGravar) throw new Error(contas.aviso ?? 'As contas dos jogadores não foram lidas, e o envio levaria a lista de jogadores vazia')
    const sistema = sistemaPorId(useRpgStore.getState().biblioteca, atual.sistemaDeRpg)
    const resultado = await enviarInimigosDoTreino({ pastaId, rpg: atual, sistema, contas: contas.arquivo.contas })
    if (!resultado.ok) throw new Error(resultado.falha.mensagem)
    if (resultado.valor.t === 'so-no-app') return null
    return textoDoEnvio(npc, liberadoAgora, resultado.valor.inimigos, resultado.valor.imagens.falharam)
  }

  const trocar = async () => {
    setEnvio({ t: 'indo' })
    let novo: RpgDaPasta
    try {
      novo = await editarRpgDaPasta(pastaId, (atual) => comInimigoLiberado(atual, npc.id, !liberado))
    } catch (erro) {
      setEnvio({ t: 'falhou', texto: `Não deu para guardar a escolha: ${erro instanceof Error ? erro.message : String(erro)}` })
      return
    }
    setRpg(novo)
    const agora = estaLiberado(novo, npc.id)
    try {
      const texto = await mandar(novo, agora)
      setEnvio({ t: 'feito', texto: texto ?? (agora ? `${npc.nome} vai para o treino quando a pasta for publicada no Lobby.` : `${npc.nome} saiu da lista do treino.`) })
    } catch (erro) {
      setEnvio({ t: 'falhou', texto: `${agora ? 'Ficou liberado aqui' : 'Saiu da lista aqui'}, mas o Lobby ainda não sabe: ${erro instanceof Error ? erro.message : String(erro)}` })
    }
  }

  const mandarDeNovo = async () => {
    setEnvio({ t: 'indo' })
    try {
      const texto = await mandar(rpg, liberado)
      setEnvio({ t: 'feito', texto: texto ?? 'A pasta não está no Lobby: a lista sobe com o Publicar.' })
    } catch (erro) {
      setEnvio({ t: 'falhou', texto: `Não chegou ao Lobby: ${erro instanceof Error ? erro.message : String(erro)}` })
    }
  }

  const dica = liberado
    ? publicada
      ? 'Os jogadores treinam contra uma cópia dele no site. Mudou a ficha? Mande a de agora.'
      : 'Liberado. A cópia sobe quando a pasta for publicada no Lobby.'
    : 'Os jogadores podem treinar contra ele no site. Sobe uma cópia sem a anotação, o dono, o combate e a mochila; a ficha daqui não muda.'

  return (
    <section className="lb-ficha-nota lby-treino" aria-labelledby={`${id}-t`}>
      <div className="lb-ficha-nota__cab">
        <h3 className="lb-ficha-nota__tit" id={`${id}-t`}>
          Treino no Lobby
        </h3>
        {liberado && <span className="lby-marca">Liberado</span>}
      </div>
      <p className="lby-dica" id={`${id}-dica`}>
        {dica}
      </p>
      <div className="lby-linha lby-treino__acoes">
        <button type="button" className="lb-btn lb-btn--compact" disabled={ocupado} aria-describedby={`${id}-dica`} onClick={() => void trocar()}>
          {liberado ? 'Tirar do treino' : 'Liberar para o treino'}
        </button>
        {(publicada && liberado) || envio.t === 'falhou' ? (
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={ocupado} onClick={() => void mandarDeNovo()}>
            {envio.t === 'falhou' ? 'Tentar de novo' : 'Mandar a ficha de agora'}
          </button>
        ) : null}
      </div>
      <p className={envio.t === 'falhou' ? 'lby-erro' : 'lby-dica'} role="status" aria-live="polite">
        {envio.t === 'indo' ? 'Enviando ao Lobby…' : envio.t === 'feito' || envio.t === 'falhou' ? envio.texto : ''}
      </p>
    </section>
  )
}
