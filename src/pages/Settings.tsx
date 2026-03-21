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
    annualIncome: '',
    yearsContributedCPP: 0,
    tfsaCumulativeContributions: '',
    rrspCumulativeContributions: '',
    fhsaCumulativeContributions: '',
    fhsaFirstHomeOwner: true,
    openaiApiKey: '',
  })
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        dateOfBirth: profile.dateOfBirth,
        province: profile.province,
        annualIncome: profile.annualIncome,
        yearsContributedCPP: profile.yearsContributedCPP,
        tfsaCumulativeContributions: profile.tfsaCumulativeContributions,
        rrspCumulativeContributions: profile.rrspCumulativeContributions,
        fhsaCumulativeContributions: profile.fhsaCumulativeContributions,
        fhsaFirstHomeOwner: profile.fhsaFirstHomeOwner,
        openaiApiKey: profile.openaiApiKey ?? '',
      })
    }
  }, [profile])

  const handleSave = async () => {
    const now = Date.now()
    await db.userProfile.put({
      id: 'singleton',
      ...form,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl mb-8">Settings</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Personal Profile</CardTitle>
          <CardDescription>Used for tax calculations, CPP/OAS projections, and FIRE planning.</CardDescription>
        </CardHeader>

        <div className="space-y-4">
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
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Annual Income"
              type="number"
              value={form.annualIncome}
              onChange={(e) => setForm(f => ({ ...f, annualIncome: e.target.value }))}
              placeholder="e.g., 85000"
            />
            <Input
              label="Years Contributed to CPP"
              type="number"
              value={form.yearsContributedCPP.toString()}
              onChange={(e) => setForm(f => ({ ...f, yearsContributedCPP: parseInt(e.target.value) || 0 }))}
            />
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Registered Accounts</CardTitle>
          <CardDescription>Cumulative lifetime contributions to date.</CardDescription>
        </CardHeader>

        <div className="space-y-4">
          <Input
            label="TFSA Cumulative Contributions"
            type="number"
            value={form.tfsaCumulativeContributions}
            onChange={(e) => setForm(f => ({ ...f, tfsaCumulativeContributions: e.target.value }))}
            placeholder="e.g., 75000"
          />
          <Input
            label="RRSP Cumulative Contributions"
            type="number"
            value={form.rrspCumulativeContributions}
            onChange={(e) => setForm(f => ({ ...f, rrspCumulativeContributions: e.target.value }))}
            placeholder="e.g., 50000"
          />
          <Input
            label="FHSA Cumulative Contributions"
            type="number"
            value={form.fhsaCumulativeContributions}
            onChange={(e) => setForm(f => ({ ...f, fhsaCumulativeContributions: e.target.value }))}
            placeholder="e.g., 8000"
          />
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={form.fhsaFirstHomeOwner}
              onChange={(e) => setForm(f => ({ ...f, fhsaFirstHomeOwner: e.target.checked }))}
              className="rounded accent-primary"
            />
            I am a first-time home buyer (eligible for FHSA)
          </label>
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
              className="absolute right-3 top-7 text-[12px] text-text-secondary hover:text-text"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-[12px] text-text-secondary">
            Your API key is stored locally and sent directly to OpenAI. Get one at{' '}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              platform.openai.com
            </a>
          </p>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save Settings</Button>
        {saved && <span className="text-[13px] text-primary font-medium">Settings saved!</span>}
      </div>
    </div>
  )
}
