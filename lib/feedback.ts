'use client'
import { toast } from 'sonner'

export function notifyUpdated(message?: string) {
  window.dispatchEvent(new Event('discipline:updated'))
  if (message) toast.success(message)
}
export function celebrate() {
  if (localStorage.getItem('discipline:effects') !== 'false' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.dispatchEvent(new Event('discipline:celebrate'))
  }
  if (localStorage.getItem('discipline:sounds') !== 'true') return
  try {
    const context = new AudioContext()
    void context.resume()
    const gain = context.createGain()
    gain.connect(context.destination)
    gain.gain.setValueAtTime(0.04, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4)
    ;[523.25, 659.25, 783.99].forEach((frequency, index) => {
      const tone = context.createOscillator()
      tone.type = 'sine'; tone.frequency.value = frequency; tone.connect(gain)
      tone.start(context.currentTime + index * 0.08); tone.stop(context.currentTime + 0.4)
    })
    setTimeout(() => { void context.close() }, 600)
  } catch { /* Audio is optional; never interrupt task completion. */ }
}
