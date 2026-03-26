import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Accounts } from '@/pages/Accounts'
import { AccountDetail } from '@/pages/AccountDetail'
import { Projections } from '@/pages/Projections'
import { Fire } from '@/pages/Fire'
import { Tax } from '@/pages/Tax'
import { Advisor } from '@/pages/Advisor'
import { SettingsPage } from '@/pages/Settings'
import { ImportExport } from '@/pages/ImportExport'
import { Onboarding } from '@/pages/Onboarding'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/accounts/:id" element={<AccountDetail />} />
          <Route path="/projections" element={<Projections />} />
          <Route path="/fire" element={<Fire />} />
          <Route path="/tax" element={<Tax />} />
          <Route path="/advisor" element={<Advisor />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/import-export" element={<ImportExport />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
