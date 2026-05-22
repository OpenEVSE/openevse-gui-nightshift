// src/lib/components/config/__tests__/CertificateModal.test.js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import CertificateModal from '../CertificateModal.svelte'

describe('CertificateModal', () => {
  it('shows the private-key field only for the client type', async () => {
    const { queryByText, getByRole } = render(CertificateModal, { open: true })
    expect(queryByText('config.certificates.private_key')).not.toBeInTheDocument()
    await fireEvent.change(getByRole('combobox'), { target: { value: 'client' } })
    expect(queryByText('config.certificates.private_key')).toBeInTheDocument()
  })

  it('emits onsubmit with the entered certificate', async () => {
    const onsubmit = vi.fn()
    const { getByText, getByLabelText } = render(CertificateModal, { open: true, onsubmit })
    await fireEvent.input(getByLabelText('config.certificates.name'), { target: { value: 'My cert' } })
    await fireEvent.input(getByLabelText('config.certificates.certificate'), { target: { value: '-----BEGIN-----' } })
    await fireEvent.click(getByText('config.certificates.save'))
    expect(onsubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'root', name: 'My cert', certificate: '-----BEGIN-----' }),
    )
  })
})
