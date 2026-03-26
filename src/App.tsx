import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Fire } from '@/pages/Fire'
import { SettingsPage } from '@/pages/Settings'
import { ImportExport } from '@/pages/ImportExport'
import { Onboarding } from '@/pages/Onboarding'
import { useUserProfile } from '@/db/hooks'

function HomeRedirect() {
  const profile = useUserProfile()
  if (profile === undefined) return null // loading
  if (!profile?.dateOfBirth) return <Navigate to="/onboarding" replace />
  return <Fire />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/import-export" element={<ImportExport />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
