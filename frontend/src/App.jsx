
import { Link, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link className="brand" to="/">
          Event Management System
        </Link>

        <nav className="app-nav" aria-label="Main navigation">
          <Link to="/login">Sign in</Link>
          <Link className="nav-register" to="/register">
            Register
          </Link>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="app-footer">
        Event Management System - Team 7
      </footer>
    </div>
  )
}

export default App
