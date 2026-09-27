/** A small, steady tilt from a sticker's id (−6° to +6°), so every sticker
 *  always sits the same way until someone moves it. */
export function tiltFor(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 13) - 6;
}
