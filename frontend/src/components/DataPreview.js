'use client'

import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline'

export default function DataPreview({ data }) {
  const { successful, failed, totalFiles } = data

  const formatCurrency = (value) => {
    if (!value) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatDate = (value) => {
    if (!value) return '-'
    return new Date(value).toLocaleDateString()
  }

  const formatPercentage = (value) => {
    if (!value) return '-'
    return `${(parseFloat(value) * 100).toFixed(2)}%`
  }


  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload Results</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-green-600">
            <CheckCircleIcon className="h-5 w-5 mr-1" />
            <span>{successful.length} successful</span>
          </div>
          {failed.length > 0 && (
            <div className="flex items-center text-red-600">
              <XCircleIcon className="h-5 w-5 mr-1" />
              <span>{failed.length} failed</span>
            </div>
          )}
        </div>
      </div>

      {failed.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg">
          <h3 className="text-lg font-medium text-red-800 mb-2">Failed Uploads</h3>
          <div className="space-y-2">
            {failed.map((failure, index) => (
              <div key={index} className="flex items-center">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-sm text-red-700">
                  {failure.fileName}: {failure.error}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {successful.length > 0 && (
        <div className="space-y-6">
          {successful.map((result, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">{result.fileName}</h3>
                <div className="flex items-center text-green-600">
                  <CheckCircleIcon className="h-5 w-5 mr-1" />
                  <span className="text-sm">Processed and saved successfully</span>
                </div>
              </div>

              {(result.loansCreated !== undefined || result.loansUpdated !== undefined) && (
                <div className="mb-4">
                  {result.loansCreated > 0 && (
                    <p className="text-sm text-gray-600">
                      ✅ <strong>{result.loansCreated}</strong> new loans created
                    </p>
                  )}
                  {result.loansUpdated > 0 && (
                    <p className="text-sm text-blue-600">
                      🔄 <strong>{result.loansUpdated}</strong> existing loans updated with better data
                    </p>
                  )}
                  {result.saveErrors > 0 && (
                    <p className="text-sm text-red-600">
                      ❌ <strong>{result.saveErrors}</strong> loans failed to save
                    </p>
                  )}
                  {result.duplicateActions && result.duplicateActions.length > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 rounded">
                      <p className="text-xs text-blue-700 font-medium">Duplicate Prevention Active:</p>
                      {result.duplicateActions.map((action, idx) => (
                        <p key={idx} className="text-xs text-blue-600">
                          • Updated loan #{action.loanId} ({action.matchType.replace('_', ' ')})
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {result.data && result.data.length > 0 && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Saved Loans</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Borrower
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Property Address
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Loan Amount
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Interest Rate
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Loan ID
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {result.data.slice(0, 5).map((loan, loanIndex) => (
                          <tr key={loanIndex}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {loan.borrower_name || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {loan.property_address || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatCurrency(loan.loan_amount)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatPercentage(loan.interest_rate)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              #{loan.id}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.data.length > 5 && (
                    <p className="text-sm text-gray-500 mt-2">
                      Showing first 5 of {result.data.length} loans saved
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}