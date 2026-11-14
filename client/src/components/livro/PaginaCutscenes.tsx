import { useEffect, useState, useSyncExternalStore } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { CUTSCENE_TITULO_MAX } from '../../net/protocol'
import { assinarRedeDaCutscene, redeDaCutscene, type ResultadoDoTocar } from '../../net/redeDaCutscene'
import { GALERIA_VIDEO_MAX_BYTES, mensagemDaFalha, tirarDaGaleria } from '../../net/nuvem/galeriaNaNuvem'
import { useCutscenesStore, VIDEO_MAX_BYTES, type Cutscene, type ExibicaoEmCurso } from '../../stores/cutscenesStore'
import { useToastStore } from '../../stores/toastStore'
import { Botao } from '../grimorio/Botao'
import { CampoLiga } from '../grimorio/CampoLiga'
import { CampoTexto } from '../grimorio/CampoTexto'
import { TituloDaPagina } from './FolhaDoLivro'
import { IconeDoLivro } from './icones'
import './cutscenes.css'

/**
 * CUTSCENES (14/11/2026, pedido do mestre): a página do livro da mesa onde o
 * mestre guarda os vídeos (mp4/webm até 500 MB, copiados para a mídia da mesa
 * pelo Rust, sem passar pela webview), toca para todos e acompanha quem já
 * baixou. O vídeo só toca quando todas as telas baixaram (sem prazo); o mestre
 * pode tocar já ou parar para todos. Com "Na Galeria", depois da 1ª exibição o
 * vídeo sobe para o site dos jogadores (até 150 MB).
 */

const MB = 1024 * 1024

interface VideoNaMidia {
  id: string
  tamanho: number
  mime: string
}

function ehVideoNaMidia(valor: unknown): valor is VideoNaMidia {
  if (typeof valor !== 'object' || valor === null) return false
  return 'id' in valor && typeof valor.id === 'string' && 'tamanho' in valor && typeof valor.tamanho === 'number'
}

function tamanhoLegivel(bytes: number): string {
  return `${(bytes / MB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

/** O nome do arquivo sem pasta nem extensão, no teto do título. */
function tituloDoArquivo(caminho: string): string {
  const nome = caminho.split(/[\\/]/).pop() ?? 'Cutscene'
  const semExtensao = nome.replace(/\.[^.]+$/, '').replace(/[\r\n]+/g, ' ').trim()
  return (semExtensao === '' ? 'Cutscene' : semExtensao).slice(0, CUTSCENE_TITULO_MAX)
}

const FRASE_DO_TOCAR: Record<Exclude<ResultadoDoTocar, 'ok'>, string> = {
  'sem-jogador': 'Ninguém na mesa para ver: abra a sala e espere os jogadores entrarem.',
  'ja-tocando': 'Já há uma cutscene na mesa. Pare a de agora antes de tocar outra.',
  invalida: 'Esta cutscene tem um título ou vídeo fora do formato. Mude o título e tente de novo.',
}

function avisar(tipo: 'error' | 'info', texto: string): void {
  useToastStore.getState().push(tipo, texto)
}

function PainelDaExibicao({ exibicao }: { exibicao: ExibicaoEmCurso }) {
  const prontas = exibicao.telas.filter((tela) => tela.pronta).length
  const esperando = exibicao.fase === 'esperando'
  return (
    <section className="lb-cutscenes__painel" aria-label="Cutscene na mesa">
      <p className="lb-cutscenes__painel-titulo">
        <strong>{exibicao.titulo}</strong>
        <span>{esperando ? `Baixando: ${prontas} de ${exibicao.telas.length} telas prontas` : 'Tocando na mesa'}</span>
      </p>
      <ul className="lb-cutscenes__telas">
        {exibicao.telas.map((tela) => (
          <li key={tela.clientId} className="lb-cutscenes__tela" data-falhou={tela.falhou}>
            <span className="lb-cutscenes__tela-nome">{tela.nome}</span>
            <span className="lb-cutscenes__tela-estado">{tela.falhou ? 'não chegou' : tela.terminou ? 'terminou' : tela.pronta ? 'pronta' : `${tela.pct}%`}</span>
            <span className="lb-cutscenes__barra" aria-hidden="true">
              <span className="lb-cutscenes__cheio" style={{ transform: `scaleX(${tela.pct / 100})` }} />
            </span>
          </li>
        ))}
      </ul>
      <div className="lb-cutscenes__acoes">
        {esperando && (
          <Botao variante="latao" tamanho="p" onClick={() => redeDaCutscene()?.tocarAgora()}>
            Tocar agora
          </Botao>
        )}
        <Botao variante="perigo" tamanho="p" onClick={() => redeDaCutscene()?.parar()}>
          Parar para todos
        </Botao>
      </div>
    </section>
  )
}

function EstadoDaGaleria({ cutscene }: { cutscene: Cutscene }) {
  const galeria = cutscene.galeria
  if (cutscene.tamanho > GALERIA_VIDEO_MAX_BYTES) return <p className="lb-cutscenes__nota">Passa de 150 MB: fica só na mesa, não vai para a Galeria.</p>
  if (!cutscene.naGaleria || galeria === undefined) return cutscene.naGaleria ? <p className="lb-cutscenes__nota">Vai para a Galeria do site depois da 1ª exibição.</p> : null
  switch (galeria.estado) {
    case 'enviando':
      return <p className="lb-cutscenes__nota">Subindo para a Galeria: {galeria.pct}%</p>
    case 'enviado':
      return <p className="lb-cutscenes__nota">Na Galeria do site.</p>
    case 'grande':
      return <p className="lb-cutscenes__nota">Passa de 150 MB: fica só na mesa, não vai para a Galeria.</p>
    case 'erro':
      return (
        <p className="lb-cutscenes__nota lb-cutscenes__nota--erro">
          {galeria.erro}{' '}
          <button type="button" className="lb-cutscenes__link" onClick={() => void useCutscenesStore.getState().enviarParaAGaleria(cutscene.id)}>
            Tentar de novo
          </button>
        </p>
      )
  }
}

function LinhaDaCutscene({ cutscene, comSala, ocupada }: { cutscene: Cutscene; comSala: boolean; ocupada: boolean }) {
  const [tirando, setTirando] = useState(false)
  const loja = useCutscenesStore.getState
  const tocar = () => {
    const rede = redeDaCutscene()
    if (rede === null) return
    const resultado = rede.tocar({ cutsceneId: cutscene.id, video: cutscene.video, titulo: cutscene.titulo })
    if (resultado !== 'ok') avisar('error', FRASE_DO_TOCAR[resultado])
  }
  const tirar = async () => {
    const galeria = cutscene.galeria
    if (galeria?.estado !== 'enviado') return
    setTirando(true)
    try {
      await tirarDaGaleria(galeria.campanhaId, cutscene.video)
      loja().mudar(cutscene.id, { naGaleria: false, galeria: undefined })
      avisar('info', `"${cutscene.titulo}" saiu da Galeria do site.`)
      void loja().conferirGaleria()
    } catch (erro) {
      avisar('error', mensagemDaFalha(erro))
    } finally {
      setTirando(false)
    }
  }
  const cabeNaGaleria = cutscene.tamanho <= GALERIA_VIDEO_MAX_BYTES
  return (
    <li className="lb-cutscenes__item">
      <CampoTexto
        rotulo="Título"
        valor={cutscene.titulo}
        maxLength={CUTSCENE_TITULO_MAX}
        onChange={(titulo) => {
          const limpo = titulo.replace(/[\r\n]+/g, ' ')
          if (limpo.trim() !== '') loja().mudar(cutscene.id, { titulo: limpo })
        }}
      />
      <p className="lb-cutscenes__nota">
        {tamanhoLegivel(cutscene.tamanho)}
        {cutscene.exibida ? ' · já tocou na mesa' : ''}
      </p>
      <CampoLiga
        rotulo="Na Galeria"
        ajuda={cabeNaGaleria ? 'Depois de tocar, o vídeo fica no site dos jogadores, aba Galeria.' : 'Acima de 150 MB o vídeo não vai para o site.'}
        ligado={cutscene.naGaleria && cabeNaGaleria}
        disabled={!cabeNaGaleria || cutscene.galeria?.estado === 'enviando'}
        onChange={(naGaleria) => {
          loja().mudar(cutscene.id, { naGaleria })
          // Ligado depois de já ter tocado: sobe agora.
          if (naGaleria && cutscene.exibida && cutscene.galeria?.estado !== 'enviado') void loja().enviarParaAGaleria(cutscene.id)
        }}
      />
      <EstadoDaGaleria cutscene={cutscene} />
      <div className="lb-cutscenes__acoes">
        <Botao variante="primario" tamanho="p" disabled={!comSala || ocupada} onClick={tocar}>
          <IconeDoLivro nome="filme" />
          Tocar para todos
        </Botao>
        {cutscene.galeria?.estado === 'enviado' && (
          <Botao variante="fantasma" tamanho="p" disabled={tirando} onClick={() => void tirar()}>
            Tirar da Galeria
          </Botao>
        )}
        <Botao variante="fantasma" tamanho="p" disabled={ocupada} onClick={() => loja().remover(cutscene.id)}>
          Remover da lista
        </Botao>
      </div>
    </li>
  )
}

export function PaginaCutscenes() {
  const lista = useCutscenesStore((estado) => estado.lista)
  const exibicao = useCutscenesStore((estado) => estado.exibicao)
  const rede = useSyncExternalStore(assinarRedeDaCutscene, redeDaCutscene)
  const [importando, setImportando] = useState(false)

  // Ao abrir, relê a Galeria do site: o mestre pode ter tirado um vídeo por lá.
  // Sem o disco do app (navegador puro), a lista fica vazia sem erro solto.
  useEffect(() => {
    const loja = useCutscenesStore.getState()
    loja
      .carregar()
      .then(() => loja.conferirGaleria())
      .catch(() => undefined)
  }, [])

  const adicionar = async () => {
    const escolhido = await open({ multiple: false, directory: false, filters: [{ name: 'Vídeo (mp4, webm)', extensions: ['mp4', 'webm'] }] })
    if (typeof escolhido !== 'string') return
    setImportando(true)
    try {
      const video: unknown = await invoke('midia_importar_video', { caminho: escolhido })
      if (!ehVideoNaMidia(video)) throw new Error('o app não devolveu o vídeo importado')
      const loja = useCutscenesStore.getState()
      loja.adicionar({ id: `cut_${crypto.randomUUID()}`, titulo: tituloDoArquivo(escolhido), video: video.id, tamanho: video.tamanho, naGaleria: video.tamanho <= GALERIA_VIDEO_MAX_BYTES, exibida: false })
      if (video.tamanho > GALERIA_VIDEO_MAX_BYTES) avisar('info', 'O vídeo passa de 150 MB: toca na mesa, mas não vai para a Galeria do site.')
    } catch (erro) {
      avisar('error', `Não deu para adicionar o vídeo: ${erro instanceof Error ? erro.message : String(erro)}`)
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="lb-cutscenes" role="region" aria-label="Cutscenes">
      <TituloDaPagina titulo="Cutscenes" sub={`Vídeos mp4 ou webm até ${VIDEO_MAX_BYTES / MB} MB. Toca quando todos baixarem.`} />
      {exibicao !== null && <PainelDaExibicao exibicao={exibicao} />}
      {rede === null && <p className="lb-cutscenes__nota">Abra a sala para tocar uma cutscene para os jogadores.</p>}
      <Botao variante="latao" tamanho="p" disabled={importando} onClick={() => void adicionar()}>
        <IconeDoLivro nome="mais" />
        {importando ? 'Copiando o vídeo…' : 'Adicionar vídeo…'}
      </Botao>
      {lista.length === 0 ? (
        <p className="lb-cutscenes__nota">Nenhuma cutscene ainda.</p>
      ) : (
        <ul className="lb-cutscenes__lista">
          {lista.map((cutscene) => (
            <LinhaDaCutscene key={cutscene.id} cutscene={cutscene} comSala={rede !== null} ocupada={exibicao !== null} />
          ))}
        </ul>
      )}
    </div>
  )
}
