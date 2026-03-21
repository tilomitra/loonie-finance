import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Flame,
  Calculator,
  Settings,
  ArrowLeftRight,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useNetWorth } from '@/db/hooks'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/projections', icon: TrendingUp, label: 'Projections' },
  { to: '/fire', icon: Flame, label: 'FIRE' },
  { to: '/tax', icon: Calculator, label: 'Tax' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/import-export', icon: ArrowLeftRight, label: 'Import / Export' },
]

export function Sidebar() {
  const { netWorth } = useNetWorth()

  return (
    <aside className="w-60 bg-sidebar border-r border-border min-h-screen flex flex-col shrink-0">
      <div className="px-5 pt-6 pb-5">
        <h1 className="font-serif text-xl tracking-tight text-text">Loonie Finance</h1>
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Net Worth</div>
          <div className="text-xl font-semibold text-text mt-0.5 tracking-tight">
            {formatCurrency(netWorth.toString())}
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 mt-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors mb-0.5 ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-secondary hover:bg-sidebar-hover hover:text-text'
              }`
            }
          >
            <Icon className="w-[15px] h-[15px]" strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-[11px] text-text-secondary/60">
        All data stored locally
      </div>
    </aside>
  )
}
