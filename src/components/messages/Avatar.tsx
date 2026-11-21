import { parseProfilePhotoUrl } from '../../lib/profileMapper'

export function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl?: string | null; size?: number }) {
  const url = parseProfilePhotoUrl(photoUrl)
  const style = { width: size, height: size }
  if (url) return <img src={url} alt="" referrerPolicy="no-referrer" style={style} className="shrink-0 rounded-full bg-roomie-mint object-cover" />
  return <span aria-hidden="true" style={style} className="grid shrink-0 place-items-center rounded-full bg-roomie-mint font-bold text-roomie-teal">{name.trim().charAt(0).toUpperCase() || '?'}</span>
}
