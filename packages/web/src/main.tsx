
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.tsx'
import Jobs from './pages/Jobs.tsx'
import JobDetail from './pages/JobDetail.tsx'
import Apply from './pages/Apply.tsx'
import Admin from './pages/Admin.tsx'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: '/',
        element: <Jobs />,
      },
      {
        path: '/job/:jobId',
        element: <JobDetail />,
      },
      {
        path: '/apply/:jobId',
        element: <Apply />,
      },
      {
        path: '/admin',
        element: <Admin />,
      },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
