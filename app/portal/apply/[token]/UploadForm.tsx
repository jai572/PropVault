'use client'

import { useActionState, useRef } from 'react'
import { uploadRightToRentDocument, type UploadState } from './actions'

interface UploadFormProps {
  token: string
}

const initialState: UploadState = {}

export default function UploadForm({ token }: UploadFormProps) {
  const uploadAction = uploadRightToRentDocument.bind(null, token)
  const [state, action, pending] = useActionState(uploadAction, initialState)
  const fileRef = useRef<HTMLInputElement>(null)

  if (state.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-2">
        <p className="text-lg font-semibold text-green-800">Document received</p>
        <p className="text-sm text-green-700">
          Your Right to Rent document has been submitted. Your landlord will review it and be in touch.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="document" className="block text-sm font-medium text-gray-700 mb-1.5">
          Right to Rent document
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Accepted: passport, biometric residence permit, or share code confirmation.
          JPEG, PNG, or PDF. Max 10MB.
        </p>
        <input
          ref={fileRef}
          id="document"
          name="document"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          required
          className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-700 file:cursor-pointer"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
      >
        {pending ? 'Uploading…' : 'Submit document'}
      </button>
    </form>
  )
}
