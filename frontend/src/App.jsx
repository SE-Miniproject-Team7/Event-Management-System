
import { useEffect, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import EventsPage from './pages/EventsPage.jsx'
import EventDetailsPage from './pages/EventDetailsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import api from './services/api'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    api.get('/auth/me')
      .then((response) => {
        if (active) setUser(response.data?.user ?? null)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setCheckingAuth(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function handleLogout() {
    setLoggingOut(true)

    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      setUser(null)
      setLoggingOut(false)
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <Link className="brand" to="/">
          Event Management System
        </Link>

        <nav className="app-nav" aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link to="/events">Explore Events</Link>

          {!checkingAuth && !user && (
            <>
              <Link to="/login">Sign in</Link>
              <Link className="nav-register" to="/register">
                Register
              </Link>
            </>
          )}

          {!checkingAuth && user && (
            <>
              <span className="user-greeting">
                Hi, {user.name}
              </span>
              <button
                type="button"
                className="logout-button"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? 'Signing out...' : 'Logout'}
              </button>
            </>
          )}
        </nav>

        <span className="header-label">EMS</span>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={<LoginPage onLoginSuccess={setUser} />}
          />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route
            path="/events/:id"
            element={<EventDetailsPage />}
          />
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
