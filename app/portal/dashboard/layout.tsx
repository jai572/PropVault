export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">PropVault</span>
          <span className="text-xs text-gray-400">Tenant portal</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}
