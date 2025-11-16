const { sanitizeText, timingSafeCompare } = require('../src/utils/security');

describe('sanitizeText', () => {
  it('encodes HTML entities', () => {
    expect(sanitizeText('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
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
