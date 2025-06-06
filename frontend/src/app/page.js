'use client'

import { useState, useEffect } from 'react'
import LoanDetailsTable from '@/components/LoanDetailsTable'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalLoans: 0,
    totalBalance: 0,
    totalDocuments: 0
  })
  const [recentLoans, setRecentLoans] = useState([])
  const [allLoans, setAllLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDetailedView, setShowDetailedView] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load loans data
      const loansResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/loans`)
      const loansData = await loansResponse.json()
      
      // Load extraction logs for documents count
      const logsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/extraction-logs`)
      const logsData = await logsResponse.json()
      
      // Calculate statistics
      const totalLoans = loansData.loans?.length || 0
      const totalBalance = loansData.loans?.reduce((sum, loan) => sum + (parseFloat(loan.current_upb) || parseFloat(loan.loan_amount) || 0), 0) || 0
      const totalDocuments = logsData.logs?.length || 0
      
      setStats({
        totalLoans,
        totalBalance,
        totalDocuments
      })
      
      // Set recent loans (first 5) and all loans
      setRecentLoans(loansData.loans?.slice(0, 5) || [])
      setAllLoans(loansData.loans || [])
      
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome to NPL Vision - your comprehensive loan data management platform
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Loans</h3>
            <p className="text-3xl font-bold text-blue-600">
              {loading ? '...' : stats.totalLoans.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">Loans in portfolio</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Balance</h3>
            <p className="text-3xl font-bold text-blue-600">
              {loading ? '...' : formatCurrency(stats.totalBalance)}
            </p>
            <p className="text-sm text-gray-500 mt-1">Outstanding balance</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Documents</h3>
            <p className="text-3xl font-bold text-blue-600">
              {loading ? '...' : stats.totalDocuments.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">Processed documents</p>
          </div>
        </div>
        
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {showDetailedView ? 'Loan Details' : 'Recent Loans'}
            </h3>
            {allLoans.length > 0 && (
              <button
                onClick={() => setShowDetailedView(!showDetailedView)}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
              >
                {showDetailedView ? 'Show Summary' : 'Show Details'}
              </button>
            )}
          </div>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : showDetailedView ? (
            <LoanDetailsTable loans={allLoans} />
          ) : recentLoans.length > 0 ? (
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
                      Added
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentLoans.map((loan, index) => (
                    <tr key={loan.id || index}>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {loan.borrower_name || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {loan.property_address || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {loan.loan_amount ? formatCurrency(loan.loan_amount) : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {loan.interest_rate ? `${(parseFloat(loan.interest_rate) * 100).toFixed(2)}%` : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {loan.created_at ? new Date(loan.created_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No loans in database yet. Upload some files to get started!</p>
          )}
        </div>
      </div>
    </div>
  )
}