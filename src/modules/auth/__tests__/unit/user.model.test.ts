import { User } from '../../user.model';

describe('User mongoose model', () => {
  it('defaults refreshToken to null and isSuperuser to false', () => {
    const doc = new User({ email: 'test@example.com', password: 'hashed' });
    expect(doc.email).toBe('test@example.com');
    expect(doc.refreshToken).toBeNull();
    expect(doc.isSuperuser).toBe(false);
  });

  it('lowercases and trims email via schema setters', () => {
    const doc = new User({ email: '  Test@Example.COM  ', password: 'pw' });
    expect(doc.email).toBe('test@example.com');
  });

  it('fails validation without required fields', async () => {
    const doc = new User({});
    await expect(doc.validate()).rejects.toThrow();
  });

  it('fails validation without email', async () => {
    const doc = new User({ password: 'pw' });
    await expect(doc.validate()).rejects.toThrow();
  });

  it('fails validation without password', async () => {
    const doc = new User({ email: 'a@b.com' });
    await expect(doc.validate()).rejects.toThrow();
  });

  it('accepts a well-formed user document', async () => {
    const doc = new User({ email: 'user@example.com', password: 'hashed123' });
    await expect(doc.validate()).resolves.toBeUndefined();
  });
});
