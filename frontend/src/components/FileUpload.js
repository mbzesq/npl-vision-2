'use client'

import { useState, useRef } from 'react'
import { CloudArrowUpIcon, DocumentIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export default function FileUpload({ onUploadStart, onUploadSuccess, onUploadError, isLoading }) {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFileInput = (e) => {
    console.log('🎯 File input triggered!')
    console.log('📁 Raw files from input:', e.target.files)
    const files = Array.from(e.target.files)
    console.log('📁 Files array:', files)
    handleFiles(files)
  }

  const handleFiles = (files) => {
    console.log('📁 Files selected:', files.length)
    const validFiles = files.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop()
      const isValid = ['xlsx', 'xls', 'pdf'].includes(extension)
      console.log(`📄 File: ${file.name}, Extension: ${extension}, Valid: ${isValid}`)
      return isValid
    })

    console.log('✅ Valid files:', validFiles.length)
    setSelectedFiles(prev => [...prev, ...validFiles])
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFile = async (file) => {
    console.log(`🚀 Starting upload for: ${file.name}`)
    const formData = new FormData()
    formData.append('file', file)

    const extension = file.name.toLowerCase().split('.').pop()
    const endpoint = ['xlsx', 'xls'].includes(extension) ? '/api/upload' : '/api/upload/pdf'
    
    console.log(`📡 Uploading to: ${API_BASE_URL}${endpoint}`)

    try {
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      console.log(`✅ Upload successful for: ${file.name}`)
      return { success: true, data: response.data, fileName: file.name }
    } catch (error) {
      console.error(`❌ Upload failed for: ${file.name}`, error)
      return { 
        success: false, 
        error: error.response?.data?.detail || error.response?.data?.error || error.message, 
        fileName: file.name 
      }
    }
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    onUploadStart()

    const results = []
    for (const file of selectedFiles) {
      const result = await uploadFile(file)
      results.push(result)
    }

    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    if (successful.length > 0) {
      onUploadSuccess({
        successful,
        failed,
        totalFiles: selectedFiles.length
      })
    }

    if (failed.length > 0) {
      onUploadError(failed)
    }

    setSelectedFiles([])
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Files</h2>
      
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.pdf"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-lg font-medium text-gray-900">
          Drop files here or click to browse
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Supports Excel files (.xlsx, .xls) and PDF documents
        </p>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Selected Files</h3>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <DocumentIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-900">{file.name}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isLoading}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {isLoading ? 'Processing...' : `Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}