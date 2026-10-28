// METAS DA FATIA F9: revelar névoa e a ficha do jogador andando sem engasgo
// (mestre e jogador no mesmo PC, mapa real, 1440 com escala 150%).
//
//   LAB_DES_METAS=f9 LAB_DES_F3_FICHA=jogador node scripts/medir-desempenho.cjs --so real-linhas-1440-dpr15 --mapa-real <mapa>
//
// `LAB_DES_F3_FICHA=jogador`: no cenário da mesa o mestre arrasta a ficha do
// JOGADOR (a visão e o explorado dele mudam a cada passo). No mapa real o
// mestre recusa o passo de 10 casas que o próprio jogador pede, então é por
// aqui que a ficha do jogador anda no harness.
//
// Casos: o modo linhas (o que o "Chão leve" da 0.5.2 desenha) e o Meio-Termo.
// No Meio-Termo em 1440 o mestre fica preso na placa de vídeo (fatias F1/F2):
// lá a meta de fps não é desta fatia, e só o tamanho do patch é conferido.

export const CASOS_F9 = ['real-linhas-1440-dpr15', 'real-mt-1440-dpr15'] as const
export const CENARIOS_F9 = {
  fichaDoJogador: 'mesa-jogador-ve-mestre-mover-ficha',
  revelarNevoa: 'mesa-mestre-revela-nevoa-6-zonas',
} as const

export const METAS_F9 = {
  fpsMin: 55,
  /** Nenhuma tarefa longa >= 100 ms. */
  longaTetoMs: 100,
  /** Maior patch de um passo, em bytes do fio. */
  patchMaxBytes: 5 * 1024,
} as const

export function metasF9Ligadas(): boolean {
  return (process.env.LAB_DES_METAS ?? '').split(',').includes('f9')
}

interface MedidaF9 {
  cenario: string
  papel: 'mestre' | 'jogador'
  fps: number
  longas_max_ms: number
  mensagens: Record<string, { n: number; bytes: number; max?: number }>
  extra?: Record<string, unknown>
}

/** O que reprova no registro do caso. Lista vazia = passou. */
export function conferirMetasF9(registro: { caso: { id: string }; cenarios?: MedidaF9[] }): string[] {
  if (!(CASOS_F9 as readonly string[]).includes(registro.caso.id)) return []
  const falhas: string[] = []
  if (process.env.LAB_DES_F3_FICHA !== 'jogador') falhas.push('rode com LAB_DES_F3_FICHA=jogador (a ficha que anda é a do jogador)')
  const soPatch = registro.caso.id.includes('-mt-')
  for (const [nome, cenario] of Object.entries(CENARIOS_F9)) {
    const medidas = (registro.cenarios ?? []).filter((c) => c.cenario === cenario)
    if (medidas.length === 0) {
      falhas.push(`${nome}: o cenário ${cenario} não rodou`)
      continue
    }
    const patch = medidas[0].mensagens.patch ?? { n: 0, bytes: 0, max: 0 }
    // Sem patch não houve o custo que a meta mede: a comparação não vale.
    if (patch.n === 0) falhas.push(`${nome}: nenhum patch saiu para o jogador`)
    if (nome === 'fichaDoJogador' && Number(medidas[0].extra?.ficha_andou_px ?? 0) === 0) falhas.push(`${nome}: a ficha não andou`)
    const maior = patch.max ?? patch.bytes
    if (maior > METAS_F9.patchMaxBytes) falhas.push(`${nome}: maior patch ${maior} B > ${METAS_F9.patchMaxBytes}`)
    if (soPatch) continue
    for (const m of medidas) {
      if (m.fps < METAS_F9.fpsMin) falhas.push(`${nome}: ${m.papel} ${m.fps} fps < ${METAS_F9.fpsMin}`)
      if (m.longas_max_ms >= METAS_F9.longaTetoMs) falhas.push(`${nome}: ${m.papel} tarefa longa ${m.longas_max_ms} ms >= ${METAS_F9.longaTetoMs}`)
    }
  }
  return falhas
}
