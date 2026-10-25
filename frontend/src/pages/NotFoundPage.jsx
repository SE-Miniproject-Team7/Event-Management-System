
import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="eyebrow">404 ERROR</p>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link className="home-link" to="/">
        Return home
      </Link>
    </section>
  )
}

export default NotFoundPage
