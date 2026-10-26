
import { Link, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link className="brand" to="/">
          Event Management System
        </Link>

        <span className="header-label">EMS</span>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="app-footer">
        Event Management System · Team 7
      </footer>
    </div>
  )
}

export default App
