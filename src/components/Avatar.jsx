import { useContext } from 'react'
import { ThumbsContext } from '../thumbs'
import { avatarColors, initials } from '../utils'

export default function Avatar({ name, photo, memberId, size = 36 }) {
  const thumbs = useContext(ThumbsContext)
  const src = photo || (memberId && thumbs[memberId])
  const [bg, fg] = avatarColors(name)
  const style = { width: size, height: size, fontSize: size * 0.38 }
  if (src) return <img className="avatar" src={src} alt="" style={style} />
  return (
    <span className="avatar" style={{ ...style, background: bg, color: fg }} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
