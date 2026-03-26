import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { AccountsDrawer } from './AccountsDrawer'

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen">
      <TopBar onOpenAccounts={() => setDrawerOpen(true)} />
      <main className="flex-1 overflow-auto px-6 py-6 lg:px-10 lg:py-8 bg-background">
        <Outlet />
      </main>
      <AccountsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
