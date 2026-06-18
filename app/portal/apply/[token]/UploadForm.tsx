'use client'

import { useActionState, useRef, useState } from 'react'
import { uploadRightToRentDocuments, type UploadState } from './actions'

interface UploadFormProps {
  token: string
  initialCount: number
}

const initialState: UploadState = {}

export default function UploadForm({ token, initialCount }: UploadFormProps) {
  const uploadAction = uploadRightToRentDocuments.bind(null, token)
  const [state, action, pending] = useActionState(uploadAction, initialState)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [totalUploaded, setTotalUploaded] = useState(initialCount)
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Track cumulative upload count across multiple submissions
  const previousUploaded = useRef(0)
  if (state.uploaded && state.uploaded.length > previousUploaded.current) {
    previousUploaded.current = state.uploaded.length
    setTotalUploaded((n) => n + state.uploaded!.length)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(e.target.files ?? []))
  }

  function handleUploadMore() {
    formRef.current?.reset()
    setSelectedFiles([])
    previousUploaded.current = 0
  }

  const justUploaded = state.uploaded ?? []
  const fileErrors = state.fileErrors ?? {}
  const hasFileErrors = Object.keys(fileErrors).length > 0

  return (
    <div className="space-y-5">
      {/* Running tally */}
      {totalUploaded > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">
            {totalUploaded} document{totalUploaded !== 1 ? 's' : ''} submitted
          </p>
        </div>
      )}

      {/* Token-level error (expired, invalid) */}
      {state.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Per-file errors */}
      {hasFileErrors && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-red-700">Some files could not be uploaded:</p>
          <ul className="text-sm text-red-600 list-disc list-inside space-y-0.5">
            {Object.entries(fileErrors).map(([name, msg]) => (
              <li key={name}>
                <span className="font-mono">{name}</span> — {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Successfully uploaded in this batch */}
      {justUploaded.length > 0 && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-green-800">
            {justUploaded.length} file{justUploaded.length !== 1 ? 's' : ''} uploaded successfully:
          </p>
          <ul className="text-sm text-green-700 list-disc list-inside space-y-0.5">
            {justUploaded.map((name) => (
              <li key={name} className="font-mono">{name}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload form — stays visible for repeated submissions */}
      {!state.error && (
        <form ref={formRef} action={action} className="space-y-5">
          <div>
            <label htmlFor="documents" className="block text-sm font-medium text-gray-700 mb-1.5">
              {totalUploaded > 0 ? 'Add more documents' : 'Right to Rent documents'}
            </label>
            <p className="text-xs text-gray-500 mb-3">
              You can select multiple files at once. Accepted: JPEG, PNG, or PDF. Max 10MB per file.
            </p>
            <input
              ref={fileRef}
              id="documents"
              name="documents"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              multiple
              required
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-700 file:cursor-pointer"
            />
            {selectedFiles.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending || selectedFiles.length === 0}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
            >
              {pending
                ? 'Uploading…'
                : `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}` : 'documents'}`}
            </button>
            {totalUploaded > 0 && (
              <button
                type="button"
                onClick={handleUploadMore}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      )}

      {totalUploaded > 0 && (
        <p className="text-xs text-gray-400 text-center">
          All done? You can close this page. Your landlord has been notified.
        </p>
      )}
    </div>
  )
}
