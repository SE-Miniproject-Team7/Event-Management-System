import { Link, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import CreateEventPage from './pages/CreateEventPage.jsx'
import PendingEventsPage from './pages/PendingEventsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link className="brand" to="/">Event Management System</Link>
        <nav className="app-nav" aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link to="/organizer/events/new">Create Event</Link>
          <Link to="/admin/events/pending">Admin Approvals</Link>
        </nav>
        <span className="header-label">EMS</span>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/organizer/events/new" element={<CreateEventPage />} />
          <Route path="/admin/events/pending" element={<PendingEventsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="app-footer">Event Management System · Team 7</footer>
    </div>
  )
}

export default App
