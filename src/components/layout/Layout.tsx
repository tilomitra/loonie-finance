import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="flex min-h-screen bg-surface-alt">
      <Sidebar />
      <main className="flex-1 px-10 py-8 overflow-auto">
        <div className="max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
