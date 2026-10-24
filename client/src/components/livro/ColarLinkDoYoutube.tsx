import { useEffect, useId, useState } from 'react'
import type { MotivoDaRecusa, MotorAoVivo } from '../../lib/sons/aoVivo/motor'
import { NOME_DE_SOM_MAX, VOLUME_DE_SOM_PADRAO, nomeDeSomLimpo, type EfeitoNovo, type FonteDoSom } from '../../lib/sons/biblioteca'
import { lerLinkDoYoutube, segundosDoTempo, textoDoTempo } from '../../lib/sons/youtube/linkDoYoutube'
import { Botao } from '../grimorio/Botao'
import { CampoLiga } from '../grimorio/CampoLiga'

/*
 * "COLAR LINK" da aba Sons (Sistema 4, fatia F6): o mestre cola o link de um
 * vídeo do YouTube e guarda um botão que toca SÓ o áudio, pelo player
 * escondido. A prévia não chama API nenhuma: mostra o id lido do link (o
 * título de verdade pediria uma chamada ao YouTube). "Ouvir" prova o vídeo
 * neste computador antes de guardar; o erro de incorporação aparece aqui.
 */

/** O aviso de política e de rede, sempre à vista no formulário. */
export const AVISO_DO_YOUTUBE = 'Toca pelo YouTube, só o som: precisa de internet neste computador e em cada aparelho da mesa.'
/** A instância do "Ouvir" do formulário: só no computador do mestre, nunca vai à mesa. */
export const INSTANCIA_DA_PROVA_DO_YOUTUBE = 'prova-do-youtube'

const ERRO_DO_LINK = 'Esse link não é de um vídeo do YouTube. Cole o endereço do vídeo (youtube.com/watch?v=…, youtu.be/…, shorts/…).'
const ERRO_DO_TEMPO = 'Use minutos e segundos (1:30) ou só segundos (90).'

/** Por que a prova não tocou, dentro do formulário (o aviso da página fica atrás do diálogo). */
const FRASE_DA_PROVA: Partial<Record<MotivoDaRecusa, string>> = {
  'youtube-bloqueado': 'Este vídeo não deixa tocar fora do YouTube. Escolha outro vídeo.',
  'youtube-indisponivel': 'Este vídeo foi removido ou é privado.',
  'nao-carregou': 'O YouTube não respondeu. Confira a internet deste computador.',
  'fonte-invalida': 'O YouTube não reconheceu este vídeo.',
}

/** O nome da prévia quando o mestre não deu um: o id é o que se sabe sem perguntar ao YouTube. */
function nomePadrao(video: string): string {
  return `YouTube ${video}`
}

export interface ColarLinkDoYoutubeProps {
  motor: MotorAoVivo
  /** Guarda na biblioteca; devolve a frase da recusa (`null` = entrou). */
  onGuardar: (novo: EfeitoNovo) => string | null
  onFechar: () => void
}

export function ColarLinkDoYoutube({ motor, onGuardar, onFechar }: ColarLinkDoYoutubeProps) {
  const [link, setLink] = useState('')
  const [julgarLink, setJulgarLink] = useState(false)
  const [nome, setNome] = useState('')
  const [comeco, setComeco] = useState('')
  const [fim, setFim] = useState('')
  const [loop, setLoop] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const [recusa, setRecusa] = useState<string | null>(null)
  const idDoLink = useId()
  const idDoNome = useId()
  const idDoComeco = useId()
  const idDoFim = useId()

  const lido = lerLinkDoYoutube(link)
  const comecoS = comeco.trim() === '' ? 0 : segundosDoTempo(comeco)
  const fimS = fim.trim() === '' ? undefined : segundosDoTempo(fim)
  const fimDepoisDoComeco = fimS === undefined || (fimS !== null && comecoS !== null && fimS > comecoS)
  const nomeFinal = lido === null ? '' : nome.trim() === '' ? nomePadrao(lido.video) : nome
  const fonte: FonteDoSom | null =
    lido === null || comecoS === null || fimS === null || !fimDepoisDoComeco
      ? null
      : { tipo: 'youtube', video: lido.video, ...(comecoS > 0 ? { inicioS: comecoS } : {}), ...(fimS === undefined ? {} : { fimS }) }
  const podeGuardar = fonte !== null && nomeDeSomLimpo(nomeFinal) !== null
  const mostrarErroDoLink = julgarLink && link.trim() !== '' && lido === null

  // O "Ouvir" do formulário acende e apaga pelos eventos do motor; a recusa (erro 150, sem internet) aparece aqui dentro.
  useEffect(
    () =>
      motor.assinar((evento) => {
        if (evento.instancia !== INSTANCIA_DA_PROVA_DO_YOUTUBE) return
        if (evento.tipo === 'terminou' || evento.tipo === 'recusado') setOuvindo(false)
        if (evento.tipo === 'recusado') setRecusa(FRASE_DA_PROVA[evento.motivo] ?? 'O vídeo não tocou neste computador.')
      }),
    [motor],
  )
  // Fechar o formulário cala a prova.
  useEffect(() => () => motor.parar(INSTANCIA_DA_PROVA_DO_YOUTUBE), [motor])

  const mudarLink = (valor: string) => {
    setLink(valor)
    setRecusa(null)
    const novo = lerLinkDoYoutube(valor)
    // O `t=` do link preenche o "Começa em" (sem apagar o que o mestre já escreveu).
    if (novo?.inicioS !== undefined && comeco.trim() === '') setComeco(textoDoTempo(novo.inicioS))
  }

  const ouvir = () => {
    if (ouvindo) {
      motor.parar(INSTANCIA_DA_PROVA_DO_YOUTUBE)
      return
    }
    if (fonte === null) return
    const resultado = motor.tocar(INSTANCIA_DA_PROVA_DO_YOUTUBE, fonte, { loop: false, volumeDoEfeito: VOLUME_DE_SOM_PADRAO })
    setOuvindo(resultado.aceito)
  }

  const guardar = () => {
    if (fonte === null || !podeGuardar) {
      setJulgarLink(true)
      return
    }
    const motivo = onGuardar({ nome: nomeFinal, fonte, loop })
    if (motivo !== null) {
      setRecusa(motivo)
      return
    }
    onFechar()
  }

  return (
    <form
      className="lb-sons-editor lb-sons-yt"
      data-gr-foco
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault()
        guardar()
      }}
    >
      <p className="lb-sons__nota lb-sons__nota--latao">{AVISO_DO_YOUTUBE}</p>
      <div className="gr-campo">
        <div className="gr-campo__rot">
          <label htmlFor={idDoLink}>Link do vídeo</label>
        </div>
        <input
          id={idDoLink}
          className="gr-entrada"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://youtu.be/…"
          value={link}
          aria-invalid={mostrarErroDoLink}
          aria-describedby={mostrarErroDoLink ? `${idDoLink}-erro` : undefined}
          onChange={(evento) => mudarLink(evento.currentTarget.value)}
          onPaste={() => setJulgarLink(true)}
          onBlur={() => setJulgarLink(true)}
        />
        {mostrarErroDoLink && (
          <p className="lb-sons__nota lb-sons__nota--erro" id={`${idDoLink}-erro`} role="alert">
            {ERRO_DO_LINK}
          </p>
        )}
      </div>

      {lido !== null && (
        <div className="lb-sons-yt__previa" role="status" aria-label="Prévia do som">
          <span className="lb-sons-yt__selo" aria-hidden="true">
            YouTube
          </span>
          <span className="lb-sons-yt__titulo" dir="auto">
            {nomeFinal}
          </span>
          <span className="lb-sons-yt__detalhe">
            Vídeo {lido.video}
            {comecoS !== null && comecoS > 0 ? ` · começa em ${textoDoTempo(comecoS)}` : ''}
            {fimS !== undefined && fimS !== null ? ` · termina em ${textoDoTempo(fimS)}` : ''}
          </span>
        </div>
      )}

      <div className="gr-campo">
        <div className="gr-campo__rot">
          <label htmlFor={idDoNome}>Nome</label>
          <output htmlFor={idDoNome}>
            {nome.length}/{NOME_DE_SOM_MAX}
          </output>
        </div>
        <input
          id={idDoNome}
          className="gr-entrada"
          type="text"
          autoComplete="off"
          maxLength={NOME_DE_SOM_MAX}
          placeholder={lido === null ? 'Nome do botão' : nomePadrao(lido.video)}
          value={nome}
          onChange={(evento) => setNome(evento.currentTarget.value)}
        />
      </div>

      <div className="lb-sons-yt__trecho">
        <div className="gr-campo">
          <div className="gr-campo__rot">
            <label htmlFor={idDoComeco}>Começa em</label>
          </div>
          <input
            id={idDoComeco}
            className="gr-entrada"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0:00"
            value={comeco}
            aria-invalid={comecoS === null}
            aria-describedby={comecoS === null ? `${idDoComeco}-erro` : undefined}
            onChange={(evento) => setComeco(evento.currentTarget.value)}
          />
        </div>
        <div className="gr-campo">
          <div className="gr-campo__rot">
            <label htmlFor={idDoFim}>Termina em</label>
          </div>
          <input
            id={idDoFim}
            className="gr-entrada"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="fim do vídeo"
            value={fim}
            aria-invalid={fimS === null || !fimDepoisDoComeco}
            aria-describedby={fimS === null || !fimDepoisDoComeco ? `${idDoFim}-erro` : undefined}
            onChange={(evento) => setFim(evento.currentTarget.value)}
          />
        </div>
      </div>
      {comecoS === null && (
        <p className="lb-sons__nota lb-sons__nota--erro" id={`${idDoComeco}-erro`}>
          Começa em: {ERRO_DO_TEMPO}
        </p>
      )}
      {fimS === null ? (
        <p className="lb-sons__nota lb-sons__nota--erro" id={`${idDoFim}-erro`}>
          Termina em: {ERRO_DO_TEMPO}
        </p>
      ) : (
        !fimDepoisDoComeco && (
          <p className="lb-sons__nota lb-sons__nota--erro" id={`${idDoFim}-erro`}>
            Termina em precisa vir depois de Começa em.
          </p>
        )
      )}

      <CampoLiga rotulo="Repetir até parar" ajuda="Para música de fundo: volta ao Começa em quando acaba." ligado={loop} onChange={setLoop} />

      {recusa !== null && (
        <p className="lb-sons__nota lb-sons__nota--erro" role="alert">
          {recusa}
        </p>
      )}

      <div className="lb-sons-editor__pe">
        <Botao tamanho="p" disabled={fonte === null && !ouvindo} aria-label={ouvindo ? 'Parar o vídeo' : 'Ouvir o vídeo'} onClick={ouvir}>
          {ouvindo ? 'Parar' : 'Ouvir'}
        </Botao>
        <Botao tamanho="p" variante="primario" tipo="submit" className="gr-empurra" disabled={!podeGuardar}>
          Guardar som
        </Botao>
      </div>
    </form>
  )
}
