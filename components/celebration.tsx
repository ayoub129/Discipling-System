'use client'
import { useEffect, useState } from 'react'
export function Celebration() {
  const [active, setActive] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const show = () => { setActive(true); clearTimeout(timer); timer = setTimeout(() => setActive(false), 1000) }
    window.addEventListener('discipline:celebrate', show)
    return () => { window.removeEventListener('discipline:celebrate', show); clearTimeout(timer) }
  }, [])
  return active ? <div className="celebration" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--angle': `${i * 20}deg`, '--hue': `${160 + i * 8}` } as React.CSSProperties} />)}</div> : null
}
