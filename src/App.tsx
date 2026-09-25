import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Album from './pages/Album'

// o painel de admin (e a compressão de imagens) só carrega para quem entra em /admin
const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        </div>
      }
    >
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Album />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Album />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
