'use client'

import { useState } from 'react'
import FileUpload from '../../components/FileUpload'
import DataPreview from '../../components/DataPreview'

export default function UploadPage() {
  const [uploadResults, setUploadResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleUploadSuccess = (results) => {
    setUploadResults(results)
    setIsLoading(false)
  }

  const handleUploadStart = () => {
    setIsLoading(true)
    setUploadResults(null)
  }

  const handleUploadError = (error) => {
    setIsLoading(false)
    console.error('Upload error:', error)
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Upload Loan Data</h1>
          <p className="mt-2 text-gray-600">
            Upload Excel files or PDF documents to extract and manage loan data
          </p>
        </div>

        <div className="space-y-8">
          <FileUpload
            onUploadStart={handleUploadStart}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
            isLoading={isLoading}
          />

          {uploadResults && (
            <DataPreview data={uploadResults} />
          )}
        </div>
      </div>
    </div>
  )
}