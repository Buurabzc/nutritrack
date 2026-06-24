import { useEffect } from 'react'

// iOS standalone PWA'da klavye açılınca `100dvh` değişmez —
// içerik klavyenin altında kalır. Bu hook, visual viewport yüksekliğini
// `--vvh` CSS değişkeni olarak :root'a yazar; tüm containerlar `--vvh`
// kullanarak her zaman gerçekten görünür alana sığar.
// Klavye kapanınca oluşan visual viewport pan (offsetTop) sıfırlanır.
export function useViewport() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    // Sadece 'resize' dinle — klavye açılıp kapanınca vv.height değişir.
    // 'scroll' olayı (vv.offsetTop değişimi) layout'u gereksiz yere tetikler
    // ve nav bar'ı titretir.
    const update = () => {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
    }

    update()
    vv.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
    }
  }, [])
}
