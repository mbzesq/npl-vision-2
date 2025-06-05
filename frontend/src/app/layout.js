import './globals.css'
import Sidebar from '../components/Sidebar'

export const metadata = {
  title: 'NPL Vision',
  description: 'Non-Performing Loan Data Management Platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen bg-gray-100">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}