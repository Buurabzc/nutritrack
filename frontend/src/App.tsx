import { Routes, Route } from 'react-router-dom'
import { useViewport } from './hooks/useViewport'
import { Layout } from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Meals from './pages/Meals'
import WeeklyPlan from './pages/WeeklyPlan'
import AIChat from './pages/AIChat'
import BodyTracker from './pages/BodyTracker'
import Settings from './pages/Settings'
import Exercise from './pages/Exercise'
import Fasting from './pages/Fasting'

export default function App() {
  useViewport()

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="meals" element={<Meals />} />
        <Route path="plan" element={<WeeklyPlan />} />
        <Route path="ai" element={<AIChat />} />
        <Route path="body" element={<BodyTracker />} />
        <Route path="settings" element={<Settings />} />
        <Route path="exercise" element={<Exercise />} />
        <Route path="fasting" element={<Fasting />} />
        <Route path="login" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
