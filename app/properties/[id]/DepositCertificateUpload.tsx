'use client'

import { useActionState, useRef } from 'react'
import { uploadDepositCertificate } from './actions'

interface Props {
  propertyId: string
  tenancyId: string
  hasExisting: boolean
}

export default function DepositCertificateUpload({ propertyId, tenancyId, hasExisting }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const bound = uploadDepositCertificate.bind(null, propertyId, tenancyId)
  const [state, dispatch, pending] = useActionState(bound, {})

  return (
    <form ref={formRef} action={dispatch} className="flex items-center gap-3">
      <label className="flex-1 cursor-pointer">
        <input
          type="file"
          name="deposit_certificate"
          accept="application/pdf"
          className="sr-only"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) formRef.current?.requestSubmit() }}
        />
        <span className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
          {pending ? 'Uploading…' : hasExisting ? 'Replace certificate →' : 'Upload certificate →'}
        </span>
      </label>
      {state.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  )
}
