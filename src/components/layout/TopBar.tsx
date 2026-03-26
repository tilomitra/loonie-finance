import { Link } from 'react-router-dom'
import { Wallet, Settings, ArrowLeftRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useNetWorth } from '@/db/hooks'

interface TopBarProps {
  onOpenAccounts: () => void
}

export function TopBar({ onOpenAccounts }: TopBarProps) {
  const { netWorth } = useNetWorth()

  return (
    <header className="h-14 bg-sidebar border-b border-border flex items-center px-6 shrink-0">
      {/* Left: Branding */}
      <div className="flex-1">
        <Link to="/" className="font-serif text-lg font-bold text-text tracking-tight hover:opacity-80 transition-opacity">Loonie Finance</Link>
      </div>

      {/* Center: Net Worth */}
      <div className="flex flex-col items-center">
        <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium leading-none mb-0.5">Net Worth</div>
        <div className="text-lg font-semibold text-text tracking-tight leading-none">
          {formatCurrency(netWorth.toString())}
        </div>
      </div>

      {/* Right: Icon Buttons */}
      <div className="flex-1 flex items-center justify-end gap-1">
        <button
          onClick={onOpenAccounts}
          className="p-2 rounded-lg text-text-secondary hover:bg-sidebar-hover hover:text-text transition-colors cursor-pointer"
          title="Accounts"
        >
          <Wallet className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </button>
        <Link
          to="/settings"
          className="p-2 rounded-lg text-text-secondary hover:bg-sidebar-hover hover:text-text transition-colors"
          title="Settings"
        >
          <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </Link>
        <Link
          to="/import-export"
          className="p-2 rounded-lg text-text-secondary hover:bg-sidebar-hover hover:text-text transition-colors"
          title="Import / Export"
        >
          <ArrowLeftRight className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </Link>
      </div>
    </header>
  )
}
