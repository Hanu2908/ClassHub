import { describe, expect, it, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/appStore';

describe('Auth Persistence and Hub State Isolation', () => {
  beforeEach(() => {
    useAppStore.setState({
      authUser: {
        id: 'test-user-123',
        name: 'Test Student',
        email: 'test.student@skit.ac.in',
        avatarUrl: null,
        role: 'student',
        crRank: null,
        sectionId: '00000000-0000-4000-8000-000000000001',
        sectionRoll: 'P-12',
        universityRoll: '22ESKCS012',
        dayScholar: true,
        notificationsEnabled: true,
      },
      user: {
        id: 'test-user-123',
        name: 'Test Student',
        email: 'test.student@skit.ac.in',
        role: 'student',
        sectionId: '00000000-0000-4000-8000-000000000001',
        sectionRoll: 'P-12',
        universityRoll: '22ESKCS012',
        dayScholar: true,
      },
      session: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'test-user-123', email: 'test.student@skit.ac.in' } as any,
      },
      hub: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Section P2',
        college: 'SKIT Jaipur',
        inviteCode: 'P2WXYZ',
      },
      selectedSectionId: '00000000-0000-4000-8000-000000000001',
      selectedSubjectId: 'sub-1',
      optimisticAcks: new Set(['ann-1']),
      optimisticVotes: { 'poll-1': ['opt-1'] },
      offlineCache: { announcements: [{ id: 'ann-1' } as any] },
    });
  });

  it('clearHubState resets hub, selection, and offlineCache while keeping auth session and user ID intact', () => {
    const store = useAppStore.getState();
    expect(store.session).not.toBeNull();
    expect(store.authUser?.sectionId).toBe('00000000-0000-4000-8000-000000000001');

    store.clearHubState();

    const updated = useAppStore.getState();
    // Session and core user identity MUST be preserved
    expect(updated.session).not.toBeNull();
    expect(updated.session?.access_token).toBe('mock-access-token');
    expect(updated.authUser?.id).toBe('test-user-123');
    expect(updated.authUser?.email).toBe('test.student@skit.ac.in');
    expect(updated.user?.id).toBe('test-user-123');

    // Hub-specific fields MUST be wiped
    expect(updated.hub).toBeNull();
    expect(updated.authUser?.sectionId).toBeNull();
    expect(updated.authUser?.sectionRoll).toBeNull();
    expect(updated.authUser?.universityRoll).toBeNull();
    expect(updated.user?.sectionId).toBeNull();
    expect(updated.selectedSectionId).toBe('');
    expect(updated.selectedSubjectId).toBe('');
    expect(updated.optimisticAcks.size).toBe(0);
    expect(Object.keys(updated.optimisticVotes).length).toBe(0);
    expect(Object.keys(updated.offlineCache).length).toBe(0);
  });

  it('signOut completely purges both session and user identity', () => {
    const store = useAppStore.getState();
    store.signOut();

    const updated = useAppStore.getState();
    expect(updated.session).toBeNull();
    expect(updated.authUser).toBeNull();
    expect(updated.user).toBeNull();
    expect(updated.hub).toBeNull();
  });
});
