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
              {loan.loan_number || `Loan #${loan.id}`}
            </h3>
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

            {/* Origination Terms */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 uppercase">Origination Terms</h4>
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
                <p className="text-sm">
                  <span className="text-gray-600">Last Paid:</span>
                  <span className="ml-2 text-gray-900">{formatDate(loan.last_paid_date)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Next Due:</span>
                  <span className="ml-2 text-gray-900">{formatDate(loan.next_due_date)}</span>
                </p>
              </div>
            </div>

            {/* Balance Information */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 uppercase">Balance Information</h4>
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

          {/* Assignment Chain Section */}
          {(loan.original_lender || loan.assignment_chain) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 uppercase mb-3">Assignment Chain</h4>
              
              <div className="space-y-3">
                {/* Original Lender */}
                {loan.original_lender && (
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Original Lender</p>
                      <p className="text-sm text-gray-600">{loan.original_lender}</p>
                    </div>
                  </div>
                )}
                
                {/* Assignment Chain */}
                {loan.assignment_chain && Array.isArray(loan.assignment_chain) && loan.assignment_chain.length > 0 && (
                  <>
                    {loan.assignment_chain.map((assignment, idx) => (
                      <div key={idx} className="flex items-center space-x-3">
                        <div className="flex flex-col items-center">
                          <div className="w-0.5 h-4 bg-gray-300"></div>
                          <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                          {idx < loan.assignment_chain.length - 1 && <div className="w-0.5 h-4 bg-gray-300"></div>}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Assignment {idx + 1}: {assignment.assignor_normalized || assignment.assignor_name || assignment.assignor} → {assignment.assignee_normalized || assignment.assignee_name || assignment.assignee}
                          </p>
                          <div className="text-xs text-gray-500 space-x-4">
                            {(assignment.execution_date || assignment.assignmentDate) && (
                              <span>Executed: {formatDate(assignment.execution_date || assignment.assignmentDate)}</span>
                            )}
                            {(assignment.recording_date || assignment.recordingDate) && (
                              <span>Recorded: {formatDate(assignment.recording_date || assignment.recordingDate)}</span>
                            )}
                            {assignment.mers_info?.isMERS && (
                              <span className="text-green-600">MERS Nominee</span>
                            )}
                            {assignment.poa_info?.isPOA && assignment.poa_info.principal && (
                              <span className="text-blue-600">POA: {assignment.poa_info.principal}</span>
                            )}
                            {assignment.power_of_attorney_indicator && assignment.principal_name && !assignment.poa_info && (
                              <span className="text-blue-600">POA: {assignment.principal_name}</span>
                            )}
                            {assignment.confidence_score && assignment.confidence_score < 0.8 && (
                              <span className="text-orange-600">Low Confidence: {Math.round(assignment.confidence_score * 100)}%</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                
                {/* Chain Status */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Chain Status:</span>
                    {loan.chain_complete === true ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Complete
                      </span>
                    ) : loan.chain_complete === false ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ⚠ Incomplete
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        ? Unknown
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Chain Issues */}
                {loan.chain_issues && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs font-medium text-yellow-800 mb-1">Chain Issues:</p>
                    <p className="text-xs text-yellow-700">{loan.chain_issues}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Document Processing Info */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-700 uppercase mb-2">Documents Reviewed</h4>
                
                {loan.document_types ? (
                  <div className="flex flex-wrap gap-1">
                    {loan.document_types.split(',').map((type, idx) => (
                      <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {type.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Document types not identified</p>
                )}
                
                <div className="mt-2 text-xs text-gray-500">
                  Last Updated: {loan.updated_at ? formatDate(loan.updated_at) : (loan.created_at ? formatDate(loan.created_at) : formatDate(new Date()))}
                  {loan._chunks_processed && ` • ${loan._chunks_processed} sections analyzed`}
                </div>
              </div>
              
              <button
                onClick={() => handleDeleteLoan(loan.id)}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded ml-4"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}