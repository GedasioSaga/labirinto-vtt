import type { CenaAlavanca } from './tipos'

/**
 * OS TEXTOS DE CADA CENA da alavanca (o `TEXTOS` do protótipo aprovado,
 * `docs/design/minigames/alavanca-da-ponte.html`): o jogo é o mesmo, muda o
 * que se lê. O "Erguer o canhão no mapa" do protótipo fica de fora: o app não
 * tem objeto canhão, e a vitória faz o mesmo que na ponte (abre a porta
 * ligada). Decisão do Claude, 20/11/2026, anotada no PEDIDOS.
 */
export interface TextosDaCena {
  /** O título do convite, da migalha e da janela. */
  nome: string
  seVencer: string
  quandoVencer: string
  /** O desfecho sem porta, como o jogador lê. */
  mapaOk: string
  mapaNada: string
  /** Encerrada pelo mestre antes da rodada. */
  continua: string
  objeto: string
  objetoAria: string
  forca: string
  forcaCurta: string
  pesada: string
  parada: string
  dica: string
  dicaPerto: string
  dicaVenceu: string
  dicaPerdeu: string
  anuncioVenceu: string
  anuncioPerdeu: string
  venceu: string
  perdeu: string
  subPerdeu: (pct: number, dificuldade: string, tempo: number) => string
  subEncerrado: (duracao: string, pct: number) => string
  progresso: (pct: number) => string
  pausa: string
  aria: (p: number) => string
  /** O painel do mestre: a porta que a vitória abre. */
  semPorta: string
  efeitoSemPorta: string
  efeitoComPorta: string
  ponhaPorta: string
  emEquipe: string
  /** A rodada ao vivo do mestre. */
  situacaoVenceu: string
  situacaoPerdeu: string
  /** O aviso do fim na tela do mestre. */
  desfechoComPorta: string
  desfechoSemPorta: string
  desfechoPerdeu: string
  desfechoEncerrado: string
}

export const TEXTOS_DA_CENA: Readonly<Record<CenaAlavanca, TextosDaCena>> = {
  ponte: {
    nome: 'Alavanca da ponte',
    seVencer: 'Se a ponte descer',
    quandoVencer: 'Quando a ponte descer',
    mapaOk: 'No mapa: a ponte levadiça desce e o fosso pode ser atravessado.',
    mapaNada: 'No mapa, nada muda: a ponte continua erguida.',
    continua: 'A ponte continua erguida.',
    objeto: 'Ponte',
    objetoAria: 'Ponte baixada',
    forca: 'Força da corrente',
    forcaCurta: 'Corrente',
    pesada: 'pesada',
    parada: 'parada',
    dica: 'Aperte X sem parar. A corrente puxa a ponte de volta o tempo todo.',
    dicaPerto: 'Falta pouco: perto do chão a corrente pesa mais.',
    dicaVenceu: 'A ponte desceu! A catraca trava.',
    dicaPerdeu: 'O tempo acabou: a corrente puxa a ponte de volta.',
    anuncioVenceu: 'A ponte desceu!',
    anuncioPerdeu: 'O tempo acabou. A corrente puxou a ponte de volta.',
    venceu: 'A ponte desceu!',
    perdeu: 'A corrente venceu',
    subPerdeu: (pct, dificuldade, tempo) => `A ponte chegou a ${pct}% e voltou a subir (${dificuldade}, ${tempo} s).`,
    subEncerrado: (duracao, pct) => `A rodada parou em ${duracao} s, com a ponte a ${pct}%.`,
    progresso: (pct) => `${pct}% baixada`,
    pausa: 'A corrente espera. Esc ou o botão continua.',
    aria: (p) => (p >= 1 ? 'A ponte levadiça desceu e está assentada na margem.' : p <= 0.01 ? 'A ponte levadiça está erguida diante do portão.' : `A ponte levadiça está ${Math.round(p * 10) * 10}% baixada.`),
    semPorta: 'Nenhuma: só a ponte desce',
    efeitoSemPorta: 'A ponte levadiça desce e o fosso pode ser atravessado.',
    efeitoComPorta: 'A porta do mapa se abre, mesmo trancada, quando a ponte desce.',
    ponhaPorta: 'Ponha uma porta no mapa para a ponte abrir.',
    emEquipe: 'Cada um aperta X (ou o botão Girar) no próprio computador. Em equipe, cada aperto vale menos, mas a ponte desce mais rápido.',
    situacaoVenceu: 'Venceram: a ponte desceu',
    situacaoPerdeu: 'Perderam: a corrente venceu',
    desfechoComPorta: 'Alavanca da ponte: a ponte desceu e a porta ligada abriu.',
    desfechoSemPorta: 'Alavanca da ponte: a ponte desceu.',
    desfechoPerdeu: 'Alavanca da ponte: o tempo acabou e a corrente puxou a ponte de volta.',
    desfechoEncerrado: 'Alavanca da ponte: rodada encerrada.',
  },
  canhao: {
    nome: 'Canhão do chão',
    seVencer: 'Se o canhão subir',
    quandoVencer: 'Quando o canhão subir',
    mapaOk: 'No mapa: o canhão sobe e fica apontado pela ameia.',
    mapaNada: 'No mapa, nada muda: o canhão continua escondido debaixo das lajes.',
    continua: 'O canhão continua escondido debaixo das lajes.',
    objeto: 'Canhão',
    objetoAria: 'Canhão erguido',
    forca: 'Peso do canhão',
    forcaCurta: 'Peso',
    pesada: 'pesado',
    parada: 'parado',
    dica: 'Aperte X sem parar. O peso do canhão puxa a plataforma de volta o tempo todo.',
    dicaPerto: 'Falta pouco: perto do topo o canhão pesa mais.',
    dicaVenceu: 'O canhão chegou! A trava fecha.',
    dicaPerdeu: 'O tempo acabou: o canhão desce de volta ao poço.',
    anuncioVenceu: 'O canhão subiu e travou!',
    anuncioPerdeu: 'O tempo acabou. O peso levou o canhão de volta ao poço.',
    venceu: 'O canhão subiu!',
    perdeu: 'O peso venceu',
    subPerdeu: (pct, dificuldade, tempo) => `O canhão chegou a ${pct}% e desceu de volta (${dificuldade}, ${tempo} s).`,
    subEncerrado: (duracao, pct) => `A rodada parou em ${duracao} s, com o canhão a ${pct}%.`,
    progresso: (pct) => `${pct}% erguido`,
    pausa: 'O canhão espera. Esc ou o botão continua.',
    aria: (p) => (p >= 1 ? 'O canhão subiu e está travado no alto da muralha, apontado pela ameia.' : p <= 0.01 ? 'O alçapão está fechado nas lajes do baluarte.' : `O canhão está ${Math.round(p * 10) * 10}% erguido.`),
    semPorta: 'Nenhuma: só o canhão sobe',
    efeitoSemPorta: 'O canhão sobe e fica apontado pela ameia.',
    efeitoComPorta: 'A porta do mapa se abre, mesmo trancada, quando o canhão sobe.',
    ponhaPorta: 'Ponha uma porta no mapa para o canhão abrir.',
    emEquipe: 'Cada um aperta X (ou o botão Girar) no próprio computador. Em equipe, cada aperto vale menos, mas o canhão sobe mais rápido.',
    situacaoVenceu: 'Venceram: o canhão subiu',
    situacaoPerdeu: 'Perderam: o peso venceu',
    desfechoComPorta: 'Canhão do chão: o canhão subiu e a porta ligada abriu.',
    desfechoSemPorta: 'Canhão do chão: o canhão subiu.',
    desfechoPerdeu: 'Canhão do chão: o tempo acabou e o peso levou o canhão de volta ao poço.',
    desfechoEncerrado: 'Canhão do chão: rodada encerrada.',
  },
}
