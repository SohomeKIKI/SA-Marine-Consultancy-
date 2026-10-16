import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders initial session verification on mount', () => {
    render(<App />)
    expect(screen.getByText(/verifying session/i)).toBeInTheDocument()
  })
})
