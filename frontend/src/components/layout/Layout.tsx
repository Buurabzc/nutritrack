import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useIsMobile } from '@/hooks/useIsMobile'

export function Layout() {
  const isMobile = useIsMobile()

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    }}>
      {!isMobile && <Sidebar />}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        <Outlet />
      </main>
      {isMobile && <Sidebar />}
    </div>
  )
}
