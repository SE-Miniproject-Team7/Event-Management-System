import { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';
export default function App() {
  const [events, setEvents] = useState([]);
  const [managedEvents, setManagedEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState(localStorage.getItem('ems-token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('ems-user') || 'null'));
  const [mode, setMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [eventForm, setEventForm] = useState({
    name: '', type: 'Workshop', description: '', eligibility: 'All eligible attendees',
    inCharge: '', date: '', venue: '', capacity: 30, registrationDeadline: ''
  });

  async function loadEvents() {
    try { const r = await axios.get(`${API}/events`, { params: { search } }); setEvents(r.data.events); }
    catch { setMessage('Could not load events. Is the backend and MongoDB running?'); }
  }
  async function loadManagedEvents(currentToken = token, currentUser = user) {
    if (!currentToken || !currentUser || !['Admin', 'Organizer'].includes(currentUser.role)) return;
    try {
      const r = await axios.get(`${API}/events/manage/all`, { headers: { Authorization: `Bearer ${currentToken}` } });
      setManagedEvents(r.data.events);
    } catch { /* public event listing remains usable */ }
  }
  useEffect(() => { loadEvents(); }, []);
  useEffect(() => { loadManagedEvents(); }, [token, user?.role]);
  async function submitAuth(e) {
    e.preventDefault(); setMessage('');
    try {
      const r = await axios.post(`${API}/auth/${mode}`, authForm);
      setToken(r.data.token); setUser(r.data.user);
      localStorage.setItem('ems-token', r.data.token); localStorage.setItem('ems-user', JSON.stringify(r.data.user));
      setMessage(`Logged in as ${r.data.user.role}.`);
    } catch (err) { setMessage(err.response?.data?.message || 'Authentication failed'); }
  }
  async function createEvent(e) {
    e.preventDefault(); setMessage('');
    try {
      const r = await axios.post(`${API}/events`, eventForm, { headers: { Authorization: `Bearer ${token}` } });
      setMessage(`Event created with status: ${r.data.event.status}. An Admin must approve it.`);
      setEventForm({ name: '', type: 'Workshop', description: '', eligibility: 'All eligible attendees', inCharge: '', date: '', venue: '', capacity: 30, registrationDeadline: '' });
    } catch (err) { setMessage(err.response?.data?.message || 'Could not create event. You need an Organizer or Admin account.'); }
  }
  async function approve(id, status) {
    try {
      await axios.patch(`${API}/events/${id}/approval`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage(`Event ${status.toLowerCase()}.`); loadEvents(); loadManagedEvents();
    } catch (err) { setMessage(err.response?.data?.message || 'Approval failed'); }
  }
  function logout() {
    localStorage.removeItem('ems-token'); localStorage.removeItem('ems-user');
    setToken(''); setUser(null); setMessage('Logged out.');
  }
  return <main className="shell">
    <header><div><p className="eyebrow">PES UNIVERSITY · SE MINI-PROJECT</p><h1>Event Management System</h1><p className="sub">Discover campus events. Organize better.</p></div>
      {user && <div className="user"><span>{user.name} · {user.role}</span><button className="secondary" onClick={logout}>Log out</button></div>}
    </header>
    {message && <div className="notice" role="status">{message}</div>}
    <section className="layout">
      <div className="panel">
        <h2>{user ? 'Your workspace' : 'Get started'}</h2>
        {!user && <><div className="tabs"><button className={mode === 'login' ? 'active' : 'secondary'} onClick={() => setMode('login')}>Login</button><button className={mode === 'register' ? 'active' : 'secondary'} onClick={() => setMode('register')}>Create account</button></div>
          <form onSubmit={submitAuth}>
            {mode === 'register' && <label>Full name<input required value={authForm.name} onChange={e => setAuthForm({...authForm, name:e.target.value})} /></label>}
            <label>Email<input type="email" required value={authForm.email} onChange={e => setAuthForm({...authForm, email:e.target.value})} /></label>
            <label>Password<input type="password" minLength="8" required value={authForm.password} onChange={e => setAuthForm({...authForm, password:e.target.value})} /></label>
            <button type="submit">{mode === 'login' ? 'Login' : 'Register as attendee'}</button>
          </form></>}
        {user && (user.role === 'Organizer' || user.role === 'Admin') && <form onSubmit={createEvent}>
          <h3>Create event</h3>
          <label>Event name<input required value={eventForm.name} onChange={e => setEventForm({...eventForm,name:e.target.value})}/></label>
          <label>Type<input required value={eventForm.type} onChange={e => setEventForm({...eventForm,type:e.target.value})}/></label>
          <label>Description<textarea required value={eventForm.description} onChange={e => setEventForm({...eventForm,description:e.target.value})}/></label>
          <label>Eligibility<input value={eventForm.eligibility} onChange={e => setEventForm({...eventForm,eligibility:e.target.value})}/></label>
          <label>In-charge<input required value={eventForm.inCharge} onChange={e => setEventForm({...eventForm,inCharge:e.target.value})}/></label>
          <label>Date and time<input type="datetime-local" required value={eventForm.date} onChange={e => setEventForm({...eventForm,date:e.target.value})}/></label>
          <label>Venue<input required value={eventForm.venue} onChange={e => setEventForm({...eventForm,venue:e.target.value})}/></label>
          <label>Capacity<input type="number" min="1" max="10000" required value={eventForm.capacity} onChange={e => setEventForm({...eventForm,capacity:Number(e.target.value)})}/></label>
          <label>Registration deadline<input type="datetime-local" required value={eventForm.registrationDeadline} onChange={e => setEventForm({...eventForm,registrationDeadline:e.target.value})}/></label>
          <button type="submit">Submit for admin approval</button>
        </form>)}
        {user?.role === 'Attendee' && <p>Your account is ready. Published events appear on the right. Registration is the next module to implement.</p>}
        {!user && <p className="hint">New accounts receive the Attendee role. Organizer/Admin accounts must be assigned securely by an administrator.</p>}
      </div>
      <div className="panel">
        {user?.role === 'Admin' && <section className="managed">
          <h2>Admin review queue</h2>
          {managedEvents.filter(ev => ev.status === 'Pending Approval').length === 0
            ? <p className="hint">No events waiting for approval.</p>
            : managedEvents.filter(ev => ev.status === 'Pending Approval').map(ev => <article className="event" key={ev._id}>
              <span className="pill">Pending Approval</span><h3>{ev.name}</h3><p>{ev.description}</p>
              <div className="actions"><button onClick={() => approve(ev._id,'Published')}>Approve</button><button className="secondary" onClick={() => approve(ev._id,'Rejected')}>Reject</button></div>
            </article>)}
        </section>}
        <div className="event-heading"><div><h2>Published events</h2><p className="hint">Only admin-approved events are listed.</p></div><button className="secondary" onClick={loadEvents}>Refresh</button></div>
        <form className="search" onSubmit={e => {e.preventDefault(); loadEvents();}}><input placeholder="Search event names..." value={search} onChange={e => setSearch(e.target.value)}/><button>Search</button></form>
        {events.length === 0 ? <div className="empty"><span>✳</span><p>No published events yet.</p><small>Create an event with an Organizer account, then approve it with an Admin account.</small></div> :
          <div className="events">{events.map(ev => <article className="event" key={ev._id}><div className="event-top"><span className="pill">{ev.type}</span><span className="date">{new Date(ev.date).toLocaleString()}</span></div><h3>{ev.name}</h3><p>{ev.description}</p><div className="meta"><span>⌖ {ev.venue}</span><span>Capacity: {ev.capacity}</span></div>{user?.role === 'Admin' && <div className="actions"><button onClick={() => approve(ev._id,'Published')}>Approve</button><button className="secondary" onClick={() => approve(ev._id,'Rejected')}>Reject</button></div>}</article>)}</div>}
      </div>
    </section>
    <footer>EMS · Early development scaffold · Do not represent unfinished features as complete.</footer>
  </main>;
}
