'use client'

export default function LoanDetailsTable({ loans, onLoanDeleted }) {
  const formatCurrency = (value) => {
    if (!value) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercentage = (value) => {
    if (!value) return '-'
    return `${(parseFloat(value) * 100).toFixed(3)}%`
  }

  const formatDate = (value) => {
    if (!value) return '-'
    return new Date(value).toLocaleDateString()
  }

  const handleDeleteLoan = async (loanId) => {
    if (!confirm('Are you sure you want to delete this loan?')) {
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/loans/${loanId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete loan')
      }

      // Call callback to refresh the loan list
      if (onLoanDeleted) {
        onLoanDeleted(loanId)
      }

    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete loan. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      {loans.map((loan, index) => (
        <div key={loan.id || index} className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Loan #{loan.id} {loan.loan_number && `- ${loan.loan_number}`}
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                Added {formatDate(loan.created_at)}
                {loan.updated_at !== loan.created_at && ` • Updated ${formatDate(loan.updated_at)}`}
              </span>
              <button
                onClick={() => handleDeleteLoan(loan.id)}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Borrower Information */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 uppercase">Borrower Info</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-gray-600">Primary:</span>
                  <span className="ml-2 text-gray-900 font-medium">{loan.borrower_name || '-'}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Co-Borrower:</span>
                  <span className="ml-2 text-gray-900">{loan.co_borrower_name || '-'}</span>
                </p>
              </div>
            </div>

            {/* Property Information */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 uppercase">Property Info</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-gray-600">Address:</span>
                  <span className="ml-2 text-gray-900">{loan.property_address || '-'}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">City/State/Zip:</span>
                  <span className="ml-2 text-gray-900">
                    {[loan.property_city, loan.property_state, loan.property_zip].filter(Boolean).join(', ') || '-'}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Property Type:</span>
                  <span className="ml-2 text-gray-900">{loan.property_type || '-'}</span>
                </p>
              </div>
            </div>

            {/* Loan Terms */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 uppercase">Loan Terms</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-gray-600">Original Amount:</span>
                  <span className="ml-2 text-gray-900 font-medium">{formatCurrency(loan.loan_amount)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Interest Rate:</span>
                  <span className="ml-2 text-gray-900 font-medium">{formatPercentage(loan.interest_rate)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Current UPB:</span>
                  <span className="ml-2 text-gray-900">{formatCurrency(loan.current_upb)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Monthly Payment:</span>
                  <span className="ml-2 text-gray-900">{formatCurrency(loan.monthly_payment)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Loan Type:</span>
                  <span className="ml-2 text-gray-900">{loan.loan_type || '-'}</span>
                </p>
              </div>
            </div>

            {/* Important Dates */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 uppercase">Important Dates</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-gray-600">Origination:</span>
                  <span className="ml-2 text-gray-900">{formatDate(loan.loan_date)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Maturity:</span>
                  <span className="ml-2 text-gray-900">{formatDate(loan.maturity_date)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Last Paid:</span>
                  <span className="ml-2 text-gray-900">{formatDate(loan.last_paid_date)}</span>
                </p>
              </div>
            </div>

            {/* Servicing Info */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 uppercase">Servicing Info</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-gray-600">Investor:</span>
                  <span className="ml-2 text-gray-900">{loan.investor_name || '-'}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Servicer:</span>
                  <span className="ml-2 text-gray-900">{loan.servicer_name || '-'}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Legal Status:</span>
                  <span className="ml-2 text-gray-900">{loan.legal_status || '-'}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Lien Position:</span>
                  <span className="ml-2 text-gray-900">{loan.lien_position || '-'}</span>
                </p>
              </div>
            </div>

            {/* Additional Data */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 uppercase">Additional Info</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-gray-600">Accrued Interest:</span>
                  <span className="ml-2 text-gray-900">{formatCurrency(loan.accrued_interest)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Total Balance:</span>
                  <span className="ml-2 text-gray-900">{formatCurrency(loan.total_balance)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Remaining Term:</span>
                  <span className="ml-2 text-gray-900">{loan.remaining_term ? `${loan.remaining_term} months` : '-'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Extraction Metadata */}
          {(loan._source || loan._extraction_method || loan._chunks_processed) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Source: {loan._source} • Method: {loan._extraction_method} • Chunks: {loan._chunks_processed}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}