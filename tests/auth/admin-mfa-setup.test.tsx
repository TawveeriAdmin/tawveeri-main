/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminMfaSetup } from '@/components/auth/admin-mfa-setup';

const mockMfa = { listFactors: jest.fn(), enroll: jest.fn(), challengeAndVerify: jest.fn() };
jest.mock('@/lib/database/supabase', () => ({ getBrowserClient: () => ({ auth: { mfa: mockMfa } }) }));

describe('owner MFA enrollment and recovery factor selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMfa.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    mockMfa.enroll.mockResolvedValue({ data: { id: 'new-factor', totp: { qr_code: 'data:image/svg+xml,<svg/>' } }, error: null });
    mockMfa.challengeAndVerify.mockResolvedValue({ error: null });
  });
  it('enrolls only after owner action, verifies and removes the private QR', async () => {
    render(<AdminMfaSetup locale="en" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Set up an authenticator' })).toBeEnabled());
    expect(mockMfa.enroll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Set up an authenticator' }));
    expect(await screen.findByAltText('Your private authenticator setup QR')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(mockMfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'new-factor', code: '123456' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('allows an existing alternative factor without changing or deleting factors', async () => {
    mockMfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'primary', friendly_name: 'Primary' }, { id: 'backup', friendly_name: 'Backup' }] }, error: null });
    render(<AdminMfaSetup locale="en" />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'backup' } });
    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await screen.findByRole('status');
    expect(mockMfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'backup', code: '654321' });
    expect(mockMfa.enroll).not.toHaveBeenCalled();
  });
  it('keeps failed verification closed and shows a generic error', async () => {
    mockMfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'primary' }] }, error: null });
    mockMfa.challengeAndVerify.mockResolvedValue({ error: { message: 'sensitive-provider-detail' } });
    render(<AdminMfaSetup locale="en" />);
    fireEvent.change(await screen.findByLabelText('Authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Code not accepted');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('sensitive-provider-detail')).not.toBeInTheDocument();
  });
});
