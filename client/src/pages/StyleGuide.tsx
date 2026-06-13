import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Modal, Toast } from '../components/ui/index.js'

/**
 * Living design-system reference at /design. Built entirely from the `ui/`
 * primitives + tokens, so it doubles as a visual smoke test for the system.
 */
export function StyleGuide() {
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<null | 'error' | 'info' | 'success'>(null)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="-rotate-1">
          <h1 className="inline-block rounded-xl border-2 border-ink bg-accent px-5 py-2 font-display text-4xl uppercase tracking-tight shadow-brutal-lg">
            Design System
          </h1>
        </div>
        <Link to="/">
          <Button variant="ghost" size="sm">
            ← Back home
          </Button>
        </Link>
      </div>
      <p className="mt-4 max-w-2xl font-semibold text-ink-muted">
        Tuan Tanah — light “paper” neobrutalism. Flat bright fills, thick ink borders, hard offset
        shadows, and a tactile press. Everything below renders from the shared tokens + primitives.
      </p>

      <Section title="Colors">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Swatch name="paper" hex="#FBF3E2" className="bg-paper" />
          <Swatch name="surface" hex="#FFFFFF" className="bg-surface" />
          <Swatch name="surface-sunken" hex="#F4EAD2" className="bg-surface-sunken" />
          <Swatch name="ink" hex="#1A1714" className="bg-ink" dark />
          <Swatch name="accent" hex="#FBBF24" className="bg-accent" />
          <Swatch name="accent-strong" hex="#F59E0B" className="bg-accent-strong" />
          <Swatch name="info" hex="#4DABF7" className="bg-info" />
          <Swatch name="danger" hex="#FF6B6B" className="bg-danger" />
          <Swatch name="success" hex="#51CF66" className="bg-success" />
          <Swatch name="accent-soft" hex="#FDE9B8" className="bg-accent-soft" />
          <Swatch name="info-soft" hex="#D5E9FB" className="bg-info-soft" />
          <Swatch name="danger-soft" hex="#FFE0E0" className="bg-danger-soft" />
        </div>
      </Section>

      <Section title="Typography">
        <Card className="space-y-3 p-5">
          <p className="font-display text-4xl uppercase tracking-tight">Archivo Black — display</p>
          <p className="text-2xl font-extrabold">Inter ExtraBold — heading</p>
          <p className="text-base font-medium">
            Inter Medium — body copy. Rupiah formats as Rp 1.500.000.
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Inter Bold — label / overline
          </p>
          <p className="text-sm text-ink-faint">Inter — ink-faint muted hint text</p>
        </Card>
      </Section>

      <Section title="Elevation">
        <div className="flex flex-wrap gap-6 rounded-xl bg-surface-sunken p-8">
          {[
            ['shadow-brutal-xs', 'brutal-xs'],
            ['shadow-brutal-sm', 'brutal-sm'],
            ['shadow-brutal', 'brutal'],
            ['shadow-brutal-lg', 'brutal-lg'],
            ['shadow-brutal-xl', 'brutal-xl'],
          ].map(([cls, label]) => (
            <div
              key={label}
              className={`flex h-20 w-28 items-center justify-center rounded-lg border-2 border-ink bg-surface text-xs font-bold ${cls}`}
            >
              {label}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="space-y-5">
          <Row label="Variants">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="info">Info</Button>
            <Button variant="success">Success</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
          </Row>
          <Row label="Sizes">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Row>
          <Row label="States">
            <Button disabled>Disabled</Button>
            <Button>🎲 With icon</Button>
            <div className="w-48">
              <Button block>Block</Button>
            </div>
          </Row>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {(['surface', 'sunken', 'accent', 'info', 'danger', 'success'] as const).map((tone) => (
            <Card key={tone} tone={tone} className="p-4">
              <div className="font-bold capitalize">{tone}</div>
              <div className="text-sm text-ink-muted">tone=&quot;{tone}&quot;</div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="accent">Tier 3</Badge>
          <Badge tone="info">Transport</Badge>
          <Badge tone="success">Owned</Badge>
          <Badge tone="danger">Eliminated</Badge>
          <Badge color="#7c3aed">Player color</Badge>
          <Badge color="#0ea5e9">Budi</Badge>
        </div>
      </Section>

      <Section title="Overlays">
        <Row label="Modal">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
        </Row>
        <Row label="Toasts">
          <Button variant="danger" onClick={() => setToast('error')}>
            Error
          </Button>
          <Button variant="info" onClick={() => setToast('info')}>
            Info
          </Button>
          <Button variant="success" onClick={() => setToast('success')}>
            Success
          </Button>
        </Row>
      </Section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Property" size="md">
        <p className="font-medium">
          This is the shared <code className="font-bold">Modal</code> primitive: framed panel,
          backdrop dismiss, Escape to close, scroll-lock, and snappy enter/exit motion.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setModalOpen(false)}>Got it</Button>
        </div>
      </Modal>

      <Toast show={toast !== null} tone={toast ?? 'info'} onDismiss={() => setToast(null)}>
        {toast === 'error' && 'Tidak cukup uang!'}
        {toast === 'info' && 'Giliranmu sebentar lagi…'}
        {toast === 'success' && 'Properti berhasil dibeli.'}
      </Toast>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 inline-block border-b-4 border-ink pb-1 font-display text-xl uppercase tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </div>
  )
}

function Swatch({
  name,
  hex,
  className,
  dark,
}: {
  name: string
  hex: string
  className: string
  dark?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-ink shadow-brutal-sm">
      <div className={`h-16 ${className} ${dark ? 'text-paper' : 'text-ink'}`} />
      <div className="border-t-2 border-ink bg-surface px-2 py-1.5">
        <div className="text-xs font-bold">{name}</div>
        <div className="font-mono text-[10px] uppercase text-ink-muted">{hex}</div>
      </div>
    </div>
  )
}
