import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useUserProfile } from '@/db/hooks'
import { db } from '@/db/database'
import type { Province } from '@/types'

const provinceOptions = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
]

export function SettingsPage() {
  const profile = useUserProfile()
  const [form, setForm] = useState({
    dateOfBirth: '',
    province: 'ON' as Province,
    openaiApiKey: '',
  })
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        dateOfBirth: profile.dateOfBirth,
        province: profile.province,
        openaiApiKey: profile.openaiApiKey ?? '',
      })
    }
  }, [profile])

  const handleSave = async () => {
    const now = Date.now()
    await db.userProfile.put({
      id: 'singleton',
      ...(profile ?? {}),
      ...form,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    } as Parameters<typeof db.userProfile.put>[0])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-[14px] font-bold uppercase tracking-widest mb-8">Settings</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Personal Profile</CardTitle>
          <CardDescription>Used for tax calculations and age-based projections.</CardDescription>
        </CardHeader>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Date of Birth"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
          />
          <Select
            label="Province"
            value={form.province}
            onChange={(e) => setForm(f => ({ ...f, province: e.target.value as Province }))}
            options={provinceOptions}
          />
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI Integration</CardTitle>
          <CardDescription>Connect to OpenAI for personalized financial advice.</CardDescription>
        </CardHeader>

        <div className="space-y-4">
          <div className="relative">
            <Input
              label="OpenAI API Key"
              type={showKey ? 'text' : 'password'}
              value={form.openaiApiKey}
              onChange={(e) => setForm(f => ({ ...f, openaiApiKey: e.target.value }))}
              placeholder="sk-..."
            />
            <button
              type="button"
              onClick={() => setShowKey(k => !k)}
              className="absolute right-3 top-7 text-[11px] text-text-secondary hover:text-text uppercase tracking-wide"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-[11px] text-text-secondary">
            Your API key is stored locally and sent directly to OpenAI. Get one at{' '}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              platform.openai.com
            </a>
          </p>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save Settings</Button>
        {saved && <span className="text-[11px] text-accent font-medium uppercase tracking-wide">Saved</span>}
      </div>
    </div>
  )
}
