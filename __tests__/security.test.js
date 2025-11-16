const { sanitizeText, timingSafeCompare } = require('../src/utils/security');

describe('sanitizeText', () => {
  it('strips scripts and encodes output', () => {
    expect(sanitizeText('<script>alert("x")</script>')).toBe('');
  });
});

describe('timingSafeCompare', () => {
  it('returns false for length mismatch', () => {
    expect(timingSafeCompare('abc', 'abcd')).toBe(false);
  });

  it('compares identical strings safely', () => {
    expect(timingSafeCompare('secret', 'secret')).toBe(true);
  });
});
