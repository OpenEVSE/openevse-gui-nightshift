import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import AlertBox from '../AlertBox.svelte'

describe('AlertBox', () => {
  it('renders nothing when not visible', () => {
    const { queryByRole } = render(AlertBox, { props: { visible: false, title: 'T', body: 'B' } })
    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the title and body when visible', () => {
    const { getByRole } = render(AlertBox, { props: { visible: true, title: 'Error', body: 'Bad' } })
    const dialog = getByRole('dialog')
    expect(dialog).toHaveTextContent('Error')
    expect(dialog).toHaveTextContent('Bad')
  })
})
