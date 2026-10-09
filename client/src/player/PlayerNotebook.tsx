/** "20:30": hora e minuto no relógio de quem lê, com zero à esquerda. */
export function formatNoteTime(at: number): string {
  const when = new Date(at)
  return `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`
}
