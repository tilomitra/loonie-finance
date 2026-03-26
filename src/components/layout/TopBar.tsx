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
    <header className="h-12 bg-surface border-b border-border flex items-center px-6 shrink-0">
      {/* Left: Branding */}
      <div className="flex-1">
        <Link to="/" className="text-[12px] font-bold text-text uppercase tracking-widest hover:text-accent transition-colors">
          Loonie Finance
        </Link>
      </div>

      {/* Center: Net Worth */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Net Worth</span>
        <span className="text-[14px] font-semibold text-text tabular-nums">
          {formatCurrency(netWorth.toString())}
        </span>
      </div>

      {/* Right: Icon Buttons */}
      <div className="flex-1 flex items-center justify-end gap-1">
        <button
          onClick={onOpenAccounts}
          className="p-2 text-text-secondary hover:text-text transition-colors cursor-pointer"
          title="Accounts"
        >
          <Wallet className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <Link
          to="/settings"
          className="p-2 text-text-secondary hover:text-text transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" strokeWidth={1.5} />
        </Link>
        <Link
          to="/import-export"
          className="p-2 text-text-secondary hover:text-text transition-colors"
          title="Import / Export"
        >
          <ArrowLeftRight className="w-4 h-4" strokeWidth={1.5} />
        </Link>
      </div>
    </header>
  )
}
